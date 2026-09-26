// Goods and recipes (docs/architecture §20), as data. Phase 1 has the goods of a
// first farming people: three foods, what herds give, the metal a copper seam
// gives those who know how to work it, and what crafters make. A unit of food is
// a person's food for a month. Values are what a unit is usually worth against a
// unit of grain; a market's price moves around its value as goods run short or
// pile up. Recipes say what a crafter makes in a year, and from what.
import { OCC } from "./species.ts";

export type Good = {
  readonly id: string;
  /** Words: "grain", "meat and milk". */
  readonly name: string;
  /** Eaten: a unit feeds a person for a month. */
  readonly food: boolean;
  /** Usual worth, in units of grain. */
  readonly value: number;
  /** The share of a stock lost each month in store (pottery halves it). */
  readonly spoil: number;
  /** How heavy it is to carry, against grain: sets what a journey costs. */
  readonly bulk: number;
};

export const GOODS: readonly Good[] = [
  { id: "grain", name: "grain", food: true, value: 1, spoil: 0.004, bulk: 1 },
  { id: "meat", name: "meat and milk", food: true, value: 1.4, spoil: 0.05, bulk: 1 },
  { id: "wild", name: "wild food", food: true, value: 1, spoil: 0.03, bulk: 1 },
  { id: "wool", name: "wool", food: false, value: 2, spoil: 0.004, bulk: 0.6 },
  { id: "hides", name: "hides", food: false, value: 1.6, spoil: 0.006, bulk: 0.8 },
  { id: "copper", name: "copper", food: false, value: 8, spoil: 0, bulk: 0.5 },
  { id: "tools", name: "tools", food: false, value: 6, spoil: 0, bulk: 0.4 },
  { id: "clothing", name: "clothing", food: false, value: 5, spoil: 0.002, bulk: 0.3 },
  { id: "pottery", name: "pottery", food: false, value: 3, spoil: 0, bulk: 0.8 },
];

export const G = {
  grain: 0,
  meat: 1,
  wild: 2,
  wool: 3,
  hides: 4,
  copper: 5,
  tools: 6,
  clothing: 7,
  pottery: 8,
} as const;

export const FOODS: readonly number[] = [G.meat, G.wild, G.grain];

/** What people use up in a year, per person (tools: per worker who uses them). */
export const WANTS = {
  /** Tools worn out by each farmer, herder and crafter in a year. */
  toolsPerWorker: 0.25,
  clothingPerPerson: 0.3,
  potteryPerPerson: 0.1,
} as const;

/** What a flock gives besides its meat and milk, per unit of meat. */
export const HERD_GOODS = { woolPerMeat: 0.1, hidesPerMeat: 0.04 } as const;
/** Hides a forager brings in a year. */
export const FORAGER_HIDES = 0.6;

export type Recipe = {
  readonly id: string;
  /** Words: "stone tools". */
  readonly name: string;
  /** Goods used per crafter-year. */
  readonly inputs: readonly (readonly [number, number])[];
  /** Goods made per crafter-year. */
  readonly output: readonly [number, number];
  /** What the province must have: a deposit it works, or a way it knows. */
  readonly needs?: { readonly deposit?: string; readonly knowledge?: "metalworking" };
  /** Only near rivers and lakes (clay), or anywhere. */
  readonly clay?: boolean;
};

export const RECIPES: readonly Recipe[] = [
  { id: "stone-tools", name: "stone tools", inputs: [], output: [G.tools, 5] },
  {
    id: "copper-smelting",
    name: "copper smelted from its ore",
    inputs: [],
    output: [G.copper, 3],
    needs: { deposit: "copper", knowledge: "metalworking" },
  },
  {
    id: "copper-tools",
    name: "copper tools",
    inputs: [[G.copper, 1.5]],
    output: [G.tools, 12],
    needs: { knowledge: "metalworking" },
  },
  { id: "weaving", name: "woven clothing", inputs: [[G.wool, 6]], output: [G.clothing, 5] },
  { id: "leatherwork", name: "leather clothing", inputs: [[G.hides, 4]], output: [G.clothing, 3] },
  { id: "pottery", name: "pottery", inputs: [], output: [G.pottery, 6], clay: true },
];

/**
 * What households make for themselves, as a share of what they need, by the same
 * recipe a crafter would use (and only where it can be made): crafters make the rest.
 */
export const HOME_MADE: readonly { readonly recipe: string; readonly share: number }[] = [
  { recipe: "stone-tools", share: 0.5 },
  { recipe: "leatherwork", share: 0.6 },
  { recipe: "pottery", share: 0.4 },
];

/** Who works with tools (and wears them out). */
export const TOOL_USERS: readonly number[] = [OCC.farmer, OCC.herder, OCC.crafter];
/** How much tools raise what farmers and herders bring in, at full supply. */
export const TOOL_GAIN = 0.25;
/** A trader moves this many units of bulk a year; everyone else carries a little. */
export const TRADER_CAPACITY = 40;
export const PORTERAGE_PER_PERSON = 0.02;
