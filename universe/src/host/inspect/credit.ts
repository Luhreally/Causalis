// Credit, read (Phase 21 M143, asked for 2026-10-23: "debt, credit, banking"): a house of
// lending's page — what it holds, is owed, earned and lost, whom it lent to and how that ended;
// a land's debts for its page; every house side by side, and what is owed to them year by year,
// for the ledger. (M144: a realm's debts and war chests for its page, a war's chests for its;
// repudiations and jubilees; the god's hand on a land's debts; the lens of debt.)
import type { Ref, World } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  CREDIT,
  creditOf,
  debtBurden,
  politiesOf,
  populationContext,
  warsOf,
  type Loan,
  type War,
} from "../../sim/index.ts";
import type { Block, Item, PageModel, Span, Stat } from "../../bridge/index.ts";
import type { Reading } from "../lenses.ts";
import { claimOf, count, item, link, share, stat, yearNow } from "./words.ts";
import { landLink, landTitle, realmLink, spotOfLand } from "./names.ts";

export const HOUSE_ICON = "🏦";
type Rgb = [number, number, number];
const GOLD: Rgb = [0.86, 0.7, 0.3],
  LOST: Rgb = [0.75, 0.32, 0.28];
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A house of lending by its name, a link to its page. */
export function houseLink(world: World, ref: string | null | undefined): Span {
  const h = ref ? creditOf(world)?.house(ref) : undefined;
  return h ? link(cap(h.name), h.ref) : "a house of lending";
}

const ENDS: Readonly<Record<NonNullable<Loan["end"]>, string>> = {
  paid: "paid off",
  lost: "written off",
  forgiven: "forgiven",
  repudiated: "repudiated",
  released: "released",
};

/** A loan in a line: to (or from) whom, how much, at what interest, and how it stands. */
function loanLine(world: World, l: Loan, from: "house" | "land"): Item {
  // (A war chest says which war: the realm's enemy in it.)
  const war = l.war ? warsOf(world).get(l.war) : undefined,
    enemy = war && l.realm ? (war.attacker === l.realm ? war.defender : war.attacker) : null,
    forWar: Span[] = enemy
      ? [", for its war with ", realmLink(world, enemy)]
      : l.realm
        ? [", for its war"]
        : [],
    who: Span[] =
      from === "land"
        ? [houseLink(world, l.house), ...forWar]
        : l.realm
          ? [realmLink(world, l.realm), ...forWar]
          : [landLink(world, l.cell)];
  return {
    ...item(
      [
        ...who,
        ` — year ${l.year}: ${count(l.lent)} grain at ${Math.round(l.rate * 100)} in a hundred; `,
        l.ended === null
          ? `owes ${count(Math.round(l.owed))}, paid ${count(Math.round(l.paid))}`
          : `${ENDS[l.end!]} in year ${l.ended}`,
      ],
      l.event,
      l.year,
    ),
    why: l.endEvent ?? l.event,
  };
}

