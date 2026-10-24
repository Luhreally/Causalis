// The smallest scale (Phase 17 M131, the Observatory): a drop of a place's water under the
// glass — the small lives in it, each kind a line of the world's tree of life that lives on
// in the cells of today: small cells, light-eaters, hunting cells with a nucleus, cells
// together. What the drop is of (sea, fresh water, wet soil, ice), how much light and food
// reach it and how warm it is are the place's own. Pure reads of the generated world.
import { seedFromText } from "../../kernel/index.ts";
import { isProvinceWorld, treeOfLife, type HomeWorld } from "../../gen/index.ts";
import { homePlanet } from "../../sim/index.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, DropKind } from "../../bridge/index.ts";

type Rgb = readonly [number, number, number];
type Habitat = Extract<Block, { type: "drop" }>["habitat"];

/** The kinds of small life, by the step of the dawn each came of. */
const SMALL: readonly {
  readonly rung: "cells" | "light" | "nucleus" | "together";
  readonly name: string;
  readonly way: DropKind["way"];
  readonly color: Rgb;
  readonly size: number;
  readonly share: number;
}[] = [
  {
    rung: "cells",
    name: "small cells",
    way: "eater",
    color: [0.95, 0.77, 0.42],
    size: 2,
    share: 0.58,
  },
  {
    rung: "light",
    name: "light-eaters",
    way: "light",
    color: [0.38, 0.88, 0.42],
    size: 5,
    share: 0.32,
  },
  {
    rung: "nucleus",
    name: "hunting cells",
    way: "hunter",
    color: [0.8, 0.64, 1],
    size: 24,
    share: 0.05,
  },
  {
    rung: "together",
    name: "cells together",
    way: "colony",
    color: [0.46, 0.84, 0.6],
    size: 34,
    share: 0.05,
  },
];

/** What a drop is of, in words. */
const OF: Readonly<Record<Habitat, string>> = {
  sea: "a drop of the sea",
  fresh: "a drop of fresh water",
  soil: "a crumb of wet soil",
  ice: "a drop of meltwater from the ice",
};

/** The world as it was generated (on its fine grid). */
function fineOf(world: World): HomeWorld {
  const g = homePlanet(world).generated;
  return isProvinceWorld(g) ? g.fine : g;
}

/** A spot's drop: what it is of, and its light, warmth and food. */
function placeOf(
  g: HomeWorld,
  spot: number,
): { habitat: Habitat; light: number; warmth: number; food: number } {
  const warmth = g.climate.temperature[spot]!,
    rain = g.climate.precipitation[spot]!,
    sea = g.tectonics.elevation[spot]! <= 0,
    wet = g.water.river[spot] === 1 || g.water.lake[spot] === 1,
    shore = g.climate.inland[spot]! <= 1,
    habitat: Habitat =
      warmth < -6 ? "ice" : sea || (shore && !wet) ? "sea" : wet ? "fresh" : "soil",
    sun = 0.3 + 0.7 * Math.cos(g.grid.lat[spot]!);
  return {
    habitat,
    light: Math.min(1, habitat === "soil" ? sun * 0.25 : habitat === "ice" ? sun * 0.6 : sun),
    warmth,
    food:
      habitat === "soil"
        ? Math.min(1, Math.max(0.15, rain / 1600))
        : Math.min(1, Math.max(0.2, 0.35 + warmth / 40 + (wet ? 0.15 : 0))),
  };
}

/**
 * A drop from a spot of the world, under the glass: its small lives, each a living line of the
 * dawn. `focus` (a line's ref) is most of the drop; `habitat` sets what it is of.
 */
export function dropBlock(
  world: World,
  spot: number,
  options: { readonly title?: string; readonly focus?: string; readonly habitat?: Habitat } = {},
): Block | null {
  const g = fineOf(world);
  if (spot < 0 || spot >= g.grid.count) return null;
  const tree = treeOfLife(g),
    place = placeOf(g, spot),
    habitat = options.habitat ?? place.habitat,
    kinds: DropKind[] = [];
  for (const s of SMALL) {
    const rung = tree.rungs.find((r) => r.id === s.rung),
      node = rung?.node !== null && rung?.node !== undefined ? tree.nodes[rung.node] : undefined;
    if (!node) continue;
    // (Soil is dark: few light-eaters, no cells together; ice holds little of anything.)
    const share =
      s.share *
      (habitat === "soil" ? (s.way === "light" ? 0.3 : s.way === "colony" ? 0 : 1) : 1) *
      (habitat === "ice" && s.way !== "eater" ? 0.5 : 1) *
      (options.focus === node.ref ? 3 : 1);
    if (share <= 0) continue;
    kinds.push({
      ref: node.ref,
      name: s.name,
      line: node.name,
      way: s.way,
      color: s.color,
      size: s.size,
      share,
    });
  }
  if (!kinds.length) return null;
  const whole = kinds.reduce((a, k) => a + k.share, 0),
    seed = seedFromText(`drop ${g.digest} ${spot} ${habitat}`).lo >>> 0;
  return {
    type: "drop",
    title:
      options.title ?? `${OF[habitat][0]!.toUpperCase()}${OF[habitat].slice(1)}, under the glass`,
    habitat,
    seed,
    light: habitat === place.habitat ? place.light : 0.8,
    warmth: habitat === place.habitat ? place.warmth : Math.max(4, place.warmth),
    food: habitat === place.habitat ? place.food : 0.6,
    kinds: kinds.map((k) => ({ ...k, share: k.share / whole })),
    ...(options.focus ? { focus: options.focus } : {}),
    words:
      "Each cell lives by its kind's way — after what floats in the water, by the light, by taking in smaller cells — and divides when it has eaten enough, its daughters a little unlike it. The hunters take what is small and slow: watch what grows common. Tap a cell to follow it and its descendants.",
  };
}

/** The warmest shallow sea of the world, where a drop of the dawn's seas is drawn from. */
export function dawnSea(world: World): number {
  const g = fineOf(world),
    e = g.tectonics.elevation,
    t = g.climate.temperature;
  let best = -1,
    warm = -Infinity;
  for (let i = 0; i < g.grid.count; i++)
    if (e[i]! <= 0 && e[i]! > -400 && t[i]! > warm) [best, warm] = [i, t[i]!];
  if (best < 0) for (let i = 0; i < g.grid.count && best < 0; i++) if (e[i]! <= 0) best = i;
  return Math.max(0, best);
}

/** The refs of the tree's lines that live on in a drop (the small lives' own pages show one). */
export function smallLines(world: World): ReadonlySet<string> {
  const tree = treeOfLife(fineOf(world)),
    out = new Set<string>();
  for (const s of SMALL) {
    const node = tree.rungs.find((r) => r.id === s.rung)?.node;
    if (node !== null && node !== undefined) out.add(tree.nodes[node]!.ref);
  }
  return out;
}
