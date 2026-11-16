// node tools/memory-gate.ts [--ci] [--soft] [--year n] [--cycles n]: gate 122, what a tab holds (2026-11-15: a small world's tab died in
// desktop Chrome, "Aw, Snap! Out of Memory"; found on the way: every batch of copies rebuilt as the years turned left its matrices in the
// graphics card for good, 900 MB of them by year 1,500). On `gale 376 ~size small`, the world that died, at a phone's size:
//   1. played from its first year at a century a second to year 500 with its checkpoints on: the vertex arrays the engine keeps counted
//      on the way and at the end (they went up by some nine a year; they stand now at what is on the screen);
//   2. kept, and what was kept weighed; then taken up again in place three times and by the page loaded again twice (the `?load=` way),
//      the page's and the host's heaps read after each, garbage collected first;
//   3. a player's round, twice or more: the greatest realms' pages with every tab pressed, the ledger's, a town's; every lens of the globe;
//      down to a land and a town and out to the stars and back; after each round the heaps, the vertex arrays, the graphics memory the
//      engine counts and the page's elements read, and what a round adds after the first held to a little;
//   4. a realm's page left open a minute while the years run at a century a second: the same read again;
//   5. the longest page of the greatest towns', the greatest realms' and the world's own held to a million characters, then left open on
//      its longest tab as the years run, the elements it draws and the nodes alive (collected or not) held to a bound.
// The budgets are for a phone's tab. An iPhone 15 Plus has 6 GB, and by what is told of it (not measured on one here) a tab is put away
// somewhere between one and two gigabytes of all it holds, graphics with it: so the page's and the host's heaps are held to 450 MB
// together, collected, which leaves as much again for what is not yet collected and the rest for the card. They are read after a
// collection because what an engine has not yet collected is its own business; what is still held after one is the app's.
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type CDPSession } from "playwright";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  YEAR_TO = Number(arg("--year") ?? 500),
  CYCLES = Number(arg("--cycles") ?? 2),
  SEED = "gale 376 ~size small",
  YEAR = 365 * 86400,
  SIZE = { width: 430, height: 932 };
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];

/**
 * The budgets (MB after a collection, unless said), some two to three times what the built app measured here at a phone's size on
 * 2026-11-15, which is beside each.
 */
const BUDGET = {
  /** The page's heap and its array buffers: 19 and 28 on the globe, 54 and 57 after a round, 58 and 69 with a page left open. */
  page: 150,
  pageBuffers: 180,
  /** The host's heap, in its worker: 78 at year 500, up to 180 with a world taken up in place over it, 153 at year 1,000. */
  worker: 350,
  /** The two heaps together (at most 238). */
  heaps: 450,
  /**
   * Vertex arrays the engine keeps. Before, 2,069 by year 397 and 13,428 by year 1,506 as the years ran; now 70 at the most as they
   * run and 369 after a round (a town's and a land's batches are kept while the eye is away).
   */
  arraysPlaying: 250,
  arrays: 900,
  /** What a round after the first may add: arrays (1 measured), and MB of the page's heap and buffers together (0 measured). */
  arraysARound: 150,
  pageARound: 30,
  /** The graphics memory the engine counts for itself, MB (textures and buffers: 16 on the globe, 43 after a round, 55 at the most). */
  vram: 200,
  /** The page's elements with every page closed (993). */
  elements: 3000,
  /** A checkpoint at year 500, MB gzipped (1.9). */
  save: 5,
  /**
   * The longest page's characters as JSON (a town's was 2.9 million at year 1,500; the ledger's half a million is now the longest there),
   * the elements on the page with it open on its longest tab (47,852 as it opened, 286,492 as the years ran), and the nodes alive at the
   * most, collected or not (4.57 million).
   */
  pageChars: 1_000_000,
  pageElements: 12_000,
  nodesAlive: 300_000,
};

const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log(`gate 122, what a tab holds: “${SEED}” to year ${YEAR_TO}`);

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4397, strictPort: true } }),
  site = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: [
      "--enable-precise-memory-info",
      ...(soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU),
    ],
  });
