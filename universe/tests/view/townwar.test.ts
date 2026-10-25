import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan, WarsMap } from "../../src/bridge/index.ts";
import { townWarNow, townWarScene, villageGround, type TownWar } from "../../src/view/index.ts";
import { OCC } from "../../src/rules/index.ts";

// Lands as spots of the globe's grid: the attacker's seat and its muster, the land it fought for
// last, the land it fights for next, the defender's seat.
const SA = 10,
  M = 11,
  P = 20,
  N = 21,
  SD = 30;
type War = WarsMap["wars"][number];
const war = (over: Partial<War> = {}): War => ({
  ref: "war:0:7",
  attacker: {
    ref: "pol:0:1",
    name: "the Reds",
    color: [0.8, 0.2, 0.2],
    fields: 3000,
    arms: null,
    host: { arm: "spear", guard: "shield", mount: "foot" },
  },
  defender: {
    ref: "pol:0:2",
    name: "the Blues",
    color: [0.2, 0.3, 0.8],
    fields: 2000,
    arms: null,
    host: { arm: "bow", guard: "leather", mount: "foot" },
  },
  from: M,
  to: N,
  declared: 296,
  ended: null,
  siege: null,
  next: N,
  muster: M,
  seats: { attacker: SA, defender: SD },
  places: [
    { spot: M, name: "Askar's land" },
    { spot: N, name: "Nirouv's land" },
    { spot: P, name: "Lithiv's land" },
    { spot: SA, name: "Redhold's land" },
    { spot: SD, name: "Bluecairn's land" },
  ],
  battles: [{ spot: P, year: 299, won: false, fallen: 300, event: "evt:0:9", outcome: "held" }],
  ...over,
});
const mapOf = (w: War, year = 300): WarsMap => ({ year, garrisons: [], wars: [w] });

const town: VillagePlan = {
  ref: "town:0:5",
  name: "Fieldham",
  population: 90,
  market: false,
  hand: false,
  districts: null,
  biome: 8,
  seed: 4,
  homes: Array.from({ length: 12 }, (_, k) => {
    const a = k * 2.399963,
      r = 16 + 8.5 * Math.sqrt(k);
    return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: null };
  }),
  fields: [{ x: 160, z: 20, w: 40, d: 25, yaw: 0 }],
  pasture: { x: -300, z: 0, r: 90 },
  wild: 400,
  water: null,
  house: { walls: "wattle", roof: "thatch", form: "round", pitch: 45, design: null },
  body: null,
  road: { x: 0, z: 1100 },
  people: [
    { ref: "prsn:0:1", name: "A B", home: 0, age: 30, occupation: OCC.farmer, child: false },
  ],
};
const EACH = 10;
/** A side's host as drawn (those there), and its fallen. */
const drawn = (tw: TownWar, side: 0 | 1) => {
  const s = townWarScene(town, tw, EACH).soldiers.slice(side * 2 * EACH, (side + 1) * 2 * EACH);
  return {
    host: s.slice(0, EACH).filter((q) => q.size > 0.5),
    dead: s.slice(EACH).filter((q) => q.size > 0.5),
  };
};
const mean = (qs: readonly { x: number; z: number }[]) => ({
  x: qs.reduce((a, q) => a + q.x, 0) / qs.length,
  z: qs.reduce((a, q) => a + q.z, 0) / qs.length,
});
/** How far out along the town's road a point lies (metres). */
const out = (q: { x: number; z: number }) => {
  const d = Math.hypot(town.road.x, town.road.z);
  return (q.x * town.road.x + q.z * town.road.z) / d;
};
const reach = villageGround(town).homesReach;

