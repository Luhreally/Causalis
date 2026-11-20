// What the world keeps of peoples abroad (sim/culture/abroad.ts; the rules are rules/abroad.ts): for a land, at most ABROAD.keep
// entries, each a people not its own (by the index of the language their land of origin speaks), their share of the land's people
// (thousandths), the land most of them came from, and the year the first of them came. Sparse: a land with no such people keeps
// nothing. And what the older systems read, each exactly what the world did before where nothing is kept. This file reaches
// only the kernel and the rules.
import type { Hasher, StateStore, World } from "../../kernel/index.ts";
import { ABROAD, kinTrade } from "../../rules/index.ts";

/** One people abroad in a land: [language index, share in thousandths, the land most came from, the year the first came]. */
export type Abroad = [people: number, share: number, home: number, since: number];

export const ABROAD_STORE = "culture.abroad";

export class AbroadStore implements StateStore {
  readonly name = ABROAD_STORE;
  private readonly by = new Map<number, Abroad[]>();
  /** The number of the last migration read (sim/population flows are numbered from the first ever). */
  seen = 0;

  dormant(): boolean {
    return this.by.size === 0 && this.seen === 0;
  }
  of(cell: number): readonly Abroad[] | undefined {
    return this.by.get(cell);
  }
  set(cell: number, list: Abroad[]): void {
    if (list.length) this.by.set(cell, list);
    else this.by.delete(cell);
  }
  /** The lands that keep any, in order. */
  /** The same lands in no order: for a pass in which each land's turn touches itself alone. */
  cells(): number[] {
    return [...this.by.keys()];
  }
  lands(): number[] {
    return [...this.by.keys()].sort((a, b) => a - b);
  }
  get size(): number {
    return this.by.size;
  }
  hashInto(h: Hasher): void {
    h.int(this.seen).int(this.by.size);
    for (const c of this.lands()) {
      h.int(c);
      for (const e of this.by.get(c)!) h.int(e[0]).int(e[1]).int(e[2]).int(e[3]);
    }
  }
  save(): unknown {
    return { seen: this.seen, by: this.lands().map((c) => [c, this.by.get(c)!]) };
  }
  load(state: unknown): void {
    const s = state as { seen?: number; by?: [number, Abroad[]][] } | null;
    this.seen = s?.seen ?? 0;
    this.by.clear();
    for (const [c, list] of s?.by ?? [])
      this.by.set(
        c,
        list.map((e) => [...e] as Abroad),
      );
  }
}

export function abroadOf(world: World): AbroadStore | null {
  return world.hasStore(ABROAD_STORE) ? world.store<AbroadStore>(ABROAD_STORE) : null;
}

// —— What the older systems read ——————————————————————————————————————————————————————————————————————————————————

/** The share of a land's people who are of peoples not its own (0 … 1; 0 where none is kept). */
export function strangersIn(world: World, cell: number): number {
  const list = abroadOf(world)?.of(cell);
  if (!list) return 0;
  let s = 0;
  for (const e of list) s += e[1];
  return Math.min(ABROAD.most, s) / 1000;
}

/**
 * What kin across a road add to what passes between two lands (a factor; exactly 1 where neither keeps people come from the
 * other): sim/economy/systems.ts.
 */
export function kinAcross(world: World, a: number, b: number): number {
  const store = abroadOf(world);
  if (!store || !store.size) return 1;
  let share = 0;
  const la = store.of(a),
    lb = store.of(b);
  if (la) for (const e of la) if (e[2] === b && e[1] > share) share = e[1];
  if (lb) for (const e of lb) if (e[2] === a && e[1] > share) share = e[1];
  return share > 0 ? kinTrade(share / 1000) : 1;
}
