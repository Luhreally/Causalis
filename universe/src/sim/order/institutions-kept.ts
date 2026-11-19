// What the institutions keep (sim/order/institutions.ts; the rules are rules/institutions.ts), and what the older systems read
// of it. One record a realm (its bodies, at most INST.most; the ended ones it remembers, a few) and one row a land (what its
// bodies do there). Both are bounded by the realms and lands a world has; nothing grows with history. This file reaches only
// the kernel and Round B's kept rows, so the economy, the society, the order and the lore can read it without a circle. Every
// reader gives back exactly what the world did before where nothing is kept.
import { Hasher, type Ref, type StateStore, type World } from "../../kernel/index.ts";
import { ANSWERS, DOES, INST } from "../../rules/index.ts";
import { RowStore } from "../money/kept.ts";
import type { OrgLeader } from "./groups-kept.ts";

/** One body. Shares in thousandths; heads whole; grain's worth a year. */
export type Body = {
  readonly id: number;
  /** Its name, the proper word only (its title is read off its basis: the X watch, the X ironworks). */
  readonly name: string;
  /** Its basis (by INST_DOES, INST_FUNDS, INST_ANSWERS, ORG_STANDING): what it does never turns; who pays and so whom it
   * answers to, and how its realm holds it, may. */
  readonly does: number;
  fund: number;
  answers: number;
  standing: number;
  /** What it makes, or whose trade it governs or speaks for (a good's index; -1: none). */
  readonly of: number;
  readonly since: number;
  /** The event it was founded by (its page's ref is made of it). */
  readonly event: Ref;
  home: number;
  lands: number[];
  /** Who keeps it where one does: a great house's name, a faith's ref; "" otherwise. */
  keeper: string;
  /** Its head, as a group keeps its leader, and how many it has had. */
  leader: OrgLeader;
  leaders: number;
  /**
   * The hook for a world's notable people (a later layer): the id of the one who founded it and of the one who heads it,
   * where such a person is kept ("" or absent: its head is the name above and no more). Set by `headsWith`'s giver at a
   * founding and at each succession; nothing here reads them.
   */
  founderId?: string;
  headId?: string;
  /** Its hands (for a body kept by dues, its members). */
  staff: number;
  wealth: number;
  income: number;
  /** How well it is run or how honest it is (thousandths): a works' and a paper's quality, a watch's and a court's honesty. */
  quality: number;
  /** Of what it does in its home land, the part that is its own (thousandths: among those that do the same there). */
  share: number;
  /** 1: a house of higher learning (it inquires as well as teaches). */
  higher?: number;
  /** Those a court holds (heads). */
  held?: number;
  /** A workers' body: the year it last struck, and the share of their trade's rent it has won (thousandths). */
  struck?: number;
  won?: number;
  /** A god's hand on it: the year until which it is blessed (1), cursed (-1) or kept from its seat's hand (2). */
  hand?: number;
  handUntil?: number;
};

/** A body whose hold ended: its name and what it did, when and how, who took it in, its founding and its end. */
export type GoneBody = {
  readonly name: string;
  readonly title: string;
  readonly does: number;
  readonly since: number;
  readonly year: number;
  readonly how: string;
  readonly into?: string;
  readonly rose: Ref;
  readonly event: Ref;
};

/** A realm's bodies. */
export type RealmBodies = {
  last: number;
  next: number;
  /** What each thing done is wanted for across the realm as last reckoned, and what is paid for it (grain's worth a year, by
   * INST_DOES, the first INST_FORMED). */
  need: number[];
  paid: number[];
  /** What its works' owners took a year (grain's worth), by the great house that owns them (its name; "": no house). */
  profit: [string, number][];
  /** What its watch adds to its seat's reach or takes from it, and what its voices do to its standing (ten-thousandths, signed). */
  reach: number;
  told: number;
  bodies: Body[];
  gone: GoneBody[];
};

export const BODIES_STORE = "order.bodies";

