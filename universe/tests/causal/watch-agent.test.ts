// Following one of the people under the hand (asked for 2026-10-26: "why dont i get the option to
// follow/pin em yk? it is a town ive layed my hand on?"): while the hand rests, the news of their
// children, the god's touches and their death; once it is lifted, remembered by name.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { FEMALE } from "../../src/rules/index.ts";
import { agentName, handOf, makePopulationWorld, populationContext } from "../../src/sim/index.ts";
import { newsLog, setWatch, tidings, watches } from "../../src/causal/index.ts";
import { cradleCell } from "../cradle.ts";

const HOME = cradleCell("first light");

test("one under the hand followed: their children told, and remembered once the hand is lifted", () => {
  const w = makePopulationWorld(seedFromText("first light"));
  w.runTo(240 * YEAR);
  const town = populationContext(w)
    .settlements.inProvince(HOME)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0]!;
  w.submit("hand.lay", { village: town.ref });
  w.runTo(240 * YEAR + 1);
  const hand = handOf(w).resting!,
    year = 240,
    // Young wives: some will bear a child in the years followed.
    wives = hand.agents
      .filter(
        (a) =>
          a.sex === FEMALE &&
          a.partner !== undefined &&
          year - a.birthYear >= 19 &&
          year - a.birthYear <= 30,
      )
      .slice(0, 30);
  assert.ok(wives.length >= 10, `${wives.length} young wives under the hand`);
  for (const a of wives) assert.equal(setWatch(w, `agent:${a.id}` as Ref, true), true);
  const first = wives[0]!,
    name = agentName(populationContext(w), first, town);
  assert.equal(
    watches(w).find((x) => x.ref === `agent:${first.id}`)?.label,
    name,
    "followed by their name",
  );
  // Not a thing that is no one's.
  assert.equal(setWatch(w, "agent:999999" as Ref, true), false);
  w.runTo(246 * YEAR + 1);
  const told = tidings(w);
  const born = told.filter((t) => t.type === "life.child");
  assert.ok(
    born.length > 0,
    `a child born to one of them: ${told.map((t) => t.claim).join(" | ")}`,
  );
  for (const t of born) assert.match(t.claim, /: a child born, in year 24[0-5]$/);
  // Told once: asked again, nothing new.
  assert.deepEqual(
    tidings(w).filter((t) => t.type === "life.child"),
    [],
  );
  // The message log keeps them.
  assert.ok(newsLog(w).some((t) => t.type === "life.child"));
  // The hand lifted: they are no one now, but remembered so.
  w.submit("hand.lift", {});
  w.runTo(246 * YEAR + 2);
  assert.equal(
    watches(w).find((x) => x.ref === `agent:${first.id}`)?.label,
    `${name} (your hand lifted)`,
  );
});
