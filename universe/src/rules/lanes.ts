// The lanes between stars (Phase 68, first slice; galaxy-plan.md "Faster than light is a law of each universe").
// Whether a universe has them is a law of that universe: a pure hash of its seed's name, touching no stream, unless a
// Creator's dial says otherwise. Where they run is a fact of that universe, read from the stars' places and masses: the
// tide between two stars is the geometric mean of their masses over the square of the distance between them, and a lane
// runs between two stars where that tide is strong enough and no third star has a stronger tide with both of them. So
// every star's strongest ties are lanes, and the map is the same every time it is read. What a lane costs comes from
// those numbers. Pure tables and functions.
import { hashString, seedName } from "../kernel/index.ts";
import { makingsOf } from "./making.ts";

/** The share of universes never seen whose seed opens the law: most, so a world picked by chance often has it (est.). */
export const LANE_LAW_SHARE = 2 / 3;

/** A universe's law, and what set it. */
export type LaneLaw = { readonly open: boolean; readonly by: "dial" | "seed" | "earth" };

/** The law of lanes in a universe: its Creator's dial, else on for Earth, else its seed's own draw. */
export function laneLaw(text: string, earthlike: boolean): LaneLaw {
  const dial = makingsOf(text).lanes;
  if (dial !== undefined) return { open: dial === "open", by: "dial" };
  if (earthlike) return { open: true, by: "earth" };
  return {
    open: (hashString(`${seedName(text)} the law of lanes`) >>> 0) / 4294967296 < LANE_LAW_SHARE,
    by: "seed",
  };
}

/** A star as the lanes read it. */
export type LaneStar = {
  readonly ref: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly mass: number;
};

/** A lane: its two stars (by place in the list), its length (light-years), and the tide along it. */
export type Lane = {
  readonly a: number;
  readonly b: number;
  readonly ly: number;
  readonly tide: number;
};

/** The weakest tide a lane can run on (suns to the square light-year): two Suns 16 light-years apart (est.). */
export const LEAST_TIDE = 0.004;
/** The tide of two Suns seven light-years apart, about the middle of what lanes there are. */
const MIDDLE_TIDE = 0.02;

export const tideBetween = (ma: number, mb: number, ly: number): number =>
  Math.sqrt(ma * mb) / (ly * ly);

/** Every lane among these stars, in their order. */
export function lanesAmong(stars: readonly LaneStar[]): readonly Lane[] {
  const n = stars.length,
    near: Map<number, number>[] = Array.from({ length: n }, () => new Map<number, number>()),
    all: Lane[] = [];
  for (let i = 0; i < n; i++) {
    const a = stars[i]!;
    for (let j = i + 1; j < n; j++) {
      const b = stars[j]!,
        dx = a.x - b.x,
        dy = a.y - b.y,
        dz = a.z - b.z,
        d2 = dx * dx + dy * dy + dz * dz,
        m = Math.sqrt(a.mass * b.mass);
      if (m < LEAST_TIDE * d2 || d2 <= 0) continue;
      const tide = m / d2;
      near[i]!.set(j, tide);
      near[j]!.set(i, tide);
      all.push({ a: i, b: j, ly: Math.sqrt(d2), tide });
    }
  }
  return all.filter((l) => {
    for (const [c, tide] of near[l.a]!)
      if (c !== l.b && tide > l.tide && (near[l.b]!.get(c) ?? 0) > l.tide) return false;
    return true;
  });
}

/** How many times light's speed a ship goes along a lane between two Suns seven light-years apart (est.). */
export const LANE_LIGHTS = 4;
/** How far out a Sun's own pull has fallen to what a lane's mouth can open in, light-years (a billionth of a metre per second squared there). */
export const MOUTH_LY = 0.038;
/** What a ship burns to press a middling lane open, tonnes of annihilated fuel a light-year (est.). */
export const LANE_TONNES_LY = 20;
/** Machines a tonne of that fuel costs (est.). */
export const LANE_MACHINES_TONNE = 2000;

/** The speed along a lane, as times light's: a stronger tide runs faster, from half to twice the middle. */
export const laneLights = (tide: number): number =>
  LANE_LIGHTS * Math.max(0.5, Math.min(2, Math.sqrt(tide / MIDDLE_TIDE)));
/** Years through a lane. */
export const laneYearsThrough = (l: Pick<Lane, "ly" | "tide">): number => l.ly / laneLights(l.tide);
/** Where a star's lanes open, out from it (light-years): as the root of its mass. */
export const mouthLy = (mass: number): number => MOUTH_LY * Math.sqrt(mass);
/** The fuel a lane burns (tonnes): more on a thin lane. */
export const laneTonnes = (l: Pick<Lane, "ly" | "tide">): number =>
  LANE_TONNES_LY * l.ly * Math.sqrt(MIDDLE_TIDE / l.tide);
