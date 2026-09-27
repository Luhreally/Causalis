// The creature grammar (Phase 9 M83), as data and laws: every lineage of beasts a body of
// its own, as the peoples are (rules/bodies.ts) — its symmetry, its segments, its legs,
// fins and wings, what covers it, its size, how it moves, what it eats and how high it
// stands in the web of eating, the features it grows. Drawn in its age from its niche and
// its world: a heavier pull makes bodies squat, many-legged and small; a thin air keeps
// few fliers and a thick one many; the cold furs and feathers them, the heat scales them;
// a watery world fins them. Under the Earthlike prior they are Earth's own (four-legged,
// furred and hoofed, feathered, scaled, finned). From the body, its name.
import { dmath } from "../kernel/index.ts";

export type Locomotion = "walk" | "run" | "hop" | "crawl" | "slither" | "swim" | "fly";
export type Covering = "fur" | "wool" | "feathers" | "scales" | "shell" | "plates" | "slick";
export type Eats = "grass" | "leaves" | "seeds" | "flesh" | "carrion" | "plankton";
export type Feature =
  | "horns"
  | "wide-horns"
  | "antlers"
  | "tusks"
  | "trunk"
  | "hump"
  | "mane"
  | "crest"
  | "spines"
  | "claws"
  | "beak";

/** The niches of the web of eating (the lineages' ways of life), with what each eats and its level. */
export const FOOD_WEB = {
  "seed grass": { level: 1, eats: null },
  grazer: { level: 2, eats: "grass" },
  browser: { level: 2, eats: "leaves" },
  "great beast": { level: 2, eats: "leaves" },
  "seed-eater": { level: 2, eats: "seeds" },
  swimmer: { level: 2, eats: "plankton" },
  "small hunter": { level: 3, eats: "flesh" },
  scavenger: { level: 3, eats: "carrion" },
  hunter: { level: 4, eats: "flesh" },
} as const satisfies Record<string, { level: number; eats: Eats | null }>;
export type CreatureNiche = Exclude<keyof typeof FOOD_WEB, "seed grass">;

export type CreatureBody = {
  readonly symmetry: "bilateral" | "radial";
  /** Body parts in a row: one torso; a fore and hind body; three, as a many-legged body has. */
  readonly segments: 1 | 2 | 3;
  readonly legs: 0 | 2 | 4 | 6 | 8;
  readonly fins: 0 | 2 | 4;
  readonly wings: 0 | 2 | 4;
  readonly covering: Covering;
  /** Weight, kg. */
  readonly size: number;
  readonly moves: Locomotion;
  readonly eats: Eats;
  /** Its level in the web of eating: 2 eats plants, 3 eats plant-eaters, 4 eats all below. */
  readonly level: number;
  /** How long its neck and tail are (0 … 1), and what it grows. */
  readonly neck: number;
  readonly tail: number;
  readonly features: readonly Feature[];
  readonly warm: boolean;
};

/** What a world offers its beasts: its pull, how much is sea, how thick its air (bar). */
export type World = {
  readonly gravity: number;
  readonly ocean: number;
  readonly pressure: number;
  /** Whether the Earthlike prior holds (then its beasts are Earth's own). */
  readonly earthlike: boolean;
};

/** Where a lineage arose: the warmth and rain there. */
export type Home = { readonly warm: number; readonly rain: number };

/** Middle weights by niche (kg), before the world and chance vary them. */
const SIZE: Readonly<Record<CreatureNiche, readonly [number, number]>> = {
  grazer: [30, 700],
  browser: [40, 440],
  "great beast": [2000, 6000],
  "seed-eater": [0.02, 3],
  swimmer: [0.3, 40],
  "small hunter": [2, 40],
  scavenger: [3, 60],
  hunter: [30, 280],
};

/**
 * A lineage's body, drawn from its niche, its world and where it arose; `u(k)` is a keyed
 * draw in [0, 1) for the k-th choice.
 */
