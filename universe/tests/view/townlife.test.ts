// A town's goings as its day shows them (view/townlife.ts, laid into each one's day by view/village.ts): pure, and nothing where
// the plan names nothing. A village of forty about its square, given by hand a circle that meets, a lodge behind closed doors, a
// corner kept, a collector and two who pay, and a soldier posted who is not of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { TownGoing, VillageLife, VillagePlan } from "../../src/bridge/index.ts";
import {
  LIFE_HOURS,
  dayTold,
  goingHeld,
  goingsNow,
  goingsOn,
  lifeParts,
  momentOf,
  personGroup,
  restDay,
  squareNow,
  villageSolids,
  workTold,
} from "../../src/view/index.ts";
import { OCC } from "../../src/rules/index.ts";

const DAY = 86_400,
  HOUR = 3_600;

function village(goings: readonly TownGoing[], soldier = false): VillagePlan {
  const life: VillageLife = {
    fed: 1,
    growing: false,
    war: false,
    unrest: 0,
    faith: null,
    talk: ["weather", "food", "gossip"],
    site: null,
    mourning: [],
    newborn: [],
    feasts: [],
  };
  const homes = Array.from({ length: 10 }, (_, k) => {
    const a = k * 2.399963,
      r = 16 + 8.5 * Math.sqrt(k);
    return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: `hhold:0:${k}` };
  });
  const people: VillagePlan["people"][number][] = Array.from({ length: 40 }, (_, i) => ({
    ref: `prsn:0:${i}`,
    name: `P${i} Test`,
    home: i % 10,
    age: i % 8 === 7 ? 9 : i % 8 === 6 ? 70 : 18 + ((i * 7) % 24),
    occupation:
      i % 8 === 7 ? OCC.dependent : i % 8 === 5 ? OCC.trader : i % 2 ? OCC.crafter : OCC.farmer,
    child: i % 8 === 7,
  }));
  if (soldier)
    people.push({
      ref: "out:uop:x:0",
      page: "uop:x",
      name: "A soldier of Testland",
      home: 0,
      age: 24,
      occupation: OCC.dependent,
      child: false,
      folk: true,
      outsider: true,
    });
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
    ...(goings.length ? { goings } : {}),
  };
}

const circle: TownGoing = {
    kind: "meeting",
    key: "org:circle|town:0:9",
    of: { ref: "org:circle", name: "the Voto lending circle" },
    words: "The Voto lending circle holds its meeting",
    doing: "At the meeting of the Voto lending circle",
    why: "223 members",
    who: ["prsn:0:0", "prsn:0:1", "prsn:0:2", "prsn:0:3"],
    where: "home",
  },
  lodge: TownGoing = {
    kind: "meeting",
    key: "org:lodge|town:0:9",
    of: { ref: "org:lodge", name: "the Luthon lodge" },
    words: "The Luthon lodge meets behind closed doors",
    doing: "Gone in to the meeting of the Luthon lodge, behind closed doors",
    why: "303 members",
    who: ["prsn:0:8", "prsn:0:9", "prsn:0:10"],
    where: "home",
    closed: true,
  },
  corner: TownGoing = {
    kind: "corner",
    key: "pol:1|town:0:9|corner",
    of: { ref: "gfed:1", name: "the Ash federation" },
    words: "A corner is held by a gang of the Ash federation",
    doing: "Keeping a corner with a gang of the Ash federation",
    watch: "On watch down the street for a gang of the Ash federation",
    why: "five small gangs",
    who: ["prsn:0:16", "prsn:0:17", "prsn:0:18", "prsn:0:19"],
    where: "corner",
  },
  collect: TownGoing = {
    kind: "collect",
    key: "mob:1|town:0:9|collect",
    of: { ref: "mob:1", name: "the Varro family" },
    words: "The Varro family takes payment from those who trade here",
    doing: "Collecting for the Varro family, from those who pay it to be left to trade",
    toDoing: "Paying the Varro family's collector what is asked, to be left to trade",
    why: "20% of this land's trade is under its protection",
    who: ["prsn:0:24"],
    to: ["prsn:0:25", "prsn:0:27", "prsn:0:33"],
    where: "market",
  },
  posted: TownGoing = {
    kind: "posted",
    key: "uop:x|town:0:9",
    of: { ref: "uop:x", name: "the soldiers sent against the Varro family" },
    words: "Soldiers are posted in its streets",
    doing:
      "Posted in the streets: one of 600 soldiers sent into this land against the Varro family",
    why: "600 sent",
    who: ["out:uop:x:0"],
    where: "square",
  };

