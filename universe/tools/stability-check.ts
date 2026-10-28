// npm run build, then node tools/stability-check.ts: checkpoints and touch recovery in
// the built game, at the iPhone 15 Plus's size, in Safari's engine and Chromium.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { preview } from "vite";
import { chromium, webkit } from "playwright";
import type { HostClient } from "../src/bridge/index.ts";

const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  logLevel: "silent",
  preview: { port: 4183, strictPort: false },
});
const base = server.resolvedUrls!.local[0]!;
const YEAR = 365 * 86_400;
const shotsAt = process.argv.includes("--shots")
  ? process.argv[process.argv.indexOf("--shots") + 1]
  : undefined;
if (shotsAt) mkdirSync(shotsAt, { recursive: true });
type Game = {
  client: HostClient;
  quality(): string;
  drawn(): number;
  stage: {
    device: { maxPixelRatio: number; gl: WebGL2RenderingContext };
    app: { once(event: string, fn: () => void): void };
  };
};
declare const causalis: Game;

try {
  for (const engine of [webkit, chromium]) {
    const browser = await engine.launch(
      engine === chromium && process.platform === "linux"
        ? {
            args: [
              "--enable-unsafe-swiftshader",
              "--use-angle=swiftshader",
              "--ignore-gpu-blocklist",
            ],
          }
        : {},
    );
    try {
      const context = await browser.newContext({
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      await context.addInitScript(() => localStorage.setItem("causalis.quality", "auto"));
      const ring = await context.newPage();
      await ring.goto(`${base}?universe=sandbox&tier=phone`);
      await ring.waitForFunction(
        () => typeof causalis !== "undefined" && (causalis.drawn?.() ?? 0) > 0,
      );
      // Draw counts alone missed WebKit's failed multisample resolve. Read the actual
      // picture just rendered: the sandbox's ground must be opaque at its centre.
      const pixel = await ring.evaluate(
        () =>
          new Promise<{ alpha: number; error: number }>((resolve) => {
            causalis.stage.app.once("postrender", () => {
              const gl = causalis.stage.device.gl;
              const rgba = new Uint8Array(4);
              gl.readPixels(
                Math.floor(gl.drawingBufferWidth / 2),
                Math.floor(gl.drawingBufferHeight / 2),
                1,
                1,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                rgba,
              );
              resolve({ alpha: rgba[3]!, error: gl.getError() });
            });
          }),
      );
      assert.equal(pixel.alpha, 255, `${engine.name()}: the world must be visible`);
      assert.equal(pixel.error, 0, `${engine.name()}: no framebuffer or draw error`);
      console.log(
        `${engine.name()}: the phone scene renders opaque pixels without graphics errors`,
      );
      await ring.close();
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("crash", () => errors.push("page crashed"));
      await page.clock.install();
      await page.goto(`${base}?seed=stability&year=2&hold&tier=phone`);
      await page.waitForFunction(
        () => typeof causalis !== "undefined" && (causalis.drawn?.() ?? 0) > 0,
        undefined,
        { timeout: 90_000 },
      );
      await page.waitForURL(/load=/);
      const initial = await page.evaluate(async () => ({
        quality: causalis.quality(),
        pixels: causalis.stage.device.maxPixelRatio,
        saves: await causalis.client.saves(),
      }));
      assert.equal(initial.quality, "balanced");
      assert.equal(initial.pixels, 1.5);
      assert.ok(initial.saves.some((s) => s.name === "earth:stability:auto"));

      await page.evaluate(async (to) => {
        await causalis.client.advance(to);
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
      }, 5 * YEAR);
      await page.waitForFunction(
        async (to) =>
          (await causalis.client.saves()).some((s) => s.name.endsWith(":auto") && s.t >= to),
        5 * YEAR,
      );
      await page.evaluate(() => {
        delete (document as unknown as { hidden?: boolean }).hidden;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.reload();
      await page.waitForFunction((to) => (causalis?.client?.status?.t ?? 0) >= to, 5 * YEAR);
      console.log(`${engine.name()}: background checkpoint and reload retain year 5`);

      // The minute timer, without waiting a real minute or changing the simulation's clock.
      await page.evaluate((to) => causalis.client.advance(to), 6 * YEAR);
      await page.clock.fastForward(60_001);
      await page.waitForFunction(
        async (to) =>
          (await causalis.client.saves()).some((s) => s.name.endsWith(":auto") && s.t >= to),
        6 * YEAR,
      );
      console.log(`${engine.name()}: periodic checkpoint retains year 6`);
      await page.clock.resume();

      // Lifting the last finger of a pinch must not open a land's inspector.
      // Synthetic pointers have no browser-owned capture; exercise their routing directly.
      await page.evaluate(() => {
        document.querySelector<HTMLCanvasElement>("#world")!.setPointerCapture = () => {};
      });
      await page.locator("#world").dispatchEvent("pointerdown", {
        pointerId: 11,
        pointerType: "touch",
        clientX: 180,
        clientY: 450,
        bubbles: true,
      });
      await page.locator("#world").dispatchEvent("pointerdown", {
        pointerId: 12,
        pointerType: "touch",
        clientX: 240,
        clientY: 450,
        bubbles: true,
      });
      for (const [pointerId, clientX] of [
        [11, 180],
        [12, 240],
      ]) {
        await page.locator("#world").dispatchEvent("pointerup", {
          pointerId,
          pointerType: "touch",
          clientX,
          clientY: 450,
          bubbles: true,
        });
      }
      assert.equal(await page.locator(".inspector:visible").count(), 0);
      console.log(`${engine.name()}: a two-finger gesture does not pick a land`);
      await page.touchscreen.tap(215, 466);
      await page.locator(".inspector:visible .fact").first().waitFor();
      console.log(`${engine.name()}: a single touch still picks a land`);

      if (engine === chromium) {
        // A real lost/restored WebGL context: the page and simulation must survive it.
        await page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
          const extension = canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!;
          extension.loseContext();
          setTimeout(() => extension.restoreContext(), 500);
        });
        await page.waitForFunction(() => causalis.quality() === "low");
        await page.waitForFunction(() => causalis.drawn() > 0);
        assert.ok((await page.evaluate(() => causalis.client.status!.t)) >= 6 * YEAR);
        console.log(`${engine.name()}: WebGL context recovers without losing the world`);
      }
      assert.deepEqual(errors, []);
      if (shotsAt) await page.screenshot({ path: join(shotsAt, `stability-${engine.name()}.png`) });

      // A failed explicit load must offer recovery, rather than silently reset the world.
      await page.goto(`${base}?seed=stability&load=missing&hold`);
      await page.locator(".failure").waitFor();
      assert.match(await page.locator(".failure").innerText(), /no readable save/);
      assert.equal(await page.locator(".failure a").textContent(), "Back to saved worlds");
      console.log(`${engine.name()}: missing saves are reported without starting over`);

      // Inline mode uses IndexedDB on the page: abort a real transaction after its request
      // succeeds. The save must reject and the previous checkpoint must remain readable.
      await page.goto(`${base}?seed=stability&load=earth%3Astability%3Aauto&hold&inline`);
      await page.waitForFunction(
        () => typeof causalis !== "undefined" && (causalis.drawn?.() ?? 0) > 0,
      );
      await page.waitForURL(/load=/);
      const aborted = await page.evaluate(async () => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
          const request = put.apply(this, args);
          request.addEventListener("success", () => this.transaction.abort());
          return request;
        };
        let refused = false;
        try {
          await causalis.client.save("interrupted");
        } catch {
          refused = true;
        } finally {
          IDBObjectStore.prototype.put = put;
        }
        const loaded = await causalis.client.load("earth:stability:auto");
        return { refused, t: loaded.t };
      });
      assert.equal(aborted.refused, true);
      assert.ok(aborted.t >= 6 * YEAR);
      console.log(`${engine.name()}: aborted storage writes reject; the previous save still loads`);

      // An unavailable database must be said so without an unhandled rejection or a broken game.
      await page.addInitScript(() => {
        IDBFactory.prototype.open = () => {
          throw new DOMException("storage refused", "SecurityError");
        };
      });
      await page.goto(`${base}?seed=storage-refused&hold&inline`);
      await page.locator(".save-warning:visible").waitFor();
      assert.match(await page.locator(".save-warning").innerText(), /could not be saved/);
      assert.ok(await page.evaluate(() => causalis.drawn() > 0));
      assert.deepEqual(errors, []);
      console.log(`${engine.name()}: refused storage is visible and the game keeps running`);
      await context.close();
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
