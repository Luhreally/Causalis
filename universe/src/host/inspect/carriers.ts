// Who carries what, and where (asked 2026-11-16: "in the underworld tab show who controls most of what where"). A pure reading,
// read only when a page asks, of what is kept already: a realm's wares smuggled (sim/money/contraband.ts, its greatest four) and its
// underworld's groups (sim/order/underworld.ts), their rackets, their weight among their road's groups, their power and the lands they
// hold. Nothing is kept per group and good: the split is derived each time, and is at most a realm's four wares by its few groups.
//   Of a ware's trade in a realm, those outside the law take the share its underworld captures (RealmUnderworld.captured); the rest
//   is carried by many small hands. That share falls to the groups that carry what crosses its borders: its cartels (their road is
//   the smuggling rent), and any group that lives on smuggling. Each takes by its weight among its road's groups and its power, a cartel
//   twice over what its realm forbids outright, by war, its law or its bar on arms (what is forbidden outright needs men who can
//   meet the crackdown).
//   In a land: the groups that hold any part of it, the one that holds most of it weighed by its hold there (GANG_ROW).
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Row, Span } from "../../bridge/index.ts";
import { groupWords } from "../../causal/index.ts";
import { groupRef } from "../underworld.ts";
import { landName } from "./annals.ts";
import { count, link } from "./words.ts";
import { pct } from "./ledger-kit.ts";
import { CONTRA_CAUSES, RACKETS, racketBit, wareName } from "../../rules/index.ts";
import {
  GANG_ROW,
  contrabandOf,
  gangsStore,
  kindOfGroup,
  politiesOf,
  underworldOf,
  type Contraband,
  type CrimeGroup,
  type Polity,
} from "../../sim/index.ts";

/** One group's part of a ware's trade. */
export type Carrier = { readonly r: Polity; readonly g: CrimeGroup; readonly share: number };

/** A ware's trade where it is read: its worth and rent a year, who carries it the most first, and what many small hands carry. */
export type Carried = {
  readonly w: Contraband;
  /** What crosses unseen a year (grain's worth) and its rent (worth times wedge). */
  readonly worth: number;
  readonly rent: number;
  readonly carriers: readonly Carrier[];
  /** The share no group carries. */
  readonly loose: number;
};

/** The causes a cartel carries twice over: what is forbidden outright. */
const OUTRIGHT = new Set(["war", "law", "harm", "sanction"]);
const SMUGGLING = racketBit(RACKETS[1]);

/** A group's pull on a ware's trade (0: it carries none). */
function pull(g: CrimeGroup, w: Contraband): number {
  const cartel = kindOfGroup(g) === "cartel";
  if (!cartel && !(g.rackets & SMUGGLING)) return 0;
  const base = (g.share / 1000 + 0.1) * (0.5 + g.power / 1000);
  return cartel ? base * (OUTRIGHT.has(CONTRA_CAUSES[w.cause] ?? "") ? 2 : 1) : 0.4 * base;
}

/**
 * Who carries each of a realm's wares smuggled, in the realm or in one land of it (`cell`: the groups that hold any part of it,
 * the one that holds most weighed by its hold). The greatest rent first.
 */
export function carriedIn(world: World, r: Polity, cell?: number): Carried[] {
  const store = underworldOf(world),
    v = store?.of(r.ref),
    captured = (v?.captured ?? 0) / 1000,
    wares = contrabandOf(world, r.ref);
  if (!wares.length) return [];
  // (The groups that may carry it: the realm's own; in a land, any realm's that hold part of it.)
  let groups: { r: Polity; g: CrimeGroup; hold: number }[] = (v?.groups ?? []).map((g) => ({
    r,
    g,
    hold: 1,
  }));
  if (cell !== undefined) {
    const realms = politiesOf(world),
      strongest = gangsStore(world)?.get(cell),
      out: typeof groups = [];
    for (const ref of store?.realmsKept() ?? []) {
      const q = realms.get(ref as Ref);
      if (!q) continue;
      for (const g of store!.of(ref)!.groups)
        if (g.lands.includes(cell))
          out.push({
            r: q,
            g,
            hold:
              strongest && strongest[GANG_ROW.group] === g.id + 1 && q.ref === r.ref
                ? 1 + 2 * (strongest[GANG_ROW.control]! / 1000)
                : 1,
          });
    }
    groups = out;
  }
  return wares
    .map((w) => {
      const pulls = groups.map((x) => ({ ...x, p: pull(x.g, w) * x.hold })).filter((x) => x.p > 0),
        sum = pulls.reduce((s, x) => s + x.p, 0),
        carried = pulls.length ? captured : 0,
        carriers = pulls
          .map((x) => ({ r: x.r, g: x.g, share: (carried * x.p) / sum }))
          .sort((a, b) => b.share - a.share || a.g.id - b.g.id);
      return { w, worth: w.worth, rent: w.worth * w.wedge, carriers, loose: 1 - carried };
    })
    .sort((a, b) => b.rent - a.rent || a.w.ware - b.w.ware);
}

/** What one group carries in its realm, its greatest three wares: its share of each, and the rent it takes of it a year. */
export function groupCarries(
  world: World,
  r: Polity,
  g: CrimeGroup,
): { w: Contraband; share: number; rent: number }[] {
  return carriedIn(world, r)
    .flatMap((c) => {
      const mine = c.carriers.find((x) => x.g.id === g.id && x.r.ref === r.ref);
      return mine ? [{ w: c.w, share: mine.share, rent: mine.share * c.rent }] : [];
    })
    .sort((a, b) => b.rent - a.rent || a.w.ware - b.w.ware)
    .slice(0, 3);
}

