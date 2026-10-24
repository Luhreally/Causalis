// The tree of life (Phase 17 M129, the Observatory): every lineage a world has known is a
// branch of one tree, grown from its first cells. Each line carries a genome — the
// instructions its body grows by: its symmetry, its segments, what grows from them (legs,
// fins, wings), its covering, its weight, its neck and tail, its blood, its gait, what it
// grows on its head, its eyes and feelers and its markings — and its body develops from it.
// A daughter line is its mother's genome changed. In the dawn and in each age, the lines that
// left no living descendant were bred forward by mutation and kept by selection: the fittest
// of many changed bodies for the way of life each took up, under its age's warmth, the
// world's pull and the hunters about it. The lineages the biosphere holds (living, and the
// dead it remembers) descend from founders, one for each kind of body among them (the first
// furred four-legged beasts, the first feathered fliers…), and within their kind from
// whichever line could reach their bodies by the fewest changes. Every change between a line
// and its mother is an innovation, weighed in the order it came, with the pressure that
// favoured it — its fins became legs as its line took to the land; it grew fur to keep its
// warm blood warm. Pure and keyed on the world's digest, on a stream of its own: the bodies
// the biosphere drew are its lineages' bodies exactly, and history never reads the tree.
import { Rng, defineStream, dmath, seedFromText, type Ref } from "../kernel/index.ts";
import {
  FOOD_WEB,
  NICHE_SIZE,
  creatureName,
  creatureWords,
  type BodyPlan,
  type Covering,
  type CreatureBody,
  type CreatureNiche,
  type Eats,
  type Feature,
  type Locomotion,
} from "../rules/index.ts";
import { AGES, AGE_MY, type AgeKind } from "./deeptime.ts";
import { starAgeGyr } from "./bodies.ts";
import type { HomeWorld } from "./homeworld.ts";
import type { Species } from "./biosphere.ts";
import { cladeRef } from "./kinds.ts";

const EVO = defineStream("gen.evolution");

export type Gait = "walk" | "run" | "hop";
export type Pattern = "plain" | "spots" | "stripes";

/** The instructions a body grows by. */
export type Genome = {
  readonly axis: "bilateral" | "radial";
  /** Body parts in a row (1 … 3). */
  readonly segments: 1 | 2 | 3;
  /** Pairs of legs (0 … 4), of fins (0 … 2), of wings (0 … 2). */
  readonly legs: number;
  readonly fins: number;
  readonly wings: number;
  readonly skin: Covering;
  /** Weight, kg. */
  readonly mass: number;
  /** Neck and tail length, 0 … 1. */
  readonly neck: number;
  readonly tail: number;
  readonly warm: boolean;
  /** How a legged body goes when it is not crawling: walking, running, hopping. */
  readonly gait: Gait;
  /** What grows on it: horns, a crest, claws, a beak… */
  readonly grows: readonly Feature[];
  /** Its eyes (0, 2, 4 or 6), its feelers, its markings. */
  readonly eyes: number;
  readonly feelers: boolean;
  readonly pattern: Pattern;
  readonly diet: Eats;
};

/**
 * The ways of life a line can take up: the web's niches, the dawn's ways in the sea, and the
 * first ways on land.
 */
export type Way =
  | CreatureNiche
  | "drifter"
  | "sea swimmer"
  | "sea crawler"
  | "burrower"
  | "walker"
  | "land crawler";

type WayOf = {
  readonly sea: boolean;
  readonly size: readonly [number, number];
  readonly diet: Eats;
  readonly level: number;
  /** A hunter's way; a way that reaches up for leaves; one a light body may fly in. */
  readonly hunter?: boolean;
  readonly reach?: boolean;
  readonly flies?: boolean;
  /** The sea floor's way (legs to walk it), the mud's (no limbs to burrow). */
  readonly floor?: boolean;
  readonly mud?: boolean;
};

const WAYS: Readonly<Record<Way, WayOf>> = {
  grazer: { sea: false, size: NICHE_SIZE.grazer, diet: "grass", level: 2 },
  browser: { sea: false, size: NICHE_SIZE.browser, diet: "leaves", level: 2, reach: true },
  "great beast": { sea: false, size: NICHE_SIZE["great beast"], diet: "leaves", level: 2 },
  "seed-eater": {
    sea: false,
    size: NICHE_SIZE["seed-eater"],
    diet: "seeds",
    level: 2,
    flies: true,
  },
  swimmer: { sea: true, size: NICHE_SIZE.swimmer, diet: "plankton", level: 2 },
  "small hunter": {
    sea: false,
    size: NICHE_SIZE["small hunter"],
    diet: "flesh",
    level: 3,
    hunter: true,
  },
  scavenger: { sea: false, size: NICHE_SIZE.scavenger, diet: "carrion", level: 3, flies: true },
  hunter: { sea: false, size: NICHE_SIZE.hunter, diet: "flesh", level: 4, hunter: true },
  drifter: { sea: true, size: [0.005, 1], diet: "plankton", level: 2 },
  "sea swimmer": { sea: true, size: [0.02, 4], diet: "plankton", level: 2 },
  "sea crawler": { sea: true, size: [0.01, 1.5], diet: "carrion", level: 2, floor: true },
  burrower: { sea: true, size: [0.002, 0.3], diet: "plankton", level: 2, mud: true },
  walker: { sea: false, size: [0.3, 40], diet: "leaves", level: 2 },
  "land crawler": { sea: false, size: [0.005, 2], diet: "leaves", level: 2 },
};

/** Whether a way of life is lived in the water. */
export function inWater(way: string): boolean {
  return way in WAYS ? WAYS[way as Way].sea : false;
}

/** What a body develops into from its genome, for a line at a level of the web of eating. */
export function develop(g: Genome, level: number): CreatureBody {
  const legs = 2 * g.legs,
    fins = 2 * g.fins,
    wings = 2 * g.wings,
    moves: Locomotion =
      wings > 0
        ? "fly"
        : fins > 0 && legs === 0
          ? "swim"
          : legs === 0
            ? "slither"
            : legs >= 6
              ? "crawl"
              : g.gait;
  return {
    symmetry: g.axis,
    segments: g.segments,
    legs: legs as CreatureBody["legs"],
    fins: fins as CreatureBody["fins"],
    wings: wings as CreatureBody["wings"],
    covering: g.skin,
    size: g.mass,
    moves,
    eats: g.diet,
    level,
    neck: g.neck,
    tail: g.tail,
    features: [...g.grows],
    warm: g.warm,
  };
}

/** The genome a body grew from: what it shows, and what it inherited and does not (its eyes, feelers, markings). */
export function encode(b: CreatureBody, from: Genome | null): Genome {
  return {
    axis: b.symmetry,
    segments: b.segments,
    legs: b.legs / 2,
    fins: b.fins / 2,
    wings: b.wings / 2,
    skin: b.covering,
    mass: b.size,
    neck: b.neck,
    tail: b.tail,
    warm: b.warm,
    gait:
      b.moves === "walk" || b.moves === "run" || b.moves === "hop"
        ? b.moves
        : (from?.gait ?? "walk"),
    grows: [...b.features],
    eyes: from?.eyes ?? 2,
    feelers: from?.feelers ?? false,
    pattern: from?.pattern ?? "plain",
    diet: b.eats,
  };
}

// —— Selection ————————————————————————————————————————————————————————————————————————

/** What favours a change: the pressures of a way of life in a world and an age. */
export type Pressure =
  | "water"
  | "ashore"
  | "dry"
  | "air"
  | "cold"
  | "heat"
  | "coat"
  | "stamina"
  | "pull"
  | "size"
  | "food"
  | "hunted"
  | "rivals"
  | "cost"
  | "sight";
const PRESSURES: readonly Pressure[] = [
  "water",
  "ashore",
  "dry",
  "air",
  "cold",
  "heat",
  "coat",
  "stamina",
  "pull",
  "size",
  "food",
  "hunted",
  "rivals",
  "cost",
  "sight",
];

/** What a line lives under: the world's pull and air, the warmth and rain where it lives in its age, how many hunt. */
export type Env = {
  readonly gravity: number;
  readonly pressure: number;
  readonly warmth: number;
  readonly rain: number;
  readonly kind: AgeKind | "dawn";
  /** The share of the living that hunt (0 … 1). */
  readonly hunted: number;
};

/** What grows only to a body on land (a burden in the water). */
const LAND_GROWTHS: readonly Feature[] = [
  "horns",
  "wide-horns",
  "antlers",
  "tusks",
  "trunk",
  "hump",
  "mane",
];
/** What a body wears in the contests of its kind. */
const DISPLAYS: readonly Feature[] = ["horns", "wide-horns", "antlers", "tusks", "mane", "crest"];

const armour = (g: Genome) =>
  (g.skin === "plates" ? 1 : g.skin === "shell" ? 1.2 : g.skin === "scales" ? 0.3 : 0) +
  (g.grows.includes("spines") ? 0.5 : 0) +
  (g.grows.some((f) => f === "horns" || f === "wide-horns" || f === "antlers") ? 0.5 : 0);

