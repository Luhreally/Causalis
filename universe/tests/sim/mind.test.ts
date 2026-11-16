// A people's mind, round "peoples": ways from body and land and what fared well, who reads and how it finds, what a faith holds.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BODY_PARTS,
  INQUIRY,
  WAY,
  bodyReading,
  creedHeld,
  creedOf,
  inquiryOf,
  inquiryShare,
  leansOf,
  readersAfter,
  readersTarget,
  type BodyPlan,
} from "../../src/rules/index.ts";
import {
  beliefOf,
  bodyWays,
  cultureOf,
  heldCreed,
  loreOf,
  populationContext,
  readersOf,
  teachingOf,
} from "../../src/sim/index.ts";
import { peopledWorld } from "../worlds.ts";

const APE = {
  clade: "ape",
  name: "upright apes",
  medium: "land",
  symmetry: "bilateral",
  size: 60,
  manipulators: "hands",
  limbs: 2,
  senses: ["sight", "hearing"],
  skin: "skin",
  warm: true,
  diet: "both",
  bearing: "live",
  young: 1,
  span: 70,
  social: 0.8,
} as unknown as BodyPlan;

test("a people's first ways come of its body: a short-lived spawning swimmer of the sea is not an ape", () => {
  const swimmer = {
    ...APE,
    medium: "water",
    size: 40,
    span: 39,
    young: 37,
    social: 0.59,
    bearing: "spawn",
    diet: "flesh",
    warm: false,
  } as unknown as BodyPlan;
  const ape = bodyWays(APE),
    fish = bodyWays(swimmer);
  // (Many young and a short life lean to daring, against thrift; a hunter of flesh to valour; spawn cared for less than borne.)
  assert.ok(
    fish[WAY.valour]! > ape[WAY.valour]! + 0.1,
    `valour ${ape[WAY.valour]} → ${fish[WAY.valour]}`,
  );
  assert.ok(
    fish[WAY.thrift]! < ape[WAY.thrift]!,
    `thrift ${ape[WAY.thrift]} → ${fish[WAY.thrift]}`,
  );
  assert.ok(
    fish[WAY.kinship]! < ape[WAY.kinship]!,
    `kinship ${ape[WAY.kinship]} → ${fish[WAY.kinship]}`,
  );
  // (A hive keeps to rank and kin more than a loose band does.)
  const hive = bodyWays({ ...APE, social: 0.95 } as BodyPlan),
    band = bodyWays({ ...APE, social: 0.4 } as BodyPlan);
  assert.ok(hive[WAY.hierarchy]! > band[WAY.hierarchy]! + 0.05);
  assert.ok(hive[WAY.kinship]! > band[WAY.kinship]!);
  // (Every lean is the body's parts, read the same for any body.)
  assert.deepEqual(ape, leansOf(BODY_PARTS, bodyReading(APE)));
});

test("who reads: none without a script, most where a school stands, a generation to come most of the way", () => {
  const at = { script: true, scribes: 0.02, spare: 0.3, school: false, word: 0.5, scripture: 0 };
  assert.equal(readersTarget({ ...at, script: false }), 0);
  const none = readersTarget(at),
    schooled = readersTarget({ ...at, school: true }),
    free = readersTarget({ ...at, school: true, word: 1 }),
    written = readersTarget({ ...at, scripture: 1 });
  assert.ok(schooled > none * 3, `${none} → ${schooled}`);
  assert.ok(free > schooled);
  assert.ok(written > none);
  const after = readersAfter(0, 0.5, 25, 70);
  assert.ok(after > 0.35 && after < 0.5, `a generation: ${after}`);
  // (A people that lives half as long comes there twice as fast.)
  assert.ok(readersAfter(0, 0.5, 10, 35) > readersAfter(0, 0.5, 10, 70));
});

test("inquiry: the deeper a thing lies the more of it readers find, and the more readers and measures the readier", () => {
  assert.equal(inquiryShare(1), 0);
  assert.ok(inquiryShare(8) > 0.3 && inquiryShare(8) < inquiryShare(20));
  assert.equal(inquiryShare(40), INQUIRY.most);
  assert.ok(inquiryOf(1e6, 0, 0.5, 0.5) > inquiryOf(1e4, 0, 0.5, 0.5));
  assert.ok(inquiryOf(1e5, 1, 0.5, 0.5) > inquiryOf(1e5, 0, 0.5, 0.5));
  // (A people that keeps to custom asks less than one open to the new.)
  assert.ok(inquiryOf(1e5, 0, 0.8, 0.2) > inquiryOf(1e5, 0, 0.2, 0.8));
});

test("on first light, those who read are where a script is, and a faith's creed draws the lands that hold it", () => {
  const world = peopledWorld("first light", 300, { start: "spread" }),
    ctx = populationContext(world),
    lore = loreOf(world);
  let reading = 0,
    writing = 0;
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    const r = readersOf(world, p.cell),
      script = lore.effect(p.cell, "writing") > 0;
    if (script) writing++;
    if (r > 0) {
      reading++;
      // (A land that lost its script keeps its readers only as they die: none reads where none ever wrote.)
      assert.ok(script || lore.get(p.cell, "writing") || r < 0.5, `land ${p.cell} reads ${r}`);
    }
    const t = teachingOf(ctx, p);
    assert.ok(t.target >= 0 && t.target <= 1);
  }
  assert.ok(writing > 10, `${writing} lands write`);
  assert.ok(reading > writing / 2, `${reading} of ${writing} read`);
  // Every faith has its creed, and its lands are drawn by it.
  const store = beliefOf(world);
  assert.ok(store.all().length > 0);
  for (const f of store.all()) assert.equal(f.creed?.length, 8, f.name);
  let drawn = 0;
  for (const w of cultureOf(world).all()) {
    const held = heldCreed(world, w.cell, 300);
    if (held && held.some((v) => Math.abs(v) > 0.005)) drawn++;
  }
  assert.ok(drawn > 10, `${drawn} lands drawn by their faith`);
});

test("a faith's creed is what it holds the power to be and what marked its founders", () => {
  const fear = creedOf("sickness", null),
    thanks = creedOf("plenty", null),
    learning = creedOf("teaching", null);
  assert.ok(
    fear[WAY.tradition]! > 0 && fear[WAY.openness]! < 0,
    "a power that harms is warded off",
  );
  assert.ok(thanks[WAY.thrift]! < 0, "a power that gives is thanked at feasts");
  assert.ok(learning[WAY.tradition]! < 0, "a power that knows is learned from");
  // (A warlike founding people's faith hallows valour.)
  const warlike = creedOf("presence", [0.5, 0.5, 0.5, 0.95, 0.5, 0.5, 0.5, 0.5]);
  assert.ok(warlike[WAY.valour]! > creedOf("presence", null)[WAY.valour]! + 5);
  assert.ok(creedHeld(25, 70) > 0.45 && creedHeld(25, 70) < 0.55);
});
