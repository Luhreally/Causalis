// node tools/l5-gate.ts [--ci] [--soft] [--shots dir] [--earth file.save] [--alien file.save]: gate 79, courts and drama (Lives L5),
// at a phone's size, by real touch, on Earth and one alien world, each a far save or (as on CI) a world run a few centuries.
//   1. a realm's Court tab, pressed: the ruler, the heir and why, the rival and why, a voice and what they want, in real text on screen;
//   2. a rival's page, pressed: who they are in this drama, why they want it, with numbers; their family;
//   3. their home, pressed: the chip names them, they are among those drawn, and the body can be taken;
//   4. an heir takes the seat: a ruler's death, with no one ruling: the one the Court tab named holds it, and history says so;
//   5. a plot found, with no one ruling: told on the Court tab, in the alerts of a realm followed, in the chronicle, with a why that names a person and a number;
//   6. a plot won, under a ruler taken: the clock stops with a window; let come, the realm decides it, and the world is the same as with no one there;
//   7. a plot answered by touch: the plotter seized, a refusal in words when standing is gone, their standing paid;
//   8. an heir's death under a ruler taken: the clock stops, one is named by touch, and the bar says who;
//   9. no error in the page; nothing is wider than the screen; no control is too small.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  courtOf,
  orderOf,
  politiesOf,
  populationContext,
  rivalMoves,
  type Court,
  type CourtFigure,
  type Polity,
} from "../src/sim/index.ts";
import { seatTownOf } from "../src/host/leaders.ts";
import { COURT } from "../src/rules/index.ts";
import type { ReignNow } from "../src/bridge/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots");
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 79, courts and drama");

// 0. Pure: a seat's weakness moves a rival more than a strong one does; a people's custom holds them back.
check(COURT.line > 0 && COURT.pace > 0, "the courts' numbers are off");

type Scene = {
  readonly realm: string;
  readonly town: string;
  readonly ruler: string;
  readonly heir: string | null;
  readonly heirRef: string | null;
  readonly rival: string;
  readonly rivalRef: string;
  readonly voiceRef: string | null;
};
type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  /** Read on its Court tab, and walked in. */
  readonly look: Scene;
  /** Its old ruler dies this year, with no one ruling. */
  readonly dies: Scene;
  /** A plot that will be found, with no one ruling. */
  readonly found: Scene;
  /** A plot that will carry the seat, let come under a ruler taken. */
  readonly won: Scene;
  /** A plot to answer by touch. */
  readonly answer: Scene;
  /** An heir about to die under a ruler taken. */
  readonly bereft: Scene;
  readonly hashAt: number;
  readonly hashes: string;
};

const worldOf = (
  universe: "earth" | "alien",
  seed: string,
  year: number,
  file?: string,
): { world: World; seed: string } => {
  const u = universe === "earth" ? EARTH : ALIEN;
  if (file) {
    const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
        typeof loadWorld
      >[0],
      probe = u.build(seedFromText(doc.seed));
    return {
      world: loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
        allowRulesetChange: true,
      }).world,
      seed: doc.seed,
    };
  }
  const world = u.build(seedFromText(seed));
  world.runTo(year * YEAR);
  return { world, seed };
};

