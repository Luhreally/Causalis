// What the society sweep keeps (2026-11-16; the rules are rules/care.ts, roles.ts, holding.ts, table.ts, dress.ts, leisure.ts), and
// what the older systems read of it. Each system keeps one store of fixed rows of whole numbers, a land's (keyed by its cell) or a
// realm's (by its ref), last reckoned only (a faded stock where it needs the past), hashed by a running digest and dormant while it
// holds nothing (Round B's RowStore). This file reaches only the kernel, the rules and Round B's kept rows, so the population, the economy and
// the realms can read it without a circle. Every reader gives back exactly what the world did before where no row is kept.
import type { World } from "../../kernel/index.ts";
import { BIND, BIND_STORE, RowStore, moneyStore } from "../money/kept.ts";
import { ROOF, daysWorked } from "../../rules/index.ts";

/** 1. A land's care of its sick (thousandths unless said): what its households spend (ten-thousandths of what they have), its healers
 * (in ten thousand of its people), whom they reach, who reaches them, the temple's alms, the realm's public care, what it knows of
 * healing, the share living near a hospital, the share of deaths spared, the share of its towns' people whose water is drained. */
export const CARE_STORE = "society.care";
export const CARE_ROW = {
  spend: 0,
  healers: 1,
  reach: 2,
  access: 3,
  effective: 4,
  alms: 5,
  publicCare: 6,
  known: 7,
  hospitals: 8,
  spared: 9,
  drained: 10,
} as const;

/** 2. A land's old (thousandths unless said): their share of its people, the frail band, who keeps them (kin, temple, their savings,
 * a pension), the share no one keeps, the share kept by other than their children, the children more a mother wants for her age, how
 * much more the frail die, the grown for each frail one (tenths). */
export const OLD_STORE = "society.old";
export const OLD_ROW = {
  share: 0,
  band: 1,
  kin: 2,
  temple: 3,
  savings: 4,
  pension: 5,
  neglected: 6,
  security: 7,
  want: 8,
  press: 9,
  support: 10,
} as const;

/** 3. A realm's provision (thousandths unless said): its pension and what it costs (grain's worth a year), its public care and its
 * cost, its old and its untended (shares of its people), its people's voice, whether it keeps a roll, what it has told (bits). */
export const PROVISION_STORE = "society.provision";
export const PROVISION = {
  pension: 0,
  pensionCost: 1,
  publicCare: 2,
  careCost: 3,
  old: 4,
  untended: 5,
  voice: 6,
  roll: 7,
  told: 8,
} as const;

/** 4. A land's roles (thousandths): how far its sexes' bodies differ, how far its young hold a mother, what its fields ask of strength,
 * what its work would have of a bearer's now, its people's norm, what a child costs its mother's work, its bearers' share of seats,
 * its towns' share of its people. */
export const ROLES_STORE = "society.roles";
export const ROLE_ROW = {
  dimorphism: 0,
  held: 1,
  strength: 2,
  target: 3,
  norm: 4,
  forgone: 5,
  rule: 6,
  towns: 7,
} as const;

/** 5. A realm's law (thousandths): how far written, the risk its ruler takes what is held and its four parts, how safe a holding is,
 * how far deals are held to (all, by courts, among kin), its courts' reach, its tenure, what it has told (bits). */
export const LAW_STORE = "society.law";
export const LAW_ROW = {
  written: 0,
  risk: 1,
  parts: 2,
  secure: 6,
  deals: 7,
  byCourts: 8,
  byKin: 9,
  courts: 10,
  tenure: 11,
  told: 12,
} as const;
/** A land's holdings (ten-thousandths): what its holders have put into its fields (a share of their yield), what is worth it, how
 * safe and how far theirs, and its realm's deals held to (thousandths, for its trade). */
export const HOLDINGS_STORE = "society.holdings";
export const HOLDINGS = { improved: 0, target: 1, secure: 2, tenure: 3, deals: 4 } as const;

/** 6. A land's table (thousandths): what it eats (grain, flesh and milk, the wild's, of its food), how far each means keeps it (by
 * KEEPING_MEANS), and the share of its food's spoiling they spare. */
export const TABLE_STORE = "society.table";
export const TABLE = { grain: 0, meat: 1, wild: 2, means: 3, kept: 9 } as const;

/** 7. A land's dress (thousandths): the warmth its people need of clothes, what their own coat leaves to clothes, what they are made
 * of (wool, hides, fibre), how far they show who one is, the clothes it wants against what every land once wanted, whether it dyes. */
