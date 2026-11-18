// What the underworld keeps (sim/order/underworld.ts; the rules are rules/underworld.ts), and what the older systems read of it. One
// record a realm (its groups, at most UNDER.most; its street federations, at most UNDER.feds; its gang wars and the groups whose hold
// ended, a few each), and one row a land (who holds it, the killing, what is protected and extorted, its street's gangs). Both are
// bounded by the realms and lands a world has; nothing grows with history. This file reaches only the kernel and Round B's kept rows,
// so the population, the economy, the society and the order can read it without a circle. Every reader gives back exactly what the
// world did before where nothing is kept.
import { Hasher, type Ref, type StateStore, type World } from "../../kernel/index.ts";
import { RowStore } from "../money/kept.ts";

/** A group's boss: a figure with a birth year, as a house keeps its head. */
export type Boss = { name: string; born: number; since: number };

/** One crime group. Shares in thousandths; heads whole; grain's worth a year. */
export type CrimeGroup = {
  readonly id: number;
  /** Its name, the proper word only (its kind says the rest: the X family, the X cartel, the X squad). */
  readonly name: string;
  /** By GROUP_KINDS: protection, cartel, badge (it may turn from one road to another). */
  kind: number;
  readonly since: number;
  /** The event it rose by (its page's ref is made of it). */
  readonly event: Ref;
  /** Its home land, and the lands it holds (the home first; none for a badge crew, which works its realm's towns). */
  readonly home: number;
  lands: number[];
  boss: Boss;
  /** Its bosses so far. */
  bosses: number;
  members: number;
  wealth: number;
  income: number;
  /**
   * Its weight among its road's groups, in thousandths (toward its strength's share of theirs: what a land two of them hold is
   * parted by, and the men it can draw; its income is the rent of the lands it holds); its power (its men and wealth among
   * all the realm's groups).
   */
  share: number;
  power: number;
  /** What it lives on (bits, by RACKETS). */
  rackets: number;
  /** Those it killed and lost a year, last reckoned (heads); what it pays officers and judges a year. */
  violence: number;
  bribes: number;
  /** The great house that shelters it (round H), by name; the group it split from. */
  house?: string;
  readonly of?: number;
  /** 1: a death squad (a badge crew that kills those it hunts). */
  squad?: number;
  /**
   * What it has of arms, armour and carriers, hidden carriage and guarded word (thousandths of the best there is to be had), and
   * what they cost it a year (grain's worth). Absent until it is first reckoned with them.
   */
  means?: { arms: number; armour: number; hidden: number; word: number; cost: number };
};

/** A federation of a realm's street gangs: one identity's gangs allied across its towns. */
export type Federation = {
  readonly id: number;
  readonly name: string;
  readonly since: number;
  readonly event: Ref;
  /** Whom its gangs are: a faith's ref, or "folk" for those of the seat's own people, "strangers" for others. */
  readonly identity: string;
  towns: number[];
  gangs: number;
  members: number;
  /** Its strength (thousandths), its rival federation's id (absent: none), the group that supplies it (absent: none). */
  strength: number;
  rival?: number;
  supplier?: number;
  /** Of its young, those jailed a year (heads): ties made inside. */
  jailed: number;
};

/** A war between two groups over a rent: who, since when, and its end. */
export type GangWar = {
  readonly a: number;
  readonly b: number;
  readonly names: readonly [string, string];
  readonly kind: number;
  readonly since: number;
  /** Its opening, as told; of one ended in the reckoning it opened, never told as opened: the end of the group that ended it. */
  event: Ref;
  ended: number | null;
  /** Those it killed, all told (heads). */
  fallen: number;
  /**
   * What its peace was made on: each of its road's groups and its share of the road's strength (thousandths) when it ended.
   * None on a war ended by a group's end, or before this was kept: such a peace wears by its years alone.
   */
  at?: readonly (readonly [number, number])[];
  /**
   * How it ended: "peace" (tired out, neither beaten: the rent parted at what each had left), or how the one of its two that
   * ended went ("taken over" by the other, "put down", "disarmed", "crushed", "withered", "absorbed"), and which of the two that
   * was (0: the first named). Absent while it is fought, and on a war ended before this was kept.
   */
  how?: string;
  lost?: 0 | 1;
};

