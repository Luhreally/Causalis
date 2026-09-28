// Side by side (Phase 11 M103): two realms set against each other as a grand strategy game's
// ledger sets them — their numbers pulled apart in bars, their people through the years on one
// chart, how they stand to each other; the realms a realm is worth setting beside (its foes,
// those sworn to it, the greatest); and a war's tally, its two sides' fallen, battles won and
// the men each fields. Pure reads of the world.
import type { Ref, World } from "../../kernel/index.ts";
import {
  diplomacyOf,
  fieldedOf,
  politiesOf,
  populationContext,
  realmName,
  relationRef,
  warsOf,
  type Polity,
  type War,
} from "../../sim/index.ts";
import { standingWords } from "../../causal/index.ts";
import type { Block, Item, Line, PageModel } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { realmArms } from "../arms.ts";
import { count, link, many, share, yearNow } from "./words.ts";
import { realmLink } from "./names.ts";

/** How many of the greatest realms a realm's page offers to set beside it. */
const GREATEST = 6;

/** A realm's numbers, to set beside another's. */
function measures(world: World, r: Polity) {
  const ctx = populationContext(world),
    fought = warsOf(world)
      .all()
      .filter((w) => w.attacker === r.ref || w.defender === r.ref);
  return {
    people: r.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    lands: r.members.length,
    towns: r.members.reduce((n, c) => n + ctx.settlements.inProvince(c).length, 0),
    fields: r.ended === null ? fieldedOf(ctx, r) : 0,
    wars: fought.length,
    won: fought.reduce(
      (n, w) => n + w.battles.filter((b) => b.won === (w.attacker === r.ref)).length,
      0,
    ),
    fallen: fought.reduce((n, w) => n + (w.attacker === r.ref ? w.fallen[0] : w.fallen[1]), 0),
    years: (r.ended ?? yearNow(world)) - r.founded,
    tithe: r.tribute,
  };
}

/** A realm's people year by year (of the lands it holds now). */
function peopleThroughYears(world: World, r: Polity): { x: number; y: number }[] {
  const ctx = populationContext(world),
    byYear = new Map<number, number>();
  for (const c of r.members)
    for (const y of ctx.history.yearsOf(c))
      byYear.set(y.year, (byYear.get(y.year) ?? 0) + y.population);
  return [...byYear].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
}

/** A tally's row: its words, its two amounts and how each is said. */
function row(label: string, a: number, b: number, say: (n: number) => string) {
  return { label, a, b, words: [say(a), say(b)] as const };
}