/** The share of ships a lane throws out part way: more on a thin lane, one in four at the most. */
export const laneThrows = (tide: number): number => Math.min(0.25, 0.0004 / tide);

/** A way between two stars by lanes. */
export type LaneRoute = {
  readonly hops: number;
  /** Light-years through lanes. */
  readonly ly: number;
  /** Years in the lanes themselves. */
  readonly jump: number;
  /** Light-years a ship crosses on its own drive, from mouth to mouth at each star. */
  readonly mouths: number;
  readonly tonnes: number;
  /** The stars it goes by, the first and last among them, and each lane's tide. */
  readonly stars: readonly number[];
  readonly tides: readonly number[];
  readonly lengths: readonly number[];
};

/** Years a ship of this cruise (a share of light's) takes by a route: up to speed, mouth to mouth, through, and down. */
export const routeYears = (r: LaneRoute, cruise: number): number =>
  r.jump + r.mouths / cruise + 2 * Math.min(3, cruise * 10);
/** Machines a route's fuel costs. */
export const routeMachines = (r: LaneRoute): number => r.tonnes * LANE_MACHINES_TONNE;

/** The years a ship thrown out at a share of a lane's way takes to finish it on its drive, above what the lane would have taken. */
export const thrownYears = (ly: number, tide: number, share: number, cruise: number): number =>
  Math.max(0, ((1 - share) * ly) / cruise - ((1 - share) * ly) / laneLights(tide));

/** The lanes as each star's list of ways out. */
export type LaneWays = readonly (readonly { readonly to: number; readonly lane: number }[])[];

export function waysOf(n: number, lanes: readonly Lane[]): LaneWays {
  const out: { to: number; lane: number }[][] = Array.from({ length: n }, () => []);
  lanes.forEach((l, lane) => {
    out[l.a]!.push({ to: l.b, lane });
    out[l.b]!.push({ to: l.a, lane });
  });
  return out;
}

/** A table of the quickest ways out from one star: at a middling cruise, the same for every drive. */
export type LaneTable = { readonly years: Float64Array; readonly prev: Int32Array };

const REF_CRUISE = 0.1;

export function laneTable(
  stars: readonly LaneStar[],
  lanes: readonly Lane[],
  ways: LaneWays,
  from: number,
): LaneTable {
  const n = stars.length,
    years = new Float64Array(n).fill(Infinity),
    prev = new Int32Array(n).fill(-1),
    done = new Uint8Array(n),
    heap: number[] = [],
    less = (a: number, b: number) => years[a]! < years[b]! || (years[a] === years[b] && a < b),
    push = (i: number) => {
      heap.push(i);
      let k = heap.length - 1;
      while (k > 0) {
        const up = (k - 1) >> 1;
        if (!less(heap[k]!, heap[up]!)) break;
        [heap[k], heap[up]] = [heap[up]!, heap[k]!];
        k = up;
      }
    },
    pop = () => {
      const top = heap[0]!,
        last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        for (let k = 0; ;) {
          const l = 2 * k + 1,
            r = l + 1;
          let m = k;
          if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
          if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
          if (m === k) break;
          [heap[k], heap[m]] = [heap[m]!, heap[k]!];
          k = m;
        }
      }
      return top;
    };
  years[from] = 0;
  push(from);
  while (heap.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    for (const w of ways[i]!) {
      if (done[w.to]) continue;
      const y =
        years[i]! +
        laneYearsThrough(lanes[w.lane]!) +
        (mouthLy(stars[i]!.mass) + mouthLy(stars[w.to]!.mass)) / REF_CRUISE;
      if (y < years[w.to]!) {
        years[w.to] = y;
        prev[w.to] = i;
        push(w.to);
      }
    }
  }
  return { years, prev };
}

/** The way a table holds to a star (null: no lanes reach it, or it is where it starts). */
export function routeIn(
  stars: readonly LaneStar[],
  lanes: readonly Lane[],
  ways: LaneWays,
  t: LaneTable,
  to: number,
): LaneRoute | null {
  if (t.prev[to]! < 0) return null;
  const path = [to];
  for (let i = to; t.prev[i]! >= 0;) path.push((i = t.prev[i]!));
  path.reverse();
  let ly = 0,
    jump = 0,
    mouths = 0,
    tonnes = 0;
  const tides: number[] = [],
    lengths: number[] = [];
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k]!,
      b = path[k + 1]!,
      l = lanes[ways[a]!.find((w) => w.to === b)!.lane]!;
    ly += l.ly;
    jump += laneYearsThrough(l);
    mouths += mouthLy(stars[a]!.mass) + mouthLy(stars[b]!.mass);
    tonnes += laneTonnes(l);
    tides.push(l.tide);
    lengths.push(l.ly);
  }
  return {
    hops: path.length - 1,
    ly,
    jump,
    mouths,
    tonnes,
    stars: path,
    tides,
    lengths,
  };
}
