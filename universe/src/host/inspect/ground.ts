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
import { BIOME, groundOf, isProvinceWorld, type Ground } from "../../gen/index.ts";
import type { World } from "../../kernel/index.ts";
import { airOf, homePlanet, politiesOf } from "../../sim/index.ts";
import type { Block, Item } from "../../bridge/index.ts";
import { count, item, link, stat } from "./words.ts";
import { DEPOSIT_MINERALS, makeUpBlock, substRef, weight } from "./matter.ts";

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

/** The world's ground, land by land (gen/bedrock.ts: kept, the ground does not change). */
function groundIn(world: World): Ground {
  return groundOf(homePlanet(world).generated);
}

const rockOf = (id: string): Rock => ROCKS.find((r) => r.id === id)!;

/** Every land's chief rock (the Ground lens paints them all, peopled or not). */
export function groundMap(world: World): { cell: number; rock: string }[] {
  const out: { cell: number; rock: string }[] = [];
  for (const [cell, rocks] of groundIn(world).rock)
    if (rocks[0]) out.push({ cell, rock: rocks[0][0] });
  return out.sort((a, b) => a.cell - b.cell);
}

/** A land under the Ground lens: its rocks, and its soil. */
export function groundReading(
  world: World,
  cell: number,
): { line: string; stats: { label: string; value: string }[] } | null {
  const ground = groundIn(world),
    rocks = ground.rock.get(cell);
  if (!rocks?.length) return null;
  const soil = SOILS[BIOME_SOIL[ground.biome.get(cell) ?? -1] ?? "sea"]!;
  return {
    line: `Ground: ${rocks.map(([r, k]) => `${rockOf(r).name} ${Math.round(k * 100)}%`).join(", ")}`,
    stats: [{ label: "Its soil", value: soil.name }],
  };
}

/** A land's soil: what it is called and what it is made of (sea-floor mud for the sea). */
export function soilOf(
  world: World,
  cell: number,
): { readonly name: string; readonly parts: readonly (readonly [string, number])[] } {
  return SOILS[BIOME_SOIL[groundIn(world).biome.get(cell) ?? -1] ?? "sea"]!;
}

/** One spot's ground: its bedrock, and the soil of a biome over it (a region's tile). */
export function spotGround(
  world: World,
  spot: number,
  biome: number,
): { rock: string; soil: string } {
  return {
    rock: rockOf(groundIn(world).rockAt(spot)).name,
    soil: SOILS[BIOME_SOIL[biome] ?? "sea"]!.name,
  };
}

/** One spot's bedrock, by its rock's id (a band's stone is knapped from it: Phase 49 M211). */
export function spotRock(world: World, spot: number): string {
  return groundIn(world).rockAt(spot);
}

/** A land's bedrock rocks (each a share), for the Ground lens and tab. */
export function bedrockOf(world: World, cell: number): readonly (readonly [string, number])[] {
  return groundIn(world).rock.get(cell) ?? [];
}

/** A land's Ground tab: its bedrock and what it is made of, its soil, what lies in it, its water, the air. */
export function groundBlocks(world: World, cell: number): Block[] {
  const ground = groundIn(world),
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
  const chief = cell !== null ? (groundIn(world).rock.get(cell)?.[0]?.[0] ?? "granite") : "granite",
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