/** How well a body suits a way of life, pressure by pressure (each higher the better). */
export function pressures(g: Genome, way: Way, env: Env): Record<Pressure, number> {
  const w = WAYS[way],
    t: Record<Pressure, number> = {
      water: 0,
      ashore: 0,
      dry: 0,
      air: 0,
      cold: 0,
      heat: 0,
      coat: 0,
      stamina: 0,
      pull: 0,
      size: 0,
      food: 0,
      hunted: 0,
      rivals: 0,
      cost: 0,
      sight: 0,
    },
    pull = Math.max(0.3, env.gravity),
    coat = g.skin === "fur" || g.skin === "wool" || g.skin === "feathers",
    has = (f: Feature) => g.grows.includes(f);
  // How it gets about where it lives: swimming, walking the sea floor, burrowing the mud,
  // drifting; on land, on its legs.
  if (w.sea) {
    if (w.floor) {
      t.water +=
        (g.legs >= 2 ? 2 + 0.3 * Math.min(4, g.legs) : g.legs === 1 ? 1 : 0) +
        (g.segments >= 2 ? 0.4 : 0);
      t.water -= 1.2 * g.wings;
    } else if (w.mud) {
      t.water += g.legs === 0 && g.fins === 0 ? 2 : 0;
      t.water -= 0.6 * (g.legs + g.fins) + 1.2 * g.wings - (g.segments >= 2 ? 0.3 : 0);
    } else {
      t.water += g.fins > 0 ? 2 + 0.5 * Math.min(2, g.fins) : 0;
      t.water -= 0.6 * g.legs + 1.2 * g.wings;
      if (g.fins > 0) t.water += 0.8 * g.tail;
      t.water +=
        g.axis === "radial" ? (way === "drifter" ? 2.5 : -0.5) : way === "drifter" ? -1 : 0;
    }
    t.water +=
      g.skin === "slick" || g.skin === "scales"
        ? 0.4
        : g.skin === "plates" || g.skin === "shell"
          ? w.floor
            ? 0.3
            : -0.2
          : -0.8;
    t.cost -= 0.4 * g.grows.filter((f) => LAND_GROWTHS.includes(f)).length;
  } else {
    t.ashore +=
      g.legs === 0
        ? g.mass < 5
          ? 1
          : w.hunter && g.mass < 50
            ? 0.4
            : -1.5
        : g.legs === 1
          ? 1.8
          : g.legs === 2
            ? 2.4
            : 2;
    t.ashore -= 1.5 * g.fins + (g.axis === "radial" ? 3 : 0);
    // A bare skin dries out on land, unless the land is wet.
    t.dry += g.skin === "slick" ? (env.rain > 1500 ? -0.2 : -0.7) : 0.1;
  }
  // Wings bear a body as light as the air and the pull allow (feathered wings best); elsewhere
  // they are a cost.
  if (g.wings > 0) {
    const bears = (15 * env.pressure) / pull;
    t.air +=
      w.flies && !w.sea ? (g.mass <= bears ? 2.5 + (g.skin === "feathers" ? 0.8 : 0) : -3) : -1.5;
    if (g.wings > 1) t.air -= 0.3;
  }
  // The cold and the heat where it lives.
  const cold = Math.max(0, (8 - env.warmth) / 10),
    heat = Math.max(0, (env.warmth - 22) / 10),
    dry = env.rain < 400 ? 1 : 0;
  if (!w.sea) {
    t.cold += cold * ((coat ? 1.6 : g.skin === "slick" ? -1.2 : -0.6) + (g.warm ? 1 : -0.4));
    t.heat +=
      heat *
        (g.skin === "scales" || g.skin === "plates" || g.skin === "shell"
          ? 0.8
          : g.skin === "wool"
            ? -1
            : coat
              ? -0.4
              : 0) +
      heat * dry * (has("hump") ? 0.6 : 0);
    // Warm blood keeps the quick going; a coat keeps warm blood warm.
    if (g.warm) {
      t.stamina +=
        0.2 +
        (w.hunter ? 0.8 : 0) +
        (g.wings > 0 && w.flies ? 0.8 : 0) +
        (g.gait === "run" ? 0.3 : 0);
      t.coat += coat ? 0.7 : -0.2;
    }
  } else t.cold += cold * (g.warm ? 0.3 : 0);
  // A heavy world spreads a body over more legs; a light one lets it stand on two.
  if (!w.sea && g.legs > 0) t.pull += (pull - 1) * (g.legs - 2) * 0.7;
  // Its weight against what its way of life wants (bodies smaller under a heavier pull).
  const k = dmath.pow(pull, -0.75),
    lo = w.size[0] * k,
    hi = w.size[1] * k;
  t.size -=
    1.2 * (g.mass < lo ? dmath.log10(lo / g.mass) : g.mass > hi ? dmath.log10(g.mass / hi) : 0);
  // What it feeds with.
  if (w.hunter)
    t.food +=
      (has("claws") ? 1 : 0) +
      (g.gait === "run" && g.legs === 2 ? 0.8 : 0) -
      (g.legs >= 3 ? 0.6 : 0);
  if (w.reach) t.food += 1.2 * g.neck;
  if (way === "grazer") t.food += g.neck > 0.3 && g.neck < 0.8 ? 0.4 : 0;
  if (way === "great beast") t.food += has("trunk") ? 0.8 : 0;
  if (way === "seed-eater" || (w.flies && g.wings > 0)) t.food += has("beak") ? 0.5 : 0;
  if (g.diet !== w.diet) t.food -= 1;
  // Armour against the hunters about (no help to a hunter); horns and manes in the contests
  // of its kind.
  if (!w.hunter) t.hunted += env.hunted * 1.4 * armour(g);
  if (!w.sea && g.mass >= 2 && g.grows.some((f) => DISPLAYS.includes(f))) t.rivals += 0.2;
  // What it pays for: armour, warm blood, every growth and limb, more eyes than two.
  t.cost -=
    (g.skin === "plates" || g.skin === "shell" ? 0.35 : 0) +
    (g.warm ? 0.3 : 0) +
    0.12 * g.grows.length +
    0.08 * (g.legs + g.fins + g.wings) +
    (g.eyes > 2 ? 0.1 * (g.eyes - 2) : 0);
  // Eyes to find food and see danger, worth little in the mud; feelers there and on the floor.
  t.sight += g.eyes > 0 ? (w.mud ? 0.1 : 0.8) : w.mud ? 0.3 : -0.8;
  if (g.feelers) t.sight += w.mud || w.floor ? 0.5 : 0.1;
  return t;
}

/** How well a body suits a way of life, all told. */
export function fitness(g: Genome, way: Way, env: Env): number {
  const t = pressures(g, way, env);
  let f = 0;
  for (const p of PRESSURES) f += t[p];
  return f;
}

// —— Mutation ——————————————————————————————————————————————————————————————————————————

const SKIN_NEXT: Readonly<Record<Covering, readonly Covering[]>> = {
  slick: ["scales", "fur", "plates"],
  scales: ["slick", "plates", "feathers", "fur"],
  plates: ["scales", "shell", "slick"],
  shell: ["plates", "slick"],
  fur: ["wool", "slick", "scales"],
  wool: ["fur"],
  feathers: ["scales", "fur"],
};
const GROWTHS: readonly Feature[] = [
  "horns",
  "wide-horns",
  "antlers",
  "tusks",
  "trunk",
  "hump",
  "mane",
  "crest",
  "spines",
  "claws",
  "beak",
];
const OPS: readonly (readonly [string, number])[] = [
  ["limbs", 1.2],
  ["legs", 1],
  ["fins", 0.6],
  ["wings", 0.3],
  ["segments", 0.6],
  ["skin", 1],
  ["mass", 1.5],
  ["neck", 0.6],
  ["tail", 0.6],
  ["warm", 0.3],
  ["gait", 0.5],
  ["grow", 1],
  ["eyes", 0.4],
  ["feelers", 0.3],
  ["axis", 0.05],
  ["pattern", 0.3],
];
const OPS_WEIGHT = OPS.reduce((a, [, w]) => a + w, 0);

const clamp01 = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 100) / 100;
const roundMass = (m: number) =>
  m >= 10 ? Math.round(m) : m >= 0.01 ? Math.round(m * 1000) / 1000 : Math.round(m * 1e6) / 1e6;

