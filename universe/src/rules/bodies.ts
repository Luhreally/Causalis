// The body-plan grammar (docs/architecture §17, Phase 4 M36), as data and laws. The
// lineage that rises to thought is one of a handful of clades — each a way a body can
// be built: its medium, its symmetry, what it handles the world with, its skin, its
// blood, what it eats, how it bears its young, how long it lives, how it lives together.
// A world's conditions weigh which clade rises (its cold, its heat, its pull, its seas);
// within the clade, the world's pull and warmth and the draw of chance set the body's
// size and span. From the body, by simple laws, its affordances: what it can do.
import { dmath } from "../kernel/index.ts";

export type Medium = "land" | "shore" | "water";
export type Manipulator = "hands" | "tentacles" | "claws" | "trunk" | "mandibles";
export type Sense = "sight" | "hearing" | "smell" | "echo" | "electric";
export type Skin = "skin" | "fur" | "feathers" | "scales" | "shell";
export type Diet = "plants" | "flesh" | "both" | "filter";
export type Bearing = "live" | "eggs" | "spawn";

export type BodyPlan = {
  /** The clade, and what its people are called in words ("upright apes"). */
  readonly clade: string;
  readonly name: string;
  readonly medium: Medium;
  readonly symmetry: "bilateral" | "radial";
  /** Body weight, kg. */
  readonly size: number;
  readonly manipulators: Manipulator;
  /** How many limbs it handles things with. */
  readonly limbs: number;
  readonly senses: readonly Sense[];
  readonly skin: Skin;
  /** Warm-blooded. */
  readonly warm: boolean;
  readonly diet: Diet;
  readonly bearing: Bearing;
  /** Young at a birth (or a spawning's that live past their first days). */
  readonly young: number;
  /** The longest a life runs, years. */
  readonly span: number;
  /** How closely they live together, 0 (alone) to 1 (a hive). */
  readonly social: number;
};

/** What a world offers the clades: its warmth where life is richest, its pull, its seas. */
export type Conditions = {
  /** The cradle's mean warmth, °C, and its rain, mm. */
  readonly warmth: number;
  readonly rain: number;
  /** Surface gravity, in g. */
  readonly gravity: number;
  /** The share of the world under sea. */
  readonly ocean: number;
};

export type Clade = {
  readonly id: string;
  readonly body: Omit<BodyPlan, "size" | "span" | "young"> & {
    /** Middle size (kg), span (years) and young at a birth, before the world and chance vary them. */
    readonly size: number;
    readonly span: number;
    readonly young: number;
  };
  /** How well the clade suits a world (0: it cannot rise there), and in words why. */
  readonly fit: (c: Conditions) => number;
  readonly because: (c: Conditions) => string;
};

const band = (x: number, lo: number, hi: number, soft: number) =>
  x < lo ? Math.max(0, 1 - (lo - x) / soft) : x > hi ? Math.max(0, 1 - (x - hi) / soft) : 1;

