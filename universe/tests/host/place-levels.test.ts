// The town's ground level by level (town mode, R8): its soil with its dead and its wells, the water they draw, then each
// depth its lodes are dug to. Each lode at every level down to the depth it is dug, being dug or given out at its deepest;
// each well at the soil and the water; the stuff of each level its ground's cut's; the deeper levels past its land's
// means marked so, never one reached below one not. Read only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { LODE_DEPTH_WORDS } from "../../src/rules/index.ts";
import { lodesOf } from "../../src/sim/index.ts";
import { enterPlace, graveLot, placeDigest, type Place } from "../../src/host/place.ts";
import { placeBelow } from "../../src/host/placebelow.ts";
import { placeInspect } from "../../src/host/placeinspect.ts";
import { placeLevelsRef, type PlaceInspectLevels } from "../../src/bridge/index.ts";
import { noTown, placeWorld, townWhere } from "./worlds.ts";

test("the town's ground level by level: its dead and wells, its water, each depth its lodes are dug to", (t) => {
  const w = placeWorld(150);
  let checked = 0,
    lodes = 0;
  // (A town whose land has lodes dug, where one is, else of five hundred; and one of a hundred.)
  const dug = (place: Place) =>
    (lodesOf(w)?.all() ?? []).some((l) => l.cell === place.cell && (l.dug > 0 || l.out !== null));
  for (const [least, need] of [
    [100, dug],
    [500, () => true],
  ] as const) {
    const s =
      townWhere(w, need, { near: 3000, least }) ?? (checked ? null : noTown(t, `of ${least}`));
    if (!s) continue;
    const town: string = s.ref,
      place = enterPlace(w, town)!,
      before = placeDigest(place),
      b = placeBelow(w, place),
      x = placeInspect(w, town, placeLevelsRef(town)) as PlaceInspectLevels;
    assert.equal(x.kind, "levels");
    assert.equal(x.levels.length, 2 + LODE_DEPTH_WORDS.length);
    // (Its soil: its dead at its grave's lot, its wells; the water: its wells again.)
    const soil = x.levels[0]!,
      water = x.levels[1]!;
    assert.equal(soil.dug.filter((d) => d.icon === "💧").length, b.wells);
    assert.ok(soil.dug.some((d) => d.icon === "🪦" && d.lot === graveLot(place)));
    if (!b.undersea) assert.equal(water.dug.filter((d) => d.icon === "💧").length, b.wells);
    // (Each lode at each depth down to its own, its state at its deepest.)
    for (const l of b.lodes) {
      lodes++;
      x.levels.slice(2).forEach((level, k) => {
        const here = level.dug.filter(
          (d) => d.works && d.words.toLowerCase().startsWith(l.name.toLowerCase()),
        );
        if (k > l.tier) return assert.equal(here.length, 0);
        assert.ok(here.length >= 1, `${l.name} at the depth ${k}`);
        if (k === l.tier)
          assert.ok(here.some((d) => d.state === (l.out !== null ? "out" : "digging")));
        else assert.ok(here.every((d) => d.state === "dug"));
      });
    }
    // (Reached down to some depth, and past it not.)
    const reached = x.levels.map((l) => l.reached);
    assert.ok(reached[0] && reached[1]);
    for (let k = 3; k < reached.length - 1; k++) if (reached[k]) assert.ok(reached[k - 1]);
    for (const l of x.levels) assert.ok(l.stuff.length > 1);
    t.diagnostic(
      `${town}: ${x.sub}; ${x.levels.map((l) => `${l.name} (${l.stuff}): ${l.dug.length}`).join("; ")}`,
    );
    assert.equal(placeDigest(place), before, "read only");
    checked++;
  }
  t.diagnostic(`${checked} towns, ${lodes} lodes`);
});
