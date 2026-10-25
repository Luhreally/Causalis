import { test } from "node:test";
import assert from "node:assert/strict";
import type { WarsMap } from "../../src/bridge/index.ts";
import {
  LandWays,
  WAR_YEAR,
  globeInPlace,
  heartTown,
  landInPlace,
  tileOf,
  warNow,
  type LandGround,
  type LandPlay,
  type LandSpots,
} from "../../src/view/index.ts";

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

test("a war's year on the world's clock: thrown back, mustered, marching, drawn up, engaged at the turn", () => {
  const w = war(),
    at = (y: number) => warNow(w, y, 300)!;
  // Just after the turn its last battle was fought at: thrown back from it, the defenders holding.
  let n = at(300.01);
  assert.equal(n.attacker!.doing, "withdrawing");
  assert.equal(n.attacker!.from, P);
  assert.equal(n.attacker!.to, M);
  assert.equal(n.defender!.doing, "holding");
  assert.equal(n.fought!.outcome, "held");
  // Mustering again in its land nearest what it wants next; the defenders at their seat, the land
  // held by its own until they come.
  n = at(300.2);
  assert.equal(n.attacker!.doing, "mustering");
  assert.equal(n.attacker!.from, M);
  assert.ok(n.attacker!.gathered > 0.25 && n.attacker!.gathered < 1, "still gathering");
  assert.equal(n.defender!.doing, "garrisoned");
  assert.equal(n.defender!.from, SD);
  assert.equal(n.held, N);
  // On the march, the farther along the later.
  n = at(300.5);
  assert.equal(n.attacker!.doing, "marching");
  assert.equal(n.attacker!.words, "marching on Nirouv's land");
  const k5 = n.attacker!.k,
    k6 = at(300.6).attacker!.k;
  assert.ok(k5 > 0 && k5 < k6 && k6 < 1, `along its way: ${k5.toFixed(2)} then ${k6.toFixed(2)}`);
  assert.equal(at(300.6).defender!.doing, "rallying");
  // Drawn up before the land; engaged as the year ends, told how near the turn.
  n = at(300.9);
  assert.equal(n.attacker!.doing, "facing");
  assert.equal(n.defender!.doing, "facing");
  assert.equal(n.held, null, "the host has come: the garrison with it");
  assert.equal(n.closing?.engaged, false);
  n = at(300.97);
  assert.equal(n.attacker!.doing, "engaged");
  assert.equal(n.defender!.doing, "engaged");
  assert.ok(n.closing!.engaged && n.closing!.k > 0 && n.closing!.k < 1);
  assert.equal(n.closing!.spot, N);
  // Past the turn, its map not come yet: still engaged, at its very end.
  n = warNow(w, 301.2, 300)!;
  assert.equal(n.attacker!.doing, "engaged");
  assert.ok(n.closing!.k > 0.99);
});

test("after a battle won: the victors hold the field and march into the land taken, the beaten fly to their seat", () => {
  const w = war({
      battles: [{ spot: P, year: 299, won: true, fallen: 900, event: "evt:0:9", outcome: "taken" }],
    }),
    at = (y: number) => warNow(w, y, 300)!;
  let n = at(300.01);
  assert.equal(n.attacker!.doing, "holding");
  assert.equal(n.defender!.doing, "routed");
  assert.equal(n.defender!.to, SD);
  const fled = n.defender!.k;
  n = at(300.1);
  assert.equal(n.attacker!.doing, "entering");
  assert.equal(n.attacker!.words, "marching into Lithiv's land");
  assert.ok(n.attacker!.k > 0 && n.attacker!.k < 1);
  assert.ok(n.defender!.k > fled, "flying on");
  assert.ok(n.defender!.gathered < 1, "fewer as they fly");
  assert.equal(at(300.2).attacker!.doing, "mustering");
});