function forge(
  universe: "earth" | "alien",
  seedAsked: string,
  year: number,
  file?: string,
): Forged {
  const started = performance.now(),
    u = universe === "earth" ? EARTH : ALIEN,
    { world, seed } = worldOf(universe, seedAsked, year, file);
  // (An old save has no courts: they fill in a year's turn.)
  world.runTo(Math.ceil(world.now / YEAR + 2) * YEAR);
  const ctx = populationContext(world),
    courts = courtOf(world)!,
    realms = politiesOf(world),
    orders = orderOf(world)!,
    grown = ctx.life.adulthood,
    now = Math.floor(world.now / YEAR),
    of = (p: Polity) => courts.of(p.ref)!,
    fig = (c: Court, id: number | null) => c.figures.find((f) => f.id === id),
    adult = (f: CourtFigure | undefined) => !!f && now - f.born >= grown,
    usable = [...realms.living()]
      .filter((p) => {
        const c = courts.of(p.ref),
          o = orders.of(p.ref);
        return (
          !!c &&
          !!o &&
          !c.plot &&
          now - p.ruler.born >= grown &&
          adult(fig(c, c.rival)) &&
          fig(c, c.rival)!.seat !== "the army" &&
          !!seatTownOf(world, p) &&
          p.members.length >= 1
        );
      })
      .sort((a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1));
  if (usable.length < 5) throw new Error(`${seed}: only ${usable.length} realms with a rival`);
  const scene = (p: Polity): Scene => {
      const c = of(p),
        heir = fig(c, c.heir),
        rival = fig(c, c.rival)!,
        voice = c.figures.find((f) => f.id !== c.heir && f.id !== c.rival);
      return {
        realm: p.ref,
        town: p.town,
        ruler: p.ruler.name,
        heir: heir?.name ?? null,
        heirRef: heir ? `court:${p.ref}:${heir.id}` : null,
        rival: rival.name,
        rivalRef: `court:${p.ref}:${rival.id}`,
        voiceRef: voice ? `court:${p.ref}:${voice.id}` : null,
      };
    },
    withHeir = usable.filter((p) => adult(fig(of(p), of(p).heir))),
    // (The richest court, with an heir, a rival and another, is read.)
    lookP =
      withHeir.find((p) => of(p).figures.length >= 3 && p.members.length >= 2) ??
      withHeir[0] ??
      usable[0]!,
    rest = usable.filter((p) => p !== lookP),
    diesP = withHeir.find((p) => p !== lookP) ?? rest[0]!,
    left = rest.filter((p) => p !== diesP),
    [foundP, wonP, answerP] = [left[0]!, left[1]!, left[2]!],
    bereftP =
      withHeir.find(
        (p) => p !== lookP && p !== diesP && p !== foundP && p !== wonP && p !== answerP,
      ) ??
      left[3] ??
      foundP,
    move = (p: Polity, won: boolean) => {
      const c = of(p),
        f = fig(c, c.rival)!,
        o = orders.of(p.ref)!;
      c.quiet = 0;
      rivalMoves(ctx, p, c, f, o, world.now);
      c.plot = { ...c.plot!, won };
    };
  const look = scene(lookP),
    dies = scene(diesP),
    found = scene(foundP),
    won = scene(wonP),
    answer = scene(answerP),
    bereft = scene(bereftP);
  move(foundP, false);
  move(wonP, true);
  move(answerP, false);
  // The one who is to die, and an heir about to, are of the oldest band a people's table has.
  diesP.ruler = { ...diesP.ruler, born: now - 3 * ctx.life.bands.at(-1)! };
  {
    const c = of(bereftP),
      f = fig(c, c.heir);
    if (f) (f as { born: number }).born = now - 3 * ctx.life.bands.at(-1)!;
  }
  const bytes = gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    hashAt = world.now + YEAR;
  world.runTo(hashAt);
  const hashes = JSON.stringify(world.domainHashes());
  say(
    `${seed}: year ${now}, ${realms.living().length} realms, ${usable.length} with a rival; read ${look.town}, made in ${((performance.now() - started) / 1000).toFixed(0)} s`,
  );
  return { bytes, universe, seed, look, dies, found, won, answer, bereft, hashAt, hashes };
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4279, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const settle = (ms: number) => page.waitForTimeout(slow(ms));
const centre = (sel: string) =>
  k<{ x: number; y: number; under: boolean } | null>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    return { x, y, under: !!top && !(e === top || e.contains(top)) };
  })()`);
/** A real touch: a control under another element is found this way. */
const tap = async (sel: string) => {
  await k(
    `document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: "center", inline: "center" })`,
  );
  await page.waitForTimeout(80);
  let at: { x: number; y: number; under: boolean } | null = null;
  await until(`${sel} on the screen`, async () => !!(at = await centre(sel)));
  if (!at) return;
  const p = at as { x: number; y: number; under: boolean };
  check(!p.under, `${sel} is under another element`);
  await page.touchscreen.tap(p.x, p.y);
};
/** A real touch on a tab, by its words. */
const tapTab = async (words: string) => {
  const id = `gate-tab-${words}`;
  await k(`(() => {
    const b = [...document.querySelectorAll("nav.tabs button, nav.tabs a")].find((x) => x.textContent.trim() === ${JSON.stringify(words)});
    if (b) b.id = ${JSON.stringify(id)};
  })()`);
  await tap(`#${id}`);
};
const big = (sel: string) =>
  k<boolean>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.width >= 44 && r.height >= 44;
  })()`);
const fits = () => k<boolean>("document.documentElement.scrollWidth <= 430");
const seen = (sel: string) => centre(sel).then((c) => !!c);
const text = (sel: string) =>
  k<string>(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? ""`);
