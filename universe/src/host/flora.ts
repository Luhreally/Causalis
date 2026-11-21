// What grows on a land, read for its map and its towns' ground (bridge/biome.ts floraRead): from the tiles its region was
// refined with, its woods as they stand now (E1), whether its world's life took hold, and whether its people live in the
// sea. Read once for each land and each turn of its woods, and kept (a few lands at a time: the eye is on one).
import type { World } from "../kernel/index.ts";
import { floraRead, floraWindow, type FloraTiles, type FloraWindow } from "../bridge/index.ts";
import type { Region } from "../gen/index.ts";
import { homePlanet, populationContext } from "../sim/index.ts";
import { lookMeta } from "./biochem.ts";
import { tilesUnderWoods } from "./inspect/woods.ts";

/** The readings kept, by world, land and its woods' turn; the most kept before the oldest is let go. */
const KEPT = new Map<string, FloraTiles>(),
  KEPT_MOST = 6;

/** A land's reading (its woods read as they stand now unless given). */
export function landFlora(
  world: World,
  center: number,
  r: Region,
  woods?: { biome: Uint8Array; key: string; ratio: number; parched: boolean },
): FloraTiles {
  const w = woods ?? tilesUnderWoods(world, center, r.biome, r.water, r.precipitation, r.size),
    key = `${homePlanet(world).surfaceKey}:${center}:${w.key}`,
    kept = KEPT.get(key);
  if (kept) return kept;
  const ctx = populationContext(world),
    look = lookMeta(homePlanet(world).generated).lifeLook,
    read = floraRead(
      {
        size: r.size,
        tileKm: r.tileKm,
        elevation: r.elevation,
        warm: r.temperature,
        rain: r.precipitation,
        water: r.water,
        biome: w.biome,
        wild: r.biome,
        fertility: r.fertility,
      },
      {
        stands: w.ratio,
        parched: w.parched,
        lifeless: look === "bare",
        undersea: ctx.medium === "water",
      },
    );
  if (KEPT.size >= KEPT_MOST) KEPT.delete(KEPT.keys().next().value!);
  KEPT.set(key, read);
  return read;
}

/** How many tiles of its land's map about a town's own its ground's growth is read to (as its water is: sites.ts WET_HALF). */
export const FLORA_HALF = 6;

/** What grows about a town's tile, on its own ground's scale (`m`: metres a tile there). */
export function townFlora(
  world: World,
  center: number,
  r: Region,
  tile: number,
  m: number,
): FloraWindow {
  return floraWindow(
    landFlora(world, center, r),
    tile % r.size,
    Math.floor(tile / r.size),
    FLORA_HALF,
    m,
  );
}