const all = [circle, lodge, corner, collect, posted],
  quiet = village([]),
  busy = village(all, true),
  ground = villageSolids(busy),
  index = (ref: string) => busy.people.findIndex((p) => p.ref === ref),
  /** The first working day from 30 a going is held on. */
  dayOf = (g: TownGoing) => {
    for (let d = 30; d < 60; d++) if (goingHeld(busy, g, d) && !restDay(busy, d)) return d;
    throw new Error(`never held: ${g.key}`);
  };

test("a quiet village has none: no part for anyone, nothing on, no one's day says whose it is", () => {
  for (let d = 30; d < 37; d++) {
    assert.equal(goingsOn(quiet, d, villageSolids(quiet)).length, 0);
    quiet.people.forEach((_, i) => {
      assert.equal(lifeParts(quiet, i, d, villageSolids(quiet)).length, 0);
      for (const h of [9, 12, 16, 19, 20.5])
        assert.ok(!momentOf(quiet, i, d * DAY + h * HOUR).of, `P${i} day ${d} at ${h}`);
    });
  }
});

test("those a going does not name are where they would be without it, to the metre", () => {
  const named = new Set(all.flatMap((g) => [...g.who, ...(g.to ?? [])]));
  for (let d = 30; d < 37; d++)
    quiet.people.forEach((p, i) => {
      if (named.has(p.ref)) return;
      for (const h of [7, 9.5, 12, 15.5, 18.5, 19.5, 20.5, 22]) {
        const a = momentOf(quiet, i, d * DAY + h * HOUR),
          b = momentOf(busy, i, d * DAY + h * HOUR);
        assert.deepEqual(
          [b.x, b.z, b.activity, b.why],
          [a.x, a.z, a.activity, a.why],
          `${p.ref} day ${d} at ${h}`,
        );
      }
    });
});

test("a circle meets one day in seven of an evening: its members together, each saying whose meeting it is", () => {
  const d = dayOf(circle),
    held = [0, 1, 2, 3, 4, 5, 6].filter((k) => goingHeld(busy, circle, d + k));
  assert.deepEqual(held, [0], "one day in seven");
  const t = d * DAY + (LIFE_HOURS.meeting[0] + 1) * HOUR,
    at = circle.who.map((ref) => momentOf(busy, index(ref), t));
  for (const m of at) {
    assert.equal(m.why, circle.doing);
    assert.deepEqual(m.of, circle.of);
    assert.equal(m.hidden, false);
  }
  for (const m of at)
    assert.ok(Math.hypot(m.x - at[0]!.x, m.z - at[0]!.z) < 9, "gathered in one place");
  // Before it, and the day after, their day is their own.
  for (const ref of circle.who) {
    assert.ok(!momentOf(busy, index(ref), d * DAY + 10 * HOUR).of);
    assert.ok(!momentOf(busy, index(ref), (d + 1) * DAY + 19 * HOUR).of);
  }
  assert.match(
    workTold(busy, index(circle.who[0]!), d) ?? "",
    /at the meeting of the Voto lending circle$/,
  );
  assert.equal(
    goingsNow(busy, t, ground).some((g) => g.going === circle),
    true,
  );
});

test("a lodge's people go in behind closed doors: not seen, and saying so", () => {
  const d = dayOf(lodge),
    t = d * DAY + (LIFE_HOURS.closed[0] + 1.2) * HOUR;
  for (const ref of lodge.who) {
    const m = momentOf(busy, index(ref), t);
    assert.equal(m.hidden, true, ref);
    assert.match(m.why ?? "", /behind closed doors/);
    assert.deepEqual(m.of, lodge.of);
  }
});

test("a corner is kept from mid-afternoon until dark, one set apart on watch", () => {
  const d = dayOf(corner),
    t = d * DAY + 18 * HOUR,
    at = corner.who.map((ref) => momentOf(busy, index(ref), t));
  assert.equal(at[0]!.why, corner.watch);
  for (const m of at.slice(1)) assert.equal(m.why, corner.doing);
  const knot = at.slice(1);
  for (const m of knot) assert.ok(Math.hypot(m.x - knot[0]!.x, m.z - knot[0]!.z) < 8);
  assert.ok(
    Math.hypot(at[0]!.x - knot[0]!.x, at[0]!.z - knot[0]!.z) > 5,
    "the lookout stands apart",
  );
  for (const ref of corner.who) assert.ok(!momentOf(busy, index(ref), d * DAY + 10 * HOUR).of);
});

