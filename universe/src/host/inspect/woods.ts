// What a land's woods and lodes have come to, on its page and its town's (E1): what they were, what they came to, what did
// it; which lode gave out, when, and where its people turned. And its woods as drawn: the tiles of a land's map, turned
// to open ground from the edge in or grown out from where they stand, as its share of them now says.
import { BIOME, cellRef, offworldSite, worldChemistry } from "../../gen/index.ts";
import {
  GROVE,
  LODE,
  LODE_DEPTH_WORDS,
  groveWhyWords,
  lodeSize,
  roleWord,
} from "../../rules/index.ts";
import {
  homePlanet,
  lodesOf,
  oresIn,
  populationContext,
  woodsOf,
  woodsRead,
  woodsWords,
  type Lode,
  type WoodsTurn,
} from "../../sim/index.ts";
import { YEAR, type World } from "../../kernel/index.ts";
import type { Block, Item, Line, Stat, WoodsMap } from "../../bridge/index.ts";
import { landLink } from "./names.ts";
import { item, stat } from "./words.ts";

/** The share of a land in parts in a hundred, in words. */
const parts = (n: number): string => `${n} parts in a hundred`;
/** The same, of the land itself, or of a people of the water's own waters. */
const ofLand = (n: number, woods: string): string => {
  const of = woods === "weed beds" ? "its waters" : "the land";
  return n >= 100 ? `all of ${of}` : n <= 0 ? `none of ${of}` : `${n} parts in a hundred of ${of}`;
};
/** How much of what a depth holds is left, in words. */
const leftOf = (n: number): string => (n >= 100 ? "all" : n <= 0 ? "next to nothing" : parts(n));

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Each land's woods now and at first, in hundredths: every land that has or had any. */
export function woodsMap(world: World): WoodsMap {
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    lands: [number, number, number][] = [];
  let sum = 0;
  for (let c = 0; c < g.offworld.base; c++) {
    const w = woodsRead(ctx, c),
      now = Math.round(w.now * 100),
      first = Math.round(w.first * 100);
    if (now > 0 || first > 0) {
      lands.push([c, now, first]);
      sum = (sum * 31 + now * 7 + c) % 1000000007;
    }
  }
  return { key: `${sum}`, lands, ...(ctx.medium === "water" ? { undersea: true } : {}) };
}

/** A turn of a land's woods, as a line. */
function turnLine(world: World, t: WoodsTurn, woods: string): Item {
  // ("from 82 parts in a hundred of the land to 62": said once.)
  const them = woods === "weed beds" ? "them" : "it",
    towards =
      t.to >= 100
        ? `all of ${them}`
        : t.to <= 0
          ? `none of ${them}`
          : t.from >= 100 || t.from <= 0
            ? `${t.to} parts in a hundred of ${them}`
            : `${t.to}`;
  const line = `In year ${t.year} they ${t.to > t.from ? "came" : "went back"}, from ${ofLand(t.from, woods)} to ${towards}: ${groveWhyWords(t.why, `the ${woods}`)}.`;
  return item(line, t.ref, t.year);
}

/** What a land's woods were, what they came to, and what did it. */
export function woodsBlock(world: World, cell: number): Block | null {
  const ctx = populationContext(world),
    g = homePlanet(world).generated;
  if (cell >= g.offworld.base || offworldSite(g, cell)) return null;
  const w = woodsRead(ctx, cell),
    { woods } = woodsWords(ctx),
    turns = woodsOf(world)?.turns.get(cell) ?? [],
    now = Math.round(w.now * 100),
    first = Math.round(w.first * 100);
  if (!now && !first && !turns.length) return null;
  const rows: Stat[] = [
    stat("Now", cap(ofLand(now, woods))),
    stat("At first", cap(ofLand(first, woods))),
  ];
  if (!turns.length)
    rows.push(
      stat(
        "Since",
        Math.abs(now - first) < 5
          ? `The ${woods} stand about where they always stood.`
          : `The ${woods} have moved a little, and no one has marked it.`,
      ),
    );
  return { type: "facts", title: `Its ${woods}`, rows };
}

/** The turns of a land's woods, latest first. */
export function woodsTurnsBlock(world: World, cell: number): Block | null {
  const ctx = populationContext(world),
    turns = woodsOf(world)?.turns.get(cell) ?? [];
  if (!turns.length) return null;
  const { woods } = woodsWords(ctx);
  return {
    type: "list",
    title: `What became of its ${woods}`,
    items: [...turns].reverse().map((t) => turnLine(world, t, woods)),
  };
}