/** A group whose hold ended: its name and kind, when and how, who took it in, its rise and its end. */
export type GoneGroup = {
  readonly name: string;
  readonly kind: number;
  readonly since: number;
  readonly year: number;
  readonly how: string;
  readonly into?: string;
  readonly rose: Ref;
  readonly event: Ref;
};

/** Soldiers sent against a group: whom, since when, how many, what it has cost, and how it ended. */
export type Operation = {
  readonly id: number;
  /** The group it is against (its id and name, its kind), its lands when it began. */
  readonly target: number;
  readonly name: string;
  readonly kind: number;
  readonly lands: readonly number[];
  readonly since: number;
  /** The event it began by (its page's ref is made of it). */
  readonly event: Ref;
  soldiers: number;
  /** All told: soldiers dead, the group's men taken or killed, others killed, people driven from their homes, grain's worth spent. */
  fallen: number;
  taken: number;
  bystanders: number;
  displaced: number;
  spent: number;
  /** Its bosses taken, its clashes told. */
  bosses: number;
  clashes: number;
  ended: number | null;
  how?: string;
  endEvent?: Ref;
};

/** A realm's underworld. Shares in thousandths; heads whole; grain's worth a year. */
export type RealmUnderworld = {
  last: number;
  next: number;
  /** The want of private protection, the supply of men skilled in violence and idle (thousandths), the pool (heads), veterans (heads). */
  want: number;
  supply: number;
  pool: number;
  veterans: number;
  /** The protection market, the ban's rent, the tariff's and sanctions', the rent of a banning neighbour's border (grain's worth a year). */
  protectRent: number;
  banRent: number;
  tariffRent: number;
  borderRent: number;
  /** The rent of the wares war, a house's licence or a bar on arms makes contraband (money/contraband.ts; absent in older saves). */
  wareRent?: number;
  /** The share of the smuggling rents those outside the law can take (thousandths), and what that comes to. */
  captured: number;
  smuggleRent: number;
  /** How hard the state cracks down, as it means to and as it bites (thousandths); how far its officers are bought. */
  crackdown: number;
  bites: number;
  collusion: number;
  /** What its crackdown costs a year and seizes (grain's worth). */
  cost: number;
  seized: number;
  /** The killing a year in its lands (heads): of the groups, of the street, of the badge. */
  killings: number;
  street: number;
  badge: number;
  /** Its trade extorted (thousandths); the badge's pull (thousandths). */
  extortion: number;
  badgePull: number;
  /** A badge crew found out: the year and the event (its standing hit fades from then). */
  scandal?: { readonly year: number; readonly event: Ref };
  /** The events of its crackdown begun and of its pact with the groups (null: none yet); what it has told (bits). */
  crackEvent: Ref | null;
  pactEvent: Ref | null;
  told: number;
  groups: CrimeGroup[];
  feds: Federation[];
  wars: GangWar[];
  gone: GoneGroup[];
  /** Its soldiers sent against groups (at most ESCALATE.most at once, a few ended remembered); absent in older records. */
  ops?: Operation[];
  /** A truce with a group (its id and name, since, until, the event), and the year it came to be known (its standing hit). */
  truce?: { gid: number; name: string; since: number; until: number; event: Ref; known?: number };
};

export const UNDERWORLD_STORE = "order.underworld";

export class UnderworldStore implements StateStore {
  readonly name = UNDERWORLD_STORE;
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly realms = new Map<Ref, RealmUnderworld>();
  /** Every realm's record folded in as it is set: a checkpoint hashes this, not every group (O(1) a checkpoint). */
  private digest = "";
  private sets = 0;
  dormant(): boolean {
    return this.realms.size === 0 && this.sets === 0;
  }
  of(realm: Ref): Readonly<RealmUnderworld> | undefined {
    return this.realms.get(realm);
  }
  put(realm: Ref, v: RealmUnderworld): void {
    this.realms.set(realm, v);
    this.digest = new Hasher().string(this.digest).string(realm).value(v).hex();
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
      for (const g of v.groups) out.push(g.event);
      for (const f of v.feds) out.push(f.event);
      for (const w of v.wars) out.push(w.event);
      for (const o of v.ops ?? []) out.push(o.event, ...(o.endEvent ? [o.endEvent] : []));
      if (v.truce) out.push(v.truce.event);
      for (const g of v.gone) out.push(g.rose, g.event);
      if (v.scandal) out.push(v.scandal.event);
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
      realms?: [Ref, RealmUnderworld][];
      digest?: string;
      sets?: number;
    } | null;
    for (const [r, v] of s?.realms ?? []) this.realms.set(r, v);
    this.digest = s?.digest ?? "";
    this.sets = s?.sets ?? 0;
  }
}