test("a collector goes to each who pays where their own day has them; the one who pays stays there and says what it is", () => {
  const d = dayOf(collect),
    i = index(collect.who[0]!),
    part = lifeParts(busy, i, d, ground)[0]!;
  assert.equal(part.stays.length, collect.to!.length);
  let met = 0;
  for (const st of part.stays) {
    const j = st.by!,
      t = d * DAY + st.to - 60,
      payer = momentOf(busy, j, t),
      theirs = momentOf(quiet, j, t),
      mine = momentOf(busy, i, t);
    // (One who is at home or on their way then is not called on.)
    if (payer.why !== collect.toDoing) continue;
    met++;
    assert.deepEqual(
      [payer.x, payer.z],
      [theirs.x, theirs.z],
      "the payer is where their day has them",
    );
    assert.deepEqual(payer.of, collect.of);
    assert.equal(mine.why, collect.doing);
    assert.ok(Math.hypot(mine.x - payer.x, mine.z - payer.z) < 8, "the collector stands by them");
  }
  assert.ok(met >= 1, "at least one who pays is called on");
});

test("a soldier posted is seen at a post day and night; the same one with nothing asked of them is not in the town", () => {
  const i = index("out:uop:x:0");
  for (const h of [2, 9, 15, 22]) {
    const m = momentOf(busy, i, 31 * DAY + h * HOUR);
    assert.equal(m.hidden, false);
    assert.match(m.why ?? "", /^Posted in the streets/);
    assert.deepEqual(m.of, posted.of);
  }
  const idle = village([circle], true),
    m = momentOf(idle, idle.people.length - 1, 31 * DAY + 12 * HOUR);
  assert.equal(m.hidden, true);
  // And no work of the town's is theirs.
  assert.equal(workTold(idle, idle.people.length - 1, 31), null);
});

test("the same plan and day lay the same parts", () => {
  const again = village(all, true);
  for (const g of all) {
    const d = dayOf(g);
    for (const ref of g.who) {
      const a = momentOf(busy, index(ref), d * DAY + 19.3 * HOUR),
        b = momentOf(again, index(ref), d * DAY + 19.3 * HOUR);
      assert.deepEqual([a.x, a.z, a.why], [b.x, b.z, b.why]);
    }
  }
});

test("a feast's dance says what its people dance to, where their music is read; without it, as before", () => {
  const day = [40, 41, 42, 43, 44, 45, 46].find((d) => !restDay(busy, d))!,
    feast = { day, occasion: "harvest" as const, words: "Harvest home", ref: null },
    plain = { ...village([]), life: { ...village([]).life!, feasts: [feast] } },
    sung: VillagePlan = {
      ...plain,
      customs: {
        music: "flutes and drums of wood, fast and loud",
        of: { ref: "pol:0:1#culture", name: "the music of Testland" },
      },
    },
    dancing = (p: VillagePlan) =>
      p.people
        .map((_, i) => momentOf(p, i, day * DAY + 19 * HOUR))
        .filter((m) => m.task === "dance");
  assert.ok(dancing(sung).length > 0);
  for (const m of dancing(sung)) {
    assert.match(m.why ?? "", /dancing in the ring about the fire, to flutes and drums of wood/);
    assert.equal(m.of?.ref, "pol:0:1#culture");
  }
  for (const m of dancing(plain)) {
    assert.equal(m.why, "At the feast: dancing in the ring about the fire");
    assert.ok(!m.of);
  }
  assert.match(
    squareNow(sung, day * DAY + 19 * HOUR)!.words,
    /dancing to flutes and drums of wood/,
  );
});

