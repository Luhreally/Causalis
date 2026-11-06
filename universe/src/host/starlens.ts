// The lenses of the stars around (Phase 73, first slice): what the map says of peoples, of lanes and ships, of trade, of war and fire, each
// from what history holds, as `nation.map` says who holds what. Asked for every two seconds while the stars are looked at with one on, and
// only then. Pure reads: looking moves nothing.
import { YEAR, type World } from "../kernel/index.ts";
import {
  farOf,
  civilizationsNear,
  filledOf,
  folkStage,
  folksNear,
  laneLawOf,
  lanesOf,
  peoplesOf,
  starSitesOf,
  starWarsOf,
  tradeOf,
  type Folk,
  type FolkStage,
} from "../sim/index.ts";
import type {
  StarLens,
  StarLensKey,
  StarLensLine,
  StarLensMap,
  StarLensMark,
  StarLensRgb,
} from "../bridge/index.ts";
import type { QueryHandler } from "./host.ts";
import { count, many } from "./inspect/words.ts";

/** Colours the eye tells apart on a phone, flat over a field of stars. */
const GREEN: StarLensRgb = [0.3, 0.85, 0.35],
  AMBER: StarLensRgb = [1, 0.72, 0.16],
  SKY: StarLensRgb = [0.2, 0.78, 1],
  VIOLET: StarLensRgb = [0.78, 0.38, 1],
  ASH: StarLensRgb = [0.56, 0.52, 0.5],
  WHITE: StarLensRgb = [0.94, 0.94, 0.9],
  RED: StarLensRgb = [1, 0.14, 0.1],
  OLD_RED: StarLensRgb = [0.52, 0.16, 0.14],
  ORANGE: StarLensRgb = [1, 0.5, 0.08],
  DARK: StarLensRgb = [0.3, 0.1, 0.34],
  UNMADE: StarLensRgb = [0.09, 0.02, 0.02];

/** How long a fight stands red, and a raid on a run, in years. */
const LATELY = 100,
  RAIDED_LATELY = 40;

/** The peoples about the stars, kept a while: reading them walks every world of every star. */
const FOLKS = new WeakMap<World, { year: number; list: readonly Folk[] }>();
const FOLKS_YEARS = 25;
function folksKept(world: World, year: number): readonly Folk[] {
  const k = FOLKS.get(world);
  if (k && Math.abs(year - k.year) < FOLKS_YEARS) return k.list;
  const list = folksNear(world);
  FOLKS.set(world, { year, list });
  return list;
}

const STAGE_ROW: Readonly<
  Record<FolkStage, { color: StarLensRgb; scale: number; group: number }>
> = {
  camps: { color: GREEN, scale: 0.42, group: 0 },
  villages: { color: GREEN, scale: 0.55, group: 0 },
  towns: { color: AMBER, scale: 0.7, group: 1 },
  cities: { color: AMBER, scale: 0.85, group: 1 },
  works: { color: SKY, scale: 0.9, group: 2 },
  signals: { color: SKY, scale: 1, group: 2 },
  orbit: { color: SKY, scale: 1, group: 2 },
  stars: { color: VIOLET, scale: 1.2, group: 3 },
  ruins: { color: ASH, scale: 0.5, group: 4 },
};
const STAGE_GROUPS: readonly { color: StarLensRgb; one: string; many: string }[] = [
  { color: GREEN, one: "people in camps or villages", many: "peoples in camps or villages" },
  { color: AMBER, one: "people with towns or cities", many: "peoples with towns or cities" },
  { color: SKY, one: "people with machines", many: "peoples with machines" },
  { color: VIOLET, one: "people of the stars", many: "peoples of the stars" },
  { color: ASH, one: "people gone, its ruins left", many: "peoples gone, their ruins left" },
];

