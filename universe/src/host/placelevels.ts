// The town's ground level by level (town mode, R8), as Dwarf Fortress's levels have it: its soil, where its dead lie and
// its wells go down; the water its wells reach; then each depth its lodes are dug to, as its rules tell them (rules/lodes.ts
// LODE_DEPTH_WORDS: as deep as picks could reach, as engines could, as anything could, down to the old heaps). Each
// level's stuff is read off O8's cut (host/placebelow.ts: its rocks each as thick as its share, the first the topmost), at
// the depth the cut draws it; what is dug at each, where (its lot, or the town's workings), and whether its land's means
// reach it. Read only.
import { DAY, YEAR, type World } from "../kernel/index.ts";
import { LODE_DEPTH_WORDS } from "../rules/index.ts";
import { townsOf } from "../sim/index.ts";
import {
  placeBelowRef,
  placeLevelsRef,
  type PlaceInspectLevels,
  type PlaceLevel,
} from "../bridge/index.ts";
import { HAP, graveLot, type Place } from "./place.ts";
import { placeBelow } from "./placebelow.ts";
import { lotWords } from "./placeplan.ts";
import { landEra } from "./village.ts";

/**
 * How far down O8's cut draws each level, a share of its rock (ui/place-below.ts: its wells to 0.18, its lodes' depths at
 * TIER_Y): the soil above them all.
 */
export const LEVEL_DEPTHS = [0, 0.18, 0.22, 0.45, 0.7, 0.96] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The town's ground, level by level (R8). */
export function placeLevels(world: World, place: Place): PlaceInspectLevels {
  const b = placeBelow(world, place),
    year = Math.floor(place.t / YEAR),
    era = landEra(world, place.cell),
    // (How deep its land's means reach: picks always; engines to pump and hoist in the engines' age; more after.)
    reach = era === "modern" ? 2 : era === "industry" ? 1 : 0,
    total = b.rocks.reduce((a, r) => a + r.share, 0) || 1,
    rockAt = (f: number): string => {
      let y = 0;
      for (const r of b.rocks) {
        y += r.share / total;
        if (f <= y + 1e-9) return r.name;
      }
      return b.rocks.at(-1)?.name ?? "its rock";
    },
    wells = (townsOf(world).get(place.town)?.civics ?? []).filter(
      (c) => c.kind === "well" && c.end <= year && (c.fell === null || c.fell > year),
    ),
    grave = graveLot(place),
    buried = place.log.filter((x) => x.what === HAP.buried).length,
    since = place.log.length ? Math.floor(place.log[0]!.t / DAY / 365) : year;
  const levels: PlaceLevel[] = [];
  // (Its soil: its dead, and its wells going down through it.)
  levels.push({
    name: "The soil",
    depth: "Under its streets and fields",
    stuff: cap(b.soil),
    dug: [
      ...(grave !== undefined && grave !== -1
        ? [
            {
              icon: "🪦",
              words: `Its dead lie at ${lotWords(place, grave)}${buried ? `: ${buried} buried since the year ${since}` : ""}`,
              lot: grave,
              works: false,
              state: "dug" as const,
            },
          ]
        : []),
      ...wells.map((c) => ({
        icon: "💧",
        words: `A well, dug in the year ${c.end}, going down`,
        lot: c.at,
        works: false,
        state: "dug" as const,
      })),
    ],
    reached: true,
  });
  // (The water its wells reach, or the sea's bed.)
  levels.push({
    name: b.undersea ? "The sea's bed" : "The water",
    depth: b.undersea ? "What it lives over" : "Where its wells draw from",
    stuff: cap(rockAt(LEVEL_DEPTHS[1])),
    dug: b.undersea
      ? []
      : wells.length
        ? wells.map((c) => ({
            icon: "💧",
            words: `The well dug in the year ${c.end} draws here`,
            lot: c.at,
            works: false,
            state: "dug" as const,
          }))
        : [
            {
              icon: "🌧️",
              words: b.water
                ? `No well: its ${b.water} gives it water at hand`
                : "No well dug down to it: the town lives on the rain it keeps",
              lot: null,
              works: false,
              state: "none" as const,
            },
          ],
    reached: true,
  });
  // (Each depth its lodes are dug to.)
  LODE_DEPTH_WORDS.forEach((words, t) => {
    const here = b.lodes.filter((l) => l.tier >= t);
    levels.push({
      name: cap(words),
      depth:
        t === 3
          ? "Of every depth, worked out"
          : `The ${["first", "second", "third"][t]} depth of its lodes`,
      stuff: cap(rockAt(LEVEL_DEPTHS[2 + t]!)),
      dug: here.map((l) => ({
        icon: "⛏️",
        words:
          l.tier > t
            ? `${cap(l.name)}: dug through, and on below`
            : l.out !== null
              ? `${cap(l.name)}: dug to here, and given out in the year ${l.out}`
              : `${cap(l.name)}: being dug here`,
        lot: null,
        works: true,
        state:
          l.tier > t ? ("dug" as const) : l.out !== null ? ("out" as const) : ("digging" as const),
      })),
      // (The old heaps are reached by sorting, not by digging: by a land whose machines can sort them.)
      reached: t === 3 ? reach >= 2 : t <= reach,
    });
  });
  const deepest = levels.reduce((d, l, k) => (l.dug.length ? k : d), 0);
  return {
    kind: "levels",
    ref: placeLevelsRef(place.town),
    belowRef: placeBelowRef(place.town),
    name: "Its ground, level by level",
    icon: "🪜",
    sub: `${levels.length} levels · dug to ${levels[deepest]!.name.toLowerCase()}`,
    levels,
    reach: ["picks", "engines", "machines that think"][reach]!,
    words: `Its land's means reach ${["as deep as picks can", "as deep as engines can", "as deep as anything can"][reach]}. The stuff of each level is read off its ground's cut: its rocks each as thick as its share, the first the topmost.`,
  };
}
