// node tools/phase27-gate.ts [--ci] [--soft] [--shots dir] — the Phase 27 gate (the ages lived;
// asked for 2026-10-24: "i should be able to be in my game and see the cell stage and every stage
// like spore i would just watch it emerge and be able to pause and influence and all that"), done
// in a real browser on the built app, from the Earth seed's beginning:
//   1. the living world's ages: the land bare until life comes ashore, then the beasts of the
//      age's lineages on it, drawn from their bodies, going about their lives — on while the clock
//      runs, standing while it is held;
//   2. a beast tapped is followed, its life told;
//   3. the land greened by the hand: its grass grows; as the age ends, what fared best under the
//      hand against the land left alone is told and laid on the world's seed, and the world is
//      remade — the ages after run the more to its kind;
//   4. as the ages pass, the lineages come and go;
//   5. on a phone: the telling and the hand's acts within the screen.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Page } from "playwright";

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
console.log("the Phase 27 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Meadow = {
  age: number;
  beasts: number;
  kinds: Record<string, number>;
  born: number;
  died: number;
  taken: number;
  grass: number;
  chosen: number | null;
  parts: number;
  touched: boolean;
  verdict: string | null;
  first: { id: number; x: number; z: number } | null;
};
type State = {
  stage: string;
  paused: boolean;
  seed: string;
  acts: { lives: { age: number; way: string }[] };
  meadow: Meadow | null;
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4279, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const watch = (p: Page) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
watch(page);
const k = <T>(code: string, p: Page = page): Promise<T> => p.evaluate(code) as Promise<T>;
const state = (p: Page = page) => k<State>(`globalThis.causalis.genesis()`, p);
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000, p: Page = page) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await p.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string, p: Page = page) => {
  if (shots) await p.screenshot({ path: join(shots, `${name}.png`) });
};
const speed = (i: number, p: Page = page) => p.click(`.genesis-bar .speed >> nth=${i}`);
const SEED = "first light";

/** Into the beginning, on to the living world's ages. */
const toAges = async (p: Page) => {
  await p.goto(`${base}?universe=earth&seed=${encodeURIComponent(SEED)}&genesis=1`);
  await p.waitForSelector(".genesis h2", { timeout: 600000 });
  for (let i = 0; i < 12 && (await state(p)).stage !== "ages"; i++) {
    await p.click(".genesis-row button:not(.link)");
    await p.waitForTimeout(300);
  }
};
await toAges(page);

// 1. The ages: bare, then alive; on while the clock runs, standing while held.
{
  const first = await state();
  check(first.stage === "ages", `not come to the ages (${first.stage})`);
  const bare = first.meadow;
  say(`the first age: ${bare?.beasts ?? "no"} beasts, grass ${bare?.grass.toFixed(2)}`);
  check(
    !!bare && bare.age === 0 && bare.beasts === 0 && bare.grass < 0.05,
    "the land is not bare before life comes ashore",
  );
  await shot("1-bare");
  await speed(4);
  await until(
    "life come ashore",
    async () => ((await state()).meadow?.beasts ?? 0) > 0,
    slow(30000),
  );
  await speed(1);
  await page.waitForTimeout(slow(2500));
  const a = (await state()).meadow!;
  say(
    `age ${a.age + 1}: ${a.beasts} beasts of ${Object.keys(a.kinds).length} lineages (${JSON.stringify(a.kinds)}), ${a.parts} parts drawn, grass ${a.grass.toFixed(2)}`,
  );
  check(a.beasts >= 8 && Object.keys(a.kinds).length >= 2, "the age's beasts are not on the land");
  check(a.parts > a.beasts * 5, "the beasts are not drawn from their bodies");
  const counts = (await page.textContent(".genesis-count")) ?? "";
  check(
    Object.keys(a.kinds).some((n) => counts.includes(n)),
    `the count does not name them (“${counts}”)`,
  );
  await page.waitForTimeout(slow(2000));
  const b = (await state()).meadow!;
  const moved =
    a.first && b.first && a.first.id === b.first.id
      ? Math.hypot(b.first.x - a.first.x, b.first.z - a.first.z)
      : 1;
  check(
    moved > 0.05 || b.born + b.died > a.born + a.died,
    "nothing in the living world goes about its life",
  );
  await speed(0);
  const c = (await state()).meadow!;
  await page.waitForTimeout(slow(1500));
  const d = (await state()).meadow!;
  check(
    c.first?.x === d.first?.x && c.born === d.born && c.died === d.died,
    "held, the living world did not stand",
  );
  say(`going: the first beast went ${moved.toFixed(2)} m; held, it stood`);
  await shot("1-alive");
}

