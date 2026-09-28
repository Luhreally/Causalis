// The world's numbers through the years (Phase 12 M109): a page of charts, as a grand strategy
// game's statistics screen keeps them — its people, born and dying, and how well they ate; its
// realms standing, the wars fought and the fallen; its towns; its faiths and its tongues — each
// the world's own line, and beside it the greatest realms', faiths' and tongues' (the people of
// the lands each holds now). History says each: the years it keeps (every year of the last
// century, then a year in ten, then in a hundred), the realms' and wars' own years, the births
// and deaths of living memory.
import { YEAR, type Ref, type World } from "../../kernel/index.ts";
import { beliefOf, languagesOf, politiesOf, populationContext, warsOf } from "../../sim/index.ts";
import type { Block, PageModel, Stat } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { faithColor, languageColor } from "../planet.ts";
import { count, link, share, stat } from "./words.ts";

type Rgb = readonly [number, number, number];
type Point = { x: number; y: number };

/** How often the page is read again as the world runs (it reads the whole world's history). */
const STATS_EVERY = 10_000;
/** The most lines of realms, faiths or tongues beside the world's own, and the most points of each. */
const MOST_LINES = 6,
  MOST_POINTS = 160;
/** The world's own line's colour. */
const WORLD: Rgb = [0.9, 0.94, 1];

/** At most `most` points of a series, evenly through it (its first and last kept). */
function thin(points: readonly Point[], most = MOST_POINTS): Point[] {
  if (points.length <= most) return [...points];
  const out: Point[] = [];
  for (let i = 0; i < most; i++)
    out.push(points[Math.round((i * (points.length - 1)) / (most - 1))]!);
  return out;
}

/** The people of some lands through the years history keeps, each year's sum (and, if asked, the fed's). */
function peopleOf(world: World, lands: Iterable<number>): { people: Point[]; fed: Point[] } {
  const history = populationContext(world).history,
    people = new Map<number, number>(),
    fed = new Map<number, number>();
  for (const c of lands)
    for (const y of history.yearsOf(c)) {
      people.set(y.year, (people.get(y.year) ?? 0) + y.population);
      fed.set(y.year, (fed.get(y.year) ?? 0) + y.population * Math.min(1, y.fed / 1000));
    }
  const years = [...people.keys()].sort((a, b) => a - b);
  return {
    people: years.map((x) => ({ x, y: people.get(x)! })),
    fed: years.map((x) => ({ x, y: people.get(x)! ? fed.get(x)! / people.get(x)! : 0 })),
  };
}

/** A count through the given years: how many of `spans` stood at each ([from, until) years). */
function standingThrough(
  years: readonly number[],
  spans: readonly (readonly [number, number | null])[],
): Point[] {
  return years.map((x) => ({
    x,
    y: spans.filter(([from, until]) => from <= x && (until === null || x < until)).length,
  }));
}