test("a seat besieged: its besiegers camp about it all year and storm its walls as the year ends", () => {
  const w = war({
      next: SD,
      siege: SD,
      battles: [
        {
          spot: SD,
          year: 299,
          won: true,
          fallen: 700,
          event: "evt:0:9",
          outcome: "siege",
          seat: true,
        },
      ],
    }),
    at = (y: number) => warNow(w, y, 300)!;
  let n = at(300.01);
  assert.equal(n.attacker!.doing, "holding");
  assert.equal(n.defender!.doing, "routed");
  assert.equal(n.defender!.to, SD, "fled into their seat");
  n = at(300.1);
  assert.equal(n.attacker!.doing, "besieging");
  assert.equal(n.defender!.doing, "besieged");
  n = at(300.5);
  assert.equal(n.attacker!.doing, "besieging");
  assert.equal(n.siege, SD);
  assert.equal(n.closing, null);
  n = at(300.97);
  assert.equal(n.attacker!.doing, "assaulting");
  assert.equal(n.attacker!.words, "storming the walls of Bluecairn's land");
  assert.ok(n.closing?.engaged);
});

test("at peace both hosts go home and stand down; a war ended before is not drawn", () => {
  const w = war({ ended: 299 }),
    at = (y: number) => warNow(w, y, 300)!;
  let n = at(300.25);
  assert.equal(n.attacker!.doing, "returning");
  assert.equal(n.attacker!.to, SA);
  assert.equal(n.defender!.doing, "returning");
  assert.equal(n.defender!.to, SD);
  assert.equal(n.siege, null);
  n = at(300.6);
  assert.equal(n.attacker, null, "stood down");
  assert.equal(n.defender, null);
  assert.equal(warNow(w, 301.5, 301), null);
});

test("a war declared at the turn musters from the year's start; one declared at a later turn is not yet", () => {
  const w = war({ declared: 299, battles: [] }),
    early = warNow(w, 300.05, 300)!,
    later = warNow(w, 300.25, 300)!;
  assert.equal(early.attacker!.doing, "mustering");
  assert.ok(early.attacker!.gathered < later.attacker!.gathered, "its host gathers");
  assert.equal(early.fought, null);
  assert.equal(warNow(war({ declared: 300, battles: [] }), 300.5, 300), null);
});

test("on the globe, each war's host is as far along its way as its year has gone", () => {
  const w = war(),
    at = (y: number) => globeInPlace(mapOf(w), y);
  const mustering = at(300.2),
    marching = at(300.6),
    drawn = at(300.9);
  assert.equal(mustering.marching.get(w.ref), 0);
  assert.equal(mustering.map.wars[0]!.to, N);
  const k = marching.marching.get(w.ref)!;
  assert.ok(k > 0 && k < 1, `on its way (${k.toFixed(2)})`);
  assert.equal(marching.map.wars[0]!.from, M);
  assert.equal(drawn.marching.get(w.ref), 1);
  assert.equal(drawn.map.wars[0]!.ended, null);
  // Gone home: drawn as ended.
  assert.notEqual(globeInPlace(mapOf(war({ ended: 299 })), 300.8).map.wars[0]!.ended, null);
});

// A land 32 tiles of a km a side, its town at the middle; a lake between it and the west edge,
// which the attacker comes in over; the attacker's muster beyond the map to the west.
const SIZE = 32;
const ground = (): LandGround => {
  const water = new Uint8Array(SIZE * SIZE);
  for (let j = 6; j <= 25; j++) for (let i = 8; i <= 10; i++) water[j * SIZE + i] = 3;
  return {
    size: SIZE,
    tileKm: 1,
    heights: new Float32Array(SIZE * SIZE),
    water,
    fertility: new Uint8Array(SIZE * SIZE).fill(200),
  };
};
const play = (g: LandGround): LandPlay => {
  const spots: LandSpots = {
    middle: N,
    here: (spot) => (spot === N ? { x: 0, z: 0 } : null),
    edgeToward: () => ({ x: -14, z: 0 }),
  };
  return {
    spots,
    ways: new LandWays(g),
    town: { x: 0, z: 0, r: 2 },
    sea: (x, z) => g.water[tileOf(g, x, z)] !== 0,
    colorOf: (c) => (c[0] > 0.5 ? 0 : 1),
  };
};