// 2. A beast tapped, followed.
{
  const m = (await state()).meadow!;
  await page.mouse.move(400, 500);
  const spot = m.first
    ? await k<{ x: number; y: number } | null>(`globalThis.causalis.meadowSpot(${m.first.id})`)
    : null;
  if (spot && spot.x > 10 && spot.x < 900 && spot.y > 80 && spot.y < 790) {
    await page.mouse.click(spot.x, spot.y);
    await until(
      "a beast followed",
      async () => (await state()).meadow?.chosen !== null,
      slow(5000),
    );
  } else {
    // (Off the screen where the card is: the eye turned to it first.)
    await k(
      `(() => { const r = globalThis.causalis.rig; r.target.set(${m.first!.x * 0.1}, 0.2, ${m.first!.z * 0.1}); r.distance = 6; })()`,
    );
    await page.waitForTimeout(slow(1500));
    const again = await k<{ x: number; y: number } | null>(
      `globalThis.causalis.meadowSpot(${m.first!.id})`,
    );
    if (again) await page.mouse.click(again.x, again.y);
    await until(
      "a beast followed",
      async () => (await state()).meadow?.chosen !== null,
      slow(5000),
    );
  }
  await page.waitForTimeout(slow(800));
  const told = (await page.textContent(".genesis-count")) ?? "";
  say(`followed: “${told.split(" — ")[1] ?? ""}”`);
  check(/you follow|you followed/.test(told), "the beast followed is not told of");
  await shot("2-followed");
}

// 3. The hand: the land greened; as the age ends, what fared best laid on the world.
{
  const before = (await state()).meadow!;
  await speed(1);
  await page.click(`.genesis-acts button:has-text("Green the land")`);
  await page.waitForTimeout(slow(600));
  const after = (await state()).meadow!;
  say(`greened: grass ${before.grass.toFixed(2)} → ${after.grass.toFixed(2)}`);
  check(after.grass > before.grass + 0.1 && after.touched, "the land did not green under the hand");
  // (Until a way fares better under the hand than on the land left alone, or the age ends.)
  await until(
    "a way faring better under the hand",
    async () => {
      const m = (await state()).meadow!;
      return m.verdict !== null || m.age !== after.age;
    },
    slow(40000),
  );
  const ageWas = after.age,
    laid = (await state()).seed;
  await speed(4);
  await until(
    "the age's end",
    async () => ((await state()).meadow?.age ?? ageWas) > ageWas,
    slow(30000),
  );
  await speed(0);
  await until("the world remade", async () => (await state()).seed !== laid, slow(30000));
  const s = await state(),
    told = await page.$$eval(".genesis-told p", (x) => x.map((e) => e.textContent ?? "")),
    way = new RegExp(`~life ${ageWas + 1} (grazers|browsers|hunters)`).exec(s.seed)?.[1];
  say(`laid: “${s.seed}”; told: ${told.map((t) => `“${t}”`).join(" ")}`);
  check(!!way, `the age's living world not laid on the seed (“${s.seed}”)`);
  check(
    s.acts.lives.some((l) => l.age === ageWas && l.way === way),
    "the world remade does not carry the act",
  );
  check(
    told.some((t) => new RegExp(`of age ${ageWas + 1} fared best`).test(t)),
    "what fared best is not told",
  );
  check(
    told.some((t) => /The ages after age \d+ ran the more to/.test(t)),
    "what the act did is not told",
  );
  check(
    new RegExp(`age ${ageWas + 1}'s ${way} prospered`).test(
      (await page.textContent(".genesis-laid")) ?? "",
    ),
    "the hand's line does not name it",
  );
  await shot("3-laid");
}

// 4. The ages pass: lineages come and go.
{
  const a = (await state()).meadow!;
  await speed(4);
  await until(
    "ages passing",
    async () => ((await state()).meadow?.age ?? 0) >= a.age + 3,
    slow(40000),
  );
  await speed(0);
  const b = (await state()).meadow!,
    was = new Set(Object.keys(a.kinds)),
    now = Object.keys(b.kinds).filter((n) => (b.kinds[n] ?? 0) > 0);
  say(
    `age ${a.age + 1} → ${b.age + 1}: ${now.filter((n) => !was.has(n)).length} lineages come in, ${[...was].filter((n) => !now.includes(n)).length} gone`,
  );
  check(
    now.some((n) => !was.has(n)),
    "no lineage came in as the ages passed",
  );
  await shot("4-ages");
}

// 5. On a phone: the telling and the hand within the screen.
{
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  watch(phone);
  await toAges(phone);
  await phone.waitForTimeout(slow(1500));
  const fit = await phone.evaluate(() => {
    const card = document.querySelector(".genesis")?.getBoundingClientRect(),
      acts = [...document.querySelectorAll(".genesis-acts button")].map((b) =>
        b.getBoundingClientRect(),
      );
    return {
      over: document.documentElement.scrollWidth - innerWidth,
      card: card ? [card.left, card.right, card.top, card.bottom] : null,
      acts: acts.length,
      within: acts.every((r) => r.left >= -0.5 && r.right <= innerWidth + 0.5),
    };
  });
  say(`on a phone: ${fit.acts} acts, card ${JSON.stringify(fit.card?.map(Math.round))}`);
  check(fit.over <= 0, `the page runs ${fit.over}px off a phone's side`);
  check(fit.acts >= 9 && fit.within, "the hand's acts are not within a phone's screen");
  await shot("5-phone", phone);
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 27 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 27 gate passes",
);
process.exit(problems.length ? 1 : 0);
