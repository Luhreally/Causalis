// node tools/phase18-gate.ts [--ci] [--soft] [--shots dir] — the Phase 18 gate (the sky alive,
// asked for 2026-10-23: "worlds lifeless, microbial, complex ... i should see them landing on
// planets tryna socialize and like the different reactions and wars and exchanges"), done in
// a real browser on the built app:
//   1. life elsewhere: another star's world with bodies, its life told, its bodies drawn and
//      a drop of its seas under the glass; its star's page telling each world's life;
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
console.log("the Phase 18 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Model = {
  kind: string;
  tabs: {
    id: string;
    blocks: { type: string; lines?: { ref: string; fate: string; name: string }[] }[];
  }[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4273, strictPort: false } }),
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

// 1. Life elsewhere: a world of another star with bodies, its life told and drawn.
{
  const cluster = await q<{ stars: { ref: string; planets: number }[] }>("galaxy.cluster");
  let found: string | null = null;
  for (const s of cluster.stars.slice(0, 400)) {
    for (let i = 0; i < s.planets && !found; i++) {
      const m = await q<Model>("page", { ref: `${s.ref}/${i}` });
      if (m.tabs.some((t) => t.id === "life" && t.blocks.some((b) => b.type === "lineup")))
        found = `${s.ref}/${i}`;
    }
    if (found) break;
  }
  if (!found) problems.push("no world of another star with bodies near home");
  else {
    const opened = await open(`${found}#life`, "a living world's life", "as its own life grew it");
    await k(
      `document.querySelector(".page-window .drop-glass")?.scrollIntoView({ block: "center" })`,
    );
    await page.waitForTimeout(slow(2500));
    const bodies = await drawn(".page-window .lineup-body"),
      glass = await drawn(".page-window .drop-glass"),
      kinds = await count(".page-window .drop-kind"),
      still = await count(".page-window .lineup-card.still");
    await shot("1-life-elsewhere");
    const star = found.slice(0, found.lastIndexOf("/")),
      told = await open(star, "its star's page", "Its worlds, outward"),
      words = await window_();
    say(
      `life elsewhere: ${found} — ${bodies} bodies drawn (${still} with no page), its drop ${glass ? "drawn" : "not drawn"} with ${kinds} kinds; its star tells ${/lifeless|single cells|bodies|chemistry/.test(words) ? "each world's life" : "nothing of life"}`,
    );
    check(opened && bodies >= 3 && still === bodies, "another world's bodies are not drawn");
    check(glass === 1 && kinds >= 2, "another world's drop is not drawn");
    check(told && /bodies/.test(words), "a star's page does not tell its worlds' life");
  }
}

await browser.close();
await server.close();
const real = errors.filter((e) => !/favicon|ERR_ABORTED/i.test(e));
if (real.length) problems.push(...real.slice(0, 5).map((e) => `the page logged: ${e}`));
console.log();
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("the Phase 18 gate fails");
  process.exit(1);
}
console.log("the Phase 18 gate passes");