export function underworldOf(world: World): UnderworldStore | null {
  return world.hasStore(UNDERWORLD_STORE) ? world.store<UnderworldStore>(UNDERWORLD_STORE) : null;
}

/** A land's row: who holds it and what that does there. Thousandths unless said. */
export const GANGS_STORE = "order.gangs";
export const GANG_ROW = {
  /** The strongest group's control of it, that group's id (one more; 0: none) and kind (one more). */
  control: 0,
  group: 1,
  kind: 2,
  /** Those killed a year (millionths of its people), and of its young (millionths of its young). */
  killings: 3,
  young: 4,
  /** Of its trade, the share under a protector and the share extorted. */
  protection: 5,
  extortion: 6,
  /** Its town's small gangs (a count), their pull (thousandths), their federations (ids, one more; 0: none). */
  gangs: 7,
  street: 8,
  fedA: 9,
  fedB: 10,
  /** How far a badge crew works it (thousandths), how far killing keeps newcomers from its town, its young jailed a year (heads). */
  badge: 11,
  deter: 12,
  jailed: 13,
  /** Of its deals kept, the share lost to an enforcer who is a crew of his own. */
  trust: 14,
} as const;
export const GANGS_WIDTH = 15;

export function gangsStore(world: World): RowStore | null {
  return world.hasStore(GANGS_STORE) ? world.store<RowStore>(GANGS_STORE) : null;
}

// —— What the older systems read ——————————————————————————————————————————————————————————————————————————

/**
 * A land's underworld as a lens reads it (the Underworld lens's "Gangs" view): the strongest group's control (0 … 1) and its name's
 * id, the killing (a year, in a hundred thousand of its people), the share of its trade under a protector, its street gangs' pull
 * (0 … 1) and their count, and how far a badge crew works it. Null where nothing is kept.
 */
export function groupsIn(
  world: World,
  cell: number,
): {
  control: number;
  group: number | null;
  kind: number | null;
  violence: number;
  protection: number;
  street: number;
  gangs: number;
  badge: number;
} | null {
  const row = gangsStore(world)?.get(cell);
  if (!row) return null;
  return {
    control: row[GANG_ROW.control]! / 1000,
    group: row[GANG_ROW.group]! > 0 ? row[GANG_ROW.group]! - 1 : null,
    kind: row[GANG_ROW.kind]! > 0 ? row[GANG_ROW.kind]! - 1 : null,
    violence: row[GANG_ROW.killings]! / 10,
    protection: row[GANG_ROW.protection]! / 1000,
    street: row[GANG_ROW.street]! / 1000,
    gangs: row[GANG_ROW.gangs]!,
    badge: row[GANG_ROW.badge]! / 1000,
  };
}

/** Of a land's young, the share killed a year by the underworld (0 where nothing is kept). */
export function youngKilledOf(world: World, cell: number): number {
  return (gangsStore(world)?.at(cell, GANG_ROW.young) ?? 0) / 1e6;
}
/** Of a land's people, the share killed a year by the underworld (0 where nothing is kept). */
export function killedOf(world: World, cell: number): number {
  return (gangsStore(world)?.at(cell, GANG_ROW.killings) ?? 0) / 1e6;
}
/** Of a land's trade, the share under a protector and the share extorted (0 where nothing is kept). */
export function protectedOf(world: World, cell: number): { protection: number; extortion: number } {
  const s = gangsStore(world);
  return {
    protection: (s?.at(cell, GANG_ROW.protection) ?? 0) / 1000,
    extortion: (s?.at(cell, GANG_ROW.extortion) ?? 0) / 1000,
  };
}
/** Of a land's deals kept, the share lost to enforcers who are a crew of their own (0 where nothing is kept). */
export function trustLostOf(world: World, cell: number): number {
  return (gangsStore(world)?.at(cell, GANG_ROW.trust) ?? 0) / 1000;
}
/** How far killing in a land keeps newcomers from its town (0 … 1; 0 where nothing is kept). */
export function gangDeterOf(world: World, cell: number): number {
  return (gangsStore(world)?.at(cell, GANG_ROW.deter) ?? 0) / 1000;
}
/** A land's street gangs' pull (0 … 1; 0 where nothing is kept). */
export function streetGangsOf(world: World, cell: number): number {
  return (gangsStore(world)?.at(cell, GANG_ROW.street) ?? 0) / 1000;
}

