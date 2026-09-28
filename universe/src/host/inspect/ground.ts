// The ground and what lies in it (Phase 15 M124, Classic's tile "Chemical substrate" and
// "Material structure"): a land's bedrock (read from its plates, its hotspots and the carbon
// its deep past buried), its soil (by its biome), what lies in it (its deposits, in tonnes of
// ore and of metal), its water, and the air over the world. Pure functions of the generated
// world, kept per world (the ground does not change).
import {
  MATERIAL_MATTER,
  ORE_GRADE,
  ROCKS,
  ROLE_KG,
  SOILS,
  SUBSTANCE,
  SUBSTANCES,
  TONNES_A_UNIT,
  type Rock,
} from "../../rules/index.ts";
import { BIOME, BOUNDARY, isProvinceWorld } from "../../gen/index.ts";
import type { World } from "../../kernel/index.ts";
import { airOf, homePlanet, politiesOf } from "../../sim/index.ts";
import type { Block, Item } from "../../bridge/index.ts";
import { count, item, link, stat } from "./words.ts";
import { DEPOSIT_MINERALS, makeUpBlock, substRef, weight } from "./matter.ts";

type Ground = {
  /** Each land's bedrock: each rock's share of its spots. */
  readonly rock: ReadonlyMap<number, readonly (readonly [string, number])[]>;
  /** Each land's biome most of its spots are. */
  readonly biome: ReadonlyMap<number, number>;
  /** One spot's bedrock. */
  readonly rockAt: (spot: number) => string;
};

const KEPT = new Map<string, Ground>();

