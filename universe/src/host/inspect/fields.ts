// A land's ground as stocks, on its page (Round A; sim/ecology/ground.ts): what feeds its fields and which runs short first;
// its topsoil; the water its fields are given and its groundwater; the salt, sour rain and metals that foul it. Every number is
// its ground's as kept, read, never reckoned anew.
import { ACID_FIFTH, METAL_FIFTH, NUTRIENTS, SALT_HALF, type Nutrient } from "../../rules/index.ts";
import { groundReading } from "../../sim/index.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import { stat } from "./words.ts";

const NAMES: Readonly<Record<Nutrient, string>> = {
  N: "Nitrogen",
  P: "Phosphorus",
  K: "Potassium",
};
const pc = (x: number) => `${Math.round(x * 100)}%`;

/** A land's fields' ground: its nutrients, topsoil, water and what fouls it (none where it keeps no ground). */
export function fieldsBlocks(world: World, cell: number): Block[] {
  const r = groundReading(world, cell);
  if (!r) return [];
  const feeds: Stat[] = NUTRIENTS.map((n) =>
    stat(
      NAMES[n],
      `${pc(r.nut[n])} of what its ground held before anyone farmed it${n === r.least ? " — what its fields lack first" : ""}`,
    ),
  );
  feeds.push(stat("Topsoil", `${pc(r.top)} of what it had`));
  if (r.fixedT > 0)
    feeds.push(
      stat("Fixed from the air", `${r.fixedT.toLocaleString("en-US")} tonnes of nitrogen a year`),
    );
  const blocks: Block[] = [{ type: "facts", title: "What feeds its fields", rows: feeds }];
  const water: Stat[] = [stat("Its groundwater", `${pc(r.water)} of what it held`)];
  if (r.short > 0) water.push(stat("Its watered fields went without", pc(r.short)));
  if (r.saltTKm2 > 0)
    water.push(
      stat(
        "Salt on its watered fields",
        `${Math.round(r.saltTKm2).toLocaleString("en-US")} t/km² (half their yield at ${SALT_HALF.toLocaleString("en-US")})`,
      ),
    );
  blocks.push({ type: "facts", title: "Its water", rows: water });
  const foul: Stat[] = [];
  if (r.acidKgHa > 0)
    foul.push(
      stat(
        "Sour rain held",
        `${Math.round(r.acidKgHa)} kg of sulphur a hectare (a fifth of its yield at ${ACID_FIFTH})`,
      ),
    );
  if (r.metalKgHa > 0.5)
    foul.push(
      stat(
        "Metals in its ground and water",
        `${Math.round(r.metalKgHa)} kg a hectare (a fifth of its yield at ${METAL_FIFTH})`,
      ),
    );
  if (r.fouled > 0.005) foul.push(stat("Fouled", `${pc(r.fouled)} of its yield taken`));
  if (r.poison > 0.005)
    foul.push(stat("Its people's health", `${pc(r.poison)} worse for the metals in their water`));
  if (foul.length) blocks.push({ type: "facts", title: "What fouls it", rows: foul });
  return blocks;
}

/** A land under the fouled-ground lens, for the tooltip under the pointer. */
export function fouledReading(
  world: World,
  cell: number,
): { line: string; stats: { label: string; value: string }[] } | null {
  const r = groundReading(world, cell);
  if (!r) return null;
  return {
    line: `Its ground: ${r.fouled < 0.01 ? "clean" : `${pc(r.fouled)} of its yield taken`}`,
    stats: [
      { label: "Sour rain held", value: `${Math.round(r.acidKgHa)} kg S/ha` },
      { label: "Metals", value: `${Math.round(r.metalKgHa)} kg/ha` },
      { label: "Salt", value: `${Math.round(r.saltTKm2)} t/km²` },
      { label: "Lacks first", value: NAMES[r.least].toLowerCase() },
    ],
  };
}
