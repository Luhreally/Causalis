// What the world keeps of its pilgrimages (sim/ideas/pilgrims.ts): one short record a seat that has one, and what the older
// systems read of them (what pilgrims add to what a seat's town draws). This file reaches only the kernel and the rules.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";
import { PILGRIM } from "../../rules/index.ts";

/** The going to one seat: of what (a faith's ref, a school's), to which land, how many a year, from how many lands, and its greatest ways. */
export type Pilgrimage = {
  readonly of: Ref;
  readonly seat: number;
  pilgrims: number;
  lands: number;
  /** What they leave, as a share of the seat's own keep (thousandths). */
  feed: number;
  /** Its greatest ways: a land and those who come from it a year. */
  ways: [number, number][];
  /** The year it began, and the event. */
  readonly since: number;
  readonly event: Ref;
};

export const PILGRIMS_STORE = "ideas.pilgrims";

export class PilgrimsStore implements StateStore {
  readonly name = PILGRIMS_STORE;
  private readonly by = new Map<Ref, Pilgrimage>();
  /** (Read off the records, never saved: each seat's feed, and which lands a seat's ways touch.) */
  private feeds = new Map<number, number>();

  dormant(): boolean {
    return this.by.size === 0;
  }
  get(of: Ref): Pilgrimage | undefined {
    return this.by.get(of);
  }
  all(): Pilgrimage[] {
    return [...this.by.values()].sort((a, b) => (a.of < b.of ? -1 : a.of > b.of ? 1 : 0));
  }
  set(p: Pilgrimage): void {
    this.by.set(p.of, p);
  }
  drop(of: Ref): void {
    this.by.delete(of);
  }
  /** What pilgrims leave at a land's town, as a share of its keep (0 where none come). */
  feedIn(cell: number): number {
    return (this.feeds.get(cell) ?? 0) / 1000;
  }
  reckon(): void {
    this.feeds = new Map();
    for (const p of this.by.values())
      this.feeds.set(p.seat, Math.min(1000 * PILGRIM.most, (this.feeds.get(p.seat) ?? 0) + p.feed));
  }
  pinned(): Ref[] {
    return [...this.by.values()].map((p) => p.event);
  }
  hashInto(h: Hasher): void {
    const all = this.all();
    h.int(all.length);
    for (const p of all) {
      h.string(p.of).int(p.seat).int(p.pilgrims).int(p.lands).int(p.feed).int(p.since);
      for (const [c, n] of p.ways) h.int(c).int(n);
    }
  }
  save(): unknown {
    return this.all();
  }
  load(state: unknown): void {
    this.by.clear();
    for (const p of (state as Pilgrimage[] | null) ?? [])
      this.by.set(p.of, { ...p, ways: p.ways.map(([c, n]) => [c, n]) });
    this.reckon();
  }
}

export function pilgrimsOf(world: World): PilgrimsStore | null {
  return world.peek<PilgrimsStore>(PILGRIMS_STORE) ?? null;
}

/** What pilgrims add to what a land's town draws (0 where none come): sim/population/urban.ts. */
export function pilgrimFeed(world: World, cell: number): number {
  return pilgrimsOf(world)?.feedIn(cell) ?? 0;
}
