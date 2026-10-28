// Phase 61: a soldier possessed as the page sees him — his fight stepped ahead by the bids not yet
// sent (the same fight the next second's command keeps), its acts and why each can or cannot be done,
// his strip and the battle's tally; let go, the battle the god fought drawn from his fight, its men's
// pages and the chronicle telling it by the hand, the battle laid again as it was when he was taken.
// Looking moves nothing. One world, one battle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type World } from "../../src/kernel/index.ts";
import { HELD_QUERIES, foughtFate, foughtBody } from "../../src/host/held.ts";
import { battleRoll } from "../../src/host/roll.ts";
import { battleNear } from "../../src/host/battle.ts";
import { chronicle } from "../../src/host/planet.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import type {
  FoughtNow,
  HeldLive,
  HeldSoldierNow,
  SoldierTakeArgs,
} from "../../src/bridge/index.ts";
import {
  FIGHT_ACT,
  HAND_ACT,
  POSSESS_HZ,
  bidLetters,
  type HandBid,
} from "../../src/rules/index.ts";
import { handOf, makePopulationWorld, warsOf, type SoldierArgs } from "../../src/sim/index.ts";

const world: World = makePopulationWorld(seedFromText("first light"), { start: "spread" });
let event = "";
for (let y = 30; y <= 70 && !event; y++) {
  world.runTo((y + 1) * YEAR + 1);
  for (const w of warsOf(world).all())
    for (const b of w.battles)
      if (!event && b.year === y && b.fielded && b.fell && Math.min(...b.fielded) >= 60)
        event = b.event;
}
const battle = warsOf(world)
  .all()
  .flatMap((w) => w.battles)
  .find((b) => b.event === event)!;
world.runTo((battle.year + 1) * YEAR + 8 * 3600 + 20 * 60 - 1);
const ask = <T>(type: string, args?: unknown) => HELD_QUERIES[type]!(world, args) as T,
  roll = battleRoll(world, event, 120)!,
  // He of the defenders who stood; before him one of the attackers' (each as the roll names him).
  him = roll.defender.stood[0]!,
  foes = [...roll.attacker.fell, ...roll.attacker.hurt, ...roll.attacker.stood].slice(0, 30),
  own = [...roll.defender.fell, ...roll.defender.hurt, ...roll.defender.stood.slice(1)].slice(
    0,
    29,
  );
// (What the page sends is what the sim takes.)
const sameShape: (a: SoldierTakeArgs) => SoldierArgs = (a) => a;
const args: SoldierTakeArgs = {
  battle: event,
  most: roll.most,
  per: roll.per,
  meet: 0,
  figure: 0,
  side: 1,
  ref: him.ref,
  name: him.name,
  town: roll.defender.towns[him.place]?.name ?? "",
  looses: ["none", "none"],
  mounted: [false, false],
  figures: [roll.attacker.figures.n, roll.defender.figures.n] as [number, number],
  before: [0, 0],
  bodies: [
    [0, 1, 0, 0, -Math.PI / 2, 0.5],
    ...own.map((_, i) => [
      1 + i,
      1,
      1.6 * Math.floor((i + 1) / 15),
      ((i % 15) - 7) * 1.2 || 9,
      -Math.PI / 2,
      0.5,
    ]),
    ...foes.map((_, i) => [
      100 + i,
      0,
      -1.2 - 1.6 * Math.floor(i / 15),
      ((i % 15) - 7) * 1.2,
      Math.PI / 2,
      0.5,
    ]),
  ].flat(),
  refs: [him.ref, ...own.map((e) => e.ref), ...foes.map((e) => e.ref)],
  names: [him.name, ...own.map((e) => e.name), ...foes.map((e) => e.name)],
};
const hashes = () => JSON.stringify(world.domainHashes());
const bid = (act = 0, mx = 0, mz = 0): HandBid => ({ mx, mz, run: false, act });
const fighting = Array.from({ length: POSSESS_HZ }, (_, i) =>
  bid(i % 12 === 0 ? HAND_ACT.strike : FIGHT_ACT.parry),
);

test("before a soldier is taken there is nothing to ask of; taken, he is his roll's man on its field", () => {
  assert.equal(ask("held.now"), null);
  assert.equal(ask("held.live", { steps: "" }), null);
  assert.ok(roll.defender.figures.n >= 1 && args.refs.length === args.bodies.length / 6);
  world.runTo(world.submit("possess.soldier", sameShape(args)).t);
  const now = ask<HeldSoldierNow>("held.now");
  assert.equal(now.kind, "soldier");
  assert.equal(now.name, him.name);
  assert.equal(now.battle, event);
  assert.equal(now.step, 0);
  assert.deepEqual(now.bodies.slice(0, 2), [0, 1]);
  assert.ok(Math.abs(now.second - 20) < 0.05, `taken at the battle's second ${now.second}`);
});

