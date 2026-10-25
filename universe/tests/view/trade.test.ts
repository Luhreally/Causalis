import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan } from "../../src/bridge/index.ts";
import { OCC } from "../../src/rules/index.ts";
import {
  ACTIVITY,
  COME_BACK,
  SET_OUT,
  dayTold,
  marketDay,
  momentOf,
  restDay,
  storeOfGood,
  townDay,
  traderSeat,
  tripOn,
  villageSolids,
} from "../../src/view/index.ts";

// Phase 48 M210: the road's trade — a town's traders take its land's goods down the road to the
// lands it trades with, away a night or two, and come back with what those lands send it.

const DAY = 86_400,
  HOUR = 3_600,
  Y = 40 * 365;

const TRADERS = 6;
const people: VillagePlan["people"][number][] = Array.from({ length: 24 }, (_, i) => ({
  ref: `prsn:0:${i + 1}`,
  name: `P${i}`,
  home: i % 8,
  age: 30,
  occupation: i < TRADERS ? OCC.trader : [OCC.farmer, OCC.crafter][i % 2]!,
  child: false,
}));

const plan = {
  ref: "town:0:48",
  name: "Cheapside",
  population: 280,
  market: true,
  hand: false,
  districts: null,
  biome: 9,
  seed: 4,
  homes: Array.from({ length: 8 }, (_, k) => ({
    x: 24 * Math.cos(k * 0.8),
    z: 24 * Math.sin(k * 0.8),
    yaw: k,
    household: `hhold:0:${k + 1}`,
  })),
  fields: [{ x: 170, z: 10, w: 40, d: 25, yaw: 0 }],
  pasture: { x: 0, z: 220, r: 90 },
  wild: 320,
  water: null,
  house: { walls: "timber", roof: "thatch", form: "long", pitch: 45, design: null },
  body: null,
  road: { x: -600, z: 40 },
  era: "metal",
  people,
  works: { mine: null, well: null, factory: null },
  trade: {
    out: [
      { good: "grain", what: "grain", land: "Ulmar", count: 300 },
      { good: "wool", what: "wool", land: "Vesk", count: 80 },
    ],
    in: [
      { good: "copper", what: "copper", land: "Ulmar", count: 40 },
      { good: "pottery", what: "pottery", land: "Vesk", count: 20 },
    ],
  },
  life: {
    fed: 1,
    growing: true,
    war: false,
    unrest: 0,
    faith: null,
    talk: [],
    site: null,
    mourning: [],
    newborn: [],
  },
} as unknown as VillagePlan;

test("a trader's round: out once a round, never on a day of rest or of the market; a night or two away; back", () => {
  for (let seat = 0; seat < TRADERS; seat++) {
    let trips = 0;
    for (let d = Y; d < Y + 240; d++) {
      const on = tripOn(plan, seat, d);
      if (!on) continue;
      const { trip, part } = on;
      assert.ok(trip.out <= d && d <= trip.back);
      assert.equal(part, d === trip.out ? "out" : d === trip.back ? "back" : "away");
      assert.ok(trip.back - trip.out === 1 || trip.back - trip.out === 2);
      assert.ok(!restDay(plan, trip.out) && !marketDay(plan, trip.out), "set out on a day off");
      assert.ok(
        trip.home >= COME_BACK[0] * HOUR && trip.home <= COME_BACK[1] * HOUR,
        "back at an odd hour",
      );
      if (part === "out") trips++;
    }
    // (A round of five to eight days; some lost to the days off.)
    assert.ok(trips >= 18 && trips <= 48, `trader ${seat}: ${trips} trips in 240 days`);
  }
  // Not a trader, or no trade: no trips.
  assert.equal(traderSeat(plan, TRADERS), -1);
  assert.equal(tripOn(plan, -1, Y), null);
  const none = { ...plan, trade: undefined } as VillagePlan;
  for (let d = Y; d < Y + 30; d++) assert.equal(tripOn(none, 0, d), null);
});

test("where they go and what they carry follow the town's trade, the most traded the likeliest", () => {
  const lands = new Map<string, number>();
  for (let seat = 0; seat < TRADERS; seat++)
    for (let d = Y; d < Y + 2000; d++) {
      const on = tripOn(plan, seat, d);
      if (on?.part !== "out") continue;
      const { land, take, bring } = on.trip;
      lands.set(land, (lands.get(land) ?? 0) + 1);
      // (What they take is what goes there; what they bring, what comes from there.)
      assert.equal(take!.land, land);
      assert.equal(bring!.land, land);
      assert.equal(take!.what, land === "Ulmar" ? "grain" : "wool");
      assert.equal(bring!.what, land === "Ulmar" ? "copper" : "pottery");
    }
  const ulmar = lands.get("Ulmar") ?? 0,
    vesk = lands.get("Vesk") ?? 0;
  // (Ulmar's trade is 340 a year against Vesk's 100.)
  assert.ok(ulmar > vesk * 2 && vesk > 0, `${ulmar} to Ulmar, ${vesk} to Vesk`);
  assert.equal(storeOfGood("grain"), "granary");
  assert.equal(storeOfGood("copper"), "smithy");
  assert.equal(storeOfGood("wool"), "yard");
});

