// The woods' age (the sweep, Nature lane; the rule is rules/succession.ts standStep). Each peopled land whose woods have been cut
// or have come back keeps their mean age; a land whose woods no one has touched keeps none, and its woods are old growth, at
// their climax. Stepped with the ecology's year (ecology.ts ecologyYear), off the forest it held before and after. A reading
// for the land's page: no rule reads it yet.
//
// One number a touched land (tenths of a year). No draw.
import { type Hasher, type StateStore, type World } from "../../kernel/index.ts";
import { STAND, standStep } from "../../rules/index.ts";

function fold(d: [number, number], xs: readonly number[]): void {
  let a = d[0],
    b = d[1];
  for (const x of xs) {
    const lo = x | 0,
      hi = Math.floor(x / 4294967296) | 0;
    a = Math.imul(a ^ lo, 0x01000193) ^ hi;
    b = Math.imul(b + lo + 0x9e3779b9, 0x85ebca6b) ^ (b >>> 13);
  }
  d[0] = a;
  d[1] = b;
}

export class StandStore implements StateStore {
  readonly name = "ecology.stands";
  readonly packed = true;
  private readonly map = new Map<number, number>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];

  /** A land's woods' mean age (years): old growth where none is kept. */
  age(cell: number): number {
    const a = this.map.get(cell);
    return a === undefined ? STAND.climax : a / 10;
  }
  touched(cell: number): boolean {
    return this.map.has(cell);
  }
  set(cell: number, age: number): void {
    const a = Math.round(10 * age);
    if (this.map.get(cell) === a) return;
    this.map.set(cell, a);
    fold(this.digest, [cell, a]);
  }
  get size(): number {
    return this.map.size;
  }
  dormant(): boolean {
    return this.map.size === 0;
  }
  pinned(): never[] {
    return [];
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.int(this.map.size).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    if (this.dormant()) return {};
    const cells = [...this.map.keys()].sort((a, b) => a - b);
    return { cells, ages: cells.map((c) => this.map.get(c)!), digest: [...this.digest] };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as { cells?: number[]; ages?: number[]; digest?: [number, number] };
    this.map.clear();
    (s.cells ?? []).forEach((c, i) => this.map.set(c, s.ages![i]!));
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
  }
}

export function standsOf(world: World): StandStore | null {
  return world.peek<StandStore>("ecology.stands") ?? null;
}

/** A land's woods' mean age (years; old growth where untouched or where the world keeps no stands). */
export function standAge(world: World, cell: number): number {
  return standsOf(world)?.age(cell) ?? STAND.climax;
}

/** A year of a land's woods: their share of the land from `before` to `after` (kept only once they have been touched). */
export function stepStand(world: World, cell: number, before: number, after: number): void {
  const store = standsOf(world);
  if (!store || (!store.touched(cell) && after === before)) return;
  store.set(cell, standStep(store.age(cell), before, after));
}

/** Teach a peopled world its woods' ages. */
export function installStands(world: World): StandStore {
  return world.register(new StandStore());
}
