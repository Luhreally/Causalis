// How life began on a world, for its pages and its drops (B2 of the life plan): a home world's origin read with its
// tree of life's own dawn (whose step "the air fills with oxygen" the same reading dates), and a world elsewhere's
// from what is known of it. The small lives a drop shows, by what each runs on; the mineral grain the rock-eaters
// live on. Pure readings, kept by the world's digest (gen/origin.ts): asking moves nothing.
import {
  elsewhereOrigin,
  homeOrigin,
  isProvinceWorld,
  treeOfLife,
  type Elsewhere,
  type HomeWorld,
  type LifeGround,
  type LifeStar,
  type WorldOrigin,
} from "../gen/index.ts";
import { TRADES, type SmallLife, type TradeId } from "../rules/index.ts";
import type { Block, DropKind } from "../bridge/index.ts";

type Rgb = readonly [number, number, number];
type DropBlock = Extract<Block, { type: "drop" }>;

/** A world as generated, on its fine grid (whose tree it is). */
export function fineWorld(g: HomeWorld): HomeWorld {
  return isProvinceWorld(g) ? g.fine : g;
}

/** A home world's origin, its air dated as its tree's own step is. */
export function originOfHome(world: HomeWorld): WorldOrigin {
  const g = fineWorld(world),
    tree = treeOfLife(g),
    at = (id: string) => tree.rungs.find((r) => r.id === id)?.at,
    cells = at("cells"),
    light = at("light"),
    together = at("together"),
    air = at("air");
  return homeOrigin(
    g,
    cells !== undefined && light !== undefined && together !== undefined
      ? { cells, light, floor: together, ...(air !== undefined ? { air } : {}) }
      : null,
  );
}

/** A world elsewhere's origin (`key`: its own ref). */
export function originElsewhere(
  key: string,
  star: LifeStar & { readonly temperature: number; readonly mass: number },
  w: LifeGround,
  life: Elsewhere,
): WorldOrigin {
  return elsewhereOrigin(key, star, w, life);
}

/** The usual look of each way, which a kind leaves unsaid. */
const USUAL_LOOK: Readonly<Record<DropKind["way"], SmallLife["look"]>> = {
  eater: "rod",
  light: "ball",
  hunter: "blob",
  colony: "ball",
  rock: "crust",
};

/** A small life as the drop's kind: its pace and look said only where they are not its way's usual. */
export function dropKindOf(s: SmallLife, ref: string, line: string, share: number): DropKind {
  return {
    ref,
    name: s.name,
    line,
    way: s.way,
    color: s.color,
    size: s.size,
    share,
    ...(s.pace !== 1 ? { pace: s.pace } : {}),
    ...(s.look !== USUAL_LOOK[s.way] ? { look: s.look } : {}),
    runs: TRADES[s.trade].name,
  };
}

/** The grain a rock-eater lives on, by what it eats there. */
const GRAIN: Partial<Record<TradeId, { readonly color: Rgb; readonly name: string }>> = {
  "h2-co2": {
    color: [0.74, 0.72, 0.64],
    name: "a crumb of a vent's chimney, pale carbonate laced with iron sulfide",
  },
  "h2-sulfur": { color: [0.78, 0.68, 0.3], name: "a grain of sulfur and pyrite from below" },
  "h2-iron": { color: [0.56, 0.3, 0.2], name: "a grain of rust" },
  "ammonia-iron": { color: [0.5, 0.46, 0.52], name: "a grain of iron-bearing rock" },
};

/** The grain on a drop's floor where its kinds hold rock-eaters (none in soil, which is all grains). */
export function grainOf(
  kinds: readonly { way: string; trade?: TradeId }[],
  habitat: DropBlock["habitat"],
  trade: TradeId | null,
): DropBlock["grain"] | undefined {
  if (habitat === "soil" || !trade || !kinds.some((k) => k.way === "rock")) return undefined;
  const g = GRAIN[trade] ?? { color: [0.5, 0.45, 0.4] as Rgb, name: "a grain of rock" };
  return { x: 90, y: 106, r: 14, color: g.color, name: g.name };
}

/** A drop's words: how its small lives live, by what they run on. */
export function dropWords(
  small: readonly SmallLife[],
  grain: DropBlock["grain"] | undefined,
): string {
  const named = (way: SmallLife["way"]) => small.find((s) => s.way === way);
  const parts: string[] = [];
  const rock = named("rock"),
    eater = named("eater"),
    light = named("light"),
    hunter = named("hunter");
  if (rock && grain)
    parts.push(
      `The ${rock.name} cluster on ${grain.name}, living by ${TRADES[rock.trade].name} (${TRADES[rock.trade].reaction})`,
    );
  if (eater) parts.push(`the ${eater.name} live by ${TRADES[eater.trade].name}`);
  if (light) parts.push(`the ${light.name} by ${TRADES[light.trade].name}`);
  if (hunter) parts.push(`the ${hunter.name} take smaller cells in`);
  const lead = parts.length
    ? `${parts[0]![0]!.toUpperCase()}${parts[0]!.slice(1)}${parts.length > 1 ? `; ${parts.slice(1).join("; ")}` : ""}.`
    : "";
  return `${lead} Each divides when it has eaten enough, its daughters a little unlike it; a kind that runs on little power lives slowly. Tap a cell to follow it and its descendants.`.trim();
}
