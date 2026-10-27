// Phase 57: a world's life in its own colours. What grows green turns to the pigment its star's light
// favours — gold, blue, near black, dark amber — and nothing else turns (bark, straw, soil, seas); a
// rocky world green with chlorophyll is drawn and told exactly as before; a world where nothing took
// hold is bare ground, without woods; blood is the colour of what carries its breath; a roof of turf
// or kelp is its life's colour, and the rest as they are; a people's shell is of its world's matter
// and their bare faces flushed with their blood.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import type { FolkFacts, FrameMessage } from "../../src/bridge/index.ts";
import {
  biomeColor,
  bloodTones,
  folkLook,
  frameLook,
  globeColors,
  houseLook,
  lensLegend,
  lifePalette,
  lifeTint,
  regionTrees,
  type FigureBody,
  type Rgb,
} from "../../src/view/index.ts";

/** Hue (0 … 1) of a colour. */
function hue([r, g, b]: Rgb): number {
  const hi = Math.max(r, g, b),
    d = hi - Math.min(r, g, b);
  if (!d) return 0;
  const h = hi === r ? ((g - b) / d + 6) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h / 6;
}

/** A world's globe frame, as the host sends it. */
function globeFrame(universe: typeof ALIEN, seed: string): FrameMessage {
  const world = universe.build(seedFromText(seed)),
    payload = universe.frames.globe!(world, { view: "globe", focus: null });
  return { kind: "frame", view: "globe", t: 0, ...payload } as unknown as FrameMessage;
}

const LEAF: Rgb = [0.24, 0.58, 0.2];

test("only green turns: a leaf to gold, blue, near black or amber; bark, straw, sea and Earth's as they are", () => {
  assert.deepEqual(lifeTint(LEAF), LEAF, "no look: Earth's");
  const gold = lifeTint(LEAF, "carotene"),
    blue = lifeTint(LEAF, "phycocyanin"),
    black = lifeTint(LEAF, "bacteriochlorophyll"),
    amber = lifeTint(LEAF, "polyimine");
  assert.ok(gold[0] > gold[1] && gold[1] > gold[2], `gold: ${gold}`);
  assert.ok(blue[2] > blue[0] && hue(blue) > 0.5 && hue(blue) < 0.62, `blue: ${blue}`);
  assert.ok(Math.max(...black) < 0.3, `near black: ${black}`);
  assert.ok(amber[0] > amber[2] && Math.max(...amber) < 0.45, `dark amber: ${amber}`);
  for (const other of [
    [0.42, 0.28, 0.16], // bark
    [0.8, 0.76, 0.38], // straw
    [0.05, 0.22, 0.6], // sea
    [0.62, 0.58, 0.55], // bare rock
  ] as Rgb[])
    for (const look of ["carotene", "phycocyanin", "bacteriochlorophyll", "polyimine"])
      assert.deepEqual(lifeTint(other, look), other, `${other} under ${look}`);
});

test("a world's palette: a rocky world green with chlorophyll is Earth's own; another life turns only its woods", () => {
  for (let b = 0; b < 16; b++) {
    assert.deepEqual(biomeColor(b, "rocky", undefined), biomeColor(b), `${b} as before`);
    assert.deepEqual(lifePalette("rocky")[b], biomeColor(b));
  }
  const gold = lifePalette("rocky", "carotene");
  for (const b of [5, 6, 9, 10, 13, 14])
    assert.notDeepEqual(gold[b], biomeColor(b), `${b} turned golden`);
  for (const b of [0, 1, 2, 3, 4, 7, 8, 11, 12, 15])
    assert.deepEqual(gold[b], biomeColor(b), `${b} as it was`);
  // A kind's seas and ice its own, whatever grows.
  assert.deepEqual(lifePalette("methane", "polyimine")[1], biomeColor(1, "methane"));
  // Bare ground where nothing took hold: its woods its deserts.
  const bare = lifePalette("rocky", "bare");
  assert.deepEqual(bare[9], biomeColor(7));
  assert.deepEqual(bare[14], biomeColor(11));
  assert.equal(lifePalette("rocky", "carotene"), gold, "made once");
});

test("the land legend in its life's own words, on every kind; Earth's as ever", () => {
  const words = (kind: string, look?: string) => {
    const l = lensLegend("terrain", kind, look);
    return l.kind === "keys" ? l.keys.map(([, w]) => w) : [];
  };
  assert.deepEqual(words("rocky"), ["woods", "grassland", "desert", "ice", "sea"]);
  assert.deepEqual(lensLegend("terrain", "rocky"), lensLegend("terrain"));
  assert.deepEqual(words("rocky", "carotene"), [
    "golden woods",
    "grassland",
    "desert",
    "ice",
    "sea",
  ]);
  assert.deepEqual(words("sulfur", "bacteriochlorophyll").slice(0, 1), ["black woods"]);
  assert.deepEqual(words("ammonia", "phycocyanin").slice(0, 1), ["blue woods"]);
  assert.deepEqual(words("methane", "polyimine"), [
    "amber woods",
    "grassland",
    "desert",
    "frozen methane",
    "methane sea",
  ]);
  assert.deepEqual(words("rocky", "bare"), ["bare ground", "desert", "ice", "sea"]);
  const legend = lensLegend("terrain", "rocky", "carotene");
  assert.ok(legend.kind === "keys");
  assert.deepEqual(legend.keys[0]![0], biomeColor(9, "rocky", "carotene"));
});

