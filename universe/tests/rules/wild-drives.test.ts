// A beast's drives (2026-11-23): each beast keeps its needs (hunger, thirst, fear, weariness, the urge to breed) and does
// what the most pressing of them, weighed by its urgency and its body's temper, asks: one rule for every body. The
// possessed's needs move as the rest's; a body kept before beasts had needs is given them.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WILD_DRIVES,
  copyWild,
  stepWild,
  unpackWild,
  wildDrives,
  wildFrame,
  wildNeeds,
  wildTemper,
  wildWorld,
  type CreatureBody,
  type HandBid,
  type LocalDraw,
  type WildBody,
  type WildScene,
  type WildWorld,
} from "../../src/rules/index.ts";

const draw: LocalDraw = (subject, step, purpose, n = 0) => {
  let h =
    (Math.imul(subject ^ 0x9e3779b9, 0x85ebca6b) ^
      Math.imul(step + 0x632be5ab, 0xc2b2ae35) ^
      Math.imul(purpose * 31 + n, 0x27d4eb2f)) >>>
    0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const still: HandBid = { mx: 0, mz: 0, run: false, act: 0 };
const body = (size: number, moves: string, eats: string, features: string[] = []) =>
  ({
    size,
    moves,
    eats,
    level: eats === "flesh" ? 3 : 2,
    neck: 0.4,
    tail: 0.3,
    features,
    warm: true,
  }) as unknown as CreatureBody;

/** A held ox far off; its herd of eleven about (0, 0); a cat of no herd at `cat` m; water at (30, 0). */
function meadow(cat: number, wary = 0, heat = 0): { scene: WildScene; w: WildWorld } {
  const ox = wildFrame(body(300, "walk", "grass", ["horns"]), "grazer");
  const scene: WildScene = {
    kinds: [
      { frame: ox, niche: "grazer", temper: wildTemper(ox, wary, heat) },
      { frame: wildFrame(body(150, "run", "flesh", ["claws"]), "hunter"), niche: "hunter" },
    ],
    herds: [{ x: 0, z: 0, flock: false }],
    water: { x: 30, z: 0, r: 4 },
    pasture: null,
    x: -200,
    z: 0,
  };
  const packed = [0, 0, 0, -200, 0, 0];
  for (let i = 1; i <= 11; i++) packed.push(i, 0, 0, Math.cos(i) * 8, Math.sin(i) * 8, 0);
  packed.push(900000, 1, -1, cat, 0, 0);
  return { scene, w: wildWorld(unpackWild(packed)) };
}
const herd = (w: WildWorld) => w.bodies.slice(1, 12);
const set = (w: WildWorld, needs: Partial<WildBody>, cat: Partial<WildBody> = { hunger: 0 }) => {
  for (const b of herd(w)) Object.assign(b, needs);
  Object.assign(w.bodies[12]!, cat);
};
/** How many body-steps of the herd each drive was acted on, over so many steps. */
function tally(scene: WildScene, w: WildWorld, steps: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let s = 0; s < steps; s++) {
    stepWild(scene, w, still, draw);
    for (const b of herd(w)) {
      const d = WILD_DRIVES[b.drive]!;
      out[d] = (out[d] ?? 0) + 1;
    }
  }
  return out;
}
const calm = { hunger: 0.05, thirst: 0.05, tired: 0.05, urge: 0.05, fear: 0 };

test("a fed beast roams; a starved one eats, a parched one goes to the water and drinks, a weary one lies down", () => {
  const fed = meadow(200),
    starved = meadow(200),
    parched = meadow(200),
    weary = meadow(200);
  set(fed.w, calm);
  set(starved.w, { ...calm, hunger: 0.95 });
  set(parched.w, { ...calm, thirst: 0.95 });
  set(weary.w, { ...calm, tired: 0.95 });
  const a = tally(fed.scene, fed.w, 600),
    b = tally(starved.scene, starved.w, 600),
    c = tally(parched.scene, parched.w, 600),
    d = tally(weary.scene, weary.w, 600);
  assert.equal(a.roam, 600 * 11, "nothing presses a fed beast");
  assert.ok((b.eat ?? 0) > 600 * 11 * 0.3, `the starved eat: ${JSON.stringify(b)}`);
  assert.ok(
    herd(starved.w).every((x) => x.hunger < 0.95),
    "and are the fuller for it",
  );
  assert.ok((c.drink ?? 0) > 600 * 11 * 0.3, `the parched drink: ${JSON.stringify(c)}`);
  assert.ok(
    herd(parched.w).some((x) => x.doing === "drink" || x.thirst < 0.5),
    "they came to the water",
  );
  assert.ok((d.rest ?? 0) > 600 * 11 * 0.3, `the weary rest: ${JSON.stringify(d)}`);
  assert.ok(herd(weary.w).every((x) => x.tired < 0.95));
});

