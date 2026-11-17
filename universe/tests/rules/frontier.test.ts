// The Frontier lane's rules as physics has them: a star's flares by its kind and age, the great stones by the Moon's
// record and their energy, the galaxy's fire by home's place in it, the dark's toll aboard, and what a people makes of
// its sky and of itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BEYOND,
  HABITAT,
  ROGUE,
  UPLIFT,
  remadeGround,
  roguePass,
  roguePassRate,
  skyRoom,
  skyYear,
  upliftScore,
  upliftWays,
  CROSSING,
  GALACTIC,
  IMPACT,
  IMPACTS,
  STAR_WEATHER,
  activeGyr,
  armPhase,
  burstDistance,
  darkToll,
  fieldsUnderBurst,
  flareRate,
  freeingChance,
  gammaRate,
  goingUpOf,
  greatestFlare,
  gridLost,
  hallsUnder,
  heldOf,
  leadYears,
  lorentz,
  meanStorms,
  mindsPast,
  mostWorksT,
  showerChance,
  stormHarm,
  strikeChance,
  strikeDead,
  strikeDust,
  strikeMt,
  strikeRate,
  strikeReachKm,
  supernovaRate,
  turningTonnes,
  usualStorm,
  worksMachines,
  worksNextYear,
  wouldGoUp,
  writableShare,
  writtenAfter,
  yearsAboard,
  yearsToPass,
  youngRate,
  youngStarsAt,
  type GalaxyShape,
} from "../../src/rules/index.ts";

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// —— A star's weather ——————————————————————————————————————————————————————————————————————————————

test("the Sun at its age flares a Carrington once in some 150 years; young it flares hundreds of times as often", () => {
  const now = flareRate(1, 4.6);
  assert.ok(near(now, 1 / 150, 1e-4), `${now}`);
  assert.ok(flareRate(1, 0.2) > 100 * now);
  assert.ok(flareRate(1, 9) < now);
});

test("a small red star stays young in its flaring for billions of years; a heavy star hardly flares", () => {
  assert.ok(activeGyr(0.15) > 7 && activeGyr(1) < 0.5);
  assert.equal(flareRate(0.15, 5), STAR_WEATHER.saturated);
  assert.ok(flareRate(0.15, 5) > 100 * flareRate(1, 5));
  assert.ok(flareRate(2, 0.5) < 0.1 * flareRate(1, 0.5));
});

test("the greatest flare of a span grows with the span and never passes the most a star gives", () => {
  const year = greatestFlare(0.5, 1 / 150, 1),
    millennium = greatestFlare(0.5, 1 / 150, 1000);
  assert.ok(millennium > 100 * year);
  assert.ok(greatestFlare(1e-9, 2, 1e6) <= STAR_WEATHER.most);
  assert.equal(greatestFlare(0.5, 1, 0), 0);
});

test("a world close about a red dwarf knows storms hundreds of times an Earth's every year", () => {
  const earth = usualStorm(flareRate(1, 4.6), 1),
    close = usualStorm(flareRate(0.15, 5), 0.05);
  assert.ok(close > 1000 * earth, `${close} ${earth}`);
  assert.ok(meanStorms(1, 0.05) > meanStorms(1, 1) * 399);
});

test("a storm burns grids from its first harm, more near the poles, less warned and less rebuilt; none under it", () => {
  assert.equal(gridLost(0.4, 1, true, false, false), 0);
  const mid = gridLost(5, 0.7, true, false, false),
    pole = gridLost(5, 1, true, false, false);
  assert.ok(pole > mid && mid > 0);
  assert.ok(gridLost(5, 1, true, true, false) < pole);
  assert.ok(gridLost(5, 1, true, true, true) < gridLost(5, 1, true, true, false));
  assert.ok(gridLost(5, 1, false, false, false) < pole);
  assert.ok(gridLost(1e6, 1, true, false, false) <= 0.8);
  // (A grid about a stormy star is built for its sky: the same storm burns less of it.)
  assert.ok(gridLost(50, 1, true, false, false, 1) < gridLost(50, 1, true, false, false, 0));
  assert.equal(gridLost(50, 1, true, false, false, 10), 0);
});

test("a people's usual sky harms nothing; a storm far past it raises their deaths, to a bound", () => {
  assert.equal(stormHarm(2, 1), 1);
  assert.ok(stormHarm(50, 1) > 1);
  assert.ok(stormHarm(1e9, 1) <= 1 + STAR_WEATHER.harmMost);
  assert.equal(hallsUnder(0, false), 1);
  assert.ok(hallsUnder(1e4, true) < hallsUnder(1e4, false));
  assert.ok(hallsUnder(1e9, false) <= 1 + STAR_WEATHER.hallsMost);
});

// —— The great stones ——————————————————————————————————————————————————————————————————————————————

test("the Moon's record: an Earth's age 1, a young system struck far oftener, an old one no less than 1", () => {
  assert.ok(near(youngRate(IMPACT.earthGyr), 1, 1e-9));
  assert.ok(youngRate(1) > 10 && youngRate(0.5) > youngRate(1));
  assert.ok(near(youngRate(10), 1, 0.01));
  assert.ok(youngRate(0) <= IMPACT.youngMost);
});

