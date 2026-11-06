// A road being laid, on the land (R1): its gang at the head of the work, large enough to be picked out from the land's nearest eye; heaps of what it is
// laid with along the way ahead, its line pegged out past them, and the last of it laid stone by stone or length by length. The gang fetches and sets
// while the clock runs at a pace the eye can follow, stands while it is held, and stands in a knot when something has stopped it. Where a road is cut, a
// heap of rubble and the broken ends. Drawn in a few batches by mesh and colour; what stands put once as the work moves on, the hands put each frame.
import * as pc from "playcanvas";
import {
  alongWay,
  cutLine,
  floorAt,
  groundAt,
  wayOf,
  type LandGround,
  type Way,
} from "../view/index.ts";
import { InstancedBatch } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

type Mesh = "box" | "gable" | "cone" | "cyl";

/** How much larger than life a hand is drawn: the land's nearest eye is twelve units off. */
const LARGE = 3;
/** How far behind the head its last laying is drawn piece by piece (region units), and how many pieces. */
const LAYING = 0.5;
const SETTS = 14;
/** How high over the ground a laid thing's foot stands. */
const ON = 0.012;

const POLE: Rgb = [0.24, 0.17, 0.11],
  FLAG: Rgb = [0.95, 0.5, 0.08],
  STAKE: Rgb = [0.94, 0.9, 0.72],
  TENT: Rgb = [0.84, 0.78, 0.62],
  CLOTH: Rgb = [0.62, 0.45, 0.28],
  VEST: Rgb = [0.96, 0.62, 0.1],
  HEAD: Rgb = [0.86, 0.74, 0.6],
  MACHINE: Rgb = [0.88, 0.68, 0.12],
  DARK: Rgb = [0.15, 0.15, 0.16],
  RUBBLE: Rgb = [0.3, 0.27, 0.24],
  BARRIER: Rgb = [0.82, 0.16, 0.12];

/** One road's works as the land lays them. */
export type WorksSite = {
  readonly ref: string;
  readonly line: readonly { readonly x: number; readonly z: number }[];
  readonly share: number;
  readonly what: "track" | "paved" | "rails";
  readonly colour: Rgb;
  readonly machines: boolean;
  readonly hands: number;
  readonly stopped: boolean;
  /** Mended where it was cut, not laid. */
  readonly cut: boolean;
};

type Hand = {
  readonly way: Way;
  readonly from: number;
  readonly to: number;
  readonly aside: number;
  readonly start: number;
  readonly stone: Rgb;
  readonly bar: boolean;
  readonly still: boolean;
};
type Slot = { batch: InstancedBatch; data: number[]; mesh: Mesh; color: Rgb };

const key = (mesh: Mesh, c: Rgb) =>
  `${mesh}|${c[0].toFixed(3)}|${c[1].toFixed(3)}|${c[2].toFixed(3)}`;

export class LandWorks {
  private readonly stage: Stage;
  private readonly root: pc.Entity;
  private readonly meshes: Readonly<Record<Mesh, pc.Mesh>>;
  /** Those that stand, and those moved each frame: by mesh and colour. */
  private readonly still = new Map<string, Slot>();
  private readonly moving = new Map<string, Slot>();
  private hands: Hand[] = [];
  private heads: { ref: string; x: number; y: number; z: number; stopped: boolean }[] = [];
  private gone = 0;
  private last = 0;
  private drawn = false;
  private ground: LandGround | null = null;
  private at: (g: LandGround, x: number, z: number) => number = groundAt;

  constructor(stage: Stage, root: pc.Entity, meshes: Readonly<Record<Mesh, pc.Mesh>>) {
    this.stage = stage;
    this.root = root;
    this.meshes = meshes;
  }