export const DRESS_STORE = "society.dress";
export const DRESS_ROW = {
  need: 0,
  coat: 1,
  wool: 2,
  hides: 3,
  fibre: 4,
  display: 5,
  wanted: 6,
  dyed: 7,
} as const;

/** 8. A land's rest (tenths of an hour, days, bits, ten-thousandths): its working day, its holy and feast days, its games (GAMES
 * bits), how far its feasts ease its grievance a year, what its bread costs of its earnings (thousandths). */
export const LEISURE_STORE = "society.leisure";
export const LEISURE_ROW = { hours: 0, holy: 1, feasts: 2, games: 3, relief: 4, need: 5 } as const;

export const SOCIETY_STORES: readonly (readonly [string, number])[] = [
  [CARE_STORE, 11],
  [OLD_STORE, 11],
  [PROVISION_STORE, 9],
  [ROLES_STORE, 8],
  [LAW_STORE, 13],
  [HOLDINGS_STORE, 5],
  [TABLE_STORE, 10],
  [DRESS_STORE, 8],
  [LEISURE_STORE, 6],
  // (9, below: a land's people without a roof.)
  ["society.roofless", 17],
];

/** One of the society sweep's stores on a world (null where it keeps none). */
export function societyStore(world: World, name: string): RowStore | null {
  return world.peek<RowStore>(name) ?? null;
}

// —— What the older systems read ——————————————————————————————————————————————————————————————————————————

/** The share of a land's deaths its care spares (null where none is reckoned: the lore's own health, as before). */
export function careSparedOf(world: World, cell: number): number | null {
  const row = societyStore(world, CARE_STORE)?.get(cell);
  return row ? row[CARE_ROW.spared]! / 1000 : null;
}
/** The share of what a healer's tending does that a land's sick have of it, kin's tending and all (1 where none is reckoned). */
export function careEffectiveOf(world: World, cell: number): number {
  const row = societyStore(world, CARE_STORE)?.get(cell);
  return row ? row[CARE_ROW.effective]! / 1000 : 1;
}
/** A land's frail band and how much more its frail die for those no one keeps (null where none is reckoned). */
export function oldPressOf(world: World, cell: number): { band: number; press: number } | null {
  const row = societyStore(world, OLD_STORE)?.get(cell);
  return row ? { band: row[OLD_ROW.band]!, press: row[OLD_ROW.press]! / 1000 } : null;
}
/** The living children more a mother of a land wants for her age (0 where none is reckoned). */
export function oldAgeWantOf(world: World, cell: number): number {
  return (societyStore(world, OLD_STORE)?.at(cell, OLD_ROW.want) ?? 0) / 1000;
}
/** What a realm pays a year for its old's pensions and its poor's care (grain's worth; 0 where none is reckoned). */
export function provisionCostOf(world: World, realm: string): number {
  const row = societyStore(world, PROVISION_STORE)?.get(realm);
  return row ? row[PROVISION.pensionCost]! + row[PROVISION.careCost]! : 0;
}
/** A realm's pension (0 … 1 of its old paid one) and its public care (0 … 1 of its untended paid for). */
export function provisionOf(world: World, realm: string): { pension: number; publicCare: number } {
  const row = societyStore(world, PROVISION_STORE)?.get(realm);
  return {
    pension: (row?.[PROVISION.pension] ?? 0) / 1000,
    publicCare: (row?.[PROVISION.publicCare] ?? 0) / 1000,
  };
}
/** What a child costs its mother's work in a land (rules/roles.ts forgone; 0 where none is reckoned). */
export function forgoneOf(world: World, cell: number): number {
  return (societyStore(world, ROLES_STORE)?.at(cell, ROLE_ROW.forgone) ?? 0) / 1000;
}
/** How much more a land's fields yield for what its holders have put into them (a share; 0 where none is reckoned). */
export function improvedOf(world: World, cell: number): number {
  return (societyStore(world, HOLDINGS_STORE)?.at(cell, HOLDINGS.improved) ?? 0) / 10_000;
}
/** How far a land's deals are held to (0 … 1; null where none is reckoned). */
export function dealsOf(world: World, cell: number): number | null {
  const row = societyStore(world, HOLDINGS_STORE)?.get(cell);
  return row ? row[HOLDINGS.deals]! / 1000 : null;
}
/** The share of a land's food's spoiling its own means spare it (0 where none is reckoned). */
export function tableKeptOf(world: World, cell: number): number {
  return (societyStore(world, TABLE_STORE)?.at(cell, TABLE.kept) ?? 0) / 1000;
}
/** The clothes a land wants against what every land once wanted (1 where none is reckoned). */
export function dressWantedOf(world: World, cell: number): number {
  const row = societyStore(world, DRESS_STORE)?.get(cell);
  return row ? row[DRESS_ROW.wanted]! / 1000 : 1;
}
/** How far a land's feasts ease its grievance a year (0 where none is reckoned). */
export function feastReliefOf(world: World, cell: number): number {
  return (societyStore(world, LEISURE_STORE)?.at(cell, LEISURE_ROW.relief) ?? 0) / 10_000;
}
/**
 * What a captive's work would keep at a realm's seat, as its holders weigh binding (Round B's Domar row: the gain of a bound hand over
 * his living, by how far the realm's arms hold the bound against the open land; null where none is weighed).
 */
