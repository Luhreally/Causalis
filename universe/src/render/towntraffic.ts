// Cars and lines in a town (R1): what a household keeps, standing at their door by night, going the way they walk of a morning, by where they work by day;
// what goes a line through the town with those on their way aboard, seen at its windows. Drawn in a few batches by colour, put again each frame: no new mesh.
import * as pc from "playcanvas";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import type { VillagePlan } from "../bridge/index.ts";
import {
  MOST_ABOARD,
  aboardNow,
  carNow,
  ridesOf,
  type BusLine,
  type Moment,
  type Owner,
} from "../view/index.ts";
import type { Rgb, Stage } from "./stage.ts";

/** Body colours, by a household's turn. */
const TONES: readonly Rgb[] = [
  [0.72, 0.16, 0.13],
  [0.18, 0.32, 0.62],
  [0.86, 0.86, 0.82],
  [0.16, 0.17, 0.2],
  [0.76, 0.6, 0.18],
  [0.28, 0.46, 0.34],
];
const TYRE: Rgb = [0.06, 0.06, 0.07],
  GLASS: Rgb = [0.1, 0.13, 0.17],
  BUS: Rgb = [0.86, 0.48, 0.1],
  WINDOW: Rgb = [0.9, 0.84, 0.64],
  SLED: Rgb = [0.3, 0.62, 0.64],
  /** A drift-line: pale, against a water people's roofs and their water. */
  DRIFT: Rgb = [0.66, 0.92, 0.86],
  HAULER: Rgb = [0.5, 0.42, 0.3];

/** Larger than life by this, as the town's figures are large: seen from the eye a town lets you have. */
const LARGE = 1.5;
/** A car's size and a line's vehicle's (metres). */
const CAR = { long: 4.2 * LARGE, wide: 1.9 * LARGE, tall: 1.05 * LARGE, top: 0.7 * LARGE };
const COACH = { long: 10 * LARGE, wide: 2.5 * LARGE, tall: 2.3 * LARGE };
/** How fast a line's vehicle goes, metres a real second while the clock runs: at a pace the eye can follow. */
const PACE = 42;
/** How far outside what is drawn a finger still counts as on it, and as near it (screen pixels). */
const ON_PX = 7;
const NEAR_PX = 20;

type Slot = { batch: InstancedBatch; data: number[] };

export class TownTraffic {
  private readonly stage: Stage;
  /** Its own: a town built again destroys what stands under its root, but for the layers it names. */
  readonly root: pc.Entity;
  private readonly box: pc.Mesh;
  private readonly slots = new Map<string, Slot>();
  private gone = 0;
  private last = 0;
  /** Where each is now on the screen's asking: metres. */
  private cars: { index: number; x: number; z: number; yaw: number; riding: boolean }[] = [];
  private riders: number[] = [];
  private buses: { n: number; x: number; z: number; yaw: number; aboard: number }[] = [];
  private scale = 1;

  constructor(stage: Stage, root: pc.Entity) {
    this.stage = stage;
    this.root = new pc.Entity("town-traffic");
    root.addChild(this.root);
    this.box = keptMesh(boxMesh(stage));
  }

  private put(
    c: Rgb,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number,
  ): void {
    const k = `${c[0]}|${c[1]}|${c[2]}`;
    let s = this.slots.get(k);
    if (!s) {
      s = {
        batch: new InstancedBatch(this.stage, this.box, [c[0], c[1], c[2]], 48, this.root),
        data: [],
      };
      this.slots.set(k, s);
    }
    const M = this.scale;
    s.data.push(x * M, (y + sy / 2) * M, z * M, sx * M, sy * M, sz * M, yaw, 0);
  }