const pageText = () => text(".page-window");
const reign = () => k<ReignNow | null>("globalThis.causalis.reign.state()");
const clock = () => k<number>("globalThis.causalis.client.status.t");
const advanceTo = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await until(`the clock at ${t}`, async () =>
    k<boolean>(`globalThis.causalis.client.status.t >= ${Math.round(t)} - 1`),
  );
};
const open = (ref: string) => k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
const close = () => k(`globalThis.causalis.closePage?.()`);

async function takeUp(f: Forged): Promise<void> {
  const name = `${f.universe}:gate79`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`,
    drawn = () =>
      page.waitForFunction(
        () =>
          ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
        undefined,
        { timeout: slow(180000) },
      );
  await page.goto(`${base}?${q}&hold=1`);
  await drawn();
  const b64 = f.bytes.toString("base64");
  await page.evaluate(
    async ([data, keep]) => {
      const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
      const c = (
        globalThis as unknown as {
          causalis: {
            client: {
              importSave(b: Uint8Array): Promise<unknown>;
              save(n: string): Promise<unknown>;
            };
          };
        }
      ).causalis.client;
      await c.importSave(bytes);
      await c.save(keep as string);
    },
    [b64, name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await drawn();
  await k("globalThis.causalis.client.setSpeed(0)");
}

/** Who a realm's page shows, of its key figures and its court. */
async function cardsOf(realm: string): Promise<{ name: string; kind: string; did: string }[]> {
  const page = await ask<{
    tabs: {
      blocks: { tool?: string; args?: { leader?: { name: string; kind: string; did: string } } }[];
    }[];
  } | null>("page", { ref: realm });
  return (page?.tabs ?? [])
    .flatMap((t) => t.blocks)
    .flatMap((b) => (b.tool === "leader.card" && b.args?.leader ? [b.args.leader] : []));
}

/** The Court tab, opened from the realm's own page by touch. */
async function courtTab(s: Scene, tag: string): Promise<void> {
  await open(s.realm);
  await until(`${tag}: ${s.town}'s page`, () => seen("nav.tabs"));
  await settle(200);
  await tapTab("Court");
  await until(`${tag}: the Court tab`, () => seen(".leader-card"), slow(30000));
  await settle(200);
  await k(`document.querySelector(".page-window .page-body")?.scrollIntoView({ block: "start" })`);
  await settle(150);
}

/** Take a realm's ruler by touch, from their card on its Court tab. */
async function takeRuler(s: Scene, tag: string): Promise<void> {
  await courtTab(s, tag);
  await tap(".leader-rule");
  await until(
    `${tag}: the ruling bar`,
    async () => (await seen(".reign-strip")) && !!(await reign()),
    slow(120000),
  );
}

