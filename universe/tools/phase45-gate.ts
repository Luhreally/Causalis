// node tools/phase45-gate.ts [--ci] [--soft] [--shots dir] — the Phase 45 gate (a crowd sized to
// its town, M202, and a person's day told, M207; asked for 2026-10-25: "...work on bringing back
// og causlisis like town/country game play and sim like the depth the og game had ... and just
// actions of stuff yk"), on the built app, the Earth seed three centuries on, in its greatest town
// drawn lot by lot, on a working day of the harvest:
//   1. the town drawn with a crowd its size: one of its people for every twelve, to the setting's
//      most;
//   2. one of its families tapped: their page tells their day, a line for each thing in turn,
//      the one now lit;
//   3. a line still to come tapped: the clock taken on to it, that line lit, the eye kept on them;
//   4. one of the town's many tapped: their card tells their day too.
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
console.log("the Phase 45 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Person = {
  name: string;
  x: number;
  z: number;
  activity: number;
  task: string | null;
  index: number;
  ref: string;
  folk: boolean;
  why: string | null;
};
type Plan = {
  ref: string;
  name: string;
  population: number;
  era?: string;
  fields: unknown[];
  town?: { lots: number } | null;
};
type Lines = { at: string; words: string; state: string }[];

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4300, strictPort: false },
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
/** Whether something comes within so long (without a problem told where it does not). */
const soon = async (ok: () => Promise<boolean>, ms: number) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  return false;
};
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  if (await soon(ok, ms)) return true;
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const people = () => k<Person[]>(`globalThis.causalis.peopleNow?.() ?? []`);
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
/** The eye over a point of the town (metres), from so far off. */
const over = async (x: number, z: number, distance: number, pitch: number) => {
  await k(
    `globalThis.causalis.rig.flyTo({ target: { x: ${x * 0.1}, y: 0, z: ${z * 0.1} }, distance: ${distance}, pitch: ${pitch} })`,
  );
  await page.waitForTimeout(slow(2500));
};
/** One drawn tapped where they stand on the screen (the eye brought over them first). */
const tap = async (p: Person) => {
  await over(p.x, p.z, 3.5, -40);
  const at = await k<{ x: number; y: number } | null>(
    `globalThis.causalis.personOnScreen?.(${p.index}) ?? null`,
  );
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(slow(900));
  return true;
};
/** The day's lines told in a box: when, what, and whether gone by, now or to come. */
const linesIn = (box: string) =>
  k<Lines>(
    `[...document.querySelectorAll(${JSON.stringify(`${box} .day-lines li`)})].filter((li) => li.offsetParent !== null).map((li) => ({ at: li.querySelector(".day-at")?.textContent ?? "", words: li.querySelector(".day-words")?.textContent ?? "", state: li.className }))`,
  );
