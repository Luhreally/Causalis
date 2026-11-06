// A road built, and how a people gets about (R1, classic 88, 46, 122 and 155). It reads, it never touches: a road's stages, its gang, what it is laid
// with and what cut it are all read off the world's record, from the years a road's towns and a land's lore already keep, so looking moves nothing
// and nothing here is kept in a save. A gang's stone is told, and no store is drawn down for it: a road taking stuff from a land would be a rule, and
// that is a later step's to measure.
//
// What a road is laid with is what the land holds: its own hard rock where it has one, else timber where woods stand, else what its people fire, else
// the ground rammed hard. Rails are of what its works make a barrel of, whatever that is here. On a people of the water it is all along the sea's floor.
import { YEAR, mix, type World } from "../kernel/index.ts";
import { landBedrock, meansOfWorld } from "../gen/index.ts";
import { homePlanet, loreOf, politiesOf, populationContext, warsOf } from "../sim/index.ts";
import type {
  GetAbout,
  LandEra,
  LandRoad,
  RoadCut,
  RoadLay,
  RoadStage,
  RoadWorks,
} from "../bridge/index.ts";
import { landStone } from "./chain.ts";

type Rgb = readonly [number, number, number];

/** A land's map's tile, in kilometres (sim's PROVINCE_TILE_KM), and the most a road's line winds past straight. */
const WINDS = 1.2;
/** How many kilometres a year a gang lays, by what it lays and whether it has machines. */
const PACE: Readonly<Record<RoadLay, readonly [number, number]>> = {
  track: [7, 30],
  paved: [2.5, 14],
  rails: [4, 18],
};
/** The fewest years a laying takes: a short road still has its gang. */
const LEAST_YEARS = 2.5;
/** How long a road stands before its stones are laid again (years), at the least, and how much more by a keyed share. */
const RELAY_LEAST = 26;
const RELAY_MORE = 14;
/** How long a cut stands before it is mended (years). */
const CUT_YEARS = 2;
/** How long a gang stands idle after fighting or a shock on its land (years): the plan is read at the year's turn, so a stop is seen for the year after. */
const STOP_YEARS = 2;
/** The stuff of a land's road, per kilometre (tonnes): stone, or rails and what they lie on. */
const TONNES: Readonly<Record<RoadLay, number>> = { track: 0, paved: 2400, rails: 140 };

const unit = (h: number) => (h >>> 0) / 4294967296;

/** A road's own number, from its land and ends. */
function roadKey(cell: number, from: number, to: number): number {
  return mix(mix(mix(0x51a7e0d3, cell), from), to);
}

/** A road's length over the land (km), its line's winding allowed for. */
export function roadKm(size: number, tileKm: number, from: number, to: number): number {
  const di = (from % size) - (to % size),
    dj = Math.floor(from / size) - Math.floor(to / size);
  return Math.max(tileKm, Math.sqrt(di * di + dj * dj) * tileKm * WINDS);
}

/** How long a laying takes (years). */
function layYears(what: RoadLay, km: number, machines: boolean): number {
  return Math.max(LEAST_YEARS, km / PACE[what][machines ? 1 : 0]);
}

/**
 * A road's stages: trodden from when it was first wanted, paved from the year the land learned to and the last laying done, railed likewise. A road
 * begun after its land could pave is begun paved: no one lays a track first.
 */
export function roadStages(
  since: number,
  paved: number | null,
  rails: number | null,
  km: number,
  machines: (year: number) => boolean,
): RoadStage[] {
  const out: RoadStage[] = [];
  let at = since;
  if (paved === null || paved > since) {
    const until = since + layYears("track", km, machines(since));
    out.push({ what: "track", from: since, until });
    at = until;
  }
  if (paved !== null) {
    const from = Math.max(paved, at),
      until = from + layYears("paved", km, machines(from));
    out.push({ what: "paved", from, until });
    at = until;
  }
  if (rails !== null) {
    const from = Math.max(rails, at);
    out.push({ what: "rails", from, until: from + layYears("rails", km, machines(from)) });
  }
  return out;
}

/** The year each age of machines reached this land (null: not yet). */
function machinesYear(world: World, cell: number): number | null {
  const lore = loreOf(world);
  return (
    lore.get(cell, "electricity")?.year ??
    lore.get(cell, "sea-electricity")?.year ??
    lore.get(cell, "engines")?.year ??
    null
  );
}

/** Battles fought on a land since a year, oldest first: by which the land's gangs stood idle and its roads were cut. The last land's kept, as a land's roads all ask. */
let lastBattles: {
  world: World;
  cell: number;
  since: number;
  list: { year: number; event: string }[];
} | null = null;
function battlesOn(world: World, cell: number, since: number) {
  if (
    lastBattles &&
    lastBattles.world === world &&
    lastBattles.cell === cell &&
    lastBattles.since === since
  )
    return lastBattles.list;
  const realm = politiesOf(world).of(cell);
  if (!realm) return [];
  const out: { year: number; event: string }[] = [];
  lastBattles = { world, cell, since, list: out };
  for (const w of warsOf(world).fighting(realm.ref)) {
    if (w.ended !== null && w.ended < since) continue;
    for (const b of w.battles)
      if (b.land === cell && b.year >= since) out.push({ year: b.year, event: b.event });
  }
  return out.sort((a, b) => a.year - b.year);
}

