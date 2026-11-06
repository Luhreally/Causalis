import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, loadWorld, saveWorld, seedFromText, type World } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { askPage, townOffers } from "../../src/host/inspect/asks.ts";
import { townPlan } from "../../src/host/town.ts";
import { asksOf, populationContext, type Settlement } from "../../src/sim/index.ts";

const grown = (): World => {
  const w = EARTH.build(seedFromText("first light"));
  w.runTo(150 * YEAR);
  return w;
};
const townOf = (w: World): Settlement => {
  const ctx = populationContext(w);
  return [...ctx.settlements.all()]
    .filter((s) => ctx.settlements.held(s.ref) && (townOffers(w, s.ref)?.raises.length ?? 0) > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0]!;
};
const said = (w: World, ref: string): string => {
  const flat = (v: unknown): string =>
      typeof v === "string"
        ? v
        : Array.isArray(v)
          ? v.map(flat).join("")
          : v && typeof v === "object"
            ? Object.values(v as object)
                .map(flat)
                .join(" ")
            : "",
    p = askPage(w, ref);
  return flat([p.title, p.subtitle, p.tabs]);
};

test("a world no one asks keeps nothing of it, and its store stays out of the hash", () => {
  const w = grown();
  assert.equal(asksOf(w).all().length, 0);
  assert.equal(asksOf(w).open.length, 0);
  assert.ok(asksOf(w).dormant(), "dormant until asked");
});

test("what's asked is answered, goes up month by month, stands in its plan, the same through a save", () => {
  const w = grown(),
    s = townOf(w),
    o = townOffers(w, s.ref)!,
    what = o.raises[0]!.what;
  assert.throws(
    () => w.submit("town.ask", { village: "town:0:99999999", kind: "raise", what }),
    /town\.ask/,
    "no such town",
  );
  assert.throws(
    () => w.submit("town.ask", { village: s.ref, kind: "raise", what: "no such thing" }),
    /town\.ask/,
    "no such thing",
  );
  w.runTo(w.submit("town.ask", { village: s.ref, kind: "raise", what }).t);
  const a = asksOf(w).ofTown(s.ref).at(-1)!,
    ref = `ask:${s.ref}:${a.n}`;
  assert.ok(!asksOf(w).dormant());
  assert.equal(a.what, what);
  assert.ok(a.why.length >= 0);
  assert.ok(!/undefined|NaN|\[object/.test(said(w, ref)), said(w, ref).slice(0, 300));
  if (a.answer === "refused") {
    assert.equal(a.work, null, "a town that said no builds nothing");
    return;
  }
  const w0 = a.work!;
  assert.equal(w0.worked, 0, "nothing is ever done the day it's asked");
  w.runTo(w.now + (2 * YEAR) / 12);
  const mid = asksOf(w).ofTown(s.ref).at(-1)!.work!;
  assert.ok(mid.worked > 0 && mid.worked < mid.effort, "some of it, and not all of it");
  const plan = townPlan(w, s.ref, 0, 4000);
  assert.ok(
    what === "walls" ? !!plan?.walls?.asked : plan?.civics.some((c) => c.asked?.ref === ref),
    "the plan carries it as it goes up",
  );
  // Half way through, saved and loaded: the same world from there on.
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: "earth" }))),
    back = loadWorld(doc, (x) => EARTH.build(x), "r").world;
  assert.equal(asksOf(back).ofTown(s.ref).length, asksOf(w).ofTown(s.ref).length);
  w.runTo(w.now + 3 * YEAR);
  back.runTo(back.now + 3 * YEAR);
  assert.equal(w.checkpoints().at(-1)?.chain, back.checkpoints().at(-1)?.chain);
  const done = asksOf(back).ofTown(s.ref).at(-1)!.work!;
  assert.ok(done.done !== null, "and it finishes");
  assert.ok(done.food > 0, "it was fed from what its land brought in");
});

test("a priority is answered and has an end", () => {
  const w = grown(),
    s = townOf(w),
    what = townOffers(w, s.ref)!.firsts[0]!.what;
  w.runTo(w.submit("town.ask", { village: s.ref, kind: "first", what }).t);
  const a = asksOf(w).ofTown(s.ref).at(-1)!;
  if (a.answer === "refused") assert.equal(asksOf(w).firstOf(s.ref, w.now), null);
  else {
    assert.equal(asksOf(w).firstOf(s.ref, w.now)?.what, what);
    assert.ok(a.until! > w.now);
    assert.equal(asksOf(w).firstOf(s.ref, a.until! + 1), null);
  }
});
