// Lessons from what has cost a people (rules/lessons.ts, sim/lore/lessons.ts): the rule's shape, a strike's record, a lesson taken up
// by a keyed draw, its working judged, what it lowers where the world reckons a loss, its spread, and its forgetting.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type SimTime,
  type World,
} from "../../src/kernel/index.ts";
import { cellRef } from "../../src/gen/index.ts";
import {
  LESSON,
  LESSON_CAUSE,
  LESSON_CAUSES,
  LESSON_RESPONSES,
  LESSONS_FOR,
  faded,
  lessenBy,
  pressOf,
  takeUpChance,
  trustOf,
  useAfter,
  OPEN,
  keptLife,
} from "../../src/rules/index.ts";
import {
  DISASTER_EVENTS,
  LESSON_EVENTS,
  LESSON_READ,
  knows,
  lessened,
  lessonAdds,
  lessonStrike,
  lessonsOf,
  makePopulationWorld,
  politiesOf,
  populationContext,
  useIn,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { lessonBlocks } from "../../src/host/inspect/lessons.ts";

test("every response answers a cause, every cause is read off history, and the figures are bounded", () => {
  for (const r of LESSON_RESPONSES) {
    assert.ok(LESSON_CAUSE.has(r.cause), `${r.id} answers ${r.cause}`);
    assert.ok(r.asks >= 0 && r.asks < 1 && r.most > 0, r.id);
  }
  // (A cause may wait for its answer: hunger is kept and told, and nothing yet answers it.)
  for (const c of LESSON_CAUSES) assert.ok(LESSONS_FOR.has(c.id), c.id);
  for (const t of [
    "act.quake",
    "act.fire",
    "act.flood",
    "people.famine",
    "health.outbreak",
    "war.battle",
  ])
    assert.ok(LESSON_READ.includes(t), t);
  assert.equal(lessenBy({ most: 0.6 }, 2), 0.6);
  assert.equal(lessenBy({ most: 0.6 }, -1), 0);
});

test("the more it has cost, the harder it presses; the more a response asks, the less readily it is taken up", () => {
  assert.equal(pressOf(0), 0);
  assert.ok(pressOf(0.01) < pressOf(0.05) && pressOf(0.05) < 1);
  assert.ok(takeUpChance(0.8, 0.5) < takeUpChance(0.8, 0.2));
  assert.ok(faded(1, LESSON.fade, LESSON.fade) === 0.5);
});

test("a response that works is leaned on more; one that does not, less", () => {
  const worked = trustOf(0.02, 0.01, 4),
    failed = trustOf(0.02, 0.04, 4);
  assert.ok(worked > 1 && failed < 1);
  assert.equal(trustOf(0.02, 0.01, 1), 1, "too soon to judge");
  const w = 0.5;
  assert.ok(useAfter(w, 0.8, 0.3, worked) > useAfter(w, 0.8, 0.3, 1));
  assert.ok(useAfter(w, 0.8, 0.3, failed) < w);
});

// A small world, peopled.
const seed = seedFromText("lessons"),
  build = () => makePopulationWorld(seed, { frequency: 12, start: "spread" }),
  AT = 200 * YEAR;
const base = build();
base.runTo(AT);
const RULESET = rulesetId(base, "test"),
  SAVED = saveWorld(base, RULESET),
  fresh = () => loadWorld(SAVED, build, RULESET).world;
const mostPeopled = (w: World) =>
  [...populationContext(w).provinces.all()].sort(
    (a, b) => b.total() - a.total() || a.cell - b.cell,
  )[0]!;

/** Strikes on a land, each a share of its people, until it takes up `response` (or `most` strikes). */
function strikeUntil(w: World, cell: number, cause: string, response: string, most = 40): number {
  const ctx = populationContext(w),
    store = lessonsOf(w)!,
    year = AT / YEAR;
  for (let i = 0; i < most; i++) {
    lessonStrike(
      ctx,
      store,
      { holder: cellRef(0, cell), cause, share: 0.02, lost: 120, dead: 40 },
      year + i,
      (AT + i * YEAR) as SimTime,
      null,
    );
    if (store.get(cellRef(0, cell))?.uses.has(response)) return year + i;
  }
  return -1;
}

test("a land struck again and again takes up a response by a draw, tells it, and is struck the less for it", () => {
  const w = fresh(),
    year = AT / YEAR,
    // (The most peopled land that has learned nothing of quakes yet: some of this world's already have.)
    land = [...populationContext(w).provinces.all()]
      .filter((p) => p.total() > 0 && lessened(w, cellRef(0, p.cell), "quake", year) === 1)
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!,
    holder = cellRef(0, land.cell);
  assert.equal(lessened(w, holder, "quake", year), 1, "nothing learned: exactly as it was");
  const took = strikeUntil(w, land.cell, "quake", "braced-frames");
  assert.ok(took >= year, "the quake-struck land never took up braced frames");
  const h = lessonsOf(w)!.get(holder)!;
  assert.ok(h.causes.get("quake")!.lost >= 120 && h.causes.get("quake")!.strikes >= 1);
  assert.ok(lessened(w, holder, "quake", took) < 1, "learned: each quake costs less");
  const told = w.events
    .all()
    .find((e) => e.type === LESSON_EVENTS.taken.type && e.place === holder);
  assert.ok(told, "the taking up is told");
  // (In what they know: lashed poles before joinery, braced timber after it, steel after that.)
  assert.match(
    why(w, told.id).claim,
    knows(populationContext(w), land.cell, "carpentry")
      ? /braced timber frames that stand when the ground shakes/
      : /frames of lashed poles that stand when the ground shakes/,
  );
  // Forgotten when the cost stops coming.
  assert.ok(useIn(h, "braced-frames", took + 400) === 0, "never forgotten");
  // Its page says what it cost them and what they do now, in numbers and words.
  const text = JSON.stringify(lessonBlocks(w, holder));
  assert.match(text, /From what has cost them/);
  assert.match(text, /\d+ homes and \d+ lives lost to quakes in (?:a year|\d+ years)/);
  assert.match(text, /frames .{0,30}that stand when the ground shakes/i);
  assert.doesNotMatch(text, /cell:0:|pol:|undefined|NaN/);
});

test("what is learned is where the world reckons a loss: the god's quake kills fewer where frames are braced", () => {
  const dead = (learned: boolean) => {
    const w = fresh(),
      land = mostPeopled(w),
      holder = cellRef(0, land.cell);
    if (learned)
      lessonsOf(w)!
        .holder(holder)
        .uses.set("braced-frames", {
          w: 1,
          at: AT / YEAR,
          taken: AT / YEAR,
          from: null,
          ref: null,
          before: 0.02,
          strikes: 0,
          since: 0,
        });
    const act = w.submit("act.quake", { cell: land.cell });
    w.runTo(AT + YEAR / 12);
    const e = w.events
      .all()
      .find((x) => x.type === DISASTER_EVENTS.quake.type && x.causes[0]?.ref === act.id)!;
    return (e.data as { dead: number }).dead;
  };
  const without = dead(false),
    braced = dead(true);
  assert.ok(without > 0);
  assert.ok(braced < without * 0.6, `${braced} dead braced against ${without}`);
});

test("a realm outnumbered in the battles it lost keeps more men under arms", () => {
  const w = fresh(),
    ctx = populationContext(w),
    store = lessonsOf(w)!,
    realm = [...politiesOf(w).living()].sort((a, b) => (a.ref < b.ref ? -1 : 1))[0]!,
    year = AT / YEAR;
  assert.equal(lessonAdds(w, realm.ref, "field", year), 0, "nothing learned: exactly as it was");
  for (let i = 0; i < 40 && !store.get(realm.ref)?.uses.has("greater-levy"); i++)
    lessonStrike(
      ctx,
      store,
      { holder: realm.ref, cause: "numbers", share: 0.01, lost: 500, dead: 500 },
      year + i,
      (AT + i * YEAR) as SimTime,
      null,
    );
  assert.ok(store.get(realm.ref)?.uses.has("greater-levy"), "never took up a greater levy");
  assert.ok(lessonAdds(w, realm.ref, "field", year + 40) > 0);
  const text = JSON.stringify(lessonBlocks(w, realm.ref));
  assert.match(
    text,
    /[\d,]+ men lost to being outnumbered in (?:a year|\d+ years) \(\d+ battles?\)/,
  );
});

test("a lesson spreads to those beside who have felt the same, and the record saves and loads", () => {
  const w = fresh(),
    ctx = populationContext(w),
    store = lessonsOf(w)!,
    lands = [...ctx.provinces.all()].filter((p) => p.total() > 0).map((p) => p.cell);
  // Every land has felt the fire a little; one after another is struck hard until one takes it from another.
  for (const c of lands)
    lessonStrike(
      ctx,
      store,
      { holder: cellRef(0, c), cause: "fire", share: 0.03, lost: 30, dead: 3 },
      AT / YEAR,
      AT as SimTime,
      null,
    );
  for (const c of lands.slice(0, 30)) {
    strikeUntil(w, c, "fire", "firebreaks", 20);
    if (store.copied > 0) break;
  }
  assert.ok(store.copied > 0, "no land took firebreaks from another");
  const copied = [...store.holders.values()]
    .flatMap((h) => [...h.uses.values()])
    .find((u) => u.from);
  assert.ok(copied?.from?.startsWith("cell:0:"));
  const again = loadWorld(saveWorld(w, RULESET), build, RULESET).world;
  assert.deepEqual(lessonsOf(again)!.save(), store.save());
});

test("a world's own record teaches it: lands and realms of a small world take lessons up from what history did to them", () => {
  const w = makePopulationWorld(seedFromText(keptLife("alien 41")), {
    prior: OPEN,
    start: "spread",
    frequency: 16,
  });
  w.runTo(400 * YEAR);
  const store = lessonsOf(w)!,
    lands = [...store.holders.entries()].filter(([k]) => k.startsWith("cell:")),
    realms = [...store.holders.entries()].filter(([k]) => k.startsWith("pol:"));
  assert.ok(store.taken > 0, "nothing was taken up");
  assert.ok(
    lands.some(([, h]) => h.uses.size > 0),
    "no land leans on a lesson",
  );
  assert.ok(
    realms.some(([, h]) => [...h.causes.values()].some((m) => m.strikes > 0 && m.lost > 0)),
    "no realm remembers a battle lost",
  );
  // Each lesson held answers a cause that has cost its holder something.
  for (const [, h] of store.holders)
    for (const id of h.uses.keys()) {
      const cause = LESSON_RESPONSES.find((r) => r.id === id)!.cause;
      assert.ok((h.causes.get(cause)?.strikes ?? 0) > 0, `${id} held with no ${cause} remembered`);
    }
  // And the Years tell the first in all the world.
  assert.ok(
    w.events
      .all()
      .some((e) => e.type === LESSON_EVENTS.taken.type && (e.data as { first?: boolean }).first),
  );
});

test("a world saved and loaded goes on learning as the one that was never saved", () => {
  const seedText = seedFromText(keptLife("alien 41")),
    make = () => makePopulationWorld(seedText, { prior: OPEN, start: "spread", frequency: 16 }),
    a = make();
  a.runTo(250 * YEAR);
  const ruleset = rulesetId(a, "test"),
    b = loadWorld(saveWorld(a, ruleset), make, ruleset).world;
  a.runTo(320 * YEAR);
  b.runTo(320 * YEAR);
  assert.ok((lessonsOf(a)!.taken ?? 0) > 0, "nothing learned to carry through a save");
  assert.deepEqual(b.domainHashes(), a.domainHashes());
});
