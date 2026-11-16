// Round B: intoxicants as pure rules. What a world's life puts in reach, who takes it, what it gives and costs, who forbids it, and
// where those who carry it organise.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cartel,
  intoxAvailable,
  intoxEffects,
  intoxUse,
  prohibits,
} from "../../src/rules/index.ts";

test("only a life of the people's own chemistry acts on them; a ferment where they brew", () => {
  const none = intoxAvailable(["visions", "easing"], 1, 8, false, false);
  assert.equal(none.visions + none.easing + none.calming + none.waking, 0);
  const rich = intoxAvailable(["visions", "easing"], 1, 8, true, true),
    poor = intoxAvailable(["visions"], 0.1, 0, false, true);
  assert.ok(rich.visions > poor.visions && rich.calming >= 0.8 && rich.waking === 0);
});

test("a people takes what it wants of what there is, less what its law keeps from it", () => {
  const have = { calming: 0.8, waking: 0.5, visions: 0.5, easing: 0.5 },
    devout = intoxUse(have, { piety: 1, toil: 0, pain: 0, hardship: 0 }, 0),
    barred = intoxUse(have, { piety: 1, toil: 0, pain: 0, hardship: 0 }, 1);
  assert.ok(
    devout.visions > intoxUse(have, { piety: 0, toil: 0, pain: 0, hardship: 0 }, 0).visions,
  );
  assert.ok(barred.visions < devout.visions);
  const fx = intoxEffects({ calming: 0.3, waking: 0, visions: 0, easing: 0.3 });
  assert.ok(fx.dependent > 0 && fx.lost > 0 && fx.deaths > 0);
  // What wakes gives more work than it costs.
  assert.ok(intoxEffects({ calming: 0, waking: 0.4, visions: 0, easing: 0 }).lost < 0);
  // Visions bind next to none.
  assert.ok(intoxEffects({ calming: 0, waking: 0, visions: 0.3, easing: 0 }).dependent < 0.01);
});

test("forbidden by a temple and court held hard; allowed by traders, treasury and heard takers; cartels where reach is weak", () => {
  const sides = {
    temple: 0.4,
    rites: 0,
    court: 0.4,
    lost: 0.1,
    force: 0.9,
    voice: 0.1,
    word: 0.1,
    traders: 0.05,
    excise: 0,
    users: 0.1,
  };
  assert.ok(prohibits(sides).level > 0.5);
  assert.equal(
    prohibits({
      ...sides,
      rites: 1,
      temple: 0.1,
      court: 0.1,
      traders: 0.4,
      excise: 0.2,
      voice: 0.8,
      word: 0.8,
      users: 0.4,
    }).level,
    0,
  );
  assert.ok(cartel(1, 1, 0.2, 0.5) > cartel(1, 1, 0.9, 0));
  assert.equal(cartel(0, 2, 0.1, 1), 0);
});