  private slot(into: Map<string, Slot>, mesh: Mesh, color: Rgb): Slot {
    const k = key(mesh, color);
    let s = into.get(k);
    if (!s) {
      s = {
        batch: new InstancedBatch(
          this.stage,
          this.meshes[mesh],
          [color[0], color[1], color[2]],
          32,
          this.root,
        ),
        data: [],
        mesh,
        color,
      };
      into.set(k, s);
    }
    return s;
  }

  private flush(into: Map<string, Slot>): void {
    for (const [k, s] of into) {
      const n = s.data.length / 8;
      if (n > s.batch.capacity) {
        s.batch.destroy();
        s.batch = new InstancedBatch(
          this.stage,
          this.meshes[s.mesh],
          [s.color[0], s.color[1], s.color[2]],
          Math.ceil(n * 1.4),
          this.root,
        );
      }
      const d = s.data;
      s.batch.set(n, (i, o) => {
        const q = i * 8;
        for (let j = 0; j < 8; j++) o[j] = d[q + j]!;
      });
      void k;
    }
  }

  /** The works standing on this land: laid again whenever one moves on a section. */
  set(
    sites: readonly WorksSite[],
    g: LandGround,
    at: (g: LandGround, x: number, z: number) => number,
    undersea: boolean,
  ): void {
    this.ground = g;
    this.at = undersea ? floorAt : at;
    for (const s of this.still.values()) s.data.length = 0;
    this.hands = [];
    this.heads = [];
    const put = (
      mesh: Mesh,
      c: Rgb,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      yaw = 0,
    ) => this.slot(this.still, mesh, c).data.push(x, y + sy / 2, z, sx, sy, sz, yaw, 0);
    for (const site of sites) {
      const [behind, ahead] = cutLine(site.line, site.share),
        wayAhead = wayOf(ahead.length >= 2 ? ahead : [...site.line].slice(-2)),
        wayBehind = wayOf(behind.length >= 2 ? [...behind].reverse() : [...site.line].slice(0, 2)),
        head = alongWay(wayAhead, 0),
        y = (x: number, z: number) => this.at(g, x, z);
      this.heads.push({
        ref: site.ref,
        x: head.x,
        y: y(head.x, head.z),
        z: head.z,
        stopped: site.stopped,
      });
      const yaw = head.yaw,
        c = Math.cos(yaw),
        s = Math.sin(yaw),
        beside = (d: number, along: number) => ({
          x: head.x + s * along + c * d,
          z: head.z + c * along - s * d,
        });
      // Its flag, seen from afar; its shelter off the road.
      put("box", POLE, head.x + c * 0.2, y(head.x, head.z), head.z - s * 0.2, 0.02, 0.56, 0.02);
      put(
        "box",
        FLAG,
        head.x + c * 0.2 + s * 0.05,
        y(head.x, head.z) + 0.44,
        head.z - s * 0.2 + c * 0.08,
        0.014,
        0.12,
        0.17,
        yaw,
      );
      const tent = beside(-0.36, -0.1);
      put("gable", TENT, tent.x, y(tent.x, tent.z), tent.z, 0.22, 0.12, 0.17, yaw);
      if (site.cut) {
        // The broken ends and the rubble between.
        for (const d of [-0.34, 0, 0.34]) {
          const q = alongWay(wayAhead, Math.max(0, d) + 0.02),
            p = d < 0 ? alongWay(wayBehind, -d) : q;
          put("cone", RUBBLE, p.x + c * 0.03, y(p.x, p.z), p.z - s * 0.03, 0.24, 0.1, 0.24);
          put("box", BARRIER, p.x, y(p.x, p.z) + 0.05, p.z, 0.16, 0.024, 0.02, yaw + Math.PI / 2);
        }
      } else {
        // Heaps along the way ahead, of what it is laid with, and the line pegged out past them.
        for (const d of [0.14, 0.34, 0.6, 0.92]) {
          const p = alongWay(
            wayAhead,
            Math.min(d, wayAhead.length),
            site.what === "rails" ? 0.13 : 0.09,
          );
          if (site.what === "rails") {
            // (Lengths stacked: metal by metal.)
            for (let k = 0; k < 3; k++)
              put(
                "box",
                site.colour,
                p.x + c * k * 0.022,
                y(p.x, p.z) + ON + k * 0.008,
                p.z - s * k * 0.022,
                0.018,
                0.016,
                0.3,
                yaw,
              );
          } else put("cone", site.colour, p.x, y(p.x, p.z), p.z, 0.3, 0.15, 0.3);
        }
        // (Its line pegged out ahead: stakes, and the cord between them.)
        for (let k = 3; k < 14 && k * 0.34 < wayAhead.length; k++) {
          const p = alongWay(wayAhead, k * 0.34),
            q = alongWay(wayAhead, (k + 0.5) * 0.34);
          put("box", STAKE, p.x, y(p.x, p.z), p.z, 0.022, 0.1, 0.022);
          put("box", STAKE, q.x, y(q.x, q.z) + ON, q.z, 0.012, 0.006, 0.3, q.yaw);
        }
        // The last of it, laid piece by piece behind the head.
        const wide = site.what === "track" ? 0.06 : 0.09;
        for (let k = 0; k < SETTS; k++) {
          const along = (k + 0.5) * (LAYING / SETTS);
          if (along > wayBehind.length) break;
          const p = alongWay(wayBehind, along);
          if (site.what === "rails")
            put("box", POLE, p.x, y(p.x, p.z) + ON, p.z, 0.075, 0.008, 0.016, p.yaw);
          else
            put(
              "box",
              site.colour,
              p.x,
              y(p.x, p.z) + ON,
              p.z,
              wide,
              0.01,
              (LAYING / SETTS) * (0.55 + (k / SETTS) * 0.4),
              p.yaw,
            );
        }
        if (site.what === "rails")
          for (const side of [-0.022, 0.022]) {
            const p = alongWay(wayBehind, LAYING / 2, side);
            put("box", site.colour, p.x, y(p.x, p.z) + ON + 0.008, p.z, 0.008, 0.01, LAYING, p.yaw);
          }
      }
      // Past the age of engines: a machine at the head, laying what the hands bring.
      if (site.machines && !site.cut) {
        const m = alongWay(wayBehind, 0.14);
        put("box", MACHINE, m.x, y(m.x, m.z) + ON, m.z, 0.09, 0.07, 0.17, m.yaw);
        put("box", DARK, m.x, y(m.x, m.z) + 0.07, m.z, 0.06, 0.05, 0.06, m.yaw);
        put(
          "cyl",
          DARK,
          alongWay(wayBehind, 0.03).x,
          y(m.x, m.z) + ON,
          alongWay(wayBehind, 0.03).z,
          0.07,
          0.05,
          0.07,
        );
      }
      // The hands: fetching from the heaps, each in turn; those stopped stand off the road.
      const n = Math.max(3, Math.min(site.stopped ? 8 : 16, site.hands));
      for (let k = 0; k < n; k++)
        this.hands.push({
          way: wayAhead,
          from: Math.min(wayAhead.length, 0.1 + (k % 4) * 0.12),
          to: -0.02,
          aside: ((k % 2) * 2 - 1) * (0.05 + (k % 3) * 0.025),
          start: k * 0.37,
          stone: site.colour,
          bar: site.what === "rails",
          still: site.stopped,
        });
    }
    this.flush(this.still);
    this.drawn = false;
  }

