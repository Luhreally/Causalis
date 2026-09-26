// Interest groups (docs/architecture §21): within a realm, those who live alike want
// alike — the farmers (and those who still gather), the herders, the crafters, the
// traders, the court (those who lead) and, where the seat holds a faith, the temple.
// Each holds sway by its numbers and its wealth, weighed by the realm's institutions:
// an assembly hears the many, a council of elders the few who lead, a priest-king the
// temple. Each makes demands that rest on something in the world — lighter tribute
// after a famine, peace with the realms they trade with, more tribute while the realm
// is at war, war on unbelievers across the border. The seat's decisions (its tithe,
// its wars) read those demands as factors, so their why runs through the people who
// pressed them, and on to what moved those people.
import { YEAR, type Ref, type SimTime } from "../../kernel/index.ts";
import { OCC } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import type { WarStore } from "../war/war.ts";
import { LAW, politiesOf, type Polity } from "./polity.ts";

export const GROUPS = [
  "farmers",
  "herders",
  "crafters",
  "traders",
  "the court",
  "the temple",
] as const;
export type Group = (typeof GROUPS)[number];

/** What a group wants, how much, of whom (a realm, for peace or war), and what it rests on. */
export type Demand = {
  readonly group: Group;
  readonly want: "lighter tribute" | "more tribute" | "peace" | "war";
  readonly name: string;
  readonly strength: number;
  readonly toward: Ref | null;
  readonly source: Ref | null;
};

export type Interest = {
  readonly group: Group;
  /** Its share of the realm's sway, 0..1 (the groups' shares sum to one). */
  readonly sway: number;
  readonly people: number;
  readonly demands: readonly Demand[];
};

/** How much one of a group counts, by who leads: a chief, a council of elders, an assembly, a priest-king. */
const CLOUT: Readonly<Record<Exclude<Group, "the temple">, readonly number[]>> = {
  farmers: [1, 0.8, 1.8, 0.8],
  herders: [1.2, 0.8, 1.8, 0.8],
  crafters: [2, 1.5, 2.5, 1.5],
  traders: [8, 6, 8, 6],
  "the court": [20, 24, 8, 12],
};
/** How much of a devout people's weight the temple carries, by who leads. */
const TEMPLE = [0.15, 0.15, 0.1, 0.5];

/** Each group's sway in a realm with these numbers, institutions and devotion (shares summing to one). */
export function swayOf(
  people: Readonly<Record<Exclude<Group, "the temple">, number>>,
  leadership: number,
  piety: number,
  faith: boolean,
  sacred: boolean,
): Record<Group, number> {
  const all = people.farmers + people.herders + people.crafters + people.traders,
    raw: Record<Group, number> = {
      farmers: people.farmers * CLOUT.farmers[leadership]!,
      herders: people.herders * CLOUT.herders[leadership]!,
      crafters: people.crafters * CLOUT.crafters[leadership]!,
      traders: people.traders * CLOUT.traders[leadership]!,
      "the court": people["the court"] * CLOUT["the court"][leadership]!,
      "the temple": faith
        ? all * Math.max(0, piety - 0.35) * TEMPLE[leadership]! * (sacred ? 2 : 1)
        : 0,
    };
  const total = GROUPS.reduce((s, g) => s + raw[g], 0);
  for (const g of GROUPS) raw[g] = total > 0 ? raw[g] / total : 0;
  return raw;
}

