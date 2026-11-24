// The planet's last gaps (2026-11-24): rings and worlds without a star, a locked world's two sides, air lost to the star's
// wind, the shield against its hard light, sea ice and the seas' salt, and the haze of what is burned.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISABLED,
  HUMANLIKE,
  HAZE,
  LOCKED,
  RING,
  airKept,
  airLoss,
  brineOf,
  disabledOf,
  grownMortality,
  growthUnderHard,
  hardAtGround,
  hardLight,
  hazeFields,
  hazeMasks,
  livingPace,
  ozoneColumn,
  ozoneStripped,
  lockedRising,
  lockedWarmth,
  maimedLiving,
  ringOf,
  rocheLimit,
  roguesAStar,
  seaFreezes,
  seaIceWarming,
  seaSalt,
  overturnOf,
  tideLocked,
} from "../../src/rules/index.ts";

test("a ring is a moon inside its planet's Roche limit", () => {
  // Saturn (95 Earths, 9.14 radii): ice is torn within some 2.2 radii (its rings end at 2.3), rock only within 1.6.
  const ice = rocheLimit(95, 9.14, RING.ice),
    rock = rocheLimit(95, 9.14, RING.rock);
  assert.ok(ice > 2 && ice < 2.4 && rock < 1.8);
  // Earth would tear a rock moon within some three radii.
  assert.ok(Math.abs(rocheLimit(1, 1, RING.rock) - 2.96) < 0.1);
  const saturn = { mass: 95, radius: 9.14, icy: true };
  assert.equal(ringOf(saturn, [0.99, 0]), null);
  assert.equal(ringOf(saturn, [0, 0.9]), null);
  const ring = ringOf(saturn, [0, 0.1])!;
  assert.ok(ring.ice && ring.at < ring.roche && ring.inner < ring.outer);
  // A small rocky world seldom draws a moon in; a heavier, metal-rich star throws out more worlds.
  assert.equal(ringOf({ mass: 0.1, radius: 0.5, icy: false }, [0.02, 0]), null);
  assert.ok(roguesAStar(1, 0.3) > roguesAStar(1) && roguesAStar(1) > roguesAStar(0.3));
});

test("a world locked to its star has a day side and a night side", () => {
  // Earth turns; a world in the mild zone of a star of two fifths the Sun's mass is held.
  assert.equal(tideLocked(1, 1), false);
  assert.equal(tideLocked(0.4, 0.2), true);
  // Warmest under the star, the same cold across the whole dark side; the globe's mean is kept.
  assert.ok(lockedWarmth(1, 1) > 30 && lockedWarmth(0, 1) < -10);
  assert.equal(lockedWarmth(-1, 1), lockedWarmth(0, 1));
  let mean = 0;
  for (let i = 0; i < 2000; i++) mean += lockedWarmth(-1 + (i + 0.5) / 1000, 1) / 2000;
  assert.ok(Math.abs(mean) < 0.01);
  // Thick air carries more of the warmth round; the rain falls under the star.
  assert.ok(lockedWarmth(1, 4) < lockedWarmth(1, 1) && LOCKED.contrast === 50);
  assert.ok(lockedRising(1) === 1 && lockedRising(-0.5) === 0);
});

test("a world's air is lost to its star's wind where no field holds it off", () => {
  const earth = { wind: 1, shelter: 0.989, mass: 1, radius: 1, pressure: 1 },
    mars = { wind: 0.43, shelter: 0, mass: 0.107, radius: 0.532, pressure: 1 };
  // Earth behind its field keeps its air: what it loses in its whole age is under a hundredth, and is not reckoned.
  assert.equal(airKept(airLoss(earth), 4.6), 1);
  // A world of Mars's size and place with no field is left some three quarters; nearer a windier star, far less.
  const left = airKept(airLoss(mars), 4.6);
  assert.ok(left > 0.6 && left < 0.9, `${left}`);
  // Its fire below breathes some back: it thins toward a balance, lower where no plates turn, never to nothing.
  const windy = airLoss({ ...mars, wind: 16 });
  assert.ok(airKept(windy, 4.6) < 0.2 && airKept(windy, 4.6) > 0.02);
  assert.ok(airKept(windy, 4.6, 0.3) < airKept(windy, 4.6));
  // A heavier world, or one under a deeper air, loses a smaller share.
  assert.ok(airLoss({ ...mars, mass: 1, radius: 1 }) < airLoss(mars));
  assert.ok(airLoss({ ...mars, pressure: 90 }) < airLoss(mars) / 50);
});

test("ozone from an air's oxygen shields the ground from its star's hard light", () => {
  // Earth's is 1; a tenth of the oxygen still makes half the shield; no oxygen, none.
  assert.equal(ozoneColumn(0.2095), 1);
  assert.ok(ozoneColumn(0.02095) > 0.45 && ozoneColumn(0.02095) < 0.55);
  assert.equal(ozoneColumn(0), 0);
  // A cool red star gives little hard light, a hotter one more.
  assert.equal(hardLight(5778), 1);
  assert.ok(hardLight(3500) < 0.05 && hardLight(7000) > 1.5);
  // Earth's ground gets 1; with no ozone some thirty times that, unless a haze stops it; open growth gives less.
  assert.equal(hardAtGround(1, 1, false), 1);
  const bare = hardAtGround(1, 0, false);
  assert.ok(bare > 25 && bare < 40 && hardAtGround(1, 0, true) === 1);
  assert.equal(growthUnderHard(0.2), 1);
  assert.ok(growthUnderHard(bare) > 0.55 && growthUnderHard(bare) < 0.7);
  // A supernova 26 light-years off (a fifth more deaths) strips half; the fields under it lose about a tenth.
  assert.ok(Math.abs(ozoneStripped(1.21) - 0.5) < 0.01 && ozoneStripped(1) === 0);
  const under = growthUnderHard(hardAtGround(1, 0.5, false));
  assert.ok(under > 0.88 && under < 0.94);
});

