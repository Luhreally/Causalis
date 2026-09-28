// Wars seen (Phase 9 M87). On the globe: each war's host marching from its realm's land
// toward the land it wants — a banner-bearer and those behind, on foot over the land, in
// ships over the sea — the defenders standing at what they hold, and a burst where each
// battle was fought lately, the larger the more fell. In a village whose land history
// fought over this year or last: the two hosts in their colours, closing, fighting and
// falling as many as fell, the beaten falling back. A look, by the screen's clock: history
// says who fought where and how it went; the march and the fight play over as a war lasts.
import type { HostKinds, VillagePlan, WarsMap } from "../bridge/index.ts";
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
  /** The men each side fields (its host as large as they are, M110), and whether each rides. */
  readonly men: number;
  readonly foeMen: number;
  readonly mounted: boolean;
  readonly foeMounted: boolean;
};

export type WarPaths = {
  readonly paths: readonly WarPath[];
  readonly colors: readonly (readonly [number, number, number])[];
  readonly bursts: readonly {
    readonly at: Vec;
    readonly size: number;
    readonly age: number;
    /** The battle's event (its page). */
    readonly event: string;
    /** Its two sides' colours (the attacker's first), who won, how many fell (M110). */
    readonly side: number;
    readonly foe: number;
    readonly won: boolean;
    readonly fallen: number;
  }[];
  /** The besiegers' camps about the seats under siege (M110): where, whose, their war. */
  readonly camps: readonly { readonly at: Vec; readonly side: number; readonly war: string }[];
  /** The garrisons at the seats of realms at peace (M110). */
  readonly garrisons: readonly {
    readonly at: Vec;
    readonly side: number;
    readonly men: number;
    readonly mounted: boolean;
    readonly realm: string;
  }[];
};

/** Whether a host's design has it ride (horses, a chariot). */
export function rides(host: HostKinds | null | undefined): boolean {
  return !!host && (host.mount === "horse" || host.mount === "cavalry" || host.mount === "chariot");
}

/**
 * A host's shape on the globe, by the men it fields (M110): ranks one behind another and files
 * abreast — a band of hundreds three short ranks, a host of thousands two files of five, a great
 * host of a hundred thousand three files of eight.
 */
export function hostShape(men: number): { ranks: number; files: number } {
  const m = Math.max(1, men);
  return {
    ranks: Math.max(3, Math.min(9, Math.round(2 + 1.6 * Math.log10(m / 200)))),
    files: m < 3000 ? 1 : m < 30000 ? 2 : 3,
  };
}

/** The defenders' block at what they hold, by the men they field: two ranks to five. */
export function holdShape(men: number): { ranks: number; files: number } {
  const m = Math.max(1, men);
  return {
    ranks: Math.max(2, Math.min(5, Math.round(1 + 1.2 * Math.log10(m / 300)))),
    files: m < 3000 ? 1 : m < 30000 ? 2 : 3,
  };
}

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
    bursts: WarPaths["bursts"][number][] = [],
    camps: WarPaths["camps"][number][] = [];
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
    const side = colorOf(w.attacker.color),
      foe = colorOf(w.defender.color);
    paths.push({
      ref: w.ref,
      side,
      foe,
      points,
      sea,
      fought: w.ended === null,
      men: w.attacker.fields,
      foeMen: w.defender.fields,
      mounted: rides(w.attacker.host),
      foeMounted: rides(w.defender.host),
    });
    for (const f of w.battles)
      if (f.spot >= 0)
        bursts.push({
          at: placeOf(grid, elevation, f.spot),
          // The larger the more fell.
          size: 0.02 + 0.035 * Math.min(1, Math.log10(1 + f.fallen) / 4),
          age: Math.max(0, map.year - f.year),
          event: f.event,
          side,
          foe,
          won: f.won,
          fallen: f.fallen,
        });
    if (w.siege !== null && w.siege >= 0 && w.ended === null)
      camps.push({ at: placeOf(grid, elevation, w.siege), side, war: w.ref });
  }
  const garrisons = (map.garrisons ?? []).map((g) => ({
    at: placeOf(grid, elevation, g.spot),
    side: colorOf(g.color),
    men: g.fields,
    mounted: rides(g.host),
    realm: g.realm,
  }));
  return { paths, colors, bursts, camps, garrisons };
}

