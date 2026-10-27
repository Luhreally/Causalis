// The battle fought in place (Phase 55 M227, D1, asked for 2026-10-25: "the battles should be fought
// on the land, by the townsfolk, where you can see them"): a land's battle at the turn fought
// soldier by soldier on the field before its heart town, in the town's own scene and on the world's
// clock — the field (view/battle.ts, `placed`) laid along the town's road on the attackers' side,
// its figures drawn as large as the town's folk, every one of them a man of the battle's roll; the
// town indoors while it is fought but for those come out to watch at its edge; the hosts' fires the
// night before; the fallen borne in two days on. Pure: where the field lies, who each figure is.
import { woundStage, type BattleRoll, type RollEntry, type VillagePlan } from "../bridge/index.ts";
import { FIELD, placeAt, type BattleField, type BattleNow } from "./battle.ts";
import { battleSpan } from "./battleday.ts";
import type { Blows } from "./blows.ts";
import { villageGround } from "./ground.ts";

/** Each fate's lot of a side's roll: its fallen, its maimed, its wounded, the rest. */
const LOTS: Readonly<Record<FigureFate, 0 | 1 | 2 | 3>> = {
  fell: 0,
  maimed: 1,
  wounded: 2,
  stood: 3,
};
/** How much larger than the close field's a battle fought in place is laid: its figures as large as the town's folk. */
export const PLACED_SCALE = 2;
/** The most figures a side of a battle fought in place is drawn as, by the setting's detail (a phone draws fewer). */
export const PLACED_MOST = [60, 120, 240, 360] as const;
/** How many of the town come out to its edge to watch the battle fought before it. */
export const WATCHERS = 24;
/** Open ground between the town's edge and the defenders' rear rank (m). */
const CLEAR = 12;

/** The most figures a side is drawn as at a detail (0 … 3). */
export function placedMost(detail: number): number {
  return PLACED_MOST[Math.max(0, Math.min(3, Math.round(detail)))]!;
}

/**
 * Where a battle's field lies in a town's ground (metres): its middle, the way its +x runs (toward
 * the town: the defenders' side), and how much larger it is laid than the close field.
 */
export type PlacedFrame = {
  readonly x: number;
  readonly z: number;
  readonly ux: number;
  readonly uz: number;
  readonly scale: number;
};

/**
 * A battle's field laid before a town: out along its road on the attackers' side, the defenders'
 * rear rank (as they are drawn up) so far short of the town's edge. (At a seat, its walls on the
 * field's line stand as outworks before the town's own.)
 */
export function fieldFrame(plan: VillagePlan, field: BattleField): PlacedFrame {
  const ground = villageGround(plan),
    way = Math.atan2(plan.road.z, plan.road.x),
    ox = Math.cos(way),
    oz = Math.sin(way);
  let rear = field.meet + 1;
  for (const t of field.troopers) if (t.side === 1) rear = Math.max(rear, placeAt(field, t, 0).x);
  const out = ground.homesReach + CLEAR + PLACED_SCALE * rear;
  return { x: ox * out, z: oz * out, ux: -ox, uz: -oz, scale: PLACED_SCALE };
}

/** A point of the field (its metres) in the town's ground (metres). */
export function placedPoint(frame: PlacedFrame, x: number, z: number): { x: number; z: number } {
  const k = frame.scale;
  return {
    x: frame.x + k * (x * frame.ux - z * frame.uz),
    z: frame.z + k * (x * frame.uz + z * frame.ux),
  };
}

/** A point of the town's ground (metres) on the field (its metres). */
export function fieldPoint(frame: PlacedFrame, x: number, z: number): { x: number; z: number } {
  const dx = (x - frame.x) / frame.scale,
    dz = (z - frame.z) / frame.scale;
  return { x: dx * frame.ux + dz * frame.uz, z: -dx * frame.uz + dz * frame.ux };
}

/** How far the field is turned in the town (radians about the up axis, as a scene's entity is turned). */
export function frameYaw(frame: PlacedFrame): number {
  return Math.atan2(-frame.uz, frame.ux);
}

