// A town's people as the village draws them (Phase 60 T1: in a great town on a slowed phone their
// posing was a fifth of the frame). Each one's figure is posed part by part — each limb eased toward
// its pose now, turned to the way they face, sized to them — and written straight into the batches
// of their group and of their hair's colour, number for number as the village posed them before
// (tests/render/folk.test.ts); the parts of one shape and one colour in one batch, a draw for them
// all, not one a part. Those small on the screen are posed every other frame, half of them each
// frame, and carried between to where they are drawn: their place is the walker's own every frame,
// only their limbs' swing is a frame behind (their limbs eased every frame all the same, so each
// pose, when it comes, is the one posed every frame). Those near the eye, those the god's hand walks
// among (possession's small world), the wounded and those coming or going at a door are posed every
// frame.
import type { VillagePlan } from "../bridge/index.ts";
import {
  ACTIVITY,
  bobOf,
  hairOf,
  limbPitch,
  partExtent,
  personGroup,
  woundBob,
  woundPitch,
  type Figure,
  type Moment,
  type WoundGear,
} from "../view/index.ts";
import { lieDown } from "./possess.ts";
import { stumpAlong } from "./wounds.ts";

/** Units to a metre, as the village's. */
const M = 0.1;
/**
 * Posed every other frame below so many CSS pixels tall on the screen (a figure about the height of
 * a thumb's tip: its limbs' swing a frame behind is not to be seen there).
 */
export const FOLK_NEAR_PX = 72;

/** Where a batch's instances are written: a part's batch for a group, or for a hair colour. */
export type FolkBatch = {
  setMatrices(count: number, write: (m: Float32Array) => void): void;
};

/** What a frame of the town gives its people to be posed by. */
export type FolkFrame = {
  readonly plan: VillagePlan;
  readonly figure: Figure;
  /** Each one as drawn now (where, facing, at what), their size (0 gone … 1 whole), their stride's clock. */
  readonly moments: readonly Moment[];
  readonly sizes: readonly number[];
  readonly strides: readonly number[];
  /** Each one's wounds' gear now (null: whole). */
  readonly gear: readonly (WoundGear | null)[];
  /** The screen's clock (seconds), and the seconds since the last frame. */
  readonly clock: number;
  readonly dt: number;
  /** Those lying struck down (possession's small world). */
  readonly downed: ReadonlySet<number> | null;
  /** Those posed every frame whatever their size on the screen (possession's small world). */
  readonly kept: ReadonlySet<number> | null;
  /**
   * Each group's batch for each part (null: hair), and each hair part's batch for each colour: one
   * batch may be given for several parts, each one's parts written into it one after another.
   */
  readonly people: readonly (readonly (FolkBatch | null)[])[];
  readonly hair: readonly (readonly FolkBatch[] | null)[];
  /**
   * Where the eye stands (metres) and how far off a figure stands at FOLK_NEAR_PX tall (metres;
   * Infinity: everyone posed every frame).
   */
  readonly eye: { readonly x: number; readonly y: number; readonly z: number };
  readonly near: number;
};

/** A part's place now, as the village lays it out ([x, y, z, sx, sy, sz, yaw, pitch]). */
export type PlacePart = (out: number[], i: number, pi: number) => void;

/** How far off a figure of the town stands when it is FOLK_NEAR_PX tall on the screen (metres). */
export function nearReach(figure: Figure, fov: number, screenHeight: number): number {
  let top = 0;
  for (const p of figure.parts) top = Math.max(top, p.y + partExtent(p)[1] / 2);
  const tall = (top * figure.scale) / M,
    focal = screenHeight / (2 * Math.tan((fov * Math.PI) / 360));
  return (tall * focal) / FOLK_NEAR_PX;
}

/** Which of those drawn were drawn afresh since `was` (by possession's small world). */
export function redrawn<T>(was: readonly T[], now: readonly T[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < now.length; i++) if (now[i] !== was[i]) out.add(i);
  return out;
}

/** Each batch once with the parts it draws: each group's, and each hair colour's (and which colour). */
type Shared = {
  readonly people: (readonly [FolkBatch, number[]])[][];
  readonly hair: (readonly [FolkBatch, number, number[]])[];
};

