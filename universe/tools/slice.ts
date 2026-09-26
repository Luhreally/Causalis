// node tools/slice.ts [years] [throttle] [inline] — the Phase 1 slice on a phone-floor proxy:
// the built app in Chromium with its CPU slowed (4× by default, about a mid-range
// phone), running the world as fast as it will go to the given year (300 by
// default). Reports how many years a second the worker simulates, the slowest
// stretch, and how smooth the page stayed (its frame times), while the globe and
// its panels are live. Run `npm run build` first. Headless Chromium draws with
// software GL here, so its frame times are an upper bound on a real phone's.
// Chromium's throttle slows the page's own thread, not its workers: "inline" runs
// the simulation on that thread too, so its rate is the slowed rate.
import { chromium } from "playwright";
import { preview } from "vite";

const [yearsArg = "300", throttleArg = "4", mode = "worker"] = process.argv.slice(2);
const years = Number(yearsArg),
  throttle = Number(throttleArg),
  YEAR = 365 * 86_400;

const server = await preview({ logLevel: "silent", preview: { port: 4190, strictPort: false } });
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error("the preview server did not start");
// CI machines have no GPU: Chromium needs its software GL allowed (as in the app check).
const browser = await chromium.launch(
  process.platform === "linux"
    ? { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] }
    : {},
);
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.goto(`${base}${mode === "inline" ? "?inline" : ""}`);
  await page.waitForFunction(() => ((globalThis as any).causalis?.drawn?.() ?? 0) > 0, undefined, {
    timeout: 120_000,
  });
  // Frame times from the page itself, and the fastest the world will go.
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
  const start = Date.now(),
    samples: { wall: number; year: number }[] = [];
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    const t = await page.evaluate(() => (globalThis as any).causalis.client.status?.t ?? 0);
    samples.push({ wall: (Date.now() - start) / 1000, year: t / YEAR });
    if (t / YEAR >= years || Date.now() - start > 600_000) break;
  }
  const frames = (await page.evaluate(() => (globalThis as any).frames as number[]))
      .slice(5)
      .sort((a, b) => a - b),
    pct = (q: number) => frames[Math.min(frames.length - 1, Math.floor(q * frames.length))] ?? 0;
  const last = samples.at(-1)!,
    rates = samples
      .slice(1)
      .map((s, i) => (s.year - samples[i]!.year) / (s.wall - samples[i]!.wall)),
    slowest = Math.min(...rates);
  console.log(
    `phone-floor proxy (${throttle}× CPU, ${mode === "inline" ? "simulated on the slowed thread" : "simulated in a worker"}): ${last.year.toFixed(0)} years in ${last.wall.toFixed(0)} s — ${(last.year / last.wall).toFixed(1)} years a second on average, the slowest second ${slowest.toFixed(1)}`,
  );
  console.log(
    `page frames while it ran: median ${pct(0.5).toFixed(0)} ms, 95th percentile ${pct(0.95).toFixed(0)} ms, worst ${pct(1).toFixed(0)} ms (${frames.length} frames)`,
  );
  if (last.year < years) {
    console.log(`::error::the slice did not reach year ${years} in time`);
    process.exitCode = 1;
  }
  // The world's own pace is a year a second: the phone floor must keep up with it everywhere.
  if (slowest < 1) {
    console.log(
      `::error::the slowest second simulated ${slowest.toFixed(2)} years, under the world's pace`,
    );
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await server.close();
}
