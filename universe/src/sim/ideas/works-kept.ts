// What the world keeps of its works (sim/ideas/works.ts; the rules are rules/ideas.ts WORK): a few a land, each a short record
// (who made it, for whom, when, what it remembers), and for each land the one thing of late most worth remembering. What the
// older systems read of them: whether an event is carried by a work (a realm's memory of it fades the slower: sim/order), what a
// land's works add to its renown (sim/culture/art.ts), and what a patron is credited (a seat's standing, a house's power). Each
// reader gives back exactly what the world did before where no work is kept. Bounded: WORK.keepLand a land, WORK.keepWorld a
// world. This file reaches only the kernel and the rules.
import { Hasher, type Ref, type StateStore, type World } from "../../kernel/index.ts";
import { NOTE, WORK, creditLeft, workRenownNow } from "../../rules/index.ts";

/** Who paid for a work: a realm's seat (its ref), a great house or a body (the event it rose by), its name then, its realm then. */
export type Patron = {
  readonly kind: "seat" | "house" | "body";
  readonly ref: string;
  readonly name: string;
  readonly realm: Ref;
};

export type Work = {
  readonly id: number;
  /** Its name, a word of its makers' tongue. */
  readonly title: string;
  /** By WORK_FORMS. */
  readonly form: number;
  readonly year: number;
  readonly land: number;
  /** Its maker (a notable's id, their name as it was). */
  readonly maker: number;
  readonly by: string;
  readonly patron: Patron;
  /** What it remembers: the event, its kind, its year. */
  readonly of: Ref;
  readonly theme: string;
  readonly ofYear: number;
  /** Its renown when made (thousandths of a line), and the event of its making. */
  readonly renown: number;
  readonly event: Ref;
};

/** What a land has of late most worth remembering: the event, its kind, its weight, its year, and whether a work was made of it. */
export type Worth = { e: Ref; type: string; w: number; y: number; used: boolean };

export const WORKS_STORE = "ideas.works";
export const workRef = (id: number): string => `work:${id}`;
export const workId = (ref: string): number => Number(ref.slice(ref.lastIndexOf(":") + 1));

type Saved = {
  next: number;
  seen: number;
  works: Work[];
  worth: [number, Ref, string, number, number, number][];
  /** Absent in a save from before a land's own history was weighed. */
  told?: [number, number[]][];
  digest: string;
};

const patronKey = (kind: Patron["kind"], ref: string): string => `${kind} ${ref}`;

export class WorksStore implements StateStore {
  readonly name = WORKS_STORE;
  /** Saved packed by column (kernel/pack.ts): one list of records of one shape. */
  readonly packed = true;
  private next = 1;
  /** The serial of the last event read for what is worth remembering. */
  seen = 0;
  private list: Work[] = [];
  private readonly worth = new Map<number, Worth>();
  /**
   * What each land has been through before, by kind: pairs of a kind's number (its type's hash, 16 bits) and how many times
   * (in tenths, halved each WORK.back years), the WORK.kinds most told. What stands out for a land is weighed against this.
   */
  private readonly told = new Map<number, number[]>();
  private digest = "";
  // (Read off the works, never saved.)
  private readonly byId = new Map<number, Work>();
  private readonly byLand = new Map<number, Work[]>();
  private readonly carried = new Map<Ref, number>();
  private readonly byPatron = new Map<string, Work[]>();