const planOf = (ref: string) =>
  k<Plan>(
    `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(ref)} } })`,
  );

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300&hold=1`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);

// The greatest town drawn lot by lot, at work on a working day of the harvest.
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
check(!!town, "no town of the Earth seed with fields is drawn lot by lot by year 300");
if (!town) {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
await until(
  `${town.name} drawn`,
  async () => ((await k<number>(`globalThis.causalis.watching?.() ?? 0`)) ?? 0) > 0,
  slow(120000),
);
await k(`globalThis.causalis.client.setSpeed(0)`);
await page.waitForTimeout(slow(500));
const t0 = await now(),
  y0 = Math.floor(t0 / YEAR) * YEAR,
  // (The harvest's twelfth day: fields being reaped, others' sheaves carried in.)
  harvest = (y0 + 232 * DAY >= t0 + DAY ? y0 : y0 + YEAR) + Math.ceil(0.6 * 365 + 12) * DAY;
let day = harvest / DAY;
// (A working day: on to the next where the town rests.)
for (let tries = 0; tries < 3; tries++) {
  await advance(day * DAY + 9.5 * HOUR);
  const at = await people();
  if (at.some((p) => p.task === "reap")) break;
  day++;
}

// 1. A crowd its size.
const drawn = await k<number>(`globalThis.causalis.watching?.() ?? 0`),
  many = (await people()).filter((p) => p.folk).length,
  want = Math.min(200, Math.ceil(town.population / 12));
say(`${town.name} (${town.population}): ${drawn} drawn (${many} of its many in sight)`);
check(drawn >= want, `too few drawn for a town its size (${drawn}, want ${want})`);
await shot("1-crowd");

// 2. One of its families tapped at work: their day told on their page, the line now lit.
const named = (await people()).filter((p) => !p.folk && p.activity === 3 && p.why);
let told: Lines = [];
let who: Person | null = null;
for (const p of named.slice(0, 6)) {
  if (!(await tap(p))) continue;
  await soon(async () => (await linesIn(".page-live-more")).length > 0, slow(8000));
  told = await linesIn(".page-live-more");
  if (told.length) {
    who = p;
    break;
  }
}
const lit = told.find((l) => l.state === "now");
say(
  `${who?.name ?? "no one"} tapped: their day in ${told.length} lines; now “${lit?.at} ${lit?.words}”`,
);
check(told.length >= 5, "a family's day not told on their page");
check(!!lit, "the line now not lit");
check(
  told[0]?.words === "Asleep" && told.some((l) => /^Breakfast/.test(l.words)),
  "their day not told from their waking",
);
await shot("2-their-day");

// 3. A line still to come tapped: on to it, it lit, the eye kept on them.
const next = told.findIndex((l) => l.state === "next");
if (next >= 0) {
  const line = told[next]!,
    [h, m] = line.at.split(":").map(Number) as [number, number],
    to = day * DAY + h * HOUR + m * 60;
  await page.click(`.page-live-more .day-lines li:nth-child(${next + 1})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, to, {
      timeout: slow(20000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(1500));
  const after = await linesIn(".page-live-more"),
    litNow = after.find((l) => l.state === "now"),
    at = await now(),
    kept = await k<boolean>(
      `/Kept in view/.test(document.querySelector(".page-actions .scene-act.on")?.textContent ?? "")`,
    );
  say(
    `“${line.at} ${line.words}” tapped: the clock at ${((at - day * DAY) / HOUR).toFixed(2)} h; now “${litNow?.at} ${litNow?.words}”; kept in view: ${kept}`,
  );
  check(at >= to - 1, "the clock not taken on to the line tapped");
  check(litNow?.at === line.at, "the line tapped not lit once come to");
  check(kept, "the eye not kept on them");
  await shot("3-gone-on");
} else problems.push("no line of their day still to come");

// 4. One of the town's many tapped: their card tells their day. (The one kept in view let go,
// their page put away.)
await k(`document.querySelector(".page-actions .scene-act.on")?.click()`);
await page.keyboard.press("Escape");
await page.waitForTimeout(slow(500));
// (Awake and about: walking, at work, eating, at play, gathering in.)
const about = new Set([2, 3, 4, 5, 7]),
  astir = (await people()).filter((p) => p.folk && about.has(p.activity));
let theirs: Lines = [],
  one: Person | null = null;
for (const p of astir.slice(0, 6)) {
  if (!(await tap(p))) continue;
  await soon(async () => (await linesIn(".folk-more")).length > 0, slow(8000));
  theirs = await linesIn(".folk-more");
  if (theirs.length) {
    one = p;
    break;
  }
}
if (one) {
  say(`${one.name} tapped: their day in ${theirs.length} lines`);
  await shot("4-one-of-many");
} else {
  const all = (await people()).filter((p) => p.folk),
    by = new Map<number, number>();
  for (const p of all) by.set(p.activity, (by.get(p.activity) ?? 0) + 1);
  problems.push(
    `none of the town's many about in sight told their day (${astir.length} about of ${all.length}: ${[...by].map(([a, n]) => `${a}×${n}`).join(" ")})`,
  );
}
check(theirs.length >= 5, "one of the many's day not told on their card");

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 45 gate passes");
