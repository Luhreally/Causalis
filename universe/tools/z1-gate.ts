// node tools/z1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save --universe earth|alien]: gate 100, wild lives, at a phone's size, by real touch. On a far save, else (as on CI) a young world run on:
//   1. off the world: an old save loads with it empty and runs on; the same reading twice moves no hash; every new event's words and a page read aloud clean; a beast known and ended; herds taken;
//   2. a land's map by real touch: a land its creatures are on, gone in another season, in the pixels; a beast pressed at its real place, its page's words on the screen;
//   3. a beast's page, off the real screen; the tree's page has what went on.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { herdStock, herdsOf, homePlanet, populationContext } from "../src/sim/index.ts";
import { passAt } from "../src/rules/index.ts";
import { why } from "../src/causal/index.ts";
import { pageOf } from "../src/host/inspect/index.ts";
import { landHerds } from "../src/host/inspect/herds.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  universe = (arg("--universe") ?? "alien") as "earth" | "alien";
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms),
  problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 100, wild lives");

const BAD = /undefined|NaN|\[object|\bnull\b|\b(ev|pol|town|war|cell|herd|beast):\d/;
const u = saveFile ? universe : "earth",
  U = u === "earth" ? EARTH : ALIEN;
const open = (file: string): World => {
  const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  return loadWorld(doc, (s) => U.build(s), rulesetId(U.build(seedFromText(doc.seed)), U.version), {
    allowRulesetChange: true,
  }).world;
};
const world: World = saveFile ? open(saveFile) : U.build(seedFromText("first light")),
  ctx = populationContext(world),
  g = homePlanet(world).generated,
  from = Math.floor(world.now / YEAR);
const plain = (l: readonly unknown[]) =>
  l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join("");

// An old save has none of this: it loads empty, and goes on.
check(herdsOf(world)?.begun === false, "a world came with its creatures begun");
const span = saveFile ? 20 : 260;
for (let y = from + 1; y <= from + span; y++) world.runTo(y * YEAR);
const store = herdsOf(world)!;
// (A beast is rare: on, until one has come and gone and another is at large, as far as time allows.)
{
  const most = from + span + (saveFile ? 260 : 700),
    began = Date.now();
  for (
    let y = from + span + 1;
    y <= most &&
    !(store.known.some((b) => b.ended !== null) && store.beasts().length > 0) &&
    // (A far world's year is dear: twenty seconds of them, then on with what there is.)
    (!saveFile || Date.now() - began < 20000);
    y++
  )
    world.runTo(y * YEAR);
}
const moving = () => {
  let lands = 0;
  for (let c = 0; c < g.offworld.base; c++) if (store.stock[c]! >= 3) lands++;
  return lands;
};
say(`after ${span} years: ${moving()} lands hold creatures; tally ${JSON.stringify(store.tally)}`);
check(moving() > 0, "no land holds any creature");
// The words of everything told.
const told = world.events
  .all()
  .filter((e) =>
    /^(beast\.|war\.herds|life\.(kind|tamed)|ecology\.(herds|overgrazed))/.test(e.type),
  );
const byType = new Map<string, number>();
for (const e of told) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
say(`told: ${[...byType].map(([t, n]) => `${t} ${n}`).join(", ") || "nothing"}`);
for (const e of told.slice(-60)) {
  const line = String(why(world, e.id).claim);
  check(!BAD.test(line), `an event's words: ${line}`);
}
for (const e of [...byType.keys()].map((t) => told.filter((x) => x.type === t).at(-1)!))
  say(`said: ${why(world, e.id).claim}`);
// A beast known: if none has risen, one is due to on this world's own terms: the gate reads only what history did.
const known = store.known.at(-1);
if (!saveFile) check(store.known.length >= 1, "no beast became known in a young world's centuries");
if (!saveFile) check(store.tally.driven >= 1, "no herds were taken in a young world's wars");

// The land to watch: the most creatures, with a town on it if one is; and the moment they are on it, and one they are gone.
const lands = [...Array(g.offworld.base).keys()]
  .filter((c) => {
    const h = landHerds(world, c);
    return h.herds.length > 0 && !h.herds[0]!.still;
  })
  .sort((a, b) => {
    const pa = ctx.provinces.get(a)?.total() ?? 0,
      pb = ctx.provinces.get(b)?.total() ?? 0;
    // (A herd one can see, on a land with people if there is one.)
    const score = (c: number, people: number) =>
      (landHerds(world, c).herds[0]!.n >= 8 ? 2 : 0) + (people > 0 ? 1 : 0);
    return score(b, pb) - score(a, pa) || herdStock(ctx, b) - herdStock(ctx, a) || a - b;
  });
const land = lands[0];
if (!saveFile) if (!saveFile) if (!saveFile) if (!saveFile) check(land !== undefined, "no land has creatures that move");
const plan = land !== undefined ? landHerds(world, land) : null,
  first = plan?.herds[0],
  shares = Array.from({ length: 96 }, (_, i) => i / 96),
  here = first ? shares.filter((s) => passAt(first, s) !== null) : [],
  away = first ? shares.filter((s) => passAt(first, s) === null) : [];
// (They pass twice a year: the moment they are nearest the middle of their way.)
const middle = (l: readonly number[]) =>
  [...l].sort(
    (a, b) =>
      Math.abs(first ? (passAt(first, a) ?? 2) : 2) - Math.abs(first ? (passAt(first, b) ?? 2) : 2),
  )[0] ?? 0;
say(
  `the land to watch: ${land}, ${first?.name} x${first?.n}; on it ${here.length} of 96 of the year, away ${away.length}; undersea ${plan?.undersea}`,
);
// (A far world can have every land its creatures hold built over: nothing to watch on a map, by the map's own rule.)
if (land === undefined && saveFile) {
  say("every land with creatures that move is built over: the map draws none");
  console.log(
    problems.length ? `gate 100: ${problems.join("; ")}` : "gate 100: passed, off the screen",
  );
  process.exit(problems.length ? 1 : 0);
}
check(here.length > 0 && away.length > 0, "the land's creatures are never gone, or never there");
// Its pages, read aloud.
const readPage = (ref: string) => {
  const m = pageOf(world, ref) as {
    title: string;
    kind: string;
    tabs: readonly { blocks: readonly unknown[] }[];
    stats: readonly unknown[];
  };
  // (A link's target is not a word on the page.)
  const text = (JSON.stringify(m.tabs) + JSON.stringify(m.stats) + m.title).replace(
    /"ref":"[^"]*"/g,
    "",
  );
  const words = [...text.matchAll(/"text":"([^"]*)"|"([^"]{12,})"/g)].map((x) => x[1] ?? x[2]);
  check(!BAD.test(words.join(" ")), `${ref}'s words: ${words.join(" ").slice(0, 200)}`);
  return m;
};
if (first) {
  const m = readPage(first.ref);
  check(m.kind === "lineage", `${first.ref} came back an unknown page`);
  say(`its page's title: ${m.title}`);
}
if (known) readPage(`beast:${known.id}`);
readPage("world:tree");
// Every land's page path the land map asks: a land with no creatures, a land of sea, a colony.
for (const c of [0, 1, 2, g.offworld.base - 1]) landHerds(world, c);
// Reading moves nothing.
const before = JSON.stringify(world.domainHashes());
landHerds(world, land ?? 0);
readPage(first?.ref ?? "herd:0:0");
check(JSON.stringify(world.domainHashes()) === before, "reading moved the hashes");

