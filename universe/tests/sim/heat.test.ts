// The heat gate (Phase 54 M222): on Earth the ore a land works is the ore within its reach, the very
// answer; on a world of its own chemistry a land's furnace must be hot enough to reduce its ore — an
// open fire, a kiln with metalworking, a bloomery with iron, cooler in thin air — and where its
// hardener's ore is beyond its furnace, its smiths harden copper with the arsenic of its own ore.
import { test } from "node:test";
import { keptLife } from "../../src/rules/kinds.ts";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE, OPEN, reductionHeat, worldOre } from "../../src/rules/index.ts";
import { worldChemistry } from "../../src/gen/index.ts";
import {
  furnaceHeat,
  heatShortfall,
  livableFor,
  makePopulationWorld,
  oreWithin,
  oreWorkable,
  oresIn,
  populationContext,
} from "../../src/sim/index.ts";

const ctxOf = (seed: string, prior = OPEN) =>
  populationContext(
    makePopulationWorld(seedFromText(prior === OPEN ? keptLife(seed) : seed), {
      prior,
      start: "spread",
    }),
  );
const lands = (ctx: ReturnType<typeof ctxOf>) =>
  [...ctx.provinces.all()].map((p) => p.cell).sort((a, b) => a - b);

test("on Earth a land works the ore within its reach: the very answer", () => {
  const ctx = ctxOf("first light", EARTHLIKE);
  for (const cell of lands(ctx).slice(0, 50))
    for (const kind of ["copper", "tin", "iron"])
      assert.equal(oreWorkable(ctx, cell, kind), oreWithin(ctx, cell, kind), `${cell} ${kind}`);
});

test("thin air burns cooler: an open fire 690 °C, a kiln 1,090, a bloomery 1,140", () => {
  const ctx = ctxOf("alien 16"),
    cell = lands(ctx)[0]!;
  assert.equal(worldChemistry(ctx.generated).air, "thin");
  assert.equal(furnaceHeat(ctx, cell), 690);
  assert.equal(furnaceHeat(ctx, cell, "metalworking"), 1090);
  assert.equal(furnaceHeat(ctx, cell, "iron"), 1140);
});

/** The lands its people can live in that hold a deposit of a kind of their own, peopled yet or not (lowest first). */
const depositLands = (ctx: ReturnType<typeof ctxOf>, kind: string) =>
  ctx.generated.deposits
    .filter((d) => d.kind === kind && livableFor(ctx, d.cell))
    .map((d) => d.cell)
    .sort((a, b) => a - b)
    .filter((c) => {
      const o = oreWithin(ctx, c, kind);
      return o?.lie === "deposit" && o.cell === c;
    });

// (Since the smelting heats are read from the oxides' free energies, rules/chem-ores.ts reductionHeat, copper glance wants
// the heat its copper runs at, which a kiln in thin air just reaches; it is the open fire that is too cool for it, and the
// hand-blown bloomery that is too cool for this world's iron ore.)
test("copper glance wants more heat than an open fire in thin air gives, and a kiln's is enough", () => {
  const ctx = ctxOf("alien 16"),
    chem = worldChemistry(ctx.generated),
    glance = worldOre(chem, "copper", "deposit")!;
  assert.equal(glance.mineral, "chalcocite");
  // A land whose only copper within reach is a deposit of copper glance.
  const cell = depositLands(ctx, "copper").find((c) => oreWorkable(ctx, c, "copper") === null);
  assert.ok(cell !== undefined, "a land whose only copper is copper glance");
  const short = heatShortfall(ctx, cell!, "copper");
  assert.ok(short, "the shortfall told");
  assert.equal(short!.wanted, reductionHeat(glance));
  assert.equal(short!.reached, 690);
  assert.equal(short!.furnace.id, "fire");
  assert.ok(short!.wanted > 690 && short!.wanted <= 1090, `it wants ${short!.wanted} °C`);
  // With a kiln, 1,090 °C here, the same ore is worked, and nothing is short.
  assert.deepEqual(
    oreWorkable(ctx, cell!, "copper", "metalworking"),
    oreWithin(ctx, cell!, "copper"),
  );
  assert.equal(heatShortfall(ctx, cell!, "copper", "metalworking"), null);
});

