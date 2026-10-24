import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../../src/kernel/index.ts";
import {
  PEOPLES_EVENTS,
  SUMMON_EVENTS,
  calledPeople,
  makePopulationWorld,
  peoplesOf,
  politiesOf,
  populationContext,
  type Polity,
} from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";

// Phase 20 M142: the god calls strangers down. Juniper's realms sixty years on, where one people
// of another star — the longest at the stars — could come.
const seed = seedFromText("juniper"),
  build = (s = seed) => makePopulationWorld(s, { start: "spread" }),
  world = build();
world.runTo(60 * YEAR);
const RULESET = rulesetId(world, "test"),
  AS_IT_WAS = saveWorld(world, RULESET),
  fresh = () => loadWorld(AS_IT_WAS, build, RULESET).world;

const held = (w: World, cell: number) => populationContext(w).provinces.get(cell)?.total() ?? 0;
const greatest = (w: World): Polity => {
  const people = (p: Polity) => p.members.reduce((n, c) => n + held(w, c), 0);
  return [...politiesOf(w).living()].sort(
    (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
  )[0]!;
};

test("called by the god, strangers of another star cross in a year and come down in the land chosen; the why goes back to the call", () => {
  const w = fresh(),
    p = greatest(w),
    // (Not its seat, where they would have come of themselves: another of its lands.)
    cell = [...p.members]
      .filter((c) => c !== p.seat && held(w, c) > 0)
      .sort((a, b) => held(w, b) - held(w, a) || a - b)[0]!,
    civ = calledPeople(w, populationContext(w), 60)!,
    store = peoplesOf(w)!,
    had = store.landings.length;
  assert.ok(civ && civ.stars <= 60, "a people at the stars to call");
  w.submit("act.summon", { cell });
  w.runTo(62 * YEAR);
  const landing = store.landings.slice(had).find((l) => l.civ === civ.ref)!;
  assert.ok(landing, "they came down");
  assert.equal(landing.cell, cell, "in the land the god chose");
  assert.equal(landing.year, 61, "a year's crossing");
  assert.equal(w.events.get(landing.event)!.type, PEOPLES_EVENTS.landed.type);
  const call = w.events.all().findLast((e) => e.type === SUMMON_EVENTS.called.type)!;
  assert.ok(call.subjects.includes(civ.ref));
  assert.ok(
    spine(w, landing.event, 4).some((x) => x.ref === call.id),
    "their coming down goes back to the god's call",
  );
  assert.match(why(w, landing.event).claim, /came down in .+ at the god's call/);
  assert.match(why(w, call.id).claim, /^At the god's call the .+ crossed the dark in a year/);
  // The land meets them as it would have: each side's reaction weighed, the meeting kept.
  const m = store.meetings.find((x) => x.civ === civ.ref && x.cell === cell)!;
  assert.ok(m, "they met where they came down");
  const met = w.events.get(m.event)!;
  assert.equal(
    met.causes.filter((c) => w.decisions.get(c.ref)?.rule === "contact.react").length,
    2,
  );
});

test("the god's call is refused for want of a land or of anyone in it", () => {
  const w = fresh(),
    ctx = populationContext(w),
    cells = ctx.generated.grid.offsets.length - 1;
  let empty = -1;
  for (let c = 0; c < cells && empty < 0; c++) if (held(w, c) <= 0) empty = c;
  assert.ok(empty >= 0);
  assert.throws(() => w.submit("act.summon", {}), /a land is wanted/);
  assert.throws(() => w.submit("act.summon", { cell: empty }), /no one lives there/);
});
