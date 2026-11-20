// 2026-11-19 ("it put rifles and guns just way later", after orbit and rockets): the order crafts come in. The rocket stands on
// the gun in the tree itself, so no people, by their own finding, by a neighbour's teaching or by the god's hand, comes to a
// rocket or to anything that flies beyond the sky without the gun and what the gun stands on; and the god's age of learning gives
// crafts nearest first, each after what it needs, not in the order the tree happens to be written in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import { PRINCIPLES, RESTS_ON, needsMet, principle } from "../../src/rules/index.ts";
import {
  designsOf,
  godLearning,
  knows,
  loreOf,
  politiesOf,
  populationContext,
  type Polity,
} from "../../src/sim/index.ts";
import { armsKnownBlocks, carriedStats } from "../../src/host/inspect/armsknown.ts";
import type { World } from "../../src/kernel/index.ts";
import { universeWorld } from "../host/worlds.ts";

/** Everything that stands on a craft, however far up. */
function above(id: string): Set<string> {
  const out = new Set<string>(),
    walk = (x: string) => {
      for (const p of RESTS_ON.get(x) ?? [])
        if (!out.has(p.id)) {
          out.add(p.id);
          walk(p.id);
        }
    };
  walk(id);
  return out;
}

/** All the tree opens from its roots, by needs alone, with some crafts never to be had. */
function reachable(without: readonly string[]): Set<string> {
  const known = new Set<string>(["cultivation", "metalworking"]),
    has = (id: string) => known.has(id);
  for (let again = true; again;) {
    again = false;
    for (const p of PRINCIPLES)
      if (!has(p.id) && !without.includes(p.id) && needsMet(p, has)) {
        known.add(p.id);
        again = true;
      }
  }
  return known;
}

test("the rocket stands on the gun: the land's musket or the sea's darts, each on its charge", () => {
  assert.ok(principle("rocketry").needs.includes("firearms|gas-darts"));
  // (The gun's own: a charge, and the lock that lights it.)
  assert.deepEqual([...principle("firearms").needs], ["gunpowder", "clockwork"]);
  const all = reachable([]),
    noGun = reachable(["firearms", "gas-darts"]),
    noCharge = reachable(["gunpowder", "electrochemistry"]);
  assert.ok(all.has("orbital-flight") && all.has("antimatter-drive"));
  const sky = ["rocketry", ...above("rocketry")];
  for (const id of ["orbital-flight", "transfer-flight", "stations", "habitats", "thrown-loads"])
    assert.ok(sky.includes(id), `${id} does not stand on the rocket`);
  for (const id of sky) {
    // (Some stand on the rocket by one road of two: only those every road to which is the rocket's are asked.)
    if (!reachable(["rocketry"]).has(id)) {
      assert.ok(!noGun.has(id), `${id} can be had with no gun`);
      assert.ok(!noCharge.has(id), `${id} can be had with no charge`);
    }
  }
  assert.ok(!noGun.has("orbital-flight") && !noCharge.has("orbital-flight"));
});

test("no row of the tree asks what cannot come before it: every craft is still reached", () => {
  assert.equal(reachable([]).size, PRINCIPLES.length);
});

const world = (() => {
  let cached: World | null = null;
  return () => (cached ??= universeWorld(EARTH, "first light", 220));
})();
/** The realm whose seat knows least: the longest road for the act to give. */
const least = (w: World): Polity => {
  const lore = loreOf(w);
  return [...politiesOf(w).living()]
    .filter((r) => (populationContext(w).provinces.get(r.seat)?.total() ?? 0) > 0)
    .sort(
      (a, b) => lore.of(a.seat).length - lore.of(b.seat).length || (a.ref < b.ref ? -1 : 1),
    )[0]!;
};