/** The world's numbers through the years, and the greatest realms', faiths' and tongues' own. */
export function statsPage(world: World, tab?: string): PageModel {
  const ctx = populationContext(world),
    now = Math.floor(world.now / YEAR),
    lands = ctx.provinces.all().map((p) => p.cell),
    whole = peopleOf(world, lands),
    years = whole.people.map((p) => p.x),
    realms = politiesOf(world),
    standing = realms.living(),
    wars = warsOf(world).all(),
    faiths = beliefOf(world),
    tongues = languagesOf(world),
    peopleNow = ctx.provinces.all().reduce((n, p) => n + p.total(), 0),
    peopleIn = (cells: readonly number[]) =>
      cells.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);

  // The greatest realms, faiths and tongues now, and the lands each holds.
  const greatRealms = [...standing]
    .map((r) => ({ r, people: peopleIn(r.members) }))
    .sort((a, b) => b.people - a.people || (a.r.ref < b.r.ref ? -1 : 1))
    .slice(0, MOST_LINES);
  const faithLands = new Map<string, number[]>(),
    tongueLands = new Map<number, number[]>();
  for (const c of lands) {
    const f = faiths.of(c).faith;
    if (f) faithLands.set(f, [...(faithLands.get(f) ?? []), c]);
    const l = tongues.of(c);
    if (l) tongueLands.set(l.index, [...(tongueLands.get(l.index) ?? []), c]);
  }
  const greatFaiths = [...faithLands]
      .map(([ref, cells]) => ({ ref, cells, people: peopleIn(cells) }))
      .sort((a, b) => b.people - a.people || (a.ref < b.ref ? -1 : 1))
      .slice(0, MOST_LINES),
    greatTongues = [...tongueLands]
      .map(([index, cells]) => ({ index, cells, people: peopleIn(cells) }))
      .sort((a, b) => b.people - a.people || a.index - b.index)
      .slice(0, MOST_LINES);

  const worldLine = (name: string, points: readonly Point[]) => ({
    name,
    color: WORLD,
    points: thin(points),
  });

  // People: the world's and its greatest realms'; born and died; the fed.
  const born: Point[] = [],
    died: Point[] = [];
  {
    const first = Math.max(0, now - 120);
    for (let y = first; y < now; y++) {
      let b = 0,
        d = 0;
      for (const c of lands) {
        b += ctx.history.birthsIn(c, y);
        d += ctx.history.deathsIn(c, y);
      }
      if (b || d) {
        born.push({ x: y, y: b });
        died.push({ x: y, y: d });
      }
    }
  }
  const peopleBlocks: Block[] = [
    {
      type: "lines",
      title:
        "The world's people through the years, and its greatest realms' (the lands each holds now)",
      unit: "people",
      series: [
        worldLine("The world", whole.people),
        ...greatRealms.map(({ r }) => ({
          name: r.town,
          ref: r.ref,
          color: realmColor(r.ref),
          points: thin(peopleOf(world, r.members).people),
        })),
      ],
    },
    {
      type: "lines",
      title: "Born and died each year (as long as living memory keeps them)",
      unit: "people",
      series: [
        { name: "Born", color: [0.46, 0.86, 0.5], points: thin(born) },
        { name: "Died", color: [0.9, 0.42, 0.36], points: thin(died) },
      ],
    },
    {
      type: "lines",
      title: "How well they ate: the share of the people fed, the world's and its greatest realms'",
      unit: "share",
      series: [
        worldLine("The world", whole.fed),
        ...greatRealms.slice(0, 3).map(({ r }) => ({
          name: r.town,
          ref: r.ref,
          color: realmColor(r.ref),
          points: thin(peopleOf(world, r.members).fed),
        })),
      ],
    },
  ];

  // Realms and wars: realms standing, wars fought, the fallen of each year.
  const allRealms = realms.all(),
    realmSpans = allRealms.map((r) => [r.founded, r.ended] as const),
    warSpans = wars.map((w) => [w.declared, w.ended === null ? null : w.ended + 1] as const),
    fallenByYear = new Map<number, number>();
  for (const w of wars)
    for (const b of w.battles)
      fallenByYear.set(b.year, (fallenByYear.get(b.year) ?? 0) + b.fallen[0] + b.fallen[1]);
  const fallen = [...fallenByYear].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
  const realmBlocks: Block[] = [
    {
      type: "lines",
      title: "Realms standing, and wars being fought, through the years",
      unit: "count",
      series: [
        {
          name: "Realms standing",
          color: [1, 0.8, 0.3],
          points: thin(standingThrough(years, realmSpans)),
        },
        {
          name: "Wars being fought",
          color: [0.92, 0.3, 0.26],
          points: thin(standingThrough(years, warSpans)),
        },
      ],
      apart: true,
    },
    {
      type: "lines",
      title: "The fallen in war, year by year",
      unit: "people",
      series: [{ name: "Fallen", color: [0.86, 0.2, 0.18], points: thin(fallen) }],
    },
    {
      type: "bars",
      title: "The greatest realms by their people",
      unit: "people",
      bars: greatRealms.map(({ r, people }) => ({
        label: [r.town],
        ref: r.ref,
        value: people,
        color: realmColor(r.ref),
      })),
    },
  ];

  // Towns: the world's through the years.
  const towns = new Map<number, number>();
  for (const c of lands)
    for (const y of ctx.history.yearsOf(c))
      towns.set(y.year, (towns.get(y.year) ?? 0) + y.settlements);
  const townBlocks: Block[] = [
    {
      type: "lines",
      title: "Towns and villages on the world through the years",
      unit: "count",
      series: [
        worldLine(
          "Towns",
          [...towns].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y })),
        ),
      ],
    },
  ];

  // Faiths and tongues: how many were held and spoken, and the greatest's people.
  const faithSpans = faiths.all().map((f) => [f.founded, null] as const),
    tongueSpans = tongues.all().map((l) => [l.born, l.died] as const);
  const beliefBlocks: Block[] = [
    {
      type: "lines",
      title: "Faiths founded, and tongues spoken, through the years",
      unit: "count",
      series: [
        {
          name: "Faiths",
          color: [0.84, 0.66, 1],
          points: thin(standingThrough(years, faithSpans)),
        },
        {
          name: "Tongues",
          color: [0.5, 0.86, 0.9],
          points: thin(standingThrough(years, tongueSpans)),
        },
      ],
      apart: true,
    },
    {
      type: "lines",
      title: "The greatest faiths' people (the lands that hold each now)",
      unit: "people",
      series: greatFaiths.map((f) => ({
        name: faiths.get(f.ref as Ref)?.name ?? "a faith",
        ref: f.ref,
        color: faithColor(f.ref),
        points: thin(peopleOf(world, f.cells).people),
      })),
    },
    {
      type: "lines",
      title: "The greatest tongues' speakers (the lands that speak each now)",
      unit: "people",
      series: greatTongues.map((t) => {
        const l = tongues.at(t.index);
        return {
          name: l.name,
          ref: l.ref,
          color: languageColor(l.family, l.index),
          points: thin(peopleOf(world, t.cells).people),
        };
      }),
    },
  ];

  const stats: Stat[] = [
    stat("Year", count(now)),
    stat("People", count(peopleNow)),
    stat("Fed", share(whole.fed.at(-1)?.y ?? 0)),
    stat("Realms", count(standing.length)),
    stat("Wars", count(wars.filter((w) => w.ended === null).length)),
    stat("Faiths", count(faithLands.size)),
    stat("Tongues", count(tongueLands.size)),
  ];
  return {
    ref: "world:stats",
    kind: "stats",
    icon: "📈",
    title: "The World in Numbers",
    subtitle: [
      `its numbers through the years, to year ${count(now)} — `,
      link("the chronicle", "world:chronicle"),
      ", ",
      link("the ledger", "world:ledger"),
    ],
    color: null,
    place: null,
    stats,
    tabs: [
      { id: "people", name: "People", blocks: peopleBlocks },
      { id: "realms", name: "Realms & wars", blocks: realmBlocks },
      { id: "towns", name: "Towns", blocks: townBlocks },
      { id: "beliefs", name: "Faiths & tongues", blocks: beliefBlocks },
    ],
    ...(tab ? { tab } : {}),
    followable: false,
    year: now,
    every: STATS_EVERY,
  };
}
