// The shipped app, at phone size in WebKit and Chromium: a real campaign battle's
// exchanges drive its actual casualties, morale and retreat; the save survives a reload.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, webkit, devices } from "playwright";
import type { BattleNear } from "../src/bridge/index.ts";

const live = process.argv.includes("--public"),
  shots = process.argv.includes("--shots")
    ? process.argv[process.argv.indexOf("--shots") + 1]
    : undefined,
  server = live
    ? null
    : await preview({
        root: fileURLToPath(new URL("..", import.meta.url)),
        logLevel: "silent",
        preview: { port: 4491, strictPort: false },
      }),
  base = server?.resolvedUrls!.local[0] ?? "https://luhreally.github.io/Causalis/universe/";
if (shots) mkdirSync(shots, { recursive: true });
try {
  for (const engine of [webkit, chromium]) {
    const browser = await engine.launch(
      engine === chromium && process.platform === "linux"
        ? { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] }
        : {},
    );
    try {
      const context = await browser.newContext({ ...devices["iPhone 15 Plus"] }),
        page = await context.newPage(),
        errors: string[] = [];
      await context.addInitScript(() => localStorage.setItem("causalis.quality", "auto"));
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("crash", () => errors.push("page crashed"));
      await page.goto(base + "?seed=first%20light&year=125&hold&v=cohesion", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForFunction("globalThis.causalis?.drawn()>0", undefined, { timeout: 300000 });
      await page.waitForURL(/load=/);
      const near = (await page.evaluate(async () => {
        const c = (globalThis as any).causalis,
          map = await c.client.query({ type: "wars.map" });
        const battles = map.wars
          .flatMap((w: any) => w.battles)
          .sort((a: any, b: any) => b.fallen - a.fallen);
        for (const b of battles.slice(0, 30)) {
          const n = await c.client.query({ type: "battle.near", args: { event: b.event } });
          if (
            n?.combat?.rout > 55 &&
            n.combat.rout < 125 &&
            n.combat.rout !== 108 &&
            Math.min(n.attacker.fielded, n.defender.fielded) > 60
          )
            return n;
        }
        return null;
      })) as BattleNear | null;
      assert.ok(near?.combat, "a real campaign battle has a combat transcript");
      console.log(
        `${engine.name()}: ${near.title}, rout ${near.combat.rout}s, walls ${near.walls}`,
      );
      const rout = near.combat.rout!,
        broken = near.combat.broken;
      assert.ok(rout !== 108, "this battle is not using the old fixed rout clock");
      await page.evaluate((ref) => (globalThis as any).causalis.open(ref), near.event);
      await page
        .locator(".page-window button.act")
        .filter({ hasText: "Watch the battle" })
        .first()
        .tap();
      await page.waitForFunction(
        "['village','battle'].includes(globalThis.causalis.scale())",
        undefined,
        { timeout: 60000 },
      );
      if ((await page.evaluate(() => (globalThis as any).causalis.scale())) !== "battle")
        await page.locator(".war-view-field").tap();
      await page
        .waitForFunction("globalThis.causalis.scale()==='battle'", undefined, {
          timeout: 60000,
        })
        .catch(async (error) => {
          console.log(
            JSON.stringify({
              engine: engine.name(),
              errors,
              state: await page.evaluate(() => ({
                scale: (globalThis as any).causalis.scale(),
                text: document.body.innerText.slice(-1600),
              })),
            }),
          );
          if (shots) await page.screenshot({ path: `${shots}/failed-${engine.name()}.png` });
          throw error;
        });
      const at = async (s: number) => {
        await page.evaluate((t) => (globalThis as any).causalis.battleAt(t, 0), s);
        await page.waitForFunction(
          (t) => Math.abs((globalThis as any).causalis.battle().s - t) < 0.01,
          s,
        );
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        return page.evaluate(() => (globalThis as any).causalis.battle());
      };
      const before = await at(rout - 0.1);
      assert.ok(
        before.onScreen.every((t: any) => t.act !== "flee"),
        "no scheduled retreat before the actual break",
      );
      assert.ok(
        (await page.locator(".battle-side-morale").allTextContents()).every((t) =>
          /Morale \d+%/.test(t),
        ),
      );
      assert.equal(
        await page.locator(".battle-side-morale").first().isVisible(),
        true,
        "morale is visible on the phone",
      );
      const after = await at(rout + 8);
      assert.equal(after.event, near.event, "the field is the battle selected on its page");
      console.log(
        JSON.stringify({
          engine: engine.name(),
          broken,
          rout,
          won: near.won,
          men: [near.attacker.fielded, near.defender.fielded],
          wounded: [near.attacker.wounded, near.defender.wounded],
          acts: after.onScreen.reduce((a: any, t: any) => {
            const k = t.side + ":" + t.act;
            a[k] = (a[k] ?? 0) + 1;
            return a;
          }, {}),
        }),
      );
      assert.ok(
        after.onScreen.some((t: any) => t.side === broken && t.act === "flee"),
        "the broken side actually retreats",
      );
      assert.ok(
        !after.onScreen.some((t: any) => t.side !== broken && t.act === "flee"),
        "the intact winning side keeps the field",
      );
      assert.ok(
        (await page.locator(".battle-side-morale").allTextContents()).some((t) =>
          t.includes("line broken"),
        ),
      );
      if (shots)
        await page.screenshot({
          path: `${shots}/warfare-${live ? "live" : "local"}-${engine.name()}.png`,
        });
      const end = await at(150);
      assert.deepEqual(end.men.fallen, [near.attacker.fallen, near.defender.fallen]);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      const year = 126 * 365 * 86400;
      await page.evaluate(async (t) => {
        const c = (globalThis as any).causalis;
        await c.client.advance(t);
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
      }, year);
      await page.waitForFunction(
        async (t) =>
          (await (globalThis as any).causalis.client.saves()).some(
            (s: any) => s.name.endsWith(":auto") && s.t >= t,
          ),
        year,
        { timeout: 60000 },
      );
      const hash = await page.evaluate(() =>
        (globalThis as any).causalis.client.query({ type: "hashes" }),
      );
      await page.reload();
      await page.waitForFunction(
        (t) =>
          (globalThis as any).causalis?.client?.status?.t >= t &&
          (globalThis as any).causalis.drawn() > 0,
        year,
        { timeout: 300000 },
      );
      assert.deepEqual(
        await page.evaluate(() => (globalThis as any).causalis.client.query({ type: "hashes" })),
        hash,
      );
      assert.deepEqual(errors, []);
      console.log(
        `${engine.name()}: actual battle breaks at ${rout}s; morale, retreat, casualty totals and phone save/reload agree`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server?.close();
}
