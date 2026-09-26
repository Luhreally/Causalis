// The north-star walk (docs/architecture §13, §35): meet a random, unimportant citizen
// of a grown people, tell their life to D4, and walk "why?" from one of their memories
// until it reaches the star the planet's generator made. The walk that crosses the most
// domains is kept; every hop that mattered (importance 3 and up) must be on the record —
// recorded or generated, never guessed or forgotten. Used by the north-star test and
// the Phase 3 gate.
import { finish, mix, type Ref, type World } from "../kernel/index.ts";
import { lifeOf, populationContext } from "../sim/index.ts";
import { resolvePerson } from "./biography.ts";
import { meetHousehold, type Person } from "./observer.ts";
import { why, type Explanation } from "./why.ts";

/** Which part of the universe a fact belongs to. The generated world counts as one. */
export function domainOf(world: World, ref: string): string {
  const kind = ref.split(":")[0]!;
  if (kind === "memo" || kind === "prsn" || kind === "hhold") return "observer";
  if (["star", "plnt", "plate", "cell", "depo", "age", "spec", "spot"].includes(kind))
    return "planet";
  if (kind === "mkt") return "economy";
  if (kind === "pol" || kind === "rel") return "realm";
  if (kind === "town") return "people";
  if (kind === "lang" || kind === "ways") return "culture";
  if (kind === "dsgn") return "design";
  if (kind === "faith") return "belief";
  const type =
    kind === "ev"
      ? (world.events.get(ref as Ref)?.type ?? world.events.tombstone(ref as Ref)?.type ?? "")
      : kind === "dec"
        ? (world.decisions.get(ref as Ref)?.rule ?? "")
        : "";
  if (/^(trade|settlement\.market)/.test(type)) return "economy";
  if (/^industry/.test(type)) return "industry";
  if (/^(climate|people\.smoke)/.test(type)) return "climate";
  if (/^(polity|war|diplomacy)/.test(type)) return "realm";
  if (/^(knowledge|lore)/.test(type)) return "knowledge";
  if (/^weather/.test(type)) return "weather";
  if (/^(language|culture)/.test(type)) return "culture";
  if (/^ecology/.test(type)) return "ecology";
  if (/^design/.test(type)) return "design";
  if (/^belief/.test(type)) return "belief";
  return "people";
}

export type Walk = { path: Explanation[]; domains: number };

/** The walk from a ref to the star that crosses the most domains (a bounded search). */
export function bestWalk(world: World, ref: string): Walk | null {
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
export function hopImportance(world: World, ref: string): number {
  if (ref.startsWith("dec:")) return 5;
  const e = world.events.get(ref as Ref);
  if (e) return e.importance;
  return world.events.tombstone(ref as Ref) ? 3 : 0;
}

export type NorthStar = {
  citizens: { person: Person; walk: Walk | null }[];
  /** Every domain some citizen's walks crossed. */
  crossed: Set<string>;
  problems: string[];
};

/**
 * Meet up to `count` grown citizens with memories (drawn from the villages by a fixed
 * key) and walk each one's memories to the star; say what fails the north star.
 */
export function northStar(world: World, now: number, count = 16): NorthStar {
  const villages = populationContext(world).settlements.all();
  let h = 0x5eed;
  const draw = (n: number) => (h = finish(mix(h, n), 5)) % n;
  const citizens: NorthStar["citizens"] = [],
    crossed = new Set<string>(),
    problems: string[] = [];
  for (let i = 0; i < 5 * count && citizens.length < count; i++) {
    const v = villages[draw(villages.length)]!;
    if (!v.population) continue;
    let members: readonly Ref[];
    try {
      members = meetHousehold(world, v.cell, v.ref).members;
    } catch {
      continue;
    }
    if (!members.length) continue;
    const p = resolvePerson(world, members[draw(members.length)]!, 4);
    // A citizen of a grown people: someone grown, with something to remember.
    if (!p.alive || now - p.birthYear < lifeOf(world).adulthood || !p.memories?.length) continue;
    const walks = p.memories
      .map((m) => bestWalk(world, m.ref))
      .filter((w): w is Walk => !!w)
      .sort((a, b) => b.domains - a.domains);
    for (const w of walks) for (const n of w.path) crossed.add(domainOf(world, n.ref));
    const walk = walks[0] ?? null;
    citizens.push({ person: p, walk });
    if (!walk) {
      problems.push(`${p.name} ${p.surname}: no memory reaches the planet`);
      continue;
    }
    if (walk.domains < 4)
      problems.push(
        `${p.name} ${p.surname}: ${walk.domains} domains: ${walk.path.map((n) => `${domainOf(world, n.ref)}: ${n.claim}`).join(" ← ")}`,
      );
    for (const n of walk.path)
      if (hopImportance(world, n.ref) >= 3 && n.basis !== "recorded" && n.basis !== "generated")
        problems.push(`${n.ref} is ${n.basis}: ${n.claim}`);
  }
  if (citizens.length < Math.ceil(count * 0.75))
    problems.push(`only ${citizens.length} grown citizens with memories`);
  return { citizens, crossed, problems };
}
