// Realms among the stars, told (Phase 72, first slice): who holds which star, a realm's page (how many worlds and people, who rules it
// and from where, whom it holds by force, who chose it, how long a word takes to cross it, what holds it and what pulls it apart, each
// in numbers), a world's place in one, and one realm's coming apart as the map plays it. Empire and league are words read here off who
// is held and how: no rule picks them. Pure reads of `sim/space/nations.ts`.
import type { Ref, World } from "../kernel/index.ts";
import { WORKS_PEOPLE, breakChance, darkLimit } from "../rules/index.ts";
import {
  filledOf,
  nationsOf,
  peopleOn,
  politiesOf,
  populationContext,
  readingOf,
  realmName,
  seatOf,
  starWarsOf,
  strainNow,
  worldNation,
  type Holding,
  type StarNation,
} from "../sim/index.ts";
import type {
  Block,
  Item,
  Line,
  NationFall,
  NationMap,
  NationRow,
  NationSight,
  PageModel,
} from "../bridge/index.ts";
import { realmColor } from "./colors.ts";
import { peopleWords as bigWords } from "./filling.ts";
import type { QueryHandler } from "./host.ts";
import { count, item, link, many, stat, yearNow } from "./inspect/words.ts";

const worlds = (n: number) => many(n, "world", "worlds");
/** A realm among the stars' page: its own ref for a realm of worlds alone; a realm of the home world has a page already, this is its other. */
export const nationRef = (ref: string): string => (ref.startsWith("snat:") ? ref : `nation:${ref}`);
const years = (n: number) => many(Math.round(n), "year", "years");

/** What a realm of these worlds is called, read off who is held and how. */
function wordOf(rows: readonly Holding[]): string {
  const n = rows.length,
    taken = rows.filter((h) => h.how === "taken").length,
    joined = rows.filter((h) => h.how === "joined").length;
  if (!n) return "no worlds now";
  if (n === 1) return "one world";
  if (taken * 3 >= n) return "an empire";
  if (joined * 2 >= n) return "a league";
  return "a realm of its own settlers";
}

const rowsOf = (world: World, ref: string): Holding[] =>
  nationsOf(world)
    ?.all()
    .filter((h) => h.holder === ref) ?? [];

const peopleOfRows = (world: World, rows: readonly Holding[]): number => {
  const ctx = populationContext(world),
    filled = filledOf(world);
  return rows.reduce((s, h) => {
    const w = filled?.get(h.key);
    return s + (w ? peopleOn(ctx, w) : 0);
  }, 0);
};

/** Which world, in words: the realm's name for it is its distance from those who read. */
function worldWords(world: World, h: Holding): string {
  const w = filledOf(world)?.get(h.key),
    people = w ? peopleOn(populationContext(world), w) : 0;
  return `a world of ${bigWords(people)}, ${(w?.distance ?? 0).toFixed(1)} light-years from home`;
}

/** The map of who holds what. */
export function nationMap(world: World): NationMap {
  const store = nationsOf(world),
    year = yearNow(world);
  if (!store) return { year, nations: [], stars: [], fallen: null };
  const rows = store.all(),
    by = new Map<string, Holding[]>();
  for (const h of rows)
    if (h.holder) {
      const list = by.get(h.holder);
      if (list) list.push(h);
      else by.set(h.holder, [h]);
    }
  const nations: NationRow[] = store
      .allNations()
      .filter((n) => by.has(n.ref))
      .map((n) => ({
        ref: n.ref,
        name: n.name,
        color: realmColor(n.ref),
        worlds: by.get(n.ref)!.length,
        people: peopleOfRows(world, by.get(n.ref)!),
        greatest: n.greatest,
        word: wordOf(by.get(n.ref)!),
      }))
      .sort((a, b) => b.worlds - a.worlds || (a.ref < b.ref ? -1 : 1)),
    at = new Map(nations.map((n, i) => [n.ref, i])),
    fallen = store
      .allNations()
      .filter((n) => n.fell)
      .sort((a, b) => b.greatest - a.greatest || b.fell!.year - a.fell!.year)[0];
  return {
    year,
    nations,
    stars: rows
      .filter((h) => filledOf(world)?.get(h.key)?.gone === undefined)
      .map((h) => ({
        star: h.star as string,
        nation: h.holder ? (at.get(h.holder) ?? -1) : -1,
        seat: !!h.holder && store.nation(h.holder)?.seat === h.key,
        dark: !!h.dark,
      })),
    fallen: fallen?.ref ?? null,
  };
}

