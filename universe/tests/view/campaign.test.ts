import { test } from "node:test";
import assert from "node:assert/strict";
import type { Campaign, CampaignBattle } from "../../src/bridge/index.ts";
import { campaignAt, campaignSpan, foughtAt } from "../../src/view/index.ts";

// Phase 38 M193: a war watched unfolding on the globe — its host marching while it is fought, its
// battles flaring in their turns, the fallen mounting, the lands taken marked, told as it goes.

const side = (name: string, color: [number, number, number]) => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color,
  fields: 1000,
  arms: null,
  host: null,
});
const battle = (
  event: string,
  year: number,
  cell: number,
  outcome: CampaignBattle["outcome"],
  fallen: [number, number],
): CampaignBattle => ({
  event,
  year,
  cell,
  spot: cell * 10,
  land: `the land of ${cell}`,
  won: outcome !== "held",
  fallen,
  outcome,
});
const war: Campaign = {
  ref: "war:1",
  title: "The war of the realm of Ash upon the realm of Elm",
  attacker: side("Ash", [0.8, 0.2, 0.2]),
  defender: side("Elm", [0.2, 0.3, 0.8]),
  from: 5,
  to: 30,
  prize: "the land of 3",
  declared: 100,
  ended: 104,
  now: 120,
  battles: [
    battle("ev:1", 101, 3, "field", [10, 40]),
    battle("ev:2", 101, 3, "held", [50, 20]),
    battle("ev:3", 102, 4, "siege", [30, 60]),
    battle("ev:4", 103, 4, "stormed", [80, 200]),
  ],
  civil: null,
};

test("a war is watched from its declaring to a year past its end, those of one year one after another", () => {
  assert.deepEqual(campaignSpan(war), { from: 100, to: 105 });
  assert.deepEqual(foughtAt(war), [101.25, 101.75, 102.5, 103.5]);
  assert.equal(campaignAt(war, 50).year, 100);
  assert.equal(campaignAt(war, 999).year, 105);
  // (A war still fought plays to now.)
  assert.deepEqual(campaignSpan({ ...war, ended: null }), { from: 100, to: 121 });
});

test("before its first battle its host marches, and it is told what it marches for", () => {
  const now = campaignAt(war, 100.5);
  assert.equal(now.fought.length, 0);
  assert.equal(now.map.wars[0]!.ended, null, "the host marching");
  assert.equal(
    now.words,
    "Year 100: The realm of Ash march on the realm of Elm, for the land of 3",
  );
});

test("its battles come in their turns: told, tallied, flaring where they were fought", () => {
  const one = campaignAt(war, 101.5);
  assert.deepEqual(
    one.fought.map((b) => b.event),
    ["ev:1"],
  );
  assert.deepEqual(one.won, [1, 0]);
  assert.deepEqual(one.fallen, [10, 40]);
  assert.equal(
    one.words,
    "Year 101: the battle at the land of 3 — the realm of Ash won the field; 50 fell",
  );
  assert.deepEqual(
    one.map.wars[0]!.battles.map((b) => [b.spot, b.year, b.fallen]),
    [[30, 101, 50]],
  );
  assert.ok(one.marks.some((m) => m.key === "battle:ev:1" && m.text === "⚔️ 50 fell · 101"));
  const two = campaignAt(war, 101.9);
  assert.deepEqual(two.won, [1, 1]);
  assert.match(two.words, /the realm of Elm held; 70 fell$/);
});

test("a seat besieged stands besieged until it is stormed; the lands taken are marked", () => {
  const siege = campaignAt(war, 102.6);
  assert.equal(siege.map.wars[0]!.siege, 40);
  assert.match(siege.words, /laid siege to the realm of Elm's seat/);
  const stormed = campaignAt(war, 103.6);
  assert.equal(stormed.map.wars[0]!.siege, null);
  assert.deepEqual(
    stormed.taken.map((b) => b.event),
    ["ev:4"],
  );
  assert.ok(stormed.marks.some((m) => m.text === "🏴 The realm of Elm's seat taken · 103"));
  // (Battles two years gone are no longer marked; what was taken stays so.)
  const later = campaignAt(war, 103.99);
  assert.ok(!later.marks.some((m) => m.key === "battle:ev:1"));
});

test("at its end it stands down, and its whole is told", () => {
  const end = campaignAt(war, 105);
  assert.ok(end.over);
  assert.equal(end.map.wars[0]!.ended, 104);
  assert.equal(end.words, "Year 104: the war ends — one land taken, 490 fallen");
  assert.deepEqual(end.fallen, [170, 320]);
});

test("its host marches from where it set out to each battle in turn, there by the time it is fought", () => {
  const leg = (y: number) => {
    const n = campaignAt(war, y),
      w = n.map.wars[0]!;
    return { from: w.from, to: w.to, k: n.march };
  };
  // Setting out from its land for its first battle's, along the way as the year goes.
  assert.deepEqual(leg(100), { from: 5, to: 30, k: 0 });
  const going = leg(100.5);
  assert.equal(going.to, 30);
  assert.ok(going.k! > 0.2 && going.k! < 0.8, `${going.k}`);
  // There before it is fought; and standing there while it fights there again.
  assert.equal(leg(101.2).k, 1);
  assert.deepEqual(leg(101.5), { from: 5, to: 30, k: 1 });
  // On from there to the next field, and standing there after its last battle.
  const on = leg(102);
  assert.deepEqual([on.from, on.to], [30, 40]);
  assert.ok(on.k! > 0 && on.k! < 1, `${on.k}`);
  assert.deepEqual(leg(104.5), { from: 30, to: 40, k: 1 });
  // Over: it stands down.
  assert.equal(campaignAt(war, 105).march, null);
  // (A war of no battles marches on what it wants over its whole course.)
  const none = { ...war, battles: [] },
    half = campaignAt(none, 102.5);
  assert.deepEqual([half.map.wars[0]!.from, half.map.wars[0]!.to], [5, 30]);
  assert.ok(half.march! > 0.3 && half.march! < 1, `${half.march}`);
});

test("held where it fought, its host is thrown back and comes on again; held at its last, it falls back", () => {
  const twice: Campaign = {
      ...war,
      ended: 103,
      battles: [
        battle("ev:1", 101, 3, "held", [50, 20]),
        battle("ev:2", 102, 3, "field", [10, 40]),
      ],
    },
    at = (y: number) => campaignAt(twice, y).march!;
  // (Its first at 101.5, its next at 102.5.)
  assert.equal(at(101.5), 1);
  assert.ok(at(102) < 0.75, `thrown back (${at(102)})`);
  assert.ok(at(102.45) > 0.95, `come on again (${at(102.45)})`);
  // Won there: standing there after.
  assert.equal(at(103), 1);
  const beaten: Campaign = { ...twice, battles: [twice.battles[0]!] };
  assert.ok(campaignAt(beaten, 103).march! < 0.65, "beaten at its last, it falls back");
});