  dormant(): boolean {
    return this.list.length === 0 && this.seen === 0;
  }
  mint(): number {
    return this.next++;
  }
  all(): readonly Work[] {
    return this.list;
  }
  get(id: number): Work | undefined {
    return this.byId.get(id);
  }
  in(cell: number): readonly Work[] {
    return this.byLand.get(cell) ?? NONE;
  }
  for(kind: Patron["kind"], ref: string): readonly Work[] {
    return this.byPatron.get(patronKey(kind, ref)) ?? NONE;
  }
  carries(event: Ref): boolean {
    return this.carried.has(event);
  }
  worthIn(cell: number): Worth | undefined {
    return this.worth.get(cell);
  }
  /** How many times a land has been through a thing of this kind before (0: never), and one more told. */
  toldBefore(cell: number, kind: number): number {
    const row = this.told.get(cell);
    if (row) for (let i = 0; i < row.length; i += 2) if (row[i] === kind) return row[i + 1]! / 10;
    return 0;
  }
  tell(cell: number, kind: number): void {
    let row = this.told.get(cell);
    if (!row) this.told.set(cell, (row = []));
    for (let i = 0; i < row.length; i += 2)
      if (row[i] === kind) {
        row[i + 1] = row[i + 1]! + 10;
        return;
      }
    if (row.length >= 2 * WORK.kinds) {
      // (The least told gives its place.)
      let least = 0;
      for (let i = 2; i < row.length; i += 2) if (row[i + 1]! < row[least + 1]!) least = i;
      row[least] = kind;
      row[least + 1] = 10;
    } else row.push(kind, 10);
  }
  /** What a land has been through fades: halved, and what is all but forgotten let go. */
  fadeTold(): void {
    for (const [c, row] of [...this.told]) {
      const kept: number[] = [];
      for (let i = 0; i < row.length; i += 2)
        if (row[i + 1]! >= 4) kept.push(row[i]!, Math.floor(row[i + 1]! / 2));
      if (kept.length) this.told.set(c, kept);
      else this.told.delete(c);
    }
  }
  setWorth(cell: number, w: Worth | null): void {
    if (w) this.worth.set(cell, w);
    else this.worth.delete(cell);
  }
  private index(w: Work): void {
    this.byId.set(w.id, w);
    const l = this.byLand.get(w.land);
    if (l) l.push(w);
    else this.byLand.set(w.land, [w]);
    this.carried.set(w.of, (this.carried.get(w.of) ?? 0) + 1);
    const key = patronKey(w.patron.kind, w.patron.ref),
      p = this.byPatron.get(key);
    if (p) p.push(w);
    else this.byPatron.set(key, [w]);
  }
  private reindex(): void {
    this.byId.clear();
    this.byLand.clear();
    this.carried.clear();
    this.byPatron.clear();
    for (const w of this.list) this.index(w);
  }
  add(w: Work): void {
    this.list.push(w);
    this.index(w);
  }
  /** Works lost: these ids are let go. */
  lose(ids: ReadonlySet<number>): void {
    if (!ids.size) return;
    this.list = this.list.filter((w) => !ids.has(w.id));
    this.reindex();
  }
  /** The year's state folded in: a checkpoint hashes this, not every work. */
  fold(year: number): void {
    const h = new Hasher().string(this.digest).int(year).int(this.next).int(this.seen);
    h.int(this.list.length);
    for (const w of this.list) h.int(w.id).int(w.land).int(w.renown);
    h.int(this.worth.size).int(this.told.size);
    this.digest = h.hex();
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const w of this.list) out.push(w.event, w.of);
    for (const w of this.worth.values()) out.push(w.e);
    return out;
  }
  hashInto(h: Hasher): void {
    h.int(this.list.length).int(this.next).int(this.seen).int(this.worth.size).string(this.digest);
  }
  save(): unknown {
    const s: Saved = {
      next: this.next,
      seen: this.seen,
      works: this.list,
      worth: [...this.worth]
        .sort((a, b) => a[0] - b[0])
        .map(([c, w]) => [c, w.e, w.type, w.w, w.y, w.used ? 1 : 0]),
      told: [...this.told].sort((a, b) => a[0] - b[0]),
      digest: this.digest,
    };
    return s;
  }
  load(state: unknown): void {
    const s = state as Partial<Saved> | null;
    this.next = s?.next ?? 1;
    this.seen = s?.seen ?? 0;
    this.list = [...(s?.works ?? [])];
    this.worth.clear();
    for (const [c, e, type, w, y, used] of s?.worth ?? [])
      this.worth.set(c, { e, type, w, y, used: !!used });
    this.told.clear();
    for (const [c, row] of s?.told ?? []) this.told.set(c, [...row]);
    this.digest = s?.digest ?? "";
    this.reindex();
  }
}

const NONE: readonly Work[] = [];

export function worksOf(world: World): WorksStore | null {
  return world.hasStore(WORKS_STORE) ? world.store<WorksStore>(WORKS_STORE) : null;
}

// —— What the older systems read (each exactly as before where no work is kept) ————————————————————————————————

/** Of what a memory loses in a year, the share lost where a work carries its event (1 where none does): sim/order/order.ts. */
export function memoryLost(world: World, event: Ref): number {
  const store = worksOf(world);
  return store && store.carries(event) ? 1 - WORK.remembers : 1;
}

/** A land's renown, for the works kept there (1 where none): sim/culture/art.ts. */
export function worksRenown(world: World, cell: number, year: number): number {
  const works = worksOf(world)?.in(cell);
  if (!works || !works.length) return 1;
  let sum = 0;
  for (const w of works) sum += workRenownNow(w.renown, year - w.year);
  return 1 + WORK.renown * Math.min(1, sum / (WORK.renownAt * NOTE.line));
}

/** What a patron is credited for the works made for them (0 … 1; 0 where none): the freshest counted whole, each other half. */
export function patronCredit(
  world: World,
  kind: Patron["kind"],
  ref: string,
  year: number,
): number {
  const works = worksOf(world)?.for(kind, ref);
  if (!works || !works.length) return 0;
  let best = 0,
    rest = 0;
  for (const w of works) {
    const c =
      creditLeft(year - w.year) *
      Math.min(1, workRenownNow(w.renown, year - w.year) / (3 * NOTE.line));
    if (c > best) {
      rest += best;
      best = c;
    } else rest += c;
  }
  return Math.min(1, best + 0.5 * rest);
}
