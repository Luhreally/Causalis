// Later arms (Phase 53 M219): a firearm from its physics; the repeating, self-loading and automatic
// rifle and the armoured car in the design grammar, machined at works a realm can reach and driven
// by its oil; fire in battle, a defender dug in and both sides lying low — and none of it touching a
// kit or a battle before the magazine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { cellRef } from "../../src/gen/index.ts";
import {
  FIREARMS,
  G,
  HOST_ROLES,
  REALIZATIONS,
  compose,
  designWords,
  firearm,
  firepowerOf,
  hostPower,
  performanceOf,
  principle,
  rangeAxisOf,
  type Part,
} from "../../src/rules/index.ts";
import {
  LORE_EVENTS,
  fireTerms,
  fuelFor,
  hostFor,
  loreOf,
  machinedFor,
  makePopulationWorld,
  marketsOf,
  politiesOf,
  populationContext,
} from "../../src/sim/index.ts";

/** The principles of the later arms. */
const LATER = ["repeating-fire", "self-loading", "automatic-fire", "armoured-vehicles"];
const all = () => true,
  ids = (parts: readonly Part[]) => parts.map((p) => p.id).join(" "),
  part = (role: Part["role"], id: string, material: Part["material"]): Part => ({
    role,
    id,
    material,
  }),
  kit = (arm: [string, Part["material"]], guard: [string, Part["material"]], mount: string) => [
    part("arm", ...arm),
    part("guard", ...guard),
    part("mount", mount, mount === "armoured" ? "machined" : "hide"),
  ];

test("a firearm's firepower and range come from what it looses and how far it carries", () => {
  const f = (id: string) => firepowerOf(firearm(id)!);
  assert.equal(f("musket"), 0);
  assert.equal(f("rifle"), 0);
  assert.ok(Math.abs(f("repeater") - 1.644) < 0.01, `${f("repeater")}`);
  assert.ok(Math.abs(f("autoloader") - 2.781) < 0.01, `${f("autoloader")}`);
  assert.ok(Math.abs(f("automatic") - 5.492) < 0.01, `${f("automatic")}`);
  assert.equal(rangeAxisOf(firearm("musket")!), 0.85);
  assert.ok(Math.abs(rangeAxisOf(firearm("rifle")!) - 1.15) < 1e-12);
  // (Each arm looses more than the one before it, from the musket to the machine gun.)
  for (let i = 1; i < FIREARMS.length; i++)
    assert.ok(
      FIREARMS[i]!.rate * FIREARMS[i]!.range > FIREARMS[i - 1]!.rate * FIREARMS[i - 1]!.range,
    );
});

test("a host's power is exactly as it was for every kit before the magazine", () => {
  // The old law, written out: without firepower, nothing moves.
  const old = (parts: Part[]) => {
    const p = performanceOf(parts);
    return (
      1 +
      1.0 * ((p.shock ?? 0) - 0.3) +
      0.6 * (p.range ?? 0) +
      0.9 * (p.protection ?? 0) +
      0.5 * ((p.mobility ?? 0) - 0.2)
    );
  };
  const before = REALIZATIONS.filter(
      (r) => HOST_ROLES.some((x) => x === r.role) && !r.needs.some((n) => LATER.includes(n)),
    ),
    of = (role: string) => before.filter((r) => r.role === role);
  let n = 0;
  for (const arm of of("arm"))
    for (const guard of of("guard"))
      for (const mount of of("mount"))
        for (const m of arm.materials) {
          const parts = [
            part("arm", arm.id, m),
            part("guard", guard.id, guard.materials[0]!),
            part("mount", mount.id, mount.materials[0]!),
          ];
          assert.equal(hostPower(parts), old(parts), ids(parts));
          n++;
        }
  assert.ok(n > 100, `${n} kits`);
});

test("later arms are machined, an armoured car runs on oil, and a helmet is worn, not plate", () => {
  const doctrine = {
    shock: 1.1,
    reach: 0.3,
    range: 0.4,
    protection: 0.5,
    mobility: 0.3,
    cost: 0.5,
    firepower: 0.35,
    breach: 0.3,
  };
  assert.equal(ids(compose(HOST_ROLES, all, all, doctrine)), "automatic helmet armoured");
  assert.equal(
    designWords(compose(HOST_ROLES, all, all, doctrine)),
    "machine guns and steel helmets, with armoured cars",
  );
  // (No oil: no armoured cars. Nothing machined: the rifle, forged by hand, is the best there is.)
  assert.equal(
    ids(compose(HOST_ROLES, all, (m) => m !== "oil", doctrine)),
    "automatic helmet cavalry",
  );
  assert.equal(
    ids(compose(HOST_ROLES, all, (m) => m !== "machined", doctrine)),
    "rifle helmet cavalry",
  );
  // (Each in its turn: knowing the one before, never the next.)
  const knowing = (n: number) => (id: string) => !LATER.slice(n).includes(id);
  assert.equal(ids(compose(HOST_ROLES, knowing(0), all, doctrine)).split(" ")[0], "rifle");
  assert.equal(ids(compose(HOST_ROLES, knowing(1), all, doctrine)).split(" ")[0], "repeater");
  assert.equal(ids(compose(HOST_ROLES, knowing(2), all, doctrine)).split(" ")[0], "autoloader");
  assert.equal(ids(compose(HOST_ROLES, knowing(3), all, doctrine)), "automatic helmet cavalry");
  // Each stronger than the last.
  const powers = [
    kit(["rifle", "steel"], ["plate", "steel"], "cavalry"),
    kit(["repeater", "machined"], ["plate", "steel"], "cavalry"),
    kit(["autoloader", "machined"], ["helmet", "steel"], "cavalry"),
    kit(["automatic", "machined"], ["helmet", "steel"], "cavalry"),
    kit(["automatic", "machined"], ["helmet", "steel"], "armoured"),
  ].map((k) => hostPower(k));
  for (let i = 1; i < powers.length; i++) assert.ok(powers[i]! > powers[i - 1]!, `${powers}`);
});