/** What the road is laid with on this land (words, tonnes a kilometre, a colour), as a people lays what it has. */
export type RoadStuff = {
  readonly words: string;
  readonly short: string;
  readonly colour: Rgb;
  readonly tonnes: number;
};

export function roadStuff(world: World, cell: number, what: RoadLay): RoadStuff {
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    means = meansOfWorld(g),
    undersea = ctx.medium === "water",
    { rock, stone } = landStone(world, cell),
    rockWord = rock.replace(/-/g, " "),
    hard = landBedrock(g, cell).some(([, k]) => k >= 0.2);
  if (what === "track")
    return undersea
      ? {
          words: "a way kept clear through the weed by those who pass along it",
          short: "the weed kept clear",
          colour: [0.62, 0.66, 0.52],
          tonnes: 0,
        }
      : {
          words: "the land's own ground, trodden hard and ditched",
          short: "trodden ground",
          colour: [0.66, 0.54, 0.38],
          tonnes: 0,
        };
  if (what === "rails") {
    const metal = means.worksBarrel?.name ?? "the hardest thing its works make";
    return undersea
      ? {
          words: `a guide cable of ${metal}, staked along the sea's floor`,
          short: `${metal} cable`,
          colour: [0.3, 0.32, 0.36],
          tonnes: TONNES.rails / 2,
        }
      : {
          words: `rails of ${metal}, laid length by length on a bed of ${hard ? rockWord : "rammed ground"}`,
          short: `rails of ${metal}`,
          colour: [0.3, 0.3, 0.34],
          tonnes: TONNES.rails,
        };
  }
  if (undersea)
    return {
      words: `blocks of ${rockWord}, set along the sea's floor`,
      short: `${rockWord} blocks`,
      colour: stone.colour,
      tonnes: TONNES.paved,
    };
  if (hard)
    return {
      words: `${rockWord}, dug in the land and broken for the road`,
      short: rockWord,
      colour: stone.colour,
      tonnes: TONNES.paved,
    };
  // (No stone to be had: what it has. The ecology's woods first, then what its kilns fire.)
  const p = ctx.provinces.get(cell),
    fertile = (p?.total() ?? 0) > 0;
  if (fertile && means.vessel)
    return {
      words: `slabs of fired ${means.vessel.name}, for the land has no stone to break`,
      short: `fired ${means.vessel.name}`,
      colour: [0.62, 0.42, 0.3],
      tonnes: TONNES.paved * 0.6,
    };
  return {
    words:
      "the ground itself, rammed hard and laid with what grows there, for the land has no stone to break",
    short: "rammed ground",
    colour: [0.46, 0.4, 0.3],
    tonnes: TONNES.paved * 0.4,
  };
}

/** How many hands a laying takes. */
function handsOf(what: RoadLay, machines: boolean, h: number): number {
  const most = what === "track" ? 9 : what === "paved" ? 14 : 12;
  return machines ? 5 + (h % 4) : most - (h % 4);
}

