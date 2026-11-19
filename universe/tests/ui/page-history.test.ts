// What has been looked at (asked 2026-11-19): back and forward bring each page as it was left.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PageHistory } from "../../src/ui/page-history.ts";

interface View {
  tab: string;
  scroll: number;
}

test("back and forward bring each page as it was left", () => {
  const h = new PageHistory<View>();
  h.open("pol:1");
  h.open("town:2", { tab: "economy", scroll: 420 });
  h.open("prsn:3", { tab: "buildings", scroll: 300 });
  assert.equal(h.canForward, false);
  // Back from the third, left on its own tab: the second as it was left.
  const second = h.step(-1, { tab: "family", scroll: 260 });
  assert.deepEqual(second, { ref: "town:2", view: { tab: "buildings", scroll: 300 } });
  const first = h.step(-1, second!.view);
  assert.deepEqual(first, { ref: "pol:1", view: { tab: "economy", scroll: 420 } });
  assert.equal(h.canBack, false);
  assert.equal(h.step(-1, first!.view), null);
  // Forward again, and forward: the third as it was left when gone back from.
  assert.deepEqual(h.step(1, first!.view)?.view, { tab: "buildings", scroll: 300 });
  assert.deepEqual(h.step(1, second!.view), {
    ref: "prsn:3",
    view: { tab: "family", scroll: 260 },
  });
  assert.equal(h.step(1), null);
});

test("a page moved on while back at it is kept as it was last left", () => {
  const h = new PageHistory<View>();
  h.open("pol:1");
  h.open("town:2", { tab: "economy", scroll: 420 });
  h.step(-1, { tab: "overview", scroll: 0 });
  // Read further on the first, then forward and back again.
  h.step(1, { tab: "wars", scroll: 900 });
  assert.deepEqual(h.step(-1, { tab: "overview", scroll: 10 })?.view, { tab: "wars", scroll: 900 });
});

test("a new page opened after going back drops what was ahead", () => {
  const h = new PageHistory<View>();
  h.open("a");
  h.open("b", { tab: "x", scroll: 1 });
  h.open("c", { tab: "y", scroll: 2 });
  h.step(-1, { tab: "z", scroll: 3 });
  h.step(-1, { tab: "y", scroll: 2 });
  const { visit, again } = h.open("d", { tab: "x", scroll: 5 });
  assert.equal(again, false);
  assert.equal(visit.view, null);
  assert.equal(h.length, 2);
  assert.equal(h.canForward, false);
  assert.deepEqual(h.step(-1, { tab: "d", scroll: 0 }), {
    ref: "a",
    view: { tab: "x", scroll: 5 },
  });
  assert.deepEqual(h.step(1)?.ref, "d");
});

test("the same page asked again is the same visit, with what was kept of it", () => {
  const h = new PageHistory<View>();
  h.open("a");
  h.keep({ tab: "wars", scroll: 77 });
  const { visit, again } = h.open("a");
  assert.equal(again, true);
  assert.deepEqual(visit.view, { tab: "wars", scroll: 77 });
  assert.equal(h.length, 1);
  // A tab of it asked for is another visit.
  assert.equal(h.open("a#towns").again, false);
  assert.equal(h.length, 2);
});

test("a page still being read keeps what was kept of it before", () => {
  const h = new PageHistory<View>();
  h.open("a");
  h.open("b", { tab: "wars", scroll: 77 });
  h.open("c", { tab: "t", scroll: 5 });
  // Back twice at once: the second press leaves a page not yet drawn, with nothing to keep of it.
  h.step(-1, { tab: "c", scroll: 9 });
  assert.deepEqual(h.step(-1, null), { ref: "a", view: { tab: "wars", scroll: 77 } });
  assert.deepEqual(h.step(1, null)?.view, { tab: "t", scroll: 5 });
});

test("it reaches so far back and no further", () => {
  const h = new PageHistory<View>(3);
  for (const r of ["a", "b", "c", "d"]) h.open(r, { tab: r, scroll: 0 });
  assert.equal(h.length, 3);
  assert.equal(h.current?.ref, "d");
  assert.equal(h.step(-1)?.ref, "c");
  assert.equal(h.step(-1)?.ref, "b");
  assert.equal(h.step(-1), null);
});
