// What the culture sweep keeps (2026-11-16): one store of fixed rows of whole numbers for each system, a land's (by its cell), a
// realm's or a faith's (by its ref), last reckoned only, hashed by a running digest and dormant while nothing was ever set (Round
// B's RowStore, sim/money/kept.ts). Each row is bounded by the lands, realms and faiths a world has; nothing grows with history.
// This file reaches only the kernel and money/kept.ts, so every system and page can read it without a circle.
import type { World } from "../../kernel/index.ts";
import { RowStore } from "../money/kept.ts";

/** 1. Who a land counts its own (sim/culture/folk.ts), a land's row. */
export const FOLK_STORE = "culture.folk";
export const FOLK_ROW = {
  /** How much it counts its seat's people its own, and how far its "us" reaches (thousandths). */
  kin: 0,
  nation: 1,
  /** The realm it was weighed under (its ref's serial), and the year it was first weighed under it. */
  realm: 2,
  since: 3,
  /** The year it was last weighed. */
  at: 4,
} as const;

/** 2. A faith's houses (sim/belief/temple.ts), a faith's row. */
export const TEMPLE_STORE = "belief.temples";
export const TEMPLE_ROW = {
  /** Its clergy (heads), its granary (grain), what it was given last year and gave out to the hungry (grain). */
  clergy: 0,
  granary: 1,
  given: 2,
  relief: 3,
  /** How far its clergy teach (thousandths), its faithful (heads), its lands. */
  teaching: 4,
  faithful: 5,
  lands: 6,
  /** The year it first had a house. */
  since: 7,
} as const;

/** 3. What a realm's seat tells (sim/order/voice.ts), a realm's row. */
export const VOICE_STORE = "order.voice";
export const VOICE_ROW = {
  /** What it tells (VOICE_TOPICS index + 1; 0: nothing yet), since what year. */
  topic: 0,
  since: 1,
  /** How far it carries, how far it is believed, how freely word moves, how many of its people read (thousandths). */
  reach: 2,
  credence: 3,
  free: 4,
  readers: 5,
  /** Its lands' mean grievance (thousandths), what it does to the realm's standing (ten-thousandths, signed). */
  grievance: 6,
  standing: 7,
  told: 8,
} as const;

/** 4. What a land's town draws (sim/population/urban.ts), a land's row. */
export const URBAN_STORE = "town.urban";
export const URBAN_ROW = {
  /** How many times its trades and their kin its town holds (thousandths), and what it draws toward now. */
  draw: 0,
  target: 1,
  /** Its town's wage over its fields' (thousandths), its town's people when weighed. */
  ratio: 2,
  town: 3,
} as const;

/** 5. A land's works (sim/culture/art.ts), a land's row. */
export const ART_STORE = "culture.art";
export const ART_ROW = {
  /** Its works kept (work-years, tenths), made last weighed (tenths a year), its renown (thousandths). */
  works: 0,
  made: 1,
  renown: 2,
  /** Of what it made, the share its rulers and its faith's clergy kept makers for (thousandths). */
  court: 3,
  clergy: 4,
  /** What its makers work most (GOODS index + 1; 0: what the land gives). */
  stuff: 5,
  /** The year it was last weighed. */
  at: 6,
} as const;

/** 6. A land's higher learning (sim/lore/academy.ts), a land's row. */
export const ACADEMY_STORE = "lore.academies";
export const ACADEMY_ROW = {
  /** Its learned and what its patrons would keep at study (hundred-thousandths of its people). */
  learned: 0,
  target: 1,
  /** What its temple, its seat and its houses gave a year to keeping scholars (grain), when last weighed. */
  temple: 2,
  seat: 3,
  houses: 4,
  /** The year it was last weighed. */
  at: 5,
} as const;

/** Every store of the sweep, and its rows' width. */
export const CULTURE_ROWS: readonly (readonly [string, number])[] = [
  [FOLK_STORE, 5],
  [TEMPLE_STORE, 8],
  [VOICE_STORE, 9],
  [URBAN_STORE, 4],
  [ART_STORE, 7],
  [ACADEMY_STORE, 6],
];

/** One of the sweep's stores, where a world keeps it (a world from before the sweep, or one no one lives on, keeps none). */
export function cultureRows(world: World, name: string): RowStore | null {
  return world.peek<RowStore>(name) ?? null;
}

/** Register the sweep's stores. */
export function registerCultureRows(world: World): void {
  for (const [name, width] of CULTURE_ROWS) world.register(new RowStore(name, width));
}