export function captiveWorthOf(world: World, seat: number): number | null {
  const row = moneyStore(world, BIND_STORE)?.get(seat);
  return row ? (row[BIND.gain]! / 1000) * (row[BIND.hold]! / 1000) : null;
}
/** The days a land works against the reference year (rules/leisure.ts daysWorked; 1 where none is reckoned). */
export function daysWorkedOf(world: World, cell: number): number {
  const row = societyStore(world, LEISURE_STORE)?.get(cell);
  return row ? daysWorked(row[LEISURE_ROW.holy]!, row[LEISURE_ROW.feasts]!) : 1;
}
/** The odds one of a land's people raised to rule or to a court is a bearer (rules/roles.ts bearersRule; even where none is kept). */
export function bearerOddsOf(world: World, cell: number): number {
  const row = societyStore(world, ROLES_STORE)?.get(cell);
  return row ? row[ROLE_ROW.rule]! / 1000 : 0.5;
}

/** 9. A land's people without a roof (thousandths of its town's people unless said): the least roof a household (grain's worth a
 * year), those its rent shuts out (of households), those waiting beyond the homes its builders raise in a year, those turned out (a stock, housed again as the
 * town rebuilds), those who need what they take, the frail no one keeps; all without a roof of their own; of them, those their kin,
 * the temple and the realm take in (of the roofless); those on the street; those on the street and those crowded in, of the land's
 * people; what the realm pays to shelter them (grain's worth a year); the town's people; how much more the land's people die of the
 * cold and of a sickness for them (thousandths, 1000 none). */
export const ROOFLESS_STORE = "society.roofless";
export const ROOF_ROW = {
  roof: 0,
  rent: 1,
  beyond: 2,
  displaced: 3,
  addicted: 4,
  old: 5,
  roofless: 6,
  kin: 7,
  temple: 8,
  realm: 9,
  street: 10,
  streetLand: 11,
  doubled: 12,
  shelterCost: 13,
  town: 14,
  cold: 15,
  sick: 16,
} as const;

/** How much more a land's people die of the cold for those of them on the street (1 where none is reckoned). */
export function rooflessColdOf(world: World, cell: number): number {
  const row = societyStore(world, ROOFLESS_STORE)?.get(cell);
  return row ? row[ROOF_ROW.cold]! / 1000 : 1;
}
/** How much more a sickness takes of a land for those of its people without a roof of their own (1 where none is reckoned). */
export function rooflessSickOf(world: World, cell: number): number {
  const row = societyStore(world, ROOFLESS_STORE)?.get(cell);
  return row ? row[ROOF_ROW.sick]! / 1000 : 1;
}
/** The share of a land's people on the street (0 where none is reckoned). */
export function streetOf(world: World, cell: number): number {
  return (societyStore(world, ROOFLESS_STORE)?.at(cell, ROOF_ROW.streetLand) ?? 0) / 1000;
}
/** The share of a land's town's people on the street (0 where none is reckoned). */
export function streetInTownOf(world: World, cell: number): number {
  return (societyStore(world, ROOFLESS_STORE)?.at(cell, ROOF_ROW.street) ?? 0) / 1000;
}
/** What a realm pays a year to shelter the roofless of its lands (grain's worth; 0 where none is reckoned). */
export function shelterCostOf(world: World, members: readonly number[]): number {
  const store = societyStore(world, ROOFLESS_STORE);
  if (!store) return 0;
  let n = 0;
  for (const c of members) n += store.at(c, ROOF_ROW.shelterCost);
  return n;
}
/** The grievance a year a land breeds for its people on the street (rules/roof.ts ROOF.grievance; 0 where none is reckoned). */
export function streetGrievanceOf(world: World, cell: number): number {
  return ROOF.grievance * streetOf(world, cell);
}
