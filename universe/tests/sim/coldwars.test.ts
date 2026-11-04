// Wars gone cold (sim/war/coldwars.ts): a world whose wars go into blocks as soon as they may runs
// bit for bit as one whose wars never do, and every battle reads back as it was fought, its
// exchanges given again by the rules. And what history the world keeps says so too.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Hasher,
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../../src/kernel/index.ts";
import {
  resolveCombat,
  sideWounds,
  type CombatRecord,
  type CombatSide,
} from "../../src/rules/index.ts";
import { makePopulationWorld, warsOf } from "../../src/sim/index.ts";
import {
  fellAgainstLast,
  fellFromLast,
  menAgainst,
  menOfKept,
} from "../../src/sim/war/coldwars.ts";

const seed = seedFromText("first light"),
  build = (every?: number): World => {
    const world = makePopulationWorld(seed, { start: "spread" });
    if (every) warsOf(world).coldBattles = every;
    else warsOf(world).coldBattles = Number.MAX_SAFE_INTEGER;
    return world;
  };

const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

/** A battle with its strengths taken out: what a block keeps of them is what gives the same exchanges. */
function butStrengths(b: { combat?: CombatRecord }): unknown {
  const { combat, ...rest } = plain(b) as { combat?: CombatRecord };
  if (!combat) return rest;
  const { power, ...more } = combat;
  void power;
  return { ...rest, combat: more };
}

test("a side's men kept against its realm's last come back to the man, however its lands change", () => {
  let x = 12345;
  const next = (n: number) => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x % n;
  };
  for (let round = 0; round < 500; round++) {
    const lands = 1 + next(40),
      was = new Map<number, number>();
    let wasAll = 0;
    for (let k = 0; k < lands; k++) {
      const men = next(3) === 0 ? next(9) : next(60_000);
      was.set(next(90), men);
    }
    for (const n of was.values()) wasAll += n;
    const cells = [...was.keys()].filter(() => next(5) > 0);
    for (let k = next(4); k > 0; k--) if (!was.has(100 + k)) cells.push(100 + k);
    const scale = 0.5 + next(1000) / 1000,
      men = cells.map((c) =>
        Math.max(0, Math.round((was.get(c) ?? next(5000)) * scale) + next(7) - 3),
      ),
      kept = menAgainst(cells, men, was, wasAll);
    assert.deepEqual(menOfKept(cells, kept, was, wasAll), men);
  }
  // A levy that falls by one share on every land leaves next to nothing to keep.
  const was = new Map([
      [1, 24201],
      [2, 12418],
      [3, 7046],
      [4, 21165],
    ]),
    kept = menAgainst([1, 2, 3, 4], [24160, 12397, 7034, 21129], was, 64830);
  assert.deepEqual(kept.slice(0, 3), [0, 0, 0]);
  assert.equal(kept[3], 64720 - 64830);
});

test("warm battles' tallies kept against each realm's last come back as they were, what is held untouched", () => {
  let x = 777;
  const next = (n: number) => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x % n;
  };
  const side = () => {
    const cell = [...new Set(Array.from({ length: next(7) }, () => next(12)))],
      sent = cell.map(() => (next(9) === 0 ? 0 : next(90_000) + (next(40) === 0 ? 0.5 : 0)));
    return {
      cell,
      sent,
      ...(next(5) === 0 ? { dead: cell.map(() => next(100)) } : {}),
      towns: cell.map(() =>
        next(3) === 0 ? null : Array.from({ length: next(4) }, () => next(900)),
      ),
    };
  };
  const wars = Array.from({ length: 60 }, () => ({
    attacker: `pol:0:${next(5)}`,
    defender: `pol:0:${next(5)}`,
    battles: Array.from({ length: next(6) }, () =>
      next(6) === 0
        ? { year: next(30), fell: "whole" }
        : { year: next(30), fellColumns: [side(), side()] as const },
    ),
  }));
  const held = JSON.stringify(wars),
    kept = fellAgainstLast(wars);
  assert.equal(JSON.stringify(wars), held, "the warm themselves are not touched");
  assert.ok(JSON.stringify(kept) !== held);
  const saved = plain(kept) as typeof wars,
    savedText = JSON.stringify(saved);
  assert.deepEqual(plain(fellFromLast(saved)), plain(wars));
  assert.equal(JSON.stringify(saved), savedText, "nor what a save holds, loaded again from it");
});

