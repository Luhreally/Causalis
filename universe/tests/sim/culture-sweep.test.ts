// The culture sweep (2026-11-16): who a land counts its own and how far its "us" reaches, a faith's temples, what a seat tells,
// what a town draws, a land's works. The rules alone first, then one young world that keeps every store.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACADEMY,
  KIN_FORMS,
  TIES,
  academyFunds,
  byLine,
  claimEnd,
  claimYearsOf,
  heirlessChance,
  kinCall,
  learnedAfter,
  learnedHealing,
  learnedInquiry,
  learnedReach,
  scholarsTarget,
  templeSway,
  tieKin,
  tieRegard,
  ART,
  FOLK,
  TEMPLE,
  URBAN,
  VOICE,
  VOICE_TOPICS,
  apartGrievance,
  artStanding,
  clergyKept,
  drawAfter,
  folkAfter,
  folkKept,
  granaryAfter,
  kinToSeat,
  nationTarget,
  onenessStanding,
  warRemembered,
  renownOf,
  sharedLot,
  templeGiving,
  templeTeaching,
  toldStanding,
  townDraw,
  voiceBelied,
  voiceCredence,
  voiceHeard,
  voiceNeeds,
  voiceStanding,
  voiceTopic,
  worksAfter,
  worksMade,
  type VoiceSituation,
  ABROAD,
} from "../../src/rules/index.ts";
import {
  CULTURE_ROWS,
  cultureRows,
  identityOf,
  politiesOf,
  voiceOf,
  FOLK_STORE,
  TEMPLE_STORE,
  URBAN_STORE,
  VOICE_STORE,
  ART_STORE,
  ACADEMY_STORE,
  strangersIn,
} from "../../src/sim/index.ts";
import {
  ACADEMY_ROW,
  ART_ROW,
  FOLK_ROW,
  TEMPLE_ROW,
  URBAN_ROW,
  VOICE_ROW,
} from "../../src/sim/culture/rows.ts";
import { peopledWorld } from "../worlds.ts";

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

test("a land counts its own those it shares speech, faith, ways and a long lot with; strangers those it shares none with", () => {
  const own = kinToSeat({ like: 1, sameFaith: true, waysGap: 0, years: 500, span: 70 }),
    strangers = kinToSeat({ like: 0.2, sameFaith: false, waysGap: 0.3, years: 0, span: 70 });
  assert.ok(own > 0.99, `own ${own}`);
  assert.ok(strangers < 0.25, `strangers ${strangers}`);
  // (A lot shared grows with the years held, half in two generations of their own life.)
  assert.ok(near(sharedLot(50, 70), 0.5, 1e-6));
  assert.ok(sharedLot(10, 70) < sharedLot(100, 70));
  // (A short-lived people's generations come faster: the same years bind it more.)
  assert.ok(sharedLot(20, 30) > sharedLot(20, 70));
});

test("a people's 'us' reaches a valley before letters, all its speech once it reads and word joins its lands", () => {
  assert.ok(near(nationTarget(0, 0, false), FOLK.least));
  assert.ok(nationTarget(0.25, 0, false) > nationTarget(0.05, 0, false));
  assert.ok(nationTarget(0.25, 1, false) > nationTarget(0.25, 0, false));
  assert.ok(near(nationTarget(0.25, 0.5, true) - nationTarget(0.25, 0.5, false), FOLK.war));
  assert.ok(nationTarget(1, 1, true) <= 1);
  // (A war with strangers sharpens it wholly while fought, and after its peace as far as those who lived through it are left:
  // a people of seventy years' life, forty years; a shorter-lived one sooner; none past what is kept of a war, however long-lived.)
  assert.equal(warRemembered(null, 70, 40), 1);
  assert.equal(warRemembered(0, 70, 40), 1);
  assert.ok(near(warRemembered(20, 70, 40), 0.5));
  assert.equal(warRemembered(40, 70, 40), 0);
  assert.ok(warRemembered(10, 35, 40) < warRemembered(10, 70, 40));
  assert.equal(warRemembered(39, 700, 40) > 0 && warRemembered(40, 700, 40) === 0, true);
  assert.ok(
    near(nationTarget(0.25, 0.5, 0.5) - nationTarget(0.25, 0.5, 0), FOLK.war / 2),
    "half remembered, half as sharp",
  );
  // (It moves a share of the way a year, and never past where it is drawn.)
  const after = folkAfter(0.1, 0.9, 10);
  assert.ok(after > 0.1 && after < 0.9);
  assert.ok(near(folkAfter(0.1, 0.9, 0), 0.1));
  // (Kept in thousandths, a step too short to show still moves it one: a land is drawn all the way, not held a thousandth short.)
  assert.equal(folkKept(999, folkAfter(0.999, 1, 5), 1), 1000);
  assert.equal(folkKept(1000, 1, 1), 1000);
  assert.equal(
    folkKept(500, folkAfter(0.5, 0.9, 5), 0.9),
    Math.round(folkAfter(0.5, 0.9, 5) * 1000),
  );
});

