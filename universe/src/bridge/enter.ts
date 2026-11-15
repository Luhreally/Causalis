// A world of another star entered (asked 2026-11-13: "i should lowkey be able to play the alien worlds too"): what the
// page is told before it goes (the world's seed, made from what was read of it; how far its people had come; what will be
// as it was seen and what cannot be), and what an entered world says of itself once there.
import { FAR_ACT, seedCarried, seedPlain } from "../kernel/index.ts";

/** Whether a people's world can be entered, and the world it makes. */
export type EnterPlan =
  | {
      readonly ok: true;
      /** The universe its world runs in and its seed's text: what was read of it, carried in the text. */
      readonly universe: string;
      readonly seed: string;
      /** Its people as they are called from afar, and what they are ("trunked giants"). */
      readonly name: string;
      readonly kind: string;
      /** How far they have come, as read ("in towns"); the years at most its world is run to reach that. */
      readonly stage: string;
      readonly stageWords: string;
      readonly mostYears: number;
      /** About the year of its own count that comes at (est.), and about how many lands its history runs over (est.). */
      readonly usualYears: number;
      readonly lands: number;
      /** Its lands' grid: the home world's ("standard", "medium", "small"), or the one asked for. */
      readonly size: string;
      /**
       * Where their world as made shuts the road to the age they were read at: that age's name, the age before it
       * (as far as they can come), and why in a few words. Null: every road to it is open to them there.
       */
      readonly shut: {
        readonly name: string;
        readonly before: string;
        readonly why: string;
      } | null;
      /** What will be found as it was seen, and what will not, each in a sentence. */
      readonly kept: readonly string[];
      readonly fresh: readonly string[];
    }
  | {
      readonly ok: false;
      readonly why: string;
      /** On a world itself entered: the way on is back through the galaxy it was seen from. */
      readonly back?: true;
    };

/** What a world entered says of itself (null: a world of its own seed). */
export type Entered = {
  readonly name: string;
  readonly kind: string;
  /** The world it was seen from, to go back to. */
  readonly from: { readonly universe: string; readonly seed: string };
  /** Its star among the home world's stars, its place outward, and how far off (light-years). */
  readonly star: string;
  readonly index: number;
  readonly distance: number;
  /** The home world's year it was entered in; how far its people had come by then, as read. */
  readonly year: number;
  readonly stage: string;
  readonly stageWords: string;
  /** The years at most it is run to reach that; whether it has; and the age it stands at now. */
  readonly mostYears: number;
  readonly arrived: boolean;
  readonly age: string;
  /**
   * The age on the way to theirs that their own bodies or their world's matter shut to them here, as the full rules
   * read it (its name; null: every road to the age they were read at is open to them, and they hold its crafts).
   */
  readonly shut: string | null;
  /** Why, in a few words ("no fuel in its ground for the works that build what flies"); null with it. */
  readonly shutWhy: string | null;
  readonly kept: readonly string[];
  readonly fresh: readonly string[];
};

/** What the page reads of a world entered from its seed's text alone, before any world is running. */
export type EnteredSeed = {
  readonly name: string;
  readonly civ: string;
  readonly from: { readonly universe: string; readonly seed: string };
  readonly year: number;
  readonly star: { readonly ref: string; readonly distance: number };
  readonly planet: { readonly index: number };
};

/** A seed's text read as a world entered (null: a world of its own seed). The host reads the same text whole (rules/far.ts). */
export function enteredSeed(text: string): EnteredSeed | null {
  const json = seedCarried(text, FAR_ACT);
  if (json === null) return null;
  try {
    const got = JSON.parse(json) as Partial<EnteredSeed>;
    return typeof got.name === "string" &&
      typeof got.civ === "string" &&
      typeof got.from?.seed === "string" &&
      typeof got.star?.ref === "string" &&
      typeof got.planet?.index === "number"
      ? (got as EnteredSeed)
      : null;
  } catch {
    return null;
  }
}

/** A seed's text as it is shown: a world entered by its name and its acts, what was read of it left out. */
export function seedShown(text: string): string {
  return seedPlain(text, FAR_ACT);
}