/** Two realms side by side: `compare:A|B`. */
export function comparePage(world: World, ref: string): PageModel {
  const [aRef, bRef] = ref.slice("compare:".length).split("|") as [string, string],
    realms = politiesOf(world),
    a = realms.get(aRef as Ref),
    b = realms.get(bRef as Ref),
    now = yearNow(world);
  if (!a || !b || a.ref === b.ref)
    return {
      ref,
      kind: "compare",
      icon: "⚖️",
      title: "Nothing to set side by side",
      subtitle: ["two realms are wanted, each its own"],
      color: null,
      place: null,
      stats: [],
      tabs: [{ id: "side", name: "Side by side", blocks: [] }],
      followable: false,
      year: now,
    };
  const ma = measures(world, a),
    mb = measures(world, b),
    sides = [
      { name: [realmLink(world, a.ref)] as Line, color: realmColor(a.ref) },
      { name: [realmLink(world, b.ref)] as Line, color: realmColor(b.ref) },
    ] as const,
    // How they stand to each other: at war, or their regard.
    between = warsOf(world)
      .all()
      .filter(
        (w) =>
          w.ended === null &&
          ((w.attacker === a.ref && w.defender === b.ref) ||
            (w.attacker === b.ref && w.defender === a.ref)),
      ),
    regard = diplomacyOf(world).get(a.ref, b.ref),
    stand: Line = between.length
      ? [
          "They are at war: ",
          ...between.flatMap((w, i) => [
            ...(i ? [", "] : []),
            link(`the war of year ${w.declared}`, w.ref),
          ]),
          ".",
        ]
      : regard
        ? [
            "They are ",
            link(standingWords(regard.opinion, !!regard.pact), relationRef(a.ref, b.ref)),
            " to each other.",
          ]
        : ["They have had no dealings with each other."];
  const blocks: Block[] = [
    { type: "text", lines: [stand] },
    {
      type: "tally",
      title: "Their numbers, pulled against each other",
      sides,
      rows: [
        row("People", ma.people, mb.people, count),
        row("Lands", ma.lands, mb.lands, count),
        row("Towns", ma.towns, mb.towns, count),
        row("Men it fields", ma.fields, mb.fields, count),
        row("Wars fought", ma.wars, mb.wars, count),
        row("Battles won", ma.won, mb.won, count),
        row("Fallen in war", ma.fallen, mb.fallen, count),
        row("Years standing", ma.years, mb.years, count),
        row("Tithe", ma.tithe, mb.tithe, share),
      ],
    },
    {
      type: "lines",
      title: "Their people through the years (the lands each holds now)",
      unit: "people",
      series: [a, b].map((r) => ({
        name: realmName(r),
        ref: r.ref,
        color: realmColor(r.ref),
        points: peopleThroughYears(world, r),
      })),
    },
  ];
  return {
    ref,
    kind: "compare",
    icon: "⚖️",
    title: `${a.town} and ${b.town}, side by side`,
    subtitle: [realmLink(world, a.ref), " beside ", realmLink(world, b.ref)],
    color: null,
    portrait: { kind: "arms", arms: [realmArms(world, a.ref)!, realmArms(world, b.ref)!] },
    place: null,
    stats: [],
    tabs: [{ id: "side", name: "Side by side", blocks }],
    followable: false,
    year: now,
  };
}

/**
 * The realms worth setting beside one (its realm page's "Compare" tab): those it is at war
 * with, those sworn to it, and the greatest of the world, each opening the two side by side.
 */
export function compareWith(world: World, r: Polity): Block[] {
  const realms = politiesOf(world),
    ctx = populationContext(world),
    offered = new Map<string, string>(),
    offer = (ref: string, why: string) => {
      if (ref !== r.ref && !offered.has(ref) && realms.get(ref as Ref)?.ended === null)
        offered.set(ref, why);
    };
  for (const w of warsOf(world).fighting(r.ref))
    if (w.ended === null) offer(w.attacker === r.ref ? w.defender : w.attacker, "at war with it");
  for (const rel of diplomacyOf(world).of(r.ref))
    if (rel.pact) offer(rel.a === r.ref ? rel.b : rel.a, "sworn to it");
  const people = (p: Polity) =>
    p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);
  for (const p of realms
    .all()
    .filter((p) => p.ended === null)
    .sort((x, y) => people(y) - people(x) || (x.ref < y.ref ? -1 : 1))
    .slice(0, GREATEST + 1))
    offer(p.ref, "among the greatest");
  const items: Item[] = [...offered].map(([other, why]) => ({
    line: [realmLink(world, other), ` — ${why}`],
    ref: `compare:${r.ref}|${other}`,
  }));
  return items.length
    ? [{ type: "list", title: "Set it beside…", items }]
    : [{ type: "text", lines: [["No other realm stands to set it beside."]] }];
}

/** A war's tally: its two sides' fallen, battles won, and the men each fields now. */
export function warTally(world: World, w: War): Block {
  const realms = politiesOf(world),
    ctx = populationContext(world),
    fields = (ref: Ref) => {
      const r = realms.get(ref);
      return r && r.ended === null ? fieldedOf(ctx, r) : 0;
    },
    won = w.battles.filter((b) => b.won).length;
  return {
    type: "tally",
    title: "The tally",
    sides: [
      { name: [realmLink(world, w.attacker)], color: realmColor(w.attacker) },
      { name: [realmLink(world, w.defender)], color: realmColor(w.defender) },
    ],
    rows: [
      row("Fallen", w.fallen[0], w.fallen[1], count),
      row("Battles won", won, w.battles.length - won, (n) => many(n, "battle", "battles")),
      row("Men it fields now", fields(w.attacker), fields(w.defender), count),
    ],
  };
}