  /** The hands, where they have got to: on while the clock runs, standing while it is held. */
  move(running: boolean): void {
    const g = this.ground;
    if (!g) return;
    const wall = performance.now() / 1000;
    if (running && this.last) this.gone += Math.min(0.25, wall - this.last);
    this.last = wall;
    if (!running && this.drawn) return;
    this.drawn = true;
    for (const s of this.moving.values()) s.data.length = 0;
    const put = (
      mesh: Mesh,
      c: Rgb,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      yaw: number,
    ) => this.slot(this.moving, mesh, c).data.push(x, y + sy / 2, z, sx, sy, sz, yaw, 0);
    for (const h of this.hands) {
      // To and fro between heap and head, with a load one way; a moment bent at each end.
      const cycle = h.still ? 0.2 : (((h.start + this.gone * 0.22) % 1) + 1) % 1,
        out = cycle < 0.5,
        u = out ? cycle * 2 : 2 - cycle * 2,
        s = h.still ? 0.5 * h.from : h.to + (h.from - h.to) * (u * u * (3 - 2 * u)),
        p = alongWay(h.way, Math.max(0, s), h.still ? h.aside * 3.2 + 0.2 : h.aside),
        foot = this.at(g, p.x, p.z) + ON,
        bob = h.still ? 0 : Math.abs(Math.sin(this.gone * 7 + h.start * 9)) * 0.006 * LARGE,
        yaw = out ? p.yaw : p.yaw + Math.PI;
      put(
        "box",
        h.bar || !h.still ? CLOTH : VEST,
        p.x,
        foot + bob,
        p.z,
        0.02 * LARGE,
        0.034 * LARGE,
        0.014 * LARGE,
        yaw,
      );
      put(
        "box",
        HEAD,
        p.x,
        foot + bob + 0.034 * LARGE,
        p.z,
        0.013 * LARGE,
        0.013 * LARGE,
        0.013 * LARGE,
        yaw,
      );
      if (!h.still && !out) {
        // Bringing it: a stone on the shoulder, a length of rail between two.
        const len = h.bar ? 0.12 : 0.024;
        put("box", h.stone, p.x, foot + bob + 0.05 * LARGE, p.z, 0.018, 0.016, len, p.yaw);
      }
    }
    this.flush(this.moving);
  }