const bytes = gzipSync(
  JSON.stringify(saveWorld(world, rulesetId(world, U.version), { universe: U.name })),
);
// And it comes back as it went.
const again = loadWorld(
  JSON.parse(gunzipSync(bytes).toString("utf8")),
  (s) => U.build(s),
  rulesetId(world, U.version),
).world;
check(
  JSON.stringify(herdsOf(again)?.save()) === JSON.stringify(store.save()),
  "a world's creatures did not come back from its save as they went",
);

const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4300, strictPort: false } }),
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
  page: Page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(25000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  return page.screenshot(shots ? { path: join(shots, `${name}.png`) } : {});
};
const q = `universe=${u}&seed=${encodeURIComponent(world.seed.text)}`;
await page.goto(`${base}?${q}&hold=1`);
await page.waitForFunction(
  () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
  undefined,
  {
    timeout: slow(120000),
  },
);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  {
    timeout: slow(180000),
  },
);
await page.evaluate(
  async ([data, keep]) => {
    const raw = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
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
    await c.importSave(raw);
    await c.save(keep as string);
  },
  [bytes.toString("base64"), `${u}:gate100`],
);
await page.goto(`${base}?${q}&load=${encodeURIComponent(`${u}:gate100`)}&hold=1`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  {
    timeout: slow(180000),
  },
);
await page.waitForTimeout(slow(600));

