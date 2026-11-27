// Town mode, breaks, justice and works (N11 of the design review's order): a mood too low to bear breaks, the oftener
// the deeper, as its temper has it (the bold lash out at what lies about their work, those who set no store by plenty
// eat all in sight, the rest wander dazed), for half a waking day, and is lighter after; a wrong (what was spoiled,
// blows) is brought before the town's justice as far as its court reaches, and what comes of it is its realm's own law
// (rules/sentences.ts sentenceMix): a fine, labour, a term held, or let go. Its makers give their land's share of their
// time to works, each showing one of the town's happenings, kept at their work and seen by those there. All of it kept
// with the place, saved and read back, the same however often it is looked at.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { populationContext, townsOf, type Settlement } from "../../src/sim/index.ts";
import {
  ACT,
  BREAK,
  HAP,
  MOOD_UNHEEDING,
  THOUGHT,
  WHY,
  enterPlace,
  placeBreak,
  placeDigest,
  placeLaw,
  placeMoodTerms,
  placesOf,
} from "../../src/host/place.ts";
import { placeFrame, placeNotices } from "../../src/host/placeplan.ts";
import { inspectLot } from "../../src/host/placeinspect.ts";
import { PLACE_UNIVERSE, placeWorld } from "./worlds.ts";

const base = (): World => placeWorld(150);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name })));
  return loadWorld(doc, (s) => PLACE_UNIVERSE.build(s), "r").world;
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

test("a mood past bearing breaks, as its temper has it, and is lighter after; what it spoils is brought to justice", () => {
  const w = copy(base()),
    s = near(w, 900),
    place = enterPlace(w, s.ref)!;
  watch(w, s.ref, 2);
  const p = place.people;
  // Thirty of its grown, well, brought to the very bottom of mood.
  const low: number[] = [];
  for (let i = 0; i < p.n && low.length < 30; i++)
    if (!p.health[i] && (place.t / DAY - p.born[i]!) / 365 > 25) {
      p.mood[i] = -100;
      low.push(p.id[i]!);
    }
  let broke = 0,
    seen = 0,
    alerted = false;
  const hows = new Set<number>();
  for (let h = 0; h < 30; h++) {
    watch(w, s.ref, 1);
    const q = placesOf(w)!.get(s.ref)!.people;
    for (let i = 0; i < q.n; i++) {
      const b = placeBreak(place, i);
      if (b) {
        hows.add(b.how);
        if (q.why[i] === WHY.broke) seen++;
      }
    }
    if (placeNotices(w, place).some((n) => n.key === "breaking")) alerted = true;
  }
  broke = place.log.filter((x) => x.what === HAP.broke).length;
  assert.ok(broke > 0, "a mood at the bottom breaks");
  assert.ok(seen > 0, "one broken down is at their break");
  assert.ok(alerted, "the alert column tells it");
  assert.ok(
    [...hows].every(
      (x) => x === BREAK.wander || x === BREAK.binge || x === BREAK.wreck || x === BREAK.pray,
    ),
    `each break one of its four (${[...hows].join(", ")})`,
  );
  // Spent within the day, and lighter after.
  watch(w, s.ref, 12);
  const q = placesOf(w)!.get(s.ref)!.people;
  let relieved = 0;
  for (let i = 0; i < q.n; i++)
    if (placeMoodTerms(w, place, i).some((t) => t.thought === THOUGHT.catharsis && t.size > 0)) relieved++;
  assert.ok(relieved > 0, "a break spent is a relief");
  // (None outlives its end, held by its justice or not.)
  const left = place.breaks ?? [];
  for (let k = 0; k < left.length; k += 3)
    assert.ok(left[k + 2]! > place.t - HOUR, "a break runs out, held or not");
  // What was spoiled, and blows, brought before its justice as far as its court reaches, by its realm's own law.
  const law = placeLaw(w, place);
  assert.ok(law.reach >= 0 && law.reach <= 1 && law.harsh >= 0 && law.harsh <= 1);
  const wrecked = place.log.filter((x) => x.what === HAP.broke && x.a === BREAK.wreck).length,
    judged = place.log.filter((x) => x.what === HAP.judged).length;
  if (wrecked > 0 && law.reach >= 1) assert.ok(judged > 0, "a wrong where all are brought is judged");
  for (let i = 0; i < q.n; i++)
    if (q.act[i] === ACT.held) assert.equal(q.why[i], WHY.held, "one held is held by its justice");
  void MOOD_UNHEEDING;
});

test("its makers make works of the town's happenings, kept where they work, and the place saves and reads back the same", () => {
  const w = copy(base()),
    s = near(w, 3000),
    place = enterPlace(w, s.ref)!;
  // A month and more, three hours at a time.
  watch(w, s.ref, 40 * 24, 3);
  const works = place.works ?? [];
  assert.ok(works.length >= 7, `works were made (${works.length / 7})`);
  assert.equal(works.length % 7, 0);
  const lot = works[0]!,
    read = inspectLot(w, place, lot);
  assert.ok(read.works.length > 0, "its building tells its works");
  assert.ok(read.works[0]!.words.startsWith("showing"));
  // Saved and read back, and on the same as one never saved, looked at seldom or often.
  const twin = copy(w);
  assert.equal(placeDigest(placesOf(twin)!.get(s.ref)!), placeDigest(placesOf(w)!.get(s.ref)!));
  watch(w, s.ref, 24);
  watch(twin, s.ref, 24, 6);
  assert.equal(placeDigest(placesOf(twin)!.get(s.ref)!), placeDigest(placesOf(w)!.get(s.ref)!));
});