export function creatureBody(
  niche: CreatureNiche,
  world: World,
  home: Home,
  u: (k: number) => number,
): CreatureBody {
  const web = FOOD_WEB[niche],
    pull = Math.max(0.3, world.gravity),
    [lo, hi] = SIZE[niche],
    // Heavier worlds keep bodies smaller (the square-cube law against their pull).
    size = (lo + (hi - lo) * u(0) * u(0)) * dmath.pow(pull, -0.75),
    cold = home.warm < 5,
    hot = home.warm > 22,
    dry = home.rain < 400,
    wet = home.rain > 1500;
  // How it moves: a seed-eater takes to the air where the air bears it; a swimmer swims.
  const flies =
      niche === "seed-eater"
        ? u(1) < Math.min(0.9, 0.45 + 0.35 * world.pressure) / pull
        : niche === "scavenger"
          ? u(1) < (0.3 + 0.3 * world.pressure) / pull
          : false,
    swims = niche === "swimmer";
  // Legs by the world's pull and the prior: Earth's are four (two for a flier); heavier
  // worlds spread a body over more; a light one lets it stand on two.
  let legs: CreatureBody["legs"];
  if (swims) legs = 0;
  else if (flies) legs = 2;
  else if (world.earthlike) legs = niche === "seed-eater" ? 2 : 4;
  else {
    const r = u(2) + 0.35 * (pull - 1);
    legs = r < 0.12 ? 0 : r < 0.3 ? 2 : r < 0.72 ? 4 : r < 0.92 ? 6 : 8;
  }
  const many = legs >= 6,
    segments: CreatureBody["segments"] = many ? (legs === 8 ? 2 : 3) : 1,
    fins: CreatureBody["fins"] = swims ? (u(3) < 0.5 ? 2 : 4) : 0,
    wings: CreatureBody["wings"] = flies ? (world.earthlike || u(3) < 0.7 ? 2 : 4) : 0;
  // What covers it: the cold furs and feathers; the heat and the dry scale it; many legs
  // go in shell or plates; the water keeps skins slick or scaled.
  const covering: Covering = swims
    ? u(4) < 0.7
      ? "scales"
      : "slick"
    : flies
      ? world.earthlike || u(4) < 0.6
        ? "feathers"
        : "slick"
      : many
        ? u(4) < 0.6
          ? "shell"
          : "plates"
        : cold
          ? niche === "grazer" && u(4) < 0.5
            ? "wool"
            : "fur"
          : world.earthlike
            ? "fur"
            : hot && dry
              ? u(4) < 0.6
                ? "scales"
                : "plates"
              : wet
                ? u(4) < 0.5
                  ? "slick"
                  : "scales"
                : u(4) < 0.6
                  ? "fur"
                  : "scales";
  const moves: Locomotion = swims
    ? "swim"
    : flies
      ? "fly"
      : legs === 0
        ? "slither"
        : many
          ? "crawl"
          : legs === 2 && size < 40
            ? "hop"
            : niche === "hunter" || niche === "small hunter" || (niche === "grazer" && u(5) < 0.4)
              ? "run"
              : "walk";
  // What it grows: the plant-eaters their horns, antlers, humps and tusks; the hunters
  // their manes, crests and claws; the armoured their spines.
  const features: Feature[] = [];
  if (niche === "grazer") {
    if (u(6) < 0.55) features.push(size > 450 ? "wide-horns" : "horns");
    if (dry && hot && size > 200 && u(7) < 0.5) features.push("hump");
  }
  if (niche === "browser" && u(6) < 0.6) features.push(world.earthlike ? "antlers" : "crest");
  if (niche === "great beast") {
    features.push("tusks");
    if (u(6) < 0.7) features.push("trunk");
  }
  if (niche === "hunter" || niche === "small hunter") {
    features.push("claws");
    if (u(6) < 0.35) features.push(world.earthlike ? "mane" : "crest");
  }
  if (flies) features.push("beak");
  if ((covering === "plates" || covering === "shell") && u(7) < 0.5) features.push("spines");
  return {
    symmetry: !world.earthlike && swims && u(8) < 0.3 ? "radial" : "bilateral",
    segments,
    legs,
    fins,
    wings,
    covering,
    size: Math.round(size * 100) / 100,
    moves,
    eats: web.eats,
    level: web.level,
    neck:
      niche === "browser" || (niche === "grazer" && !many)
        ? 0.4 + 0.5 * u(9)
        : niche === "great beast"
          ? 0.1
          : 0.15 + 0.2 * u(9),
    tail: swims ? 0.8 : many ? 0.2 * u(10) : 0.2 + 0.6 * u(10),
    features,
    // Warm blood where fur, wool or feathers keep it; cold elsewhere.
    warm: covering === "fur" || covering === "wool" || covering === "feathers",
  };
}

const LEG_WORDS: Readonly<Record<number, string>> = {
  0: "legless",
  2: "two-legged",
  4: "four-legged",
  6: "six-legged",
  8: "eight-legged",
};

/** A body in words: "a six-legged plated grazer of 300 kg that crawls". */
export function creatureWords(b: CreatureBody, niche: string): string {
  const kg =
    b.size >= 1000
      ? `${(b.size / 1000).toFixed(1)} tonnes`
      : b.size >= 1
        ? `${Math.round(b.size)} kg`
        : `${Math.round(b.size * 1000)} g`;
  const limbs = b.wings
      ? `${b.wings === 4 ? "four-winged" : "winged"}`
      : b.fins
        ? `${b.fins === 4 ? "four-finned" : "finned"}`
        : (LEG_WORDS[b.legs] ?? `${b.legs}-legged`),
    skin =
      b.covering === "slick"
        ? "slick-skinned"
        : b.covering === "plates"
          ? "plated"
          : b.covering === "shell"
            ? "shelled"
            : b.covering === "wool"
              ? "woolly"
              : b.covering === "feathers"
                ? "feathered"
                : b.covering === "scales"
                  ? "scaled"
                  : "furred",
    words = `${b.symmetry === "radial" ? "radial " : ""}${limbs} ${skin} ${niche}`,
    article = /^[aeiou]/.test(words) ? "an" : "a";
  return `${article} ${words} of ${kg} that ${b.moves === "fly" ? "flies" : b.moves === "swim" ? "swims" : `${b.moves}s`}`;
}

