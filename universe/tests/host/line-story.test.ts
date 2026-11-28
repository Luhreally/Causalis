import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import { storyOf } from "../../src/host/line-story.ts";
import { politiesOf, populationContext } from "../../src/sim/index.ts";
import { universeWorld } from "./worlds.ts";

test("a line's story reads its land's first village, market town and realm off the world, and none it has not", () => {
  const world = universeWorld(EARTH, "first light", 80),
    ctx = populationContext(world);
  // (The land with the most villages: its oldest standing is its first.)
  const land = [...ctx.provinces.all()]
    .filter((p) => ctx.settlements.inProvince(p.cell).some((v) => v.population > 0))
    .sort(
      (a, b) =>
        ctx.settlements.inProvince(b.cell).length - ctx.settlements.inProvince(a.cell).length ||
        a.cell - b.cell,
    )[0]!;
  const s = storyOf(world, land.cell)!;
  assert.ok(s.village, "a land with villages has its first");
  const standing = ctx.settlements.inProvince(land.cell).filter((v) => v.population > 0);
  assert.equal(s.village.founded, Math.min(...standing.map((v) => v.founded)));
  assert.equal(s.sows, land.knowsCultivation);
  assert.equal(s.year, 80);
  if (s.town) assert.ok(standing.some((v) => v.ref === s.town!.ref && v.market));
  const realm = politiesOf(world).of(land.cell);
  assert.equal(s.realm?.ref ?? null, realm && realm.ended === null ? realm.ref : null);
  // A land no one lives in, or none: no village, no stand-in.
  const empty = [...ctx.provinces.all()].find((p) => !ctx.settlements.inProvince(p.cell).length);
  if (empty) assert.equal(storyOf(world, empty.cell)?.village ?? null, null);
  assert.equal(storyOf(world, -5), null);
});