test("his fight stepped ahead by the bids not yet sent is the fight the next second keeps; looking moves nothing", () => {
  const before = hashes(),
    letters = fighting.map(bidLetters).join(""),
    ahead = ask<HeldLive>("held.live", { steps: letters }),
    half = ask<HeldLive>("held.live", { steps: letters.slice(0, 30) }),
    again = ask<HeldLive>("held.live", { steps: letters });
  assert.equal(hashes(), before, "asking keeps every hash");
  assert.equal(ahead.step, POSSESS_HZ);
  assert.equal(half.step, 10);
  assert.deepEqual(again.bodies, ahead.bodies, "asked twice, the same");
  // Its acts: a blow, a parry, a rally, flight — each a thumb's, each told why not where it cannot.
  assert.deepEqual(
    ahead.offers.slice(1).map((o) => o.label),
    ["Parry", "Rally", "Fly"],
  );
  assert.ok(["Strike", "Thrust", "Fire"].includes(ahead.offers[0]!.label), ahead.offers[0]!.label);
  for (const o of ahead.offers) assert.ok(o.can || o.words.length > 4, o.label);
  assert.match(ahead.strip.name, new RegExp(him.name.split(" ")[0]!));
  assert.ok(ahead.tally && ahead.tally.mine === 1 && ahead.tally.sides.length === 2);
  assert.ok(ahead.tally!.sides.every((s) => s.realm.length > 0 && s.standing > 0));
  // The second sent: the kept fight is the one asked ahead.
  const step = handOf(world).held!.kind === "soldier" ? 0 : -1;
  world.runTo(world.now + 59);
  world.runTo(world.submit("possess.held", { step, steps: letters }).t);
  const kept = ask<HeldLive>("held.live", { steps: "" });
  assert.equal(kept.step, POSSESS_HZ);
  assert.deepEqual(kept.bodies, ahead.bodies);
});

test("let go, the battle the god fought is drawn from his fight, its men's pages and the chronicle tell it by the hand", () => {
  // Fought on until one falls by his hand (or he does), then let go.
  for (let s = 0; s < 40; s++) {
    const h = handOf(world).held;
    if (!h || h.kind !== "soldier" || h.fight.deeds.some((d) => d.by === 0)) break;
    world.runTo(Math.max(world.now, h.from + (h.fight.step / POSSESS_HZ) * 60 - 1));
    world.runTo(
      world.submit("possess.held", {
        step: h.fight.step,
        steps: fighting.map(bidLetters).join(""),
      }).t,
    );
  }
  const h = handOf(world).held;
  if (h) {
    const c = world.submit("possess.leave", {
      step: h.kind === "soldier" ? h.fight.step : 0,
      steps: "",
    });
    world.runTo(c.t);
  }
  assert.equal(ask("held.now"), null);
  const fought = handOf(world).foughtOf(event)!,
    first = ask<FoughtNow>("held.fought", { battle: event, step: 0 }),
    end = ask<FoughtNow>("held.fought", { battle: event });
  assert.equal(first.step, fought.left.step > 0 ? fought.left.step : 0);
  assert.ok(end.step >= first.step && end.step === end.last);
  assert.equal(end.bodies.length, args.refs.length);
  assert.ok(end.broke >= 0, "fought out until a side broke");
  assert.equal(ask("held.fought", { battle: "ev:0:1" }), null);
  // His fate and those he struck down, by the hand.
  const mine = foughtFate(world, event, him.ref)!;
  assert.ok(mine.god);
  assert.match(mine.words, /^The god fought in his body/);
  const struck = fought.left.deeds.find((d) => d.by === 0);
  assert.ok(struck, "one fell by his hand");
  {
    const ref =
        args.refs[
          args.bodies.findIndex((_, i) => i % 6 === 0 && args.bodies[i] === struck.id) / 6
        ]!,
      theirs = foughtFate(world, event, ref)!;
    assert.ok(theirs.byGod);
    assert.match(theirs.words, /^Struck down by the god in /);
    const inspected = pageOf(world, ref),
      page = JSON.stringify(inspected),
      body = inspected.tabs.find((t) => t.id === "body")!.blocks.find((b) => b.type === "body");
    assert.match(page, /By your hand/);
    assert.ok(foughtBody(world, ref)?.struck.length);
    assert.ok(
      body?.type === "body" && body.members.some((m) => m.state !== "whole"),
      "the body inspector shows the god's actual blows",
    );
  }
  const page = JSON.stringify(pageOf(world, him.ref));
  assert.match(page, /By your hand/);
  assert.match(page, /The god fought in his body/);
  // The chronicle, by the hand: taken, and fought.
  const told = JSON.stringify(chronicle(world, 40, ["hand.soldier", "hand.fought"]));
  assert.match(told, /By your hand: the god took the body of /);
  assert.match(told, /By your hand: the god fought as /);
  // The battle laid again as it was when he was taken, the hand's part with it.
  const near = battleNear(world, event)!;
  assert.deepEqual(near.hand && [near.hand.name, near.hand.side, near.hand.figure], [
    him.name,
    1,
    0,
  ]);
  assert.equal(near.attacker.fallen, battle.fallen[0], "told as history had it before him");
});
