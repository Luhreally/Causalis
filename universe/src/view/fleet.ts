// The fleet fight the film plays (Phase 67): a pure script of one fight among the stars. It says who
// sails in, which ship breaks and when, the beams and missiles between them, the wrecks, the flashes
// and the eye. Everything drawn is a function of (script, t), so scrubbing is free and the same t
// always gives the same numbers. Ships, places and fates are hashed from the plan's id; the record
// gives only the counts, the strengths, the outcome, the town and the words.
import type { FightSide, StarFightList, StarFightPlan } from "../bridge/index.ts";

export const FLEET_ALT = 0.18;
export const SIDE_MOST = 30;
export const SHIP_LENGTH: readonly [number, number, number] = [0.1, 0.06, 0.035]; // capital, line, escort

export type FleetStage = "arrive" | "fight" | "rout" | "after";
export type V3 = { readonly x: number; readonly y: number; readonly z: number };
export type FleetShip = {
  readonly id: number; // index in script.ships
  readonly side: 0 | 1;
  readonly index: number; // within its side
  readonly cls: 0 | 1 | 2;
  readonly length: number;
  readonly seed: number;
  readonly slot: V3;
  readonly from: V3;
  readonly delay: number;
  readonly breakAt: number | null;
  readonly fleeAt: number | null;
  readonly hits: readonly number[];
  readonly drift: V3;
  readonly platform: boolean;
};
export type FleetShot = {
  readonly t0: number;
  readonly t1: number;
  readonly from: number; // ship id
  readonly to: number; // ship id
  readonly side: 0 | 1;
  readonly kind: "beam" | "missile";
  readonly hit: boolean;
  readonly seed: number;
};
export type FleetScript = {
  readonly id: string;
  readonly ships: readonly FleetShip[];
  readonly shots: readonly FleetShot[]; // sorted by t0
  readonly counts: readonly [number, number];
  readonly lost: readonly [number, number];
  readonly winner: 0 | 1;
  readonly arrive: number;
  readonly fightEnd: number;
  readonly routEnd: number;
  readonly end: number;
  readonly landers: number; // 4 where plan.landing, else 0
  readonly empty: boolean; // no defender in the sky
};
export type ShipNow = {
  readonly id: number;
  readonly side: 0 | 1;
  readonly cls: 0 | 1 | 2;
  readonly lander: boolean;
  readonly state: "sailing" | "fighting" | "fleeing";
  readonly p: V3;
  readonly f: V3; // forward, unit
  readonly roll: number;
  readonly length: number;
  readonly engine: number; // 0 … 1
  readonly burning: boolean;
};
export type WreckNow = {
  readonly id: number;
  readonly side: 0 | 1;
  readonly part: 0 | 1;
  readonly p: V3;
  readonly f: V3;
  readonly roll: number;
  readonly length: number;
};
export type BeamNow = {
  readonly side: 0 | 1;
  readonly a: V3;
  readonly b: V3;
  readonly width: number;
};
export type MissileNow = {
  readonly side: 0 | 1;
  readonly p: V3;
  readonly f: V3;
  readonly trail: number;
};
export type FlashNow = { readonly p: V3; readonly size: number };
export type SparkNow = { readonly p: V3; readonly f: V3; readonly length: number };
export type FleetNow = {
  readonly t: number;
  readonly stage: FleetStage;
  readonly ships: readonly ShipNow[];
  readonly wrecks: readonly WreckNow[];
  readonly beams: readonly BeamNow[];
  readonly missiles: readonly MissileNow[];
  readonly flashes: readonly FlashNow[];
  readonly sparks: readonly SparkNow[];
  /** Ships still in the field: not broken, not gone. */
  readonly left: readonly [number, number];
};
export type FleetFrame = { readonly o: V3; readonly x: V3; readonly y: V3; readonly z: V3 };
export type FleetEye = { readonly e: V3; readonly at: V3 };

