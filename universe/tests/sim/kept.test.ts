// Conservation's turns (sim/ecology/ecology.ts keptTurns): ground a people set aside come back while it was kept, and broken
// where hunger took it below half. Forced on a real world's land, since a run of a few centuries may meet neither.
import { test } from "node:test";
import assert from "node:assert/strict";
import { yearOfMoment, type Ref } from "../../src/kernel/index.ts";
import { ECOLOGY_EVENTS, lessonsOf, populationContext } from "../../src/sim/index.ts";
import { keptTurns } from "../../src/sim/ecology/ecology.ts";
import { why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world),
  year = yearOfMoment(world.now),
  p = ctx.provinces.all().find((x) => x.total() > 0)!,
  told = (type: string) => world.events.all().filter((e) => e.type === type && e.place === p.ref);

test("woods kept from the axe that stood back up are told, with the keeping and the clearing as causes", () => {
  const h = lessonsOf(world)!.holder(p.ref),
    taken = world.events.emit({ type: "lessons.taken", place: p.ref, causes: [], data: {} }),
    cleared = world.events.emit({
      type: ECOLOGY_EVENTS.cleared.type,
      place: p.ref,
      causes: [],
      data: {},
    }),
    had = h.uses.get("kept-woods");
  h.uses.set("kept-woods", { w: 1, at: year, taken: year - 30, from: null, ref: taken } as never);
  const before = told(ECOLOGY_EVENTS.keptBack.type).length;
  keptTurns(world, p.ref, h, year, null, [["woods", 0.2, 0.2, cleared, 0.65]]);
  const back = told(ECOLOGY_EVENTS.keptBack.type);
  assert.equal(back.length, before + 1);
  assert.deepEqual(
    back.at(-1)!.causes.map((c) => c.ref),
    [taken, cleared],
  );
  assert.match(why(world, back.at(-1)!.id).claim, /woods .* stood again/);
  // (No turn for the better, or nothing kept now: nothing told.)
  keptTurns(world, p.ref, h, year, null, [["woods", 0.2, 0.2, null, 0.65]]);
  keptTurns(world, p.ref, h, year, null, [["woods", 0.2, 0, cleared, 0.65]]);
  assert.equal(told(ECOLOGY_EVENTS.keptBack.type).length, before + 1);
  if (had) h.uses.set("kept-woods", had);
  else h.uses.delete("kept-woods");
});

test("ground set aside broken by hunger is told where hunger took it below half; a fading keeping is not", () => {
  const h = lessonsOf(world)!.holder(p.ref),
    famine = world.events.emit({ type: "people.famine", place: p.ref, causes: [], data: {} }),
    hunger = h.causes.get("famine");
  h.causes.delete("famine");
  const before = told(ECOLOGY_EVENTS.keptBroken.type).length;
  // (Not hungry: a keeping that falls is let go, not broken.)
  keptTurns(world, p.ref, h, year, famine, [["wild", 0.2, 0.05, null, 0.5]]);
  assert.equal(told(ECOLOGY_EVENTS.keptBroken.type).length, before);
  h.causes.set("famine", { cost: 1, at: year } as never);
  keptTurns(world, p.ref, h, year, famine, [["wild", 0.2, 0.05, null, 0.5]]);
  const broken = told(ECOLOGY_EVENTS.keptBroken.type);
  assert.equal(broken.length, before + 1);
  assert.equal(broken.at(-1)!.causes[0]!.ref, famine as Ref);
  assert.match(
    why(world, broken.at(-1)!.id).claim,
    /Hungry, .* hunted the grounds they had closed/,
  );
  // (Too little kept to tell, or not halved: nothing.)
  keptTurns(world, p.ref, h, year, famine, [["woods", 0.03, 0, null, 0.5]]);
  keptTurns(world, p.ref, h, year, famine, [["woods", 0.2, 0.15, null, 0.5]]);
  assert.equal(told(ECOLOGY_EVENTS.keptBroken.type).length, before + 1);
  h.causes.delete("famine");
  if (hunger) h.causes.set("famine", hunger);
});

test("a coming back is told once a loss: not again while the stand wavers above its line, again after it falls below", () => {
  const h = lessonsOf(world)!.holder(p.ref),
    taken = world.events.emit({ type: "lessons.taken", place: p.ref, causes: [], data: {} }),
    cleared = world.events.emit({
      type: ECOLOGY_EVENTS.cleared.type,
      place: p.ref,
      causes: [],
      data: {},
    }),
    had = h.uses.get("kept-woods"),
    marks = { keptBack: 0 },
    n = () => told(ECOLOGY_EVENTS.keptBack.type).length;
  h.uses.set("kept-woods", { w: 1, at: year, taken: year - 30, from: null, ref: taken } as never);
  const before = n();
  keptTurns(world, p.ref, h, year, null, [["woods", 0.2, 0.2, cleared, 0.42]], marks);
  keptTurns(world, p.ref, h, year, null, [["woods", 0.2, 0.2, cleared, 0.41]], marks);
  assert.equal(n(), before + 1);
  keptTurns(world, p.ref, h, year, null, [["woods", 0.2, 0.2, null, 0.25]], marks);
  keptTurns(world, p.ref, h, year, null, [["woods", 0.2, 0.2, cleared, 0.42]], marks);
  assert.equal(n(), before + 2);
  if (had) h.uses.set("kept-woods", had);
  else h.uses.delete("kept-woods");
});
