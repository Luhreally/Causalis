// The names on a material's page, switched and remembered, on a phone in WebKit and Chromium.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, webkit } from "playwright";
import type { HostClient } from "../src/bridge/index.ts";
declare const causalis: { client: HostClient; drawn?(): number; open(ref: string): Promise<void> };

const shotsAt = process.argv.includes("--shots")
  ? process.argv[process.argv.indexOf("--shots") + 1]
  : undefined;
if (shotsAt) mkdirSync(shotsAt, { recursive: true });
const server = await preview({
  root: fileURLToPath(new URL("..", import.meta.url)),
  logLevel: "silent",
  preview: { port: 4258, strictPort: false },
});
try {
  for (const engine of [webkit, chromium]) {
    const browser = await engine.launch(
      engine === chromium && process.platform === "linux"
        ? { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] }
        : {},
    );
    try {
      const context = await browser.newContext({
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      await context.addInitScript(() => localStorage.setItem("causalis.quality", "balanced"));
      const page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(server.resolvedUrls!.local[0] + "?hold&names=theirs");
      await page.waitForFunction(
        () => typeof causalis !== "undefined" && (causalis.drawn?.() ?? 0) > 0,
        undefined,
        { timeout: 90000 },
      );
      const before = await page.evaluate(() => causalis.client.query({ type: "hashes" }));
      await page.evaluate(() => causalis.open("subst:malachite"));
      const toggle = page.locator(".names-switch:visible"),
        title = page.locator(".page-title:visible");
      await toggle.waitFor();
      await page.waitForFunction(
        () => document.querySelector(".names-switch")?.getAttribute("aria-pressed") === "true",
      );
      const native = await title.innerText();
      assert.notEqual(native.toLowerCase(), "malachite");
      assert.match(await page.locator(".inspector:visible").last().innerText(), /malachite/i);
      if (shotsAt) await page.screenshot({ path: join(shotsAt, `names-${engine.name()}.png`) });
      await toggle.tap();
      await page.waitForFunction(
        () => document.querySelector(".page-title")?.textContent === "Malachite",
      );
      assert.equal(await page.evaluate(() => localStorage.getItem("causalis.names.earth")), "real");
      // Removing the address override tests the remembered switch rather than the address's choice.
      await page.evaluate(() => {
        const u = new URL(location.href);
        u.searchParams.delete("names");
        history.replaceState(null, "", u);
      });
      await page.reload();
      await page.waitForFunction(
        () => typeof causalis !== "undefined" && (causalis.drawn?.() ?? 0) > 0,
      );
      await page.evaluate(() => causalis.open("subst:malachite"));
      await toggle.waitFor();
      assert.equal(await title.innerText(), "Malachite");
      assert.equal(await toggle.getAttribute("aria-pressed"), "false");
      assert.deepEqual(
        await page.evaluate(() => causalis.client.query({ type: "hashes" })),
        before,
      );
      assert.deepEqual(errors, []);
      console.log(
        `${engine.name()}: local material names, chemistry, switch and remembered choice; history unchanged`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
console.log("the Phase 58 gate passes");
