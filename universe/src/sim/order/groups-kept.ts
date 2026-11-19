// What the groups keep (sim/order/groups.ts; the rules are rules/groups.ts), and what the older systems read of it. One record a
// realm (its groups, at most ORG.most; their federations, at most ORG.feds; the groups whose hold ended, a few), and one row a land
// (who holds it, what is preyed and guarded, aided, the killing, the rising and the faith pressed). Both are bounded by the realms
// and lands a world has; nothing grows with history. This file reaches only the kernel and Round B's kept rows, so the population,
// the society, the order, strife and war can read it without a circle. Every reader gives back exactly what the world did before
// where nothing is kept.
import { Hasher, type Ref, type StateStore, type World } from "../../kernel/index.ts";
import { RowStore } from "../money/kept.ts";
import { almsSparedIn, lawHeldIn } from "./institutions-kept.ts";

/** A group's leader: a figure with a birth year, as a house keeps its head. */
export type OrgLeader = { name: string; born: number; since: number };

/** One group. Shares in thousandths; heads whole; grain's worth a year. */
export type Org = {
  readonly id: number;
  /** Its name, the proper word only (its kind says the rest: the X pirates, the X sect). */
  readonly name: string;
  /** Its kind as now read off what it does (by ORG_KINDS), and its first aim (by ORG_AIMS): both may turn. */
  kind: number;
  aim: number;
  /** Its aims, each in thousandths of what it does (by ORG_AIMS), summing to 1000. */
  aims: number[];
  readonly since: number;
  /** The event it rose by (its page's ref is made of it). */
  readonly event: Ref;
  readonly home: number;
  lands: number[];
  /** What bound its people before it formed (by ORG_BASES), and who they are: a faith's ref, a people's name, or "". */
  readonly basis: number;
  readonly identity: string;
  /** What it holds (bits, by MEANS); how its realm holds it (by ORG_STANDING). */
  means: number;
  standing: number;
  leader: OrgLeader;
  leaders: number;
  members: number;
  wealth: number;
  income: number;
  /** What it takes of others a year (grain's worth), and gives (to its members' need, their loans, their dead). */
  takes: number;
  gives: number;
  /** Those it kills and loses a year (heads). */
  violence: number;
  /** Its strength (thousandths: its men and purse among its realm's groups). */
  power: number;
  /** The realm that pays or licenses it (its ref), where one does; its federation's id. */
  patron?: Ref;
  fed?: number;
  /** A party's share of its interest it holds to its candidate (thousandths); the great house whose head leads it (a demagogue). */
  organised?: number;
  house?: string;
  /** The god's hand on it (sim/order/grouphand.ts): blessed (1), cursed (-1) or kept from its realm's hand (2), until a year. */
  hand?: number;
  handUntil?: number;
  /** How it is held by a decree (the god's, or its realm's ruler's) whatever its realm would do (by ORG_STANDING), until a year. */
  decree?: number;
  decreeUntil?: number;
};

/** Groups of one first aim allied across a realm: a league of communes, a brethren of pirates, a network of cells. */
export type OrgFed = {
  readonly id: number;
  readonly name: string;
  readonly since: number;
  readonly event: Ref;
  readonly aim: number;
  members: number[];
  strength: number;
};

/** A group whose hold ended: its name and kind, when and how, who took it in, its rise and its end. */
export type GoneOrg = {
  readonly name: string;
  readonly kind: number;
  readonly since: number;
  readonly year: number;
  readonly how: string;
  readonly into?: string;
  readonly rose: Ref;
  readonly event: Ref;
};

/** A realm's groups. Thousandths unless said. */
export type RealmOrgs = {
  last: number;
  next: number;
  /** Each aim's stake in the realm as last reckoned (grain's worth a year), and the members it would gather (heads). */
  stakes: number[];
  gather: number[];
  /** How hard it turns on what it outlaws; the killing a year its groups do and suffer (heads); what preying takes (grain's worth). */
  suppression: number;
  killings: number;
  taken: number;
  /** What it pays the groups it hires and licenses a year (grain's worth). */
  pays: number;
  /** How organised its would-be risers and its plotters are, for its people's numbers (thousandths). */
  rising: number;
  plot: number;
  orgs: Org[];
  feds: OrgFed[];
  gone: GoneOrg[];
};

export const ORGS_STORE = "order.groups";