function peoplesLens(world: World, year: number): StarLensMap {
  const folks = folksKept(world, year),
    marks: StarLensMark[] = [],
    counts = STAGE_GROUPS.map(() => 0),
    seen = new Map<string, number>();
  for (const f of folks) {
    const row = STAGE_ROW[folkStage(f, year)],
      was = seen.get(f.star as string);
    counts[row.group] = counts[row.group]! + 1;
    // (A star of two peoples shows the further on.)
    if (was !== undefined && was >= row.group && row.group !== 4) continue;
    seen.set(f.star as string, row.group);
    marks.push({ star: f.star as string, color: row.color, scale: row.scale });
  }
  const settled = (filledOf(world)?.all() ?? []).filter(
    (w) => w.gone === undefined && !seen.has(w.star as string),
  );
  for (const w of settled) marks.push({ star: w.star as string, color: WHITE, scale: 0.34 });
  const keys: StarLensKey[] = STAGE_GROUPS.flatMap((g, i) => {
    const n = counts[i]!;
    return n ? [{ color: g.color, words: `${count(n)} ${n === 1 ? g.one : g.many}` }] : [];
  });
  if (settled.length)
    keys.push({
      color: WHITE,
      words: `${many(settled.length, "world", "worlds")} of home's own people, where none rose`,
    });
  return {
    lens: "peoples",
    year,
    marks,
    lines: [],
    keys,
    note: marks.length ? null : "No people has risen about these stars.",
  };
}

function lanesLens(world: World, year: number): StarLensMap {
  const law = laneLawOf(world),
    sites = starSitesOf(world),
    first = lanesOf(world)?.first ?? null,
    marks: StarLensMark[] = [],
    lines: StarLensLine[] = [],
    ship = (from: string | null, to: string) => {
      marks.push({ star: to, color: GREEN, scale: 0.8 });
      lines.push({ a: from, b: to, color: GREEN });
    };
  for (const [, s] of sites?.all() ?? []) if (!s.arrived) ship(null, s.star as string);
  for (const v of lanesOf(world)?.visits ?? [])
    if (!v.arrived && v.arrives > year) ship(null, v.star as string);
  for (const s of peoplesOf(world)?.ships ?? [])
    if (!s.arrived && s.kind !== "fleet" && year >= s.sailed && year < s.arrives)
      ship(s.from as string, s.to as string);
  for (const w of filledOf(world)?.all() ?? [])
    if (!w.arrived && year >= w.sailed && w.gone === undefined) ship(null, w.star as string);
  const under = lines.length,
    keys: StarLensKey[] = [];
  if (law.open) keys.push({ color: SKY, words: "A lane between two stars" });
  if (under)
    keys.push({
      color: GREEN,
      words: `${many(under, "ship", "ships")} under way, and where bound`,
    });
  if (first) {
    marks.push({ star: first.star as string, color: AMBER, scale: 1.3 });
    keys.push({ color: AMBER, words: `Where the first jump came out, year ${first.year}` });
  }
  return {
    lens: "lanes",
    year,
    marks,
    lines,
    keys,
    note: !law.open
      ? `No lanes: a law of this universe. Ships cross on their own drives${under ? "" : ", and none is under way"}.`
      : first
        ? null
        : "The lanes are there, by a law of this universe. No ship has found them yet.",
  };
}

function tradeLens(world: World, year: number): StarLensMap {
  const runs = tradeOf(world)?.all() ?? [],
    ports = new Map<string, { open: number; ships: number; raided: boolean }>(),
    lines: StarLensLine[] = [];
  let holds = 0,
    taken = 0,
    open = 0;
  for (const r of runs) {
    holds += r.ships;
    taken += r.raided;
    const raided = r.raided > 0 && year - r.lastRaidYear <= RAIDED_LATELY,
      p = ports.get(r.toStar as string) ?? { open: 0, ships: 0, raided: false };
    p.ships += r.ships;
    if (!r.closed) {
      open++;
      p.open++;
      // (A line from those who send it, in the colour of how it stands.)
      lines.push({
        a: r.civ ? (r.fromStar as string) : null,
        b: r.toStar as string,
        color: raided ? RED : AMBER,
      });
    }
    if (raided && !r.closed) p.raided = true;
    ports.set(r.toStar as string, p);
  }
  const marks: StarLensMark[] = [...ports].map(([star, p]) => ({
      star,
      color: p.raided ? RED : p.open ? AMBER : ASH,
      scale: p.open ? Math.min(1.7, 0.6 + Math.sqrt(p.ships) / 14) : 0.45,
    })),
    raidedNow = marks.filter((m) => m.color === RED).length,
    still = marks.filter((m) => m.color === AMBER).length,
    shut = marks.filter((m) => m.color === ASH).length,
    keys: StarLensKey[] = [];
  if (still)
    keys.push({
      color: AMBER,
      words: `${many(still, "port", "ports")} and the runs to ${still === 1 ? "it" : "them"}: larger, more come in`,
    });
  if (raidedNow)
    keys.push({
      color: RED,
      words: `${many(raidedNow, "port", "ports")} raided in the last ${RAIDED_LATELY} years`,
    });
  if (shut) keys.push({ color: ASH, words: `${many(shut, "port", "ports")} no run comes to now` });
  return {
    lens: "trade",
    year,
    marks,
    lines,
    keys,
    note: runs.length
      ? `${many(open, "run", "runs")} open; ${many(holds, "hold", "holds")} come in, ${count(taken)} taken.`
      : "No run has opened among the stars yet.",
  };
}