test("being ruled by strangers aggrieves a nation more than a valley, and none who count the seat's people near their own", () => {
  assert.ok(apartGrievance(0.3, 0.9) > apartGrievance(0.3, 0.1));
  assert.equal(apartGrievance(1, 1), 0);
  assert.equal(apartGrievance(FOLK.middle, 1), 0);
  // (Same faith, same ways, a long lot: kin is 1 - 0.55 of how unlike the speech is; the more unlike, the more aggrieved, and
  // a land of near speech none at all.)
  const at = (foreign: number) =>
    apartGrievance(
      kinToSeat({ like: 1 - foreign, sameFaith: true, waysGap: 0, years: 1e6, span: 70 }),
      0.5,
    );
  assert.equal(at(0.4), 0);
  assert.ok(at(1) > at(0.9) && at(0.9) > 0);
  // (One people with its seat holds its rule the more rightful, strangers the less, the more they imagine an 'us'.)
  assert.ok(onenessStanding(0.95, 0.8) > 0);
  assert.ok(onenessStanding(0.3, 0.8) < 0);
  assert.ok(Math.abs(onenessStanding(0.3, 0.1)) < Math.abs(onenessStanding(0.3, 0.8)));
  assert.ok(onenessStanding(1, 1) <= FOLK.oneness + 1e-12);
});

test("the devout give a tenth at most, their clergy are as many as it feeds, their granaries rot and their teaching saturates", () => {
  assert.equal(templeGiving(0.25, 1), 0);
  assert.ok(near(templeGiving(1, 1), TEMPLE.give));
  assert.ok(templeGiving(0.8, 0.2) < templeGiving(0.8, 0.9));
  assert.ok(near(clergyKept(1000, 10), (1000 * TEMPLE.clergy) / 10));
  assert.ok(near(granaryAfter(1000, 0, 0, 1), 1000 * (1 - TEMPLE.spoil)));
  assert.equal(granaryAfter(100, 0, 500, 1), 0);
  assert.ok(granaryAfter(1000, 0, 0, 10) < granaryAfter(1000, 0, 0, 1));
  const full = templeTeaching(TEMPLE.teachAt * 10_000, 10_000, 1);
  assert.ok(near(full, 1));
  assert.ok(templeTeaching(TEMPLE.teachAt * 10_000, 10_000, 0) < full);
  assert.ok(templeTeaching(TEMPLE.teachAt * 1_000, 10_000, 1) < full);
  assert.equal(templeTeaching(10, 0, 1), 0);
});

const calm: VoiceSituation = {
  legitimacy: 0.7,
  atWar: false,
  lost: 0,
  apart: 0.05,
  nation: 0.3,
  hungry: 0,
  shared: 0,
  piety: 0.5,
  grievance: 0.1,
};

