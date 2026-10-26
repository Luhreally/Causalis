// The heat gate (Phase 54 M222): on Earth the ore a land works is the ore within its reach, the very
// answer; on a world of its own chemistry a land's furnace must be hot enough to reduce its ore — an
// open fire, a kiln with metalworking, a bloomery with iron, cooler in thin air — and where its
// hardener's ore is beyond its furnace, its smiths harden copper with the arsenic of its own ore.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE, OPEN, worldOre } from "../../src/rules/index.ts";
import { worldChemistry } from "../../src/gen/index.ts";
import {
  furnaceHeat,
  heatShortfall,
  makePopulationWorld,
  oreWithin,
  oreWorkable,
  oresIn,
  populationContext,
} from "../../src/sim/index.ts";

const ctxOf = (seed: string, prior = OPEN) =>
  populationContext(makePopulationWorld(seedFromText(seed), { prior, start: "spread" }));
const lands = (ctx: ReturnType<typeof ctxOf>) =>
  [...ctx.provinces.all()].map((p) => p.cell).sort((a, b) => a - b);

test("on Earth a land works the ore within its reach: the very answer", () => {
  const ctx = ctxOf("first light", EARTHLIKE);
  for (const cell of lands(ctx).slice(0, 50))
    for (const kind of ["copper", "tin", "iron"])
      assert.equal(oreWorkable(ctx, cell, kind), oreWithin(ctx, cell, kind), `${cell} ${kind}`);
});

test("thin air burns cooler: an open fire 740 °C, a kiln 1,140, a bloomery 1,190", () => {
  const ctx = ctxOf("alien 16"),
    cell = lands(ctx)[0]!;
  assert.equal(worldChemistry(ctx.generated).air, "thin");
  assert.equal(furnaceHeat(ctx, cell), 740);
  assert.equal(furnaceHeat(ctx, cell, "metalworking"), 1140);
  assert.equal(furnaceHeat(ctx, cell, "iron"), 1190);
});

test("copper glance wants more heat than a kiln in thin air gives: a bloomery's works it", () => {
  const ctx = ctxOf("alien 16"),
    chem = worldChemistry(ctx.generated);
  // A land whose only copper within reach is a deposit of copper glance.
  const cell = lands(ctx).find((c) => {
    const o = oreWithin(ctx, c, "copper");
    return (
      o?.lie === "deposit" &&
      o.cell === c &&
      worldOre(chem, "copper", "deposit")?.mineral === "chalcocite" &&
      oreWorkable(ctx, c, "copper", "metalworking") === null
    );
  });
  assert.ok(cell !== undefined, "a land whose only copper is copper glance");
  assert.equal(oreWorkable(ctx, cell!, "copper", "iron")?.lie, "deposit");
  const short = heatShortfall(ctx, cell!, "copper", "metalworking");
  assert.ok(short, "the shortfall told");
  assert.equal(short!.wanted, 1150);
  assert.equal(short!.reached, 1140);
  assert.equal(short!.furnace.id, "kiln");
});

test("nickel beyond a kiln: copper hardened with its own arsenic, and nickel at a bloomery's heat", () => {
  const ctx = ctxOf("alien 106"),
    chem = worldChemistry(ctx.generated);
  assert.equal(chem.hardener, "nickel");
  const cell = lands(ctx).find(
    (c) =>
      oresIn(ctx, c, "tin").length > 0 && oreWorkable(ctx, c, "copper", "metalworking") !== null,
  );
  assert.ok(cell !== undefined, "a land with nickel ore and copper it can work");
  const fallback = oreWorkable(ctx, cell!, "tin", "metalworking"),
    copper = oreWorkable(ctx, cell!, "copper", "metalworking")!;
  assert.equal(fallback?.arsenical, true);
  assert.equal(fallback?.kind, "tin");
  assert.equal(fallback?.grade, copper.grade * 0.5);
  const nickel = oreWorkable(ctx, cell!, "tin", "iron");
  assert.equal(nickel?.arsenical, undefined);
  assert.equal(worldOre(chem, "tin", nickel!.lie)?.mineral, "garnierite");
});

test("the sea floor's vents ask no furnace", () => {
  const ctx = ctxOf("alien 55");
  let vents = 0;
  for (const cell of lands(ctx)) {
    const o = oreWithin(ctx, cell, "copper");
    if (o?.lie !== "vent") continue;
    vents++;
    assert.deepEqual(oreWorkable(ctx, cell, "copper"), o, `vent copper at ${cell}`);
  }
  assert.ok(vents > 0, "a land whose copper is a vent's");
});
