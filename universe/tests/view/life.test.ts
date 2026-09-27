import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillageLife, VillagePlan } from "../../src/bridge/index.ts";
import {
  ACTIVITY,
  BODY_R,
  SIGNS,
  clearOf,
  figureOf,
  keepApart,
  limbPitch,
  momentOf,
  sayOf,
  villageGround,
  type Moment,
} from "../../src/view/index.ts";
import { OCC } from "../../src/rules/index.ts";

const DAY = 86_400,
  HOUR = 3_600;

const quiet: VillageLife = {
  fed: 1,
  growing: false,
  war: false,
  unrest: 0,
  faith: null,
  talk: ["weather", "food", "gossip"],
  site: null,
  mourning: [],
  newborn: [],
};

/** A village of forty: farmers, crafters, the young and the old, in ten homes about a square. */
function village(life: VillageLife): VillagePlan {
  const homes = Array.from({ length: 10 }, (_, k) => {
    const a = k * 2.399963,
      r = 16 + 8.5 * Math.sqrt(k);
    return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: `hhold:0:${k}` };
  });
  const people = Array.from({ length: 40 }, (_, i) => ({
    ref: `prsn:0:${i}`,
    name: `P${i} Test`,
    home: i % 10,
    age: i % 8 === 7 ? 9 : i % 8 === 6 ? 70 : 18 + ((i * 7) % 24),
    occupation: i % 8 === 7 ? OCC.dependent : i % 2 ? OCC.crafter : OCC.farmer,
    child: i % 8 === 7,
  }));
  return {
    ref: "town:0:9",
    name: "Lifeford",
    population: 200,
    market: false,
    hand: false,
    districts: null,
    biome: 8,
    seed: 3,
    homes,
    fields: [
      { x: 160, z: 0, w: 40, d: 25, yaw: 0 },
      { x: 150, z: 60, w: 40, d: 25, yaw: 0.2 },
    ],
    pasture: { x: -300, z: 0, r: 90 },
    wild: 400,
    water: { x: 0, z: -700 },
    house: { walls: "wattle", roof: "thatch", form: "round", pitch: 45, design: null },
    body: null,
    road: { x: 0, z: 1100 },
    people,
    life,
  };
}

const plan = village(quiet),
  workday = [10, 11, 12, 13, 14, 15, 16].find((d) => (d + (plan.seed % 7)) % 7 !== 0)!,
  everyone = (p: VillagePlan, t: number): Moment[] => p.people.map((_, i) => momentOf(p, i, t));

test("the fields are sown in spring, hoed through the summer and reaped at harvest", () => {
  const farmerAt = (day: number) =>
    everyone(plan, day * DAY + 10 * HOUR).filter(
      (m, i) => plan.people[i]!.occupation === OCC.farmer && m.activity === ACTIVITY.working,
    );
  const tasks = (day: number) => new Set(farmerAt(day).map((m) => m.task));
  // (The day of the year sets the season: a year of 365 days.)
  const spring = 365 * 3 + 90,
    summer = 365 * 3 + 160,
    harvest = 365 * 3 + 250;
  for (const [day, task] of [
    [spring, "sow"],
    [summer, "hoe"],
    [harvest, "reap"],
  ] as const) {
    const at = tasks(day + ((day + plan.seed) % 7 === 0 ? 1 : 0));
    assert.ok(at.has(task), `${task} on day ${day}: ${[...at]}`);
  }
});

test("as a village grows, its crafters build its next home: out with beams, round the rising walls", () => {
  const site = { x: 60, z: -40, yaw: 0.4, progress: 0.5 },
    growing = village({ ...quiet, growing: true, site, talk: ["building", ...quiet.talk] }),
    t = workday * DAY + 10 * HOUR;
  const builders = everyone(growing, t).filter((m) => m.task === "build");
  assert.ok(builders.length >= 5, `${builders.length} builders`);
  for (const b of builders) {
    const d = Math.hypot(b.x - site.x, b.z - site.z);
    assert.ok(d > 5 && d < 14, `a builder ${d.toFixed(1)} m from the walls`);
    // Facing the walls they build.
    const toward = Math.atan2(site.x - b.x, site.z - b.z),
      off = Math.abs(Math.atan2(Math.sin(b.yaw - toward), Math.cos(b.yaw - toward)));
    assert.ok(off < 0.5, `facing the walls (${off.toFixed(2)} off)`);
  }
  // Out to the site with a beam on the shoulder.
  let beams = 0;
  for (let s = 5 * HOUR; s < 10 * HOUR; s += 120)
    beams += everyone(growing, workday * DAY + s).filter((m) => m.carry === "beam").length;
  assert.ok(beams > 0, "beams carried to the site");
  // A village that does not grow builds nothing.
  assert.equal(everyone(plan, t).filter((m) => m.task === "build").length, 0);
});