  /** Everyone's vehicle where it is at t: `moments` where the town has its people now. */
  update(
    plan: VillagePlan,
    moments: readonly Moment[],
    t: number,
    running: boolean,
    fine: boolean,
    M: number,
    /** One being lived, if any: aboard a line, their own coach goes where they are, so they are seen going in it. */
    lived: number | null = null,
  ): void {
    this.scale = M;
    for (const s of this.slots.values()) s.data.length = 0;
    this.cars = [];
    this.buses = [];
    const rides = ridesOf(plan),
      wall = performance.now() / 1000;
    this.riders = [...rides.riders];
    if (running && this.last) this.gone += Math.min(0.25, wall - this.last);
    this.last = wall;
    const about = plan.about,
      own = about?.how === "sled" ? SLED : null,
      wheeled = about?.how === "wheels" || about?.how === "line" || about?.how === "hauler",
      lift = about?.how === "sled" ? 0.55 : 0.34;
    for (const o of rides.owners.values() as Iterable<Owner>) {
      const now = carNow(plan, o, t, fine),
        m = moments[o.index],
        x = now.riding && m ? m.x : now.x,
        z = now.riding && m ? m.z : now.z,
        yaw = now.riding && m ? m.yaw : now.yaw,
        body = own ?? TONES[o.tone % TONES.length]!;
      if (wheeled) this.wheels(x, z, yaw, CAR.wide, CAR.long, lift);
      this.put(body, x, lift, z, CAR.wide, CAR.tall * 0.6, CAR.long, yaw);
      this.put(GLASS, x, lift + CAR.tall * 0.6, z, CAR.wide * 0.86, CAR.top, CAR.long * 0.5, yaw);
      this.cars.push({ index: o.index, x, z, yaw, riding: now.riding });
    }
    if (rides.lines.length) {
      let aboard = 0;
      for (const i of rides.riders) if (aboardNow(plan, i, t, fine)) aboard++;
      const hour = (t % 86_400) / 3600,
        out = hour > 5 && hour < 23,
        coach = about?.how === "hauler" ? HAULER : about?.how === "sled" ? DRIFT : BUS;
      const me = lived !== null && rides.riders.has(lived) ? moments[lived] : null;
      if (me && lived !== null && aboardNow(plan, lived, t, fine))
        this.coach(coach, me.x, lift, me.z, me.yaw, MOST_ABOARD, wheeled);
      rides.lines.forEach((line, k) => {
        const seen = out
            ? this.along(line, this.gone * PACE + line.long * 0.37 * k)
            : this.along(line, 0),
          on = Math.min(MOST_ABOARD, Math.round(aboard / rides.lines.length));
        this.coach(coach, seen.x, lift, seen.z, seen.yaw, on, wheeled);
        this.buses.push({ n: line.n, x: seen.x, z: seen.z, yaw: seen.yaw, aboard: on });
      });
    }
    for (const s of this.slots.values()) {
      const n = s.data.length / 8;
      if (n > s.batch.capacity) {
        const old = s.batch,
          key = [...this.slots]
            .find(([, v]) => v === s)![0]
            .split("|")
            .map(Number) as [number, number, number];
        old.destroy();
        s.batch = new InstancedBatch(this.stage, this.box, key, Math.ceil(n * 1.4), this.root);
      }
      const d = s.data;
      s.batch.set(n, (i, o) => {
        const q = i * 8;
        for (let j = 0; j < 8; j++) o[j] = d[q + j]!;
      });
    }
  }

  /** Four wheels under what stands at x, z: a dark block at each corner, reaching up under its body. */
  private wheels(
    x: number,
    z: number,
    yaw: number,
    wide: number,
    long: number,
    lift: number,
  ): void {
    const c = Math.cos(yaw),
      s = Math.sin(yaw),
      high = lift + 0.3,
      across = wide / 2 + 0.02,
      apart = long * 0.32;
    for (const side of [-1, 1])
      for (const end of [-1, 1])
        this.put(
          TYRE,
          x + s * end * apart + c * side * across,
          0,
          z + c * end * apart - s * side * across,
          0.26,
          high,
          high * 1.7,
          yaw,
        );
  }

  /** A line's vehicle, its lit windows those aboard (a window each), its windscreen on the way it goes. */
  private coach(
    body: Rgb,
    x: number,
    lift: number,
    z: number,
    yaw: number,
    aboard: number,
    wheeled: boolean,
  ): void {
    if (wheeled) this.wheels(x, z, yaw, COACH.wide, COACH.long, lift);
    this.put(body, x, lift, z, COACH.wide, COACH.tall, COACH.long, yaw);
    const c = Math.cos(yaw),
      s = Math.sin(yaw),
      front = COACH.long / 2 + 0.03;
    this.put(
      GLASS,
      x + s * front,
      lift + COACH.tall * 0.48,
      z + c * front,
      COACH.wide * 0.82,
      COACH.tall * 0.38,
      0.08,
      yaw,
    );
    for (let w = 0; w < aboard; w++) {
      const along = ((w % 6) - 2.5) * (COACH.long / 6.5),
        flank = (w < 6 ? 1 : -1) * (COACH.wide / 2 + 0.03);
      this.put(
        WINDOW,
        x + s * along + c * flank,
        lift + COACH.tall * 0.55,
        z + c * along - s * flank,
        0.08,
        COACH.tall * 0.28,
        COACH.long / 9,
        yaw,
      );
    }
  }

