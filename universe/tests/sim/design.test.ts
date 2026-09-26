import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import {
  HOST_ROLES,
  HOUSE_ROLES,
  compose,
  designWords,
  hostPower,
  realization,
  type Material,
  type Part,
} from "../../src/rules/index.ts";
import {
  DESIGN_EVENTS,
  designsOf,
  knows,
  landMaterials,
  politiesOf,
  populationContext,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { EARTH } from "../../src/host/planet.ts";

const all = () => true;
const only =
  (...ms: Material[]) =>
  (m: Material) =>
    ms.includes(m);
const ids = (parts: Part[]) => parts.map((p) => `${p.id}:${p.material}`);

test("a house answers its land: courtyards of mud brick in the heat, long turf-roofed halls in the cold", () => {
  const hot = compose(HOUSE_ROLES, all, only("earth", "mud", "hide", "reed"), {
    cool: 1.6,
    shedding: 0.2,
    lasting: 0.3,
    room: 0.5,
    cost: 0.7,
  });
  assert.deepEqual(ids(hot), ["mudbrick:mud", "flat:mud", "court:mud"]);
  const cold = compose(
    HOUSE_ROLES,
    (id) => id === "cultivation",
    only("earth", "hide", "wood", "reed", "sod"),
    { warmth: 1.2, shedding: 0.8, lasting: 0.3, room: 0.5, cost: 0.7 },
  );
  assert.deepEqual(ids(cold), ["wattle:wood", "turf:sod", "long:wood"]);
  const roaming = compose(HOUSE_ROLES, all, only("earth", "hide", "reed"), {
    warmth: 0.5,
    room: 0.4,
    mobile: 1.1,
    cost: 0.7,
  });
  assert.equal(designWords(roaming), "tents of hide");
});

test("a host is armed with what its people know and its lands hold", () => {
  const doctrine = {
    shock: 1.1,
    reach: 0.3,
    range: 0.4,
    protection: 0.5,
    mobility: 0.3,
    cost: 0.5,
  };
  const stone = compose(HOST_ROLES, () => false, only("wood", "stone", "hide", "reed"), doctrine),
    bronze = compose(
      HOST_ROLES,
      (id) => ["metalworking", "bronze", "tanning"].includes(id),
      only("wood", "stone", "hide", "reed", "copper", "bronze"),
      doctrine,
    ),
    // Knowing bronze is not enough without the tin to make it.
    noTin = compose(
      HOST_ROLES,
      (id) => ["metalworking", "bronze", "tanning"].includes(id),
      only("wood", "stone", "hide", "reed", "copper"),
      doctrine,
    ),
    steel = compose(HOST_ROLES, all, () => true, doctrine);
  assert.equal(stone.find((p) => p.role === "arm")!.material, "stone");
  assert.equal(bronze.find((p) => p.role === "arm")!.material, "bronze");
  assert.ok(!noTin.some((p) => p.material === "bronze"), "no bronze without tin");
  assert.ok(hostPower(stone) < hostPower(noTin) && hostPower(noTin) < hostPower(bronze));
  assert.ok(hostPower(bronze) < hostPower(steel));
  for (const p of steel) assert.ok(realization(p.id).materials.includes(p.material));
});

// Amber's land runs from desert to rainforest, and some of its realms have metal near.
const world = EARTH.build(seedFromText("amber"));
world.runTo(420 * YEAR);
const ctx = populationContext(world),
  designs = designsOf(world);

test("every settled land builds from what it gives and knows; the land and the principles say why", () => {
  let seen = 0;
  const kinds = new Set<string>();
  for (const p of ctx.provinces.all()) {
    const d = designs.of(p.ref);
    if (!d) continue;
    seen++;
    kinds.add(designWords(d.parts));
    const at = landMaterials(ctx, p.cell);
    for (const part of d.parts) {
      assert.ok(at.has(part.material), `${part.id} of ${part.material} in land ${p.cell}`);
      for (const need of realization(part.id).needs)
        assert.ok(knows(ctx, p.cell, need), `${part.id} needs ${need}`);
    }
    const e = world.events.get(d.event)!;
    assert.equal(e.type, DESIGN_EVENTS.house.type);
    assert.equal(e.causes[0]!.ref, p.ref, "the land, its climate and its materials");
  }
  assert.ok(seen >= 10, `${seen} lands with houses`);
  assert.ok(kinds.size >= 3, `${kinds.size} ways of building: ${[...kinds].join("; ")}`);
});

test("hosts are armed with metals only where their seats know the craft and ore lies within reach", () => {
  const hosts = politiesOf(world)
    .living()
    .map((r) => ({ r, d: designs.of(r.ref) }))
    .filter((x) => x.d);
  assert.ok(hosts.length >= 3);
  let metal = 0;
  for (const { r, d } of hosts) {
    const e = world.events.get(d!.event)!;
    assert.equal(e.type, DESIGN_EVENTS.host.type);
    assert.match(why(world, d!.ref).claim, /fights with/);
    const metals = d!.parts.filter((p) =>
      ["copper", "bronze", "iron", "steel"].includes(p.material),
    );
    if (!metals.length) continue;
    metal++;
    assert.ok(knows(ctx, r.seat, "metalworking"));
    // Its metal's land is among the design's causes.
    assert.ok(
      e.causes.some((c) => c.ref.startsWith("cell:")),
      "where its metal comes from",
    );
  }
  assert.ok(metal >= 1, "some realm fights with metal");
});

test("the microscope builds a village as its land's design says", () => {
  const v = ctx.settlements.all().find((s) => designs.of(ctx.provinces.get(s.cell)!.ref))!;
  const plan = EARTH.queries["village.plan"]!(world, { ref: v.ref }) as {
    house: { walls: string; roof: string; form: string; pitch: number; design: string };
  };
  const d = designs.of(ctx.provinces.get(v.cell)!.ref)!;
  assert.equal(plan.house.design, d.ref);
  assert.equal(plan.house.walls, d.parts.find((p) => p.role === "walls")!.id);
  assert.equal(plan.house.roof, d.parts.find((p) => p.role === "roof")!.id);
  assert.ok(plan.house.pitch >= 3 && plan.house.pitch <= 55);
  assert.equal(world.events.get(d.event as Ref)?.type, DESIGN_EVENTS.house.type);
});
