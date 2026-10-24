// Bonds and freedoms, read (Phase 19 M138, asked for 2026-10-23: "slavery and forced labour …
// resistance, revolts, abolition … legitimacy, state capacity, corruption … class and caste …
// political memory"): a realm's standing with its people and what makes it, its reach, what is
// skimmed, its rank and the labour it levies; who in its lands is held, in what and why; its
// movements, what it remembers and its law, with the god's hand on them — a land's bound for its
// page, every realm's bonds for the ledger, and the map's lenses of bondage and of standing.
import { cellRef } from "../../gen/index.ts";
import {
  BONDS,
  LAWS,
  LAW_OF,
  LAW_POSITIONS,
  ORDER_EVENTS,
  STIR_SHARE,
  boundIn,
  capacityOf,
  legitimacyFactors,
  mostHeld,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  type Bond,
  type Law,
  type Memory,
  type Movement,
  type Polity,
} from "../../sim/index.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, Item, Part, Row, Stat } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import type { Reading } from "../lenses.ts";
import {
  bare,
  claimOf,
  count,
  item,
  link,
  many,
  part,
  share,
  stat,
  yearAt,
  yearNow,
} from "./words.ts";
import { landLink, landTitle, realmLink } from "./names.ts";

type Rgb = [number, number, number];

/** Each kind of bondage in words: its icon, its name, what it is, its colour, its concept. */
export const BOND_WORDS: Readonly<
  Record<
    Bond,
    {
      readonly icon: string;
      readonly name: string;
      readonly words: string;
      readonly color: Rgb;
      readonly concept: string;
    }
  >
> = {
  chattel: {
    icon: "⛓️",
    name: "Chattel",
    words: "owned outright, bought and sold, their children born to it",
    color: [0.66, 0.18, 0.16],
    concept: "chattel",
  },
  debt: {
    icon: "📜",
    name: "Debt bondage",
    words: "sold themselves for grain, and work off what they owe",
    color: [0.88, 0.58, 0.2],
    concept: "debt-bondage",
  },
  serf: {
    icon: "🌾",
    name: "Serfs",
    words: "bound to the land they till, owing its lord their days",
    color: [0.62, 0.52, 0.26],
    concept: "serfdom",
  },
  indenture: {
    icon: "⏳",
    name: "Indentured",
    words: "bound for seven years for their passage",
    color: [0.38, 0.54, 0.8],
    concept: "indenture",
  },
  convict: {
    icon: "⚒️",
    name: "Convicts",
    words: "the condemned, set to the realm's labour",
    color: [0.46, 0.46, 0.52],
    concept: "convict-labour",
  },
};
const FREE: Rgb = [0.6, 0.76, 0.52];

/** What a realm's movements are for, in words, and their signs. */
export const MOVEMENT_WORDS: Readonly<Record<Movement["cause"], readonly [string, string]>> = {
  abolition: ["🕊️", "To free the bound"],
  land: ["🌾", "The land to those who till it"],
  voice: ["📣", "A voice for the many"],
};

/** What a realm remembers, in words. */
const MEMORY_WORDS: Readonly<Record<Memory["what"], string>> = {
  rising: "✊ A rising of the bound",
  massacre: "🩸 A rising drowned in blood",
  captivity: "⛓️ Its people carried off",
  freedom: "🕊️ A freedom won",
  abolition: "📜 Bondage outlawed",
};

/** Each law by its name on a page, its sign and its concept's words (M139). */
export const LAW_WORDS: Readonly<Record<Law, readonly [string, string]>> = {
  land: ["🌾", "The land"],
  strangers: ["🧳", "Strangers"],
  faith: ["🙏", "Other faiths"],
  justice: ["⚖️", "Justice"],
};

/** What a realm's powerful think of its laws, in words. */
export function approvalWords(x: number): string {
  return x > 0.2
    ? "content with them"
    : x > 0
      ? "mostly content"
      : x > -0.2
        ? "grumbling"
        : "set against them";
}

