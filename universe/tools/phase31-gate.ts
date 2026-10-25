// node tools/phase31-gate.ts [--ci] [--soft] [--shots dir] — the Phase 31 gate (the world's stage
// and the eye that watches by itself, M167–M168; asked for 2026-10-24: "i should be able to be in
// my game and see the cell stage and every stage like spore i would just watch it emerge and be
// able to pause and influence and all that"), on the built app, the Earth seed begun at its first
// people as the genesis begins it:
//   1. the world's stage beside the date, at every scale: its bands, from its first year;
//   2. 🎬: the eye watches by itself — before any village, the bands' land, or down among them;
//   3. the years on: each first as it comes is filmed where it happened and told under the bar,
//      and the stage chip follows the world on (its villages, its realms, its cities…);
//   4. paused, the take holds; the clock let go, it goes on;
//   5. a drag on the world takes the eye back, and the caption says so;
//   6. on a phone: the stage chip and the caption within the screen.
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
console.log("the Phase 31 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Director = {
  watching: boolean;
  told: string;
  take: { kind: string; words: string } | null;
  filming: boolean;
};
type Stage = {
  id: string;
  icon: string;
  name: string;
  stages: { id: string; year: number | null }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4283, strictPort: false } }),
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
const scale = (p: Page = page) => k<string>(`globalThis.causalis.scale()`, p);
const director = (p: Page = page) =>
  k<Director | null>(`globalThis.causalis.director?.() ?? null`, p);
const stage = (p: Page = page) => k<Stage | null>(`globalThis.causalis.worldStage?.() ?? null`, p);
/** The stage chip as shown: its words, and where it stands. */
const chip = (p: Page = page) =>
  k<{ text: string; left: number; right: number } | null>(
    `(() => { const c = document.querySelector(".panel:not([hidden]) .stat-chip.stage"); if (!c) return null; const r = c.getBoundingClientRect(); return { text: c.textContent ?? "", left: r.left, right: r.right }; })()`,
    p,
  );
const year = () =>
  k<number>(`globalThis.causalis.client.advance(0).then((s) => Math.floor(s.t / (365 * 86400)))`);
