// A home looked into (Lives L6): what the view is given to draw, read and furnished in the host when it is opened and let go when it
// is closed. Nothing of it is kept.
import type { Dwelling } from "../rules/index.ts";

export type HomeInside = {
  /** Its page. */
  readonly ref: string;
  readonly town: string;
  readonly townName: string;
  /** Its number (a lot of the town's plan, or past them for a village's ring), its lot (-1: none), its place among the plan's homes (-1: none). */
  readonly n: number;
  readonly lot: number;
  readonly home: number;
  readonly title: string;
  readonly line: string;
  readonly state: "stands" | "rising" | "fell" | "razed" | "open";
  readonly level: number;
  /** How many storeys it has and which one this family's is (0: it has the whole of it). */
  readonly storeys: number;
  readonly storey: number;
  readonly form: string;
  readonly walls: string;
  readonly roof: string;
  readonly pitch: number;
  /** World units to a metre of its rooms: a body drawn in them fits them. */
  readonly scale: number;
  readonly medium: "land" | "shore" | "water";
  /** What they can spend on what they keep, and what it comes to. */
  readonly coin: number;
  readonly spent: number;
  /** Those living there, as places in the plan's people. */
  readonly residents: readonly number[];
  readonly noHouses: boolean;
  readonly dwelling: Dwelling;
};
