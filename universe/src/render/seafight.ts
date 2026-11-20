// A meeting of fleets drawn (view/seafight.ts lays it out): the sea in its world's colour, each side's hulls in the stuff its
// wrights build of (wood, or metal from its works) with a strake and sails in its colour, masts, oars, funnels and turrets as
// its kind has them, its flagship with a pennant at her mast, the smoke of guns and of funnels, the white where shot falls.
// Sixteen instanced batches at the most whatever the fleets' size, their matrices written each frame from one small table of
// parts made when the meeting is set up; nothing is made while it plays.
import * as pc from "playcanvas";
import {
  SEA_SHIPS,
  seaHullAt,
  type SeaField,
  type SeaHull,
  type SeaHullNow,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, facetedMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import { kindSea } from "./globe.ts";

/** A hull a unit long (its bow at +z), a unit in the beam at its deck and a unit deep: pointed forward, narrower at the keel. */
const HULL = {
  corners: [
    [-0.4, 0.5, -0.5],
    [0.4, 0.5, -0.5],
    [0.5, 0.5, 0.1],
    [0, 0.5, 0.5],
    [-0.5, 0.5, 0.1],
    [-0.25, -0.5, -0.45],
    [0.25, -0.5, -0.45],
    [0.3, -0.5, 0.1],
    [0, -0.5, 0.38],
    [-0.3, -0.5, 0.1],
  ],
  faces: [
    [0, 4, 3, 2, 1],
    [5, 6, 7, 8, 9],
    [0, 1, 6, 5],
    [1, 2, 7, 6],
    [2, 3, 8, 7],
    [3, 4, 9, 8],
    [4, 0, 5, 9],
  ],
} as const;

const WOOD: Rgb = [0.38, 0.26, 0.15],
  METAL: Rgb = [0.44, 0.47, 0.5],
  SPAR: Rgb = [0.2, 0.15, 0.1],
  CANVAS: Rgb = [0.9, 0.87, 0.78];

function selfLit(color: Rgb, opacity = 1): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(color[0], color[1], color[2]);
  if (opacity < 1) {
    m.opacity = opacity;
    m.blendType = pc.BLEND_NORMAL;
    m.depthWrite = false;
  }
  m.update();
  return m;
}

/** A part of a hull: which hull, where on her (across, up, along; units), its size, and whether it sways as canvas does. */
type Part = {
  hull: number;
  dx: number;
  dy: number;
  dz: number;
  sx: number;
  sy: number;
  sz: number;
};

const MOST = 24;
/** How high the sea stands over the stage's middle. */
export const SEA_UP = 4;

export class SeaLayer {
  readonly root = new pc.Entity("sea fight");
  private readonly stage: Stage;
  private readonly sea: InstancedBatch;
  private readonly hulls: [InstancedBatch, InstancedBatch];
  private readonly strakes: [InstancedBatch, InstancedBatch];
  private readonly sails: [InstancedBatch, InstancedBatch];
  private readonly spars: InstancedBatch;
  private readonly works: InstancedBatch;
  private readonly pennants: InstancedBatch;
  private readonly wakes: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly soot: InstancedBatch;
  private readonly flash: InstancedBatch;
  private readonly splash: InstancedBatch;
  private field: SeaField | null = null;
  private now: SeaHullNow[] = [];
  private parts: { batch: InstancedBatch; list: Part[] }[] = [];
  private funnels: Part[] = [];
  /** What was last drawn (a check reads it). */
  shown = { hulls: 0, afloat: 0, sails: 0, smoke: 0, pennants: 0 };

