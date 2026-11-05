// Ages past ours as history holds them (Phase 66): the mirrors gathered about a world's star, how far
// each world being remade has come, when a world was first covered. Read by the population's rules (a
// remade body's halls cost less to keep, and its fields lie open) and written by the space rules, so it
// imports nothing of theirs. It holds nothing until a people comes to these, so that it moves nothing of
// a history it had no part in.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";

/** A world being remade: by its body's index in the home system, or (-1 - land) under another star. */
export type Remaking = {
  readonly key: number;
  /** The land that began it, and the realm that held it then. */
  readonly cell: number;
  readonly realm: Ref;
  readonly year: number;
  /** How far it has come (0 … 1). */
  share: number;
  /** The event of its beginning; of its being done. */
  readonly begun: Ref;
  done: Ref | null;
  /** The last year it went on. */
  last: number;
};

/** The mirrors about the star. */
export type Mirrors = {
  km2: number;
  readonly year: number;
  readonly realm: Ref;
  readonly begun: Ref;
  /** The event of its gathering as much as falls on the whole world (null: not yet). */
  gathered: Ref | null;
  /** The last year a realm tended them. */
  tended: number;
};

export class LateStore implements StateStore {
  readonly name = "space.late";
  mirrors: Mirrors | null = null;
  private readonly remakings = new Map<number, Remaking>();
  /** The event of a world first being covered from edge to edge. */
  covered: Ref | null = null;

  dormant(): boolean {
    return !this.mirrors && !this.remakings.size && !this.covered;
  }
  /** How far a world being remade has come (0: none), by its key. */
  share(key: number): number {
    return this.remakings.get(key)?.share ?? 0;
  }
  get(key: number): Remaking | undefined {
    return this.remakings.get(key);
  }
  add(r: Remaking): void {
    this.remakings.set(r.key, r);
  }
  all(): Remaking[] {
    return [...this.remakings.values()].sort((a, b) => a.key - b.key);
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    if (this.mirrors) {
      out.push(this.mirrors.begun);
      if (this.mirrors.gathered) out.push(this.mirrors.gathered);
    }
    if (this.covered) out.push(this.covered);
    for (const r of this.remakings.values()) {
      out.push(r.begun);
      if (r.done) out.push(r.done);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.value(this.mirrors).value(this.all()).value(this.covered);
  }
  save(): unknown {
    return { mirrors: this.mirrors, remakings: this.all(), covered: this.covered };
  }
  load(state: unknown): void {
    const s = state as { mirrors: Mirrors | null; remakings: Remaking[]; covered: Ref | null };
    this.mirrors = s.mirrors ? { ...s.mirrors } : null;
    this.covered = s.covered ?? null;
    this.remakings.clear();
    for (const r of s.remakings) this.remakings.set(r.key, { ...r });
  }
}

/** The store of what lies past our ages (none on a world with no space rules). */
export function lateOf(world: World): LateStore | null {
  return world.hasStore("space.late") ? world.store<LateStore>("space.late") : null;
}

/** The key a body is remade by: its index in the home system, or (-1 - land) under another star. */
export function remakeKey(body: number, cell: number): number {
  return body >= 0 ? body : -1 - cell;
}
