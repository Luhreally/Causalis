// node tools/looks-sheet.ts <out.png> <pictures.json>...: a sheet of the pictures tools/looks-probe.ts wrote (each thing sold, drawn as the
// interface draws it, ui/thumbs.ts), large and at the size a page shows them, each named, to look at by eye. A dev server of this tree on a
// free port; a phone's pixel ratio.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";

const [out = "sheet.png", ...files] = process.argv.slice(2),
  sets = files.map((f) => ({
    title: f.replace(/^.*[\\/]/, "").replace(/\.json$/, ""),
    items: JSON.parse(readFileSync(f, "utf8")) as { name: string; p: unknown }[],
  }));
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await createServer({
    root,
    logLevel: "silent",
    server: { port: 4339, strictPort: false },
  });
await server.listen();
const base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.error(e.message));
await page.goto(`${base}src/ui/thumbs.ts`);
await page.setContent(
  `<html><body style="margin:0;background:#1e1d1a;color:#eee;font:11px system-ui"><div id="s"></div></body></html>`,
);
await page.addScriptTag({
  type: "module",
  content: `
    import { paintThumb } from "/src/ui/thumbs.ts";
    const sets = ${JSON.stringify(sets)};
    const s = document.getElementById("s");
    for (const set of sets) {
      const h = document.createElement("h3"); h.textContent = set.title; h.style.margin = "8px"; s.append(h);
      const grid = document.createElement("div");
      grid.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;padding:0 8px";
      for (const it of set.items) {
        const cell = document.createElement("div");
        cell.style.cssText = "width:128px;text-align:center;background:#2b2a26;padding:4px;border-radius:3px";
        const big = document.createElement("canvas"), small = document.createElement("canvas");
        paintThumb(big, it.p, 84);
        paintThumb(small, it.p, 28);
        const t = document.createElement("div"); t.textContent = it.name;
        cell.append(big, small, t);
        grid.append(cell);
      }
      s.append(grid);
    }
    window.__done = true;
  `,
});
await page.waitForFunction("window.__done === true", undefined, { timeout: 60000 });
await page.screenshot({ path: out, fullPage: true });
console.log(`sheet: ${out}`);
await browser.close();
await server.close();
