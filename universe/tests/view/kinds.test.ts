// Phase 56: a world's kind in its colours and its fires. A methane world's globe is drawn in its own
// colours — its seas dark amber, not blue — and its warmth's legend in true degrees; a rocky world's
// frame is drawn exactly as before. Where nothing burns no feast fire is lit and no charcoal burned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { keptRocky } from "../../src/rules/index.ts";
import type { Feast, FrameMessage, VillagePlan } from "../../src/bridge/index.ts";
import { biomeColor, feastAt, globeColors, kindWater, lensLegend } from "../../src/view/index.ts";
import { burnsCharcoal } from "../../src/view/errands.ts";

/** A world's globe frame, as the host sends it. */
function globeFrame(seed: string): FrameMessage {
  const world = ALIEN.build(seedFromText(seed)),
    payload = ALIEN.frames.globe!(world, { view: "globe", focus: null });
  return { kind: "frame", view: "globe", t: 0, ...payload } as unknown as FrameMessage;
}

const methane = globeFrame("alien 1429"),
  twin = globeFrame(keptRocky("alien 1429"));

test("the globe's frame says its world's kind", () => {
  assert.equal((methane.meta as { kind?: string }).kind, "methane");
  assert.equal((twin.meta as { kind?: string }).kind, "rocky");
});

test("a methane world's seas are dark amber where its twin's are blue; a rocky frame as before", () => {
  const ours = globeColors(methane, "terrain"),
    theirs = globeColors(twin, "terrain"),
    elev = methane.arrays.elevation!;
  let deep = -1;
  for (let c = 0; c < elev.length && deep < 0; c++) if (elev[c]! < -3000) deep = c;
  assert.ok(deep >= 0, "a deep sea");
  const [r, , b] = [ours[deep * 4]!, ours[deep * 4 + 1]!, ours[deep * 4 + 2]!];
  assert.ok(r > b, `amber, not blue: ${r},${b}`);
  assert.ok(theirs[deep * 4 + 2]! > theirs[deep * 4]!, "its twin's sea is blue");
  // A rocky world's frame is drawn as it was before it said its kind.
  const meta: Record<string, unknown> = { ...(twin.meta as Record<string, unknown>) };
  delete meta.kind;
  assert.deepEqual(theirs, globeColors({ ...twin, meta } as FrameMessage, "terrain"));
});

test("a biome's colour and a land's waters are its kind's; a rocky world's its own", () => {
  for (let b = 0; b < 16; b++) assert.deepEqual(biomeColor(b), biomeColor(b, "rocky"));
  assert.notDeepEqual(biomeColor(2, "methane"), biomeColor(2));
  assert.equal(kindWater("rocky"), null);
  assert.equal(kindWater(undefined), null);
  const sea = kindWater("methane")!.sea;
  assert.ok(sea[0] > sea[2], "a methane sea is amber");
});

test("the lenses' legends: warmth in true degrees, the land in its kind's colours", () => {
  const ends = (kind?: string) => {
    const l = lensLegend("temperature", kind);
    return l.kind === "ramp" ? [l.low, l.high] : [];
  };
  assert.deepEqual(ends(), ["-40 °C", "30 °C"]);
  assert.deepEqual(ends("methane"), ["-197 °C", "-173 °C"]);
  assert.deepEqual(ends("ammonia"), ["-147 °C", "-60 °C"]);
  assert.deepEqual(ends("carbon"), ends());
  assert.deepEqual(ends("sulfur"), ends());
  // The land's: its own colours, its sea and ice named for its liquid; a rocky world's as it was.
  assert.deepEqual(lensLegend("terrain", "rocky"), lensLegend("terrain"));
  const land = lensLegend("terrain", "methane");
  assert.ok(land.kind === "keys");
  assert.deepEqual(
    land.keys.map(([, words]) => words),
    ["woods", "grassland", "desert", "frozen methane", "methane sea"],
  );
  assert.deepEqual(land.keys[4]![0], biomeColor(1, "methane"));
});

test("where nothing burns, no feast fire is lit and no charcoal is burned", () => {
  const feast: Feast = { day: 2, occasion: "harvest", words: "the harvest home", ref: null },
    plan = { town: undefined, life: { feasts: [feast] } } as unknown as Pick<
      VillagePlan,
      "life" | "town" | "fireless"
    >,
    dusk = 2 * 86_400 + 19 * 3_600;
  assert.equal(feastAt(plan, dusk)!.lit, true);
  const cold = feastAt({ ...plan, fireless: true }, dusk)!;
  assert.equal(cold.lit, false);
  assert.equal(cold.dressed, true, "the square is dressed all the same");
  const smiths = {
    metal: "copper",
    people: [{ trade: { kind: "smith" } }],
  } as unknown as VillagePlan;
  assert.equal(burnsCharcoal(smiths), true);
  assert.equal(burnsCharcoal({ ...smiths, fireless: true }), false);
});