function warLens(world: World, year: number): StarLensMap {
  const wars = world.hasStore("space.starwars") ? starWarsOf(world).all() : [],
    civs = wars.length ? civilizationsNear(world) : [],
    best = new Map<string, { color: StarLensRgb; scale: number; rank: number }>(),
    lines: StarLensLine[] = [],
    mark = (star: string, color: StarLensRgb, scale: number, rank: number) => {
      const was = best.get(star);
      if (!was || was.rank <= rank) best.set(star, { color, scale, rank });
    };
  let lately = 0,
    long = 0,
    sailing = 0;
  for (const w of wars) {
    const star = (w.at?.star ?? civs.find((c) => c.ref === w.enemy)?.star) as string | undefined;
    if (!star || year < w.sailed) continue;
    if (w.won === null) {
      sailing++;
      mark(star, ORANGE, 1.1, 3);
      lines.push({ a: null, b: star, color: ORANGE });
    } else if (year - w.arrives <= LATELY) {
      lately++;
      mark(star, RED, 1, 2);
    } else {
      long++;
      mark(star, OLD_RED, 0.55, 1);
    }
  }
  const falls = world.hasStore("war.fire") ? (farOf(world)?.falls ?? []) : [];
  let carried = 0,
    sky = 0,
    made = 0;
  for (const f of falls) {
    if (f.rung === "carried") {
      carried++;
      mark(f.star as string, AMBER, 1.2, 4);
    } else if (f.rung === "sky") {
      sky++;
      mark(f.star as string, DARK, 1.3, 5);
    } else {
      made++;
      mark(f.star as string, UNMADE, 1.5, 6);
    }
  }
  const keys: StarLensKey[] = [];
  if (sailing)
    keys.push({ color: ORANGE, words: `${many(sailing, "fleet", "fleets")} on the way` });
  if (lately)
    keys.push({
      color: RED,
      words: `${many(lately, "battle", "battles")} of the last ${LATELY} years`,
    });
  if (long) keys.push({ color: OLD_RED, words: `${many(long, "battle", "battles")} before that` });
  if (carried)
    keys.push({ color: AMBER, words: `${many(carried, "fire", "fires")} carried to a world` });
  if (sky) keys.push({ color: DARK, words: `${many(sky, "sky", "skies")} burned` });
  if (made) keys.push({ color: UNMADE, words: `${many(made, "world", "worlds")} unmade` });
  const marks: StarLensMark[] = [...best].map(([star, m]) => ({
    star,
    color: m.color,
    scale: m.scale,
  }));
  return {
    lens: "war",
    year,
    marks,
    lines,
    keys,
    note: marks.length ? null : "No fleet has sailed in war among the stars here yet.",
  };
}

/** What a lens says now (the Who holds lens is `nation.map`'s, and reads there). */
export function starLensMap(world: World, lens: StarLens): StarLensMap {
  const year = Math.floor(world.now / YEAR);
  switch (lens) {
    case "peoples":
      return peoplesLens(world, year);
    case "lanes":
      return lanesLens(world, year);
    case "trade":
      return tradeLens(world, year);
    case "war":
      return warLens(world, year);
    default:
      return { lens, year, marks: [], lines: [], keys: [], note: null };
  }
}

export const STAR_LENS_QUERIES: Readonly<Record<string, QueryHandler>> = {
  "star.lens": (world, args) => starLensMap(world, (args as { lens: StarLens }).lens),
};

