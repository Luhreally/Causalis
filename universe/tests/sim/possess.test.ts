import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type World,
} from "../../src/kernel/index.ts";
import {
  POSSESS_EVENTS,
  agentById,
  handOf,
  makePopulationWorld,
  marketsOf,
  populationContext,
  type Agent,
  type TakeArgs,
} from "../../src/sim/index.ts";
import {
  G,
  HAND_ACT,
  OCC,
  POSSESS_HZ,
  bidLetters,
  handOffers,
  type HandBid,
} from "../../src/rules/index.ts";
import { cradleCell } from "../cradle.ts";

const seed = seedFromText("first light"),
  HOME = cradleCell("first light"),
  build = () => makePopulationWorld(seed),
  domain = (w: World, name: string) => w.domainHashes().find(([d]) => d === name)?.[1];

/** A world at year 245 with the hand on its first town; its folk and its smith. */
function laid(year = 245): { world: World; smith: Agent; folk: Agent[] } {
  const world = build();
  world.runTo(year * YEAR);
  const v = populationContext(world).settlements.inProvince(HOME)[0]!;
  world.submit("hand.lay", { village: v.ref });
  world.runTo(year * YEAR + 1);
  const w = handOf(world).resting!,
    grown = (a: Agent) => year - a.birthYear >= 20 && year - a.birthYear < 45,
    smith = w.agents.find((a) => grown(a) && a.occupation === OCC.crafter) ?? w.agents.find(grown)!,
    folk = w.agents.filter((a) => a !== smith && grown(a)).slice(0, 6);
  return { world, smith, folk };
}

/** The take: the smith at the middle, his forge 8 m north, the rack beside it, the granary west, folk about him. */
function take(smith: Agent, folk: readonly Agent[]): TakeArgs {
  return {
    agent: smith.id,
    at: { x: 0, z: 0, yaw: 0, task: -1, pace: 1.25 },
    trade: "smith",
    form: "sickle",
    near: folk.map((a, i) => ({
      id: a.id,
      x: i < 2 ? 0.4 + i : -12 + i,
      z: i < 2 ? 1.6 : 6 - 2 * i,
      yaw: Math.PI,
      task: -1,
      pace: 1.25,
      ways: [0, i < 2 ? 0.4 + i : -12 + i, i < 2 ? 1.6 : 6 - 2 * i, Math.PI, -1],
    })),
    solids: [0, 14, 0, 1, 0, 3, 2],
    places: [
      { kind: "forge", x: 0, z: 9, yaw: 0 },
      { kind: "rack", x: 6, z: 9, yaw: 0 },
      { kind: "granary", x: -18, z: 0, yaw: Math.PI / 2 },
    ],
  };
}

const go = (mx: number, mz: number, act = 0, run = false): HandBid => ({ mx, mz, run, act });
/** Send bids a second at a time (the rest held still), as the page does. */
function send(world: World, bids: HandBid[]): void {
  for (let i = 0; i < bids.length; i += POSSESS_HZ) {
    const second = bids.slice(i, i + POSSESS_HZ);
    while (second.length < POSSESS_HZ) second.push(go(0, 0));
    const step = handOf(world).resting!.possessed!.local.step;
    const c = world.submit("possess.input", { step, steps: second.map(bidLetters).join("") });
    world.runTo(c.t);
  }
}
function release(world: World): void {
  const step = handOf(world).resting!.possessed!.local.step,
    c = world.submit("possess.release", { step, steps: "" });
  world.runTo(c.t);
}
const steps = (n: number, b: HandBid) => Array.from({ length: n }, () => b);

