// node tools/phase41-gate.ts [--ci] [--soft] [--shots dir] — the Phase 41 gate (a town's trades at
// their own buildings and its woodlot, M199–M200; asked for 2026-10-25: "bringing back og causlisis
// like town/country game play and sim like the depth the og game had ... and just actions of
// stuff"), on the built app, the Earth seed three centuries on, in its greatest town that keeps a
// school, a potter's kiln and a temple (or a shrine) — its mills are raised later (a mill's
// millers and its sails turning are checked in tests/view/trades.test.ts):
//   1. a working morning: its children at their letters in its school's rows, one teaching them
//      before them; its potters at the kiln, its mouth aglow; and, where one strikes at the
//      smithy's anvil, sparks;
//   2. a feller's tree coming down at the end of their first blows, lying as they cut it up and
//      carry it off, then a stump where it stood;
//   3. a day of rest: most of the town at prayer before its temple in the morning.
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
console.log("the Phase 41 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Person = {
  name: string;
  x: number;
  z: number;
  task: string | null;
  carry: string | null;
  why: string | null;
  folk: boolean;
};
type Trades = {
  mills: number;
  kilns: number;
  smithies: number;
  turn: number;
  glowing: number;
  sparks: number;
};
type Felled = {
  down: number;
  stumps: number;
  saplings: number;
  next: number | null;
  falling: { over: number; left: number; x: number; z: number }[];
};
type Civic = { kind: string; start: number; end: number; fell: number | null };
type Plan = { ref: string; name: string; seed: number; town?: { civics: Civic[] } | null };

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4293, strictPort: false },
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
const trades = () => k<Trades | null>(`globalThis.causalis.trades?.() ?? null`);
const felled = () => k<Felled | null>(`globalThis.causalis.felling?.() ?? null`);
const YEAR = 365 * 86400,
  DAY = 86400,
  HOUR = 3600;
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(20000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(500));
};
/** The eye over a point of the town (metres), so far off. */
const face = async (x: number, z: number, distance = 22) => {
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`);
  await page.waitForTimeout(slow(1200));
};
const mean = (ps: readonly { x: number; z: number }[]) => ({
  x: ps.reduce((a, p) => a + p.x, 0) / Math.max(1, ps.length),
  z: ps.reduce((a, p) => a + p.z, 0) / Math.max(1, ps.length),
});

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);
const t0 = await k<number>(`globalThis.causalis.client.status?.t ?? 0`);

// The greatest town keeping a school, a kiln, and a temple or a shrine, standing now.
const towns = await k<{ ref: string; name: string; people: number }[]>(
  `globalThis.causalis.client.query({ type: "towns.map" })`,
);
let town: Plan | null = null;
for (const c of towns.slice(0, 40)) {
  const plan = await k<Plan>(
    `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(c.ref)} } })`,
  );
  const has = (kind: string) =>
    !!plan.town?.civics.some((x) => x.kind === kind && (x.end + 1) * YEAR <= t0 && x.fell === null);
  if (has("school") && has("kiln") && (has("temple") || has("shrine"))) {
    town = plan;
    break;
  }
}
say(`the town: ${town ? town.name : "none keeps a school, a kiln and a temple"}`);
check(!!town, "no town of the Earth seed keeps a school, a kiln and a temple by year 300");
if (!town) {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
await until(`${town.name}'s trades`, async () => ((await trades())?.kilns ?? 0) > 0, slow(120000));
await k(`globalThis.causalis.client.setSpeed(0)`);
// (The clock may have run on while the eye came down to the town: its days from where it stands
// now it is held.)
await page.waitForTimeout(slow(500));
const t1 = await k<number>(`globalThis.causalis.client.status?.t ?? 0`);
const rest = (day: number) => (day + (town!.seed % 7)) % 7 === 0;
let day = Math.floor(t1 / DAY) + 1;
while (rest(day)) day++;

// 1. A working morning.
await advance(day * DAY + 10 * HOUR);
let now = await people();
const pupils = now.filter((p) => p.task === "learn"),
  teachers = now.filter((p) => p.task === "talk" && /Teaching/.test(p.why ?? "")),
  potters = now.filter((p) => /kiln|pots/.test(p.why ?? ""));
