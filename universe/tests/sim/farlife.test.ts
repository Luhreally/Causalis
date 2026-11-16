// A far people's life in a few numbers (rules/farlife.ts, round F): the near world's rules in coarse form, stepped a decade at a
// time. What a people's own world and body let it come to, and how fast; what it fears of another; what passes between two.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAR_LIFE,
  FAR_RUNGS,
  farBegins,
  farDearness,
  farGain,
  farPasses,
  farStep,
  farStrength,
  farThreat,
  gateOf,
  landed,
  meetingLeans,
  seaFlows,
  warAim,
  type FarFacts,
  type FarState,
} from "../../src/rules/index.ts";
import {
  FAR_RING,
  pack,
  ringOf,
  rungInto,
  sampleInto,
  unpack,
  type FarRow,
} from "../../src/sim/space/farlife-store.ts";
import {
  beginReading,
  heldTo,
  readAt,
  readOn,
  stageByRungs,
  topByRungs,
} from "../../src/sim/space/farlife-read.ts";

const EARTH: FarFacts = {
  key: "earth-like",
  sea: false,
  areaKm2: 1e8,
  warmth: 15,
  gravity: 1,
  pressure: 1,
  oxygen: true,
  light: 1,
  bodyKg: 60,
  span: 70,
  social: 0.6,
  flesh: false,
  fire: true,
  grips: true,
  sows: true,
  stores: true,
  heat: 1500,
  metals: true,
  fuelMJ: 3e9,
  river: 3000,
  wind: 20000,
  hot: 500,
  vents: 0,
  tides: 0,
  bioCurrent: false,
  fissile: 1,
  orbitKms: 9.5,
  ceiling: 7,
};

const SEA: FarFacts = {
  ...EARTH,
  key: "sea",
  sea: true,
  areaKm2: 3.6e7,
  fire: false,
  metals: false,
  fuelMJ: 0,
  river: 0,
  wind: 0,
  ...seaFlows({ radius: 1, ageGyr: 4.6, starMass: 1, au: 1, moon: 1, lifeDraw: 0.2 }),
};

/** The draw of a decade, fixed for a test: never a plague year. */
const draw = (y: number) => 0.1 + 0.8 * (((y * 7919) % 1000) / 1000);

/** A people's life from its camps, a decade at a time: the year each rung first came, and its numbers at the end. */
function lived(f: FarFacts, years: number): { at: number[]; end: FarState } {
  let s = farBegins(f);
  const at = FAR_RUNGS.map(() => Infinity);
  at[0] = 0;
  for (let y = 0; y < years; y += FAR_LIFE.step) {
    s = farStep(f, s, FAR_LIFE.step, draw(y), y + FAR_LIFE.step);
    if (s.rung < at.length && at[s.rung] === Infinity) at[s.rung] = y + FAR_LIFE.step;
    if (s.fell !== null) break;
  }
  return { at, end: s };
}

test("an Earth-like people climbs to its first machines in some centuries, and to the stars after", (t) => {
  const { at, end } = lived(EARTH, 3000),
    words = at.map((y, i) => `${FAR_RUNGS[i]} ${y}`).join(", ");
  t.diagnostic(words);
  assert.ok(at[1]! > 40 && at[1]! < 400, `villages: ${words}`);
  assert.ok(at[4]! > 350 && at[4]! < 1300, `works: ${words} ${JSON.stringify(end)}`);
  assert.ok(at[7]! < 2600, `the stars: ${words}`);
  assert.equal(end.fell, null);
  // (Their children fewer as each costs more: they level off below what their ground feeds.)
  assert.ok(end.letters > 0.5, `readers ${end.letters}`);
});

test("a people who eat only flesh keep to villages; one with nothing to sow, to camps", () => {
  assert.equal(lived({ ...EARTH, flesh: true }, 2500).end.top, 1);
  assert.equal(lived({ ...EARTH, sows: false }, 2500).end.top, 0);
  assert.equal(gateOf({ ...EARTH, flesh: true }, 2, { spare: 0.5, made: 0, people: 1e6 }), "flesh");
});

test("no fuel under them: wood and rivers bring them to the current, the atom past it", () => {
  const { at } = lived({ ...EARTH, fuelMJ: 0 }, 3000);
  assert.ok(at[5]! < 3000, `signals ${at[5]}`);
});

