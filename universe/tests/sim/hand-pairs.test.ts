import { test } from "node:test";
import assert from "node:assert/strict";
import { pairUp, type Agent } from "../../src/sim/index.ts";
import { FEMALE, MALE } from "../../src/rules/index.ts";

/** Pairing as it was before Phase 60: each woman weighed against every man. */
function pairedOneByOne(agents: readonly Agent[], year: number, adulthood: number): void {
  const living = new Set(agents.map((a) => a.id)),
    alone = (a: Agent) => a.partner === undefined || !living.has(a.partner),
    grown = agents.filter((a) => year - a.birthYear >= adulthood),
    women = grown
      .filter((a) => a.sex === FEMALE && alone(a))
      .sort((a, b) => a.birthYear - b.birthYear || a.id - b.id),
    men = grown.filter((a) => a.sex === MALE && alone(a));
  for (const w of women) {
    let best: Agent | null = null;
    for (const m of men) {
      if (!alone(m)) continue;
      const gap = Math.abs(m.birthYear - w.birthYear);
      if (gap > 12) continue;
      if (
        !best ||
        gap < Math.abs(best.birthYear - w.birthYear) ||
        (gap === Math.abs(best.birthYear - w.birthYear) && m.id < best.id)
      )
        best = m;
    }
    if (best) {
      w.partner = best.id;
      best.partner = w.id;
    }
  }
}

/** A village's people by a seeded draw: ages, sexes, and some already paired (some widowed). */
function village(seed: number, n: number, fractional: boolean): Agent[] {
  let s = seed >>> 0;
  const u = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const out: Agent[] = [];
  for (let id = 0; id < n; id++) {
    const age = Math.floor(u() * 80) + (fractional && u() < 0.2 ? 0.5 : 0);
    out.push({
      id: n - id * 3,
      sex: u() < 0.5 ? FEMALE : MALE,
      birthYear: 400 - age,
      occupation: 0,
    });
  }
  // (Shuffled, so the people are not in id order.)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(u() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  for (const a of out) if (u() < 0.15) a.partner = out[Math.floor(u() * out.length)]!.id;
  for (const a of out) if (u() < 0.05) a.partner = -1 - Math.floor(u() * 50);
  return out;
}

test("pairing by years nearest first pairs exactly as weighing each man against each woman did", () => {
  for (let seed = 1; seed <= 40; seed++)
    for (const fractional of [false, true]) {
      const people = village(seed, 50 + seed * 37, fractional),
        fast = people.map((a) => ({ ...a })),
        slow = people.map((a) => ({ ...a }));
      pairUp(fast, 400, 16);
      pairedOneByOne(slow, 400, 16);
      assert.deepEqual(
        fast.map((a) => a.partner),
        slow.map((a) => a.partner),
        `seed ${seed}${fractional ? " (half years)" : ""}`,
      );
    }
});

test("a city's tens of thousands are paired in a moment", () => {
  const people = village(7, 60000, false),
    t0 = performance.now();
  pairUp(people, 400, 16);
  const ms = performance.now() - t0;
  assert.ok(ms < 1500, `${ms.toFixed(0)} ms`);
  assert.ok(people.filter((a) => a.partner !== undefined).length > 20000);
});