test("wars gone cold run on as wars never put away, and read back as they were fought", () => {
  const warm = build(),
    cold = build(4);
  warm.runTo(130 * YEAR);
  cold.runTo(130 * YEAR);
  assert.deepEqual(
    cold.checkpoints().map((c) => c.chain),
    warm.checkpoints().map((c) => c.chain),
    "the same history",
  );
  const a = warsOf(cold).all(),
    b = warsOf(warm).all();
  assert.equal(a.length, b.length);
  const gone = warsOf(cold).all().length - warsOf(cold).hot().length;
  assert.ok(gone > 5, `${gone} wars gone cold`);
  assert.equal(warsOf(warm).all().length, warsOf(warm).hot().length, "and none in the other");
  for (let k = 0; k < a.length; k++) {
    const x = a[k]!,
      y = b[k]!;
    assert.equal(x.ref, y.ref);
    assert.equal(x.attacker, y.attacker);
    assert.equal(x.defender, y.defender);
    assert.equal(x.event, y.event);
    assert.equal(x.peace, y.peace);
    assert.equal(x.ended, y.ended);
    assert.deepEqual(x.fallen, y.fallen);
    assert.equal(x.battles.length, y.battles.length);
    assert.equal(x.civil, y.civil);
    assert.equal(x.embargo, y.embargo);
    for (let j = 0; j < x.battles.length; j++) {
      const p = x.battles[j]!,
        q = y.battles[j]!;
      assert.deepEqual(butStrengths(p), butStrengths(q));
      if (q.combat?.power[0] && q.combat.power[1]) {
        // How the two stood to each other, and about how great they were.
        const [a, c] = p.combat!.power,
          [e, f] = q.combat.power;
        assert.ok(Math.abs(a / c / (e / f) - 1) <= 1e-3, `${a}/${c} against ${e}/${f}`);
        assert.ok(Math.abs(c / f - 1) <= 0.06, `${c} against ${f}`);
      }
    }
  }
  // A battle found by its event, as the pages find one, from among the cold.
  const old = a.find((w) => warsOf(cold).hot().indexOf(w) < 0 && w.battles.length > 0)!,
    battle = old.battles[0]!,
    found = warsOf(cold).battleBy(battle.event)!;
  assert.equal(found.war.ref, old.ref);
  assert.equal(found.k, 0);
  assert.deepEqual(plain(found.b), plain(battle));
  assert.deepEqual(
    warsOf(cold)
      .battlesIn(battle.year, battle.year + 1)
      .map((f) => f.b.event),
    warsOf(warm)
      .battlesIn(battle.year, battle.year + 1)
      .map((f) => f.b.event),
    "the battles of a year, in the order of their wars",
  );
  // Each hold on history stays: the two reckon alike.
  assert.deepEqual(cold.domainHashes(), warm.domainHashes());
});

test("a save of wars gone cold loads whole, and runs on as the world it came from", () => {
  const warm = build(),
    cold = build(4);
  warm.runTo(120 * YEAR);
  cold.runTo(120 * YEAR);
  const ruleset = rulesetId(cold, "cold"),
    doc = JSON.parse(JSON.stringify(saveWorld(cold, ruleset))) as ReturnType<typeof saveWorld>;
  const { world } = loadWorld(doc, () => build(4), ruleset);
  assert.deepEqual(world.domainHashes(), cold.domainHashes());
  assert.deepEqual(plain(warsOf(world).all()), plain(warsOf(cold).all()));
  world.runTo(130 * YEAR);
  warm.runTo(130 * YEAR);
  assert.deepEqual(
    world.checkpoints().map((c) => c.chain),
    warm.checkpoints().map((c) => c.chain),
  );
  // (A save from before Phase 63, every war in it warm, takes up as these do.)
  const old = saveWorld(warm, ruleset),
    { world: later } = loadWorld(JSON.parse(JSON.stringify(old)), () => build(4), ruleset);
  later.runTo(150 * YEAR);
  warm.runTo(150 * YEAR);
  assert.ok(warsOf(later).hot().length < warsOf(later).all().length, "they go cold in turn");
  assert.deepEqual(later.domainHashes(), warm.domainHashes());
});

test("the exchanges of a battle are what model 2 says they were", () => {
  // A battle's exchanges and wounded are not kept once it is cold: what it reads back is what these
  // rules give. A change here must leave old battles as they were fought: a new model beside this
  // one, chosen by the battle's `combat.model`, and this digest left as it is.
  const side = (fielded: number, power: number, more: Partial<CombatSide>): CombatSide => ({
      fielded,
      power,
      shock: 0.3,
      protection: 0.2,
      fire: 0,
      range: 0.1,
      care: 0.4,
      blow: "edge",
      ...more,
    }),
    draw = (round: number, s: number) => (Math.imul(round * 2 + s + 7, 2654435761) >>> 0) / 2 ** 32,
    h = new Hasher();
  for (const [a, b] of [
    [side(800, 1000, {}), side(700, 1400, { blow: "point" })],
    [side(120, 90, { shock: 1.2, fire: 0.5, range: 1.5 }), side(4000, 2500, { protection: 0.8 })],
    [side(3000, 12000, { fire: 2, range: 2 }), side(2800, 11000, { fire: 2, range: 2 })],
    [side(0, 0, {}), side(10, 5, {})],
  ] as const)
    h.value(resolveCombat([a, b], 70, draw));
  assert.equal(h.hex(), "78a3992317ef8a12");
  const hurt = new Hasher();
  for (const [fallen, field, blow, shock, protection, care] of [
    [90, 800, "edge", 0.3, 0.2, 0.4],
    [700, 900, "point", 1.2, 0.8, 0],
    [1, 2, "edge", 0, 0, 1],
    [0, 400, "edge", 0.5, 0.1, 0.5],
  ] as const)
    hurt.value(sideWounds(fallen, field, { blow, shock, protection, care, size: 70 }));
  assert.equal(hurt.hex(), "15d83dc03632e696");
});