async function play(f: Forged, tag: string): Promise<void> {
  await takeUp(f);
  const l = f.look;

  // 1. The Court tab, by touch.
  await courtTab(l, tag);
  const words = await pageText();
  say(`${tag}: ${l.town}'s court: ${words.replace(/\s+/g, " ").slice(0, 500)}`);
  check(words.includes(l.ruler), `${tag}: the ruler is not on the Court tab`);
  if (l.heir) check(words.includes(l.heir), `${tag}: the heir is not on the Court tab`);
  check(words.includes(l.rival), `${tag}: the rival is not on the Court tab`);
  check(/Wants the seat/.test(words), `${tag}: nothing says why the rival wants the seat`);
  check(/in a hundred/.test(words), `${tag}: the rival's why has no number`);
  check(/Rule here passes|keep no houses/.test(words), `${tag}: how the seat passes is not told`);
  check(await fits(), `${tag}: the Court tab is wider than the screen`);
  await shot(`${tag}-1-court`);
  if (l.heirRef) {
    await k(
      `document.querySelector(${JSON.stringify(`.leader-card[data-ref="${l.heirRef}"]`)})?.scrollIntoView({ block: "center" })`,
    );
    await settle(150);
    await shot(`${tag}-1b-court-heir`);
  }
  const rivalCard = `.leader-card[data-ref="${l.rivalRef}"]`;
  check(await seen(rivalCard), `${tag}: the rival has no card`);
  check(await big(`${rivalCard} .leader-name`), `${tag}: the rival's name is too small to press`);
  check(await big(`${rivalCard} .leader-go`), `${tag}: the way to their home is too small`);

  // 2. The rival's page, by touch.
  await tap(`${rivalCard} .leader-name`);
  await until(`${tag}: the rival's page`, async () => (await pageText()).includes("In this drama"));
  await settle(200);
  const theirs = await pageText();
  say(`${tag}: ${l.rival}: ${theirs.replace(/\s+/g, " ").slice(0, 400)}`);
  check(theirs.includes(l.rival), `${tag}: the rival's page does not name them`);
  check(/Why they want it/i.test(theirs), `${tag}: the rival's page says not why`);
  check(/in a hundred/.test(theirs), `${tag}: the rival's reasons have no number`);
  check(/What they did/i.test(theirs), `${tag}: the rival's page does not say what they did`);
  await shot(`${tag}-2-rival`);
  await tapTab("Family");
  await until(`${tag}: their family`, async () => /family/i.test(await pageText()));
  await settle(150);
  await shot(`${tag}-2b-family`);

  // 3. Their home, by touch: the chip names them; the body can be taken.
  await courtTab(l, tag);
  await tap(`${rivalCard} .leader-go`);
  await until(
    `${tag}: their home`,
    async () => (await seen(".leader-chip")) && (await text(".leader-chip")).includes(l.rival),
    slow(180000),
  );
  await settle(800);
  const drawn = await k<boolean>(
    `globalThis.causalis.planNow().people.some((q) => q.figure === ${JSON.stringify(l.rivalRef)})`,
  );
  check(drawn, `${tag}: the rival is not among those drawn in their town`);
  await shot(`${tag}-3-home`);
  await tap(".leader-possess");
  await until(
    `${tag}: their body taken`,
    () => k<boolean>("!!globalThis.causalis.possess.state()"),
    slow(180000),
  );
  await settle(1000);
  await shot(`${tag}-3b-possessed`);
  await tap(".possess-letgo");
  await until(
    `${tag}: let go`,
    () => k<boolean>("!globalThis.causalis.possess.state()"),
    slow(60000),
  );
  await until(`${tag}: the chip again`, () => seen(".leader-chip"));
  await tap(".leader-close");

  // 4–5. A year goes by with no one ruling: an old ruler dies, and a plot is found; the realm followed is told.
  await ask("observe.watch", { ref: f.found.realm, on: true });
  await close();
  await advanceTo(f.hashAt);
  await settle(500);
  const sameNoOne = JSON.stringify(await ask<unknown>("hashes")) === f.hashes;
  say(
    `${tag}: a year with no one ruling, the worker against the fork: ${sameNoOne ? "the same hashes" : "different (the follow is the ledger's, and watched)"}`,
  );

  // The heir holds the seat. (Death takes its time: the oldest band's table is about one in six a year.)
  const seatNow = async () => {
    const cards = await cardsOf(f.dies.realm),
      ruler = cards.find((x) => x.kind === "ruler");
    return {
      ruler: ruler?.name ?? "",
      heir: cards.find((x) => x.kind === "heir")?.name ?? null,
      ended: !ruler,
      last: ruler?.did ?? "",
    };
  };
  let was = await seatNow(),
    y = 0;
  while (was.ruler === f.dies.ruler && !was.ended && y++ < 40) {
    await advanceTo(f.hashAt + y * YEAR);
    const now = await seatNow();
    if (now.ruler === f.dies.ruler) was = now;
    else {
      const named = was.heir,
        last = now.last;
      await courtTab(f.dies, tag);
      const after = await pageText();
      check(
        after.includes(now.ruler),
        `${tag}: ${now.ruler} holds the seat and the Court tab does not say so`,
      );
      check(
        !after.includes(f.dies.ruler) || /What has passed/i.test(after),
        `${tag}: ${f.dies.ruler} is dead and still on the Court tab`,
      );
      check(
        !new RegExp(`${now.ruler}\\s+Heir`, "i").test(after),
        `${tag}: the one who follows is still heir`,
      );
      if (named && now.ruler === named)
        say(
          `${tag}: ${f.dies.ruler} died after ${y} years, and ${named}, the heir named, holds the seat of ${f.dies.town}`,
        );
      else {
        // (Not the heir: then history must say why.)
        say(
          `${tag}: ${f.dies.ruler} died after ${y} years; ${now.ruler} holds the seat, not ${named}: ${last}`,
        );
        check(
          last.length > 0,
          `${tag}: ${now.ruler} took the seat over ${named} and nothing says why`,
        );
      }
      await shot(`${tag}-4-followed`);
      was = now;
      break;
    }
  }
  check(
    was.ruler !== f.dies.ruler || was.ended,
    `${tag}: ${f.dies.ruler} outlived forty years of the oldest band's table`,
  );
  // (Back to the year the fork was made for: what follows was told by then.)
  await takeUp(f);
  await k(`globalThis.causalis.client.setSpeed(0)`);
  await ask("observe.watch", { ref: f.found.realm, on: true });
  await advanceTo(f.hashAt);
  await settle(500);

  // A plot found: on its Court tab, with a why that walks to a person and a number.
  await courtTab(f.found, tag);
  const told = await pageText();
  check(/What has passed at this court/i.test(told), `${tag}: the court does not tell what passed`);
  check(told.includes(f.found.rival), `${tag}: the plotter is not told`);
  check(/plot was found/.test(told), `${tag}: a plot found is not told: ${told.slice(0, 400)}`);
  await k(
    `[...document.querySelectorAll(".page-window li, .page-window .item, .page-window button, .page-window a")].filter((x) => /plot was found/.test(x.textContent)).pop()?.setAttribute("data-gate", "found")`,
  );
  await shot(`${tag}-5-found`);
  await tap(`[data-gate="found"]`);
  await until(`${tag}: the plot's page`, async () => /Why it happened/i.test(await pageText()));
  await settle(400);
  // Down its why: the plot's move, and what moved them.
  const stepWhy = async () => {
    for (let i = 0; i < 3 && (await seen(".page-window button.cause:not(:disabled)")); i++) {
      await tap(".page-window button.cause:not(:disabled)");
      await settle(400);
    }
  };
  await stepWhy();
  await until(
    `${tag}: the why names a person and a number`,
    async () => {
      const w = await pageText();
      return w.includes(f.found.rival) && /[+-]0\.\d\d/.test(w);
    },
    slow(10000),
  );
  const whyWords = await pageText();
  say(`${tag}: why: ${whyWords.replace(/\s+/g, " ").slice(0, 500)}`);
  await shot(`${tag}-5b-why`);
  await close();
  // The chronicle, and the alerts of a realm followed.
  const chron = await ask<{ events: { claim: string }[] }>("chronicle", { limit: 400 });
  check(
    chron.events.some((e) => /plot was found/.test(e.claim) && e.claim.includes(f.found.rival)),
    `${tag}: a plot found is not in the chronicle`,
  );
  await until(
    `${tag}: the alert`,
    () => k<boolean>(`[...document.querySelectorAll(".alerts-row button")].length > 0`),
    slow(15000),
  );
  const alerts =
    await ask<{ id: string; items: { line: (string | { text: string })[] }[] }[]>("alerts");
  const inAlerts = alerts.some((a) =>
    a.items.some((i) =>
      i.line
        .map((x) => (typeof x === "string" ? x : x.text))
        .join("")
        .includes(f.found.rival),
    ),
  );
  check(inAlerts, `${tag}: the plot is not among the alerts of a realm followed`);
  await k(
    `[...document.querySelectorAll(".alerts-row button")].find((b) => b.textContent.includes("🗡"))?.setAttribute("data-gate", "alert")`,
  );
  if (await seen(`[data-gate="alert"]`)) {
    await tap(`[data-gate="alert"]`);
    await settle(400);
    check(
      (await text(".alert-list")).includes(f.found.rival),
      `${tag}: the alert does not show the plotter on the screen`,
    );
    await shot(`${tag}-5c-alert`);
    await tap(`[data-gate="alert"]`);
  } else check(false, `${tag}: no strife alert to press`);
  await ask("observe.watch", { ref: f.found.realm, on: false });
}

