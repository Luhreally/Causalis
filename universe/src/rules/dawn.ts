// The acts the god's hand may lay on a world's dawn (Phase 24), as its seed's text carries them
// ("first light ~age 7 cool ~dawn hunters ~life 9 grazers"): an age of its deep past made warm or
// cold, its fires woken, a stone struck from the sky or the age calmed; the way of life that
// prospered in its first seas; and the way of life that prospered in an age's living world under
// the hand (Phase 27). The world is made again from them: what they reach is changed, what they
// do not is as it was.
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