/** One change to a genome, by keyed draws `u(k)` in [0, 1). */
export function mutate(g: Genome, u: (k: number) => number): Genome {
  let pick = u(0) * OPS_WEIGHT,
    op = OPS[0]![0];
  for (const [name, w] of OPS) {
    if (pick < w) {
      op = name;
      break;
    }
    pick -= w;
  }
  const up = u(1) < 0.5;
  switch (op) {
    case "limbs": {
      // One kind of limb becomes another: fins to legs, legs to fins, legs to wings, wings to legs.
      const ways: ["legs" | "fins" | "wings", "legs" | "fins" | "wings"][] = [];
      if (g.fins > 0 && g.legs < 4) ways.push(["fins", "legs"]);
      if (g.legs > 0 && g.fins < 2) ways.push(["legs", "fins"]);
      if (g.legs > 0 && g.wings < 2) ways.push(["legs", "wings"]);
      if (g.wings > 0 && g.legs < 4) ways.push(["wings", "legs"]);
      if (!ways.length) return g;
      const [from, to] = ways[Math.floor(u(2) * ways.length)]!;
      return { ...g, [from]: g[from] - 1, [to]: g[to] + 1 };
    }
    case "legs":
      return { ...g, legs: Math.max(0, Math.min(4, g.legs + (up ? 1 : -1))) };
    case "fins":
      return { ...g, fins: Math.max(0, Math.min(2, g.fins + (up ? 1 : -1))) };
    case "wings":
      return { ...g, wings: Math.max(0, Math.min(2, g.wings + (up ? 1 : -1))) };
    case "segments":
      return {
        ...g,
        segments: Math.max(1, Math.min(3, g.segments + (up ? 1 : -1))) as Genome["segments"],
      };
    case "skin": {
      const next = SKIN_NEXT[g.skin];
      return { ...g, skin: next[Math.floor(u(2) * next.length)]! };
    }
    case "mass":
      return { ...g, mass: roundMass(g.mass * dmath.exp((up ? 1 : -1) * (0.2 + 0.7 * u(2)))) };
    case "neck":
      return { ...g, neck: clamp01(g.neck + (up ? 1 : -1) * (0.1 + 0.2 * u(2))) };
    case "tail":
      return { ...g, tail: clamp01(g.tail + (up ? 1 : -1) * (0.1 + 0.2 * u(2))) };
    case "warm":
      return { ...g, warm: !g.warm };
    case "gait": {
      const gaits: Gait[] = ["walk", "run", "hop"];
      return { ...g, gait: gaits[Math.floor(u(2) * 3)]! };
    }
    case "grow": {
      if (g.grows.length && u(2) < 0.4) {
        const lose = g.grows[Math.floor(u(3) * g.grows.length)]!;
        return { ...g, grows: g.grows.filter((f) => f !== lose) };
      }
      const can = GROWTHS.filter((f) => !g.grows.includes(f));
      if (!can.length) return g;
      return { ...g, grows: [...g.grows, can[Math.floor(u(3) * can.length)]!] };
    }
    case "eyes":
      return { ...g, eyes: Math.max(0, Math.min(6, g.eyes + (up ? 2 : -2))) };
    case "feelers":
      return { ...g, feelers: !g.feelers };
    case "axis":
      return { ...g, axis: g.axis === "radial" ? "bilateral" : "radial" };
    default: {
      const patterns: Pattern[] = ["plain", "spots", "stripes"];
      return { ...g, pattern: patterns[Math.floor(u(2) * 3)]! };
    }
  }
}

const SKIN_GROUP: Readonly<Record<Covering, number>> = {
  slick: 0,
  scales: 1,
  feathers: 2,
  plates: 3,
  shell: 3,
  fur: 4,
  wool: 4,
};

/** How many changes apart two genomes are (a body plan's change weighs more than a growth's). */
export function distance(a: Genome, b: Genome): number {
  let d =
    (a.axis !== b.axis ? 6 : 0) +
    1.5 * Math.abs(a.segments - b.segments) +
    Math.abs(a.legs - b.legs) +
    Math.abs(a.fins - b.fins) +
    1.5 * Math.abs(a.wings - b.wings) +
    (a.skin === b.skin ? 0 : SKIN_GROUP[a.skin] === SKIN_GROUP[b.skin] ? 0.8 : 2.2) +
    (a.warm !== b.warm ? 1.5 : 0) +
    0.8 * Math.abs(dmath.log10(Math.max(1e-6, a.mass)) - dmath.log10(Math.max(1e-6, b.mass))) +
    Math.abs(a.neck - b.neck) +
    Math.abs(a.tail - b.tail) +
    (a.gait !== b.gait ? 0.3 : 0) +
    (a.diet !== b.diet ? 0.5 : 0);
  for (const f of a.grows) if (!b.grows.includes(f)) d += 0.4;
  for (const f of b.grows) if (!a.grows.includes(f)) d += 0.4;
  return d;
}

/**
 * A body's kind, as the tree's founders gather them: its symmetry, its covering's family, its
 * blood and how it goes (on four legs, on two, by fins, by wings, on many legs, on none).
 */
export function kindOfBody(g: Genome): string {
  const limbs =
    g.fins > 0 && g.legs === 0
      ? "fins"
      : g.wings > 0
        ? "wings"
        : g.legs >= 3
          ? "many"
          : g.legs === 2
            ? "four"
            : g.legs === 1
              ? "two"
              : "none";
  return `${g.axis}|${SKIN_GROUP[g.skin]}|${g.warm ? "warm" : "cold"}|${limbs}`;
}

// —— Innovations ———————————————————————————————————————————————————————————————————————

/** A change between a line and its mother: what changed, and what favoured it. */
export type Innovation = {
  /** What changed, in words ("its fins became legs"). */
  readonly what: string;
  /** The pressure that favoured it, or null where nothing did (it came by chance). */
  readonly pressure: Pressure | null;
  /** Why, in words ("as its line took to the land"). */
  readonly why: string;
};

const SKIN_WORDS: Readonly<Record<Covering, string>> = {
  fur: "it grew fur",
  wool: "its fur grew into wool",
  feathers: "it grew feathers",
  scales: "it grew scales",
  shell: "it grew a shell",
  plates: "it grew armoured plates",
  slick: "its skin went bare and slick",
};
const GROW_WORDS: Readonly<Record<Feature, string>> = {
  horns: "horns",
  "wide-horns": "wide horns",
  antlers: "antlers",
  tusks: "tusks",
  trunk: "a trunk",
  hump: "a hump",
  mane: "a mane",
  crest: "a crest",
  spines: "spines",
  claws: "claws",
  beak: "a beak",
};
const PAIRS = ["no", "one pair of", "two pairs of", "three pairs of", "four pairs of"];
const DIET_WORDS: Readonly<Record<Eats, string>> = {
  grass: "grass",
  leaves: "leaves",
  seeds: "seeds",
  flesh: "flesh",
  carrion: "carrion",
  plankton: "what drifts in the water",
};

function whyWords(p: Pressure | null, what: string, way: Way, env: Env, pull: number): string {
  const w = WAYS[way];
  switch (p) {
    case "water":
      return w.floor
        ? "walking the sea floor"
        : w.mud
          ? "burrowing in the mud"
          : way === "drifter"
            ? "drifting in the open water"
            : "for the water it swam in";
    case "ashore":
      return /lost its legs|lost a pair/.test(what)
        ? "slipping through the undergrowth"
        : "as its line took to the land";
    case "dry":
      return "against drying out on land";
    case "air":
      return "to take to the air";
    case "cold":
      return env.kind === "icehouse" ? "against the icehouse's cold" : "against the cold";
    case "heat":
      return env.kind === "hothouse" ? "in the hothouse's heat" : "against the heat";
    case "coat":
      return "to keep its warm blood warm";
    case "stamina":
      return w.hunter
        ? "to keep up the chase"
        : /running/.test(what)
          ? "to outrun what hunts it"
          : w.flies && /wing/.test(what)
            ? "to keep its wings beating"
            : "to stay quick through the cool nights";
    case "pull":
      return pull > 1.05 ? "under the world's heavy pull" : "under the world's light pull";
    case "size":
      return "to the size its way of life wanted";
    case "food":
      return w.hunter
        ? "to catch its prey"
        : w.reach
          ? "to reach the leaves"
          : way === "great beast"
            ? "to gather its food"
            : way === "seed-eater"
              ? "to crack its seeds"
              : way === "grazer"
                ? "to crop the grass"
                : "to feed";
    case "hunted":
      return "against the hunters about it";
    case "rivals":
      return "in the contests of its kind";
    case "cost":
      return "sparing its body the cost";
    case "sight":
      return w.mud ? "in the dark of the mud" : "to see its food and its danger";
    default:
      return "by chance, as lines drift";
  }
}

