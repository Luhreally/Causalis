import { test } from "node:test";
import assert from "node:assert/strict";
import { finish, mix } from "../../src/kernel/index.ts";
import {
  BODY_NATURE,
  HAND_ACT,
  HAND_TOLD,
  POSSESS_BOUNDS,
  POSSESS_HZ,
  WORK_STAGES,
  BODY_PLACES,
  bidLetters,
  bidsOf,
  copyLocal,
  handOffers,
  localBody,
  localWorld,
  stepLocal,
  type HandBid,
  type LocalDraw,
  type LocalScene,
  type LocalWorld,
} from "../../src/rules/index.ts";

/** A keyed draw for the tests: a pure function of its keys. */
const drawOf =
  (salt: number): LocalDraw =>
  (a, s, p, n = 0) =>
    (finish(mix(mix(mix(mix(salt, a >>> 0), s >>> 0), p >>> 0), n >>> 0), 8) >>> 0) / 2 ** 32;

/** A smith's yard: a forge before a smithy (a box), its rack, a granary; the possessed at the middle. */
const scene: LocalScene = {
  x: 0,
  z: 0,
  // (The smithy: a box 6 m by 4 m across its axis, 10 m north.)
  solids: [0, 14, 0, 1, 0, 3, 2],
  places: [
    { kind: "forge", x: 0, z: 9.5, yaw: 0 },
    { kind: "rack", x: 6, z: 9.5, yaw: 0 },
    { kind: "granary", x: -20, z: 0, yaw: Math.PI / 2 },
  ],
  trade: "smith",
  form: "sickle",
  care: 0.25,
};

const at = (x: number, z: number, yaw = 0) => ({ x, z, yaw, task: -1, pace: 1.25 });
function world(others: { x: number; z: number; nature?: number }[] = []): LocalWorld {
  return localWorld(0, [
    localBody(1, at(0, 0), 0, 1, [], true),
    ...others.map((o, i) =>
      localBody(10 + i, at(o.x, o.z, Math.PI), o.nature ?? 0, 1, [0, o.x, o.z, Math.PI, -1]),
    ),
  ]);
}
const go = (mx: number, mz: number, act = 0, run = false): HandBid => ({ mx, mz, run, act });
function run(l: LocalWorld, bids: HandBid[], draw = drawOf(1)): void {
  for (const b of bids) stepLocal(scene, l, b, draw);
}
const steps = (n: number, b: HandBid) => Array.from({ length: n }, () => b);

test("a step's bid is three letters, and back", () => {
  for (let mx = -31; mx <= 31; mx += 3)
    for (let mz = -31; mz <= 31; mz += 5)
      for (const act of [0, 1, 7, 15])
        for (const r of [false, true]) {
          const b = { mx, mz, run: r, act },
            letters = bidLetters(b);
          assert.equal(letters.length, 3);
          assert.deepEqual(bidsOf(letters), [b]);
        }
  assert.equal(bidsOf("AB"), null);
  assert.equal(bidsOf("A!A"), null);
});

test("the possessed walks where he is bid, runs faster, and is kept out of the smithy's walls", () => {
  const walk = world(),
    dash = world();
  run(walk, steps(POSSESS_HZ, go(31, 0)));
  run(dash, steps(POSSESS_HZ, go(31, 0, 0, true)));
  const a = walk.bodies[0]!,
    b = dash.bodies[0]!;
  assert.ok(a.x > 1 && a.x < 2, `a second's walk: ${a.x.toFixed(2)} m`);
  assert.ok(b.x > 2.5, `a second's run: ${b.x.toFixed(2)} m`);
  assert.ok(Math.abs(a.yaw - Math.PI / 2) < 0.05, "facing the way he goes (east)");
  // Straight at the smithy: he stops at its wall.
  const wall = world();
  run(wall, steps(10 * POSSESS_HZ, go(0, 31)));
  const w = wall.bodies[0]!;
  assert.ok(w.z < 14 - 2 + 0.01 && w.z > 11, `stopped by the smithy's wall at z ${w.z.toFixed(2)}`);
  // Never further than his bounds.
  const far = world();
  run(far, steps(120 * POSSESS_HZ, go(-31, 0, 0, true)));
  assert.ok(Math.hypot(far.bodies[0]!.x, far.bodies[0]!.z) <= POSSESS_BOUNDS + 1e-9);
});