test("a globe frame carries its life's colours; Earth's none, and is drawn as before", () => {
  const earth = globeFrame(EARTH, "first light"),
    blue = globeFrame(ALIEN, "alien 16");
  assert.equal(frameLook(earth), undefined);
  assert.equal(frameLook(blue), "phycocyanin");
  // Drawn without its life's colours, its woods are Earth's green; with them, blue.
  const meta: Record<string, unknown> = { ...(blue.meta as Record<string, unknown>) };
  delete meta.lifeLook;
  const ours = globeColors(blue, "terrain"),
    green = globeColors({ ...blue, meta } as FrameMessage, "terrain"),
    biome = blue.arrays.biome!,
    elev = blue.arrays.elevation!,
    lake = blue.arrays.lake!,
    river = blue.arrays.river!;
  let woods = -1;
  for (let c = 0; c < biome.length && woods < 0; c++)
    if (elev[c]! > 0 && elev[c]! < 1500 && !lake[c] && !river[c] && [9, 10, 14].includes(biome[c]!))
      woods = c;
  assert.ok(woods >= 0, "a wooded spot");
  const at = (rgba: Uint8Array): Rgb => [
    rgba[woods * 4]!,
    rgba[woods * 4 + 1]!,
    rgba[woods * 4 + 2]!,
  ];
  assert.ok(at(green)[1] > at(green)[2], `Earth's green there: ${at(green)}`);
  assert.ok(at(ours)[2] > at(ours)[0], `blue there: ${at(ours)}`);
});

test("no woods on a land where nothing took hold; blood the colour of what carries its breath", () => {
  const frame = {
    kind: "frame",
    view: "region",
    t: 0,
    meta: { ref: "region:0", lifeLook: "bare" },
    arrays: { biome: new Uint8Array(64).fill(14), water: new Uint8Array(64) },
  } as unknown as FrameMessage;
  assert.deepEqual(regionTrees(frame), []);
  assert.ok(regionTrees({ ...frame, meta: { ref: "region:0" } } as FrameMessage).length > 0);
  assert.deepEqual(bloodTones(), bloodTones("iron"));
  const blue = bloodTones("copper").pool,
    green = bloodTones("vanadium").pool,
    red = bloodTones().pool;
  assert.ok(blue[2] > blue[0], "copper's blue");
  assert.ok(green[1] > green[0] && green[1] > green[2], "vanadium's green");
  assert.ok(red[0] > red[2], "iron's red");
});

test("a roof grown of its life — turf, kelp — in its life's colours; thatch, tile and Earth's as they are", () => {
  const house = (roof: string) => ({
    walls: "wattle",
    roof,
    form: "round",
    pitch: 40,
    design: null,
  });
  for (const roof of ["turf", "kelp-canopy"]) {
    assert.deepEqual(houseLook(house(roof), undefined).roof, houseLook(house(roof)).roof);
    const black = houseLook(house(roof), "bacteriochlorophyll").roof;
    assert.notDeepEqual(black, houseLook(house(roof)).roof, roof);
    assert.ok(Math.max(...black) < 0.4, `${roof} near black: ${black.join(", ")}`);
  }
  for (const roof of ["thatch", "tile", "flat", "vault"])
    assert.deepEqual(houseLook(house(roof), "phycocyanin").roof, houseLook(house(roof)).roof, roof);
});

test("a people's look reads what their life is made of: a shell of iron sulfide, opal or ice; a face flushed with their blood", () => {
  const facts = (over: Partial<FolkFacts> = {}): FolkFacts => ({
      key: 1234567,
      gravity: 1,
      star: 5600,
      warmth: 14,
      rain: 900,
      biome: 9,
      forebears: null,
      ...over,
    }),
    body = (skin: string, over: Partial<FolkFacts> = {}): FigureBody => ({
      clade: skin === "shell" ? "burrower" : skin === "fur" ? "shaggy" : "ape",
      medium: "land",
      symmetry: "bilateral",
      manipulators: skin === "shell" ? "mandibles" : "hands",
      limbs: 2,
      skin,
      size: 60,
      folk: facts(over),
    }),
    light = (c: readonly number[]) => 0.3 * c[0]! + 0.59 * c[1]! + 0.11 * c[2]!;
  const lime = folkLook(body("shell"))!,
    black = folkLook(body("shell", { shell: "greigite" }))!,
    glass = folkLook(body("shell", { shell: "opal" }))!,
    ice = folkLook(body("shell", { shell: "ice" }))!;
  assert.ok(light(black.hide) < 0.22, `iron sulfide: black (${black.hide.join(", ")})`);
  assert.ok(light(glass.hide) > 0.55, `opal: pale as glass (${glass.hide.join(", ")})`);
  assert.ok(light(ice.hide) > 0.6 && ice.hide[2] > ice.hide[0], `ice: white, faintly blue`);
  assert.notDeepEqual(black.hide, lime.hide);
  // Only a shell shows its matter; the rest of the look is the same people's.
  assert.deepEqual(folkLook(body("skin", { shell: "greigite" })), folkLook(body("skin")));
  assert.equal(black.stance, lime.stance);
  assert.equal(black.eyes, lime.eyes);
  // Blood that is not red flushes bare skin's face and underside, and nothing else; fur hides it.
  const red = folkLook(body("skin"))!,
    blue = folkLook(body("skin", { blood: "copper" }))!,
    green = folkLook(body("skin", { blood: "vanadium" }))!;
  assert.deepEqual(blue.hide, red.hide);
  assert.ok(blue.under[2] - blue.under[0] > red.under[2] - red.under[0], "a bluer face");
  assert.ok(green.under[1] - green.under[2] > red.under[1] - red.under[2], "a greener face");
  assert.deepEqual(folkLook(body("fur", { blood: "copper" })), folkLook(body("fur")));
});
