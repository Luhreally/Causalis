import { test } from "node:test";
import assert from "node:assert/strict";
import { OCC } from "../../src/rules/index.ts";
import type { VillagePlan } from "../../src/bridge/index.ts";
import {
  ACTIVITY,
  dayTold,
  momentOf,
  restDay,
  townDay,
  villageSolids,
} from "../../src/view/index.ts";

// Phase 45 M207: a person's day told — what someone seen near is about from midnight to midnight,
// a line for each thing in turn, the walk to it folded into it, an errand run again and again one
// line with how many times.

const DAY = 86_400,
  HOUR = 3_600,
  Y = 40 * 365;

/** A village of sixteen homes, twelve fields about it, its farmers and crafters. */
const plan: VillagePlan = {
  ref: "vill:0:45",
  name: "Dayham",
  population: 300,
  market: false,
  hand: false,
  districts: null,
  biome: 9,
  seed: 7,
  homes: Array.from({ length: 16 }, (_, k) => {
    const a = k * 2.399963,
      r = 16 + 8.5 * Math.sqrt(k);
    return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: `hhold:0:${k}` };
  }),
  fields: Array.from({ length: 12 }, (_, k) => {
    const a = ((k - 5.5) / 12) * 2.6,
      r = 120 + (k % 3) * 45;
    return { x: r * Math.cos(a), z: r * Math.sin(a), w: 40, d: 25, yaw: a };
  }),
  pasture: { x: -150, z: 0, r: 60 },
  wild: 400,
  water: null,
  house: { walls: "timber", roof: "thatch", form: "square", pitch: 40, design: null },
  body: null,
  road: { x: 0, z: -500 },
  era: "farm",
  people: Array.from({ length: 48 }, (_, i) => ({
    ref: `prsn:0:${i}`,
    name: `P${i} Day`,
    home: i % 16,
    age: 20 + ((i * 7) % 30),
    occupation: i % 4 === 3 ? OCC.crafter : OCC.farmer,
    child: false,
  })),
  life: {
    fed: 1,
    growing: false,
    war: false,
    unrest: 0,
    faith: null,
    talk: [],
    site: null,
    mourning: [],
    newborn: [],
    fields: {
      rain: 1,
      sent: 0,
      sentFrom: 0,
      gift: 0,
      giftFrom: 0,
      soil: 1,
      vermin: 0,
      heat: 1,
      why: [],
    },
  },
};

/** A working day of the harvest weeks, its sheaves carried in from fields reaped before. */
let day = Y + 235;
while (restDay(plan, day)) day++;

test("a person's day told runs from midnight to midnight, each thing in turn, waking to sleep", () => {
  for (const i of [0, 3, 10, 21]) {
    const lines = dayTold(plan, i, day);
    assert.ok(lines.length >= 5, `${lines.length} lines`);
    assert.equal(lines[0]!.from, 0);
    assert.equal(lines.at(-1)!.to, DAY);
    for (let k = 1; k < lines.length; k++)
      assert.ok(
        Math.abs(lines[k]!.from - lines[k - 1]!.to) < 1,
        `a gap before "${lines[k]!.words}"`,
      );
    assert.equal(lines[0]!.words, "Asleep");
    assert.equal(lines[1]!.words, "Breakfast at home");
    assert.ok(lines.some((l) => l.words === "Supper at home, and the evening"));
    assert.equal(lines.at(-1)!.words, "Asleep");
  }
  // A crafter at their craft, morning and afternoon, their bread between.
  const craft = dayTold(plan, 3, day).map((l) => l.words);
  assert.ok(craft.filter((w) => w.startsWith("At their craft")).length === 2, craft.join(" / "));
});

test("an errand run again and again is one line, with how many times; the line at each moment is what they are about then", () => {
  const roles = townDay(plan, day, villageSolids(plan)).roles,
    carter = roles.findIndex((r) => r.kind === "cart");
  assert.ok(carter >= 0, "someone carrying in the sheaves");
  const lines = dayTold(plan, carter, day),
    loads = lines.filter((l) => l.words.startsWith("Taking up sheaves from the stooks"));
  assert.equal(loads.length, 2, "the morning's loads and the afternoon's");
  for (const l of loads) {
    assert.ok(l.times >= 4, `${l.times} loads`);
    assert.match(l.words, /stacking the sheaves in/);
  }
  // Through the day, someone not walking is about what the line of that moment tells.
  for (const i of [0, 3, carter]) {
    const told = dayTold(plan, i, day);
    for (let h = 0.25; h < 24; h += 0.25) {
      const s = h * HOUR,
        m = momentOf(plan, i, day * DAY + s);
      if (m.activity === ACTIVITY.walking || !m.why) continue;
      const line = told.find((l) => s >= l.from && s < l.to)!,
        why = m.why[0]!.toLowerCase() + m.why.slice(1);
      assert.ok(
        line.words.toLowerCase().includes(why.toLowerCase()),
        `at ${h} h: "${m.why}" not in "${line.words}"`,
      );
    }
  }
});