test("fire digs a defender in and lays both sides low; before the magazine it is nothing", () => {
  assert.deepEqual(fireTerms({ fire: 0, breach: 0 }, { fire: 0 }), { entrench: 1, disperse: 1 });
  // The attacker's odds, men alike, on open ground.
  const odds = (a: Part[], b: Part[]) => {
    const pa = performanceOf(a),
      pb = performanceOf(b),
      { entrench } = fireTerms(
        { fire: pa.firepower ?? 0, breach: pa.breach ?? 0 },
        { fire: pb.firepower ?? 0 },
      ),
      attack = hostPower(a),
      defend = hostPower(b) * 1.5 * entrench;
    return attack / (attack + defend);
  };
  const rifles = kit(["rifle", "steel"], ["helmet", "steel"], "cavalry"),
    guns = kit(["automatic", "machined"], ["helmet", "steel"], "cavalry"),
    armour = kit(["automatic", "machined"], ["helmet", "steel"], "armoured");
  const near = (x: number, y: number) => Math.abs(x - y) < 0.006;
  assert.ok(near(odds(rifles, rifles), 0.4), `${odds(rifles, rifles)}`);
  assert.ok(near(odds(guns, guns), 0.334), `${odds(guns, guns)}`);
  assert.ok(near(odds(armour, armour), 0.355), `${odds(armour, armour)}`);
  // (Machine guns against rifles dug in; armour breaches the guns' line better than men on foot.)
  assert.ok(odds(armour, guns) > odds(guns, guns));
  assert.ok(odds(rifles, guns) < odds(rifles, rifles));
  // (The fiercer the fire, the fewer fall.)
  const f = performanceOf(guns).firepower!;
  assert.ok(fireTerms({ fire: f, breach: 0 }, { fire: 0 }).disperse < 1);
});

/** Teach a land principles outright (a fixture: the tree takes centuries to reach them). */
function teach(world: World, cell: number, list: string[]): void {
  const lore = loreOf(world);
  for (const id of list) {
    if (lore.get(cell, id)) continue;
    const event = world.events.emit({
      type: LORE_EVENTS.found.type,
      place: cellRef(0, cell),
      data: { principle: id },
    });
    lore.learn(cell, id, { year: Math.floor(world.now / YEAR), event }, principle(id));
  }
}

test("a realm's machined arms come only from works it can reach, its armoured cars only with oil", () => {
  const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
  world.runTo(80 * YEAR);
  const ctx = populationContext(world),
    p = politiesOf(world)
      .living()
      .find((r) => r.members.length >= 2)!;
  assert.ok(p, "a realm of two lands or more");
  teach(world, p.seat, [
    "bronze",
    "iron",
    "writing",
    "mathematics",
    "steel",
    "clockwork",
    "medicine",
    "gunpowder",
    "firearms",
    "rifling",
    ...LATER,
  ]);
  // Without works it can reach, no machined arms, whatever it knows.
  assert.equal(machinedFor(ctx, p), null);
  assert.ok(!hostFor(ctx, p).parts.some((x) => x.material === "machined"));
  // Works in one of its lands, with machines made there: repeating arms and better, citing them.
  const land = [...p.members].sort((a, b) => a - b).at(-1)!,
    m = marketsOf(world).of(land),
    works = world.events.emit({ type: LORE_EVENTS.found.type, place: cellRef(0, land) });
  teach(world, land, ["steel"]);
  m.works = works as Ref;
  m.stock[G.machines] = 10;
  assert.equal(machinedFor(ctx, p), works);
  const host = hostFor(ctx, p);
  assert.equal(host.parts.find((x) => x.role === "arm")?.material, "machined");
  assert.equal(host.sources.machined, works);
  // Oil in store: armoured cars.
  assert.equal(fuelFor(ctx, p), null);
  assert.notEqual(host.parts.find((x) => x.role === "mount")?.id, "armoured");
  m.stock[G.oil] = 5;
  assert.ok(fuelFor(ctx, p));
  assert.equal(hostFor(ctx, p).parts.find((x) => x.role === "mount")?.id, "armoured");
});