export class OrgsStore implements StateStore {
  readonly name = ORGS_STORE;
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly realms = new Map<Ref, RealmOrgs>();
  /** Every realm's record folded in as it is set: a checkpoint hashes this, not every group (O(1) a checkpoint). */
  private digest = "";
  private sets = 0;
  dormant(): boolean {
    return this.realms.size === 0 && this.sets === 0;
  }
  of(realm: Ref): Readonly<RealmOrgs> | undefined {
    return this.realms.get(realm);
  }
  put(realm: Ref, v: RealmOrgs): void {
    this.realms.set(realm, v);
    this.hiredMemo = null;
    this.digest = new Hasher().string(this.digest).string(realm).value(v).hex();
    this.sets++;
  }
  forget(realm: Ref): void {
    if (!this.realms.delete(realm)) return;
    this.hiredMemo = null;
    this.digest = new Hasher().string(this.digest).string(`-${realm}`).hex();
    this.sets++;
  }
  realmsKept(): Ref[] {
    return [...this.realms.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  /** The men of groups each realm pays or licenses (a memo, made again after any record is set). */
  private hiredMemo: Map<Ref, number> | null = null;
  hired(realm: Ref): number {
    if (!this.hiredMemo) {
      const m = new Map<Ref, number>();
      for (const v of this.realms.values())
        for (const g of v.orgs) if (g.patron) m.set(g.patron, (m.get(g.patron) ?? 0) + g.members);
      this.hiredMemo = m;
    }
    return this.hiredMemo.get(realm) ?? 0;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const v of this.realms.values()) {
      for (const g of v.orgs) out.push(g.event);
      for (const f of v.feds) out.push(f.event);
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
    this.hiredMemo = null;
    const s = state as {
      realms?: [Ref, RealmOrgs][];
      digest?: string;
      sets?: number;
    } | null;
    for (const [r, v] of s?.realms ?? []) this.realms.set(r, v);
    this.digest = s?.digest ?? "";
    this.sets = s?.sets ?? 0;
  }
}

export function orgsOf(world: World): OrgsStore | null {
  return world.hasStore(ORGS_STORE) ? world.store<OrgsStore>(ORGS_STORE) : null;
}

/** A land's row: who holds it and what that does there. Thousandths unless said. */
export const ORG_LANDS_STORE = "order.grouplands";
export const ORG_ROW = {
  /** The strongest group's id (one more; 0: none), its kind (one more), its hold here. */
  group: 0,
  kind: 1,
  hold: 2,
  /** Of its road trade, the share preyed on a year; how far it is guarded by its own (militia, league). */
  prey: 3,
  guard: 4,
  /** Of what its courts leave undone, the share its own hold to (guards, vigilantes, communes, leagues, lending circles). */
  fills: 5,
  /** Of its deaths, the share spared by mutual aid; of its roofless, the share taken in. */
  spared: 6,
  sheltered: 7,
  /** Those killed a year (millionths of its people), and of its young (millionths of its young). */
  killings: 8,
  young: 9,
  /** Its rising's organisation (0 … 1000), its plotters', a sect's pull from the seat's faith, and the faith it pulls toward
   * (its index in the land's faith list is not kept: the sect's group id, one more). */
  rising: 10,
  plot: 11,
  sect: 12,
  sectOf: 13,
  /** How far its own rule thins the seat's reach here. */
  thins: 14,
  /** How many groups hold any part of it. */
  groups: 15,
  /** Of its sea trade, the share preyed on a year. */
  seaPrey: 16,
  /** How far it is held apart as a refuge by those who fled (a maroon community's hold), its learned society's, its monastic
   * order's (thousandths), and what that order keeps a year for learning and stores (grain's worth). */
  refuge: 17,
  inquire: 18,
  cloister: 19,
  keeps: 20,
} as const;
export const ORG_LANDS_WIDTH = 21;

export function orgLandsStore(world: World): RowStore | null {
  return world.hasStore(ORG_LANDS_STORE) ? world.store<RowStore>(ORG_LANDS_STORE) : null;
}

// —— What the older systems read ——————————————————————————————————————————————————————————————————————————

const at = (world: World, cell: number, k: number): number =>
  orgLandsStore(world)?.at(cell, k) ?? 0;

/**
 * A land's groups as a lens reads them (the Underworld lens may show it): the strongest group's id and kind (by ORG_KINDS), its
 * hold (0 … 1), what preying takes of its trade, how far its own guard it and fill its law, the deaths mutual aid spares, the
 * killing (a year, in a hundred thousand of its people), its rising's and its plotters' organisation and how many groups hold any
 * part of it. Null where nothing is kept.
 */
export function organisedIn(
  world: World,
  cell: number,
): {
  group: number | null;
  kind: number | null;
  hold: number;
  prey: number;
  seaPrey: number;
  guard: number;
  fills: number;
  spared: number;
  violence: number;
  rising: number;
  plot: number;
  sect: number;
  groups: number;
} | null {
  const row = orgLandsStore(world)?.get(cell);
  if (!row) return null;
  return {
    group: row[ORG_ROW.group]! > 0 ? row[ORG_ROW.group]! - 1 : null,
    kind: row[ORG_ROW.kind]! > 0 ? row[ORG_ROW.kind]! - 1 : null,
    hold: row[ORG_ROW.hold]! / 1000,
    prey: row[ORG_ROW.prey]! / 1000,
    seaPrey: row[ORG_ROW.seaPrey]! / 1000,
    guard: row[ORG_ROW.guard]! / 1000,
    fills: row[ORG_ROW.fills]! / 1000,
    spared: row[ORG_ROW.spared]! / 1000,
    violence: row[ORG_ROW.killings]! / 10,
    rising: row[ORG_ROW.rising]! / 1000,
    plot: row[ORG_ROW.plot]! / 1000,
    sect: row[ORG_ROW.sect]! / 1000,
    groups: row[ORG_ROW.groups]!,
  };
}

/** Of a land's young, the share killed a year by its groups (0 where nothing is kept). */
export const orgYoungKilledOf = (world: World, cell: number): number =>
  at(world, cell, ORG_ROW.young) / 1e6;
/** Of a land's deaths, the share mutual aid spares (0 where nothing is kept). */
export const orgSparedOf = (world: World, cell: number): number =>
  // (And what its clergy's alms and its shared risk spare: sim/order/institutions.ts. Nothing where none is kept.)
  at(world, cell, ORG_ROW.spared) / 1000 + almsSparedIn(world, cell);
/** Of a land's roofless, the share its mutual-aid societies take in (0 where nothing is kept). */
export const orgShelteredOf = (world: World, cell: number): number =>
  at(world, cell, ORG_ROW.sheltered) / 1000;
/** Of a land's trade by road, or by sea, the share preyed on a year (0 where nothing is kept). */
export const orgPreyedOf = (world: World, cell: number, sea = false): number =>
  at(world, cell, sea ? ORG_ROW.seaPrey : ORG_ROW.prey) / 1000;
/** Of a land's people of a pressed faith, how far a sect of their own keeps them in it (0 where nothing is kept). */
export const orgSectOf = (world: World, cell: number): number =>
  at(world, cell, ORG_ROW.sect) / 1000;
/** Of what a land's courts leave undone, the share its own groups hold to (0 where nothing is kept). */
export const orgFillsOf = (world: World, cell: number): number =>
  // (And what an honest watch and court hold to: sim/order/institutions.ts. Nothing where none is kept.)
  at(world, cell, ORG_ROW.fills) / 1000 + lawHeldIn(world, cell);
/** How far a land's own rule thins its seat's reach (0 where nothing is kept). */
export const orgThinsOf = (world: World, cell: number): number =>
  at(world, cell, ORG_ROW.thins) / 1000;

/** How far a land is held as a refuge by those who fled there (0 … 1; 0 where nothing is kept): a free land to flee to. */
export const orgRefugeOf = (world: World, cell: number): number =>
  at(world, cell, ORG_ROW.refuge) / 1000;
/** How far a learned society holds in a land (0 … 1; 0 where nothing is kept). */
export const orgInquiryOf = (world: World, cell: number): number =>
  at(world, cell, ORG_ROW.inquire) / 1000;
/** What a monastic order on a land keeps a year for learning and stores (grain's worth; 0 where nothing is kept). */
export const orgCloisterKeepsOf = (world: World, cell: number): number =>
  at(world, cell, ORG_ROW.keeps);

/**
 * How far an interest of a realm is organised in a party (0 … 1: the share of its people it holds to its own candidate), and its
 * group; 0 where it has none.
 */
export function orgPartyOf(world: World, realm: Ref, interest: string): number {
  const v = orgsOf(world)?.of(realm);
  if (!v) return 0;
  let best = 0;
  for (const g of v.orgs)
    if (g.identity === interest && g.organised) best = Math.max(best, g.organised / 1000);
  return best;
}

/** How organised a realm's would-be risers are (0 … 1), and its plotters, at its seat and across its lands (0: nothing kept). */
export function risingOrganised(world: World, realm: Ref): { rising: number; plot: number } {
  const v = orgsOf(world)?.of(realm);
  return v
    ? { rising: (v.rising ?? 0) / 1000, plot: (v.plot ?? 0) / 1000 }
    : { rising: 0, plot: 0 };
}

/**
 * The men a realm has hired or licensed from groups (heads, each worth ORG.veteran levied men): the companies and privateers whose
 * patron it is, kept in any realm's record. 0 where none are.
 */
export function hiredBy(world: World, realm: Ref): number {
  return orgsOf(world)?.hired(realm) ?? 0;
}
