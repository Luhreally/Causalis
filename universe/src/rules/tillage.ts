// What a way of farming does (breadth round, 2026-11-23). Each of agriculture's ways lifts one thing that holds a field back, and
// gives as much as that thing held it back there: water led to fields where rain leaves its crops short, and to none where rain is
// ample; the seasons reckoned where they swing; slopes terraced where the ground is steep; the soil's goodness kept by resting and
// dunging where it is worked thin or washed out; heavy wet clay turned where it lies. The plough, the iron share and the mill do
// not make a field give more: they let a farmer work more of it, so they give where hands are short of the ground, and little
// where the ground is all worked already (population/systems.ts saturate). Every land reads its own; on the whole of an Earth's
// farmed lands each gives about what its flat bonus gave (TILL.earth: their mean needs on first light's farmed lands).

/** What a way lifts. */
export type Limit = "water" | "season" | "slope" | "nutrient" | "heavy" | "labour";

/** Each way of farming (rules/principles.ts, its old flat `farmYield`), what it lifts and the gain it gave at an Earth's mean need. */
export const TILLAGE: Readonly<Record<string, { readonly limit: Limit; readonly gain: number }>> = {
  irrigation: { limit: "water", gain: 0.2 },
  calendar: { limit: "season", gain: 0.05 },
  terracing: { limit: "slope", gain: 0.12 },
  rotation: { limit: "nutrient", gain: 0.15 },
  manuring: { limit: "nutrient", gain: 0.1 },
  "heavy-plough": { limit: "heavy", gain: 0.2 },
  plough: { limit: "labour", gain: 0.25 },
  mills: { limit: "labour", gain: 0.08 },
  iron: { limit: "labour", gain: 0.05 },
};
export const TILLAGE_IDS: readonly string[] = Object.keys(TILLAGE);

/** A land's needs, each 0 … 1: how far each thing holds its fields back. */
export type FieldNeeds = Readonly<Record<Exclude<Limit, "labour">, number>>;

export const TILL = {
  /**
   * The mean need of first light's farmed lands for each (2026-11-23, weighted by their farmland): a way gives its old gain where
   * the need is this. Terracing's is of its hill lands (where it is found), watering's between all its farmland's (0.13) and its
   * river lands' (where it is found, and where the river already waters a dry valley's fields: population/model.ts).
   */
  earth: { water: 0.25, season: 0.27, slope: 0.46, nutrient: 0.45, heavy: 0.43 } as FieldNeeds,
  /** The most a way gives against its old gain, where its need is greatest. */
  most: 2.5,
} as const;

/**
 * A land's needs from its facts: its rain against its demand (`moist`, rules/biomes.ts), half its year's swing of warmth, its
 * slopes (rise over run), its woods' share of its cover and its rock's goodness (1: Earth's).
 */
export function fieldNeeds(
  moist: number,
  swing: number,
  slope: number,
  woody: number,
  rock: number,
): FieldNeeds {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  return {
    // (Its crops want about its demand; short of that, by how short.)
    water: clamp(1 - moist / 1.1),
    // (A year that swings wants its sowing timed; the tropics' hardly.)
    season: clamp(swing / 12),
    // (Ground too steep to hold its soil under the plough.)
    slope: clamp((slope - 0.002) / 0.015),
    // (Worked ground loses its goodness; rain far past demand washes it out; a poor rock gave it little.)
    nutrient: clamp(0.35 + 0.3 * clamp(moist - 1) + 0.3 * clamp(1 - rock)),
    // (Wet clays under woods, too heavy for a scratch plough.)
    heavy: clamp(woody * clamp(moist - 0.7)),
  };
}

/** What the ways a land knows give its fields: their yield (1 + gains of the land's own needs) and their work (1 + labour's). */
export function tillageOf(
  knows: (id: string) => boolean,
  needs: FieldNeeds,
): { readonly yields: number; readonly work: number } {
  let yields = 1,
    work = 1;
  for (const id of TILLAGE_IDS) {
    if (!knows(id)) continue;
    const t = TILLAGE[id]!;
    if (t.limit === "labour") work += t.gain;
    else yields += t.gain * Math.min(TILL.most, needs[t.limit] / TILL.earth[t.limit]);
  }
  return { yields, work };
}
