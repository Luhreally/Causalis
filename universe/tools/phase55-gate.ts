// node tools/phase55-gate.ts [--ci] [--soft] [--shots dir] [--battle-only | --wounds-only]
// [--no-budgets] — the Phase 55 gate, on the built app, the Earth seed at the turn of year 365.
// Its battle part (M227, M228, M230; asked for 2026-10-25: "the battles should be fought on the
// land, by the townsfolk, where you can see them"; 2026-10-26: "...it should be more graphic, and
// realistic where ever they are getting damaged"), first, the clock going one way:
//   B1. a battle of year 364 laid before its land's heart town the morning of the turn: the hosts'
//       fires behind their lines before dawn; drawn up, as many figures to a side as the setting
//       draws, each a named man of the battle's roll, as many falling and wounded as battleFigures;
//       zoomed onto its mark on its land (asked for 2026-10-27: "i meant open world warfare on town
//       view not land view"), the eye goes into that town, facing it;
//   B2. the town indoors from seven but for some come out to its edge to watch; the clock slowed
//       through the night and to a minute a second for the battle, told under the bar;
//   B3. as the hosts close, on a phone's frame at four times the CPU's work, each setting's p80
//       frame: Low and Balanced within the budget playing, High and Ultra told, Auto come to rest
//       within it (not on CI: a GPU's work); the clash, men struck where the blows land, their
//       wounds drawn on them, the wounded crawling or helped back; the beaten flying;
//   B4. after it, its fallen lying where they fell (none with the blood and wounds turned off); a
//       fallen man tapped: his card, "Fell in the battle", what he bore and who made it; his page,
//       "Fell at the battle at", what he bore from the ground to his hand; his arm's page;
//   B5. the four ways to watch it, each a tap from the others, nothing of one carried to the next:
//       the town, the field close (its man named), the land — zoomed onto its mark there, the
//       battle past, down onto its field — the war over the world, the town again;
//   B6. its fallen borne in from noon two days on, none left by their funeral at two; none of the
//       town's fallen in its next plan.
// Its wave 3 part (wounds seen, M226, and healing, M229; asked for 2026-10-26: "Wounds and lost
// limbs shown on the person and told on their page. Healers tending the wounded."), in a town
// whose levy comes home wounded from the battles at the year's turn:
//   1. the levy home: the town come out by the road, kin waiting at the door, the wounded borne in
//      on a litter between two, set down at their door;
//   2. abed: the one borne home out of sight, abed at home;
//   3. the healer: seeing to the fresh wounds that evening, and the next morning's round, door to
//      door to those abed;
//   4. up and bound: one healing walks out bandaged;
//   5. marked for good: one with a crutch, a stump or a patch drawn so;
//   6. their card: tapped, their wounds told on it; their page: "Their wounds"; the healer's card
//      opening the healer's page;
//   7. the town's page: its Wounded tab; the healer's page, whom they tend;
//   8. the pages at a phone's width.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import type { BattleNear } from "../src/bridge/index.ts";

const ci = process.argv.includes("--ci"),
  soft = process.argv.includes("--soft"),
  shots = process.argv.includes("--shots")
    ? process.argv[process.argv.indexOf("--shots") + 1]
    : undefined;
const GPU = [
  "--use-angle=d3d11",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--force_high_performance_gpu",
];
const problems: string[] = [];
const say = (line: string) => console.log(`  ${line}`);
const check = (ok: boolean, problem: string) => {
  if (!ok) problems.push(problem);
};
/** How long to wait on what the frames bring: longer where they come slowly. */
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const battleOnly = process.argv.includes("--battle-only"),
  woundsOnly = process.argv.includes("--wounds-only"),
  budgets = !ci && !soft && !process.argv.includes("--no-budgets");
console.log("the Phase 55 gate");
if (shots) mkdirSync(shots, { recursive: true });

const DAY = 86400,
  HOUR = 3600,
  YEAR = 365 * DAY,
  /** The village's quality: its families and its crowd, as the app asks its plan (render/quality.ts, "high"). */
  QUALITY = { name: "high", families: 10, folk: 220 } as const;

