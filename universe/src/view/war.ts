// Wars seen (Phase 9 M87). On the globe: each war's host marching from its realm's land
// toward the land it wants — a banner-bearer and those behind, on foot over the land, in
// ships over the sea — the defenders standing at what they hold, and a burst where each
// battle was fought lately, the larger the more fell. In a village whose land history
// fought over this year or last: the two hosts in their colours, closing, fighting and
// falling as many as fell, the beaten falling back. A look, by the screen's clock: history
// says who fought where and how it went; the march and the fight play over as a war lasts.
import type { VillagePlan, WarsMap } from "../bridge/index.ts";
import type { SphereGrid } from "../kernel/index.ts";
import { keepOut, villageGround } from "./ground.ts";
import { globeRadius } from "./globe.ts";

type Vec = { x: number; y: number; z: number };

/** A war's way over the globe, sampled once: each step's place (at the ground's height) and whether it is sea. */
export type WarPath = {
  readonly ref: string;
  readonly side: number;
  readonly foe: number;
  readonly points: readonly Vec[];
  readonly sea: readonly boolean[];
  /** Whether the war is still fought (a war ended stands down). */
  readonly fought: boolean;
};

export type WarPaths = {
  readonly paths: readonly WarPath[];
  readonly colors: readonly (readonly [number, number, number])[];
  readonly bursts: readonly { readonly at: Vec; readonly size: number; readonly age: number }[];
};

/** How high above the ground the marks stand (a share of the globe's radius), and how many steps a way has. */
const LIFT = 1.008,
  STEPS = 48;

/** The cell nearest a point, walked to from a cell near it (neighbour by neighbour). */
function walkTo(grid: SphereGrid, from: number, x: number, y: number, z: number): number {
  const p = grid.positions;
  let cell = from,
    best = p[cell * 3]! * x + p[cell * 3 + 1]! * y + p[cell * 3 + 2]! * z;
  for (let moved = true; moved;) {
    moved = false;
    for (let k = grid.offsets[cell]!; k < grid.offsets[cell + 1]!; k++) {
      const n = grid.neighbours[k]!,
        d = p[n * 3]! * x + p[n * 3 + 1]! * y + p[n * 3 + 2]! * z;
      if (d > best) {
        best = d;
        cell = n;
        moved = true;
      }
    }
  }
  return cell;
}

/** A place on the globe at a cell's ground (lifted). */
function placeOf(grid: SphereGrid, elevation: Float32Array, cell: number, v?: Vec): Vec {
  const p = grid.positions,
    r = globeRadius(elevation[cell] ?? 0) * LIFT,
    u = v ?? { x: p[cell * 3]!, y: p[cell * 3 + 1]!, z: p[cell * 3 + 2]! };
  return { x: u.x * r, y: u.y * r, z: u.z * r };
}

/**
 * The year's wars as ways over the globe (once, as the map comes): each host's way from
 * where it sets out to what it wants, step by step over the ground and the sea; each side's
 * colour; the battles' bursts.
 */
export function warPaths(map: WarsMap, grid: SphereGrid, elevation: Float32Array): WarPaths {
  const colors: [number, number, number][] = [],
    colorOf = (c: readonly [number, number, number]) => {
      const i = colors.findIndex((k) => k[0] === c[0] && k[1] === c[1] && k[2] === c[2]);
      if (i >= 0) return i;
      colors.push([c[0], c[1], c[2]]);
      return colors.length - 1;
    },
    p = grid.positions,
    unit = (c: number): Vec => ({ x: p[c * 3]!, y: p[c * 3 + 1]!, z: p[c * 3 + 2]! });
  const paths: WarPath[] = [],
    bursts: WarPaths["bursts"][number][] = [];
  for (const w of map.wars) {
    const a = unit(w.from),
      b = unit(w.to),
      dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)),
      theta = Math.acos(dot);
    if (theta < 1e-6) continue;
    const points: Vec[] = [],
      sea: boolean[] = [];
    let cell = w.from;
    for (let i = 0; i <= STEPS; i++) {
      // Along the great circle between them (slerp).
      const k = i / STEPS,
        s0 = Math.sin((1 - k) * theta) / Math.sin(theta),
        s1 = Math.sin(k * theta) / Math.sin(theta),
        v = { x: a.x * s0 + b.x * s1, y: a.y * s0 + b.y * s1, z: a.z * s0 + b.z * s1 };
      cell = walkTo(grid, cell, v.x, v.y, v.z);
      points.push(placeOf(grid, elevation, cell, v));
      sea.push((elevation[cell] ?? 0) <= 0);
    }
    paths.push({
      ref: w.ref,
      side: colorOf(w.attacker.color),
      foe: colorOf(w.defender.color),
      points,
      sea,
      fought: w.ended === null,
    });
    for (const f of w.battles)
      if (f.spot >= 0)
        bursts.push({
          at: placeOf(grid, elevation, f.spot),
          // The larger the more fell.
          size: 0.02 + 0.035 * Math.min(1, Math.log10(1 + f.fallen) / 4),
          age: Math.max(0, map.year - f.year),
        });
  }
  return { paths, colors, bursts };
}

/** A war's mark on the globe now: where it stands, which way is up and which ahead, its side, whether a ship. */
export type WarToken = {
  readonly at: Vec;
  readonly up: Vec;
  readonly ahead: Vec;
  readonly side: number;
  readonly ship: boolean;
  /** The banner-bearer at the column's head (or a defender's standard). */
  readonly lead: boolean;
};