test("a seat tells what it most needs to, and it is believed as far as nothing gives it the lie and no free voice answers", () => {
  assert.equal(voiceTopic(voiceNeeds(calm)), null);
  assert.equal(voiceTopic(voiceNeeds({ ...calm, legitimacy: 0.3 })), "right");
  assert.equal(voiceTopic(voiceNeeds({ ...calm, atWar: true, lost: 0.8 })), "foe");
  assert.equal(voiceTopic(voiceNeeds({ ...calm, hungry: 0.6 })), "blame");
  assert.equal(voiceTopic(voiceNeeds({ ...calm, shared: 1, piety: 0.9 })), "faith");
  assert.equal(voiceTopic(voiceNeeds({ ...calm, apart: 0.5, nation: 0.8 })), "one");
  // (A war told won and seen lost is not believed; blame needs strangers to bear it.)
  assert.ok(voiceBelied("foe", { ...calm, lost: 0.9 }) > voiceBelied("foe", calm));
  assert.equal(voiceBelied("blame", { ...calm, apart: 0 }), 1);
  assert.ok(voiceCredence(0.2, 1, 1) < voiceCredence(0.2, 0, 1));
  assert.ok(voiceCredence(0.2, 1, 0.01) > voiceCredence(0.2, 1, 1));
  // (Told and believed it holds a rule the more rightful; seen to be false, the less.)
  assert.ok(voiceStanding(1, 1) > 0 && near(voiceStanding(1, 1), VOICE.push));
  assert.ok(voiceStanding(1, 0.1) < 0);
  assert.ok(near(voiceStanding(0, 1), 0));
  assert.ok(toldStanding(1, 1, 0.5) < 0);
  assert.ok(near(toldStanding(0, 1, 0.5), 0));
  // (Heard at the seat, from the pulpit, and by readers as far as word joins far lands.)
  assert.ok(near(voiceHeard(true, 0, 0, 0), VOICE.seat));
  assert.ok(voiceHeard(false, 0, 0.5, 1) > voiceHeard(false, 0, 0.5, 0));
  assert.ok(voiceHeard(false, 1, 0, 0) > 0);
  assert.ok(voiceHeard(true, 1, 1, 1) <= 1);
  assert.equal(VOICE_TOPICS.length, 5);
});

test("a town draws as far as its work pays over the fields', less what its crowds cost; its trades stay whatever", () => {
  assert.equal(townDraw(0, 10, 1000), 1);
  assert.equal(townDraw(5, 10, 1000), 1);
  assert.ok(townDraw(20, 10, 500) > 1.8);
  assert.ok(townDraw(20, 10, 50_000) < townDraw(20, 10, 500));
  assert.ok(townDraw(1000, 1, 100) <= URBAN.most);
  const d = drawAfter(1, 2, 5);
  assert.ok(d > 1 && d < 2);
  assert.ok(near(drawAfter(1, 2, 0), 1));
});

test("works are made from spare hands, rulers' and clergy's makers, wear to a steady stock, and renown grows with them", () => {
  assert.equal(worksMade(100, 0, 0, 0), 0);
  assert.ok(near(worksMade(100, 1, 2, 10), ART.hands * 100 + ART.court * 2 + ART.clergy * 10));
  // (Made steadily for long, works come to what is made over what wears a year.)
  assert.ok(near(worksAfter(0, 10, 2000), 10 / ART.wear, 1e-3));
  assert.ok(near(worksAfter(100, 0, 1), 100 * (1 - ART.wear)));
  // (Stepped ten years at once or a year at a time, the same.)
  let yearly = 50;
  for (let y = 0; y < 10; y++) yearly = worksAfter(yearly, 4, 1);
  assert.ok(near(worksAfter(50, 4, 10), yearly, 1e-9));
  assert.ok(renownOf(100, 1000) > renownOf(10, 1000));
  assert.ok(renownOf(100, 1000) > renownOf(100, 100_000));
  assert.equal(renownOf(0, 1000), 0);
  assert.ok(artStanding(1, 1) <= ART.glory);
  assert.equal(artStanding(1, 0), 0);
});