test("the same scene, bids and draws give the same world, step for step", () => {
  const bids = [
    ...steps(30, go(10, 25)),
    go(0, 0, HAND_ACT.strike),
    ...steps(15, go(0, 0)),
    go(0, 0, HAND_ACT.talk),
    ...steps(40, go(-20, 5, 0, true)),
  ];
  const one = world([
      { x: 1, z: 3 },
      { x: -2, z: 6 },
      { x: 4, z: 1, nature: BODY_NATURE.brave },
    ]),
    two = world([
      { x: 1, z: 3 },
      { x: -2, z: 6 },
      { x: 4, z: 1, nature: BODY_NATURE.brave },
    ]);
  run(one, bids);
  // (Stepped half, copied, and stepped on: as the host steps ahead of what is kept.)
  run(two, bids.slice(0, 40));
  const ahead = copyLocal(two);
  run(ahead, bids.slice(40));
  run(two, bids.slice(40));
  assert.deepEqual(two, one);
  assert.deepEqual(ahead, one);
});

test("at his forge a smith makes the day's thing by hand, a stage at each act, and holds it", () => {
  const l = world();
  run(l, steps(5 * POSSESS_HZ, go(0, 31)));
  assert.equal(handOffers(scene, l)[0]!.act, HAND_ACT.work);
  assert.equal(handOffers(scene, l)[0]!.why, "");
  for (let k = 1; k <= WORK_STAGES; k++) {
    run(l, [go(0, 0, HAND_ACT.work)]);
    assert.equal(
      HAND_TOLD[l.told[0]!],
      k < WORK_STAGES ? "worked" : "made",
      `stage ${k}: ${HAND_TOLD[l.told[0]!]}`,
    );
    // (Busy at it a while: a bid to work again is not taken till the stage is done.)
    assert.equal(handOffers(scene, l)[0]!.why, "busy");
    run(l, steps(20, go(0, 0)));
  }
  assert.deepEqual(
    l.deeds.map((d) => d.kind),
    ["made"],
  );
  assert.equal(l.bodies[0]!.carry, -1, "the sickle in his hands");
  // Taken to the rack and hung there: the town's.
  run(l, steps(3 * POSSESS_HZ, go(31, 0)));
  const fits = handOffers(scene, l)[0]!;
  assert.equal(fits.act, HAND_ACT.drop);
  assert.equal(scene.places[fits.place]!.kind, "rack");
  run(l, [go(0, 0, HAND_ACT.drop)]);
  assert.equal(l.deeds.at(-1)!.kind, "gave");
  assert.equal(l.bodies[0]!.carry, 0);
});

test("away from his work, the act that fits says why he cannot work, and where it is", () => {
  const l = world(),
    o = handOffers(scene, l)[0]!;
  assert.equal(o.act, HAND_ACT.work);
  assert.equal(o.why, "no-place");
  assert.equal(scene.places[o.place]!.kind, "forge");
  const idle = handOffers({ ...scene, trade: "", form: "" }, l)[0]!;
  assert.equal(idle.why, "no-trade");
  run(l, [go(0, 0, HAND_ACT.work)]);
  assert.equal(HAND_TOLD[l.told[0]!], "no-place");
  assert.equal(l.deeds.length, 0);
});

