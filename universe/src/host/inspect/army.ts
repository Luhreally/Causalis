// A realm's army and a war's course (Phase 13 M115): what the realm's host is (its design and
// why), the men it fields now and through the years, the wars it fought and how each went, its
// battles won and lost; and a war's course, year by year — the fallen of each side, the men each
// fields, the lands taken. Pure reads of the world as it stands (the men through the years are
// its lands' people as the realm fields them now).
import type { Ref, World } from "../../kernel/index.ts";
import {
  designsOf,
  fieldedParts,
  politiesOf,
  populationContext,
  warsOf,
  WAR_EVENTS,
  type Polity,
  type War,
} from "../../sim/index.ts";
import { designWords } from "../../rules/index.ts";
import type { Block, Item, Row } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { count, item, link, share, stat } from "./words.ts";
import { landLink, realmLink } from "./names.ts";

type Point = { x: number; y: number };

/** The people of some lands through the years history keeps. */
function peopleThrough(world: World, lands: readonly number[]): Point[] {
  const history = populationContext(world).history,
    by = new Map<number, number>();
  for (const c of lands)
    for (const y of history.yearsOf(c)) by.set(y.year, (by.get(y.year) ?? 0) + y.population);
  return [...by].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
}

/** The men a realm would have fielded through the years: its lands' people, as it fields them now. */
function fieldedThrough(world: World, r: Polity): Point[] {
  const ctx = populationContext(world),
    f = fieldedParts(ctx, r),
    people = r.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    k = people ? (f.men * f.share) / people : 0;
  return peopleThrough(world, r.members).map((p) => ({ x: p.x, y: Math.round(p.y * k) }));
}

/** At most `most` points, evenly through (the first and last kept). */
function thin(points: readonly Point[], most = 120): Point[] {
  if (points.length <= most) return [...points];
  return Array.from(
    { length: most },
    (_, i) => points[Math.round((i * (points.length - 1)) / (most - 1))]!,
  );
}

/** How a war went for a realm: won (it took what it fought for, or held against it), lost, or fought on. */
function outcome(r: Ref, w: War, prizeHeld: boolean): string {
  if (w.ended === null) return "still fought";
  const attacking = w.attacker === r;
  return attacking === prizeHeld ? "won" : "lost";
}

/** A realm's army: its host, the men it fields now and through the years, its wars and battles. */
export function armyBlocks(world: World, r: Polity): Block[] {
  const ctx = populationContext(world),
    f = fieldedParts(ctx, r),
    design = designsOf(world).of(r.ref),
    realms = politiesOf(world),
    wars = warsOf(world)
      .all()
      .filter((w) => w.attacker === r.ref || w.defender === r.ref),
    battles = wars.flatMap((w) =>
      w.battles.map((b) => ({ w, b, won: w.attacker === r.ref ? b.won : !b.won })),
    ),
    won = battles.filter((x) => x.won).length,
    lost = battles.length - won,
    fallen = wars.reduce((n, w) => n + (w.attacker === r.ref ? w.fallen[0] : w.fallen[1]), 0),
    through = thin(fieldedThrough(world, r));
  const rows: Row[] = [...wars].reverse().map((w) => {
    const other = w.attacker === r.ref ? w.defender : w.attacker,
      mine = w.battles.filter((b) => (w.attacker === r.ref ? b.won : !b.won)).length,
      held = realms.of(w.prize)?.ref === w.attacker,
      result = outcome(r.ref, w, held);
    return {
      ref: w.ref,
      cells: [
        [link(w.attacker === r.ref ? "upon" : "against", w.ref), " ", realmLink(world, other)],
        [`${w.declared}${w.ended === null ? "–" : `–${w.ended}`}`],
        [`${count(mine)} of ${count(w.battles.length)}`],
        [count(w.attacker === r.ref ? w.fallen[0] : w.fallen[1])],
        [result],
      ],
      keys: [other, w.declared, mine, w.attacker === r.ref ? w.fallen[0] : w.fallen[1], result],
    };
  });
  return [
    {
      type: "facts",
      rows: [
        stat("Fields", count(f.men * f.share), {
          parts: [
            { label: ["fighting men"], value: count(f.men) },
            { label: ["the share it fields"], value: share(f.share) },
            { label: ["its people's valour"], value: share(f.valour) },
            { label: ["a standing army"], value: f.standing ? "kept" : "none" },
          ],
        }),
        ...(design
          ? [
              stat("Armed with", [link(designWords(design.parts), design.ref)], {
                why: design.ref,
              }),
              stat("Since", `year ${design.since}`, { why: design.event }),
            ]
          : [stat("Armed with", "what each man has")]),
        stat("Battles", `${count(won)} won, ${count(lost)} lost`),
        stat("Fallen in war", count(fallen)),
      ],
    },
    // (A realm fallen has no lands to reckon them by.)
    ...(through.length >= 2
      ? [
          {
            type: "lines" as const,
            title:
              "The men it would have fielded through the years (its lands' people, as it fields them now)",
            unit: "people" as const,
            series: [{ name: r.town, ref: r.ref, color: realmColor(r.ref), points: through }],
          },
        ]
      : []),
    {
      type: "table",
      title: "Its wars, the latest first",
      columns: ["War", "Years", "Battles won", "Its fallen", "How it went"],
      rows,
    },
  ];
}

