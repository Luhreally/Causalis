// The peoples of other stars as the views read them (Phase 18 M134): each one's colour, the
// stars it holds, its ships under way, whom it met and how they stand, its raids, and its
// landings on the home world. Read from the simulation's own store; nothing enters history.
import { YEAR, type Ref, type World } from "../kernel/index.ts";
import type { PeoplesSky, Visitor } from "../bridge/index.ts";
import { CLADES } from "../rules/index.ts";
import { figureBody, starFolk } from "./folk.ts";
import {
  civilizationsNear,
  holdWorld,
  homePlanet,
  peoplesOf,
  peopleWords,
  politiesOf,
  realmName,
  type Meeting,
} from "../sim/index.ts";

/** Each people's colour among the stars: bright and apart from the stars' own, by its place among them. */
export const PEOPLE_COLORS: readonly (readonly [number, number, number])[] = [
  [1, 0.35, 0.85],
  [0.3, 0.95, 1],
  [1, 0.85, 0.2],
  [0.55, 1, 0.3],
  [1, 0.5, 0.25],
  [0.62, 0.55, 1],
  [0.3, 1, 0.7],
  [1, 0.4, 0.45],
  [0.92, 1, 0.5],
  [0.45, 0.7, 1],
  [0.85, 0.6, 1],
  [1, 0.72, 0.55],
];

/** A people's colour among the stars. */
export function peopleColor(world: World, civ: string): readonly [number, number, number] {
  const i = civilizationsNear(world).findIndex((c) => c.ref === civ);
  return PEOPLE_COLORS[Math.max(0, i) % PEOPLE_COLORS.length]!;
}

/** Whom a people met, in words: a realm, a land with no realm, or another people. */
export function metName(world: World, m: Meeting): string {
  if (m.with === "people") {
    const c = civilizationsNear(world).find((x) => x.ref === m.other);
    return c ? `the ${peopleWords(world, c).name}` : "another people";
  }
  const realm = m.with === "realm" ? politiesOf(world).get(m.other as Ref) : undefined;
  return realm ? realmName(realm) : "a land with no realm";
}

export function peoplesSky(world: World): PeoplesSky | undefined {
  const store = peoplesOf(world);
  if (!store) return undefined;
  const civs = civilizationsNear(world);
  return {
    home: homePlanet(world).generated.star.ref,
    civs: civs.map((c, i) => {
      const w = peopleWords(world, c);
      return {
        ref: c.ref,
        name: `the ${w.name}`,
        kind: w.kind,
        star: c.star,
        color: PEOPLE_COLORS[i % PEOPLE_COLORS.length]!,
        world: c.planet,
        electronics: c.electronics,
        orbit: c.orbit,
        stars: c.stars,
        holds: store.holdsOf(c.ref).map((h) => ({
          star: h.star,
          year: h.year,
          taken: h.from !== null,
          world: holdWorld(world, c, h.star),
        })),
      };
    }),
    ships: store.ships
      .filter((s) => !s.arrived)
      .map((s) => ({
        civ: s.civ,
        kind: s.kind,
        from: s.from,
        to: s.to,
        sailed: s.sailed,
        arrives: s.arrives,
        event: s.event,
      })),
    meetings: store.meetings.map((m) => ({
      civ: m.civ,
      other: m.other,
      with: m.with,
      otherName: metName(world, m),
      star: m.star,
      year: m.year,
      theirs: m.theirs,
      ours: m.ours,
      regard: Math.round(m.regard * 100) / 100,
      talking: m.talking,
      exchanges: m.exchanges,
      raids: m.raids,
      last: m.last,
      event: m.event,
    })),
    raids: store.raids.map((r) => ({
      civ: r.civ,
      star: r.star,
      year: r.year,
      won: r.won,
      taken: r.taken,
      event: r.event,
    })),
    landings: store.landings.map((l) => ({
      civ: l.civ,
      cell: l.cell,
      year: l.year,
      omen: l.omen,
      event: l.event,
    })),
  };
}

/** How long visitors are seen where they came down (years), and a fleet over a land it struck. */
const LANDING_SEEN = 2;
const RAID_SEEN = 1;

/**
 * The peoples of other stars at a land now (Phase 18 M134): come down just now (or come and
 * gone as an omen), kept there as an embassy while the two stand well and can speak, or over it
 * in war, their fleet having struck. One group a people; war first, then a landing, an embassy.
 */
export function visitorsAt(world: World, cell: number, year: number): Visitor[] | undefined {
  const store = peoplesOf(world);
  if (!store) return undefined;
  const civs = civilizationsNear(world),
    home = homePlanet(world).generated.star.ref,
    found = new Map<string, Visitor>(),
    rank = { raid: 3, landing: 2, omen: 2, embassy: 1 } as const;
  const add = (
    civRef: string,
    why: Visitor["why"],
    since: number,
    event: string,
    count: number,
  ) => {
    const i = civs.findIndex((c) => c.ref === civRef),
      civ = civs[i];
    const body = civ ? CLADES.find((c) => c.id === civ.clade)?.body : undefined;
    if (!civ || !body) return;
    const known = found.get(civRef);
    if (known && rank[known.why] >= rank[why]) return;
    const w = peopleWords(world, civ),
      met = store.meetings.find((m) => m.civ === civRef && m.cell === cell && m.star === home);
    found.set(civRef, {
      civ: civRef,
      name: `the ${w.name}`,
      kind: w.kind,
      body: figureBody(body, starFolk(civ)),
      color: PEOPLE_COLORS[i % PEOPLE_COLORS.length]!,
      why,
      year: since,
      event,
      count,
      theirs: met?.theirs ?? (why === "raid" ? "war" : null),
      ours: met?.ours ?? null,
    });
  };
  for (const r of store.raids)
    if (r.cell === cell && r.won && year >= r.year && year - r.year <= RAID_SEEN)
      add(r.civ, "raid", r.year, r.event, 0);
  for (const l of store.landings)
    if (l.cell === cell && year >= l.year && year - l.year <= LANDING_SEEN)
      add(l.civ, l.omen ? "omen" : "landing", l.year, l.event, l.omen ? 4 : 6);
  for (const m of store.meetings)
    if (m.cell === cell && m.star === home && m.talking && m.regard > 0)
      add(m.civ, "embassy", m.year, m.lastEvent ?? m.event, 3);
  return found.size ? [...found.values()] : undefined;
}

/** Every land with visitors from another star now, and what to show over it (Phase 18 M134). */
export function visitsNow(
  world: World,
): { cell: number; text: string; event: string; why: Visitor["why"] }[] {
  const store = peoplesOf(world);
  if (!store) return [];
  const year = Math.floor(world.now / YEAR),
    cells = new Set<number>();
  for (const l of store.landings) if (l.cell >= 0) cells.add(l.cell);
  for (const r of store.raids) if (r.cell >= 0) cells.add(r.cell);
  for (const m of store.meetings) if (m.cell >= 0) cells.add(m.cell);
  return [...cells]
    .sort((a, b) => a - b)
    .flatMap((cell) =>
      (visitorsAt(world, cell, year) ?? []).map((v) => ({
        cell,
        text: `${v.why === "raid" ? "⚔️" : "🛸"} ${v.name}`,
        event: v.event,
        why: v.why,
      })),
    );
}