/** What a world cut off has lost, in its numbers. */
function darkLine(world: World, h: Holding): string {
  const w = filledOf(world)?.get(h.key),
    now = w ? peopleOn(populationContext(world), w) : 0,
    d = h.dark!,
    why = d.poor
      ? "its ground has too little metal to make what keeps its roofs up"
      : `it had fewer than ${bigWords(WORKS_PEOPLE)} to work the whole chain to the machines that keep its roofs up`;
  return `It held ${bigWords(d.before)} when it was cut off in year ${d.since}, and holds ${bigWords(now)} now: ${why}, and no one brings them. Its towers and vats stand idle.`;
}

/** One realm's coming apart, as the map plays it. */
export function nationFall(world: World, ref: string): NationFall | null {
  const store = nationsOf(world),
    n = store?.nation(ref);
  if (!store || !n) return null;
  const rows = store.all(),
    held = rows.filter((h) => h.holder === ref),
    // (From its greatest on: each time a world was its own, from when to when.)
    from = n.greatestYear - 2,
    list = [
      ...held.map((h) => ({ h, since: h.since, left: null as number | null })),
      ...n.lost
        .filter(([index, left]) => !!rows[index] && left >= from)
        .map(([index, left, , since]) => ({ h: rows[index]!, since, left })),
    ],
    lefts = list.flatMap((x) => (x.left === null ? [] : [x.left])),
    now = yearNow(world),
    to = Math.min(now, Math.max(n.fell?.year ?? 0, ...lefts) + 8),
    war = starWarsOf(world)
      .all()
      .filter(
        (w) =>
          w.realm === ref &&
          w.won !== null &&
          !!w.at &&
          list.some((x) => x.h.key === w.at!.key && x.left !== null),
      )
      .at(-1),
    fallenWorlds = [...new Map(list.filter((x) => x.h.dark).map((x) => [x.h.key, x])).values()];
  return {
    ref,
    name: n.name,
    color: realmColor(ref),
    greatest: n.greatest,
    greatestYear: n.greatestYear,
    fellYear: n.fell?.year ?? null,
    from,
    to: Math.max(to, from + 1),
    worlds: list.map((x) => ({
      star: x.h.star as string,
      key: x.h.key,
      since: x.since,
      left: x.left,
      dark: !!x.h.dark,
    })),
    fleet: war?.ref ?? null,
    fleetWords: war
      ? `In year ${war.declared} a fleet of ${n.name} sailed to take one back. It came in ${war.arrives}, and ${war.won ? "took it" : "was lost"}.`
      : null,
    lost: fallenWorlds.slice(0, 4).map((x) => darkLine(world, x.h)),
  };
}

/** Where great news of a realm among the stars is to be seen. */
function sightOf(world: World, event: string): NationSight {
  const store = nationsOf(world),
    e = world.events.get(event as Ref);
  if (!store || !e) return { nation: null, key: null };
  const d = e.data as { star?: string; planet?: number } | null,
    key = d?.star !== undefined && d?.planet !== undefined ? `${d.star}/${d.planet}` : null,
    nation = e.subjects.find((s) => !!store.nation(s)) ?? null;
  return { nation, key };
}

/** A row for one of a realm's worlds. */
const rowOf = (world: World, h: Holding, tail: string): Item =>
  item(`${worldWords(world, h)}${tail}`, h.key);

