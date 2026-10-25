// node tools/phase46-gate.ts [--ci] [--soft] [--shots dir] — the Phase 46 gate (the flock's day and
// year, M208; asked for 2026-10-25: "...work on bringing back og causlisis like town/country game
// play and sim like the depth the og game had ... and just actions of stuff yk"), on the built app,
// the Earth seed three centuries on, in its greatest town that keeps a flock, through a year:
//   1. the spring: lambs among the flock at its grazing;
//   2. a summer's day: folded at the pasture's gap by night, lying down; driven out in the morning,
//      its herders behind it; spread over its grazing at noon, its herders about it; brought in;
//   3. the shearing (a woolly flock): penned at the fold, its herders among it shearing;
//   4. after the harvest: driven out to the stubble of a field reaped and grazing it;
//   5. the winter: kept at the fold on hay, its herders feeding it — fewer of it, one in four taken.
// Its fold of hurdles stands all year; the fleeces are piled by it on the shearing day, and its
// racks are filled with hay in winter.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

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
console.log("the Phase 46 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Flock = {
  state: string;
  x: number;
  z: number;
  fold: { x: number; z: number };
  stubble: number;
  beasts: { x: number; z: number; size: number; lying: boolean }[];
  herders: { x: number; z: number; why: string | null }[];
};
type Plan = {
  ref: string;
  name: string;
  population: number;
  seed: number;
  pasture: { x: number; z: number; r: number };
  fields: { x: number; z: number; w: number; d: number }[];
  fauna?: { flock: { name: string; wool: boolean; herders: number } | null } | null;
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4301, strictPort: false },
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
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const flock = () => k<Flock | null>(`globalThis.causalis.flock?.() ?? null`);
/** What the countryside shows now: the fold's hurdles, the racks with hay in them, the fleeces. */
const country = () => k<Record<string, number> | null>(`globalThis.causalis.country?.() ?? null`);
const now = () => k<number>(`globalThis.causalis.client.status?.t ?? 0`);
const DAY = 86400,
  HOUR = 3600,
  YEAR = 365 * DAY;
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(20000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(900));
};
/** The eye over a point of the town (metres), so far off (the rig's units: ten metres each). */
const face = async (x: number, z: number, distance = 14) => {
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`);
  await page.waitForTimeout(slow(1200));
};
const planOf = (ref: string) =>
  k<Plan>(
    `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(ref)} } })`,
  );
const mean = (f: Flock) => {
  const n = Math.max(1, f.beasts.length);
  return {
    x: f.beasts.reduce((s, b) => s + b.x, 0) / n,
    z: f.beasts.reduce((s, b) => s + b.z, 0) / n,
  };
};

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);

// The greatest town that keeps a woolly flock (to be shorn), else the greatest that keeps any.
const towns = await k<{ ref: string; name: string; people: number }[]>(
  `globalThis.causalis.client.query({ type: "towns.map" })`,
);
let town: Plan | null = null,
  anyFlock: Plan | null = null;
for (const c of [...towns].sort((a, b) => b.people - a.people).slice(0, 240)) {
  const plan = await planOf(c.ref);
  if ((plan.fauna?.flock?.herders ?? 0) === 0 || !plan.fields.length) continue;
  anyFlock ??= plan;
  if (plan.fauna!.flock!.wool) {
    town = plan;
    break;
  }
}
town ??= anyFlock;
check(!!town, "no town of the Earth seed keeps a flock by year 300");
if (!town) {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
const kind = town.fauna!.flock!;
say(
  `the town: ${town.name}, its flock of ${kind.name}${kind.wool ? " (woolly)" : ""}, ${kind.herders} herding`,
);
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
await until(`${town.name}'s flock`, async () => (await flock()) !== null, slow(120000));
await k(`globalThis.causalis.client.setSpeed(0)`);
const t0 = await now(),
  y0 = Math.floor(t0 / YEAR + 1) * YEAR,
  rest = (day: number) => (day + (town!.seed % 7)) % 7 === 0,
  /** The first working day on or after a day of next year (days since the world began). */
  working = (yd: number) => {
    let day = y0 / DAY + yd;
    while (rest(day)) day++;
    return day;
  },
  p = town.pasture;

// 1. The spring: lambs among it.
const spring = working(Math.ceil(0.3 * 365) + 6);
await advance(spring * DAY + 12 * HOUR);
let f = await flock();
const lambs = f?.beasts.filter((b) => b.size < 0.8).length ?? 0;
const fold = (await country())?.fold ?? 0;
say(
  `the spring: ${f?.state}, ${f?.beasts.length} drawn, ${lambs} of them lambs; its fold of ${fold} hurdles`,
);
check(fold >= 8, "no fold of hurdles at the pasture");
check(lambs >= 1, "no lambs in the spring");
if (f) await face(f.x, f.z, 6);
await shot("1-lambs");

// 2. A summer's day.
const summer = working(150);
await advance(summer * DAY + 3 * HOUR);
f = await flock();
const nearFold = (x: Flock) =>
  x.beasts.filter((b) => Math.hypot(b.x - x.fold.x, b.z - x.fold.z) < p.r * 0.45).length;