test("a land's muster: every town of it sees its men gathered past its homes, then marching out by its road", () => {
  const map = mapOf(war()),
    place = { spot: M, heart: false };
  // Mustering: some come in, more as the muster goes on, on open ground past the homes.
  const early = townWarNow(map, 300.17, place)!,
    later = townWarNow(map, 300.28, place)!;
  assert.equal(early.hosts[0]!.doing, "mustering");
  assert.match(early.words, /📯 The Reds: mustering for the war upon the Blues/);
  const a = drawn(early, 0).host,
    b = drawn(later, 0).host;
  assert.ok(a.length > 0 && b.length > a.length, `${a.length}, then ${b.length} mustered`);
  for (const q of b) assert.ok(Math.hypot(q.x, q.z) > reach, "past the homes");
  // Marching out: the head of the column out along the road, the rest behind it.
  const leaving = townWarNow(map, 300.36, place)!;
  assert.equal(leaving.hosts[0]!.doing, "leaving");
  const on = drawn(leaving, 0).host;
  assert.ok(
    on.some((q) => q.doing === "advance" && out(q) > reach + 30),
    "on the road out",
  );
  // Gone on: the town sees no more of it, nor of the battle (another land's).
  assert.equal(townWarNow(map, 300.6, place), null);
  assert.equal(townWarNow(map, 300.97, place), null);
});

test("before the land's heart: the hosts come by the road, draw up, close and fight as the year ends", () => {
  const map = mapOf(war()),
    place = { spot: N, heart: true };
  // Coming by the road at the march's end; the defenders come to hold the land.
  const coming = townWarNow(map, 300.8, place)!;
  assert.equal(coming.hosts.find((h) => h.side === 0)?.doing, "coming");
  // Drawn up: the attackers out along the road past the line, the defenders between it and the town.
  const facing = townWarNow(map, 300.86, place)!;
  assert.equal(facing.fight?.stage, "drawn");
  const A = mean(drawn(facing, 0).host),
    D = mean(drawn(facing, 1).host);
  assert.ok(out(A) > out(D) + 40, `${out(A).toFixed(0)} m against ${out(D).toFixed(0)} m`);
  assert.ok(out(D) > reach, "before the town, not in it");
  // Engaged: closed to the line between, fighting, some fallen.
  const fight = townWarNow(map, 300.99, place)!;
  assert.equal(fight.fight?.stage, "engaged");
  const a = drawn(fight, 0).host,
    d = drawn(fight, 1).host,
    gap = Math.abs(out(mean(a)) - out(mean(d)));
  assert.ok(gap < 10, `${gap.toFixed(1)} m apart`);
  assert.ok(a.some((q) => q.doing === "fight"));
  assert.ok(
    [...a, ...d].some((q) => q.doing === "fallen"),
    "some fallen",
  );
  // A town of the land not its heart sees none of it.
  assert.equal(townWarNow(map, 300.99, { spot: N, heart: false }), null);
});

test("at the turn the beaten fly, the fallen lie where they fell, and the victors hold the field and march in", () => {
  const before = mapOf(war()),
    place = { spot: N, heart: true },
    won = war({
      battles: [
        { spot: P, year: 299, won: false, fallen: 300, event: "evt:0:9", outcome: "held" },
        { spot: N, year: 300, won: true, fallen: 900, event: "evt:0:12", outcome: "taken" },
      ],
      next: P,
    }),
    after = mapOf(won, 301);
  // Those who fell in the fight lie where they fell, after it as in it.
  const fighting = townWarNow(before, 300.999, place)!,
    fell = [0, 1].flatMap((side) =>
      drawn(fighting, side as 0 | 1).host.filter((q) => q.doing === "fallen"),
    ),
    rout = townWarNow(after, 301.01, place)!;
  assert.equal(rout.fight?.stage, "rout");
  assert.equal(rout.fought?.outcome, "taken");
  const dead = [0, 1].flatMap((side) => drawn(rout, side as 0 | 1).dead);
  assert.ok(dead.length >= fell.length, `${dead.length} dead, ${fell.length} fell in the fight`);
  for (const q of fell)
    assert.ok(
      dead.some((x) => Math.hypot(x.x - q.x, x.z - q.z) < 0.01),
      "lying where they fell",
    );
  // The beaten (the defenders) more of them fallen.
  assert.ok(drawn(rout, 1).dead.length > drawn(rout, 0).dead.length);
  // The beaten in flight, away past the town; the victors holding the field.
  assert.equal(rout.hosts.find((h) => h.side === 1)?.doing, "fleeing");
  assert.equal(rout.hosts.find((h) => h.side === 0)?.doing, "holding");
  // Then marching into the town taken; the town burns a little.
  const entering = townWarNow(after, 301.1, place)!;
  assert.equal(entering.hosts.find((h) => h.side === 0)?.doing, "entering");
  assert.ok(entering.burning > 0 && entering.burning < 1);
  const late = townWarNow(after, 301.14, place)!,
    inside = drawn(late, 0).host;
  assert.ok(
    inside.some((q) => out(q) < reach),
    "come into the town",
  );
  // The fallen lie on through the year; the burning dies down.
  const autumn = townWarNow(after, 301.7, place)!;
  assert.ok(drawn(autumn, 1).dead.length > 0);
  assert.equal(autumn.burning, 0);
});