/** A war's mark on the globe now: where it stands, which way is up and which ahead, its side, whether a ship. */
export type WarToken = {
  /** The war it marches in (its page). */
  readonly ref: string;
  readonly at: Vec;
  readonly up: Vec;
  readonly ahead: Vec;
  readonly side: number;
  /** Whether it is of the attacker's host (else it stands with the defenders). */
  readonly attacker: boolean;
  readonly ship: boolean;
  /** The banner-bearer at the column's head (or a defender's standard). */
  readonly lead: boolean;
  /** How much of it is drawn (0 … 1): a march ends and begins again in a blink, not a jump. */
  readonly size: number;
  /** Whether it bears a banner (the head, and one in every three ranks, M110). */
  readonly banner: boolean;
  /** Whether it rides (its host's design has horses or chariots). */
  readonly mounted: boolean;
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
    // The column marches out, and stops short of the front; then marches again (shrunk away
    // at the front and grown at the start, so none jumps back). As many ranks and files as the
    // men it fields (M110), its banner at its head and over every third rank.
    const cycle = (s / MARCH + n * 0.37) % 1,
      lead = cycle * 0.9,
      size = loopSize(cycle, 0.06, 0.08),
      shape = hostShape(path.men),
      mid = Math.floor((shape.files - 1) / 2);
    for (let r = 0; r < shape.ranks; r++) {
      const m = lead - r * 0.03;
      if (m < 0) break;
      const p = at(m),
        up = norm(p.at),
        aside = norm(cross(up, p.ahead));
      for (let f = 0; f < shape.files; f++) {
        const off = (f - (shape.files - 1) / 2) * 0.011;
        out.push({
          ref: path.ref,
          at: { x: p.at.x + aside.x * off, y: p.at.y + aside.y * off, z: p.at.z + aside.z * off },
          up,
          ahead: p.ahead,
          side: path.side,
          attacker: true,
          ship: p.sea,
          lead: r === 0 && f === mid,
          // (Each behind the lead grows in as it sets out.)
          size: Math.min(size, loopSize(m / 0.9, 0.06, 0)),
          banner: f === mid && r % 3 === 0,
          mounted: path.mounted,
        });
      }
    }
    // The defenders stand in a block at what they hold, facing the way the host comes.
    const hold = holdShape(path.foeMen),
      hmid = Math.floor((hold.files - 1) / 2);
    for (let r = 0; r < hold.ranks; r++) {
      const d = at(1 - r * 0.04),
        up = norm(d.at),
        aside = norm(cross(up, d.ahead));
      for (let f = 0; f < hold.files; f++) {
        const off = (f - (hold.files - 1) / 2) * 0.011;
        out.push({
          ref: path.ref,
          at: { x: d.at.x + aside.x * off, y: d.at.y + aside.y * off, z: d.at.z + aside.z * off },
          up,
          ahead: { x: -d.ahead.x, y: -d.ahead.y, z: -d.ahead.z },
          side: path.foe,
          attacker: false,
          ship: d.sea,
          lead: r === 0 && f === hmid,
          size: 1,
          banner: r === 0 && f === hmid,
          mounted: path.foeMounted,
        });
      }
    }
  });
  return out;
}

/** One who fought in a battle on the globe now (M110): standing in their side's mass, or fallen. */
export type BattleFigure = {
  readonly event: string;
  readonly at: Vec;
  readonly up: Vec;
  readonly ahead: Vec;
  readonly side: number;
  readonly fallen: boolean;
  readonly size: number;
};