say(
  `a working morning: ${pupils.length} at their letters, ${teachers.length} teaching; ${potters.length} at the kiln`,
);
check(pupils.length >= 3, `too few children at school (${pupils.length})`);
check(teachers.length >= 1, "no one teaching the children");
check(potters.length >= 1, "no one at the kiln");
if (pupils.length) {
  const m = mean(pupils);
  await face(m.x, m.z, 16);
  await shot("1-school");
}
// The kiln aglow while one tends it; the sails turning; sparks where one strikes.
let worked: Trades | null = null;
for (let tries = 0; tries < 12; tries++) {
  worked = await trades();
  if ((worked?.glowing ?? 0) > 0) break;
  await advance(day * DAY + (10 + (tries + 1) * 0.25) * HOUR);
}
check((worked?.glowing ?? 0) > 0, "no kiln aglow through the morning");
const at = (await people()).filter((p) => p.task === "tend" || p.task === "throw");
if (at.length) {
  const m = mean(at);
  await face(m.x, m.z, 14);
  await shot("2-kiln");
}
say(
  `the works: ${worked?.mills} mills, ${worked?.kilns} kilns, ${worked?.glowing} aglow; ${worked?.smithies} smithies`,
);
now = await people();
// (Sparks where a smith strikes at the anvil, if the town has ore to forge today.)
const smiths = now.filter(
  (p) => p.task === "hammer" && /^(Forging|Casting|Pouring)/.test(p.why ?? ""),
);
if (smiths.length && (worked?.smithies ?? 0) > 0) {
  let sparks = 0;
  for (let tries = 0; tries < 8 && !sparks; tries++) {
    sparks = (await trades())?.sparks ?? 0;
    if (!sparks) await page.waitForTimeout(slow(250));
  }
  say(`at the anvil: ${smiths.length} forging, ${sparks} sparks flying`);
  check(sparks > 0, "no sparks at the anvil where a smith strikes");
  await face(smiths[0]!.x, smiths[0]!.z, 12);
  await shot("4-smithy");
} else say("at the anvil: none forging today");

// 2. A feller's tree: standing till their first blows' end, then coming down, lying, and a stump.
let down: Felled | null = null;
for (let d = 0; d < 8; d++) {
  const first = await felled();
  if (first?.next != null) {
    down = first;
    break;
  }
  // (No feller today, or their trees down already: the next working day, early.)
  day++;
  while (rest(day)) day++;
  await advance(day * DAY + 6 * HOUR);
}
check(down?.next != null, "no tree felled in eight days");
if (down?.next != null) {
  const when = down.next,
    stumps0 = down.stumps;
  await advance(when + 15);
  const coming = (await felled())?.falling ?? [];
  await advance(when + 120);
  const lying = (await felled())?.falling ?? [];
  const tree = lying[0];
  say(
    `a tree felled: at ${((when % DAY) / HOUR).toFixed(2)} h, ${coming.map((f) => f.over.toFixed(2)).join(", ")} over; then ${lying.map((f) => `${f.over.toFixed(2)} over, ${f.left.toFixed(2)} left`).join("; ")}`,
  );
  check(
    coming.some((f) => f.over > 0 && f.over < 1),
    "the tree not seen coming down",
  );
  check(
    lying.some((f) => f.over === 1),
    "the tree felled not lying",
  );
  if (tree) {
    await face(tree.x, tree.z, 14);
    await shot("5-felled");
  }
  // Carried off by evening: a stump where it stood.
  await advance(Math.floor(when / DAY) * DAY + 20 * HOUR);
  const evening = await felled();
  say(`by evening: ${evening?.stumps} stumps (${stumps0} in the morning), ${evening?.down} down`);
  check((evening?.stumps ?? 0) > stumps0, "no stump where the tree was felled");
}

// 3. A day of rest: at prayer before the temple.
day = Math.floor((await k<number>(`globalThis.causalis.client.status?.t ?? 0`)) / DAY) + 1;
while (!rest(day)) day++;
await advance(day * DAY + 10 * HOUR);
now = await people();
const praying = now.filter((p) => p.task === "pray"),
  adults = now.filter((p) => !p.folk).length || now.length;
say(`a day of rest: ${praying.length} of ${now.length} in sight at prayer`);
check(praying.length >= Math.max(3, now.length * 0.35), `too few at prayer (${praying.length})`);
if (praying.length) {
  const m = mean(praying);
  await face(m.x, m.z, 24);
  await shot("6-prayer");
}
void adults;

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 41 gate passes");
