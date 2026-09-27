// The observatory's pages as the host answers them (Phase 7 M67, M68, M70): a wild
// lineage, a realm, a deposit and a plate, each with the refs whose whys it opens.

export type SpeciesPage = {
  readonly ref: string;
  readonly name: string;
  readonly niche: string;
  /** What it is, in words. */
  readonly what: string;
  /** Its weight in kg (null for a grass). */
  readonly size: number | null;
  readonly tame: boolean;
  readonly wool: boolean;
  /** How herd-living it is, 0..1. */
  readonly herd: number;
  /** How heavy its seed (a grass), 0..1. */
  readonly seed: number | null;
  /** The warmth it thrives at and how far from it it lives, °C; the rain it needs, mm. */
  readonly warm: number;
  readonly tolerance: number;
  readonly rain: readonly [number, number];
  readonly arose: {
    readonly index: number;
    readonly ref: string;
    readonly from: number;
    readonly to: number;
  };
  readonly died: number | null;
  /** The land it arose in. */
  readonly origin: { readonly cell: number; readonly biome: string };
  /**
   * Its place among the living (M77): the game it hunts, or the hunters that hunt it —
   * each lineage with the lands they share, the most first — and the lands where it takes
   * from the people's flocks.
   */
  readonly hunts: readonly {
    readonly name: string;
    readonly ref: string;
    readonly lands: number;
  }[];
  readonly huntedBy: readonly {
    readonly name: string;
    readonly ref: string;
    readonly lands: number;
  }[];
  readonly raids: number;
  /** The lands it lives in, those of them peopled, sown with it, herding it; those it was hunted out of. */
  readonly lands: number;
  readonly peopled: number;
  readonly sown: number;
  readonly herded: number;
  readonly lost: number;
};

export type RealmPage = {
  readonly ref: string;
  readonly name: string;
  readonly town: string;
  readonly founded: number;
  readonly event: string;
  readonly ended: number | null;
  readonly seat: number;
  readonly lands: number;
  /** Of its lands, those on other bodies or under other stars. */
  readonly offworld: number;
  readonly people: number;
  readonly government: string;
  readonly ruler: { readonly name: string; readonly since: number; readonly event: string };
  /** The successions history still holds, newest first. */
  readonly rulers: readonly {
    readonly year: number;
    readonly event: string;
    readonly claim: string;
  }[];
  readonly tithe: number;
  readonly host: { readonly ref: string } | null;
  readonly wars: readonly {
    readonly ref: string;
    readonly name: string;
    readonly since: number;
    readonly ended: number | null;
    readonly attacking: boolean;
    readonly battles: number;
    readonly peace: string | null;
    readonly embargo: string | null;
  }[];
  readonly pacts: readonly {
    readonly ref: string;
    readonly name: string;
    readonly standing: string;
    readonly pact: boolean;
    readonly opinion: number;
  }[];
  /** What its seat knows, in the order it came to know it. */
  readonly known: readonly {
    readonly name: string;
    readonly year: number;
    readonly event: string;
  }[];
};

export type DepositPage = {
  readonly ref: string;
  readonly kind: string;
  readonly richness: number;
  readonly process: string;
  readonly cell: number;
  /** The land it lies in, and how many live there. */
  readonly land: number;
  readonly people: number;
  /** The plate it lies on, and the one across the boundary that made it (if one did). */
  readonly plate: { readonly ref: string; readonly continental: boolean } | null;
  readonly across: { readonly ref: string; readonly continental: boolean } | null;
  /** The deep age that buried it (coal and oil). */
  readonly age: { readonly index: number; readonly ref: string } | null;
};

export type PlatePage = {
  readonly ref: string;
  readonly continental: boolean;
  /** Its share of the world's surface, 0..1; its drift, degrees a million years. */
  readonly share: number;
  readonly speed: number;
  /** The share of it above the sea. */
  readonly dry: number;
  readonly people: number;
  /** The plates it meets, and how (a BOUNDARY kind). */
  readonly neighbours: readonly { readonly ref: string; readonly boundary: number }[];
  readonly deposits: readonly { readonly kind: string; readonly count: number }[];
};