test("a member's day differs by what they are for their group: a collector's rounds and then the head's house, a lookout's hours, a guard's door, a round of the streets, and one lying low", () => {
  const guard: TownGoing = {
      kind: "guard",
      key: "boss:1|town:0:9|guard",
      of: { ref: "boss:1", name: "Old Varro, who heads the Varro family" },
      words: "Old Varro keeps a house here, and it is guarded",
      doing: "Guarding the house of Old Varro, who heads the Varro family",
      toDoing: "At home, where the Varro family is headed from, guards at the door",
      why: "40 men",
      who: ["prsn:0:4"],
      to: ["boss:1"],
      where: "house",
    },
    patrol: TownGoing = {
      kind: "patrol",
      key: "mob:9|town:0:9|patrol",
      of: { ref: "mob:9", name: "the Grey squad" },
      words: "The Grey squad walk its streets",
      doing: "On their round of the streets with the Grey squad",
      why: "it works 20% of this land",
      who: ["prsn:0:12"],
      where: "square",
    },
    low: TownGoing = {
      ...corner,
      quiet: "Off the corner while soldiers are posted in the streets",
    },
    base = village([
      { ...collect, of: { ref: "mob:1", name: "the Varro family" } },
      corner,
      guard,
      patrol,
    ]),
    town: VillagePlan = {
      ...base,
      people: [
        ...base.people,
        {
          ref: "boss:1",
          name: "Old Varro",
          home: 2,
          age: 60,
          occupation: OCC.leader,
          child: false,
          role: "Head of the Varro family",
          // (One of the town's key figures: the same one their page is of.)
          figure: "boss:1",
        },
      ],
    },
    at = (ref: string) => town.people.findIndex((p) => p.ref === ref),
    d = [30, 31, 32, 33, 34, 35, 36].find(
      (x) => goingHeld(town, town.goings![0]!, x) && !restDay(town, x),
    )!,
    told = (ref: string) =>
      dayTold(town, at(ref), d)
        .map((l) => l.words)
        .filter((w) => /Collect|Bringing|corner|watch|Guarding|round|home, where/i.test(w)),
    days = {
      collector: told("prsn:0:24"),
      lookout: told("prsn:0:16"),
      guard: told("prsn:0:4"),
      patrol: told("prsn:0:12"),
      head: told("boss:1"),
    };
  assert.ok(days.collector.some((w) => /collecting for the Varro family/i.test(w)));
  assert.ok(
    days.collector.some((w) => /Bringing what was collected to the house of Old Varro/.test(w)),
    days.collector.join(" | "),
  );
  assert.ok(days.lookout.some((w) => /^On watch down the street/.test(w)));
  assert.ok(days.guard.some((w) => /^Guarding the house of Old Varro/.test(w)));
  assert.ok(days.patrol.some((w) => /^On their round of the streets with the Grey squad/i.test(w)));
  assert.ok(days.head.some((w) => /at home, where the Varro family is headed from/i.test(w)));
  const all = Object.values(days).map((x) => x.join("|"));
  assert.equal(new Set(all).size, all.length, "no two roles' days read alike");
  // Each is a townsperson first: they wake, eat and sleep at home as anyone does (the head, kept by history, is not of its lines).
  for (const ref of ["prsn:0:24", "prsn:0:16", "prsn:0:4", "prsn:0:12"]) {
    const whole = dayTold(town, at(ref), d).map((l) => l.words);
    assert.ok(whole.includes("Asleep") && whole.some((w) => /Breakfast at home/.test(w)), ref);
  }
  // The head is the figure their page is of, before their own house through the day, the guards at that same house.
  const boss = momentOf(town, at("boss:1"), d * DAY + 10.5 * HOUR),
    guardAt = momentOf(town, at("prsn:0:4"), d * DAY + 10.5 * HOUR),
    house = town.homes[2]!;
  assert.equal(boss.hidden, false);
  assert.deepEqual(boss.of, guard.of);
  assert.ok(Math.hypot(boss.x - house.x, boss.z - house.z) < 16, "at their own house");
  assert.ok(
    Math.hypot(guardAt.x - boss.x, guardAt.z - boss.z) < 9,
    "the guard is at the head's house",
  );
  assert.equal(town.people.filter((p) => p.ref === "boss:1" || p.figure === "boss:1").length, 1);
  // Soldiers in the land: the corner's people are off it, at their own doors of a morning, and say why.
  const hush = village([low]),
    m = momentOf(
      hush,
      hush.people.findIndex((p) => p.ref === "prsn:0:17"),
      d * DAY + 10 * HOUR,
    ),
    later = momentOf(
      hush,
      hush.people.findIndex((p) => p.ref === "prsn:0:17"),
      d * DAY + 18 * HOUR,
    );
  assert.equal(m.why, low.quiet);
  assert.ok(!later.of, "not at the corner that evening");
  // And the plan read again (a year's turn makes a new one) lays the same day for the same one.
  const again: VillagePlan = { ...town, people: [...town.people].reverse() },
    i = again.people.findIndex((p) => p.ref === "prsn:0:16");
  assert.deepEqual(
    dayTold(again, i, d).map((l) => l.words),
    dayTold(town, at("prsn:0:16"), d).map((l) => l.words),
  );
});