/** How long a host's march from its land to the front takes on the screen (seconds). */
export const MARCH = 10;

/** Every host on the globe at screen time `s`: the marchers of each war still fought, and its defenders. */
export function warTokens(w: WarPaths, s: number): WarToken[] {
  const out: WarToken[] = [];
  w.paths.forEach((path, n) => {
    if (!path.fought) return;
    const at = (k: number) => {
      const f = Math.max(0, Math.min(1, k)) * (path.points.length - 1),
        i = Math.min(path.points.length - 2, Math.floor(f)),
        q = f - i,
        a = path.points[i]!,
        b = path.points[i + 1]!;
      return {
        at: { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q, z: a.z + (b.z - a.z) * q },
        ahead: norm({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }),
        sea: path.sea[q < 0.5 ? i : i + 1]!,
      };
    };
    // The column marches out, and stops short of the front; then marches again.
    const lead = ((s / MARCH + n * 0.37) % 1) * 0.9;
    for (let k = 0; k < 4; k++) {
      const m = lead - k * 0.035;
      if (m < 0) break;
      const p = at(m);
      out.push({
        at: p.at,
        up: norm(p.at),
        ahead: p.ahead,
        side: path.side,
        ship: p.sea,
        lead: k === 0,
      });
    }
    // The defenders stand at what they hold, facing the way the host comes.
    const held = at(1),
      back = at(0.96);
    for (const k of [0, 1]) {
      const d = k ? back : held;
      out.push({
        at: d.at,
        up: norm(d.at),
        ahead: { x: -d.ahead.x, y: -d.ahead.y, z: -d.ahead.z },
        side: path.foe,
        ship: d.sea,
        lead: k === 0,
      });
    }
  });
  return out;
}

function norm(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

// —— A battle in a village's land ——————————————————————————————————————————————

/** A soldier in a village's battle now: where (metres), facing, their side, what they are at. */
export type Soldier = {
  x: number;
  z: number;
  yaw: number;
  /** 0 the attackers, 1 the defenders. */
  side: 0 | 1;
  doing: "advance" | "fight" | "fallen" | "fall back";
};

/** How long a battle's round plays on the screen (seconds). */
export const BATTLE_ROUND = 30;

const unit = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/**
 * The battle about a village now (screen time `s`), if history fought one in its land this
 * year or last: `each` a side, the attackers coming in by the road and the defenders out
 * from the homes, closing, fighting at the line between, falling — as large a share as fell
 * of those who fought — and the beaten falling back. Empty where there was no battle.
 */
export function battleOf(plan: VillagePlan, each: number, s: number): Soldier[] {
  const b = plan.life?.battle;
  if (!b || each < 1) return [];
  const ground = villageGround(plan),
    way = Math.atan2(plan.road.z, plan.road.x),
    ux = Math.cos(way),
    uz = Math.sin(way),
    // The line where they meet: past the homes, toward the road.
    front = ground.homesReach + 40,
    phase = (s / BATTLE_ROUND) % 1,
    // As large a share falls as fell of those who fought (at least a few, at most half).
    falls = Math.max(0.1, Math.min(0.5, b.fallen / (b.fallen + 400))),
    beaten: 0 | 1 = b.won ? 1 : 0,
    // So many fall of both hosts, the beaten the more (two in three of the fallen).
    down = Math.round(falls * 2 * each),
    downOf = (side: number) =>
      side === beaten
        ? Math.min(each, Math.round(down * 0.65))
        : down - Math.min(each, Math.round(down * 0.65)),
    out: Soldier[] = [];
  const smooth = (x: number) => x * x * (3 - 2 * x);
  for (const side of [0, 1] as const)
    for (let i = 0; i < each; i++) {
      // Each in their rank and file: two ranks, facing the other side.
      const file = (i >> 1) - (each / 2 - 1) / 2,
        rank = i & 1,
        across = file * 3.2 + (unit(i, side * 7) - 0.5) * 1.2,
        from = side === 0 ? front + 34 + rank * 4 : front - 30 - rank * 4,
        meet = side === 0 ? front + 1.6 + rank * 2.6 : front - 1.6 - rank * 2.6,
        fallsAt = 0.38 + 0.4 * unit(i, side * 13 + 1),
        // (Which fall: a keyed turn through the host, as many as fell.)
        fallen = (i * 11 + side * 3) % each < downOf(side) && phase > fallsAt && phase < 0.97;
      let out1: number, doing: Soldier["doing"];
      if (phase < 0.3) {
        out1 = from + (meet - from) * smooth(phase / 0.3);
        doing = "advance";
      } else if (phase < 0.82 || side !== beaten) {
        out1 = meet;
        doing = "fight";
      } else {
        out1 = meet + (from - meet) * smooth((phase - 0.82) / 0.18) * 0.6;
        doing = "fall back";
      }
      if (fallen) doing = "fallen";
      const p = {
        x: ux * out1 - uz * across,
        z: uz * out1 + ux * across,
      };
      keepOut(ground, p, 1.2);
      // Facing the other side (their backs turned as they fall back).
      const toward = side === 0 ? way + Math.PI : way,
        yaw =
          Math.atan2(Math.cos(toward), Math.sin(toward)) + (doing === "fall back" ? Math.PI : 0);
      out.push({ x: p.x, z: p.z, yaw, side, doing });
    }
  return out;
}
