// The ground a battle is fought on, and how a host is fed to it (round E, order). Not two steps (hills over 600 m, a river): the
// defender's ground is as broken as its fine ground's heights spread (sim/war/occupation.ts reliefOf), as wide as the river that
// runs through it carries water, and as wooded as its woods stand (sim/ecology/woods.ts): each hides those who hold it and
// slows those who come. A host's bread is carried to it from its seat at what carrying costs a hundred kilometres over land
// (sim/economy HAUL_PER_100KM), the more over broken ground; what is not lost on the way, and what it can take from the land it
// stands on, is how fed it fights. Pure readings of the world as made and as it stands.
import { dmath } from "../../kernel/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { capacity } from "../population/model.ts";
import { support } from "../population/systems.ts";
import { HAUL_PER_100KM } from "../economy/systems.ts";
import { woodsOf } from "../ecology/woods.ts";
import { reliefOf } from "./occupation.ts";

export const GROUND = {
  /** What the most broken ground (relief at its full, m) adds to those who hold it, and the relief at which it is full. */
  broken: 0.5,
  relief: 800,
  /** What a river adds, as its water passes the most a river carries on its world (its log, a tenth for each tenfold). */
  river: 0.1,
  /** What a land wooded through adds. */
  woods: 0.25,
  /** The share of what a land brings in a host on it can take. */
  forage: 0.25,
  /** The least a starved host fights at, of its strength fed. */
  starved: 0.4,
} as const;

/** How much the ground of a land favours those who hold it (1: open ground, dry, bare), and what makes it so. */
export function groundOf(
  ctx: PopulationContext,
  land: number,
): {
  readonly factor: number;
  readonly relief: number;
  readonly river: number;
  readonly woods: number;
} {
  const g = ctx.generated,
    relief = reliefOf(g)[land] ?? 0,
    broken = GROUND.broken * Math.min(1, relief / GROUND.relief),
    discharge = g.water.discharge[land] ?? 0,
    river = g.water.river[land]
      ? GROUND.river * (1 + Math.max(0, dmath.log10(Math.max(1, discharge / riverLeast(ctx)))))
      : 0,
    wood = woodsOf(ctx.world),
    woods = wood?.begun ? GROUND.woods * Math.min(1, (wood.reach[land] ?? 0) / 10000) : 0;
  return { factor: 1 + broken + river + woods, relief, river, woods };
}

const LEAST = new Map<string, number>();
/** The least water a land's river carries on this world (its rivers' threshold). */
function riverLeast(ctx: PopulationContext): number {
  const g = ctx.generated,
    key = `${g.digest} ${g.grid.count}`;
  let least = LEAST.get(key);
  if (least === undefined) {
    least = Infinity;
    for (let c = 0; c < g.grid.count; c++)
      if (g.water.river[c]) least = Math.min(least, g.water.discharge[c]!);
    if (!Number.isFinite(least) || least <= 0) least = 1;
    if (LEAST.size >= 16) LEAST.clear();
    LEAST.set(key, least);
  }
  return least;
}

/**
 * How fed a host fights on a land (GROUND.starved … 1): its bread carried from its seat `far` steps away (each step a fiftieth
 * of its world's radius and some), losing at each what carrying costs over that much ground (the more over broken ground);
 * and what it takes from the land it stands on, a share of what the land brings in, for its `men`.
 */
export function supplyOf(ctx: PopulationContext, land: number, far: number, men: number): number {
  const g = ctx.generated,
    stepKm = 0.0175 * 6371 * g.planet.radius,
    relief = reliefOf(g)[land] ?? 0,
    lost = (HAUL_PER_100KM * stepKm * (1 + relief / 1000)) / 100,
    carried = Math.max(0, 1 - lost * far),
    taken = (GROUND.forage * support(capacity(g, land), true)) / Math.max(1, men),
    fed = Math.min(1, carried + taken);
  return GROUND.starved + (1 - GROUND.starved) * fed;
}
