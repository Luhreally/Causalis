// Heraldry (Phase 11 M102): each realm's arms, as the host makes them — its colour, its own
// parting and metal (from its ref), and what may name its charge: what its seat's land holds
// (the sea it looks on, its heights, its woods, its sands, its ice) and what its faith holds.
// Pure reads of the world.
import { isProvinceWorld } from "../gen/index.ts";
import { beliefOf, homePlanet, politiesOf, type Tenet } from "../sim/index.ts";
import type { Ref, World } from "../kernel/index.ts";
import { armsFor, type Arms, type Charge } from "../bridge/index.ts";
import { realmColor } from "./colors.ts";

/** The biomes (by their index, as gen/climate names them) and what a seat among them bears. */
const BIOME_CHARGE: Readonly<Record<number, Charge>> = {
  4: "star", // ice
  5: "star", // tundra
  6: "tree", // boreal forest
  7: "sun", // cold desert
  9: "tree", // temperate forest
  10: "tree", // temperate rainforest
  11: "sun", // hot desert
  13: "tree", // tropical dry forest
  14: "tree", // tropical rainforest
  15: "mountain", // alpine
};
/** A seat this high bears its mountain (m). */
const HEIGHTS = 1500;
/** What each faith's tenet bears. */
const TENET_CHARGE: Readonly<Record<Tenet, Charge>> = {
  rain: "drop",
  plenty: "sheaf",
  sickness: "moon",
  healing: "cross",
  teaching: "star",
  presence: "sun",
  hunger: "ring",
  fire: "flame",
};

/** What a realm's seat's land gives it to bear, if anything. */
function chargeOf(world: World, seat: number): Charge | undefined {
  const g = homePlanet(world).generated;
  if (!isProvinceWorld(g) || seat < 0 || seat >= g.grid.count) return undefined;
  // (By the sea: waves; high: its mountain; else what grows or lies about it.)
  if ((g.climate.inland[seat] ?? 99) <= 1) return "waves";
  if ((g.tectonics.elevation[seat] ?? 0) >= HEIGHTS) return "mountain";
  return BIOME_CHARGE[g.climate.biome[seat] ?? -1];
}

/** What a realm's faith gives it to bear: the faith held at its seat. */
function faithCharge(world: World, seat: number): Charge | undefined {
  const faith = beliefOf(world).of(seat).faith,
    f = faith ? beliefOf(world).get(faith) : undefined;
  return f ? TENET_CHARGE[f.tenet] : undefined;
}

/** A realm's arms (a fallen one's too, by its ref); null for what is not a realm. */
export function realmArms(world: World, ref: string): Arms | null {
  if (!ref.startsWith("pol:")) return null;
  const r = politiesOf(world).get(ref as Ref);
  return armsFor(
    ref,
    realmColor(ref),
    r ? { land: chargeOf(world, r.seat), faith: faithCharge(world, r.seat) } : {},
  );
}
