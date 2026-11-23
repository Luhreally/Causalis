// How far a people's "us" reaches toward beings of other bodies (rules/circle.ts), and a sickness met between worlds
// (rules/landfall.ts sicknessMet): the breadth round, 2026-11-23.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLADES,
  bodyLikeness,
  circleLeans,
  moralCircle,
  sicknessMet,
} from "../../src/rules/index.ts";

const body = (id: string) => CLADES.find((c) => c.id === id)!.body as never;

test("a body is most like itself, and less like one of another medium and senses", () => {
  const ape = body("ape"),
    others = CLADES.filter((c) => c.id !== "ape").map((c) =>
      bodyLikeness(ape, c.body as never, false),
    );
  assert.equal(bodyLikeness(ape, ape, true), 1);
  for (const x of others) assert.ok(x < 1 && x >= 0);
  assert.ok(Math.min(...others) < Math.max(...others), "bodies differ in how like they are");
});

test("the circle widens with the reach of 'us' and likeness, narrows under a faith that fears harm", () => {
  const base = { reach: 0.5, likeness: 0.5, harms: 0, gives: 0, knows: 0 };
  assert.ok(moralCircle({ ...base, reach: 0.9 }) > moralCircle(base));
  assert.ok(moralCircle({ ...base, likeness: 0.9 }) > moralCircle(base));
  assert.ok(moralCircle({ ...base, harms: 1 }) < moralCircle(base));
  assert.ok(moralCircle({ ...base, gives: 1 }) > moralCircle(base));
  // (Even a being wholly unlike is reached a little, as far as "us" reaches.)
  assert.ok(moralCircle({ ...base, likeness: 0 }) > 0);
});

test("a wide circle leans a meeting from war and fear to wonder and trade", () => {
  const w = [1, 1, 1, 1] as const,
    none = circleLeans(w, 0),
    wide = circleLeans(w, 1);
  assert.deepEqual(none, [1, 1, 1, 1]);
  assert.ok(wide[3] < none[3] && wide[1] < none[1]);
  assert.ok(wide[0] > none[0] && wide[2] > none[2]);
});

test("a sickness crosses between worlds only between lives of one liquid, less once met, less where the taker keeps its sick apart", () => {
  const r = { same: true, giverRung: 4, giverSick: 0, met: false, takerRung: 3, u: 0.1, v: 1 };
  assert.equal(sicknessMet({ ...r, same: false }), 0);
  const first = sicknessMet(r);
  assert.ok(first > 0);
  assert.ok(sicknessMet({ ...r, met: true }) < first);
  assert.ok(sicknessMet({ ...r, takerRung: 7 }) < first);
  // (A people of camps breeds none of its own to carry; one sick now carries what it has.)
  assert.equal(sicknessMet({ ...r, giverRung: 0 }), 0);
  assert.ok(sicknessMet({ ...r, giverRung: 0, giverSick: 0.5 }) > 0);
});
