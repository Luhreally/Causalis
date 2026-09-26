// node tools/slice.ts [years] [throttle] — the app's world on a phone-floor proxy:
// Chromium with its CPU slowed (4× by default, about a mid-range phone).
//
// 1. The simulation alone: the world bundled into a blank, slowed tab and run year
//    by year to the given year (300 by default). Every year must take under a
//    second — the world's own pace is a year a second — or the check fails.
// 2. The page: the built app with the simulation in its worker, run as fast as it
//    will go to the same year, reporting how smooth the page stayed. Headless
//    Chromium draws with software GL, so its frame times are an upper bound on a
//    phone's (whose GPU draws), and its throttle slows the page, not the worker.
//
// Run `npm run build` first.
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { chromium } from "playwright";

const [yearsArg = "300", throttleArg = "4"] = process.argv.slice(2);
const years = Number(yearsArg),
  throttle = Number(throttleArg),
  YEAR = 365 * 86_400;
const root = fileURLToPath(new URL("..", import.meta.url));

async function bundle(): Promise<string> {
  const result = await build({
    configFile: false,
    root,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry: "tools/slice-entry.ts", formats: ["iife"], name: "CausalisSlice" },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  for (const out of outputs)
    if ("output" in out)
      for (const chunk of out.output) if (chunk.type === "chunk") return chunk.code;
  throw new Error("the slice bundle produced no code");
}

// CI machines have no GPU: Chromium needs its software GL allowed (as in the app check).
const browser = await chromium.launch(
  process.platform === "linux"
    ? { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] }
    : {},
);
let failed = false;
try {
  // 1. The simulation alone, slowed.
  {
    const page = await browser.newPage(),
      cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    await page.setContent("<!doctype html><title>slice</title>");
    await page.addScriptTag({ content: await bundle() });
    const r = (await page.evaluate(`CausalisSlice.run(${years})`)) as {
      perYear: number[];
      built: number;
    };
    const total = r.perYear.reduce((a, b) => a + b, 0),
      worst = Math.max(...r.perYear),
      at = r.perYear.indexOf(worst) + 1,
      sorted = [...r.perYear].sort((a, b) => a - b),
      p95 = sorted[Math.floor(0.95 * sorted.length)]!;
    console.log(
      `the world at ${throttle}× slower: built in ${r.built.toFixed(0)} ms; ${years} years in ${(total / 1000).toFixed(1)} s — a year takes ${(total / years).toFixed(0)} ms on average, 95th percentile ${p95.toFixed(0)} ms, slowest ${worst.toFixed(0)} ms (year ${at})`,
    );
    if (worst >= 1000) {
      console.log(
        `::error::year ${at} took ${worst.toFixed(0)} ms, over the world's pace of a year a second`,
      );
      failed = true;
    }
    await page.close();
  }
  // 2. The page, with the world in its worker.
  {
    const server = await preview({
      logLevel: "silent",
      preview: { port: 4190, strictPort: false },
    });
    const base = server.resolvedUrls?.local[0];
    if (!base) throw new Error("the preview server did not start");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    await page.goto(base);
    await page.waitForFunction(
      () => ((globalThis as any).causalis?.drawn?.() ?? 0) > 0,
      undefined,
      { timeout: 120_000 },
    );
    await page.evaluate((fast) => {
      const g = globalThis as any;
      g.frames = [];
      let last = performance.now();
      const tick = (now: number) => {
        g.frames.push(now - last);
        last = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      g.causalis.client.setSpeed(fast);
    }, 1000 * YEAR);
    const start = Date.now();
    let year = 0;
    while (year < years && Date.now() - start < 600_000) {
      await new Promise((r) => setTimeout(r, 1000));
      year = (await page.evaluate(() => (globalThis as any).causalis.client.status?.t ?? 0)) / YEAR;
    }
    const frames = (await page.evaluate(() => (globalThis as any).frames as number[]))
        .slice(5)
        .sort((a, b) => a - b),
      pct = (q: number) => frames[Math.min(frames.length - 1, Math.floor(q * frames.length))] ?? 0;
    console.log(
      `the page at ${throttle}× slower, the world in its worker: year ${year.toFixed(0)} in ${((Date.now() - start) / 1000).toFixed(0)} s; frames median ${pct(0.5).toFixed(0)} ms, 95th percentile ${pct(0.95).toFixed(0)} ms, worst ${pct(1).toFixed(0)} ms`,
    );
    if (year < years) {
      console.log(`::error::the page's world did not reach year ${years} in time`);
      failed = true;
    }
    await server.close();
  }
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
