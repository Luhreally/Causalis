// node tools/phase32-gate.ts [--ci] [--soft] [--shots dir] — the Phase 32 gate (the countryside
// about a town as Classic drew it, M170–M172; asked for 2026-10-24: "i cant see the cities form
// and evolve and get that type of detail i got from the og causalisis"), on the built app, the
// Earth seed sixty years on, in its greatest town:
//   1. its fields bounded in its land's manner with a gap toward the town, a patchwork of grain,
//      greens and fallow, orchards in rows, barns and sheds, windmills on the rim (its land works
//      metal), its pasture fenced;
//   2. the windmills' sails turning;
//   3. the year shows: the orchards white with blossom in spring, scarecrows over the corn in
//      summer, fruit at its end, hay in the stubble after the reaping — and none of them in the
//      depth of winter;
//   4. a town by water: its jetty, its boats out on the water by day and tied up at night.
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
console.log("the Phase 32 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Country = Record<string, number>;

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4284, strictPort: false } }),
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
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const country = () => k<Country | null>(`globalThis.causalis.country?.() ?? null`);
const YEAR = 365 * 86400,
  DAY = 86400;
/** The moment `share` of the way through year `year`, at eleven in the morning. */
const when = (year: number, share: number) =>
  year * YEAR + Math.floor(share * 365) * DAY + 11 * 3600;

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
// (Drawn as a balanced setting draws it, whatever the machine: the orchards' fruit with it.)
await k(`globalThis.causalis.setQuality("balanced")`);
await k(`globalThis.causalis.client.setSpeed(0)`);
await k(`globalThis.causalis.client.advance(${when(60, 0.29)})`);
const town = (
  await k<{ ref: string; name: string; people: number }[]>(
    `globalThis.causalis.client.query({ type: "towns.map" })`,
  )
)[0]!;
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
const entered = await until(
  `${town.name}'s countryside`,
  async () => ((await country())?.bounds ?? 0) > 0,
  slow(120000),
);
await k(`globalThis.causalis.client.setSpeed(0)`);
// (The eye out over the fields.)
const plan = await k<{ fields: { x: number; z: number }[]; era: string; house: { walls: string } }>(
  `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(town.ref)} } })`,
);
const fx = plan.fields.reduce((a, f) => a + f.x, 0) / Math.max(1, plan.fields.length),
  fz = plan.fields.reduce((a, f) => a + f.z, 0) / Math.max(1, plan.fields.length);
await k(
  `globalThis.causalis.rig.flyTo({ target: { x: ${fx * 0.1}, y: 0, z: ${fz * 0.1} }, distance: 40, pitch: -24, yaw: 90 })`,
);
await page.waitForTimeout(slow(3000));

// 1. The countryside: bounds, the patchwork, orchards, barns, mills, the pasture's fence.
const c = (await country()) ?? {};
say(
  `${town.name} (${town.people}, ${plan.era}, homes of ${plan.house.walls}): ${plan.fields.length} fields — ${c.bounds} lengths of bound, ${c.greens} of greens and ${c.fallow} fallow, ${c.orchards} orchards of ${c.trees} trees, ${c.barns} barns and sheds, ${c.mills} windmills, a pasture fenced in ${c.pen} rails`,
);
check(entered, "the town's countryside was not drawn");
check((c.bounds ?? 0) >= plan.fields.length * 4, "the fields are not bounded all round");
check((c.greens ?? 0) > 0 && (c.fallow ?? 0) > 0, "the fields are not a patchwork of crops");
check((c.orchards ?? 0) > 0 && (c.trees ?? 0) >= (c.orchards ?? 0) * 6, "no orchards in rows");
check((c.barns ?? 0) > 0, "no barns or sheds by the far fields");
check(plan.era !== "metal" || (c.mills ?? 0) >= 1, "no windmills where the land works metal");
check((c.pen ?? 0) > 12, "the pasture is not fenced");