// Shared little helpers (the same text in T1, T2 and T3, so the same hashes).
const hashText = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
};
const unit = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const smooth = (k: number) => {
  const c = clamp01(k);
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Private helpers for this file only.
const clampRange = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (a: V3): V3 => {
  const l = Math.sqrt(dot(a, a));
  return l > 1e-12 ? scale(a, 1 / l) : { x: 0, y: 0, z: 1 };
};

const ARRIVE = 7;
const GONE_AFTER = 7;
const ROW_Y: readonly [readonly [number, number, number], readonly [number, number, number]] = [
  [0.4, 0.27, 0.16],
  [-0.1, -0.02, 0.06],
];
const HULL_HITS: readonly [number, number, number] = [5, 3, 2];
const SURVIVOR_HITS: readonly [number, number, number] = [3, 2, 1];
const RANK_KEY: readonly [number, number, number] = [2, 1, 0];
const CADENCE: readonly [number, number, number] = [1.6, 2.4, 3.4];
const AMP: readonly [number, number, number] = [0.007, 0.014, 0.03];
// The eye's keys: time (of 48 s), angle a, distance r, eye height ey, look height ly.
type EyeKey = readonly [number, number, number, number, number];
const EYE_KEYS: readonly EyeKey[] = [
  [0, 0.08, 1.25, 0.02, 0.22],
  [7, 0.22, 1.05, 0.1, 0.06],
  [20, -0.22, 1.05, 0.1, 0.06],
  [30, 0.5, 0.74, 0.16, 0.12],
  [34, 0.62, 0.74, 0.16, 0.1],
  [42, 0.3, 1.1, 0.18, 0.04],
  [48, 0.1, 1.28, 0.2, 0.02],
];

export function shipsOf(strength: number): number {
  return Math.max(6, Math.min(SIDE_MOST, Math.round(4 + 4 * Math.pow(strength, 0.8))));
}

export function sideCount(side: FightSide): number {
  if (side.sky === "none") return 0;
  if (side.sky === "platforms") return Math.min(6, 2 + Math.round(side.strength));
  return shipsOf(side.strength);
}

export function classesOf(n: number, platforms: boolean): readonly [number, number, number] {
  if (platforms) return [0, n, 0];
  const cap = n >= 2 ? clampRange(Math.floor(n / 8), 1, 3) : 0;
  const line = Math.round((n - cap) * 0.4);
  const escort = n - cap - line;
  return [cap, line, escort];
}

const brokenAt = (s: FleetShip, t: number) => s.breakAt !== null && t >= s.breakAt;
const fledAt = (s: FleetShip, t: number) => s.fleeAt !== null && t >= s.fleeAt;
const living = (s: FleetShip, t: number) => !brokenAt(s, t) && !fledAt(s, t);
// The time a ship is held to: frozen at its break.
const timeOf = (s: FleetShip, t: number) => (s.breakAt !== null ? Math.min(t, s.breakAt) : t);

export function fleetScript(plan: StarFightPlan): FleetScript {
  const sides: readonly [FightSide, FightSide] = [plan.attacker, plan.defender];
  const counts: [number, number] = [sideCount(plan.attacker), sideCount(plan.defender)];
  const empty = counts[1] === 0;
  const fightEnd = empty ? ARRIVE : 34;
  const routEnd = empty ? ARRIVE : 42;
  const end = empty ? 14 : 48;
  const winner: 0 | 1 = plan.won ? 0 : 1;
  const loser: 0 | 1 = plan.won ? 1 : 0;

  // How many each side loses.
  const lost: [number, number] = [0, 0];
  if (!empty) {
    const a = plan.attacker.strength;
    const d = Math.max(plan.defender.strength, 0.1);
    const p = a / (a + d);
    const q = plan.won ? p : 1 - p;
    const winnerShare = clampRange(0.15 + 0.55 * (1 - q), 0.15, 0.7);
    const loserShare = clampRange(0.55 + 0.4 * q, 0.55, 0.95);
    lost[winner] = Math.round(counts[winner] * winnerShare);
    lost[loser] = Math.round(counts[loser] * loserShare);
    if (lost[loser] === counts[loser] && counts[loser] >= 2) lost[loser] -= 1; // somebody gets away
  }

  // The ships as they start: class, place in the sky, where they come from, when they arrive.
  const ships: FleetShip[] = [];
  for (const side of [0, 1] as const) {
    const n = counts[side];
    const platform = sides[side].sky === "platforms";
    const [c0, c1, c2] = classesOf(n, platform);
    for (let index = 0; index < n; index++) {
      const cls: 0 | 1 | 2 = index < c0 ? 0 : index < c0 + c1 ? 1 : 2;
      const rowCount = cls === 0 ? c0 : cls === 1 ? c1 : c2;
      const rowStart = cls === 0 ? 0 : cls === 1 ? c0 : c0 + c1;
      const j = index - rowStart;
      const seed = hashText(`${plan.id} ${side} ${index}`);
      const W = cls === 0 ? 0.1 : 0.16;
      const slot: V3 = {
        x:
          (rowCount === 1 ? 0 : (j / (rowCount - 1) - 0.5) * 2 * W) + (unit(seed, 1) - 0.5) * 0.016,
        y:
          ROW_Y[side][cls] +
          (unit(seed, 2) - 0.5) * 0.036 +
          (cls === 2 && rowCount > 10 ? (j % 2 ? 0.03 : -0.03) : 0),
        z: -0.16 + unit(seed, 3) * 0.26,
      };
      let from: V3 = slot;
      if (!platform) {
        from =
          side === 0
            ? { x: slot.x * 1.6, y: 1.5 + unit(seed, 4) * 0.4, z: slot.z - 0.2 }
            : { x: slot.x * 1.3, y: -0.3, z: slot.z - 0.35 };
      }
      const delay = platform || cls === 2 ? 0 : cls === 1 ? 0.8 : 1.6 + unit(seed, 5) * 0.6;
      ships.push({
        id: ships.length,
        side,
        index,
        cls,
        length: platform ? 0.07 : SHIP_LENGTH[cls],
        seed,
        slot,
        from,
        delay,
        breakAt: null,
        fleeAt: null,
        hits: [],
        drift: {
          x: (unit(seed, 30) - 0.5) * 0.024,
          y: (unit(seed, 31) - 0.5) * 0.016,
          z: (unit(seed, 32) - 0.5) * 0.024,
        },
        platform,
      });
    }
  }

  // Which ships break: per side, the first `lost` in rank order (escorts, then line, then capitals).
  const breakAt: (number | null)[] = ships.map(() => null);
  if (!empty) {
    for (const side of [0, 1] as const) {
      const L = lost[side];
      if (L <= 0) continue;
      const e = side === winner ? 1.15 : 0.85;
      const ranked = ships
        .filter((s) => s.side === side)
        .map((s) => ({ s, key: RANK_KEY[s.cls] + unit(s.seed, 6) * 1.2 }))
        .sort((a, b) => a.key - b.key);
      ranked.slice(0, L).forEach(({ s }, k) => {
        breakAt[s.id] =
          ARRIVE + 3 + (fightEnd - ARRIVE - 4) * Math.pow((k + unit(s.seed, 7) * 0.6) / L, e);
      });
    }
  }
  // The loser's unbroken ships run for it after the fight.
  const fleeAt = ships.map((s): number | null =>
    s.side === loser && breakAt[s.id] === null ? fightEnd + unit(s.seed, 9) * 2.5 : null,
  );
  // The hits each ship takes: the broken ones before they break, some survivors once.
  const hitsOf: number[][] = ships.map(() => []);
  if (!empty) {
    for (const s of ships) {
      const bk = breakAt[s.id] ?? null;
      if (bk !== null) {
        const hs: number[] = [];
        for (let h = 0; h < HULL_HITS[s.cls]; h++) {
          hs.push(Math.max(ARRIVE + 0.5, bk - (h + 1) * (0.7 + unit(s.seed, 10 + h) * 0.8)));
        }
        hitsOf[s.id] = hs.sort((a, b) => a - b);
      } else if (unit(s.seed, 8) < 0.6) {
        const hs: number[] = [];
        for (let h = 0; h < SURVIVOR_HITS[s.cls]; h++) {
          hs.push(ARRIVE + 3 + unit(s.seed, 20 + h) * (fightEnd - ARRIVE - 5));
        }
        hitsOf[s.id] = hs.sort((a, b) => a - b);
      }
    }
  }
  const built: FleetShip[] = ships.map((s, i) => ({
    ...s,
    breakAt: breakAt[i] ?? null,
    fleeAt: fleeAt[i] ?? null,
    hits: hitsOf[i] ?? [],
  }));

  // The shots, in creation order first (the seed is the creation index), then sorted by t0.
  const draft: FleetShot[] = [];
  const fire = (shooter: FleetShip, target: FleetShip, t0: number, t1: number, hit: boolean) => {
    draft.push({
      t0,
      t1,
      from: shooter.id,
      to: target.id,
      side: shooter.side,
      kind: sides[shooter.side].arm,
      hit,
      seed: hashText(`${plan.id} ${draft.length}`),
    });
  };
  if (!empty) {
    // A shot for each hit taken, from a living enemy at that moment.
    for (const target of built) {
      target.hits.forEach((h, hi) => {
        const enemies = built.filter((e) => e.side !== target.side && living(e, h - 1));
        if (enemies.length === 0) return;
        const shooter = enemies[Math.floor(unit(target.seed, 40 + hi) * enemies.length)];
        if (!shooter) return;
        if (sides[shooter.side].arm === "beam") {
          fire(shooter, target, h - 0.25, h + 0.1, true);
        } else {
          const flight = 1.4 + unit(target.seed, 60 + hi) * 0.8;
          fire(shooter, target, h - flight, h, true);
        }
      });
    }
    // Filler fire from each ship while it is in the fight, up to 700 shots in all.
    for (const s of built) {
      const cadence = s.platform ? 2.8 : CADENCE[s.cls];
      const limit = Math.min(fightEnd, s.breakAt ?? Infinity, s.fleeAt ?? Infinity);
      let n = 0;
      for (
        let t = ARRIVE - 1 + unit(s.seed, 70) * cadence;
        t < limit && draft.length < 700;
        t += cadence * (0.8 + unit(s.seed, 100 + n) * 0.5)
      ) {
        const enemies = built.filter((e) => e.side !== s.side && living(e, t));
        const target = enemies[Math.floor(unit(s.seed, 200 + n) * enemies.length)];
        if (!target) continue;
        const t1 =
          sides[s.side].arm === "beam"
            ? t + (s.cls === 0 ? 0.6 : 0.35)
            : t + 1.6 + unit(s.seed, 300 + n) * 0.8;
        fire(s, target, t, t1, false);
        n++;
      }
    }
  }
  const indexed = draft.map((shot, i) => ({ shot, i }));
  indexed.sort((a, b) => a.shot.t0 - b.shot.t0 || a.i - b.i);

  return {
    id: plan.id,
    ships: built,
    shots: indexed.map((x) => x.shot),
    counts,
    lost,
    winner,
    arrive: ARRIVE,
    fightEnd,
    routEnd,
    end,
    landers: plan.landing ? 4 : 0,
    empty,
  };
}

// Where a ship is at time t (its break freezes it).
function posOf(s: FleetShip, t: number): V3 {
  const T = timeOf(s, t);
  const k = clamp01((T - s.delay) / (ARRIVE - s.delay));
  const ease = 1 - Math.pow(1 - k, 3);
  let x = lerp(s.from.x, s.slot.x, ease);
  let y = lerp(s.from.y, s.slot.y, ease);
  let z = lerp(s.from.z, s.slot.z, ease);
  if (!s.platform && T > ARRIVE) {
    const w = clamp01((T - ARRIVE) / 2);
    const amp = AMP[s.cls];
    x += amp * w * Math.sin(T * 0.6 + unit(s.seed, 33) * 6.283);
    y += amp * 0.7 * w * Math.sin(T * 0.43 + unit(s.seed, 34) * 6.283);
    z += amp * w * Math.sin(T * 0.37 + unit(s.seed, 35) * 6.283);
    if (s.cls === 2) y += (s.side === 0 ? -1 : 1) * 0.05 * clamp01((T - ARRIVE) / 8);
  }
  if (s.fleeAt !== null && T > s.fleeAt) {
    const r = T - s.fleeAt;
    if (s.side === 0) {
      y += 0.02 * r * r;
      x += (unit(s.seed, 36) < 0.5 ? -1 : 1) * 0.006 * r * r;
    } else {
      y -= 0.012 * r * r;
      z -= 0.03 * r * r;
    }
  }
  return { x, y, z };
}

// Which way a ship points at time t.
function forwardOf(s: FleetShip, t: number): V3 {
  const T = timeOf(s, t);
  if (T < ARRIVE) return s.platform ? { x: 0, y: 0, z: 1 } : norm(sub(s.slot, s.from));
  if (s.fleeAt !== null && T >= s.fleeAt) {
    return norm(s.side === 0 ? { x: 0, y: 1, z: 0 } : { x: 0, y: -0.5, z: -0.87 });
  }
  const aim: V3 = s.side === 0 ? { x: 0, y: -0.02, z: 0 } : { x: 0, y: 0.27, z: 0 };
  return norm(sub(aim, posOf(s, T)));
}

function shipNow(s: FleetShip, t: number): ShipNow {
  const T = timeOf(s, t);
  const k = clamp01((T - s.delay) / (ARRIVE - s.delay));
  const fled = s.fleeAt !== null && T >= s.fleeAt;
  let engine: number;
  if (s.platform) engine = 0;
  else if (T < ARRIVE) engine = k > 0.85 ? 0.45 : 1;
  else if (fled) engine = 1;
  else engine = 0.35 + 0.15 * Math.sin(T * 3 + unit(s.seed, 38) * 6.283);
  const state: ShipNow["state"] = T < ARRIVE ? "sailing" : fled ? "fleeing" : "fighting";
  const hitsSoFar = s.hits.filter((h) => h <= t).length;
  return {
    id: s.id,
    side: s.side,
    cls: s.cls,
    lander: false,
    state,
    p: posOf(s, t),
    f: forwardOf(s, t),
    roll: s.platform ? T * 0.2 : (unit(s.seed, 37) - 0.5) * 0.5,
    length: s.length,
    engine,
    burning: hitsSoFar >= 2,
  };
}

export function fleetAt(script: FleetScript, t: number): FleetNow {
  const now = clampRange(t, 0, script.end);
  const stage: FleetStage =
    now < script.arrive
      ? "arrive"
      : now < script.fightEnd
        ? "fight"
        : now < script.routEnd
          ? "rout"
          : "after";

  // Ships still in the field, and the count of each side.
  const ships: ShipNow[] = [];
  const left: [number, number] = [0, 0];
  for (const s of script.ships) {
    if (brokenAt(s, now)) continue;
    if (s.fleeAt !== null && now - s.fleeAt >= GONE_AFTER) continue;
    ships.push(shipNow(s, now));
    left[s.side] = left[s.side] + 1;
  }

  // The landers of a raid that came down, one after another.
  for (let j = 0; j < script.landers; j++) {
    const t0 = script.fightEnd + 2 + j * 0.9;
    const k = (now - t0) / 5.5;
    if (k < 0 || k >= 1) continue;
    const kk = k * k;
    const fromX = (j - 1.5) * 0.05;
    const toX = (j - 1.5) * 0.03;
    const z = 0.02 * j;
    ships.push({
      id: script.ships.length + j,
      side: 0,
      cls: 2,
      lander: true,
      state: "sailing",
      p: { x: lerp(fromX, toX, kk), y: lerp(0.38, -0.2, kk), z },
      f: { x: 0, y: -1, z: 0 },
      roll: 0,
      length: 0.03 * (k < 0.85 ? 1 : (1 - k) / 0.15),
      engine: 1,
      burning: false,
    });
  }

  // Wrecks: each broken ship falls apart into two halves.
  const wrecks: WreckNow[] = [];
  for (const s of script.ships) {
    if (s.breakAt === null || now < s.breakAt) continue;
    const r = now - s.breakAt;
    const q = posOf(s, s.breakAt);
    const f0 = forwardOf(s, s.breakAt);
    for (const part of [0, 1] as const) {
      const rate = (unit(s.seed, 50 + part) - 0.5) * 1.2;
      const sign = part === 0 ? 1 : -1;
      const off = s.length * 0.18 * sign * (1 + r * 0.05);
      const p: V3 = {
        x: q.x + s.drift.x * r * (1 + 0.4 * sign) + f0.x * off,
        y: q.y + s.drift.y * r * (1 + 0.4 * sign) + f0.y * off,
        z: q.z + s.drift.z * r * (1 + 0.4 * sign) + f0.z * off,
      };
      const turn = rate * r;
      const turned: V3 = {
        x: f0.x * Math.cos(turn) + f0.z * Math.sin(turn),
        y: f0.y * Math.cos(rate * r * 0.7),
        z: -f0.x * Math.sin(turn) + f0.z * Math.cos(turn),
      };
      wrecks.push({
        id: s.id,
        side: s.side,
        part,
        p,
        f: norm(turned),
        roll: rate * r * 1.3,
        length: s.length,
      });
    }
  }

  // Beams: a beam from a ship that is not broken, to its target. 48 a side at most.
  const beams: BeamNow[] = [];
  const beamCount: [number, number] = [0, 0];
  for (const sh of script.shots) {
    if (sh.kind !== "beam" || now < sh.t0 || now > sh.t1) continue;
    const shooter = script.ships[sh.from];
    const target = script.ships[sh.to];
    if (!shooter || !target || brokenAt(shooter, now)) continue;
    if (beamCount[sh.side] >= 48) continue;
    const f = forwardOf(shooter, now);
    const muzzle = posOf(shooter, now);
    const a: V3 = add(muzzle, scale(f, shooter.length * 0.4));
    let b = posOf(target, now);
    if (!sh.hit) {
      b = {
        x: b.x + (unit(sh.seed, 1) - 0.5) * 0.05,
        y: b.y,
        z: b.z + (unit(sh.seed, 2) - 0.5) * 0.05,
      };
    }
    beams.push({ side: sh.side, a, b, width: shooter.cls === 0 ? 0.0042 : 0.0026 });
    beamCount[sh.side] = beamCount[sh.side] + 1;
  }

  // Missiles: in flight from the launch to the target. 48 a side at most.
  const missiles: MissileNow[] = [];
  const missileCount: [number, number] = [0, 0];
  for (const sh of script.shots) {
    if (sh.kind !== "missile" || now < sh.t0 || now >= sh.t1) continue;
    const shooter = script.ships[sh.from];
    const target = script.ships[sh.to];
    if (!shooter || !target) continue;
    if (missileCount[sh.side] >= 48) continue;
    const k = (now - sh.t0) / (sh.t1 - sh.t0);
    const from = posOf(shooter, sh.t0);
    let to = posOf(target, sh.t1);
    if (!sh.hit) {
      to = {
        x: to.x + (unit(sh.seed, 1) - 0.5) * 0.05,
        y: to.y,
        z: to.z + (unit(sh.seed, 2) - 0.5) * 0.05,
      };
    }
    const p: V3 = {
      x: lerp(from.x, to.x, k) + Math.sin(k * Math.PI) * 0.06 * (unit(sh.seed, 3) - 0.5),
      y: lerp(from.y, to.y, k),
      z: lerp(from.z, to.z, k),
    };
    missiles.push({ side: sh.side, p, f: norm(sub(to, from)), trail: 0.03 + 0.03 * k });
    missileCount[sh.side] = missileCount[sh.side] + 1;
  }

  // Flashes: at a hit, and at a break. At most 64.
  const flashes: FlashNow[] = [];
  for (const s of script.ships) {
    for (const h of s.hits) {
      if (flashes.length >= 64) break;
      if (now - h >= 0 && now - h < 0.18) {
        flashes.push({ p: posOf(s, h), size: 0.018 + 0.1 * (now - h) });
      }
    }
    if (s.breakAt !== null && flashes.length < 64) {
      const r = now - s.breakAt;
      if (r >= 0 && r < 0.6) {
        flashes.push({
          p: posOf(s, s.breakAt),
          size: (0.03 + s.length * 0.55) * Math.sin(Math.PI * Math.min(1, (r + 0.08) / 0.68)),
        });
      }
    }
  }

  // Sparks from each break, eight apiece. At most 160.
  const sparks: SparkNow[] = [];
  for (const s of script.ships) {
    if (s.breakAt === null) continue;
    const r = now - s.breakAt;
    if (r < 0 || r >= 1.2) continue;
    const q = posOf(s, s.breakAt);
    for (let i = 0; i < 8 && sparks.length < 160; i++) {
      const a = unit(s.seed, 400 + i) * 6.283;
      const el = (unit(s.seed, 420 + i) - 0.5) * 2.4;
      const dir: V3 = {
        x: Math.cos(el) * Math.sin(a),
        y: Math.sin(el),
        z: Math.cos(el) * Math.cos(a),
      };
      const speed = 0.06 + unit(s.seed, 440 + i) * 0.08;
      sparks.push({
        p: add(q, scale(dir, speed * r)),
        f: dir,
        length: 0.008,
      });
    }
  }

  return { t: now, stage, ships, wrecks, beams, missiles, flashes, sparks, left };
}

export function fleetEye(script: FleetScript, t: number): FleetEye {
  const scale48 = script.end / 48;
  const now = clampRange(t, 0, script.end);
  let i = 0;
  while (i < EYE_KEYS.length - 2 && now >= (EYE_KEYS[i + 1] as EyeKey)[0] * scale48) i++;
  const k0 = EYE_KEYS[i] as EyeKey;
  const k1 = EYE_KEYS[i + 1] as EyeKey;
  const span = (k1[0] - k0[0]) * scale48;
  const k = smooth((now - k0[0] * scale48) / span);
  const a = lerp(k0[1], k1[1], k);
  const r = lerp(k0[2], k1[2], k);
  const ey = lerp(k0[3], k1[3], k);
  const ly = lerp(k0[4], k1[4], k);
  return {
    e: { x: Math.sin(a) * r, y: ey, z: Math.cos(a) * r },
    at: { x: 0, y: ly, z: 0 },
  };
}

/**
 * The eye behind a ship ridden (Phase 73): off its stern and above it, turned about it by `yaw` and `pitch`, looking where it looks, its
 * hull low in the shot and what it is flying at beyond. A pure function of the ship now. `up` is the shot's up, in the fight's frame.
 */
export function rideEye(s: ShipNow, yaw: number, pitch: number): FleetEye & { readonly up: V3 } {
  const f = norm(s.f),
    side = norm(cross(f, Math.abs(f.y) > 0.92 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 })),
    up = cross(side, f),
    far = s.length * 4.4,
    c = Math.cos(pitch),
    back = add(
      add(scale(f, -c * Math.cos(yaw)), scale(side, c * Math.sin(yaw))),
      scale(up, Math.sin(pitch)),
    );
  return {
    e: add(s.p, scale(back, far)),
    at: add(s.p, add(scale(f, s.length * 0.8), scale(up, s.length * 0.1))),
    up,
  };
}