/** A trader's trip to Ulmar (grain out, copper back), two nights away. */
function ulmarTrip(): { index: number; out: number } {
  for (let seat = 0; seat < TRADERS; seat++)
    for (let d = Y; d < Y + 400; d++) {
      const on = tripOn(plan, seat, d);
      if (on?.part === "out" && on.trip.land === "Ulmar" && on.trip.back === d + 2)
        return { index: people.findIndex((_, i) => traderSeat(plan, i) === seat), out: d };
    }
  throw new Error("no such trip");
}

test("a trader's trip: loaded at the granary, down the road with a pack, away, back with copper to the smithy", () => {
  const { index, out } = ulmarTrip(),
    m = (d: number, h: number) => momentOf(plan, index, d * DAY + h * HOUR);
  // The day they set out: the grain loaded, and down the road with it.
  let loading = false,
    going = false;
  for (let h = SET_OUT; h < 12; h += 1 / 60) {
    const x = m(out, h);
    if (x.why === "Loading grain for Ulmar" && x.carry === "pack") loading = true;
    if (x.why === "Taking grain down the road to Ulmar" && x.carry === "pack") {
      assert.equal(x.activity, ACTIVITY.walking);
      going = true;
    }
  }
  assert.ok(loading && going, "not loaded and set out");
  // Gone by the afternoon: away, not drawn, all the next day too.
  const gone = m(out, 15);
  assert.ok(gone.hidden);
  assert.equal(gone.why, "On the road to Ulmar");
  for (const h of [3, 12, 20]) {
    const away = m(out + 1, h);
    assert.ok(away.hidden);
    assert.equal(away.why, "Away down the road, trading in Ulmar");
  }
  // The day they come back: away still of a morning; in of an afternoon with the copper, unloaded
  // at the smithy, and home to supper and bed.
  assert.ok(m(out + 2, 10).hidden);
  let back = false,
    unloading = false;
  for (let h = COME_BACK[0]; h < 20; h += 1 / 60) {
    const x = m(out + 2, h);
    if (x.why === "Back from Ulmar with copper" && x.carry === "pack" && !x.hidden) back = true;
    if (/^Unloading copper at /.test(x.why ?? "")) unloading = true;
  }
  assert.ok(back && unloading, "not back with the copper");
  assert.equal(m(out + 2, 23.9).activity, ACTIVITY.asleep);
});

test("a trader's days told: midnight to midnight with no gaps, the road in its lines", () => {
  const { index, out } = ulmarTrip();
  for (const d of [out, out + 1, out + 2]) {
    const lines = dayTold(plan, index, d);
    assert.equal(lines[0]!.from, 0);
    assert.equal(lines.at(-1)!.to, DAY);
    for (let k = 1; k < lines.length; k++)
      assert.ok(
        Math.abs(lines[k]!.from - lines[k - 1]!.to) < 1,
        `a gap before "${lines[k]!.words}"`,
      );
  }
  const words = (d: number) => dayTold(plan, index, d).map((l) => l.words);
  assert.ok(words(out).includes("Loading grain for Ulmar"));
  assert.equal(words(out).at(-1), "On the road to Ulmar");
  assert.deepEqual(words(out + 1), ["Away down the road, trading in Ulmar"]);
  assert.equal(words(out + 2)[0], "On the road back from Ulmar");
  assert.ok(words(out + 2).some((w) => /^Unloading copper at /.test(w)));
});

test("the town's day counts its traders on the road as such, on the working days they are", () => {
  let seen = 0;
  for (let d = Y; d < Y + 60; d++) {
    if (restDay(plan, d)) continue;
    const roles = townDay(plan, d, villageSolids(plan)).roles;
    for (let i = 0; i < TRADERS; i++) {
      const trading = roles[i]!.kind === "trade";
      assert.equal(trading, !!tripOn(plan, traderSeat(plan, i), d));
      if (trading) seen++;
    }
    assert.ok(roles.slice(TRADERS).every((r) => r.kind !== "trade"));
  }
  assert.ok(seen > 20, `${seen} trading`);
});