test("taking a body and letting it go, with nothing done, leaves the town as it was", () => {
  const quiet = laid(),
    touched = laid();
  const c = touched.world.submit("possess.take", take(touched.smith, touched.folk));
  touched.world.runTo(c.t);
  const p = handOf(touched.world).resting!.possessed!;
  assert.equal(p.local.bodies.length, 7, "he and the six near him");
  assert.equal(p.local.bodies[0]!.id, touched.smith.id);
  send(touched.world, steps(2 * POSSESS_HZ, go(0, 0)));
  release(touched.world);
  assert.equal(handOf(touched.world).resting!.possessed, undefined);
  assert.ok(!("possessed" in handOf(touched.world).resting!), "no trace kept of the small world");
  const t = touched.world.now;
  quiet.world.runTo(t);
  for (const d of ["population", "economy", "planet"])
    assert.equal(domain(touched.world, d), domain(quiet.world, d), `${d} as it was`);
  // Told: he was taken, and let go.
  const types = touched.world.events.all().map((e) => e.type);
  assert.ok(types.includes(POSSESS_EVENTS.possessed.type));
  assert.ok(types.includes(POSSESS_EVENTS.released.type));
});

test("a smith walked to his forge makes a sickle by hand: the town's, made by him", () => {
  const { world, smith, folk } = laid();
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  const market = marketsOf(world).get(handOf(world).resting!.cell)!,
    before = market.stock[G.tools]!;
  // North to the forge, then four acts of work, a stage each.
  send(world, [
    ...steps(5 * POSSESS_HZ, go(0, 31)),
    ...[0, 1, 2, 3].flatMap(() => [go(0, 0, HAND_ACT.work), ...steps(19, go(0, 0))]),
  ]);
  const l = handOf(world).resting!.possessed!.local;
  assert.deepEqual(
    l.deeds.map((d) => d.kind),
    ["made"],
  );
  assert.equal(l.bodies[0]!.carry, -1, "the sickle in his hands");
  release(world);
  assert.equal(market.stock[G.tools], before + 1, "the town's: one more tool in its stores");
  const made = world.events.all().find((e) => e.type === POSSESS_EVENTS.made.type)!,
    d = made.data as { agent: number; name: string; things: { form: string; n: number }[] };
  assert.equal(d.agent, smith.id);
  assert.deepEqual(d.things, [{ form: "sickle", n: 1 }]);
  // Remembered for it, on his page.
  assert.ok(
    handOf(world).resting!.notables!.some((n) => n.agent === smith.id && n.deed === made.id),
  );
});

test("a word heard heartens the hearer, and stays with them", () => {
  const { world, smith, folk } = laid();
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  send(world, [go(0, 0, HAND_ACT.talk)]);
  const spoke = handOf(world).resting!.possessed!.local.deeds.find((d) => d.kind === "spoke");
  assert.ok(spoke && spoke.kind === "spoke");
  release(world);
  const hearer = agentById(handOf(world).resting!, spoke.agent)!;
  assert.ok(hearer.mood && hearer.mood.by > 0, `heartened: ${JSON.stringify(hearer.mood)}`);
  assert.ok(world.events.all().some((e) => e.type === POSSESS_EVENTS.spoke.type));
});

test("one struck down by the god in another's body dies out of the counts, or lives wounded", () => {
  const { world, smith, folk } = laid();
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  const victim = folk[0]!;
  // Blows at the one before him until he is down (he follows him if he flees or fights).
  for (let k = 0; k < 40; k++) {
    const l = handOf(world).resting!.possessed!.local;
    if (l.deeds.some((d) => d.kind === "struck" && d.agent === victim.id)) break;
    const a = l.bodies[0]!,
      b = l.bodies.find((x) => x.id === victim.id)!,
      dx = b.x - a.x,
      dz = b.z - a.z,
      dist = Math.hypot(dx, dz) || 1,
      m = (v: number) => (v / dist) * 31;
    send(world, [
      go(m(dx), m(dz), dist < 1.4 ? HAND_ACT.strike : 0, dist > 3),
      ...steps(9, go(m(dx), m(dz), 0, dist > 3)),
    ]);
  }
  const w = handOf(world).resting!,
    struck = w.possessed!.local.deeds.find((d) => d.kind === "struck" && d.agent === victim.id);
  assert.ok(struck && struck.kind === "struck", "struck down");
  const prov = populationContext(world).provinces.get(w.cell)!,
    total = prov.total();
  release(world);
  const e = world.events.all().find((x) => x.type === POSSESS_EVENTS.struck.type)!;
  assert.equal((e.data as { agent: number }).agent, victim.id);
  if (struck.dead) {
    assert.equal(agentById(w, victim.id), undefined, "dead: no longer among them");
    assert.equal(prov.total(), total - 1, "and one fewer counted");
    assert.ok(w.gone!.some((g) => g.id === victim.id));
  } else {
    const hit = agentById(w, victim.id)!.struck!;
    assert.equal(hit.length, 1);
    assert.equal(hit[0]!.place, struck.place);
    assert.equal(hit[0]!.event, e.id);
    assert.equal(prov.total(), total, "wounded: still counted");
  }
});

