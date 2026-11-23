// How many children a people bears (round "peoples", rules/children.ts): as many as it wants living, the fewer the more of its
// young live and the dearer each is to raise; the same rule for any body.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHILDREN,
  bearersServe,
  bearingHeld,
  HUMANLIKE,
  bearingOf,
  childCost,
  childrenKept,
  childrenWanted,
  girlsOf,
  lifeHistoryOf,
  livingToBear,
  type BodyPlan,
} from "../../src/rules/index.ts";

test("a people with no cost to its children bears all its bodies can; one at the full cost about replaces itself", () => {
  // (At plenty, an upright ape mother bears five, and some half of them live to bear their own.)
  const b = bearingOf(HUMANLIKE);
  assert.ok(b.born > 4.5 && b.born < 5.5, `${b.born} born`);
  assert.ok(b.at > 25 && b.at < 32, `borne at ${b.at}`);
  const live = livingToBear(HUMANLIKE, 1);
  assert.ok(live > 0.4 && live < 0.55, `${live} live to bear`);
  assert.equal(childrenKept(HUMANLIKE, 1, 0), 1);
  // At the full cost, the living children a mother has are those that replace her, and a little over.
  const full = childCost(1, 1),
    kept = childrenKept(HUMANLIKE, 0.7, full),
    living = b.born * kept * livingToBear(HUMANLIKE, 0.7);
  assert.ok(living >= CHILDREN.replace && living < CHILDREN.replace * 1.1, `${living} living`);
});

test("the more of its young live, the fewer it bears; the dearer they are, the fewer it wants", () => {
  const cost = childCost(0.5, 0.5);
  assert.ok(childrenKept(HUMANLIKE, 0.7, cost) < childrenKept(HUMANLIKE, 1, cost));
  assert.ok(childrenWanted(childCost(0.8, 0.2)) < childrenWanted(childCost(0.2, 0.2)));
  assert.ok(childrenWanted(childCost(0.2, 0.8)) < childrenWanted(childCost(0.2, 0.2)));
  // (Never fewer than replace them: a people at the end of its transition levels off.)
  assert.ok(childrenWanted(childCost(1, 1)) > CHILDREN.replace);
});

test("a spawning people of the sea comes to the same end by the same rule: as many living as replace it", () => {
  const spawner = lifeHistoryOf({
    clade: "fish",
    name: "swimmers",
    medium: "water",
    symmetry: "bilateral",
    size: 40,
    manipulators: "fins",
    limbs: 2,
    senses: ["sight"],
    skin: "scales",
    warm: false,
    diet: "flesh",
    bearing: "spawn",
    young: 37,
    span: 39,
    social: 0.59,
  } as unknown as BodyPlan);
  const b = bearingOf(spawner);
  assert.ok(b.born > bearingOf(HUMANLIKE).born, "it bears more");
  assert.ok(livingToBear(spawner, 1) < livingToBear(HUMANLIKE, 1), "and fewer of them live");
  const full = childCost(1, 1);
  // (A fed people, whatever its body, has as many living as it wants, never fewer than replace it: Round A's alien 55 fell
  // from 278 million to 26 million fed, on a transition read off its tides' power alone.)
  for (const life of [HUMANLIKE, spawner]) {
    const kept = childrenKept(life, 0.7, full),
      alive = bearingOf(life).born * kept * livingToBear(life, 0.7);
    // (As many as replace its mothers: by the share of its born who bear, rules/species.ts girlsOf.)
    assert.ok(
      Math.abs(alive - childrenWanted(full, 0, girlsOf(life))) < 1e-9,
      `${life.name}: ${alive}`,
    );
  }
});

test("who bears is sent to war as far as her young spare her: no ape mother, every spawning one", () => {
  const ape = { bearing: "live", young: 1, span: 70 },
    held = bearingHeld(ape, HUMANLIKE);
  // (Five young, each carried most of a year and nursed two more, over the thirty-five years she bears.)
  assert.ok(held > 0.35 && held < 0.45, `${held} of her bearing years`);
  assert.equal(bearersServe(held), 0);
  assert.equal(bearersServe(bearingHeld({ bearing: "spawn", young: 37, span: 39 }, HUMANLIKE)), 1);
  const layer = bearersServe(bearingHeld({ bearing: "eggs", young: 4, span: 70 }, HUMANLIKE));
  assert.ok(layer > 0.5 && layer < 1, `${layer} of egg-layers' mothers`);
});