test("a people of the sea climbs by its vents, its tides and its own living current, and no fire", () => {
  const { at, end } = lived(SEA, 3000);
  assert.ok(at[3]! < 2000, `cities ${at[3]}`);
  assert.ok(end.top >= 4, `top ${FAR_RUNGS[end.top]}`);
  // (Without a living current or a vent's metals, nothing of theirs turns the electron's wire.)
  assert.equal(
    gateOf({ ...SEA, bioCurrent: false, vents: 0, tides: 0 }, 5, {
      spare: 1,
      made: 1e4,
      people: 1e9,
    }),
    "current",
  );
});

test("a world whose fuel warms it past its people's food burns its own fields", () => {
  const hot = lived({ ...EARTH, warmth: 33, wind: 0, river: 0, hot: 0, fissile: 0 }, 4000).end;
  assert.ok(hot.warmed > 0, "its air warmed");
});

test("one step or ten: a decade stepped at once comes to much what ten years do", () => {
  let a = farBegins(EARTH),
    b = farBegins(EARTH);
  for (let y = 0; y < 300; y += 10) {
    a = farStep(EARTH, a, 10, 0.5, y + 10);
    for (let k = 0; k < 10; k++) b = farStep(EARTH, b, 1, 0.5, y + k + 1);
  }
  assert.ok(Math.abs(Math.log(a.people / b.people)) < 0.25, `${a.people} vs ${b.people}`);
  assert.ok(Math.abs(a.know - b.know) < 0.15, `${a.know} vs ${b.know}`);
});

test("strength among the stars is what a people turns, as far as it holds together", () => {
  const at = (made: number, cohesion: number) =>
    farStrength({ people: 5e9, made, rung: 7, cohesion, war: 0, broken: false, fell: null });
  assert.ok(at(8000, 0.8) > at(2000, 0.8));
  assert.ok(at(8000, 0.8) > at(8000, 0.2));
  assert.ok(at(8000, 1) <= 5);
  assert.equal(
    farStrength({ people: 0, made: 0, rung: 0, cohesion: 0, war: 0, broken: false, fell: 10 }),
    0,
  );
});

test("a stronger, nearer people who could live on one's world is feared; a weak far one is not", () => {
  const near = farThreat({
      mine: 1,
      theirs: 4,
      seen: 1,
      livable: true,
      apart: 5,
      people: 1e9,
      cohesion: 0.5,
    }),
    far = farThreat({
      mine: 4,
      theirs: 1,
      seen: 0.5,
      livable: false,
      apart: 60,
      people: 1e9,
      cohesion: 0.5,
    });
  assert.ok(near.level > 0.4, `near ${near.level}`);
  assert.ok(far.level < 0.1, `far ${far.level}`);
  // (Threatened and weaker, a side meets the other in fear more than in war.)
  const leans = meetingLeans({
    threat: near,
    gain: farGain(
      { know: 5, made: 2000, rung: 5, fed: 1 },
      { know: 7.5, made: 9000, rung: 7, fed: 1.1 },
    ),
    curious: 0.5,
    wary: 0.5,
    bold: 0.5,
    trading: 0.5,
    speak: true,
    pressed: 0,
    omen: false,
  });
  assert.ok(leans[1] > leans[3], `fear ${leans[1]} war ${leans[3]}`);
});

test("what passes between two peoples is what the taker lacks: knowledge from those ahead, goods to the short", () => {
  const ahead = { know: 7.6, made: 9000, rung: 7, fed: 1.1 },
    behind = { know: 5.2, made: 2500, rung: 5, fed: 1 };
  let know = 0;
  for (let i = 0; i < 100; i++) if (farPasses(ahead, behind, i / 100) === "knowledge") know++;
  assert.ok(know > 50, `knowledge ${know} of 100`);
  assert.equal(farPasses(behind, ahead, 0.1), "ways");
  assert.ok(
    farDearness({ made: 1000, fed: 1, broken: false }).dear >
      farDearness({ made: 9000, fed: 1, broken: false }).dear,
  );
});

