// The acts the god's hand may lay on a world's dawn (Phase 24), as its seed's text carries them
// ("first light ~age 7 cool ~dawn hunters"): an age of its deep past made warm or cold, its
// fires woken, a stone struck from the sky or the age calmed; and the way of life that
// prospered in its first seas. The world is made again from them: what they reach is changed,
// what they do not is as it was.
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
