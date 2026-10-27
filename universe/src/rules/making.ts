// The world's making under the god's hand (Phase 35 M179; the Creator of THE OBSERVATORY, who
// sets a world's conditions and watches what comes of them): a world never seen made about the
// kind of star chosen — a dim red one, an orange one, a yellow one like the Sun, a hot white one —
// its pull light or heavy, its orbit near its star or far out, its seas little or wide, its air
// thin or thick; each an act its seed's text carries ("amber 412 ~star red ~pull heavy"). What is
// chosen is drawn within the choice, the rest falls as the seed has it: the same draws, so the
// same world but as the hand made it. Within what a world never seen may be (the open prior's
// ranges); a world like ours is as ever. (Phase 56: and the carbon of the disk it formed in, and
// the ices it gathered, which make its kind: rules/kinds.ts.)
import { seedActs } from "../kernel/index.ts";
import { EARTHLIKE, type Prior, type Range } from "./priors.ts";

/** Each making and its choices: the range each choice draws from. */
export const MAKINGS = {
  /** The star's mass (solar masses): from a red dwarf near 3,400 K to a white star near 7,000 K. */
  star: { red: [0.35, 0.5], orange: [0.6, 0.82], yellow: [0.92, 1.08], white: [1.25, 1.6] },
  /** The world's mass (Earth masses): its pull from about 0.6 g to 1.6 g. */
  pull: { light: [0.3, 0.55], heavy: [2.2, 3] },
  /** Where in its star's warm zone it goes round: its inner edge (0) or its outer (1). */
  orbit: { near: [0, 0.18], far: [0.8, 1] },
  /** How much of its face its seas cover. */
  seas: { little: [0.1, 0.3], wide: [0.82, 0.95] },
  /** How much its air warms it (kelvin). */
  air: { thin: [5, 18], thick: [55, 80] },
  /**
   * The carbon to oxygen of the disk it formed in (Phase 56): oxygen-rich as its star's own (its C/O
   * as Phase 54 draws it), or richer in carbon than oxygen, a carbon world's (drawn here).
   */
  carbon: { oxygen: [0.2, 1.2], carbon: [1, 1.25] },
  /**
   * What it gathered past its star's snow line (Phase 56), each choice the band its liquid is liquid
   * in (kelvin): water, as Earth; sulfur, a volcano world's acid water; ammonia with its water;
   * methane and ethane.
   */
  volatiles: {
    water: [273.15, 373.15],
    sulfur: [273.15, 373.15],
    ammonia: [176, 300],
    methane: [90, 125],
  },
} as const satisfies Record<string, Record<string, Range>>;

export type MakingSubject = keyof typeof MAKINGS;
export const MAKING_SUBJECTS = Object.keys(MAKINGS) as readonly MakingSubject[];

/** The making a seed's acts lay on its world: each subject's choice (none: as the seed falls). */
export type Makings = Partial<Record<MakingSubject, string>>;

/** The act that makes a world so: "star red". */
export function makingAct(subject: MakingSubject, choice: string): string {
  return `${subject} ${choice}`;
}

/** The makings a seed's text lays on its world (an act of no known making is let be). */
export function makingsOf(text: string): Makings {
  const out: Makings = {};
  for (const a of seedActs(text)) {
    const [word, choice, more] = a.split(" ");
    if (more !== undefined || !word || !choice || !Object.hasOwn(MAKINGS, word)) continue;
    if (Object.hasOwn(MAKINGS[word as MakingSubject], choice)) out[word as MakingSubject] = choice;
  }
  return out;
}

/** A making's range for a choice (null: none such). */
function rangeOf(subject: MakingSubject, choice: string | undefined): Range | null {
  if (choice === undefined) return null;
  const ranges = MAKINGS[subject] as Readonly<Record<string, Range>>;
  return Object.hasOwn(ranges, choice) ? ranges[choice]! : null;
}

/**
 * A prior as a seed's makings narrow it: each chosen making's range in place of the prior's (the
 * Earth-like prior as it is: a world like ours is not remade). The carbon and the volatiles are not
 * the prior's: they make the world's kind (rules/kinds.ts).
 */
export function madePrior(prior: Prior, text: string): Prior {
  if (prior.name === EARTHLIKE.name) return prior;
  const m = makingsOf(text);
  if (!Object.keys(m).length) return prior;
  const star = rangeOf("star", m.star),
    pull = rangeOf("pull", m.pull),
    orbit = rangeOf("orbit", m.orbit),
    seas = rangeOf("seas", m.seas),
    air = rangeOf("air", m.air);
  return {
    ...prior,
    star: { ...prior.star, mass: star ?? prior.star.mass },
    planet: {
      ...prior.planet,
      mass: pull ?? prior.planet.mass,
      zone: orbit ?? prior.planet.zone,
      oceanFraction: seas ?? prior.planet.oceanFraction,
      greenhouse: air ?? prior.planet.greenhouse,
    },
  };
}

/** Each making: its sign, its name, and each choice in a word (for a dial), in words, and its sign. */
export const MAKING_WORDS: Readonly<
  Record<
    MakingSubject,
    {
      readonly icon: string;
      readonly name: string;
      readonly choices: Readonly<Record<string, readonly [string, string, string]>>;
    }
  >
> = {
  star: {
    icon: "⭐",
    name: "Its star",
    choices: {
      red: ["dim red", "a dim red star", "🔴"],
      orange: ["orange", "an orange star", "🟠"],
      yellow: ["like the Sun", "a yellow star like the Sun", "🟡"],
      white: ["white", "a white star, hot and bright", "⚪"],
    },
  },
  pull: {
    icon: "🪨",
    name: "Its pull",
    choices: {
      light: ["light", "a small world, its pull light", "🪶"],
      heavy: ["heavy", "a great world, its pull heavy", "🪨"],
    },
  },
  orbit: {
    icon: "🌡️",
    name: "Its orbit",
    choices: {
      near: ["near, warm", "near its star, and warm", "🔥"],
      far: ["far, cold", "far out from its star, and cold", "❄️"],
    },
  },
  seas: {
    icon: "🌊",
    name: "Its seas",
    choices: {
      little: ["little", "little sea and wide lands", "🏜️"],
      wide: ["wide", "wide seas and few lands", "🌊"],
    },
  },
  air: {
    icon: "🌫️",
    name: "Its air",
    choices: {
      thin: ["thin", "thin air", "💨"],
      thick: ["thick", "thick air, holding its warmth", "🌫️"],
    },
  },
  carbon: {
    icon: "💎",
    name: "Its carbon",
    choices: {
      oxygen: ["oxygen-rich", "rock of oxygen, as the Sun's", "🪨"],
      carbon: ["carbon-rich", "a disk richer in carbon than oxygen: a carbon world", "💎"],
    },
  },
  volatiles: {
    icon: "🧊",
    name: "Its ices",
    choices: {
      water: ["water", "water, as Earth's", "💧"],
      sulfur: ["sulfur", "sulfur from its volcanoes: a sulfur-volcano world", "🌋"],
      ammonia: ["ammonia", "ammonia with its water: an ice-and-ammonia world", "🧊"],
      methane: ["methane", "methane under a nitrogen air: a methane world", "🟠"],
    },
  },
};

/** A world's makings in words, as laid: "a dim red star · a great world, its pull heavy" (empty: none). */
export function makingWords(m: Makings): string {
  return (Object.keys(MAKING_WORDS) as MakingSubject[])
    .flatMap((s) => {
      const c = m[s];
      return c !== undefined && MAKING_WORDS[s].choices[c] ? [MAKING_WORDS[s].choices[c]![1]] : [];
    })
    .join(" · ");
}
