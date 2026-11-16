// Strife reads how wealth is held, what is owed to strangers and the leanest month, each continuously; and what a
// rising or a coup leaves is what those who rose would have, by their sway.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
  type SimTime,
  type World,
} from "../../src/kernel/index.ts";
import { HOLD } from "../../src/rules/index.ts";

/** Wants as groups might have learned them (sim/order/wants.ts): a stand-in, so that the reading of them is tested alone. */
const LEARNED: Readonly<Record<string, readonly number[]>> = {
  farmers: [0.3, 0.6, 0.6, 0.5],
  herders: [0.2, 0.5, 0.6, 0.4],
  crafters: [0.5, 0.75, 0.8, 0.6],
  traders: [0.6, 0.75, 0.9, 0.9],
  "the court": [0.85, 0.1, 0.25, 0.5],
};
const learned = (g: string) => LEARNED[g] ?? null;
import {
  ASSEMBLY_WANTED,
  GENERAL,
  STRAIN,
  coupDanger,
  financeOf,
  holdsOf,
  interestsOf,
  makePopulationWorld,
  orderOf,
  politiesOf,
  populationContext,
  revolt,
  revolutionDanger,
  seize,
  strainOf,
  wantsOf,
  wantsOfRisen,
  type Interest,
  type Polity,
} from "../../src/sim/index.ts";
import { peopledWorld } from "../worlds.ts";

const seed = seedFromText("juniper"),
  build = (s = seed) => makePopulationWorld(s, { start: "spread" }),
  world = peopledWorld("juniper", 60, { start: "spread" }),
  RULESET = rulesetId(world, "test"),
  AS_IT_WAS = saveWorld(world, RULESET),
  fresh = () => loadWorld(AS_IT_WAS, build, RULESET).world,
  at = (k: number) => (60 * YEAR + k) as SimTime;
const greatest = (w: World): Polity => {
  const ctx = populationContext(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);
  return [...politiesOf(w).living()]
    .filter((p) => p.members.length >= 3)
    .sort((a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1))[0]!;
};
const group = (name: string, sway: number): Interest =>
  ({ group: name, sway, people: 100, demands: [] }) as unknown as Interest;
/** What a realm's groups have learned to want, as a rising reads it. */
const ofRealm = (w: World, realm: Ref) => (g: string) =>
  wantsOf(w)?.wantOf(realm, g) ?? holdsOf(w, realm);
const term = (factors: readonly { name: string; contribution: number }[], name: string) =>
  factors.find((f) => f.name === name)!.contribution;

test("what those who rose would have: their wants by their sway, those with no part in it left out", () => {
  const many = (g: string) => (g === "the court" || g === "the army" || g === "the temple" ? 0 : 1),
    tillers = wantsOfRisen(
      [group("farmers", 0.5), group("herders", 0.2), group("the court", 0.3)],
      many,
      learned,
    )!,
    makers = wantsOfRisen(
      [group("crafters", 0.3), group("traders", 0.4), group("the court", 0.3)],
      many,
      learned,
    )!;
  // The court's wants weigh nothing in a rising against it.
  assert.ok(Math.abs(tillers[HOLD.voice]! - (0.5 * 0.6 + 0.2 * 0.5) / 0.7) < 1e-12);
  // Those who till want less of a voice than those who make and trade: a council of elders, an assembly of all.
  assert.ok(tillers[HOLD.voice]! < ASSEMBLY_WANTED, `${tillers[HOLD.voice]}`);
  assert.ok(makers[HOLD.voice]! >= ASSEMBLY_WANTED, `${makers[HOLD.voice]}`);
  assert.ok(makers[HOLD.word]! > tillers[HOLD.word]!);
  // One group alone: its own wants, to the number.
  wantsOfRisen([group("traders", 0.2)], many, learned)!.forEach((x, k) =>
    assert.ok(Math.abs(x - LEARNED.traders![k]!) < 1e-12, `${k}`),
  );
  // No one of them with any sway: nothing to read.
  assert.equal(wantsOfRisen([group("the court", 1)], many, learned), null);
  // (Nor where none of them has learned to want anything.)
  assert.equal(
    wantsOfRisen([group("traders", 1)], many, () => null),
    null,
  );
});

