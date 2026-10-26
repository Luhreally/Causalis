// The card's "Today" (Phase 39 M198, Phase 55 M226/M229): what one of those drawn is at on a day,
// told from their day as it was laid — the care of the wounded, a wound's day, a day at ease, or
// the errand the ground gave where their role's could not be had — never a role they are not about.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_WORDS, legsTold, townDay, villageSolids, workTold } from "../../src/view/index.ts";
import { D0, woundedPlan } from "./wounded-town.ts";

test("a wound's day, and the care of the wounded, are what the card says", () => {
  const plan = woundedPlan();
  assert.equal(workTold(plan, 0, D0 + 1), "away with the levy");
  assert.equal(workTold(plan, 1, D0 + 1), "tending the wounded", "the healer's round");
  assert.equal(workTold(plan, 3, D0 + 2), "abed with their wounds");
  assert.equal(
    workTold(plan, 10, D0 + 1),
    "kept from work by their wound, at their ease near home",
    "on a crutch",
  );
});

test("a role whose errand the ground could not give is told by the errand it gave", () => {
  // (In shrubland: no tree to fell for firewood, so its days go to the fields.)
  const plan = { ...woundedPlan(), biome: 7 },
    solids = villageSolids(plan);
  let checked = 0,
    fell = 0;
  // A year of days: every one of those drawn whose day was laid from their role.
  for (let day = D0 + 70; day < D0 + 70 + 365; day += 7) {
    const town = townDay(plan, day, solids);
    if (town.rest) continue;
    town.roles.forEach((role, i) => {
      if (!role || role.kind === "as-ever") return;
      const words = workTold(plan, i, day),
        whys = legsTold(plan, i, day)
          .map((l) => l.why ?? "")
          .join(" | ");
      // (Firewood with no tree in reach: the muck ploughed in, or the rows hoed.)
      if (role.kind === "firewood" && !/firewood/i.test(whys)) {
        fell++;
        assert.equal(words, ROLE_WORDS.hoe, `${i} on ${day}: ${whys}`);
      }
      if (words === ROLE_WORDS.firewood) assert.match(whys, /firewood/i, `${i} on ${day}`);
      checked++;
    });
  }
  assert.ok(checked > 100, `${checked} days told`);
  assert.ok(fell > 0, "days of firewood with no tree to fell");
});

test("the same day, the same words; a day of rest tells none", () => {
  const plan = woundedPlan(),
    again = woundedPlan();
  for (let i = 0; i < plan.people.length; i++)
    assert.equal(workTold(plan, i, D0 + 5), workTold(again, i, D0 + 5), `${i}`);
  const solids = villageSolids(plan);
  let day = D0 + 70;
  while (!townDay(plan, day, solids).rest) day++;
  for (let i = 0; i < plan.people.length; i++) assert.equal(workTold(plan, i, day), null, `${i}`);
});