export const CLADES: readonly Clade[] = [
  {
    id: "ape",
    body: {
      clade: "ape",
      name: "upright apes",
      medium: "land",
      symmetry: "bilateral",
      size: 60,
      manipulators: "hands",
      limbs: 2,
      senses: ["sight", "hearing"],
      skin: "skin",
      warm: true,
      diet: "both",
      bearing: "live",
      young: 1,
      span: 70,
      social: 0.8,
    },
    fit: (c) => band(c.warmth, 14, 28, 10) * band(c.gravity, 0.7, 1.3, 0.4),
    because: () =>
      "on open, mild country between woodland and grass, hands freed by walking upright",
  },
  {
    id: "strider",
    body: {
      clade: "strider",
      name: "feathered striders",
      medium: "land",
      symmetry: "bilateral",
      size: 40,
      manipulators: "hands",
      limbs: 2,
      senses: ["sight", "hearing"],
      skin: "feathers",
      warm: true,
      diet: "both",
      bearing: "eggs",
      young: 3,
      span: 50,
      social: 0.6,
    },
    fit: (c) =>
      band(c.warmth, 4, 26, 10) * band(c.gravity, 0.5, 1.2, 0.4) * (c.rain < 900 ? 1 : 0.5),
    because: () => "on wide, dry plains, where keen eyes and long legs found food far apart",
  },
  {
    id: "crawler",
    body: {
      clade: "crawler",
      name: "scaled crawlers",
      medium: "land",
      symmetry: "bilateral",
      size: 80,
      manipulators: "claws",
      limbs: 2,
      senses: ["smell", "sight"],
      skin: "scales",
      warm: false,
      diet: "flesh",
      bearing: "eggs",
      young: 8,
      span: 60,
      social: 0.5,
    },
    fit: (c) => band(c.warmth, 22, 40, 8) * band(c.gravity, 0.6, 1.8, 0.5),
    because: () => "in hot country, where cold blood costs little and the sun warms it",
  },
  {
    id: "burrower",
    body: {
      clade: "burrower",
      name: "six-limbed burrowers",
      medium: "land",
      symmetry: "bilateral",
      size: 25,
      manipulators: "mandibles",
      limbs: 2,
      senses: ["smell", "hearing"],
      skin: "shell",
      warm: false,
      diet: "both",
      bearing: "eggs",
      young: 6,
      span: 35,
      social: 0.95,
    },
    fit: (c) => band(c.gravity, 1.2, 3, 0.4) * band(c.warmth, 10, 38, 10),
    because: (c) =>
      `under a heavy pull (${c.gravity.toFixed(1)} g), where small, low, many-legged bodies bear their weight and the ground shelters them`,
  },
  {
    id: "trunk",
    body: {
      clade: "trunk",
      name: "trunked giants",
      medium: "land",
      symmetry: "bilateral",
      size: 900,
      manipulators: "trunk",
      limbs: 1,
      senses: ["hearing", "smell"],
      skin: "skin",
      warm: true,
      diet: "plants",
      bearing: "live",
      young: 1,
      span: 80,
      social: 0.9,
    },
    fit: (c) => band(c.gravity, 0.3, 0.8, 0.3) * band(c.rain, 800, 4000, 600),
    because: (c) =>
      `under a light pull (${c.gravity.toFixed(1)} g) in green country, where great plant-eaters grew greater`,
  },
  {
    id: "shaggy",
    body: {
      clade: "shaggy",
      name: "shaggy climbers",
      medium: "land",
      symmetry: "bilateral",
      size: 45,
      manipulators: "hands",
      limbs: 4,
      senses: ["sight", "smell"],
      skin: "fur",
      warm: true,
      diet: "both",
      bearing: "live",
      young: 2,
      span: 55,
      social: 0.7,
    },
    fit: (c) => band(c.warmth, -10, 10, 8) * band(c.gravity, 0.5, 1.4, 0.4),
    because: () => "in cold forests, where thick fur and four grasping limbs kept to the trees",
  },
  {
    id: "swimmer",
    body: {
      clade: "swimmer",
      name: "many-armed swimmers",
      medium: "water",
      symmetry: "radial",
      size: 30,
      manipulators: "tentacles",
      limbs: 8,
      senses: ["sight", "electric"],
      skin: "skin",
      warm: false,
      diet: "flesh",
      bearing: "spawn",
      young: 40,
      span: 30,
      social: 0.4,
    },
    fit: (c) => band(c.ocean, 0.6, 1, 0.2) * band(c.warmth, 8, 32, 10),
    because: (c) =>
      `in the shallow seas of a world mostly water (${Math.round(c.ocean * 100)}% of it), where many clever arms found their food on the reefs`,
  },
  {
    id: "shore",
    body: {
      clade: "shore",
      name: "shelled shore-walkers",
      medium: "shore",
      symmetry: "bilateral",
      size: 20,
      manipulators: "claws",
      limbs: 2,
      senses: ["sight", "smell"],
      skin: "shell",
      warm: false,
      diet: "both",
      bearing: "eggs",
      young: 20,
      span: 30,
      social: 0.6,
    },
    fit: (c) => band(c.ocean, 0.5, 0.95, 0.2) * band(c.warmth, 12, 34, 8),
    because: () => "between tide and dune, where the sea's plenty meets the dry land",
  },
];

