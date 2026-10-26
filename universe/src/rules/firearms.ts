// Firearms from their physics (Phase 53 M219; asked for 2026-10-25: "later-age arms (semi/automatic,
// armour vehicles) ... everything from first principles"): each arm by what it does — how many aimed
// rounds a man looses in a minute, how far it carries true — and by what its making asks: how fine its
// parts must fit (under about a tenth of a millimetre is beyond a file: machined at a works), what its
// cartridge is (paper, or drawn brass, which asks zinc), what drives the ball (black powder, or the
// smokeless, which asks nitric acid made at scale). What a host fights with follows: its firepower
// (Dupuy's lethality, from the musket to the machine gun some twenty to forty-five times) and its
// range on the design grammar's axis. Pure tables and functions.
import { dmath } from "../kernel/index.ts";

/** How the parts of an arm are made to fit: by hand at the forge and bench, or machined at a works (mm). */
export type Tolerance = "hand-fitted" | 0.05 | 0.02;
/** What holds its charge. */
export type Cartridge = "paper" | "brass" | "belted brass";
/** What drives the ball. */
export type Powder = "black" | "smokeless";

export type Firearm = {
  /** The design grammar's realization id. */
  readonly id: string;
  /** The principle that makes it known. */
  readonly principle: string;
  /** Aimed rounds a man looses in a minute. */
  readonly rate: number;
  /** How far it carries true (m). */
  readonly range: number;
  readonly tolerance: Tolerance;
  readonly cartridge: Cartridge;
  readonly powder: Powder;
};

/** The arms of powder and shot, worst to best. */
export const FIREARMS: readonly Firearm[] = [
  {
    id: "musket",
    principle: "firearms",
    rate: 3,
    range: 100,
    tolerance: "hand-fitted",
    cartridge: "paper",
    powder: "black",
  },
  {
    id: "rifle",
    principle: "rifling",
    rate: 6,
    range: 400,
    tolerance: "hand-fitted",
    cartridge: "paper",
    powder: "black",
  },
  {
    id: "repeater",
    principle: "repeating-fire",
    rate: 15,
    range: 500,
    tolerance: 0.05,
    cartridge: "brass",
    powder: "black",
  },
  {
    id: "autoloader",
    principle: "self-loading",
    rate: 30,
    range: 550,
    tolerance: 0.02,
    cartridge: "brass",
    powder: "smokeless",
  },
  {
    id: "automatic",
    principle: "automatic-fire",
    rate: 120,
    range: 900,
    tolerance: 0.02,
    cartridge: "belted brass",
    powder: "smokeless",
  },
];

/** The rounds-by-metres a rifle looses in a minute: firepower 0 at this, the musket's below it. */
const RIFLE_REACH = 2400;

/**
 * An arm's firepower: log2 of what it looses (aimed rounds a minute by metres carried true) against
 * the rifle's, never below nothing — the musket and the rifle 0, the repeater 1.64, the autoloader
 * 2.78, the machine gun 5.49.
 */
export function firepowerOf(f: Pick<Firearm, "rate" | "range">): number {
  return Math.max(0, dmath.log2((f.rate * f.range) / RIFLE_REACH));
}

/** An arm's range on the design grammar's axis: the musket 0.85, the rifle 1.15, and so on by log2. */
export function rangeAxisOf(f: Pick<Firearm, "range">): number {
  return 0.85 + 0.15 * dmath.log2(f.range / 100);
}

/** Whether an arm's parts must be machined at a works (fitted finer than a file can). */
export function machined(f: Pick<Firearm, "tolerance">): boolean {
  return f.tolerance !== "hand-fitted";
}

export function firearm(id: string): Firearm | undefined {
  return FIREARMS.find((f) => f.id === id);
}
