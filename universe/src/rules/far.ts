// A world of another star, entered (asked 2026-11-13: "i should lowkey be able to play the alien worlds too, like when in
// the galaxy its other species"). From home, another people's world is a reading: its star, its pull and warmth, who rose
// there and how far they have come. Entered, it is a world like any other, made whole and lived year by year; and it is made
// from that reading, so what was seen from afar is what is found: the same star and the same world's numbers, the same
// chemistry of its ground and its life, the same people in body and look. The reading goes in the seed's own text as one
// act ("~far <what was read>"), so the world regenerates from its seed alone, as every world does, wherever the home
// world it was seen from has gone since.
//
// What was read is carried whole, as text: a world kept stays as it was entered even where the readings change later.
import { FAR_ACT, seedCarried, seedName, seedWithAct, wordOf } from "../kernel/index.ts";
import type { BodyPlan } from "./bodies.ts";

/** How far a people had come when it was read (sim/space/natives.ts FolkStage, but its ruins: no one is left to play). */
export type FarStage =
  "camps" | "villages" | "towns" | "cities" | "works" | "signals" | "orbit" | "stars";

/** What was read of a world from afar, and so what it is made from. */
export type FarMade = {
  readonly v: 1;
  /** What its people are called from afar, and their ref among the stars' peoples. */
  readonly name: string;
  readonly civ: string;
  /** Whether history at home follows them (one of the cluster's few), and where the world was seen from. */
  readonly followed: boolean;
  readonly from: { readonly universe: string; readonly seed: string };
  /** The home world's year it was entered in, and how far its people had come by then. */
  readonly year: number;
  readonly stage: FarStage;
  /** How many of them there were, all told, as read (an estimate; absent on a world entered before it was carried). */
  readonly people?: number;
  readonly star: {
    readonly ref: string;
    readonly mass: number;
    readonly luminosity: number;
    readonly temperature: number;
    readonly spectral: string;
    readonly ageGyr: number;
    /** Light-years from the home world. */
    readonly distance: number;
  };
  readonly planet: {
    /** Its place outward from its star, its orbit (AU). */
    readonly index: number;
    readonly a: number;
    readonly mass: number;
    readonly radius: number;
    readonly gravity: number;
    /** Its mean warmth (°C), its air (bar), and the share of its face under sea as the far sight drew it. */
    readonly temperature: number;
    readonly pressure: number;
    readonly seas: number;
  };
  /** Its ground's three draws (rules/chemistry.ts), and which way its life's first chemistry turned. */
  readonly chem: readonly [number, number, number];
  readonly hand: number;
  readonly body: BodyPlan;
  /** What their look is made of (the bridge's FolkFacts), carried as read. */
  readonly look: unknown;
};

/** The act that makes a world from what was read of it. */
export function farAct(made: FarMade): string {
  return `${FAR_ACT} ${wordOf(JSON.stringify(made))}`;
}

const READ = new Map<string, FarMade | null>();

/** What a seed's world is made from, where it is a world entered (null: a world of its own seed). */
export function farMade(text: string): FarMade | null {
  if (!text.includes(` ~${FAR_ACT} `)) return null;
  const known = READ.get(text);
  if (known !== undefined) return known;
  let made: FarMade | null = null;
  const json = seedCarried(text, FAR_ACT);
  if (json !== null)
    try {
      const got = JSON.parse(json) as Partial<FarMade>;
      if (got.v === 1 && got.star && got.planet && got.body && got.chem?.length === 3)
        made = got as FarMade;
    } catch {
      // (Not a reading: the world is its seed's own.)
    }
  if (READ.size >= 16) READ.delete(READ.keys().next().value!);
  READ.set(text, made);
  return made;
}

/**
 * The seed of a world entered: named for its people and where it was seen from ("Tsoni, from first light 3072:0/1"), so
 * its ground and its history are its own draws, and made from what was read.
 */
export function farSeed(made: FarMade, acts: readonly string[] = []): string {
  const place = made.star.ref.split(":").slice(1).join(":");
  let text = `${made.name}, from ${seedName(made.from.seed)} ${place}/${made.planet.index}`;
  for (const a of acts) text = seedWithAct(text, a);
  return seedWithAct(text, farAct(made));
}

/** The step of a world's own ages (host/inspect/stage.ts) that a stage read from afar stands at. */
export const FAR_STAGE_AGE: Readonly<Record<FarStage, string>> = {
  camps: "bands",
  villages: "villages",
  towns: "realms",
  cities: "cities",
  works: "engines",
  signals: "electricity",
  orbit: "orbit",
  stars: "stars",
};

/**
 * About the year of its own count a world entered comes to stand at each stage (est.). A people read past its camps
 * opens its chronicle settled and holding its crafts (sim/population/entered.ts): what is left is for its towns, its
 * realms and its works to stand, a matter of years. For telling how long the way there takes, never for stopping it.
 */
export const FAR_STAGE_USUAL: Readonly<Record<FarStage, number>> = {
  camps: 0,
  villages: 10,
  towns: 10,
  cities: 10,
  works: 20,
  signals: 20,
  orbit: 20,
  stars: 20,
};

/**
 * The most years a world entered is run for its people to stand at the stage they were read at, before it is taken up
 * as far as it has come: its works are its own to build, and a world whose stuffs make them slowly is not held behind
 * a screen for the centuries that takes.
 */
export const FAR_STAGE_YEARS: Readonly<Record<FarStage, number>> = {
  camps: 0,
  villages: 40,
  towns: 40,
  cities: 40,
  works: 60,
  signals: 60,
  orbit: 60,
  stars: 60,
};