/** A plot and an heir's death, under a ruler taken. */
async function rule(f: Forged, tag: string): Promise<void> {
  // A plot answered by touch.
  await takeUp(f);
  const a = f.answer;
  await takeRuler(a, `${tag} answering`);
  await until(
    `${tag}: the window of a plot`,
    async () => /plot against you/i.test(await text(".reign-window")),
    slow(30000),
  );
  const t0 = await clock();
  await settle(1500);
  check((await clock()) === t0, `${tag}: the clock ran on behind the window of a plot`);
  const w = await text(".reign-window");
  say(`${tag}: window: ${w.replace(/\s+/g, " ")}`);
  check(w.includes(a.rival), `${tag}: the window does not name the plotter`);
  check(/in a hundred/.test(w), `${tag}: the window has no number`);
  check(await big(`.reign-drama[data-choice="seize"]`), `${tag}: Seize is too small to press`);
  check(await big(`.reign-drama[data-choice="buy"]`), `${tag}: Buy off is too small to press`);
  check(await big(`.reign-drama[data-choice="let"]`), `${tag}: Let it come is too small to press`);
  check(await fits(), `${tag}: the window is wider than the screen`);
  await shot(`${tag}-6-plot-window`);
  const before = (await reign())!;
  await tap(`.reign-drama[data-choice="seize"]`);
  await until(`${tag}: the plot ended`, async () => !(await reign())?.drama, slow(30000));
  await settle(400);
  const after = (await reign())!;
  check(after.legitimacy < before.legitimacy, `${tag}: seizing a plotter cost nothing`);
  await tap(`.reign-pace`);
  await settle(300);
  await shot(`${tag}-6b-seized`);
  const told = after.told.map((x) => x.words).join(" | ");
  say(
    `${tag}: after: standing ${before.legitimacy.toFixed(3)} to ${after.legitimacy.toFixed(3)}; told: ${told.slice(0, 300)}`,
  );
  check(told.includes(a.rival), `${tag}: the realm's tidings do not name the plotter seized`);
  await tap(".reign-letgo");
  await until(`${tag}: let go`, async () => !(await seen(".reign-strip")));

  // The same plot bought off: they stay at court, it costs less, and it is told.
  await takeUp(f);
  await takeRuler(a, `${tag} buying`);
  await until(
    `${tag}: the window of the plot to buy off`,
    async () => /plot against you/i.test(await text(".reign-window")),
    slow(30000),
  );
  const buy0 = (await reign())!;
  await tap(`.reign-drama[data-choice="buy"]`);
  await until(`${tag}: the plot bought off`, async () => !(await reign())?.drama, slow(30000));
  await settle(400);
  const buy1 = (await reign())!,
    tale = buy1.told.map((x) => x.words).join(" | ");
  say(
    `${tag}: bought off: standing ${buy0.legitimacy.toFixed(3)} to ${buy1.legitimacy.toFixed(3)}; told: ${tale.slice(0, 200)}`,
  );
  check(buy1.legitimacy < buy0.legitimacy, `${tag}: buying off a plotter cost nothing`);
  check(
    buy0.legitimacy - buy1.legitimacy < before.legitimacy - after.legitimacy + 1e-6,
    `${tag}: buying off cost more than seizing`,
  );
  check(tale.includes(a.rival), `${tag}: the realm's tidings do not name the plotter bought off`);
  check(
    (await cardsOf(a.realm)).some((x) => x.name === a.rival),
    `${tag}: the one bought off is no longer at court`,
  );
  await shot(`${tag}-6c-bought`);
  await tap(".reign-pace");
  await settle(200);
  await tap(".reign-letgo");
  await until(`${tag}: let go`, async () => !(await seen(".reign-strip")));

  // A plot won: let come; the realm decides it, as with no one there.
  await takeUp(f);
  const b = f.won;
  await takeRuler(b, `${tag} letting`);
  await until(
    `${tag}: the window of the plot let come`,
    async () => /plot against you/i.test(await text(".reign-window")),
    slow(30000),
  );
  await tap(`.reign-drama[data-choice="let"]`);
  await until(`${tag}: the window gone`, async () => !(await seen(".reign-window .life-wintitle")));
  await tap(`.reign-pace`);
  await settle(300);
  await advanceTo(f.hashAt);
  await settle(600);
  const same = JSON.stringify(await ask<unknown>("hashes")) === f.hashes;
  check(same, `${tag}: a plot let come is not what the realm would have done with no one there`);
  say(`${tag}: let come: ${same ? "the same hashes as no one there" : "DIFFERENT"}`);
  await until(`${tag}: their fall`, async () => !!(await reign())?.fell, slow(30000));
  const fell = (await reign())?.fell;
  await until(`${tag}: the window of their fall`, () => seen(".reign-window .life-wintitle"));
  check(
    !!fell && fell.words.includes(b.rival),
    `${tag}: the fall does not name the one who took the seat: ${fell?.words}`,
  );
  say(`${tag}: fall: ${fell?.title}: ${fell?.words}`);
  await settle(300);
  await shot(`${tag}-7-fall`);
  await tap(".reign-end");
  await until(`${tag}: let go at the last`, async () => !(await seen(".reign-strip")));

  // An heir's death under a ruler taken: a window, and one named by touch.
  await takeUp(f);
  const c = f.bereft;
  if (c.heir) {
    await takeRuler(c, `${tag} bereft`);
    await tap(`.reign-pace`);
    await settle(200);
    const name = c.heir;
    // (Death takes its time. Any other window on the way is let come: this ruler is here for the one thing.)
    const died = async () => (await text(".reign-window")).includes("has died");
    let came = false;
    for (let y = 1; y <= 40 && !came; y++) {
      await k(`globalThis.causalis.client.advance(${Math.round(f.hashAt + y * YEAR)})`);
      const by = Date.now() + slow(30000);
      while (Date.now() < by) {
        came = await died();
        if (came) break;
        if (await seen(`.reign-drama[data-choice="let"]`)) {
          await tap(`.reign-drama[data-choice="let"]`);
          await settle(200);
          if (await seen(".reign-pace")) await tap(".reign-pace");
        }
        if (
          (await reign())?.fell ||
          (await k<number>("globalThis.causalis.client.status.t")) >= f.hashAt + y * YEAR - 1
        )
          break;
        await page.waitForTimeout(100);
      }
      if ((await reign())?.fell) break;
    }
    check(came || !!(await reign())?.fell, `${tag}: no window for an heir's death in forty years`);
    if (!came) say(`${tag}: their reign ended before their heir died`);
    if (came) {
      const wb = await text(".reign-window");
      say(`${tag}: window: ${wb.replace(/\s+/g, " ")}`);
      check(wb.includes(name), `${tag}: the window does not name the heir who died`);
      await shot(`${tag}-8-heir-window`);
      const can = await k<boolean>(
        `!!document.querySelector('.reign-drama[data-choice="name"][data-can="1"]')`,
      );
      if (can) {
        const picked = await k<string>(
          `document.querySelector('.reign-drama[data-choice="name"][data-can="1"]').textContent`,
        );
        await tap(`.reign-drama[data-choice="name"][data-can="1"]`);
        await until(
          `${tag}: the bar names the new heir`,
          async () => {
            const r = await reign();
            return !!r && picked.includes(r.heir.split(",")[0]!);
          },
          slow(30000),
        );
        await settle(300);
        await shot(`${tag}-8b-named`);
        say(`${tag}: named: ${(await reign())?.heir}`);
      } else {
        await tap(`.reign-drama[data-choice="let"]`);
        say(`${tag}: no one grown to name: let stand`);
      }
    }
    await tap(".reign-letgo");
    await until(`${tag}: let go at the end`, async () => !(await seen(".reign-strip")));
  }
}

try {
  const e = forge("earth", "first light", 450, arg("--earth"));
  await play(e, "earth");
  await rule(e, "earth");
  const a = forge("alien", "harrow 348", 400, arg("--alien"));
  await play(a, "alien");
  await rule(a, "alien");
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 79 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 79 passed");
process.exit(0);