test("a word to one before him moves their spirits, and they turn to hear it", () => {
  const l = world([{ x: 0, z: 1.5 }]);
  const o = handOffers(scene, l)[1]!;
  assert.equal(o.act, HAND_ACT.talk);
  assert.equal(o.target, 10);
  run(l, [go(0, 0, HAND_ACT.talk)]);
  const b = l.bodies[1]!;
  assert.ok(b.mood > 0.05, `heartened by ${b.mood.toFixed(3)}`);
  assert.equal(b.doing, "listen");
  assert.equal(l.deeds[0]!.kind, "spoke");
  // No one near: nothing said.
  const alone = world();
  run(alone, [go(0, 0, HAND_ACT.talk)]);
  assert.equal(HAND_TOLD[alone.told[0]!], "no-one");
});

test("blows struck down a man where the last landed; those about see it and answer", () => {
  const l = world([{ x: 0, z: 1.2 }, ...Array.from({ length: 8 }, (_, i) => ({ x: 6 + i, z: 4 }))]);
  for (let k = 0; k < 40 && !l.deeds.some((d) => d.kind === "struck"); k++) {
    // (Following him: he may flee or stand and fight.)
    const b = l.bodies.find((x) => x.id === 10)!,
      a = l.bodies[0]!,
      dx = b.x - a.x,
      dz = b.z - a.z,
      d = Math.hypot(dx, dz) || 1;
    run(l, [go((dx / d) * 31, (dz / d) * 31, d < 1.4 ? HAND_ACT.strike : 0, d > 3)]);
    run(l, steps(9, go((dx / d) * 31, (dz / d) * 31, 0, d > 3)));
  }
  const struck = l.deeds.find((d) => d.kind === "struck");
  assert.ok(struck && struck.kind === "struck", "struck down");
  assert.equal(struck.agent, 10);
  assert.equal(struck.by, 1);
  assert.ok(BODY_PLACES.includes(struck.place));
  assert.equal(struck.blow, "blunt");
  assert.equal(struck.arm, null);
  const b = l.bodies.find((x) => x.id === 10)!;
  assert.equal(b.doing, struck.dead ? "dead" : "down");
  // Those about saw it: their spirits lowered, some come, some flee, some look on.
  const others = l.bodies.slice(2);
  assert.ok(others.some((c) => c.mood < 0));
  assert.ok(others.some((c) => c.doing !== "way"));
});

test("goods taken from a store before others are a theft seen", () => {
  const l = world([
    { x: -18, z: 3 },
    { x: -22, z: -3 },
  ]);
  for (let k = 0; k < 30 * POSSESS_HZ && handOffers(scene, l)[0]!.act !== HAND_ACT.take; k++)
    run(l, [go(-31, 0)]);
  assert.equal(handOffers(scene, l)[0]!.act, HAND_ACT.take);
  run(l, [go(0, 0, HAND_ACT.take)]);
  const took = l.deeds[0]!;
  assert.equal(took.kind, "took");
  assert.ok(took.kind === "took" && took.seen === 2 && took.from === "granary");
  assert.equal(l.bodies[0]!.carry, 1, "a sack of grain");
});

test("a fight lost leaves the possessed struck down, and the small world ends", () => {
  // Three brave men, and he strikes them all, bare-handed and weakened.
  const l = world([
    { x: 0, z: 1.2, nature: BODY_NATURE.brave },
    { x: 1, z: 1.4, nature: BODY_NATURE.brave },
    { x: -1, z: 1.4, nature: BODY_NATURE.brave },
  ]);
  l.bodies[0]!.strength = 0.3;
  for (let k = 0; k < 60 && !l.ended; k++)
    run(l, [go(0, 0, HAND_ACT.strike), ...steps(9, go(0, 0))]);
  assert.equal(l.ended, "down");
  assert.ok(l.deeds.some((d) => d.kind === "struck" && d.agent === 1));
  assert.equal(handOffers(scene, l)[0]!.why, "down");
  const step = l.step;
  run(l, steps(5, go(31, 0)));
  assert.equal(l.step, step, "nothing more is stepped");
});
