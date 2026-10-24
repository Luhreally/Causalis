// Sickness, read (Phase 20 M140, asked for 2026-10-23: "health and epidemiology — pathogens,
// immunity, epidemics, sanitation, medicine, public health, healthcare inequality"): a sickness's
// page — its nature, its rising, where it is now, who is spared it, its comings and its dead, a
// drop of a sick one's blood under the glass, and the god's hand on it; a land's health for its
// page; every sickness side by side for the ledger; and the map's lens of sickness.
import { seedFromText, type Ref, type World } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  HEALTH_EVENTS,
  SICK,
  healthOf,
  loreOf,
  orderOf,
  populationContext,
  type Route,
  type Sickness,
  type Via,
} from "../../sim/index.ts";
import { ROUTE_WORDS, SOURCE_WORDS, VIA_WORDS, oneIn, sparedWords } from "../../causal/index.ts";
import type { Block, DropKind, Item, PageModel, Row, Span, Stat, Tab } from "../../bridge/index.ts";
import type { Reading } from "../lenses.ts";
import {
  claimOf,
  bare,
  count,
  eventsAbout,
  item,
  link,
  share,
  stat,
  yearAt,
  yearNow,
} from "./words.ts";
import { landLink, landTitle, spotOfLand } from "./names.ts";

type Rgb = [number, number, number];

export const SICK_ICON = "🦠";

/** Each way a sickness passes: its colour on its page. */
export const ROUTE_COLOR: Readonly<Record<Route, Rgb>> = {
  breath: [0.56, 0.64, 0.82],
  water: [0.3, 0.6, 0.62],
  vermin: [0.58, 0.4, 0.24],
  touch: [0.7, 0.42, 0.56],
};

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A sickness by its name, a link to its page. */
export function sicknessLink(world: World, ref: string | null | undefined): Span {
  const s = ref ? healthOf(world)?.get(ref) : undefined;
  return s ? link(cap(s.name), s.ref) : "a sickness";
}

/** The comings of sickness the record still holds (of one, or of all), newest first. */
function comingsOf(world: World, sickness?: Ref) {
  return world.events
    .all()
    .filter(
      (e) => e.type === HEALTH_EVENTS.outbreak.type && (!sickness || e.subjects.includes(sickness)),
    )
    .reverse();
}

type Coming = { from?: number | null; via?: Via | null; people?: number; dead?: number };

/** A coming in a line: where, when, how many died, and whence. */
function comingLine(world: World, e: { place: Ref | null; t: number; data: unknown }): Span[] {
  const d = e.data as Coming | null,
    cell = e.place ? Number(e.place.split(":")[2]) : -1,
    dead = d?.dead ?? 0,
    people = d?.people ?? 0;
  return [
    ...(cell >= 0 ? [landLink(world, cell)] : ["a land"]),
    ` — year ${yearAt(e.t)}: ${count(dead)} dead`,
    ...(people ? [` (${share(dead / people)})`] : []),
    ...(d?.from !== null && d?.from !== undefined
      ? [`, ${VIA_WORDS[d.via ?? "near"]} from `, landLink(world, d.from)]
      : d?.via === "god"
        ? [", by the god's hand"]
        : []),
  ];
}

/** A drop of a sick one's blood under the glass: the sickness multiplying, the body's guards hunting it. */
function underTheGlass(s: Sickness): Block {
  const size: Record<Route, number> = { breath: 1.1, water: 2.4, vermin: 1.8, touch: 1.5 },
    guards = 0.15 + 0.5 * (1 - Math.min(1, s.deadliness / 0.35)),
    kinds: DropKind[] = [
      {
        ref: s.ref,
        name: cap(s.name),
        line: "a sickness",
        way: "eater",
        color: ROUTE_COLOR[s.route],
        size: size[s.route],
        share: 1 - guards,
      },
      {
        ref: "concept:immunity",
        name: "the body's guards",
        line: "the sick one's own cells",
        way: "hunter",
        color: [0.9, 0.88, 0.96],
        size: 12,
        share: guards,
      },
    ];
  return {
    type: "drop",
    title: "A drop of a sick one's blood, under the glass",
    habitat: "fresh",
    seed: seedFromText(`sickness ${s.ref}`).lo >>> 0,
    light: 0.35,
    warmth: 37,
    food: 0.9,
    kinds,
    focus: s.ref,
    words: `${cap(s.name)} multiplies on what the body gives it; the body's guards hunt it and take it in. Where they take it faster than it grows, the sick one lives — and is spared it ${sparedWords(s)}. Tap a cell to follow it.`,
  };
}