test("sea ice follows the seas' warmth and salt, and feeds the light kept and the overturning", () => {
  // Earth's seas: thirty-five parts in a thousand, freezing near two below; a world of more land and less sea is salter.
  assert.ok(Math.abs(seaSalt(0.29, 0.71) - 35) < 1e-9);
  assert.ok(Math.abs(seaFreezes(35) + 1.89) < 0.01);
  assert.ok(seaSalt(0.6, 0.4) > 100 && seaSalt(0.05, 0.95) < 10);
  // All of Earth's sea ice gone (some 4% of its face) warms it about a degree; ice come cools.
  const all = seaIceWarming(0.04, 1);
  assert.ok(all > 0.6 && all < 1.6, `${all}`);
  assert.equal(seaIceWarming(-0.04, 1), -all);
  // Without its ice's brine the overturning is a fifth weaker; a salter sea is harder to freshen.
  assert.equal(brineOf(1), 1);
  assert.ok(Math.abs(brineOf(0) - 0.8) < 1e-9);
  assert.ok(Math.abs(overturnOf(0, 0, 1, brineOf(0)) - 0.8) < 1e-9);
  assert.ok(overturnOf(0.25, 0, 2) > overturnOf(0.25, 0) && overturnOf(0.25, 0) === 0.5);
});

test("the haze of what is burned dims and cools, hiding part of the warming", () => {
  // Earth's burning at its haze's thickest hid half a degree and dimmed its fields' light by a twenty-fifth.
  assert.equal(hazeMasks(0), 0);
  assert.ok(Math.abs(hazeMasks(HAZE.earthBurn) - HAZE.earthMask) < 1e-9);
  assert.ok(Math.abs(hazeFields(HAZE.earthMask) - 0.98) < 1e-9);
  // Twice the smoke hides less than twice as much; gas makes a twentieth of coal's haze for its carbon.
  assert.ok(hazeMasks(2 * HAZE.earthBurn) < 2 * HAZE.earthMask);
  assert.ok(HAZE.gas < HAZE.oil && HAZE.oil < HAZE.coal);
  assert.equal(hazeFields(0), 1);
});

test("the maimed and the sick leave a land's workers, more of them living where they are kept", () => {
  const land = {
      hazard: 0.01,
      endemic: 0,
      smoke: 0,
      maimed: 0,
      years: 22,
      spared: 0,
      neglected: 0,
    },
    quiet = disabledOf(land);
  // A quiet land of upright apes: some three in a hundred of its grown, all hurt at their work, all kept.
  assert.ok(quiet.share > 0.02 && quiet.share < 0.045 && quiet.share === quiet.mishap);
  assert.equal(quiet.kept, 1);
  // A war's maimed, a settled sickness and foul air each add their own.
  const hard = disabledOf({ ...land, endemic: 0.02, smoke: 1, maimed: 0.03 });
  assert.ok(hard.war === 0.03 && hard.sick > 0.03 && hard.smoke > 0.03);
  assert.ok(Math.abs(hard.share - (hard.mishap + hard.sick + hard.smoke + hard.war)) < 1e-12);
  // Where no one keeps them they die the sooner, so fewer are living; care that heals leaves fewer unable.
  const unkept = disabledOf({ ...land, neglected: 1 });
  assert.ok(
    Math.abs(unkept.share / quiet.share - 1 / (1 + DISABLED.neglect)) < 1e-9 && unkept.kept === 0,
  );
  assert.ok(disabledOf({ ...land, spared: 0.3 }).share < quiet.share);
  // Never more than a quarter; a war's maimed die off over the years a grown one has left.
  assert.equal(disabledOf({ ...land, maimed: 0.9 }).share, DISABLED.most);
  assert.equal(maimedLiving(0, 22), 1);
  assert.equal(maimedLiving(11, 22), 0.5);
  assert.equal(maimedLiving(30, 22), 0);
});

test("how the grown die follows the body's size and its pace of living", () => {
  // The apes' own pace is 1; a small warm body lives faster, a cold-blooded one at half its size's pace.
  assert.equal(livingPace(60, true), 1);
  assert.ok(livingPace(4, true) > 1.9 && livingPace(60, false) === 0.5);
  // Reckoned for the apes' own body, the curve is near their table: within a third at every grown band.
  const ape = grownMortality({ size: 60, warm: true, span: 70 }, HUMANLIKE.bands, 15);
  HUMANLIKE.bands.forEach((at, b) => {
    if (at < 15) assert.equal(ape[b], 0);
    else if (b < HUMANLIKE.bands.length - 1)
      assert.ok(Math.abs(ape[b]! / HUMANLIKE.mortality[b]! - 1) < 0.4, `${at}: ${ape[b]}`);
  });
  // A small warm body of the same span dies mostly of hazard, at every age nearly alike; a great cold one late and together.
  const small = grownMortality({ size: 2, warm: true, span: 70 }, HUMANLIKE.bands, 15),
    great = grownMortality({ size: 900, warm: false, span: 70 }, HUMANLIKE.bands, 15),
    steep = (m: number[]) => m[8]! / m[3]!;
  assert.ok(small[3]! > 2 * great[3]!);
  assert.ok(steep(great) > 2 * steep(small), `${steep(great)} ${steep(small)}`);
  // As many reach their span either way: the deaths from grown to the span sum alike.
  const sum = (m: number[]) =>
    m.reduce((s, x, b) => s + (b >= 3 && b < 9 ? x * (b === 3 ? 5 : 10) : 0), 0);
  assert.ok(Math.abs(sum(small) - sum(great)) < 1e-9);
});
