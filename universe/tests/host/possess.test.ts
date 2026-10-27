import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type World } from "../../src/kernel/index.ts";
import { POSSESS_QUERIES } from "../../src/host/possess.ts";
import { chronicle } from "../../src/host/planet.ts";
import { withWounds } from "../../src/host/wounds.ts";
import { villagePlan } from "../../src/host/village.ts";
import {
  woundWords,
  type PossessLive,
  type PossessNow,
  type PossessTakeArgs,
  type VillagePlan,
} from "../../src/bridge/index.ts";
import { G, HAND_ACT, OCC, POSSESS_HZ, bidLetters, type HandBid } from "../../src/rules/index.ts";
import {
  handOf,
  makePopulationWorld,
  marketsOf,
  populationContext,
  type Agent,
  type TakeArgs,
} from "../../src/sim/index.ts";
import { cradleCell } from "../cradle.ts";

// Phase 60: one of a town's people possessed, as the page sees it — the small world stepped ahead
// by the bids not yet sent (the same world the next second's command keeps), its acts in words and
// why each can or cannot be done, the strip; a blow by hand laid over the town's plan as a wound;
// the chronicle telling the god walking among them. Looking moves nothing. One world, its people
// taken and let go in turn.

const world = makePopulationWorld(seedFromText("first light"));
world.runTo(245 * YEAR);
const town = populationContext(world).settlements.inProvince(cradleCell("first light"))[0]!;
world.runTo(world.submit("hand.lay", { village: town.ref }).t);
const hand = handOf(world).resting!,
  grown = (a: Agent) => 245 - a.birthYear >= 20 && 245 - a.birthYear < 45,
  smith = hand.agents.find((a) => grown(a) && a.occupation === OCC.crafter)!,
  folk = hand.agents.filter((a) => a !== smith && grown(a)).slice(0, 6),
  ask = <T>(type: string, args?: unknown) => POSSESS_QUERIES[type]!(world, args) as T,
  he = smith.sex === 0 ? "she" : "he";

/** The take: he at the middle facing north, his forge 9 m north, the rack beside it, a loom east, the granary west. */
function take(trade = "smith", form = "sickle"): PossessTakeArgs {
  return {
    agent: smith.id,
    at: { x: 0, z: 0, yaw: 0, task: -1, pace: 1.25 },
    trade,
    form,
    near: folk.map((a, i) => ({
      id: a.id,
      x: -12 + 3 * i,
      z: -6,
      yaw: 0,
      task: -1,
      pace: 1.25,
      ways: [0, -12 + 3 * i, -6, 0, -1],
    })),
    solids: [0, 14, 0, 1, 0, 3, 2],
    places: [
      { kind: "forge", x: 0, z: 9, yaw: 0 },
      { kind: "rack", x: 6, z: 9, yaw: 0 },
      { kind: "loom", x: 30, z: 0, yaw: 0 },
      { kind: "granary", x: -18, z: 0, yaw: Math.PI / 2 },
    ],
  };
}
// (What the page sends is what the sim takes.)
const sameShape: (a: PossessTakeArgs) => TakeArgs = (a) => a;

const go = (mx: number, mz: number, act = 0): HandBid => ({ mx, mz, run: false, act });
const steps = (n: number, b: HandBid) => Array.from({ length: n }, () => b);
function possess(trade?: string, form?: string): void {
  world.runTo(world.submit("possess.take", sameShape(take(trade, form))).t);
}
function send(bids: HandBid[]): void {
  for (let i = 0; i < bids.length; i += POSSESS_HZ) {
    const second = bids.slice(i, i + POSSESS_HZ);
    while (second.length < POSSESS_HZ) second.push(go(0, 0));
    const step = handOf(world).resting!.possessed!.local.step;
    world.runTo(world.submit("possess.input", { step, steps: second.map(bidLetters).join("") }).t);
  }
}
function release(): void {
  const step = handOf(world).resting!.possessed!.local.step;
  world.runTo(world.submit("possess.release", { step, steps: "" }).t);
}
const live = (steps = "") => ask<PossessLive>("possess.live", { steps });

test("the small world as the page sees it is the one the next second keeps: asked a step at a time, or whole", () => {
  assert.equal(ask("possess.now"), null);
  possess();
  const now = ask<PossessNow>("possess.now")!;
  assert.equal(now.agent, smith.id);
  assert.equal(now.ref, `agent:${smith.id}`);
  assert.equal(now.town, town.ref);
  assert.equal(now.step, 0);
  assert.equal(now.trade, "smith");
  assert.equal(now.bodies.length, 7);
  const bids = [...steps(12, go(0, 31)), go(0, 0, HAND_ACT.talk), ...steps(7, go(-20, 10))],
    letters = bids.map(bidLetters).join(""),
    before = JSON.stringify(world.domainHashes());
  // Asked a step at a time (as the page asks), and whole.
  let seen: PossessLive | null = null;
  for (let k = 1; k <= POSSESS_HZ; k++) seen = live(letters.slice(0, 3 * k));
  live("");
  const whole = live(letters);
  assert.deepEqual(seen, whole);
  assert.equal(seen!.step, POSSESS_HZ);
  assert.equal(seen!.kept, 0);
  assert.equal(JSON.stringify(world.domainHashes()), before, "looking moves nothing");
  // Sent: the kept world stands where the page saw it.
  send(bids);
  const kept = live();
  assert.equal(kept.kept, POSSESS_HZ);
  assert.deepEqual(kept.bodies, seen!.bodies);
  assert.equal(live("AB"), null, "not bids");
  release();
});

