// The enlarged body inspector: actual armor silhouettes, wounds, touch controls and phone layout.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium, webkit } from "playwright";

const shots = process.argv.includes("--shots")
  ? process.argv[process.argv.indexOf("--shots") + 1]
  : undefined;
if (shots) mkdirSync(shots, { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Body inspection check</title>
<style>body{margin:12px;background:#152338;color:#eee;font:14px Verdana}main{max-width:500px;margin:auto}button{font:inherit}</style><main></main>
<script type="module">
import '/src/app/styles.css'; import '/src/app/brushes.css';
import { bodyView } from '/src/ui/body.ts';
import { APE_FRAME, NO_LOOK } from '/src/bridge/index.ts';
const person={kind:'person',ref:'folk:body-fixture',age:32,span:70,occupation:0,child:false,era:'metal',body:null,
look:{...NO_LOOK,lost:['arm-l'],bound:['arm-l']},equipment:{guard:'plate',guardWords:'iron plate armor',arm:'sword',armWords:'iron sword',color:[.62,.67,.72],year:125}};
document.querySelector('main').append(bodyView({type:'body',person,members:APE_FRAME.members.map(member=>({member,words:APE_FRAME.words[member].replace('~','his'),state:member==='arm-l'?'lost':member==='leg-r'?'struck':'whole'}))}));
</script>`;
const server = await createServer({
  base: "/",
  logLevel: "silent",
  server: { port: 4263, strictPort: false },
  plugins: [
    {
      name: "body-fixture",
      configureServer(s) {
        s.middlewares.use("/__body", (_, res) => {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        });
      },
    },
  ],
});
await server.listen();
try {
  for (const engine of [webkit, chromium]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(server.resolvedUrls!.local[0] + "__body");
      const canvas = page.locator(".body-figure");
      await canvas.waitFor();
      await page.waitForFunction(() => document.querySelector("canvas")!.width > 400);
      const pixels = () =>
        canvas.evaluate((c: HTMLCanvasElement) => {
          const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
          let hash = 0,
            ink = 0;
          for (let i = 0; i < data.length; i += 4) {
            hash = (Math.imul(hash, 31) + data[i]! + data[i + 1]!) >>> 0;
            if (data[i + 3]) ink++;
          }
          return { hash, ink };
        });
      const armored = await pixels();
      assert.ok(armored.ink > 10000);
      assert.match(
        await page.locator(".body-equipment").innerText(),
        /iron plate armor.*iron sword/,
      );
      if (shots)
        await page.screenshot({
          path: join(shots, `body-armor-${engine.name()}.png`),
          fullPage: true,
        });
      await page.getByRole("button", { name: "Body & wounds", exact: true }).tap();
      const bare = await pixels();
      assert.notEqual(bare.hash, armored.hash);
      await page.getByRole("button", { name: "Enlarge", exact: true }).tap();
      assert.equal(await canvas.evaluate((c: HTMLCanvasElement) => c.height), 1080);
      await page.locator(".body-turn").fill("90");
      await page.locator(".body-turn").dispatchEvent("input");
      assert.notEqual((await pixels()).hash, bare.hash);
      await page.getByRole("button", { name: "left arm", exact: true }).tap();
      assert.match(await page.locator(".body-part-detail").innerText(), /lost/);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      if (shots)
        await page.screenshot({
          path: join(shots, `body-wounds-${engine.name()}.png`),
          fullPage: true,
        });
      assert.deepEqual(errors, []);
      console.log(
        `${engine.name()}: armor and wound views draw distinct pixels; turn, enlarge and body-part controls work on a phone`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