/**
 * The battles of this year and last as two masses meeting (M110): each side a block in its
 * colour pressing on the other across the place it was fought, swaying as the fight goes, the
 * larger the more fought; and between them the fallen, as many more as fell. Last year's
 * smaller: its fight is done, its fallen remain.
 */
export function battleFigures(w: WarPaths, s: number): BattleFigure[] {
  const out: BattleFigure[] = [];
  w.bursts.forEach((b, n) => {
    if (b.age > 1) return;
    const up = norm(b.at),
      [t0, t1] = tangentsOf(up),
      turn = hashOf(b.event) * Math.PI * 2,
      dir = {
        x: t0.x * Math.cos(turn) + t1.x * Math.sin(turn),
        y: t0.y * Math.cos(turn) + t1.y * Math.sin(turn),
        z: t0.z * Math.cos(turn) + t1.z * Math.sin(turn),
      },
      aside = norm(cross(up, dir)),
      k = b.age === 0 ? 1 : 0.7,
      each = Math.max(3, Math.min(8, Math.round(2 + Math.log10(1 + b.fallen)))),
      sway = b.age === 0 ? Math.sin(s * 2.2 + n) * 0.003 : 0,
      place = (along: number, across: number): Vec => ({
        x: b.at.x + dir.x * along + aside.x * across,
        y: b.at.y + dir.y * along + aside.y * across,
        z: b.at.z + dir.z * along + aside.z * across,
      });
    for (const [side, sign] of [
      [b.side, -1],
      [b.foe, 1],
    ] as const)
      for (let i = 0; i < each; i++) {
        const rank = i % 2,
          file = Math.floor(i / 2) - (Math.ceil(each / 2) - 1) / 2;
        out.push({
          event: b.event,
          at: place(sign * (0.008 + rank * 0.007) + sign * sway, file * 0.008),
          up,
          ahead: { x: -sign * dir.x, y: -sign * dir.y, z: -sign * dir.z },
          side,
          fallen: false,
          size: k,
        });
      }
    // The fallen between them, the more the more fell (of both sides, the beaten more).
    const fallen = Math.max(1, Math.min(10, Math.round(2.5 * Math.log10(1 + b.fallen))));
    for (let i = 0; i < fallen; i++) {
      const u = hashOf(`${b.event}:${i}`),
        v = hashOf(`${b.event}:${i}:v`),
        beaten = b.won ? b.foe : b.side;
      out.push({
        event: b.event,
        at: place((u - 0.5) * 0.012, (v - 0.5) * 0.03),
        up,
        ahead: { x: aside.x, y: aside.y, z: aside.z },
        side: i % 3 === 2 ? (beaten === b.side ? b.foe : b.side) : beaten,
        fallen: true,
        size: k,
      });
    }
  });
  return out;
}

function cross(a: Vec, b: Vec): Vec {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/** Two directions along the globe's face at a place whose up is `u`. */
function tangentsOf(u: Vec): [Vec, Vec] {
  const a = Math.abs(u.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 },
    t0 = norm(cross(a, u)),
    t1 = cross(u, t0);
  return [t0, t1];
}

/** A number in [0, 1) of a text's own. */
function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
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
  /** How much of them is drawn (0 … 1): the round begins and ends in a blink, not a jump. */
  readonly size: number;
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
      out.push({ x: p.x, z: p.z, yaw, side, doing, size: loopSize(phase, 0.04, 0.06) });
    }
  return out;
}

/**
 * Where a village's battle is fought (the middle of the line where the hosts meet), for the
 * view to face it — a battle zoomed into from its land is seen closer (M95). Null: none.
 */
export function battleFront(plan: VillagePlan): { x: number; z: number } | null {
  if (!plan.life?.battle) return null;
  const way = Math.atan2(plan.road.z, plan.road.x),
    front = villageGround(plan).homesReach + 40;
  return { x: Math.cos(way) * front, z: Math.sin(way) * front };
}

