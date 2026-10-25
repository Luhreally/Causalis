// node tools/phase36-gate.ts [--ci] [--soft] [--shots dir] — the Phase 36 gate (the thread back to
// the beginning, M182: THE OBSERVATORY's causal continuity, traced back across the scales), on
// the built app:
//   1. a life's page has its Origins: a thread from their birth back through their town, their
//      land, their people, their line and life's dawn to the world and its galaxy;
//   2. a step tapped opens its own page (the world's);
//   3. on a phone the thread keeps to the page's width;
//   4. on a world the hand made, the thread ends in the hand's making.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps pictures.)
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
console.log("the Phase 36 gate");
if (shots) mkdirSync(shots, { recursive: true });

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4290, strictPort: false } }),
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
const k = <T>(p: Page, code: string): Promise<T> => p.evaluate(code) as Promise<T>;
const until = async (p: Page, what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await p.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (p: Page, name: string) => {
  if (shots) await p.screenshot({ path: join(shots, `${name}.png`) });
};
/** A world begun at a year, held still. */
async function begun(p: Page, universe: string, seed: string, year: number) {
  await p.goto(`${base}?universe=${universe}&seed=${encodeURIComponent(seed)}&year=${year}`);
  await p.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    {
      timeout: 900000,
    },
  );
  await k(p, `globalThis.causalis.client.setSpeed(0)`);
}
/** A page opened at a tab, and its thread's steps once drawn. */
async function origins(p: Page, ref: string) {
  await k(p, `globalThis.causalis.open(${JSON.stringify(`${ref}#origins`)})`);
  await until(
    p,
    `${ref}'s thread`,
    async () => (await p.$$(".page-window .thread-step")).length >= 8,
    slow(30000),
  );
  return p.$$eval(".page-window .thread-step", (steps) =>
    steps.map((s) => ({
      scale: s.querySelector(".thread-scale")?.textContent ?? "",
      when: s.querySelector(".thread-when")?.textContent ?? "",
      line: s.querySelector(".thread-line")?.textContent ?? "",
    })),
  );
}

/** Someone of the world's greatest town, met (a child of the house they are met in, if it has one). */
async function aLife(p: Page) {
  const towns = await k<{ ref: string; cell: number; people: number }[]>(
      p,
      `globalThis.causalis.client.query({ type: "towns.map" })`,
    ),
    town = [...towns].sort((a, b) => b.people - a.people)[0]!,
    hh = await k<{ members: { ref: string; name: string; role: string }[] }>(
      p,
      `globalThis.causalis.client.query({ type: "observe.meet", args: { cell: ${town.cell}, village: ${JSON.stringify(town.ref)} } })`,
    );
  return hh.members.find((m) => m.role === "child") ?? hh.members[0]!;
}

const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
watch(page);

// 1. A life's Origins.
await begun(page, "earth", "first light", 60);
const one = await aLife(page),
  steps = await origins(page, one.ref);
await shot(page, "1-a-life-back-to-the-beginning");
const scales = steps.map((s) => s.scale);
say(`${one.name}'s thread, ${steps.length} steps: ${scales.join(" › ")}`);
for (const s of steps.slice(0, 5)) say(`  ${s.scale} — ${s.when}: ${s.line.slice(0, 110)}`);
say(`  … ${steps.at(-2)?.when}: ${steps.at(-2)?.line}`);
check(
  scales[0] === "A life" && scales[1] === "A town" && scales[2] === "A land",
  "it does not begin at the life, its town, its land",
);
check(scales.includes("A people") && scales.includes("Their line"), "no people nor line on it");
check(scales.filter((s) => s === "Life's dawn").length >= 4, "no dawn on it");
check(
  scales.at(-2) === "The world" && scales.at(-1) === "The galaxy",
  "it does not end at the world and its galaxy",
);
check(
  /first replicators/i.test(steps.map((s) => s.line).join(" ")),
  "the first replicators are not on it",
);

// 2. A step tapped opens its own page: the world's.
await page.click(".page-window .thread-step:has(.thread-scale:text('The world')) .thread-icon");
const opened = await until(
  page,
  "the world's page from its step",
  async () => /The home world/.test((await page.textContent(".page-window .page-title")) ?? ""),
  slow(15000),
);
say(`the world's step tapped: ${opened ? "its page opened" : "nothing"}`);

// 3. On a phone, the thread keeps to the page's width.
const phone = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
watch(phone);
await begun(phone, "earth", "first light", 60);
// (Met again: those met are the world's who met them.)
await origins(phone, (await aLife(phone)).ref);
const fits = await k<boolean>(
  phone,
  `(() => { const t = document.querySelector(".page-window .thread"); return !!t && t.scrollWidth <= t.clientWidth + 1 && t.getBoundingClientRect().right <= innerWidth + 1; })()`,
);
await shot(phone, "3-on-a-phone");
say(`on a phone: ${fits ? "the thread fits" : "the thread runs off the page"}`);
check(fits, "on a phone the thread runs off the page");
await phone.close();

// 4. On a world the hand made, the thread ends in the hand's making.
await begun(page, "alien", "violet hollow ~star red", 0);
const lands = await k<{ cell: number; people: number }[]>(
    page,
    `globalThis.causalis.client.query({ type: "people.map" })`,
  ),
  land = [...lands].sort((a, b) => b.people - a.people)[0]!,
  made = await origins(page, `cell:0:${land.cell}`),
  world = made.find((s) => s.scale === "The world"),
  rose = made.find((s) => s.scale === "A people");
await shot(page, "4-a-made-world");
say(`a made world's land: ${made.length} steps, “${world?.line ?? "no world"}”`);
say(`  ${rose?.line ?? "no people"}`);
check(made[0]?.scale === "A land", "a land's thread does not begin at the land");
check(
  /rose to thought in the (tundra|boreal|steppe|forest|grass|savanna|desert|temperate|tropical)/.test(
    rose?.line ?? "",
  ),
  `their people rose to thought somewhere not land: “${rose?.line}”`,
);
check(
  /made so by your hand: a dim red star/.test(world?.line ?? ""),
  "the hand's making is not on the thread",
);

check(errors.length === 0, `errors: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
console.log(
  problems.length
    ? `\nthe Phase 36 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`
    : "\nthe Phase 36 gate passes",
);
process.exit(problems.length ? 1 : 0);
