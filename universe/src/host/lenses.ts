// The map's deeper lenses (Phase 12 M108): each land's unrest, the strength its realm fields,
// the wealth in its stores, what it knows and how its people grew these ten years — read for
// the map's colours, and broken down for the tooltip under the pointer, as a grand strategy
// game's map modes tell what makes a land's number.
import type { Ref, World } from "../kernel/index.ts";
import { GOODS } from "../rules/index.ts";
import {
  WAY_TRAITS,
  cultureOf,
  fieldedParts,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  realmName,
  type Polity,
} from "../sim/index.ts";
import { principleName } from "../causal/index.ts";
import { landEra } from "./village.ts";
import { ERA_WORDS } from "./inspect/world.ts";
import { bare, claimOf, count, share } from "./inspect/words.ts";
import { beliefOfLand, godSeen, seenWords } from "./inspect/peoples.ts";

/** The lenses read here, beside the people's own (people, food, trade). */
export const DEEP_LENSES = [
  "unrest",
  "strength",
  "wealth",
  "knowledge",
  "growth",
  "ways",
  "belief",
] as const;
export type DeepLens = (typeof DEEP_LENSES)[number];

/** The years a land's growth is reckoned over. */
export const GROWTH_YEARS = 10;

/** A land's readings under the deeper lenses. */
export type LandReadings = {
  /** Its grievance against its realm (0 … 1). */
  readonly unrest: number;
  /** The men its realm fields (0: no realm's). */
  readonly strength: number;
  /** What its stores hold a head, at their goods' usual worth. */
  readonly wealth: number;
  /** How many things it knows. */
  readonly knowledge: number;
  /** Its people's rise (or fall) these ten years, as a share of what they were. */
  readonly growth: number;
  /** Its people's ways, each of the eight (Phase 14 M119). */
  readonly ways: readonly number[];
  /** What it has seen of the god's hand: favour, wrath, portents (Phase 14 M120). */
  readonly belief: readonly [number, number, number];
};

/** The ids a land knows: its lore, and sowing and smelting, which it knows in its own ways. */
function knownIn(world: World, cell: number): Set<string> {
  const ids = new Set(
    loreOf(world)
      .of(cell)
      .map(([id]) => id),
  );
  if (populationContext(world).provinces.get(cell)?.knowsCultivation) ids.add("cultivation");
  if (marketsOf(world).get(cell)?.metalworking) ids.add("metalworking");
  return ids;
}

/** A land's stores at their goods' usual worth. */
function worthOf(world: World, cell: number): number {
  const m = marketsOf(world).get(cell);
  return m ? m.stock.reduce((s, n, g) => s + Math.max(0, n) * (GOODS[g]?.value ?? 0), 0) : 0;
}

/** A land's people in its last year closed (`to`) and `GROWTH_YEARS` before (`from`), as history keeps them. */
function peopleThen(
  world: World,
  cell: number,
): { now: number; then: number | null; from: number; to: number } {
  const lines = populationContext(world).history.yearsOf(cell),
    last = lines.at(-1);
  if (!last) return { now: 0, then: null, from: 0, to: 0 };
  for (let i = lines.length - 1; i >= 0; i--)
    if (lines[i]!.year <= last.year - GROWTH_YEARS)
      return {
        now: last.population,
        then: lines[i]!.population,
        from: lines[i]!.year,
        to: last.year,
      };
  return { now: last.population, then: null, from: last.year, to: last.year };
}

/** Each land's readings, as the map colours them (a realm's strength reckoned once for all its lands). */
export function landReadings(world: World): (cell: number) => LandReadings {
  const ctx = populationContext(world),
    realms = politiesOf(world),
    fielded = new Map<string, number>(),
    culture = cultureOf(world),
    seen = godSeen(world);
  return (cell) => {
    const realm = realms.of(cell);
    let strength = 0;
    if (realm && realm.ended === null) {
      strength = fielded.get(realm.ref) ?? -1;
      if (strength < 0) {
        const f = fieldedParts(ctx, realm);
        strength = f.men * f.share;
        fielded.set(realm.ref, strength);
      }
    }
    const grown = peopleThen(world, cell);
    return {
      // (A grievance may run past the full; the lens reads it as full.)
      unrest: Math.min(1, realms.discontent(cell).level),
      strength,
      wealth: worthOf(world, cell) / Math.max(1, ctx.provinces.get(cell)?.total() ?? 0),
      knowledge: knownIn(world, cell).size,
      growth: grown.then ? grown.now / grown.then - 1 : 0,
      ways: culture.get(cell)?.traits.map((v) => Math.round(v * 1000) / 1000) ?? [],
      belief: (() => {
        const b = beliefOfLand(seen.get(cell));
        return [b.favour, b.wrath, b.portent] as const;
      })(),
    };
  };
}

/** A grievance in words. */
export function unrestWords(level: number): string {
  return level < 0.2
    ? "content"
    : level < 0.45
      ? "restless"
      : level < 0.7
        ? "discontented"
        : level < 0.9
          ? "seething"
          : "on the brink of rising";
}

/** What an event was, in a few words (for a tooltip's line). */
function briefly(world: World, ref: Ref | null): string {
  if (!ref) return "—";
  const words = bare(claimOf(world, ref));
  return words.length > 64 ? `${words.slice(0, 61)}…` : words;
}