/** How a figure came out of a battle: fell, maimed, wounded and lived, or came through unhurt. */
export type FigureFate = "fell" | "maimed" | "wounded" | "stood";

/** How a figure (its id) came out of a battle, as its blows have it (the lot its roll names it from). */
export function figureFate(field: BattleField, blows: Blows, id: number): FigureFate {
  if (field.troopers[id]?.falls !== null) return "fell";
  const k = blows.of[id] ?? -1,
    hit = k >= 0 ? blows.hits[k]! : null;
  if (!hit || hit.back === null) return "stood";
  return hit.lost !== null || hit.shattered ? "maimed" : "wounded";
}

/** A figure's fate, told on its card. */
export const FATE_WORDS: Readonly<Record<FigureFate, string>> = {
  fell: "Fell in the battle",
  maimed: "Maimed, and lived",
  wounded: "Wounded, and lived",
  stood: "Came through it unhurt",
};

/**
 * Who each figure of a battle is, by its id (null: none of the roll left for it): its fallen the
 * roll's fallen, its struck who lived the roll's wounded (the maimed among them the roll's maimed,
 * where there are as many), the rest the rest — each lot dealt out across the line file by file, so
 * the men of a place stand together.
 */
export function rollNames(
  field: BattleField,
  blows: Blows,
  roll: BattleRoll,
): readonly (RollEntry | null)[] {
  const out: (RollEntry | null)[] = field.troopers.map(() => null);
  for (const side of [0, 1] as const) {
    const s = side === 0 ? roll.attacker : roll.defender,
      line = field.troopers
        .filter((t) => t.side === side)
        .sort((a, b) => a.file - b.file || a.rank - b.rank || a.id - b.id),
      lot = (t: (typeof line)[number]): 0 | 1 | 2 | 3 => LOTS[figureFate(field, blows, t.id)],
      // (The roll's wounded, the maimed first for the struck maimed; each lot used in order.)
      lots: RollEntry[][] = [
        [...s.fell],
        s.hurt.filter((e) => e.maimed),
        s.hurt.filter((e) => !e.maimed),
        [...s.stood],
      ];
    for (const t of line) {
      const k = lot(t),
        // (A maimed one with none of the roll's maimed left takes another wounded man, and so on.)
        from = k === 1 ? [1, 2] : k === 2 ? [2, 1] : [k];
      for (const f of from) {
        const e = lots[f]!.shift();
        if (e) {
          out[t.id] = e;
          break;
        }
      }
    }
  }
  return out;
}

/** When a town keeps indoors for the battle at a turn: from an hour before it begins until half an hour after it ends (world seconds). */
export function battleShelter(turn: number): { readonly from: number; readonly to: number } {
  const { from, to } = battleSpan(turn);
  return { from: from - 3600, to: to + 1800 };
}

/** One of the town come out to watch the battle before it: who (their index), where (metres), which way (radians). */
export type Watcher = {
  readonly index: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
};

/**
 * Those of the town come out to its edge to watch the battle fought before it, the nearest homes'
 * first: grown, at home that day (not away with the levy, not abed with a wound, not gone), stood
 * in two rows facing the field.
 */
export function fieldWatchers(
  plan: VillagePlan,
  frame: PlacedFrame,
  t: number,
  most = WATCHERS,
): readonly Watcher[] {
  const ground = villageGround(plan),
    ox = -frame.ux,
    oz = -frame.uz,
    toward = (i: number) => {
      const h = plan.homes[plan.people[i]!.home];
      return h ? h.x * ox + h.z * oz : -Infinity;
    },
    can = plan.people
      .map((p, i) => ({ p, i }))
      .filter(
        ({ p }) =>
          !p.child &&
          !p.healer &&
          (p.gone === undefined || p.gone > t) &&
          !(p.away ?? []).some((a) => a.from <= t && t < a.until) &&
          !(p.wounds ?? []).some((w) => {
            const at = woundStage(w, t);
            return at === "away" || at === "abed";
          }),
      )
      .sort((a, b) => toward(b.i) - toward(a.i) || a.i - b.i)
      .slice(0, most),
    out = ground.homesReach + 3,
    yaw = Math.atan2(ox, oz);
  return can.map(({ i }, j) => {
    const row = j % 2,
      across = (Math.floor(j / 2) - (Math.ceil(can.length / 2) - 1) / 2) * 2.6 + row * 1.3,
      d = out + row * 1.8;
    return { index: i, x: ox * d - oz * across, z: oz * d + ox * across, yaw };
  });
}

