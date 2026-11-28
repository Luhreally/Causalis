// node tools/line-profile.ts [--body] [--rate 4] [--dpr 3]: Live a Line's frame at the phone's size, CPU throttled, its
// JavaScript profiled: where each frame's time goes (self time by function, the heaviest first), and the frame's p80.
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

const argv = process.argv.slice(2),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  body = argv.includes("--body"),
  rate = Number(arg("--rate") ?? 4),
  dpr = Number(arg("--dpr") ?? 3);
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4448, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: dpr,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
page.setDefaultTimeout(120000);
await page.goto(`${base}?universe=earth&seed=first%20light&hold=1`);
await page.waitForFunction(
  () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
  undefined,
  {
    timeout: 180000,
  },
);
await page.waitForFunction(() => !!(globalThis as any).causalis?.line, undefined, {
  timeout: 180000,
});
await page.waitForTimeout(2000);
await k(
  `localStorage.setItem("causalis-line-guide", JSON.stringify({ welcomed: true, done: [], hidden: true }))`,
);
await k("globalThis.causalis.line.open(null)");
await page.waitForFunction(() => !!(globalThis as any).causalis?.lineMode?.state().on, undefined, {
  timeout: 90000,
});
await page.waitForTimeout(1500);
await k("globalThis.causalis.lineMode.close()");
if (body) {
  await k("globalThis.causalis.lineMode.ripen()");
  await k("globalThis.causalis.lineMode.founders()");
  await page.waitForTimeout(1500);
  await k("globalThis.causalis.lineMode.found(0)");
  await page.waitForTimeout(3000);
  await k("globalThis.causalis.lineMode.close()");
}
console.log(
  "the rail's mutations in a second:",
  await k<string>(
    `new Promise((done) => { const seen = new Map(); const o = new MutationObserver((rs) => { for (const r of rs) { const t = r.target; const key = r.type + " " + (r.attributeName ?? "") + " " + (t.className || t.nodeName) + " " + (r.oldValue ?? "") + " -> " + (t.getAttribute?.("class") ?? ""); seen.set(key, (seen.get(key) ?? 0) + 1); } }); o.observe(document.querySelector(".corner-tools"), { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class"], attributeOldValue: true, characterData: false }); setTimeout(() => { o.disconnect(); done(JSON.stringify([...seen].slice(0, 12))); }, 1000); })`,
  ),
);
const cdp = await context.newCDPSession(page);
await page.keyboard.down("KeyW");
await cdp.send("Emulation.setCPUThrottlingRate", { rate });
await page.waitForTimeout(1000);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
const gaps = (
  await k<number[]>(`new Promise((done) => { const g = []; let last = performance.now();
  const tick = () => { const t = performance.now(); g.push(t - last); last = t; if (g.length < 150) requestAnimationFrame(tick); else done(g); };
  requestAnimationFrame(tick); })`)
).sort((a, b) => a - b);
const { profile } = (await cdp.send("Profiler.stop")) as {
  profile: {
    nodes: {
      id: number;
      callFrame: { functionName: string; url: string; lineNumber: number };
      children?: number[];
    }[];
    samples: number[];
    timeDeltas: number[];
  };
};
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
await page.keyboard.up("KeyW");
const self = new Map<number, number>();
profile.samples.forEach((id, i) =>
  self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)),
);
const byFn = new Map<string, number>();
let total = 0;
for (const n of profile.nodes) {
  const t = (self.get(n.id) ?? 0) / 1000;
  total += t;
  const f = n.callFrame,
    key = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber}`;
  byFn.set(key, (byFn.get(key) ?? 0) + t);
}
console.log(
  `p80 ${gaps[Math.floor(gaps.length * 0.8)]!.toFixed(1)} ms, median ${gaps[75]!.toFixed(1)}; profiled ${total.toFixed(0)} ms over 150 frames`,
);
for (const [key, t] of [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 30))
  console.log(`${t.toFixed(1).padStart(8)} ms  ${(t / 150).toFixed(2).padStart(6)} /frame  ${key}`);
// (Who calls the browser's layout reads: each one's callers, two deep.)
{
  const parent = new Map<number, number>();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const nodeOf = new Map(profile.nodes.map((n) => [n.id, n]));
  const name = (id: number | undefined) => {
    const f = id === undefined ? undefined : nodeOf.get(id)?.callFrame;
    return f ? `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber}` : "-";
  };
  const callers = new Map<string, number>();
  for (const n of profile.nodes) {
    if (!/getBoundingClientRect|querySelectorAll|getClientRects/.test(n.callFrame.functionName))
      continue;
    const p1 = parent.get(n.id),
      p2 = p1 === undefined ? undefined : parent.get(p1),
      p3 = p2 === undefined ? undefined : parent.get(p2),
      key = `${n.callFrame.functionName} <- ${name(p1)} <- ${name(p2)} <- ${name(p3)}`;
    callers.set(key, (callers.get(key) ?? 0) + (self.get(n.id) ?? 0) / 1000);
  }
  for (const [key, t] of [...callers].sort((a, b) => b[1] - a[1]).slice(0, 12))
    console.log(`${t.toFixed(1).padStart(8)} ms  ${key}`);
}
await browser.close();
await server.close();