/** The genes that differ between a mother and a daughter, one change each, in the order they came. */
function changes(a: Genome, b: Genome): { what: string; apply: (g: Genome) => Genome }[] {
  const out: { what: string; apply: (g: Genome) => Genome }[] = [];
  if (a.axis !== b.axis)
    out.push({
      what: b.axis === "radial" ? "its body turned radial" : "its body came to have two sides",
      apply: (g) => ({ ...g, axis: b.axis }),
    });
  if (a.segments !== b.segments)
    out.push({
      what:
        b.segments > a.segments
          ? `its body lengthened into ${b.segments} parts`
          : b.segments === 1
            ? "its body drew into one"
            : `its body shortened to ${b.segments} parts`,
      apply: (g) => ({ ...g, segments: b.segments }),
    });
  // Limbs that became other limbs, then those gained and lost.
  const limbs = { legs: a.legs, fins: a.fins, wings: a.wings };
  const turn = (from: keyof typeof limbs, to: keyof typeof limbs, what: string) => {
    const n = Math.min(limbs[from] - b[from], b[to] - limbs[to]);
    if (n <= 0) return;
    limbs[from] -= n;
    limbs[to] += n;
    out.push({
      what,
      apply: (g) => ({ ...g, [from]: Math.max(0, g[from] - n), [to]: g[to] + n }),
    });
  };
  turn("fins", "legs", "its fins became legs");
  turn("legs", "wings", "its fore legs became wings");
  turn("legs", "fins", "its legs became flippers");
  turn("wings", "legs", "its wings became legs again");
  const legs = limbs.legs;
  if (legs !== b.legs)
    out.push({
      what:
        b.legs === 0
          ? "it lost its legs"
          : legs === 0
            ? `it grew ${PAIRS[b.legs]} legs`
            : b.legs > legs
              ? `it grew ${b.legs - legs === 1 ? "another pair" : `${b.legs - legs} more pairs`} of legs`
              : `it lost ${legs - b.legs === 1 ? "a pair" : `${legs - b.legs} pairs`} of legs`,
      apply: (g) => ({ ...g, legs: b.legs }),
    });
  if (limbs.fins !== b.fins)
    out.push({
      what:
        b.fins > limbs.fins
          ? limbs.fins === 0
            ? "it grew fins"
            : "it grew more fins"
          : "it lost fins",
      apply: (g) => ({ ...g, fins: b.fins }),
    });
  if (limbs.wings !== b.wings)
    out.push({
      what:
        b.wings > limbs.wings
          ? limbs.wings === 0
            ? "it grew wings"
            : "it grew a second pair of wings"
          : "it lost its wings",
      apply: (g) => ({ ...g, wings: b.wings }),
    });
  // (Warm blood before the coat that keeps it.)
  if (a.warm !== b.warm)
    out.push({
      what: b.warm ? "it came to warm blood" : "its blood went cold",
      apply: (g) => ({ ...g, warm: b.warm }),
    });
  if (a.skin !== b.skin)
    out.push({ what: SKIN_WORDS[b.skin], apply: (g) => ({ ...g, skin: b.skin }) });
  if (a.diet !== b.diet)
    out.push({
      what: `it came to eat ${DIET_WORDS[b.diet]}`,
      apply: (g) => ({ ...g, diet: b.diet }),
    });
  const ratio = b.mass / Math.max(1e-6, a.mass);
  if (ratio > 1.8 || ratio < 1 / 1.8)
    out.push({
      what: `${ratio > 1 ? "it grew" : "it shrank"} to ${massWords(b.mass)}`,
      apply: (g) => ({ ...g, mass: b.mass }),
    });
  if (Math.abs(b.neck - a.neck) >= 0.25)
    out.push({
      what: b.neck > a.neck ? "its neck lengthened" : "its neck shortened",
      apply: (g) => ({ ...g, neck: b.neck }),
    });
  if (Math.abs(b.tail - a.tail) >= 0.3)
    out.push({
      what: b.tail > a.tail ? "its tail lengthened" : "its tail shortened",
      apply: (g) => ({ ...g, tail: b.tail }),
    });
  if (a.gait !== b.gait && b.legs > 0 && b.legs < 3 && b.wings === 0)
    out.push({
      what:
        b.gait === "run"
          ? "it took to running"
          : b.gait === "hop"
            ? "it took to hopping"
            : "it settled to walking",
      apply: (g) => ({ ...g, gait: b.gait }),
    });
  for (const f of b.grows)
    if (!a.grows.includes(f))
      out.push({
        what: `it grew ${GROW_WORDS[f]}`,
        apply: (g) => ({ ...g, grows: [...g.grows, f] }),
      });
  for (const f of a.grows)
    if (!b.grows.includes(f))
      out.push({
        what: `it lost its ${GROW_WORDS[f].replace(/^an? /, "")}`,
        apply: (g) => ({ ...g, grows: g.grows.filter((x) => x !== f) }),
      });
  if (a.eyes !== b.eyes)
    out.push({
      what:
        b.eyes === 0
          ? "it lost its eyes"
          : a.eyes === 0
            ? "it came to see, with eyes"
            : b.eyes > a.eyes
              ? `it grew ${b.eyes} eyes`
              : `its eyes fell to ${b.eyes}`,
      apply: (g) => ({ ...g, eyes: b.eyes }),
    });
  if (a.feelers !== b.feelers)
    out.push({
      what: b.feelers ? "it grew feelers" : "it lost its feelers",
      apply: (g) => ({ ...g, feelers: b.feelers }),
    });
  return out;
}

/** The small changes of a body, told where nothing larger changed (a sister line a little apart). */
function smallChanges(a: Genome, b: Genome): { what: string; apply: (g: Genome) => Genome }[] {
  const out: { what: string; apply: (g: Genome) => Genome }[] = [];
  if (b.mass !== a.mass)
    out.push({
      what: b.mass > a.mass ? "it grew a little larger" : "it grew a little smaller",
      apply: (g) => ({ ...g, mass: b.mass }),
    });
  if (b.neck !== a.neck)
    out.push({
      what: b.neck > a.neck ? "its neck grew a little longer" : "its neck grew a little shorter",
      apply: (g) => ({ ...g, neck: b.neck }),
    });
  if (b.tail !== a.tail)
    out.push({
      what: b.tail > a.tail ? "its tail grew a little longer" : "its tail grew a little shorter",
      apply: (g) => ({ ...g, tail: b.tail }),
    });
  if (a.gait !== b.gait)
    out.push({
      what:
        b.gait === "run"
          ? "it took to running"
          : b.gait === "hop"
            ? "it took to hopping"
            : "it settled to walking",
      apply: (g) => ({ ...g, gait: b.gait }),
    });
  return out;
}

export function massWords(kg: number): string {
  return kg >= 1000
    ? `${(kg / 1000).toFixed(1)} tonnes`
    : kg >= 1
      ? `${Math.round(kg)} kg`
      : kg >= 0.001
        ? `${Math.round(kg * 1000)} g`
        : `${Math.max(1, Math.round(kg * 1e6))} mg`;
}

/**
 * The innovations between a mother's genome and a daughter's: each change, and the pressure of
 * the daughter's way of life that favoured it most — the change weighed in the daughter's own
 * body (against that body without it), else on the body as it then was.
 */
export function innovations(a: Genome, b: Genome, way: Way, env: Env): Innovation[] {
  const pull = Math.max(0.3, env.gravity),
    large = changes(a, b),
    all = large.length ? large : smallChanges(a, b),
    whole = pressures(b, way, env);
  let now = a,
    base = pressures(a, way, env);
  return all.map((c, i) => {
    let without = a;
    for (const [j, o] of all.entries()) if (j !== i) without = o.apply(without);
    const lacking = pressures(without, way, env),
      next = c.apply(now),
      t = pressures(next, way, env);
    let best: Pressure | null = null,
      gain = 0.05;
    // (Warm blood is not kept for the coat that keeps it.)
    const own = (p: Pressure) => !(p === "coat" && /warm blood/.test(c.what));
    for (const p of PRESSURES) {
      const d = whole[p] - lacking[p];
      if (own(p) && d > gain) [best, gain] = [p, d];
    }
    if (!best)
      for (const p of PRESSURES) {
        const d = t[p] - base[p];
        if (own(p) && d > gain) [best, gain] = [p, d];
      }
    now = next;
    base = t;
    return { what: c.what, pressure: best, why: whyWords(best, c.what, way, env, pull) };
  });
}

// —— The tree ——————————————————————————————————————————————————————————————————————————

export type NodeKind = "dawn" | "stem" | "ghost" | "crown" | "plant" | "people";

/** A line of the tree. */
export type LifeNode = {
  readonly id: number;
  /** Its page: a lineage's own ref for those the biosphere holds, else the tree's own. */
  readonly ref: string;
  /** Its mother line (-1: the root). */
  readonly parent: number;
  readonly kind: NodeKind;
  readonly name: string;
  /** What it was, in words. */
  readonly what: string;
  /** The biosphere's lineage it is (null: a line the tree alone remembers). */
  readonly species: number | null;
  /** Its way of life. */
  readonly way: string;
  /** Millions of years ago it arose, and it died out (null: it lives, or lives on in its daughters). */
  readonly from: number;
  readonly to: number | null;
  /** The ages it arose and died in (-1: before the ages; null: it lives). */
  readonly arose: number;
  readonly died: number | null;
  readonly genome: Genome | null;
  readonly body: CreatureBody | null;
  /** What changed from its mother, and why. */
  readonly innovations: readonly Innovation[];
  /** What ended it, in words (null: it lives, or it lives on in its daughters). */
  readonly fate: string | null;
  /** Where it lived (a cell of the world, -1: the open sea of the dawn). */
  readonly origin: number;
  /** The warmth it lived in, today's terms, °C. */
  readonly warm: number;
};

/** A step of life's dawn, before the ages: when it came, and what it was. */
export type Rung = {
  readonly id:
    | "replicators"
    | "cells"
    | "light"
    | "air"
    | "nucleus"
    | "together"
    | "bodies"
    | "radiation"
    | "ashore";
  readonly name: string;
  /** Millions of years ago. */
  readonly at: number;
  readonly words: string;
  /** The tree's line that began it, if one did. */
  readonly node: number | null;
};

export type TreeOfLife = {
  readonly nodes: readonly LifeNode[];
  /** Each of the biosphere's lineages, its line (-1: none). */
  readonly ofSpecies: Int32Array;
  readonly rungs: readonly Rung[];
  /** How old the world is, millions of years. */
  readonly worldAge: number;
  /** Each line's daughters, oldest first. */
  readonly children: readonly (readonly number[])[];
};

/** The tree's own refs (`clade:0:<line>`). */
export function lineRef(id: number): Ref {
  return cladeRef(0, id);
}

const TREES = new Map<string, TreeOfLife>();

/** The tree of a world (kept for the last few worlds asked of). */
export function treeOfLife(g: HomeWorld): TreeOfLife {
  const hit = TREES.get(g.digest);
  if (hit) return hit;
  const tree = growTree(g);
  if (TREES.size >= 4) TREES.delete(TREES.keys().next().value!);
  TREES.set(g.digest, tree);
  return tree;
}

/** An age's span in millions of years ago: its start and its end. */
export function ageSpan(k: number): [number, number] {
  return [(AGES - k) * AGE_MY, (AGES - k - 1) * AGE_MY];
}

const STEM_WAYS: readonly Way[] = ["sea swimmer", "sea crawler", "burrower"];

/**
 * Many changed bodies of a mother's, the fittest kept for its way: each try one to three
 * changes; only what is fitter is kept, and what came along with it that helps nothing is
 * let go. `draw(try, slot, k)` is the keyed draw.
 */
