// Town mode, social ties (N8 of the design review's order): each of a place's people knows up to a dozen of its people, met
// at home, at work and about their street, and thinks the better of those alike of temper (placeTemper: their land's ways
// and their own nature); two who cannot abide each other quarrel when they meet, two hot tempers among them come to blows;
// what is not met again fades. Kept in the place's save, and the same once loaded and run on.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { populationContext, townsOf } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import {
  FRIEND_AT,
  HAP,
  PERSON_BYTES,
  RIVAL_AT,
  THOUGHT,
  THOUGHTS,
  TIES,
  enterPlace,
  placeDigest,
  placeIndexOf,
  placeTemper,
  placeTies,
  placesOf,
} from "../../src/host/place.ts";
import { placeFrame } from "../../src/host/placeplan.ts";
import { inspectPerson } from "../../src/host/placeinspect.ts";
import { universeWorld } from "./worlds.ts";

const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: "earth" })));
  return loadWorld(doc, (s) => EARTH.build(s), "r").world;
};
const near = (w: World, people: number) => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
};
const watch = (w: World, town: string, days: number): void => {
  for (let h = 0; h < days * 24; h += 6) {
    w.runTo(w.now + 6 * HOUR);
    placeFrame(w, town, []);
  }
};
const temperGap = (place: Parameters<typeof placeTemper>[0], i: number, j: number) => {
  const a = placeTemper(place, i),
    b = placeTemper(place, j);
  return (
    (Math.abs(a.kin - b.kin) +
      Math.abs(a.bidden - b.bidden) +
      Math.abs(a.sociable - b.sociable) +
      Math.abs(a.thrifty - b.thrifty) +
      Math.abs(a.bold - b.bold)) /
    5
  );
};

test("each knows up to a dozen, likes those alike, quarrels with rivals; kept in the save", () => {
  const w = universeWorld(EARTH, "first light", 150),
    s = near(w, 500),
    place = enterPlace(w, s.ref)!;
  // (Its columns read afresh after a watch: a place's people grow into new ones as births pass what they held.)
  let p = place.people;
  assert.ok(PERSON_BYTES <= 180, `${PERSON_BYTES} bytes a person`);
  // Entered: each already knows some of their household, their work and their street.
  let known = 0,
    ties = 0;
  for (let i = 0; i < p.n; i++) {
    const t = placeTies(place, i);
    assert.ok(t.length <= TIES);
    if (t.length) known++;
    ties += t.length;
    for (const x of t) assert.ok(x.regard >= -100 && x.regard <= 100 && x.j !== i);
  }
  assert.ok(known > p.n * 0.8, `${known} of ${p.n} know someone`);
  assert.ok(ties / p.n >= 4, `${(ties / p.n).toFixed(1)} ties a person`);
  // Like takes to like: friends are more alike of temper than rivals.
  watch(w, s.ref, 60);
  p = place.people;
  let fGap = 0,
    fN = 0,
    rGap = 0,
    rN = 0;
  for (let i = 0; i < p.n; i++)
    for (const t of placeTies(place, i)) {
      if (t.regard >= FRIEND_AT) {
        fGap += temperGap(place, i, t.j);
        fN++;
      } else if (t.regard <= RIVAL_AT) {
        rGap += temperGap(place, i, t.j);
        rN++;
      }
    }
  assert.ok(fN > 0 && rN > 0, `${fN} friendships, ${rN} rivalries`);
  assert.ok(fGap / fN < rGap / rN, `friends ${fGap / fN} apart, rivals ${rGap / rN}`);
  // Rivals who meet quarrel, and it is told.
  // (Words are remembered, and blows told in the log besides.)
  let one = -1;
  for (let k = 0; k < p.n * THOUGHTS && one < 0; k++) {
    const kind = p.thought[k]! >>> 24;
    if (kind === THOUGHT.quarrel || kind === THOUGHT.brawl) one = Math.floor(k / THOUGHTS);
  }
  assert.ok(one >= 0, "some quarrelled, and remember it");
  assert.ok(
    place.log.every((x) => x.what !== HAP.quarrel),
    "words are not told in the log",
  );
  if (one >= 0) {
    const seen = inspectPerson(w, place, p.id[one]!)!;
    assert.ok(seen.ties.length > 0 && /know/.test(seen.tiesWords), seen.tiesWords);
    assert.ok(
      seen.ties.every((t) => /\((\+|-)?\d+\)$/.test(t.words)),
      JSON.stringify(seen.ties),
    );
  }
  // Two hot tempers set at each other: blows.
  let hot = -1,
    other = -1;
  for (let i = 0; i < p.n && other < 0; i++) {
    if (placeTemper(place, i).bold < 0.65) continue;
    if (hot < 0) hot = i;
    else if (p.house[i] === p.house[hot] || p.work[i] === p.work[hot]) other = i;
  }
  if (hot >= 0 && other >= 0) {
    const set = (a: number, b: number) => {
      p.tie[a * TIES] = p.id[b]!;
      p.regard[a * TIES] = -90;
    };
    set(hot, other);
    set(other, hot);
  }
  // Kept: saved and loaded, the place runs on the same as the one never saved.
  const again = copy(w),
    there = placesOf(again)!.get(s.ref)!;
  assert.equal(placeDigest(there), placeDigest(place));
  watch(w, s.ref, 20);
  watch(again, s.ref, 20);
  assert.equal(placeDigest(there), placeDigest(place));
  assert.ok(Math.ceil(w.now / DAY) > 0);
});