/** A house of lending: what it holds, is owed, earned and lost; whom it lent to. */
export function housePage(world: World, ref: string): PageModel {
  const store = creditOf(world),
    h = store?.house(ref);
  if (!store || !h) throw new Error(`no house ${ref}`);
  const year = yearNow(world),
    owed = store.outstanding(h.ref),
    open = store.loans.filter((l) => l.house === h.ref && l.ended === null),
    ended = store.loans.filter((l) => l.house === h.ref && l.ended !== null),
    facts: Stat[] = [
      { ...stat("It holds", `${count(Math.round(h.capital))} grain's worth`), concept: "credit" },
      { ...stat("Owed it now", `${count(Math.round(owed))} grain`), concept: "debt" },
      { ...stat("Lent, ever", `${count(h.lentEver)} grain`), concept: "credit" },
      { ...stat("Earned in interest", `${count(Math.round(h.earned))}`), concept: "debt" },
      {
        ...stat("Lost to debts never paid", `${count(Math.round(h.lost))}`),
        concept: "house-failure",
      },
      { ...stat("Drawn by its family", `${count(Math.round(h.drawn))}`), concept: "credit" },
      stat("It began", [landLink(world, h.cell), `, year ${h.year}, its stake ${count(h.stake)}`], {
        why: h.event,
      }),
      ...(h.failed !== null
        ? [
            {
              ...stat("It failed", `year ${h.failed}`, { why: h.failedEvent }),
              concept: "house-failure",
            },
          ]
        : []),
    ],
    spot = spotOfLand(world, h.cell);
  return {
    ref: h.ref,
    kind: "house",
    icon: HOUSE_ICON,
    title: cap(h.name),
    subtitle: [
      `A house of lending in `,
      landLink(world, h.cell, true),
      h.failed !== null
        ? `, from year ${h.year} until it failed in year ${h.failed}`
        : `, since year ${h.year}`,
    ],
    color: h.failed !== null ? LOST : GOLD,
    place: spot === null ? null : { scale: "globe", spot },
    stats: [
      stat("Holds", count(Math.round(h.capital))),
      stat("Owed it", count(Math.round(owed))),
      stat("Lent", count(h.lentEver)),
      stat("Since", `year ${h.year}`, { why: h.event }),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "facts", rows: facts },
          {
            type: "list",
            title: "What is owed it, the most first",
            items: open
              .sort((a, b) => b.owed - a.owed || a.id - b.id)
              .map((l) => loanLine(world, l, "house")),
          },
          { type: "why", ref: h.ref },
        ],
      },
      {
        id: "loans",
        name: "Loans",
        blocks: [
          {
            type: "list",
            title: "Loans ended, the newest first",
            items: ended
              .sort((a, b) => b.ended! - a.ended! || b.id - a.id)
              .map((l) => loanLine(world, l, "house")),
          },
        ],
      },
    ],
    followable: false,
    year,
  };
}

/** A land's debts, for its page: what it owes, to whom, against its harvest; its own house. */
export function landCreditBlocks(world: World, cell: number): Block[] {
  const store = creditOf(world);
  if (!store) return [];
  const mine = store.loans.filter((l) => l.cell === cell),
    here = store.standing().filter((h) => h.cell === cell);
  if (!mine.length && !here.length) return [];
  const ctx = populationContext(world),
    open = mine.filter((l) => l.ended === null),
    owed = open.reduce((a, l) => a + l.owed, 0),
    burden = debtBurden(ctx, cell),
    rows: Stat[] = [
      {
        ...stat(
          "It owes",
          open.length
            ? [
                `${count(Math.round(owed))} grain, to `,
                ...[...new Set(open.map((l) => l.house))].flatMap((h, k): Span[] => [
                  ...(k ? [", "] : []),
                  houseLink(world, h),
                ]),
              ]
            : "nothing now",
          { why: open[0]?.event ?? null },
        ),
        concept: "debt",
      },
      ...(open.length
        ? [
            {
              ...stat(
                "Against its harvest",
                `${share(Math.min(9.99, burden))} of a year's food${burden >= CREDIT.crushing ? " — crushing: no house lends it more, and its poor sell themselves" : ""}`,
              ),
              concept: "debt",
            },
          ]
        : []),
      {
        ...stat(
          "Borrowed, ever",
          `${count(mine.reduce((a, l) => a + l.lent, 0))} grain in ${mine.length} loan${mine.length === 1 ? "" : "s"}`,
        ),
        concept: "credit",
      },
      ...here.map((h) => ({
        ...stat("A house lends here", [houseLink(world, h.ref)], { why: h.event }),
        concept: "credit",
      })),
    ];
  return [
    { type: "facts", title: "Debt", rows },
    {
      type: "list",
      title: "Its loans, the newest first",
      items: [...mine]
        .sort((a, b) => b.year - a.year || b.id - a.id)
        .map((l) => loanLine(world, l, "land")),
    },
    {
      type: "tool",
      tool: "acts.credit",
      args: {
        cell,
        land: landTitle(world, cell),
        owes: open.length > 0,
        house: here[0] ? cap(here[0].name) : null,
      },
    },
  ];
}