/** A tooltip's reading of a land under a lens: its line, and what makes its number. */
export type Reading = {
  readonly line: string;
  readonly stats: readonly { readonly label: string; readonly value: string }[];
};

/** A land under one of the deeper lenses, broken down (null: not a land of the people). */
export function lensReading(
  world: World,
  cell: number,
  lens: DeepLens,
  way?: string,
): Reading | null {
  const ctx = populationContext(world),
    prov = ctx.provinces.get(cell);
  if (!prov) return null;
  const realms = politiesOf(world),
    realm: Polity | undefined = realms.of(cell);
  switch (lens) {
    case "unrest": {
      const d = realms.discontent(cell);
      return {
        line: `Unrest: ${unrestWords(d.level)}`,
        stats: [
          { label: "Grievance", value: share(Math.min(1, d.level)) },
          { label: "Most of it from", value: briefly(world, d.cause) },
          { label: "Realm", value: realm ? realmName(realm) : "none: its own" },
        ],
      };
    }
    case "strength": {
      if (!realm || realm.ended !== null)
        return { line: "Strength: no realm to field a host", stats: [] };
      const f = fieldedParts(ctx, realm);
      return {
        line: `Strength: ${realmName(realm)} fields ${count(f.men * f.share)}`,
        stats: [
          {
            label: "Fighting men",
            value: `${count(f.men)} in ${count(realm.members.length)} lands`,
          },
          { label: "Share fielded", value: share(f.share) },
          { label: "Their valour", value: share(f.valour) },
          { label: "A standing army", value: f.standing ? "kept" : "none" },
        ],
      };
    }
    case "wealth": {
      const m = marketsOf(world).get(cell),
        goods = m
          ? m.stock
              .map((n, g) => ({ g, worth: Math.max(0, n) * (GOODS[g]?.value ?? 0), n }))
              .filter((x) => x.worth > 0)
              .sort((a, b) => b.worth - a.worth || a.g - b.g)
          : [];
      const worth = worthOf(world, cell);
      return {
        line: `Wealth: ${count(worth / Math.max(1, prov.total()))} a head in store (${count(worth)} in all)`,
        stats: goods.slice(0, 4).map((x) => ({ label: GOODS[x.g]!.name, value: count(x.n) })),
      };
    }
    case "knowledge": {
      const known = knownIn(world, cell),
        newest = loreOf(world).of(cell).at(-1),
        era = landEra(world, cell);
      return {
        line: `Knowledge: ${count(known.size)} things known`,
        stats: [
          { label: "Its age", value: ERA_WORDS[era] ?? era },
          {
            label: "Newest",
            value: newest ? `${principleName(newest[0])} (year ${count(newest[1].year)})` : "—",
          },
        ],
      };
    }
    case "ways": {
      // One of their ways, and what pushed it (Phase 14 M119).
      const ways = cultureOf(world).get(cell);
      if (!ways) return { line: "Ways: they have none of their own yet", stats: [] };
      const i = Math.max(0, WAY_TRAITS.indexOf((way ?? "valour") as (typeof WAY_TRAITS)[number])),
        pushes = ways.nudges.filter((n) => n.trait === i).slice(0, 3);
      return {
        line: `Ways: ${WAY_TRAITS[i]} ${share(ways.traits[i]!)}`,
        stats: [
          { label: "What they return to", value: share(ways.base[i]!) },
          ...pushes.map((n) => ({
            label: `${n.amount > 0 ? "+" : "−"}${share(Math.abs(n.amount))}, year ${n.year}`,
            value: briefly(world, n.event),
          })),
        ],
      };
    }
    case "belief": {
      // What they have seen of the god's hand (Phase 14 M120).
      const had = godSeen(world).get(cell),
        b = beliefOfLand(had);
      return {
        line: `Belief: favour ${b.favour}, wrath ${b.wrath}, portents ${b.portent}`,
        stats: [...(had ?? [])]
          .sort((x, y) => y[1] - x[1])
          .slice(0, 4)
          .map(([k, n]) => ({ label: seenWords(k), value: `×${n}` })),
      };
    }
    case "growth": {
      const g = peopleThen(world, cell),
        history = ctx.history;
      let born = 0,
        died = 0;
      for (let y = g.from + 1; y <= g.to; y++) {
        born += history.birthsIn(cell, y);
        died += history.deathsIn(cell, y);
      }
      const change = g.then ? g.now / g.then - 1 : 0,
        moved = g.then === null ? 0 : g.now - g.then - born + died;
      return {
        line:
          g.then === null
            ? "Growth: too new a land to tell"
            : `Growth: ${change >= 0 ? "+" : "−"}${share(Math.abs(change))} in ${GROWTH_YEARS} years`,
        stats: [
          { label: "People", value: count(g.now) },
          { label: `In year ${count(g.from)}`, value: g.then === null ? "—" : count(g.then) },
          { label: "Born, died", value: `${count(born)}, ${count(died)}` },
          {
            label: "Came, left (net)",
            value: `${moved >= 0 ? "+" : "−"}${count(Math.abs(moved))}`,
          },
        ],
      };
    }
  }
}
