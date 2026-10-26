// A land's bedrock (Phase 15 M124; moved here from the host in Phase 52 M217 so the simulation can
// read it as the pages do): each spot's rock read from its plates, its hotspots and the carbon its
// deep past buried, tallied over the fine grid into each land's rocks (each a share of its spots)
// and the biome most of its spots are; and the keenest stone its rocks give, that its people knap
// tools and points from. Pure functions of the generated world, kept per world.
import { STONES, keenestRock, type Stone } from "../rules/index.ts";
import type { HomeWorld } from "./homeworld.ts";
import { BOUNDARY } from "./plates.ts";
import { isProvinceWorld } from "./provinces.ts";

export type Ground = {
  /** Each land's bedrock: each rock's share of its spots. */
  readonly rock: ReadonlyMap<number, readonly (readonly [string, number])[]>;
  /** Each land's biome most of its spots are. */
  readonly biome: ReadonlyMap<number, number>;
  /** One spot's bedrock. */
  readonly rockAt: (spot: number) => string;
};

const KEPT = new Map<string, Ground>();

/** The bedrock of one spot of the fine grid. */
function rockAt(
  fine: {
    tectonics: {
      crust: Uint8Array;
      boundary: Uint8Array;
      toBoundary: Uint8Array;
      elevation: Float32Array;
      hotspots: readonly number[];
    };
    deep: { coal: Float32Array; oil: Float32Array };
  },
  spot: number,
  coalLine: number,
  oilLine: number,
  hot: ReadonlySet<number>,
): string {
  const t = fine.tectonics;
  if (!t.crust[spot]) return "basalt";
  if (hot.has(spot)) return "basalt";
  if (t.boundary[spot] === BOUNDARY.convergent && t.toBoundary[spot]! <= 2)
    return t.elevation[spot]! > 2000 ? "granite" : "andesite";
  if (fine.deep.coal[spot]! > coalLine) return "coal-measures";
  if (fine.deep.oil[spot]! > oilLine) return "limestone";
  if (t.toBoundary[spot] === 255) return "gneiss";
  if (t.elevation[spot]! > 1500) return "granite";
  return fine.deep.oil[spot]! > 0 ? "shale" : "sandstone";
}

/** The world's ground, land by land (kept: the ground does not change). */
export function groundOf(g: HomeWorld): Ground {
  const key = g.digest,
    kept = KEPT.get(key);
  if (kept) return kept;
  const fine = isProvinceWorld(g) ? g.fine : g,
    n = fine.grid.count,
    landOf = (s: number) => (isProvinceWorld(g) ? g.provinceOf[s]! : s),
    line = (a: Float32Array) => {
      const v = [...a].filter((x) => x > 0).sort((x, y) => x - y);
      return v[Math.floor(v.length * 0.8)] ?? Infinity;
    },
    coalLine = line(fine.deep.coal),
    oilLine = line(fine.deep.oil),
    // (A hotspot's flood of basalt reaches its neighbours.)
    hot = new Set<number>(),
    counts = new Map<number, Map<string, number>>(),
    biomes = new Map<number, Map<number, number>>();
  for (const h of fine.tectonics.hotspots) {
    hot.add(h);
    for (const nb of fine.grid.neighbours.subarray(
      fine.grid.offsets[h]!,
      fine.grid.offsets[h + 1]!,
    ))
      hot.add(nb);
  }
  for (let s = 0; s < n; s++) {
    const land = landOf(s);
    if (land < 0) continue;
    const r = rockAt(fine, s, coalLine, oilLine, hot);
    let m = counts.get(land);
    if (!m) counts.set(land, (m = new Map()));
    m.set(r, (m.get(r) ?? 0) + 1);
    const b = fine.climate.biome[s]!;
    let bm = biomes.get(land);
    if (!bm) biomes.set(land, (bm = new Map()));
    bm.set(b, (bm.get(b) ?? 0) + 1);
  }
  const rock = new Map<number, [string, number][]>(),
    biome = new Map<number, number>();
  for (const [land, m] of counts) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    rock.set(
      land,
      [...m].map(([r, k]) => [r, k / total] as [string, number]).sort((a, b) => b[1] - a[1]),
    );
  }
  for (const [land, bm] of biomes)
    biome.set(land, [...bm].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0]);
  const out = { rock, biome, rockAt: (s: number) => rockAt(fine, s, coalLine, oilLine, hot) };
  KEPT.set(key, out);
  if (KEPT.size > 4) KEPT.delete(KEPT.keys().next().value!);
  return out;
}

/** A land's bedrock rocks (each a share). */
export function landBedrock(g: HomeWorld, cell: number): readonly (readonly [string, number])[] {
  return groundOf(g).rock.get(cell) ?? [];
}

/** A rock is sought for its stone where it makes up at least this share of a land. */
export const SOUGHT = 0.04;

/**
 * A land's stone (Phase 50 M212): the keenest its own rocks give in any amount worth seeking (or
 * the rock underfoot, where one is given), else limestone's.
 */
export function groundStone(
  g: HomeWorld,
  cell: number,
  under?: string,
): { readonly rock: string; readonly stone: Stone } {
  const rocks = [
      ...(under ? [under] : []),
      ...landBedrock(g, cell).flatMap(([rock, k]) => (k >= SOUGHT ? [rock] : [])),
    ],
    rock = rocks.length ? keenestRock(rocks) : "limestone";
  return { rock, stone: STONES[rock] ?? STONES.limestone! };
}