test("a crowded hungry people goes to war for ground; a weary one hardly at all", () => {
  const mine = { fed: 0.8, made: 6000, rung: 7, war: 0, cohesion: 0.7, broken: false };
  const fresh = warAim({ mine, crowded: true, threat: 0.1, gain: 0, theirLivable: true }),
    tired = warAim({
      mine: { ...mine, war: 0.9 },
      crowded: true,
      threat: 0.1,
      gain: 0,
      theirLivable: true,
    });
  assert.equal(fresh.aim, "ground");
  assert.ok(tired.will < fresh.will / 3);
});

test("a landing that brings a sickness never met takes most of a people of cities, a band of one in camps", () => {
  const cities: FarState = { ...farBegins(EARTH, 1e8), rung: 3, top: 3, know: 3.5 },
    camps: FarState = { ...farBegins(EARTH, 5000) },
    r = {
      fieldDead: 0.5,
      fielded: 0.01,
      sickShare: 0.8,
      won: true,
      stay: true,
      comersKnow: 7,
      comersStrength: 2,
    };
  assert.ok(landed(cities, r).people < 0.4 * cities.people);
  assert.ok(landed(camps, r).people > 0.85 * camps.people);
  assert.ok(landed(cities, r).know > cities.know, "they learn of those who stay");
  assert.ok(landed(cities, r).fear > 0.5);
});

// —— As history keeps it (sim/space/farlife-store.ts, farlife-read.ts) ————————————————————————————————

const rowOf = (s: FarState): FarRow => ({
  ref: "civ:1:2" as FarRow["ref"],
  followed: false,
  since: 0,
  last: 0,
  s: pack(s),
  fell: s.fell,
  fearOf: null,
  ring: [],
  told: [],
  broke: null,
  rungs: [0, s.rung],
  why: null,
});

test("a far people's numbers kept whole come back as they were, to a thousandth", () => {
  const s = lived(EARTH, 900).end,
    back = unpack(rowOf(s));
  assert.equal(back.rung, s.rung);
  assert.equal(back.broken, s.broken);
  assert.ok(Math.abs(back.people - s.people) <= 1);
  assert.ok(Math.abs(back.cohesion - s.cohesion) <= 0.001);
  assert.ok(Math.abs(back.know - s.know) <= 0.001);
  assert.ok(Math.abs(back.fuel - s.fuel) <= 1e-6);
});

test("its samples stay within their bound, the far past the thinner, the latest kept", () => {
  const row = rowOf(farBegins(EARTH));
  for (let y = 0; y < 2000; y += 10) sampleInto(row, y, farBegins(EARTH));
  const ring = ringOf(row);
  assert.ok(ring.length <= FAR_RING, `${ring.length}`);
  assert.equal(ring.at(-1)!.year, 1990);
  assert.equal(ring[0]!.year, 0);
});

test("its rung's changes are kept in order, and read back as stages", () => {
  const row = rowOf(farBegins(EARTH));
  rungInto(row, 100, 1);
  rungInto(row, 110, 1);
  rungInto(row, 300, 2);
  assert.deepEqual(row.rungs, [0, 0, 100, 1, 300, 2]);
  assert.equal(stageByRungs(row.rungs, null, 50), "camps");
  assert.equal(stageByRungs(row.rungs, null, 299), "villages");
  assert.equal(stageByRungs(row.rungs, null, 400), "towns");
  assert.equal(stageByRungs(row.rungs, 350, 400), "ruins");
  assert.equal(topByRungs(row.rungs, 349), 2);
});

test("a reading asked of a past year reads what it read going on to it", () => {
  const r = beginReading(EARTH, -500, null);
  readOn(r, 1500);
  const later = readAt(r, 1500),
    past = readAt(r, 700),
    again = beginReading(EARTH, -500, null);
  readOn(again, 700);
  assert.equal(past.rung, again.state.rung);
  assert.ok(Math.abs(past.people - again.state.people) < 1e-6 * again.state.people + 1);
  assert.ok(later.know >= past.know);
  assert.ok(r.rungs.length >= 4, "it climbed");
});

test("a followed people's rung is history's, and it breaks rather than falls", () => {
  const s = { ...farBegins(EARTH, 1e9), peak: 1e9, top: 5 },
    fallen = { ...s, people: 0, fell: 900 },
    held = heldTo(s, fallen, 6);
  assert.equal(held.fell, null);
  assert.equal(held.rung, 6);
  assert.ok(held.people >= 0.2 * s.peak);
});