test("a hunter stalking near starts the herd off, the warier the sooner and the farther", () => {
  const runs = [0, 3].map((wary) => {
    const m = meadow(25, wary);
    set(m.w, calm, { hunger: 1 });
    let first = -1;
    for (let s = 0; s < 600; s++) {
      stepWild(m.scene, m.w, still, draw);
      if (first < 0 && herd(m.w).some((b) => WILD_DRIVES[b.drive] === "flee")) first = s;
    }
    const cat = m.w.bodies[12]!;
    assert.equal(cat.doing, "hunt", "a hungry hunter stalks");
    return {
      first,
      nearest: Math.min(...herd(m.w).map((b) => Math.hypot(b.x - cat.x, b.z - cat.z))),
    };
  });
  assert.ok(runs[0]!.first >= 0, "the unwary start too");
  assert.ok(runs[1]!.first <= runs[0]!.first, `warier, sooner: ${JSON.stringify(runs)}`);
  assert.ok(runs[1]!.nearest > runs[0]!.nearest, `and keep farther: ${JSON.stringify(runs)}`);
});

test("the most pressing need wins, weighed by its urgency; a need met is met to the full unless a threat breaks it", () => {
  const m = meadow(200);
  set(m.w, { ...calm, hunger: 0.6, thirst: 0.3 });
  const sc = wildDrives(m.scene, m.w, 1);
  assert.equal(WILD_DRIVES[sc.indexOf(Math.max(...sc))], "eat");
  // (Urgency rises faster than the need: twice as hungry weighs four times.)
  const b = m.w.bodies[1]!;
  b.hunger = 0.3;
  const low = wildDrives(m.scene, m.w, 1)[1]!;
  b.hunger = 0.6;
  assert.ok(Math.abs(wildDrives(m.scene, m.w, 1)[1]! / low - 4) < 1e-9);
  // Drinking, it drinks on below where roaming would have won, until it is slaked.
  const p = meadow(200);
  set(p.w, { ...calm, thirst: 0.9 });
  let left = -1;
  for (let s = 0; s < 1200 && left < 0; s++) {
    stepWild(p.scene, p.w, still, draw);
    const x = p.w.bodies[1]!;
    if (x.doing === "drink" && left < 0) left = -2;
    if (left === -2 && x.doing !== "drink") left = s;
  }
  assert.ok(p.w.bodies[1]!.thirst <= 0.1, `slaked: ${p.w.bodies[1]!.thirst}`);
});

test("a coat too thick for the warmth thirsts the sooner; a small body burns and breeds the faster", () => {
  const ox = wildFrame(body(300, "walk", "grass"), "grazer"),
    hare = wildFrame(body(3, "hop", "grass"), "seed-eater");
  assert.ok(wildTemper(hare).burn > wildTemper(ox).burn);
  assert.ok(wildTemper(hare).breed > wildTemper(ox).breed);
  assert.ok(wildTemper(hare).wary > wildTemper(ox).wary, "the small start the sooner");
  const cool = meadow(200, 0, 0),
    hot = meadow(200, 0, 2);
  set(cool.w, { ...calm, thirst: 0 });
  set(hot.w, { ...calm, thirst: 0 });
  for (let s = 0; s < 400; s++) {
    stepWild(cool.scene, cool.w, still, draw);
    stepWild(hot.scene, hot.w, still, draw);
  }
  assert.ok(hot.w.bodies[1]!.thirst > cool.w.bodies[1]!.thirst);
});

test("the possessed's needs move too, its hunger its fullness's other side; a body kept before needs is given them", () => {
  const m = meadow(200);
  const fed = m.w.fed;
  for (let s = 0; s < 200; s++) stepWild(m.scene, m.w, still, draw);
  const me = m.w.bodies[0]!;
  assert.ok(m.w.fed < fed, "standing, it grows hungry");
  assert.ok(Math.abs(me.hunger - (1 - m.w.fed)) < 1e-12);
  assert.deepEqual(Object.keys(wildNeeds(me)), ["hunger", "thirst", "fear", "tired", "urge"]);
  // (An old save's bodies: no needs.)
  const old = copyWild(m.w);
  for (const b of old.bodies)
    for (const k of ["hunger", "thirst", "fear", "tired", "urge", "drive", "foe"])
      delete (b as unknown as Record<string, unknown>)[k];
  const back = copyWild(old);
  assert.ok(back.bodies.every((b) => Number.isFinite(b.hunger) && b.foe === -1));
  stepWild(m.scene, back, still, draw);
  assert.ok(back.bodies.every((b) => Number.isFinite(b.hunger + b.thirst + b.tired + b.urge)));
});

test("the same draws step the same small world: drives are deterministic", () => {
  const a = meadow(40),
    b = meadow(40);
  for (let s = 0; s < 800; s++) {
    stepWild(a.scene, a.w, still, draw);
    stepWild(b.scene, b.w, still, draw);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(a.w)), JSON.parse(JSON.stringify(b.w)));
});