export function fightWay(id: string): V3 {
  const h = hashText(id);
  const y = unit(h, 1) - 0.5;
  const a = unit(h, 2) * 6.283;
  const r = Math.sqrt(1 - y * y);
  return { x: r * Math.cos(a), y, z: r * Math.sin(a) };
}

export function fleetFrame(way: V3): FleetFrame {
  const y = norm(way);
  const ref: V3 = Math.abs(y.y) > 0.98 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const x = norm(cross(ref, y));
  const z = cross(x, y);
  return { o: scale(y, 1 + FLEET_ALT), x, y, z };
}

export function toWorld(frame: FleetFrame, p: V3): V3 {
  return add(frame.o, add(add(scale(frame.x, p.x), scale(frame.y, p.y)), scale(frame.z, p.z)));
}

/** Writes one model's 4x4 (column-major, world space) at m[o..]: columns are right, up, forward, position. */
export function poseMatrix(
  m: Float32Array,
  o: number,
  frame: FleetFrame,
  p: V3,
  f: V3,
  roll: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const P = toWorld(frame, p);
  const F = norm(add(add(scale(frame.x, f.x), scale(frame.y, f.y)), scale(frame.z, f.z)));
  const A = Math.abs(dot(F, frame.y)) > 0.95 ? frame.z : frame.y;
  const R = norm(cross(A, F));
  const U = cross(F, R);
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const R2 = add(scale(R, c), scale(U, s));
  const U2 = add(scale(U, c), scale(R, -s));
  m[o] = R2.x * sx;
  m[o + 1] = R2.y * sx;
  m[o + 2] = R2.z * sx;
  m[o + 3] = 0;
  m[o + 4] = U2.x * sy;
  m[o + 5] = U2.y * sy;
  m[o + 6] = U2.z * sy;
  m[o + 7] = 0;
  m[o + 8] = F.x * sz;
  m[o + 9] = F.y * sz;
  m[o + 10] = F.z * sz;
  m[o + 11] = 0;
  m[o + 12] = P.x;
  m[o + 13] = P.y;
  m[o + 14] = P.z;
  m[o + 15] = 1;
}

