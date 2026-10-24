// node tools/phase24-gate.ts [--ci] [--soft] [--shots dir] — the Phase 24 gate (the dawn, played;
// asked for 2026-10-24: "i should be able to be in my game and see the cell stage and every stage
// like spore i would just watch it emerge and be able to pause and influence and all that"), done
// in a real browser on the built app, from the Earth seed's beginning:
//   1. the deep clock runs, billions of years a second; paused, it stands; each stage its speeds;
//   2. the first seas' drop is alive: its first cells divide, the light-eaters, the hunting cells
//      and cells together arise as the clock comes to them; a cell tapped is followed; fed, it has
//      more to eat;
//   3. leaving the dawn, what prospered under the hand is laid on the world's seed;
//   4. an age cooled by the hand: the world remade — that age an icehouse, the ages before it as
//      they were — and what it did told;
//   5. the first people, and where to begin: the world begun is the world remade (its seed's
//      text carries the acts, its own beginning the age made), and the eye goes down to the
//      first camp its people settle as it is made;
//   6. on a phone: the telling and the hand's acts within the screen.
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
console.log("the Phase 24 gate");
if (shots) mkdirSync(shots, { recursive: true });

type State = {
  stage: string;
  my: number;
  paused: boolean;
  speed: number;
  seed: string;
  acts: { ages: { age: number; kind: string }[]; dawn: string | null };
  ages: string[];
  lineages: number;
  people: string | null;
  cells: Record<string, number> | null;
  born: number;
  motes: number;
  chosen: number | null;
  choosing: boolean;
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4276, strictPort: false } }),
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
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string, p: Page = page) => {
  if (shots) await p.screenshot({ path: join(shots, `${name}.png`) });
};
const next = (p: Page = page) => p.click(".genesis-row button:not(.link)");
const act = (words: string, p: Page = page) =>
  p.click(`.genesis-acts button:has-text(${JSON.stringify(words)})`);
const SEED = "first light";

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent(SEED)}&genesis=1`);
await page.waitForSelector(".genesis h2", { timeout: 600000 });

// 1. The deep clock: running, paused, each stage's own speeds.
{
  const a = await state();
  await page.waitForTimeout(slow(1500));
  const b = await state();
  check(b.my < a.my - 100, `the clock did not run (${a.my.toFixed(0)} → ${b.my.toFixed(0)} My)`);
  const speeds = await page.$$eval(".genesis-bar .speed", (x) => x.map((e) => e.textContent));
  check(speeds.length >= 4 && speeds.some((s) => /Gyr\/s/.test(s ?? "")), "no galaxy speeds");
  await page.click(".genesis-bar .speed >> nth=0");
  const c = await state();
  await page.waitForTimeout(slow(1200));
  const d = await state();
  check(c.paused && d.my === c.my, "paused, the clock did not stand");
  const clock = (await page.textContent(".genesis-bar .clock")) ?? "";
  check(/billion years ago · paused/.test(clock), `the clock reads “${clock}”`);
  await page.click(".genesis-bar .speed >> nth=1");
  check(!(await state()).paused, "a speed chosen did not let the clock go");
  say(
    `the deep clock: ${a.my.toFixed(0)} → ${b.my.toFixed(0)} million years ago; paused at “${clock}”; the galaxy's speeds ${speeds.join(" ")}`,
  );
  await shot("1-galaxy");
}

// 2. The first seas' drop, alive.
{
  await next();
  await next();
  await next();
  await until("the first cells' stage", async () => (await state()).stage === "first cells");
  const speeds = await page.$$eval(".genesis-bar .speed", (x) => x.map((e) => e.textContent));
  check(
    speeds.some((s) => /Myr\/s/.test(s ?? "")) && !speeds.some((s) => /Gyr/.test(s ?? "")),
    "the first cells' speeds are not their own",
  );
  await until(
    "the first cells dividing",
    async () => (await state()).born > 0 && ((await state()).cells?.eater ?? 0) > 20,
    slow(30000),
  );
  await until(
    "the light-eaters arising",
    async () => ((await state()).cells?.light ?? 0) > 0,
    slow(40000),
  );
  // (Held while it is fed, so the hungry cells do not eat what is poured in before it is counted.)
  const lit = await page.$$eval(".genesis-bar .speed", (x) =>
    x.findIndex((e) => e.classList.contains("on")),
  );
  await page.click(".genesis-bar .speed >> nth=0");
  const fed = await state();
  await act("Feed it");
  const after = await state();
  check(after.motes >= fed.motes + 40, `fed, the drop has ${fed.motes} → ${after.motes} motes`);
  if (lit > 0) await page.click(`.genesis-bar .speed >> nth=${lit}`);
  // A cell tapped in the drop is followed.
  let followed = false;
  for (const [x, y] of [
    [683, 300],
    [600, 250],
    [760, 340],
    [520, 320],
    [840, 260],
    [683, 200],
  ] as const) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(200);
    if ((await state()).chosen !== null) {
      followed = true;
      break;
    }
  }
  check(followed, "no cell tapped in the drop was followed");
  const counted = (await page.textContent(".genesis-count")) ?? "";
  say(`the drop: ${JSON.stringify((await state()).cells)} — “${counted.slice(0, 140)}”`);
  await shot("2-first-cells");
  await next();
  await until(
    "the hunting cells arising",
    async () => ((await state()).cells?.hunter ?? 0) > 0,
    slow(20000),
  );
  await next();
  await until(
    "cells together arising",
    async () => ((await state()).cells?.colony ?? 0) > 0,
    slow(20000),
  );
  await shot("2-colonies");
}