// —— Wars in a land's map (Phase 10 M95) ——————————————————————————————————————————

type Flat = { readonly x: number; readonly z: number };

/**
 * What a land's map shows of the wars the globe shows (so a war zoomed into is the war seen
 * closer): each host crossing the land (in from its edge toward what it wants there, or out
 * from its land toward the front), the defenders standing at what they hold, and each battle
 * fought in the land lately (as long as the globe shows it) — where, how many fell, who won.
 */
export type LandWars = {
  readonly colors: readonly (readonly [number, number, number])[];
  /** A host's way across the map (km, x east and z south), and whether defenders hold its end. */
  readonly marches: readonly {
    readonly ref: string;
    readonly from: Flat;
    readonly to: Flat;
    readonly side: number;
    readonly foe: number;
    readonly held: boolean;
    /** Whose host it is, and against whom. */
    readonly name: string;
    /** Its two realms and the men each fields (their counters, Phase 11 M101). */
    readonly attacker: { readonly ref: string; readonly fields: number };
    readonly defender: { readonly ref: string; readonly fields: number };
    /** What each side's host is made of (its arms' kinds, M110). */
    readonly hosts: { readonly attacker: HostKinds | null; readonly defender: HostKinds | null };
  }[];
  /** The besiegers' camps about a seat under siege in the land (M110). */
  readonly camps: readonly {
    readonly war: string;
    readonly at: Flat;
    readonly side: number;
    readonly name: string;
  }[];
  /** The garrison of a realm at peace whose seat is in the land (M110). */
  readonly garrisons: readonly {
    readonly realm: string;
    readonly at: Flat;
    readonly side: number;
    readonly name: string;
    readonly men: number;
    readonly host: HostKinds | null;
  }[];
  readonly battles: readonly {
    readonly event: string;
    /** "Sairis upon Nirouv, year 400". */
    readonly name: string;
    readonly at: Flat;
    /** 0 … 1: the more fell, the larger. */
    readonly size: number;
    /** Years since (0: this year). */
    readonly age: number;
    readonly side: number;
    readonly foe: number;
    readonly won: boolean;
    /** What each side's host is made of (M110). */
    readonly hosts: { readonly attacker: HostKinds | null; readonly defender: HostKinds | null };
  }[];
};

/** A loop's drawn size at its phase (0 … 1): grown over `grow` of it, shrunk over the last `shrink`. */
export function loopSize(phase: number, grow: number, shrink: number): number {
  const k =
    phase < grow ? phase / grow : shrink > 0 && phase > 1 - shrink ? (1 - phase) / shrink : 1;
  return Math.max(0, Math.min(1, k * k * (3 - 2 * k)));
}

/** One of a host's column in a land, or a ship bearing some of them: where, how large, whether its head. */
export type ColumnMark = {
  readonly x: number;
  readonly z: number;
  readonly size: number;
  readonly lead: boolean;
  /** Its rank from the front (0: the head's), and whether it bears a banner (M110). */
  readonly rank: number;
  readonly banner: boolean;
};

/**
 * A host's shape in a land, by the men it fields (M110): files abreast and ranks behind — two
 * files of four ranks for a band, four of ten for a great host.
 */
export function landShape(men: number): { files: number; ranks: number } {
  const m = Math.max(1, men);
  return {
    files: m < 3000 ? 2 : m < 30000 ? 3 : 4,
    ranks: Math.max(4, Math.min(10, Math.round(4 + 1.5 * Math.log10(m / 300)))),
  };
}

/**
 * A host's column in a land at phase `cycle` (0 … 1) of its march across it: a banner-bearer
 * and those behind, in ranks `shape.files` abreast (two abreast, six deep, unless told), walking
 * in from `from` toward `to`. Where the ground under them is sea, they go in ships — one for
 * every four of the column, down its middle — as the globe draws a host at sea.
 */