const YEAR_DAYS = 365,
  DAY = YEAR / YEAR_DAYS,
  HOUR = DAY / 24;
const statusT = () => k<number>("globalThis.causalis.client.status?.t ?? 0");
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(60000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(700));
};
/** The next noon of a working day at a share of a year to come (seconds of the world's clock). */
const noonAt = (fromT: number, share: number, seed: number) => {
  const y = Math.floor(fromT / YEAR) + 1;
  let day = Math.round((y * YEAR) / DAY + share * YEAR_DAYS);
  while ((day + (seed % 7)) % 7 === 0) day++;
  return day * DAY + 12 * HOUR;
};
type Plan = {
  ref: string;
  cell: number;
  seed: number;
  name: string;
  pasture: { x: number; z: number; r: number };
  fauna?: {
    wild: { name: string; niche: string; stock: number }[];
    flock: { name: string; herders: number } | null;
    pass?: { rank: number; width: number; still?: true; way: readonly [number, number] };
    after?: { ref: string; name: string; known: boolean };
  };
};
const planOf = (ref: string) => U.queries["village.plan"]!(world, { ref }) as Plan;
const goDown = async (ref: string) => {
  await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`);
  await until(
    "the town",
    () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(ref)}`,
      ),
    slow(60000),
  );
  await page.waitForTimeout(slow(600));
  await k("globalThis.causalis.client.setSpeed(0)");
};
const faceTown = async (x: number, z: number, distance: number) => {
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`);
  await page.waitForTimeout(slow(900));
};
const pageShown = (re: RegExp) =>
  until(
    `a page saying ${re}`,
    () =>
      k<boolean>(
        `(document.querySelector(".page-window")?.getBoundingClientRect().height ?? 0) > 40 && ${re}.test(document.querySelector(".page-window")?.innerText ?? "")`,
      ),
    slow(15000),
  );
const pageWords = () => k<string>(`document.querySelector(".page-window")?.innerText ?? ""`);
const closePage = async () => {
  await k("globalThis.causalis.closePage?.()");
  await page.waitForTimeout(slow(250));
};
type Shown = { name: string; ref: string; x: number; y: number; doing: string };
const beastsShown = () => k<Shown[]>("globalThis.causalis.beastsOnScreen?.() ?? []");
const inView = (b: { x: number; y: number }) => b.x > 16 && b.x < 414 && b.y > 215 && b.y < 780;

// The beast at large, first: the fewest years on, while it still is.
const large = store.beasts()[0];
if (!saveFile) check(!!large, "no beast at large in a young world's centuries");
if (large?.town && ctx.settlements.get(large.town)) {
  const name = `${large.given}, ${large.by}`;
  await goDown(large.town);
  const t0 = await statusT(),
    plan0 = planOf(large.town);
  say(
    `a beast at large: ${name}, about ${large.townName}; its plan's after: ${plan0.fauna?.after?.name}`,
  );
  await advance(noonAt(t0, 0.5, plan0.seed));
  await faceTown(0, 0, 40);
  let it = (await beastsShown()).find((b) => b.name === name);
  const fauna = await k<{ name: string; x: number; z: number }[]>(
      "globalThis.causalis.faunaNow?.() ?? []",
    ),
    where = fauna.find((b) => b.name === name);
  if (where) await faceTown(where.x, where.z, 12);
  await page.waitForTimeout(slow(600));
  it = (await beastsShown()).find((b) => b.name === name);
  await shot("town-known-noon");
  say(
    `it is ${where ? `at ${Math.round(where.x)}, ${Math.round(where.z)}` : "not about the town"}; on the screen: ${it ? `${Math.round(it.x)}, ${Math.round(it.y)}` : "no"}`,
  );
  if (planOf(large.town).fauna?.after?.known) {
    check(!!where, `${name} is not about its town`);
    check(!!it, `${name} is not on the screen with the eye on it`);
    if (it) {
      await page.touchscreen.tap(it.x, it.y);
      await pageShown(/what happened/i);
      const words = await pageWords();
      await shot("known-page-pressed");
      say(`pressed: ${words.replace(/\s+/g, " ").slice(0, 300)}`);
      check(words.includes(large.given), `its page doesn't name it: ${words.slice(0, 120)}`);
      check(!BAD.test(words), `its page's words: ${words.slice(0, 200)}`);
      await closePage();
    }
  }
}

