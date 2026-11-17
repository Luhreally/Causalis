// A peace is a bargain struck by the war's reckoning (rules/terms.ts dealOf, answerOf). Who is ahead goes by its chance. The one
// behind gives up what fighting on would cost it. The one ahead asks no more than it can hold the loser to at its reach: an
// oath where its hold outweighs how far the loser's own people hold its rule rightful, a tribute where collecting it is worth
// more than a year of war, and the loser's host stood down by as much as it can hold it to.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DISARM_MOST, answerOf, chanceOfEnd, dealOf, type WarEnd } from "../../src/rules/index.ts";

const end = (o: Partial<WarEnd>) =>
  dealOf({
    edge: 0,
    ratio: 1,
    spent: [0.01, 0.01],
    lands: 0,
    aim: "land",
    got: false,
    canBind: true,
    yearly: [0.02, 0.02],
    stakes: [0.2, 0.2],
    ...o,
  });

test("neither ahead by the reckoning: a truce, whatever the battles", () => {
  const d = end({ chance: 0.5, edge: 3 });
  assert.equal(d.winner, null);
  assert.equal(d.bond, "truce");
});

test("the one ahead asks as much as it can hold the loser to: more hold, more asked", () => {
  const near = end({ chance: 0.75, hold: [1, 1] }),
    far = end({ chance: 0.75, hold: [0.05, 1] });
  assert.equal(near.bond, "tribute");
  assert.notEqual(far.bond, "tribute");
  assert.ok((near.disarm ?? 0) > (far.disarm ?? 0));
});

test("an oath where the winner's hold outweighs how far the loser's people hold its rule rightful", () => {
  const firm = end({ chance: 0.85, ratio: 4, standing: [0.6, 0.9] }),
    loose = end({ chance: 0.85, ratio: 4, standing: [0.6, 0.2] });
  assert.notEqual(firm.bond, "vassal");
  assert.equal(loose.bond, "vassal");
  // (None where none can be bound.)
  assert.notEqual(
    end({ chance: 0.85, ratio: 4, standing: [0.6, 0.2], canBind: false }).bond,
    "vassal",
  );
});

test("a defender ahead makes its beaten attacker pay, by the same bargain", () => {
  const d = end({ chance: 0.2 });
  assert.equal(d.winner, 1);
  assert.equal(d.bond, "tribute");
});

test("a beaten host is stood down as far as the winner can hold it, the more the stronger it still is", () => {
  const strong = end({ chance: 0.75, ratio: 0.8 }),
    weak = end({ chance: 0.75, ratio: 4 });
  assert.ok((strong.disarm ?? 0) > (weak.disarm ?? 0));
  assert.ok((end({ chance: 1, ratio: 0.01 }).disarm ?? 0) <= DISARM_MOST);
});

test("land held stays held; a host come for a friend goes home under a truce; a rising that won is free", () => {
  assert.equal(end({ chance: 0.55, lands: 1, got: true, hold: [0.01, 1] }).bond, null);
  assert.equal(end({ chance: 0.9, aim: "ally" }).bond, "truce");
  assert.equal(end({ chance: 0.9, aim: "free", got: true }).bond, null);
});

test("the chance read off the battles where the reckoning is not given leans with the edge and the strength", () => {
  assert.equal(chanceOfEnd({ edge: 0, ratio: 1 }), 0.5);
  assert.ok(chanceOfEnd({ edge: 3, ratio: 1 }) > 0.5);
  assert.ok(chanceOfEnd({ edge: 0, ratio: 3 }) > 0.5);
  assert.equal(chanceOfEnd({ edge: 3, ratio: 1, chance: 0.2 }), 0.2);
});

test("a ruler's demand is met where the bargain would give at least as much", () => {
  assert.equal(answerOf("take-land", 1, 1, false, true), null);
  assert.equal(answerOf("take-land", -1, 1, false, true), "not-beaten");
  assert.equal(answerOf("take-tribute", 2, 1, false, true, { hold: [1, 1] }), null);
  assert.equal(answerOf("take-tribute", 2, 1, false, true, { hold: [0.02, 1] }), "not-beaten");
  assert.equal(answerOf("take-knee", 3, 6, false, true, { standing: [0.6, 0.2] }), null);
  assert.equal(answerOf("take-knee", 3, 6, false, true, { standing: [0.6, 0.95] }), "not-knee");
  assert.equal(answerOf("take-knee", 3, 6, false, false, { standing: [0.6, 0.2] }), "cannot-bind");
});
