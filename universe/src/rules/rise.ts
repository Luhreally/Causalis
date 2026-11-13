// Who rises to thought (B4 of the life plan, docs/architecture/asks-2026-11-12-plan.md Part B): no list of peoples. A
// lineage of a world read from its physics (rules/grammar.ts) qualifies by what its body and its life are:
//
// - something to handle the world with that is free while it stands (required: the owner's word, 2026-11-12, "peoples
//   can be anything physics allows, as long as they have a grasper", so every people can come to tools);
// - a signal to talk by: sound where its air or liquid carries it, colour and light where it sees, a current where its
//   liquid carries one, scent, touch;
// - living together (its herd);
// - power for a brain: a brain is costly (an estimate: a fifth of a body's resting power, as Earth's own takes), and
//   only a strong trade feeds one (breathing oxygen gives fifteen times what fermenting does);
// - a long childhood (slow to grow, time to learn);
// - a size in range (an estimate: from 2 kg, the least a brain to plan with is carried by, to 2 tonnes).
//
// The best rise, with chance, as before. Its people's body plan is read from its body: its graspers what it handles
// with, how many; its covering its skin; its place its medium; its blood, its food, its young and its span from its
// body. A world where none qualifies has no people and says why.
//
// Pure: the caller keys the draws. Under the Earthlike prior none of it is read (Earth's people are its upright apes).
import { dmath } from "../kernel/index.ts";
import type { BodyPlan, Manipulator, Sense, Skin } from "./bodies.ts";
import type { CreatureBody, Grasp } from "./creatures.ts";
import { PLACES, massFig, type LifeWorld, type Place } from "./grammar.ts";
import { sensesOf } from "./physiology.ts";

/** A lineage as rising asks of it. */
export type RiseCandidate = {
  readonly index: number;
  readonly name: string;
  readonly body: CreatureBody;
  /** How closely it lives together (0 … 1), and how quick it grows (0 … 1). */
  readonly herd: number;
  readonly growth: number;
};

/** How a lineage stands for rising: each need's weight (0: it lacks it), its score, what it lacks, how it would talk. */
export type RiseRead = {
  readonly index: number;
  readonly grasp: number;
  readonly signal: number;
  readonly power: number;
  readonly together: number;
  readonly childhood: number;
  readonly size: number;
  readonly place: number;
  readonly score: number;
  readonly talks: "sound" | "colour and light" | "current" | "scent" | "touch";
  readonly lacks: readonly string[];
};

/** How finely each grasper handles (a hand 1, as an upright ape's). */
export const GRASP_HANDLING: Readonly<Record<Grasp, number>> = {
  hand: 1,
  tentacle: 0.9,
  pincer: 0.55,
  trunk: 0.6,
  tail: 0.5,
  lip: 0.45,
};

/** The least power a kilogram of a body must get for a brain to pay (W, at 15 °C; an estimate). */
export const BRAIN_POWER = 0.9;

const band = (x: number, lo: number, hi: number, soft: number) =>
  x < lo ? Math.max(0, 1 - (lo - x) / soft) : x > hi ? Math.max(0, 1 - (x - hi) / soft) : 1;

/** The places a people can live in, and how well (the deep, the vents and the open air hold no hearth). */
const PLACE_FIT: Readonly<Record<Place, number>> = {
  "sunlit sea": 0.5,
  deep: 0,
  "sea floor": 0.6,
  vents: 0,
  shore: 1,
  river: 0.8,
  grassland: 1,
  woodland: 1,
  desert: 0.6,
  "cold land": 0.7,
  underground: 0.6,
  canopy: 0.9,
  air: 0.5,
  ice: 0.4,
  twilight: 1,
};

