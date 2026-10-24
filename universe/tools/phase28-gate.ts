// node tools/phase28-gate.ts [--ci] [--soft] [--shots dir] — the Phase 28 gate (the peopling
// played; asked for 2026-10-24: "i should be able to be in my game and see the cell stage and
// every stage like spore i would just watch it emerge and be able to pause and influence and all
// that"), done in a real browser on the built app, from the Earth seed's beginning:
//   1. the peopling: from the cradle the bands go out over the globe land by land as the clock
//      runs, each land its family of tongues' colour, the families named and told as they are come
//      to, the eye following the front; held, it stands;
//   2. a land tapped: who came to it, and when;
//   3. the hand: the seas lowered — the world remade, the bands going out again from the cradle
//      and coming to more lands, told; a kind age — more of them; bidden to rise elsewhere — not
//      where none could live, but on a green land tapped, the peopling going out from there; the
//      act lifted again;
//   4. the peopling done, told; where to begin, and the world begun carrying the hand's acts;
//   5. on a phone: the telling and the hand within the screen.
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
console.log("the Phase 28 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Reached = { lands: number; people: number; tongues: number; families: number };
type Peopling = {
  front: number;
  reached: Reached;
  all: Reached;
  livable: number;
  cradle: number;
  families: string[];
  labels: number;
  choosing: boolean;
  acts: { seasLow: boolean; age: string | null; cradle: number | null };
  painted: number;
  own: boolean;
  yaw: number;
  pitch: number;
  counts: string;
};
type State = { stage: string; paused: boolean; seed: string; choosing: boolean };

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4280, strictPort: false } }),
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
const peopling = (p: Page = page) => k<Peopling>(`globalThis.causalis.peopling()`, p);
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
const act = async (words: string, p: Page = page) => {
  try {
    await p.click(`.genesis-acts button:has-text("${words}")`, { timeout: slow(8000) });
  } catch {
    problems.push(`no act “${words}” to take`);
  }
};
const told = (p: Page = page) =>
  p.$$eval(".genesis-told p", (x) => x.map((e) => e.textContent ?? ""));
const SEED = "first light";

/** Into the beginning, on to the peopling. */
const toPeopling = async (p: Page) => {
  await p.goto(`${base}?universe=earth&seed=${encodeURIComponent(SEED)}&genesis=1`);
  await p.waitForSelector(".genesis h2", { timeout: 600000 });
  for (let i = 0; i < 14 && (await state(p)).stage !== "peopling"; i++) {
    await p.click(".genesis-row button:not(.link)");
    await p.waitForTimeout(300);
  }
};
/** The world remade from the hand: the seed changed, and the clock let go again. */
const remade = async (from: string, what: string) => {
  await until(
    what,
    async () => {
      const s = await state();
      return s.seed !== from && !(await page.$(".genesis-acts.busy"));
    },
    slow(30000),
  );
};
await toPeopling(page);

// 1. The peopling: from the cradle, land by land; held, it stands.
let begun: Peopling;
{
  check(
    (await state()).stage === "peopling",
    `not come to the peopling (${(await state()).stage})`,
  );
  await page.waitForTimeout(slow(600));
  begun = await peopling();
  say(
    `the cradle: province ${begun.cradle}; ${begun.reached.lands} of ${begun.all.lands} lands reached (${begun.livable} they could live in), ${begun.families.length} families of tongues`,
  );
  check(begun.front < 2, "the bands were out over the land before the peopling began");
  check(begun.all.lands >= 50 && begun.families.length >= 3, "the peopling is too small to watch");
  check(
    /lands they could live in reached/.test(begun.counts),
    `the count is not told (“${begun.counts}”)`,
  );
  check(
    (await told()).some((t) => /in the cradle the first people spoke/.test(t)),
    "the cradle's tongue is not told",
  );
  await shot("1-cradle");
  await speed(3);
  await until(
    "the bands going out",
    async () => (await peopling()).reached.lands >= begun.all.lands * 0.4,
    slow(40000),
  );
  await speed(0);
  const a = await peopling();
  await page.waitForTimeout(slow(1500));
  const b = await peopling();
  say(
    `going out: ${a.reached.lands} lands, ${a.reached.people.toLocaleString("en")} people, ${a.reached.tongues} tongues of ${a.reached.families} families; ${a.labels} named over the globe; the eye ${Math.round(Math.abs(a.yaw - begun.yaw))}° round after them`,
  );
  check(a.reached.families >= 2 && a.labels >= 2, "the families are not named as they are come to");
  check(a.painted > 0, "the globe is not painted with the bands' lands");
  check(
    (await told()).some((t) => /speech grew apart — the first of the \w+ tongues/.test(t)),
    "no family's beginning is told",
  );
  check(
    Math.abs(a.yaw - begun.yaw) + Math.abs(a.pitch - begun.pitch) > 2,
    "the eye did not follow the bands",
  );
  check(b.front === a.front, "held, the peopling did not stand");
  await shot("1-going-out");
}

