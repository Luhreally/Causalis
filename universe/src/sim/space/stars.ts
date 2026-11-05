// Voyages to other stars (Phase 6 M58–M59): which of the province world's kept sites a
// ship holds, bound for which star's world, sailing since when and arriving when, and
// the share of its people's work that keeps them alive — aboard, then in halls on the
// world they came to. Read by the population's rules as a land's place; written by the
// space rules when a ship sails and when it arrives. It imports nothing of theirs.
import {
  Rng,
  dmath,
  type Hasher,
  type Ref,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { clusterStars, makeGalaxy, type GalaxyStar } from "../../gen/index.ts";

/** The stars within reach of home: a pure function of the world's seed, kept while it is the same. */
const CLUSTERS = new Map<string, GalaxyStar[]>();
export function clusterOf(world: World): GalaxyStar[] {
  const key = world.seed.text;
  let stars = CLUSTERS.get(key);
  if (!stars) {
    if (CLUSTERS.size > 8) CLUSTERS.clear();
    const rng = new Rng(world.seed);
    CLUSTERS.set(key, (stars = clusterStars(rng, makeGalaxy(rng))));
  }
  return stars;
}

/** How a ship went by lanes: how many, how far, what it burned, and any lane it was thrown from. */
export type SiteLane = {
  readonly hops: number;
  readonly ly: number;
  readonly tonnes: number;
  /** The years its drive alone would have taken. */
  readonly byDrive: number;
  readonly thrown: { readonly hop: number; readonly short: number; readonly years: number } | null;
};

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
  /** How it went by lanes (Phase 68; absent: it crossed on its drive). */
  readonly lane?: SiteLane;
};

/** The first jump, as the film and the page read it (Phase 68). */
export type FirstJump = {
  readonly event: Ref;
  readonly realm: Ref;
  readonly name: string;
  readonly what: "settlers" | "envoys" | "fleet";
  readonly cell: number | null;
  readonly star: Ref;
  /** Which of its worlds it was bound for. */
  readonly planet: number;
  readonly year: number;
  readonly arrives: number;
  readonly hops: number;
  readonly ly: number;
  readonly tonnes: number;
  readonly machines: number;
  /** Straight across, the light-years; and the years its drive alone would have taken. */
  readonly distance: number;
  readonly byDrive: number;
  readonly drive: string;
  /** The lane it was thrown from, how far short (light-years), and how long that took it. */
  readonly thrown: SiteLane["thrown"];
};

/** A ship through the lanes to a people seen (Phase 68). */
export type LaneVisit = {
  readonly realm: Ref;
  readonly name: string;
  readonly folk: Ref;
  readonly star: Ref;
  readonly planet: number;
  /** The stage they were seen at, which sent it (a stage is gone to once). */
  readonly seen: string;
  readonly sailed: number;
  readonly arrives: number;
  readonly hops: number;
  readonly distance: number;
  readonly byDrive: number;
  readonly drive: string;
  readonly event: Ref;
  arrived: Ref | null;
};

export class StarSiteStore implements StateStore {
  readonly name = "space.stars";
  private readonly sites = new Map<number, StarSite>();
  /** What the lanes have brought (Phase 68): nothing is hashed or saved of these until a ship has jumped. */
  first: FirstJump | null = null;
  visits: LaneVisit[] = [];

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
    if (this.first) out.push(this.first.event);
    for (const v of this.visits) {
      out.push(v.event);
      if (v.arrived) out.push(v.arrived);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.value(this.all());
    if (this.first) h.value([this.first, this.visits]);
  }
  save(): unknown {
    return this.first ? { sites: this.all(), first: this.first, visits: this.visits } : this.all();
  }
  load(state: unknown): void {
    this.sites.clear();
    // (A save from before the lanes, or a world none has jumped in, keeps only its sites.)
    const s = state as
      [number, StarSite][] | { sites: [number, StarSite][]; first: FirstJump; visits: LaneVisit[] };
    for (const [cell, site] of Array.isArray(s) ? s : s.sites) this.sites.set(cell, { ...site });
    this.first = Array.isArray(s) ? null : s.first;
    this.visits = Array.isArray(s) ? [] : s.visits.map((v) => ({ ...v }));
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
