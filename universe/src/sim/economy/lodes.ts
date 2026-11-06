// What a land's lodes have given (E1): how much of each has been dug, how deep, and which are done. Only what has been
// dug is kept, and every land's first lode is a number more in a save only once someone digs it. The one rule of ore
// (ore.ts, heat.ts) asks here whether a lode is done; the crafters' year tells here what it took (worked.ts).
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";
import { LODE_KINDS } from "../../rules/index.ts";

/** A lode of a land: how much is gone, the depth reached, and when it was last done. */
export type Lode = {
  readonly cell: number;
  readonly kind: string;
  /** All that has been dug out of it, in what its smelters and diggers made. */
  dug: number;
  /** The depth it is worked at (LODE.depths). */
  tier: number;
  /** The year it gave out, while it is done (null: it is worked, or could be). */
  out: number | null;
  /** The event of its giving out (kept while it is the last word on it). */
  ref: Ref | null;
  /** The year its first working gave out, for ever. */
  first: number | null;
};

/** What a world's lodes have come to, for ever (a world's own total: small ones leave the log). */
export type LodeTally = {
  out: number;
  deeper: number;
  reopened: number;
  /** Where its people turned, when one gave out: a neighbour's, far off, a road, its store, nothing. */
  neighbour: number;
  far: number;
  road: number;
  store: number;
  none: number;
  /** Towns of a land that gave out, and those of them whose whole trade it was. */
  towns: number;
  whole: number;
  /** Who left a land for it, in all. */
  left: number;
};

const emptyTally = (): LodeTally => ({
  out: 0,
  deeper: 0,
  reopened: 0,
  neighbour: 0,
  far: 0,
  road: 0,
  store: 0,
  none: 0,
  towns: 0,
  whole: 0,
  left: 0,
});

const keyOf = (cell: number, kind: string) => cell * 8 + LODE_KINDS.indexOf(kind);

export class LodeStore implements StateStore {
  readonly name = "economy.lodes";
  private readonly lodes = new Map<number, Lode>();
  /** Lodes dug this year, to look at when the year's digging is done (not state: the year's own). */
  readonly dugNow = new Set<number>();
  /** A land's people still feeling a mine's end: the year, and how hard it pushes them. */
  private readonly felt = new Map<number, [number, number]>();
  tally: LodeTally = emptyTally();
  /** The last year the Years were told of one. */
  lastGreat = -1000;
  /** Which kinds have moved from what the world laid down (not state: read from the lodes). */
  private readonly moved = new Set<string>();
  /** Answers worked out since a lode near moved, by the land and kind asked about (not state). */
  private readonly answers = new Map<number, Map<string, unknown>>();
  /** What each lode holds at its first depth (not state: a pure function of the world). */
  readonly sizes = new Map<number, number>();

  /** Whether a kind's lodes have moved at all: until then the world's own answer stands. */
  movedKind(kind: string): boolean {
    return this.moved.size > 0 && this.moved.has(kind);
  }
  get(cell: number, kind: string): Lode | undefined {
    return this.lodes.get(keyOf(cell, kind));
  }
  all(): Lode[] {
    return [...this.lodes.values()].sort((a, b) => keyOf(a.cell, a.kind) - keyOf(b.cell, b.kind));
  }
  /** Whether a lode is done, at the depth it was left at. */
  isOut(cell: number, kind: string): boolean {
    return (this.lodes.get(keyOf(cell, kind))?.out ?? null) !== null;
  }
  /** The depth a lode is worked at. */
  tierOf(cell: number, kind: string): number {
    return this.lodes.get(keyOf(cell, kind))?.tier ?? 0;
  }
  /** Set down what a year's digging took. */
  dig(cell: number, kind: string, amount: number): void {
    if (amount <= 0) return;
    const key = keyOf(cell, kind);
    let lode = this.lodes.get(key);
    if (!lode) {
      lode = { cell, kind, dug: 0, tier: 0, out: null, ref: null, first: null };
      this.lodes.set(key, lode);
    }
    lode.dug += Math.round(amount);
    this.dugNow.add(key);
  }
  byKey(key: number): Lode | undefined {
    return this.lodes.get(key);
  }
  /** Lodes that are done. */
  done(): Lode[] {
    return this.all().filter((l) => l.out !== null);
  }
  /** A lode has moved: what its land and those about it may reach is asked again (a copper lode's arsenic is tin's). */
  changed(kind: string, around: readonly number[]): void {
    this.moved.add(kind);
    for (const c of around) {
      this.answers.delete(keyOf(c, kind));
      if (kind === "copper") this.answers.delete(keyOf(c, "tin"));
    }
  }
  answer<T>(cell: number, kind: string, how: string, work: () => T): T {
    const key = keyOf(cell, kind);
    let kept = this.answers.get(key);
    if (!kept) this.answers.set(key, (kept = new Map()));
    if (kept.has(how)) return kept.get(how) as T;
    const found = work();
    kept.set(how, found);
    return found;
  }
  /** A land's people have lost their mine. */
  feel(cell: number, year: number, push: number): void {
    this.felt.set(cell, [year, Math.max(push, this.felt.get(cell)?.[1] ?? 0)]);
  }
  feltBy(cell: number): readonly [number, number] | undefined {
    return this.felt.get(cell);
  }
  /** Who are no longer feeling it. */
  forgetFelt(before: number): void {
    for (const [c, [year]] of this.felt) if (year < before) this.felt.delete(c);
  }
  pinned(): Ref[] {
    return this.all().flatMap((l) => (l.ref ? [l.ref] : []));
  }
  dormant(): boolean {
    return this.lodes.size === 0;
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    for (const l of this.all())
      h.int(l.cell)
        .string(l.kind)
        .float(l.dug)
        .int(l.tier)
        .int(l.out ?? -1)
        .string(l.ref ?? "")
        .int(l.first ?? -1);
    h.value({
      felt: [...this.felt.entries()].sort((a, b) => a[0] - b[0]),
      tally: this.tally,
      last: this.lastGreat,
    });
  }
  save(): unknown {
    return {
      lodes: this.all().map((l) => [
        l.cell,
        LODE_KINDS.indexOf(l.kind),
        l.dug,
        l.tier,
        l.out,
        l.ref,
        l.first,
      ]),
      felt: [...this.felt.entries()].sort((a, b) => a[0] - b[0]),
      tally: this.tally,
      last: this.lastGreat,
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      lodes?: [number, number, number, number, number | null, Ref | null, number | null][];
      felt?: [number, [number, number]][];
      tally?: Partial<LodeTally>;
      last?: number;
    };
    this.lodes.clear();
    this.felt.clear();
    this.moved.clear();
    this.answers.clear();
    this.dugNow.clear();
    for (const [cell, kind, dug, tier, out, ref, first] of s.lodes ?? []) {
      const name = LODE_KINDS[kind]!;
      this.lodes.set(keyOf(cell, name), { cell, kind: name, dug, tier, out, ref, first });
      if (tier > 0 || out !== null) this.moved.add(name);
    }
    for (const [c, v] of s.felt ?? []) this.felt.set(c, [v[0], v[1]]);
    this.tally = { ...emptyTally(), ...s.tally };
    this.lastGreat = s.last ?? -1000;
  }
}

export function lodesOf(world: World): LodeStore | null {
  return world.hasStore("economy.lodes") ? world.store<LodeStore>("economy.lodes") : null;
}
