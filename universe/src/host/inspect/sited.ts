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
  QUARTER,
  groundWealth,
  homeGround,
  rankSteep,
  shareWords,
  shopsBelow,
  streetWords,
  type HomeGround,
  type Line,
  type TownRank,
  type TownSite,
} from "../../bridge/index.ts";
import { townSiteOf } from "../sites.ts";
import { landEra } from "../village.ts";

/** The quarter a building that wants a site wants (-1: none). */
const QUARTER_OF: Partial<Record<CivicSite, number>> = {
  water: QUARTER.water,
  lee: QUARTER.lee,
  high: QUARTER.high,
  road: QUARTER.road,
};

/** What a building of a kind wants in this town as it stands: a seat's halls high; works by its land's law. */
function wantOf(world: World, town: Ref, cell: number, kind: CivicKind): CivicSite {
  const realm = politiesOf(world).of(cell),
    seat =
      !!realm &&
      realm.seat === cell &&
      realm.town === populationContext(world).settlements.get(town)?.name,
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
    seed = townSeed(town);
  // (Mixed: a tall home by the square.)
  if (shopsBelow(lot, f.next, level))
    out.push(["Shops on its ground floor: it stands near the square, where those who pass buy."]);
  if (floodGround(seed, b))
    out.push(["Toward the water, on the low ground the floods take first."]);
  const gini = giniOf(world, cell) ?? 0,
    drives = landEra(world, cell) === "modern",
    ground = homeGround(seed, lot, f.next, level, gini, drives);
  if (ground) out.push([GROUND_WORDS[ground]]);
  // (And how it shows, on a low home: view/town.ts rankedHome.)
  const wealth = level <= 2 ? groundWealth(ground) : 0,
    steep = rankSteep(gini) >= 0.75 ? "steeply" : "unevenly";
  if (wealth > 0)
    out.push([
      `It looks it: taller and dressed, a lamp at its door and a garden behind, for its land's wealth is ${steep} held.`,
    ]);
  else if (wealth < 0)
    out.push([
      `It looks it: low and patched, of the cheapest stuff to hand, a lean-to crowded against it, for its land's wealth is ${steep} held.`,
    ]);
  return out;
}

/** Each ground wealth sorts a town's homes onto, in a line. */
const GROUND_WORDS: Readonly<Record<HomeGround, string>> = {
  heart: "By the square: the well-off hold the dearest ground.",
  high: "High ground near the square: the well-off hold it.",
  "high-edge": "High ground at the town's edge: the well-off live out here, and drive in.",
  "tall-heart": "By the square, in the tall homes: those who work there and cannot drive.",
  "lee-edge": "Downwind at the town's edge: the poor live where its smoke blows.",
  "water-edge": "Low ground toward the water, at the edge: the poor live where the floods come.",
};

/**
 * Whose a lot is, where its town shows it (bridge/rank.ts): a great house's hall, and why it is as great as it is; a key
 * figure's home.
 */
export function whoseLot(rank: TownRank | null | undefined, lot: number): Line[] {
  const out: Line[] = [],
    hall = rank?.halls?.find((h) => h.lot === lot),
    mark = rank?.marks?.find((m) => m.lot === lot);
  if (hall)
    out.push([
      "The hall of ",
      hall.ref ? { text: `the house of ${hall.name}`, ref: hall.ref } : `the house of ${hall.name}`,
      `: its wealth is ${shareWords(hall.share)} of all its realm's great houses hold, and its hall stands as tall for it, its yard walled, its banner over it.`,
    ]);
  if (mark)
    out.push([
      "The home of ",
      { text: mark.name, ref: mark.ref },
      `, ${mark.title.charAt(0).toLowerCase()}${mark.title.slice(1)}: a pennant stands at its door.`,
    ]);
  return out;
}

/** A seat's hall: whose it is, and why it is as great as it is. */
export function seatLine(rank: TownRank | null | undefined): Line | null {
  const seat = rank?.seat;
  return seat
    ? [
        "The seat of its realm: ",
        { text: "its ruler", ref: seat.ruler },
        seat.grade === 2
          ? " keeps it as a palace with wings, the realm old and of many lands; its banners and guards at its door."
          : seat.grade === 1
            ? " keeps it as a palace with a keep over it, the realm grown in years and lands; its banners and guards at its door."
            : " keeps it as a hall, its banners and guards at its door: the realm is young or small yet.",
      ]
    : null;
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
