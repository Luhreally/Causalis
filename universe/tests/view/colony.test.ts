import { test } from "node:test";
import assert from "node:assert/strict";
import type { ColonyLook, ColonyVoyage } from "../../src/bridge/index.ts";
import {
  colonyHeight,
  colonyHour,
  landingToShow,
  colonyRock,
  colonySky,
  crossingShare,
  descentAt,
  filmShots,
  filmWords,
  firstPods,
  growthAt,
  settlerAt,
  starHue,
  transferAt,
} from "../../src/view/index.ts";

const look = (over: Partial<ColonyLook> = {}): ColonyLook => ({
  body: "IVa",
  bodyRef: "body:0:9",
  kind: "moon",
  air: "none",
  water: "none",
  pressure: 0,
  gravity: 0.05,
  temperature: -80,
  tint: 0.4,
  icy: false,
  hall: 0,
  star: { temperature: 5700, disc: 0.34, light: 0.4 },
  over: { designation: "IV", kind: "giant", degrees: 22, tint: 0.3 },
  day: 90,
  founded: 1268,
  event: null,
  settlers: 500,
  keeps: ["air made and kept in sealed halls", "halls held at pressure against the empty sky"],
  ...over,
});
const voyage = (over: Partial<ColonyVoyage> = {}): ColonyVoyage => ({
  kind: "system",
  star: null,
  planet: null,
  body: 9,
  distance: 0,
  departed: 1268,
  arrives: 1268,
  arrived: true,
  days: 274,
  speed: 6.4,
  drive: null,
  event: null,
  ...over,
});

test("the landing shown first: long grown, under a great world", () => {
  const towns = [
    { founded: 1472, sky: 0 },
    { founded: 1228, sky: 22.9 },
    { founded: 1141, sky: 0 },
    { founded: 1400, sky: 30 },
  ];
  assert.equal(landingToShow(towns, 1500), towns[1]);
  assert.equal(landingToShow(towns.slice(2, 3), 1500), towns[2]);
  assert.equal(landingToShow([], 1500), null);
});

test("a world's sky goes by its air: black and hard with none, its own colour with much", () => {
  const none = colonySky(look({ air: "none" })),
    thin = colonySky(look({ air: "thin" })),
    thick = colonySky(look({ air: "thick" })),
    open = colonySky(look({ air: "breathable" }));
  assert.equal(none.airless, true);
  assert.equal(none.haze, null, "no air, no haze over its far ground");
  assert.ok(!thin.airless && thin.haze, "a thin air has a haze");
  assert.ok(thick.clearness < thin.clearness, "a thick air sees less far than a thin one");
  assert.notDeepEqual(open.stops, none.stops);
  // A dim star's noon is dimmer, a bright one's brighter, but neither blinds nor blacks out.
  const dim = colonySky(look({ star: { temperature: 3200, disc: 0.1, light: 0.01 } })),
    bright = colonySky(look({ star: { temperature: 9000, disc: 2, light: 40 } }));
  assert.ok(dim.strength >= 0.4 && dim.strength < bright.strength && bright.strength <= 1.3);
  // A cool star's light is redder than a hot one's.
  assert.ok(starHue(3200)[2] < starHue(9000)[2]);
});

test("a world's rock takes its colours, its ice its own; its hills stand off from its halls", () => {
  const r = colonyRock(look());
  for (const c of [r.rock, r.dark, r.light, r.ice, r.apron])
    for (const v of c) assert.ok(v >= 0 && v <= 1);
  assert.notDeepEqual(r.dark, r.light);
  assert.equal(colonyHeight(5, 10, 10, 60), 0, "flat where its halls stand");
  let highest = 0;
  for (let x = 100; x < 400; x += 17) highest = Math.max(highest, colonyHeight(5, x, 40, 60));
  assert.ok(highest > 3, `hills beyond them (${highest})`);
  assert.equal(colonyHeight(5, 200, 40, 60), colonyHeight(5, 200, 40, 60), "the same each time");
});

test("its day is its own: the eye comes down in its morning, whatever the home world's hour", () => {
  const h = colonyHour(look(), 0);
  assert.ok(h > 0.25 && h < 0.5, `its morning (${h})`);
  // A moon's long day turns slowly under the eye; a short one soon comes round.
  const long = colonyHour(look({ day: 1000 }), 3600) - h,
    short = colonyHour(look({ day: 10 }), 3600) - h;
  assert.ok(long > 0 && long < short);
  assert.ok(colonyHour(look({ day: 10 }), 36000 * 7.3) < 1);
});

