// The cell held made lively (Live a Line, 2026-11-28, the owner's "fun pizaz"): eyes that look toward food and toward
// danger, its parts drawn on it (a whip of a flagellum beating behind, a fringe of cilia, spines, an eyespot, a poison's
// faint halo, a mouth), a squash and stretch as it goes and as it eats, a little burst of crumbs at each bite, a burst as
// it divides, and a ring of beads about it that goes out bead by bead while a hunter grips it. Our own look, in the
// drop's simple spheres; a few batches of a few spheres each, placed afresh each frame: cheap. The mode's own, laid on
// the drop's scene only while a line is lived.
import * as pc from "playcanvas";
import { InstancedBatch } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import type { CellPart, RoundDrop, Traits } from "../view/index.ts";

type Burst = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  r: number;
};

const BURSTS_MOST = 48,
  RING = 14;

export class CellJuice {
  readonly root = new pc.Entity("line-juice");
  private readonly whites: InstancedBatch;
  private readonly pupils: InstancedBatch;
  private readonly pale: InstancedBatch;
  private readonly red: InstancedBatch;
  private readonly halo: InstancedBatch;
  private readonly dark: InstancedBatch;
  private readonly crumbs: InstancedBatch;
  private readonly ring: InstancedBatch;
  private bursts: Burst[] = [];
  private look = { x: 1, y: 0 };
  private chew = 0;
  private t = 0;