export class FolkPoses {
  /** Each one's limbs as last drawn (a pitch a part, by their ref): eased toward each new pose. */
  private readonly limbs = new Map<string, Float32Array>();
  /** The plan and figure the people below were read for. */
  private plan: VillagePlan | null = null;
  private figure: Figure | null = null;
  /** Each one's limbs (as in `limbs`), group, hair colour and size against a grown one's. */
  private pitches: Float32Array[] = [];
  private groups = new Uint8Array(0);
  private hairs = new Uint8Array(0);
  private grown = new Float64Array(0);
  /**
   * Each one's parts as last posed (sixteen numbers a part), where they stood then (units), and
   * whether posed since they were last hidden.
   */
  private posed = new Float32Array(0);
  private atX = new Float64Array(0);
  private atZ = new Float64Array(0);
  private fresh = new Uint8Array(0);
  /** Each one's parts' matrices or carried: whether posed this frame. */
  private now = new Uint8Array(0);
  /** Frames posed: whose turn it is among those posed every other frame. */
  private frames = 0;
  /** Those drawn of each group and of each hair colour this frame (their places among the people). */
  private members: Int32Array[] = [];
  private counts: number[] = [];
  /** Each batch once, with the parts it draws (kept while the batches given are the same). */
  private shared:
    (Shared & { readonly of: FolkFrame["people"]; readonly hairOf: FolkFrame["hair"] }) | null =
    null;
  /** How many were posed and carried in the last frame (the tests, the look tools). */
  shown = { posed: 0, carried: 0 };

  /** A new village's people: their limbs forgotten (the same village's are carried on). */
  forget(): void {
    this.limbs.clear();
    this.plan = null;
  }

  /** Each batch given once, with the parts it draws. */
  private sharing(f: FolkFrame): Shared {
    if (this.shared?.of === f.people && this.shared.hairOf === f.hair) return this.shared;
    const people = f.people.map((batches) => {
      const parts = new Map<FolkBatch, number[]>();
      batches.forEach((batch, pi) => {
        if (batch) (parts.get(batch) ?? parts.set(batch, []).get(batch)!).push(pi);
      });
      return [...parts];
    });
    const hair = new Map<FolkBatch, [FolkBatch, number, number[]]>();
    f.hair.forEach((byColour, pi) =>
      byColour?.forEach((batch, hi) => {
        const was = hair.get(batch);
        if (was) was[2].push(pi);
        else hair.set(batch, [batch, hi, [pi]]);
      }),
    );
    this.shared = { of: f.people, hairOf: f.hair, people, hair: [...hair.values()] };
    return this.shared;
  }

  /** Read again for a plan or a figure: each one's limbs, group, hair and size. */
  private read(plan: VillagePlan, figure: Figure): void {
    const n = plan.people.length,
      parts = figure.parts.length,
      span = plan.body?.span ?? 70;
    this.plan = plan;
    this.figure = figure;
    this.pitches = plan.people.map((p) => this.limbsOf(p.ref, parts));
    this.groups = Uint8Array.from(plan.people, (p) => personGroup(p));
    this.hairs = Uint8Array.from(plan.people, (p) => hairOf(p.ref, p.age, span));
    this.grown = Float64Array.from(plan.people, (p) => (p.child ? 0.7 : 1) * figure.scale);
    this.posed = new Float32Array(n * parts * 16);
    this.atX = new Float64Array(n);
    this.atZ = new Float64Array(n);
    this.fresh = new Uint8Array(n);
    this.now = new Uint8Array(n);
    this.members = [];
    this.counts = [];
  }

  /** One's limbs as last drawn (made afresh, unposed, for a new figure). */
  private limbsOf(ref: string, parts: number): Float32Array {
    let drawn = this.limbs.get(ref);
    if (!drawn || drawn.length !== parts) {
      drawn = new Float32Array(parts).fill(Number.NaN);
      this.limbs.set(ref, drawn);
    }
    return drawn;
  }

