import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText, type World } from "../../src/kernel/index.ts";
import {
  STAGE_WORDS,
  contactBetween,
  folkArms,
  folkByRef,
  folkStage,
  folksNear,
  partyOf,
  type Folk,
  type FolkStage,
} from "../../src/sim/index.ts";

const worldOf = (text: string) =>
  ({ seed: seedFromText(text), hasStore: () => false }) as unknown as World;
const SEEDS = ["harrow 348", "alien 41", "cinder 570", "first light"];

test("a people is a pure reading of its world: the same twice, and found again by its ref", () => {
  const w = worldOf("alien 41"),
    a = folksNear(w),
    b = folksNear(worldOf("alien 41"));
  assert.ok(a.length > 3);
  assert.deepEqual(
    a.map((f) => [f.ref, f.arose, f.pace, f.ceiling, f.fell]),
    b.map((f) => [f.ref, f.arose, f.pace, f.ceiling, f.fell]),
  );
  for (const f of a) assert.equal(folkByRef(w, f.ref)?.ref, f.ref);
});

test("across worlds some stay in camps, some rise, some are gone, and the followed go furthest", () => {
  const seen = new Set<FolkStage>();
  for (const s of SEEDS) for (const f of folksNear(worldOf(s))) seen.add(folkStage(f, 3000));
  assert.ok(seen.has("camps"), "no camps");
  assert.ok(seen.has("ruins"), "no ruins");
  assert.ok(seen.has("stars"), "none among the stars");
  assert.ok(seen.has("villages") || seen.has("towns") || seen.has("cities"), "none between");
  for (const stage of seen) assert.ok(STAGE_WORDS[stage]);
});

test("a people history does not follow never comes to signals, and never climbs past its numbers", () => {
  const LADDER: readonly FolkStage[] = ["camps", "villages", "towns", "cities", "works"];
  for (const s of SEEDS)
    for (const f of folksNear(worldOf(s))) {
      if (f.followed) continue;
      for (const year of [0, 800, 1600, 2400, 3200, 6400, 12_800]) {
        const stage = folkStage(f, year);
        assert.ok(stage === "ruins" || LADDER.indexOf(stage) <= LADDER.indexOf(f.ceiling));
        assert.ok(!["signals", "orbit", "stars"].includes(stage));
      }
      if (f.ceiling === "camps") assert.equal(f.fell, null, "a camp leaves no ruins");
    }
});

test("what a people carries comes from what its ground gives", () => {
  let told = 0;
  for (const f of folksNear(worldOf("alien 41"))) {
    if (folkStage(f, 3000) === "ruins") {
      assert.deepEqual(folkArms(f, "ruins"), []);
      continue;
    }
    const arms = folkArms(f, "camps");
    assert.ok(arms.length > 0);
    if (arms[0]!.startsWith("a spear")) {
      assert.ok(arms[0]!.includes(f.stone.name));
      told++;
    }
  }
  assert.ok(told > 0);
});

test("a meeting's reading is the same whichever people is named first", () => {
  const all: Folk[] = SEEDS.flatMap((s) => [...folksNear(worldOf(s))]);
  let pairs = 0;
  for (let i = 0; i + 1 < all.length; i += 2) {
    const a = partyOf(all[i]!),
      b = partyOf(all[i + 1]!),
      ab = contactBetween(a, b),
      ba = contactBetween(b, a);
    assert.equal(ab.speak.can, ba.speak.can);
    assert.equal(ab.airThere.can, ba.airHome.can);
    assert.equal(ab.airHome.can, ba.airThere.can);
    assert.equal(ab.foodThere.can, ba.foodHome.can);
    assert.equal(ab.foodHome.can, ba.foodThere.can);
    assert.equal(ab.sickness.can, ba.sickness.can);
    assert.equal(ab.sickness.can, a.life.family === b.life.family);
    pairs++;
  }
  assert.ok(pairs > 10);
});
