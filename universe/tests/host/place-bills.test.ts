// Town mode, bills and store filters (N10 of the design review's order): a bill says how much of a good the town is to
// hold; a maker whose own good it holds as much of as that turns to the first good billed that it holds less of, as the
// town makes it now, and with none waits at home; "make none" stops a making outright. A store told not to take a good
// is not carried it: what is made of a good its market will not take stays where it was made. The orders are the
// world's (sim/town/managed.ts), kept in its save; a town given none lives as it did.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { RECIPES } from "../../src/rules/index.ts";
import { managedOf, populationContext, townsOf, type Settlement } from "../../src/sim/index.ts";
import {
  ACT,
  WHY,
  enterPlace,
  placeHeld,
  placeMakingAt,
  placeMakings,
  placeStores,
  placesOf,
} from "../../src/host/place.ts";
import { billRows, placeFrame, storeTakes, workSheet } from "../../src/host/placeplan.ts";
import { inspectLot } from "../../src/host/placeinspect.ts";
import { PLACE_UNIVERSE, placeWorld } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name })));
  return loadWorld(doc, (s) => PLACE_UNIVERSE.build(s), "r").world;
};
const order = (w: World, type: string, args: unknown): void => {
  const c = w.submit(type, args);
  w.runTo(c.t);
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
};

/** Watch a place an hour at a time; at each hour, what of each good was made since the last (the day's count runs on). */
const watch = (w: World, town: string, hours: number, made: number[] | null = null): void => {
  for (let k = 0; k < hours; k++) {
    const place = placesOf(w)!.get(town)!,
      was = [...place.madeDay];
    w.runTo(w.now + HOUR);
    placeFrame(w, town, []);
    if (made)
      place.madeDay.forEach((n, g) => {
        made[g]! += n >= was[g]! ? n - was[g]! : n;
      });
  }
};

test("a bill of none stops a making; a bill wanting more takes its makers' hands; kept in the save", () => {
  const w = copy(base()),
    s = near(w, 900),
    place = enterPlace(w, s.ref)!;
  watch(w, s.ref, 2);
  const mk = placeMakings(place).filter((x) => x.makers > 0);
  assert.ok(mk.length, "the town has makers");
  // Before: a working day makes some of it. (The making its makers make the most of, as they make it: one with makers
  // may want for its stuff, and a day of rest makes none; up to three days read.)
  const before = new Array<number>(place.madeDay.length).fill(0);
  let days = 0;
  for (; days < 3 && !mk.some((x) => before[x.good]! > 0); days++) watch(w, s.ref, 24, before);
  const g = mk.reduce((a, b) => (before[b.good]! > before[a.good]! ? b : a)).good;
  assert.ok(before[g]! > 0, `${g} is made in a day`);
  // Make none of it: a day makes none, and its makers wait for want of a bill.
  order(w, "place.bill", { town: s.ref, good: g, until: 0 });
  const none = new Array<number>(place.madeDay.length).fill(0);
  let waiting = 0;
  for (let h = 0; h < 24; h++) {
    watch(w, s.ref, 1, none);
    const p = placesOf(w)!.get(s.ref)!.people;
    for (let i = 0; i < p.n; i++) if (p.why[i] === WHY.billMet && p.act[i] === ACT.wait) waiting++;
  }
  assert.equal(none[g], 0, "none of it is made");
  assert.ok(waiting > 0, "its makers wait at home");
  // The Work sheet tells the bill first; a building where it is made tells it too.
  const rows = workSheet(w, place).bills;
  assert.equal(rows[0]!.good, g);
  assert.equal(rows[0]!.until, 0);
  const at = placeMakingAt(place, g);
  if (at >= 0)
    assert.ok(inspectLot(w, place, place.bldgs.lot[at]!).bills.some((r) => r.good === g));
  // A second good billed to more than is held, made of nothing but its land (stone tools, pottery): its makers' hands
  // turn to it, and more of it is made in a day than before.
  const other = placeMakings(place).find(
    (x) =>
      x.good !== g &&
      RECIPES.some(
        (r, k) => r.output[0] === x.good && (place.matched.kinds >>> k) & 1 && !r.inputs.length,
      ),
  );
  if (other) {
    order(w, "place.bill", {
      town: s.ref,
      good: other.good,
      until: Math.ceil(placeHeld(place, other.good)) + 100000,
    });
    const after = new Array<number>(place.madeDay.length).fill(0);
    watch(w, s.ref, 24, after);
    assert.ok(
      after[other.good]! * days > before[other.good]!,
      "the billed good is made by more hands, a day against a day",
    );
    assert.equal(after[g], 0);
  }
  // Kept in the world's save, and read back the same.
  const twin = copy(w);
  assert.deepEqual(managedOf(twin)!.get(s.ref)!.bills, managedOf(w)!.get(s.ref)!.bills);
  // Let be: its makers at their own making again.
  order(w, "place.bill", { town: s.ref, good: g, until: null });
  if (other) order(w, "place.bill", { town: s.ref, good: other.good, until: null });
  assert.equal(managedOf(w)!.get(s.ref)!.bills, undefined);
  const again = new Array<number>(place.madeDay.length).fill(0);
  watch(w, s.ref, 24, again);
  assert.ok(again[g]! > 0, "made again with no bill");
  assert.ok(billRows(w, place).every((r) => r.until === null));
});

test("what its market will not take stays where it was made", () => {
  const w = copy(base()),
    s = near(w, 900),
    place = enterPlace(w, s.ref)!;
  watch(w, s.ref, 2);
  // A good made at a building of its own, not the market.
  const x = placeMakings(place).find((m) => m.makers > 0 && placeMakingAt(place, m.good) > 0);
  if (!x) return;
  const g = x.good,
    b = placeMakingAt(place, g),
    market = placeStores(place).market;
  order(w, "place.refuse", { town: s.ref, store: 0, good: g, on: true });
  assert.equal(storeTakes(w, place, 0).goods[g]!.takes, false);
  const at0 = place.bldgs.stock[b * place.madeDay.length + g]!;
  let hauled = 0;
  for (let h = 0; h < 36; h++) {
    watch(w, s.ref, 1);
    const p = placesOf(w)!.get(s.ref)!.people;
    for (let i = 0; i < p.n; i++)
      if (
        p.carryGood[i] === g &&
        (p.act[i] === ACT.haul || (p.act[i] === ACT.carry && p.carry[i]! > 0 && p.to[i] === market))
      )
        hauled++;
  }
  assert.equal(hauled, 0, "none of it is carried to the market");
  assert.ok(place.bldgs.stock[b * place.madeDay.length + g]! >= at0, "it lies where it was made");
  // Taken again.
  order(w, "place.refuse", { town: s.ref, store: 0, good: g, on: false });
  assert.equal(managedOf(w)!.get(s.ref)!.refuse, undefined);
});
