import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { preview } from "vite";
import { chromium, webkit } from "playwright";
import type { BrushState, HostClient } from "../src/bridge/index.ts";
declare const causalis: {
  client: HostClient;
  drawn(): number;
  faceSpot(spot: number, distance?: number): void;
  goTo(ref: string): Promise<void>;
  scale(): string;
};
const shots = process.argv.includes("--shots")
  ? process.argv[process.argv.indexOf("--shots") + 1]
  : undefined;
if (shots) mkdirSync(shots, { recursive: true });
const server = await preview({ logLevel: "silent", preview: { port: 4262, strictPort: false } });
try {
  for (const engine of [webkit, chromium]) {
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
      });
      await context.addInitScript(() => localStorage.setItem("causalis.quality", "balanced"));
      const page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(server.resolvedUrls!.local[0] + "?hold&seed=first+light");
      await page.waitForFunction(
        () => typeof causalis !== "undefined" && causalis.drawn() > 0,
        undefined,
        { timeout: 90000 },
      );
      const state = () =>
        page.evaluate(() => causalis.client.query<BrushState>({ type: "brush.state" }));
      const face = await page.evaluate(async () => {
        const people = await causalis.client.query<
          { cell: number; centre: number; people: number }[]
        >({ type: "people.map" });
        const p = [...people].sort((a, b) => b.people - a.people)[0]!;
        causalis.faceSpot(p.centre, 2);
        return p;
      });
      const start = await state(),
        before = await page.evaluate(() => causalis.client.query({ type: "hashes" }));
      await page.locator(".brush-toggle").tap();
      await page.waitForFunction(
        () => document.querySelectorAll(".brush-controls select")[3]!.children.length > 0,
      );
      if (shots)
        await page.screenshot({ path: join(shots, `brushes-before-${engine.name()}.png`) });
      await page.touchscreen.tap(215, 466);
      await page.locator(".brush-undo:visible").waitFor();
      await page.locator(".brush-undo").tap({ force: true });
      assert.equal((await state()).count, start.count);
      assert.deepEqual(
        await page.evaluate(() => causalis.client.query({ type: "hashes" })),
        before,
      );
      // Exercise the OrbitRig handoff with two pointer IDs. Native pinch is covered separately
      // by stability-check; bypass capture validation only for these synthetic events.
      await page.evaluate(() => {
        const canvas = document.querySelector("canvas")!,
          capture = canvas.setPointerCapture;
        canvas.setPointerCapture = () => {};
        try {
          const emit = (type: string, id: number, x: number, y: number) =>
            canvas.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                pointerId: id,
                pointerType: "touch",
                clientX: x,
                clientY: y,
                button: 0,
                buttons: type === "pointerup" ? 0 : 1,
              }),
            );
          emit("pointerdown", 71, 190, 420);
          emit("pointerdown", 72, 240, 420);
          emit("pointermove", 71, 170, 420);
          emit("pointermove", 72, 260, 420);
          emit("pointerup", 71, 170, 420);
          emit("pointerup", 72, 260, 420);
        } finally {
          canvas.setPointerCapture = capture;
        }
      });
      assert.equal((await state()).count, start.count);
      await page.evaluate((spot) => causalis.faceSpot(spot, 2), face.centre);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await page.touchscreen.tap(215, 466);
      await page.waitForFunction(
        async (n) =>
          (await causalis.client.query<BrushState>({ type: "brush.state" })).count === n + 1,
        start.count,
      );
      await page.waitForFunction(
        () => document.querySelector(".brush-status")?.textContent === "Stroke recorded and saved.",
      );
      const saved = await state();
      assert.notEqual(saved.key, start.key);
      assert.ok(saved.strokes.at(-1)!.cells.length > 0);
      if (shots) await page.screenshot({ path: join(shots, `brushes-${engine.name()}.png`) });
      await page.locator(".brush-controls select").first().selectOption("lightning");
      await page.touchscreen.tap(215, 466);
      await page.locator(".brush-apply:visible").waitFor({ timeout: 10000 });
      assert.match(await page.locator(".brush-status").innerText(), /May kill/);
      assert.equal(
        (await state()).count,
        start.count + 1,
        "dangerous strokes wait for confirmation",
      );
      await page.locator(".brush-apply").tap();
      await page.waitForFunction(
        () => document.querySelector(".brush-status")?.textContent === "Stroke recorded and saved.",
      );
      const last = await state();
      await page.reload();
      await page.waitForFunction(
        () => typeof causalis !== "undefined" && causalis.drawn() > 0,
        undefined,
        { timeout: 90000 },
      );
      const restored = await state();
      assert.equal(restored.key, last.key);
      assert.equal(restored.count, start.count + 2);
      assert.ok(new URL(page.url()).searchParams.has("load"));
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(errors, []);
      console.log(
        `${engine.name()}: touch paint, Undo, two-finger cancellation, destructive confirmation and reload recovery pass`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
