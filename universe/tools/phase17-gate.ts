// node tools/phase17-gate.ts [--ci] [--soft] [--shots dir] — the Phase 17 gate (the
// Observatory, asked for 2026-10-23: "life that makes itself ... recognizable ancestry ...
// every scale connected"), done in a real browser on the built app:
//   1. the tree of life from the world's menu: every line of descent charted over the ages,
//      its branches hung from their mothers, a cross where one died out, the dawn folded;
//   2. the first of each kind of body, drawn;
//   3. a lineage's ancestry: the bodies it came of in a row, its line lit in the tree; a tap
//      on a forebear's row opens that forebear's page, its body drawn and named;
//   4. on a phone, the tree fits the screen's width.
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
console.log("the Phase 17 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Model = {
  kind: string;
  tabs: {
    id: string;
    blocks: { type: string; lines?: { ref: string; fate: string; name: string }[] }[];
  }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4271, strictPort: false } }),
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
let page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
watch(page);
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const q = <T>(type: string, args: unknown = {}): Promise<T> =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const text = (sel: string) => page.$eval(sel, (e) => e.textContent ?? "").catch(() => "");
const window_ = () => text(".page-window");
const count = (sel: string) => page.$$eval(sel, (x) => x.length);
const open = async (ref: string, what: string, has: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  return until(what, async () => (await window_()).includes(has), slow(15000));
};
/** The middle of what a selector names on the screen, or null if it is not shown. */
const centre = (sel: string) =>
  k<{ x: number; y: number } | null>(
    `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`,
  );
const press = async (sel: string) => {
  const at = await centre(sel);
  if (!at) {
    problems.push(`${sel} was not there to press`);
    return false;
  }
  await page.mouse.click(at.x, at.y);
  return true;
};
/** How many of the canvases a selector names have something drawn on them. */
const drawn = (sel: string) =>
  page.$$eval(
    sel,
    (canvases) =>
      canvases.filter((c) => {
        const x = (c as HTMLCanvasElement).getContext("2d");
        if (!x || !(c as HTMLCanvasElement).width) return false;
        const d = x.getImageData(
          0,
          0,
          (c as HTMLCanvasElement).width,
          (c as HTMLCanvasElement).height,
        ).data;
        for (let i = 3; i < d.length; i += 16) if (d[i]! > 0) return true;
        return false;
      }).length,
  );
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
/** Whether the page window's body is as wide as its contents (nothing runs off to the side). */
const fits = () =>
  k<boolean>(
    `(() => { const b = document.querySelector(".page-window .phylo"); return !!b && b.scrollWidth <= b.clientWidth + 1; })()`,
  );

