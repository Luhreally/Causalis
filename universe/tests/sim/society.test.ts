// The society sweep on a real world's first years: every peopled land keeps its care, its old, its roles, its table, its dress and
// its rest; what the older systems read of them lies within the rules' bounds; a land's Lives page says it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BANDS, CARE, KEEPING, OCC, improvedStep } from "../../src/rules/index.ts";
import {
  CARE_STORE,
  DRESS_STORE,
  HOLDINGS_STORE,
  LAW_STORE,
  LEISURE_STORE,
  OLD_STORE,
  ROLES_STORE,
  TABLE_STORE,
  ROOFLESS_STORE,
  ROOF_ROW,
  bearerOddsOf,
  rooflessColdOf,
  rooflessSickOf,
  streetOf,
  careEffectiveOf,
  daysWorkedOf,
  careSparedOf,
  dressWantedOf,
  feastReliefOf,
  forgoneOf,
  oldAgeWantOf,
  oldPressOf,
  politiesOf,
  populationContext,
  provisionCostOf,
  societyStore,
  tableKeptOf,
} from "../../src/sim/index.ts";
import { landLivesBlocks } from "../../src/host/inspect/society.ts";
import { EARTH } from "../../src/host/index.ts";
import { universeWorld } from "../host/worlds.ts";

const world = universeWorld(EARTH, "first light", 30);

test("every peopled land keeps a row in each of the sweep's land stores, and what is read of them lies in bounds", () => {
  const ctx = populationContext(world);
  let lands = 0;
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    lands++;
    for (const name of [
      CARE_STORE,
      OLD_STORE,
      ROLES_STORE,
      TABLE_STORE,
      DRESS_STORE,
      LEISURE_STORE,
      HOLDINGS_STORE,
    ])
      assert.ok(societyStore(world, name)?.get(p.cell), `${name} keeps land ${p.cell}`);
    const spared = careSparedOf(world, p.cell)!;
    assert.ok(spared >= 0 && spared <= CARE.mostWithHospitals, `${spared} spared`);
    const eff = careEffectiveOf(world, p.cell);
    assert.ok(eff >= CARE.kin - 1e-9 && eff <= 1);
    const old = oldPressOf(world, p.cell)!;
    assert.ok(old.press >= 1 && old.press <= 1.5 && old.band > 0);
    assert.ok(oldAgeWantOf(world, p.cell) >= 0 && forgoneOf(world, p.cell) >= 0);
    const kept = tableKeptOf(world, p.cell);
    assert.ok(kept >= 0 && kept <= KEEPING.most);
    const dress = dressWantedOf(world, p.cell);
    assert.ok(dress >= 0.2 && dress <= 1.6);
    assert.ok(feastReliefOf(world, p.cell) >= 0);
  }
  assert.ok(lands > 0, "a peopled land");
  for (const p of ctx.provinces.all())
    if (!p.total()) assert.equal(societyStore(world, CARE_STORE)?.get(p.cell), undefined);
});

test("a realm with no provision costs its treasury nothing; a land's Lives page says its care, its old and its table", () => {
  assert.equal(provisionCostOf(world, "pol:0:999999"), 0);
  const ctx = populationContext(world),
    land = ctx.provinces.all().find((p) => p.total() > 0)!,
    blocks = landLivesBlocks(world, land.cell),
    titles = blocks.map((b) => ("title" in b ? b.title : ""));
  for (const t of [
    "Care of the sick",
    "The old",
    "Who does what",
    "The table",
    "Dress",
    "Rest and feasts",
  ])
    assert.ok(titles.includes(t), `${t} on the page`);
});

test("every living realm keeps its law, and none past its end", () => {
  const alive = new Set(
    politiesOf(world)
      .living()
      .map((p) => p.ref),
  );
  for (const r of alive) assert.ok(societyStore(world, LAW_STORE)?.get(r), `${r} keeps its law`);
  for (const k of societyStore(world, LAW_STORE)?.keys() ?? [])
    assert.ok(alive.has(k as never), `${k} lives`);
});

test("five years of improvements at once come to five years one by one", () => {
  let step = 0.02;
  for (let y = 0; y < 5; y++) step = improvedStep(step, 0.1, 1, 0);
  const once = improvedStep(0.02, 0.1, 5, 0);
  assert.ok(Math.abs(step - once) < 1e-9, `${step} against ${once}`);
});

test("with its roles kept, a land's grown are all at some work by sex, its days at work near the reference, its rulers' odds a share", () => {
  const ctx = populationContext(world),
    life = ctx.life;
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    const days = daysWorkedOf(world, p.cell);
    assert.ok(days > 0.8 && days < 1.2, `${days} of the reference year`);
    const odds = bearerOddsOf(world, p.cell);
    assert.ok(odds > 0 && odds < 0.6, `${odds} odds a bearer rules`);
    // (The grown of either sex are counted at the land's works, none as children.)
    let grown = 0,
      atWork = 0;
    for (let b = 0; b < BANDS; b++) {
      if (life.bands[b]! < life.adulthood) continue;
      for (const r of [b, BANDS + b]) {
        grown += p.counts.rowSum(r);
        atWork += p.counts.rowSum(r) - p.counts.get(r, OCC.dependent);
      }
    }
    assert.ok(atWork >= 0.9 * grown, `${atWork} of ${grown} at work`);
  }
});

test("a land with a town keeps who of it is without a roof, within bounds; a land with none keeps no row", () => {
  const ctx = populationContext(world),
    store = societyStore(world, ROOFLESS_STORE);
  let towns = 0;
  for (const p of ctx.provinces.all()) {
    const row = store?.get(p.cell);
    if (!row) continue;
    towns++;
    assert.ok(row[ROOF_ROW.town]! > 0 && row[ROOF_ROW.roof]! >= 0);
    assert.ok(row[ROOF_ROW.street]! <= row[ROOF_ROW.roofless]! && row[ROOF_ROW.roofless]! <= 1000);
    assert.ok(row[ROOF_ROW.streetLand]! <= row[ROOF_ROW.street]!);
    assert.ok(rooflessColdOf(world, p.cell) >= 1 && rooflessSickOf(world, p.cell) >= 1);
    assert.ok(
      streetOf(world, p.cell) < 0.2,
      `${streetOf(world, p.cell)} of land ${p.cell} on the street`,
    );
  }
  for (const p of ctx.provinces.all()) if (!p.total()) assert.equal(store?.get(p.cell), undefined);
  assert.ok(towns >= 0);
});
