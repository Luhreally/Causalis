// What the world keeps of its notable people (sim/notable/notables.ts; the rules are rules/notables.ts), and what the older
// systems read of them. The living, at most NOTE.keepWorld a world and NOTE.keepLand a land (those who hold a post besides); the
// dead, as short records, at most NOTE.goneWorld; and one row a land of its living notables' standing by domain, which is all an
// older system reads (each reader gives back exactly what the world did before where no one is kept). Bounded by the lands a
// world has; nothing grows with history. This file reaches only the kernel and the rules, so every system can read it without a
// circle.
import {
  Hasher,
  defineKind,
  makeRef,
  type Ref,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  DOMAINS,
  commandTerm,
  faithHolds,
  faithTerm,
  healTerm,
  inquiryTerm,
  renownTerm,
  speaksFor,
  ACTS,
  DOMAIN,
  NOTE,
} from "../../rules/index.ts";

/** A notable person's own reference: an event's subject, a page's address. */
export const NOTABLE = defineKind("nota", "notable person", "structural");
export const notableRef = (id: number): Ref => makeRef(NOTABLE, 0, id);

/**
 * One thing a notable did or that befell them: its year, its domain (by DOMAINS), what it was (the event's type, or "stood out":
 * crossed the line among those who do the same), the event where there is one, what it added to their standing, and a word of
 * it for their title (the thing found, the foe, the faith, the group spoken for).
 */
export type Deed = {
  readonly y: number;
  readonly d: number;
  readonly w: string;
  readonly e: Ref | null;
  readonly g: number;
  readonly n?: string;
};

/** A post one of them holds: a realm's host commanded, a group of a realm spoken for. */
export type Post = {
  readonly kind: "command" | "speaks";
  readonly of: Ref;
  readonly group?: string;
};

export type Notable = {
  readonly id: number;
  readonly name: string;
  readonly sex: number;
  /** A line of a people who keep no one apart (a hive's cohort), not one body. */
  readonly many: boolean;
  readonly born: number;
  /** The year their people first noticed them. */
  readonly since: number;
  /** Their land; the realm that held it when last read (their patron where they serve one), their land's faith then. */
  readonly home: number;
  realm: Ref | null;
  faith: Ref | null;
  /** Their standing by domain (thousandths of the line), and in all; the most it has been. */
  by: number[];
  standing: number;
  best: number;
  /** The year of their last deed. */
  last: number;
  deeds: Deed[];
  post?: Post;
  /** Who taught them, whom they are set against (ids; the dead are found among the gone). */
  teacher?: number;
  rival?: number;
  /** Someone the world already keeps whom they are (a court figure: "court:<figure id>"; a realm's ruler: "rule"), where they are. */
  as?: string;
  /** The event their rising was told by, where it was. */
  event?: Ref;
  /** Under the god's hand: blessed or cursed until a year (acts on a person reach them through this). */
  favour?: {
    readonly kind: "bless" | "curse" | "protect";
    readonly until: number;
    readonly event: Ref;
  };
};

/** One who died, or whom their people let go: what history keeps. */
export type Gone = {
  readonly id: number;
  readonly name: string;
  readonly sex: number;
  readonly many: boolean;
  readonly born: number;
  readonly since: number;
  readonly died: number;
  /** How: "age", "ills" (of their time's common ills, not old), "battle", "taken" (in battle, not seen again), "sickness", "purge", "struck" (by the god), "killed". */
  readonly how: string;
  readonly home: number;
  readonly realm: Ref | null;
  readonly faith: Ref | null;
  /** Their first domain, and their standing when they died (it fades). */
  readonly field: number;
  standing: number;
  readonly best: number;
  readonly deeds: Deed[];
  readonly teacher?: number;
  readonly rival?: number;
  readonly as?: string;
  /** The event of their death, where it was told, or the event that killed them. */
  readonly event?: Ref;
  readonly rose?: Ref;
};

export const NOTABLES_STORE = "people.notables";
export const NOTABLE_LANDS_STORE = "people.notablelands";

type Saved = {
  next: number;
  seen: number;
  living: Notable[];
  gone: Gone[];
  shaken: [Ref, number][];
  rows: [number, number[]][];
  digest: string;
};

export class NotablesStore implements StateStore {
  readonly name = NOTABLES_STORE;
  private next = 1;
  /** The serial of the last event read for its occasion. */
  seen = 0;
  private readonly living = new Map<number, Notable>();
  private goneList: Gone[] = [];
  /** A realm's host shaken by its commander's fall: until which year. */
  private readonly shaken = new Map<Ref, number>();
  /** Each land's living standing by domain (thousandths), as last summed: what the older systems read. */
  private readonly rows = new Map<number, number[]>();
  private digest = "";
  // (Read off the living, never saved: who is in each land, kept as they come and go; and who holds each realm's posts.)
  private readonly landIndex = new Map<number, Notable[]>();
  private postIndex: Map<string, Notable> | null = null;

