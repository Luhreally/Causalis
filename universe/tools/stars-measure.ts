// node tools/stars-measure.ts [--gpu [--uncapped]] [--profile] [--dist dir] [--quality low] [--seed "first light ~sky large"]: what the star map costs a frame, measured
// the same way every time (npm run build first). At a phone's size (430 by 932, three pixels a point) and a desk's (1440 by
// 900), the eye still on the stars as they open: the script's time in a frame (everything run from requestAnimationFrame),
// the draw calls and the instance bytes sent a frame (counted at WebGL itself), and the frames a second. Software GL (the
// default, as CI's browser draws) overstates what filling pixels costs, so the script's time and the draw calls are the measures;
// --gpu draws on this machine's card (--uncapped: as fast as it can, not at the screen's pace). --dist reads another build (one
// not minified, to read a profile by). --profile adds where the script's time goes (the heaviest functions by their own time).
import { preview } from "vite";
import { chromium } from "playwright";

const argv = process.argv.slice(2),
  gpu = argv.includes("--gpu"),
  profile = argv.includes("--profile"),
  uncapped = argv.includes("--uncapped"),
  dist = argv.includes("--dist") ? argv[argv.indexOf("--dist") + 1]! : undefined,
  quality = argv.includes("--quality") ? argv[argv.indexOf("--quality") + 1]! : undefined,
  seed = argv.includes("--seed") ? argv[argv.indexOf("--seed") + 1]! : "first light ~sky large",
  root = new URL("..", import.meta.url),
  server = await preview({
    root: decodeURIComponent(root.pathname).replace(/^\/(\w:)/, "$1"),
    logLevel: "silent",
    ...(dist ? { build: { outDir: dist } } : {}),
    preview: { port: 4347, strictPort: false },
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: gpu
      ? [
          "--enable-gpu",
          "--ignore-gpu-blocklist",
          "--use-angle=d3d11",
          "--force_high_performance_gpu",
          ...(uncapped ? ["--disable-gpu-vsync", "--disable-frame-rate-limit"] : []),
        ]
      : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });

/** Counted in the page from its first script: the time under requestAnimationFrame, and what is asked of WebGL. */
const COUNTERS = `(() => {
  const m = (globalThis.__m = { js: 0, frames: 0, draws: 0, instances: 0, bytes: 0, uploads: 0 });
  const raf = globalThis.requestAnimationFrame.bind(globalThis);
  let inside = false;
  globalThis.requestAnimationFrame = (cb) =>
    raf((t) => {
      if (inside) return cb(t);
      inside = true;
      const t0 = performance.now();
      try {
        cb(t);
      } finally {
        m.js += performance.now() - t0;
        inside = false;
      }
    });
  const tick = () => {
    m.frames++;
    raf(tick);
  };
  raf(tick);
  const P = globalThis.WebGL2RenderingContext?.prototype;
  if (!P) return;
  for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
    const f = P[name];
    P[name] = function (...a) {
      m.draws++;
      if (name.endsWith("Instanced")) m.instances += a[a.length - 1];
      return f.apply(this, a);
    };
  }
  for (const name of ["bufferData", "bufferSubData"]) {
    const f = P[name];
    P[name] = function (...a) {
      const d = name === "bufferData" ? a[1] : a[2];
      if (d && typeof d === "object") {
        m.uploads++;
        m.bytes += a.length >= 5 && a[4] ? a[4] * (d.BYTES_PER_ELEMENT ?? 1) : (d.byteLength ?? 0);
      }
      return f.apply(this, a);
    };
  }
})()`;

type Counts = {
  js: number;
  frames: number;
  draws: number;
  instances: number;
  bytes: number;
  uploads: number;
};
console.log(`the star map of “${seed}”, ${gpu ? "on the card" : "in software GL"}`);
for (const view of [
  { name: "phone 430×932 @3", width: 430, height: 932, dpr: 3, touch: true },
  { name: "desk 1440×900 @1", width: 1440, height: 900, dpr: 1, touch: false },
]) {
  const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: view.dpr,
      hasTouch: view.touch,
      isMobile: view.touch,
    }),
    page = await context.newPage();
  page.setDefaultTimeout(600000);
  await page.addInitScript(COUNTERS);
  await page.goto(`${base}?universe=earth&seed=${encodeURIComponent(seed)}`);
  await page.waitForFunction("(globalThis.causalis?.drawn?.() ?? 0) > 0");
  await page.evaluate("globalThis.causalis.client.setSpeed(0)");
  if (quality) await page.evaluate(`globalThis.causalis.setQuality(${JSON.stringify(quality)})`);
  await page.evaluate("globalThis.causalis.stars()");
  await page.waitForFunction("(globalThis.causalis?.starsDrawn?.()?.stars ?? 0) > 0");
  await page.waitForTimeout(6000);
  const cdp = await context.newCDPSession(page),
    read = () => page.evaluate("({ ...globalThis.__m })") as Promise<Counts>,
    span = async (what: string, during: () => Promise<void>) => {
      const a = await read(),
        t0 = Date.now();
      await during();
      const b = await read(),
        s = (Date.now() - t0) / 1000,
        n = Math.max(1, b.frames - a.frames);
      console.log(
        `  ${view.name}, ${what}: ${((b.js - a.js) / n).toFixed(2)} ms of script a frame, ${((b.draws - a.draws) / n).toFixed(1)} draw calls, ${Math.round((b.instances - a.instances) / n)} instances, ${((b.bytes - a.bytes) / n / 1024).toFixed(1)} KB sent in ${((b.uploads - a.uploads) / n).toFixed(1)} buffers; ${(n / s).toFixed(1)} frames a second (${n} frames)`,
      );
    };
  const stars = await page.evaluate("globalThis.causalis.starsDrawn()");
  console.log(`  ${view.name}: ${JSON.stringify(stars)}`);
  if (profile) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
    await cdp.send("Profiler.start");
  }
  await span("still", () => page.waitForTimeout(8000));
  if (profile) {
    const { profile: p } = (await cdp.send("Profiler.stop")) as {
        profile: {
          nodes: {
            id: number;
            callFrame: { functionName: string; url: string; lineNumber: number };
          }[];
          samples?: number[];
          timeDeltas?: number[];
        };
      },
      own = new Map<number, number>();
    (p.samples ?? []).forEach((id, i) =>
      own.set(id, (own.get(id) ?? 0) + (p.timeDeltas?.[i] ?? 0)),
    );
    const by = new Map<string, number>();
    let all = 0;
    for (const n of p.nodes) {
      const t = own.get(n.id) ?? 0,
        key = `${n.callFrame.functionName || "(anonymous)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`;
      by.set(key, (by.get(key) ?? 0) + t);
      all += t;
    }
    for (const [k, t] of [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22))
      console.log(`      ${((100 * t) / all).toFixed(1)}%  ${k}`);
  }
  // The eye turned about the stars (a drag across the middle), as a hand would.
  await span("turned", async () => {
    const y = view.height / 2,
      x = view.width / 2;
    if (view.touch) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: x - 100, y, id: 1 }],
      });
      for (let i = 0; i < 180; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x - 100 + ((i * 3) % 200), y: y + (i % 40), id: 1 }],
        });
        await page.waitForTimeout(30);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await page.mouse.move(x - 100, y);
      await page.mouse.down();
      for (let i = 0; i < 180; i++) {
        await page.mouse.move(x - 100 + ((i * 3) % 200), y + (i % 40));
        await page.waitForTimeout(30);
      }
      await page.mouse.up();
    }
  });
  await context.close();
}
await browser.close();
await server.close();
process.exit(0);