  constructor(stage: Stage) {
    this.stage = stage;
    stage.root.addChild(this.root);
    // (Stood over whatever the world's own scene leaves drawn at its middle: the sea's sheet hides it.)
    this.root.setLocalPosition(0, SEA_UP, 0);
    this.root.enabled = false;
    const box = boxMesh(stage),
      hull = keptMesh(facetedMesh(stage, HULL)),
      batch = (mesh: pc.Mesh, color: Rgb, n: number, material?: pc.Material) =>
        new InstancedBatch(stage, mesh, color, n, this.root, material);
    this.sea = batch(box, [0.08, 0.28, 0.62], 1, flatMaterial([0.08, 0.28, 0.62], 1, 0.7, 0.25));
    this.sea.shadows(false);
    this.hulls = [batch(hull, WOOD, MOST), batch(hull, WOOD, MOST)];
    this.strakes = [batch(box, WOOD, MOST * 2), batch(box, WOOD, MOST * 2)];
    this.sails = [batch(box, CANVAS, MOST * 4), batch(box, CANVAS, MOST * 4)];
    this.spars = batch(box, SPAR, MOST * 2 * 10);
    this.works = batch(box, [0.2, 0.2, 0.22], MOST * 2 * 4);
    this.pennants = batch(box, [1, 0.8, 0.2], 4, selfLit([1, 0.82, 0.25]));
    this.wakes = batch(box, [0.8, 0.88, 0.92], MOST * 2, selfLit([0.82, 0.9, 0.94], 0.45)).shadows(
      false,
    );
    this.smoke = batch(box, [0.9, 0.9, 0.88], MOST * 2, selfLit([0.88, 0.88, 0.86], 0.7)).shadows(
      false,
    );
    this.soot = batch(box, [0.2, 0.2, 0.2], MOST * 2 * 6, selfLit([0.16, 0.16, 0.17], 0.6)).shadows(
      false,
    );
    this.flash = batch(box, [1, 0.7, 0.2], MOST * 2, selfLit([1, 0.74, 0.25])).shadows(false);
    this.splash = batch(box, [1, 1, 1], MOST * 2, selfLit([0.95, 0.97, 1], 0.8)).shadows(false);
  }

  get visible(): boolean {
    return this.root.enabled;
  }
  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** A meeting to draw (null: none). */
  setup(field: SeaField | null): void {
    this.field = field;
    this.parts = [];
    this.funnels = [];
    if (!field) {
      this.root.enabled = false;
      return;
    }
    const near = field.near,
      water = kindSea(near.kind);
    this.sea.recolor(water);
    this.sea.set(1, (_, o) => {
      o[0] = 0;
      o[1] = -0.06;
      o[2] = 0;
      o[3] = 900;
      o[4] = 0.1;
      o[5] = 900;
    });
    this.now = field.hulls.map(() => ({ x: 0, z: 0, yaw: 0, sunk: 0, tip: 0, fired: -1 }));
    const hullsOf: [Part[], Part[]] = [[], []],
      strakes: [Part[], Part[]] = [[], []],
      sails: [Part[], Part[]] = [[], []],
      spars: Part[] = [],
      works: Part[] = [],
      pennants: Part[] = [];
    for (const side of [0, 1] as const) {
      const s = near.sides[side],
        c = s.color,
        metal = s.rig === "works";
      this.hulls[side].recolor(metal ? METAL : WOOD);
      this.strakes[side].recolor([c[0], c[1], c[2]]);
      // (Canvas in its colour, lightened: a sail is seen from far.)
      this.sails[side].recolor([
        c[0] * 0.75 + CANVAS[0] * 0.25,
        c[1] * 0.75 + CANVAS[1] * 0.25,
        c[2] * 0.75 + CANVAS[2] * 0.25,
      ]);
    }
    field.hulls.forEach((h, i) => {
      const kind = SEA_SHIPS[near.sides[h.side].rig],
        L = h.long,
        beam = L * (kind.oars ? 0.2 : 0.27),
        deep = L * (kind.turrets ? 0.2 : 0.24),
        deck = deep * 0.62;
      hullsOf[h.side].push({ hull: i, dx: 0, dy: deep * 0.12, dz: 0, sx: beam, sy: deep, sz: L });
      // Her side's colour along her rail, both boards.
      for (const b of [-1, 1])
        strakes[h.side].push({
          hull: i,
          dx: b * beam * 0.47,
          dy: deck + 0.01,
          dz: -L * 0.12,
          sx: beam * 0.1,
          sy: deep * 0.16,
          sz: L * 0.62,
        });
      // Her masts, each with its yard and its sail square to her course.
      for (let m = 0; m < kind.masts; m++) {
        const dz = kind.masts === 1 ? L * 0.05 : L * (-0.3 + (0.62 * m) / (kind.masts - 1)),
          tall = L * (kind.funnels ? 0.5 : 0.66) * (m === 1 || kind.masts === 1 ? 1 : 0.84);
        spars.push({ hull: i, dx: 0, dy: deck + tall / 2, dz, sx: 0.045, sy: tall, sz: 0.045 });
        sails[h.side].push({
          hull: i,
          dx: 0,
          dy: deck + tall * 0.56,
          dz: dz + 0.05,
          sx: beam * 1.9,
          sy: tall * 0.62,
          sz: 0.04,
        });
      }
      // Her oars, a bank a board.
      if (kind.oars)
        for (const b of [-1, 1])
          for (let k = 0; k < 4; k++)
            spars.push({
              hull: i,
              dx: b * beam * 0.95,
              dy: deck * 0.5,
              dz: L * (-0.28 + 0.16 * k),
              sx: beam * 0.95,
              sy: 0.025,
              sz: 0.03,
            });
      for (let f = 0; f < kind.funnels; f++) {
        const part = {
          hull: i,
          dx: 0,
          dy: deck + L * 0.11,
          dz: L * (kind.funnels === 1 ? -0.02 : -0.1 + 0.2 * f),
          sx: L * 0.06,
          sy: L * 0.22,
          sz: L * 0.07,
        };
        works.push(part);
        this.funnels.push(part);
      }
      for (let t = 0; t < kind.turrets; t++)
        works.push({
          hull: i,
          dx: 0,
          dy: deck + L * 0.035,
          dz: L * (t ? 0.3 : -0.32),
          sx: beam * 0.6,
          sy: L * 0.07,
          sz: L * 0.13,
        });
      // (A ship of metal: her house amidships in her side's colour.)
      if (kind.turrets)
        strakes[h.side].push({
          hull: i,
          dx: 0,
          dy: deck + L * 0.05,
          dz: L * 0.12,
          sx: beam * 0.5,
          sy: L * 0.1,
          sz: L * 0.16,
        });
      if (h.flag) {
        const high = deck + L * (kind.masts ? 0.74 : 0.42);
        if (!kind.masts)
          spars.push({
            hull: i,
            dx: 0,
            dy: deck + L * 0.2,
            dz: 0,
            sx: 0.045,
            sy: L * 0.4,
            sz: 0.045,
          });
        pennants.push({
          hull: i,
          dx: 0,
          dy: high,
          dz: -L * 0.13,
          sx: 0.05,
          sy: L * 0.1,
          sz: L * 0.3,
        });
      }
    });
    this.parts = [
      { batch: this.hulls[0], list: hullsOf[0] },
      { batch: this.hulls[1], list: hullsOf[1] },
      { batch: this.strakes[0], list: strakes[0] },
      { batch: this.strakes[1], list: strakes[1] },
      { batch: this.sails[0], list: sails[0] },
      { batch: this.sails[1], list: sails[1] },
      { batch: this.spars, list: spars },
      { batch: this.works, list: works },
      { batch: this.pennants, list: pennants },
    ];
    this.shown.sails = sails[0].length + sails[1].length;
    this.shown.pennants = pennants.length;
    this.root.enabled = true;
  }

