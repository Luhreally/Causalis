import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, finish, mix, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { makePopulationWorld, populationContext } from "../../src/sim/index.ts";
import {
  deepen,
  meetHousehold,
  observer,
  resolvePerson,
  type Person,
} from "../../src/causal/index.ts";

/** Every claim is within what history holds, and each place-claim is exactly the people holding it. */
function assertConserved(world: World, label: string): void {
  const ctx = populationContext(world),
    ledger = observer(world),
    people = [...ledger.persons.values()];
  for (const [key, n] of ledger.allClaims()) {
    const [kind, a, b, c] = key.split(":");
    let limit: number;
    if (kind === "c") {
      limit = ctx.provinces.get(Number(a))!.counts.get(Number(b), Number(c));
      const holders = people.filter((p) => p.alive && p.claimKey === key).length;
      assert.equal(n, holders, `${label}: ${key} claims ${n}, held by ${holders}`);
    } else if (kind === "v") {
      const ref = `${a}:${b}:${c}` as Ref;
      limit = ctx.settlements.get(ref)!.population;
      const holders = people.filter((p) => p.alive && p.village === ref).length;
      assert.equal(n, holders, `${label}: ${key} claims ${n}, held by ${holders}`);
    } else if (kind === "b") limit = ctx.history.birthsIn(Number(a), Number(b));
    else if (kind === "d") limit = ctx.history.deathsIn(Number(a), Number(b), Number(c));
    else if (kind === "f") limit = ctx.history.flowAt(Number(a))!.count;
    else throw new Error(`unknown claim ${key}`);
    assert.ok(n <= limit, `${label}: ${key}: ${n} claimed of ${limit}`);
  }
  for (const p of people) {
    if (!p.alive) continue;
    assert.ok(p.claimKey, `${label}: ${p.ref} lives but holds no place in the counts`);
    assert.equal(
      p.claimKey.split(":")[1],
      String(p.cell),
      `${label}: ${p.ref} is counted where they live`,
    );
  }
}

test("conservation holds over 1,000 random click orders", () => {
  const world = makePopulationWorld(seedFromText("first light"));
  world.runTo(240 * YEAR);
  const ctx = populationContext(world),
    ledger = observer(world),
    fresh = JSON.stringify(ledger.save()),
    villages = ctx.settlements.all(),
    provinces = ctx.provinces.all().filter((p) => p.total() > 0);
  let met = 0,
    told = 0,
    refused = 0;
  for (let order = 0; order < 1000; order++) {
    ledger.load(JSON.parse(fresh));
    let h = finish(mix(0xc1c4, order), 7);
    const draw = (n: number) => {
      h = finish(mix(h, n), 7);
      return h % n;
    };
    const everyone: Person[] = [];
    for (let step = 0, steps = 4 + draw(16); step < steps; step++) {
      const what = draw(10);
      if (what < 7 || everyone.length === 0) {
        // Meet a family: in a village, or among the province's people in the open country.
        const inVillage = draw(4) !== 0;
        try {
          const hh = inVillage
            ? (() => {
                const v = villages[draw(villages.length)]!;
                return meetHousehold(world, v.cell, v.ref);
              })()
            : meetHousehold(world, provinces[draw(provinces.length)]!.cell, null);
          for (const r of hh.members) everyone.push(ledger.person(r)!);
          met += hh.members.length;
        } catch {
          refused++;
        }
      } else if (what < 9) {
        deepen(world, everyone[draw(everyone.length)]!);
        told++;
      } else resolvePerson(world, everyone[draw(everyone.length)]!.ref, 2);
    }
    assertConserved(world, `order ${order}`);
  }
  assert.ok(met > 10000, `met ${met} people`);
  assert.ok(told > 1000, `told ${told} lives`);
  assert.ok(refused < met / 10, `refused ${refused} times`);
});

test("conservation holds as time passes between looks", () => {
  const world = makePopulationWorld(seedFromText("first light"));
  world.runTo(236 * YEAR);
  const ctx = populationContext(world);
  for (let year = 236; year <= 300; year += 4) {
    world.runTo(year * YEAR);
    const villages = ctx.settlements.all();
    for (let i = 0; i < 3; i++) {
      const v = villages[(year * 7 + i * 13) % villages.length]!;
      try {
        const hh = meetHousehold(world, v.cell, v.ref);
        deepen(world, observer(world).person(hh.members[0]!)!);
      } catch {
        // Everyone there has been met.
      }
    }
    for (const p of observer(world).persons.values()) resolvePerson(world, p.ref);
    assertConserved(world, `year ${year}`);
  }
});
