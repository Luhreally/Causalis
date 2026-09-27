// node tools/phase7-gate.ts [--sky-year n] — the Phase 7 gate (docs/architecture §I.7,
// milestone 75): the brief's journey walked end to end at an iPhone's size in WebKit, every
// step answered with its why (tools/journey.ts, in its own process), within the phone's
// budgets:
//   - every scale's first frame within a second on the phone floor, reckoned from this
//     machine's WebKit at a quarter of the phone's time (the floor runs at a quarter of
//     this machine's pace, as `npm run slice` finds): the globe, a land, a village, the
//     star's worlds and the stars around;
//   - the heap held: a world some centuries on, looked at from every scale, keeps its
//     JavaScript heap within the phone's share (Chromium measures it).
// (npm run build first.)
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, webkit, type Page } from "playwright";

const args = process.argv.slice(2),
  at = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined),
  skyYear = at("--sky-year") ?? "1500";
/** The phone floor runs at a quarter of this machine's pace. */
const PHONE = 4,
  /** A scale's first frame on the phone floor, ms; the heap a world may hold, bytes. */
  FIRST_FRAME = 1000,
  HEAP = 250_000_000;

const problems: string[] = [];

// 1. The journey (--no-journey: the budgets alone, while working on them).
const journey = args.includes("--no-journey")
  ? []
  : await new Promise<{ name: string; ok: boolean; saw: string }[]>((done, fail) => {
      const child = fork(
        fileURLToPath(new URL("./journey.ts", import.meta.url)),
        ["--sky-year", skyYear, "--json"],
        { stdio: ["ignore", "pipe", "inherit", "ipc"] },
      );
      let text = "";
      child.stdout!.on("data", (d) => {
        text += d;
        process.stdout.write(d);
      });
      child.on("exit", () => {
        const line = text
          .split("\n")
          .reverse()
          .find((l) => l.startsWith("[{"));
        if (!line) fail(new Error("the journey gave no report"));
        else done(JSON.parse(line) as { name: string; ok: boolean; saw: string }[]);
      });
    });
for (const s of journey.filter((x) => !x.ok))
  problems.push(`the journey's step "${s.name}" was not taken: ${s.saw}`);

// 2. The budgets.
type Exposed = Record<string, (...a: unknown[]) => unknown> & {
  client?: { query<T>(q: { type: string; args?: unknown }): Promise<T> };
};
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4241, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!;
const call = (page: Page, fn: string, ...a: unknown[]) =>
  page.evaluate(
    ([fn, a]) =>
      (
        (globalThis as { causalis?: Exposed }).causalis![fn as string] as (
          ...x: unknown[]
        ) => unknown
      )(...(a as unknown[])),
    [fn, a] as const,
  );
/** How long, in ms, until `ready` holds after `act`. */
async function timed(page: Page, act: () => Promise<unknown>, ready: string): Promise<number> {
  const t0 = Date.now();
  await act();
  await page.waitForFunction(ready, undefined, { timeout: 60000, polling: 16 });
  return Date.now() - t0;
}
const engines = [
  { name: "webkit", launch: () => webkit.launch() },
  { name: "chromium", launch: () => chromium.launch() },
] as const;
for (const engine of engines) {
  const browser = await engine.launch(),
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // (Chromium runs the world in the page, so its heap is the whole of it.)
  await page.goto(`${base}?universe=earth&year=300${engine.name === "chromium" ? "&inline" : ""}`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: Exposed }).causalis?.drawn?.() as number) > 0,
    undefined,
    { timeout: 600000 },
  );
  const map = await page.evaluate(() =>
      (globalThis as { causalis?: Exposed }).causalis!.client!.query<
        { cell: number; people: number }[]
      >({
        type: "people.map",
      }),
    ),
    land = [...map].sort((a, b) => b.people - a.people || a.cell - b.cell)[0]!;
  const village = (
    await page.evaluate(
      (cell) =>
        (globalThis as { causalis?: Exposed }).causalis!.client!.query<{ ref: string }[]>({
          type: "settlements",
          args: { cell },
        }),
      land.cell,
    )
  )[0];
  const frames: [string, number][] = [];
  // As a viewer goes down: a land picked (its inspector opens), a glance, "Look closer".
  const centre = (map as { cell: number; centre?: number }[]).find(
    (m) => m.cell === land.cell,
  )?.centre;
  if (centre !== undefined) await call(page, "select", centre);
  await page.waitForTimeout(800);
  frames.push([
    "a land",
    await timed(
      page,
      () => call(page, "descend", land.cell),
      "(globalThis.causalis?.villages?.() ?? 0) > 0",
    ),
  ]);
  if (village)
    frames.push([
      "a village",
      await timed(
        page,
        () => call(page, "watch", village.ref),
        "(globalThis.causalis?.watching?.() ?? 0) > 0",
      ),
    ]);
  frames.push([
    "the star's worlds",
    await timed(page, () => call(page, "sky"), "(globalThis.causalis?.skyBodies?.() ?? 0) > 0"),
  ]);
  frames.push([
    "the stars around",
    await timed(page, () => call(page, "stars"), "(globalThis.causalis?.starCount?.() ?? 0) > 0"),
  ]);
  console.log(
    `  ${engine.name.padEnd(9)} first frames: ${frames.map(([n, ms]) => `${n} ${ms} ms`).join(", ")} (on the phone floor about ${PHONE}×)`,
  );
  if (engine.name === "webkit")
    for (const [n, ms] of frames)
      if (ms * PHONE > FIRST_FRAME)
        problems.push(
          `${n}'s first frame takes ${ms} ms here, some ${ms * PHONE} ms on the phone floor`,
        );
  if (engine.name === "chromium") {
    const heap = await page.evaluate(
      () =>
        (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          ?.usedJSHeapSize ?? 0,
    );
    console.log(
      `  the heap after a world three centuries on, seen at every scale: ${(heap / 1e6).toFixed(0)} MB`,
    );
    if (heap > HEAP) problems.push(`the heap holds ${(heap / 1e6).toFixed(0)} MB`);
  }
  await browser.close();
}
await server.close();

if (problems.length) {
  console.log(`\nthe Phase 7 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(
  `\nthe Phase 7 gate passes: ${journey.length} steps of the journey, within the phone's budgets`,
);