/** What holds a realm and what pulls it, each in numbers, over all it holds. */
function bonds(
  world: World,
  n: StarNation,
  rows: readonly Holding[],
): {
  holds: string[];
  pulls: string[];
  longest: number;
  within: number;
  worst: { h: Holding; at: number } | null;
} {
  const ctx = populationContext(world),
    filled = filledOf(world),
    seat = seatOf(ctx, n),
    year = yearNow(world),
    pulls: string[] = [],
    holds: string[] = [];
  let longest = 0,
    within = 0,
    owes = 0,
    poor = 0,
    outgrown = 0,
    past = 0,
    worst: { h: Holding; at: number } | null = null;
  for (const h of rows) {
    const w = filled?.get(h.key);
    if (!w) continue;
    const r = strainNow(ctx, h, w, n, seat, year);
    if (r.way.answer !== Infinity) longest = Math.max(longest, r.way.answer);
    if (r.way.answer <= seat.hold) within++;
    else past++;
    if (r.owes) {
      owes++;
      if (filled && readingOf(ctx, w)?.open === false && r.people >= WORKS_PEOPLE) poor++;
    }
    if (r.strain.size > 0) outgrown++;
    if (!worst || r.strain.total > worst.at) worst = { h, at: r.strain.total };
  }
  if (within)
    holds.push(
      `${worlds(within)} within its answering: a word and a fleet come inside ${years(seat.hold)}, two of its people's generations.`,
    );
  if (owes)
    holds.push(
      `${worlds(owes)} cannot make what keeps their roofs up, and get it through the realm${poor ? `: ${poor} for want of metal in the ground, the rest with fewer than ${bigWords(WORKS_PEOPLE)} to work the chain` : `, having fewer than ${bigWords(WORKS_PEOPLE)} to work the chain`}.`,
    );
  if (!seat.star) pulls.push(`Its seat is gone: no word or fleet can come from it now.`);
  else if (!seat.fleet) pulls.push(`It has no fleet to send: its works could not build one now.`);
  if (past && seat.star)
    pulls.push(
      `${worlds(past)} past its answering, the farthest ${longest ? years(longest) : "never"} for a word and a fleet against ${years(seat.hold)}.`,
    );
  if (n.lostFleet !== null && year - n.lostFleet < seat.hold)
    pulls.push(`It lost a fleet in year ${n.lostFleet}, and every world saw it.`);
  const forced = rows.filter((h) => h.how === "taken");
  if (forced.length) pulls.push(`${worlds(forced.length)} held by force.`);
  if (outgrown)
    pulls.push(
      `${worlds(outgrown)} with more people than those who hold them, ${bigWords(seat.people)}.`,
    );
  return { holds, pulls, longest, within, worst };
}