/** A realm's interest groups now: their sway and their demands, each resting on its source. */
export function interestsOf(ctx: PopulationContext, p: Polity, t: SimTime): Interest[] {
  const { world, generated: g } = ctx,
    realms = politiesOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    faiths = beliefOf(world),
    ways = cultureOf(world).get(p.seat),
    piety = ways?.traits[WAY.piety] ?? 0.5,
    seatFaith = faiths.of(p.seat),
    // (Read here, not at load: this module and the realms' import each other.)
    sacred = p.law === LAW.indexOf("the sacred");
  const count: Record<Exclude<Group, "the temple">, number> = {
    farmers: 0,
    herders: 0,
    crafters: 0,
    traders: 0,
    "the court": 0,
  };
  let famine: Ref | null = null,
    faminAt = -Infinity;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    count.farmers += prov.occupation(OCC.farmer) + prov.occupation(OCC.forager);
    count.herders += prov.occupation(OCC.herder);
    count.crafters += prov.occupation(OCC.crafter);
    count.traders += prov.occupation(OCC.trader);
    count["the court"] += prov.occupation(OCC.leader);
    const f = prov.lastFamine ? world.events.get(prov.lastFamine) : undefined;
    if (f && t - f.t <= 3 * YEAR && f.t > faminAt) {
      famine = f.id;
      faminAt = f.t;
    }
  }
  const sway = swayOf(count, p.leadership, piety, seatFaith.faith !== null, sacred);

  // The realms it meets: those it trades with (and down which road), and those of another faith.
  const trade = new Map<Ref, { volume: number; road: Ref | null }>();
  for (const f of markets.flows) {
    const from = realms.of(f.from),
      to = realms.of(f.to);
    if (!from || !to || from === to || (from !== p && to !== p)) continue;
    const other = from === p ? to : from,
      tr = trade.get(other.ref) ?? { volume: 0, road: null };
    tr.volume += f.count;
    tr.road ??= markets.route(f.from, f.to) ?? null;
    trade.set(other.ref, tr);
  }
  const neighbours = new Set<Polity>();
  for (const c of p.members)
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const q = realms.of(g.grid.neighbours[k]!);
      if (q && q !== p && q.ended === null) neighbours.add(q);
    }
  const atWar = world.storeNames().includes("war.wars")
    ? world
        .store<WarStore>("war.wars")
        .all()
        .filter((w) => w.ended === null && (w.attacker === p.ref || w.defender === p.ref))
    : [];

  const demands: Demand[] = [];
  const want = (d: Omit<Demand, "strength"> & { strength: number }) => {
    if (d.strength > 0.02) demands.push({ ...d, strength: Math.min(1, d.strength) });
  };
  // Those who work the land: lighter tribute — the more after a famine; else it rests on
  // the tithe they bear (its last raising, if it was raised).
  for (const group of ["farmers", "herders"] as const)
    want({
      group,
      want: "lighter tribute",
      name: `${group} want lighter tribute`,
      strength: (p.tribute * 5 + (famine ? 0.6 : 0)) * (group === "herders" ? 0.6 : 1),
      toward: null,
      source: famine ?? p.tithed ?? null,
    });
  // Traders (and crafters, whose goods go down the roads): peace with those they trade with.
  for (const [other, tr] of [...trade.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
    for (const group of ["traders", "crafters"] as const)
      want({
        group,
        want: "peace",
        name: `${group} want peace with those they trade with`,
        strength: Math.min(1, tr.volume / 400) * (group === "crafters" ? 0.5 : 1),
        toward: other,
        source: tr.road,
      });
  // The court: more tribute, the more while the realm is at war.
  want({
    group: "the court",
    want: "more tribute",
    name: "the court wants more tribute",
    strength: 0.3 + (atWar.length ? 0.5 : 0),
    toward: null,
    source: atWar[0]?.event ?? p.event,
  });
  // The temple: its tithe, and war on unbelievers across the border.
  if (seatFaith.faith) {
    want({
      group: "the temple",
      want: "more tribute",
      name: "the temple wants its tithe",
      strength: sacred ? 0.5 : 0.2,
      toward: null,
      source: seatFaith.event,
    });
    for (const q of [...neighbours].sort((a, b) => (a.ref < b.ref ? -1 : 1))) {
      const theirs = faiths.of(q.seat).faith;
      if (!theirs || theirs === seatFaith.faith) continue;
      want({
        group: "the temple",
        want: "war",
        name: "the temple wants war on the unbelievers",
        strength: (piety - 0.5) * 2,
        toward: q.ref,
        source: seatFaith.event,
      });
    }
  }
  return GROUPS.map((group) => ({
    group,
    sway: sway[group],
    people: group === "the temple" ? 0 : count[group],
    demands: demands.filter((d) => d.group === group),
  }));
}

/** How hard a realm's groups press, weighed by their sway, for one kind of want (toward one realm, if given). */
export function pressure(
  interests: readonly Interest[],
  want: Demand["want"],
  toward: Ref | null = null,
): { total: number; strongest: (Demand & { sway: number }) | null } {
  let total = 0,
    strongest: (Demand & { sway: number }) | null = null;
  for (const i of interests)
    for (const d of i.demands) {
      if (d.want !== want || (toward !== null && d.toward !== toward)) continue;
      const w = i.sway * d.strength;
      total += w;
      if (!strongest || w > strongest.sway * strongest.strength) strongest = { ...d, sway: i.sway };
    }
  return { total, strongest };
}