// 2. A land tapped: who came to it, and when.
{
  const spots = await k<{ cell: number; x: number; y: number }[]>(
    `globalThis.causalis.globeSpots(true, 30)`,
  );
  let words = "";
  for (const s of spots) {
    await page.mouse.click(s.x, s.y);
    await page.waitForTimeout(slow(300));
    words = (await page.textContent(".genesis-count")) ?? "";
    if (/^Here:|^The cradle/.test(words)) break;
  }
  say(`a land tapped: “${words}”`);
  check(
    /^Here: \w+ tongues, their bands come|^The cradle|^The bands have not come/.test(words),
    "a land tapped is not told of",
  );
  await shot("2-a-land");
}

// 3. The hand: the seas lowered; a kind age; bidden to rise elsewhere; lifted again.
{
  const before = await peopling(),
    seed = (await state()).seed;
  await act("Lower the seas");
  await remade(seed, "the world remade with the seas low");
  const low = await peopling(),
    lines = await told();
  say(
    `the seas low: “${(await state()).seed}”, ${low.all.lands} lands (${before.all.lands} before); told “${lines.at(-1)}”`,
  );
  check(low.acts.seasLow, "the act is not laid on the world");
  check(low.all.lands > before.all.lands, "with the seas low the bands came to no more lands");
  check(
    lines.some((t) => /^With the seas low the bands walked over to/.test(t)),
    "what the seas did is not told",
  );
  check(low.front < 2, "the peopling did not go out again from the cradle");
  check(
    /the seas low as they spread/.test((await page.textContent(".genesis-laid")) ?? ""),
    "the hand's line does not name it",
  );
  await speed(3);
  await page.waitForTimeout(slow(3000));
  await speed(0);
  await shot("3-seas-low");

  const s2 = (await state()).seed;
  await act("A kind age");
  await remade(s2, "the world remade in a kind age");
  const kind = await peopling();
  say(
    `a kind age: ${kind.all.people.toLocaleString("en")} people (${low.all.people.toLocaleString("en")} before)`,
  );
  check(
    kind.acts.age === "kind" && kind.all.people > low.all.people * 1.3,
    "a kind age did not number them the more",
  );

  // Bidden to rise elsewhere: not where none could live; on a green land, there.
  await act("Let them rise elsewhere");
  check((await peopling()).choosing, "the hand does not wait for a land to be tapped");
  const bad = await k<{ cell: number; x: number; y: number }[]>(
      `globalThis.causalis.globeSpots(false, 4)`,
    ),
    s3 = (await state()).seed;
  if (bad[0]) {
    await page.mouse.click(bad[0].x, bad[0].y);
    await page.waitForTimeout(slow(500));
    check((await state()).seed === s3, "the people were bidden to rise where none could live");
    check(
      (await told()).some((t) => /^No people could rise there/.test(t)),
      "why they could not rise there is not told",
    );
  }
  const good = await k<{ cell: number; x: number; y: number }[]>(
      `globalThis.causalis.globeSpots(true, 30)`,
    ),
    far = good.find((g) => g.cell !== begun.cradle) ?? good[0];
  check(!!far, "no green land in view to bid them to");
  if (far) {
    await page.mouse.click(far.x, far.y);
    await remade(s3, "the world remade with the people risen elsewhere");
    const risen = await peopling(),
      s4 = (await state()).seed;
    say(
      `bidden to rise on cell ${far.cell}: “${s4}”; the cradle province ${risen.cradle} (was ${kind.cradle}); told “${(await told()).at(-1)}”`,
    );
    check(new RegExp(`~cradle ${far.cell}\\b`).test(s4), "the bidding is not laid on the seed");
    check(risen.acts.cradle === far.cell, "the world remade does not carry where they were bidden");
    check(risen.cradle !== kind.cradle, "the people did not rise elsewhere");
    check(
      (await told()).some((t) => /rose instead in/.test(t)),
      "where they rose is not told",
    );
    await speed(3);
    await page.waitForTimeout(slow(4000));
    await speed(0);
    await shot("3-risen-elsewhere");
    // Lifted: where they first rose.
    await act("Where they first rose");
    await remade(s4, "the bidding lifted");
    const back = await peopling();
    check(
      !/~cradle/.test((await state()).seed) && back.cradle === kind.cradle,
      "the bidding was not lifted",
    );
  }
}

// 4. The peopling done; where to begin; the world begun carries the hand.
{
  await speed(3);
  await until(
    "the peopling done",
    async () =>
      (await told()).some((t) => /every land they could walk to/.test(t)) ||
      (await state()).choosing,
    slow(60000),
  );
  const done = (await told()).find((t) => /every land they could walk to/.test(t));
  say(`done: “${done ?? ""}”`);
  check(!!done, "the peopling's end is not told");
  await until("where to begin", async () => (await state()).choosing, slow(30000));
  const choices = await page.$$(".genesis .choice");
  check(choices.length >= 5, `${choices.length} places to begin`);
  await shot("4-done");
  if (choices.length) {
    await choices[0]!.click();
    await page.waitForFunction(
      () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
      undefined,
      {
        timeout: 600000,
      },
    );
    const at = decodeURIComponent(await page.evaluate(() => location.search));
    say(`begun: ${at}`);
    check(
      /peopling seas low/.test(at) && /peopling kind/.test(at),
      "the world begun does not carry the hand's acts",
    );
  }
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
  await toPeopling(phone);
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
  check(fit.acts >= 4 && fit.within, "the hand's acts are not within a phone's screen");
  await shot("5-phone", phone);
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 28 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 28 gate passes",
);
process.exit(problems.length ? 1 : 0);
