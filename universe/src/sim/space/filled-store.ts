// A world filled, as history holds it (galaxy-plan.md, "Worlds filled"): for each world a people has come to, how many
// live on it beyond what any land of it holds; and the colonies sent when every kept land was taken, which no land holds
// at all. A number, not provinces: real lands are what make far years dear. It imports nothing of the space rules, and it
// holds nothing and is no part of the world's hash until a people has a colony, so a history before that holds bit for bit.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";

export type FilledWorld = {
  /** "b<index>" of a body of the home system, or "<star>/<planet>". */
  readonly key: string;
  /** Its body's index in the home system (-1: another star's). */
  readonly body: number;
  readonly star: Ref | null;
  readonly planet: number;
  /** The land it began as (null: no land holds it, every kept one being taken when it was sent). */
  readonly cell: number | null;
  /** Who sent it, and their name then; the land they left. */
  readonly realm: Ref;
  readonly name: string;
  readonly from: number;
  /** The year it left, the year it came, the way it came. */
  readonly sailed: number;
  readonly arrives: number;
  readonly distance: number;
  readonly drive: string;
  /** How many lanes it came by (0: on its drive). */
  readonly lanes: number;
  /** Those who follow, a year, while its sender stands. */
  readonly comers: number;
  /** The people who were there first and threw its comers back, who hold the rest of it (null: none do). */
  held: string | null;
  /** The event of its sending, and of its coming (null: still under way). */
  readonly voyage: Ref;
  arrived: Ref | null;
  /** Its people beyond any land of it. */
  people: number;
  /** The event of all it can settle being settled. */
  filled: Ref | null;
  filledYear: number | null;
};

export class FilledStore implements StateStore {
  readonly name = "space.filled";
  private readonly worlds = new Map<string, FilledWorld>();
  /** The first world filled to its edges. */
  first: Ref | null = null;

  dormant(): boolean {
    return !this.worlds.size;
  }
  get(key: string): FilledWorld | undefined {
    return this.worlds.get(key);
  }
  add(w: FilledWorld): void {
    this.worlds.set(w.key, w);
  }
  /** In the order they came to be: the same every time. */
  all(): FilledWorld[] {
    return [...this.worlds.values()];
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const w of this.worlds.values()) {
      out.push(w.voyage);
      if (w.arrived) out.push(w.arrived);
      if (w.filled) out.push(w.filled);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.value(this.all()).value(this.first);
  }
  save(): unknown {
    return { worlds: this.all(), first: this.first };
  }
  load(state: unknown): void {
    const s = state as { worlds: FilledWorld[]; first: Ref | null };
    this.worlds.clear();
    for (const w of s.worlds) this.worlds.set(w.key, { ...w });
    this.first = s.first ?? null;
  }
}

/** The store of worlds filling (none on a world with no space rules). */
export function filledOf(world: World): FilledStore | null {
  return world.hasStore("space.filled") ? world.store<FilledStore>("space.filled") : null;
}

export const bodyKey = (body: number) => `b${body}`;
export const starKey = (star: string, planet: number) => `${star}/${planet}`;
