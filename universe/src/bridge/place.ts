// A place (town mode, first slice): what the host tells the page of a town kept in detail (host/place.ts). Its people
// are the plan's people while the mode is on, each by a ref of their own; where each is, lot by lot, comes a few times
// a second and the page draws them between.

/** Where one is that is no lot: nowhere yet, the fields and pastures outside the town, its square. */
export const PLACE_AT = { none: -1, fields: -2, square: -3 } as const;

/** What one of a place's people is doing (host/place.ts ACT). */
export const PLACE_ACT = {
  idle: 0,
  sleep: 1,
  eat: 2,
  work: 3,
  fetch: 4,
  carry: 5,
  warm: 6,
  visit: 7,
  wait: 8,
} as const;

/** The page of one of a place's people, and of one of its lots (its square and its fields too). */
export const placePersonRef = (town: string, id: number): string => `plc:${town}:${id}`;
export const placeLotRef = (town: string, lot: number): string => `plcl:${town}:${lot + 3}`;
/** Who a plan's person is in their town's place (null: not one of a place's). */
export function placedId(ref: string): number | null {
  if (!ref.startsWith("plc:")) return null;
  const id = Number(ref.slice(ref.lastIndexOf(":") + 1));
  return Number.isInteger(id) ? id : null;
}

/** A place's people as they stand at a tick: those asked for, in the order asked. */
export type PlaceFrame = {
  readonly town: string;
  /** The place's clock (seconds of the world's), and the length of its tick. */
  readonly t: number;
  readonly tick: number;
  /** How many the town holds, how many of them the place keeps one by one, its households. */
  readonly people: number;
  readonly kept: number;
  readonly households: number;
  /** For each asked: where they are, where they are going, the ticks left of the walk and its whole (0: on none). */
  readonly at: readonly number[];
  readonly to: readonly number[];
  readonly eta: readonly number[];
  readonly trip: readonly number[];
  readonly act: readonly number[];
  /** Hunger and tiredness, 0 … 1; whether they carry anything; why they do what they do, in words. */
  readonly hunger: readonly number[];
  readonly tired: readonly number[];
  readonly carries: readonly boolean[];
  readonly why: readonly string[];
  /** How many are at each thing now, of all the place keeps (host/place.ts ACT's order). */
  readonly doing: readonly number[];
};
