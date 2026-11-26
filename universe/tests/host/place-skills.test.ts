// Town mode, skills and passions (N6 of the design review's order): one's hours are counted at each kind of work, the
// six trades' and raising a building, tending their own abed, a fire and cooking at their hearth (rules/life.ts: the hours
// one has given to a craft are their skill at it); the hours of a trade left are kept with it and taken up again on coming
// back; the work a household keeps is what it taught them, two hundred hours of it (rules/life.ts LIFE_WANTS.teach); a
// wound takes from their fitness for what a work is done with; a hand turned to another trade's work works at the skill
// their hours at it make; and a fire's priority says who goes to one.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { LIFE_WANTS, OCC, SKILL_LEVELS } from "../../src/rules/index.ts";
import {
  PRIO_FIRE_OWN,
  lifeOf,
  populationContext,
  townsOf,
  type Settlement,
} from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import {
  ACT,
  SK,
  SKILL_KINDS,
  enterPlace,
  hoursAt,
  hurtOf,
  placeDigest,
  placeIndexOf,
  placeSkills,
  placesOf,
  tradeKind,
  type Place,
} from "../../src/host/place.ts";
import { placeFrame, workSheet } from "../../src/host/placeplan.ts";
import { inspectPerson } from "../../src/host/placeinspect.ts";
import { universeWorld } from "./worlds.ts";

const base = (): World => universeWorld(EARTH, "first light", 150);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: "earth" })));
  return loadWorld(doc, (s) => EARTH.build(s), "r").world;
};
const order = (w: World, type: string, args: unknown): void => {
  const c = w.submit(type, args);
  w.runTo(c.t);
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
};
const watch = (w: World, town: string, hours: number, step = 1): void => {
  for (let k = 0; k < hours; k += step) {
    w.runTo(w.now + step * HOUR);
    placeFrame(w, town, []);
  }
};
const grownAt = (w: World, place: Place, occ: number): number[] => {
  const p = place.people,
    grown = lifeOf(w).adulthood,
    out: number[] = [];
  for (let i = 0; i < p.n; i++)
    if ((p.sexOcc[i]! & 15) === occ && (place.t / DAY - p.born[i]!) / 365 > grown + 2 && !p.line[i])
      out.push(p.id[i]!);
  return out;
};

test("the hours of each kind of work are counted as it is done, a household's trade is what it taught, and a trade left keeps its hours", () => {
  const w = copy(base()),
    s = near(w, 500),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    grown = lifeOf(w).adulthood;
  assert.equal(SKILL_KINDS.length, 10);
  // Taught: each grown one of a household whose other grown keep a trade holds it as what they were taught, two hundred
  // hours of it at the least; no child is taught yet.
  let taught = 0;
  for (let i = 0; i < p.n; i++) {
    const age = (place.t / DAY - p.born[i]!) / 365;
    if (age < grown) {
      assert.equal(p.taught[i], 0, "a child is taught nothing yet");
      continue;
    }
    if (!p.taught[i]) continue;
    taught++;
    assert.ok(
      hoursAt(p, i, p.taught[i]! - 1) >= LIFE_WANTS.teach.goal * 6,
      "two hundred hours of it",
    );
    assert.ok(placeSkills(w, place, i)[p.taught[i]! - 1]!.passion);
  }
  assert.ok(taught > 0, "some were taught their household's work");
  // A day and a night watched: some cook at their hearth; no one's hours at their own trade are counted twice.
  const before = Array.from(p.hours.subarray(0, p.n * SKILL_KINDS.length));
  watch(w, s.ref, 30, 1);
  let cooked = 0;
  for (let i = 0; i < p.n; i++) {
    const own = tradeKind(p.sexOcc[i]! & 15);
    if (own >= 0)
      assert.equal(
        p.hours[i * SKILL_KINDS.length + own],
        0,
        "their own trade's hours are `skill`'s",
      );
    if (
      p.hours[i * SKILL_KINDS.length + SK.cooking]! >
      (before[i * SKILL_KINDS.length + SK.cooking] ?? 0)
    )
      cooked++;
  }
  assert.ok(cooked > 0, "some cooked at their hearth");
  // A farmer put to crafts by name and then let be: their farming's hours kept with the fields, and theirs again.
  const id = grownAt(w, place, OCC.farmer)[0]!,
    i0 = placeIndexOf(place, id),
    farmed = p.skill[i0]!;
  assert.ok(farmed > 0);
  order(w, "place.assign", { town: s.ref, person: id, trade: OCC.crafter, post: null });
  placeFrame(w, s.ref, []);
  let i = placeIndexOf(place, id);
  assert.equal(p.sexOcc[i]! & 15, OCC.crafter);
  assert.equal(hoursAt(p, i, SK.fields), farmed, "the fields' hours kept");
  assert.equal(p.skill[i], hoursAt(p, i, SK.crafts));
  order(w, "place.assign", { town: s.ref, person: id, trade: OCC.farmer, post: null });
  placeFrame(w, s.ref, []);
  i = placeIndexOf(place, id);
  assert.equal(p.sexOcc[i]! & 15, OCC.farmer);
  assert.ok(p.skill[i]! >= farmed, "back at the fields with what they had there");
  // The Work sheet's grid tells each kind's skill, a cell a column, by the hours.
  const grid = workSheet(w, place).grid,
    row = grid.rows[0]!;
  assert.equal(grid.kinds.length, 6);
  assert.deepEqual(grid.skills, [
    "Fields",
    "Herds",
    "Crafts",
    "Hauling",
    "Building",
    "Fire watch",
    "Healing",
    "Cooking",
    "Hunting",
  ]);
  assert.equal(row.skills.length, grid.skills.length);
  const j = placeIndexOf(place, row.id);
  assert.equal(row.skills[0]!.hours, Math.floor(hoursAt(p, j, SK.fields) / 6));
  assert.ok(row.skills.every((c) => c.level >= 0 && c.level < SKILL_LEVELS.length && c.fit <= 1));
  // Kept in the save, and the same once loaded.
  const again = copy(w);
  assert.equal(placeDigest(placesOf(again)!.get(s.ref)!), placeDigest(place));
});

