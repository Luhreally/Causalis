// What settlers bring of their old land's bodies (the breadth gaps' follow-up, 2026-11-24: "settlers carry their source
// land's adaptation, weighted by share, instead of starting at zero"). How far a land's people have taken to its cold, its
// heat and its thin air is read from the generations their lines have lived there (population/systems.ts takenIn); those
// who come from a land that asked the same of them bring what they had already, and those who join a land's people shift
// its mean by their share. Kept here, for each land settled within the chronicle that has any: what its people brought,
// in what a land asks (thousandths: of the cold's toll at its most, of the heat's, of the air lost), over and above what
// the years there have given them. Three small numbers a land; none on the lands a chronicle opens on, whose people are
// of them; nothing until the first.
import type { Hasher, StateStore, World } from "../../kernel/index.ts";

export class CarriedStore implements StateStore {
  readonly name = "population.carried";
  /** A land: what its people brought of bearing its cold, its heat and its thin air (thousandths; may be under nothing). */
  readonly lands = new Map<number, [number, number, number]>();
  dormant(): boolean {
    return !this.lands.size;
  }
  private rows(): number[][] {
    return [...this.lands.entries()].sort((a, b) => a[0] - b[0]).map(([c, v]) => [c, ...v]);
  }
  hashInto(h: Hasher): void {
    if (this.lands.size) h.value(this.rows());
  }
  save(): unknown {
    return this.lands.size ? { lands: this.rows() } : {};
  }
  load(state: unknown): void {
    this.lands.clear();
    for (const r of ((state ?? {}) as { lands?: number[][] }).lands ?? [])
      this.lands.set(r[0]!, [r[1] ?? 0, r[2] ?? 0, r[3] ?? 0]);
  }
  /** Set what a land's people brought (let go where it is nothing). */
  set(cell: number, v: readonly [number, number, number]): void {
    const r: [number, number, number] = [
      Math.round(v[0] * 1000),
      Math.round(v[1] * 1000),
      Math.round(v[2] * 1000),
    ];
    if (r[0] === 0 && r[1] === 0 && r[2] === 0) this.lands.delete(cell);
    else this.lands.set(cell, r);
  }
}

export function carriedOf(world: World): CarriedStore | null {
  return world.peek<CarriedStore>("population.carried") ?? null;
}

/** Teach a world that settlers bring what their bodies had taken to. */
export function installCarried(world: World): CarriedStore {
  return world.register(new CarriedStore());
}