test("a shower is a likelier thing where the stars about home are thick", () => {
  const sun = showerChance(0.004);
  assert.ok(sun > 0.05 && sun < 0.5, `${sun}`);
  assert.ok(showerChance(0.04) > sun);
  assert.ok(strikeRate(4.5, true, true) > strikeRate(4.5, true, false));
  assert.ok(strikeRate(4.5, false, false) < strikeRate(4.5, true, false));
});

test("a km stone strikes with some 65,000 megatons, brings down some 120 km about, and darkens the sky", () => {
  const mt = strikeMt(1000, false, 11.2);
  assert.ok(mt > 50_000 && mt < 80_000, `${mt}`);
  const reach = strikeReachKm(mt);
  assert.ok(reach > 100 && reach < 140, `${reach}`);
  assert.ok(strikeDust(mt) > 0.05 && strikeDust(strikeMt(300, false, 11.2)) < 0.01);
  assert.ok(strikeMt(1000, true, 11.2) > mt * 0.5);
  assert.ok(strikeDead(0, reach, false) > strikeDead(reach / 2, reach, false));
  assert.equal(strikeDead(reach, reach, false), 0);
  assert.ok(strikeDead(reach * 3, reach, true) > 0);
});

test("the great stones are rare: a km stone in an Earth's six thousand years, some one in a hundred", () => {
  const great = IMPACTS.find((c) => c.id === "great")!,
    p = strikeChance(great, 1, 6000);
  assert.ok(p > 0.005 && p < 0.02, `${p}`);
  assert.ok(strikeChance(great, 20, 6000) > 10 * p * 0.9);
});

test("a watched sky finds a km stone decades ahead and a craft of some hundred tonnes turns it; a comet late", () => {
  assert.ok(leadYears(1000, false) >= 25 && leadYears(1000, true) < 5);
  assert.ok(leadYears(10_000, false) <= IMPACT.leadMost);
  const t = turningTonnes(1000, false, 30, 6371, false);
  assert.ok(t > 50 && t < 200, `${t}`);
  assert.ok(turningTonnes(1000, false, 3, 6371, false) > 9 * t);
  assert.ok(turningTonnes(1000, false, 30, 6371, true) < t / 100);
});

// —— The galaxy's fire —————————————————————————————————————————————————————————————————————————————

const sunLike: GalaxyShape = {
  radius: 50_000,
  scale: 10_000,
  arms: 2,
  pitch: 12,
  homeRadius: 26_000,
  homeAngle: 0,
};

test("near supernovae and gamma bursts are rarer than a chronicle is long, oftener in an arm and inward", () => {
  const sn = supernovaRate(sunLike, 26);
  assert.ok(sn > 1e-10 && sn < 1e-8, `${sn}`);
  assert.ok(gammaRate(sunLike) < 1e-7);
  const inward = { ...sunLike, homeRadius: 15_000 };
  assert.ok(youngStarsAt(inward) > youngStarsAt(sunLike));
  assert.ok(armPhase(sunLike) >= -1 && armPhase(sunLike) <= 1);
  assert.ok(burstDistance(1, 52) === 52 && burstDistance(0.125, 52) < 27);
  assert.equal(fieldsUnderBurst(1), 1);
  assert.ok(fieldsUnderBurst(1.5) < 1 && fieldsUnderBurst(100) >= 0.3);
  assert.ok(GALACTIC.reachLy > 26);
});

// —— The dark between the stars ——————————————————————————————————————————————————————————————————

test("the dark's toll: the rays through a ship's walls, the dust at its speed, its clock slowed; bounded", () => {
  assert.equal(darkToll(0), 1);
  const slow = darkToll(0.02),
    fast = darkToll(0.12);
  assert.ok(slow > 1.3 && fast > slow);
  assert.ok(darkToll(0.3) <= CROSSING.most);
  assert.ok(near(lorentz(0.6), 1.25, 1e-9));
  assert.ok(yearsAboard(100, 0.6) === 80);
});

// —— Beyond our ages ———————————————————————————————————————————————————————————————————————————————

test("a works in the sky doubles, faster lit and tended by minds, up to its belt; sends down the people's wear", () => {
  const most = mostWorksT(true);
  assert.ok(mostWorksT(false) > most);
  const a = worksNextYear(1000, most, false, 0),
    b = worksNextYear(1000, most, true, 0),
    c = worksNextYear(1000, most, false, 1e6);
  assert.ok(a > 1000 && b > a && c > a);
  assert.equal(worksNextYear(most, most, true, 1e9), most);
  assert.ok(near(worksNextYear(1000, most, false, 0, 15), 2000, 1e-6));
  assert.equal(worksMachines(1e9, 1000), Math.floor(1000 * BEYOND.perHead));
  assert.equal(worksMachines(100, 1e9), Math.floor(100 * BEYOND.machinesPerT));
});

