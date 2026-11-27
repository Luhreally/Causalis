// Figures on the ground and out of one another (asked 2026-11-26: "why are aliens in the ground!!! ... no meshes colliding
// and phasing into each other like real things dont do that"): on each save given, its towns gone to in the built app (a big
// city, a tight town, a coast town, and any asked by name), every figure drawn counted at several hours of its day: those whose
// lowest point is off the ground they stand on by more than a tolerance (sunk or floating), the pairs with parts in one
// another, those with a part in what stands solid (a building, a block, a wall, a court's bench, a stone) or in a tree's trunk
// (view/footing.ts feetTally, read off what render/folk.ts posed), from eight in the morning every two hours. Stills at a phone's size and a desk's from one camera each,
// kept with the cameras (--cams) so a later build is looked at from the same. (npm run build first: it reads dist/.)
//   node tools/feet-check.ts --save a.save[:Town name] [--save b.save ...] [--dist dist] [--shots dir] [--cams cams.json]
//     [--samples 6] [--tolerance 0.02] [--towns 3] [--out tally.json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import { loadWorld, rulesetId, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { populationContext } from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  all = (name: string) => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]!] : [])),
  saves = all("--save"),
  shots = arg("--shots"),
  camsFile = arg("--cams"),
  outFile = arg("--out"),
  samples = Number(arg("--samples") ?? 6),
  tolerance = Number(arg("--tolerance") ?? 0.02),
  townsEach = Number(arg("--towns") ?? 3),
  dist = resolve(arg("--dist") ?? fileURLToPath(new URL("../dist", import.meta.url)));
if (!saves.length) throw new Error("--save file.save[:Town]");
if (shots) mkdirSync(shots, { recursive: true });
type Cam = { target: [number, number, number]; yaw: number; pitch: number; distance: number };
const cams: Record<string, Cam> =
  camsFile && existsSync(camsFile) ? JSON.parse(readFileSync(camsFile, "utf8")) : {};

type Tally = {
  figures: number;
  sunk: number;
  floating: number;
  stepping?: number;
  deepest: number;
  highest: number;
  pairs: number;
  inSolid: number;
  inTree: number;
  worst: { name: string; off: number; task: string | null }[];
  met: { a: string; b: string; at: string; apart: number; kept: number; reach: number[] }[];
  stuck?: { name: string; at: string; x: number; z: number; tree: boolean }[];
};
const costs: {
  save: string;
  town: string;
  /** Each a frame's (ms), the middle of three windows; and the frames counted. */
  feet: number;
  spread: number;
  pose: number;
  frames: number;
}[] = [];
const results: {
  save: string;
  town: string;
  kind: string;
  samples: Tally[];
}[] = [];

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({
    root,
    logLevel: "silent",
    build: { outDir: dist },
    preview: { port: 4471, strictPort: false },
  }),
  base = server.resolvedUrls!.local[0]!,
  // (Drawn on the graphics card, as the look tools draw: in software a city of thousands of towns brought the page down.)
  browser = await chromium.launch({
    args: [
      "--enable-gpu",
      "--ignore-gpu-blocklist",
      "--use-angle=d3d11",
      "--force_high_performance_gpu",
    ],
  });