/** A realm's standing with its people, in words. */
export function legitimacyWords(x: number): string {
  return x < 0.3
    ? "held wrongful"
    : x < 0.45
      ? "doubted"
      : x < 0.65
        ? "accepted"
        : x < 0.8
          ? "held rightful"
          : "revered";
}
/** How far a seat reaches its lands, in words. */
export function reachWords(x: number): string {
  return x < 0.3
    ? "thin: its will fades past the seat"
    : x < 0.5
      ? "felt in its nearer lands"
      : x < 0.7
        ? "felt across its lands"
        : "felt in every village";
}
/** What is skimmed between the lands and the seat, in words. */
export function skimWords(x: number): string {
  return x < 0.05 ? "little" : x < 0.15 ? "some" : x < 0.3 ? "much" : "most of what passes";
}
/** How hard a realm's rank has set, in words. */
export function rankWords(x: number): string {
  return x < 0.25
    ? "open: a life may rise or fall"
    : x < 0.5
      ? "settled: most keep their parents' station"
      : x < 0.75
        ? "hard: born to a station, kept in it"
        : "caste: none leaves the station they are born to";
}

/** A pull on a number in points of a hundred: "+12", "-8". */
const points = (x: number) => `${x >= 0 ? "+" : "-"}${Math.round(Math.abs(x) * 100)}`;

/** A factor as a breakdown's line: its name (a link to what drives it) and its pull. */
const factorPart = (f: {
  readonly name: string;
  readonly contribution: number;
  readonly source: { readonly ref: string } | null;
}): Part => part(f.source ? [link(f.name, f.source.ref)] : f.name, points(f.contribution));

/** How many of a realm's people are held in each kind of bondage, and all its people. */
function heldOf(world: World, r: Polity): { people: number; held: number[]; bound: number } {
  const ctx = populationContext(world),
    held = BONDS.map(() => 0);
  let people = 0;
  for (const c of r.members) {
    people += ctx.provinces.get(c)?.total() ?? 0;
    const b = boundIn(ctx, c).bonds;
    BONDS.forEach((k, i) => (held[i] = held[i]! + b[k]));
  }
  return { people, held, bound: held.reduce((a, b) => a + b, 0) };
}

/** A realm's or the world's people by their bonds, as one bar of shares. */
function whoIsHeld(title: string, people: number, held: readonly number[]): Block {
  const bound = held.reduce((a, b) => a + b, 0),
    all = Math.max(1, people);
  return {
    type: "composition",
    title,
    parts: [
      {
        name: ["Free"],
        share: Math.max(0, people - bound) / all,
        amount: many(Math.max(0, people - bound), "person", "people"),
        color: FREE,
      },
      ...BONDS.flatMap((k, i) =>
        held[i]
          ? [
              {
                name: [
                  link(
                    `${BOND_WORDS[k].icon} ${BOND_WORDS[k].name}`,
                    `concept:${BOND_WORDS[k].concept}`,
                  ),
                ],
                share: held[i]! / all,
                amount: many(held[i]!, "person", "people"),
                color: BOND_WORDS[k].color,
              },
            ]
          : [],
      ),
    ],
    note: `${count(bound)} of ${count(people)} held in bondage`,
  };
}

/** The kind of bondage most of a land's (or a realm's) bound are held in. */
function mostlyAs(bonds: readonly number[]): string {
  let best = -1;
  bonds.forEach((n, i) => {
    if (n > 0 && (best < 0 || n > bonds[best]!)) best = i;
  });
  if (best < 0) return "—";
  const w = BOND_WORDS[BONDS[best]!];
  return `${w.icon} ${w.name}`;
}

/** The newest of the bound's flights told one by one; the rest summed under them. */
const FLIGHTS_TOLD = 3;

/** The events of bonds and freedoms in a realm's lands or about it, newest first. */
function orderHistory(world: World, r: Polity, most = 30): Item[] {
  const lands = new Set(r.members.map((c) => cellRef(0, c) as string)),
    all = world.events.all(),
    out: Item[] = [];
  let flights = 0,
    fled = 0;
  for (let i = all.length - 1; i >= 0 && out.length < most; i--) {
    const e = all[i]!;
    if (!e.type.startsWith("order.") && !/^act\.(unchain|stir|mandate|decree)$/.test(e.type))
      continue;
    if (!e.subjects.includes(r.ref) && !(e.place && lands.has(e.place))) continue;
    if (e.type === ORDER_EVENTS.flight.type && ++flights > FLIGHTS_TOLD) {
      fled += (e.data as { count?: number } | null)?.count ?? 0;
      continue;
    }
    const year = yearAt(e.t);
    out.push(item([`Year ${year}: `, link(bare(claimOf(world, e.id)), e.id)], e.id, year));
  }
  if (flights > FLIGHTS_TOLD)
    out.push(
      item(
        `And ${many(fled, "more", "more")} fled their bonds, ${many(flights - FLIGHTS_TOLD, "flight", "flights")} before these.`,
      ),
    );
  return out;
}

