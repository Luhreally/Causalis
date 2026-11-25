// A world's shield against its star's hard light, as it stands this year (rules/skies.ts): the ozone it was made with
// (population/model.ts skyOf), less what a supernova's or gamma burst's light is stripping while it lasts, and what a great
// flare let through its field stripped this year. No state: a pure reading of the burst and the star's weather, so a loaded
// world reads what a running one does. Its fields in the open give less under what comes through.
import { defineEventType, type Ref, type World } from "../../kernel/index.ts";
import { growthUnderHard, hardAtGround, hardLight, ozoneStripped } from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { skyOf } from "../population/model.ts";

export const SHIELD_EVENTS = {
  /** The world's ozone stripped a tenth or more by a burst's light or a great flare: more hard light at its ground. */
  thinned: defineEventType("frontier.shield-thinned", 5),
};

export type ShieldNow = {
  /** The share of its ozone left (1: whole), and the hard light at its ground against Earth's, now and as made. */
  readonly left: number;
  readonly hard: number;
  readonly made: number;
  /** What that leaves of its open fields against under its whole shield (1: all). */
  readonly fields: number;
};

const WHOLE: ShieldNow = { left: 1, hard: 1, made: 1, fields: 1 };

/** The home world's shield under what a burst and a flare lay on its people's deaths (1: nothing). */
export function shieldUnder(world: World, burst: number, flare: number): ShieldNow {
  if (burst <= 1 && flare <= 1) return WHOLE;
  const g = homePlanet(world).generated,
    sky = skyOf(g),
    // (A burst's light and a flare's particles each strip their share of what the other leaves.)
    left = (1 - ozoneStripped(burst)) * (1 - ozoneStripped(flare, true));
  if (left >= 1 || sky.ozone <= 0) return WHOLE;
  const hard = hardAtGround(hardLight(g.star.temperature), sky.ozone * left, sky.haze);
  return {
    left,
    hard,
    made: sky.hard,
    fields: growthUnderHard(hard) / sky.open,
  };
}

/** Tell a shield stripped a tenth or more, with the burst or flare that stripped it. */
export function tellShield(world: World, s: ShieldNow, by: Ref, years: number): Ref | null {
  if (s.left > 0.9) return null;
  return world.events.emit({
    type: SHIELD_EVENTS.thinned.type,
    subjects: [homePlanet(world).generated.planet.ref as Ref],
    causes: [{ ref: by, role: "trigger", weight: 1 }],
    data: {
      left: Math.round(s.left * 100),
      hard: Math.round((s.hard / Math.max(1e-9, s.made)) * 10) / 10,
      fields: Math.round(s.fields * 100),
      years,
    },
  });
}