test("its iron ore wants more heat than a hand-blown bloomery in thin air gives", () => {
  const ctx = ctxOf("alien 16"),
    ore = worldOre(worldChemistry(ctx.generated), "iron", "deposit")!,
    cell = depositLands(ctx, "iron").find((c) => oreWorkable(ctx, c, "iron", "iron") === null);
  assert.ok(cell !== undefined, "a land whose iron is past its bloomery");
  const bloom = heatShortfall(ctx, cell!, "iron", "iron");
  assert.ok(bloom, "the shortfall told");
  assert.equal(bloom!.wanted, reductionHeat(ore));
  assert.equal(bloom!.reached, 1140);
  assert.equal(bloom!.furnace.id, "bloomery");
  // (Thin air's want alone: the same bloomery under Earth's air would reach it.)
  assert.ok(
    bloom!.wanted > 1140 && bloom!.wanted <= bloom!.furnace.heat,
    `it wants ${bloom!.wanted} °C`,
  );
});

// (Garnierite, like every ore that must be rid of a running slag, wants 1,177 °C: past a kiln in thin air, within one
// under an air like Earth's.)
test("nickel beyond a kiln: copper hardened with its own arsenic, and nickel at a blast furnace's heat", () => {
  const ctx = ctxOf("alien 41"),
    chem = worldChemistry(ctx.generated);
  assert.equal(chem.hardener, "nickel");
  assert.equal(chem.air, "thin");
  const cell = lands(ctx).find(
    (c) =>
      oresIn(ctx, c, "tin").length > 0 && oreWorkable(ctx, c, "copper", "metalworking") !== null,
  );
  assert.ok(cell !== undefined, "a land with nickel ore and copper it can work");
  const nickelOre = worldOre(chem, "tin", oresIn(ctx, cell!, "tin")[0]!.lie)!;
  assert.equal(nickelOre.mineral, "garnierite");
  assert.ok(reductionHeat(nickelOre) > furnaceHeat(ctx, cell!, "iron"), "past a bloomery here");
  const copper = oreWorkable(ctx, cell!, "copper", "metalworking")!;
  for (const bringing of ["metalworking", "iron"]) {
    const fallback = oreWorkable(ctx, cell!, "tin", bringing);
    assert.equal(fallback?.arsenical, true, bringing);
    assert.equal(fallback?.kind, "tin");
    assert.equal(fallback?.grade, copper.grade * 0.5);
  }
  const nickel = oreWorkable(ctx, cell!, "tin", "steel");
  assert.ok(furnaceHeat(ctx, cell!, "steel") >= reductionHeat(nickelOre));
  assert.equal(nickel?.arsenical, undefined);
  assert.equal(worldOre(chem, "tin", nickel!.lie)?.mineral, "garnierite");
});

test("under an air like Earth's a kiln reaches nickel, and no copper is roasted for its arsenic", () => {
  const ctx = ctxOf("alien 106"),
    chem = worldChemistry(ctx.generated);
  assert.equal(chem.hardener, "nickel");
  assert.notEqual(chem.air, "thin");
  const cell = lands(ctx).find(
    (c) =>
      oresIn(ctx, c, "tin").length > 0 && oreWorkable(ctx, c, "copper", "metalworking") !== null,
  );
  assert.ok(cell !== undefined, "a land with nickel ore and copper it can work");
  assert.equal(oreWorkable(ctx, cell!, "tin"), null, "an open fire is too cool for it");
  const nickel = oreWorkable(ctx, cell!, "tin", "metalworking");
  assert.ok(
    furnaceHeat(ctx, cell!, "metalworking") >= reductionHeat(worldOre(chem, "tin", nickel!.lie)!),
  );
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
