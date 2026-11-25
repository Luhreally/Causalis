// A ruler's temper (the breadth round, 2026-11-23): what one who holds a seat is like, and how it bends what the seat does. A
// ruler is raised among their people and is also their own: each of three leanings is half their people's ways and half their
// own nature, drawn once from who they are (the moment they came to rule and the year they were born: the same ruler has the
// same temper on every reading, and nothing is kept). Bold: a people who prize valour, and one's own daring; it makes a war
// sought the likelier and a peace sued for the later. Grasping: a people who do not keep thrift as a virtue of the seat, and
// one's own greed; it asks the more tithe of the lands. Zealous: a devout people, and one's own fervour; it presses a holy war.
// How far a ruler's own leanings move what the seat does is how far the seat's choices are carried by few (its voice, rules/
// holds.ts): an assembly's speaker is no king. Pure.

/** One leaning's weight from the ruler's own nature, against their people's ways (the rest). */
export const TEMPER = {
  own: 0.5,
  /** At the most, a bold or a timid ruler makes a war sought this much the likelier or the less (by the share of choices they carry). */
  war: 0.6,
  /** At the most, a grasping or a sparing ruler asks this much more or less of the tithe (a share of the year's grain). */
  tithe: 0.04,
  /** At the most, a zealous ruler presses a holy war this much the harder. */
  zeal: 0.5,
} as const;

export type Temper = { readonly bold: number; readonly grasping: number; readonly zealous: number };

/** A fixed draw 0 … 1 from two whole numbers (a 32-bit mix: the same on every machine). */
function mix(a: number, b: number, salt: number): number {
  let x = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + salt, 0x85ebca6b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * A ruler's temper: `who` and `born` say who they are (their coming to rule's number and their birth year), the ways are their
 * people's (each 0 … 1).
 */
export function temperOf(
  who: number,
  born: number,
  ways: { readonly valour: number; readonly thrift: number; readonly piety: number },
): Temper {
  const blend = (people: number, salt: number) => ownLeaning(who, born, people, salt);
  return {
    bold: blend(ways.valour, 1),
    grasping: blend(1 - ways.thrift, 2),
    zealous: blend(ways.piety, 3),
  };
}

/**
 * One leaning of anyone, as a ruler's are drawn: half their people's way (0 … 1) and half their own nature, a fixed draw
 * from who they are (`salt`: which leaning). The same one has the same leaning on every reading.
 */
export function ownLeaning(who: number, born: number, people: number, salt: number): number {
  return (1 - TEMPER.own) * Math.max(0, Math.min(1, people)) + TEMPER.own * mix(who, born, salt);
}

/** How far a ruler's own leanings carry the seat: as far as its choices are carried by few (voice 0: wholly; 1: not at all). */
export function temperCarries(voice: number): number {
  return Math.max(0, Math.min(1, 1 - voice));
}

/** A leaning in words, for a factor's name. */
export function temperWords(kind: keyof Temper, x: number): string {
  const high = x >= 0.5;
  return kind === "bold"
    ? high
      ? "a bold ruler"
      : "a cautious ruler"
    : kind === "grasping"
      ? high
        ? "a grasping ruler"
        : "a sparing ruler"
      : high
        ? "a zealous ruler"
        : "a lukewarm ruler";
}