test("a fire's priority says who goes to one: set never, they stay away", () => {
  const w = copy(base()),
    s = near(w, 500),
    place = enterPlace(w, s.ref)!,
    p = place.people;
  // Every grown farmer and crafter set never to go to a fire.
  const never = [...grownAt(w, place, OCC.farmer), ...grownAt(w, place, OCC.crafter)];
  assert.ok(never.length > 4);
  for (const id of never)
    order(w, "place.prio", {
      town: s.ref,
      person: id,
      kinds: [
        ...[OCC.farmer, OCC.herder, OCC.crafter, OCC.trader].map((o) =>
          o === (p.sexOcc[placeIndexOf(place, id)]! & 15) ? 3 : 0,
        ),
        1,
        0,
      ],
    });
  w.runTo(Math.ceil(w.now / DAY) * DAY + 10 * HOUR);
  placeFrame(w, s.ref, []);
  order(w, "act.fire", { village: s.ref });
  let fought = 0,
    by = 0;
  for (let k = 0; k < 12; k++) {
    w.runTo(w.now + 600);
    placeFrame(w, s.ref, []);
    for (let i = 0; i < p.n; i++) {
      if (p.act[i] !== ACT.brigade) continue;
      fought++;
      if (never.includes(p.id[i]!)) by++;
    }
  }
  assert.equal(by, 0, "none set never to go to a fire went");
  // (And those who went have hours at it now.)
  let atFire = 0;
  for (let i = 0; i < p.n; i++) if (hoursAt(p, i, SK.fire) > 0) atFire++;
  assert.ok(atFire > 0, "an hour at a fire is an hour of it");
  // The inspector of one the fire hurt: their wound on their body, abed and who tends them; what they have.
  const hurt = [...Array(p.n).keys()].find((i) => p.health[i] === 1 && hurtOf(place, i).member);
  assert.ok(hurt !== undefined, "the fire hurt one");
  const seen = inspectPerson(w, place, p.id[hurt!]!)!;
  assert.ok(
    seen.body.some((m) => m.member === hurtOf(place, hurt!).member && m.state === "abed"),
    JSON.stringify(seen.body),
  );
  const rows = new Map(seen.healthRows);
  assert.ok(/^\d+ more days?$/.test(rows.get("Abed") ?? ""), JSON.stringify(seen.healthRows));
  assert.ok(rows.has("Tended") && rows.has("Lasting") && rows.has("Care"));
  const gear = new Map(seen.gear);
  assert.ok(gear.has("In hand") && gear.has("Pantry") && /incomes/.test(gear.get("Means") ?? ""));
  assert.ok(!/undefined|NaN/.test(JSON.stringify(seen)));
  assert.ok(fought > 0, "the rest went as they would");
  assert.equal(PRIO_FIRE_OWN, 1);
});
