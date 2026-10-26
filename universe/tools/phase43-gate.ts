// node tools/phase43-gate.ts [--ci] [--soft] [--shots dir] — the Phase 43 gate (a town's dead and
// their burying, M205; asked for 2026-10-25: "...work on bringing back og causlisis like
// town/country game play and sim like the depth the og game had ... and just actions of stuff"),
// on the built app, the Earth seed three centuries on, in its greatest town drawn lot by lot:
//   1. its graveyard past its homes, walled, row on row of graves marked;
//   2. a funeral's day: its grave dug in the morning by one come to dig it; its mourners gathered
//      at the door before ten, the dead on a bier; borne on four shoulders to the graveyard, its
//      mourners after; all of them about the grave, the bier set by it; the grave filled after,
//      one more grave in the graveyard;
//   3. fire sent on a home of it: two days on, the fire's dead borne together from its square,
//      on more biers than one.
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
console.log("the Phase 43 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Person = { name: string; x: number; z: number; task: string | null; why: string | null };
type Funeral = {
  leaves: number;
  arrive: number;
  done: number;
  filled: number;
  biers: number;
  dead: number;
  bearers: number;
  grave: { x: number; z: number };
  struck: string | null;
  name: string | null;
};
type Yard = {
  gate: { x: number; z: number };
  way: number;
  rows: number;
  sections: number;
  w: number;
  d: number;
  x: number;
  z: number;
  graves: number;
  stones: number;
  fallen: number;
  crosses: number;
  fresh: number;
  mounds: number;
  open: number;
  heaps: number;
  biers: number;
  borne: number;
  bier: { x: number; z: number; borne: boolean } | null;
  funerals: Funeral[];
};
type Plan = {
  ref: string;
  name: string;
  town?: { lots: number; struck?: { kind: string; lot: number; dead?: number }[] } | null;
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4295, strictPort: false },
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
const yard = (days = 30) => k<Yard | null>(`globalThis.causalis.graveyard?.(${days}) ?? null`);
const now = () => k<number>(`globalThis.causalis.client.status?.t ?? 0`);
const DAY = 86400,
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
/** The eye over a point of the town (metres), so far off (the rig's units: ten metres each). */
const face = async (x: number, z: number, distance = 22) => {
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`);
  await page.waitForTimeout(slow(1200));
};
const near = (p: { x: number; z: number }, q: { x: number; z: number }, r: number) =>
  Math.hypot(p.x - q.x, p.z - q.z) < r;
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

// The greatest town drawn lot by lot.
const towns = await k<{ ref: string; name: string; people: number }[]>(
  `globalThis.causalis.client.query({ type: "towns.map" })`,
);
let town: Plan | null = null;
for (const c of towns.slice(0, 10)) {
  const plan = await planOf(c.ref);
  if (plan.town && plan.town.lots >= 60) {
    town = plan;
    break;
  }
}
say(`the town: ${town ? town.name : "none drawn lot by lot"}`);
check(!!town, "no town of the Earth seed is drawn lot by lot by year 300");
if (!town) {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
await until(`${town.name}'s graveyard`, async () => (await yard()) !== null, slow(120000));
await k(`globalThis.causalis.client.setSpeed(0)`);
// (The clock may have run on while the eye came down to the town: its days from where it stands
// now it is held.)
await page.waitForTimeout(slow(500));
const t0 = await now();

// 1. Its graveyard (seen by day: the morning of its next funeral but one's day, a day on or
// later, its grave dug that morning).
let y = await yard();
const f = (y?.funerals ?? []).find((q) => q.leaves >= Math.floor(t0 / DAY + 1) * DAY);
if (f) await advance(Math.floor(f.leaves / DAY) * DAY + 7 * HOUR);
y = await yard();
say(
  `its graveyard: ${y?.w.toFixed(0)} × ${y?.d.toFixed(0)} m, ${y?.sections} sections of ${y?.rows} rows, ${y?.graves} graves; drawn ${y?.stones} stones (${y?.fallen} fallen), ${y?.crosses} crosses, ${y?.mounds} mounds (${y?.fresh} fresh)`,
);
check((y?.graves ?? 0) > 0, "no graves in the town's graveyard");
check((y?.stones ?? 0) + (y?.crosses ?? 0) > 0, "no grave marked in the graveyard");
check(!!y && Math.hypot(y.gate.x, y.gate.z) > 40, "the graveyard not past the town's homes");
if (y) {
  await face(y.x, y.z, Math.max(y.w, y.d) / 10 + 4);
  await shot("1-graveyard");
  // (Its gate, from the town.)
  await face(y.gate.x, y.gate.z, 5);
  await shot("1b-gate");
}

// 2. A funeral's day.
say(
  f
    ? `the next funeral: day ${Math.floor(f.leaves / DAY)} at ${((f.leaves % DAY) / HOUR).toFixed(2)} h, ${f.dead} dead on ${f.biers} bier(s)${f.name ? `, ${f.name}` : ""}`
    : "no funeral in the next thirty days",
);
check(!!f, "no funeral in the next thirty days");
if (f) {
  const day = Math.floor(f.leaves / DAY);
  // Its grave dug in the morning.
  await advance(day * DAY + 8.25 * HOUR);
  y = await yard();
  const diggers = (await people()).filter((p) => p.task === "dig" && near(p, f.grave, 8));
  say(`the morning: ${y?.open} grave(s) open, ${y?.heaps} heap(s); ${diggers.length} digging it`);
  check((y?.open ?? 0) >= 1, "no grave open in the morning");
  check(diggers.length >= 1, "no one digging the grave");
  if (diggers.length) {
    await face(f.grave.x, f.grave.z, 3);
    await shot("2-dig");
  }
  // Gathered at the door before ten, the dead on a bier.
  await advance(f.leaves - 8 * 60);
  y = await yard();
  const gathered = (await people()).filter((p) => p.task === "mourn" || p.task === "pray");
  say(
    `before it leaves: ${gathered.length} gathered; ${y?.biers} bier(s) drawn, ${y?.borne} borne`,
  );
  check(gathered.length >= 4, `too few gathered for the funeral (${gathered.length})`);
  check((y?.biers ?? 0) >= 1 && (y?.borne ?? 1) === 0, "no bier set down before the door");
  if (y?.bier) {
    await face(y.bier.x, y.bier.z, 4);
    await shot("3-gather");
  }
  // Borne to the graveyard, its mourners after.
  await advance((f.leaves + f.arrive) / 2);
  y = await yard();
  const bearing = (await people()).filter((p) => p.task === "bear");
  say(
    `on the way: ${y?.borne} bier(s) borne, ${bearing.length} bearing${y?.bier ? ` at ${y.bier.x.toFixed(0)}, ${y.bier.z.toFixed(0)}` : ""}`,
  );
  check((y?.borne ?? 0) >= 1, "the bier not borne");
  check(bearing.length >= 4, `too few bearing the bier (${bearing.length})`);
  check(
    !!y?.bier && bearing.filter((p) => near(p, y!.bier!, 6)).length >= 4,
    "the bier not on its bearers' shoulders",
  );
  if (y?.bier) {
    await face(y.bier.x, y.bier.z, 4);
    await shot("4-borne");
  }
  // About the grave.
  await advance(f.arrive + 5 * 60);
  y = await yard();
  const about = (await people()).filter(
    (p) => (p.task === "mourn" || p.task === "pray") && near(p, f.grave, 14),
  );
  say(`at the grave: ${about.length} about it; the bier ${y?.bier ? "by it" : "gone"}`);
  check(about.length >= 4, `too few about the grave (${about.length})`);
  check(!!y?.bier && near(y.bier, f.grave, 3), "the bier not set by the grave");
  await face(f.grave.x, f.grave.z, 6);
  await shot("5-grave");
  // Filled after: one more grave.
  const before = y?.graves ?? 0;
  await advance(f.filled + 10 * 60);
  y = await yard();
  say(`filled in: ${before} → ${y?.graves} graves, ${y?.open} open, ${y?.fresh} fresh mounds`);
  check((y?.graves ?? 0) === before + f.dead, "the grave not counted once filled in");
  check((y?.open ?? 1) === 0, "the grave left open");
  await face(f.grave.x, f.grave.z, 4);
  await shot("6-filled");
}

// 3. A fire's dead, borne together two days on.
await advance((Math.floor((await now()) / DAY) + 1) * DAY + 10 * HOUR);
await face(0, 0, 70);
const home = await k<{ lot: { x: number; y: number; lot: number } | null } | null>(
  `globalThis.causalis.townOnScreen()`,
);
check(!!home?.lot, "no home of the town on the screen to send fire on");
await k(`globalThis.causalis.palette.take("fire")`);
const sent = await now();
if (home?.lot) await page.mouse.click(home.lot.x, home.lot.y);
await until(
  "the fire told in the town's plan",
  async () => !!(await planOf(town!.ref)).town?.struck?.some((s) => s.kind === "fire"),
  slow(30000),
);
await k(`globalThis.causalis.palette.putDown()`);
const fire = (await planOf(town.ref)).town?.struck?.find((s) => s.kind === "fire");
say(`fire sent: ${fire?.dead ?? 0} killed`);
check((fire?.dead ?? 0) >= 2, "the fire told no dead");
await until(
  "the fire's funeral to come",
  async () => !!(await yard())?.funerals.some((q) => q.struck !== null),
  slow(20000),
);
const mass = (await yard())?.funerals.find((q) => q.struck !== null);
say(
  mass
    ? `their funeral: ${((mass.leaves - sent) / DAY).toFixed(1)} days on, ${mass.dead} dead on ${mass.biers} biers`
    : "no funeral of the fire's dead",
);
check(!!mass && mass.biers >= 2, "the fire's dead not borne together");
if (mass) {
  await advance(mass.leaves - 6 * 60);
  y = await yard();
  const gathered = (await people()).filter((p) => p.task === "mourn" || p.task === "pray");
  say(`before it leaves: ${y?.biers} biers set down, ${gathered.length} gathered`);
  check((y?.biers ?? 0) >= 2, "the fire's dead not laid out on their biers");
  check(gathered.length >= 8, `too few gathered for the fire's dead (${gathered.length})`);
  if (y?.bier) {
    await face(y.bier.x, y.bier.z, 6);
    await shot("7-their-dead");
  }
  await advance((mass.leaves + mass.arrive) / 2);
  y = await yard();
  say(`on the way: ${y?.borne} biers borne`);
  check((y?.borne ?? 0) >= 2, "the fire's dead not borne together");
  if (y?.bier) {
    await face(y.bier.x, y.bier.z, 7);
    await shot("8-procession");
  }
}

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 43 gate passes");