export class BodiesStore implements StateStore {
  readonly name = BODIES_STORE;
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly realms = new Map<Ref, RealmBodies>();
  /** Every realm's record folded in as it is set: a checkpoint hashes this, not every body (O(1) a checkpoint). */
  private digest = "";
  private sets = 0;
  dormant(): boolean {
    return this.realms.size === 0 && this.sets === 0;
  }
  of(realm: Ref): Readonly<RealmBodies> | undefined {
    return this.realms.get(realm);
  }
  put(realm: Ref, v: RealmBodies): void {
    this.realms.set(realm, v);
    // (Folded by its numbers, every body's: its names come of the same draws those numbers do, and a record's whole value
    // spelt out for the hash was a fifth of the system's year.)
    const h = new Hasher()
      .string(this.digest)
      .string(realm)
      .int(v.last)
      .int(v.next)
      .int(v.reach)
      .int(v.told)
      .int(v.bodies.length)
      .int(v.gone.length);
    for (const g of v.bodies)
      h.int(g.id)
        .int(((g.does * 16 + g.fund) * 16 + g.answers) * 4 + g.standing)
        .int(g.of)
        .int(g.home)
        .int(g.lands.length)
        .int(g.staff)
        .int(g.wealth)
        .int(g.income)
        .int(g.quality * 1024 + g.share)
        .int(g.leaders)
        .int(g.leader.born)
        .int(g.held ?? 0)
        .int((g.won ?? 0) * 4096 + (g.struck ?? 0))
        .int(((g.hand ?? 0) + 2) * 8192 + (g.handUntil ?? 0) + (g.higher ?? 0) * 65536);
    for (const [, n] of v.profit) h.int(n);
    this.digest = h.hex();
    this.sets++;
  }
  forget(realm: Ref): void {
    if (!this.realms.delete(realm)) return;
    this.digest = new Hasher().string(this.digest).string(`-${realm}`).hex();
    this.sets++;
  }
  realmsKept(): Ref[] {
    return [...this.realms.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const v of this.realms.values()) {
      for (const g of v.bodies) out.push(g.event);
      for (const g of v.gone) out.push(g.rose, g.event);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.int(this.realms.size).int(this.sets).string(this.digest);
  }
  save(): unknown {
    return {
      realms: this.realmsKept().map((r) => [r, this.realms.get(r)!]),
      digest: this.digest,
      sets: this.sets,
    };
  }
  load(state: unknown): void {
    this.realms.clear();
    const s = state as {
      realms?: [Ref, RealmBodies][];
      digest?: string;
      sets?: number;
    } | null;
    for (const [r, v] of s?.realms ?? []) this.realms.set(r, v);
    this.digest = s?.digest ?? "";
    this.sets = s?.sets ?? 0;
  }
}

export function bodiesOf(world: World): BodiesStore | null {
  return world.hasStore(BODIES_STORE) ? world.store<BodiesStore>(BODIES_STORE) : null;
}

/** A land's row: what its bodies do there. Thousandths unless said. */
export const BODY_LANDS_STORE = "order.bodylands";
export const BODY_ROW = {
  /** Of its crafters, the part under a works' roof; how many works hold it. */
  works: 0,
  firms: 1,
  /** How far its governed trade holds its crafters; its workers' body's part of them; the share of their trade's rent won. */
  craft: 2,
  union: 3,
  won: 4,
  /** A strike: the share of the year's craft lost, and the year it is lost in. */
  strike: 5,
  strikeYear: 6,
  /** Its watch (of a full one), and how honest; its court's reach, how far it is bought, and those it holds (heads). */
  watch: 7,
  honest: 8,
  court: 9,
  bought: 10,
  held: 11,
  /** Its clergy's hold; whether a house of teaching stands (1000); its higher learning's; its healing's. */
  clergy: 12,
  teach: 13,
  higher: 14,
  heal: 15,
  /** The reach of its voices that answer to their readers, and of those a house keeps; its shared risk. */
  word: 16,
  kept: 17,
  insure: 18,
  /** How many bodies hold any part of it. */
  bodies: 19,
} as const;
export const BODY_LANDS_WIDTH = 20;

export function bodyLandsStore(world: World): RowStore | null {
  return world.hasStore(BODY_LANDS_STORE) ? world.store<RowStore>(BODY_LANDS_STORE) : null;
}

// —— What the older systems read ——————————————————————————————————————————————————————————————————————————

const at = (world: World, cell: number, k: number): number =>
  bodyLandsStore(world)?.at(cell, k) ?? 0;

/** Of a land's crafters, the part under a works' roof (0 … 1; 0 where nothing is kept), and how many works hold it. */
export function worksIn(world: World, cell: number): { share: number; firms: number } {
  const row = bodyLandsStore(world)?.get(cell);
  return row
    ? { share: row[BODY_ROW.works]! / 1000, firms: row[BODY_ROW.firms]! }
    : { share: 0, firms: 0 };
}
/** The share of a year's craft a land loses to a strike in `year` (0 where none). */
export function strikeIn(world: World, cell: number, year: number): number {
  const row = bodyLandsStore(world)?.get(cell);
  return row && row[BODY_ROW.strikeYear] === year ? row[BODY_ROW.strike]! / 1000 : 0;
}
/** How far a land's governed trade holds its crafters as a body (0 … 1; 0 where nothing is kept). */
export const craftHeldIn = (world: World, cell: number): number =>
  at(world, cell, BODY_ROW.craft) / 1000;
/** The share of their trade's rent a land's workers have won by striking (0 where nothing is kept). */
export const wageWonIn = (world: World, cell: number): number =>
  at(world, cell, BODY_ROW.won) / 1000;
/** A land's watch (0 … 1 of a full one) and how honest it is (0 … 1). Nothing where none is kept. */
export function watchIn(world: World, cell: number): { watch: number; honest: number } {
  const row = bodyLandsStore(world)?.get(cell);
  return row
    ? { watch: row[BODY_ROW.watch]! / 1000, honest: row[BODY_ROW.honest]! / 1000 }
    : { watch: 0, honest: 0 };
}
/** A land's court: its reach (0 … 1), how far it is bought (0 … 1), and those it holds (heads). */
export function courtIn(
  world: World,
  cell: number,
): { court: number; bought: number; held: number } {
  const row = bodyLandsStore(world)?.get(cell);
  return row
    ? {
        court: row[BODY_ROW.court]! / 1000,
        bought: row[BODY_ROW.bought]! / 1000,
        held: row[BODY_ROW.held]!,
      }
    : { court: 0, bought: 0, held: 0 };
}
/** Whether a body that teaches stands in a land. */
export const taughtIn = (world: World, cell: number): boolean =>
  at(world, cell, BODY_ROW.teach) > 0;
/** How far a house of higher learning holds in a land (0 … 1). */
export const higherIn = (world: World, cell: number): number =>
  at(world, cell, BODY_ROW.higher) / 1000;
/** How far a house of healing holds in a land (0 … 1). */
export const healedIn = (world: World, cell: number): number =>
  at(world, cell, BODY_ROW.heal) / 1000;
/** How far a land's clergy hold as a body (0 … 1), and its shared risk (0 … 1). */
export const clergyIn = (world: World, cell: number): number =>
  at(world, cell, BODY_ROW.clergy) / 1000;
export const insuredIn = (world: World, cell: number): number =>
  at(world, cell, BODY_ROW.insure) / 1000;
/** The reach of a land's voices that answer to their readers, and of those a house keeps (0 … 1 each). */
export function voicesIn(world: World, cell: number): { free: number; kept: number } {
  const row = bodyLandsStore(world)?.get(cell);
  return row
    ? { free: row[BODY_ROW.word]! / 1000, kept: row[BODY_ROW.kept]! / 1000 }
    : { free: 0, kept: 0 };
}

/** Of a land's deaths, the share its clergy's alms and its shared risk spare (0 where nothing is kept). */
export function almsSparedIn(world: World, cell: number): number {
  const row = bodyLandsStore(world)?.get(cell);
  return row ? (INST.spares * Math.max(row[BODY_ROW.clergy]!, row[BODY_ROW.insure]!)) / 1000 : 0;
}
/** Of what a land's courts leave undone, the share an honest watch and court hold to (0 where nothing is kept). */
export function lawHeldIn(world: World, cell: number): number {
  const row = bodyLandsStore(world)?.get(cell);
  if (!row) return 0;
  const watch = (row[BODY_ROW.watch]! / 1000) * (row[BODY_ROW.honest]! / 1000),
    court = (row[BODY_ROW.court]! - row[BODY_ROW.bought]!) / 1000;
  return INST.fills * 0.5 * (watch + Math.max(0, court));
}
/** Of a land's deals kept, the share bought judges lose (0 where nothing is kept). */
export const courtBoughtIn = (world: World, cell: number): number =>
  (INST.bought * at(world, cell, BODY_ROW.bought)) / 1000;

/** What a realm's works paid their owners a year, for the great house of that name (grain's worth; 0 where none). */
export function worksProfitOf(world: World, realm: Ref, house: string): number {
  const v = bodiesOf(world)?.of(realm);
  if (!v) return 0;
  for (const [name, n] of v.profit) if (name === house) return n;
  return 0;
}

/**
 * How honest a realm's order-keeping body is (0 … 1), and how far it is manned (0 … 1); null where it keeps none. (A seam for
 * the underworld: an underpaid watch is where a badge crew is bred. Nothing reads it yet: sim/order/underworld.ts is another
 * pass's.)
 */
export function watchOf(world: World, realm: Ref): { honest: number; staff: number } | null {
  const v = bodiesOf(world)?.of(realm);
  if (!v) return null;
  let staff = 0,
    honest = 0;
  for (const g of v.bodies)
    if (g.does === DOES.order && g.answers === ANSWERS.seat) {
      staff += g.staff;
      honest += g.staff * g.quality;
    }
  return staff > 0 ? { honest: honest / staff / 1000, staff } : null;
}