test("a collector the court locks up is in its cell and not on the rounds, saying until when, the case a press away; then back at it", () => {
  const d0 = [30, 31, 32, 33, 34, 35, 36].find(
      (x) => goingHeld(busy, collect, x) && !restDay(busy, x),
    )!,
    sat = d0 - 3,
    tried: VillagePlan = {
      ...village([collect]),
      court: {
        form: "bench",
        law: "The town's bench of Lifeford",
        grips: true,
        far: false,
        colour: [0.5, 0.5, 0.5],
        wood: [0.3, 0.2, 0.1],
        sittings: [
          {
            ref: "case:town:0:9:0:501",
            day: sat,
            accused: "prsn:0:24",
            who: "P24 Test",
            line: "P24 Test told a trader what their trade would pay the group each month.",
            sentence: "cell",
            days: 400,
          },
        ],
      },
    },
    i = tried.people.findIndex((p) => p.ref === "prsn:0:24"),
    // The day it sits: before the court, the case linked.
    before = momentOf(tried, i, sat * DAY + 10 * HOUR),
    // A collecting day while the sentence runs: in the cell, not collecting.
    inside = momentOf(tried, i, d0 * DAY + 9.2 * HOUR),
    // And the first collecting day after it is served: on the rounds again.
    free = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      .map((k) => sat + 400 + k)
      .find((x) => goingHeld(tried, collect, x) && !restDay(tried, x))!;
  assert.equal(before.of?.ref, "case:town:0:9:0:501");
  assert.match(inside.why ?? "", /^Locked in the town's cell, until year 1$/);
  assert.equal(inside.of?.ref, "case:town:0:9:0:501");
  assert.equal(inside.of?.name, "the case of P24 Test");
  assert.ok(
    !dayTold(tried, i, d0).some((l) => /Collecting/.test(l.words)),
    "no rounds from the cell",
  );
  assert.ok(
    dayTold(tried, i, free).some((l) => /collecting for the Varro family/i.test(l.words)),
    "back on the rounds, the sentence served",
  );
  // Those who pay are not called on by one who is locked up.
  const payer = tried.people.findIndex((p) => p.ref === "prsn:0:25");
  assert.ok(!dayTold(tried, payer, d0).some((l) => /Paying/.test(l.words)));
});

test("soldiers posted bear what their realm's host is fielded with and are of its group; an enforcers' round calls once where the crew is paid", () => {
  const armed = (arm: string) => {
      const p: VillagePlan = {
        ...village([posted], true),
        posted: { color: [0.8, 0.2, 0.2], arm },
      };
      return momentOf(p, p.people.length - 1, 31 * DAY + 10 * HOUR).carry;
    },
    one = village([posted], true).people.at(-1)!;
  assert.equal(armed("rifle"), "gun");
  assert.equal(armed("spear"), "spear");
  assert.equal(armed("sword"), null, "an arm not drawn is told, not shown as another");
  assert.equal(personGroup({ ...one, host: true }), 5, "the realm's colour, a group of its own");
  assert.equal(personGroup(one), 0);
  const round: TownGoing = {
      kind: "patrol",
      key: "mob:9|town:0:9|patrol",
      of: { ref: "mob:9", name: "the Grey squad" },
      words: "The Grey squad walk its streets",
      doing: "On their round of the streets with the Grey squad",
      toDoing: "Calling where the Grey squad is paid to leave a trade alone",
      why: "it works 20% of this land",
      who: ["prsn:0:12"],
      where: "square",
    },
    town: VillagePlan = { ...village([round]), market: true },
    i = town.people.findIndex((p) => p.ref === "prsn:0:12"),
    d = [30, 31, 32, 33].find((x) => !restDay(town, x))!,
    told = dayTold(town, i, d).map((l) => l.words);
  assert.ok(
    told.some((w) => /calling where the Grey squad is paid/i.test(w)),
    told.join(" | "),
  );
  assert.ok(told.some((w) => /on their round of the streets/i.test(w)));
  // A crew that is not paid (no such line from the land's rows) makes no such call.
  const plain = village([{ ...round, toDoing: undefined } as TownGoing]);
  assert.ok(!dayTold(plain, i, d).some((l) => /paid/.test(l.words)));
});