  /** How far along a line's way, out and back. */
  private along(line: BusLine, run: number): { x: number; z: number; yaw: number } {
    const m = ((run % (2 * line.long)) + 2 * line.long) % (2 * line.long),
      back = m > line.long;
    let left = back ? 2 * line.long - m : m;
    for (let k = 0; k + 1 < line.way.length; k++) {
      const a = line.way[k]!,
        b = line.way[k + 1]!,
        len = Math.hypot(b.x - a.x, b.z - a.z);
      if (left <= len && len > 0) {
        const f = left / len,
          dx = b.x - a.x,
          dz = b.z - a.z;
        return {
          x: a.x + dx * f,
          z: a.z + dz * f,
          yaw: back ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz),
        };
      }
      left -= len;
    }
    const end = line.way.at(-1)!;
    return { x: end.x, z: end.z, yaw: 0 };
  }

  /**
   * The car or line at a point of the screen, by the body drawn, not its middle: its owner's index, or its line. `direct`: the finger is on it
   * (a finger's breadth about what is drawn); else it is only near. `depth`: how far it is from the eye.
   */
  pick(
    cam: pc.CameraComponent,
    x: number,
    y: number,
  ): ({ direct: boolean; depth: number } & ({ owner: number } | { line: number })) | null {
    const at = new pc.Vec3(),
      a = new pc.Vec3(),
      b = new pc.Vec3(),
      w = new pc.Vec3(),
      M = this.scale,
      /** How far outside what is drawn the finger is, and whether that counts as on it. */
      test = (cx: number, cz: number, yaw: number, long: number, wide: number, high: number) => {
        const s = Math.sin(yaw),
          c = Math.cos(yaw);
        at.set((cx - (s * long) / 2) * M, high * M, (cz - (c * long) / 2) * M);
        cam.worldToScreen(at, a);
        at.set((cx + (s * long) / 2) * M, high * M, (cz + (c * long) / 2) * M);
        cam.worldToScreen(at, b);
        at.set((cx + (c * wide) / 2) * M, high * M, (cz - (s * wide) / 2) * M);
        cam.worldToScreen(at, w);
        if (a.z <= 0 || b.z <= 0) return Infinity;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          len = dx * dx + dy * dy,
          u = len ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len)) : 0,
          half = Math.hypot(w.x - (a.x + b.x) / 2, w.y - (a.y + b.y) / 2);
        return Math.hypot(a.x + dx * u - x, a.y + dy * u - y) - half;
      };
    let best: ({ direct: boolean; depth: number } & ({ owner: number } | { line: number })) | null =
        null,
      least = NEAR_PX;
    for (const c of this.cars) {
      const d = test(c.x, c.z, c.yaw, CAR.long, CAR.wide, CAR.tall / 2);
      if (d < least) {
        least = d;
        best = { owner: c.index, direct: d <= ON_PX, depth: (a.z + b.z) / 2 };
      }
    }
    for (const q of this.buses) {
      const d = test(q.x, q.z, q.yaw, COACH.long, COACH.wide, COACH.tall / 2);
      if (d < least) {
        least = d;
        best = { line: q.n, direct: d <= ON_PX, depth: (a.z + b.z) / 2 };
      }
    }
    return best;
  }

  /** What is drawn (the look tools), with where each stands on the screen. */
  info(cam: pc.CameraComponent): {
    cars: number;
    buses: number;
    aboard: number;
    owners: number[];
    riders: number[];
    carsAt: {
      index: number;
      x: number;
      y: number;
      wx: number;
      wz: number;
      riding: boolean;
    }[];
    busesAt: { n: number; x: number; y: number; aboard: number; wx: number; wz: number }[];
  } {
    const at = new pc.Vec3(),
      out = new pc.Vec3(),
      M = this.scale,
      carsAt: {
        index: number;
        x: number;
        y: number;
        wx: number;
        wz: number;
        riding: boolean;
      }[] = [],
      busesAt: { n: number; x: number; y: number; aboard: number; wx: number; wz: number }[] = [];
    for (const c of this.cars) {
      at.set(c.x * M, 0.6 * M, c.z * M);
      cam.worldToScreen(at, out);
      if (out.z > 0)
        carsAt.push({ index: c.index, x: out.x, y: out.y, wx: c.x, wz: c.z, riding: c.riding });
    }
    for (const b of this.buses) {
      at.set(b.x * M, 1.2 * M, b.z * M);
      cam.worldToScreen(at, out);
      if (out.z > 0)
        busesAt.push({ n: b.n, x: out.x, y: out.y, aboard: b.aboard, wx: b.x, wz: b.z });
    }
    return {
      cars: this.cars.length,
      buses: this.buses.length,
      aboard: this.buses.reduce((n, b) => n + b.aboard, 0),
      owners: this.cars.map((c) => c.index),
      riders: this.riders,
      carsAt,
      busesAt,
    };
  }

  clear(): void {
    this.cars = [];
    this.buses = [];
    for (const s of this.slots.values()) {
      s.data.length = 0;
      s.batch.set(0, () => {});
    }
  }

  destroy(): void {
    for (const s of this.slots.values()) s.batch.destroy();
    this.slots.clear();
  }
}