/** Road facts read: its stages, the gang on it now, and whether it is cut. */
export function readRoad(
  world: World,
  cell: number,
  road: Omit<LandRoad, "ref" | "stages" | "works" | "cut">,
  size: number,
  tileKm: number,
  /** The year it is known it was first wanted (false: the record has let that go: long since). */
  known: boolean,
  /** The towns it joins have been shaken these two years past. */
  shaken: { readonly year: number; readonly ref: string | null } | null,
): Pick<LandRoad, "ref" | "stages" | "works" | "cut"> {
  const key = roadKey(cell, road.from, road.to),
    km = roadKm(size, tileKm, road.from, road.to),
    y = world.now / YEAR,
    since = known ? road.since : road.since - 80,
    machined = machinesYear(world, cell),
    machines = (year: number) => machined !== null && year >= machined,
    stages = roadStages(since, road.paved, road.rails, km, machines),
    h = key >>> 0,
    colourOf = (what: RoadLay) => roadStuff(world, cell, what).colour,
    ref = `road:${cell}:${road.from}:${road.to}`;
  // The laying now: its first, else its stones laid again as they wear out (a track is only trodden).
  let works: RoadWorks | null = null;
  const stage = stages.find((s) => y >= s.from && y < s.until),
    battles = () => battlesOn(world, cell, Math.floor(y) - 40),
    stopsIn = (from: number) => {
      const stops: { from: number; to: number; why: string; ref: string | null }[] = [];
      for (const b of battles())
        if (b.year + STOP_YEARS > from && b.year <= y)
          stops.push({
            from: Math.max(from, b.year),
            to: b.year + STOP_YEARS,
            why: "war",
            ref: b.event,
          });
      if (shaken && shaken.year + STOP_YEARS > from)
        stops.push({
          from: Math.max(from, shaken.year),
          to: shaken.year + STOP_YEARS,
          why: "quake",
          ref: shaken.ref,
        });
      // (Those that overlap count once.)
      stops.sort((a, b) => a.from - b.from);
      const merged: typeof stops = [];
      for (const s of stops) {
        const last = merged.at(-1);
        if (last && s.from <= last.to) {
          last.to = Math.max(last.to, s.to);
          last.why = s.why;
          last.ref = s.ref;
        } else merged.push({ ...s });
      }
      return merged;
    },
    idle = (list: readonly { from: number; to: number }[]) =>
      list.reduce((n, s) => n + s.to - s.from, 0);
  if (stage) {
    const stops = stopsIn(stage.from);
    works = {
      what: stage.what,
      from: stage.from,
      until: stage.until + idle(stops),
      again: false,
      stops,
      hands: handsOf(stage.what, machines(stage.from), h),
      machines: machines(stage.from),
      colour: colourOf(stage.what),
    };
  } else {
    const last = stages.at(-1);
    // (A people of the water's way through the weed grows back: it is cleared again, as stones are laid again.)
    const undersea = populationContext(world).medium === "water";
    if (last && (last.what !== "track" || undersea) && y >= last.until) {
      const period = RELAY_LEAST + unit(mix(h, 11)) * RELAY_MORE,
        n = Math.floor((y - last.until) / period),
        from = last.until + n * period + period * 0.5 * unit(mix(h, n)),
        span = layYears(last.what, km, machines(from)) * 0.8;
      if (y >= from && y < from + span) {
        const stops = stopsIn(from);
        works = {
          what: last.what,
          from,
          until: from + span + idle(stops),
          again: true,
          stops,
          hands: handsOf(last.what, machines(from), h),
          machines: machines(from),
          colour: colourOf(last.what),
        };
      }
    }
  }
  // Cut: a battle on its land these two years, on some of its roads; the ground's shaking on the towns it joins.
  let cut: RoadCut | null = null;
  const war = battles().findLast((b) => b.year >= y - CUT_YEARS);
  if (shaken && shaken.year >= y - CUT_YEARS)
    cut = {
      from: shaken.year,
      until: shaken.year + CUT_YEARS,
      at: 0.25 + 0.5 * unit(mix(h, 3)),
      why: "quake",
      ref: shaken.ref,
    };
  else if (war && unit(mix(mix(h, 5), war.year)) < 0.5)
    cut = {
      from: war.year,
      until: war.year + CUT_YEARS,
      at: 0.25 + 0.5 * unit(mix(mix(h, 7), war.year)),
      why: "war",
      ref: war.event,
    };
  return { ref, stages, works, cut };
}

/** A gang's words: who pays, by what they are. */
export function whoPays(world: World, cell: number): "realm" | "hive" | "town" {
  const body = homePlanet(world).generated.life.people?.body;
  if ((body?.social ?? 0) >= 0.9 && (body?.size ?? 100) < 100 && body?.medium !== "water")
    return "hive";
  return politiesOf(world).of(cell) ? "realm" : "town";
}

/** How a land's people get about, read off what they are and what they have come to (R1). */
export function getAbout(world: World, cell: number, era: LandEra): GetAbout {
  const g = homePlanet(world).generated,
    body = g.life.people?.body,
    means = meansOfWorld(g),
    water = body?.medium === "water",
    hive = (body?.social ?? 0) >= 0.9 && (body?.size ?? 100) < 100 && !water,
    grips = means.grips,
    year = Math.floor(world.now / YEAR),
    known = machinesYear(world, cell),
    engines = era === "modern",
    /** How far past engines, 0 to 1 in a century and a half. */
    past = known === null ? 0 : Math.max(0, Math.min(1, (year - known) / 150)),
    share = 0.12 + 0.43 * past;
  if (engines && water)
    return {
      how: "sled",
      own: "current-sled",
      line: "drift-line",
      share: share * 0.6,
      drive: "on its stored current",
      mount: null,
    };
  if (engines && hive)
    return {
      how: "hauler",
      own: null,
      line: "hauler",
      share: 0,
      drive: means.burns ? "burning oil" : "on stored current",
      mount: null,
    };
  if (engines && !grips)
    return {
      how: "line",
      own: null,
      line: "works-line",
      share: 0,
      drive: "on a line laid in the ground",
      mount: null,
    };
  if (engines)
    return {
      how: "wheels",
      own: "car",
      line: "bus",
      share,
      drive: means.burns ? "burning oil" : "on its stored current",
      mount: null,
    };
  if (water) return { how: "swim", own: null, line: null, share: 0, drive: null, mount: null };
  return {
    how: means.rides && era !== "forage" ? "mount" : "feet",
    own: null,
    line: null,
    share: 0,
    drive: null,
    mount: means.rides ? (means.mount ?? null) : null,
  };
}

