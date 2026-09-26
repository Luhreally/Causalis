import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { makePopulationWorld, populationContext } from "../../src/sim/index.ts";
import {
  deepen,
  meetHousehold,
  observer,
  resolvePerson,
  spine,
  why,
  type Person,
} from "../../src/causal/index.ts";

function grown(years: number): World {
  const w = makePopulationWorld(seedFromText("first light"));
  w.runTo(years * YEAR);
  return w;
}

/** Every claim the observer holds is within what history holds. */
function assertWithinHistory(world: World): void {
  const ctx = populationContext(world),
    ledger = observer(world);
  for (const [key, n] of ledger.allClaims()) {
    const [kind, a, b, c] = key.split(":");
    let limit: number;
    if (kind === "c") limit = ctx.provinces.get(Number(a))!.counts.get(Number(b), Number(c));
    else if (kind === "v") limit = ctx.settlements.get(`${a}:${b}:${c}` as Ref)!.population;
    else if (kind === "b") limit = ctx.history.birthsIn(Number(a), Number(b));
    else if (kind === "d") limit = ctx.history.deathsIn(Number(a), Number(b), Number(c));
    else if (kind === "f") limit = ctx.history.flows()[Number(a)]!.count;
    else throw new Error(`unknown claim ${key}`);
    assert.ok(n <= limit, `${key}: ${n} claimed of ${limit}`);
  }
}

function meetMany(world: World, count: number, order: "forward" | "backward"): Person[] {
  const ctx = populationContext(world),
    villages = [...ctx.settlements.all()];
  if (order === "backward") villages.reverse();
  const met: Person[] = [];
  for (let i = 0; met.length < count && i < count * 3; i++) {
    const v = villages[i % villages.length]!;
    try {
      const hh = meetHousehold(world, v.cell, v.ref);
      for (const r of hh.members) met.push(observer(world).person(r)!);
    } catch {
      // A village whose people have all been met.
    }
  }
  return met;
}

test("meeting people never claims more than history holds, in any order", () => {
  for (const order of ["forward", "backward"] as const) {
    const world = grown(280),
      met = meetMany(world, 400, order);
    assert.ok(met.length >= 300, `met ${met.length}`);
    assertWithinHistory(world);
    // Everyone is who the counts say lives there.
    for (const p of met) assert.ok(p.alive && p.claimKey);
  }
});

test("a village runs out of people to meet exactly when its people are all met", () => {
  const world = grown(280),
    v = populationContext(world).settlements.all()[0]!;
  let people = 0;
  for (let i = 0; i < 400; i++) {
    try {
      people += meetHousehold(world, v.cell, v.ref).members.length;
    } catch (error) {
      assert.match((error as Error).message, /has been met|left to meet/);
      break;
    }
  }
  assert.ok(people <= v.population, `${people} met of ${v.population}`);
  assertWithinHistory(world);
});

test("looking never changes history", () => {
  const quiet = grown(240),
    busy = grown(240);
  const met = meetMany(busy, 120, "forward");
  for (const p of met.slice(0, 40)) deepen(busy, p);
  quiet.runTo(300 * YEAR);
  busy.runTo(300 * YEAR);
  for (const p of met.slice(0, 40)) resolvePerson(busy, p.ref, 4);
  assert.deepEqual(
    busy.checkpoints().map((c) => c.chain),
    quiet.checkpoints().map((c) => c.chain),
  );
});

test("a life, once told, stays told; its future is drawn from the ledgers", () => {
  const world = grown(250),
    met = meetMany(world, 60, "forward");
  const before = met.slice(0, 20).map((p) => {
    deepen(world, p);
    return JSON.stringify({
      birth: p.birthYear,
      cell: p.birthCell,
      moves: p.moves,
      memories: p.memories,
    });
  });
  world.runTo(300 * YEAR);
  met.slice(0, 20).forEach((p, i) => {
    resolvePerson(world, p.ref, 4);
    const after = JSON.parse(before[i]!) as { birth: number; cell: number; moves: unknown[] };
    assert.equal(p.birthYear, after.birth);
    assert.equal(p.birthCell, after.cell);
    assert.deepEqual(p.moves.slice(0, after.moves.length), after.moves, "the past does not change");
  });
  assertWithinHistory(world);
  const dead = met.filter((p) => !resolvePerson(world, p.ref).alive);
  assert.ok(dead.length > 0, "some of them died in fifty years");
});

test("a memory leads back through a migration to the land and the planet it happened on", () => {
  // Grown to just after this world's great moves (its first seventy years, as its bands bud
  // off from the cradle), while those who made them live.
  const world = grown(75),
    ctx = populationContext(world);
  // Meet families in provinces people moved into, until someone remembers setting out.
  let remembered: { person: Person; memory: Ref } | null = null;
  const moved = ctx.settlements.all().filter((s) => ctx.provinces.get(s.cell)!.settledYear > 0);
  for (let i = 0; i < 300 && !remembered; i++) {
    const v = moved[i % moved.length]!;
    let hh;
    try {
      hh = meetHousehold(world, v.cell, v.ref);
    } catch {
      continue;
    }
    for (const r of hh.members) {
      const p = deepen(world, observer(world).person(r)!);
      const m = p.memories?.find((x) => x.kind === "moved");
      if (m) {
        remembered = { person: p, memory: m.ref };
        break;
      }
    }
  }
  assert.ok(remembered, "someone remembers a migration");
  const node = why(world, remembered.memory);
  assert.match(node.claim, /remembers setting out for new land/);
  const path = spine(world, remembered.memory),
    kinds = path.map((e) => e.ref.split(":")[0]);
  assert.equal(kinds[0], "memo");
  assert.ok(
    kinds.includes("ev") && kinds.includes("dec"),
    `through the migration and its decision: ${kinds.join(" ← ")}`,
  );
  assert.equal(kinds.at(-1), "star", `down to the star: ${kinds.join(" ← ")}`);
  assert.ok(new Set(kinds).size >= 5, "across the observer, the people and the planet");
});