  dormant(): boolean {
    return this.living.size === 0 && this.goneList.length === 0 && this.seen === 0;
  }
  mint(): number {
    return this.next++;
  }
  get(id: number): Notable | undefined {
    return this.living.get(id);
  }
  all(): Notable[] {
    return [...this.living.values()];
  }
  get count(): number {
    return this.living.size;
  }
  gone(): readonly Gone[] {
    return this.goneList;
  }
  goneOf(id: number): Gone | undefined {
    return this.goneList.find((g) => g.id === id);
  }
  add(n: Notable): void {
    this.living.set(n.id, n);
    const l = this.landIndex.get(n.home);
    if (l) l.push(n);
    else this.landIndex.set(n.home, [n]);
    if (n.post) this.postIndex = null;
  }
  /** One of the living is gone: dead (kept among the gone) or let go by their people (nothing kept). */
  remove(id: number, gone?: Gone): void {
    const n = this.living.get(id);
    if (!n) return;
    this.living.delete(id);
    if (gone) this.goneList.push(gone);
    const l = this.landIndex.get(n.home);
    if (l) {
      const i = l.indexOf(n);
      if (i >= 0) l.splice(i, 1);
      if (!l.length) this.landIndex.delete(n.home);
    }
    if (n.post) this.postIndex = null;
  }
  setGone(list: Gone[]): void {
    this.goneList = list;
  }
  /** A post changed in place: read who holds what again. */
  moved(): void {
    this.postIndex = null;
  }
  /** A land's living notables, in the order they came to be known. */
  in(cell: number): readonly Notable[] {
    return this.landIndex.get(cell) ?? NONE;
  }
  holder(kind: Post["kind"], of: Ref): Notable | undefined {
    if (!this.postIndex) {
      const m = new Map<string, Notable>();
      for (const n of this.living.values()) if (n.post) m.set(`${n.post.kind} ${n.post.of}`, n);
      this.postIndex = m;
    }
    return this.postIndex.get(`${kind} ${of}`);
  }
  shakenUntil(realm: Ref): number {
    return this.shaken.get(realm) ?? 0;
  }
  shake(realm: Ref, until: number): void {
    this.shaken.set(realm, until);
  }
  settle(year: number): void {
    for (const [r, y] of [...this.shaken]) if (y < year) this.shaken.delete(r);
  }
  row(cell: number): readonly number[] | undefined {
    return this.rows.get(cell);
  }
  at(cell: number, domain: number): number {
    return this.rows.get(cell)?.[domain] ?? 0;
  }
  /** Sum the living's standing land by land again (once a year, after all that moved it). */
  sum(): void {
    this.rows.clear();
    for (const n of this.living.values()) {
      let row = this.rows.get(n.home);
      if (!row) this.rows.set(n.home, (row = new Array<number>(DOMAINS.length).fill(0)));
      for (let d = 0; d < DOMAINS.length; d++) row[d]! += n.by[d] ?? 0;
    }
  }
  /** The year's state folded in: a checkpoint hashes this, not every person. */
  fold(year: number): void {
    const h = new Hasher().string(this.digest).int(year).int(this.next).int(this.seen);
    h.int(this.living.size);
    for (const n of this.living.values()) h.int(n.id).int(n.standing).int(n.home).int(n.last);
    h.int(this.goneList.length);
    for (const g of this.goneList) h.int(g.id).int(g.standing);
    this.digest = h.hex();
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const n of this.living.values()) {
      if (n.event) out.push(n.event);
      for (const d of n.deeds) if (d.e) out.push(d.e);
    }
    for (const g of this.goneList) {
      if (g.event) out.push(g.event);
      if (g.rose) out.push(g.rose);
      for (const d of g.deeds) if (d.e) out.push(d.e);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.int(this.living.size).int(this.goneList.length).int(this.next).string(this.digest);
  }
  save(): unknown {
    const s: Saved = {
      next: this.next,
      seen: this.seen,
      living: [...this.living.values()],
      gone: this.goneList,
      shaken: [...this.shaken],
      rows: [...this.rows],
      digest: this.digest,
    };
    return s;
  }
  load(state: unknown): void {
    const s = state as Partial<Saved> | null;
    this.living.clear();
    this.shaken.clear();
    this.rows.clear();
    this.landIndex.clear();
    this.postIndex = null;
    this.next = s?.next ?? 1;
    this.seen = s?.seen ?? 0;
    for (const n of s?.living ?? []) this.add(n);
    this.goneList = [...(s?.gone ?? [])];
    for (const [r, y] of s?.shaken ?? []) this.shaken.set(r, y);
    for (const [c, row] of s?.rows ?? []) this.rows.set(c, row);
    this.digest = s?.digest ?? "";
  }
}