/** What a realm's groups add to what is skimmed a year: the officers and judges they buy (0 where nothing is kept). */
export function underworldSkim(world: World, realm: Ref): number {
  const v = underworldOf(world)?.of(realm);
  return v ? (0.012 * v.collusion) / 1000 : 0;
}

/** How far a realm's officers are bought by its groups (0 … 1; 0 where nothing is kept). */
export function collusionIn(world: World, realm: Ref): number {
  return (underworldOf(world)?.of(realm)?.collusion ?? 0) / 1000;
}

/**
 * How strongly those who carry a realm's forbidden trade are organised (0 … 1), as its groups are: the share of the smuggling rent
 * outside hands take, as far as named groups hold it, and a badge crew that sells the trade its protection. Null where no record is
 * kept (the old reckoning stands: rules/intox.ts cartel).
 */
export function organisedOf(world: World, realm: Ref): number | null {
  const v = underworldOf(world)?.of(realm);
  if (!v) return null;
  let held = 0,
    shaken = 0,
    hidden = 0;
  for (const g of v.groups) {
    if (g.kind === 1) held += g.share / 1000;
    if (g.kind === 1) hidden = Math.max(hidden, (g.means?.hidden ?? 0) / 1000);
    if (g.kind === 2 && !g.squad) shaken = Math.max(shaken, g.power / 1000);
  }
  // (And its cartels' hidden carriage, past borders and blockades.)
  return Math.min(1, (v.captured / 1000) * Math.min(1, held) + 0.5 * shaken + 0.3 * hidden);
}

/** The best hidden carriage a realm's cartels have (0 … 1; 0 where nothing is kept). */
export function hiddenOf(world: World, realm: Ref): number {
  let most = 0;
  for (const g of underworldOf(world)?.of(realm)?.groups ?? [])
    if (g.kind === 1) most = Math.max(most, (g.means?.hidden ?? 0) / 1000);
  return most;
}

/** How hard a realm's crackdown bites (0 … 1; 0 where nothing is kept). */
export function bitesOf(world: World, realm: Ref): number {
  return (underworldOf(world)?.of(realm)?.bites ?? 0) / 1000;
}

// —— How strong what is forbidden has grown (the iron law of prohibition) ———————————————————————————————————

/** A realm's row: its trade's strength (hundredths: doses per bulk against the grown), its made share, the most it could reach
 * grown and made (hundredths), the premium on bulk (thousandths), the year it was last reckoned, what it has told (bits). */
export const POTENCY_STORE = "money.potency";
export const POT_ROW = {
  potency: 0,
  made: 1,
  grown: 2,
  most: 3,
  premium: 4,
  year: 5,
  told: 6,
} as const;
export const POTENCY_WIDTH = 7;

export function potencyStore(world: World): RowStore | null {
  return world.hasStore(POTENCY_STORE) ? world.store<RowStore>(POTENCY_STORE) : null;
}

/** How strong a realm's trade in what calms, wakes and eases has grown (1: its grown form), and its made share (0 … 1). */
export function potencyOf(
  world: World,
  realm: string | null | undefined,
): { potency: number; made: number } {
  const row = realm ? potencyStore(world)?.get(realm) : undefined;
  return row
    ? { potency: Math.max(1, row[POT_ROW.potency]! / 100), made: row[POT_ROW.made]! / 1000 }
    : { potency: 1, made: 0 };
}

/** The soldiers a realm keeps in a land against a crime group (0: none sent there), for the Underworld lens. */
export function soldiersIn(world: World, realm: Ref, cell: number): number {
  let n = 0;
  for (const o of underworldOf(world)?.of(realm)?.ops ?? [])
    if (o.ended === null && o.lands.includes(cell)) n += o.soldiers / Math.max(1, o.lands.length);
  return Math.round(n);
}