/** A sickness: its nature, its rising, where it is now, who is spared it, its comings. */
export function sicknessPage(world: World, ref: string): PageModel {
  const store = healthOf(world),
    s = store?.get(ref);
  if (!store || !s) throw new Error(`no sickness ${ref}`);
  const ctx = populationContext(world),
    year = yearNow(world),
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    now = [...store.lands.values()]
      .filter((l) => l.last?.sickness === s.ref && l.last.year >= year - 1)
      .sort((a, b) => b.last!.dead - a.last!.dead || a.cell - b.cell),
    spared = [...store.lands.values()]
      .map((l) => ({ cell: l.cell, v: store.immune(l.cell, s.ref) }))
      .filter((x) => x.v >= 0.05 && peopleOf(x.cell) > 0)
      .sort((a, b) => b.v * peopleOf(b.cell) - a.v * peopleOf(a.cell) || a.cell - b.cell),
    comings = comingsOf(world, s.ref),
    facts: Stat[] = [
      { ...stat("It passes", ROUTE_WORDS[s.route]), concept: "sickness" },
      {
        ...stat("Of those it reaches", `${oneIn(s.reach)} take it, if they never had it`),
        concept: "outbreak",
      },
      { ...stat("Of those who take it", `${oneIn(s.deadliness)} die`), concept: "sickness" },
      { ...stat("The survivors", `are spared it ${sparedWords(s)}`), concept: "immunity" },
      stat(
        "It rose",
        [`${SOURCE_WORDS[s.source]} of `, landLink(world, s.cell), `, year ${s.year}`],
        {
          why: s.event,
        },
      ),
      stat("Lands it came to", count(s.struck)),
      stat("Its dead", count(s.dead)),
      s.ended !== null
        ? stat("Gone", `unseen since year ${s.last}`)
        : year - s.last >= SICK.sleeps
          ? stat("Sleeping", `unseen since year ${s.last}, where it rose`)
          : stat("Last seen", `year ${s.last}`),
    ];
  const nowRows: Row[] = now.map((l) => ({
      ref: cellRef(0, l.cell),
      cells: [
        [landLink(world, l.cell)],
        [`year ${l.last!.year}`],
        [count(l.last!.dead)],
        [share(l.last!.share)],
      ],
      keys: [landTitle(world, l.cell), l.last!.year, l.last!.dead, l.last!.share],
    })),
    sparedRows: Row[] = spared.slice(0, 40).map((x) => ({
      ref: cellRef(0, x.cell),
      cells: [[landLink(world, x.cell)], [share(x.v)], [count(peopleOf(x.cell))]],
      keys: [landTitle(world, x.cell), x.v, peopleOf(x.cell)],
    })),
    items: Item[] = comings
      .slice(0, 40)
      .map((e) => ({ ...item(comingLine(world, e), e.id, yearAt(e.t)), why: e.id }));
  const tabs: Tab[] = [
    {
      id: "overview",
      name: "Overview",
      blocks: [
        { type: "facts", rows: facts },
        { type: "why", title: "How it rose", ref: s.event },
        {
          type: "chart",
          title: "Its dead, decade by decade",
          points: s.byDecade.map((n, k) => ({ x: s.year + 10 * k, y: n })),
          unit: "people",
        },
        underTheGlass(s),
        {
          type: "tool",
          tool: "acts.sickness",
          args: {
            sickness: s.ref,
            name: cap(s.name),
            cell: s.cell,
            home: landTitle(world, s.cell),
          },
        },
      ],
    },
    {
      id: "lands",
      name: "Lands",
      blocks: [
        {
          type: "table",
          title: "Where it is now",
          columns: ["Land", "Came", "Dead", "Of its people"],
          rows: nowRows,
        },
        {
          type: "table",
          title: "Who is spared it",
          columns: ["Land", "Spared", "People"],
          rows: sparedRows,
        },
      ],
    },
    {
      id: "comings",
      name: "Comings",
      blocks: [
        {
          type: "list",
          title: "Its comings, newest first",
          items,
          ...(comings.length > items.length ? { more: comings.length - items.length } : {}),
        },
      ],
    },
  ];
  const history = eventsAbout(world, [s.ref], 30);
  if (history.length)
    tabs.push({ id: "history", name: "History", blocks: [{ type: "list", items: history }] });
  const spot = spotOfLand(world, s.cell);
  return {
    ref: s.ref,
    kind: "sickness",
    icon: SICK_ICON,
    title: cap(s.name),
    subtitle: [
      `A sickness that passes ${ROUTE_WORDS[s.route]}, risen ${SOURCE_WORDS[s.source]} of `,
      landLink(world, s.cell),
      ` in year ${s.year}`,
    ],
    color: ROUTE_COLOR[s.route],
    place: spot === null ? null : { scale: "globe", spot },
    stats: [
      stat("Its dead", count(s.dead)),
      stat("Lands", count(s.struck)),
      stat("Kills", `${oneIn(s.deadliness)} who take it`),
      stat("Rose", `year ${s.year}`, { why: s.event }),
    ],
    tabs,
    followable: false,
    year,
  };
}

