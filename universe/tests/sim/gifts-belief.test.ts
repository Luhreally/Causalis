// A wonder done through a body by the god's gifts is an omen as the world's other signs are (sim/belief/belief.ts omenOf,
// "hand.wonder"): whether a faith comes of it is the omen rule's own chance, by how many saw it and how pious the land is.
// Asked 2026-11-21: "are they gonna start religion over … unless the first principles emerge". On "first light" at year
// 120, when a dozen of its lands hold no faith yet: wonders seen by a dozen found one in some of them, not all; seen by two,
// fewer; in lands that hold a faith (of the wonder's sign or another), none.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type Ref, type World } from "../../src/kernel/index.ts";
import { BELIEF_EVENTS, beliefOf, cultureOf, omenOf } from "../../src/sim/index.ts";
import { peopledWorld } from "../worlds.ts";

const TENETS = ["healing", "fire", "presence", "rain"];

/** Where each land's events stand (a place's ref ends in its cell). */
function placesOf(world: World): Map<number, Ref> {
  const at = new Map<number, Ref>();
  for (const e of world.events.all())
    if (e.place?.split(":").length === 3) at.set(Number(e.place.split(":")[2]), e.place);
  return at;
}

type Wonder = { cell: number; tenet: string; seen: number; times: number };

/**
 * The world at 120 a few days on (`day`: each trial's own day, so the omen's draws differ), wonders done in lands as `plan`
 * says, the year run out: the lands where a faith was founded of one, and each land's faith before and after.
 */
function trial(
  day: number,
  plan: (world: World, cells: number[]) => Wonder[],
): {
  founded: Set<number>;
  faithOf: (cell: number) => Ref | null;
  before: Map<number, Ref | null>;
} {
  const world = peopledWorld("first light", 120, { start: "spread" }),
    faiths = beliefOf(world),
    places = placesOf(world),
    cells = [...places.keys()].filter((c) => cultureOf(world).get(c));
  world.runTo(world.now + (1 + day) * 86_400);
  const wonders = plan(world, cells),
    before = new Map(wonders.map((w) => [w.cell, faiths.of(w.cell).faith]));
  for (const w of wonders)
    for (let i = 0; i < w.times; i++)
      world.events.emit({
        type: "hand.wonder",
        subjects: [],
        place: places.get(w.cell)!,
        causes: [],
        data: { tenet: w.tenet, what: ["healed"], seen: w.seen, hand: "a test", town: "a test" },
      });
  const from = world.events.count;
  world.runTo((Math.floor(world.now / YEAR) + 1) * YEAR + 86_400);
  const founded = new Set<number>();
  for (let i = from; i < world.events.count; i++) {
    const e = world.events.at(i);
    if (e.type !== BELIEF_EVENTS.founded.type) continue;
    if (world.events.get(e.causes[0]!.ref)?.type === "hand.wonder")
      founded.add(Number(e.place!.split(":")[2]));
  }
  return { founded, faithOf: (c) => faiths.of(c).faith, before };
}

test("a wonder's sign is as strong as how many saw it, never as strong as the god's act on a land", () => {
  assert.equal(omenOf("hand.wonder", { tenet: "healing", seen: 0 }), null);
  assert.equal(omenOf("hand.wonder", { tenet: "healing", seen: 6 })!.strength, 0.5);
  assert.ok(omenOf("hand.wonder", { tenet: "healing", seen: 1e6 })!.strength < 1);
});

test("wonders found a faith in some pious lands of no faith, by the omen rule's chance; in lands of a faith, none", () => {
  let chances = 0,
    many = 0,
    few = 0,
    faithful = 0;
  for (let day = 0; day < 4; day++) {
    // In each land of no faith a healing seen by a dozen; in a few lands of a faith, three wonders of its sign and three
    // of another, each seen by thirty.
    const r = trial(day, (world, cells) => {
      const faiths = beliefOf(world),
        none = cells.filter((c) => !faiths.of(c).faith),
        held = cells.filter((c) => faiths.of(c).faith).slice(0, 12);
      chances += none.length;
      return [
        ...none.map((cell) => ({ cell, tenet: "healing", seen: 12, times: 1 })),
        ...held.flatMap((cell) => {
          const own = faiths.get(faiths.of(cell).faith!)!.tenet as string,
            other = TENETS.find((t) => t !== own)!;
          return [
            { cell, tenet: TENETS.includes(own) ? own : "presence", seen: 30, times: 3 },
            { cell, tenet: other, seen: 30, times: 3 },
          ];
        }),
      ];
    });
    for (const [cell, was] of r.before)
      if (was) {
        faithful++;
        assert.ok(!r.founded.has(cell), "a land that holds a faith founds none of a wonder");
        assert.equal(r.faithOf(cell), was, "and keeps its own");
      } else if (r.founded.has(cell)) many++;
    // The same lands of no faith, each wonder seen by two.
    const s = trial(day, (world, cells) => {
      const faiths = beliefOf(world);
      return cells
        .filter((c) => !faiths.of(c).faith)
        .map((cell) => ({ cell, tenet: "healing", seen: 2, times: 1 }));
    });
    few += s.founded.size;
  }
  console.log(
    `  seen by a dozen: ${many} faiths founded of ${chances} wonders in lands of no faith; seen by two: ${few}; lands of a faith given wonders: ${faithful}, none founded one`,
  );
  assert.ok(chances >= 20, `${chances} wonders done in lands of no faith`);
  assert.ok(many >= 1, "a wonder seen by many can found a faith");
  assert.ok(many < chances / 2, "but not wherever it is done");
  assert.ok(few < many, "one seen by two, the less");
  assert.ok(faithful >= 20);
});