// The land: the clock set to the moment they are on it, then to one they are gone. (Time held: what the year says is what is drawn.)
await k(`globalThis.causalis.goTo("cell:0:${land}")`);
await until("the land", () => k<boolean>(`globalThis.causalis.scale() === "region"`), slow(60000));
await until(
  "its creatures",
  () => k<boolean>(`(globalThis.causalis.landHerds?.()?.kinds ?? 0) > 0`),
  slow(30000),
);
await k("globalThis.causalis.client.setSpeed(0)");
{
  const t0 = await statusT();
  await advance(noonAt(t0, middle(here), 1));
}
await page.waitForTimeout(slow(900));
const landNow = () =>
  k<{
    beasts: number;
    dens: number;
    kinds: number;
    spots: { x: number; y: number; z: number; ref: string }[];
  } | null>("globalThis.causalis.landHerds?.() ?? null");
const spotsOn = async () =>
  (
    await k<{ x: number; y: number; ref: string }[]>("globalThis.causalis.herdsOnScreen?.() ?? []")
  ).filter(inView);
let info = await landNow();
say(
  `on the land in their season: ${JSON.stringify({ beasts: info?.beasts, dens: info?.dens, kinds: info?.kinds })}`,
);
check((info?.beasts ?? 0) > 0, "no beast is drawn on the land in its season");
// At the zoom a person comes down at, and with the eye on them.
await shot("land-arrive");
const arriving = await spotsOn();
say(`at the zoom a person comes to it: ${arriving.length} on the screen`);
const middleOf = (s: readonly { x: number; z: number; ref: string }[]) => {
  const herd = s.filter((p) => p.ref === first?.ref),
    of = herd.length ? herd : s;
  return {
    x: of.reduce((a, p) => a + p.x, 0) / Math.max(1, of.length),
    z: of.reduce((a, p) => a + p.z, 0) / Math.max(1, of.length),
  };
};
{
  const m = middleOf(info?.spots ?? []);
  await k(`globalThis.causalis.faceLand?.(${m.x}, ${m.z}, 40)`);
  await page.waitForTimeout(slow(700));
  const m2 = middleOf((await landNow())?.spots ?? []);
  await k(`globalThis.causalis.faceLand?.(${m2.x}, ${m2.z}, 40)`);
  await page.waitForTimeout(slow(1000));
}
const png1 = await shot("land-in-season");
const onScreen = await spotsOn();
say(`${onScreen.length} on the screen with the eye on them`);
check(onScreen.length > 0, "the eye went to them and none is on the screen");
// Pressed by real touch: its page's words on the real screen.
const target = onScreen.find((s) => s.ref === first?.ref) ?? onScreen[0];
if (target) {
  const hit = await k<string>(`document.elementFromPoint(${target.x}, ${target.y})?.tagName ?? ""`);
  say(`under the finger: ${hit}`);
  await page.touchscreen.tap(target.x, target.y);
  await pageShown(/what eats it/i);
  const words = await pageWords();
  await shot("creature-page");
  say(`its page: ${words.replace(/\s+/g, " ").slice(0, 620)}`);
  check(/what it eats/i.test(words), `its page does not say what it eats: ${words.slice(0, 120)}`);
  check(/what eats it/i.test(words), "its page does not say what eats it");
  check(/where it lives/i.test(words), "its page does not say where it lives");
  check(!BAD.test(words), `its page's words: ${words.slice(0, 200)}`);
  await closePage();
}
// Gone in another season.
{
  const t0 = await statusT();
  await advance(noonAt(t0, away[Math.floor(away.length / 2)] ?? 0, 1));
}
await page.waitForTimeout(slow(900));
info = await landNow();
const png2 = await shot("land-out-of-season");
say(
  `out of season: ${JSON.stringify({ beasts: info?.beasts, dens: info?.dens })}; the shots ${png1.equals(png2) ? "are the same" : "differ"}`,
);
check((info?.beasts ?? 1) === 0, `${info?.beasts} beasts on the land out of their season`);
check(!png1.equals(png2), "the land in and out of its creatures' season are the same picture");