export function landColumn(
  from: Flat,
  to: Flat,
  cycle: number,
  sea: (x: number, z: number) => boolean,
  shape: { files: number; ranks: number } = { files: 2, ranks: 6 },
): {
  people: ColumnMark[];
  ships: ColumnMark[];
  /** Where its head is, and whether afloat. */
  head: Flat | null;
  afloat: boolean;
  yaw: number;
  /** How far grown in (or shrunk away) the whole column is. */
  grown: number;
} {
  const dx = to.x - from.x,
    dz = to.z - from.z,
    len = Math.hypot(dx, dz) || 1,
    ux = dx / len,
    uz = dz / len,
    lead = cycle * 0.92,
    grown = loopSize(cycle, 0.06, 0.08),
    people: ColumnMark[] = [],
    ships: ColumnMark[] = [];
  let head: Flat | null = null,
    afloat = false;
  for (let k = 0; k < shape.files * shape.ranks; k++) {
    const rank = Math.floor(k / shape.files),
      file = k % shape.files,
      back = rank * 1.1,
      // (The head walks alone at the front's middle; the rest in their files.)
      aside = k ? (file - (shape.files - 1) / 2) * 0.9 : 0,
      along = lead * len - back;
    if (along < 0) break;
    const at = { x: from.x + ux * along - uz * aside, z: from.z + uz * along + ux * aside },
      size = Math.min(grown, loopSize(along / (len * 0.92), 0.06, 0));
    if (k === 0) head = at;
    if (sea(at.x, at.z)) {
      if (k === 0) afloat = true;
      if (k % 4 === 0)
        ships.push({
          x: from.x + ux * along,
          z: from.z + uz * along,
          size,
          lead: k === 0,
          rank,
          banner: k === 0,
        });
    } else
      people.push({
        ...at,
        size,
        lead: k === 0,
        rank,
        // (A banner at the head, and over the middle of every third rank behind it.)
        banner: k === 0 || (rank > 0 && rank % 3 === 0 && file === Math.floor(shape.files / 2)),
      });
  }
  return { people, ships, head, afloat, yaw: Math.atan2(ux, uz), grown };
}