test("a siege: the besiegers camped about the town all year, the defenders on its walls; stormed at its end, it burns", () => {
  const sieged = war({ siege: SD, next: SD }),
    place = { spot: SD, heart: true },
    summer = townWarNow(mapOf(sieged), 300.5, place)!;
  assert.ok(summer.siege);
  assert.equal(summer.hosts.find((h) => h.side === 0)?.doing, "besieging");
  assert.equal(summer.hosts.find((h) => h.side === 1)?.doing, "besieged");
  const scene = townWarScene(town, summer, EACH);
  assert.equal(scene.tents.length, 12);
  for (const t of scene.tents)
    assert.ok(Math.hypot(t.x, t.z) > reach + 40, "about it, past its homes");
  const ring = drawn(summer, 0).host;
  // All about it, not on one side.
  const turns = new Set(
    ring.map((q) => Math.floor(((Math.atan2(q.z, q.x) + Math.PI) / (2 * Math.PI)) * 4)),
  );
  assert.equal(turns.size, 4, "on every side");
  // The storm: the besiegers at the walls, fighting.
  const storm = townWarNow(mapOf(sieged), 300.99, place)!;
  assert.equal(storm.hosts.find((h) => h.side === 0)?.doing, "assaulting");
  const at = drawn(storm, 0).host;
  assert.ok(
    at.every((q) => Math.hypot(q.x, q.z) < reach + 8),
    "at its walls",
  );
  assert.ok(at.some((q) => q.doing === "fight"));
  // Stormed at the turn: it burns, its fallen about its walls.
  const stormed = war({
      siege: null,
      next: null,
      battles: [
        { spot: SD, year: 299, won: true, fallen: 500, event: "evt:0:20", outcome: "siege" },
        {
          spot: SD,
          year: 300,
          won: true,
          fallen: 700,
          event: "evt:0:21",
          outcome: "stormed",
          seat: true,
        },
      ],
    }),
    fallen = townWarNow(mapOf(stormed, 301), 301.05, place)!;
  assert.equal(fallen.fought?.outcome, "stormed");
  assert.ok(fallen.fought?.walls, "fought about its walls");
  assert.equal(fallen.burning, 1);
  const lit = townWarScene(town, fallen, EACH);
  assert.ok(lit.fires.length >= 10, `${lit.fires.length} fires`);
  for (const q of drawn(fallen, 1).dead)
    assert.ok(Math.hypot(q.x, q.z) < reach + 4, "about its walls");
});

test("at the peace the men come home by the road to every town of their seat's land", () => {
  const peace = war({
      ended: 300,
      battles: [
        { spot: N, year: 300, won: false, fallen: 300, event: "evt:0:30", outcome: "held" },
      ],
    }),
    map = mapOf(peace, 301),
    place = { spot: SA, heart: false };
  // On the way, out of sight; come in by the road as the way ends; then gone to their doors.
  assert.equal(townWarNow(map, 301.2, place), null);
  const home = townWarNow(map, 301.43, place)!;
  assert.equal(home.hosts[0]!.doing, "home");
  assert.match(home.words, /come home from the war/);
  assert.ok(drawn(home, 0).host.length > 0);
  assert.equal(townWarNow(map, 301.6, place), null);
});
