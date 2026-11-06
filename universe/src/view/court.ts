// A town's court, placed and shaped (J1): where its place stands on the rim of the square, clear of what the town raised; the low parts it is made of, as who
// judges there has it; and each person's part on a day it sits or a sentence runs. Pure: the same plan, the same court, the same day. On its day those who judge
// stand at its bench, the one brought stands before them, some of the town come to watch, and what comes of it is carried out where it can be seen: a fine paid at
// the bench, a day in the stocks or a cell at its side, one walked out along the road, one at the works. A hive has no bench: one stands alone and the rest turn away.
import type { CourtSentence, CourtSitting, VillagePlan } from "../bridge/index.ts";
import { SQUARE } from "../bridge/index.ts";
import { hashText, unitOf } from "./draws.ts";
import { FEAST, clearOfHall, marketScene, squareScale } from "./feast.ts";
import { clearAt, villageGround } from "./ground.ts";
import { memorialsPlaced, type MemorialPart } from "./memorial.ts";

const DAY = 86_400;
/** When it sits, in hours of its day: those who watch come first; what comes of it follows. */
export const COURT_HOURS = { gather: 8.5, open: 9, close: 14 } as const;
/** The most who stand to watch. */
const MOST_WATCHING = 36;

export type CourtPlaced = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly scale: number;
  /** How high it stands, and how far it reaches to each side along its front (metres), for a finger. */
  readonly high: number;
  readonly wide: number;
};

const PLACED = new WeakMap<VillagePlan, CourtPlaced | null>();

/** How much higher a city raises it: to stand among its towers. */
function cityScale(plan: VillagePlan): number {
  let level = 0;
  for (const r of plan.town?.runs ?? []) if (r[0]! <= 1) level = Math.max(level, r[5] ?? 0);
  return level >= 4 ? 1.5 : level >= 3 ? 1.25 : 1;
}

/** Half its width along its front, before its town's scale. */
const REACH = 12;

/** Where a town's court stands (null: it has none): the rim slot nearest the road that is clear of its stones, stalls and hall; the clearest where none is. */
export function courtPlaced(plan: VillagePlan): CourtPlaced | null {
  const known = PLACED.get(plan);
  if (known !== undefined) return known;
  let out: CourtPlaced | null = null;
  if (plan.court) {
    const k = squareScale(plan),
      big = k * cityScale(plan),
      r = (SQUARE - 2.6) * k,
      ground = villageGround(plan),
      stones = memorialsPlaced(plan),
      stalls = marketScene(plan).stalls,
      rimStep = (2 * Math.PI) / FEAST.poles,
      road = Math.atan2(plan.road.z, plan.road.x),
      wide = REACH * big * 0.82;
    let best: { a: number; room: number } | null = null;
    for (let i = 0; i < FEAST.poles * 2; i++) {
      const a = i * (rimStep / 2) + rimStep / 4,
        x = r * Math.cos(a),
        z = r * Math.sin(a);
      if (!clearOfHall(plan, x, z, Math.min(4, wide * 0.3))) continue;
      let room = Infinity;
      for (const s of stones)
        room = Math.min(room, Math.hypot(s.x - x, s.z - z) - s.wide - wide * 0.6);
      for (const q of stalls)
        room = Math.min(room, Math.hypot(q.x - x, q.z - z) - 4 * k - wide * 0.3);
      const clear = clearAt(ground, { x, z }, Math.min(4, wide * 0.3)) ? 0 : -6,
        off = Math.abs(Math.atan2(Math.sin(a - road), Math.cos(a - road))),
        // (Across from the road in is where a person coming in looks.)
        score = Math.min(room, 6) + clear - Math.abs(off - Math.PI) * 0.4;
      if (!best || score > best.room) best = { a, room: score };
    }
    const a = best?.a ?? road + Math.PI,
      x = r * Math.cos(a),
      z = r * Math.sin(a);
    out = {
      x,
      z,
      yaw: Math.atan2(-x, -z),
      scale: big * 0.82,
      high: 13 * big * 0.82,
      wide,
    };
  }
  PLACED.set(plan, out);
  return out;
}

/** A place in a court's own terms: `u` along its front, `v` out from it toward the square's middle (metres, before its scale). */
export function courtSpot(p: CourtPlaced, u: number, v: number): { x: number; z: number } {
  const c = Math.cos(p.yaw),
    s = Math.sin(p.yaw);
  return { x: p.x + (c * u + s * v) * p.scale, z: p.z + (-s * u + c * v) * p.scale };
}

