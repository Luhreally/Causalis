import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { forgedMetal, homePlanet, oreWithin, populationContext } from "../../src/sim/index.ts";
import { worldChemistry } from "../../src/gen/index.ts";
import { stonesFor } from "../../src/rules/index.ts";
import { landClay, landStone, toolMade, townStuff, type Made } from "../../src/host/chain.ts";
import type { Line } from "../../src/bridge/index.ts";

// Phase 54 C1: the chain on worlds of their own chemistry. Alien 16 (at 150 years) is reduced and
// hardened with arsenic: its tin is arsenic ore, its bronze arsenical copper, its copper native.
// Alien 182 (at 100 years) is carbon-rich: its iron is cohenite. Earth's chain is pinned by
// chain-pre54.test.ts.
const words = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");

const sixteen = ALIEN.build(seedFromText("alien 16"));
sixteen.runTo(150 * YEAR);
const ctx = populationContext(sixteen),
  chem = worldChemistry(homePlanet(sixteen).generated),
  cells = ctx.provinces
    .all()
    .map((p) => ({ cell: p.cell, people: p.total() }))
    .sort((a, b) => b.people - a.people || a.cell - b.cell)
    .map((p) => p.cell);

test("a land's stone is one of its world's stones", () => {
  const stones = Object.values(stonesFor(chem));
  for (const cell of cells.slice(0, 12)) {
    const { stone } = landStone(sixteen, cell);
    assert.ok(stones.includes(stone), `${stone.name} at ${cell} is one of the world's stones`);
  }
});

test("a tin land's bronze is arsenical copper, traced to arsenic ore and white arsenic, with no tin", () => {
  const tinLands = cells.filter((c) => oreWithin(ctx, c, "tin") !== null);
  assert.ok(tinLands.length > 0, "some land has tin ore within reach");
  let smelting = 0;
  for (const cell of tinLands) {
    const made: Made = toolMade(
        sixteen,
        cell,
        `alien:${cell}`,
        150,
        false,
        null,
        undefined,
        "bronze",
      ),
      text = made.chain.map(words),
      shown = text.join(" | ");
    assert.equal(made.stuff, "arsenical copper", shown);
    // (Where its smelters, or a neighbour's, know bronze, its tin is smelted from arsenic ore; where
    // none does, it is bought as arsenic, not tin.)
    const ore = text.some((l) => /^(Mispickel|Arsenic stone)/.test(l)),
      bought = text.some((l) =>
        /^Arsenic, smelted from its ore in a land none can tell, bought in the market/.test(l),
      );
    assert.ok(ore || bought, `its tin is arsenic ore or bought as arsenic: ${shown}`);
    smelting += ore ? 1 : 0;
    assert.ok(
      text.some((l) => /^Alloyed: white arsenic/.test(l)),
      `alloyed with white arsenic: ${shown}`,
    );
    assert.ok(!text.some((l) => /\btin\b/i.test(l)), `no tin in its chain: ${shown}`);
  }
  assert.ok(smelting > 0, "some tin land smelts its own arsenic ore");
});

test("no copper row on a reduced world is Earth's malachite or copper ore", () => {
  let copperRows = 0;
  for (const cell of cells) {
    if (oreWithin(ctx, cell, "copper") === null) continue;
    for (const metal of ["copper", "bronze"] as const)
      for (const l of toolMade(sixteen, cell, `alien:${cell}`, 150, false, null, undefined, metal)
        .chain) {
        const text = words(l);
        copperRows += /^(Native copper|Copper glance|Vent copper)/.test(text) ? 1 : 0;
        assert.ok(!/^(Malachite|Copper ore —)/.test(text), text);
      }
  }
  assert.ok(copperRows > 0, "some copper row is traced to the world's own copper");
});

test("a reduced world's clay never fires red or terracotta, and some of it fires grey or black", () => {
  const wares = new Set(cells.map((cell) => landClay(sixteen, cell).ware));
  for (const ware of wares)
    assert.ok(ware !== "red earthenware" && ware !== "terracotta", `${ware} is not Earth's`);
  assert.ok(
    [...wares].some((w) => /grey|black/.test(w)),
    [...wares].join(", "),
  );
});

test("a bronze town's smiths say what their bronze is made of, and what they melt", () => {
  const bronzeTowns = cells.filter((c) => forgedMetal(ctx, c, 150) === "bronze");
  assert.ok(bronzeTowns.length > 0, "some town forges bronze");
  for (const cell of bronzeTowns) {
    const { metal } = townStuff(sixteen, cell, 150);
    assert.ok(metal?.of, `${cell}: what its bronze is made of`);
    assert.ok(metal?.from, `${cell}: what its smiths melt`);
  }
});

test("alien 182: a carbon-rich world's iron tool is cohenite iron, at every land with iron ore", () => {
  const carbon = ALIEN.build(seedFromText("alien 182"));
  carbon.runTo(100 * YEAR);
  const cx = populationContext(carbon),
    ironLands = cx.provinces
      .all()
      .map((p) => p.cell)
      .filter((c) => oreWithin(cx, c, "iron") !== null);
  assert.ok(ironLands.length > 0, "some land has iron ore within reach");
  for (const cell of ironLands)
    assert.equal(
      toolMade(carbon, cell, `alien:${cell}`, 100, false, null, undefined, "iron").stuff,
      "cohenite iron",
      `land ${cell}`,
    );
});