/** How a lineage stands for rising to thought on its world. */
export function riseRead(c: RiseCandidate, w: LifeWorld): RiseRead {
  const b = c.body,
    place = (b.place ?? "grassland") as Place,
    medium = PLACES[place]?.medium ?? "land",
    inLiquid = medium === "sea",
    senses = sensesOf({
      star: w.starK,
      pressure: w.pressure,
      liquid: w.conducts ? "water" : "oil",
    }),
    lit = PLACES[place]?.lit !== false && w.light >= 0.02,
    lacks: string[] = [];
  // Something to handle with, free while it stands.
  const grasp =
    (b.arms ?? 0) > 0 && b.grasp
      ? GRASP_HANDLING[b.grasp] * Math.min(1.1, 0.6 + (b.arms ?? 0) / 5)
      : 0;
  if (!grasp) lacks.push("nothing to grasp with that is free while it stands");
  // A signal.
  const options: [RiseRead["talks"], number][] = [
    ["sound", senses.hearing || inLiquid ? 1 : 0],
    ["colour and light", lit ? 0.8 : 0],
    ["current", inLiquid && w.conducts ? 0.7 : 0],
    ["scent", inLiquid ? 0.2 : 0.4],
    ["touch", 0.25],
  ];
  options.sort((x, y) => y[1] - x[1]);
  const [talks, signal] = options[0]!;
  // Power for a brain.
  const power = Math.max(0, Math.min(1, (w.eatPower15 - BRAIN_POWER) / 2));
  if (!power)
    lacks.push(
      `too little power for a brain (its eaters get ${w.eatPower15.toFixed(2)} W a kilogram, a brain wants ${BRAIN_POWER} or more)`,
    );
  const together = Math.max(0, (c.herd - 0.2) / 0.8);
  if (!together) lacks.push("it lives alone");
  const childhood = Math.max(0.05, 1.15 - c.growth);
  // (A brain to plan with wants a body of tens of kilograms: rising from 3 kg to full at 30, falling past two tonnes. An
  // estimate: Earth's makers of tools are 3 kg capuchins to 60 kg apes, its brainiest beasts to elephants.)
  const size =
    b.size < 3
      ? 0
      : b.size < 30
        ? dmath.log(b.size / 3) / dmath.log(10)
        : b.size <= 2000
          ? 1
          : Math.max(0, 1 - dmath.log(b.size / 2000) / dmath.log(3));
  if (!size)
    lacks.push(
      b.size < 2
        ? `too small (${massFig(b.size)}) to carry a brain to plan with (3 kg or more, an estimate)`
        : `too large (${massFig(b.size)})`,
    );
  const at = PLACE_FIT[place] ?? 0;
  if (!at) lacks.push(`it lives in ${PLACES[place]?.words ?? place}, where no hearth can be`);
  const level = b.level === 3 ? 1.2 : b.level >= 4 ? 1 : 0.85,
    score = grasp * signal * power * together * childhood * size * at * level;
  return {
    index: c.index,
    grasp,
    signal,
    power,
    together,
    childhood,
    size,
    place: at,
    score,
    talks,
    lacks,
  };
}

/** Why no lineage rose: what the nearest lacked, and whether any had a grasper. */
export function noneRoseWhy(
  reads: readonly RiseRead[],
  names: (i: number) => string,
  w: LifeWorld,
): string {
  if (!reads.length) return "no beast lives on it to rise";
  if (w.eatPower15 < BRAIN_POWER)
    return `no lineage rose to thought: its eaters run on too weak a trade (${w.eatPower15.toFixed(2)} W a kilogram) to feed a brain, which wants ${BRAIN_POWER} or more (an estimate)`;
  const graspers = reads.filter((r) => r.grasp > 0);
  if (!graspers.length)
    return "no lineage rose to thought: none of its beasts has a limb to grasp with that is free while it stands";
  const best = [...graspers].sort((a, b) => b.score - a.score || a.index - b.index)[0]!;
  if (best.lacks.length)
    return `no lineage rose to thought: of those with a grasper, the nearest, the ${names(best.index)}, ${best.lacks.join(", and ")}`;
  // (Nothing shut it out: what held it back most, its weakest two.)
  const weakest = (Object.keys(FACTOR_WORDS) as (keyof typeof FACTOR_WORDS)[])
    .map((k) => ({ k, v: best[k] }))
    .sort((a, b) => a.v - b.v || (a.k < b.k ? -1 : 1))
    .slice(0, 2)
    .map((x) => FACTOR_WORDS[x.k]);
  return `no lineage rose to thought: of those with a grasper, the nearest, the ${names(best.index)}, never came to it — ${weakest.join(", and ")}`;
}

/** What held a lineage back from rising, by each part of its reading. */
const FACTOR_WORDS = {
  grasp: "what it grasped with handled too coarsely",
  signal: "it could scarcely signal to its own kind",
  power: "its trade barely fed a brain",
  together: "it lived too much alone to learn from others",
  childhood: "its young were on their own too soon to be taught",
  size: "its body was of a size a brain scarcely pays in",
  place: "its place keeps no hearth",
} as const;

/** The least a lineage's rising score must be (else none rises). */
export const LEAST_RISE = 0.02;

const MANIP: Readonly<Record<Grasp, Manipulator>> = {
  hand: "hands",
  tentacle: "tentacles",
  pincer: "claws",
  trunk: "trunk",
  tail: "tentacles",
  lip: "mandibles",
};

const SKIN_OF: Readonly<Record<string, Skin>> = {
  fur: "fur",
  wool: "fur",
  feathers: "feathers",
  scales: "scales",
  shell: "shell",
  plates: "shell",
  slick: "skin",
};

const COUNT = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
const HOLD_WORD: Readonly<Record<Grasp, readonly [string, string]>> = {
  hand: ["handed", "hands"],
  tentacle: ["tentacled", "tentacles"],
  pincer: ["pincered", "pincers"],
  trunk: ["trunked", "a trunk"],
  tail: ["tail-gripping", "a gripping tail"],
  lip: ["lipped", "grasping lips"],
};
const SKIN_WORD: Readonly<Record<string, string>> = {
  fur: "furred",
  wool: "woolly",
  feathers: "feathered",
  scales: "scaled",
  shell: "shelled",
  plates: "plated",
  slick: "smooth-skinned",
};
const NOUN_OF: Partial<Record<string, string>> = {
  climb: "climbers",
  glide: "gliders",
  fly: "fliers",
  swim: "swimmers",
  jet: "jetters",
  drift: "drifters",
  crawl: "crawlers",
  burrow: "delvers",
  slither: "slitherers",
  hop: "hoppers",
  run: "runners",
  walk: "walkers",
  roll: "rollers",
  float: "floaters",
};

