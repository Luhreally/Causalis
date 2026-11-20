// A meeting of fleets laid out (view/seafight.ts), a siege's works (view/siegeworks.ts) and a hired company's block in a
// battle (view/battle.ts): what the eye draws follows what history says, the same each time.
import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  BattleNear,
  BattleSideNear,
  SeaFightNear,
  SeaFightSide,
} from "../../src/bridge/index.ts";
import {
  SEA_LENGTH,
  SEA_MOMENTS,
  SEA_SINKS,
  SIEGE_WORKS,
  newBattle,
  newSeaFight,
  seaHullAt,
  seaTally,
  seaWords,
  siegeWords,
  siegeWorks,
  type SeaHullNow,
} from "../../src/view/index.ts";

const fleet = (name: string, over: Partial<SeaFightSide>): SeaFightSide => ({
  ref: `pol:0:${name}`,
  name: `the league of ${name}`,
  color: [0.8, 0.2, 0.2],
  tons: 30000,
  sunk: 3000,
  flagship: `${name}'s Pride`,
  flagLost: false,
  led: null,
  ledRef: null,
  rig: "tall",
  guns: true,
  ships: "tall ships that keep the sea, with guns",
  ...over,
});
const meeting = (a: Partial<SeaFightSide>, b: Partial<SeaFightSide>, won: 0 | 1): SeaFightNear => ({
  event: "ev:0:77",
  war: "war:0:3",
  title: "The fleets meet",
  year: 900,
  cell: 4,
  off: "Test's land",
  sides: [fleet("Aa", a), fleet("Bb", b)],
  won,
  kind: "rocky",
});
const now = (): SeaHullNow => ({ x: 0, z: 0, yaw: 0, sunk: 0, tip: 0, fired: -1 });

test("each fleet is as many hulls as its tonnes make of the ships its wrights build, at most the most", () => {
  const f = newSeaFight(
    meeting({ tons: 30000, rig: "tall" }, { tons: 2400, rig: "planked", sunk: 1200 }, 0),
    20,
  );
  // (30,000 t of tall ships at 1,500 t: 20 hulls; 2,400 t of planked at 300: 8.)
  assert.deepEqual(f.drawn, [20, 8]);
  assert.deepEqual(f.per, [1, 1]);
  const many = newSeaFight(meeting({ tons: 600000 }, {}, 0), 20);
  assert.equal(many.drawn[0], 20);
  assert.equal(many.per[0], 20);
  // One flagship a side that has one, and she is the longest of her line.
  for (const side of [0, 1]) {
    const mine = f.hulls.filter((h) => h.side === side),
      flags = mine.filter((h) => h.flag);
    assert.equal(flags.length, 1);
    assert.ok(mine.every((h) => h.flag || h.long < flags[0]!.long));
  }
});

test("as many hulls go down as history's share of its tonnes; the flagship only where history lost her", () => {
  const f = newSeaFight(
    meeting({ tons: 30000, sunk: 3000 }, { tons: 30000, sunk: 15000, flagLost: true }, 0),
    20,
  );
  assert.deepEqual(f.down, [2, 10]);
  assert.ok(!f.hulls.find((h) => h.side === 0 && h.flag)!.sinks);
  const lost = f.hulls.find((h) => h.side === 1 && h.flag)!;
  assert.ok(lost.sinks !== null && lost.sinks > SEA_MOMENTS.meet && lost.sinks < SEA_MOMENTS.part);
  // By the end the tally is history's tonnes, and nothing went down before the lines met.
  assert.deepEqual(seaTally(f, SEA_LENGTH).tons, [3000, 15000]);
  assert.deepEqual(seaTally(f, SEA_MOMENTS.meet).gone, [0, 0]);
  // A hull gone down is gone; one that comes through never settles.
  for (const h of f.hulls) {
    const end = seaHullAt(f, h, SEA_LENGTH, now());
    assert.equal(end.sunk, h.sinks === null ? 0 : 1);
    if (h.sinks !== null) assert.ok(seaHullAt(f, h, h.sinks + SEA_SINKS / 2, now()).sunk > 0.3);
  }
});