  /** Where a road's gang is (region units), or null. */
  head(ref: string): { x: number; y: number; z: number } | null {
    const h = this.heads.find((x) => x.ref === ref);
    return h ? { x: h.x, y: h.y, z: h.z } : null;
  }

  /** The gangs on the land and where on the screen each stands. */
  gangs(cam: pc.CameraComponent): { ref: string; x: number; y: number; stopped: boolean }[] {
    const at = new pc.Vec3(),
      out = new pc.Vec3(),
      list: { ref: string; x: number; y: number; stopped: boolean }[] = [];
    for (const h of this.heads) {
      at.set(h.x, h.y + 0.08, h.z);
      cam.worldToScreen(at, out);
      if (out.z > 0) list.push({ ref: h.ref, x: out.x, y: out.y, stopped: h.stopped });
    }
    return list;
  }

  /** The gang nearest a point of the screen, within a finger's reach. */
  pick(cam: pc.CameraComponent, x: number, y: number, reach = 34): string | null {
    let best: string | null = null,
      most = reach * reach;
    for (const g of this.gangs(cam)) {
      const d = (g.x - x) ** 2 + (g.y - y) ** 2;
      if (d < most) {
        most = d;
        best = g.ref;
      }
    }
    return best;
  }

  /** What is drawn (the look tools): gangs, hands, heaps and all parts. */
  info(): { gangs: number; hands: number; parts: number } {
    let parts = 0;
    for (const s of this.still.values()) parts += s.data.length / 8;
    for (const s of this.moving.values()) parts += s.data.length / 8;
    return { gangs: this.heads.length, hands: this.hands.length, parts };
  }

  clear(): void {
    this.hands = [];
    this.heads = [];
    for (const m of [this.still, this.moving])
      for (const s of m.values()) {
        s.data.length = 0;
        s.batch.set(0, () => {});
      }
    this.drawn = false;
  }

  destroy(): void {
    for (const m of [this.still, this.moving]) {
      for (const s of m.values()) s.batch.destroy();
      m.clear();
    }
  }
}