test("each act under the thumb says what it would do, or why it cannot be done here", () => {
  possess();
  let seen = live();
  const [work, talk, strike, wrestle] = seen.offers;
  assert.equal(work!.label, "Forge");
  assert.equal(work!.can, false);
  assert.equal(work!.words, `No forge here: ${he} is a smith — the nearest is 9 m ahead`);
  assert.deepEqual([talk!.label, strike!.label, wrestle!.label], ["Talk", "Strike", "Wrestle"]);
  assert.equal(talk!.words, `No one before ${he === "he" ? "him" : "her"} to talk to`);
  assert.match(seen.strip.what, /^a smith of .+, \d+$/);
  assert.equal(seen.strip.carries, "empty-handed");
  assert.equal(seen.strip.body, "Whole");
  // North to the forge: the work is there, and its first act told.
  send(steps(5 * POSSESS_HZ, go(0, 31)));
  seen = live();
  assert.equal(seen.offers[0]!.can, true);
  assert.equal(seen.offers[0]!.words, "Work at the forge: stage 1 of 4 of a sickle");
  seen = live(bidLetters(go(0, 0, HAND_ACT.work)));
  assert.equal(seen.told!.words, "The sickle: stage 1 of 4 done");
  assert.equal(seen.told!.good, true);
  release();
  // A weaver at the forge: not his; where his loom is.
  possess("weaver", "cloth");
  send(steps(5 * POSSESS_HZ, go(0, 31)));
  const weaver = live().offers[0]!;
  assert.equal(weaver.label, "Weave");
  assert.match(
    weaver.words,
    new RegExp(
      `^No loom here: ${he} is a weaver, and the forge is a smith's — the nearest is \\d+ m (ahead|behind (him|her)|to (his|her) (left|right))$`,
    ),
  );
  release();
});

test("goods taken are told, and what he carries is on the strip", () => {
  possess();
  const market = marketsOf(world).get(hand.cell)!,
    grain = market.stock[G.grain]!;
  let seen = live();
  for (let k = 0; k < 30 && !/^Take/.test(seen.offers[0]!.label); k++) {
    send(steps(POSSESS_HZ, go(-31, 0)));
    seen = live();
  }
  assert.equal(seen.offers[0]!.label, "Take grain");
  assert.equal(
    seen.offers[0]!.words,
    "Take a sack of grain from the granary: a theft, if anyone sees",
  );
  seen = live(bidLetters(go(0, 0, HAND_ACT.take)));
  assert.match(seen.told!.words, /took a sack of grain/);
  assert.equal(seen.strip.carries, "a sack of grain");
  assert.equal(seen.bodies[0]!.carry, "sack");
  assert.equal(market.stock[G.grain], grain, "not taken till it is sent");
  release();
});

test("a blow by hand is laid over the town's plan as a wound on the part it landed, told as a brawl's", () => {
  const victim = folk[0]!;
  victim.struck = [
    {
      event: hand.event,
      at: world.now,
      blow: "edge",
      place: "arm-l",
      maimed: false,
      arm: "sickle",
      by: "Aric",
    },
  ];
  const plan = withWounds(world, {
      ref: town.ref,
      hand: true,
      people: [victim, smith].map((a, i) => ({
        ref: `agent:${a.id}`,
        name: `${i}`,
        home: i,
        age: 245 - a.birthYear,
        occupation: a.occupation,
        child: false,
        sex: a.sex,
      })),
    } as unknown as VillagePlan),
    p = plan.people[0]!,
    wound = p.wounds![0]!;
  assert.equal(plan.people[1]!.wounds, undefined, "only those struck");
  assert.equal(wound.from, "hand");
  assert.equal(wound.member, "arm-l");
  assert.equal(wound.arm, "a sickle");
  assert.ok(wound.up > wound.at, "abed a while");
  assert.match(woundWords(wound, p.sex), / in a brawl in .+ in year 245, by a sickle; /);
  // One struck before, possessed: the strip tells it, the member in his people's own words.
  smith.struck = [{ ...victim.struck[0]!, place: "leg-r", maimed: true }];
  delete victim.struck;
  possess();
  assert.match(live().strip.body, /^Lost (his|her) right leg in a brawl in .+ in 245$/);
  release();
  delete smith.struck;
});

test("the chronicle tells the god walking among them, and letting go", () => {
  possess();
  send(steps(POSSESS_HZ, go(0, 31)));
  release();
  assert.equal(ask("possess.now"), null);
  assert.equal(live(), null);
  const told = chronicle(world, 30).events;
  assert.ok(
    told.some(
      (e) =>
        e.type === "hand.possessed" &&
        /^By your hand: you walked among the people of .+ as .+ the smith, year 245$/.test(e.claim),
    ),
    JSON.stringify(told.slice(0, 4)),
  );
  assert.ok(told.some((e) => e.type === "hand.released"));
});

test("the town under the hand draws as many of its people as the setting does, and all of the small world", () => {
  const drawn = (folk: number) => villagePlan(world, town.ref, 10, folk).people.map((p) => p.ref);
  // (Below High as many as the setting draws of a crowd, and those of them named; from High up,
  // or none asked, the hand's 400.)
  const named = handOf(world).resting!.agents.filter((a) => a.name !== undefined).length;
  assert.equal(drawn(220).length, drawn(0).length);
  assert.equal(drawn(360).length, drawn(0).length);
  for (const folk of [48, 120])
    assert.ok(drawn(folk).length <= folk + named, `${folk}: ${drawn(folk).length}`);
  assert.ok(drawn(48).length < drawn(120).length && drawn(120).length < drawn(220).length);
  possess();
  const held = handOf(world).resting!.possessed!.local.bodies.map((b) => `agent:${b.id}`),
    low = new Set(drawn(48));
  assert.ok(held.length > 1);
  for (const ref of held) assert.ok(low.has(ref), `${ref}, of the small world, not drawn at Low`);
  release();
});