/** A realm's order, as the tab of its page tells it. */
export function realmOrderBlocks(world: World, r: Polity): Block[] {
  const store = orderOf(world),
    o = store?.of(r.ref);
  if (!store || !o)
    return [{ type: "text", lines: [["Its order is not yet reckoned: it is read each year."]] }];
  const ctx = populationContext(world),
    living = r.ended === null,
    factors = living ? legitimacyFactors(ctx, r) : [],
    target = Math.max(0.02, Math.min(0.98, 0.55 + factors.reduce((s, f) => s + f.contribution, 0))),
    cap = capacityOf(ctx, r),
    { people, held, bound } = heldOf(world, r),
    year = yearNow(world);
  const facts: Stat[] = [
    {
      ...stat("Standing", `${share(o.legitimacy)} — ${legitimacyWords(o.legitimacy)}`, {
        why: o.crisis,
        parts: [
          part("where it is heading", share(target)),
          ...[...factors]
            .filter((f) => Math.abs(f.contribution) >= 0.005)
            .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
            .map(factorPart),
        ],
      }),
      concept: "legitimacy",
    },
    {
      ...stat("Reach", `${share(cap.value)} — ${reachWords(cap.value)}`, {
        parts: cap.parts.map(factorPart),
      }),
      concept: "capacity",
    },
    {
      ...stat("Skimmed", `${share(o.corruption)} — ${skimWords(o.corruption)}`),
      concept: "corruption",
    },
    { ...stat("Rank", `${share(o.caste)} — ${rankWords(o.caste)}`), concept: "caste" },
    {
      ...stat(
        "Corvée",
        o.corvee >= 0.01
          ? `${Math.round(o.corvee * 100)} days in a hundred owed to its works`
          : "none owed",
        { why: o.corveeEvent },
      ),
      concept: "corvee",
    },
    {
      ...stat(
        "Held in bondage",
        `${count(bound)} of ${count(people)} (${share(bound / Math.max(1, people))})`,
        {
          parts: BONDS.flatMap((k, i) =>
            held[i] ? [part(`${BOND_WORDS[k].icon} ${BOND_WORDS[k].name}`, count(held[i]!))] : [],
          ),
        },
      ),
      concept: "bondage",
    },
    {
      ...stat(
        "Law of bondage",
        o.abolished !== null ? `outlawed in year ${o.abolished}` : "allows it",
        { why: o.abolition },
      ),
      concept: "abolition",
    },
    ...(o.crisis
      ? [stat("In crisis", [link("its people's faith in its rule lost", o.crisis)])]
      : []),
    ...(o.mandate && year - o.mandate.year < 40
      ? [
          stat("A sign from the heavens", [
            link(
              `${o.mandate.sign > 0 ? "for" : "against"} its rule, year ${o.mandate.year}`,
              o.mandate.event,
            ),
          ]),
        ]
      : []),
  ];
  // Where its bound are held: the lands with the most of them.
  const lands: Row[] = r.members
    .map((c) => ({ c, b: boundIn(ctx, c), n: ctx.provinces.get(c)?.total() ?? 0 }))
    .filter((x) => x.b.people > 0)
    .sort((a, b) => b.b.people - a.b.people || a.c - b.c)
    .slice(0, 12)
    .map(({ c, b, n }) => {
      const l = store.land(c),
        kinds = BONDS.map((k) => b.bonds[k]);
      return {
        ref: cellRef(0, c),
        cells: [
          [landLink(world, c)],
          [count(n)],
          [`${count(b.people)} (${share(b.people / Math.max(1, n))})`],
          [mostlyAs(kinds)],
          l?.cause ? [link(bare(claimOf(world, l.cause)).slice(0, 72), l.cause)] : ["—"],
        ],
        keys: [landTitle(world, c), n, b.people, mostlyAs(kinds), l?.cause ?? ""],
      };
    });
  const movements: Item[] = o.movements.map((m) => {
    const [icon, words] = MOVEMENT_WORDS[m.cause];
    return item(
      [link(`${icon} ${words}`, m.event), ` — ${share(m.strength)} strong, since year ${m.since}`],
      m.event,
      m.since,
    );
  });
  const memory: Item[] = [...o.memory]
    .sort((a, b) => b.year - a.year)
    .map((m) =>
      item(
        [
          link(MEMORY_WORDS[m.what], m.event),
          ` — year ${m.year}, `,
          landLink(world, m.cell),
          m.weight < 0.35 ? " (fading)" : "",
        ],
        m.event,
        m.year,
      ),
    );
  const history = orderHistory(world, r);
  return [
    { type: "facts", rows: facts },
    // Its laws (M139): each its position, the change that made it, and the god's hand on them.
    {
      type: "facts",
      title: "Its laws",
      rows: [
        ...LAWS.map((law) => ({
          ...stat(
            `${LAW_WORDS[law][0]} ${LAW_WORDS[law][1]}`,
            LAW_POSITIONS[law][o.laws[LAW_OF[law]]!]!,
            { why: o.lawEvents[LAW_OF[law]] },
          ),
          concept: "laws",
        })),
        {
          ...stat("Its powerful", `${points(o.approval)} — ${approvalWords(o.approval)}`),
          concept: "laws",
        },
      ],
    },
    ...(living
      ? [
          {
            type: "tool" as const,
            tool: "acts.laws",
            args: {
              realm: r.ref,
              laws: LAWS.map((law) => [
                law,
                `${LAW_WORDS[law][0]} ${LAW_WORDS[law][1]}`,
                o.laws[LAW_OF[law]]!,
                LAW_POSITIONS[law],
              ]),
            },
          },
        ]
      : []),
    whoIsHeld("Who is held, and how", people, held),
    ...(lands.length
      ? [
          {
            type: "table" as const,
            title: "Where they are held",
            columns: ["Land", "People", "Held", "Mostly as", "Bound by"],
            rows: lands,
          },
        ]
      : []),
    {
      type: "list",
      title: "Movements among its people",
      items: movements.length
        ? movements
        : [item("None stirs: its people are not moved to change its order.")],
    },
    ...(memory.length
      ? [{ type: "list" as const, title: "What its people remember", items: memory }]
      : []),
    // The god's hand on its order (M138).
    ...(living
      ? [
          {
            type: "tool" as const,
            tool: "acts.order",
            args: {
              realm: r.ref,
              bound,
              stirrable: mostHeld(store, r) !== null,
              stir: Math.round(STIR_SHARE * 100),
              standing: o.legitimacy,
            },
          },
        ]
      : []),
    ...(history.length
      ? [{ type: "list" as const, title: "Bonds and freedoms, newest first", items: history }]
      : []),
  ];
}