const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(120000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("crash", () => errors.push("the page crashed"));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const settle = (ms: number) => page.waitForTimeout(slow(ms));
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(100);
  }
  problems.push(`${what} did not come`);
  return false;
};

// The host's worker is reached through the page's session (its heap is its own, and so is its collector).
type Session = {
  cdp: CDPSession;
  workers: Set<string>;
  toWorker: (id: string, method: string) => Promise<unknown>;
};
async function attach(): Promise<Session> {
  const cdp = await context.newCDPSession(page),
    workers = new Set<string>(),
    waiting = new Map<number, (v: unknown) => void>();
  let next = 1;
  await cdp.send("Performance.enable");
  cdp.on("Target.attachedToTarget", (e) => {
    if (e.targetInfo.type === "worker") workers.add(e.sessionId);
  });
  cdp.on("Target.detachedFromTarget", (e) => workers.delete(e.sessionId));
  cdp.on("Target.receivedMessageFromTarget", (e) => {
    const m = JSON.parse(e.message) as { id?: number; result?: unknown };
    if (m.id !== undefined) {
      waiting.get(m.id)?.(m.result ?? null);
      waiting.delete(m.id);
    }
  });
  await cdp.send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: false,
  });
  const toWorker = (sessionId: string, method: string) =>
    Promise.race([
      new Promise<unknown>((done) => {
        const id = next++;
        waiting.set(id, done);
        void cdp
          .send("Target.sendMessageToTarget", {
            sessionId,
            message: JSON.stringify({ id, method, params: {} }),
          })
          .catch(() => done(null));
      }),
      new Promise<unknown>((done) => setTimeout(() => done(null), slow(30000))),
    ]);
  return { cdp, workers, toWorker };
}
let session = await attach();

type Read = {
  year: number;
  page: number;
  pageBuffers: number;
  worker: number;
  arrays: number;
  vram: number;
  elements: number;
};
const MB = (n: number) => Math.round(n / 1e6);
/** Everything collected, then read. */
async function read(): Promise<Read> {
  const { cdp, workers, toWorker } = session;
  for (let i = 0; i < 2; i++) {
    await cdp.send("HeapProfiler.collectGarbage").catch(() => undefined);
    for (const w of workers) await toWorker(w, "HeapProfiler.collectGarbage");
  }
  const own = (await cdp.send("Runtime.getHeapUsage")) as {
    usedSize: number;
    backingStorageSize?: number;
  };
  let worker = 0;
  for (const w of workers) {
    const h = (await toWorker(w, "Runtime.getHeapUsage")) as { usedSize: number } | null;
    if (h) worker += h.usedSize;
  }
  const seen = await k<{ t: number; arrays: number; vram: number; elements: number }>(`(() => {
    const c = globalThis.causalis, d = c?.stage?.device;
    return {
      t: c?.client?.status?.t ?? 0,
      arrays: d?._vaoMap?.size ?? -1,
      vram: d?._vram ? d._vram.tex + d._vram.vb + d._vram.ib : -1,
      elements: document.getElementsByTagName("*").length,
    };
  })()`);
  return {
    year: Math.floor(seen.t / YEAR),
    page: MB(own.usedSize),
    pageBuffers: MB(own.backingStorageSize ?? 0),
    worker: MB(worker),
    arrays: seen.arrays,
    vram: MB(seen.vram),
    elements: seen.elements,
  };
}
const told = (r: Read) =>
  `year ${r.year}: the page ${r.page} MB and ${r.pageBuffers} MB of buffers, the host ${r.worker} MB, ${r.arrays} vertex arrays, ${r.vram} MB counted on the card, ${r.elements} elements`;
