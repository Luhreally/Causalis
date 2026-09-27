// A world in depth, as the host sends it (Phase 8 M81): any body of a star's system made
// whole — its relief and warmth cell by cell, what covers each cell, a giant's bands and
// its storm. (What it is and why, and who lives there, the page has from the system's plan.)
export type WorldGlobe = {
  readonly ref: string;
  readonly kind: "home" | "rocky" | "giant" | "ice giant" | "moon";
  /** The grid's frequency (its cells follow from it), and each cell's relief (m), warmth (°C) and cover (0 ground, 1 sea, 2 ice). */
  readonly frequency: number;
  readonly elevation: Float32Array;
  readonly temperature: Float32Array;
  /** Rain a year (mm) — for a living world's lands, the forest from the desert. */
  readonly precipitation: Float32Array;
  readonly cover: Uint8Array;
  /** Craters stamped on it; a giant's bands and storm (latitude, longitude, size, radians). */
  readonly craters: number;
  readonly bands: number;
  readonly storm: { readonly lat: number; readonly lon: number; readonly size: number } | null;
  /** Which of its kind's colours its ground takes (0 … 1). */
  readonly tint: number;
  /** Its air and where its water lies (as the system tells them). */
  readonly air: string;
  readonly water: string;
  /** Whether life greens its lands (seas about a star old enough); a people of it, if one arose there. */
  readonly living: boolean;
  readonly people: {
    readonly name: string;
    readonly medium: string;
    /** The years, in our chronicle, they come (or came) to electronics, to orbit, to the stars; when home heard them. */
    readonly electronics: number;
    readonly orbit: number;
    readonly stars: number;
    readonly heard: number | null;
  } | null;
};
