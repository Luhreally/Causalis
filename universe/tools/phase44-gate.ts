// node tools/phase44-gate.ts [--ci] [--soft] [--shots dir] — the Phase 44 gate (the year in a
// town's fields, M206; asked for 2026-10-25: "...work on bringing back og causlisis like
// town/country game play and sim like the depth the og game had ... and just actions of stuff"),
// on the built app, the Earth seed three centuries on, in its greatest town drawn lot by lot:
//   1. the crop standing grown in its rows through the summer;
//   2. the rain withheld from its land by the god's hand: the crop parching and falling short over
//      the days after, its farmers carrying water out to the fields;
//   3. its harvest blighted: the blight running through the rows, the blighted crop pulled and
//      burned at the fields' corners;
//   4. the harvest weeks: a field reaped row by row, its reapers at its front and stooks behind
//      them, its rows cut to stubble; no more than so many at a field's front, the rest carrying
//      in the sheaves of the fields reaped before, their stooks thinning as they go.
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
console.log("the Phase 44 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Person = { name: string; x: number; z: number; task: string | null; why: string | null };
type Fields = {
  year: {
    rain: number;
    dry: number;
    lush: number;
    blight: number;
    blessed: number;
    worn: number;
    growth: number;
  };
  crop: {
    standing: number;
    withered: number;
    stubble: number;
    stooks: number;
    high: number;
    fires: number;
  };
  reaping: { field: number; share: number; x: number; z: number }[];
  watered: number[];
  pulled: number[];
  at: Record<string, number>;
};
type Plan = {
  ref: string;
  name: string;
  seed: number;
  cell?: number;
  era?: string;
  fields: { x: number; z: number; w: number; d: number; yaw: number }[];
  town?: { lots: number } | null;
  life?: { fields?: { sent: number; gift: number } };
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4296, strictPort: false },
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
const people = () => k<Person[]>(`globalThis.causalis.peopleNow?.() ?? []`);
const fields = () => k<Fields | null>(`globalThis.causalis.fields?.() ?? null`);
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
  await page.waitForTimeout(slow(800));
};
/** The eye over a point of the town (metres), so far off (the rig's units: ten metres each). */
const face = async (x: number, z: number, distance = 22) => {
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`);
  await page.waitForTimeout(slow(1200));
};
const planOf = (ref: string) =>
  k<Plan>(
    `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(ref)} } })`,
  );
/** An act of the god's palette cast on the town's land: taken up, the town touched, put down. */
const cast = async (id: string, done: (p: Plan) => boolean) => {
  await k(`globalThis.causalis.palette.take(${JSON.stringify(id)})`);
  await page.mouse.click(683, 470);
  const ok = await until(
    `the ${id} told in the town's plan`,
    async () => done(await planOf(town!.ref)),
    slow(30000),
  );
  await k(`globalThis.causalis.palette.putDown()`);
  return ok;
};

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300&hold=1`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);

// The greatest town drawn lot by lot, its fields sown in rows.
const towns = await k<{ ref: string; name: string; people: number }[]>(
  `globalThis.causalis.client.query({ type: "towns.map" })`,
);
let town: Plan | null = null;
for (const c of towns.slice(0, 10)) {
  const plan = await planOf(c.ref);
  if (plan.town && plan.town.lots >= 60 && plan.era !== "forage" && plan.fields.length) {
    town = plan;
    break;
  }
}
say(`the town: ${town ? `${town.name}, ${town.fields.length} fields` : "none drawn lot by lot"}`);
check(!!town, "no town of the Earth seed with fields is drawn lot by lot by year 300");
if (!town) {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
await until(`${town.name}'s fields`, async () => (await fields()) !== null, slow(120000));
await k(`globalThis.causalis.client.setSpeed(0)`);
await page.waitForTimeout(slow(500));
const t0 = await now(),
  // (This year's summer, or the next's where it is past.)
  y0 = Math.floor(t0 / YEAR) * YEAR,
  summer = (y0 + 160 * DAY >= t0 + DAY ? y0 : y0 + YEAR) + 160 * DAY,
  // (The field nearest the town's middle, to look at.)
  near = [...town.fields].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0]!;

// 1. The crop grown in its rows through the summer.
await advance(summer + 11 * HOUR);
let f = await fields();
say(
  `the summer: ${f?.crop.standing} rows standing ${f?.crop.high.toFixed(2)} m high; growth ${f?.year.growth.toFixed(2)}, rain ${f?.year.rain.toFixed(2)}`,
);
check((f?.crop.standing ?? 0) > 20, "the crop not standing in its rows in the summer");
check((f?.crop.high ?? 0) > 1, "the crop not grown by the summer");
const grown = f?.crop.high ?? 0;
await face(near.x, near.z, 9);
await shot("1-summer");