/** A war's course: the fallen of each side year by year, the men each fields, the lands taken. */
export function courseBlocks(world: World, w: War): Block[] {
  const realms = politiesOf(world),
    a = realms.get(w.attacker),
    d = realms.get(w.defender),
    years = new Map<number, [number, number]>();
  for (const b of w.battles) {
    const y = years.get(b.year) ?? [0, 0];
    years.set(b.year, [y[0] + b.fallen[0], y[1] + b.fallen[1]]);
  }
  const byYear = [...years].sort((x, y) => x[0] - y[0]),
    side = (i: 0 | 1): Point[] => byYear.map(([x, f]) => ({ x, y: f[i] })),
    during = (r: Polity | undefined) =>
      r
        ? fieldedThrough(world, r).filter(
            (p) => p.x >= w.declared - 5 && (w.ended === null || p.x <= w.ended + 5),
          )
        : [];
  // The lands taken in it: each taking's battle one of its own.
  const own = new Set<string>(w.battles.map((b) => b.event)),
    taken: Item[] = world.events
      .all()
      .filter((e) => e.type === WAR_EVENTS.taken.type && own.has(e.causes[0]?.ref ?? ""))
      .map((e) => {
        const cell = e.place?.startsWith("cell:") ? Number(e.place.split(":")[2]) : null;
        return item(
          [
            cell !== null ? landLink(world, cell) : "a land",
            " taken, year ",
            `${Math.floor(e.t / (365 * 86_400))}`,
          ],
          e.id,
        );
      });
  const blocks: Block[] = [];
  if (byYear.length >= 1)
    blocks.push({
      type: "lines",
      title: "The fallen of each side, year by year",
      unit: "people",
      series: [
        {
          name: a?.town ?? "the attacker",
          ref: w.attacker,
          color: realmColor(w.attacker),
          points: side(0),
        },
        {
          name: d?.town ?? "the defender",
          ref: w.defender,
          color: realmColor(w.defender),
          points: side(1),
        },
      ],
    });
  const ma = during(a),
    md = during(d);
  if (ma.length >= 2 || md.length >= 2)
    blocks.push({
      type: "lines",
      title: "The men each would field (their lands' people, as each fields them now)",
      unit: "people",
      series: [
        ...(ma.length >= 2
          ? [{ name: a!.town, ref: w.attacker, color: realmColor(w.attacker), points: thin(ma) }]
          : []),
        ...(md.length >= 2
          ? [{ name: d!.town, ref: w.defender, color: realmColor(w.defender), points: thin(md) }]
          : []),
      ],
    });
  blocks.push(
    taken.length
      ? { type: "list", title: "The lands taken in it", items: taken }
      : { type: "text", lines: [["No land has changed hands in it."]] },
  );
  return blocks;
}