test("in a land a host marches on the town by the roads, round the water, and is drawn up before it", () => {
  const g = ground(),
    p = play(g),
    map = mapOf(war()),
    at = (y: number) => landInPlace(map, y, p, 0);
  // Mustering beyond the map: on the border, toward the town.
  const mustering = at(300.2).marks.find((m) => m.side === 0)!;
  assert.equal(mustering.doing, "mustering");
  assert.ok(mustering.x < -10, `at the western border (${mustering.x.toFixed(1)})`);
  // Coming in over the second half of its march: its column round the lake, never in it.
  const a = at(300.62),
    b = at(300.72),
    head = (n: typeof a) => n.marks.find((m) => m.side === 0)!;
  assert.equal(head(a).doing, "marching");
  const dist = (m: { x: number; z: number }) => Math.hypot(m.x, m.z),
    // (How far along the road from the border it is: at the road point nearest it.)
    road = p.ways.way({ x: -14, z: 0 }, { x: 0, z: 0 }),
    along = (m: { x: number; z: number }) => {
      let best = 0;
      road.line.forEach((q, i) => {
        if (
          Math.hypot(q.x - m.x, q.z - m.z) <
          Math.hypot(road.line[best]!.x - m.x, road.line[best]!.z - m.z)
        )
          best = i;
      });
      return road.run[best]!;
    };
  assert.ok(road.length > 20, `round the lake, not across it (${road.length.toFixed(1)} km)`);
  assert.ok(along(head(b)) > along(head(a)) + 2, "farther along the road as the year goes on");
  const marchers = [...a.figures, ...b.figures].filter((f) => f.side === 0);
  assert.ok(marchers.length > 10, `its column drawn (${marchers.length})`);
  assert.ok(
    marchers.every((f) => !f.afloat),
    "on the road round the lake, not across it",
  );
  // The land's own garrison holds the town meanwhile.
  assert.ok(a.figures.some((f) => f.side === 1 && Math.hypot(f.x, f.z) < 3));
  // Drawn up: the attacker before the town, the defenders between it and the town, both outside it.
  const drawn = at(300.9),
    att = drawn.marks.find((m) => m.side === 0)!,
    def = drawn.marks.find((m) => m.side === 1)!;
  assert.equal(att.doing, "facing");
  assert.equal(def.doing, "facing");
  assert.ok(dist(def) < dist(att), "the defenders nearer their town");
  assert.ok(dist(def) > 2, "out before its walls");
  assert.equal(drawn.fights.length, 1);
  assert.equal(drawn.fights[0]!.stage, "drawn");
  assert.ok(drawn.marks.every((m) => /host: /.test(m.name)));
});

test("in a land the fight the year ends in is told where it is fought, and its rout after the turn", () => {
  const g = ground(),
    p = play(g),
    w = war(),
    engaged = landInPlace(mapOf(w), 300.97, p, 0),
    fought = landInPlace(
      mapOf(
        {
          ...w,
          battles: [
            ...w.battles,
            { spot: N, year: 300, won: true, fallen: 1200, event: "evt:0:12", outcome: "taken" },
          ],
        },
        301,
      ),
      301.01,
      p,
      0,
    );
  const fight = engaged.fights[0]!;
  assert.equal(fight.stage, "engaged");
  assert.equal(fight.key, "war:0:7:301");
  // A few fall as it is fought.
  const late = landInPlace(mapOf(w), 300.995, p, 0);
  assert.ok(
    late.figures.some((f) => f.fallen),
    "some fall in the fight",
  );
  // After the turn: the same battle's rout, at its field; the beaten flying.
  const rout = fought.fights[0]!;
  assert.equal(rout.stage, "rout");
  assert.equal(rout.key, fight.key);
  const field = fought.fields.get("evt:0:12")!;
  assert.ok(Math.hypot(field.x - fight.x, field.z - fight.z) < 0.5, "fought where they stood");
  assert.equal(fought.marks.find((m) => m.side === 1)!.doing, "routed");
  assert.equal(fought.marks.find((m) => m.side === 0)!.doing, "holding");
  // The year's beats line up with the battle's turn.
  assert.ok(WAR_YEAR.engage > WAR_YEAR.marched && WAR_YEAR.rout < WAR_YEAR.after);
});

test("a land's battles are fought before its heart: its greatest town near its middle, else the nearest", () => {
  const town = (ref: string, x: number, population: number) => ({ ref, x, z: 0, population });
  assert.equal(
    heartTown([town("far", 140, 5000), town("near", 40, 900), town("mid", 20, 400)])!.ref,
    "near",
    "the greatest within reach, not the greatest at the edge",
  );
  assert.equal(heartTown([town("a", 120, 900), town("b", 90, 300)])!.ref, "b", "else the nearest");
  assert.equal(heartTown([]), null);
});