/**
 * The hosts' fires the night before a battle fought in place (metres): a line behind each host's
 * rear rank as they are drawn up, so many across the field.
 */
export function placedCamp(
  frame: PlacedFrame,
  field: BattleField,
): readonly { readonly x: number; readonly z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (const side of [0, 1] as const) {
    let rear = side === 0 ? Infinity : -Infinity,
      lo = Infinity,
      hi = -Infinity;
    for (const t of field.troopers) {
      if (t.side !== side) continue;
      const p = placeAt(field, t, 0);
      rear = side === 0 ? Math.min(rear, p.x) : Math.max(rear, p.x);
      lo = Math.min(lo, p.z);
      hi = Math.max(hi, p.z);
    }
    if (!Number.isFinite(rear)) continue;
    const x = side === 0 ? Math.max(-FIELD.x + 4, rear - 7) : rear + 4,
      n = Math.max(2, Math.min(8, Math.round((hi - lo) / 12) + 1));
    for (let k = 0; k < n; k++)
      out.push(placedPoint(frame, x, n > 1 ? lo + ((hi - lo) * k) / (n - 1) : (lo + hi) / 2));
  }
  return out;
}

/**
 * The battle with its fallen borne in (`share` of them, a keyed few at a time; 0 … 1): they and
 * what was cut off them no longer on the field, their blood where they lay.
 */
export function borneNow(field: BattleField, now: BattleNow, share: number): BattleNow {
  if (share <= 0) return now;
  const gone = (id: number) => share >= 1 || ((id * 2654435761) >>> 0) / 4294967296 < share,
    borne = new Set(
      now.troopers
        .filter((t) => field.troopers[t.id]!.falls !== null && gone(t.id))
        .map((t) => t.id),
    );
  if (!borne.size) return now;
  return {
    ...now,
    troopers: now.troopers.map((t) => (borne.has(t.id) ? { ...t, size: 0 } : t)),
    ...(now.limbs ? { limbs: now.limbs.filter((l) => !borne.has(l.id)) } : {}),
    ...(now.wounds ? { wounds: now.wounds.filter((w) => !borne.has(w.id)) } : {}),
    ...(now.stuck ? { stuck: now.stuck.filter((w) => !borne.has(w.id)) } : {}),
  };
}

/**
 * The battle once it is over, before a town: its fallen lying where they fell, in their blood, with
 * what was cut off them and the wrecks; its living gone from the field (the victors drawn by the
 * town's war as they hold the field, the beaten in flight, the wounded taken in).
 */
export function fallenNow(field: BattleField, now: BattleNow): BattleNow {
  const lying = new Set(
    now.troopers.filter((t) => field.troopers[t.id]!.falls !== null).map((t) => t.id),
  );
  return {
    ...now,
    troopers: now.troopers.map((t) => (lying.has(t.id) ? t : { ...t, size: 0 })),
    flying: [],
    spray: [],
    smoke: [],
    flashes: [],
    cannon: [],
    dust: [],
    ...(now.vehicles ? { vehicles: now.vehicles.filter((v) => v.knocked > 0.5) } : {}),
    ...(now.wounds ? { wounds: now.wounds.filter((w) => lying.has(w.id)) } : {}),
    ...(now.stuck ? { stuck: now.stuck.filter((w) => lying.has(w.id)) } : {}),
    ...(now.limbs ? { limbs: now.limbs.filter((l) => lying.has(l.id)) } : {}),
  };
}