const COLOURS = ["dun", "red", "grey", "black", "pale", "brindled", "spotted", "golden"];

/**
 * A lineage's name from its body and its colour. Under the Earthlike prior, the names of
 * Earth's own that such a body would have (a woolly grazer a sheep, a trunked great beast
 * a tusker); elsewhere, a name made of what it is (a plated six-legged grazer a plated
 * crawler, a finned swimmer a fin-darter).
 */
export function creatureName(
  b: CreatureBody,
  niche: CreatureNiche,
  home: Home,
  earthlike: boolean,
  u: number,
): string {
  const colour = COLOURS[Math.floor(u * COLOURS.length)]!;
  if (earthlike) {
    switch (niche) {
      case "grazer":
        if (b.size < 90) return b.covering === "wool" ? `${colour} woolly sheep` : `${colour} goat`;
        if (b.size > 450) return `${colour} buffalo`;
        if (b.features.includes("hump")) return `${colour} camel`;
        return b.features.includes("horns") ? `${colour} ox` : `${colour} horse`;
      case "browser":
        return home.warm < 5
          ? `${colour} elk`
          : home.rain > 1500
            ? `${colour} tapir`
            : `${colour} deer`;
      case "great beast":
        return home.warm < 5
          ? `${colour} woolly giant`
          : b.features.includes("trunk")
            ? `${colour} great tusker`
            : `${colour} great sloth`;
      case "hunter":
        return home.warm < 5 ? `${colour} wolf` : b.size > 150 ? `${colour} bear` : `${colour} cat`;
      case "small hunter":
        return home.warm < 5
          ? `${colour} fox`
          : b.size > 12
            ? `${colour} jackal`
            : `${colour} weasel`;
      case "scavenger":
        return b.moves === "fly" ? `${colour} vulture` : `${colour} hyena`;
      case "seed-eater":
        return b.moves === "fly"
          ? b.size > 0.5
            ? `${colour} pigeon`
            : `${colour} finch`
          : `${colour} hare`;
      case "swimmer":
        return b.size > 8 ? `${colour} pike` : home.warm < 8 ? `${colour} trout` : `${colour} carp`;
    }
  }
  // Elsewhere: named for what it is — its covering or its features, and how it lives.
  const look = b.features.includes("spines")
      ? "spined"
      : b.features.includes("crest")
        ? "crested"
        : b.features.includes("horns") || b.features.includes("wide-horns")
          ? "horned"
          : b.features.includes("tusks")
            ? "tusked"
            : b.covering === "plates"
              ? "plated"
              : b.covering === "shell"
                ? "shelled"
                : b.covering === "slick"
                  ? "slick"
                  : b.covering === "scales"
                    ? "scaled"
                    : b.covering === "feathers"
                      ? "plumed"
                      : "shaggy",
    noun =
      b.symmetry === "radial"
        ? "star-drifter"
        : b.moves === "fly"
          ? b.wings === 4
            ? "four-wing"
            : niche === "scavenger"
              ? "carrion-glider"
              : "wing-seeder"
          : b.moves === "swim"
            ? b.size > 8
              ? "deep-finner"
              : "fin-darter"
            : b.moves === "slither"
              ? niche === "hunter" || niche === "small hunter"
                ? "coil-hunter"
                : "slither"
              : b.legs === 8
                ? niche === "hunter" || niche === "small hunter"
                  ? "spinner"
                  : "eight-strider"
                : b.legs === 6
                  ? niche === "grazer"
                    ? "crawler"
                    : niche === "hunter" || niche === "small hunter"
                      ? "six-stalker"
                      : "sixleg"
                  : niche === "great beast"
                    ? "colossus"
                    : niche === "hunter"
                      ? b.legs === 2
                        ? "strider-hunter"
                        : "prowler"
                      : niche === "small hunter"
                        ? "skulker"
                        : niche === "scavenger"
                          ? "bone-picker"
                          : niche === "browser"
                            ? "leaf-reacher"
                            : niche === "seed-eater"
                              ? b.legs === 2
                                ? "hopper"
                                : "seed-nibbler"
                              : b.legs === 2
                                ? "stilt-grazer"
                                : "grazer";
  return `${colour} ${look} ${noun}`;
}