// (Lying down — unless hunters come at it just then, when it is up on its feet: the most seen
// lying over a few moments of the beasts' own clock.)
let lying = 0;
for (const at of [1000, 1061, 1123, 1187, 1249]) {
  await k(`globalThis.causalis.holdFauna(${at})`);
  await page.waitForTimeout(slow(250));
  lying = Math.max(lying, (await flock())?.beasts.filter((b) => b.lying).length ?? 0);
}
await k(`globalThis.causalis.holdFauna(null)`);
say(
  `the night: ${f?.state}, ${f ? nearFold(f) : 0} of ${f?.beasts.length} at the fold, ${lying} lying`,
);
check(f?.state === "folded", "the flock not folded by night");
check(!!f && nearFold(f) >= f.beasts.length * 0.9, "the flock not at its fold by night");
check(!!f && lying >= f.beasts.length * 0.9, "the flock not lying by night");
await advance(summer * DAY + 7.6 * HOUR);
f = await flock();
const driving = f?.herders.filter((h) => /^Driving the flock out/.test(h.why ?? "")).length ?? 0;
say(`the morning: ${f?.state}, ${driving} driving it out`);
check(f?.state === "out", "the flock not driven out in the morning");
check(driving >= 1, "no herder driving the flock out");
if (f) await face(f.x, f.z, 7);
await shot("2-out");
// (Mid-morning: at noon its herders sit down to their bread.)
await advance(summer * DAY + 10.5 * HOUR);
f = await flock();
const watching = f?.herders.filter((h) => /^Watching the flock/.test(h.why ?? "")).length ?? 0,
  away = f ? Math.hypot(mean(f).x - f.fold.x, mean(f).z - f.fold.z) : 0;
const many = f?.beasts.length ?? 0;
say(
  `mid-morning: ${f?.state}, ${many} drawn, ${away.toFixed(0)} m from the fold, ${watching} watching it`,
);
check(f?.state === "grazing", "the flock not grazing in the morning");
check(away > p.r * 0.4, "the flock grazing at its fold");
check(watching >= 1, "no herder with the flock at its grazing");
if (f) await face(f.x, f.z, 8);
await shot("3-grazing");
await advance(summer * DAY + 17.1 * HOUR);
f = await flock();
say(`the evening: ${f?.state}`);
check(f?.state === "in", "the flock not brought in before evening");

// 3. The shearing.
if (kind.wool) {
  let shearing = -1;
  for (let d = summer + 1; d < summer + 40 && shearing < 0; d++) {
    await advance(d * DAY + 11 * HOUR);
    if ((await flock())?.state === "shearing") shearing = d;
  }
  f = await flock();
  const shearers = f?.herders.filter((h) => h.why === "Shearing the flock").length ?? 0,
    fleeces = (await country())?.fleeces ?? 0;
  say(
    `the shearing: ${shearing >= 0 ? `day ${shearing - y0 / DAY} of the year` : "not come"}, ${shearers} shearing, ${fleeces} fleeces piled`,
  );
  check(shearing >= 0, "a woolly flock never shorn");
  check(shearers >= 1, "no one shearing the flock");
  check(fleeces > 0, "no fleeces piled at the shearing");
  if (f) await face(f.fold.x, f.fold.z, 5);
  await shot("4-shearing");
} else say("the shearing: none — the flock is not woolly");

// 4. After the harvest: the stubble.
const stubble = working(Math.ceil(0.78 * 365) + 4);
await advance(stubble * DAY + 12 * HOUR);
f = await flock();
const field = f && f.stubble >= 0 ? town.fields[f.stubble] : undefined,
  // (Its middle as its day has it; its beasts as drawn — a little off it, should hunters come.)
  middle = f && field ? Math.hypot(f.x - field.x, f.z - field.z) : Infinity,
  onIt = f && field ? Math.hypot(mean(f).x - field.x, mean(f).z - field.z) : Infinity;
say(
  `after the harvest: ${f?.state} on ${f?.stubble !== undefined && f.stubble >= 0 ? `field ${f.stubble}'s stubble` : "its pasture"}, its middle ${middle.toFixed(0)} m from the field's and its beasts ${onIt.toFixed(0)} m`,
);
check(!!field, "the flock not out on the stubble after the harvest");
check(middle < 12 && onIt < 35, "the flock not on the stubble it was driven to");
if (f) await face(f.x, f.z, 9);
await shot("5-stubble");

// 5. The winter.
const winter = working(352);
// (Mid-morning, as before: its herders at their bread at noon.)
await advance(winter * DAY + 10.5 * HOUR);
f = await flock();
const feeding = f?.herders.filter((h) => /hay/.test(h.why ?? "")).length ?? 0,
  racks = (await country())?.racks ?? 0;
say(
  `the winter: ${f?.state}, ${f?.beasts.length} drawn (the summer's ${many}), ${feeding} feeding it hay, ${racks} racks of it`,
);
check(racks > 0, "no hay in the fold's racks in winter");
check((f?.beasts.length ?? many) <= many * 0.85, "the flock not thinned for the winter");
check(f?.state === "winter", "the flock not kept at the fold in winter");
check(feeding >= 1, "no one feeding the flock in winter");
if (f) await face(f.fold.x, f.fold.z, 7);
await shot("6-winter");

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 46 gate passes");
