// Lives L1: a realm's key figures and a town's, read from what history keeps. A realm's ruler (who
// lives in the seat's town while the realm stands), the generals of its last coups, and the heads
// of the houses of lending its lands hold. A town's own figures stand in it by name, each in one of
// the homes nearest its square. Pure reads: asking moves nothing and nothing is kept.
import { notableLeader, notablesIn, realmNotables } from "./inspect/notables.ts";
import { headLeader, townRolesOf } from "./inspect/townlife.ts";
import { orgsOf, underworldOf } from "../sim/index.ts";
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
  NEAREST_HOMES,
  homeOfFigure,
  seatRef,
  worthWords,
  type Leader,
  type LeaderList,
  type LaidAs,
  type VillagePlan,
} from "../bridge/index.ts";
import { figureHousehold, seatHolder } from "./kin.ts";
import { figureHomesIn } from "./home.ts";
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
  // The heads of its strongest groups, under the law and outside it, where they live in a town that shows them.
  if (r.ended === null) {
    const groups = [
      ...(underworldOf(world)?.of(r.ref)?.groups ?? []),
      ...(orgsOf(world)?.of(r.ref)?.orgs ?? []),
    ]
      .sort((a, b) => b.power - a.power || (a.event < b.event ? -1 : 1))
      .slice(0, 8);
    let heads = 0;
    for (const g of groups) {
      const l = heads < 4 ? headLeader(world, `boss:${r.ref}:${g.event}`) : null;
      if (l) {
        leaders.push(l);
        heads++;
      }
    }
  }
  // (One of name who is already here, as its ruler or a general of its coups, is one person and one card that says both: a
  // ruler who commands the realm's host stood twice, as a town's figures did before metAs.)
  if (r.ended === null)
    for (const n of realmNotables(world, r)) {
      const card = notableLeader(world, n),
        i = leaders.findIndex((l) => sameOne(world, l, n));
      if (i < 0) leaders.push(card);
      else leaders[i] = bothRoles(leaders[i]!, card, realmName(r));
    }
  return { realm: r.ref, realmName: realmName(r), leaders };
}

/** Whether a card already among a realm's leaders is the one of name: a ruler by name and year born, one history only names by name. */
function sameOne(world: World, l: Leader, n: { name: string; born: number }): boolean {
  if (l.name !== n.name) return false;
  if (l.ref.startsWith("rule:")) {
    const p = politiesOf(world).get(asRef(l.ref.slice("rule:".length)));
    return !!p && p.ruler.born === n.born;
  }
  // (A general of a coup is kept by name alone; anyone else here has an age to tell them by.)
  return l.as === null || l.as.age === yearNow(world) - n.born;
}

/** One card for one who is two things: the one with a page and a home kept, and its words say both. */
function bothRoles(a: Leader, b: Leader, realm: string): Leader {
  const [keep, other] = a.as === null && b.as !== null ? [b, a] : [a, b],
    also = other.title.replace(`the host of ${realm}`, "its host"),
    words = also ? also[0]!.toLowerCase() + also.slice(1) : also;
  return {
    ...keep,
    title: `${keep.title}, and ${words}`,
    did: `${keep.did} ${other.did}`,
    why: keep.why ?? other.why,
  };
}

/** The key figures living in a town: its realm's ruler if it is the seat, and its house's lender. */
export function leadersOfTown(world: World, town: string): Leader[] {
  return metIn(world, town).leaders;
}

/**
 * The ref one of a town's key figures is met under there. One the world keeps by name who is also their realm's ruler or of
 * its court is one person, listed and drawn once: as the holder of an office of the town where they hold one (its judge, its
 * host's commander: the court's entry gives way), else as the ruler or the one of the court (their own entry gives way). The
 * page of the entry that gave way leads to the one met.
 */
export function metAs(world: World, town: string, ref: string): string {
  return metIn(world, town).as.get(ref) ?? ref;
}

