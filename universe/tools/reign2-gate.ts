// node tools/reign2-gate.ts [--ci] [--soft] [--shots dir] [--seed s] [--year y]: gate 116, a role and the god in it, and a
// realm's fortune laid strong and long (asked 2026-11-13), at a phone's size, by real touch, on a world run a few centuries.
//   1. one of a court taken from the realm's Court tab, not its ruler: the bar names them, the tray proposes, nothing is
//      submitted, and a year under them doing nothing is the same world as without them;
//   2. as a mortal a law step is refused them for their station (the realm's voices would not carry it, or the ruler would
//      not hear them), and the same step carries once the god is channelled into them: the switch says so, the law is
//      changed, an omen is told;
//   3. an act within their station, as a mortal: a group courted to stand behind them;
//   4. a blessing at the greatest strength for 5 years, and a curse the same, each by touch in the god's hand: the realm's
//      page says how strong, for how long, and what it lays on it; five years on, the cursed realm has broken apart or
//      fallen, the blessed one has not, and the page tells the curse lifted;
//   5. no error in the page; nothing wider than the screen; every control pressed a finger's size.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  LAWS,
  LAW_OF,
  backProblem,
  courtOf,
  orderOf,
  politiesOf,
  populationContext,
  proposeProblem,
  roleStationOf,
  type Polity,
} from "../src/sim/index.ts";
import type { ReignDecrees, ReignNow } from "../src/bridge/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  universe = (arg("--universe") ?? "alien") as "earth" | "alien",
  seedAsked = arg("--seed") ?? "harrow 348",
  yearAsked = Number(arg("--year") ?? 400);
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
console.log("gate 116, a role and the god in it; a realm's fortune");

// The world, and in it: one of a court who speaks for a group, a law step the realm's voices would not carry for them but
// the god in them would, a group that would stand behind them; a realm to bless; one of several lands to curse.
const started = performance.now(),
  u = universe === "earth" ? EARTH : ALIEN,
  world = u.build(seedFromText(seedAsked));
world.runTo(yearAsked * YEAR);
const ctx = populationContext(world),
  realms = politiesOf(world),
  living = [...realms.living()].sort(
    (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
  );
type Pick = { r: Polity; fig: number; name: string; law: string; to: number; group: string };
let pick: Pick | null = null;
for (const r of living) {
  if (pick) break;
  const c = courtOf(world)?.of(r.ref),
    o = orderOf(world)?.of(r.ref);
  if (!c || !o) continue;
  for (const f of c.figures) {
    if (f.seat === "house") continue;
    const st = roleStationOf(ctx, r, c, f);
    if (!st.grown) continue;
    const group = st.groups.find((g) => !backProblem(ctx, r, c, f, g.group, false));
    if (!group) continue;
    for (const law of LAWS) {
      const now = o.laws[LAW_OF[law]]!;
      for (const to of [now - 1, now + 1].filter((x) => x >= 0 && x <= 2)) {
        const args = { what: "law" as const, law, to };
        if (
          proposeProblem(ctx, r, c, f, args) &&
          !proposeProblem(ctx, r, c, f, { ...args, channel: true })
        ) {
          pick = { r, fig: f.id, name: f.name, law, to, group: group.group };
          break;
        }
      }
      if (pick) break;
    }
    if (pick) break;
  }
}
if (!pick)
  throw new Error(`no one of a court on ${seedAsked} whom only the god in them would carry`);
const blessed = living.find((r) => r !== pick!.r && r.members.length >= 3)!,
  cursed = living.find((r) => r !== pick!.r && r !== blessed && r.members.length >= 4)!;
const bytes = gzipSync(
    JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
  ),
  hashAt = world.now + YEAR;
world.runTo(hashAt);
const hashes = JSON.stringify(world.domainHashes());
say(
  `${seedAsked}: year ${yearAsked}, ${living.length} realms; as ${pick.name} at the court of ${pick.r.town} (${pick.law} to ${pick.to}, courting ${pick.group}); blessing ${blessed.town} (${blessed.members.length} lands), cursing ${cursed.town} (${cursed.members.length} lands); made in ${((performance.now() - started) / 1000).toFixed(0)} s`,
);

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4333, strictPort: false } }),
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
  k<{ x: number; y: number; under: boolean; w: number; h: number } | null>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    return { x, y, w: r.width, h: r.height, under: !!top && !(e === top || e.contains(top)) };
  })()`);
/** A real touch, on a control a finger's size that nothing lies over. */
const tap = async (
  sel: string,
  at?: (c: { x: number; y: number; w: number; h: number }) => { x: number; y: number },
) => {
  await k(
    `document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: "center", inline: "center" })`,
  );
  await page.waitForTimeout(80);
  let c: Awaited<ReturnType<typeof centre>> = null;
  await until(`${sel} on the screen`, async () => !!(c = await centre(sel)));
  if (!c) return;
  const p = c as { x: number; y: number; w: number; h: number; under: boolean };
  check(!p.under, `${sel} is under another element`);
  check(
    p.w >= 44 && p.h >= 44,
    `${sel} is too small to press (${p.w.toFixed(0)}×${p.h.toFixed(0)})`,
  );
  const to = at ? at(p) : p;
  await page.touchscreen.tap(to.x, to.y);
};
const seen = (sel: string) => centre(sel).then((c) => !!c);
const text = (sel: string) =>
  k<string>(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ""`);