test("an age of learning gives each craft after what it needs, and the gun long before the rocket", () => {
  const w = world(),
    c = populationContext(w),
    r = least(w),
    order = godLearning(c, r.seat, 999),
    at = (id: string) => order.indexOf(id),
    held = new Set<string>(order.slice(0, 0));
  assert.ok(order.length > 60, `only ${order.length} crafts to give`);
  assert.equal(new Set(order).size, order.length, "a craft given twice");
  order.forEach((id, i) => {
    if (id !== "cultivation")
      assert.ok(
        needsMet(principle(id), (n) => held.has(n) || knows(c, r.seat, n)),
        `${id} (#${i + 1}) given before what it needs`,
      );
    held.add(id);
  });
  const line = ["gunpowder", "firearms", "rifling", "repeating-fire", "rocketry", "orbital-flight"];
  for (const id of line) assert.ok(at(id) >= 0, `${id} never given`);
  for (let i = 1; i < line.length; i++)
    assert.ok(at(line[i - 1]!) < at(line[i]!), `${line[i]} given before ${line[i - 1]}`);
  // (Every gun before anything flies to orbit; every drive after every gun.)
  for (const gun of ["self-loading", "automatic-fire"])
    assert.ok(at(gun) < at("orbital-flight"), `${gun} after orbit`);
  for (const far of ["transfer-flight", "nuclear-drive", "fusion-drive", "antimatter-drive"])
    assert.ok(at("automatic-fire") < at(far), `${far} before the last gun`);
  // (What only living through a thing opens comes last, when nothing else is left.)
  const seen = order.filter((id) => principle(id).seen);
  assert.deepEqual(order.slice(order.length - seen.length), seen);
  // (Asked for a few, the same few the whole order begins with.)
  assert.deepEqual(godLearning(c, r.seat, 3), order.slice(0, 3));
});

test("pressed again and again, no land of the realm holds a rocket without a gun; its pages say what is carried", () => {
  const w = universeWorld(EARTH, "first light", 220),
    r = least(w),
    god = { realm: r.ref, ruler: r.ruler.name, channel: true },
    lore = loreOf(w),
    c = populationContext(w);
  let gunAt = 0,
    rocketAt = 0;
  for (let press = 1; press <= 9; press++) {
    const at = w.now;
    w.submit("reign.god", { ...god, what: "age", crafts: 12 });
    w.runTo(at + 2);
    for (const cell of r.members) {
      if (!c.provinces.get(cell)?.total()) continue;
      const gun = !!lore.get(cell, "firearms");
      for (const p of PRINCIPLES)
        if (lore.get(cell, p.id) && (p.id === "rocketry" || above("rocketry").has(p.id)))
          assert.ok(
            gun || !!lore.get(cell, "gunpowder"),
            `press ${press}: land ${cell} holds ${p.id} with no gun or charge`,
          );
      if (lore.get(cell, "rocketry")) assert.ok(gun, `press ${press}: a rocket and no gun`);
    }
    if (!gunAt && lore.get(r.seat, "firearms")) gunAt = press;
    if (!rocketAt && lore.get(r.seat, "rocketry")) rocketAt = press;
  }
  assert.ok(gunAt > 0 && rocketAt > 0, "nine ages gave no gun or no rocket");
  assert.ok(gunAt <= rocketAt, `the gun at press ${gunAt}, the rocket at ${rocketAt}`);
  // (Known at once; carried only when its host is next armed, and only if it is: the page says which.)
  const blocks = armsKnownBlocks(w, r.seat),
    table = blocks.find((b) => b.type === "table");
  assert.ok(table && table.type === "table" && table.rows.length >= 5, "no arms told");
  const carried = designsOf(w)
      .of(r.ref)
      ?.parts.find((x) => x.role === "arm")?.id,
    words = JSON.stringify(blocks);
  if (carried !== "musket") assert.match(words, /never carried|not carried|carried once/);
  assert.equal(carriedStats(w, "firearms").length, 1);
  assert.equal(carriedStats(w, "astronomy").length, 0);
  // (What, who and whether: never how it is made.)
  assert.doesNotMatch(
    words + JSON.stringify(carriedStats(w, "firearms")),
    /saltpet|nitr|charcoal|sulph|sulf|grams|per cent|%|ratio/i,
  );
});

test("by their own finding, no land comes to the rocket before the gun", () => {
  // (A world's own history is long: read here off the rule the year's finding asks, `needsMet`, on every land that knows
  // anything. tools and tallies run the centuries.)
  const w = world(),
    c = populationContext(w),
    lore = loreOf(w);
  for (const p of c.provinces.all()) {
    if (!p.total()) continue;
    const rocket = lore.get(p.cell, "rocketry"),
      gun = lore.get(p.cell, "firearms") ?? lore.get(p.cell, "gas-darts");
    if (rocket) assert.ok(gun && gun.year <= rocket.year, `land ${p.cell}`);
  }
});
