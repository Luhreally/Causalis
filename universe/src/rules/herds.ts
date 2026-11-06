// Wild lives (Z1, Classic 52, 42d, 21 and 23). A land's creatures as one number the world keeps: how many of them its ground holds now, against the most
// it could. They go where the green is, walk in from the land beside, and give way to fields, towns and a people's flocks. Where they are in a year is a
// reading of the warmth and the green from those numbers, and never moves them: looking moves nothing. No kind of world is named here: what a creature does is
// read off its body and what its world's ground gives. Read a world's worst before changing a rate: tools/z1-tally.ts.
import { dmath } from "../kernel/index.ts";
import type { CreatureBody, Feature } from "./creatures.ts";

export const HERD = {
  /** A land is looked at once in so many years, each in its own turn. */
  every: 5,
  /** A look's share of the way toward what a land holds: coming, from its own and the land beside's, and going. */
  fill: 0.3,
  seed: 0.14,
  leave: 0.4,
  /** How many a land has to have before anything of it can be seen, and a land with fewer than this is told as emptied, and told again once back over this. */
  least: 3,
  gone: 6,
  back: 20,
  /** A land that never held more than this has nothing to tell of. */
  had: 30,
  /** People a km² at which a land holds half what it would. */
  dense: 240,
  /** A people's flocks at so many times what its pasture carries, and what is left then for the wild. */
  overgrazed: 1.6,
  grazedLeaves: 0.6,
  /** The share of the year at its coldest; how far apart a land's warmest and coolest ground must be for them to go by it, and how little a year must swing for them to stay. */
  coldest: 0.02,
  still: 0.5,
  byRain: 3,
  /** How many lands a herd goes at the most, each way, and how wide a share of its year's way it is seen on a land's map. */
  steps: 4,
  width: 0.2,
  /** How far apart a land's herds can be seen from a town's fields, on the near ground (m). */
  nearSpan: 620,
} as const;

/** What a war takes: how likely in a year of war over a land that keeps herds; a raid's least share and how much more it can be; how long before another, how long a land takes to breed back. */
export const HERD_RAID = {
  chance: 0.07,
  least: 0.2,
  more: 0.4,
  gap: 6,
  heal: 12,
  /** What a people of the water loses of its pens' yield for all its herds' loss. */
  pens: 0.35,
} as const;

/** Beasts people know: how often one is looked for (a year's chance, on a world with people), and how long apart at the least. */
export const BEAST_KNOWN = {
  perYear: 0.012,
  gap: 45,
  /** Of a land's hunters, how many there must be for one to stand out. */
  least: 0.12,
  /** What it takes of its land's flocks while it lives. */
  loss: 0.06,
  /** A year's chance of its taking someone who goes out against it; how long before they go after it. */
  kills: 0.22,
  after: 2,
  /** A year's chance of its end, from when they go after it, and for each year it goes on; when it can die old. */
  ends: 0.14,
  endsMore: 0.05,
  oldFrom: 14,
} as const;

/** What the tree of life does in history: looked at once in so many years; how likely a new kind, a tame one; how long apart; how many at the most; how narrow a kind can die out by this rule. */
export const LINEAGE = {
  every: 25,
  newChance: 0.12,
  newGap: 150,
  newMost: 24,
  /** How long a world's people must have been on it before anything new is told: a kind doesn't change in a lifetime. */
  since: 300,
  /** A cut-off land is a body of at most so many lands. */
  cutOff: 8,
  /** Where a world has no such body: a land with this many green neighbours or fewer is cut off. */
  hemmed: 2,
  tameChance: 0.08,
  tameGap: 200,
  tameMost: 12,
  tameFrom: 0.5,
  /** A kind of at most so many lands can die out. */
  narrow: 16,
  /** A kind is out of a land with fewer than this of its beasts left. */
  gone: 3,
} as const;

export type HerdWhy = "green" | "woods" | "dry" | "fields" | "towns" | "flocks";

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** How much of what a land's ground gives a kind of beast takes: a grazer the open ground, a browser the woods' edge, a swimmer the beds. */
export function groundFit(niche: string, woods: number): number {
  switch (niche) {
    case "grazer":
      return clamp(1 - 0.7 * woods, 0.1, 1);
    case "browser":
      return clamp(0.35 + 1.2 * woods, 0.1, 1);
    case "swimmer":
      return clamp(0.6 + 0.4 * woods, 0.1, 1);
    default:
      return clamp(1 - 0.4 * woods, 0.1, 1);
  }
}

/**
 * How many a land holds now (hundredths of the most any land could), and what holds it down most: its green, woods or open ground, its rain against
 * its usual, its game as its people leave it, how close its people live, how hard its people's flocks press its pasture.
 */