/** The share of a land's people its healers spare (as the sim reckons it), and the lore behind it. */
function healersOf(world: World, cell: number): number {
  return Math.min(0.6, 2 * loreOf(world).effect(cell, "health"));
}

/** A land's health: what came last and what it took, who is spared what, its healers and drains. */
export function landHealthBlocks(world: World, cell: number): Block[] {
  const store = healthOf(world);
  if (!store) return [];
  const l = store.land(cell),
    year = yearNow(world),
    healers = healersOf(world, cell),
    drains = loreOf(world).get(cell, "sanitation"),
    bound = orderOf(world)?.bound(cell) ?? 0,
    rows: Stat[] = [];
  if (l?.last)
    rows.push(
      {
        ...stat("Last came", [sicknessLink(world, l.last.sickness), `, year ${l.last.year}`], {
          why: l.last.event,
        }),
        concept: "outbreak",
      },
      {
        ...stat("It took", `${count(l.last.dead)} of its people (${share(l.last.share)})`, {
          why: l.last.event,
        }),
        concept: l.last.share >= SICK.great ? "great-dying" : "outbreak",
      },
    );
  else rows.push({ ...stat("Sickness", "none has come here"), concept: "sickness" });
  for (const [ref, v] of l?.immune ?? [])
    if (v >= 0.05)
      rows.push({
        ...stat(`Spared ${store.get(ref)?.name ?? "a sickness"}`, share(v)),
        concept: "immunity",
      });
  rows.push({
    ...stat(
      "Its healers",
      healers > 0 ? `spare ${oneIn(healers)} who would die` : "know nothing to do",
    ),
    concept: "healers",
  });
  rows.push({
    ...stat("Drains and clean water", drains ? `since year ${drains.year}` : "none", {
      why: drains?.event ?? null,
    }),
    concept: "drains",
  });
  if (bound > 0.01)
    rows.push({
      ...stat(
        "The bound",
        `${share(bound)} of its people — they die ${SICK.bound === 1.5 ? "half again" : `${SICK.bound} times`} as often as the free`,
      ),
      concept: "unequal-dying",
    });
  if (l?.ward)
    rows.push({
      ...stat("Warded by the god", `year ${l.ward.year}`, { why: l.ward.event }),
      concept: "immunity",
    });
  if (l && l.struck > 1)
    rows.push({
      ...stat("Comings here", `${count(l.struck)}, ${count(l.dead)} dead`),
      concept: "outbreak",
    });
  const comings = comingsOf(world)
    .filter((e) => e.place === cellRef(0, cell))
    .slice(0, 12);
  const living = store.living().slice(0, 4);
  return [
    { type: "facts", title: "Sickness", rows },
    ...(comings.length
      ? [
          {
            type: "list" as const,
            title: "Sicknesses that came, newest first",
            items: comings.map((e) => ({
              ...item(
                [
                  sicknessLink(world, e.subjects[0] ?? null),
                  ` — year ${yearAt(e.t)}: ${count((e.data as Coming | null)?.dead ?? 0)} dead`,
                ],
                e.id,
                yearAt(e.t),
              ),
              why: e.id,
            })),
          },
        ]
      : []),
    {
      type: "tool",
      tool: "acts.health",
      args: {
        cell,
        land: landTitle(world, cell),
        warded: l?.ward ? l.ward.year === year : false,
        sicknesses: living.map((s) => [s.ref, cap(s.name)]),
      },
    },
  ];
}