test("each of the sweep's stores is as wide as its rows' places", () => {
  const widths = new Map(CULTURE_ROWS);
  for (const [name, row] of [
    [FOLK_STORE, FOLK_ROW],
    [TEMPLE_STORE, TEMPLE_ROW],
    [VOICE_STORE, VOICE_ROW],
    [URBAN_STORE, URBAN_ROW],
    [ART_STORE, ART_ROW],
    [ACADEMY_STORE, ACADEMY_ROW],
  ] as const) {
    const places = Object.values(row);
    assert.equal(widths.get(name), Math.max(...places) + 1, name);
    assert.equal(new Set(places).size, places.length, name);
  }
});

test("a young world keeps the sweep's stores: who each land of a realm counts its own, what each realm's seat tells", () => {
  const world = peopledWorld("first light", 40, { start: "spread" });
  for (const [name] of CULTURE_ROWS) assert.ok(cultureRows(world, name), name);
  const folk = cultureRows(world, FOLK_STORE)!;
  for (const key of folk.keys()) {
    const row = folk.get(key)!;
    assert.ok(row[FOLK_ROW.kin]! >= 0 && row[FOLK_ROW.kin]! <= 1000, `kin of ${key}`);
    assert.ok(row[FOLK_ROW.nation]! >= 0 && row[FOLK_ROW.nation]! <= 1000, `reach of ${key}`);
  }
  const realms = politiesOf(world).living();
  let mixed = 0;
  for (const r of realms) {
    const v = voiceOf(world, r.ref);
    if (v) assert.ok(v.reach >= 0 && v.reach <= 1 && v.credence >= 0 && v.credence <= 1, r.ref);
    // (A realm's seat is its own people, as far as it has been weighed under it; less only what peoples not its own living in
    // it take (sim/culture/folk.ts folkTargets, since peoples abroad were kept: ABROAD.apart of their share). It read "wholly
    // its own" for every seat; since a people abroad is kept from a hundredth of a land (ABROAD.least, 2026-11-23) eleven of
    // first light's 36 seats at 40 hold one, the least its own at 0.983.)
    const seat = identityOf(world, r.seat);
    if (!seat) continue;
    const strangers = strangersIn(world, r.seat);
    // (A seat whose strangers have lately gone is drawn back to wholly its own at each weighing, not at once: pol:0:10's left in
    // year 36, a hundredth of its people under ABROAD.least, and its seat reads 0.997 at 40, its own again within a few
    // weighings.)
    if (strangers === 0)
      assert.ok(
        seat.kin <= 1 && seat.kin >= 1 - ABROAD.apart,
        `${r.ref} holds no strangers: ${seat.kin}`,
      );
    else {
      mixed++;
      // (By their share when it was last weighed, once in five years: never more than strangers can take.)
      assert.ok(
        seat.kin < 1 && seat.kin >= 1 - ABROAD.apart,
        `${r.ref}: ${seat.kin} with ${strangers} of its people strangers`,
      );
    }
  }
  assert.ok(mixed < realms.length / 2, `${mixed} of ${realms.length} seats hold strangers`);
});