/** A reading held to the budgets. */
function hold(where: string, r: Read, arrays = BUDGET.arrays): Read {
  say(`${where}: ${told(r)}`);
  check(r.page <= BUDGET.page, `${where}: the page's heap is ${r.page} MB (${BUDGET.page})`);
  check(
    r.pageBuffers <= BUDGET.pageBuffers,
    `${where}: the page's buffers are ${r.pageBuffers} MB (${BUDGET.pageBuffers})`,
  );
  check(r.worker > 0, `${where}: the host's heap was not read`);
  check(
    r.worker <= BUDGET.worker,
    `${where}: the host's heap is ${r.worker} MB (${BUDGET.worker})`,
  );
  check(
    r.page + r.worker <= BUDGET.heaps,
    `${where}: the heaps are ${r.page + r.worker} MB together (${BUDGET.heaps})`,
  );
  check(r.arrays >= 0, `${where}: the engine does not tell its vertex arrays`);
  check(r.arrays <= arrays, `${where}: ${r.arrays} vertex arrays are kept (${arrays})`);
  check(r.vram <= BUDGET.vram, `${where}: ${r.vram} MB counted on the card (${BUDGET.vram})`);
  return r;
}
const open = async (search: string) => {
  await page.goto(`${site}${search}`);
  session = await attach();
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(600000) },
  );
};
const base = `?universe=earth&seed=${encodeURIComponent(SEED)}`,
  kept = `earth:${SEED}:auto`,
  fastest = () => k(`globalThis.causalis.client.setSpeed(${100 * YEAR})`).catch(() => undefined),
  stop = () => k("globalThis.causalis.client.setSpeed(0)").catch(() => undefined),
  yearNow = () =>
    k<number>(`Math.floor((globalThis.causalis.client.status?.t ?? 0) / ${YEAR})`).catch(() => 0),
  arraysNow = () => k<number>("globalThis.causalis.stage?.device?._vaoMap?.size ?? -1"),
  scaleNow = () => k<string>("globalThis.causalis.scale()"),
  closePage = () => k("globalThis.causalis.closePage?.()").catch(() => undefined);

// 1. Played from its first year.
const t0 = Date.now();
await open(base);
let most = 0,
  half = -1;
{
  const end = Date.now() + slow(600000);
  while (Date.now() < end) {
    // (A window that waits on the viewer holds the clock: a speed chosen lets it go.)
    await fastest();
    const y = await yearNow(),
      n = await arraysNow();
    most = Math.max(most, n);
    if (half < 0 && y >= YEAR_TO / 2) half = n;
    if (y >= YEAR_TO) break;
    await page.waitForTimeout(1500);
  }
  await stop();
  await settle(1500);
  const y = await yearNow();
  check(y >= YEAR_TO, `the world came only to year ${y} of ${YEAR_TO}`);
  say(
    `played to year ${y} in ${Math.round((Date.now() - t0) / 1000)} s: ${half} vertex arrays kept half way, ${await arraysNow()} at the end, ${most} at the most`,
  );
  check(
    most <= BUDGET.arraysPlaying,
    `${most} vertex arrays were kept as the years ran (${BUDGET.arraysPlaying}): batches rebuilt leave theirs behind`,
  );
  hold("played", await read(), BUDGET.arraysPlaying);
}

// 2. Kept, and taken up again.
{
  const { bytes } = await k<{ bytes: number }>(
    `globalThis.causalis.client.save(${JSON.stringify(kept)})`,
  );
  say(`kept: ${(bytes / 1e6).toFixed(2)} MB`);
  check(
    bytes <= BUDGET.save * 1e6,
    `the checkpoint is ${(bytes / 1e6).toFixed(1)} MB (${BUDGET.save})`,
  );
  for (let i = 1; i <= 3; i++) {
    await k(`globalThis.causalis.client.load(${JSON.stringify(kept)})`);
    hold(`taken up in place, ${i}`, await read(), BUDGET.arraysPlaying);
  }
  for (let i = 1; i <= 2; i++) {
    await open(`${base}&load=${encodeURIComponent(kept)}&hold=1`);
    await settle(2500);
    const r = hold(`loaded again, ${i}`, await read(), BUDGET.arraysPlaying);
    check(r.year >= YEAR_TO - 1, `loaded again: the world stands at year ${r.year}`);
  }
}

