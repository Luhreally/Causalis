// Courts (Lives L5): who sits at one comes from the world's numbers, a plot's end follows what was drawn, and no court
// outlives its realm. Pure numbers, and one real young world.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import {
  COURT,
  claimChance,
  doubtOf,
  fleeChance,
  plotChance,
  plotOdds,
  seizeCost,
  voicesHeard,
  weightOf,
} from "../src/rules/index.ts";
import {
  courtOf,
  dangerOf,
  orderOf,
  politiesOf,
  populationContext,
  rivalMoves,
} from "../src/sim/index.ts";
import { dramaOf, parseCourtRef } from "../src/host/court.ts";
import { courtPage } from "../src/host/inspect/court.ts";
import { familyOf } from "../src/host/kin.ts";

describe("a court's numbers", () => {
  it("hears more voices the more a ruler must carry", () => {
    assert.equal(voicesHeard(0), 1);
    assert.ok(voicesHeard(0.25) > voicesHeard(0));
    assert.ok(voicesHeard(0.5) > voicesHeard(0.25));
    assert.ok(voicesHeard(0.5) <= COURT.voices.length);
  });
  it("moves no rival under its line, and more of them the weaker the seat", () => {
    assert.equal(plotChance(COURT.line), 0);
    assert.ok(plotChance(COURT.line + 0.2) > plotChance(COURT.line + 0.1));
    assert.equal(claimChance(COURT.claimLine), 0);
    assert.equal(claimChance(5), COURT.claimMost);
  });
  it("gives a plot better odds with weight and doubt, worse among a people of custom", () => {
    assert.ok(plotOdds(1, 0, 0.5) > plotOdds(0, 0, 0.5));
    assert.ok(plotOdds(0, 1, 0.5) > plotOdds(0, 0, 0.5));
    assert.ok(plotOdds(0.5, 0.5, 0.9) < plotOdds(0.5, 0.5, 0.1));
    assert.equal(doubtOf(0.9), 0);
    assert.equal(weightOf(1), 1);
    assert.ok(fleeChance(1) > fleeChance(0));
    assert.ok(seizeCost(1) > seizeCost(0));
  });
});

describe("a real young world's courts", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(330 * YEAR);
  const ctx = populationContext(world),
    courts = courtOf(world)!,
    realms = politiesOf(world);

  it("gives every standing realm a court, and keeps none for a fallen one", () => {
    const living = realms.living().filter((p) => p.founded < 329);
    assert.ok(living.length > 0);
    for (const p of living) assert.ok(courts.of(p.ref), `${p.town} has no court`);
    for (const c of courts.all()) assert.equal(realms.get(c.realm)?.ended, null);
  });

  it("names an heir by the orders: by birth of the house, else of the voices", () => {
    for (const p of realms.living()) {
      const c = courts.of(p.ref);
      if (!c) continue;
      const heir = c.figures.find((f) => f.id === c.heir);
      if (!heir) continue;
      if (c.heirBy === "blood") {
        assert.equal(heir.seat, "house");
        assert.equal(p.succession, 0);
      }
      if (c.heirBy === "voices") assert.notEqual(heir.seat, "house");
    }
  });

  it("carries a figure's page, and an heir into their ruler's family", () => {
    const p = realms.living().find((x) => {
      const c = courts.of(x.ref);
      return !!c && c.figures.some((f) => f.tie === "child" && f.id === c.heir);
    });
    if (!p) return;
    const c = courts.of(p.ref)!,
      heir = c.figures.find((f) => f.id === c.heir)!;
    assert.deepEqual(parseCourtRef(`court:${p.ref}:${heir.id}`), { realm: p.ref, id: heir.id });
    assert.equal(courtPage(world, `court:${p.ref}:${heir.id}`).title, heir.name);
    assert.equal(
      familyOf(world, `rule:${p.ref}`)?.children.find((k) => k.note === "the heir")?.name,
      heir.name,
    );
  });

  it("tells a rival's why in numbers, and puts a plot to a ruler", () => {
    const p = realms.living().find((x) => {
      const c = courts.of(x.ref);
      return !!c && c.rival !== null && !c.plot && !!orderOf(world)?.of(x.ref);
    });
    assert.ok(p, "no realm with a rival");
    const c = courts.of(p.ref)!,
      f = c.figures.find((x) => x.id === c.rival)!,
      o = orderOf(world)!.of(p.ref)!,
      d = dangerOf(ctx, p, c, f, o);
    assert.ok(d.factors[0]!.name.includes(f.name));
    assert.ok(Math.abs(d.score - d.factors.reduce((s, x) => s + x.contribution, 0)) < 1e-9);
    rivalMoves(ctx, p, c, f, o, world.now);
    const asked = dramaOf(world, p);
    assert.equal(asked?.kind, "plot");
    assert.ok(asked?.words.includes(f.name));
    assert.deepEqual(
      asked?.choices.map((x) => x.id),
      ["seize", "buy", "let"],
    );
  });
});