const begin = async (p: Page) => {
  await p.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}`);
  await p.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
};

await begin(page);

// 1. The world's stage beside the date: its bands, from its first year.
const first = await until(
  "the world's stage beside the date",
  async () => (await chip())?.text.includes("Bands") ?? false,
  slow(30000),
);
const s0 = await stage();
say(`the stage at year ${await year()}: “${(await chip())?.text ?? ""}” (${s0?.id ?? "none"})`);
check(
  first && s0?.id === "bands",
  `the world begins at its ${s0?.id ?? "no"} stage, not its bands`,
);
await shot("1-stage");

// 2. 🎬: the eye watches by itself — before any village, the bands' land, or down among them.
// (The clock at a month a second first, so no first comes in the moment it is pressed.)
await k(`globalThis.causalis.client.setSpeed(30 * 86400)`);
await page.click(".director-button");
const going = await until(
  "the eye watching by itself",
  async () => {
    const d = await director();
    return !!d?.watching && !!d.take && !d.filming;
  },
  slow(60000),
);
const d1 = await director();
say(`watching: “${d1?.told ?? ""}” — ${d1?.take?.kind ?? "no take"} at the ${await scale()}`);
check(
  going &&
    ["bands", "camp"].includes(d1?.take?.kind ?? "") &&
    ["region", "camp"].includes(await scale()),
  `before any village the eye did not go to the bands (${d1?.take?.kind}, ${await scale()})`,
);
await shot("2-watching");

// 3. The years on: the firsts as they come, filmed where they happened; the stage following.
await k(`globalThis.causalis.client.advance(30 * 365 * 86400)`);
let firsts: string[] = [];
const filmed = await until(
  "a first in the world filmed",
  async () => {
    const d = await director();
    if (d?.take?.kind === "first" && !firsts.includes(d.take.words)) firsts.push(d.take.words);
    return firsts.length >= 2 && !d?.filming;
  },
  slow(120000),
);
const after = await stage(),
  shown = await chip();
say(`firsts filmed: ${firsts.map((f) => `“${f}”`).join(", ")}; now at the ${await scale()}`);
say(
  `the stage at year ${await year()}: “${shown?.text ?? ""}” — ${after?.stages
    .filter((x) => x.year !== null)
    .map((x) => `${x.id} ${x.year}`)
    .join(", ")}`,
);
check(filmed, "the firsts were not filmed as they came");
check(
  firsts.every((f) => /— year \d/.test(f)),
  `a first was told without its year (${firsts.join(" | ")})`,
);
check(
  !!after && after.id !== "bands" && !!shown?.text.includes(after.name),
  `the stage chip did not follow the world on (${after?.id}, “${shown?.text}”)`,
);
await shot("3-first");

// 4. Paused, the take holds; let go, it goes on.
await k(`globalThis.causalis.client.setSpeed(0)`);
await until("the take filmed", async () => !(await director())?.filming, slow(60000));
const held = (await director())?.take?.words ?? "";
await page.waitForTimeout(26000);
const still = (await director())?.take?.words ?? "";
say(`paused: “${held}” then “${still}”`);
check(
  held === still && held !== "",
  `the take moved on while the clock was held (“${held}” → “${still}”)`,
);
await k(`globalThis.causalis.client.setSpeed(30 * 86400)`);
const moved = await until(
  "the next take once the clock goes on",
  async () => ((await director())?.take?.words ?? held) !== held,
  slow(90000),
);
say(`going on: “${(await director())?.take?.words ?? ""}”`);
check(moved, "the eye did not go on once the clock did");

// 5. A drag on the world takes the eye back; the caption says so.
await until("the take filmed", async () => !(await director())?.filming, slow(60000));
await page.mouse.move(700, 450);
await page.mouse.down();
await page.mouse.move(760, 470, { steps: 6 });
await page.mouse.up();
// (The caption read as the eye is taken back: on a busy machine a later read may find it gone.)
let caption = "";
const taken = await until(
  "the eye taken back by a drag",
  async () => {
    const d = await director();
    if (!d || d.watching) return false;
    caption = d.told;
    return true;
  },
  slow(10000),
);
say(`dragged: watching ${(await director())?.watching}; “${caption}”`);
check(taken, "a drag on the world did not take the eye back");
check(/yours/.test(caption), `the caption did not say the eye is the viewer's (“${caption}”)`);
await shot("5-taken");

// 6. On a phone: the stage chip and the caption within the screen.
{
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  watch(phone);
  await begin(phone);
  await until("the stage on a phone", async () => (await chip(phone)) !== null, slow(30000), phone);
  await phone.tap(".director-button");
  await until(
    "the caption on a phone",
    async () => !!(await director(phone))?.told,
    slow(30000),
    phone,
  );
  const c = await chip(phone),
    cap = await k<{ left: number; right: number } | null>(
      `(() => { const e = document.querySelector(".director-caption:not([hidden])"); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: r.right }; })()`,
      phone,
    ),
    off = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  say(
    `on a phone: the stage “${c?.text ?? ""}” at ${Math.round(c?.left ?? -1)}–${Math.round(c?.right ?? -1)} px; the caption at ${Math.round(cap?.left ?? -1)}–${Math.round(cap?.right ?? -1)} px`,
  );
  check(!!c && c.left >= 0 && c.right <= 390, "the stage chip runs off a phone's side");
  check(!!cap && cap.left >= 0 && cap.right <= 390, "the caption runs off a phone's side");
  check(off <= 0, `the page runs ${off}px off a phone's side`);
  await shot("6-phone", phone);
}

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 31 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 31 gate passes",
);
process.exit(problems.length ? 1 : 0);