test("while their realm is at war the young drill in ranks of an evening, spears in hand", () => {
  const war = village({ ...quiet, war: true, talk: ["war", ...quiet.talk] }),
    t = workday * DAY + 19.25 * HOUR,
    drilling = everyone(war, t).filter((m) => m.task === "drill");
  assert.ok(drilling.length >= 6, `${drilling.length} drilling`);
  // In ranks and files three paces apart, on open ground past the homes.
  const x0 = Math.min(...drilling.map((m) => m.x)),
    z0 = Math.min(...drilling.map((m) => m.z)),
    ground = villageGround(war);
  for (const m of drilling) {
    assert.equal(m.carry, "spear");
    assert.equal(m.yaw, 0, "the ranks face one way");
    const fx = (m.x - x0) / 3,
      fz = (m.z - z0) / 3;
    assert.ok(
      Math.abs(fx - Math.round(fx)) < 0.05 && Math.abs(fz - Math.round(fz)) < 0.05,
      `in rank (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`,
    );
    assert.ok(Math.hypot(m.x, m.z) > ground.homesReach, "past the homes");
  }
  // The children and the old do not drill; in peace, no one does.
  war.people.forEach((p, i) => {
    if (p.child || p.age >= 45) assert.notEqual(momentOf(war, i, t).task, "drill");
  });
  assert.equal(everyone(plan, t).filter((m) => m.task === "drill").length, 0);
});

test("in the square they talk in rings, facing one another; where grievance runs high, two come to blows", () => {
  const evenings = (p: VillagePlan) => {
    const seen: Moment[] = [];
    for (let d = 10; d < 40; d++) {
      for (const m of everyone(p, d * DAY + 19.25 * HOUR))
        if (m.activity === ACTIVITY.gathering) seen.push(m);
    }
    return seen;
  };
  const calm = evenings(plan);
  assert.ok(calm.length > 20, `${calm.length} evenings in the square`);
  for (const m of calm) {
    assert.equal(m.task, "talk");
    // Facing the middle of one of the rings about the square's middle.
    const ahead = { x: m.x + 2.6 * Math.sin(m.yaw), z: m.z + 2.6 * Math.cos(m.yaw) },
      ring = Math.hypot(ahead.x, ahead.z);
    assert.ok(Math.abs(ring - 7) < 0.2, `facing a ring's middle (${ring.toFixed(2)} m out)`);
  }
  const hot = evenings(village({ ...quiet, unrest: 0.8, talk: ["unrest", ...quiet.talk] }));
  const brawlers = hot.filter((m) => m.task === "brawl");
  assert.ok(brawlers.length >= 2, `${brawlers.length} brawls`);
  assert.equal(calm.filter((m) => m.task === "brawl").length, 0);
});

test("no one walks through a home or into the water", () => {
  const growing = village({
      ...quiet,
      growing: true,
      site: { x: 30, z: 30, yaw: 0, progress: 0.4 },
    }),
    ground = villageGround(growing),
    reach = 1.2;
  for (let s = 0; s < DAY; s += 60)
    everyone(growing, workday * DAY + s).forEach((m, i) => {
      if (m.hidden) return;
      for (const h of ground.homes)
        assert.ok(clearOf(h, m) >= reach - 1e-6, `${growing.people[i]!.name} in a home at ${s}`);
      assert.ok(
        Math.hypot(m.x - ground.lake!.x, m.z - ground.lake!.z) >= ground.lake!.r + reach - 1e-6,
      );
      assert.ok(Math.hypot(m.x - 30, m.z - 30) >= 5.5 + reach - 1e-6, "not in the rising walls");
    });
  // And they still walk, never leap.
  for (let i = 0; i < growing.people.length; i++) {
    let last = momentOf(growing, i, workday * DAY);
    for (let s = 10; s < DAY; s += 10) {
      const m = momentOf(growing, i, workday * DAY + s),
        step = Math.hypot(m.x - last.x, m.z - last.z);
      assert.ok(step <= 1.25 * 10 + 1, `${growing.people[i]!.name} leapt ${step.toFixed(1)} m`);
      last = m;
    }
  }
});

