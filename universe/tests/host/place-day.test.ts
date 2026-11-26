// Town mode, schedules and recreation (N7 of the design review's order): a place keeps its land's working day and days of
// rest as rules/leisure.ts reckons them (sim/society/everyday.ts leisureYear): no one works out of the working day or on a
// day of rest; their day's work done, by light, they go to their people's games in the square, and remember it gladly.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR, type World } from "../../src/kernel/index.ts";
import {
  LEISURE_ROW,
  LEISURE_STORE,
  populationContext,
  societyStore,
  townsOf,
} from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import {
  ACT,
  THOUGHT,
  THOUGHTS,
  WHY,
  enterPlace,
  placeDayOf,
  placeDayStrip,
  placesOf,
} from "../../src/host/place.ts";
import { placeDayRows, placeFrame } from "../../src/host/placeplan.ts";
import { inspectPerson } from "../../src/host/placeinspect.ts";
import { universeWorld } from "./worlds.ts";

const near = (w: World, people: number) => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
};

test("a place keeps its land's working day and days of rest, and plays when its work is done", () => {
  const w = universeWorld(EARTH, "first light", 150),
    s = near(w, 500),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    row = societyStore(w, LEISURE_STORE)?.get(s.cell);
  // Its day is its land's: the working day's hours, its holy days and feasts, its games.
  const d = placeDayOf(w, place);
  if (row) {
    assert.equal(d.hours, row[LEISURE_ROW.hours]! / 10);
    assert.equal(d.games, row[LEISURE_ROW.games]);
  }
  assert.ok(d.hours >= 6 && d.hours <= 11 && d.to - d.from === d.hours);
  // (Its days of rest come as often in a year as it keeps them.)
  let rested = 0;
  for (let k = 0; k < 365; k++) if (placeDayOf(w, place, k * DAY).rest) rested++;
  assert.ok(Math.abs(rested - d.days.all) <= 1, `${rested} days of rest for ${d.days.all}`);
  // Ten days watched, an hour at a time: no one at work out of the working day or on a day of rest; some at play.
  const start = Math.ceil(w.now / DAY) * DAY;
  w.runTo(start);
  placeFrame(w, s.ref, []);
  let played = 0,
    workedOff = 0,
    workedIn = 0;
  for (let h = 0; h < 24 * 10; h++) {
    w.runTo(w.now + HOUR);
    placeFrame(w, s.ref, []);
    const day = placeDayOf(w, place),
      hour = ((place.t % DAY) / DAY) * 24,
      inDay = day.rest === null && hour >= day.from && hour < day.to;
    for (let i = 0; i < p.n; i++) {
      if (p.act[i] === ACT.work && !p.eta[i]) {
        if (inDay) workedIn++;
        else if (hour >= day.to + 1 || hour < day.from - 1 || day.rest) workedOff++;
      }
      if (p.why[i] === WHY.play) played++;
    }
  }
  assert.ok(workedIn > 0, "they work in the working day");
  assert.equal(workedOff, 0, "and not out of it");
  assert.ok(played > 0, "some play when the day's work is done");
  // Remembered: some hold a memory of the games.
  let glad = 0;
  for (let k = 0; k < p.n * THOUGHTS; k++) {
    const v = p.thought[k]! >>> 24;
    if (v === THOUGHT.games || v === THOUGHT.feast) glad++;
  }
  assert.ok(glad > 0, "the games remembered");
  // Told: the inspector's day an hour at a time, and its lines.
  const i = [...Array(p.n).keys()].find((j) => p.work[j]! > 0 || (p.sexOcc[j]! & 15) > 0)!,
    seen = inspectPerson(w, place, p.id[i]!)!;
  assert.equal(seen.day.length, 24);
  assert.deepEqual(seen.day, placeDayStrip(w, place, i));
  const rows = new Map(placeDayRows(w, place));
  assert.ok(
    /^\d+:\d\d to \d+:\d\d, /.test(rows.get("Working day") ?? ""),
    JSON.stringify([...rows]),
  );
  assert.ok(rows.has("Days of rest") && rows.has("Games") && rows.has("Today"));
  assert.ok(!/undefined|NaN/.test(JSON.stringify(seen.dayRows)));
  assert.ok(placesOf(w)!.get(s.ref) === place);
});