/** A realm's own page: of the home world, or of worlds alone. */
export function nationPage(world: World, ref: string): PageModel {
  const store = nationsOf(world),
    n = store?.nation(ref),
    year = yearNow(world);
  if (!store || !n) {
    // (A realm of the home world that has never held one.)
    const home = politiesOf(world).get(ref as Ref);
    if (home)
      return {
        ref: nationRef(ref),
        kind: "world",
        icon: "👑",
        title: `${home.town} among the stars`,
        subtitle: [
          "It has nothing among the stars: no world of another star has ever been its own.",
        ],
        color: realmColor(ref),
        place: null,
        stats: [],
        tabs: [
          {
            id: "overview",
            name: "Overview",
            blocks: [{ type: "list", items: [item(realmName(home), home.ref)] }],
          },
        ],
        followable: false,
        year,
      };
    // (A world of no realm, named as a side in a war.)
    const h = store?.all().find((x) => worldNation(x.index) === ref);
    return {
      ref: nationRef(ref),
      kind: "world",
      icon: "🌍",
      title: "A world of its own people",
      subtitle: [h ? worldWords(world, h) : "A world among the stars, gone its own way."],
      color: null,
      place: null,
      stats: [],
      tabs: [
        {
          id: "overview",
          name: "Overview",
          blocks: h
            ? [{ type: "list", title: "Which", items: [item("That world", h.key)] }]
            : [
                {
                  type: "text",
                  lines: [["No realm holds it, and it holds no other."]],
                },
              ],
        },
      ],
      followable: false,
      year,
    };
  }
  const rows = rowsOf(world, ref),
    p = n.realm ? politiesOf(world).get(n.realm) : undefined,
    b = bonds(world, n, rows),
    taken = rows.filter((h) => h.how === "taken"),
    joined = rows.filter((h) => h.how === "joined"),
    sent = rows.filter((h) => h.how !== "taken" && h.how !== "joined"),
    filled = filledOf(world),
    seatW = n.seat ? store.get(n.seat) : null,
    gone = rows.length === 0,
    lostRows = store.all().filter((h) => h.left?.from === ref && h.holder !== ref),
    dark = lostRows.filter((h) => h.dark),
    fallenWords = n.fell
      ? `Fallen in year ${n.fell.year}. It held ${worlds(n.greatest)} in year ${n.greatestYear}.`
      : gone
        ? "It holds no world of another star."
        : `The most it held: ${worlds(n.greatest)}, in year ${n.greatestYear}.`,
    war = starWarsOf(world)
      .all()
      .filter((w) => w.realm === ref && !!w.at && w.won !== null)
      .at(-1),
    blocks: Block[] = [
      ...(gone && !n.greatest
        ? [
            {
              type: "text" as const,
              lines: [
                ["It has nothing among the stars: no world of another star has ever been its own."],
              ],
            },
          ]
        : []),
      ...(b.holds.length
        ? [
            {
              type: "text" as const,
              title: "What holds it together",
              lines: b.holds.map((x) => [x]),
            },
          ]
        : []),
      ...(gone && n.greatest
        ? [
            {
              type: "text" as const,
              title: "What brought it down",
              lines: [
                p && p.ended !== null
                  ? [
                      `Its realm on the home world ended in year ${p.ended}. With no seat, no word or fleet could come, and its worlds went one at a time.`,
                    ]
                  : [
                      `They went one at a time, each when it could no longer be answered: ${worlds(lostRows.length)} gone their own way.`,
                    ],
              ],
            },
          ]
        : b.pulls.length
          ? [
              {
                type: "text" as const,
                title: "What is pulling it apart",
                lines: b.pulls.map((x) => [x]),
              },
            ]
          : rows.length
            ? [
                {
                  type: "text" as const,
                  title: "What is pulling it apart",
                  lines: [["Nothing past what time always does: word is always late."]],
                },
              ]
            : []),
      ...(n.greatest >= 2
        ? [
            {
              type: "tool" as const,
              tool: "watch.nation",
              args: {
                id: ref,
                label: lostRows.length ? "▶ Watch it come apart" : "▶ See it on the map",
              },
            },
          ]
        : []),
      ...(war
        ? [
            {
              type: "text" as const,
              title: "Its last fleet for a world",
              lines: [
                [
                  `Sailed in year ${war.declared}, came in ${war.arrives}, and ${war.won ? "won" : "was lost"}.`,
                ],
              ],
            },
            {
              type: "tool" as const,
              tool: "watch.starfight",
              args: { id: war.ref, label: "▶ Watch the fleet" },
            },
          ]
        : []),
      ...(taken.length
        ? [
            {
              type: "list" as const,
              title: `Held by force (${taken.length})`,
              items: taken.slice(0, 12).map((h) => rowOf(world, h, `, taken in ${h.since}`)),
              ...(taken.length > 12 ? { more: taken.length - 12 } : {}),
            },
          ]
        : []),
      ...(joined.length
        ? [
            {
              type: "list" as const,
              title: `Who chose it (${joined.length})`,
              items: joined.slice(0, 12).map((h) => rowOf(world, h, `, joined in ${h.since}`)),
              ...(joined.length > 12 ? { more: joined.length - 12 } : {}),
            },
          ]
        : []),
      ...(sent.length
        ? [
            {
              type: "list" as const,
              title: `Its own settlers (${sent.length})`,
              items: sent.slice(0, 12).map((h) => rowOf(world, h, `, since ${h.since}`)),
              ...(sent.length > 12 ? { more: sent.length - 12 } : {}),
            },
          ]
        : []),
      ...(lostRows.length
        ? [
            {
              type: "list" as const,
              title: `Gone their own way (${lostRows.length})${dark.length ? `, ${dark.length} in the dark` : ""}`,
              items: lostRows
                .slice(0, 12)
                .map((h) =>
                  rowOf(world, h, `, went in ${h.left!.year}${h.dark ? ", in the dark" : ""}`),
                ),
              ...(lostRows.length > 12 ? { more: lostRows.length - 12 } : {}),
            },
          ]
        : []),
      ...(dark[0]
        ? [
            {
              type: "text" as const,
              title: "What one of them lost",
              lines: [[darkLine(world, dark[0])]],
            },
          ]
        : []),
    ];
  return {
    ref: nationRef(ref),
    kind: "world",
    icon: wordOf(rows) === "an empire" ? "⚔️" : wordOf(rows) === "a league" ? "🤝" : "👑",
    title: `${n.name} among the stars`,
    subtitle: [`${wordOf(rows)[0]!.toUpperCase()}${wordOf(rows).slice(1)}. ${fallenWords}`],
    color: realmColor(ref),
    place: null,
    stats: [
      stat("Worlds", count(rows.length), { why: n.fell?.event ?? null }),
      stat("People", bigWords(peopleOfRows(world, rows))),
      stat(
        "Ruled from",
        p && p.ended === null
          ? [link(`${realmName(p)}, on the home world`, p.ref)]
          : seatW && filled?.get(seatW.key)
            ? [link(worldWords(world, seatW), seatW.key)]
            : "nowhere: its seat is gone",
      ),
      ...(p && p.ended === null ? [stat("Who rules", p.ruler.name)] : []),
      stat("Word and fleet across it", b.longest ? years(b.longest) : "none can cross it"),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

/** Every realm among the stars. */
export function nationsPage(world: World): PageModel {
  const map = nationMap(world),
    year = yearNow(world),
    store = nationsOf(world),
    free = map.stars.filter((s) => s.nation < 0).length,
    dark = map.stars.filter((s) => s.dark).length,
    fallen = (store?.allNations() ?? []).filter((n) => n.fell);
  return {
    ref: "world:nations",
    kind: "world",
    icon: "👑",
    title: "Who holds the stars",
    subtitle: [
      map.stars.length
        ? `${worlds(map.stars.length)} of other stars with people on them. ${many(map.nations.length, "realm holds", "realms hold")} ${worlds(map.stars.length - free)}. ${worlds(free)} of their own people, ${dark} of them in the dark.`
        : "No one has come to live on a world of another star yet, so no one holds any.",
    ],
    color: null,
    place: null,
    stats: [],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          ...(map.nations.length
            ? [
                {
                  type: "list" as const,
                  title: "By how many they hold",
                  items: map.nations.map((n) =>
                    item(
                      `${n.name}: ${n.word}, ${worlds(n.worlds)}, ${bigWords(n.people)}`,
                      nationRef(n.ref),
                    ),
                  ),
                },
              ]
            : []),
          ...(fallen.length
            ? [
                {
                  type: "list" as const,
                  title: "Fallen",
                  items: fallen.map((n) =>
                    item(
                      `${n.name}: ${worlds(n.greatest)} at the most, fell in ${n.fell!.year}`,
                      nationRef(n.ref),
                    ),
                  ),
                },
              ]
            : []),
        ],
      },
    ],
    followable: false,
    year,
  };
}

