// The ground and what lies in it (Phase 15 M124, Classic's tile "Chemical substrate" and
// "Material structure"): a land's bedrock (read from its plates, its hotspots and the carbon
// its deep past buried), its soil (by its biome), what lies in it (its deposits, in tonnes of
// ore and of metal), its water, and the air over the world. Pure functions of the generated
// world, kept per world (the ground does not change).
import {
  KIND_GASES,
  MATERIAL_MATTER,
  ORE_GRADE,
  ROLE_KG,
  TONNES_A_UNIT,
  depositMineralsOn,
  findSubstance,
  kindBurns,
  oreGradeOn,
  roleWord,
  worldRock,
  worldSoil,
} from "../../rules/index.ts";
import {
  BIOME,
  groundOf,
  isProvinceWorld,
  nativeIronLands,
  worldChemistry,
  type Ground,
} from "../../gen/index.ts";
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
  const chem = worldChemistry(homePlanet(world).generated),
    ground = groundIn(world),
    rocks = ground.rock.get(cell);
  if (!rocks?.length) return null;
  const soil = worldSoil(chem, BIOME_SOIL[ground.biome.get(cell) ?? -1] ?? "sea");
  return {
    line: `Ground: ${rocks.map(([r, k]) => `${worldRock(chem, r).name} ${Math.round(k * 100)}%`).join(", ")}`,
    stats: [{ label: "Its soil", value: soil.name }],
  };
}

/** A land's soil: what it is called and what it is made of (sea-floor mud for the sea). */
export function soilOf(
  world: World,
  cell: number,
): { readonly name: string; readonly parts: readonly (readonly [string, number])[] } {
  const chem = worldChemistry(homePlanet(world).generated);
  return worldSoil(chem, BIOME_SOIL[groundIn(world).biome.get(cell) ?? -1] ?? "sea");
}

/** One spot's ground: its bedrock, and the soil of a biome over it (a region's tile). */
export function spotGround(
  world: World,
  spot: number,
  biome: number,
): { rock: string; soil: string } {
  const chem = worldChemistry(homePlanet(world).generated);
  return {
    rock: worldRock(chem, groundIn(world).rockAt(spot)).name,
    soil: worldSoil(chem, BIOME_SOIL[biome] ?? "sea").name,
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
  // (The world's own chemistry: its rocks and soils are Earth's only on Earth.)
  const chem = worldChemistry(homePlanet(world).generated),
    rockOf = (id: string) => worldRock(chem, id),
    ground = groundIn(world),
    rocks = ground.rock.get(cell) ?? [],
    soilKey = BIOME_SOIL[ground.biome.get(cell) ?? -1] ?? "sea",
    soil = worldSoil(chem, soilKey),
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
  // What lies in it: its deposits, in tonnes of ore and of what the ore holds, in this world's
  // words; and the native iron its basalt keeps, where nothing rusts it.
  const g = homePlanet(world).generated,
    fine = isProvinceWorld(g) ? g.fine : g,
    landOf = (s: number) => (isProvinceWorld(g) ? g.provinceOf[s]! : s),
    here = fine.deposits.filter((d) => landOf(d.cell) === cell),
    native = nativeIronLands(g).has(cell);
  if (here.length || native)
    blocks.push({
      type: "list",
      title: "What lies in it",
      items: [
        ...here.map((d): Item => {
          const ore = d.richness * TONNES_A_UNIT,
            grade = oreGradeOn(chem, d.kind) ?? ORE_GRADE[d.kind],
            minerals = depositMineralsOn(chem, d.kind) ?? DEPOSIT_MINERALS[d.kind] ?? [];
          return item(
            [
              link(roleWord(chem, d.kind), d.ref),
              `: ${weight(ore * 1000)} of ore`,
              ...(grade
                ? [
                    `, holding ${weight(ore * 1000 * grade.share)} of `,
                    link(findSubstance(grade.of)!.name, substRef(grade.of)),
                  ]
                : []),
              ...(minerals.length
                ? [
                    " (",
                    ...minerals.flatMap((m, i) => [
                      ...(i ? [", "] : []),
                      link(findSubstance(m)!.name, substRef(m)),
                    ]),
                    ")",
                  ]
                : []),
            ],
            d.ref,
          );
        }),
        ...(native
          ? [
              item([
                "Native iron: lumps of ",
                link(findSubstance("telluric-iron")!.name, substRef("telluric-iron")),
                " in its basalt, where the lava flowed through buried coal",
              ]),
            ]
          : []),
      ],
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
  const chem = worldChemistry(homePlanet(world).generated),
    ppm = airOf(world).air.carbon,
    // (The Sun's own air keeps its literal shares; a world's nitrogen makes up what its oxygen lacks.)
    nitrogen = chem.solar ? 0.7808 : 0.7808 + (0.2095 - chem.o2),
    oxygen = chem.solar ? 0.2095 : chem.o2,
    // (A kind's own gases, its nitrogen making up the rest, and none it has not; where nothing
    // burns, nothing adds to its carbon dioxide, and a methane world's cold freezes it out of its
    // air: Phase 56.)
    own = chem.kind ? KIND_GASES[chem.kind] : [],
    frozen = chem.kind === "methane",
    gases: (readonly [string, number])[] = [
      ["nitrogen", nitrogen - own.reduce((s, [, v]) => s + v, 0)],
      ["oxygen", oxygen],
      ["argon", 0.0093],
      ["co2", frozen ? 0 : ppm / 1e6],
      ...own,
    ],
    parts = chem.kind ? gases.filter(([, v]) => v > 0) : gases,
    whole = parts.reduce((s, [, v]) => s + v, 0);
  return makeUpBlock(
    parts.map(([id, v]) => [id, v / whole] as [string, number]),
    null,
    "The air (by volume)",
    frozen
      ? "Carbon dioxide: none in its air: in its cold it lies frozen on the ground as frost."
      : chem.kind && !kindBurns(chem.kind)
        ? `Carbon dioxide: ${count(ppm)} parts in a million: nothing burns in its air to add to it.`
        : `Carbon dioxide: ${count(ppm)} parts in a million (280 before any fire of coal or oil).`,
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
  const chem = worldChemistry(homePlanet(world).generated),
    chief = cell !== null ? (groundIn(world).rock.get(cell)?.[0]?.[0] ?? "granite") : "granite",
    stone = worldRock(chem, chief).parts,
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
