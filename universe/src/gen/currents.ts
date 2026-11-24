// The currents of a world's seas (Round D), from its own geometry and spin: the winds' bands (gen/climate.ts, as many
// as its day makes) drive a great gyre between each pair of their strongest lines; where the spin's pull turns the
// water (Coriolis, growing from the equator), each gyre's return flow is pressed against its basin's western shore
// into a narrow, fast current (Stommel's western intensification), while it drifts back slowly and broadly in the
// east. A gyre between the trade winds and the westerlies turns one way, carrying warm water poleward along the west of
// its basin (the eastern shores of the lands); the gyre poleward of it turns the other, bringing cold water down. What a
// current carries is the warmth of the latitudes it came from: the steeper the world's warmth falls toward its poles,
// and the wider the basin, the more. The slower a world turns the more water each gyre moves (Sverdrup's transport
// goes as one over the spin's gradient). Where the trades blow along an eastern shore, they drive the surface water
// off it and cold water wells up from below. Coasts take their sea's warmth inland where the wind blows onshore.
//
// A pure reading of the generated world, kept by its ground and never stored: the climate as made already holds its
// currents at their made strength; what moves in play is their strength (sim/planet/motion.ts), and with it a share
// of the warmth they bring each coast.
import { dmath } from "../kernel/index.ts";
import { spinHours } from "./bodies.ts";
import { windAt } from "./climate.ts";
import type { HomeWorld } from "./homeworld.ts";

/** How much of a basin's breadth its western current fills (a share): a narrow, fast jet. */
const WESTERN = 0.12;
/** Of the warmth the latitudes it came from hold, the share a current brings. */
const CARRIES = 0.5;
/** A basin this wide (km) or wider holds a whole gyre. */
const FULL_BASIN = 4000;
/** The cold water that wells up on an eastern shore under the trades (degrees, at the full). */
const UPWELLING = 2.5;
/** How far a coast's sea warmth reaches inland, a step at a time (the share kept at each), and how many steps. */
const INLAND_KEEP = 0.55;
const INLAND_STEPS = 3;

export type Currents = {
  /** Each cell's warmth from its sea's currents at their made strength (degrees; + a warm current, − a cold one). */
  readonly warmth: Float32Array;
  /** Each sea cell's flow: +1 a western current (fast, poleward or equatorward), −1 an upwelling, 0 the broad drift. */
  readonly flow: Int8Array;
};

/** Along a row of cells heading one way (east or west), how many steps of sea before land (-1: the sea goes all round). */
function stepsToShore(next: Int32Array, sea: Uint8Array): Int32Array {
  const n = next.length,
    out = new Int32Array(n).fill(-2),
    path: number[] = [];
  for (let c = 0; c < n; c++) {
    if (!sea[c] || out[c] !== -2) continue;
    path.length = 0;
    let at = c,
      end = 0;
    // Walk until land, a cell already reckoned, or a cell met before on this walk (the sea goes all round).
    for (;;) {
      if (!sea[at]) {
        end = 0;
        break;
      }
      if (out[at]! >= -1) {
        end = out[at]! < 0 ? -1 : out[at]! + 1;
        break;
      }
      if (out[at] === -3) {
        end = -1;
        break;
      }
      out[at] = -3;
      path.push(at);
      at = next[at]!;
    }
    for (let i = path.length - 1; i >= 0; i--) {
      const p = path[i]!;
      if (end < 0) out[p] = -1;
      else {
        out[p] = end;
        end++;
      }
    }
  }
  return out;
}

const KEPT = new Map<string, Currents>();

