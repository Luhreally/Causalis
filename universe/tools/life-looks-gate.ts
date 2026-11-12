// node tools/life-looks-gate.ts [--ci] [--soft] [--shots dir] [--pin] [--earth] — gate 108, every beast drawn from its parts (B1 of
// the life plan, docs/architecture/asks-2026-11-12-plan.md Part B; asked 2026-11-12: "make sure the aliens and how life
// emerges from worlds are real primitives and i see all diffrent types of species etc and novel creatures"), on the
// built app at a phone's size (430 by 932):
//   1. twelve alien worlds' people and living beasts drawn as the pages draw them, side by side, each of a stock of its
//      world (every beast carries a look);
//   2. their outlines read off the pixels drawn (what each picture covers, fitted to its bounds) and compared between
//      worlds: two worlds' beasts must share under a third of their outlines, and their peoples' outlines must differ;
//   3. first light's beasts drawn exactly as before every body was drawn from its parts: each picture's pixels hashed
//      and held to tools/life-looks-earth.json (written with --pin, from a build of the code before B1). Pixels are the
//      renderer's own (a GPU and CI's software GL never agree to the bit), so the pin is kept by renderer; one with no
//      pin of its own says so and leaves Earth to tests/view/earth-looks.test.ts, which holds every beast's every
//      vertex and is the same on any machine.
// --shots keeps each world's sheet and a contact sheet of all twelve (life-looks-sheet.png).
// (npm run build first; --soft draws in software, as CI's browser does.)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

const argv = process.argv.slice(2),
  ci = argv.includes("--ci"),
  soft = argv.includes("--soft"),
  pin = argv.includes("--pin"),
  earthOnly = argv.includes("--earth"),
  shots = argv.includes("--shots") ? argv[argv.indexOf("--shots") + 1] : undefined;
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
console.log("gate 108: every beast drawn from its parts");
if (shots) mkdirSync(shots, { recursive: true });

type Outline = { mask: string; aspect: number; cover: number };
type Sheet = {
  people: Outline | null;
  beasts: (Outline & { name: string; look: boolean; hash: number })[];
};

/** Twelve open worlds with life and a people (alien 0 … 15: those with none left out). */
const WORLDS = earthOnly ? [] : [2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15].map((i) => `alien ${i}`);
const PIN = fileURLToPath(new URL("./life-looks-earth.json", import.meta.url));

/** How alike two outlines are (as ui/life-sheet.ts alike): shared cells over covered cells, other proportions apart. */
function alike(a: Outline, b: Outline): number {
  let both = 0,
    either = 0;
  for (let i = 0; i < a.mask.length; i++) {
    const x = a.mask[i] === "1",
      y = b.mask[i] === "1";
    if (x && y) both++;
    if (x || y) either++;
  }
  const shape = Math.min(a.aspect, b.aspect) / Math.max(a.aspect, b.aspect);
  return either ? (both / either) * Math.min(1, 0.4 + 0.6 * shape) : 1;
}
/** Outlines as alike as this are one outline. */
const SAME = 0.8;

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4323, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true });
page.on("pageerror", (e) => errors.push(e.message));
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;

/** A world opened, and its life on a sheet over the screen. */
async function sheetOf(universe: string, seed: string): Promise<Sheet | null> {
  await page.goto(`${base}?universe=${universe}&seed=${encodeURIComponent(seed)}`);
  try {
    await page.waitForFunction(
      () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
      undefined,
      { timeout: ci || soft ? 900000 : 300000 },
    );
  } catch {
    problems.push(`${seed}: the world did not open`);
    return null;
  }
  const sheet = await k<Sheet>(`globalThis.causalis.lifeSheet(11)`);
  await page.waitForTimeout(300);
  const png = await page.screenshot();
  if (shots) writeFileSync(join(shots, `${seed.replace(/\s+/g, "-")}.png`), png);
  SHOTS.push({ seed, png: png.toString("base64") });
  return sheet;
}
const SHOTS: { seed: string; png: string }[] = [];

// 1. Twelve worlds' life, each drawn of its own stocks.
const sheets: { seed: string; sheet: Sheet }[] = [];
for (const seed of WORLDS) {
  const sheet = await sheetOf("alien", seed);
  if (!sheet) continue;
  sheets.push({ seed, sheet });
  const looked = sheet.beasts.filter((b) => b.look).length;
  say(
    `${seed}: ${sheet.beasts.length} beasts drawn, ${looked} of a stock; its people ${sheet.people ? "drawn" : "not drawn"}`,
  );
  check(sheet.beasts.length >= 4, `${seed}: only ${sheet.beasts.length} beasts drawn`);
  check(
    looked === sheet.beasts.length,
    `${seed}: ${sheet.beasts.length - looked} beasts drawn with no stock`,
  );
  check(!!sheet.people, `${seed}: its people not drawn`);
}
check(sheets.length === WORLDS.length, `only ${sheets.length} of ${WORLDS.length} worlds drawn`);

// 2. Their outlines, off the pixels: what one world's beasts share with another's, and how far apart their peoples are.
let pairs = 0,
  sharedSum = 0,
  nearestSum = 0,
  nearestN = 0,
  worst = { share: 0, a: "", b: "" };