/** A world's place among realms, on its page. */
export function nationWorldBlocks(world: World, key: string): Block[] {
  const store = nationsOf(world),
    h = store?.get(key);
  if (!store || !h) return [];
  const n = h.holder ? store.nation(h.holder) : undefined,
    ctx = populationContext(world),
    w = filledOf(world)?.get(key),
    lines: Line[] = [];
  if (n && w) {
    const seat = seatOf(ctx, n),
      r = strainNow(ctx, h, w, n, seat, yearNow(world)),
      ways =
        h.how === "taken"
          ? `taken by its fleet in ${h.since}`
          : h.how === "joined"
            ? `by its own choosing since ${h.since}`
            : `its own settlers' since ${h.since}`;
    lines.push(
      [`Held by `, link(n.name, nationRef(n.ref)), `: ${ways}.`],
      [
        r.way.answer === Infinity
          ? "No word or fleet of theirs can come now."
          : `A word and a fleet take ${years(r.way.answer)} here${r.way.hops ? `, by ${many(r.way.hops, "lane", "lanes")}` : ""}; a rising must be answered in ${years(seat.hold)}.`,
      ],
      [
        r.owes
          ? "It cannot make what keeps its roofs up, and gets it through them."
          : "It makes all it needs: it owes them nothing for that.",
      ],
      [
        breakChance(r.strain.total) > 0
          ? `It may go: ${Math.round(breakChance(r.strain.total) * 100)} in a hundred, each five years.`
          : "As things stand, it stays.",
      ],
    );
  } else {
    lines.push([
      h.left
        ? `No one holds it. It went its own way in year ${h.left.year}.`
        : "No one holds it: those who sent it are gone.",
    ]);
    if (h.left) {
      const from = store.nation(h.left.from);
      if (from) lines.push(["It was of ", link(from.name, nationRef(from.ref)), "."]);
    }
  }
  return [
    { type: "text", title: "Who holds it", lines },
    ...(h.dark
      ? [{ type: "text" as const, title: "🌘 Its dark age", lines: [[darkLine(world, h)]] }]
      : []),
    ...(h.dark
      ? [
          {
            type: "chart" as const,
            title: "Those it can keep alive, cut off",
            unit: "people" as const,
            points: Array.from({ length: 7 }, (_, i) => {
              const at = (i * Math.max(1, yearNow(world) - h.dark!.since)) / 6;
              return {
                x: Math.round(h.dark!.since + at),
                y: Math.round(darkLimit(h.dark!.before, at)),
              };
            }),
          },
        ]
      : []),
  ];
}

