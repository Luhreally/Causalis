// node tools/phase34-gate.ts [--ci] [--soft] [--shots dir] — the Phase 34 gate (a people's own
// look, made of their world, M176–M178; asked for 2026-10-24: "the people or like humans of the
// aliens worlds all look the same the people dont like procedurally made of the world etc or have
// an alien look"), on the built app, down among a band at the cradle of four worlds never seen
// and of Earth:
//   1. each world's people stand in a look of their own — their stance, arms and eyes, what grows
//      on them (a crest, horns, feelers, a tail), their hide's colour — no two alike;
//   2. their figures drawn in it (as many parts as their look has);
//   3. Earth's people are its upright apes, as ever.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each people.)
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
console.log("the Phase 34 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Folk = {
  stance: string;
  arms: number;
  eyes: number;
  crest: boolean;
  horns: number;
  feelers: boolean;
  tail: boolean;
  hide: string;
  mark: string;
  parts: number;
  at: { x: number; z: number } | null;
  middle: { x: number; z: number } | null;
  facing: number | null;
};
type Camp = { cell: number; id: number; people: number };

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4286, strictPort: false } }),
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
const scale = () => k<string>(`globalThis.causalis.scale()`);
const folk = () => k<Folk | null>(`globalThis.causalis.folk?.() ?? null`);

/** Down among a band at a world's cradle: its people's look, or null where the upright apes stand. */
async function among(universe: string, seed: string): Promise<Folk | null | "none"> {
  await page.goto(`${base}?universe=${universe}&seed=${encodeURIComponent(seed)}&cradle=1`);
  await page.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  if (!(await until(`${seed}: the land`, async () => (await scale()) === "region", slow(90000))))
    return "none";
  const camps: Camp[] = [];
  await until(
    `${seed}: its camps`,
    async () => {
      camps.splice(0, camps.length, ...(await k<Camp[]>(`globalThis.causalis.camps?.() ?? []`)));
      return camps.length > 0;
    },
    slow(30000),
  );
  const camp = [...camps].sort((a, b) => b.people - a.people)[0];
  if (!camp) return "none";
  await k(`globalThis.causalis.client.setSpeed(0)`);
  // (On to the next forenoon: the band out about its land, to be seen by daylight.)
  const t0 = await k<number>(`globalThis.causalis.client.advance(0).then((s) => s.t)`);
  await k(
    `globalThis.causalis.client.advance(${(Math.floor(t0 / 86400) + 1) * 86400 + 10.5 * 3600})`,
  );
  await k(`globalThis.causalis.goNear(${camp.cell}, ${camp.id})`);
  if (
    !(await until(
      `${seed}: down among a band`,
      async () => (await scale()) === "camp",
      slow(60000),
    ))
  )
    return "none";
  // (Their morning let run a little: the grown out about the land, the children at play.)
  await k(`globalThis.causalis.client.setSpeed(12 * 60)`);
  await page.waitForTimeout(slow(3000));
  await k(`globalThis.causalis.client.setSpeed(0)`);
  await page.waitForTimeout(slow(1500));
  const f = await folk();
  // (The eye over their camp, then close by one of them out in the open.)
  if (f?.middle) {
    await k(
      `globalThis.causalis.rig.flyTo({ target: { x: ${f.middle.x}, y: 0.2, z: ${f.middle.z} }, distance: 4.2, pitch: -34, yaw: 30 })`,
    );
    await page.waitForTimeout(slow(2500));
    await shot(`${seed.replace(/\s+/g, "-")}-camp`);
  }
  if (f?.at)
    await k(
      `globalThis.causalis.rig.flyTo({ target: { x: ${f.at.x}, y: 0.25, z: ${f.at.z} }, distance: 1.05, pitch: -12, yaw: ${(f.facing ?? 0) + 35} })`,
    );
  await page.waitForTimeout(slow(2500));
  return f;
}

const worlds: [string, string][] = [
  ["alien", "alien 2"],
  ["alien", "alien 7"],
  ["alien", "alien 12"],
  ["alien", "alien 9"],
];
const seen: { seed: string; f: Folk }[] = [];
for (const [universe, seed] of worlds) {
  const f = await among(universe, seed);
  if (f === "none") continue;
  say(
    f
      ? `${seed}: ${f.stance}, ${f.arms} arms, ${f.eyes} eye${f.eyes > 1 ? "s" : ""}${f.crest ? ", a crest" : ""}${f.horns ? `, ${f.horns} horn${f.horns > 1 ? "s" : ""}` : ""}${f.feelers ? ", feelers" : ""}${f.tail ? ", a tail" : ""}; hide ${f.hide}, markings ${f.mark}; ${f.parts} parts`
      : `${seed}: no look of their own`,
  );
  check(!!f, `${seed}: its people have no look of their own`);
  if (f) {
    check(f.parts >= 12, `${seed}: its people's figure has ${f.parts} parts`);
    seen.push({ seed, f });
  }
  await shot(seed.replace(/\s+/g, "-"));
}
// 1. No two alike.
const hides = new Set(seen.map((s) => s.f.hide)),
  shapes = new Set(seen.map((s) => `${s.f.stance}/${s.f.arms}/${s.f.eyes}/${s.f.parts}`));
say(`${seen.length} peoples: ${hides.size} hides, ${shapes.size} shapes`);
check(seen.length === worlds.length, "not every world's people seen");
check(hides.size === seen.length, "two worlds' peoples share a hide");
check(shapes.size >= Math.min(3, seen.length), "the worlds' peoples are shaped alike");

// 3. Earth's people are its upright apes.
{
  const f = await among("earth", "first light");
  say(
    `first light: ${f === "none" ? "no band seen" : f ? `a look (${f.stance})` : "the upright apes, as ever"}`,
  );
  check(f === null, "Earth's people are not its upright apes");
  await shot("first-light");
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 34 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 34 gate passes",
);
process.exit(problems.length ? 1 : 0);
