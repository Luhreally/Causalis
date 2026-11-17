// The society sweep as pure rules: care of the sick and the old, who does what by the body that bears, what a realm's law holds to,
// how a land keeps its food, what it wears, how it rests, and how fast its speech changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CARE,
  CARE_OLD,
  CHILDREN,
  COAT,
  DIMORPHISM,
  HUMANLIKE,
  IMPROVE,
  KEEPING,
  almsOf,
  careAccess,
  careReach,
  careSpared,
  careSpend,
  childCost,
  childrenKept,
  childrenWanted,
  contractsKept,
  dealsMoved,
  displayOf,
  dressWanted,
  feastRelief,
  fieldStrength,
  forgone,
  frailBand,
  gamesIn,
  gamesOf,
  healersPerThousand,
  holdingSecure,
  improveTarget,
  improvedStep,
  keepingMeans,
  keptOld,
  keptShare,
  lawWritten,
  normStep,
  pensionWanted,
  publicCareWanted,
  restDays,
  rolesTarget,
  seizureRisk,
  soundChange,
  tableWords,
  warmthNeeded,
  workingHours,
} from "../../src/rules/index.ts";

test("a land richer above its bread spends more on its sick and keeps more healers, and they reach more of it", () => {
  assert.ok(careSpend(0.9) > 3 * careSpend(0.1));
  const poor = healersPerThousand(careSpend(0.1), 0.6),
    rich = healersPerThousand(careSpend(0.9), 0.6);
  assert.ok(poor > 1 && poor < 10, `${poor} healers in a thousand`);
  assert.ok(rich > poor && careReach(rich) > careReach(poor) && careReach(rich) <= 1);
  assert.equal(careReach(0), 0);
});

test("the poor go untended as wealth lies with few, unless the temple or the realm pays; kin tend where no healer comes", () => {
  const even = careAccess(1, 0, 0, 0),
    unequal = careAccess(1, 0.6, 0, 0),
    paid = careAccess(1, 0.6, 0, 1);
  assert.ok(unequal.access < even.access && paid.access === even.access);
  assert.ok(careAccess(1, 0.6, almsOf(1), 0).access > unequal.access);
  // (With no healer at all, kin's tending is all there is.)
  assert.equal(careAccess(0, 0.3, 0, 0).effective, CARE.kin);
  // (What is known spares deaths as far as care reaches; hospitals the more; never past the most.)
  assert.ok(careSpared(0.2, 0, 1) > careSpared(0.2, 0, 0.5));
  assert.ok(careSpared(0.2, 1, 1) > careSpared(0.2, 0, 1));
  assert.ok(careSpared(5, 1, 1) <= CARE.mostWithHospitals);
  assert.equal(careSpared(0.2, 0, 1), 0.2);
});

test("an ape's frail are its sixties; kin keep them as far as two raise their young; those no one keeps die the sooner", () => {
  assert.equal(HUMANLIKE.bands[frailBand(HUMANLIKE)], 60);
  const base = {
      pairing: "life" as const,
      kinship: 0.5,
      towns: 0,
      support: 10,
      piety: 0,
      money: 0,
      surplus: 0,
      gini: 0.3,
      pension: 0,
    },
    kin = keptOld(base),
    loners = keptOld({ ...base, pairing: "none" }),
    towns = keptOld({ ...base, towns: 1, support: 1 });
  assert.ok(kin.kin > 0.7 && loners.kin === 0);
  assert.ok(loners.press > kin.press && towns.press > kin.press);
  assert.equal(keptOld({ ...base, pairing: "none" }).want, 0, "no one is kept by their children");
  // A pension and savings keep the old, and their mothers want fewer children for their age.
  const paid = keptOld({ ...base, pension: 0.8, money: 1, surplus: 0.8 });
  assert.ok(paid.security > 0.8 && paid.want < kin.want && paid.neglected < kin.neglected);
  assert.ok(kin.want <= CARE_OLD.children);
});

test("a realm pays its old where they are heard and many, its poor's care where many go untended; only with a roll", () => {
  const sides = { voice: 0.8, roll: true, old: 0.15, kin: 0.4, untended: 0.4, burden: 0.1 };
  assert.ok(pensionWanted(sides).level > 0.5);
  assert.ok(pensionWanted({ ...sides, voice: 0.1 }).level < pensionWanted(sides).level);
  assert.equal(pensionWanted({ ...sides, roll: false }).level, 0);
  assert.ok(publicCareWanted(sides).level > publicCareWanted({ ...sides, untended: 0.05 }).level);
});

test("children wanted for age raise what a people bears; what a mother gives up for a child lowers it; old calls unchanged", () => {
  assert.equal(childCost(0.5, 0.5), childCost(0.5, 0.5, 0));
  assert.ok(childCost(0.5, 0.5, 0.4) > childCost(0.5, 0.5));
  assert.equal(childrenWanted(1), childrenWanted(1, 0));
  assert.ok(childrenWanted(1, 0.8) > childrenWanted(1));
  const cost = childCost(0.7, 0.6);
  assert.ok(childrenKept(HUMANLIKE, 0.7, cost, 0.8) >= childrenKept(HUMANLIKE, 0.7, cost));
  assert.ok(childrenWanted(childCost(1, 1, 1)) > CHILDREN.replace);
});