/** The world's carriers of each ware: across every realm, the groups that take the most of its rent (at most `n` a ware). */
export function worldCarriers(
  world: World,
  realms: readonly Polity[],
  n = 3,
): {
  ware: number;
  rent: number;
  realms: number;
  top: { r: Polity; g: CrimeGroup; rent: number }[];
}[] {
  const by = new Map<
    number,
    { rent: number; realms: number; top: { r: Polity; g: CrimeGroup; rent: number }[] }
  >();
  for (const r of realms)
    for (const c of carriedIn(world, r)) {
      const e = by.get(c.w.ware) ?? { rent: 0, realms: 0, top: [] };
      e.rent += c.rent;
      e.realms++;
      for (const x of c.carriers) e.top.push({ r: x.r, g: x.g, rent: x.share * c.rent });
      by.set(c.w.ware, e);
    }
  return [...by]
    .map(([ware, e]) => ({
      ware,
      rent: e.rent,
      realms: e.realms,
      top: e.top.sort((a, b) => b.rent - a.rent || a.g.id - b.g.id).slice(0, n),
    }))
    .sort((a, b) => b.rent - a.rent || a.ware - b.ware);
}

/** A ware's name, for a table's first column. */
export const wareTitle = (w: Contraband): string => {
  const s = wareName(w.ware);
  return s[0]!.toUpperCase() + s.slice(1);
};

// —— As pages show it ——————————————————————————————————————————————————————————————————————————————————————

const groupSpan = (x: { r: Polity; g: CrimeGroup }): Span =>
  link(cap(groupWords(x.g.name, kindOfGroup(x.g))), groupRef(x.r.ref, x.g.event));
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  grain = (n: number) => `${count(Math.round(n))} grain's worth`;

/** "Who carries what" in a realm, or in one land of it: each ware, the group carrying most of it, its share, the next, its rent. */
export function carryBlocks(world: World, r: Polity, cell?: number): Block[] {
  const rows: Row[] = carriedIn(world, r, cell).map((c) => {
    const top = c.carriers[0],
      next = c.carriers[1];
    return {
      ...(top ? { ref: groupRef(top.r.ref, top.g.event) } : {}),
      cells: [
        [wareTitle(c.w), ` (${pct(c.w.share)} unseen)`],
        top ? [groupSpan(top)] : ["many small hands"],
        [top ? pct(top.share) : pct(c.loose)],
        next
          ? [groupSpan(next), ` (${pct(next.share)})`]
          : [c.loose > 0 && top ? `many small hands (${pct(c.loose)})` : "—"],
        [`${grain(c.rent)} a year`],
      ],
      keys: [wareName(c.w.ware), top?.g.name ?? "", top?.share ?? 0, next?.share ?? 0, c.rent],
    };
  });
  return rows.length
    ? [
        {
          type: "table",
          title: cell === undefined ? "Who carries what" : "Who carries what here",
          columns: ["What", "Most of it", "Its share", "The next", "Its rent"],
          rows,
          fit: true,
        },
      ]
    : [];
}

/** A group's "What it carries": its share of each of its greatest wares in its realm, and in each of its lands. */
export function groupCarryBlocks(world: World, r: Polity, g: CrimeGroup): Block[] {
  const mine = groupCarries(world, r, g);
  if (!mine.length) return [];
  const rows: Row[] = mine.map((m) => {
    const lands = g.lands
      .slice(0, 6)
      .map((c) => {
        const here = carriedIn(world, r, c)
          .find((x) => x.w.ware === m.w.ware)
          ?.carriers.find((x) => x.g.id === g.id && x.r.ref === r.ref);
        return here ? `${landName(world, c)} ${pct(here.share)}` : null;
      })
      .filter((x): x is string => !!x);
    return {
      cells: [
        [wareTitle(m.w)],
        [pct(m.share)],
        [`${grain(m.rent)} a year`],
        [lands.join(", ") || "—"],
      ],
      keys: [wareName(m.w.ware), m.share, m.rent, lands.length],
    };
  });
  return [
    {
      type: "table",
      title: "Its share of what crosses unseen",
      columns: ["What", "Of the realm's", "Its rent", "In its lands"],
      rows,
      fit: true,
    },
  ];
}

/** The Ledger's world view: each ware, the groups across the world that take most of its rent, and their realms. */
export function worldCarryBlocks(world: World, realms: readonly Polity[]): Block[] {
  const rows: Row[] = worldCarriers(world, realms).map((e) => ({
    cells: [
      [cap(wareName(e.ware))],
      [`${count(e.realms)}`],
      e.top.length
        ? e.top.flatMap((x, i) => [
            ...(i ? ["; "] : []),
            groupSpan(x),
            " of ",
            link(x.r.town, `${x.r.ref}#underworld`),
            ` (${grain(x.rent)})`,
          ])
        : ["many small hands"],
      [`${grain(e.rent)} a year`],
    ],
    keys: [wareName(e.ware), e.realms, e.top[0]?.rent ?? 0, e.rent],
  }));
  return rows.length
    ? [
        {
          type: "table",
          title: "Who carries what, the world over",
          columns: ["What", "Realms", "Who takes most of it", "Its rent"],
          rows,
          fit: true,
        },
      ]
    : [];
}