  /** Where a hull stands now (the last frame drawn), for the eye and the flags. */
  hullNow(i: number): SeaHullNow | null {
    return this.now[i] ?? null;
  }

  /** Where on the screen a point over a hull is (null: behind the eye). */
  onScreen(i: number, high: number): { x: number; y: number } | null {
    const n = this.now[i];
    if (!n) return null;
    const s = this.stage.camera.camera!.worldToScreen(new pc.Vec3(n.x, high + SEA_UP, n.z));
    return s.z > 0 ? { x: s.x, y: s.y } : null;
  }

  /** Draw it at a moment of the meeting; `wall` is the eye's own clock (s), for the swell. */
  update(s: number, wall: number): void {
    const field = this.field;
    if (!field) return;
    const hulls = field.hulls,
      now = this.now;
    let afloat = 0;
    for (let i = 0; i < hulls.length; i++) {
      seaHullAt(field, hulls[i]!, s, now[i]!);
      if (now[i]!.sunk < 1) afloat++;
    }
    const swell = (i: number) => 0.03 * Math.sin(wall * 1.3 + i * 1.7);
    for (const { batch, list } of this.parts)
      batch.set(list.length, (k, o) => {
        const p = list[k]!,
          n = now[p.hull]!,
          h = hulls[p.hull]!,
          // (Her bow lifts as she settles by the stern; gone, she is drawn no more.)
          tip = -n.tip - 0.025 * Math.sin(wall * 1.1 + p.hull),
          ct = Math.cos(tip),
          st = Math.sin(tip),
          y = p.dy * ct - p.dz * st,
          z = p.dy * st + p.dz * ct,
          turn = Math.PI / 2 - n.yaw,
          c = Math.cos(turn),
          sn = Math.sin(turn),
          gone = n.sunk >= 1 ? 0 : 1;
        o[0] = n.x + p.dx * c + z * sn;
        o[1] = y + swell(p.hull) - n.sunk * h.long * 0.42;
        o[2] = n.z - p.dx * sn + z * c;
        o[3] = p.sx * gone;
        o[4] = p.sy * gone;
        o[5] = p.sz * gone;
        o[6] = turn;
        o[7] = tip;
      });
    // Her wake astern while she has way on her.
    this.wakes.set(hulls.length, (i, o) => {
      const n = now[i]!,
        h = hulls[i]!,
        way = n.sunk > 0 ? 0 : 1;
      o[0] = n.x - Math.cos(n.yaw) * h.long * 0.95;
      o[1] = 0.01;
      o[2] = n.z - Math.sin(n.yaw) * h.long * 0.95;
      o[3] = h.long * 0.16 * way;
      o[4] = 0.01;
      o[5] = h.long * 0.9 * way;
      o[6] = Math.PI / 2 - n.yaw;
    });
    // Her guns' smoke rolling off her engaged side, the flash under it, and the white where her shot falls.
    let smoking = 0;
    this.smoke.set(hulls.length, (i, o) => {
      const n = now[i]!,
        h = hulls[i]!,
        on = n.fired >= 0 && n.fired < 2.6,
        to = h.side ? -1 : 1,
        size = on ? 0.22 + n.fired * 0.34 : 0;
      if (on) smoking++;
      o[0] = n.x - n.fired * 0.25;
      o[1] = h.long * 0.16 + n.fired * 0.22;
      o[2] = n.z + to * (h.long * 0.2 + n.fired * 0.5);
      o[3] = size * 1.6;
      o[4] = size;
      o[5] = size;
      o[6] = i;
    });
    this.flash.set(hulls.length, (i, o) => {
      const n = now[i]!,
        h = hulls[i]!,
        // (A gun's flash; and a hull burning as she goes down.)
        on = n.fired >= 0 && n.fired < 0.16,
        burns = n.sunk > 0 && n.sunk < 0.7 && Math.sin(wall * 17 + i) > -0.2,
        to = h.side ? -1 : 1;
      o[0] = n.x;
      o[1] = h.long * (burns ? 0.22 : 0.14);
      o[2] = n.z + (on ? to * h.long * 0.2 : 0);
      o[3] = on ? h.long * 0.5 : burns ? h.long * 0.3 : 0;
      o[4] = on ? 0.08 : burns ? h.long * 0.22 * (1 - n.sunk) : 0;
      o[5] = on ? 0.12 : burns ? h.long * 0.12 : 0;
      o[6] = Math.PI / 2 - n.yaw;
    });
    this.splash.set(hulls.length, (i, o) => {
      const n = now[i]!,
        h = hulls[i]!,
        age = n.fired - 0.5,
        on = age >= 0 && age < 0.8,
        to = h.side ? -1 : 1,
        rise = on ? Math.sin((age / 0.8) * Math.PI) : 0;
      o[0] = n.x + ((i * 37) % 11) * 0.12 - 0.6;
      o[1] = rise * 0.35;
      o[2] = n.z + to * field.gap * (0.82 + ((i * 13) % 7) * 0.05);
      o[3] = on ? 0.12 : 0;
      o[4] = rise * 0.7;
      o[5] = on ? 0.12 : 0;
    });
    // Her funnels' smoke, trailing astern and rising.
    const funnels = this.funnels;
    this.soot.set(funnels.length * 3, (k, o) => {
      const p = funnels[(k / 3) | 0]!,
        n = now[p.hull]!,
        age = (k % 3) / 3 + ((wall * 0.35 + p.hull * 0.37) % (1 / 3)),
        size = n.sunk > 0 ? 0 : 0.12 + age * 0.5,
        turn = Math.PI / 2 - n.yaw,
        back = p.dz - age * 2.4;
      o[0] = n.x + back * Math.sin(turn);
      o[1] = p.dy + p.sy * 0.5 + age * 1.3;
      o[2] = n.z + back * Math.cos(turn);
      o[3] = size;
      o[4] = size;
      o[5] = size;
      o[6] = k;
    });
    this.shown.hulls = hulls.length;
    this.shown.afloat = afloat;
    this.shown.smoke = smoking;
  }
}
