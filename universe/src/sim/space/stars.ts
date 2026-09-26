// Voyages to other stars (Phase 6 M58–M59): which of the province world's kept sites a
// ship holds, bound for which star's world, sailing since when and arriving when, and
// the share of its people's work that keeps them alive — aboard, then in halls on the
// world they came to. Read by the population's rules as a land's place; written by the
// space rules when a ship sails and when it arrives. It imports nothing of theirs.
import { dmath, type Hasher, type Ref, type StateStore, type World } from "../../kernel/index.ts";

export type StarSite = {
  /** The realm that sent it, and the land its people came from. */
  readonly realm: Ref;
  readonly from: number;
  /** Bound for: the star, and which of its worlds; how far (light-years). */
  readonly star: Ref;
  readonly planet: number;
  readonly distance: number;
  /** The drive, the year it sailed and the year it arrives. */
  readonly drive: string;
  readonly departed: number;
  readonly arrives: number;
  /** The event of its sailing, and of its arrival (null while it sails). */
  readonly voyage: Ref;
  arrived: Ref | null;
  /** The share of its people's work that keeps them alive: aboard, then on the world. */
  readonly aboard: number;
  readonly there: number;
};

export class StarSiteStore implements StateStore {
  readonly name = "space.stars";
  private readonly sites = new Map<number, StarSite>();

  get(cell: number): StarSite | undefined {
    return this.sites.get(cell);
  }
  set(cell: number, s: StarSite): void {
    this.sites.set(cell, s);
  }
  all(): [number, StarSite][] {
    return [...this.sites.entries()].sort((a, b) => a[0] - b[0]);
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const s of this.sites.values()) {
      out.push(s.voyage);
      if (s.arrived) out.push(s.arrived);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.value(this.all());
  }
  save(): unknown {
    return this.all();
  }
  load(state: unknown): void {
    this.sites.clear();
    for (const [cell, s] of state as [number, StarSite][]) this.sites.set(cell, { ...s });
  }
}

/** The kept sites a world's ships hold (none on a world that never flew). */
export function starSitesOf(world: World): StarSiteStore | null {
  return world.hasStore("space.stars") ? world.store<StarSiteStore>("space.stars") : null;
}

/** How many light-years' lag a crossing is worth in steps of rule (as a land's steps are reckoned). */
export function lightSteps(distance: number): number {
  // A year of light's lag weighs as a year's crossing of a system does.
  return 1 + Math.round(dmath.log2(1 + (distance * 365) / 30));
}