for (const given of saves) {
  const [file, asked] = given.includes(".save:")
    ? [given.split(".save:")[0] + ".save", given.split(".save:")[1]]
    : [given, undefined];
  const bytes = readFileSync(file!),
    doc = JSON.parse(gunzipSync(bytes).toString("utf8")) as Parameters<typeof loadWorld>[0] & {
      meta?: { universe?: string };
    },
    planet = doc.meta?.universe === ALIEN.name ? ALIEN : EARTH,
    universe = planet === ALIEN ? "alien" : "earth",
    world = loadWorld(
      doc,
      (s) => planet.build(s),
      rulesetId(planet.build(seedFromText(doc.seed)), planet.version),
      { allowRulesetChange: true },
    ).world,
    ctx = populationContext(world),
    held = ctx.settlements
      .all()
      .filter((s) => ctx.settlements.held(s.ref))
      .sort((a, b) => b.population - a.population);
  const year = Math.floor(world.now / 31_536_000);
  console.log(`${file}: ${universe} ${doc.seed}, year ${year}, ${held.length} towns`);
  // (The towns to go to: one asked by name, the greatest, and from the rest a tight town and a coast town found as they are entered.)
  const named = asked ? held.filter((s) => s.name === asked) : [],
    // (Few gone to in choosing: each town entered holds the page's memory a while.)
    pool = [
      held[0],
      ...held.filter((s) => s.population >= 200 && s.population <= 900).slice(0, 3),
      ...held.slice(1, 3),
    ].filter((s): s is NonNullable<typeof s> => !!s && !named.includes(s));
  for (const view of [
    {
      name: "phone",
      options: {
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
    { name: "desk", options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
  ] as const) {
    const context = await browser.newContext(view.options),
      page: Page = await context.newPage(),
      errors: string[] = [];
    page.setDefaultTimeout(120000);
    page.on("pageerror", (e) => errors.push(e.message));
    const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>,
      q = `universe=${universe}&seed=${encodeURIComponent(doc.seed)}`,
      keep = `${universe}:feet-check`;
    await page.goto(`${base}?${q}&hold=1`);
    await page.waitForFunction(
      () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    );
    await page.waitForFunction(
      () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
      undefined,
      { timeout: 300000 },
    );
    await page.evaluate(
      async ([data, name]) => {
        const b = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
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
        await c.save(name as string);
      },
      [bytes.toString("base64"), keep],
    );
    await page.goto(`${base}?${q}&load=${encodeURIComponent(keep)}&hold=1`);
    await page.waitForFunction(
      () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
      undefined,
      { timeout: 300000 },
    );
    await page.waitForTimeout(600);
    const enter = async (ref: string): Promise<boolean> => {
      await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`);
      const end = Date.now() + 60000;
      while (Date.now() < end) {
        const ok = await k<boolean>(
          `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(ref)}`,
        ).catch(() => false);
        if (ok) {
          await page.waitForTimeout(3000);
          return true;
        }
        await page.waitForTimeout(150);
      }
      return false;
    };
    // (The clock taken on to a moment, and the town drawn at it a while: those walking come to where their day has them.)
    const at = async (t: number) => {
      await k(`globalThis.causalis.client.advance(${t})`);
      const end = Date.now() + 30000;
      while (Date.now() < end && (await k<number>("globalThis.causalis.client.status.t")) < t)
        await page.waitForTimeout(100);
      await page.waitForTimeout(1500);
    };
    // (Which kind of town a plan is: by the water beside it and how close its homes stand.)
    const kindOf = () =>
      k<{ coast: boolean; homes: number; reach: number; people: number }>(`(() => {
        const p = globalThis.causalis.planNow();
        let reach = 1;
        for (const h of p.homes) reach = Math.max(reach, Math.hypot(h.x, h.z));
        return { coast: !!(p.landWater && (p.landWater.wet || p.landWater.bank)) || !!p.water, homes: p.homes.length, reach, people: p.people.length };
      })()`);
    const chosen: { ref: string; name: string; kind: string }[] = named.map((s) => ({
      ref: s.ref,
      name: s.name,
      kind: "asked",
    }));
    // (The first view chooses; the second goes to the same.)
    const chosenKey = `${file}|chosen`;
    const before = (
      cams as unknown as Record<string, { ref: string; name: string; kind: string }[]>
    )[chosenKey];
    if (before) chosen.push(...before.filter((c) => c.kind !== "asked"));
    else {
      let tight: { ref: string; name: string; d: number } | null = null,
        coast: { ref: string; name: string } | null = null,
        big: { ref: string; name: string } | null = null;
      for (const s of pool) {
        if (big && tight && coast) break;
        if (!(await enter(s.ref).catch(() => false))) continue;
        const kd = await kindOf().catch(() => null);
        if (!kd) continue;
        if (!big) big = { ref: s.ref, name: s.name };
        else if (kd.coast && !coast) coast = { ref: s.ref, name: s.name };
        else {
          const d = kd.homes / (kd.reach * kd.reach);
          if (!tight || d > tight.d) tight = { ref: s.ref, name: s.name, d };
        }
      }
      for (const [c, kind] of [
        [big, "big city"],
        [tight, "tight town"],
        [coast, "coast town"],
      ] as const)
        if (c && chosen.length < townsEach + named.length)
          chosen.push({ ref: c.ref, name: c.name, kind });
      (cams as unknown as Record<string, unknown>)[chosenKey] = chosen.filter(
        (c) => c.kind !== "asked",
      );
    }
    for (const town of chosen) {
      try {
        if (!(await enter(town.ref))) {
          console.log(`  ${view.name} ${town.name}: not entered`);
          continue;
        }
        // (By day: from the morning on, everyone about, none asleep indoors. The clock taken to a set hour of the next day, so a
        // build counted after is counted at the same hours.)
        const day =
            Math.floor((await k<number>("globalThis.causalis.client.status.t")) / 86_400) + 1,
          hourOf = (n: number) => day * 86_400 + (8 + 2 * n) * 3600;
        await at(hourOf(0));
        const key = `${file}|${town.ref}`;
        // A camera: the one kept, else close over where most stand together.
        let cam = cams[key];
        if (!cam) {
          cam = await k<Cam>(`(() => {
          const c = globalThis.causalis, ps = c.peopleNow(), M = 0.1;
          let best = ps[0], most = -1;
          for (const p of ps) { let n = 0; for (const o of ps) if (Math.hypot(o.x - p.x, o.z - p.z) < 8) n++; if (n > most) { most = n; best = p; } }
          return { target: [best ? best.x * M : 0, 0, best ? best.z * M : 0], yaw: 35, pitch: -22, distance: 1.6 };
        })()`);
          cams[key] = cam;
        }
        await k(
          `(() => { const r = globalThis.causalis.rig; r.halt(); r.target.set(${cam.target.join(",")}); r.yaw = ${cam.yaw}; r.pitch = ${cam.pitch}; r.distance = ${cam.distance}; })()`,
        );
        await page.waitForTimeout(1500);
        const tag = `${(doc.seed as string).replace(/[^a-z0-9]+/gi, "-")}-${town.name.replace(/[^a-z0-9]+/gi, "-")}`;
        if (shots) await page.screenshot({ path: join(shots, `${view.name}-${tag}-near.png`) });
        if (view.name !== "phone") continue;
        // Counted at so many hours of its day: its clock run on between, stopped for each count.
        const got: Tally[] = [];
        for (let n = 0; n < samples; n++) {
          if (n > 0) await at(hourOf(n));
          const t = await k<Tally | null>(`globalThis.causalis.feetNow(${tolerance})`);
          if (t) got.push(t);
        }
        const sum = (f: (t: Tally) => number) => got.reduce((a, t) => a + f(t), 0),
          most = (f: (t: Tally) => number) => got.reduce((a, t) => Math.max(a, f(t)), 0);
        console.log(
          `  ${town.kind.padEnd(10)} ${town.name}: ${sum((t) => t.figures)} figures over ${got.length} counts; sunk ${sum((t) => t.sunk)} (deepest ${most((t) => t.deepest).toFixed(3)} m), floating ${sum((t) => t.floating)} (highest ${most((t) => t.highest).toFixed(3)} m), mid-step ${sum((t) => t.stepping ?? 0)}; pairs in one another ${sum((t) => t.pairs)}; in a solid ${sum((t) => t.inSolid)}; in a trunk ${sum((t) => t.inTree)}`,
        );
        const w = got.flatMap((t) => t.worst).sort((a, b) => Math.abs(b.off) - Math.abs(a.off))[0];
        if (w) console.log(`      worst: ${w.name} at ${w.task ?? "-"}, ${w.off.toFixed(3)} m`);
        for (const p of got.flatMap((t) => t.stuck ?? []).slice(0, 6))
          console.log(
            `      in a ${p.tree ? "trunk" : "solid"}: ${p.name} (${p.at}) at ${p.x}, ${p.z}`,
          );
        for (const p of got.flatMap((t) => t.met).slice(0, 6))
          console.log(
            `      in one another: ${p.a} and ${p.b} (${p.at}), ${p.apart.toFixed(2)} m apart, kept ${p.kept.toFixed(2)} m, reaching ${p.reach.map((r) => r.toFixed(2)).join(" and ")} m`,
          );
        const laid = (got[0] as { laid?: { flat: number; tall: number; ms: number } } | undefined)
          ?.laid;
        if (laid)
          console.log(
            `      its ground: ${laid.flat} pieces stood on, ${laid.tall} stood about, read in ${laid.ms.toFixed(1)} ms`,
          );
        // What it costs a frame, the CPU slowed four times (the phone floor's stand-in, as the Phase 60 gate's), its clock running.
        if (town.kind === "big city" || town.kind === "asked") {
          const cdp = await context.newCDPSession(page);
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
          await k(`globalThis.causalis.client.setSpeed(120)`);
          await page.waitForTimeout(1500);
          // (Three windows of four seconds, the middle one's of each told: a pause for the page's memory falls in one.)
          const windows: { feet: number; spread: number; pose: number; frames: number }[] = [];
          for (let w = 0; w < 3; w++) {
            await k(`globalThis.causalis.footCost()`);
            await page.waitForTimeout(4000);
            windows.push(await k(`globalThis.causalis.footCost()`));
          }
          await k(`globalThis.causalis.client.setSpeed(0)`);
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
          const mid = (f: (w: (typeof windows)[number]) => number) =>
              windows.map((w) => f(w) / Math.max(1, w.frames)).sort((x, y) => x - y)[1]!,
            c = {
              feet: mid((w) => w.feet),
              spread: mid((w) => w.spread),
              pose: mid((w) => w.pose),
              frames: windows.reduce((x, w) => x + w.frames, 0),
            };
          console.log(
            `      a frame at a fourth of the CPU (${c.frames} frames, ${got[0]?.figures ?? 0} figures): ground read ${c.feet.toFixed(3)} ms, kept apart ${c.spread.toFixed(3)} ms (${mid((w) => (w as { gather?: number }).gather ?? 0).toFixed(3)} gathering, ${mid((w) => (w as { core?: number }).core ?? 0).toFixed(3)} stepping), posed ${c.pose.toFixed(3)} ms`,
          );
          costs.push({ save: file!, town: town.name, ...c });
        }
        results.push({ save: file!, town: town.name, kind: town.kind, samples: got });
      } catch (e) {
        console.log(
          `  ${view.name} ${town.name}: ${(e as Error).message.split(String.fromCharCode(10))[0]}`,
        );
      } finally {
        if (camsFile) writeFileSync(camsFile, JSON.stringify(cams, null, 1));
      }
    }
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(" | ")}`);
    await context.close();
  }
}
if (camsFile) writeFileSync(camsFile, JSON.stringify(cams, null, 1));
if (outFile) writeFileSync(outFile, JSON.stringify({ results, costs }, null, 1));
const total = (f: (t: Tally) => number) =>
  results.reduce((a, r) => a + r.samples.reduce((b, t) => b + f(t), 0), 0);
console.log(
  `all: ${total((t) => t.figures)} figures counted; sunk ${total((t) => t.sunk)}, floating ${total((t) => t.floating)}, mid-step ${total((t) => t.stepping ?? 0)}, pairs ${total((t) => t.pairs)}, in a solid ${total((t) => t.inSolid)}, in a trunk ${total((t) => t.inTree)}`,
);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
process.exit(0);