await page.goto(`${base}?universe=earth&year=40`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await page.waitForTimeout(1500);

// 1. The tree of life, from the world's menu.
{
  await press(".world-menu button[title='Tree of life']");
  const opened = await until(
    "the tree of life",
    async () => (await window_()).includes("Lines ever"),
    slow(15000),
  );
  const rows = await count(".page-window .phylo-row"),
    branches = await count(".page-window .phylo-branch"),
    crosses = await count(".page-window .phylo-end"),
    fold = await count(".page-window .phylo-mark.at-fold"),
    wide = await fits();
  await k(`document.querySelector(".page-window .phylo")?.scrollIntoView({ block: "start" })`);
  await shot("1-tree");
  say(
    `the tree of life: ${rows} lines charted, ${branches} branches, ${crosses} died out (✝), the dawn ${fold ? "folded" : "not folded"}`,
  );
  check(opened, "the tree of life does not open from the world's menu");
  check(
    rows >= 60 && branches >= rows - 2,
    "the tree's lines are not charted, each hung from its mother",
  );
  check(crosses >= 3, "the lines that died out are not marked");
  check(fold === 1, "the dawn's long ages are not folded");
  check(wide, "the tree runs off the side of its window");
}

// 2. The first of each kind of body, drawn.
{
  const kinds = await open("world:tree#kinds", "the kinds of body", "The first of each kind");
  await page.waitForTimeout(500);
  const cards = await count(".page-window .lineup-card"),
    bodies = await drawn(".page-window .lineup-body");
  await shot("2-kinds");
  say(`kinds of body: ${cards} first of their kind, ${bodies} bodies drawn`);
  check(kinds && cards >= 3 && bodies >= 3, "the first of each kind of body are not drawn");
}

// 3. A lineage's ancestry, and a forebear's page from its row.
{
  const tree = await q<Model>("page", { ref: "world:tree" }),
    lines = tree.tabs[0]!.blocks.find((b) => b.type === "phylo")?.lines ?? [],
    living = lines.filter((l) => l.ref.startsWith("spec:") && l.fate === "lives");
  // (A beast's, whose forebears have bodies to draw: the middle one of them.)
  const beasts: typeof living = [];
  for (const l of living) {
    const m = await q<{
      tabs: { id: string; blocks: { type: string; items?: { body: unknown }[] }[] }[];
    }>("page", { ref: l.ref });
    const up = m.tabs.find((t) => t.id === "ancestry")?.blocks.find((b) => b.type === "lineup");
    if ((up?.items ?? []).filter((i) => i.body).length >= 3) beasts.push(l);
  }
  const pick = beasts[Math.floor(beasts.length / 2)];
  if (!pick) problems.push("no living lineage in the tree");
  else {
    const ancestry = await open(
      `${pick.ref}#ancestry`,
      "a lineage's ancestry",
      "The bodies it came of",
    );
    await page.waitForTimeout(500);
    const cards = await count(".page-window .lineup-card"),
      self = await count(".page-window .lineup-card.self"),
      bodies = await drawn(".page-window .lineup-body"),
      lit = await count(".page-window .phylo-row.lit"),
      own = await count(".page-window .phylo-row.self");
    await shot("3-ancestry");
    await k(`document.querySelector(".page-window .phylo")?.scrollIntoView({ block: "start" })`);
    await shot("3b-ancestry-tree");
    say(
      `${pick.name}: ${cards} in its line-up (${bodies} bodies drawn), ${lit} of its line lit in the tree`,
    );
    check(
      ancestry && self === 1 && cards >= 3 && bodies >= 2,
      "a lineage's forebears are not drawn in a row",
    );
    check(lit >= 4 && own === 1, "a lineage's line is not lit in the tree");
    // Its nearest forebear's row, tapped (its bar, not its name), opens its page.
    const before = await text(".page-window h2");
    await k(
      `(() => { const rows = [...document.querySelectorAll(".page-window .phylo-row.lit:not(.self)")]; rows.at(-1)?.setAttribute("data-gate", "mother"); })()`,
    );
    await press(".page-window .phylo-row[data-gate='mother'] .phylo-track");
    const moved = await until(
      "a forebear's page from its row",
      async () => {
        const now = await text(".page-window h2");
        return now !== before && !!now.trim();
      },
      slow(15000),
    );
    await page.waitForTimeout(500);
    const anatomy = await drawn(".page-window canvas.anatomy"),
      forebear = await text(".page-window h2");
    await shot("4-forebear");
    say(
      `a forebear from its row: ${forebear.trim()} (${anatomy ? "its body drawn" : "no body to draw"})`,
    );
    check(moved, "a tap on a forebear's row does not open its page");
  }
}

// 4. On a phone, the tree fits the screen.
{
  await page.close();
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  watch(page);
  await page.goto(`${base}?universe=earth&year=40`);
  await page.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 900000 },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  const opened = await open("world:tree", "the tree of life on a phone", "Lines ever"),
    rows = await count(".page-window .phylo-row"),
    wide = await fits();
  await k(`document.querySelector(".page-window .phylo")?.scrollIntoView({ block: "start" })`);
  await shot("5-phone");
  say(`on a phone: ${rows} lines, ${wide ? "fitting the screen" : "running off it"}`);
  check(opened && rows >= 60 && wide, "the tree of life does not fit a phone's screen");
}

await browser.close();
await server.close();
const real = errors.filter((e) => !/favicon|ERR_ABORTED/i.test(e));
if (real.length) problems.push(...real.slice(0, 5).map((e) => `the page logged: ${e}`));
console.log();
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("the Phase 17 gate fails");
  process.exit(1);
}
console.log("the Phase 17 gate passes");