export const TOWN_FRAME: FleetFrame = {
  o: { x: 0, y: 0, z: 0 },
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

/** The share of the ships whose centre is inside the frame from the eye (vertical field 45 degrees). */
export function shipsInView(script: FleetScript, t: number, aspect = 430 / 932): number {
  const ships = fleetAt(script, t).ships;
  if (ships.length === 0) return 0;
  const eye = fleetEye(script, t);
  const fwd = norm(sub(eye.at, eye.e));
  const right = norm(cross(fwd, { x: 0, y: 1, z: 0 }));
  const up = cross(right, fwd);
  const tanHalf = Math.tan((22.5 * Math.PI) / 180);
  let inside = 0;
  for (const s of ships) {
    const v = sub(s.p, eye.e);
    const d = dot(v, fwd);
    if (d <= 0) continue;
    const nx = dot(v, right) / (d * tanHalf * aspect);
    const ny = dot(v, up) / (d * tanHalf);
    if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1) inside++;
  }
  return inside / ships.length;
}

/** How many screen pixels long a ship of this length is at this distance, in a frame this wide. */
export function shipPixels(
  length: number,
  distance: number,
  width = 430,
  aspect = 430 / 932,
): number {
  return (length / (2 * distance * Math.tan((22.5 * Math.PI) / 180) * aspect)) * width;
}