function breedLine(
  mother: Genome,
  way: Way,
  env: Env,
  draw: (c: number, slot: number, k?: number) => number,
  tries = 16,
): Genome {
  let best = mother,
    bestFit = fitness(mother, way, env);
  for (let c = 0; c < tries; c++) {
    let x = mother;
    const steps = 1 + Math.floor(draw(c, 1) * 3);
    for (let s = 0; s < steps; s++) x = mutate(x, (k) => draw(c, 10 + s, k));
    x = { ...x, diet: WAYS[way].diet };
    const f = fitness(x, way, env);
    // (Only what is fitter is kept: a change that helps nothing is not kept for long.)
    if (f > bestFit + 0.02) [best, bestFit] = [x, f];
  }
  // What came along with the change that helped and helps nothing itself is not kept.
  for (const c of changes(best, mother)) {
    const y = c.apply(best);
    if (fitness(y, way, env) >= bestFit - 0.005) [best, bestFit] = [y, fitness(y, way, env)];
  }
  return best;
}

/**
 * A line bred over many generations toward its way, then grown or shrunk to the size its
 * way wants under its world's pull. `draw(round, try, slot, k)`; round -1 draws its size.
 */
function evolveLine(
  mother: Genome,
  way: Way,
  env: Env,
  draw: (r: number, c: number, slot: number, k?: number) => number,
  rounds: number,
): Genome {
  let x: Genome = { ...mother, diet: WAYS[way].diet };
  for (let r = 0; r < rounds; r++) x = breedLine(x, way, env, (c, slot, k) => draw(r, c, slot, k));
  const pull = Math.max(0.3, env.gravity),
    k = dmath.pow(pull, -0.75),
    [lo, hi] = WAYS[way].size;
  if (x.mass < lo * k || x.mass > hi * k)
    x = {
      ...x,
      mass: roundMass(lo * k * dmath.pow(hi / lo, 0.15 + 0.5 * draw(-1, 0, 0) * draw(-1, 1, 0))),
    };
  return x;
}

/** The first body with a front and a back, and the first bell of jelly: where bodies began. */
const FIRST_WORM: Genome = {
  axis: "bilateral",
  segments: 1,
  legs: 0,
  fins: 0,
  wings: 0,
  skin: "slick",
  mass: 0.004,
  neck: 0,
  tail: 0.2,
  warm: false,
  gait: "walk",
  grows: [],
  eyes: 0,
  feelers: false,
  pattern: "plain",
  diet: "plankton",
};
const FIRST_JELLY: Genome = { ...FIRST_WORM, axis: "radial", mass: 0.03, tail: 0 };

/** The ways a world seen from afar is sketched with: the sea's first, then the land's. */
const SKETCH_WAYS: readonly Way[] = [
  "drifter",
  "sea swimmer",
  "sea crawler",
  "walker",
  "grazer",
  "hunter",
  "burrower",
  "land crawler",
];

/** A body of another world, sketched: its name, its way, its body and the instructions for it. */
export type Sketched = {
  readonly name: string;
  readonly way: Way;
  readonly body: CreatureBody;
  readonly genome: Genome;
};

/**
 * The bodies of a world known only from afar (Phase 18 M132): a few lines grown as its own
 * life would grow them, from the first worm and jelly under its own pull, warmth and air,
 * each bred toward a way of life its world offers — the sea's, and the land's where it has
 * land and air enough to come ashore. The land's are bred from the first that walked.
 * Pure: the same key draws the same bodies.
 */
export function sketchLife(key: string, env: Env, land: boolean, count = 6): Sketched[] {
  const rng = new Rng(seedFromText(`life elsewhere ${key}`)),
    names = new Set<string>(),
    out: Sketched[] = [];
  let walker: Genome | null = null;
  const ways = SKETCH_WAYS.filter((w) => land || WAYS[w].sea).slice(0, count);
  ways.forEach((way, i) => {
    const from = way === "drifter" ? FIRST_JELLY : !WAYS[way].sea && walker ? walker : FIRST_WORM,
      genome = evolveLine(
        from,
        way,
        env,
        (r, c, slot, k = 0) => rng.real(EVO, i, r * 64 + c, slot, k),
        WAYS[way].sea ? 6 : 8,
      ),
      body = develop(genome, WAYS[way].level);
    if (way === "walker") walker = genome;
    const name = (
      WAYS[way].sea || way === "walker" || way === "land crawler"
        ? stemName(way, body, names)
        : uniqueName(names, body, way, env.warmth, rng.real(EVO, i, 999, 0, 0))
    ).replace(/^the (first )?/, "");
    names.add(name);
    out.push({ name, way, body, genome });
  });
  return out;
}