/** A land's bound, for its page: how many are held and in what, why, and its realm's law. */
export function landBondBlocks(world: World, cell: number): Block[] {
  const store = orderOf(world);
  if (!store) return [];
  const ctx = populationContext(world),
    people = ctx.provinces.get(cell)?.total() ?? 0,
    l = store.land(cell),
    realm = politiesOf(world).of(cell),
    o = realm ? store.of(realm.ref) : undefined,
    b = boundIn(ctx, cell),
    year = yearNow(world);
  if (!b.people && !o) return [];
  const rows: Stat[] = [
    {
      ...stat(
        "Held in bondage",
        b.people
          ? `${count(b.people)} of ${count(people)} (${share(b.people / Math.max(1, people))})`
          : "none",
        {
          why: l?.cause ?? null,
          parts: BONDS.flatMap((k) =>
            b.bonds[k]
              ? [part(`${BOND_WORDS[k].icon} ${BOND_WORDS[k].name}`, count(b.bonds[k]))]
              : [],
          ),
        },
      ),
      concept: "bondage",
    },
    ...(l?.quiet && l.quiet > year
      ? [
          {
            ...stat("Cowed", `none will rise here before year ${l.quiet}`, { why: l.cause }),
            concept: "rising",
          },
        ]
      : []),
    ...(realm && o
      ? [
          {
            ...stat(
              "Its realm's law",
              o.abolished !== null ? `bondage outlawed in year ${o.abolished}` : "allows bondage",
              {
                why: o.abolition,
              },
            ),
            concept: "abolition",
          },
          {
            ...stat("Its realm's standing", [
              realmLink(world, realm.ref),
              `: ${share(o.legitimacy)}, ${legitimacyWords(o.legitimacy)}`,
            ]),
            concept: "legitimacy",
          },
        ]
      : []),
  ];
  return [
    { type: "facts", title: "Bonds and freedoms", rows },
    ...(b.people
      ? [
          whoIsHeld(
            "Its people by their bonds",
            people,
            BONDS.map((k) => b.bonds[k]),
          ),
        ]
      : []),
  ];
}

