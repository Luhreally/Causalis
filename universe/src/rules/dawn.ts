// The acts the god's hand may lay on a world's dawn (Phase 24), as its seed's text carries them
// ("first light ~age 7 cool ~dawn hunters ~life 9 grazers"): an age of its deep past made warm or
// cold, its fires woken, a stone struck from the sky or the age calmed; the way of life that
// prospered in its first seas; and the way of life that prospered in an age's living world under
// the hand (Phase 27). The world is made again from them: what they reach is changed, what they
// do not is as it was. And on the peopling (Phase 28): the seas lowered as the bands spread, a kind
// or a hard age for them, and where the people rose.
import { seedActs } from "../kernel/index.ts";

/** What each act makes of an age (its kind of age, as deep time names them). */
export const AGE_ACTS = {
  warm: "hothouse",
  cool: "icehouse",
  fire: "great volcanism",
  strike: "impact",
  calm: "quiet",
} as const;
export type AgeAct = keyof typeof AGE_ACTS;

/** The ways of the first seas' small lives, as the acts name them. */
export const DAWN_WAYS = ["eaters", "light", "hunters", "together"] as const;
export type DawnWay = (typeof DAWN_WAYS)[number];

/** The act that makes an age (its index, oldest 0) of a kind: "age 7 cool". */
export function ageAct(age: number, act: AgeAct): string {
  return `age ${age + 1} ${act}`;
}

/** The act that says what prospered in the first seas: "dawn hunters". */
export function dawnAct(way: DawnWay): string {
  return `dawn ${way}`;
}

/** The ages a seed's acts made otherwise: each age's index (oldest 0), and the kind it was made. */
export function agesMade(text: string, ages: number): Map<number, (typeof AGE_ACTS)[AgeAct]> {
  const out = new Map<number, (typeof AGE_ACTS)[AgeAct]>();
  for (const a of seedActs(text)) {
    const [word, n, what] = a.split(" "),
      k = Number(n) - 1;
    if (word !== "age" || !Number.isInteger(k) || k < 0 || k >= ages) continue;
    if (what !== undefined && Object.hasOwn(AGE_ACTS, what)) out.set(k, AGE_ACTS[what as AgeAct]);
  }
  return out;
}

/** The way that prospered in the first seas, as a seed's acts say (null: as it would have). */
export function dawnMade(text: string): DawnWay | null {
  for (const a of seedActs(text)) {
    const [word, way] = a.split(" ");
    if (word === "dawn" && (DAWN_WAYS as readonly string[]).includes(way ?? ""))
      return way as DawnWay;
  }
  return null;
}

/**
 * The ways of an age's beasts the hand may make prosper (Phase 27): those that eat the grass and
 * the seed, those that browse the woods (the great beasts among them), those that hunt and eat
 * the dead.
 */
export const LIFE_WAYS = ["grazers", "browsers", "hunters"] as const;
export type LifeWay = (typeof LIFE_WAYS)[number];

/** The niches of each way of an age's beasts. */
export const LIFE_NICHES: Readonly<Record<LifeWay, readonly string[]>> = {
  grazers: ["grazer", "seed-eater"],
  browsers: ["browser", "great beast"],
  hunters: ["hunter", "small hunter", "scavenger"],
};

/** The act that says what prospered in an age's living world (its index, oldest 0): "life 7 grazers". */
export function lifeAct(age: number, way: LifeWay): string {
  return `life ${age + 1} ${way}`;
}

/** The ages whose living world the hand made prosper, as a seed's acts say: each age's index, and the way. */
export function livesMade(text: string, ages: number): Map<number, LifeWay> {
  const out = new Map<number, LifeWay>();
  for (const a of seedActs(text)) {
    const [word, n, way] = a.split(" "),
      k = Number(n) - 1;
    if (word !== "life" || !Number.isInteger(k) || k < 0 || k >= ages) continue;
    if ((LIFE_WAYS as readonly string[]).includes(way ?? "")) out.set(k, way as LifeWay);
  }
  return out;
}

/**
 * The god's hand on the peopling (Phase 28): the seas lowered while the bands spread, so they
 * walk over the straits a little sea apart (as an ice age's low seas let Earth's walk to its
 * far lands); and a kind age or a hard one for them, their bands the more or the fewer.
 */
export const PEOPLING_ACTS = {
  seas: "peopling seas low",
  kind: "peopling kind",
  hard: "peopling hard",
} as const;
export type PeoplingAct = keyof typeof PEOPLING_ACTS;

/** How many more (or fewer) people a kind (or hard) age leaves in the bands than an ordinary one. */
export const PEOPLING_PLENTY = { kind: 1.6, hard: 0.6 } as const;
/** How many provinces of sea the bands cross while the seas are low (else one). */
export const LOW_SEAS_REACH = 3;

/** The act laid on the peopling: "peopling seas low". */
export function peoplingAct(act: PeoplingAct): string {
  return PEOPLING_ACTS[act];
}

/** The act that bids the people rise elsewhere: a cell of the world's fine grid ("cradle 1234"). */
export function cradleAct(cell: number): string {
  return `cradle ${cell}`;
}

/** What a seed's acts made of the peopling: the seas lowered, the age kind or hard, the cradle bidden. */
export type PeoplingMade = {
  readonly seasLow: boolean;
  readonly age: "kind" | "hard" | null;
  readonly cradle: number | null;
};

/** The acts a seed's text laid on its peopling (none: as it would have been). */
export function peoplingMade(text: string): PeoplingMade {
  let seasLow = false,
    age: "kind" | "hard" | null = null,
    cradle: number | null = null;
  for (const a of seedActs(text)) {
    if (a === PEOPLING_ACTS.seas) seasLow = true;
    else if (a === PEOPLING_ACTS.kind) age = "kind";
    else if (a === PEOPLING_ACTS.hard) age = "hard";
    else {
      const [word, n] = a.split(" "),
        c = Number(n);
      if (word === "cradle" && Number.isInteger(c) && c >= 0) cradle = c;
    }
  }
  return { seasLow, age, cradle };
}
