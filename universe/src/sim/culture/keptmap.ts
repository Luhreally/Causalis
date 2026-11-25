// A small kept map (the last breadth gaps, 2026-11-24): a few records by a key (a faith, a realm, a land), for a system whose
// state is a handful of rows that cite events. Hashed and saved in key order; the events its rows cite are pinned.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";

export class KeptMap<T> implements StateStore {
  readonly name: string;
  readonly rows = new Map<string, T>();
  private readonly pins: (row: T) => readonly (Ref | null | undefined)[];
  constructor(name: string, pins: (row: T) => readonly (Ref | null | undefined)[] = () => []) {
    this.name = name;
    this.pins = pins;
  }
  get(key: string): T | undefined {
    return this.rows.get(key);
  }
  set(key: string, row: T): void {
    this.rows.set(key, row);
  }
  drop(key: string): void {
    this.rows.delete(key);
  }
  get size(): number {
    return this.rows.size;
  }
  keys(): string[] {
    return [...this.rows.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const r of this.rows.values()) for (const ref of this.pins(r)) if (ref) out.push(ref);
    return out;
  }
  hashInto(h: Hasher): void {
    for (const k of this.keys()) h.string(k).value(this.rows.get(k)!);
  }
  save(): unknown {
    return this.keys().map((k) => [k, this.rows.get(k)!]);
  }
  load(s: unknown): void {
    this.rows.clear();
    for (const [k, r] of (s as [string, T][]) ?? []) this.rows.set(k, r);
  }
}

/** Register a kept map on a world, its cited events pinned. */
export function keepMap<T>(
  world: World,
  name: string,
  pins: (row: T) => readonly (Ref | null | undefined)[] = () => [],
): KeptMap<T> {
  const store = world.register(new KeptMap<T>(name, pins));
  world.addPinner(() => store.pinned());
  return store;
}

/** A kept map where a world has it (a world from before it, or one no one lives on, has none). */
export function keptMap<T>(world: World, name: string): KeptMap<T> | null {
  return world.peek<KeptMap<T>>(name) ?? null;
}