/** Every realm's bonds side by side, for the ledger. */
export function bondsLedger(world: World): Block[] {
  const store = orderOf(world);
  if (!store) return [];
  const realms = politiesOf(world)
      .living()
      .map((r) => ({ r, o: store.of(r.ref), ...heldOf(world, r) }))
      .filter((x) => x.people > 0),
    worldHeld = BONDS.map((_, i) => realms.reduce((s, x) => s + x.held[i]!, 0)),
    worldPeople = realms.reduce((s, x) => s + x.people, 0);
  const rows: Row[] = [...realms]
    .sort((a, b) => b.bound - a.bound || b.people - a.people || (a.r.ref < b.r.ref ? -1 : 1))
    .map(({ r, o, people, held, bound }) => ({
      ref: r.ref,
      cells: [
        [realmLink(world, r.ref)],
        [count(people)],
        [`${count(bound)} (${share(bound / Math.max(1, people))})`],
        [mostlyAs(held)],
        [o ? `${share(o.legitimacy)}, ${legitimacyWords(o.legitimacy)}` : "—"],
        [o ? share(o.caste) : "—"],
        [
          o && o.abolished !== null
            ? link(`outlawed, year ${o.abolished}`, o.abolition)
            : "allows it",
        ],
      ],
      keys: [
        realmName(r),
        people,
        bound,
        mostlyAs(held),
        o?.legitimacy ?? 0,
        o?.caste ?? 0,
        o?.abolished ?? 1e9,
      ],
    }));
  // The risings of the bound, and how each ended.
  const all = world.events.all(),
    risings: Item[] = [],
    outlawed: Item[] = [];
  for (let i = all.length - 1; i >= 0; i--) {
    const e = all[i]!;
    if (e.type === ORDER_EVENTS.freed.type || e.type === ORDER_EVENTS.crushed.type) {
      if (risings.length < 20)
        risings.push(
          item(
            [`Year ${yearAt(e.t)}: `, link(bare(claimOf(world, e.id)), e.id)],
            e.id,
            yearAt(e.t),
          ),
        );
    } else if (e.type === ORDER_EVENTS.abolished.type)
      outlawed.push(
        item([`Year ${yearAt(e.t)}: `, link(bare(claimOf(world, e.id)), e.id)], e.id, yearAt(e.t)),
      );
  }
  return [
    {
      type: "bars",
      title: "The bound, realm by realm",
      unit: "people",
      bars: [...realms]
        .filter((x) => x.bound > 0)
        .sort((a, b) => b.bound - a.bound || (a.r.ref < b.r.ref ? -1 : 1))
        .slice(0, 12)
        .map(({ r, bound }) => ({
          label: [realmName(r)],
          ref: r.ref,
          value: bound,
          color: realmColor(r.ref),
        })),
    },
    whoIsHeld("The world's people by their bonds", worldPeople, worldHeld),
    {
      type: "table",
      title: "Each realm's order",
      columns: ["Realm", "People", "Held", "Mostly as", "Standing", "Rank", "Law"],
      rows,
    },
    {
      type: "table",
      title: "Each realm's laws",
      columns: ["Realm", ...LAWS.map((law) => LAW_WORDS[law][1])],
      rows: [...realms]
        .sort((a, b) => b.people - a.people || (a.r.ref < b.r.ref ? -1 : 1))
        .flatMap(({ r, o }) =>
          o
            ? [
                {
                  ref: `${r.ref}#order`,
                  cells: [
                    [realmLink(world, r.ref)],
                    ...LAWS.map((law) => [
                      link(LAW_POSITIONS[law][o.laws[LAW_OF[law]]!]!, o.lawEvents[LAW_OF[law]]),
                    ]),
                  ],
                  keys: [realmName(r), ...LAWS.map((law) => o.laws[LAW_OF[law]]!)],
                },
              ]
            : [],
        ),
    },
    {
      type: "list",
      title: "Risings of the bound, newest first",
      items: risings.length ? risings : [item("No rising yet: the bound have not taken up arms.")],
    },
    ...(outlawed.length
      ? [
          {
            type: "list" as const,
            title: "Where bondage was outlawed, newest first",
            items: outlawed,
          },
        ]
      : []),
  ];
}