/** A world's currents (kept by its ground). */
export function currentsOf(w: HomeWorld): Currents {
  const g = w.grid,
    n = g.count,
    key = `${w.ground}:${n}`,
    kept = KEPT.get(key);
  if (kept) return kept;
  const P = g.positions,
    e = w.tectonics.elevation,
    sea = new Uint8Array(n),
    east = new Int32Array(n),
    west = new Int32Array(n);
  for (let c = 0; c < n; c++) sea[c] = e[c]! <= 0 ? 1 : 0;
  // Each cell's neighbour most nearly east of it, and most nearly west.
  for (let c = 0; c < n; c++) {
    const x = P[3 * c]!,
      z = P[3 * c + 2]!,
      l = Math.sqrt(x * x + z * z) || 1,
      ex = z / l,
      ez = -x / l;
    let be = c,
      bw = c,
      most = -Infinity,
      least = Infinity;
    for (let k = g.offsets[c]!; k < g.offsets[c + 1]!; k++) {
      const m = g.neighbours[k]!,
        d = (P[3 * m]! - x) * ex + (P[3 * m + 2]! - z) * ez;
      if (d > most) {
        most = d;
        be = m;
      }
      if (d < least) {
        least = d;
        bw = m;
      }
    }
    east[c] = be;
    west[c] = bw;
  }
  const toEast = stepsToShore(east, sea),
    toWest = stepsToShore(west, sea),
    bands = w.climate.bands,
    tilt = w.planet.tilt,
    spread = 60 * (1 - (0.9 * tilt) / 90),
    spin = dmath.clamp(Math.sqrt(spinHours(w.planet) / 24), 0.6, 1.6),
    radiusKm = 6371 * w.planet.radius,
    warmth = new Float32Array(n),
    flow = new Int8Array(n),
    westMean = WESTERN * (1 - dmath.exp(-1 / WESTERN));
  for (let c = 0; c < n; c++) {
    if (!sea[c] || toEast[c]! < 0 || toWest[c]! < 0) continue;
    const phi = g.lat[c]!,
      s = Math.abs(dmath.sin(phi)),
      // (No gyre turns at the equator, where the spin's pull is nought.)
      coriolis = Math.min(1, s / 0.17),
      x = (Math.abs(phi) / (Math.PI / 2)) * bands,
      sense = -dmath.cos(Math.PI * x),
      span = toEast[c]! + toWest[c]! + 1,
      across = (toWest[c]! + 0.5) / span,
      breadth = span * radiusKm * Math.sqrt(g.areas[c]!),
      basin = Math.min(1, breadth / FULL_BASIN),
      // (How fast the warmth falls with latitude here, and how far a gyre reaches across it.)
      fall = spread * 0.5 * Math.abs(dmath.sin(2 * phi)),
      reach = Math.PI / 2 / bands / 2,
      carried = CARRIES * fall * reach * basin * spin * coriolis,
      profile = dmath.exp(-across / WESTERN) - westMean;
    let t = carried * sense * profile;
    // The trades along an eastern shore: cold water wells up.
    const trades = x > 0.15 && x < 0.9 && Math.floor(x) % 2 === 0;
    if (trades && toEast[c]! <= 1) {
      t -= UPWELLING * coriolis * basin;
      flow[c] = -1;
    } else if (across < WESTERN * 1.5 && Math.abs(sense) > 0.3) flow[c] = 1;
    warmth[c] = t;
  }
  // The coasts take their sea's warmth inland, where the wind blows onshore, a step at a time.
  let front: number[] = [];
  for (let c = 0; c < n; c++) if (sea[c]) front.push(c);
  const reached = Uint8Array.from(sea);
  for (let step = 0; step < INLAND_STEPS && front.length; step++) {
    const next: number[] = [],
      sum = new Map<number, [number, number]>();
    for (const c of front)
      for (let k = g.offsets[c]!; k < g.offsets[c + 1]!; k++) {
        const m = g.neighbours[k]!;
        if (reached[m]) continue;
        const [wx, wy, wz] = windAt(P, g.lat[m]!, bands, m),
          onshore =
            wx * (P[3 * m]! - P[3 * c]!) +
              wy * (P[3 * m + 1]! - P[3 * c + 1]!) +
              wz * (P[3 * m + 2]! - P[3 * c + 2]!) >
            0
              ? 1
              : 0.4,
          was = sum.get(m) ?? [0, 0];
        was[0] += warmth[c]! * onshore;
        was[1] += 1;
        sum.set(m, was);
      }
    for (const [m, [t, k]] of [...sum].sort((a, b) => a[0] - b[0])) {
      warmth[m] = (INLAND_KEEP * t) / k;
      reached[m] = 1;
      next.push(m);
    }
    front = next;
  }
  const made: Currents = { warmth, flow };
  KEPT.set(key, made);
  if (KEPT.size > 8) KEPT.delete(KEPT.keys().next().value!);
  return made;
}
