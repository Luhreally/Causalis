// A court's judge on its sitting days, on a world that has such a court (first light three hundred years on, spread: its
// realms write and keep a magistrate; juniper at sixty and first light at 245 have only elders, so the check in
// notables.test.ts that the judge judges never ran). The judge is a key figure with a body in the town, and a key figure
// the court has that day keeps the court's day.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Ref } from "../../src/kernel/index.ts";
import { populationContext } from "../../src/sim/index.ts";
import { notablesIn } from "../../src/host/inspect/notables.ts";
import { courtFormOf } from "../../src/host/inspect/justice.ts";
import { withFigures } from "../../src/host/leaders.ts";
import { villagePlan } from "../../src/host/village.ts";
import { momentOf } from "../../src/view/index.ts";
import { courtRole } from "../../src/view/court.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("first light", 300, { start: "spread" }),
  towns = populationContext(world)
    .settlements.all()
    .filter((t) => t.population > 0),
  day0 = Math.floor(world.now / 86_400);

test("a magistrate's court has a judge, who judges on the days it sits and not on the others", () => {
  let sat = 0;
  for (const t of towns.slice(0, 60)) {
    const form = courtFormOf(world, t);
    if (form !== "magistrate" && form !== "bench") continue;
    const judge = notablesIn(world, t.ref).find((n) => n.kind === "judge");
    assert.ok(judge, `${t.ref}: a ${form} court has its judge`);
    const plan = withFigures(world, villagePlan(world, t.ref as Ref, undefined, 120)),
      i = plan.people.findIndex((p) => p.figure === judge.ref);
    assert.equal(plan.court?.judge, judge.ref);
    assert.ok(i >= 0, `${t.ref}: the judge is drawn`);
    const days = new Set((plan.court?.sittings ?? []).map((s) => s.day));
    for (const s of plan.court?.sittings ?? []) {
      if (s.day <= day0) continue;
      assert.equal(courtRole(plan, i, s.day)?.kind, "judge", "the judge judges");
      const m = momentOf(plan, i, s.day * 86_400 + 11 * 3600);
      // (A day the weather sends everyone in is no day in the open.)
      if (/out of the weather/.test(m.why ?? "") || m.hidden) continue;
      assert.match(m.why ?? "", /^Judging at /, `${t.ref} day ${s.day}`);
      assert.equal(m.of?.ref, s.ref);
      sat++;
      // The day after, where the court does not sit: not at the court.
      if (!days.has(s.day + 1)) {
        assert.equal(courtRole(plan, i, s.day + 1), null);
        assert.doesNotMatch(
          momentOf(plan, i, (s.day + 1) * 86_400 + 11 * 3600).why ?? "",
          /^Judging/,
        );
      }
    }
    if (sat >= 6) break;
  }
  assert.ok(sat >= 3, `judges seen judging: ${sat}`);
});