for (const A of sheets)
  for (const B of sheets) {
    if (A === B) continue;
    let shared = 0;
    for (const a of A.sheet.beasts) {
      let best = 0;
      for (const b of B.sheet.beasts) best = Math.max(best, alike(a, b));
      nearestSum += best;
      nearestN++;
      if (best >= SAME) shared++;
    }
    const share = A.sheet.beasts.length ? shared / A.sheet.beasts.length : 0;
    pairs++;
    sharedSum += share;
    if (share > worst.share) worst = { share, a: A.seed, b: B.seed };
  }
const meanShare = pairs ? sharedSum / pairs : 1;
say(
  `beasts: a world's outlines found in another's ${Math.round(100 * meanShare)}% (mean over ${pairs} pairs), the most ${Math.round(100 * worst.share)}% (${worst.a} in ${worst.b}); nearest match alike ${(nearestSum / Math.max(1, nearestN)).toFixed(2)} on average`,
);
if (!earthOnly)
  check(
    meanShare < 1 / 3,
    `two worlds share ${Math.round(100 * meanShare)}% of their beasts' outlines (under a third wanted)`,
  );
// (--earth: first light alone, to pin it from a build before B1.)
// (Within a world, its beasts are kin: more alike one another than another world's are.)
let within = 0,
  withinN = 0,
  across = 0,
  acrossN = 0;
for (const A of sheets)
  for (const a of A.sheet.beasts)
    for (const B of sheets)
      for (const b of B.sheet.beasts) {
        if (a === b) continue;
        if (A === B) {
          within += alike(a, b);
          withinN++;
        } else {
          across += alike(a, b);
          acrossN++;
        }
      }
say(
  `kin: a world's beasts alike one another ${(within / Math.max(1, withinN)).toFixed(3)}, another world's ${(across / Math.max(1, acrossN)).toFixed(3)}`,
);
const peoples = sheets.filter((s) => s.sheet.people);
let peoplePairs = 0,
  peopleSame = 0;
for (let i = 0; i < peoples.length; i++)
  for (let j = i + 1; j < peoples.length; j++) {
    peoplePairs++;
    if (alike(peoples[i]!.sheet.people!, peoples[j]!.sheet.people!) >= 0.9) peopleSame++;
  }
say(`peoples: ${peopleSame} of ${peoplePairs} pairs of worlds' peoples drawn with one outline`);
if (!earthOnly)
  check(
    peopleSame <= peoplePairs * 0.1,
    `${peopleSame} of ${peoplePairs} pairs of peoples share an outline`,
  );

// 3. Earth, as it was.
const earth = await sheetOf("earth", "first light");
if (earth) {
  const hashes = earth.beasts.map((b) => `${b.name}:${b.hash}`),
    renderer = await k<string>(`(() => {
      const g = document.createElement("canvas").getContext("webgl2");
      const e = g && g.getExtension("WEBGL_debug_renderer_info");
      return g ? String(g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER)) : "none";
    })()`),
    pins: Record<string, string[]> = existsSync(PIN)
      ? ((JSON.parse(readFileSync(PIN, "utf8")) as { renderers?: Record<string, string[]> })
          .renderers ?? {})
      : {};
  check(
    earth.beasts.every((b) => !b.look),
    "first light: a beast drawn with an alien look",
  );
  if (pin) {
    pins[renderer] = hashes;
    writeFileSync(PIN, JSON.stringify({ renderers: pins }, null, 2) + "\n");
    say(`first light: ${hashes.length} beasts' pixels pinned for ${renderer}`);
  } else if (pins[renderer]) {
    const want = pins[renderer],
      moved = hashes.filter((h, i) => h !== want[i]);
    say(`first light: ${hashes.length} beasts drawn, ${moved.length} moved from before`);
    check(
      hashes.length === want.length && !moved.length,
      `first light: ${moved.length} beasts drawn otherwise than before (${moved.slice(0, 3).join(", ")})`,
    );
  } else
    say(
      `first light: ${hashes.length} beasts drawn; no pixels pinned for ${renderer} (Earth's shapes are held by tests/view/earth-looks.test.ts)`,
    );
}

// The contact sheet: the twelve worlds side by side, and first light.
if (shots && SHOTS.length) {
  const sheet = await browser.newPage({ viewport: { width: 1720, height: 1400 } });
  await sheet.setContent(
    `<body style="margin:0;background:#05070f;display:grid;grid-template-columns:repeat(5,344px);gap:0">${SHOTS.map(
      (s) =>
        `<figure style="margin:0;position:relative"><img src="data:image/png;base64,${s.png}" style="width:344px;display:block"><figcaption style="position:absolute;bottom:2px;left:4px;color:#fff;font:12px Verdana;background:#000a;padding:1px 4px">${s.seed}</figcaption></figure>`,
    ).join("")}</body>`,
  );
  await sheet.waitForTimeout(500);
  await sheet.screenshot({ path: join(shots, "life-looks-sheet.png"), fullPage: true });
  say(`contact sheet: ${join(shots, "life-looks-sheet.png")}`);
}

for (const e of errors.slice(0, 5)) say(`page error: ${e}`);
check(!errors.length, `${errors.length} page errors`);
await browser.close();
await server.close();
if (problems.length) {
  console.log("gate 108 fails:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("gate 108 passes");
process.exit(0);