/** The body a clade grows into on a world: bigger under a light pull, smaller under a heavy, and as chance draws. */
export function bodyOf(clade: Clade, c: Conditions, u: readonly number[]): BodyPlan {
  const b = clade.body,
    pull = Math.max(0.3, c.gravity);
  return {
    ...b,
    size: Math.round(b.size * dmath.pow(pull, -0.75) * (0.8 + 0.4 * (u[0] ?? 0.5))),
    span: Math.round(b.span * (0.85 + 0.3 * (u[1] ?? 0.5))),
    young: Math.max(1, Math.round(b.young * (0.8 + 0.4 * (u[2] ?? 0.5)))),
  };
}

/** What a body can do, 0..1 unless said (1 = as an upright ape does, for most). */
export type Affordances = {
  /** How finely it handles things: tools, knots, script. */
  readonly dexterity: number;
  /** Its strength against an upright ape's. */
  readonly strength: number;
  /** How long it can keep working or walking. */
  readonly endurance: number;
  /** Whether it can kindle and keep a fire (not in the water). */
  readonly fire: boolean;
  /** How far it sees. */
  readonly sight: number;
  /** How well it bears cold and heat. */
  readonly cold: number;
  readonly heat: number;
  /** How it moves on land and in water. */
  readonly land: number;
  readonly water: number;
  /** Young a mother bears in a year of her prime, against an upright ape's. */
  readonly fecundity: number;
};

const HANDLING: Readonly<Record<Manipulator, number>> = {
  hands: 1,
  tentacles: 0.9,
  trunk: 0.6,
  claws: 0.45,
  mandibles: 0.5,
};

/** The handling a body needs to strike and tend a fire (claws and a trunk will do; mandibles barely). */
const FIRE_HANDLING = 0.4;

/** A body's affordances, by laws a player could check. */
export function affordancesOf(b: BodyPlan): Affordances {
  const dexterity = Math.min(1, HANDLING[b.manipulators] * Math.min(1.1, 0.5 + b.limbs / 4));
  return {
    dexterity,
    strength: dmath.pow(b.size / 60, 2 / 3),
    endurance: b.warm ? 1 : 0.6,
    // Fire wants air to burn in and hands deft enough to strike and tend it.
    fire: b.medium !== "water" && dexterity >= FIRE_HANDLING,
    sight: b.senses.includes("sight") ? 1 : b.senses.includes("echo") ? 0.6 : 0.35,
    cold: b.warm && (b.skin === "fur" || b.skin === "feathers") ? 1 : b.warm ? 0.55 : 0.2,
    heat: b.skin === "scales" || b.skin === "shell" ? 1 : b.skin === "fur" ? 0.45 : 0.7,
    land: b.medium === "water" ? 0.1 : b.medium === "shore" ? 0.7 : 1,
    water: b.medium === "water" ? 1 : b.medium === "shore" ? 0.7 : 0.25,
    fecundity: Math.min(
      6,
      (b.young * (b.bearing === "spawn" ? 0.25 : b.bearing === "eggs" ? 0.6 : 1)) /
        (b.warm ? 1 : 1.3),
    ),
  };
}

/** A body in words: "upright apes: 60 kg, two hands, hairless skin, warm blood, eat plants and flesh, bear one young at a time, live some 70 years". */
export function bodyWords(b: BodyPlan): string {
  const count = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
  const limbs = `${count[b.limbs] ?? b.limbs} ${b.manipulators === "hands" ? (b.limbs === 1 ? "hand" : "hands") : b.manipulators === "trunk" ? "trunk" : b.manipulators}`,
    skin = b.skin === "skin" ? "bare skin" : b.skin === "shell" ? "a hard shell" : `${b.skin}`,
    diet = {
      plants: "eat plants",
      flesh: "eat flesh",
      both: "eat plants and flesh",
      filter: "sift their food from the water",
    }[b.diet],
    young =
      b.bearing === "live"
        ? `bear ${b.young === 1 ? "one young" : `${count[b.young] ?? b.young} young`} at a time`
        : b.bearing === "eggs"
          ? `lay ${count[b.young] ?? b.young} eggs at a time`
          : "spawn many young, few of whom live",
    where = { land: "on land", shore: "on the shore", water: "in the water" }[b.medium];
  return `${b.name}: ${b.symmetry === "radial" ? "radial" : "two-sided"} bodies of ${b.size} kg living ${where}, with ${limbs}, ${skin}, ${b.warm ? "warm" : "cold"} blood; they ${diet}, ${young}, and live some ${b.span} years`;
}
