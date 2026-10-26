// The fixture town of the wounds' tests (Phase 55 M226, M229): the town of
// tests/view/war-funerals.test.ts — its fabric, lots and plan — and the same town with its wounds,
// its levy home and its healer.
import { HOME_MONTHS, LEVEL, OCC } from "../../src/rules/index.ts";
import {
  LAKE_R,
  townLots,
  type TownPlan,
  type VillagePlan,
  type Wound,
} from "../../src/bridge/index.ts";
export const DAY = 86_400,
  HOUR = 3_600;
/** A town of homes built in year 10, its plan of year 40. */
export const fabric: TownPlan = {
  family: "grid",
  seed: 11,
  axis: 0.3,
  lots: 480,
  whole: 480,
  runs: [
    [0, 0, 16, 10, 10, LEVEL.house, -1],
    [0, 64, 480, 10, 10, LEVEL.house, -1],
  ],
  civics: [{ kind: "temple", at: 40, lots: 8, start: 5, end: 6, fell: null }],
  walls: null,
  months: HOME_MONTHS,
  designs: [{ since: -1, walls: "timber", roof: "thatch", form: "square", pitch: 40 }],
  paved: false,
  water: { x: 420, z: 80, r: LAKE_R },
  year: 40,
};

export const lots = townLots(fabric.family, fabric.seed, fabric.axis, fabric.lots, fabric.water);
export function townOf(over: Partial<VillagePlan> = {}): VillagePlan {
  return {
    ref: "town:0:43",
    name: "Yewford",
    population: 2400,
    market: true,
    hand: false,
    districts: null,
    biome: 8,
    seed: 5,
    homes: Array.from({ length: 12 }, (_, k) => ({
      x: lots.x[70 + k * 6]!,
      z: lots.z[70 + k * 6]!,
      yaw: lots.yaw[70 + k * 6]!,
      household: `hhold:0:${k}`,
    })),
    fields: [
      { x: -420, z: 30, w: 40, d: 25, yaw: 0 },
      { x: -380, z: -160, w: 40, d: 25, yaw: 0.4 },
    ],
    pasture: { x: 30, z: 470, r: 90 },
    wild: 700,
    water: { x: 420, z: 80 },
    house: { walls: "timber", roof: "thatch", form: "square", pitch: 40, design: null },
    body: null,
    road: { x: 1100 * Math.cos(fabric.axis), z: 1100 * Math.sin(fabric.axis) },
    // Crafters and farmers; every ninth a child of eight.
    people: Array.from({ length: 54 }, (_, i) => ({
      ref: `prsn:0:${i}`,
      name: `P${i} Test`,
      home: i % 12,
      age: i % 9 === 8 ? 8 : 20 + ((i * 7) % 30),
      occupation: i % 9 === 8 ? OCC.dependent : i % 2 ? OCC.crafter : OCC.farmer,
      child: i % 9 === 8,
    })),
    town: fabric,
    // Thirty of its dead a year; four hundred in its graveyard; one of a watched household's
    // dead last year, by name.
    rest: {
      year: 40,
      perYear: 30,
      graves: 400,
      named: [{ name: "Ada Mill", year: 39, age: 61, home: 2 }],
    },
    ...over,
  };
}

/** The day the levy comes home: the plan's year 40, its first day. */
export const D0 = 40 * 365;
/** A wound of the battle at X, dealt at the turn of year 40 (8h), home that day (16h), up five days on, mended ten after. */
export const base: Wound = {
  event: "e",
  from: "battle",
  year: 39,
  where: "the battle at X",
  blow: "edge",
  arm: null,
  member: "arm-r",
  words: "~ right arm",
  outcome: "scarred",
  how: null,
  lasting: "scar",
  at: D0 * DAY + 8 * HOUR,
  home: D0 * DAY + 16 * HOUR,
  up: D0 * DAY + 16 * HOUR + 5 * DAY,
  mended: D0 * DAY + 16 * HOUR + 15 * DAY,
  tended: "healer",
  by: "by Yewford's healer, P1 Test",
  borne: false,
};
/** Away with the levy from the turn of year 40 till they come home that day at 16h. */
export const away = {
  event: "e",
  from: D0 * DAY,
  until: D0 * DAY + 16 * HOUR,
  where: "the battle at X",
};

/**
 * The town with its wounds (Phase 55 M226, M229): 0 away from D0 − 3 to D0 + 3; 1 the healer; 2, 3,
 * 4 and 5 home from the battle at X on D0 — 3 borne (a lost left leg), 4 wounded, 2 and 5 stood; 6
 * burned in a fire on D0 + 50, tended at home; 7 killed by a strike on D0 + 60; 9 hurt in a quake
 * on D0 − 1, tended by kin, no one else at home 9; 10 on a crutch these 300 days.
 */
export function woundedPlan(): VillagePlan {
  const t = townOf();
  const people = t.people.map((p) => ({ ...p })) as VillagePlan["people"][number][];
  people[0] = {
    ...people[0]!,
    away: [
      {
        event: "e2",
        from: (D0 - 3) * DAY,
        until: (D0 + 3) * DAY + 16 * HOUR,
        where: "the battle at Y",
      },
    ],
  };
  people[1] = { ...people[1]!, healer: { years: 6 } };
  people[2] = { ...people[2]!, away: [away] };
  people[3] = {
    ...people[3]!,
    away: [away],
    wounds: [
      {
        ...base,
        member: "leg-l",
        words: "~ left leg",
        outcome: "lost",
        how: "taken off",
        lasting: "crutch",
        borne: true,
      },
    ],
  };
  people[4] = { ...people[4]!, away: [away], wounds: [base] };
  people[5] = { ...people[5]!, away: [away] };
  const fire = (D0 + 50) * DAY + 11 * HOUR;
  people[6] = {
    ...people[6]!,
    wounds: [
      {
        ...base,
        from: "fire",
        event: "f",
        where: "the fire in Yewford",
        tended: "household",
        by: "at home",
        at: fire,
        home: fire,
        up: fire + 4 * DAY,
        mended: fire + 10 * DAY,
      },
    ],
  };
  people[7] = { ...people[7]!, gone: (D0 + 60) * DAY + 9 * HOUR };
  const quake = (D0 - 1) * DAY + 10 * HOUR;
  people[9] = {
    ...people[9]!,
    wounds: [
      {
        ...base,
        from: "quake",
        event: "q",
        where: "the quake at Yewford",
        tended: "kin",
        by: "by kin",
        at: quake,
        home: quake,
        up: quake + 6 * DAY,
        mended: quake + 12 * DAY,
      },
    ],
  };
  // (No one else at home 9.)
  for (const k of [21, 33, 45]) people[k] = { ...people[k]!, home: 10 };
  const old = {
    at: (D0 - 300) * DAY,
    home: (D0 - 300) * DAY,
    up: (D0 - 290) * DAY,
    mended: (D0 - 250) * DAY,
  };
  people[10] = {
    ...people[10]!,
    wounds: [
      {
        ...base,
        ...old,
        member: "leg-r",
        words: "~ right leg",
        outcome: "lost",
        how: "taken off",
        lasting: "crutch",
      },
    ],
  };
  return { ...t, people };
}

/** World seconds of a day's hour. */
export const at = (day: number, h: number) => day * DAY + h * HOUR;