function growTree(g: HomeWorld): TreeOfLife {
  const rng = new Rng(seedFromText(`tree of life ${g.digest}`)),
    u = (a: number, b: number, c: number, d = 0) => rng.real(EVO, a, b, c, d),
    species = g.life.species,
    ages = g.deep.ages,
    gravity = g.planet.gravity,
    nodes: LifeNode[] = [],
    names = new Set<string>(species.map((s) => s.name)),
    ofSpecies = new Int32Array(species.length).fill(-1);
  const add = (n: Omit<LifeNode, "id" | "ref"> & { ref?: string }): LifeNode => {
    const node: LifeNode = { ...n, id: nodes.length, ref: n.ref ?? lineRef(nodes.length) };
    nodes.push(node);
    if (node.species !== null) ofSpecies[node.species] = node.id;
    names.add(node.name);
    return node;
  };
  const envOf = (warm: number, rain: number, k: number, hunted: number): Env => ({
    gravity,
    pressure: 1,
    warmth: warm + (k >= 0 ? ages[k]!.warmth : 0),
    rain,
    kind: k >= 0 ? ages[k]!.kind : "dawn",
    hunted,
  });
  /** The age a time falls in (-1: before the ages). */
  const ageAt = (my: number) =>
    Math.min(AGES - 1, Math.max(-1, AGES - 1 - Math.floor(my / AGE_MY)));

  // —— The dawn: how old the world is, and when each step of early life came. The last steps
  // are reckoned back from the great radiation, the first forward from the world's cooling.
  // (A world is as old as its star, as it is told; one whose star is young is given the
  // time life took, its dawn crowded.)
  const worldAge = Math.max(1500, Math.round(starAgeGyr(g.star) * 1000)),
    first = worldAge - 300 - Math.round(300 * u(0, 0, 0)),
    radiation = 520 + Math.round(40 * u(0, 0, 1)),
    bodiesAt = radiation + 50 + Math.round(100 * u(0, 0, 2)),
    togetherAt = Math.max(
      bodiesAt + 40,
      Math.min(first - 600, radiation + 500 + Math.round(400 * u(0, 0, 3))),
    ),
    span = first - togetherAt,
    early = (share: number) => Math.round(first - share * span),
    sea = g.planet.meanTemperature + 4;

  const dawnLine = (
    parent: number,
    name: string,
    what: string,
    from: number,
    innovation: string,
    why: string,
    kind: NodeKind = "dawn",
    genome: Genome | null = null,
    way = "the dawn's seas",
  ) =>
    add({
      parent,
      kind,
      name,
      what,
      species: null,
      way,
      from,
      to: null,
      arose: -1,
      died: null,
      genome,
      body: genome ? develop(genome, 2) : null,
      innovations: innovation ? [{ what: innovation, pressure: null, why }] : [],
      fate: null,
      origin: -1,
      warm: sea,
    });
  const replicators = dawnLine(
    -1,
    "the first replicators",
    "chains of matter that copied themselves, in the warm water of the young world",
    first,
    "",
    "",
    "dawn",
    null,
    "the first chemistry",
  );
  const cells = dawnLine(
    replicators.id,
    "the first cells",
    "replicators inside a skin of fat: the first cells, dividing to fill the water",
    early(0.05),
    "a skin closed about its chemistry",
    "keeping what it made for itself",
  );
  const light = dawnLine(
    cells.id,
    "the light-eaters",
    "cells that made their food from the star's light, breathing out a gas the air had never held",
    early(0.15),
    "it came to eat light",
    "where the sunlit water had food for none",
  );
  const nucleus = dawnLine(
    cells.id,
    "cells with a nucleus",
    "larger cells keeping their instructions in a nucleus, and another cell taken in to burn their food",
    early(0.55),
    "one cell took another in and kept it",
    "burning its food in the air the light-eaters had made",
  );
  const together = dawnLine(
    nucleus.id,
    "cells together",
    "cells that stayed together after dividing, sharing the work of living",
    togetherAt,
    "its cells stayed together",
    "too large together for the small hunters of the water to swallow",
  );
  const weed = dawnLine(
    light.id,
    "green weed of the shallows",
    "the light-eaters' cells together: weeds swaying in the sunlit shallows",
    togetherAt - 40 - Math.round(80 * u(0, 0, 4)),
    "its cells stayed together",
    "to reach the light",
    "plant",
    null,
    "growing in the light",
  );

  // The first bodies: a worm, a jelly's bell, a sponge's cup.
  const worm = FIRST_WORM,
    jelly = FIRST_JELLY;
  const firstWorm = dawnLine(
    together.id,
    "the first worms",
    "the first bodies with a front and a back: worms of the sea floor",
    bodiesAt,
    "it grew a front and a back",
    "going one way through the mud",
    "dawn",
    worm,
    "burrower",
  );
  const firstJelly = dawnLine(
    together.id,
    "the first jellies",
    "bells of jelly drifting in the open water, stinging what they met",
    bodiesAt - 6,
    "its body grew round a middle",
    "drifting, open to every side",
    "dawn",
    jelly,
    "drifter",
  );
  add({
    parent: together.id,
    kind: "dawn",
    name: "the first sponges",
    what: "cups of cells fixed to the rock, sifting the water through themselves",
    species: null,
    way: "sifting the water",
    from: bodiesAt - 12,
    to: Math.round(radiation - 40 - 60 * u(0, 0, 5)),
    arose: -1,
    died: null,
    genome: null,
    body: null,
    innovations: [{ what: "its cells grew into a cup", pressure: null, why: "to sift the water" }],
    fate: "outlived by the bodies that moved",
    origin: -1,
    warm: sea,
  });

  /** Many changed bodies of a mother's, the fittest kept for the way it took up. */
  const breed = (mother: Genome, way: Way, env: Env, key: number, tries = 16): Genome =>
    breedLine(mother, way, env, (c, slot, k = 0) => u(key, c, slot, k), tries);
  /**
   * A line bred over many generations toward its way: bred again and again, and grown or
   * shrunk to the size its way wants (the many small steps of weight, taken at once).
   */
  const evolve = (mother: Genome, way: Way, env: Env, key: number, rounds: number): Genome =>
    evolveLine(
      mother,
      way,
      env,
      (r, c, slot, k = 0) => (r < 0 ? u(key, 999, c) : u(key * 64 + r, c, slot, k)),
      rounds,
    );
  const seaEnv = envOf(sea, 1000, -1, 0.15);

  // The dawn's great radiation in the sea: from the worms, swimmers, crawlers of the floor and
  // burrowers of the mud; from the jellies, the drifters.
  const radiated: LifeNode[] = [];
  STEM_WAYS.forEach((way, i) => {
    const genome = evolve(worm, way, seaEnv, 100 + i, 7),
      body = develop(genome, WAYS[way].level);
    radiated.push(
      add({
        parent: firstWorm.id,
        kind: "stem",
        name: stemName(way, body, names),
        what: `${creatureWords(body, wayWord(way))}: one of the dawn's new bodies`,
        species: null,
        way,
        from: radiation - Math.round(30 * u(1, i, 0)),
        to: null,
        arose: -1,
        died: null,
        genome,
        body,
        innovations: innovations(worm, genome, way, seaEnv),
        fate: null,
        origin: -1,
        warm: sea,
      }),
    );
  });
  {
    const genome = evolve(jelly, "drifter", seaEnv, 110, 4),
      body = develop(genome, 2);
    radiated.push(
      add({
        parent: firstJelly.id,
        kind: "stem",
        name: stemName("drifter", body, names),
        what: `${creatureWords(body, "drifter")}: one of the dawn's new bodies`,
        species: null,
        way: "drifter",
        from: radiation - Math.round(30 * u(1, 9, 0)),
        to: null,
        arose: -1,
        died: null,
        genome,
        body,
        innovations: innovations(jelly, genome, "drifter", seaEnv),
        fate: null,
        origin: -1,
        warm: sea,
      }),
    );
  }

  // Ashore, in the first age: plants first, then the swimmers' and the crawlers' kin.
  const [first0] = ageSpan(0),
    landEnv = envOf(g.planet.meanTemperature + 2, 900, 0, 0.1);
  const landPlants = add({
    parent: weed.id,
    kind: "plant",
    name: "the first land plants",
    what: "low green mats and stalks on the wet ground: the first life on land",
    species: null,
    way: "growing in the light",
    from: first0 - 2,
    to: null,
    arose: 0,
    died: null,
    genome: null,
    body: null,
    innovations: [
      {
        what: "it grew stalks that held water",
        pressure: null,
        why: "out of the water, in the light",
      },
    ],
    fate: null,
    origin: -1,
    warm: landEnv.warmth,
  });
  const ashore: LifeNode[] = [];
  (
    [
      [radiated[0]!, "walker"],
      [radiated[1]!, "land crawler"],
    ] as const
  ).forEach(([mother, way], i) => {
    const genome = evolve(mother.genome!, way, landEnv, 200 + i, 8),
      body = develop(genome, 2);
    ashore.push(
      add({
        parent: mother.id,
        kind: "stem",
        name: stemName(way, body, names),
        what: `${creatureWords(body, wayWord(way))}: among the first to live on land`,
        species: null,
        way,
        from: first0 - 5 - Math.round(8 * u(2, i, 0)),
        to: null,
        arose: 0,
        died: null,
        genome,
        body,
        innovations: innovations(mother.genome!, genome, way, landEnv),
        fate: null,
        origin: -1,
        warm: landEnv.warmth,
      }),
    );
  });
  const forests = add({
    parent: landPlants.id,
    kind: "plant",
    name: "the first forests",
    what: "trees of wood standing tall over the wet lowlands",
    species: null,
    way: "growing in the light",
    from: ageSpan(1)[0] - 3,
    to: null,
    arose: 1,
    died: null,
    genome: null,
    body: null,
    innovations: [
      { what: "it grew wood", pressure: null, why: "to stand above the rest in the light" },
    ],
    fate: null,
    origin: -1,
    warm: landEnv.warmth,
  });

  const rungs: Rung[] = [
    {
      id: "replicators",
      name: "The first replicators",
      at: first,
      node: replicators.id,
      words: replicators.what,
    },
    { id: "cells", name: "The first cells", at: cells.from, node: cells.id, words: cells.what },
    { id: "light", name: "Life eats light", at: light.from, node: light.id, words: light.what },
    {
      id: "air",
      name: "The air fills with oxygen",
      at: early(0.4),
      node: null,
      words:
        "the light-eaters' breath gathered in the seas and the air, and the world's iron rusted red",
    },
    {
      id: "nucleus",
      name: "Cells with a nucleus",
      at: nucleus.from,
      node: nucleus.id,
      words: nucleus.what,
    },
    {
      id: "together",
      name: "Cells together",
      at: together.from,
      node: together.id,
      words: together.what,
    },
    {
      id: "bodies",
      name: "The first bodies",
      at: bodiesAt,
      node: firstWorm.id,
      words: firstWorm.what,
    },
    {
      id: "radiation",
      name: "The great radiation",
      at: radiation,
      node: radiated[0]!.id,
      words:
        "in a few tens of millions of years the sea filled with new bodies: swimmers, crawlers, burrowers, drifters",
    },
    {
      id: "ashore",
      name: "Life comes ashore",
      at: landPlants.from,
      node: landPlants.id,
      words: "plants and then animals left the water for the land",
    },
  ];

  // —— The ages.
  const bodied = (n: LifeNode) => n.genome !== null && n.kind !== "people",
    /** Whether a line was alive at a moment (millions of years ago), arisen before it. */
    aliveAt = (n: LifeNode, my: number) =>
      n.from > my + 0.5 && (n.to === null || n.to < my) && (n.kind !== "dawn" || n.genome !== null),
    huntedAt = (my: number) => {
      let all = 0,
        hunters = 0;
      for (const n of nodes)
        if (bodied(n) && aliveAt(n, my)) {
          all++;
          if ((n.body?.level ?? 0) >= 3) hunters++;
        }
      return all ? hunters / all : 0;
    };
  const fromIn = (k: number, key: number) => {
    const [a, b] = ageSpan(k);
    return Math.round(a - (a - b) * (0.1 + 0.75 * u(3, key, k)));
  };
  const toIn = (k: number, key: number, from: number) => {
    const [a, b] = ageSpan(k),
      t = Math.round(b + (a - b) * 0.8 * u(4, key, k));
    return Math.max(0, Math.min(t, from - 1));
  };
  const fateOf = (k: number, warm: number): string => {
    const age = ages[k]!,
      [a, b] = ageSpan(k),
      when = `${a}–${b} million years ago`;
    return age.kind === "impact"
      ? `the great stone that fell, ${when}`
      : age.kind === "great volcanism"
        ? `the floods of fire, ${when}`
        : age.kind === "icehouse" && warm > 14
          ? `the icehouse's cold, ${when}`
          : age.kind === "hothouse" && warm < 8
            ? `the hothouse's heat, ${when}`
            : `outlived by its kin, ${when}`;
  };
  /** The line nearest a genome among those alive at a moment, with what it costs to reach. */
  const nearest = (
    target: Genome,
    my: number,
    key: number,
    bias: (n: LifeNode) => number = () => 0,
  ): { mother: LifeNode; cost: number } => {
    let mother: LifeNode = ashore[0]!,
      cost = Infinity;
    for (const n of nodes) {
      if (!bodied(n) || n.kind === "dawn" || !aliveAt(n, my)) continue;
      const c = distance(n.genome!, target) + bias(n) + 0.25 * u(5, key, n.id);
      if (c < cost) [mother, cost] = [n, c];
    }
    return { mother, cost };
  };

  // The kinds of body among the lineages the biosphere holds, each a founder line arising an
  // age or two before its first lineage.
  const order = species
    .filter((s) => s.niche !== "upright ape")
    .sort((a, b) => a.arose - b.arose || a.index - b.index);
  const kinds = new Map<string, Species[]>();
  for (const s of order) {
    if (!s.body) continue;
    const kind = kindOfBody(encode(s.body, null));
    kinds.set(kind, [...(kinds.get(kind) ?? []), s]);
  }
  const founders = new Map<string, LifeNode>(),
    founding = [...kinds.entries()]
      .map(([kind, members], i) => ({
        kind,
        members,
        age: Math.max(
          0,
          members[0]!.arose - 1 - (members[0]!.arose >= 3 && u(6, i, 0) < 0.4 ? 1 : 0),
        ),
        key: i,
      }))
      .sort((a, b) => a.age - b.age || a.key - b.key);
  const found = (f: (typeof founding)[number]) => {
    const m = f.members,
      many = <T>(pick: (s: Species) => T): T => {
        const counts = new Map<T, number>();
        for (const s of m) counts.set(pick(s), (counts.get(pick(s)) ?? 0) + 1);
        let best = pick(m[0]!),
          most = 0;
        for (const [v, c] of counts) if (c > most) [best, most] = [v, c];
        return best;
      },
      bodies = m.map((s) => s.body!),
      mean = (x: (b: CreatureBody) => number) =>
        bodies.reduce((a, b) => a + x(b), 0) / bodies.length,
      way = many((s) => s.niche) as Way,
      grows = GROWTHS.filter(
        (f) => bodies.filter((b) => b.features.includes(f)).length >= 0.6 * bodies.length,
      ),
      warm = Math.round(m.reduce((a, s) => a + s.warm, 0) / m.length),
      rain = m.reduce((a, s) => a + (s.rainMin + s.rainMax) / 2, 0) / m.length,
      from =
        f.age === 0
          ? Math.min(fromIn(0, 500 + f.key), Math.min(...ashore.map((a) => a.from)) - 2)
          : fromIn(f.age, 500 + f.key),
      template: Genome = {
        ...encode(bodies[0]!, null),
        segments: many((s) => s.body!.segments),
        legs: many((s) => s.body!.legs) / 2,
        fins: many((s) => s.body!.fins) / 2,
        wings: many((s) => s.body!.wings) / 2,
        skin: many((s) => s.body!.covering),
        // Founders were small: a fraction of their heirs' middle weight.
        mass: roundMass(
          dmath.pow(
            10,
            mean((b) => dmath.log10(Math.max(1e-6, b.size))),
          ) *
            (0.15 + 0.3 * u(7, f.key, 0)),
        ),
        neck: clamp01(mean((b) => b.neck)),
        tail: clamp01(mean((b) => b.tail)),
        gait: many((s) => encode(s.body!, null).gait),
        grows,
        diet: WAYS[way].diet,
      };
    const { mother } = nearest(template, from, 600 + f.key, (n) => (n.kind === "ghost" ? 1 : 0));
    const genome: Genome = {
        ...template,
        eyes: mother.genome!.eyes || (WAYS[way].hunter || template.wings ? 2 : 0),
        feelers: mother.genome!.feelers,
        pattern: mother.genome!.pattern,
      },
      body = develop(genome, WAYS[way].level),
      env = envOf(warm, rain, f.age, huntedAt(from)),
      t = Math.min(from, mother.from - 1);
    founders.set(
      f.kind,
      add({
        parent: mother.id,
        kind: "stem",
        name: founderName(genome, names),
        what: `${creatureWords(body, wayWord(way))}: the first of its kind`,
        species: null,
        way,
        from: t,
        to: null,
        arose: ageAt(t),
        died: null,
        genome,
        body,
        innovations: innovations(mother.genome!, genome, way, env),
        fate: null,
        origin: m[0]!.origin,
        warm,
      }),
    );
  };

  /** A lineage the biosphere holds joins the tree: within its kind, to the line nearest its body. */
  const join = (s: Species, k: number) => {
    const body = s.body!,
      way = s.niche as Way,
      kind = kindOfBody(encode(body, null)),
      founder = founders.get(kind)!,
      from = Math.min(fromIn(k, s.index), founder.from - 1),
      env = envOf(s.warm, (s.rainMin + s.rainMax) / 2, k, huntedAt(from));
    // (Of its own kind first: another kind's line must be much nearer to be its mother.)
    const { mother } = nearest(encode(body, founder.genome), from, s.index, (n) =>
      n.id === founder.id ||
      (n.genome && kindOfBody(n.genome) === kind && n.kind !== "dawn" && n.from < founder.from + 1)
        ? (n.way === s.niche ? -0.5 : 0) + 0.04 * Math.abs(n.warm - s.warm)
        : 3,
    );
    let target = encode(body, mother.genome);
    // (Eyes come with the hunt and the air where the mother had none.)
    if (target.eyes === 0 && (WAYS[way].hunter || body.wings > 0)) target = { ...target, eyes: 2 };
    add({
      ref: s.ref,
      parent: mother.id,
      kind: "crown",
      name: s.name,
      what: creatureWords(body, s.niche),
      species: s.index,
      way: s.niche,
      from: Math.min(from, mother.from - 1),
      to: s.died === null ? null : toIn(s.died, 3000 + s.index, Math.min(from, mother.from - 1)),
      arose: k,
      died: s.died,
      genome: target,
      body,
      innovations: innovations(mother.genome!, target, way, env),
      fate: s.died === null ? null : fateOf(s.died, s.warm),
      origin: s.origin,
      warm: s.warm,
    });
  };

  /** A grass joins the green line: from the first grasses, or a grass before it. */
  const plantKin: LifeNode[] = [];
  let firstGrasses: LifeNode | null = null;
  const joinGrass = (s: Species, k: number) => {
    if (!firstGrasses) {
      const at = Math.max(1, k - 1);
      firstGrasses = add({
        parent: forests.id,
        kind: "plant",
        name: "the first grasses",
        what: "low plants of the open ground, growing again from the root when eaten",
        species: null,
        way: "growing in the light",
        from: Math.min(fromIn(at, 4000 + s.index), forests.from - 1),
        to: null,
        arose: at,
        died: null,
        genome: null,
        body: null,
        innovations: [
          {
            what: "it grew from the root, not the tip",
            pressure: null,
            why: "eaten down by the grazers and growing again",
          },
        ],
        fate: null,
        origin: s.origin,
        warm: s.warm,
      });
    }
    let mother: LifeNode = firstGrasses;
    const from0 = fromIn(k, 5000 + s.index);
    for (const p of plantKin)
      if (
        p.from > from0 + 0.5 &&
        (p.to === null || p.to < from0) &&
        Math.abs(p.warm - s.warm) < Math.abs(mother.warm - s.warm)
      )
        mother = p;
    const from = Math.min(from0, mother.from - 1);
    plantKin.push(
      add({
        ref: s.ref,
        parent: mother.id,
        kind: "crown",
        name: s.name,
        what: s.tame ? "a grass whose heavy seed can be sown" : "a grass of the open country",
        species: s.index,
        way: "growing in the light",
        from,
        to: s.died === null ? null : toIn(s.died, 6000 + s.index, from),
        arose: k,
        died: s.died,
        genome: null,
        body: null,
        innovations: [
          {
            what:
              s.seed > 0.45
                ? "its seed grew heavy"
                : "its seed stayed light, scattered by the wind",
            pressure: null,
            why: s.seed > 0.45 ? "seed enough to start again after a hard year" : "spreading far",
          },
        ],
        fate: s.died === null ? null : fateOf(s.died, s.warm),
        origin: s.origin,
        warm: s.warm,
      }),
    );
  };

  /** The lines that left no living descendant: bred forward from the lines of their age. */
  const ghosts = (k: number) => {
    const count = 1 + Math.floor(u(10, k, 0) * 3);
    for (let i = 0; i < count; i++) {
      const key = 7000 + k * 8 + i,
        from = fromIn(k, key),
        mothers = nodes.filter((n) => bodied(n) && aliveAt(n, from) && n.kind !== "dawn");
      if (!mothers.length) return;
      const mother = mothers[Math.floor(u(11, k, i) * mothers.length)]!,
        land: Way[] = [
          "grazer",
          "browser",
          "great beast",
          "seed-eater",
          "small hunter",
          "scavenger",
          "hunter",
        ],
        own = mother.way in WAYS ? (mother.way as Way) : null,
        ways: Way[] =
          own && u(12, k, i) < 0.45
            ? [own]
            : own && WAYS[own].sea && u(12, k, i) < 0.75
              ? ["swimmer", "drifter", "sea crawler"]
              : [...land, "swimmer"],
        way = ways[Math.floor(u(13, k, i) * ways.length)]!,
        warm = mother.warm + Math.round((u(14, k, i) - 0.5) * 12),
        env = envOf(warm, 900, k, huntedAt(from)),
        genome = evolve(mother.genome!, way, env, 300 + k * 8 + i, 3 + Math.floor(u(15, k, i) * 3)),
        body = develop(genome, WAYS[way].level),
        start = Math.min(from, mother.from - 1);
      // It dies out within a few ages, at the first great dying if one comes.
      let died = Math.min(AGES - 1, k + 1 + Math.floor(u(16, k, i) * 3));
      for (let d = k + 1; d <= died; d++)
        if (ages[d]!.kind === "impact" || ages[d]!.kind === "great volcanism") {
          died = d;
          break;
        }
      add({
        parent: mother.id,
        kind: "ghost",
        name: uniqueName(names, body, way, warm, u(17, k, i)),
        what: creatureWords(body, wayWord(way)),
        species: null,
        way,
        from: start,
        to: toIn(died, 8000 + k * 8 + i, start),
        arose: ageAt(start),
        died,
        genome,
        body,
        innovations: innovations(mother.genome!, genome, way, env),
        fate: fateOf(died, warm),
        origin: mother.origin,
        warm,
      });
    }
  };

  for (let k = 0; k < AGES; k++) {
    for (const f of founding) if (f.age === k) found(f);
    for (const s of order) {
      if (s.arose !== k) continue;
      if (s.niche === "seed grass") joinGrass(s, k);
      else if (s.body) join(s, k);
    }
    if (k >= 1) ghosts(k);
  }

  // The people: from the line nearest their body, through their forebears.
  const people = g.life.people;
  if (people) {
    const s = species[people.species]!,
      k = AGES - 1,
      genome = peopleGenome(people.body),
      from = Math.round(ageSpan(k)[0] * (0.25 + 0.2 * u(18, 0, 0))),
      forebearsFrom = Math.round(ageSpan(k - 1)[0] - 10 * u(18, 0, 1)),
      // (Earth's own came of the furred four-legged beasts, by way of the tree-climbers.)
      { mother } = nearest(genome, forebearsFrom, 9000, (n) =>
        n.kind === "ghost"
          ? 2
          : g.prior === "earthlike" && n.kind === "stem" && n.genome?.skin === "fur"
            ? -4
            : n.genome && kindOfBody(n.genome) === kindOfBody(genome)
              ? -1
              : 0,
      ),
      steps = changes(mother.genome!, genome);
    let mid = mother.genome!;
    for (const [i, c] of steps.entries()) if (i % 2 === 0) mid = c.apply(mid);
    const midBody = develop(mid, 3),
      start = Math.min(forebearsFrom, mother.from - 1),
      envFore = envOf(s.warm, 1000, ageAt(start), huntedAt(start)),
      forebear = add({
        parent: mother.id,
        kind: "ghost",
        name: `the forebears of the ${people.body.name}`,
        what: `${creatureWords(midBody, "forager")}: the line the ${people.body.name} came of`,
        species: null,
        way: "forager",
        from: start,
        to: null,
        arose: ageAt(start),
        died: null,
        genome: mid,
        body: midBody,
        innovations: innovations(mother.genome!, mid, "walker", envFore),
        fate: `lived on as the ${people.body.name}`,
        origin: people.cell,
        warm: s.warm,
      });
    add({
      ref: s.ref,
      parent: forebear.id,
      kind: "people",
      name: people.body.name,
      what: `the people: ${people.because}`,
      species: s.index,
      way: "thought",
      from: Math.min(from, forebear.from - 1),
      to: null,
      arose: k,
      died: null,
      genome,
      body: develop(genome, 3),
      innovations: [
        ...innovations(mid, genome, "walker", envOf(s.warm, 1000, k, huntedAt(from))),
        {
          what: "it came to speak, to make and to remember",
          pressure: null,
          why: people.because,
        },
      ],
      fate: null,
      origin: people.cell,
      warm: s.warm,
    });
  }

  // Each line's daughters, oldest first.
  const children: number[][] = nodes.map(() => []);
  for (const n of nodes) if (n.parent >= 0) children[n.parent]!.push(n.id);
  for (const c of children) c.sort((a, b) => nodes[b]!.from - nodes[a]!.from || a - b);
  return { nodes, ofSpecies, rungs, worldAge, children };
}