/** A land under the lens of bondage: the share of its people held, in what, and why. */
export function bondageReading(world: World, cell: number): Reading {
  const ctx = populationContext(world),
    store = orderOf(world),
    b = boundIn(ctx, cell),
    people = ctx.provinces.get(cell)?.total() ?? 0,
    l = store?.land(cell),
    realm = politiesOf(world).of(cell),
    o = realm ? store?.of(realm.ref) : undefined;
  return {
    line: b.people
      ? `Bondage: ${share(b.people / Math.max(1, people))} of its people held`
      : "Bondage: none held here",
    stats: [
      ...BONDS.flatMap((k) =>
        b.bonds[k]
          ? [{ label: `${BOND_WORDS[k].icon} ${BOND_WORDS[k].name}`, value: count(b.bonds[k]) }]
          : [],
      ),
      ...(l?.cause ? [{ label: "Bound by", value: briefly(claimOf(world, l.cause)) }] : []),
      {
        label: "Its realm's law",
        value: !realm
          ? "no realm's"
          : o && o.abolished !== null
            ? `outlawed, year ${o.abolished}`
            : "allows it",
      },
    ],
  };
}

/** A land under the lens of standing: how far its people hold its realm's rule rightful, and why. */
export function standingReading(world: World, cell: number): Reading {
  const realm = politiesOf(world).of(cell),
    o = realm ? orderOf(world)?.of(realm.ref) : undefined;
  if (!realm || realm.ended !== null || !o)
    return { line: "Standing: no realm rules here", stats: [] };
  const factors = legitimacyFactors(populationContext(world), realm)
    .filter((f) => Math.abs(f.contribution) >= 0.005)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 4);
  return {
    line: `Standing: ${realmName(realm)} ${legitimacyWords(o.legitimacy)} (${share(o.legitimacy)})`,
    stats: [
      ...factors.map((f) => ({ label: f.name, value: points(f.contribution) })),
      { label: "Skimmed", value: share(o.corruption) },
      { label: "Rank", value: share(o.caste) },
    ],
  };
}

/** A land under the lens of a law: its realm's position, the change that made it, what it does. */
export function lawReading(world: World, cell: number, law: Law): Reading {
  const realm = politiesOf(world).of(cell),
    o = realm && realm.ended === null ? orderOf(world)?.of(realm.ref) : undefined,
    [icon, name] = LAW_WORDS[law];
  if (!realm || !o) return { line: `${name}: no realm's law here`, stats: [] };
  const k = LAW_OF[law],
    changed = o.lawEvents[k];
  return {
    line: `${icon} ${name}: ${LAW_POSITIONS[law][o.laws[k]!]} — ${realmName(realm)}`,
    stats: [
      ...(changed ? [{ label: "Since", value: briefly(claimOf(world, changed)) }] : []),
      { label: "Its powerful", value: approvalWords(o.approval) },
    ],
  };
}

/** A line's words cut to a tooltip's width. */
function briefly(words: string): string {
  const w = bare(words);
  return w.length > 64 ? `${w.slice(0, 61)}…` : w;
}

/** A realm's standing and share held, for a land's map readings (null: no realm's). */
export function orderReadings(
  world: World,
): (cell: number) => { bondage: number; standing: number; laws: readonly number[] } {
  const store = orderOf(world),
    realms = politiesOf(world);
  return (cell) => {
    const realm = realms.of(cell),
      o = realm && realm.ended === null ? store?.of(realm.ref) : undefined;
    return {
      bondage: Math.round((store?.bound(cell) ?? 0) * 1000) / 1000,
      // (A land of no realm reads -1: not shown under the lens.)
      standing: o ? Math.round(o.legitimacy * 1000) / 1000 : -1,
      // (Each law's position, 0 … 2, by LAWS; none for a land of no realm.)
      laws: o ? [...o.laws] : [],
    };
  };
}
