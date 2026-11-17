// Rest, feasts and games (the society sweep, asked 2026-11-16: "leisure, sport and games"). Before it, nothing said how long a people
// worked or what it did when it did not, and a feast on a town's page changed nothing. Now:
//   The working day (workingHours): a worker works until what his work earns keeps him and his, and rests past it: the nearer his
//     earnings lie to his bread, the longer his day (est: eleven hours where a day's work barely feeds a household, seven where it
//     feeds it many times over).
//   Rest days (restDays): the days its faith keeps holy, the more the more devout it is; and feast days, the more as it has to spare.
//   What feasts do (feastRelief): a people who feast together hold together; a land's grievance eases by its feasts, less in a hard
//     year when there is little to share.
//   Games (gamesOf): what a people plays is what its body does and what its land and lore give it to play with: those with hands
//     throw and catch, the strong of a kind whose sexes differ wrestle, legs race, swimmers race in the water, the winged in the air;
//     where beasts are ridden they race them; where they reckon and write, games of the board; and where valour is prized, games of war.
// Pure functions.
import { dmath } from "../kernel/index.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

export const LEISURE = {
  /** The shortest working day (hours), and how much longer it grows as earnings fall to the bread they buy. */
  least: 6,
  span: 5,
  /** Holy days a year at the most devout, feast days at the most to spare, the days of rest any people keeps. */
  holy: 50,
  feasts: 25,
  rest: 10,
  /** The most a land's feasts ease its grievance in a year. */
  relief: 0.04,
} as const;

/** A worker's day, in hours, by what his bread costs of what his work earns (need 0 … 1). */
export function workingHours(need: number): number {
  return LEISURE.least + LEISURE.span * dmath.sqrt(clamp01(need));
}

/** A land's rest days a year: those of rest, its holy days by its piety, its feast days by what it has to spare. */
export function restDays(
  piety: number,
  surplus: number,
): { holy: number; feasts: number; all: number } {
  const holy = LEISURE.holy * clamp01(piety),
    feasts = LEISURE.feasts * clamp01(surplus);
  return { holy, feasts, all: LEISURE.rest + holy + feasts };
}

/** How much a land's feasts ease its grievance a year, by its days of feasting and holy days and how hard its year was. */
export function feastRelief(days: number, hardship: number): number {
  return LEISURE.relief * clamp01(days / 60) * (1 - 0.5 * clamp01(hardship));
}

export const GAMES = [
  "throwing",
  "wrestling",
  "races",
  "swimming",
  "flying",
  "riding",
  "board",
  "war",
] as const;
export type Game = (typeof GAMES)[number];
export const GAME_WORDS: Readonly<Record<Game, string>> = {
  throwing: "games of throwing and catching",
  wrestling: "wrestling",
  races: "foot races",
  swimming: "races in the water",
  flying: "races in the air",
  riding: "races of ridden beasts",
  board: "games of the board",
  war: "mock battles",
};

/** What a people plays, from its body, its land's lore and its ways. */
export type Players = {
  readonly hands: boolean;
  readonly legs: number;
  readonly wings: number;
  readonly water: boolean;
  readonly dimorphism: number;
  readonly riding: boolean;
  readonly reckoning: boolean;
  readonly valour: number;
};

/** The games a people plays (bits by GAMES). */
export function gamesOf(p: Players): number {
  const on: Game[] = [];
  if (p.hands) on.push("throwing");
  if (p.dimorphism >= 0.2 && !p.water) on.push("wrestling");
  if (p.legs >= 2 && !p.water) on.push("races");
  if (p.water) on.push("swimming");
  if (p.wings > 0) on.push("flying");
  if (p.riding) on.push("riding");
  if (p.reckoning) on.push("board");
  if (p.valour >= 0.6) on.push("war");
  return on.reduce((bits, g) => bits | (1 << GAMES.indexOf(g)), 0);
}

/** The games in a set of bits. */
export function gamesIn(bits: number): Game[] {
  return GAMES.filter((_, i) => bits & (1 << i));
}