// 3. A player's round.
{
  await stop();
  const realms = (
      await k<{ ref: string; people: number }[]>(
        `globalThis.causalis.client.query({ type: "realms.map" })`,
      )
    )
      .sort((a, b) => b.people - a.people)
      .slice(0, 3),
    towns = (
      await k<{ ref: string; cell: number; people: number }[]>(
        `globalThis.causalis.client.query({ type: "towns.map", args: {} })`,
      )
    )
      .sort((a, b) => b.people - a.people)
      .slice(0, 2);
  check(realms.length > 0 && towns.length > 0, "the world has no realm or no town to open");
  /** A page opened and every tab of it pressed: how many. */
  const tabs = async (ref: string) => {
    await closePage();
    await k(`globalThis.causalis.open(${JSON.stringify(ref)})`).catch(() => undefined);
    await until(
      `the page of ${ref}`,
      async () => (await k<string | null>("globalThis.causalis.pageOpen() ?? null")) === ref,
      slow(20000),
    );
    await settle(200);
    const n = await k<number>(`document.querySelectorAll(".page-window .tabs .tab").length`);
    for (let i = 0; i < n; i++) {
      await k(`document.querySelectorAll(".page-window .tabs .tab")[${i}]?.click()`);
      await settle(200);
    }
    await closePage();
    return n;
  };
  const toGlobe = async () => {
    await closePage();
    for (let i = 0; i < 5 && (await scaleNow()) !== "globe"; i++) {
      const sky = ["system", "cluster", "galaxy"].includes(await scaleNow());
      await k(`globalThis.causalis.zoomThrough("${sky ? "in" : "out"}")`).catch(() => undefined);
      await settle(1200);
    }
  };
  const rounds: Read[] = [];
  for (let c = 0; c < CYCLES; c++) {
    let pressed = 0;
    for (const r of realms) pressed += await tabs(r.ref);
    pressed += await tabs("world:ledger");
    pressed += await tabs(towns[0]!.ref);
    const lenses = await k<number>(`document.querySelectorAll(".mapmodes .modes .mode").length`);
    for (let i = 0; i < lenses; i++) {
      await k(`document.querySelectorAll(".mapmodes .modes .mode")[${i}]?.click()`);
      await settle(200);
    }
    await k(`document.querySelectorAll(".mapmodes .modes .mode")[0]?.click()`);
    await closePage();
    // (The same town each round: what a round leaves behind is then the round's, not a new place's.)
    await k(`globalThis.causalis.descend(${towns[0]!.cell})`);
    await until("the land", async () => (await scaleNow()) === "region");
    await settle(1200);
    await k(`globalThis.causalis.goTo(${JSON.stringify(towns[0]!.ref)})`).catch(() => undefined);
    await until("the town", async () => (await scaleNow()) === "village");
    await settle(2000);
    await toGlobe();
    await k(`globalThis.causalis.zoomThrough("out")`).catch(() => undefined);
    await until("the star's worlds", async () => (await scaleNow()) !== "globe", slow(20000));
    await settle(1200);
    await k(`globalThis.causalis.zoomThrough("out")`).catch(() => undefined);
    await settle(1500);
    await toGlobe();
    check((await scaleNow()) === "globe", `round ${c + 1}: not back at the globe`);
    if (c === 0) check(pressed >= 30, `round 1: only ${pressed} tabs were pressed`);
    const r = hold(`round ${c + 1} (${pressed} tabs, ${lenses} lenses)`, await read());
    check(
      r.elements <= BUDGET.elements,
      `round ${c + 1}: ${r.elements} elements with every page closed (${BUDGET.elements})`,
    );
    rounds.push(r);
  }
  for (let c = 1; c < rounds.length; c++) {
    const a = rounds[c - 1]!,
      b = rounds[c]!,
      pageMore = b.page + b.pageBuffers - a.page - a.pageBuffers;
    check(
      b.arrays - a.arrays <= BUDGET.arraysARound,
      `round ${c + 1} left ${b.arrays - a.arrays} more vertex arrays kept (${BUDGET.arraysARound})`,
    );
    check(
      pageMore <= BUDGET.pageARound,
      `round ${c + 1} left ${pageMore} MB more held by the page (${BUDGET.pageARound})`,
    );
  }

  // 4. A page left open as the years run.
  await k(`globalThis.causalis.open(${JSON.stringify(realms[0]!.ref)})`).catch(() => undefined);
  await settle(800);
  const from = await yearNow(),
    end = Date.now() + slow(60000);
  while (Date.now() < end) {
    await fastest();
    await page.waitForTimeout(3000);
  }
  await stop();
  await settle(1000);
  const r = hold("a realm's page left open a minute", await read());
  check(r.year > from, `the years did not run under an open page (year ${r.year})`);
  await closePage();

  // 5. The longest page: of the greatest towns', the greatest realms' and the ledger's, the one of the most words, held to a bound; then
  // left open on its longest tab as the years run (a town's War tab named every one of its fallen: 19,046 lines, and a tab past seven
  // gigabytes in two minutes).
  const longest = await k<{
    ref: string;
    title: string;
    chars: number;
    tab: string;
    tabChars: number;
  }>(`(async () => {
    const c = globalThis.causalis.client,
      towns = (await c.query({ type: "towns.map", args: {} })).sort((a, b) => b.people - a.people).slice(0, 30),
      realms = (await c.query({ type: "realms.map" })).sort((a, b) => b.people - a.people).slice(0, 6);
    let best = null;
    for (const ref of [...towns.map((x) => x.ref), ...realms.map((x) => x.ref), "world:ledger", "world:chronicle"]) {
      const m = await c.query({ type: "page", args: { ref } }), chars = JSON.stringify(m).length;
      if (best && chars <= best.chars) continue;
      const tabs = m.tabs.map((x) => [x.name, JSON.stringify(x).length]).sort((a, b) => b[1] - a[1]);
      best = { ref, title: m.title, chars, tab: tabs[0][0], tabChars: tabs[0][1] };
    }
    return best;
  })()`);
  say(
    `the longest page of 38: ${longest.title}, ${(longest.chars / 1e3).toFixed(0)} thousand characters; its longest tab, ${longest.tab}, ${(longest.tabChars / 1e3).toFixed(0)} thousand`,
  );
  check(
    longest.chars <= BUDGET.pageChars,
    `the page of ${longest.title} is ${(longest.chars / 1e6).toFixed(2)} million characters (${BUDGET.pageChars / 1e6})`,
  );
  await k(`globalThis.causalis.open(${JSON.stringify(longest.ref)})`).catch(() => undefined);
  await until(
    "the longest page",
    async () => (await k<string | null>("globalThis.causalis.pageOpen() ?? null")) === longest.ref,
    slow(20000),
  );
  await settle(500);
  await k(
    `[...document.querySelectorAll(".page-window .tabs .tab")].find((b) => b.textContent.trim() === ${JSON.stringify(longest.tab)})?.click()`,
  );
  await settle(1500);
  let drawn = 0,
    alive = 0;
  const until5 = Date.now() + slow(45000);
  while (Date.now() < until5) {
    await fastest();
    await page.waitForTimeout(2500);
    drawn = Math.max(drawn, await k<number>(`document.getElementsByTagName("*").length`));
    const m = (await session.cdp.send("Performance.getMetrics")) as {
      metrics: { name: string; value: number }[];
    };
    alive = Math.max(alive, m.metrics.find((x) => x.name === "Nodes")?.value ?? 0);
  }
  await stop();
  await settle(1000);
  say(
    `left open on that tab as the years ran: ${drawn} elements on the page at the most, ${alive} nodes alive at the most (collected or not)`,
  );
  check(
    drawn <= BUDGET.pageElements,
    `the page of ${longest.title} drew ${drawn} elements (${BUDGET.pageElements})`,
  );
  check(
    alive <= BUDGET.nodesAlive,
    `${alive} nodes were alive with the page of ${longest.title} open (${BUDGET.nodesAlive})`,
  );
  hold("the longest page left open", await read());
  await closePage();
}

for (const e of errors.slice(0, 5)) say(`ERROR ${e.slice(0, 300)}`);
check(errors.length === 0, `${errors.length} errors on the page`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 122 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 122 passed");