/** Every sickness side by side, for the ledger. */
export function sicknessLedger(world: World): Block[] {
  const store = healthOf(world);
  if (!store) return [];
  const all = [...store.sicknesses].sort((a, b) => b.dead - a.dead || (a.ref < b.ref ? -1 : 1)),
    greats = comingsOf(world)
      .filter((e) => e.importance >= 6)
      .slice(0, 20);
  return [
    {
      type: "bars",
      title: "The dead, sickness by sickness",
      bars: all.slice(0, 12).map((s) => ({
        label: [sicknessLink(world, s.ref)],
        ref: s.ref,
        value: s.dead,
        color: ROUTE_COLOR[s.route],
      })),
      unit: "people",
    },
    {
      type: "table",
      title: "Every sickness",
      columns: ["Sickness", "Rose", "Passes", "Kills", "Lands", "Dead", "Last seen"],
      rows: all.map((s) => ({
        ref: s.ref,
        cells: [
          [sicknessLink(world, s.ref)],
          [`year ${s.year}`],
          [ROUTE_WORDS[s.route]],
          [oneIn(s.deadliness)],
          [count(s.struck)],
          [count(s.dead)],
          [s.ended !== null ? `gone (${s.last})` : `year ${s.last}`],
        ],
        keys: [s.name, s.year, s.route, s.deadliness, s.struck, s.dead, s.last],
      })),
    },
    {
      type: "lines",
      title: "The dead of sickness, decade by decade",
      series: all.slice(0, 6).map((s) => ({
        name: cap(s.name),
        ref: s.ref,
        color: ROUTE_COLOR[s.route],
        points: s.byDecade.map((n, k) => ({ x: s.year + 10 * k, y: n })),
      })),
      unit: "people",
    },
    {
      type: "list",
      title: "Great dyings, newest first",
      items: greats.map((e) => ({
        ...item(
          [sicknessLink(world, e.subjects[0] ?? null), " in ", ...comingLine(world, e)],
          e.id,
          yearAt(e.t),
        ),
        why: e.id,
      })),
    },
  ];
}

/** How deep a land's last sickness cut, faded over the years after (0 … 1; 0: none lately). */
export function sicknessValue(world: World, cell: number): number {
  const l = healthOf(world)?.land(cell)?.last;
  if (!l) return 0;
  const age = yearNow(world) - l.year;
  return age >= 6 ? 0 : Math.min(1, (l.share / SICK.great) * (1 - age / 6));
}

/** A land under the lens of sickness: what came last and what it took, who is spared, its healers. */
export function sicknessReading(world: World, cell: number): Reading {
  const store = healthOf(world),
    l = store?.land(cell),
    year = yearNow(world),
    healers = healersOf(world, cell);
  const spared = (l?.immune ?? [])
    .filter(([, v]) => v >= 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([ref, v]) => ({
      label: `Spared ${store?.get(ref)?.name ?? "it"}`,
      value: share(v),
    }));
  const line = !l?.last
    ? `${SICK_ICON} Sickness: none has come here`
    : `${SICK_ICON} Sickness: ${cap(store?.get(l.last.sickness)?.name ?? "a sickness")} came ${year - l.last.year <= 0 ? "this year" : year - l.last.year === 1 ? "last year" : `${year - l.last.year} years ago`} — ${share(l.last.share)} of its people died`;
  return {
    line,
    stats: [
      ...(l?.last?.from !== null && l?.last?.from !== undefined
        ? [
            {
              label: "Came",
              value: `${VIA_WORDS[l.last.via ?? "near"]}, from ${landTitle(world, l.last.from)}`,
            },
          ]
        : []),
      ...spared,
      { label: "Its healers", value: healers > 0 ? `spare ${oneIn(healers)}` : "none" },
    ],
  };
}

/** The why of a land's last sickness, in a line (for a tooltip's "since"). */
export function sicknessSince(world: World, cell: number): string | null {
  const l = healthOf(world)?.land(cell)?.last;
  return l ? bare(claimOf(world, l.event)) : null;
}

/** The world's sicknesses in a few words: how many rose, how many are about, the dead. */
export function sicknessCount(world: World): { rose: number; about: number; dead: number } {
  const store = healthOf(world);
  if (!store) return { rose: 0, about: 0, dead: 0 };
  const year = yearNow(world);
  return {
    rose: store.sicknesses.length,
    about: store.living().filter((s) => year - s.last < SICK.sleeps).length,
    dead: store.sicknesses.reduce((a, s) => a + s.dead, 0),
  };
}

/** How many lands a sickness is in now (came this year or last). */
export function sicknessNow(world: World, s: Sickness): number {
  const store = healthOf(world),
    year = yearNow(world);
  if (!store) return 0;
  let n = 0;
  for (const l of store.lands.values())
    if (l.last?.sickness === s.ref && l.last.year >= year - 1) n++;
  return n;
}