/** The body a people's own plan would have, as a creature's genome. */
export function peopleGenome(b: BodyPlan): Genome {
  const radial = b.symmetry === "radial",
    legs = radial ? 0 : b.clade === "burrower" || b.clade === "shore" ? 3 : 2;
  return {
    axis: b.symmetry,
    segments: legs >= 3 ? 2 : 1,
    legs,
    fins: b.medium === "water" && !radial ? 1 : 0,
    wings: 0,
    skin:
      b.skin === "skin"
        ? "slick"
        : b.skin === "fur"
          ? "fur"
          : b.skin === "feathers"
            ? "feathers"
            : b.skin === "scales"
              ? "scales"
              : "shell",
    mass: b.size,
    neck: 0.3,
    tail: b.clade === "crawler" ? 0.6 : 0.1,
    warm: b.warm,
    gait: "walk",
    grows: b.manipulators === "trunk" ? ["trunk"] : b.manipulators === "claws" ? ["claws"] : [],
    eyes: b.senses.includes("sight") ? 2 : 0,
    feelers: b.manipulators === "mandibles",
    pattern: "plain",
    diet:
      b.diet === "plants"
        ? "leaves"
        : b.diet === "flesh"
          ? "flesh"
          : b.diet === "filter"
            ? "plankton"
            : "seeds",
  };
}

