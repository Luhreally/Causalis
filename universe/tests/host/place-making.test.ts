// What a town lives on (town mode, R5): all it holds by its stuff, at each good's unit weight and its parts; what it made
// and used today; its water, fuel and poisons; the vulnerabilities its own readings name; how steady it is. Read only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR } from "../../src/kernel/index.ts";
import { GOODS, GOOD_MATTER } from "../../src/rules/index.ts";
import { HAP, advancePlace, enterPlace, hapIsDeath, placeDigest } from "../../src/host/place.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { stocksSheet } from "../../src/host/placeplan.ts";
import { placeMakingRef, type PlaceInspectMaking } from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

test("what a town lives on: its stuffs by weight, its making, water, fuel, poisons, what it is short of, how steady", (t) => {
  const w = placeWorld(150),
    s = townWhere(w, () => true, { near: 3000, least: 800 }) ?? noTown(t, "of eight hundred");
  if (!s) return;
  const town: string = s.ref,
    place = enterPlace(w, town)!;
  for (let h = 0; h < 20 * 24; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
  }
  const before = placeDigest(place),
    m = placeInspect(w, town, placeMakingRef(town)) as PlaceInspectMaking,
    stocks = stocksSheet(w, place);
  assert.equal(m.kind, "making");
  // (Its stuffs weigh what it holds: each good's units at its unit's weight.)
  const held = stocks.rows.reduce((n, r) => {
      const g = GOODS[r.good];
      return n + (g && GOOD_MATTER[g.id] && r.held > 0 ? r.held * GOOD_MATTER[g.id]!.unitKg : 0);
    }, 0),
    told = m.stuffs.reduce((n, x) => n + x.kg, 0) + m.rest;
  assert.ok(Math.abs(told - held) <= Math.max(5, held * 0.01), `${told} kg told of ${held} held`);
  for (let k = 1; k < m.stuffs.length; k++) assert.ok(m.stuffs[k - 1]!.kg >= m.stuffs[k]!.kg);
  // (Short of food where its own stocks say so.)
  assert.equal(
    m.vulnerable.some((v) => v.name === "Food short"),
    stocks.foodDays < 60,
  );
  // (Its month as its log tells it.)
  let died = 0,
    born = 0;
  for (const x of place.log)
    if (x.t >= place.t - 30 * DAY) {
      if (hapIsDeath(x.what)) died++;
      else if (x.what === HAP.born) born++;
    }
  const month = Object.fromEntries(m.stability)["This month"]!;
  assert.match(month, new RegExp(`^${born} born, ${died} dead`));
  assert.ok(m.water.length > 10 && m.fuel.length >= 1 && m.poisons.length > 10);
  assert.ok(["steady", "strained", "failing"].includes(m.steady));
  t.diagnostic(
    `${Math.round(held)} kg held in ${m.stuffs.length} stuffs told; ${m.making.length} goods made or used today; ${m.vulnerable.map((v) => v.name).join(", ") || "nothing short"}; ${m.steady}`,
  );
  assert.equal(placeDigest(place), before, "read only");
});

test("a town with no water at hand is told so, as what it lives on: its rain and a well it may ask for", (t) => {
  const w = placeWorld(150),
    s =
      townWhere(
        w,
        (place) =>
          (
            placeInspect(w, place.town, placeMakingRef(place.town)) as PlaceInspectMaking
          ).vulnerable.some((v) => v.name === "No water at hand"),
        { near: 100, least: 20 },
      ) ?? noTown(t, "with no water at hand");
  if (!s) return;
  const place = enterPlace(w, s.ref)!,
    m = placeInspect(w, s.ref, placeMakingRef(s.ref)) as PlaceInspectMaking,
    dry = m.vulnerable.find((v) => v.name === "No water at hand")!;
  assert.match(dry.words, /rain/);
  assert.notEqual(m.steady, "steady");
  t.diagnostic(`${place.people.n} people: ${dry.words}`);
});