export function herdHolds(o: {
  readonly green: number;
  readonly niche: string;
  readonly woods: number;
  readonly rain: number;
  readonly wild: number;
  readonly density: number;
  readonly flocks: number;
}): { holds: number; why: HerdWhy } {
  const fit = groundFit(o.niche, o.woods),
    rain = clamp(o.rain, 0.5, 1.1),
    fields = Math.sqrt(clamp(o.wild, 0, 1)),
    towns = 1 / (1 + o.density / HERD.dense),
    flocks = o.flocks >= HERD.overgrazed ? HERD.grazedLeaves : 1,
    holds = 100 * o.green * fit * rain * fields * towns * flocks,
    factors: [HerdWhy, number][] = [
      ["green", o.green],
      ["woods", fit],
      ["dry", rain / 1.1],
      ["fields", fields],
      ["towns", towns],
      ["flocks", flocks],
    ];
  let why: HerdWhy = "green",
    least = Infinity;
  for (const [w, v] of factors)
    if (v < least) {
      least = v;
      why = w;
    }
  return { holds, why };
}

/** A land's number, a look on: toward what it holds, walking in only from what is there and beside it. */
export function herdStep(now: number, holds: number, beside: number): number {
  if (holds < now) return now + HERD.leave * (holds - now);
  const from = now * HERD.fill + beside * HERD.seed;
  return Math.min(holds, now + from);
}

/** A share of the year as how far along its way a herd has gone: 0 at its warmest ground, in the coldest of the year, 1 at its coolest at the height of the warm. */
export function yearWay(share: number, cold: number = HERD.coldest): number {
  return 0.5 - 0.5 * dmath.cos(2 * Math.PI * (share - cold));
}

/** Where on a land's map a herd is, at a share of the year: -1 at its warm side, 1 at its cool; null when it is not on this land. Standing still (a world with no seasons): 0. */
export function passAt(
  pass: { readonly rank: number; readonly width: number; readonly still?: boolean },
  share: number,
): number | null {
  if (pass.still) return 0;
  const k = (yearWay(share) - pass.rank) / pass.width;
  return k <= -1 || k >= 1 ? null : k;
}

/** The first and last share of the year it is on a land, for each time it comes (one or two a year), by sampling. */
export function passWindows(pass: {
  readonly rank: number;
  readonly width: number;
  readonly still?: boolean;
}): (readonly [number, number])[] {
  if (pass.still) return [[0, 1]];
  const out: [number, number][] = [],
    N = 96;
  let from = -1;
  const on = (i: number) => passAt(pass, (((i % N) + N) % N) / N) !== null;
  if (on(0) && on(N - 1)) {
    // (Wrapped over the year's turn: begin at the first it is away.)
    let start = 0;
    while (start < N && on(start)) start++;
    if (start === N) return [[0, 1]];
    for (let i = start; i < start + N; i++) {
      const here = on(i);
      if (here && from < 0) from = i;
      if (!here && from >= 0) {
        out.push([(from % N) / N, (i % N) / N]);
        from = -1;
      }
    }
    return out;
  }
  for (let i = 0; i <= N; i++) {
    const here = i < N && on(i);
    if (here && from < 0) from = i;
    if (!here && from >= 0) {
      out.push([from / N, i / N]);
      from = -1;
    }
  }
  return out;
}

/** A share of the year in words, as a land's own year goes (a world with no winter has a dry and a wet). */
export function seasonWords(share: number, byRain: boolean): string {
  const s = ((share % 1) + 1) % 1;
  if (byRain) return s < 0.25 || s >= 0.75 ? "the dry months" : "the wet months";
  return s < 0.12 || s >= 0.88
    ? "the depth of winter"
    : s < 0.32
      ? "the spring"
      : s < 0.62
        ? "the summer"
        : "the autumn";
}

/** How many of a kind's beasts are drawn on a land's map, as a land holds them. */
export function herdDrawn(niche: string, stock: number): number {
  if (stock < HERD.least) return 0;
  const k = clamp(stock / 60, 0.2, 1);
  switch (niche) {
    case "grazer":
      return Math.max(5, Math.round(26 * k));
    case "browser":
      return Math.max(3, Math.round(10 * k));
    case "swimmer":
      return Math.max(5, Math.round(20 * k));
    case "great beast":
      return Math.max(1, Math.round(4 * k));
    default:
      return Math.max(2, Math.round(6 * k));
  }
}

export type DwellingKind = "den" | "burrow" | "roost" | "nest";

