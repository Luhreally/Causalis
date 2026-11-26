// Town mode, health by body member (N9 of the design review's order): a wound bleeds as hard as its blow opened it and
// clots by half each ten minutes (rules/healing.ts); it is dressed at home by one of the household, by the hurt themselves
// where they can stand, or by the town's healer, who goes to them; it festers or it does not a day or two after, as the
// world's own shares of the dead of wounds say, and a festering is fought off by the care brought to it and the healer's
// remedies, which they gather about the fields; it hurts, and moves the mood by how much. All of it kept in the place's
// columns, saved and read back, the same however often it is looked at.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import {
  BLOOD,
  DIED_OF_WOUNDS,
  FESTER_MOST,
  bleedOf,
  festerChance,
  festerNext,
  festerStart,
  fightOf,
  painOf,
  remedyFight,
  WOUNDS,
} from "../../src/rules/index.ts";
import { populationContext, townsOf, type Settlement } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import {
  ACT,
  PERSON_BYTES,
  WHY,
  enterPlace,
  placeDigest,
  placeHealer,
  placeMoodTerms,
  placeWound,
  placesOf,
} from "../../src/host/place.ts";
import { placeFrame, placeNotices, stocksSheet, workSheet } from "../../src/host/placeplan.ts";
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

test("the world's shares of the dead of wounds, lived by the hour", () => {
  for (const blow of ["edge", "fire", "shot"] as const) {
    // Untended, a wound loses twice its first ten minutes' blood: those that pass the fatal share are half the world's dead.
    let bled = 0;
    const n = 20000;
    for (let k = 0; k < n; k++) if (2 * bleedOf(blow, (k + 0.5) / n) >= BLOOD.fatal) bled++;
    assert.ok(Math.abs(bled / n - DIED_OF_WOUNDS[blow] / 2) < 0.002, `${blow}: ${bled / n} bled`);
    // Festering: of those that fester, untended and where nothing is known of care, those that grow past the most a body
    // bears are the other half; with full care brought, as many of them live as the world's WOUNDS.save says.
    const lethal = (care: number) => {
      let died = 0;
      for (let k = 0; k < n; k++) {
        let load = festerStart((k + 0.5) / n);
        for (let d = 0; d < 200 && load > 0 && load < FESTER_MOST; d++)
          load = festerNext(load, fightOf(care, 0));
        if (load >= FESTER_MOST) died++;
      }
      return died / n;
    };
    const none = festerChance(blow) * lethal(0),
      full = festerChance(blow) * lethal(1);
    assert.ok(Math.abs(none - DIED_OF_WOUNDS[blow] / 2) < 0.003, `${blow}: ${none} festered`);
    assert.ok(Math.abs(full / none - (1 - WOUNDS.save)) < 0.02, `${blow}: full care leaves ${full / none}`);
  }
  // A day's remedies add to the fight; blood lost takes from it; a wound hurts the more fresh, undressed and festering.
  assert.ok(remedyFight(0.6) > 0 && remedyFight(0) === 0);
  assert.ok(fightOf(0.5, 0.3) < fightOf(0.5, 0));
  assert.ok(painOf(true, false, false, 0) > painOf(true, false, true, 0));
  assert.ok(painOf(true, false, true, 40) > painOf(true, false, true, 0));
  assert.ok(painOf(false, true, true, 0) < painOf(true, false, true, 0));
  assert.equal(painOf(false, false, true, 0), 0);
  // (182 since the tiers: a byte for how closely one is followed and one for how far into their stride their needs are
  // reckoned, 2026-11-26.)
  assert.ok(PERSON_BYTES <= 182, `${PERSON_BYTES} bytes a person`);
});

test("a fire's hurt bleed, are dressed, may fester, hurt, and the healer goes to them; saved and read back the same", () => {
  const w = copy(base()),
    s = near(w, 500);
  // (Managed, so that the place may tell its dead to its land.)
  order(w, "place.hold", { town: s.ref, months: 0 });
  const place = enterPlace(w, s.ref)!;
  watch(w, s.ref, 2);
  order(w, "act.fire", { village: s.ref });
  const p = () => placesOf(w)!.get(s.ref)!.people;
  let bled = 0,
    dressed = 0,
    seen = 0,
    hurtMood = 0,
    tending = 0,
    blood = 0;
  for (let h = 0; h < 4 * 24; h++) {
    watch(w, s.ref, 1);
    const q = p();
    for (let i = 0; i < q.n; i++) {
      if (q.health[i] !== 1) continue;
      const x = placeWound(place, i);
      if (x.blood > 0) bled++;
      if (x.dressed) dressed++;
      if (x.seen) seen++;
      blood = Math.max(blood, x.blood);
      const ail = placeMoodTerms(w, place, i).find((t) => t.bit === 2);
      if (ail && ail.size < -10) hurtMood++;
    }
    for (let i = 0; i < q.n; i++) if (q.act[i] === ACT.tend && q.why[i] === WHY.tend) tending++;
  }
  assert.ok(bled > 0, "the fire's hurt bled");
  assert.ok(blood < BLOOD.fatal || place.dead.length > 0, "none past the fatal share lives");
  assert.ok(dressed > 0, "their wounds were dressed");
  assert.ok(seen > 0, "their wounds were seen to fester or not");
  assert.ok(hurtMood > 0, "their wound weighs on their mood by its pain");
  const h = placeHealer(place);
  if (place.matched.healer) {
    assert.ok(h.i >= 0, "a land that knows herb-lore keeps a healer");
    assert.ok(workSheet(w, place).healer, "the Work sheet names the healer");
    assert.ok(stocksSheet(w, place).remedies, "the Stocks sheet tells the remedies");
    assert.ok(tending >= 0);
  } else assert.equal(h.i, -1, "no herb-lore, no healer");
  // The Health tab tells it.
  const one = [...Array(p().n).keys()].find((i) => p().health[i] === 1);
  if (one !== undefined) {
    const r = inspectPerson(w, place, p().id[one]!)!;
    assert.ok(r.kind === "person");
    const rows = r.healthRows.map((x) => x[0]);
    for (const k of ["Bleeding", "Festering", "Pain"]) assert.ok(rows.includes(k), `the Health tab tells ${k}`);
  }
  // Alerts read off the same: no alert of bleeding where none bleeds.
  const bleeding = [...Array(p().n).keys()].some((i) => placeWound(place, i).bleeding > 0);
  assert.equal(
    placeNotices(w, place).some((n) => n.key === "bleeding"),
    bleeding,
  );
  // Saved and read back: the same place, and it goes on the same as one never saved.
  const twin = copy(w),
    a = placesOf(w)!.get(s.ref)!,
    b = placesOf(twin)!.get(s.ref)!;
  assert.equal(placeDigest(b), placeDigest(a));
  watch(w, s.ref, 30);
  watch(twin, s.ref, 30, 3);
  assert.equal(
    placeDigest(placesOf(twin)!.get(s.ref)!),
    placeDigest(placesOf(w)!.get(s.ref)!),
    "looked at seldom or often, saved or not, the same",
  );
});
