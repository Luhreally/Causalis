// Work you can see, drawn (Phase 8 M78): what the people carry — a batch for each thing
// it is made of (the tools' wood and heads, straw, cloth, wicker, the catch, the ore, the
// packs' leather, the water) — the land's mine by its age, its oil derrick and its
// factory, the mine's cart running its track, the road's porters, pack beasts' loads,
// carts and lorries, and the smoke of hearths and works. Static works are placed once;
// what moves is posed afresh each frame from the view's pure functions.
import * as pc from "playcanvas";
import type { VillagePlan } from "../bridge/index.ts";
import {
  BEAST_SCALE,
  MATERIALS,
  SHEEN,
  TRAFFIC_PACE,
  cartAt,
  factoryPieces,
  figureOf,
  itemParts,
  materialColor,
  minePieces,
  smokeAt,
  travellerAt,
  wellPieces,
  type Carry,
  type FaunaSpecies,
  type Figure,
  type Material,
  type MinePiece,
  type Puff,
  type Traffic,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1; // units per metre, as the village's
const FLOATS = 8;

type Gathered = { batch: InstancedBatch; data: Float32Array; count: number };

/** Someone carrying something now: where (units), which way, what, and at what size. */
export type Carrier = { x: number; z: number; yaw: number; carry: Carry; size: number };

/** The works' pieces by what they are made of. */
function roleColor(role: MinePiece["role"], engines: boolean): Rgb {
  switch (role) {
    case "pit":
      return [0.1, 0.09, 0.08];
    case "spoil":
      return [0.4, 0.37, 0.33];
    case "shed":
      return [0.56, 0.41, 0.26];
    case "frame":
      return engines ? [0.27, 0.28, 0.31] : [0.42, 0.3, 0.18];
    case "wheel":
      return [0.22, 0.23, 0.25];
    case "engine":
    case "chimney":
      return [0.62, 0.3, 0.22];
    case "track":
      return [0.32, 0.32, 0.34];
    case "step":
      return [0.72, 0.7, 0.64];
    case "block":
      return [0.84, 0.82, 0.76];
  }
}

export class WorkLayer {
  private readonly stage: Stage;
  readonly root = new pc.Entity("work");
  private batches: InstancedBatch[] = [];
  private items = new Map<Material, Gathered>();
  private plan: VillagePlan | null = null;
  /** How high the people's figure stands against an upright ape's (items ride at its height). */
  private lift = 1;
  private cart: { body: Gathered; wheels: Gathered } | null = null;
  private road: {
    traffic: Traffic;
    beast: FaunaSpecies | null;
    walkers: Gathered[];
    walker: Figure;
    loads: Gathered;
    bodies: Gathered;
    cabs: Gathered;
    wheels: Gathered;
  } | null = null;
  private smoke: {
    light: Gathered;
    dark: Gathered;
    sources: { x: number; y: number; z: number; dark: number }[];
  } | null = null;
  private readonly puffs: Puff[] = [];
  private readonly box: pc.Mesh;
  private readonly wheel: pc.Mesh;
  private readonly heap: pc.Mesh;
  private readonly disc: pc.Mesh;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.box = boxMesh(stage);
    this.wheel = cylinderMesh(stage, 0.5, 1, 10);
    this.heap = coneMesh(stage, 0.5, 1, 7);
    this.disc = cylinderMesh(stage, 0.5, 1, 16);
    parent.addChild(this.root);
  }

  private gathered(
    color: Rgb,
    capacity: number,
    mesh = this.box,
    opacity = 1,
    sheen: { gloss: number; metal: boolean } | null = null,
  ): Gathered {
    const batch = new InstancedBatch(
      this.stage,
      mesh,
      color,
      Math.max(1, capacity),
      this.root,
      opacity < 1 || sheen
        ? flatMaterial(color, opacity, sheen?.gloss ?? 0.25, sheen?.metal ? 0.6 : sheen ? 0.25 : 0)
        : undefined,
    );
    this.batches.push(batch);
    return { batch, data: new Float32Array(Math.max(1, capacity) * FLOATS), count: 0 };
  }

  /** Static pieces, placed once: `at` their middle (metres), turned `yaw`. */
  private place(
    pieces: readonly MinePiece[],
    at: { x: number; z: number },
    yaw: number,
    engines: boolean,
  ): void {
    const byRole = new Map<MinePiece["role"], MinePiece[]>();
    for (const p of pieces) byRole.set(p.role, [...(byRole.get(p.role) ?? []), p]);
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    for (const [role, list] of byRole) {
      const mesh =
          role === "wheel"
            ? this.wheel
            : role === "pit"
              ? this.disc
              : role === "spoil"
                ? this.heap
                : this.box,
        g = this.gathered(roleColor(role, engines), list.length, mesh);
      for (const p of list)
        put(
          g,
          (at.x + p.x * c + p.z * s) * M,
          p.y * M,
          (at.z - p.x * s + p.z * c) * M,
          p.sx * M,
          p.sy * M,
          p.sz * M,
          yaw + p.yaw,
          // (A wheel's axis lies along the ground.)
          p.pitch + (role === "wheel" ? Math.PI / 2 : 0),
        );
      flush(g);
    }
  }

  /**
   * Lay out a village's works: the items its people may carry, its mine, derrick and
   * factory, the road's traffic (its beasts from the flocks), and the smoke's sources —
   * `hearths` (roof tops, metres) and `chimneys` (a city's workshops, metres).
   */
  build(
    plan: VillagePlan,
    q: { readonly detail: number; readonly motion: boolean },
    traffic: Traffic | null,
    species: readonly FaunaSpecies[],
    hearths: readonly { x: number; y: number; z: number }[],
    chimneys: readonly { x: number; y: number; z: number }[],
  ): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.items.clear();
    this.plan = plan;
    const figure = figureOf(plan.body),
      high = Math.max(...figure.parts.map((p) => p.y + p.sy / 2));
    this.lift = high / 0.55;
    const works = plan.works,
      engines = plan.era === "industry" || plan.era === "modern";
    // What they carry, a batch per material (two parts at most to a carrier).
    for (const m of MATERIALS)
      this.items.set(
        m,
        this.gathered(
          materialColor(m, plan.era, works?.mine?.what ?? null),
          plan.people.length * 2,
          this.box,
          1,
          SHEEN[m],
        ),
      );
    // The mine, the derrick and the factory, each facing the village.
    const facing = (p: { x: number; z: number }) => Math.atan2(-p.x, -p.z);
    if (works?.mine) this.place(minePieces(works.mine), works.mine, facing(works.mine), engines);
    if (works?.well) this.place(wellPieces(), works.well, facing(works.well), true);
    if (works?.factory) this.place(factoryPieces(), works.factory, facing(works.factory), true);
    this.cart =
      works?.mine?.kind === "shaft"
        ? {
            body: this.gathered([0.36, 0.3, 0.24], 1),
            wheels: this.gathered([0.2, 0.2, 0.22], 4, this.wheel),
          }
        : null;
    // The road's traffic.
    this.road = null;
    if (traffic && traffic.count > 0) {
      const walker = figure,
        n = traffic.count;
      this.road = {
        traffic,
        beast: traffic.species >= 0 ? (species[traffic.species] ?? null) : null,
        walker,
        walkers: [
          this.gathered([0.46, 0.4, 0.32], n * walker.parts.length),
          this.gathered([0.36, 0.3, 0.24], n * walker.parts.length),
          this.gathered([0.86, 0.66, 0.5], n * walker.parts.length),
        ],
        loads: this.gathered([0.5, 0.33, 0.2], n * 3),
        bodies: this.gathered(
          traffic.kind === "lorry" ? [0.3, 0.42, 0.72] : [0.5, 0.36, 0.22],
          n * 2,
        ),
        cabs: this.gathered([0.86, 0.22, 0.2], n),
        wheels: this.gathered([0.16, 0.16, 0.18], n * 4, this.wheel),
      };
    }
    // Smoke: some hearths (more as the setting allows), and every works' chimney.
    this.smoke = null;
    if (q.motion) {
      const most = [0, 6, 12, 20][q.detail] ?? 6,
        sources: { x: number; y: number; z: number; dark: number }[] = hearths
          .slice(0, most)
          .map((h) => ({ ...h, dark: 0 }));
      for (const c of chimneys) sources.push({ ...c, dark: 1 });
      const tall = (at: { x: number; z: number }, piece: MinePiece) => {
        const yaw = facing(at),
          c = Math.cos(yaw),
          s = Math.sin(yaw);
        sources.push({
          x: at.x + piece.x * c + piece.z * s,
          y: piece.y + piece.sy / 2,
          z: at.z - piece.x * s + piece.z * c,
          dark: 1,
        });
      };
      if (works?.mine?.kind === "shaft")
        for (const p of minePieces(works.mine)) if (p.role === "chimney") tall(works.mine, p);
      if (works?.factory)
        for (const p of factoryPieces()) if (p.role === "chimney") tall(works.factory, p);
      if (sources.length) {
        const count = sources.reduce((a, s) => a + (s.dark > 0.5 ? 6 : 4), 0);
        this.smoke = {
          light: this.gathered([0.9, 0.9, 0.92], count, this.box, 0.5),
          dark: this.gathered([0.22, 0.21, 0.22], count, this.box, 0.7),
          sources,
        };
      }
    }
  }

  /** Pose what moves: the carried things, the mine's cart, the road's traffic, the smoke. */
  update(hour: number, s: number, carriers: readonly Carrier[]): void {
    const plan = this.plan;
    if (!plan || !this.root.enabled) return;
    for (const g of this.items.values()) g.count = 0;
    for (const who of carriers) {
      const c = Math.cos(who.yaw),
        sn = Math.sin(who.yaw),
        k = who.size;
      for (const p of itemParts(who.carry)) {
        const px = p.x,
          pz = p.z;
        put(
          this.items.get(p.material)!,
          who.x + (px * c + pz * sn) * k,
          p.y * k * this.lift,
          who.z + (-px * sn + pz * c) * k,
          p.sx * k,
          p.sy * k,
          p.sz * k,
          who.yaw,
          p.pitch,
        );
      }
    }
    for (const g of this.items.values()) flush(g);
    // The mine's cart, out loaded along its track and back.
    if (this.cart && plan.works?.mine) {
      const mine = plan.works.mine,
        yaw = Math.atan2(-mine.x, -mine.z),
        c = Math.cos(yaw),
        sn = Math.sin(yaw),
        f = cartAt(s),
        lx = 2 + 17 * f,
        lz = -0.5 - 5 * f,
        x = mine.x + lx * c + lz * sn,
        z = mine.z - lx * sn + lz * c,
        along = yaw + 0.27 + Math.PI / 2;
      this.cart.body.count = this.cart.wheels.count = 0;
      put(this.cart.body, x * M, 0.16, z * M, 0.16, 0.12, 0.24, along, 0);
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          put(
            this.cart.wheels,
            (x + Math.sin(along) * b * 0.8 + Math.cos(along) * a * 0.8) * M,
            0.05,
            (z + Math.cos(along) * b * 0.8 - Math.sin(along) * a * 0.8) * M,
            0.1,
            0.03,
            0.1,
            along + Math.PI / 2,
            Math.PI / 2,
          );
      flush(this.cart.body);
      flush(this.cart.wheels);
    }
    if (this.road) this.traffic(s);
    // Smoke.
    if (this.smoke) {
      const { light, dark, sources } = this.smoke;
      light.count = dark.count = 0;
      const n = smokeAt(sources, hour, s, this.puffs);
      for (let i = 0; i < n; i++) {
        const p = this.puffs[i]!,
          size = p.size * M;
        put(p.dark > 0.5 ? dark : light, p.x * M, p.y * M, p.z * M, size, size * 0.8, size, i, 0);
      }
      flush(light);
      flush(dark);
    }
  }

  private traffic(s: number): void {
    const r = this.road!,
      { traffic, walker } = r,
      scale = walker.scale,
      stride = s * 1.6 * 2 * Math.PI;
    for (const g of [...r.walkers, r.loads, r.bodies, r.cabs, r.wheels]) g.count = 0;
    for (let k = 0; k < traffic.count; k++) {
      const t = travellerAt(traffic.way, k, s, TRAFFIC_PACE[traffic.kind]),
        c = Math.cos(t.yaw),
        sn = Math.sin(t.yaw),
        x = t.x * M,
        z = t.z * M,
        rel = (px: number, pz: number) => ({ x: x + px * c + pz * sn, z: z - px * sn + pz * c });
      if (traffic.kind === "lorry") {
        // A lorry: its bed, its cab before it, four wheels.
        const bed = rel(0, -0.25),
          cab = rel(0, 0.42);
        put(r.bodies, bed.x, 0.26, bed.z, 0.5, 0.36, 0.95, t.yaw, 0);
        put(r.cabs, cab.x, 0.25, cab.z, 0.48, 0.34, 0.34, t.yaw, 0);
        for (const [a, b] of [
          [-1, 0.4],
          [1, 0.4],
          [-1, -0.5],
          [1, -0.5],
        ] as const) {
          const w = rel(a * 0.26, b);
          put(r.wheels, w.x, 0.1, w.z, 0.2, 0.08, 0.2, t.yaw + Math.PI / 2, Math.PI / 2);
        }
        continue;
      }
      // Whoever walks with it (a driver sits on a cart).
      const onCart = traffic.kind === "cart";
      walker.parts.forEach((part) => {
        const pitch = !onCart && part.swing ? part.swing * Math.sin(stride + k * 1.7) : 0,
          hinge = part.pivot ?? 0,
          dy = hinge - hinge * Math.cos(pitch),
          dz = -hinge * Math.sin(pitch),
          at = rel(
            part.x * scale + (onCart ? 0 : 0.3),
            (part.z + dz) * scale + (onCart ? -0.1 : 0),
          );
        put(
          r.walkers[part.tone]!,
          at.x,
          (part.y + dy) * scale + (onCart ? 0.2 : 0),
          at.z,
          part.sx * scale,
          part.sy * scale,
          part.sz * scale,
          t.yaw,
          pitch,
        );
      });
      if (traffic.kind === "porter") {
        // A porter's pack on their back.
        const pack = rel(0.3, -0.1 * scale);
        put(
          r.loads,
          pack.x,
          0.38 * scale * this.lift,
          pack.z,
          0.17 * scale,
          0.22 * scale,
          0.12 * scale,
          t.yaw,
          0,
        );
      }
      const beast = r.beast;
      if (traffic.kind === "pack" && beast) {
        // Panniers across the beast's back, a few paces ahead.
        const b = beast.body,
          back = (b.p.leg + b.p.body[1]) * b.k,
          at = rel(0, 3.5 * M);
        for (const side of [-1, 1]) {
          const bag = {
            x: at.x + side * c * b.p.body[0] * b.k * 0.7,
            z: at.z - side * sn * b.p.body[0] * b.k * 0.7,
          };
          put(
            r.loads,
            bag.x,
            back - 0.02,
            bag.z,
            b.p.body[0] * b.k * 0.5,
            b.p.body[1] * b.k * 0.7,
            b.p.body[2] * b.k * 0.45,
            t.yaw,
            0,
          );
        }
      }
      if (onCart) {
        // A cart behind its beast: its box, its load, two wheels.
        const box = rel(0, 0),
          k = BEAST_SCALE;
        put(r.bodies, box.x, 0.9 * k, box.z, 1.5 * k, 0.6 * k, 2.2 * k, t.yaw, 0);
        put(r.loads, box.x, 1.35 * k, box.z, 1.2 * k, 0.4 * k, 1.8 * k, t.yaw, 0);
        for (const a of [-1, 1]) {
          const w = rel(a * 0.85 * k, 0);
          put(
            r.wheels,
            w.x,
            0.6 * k,
            w.z,
            1.2 * k,
            0.12 * k,
            1.2 * k,
            t.yaw + Math.PI / 2,
            Math.PI / 2,
          );
        }
      }
    }
    for (const g of [...r.walkers, r.loads, r.bodies, r.cabs, r.wheels]) flush(g);
  }

  destroy(): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.plan = null;
  }
}

function put(
  g: Gathered,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  yaw: number,
  pitch: number,
): void {
  if (g.count >= g.batch.capacity) return;
  const o = g.count++ * FLOATS,
    d = g.data;
  d[o] = x;
  d[o + 1] = y;
  d[o + 2] = z;
  d[o + 3] = sx;
  d[o + 4] = sy;
  d[o + 5] = sz;
  d[o + 6] = yaw;
  d[o + 7] = pitch;
}

function flush(g: Gathered): void {
  const d = g.data;
  g.batch.set(g.count, (i, out) => {
    const o = i * FLOATS;
    for (let k = 0; k < FLOATS; k++) out[k] = d[o + k]!;
  });
}
