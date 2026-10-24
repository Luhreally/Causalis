// Life elsewhere (Phase 18 M132, the Observatory: "lifeless worlds, microbial worlds, worlds
// of complex life"): what lives on each world of another star — and on the home star's other
// worlds — from its ground and its star alone, by a pure keyed draw. Life needs water that
// lies liquid and time: seas warm enough under an air thick enough, or water under ice,
// about a star that has burned steadily long enough. Where seas are, the first chemistry
// quickens into cells on most worlds within a billion years; cells, given billions more and
// a steady star, into bodies; on a few, a people rose (the cluster's civilizations).
import { defineStream, type Rng } from "../kernel/index.ts";
import { sketchLife, type Env, type Sketched } from "./evolution.ts";

const LIFE = defineStream("gen.elsewhere");

/** How far life has come on a world: none, the first chemistry, cells, bodies, a people. */
export type LifeLevel = "none" | "chemistry" | "cells" | "bodies" | "people";

/** The small lives of a drop, by their ways (as the drop draws them). */
export type SmallWay = "eater" | "light" | "hunter" | "colony";

export type Elsewhere = {
  readonly level: LifeLevel;
  /** Why it is so, in words. */
  readonly because: string;
  /** Where its life lives. */
  readonly where: "seas" | "water under its ice" | null;
  /** Billions of years ago its first cells came, and its first bodies (null: not yet). */
  readonly cellsAgo: number | null;
  readonly bodiesAgo: number | null;
  /** The kinds of its small lives. */
  readonly small: readonly SmallWay[];
  /** Its bodies, sketched (where it has bodies). */
  readonly bodies: readonly Sketched[];
};

/** What a world offers life: its kind, ground, air and water, its orbit and its place out. */
export type LifeGround = {
  readonly kind: string;
  readonly temperature: number;
  readonly pressure: number;
  readonly water: string;
  readonly radiation: number;
  readonly gravity: number;
  readonly index: number;
  /** Its distance from its star (AU), for the light that reaches it. */
  readonly a: number;
};

/** The star a world goes about, as life needs it known. */
export type LifeStar = {
  /** Its key among the stars (its sector and place; home's own star is 0, 0). */
  readonly sector: number;
  readonly k: number;
  readonly ageGyr: number;
  readonly remnant: boolean;
  readonly spectral: string;
  readonly luminosity: number;
};

const NONE = (because: string): Elsewhere => ({
  level: "none",
  because,
  where: null,
  cellsAgo: null,
  bodiesAgo: null,
  small: [],
  bodies: [],
});

/**
 * What lives on a world: by its water, warmth, air and star, and by a draw keyed to the
 * world. `people`: one of the cluster's civilizations rose there.
 */
export function lifeElsewhere(rng: Rng, star: LifeStar, w: LifeGround, people = false): Elsewhere {
  const key = star.sector * 64 + star.k,
    u = (n: number) => rng.real(LIFE, key, w.index, 0, n),
    age = Math.min(star.ageGyr, 12.6);
  if (star.remnant) return NONE("its star burned out long ago, and its worlds with it");
  if (w.kind === "giant" || w.kind === "ice giant")
    return NONE("a giant: no ground and no seas, only winds of gas over a crushing deep");
  const seas = w.water === "seas" && w.temperature > -15 && w.temperature < 95,
    ice = w.water === "ice" && w.temperature > -90;
  if (!seas && !ice)
    return NONE(
      w.water === "seas"
        ? "its seas are too hot for the chemistry of life to hold together"
        : w.pressure < 0.05
          ? "too little air to keep water liquid: whatever water it had boiled off into space"
          : w.temperature >= 95
            ? "too hot for water to lie on it"
            : "too dry and cold for water to lie liquid anywhere on it",
    );
  if (w.radiation > 6 && seas)
    return NONE("its thin air lets the star's radiation through to break what life would build");
  // Water under ice: cells, now and then, warmed from within; never more.
  if (!seas) {
    if (age < 1 || !(u(0) < 0.3))
      return {
        ...NONE("frozen over: water under its ice, but nothing has quickened in it"),
        level: "chemistry",
        where: "water under its ice",
      };
    return {
      level: "cells",
      because: "small cells live in the dark water under its ice, warmed from within",
      where: "water under its ice",
      cellsAgo: Math.round(age * (0.3 + 0.4 * u(1)) * 10) / 10,
      bodiesAgo: null,
      small: ["eater"],
      bodies: [],
    };
  }
  if (age < 0.7)
    return {
      ...NONE("too young: its seas hold the first chemistry of life, not yet anything alive"),
      level: "chemistry",
      where: "seas",
    };
  if (!(u(2) < 0.85) && !people)
    return {
      ...NONE("its seas hold the chemistry of life, but it never quickened"),
      level: "chemistry",
      where: "seas",
    };
  // Cells: early in the world's life. Light-eaters where enough of the star's light reaches.
  const cellsAgo = Math.round((age - 0.3 - 0.5 * u(3)) * 10) / 10,
    lit = star.luminosity / (w.a * w.a) > 0.05,
    small: SmallWay[] = lit ? ["eater", "light"] : ["eater"];
  if (cellsAgo > 1.6) small.push("hunter");
  // Bodies: billions of years on, about a steady star.
  const steady = star.spectral.startsWith("M") ? 0.25 : star.spectral.startsWith("F") ? 0.4 : 0.6,
    bodies = people || (cellsAgo >= 2 && u(4) < steady);
  if (!bodies)
    return {
      level: "cells",
      because:
        cellsAgo < 2
          ? "its cells have had too little time to grow into bodies"
          : star.spectral.startsWith("M")
            ? "its cells never grew into bodies under its flaring red star"
            : "its cells have lived billions of years and never grown into bodies",
      where: "seas",
      cellsAgo,
      bodiesAgo: null,
      small,
      bodies: [],
    };
  if (lit) small.push("colony");
  const bodiesAgo = Math.round(Math.min(cellsAgo - 1, 0.4 + 1.2 * u(5)) * 100) / 100,
    env: Env = {
      gravity: w.gravity,
      pressure: Math.max(0.05, w.pressure),
      warmth: w.temperature,
      rain: 1000,
      kind: "quiet",
      hunted: 0.2,
    },
    land = w.pressure > 0.3 && w.temperature > -5 && w.temperature < 50;
  return {
    level: people ? "people" : "bodies",
    because: people
      ? "a people rose there, out of its bodies, to think and to build"
      : land
        ? "bodies fill its seas and have come ashore"
        : "bodies fill its seas, but none has come ashore",
    where: "seas",
    cellsAgo,
    bodiesAgo,
    small,
    bodies: sketchLife(`${key} ${w.index}`, env, land, land ? 6 : 4),
  };
}

/** A life level in a few words. */
export const LIFE_WORDS: Readonly<Record<LifeLevel, string>> = {
  none: "lifeless",
  chemistry: "the first chemistry",
  cells: "single cells",
  bodies: "bodies",
  people: "a people",
};