test("the lean month, wealth in few hands and debt owed to strangers each weigh in both sums, by how much there is of each", () => {
  const w = fresh(),
    ctx = populationContext(w),
    p = greatest(w),
    o = orderOf(w)!.of(p.ref)!,
    seat = ctx.provinces.get(p.seat)!,
    scores = () => ({ coup: coupDanger(ctx, p, o), rising: revolutionDanger(ctx, p, o) });
  // The leanest month of the year at the seat, however short of a famine: more of it, more danger, smoothly.
  let was = { coup: -Infinity, rising: -Infinity };
  for (const fed of [1000, 950, 850, 700, 400]) {
    seat.leanest = fed;
    const s = strainOf(ctx, p),
      now = scores();
    assert.ok(Math.abs(s.lean - (1 - fed / 1000)) < 1e-12);
    assert.ok(
      Math.abs(term(now.coup.factors, "a lean month at the seat") - STRAIN.coup.lean * s.lean) <
        1e-12,
    );
    assert.ok(
      Math.abs(term(now.rising.factors, "a lean month at the seat") - STRAIN.rising.lean * s.lean) <
        1e-12,
    );
    assert.ok(now.coup.score >= was.coup && now.rising.score >= was.rising, `fed ${fed}`);
    was = { coup: now.coup.score, rising: now.rising.score };
  }
  seat.leanest = 1000;
  // How its wealth is held: about the middle, so a realm with nothing kept of its money reads as before.
  const money = financeOf(w)?.of(p.ref);
  if (money) {
    money.own[0] = 50;
    const mid = scores();
    assert.equal(term(mid.rising.factors, "wealth in few hands"), 0);
    money.own[0] = 10;
    const few = scores();
    money.own[0] = 90;
    const wide = scores();
    assert.ok(few.rising.score > mid.rising.score && mid.rising.score > wide.rising.score);
    assert.ok(few.coup.score > wide.coup.score);
    assert.ok(
      Math.abs(term(few.rising.factors, "wealth in few hands") - STRAIN.rising.few * 0.4) < 1e-12,
    );
    // What it owes to strangers, by their share of all it owes.
    money.own[0] = 50;
    money.home = 300;
    money.held = [];
    const own = scores();
    money.held = [[p.ref, 100]];
    const owed = scores();
    assert.ok(Math.abs(strainOf(ctx, p).abroad - 0.25) < 1e-12);
    assert.ok(owed.rising.score > own.rising.score && owed.coup.score > own.coup.score);
  }
  assert.ok(money, "a realm of sixty years keeps its money");
});

test("a rising leaves what those who rose would have: an assembly or a council, its holds theirs", () => {
  const w = fresh(),
    ctx = populationContext(w),
    p = greatest(w),
    o = orderOf(w)!.of(p.ref)!,
    many = (g: string) => (g === "the court" || g === "the army" || g === "the temple" ? 0 : 1),
    wants = wantsOfRisen(interestsOf(ctx, p, at(1)), many, ofRealm(w, p.ref))!,
    before = holdsOf(w, p.ref);
  w.runTo(at(1));
  revolt(ctx, p, "voice", [], at(1));
  assert.equal(p.leadership, wants[HOLD.voice]! >= ASSEMBLY_WANTED ? 2 : 1);
  const after = holdsOf(w, p.ref);
  // Its choices and its word never less than they were, and at the least what those who rose want of them.
  for (const h of ["voice", "word"] as const) {
    assert.ok(after[HOLD[h]]! >= before[HOLD[h]]! - 1e-9, h);
    assert.ok(
      after[HOLD[h]]! >= wants[HOLD[h]]! - 0.005,
      `${h}: ${after[HOLD[h]]} of ${wants[HOLD[h]]}`,
    );
  }
  assert.ok(after[HOLD.force]! <= Math.max(before[HOLD.force]!, wants[HOLD.force]!) + 0.005);
  void o;
});

test("a coup leaves a general, holding as the army and those behind it would", () => {
  const w = fresh(),
    ctx = populationContext(w),
    p = greatest(w),
    stood = (g: string) => (g === "the army" ? 1 : g === "the court" ? 0 : 0.5),
    wants = wantsOfRisen(interestsOf(ctx, p, at(1)), stood, ofRealm(w, p.ref))!;
  w.runTo(at(1));
  seize(ctx, p, [], at(1));
  assert.equal(p.leadership, GENERAL);
  const after = holdsOf(w, p.ref);
  // Never more of a voice than a seat taken by the sword gives, nor fewer arms kept to the host.
  assert.ok(after[HOLD.voice]! <= 0.3 + 1e-9);
  assert.ok(after[HOLD.force]! >= 0.6 - 1e-9);
  assert.ok(after[HOLD.voice]! <= Math.max(0.3, wants[HOLD.voice]!));
});
