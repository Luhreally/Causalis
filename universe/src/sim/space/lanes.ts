// The lanes between stars in a world's history (Phase 68, first slice). The law and the map are pure readings
// (rules/lanes.ts), kept per seed. What history holds is here: the first jump of a home ship, and the ships that go
// through the lanes to a people whose fields and lit towns are seen, which no crossing on a drive would have reached. A
// people must find the lanes (a row of the late tree) before any of it; until then nothing here draws or writes.
import {
  Rng,
  defineEventType,
  defineStream,
  hashString,
  seedWithoutAct,
  type World,
} from "../../kernel/index.ts";
import {
  EARTHLIKE,
  laneLaw,
  laneTable,
  lanesAmong,
  routeIn,
  waysOf,
  type Lane,
  type LaneLaw,
  type LaneRoute,
  type LaneStar,
  type LaneTable,
  type LaneWays,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { clusterOf, starSitesOf, type StarSiteStore } from "./stars.ts";

export const LANE_EVENTS = {
  /** The first ship of the home world to jump. */
  first: defineEventType("lanes.first", 7),
  /** A ship through the lanes to a people seen, and its coming. */
  sent: defineEventType("lanes.sent", 4),
  came: defineEventType("lanes.came", 6),
};

export const LANE_DRAW = defineStream("space.lanes");

/** A seed's text for what is drawn of a place: the law's dial changes what ships do, and no people or star. */
export const lawlessSeed = (text: string): string => seedWithoutAct(text, "lanes -");

/** What finds the lanes: a row of the late tree. */
export const LANE_ROW = "lane-sounding";

/** A law of this universe, as its seed and its dial have it. */
const LAWS = new Map<string, LaneLaw>();
export function laneLawOf(world: World): LaneLaw {
  const text = world.seed.text;
  let law = LAWS.get(text);
  if (!law) {
    if (LAWS.size > 16) LAWS.clear();
    const g = homePlanet(world).generated;
    LAWS.set(text, (law = laneLaw(text, g.prior === EARTHLIKE.name)));
  }
  return law;
}

/** The lanes of a world's stars: the home star first. A pure function of its seed's name, kept. */
export type LaneMap = {
  readonly stars: readonly LaneStar[];
  readonly at: ReadonlyMap<string, number>;
  readonly lanes: readonly Lane[];
  readonly ways: LaneWays;
};

const MAPS = new Map<string, LaneMap>();
export function laneMapOf(world: World): LaneMap {
  const key = world.seed.text;
  let map = MAPS.get(key);
  if (!map) {
    if (MAPS.size > 4) MAPS.clear();
    const star = homePlanet(world).generated.star,
      stars: LaneStar[] = [
        { ref: star.ref as string, x: 0, y: 0, z: 0, mass: star.mass },
        ...clusterOf(world).map((s) => ({
          ref: s.ref as string,
          x: s.x,
          y: s.y,
          z: s.z,
          mass: s.mass,
        })),
      ],
      lanes = lanesAmong(stars);
    map = {
      stars,
      at: new Map(stars.map((s, i) => [s.ref, i])),
      lanes,
      ways: waysOf(stars.length, lanes),
    };
    MAPS.set(key, map);
  }
  return map;
}

const TABLES = new Map<string, LaneTable>();
/** The way by lanes between two stars, whoever knows of it (null: none runs). */
export function laneRoute(world: World, from: string, to: string): LaneRoute | null {
  const map = laneMapOf(world),
    a = map.at.get(from),
    b = map.at.get(to);
  if (a === undefined || b === undefined || a === b) return null;
  const key = `${world.seed.text} ${a}`;
  let t = TABLES.get(key);
  if (!t) {
    if (TABLES.size > 64) TABLES.clear();
    TABLES.set(key, (t = laneTable(map.stars, map.lanes, map.ways, a)));
  }
  return routeIn(map.stars, map.lanes, map.ways, t, b);
}

/** No people of the stars finds the lanes before this year of the chronicle: early histories stand (est.). */
export const PEOPLES_FIND_LANES = 1400;

/** The year a people followed among the stars finds the lanes: a draw keyed to it, by its pace. */
export function laneYearOf(
  world: World,
  civ: { ref: string; stars: number; pace: number },
): number {
  const u = (hashString(`${world.seed.text.split(" ~")[0]} lanes ${civ.ref}`) >>> 0) / 4294967296;
  return Math.max(
    PEOPLES_FIND_LANES + Math.round(300 * u),
    civ.stars + Math.round((300 + 600 * u) * civ.pace),
  );
}

/** What history holds of the lanes: kept with the sites of the ships that went by them. */
export const lanesOf = (world: World): StarSiteStore | null => starSitesOf(world);

/** A keyed draw for a world's lanes (a stream history never drew from before them). */
export const laneDraw = (world: World, subject: number, year: number, n: number): number =>
  new Rng(world.seed).real(LANE_DRAW, subject, year, 0, n);
