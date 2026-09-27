// The cluster view (Phase 6 M56): the stars within the cluster's reach, where they lie,
// a light-year to a third of a scene unit; each coloured by its warmth (blue-white hot,
// red cool, the dead white dwarfs grey) and sized by its light. A pure function of the plan.
import type { ClusterPlan, ClusterStar, SkyState } from "../bridge/index.ts";

export type Rgb3 = readonly [number, number, number];

/** Scene units a light-year. */
export const LY_SCALE = 0.3;

/** A star's colour, by its surface's warmth. */
export function starColor(s: Pick<ClusterStar, "temperature" | "remnant">): Rgb3 {
  if (s.remnant) return [0.75, 0.78, 0.85];
  const t = s.temperature;
  return t > 10000
    ? [0.7, 0.8, 1]
    : t > 7500
      ? [0.85, 0.9, 1]
      : t > 6000
        ? [1, 1, 0.92]
        : t > 5200
          ? [1, 0.95, 0.75]
          : t > 3700
            ? [1, 0.78, 0.5]
            : [1, 0.55, 0.4];
}

/** The groups a renderer draws: one colour each, every star in its group placed and sized. */
export function clusterSpec(plan: ClusterPlan): {
  readonly color: Rgb3;
  readonly stars: readonly {
    readonly index: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly size: number;
  }[];
}[] {
  const groups = new Map<
    string,
    { color: Rgb3; stars: { index: number; x: number; y: number; z: number; size: number }[] }
  >();
  plan.stars.forEach((s, index) => {
    const color = starColor(s),
      key = color.join(",");
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { color, stars: [] }));
    // Scene y is up: the disk's plane is the ground, height above it is up.
    g.stars.push({
      index,
      x: s.x * LY_SCALE,
      y: s.z * LY_SCALE,
      z: s.y * LY_SCALE,
      size: 0.05 + 0.07 * Math.min(3, Math.pow(Math.max(1e-4, s.luminosity), 0.25)),
    });
  });
  return [...groups.values()];
}

/** The cluster in words: how many stars of each kind, and the nearest. */
export function clusterWords(plan: ClusterPlan): string[] {
  const kinds = new Map<string, number>();
  for (const s of plan.stars) kinds.set(s.spectral, (kinds.get(s.spectral) ?? 0) + 1);
  const worlds = plan.stars.reduce((n, s) => n + s.planets, 0),
    seas = plan.stars.reduce((n, s) => n + s.seas, 0);
  return [
    `${plan.stars.length.toLocaleString("en")} stars within ${plan.radius} light-years`,
    [...kinds.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${n} ${k === "white dwarf" ? "white dwarfs" : `${k[0]} stars`}`)
      .join(", "),
    `${worlds.toLocaleString("en")} worlds about them, ${seas} with seas`,
  ];
}

/** Ships in flight between home and their stars, and rings about the stars they came down at. */
/** A mark among the stars — a ship, a hall, a fleet, a battle — where it is and its page. */
export type VoyageMark = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ref: string;
};

export function voyageMarks(
  plan: ClusterPlan,
  sky: SkyState,
  year: number,
): {
  readonly ships: readonly VoyageMark[];
  readonly rings: readonly VoyageMark[];
  /** War fleets under way (three ships to a fleet), and the stars where their battles were fought (M87). */
  readonly fleets: readonly VoyageMark[];
  readonly battles: readonly VoyageMark[];
} {
  const at = new Map(plan.stars.map((s) => [s.ref, s]));
  const ships: VoyageMark[] = [],
    rings: VoyageMark[] = [],
    fleets: VoyageMark[] = [],
    battles: VoyageMark[] = [];
  for (const f of sky.fleets ?? []) {
    const star = f.star ? at.get(f.star) : undefined;
    if (!star || year < f.sailed) continue;
    const place = { x: star.x * LY_SCALE, y: star.z * LY_SCALE, z: star.y * LY_SCALE };
    if (year < f.arrives) {
      // Along the line from home, as far as it has sailed, in a wedge of three.
      const k = (year - f.sailed) / Math.max(1, f.arrives - f.sailed),
        l = Math.hypot(place.x, place.z) || 1,
        side = { x: -place.z / l, z: place.x / l },
        back = 0.18;
      for (const [s, b] of [
        [0, 0],
        [1, 1],
        [-1, 1],
      ] as const)
        fleets.push({
          x: place.x * k + side.x * s * 0.14 - (place.x / l) * b * back,
          y: place.y * k,
          z: place.z * k + side.z * s * 0.14 - (place.z / l) * b * back,
          ref: f.event,
        });
    } else if (f.won !== null && year < f.arrives + 30) battles.push({ ...place, ref: f.event });
  }
  for (const v of sky.ships ?? []) {
    const star = at.get(v.star);
    if (!star) continue;
    const place = { x: star.x * LY_SCALE, y: star.z * LY_SCALE, z: star.y * LY_SCALE };
    // (A hall founded is its land's page; a ship under way, its voyage's.)
    if (v.arrived) rings.push({ ...place, ref: `cell:0:${v.cell}` });
    else {
      // Along the line from home, as far as the crossing has come.
      const k = Math.max(0, Math.min(1, (year - v.departed) / Math.max(1, v.arrives - v.departed)));
      ships.push({ x: place.x * k, y: place.y * k, z: place.z * k, ref: v.voyage });
    }
  }
  return { ships, rings, fleets, battles };
}
