// The north-star scenario (docs/architecture §13, §35): generate a universe, meet
// a random, unimportant citizen of a grown people, tell their life to D4, and walk
// "why?" from one of their memories until it reaches a fact the planet's generator
// made. The walk must cross at least four domains, and every hop that mattered
// (importance 3 and up) must be on the record — recorded or generated, never
// guessed or forgotten.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, finish, mix, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { HUMANLIKE } from "../../src/rules/index.ts";
import { makePopulationWorld, populationContext } from "../../src/sim/index.ts";
import {
  meetHousehold,
  resolvePerson,
  why,
  type Explanation,
  type Person,
} from "../../src/causal/index.ts";

/** Which part of the universe a fact belongs to. The generated world counts as one. */
function domainOf(world: World, ref: string): string {
  const kind = ref.split(":")[0]!;
  if (kind === "memo" || kind === "prsn" || kind === "hhold") return "observer";
  if (["star", "plnt", "plate", "cell", "depo"].includes(kind)) return "planet";
  if (kind === "mkt") return "economy";
  if (kind === "town") return "people";
  const type =
    kind === "ev"
      ? (world.events.get(ref as Ref)?.type ?? world.events.tombstone(ref as Ref)?.type ?? "")
      : kind === "dec"
        ? (world.decisions.get(ref as Ref)?.rule ?? "")
        : "";
  if (/^trade/.test(type)) return "economy";
  if (/^knowledge/.test(type)) return "knowledge";
  if (/^weather/.test(type)) return "weather";
  return "people";
}

type Walk = { path: Explanation[]; domains: number };

/** The walk from a ref to a generated fact that crosses the most domains (bounded search). */
function bestWalk(world: World, ref: string): Walk | null {
  let best: Walk | null = null,
    visited = 0;
  const go = (node: Explanation, path: Explanation[], seen: Set<string>) => {
    if (++visited > 4000) return;
    const here = [...path, node];
    if (node.basis === "generated" && node.ref.startsWith("star:")) {
      const domains = new Set(here.map((n) => domainOf(world, n.ref))).size;
      if (!best || domains > best.domains) best = { path: here, domains };
      return;
    }
    if (here.length > 24) return;
    for (const edge of node.causes) {
      if (seen.has(edge.cause.ref)) continue;
      seen.add(edge.cause.ref);
      go(edge.next(), here, seen);
      seen.delete(edge.cause.ref);
    }
  };
  go(why(world, ref as Ref), [], new Set([ref]));
  return best;
}

/** How much a hop mattered: an event by its importance (a forgotten one as 3), a decision always. */
function importance(world: World, ref: string): number {
  if (ref.startsWith("dec:")) return 5;
  const e = world.events.get(ref as Ref);
  if (e) return e.importance;
  return world.events.tombstone(ref as Ref) ? 3 : 0;
}

test("north star: a grown citizen's memory leads across four domains to the planet, all on the record", () => {
  const world = makePopulationWorld(seedFromText("first light"));
  world.runTo(300 * YEAR);
  const now = 300,
    villages = populationContext(world).settlements.all();
  let h = 0x5eed;
  const draw = (n: number) => (h = finish(mix(h, n), 5)) % n;
  const citizens: Person[] = [];
  for (let i = 0; i < 80 && citizens.length < 16; i++) {
    const v = villages[draw(villages.length)]!;
    let members: readonly Ref[];
    try {
      members = meetHousehold(world, v.cell, v.ref).members;
    } catch {
      continue;
    }
    const p = resolvePerson(world, members[draw(members.length)]!, 4);
    // A citizen of a grown people: someone grown, with something to remember.
    if (p.alive && now - p.birthYear >= HUMANLIKE.adulthood && p.memories?.length) citizens.push(p);
  }
  assert.ok(citizens.length >= 12, `${citizens.length} grown citizens with memories`);
  const crossed = new Set<string>();
  for (const p of citizens) {
    const walks = p.memories!.map((m) => bestWalk(world, m.ref)).filter((w): w is Walk => !!w);
    assert.ok(walks.length > 0, `${p.name}'s memories reach the planet`);
    for (const w of walks) for (const n of w.path) crossed.add(domainOf(world, n.ref));
    const walk = walks.sort((a, b) => b.domains - a.domains)[0]!;
    const words = walk.path.map((n) => `${domainOf(world, n.ref)}: ${n.claim}`).join(" ← ");
    assert.ok(walk.domains >= 4, `${p.name} ${p.surname}: ${walk.domains} domains: ${words}`);
    for (const n of walk.path)
      if (importance(world, n.ref) >= 3)
        assert.ok(
          n.basis === "recorded" || n.basis === "generated",
          `${n.ref} is ${n.basis}: ${n.claim}`,
        );
  }
  // Between them, the citizens' memories reach every part of the slice.
  for (const d of ["observer", "people", "weather", "knowledge", "planet"])
    assert.ok(crossed.has(d), `some walk crosses ${d}: ${[...crossed].join(", ")}`);
});