// The town: a herder between its flock and what is after it.
const townsBig = ctx.settlements
  .all()
  .filter((v) => v.population > 0)
  // (The towns with the most creatures about them, as the great cities have none.)
  .sort(
    (a, b) =>
      herdStock(ctx, b.cell) - herdStock(ctx, a.cell) ||
      b.population - a.population ||
      (a.ref < b.ref ? -1 : 1),
  )
  .slice(0, 80);
const plans = townsBig.map((v) => planOf(v.ref));
const flockTown = plans.find((p) => (p.fauna?.flock?.herders ?? 0) > 0 && p.fauna?.after);
say(`a town with a flock and something after it: ${flockTown?.name ?? "none"}`);
if (!saveFile) check(!!flockTown, "no town keeps a flock with anything after it");
if (flockTown) {
  await goDown(flockTown.ref);
  const t0 = await statusT();
  // (After the herders' noon meal, with the sun still high: the hour the second round of it comes in on them.)
  await advance(noonAt(t0, 0.55, flockTown.seed) + 1.2 * HOUR);
  type Flock = {
    state: string;
    x: number;
    z: number;
    herders: { x: number; z: number; why: string | null }[];
  };
  await until(
    "the flock",
    async () => !!(await k<Flock | null>("globalThis.causalis.flock?.() ?? null")),
    slow(30000),
  );
  const f = (await k<Flock | null>("globalThis.causalis.flock?.() ?? null"))!,
    fauna = await k<{ name: string; x: number; z: number }[]>(
      "globalThis.causalis.faunaNow?.() ?? []",
    ),
    afterName = flockTown.fauna!.after!.name,
    prowler = fauna.filter((b) => b.name === afterName).at(-1),
    guard = f.herders.find((h) => /^Standing between/.test(h.why ?? ""));
  say(
    `after noon the flock is ${f.state}; its herders: ${f.herders.map((h) => h.why).join("; ") || "none"}; after it: ${afterName} at ${prowler ? `${Math.round(prowler.x)}, ${Math.round(prowler.z)}` : "nowhere"}, the flock at ${Math.round(f.x)}, ${Math.round(f.z)}`,
  );
  check(f.state === "grazing", `the flock after noon is ${f.state}`);
  check(!!prowler, `${afterName} is not after the flock`);
  check(!!guard, "no herder stands between the flock and what is after it");
  if (guard && prowler) {
    const d = (a: { x: number; z: number }, b: { x: number; z: number }) =>
      Math.hypot(a.x - b.x, a.z - b.z);
    check(d(guard, prowler) < d(f, prowler), "the herder does not stand between them");
    await faceTown((guard.x + prowler.x) / 2, (guard.z + prowler.z) / 2, 11);
    await shot("town-guard-noon");
    await faceTown((f.x + prowler.x) / 2, (f.z + prowler.z) / 2, 22);
    await shot("town-guard-wide");
    const after = (await beastsShown()).find((b) => b.name === afterName && inView(b));
    check(!!after, `${afterName} isn't on the screen from where the eye can see them both`);
    if (after) {
      await page.touchscreen.tap(after.x, after.y);
      await until(
        "what is after the flock's page",
        async () =>
          (await k<string | null>("globalThis.causalis.pageOpen?.() ?? null")) ===
          flockTown.fauna!.after!.ref,
        slow(12000),
      );
      await closePage();
    }
  }
}

