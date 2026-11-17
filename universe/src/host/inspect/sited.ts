// Why a thing of a town stands where it does (asked 2026-11-16): a building by what it needs of the ground (rules/buildings.ts
// CIVIC_SITE) and the quarter of the town its block was taken in (sim/town/sites.ts); a home by who holds that ground, where
// the land's wealth is shared unevenly enough to sort its people (before engines the well-off hold the heart and the high
// ground, the poor the edge downwind and the low ground by the water; once its people drive, the well-off move out to the
// high edge); a tall home by the square with shops on its ground floor; ground toward the water left open by a town that has
// flooded. And the town's streets in a line, read off how they were laid. Read only.
import type { Ref, World } from "../../kernel/index.ts";
import {
  CIVIC_SITE,
  LEVEL,
  ZONING_NEEDS,
  civic,
  seatSite,
  type CivicKind,
  type CivicSite,
} from "../../rules/index.ts";
import {
  floodGround,
  giniOf,
  knows,
  politiesOf,
  populationContext,
  quarterOf,
  townSeed,
  type Fabric,
} from "../../sim/index.ts";
import {
  HEART_BLOCKS,
  QUARTER,
  shopsBelow,
  streetWords,
  type Line,
  type TownSite,
} from "../../bridge/index.ts";
import { townSiteOf } from "../sites.ts";
import { landEra } from "../village.ts";

/** How unevenly a land's wealth must be shared for its people to sort themselves by ground (Gini). */
const SORTS = 0.3;

/** The quarter a building that wants a site wants (-1: none). */
const QUARTER_OF: Partial<Record<CivicSite, number>> = {
  water: QUARTER.water,
  lee: QUARTER.lee,
  high: QUARTER.high,
  road: QUARTER.road,
};

/** What a building of a kind wants in this town as it stands: a seat's halls high; works by its land's law. */
function wantOf(world: World, town: Ref, cell: number, kind: CivicKind): CivicSite {
  const seat = politiesOf(world).of(cell)?.town === town,
    want = seat ? seatSite(kind) : CIVIC_SITE[kind];
  return want === "works"
    ? knows(populationContext(world), cell, ZONING_NEEDS)
      ? "lee"
      : "homes"
    : want;
}

/** The water a town's water side is toward, in a word. */
function waterWord(world: World, cell: number): string {
  return populationContext(world).generated.water.river[cell] ? "river" : "water";
}

/** Why one of a town's buildings stands where it does, in a line. */
export function whyBuilding(
  world: World,
  town: Ref,
  cell: number,
  kind: CivicKind,
  at: number,
  site: TownSite | null,
): Line {
  const want = wantOf(world, town, cell, kind),
    q = quarterOf(townSeed(town), Math.floor(at / 8)),
    wanted = QUARTER_OF[want],
    name = civic(kind).name.replace(/^(a|an) /, "");
  if (wanted !== undefined && q !== wanted)
    return [
      `At the town's edge as it stood when it was begun: no ground ${want === "water" ? "toward the water" : want === "lee" ? "in its lee" : want === "high" ? "on its high ground" : "toward its way in"} lay open for it then.`,
    ];
  switch (want) {
    case "water":
      return [
        `On the ${waterWord(world, cell)} side: the ${name} needs the water${kind === "mill" ? " to turn its wheel" : kind === "docks" ? " for its ships" : ""}.`,
      ];
    case "lee":
      return [
        `Downwind of the town: its smoke blows away from the homes${CIVIC_SITE[kind] === "works" ? ", as its land's written law keeps its works apart" : ""}.`,
      ];
    case "high":
      return [
        kind === "granary"
          ? "On high, dry ground near the square: the harvest keeps there, above the damp and the floods."
          : kind === "observatory"
            ? "On the town's high ground: the sky is clearest from it."
            : `On the high ground by the square: the seat's ${name} stands over the town.`,
      ];
    case "road": {
      const way = site?.roads[0];
      return [
        way
          ? `Toward the ${way.rails ? "railway" : "road"} in: what it takes and sends comes and goes by it.`
          : "Toward the town's way in: what it takes and sends comes and goes by it.",
      ];
    }
    case "homes":
      return [
        CIVIC_SITE[kind] === "works"
          ? "Among the homes: its land has no written law to keep its works apart from them."
          : "Among the homes, past the square: those it serves live about it.",
      ];
    case "edge":
      return ["At the town's edge as it stood when it was begun."];
    default:
      return ["By the square: those it serves walk to it, and the ground there is the dearest."];
  }
}

/** Why a home stands where it does, by who holds that ground (none said where the land is too even to sort its people). */
export function whyHome(
  world: World,
  town: Ref,
  cell: number,
  f: Fabric,
  lot: number,
  level: number,
): Line[] {
  const out: Line[] = [],
    b = Math.floor(lot / 8),
    seed = townSeed(town),
    q = quarterOf(seed, b),
    blocks = Math.max(1, Math.ceil(f.next / 8)),
    heart = b < HEART_BLOCKS,
    near = b < Math.max(HEART_BLOCKS * 3, blocks / 3),
    edge = b >= blocks / 2;
  // (Mixed: a tall home by the square.)
  if (shopsBelow(lot, f.next, level))
    out.push(["Shops on its ground floor: it stands near the square, where those who pass buy."]);
  if (floodGround(seed, b))
    out.push(["Toward the water, on the low ground the floods take first."]);
  const gini = giniOf(world, cell);
  if (gini === null || gini < SORTS) return out;
  const drives = landEra(world, cell) === "modern";
  if (!drives && heart) out.push(["By the square: the well-off hold the dearest ground."]);
  else if (!drives && q === QUARTER.high && near)
    out.push(["High ground near the square: the well-off hold it."]);
  else if (drives && q === QUARTER.high && edge)
    out.push(["High ground at the town's edge: the well-off live out here, and drive in."]);
  else if (drives && heart && level >= LEVEL.tenement)
    out.push(["By the square, in the tall homes: those who work there and cannot drive."]);
  else if (q === QUARTER.lee && edge)
    out.push(["Downwind at the town's edge: the poor live where its smoke blows."]);
  else if (q === QUARTER.water && edge)
    out.push(["Low ground toward the water, at the edge: the poor live where the floods come."]);
  return out;
}

/** Open ground a town that has flooded keeps its homes off. */
export function whyOpen(town: Ref, lot: number, site: TownSite | null): Line | null {
  return site?.dry && floodGround(townSeed(town), Math.floor(lot / 8))
    ? ["Open ground toward the water: the town has flooded, and raises no new homes here."]
    : null;
}

/** A town's site as its pages read it (null: none: a colony's halls, a town gone). */
export function siteOfTown(world: World, town: Ref, f: Fabric): TownSite | null {
  return townSiteOf(world, town, f);
}

/** A town's streets in a line, read off how they were laid (bridge/sites.ts streetWords). */
export function streetsLine(site: TownSite | null, measured: Uint8Array | null): Line | null {
  return site && measured ? [streetWords(measured, site)] : null;
}