/** The men a host fields, as its counter says them: 850, 3.4k, 12k (Phase 11 M101). */
export function counterWords(men: number): string {
  const n = Math.max(0, Math.round(men));
  return n >= 9950 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

/**
 * The wars in a land's map: `parent` is each tile's spot of the globe's grid (the land's
 * map is `size` tiles a side, `tileKm` each). A spot of the map stands at the middle of its
 * tiles; a spot beyond it, at the map's edge the way it lies (by the map's own frame: east
 * and north at its middle, as the land's map is drawn).
 */
export function landWars(
  map: WarsMap,
  parent: Int32Array,
  size: number,
  tileKm: number,
  grid: SphereGrid,
): LandWars {
  const half = ((size - 1) * tileKm) / 2,
    sums = new Map<number, { x: number; z: number; n: number }>();
  for (let t = 0; t < parent.length; t++) {
    const s = parent[t]!,
      k = sums.get(s) ?? { x: 0, z: 0, n: 0 };
    k.x += (t % size) * tileKm - half;
    k.z += Math.floor(t / size) * tileKm - half;
    k.n++;
    sums.set(s, k);
  }
  const here = (spot: number): Flat | null => {
    const k = sums.get(spot);
    return k ? { x: k.x / k.n, z: k.z / k.n } : null;
  };
  // The map's frame at its middle: east about the pole, north across it.
  const p = grid.positions,
    mid = parent[Math.floor(size / 2) * size + Math.floor(size / 2)]!,
    ox = p[mid * 3]!,
    oy = p[mid * 3 + 1]!,
    oz = p[mid * 3 + 2]!,
    el = Math.hypot(oz, ox) || 1,
    ex = oz / el,
    ez = -ox / el,
    nx = oy * ez,
    ny = oz * ex - ox * ez,
    nz = -oy * ex;
  /** Where the way toward a spot beyond the map leaves it (at its edge, a little in). */
  const edgeToward = (spot: number, from: Flat): Flat => {
    const dx = p[spot * 3]! - ox,
      dy = p[spot * 3 + 1]! - oy,
      dz = p[spot * 3 + 2]! - oz,
      east = dx * ex + dz * ez,
      south = -(dx * nx + dy * ny + dz * nz),
      l = Math.hypot(east, south) || 1,
      ux = east / l,
      uz = south / l,
      reach = half * 0.92,
      // From its start, out along the way until the edge of the square.
      tx = ux > 0 ? (reach - from.x) / ux : ux < 0 ? (-reach - from.x) / ux : Infinity,
      tz = uz > 0 ? (reach - from.z) / uz : uz < 0 ? (-reach - from.z) / uz : Infinity,
      t = Math.max(0, Math.min(tx, tz));
    return { x: from.x + ux * t, z: from.z + uz * t };
  };
  const colors: [number, number, number][] = [],
    colorOf = (c: readonly [number, number, number]) => {
      const i = colors.findIndex((k) => k[0] === c[0] && k[1] === c[1] && k[2] === c[2]);
      if (i >= 0) return i;
      colors.push([c[0], c[1], c[2]]);
      return colors.length - 1;
    },
    marches: LandWars["marches"][number][] = [],
    battles: LandWars["battles"][number][] = [],
    camps: LandWars["camps"][number][] = [];
  for (const w of map.wars) {
    const side = colorOf(w.attacker.color),
      foe = colorOf(w.defender.color),
      prize = here(w.to),
      home = here(w.from),
      name = `${w.attacker.name}'s host upon ${w.defender.name}`,
      sides = {
        attacker: { ref: w.attacker.ref, fields: w.attacker.fields },
        defender: { ref: w.defender.ref, fields: w.defender.fields },
        hosts: { attacker: w.attacker.host ?? null, defender: w.defender.host ?? null },
      };
    if (w.ended === null) {
      // What it wants is here: its host comes in from the way it sets out, to the defenders.
      if (prize)
        marches.push({
          ref: w.ref,
          from: home ?? edgeToward(w.from, prize),
          to: prize,
          side,
          foe,
          held: true,
          name,
          ...sides,
        });
      // It sets out from here: its host goes out toward the front.
      else if (home)
        marches.push({
          ref: w.ref,
          from: home,
          to: edgeToward(w.to, home),
          side,
          foe,
          held: false,
          name,
          ...sides,
        });
    }
    // A seat under siege here: the besiegers' camp about it.
    const besieged = w.siege !== null && w.ended === null ? here(w.siege) : null;
    if (besieged)
      camps.push({
        war: w.ref,
        at: besieged,
        side,
        name: `⛺ The camp of ${w.attacker.name} before ${w.defender.name}'s seat`,
      });
    for (const b of w.battles) {
      const at = b.spot >= 0 ? here(b.spot) : null,
        age = map.year - b.year;
      // (As long as the globe shows its burst: this year and the two before.)
      if (!at || age > 2) continue;
      battles.push({
        event: b.event,
        name: `A battle of ${w.attacker.name} upon ${w.defender.name}, year ${b.year}`,
        at,
        size: Math.min(1, Math.log10(1 + b.fallen) / 4),
        age: Math.max(0, age),
        side,
        foe,
        won: b.won,
        hosts: sides.hosts,
      });
    }
  }
  // A realm at peace whose seat is here: its garrison stands by it.
  const garrisons = (map.garrisons ?? []).flatMap((g) => {
    const at = here(g.spot);
    return at
      ? [
          {
            realm: g.realm,
            at,
            side: colorOf(g.color),
            name: `🛡️ The garrison of ${g.name}`,
            men: g.fields,
            host: g.host,
          },
        ]
      : [];
  });
  return { colors, marches, battles, camps, garrisons };
}