// 2. The sails turning.
const spin0 = (await country())?.spin ?? 0;
await page.waitForTimeout(slow(2000));
const spin1 = (await country())?.spin ?? 0;
say(`the sails: ${spin0.toFixed(2)} then ${spin1.toFixed(2)} radians round`);
check((c.mills ?? 0) === 0 || Math.abs(spin1 - spin0) > 0.2, "the windmills' sails do not turn");

// 3. The year: blossom, scarecrows, fruit, hay; none of them in winter.
const seasons: [string, number, number, (s: Country) => boolean, string][] = [
  [
    "blossom",
    60,
    0.29,
    (s) => (s.blossom ?? 0) >= 0.5,
    "the orchards are not in blossom in spring",
  ],
  [
    "summer",
    60,
    0.45,
    (s) => (s.scarecrows ?? 0) > 0 && (s.hay ?? 0) === 0 && (s.blossom ?? 1) === 0,
    "no scarecrows over the summer's corn (or hay before the reaping)",
  ],
  ["fruit", 60, 0.62, (s) => (s.fruit ?? 0) > 0, "no fruit at the summer's end"],
  [
    "hay",
    60,
    0.8,
    (s) => (s.hay ?? 0) > 0 && (s.scarecrows ?? 0) === 0 && (s.fruit ?? 0) === 0,
    "no hay in the stubble after the reaping",
  ],
  [
    "winter",
    61,
    0.03,
    (s) => !s.hay && !s.scarecrows && !s.fruit && !s.blossom,
    "hay, scarecrows, fruit or blossom in the depth of winter",
  ],
];
for (const [name, year, share, ok, problem] of seasons) {
  await k(`globalThis.causalis.client.advance(${when(year, share)})`);
  const seen = await until(
    `the countryside at ${name}`,
    async () => {
      const s = await country();
      return !!s && ok(s);
    },
    slow(20000),
  );
  const s = (await country()) ?? {};
  say(
    `${name} (year ${year}, ${Math.round(share * 100)}% through): blossom ${s.blossom}, scarecrows ${s.scarecrows}, fruit ${s.fruit}, hay ${s.hay}`,
  );
  if (!seen) problems.pop();
  check(seen, problem);
  await shot(`3-${name}`);
}

// 4. A town by water (among the greatest): its boats out by day, tied up at the jetty by night.
{
  const towns = await k<{ ref: string; name: string }[]>(
    `globalThis.causalis.client.query({ type: "towns.map" })`,
  );
  let wet: { ref: string; name: string } | null = null;
  for (const t of towns.slice(0, 12)) {
    const p = await k<{ water: unknown }>(
      `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(t.ref)} } })`,
    );
    if (p.water) {
      wet = t;
      break;
    }
  }
  check(!!wet, "none of the greatest towns stands by water");
  if (wet) {
    await k(`globalThis.causalis.client.advance(${when(61, 0.4)})`);
    await k(`globalThis.causalis.goTo(${JSON.stringify(wet.ref)})`);
    await k(`globalThis.causalis.client.setSpeed(0)`);
    const out = await until(
      `${wet.name}'s boats out on the water`,
      async () => ((await country())?.afloat ?? 0) > 0,
      slow(120000),
    );
    const day = (await country()) ?? {};
    await shot("4-boats");
    await k(`globalThis.causalis.client.advance(${when(61, 0.4) + 11 * 3600})`);
    const moored = await until(
      `${wet.name}'s boats tied up at night`,
      async () => (await country())?.afloat === 0,
      slow(20000),
    );
    say(
      `${wet.name} by its water: ${day.boats} boats, ${day.afloat} out by day; at night ${(await country())?.afloat} out`,
    );
    check(out, "no boats out on the water by day");
    check(moored, "the boats are not tied up at night");
  }
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 32 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 32 gate passes",
);
process.exit(problems.length ? 1 : 0);