test("a tie makes kin as its people make kin: a marriage half, a fostering a quarter, a hive's brood as much as a hive's own", () => {
  assert.equal(tieKin("wed", 0.8), 0.5);
  assert.equal(tieKin("foster", 0.6), 0.25);
  assert.equal(tieKin("graft", 0.6), 0.5);
  assert.ok(near(tieKin("brood", 0.9), KIN_FORMS.broodLeast));
  assert.ok(near(tieKin("brood", 1), KIN_FORMS.broodMost));
  // (A marriage is remembered and called on as it always was; the others by the kin they make.)
  assert.ok(near(tieRegard("wed", 0.8, TIES.tieOther), TIES.tieOther + 0.1));
  assert.ok(near(kinCall("wed", 0.8, TIES.comes.kin), TIES.comes.kin));
  assert.ok(kinCall("brood", 1, TIES.comes.kin) > kinCall("wed", 0.8, TIES.comes.kin));
  assert.ok(kinCall("foster", 0.6, TIES.comes.kin) < kinCall("wed", 0.8, TIES.comes.kin));
  // (A marriage's claim stands a life of their kind; a line's until a generation leaves it no heir, at most four lives.)
  assert.equal(claimYearsOf("wed", 70, 25, 2), KIN_FORMS.claimYears);
  assert.ok(claimYearsOf("wed", 35, 12, 2) < claimYearsOf("wed", 70, 25, 2));
  assert.ok(byLine("brood") && byLine("graft") && !byLine("wed") && !byLine("foster"));
  assert.ok(claimYearsOf("brood", 70, 25, 2) > claimYearsOf("wed", 70, 25, 2));
  assert.ok(claimYearsOf("brood", 70, 25, 50) <= KIN_FORMS.lineMost * KIN_FORMS.claimYears + 1e-9);
  // (An upright ape's line of some two heirs leaves none about one time in eight, as the old rule had it.)
  assert.ok(Math.abs(heirlessChance(2) - TIES.heirless) < 0.02);
  assert.ok(heirlessChance(6) < heirlessChance(1));
});

test("a hive's seat passes to a mother of its gifted brood whatever it thinks of the giver, and no hive marches for one", () => {
  for (const draw of [0, 0.3, 0.6, 0.8]) {
    assert.equal(claimEnd("brood", -0.9, 1, true, draw), "seated");
    assert.notEqual(claimEnd("brood", 0.9, 0.1, true, draw), "war");
    assert.notEqual(claimEnd("graft", -0.9, 0.1, true, draw), "war");
  }
  assert.equal(claimEnd("brood", 0.9, 0.1, true, 0.95), "passedby");
  // (Reefs grafted fuse where they think well enough of each other; a marriage asks more of its regard to pass.)
  assert.equal(claimEnd("graft", 0, 0.5, true, 0.1), "passes");
  assert.notEqual(claimEnd("wed", 0, 0.5, true, 0.1), "passes");
});

test("a faith weighs in its realm as far as it has clergy to speak for its piety", () => {
  assert.equal(templeSway(0), TEMPLE.swayLeast);
  assert.equal(templeSway(1), 1);
  assert.equal(templeSway(5), 1);
  assert.ok(templeSway(0.5) > templeSway(0.1));
});

test("higher learning: kept by patrons, of readers the fields spare, none without writing; its learned inquire, heal and clerk", () => {
  const funds = academyFunds(1000, 2000, 500);
  assert.ok(near(funds, ACADEMY.temple * 1000 + ACADEMY.seat * 2000 + ACADEMY.houses * 500));
  assert.equal(scholarsTarget(false, 1e9, 12, 1000, 1, 1), 0);
  // (Funds without readers keep no one; readers without funds neither.)
  assert.equal(scholarsTarget(true, 1e9, 12, 1000, 0, 1), 0);
  assert.equal(scholarsTarget(true, 0, 12, 1000, 1, 1), 0);
  assert.ok(near(scholarsTarget(true, 1e9, 12, 1000, 0.5, 0.4), ACADEMY.most * 0.5 * 0.4));
  assert.ok(near(scholarsTarget(true, 120, 12, 1000, 1, 1), 10 / 1000));
  // (A generation brings it half the way.)
  assert.ok(near(learnedAfter(0, 0.01, 25, 70), 0.005));
  assert.ok(near(learnedAfter(0.01, 0.01, 10, 70), 0.01));
  assert.equal(learnedInquiry(0), 1);
  assert.ok(near(learnedInquiry(ACADEMY.full), 1 + ACADEMY.inquiry));
  assert.ok(near(learnedInquiry(1), 1 + ACADEMY.inquiry));
  assert.equal(learnedHealing(0), 1);
  assert.ok(near(learnedReach(ACADEMY.full / 2), ACADEMY.reach / 2));
});
