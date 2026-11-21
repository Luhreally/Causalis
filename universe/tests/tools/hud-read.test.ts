// The HUD's reading (tools/hud-read.ts), the overlap gate's eyes, in a real page: a row of cards scrolled sideways under its
// own clip, its last cards past the row's edge beside the button that folds it (the people bar on a phone), is no overlap,
// though the cards' boxes run under the button; and a window laid over the row is one. (A naive check, box against box,
// raised the first as an overlap: 2026-11-21.) Skipped where no browser can be launched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hudRead } from "../../tools/hud-read.ts";

const ROW = `
<div id="hud">
  <div class="bar" style="position:fixed;left:0;bottom:0;display:flex;width:430px">
    <div class="row" style="display:flex;overflow-x:auto;width:300px">
      ${[1, 2, 3, 4].map((k) => `<button class="chip" style="flex:none;width:150px;height:60px;margin:0;background:#224;color:#fff;border:0">Card ${k}</button>`).join("")}
    </div>
    <button class="fold" style="flex:none;width:44px;height:44px;margin:0;background:#442;color:#fff;border:0">F</button>
  </div>
</div>`;

const OVER = `<div class="over" style="position:fixed;left:260px;bottom:0;width:120px;height:80px;background:#000;color:#fff">Over</div>`;

async function browser() {
  try {
    const { chromium } = await import("playwright");
    return await chromium.launch();
  } catch {
    return null;
  }
}

test("a scrolled row's cards under its own clip are no overlap; a window laid over the row is", async (t) => {
  const b = await browser();
  if (!b) return t.skip("no browser to read a page in");
  try {
    const p = await b.newPage({ viewport: { width: 430, height: 932 } });
    await p.setContent(`<!doctype html><body style="margin:0">${ROW}</body>`);
    // (The case is a real one: the third card's box runs under the fold button.)
    const naive = await p.evaluate(() => {
      const c = document.querySelectorAll(".chip")[2]!.getBoundingClientRect(),
        f = document.querySelector(".fold")!.getBoundingClientRect();
      return Math.min(c.right, f.right) - Math.max(c.left, f.left);
    });
    assert.ok(naive > 4, `the card's box runs ${naive} px under the button`);
    const clean = (await p.evaluate(hudRead([], 4))) as { overlaps: string[]; covered: string[] };
    assert.deepEqual(clean.overlaps, [], "the scrolled cards are clipped by their row");
    assert.deepEqual(clean.covered, []);
    // A window over the row: an overlap, and the controls it lies on covered.
    await p.setContent(
      `<!doctype html><body style="margin:0">${ROW.replace("</div>\n</div>", `</div>${OVER}</div>`)}</body>`,
    );
    const over = (await p.evaluate(hudRead([], 4))) as { overlaps: string[]; covered: string[] };
    assert.ok(
      over.overlaps.some((o) => /Over/.test(o)),
      `the window over the row is read: ${JSON.stringify(over.overlaps)}`,
    );
    assert.ok(over.covered.length > 0, "and the controls under it covered");
  } finally {
    await b.close();
  }
});