function metIn(world: World, town: string): { leaders: Leader[]; as: Map<string, string> } {
  const s = populationContext(world).settlements.get(asRef(town)),
    as = new Map<string, string>();
  if (!s) return { leaders: [], as };
  let out: Leader[] = [];
  const r = politiesOf(world).of(s.cell);
  if (r && r.ended === null && seatTownOf(world, r)?.ref === town)
    out.push(rulerLeader(world, r), ...courtLeaders(world, r));
  const h = creditOf(world)?.houseIn(town),
    l = h ? lenderLeader(world, h) : null;
  if (l) out.push(l);
  // (The heads of the groups whose home it is: host/inspect/townlife.ts.)
  out.push(...townRolesOf(world, town).heads);
  // (Those who hold its offices and head its great things, as read: host/inspect/notables.ts.)
  for (const n of notablesIn(world, town)) {
    // (One of name who is the ruler or of the court listed above: the same person, once. Two were listed, and drawn.)
    // (One of the court who has since taken the seat is its ruler, by their name and the year they were born.)
    const also =
        !n.sim || !r || n.sim.realm !== r.ref
          ? null
          : r.ruler.name === n.name && r.ruler.born === n.born
            ? `rule:${r.ref}`
            : n.sim.as?.startsWith("court:")
              ? n.sim.as.replace("court:", `court:${r.ref}:`)
              : null,
      same = also ? out.find((l) => l.ref === also) : undefined;
    if (same && (n.kind === "named" || same.ref.startsWith("rule:"))) {
      as.set(n.ref, same.ref);
      continue;
    }
    if (same) {
      out = out.filter((l) => l !== same);
      as.set(same.ref, n.ref);
    }
    out.push(notableLeader(world, n));
  }
  return { leaders: out, as };
}

/** A town's plan with its key figures in it: each one's home, and the figures it lists. */
export function withFigures(world: World, plan: VillagePlan): VillagePlan {
  const here = leadersOfTown(world, plan.ref).filter(
    (l): l is Leader & { as: LaidAs } => l.as !== null,
  );
  if (here.length === 0 || plan.homes.length === 0) return plan;
  const people = [...plan.people],
    year = yearNow(world),
    grown = populationContext(world).life.adulthood;
  // Each one's home: by who they are, as ever; a group's head, who came to this later, the next of the homes about the square
  // that none of the others keeps (a head does not share the ruler's hall).
  // (Among the homes standing on the town's first lots, which every device draws: one's home was by how much of the town the
  // device drew, a ruin where a phone drew only a middle burnt flat. Where none stands there, they are drawn about the lots
  // as its people are, and no home is theirs to look into. 2026-11-19)
  const near = figureHomesIn(world, plan),
    among1 = near || plan.homes.length,
    kept = new Set(here.filter((l) => l.kind !== "head").map((l) => homeOfFigure(l.ref, among1))),
    homes = new Map<string, number>();
  for (const l of here) {
    let home = homeOfFigure(l.ref, among1);
    if (l.kind === "head") {
      const among = Math.min(2 * NEAREST_HOMES, among1);
      for (let k = 0; k < among && kept.has(home); k++) home = (home + 1) % among;
      kept.add(home);
    }
    homes.set(l.ref, home);
  }
  for (const l of here) {
    const home = homes.get(l.ref)!,
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
    // (A head's and an office-holder's household, under their roof: each one of the town's to be met, with a page. host/kin.ts)
    if (l.kind === "head")
      for (const k of figureHousehold(world, l.ref)) {
        const age = year - k.born;
        // (A babe is in arms, not on the street.)
        if (age < 3) continue;
        people.push({
          ref: k.ref!,
          name: k.name,
          home,
          age,
          occupation: OCC.dependent,
          child: age < grown,
          sex: k.sex,
          folk: true,
          role: `${k.tie} of ${l.name}`,
        });
      }
  }
  const figures = here.map((l) => ({
      ref: l.ref,
      name: l.name,
      title: l.title,
      home: homes.get(l.ref)!,
    })),
    // (Each one's home marked on its lot, but the ruler's: the ruler keeps the seat's hall. bridge/rank.ts)
    marks = figures.flatMap((g) => {
      const lot = plan.homes[g.home]?.lot;
      return lot === undefined || near === 0 || g.ref.startsWith("rule:")
        ? []
        : [{ lot, ref: g.ref, name: g.name, title: g.title }];
    }),
    town =
      plan.town?.rank && marks.length
        ? {
            ...plan.town,
            rank: {
              ...plan.town.rank,
              marks: [
                ...(plan.town.rank.marks ?? []).filter((m) => !marks.some((x) => x.lot === m.lot)),
                ...marks,
              ],
            },
          }
        : plan.town;
  return { ...plan, ...(town ? { town } : {}), people, figures };
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