const fits = () => k<boolean>("document.documentElement.scrollWidth <= 430");
const reign = () => k<ReignNow | null>("globalThis.causalis.reign.state()");
const clock = () => k<number>("globalThis.causalis.client.status.t");
const advanceTo = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await until(
    `the clock at ${t}`,
    async () => k<boolean>(`globalThis.causalis.client.status.t >= ${Math.round(t)} - 1`),
    slow(300000),
  );
};
const pageText = () => text(".page-panel");
/** A realm as it stands: its people, lands, standing, and whether it has fallen. */
const state = (r: Polity) => ask<ReignNow | null>("reign.now", { realm: r.ref, ruler: "" });
const brief = (n: ReignNow | null) =>
  !n
    ? "?"
    : n.fell?.how === "realm"
      ? "fallen"
      : `${n.people} people, ${n.lands} lands, ${Math.round(n.legitimacy * 100)}% rightful`;

try {
  // The world as the page takes it up.
  const q = `universe=${universe}&seed=${encodeURIComponent(seedAsked)}`,
    drawn = () =>
      page.waitForFunction(
        () =>
          ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
        undefined,
        { timeout: slow(180000) },
      );
  await page.goto(`${base}?${q}&hold=1`);
  await drawn();
  await page.evaluate(
    async ([data, keep]) => {
      const b = Uint8Array.from(atob(data as string), (ch) => ch.charCodeAt(0));
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
      await c.importSave(b);
      await c.save(keep as string);
    },
    [bytes.toString("base64"), `${universe}:gate116`],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(`${universe}:gate116`)}&hold=1`);
  await drawn();
  await k("globalThis.causalis.client.setSpeed(0)");
  const realm = pick.r.ref;

  // 1. One of the court taken, by touch, from the realm's Court tab.
  await k(`globalThis.causalis.open(${JSON.stringify(`${realm}#court`)})`);
  const role = `.leader-card[data-ref="court:${realm}:${pick.fig}"] .leader-role`;
  await until("the Court tab's Act as them", () => seen(role), slow(60000));
  await settle(300);
  await shot("1-court");
  await tap(role);
  await until(
    "the bar of one of the court",
    async () => (await seen(".reign-strip")) && !!(await reign())?.role,
    slow(120000),
  );
  await settle(1500);
  const r0 = (await reign())!;
  say(`as ${r0.role?.name}, ${r0.role?.title}: ${r0.role?.words}`);
  check(r0.role?.name === pick.name, "the bar names someone else");
  check(
    await k<boolean>(`document.querySelector(".reign-hud").classList.contains("as-role")`),
    "the bar does not say it holds one of the court",
  );
  check(/Propose/.test(await text(`.reign-act[data-act="decrees"]`)), "the tray decrees for them");
  check(!(await seen(`.reign-act[data-act="matches"]`)), "the tray marries for them");
  check(/mortal/.test(await text(".reign-channel")), "the switch does not start as a mortal");
  check(await fits(), "the bar is wider than the screen");
  await shot("2-role");
  // (Nothing done: a year on, the world is the world without them.)
  await tap(".reign-pace");
  if ((await clock()) < hashAt) await advanceTo(hashAt);
  const same = JSON.stringify(await ask("hashes")) === hashes;
  check(same, "one of the court who did nothing changed the world");
  say(`a year as them doing nothing: ${same ? "the same hashes" : "DIFFERENT"}`);

  // 2. A law step refused them as a mortal, carried with the god in them.
  const opt = `.reign-opt[data-law="${pick.law}"][data-to="${pick.to}"]`;
  await tap(`.reign-act[data-act="decrees"]`);
  await until("the proposals", () => seen(opt));
  check(
    (await k<string>(`document.querySelector(${JSON.stringify(opt)}).dataset.can`)) === "0",
    "the step is offered them as a mortal",
  );
  await tap(opt);
  await until("the refusal in words", async () => (await text(".reign-said")).length > 0);
  const refusal = await text(".reign-said");
  say(`as a mortal: ${refusal}`);
  check(
    /rules alone|voices|weigh/.test(refusal),
    `refused for something other than their station: ${refusal}`,
  );
  await shot("3-refused");
  await tap(".reign-channel");
  await until("the god in them", async () => /god in them/.test(await text(".reign-channel")));
  check(
    await k<boolean>(`document.querySelector(".reign-strip").classList.contains("channelled")`),
    "the bar does not glow with the god in them",
  );
  check(
    /lift|past the voices|carries past/.test(await text(".reign-told")),
    "the bar does not say what the god lifts",
  );
  await until(
    "the step offered with the god in them",
    async () =>
      (await k<string>(`document.querySelector(${JSON.stringify(opt)})?.dataset.can ?? ""`)) ===
      "1",
    slow(20000),
  );
  check(
    /god is in them/.test(await text(".reign-sheet .life-winwords")),
    "the sheet does not say the god is in them",
  );
  await shot("4-channelled");
  const lawsBefore = await ask<ReignDecrees>("reign.decrees", { realm });
  await tap(opt);
  await until("the proposal carried", async () => !(await seen(".reign-sheet")));
  await settle(600);
  const after = await ask<ReignDecrees>("reign.decrees", { realm }),
    nowWas = lawsBefore.laws.find((l) => l.law === pick!.law)?.now,
    nowIs = after.laws.find((l) => l.law === pick!.law)?.now;
  say(
    `with the god in them: ${pick.law} from "${nowWas}" to "${nowIs}"; the bar says: ${await text(".reign-told")}`,
  );
  check(nowWas !== nowIs, "the law did not change with the god in them");
  const deeds = await ask<{ type: string; by: string }[]>("reign.deeds", { realm });
  check(
    deeds.some((d) => d.type === "order.changed" || d.by === pick!.name),
    "history does not say whose word it was",
  );
  await until("the omen told", async () =>
    ((await reign())?.told ?? []).some((t) => /omen/i.test(t.words)),
  );
  say(
    `told: ${((await reign())?.told ?? []).find((t) => /omen/i.test(t.words))?.words ?? "(no omen)"}`,
  );
  await shot("5-carried");
  await tap(".reign-channel");
  await until("a mortal again", async () => /mortal/.test(await text(".reign-channel")));

  // 3. A group courted, as a mortal.
  await tap(`.reign-act[data-act="factions"]`);
  const back = `.reign-back[data-group="${pick.group}"]`;
  await until("the factions", () => seen(back));
  await settle(200);
  await shot("6-factions");
  await tap(back);
  await until("a group behind them", async () => !(await seen(".reign-sheet")));
  await settle(400);
  const court = await ask<{ groups: { group: string; behind: boolean }[] }>("reign.court", {
    realm,
    fig: pick.fig,
  });
  check(
    !!court.groups.find((g) => g.group === pick!.group)?.behind,
    `${pick.group} do not stand behind them`,
  );
  say(`as a mortal: ${pick.group} courted; the bar says: ${await text(".reign-told")}`);
  await tap(".reign-letgo");
  await until("let go", async () => !(await seen(".reign-strip")));

  // 4. A blessing and a curse at the greatest strength for 5 years, by touch.
  await k(`globalThis.causalis.closePage?.()`);
  for (let i = 0; i < 6 && (await k<string>("globalThis.causalis.scale()")) !== "globe"; i++) {
    await k(`globalThis.causalis.zoomThrough("out")`).catch(() => undefined);
    await settle(2500);
  }
  check((await k<string>("globalThis.causalis.scale()")) === "globe", "not back on the globe");
  const people = await ask<{ cell: number; centre: number; people: number }[]>("people.map");
  const cast = async (act: "bless" | "curse", r: Polity) => {
    if (!(await seen(".palette.open"))) await tap(".palette-toggle");
    await tap(`.palette-tab[data-kind="realms"]`);
    await tap(`.palette-act[data-act="${act}"]`);
    await until(
      `${act} in hand`,
      async () => (await k<string | null>("globalThis.causalis.palette.holding()")) === act,
    );
    // (The strength slider pressed at its far end: the greatest.)
    await tap(".palette-strength input", (c) => ({ x: c.x + c.w / 2 - 6, y: c.y }));
    await until("the greatest strength", async () =>
      /greatest/.test(await text(".palette-strength")),
    );
    await tap(`.palette-years .speed[data-years="5"]`);
    const land = people
      .filter((p) => r.members.includes(p.cell))
      .sort((a, b) => b.people - a.people)[0]!;
    // (Turned to it, then tilted until it stands clear of the god's hand open over the lower screen, as a player tilts it.)
    const clearAt = async (): Promise<{ x: number; y: number } | null> => {
      let at: { x: number; y: number } | null = null;
      for (const end = Date.now() + slow(6000); Date.now() < end;) {
        await k("globalThis.causalis.rig.idle = 0");
        await page.waitForTimeout(300);
        const now = await k<{ x: number; y: number } | null>(
          `globalThis.causalis.spotOnScreen(${land.centre})`,
        );
        const still = !!now && !!at && Math.hypot(now.x - at.x, now.y - at.y) < 1.5;
        at = now;
        if (still) break;
      }
      if (!at) return null;
      const free = await k<boolean>(
        `(() => { const e = document.elementFromPoint(${at.x}, ${at.y}); return !!e && e.tagName === "CANVAS"; })()`,
      );
      return free ? at : null;
    };
    let at: { x: number; y: number } | null = null;
    for (const tilt of [0, 14, -14, 24, -24, 34, -34]) {
      await k(`globalThis.causalis.faceSpot(${land.centre}, 2.2)`);
      await k(`globalThis.causalis.rig.pitch += ${tilt}`);
      if ((at = await clearAt())) break;
    }
    if (!at) {
      problems.push(
        `${r.town}'s land is not on the screen clear of the HUD (at ${await k<string>("globalThis.causalis.scale()")})`,
      );
      return;
    }
    await page.touchscreen.tap(at.x, at.y);
    await until(`${act} cast`, async () => /Done/.test(await text(".palette-words")), slow(20000));
    say(`${act}: ${await text(".palette-words")}`);
    check(
      /greatest strength, for 5 years/.test(await text(".palette-words")),
      `the ${act} does not say how strong and how long`,
    );
    await shot(`7-${act}`);
  };
  await cast("bless", blessed);
  await cast("curse", cursed);
  await k("globalThis.causalis.palette.putDown()");
  const fortuneOn = async (r: Polity, what: RegExp, tag: string) => {
    await k(`globalThis.causalis.open(${JSON.stringify(r.ref)})`);
    await until(`${tag}'s page`, async () => what.test(await pageText()), slow(30000));
    const t = await pageText(),
      line =
        t.match(
          /Under the god's (curse|blessing)[^]*?in a hundred holding its rule rightful\./,
        )?.[0] ??
        t.match(/The god's (curse|blessing), lifted.{0,300}/)?.[0] ??
        "";
    say(`${tag}'s page: ${line.slice(0, 400)}`);
    await settle(300);
    await shot(`8-${tag}`);
    await k(`globalThis.causalis.closePage?.()`);
    return t;
  };
  const bt = await fortuneOn(blessed, /Under the god's blessing/, "blessed"),
    ct = await fortuneOn(cursed, /Under the god's curse/, "cursed");
  check(
    /the greatest strength, for 5 years/.test(bt) && /plenty/.test(bt),
    "the blessed realm's page does not say how strong it is or what it lays",
  );
  check(
    /the greatest strength, for 5 years/.test(ct) && /blight/.test(ct) && /sickness/.test(ct),
    "the cursed realm's page does not say how strong it is or what it lays",
  );
  // Five years and more: what each became.
  const start = await clock();
  for (let y = 1; y <= 6; y++) {
    await advanceTo(start + y * YEAR);
    say(`year ${y}: cursed ${brief(await state(cursed))}; blessed ${brief(await state(blessed))}`);
  }
  const cEnd = await state(cursed),
    bEnd = await state(blessed);
  check(
    !!cEnd && (cEnd.fell?.how === "realm" || cEnd.lands * 2 <= cursed.members.length),
    `the cursed realm stands whole after five years (${cEnd?.lands} of ${cursed.members.length} lands)`,
  );
  check(
    !!bEnd && bEnd.fell?.how !== "realm" && bEnd.lands >= blessed.members.length,
    "the blessed realm fell or lost lands",
  );
  await fortuneOn(cursed, /curse, lifted|has fallen|Fell/, "cursed-after");

  // 5. The god's hand through a ruler (2026-11-13: "when i rule i should have ultimate power if god is channelled"): the
  // ruler of the court's realm taken, the god let in, and from the tray a host stood up out of nothing with the best arms
  // its world allows, an age of learning, its wealth doubled, a war begun and a peace forced; each on a page, and in the
  // annals as done by the god in them.
  const why = await k<string | null>(`globalThis.causalis.reign.take(${JSON.stringify(realm)})`);
  check(why === null, `the ruler of ${pick.r.town} could not be taken: ${why}`);
  await until("the ruler's bar", () => seen(".reign-strip"));
  await settle(1500);
  check(!(await seen('.reign-act[data-act="god"]')), "the god's hand is on the tray as a mortal");
  await tap(".reign-channel");
  await until("the god in them", async () => /god in them/.test(await text(".reign-channel")));
  const hostBefore = (await reign())?.host ?? 0,
    ruler = (await reign())?.ruler ?? "";
  const godDo = async (sel: string, tag: string) => {
    if (!(await seen(".reign-sheet .reign-god"))) await tap('.reign-act[data-act="god"]');
    await until(`the god's hand (${tag})`, () => seen(`.reign-sheet ${sel}`), slow(20000));
    await settle(300);
    check(
      (await k<string>(
        `document.querySelector(${JSON.stringify(`.reign-sheet ${sel}`)})?.dataset.can ?? ""`,
      )) === "1",
      `${tag}: the god's hand cannot: ${await text(`.reign-sheet ${sel} + .reign-optwords`)}`,
    );
    await tap(`.reign-sheet ${sel}`);
    await until(`${tag} done`, async () => !(await seen(".reign-sheet")), slow(20000));
    await settle(500);
    say(`${tag}: the bar says: ${await text(".reign-told")}`);
  };
  await godDo('.reign-god[data-what="host"][data-arms="best"][data-men="100000"]', "a host");
  await shot("9-host");
  const hostAfter = (await reign())?.host ?? 0;
  check(
    hostAfter >= hostBefore + 90000,
    `the host did not grow by the god's (${hostBefore} to ${hostAfter})`,
  );
  await godDo('.reign-god[data-what="age"]', "an age of learning");
  await godDo('.reign-god[data-what="wealth"]', "its wealth doubled");
  // (A realm to make war on and peace with: one the hand could set it against, neither blessed nor cursed.)
  const sheet0 = await ask<{ targets: { ref: string; own: boolean }[] }>("reign.godhand", {
    realm,
    channel: true,
  });
  let foe: string | null = null;
  for (const t of sheet0.targets) {
    if (t.own || t.ref === blessed.ref || t.ref === cursed.ref) continue;
    const s2 = await ask<{ groups: { offers: { args: { what: string }; can: boolean }[] }[] }>(
      "reign.godhand",
      { realm, channel: true, to: t.ref },
    );
    if (s2.groups.some((g) => g.offers.some((o) => o.args.what === "war" && o.can))) {
      foe = t.ref;
      break;
    }
  }
  check(!!foe, "no realm the god's hand could set it at war with");
  if (foe) {
    await tap('.reign-act[data-act="god"]');
    await until("the realms to aim at", () => seen(`.reign-aim[data-ref="${foe}"]`));
    await tap(`.reign-aim[data-ref="${foe}"]`);
    await until("aimed", () => seen(`.reign-aim.on[data-ref="${foe}"]`));
    await godDo('.reign-god[data-what="war"]', "a war begun");
    await godDo('.reign-god[data-what="peace"]', "a peace forced");
    await shot("10-peace");
  }
  // The god's own palette from the ruler's tray: a blessing cast on the land under the finger, then shut.
  await tap('.reign-act[data-act="god"]');
  await until("the hand's sheet", () => seen(".reign-palette"));
  await tap(".reign-palette");
  await until("the palette", () => seen(".palette.open"));
  check(
    await k<boolean>(
      `getComputedStyle(document.querySelector(".reign-tray")).visibility === "hidden"`,
    ),
    "the ruler's tray stands under the god's palette",
  );
  await tap(`.palette-tab[data-kind="realms"]`);
  await tap(`.palette-act[data-act="bless"]`);
  await until(
    "bless in hand",
    async () => (await k<string | null>("globalThis.causalis.palette.holding()")) === "bless",
  );
  const spot = await k<{ x: number; y: number } | null>(`(() => {
    for (const f of [0.3, 0.4, 0.5, 0.25, 0.6]) {
      const x = innerWidth / 2, y = innerHeight * f, e = document.elementFromPoint(x, y);
      if (e && e.tagName === "CANVAS") return { x, y };
    }
    return null;
  })()`);
  check(!!spot, "no ground to touch clear of the HUD while ruling");
  if (spot) {
    await page.touchscreen.tap(spot.x, spot.y);
    await until(
      "the blessing cast",
      async () => /Done/.test(await text(".palette-words")),
      slow(20000),
    );
    say(`the god's palette while ruling: ${await text(".palette-words")}`);
    await shot("10b-palette");
  }
  await tap("#hud > .palette-toggle");
  await until("the tray again", () =>
    k<boolean>(`getComputedStyle(document.querySelector(".reign-tray")).visibility === "visible"`),
  );

  // On the realm's page, and its seat's lore.
  await k(`globalThis.causalis.open(${JSON.stringify(realm)})`);
  await until(
    "the realm's page",
    async () => /The god's hand on it/.test(await pageText()),
    slow(30000),
  );
  const rp = await pageText(),
    told = rp.match(/The god's hand on it[^]*/)?.[0] ?? "";
  say(`${pick.r.town}'s page: ${told.slice(0, 700)}`);
  check(
    /stood up by the god/.test(told),
    "the realm's page does not tell the host the god stood up",
  );
  check(
    /stores of [^]*? were doubled/.test(told),
    "the realm's page does not tell its wealth doubled",
  );
  check(/age of learning came to/.test(told), "the realm's page does not tell the age of learning");
  check(!foe || /ended in a truce/.test(told), "the realm's page does not tell the peace forced");
  await shot("11-page");
  await k(`globalThis.causalis.closePage?.()`);
  const craft =
    told.match(/age of learning came to [^:]*: ([^,.]+?)(,| and |$)/)?.[1]?.trim() ?? "";
  await k(`globalThis.causalis.open(${JSON.stringify(`cell:0:${pick.r.seat}`)})`);
  await until("the seat's page", async () => (await pageText()).length > 0, slow(30000));
  await k(
    `[...document.querySelectorAll(".page-panel button.tab")].find((b) => /Lore/.test(b.textContent))?.click()`,
  );
  await until("the seat's lore", async () => /What they know/.test(await pageText()), slow(20000));
  const lore = await pageText();
  say(
    `the seat's lore: ${craft || "(no craft named)"} ${new RegExp(craft, "i").test(lore) ? "known" : "NOT known"}`,
  );
  check(
    !!craft && new RegExp(craft, "i").test(lore),
    `the seat's lore does not hold ${craft || "the age's crafts"}`,
  );
  await shot("12-lore");
  await k(`globalThis.causalis.closePage?.()`);
  // In the annals, each as done by the god in them.
  const year = Math.floor((await clock()) / YEAR),
    annals = await ask<{ year: number; lines: { line: (string | { text: string })[] }[] }[]>(
      "annals.read",
      { years: [year - 1, year] },
    ),
    lines = annals
      .flatMap((y) => y.lines)
      .map((l) => l.line.map((x) => (typeof x === "string" ? x : x.text)).join(""))
      .filter((l) => /By the god in/.test(l));
  for (const l of lines) say(`annals: ${l}`);
  for (const [what, re] of [
    ["the host", /men stood up at/],
    ["the age of learning", /age of learning came to/],
    ["the wealth", /were doubled/],
    ...(foe ? [["the peace", /ended in a truce/] as const] : []),
  ] as const)
    check(
      lines.some((l) => re.test(l) && l.includes(ruler)),
      `the annals do not tell ${what} by the god in ${ruler}`,
    );
  await k("globalThis.causalis.reign.leave()");
  check(await fits(), "a page is wider than the screen");
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 116 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 116 passed");
process.exit(0);