const box = (
  tone: MemorialPart["tone"],
  u: number,
  y: number,
  v: number,
  sx: number,
  sy: number,
  sz: number,
  more: Partial<MemorialPart> = {},
): MemorialPart => ({ mesh: "box", tone, u, y, v, sx, sy, sz, ...more });
const cyl = (
  tone: MemorialPart["tone"],
  u: number,
  y: number,
  v: number,
  sx: number,
  sy: number,
  sz: number,
): MemorialPart => ({ mesh: "cyl", tone, u, y, v, sx, sy, sz });
const cone = (
  tone: MemorialPart["tone"],
  u: number,
  y: number,
  v: number,
  sx: number,
  sy: number,
  sz: number,
): MemorialPart => ({ mesh: "cone", tone, u, y, v, sx, sy, sz });

/** Where the stocks stand, or the post; where the cell or the pen. */
const STOCKS = { u: -9.5, v: 3 } as const,
  CELL = { u: 9.5, v: 0 } as const,
  DOCK_V = 9;

/** The most parts a town's court is made of. */
export const MOST_COURT_PARTS = 26;

/** Its parts, by who judges there ("main" its stone, "dark" its wood; a cell only where a people builds one). */
export function courtParts(plan: VillagePlan): readonly MemorialPart[] {
  const c = plan.court;
  if (!c) return [];
  const parts: MemorialPart[] = [];
  switch (c.form) {
    case "hive":
      // (A low mound of the town's own making, and nothing on it.)
      parts.push(cone("main", 0, 2.4, 0, 16, 4.8, 16), cyl("dark", 0, 0.22, DOCK_V - 2, 7, 0.3, 7));
      return parts;
    case "reef":
      // (The post they meet at, and the ring of shell about it.)
      parts.push(
        cyl("main", STOCKS.u, 4.5, STOCKS.v, 2.2, 9, 2.2),
        cone("dark", STOCKS.u, 9.8, STOCKS.v, 3, 2, 3),
        cyl("dark", 0, 0.3, 0, 12, 0.5, 12),
      );
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 2 * Math.PI;
        parts.push(cone("main", Math.cos(a) * 5, 1.6, Math.sin(a) * 5, 2.2, 3.2, 2.2));
      }
      return parts;
    case "elders":
      // (A ring of seats of the land's stone, and nothing written.)
      parts.push(cyl("dark", 0, 0.2, 2.5, 13, 0.25, 13));
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + (i / 5) * Math.PI;
        parts.push(box("main", Math.cos(a) * 6, 1, 2.5 + Math.sin(a) * 6, 2.6, 2, 2.2, { yaw: a }));
      }
      break;
    default: {
      // (A bench on a low floor, a board behind it, and a rail before it; a pole for its flag.)
      parts.push(
        box("main", 0, 0.45, 0, 13, 0.9, 6),
        box("dark", 0, 2.5, 1.4, 11, 0.5, 2.4),
        box("dark", -4.6, 1.6, 1.4, 0.6, 1.6, 2),
        box("dark", 4.6, 1.6, 1.4, 0.6, 1.6, 2),
        box("dark", 0, 6, -2.4, 12, 11, 0.6),
        box("main", 0, 11.9, -2.4, 13, 0.8, 1),
        cyl("dark", -6.4, 7, -2.4, 0.5, 14, 0.5),
        box("dark", 0, 1.9, DOCK_V, 4.4, 0.32, 0.32),
        box("dark", -2.1, 1, DOCK_V, 0.34, 1.9, 0.34),
        box("dark", 2.1, 1, DOCK_V, 0.34, 1.9, 0.34),
      );
    }
  }
  // What it holds them in: stocks and a cell, or a pen of stones for those who cannot make either.
  if (c.grips) {
    if (c.form !== "elders")
      parts.push(
        box("dark", STOCKS.u, 0.2, STOCKS.v, 5.4, 0.4, 2),
        box("dark", STOCKS.u - 2.2, 1.9, STOCKS.v, 0.6, 3.4, 0.6),
        box("dark", STOCKS.u + 2.2, 1.9, STOCKS.v, 0.6, 3.4, 0.6),
        box("dark", STOCKS.u, 3.2, STOCKS.v, 5.2, 0.9, 0.6),
      );
    if (c.form === "magistrate" || c.form === "bench") {
      const w = 6.4,
        h = 8.4;
      parts.push(
        box("main", CELL.u, 0.2, CELL.v, w + 1, 0.4, w + 1),
        box("main", CELL.u, h, CELL.v, w + 1.4, 0.6, w + 1.4),
        box("main", CELL.u, h / 2, CELL.v - w / 2, w, h, 0.5),
        box("dark", CELL.u - w / 2, h / 2, CELL.v, 0.5, h, w),
        box("dark", CELL.u + w / 2, h / 2, CELL.v, 0.5, h, w),
      );
      for (let i = 0; i < 4; i++)
        parts.push(
          box("dark", CELL.u - w / 2 + ((i + 0.5) * w) / 4, h / 2, CELL.v + w / 2, 0.3, h, 0.3),
        );
    }
  } else if (c.form === "magistrate" || c.form === "bench" || c.form === "kin") {
    // (A people who cannot grip: a pit's rim of heaped stone.)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 2 * Math.PI;
      parts.push(
        cone("main", CELL.u + Math.cos(a) * 4, 1.3, CELL.v + Math.sin(a) * 4, 2.8, 2.6, 2.8),
      );
    }
  }
  return parts;
}