const BIOME_SOIL: Readonly<Record<number, string>> = {
  [BIOME.tundra]: "tundra",
  [BIOME.borealForest]: "borealForest",
  [BIOME.coldDesert]: "coldDesert",
  [BIOME.steppe]: "steppe",
  [BIOME.temperateForest]: "temperateForest",
  [BIOME.temperateRainforest]: "temperateRainforest",
  [BIOME.hotDesert]: "hotDesert",
  [BIOME.savanna]: "savanna",
  [BIOME.tropicalDryForest]: "tropicalDryForest",
  [BIOME.tropicalRainforest]: "tropicalRainforest",
  [BIOME.alpine]: "alpine",
  [BIOME.ice]: "ice",
  [BIOME.seaIce]: "ice",
};

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
function groundOf(world: World): Ground {
  const g = homePlanet(world).generated,
    key = g.digest,
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

const rockOf = (id: string): Rock => ROCKS.find((r) => r.id === id)!;

/** Every land's chief rock (the Ground lens paints them all, peopled or not). */
export function groundMap(world: World): { cell: number; rock: string }[] {
  const out: { cell: number; rock: string }[] = [];
  for (const [cell, rocks] of groundOf(world).rock)
    if (rocks[0]) out.push({ cell, rock: rocks[0][0] });
  return out.sort((a, b) => a.cell - b.cell);
}

/** A land under the Ground lens: its rocks, and its soil. */
export function groundReading(
  world: World,
  cell: number,
): { line: string; stats: { label: string; value: string }[] } | null {
  const ground = groundOf(world),
    rocks = ground.rock.get(cell);
  if (!rocks?.length) return null;
  const soil = SOILS[BIOME_SOIL[ground.biome.get(cell) ?? -1] ?? "sea"]!;
  return {
    line: `Ground: ${rocks.map(([r, k]) => `${rockOf(r).name} ${Math.round(k * 100)}%`).join(", ")}`,
    stats: [{ label: "Its soil", value: soil.name }],
  };
}

/** One spot's ground: its bedrock, and the soil of a biome over it (a region's tile). */
export function spotGround(
  world: World,
  spot: number,
  biome: number,
): { rock: string; soil: string } {
  return {
    rock: rockOf(groundOf(world).rockAt(spot)).name,
    soil: SOILS[BIOME_SOIL[biome] ?? "sea"]!.name,
  };
}

/** A land's bedrock rocks (each a share), for the Ground lens and tab. */
export function bedrockOf(world: World, cell: number): readonly (readonly [string, number])[] {
  return groundOf(world).rock.get(cell) ?? [];
}

/** A land's Ground tab: its bedrock and what it is made of, its soil, what lies in it, its water, the air. */
export function groundBlocks(world: World, cell: number): Block[] {
  const ground = groundOf(world),
    rocks = ground.rock.get(cell) ?? [],
    soilKey = BIOME_SOIL[ground.biome.get(cell) ?? -1] ?? "sea",
    soil = SOILS[soilKey]!,
    minerals = new Map<string, number>();
  for (const [r, k] of rocks)
    for (const [s, m] of rockOf(r).parts) minerals.set(s, (minerals.get(s) ?? 0) + k * m);
  const blocks: Block[] = [];
  if (rocks.length)
    blocks.push(
      {
        type: "composition",
        title: "Its bedrock",
        parts: rocks.map(([r, k]) => ({
          name: [rockOf(r).name],
          share: k,
          color: rockOf(r).colour,
        })),
        note: rocks.map(([r]) => `${rockOf(r).name}: ${rockOf(r).words}`)[0],
      },
      makeUpBlock(
        [...minerals].sort((a, b) => b[1] - a[1]),
        null,
        "What the rock is made of",
      ),
    );
  blocks.push(makeUpBlock(soil.parts, null, `Its soil: ${soil.name}`));
  // What lies in it: its deposits, in tonnes of ore and of what the ore holds.
  const g = homePlanet(world).generated,
    fine = isProvinceWorld(g) ? g.fine : g,
    landOf = (s: number) => (isProvinceWorld(g) ? g.provinceOf[s]! : s),
    here = fine.deposits.filter((d) => landOf(d.cell) === cell);
  if (here.length)
    blocks.push({
      type: "list",
      title: "What lies in it",
      items: here.map((d): Item => {
        const ore = d.richness * TONNES_A_UNIT,
          grade = ORE_GRADE[d.kind],
          minerals = DEPOSIT_MINERALS[d.kind] ?? [];
        return item(
          [
            link(`${d.kind}`, d.ref),
            `: ${weight(ore * 1000)} of ore`,
            ...(grade
              ? [
                  `, holding ${weight(ore * 1000 * grade.share)} of `,
                  link(SUBSTANCES[SUBSTANCE[grade.of]!]!.name, substRef(grade.of)),
                ]
              : []),
            ...(minerals.length
              ? [
                  " (",
                  ...minerals.flatMap((m, i) => [
                    ...(i ? [", "] : []),
                    link(SUBSTANCES[SUBSTANCE[m]!]!.name, substRef(m)),
                  ]),
                  ")",
                ]
              : []),
          ],
          d.ref,
        );
      }),
    });
  // Its water; the air over the world.
  const wet = g.water.river[cell] || g.water.lake[cell];
  blocks.push({
    type: "facts",
    title: "Its water",
    rows: [
      stat(
        "Fresh water",
        wet
          ? g.water.river[cell]
            ? "a river runs through it"
            : "a lake lies in it"
          : "only what rain and wells give",
      ),
    ],
  });
  blocks.push(airBlock(world));
  return blocks;
}

/** The air's make-up, by volume: nitrogen, oxygen, argon, and the carbon dioxide the world holds now. */
export function airBlock(world: World): Block {
  const ppm = airOf(world).air.carbon,
    parts: [string, number][] = [
      ["nitrogen", 0.7808],
      ["oxygen", 0.2095],
      ["argon", 0.0093],
      ["co2", ppm / 1e6],
    ],
    whole = parts.reduce((s, [, v]) => s + v, 0);
  return makeUpBlock(
    parts.map(([id, v]) => [id, v / whole] as [string, number]),
    null,
    "The air (by volume)",
    `Carbon dioxide: ${count(ppm)} parts in a million (280 before any fire of coal or oil).`,
  );
}

/** The land a realm-owned design stands on: its seat (null: not a realm's). */
export function realmSeat(world: World, owner: string): number | null {
  if (!owner.startsWith("pol:")) return null;
  const r = politiesOf(world).get(owner as never);
  return r ? r.seat : null;
}

/**
 * What a design is made of, by weight (Phase 15 M125): each part its role's weight of its
 * material, stone the land's own chief rock (granite where it stands on none).
 */
export function designMatter(
  world: World,
  parts: readonly { readonly role: string; readonly material: string }[],
  cell: number | null,
): { kg: number; parts: [string, number][] } | null {
  const chief = cell !== null ? (groundOf(world).rock.get(cell)?.[0]?.[0] ?? "granite") : "granite",
    stone = rockOf(chief).parts,
    out = new Map<string, number>();
  let kg = 0;
  for (const part of parts) {
    const w = ROLE_KG[part.role] ?? 0,
      makeup = part.material === "stone" ? stone : MATERIAL_MATTER[part.material];
    if (!w || !makeup) continue;
    kg += w;
    for (const [s, k] of makeup) out.set(s, (out.get(s) ?? 0) + w * k);
  }
  if (!kg) return null;
  return {
    kg,
    parts: [...out].map(([s, w]) => [s, w / kg] as [string, number]).sort((a, b) => b[1] - a[1]),
  };
}
