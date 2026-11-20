import { test } from "node:test";
import assert from "node:assert/strict";
import { packList, unpackList, type Ref } from "../../src/kernel/index.ts";
import { EFFECTS, PRINCIPLES, PRINCIPLE_INDEX, principle } from "../../src/rules/index.ts";
import {
  LORE_EVENTS,
  LoreStore,
  knows,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

test("the tree of principles is whole: every need exists, and each step has a way in from nothing", () => {
  for (const p of PRINCIPLES)
    for (const n of p.needs)
      for (const alt of n.split("|")) {
        assert.ok(PRINCIPLE_INDEX.has(alt), `${alt} exists`);
        assert.notEqual(alt, p.id, `${p.id} does not need itself`);
      }
  // (A need "a|b" is met by either, so a road may loop back past a step, as steel by oxygen made by current
  // does, so long as another way in stands outside the loop: from nothing, every step is reached.)
  const known = new Set<string>();
  for (let moved = true; moved;) {
    moved = false;
    for (const p of PRINCIPLES)
      if (!known.has(p.id) && p.needs.every((n) => n.split("|").some((alt) => known.has(alt)))) {
        known.add(p.id);
        moved = true;
      }
  }
  assert.deepEqual(
    PRINCIPLES.filter((p) => !known.has(p.id)).map((p) => p.id),
    [],
  );
  assert.ok(PRINCIPLES.length >= 50);
});

const world = peopledWorld("first light", 300, { start: "spread" });
const ctx = populationContext(world),
  lore = loreOf(world);

test("a land comes to know a principle only after what it needs", () => {
  let checked = 0;
  for (const p of ctx.provinces.all()) {
    const when = new Map(lore.of(p.cell).map(([id, k]) => [id, k.year]));
    for (const [id, year] of when)
      for (const need of principle(id).needs) {
        // (A need of alternatives, "a|b", is met by any one of them: Phase 56.)
        const ways = need.split("|"),
          roots = ways.filter((n) => n === "cultivation" || n === "metalworking");
        if (roots.length === ways.length) {
          assert.ok(
            ways.some((n) => knows(ctx, p.cell, n)),
            `${id} in ${p.cell} needs ${need}`,
          );
          continue;
        }
        if (roots.some((n) => knows(ctx, p.cell, n))) continue;
        const met = Math.min(...ways.map((n) => when.get(n) ?? Infinity));
        assert.ok(met <= year, `${id} in ${p.cell} came before ${need}`);
        checked++;
      }
  }
  assert.ok(checked > 50, `${checked} needs checked`);
});

test("finding cites who found it and what the land held; learning cites the neighbour and the road", () => {
  const found = world.events.all().filter((e) => e.type === LORE_EVENTS.found.type);
  assert.ok(found.length >= 10, `${found.length} findings`);
  for (const e of found.slice(0, 15)) {
    const d = world.decisions.get(e.causes[0]!.ref as Ref)!;
    // (What only being there teaches is found by having seen it, K1: lost.ts's own rule.)
    assert.ok(["lore.find", "lore.see"].includes(d.rule), d.rule);
    if (d.rule === "lore.see") continue;
    const id = (e.data as { principle: string }).principle,
      ore = principle(id).drivers.ore;
    if (ore)
      assert.ok(
        d.factors.some((f) => f.name === `${ore} within reach` && f.source),
        `${id} cites its ${ore}`,
      );
  }
  const markets = marketsOf(world),
    learned = world.events.all().filter((e) => e.type === LORE_EVENTS.learned.type);
  assert.ok(learned.length >= 20);
  for (const e of learned.slice(0, 30)) {
    const from = world.events.get(e.causes[0]!.ref as Ref);
    assert.ok(
      from && (from.type === LORE_EVENTS.found.type || from.type === LORE_EVENTS.learned.type),
    );
    if (e.causes[1]) assert.ok(markets.allRoutes().some(([, r]) => r === e.causes[1]!.ref));
  }
  assert.match(why(world, found[0]!.id).claim, /^In the .* people came upon .*, year \d+$/);
});

test("what a land knows sums into what it can do", () => {
  for (const p of ctx.provinces.all().slice(0, 20)) {
    const known = lore.of(p.cell).map(([id]) => principle(id));
    for (const e of EFFECTS) {
      const sum = known.reduce((s, k) => s + (k.effects[e] ?? 0), 0);
      assert.ok(Math.abs(lore.effect(p.cell, e) - sum) < 1e-9, `${e} in ${p.cell}`);
    }
  }
});

test("a land's totals come back from a save as they stood, in whatever order it learned", () => {
  // (Three principles of one effect whose sum depends on the order they are added in: the same numbers, another last place.)
  let found: { e: number; a: number; b: number; c: number } | null = null;
  for (let e = 0; e < EFFECTS.length && !found; e++) {
    const of = (i: number) => PRINCIPLES[i]!.effects[EFFECTS[e]!] ?? 0,
      has = PRINCIPLES.map((_, i) => i).filter((i) => of(i) !== 0);
    for (const a of has)
      for (const b of has)
        for (const c of has)
          if (!found && a !== b && a !== c && PRINCIPLES[b]!.id < PRINCIPLES[c]!.id)
            if (!Object.is(of(a) + of(b) + of(c), of(a) + of(c) + of(b))) found = { e, a, b, c };
  }
  assert.ok(found, "some three principles' effects sum otherwise in another order");
  const [a, b, c] = [found.a, found.b, found.c].map((i) => PRINCIPLES[i]!),
    event = "ev:0:1" as Ref,
    live = new LoreStore();
  // (Learned the later of a year's two first: a save keeps a year's in the order of their names.)
  live.learn(7, a!.id, { year: 10, event }, a!);
  live.learn(7, c!.id, { year: 20, event }, c!);
  live.learn(7, b!.id, { year: 20, event }, b!);
  const totals = (s: LoreStore) => EFFECTS.map((e) => s.effect(7, e)),
    saved = unpackList(JSON.parse(JSON.stringify(packList([live.save()]))))[0] as {
      summed?: number[][];
    },
    back = new LoreStore();
  back.load(saved);
  assert.deepStrictEqual(totals(back), totals(live));
  assert.equal(saved.summed?.length, 1, "the one land whose totals loading would sum otherwise");
  // (A save from before kept none: its lands are summed in the order it keeps them, as they always were.)
  const old = new LoreStore();
  old.load({ ...saved, summed: undefined });
  assert.notDeepStrictEqual(totals(old), totals(live));
  // (And a land that learned in the order a save keeps is kept as it always was.)
  const plain = new LoreStore();
  plain.learn(7, a!.id, { year: 10, event }, a!);
  plain.learn(7, b!.id, { year: 20, event }, b!);
  plain.learn(7, c!.id, { year: 20, event }, c!);
  assert.equal((plain.save() as { summed?: unknown }).summed, undefined);
});

test("no realm rules by decree without writing at its seat", () => {
  for (const p of politiesOf(world).living())
    if (p.law === 1)
      assert.ok(lore.effect(p.seat, "writing") > 0, `${p.town} decrees without writing`);
});
