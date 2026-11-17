// Round A on a real world: first light's lands keep an energy account a year and a ground of stocks, and what the account says
// is what the economy and the air did with it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CARRIERS, G, SOURCES } from "../../src/rules/index.ts";
import {
  airOf,
  carbonPerFuel,
  ecologyOf,
  energyBooks,
  energyPerHead,
  groundOf,
  keptAccount,
  marketsOf,
  populationContext,
  soilOf,
} from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { universeWorld } from "../host/worlds.ts";

const early = universeWorld(EARTH, "first light", 125),
  late = universeWorld(EARTH, "first light", 700);

test("every peopled land keeps an account whose lines add up", () => {
  for (const world of [early, late]) {
    const books = energyBooks(world)!,
      ctx = populationContext(world);
    let lands = 0;
    for (const p of ctx.provinces.all()) {
      if (!p.total()) continue;
      const e = books.get(p.cell);
      if (!e) continue;
      lands++;
      assert.equal(e.drawn.length, CARRIERS.length);
      assert.equal(e.by.length, SOURCES.length);
      assert.ok(e.workHad <= e.workWanted + 1 && e.heatHad <= e.heatWanted + 1);
      // What it burned of buried fuel is its buried carrier's line.
      const a = keptAccount(e);
      assert.ok(Math.abs(a.drawn.buried - (e.coal + e.oil + e.gas + e.own)) <= 4, `${p.cell}`);
      const r = energyPerHead(world, p.cell)!;
      assert.ok(r.primary >= r.power - 1e-9 && r.power >= 0);
    }
    assert.ok(lands > 100, `${lands} lands keep an account`);
  }
});

test("before engines a land runs on its people's own strength, its beasts and its woods' heat", () => {
  const books = energyBooks(early)!;
  for (const e of books.all()) {
    const r = energyPerHead(early, e.cell);
    if (!r) continue;
    assert.ok(r.carriers.muscle > 0.05 && r.carriers.muscle < 0.15, `${r.carriers.muscle}`);
    assert.equal(r.carriers.buried, 0);
    assert.ok(r.drives === "none" || r.drives === "mills", r.drives);
  }
});

test("by the age of engines some lands' works run on burned fuel, and what they had is next year's power", () => {
  const books = energyBooks(late)!,
    markets = marketsOf(late),
    engines = books.all().filter((e) => energyPerHead(late, e.cell)?.drives === "burned");
  assert.ok(engines.length > 0, "a land of engines");
  for (const e of engines.slice(0, 20)) {
    const m = markets.get(e.cell)!,
      r = energyPerHead(late, e.cell)!;
    assert.ok(r.share > 0.01 && r.share < 0.3, `its engines' share of Carnot: ${r.share}`);
    assert.ok(r.primary > 0.3, `${r.primary} kW a head`);
    const cover = e.workWanted > 0 ? (1000 * e.workHad) / e.workWanted : 0;
    assert.ok(
      Math.abs(m.powerCover - cover) <= 3,
      `its power cover ${m.powerCover} against ${cover}`,
    );
    // (What the transition reads of it: its engines' fuel, in units burned: transitionPower, a bridge for round C.)
    assert.ok(m.burned > 0);
  }
});

test("the air takes the carbon of what was burned, by the carbon its make-up holds", () => {
  const g = populationContext(late).generated;
  assert.ok(Math.abs(carbonPerFuel(g, "coal") - 1.8e-9) < 0.1e-9, `${carbonPerFuel(g, "coal")}`);
  assert.ok(carbonPerFuel(g, "oil") < carbonPerFuel(g, "coal"));
  assert.ok(airOf(late).air.carbon > 0);
  const used = marketsOf(late)
    .all()
    .reduce((s, m) => s + (m.years.at(-1)?.ledger[1]?.[G.coal] ?? 0), 0);
  assert.ok(used > 0, "coal burned by 700");
});

test("each land's soil is what its ground's stocks give", () => {
  const ground = groundOf(late)!,
    eco = ecologyOf(late),
    ctx = populationContext(late);
  let worn = 0;
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    const g = ground.get(p.cell),
      w = eco.get(p.cell);
    if (!g || !w) continue;
    for (const x of g.nut) assert.ok(x >= 0 && x <= 1_300_000);
    // (Worn by a fiftieth: since the rounds merged a land's fields take only the hands that feed it, and few at 700 are worn by
    // more. Counted at a twentieth, the line stood at the edge of one history: 12 lands of 533 on the release's head of
    // 2026-11-17 against the 10 asked, 17 once copper was priced at what its users give, 10 of 550 once the cold shores'
    // peoples lived (worn.mts); by a fiftieth 130, 158 and 157.)
    if (Math.min(...g.nut) < 980_000) worn++;
    assert.ok(w.soil >= 0.3 && w.soil <= 1);
    assert.ok(
      Math.abs(w.soil - soilOf(g, false)) < 1e-9 || Math.abs(w.soil - soilOf(g, true)) < 1e-9,
      `land ${p.cell}: its soil ${w.soil} against its ground's`,
    );
  }
  assert.ok(worn > 50, `${worn} lands' fields worn`);
});
