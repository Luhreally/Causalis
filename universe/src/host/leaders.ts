// Lives L1: a realm's key figures and a town's, read from what history keeps. A realm's ruler (who
// lives in the seat's town while the realm stands), the generals of its last coups, and the heads
// of the houses of lending its lands hold. A town's own figures stand in it by name, each in one of
// the homes nearest its square. Pure reads: asking moves nothing and nothing is kept.
import type { World } from "../kernel/index.ts";
import {
  creditOf,
  politiesOf,
  populationContext,
  realmName,
  strifeOf,
  type House,
  type Polity,
} from "../sim/index.ts";
import { OCC } from "../rules/index.ts";
import {
  homeOfFigure,
  seatRef,
  worthWords,
  type Leader,
  type LeaderList,
  type LaidAs,
  type VillagePlan,
} from "../bridge/index.ts";
import { seatHolder } from "./kin.ts";
import { courtLeaders } from "./court.ts";
import { asRef, bare, claimOf, yearNow } from "./inspect/words.ts";
import type { QueryHandler } from "./host.ts";

/** The town a realm is seated in: the one of its name, else the most peopled on its seat's land. */
export function seatTownOf(
  world: World,
  r: Polity,
): { ref: string; name: string; population: number; cell: number } | null {
  const towns = populationContext(world).settlements.seenIn(r.seat),
    t =
      towns.find((x) => x.name === r.town) ??
      [...towns].sort((a, b) => b.population - a.population)[0];
  return t ? { ref: t.ref, name: t.name, population: t.population, cell: t.cell } : null;
}

/** A realm's ruler: where they live (the seat's town, while the realm stands) and whom the hand can lay from. */
export function rulerLeader(world: World, r: Polity): Leader {
  const living = r.ended === null,
    town = seatTownOf(world, r),
    year = yearNow(world),
    home = living && town ? town : null;
  return {
    ref: `rule:${r.ref}`,
    kind: "ruler",
    name: r.ruler.name,
    title: `${living ? "Ruler" : "Last ruler"} of ${realmName(r)}`,
    did: `Since year ${r.ruler.since}. ${bare(claimOf(world, r.ruler.event))}.`,
    why: r.ruler.event,
    town: home?.ref ?? null,
    townName: home?.name ?? null,
    as: home
      ? {
          name: r.ruler.name,
          age: Math.max(16, Math.min(300, year - r.ruler.born)),
          occupation: OCC.leader,
          sex: r.ruler.sex,
        }
      : null,
    cannot: !living
      ? "Their realm has fallen: history does not say where they went."
      : !town
        ? "History keeps no town for them."
        : null,
  };
}

/** The head of a house of lending: the seat's lender in its town, owed what is out to it. */
export function lenderLeader(world: World, h: House): Leader | null {
  const holder = seatHolder(world, h.town, "lender", 0);
  if (!holder) return null;
  const t = populationContext(world).settlements.get(h.town);
  if (!t) return null;
  const year = yearNow(world),
    owed = creditOf(world)?.outstanding(h.ref) ?? 0;
  return {
    ref: seatRef(h.town, "lender", 0),
    kind: "lender",
    name: holder.name,
    title: `Head of ${h.name}`,
    did: `Holds ${worthWords(h.capital)} grain's worth and is owed ${worthWords(owed)}. Lending since year ${h.year}.`,
    why: h.event,
    town: h.town,
    townName: t.name,
    as: {
      name: holder.name,
      age: Math.max(16, year - holder.born),
      occupation: OCC.trader,
      sex: holder.sex,
    },
    cannot: null,
  };
}

/** A realm's key figures: its ruler, the generals of its last coups, and its lenders (while it stands). */
export function leadersOf(world: World, realm: string): LeaderList | null {
  const r = politiesOf(world).get(asRef(realm));
  if (!r) return null;
  const leaders: Leader[] = [rulerLeader(world, r)];
  // The last three coups against it by other hands, newest first.
  const coups = (
    strifeOf(world)?.coups.filter((c) => c.realm === r.ref && c.general !== r.ruler.name) ?? []
  )
    .slice(-3)
    .reverse();
  for (const c of coups) {
    const now = politiesOf(world)
      .living()
      .find((p) => p.ruler.name === c.general);
    leaders.push(
      now
        ? {
            ...rulerLeader(world, now),
            kind: "general",
            title: `General, now ruler of ${realmName(now)}`,
          }
        : {
            ref: c.event,
            kind: "general",
            name: c.general,
            title: c.won
              ? "The general who seized its seat"
              : "The general who reached for its seat",
            did: `${claimOf(world, c.event)}.`,
            why: c.event,
            town: null,
            townName: null,
            as: null,
            cannot: "History keeps what they did, not where they went or whether they live.",
          },
    );
  }
  if (r.ended === null) {
    const houses = (creditOf(world)?.standing() ?? [])
      .filter((h) => r.members.includes(h.cell))
      .sort((a, b) => b.capital - a.capital || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))
      .slice(0, 4);
    for (const h of houses) {
      const l = lenderLeader(world, h);
      if (l) leaders.push(l);
    }
  }
  return { realm: r.ref, realmName: realmName(r), leaders };
}

/** The key figures living in a town: its realm's ruler if it is the seat, and its house's lender. */
export function leadersOfTown(world: World, town: string): Leader[] {
  const s = populationContext(world).settlements.get(asRef(town));
  if (!s) return [];
  const out: Leader[] = [],
    r = politiesOf(world).of(s.cell);
  if (r && r.ended === null && seatTownOf(world, r)?.ref === town)
    out.push(rulerLeader(world, r), ...courtLeaders(world, r));
  const h = creditOf(world)?.houseIn(town),
    l = h ? lenderLeader(world, h) : null;
  if (l) out.push(l);
  return out;
}

/** A town's plan with its key figures in it: each one's home, and the figures it lists. */
export function withFigures(world: World, plan: VillagePlan): VillagePlan {
  const here = leadersOfTown(world, plan.ref).filter(
    (l): l is Leader & { as: LaidAs } => l.as !== null,
  );
  if (here.length === 0 || plan.homes.length === 0) return plan;
  const people = [...plan.people];
  for (const l of here) {
    const home = homeOfFigure(l.ref, plan.homes.length),
      i = people.findIndex((p) => p.ref.startsWith("agent:") && p.name === l.name);
    if (i >= 0) people[i] = { ...people[i]!, home, role: l.title, figure: l.ref };
    else
      people.push({
        ref: l.ref,
        name: l.name,
        home,
        age: l.as.age,
        occupation: l.as.occupation,
        child: false,
        sex: l.as.sex,
        role: l.title,
        figure: l.ref,
      });
  }
  return {
    ...plan,
    people,
    figures: here.map((l) => ({
      ref: l.ref,
      name: l.name,
      title: l.title,
      home: homeOfFigure(l.ref, plan.homes.length),
    })),
  };
}

export const LEADER_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** A realm's key figures (null: no such realm). */
  "leaders.of": (world, args) => leadersOf(world, (args as { realm: string }).realm),
  /** A realm's court as its people (Lives L5): each to be taken as one of it (2026-11-13). */
  "leaders.court": (world, args) => {
    const r = politiesOf(world).get(asRef((args as { realm: string }).realm));
    return r ? courtLeaders(world, r) : [];
  },
};
