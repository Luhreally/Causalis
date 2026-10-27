import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type SimTime } from "../../src/kernel/index.ts";
import { OPEN } from "../../src/rules/index.ts";
import {
  civilizationsNear,
  healthOf,
  healthYear,
  makePopulationWorld,
  peoplesOf,
  populationContext,
  riseSickness,
  sharesStarSickness,
} from "../../src/sim/index.ts";

// Phase 57: a sickness is a life that lives on its host. Every people of the stars is of water, so
// on a world whose life is of ammonia water none of theirs comes down with them, nor ours goes home.

const ammonia = makePopulationWorld(seedFromText("alien 218"), { prior: OPEN, start: "spread" });
ammonia.runTo(20 * YEAR);

test("only a people whose life is of water shares sickness with the peoples of the stars", () => {
  const g = populationContext(ammonia).generated;
  assert.equal(sharesStarSickness(g), false, "ammonia water's");
  const sulfur = makePopulationWorld(seedFromText("alien 84"), { prior: OPEN });
  assert.equal(
    sharesStarSickness(populationContext(sulfur).generated),
    true,
    "acid water's is water",
  );
  const earth = makePopulationWorld(seedFromText("first light"));
  assert.equal(sharesStarSickness(populationContext(earth).generated), true);
});

test("strangers from the stars come down on an ammonia-water world: no sickness of theirs takes hold, and none of ours goes with them", () => {
  const w = ammonia,
    ctx = populationContext(w),
    store = healthOf(w)!,
    civ = [...civilizationsNear(w)].sort(
      (a, b) => a.stars - b.stars || (a.ref < b.ref ? -1 : 1),
    )[0]!,
    lands = ctx.provinces
      .all()
      .filter((p) => p.total() > 0)
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell)
      .slice(0, 12)
      .map((p) => p.cell);
  assert.ok(lands.length >= 6, "peopled lands to come down in");
  // One of ours, fresh in the first land they come down in.
  const ours = riseSickness(
    ctx,
    lands[0]!,
    "herds",
    [{ name: "a test's hand", value: 1, contribution: 1, source: null }],
    (19 * YEAR + 1) as SimTime,
  );
  (ours as { reach: number }).reach = 1;
  const cause = ours.event as Ref;
  for (const cell of lands)
    peoplesOf(w)!.landings.push({ civ: civ.ref, cell, year: 19, omen: false, event: cause });
  healthYear(ctx, (20 * YEAR + 1) as SimTime);
  assert.ok(!store.sicknesses.some((s) => s.people === civ.ref), "none of theirs came down");
  assert.ok(!store.went.some((x) => x.civ === civ.ref), "none of ours went home with them");
});