/** A lode as it stands, in a sentence a person can read aloud. */
function lodeLine(world: World, lode: Lode, title: string): Line {
  const ctx = populationContext(world),
    chem = worldChemistry(ctx.generated),
    metal = roleWord(chem, lode.kind);
  if (lode.out !== null) {
    const e = lode.ref ? world.events.get(lode.ref) : undefined,
      d = (e?.data ?? {}) as { how?: string; from?: number | null },
      then =
        d.how === "neighbour" && d.from !== null && d.from !== undefined
          ? [" They haul it now from ", landLink(world, d.from), "."]
          : d.how === "far" && d.from !== null && d.from !== undefined
            ? [" They go now as far as ", landLink(world, d.from), " for it, at a long haul."]
            : d.how === "road" && d.from !== null && d.from !== undefined
              ? [" It comes now down the road from ", landLink(world, d.from), "."]
              : d.how === "store"
                ? [" They have what is in store, and no more."]
                : [" There is none to be had."];
    return [
      `The ${metal} of ${title} gave out in year ${lode.out}, dug ${LODE_DEPTH_WORDS[lode.tier] ?? ""}.`,
      ...then,
    ];
  }
  const lies = oresIn(ctx, lode.cell, lode.kind),
    size = lodeSize(lode.kind, Math.max(0, ...lies.map((o) => o.richness))),
    limit = size * (LODE.depths[lode.tier] ?? Infinity),
    past = lode.tier ? size * LODE.depths[lode.tier - 1]! : 0,
    left = Number.isFinite(limit) ? Math.max(0, 1 - (lode.dug - past) / (limit - past)) : 1;
  if (lode.tier >= 3)
    return [
      lode.kind === "oil"
        ? `The ${metal} of ${title} is long drawn: machines bring up what little it still gives.`
        : `The ${metal} of ${title} is long dug: machines sort its old heaps for what little they still give.`,
    ];
  return [
    lode.first !== null
      ? `The ${metal} of ${title} first gave out in year ${lode.first}, and better means dug on below it: ${leftOf(Math.round(left * 100))} of what they reach is left.`
      : lode.tier
        ? `The ${metal} of ${title} is ${lode.kind === "oil" ? "bored deeper now, for what is left" : `dug deeper now, for ${lode.kind === "coal" ? "a thinner seam" : "leaner ore"}`}: ${leftOf(Math.round(left * 100))} of what its means reach is left.`
        : `The ${metal} of ${title} is worked: ${leftOf(Math.round(left * 100))} of what ${lode.kind === "oil" ? "its wells" : "picks"} can reach is left.`,
  ];
}

/** Each lode of a land that anyone has dug: a list on its page, or nothing. */
export function lodesBlock(world: World, cell: number, title: string): Block | null {
  const store = lodesOf(world);
  if (!store || store.dormant()) return null;
  const mine = store.all().filter((l) => l.cell === cell);
  if (!mine.length) return null;
  return {
    type: "list",
    title: "What has been dug here",
    items: mine.map((l) => item(lodeLine(world, l, title), l.ref ?? cellRef(0, cell))),
  };
}

/** The lodes given out at a town's own land, for its page: a stat for each. */
export function lodesTownStats(world: World, cell: number, title: string): Stat[] {
  const store = lodesOf(world);
  if (!store || store.dormant()) return [];
  return store
    .all()
    .filter((l) => l.cell === cell && (l.out !== null || l.first !== null))
    .map((l) => stat("Its mine", lodeLine(world, l, title), { why: l.ref }));
}

/** What a land's woods are, for a tooltip on the map. */
export function woodsReading(world: World, cell: number) {
  const ctx = populationContext(world),
    w = woodsRead(ctx, cell),
    { woods } = woodsWords(ctx),
    now = Math.round(w.now * 100),
    first = Math.round(w.first * 100);
  return {
    line:
      Math.abs(now - first) < 5
        ? `${cap(woods)} on ${ofLand(now, woods)}, about as they always were.`
        : `${cap(woods)} on ${ofLand(now, woods)}; on ${ofLand(first, woods)} at first.`,
    stats: [
      { label: "Reach", value: parts(Math.round(w.reach * 100)) },
      { label: "Left standing of that", value: parts(Math.round(w.stood * 100)) },
    ],
  };
}

const FORESTS: ReadonlySet<number> = new Set([
  BIOME.borealForest,
  BIOME.temperateForest,
  BIOME.temperateRainforest,
  BIOME.tropicalDryForest,
  BIOME.tropicalRainforest,
]);