  constructor(stage: Stage, parent: pc.Entity) {
    const mesh = pc.Mesh.fromGeometry(
        stage.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 8, longitudeBands: 10 }),
      ),
      batch = (color: Rgb, most: number, opacity = 1) =>
        new InstancedBatch(
          stage,
          mesh,
          color,
          most,
          this.root,
          flatMaterial(color, opacity, 0.5, 0.3),
        );
    this.whites = batch([0.97, 0.98, 1], 2);
    this.pupils = batch([0.05, 0.06, 0.12], 2);
    this.pale = batch([0.88, 0.95, 1], 64, 0.85);
    this.red = batch([0.9, 0.26, 0.18], 2);
    this.halo = batch([0.55, 0.95, 0.45], 1, 0.16);
    this.dark = batch([0.08, 0.12, 0.22], 2);
    this.crumbs = batch([1, 0.92, 0.6], BURSTS_MOST, 0.9);
    this.ring = batch([1, 0.42, 0.36], RING, 0.9);
    parent.addChild(this.root);
  }

  /** A bite taken: the cell bulges, and crumbs fly from its mouth. */
  bite(): void {
    this.chew = 1;
    this.burst(5, 0.9, 0.35);
  }
  /** It divides: a burst of light all about it. */
  divided(): void {
    this.burst(18, 2.2, 0.7);
  }

  private at = { x: 0, y: 0, z: 0, d: 0.12, ax: 1, ay: 0 };
  private burst(n: number, speed: number, life: number): void {
    const a = this.at;
    for (let i = 0; i < n && this.bursts.length < BURSTS_MOST; i++) {
      const ang = Math.atan2(a.ay, a.ax) + (n > 6 ? (i / n) * Math.PI * 2 : (i - n / 2) * 0.45),
        v = speed * a.d * (0.7 + 0.6 * ((i * 0.618) % 1));
      this.bursts.push({
        x: a.x + a.ax * a.d * 0.5,
        y: a.y + a.ay * a.d * 0.5,
        z: a.z + a.d * 0.3,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        age: 0,
        life,
        r: a.d * 0.12,
      });
    }
  }

  /**
   * The cell held drawn lively: `drop` is the round drop about to be drawn (its held cell's own parts squashed and
   * stretched in it); `at` where the held cell stands in the round, `d` its drawn breadth; its heading, how fast it goes
   * against its fastest (0 … 1), where it looks (food, or danger first: a direction in the drop, y down), how much of it is
   * left to a hunter's grip (1: free).
   */
  update(
    drop: RoundDrop,
    kind: number,
    at: { x: number; y: number; z: number },
    d: number,
    heading: number,
    going: number,
    t: Traits,
    lookTo: { dx: number; dy: number } | null,
    whole: number,
    dt: number,
  ): void {
    this.t += dt;
    const ax = Math.cos(heading),
      ay = -Math.sin(heading);
    this.at = { ...at, d, ax, ay };
    this.chew = Math.max(0, this.chew - dt * 4);
    // Squash and stretch: long along its way as it goes, round again as it stops; a bulge at each bite.
    const wob = 0.1 * going * Math.sin(this.t * 14) + 0.18 * this.chew,
      stretch = 1 + 0.18 * going + wob,
      squash = 1 / Math.sqrt(stretch);
    const parts = drop.kinds[kind];
    if (parts)
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]!;
        if (Math.hypot(p.x - at.x, p.y - at.y) > d * 1.2 || Math.abs(p.z - at.z) > d) continue;
        (parts as CellPart[])[i] = {
          ...p,
          sx: p.sx * squash,
          sy: p.sy * squash,
          sz: p.sz * stretch,
        };
      }
    // Eyes at its front, toward the camera; the pupils toward what it looks at (eased).
    const want = lookTo ? { x: lookTo.dx, y: -lookTo.dy } : { x: ax, y: ay },
      l = Math.hypot(want.x, want.y) || 1,
      k = 1 - Math.exp(-dt / 0.15);
    this.look.x += (want.x / l - this.look.x) * k;
    this.look.y += (want.y / l - this.look.y) * k;
    const px = -ay,
      py = ax,
      eyeR = d * 0.26,
      front = d * 0.32,
      eye = (side: number) => ({
        x: at.x + ax * front + px * side * d * 0.2,
        y: at.y + ay * front + py * side * d * 0.2,
        z: at.z + d * 0.42,
      });
    // (A bead, or a rod along `rod`, an angle in the round: drawn as the drop draws a rod, view/drop.ts roundDrop.)
    type Bead = {
      x: number;
      y: number;
      z: number;
      r: number;
      sx?: number;
      sz?: number;
      rod?: number;
    };
    const place = (b: InstancedBatch, list: readonly Bead[]) =>
      b.set(list.length, (i, out) => {
        const q = list[i]!;
        out[0] = q.x;
        out[1] = q.y;
        out[2] = q.z;
        out[3] = q.r * (q.sx ?? 1);
        out[4] = q.r * (q.sx ?? 1);
        out[5] = q.r * (q.sz ?? 1);
        out[6] = q.rod === undefined ? 0 : Math.PI / 2;
        out[7] = q.rod === undefined ? 0 : -q.rod;
      });
    const blink = Math.sin(this.t * 0.9) > 0.985 ? 0.15 : 1,
      eyes = [eye(1), eye(-1)];
    place(
      this.whites,
      eyes.map((e) => ({ ...e, r: eyeR, sx: 1, sz: blink })),
    );
    place(
      this.pupils,
      eyes.map((e) => ({
        x: e.x + this.look.x * eyeR * 0.28,
        y: e.y + this.look.y * eyeR * 0.28,
        z: e.z + eyeR * 0.35,
        r: eyeR * 0.5,
        sz: blink,
      })),
    );
    // Its parts.
    const p = t.parts ?? {},
      pale: Bead[] = [];
    if (p.flagellum)
      for (let i = 1; i <= 5 + 2 * p.flagellum; i++) {
        const back = d * 0.45 + i * d * 0.13,
          wave = Math.sin(this.t * 18 - i * 0.9) * d * 0.09 * Math.min(1, i / 3) * (0.4 + going);
        pale.push({
          x: at.x - ax * back + px * wave,
          y: at.y - ay * back + py * wave,
          z: at.z,
          r: d * 0.07,
        });
      }
    if (p.cilia)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2,
          r = d * (0.56 + 0.04 * Math.sin(this.t * 20 + i));
        pale.push({
          x: at.x + Math.cos(a) * r,
          y: at.y + Math.sin(a) * r * 0.9,
          z: at.z,
          r: d * 0.045 * (1 + 0.3 * p.cilia),
        });
      }
    if (p.spike)
      for (let i = 0; i < 6 + 2 * p.spike; i++) {
        const a = (i / (6 + 2 * p.spike)) * Math.PI * 2 + 0.3,
          r = d * 0.62;
        pale.push({
          x: at.x + Math.cos(a) * r,
          y: at.y + Math.sin(a) * r,
          z: at.z,
          r: d * 0.06,
          sz: 3,
          rod: a,
        });
      }
    if (p.filter)
      for (let i = -2; i <= 2; i++)
        pale.push({
          x: at.x + ax * d * 0.6 + px * i * d * 0.08,
          y: at.y + ay * d * 0.6 + py * i * d * 0.08,
          z: at.z,
          r: d * 0.04,
        });
    place(this.pale, pale);
    place(
      this.red,
      p.eyespot
        ? [
            {
              x: at.x - px * d * 0.25,
              y: at.y - py * d * 0.25,
              z: at.z + d * 0.4,
              r: d * 0.12 * (1 + 0.3 * p.eyespot),
            },
          ]
        : [],
    );
    place(
      this.halo,
      p.toxin
        ? [{ x: at.x, y: at.y, z: at.z, r: d * 1.6 * (1 + 0.04 * Math.sin(this.t * 3)) }]
        : [],
    );
    place(
      this.dark,
      p.mouth
        ? [
            {
              x: at.x + ax * d * 0.5,
              y: at.y + ay * d * 0.5,
              z: at.z + d * 0.2,
              r: d * (0.14 + 0.05 * p.mouth) * (1 + this.chew),
            },
          ]
        : [],
    );
    // Its crumbs and bursts, flying out and fading.
    for (const b of this.bursts) {
      b.age += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bursts = this.bursts.filter((b) => b.age < b.life);
    place(
      this.crumbs,
      this.bursts.map((b) => ({ x: b.x, y: b.y, z: b.z, r: b.r * (1 - b.age / b.life) })),
    );
    // The grip's ring: beads that go out one by one.
    const left = whole < 0.999 ? Math.max(0, Math.ceil(whole * RING)) : 0;
    const ring: { x: number; y: number; z: number; r: number }[] = [];
    for (let i = 0; i < left; i++) {
      const a = (i / RING) * Math.PI * 2 - Math.PI / 2;
      ring.push({
        x: at.x + Math.cos(a) * d * 0.95,
        y: at.y + Math.sin(a) * d * 0.95,
        z: at.z + d * 0.3,
        r: d * 0.07,
      });
    }
    place(this.ring, ring);
  }
}