test("the sexes' bodies differ most where one holds several; the plough shuts out the weaker; schooling opens work again", () => {
  assert.ok(DIMORPHISM.harem > DIMORPHISM.life && DIMORPHISM.life > DIMORPHISM.brood);
  assert.ok(fieldStrength(true, true, 0) > fieldStrength(true, false, 0));
  assert.equal(fieldStrength(true, true, 1), 0);
  const m = { held: 0.4, dimorphism: 0.8, strength: 0.7, towns: 0.2, readers: 0, machines: 0 },
    hoe = rolesTarget({ ...m, strength: 0.25 }),
    plough = rolesTarget(m),
    towns = rolesTarget({ ...m, towns: 1 }),
    schooled = rolesTarget({ ...m, held: 0.15, strength: 0, towns: 1, readers: 1, machines: 1 });
  assert.ok(plough < hoe && towns < plough && schooled > hoe);
  // A people's norm moves slowly toward what its work asks.
  const n = normStep(0.2, 0.8, 5);
  assert.ok(n > 0.2 && n < 0.35);
  // A child costs its mother's work only as far as it is away from home.
  assert.ok(forgone(0.8, 1, 0.5) > forgone(0.8, 0.05, 0));
});

test("a ruler by force over the unheard takes what is held; a written law and courts make it safe, and deals kept", () => {
  const tyrant = seizureRisk({ force: 0.9, voice: 0.1, corruption: 0.5, written: 0, short: 0.5 }),
    bound = seizureRisk({ force: 0.4, voice: 0.8, corruption: 0.1, written: 1, short: 0 });
  assert.ok(tyrant.risk > 0.5 && bound.risk < 0.1);
  assert.ok(holdingSecure(bound.risk, 0.9, 0.9) > holdingSecure(tyrant.risk, 0.3, 0.3));
  assert.ok(lawWritten(true, true, 0.8, 0.5) > lawWritten(false, true, 0.8, 0.5));
  assert.equal(lawWritten(false, false, 1, 1), 0);
  const courts = contractsKept(0.9, 1, 0, 1, 0.5, 0.5),
    custom = contractsKept(0.3, 0, 0.6, 0.2, 0.5, 0.9);
  assert.ok(courts.kept > custom.kept && custom.kept === custom.byKin);
  // What is put into the land is built toward what is worth it, worn by the years and by war, and never past the most.
  const target = improveTarget(1, 1);
  assert.equal(target, IMPROVE.most);
  const after = improvedStep(0, target, 50, 0),
    warred = improvedStep(0, target, 50, 20);
  assert.ok(after > 0.5 * target && after <= IMPROVE.most && warred < after);
  assert.ok(improvedStep(0.1, 0, 20, 0) < 0.1);
  assert.equal(dealsMoved(1, 1), 1);
  assert.ok(dealsMoved(0.2, 0.2) < dealsMoved(0.8, 0.8));
});

test("a land's own air, coast, woods and brewing keep its food; the hot cook with spice; never past the most", () => {
  const steppe = keepingMeans({
      temperature: 14,
      seasonality: 18,
      rain: 300,
      coast: false,
      woods: 0,
      brews: false,
      growth: 0.2,
      water: false,
    }),
    jungle = keepingMeans({
      temperature: 26,
      seasonality: 1,
      rain: 2500,
      coast: false,
      woods: 0.8,
      brews: false,
      growth: 1,
      water: false,
    });
  assert.ok(steppe.drying > jungle.drying && steppe.frost > 0 && jungle.frost === 0);
  assert.ok(jungle.spice > steppe.spice && jungle.smoke > steppe.smoke);
  const all = keptShare({ drying: 1, frost: 1, salt: 1, smoke: 1, ferment: 1, spice: 1 });
  assert.equal(all, KEEPING.most);
  assert.equal(keptShare({ drying: 0, frost: 0, salt: 0, smoke: 0, ferment: 0, spice: 0 }), 0);
  assert.ok(tableWords({ grain: 0.8, meat: 0.1, wild: 0.1 }, jungle, false).length >= 1);
});

test("a furred body needs fewer clothes in the cold than a bare one; none in the water; show where wealth lies with few", () => {
  assert.ok(warmthNeeded(0, 15, COAT.skin!, false) > warmthNeeded(0, 15, COAT.fur!, false));
  assert.equal(warmthNeeded(-10, 10, 1, true), 0);
  assert.equal(warmthNeeded(30, 2, 1, false), 0);
  assert.ok(displayOf(0.5, 1, 0) > displayOf(0.25, 1, 0));
  assert.ok(dressWanted(1, 0) > dressWanted(0, 0) && dressWanted(0, 1) > dressWanted(0, 0));
});

test("the nearer earnings lie to bread, the longer the day; the devout keep holy days; feasts ease grievance; games by body", () => {
  assert.ok(workingHours(1) > workingHours(0.1));
  assert.ok(restDays(1, 0).holy > restDays(0, 0).holy && restDays(0, 1).feasts > 0);
  assert.ok(feastRelief(60, 0) > feastRelief(60, 1) && feastRelief(0, 0) === 0);
  const ape = gamesIn(
      gamesOf({
        hands: true,
        legs: 2,
        wings: 0,
        water: false,
        dimorphism: 0.25,
        riding: true,
        reckoning: false,
        valour: 0.3,
      }),
    ),
    swimmer = gamesIn(
      gamesOf({
        hands: false,
        legs: 0,
        wings: 0,
        water: true,
        dimorphism: 0.05,
        riding: false,
        reckoning: true,
        valour: 0.7,
      }),
    );
  assert.deepEqual(ape, ["throwing", "wrestling", "races", "riding"]);
  assert.deepEqual(swimmer, ["swimming", "board", "war"]);
});

test("speech changes by generations, slower where a people reads; an ape that does not read as before", () => {
  assert.equal(soundChange(15, 0), 1 / 30);
  assert.ok(soundChange(15, 1) < soundChange(15, 0));
  assert.ok(soundChange(5, 0) > soundChange(15, 0));
});