  /**
   * Pose the town's people and write them into their batches; the place of a part of one of them
   * now, for what is worn on it (a bandage bound about it).
   */
  pose(f: FolkFrame): PlacePart {
    const { plan, figure, moments, sizes, strides, gear, clock, dt, downed } = f,
      parts = figure.parts,
      n = plan.people.length,
      P = parts.length;
    if (plan !== this.plan || figure !== this.figure || this.pitches.length !== n)
      this.read(plan, figure);
    const pitches = this.pitches,
      ease = dt > 0 ? 1 - Math.exp(-Math.min(0.1, dt) / 0.08) : 1,
      near2 = f.near * f.near,
      turn = this.frames++ & 1,
      out = [0, 0, 0, 1, 1, 1, 0, 0];
    let posedNow = 0,
      carriedNow = 0;
    /** One drawn's limbs eased toward their pose now (every frame, posed or carried). */
    const easeOne = (i: number, m: Moment) => {
      const drawn = pitches[i]!,
        g = gear[i] ?? null,
        walking = m.activity === ACTIVITY.walking;
      // Each limb eased toward its pose now: a stride begun or ended, a task taken up, is a turn of
      // the arm, not a jump of it.
      for (let pi = 0; pi < P; pi++) {
        const part = parts[pi]!,
          posed = limbPitch(part, m.task, walking, walking ? strides[i]! : clock, i),
          aim = g ? woundPitch(g, pi, posed) : posed,
          was = drawn[pi]!;
        drawn[pi] = Number.isNaN(was) ? aim : was + (aim - was) * ease;
      }
    };
    /** The parts of one drawn, posed now into what is kept of them. */
    const poseOne = (i: number, m: Moment) => {
      const drawn = pitches[i]!,
        g = gear[i] ?? null,
        walking = m.activity === ACTIVITY.walking,
        size = this.grown[i]! * (sizes[i] ?? 1),
        c = Math.cos(m.yaw),
        sn = Math.sin(m.yaw),
        bob = bobOf(m.task, clock, i),
        limp = g && walking ? woundBob(g, strides[i]!, i) : 0,
        lying = !!downed?.has(i),
        mx = m.x * M,
        mz = m.z * M,
        keep = this.posed;
      for (let pi = 0; pi < P; pi++) {
        const part = parts[pi]!,
          pitch = drawn[pi]!,
          o = (i * P + pi) * 16;
        // A limb swings about its hinge: in the stride, or in the work at hand. (A wound's: a member
        // gone, a stump kept from its hinge, a limp's dip: Phase 55 M226.)
        const k = g ? g.keep[pi]! : 1,
          lift = k < 1 ? stumpAlong(partExtent(part)[1], k) : 0,
          hinge = (part.pivot ?? 0) - lift,
          cp = Math.cos(pitch),
          sp = Math.sin(pitch),
          dy = hinge - hinge * cp,
          dz = -hinge * sp,
          px = part.x,
          pz = part.z + dz,
          sx = k > 0 ? part.sx * size : 0,
          sy = part.sy * size * k,
          sz = k > 0 ? part.sz * size : 0;
        if (lying) {
          // (Struck down: on their back where they fell, as the village laid them.)
          out[0] = mx + (px * c + pz * sn) * size;
          out[1] = (part.y + lift + dy + bob + limp) * size;
          out[2] = mz + (-px * sn + pz * c) * size;
          out[3] = sx;
          out[4] = sy;
          out[5] = sz;
          out[6] = m.yaw;
          out[7] = pitch;
          lieDown(out, part, m.x, m.z, m.yaw, size, pitch);
          matrixOf(keep, o, out);
          continue;
        }
        // The part's place about the figure's middle, turned to the way it faces.
        keep[o] = c * sx;
        keep[o + 1] = 0;
        keep[o + 2] = -sn * sx;
        keep[o + 3] = 0;
        keep[o + 4] = sn * sp * sy;
        keep[o + 5] = cp * sy;
        keep[o + 6] = c * sp * sy;
        keep[o + 7] = 0;
        keep[o + 8] = sn * cp * sz;
        keep[o + 9] = -sp * sz;
        keep[o + 10] = c * cp * sz;
        keep[o + 11] = 0;
        keep[o + 12] = mx + (px * c + pz * sn) * size;
        keep[o + 13] = (part.y + lift + dy + bob + limp) * size;
        keep[o + 14] = mz + (-px * sn + pz * c) * size;
        keep[o + 15] = 1;
      }
      this.atX[i] = mx;
      this.atZ[i] = mz;
      this.fresh[i] = 1;
    };
    // Each one's limbs eased, and each posed now or carried to where they are drawn as last posed.
    for (let i = 0; i < n; i++) {
      const m = moments[i]!;
      this.now[i] = 0;
      if (m.hidden) {
        // (Posed afresh when they are seen again.)
        this.fresh[i] = 0;
        continue;
      }
      easeOne(i, m);
      const ex = m.x - f.eye.x,
        ez = m.z - f.eye.z;
      if (
        !this.fresh[i] ||
        (i & 1) === turn ||
        ex * ex + f.eye.y * f.eye.y + ez * ez < near2 ||
        (sizes[i] ?? 1) < 1 ||
        gear[i] ||
        f.kept?.has(i) ||
        downed?.has(i)
      ) {
        poseOne(i, m);
        this.now[i] = 1;
        posedNow++;
      } else carriedNow++;
    }
    this.shown = { posed: posedNow, carried: carriedNow };
    // Each group's parts, and each hair colour's, written in the people's order.
    const groups = f.people.length,
      colours = f.hair.reduce((most, h) => Math.max(most, h?.length ?? 0), 0),
      lists = groups + colours;
    while (this.members.length < lists) this.members.push(new Int32Array(n));
    for (let k = 0; k < lists; k++) {
      if (this.members[k]!.length < n) this.members[k] = new Int32Array(n);
      this.counts[k] = 0;
    }
    for (let i = 0; i < n; i++) {
      if (moments[i]!.hidden) continue;
      const gi = this.groups[i]!;
      if (gi < groups) this.members[gi]![this.counts[gi]!++] = i;
      const hi = groups + this.hairs[i]!;
      if (hi < lists) this.members[hi]![this.counts[hi]!++] = i;
    }
    const keep = this.posed;
    /** The members of a list, the parts `pis` of each one after another, written into a batch. */
    const write = (batch: FolkBatch, list: number, pis: readonly number[]) => {
      const who = this.members[list]!,
        count = this.counts[list]!,
        each = pis.length;
      batch.setMatrices(count * each, (m) => {
        for (let k = 0; k < count; k++) {
          const i = who[k]!,
            carried = !this.now[i];
          for (let q = 0; q < each; q++) {
            const from = (i * P + pis[q]!) * 16,
              to = (k * each + q) * 16;
            for (let r = 0; r < 16; r++) m[to + r] = keep[from + r]!;
            // (Carried: moved as far as they have gone since they were posed.)
            if (carried) {
              m[to + 12] = keep[from + 12]! + (moments[i]!.x * M - this.atX[i]!);
              m[to + 14] = keep[from + 14]! + (moments[i]!.z * M - this.atZ[i]!);
            }
          }
        }
      });
    };
    // Each group's batches, and each hair colour's, written once each with the parts they draw.
    const { people, hair } = this.sharing(f);
    people.forEach((batches, gi) => {
      for (const [batch, pis] of batches) write(batch, gi, pis);
    });
    for (const [batch, hi, pis] of hair) write(batch, groups + hi, pis);
    // (A part of one now, as posed: for what is worn on it.)
    return (o, i, pi) => {
      const m = moments[i]!,
        part = parts[pi]!,
        g = gear[i] ?? null,
        size = this.grown[i]! * (sizes[i] ?? 1),
        c = Math.cos(m.yaw),
        sn = Math.sin(m.yaw),
        pitch = pitches[i]![pi]!,
        k = g ? g.keep[pi]! : 1,
        lift = k < 1 ? stumpAlong(partExtent(part)[1], k) : 0,
        hinge = (part.pivot ?? 0) - lift,
        dy = hinge - hinge * Math.cos(pitch),
        dz = -hinge * Math.sin(pitch),
        px = part.x,
        pz = part.z + dz,
        limp = g && m.activity === ACTIVITY.walking ? woundBob(g, strides[i]!, i) : 0;
      o[0] = m.x * M + (px * c + pz * sn) * size;
      o[1] = (part.y + lift + dy + bobOf(m.task, clock, i) + limp) * size;
      o[2] = m.z * M + (-px * sn + pz * c) * size;
      o[3] = k > 0 ? part.sx * size : 0;
      o[4] = part.sy * size * k;
      o[5] = k > 0 ? part.sz * size : 0;
      o[6] = m.yaw;
      o[7] = pitch;
      if (downed?.has(i)) lieDown(o, part, m.x, m.z, m.yaw, size, pitch);
    };
  }
}

/** A part's matrix from its place ([x, y, z, sx, sy, sz, yaw, pitch]), as InstancedBatch.set lays it. */
function matrixOf(m: Float32Array, o: number, t: readonly number[]): void {
  const [x, y, z, sx, sy, sz, yaw, pitch] = t as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const c = Math.cos(yaw),
    s = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  m[o] = c * sx;
  m[o + 1] = 0;
  m[o + 2] = -s * sx;
  m[o + 3] = 0;
  m[o + 4] = s * sp * sy;
  m[o + 5] = cp * sy;
  m[o + 6] = c * sp * sy;
  m[o + 7] = 0;
  m[o + 8] = s * cp * sz;
  m[o + 9] = -sp * sz;
  m[o + 10] = c * cp * sz;
  m[o + 11] = 0;
  m[o + 12] = x;
  m[o + 13] = y;
  m[o + 14] = z;
  m[o + 15] = 1;
}