/** A realm's debts, for its page (M144): what its lands owe, its war chests, its faith with its lenders. */
export function realmCreditBlocks(world: World, realm: Ref): Block[] {
  const store = creditOf(world),
    r = politiesOf(world).get(realm);
  if (!store || !r) return [];
  const members = new Set(r.members),
    open = store.loans.filter((l) => l.ended === null && members.has(l.cell)),
    chests = store.loans.filter((l) => l.realm === realm),
    houses = store.standing().filter((h) => members.has(h.cell)),
    defaults = store.defaults.filter((d) => d.realm === realm),
    jubilees = store.jubilees.filter((j) => j.realm === realm);
  if (!open.length && !chests.length && !houses.length && !defaults.length && !jubilees.length)
    return [];
  const year = yearNow(world),
    faithless = store.faithless(realm, year),
    rows: Stat[] = [
      {
        ...stat(
          "Its lands owe",
          open.length
            ? `${count(Math.round(open.reduce((a, l) => a + l.owed, 0)))} grain, in ${open.length} loan${open.length === 1 ? "" : "s"}`
            : "nothing now",
          { why: open[0]?.event ?? null },
        ),
        concept: "debt",
      },
      {
        ...stat("War chests", chests.length ? `${chests.length}` : "none", {
          why: chests.at(-1)?.event ?? null,
        }),
        concept: "war-chest",
      },
      ...(faithless
        ? [
            {
              ...stat("Held faithless", `since year ${faithless.year}: none lends it for a war`, {
                why: faithless.event,
              }),
              concept: "repudiation",
            },
          ]
        : []),
      ...(jubilees.length
        ? [
            {
              ...stat("Its last jubilee", `year ${jubilees.at(-1)!.year}`, {
                why: jubilees.at(-1)!.event,
              }),
              concept: "jubilee",
            },
          ]
        : []),
    ];
  const told = (d: { year: number; event: Ref }): Item => ({
    ...item([claimOf(world, d.event)], d.event, d.year),
    why: d.event,
  });
  return [
    { type: "facts", title: "Credit", rows },
    {
      type: "list",
      title: "Its war chests, the newest first",
      items: [...chests]
        .sort((a, b) => b.year - a.year || b.id - a.id)
        .map((l) => loanLine(world, l, "land")),
    },
    {
      type: "list",
      title: "Houses of lending in its lands",
      items: houses.map((h) => ({
        ...item(
          [
            houseLink(world, h.ref),
            ", in ",
            landLink(world, h.cell, true),
            `, since year ${h.year}`,
          ],
          h.event,
          h.year,
        ),
        why: h.event,
      })),
    },
    {
      type: "list",
      title: "Debts repudiated and released",
      items: [...defaults, ...jubilees].sort((a, b) => b.year - a.year).map(told),
    },
  ];
}

/** A war's chests, for its page (M144): what each side borrowed to pay its host. */
export function warChestRows(world: World, w: War): Stat[] {
  const store = creditOf(world);
  if (!store) return [];
  const rows: Stat[] = [];
  for (const [side, realm] of [
    ["The attacker's war chest", w.attacker],
    ["The defender's war chest", w.defender],
  ] as const) {
    const l = store.chest(realm, w.ref);
    if (l)
      rows.push({
        ...stat(
          side,
          [
            houseLink(world, l.house),
            ` lent ${count(l.lent)} grain at ${Math.round(l.rate * 100)} in a hundred`,
            l.ended !== null ? `; ${ENDS[l.end!]} in year ${l.ended}` : "",
          ],
          { why: l.event },
        ),
        concept: "war-chest",
      });
  }
  return rows;
}

