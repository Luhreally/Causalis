// node tools/shot.ts <out.png> [query] [width height] [engine] [--resize WxH] [--pixels]
// A screenshot of the built app (npm run build first), for looking at what a change
// did. --resize changes the viewport after load; --pixels reads four pixels from
// inside a rendered frame (antialiasing must be off: add ?tier=phone).
import { preview } from "vite";
import { chromium, firefox, webkit, type Page } from "playwright";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const positional = argv.filter(
  (a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--resize"),
);
const [out, query = "", w = "1280", h = "800", engine = "chromium"] = positional;
if (!out) throw new Error("usage: node tools/shot.ts out.png [query] [width height] [engine]");
const resizeArg = argv.includes("--resize") ? argv[argv.indexOf("--resize") + 1] : undefined;

type App = {
  once(event: string, fn: () => void): void;
  graphicsDevice: { gl: WebGL2RenderingContext };
};

function readPixels(page: Page): Promise<number[] | null> {
  return page.evaluate(
    () =>
      new Promise<number[] | null>((resolve) => {
        const stage = (globalThis as { causalis?: { stage?: { app: App } } }).causalis?.stage;
        if (!stage) return resolve(null);
        stage.app.once("frameend", () => {
          const gl = stage.app.graphicsDevice.gl,
            out: number[] = [];
          for (const [x, y] of [
            [0.5, 0.3],
            [0.5, 0.5],
            [0.25, 0.4],
            [0.75, 0.6],
          ]) {
            const px = new Uint8Array(4),
              bx = Math.floor(gl.drawingBufferWidth * x!),
              by = Math.floor(gl.drawingBufferHeight * y!);
            gl.readPixels(bx, by, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            out.push(...px);
          }
          resolve(out);
        });
      }),
  );
}

const root = fileURLToPath(new URL("..", import.meta.url));
const server = await preview({
  root,
  logLevel: "silent",
  preview: { port: 4180, strictPort: false },
});
const base = server.resolvedUrls!.local[0]!;
// (An object literal straight after await sends prettier 3.9.6 into duplicating the
// file's last line on every pass; name the table first.)
const ENGINES = { chromium, firefox, webkit };
const browser = await ENGINES[engine as keyof typeof ENGINES].launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on("console", (m) => console.log(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`${base}${query}`);
await new Promise((r) => setTimeout(r, 4000));
if (resizeArg) {
  const [rw, rh] = resizeArg.split("x").map(Number);
  await page.setViewportSize({ width: rw!, height: rh! });
  await new Promise((r) => setTimeout(r, 2000));
}
if (argv.includes("--pixels"))
  console.log("pixels at four points", JSON.stringify(await readPixels(page)));
const size = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  return c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null;
});
console.log("canvas", JSON.stringify(size));
await page.screenshot({ path: out });
await browser.close();
await server.close();