type Wound = {
  event: string;
  from: string;
  member: string;
  outcome: string;
  lasting: string | null;
  at: number;
  home: number;
  up: number;
  mended: number;
  tended: string;
  borne: boolean;
};
type PlanPerson = {
  ref: string;
  name: string;
  home: number;
  folk?: boolean;
  trade?: unknown;
  healer?: { years: number };
  wounds?: Wound[];
  away?: { event: string; from: number; until: number }[];
};
type Plan = { ref: string; name: string; people: PlanPerson[] };
type Row = {
  ref: string;
  name: string;
  population: number;
  healer: boolean;
  hospital: boolean;
  wounded: number;
  borne: number;
  maimed: number;
  at: number;
};
type Person = {
  name: string;
  x: number;
  z: number;
  activity: number;
  task: string | null;
  index: number;
  ref: string;
  folk: boolean;
  carry: string | null;
  why: string | null;
};
type Shown = {
  looks: number;
  drawn: {
    bandage: number;
    patch: number;
    sling: number;
    crutch: number;
    scar: number;
    stumps: number;
  };
  abed: number[];
  away: number;
  gone: number;
  homes: { index: number; x: number; z: number }[];
  healing: { index: number; ref: string; up: number; mended: number }[];
  lasting: { index: number; ref: string; marks: string[] }[];
  homecomings: {
    event: string;
    at: number;
    where: string;
    people: number;
    wounded: number;
    borne: number;
  }[];
  litters: { index: number; start: number; arrive: number; bearers: number[] }[];
  littersNow: { x: number; z: number; borne: boolean; index: number }[];
  edge: { x: number; z: number };
};
type Leg = { from: number; to: number; why: string | null; task: string | null };

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4313, strictPort: false },
    ...(process.env.CAUSALIS_DIST ? { build: { outDir: process.env.CAUSALIS_DIST } } : {}),
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const ask = <T>(type: string, args: unknown) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const fail = async () => {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
};
const people = () => k<Person[]>(`globalThis.causalis.peopleNow?.() ?? []`);
const shown = () => k<Shown | null>(`globalThis.causalis.wounds?.() ?? null`);
const legs = (i: number) => k<Leg[]>(`globalThis.causalis.legs?.(${i}) ?? []`);
const now = () => k<number>(`globalThis.causalis.client.status?.t ?? 0`);
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(30000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(600));
};
/** The eye over a point of the town (metres), so far off (the rig's units: ten metres each). */
const face = async (x: number, z: number, distance = 4) => {
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`);
  await page.waitForTimeout(slow(1200));
};
const near = (p: { x: number; z: number }, q: { x: number; z: number }, r: number) =>
  Math.hypot(p.x - q.x, p.z - q.z) < r;
const title = () =>
  page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
/** A page opened in the page window, by ref: its title come. */
const opened = async (ref: string) => {
  const before = await title();
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await page
    .waitForFunction(
      (was) => {
        const t = document.querySelector(".page-window .page-title")?.textContent;
        return !!t && t !== "…" && t !== was;
      },
      before,
      { timeout: slow(30000) },
    )
    .catch(() => undefined);
  await page.waitForTimeout(slow(500));
  return title();
};
/** A list on the page window by the start of its title: its rows' words. */
const listOn = (start: string) =>
  k<string[] | null>(`(() => {
    const box = [...document.querySelectorAll(".page-window .block-list")].find((b) => b.querySelector("h3")?.textContent?.startsWith(${JSON.stringify(start)}));
    return box ? [...box.querySelectorAll(".entry")].map((e) => e.textContent ?? "") : null;
  })()`);
/** A fact of the page window by its label: its words. */
const factOn = (label: string) =>
  k<string | null>(`(() => {
    const row = [...document.querySelectorAll(".page-window .fact")].find((r) => r.querySelector(".fact-label")?.textContent === ${JSON.stringify(label)});
    return row ? (row.querySelector(".fact-value")?.textContent ?? "") : null;
  })()`);
/** At a phone's width: how far the page window's blocks run over. */
const onPhone = async (name: string) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(slow(800));
  const over = await k<number>(
    `Math.max(0, ...[...document.querySelectorAll(".page-window .block")].map((b) => b.scrollWidth - b.clientWidth))`,
  );
  await shot(name);
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.waitForTimeout(slow(500));
  return over;
};
/** The village's card (the page window is an inspector too). */
const CARD = ".inspector:not(.page-window)";
/** The page window put away, where it is open. */
const putAway = async () => {
  const close = page.locator(".page-window button.close:visible");
  if (await close.count()) await close.first().click();
  await page.waitForTimeout(slow(300));
};
/** One drawn tapped, the eye brought down to them first (the page window put away): whether their card came. */
const tap = async (i: number) => {
  const p = (await people()).find((q) => q.index === i);
  if (!p) return false;
  await putAway();
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${p.x * 0.1}, y: 0, z: ${p.z * 0.1} }, distance: 3.5, pitch: -40 })`,
  );
  await page.waitForTimeout(slow(2500));
  const at = await k<{ x: number; y: number } | null>(
    `globalThis.causalis.personOnScreen?.(${i}) ?? null`,
  );
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(slow(1200));
  return (await page.locator(`${CARD} h2:visible`, { hasText: p.name }).count()) > 0;
};
const ofDay = (t: number) => Math.floor(t / DAY);

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=365&hold=1`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("${QUALITY.name}")`);
await k(`globalThis.causalis.client.setSpeed(0)`);