test("no one stands in anyone else: each steps aside, and never into a wall", () => {
  const busy = village({
      ...quiet,
      growing: true,
      war: true,
      site: { x: 30, z: 30, yaw: 0, progress: 0.4 },
    }),
    ground = villageGround(busy),
    gap = 2 * BODY_R;
  const knotted = (now: Moment[]) => {
    const live = now.filter((m) => !m.hidden);
    let n = 0;
    for (let a = 0; a < live.length; a++)
      for (let b = a + 1; b < live.length; b++)
        if (Math.hypot(live[a]!.x - live[b]!.x, live[a]!.z - live[b]!.z) < gap - 1e-6) n++;
    return n;
  };
  let knots = 0;
  for (let s = 0; s < DAY; s += 120) {
    const now = everyone(busy, workday * DAY + s),
      again = everyone(busy, workday * DAY + s);
    knots += knotted(now);
    keepApart(busy, now);
    assert.equal(knotted(now), 0, `people in one another at ${s}`);
    for (const m of now) {
      if (m.hidden) continue;
      for (const h of ground.homes) assert.ok(clearOf(h, m) >= 1.2 - 1e-6, `in a home at ${s}`);
    }
    // The same moments always settle the same way.
    keepApart(busy, again);
    assert.deepEqual(again, now);
  }
  assert.ok(knots > 0, "the day brings people together (so the stepping aside is tried)");
  // What stands fixed (a battle's soldiers) is stood clear of the whole way.
  const now = everyone(plan, workday * DAY + 12 * HOUR),
    who = now.findIndex((m) => !m.hidden),
    soldier = { x: now[who]!.x, z: now[who]!.z };
  keepApart(plan, now, [soldier]);
  assert.ok(Math.hypot(now[who]!.x - soldier.x, now[who]!.z - soldier.z) >= gap - 1e-6);
});

test("what they say is what their own year has brought, the most pressing most often", () => {
  const hungry = village({
      ...quiet,
      fed: 0.6,
      war: true,
      mourning: ["hhold:0:2"],
      talk: ["hunger", "war", "grief", ...quiet.talk],
    }),
    said = new Map<string, number>();
  for (let d = 10; d < 30; d++)
    for (let s = 0; s < 40; s += 1.3) {
      const t = d * DAY + 19.25 * HOUR;
      hungry.people.forEach((_, i) => {
        const m = momentOf(hungry, i, t);
        if (m.task !== "talk") return;
        const sign = sayOf(hungry, i, m, s + d * 100);
        if (sign) said.set(sign, (said.get(sign) ?? 0) + 1);
      });
    }
  const known = new Set(Object.values(SIGNS));
  for (const sign of said.keys()) assert.ok(known.has(sign), `a known sign: ${sign}`);
  const count = (sign: string) => said.get(sign) ?? 0;
  assert.ok(count(SIGNS.hunger!) > count(SIGNS.weather!), "hunger talked of more than weather");
  assert.ok(count(SIGNS.war!) > 0 && count(SIGNS.grief!) > 0);
  // In a quiet village there is no talk of hunger or war.
  let quietWar = 0;
  for (let s = 0; s < 400; s += 1.3)
    plan.people.forEach((_, i) => {
      const m = momentOf(plan, i, workday * DAY + 19.25 * HOUR);
      const sign = sayOf(plan, i, m, s);
      if (sign === SIGNS.war || sign === SIGNS.hunger) quietWar++;
    });
  assert.equal(quietWar, 0);
  // Asleep, no one says anything.
  plan.people.forEach((_, i) =>
    assert.equal(sayOf(plan, i, momentOf(plan, i, workday * DAY + 3 * HOUR), 12), null),
  );
});

test("each task moves the limbs its own way: the hoe raised in both hands, seed cast by one", () => {
  const parts = figureOf(null, 1).parts,
    arms = parts.filter((p) => p.role === "arm" && p.pivot === 0.09),
    legs = parts.filter((p) => p.role === "leg" && p.pivot === 0.12);
  assert.equal(arms.length, 2);
  assert.equal(legs.length, 2);
  const over = (task: Parameters<typeof limbPitch>[1], part: (typeof parts)[number]) => {
    let lo = Infinity,
      hi = -Infinity;
    for (let t = 0; t < 4; t += 0.05) {
      const a = limbPitch(part, task, false, t, 0);
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
    }
    return { lo, hi };
  };
  // Hoeing: both arms raised forward high, together.
  for (const a of arms) assert.ok(over("hoe", a).lo < -1.8);
  for (let t = 0; t < 2; t += 0.1)
    assert.equal(limbPitch(arms[0]!, "hoe", false, t, 0), limbPitch(arms[1]!, "hoe", false, t, 0));
  // Sowing: one arm casts, the other holds the seed.
  const [left, right] = arms[0]!.swing! > 0 ? [arms[1]!, arms[0]!] : [arms[0]!, arms[1]!];
  assert.ok(over("sow", right).hi - over("sow", right).lo > 0.9);
  assert.ok(over("sow", left).hi - over("sow", left).lo < 1e-9);
  // At the hoe the legs stand still; walking, they swing.
  for (const l of legs) {
    assert.equal(over("hoe", l).hi, 0);
    assert.ok(limbPitch(l, null, true, 0.1, 0) !== 0);
  }
});