// 2. The rain withheld: parching over the days after; water carried out to the fields.
const withheld = await cast("drought", (p) => (p.life?.fields?.sent ?? 0) < 0);
// (Two weeks on, a working day: no water is carried on a day of rest, and which day of the week the
// summer's falls on moves with the year the clock was held in — later on a slower machine.)
let dry = Math.floor((summer + 14 * DAY) / DAY);
while ((dry + (town.seed % 7)) % 7 === 0) dry++;
await advance(dry * DAY + 10.5 * HOUR);
f = await fields();
let at = await people();
const watering = at.filter((p) => p.task === "water").length,
  filling = at.filter((p) => p.task === "fill").length;
say(
  `the rain withheld${withheld ? "" : " (not told)"}: two weeks on, dry ${f?.year.dry.toFixed(2)}, the crop ${f?.crop.high.toFixed(2)} m high; ${f?.watered.length} fields watered, ${watering} watering, ${filling} filling buckets`,
);
check((f?.year.dry ?? 0) > 0.3, "the crop not parched once the rain was withheld");
check((f?.crop.high ?? grown) < grown * 0.9, "the crop not falling short in the dry");
check(
  (f?.watered.length ?? 0) >= 1 && watering + filling >= 1,
  "no water carried out to the parched fields",
);
if (f?.watered.length) {
  const w = town.fields[f.watered[0]!]!;
  await face(w.x, w.z, 7);
}
await shot("2-parched");

// 3. The harvest blighted: the blight running through the rows, pulled and burned.
const blighted = await cast("blight", (p) => (p.life?.fields?.gift ?? 0) < 0);
// (Twelve days on, a working day: none is pulled on a day of rest.)
let blight = Math.floor((summer + 26 * DAY) / DAY);
while ((blight + (town.seed % 7)) % 7 === 0) blight++;
await advance(blight * DAY + 11 * HOUR);
f = await fields();
at = await people();
const pulling = at.filter((p) => p.task === "pull").length;
say(
  `the harvest blighted${blighted ? "" : " (not told)"}: twelve days on, blight ${f?.year.blight.toFixed(2)}, ${f?.crop.withered} rows withered; ${f?.pulled.length} fields pulled, ${pulling} pulling, ${f?.crop.fires} fires`,
);
check((f?.year.blight ?? 0) > 0.5, "the blight not running through the crop");
check((f?.crop.withered ?? 0) > 0, "no rows withered by the blight");
check((f?.pulled.length ?? 0) >= 1 && pulling >= 1, "no one pulling the blighted crop");
check((f?.crop.fires ?? 0) >= 1, "the blighted crop not burned");
if (f?.pulled.length) {
  const p = town.fields[f.pulled[0]!]!;
  await face(p.x, p.z, 7);
}
await shot("3-blight");

// 4. The harvest weeks: a field reaped row by row, its reapers at its front, stooks behind them;
// so many at each front, the rest carrying in the sheaves of the fields reaped before.
let harvest = Math.floor(summer / YEAR) * YEAR + Math.ceil(0.6 * 365 + 12) * DAY;
// (A working day: none reaps on a day of rest.)
while ((harvest / DAY + (town.seed % 7)) % 7 === 0) harvest += DAY;
await advance(harvest + 9 * HOUR);
const morning = await fields();
await advance(harvest + 15 * HOUR);
f = await fields();
at = await people();
const front = f?.reaping[0],
  reaping = at.filter((p) => p.task === "reap" || p.task === "gather"),
  atFront = front ? reaping.filter((p) => Math.hypot(p.x - front.x, p.z - front.z) < 25).length : 0,
  before = morning?.reaping.find((r) => r.field === front?.field)?.share ?? 0,
  carting = at.filter(
    (p) => p.why && /^(Out to the stooks|Taking up sheaves|Carrying the sheaves in)/.test(p.why),
  ).length,
  // (The most at any one field's front: reapers and binders within its reach.)
  crowd = Math.max(
    0,
    ...(f?.reaping ?? []).map(
      (r) => reaping.filter((p) => Math.hypot(p.x - r.x, p.z - r.z) < 25).length,
    ),
  );
say(
  `the harvest: ${f?.reaping.length} fields being reaped (the first ${((before ?? 0) * 100).toFixed(0)}% → ${((front?.share ?? 0) * 100).toFixed(0)}% through the day), ${reaping.length} reaping and binding, ${atFront} at its front (the most at one ${crowd}); ${carting} carrying in the sheaves; ${f?.crop.stubble} rows in stubble, ${f?.crop.stooks} stooks`,
);
check((f?.reaping.length ?? 0) >= 1, "no field being reaped in the harvest weeks");
check(!!front && front.share > before, "the reaping not going on through the day");
check(atFront >= 1, "no reapers at the field's front");
check((f?.crop.stubble ?? 0) > 0, "no rows cut to stubble");
check((f?.crop.stooks ?? 0) > 0, "no stooks stood behind the reapers");
check(crowd <= 12, `${crowd} crowding one field's front`);
check(carting >= 1, "no one carrying in the sheaves of the fields reaped");
if (front) await face(front.x, front.z, 5);
await shot("4-harvest");

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 44 gate passes");