/** Where a kind lives and raises its young, read off what it is. */
export function dwellingOf(
  niche: string,
  body: CreatureBody | null,
  size: number,
  water: boolean,
): DwellingKind {
  if (body && body.wings > 0 && body.moves === "fly") return "roost";
  if (water || (body && (body.moves === "swim" || body.fins > 0))) return "nest";
  if ((body && body.legs === 0) || size < 40) return "burrow";
  if (niche === "hunter" || niche === "small hunter" || niche === "scavenger") return "den";
  return body && !body.warm ? "nest" : "den";
}

/** How a kind raises its young, read off its body. */
export function youngWords(
  dwelling: DwellingKind,
  body: CreatureBody | null,
  niche: string,
  water: boolean,
): string {
  const warm = body?.warm ?? true,
    lays = !warm || body?.covering === "feathers";
  if (dwelling === "roost")
    return "It roosts together on the heights, and lays and rears its young there.";
  if (dwelling === "nest")
    return water
      ? "It lays in the weed beds and on the shelf's still ground, and its young keep there until they can go with the rest."
      : "It scrapes a nest in the ground and lays there, and the young go with the rest before the year has turned.";
  if (dwelling === "burrow")
    return `It digs its burrow into soft ground, and ${lays ? "lays" : "bears its young"} down there.`;
  if (niche === "hunter" || niche === "small hunter" || niche === "scavenger")
    return `It has a den out of the weather, and ${lays ? "lays" : "bears its young"} there; they hunt with it by their second year.`;
  return `It keeps to one sheltered ground to ${lays ? "lay" : "bear its young"}, and comes back to it each year.`;
}

const FEATURE_NAME: Readonly<Partial<Record<Feature, string>>> = {
  tusks: "Tusk",
  horns: "Horn",
  "wide-horns": "Spread",
  antlers: "Tine",
  trunk: "Reach",
  hump: "Hump",
  mane: "Mane",
  crest: "Crest",
  spines: "Spine",
  claws: "Claw",
  beak: "Beak",
};
const COVERING_NAME: Readonly<Record<string, string>> = {
  fur: "Hide",
  wool: "Fleece",
  feathers: "Wing",
  scales: "Scale",
  shell: "Shell",
  plates: "Plate",
  slick: "Slick",
};

/** What a town calls a beast it has come to know, from what it sees of it. */
export function beastByName(speciesName: string, body: CreatureBody | null, key: number): string {
  const coat = /\b(red|grey|dun|golden|black|pale|spotted|brindled|white)\b/.exec(
      speciesName.toLowerCase(),
    )?.[1],
    features = (body?.features ?? []).flatMap((f) => FEATURE_NAME[f] ?? []),
    what =
      features.length && key % 4 !== 0
        ? features[key % features.length]!
        : (COVERING_NAME[body?.covering ?? "fur"] ?? "Hide"),
    says = coat
      ? `${coat.charAt(0).toUpperCase()}${coat.slice(1)}`
      : (["Old", "Long", "Lean"][key % 3] ?? "Old");
  return `the ${says} ${what}`;
}

/** What a new kind on a cut-off land is called, and how it has changed: another coat, its body smaller where the ground is small, larger where nothing hunts it. */
export function newKindOf(
  parentName: string,
  key: number,
  hunted: boolean,
): { readonly name: string; readonly size: number; readonly how: "smaller" | "larger" } {
  const coats = ["red", "grey", "dun", "golden", "black", "pale", "spotted", "brindled"],
    bare = parentName.replace(/^(red|grey|dun|golden|black|pale|spotted|brindled)\s+/i, ""),
    had = /^(red|grey|dun|golden|black|pale|spotted|brindled)\b/i
      .exec(parentName)?.[1]
      ?.toLowerCase(),
    from = coats.filter((c) => c !== had),
    coat = from[key % from.length]!,
    how: "smaller" | "larger" = hunted ? "smaller" : "larger";
  return {
    name: `${how === "smaller" ? "little" : "great"} ${coat} ${bare}`,
    size: how === "smaller" ? 0.7 : 1.35,
    how,
  };
}

/** Why the creatures of a land have gone, in a clause. */
export function herdWhyWords(why: HerdWhy, water: boolean): string {
  switch (why) {
    case "green":
      return water ? "the beds gave them too little" : "there was too little left to graze";
    case "woods":
      return water
        ? "the beds no longer suited them"
        : "the woods came to stand where they grazed, or went from where they browsed";
    case "dry":
      return water ? "the waters changed under them" : "the land grew too dry to keep them";
    case "fields":
      return water
        ? "the pens and the fishers left them no room"
        : "the fields and the hunters left them no room";
    case "towns":
      return water
        ? "the towns of the shelf left them no room"
        : "the towns had grown over their ground";
    case "flocks":
      return water
        ? "the people's own beds and shoals took what they ate"
        : "the people's flocks had grazed it down";
  }
}