/** What a wood's ground is where it has gone, and a ground's wood where it has come: what the land's own climate has. */
const OPENED: Readonly<Record<number, number>> = {
  [BIOME.borealForest]: BIOME.tundra,
  [BIOME.temperateForest]: BIOME.steppe,
  [BIOME.temperateRainforest]: BIOME.steppe,
  [BIOME.tropicalDryForest]: BIOME.savanna,
  [BIOME.tropicalRainforest]: BIOME.savanna,
};
const WOODED: Readonly<Record<number, number>> = {
  [BIOME.tundra]: BIOME.borealForest,
  [BIOME.steppe]: BIOME.temperateForest,
  [BIOME.savanna]: BIOME.tropicalDryForest,
};

/**
 * A land's map with its woods as they stand now: tiles of woods gone to open ground from the edge in, or open ground grown
 * over from where woods stand (the thickest first to go last), nearest first. The same land and share, the same tiles.
 */
export function tilesUnderWoods(
  world: World,
  center: number,
  biome: ArrayLike<number>,
  water: ArrayLike<number>,
  rain: ArrayLike<number>,
  size: number,
): { biome: Uint8Array; key: string; ratio: number; parched: boolean } {
  const out = Uint8Array.from(biome as ArrayLike<number>),
    ctx = populationContext(world),
    w = woodsRead(ctx, center),
    // (Browned for a few years after a run of dry ones has taken them back.)
    turns = woodsOf(world)?.turns.get(center) ?? [],
    last = turns[turns.length - 1],
    parched =
      !!last &&
      (last.why === "dry" || last.why === "age") &&
      world.now / YEAR - last.year < GROVE.brown,
    key = `${Math.round(w.now * 20)}${parched ? "p" : ""}`,
    n = out.length;
  if (ctx.medium === "water" || Math.abs(w.now - w.first) < 0.03)
    return { biome: out, key, ratio: 1, parched };
  let land = 0,
    woods = 0;
  for (let t = 0; t < n; t++) {
    if (water[t]) continue;
    land++;
    if (FORESTS.has(out[t]!)) woods++;
  }
  const want = Math.round(w.now * land);
  if (want === woods || !land) return { biome: out, key, ratio: 1, parched };
  // How far each tile is from the other kind of ground, by steps (a breadth-first pass).
  const shrinking = want < woods,
    dist = new Int32Array(n).fill(-1),
    queue: number[] = [];
  for (let t = 0; t < n; t++) {
    if (water[t]) continue;
    if (FORESTS.has(out[t]!) !== shrinking) {
      dist[t] = 0;
      queue.push(t);
    }
  }
  // (Woods come to a land with none at all: they begin where it is wettest.)
  if (!queue.length) {
    let best = -1,
      most = -1;
    for (let t = 0; t < n; t++)
      if (!water[t] && WOODED[out[t]!] !== undefined && rain[t]! > most) {
        most = rain[t]!;
        best = t;
      }
    if (best < 0) return { biome: out, key, ratio: 1, parched };
    dist[best] = 0;
    queue.push(best);
  }
  for (let i = 0; i < queue.length; i++) {
    const t = queue[i]!,
      x = t % size,
      y = Math.floor(t / size);
    for (const m of [
      x > 0 ? t - 1 : -1,
      x < size - 1 ? t + 1 : -1,
      y > 0 ? t - size : -1,
      y < size - 1 ? t + size : -1,
    ]) {
      if (m < 0 || water[m] || dist[m]! >= 0) continue;
      dist[m] = dist[t]! + 1;
      queue.push(m);
    }
  }
  const order = queue
    .filter((t) =>
      shrinking ? FORESTS.has(out[t]!) : !FORESTS.has(out[t]!) && WOODED[out[t]!] !== undefined,
    )
    .sort(
      (a, b) =>
        dist[a]! - dist[b]! ||
        (Math.imul(a + 1, 2654435761) >>> 0) - (Math.imul(b + 1, 2654435761) >>> 0),
    );
  const turn = Math.abs(want - woods);
  for (let i = 0; i < order.length && i < turn; i++) {
    const t = order[i]!;
    out[t] = shrinking ? (OPENED[out[t]!] ?? out[t]!) : (WOODED[out[t]!] ?? out[t]!);
  }
  // (How much of what stood stands: the fewer trees are drawn, not the same number thicker.)
  return { biome: out, key, ratio: woods > 0 ? Math.min(1, want / woods) : 1, parched };
}