// 3. Leaving the dawn: what prospered under the hand laid on the world's seed.
{
  await next();
  const ok = await until(
    "the dawn's act laid on the seed",
    async () => /~dawn (eaters|light|hunters|together)/.test((await state()).seed),
    slow(30000),
  );
  if (ok) say(`leaving the dawn: “${(await state()).seed}”`);
}

// 4. An age cooled: the world remade from it.
let cooled = -1;
{
  await next();
  await until("the living world", async () => (await state()).stage === "ages", slow(10000));
  // (Paused within an age, so the age the hand is laid on is the one the clock stands in.)
  await page.click(".genesis-bar .speed >> nth=0");
  await page.waitForTimeout(500);
  const before = await state(),
    title = (await page.textContent(".genesis h2")) ?? "",
    n = Number(/age (\d+) of/.exec(title)?.[1] ?? 0);
  cooled = n - 1;
  await act("Cool it");
  const ok = await until(
    "the world remade from a cooled age",
    async () => (await state()).seed.includes(`~age ${n} cool`),
    slow(30000),
  );
  if (ok) {
    const after = await state();
    check(after.ages[cooled] === "icehouse", `age ${n} cooled is ${after.ages[cooled]}`);
    check(
      JSON.stringify(after.ages.slice(0, cooled)) === JSON.stringify(before.ages.slice(0, cooled)),
      "the ages before the one cooled changed",
    );
    const told = (await page.textContent(".genesis-told")) ?? "";
    check(
      /cooled: .*icehouse/.test(told),
      `what the hand did was not told (“${told.slice(-160)}”)`,
    );
    say(`age ${n} cooled: “${told.slice(told.indexOf("Age ")).slice(0, 200)}”`);
    await shot("4-ages-cooled");
  }
  await page.click(".genesis-bar .speed >> nth=2");
}

// 5. The first people; where to begin; the world begun is the world remade.
{
  await next();
  await until("the first people", async () => (await state()).stage === "people", slow(10000));
  // (The peopling after them since Phase 28.)
  await next();
  await until("the peopling", async () => (await state()).stage === "peopling", slow(10000));
  await next();
  await page.waitForSelector(".genesis .choice", { timeout: slow(10000) });
  const choices = await page.$$(".genesis .choice");
  check(choices.length >= 5, `${choices.length} places to begin`);
  const seed = (await state()).seed;
  if (choices.length) {
    await choices[0]!.click();
    await page.waitForFunction(
      () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
      undefined,
      {
        timeout: 600000,
      },
    );
    const at = await page.evaluate(() => decodeURIComponent(location.search));
    check(at.includes(`seed=${seed}`) && !/genesis/.test(at), `begun at ${at}`);
    const g = await k<{ ages: { kind: string }[]; acts: State["acts"] }>(
      `globalThis.causalis.client.query({ type: "genesis" })`,
    );
    check(
      cooled < 0 || g.ages[cooled]?.kind === "icehouse",
      "the world begun is not the world remade",
    );
    say(
      `begun at ${at}: its age ${cooled + 1} ${g.ages[cooled]?.kind}, its acts ${JSON.stringify(g.acts)}`,
    );
    await shot("5-begun");
    const t0 = Date.now();
    if (
      await until(
        "the eye going down to the first camp settled",
        async () => (await k<string>(`globalThis.causalis.scale?.() ?? ""`)) === "village",
        slow(90000),
      )
    ) {
      const year = await k<number>(
        `globalThis.causalis.client.advance(0).then((s) => Math.floor(s.t / (365 * 86400)))`,
      );
      say(
        `the first camp settled in year ${year}, gone down to ${((Date.now() - t0) / 1000).toFixed(0)} s after beginning`,
      );
      await page.waitForTimeout(slow(2500));
      await shot("5-first-camp");
    }
  }
}

// 6. On a phone: the telling and the hand's acts within the screen.
{
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  watch(phone);
  await phone.goto(`${base}?universe=earth&seed=${encodeURIComponent(SEED)}&genesis=1`);
  await phone.waitForSelector(".genesis h2", { timeout: 600000 });
  for (let i = 0; i < 3; i++) await next(phone);
  await phone.waitForTimeout(slow(1500));
  const fit = await phone.evaluate(() => {
    const card = document.querySelector(".genesis")!.getBoundingClientRect(),
      bar = document.querySelector(".genesis-bar")!.getBoundingClientRect(),
      acts = [...document.querySelectorAll(".genesis-acts button")].map((b) =>
        b.getBoundingClientRect(),
      );
    return {
      over: document.documentElement.scrollWidth - innerWidth,
      card: [card.left, card.right, card.height],
      bar: [bar.left, bar.right],
      acts: acts.length,
      out: acts.filter((r) => r.left < 0 || r.right > innerWidth + 0.5).length,
      height: innerHeight,
    };
  });
  check(fit.over <= 0, `the page runs ${fit.over}px off a phone's side`);
  check(fit.card[0]! >= 0 && fit.card[1]! <= 390.5, "the telling runs off a phone's side");
  check(fit.card[2]! <= fit.height * 0.5, "the telling covers more than half a phone's screen");
  check(
    fit.acts >= 5 && fit.out === 0,
    `the hand's acts on a phone: ${fit.acts}, ${fit.out} off it`,
  );
  say(
    `on a phone: ${fit.acts} acts, the telling ${Math.round(fit.card[2]!)}px of ${fit.height}px high`,
  );
  await shot("6-phone", phone);
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 24 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 24 gate passes",
);
process.exit(problems.length ? 1 : 0);