/** A part at its place in a town (metres), as a thing raised. */
export function courtPartAt(p: CourtPlaced, q: MemorialPart) {
  const c = Math.cos(p.yaw),
    s = Math.sin(p.yaw),
    u = q.u * p.scale,
    v = q.v * p.scale;
  return {
    x: p.x + c * u + s * v,
    y: q.y * p.scale,
    z: p.z - s * u + c * v,
    sx: q.sx * p.scale,
    sy: q.sy * p.scale,
    sz: q.sz * p.scale,
    yaw: p.yaw + (q.yaw ?? 0),
    tip: q.tip ?? 0,
  };
}

const HEARD = new WeakMap<VillagePlan, Map<number, CourtSitting>>();
/** The sittings by their day (the morning: a feast gathers late, and a market's stalls stand clear of it). */
function heardMap(plan: VillagePlan): Map<number, CourtSitting> {
  let m = HEARD.get(plan);
  if (m) return m;
  m = new Map();
  for (const s of plan.court?.sittings ?? []) m.set(s.day, s);
  HEARD.set(plan, m);
  return m;
}

/** The sitting of a day (null: none sits). */
export function sittingOn(plan: VillagePlan, day: number): CourtSitting | null {
  return heardMap(plan).get(day) ?? null;
}

/** Whether it is sitting at moment t: the flag up, those brought before it standing. */
export function courtSitting(plan: VillagePlan, t: number): CourtSitting | null {
  const day = Math.floor(t / DAY),
    hour = (t - day * DAY) / 3600;
  return hour >= COURT_HOURS.gather && hour < COURT_HOURS.close ? sittingOn(plan, day) : null;
}

/** The case a press on the court opens at moment t: what sits now, or the sentence seen now, or the last heard (null: none yet). */
export function courtCaseAt(plan: VillagePlan, t: number): string | null {
  const now = courtSitting(plan, t);
  if (now) return now.ref;
  const day = Math.floor(t / DAY);
  let last: string | null = null,
    lastDay = -Infinity;
  for (const [d, s] of heardMap(plan))
    if (d <= day && d > lastDay) {
      last = s.ref;
      lastDay = d;
    }
  return last;
}

/** A person's part in the court's day. */
export type CourtRole =
  | {
      readonly kind: "accused";
      readonly at: { x: number; z: number };
      readonly face: number;
      readonly then: CourtSentence;
      readonly thenAt: { x: number; z: number } | null;
      readonly thenFace: number | null;
      readonly why: string;
    }
  | {
      readonly kind: "judge" | "watch";
      readonly at: { x: number; z: number };
      readonly face: number;
      readonly why: string;
    }
  | {
      readonly kind: "held";
      readonly at: { x: number; z: number };
      readonly face: number;
      readonly why: string;
    }
  | { readonly kind: "labour"; readonly at: { x: number; z: number }; readonly why: string }
  | { readonly kind: "gone"; readonly why: string };

const ROLES = new WeakMap<VillagePlan, Map<number, ReadonlyMap<number, CourtRole>>>();
const NONE: ReadonlyMap<number, CourtRole> = new Map();