/** A risen people's name from its body: "four-handed furred climbers", "pincered six-legged shell-walkers". */
export function risenName(b: CreatureBody): string {
  const arms = b.arms ?? 0,
    hold = b.grasp ? HOLD_WORD[b.grasp] : ["", ""],
    armWord =
      b.grasp === "trunk" || b.grasp === "tail" || b.grasp === "lip"
        ? hold[0]
        : arms === 2
          ? `two-${hold[0].replace(/ed$/, "ed")}`
          : `${COUNT[arms] ?? arms}-${hold[0]}`,
    legWord =
      b.symmetry === "radial"
        ? `${COUNT[b.rays ?? 0] ?? b.rays}-rayed`
        : b.legs === 0
          ? b.wings
            ? "winged"
            : "legless"
          : `${COUNT[b.legs] ?? b.legs}-legged`,
    wing = b.wings && b.legs > 0 ? " winged" : "",
    noun = NOUN_OF[b.moves] ?? "folk";
  return `${armWord} ${legWord}${wing} ${SKIN_WORD[b.covering] ?? ""} ${noun}`
    .replace(/ +/g, " ")
    .trim();
}

/** A risen people's body plan, read from its lineage's body. `u` keyed on the people. */
/** The medium a people risen from a lineage of a place lives in: the water from the sea, the shore from a shore or a river, else the land. */
export function risenMedium(place: string | undefined): "water" | "shore" | "land" {
  const p = (place ?? "grassland") as Place,
    medium = PLACES[p]?.medium ?? "land";
  return medium === "sea" && p !== "river"
    ? "water"
    : p === "shore" || p === "river"
      ? "shore"
      : "land";
}

export function risenBody(c: RiseCandidate, w: LifeWorld, u: (k: number) => number): BodyPlan {
  const b = c.body,
    place = (b.place ?? "grassland") as Place,
    medium = PLACES[place]?.medium ?? "land",
    water = risenMedium(b.place),
    senses: Sense[] = [];
  const s = sensesOf({ star: w.starK, pressure: w.pressure, liquid: w.conducts ? "water" : "oil" });
  if (PLACES[place]?.lit !== false && w.light >= 0.02) senses.push("sight");
  if (s.hearing || medium === "sea") senses.push("hearing");
  if (medium === "sea" && w.conducts) senses.push("electric");
  if (senses.length < 2) senses.push("smell");
  if (w.light < 0.2 && senses.includes("hearing") && senses.length < 3) senses.push("echo");
  const skin = SKIN_OF[b.covering] ?? "skin",
    eggs =
      b.covering === "shell" ||
      b.covering === "plates" ||
      b.covering === "scales" ||
      b.covering === "feathers",
    bearing: BodyPlan["bearing"] =
      water === "water" && !b.warm ? "spawn" : eggs || !b.warm ? "eggs" : "live",
    young =
      bearing === "spawn"
        ? Math.round(20 + 30 * u(1))
        : bearing === "eggs"
          ? Math.max(2, Math.round(2 + 8 * u(1) * (b.size < 30 ? 1 : 0.5)))
          : b.size > 300
            ? 1
            : Math.max(1, Math.round(1 + 1.5 * u(1))),
    // (Lives run long as weight to about the fifth, as Earth's do; warm blood longer: an estimate.)
    span = Math.max(
      15,
      Math.min(
        140,
        Math.round(
          18 * dmath.pow(Math.max(0.5, b.size), 0.2) * (b.warm ? 1.3 : 1) * (0.85 + 0.3 * u(2)),
        ),
      ),
    ),
    diet: BodyPlan["diet"] =
      b.food === "filter" ? "filter" : b.level >= 4 ? "flesh" : b.level === 3 ? "both" : "plants",
    grasp = b.grasp ?? "hand";
  return {
    clade: "risen",
    name: risenName(b),
    medium: water,
    symmetry: b.symmetry === "radial" ? "radial" : "bilateral",
    size: Math.max(2, Math.round(b.size)),
    manipulators: MANIP[grasp],
    limbs: Math.max(1, b.arms ?? 1),
    senses,
    skin,
    warm: b.warm,
    diet,
    bearing,
    young,
    span,
    social: Math.round(Math.min(0.95, 0.4 + 0.6 * c.herd) * 100) / 100,
    legs: b.legs,
    wings: b.wings,
    hold: grasp,
    moves: b.moves,
    ...(b.rays ? { rays: b.rays } : {}),
  };
}