// The town: a land's creatures going past in their season, and gone.
const passTown = plans.find((p) => {
  const w =
    p.fauna?.wild.filter(
      (s) => (s.niche === "grazer" || s.niche === "browser") && s.stock > 0.05,
    ) ?? [];
  return p.fauna?.pass && !p.fauna.pass.still && w.length > 0;
});
say(`a town its creatures go past: ${passTown?.name ?? "none"}`);
if (!saveFile) check(!!passTown, "no town has creatures that go past it");
if (passTown) {
  const pass = passTown.fauna!.pass!,
    flockName = passTown.fauna?.flock?.name ?? "",
    near = [...shares].sort(
      (a, b) => Math.abs(passAt(pass, a) ?? 2) - Math.abs(passAt(pass, b) ?? 2),
    ),
    gone = shares.filter((s) => passAt(pass, s) === null);
  await goDown(passTown.ref);
  const passers = async () =>
    (
      await k<{ name: string; niche: string; x: number; z: number }[]>(
        "globalThis.causalis.faunaNow?.() ?? []",
      )
    ).filter((b) => (b.niche === "grazer" || b.niche === "browser") && b.name !== flockName);
  let t0 = await statusT();
  await advance(noonAt(t0, near[0] ?? 0, passTown.seed));
  const by = await passers();
  // (The eye on the most of them together: the small game keeps its own place apart.)
  const thick = by
    .map((b) => ({
      b,
      n: by.filter((q) => Math.hypot(q.x - b.x, q.z - b.z) < 60).length,
    }))
    .sort((p, q) => q.n - p.n)[0];
  const mx = thick?.b.x ?? 0,
    mz = thick?.b.z ?? 0;
  say(
    `the thickest of them: ${thick?.b.name} with ${thick?.n} near, ${Math.round(Math.hypot(mx, mz))} m from the town's middle`,
  );
  await faceTown(mx, mz, 12);
  await shot("town-herd-near");
  await faceTown(mx, mz, 20);
  await shot("town-herd-noon");
  const seen = (await beastsShown()).filter((b) => inView(b) && by.some((q) => q.name === b.name));
  await faceTown(mx, mz, 40);
  await shot("town-herd-far");
  say(
    `passing ${passTown.name} at noon: ${by.length} about the town, ${seen.length} on the screen with the eye on them`,
  );
  t0 = await statusT();
  await advance(noonAt(t0, gone[Math.floor(gone.length / 2)] ?? 0, passTown.seed));
  const left = await passers();
  await shot("town-herd-gone");
  say(`out of their season: ${left.length} about the town`);
  check(
    by.length > left.length,
    `${by.length} about the town in their season, and ${left.length} out of it`,
  );
  check(seen.length > 0, "no creature going past is on the screen with the eye on them");
}

// A beast's page off the real screen, the tree's.
if (known) {
  await k(`globalThis.causalis.pageWindowOpen("beast:${known.id}")`);
  await pageShown(/what happened/i);
  const words = await pageWords();
  await shot("beast-page");
  say(`a beast's page: ${words.replace(/\s+/g, " ").slice(0, 620)}`);
  check(!BAD.test(words), `a beast's page's words: ${words.slice(0, 200)}`);
  await closePage();
}
await k(`globalThis.causalis.pageWindowOpen("world:tree")`);
await pageShown(/tree of life/i);
await shot("tree-page");
const real = errors.filter(
  (e) => !/ResizeObserver|favicon|WebGL|GPU|GL Driver|swiftshader/i.test(e),
);
check(!real.length, `the page threw: ${real[0]?.slice(0, 300)}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 100: ${problems.length} problems`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("gate 100: passed");
process.exit(0);