/** Everyone's parts in a day: read once for each plan and day. */
function rolesOn(plan: VillagePlan, day: number): ReadonlyMap<number, CourtRole> {
  const place = courtPlaced(plan),
    court = plan.court;
  if (!place || !court) return NONE;
  let kept = ROLES.get(plan);
  if (!kept) ROLES.set(plan, (kept = new Map()));
  const hit = kept.get(day);
  if (hit) return hit;
  const map = new Map<number, CourtRole>(),
    indexOf = new Map(plan.people.map((p, i) => [p.ref, i] as const)),
    toward = (a: { x: number; z: number }, b: { x: number; z: number }) =>
      Math.atan2(b.x - a.x, b.z - a.z),
    stocksAt = courtSpot(place, STOCKS.u, STOCKS.v + 1.6),
    cellAt = courtSpot(place, CELL.u, CELL.v),
    bench = courtSpot(place, 0, 0),
    works = courtSpot(place, -REACH - 7, 12),
    hive = court.form === "hive";
  // Whose sentence runs today.
  for (const [d, s] of heardMap(plan)) {
    const i = indexOf.get(s.accused);
    if (i === undefined || day <= d || day >= d + s.days) continue;
    if (s.sentence === "banish") map.set(i, { kind: "gone", why: `Sent away by ${court.law}` });
    else if (s.sentence === "stocks")
      map.set(i, {
        kind: "held",
        at: stocksAt,
        face: toward(stocksAt, courtSpot(place, STOCKS.u, 20)),
        why:
          court.form === "reef"
            ? "Tied to the reef post"
            : court.grips
              ? "In the stocks"
              : "Penned in the ring of stones",
      });
    else if (s.sentence === "cell" && (court.form === "magistrate" || court.form === "bench"))
      map.set(i, {
        kind: "held",
        at: cellAt,
        face: toward(cellAt, courtSpot(place, CELL.u, 20)),
        why: court.grips ? "Locked in the town's cell" : "Shut in the pit",
      });
    else if (s.sentence === "labour")
      map.set(i, {
        kind: "labour",
        at: works,
        why: hive ? "At work in the far cells" : "Set to labour, by the court",
      });
  }
  // Today's sitting.
  const sit = heardMap(plan).get(day);
  if (sit) {
    const dock = courtSpot(place, 0, DOCK_V + 1.4),
      accused = indexOf.get(sit.accused);
    if (accused !== undefined) {
      const then = sit.sentence;
      map.set(accused, {
        kind: "accused",
        at: hive ? courtSpot(place, 0, DOCK_V - 2) : dock,
        face: toward(dock, bench),
        then,
        thenAt:
          then === "stocks"
            ? stocksAt
            : then === "cell" && (court.form === "magistrate" || court.form === "bench")
              ? cellAt
              : then === "banish"
                ? { x: plan.road.x * 6, z: plan.road.z * 6 }
                : then === "labour"
                  ? works
                  : then === "fine"
                    ? courtSpot(place, 0, 3.6)
                    : null,
        thenFace:
          then === "stocks"
            ? toward(stocksAt, courtSpot(place, STOCKS.u, 20))
            : then === "cell"
              ? toward(cellAt, courtSpot(place, CELL.u, 20))
              : then === "fine"
                ? toward(courtSpot(place, 0, 3.6), bench)
                : null,
        why: `Before ${court.law}`,
      });
    }
    const grown = plan.people
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => !p.child && !p.figure && !map.has(i)),
      elders = [...grown].sort((a, b) => b.p.age - a.p.age || a.i - b.i),
      benches =
        court.form === "magistrate"
          ? [[0, -0.6]]
          : court.form === "hive"
            ? []
            : court.form === "elders"
              ? [
                  [-6, 2.5],
                  [-4.2, -1.8],
                  [0, -3.5],
                  [4.2, -1.8],
                  [6, 2.5],
                ]
              : [
                  [-3.2, -0.6],
                  [0, -0.6],
                  [3.2, -0.6],
                ];
    benches.forEach(([u, v], k) => {
      const who = elders[k];
      if (!who) return;
      const at = courtSpot(place, u!, v!);
      map.set(who.i, {
        kind: "judge",
        at,
        face: toward(at, dock),
        why: `Judging at ${court.law}`,
      });
    });
    // Some of the town come to watch: a crescent about the rail, facing it. In a hive, a ring with their backs to the one who stands there.
    const seed = hashText(sit.ref),
      watching = plan.people
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => !p.figure && !map.has(i) && unitOf(seed, i, 3) < (hive ? 0.7 : 0.42))
        .slice(0, MOST_WATCHING);
    watching.forEach(({ i }, k) => {
      const row = Math.floor(k / 12),
        a =
          (hive ? (k / Math.min(12, watching.length)) * 2 * Math.PI : ((k % 12) / 11 - 0.5) * 2.5) +
          row * 0.12,
        rad = (hive ? 9 : 8) + row * 3.2 + unitOf(seed, i, 4) * 0.8,
        centre = hive ? courtSpot(place, 0, DOCK_V - 2) : dock,
        c = Math.cos(place.yaw),
        s = Math.sin(place.yaw),
        ux = Math.sin(a) * rad,
        vz = Math.cos(a) * rad,
        at = {
          x: centre.x + (c * ux + s * vz) * place.scale,
          z: centre.z + (-s * ux + c * vz) * place.scale,
        };
      map.set(i, {
        kind: "watch",
        at,
        face: hive ? toward(centre, at) : toward(at, centre),
        why: hive ? "Turned from one of their own" : `Watching ${court.law}`,
      });
    });
  }
  kept.set(day, map);
  return map;
}

/** A person's part in the court's day (null: it has none for them). */
export function courtRole(plan: VillagePlan, index: number, day: number): CourtRole | null {
  return plan.court ? (rolesOn(plan, day).get(index) ?? null) : null;
}