test("the lines pass each other, guns speak only where a side has them, and the beaten bear away", () => {
  const f = newSeaFight(meeting({ guns: true }, { guns: false, rig: "oared", tons: 1600 }, 0), 20),
    a = f.hulls.find((h) => h.side === 0 && h.flag)!,
    b = f.hulls.find((h) => h.side === 1 && h.flag)!;
  const a0 = seaHullAt(f, a, 0, now()).x,
    a1 = seaHullAt(f, a, SEA_MOMENTS.part, now()).x,
    b0 = seaHullAt(f, b, 0, now()).x,
    b1 = seaHullAt(f, b, SEA_MOMENTS.part, now()).x;
  assert.ok(a0 < 0 && a1 > 0 && b0 > 0 && b1 < 0, "each line crosses the middle on its own course");
  let fired = [0, 0];
  for (let s = 0; s <= SEA_LENGTH; s += 0.5)
    for (const h of f.hulls) if (seaHullAt(f, h, s, now()).fired >= 0) fired[h.side]!++;
  assert.ok(fired[0]! > 0);
  assert.equal(fired[1], 0);
  // After: the beaten stand further off from the sea they lost than they passed at.
  const off = Math.abs(seaHullAt(f, b, SEA_LENGTH, now()).z),
    passed = Math.abs(seaHullAt(f, b, SEA_MOMENTS.part, now()).z);
  assert.ok(off > passed + 3);
  assert.match(
    seaWords(f, SEA_LENGTH),
    /the league of Bb bears away, and the league of Aa holds the sea/,
  );
  // The same meeting lays out the same.
  assert.deepEqual(newSeaFight(f.near, 20).hulls, f.hulls);
});

test("a siege's works: a bank on the dry ground, approaches nearer each year, rubble as the walls are open", () => {
  const state = { since: 500, months: 9, breach: 0, dead: 0, years: 0 },
    arc = { from: 0.2, span: 2.5 },
    // (Its walls' line no circle: nearer on one side of the approach than the other.)
    wall = (a: number) => 60 + 8 * Math.sin(a * 3),
    early = siegeWorks(7, arc, 120, wall, state, false),
    late = siegeWorks(7, arc, 120, wall, { ...state, years: 2, breach: 0.5, months: 2 }, true);
  assert.ok(early.banks.length >= 3 && early.banks.length <= SIEGE_WORKS.banks);
  // Every length of bank lies on the dry arc, at about the ring.
  for (const b of early.banks) {
    const a = Math.atan2(b.z, b.x),
      r = Math.hypot(b.x, b.z);
    assert.ok(a > arc.from - 1e-6 && a < arc.from + arc.span + 1e-6);
    assert.ok(Math.abs(r - 120) < 3);
  }
  assert.equal(early.rubble.length, 0);
  assert.equal(early.breachAt, null);
  assert.equal(late.rubble.length, Math.round(0.5 * SIEGE_WORKS.rubble));
  assert.ok(late.breachAt);
  // The approaches' heads are nearer the walls once it has stood and the walls have opened; never past them.
  const head = (w: typeof early) => Math.min(...w.saps.map((s) => Math.hypot(s.x, s.z)));
  assert.ok(head(late) < head(early));
  for (const s of late.saps) {
    const a = Math.atan2(s.z, s.x);
    assert.ok(Math.hypot(s.x, s.z) > wall(a), "an approach past the walls");
  }
  // The walls' rubble and the middle of the breach lie on the walls' own line, wherever it runs; what they throw with
  // stands between it and their bank.
  for (const h of late.rubble) {
    const a = Math.atan2(h.z, h.x);
    assert.ok(Math.abs(Math.hypot(h.x, h.z) - wall(a)) < 3.5, "rubble off the walls' line");
  }
  const at = late.breachAt!,
    mid = Math.atan2(at.z, at.x);
  assert.ok(Math.abs(Math.hypot(at.x, at.z) - wall(mid)) < 1e-6);
  for (const e of [...early.engines, ...late.engines]) {
    const a = Math.atan2(e.z, e.x),
      r = Math.hypot(e.x, e.z);
    assert.ok(r > wall(a) + 5 && r < 120, `what they throw with at ${r}`);
  }
  assert.ok(late.guns && !early.guns);
  assert.equal(
    siegeWords({ ...state, months: 2, breach: 0.5, dead: 1200 }),
    "besieged since year 500: 2 months of stores left, its walls 50% open, 1,200 dead of it in camp and town",
  );
  assert.match(siegeWords({ ...state, months: 0, breach: 1 }), /its stores gone, its walls open/);
});

