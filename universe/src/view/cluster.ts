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

/** A war fleet's lead ship, for its counter (Phase 11 M101): its realm, its enemy, its strength. */
export type FleetHead = VoyageMark & {
  readonly realm: string;
  readonly enemy: string;
  readonly strength: number;
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
  /** Each fleet's lead ship, where its counter stands. */
  readonly heads: readonly FleetHead[];
} {
  const at = new Map(plan.stars.map((s) => [s.ref, s]));
  const ships: VoyageMark[] = [],
    rings: VoyageMark[] = [],
    fleets: VoyageMark[] = [],
    battles: VoyageMark[] = [],
    heads: FleetHead[] = [];
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
      heads.push({
        ...fleets.at(-3)!,
        realm: f.realmRef,
        enemy: f.enemyRef,
        strength: f.strength,
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
  return { ships, rings, fleets, battles, heads };
}

/** A people of another star's mark (Phase 18 M134): where, its colour, and the page it opens. */
export type PeopleMark = VoyageMark & { readonly color: Rgb3 };
/** How two peoples met, shown where they met: each one's reaction as an icon. */
export type ReactionMark = VoyageMark & { readonly text: string };
/** A line among the stars: a people's reach between its holds, or two peoples' line of contact. */
export type StarLine = {
  readonly a: readonly [number, number, number];
  readonly b: readonly [number, number, number];
  readonly color: Rgb3;
  readonly alpha: number;
};

export const REACTION_ICONS: Readonly<Record<string, string>> = {
  wonder: "✨",
  fear: "😨",
  trade: "🤝",
  war: "⚔️",
};

/** How long a meeting's icons, a raid's fire and a landing's burst stay shown (years). */
export const MEETING_SHOWN = 80;
export const BURST_SHOWN = 40;

/**
 * The peoples of other stars among them: each one's holds ringed in its colour (its own star
 * the larger), its reach drawn between them, its ships under way, the lines of contact between
 * peoples who met (green as they stand well, red as they stand ill, faint while they cannot yet
 * speak), how each met the other where they met, and the bursts of raids and landings.
 */
export function peopleMarks(
  plan: ClusterPlan,
  sky: SkyState,
  year: number,
): {
  readonly holds: readonly PeopleMark[];
  readonly own: readonly PeopleMark[];
  readonly ships: readonly PeopleMark[];
  readonly fleets: readonly PeopleMark[];
  readonly lines: readonly StarLine[];
  readonly reactions: readonly ReactionMark[];
  readonly raids: readonly (PeopleMark & { readonly age: number })[];
  readonly landings: readonly (PeopleMark & { readonly age: number })[];
} {
  const p = sky.peoples,
    empty = {
      holds: [],
      own: [],
      ships: [],
      fleets: [],
      lines: [],
      reactions: [],
      raids: [],
      landings: [],
    };
  if (!p) return empty;
  const at = new Map(plan.stars.map((s) => [s.ref, s])),
    place = (ref: string): [number, number, number] | null => {
      if (ref === p.home) return [0, 0, 0];
      const s = at.get(ref);
      return s ? [s.x * LY_SCALE, s.z * LY_SCALE, s.y * LY_SCALE] : null;
    },
    apart = (a: readonly number[], b: readonly number[]) =>
      Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!),
    colorOf = new Map(p.civs.map((c) => [c.ref, c.color])),
    holdsOf = new Map(
      p.civs.map((c) => [c.ref, c.holds.map((h) => place(h.star)).filter((x) => x !== null)]),
    ),
    nearest = (civ: string, to: readonly number[]) => {
      let best: [number, number, number] | null = null;
      for (const h of holdsOf.get(civ) ?? []) if (!best || apart(h, to) < apart(best, to)) best = h;
      return best;
    };
  const holds: PeopleMark[] = [],
    own: PeopleMark[] = [],
    lines: StarLine[] = [];
  for (const c of p.civs) {
    const placed = c.holds
      .filter((h) => h.year <= year)
      .map((h) => ({ h, at: place(h.star) }))
      .filter((x): x is { h: (typeof c.holds)[number]; at: [number, number, number] } => !!x.at);
    placed.forEach(({ h, at: xyz }, i) => {
      const mark = { x: xyz[0], y: xyz[1], z: xyz[2], ref: c.ref, color: c.color };
      (h.star === c.star ? own : holds).push(mark);
      // Its reach: each hold joined to the nearest held before it.
      let from: [number, number, number] | null = null;
      for (const prior of placed.slice(0, i))
        if (!from || apart(prior.at, xyz) < apart(from, xyz)) from = prior.at;
      if (from) lines.push({ a: from, b: xyz, color: c.color, alpha: 0.85 });
    });
  }
  // Lines of contact: from the people's nearest hold to where the other stands.
  const reactions: ReactionMark[] = [],
    told = new Map<string, number>();
  for (const m of p.meetings) {
    if (m.year > year) continue;
    const where = place(m.star) ?? [0, 0, 0],
      them =
        m.with === "people"
          ? (nearest(m.other, nearest(m.civ, where) ?? where) ?? where)
          : m.star === p.home
            ? [0, 0, 0]
            : where,
      mine = nearest(m.civ, them);
    if (mine)
      lines.push({
        a: mine,
        b: them as [number, number, number],
        color: !m.talking ? [0.85, 0.85, 0.95] : m.regard >= 0 ? [0.35, 1, 0.55] : [1, 0.3, 0.25],
        alpha: !m.talking ? 0.35 : 0.55 + 0.45 * Math.min(1, Math.abs(m.regard)),
      });
    if (year - m.year < MEETING_SHOWN) {
      // (Several met at one star: their icons stacked a little apart.)
      const key = where.join(","),
        k = told.get(key) ?? 0;
      told.set(key, k + 1);
      reactions.push({
        x: where[0],
        y: where[1] + 0.25 + 0.22 * k,
        z: where[2],
        ref: m.event,
        text: `${REACTION_ICONS[m.theirs] ?? "?"}${REACTION_ICONS[m.ours] ?? "?"}`,
      });
    }
  }
  const ships: PeopleMark[] = [],
    fleets: PeopleMark[] = [];
  for (const s of p.ships) {
    const a = place(s.from),
      b = place(s.to);
    if (!a || !b || year < s.sailed) continue;
    const k = Math.max(0, Math.min(1, (year - s.sailed) / Math.max(1, s.arrives - s.sailed))),
      color = colorOf.get(s.civ) ?? [1, 1, 1],
      at: [number, number, number] = [
        a[0] + (b[0] - a[0]) * k,
        a[1] + (b[1] - a[1]) * k,
        a[2] + (b[2] - a[2]) * k,
      ];
    (s.kind === "fleet" ? fleets : ships).push({
      x: at[0],
      y: at[1],
      z: at[2],
      ref: s.event,
      color,
    });
    // Its course: come so far bright, the rest of the way faint.
    const fire: Rgb3 = [1, 0.35, 0.2];
    lines.push(
      { a, b: at, color: s.kind === "fleet" ? fire : color, alpha: 0.75 },
      { a: at, b, color: s.kind === "fleet" ? fire : color, alpha: 0.22 },
    );
  }
  const raids = p.raids
      .filter((r) => r.year <= year && year - r.year < BURST_SHOWN)
      .flatMap((r) => {
        const xyz = place(r.star);
        return xyz
          ? [
              {
                x: xyz[0],
                y: xyz[1],
                z: xyz[2],
                ref: r.event,
                color: colorOf.get(r.civ) ?? [1, 0.4, 0.2],
                age: year - r.year,
              },
            ]
          : [];
      }),
    landings = p.landings
      .filter((l) => l.year <= year && year - l.year < BURST_SHOWN)
      .map((l) => ({
        x: 0,
        y: 0,
        z: 0,
        ref: l.event,
        color: colorOf.get(l.civ) ?? [1, 1, 1],
        age: year - l.year,
      }));
  return { holds, own, ships, fleets, lines, reactions, raids, landings };
}