test("a film's shots go in their order, and a young colony's years go by the sooner", () => {
  const old = filmShots(300).map((s) => s.stage);
  assert.deepEqual(old, ["crossing", "arrival", "descent", "first", "growth"]);
  const growth = (y: number) => filmShots(y).find((s) => s.stage === "growth")!.seconds;
  assert.ok(growth(1) < growth(10) && growth(10) < growth(300));
});

test("a ship's crossing runs from one world to the other, about its star as an orbit does", () => {
  assert.equal(crossingShare(0), 0);
  assert.equal(crossingShare(1), 1);
  assert.ok(crossingShare(0.1) < 0.1, "slow to start");
  const a = transferAt(6, 0, 0, 10, 0),
    b = transferAt(6, 0, 0, 10, 1),
    mid = transferAt(6, 0, 0, 10, 0.5);
  assert.ok(Math.hypot(a.x - 6, a.z) < 1e-9, "it leaves from the one");
  assert.ok(Math.hypot(b.x, b.z - 10) < 1e-9, "it comes to the other");
  assert.ok(Math.hypot(mid.x, mid.z) > 6 && Math.hypot(mid.x, mid.z) < 10, "between their orbits");
  // Prograde: it goes on round in the sense the worlds go, even to a world just behind.
  const behind = transferAt(6, 0, 6, -1, 0.5);
  assert.ok(behind.z > 0 || behind.x < 0, "not back across the short way");
});

test("a lander falls fast, brakes hard, and comes to rest on its pad", () => {
  const top = descentAt(0),
    half = descentAt(0.5),
    down = descentAt(1);
  assert.ok(top.high > 100 && top.short > 50, "from far overhead and well short of its pad");
  assert.ok(half.high < top.high / 2, "most of its height lost in the first half of its time");
  assert.equal(down.high, 0);
  assert.equal(down.short, 0);
  assert.equal(down.burn, 0, "its engines cut");
  assert.ok(descentAt(0.8).burn === 1, "burning hard near the ground");
});

test("those who came walk out to their pods, and stop short of them", () => {
  const pods = firstPods(24);
  for (let i = 0; i < 18; i++) {
    const pod = pods[i % 24]!,
      door = settlerAt(i, 0, pod),
      there = settlerAt(i, 1, pod);
    assert.equal(door.walking, false, "not out yet");
    assert.ok(door.y > 1, "at its door, up its ramp");
    assert.equal(there.walking, false, "come to rest");
    assert.ok(Math.hypot(there.x - pod.x, there.z - pod.z) >= pod.r, "outside the pod");
  }
  // Each pod a way off its lander's feet.
  for (const p of pods) assert.ok(Math.hypot(p.x, p.z) > 20);
});

test("a film of a town's growth: its frames in turn, the years counted on between them", () => {
  const years = [1200, 1210, 1300, 1500];
  assert.deepEqual(growthAt(years, 0), { frame: 0, year: 1200 });
  assert.deepEqual(growthAt(years, 1), { frame: 3, year: 1500 });
  assert.deepEqual(growthAt(years, 0.5), { frame: 1, year: 1255 });
  assert.deepEqual(growthAt([1400], 0.5), { frame: 0, year: 1400 });
  assert.equal(growthAt([], 0.5).frame, -1);
});

test("what a film says comes from what is known of that colony", () => {
  const near = filmWords("crossing", look(), voyage(), "the commonwealth of Sairis");
  assert.match(near, /commonwealth of Sairis/);
  assert.match(near, /IVa/);
  assert.match(near, /274 days/);
  assert.match(near, /6\.4 km\/s/);
  const far = filmWords(
    "crossing",
    look({ body: "d" }),
    voyage({ kind: "star", distance: 2.9, departed: 1850, arrives: 1866, drive: "antimatter" }),
    null,
  );
  assert.match(far, /Year 1850/);
  assert.match(far, /2\.9 light-years, 16 years under antimatter/);
  assert.match(far, /a realm long fallen/);
  const arrive = filmWords("arrival", look({ body: "d" }), voyage({ kind: "star" }), null);
  assert.match(arrive, /A world of another star/, "a letter alone names no one's world");
  assert.match(filmWords("descent", look(), voyage(), null), /own engines/);
  assert.match(filmWords("descent", look({ air: "thick" }), voyage(), null), /thick air/);
  assert.match(filmWords("first", look(), voyage(), null), /sealed halls/);
});