test("a written body bears the heat and cold it can bend to and the rays a share, never the air", () => {
  const needs = [
    { id: "air", upkeep: 1 },
    { id: "heat", upkeep: 2 },
    { id: "shelter", upkeep: 1 },
  ];
  const s = writableShare(needs, 40, false);
  assert.ok(near(s, (2 + 0.5) / 4, 1e-9), `${s}`);
  assert.ok(writableShare(needs, 120, false) < s);
  assert.ok(writableShare(needs, 120, true) > writableShare(needs, 120, false));
  assert.equal(writableShare([{ id: "air", upkeep: 1 }], 0, true), 0);
  assert.equal(writtenAfter(0), 0);
  assert.ok(near(writtenAfter(BEYOND.generationYears), BEYOND.writtenShare, 1e-9));
  assert.ok(writtenAfter(500) > 0.99);
});

test("made minds pass their makers some forty years on where the power lets them, never where it does not", () => {
  assert.ok(mindsPast(BEYOND.crystalSums, 20, 0) < 1e-5);
  const y = yearsToPass(BEYOND.crystalSums, 20);
  assert.ok(y > 30 && y < 50, `${y}`);
  assert.ok(mindsPast(BEYOND.crystalSums, 20, y + 1) >= 1);
  assert.equal(yearsToPass(BEYOND.crystalSums, 1), Infinity);
  assert.ok(mindsPast(BEYOND.crystalSums, 1, 1000) < 1);
});

test("minds go their own way the likelier the farther past and the looser held; a people goes up as it is open", () => {
  assert.equal(freeingChance(0.5, 0), 0);
  assert.ok(freeingChance(1e6, 0.2) > freeingChance(10, 0.2));
  assert.ok(freeingChance(1e6, 0.9) < freeingChance(1e6, 0.2));
  assert.ok(heldOf(1, 1) === 1 && heldOf(0, 0) === 0);
  assert.equal(wouldGoUp(0.3, 0.5), 0);
  assert.ok(wouldGoUp(0.9, 0.5) > wouldGoUp(0.9, 0.9));
  assert.ok(goingUpOf(10_000, 0.5, 0) > goingUpOf(10_000, 0.5, 0.4));
  assert.equal(goingUpOf(10_000, 0.5, 0.5), 0);
});

// —— The left-outs, built ————————————————————————————————————————————————————————————————————————————

test("a rogue world through the far cloud is rarer than a chronicle is long; closer passes are rarer and stir more", () => {
  const cloud = roguePassRate(0.004, ROGUE.cloudAu);
  assert.ok(cloud > 1e-9 && cloud < 1e-6, `${cloud}`);
  assert.ok(roguePassRate(0.004, ROGUE.beltAu) < cloud / 1000);
  assert.equal(roguePass(1e6).years, 0);
  assert.ok(roguePass(50).times > roguePass(5000).times);
  assert.ok(roguePass(2).orbit && !roguePass(50).orbit);
});

test("spun habitats hold as many as their rock shields and their light keeps; they grow and are joined while there is room", () => {
  assert.equal(skyRoom(1e6, 1e12), Math.floor((1e6 * HABITAT.share) / HABITAT.tonnes));
  assert.equal(skyRoom(1e12, 1000), Math.floor(1000 / HABITAT.kw));
  const y = skyYear(1000, 5000, 1e6);
  assert.ok(y.sky > 1000 && y.sky <= 5000 && y.came > 0);
  assert.equal(skyYear(5000, 5000, 1e6).came, 0);
  assert.ok(skyYear(5000, 4000, 1e6).sky <= 4000);
});

test("the beast raised is the one whose body leans to a mind; its ways are its body's", () => {
  const herdHunter = { size: 60, herd: 0.9, docility: 0.2, level: 3, warm: true, arms: 0 },
    coldGrazer = { size: 60, herd: 0.2, docility: 0.8, level: 2, warm: false, arms: 0 };
  assert.ok(upliftScore(herdHunter) > upliftScore(coldGrazer));
  assert.equal(upliftScore({ ...herdHunter, size: 1 }), 0);
  assert.ok(upliftScore({ ...herdHunter, arms: 2 }) > upliftScore(herdHunter));
  const a = upliftWays(herdHunter),
    b = upliftWays(coldGrazer);
  assert.equal(a.length, 8);
  assert.ok(a[0]! > b[0]! && a[3]! > b[3]! && b[6]! > a[6]!);
  assert.ok(UPLIFT.gapYears >= 200);
});

test("a remaking makes for its settlers' own world's warmth and air", () => {
  const cold = { pressure: 0.01, temperature: -60 };
  assert.deepEqual(remadeGround(cold, 1), { pressure: 1, temperature: 15 });
  const theirs = remadeGround(cold, 1, { temperature: 45, pressure: 3 });
  assert.ok(near(theirs.temperature, 45, 1e-9) && near(theirs.pressure, 3, 1e-9));
  assert.ok(near(remadeGround(cold, 0.5, { temperature: 40, pressure: 0 }).pressure, 0.505, 1e-9));
});