/** Every house side by side, and what was owed to them year by year, for the ledger. */
export function creditLedger(world: World): Block[] {
  const store = creditOf(world);
  if (!store || !store.houses.length)
    return [
      {
        type: "text",
        lines: [
          [
            "No house of lending has risen yet: lending is known first where coin and reckoning are.",
          ],
        ],
      },
    ];
  const all = [...store.houses].sort((a, b) => b.lentEver - a.lentEver || (a.ref < b.ref ? -1 : 1));
  return [
    {
      type: "bars",
      title: "What each house holds",
      bars: all
        .filter((h) => h.failed === null)
        .slice(0, 12)
        .map((h) => ({
          label: [houseLink(world, h.ref)],
          ref: h.ref,
          value: Math.max(0, Math.round(h.capital)),
          color: GOLD,
        })),
      unit: "count",
    },
    {
      type: "table",
      title: "Every house",
      columns: ["House", "Land", "Since", "Holds", "Owed it", "Lent", "Earned", "Lost", "Failed"],
      rows: all.map((h) => ({
        ref: h.ref,
        cells: [
          [houseLink(world, h.ref)],
          [landLink(world, h.cell)],
          [`year ${h.year}`],
          [count(Math.round(h.capital))],
          [count(Math.round(store.outstanding(h.ref)))],
          [count(h.lentEver)],
          [count(Math.round(h.earned))],
          [count(Math.round(h.lost))],
          [h.failed !== null ? `year ${h.failed}` : "—"],
        ],
        keys: [
          h.name,
          cellRef(0, h.cell),
          h.year,
          h.capital,
          store.outstanding(h.ref),
          h.lentEver,
          h.earned,
          h.lost,
          h.failed ?? 0,
        ],
      })),
    },
    {
      type: "lines",
      title: "Owed to the houses, and lent, year by year",
      series: [
        {
          name: "Owed",
          color: GOLD,
          points: store.years.map((y) => ({ x: y.year, y: y.owed })),
        },
        {
          name: "Lent that year",
          color: [0.45, 0.65, 0.85],
          points: store.years.map((y) => ({ x: y.year, y: y.lent })),
        },
      ],
      unit: "count",
      apart: true,
    },
    {
      type: "list",
      title: "Debts repudiated and jubilees, the newest first",
      items: [...store.defaults, ...store.jubilees]
        .sort((a, b) => b.year - a.year || (a.event < b.event ? 1 : -1))
        .slice(0, 24)
        .map((d) => ({ ...item([claimOf(world, d.event)], d.event, d.year), why: d.event })),
    },
    {
      type: "list",
      title: "Houses failed, the newest first",
      items: all
        .filter((h) => h.failed !== null)
        .sort((a, b) => b.failed! - a.failed!)
        .map((h) => ({
          ...item(
            [
              houseLink(world, h.ref),
              ` — year ${h.failed}, having lost ${count(Math.round(h.lost))}`,
            ],
            h.failedEvent ?? h.ref,
            h.failed!,
          ),
          why: h.failedEvent ?? h.event,
        })),
    },
  ];
}

/** How heavy a land's debts lie on it, for the lens (0: none … 1: a year's food or more). */
export function debtValue(world: World, cell: number): number {
  return Math.min(1, debtBurden(populationContext(world), cell));
}

/** The lens of debt's reading of a land (M144): what it owes, to whom, against its harvest. */
export function debtReading(world: World, cell: number): Reading {
  const store = creditOf(world),
    owing = store?.owedBy(cell),
    burden = debtBurden(populationContext(world), cell),
    here = store?.standing().filter((h) => h.cell === cell) ?? [];
  const line = !owing?.loan
    ? "💸 Debt: it owes no house anything"
    : `💸 Debt: it owes ${count(Math.round(owing.owed))} grain — ${share(Math.min(9.99, burden))} of a year's food${burden >= CREDIT.crushing ? ", crushing" : ""}`;
  return {
    line,
    stats: [
      ...(owing?.loan
        ? [
            {
              label: "Most of it to",
              value: cap(store!.house(owing.loan.house)?.name ?? "a house"),
            },
            { label: "At", value: `${Math.round(owing.loan.rate * 100)} in a hundred a year` },
          ]
        : []),
      ...(here.length ? [{ label: "A house lends here", value: cap(here[0]!.name) }] : []),
    ],
  };
}