// —— The battle part (M227, M228, M230) ——————————————————————————————————————————————
type Placed = {
  event: string;
  turn: number;
  title: string;
  stage: string | null;
  s: number;
  per: number;
  figures: number[];
  named: number;
  falls: number[];
  hurt: number[];
  rule: { n: number; falls: number; hurt: number; stood: number }[];
  roll: { fell: number; hurt: number; stood: number }[];
  drawn: number;
  lying: number;
  onScreen: {
    id: number;
    side: number;
    act: string;
    crawl: boolean;
    hit: string | null;
    lost: string | null;
    fate: string;
    name: string | null;
    ref: string | null;
    at: { x: number; y: number } | null;
  }[];
  marks: { wounds: number; ends: number; shafts: number; drops: number };
  parts: number;
  shadows: boolean;
  watchers: number;
  sheltered: number;
  camp: number;
  clock: { speed: number; pace: number; stopped: boolean };
  slowed: string | null;
  told: string;
};
/** The most figures a side is drawn as at each setting (view/placed.ts PLACED_MOST). */
const PLACED_MOST = { low: 60, balanced: 120, high: 240, ultra: 360 } as const;
const placedNow = () => k<Placed | null>(`globalThis.causalis.placedBattle?.() ?? null`),
  scaleNow = () => k<string>(`globalThis.causalis.scale()`),
  views = () => k<{ at: string | null; open: string[] }>(`globalThis.causalis.warViews()`),
  view = (v: string) => k<string>(`globalThis.causalis.warView(${JSON.stringify(v)})`),
  /** Whether it comes within the time (not a problem if not). */
  comes = async (ok: () => Promise<boolean>, ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await ok().catch(() => false)) return true;
      await page.waitForTimeout(250);
    }
    return false;
  },
  /** The world's clock at a moment of the turn's days (hours from its midnight), the battle's town drawn there. */
  atTurn = (turn: number, hours: number) => advance(turn * YEAR + hours * HOUR),
  // (A speed by what its button says: "1 month/s"; the pause, "❚❚".)
  press = (label: RegExp) =>
    k<boolean>(
      `(() => { const b = [...document.querySelectorAll(".panel:not([hidden]) .timebar .speeds button")].find((x) => ${label}.test((x.textContent ?? "") + " " + (x.getAttribute("aria-label") ?? ""))); b?.click(); return !!b; })()`,
    ),
  /** The gaps between the next `n` frames (ms). */
  frameGaps = (n: number) =>
    k<number[]>(`new Promise((done) => {
      const gaps = []; let last = performance.now();
      const tick = () => { const t = performance.now(); gaps.push(t - last); last = t;
        if (gaps.length < ${n}) requestAnimationFrame(tick); else done(gaps); };
      requestAnimationFrame(tick);
    })`),
  /**
   * Zoomed onto a battle's mark on its land, as a player does, the pointer kept on it as the eye
   * closes in (wheeled only while it is on the screen): the scale come to.
   */
  zoomOnto = async (event: string) => {
    const end = Date.now() + slow(60000);
    while (Date.now() < end && (await scaleNow()) === "region") {
      const at = (
        await k<{ ref: string; x: number; y: number }[]>(`globalThis.causalis.battlesOnScreen()`)
      ).find((m) => m.ref === event);
      if (!at) {
        await page.waitForTimeout(250);
        continue;
      }
      await page.mouse.move(at.x, at.y);
      await page.mouse.wheel(0, -240);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(slow(1500));
    return scaleNow();
  },
  townNow = (event: string) =>
    k<string | null>(`globalThis.causalis.battleTownNow(${JSON.stringify(event)})`);
if (!woundsOnly) {
  const turn = Math.floor((await now()) / YEAR),
    map = await ask<{
      wars: {
        ref: string;
        battles: { event: string; year: number; spot: number; fallen: number }[];
      }[];
    }>("wars.map", {}),
    fought = map.wars
      .flatMap((w) => w.battles.filter((b) => b.year === turn - 1 && b.spot >= 0))
      .sort((a, b) => b.fallen - a.fallen || (a.event < b.event ? -1 : 1));
  say(`${fought.length} battles of year ${turn - 1}, fought at the turn of year ${turn}`);
  check(fought.length > 0, `no battle of year ${turn - 1}`);

  // B1. Laid before its land's heart the morning of the turn: the hosts' fires before dawn.
  await atTurn(turn, 5);
  let found: { event: string; town: string } | null = null;
  for (const b of fought.slice(0, 8)) {
    const cell = await k<number>(
        `globalThis.causalis.client.latestFrame("globe").arrays.province[${b.spot}] ?? -1`,
      ),
      heart = cell >= 0 ? await ask<string | null>("land.heart", { cell }) : null;
    if (!heart) continue;
    await k(`globalThis.causalis.goTo(${JSON.stringify(heart)})`);
    if (!(await comes(async () => (await scaleNow()) === "village", slow(60000)))) continue;
    if (await comes(async () => (await placedNow())?.event === b.event, slow(20000))) {
      found = { event: b.event, town: heart };
      break;
    }
    say(`${b.event} not laid before ${heart}; the next`);
  }
  check(!!found, "no battle laid before its land's heart the morning of the turn");
  if (!found) await fail();
  const { event, town: heart } = found!;
  const battle = await ask<BattleNear>("battle.near", { event }),
    rout = battle.combat ? battle.combat.rout : 108;
  let p = (await placedNow())!;
  say(
    `${p.title} (${event}), before ${heart}: ${p.stage} at ${(((await now()) % DAY) / HOUR) | 0} h; ${p.figures.join(" and ")} figures, ${p.per} men each; ${p.named} named`,
  );
  check(p.stage === "morning", `not drawn up the morning of the turn (${p.stage})`);
  check(p.camp >= 4, `the hosts' fires before dawn not drawn (${p.camp})`);
  await k(`globalThis.causalis.faceBattle()`);
  await page.waitForTimeout(slow(1500));
  await shot("b1-fires-before-dawn");
  // As many figures to a side as the setting draws; every one a man of the roll; the one rule.
  check(
    Math.max(...p.figures) <= PLACED_MOST.high && Math.max(...p.figures) >= 2,
    `${p.figures.join("/")} figures to a side at high (most ${PLACED_MOST.high})`,
  );
  const all = p.figures[0]! + p.figures[1]!;
  check(p.named >= 0.95 * all, `${p.named} of ${all} figures named`);
  for (const s of [0, 1]) {
    check(
      p.falls[s] === p.rule[s]!.falls,
      `side ${s}: ${p.falls[s]} fall, battleFigures ${p.rule[s]!.falls}`,
    );
    check(
      p.hurt[s] === p.rule[s]!.hurt,
      `side ${s}: ${p.hurt[s]} wounded, battleFigures ${p.rule[s]!.hurt}`,
    );
    check(
      p.roll[s]!.fell === p.rule[s]!.falls && p.roll[s]!.hurt === p.rule[s]!.hurt,
      `side ${s}: the roll's lots ${JSON.stringify(p.roll[s])} not the figures' ${JSON.stringify(p.rule[s])}`,
    );
  }
  // The way into it while it is fought: zoomed onto its mark on its land, into its town, facing it.
  check((await townNow(event)) === heart, `not gone into before ${heart} while it is fought`);
  const dawnLand = await view("land");
  await comes(async () => (await views()).at === "land", slow(15000));
  check(dawnLand === "region", `its land not come to before dawn (${dawnLand})`);
  const zoomedIn = await zoomOnto(event);
  await comes(async () => (await placedNow())?.event === event, slow(30000));
  await page.waitForTimeout(slow(2000));
  const faced = (await placedNow())?.onScreen.filter((t) => t.at).length ?? 0;
  say(
    `zoomed onto its mark before dawn: ${zoomedIn}, ${(await views()).at}; ${faced} of it on the screen`,
  );
  check(
    zoomedIn === "village" && (await views()).at === "town",
    `zoomed onto its mark before dawn: ${zoomedIn}, not its town`,
  );
  check(!(await k<unknown>(`globalThis.causalis.battle()`)), "zoomed onto it, down onto its field");
  check(faced >= 10, `the eye not on the fight in its town (${faced} of it on the screen)`);
  await shot("b1-zoomed-into-its-town");

  // B2. Indoors from seven, but for some come out to watch; the clock slowed for it.
  await atTurn(turn, 7.6);
  p = (await placedNow())!;
  say(`at 7:36: ${p.sheltered} indoors, ${p.watchers} come out to watch; ${p.drawn} drawn up`);
  check(p.sheltered > 0, "the town not indoors for the battle before it");
  check(p.watchers > 0 && p.watchers <= 24, `${p.watchers} watching at the town's edge`);
  check(p.drawn === all, `${p.drawn} of ${all} drawn up`);
  await k(`globalThis.causalis.faceBattle()`);
  await page.waitForTimeout(slow(1500));
  await shot("b2-drawn-up");
  check(await press(/^1 month/i), "no month-a-second speed in the town's bar");
  const slowed = await comes(async () => (await placedNow())?.clock.speed === 60, slow(30000));
  p = (await placedNow())!;
  say(`slowed: ${slowed} — "${p.told}"`);
  check(slowed, `the clock not slowed to a minute a second for the battle (${p.clock.speed})`);
  check(
    /a minute a second for the battle at the turn of year \d+/i.test(p.told),
    `the battle's slowing not told (${p.told})`,
  );
  check(await press(/^❚❚/), "no pause in the town's bar");

  // B3. On a phone's frame (430 × 932 at three pixels to a point), the CPU at four times its work,
  // as the hosts close: each setting's p80 frame, the battle laid again as many to a side as it
  // draws — Low and Balanced playing at a minute a second within the budget; High and Ultra told
  // (past it a phone's Auto steps down, render/quality.ts), and Auto seen to settle within it.
  await atTurn(turn, 8 + 40 / 60);
  if (budgets) {
    // (The frame a phone's: set again before each look, since a picture taken the page's way
    // puts the page's own frame back; its pictures taken as the phone's frame stands.)
    const cdp = await page.context().newCDPSession(page),
      phone = async () => {
        await cdp.send("Emulation.setDeviceMetricsOverride", {
          width: 430,
          height: 932,
          deviceScaleFactor: 3,
          mobile: true,
        });
        await page.waitForTimeout(1200);
      },
      phoneShot = async (name: string) => {
        if (!shots) return;
        const { data } = (await cdp.send("Page.captureScreenshot", { format: "png" })) as {
          data: string;
        };
        writeFileSync(join(shots, `${name}.png`), Buffer.from(data, "base64"));
      };
    /**
     * The p80 of the next frames at four times the CPU's work (the battle playing, or held). Where it
     * is held to the budget, a window over it is measured again a few seconds on, three at most, and
     * the least taken: other work on the machine spoils a window (it can only make one slower).
     */
    let windows = 1;
    const p80At = async (playing: boolean, budgeted = playing) => {
      let least = Infinity;
      for (windows = 0; windows < (budgeted ? 3 : 1) && least > 22; windows++) {
        if (windows) await page.waitForTimeout(3000);
        if (playing) check(await press(/^1 min/i), "no minute-a-second speed in the town's bar");
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.waitForTimeout(1000);
        const gaps = (await frameGaps(150)).sort((a, b) => a - b);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        if (playing) await press(/^❚❚/);
        least = Math.min(least, Math.round(gaps[Math.floor(gaps.length * 0.8)]!));
      }
      return least;
    };
    const ofWindows = () => (windows > 1 ? ` (the least of ${windows} windows)` : "");
    await phone();
    const frame = await k<string>(`\`\${innerWidth}×\${innerHeight} at \${devicePixelRatio}\``);
    check(frame === "430×932 at 3", `not a phone's frame (${frame})`);
    for (const setting of ["low", "balanced", "high", "ultra"] as const) {
      await k(`globalThis.causalis.setQuality("${setting}")`);
      await comes(async () => {
        const q = await placedNow();
        return !!q && Math.max(...q.figures) <= PLACED_MOST[setting] && q.drawn > 0;
      }, slow(20000));
      await k(`globalThis.causalis.faceBattle()`);
      await page.waitForTimeout(1500);
      const budgeted = setting === "low" || setting === "balanced",
        p80 = await p80At(budgeted),
        q = await placedNow();
      say(
        `${setting.padEnd(9)} on a phone's frame (${frame}), CPU ×4${budgeted ? ", playing" : ", held"}: p80 frame ${p80} ms${ofWindows()}; ${q?.figures.join("/")} figures, ${q?.parts} parts, shadows ${q?.shadows}`,
      );
      check(!!q, `${setting}: the battle not laid again`);
      check(q?.shadows === (setting === "ultra"), `${setting}: shadows ${q?.shadows}`);
      if (budgeted)
        check(
          p80 <= 22,
          `${setting}: the battle before the town's p80 frame is ${p80} ms at CPU ×4`,
        );
      await phoneShot(`b3-phone-${setting}`);
    }
    // Auto, from the finest, at four times the CPU's work: where it comes to rest, measured there
    // (its windows go on under the measure: had it stepped meanwhile, settled and measured again).
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await k(`globalThis.causalis.setQuality("auto")`);
    /** Auto at four times the CPU's work until its setting holds ten seconds (a minute at most). */
    const settle = async () => {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      let at = await k<string>(`globalThis.causalis.quality()`),
        since = Date.now();
      const by = Date.now() + 60000;
      while (Date.now() < by && Date.now() - since < 10000) {
        await page.waitForTimeout(500);
        const q = await k<string>(`globalThis.causalis.quality()`);
        if (q !== at) {
          at = q;
          since = Date.now();
        }
      }
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      return at;
    };
    let rest = await settle(),
      settled = 0,
      sq: Placed | null = null;
    for (let tries = 1; ; tries++) {
      await comes(async () => !!(await placedNow()), slow(20000));
      settled = await p80At(false, true);
      sq = await placedNow();
      const at = await k<string>(`globalThis.causalis.quality()`);
      if (at === rest || tries === 3) {
        rest = at;
        break;
      }
      say(`auto      stepped from ${rest} to ${at} as it was measured: settled again`);
      rest = await settle();
    }
    say(
      `auto      on a phone's frame, CPU ×4: comes to rest at ${rest}, p80 frame ${settled} ms${ofWindows()}; ${sq?.figures.join("/")} figures`,
    );
    // (Where it rests is told: under other work on the machine its windows at Balanced go past the
    // budget now and then and it steps to Low, as a phone's would under load; its budget is the check.)
    check(settled <= 22, `at ${rest}, Auto's rest, the p80 frame is ${settled} ms at CPU ×4`);
    await phoneShot("b3-phone-auto");
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await page.setViewportSize({ width: 1366, height: 800 });
    await k(`globalThis.causalis.setQuality("${QUALITY.name}")`);
    await comes(async () => {
      const q = await placedNow();
      return !!q && Math.max(...q.figures) > PLACED_MOST.balanced;
    }, slow(20000));
    await page.waitForTimeout(1500);
  }

  // (The clash: struck where the blows land; the wounded crawling or helped back; the beaten flying.)
  await atTurn(turn, 9);
  await k(`globalThis.causalis.faceBattle()`);
  await page.waitForTimeout(slow(2000));
  p = (await placedNow())!;
  const seen = (q: Placed) => q.onScreen.filter((t) => t.at),
    fighting = seen(p).filter((t) => t.act === "fight").length;
  say(`the clash at ${p.s.toFixed(0)} s: ${seen(p).length} on the screen, ${fighting} fighting`);
  check(p.stage === "battle", `not fought at nine (${p.stage})`);
  check(fighting >= 10, `${fighting} seen fighting at the clash`);
  check(
    seen(p).every((t) => t.name !== null),
    "a figure on the screen not named",
  );
  await shot("b3-clash");
  await atTurn(turn, 8 + 85 / 60);
  p = (await placedNow())!;
  const struck = p.onScreen.filter((t) => t.hit),
    crawling = struck.filter((t) => t.crawl || t.act === "crawl" || t.act === "helped").length;
  say(
    `struck at ${p.s.toFixed(0)} s: ${struck.length} (${crawling} crawling or helped), drawn ${JSON.stringify(p.marks)}`,
  );
  check(p.marks.wounds > 0, "no wounds drawn on the struck");
  await shot("b4-struck");
  await atTurn(turn, 8 + (rout === null ? 144 : Math.min(148, rout + 8)) / 60);
  p = (await placedNow())!;
  const flying = p.onScreen.filter((t) => t.act === "flee").length;
  say(`the ${rout === null ? "disengagement" : "rout"} at ${p.s.toFixed(0)} s: ${flying} flying`);
  check(
    rout === null ? flying === 0 : flying > 0,
    rout === null ? "an unbroken host seen flying" : "none of the beaten seen flying",
  );
  await shot("b6-rout");

  // B4. After it: its fallen lying where they fell; a fallen man's card, his page, his arm's.
  await atTurn(turn, 12);
  p = (await placedNow())!;
  const fell = p.falls[0]! + p.falls[1]!;
  say(`after: ${p.stage}; ${p.lying} lying of ${fell} fallen, ${p.drawn} drawn`);
  check(p.stage === "after", `not over by noon (${p.stage})`);
  check(
    p.lying === fell && p.drawn === fell,
    `${p.lying} lying, ${p.drawn} drawn, of ${fell} fallen`,
  );
  await k(`globalThis.causalis.faceBattle()`);
  await page.waitForTimeout(slow(1500));
  await shot("b7-fallen");
  await k(`globalThis.causalis.setGore("none")`);
  await page.waitForTimeout(slow(800));
  const bare = (await placedNow())!.marks;
  check(
    bare.wounds === 0 && bare.shafts === 0,
    `wounds drawn with the blood and wounds off (${JSON.stringify(bare)})`,
  );
  await k(`globalThis.causalis.setGore("full")`);
  await page.waitForTimeout(slow(800));
  const man = p.onScreen.find((t) => t.fate === "fell" && t.ref && t.name);
  check(!!man, "no fallen man named on the screen");
  if (man) {
    const card = (await k<string | null>(`globalThis.causalis.tapPlaced(${man.id})`)) ?? "";
    say(`his card: “${card.replace(/\s+/g, " ").slice(0, 160)}”`);
    check(card.includes(man.name!), "his card not his");
    check(/Fell in the battle/.test(card), "his card does not tell his fall");
    check(/Bore an? /.test(card), "his card does not tell what he bore");
    await shot("b8-his-card");
    const his = await opened(man.ref!),
      fate = (await factOn("Fate")) ?? "",
      bore = (await listOn("What he bore")) ?? [];
    say(`his page “${his}”: ${fate}; what he bore: ${bore.length} lines`);
    check(/^Fell at the battle at /.test(fate), `his page does not tell where he fell (${fate})`);
    check(bore.length >= 2, "his page does not trace what he bore from the ground");
    await shot("b9-his-page");
    const arm = await opened(`arms:${event}:${man.side}:${man.ref}`),
      chain = (await listOn("From the ground to his hand")) ?? [];
    say(`his arm's page “${arm}”: ${chain.length} lines`);
    check(arm.startsWith(`${man.name}'s `), `his arm's page titled “${arm}”`);
    check(chain.length >= 1, "his arm's page traces nothing");
    await putAway();
  }

  // B5. The four ways to watch it, a tap apart, none carrying what another held.
  let v = await views();
  say(`the views from the town: ${v.at}; open ${v.open.join(", ")}`);
  check(v.at === "town" && v.open.length === 4, `the views from the town: ${JSON.stringify(v)}`);
  const field = await view("field"),
    close = await k<{ event: string; rolled: number; named: { name: string } | null } | null>(
      `globalThis.causalis.battle()`,
    );
  check(
    field === "battle" && close?.event === event,
    `the field close not of the battle (${field}, ${close?.event})`,
  );
  check((close?.rolled ?? 0) > 0, "the field close names none of its figures");
  await k(`globalThis.causalis.followFighter(0)`);
  const followed = await comes(
    async () => !!(await k<{ named: unknown } | null>(`globalThis.causalis.battle()`))?.named,
    slow(8000),
  );
  check(followed, "the one followed on the field close not named");
  await shot("b10-field-close");
  check((await views()).at === "field", "the views not lit at the field");
  const land = await view("land");
  await comes(async () => (await views()).at === "land", slow(15000));
  check(land === "region", `the land not come to (${land})`);
  check(!(await k<unknown>(`globalThis.causalis.battle()`)), "the field close carried to the land");
  await shot("b11-land");
  // (The battle past: zoomed onto its mark, down onto its field, as before.)
  check((await townNow(event)) === null, "the battle past still gone into before its town");
  const past = await zoomOnto(event);
  await comes(async () => !!(await k<unknown>(`globalThis.causalis.battle()`)), slow(30000));
  const onField = await k<{ event: string } | null>(`globalThis.causalis.battle()`);
  say(`zoomed onto its mark at noon: ${past}, its field ${onField?.event ?? "not come to"}`);
  check(
    past === "battle" && onField?.event === event,
    `zoomed onto the battle past: ${past}, ${onField?.event}`,
  );
  const globe = await view("globe");
  await comes(async () => (await views()).at === "globe", slow(15000));
  check(
    globe === "globe" && !!(await k<unknown>(`globalThis.causalis.war()`)),
    `the war not watched over the world (${globe})`,
  );
  await shot("b12-war");
  const back = await view("town");
  await comes(async () => (await placedNow())?.event === event, slow(30000));
  v = await views();
  say(`and the town again: ${back}; ${v.at}`);
  check(back === "village" && v.at === "town", `the town not come back to (${back}, ${v.at})`);
  check(
    !(await k<unknown>(`globalThis.causalis.war()`)),
    "the war over the world carried to the town",
  );

  // B6. Borne in from noon two days on; none left by their funeral at two; none of the town's fallen in its next plan.
  await atTurn(turn, 2 * 24 + 12.75);
  p = (await placedNow())!;
  say(`borne in: ${p.stage}; ${p.lying} of ${fell} still lying`);
  check(
    p.stage === "borne" && p.lying > 0 && p.lying < fell,
    `${p.lying} of ${fell} lying as they are borne in`,
  );
  await k(`globalThis.causalis.faceBattle()`);
  await page.waitForTimeout(slow(1500));
  await shot("b13-borne");
  await atTurn(turn, 2 * 24 + 14.25);
  const gone = await placedNow();
  check(!gone || gone.lying === 0, `${gone?.lying} fallen still lying after their funeral`);
  const after = await ask<
      Plan & { rest?: { war?: { event: string; at: number; dead: number }[] } }
    >("village.plan", { ref: heart, families: QUALITY.families, folk: QUALITY.folk }),
    rolled = await ask<{
      attacker: { fell: { ref: string }[] };
      defender: { fell: { ref: string }[] };
    }>("battle.roll", { event, most: PLACED_MOST.high }),
    ours = [...rolled.attacker.fell, ...rolled.defender.fell]
      .map((e) => e.ref)
      .filter((r) => r.startsWith(`folk:${heart}:`)),
    still = after.people.filter((q) => ours.includes(q.ref)),
    rest = after.rest?.war?.find((w) => w.event === event);
  say(
    `the town's own fallen: ${ours.length} named, ${still.length} in its next plan; their funeral ${rest ? `at ${((rest.at % DAY) / HOUR) | 0} h, ${rest.dead} buried` : "elsewhere"}`,
  );
  check(
    still.length === 0,
    `${still.map((q) => q.name).join(", ")} fell, and are in the town's plan`,
  );
  if (rest)
    check(
      Math.abs(rest.at - (turn * YEAR + 2 * DAY + 14 * HOUR)) < HOUR,
      "the fallen not buried as they are borne in",
    );
  if (battleOnly) {
    await browser.close();
    await server.close();
    if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
    if (problems.length) await fail();
    console.log("the Phase 55 gate (battle part) passes");
    process.exit(0);
  }
  await k(`globalThis.causalis.client.setSpeed(0)`);
}

// —— Wave 3's part (M226, M229) ———————————————————————————————————————————————————————
const t0 = await now();
say(`the world at year ${Math.floor(t0 / YEAR)}, day ${ofDay(t0 % YEAR)}`);

// The town: of those whose levy comes home wounded, the first whose plan as drawn has one borne
// home on a litter and its healer, and no hospital (so the healer goes the round); one with an old
// wound marking them for good, where there is such a town.
const rows = await ask<Row[]>("village.wounded", { most: 40 });
say(`${rows.length} towns whose levy comes home wounded this year`);
check(rows.length > 0, "no town's levy comes home wounded at the turn of year 365");
let town: { row: Row; plan: Plan; borne: number; healer: number; marked: number } | null = null;
for (const row of rows.filter((r) => r.healer && !r.hospital && r.borne > 0).slice(0, 12)) {
  const plan = await ask<Plan>("village.plan", {
      ref: row.ref,
      families: QUALITY.families,
      folk: QUALITY.folk,
    }),
    borne = plan.people.findIndex((p) =>
      (p.wounds ?? []).some((w) => w.borne && w.home >= t0 && w.home < t0 + 12 * DAY),
    ),
    healer = plan.people.findIndex((p) => !!p.healer),
    marked = plan.people.findIndex((p) =>
      (p.wounds ?? []).some(
        (w) =>
          (w.lasting === "crutch" || w.lasting === "stump" || w.lasting === "patch") &&
          w.up < t0 + 60 * DAY,
      ),
    );
  if (borne < 0 || healer < 0) continue;
  if (!town || (town.marked < 0 && marked >= 0)) town = { row, plan, borne, healer, marked };
  if (marked >= 0) break;
}
say(
  town
    ? `the town: ${town.row.name} (${town.row.population} people): ${town.row.wounded} of its lines wounded, ${town.row.borne} borne, ${town.row.maimed} maimed; drawn: ${town.plan.people.length}, its healer ${town.plan.people[town.healer]!.name}`
    : "no town with one borne home drawn and a healer",
);
check(!!town, "no town whose wounded borne home are drawn, with a healer and no hospital");
if (!town) await fail();
const { plan, healer } = town!;
await k(`globalThis.causalis.goTo(${JSON.stringify(plan.ref)})`);
await page
  .waitForFunction(() => ((globalThis as any).causalis.watching?.() ?? 0) > 0, undefined, {
    timeout: slow(120000),
  })
  .catch(() => undefined);
await k(`globalThis.causalis.client.setSpeed(0)`);
await page.waitForTimeout(slow(800));
const drawnCount = await k<number>(`globalThis.causalis.watching?.() ?? 0`);
check(
  drawnCount === plan.people.length,
  `${drawnCount} drawn, not the plan's ${plan.people.length}`,
);

// 1. The levy home.
const comesHome = plan.people[town!.borne]!.wounds!.find((w) => w.borne && w.home >= t0)!,
  homeDay = ofDay(comesHome.home);
await advance(homeDay * DAY + 15.6 * HOUR);
let s = await shown();
const coming = s?.homecomings.find((h) => ofDay(h.at) === homeDay && h.borne > 0);
say(
  coming
    ? `the levy home from ${coming.where}: day ${homeDay - ofDay(t0)} at ${((coming.at % DAY) / HOUR).toFixed(2)} h, ${coming.people} drawn of it, ${coming.wounded} wounded, ${coming.borne} borne`
    : "no homecoming told",
);
check(!!coming, "the homecoming with one borne not told");
const lit = s?.litters ?? [];
say(
  `its litters: ${lit.length} (${lit.map((l) => `${l.bearers.length} bearing ${l.index}`).join(", ")})`,
);
check(lit.length >= 1, "no litter to bear the wounded home");
check(
  lit.every((l) => l.bearers.length === 2),
  "a litter without two to bear it",
);
if (coming && lit.length) {
  // The town come out by the road, kin at the door, before the column comes in.
  await advance(coming.at - 4 * 60);
  const before = await people(),
    crowd = before.filter((p) => p.why?.startsWith("Come to see the levy home")),
    kin = before.filter((p) => p.why?.startsWith("Waiting at the door for")),
    bearers = before.filter((p) => p.why?.startsWith("Waiting at the road's end to bear"));
  s = await shown();
  say(
    `before it comes in: ${crowd.length} come to see it home, ${kin.length} waiting at the door, ${bearers.length} at the road's end to bear the wounded`,
  );
  check(crowd.length >= 3, `too few come out to see the levy home (${crowd.length})`);
  check(kin.length >= 1, "no kin waiting at the door");
  check(bearers.length >= 2, `too few waiting to bear the wounded (${bearers.length})`);
  if (s) {
    await face(s.edge.x, s.edge.z, 6);
    await shot("1-the-road");
  }
  // Borne in between two.
  const l = lit[0]!;
  await advance((l.start + l.arrive) / 2);
  s = await shown();
  const now1 = await people(),
    on = s?.littersNow.find((q) => q.index === l.index),
    carrying = now1.filter((p) => l.bearers.includes(p.index));
  say(
    `on the way: the litter ${on ? (on.borne ? "borne" : "set down") : "not drawn"}; its bearers ${carrying.map((p) => `${p.task}/${p.carry}`).join(", ")}`,
  );
  check(!!on && on.borne, "the litter not borne");
  check(
    carrying.length === 2 && carrying.every((p) => p.task === "carry" && p.carry === "litter"),
    "the litter's bearers not carrying it",
  );
  check(!!on && carrying.every((p) => near(p, on, 4)), "the litter not between its bearers");
  check(!now1.some((p) => p.index === l.index), "the one borne drawn walking");
  if (on) {
    await face(on.x, on.z, 3);
    await shot("2-litter");
  }
  // Set down at their door.
  await advance(l.arrive + 20);
  s = await shown();
  const down = s?.littersNow.find((q) => q.index === l.index),
    home = plan.people[l.index]!.home;
  say(`at the door: the litter ${down ? (down.borne ? "still borne" : "set down") : "gone"}`);
  check(!!down && !down.borne, "the litter not set down at the door");
  if (down) {
    await face(down.x, down.z, 3);
    await shot("3-door");
  }
  // 2. Abed.
  await advance(l.arrive + 10 * 60);
  s = await shown();
  say(
    `then: ${s?.abed.length ?? 0} abed, ${s?.away ?? 0} away with the levy still, ${s?.gone ?? 0} gone`,
  );
  check(!!s?.abed.includes(l.index), "the one borne home not abed");
  check(
    !(await people()).some((p) => p.index === l.index),
    "the one borne home drawn up and about",
  );
  check(
    !!s?.homes.some((h) => h.index === l.index),
    `the home of the one borne (home ${home}) not among the homes of those abed`,
  );
}

// 3. The healer: the fresh wounds seen to that evening; the next morning's round.
const evening = (await legs(healer)).find(
  (g) => g.task === "heal" && g.why?.startsWith("Seeing to"),
);
say(`the healer's evening: ${evening ? evening.why : "no one seen to"}`);
check(!!evening, "the healer sees no one newly home that evening");
if (evening) {
  await advance(homeDay * DAY + (evening.from + evening.to) / 2);
  const h = (await people()).find((p) => p.index === healer);
  check(h?.task === "heal", `the healer at ${h?.task ?? "nothing"}, not seeing to the wounds`);
  if (h) {
    await face(h.x, h.z, 3);
    await shot("4-evening");
  }
}
await advance((homeDay + 1) * DAY + 7 * HOUR);
const round = (await legs(healer)).filter((g) => g.task === "heal");
say(`the morning's round: ${round.length} doors (${round.map((g) => g.why).join("; ")})`);
check(round.length >= 1, "no round of the wounded abed the next morning");
if (round.length) {
  const g = round[0]!;
  await advance((homeDay + 1) * DAY + (g.from + g.to) / 2);
  s = await shown();
  const h = (await people()).find((p) => p.index === healer);
  check(h?.task === "heal", "the healer not at the round's first door");
  check(
    !!h && !!s?.homes.some((q) => near(q, h, 12)),
    "the healer's first door not the home of one abed",
  );
  if (h) {
    await face(h.x, h.z, 3);
    await shot("5-round");
    // The healer's card opens their page.
    if (await tap(healer)) {
      const button = page.locator(`${CARD} button:visible`, { hasText: "Their page" });
      check((await button.count()) > 0, "no page on the healer's card");
      if (await button.count()) {
        await button.first().click();
        await page
          .waitForFunction(
            () => String((globalThis as any).causalis.pageOpen?.() ?? "").startsWith("heal:"),
            undefined,
            { timeout: slow(30000) },
          )
          .catch(() => undefined);
        await page.waitForTimeout(slow(600));
        const ref = String(await k(`globalThis.causalis.pageOpen?.() ?? ""`)),
          named = await title();
        say(`the healer's card: their page ${ref}, “${named}”`);
        check(ref === `heal:${plan.ref}`, `the healer's card opened ${ref || "nothing"}`);
        check(named === plan.people[healer]!.name, `the healer's page titled “${named}”`);
        await shot("6-healer-page");
        await putAway();
      }
    } else check(false, "the healer could not be tapped");
  }
}

// 4. Up and bound: the first of those healing up again from here on, bound.
s = await shown();
const t3 = await now(),
  up = (s?.healing ?? []).filter((q) => q.up >= t3).sort((a, b) => a.up - b.up)[0];
say(up ? `up first: ${plan.people[up.index]!.name}, day ${ofDay(up.up) - ofDay(t0)}` : "no one up");
check(!!up, "no one healing gets up again");
if (up) {
  await advance((ofDay(up.up) + 1) * DAY + 15.5 * HOUR);
  s = await shown();
  const p = (await people()).find((q) => q.index === up.index);
  say(
    `up and bound: ${p ? (p.why ?? p.task ?? "about") : "not drawn"}; drawn ${s?.drawn.bandage ?? 0} bandages, ${s?.drawn.sling ?? 0} slings`,
  );
  check(!!p, "the one up again not drawn");
  check((s?.drawn.bandage ?? 0) + (s?.drawn.sling ?? 0) >= 1, "no wound bound drawn");
  if (p) {
    await face(p.x, p.z, 2.5);
    await shot("7-bound");
  }
}

// 5. Marked for good: one with a crutch, a stump or a patch, by day.
const markedFor = (l: Shown["lasting"]) =>
  l.find((q) => q.marks.some((m) => m === "crutch" || m === "stump" || m === "patch"));
let marked = markedFor(s?.lasting ?? []);
if (!marked) {
  // (None yet: on to the morning after the first maimed is up again.)
  const first = plan.people
    .flatMap((p, i) =>
      (p.wounds ?? [])
        .filter((w) => w.lasting === "crutch" || w.lasting === "stump" || w.lasting === "patch")
        .map((w) => ({ i, up: w.up })),
    )
    .sort((a, b) => a.up - b.up)[0];
  if (first) await advance((ofDay(Math.max(first.up, await now())) + 1) * DAY + 10.5 * HOUR);
  s = await shown();
  marked = markedFor(s?.lasting ?? []);
} else {
  await advance((ofDay(await now()) + 1) * DAY + 10.5 * HOUR);
  s = await shown();
  marked = markedFor(s?.lasting ?? []);
}
say(
  marked
    ? `marked for good: ${plan.people[marked.index]!.name} (${marked.marks.join(", ")}); drawn ${s?.drawn.crutch ?? 0} crutches, ${s?.drawn.stumps ?? 0} stumps, ${s?.drawn.patch ?? 0} patches, ${s?.drawn.scar ?? 0} scars`
    : "no one marked for good",
);
check(!!marked, "no one marked for good in the town");
check(
  (s?.drawn.crutch ?? 0) + (s?.drawn.stumps ?? 0) + (s?.drawn.patch ?? 0) >= 1,
  "no crutch, stump or patch drawn",
);
if (marked) {
  const one = marked.index,
    p = (await people()).find((q) => q.index === one);
  check(!!p, "the one marked for good not drawn by day");
  if (p) {
    await face(p.x, p.z, 2.5);
    await shot("8-marked");
  }
  // 6. Their card, and their page.
  if (p && (await tap(one))) {
    const lines = await k<string[]>(
      `[...document.querySelectorAll("${CARD} .folk-wound")].map((e) => e.textContent ?? "")`,
    );
    say(`their card: ${lines.join(" | ") || "no wound told"}`);
    check(lines.length >= 1, "their wounds not told on their card");
    await shot("9-card");
    const button = page.locator(`${CARD} button:visible`, { hasText: "Their page" });
    if (await button.count()) {
      await button.first().click();
      await page
        .waitForFunction(
          () => String((globalThis as any).causalis.pageOpen?.() ?? "").startsWith("folk:"),
          undefined,
          { timeout: slow(30000) },
        )
        .catch(() => undefined);
      await page.waitForTimeout(slow(800));
      const told = (await listOn("Their wounds")) ?? [];
      say(`their page “${await title()}”: ${told.join(" | ")}`);
      check(told.length >= 1, "their wounds not told on their page");
      check(
        told.some((r) => /^(Lost|Wounded|Burned|Crushed)/.test(r)),
        "no wound told by what it did",
      );
      await shot("10-their-page");
      const over = await onPhone("10-their-page-phone");
      check(over <= 2, `their page wider than a phone (${over} px over)`);
    } else check(false, "no page on their card");
  } else if (p) check(false, "the one marked for good could not be tapped");
}

// 7. The town's wounded, and its healer's page.
await opened(`${plan.ref}#wounded`);
const healing = Number((await factOn("Healing now")) ?? 0),
  forGood = Number((await factOn("Marked for good")) ?? 0),
  healerFact = (await factOn("Healer")) ?? "";
say(
  `${plan.name}'s wounded: ${healing} healing now, ${forGood} marked for good; healer ${healerFact}`,
);
check(healing + forGood >= 1, "the town's Wounded tab tells none");
check(healerFact === plan.people[healer]!.name, `the town's healer told as “${healerFact}”`);
await shot("11-town-wounded");
const named = await opened(`heal:${plan.ref}#wounded`),
  tending = (await listOn("Whom they tend now")) ?? [];
say(`the healer's page “${named}”: tending ${tending.length}`);
check(named === plan.people[healer]!.name, `the healer's page titled “${named}”`);
check(tending.length >= 1, "the healer's page tells no one they tend");
await shot("12-healer-tending");
const over = await onPhone("12-healer-tending-phone");
check(over <= 2, `the healer's page wider than a phone (${over} px over)`);

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 55 gate passes");