test("a hired company stands as its own block at its host's flank, under one banner of its own", () => {
  const side = (name: string, over: Partial<BattleSideNear> = {}): BattleSideNear => ({
      ref: `realm:${name}`,
      name: `the realm of ${name}`,
      color: [0.8, 0.2, 0.2],
      arms: null,
      fielded: 6000,
      fallen: 600,
      host: { arm: "spear", guard: "shield", mount: "" },
      kit: "spears and hide shields, on foot",
      ...over,
    }),
    near = (a: BattleSideNear, d: BattleSideNear): BattleNear => ({
      event: "ev:0:9",
      war: "war:1",
      title: "The battle at the test land",
      cell: 1,
      land: "the test land",
      year: 400,
      attacker: a,
      defender: d,
      won: true,
      outcome: "field",
      civil: null,
      hills: false,
      river: false,
      walls: 0,
      town: null,
      figure: null,
      plan: { seed: "t", ages: [], lineages: [] } as unknown as BattleNear["plan"],
    }),
    plain = newBattle(near(side("Aa"), side("Bb", { color: [0.2, 0.2, 0.8] })), 240),
    hired = newBattle(
      near(
        side("Aa", { company: { name: "Fairmere", men: 1500 } }),
        side("Bb", { color: [0.2, 0.2, 0.8] }),
      ),
      240,
    );
  assert.equal(plain.company, undefined);
  const co = hired.company?.[0];
  assert.ok(co && !hired.company?.[1]);
  const h = hired.hosts[0];
  // A quarter of the host's men: about a quarter of its files, at its flank.
  assert.equal(co.from + co.files, h.files);
  assert.ok(Math.abs(co.files / h.files - 0.25) < 0.08);
  assert.equal(co.bearers.size, 1);
  const mine = hired.troopers.filter((t) => t.side === 0),
    block = mine.filter((t) => t.file >= co.from),
    rest = mine.filter((t) => t.file < co.from);
  // Its one banner is among its own files; no other bearer stands in its block; it stands off its payer's host.
  assert.deepEqual(
    block.filter((t) => t.bearer).map((t) => t.id),
    [...co.bearers],
  );
  const edge = Math.max(...rest.filter((t) => t.rank === 0).map((t) => t.z)),
    first = Math.min(...block.filter((t) => t.rank === 0).map((t) => t.z)),
    usual = mine[1]!.z - mine[0]!.z;
  assert.ok(first - edge > Math.abs(usual) * 1.5, "a gap between the host and its company");
  // As many figures as without it: the company is of the host's count, not added to it.
  assert.equal(hired.troopers.length, plain.troopers.length);
  // Its colour is its own.
  const far = (c: readonly number[], o: readonly number[]) =>
    Math.hypot(c[0]! - o[0]!, c[1]! - o[1]!, c[2]! - o[2]!);
  assert.ok(far(co.color, [0.8, 0.2, 0.2]) > 0.4 && far(co.color, [0.2, 0.2, 0.8]) > 0.4);
});