function fleetSentence(plan: StarFightPlan, script: FleetScript, t: number): string {
  const A = plan.attacker;
  const D = plan.defender;
  const now = clampRange(t, 0, script.end);
  const n = (x: number) => x.toFixed(1);
  const arm = (side: FightSide) => (side.arm === "beam" ? "beams" : "missiles");
  if (now < 3.5) return plan.why;
  if (now < script.arrive) {
    return `${A.name}, ${A.words}, come ${plan.place.words}: strength ${n(A.strength)} against ${n(D.strength)}.`;
  }
  if (script.empty) return `No ship rises to meet them. ${plan.claim}.`;
  if (now < script.fightEnd) {
    const left = fleetAt(script, now).left;
    return `${A.name} fire ${arm(A)}; ${D.name} answer with ${arm(D)}. ${left[0]} and ${left[1]} ships still fight.`;
  }
  if (now < script.routEnd) return `${plan.won ? D.name : A.name} break and run.`;
  if (plan.landing) return `${plan.claim}. Their landers go down.`;
  const tail = plan.won
    ? "The record carries it no further: nothing on the ground changed hands."
    : plan.road === "starwar"
      ? "The fleet is gone and nothing changed."
      : "None came down.";
  return `${plan.claim}. ${tail}`;
}

export function fleetWords(plan: StarFightPlan, script: FleetScript, t: number): string {
  const sentence = fleetSentence(plan, script, t);
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function fleetTally(plan: StarFightPlan, script: FleetScript): string {
  const A = plan.attacker;
  const D = plan.defender;
  const n = (x: number) => x.toFixed(1);
  const [n0, n1] = script.counts;
  const rest =
    A.machines !== null
      ? `History counts ${A.name}'s fleet as ${A.machines.toLocaleString("en")} machines, strength ${n(A.strength)}, not in hulls.`
      : `History gives each side a strength, ${n(A.strength)} and ${n(D.strength)}, not a count of hulls.`;
  return `${n0} and ${n1} ships drawn. ${rest}`;
}

export function starFightTake(
  d: { readonly told: Set<string>; readonly round: number; starred?: number },
  list: StarFightList,
  year: number,
): { readonly id: string; readonly year: number; readonly words: string } | null {
  const first = list.first;
  const firstYear = list.firstYear;
  if (first && firstYear !== null && year - firstYear <= 5 && !d.told.has(`starfight:${first}`)) {
    d.told.add(`starfight:${first}`);
    d.starred = d.round;
    return {
      id: first,
      year: firstYear,
      words: `🌌 The first war among the stars, year ${firstYear}`,
    };
  }
  if (d.round - (d.starred ?? -99) >= 5) {
    const row = list.fights.find(
      (r) => year - r.year <= 5 && r.ships && !d.told.has(`starfight:${r.id}`),
    );
    if (row) {
      d.told.add(`starfight:${row.id}`);
      d.starred = d.round;
      return {
        id: row.id,
        year: row.year,
        words: `🌌 ${row.attacker} against ${row.defender}, year ${row.year}`,
      };
    }
  }
  return null;
}