test("goods taken from the granary leave the town's stores", () => {
  const { world, smith, folk } = laid();
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  const market = marketsOf(world).get(handOf(world).resting!.cell)!,
    before = market.stock[G.grain]!;
  // West to the granary, a second at a time till a sack is in reach; take one.
  const p = handOf(world).resting!.possessed!;
  for (let k = 0; k < 30 && handOffers(p.scene, p.local)[0]!.act !== HAND_ACT.take; k++)
    send(world, steps(POSSESS_HZ, go(-31, 0)));
  assert.equal(handOffers(p.scene, handOf(world).resting!.possessed!.local)[0]!.act, HAND_ACT.take);
  send(world, [go(0, 0, HAND_ACT.take)]);
  assert.equal(handOf(world).resting!.possessed!.local.bodies[0]!.carry, G.grain + 1);
  release(world);
  assert.equal(market.stock[G.grain], before - 1, "a sack of grain carried off");
});

test("bids out of step, or not a second's, are refused; the hand is not lifted while it is in a body", () => {
  const { world, smith, folk } = laid();
  assert.throws(() => world.submit("possess.input", { step: 0, steps: "" }), /no one is possessed/);
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  assert.throws(() => world.submit("possess.take", take(smith, folk)), /already/);
  const second = steps(POSSESS_HZ, go(0, 0)).map(bidLetters).join("");
  assert.throws(() => world.submit("possess.input", { step: 3, steps: second }), /out of step/);
  assert.throws(
    () => world.submit("possess.input", { step: 0, steps: second.slice(3) }),
    /a second's bids/,
  );
  assert.throws(() => world.submit("hand.lift", {}), /let them go first/);
  assert.throws(
    () => world.submit("possess.take", { ...take(smith, folk), solids: [1, 2, 3] }),
    /already|solids/,
  );
  release(world);
  assert.throws(
    () => world.submit("possess.take", { ...take(smith, folk), solids: [1, 2, 3] }),
    /solids/,
  );
  assert.throws(
    () => world.submit("possess.take", { ...take(smith, folk), trade: "constructor" }),
    /trade/,
  );
});

test("a world with a body possessed replays, and its save — mid-possession too — continues bit for bit", () => {
  const { world, smith, folk } = laid(238);
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  send(world, [
    ...steps(3 * POSSESS_HZ, go(0, 31)),
    go(0, 0, HAND_ACT.work),
    ...steps(POSSESS_HZ, go(-20, -20)),
    go(0, 0, HAND_ACT.talk),
  ]);
  // Saved while he is held: it loads as it was, and goes on as it would have.
  const ruleset = rulesetId(world, "test"),
    held = saveWorld(world, ruleset);
  assert.deepEqual(verifyByReplay(held, build), { ok: true, problem: null });
  const loaded = loadWorld(held, build, ruleset).world;
  for (const w of [world, loaded]) {
    send(w, steps(2 * POSSESS_HZ, go(31, 0)));
    release(w);
    w.runTo(240 * YEAR);
  }
  assert.deepEqual(
    loaded.checkpoints().map((c) => c.chain),
    world.checkpoints().map((c) => c.chain),
  );
  const done = saveWorld(world, ruleset);
  assert.deepEqual(verifyByReplay(done, build), { ok: true, problem: null });
});