/** A way of life in words, for a body's description. */
export function wayWord(way: string): string {
  return way === "sea swimmer"
    ? "swimmer of the dawn seas"
    : way === "sea crawler"
      ? "crawler of the sea floor"
      : way === "land crawler"
        ? "crawler of the land"
        : way;
}

const LIMB_WORDS = (b: CreatureBody) =>
  b.symmetry === "radial"
    ? "star-shaped"
    : b.legs >= 6
      ? "jointed"
      : b.fins && !b.legs
        ? "finned"
        : b.legs
          ? `${["", "two", "four", "six", "eight"][b.legs / 2]}-legged`
          : "soft";

/** A stem's name, from its way and its body. */
function stemName(way: Way, b: CreatureBody, names: Set<string>): string {
  const limbs = LIMB_WORDS(b);
  const name =
    way === "sea swimmer"
      ? `the first ${limbs} swimmers`
      : way === "sea crawler"
        ? `the first ${limbs} crawlers of the sea floor`
        : way === "burrower"
          ? `the ${limbs} burrowers of the mud`
          : way === "drifter"
            ? `the ${limbs} drifters`
            : way === "walker"
              ? `the first ${limbs} walkers`
              : way === "land crawler"
                ? `the first ${limbs} crawlers of the land`
                : `the first ${way}s`;
  return unique(names, name);
}

const SKIN_ADJ: Readonly<Record<Covering, string>> = {
  fur: "furred",
  wool: "woolly",
  feathers: "feathered",
  scales: "scaled",
  shell: "shelled",
  plates: "plated",
  slick: "slick-skinned",
};

/** A founder's name, from the kind of body it began: "the first furred four-legged beasts". */
function founderName(g: Genome, names: Set<string>): string {
  const skin = SKIN_ADJ[g.skin],
    name =
      g.axis === "radial"
        ? `the first ${skin} star-drifters`
        : g.fins > 0 && g.legs === 0
          ? `the first ${skin} swimmers`
          : g.wings > 0
            ? `the first ${skin} fliers`
            : g.legs >= 3
              ? `the first ${skin} many-legged crawlers`
              : g.legs === 2
                ? `the first ${skin} four-legged beasts`
                : g.legs === 1
                  ? `the first ${skin} two-legged striders`
                  : `the first ${skin} slitherers`;
  return unique(
    names,
    `${name}${g.warm && g.skin !== "fur" && g.skin !== "wool" && g.skin !== "feathers" ? " of warm blood" : ""}`,
  );
}

function unique(names: Set<string>, name: string): string {
  if (!names.has(name)) return name;
  for (let q = 2; ; q++) if (!names.has(`${name} (${roman(q)})`)) return `${name} (${roman(q)})`;
}

function roman(n: number): string {
  return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] ?? String(n);
}

const COLOURS = ["dun", "red", "grey", "black", "pale", "brindled", "spotted", "golden"];
const KINDS = [
  "lesser",
  "greater",
  "early",
  "late",
  "small",
  "great",
  "long-tailed",
  "short-tailed",
];

/** A name of its own for a line the tree alone remembers, from its body. */
function uniqueName(
  names: Set<string>,
  b: CreatureBody,
  way: Way,
  warm: number,
  v: number,
): string {
  const niche: CreatureNiche =
      way in FOOD_WEB
        ? (way as CreatureNiche)
        : way === "walker"
          ? "browser"
          : way === "land crawler" || way === "sea crawler"
            ? "small hunter"
            : "swimmer",
    home = { warm, rain: 900 };
  let name = creatureName(b, niche, home, false, v);
  for (let t = 1; t < COLOURS.length && names.has(name); t++)
    name = creatureName(b, niche, home, false, (v + t / COLOURS.length) % 1);
  for (let q = 0; q < KINDS.length && names.has(name); q++)
    name = `${KINDS[q]} ${creatureName(b, niche, home, false, v)}`;
  return unique(names, name);
}

/** A line's ancestry, the root first. */
export function lineOf(tree: TreeOfLife, id: number): LifeNode[] {
  const out: LifeNode[] = [];
  for (
    let n: LifeNode | undefined = tree.nodes[id];
    n;
    n = n.parent >= 0 ? tree.nodes[n.parent] : undefined
  )
    out.push(n);
  return out.reverse();
}

/** A line's descendants (itself not among them), each once. */
export function descendantsOf(tree: TreeOfLife, id: number): number[] {
  const out: number[] = [],
    stack = [...(tree.children[id] ?? [])];
  while (stack.length) {
    const c = stack.pop()!;
    out.push(c);
    stack.push(...(tree.children[c] ?? []));
  }
  return out.sort((a, b) => a - b);
}

/** Whether a line lives, or lives on in a living daughter. */
export function livesOn(tree: TreeOfLife, id: number): boolean {
  const n = tree.nodes[id]!;
  if (n.died === null && n.to === null && (n.kind === "crown" || n.kind === "people")) return true;
  return (tree.children[id] ?? []).some((c) => livesOn(tree, c));
}

/** Where a line's own span ends on the chart: now, its death, or its last daughter's beginning. */
export function endOf(tree: TreeOfLife, id: number): number {
  const n = tree.nodes[id]!;
  if (n.kind === "crown" || n.kind === "people") return n.to ?? 0;
  if (n.to !== null) return n.to;
  const kids = tree.children[id] ?? [];
  if (!kids.length) return 0;
  let end = n.from;
  for (const c of kids) end = Math.min(end, tree.nodes[c]!.from);
  return end;
}