/** A realm's worlds, on its own page. */
export function nationRealmBlocks(world: World, ref: string): Block[] {
  const n = nationsOf(world)?.nation(ref);
  if (!n) return [];
  const rows = rowsOf(world, ref);
  return [
    {
      type: "list",
      title: "Among the stars",
      items: [
        item(
          `${wordOf(rows)[0]!.toUpperCase()}${wordOf(rows).slice(1)}: ${worlds(rows.length)} now, ${worlds(n.greatest)} at the most${n.fell ? `; it fell in ${n.fell.year}` : ""}`,
          nationRef(n.ref),
        ),
      ],
    },
  ];
}

export const NATION_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** A world in the dark, the one fallen farthest; a realm that has held nothing: for a gate. */
  "nation.dark": (world) => {
    const rows =
      nationsOf(world)
        ?.all()
        .filter((h) => h.dark) ?? [];
    return rows.sort((a, b) => a.dark!.since - b.dark!.since)[0]?.key ?? null;
  },
  "nation.none": (world) =>
    politiesOf(world)
      .living()
      .find((p) => !nationsOf(world)?.nation(p.ref))?.ref ?? null,
  "nation.map": (world) => nationMap(world),
  "nation.fall": (world, args) => nationFall(world, (args as { ref: string }).ref),
  "nation.sight": (world, args) => sightOf(world, (args as { event: string }).event),
};