const NONE: readonly Notable[] = [];

export function notablesOf(world: World): NotablesStore | null {
  return world.hasStore(NOTABLES_STORE) ? world.store<NotablesStore>(NOTABLES_STORE) : null;
}

// —— What the older systems read (each exactly as before where no one is kept) ————————————————————————————————

/** A land's living notables' standing in a domain (thousandths of the line; 0 where none). */
export function notedIn(world: World, cell: number, domain: number): number {
  return notablesOf(world)?.at(cell, domain) ?? 0;
}

/** How much more readily a land inquires for its learned of name (1 where none): sim/lore/lore.ts inquiresMore. */
export function notableInquires(world: World, cell: number): number {
  const s = notedIn(world, cell, DOMAIN.knowledge);
  return s > 0 ? inquiryTerm(s) : 1;
}

/** A land's renown, for its makers of name (1 where none): sim/culture/art.ts. */
export function notableRenown(world: World, cell: number): number {
  const s = notedIn(world, cell, DOMAIN.making);
  return s > 0 ? renownTerm(s) : 1;
}

/**
 * How a faith spreads from a land where one of name speaks for it (1 where none), and how a land holds to its own faith for one
 * who speaks for it there (1 where none): sim/belief/belief.ts.
 */
export function notableFaithSpreads(world: World, from: number, faith: Ref): number {
  const store = notablesOf(world);
  if (!store || !store.at(from, DOMAIN.faith)) return 1;
  let s = 0;
  for (const n of store.in(from)) if (n.faith === faith) s += n.by[DOMAIN.faith] ?? 0;
  return s > 0 ? faithTerm(s) : 1;
}
export function notableFaithHolds(world: World, cell: number, faith: Ref | null): number {
  const store = notablesOf(world);
  if (!faith || !store || !store.at(cell, DOMAIN.faith)) return 1;
  let s = 0;
  for (const n of store.in(cell)) if (n.faith === faith) s += n.by[DOMAIN.faith] ?? 0;
  return s > 0 ? faithHolds(s) : 1;
}

/**
 * Of the lands given (a faith's lands far from its seat in speech), the one where one of name speaks for that faith with standing
 * enough to lead it out, and who (null: none): sim/belief/belief.ts, where a faith splits.
 */
export function notableReformer(
  world: World,
  faith: Ref,
  lands: readonly number[],
): { cell: number; name: string } | null {
  const store = notablesOf(world);
  if (!store) return null;
  let best: Notable | undefined;
  for (const c of lands) {
    if (store.at(c, DOMAIN.faith) < ACTS.reformer * NOTE.line) continue;
    for (const n of store.in(c)) {
      const s = n.by[DOMAIN.faith] ?? 0;
      if (n.faith !== faith || s < ACTS.reformer * NOTE.line) continue;
      if (
        !best ||
        s > (best.by[DOMAIN.faith] ?? 0) ||
        (s === best.by[DOMAIN.faith] && n.id < best.id)
      )
        best = n;
    }
  }
  return best ? { cell: best.home, name: best.name } : null;
}

/** Of a land's deaths, what its healers of name leave (1 where none): sim/population/systems.ts. */
export function notableHeals(world: World, cell: number): number {
  const s = notedIn(world, cell, DOMAIN.healing);
  return s > 0 ? healTerm(s) : 1;
}

/** What one who speaks for a group of a realm adds to its candidate (0 where none does): sim/order/elections.ts. */
export function notableSpeaks(world: World, realm: Ref, group: string): number {
  const n = notablesOf(world)?.holder("speaks", realm);
  return n && n.post?.group === group ? speaksFor(n.by[DOMAIN.rule] ?? 0) : 0;
}

/**
 * A realm's host under its commander (1 where it has none): their standing, and less while the host is shaken by the last one's
 * fall. sim/war/war.ts reads it where the host's strength is reckoned.
 */
export function notableCommands(world: World, realm: Ref, year: number): number {
  const store = notablesOf(world);
  if (!store) return 1;
  const n = store.holder("command", realm),
    shaken = store.shakenUntil(realm) >= year ? 1 - ACTS.shaken : 1;
  return (n ? commandTerm(n.by[DOMAIN.war] ?? 0) : 1) * shaken;
}

/**
 * Those of a realm's lands whose standing makes them worth striking at, the greatest first (a hook for the groups: an
 * assassination or a purge names its target from this, and ends them with sim/notable/notables.ts strikeNotable).
 */
export function notableTargets(world: World, lands: readonly number[], most = 3): Notable[] {
  const store = notablesOf(world);
  if (!store) return [];
  const out: Notable[] = [];
  for (const c of lands) for (const n of store.in(c)) out.push(n);
  return out.sort((a, b) => b.standing - a.standing || a.id - b.id).slice(0, most);
}
