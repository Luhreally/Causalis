// What goes on a land's ground that no one drives (Z1): its herds crossing the map in their season and gone in another, each beast a few boxes of its own coat and
// shape, its kind's dens and burrows on the ground, a beast at large about the town that knows it. Where they are is a reading of the moment of the year; none of it
// is kept. Drawn at a size the eye can tell at the zoom it is at: a beast is a symbol on a map, as a town's name is, not a thing to scale.
import * as pc from "playcanvas";
import type { LandHerds, LandHerd } from "../bridge/index.ts";
import {
  buildBody,
  coatOf,
  floorAt,
  posed,
  type BeastPart,
  groundAt,
  herdPassAt as passAt,
  tileMiddle,
  type LandGround,
} from "../view/index.ts";
import { InstancedBatch, beastMeshes } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

type Part = {
  readonly tone: "coat" | "dark" | "horn";
  readonly along: number;
  readonly aside: number;
  readonly up: number;
  readonly len: number;
  readonly wide: number;
  readonly tall: number;
  /** An alien beast's part (B1): its shape (view/creature.ts BEAST_SHAPES), its tip and turn. */
  readonly shape?: number;
  readonly pitch?: number;
  readonly yaw?: number;
};

type Body = {
  readonly features?: readonly string[];
  readonly legs?: number;
  readonly wings?: number;
  readonly fins?: number;
  readonly neck?: number;
  readonly tail?: number;
  readonly moves?: string;
};

const POSED: BeastPart[] = [];

/** A beast's parts, a unit long: read off its body, so a slither has no legs and a six-leg six. */
function partsOf(body: Body | null | undefined, swims: boolean): readonly Part[] {
  // An alien beast of its world's stock (B1): built by the one builder, at its plainest, a unit long.
  const look = (body as { look?: unknown } | null | undefined)?.look;
  if (body && look) {
    const b = buildBody(body as Parameters<typeof buildBody>[0], 0, null, 0),
      n = posed(b, { gait: 0, phase: 0, head: 0.3, crouch: 0 }, POSED),
      unit = Math.max(1e-6, b.length * b.k),
      tones = ["coat", "dark", "horn"] as const;
    return POSED.slice(0, n).map((p) => ({
      tone: tones[p.tone],
      along: p.z / unit,
      aside: p.x / unit,
      up: p.y / unit - p.sy / unit / 2,
      len: p.sz / unit,
      wide: p.sx / unit,
      tall: p.sy / unit,
      shape: p.shape,
      pitch: p.pitch,
      yaw: p.yaw,
    }));
  }
  const legs = swims ? 0 : (body?.legs ?? 4),
    slither = !swims && legs === 0,
    stand = swims ? 0.12 : slither ? 0.02 : 0.26,
    deep = slither ? 0.14 : 0.3,
    out: Part[] = [];
  if (slither) {
    for (const [along, wide] of [
      [0.32, 0.17],
      [0.05, 0.2],
      [-0.22, 0.16],
      [-0.44, 0.1],
    ] as const)
      out.push({ tone: "coat", along, aside: 0, up: stand, len: 0.3, wide, tall: deep });
  } else
    out.push({ tone: "coat", along: 0, aside: 0, up: stand, len: 0.72, wide: 0.3, tall: deep });
  // A head, as far up as its neck takes it.
  const neck = body?.neck ?? 0.3,
    lift = stand + deep * 0.6 + neck * 0.34,
    head = slither ? stand + 0.02 : lift;
  if (neck > 0.25 && !swims && !slither)
    out.push({
      tone: "coat",
      along: 0.36,
      aside: 0,
      up: stand + deep * 0.5,
      len: 0.13,
      wide: 0.13,
      tall: 0.1 + neck * 0.34,
    });
  out.push({
    tone: "coat",
    along: slither ? 0.52 : 0.46,
    aside: 0,
    up: head,
    len: 0.26,
    wide: 0.18,
    tall: 0.18,
  });
  // Legs, in pairs along it.
  const pairs = Math.max(0, Math.min(4, Math.floor(legs / 2)));
  for (let k = 0; k < pairs; k++) {
    const along = pairs > 1 ? 0.28 - (0.56 * k) / (pairs - 1) : 0;
    for (const side of [-0.11, 0.11])
      out.push({
        tone: "dark",
        along,
        aside: side,
        up: 0,
        len: 0.09,
        wide: 0.08,
        tall: stand + 0.04,
      });
  }
  // What it swims with.
  if (swims) {
    out.push({
      tone: "dark",
      along: -0.46,
      aside: 0,
      up: stand + 0.03,
      len: 0.2,
      wide: 0.05,
      tall: 0.26,
    });
    for (const side of [-0.2, 0.2])
      out.push({
        tone: "dark",
        along: 0.08,
        aside: side,
        up: stand + 0.1,
        len: 0.2,
        wide: 0.12,
        tall: 0.04,
      });
  } else if (!slither)
    out.push({
      tone: "dark",
      along: -0.42,
      aside: 0,
      up: stand + deep * 0.55,
      len: 0.2,
      wide: 0.05,
      tall: 0.05,
    });
  const features = body?.features ?? [];
  if (features.includes("hump"))
    out.push({
      tone: "coat",
      along: 0.02,
      aside: 0,
      up: stand + deep,
      len: 0.26,
      wide: 0.22,
      tall: 0.14,
    });
  if (features.includes("spines") || features.includes("crest"))
    for (const along of [0.16, -0.02, -0.2])
      out.push({
        tone: "horn",
        along,
        aside: 0,
        up: stand + deep,
        len: 0.05,
        wide: 0.05,
        tall: 0.12,
      });
  if (features.includes("horns") || features.includes("wide-horns") || features.includes("antlers"))
    for (const side of [-0.08, 0.08])
      out.push({
        tone: "horn",
        along: 0.52,
        aside: side * (features.includes("wide-horns") ? 2.2 : 1),
        up: head + 0.16,
        len: 0.05,
        wide: 0.05,
        tall: features.includes("antlers") ? 0.24 : 0.16,
      });
  if (features.includes("tusks"))
    for (const side of [-0.07, 0.07])
      out.push({
        tone: "horn",
        along: 0.66,
        aside: side,
        up: head,
        len: 0.2,
        wide: 0.04,
        tall: 0.04,
      });
  if (features.includes("trunk"))
    out.push({
      tone: "dark",
      along: 0.64,
      aside: 0,
      up: Math.max(0, head - 0.2),
      len: 0.08,
      wide: 0.08,
      tall: 0.26,
    });
  if (features.includes("mane"))
    out.push({ tone: "dark", along: 0.3, aside: 0, up: head, len: 0.14, wide: 0.22, tall: 0.2 });
  return out;
}

/** How long a beast of a weight is drawn, to its eye's size: a mouse as small against a colossus as a symbol can be. */
const sizeOf = (kg: number): number =>
  Math.max(0.65, Math.min(1.8, Math.cbrt(Math.max(1, kg) / 200)));

type Slot = { batch: InstancedBatch; data: Float32Array; n: number };

type Member = { readonly along: number; readonly aside: number; readonly key: number };

type Drawn = {
  readonly herd: LandHerd;
  readonly parts: readonly Part[];
  readonly tones: Readonly<Record<Part["tone"], string>>;
  readonly members: readonly Member[];
  /** The line it crosses the map on: a point on it, and how far along it each way it goes. */
  readonly ox: number;
  readonly oz: number;
  readonly reach: number;
  readonly scale: number;
  readonly swims: boolean;
};

type Spot = { readonly x: number; readonly y: number; readonly z: number; readonly ref: string };

const NEXT = 0.008;

/** Count a part toward its colour's batch (an alien beast's other shapes toward a batch of their own). */
function want(
  wanted: Map<string, { rgb: Rgb; n: number; shape?: number }>,
  colour: string,
  shape: number | undefined,
  n: number,
): void {
  if (!shape) {
    wanted.get(colour)!.n += n;
    return;
  }
  const key = `${colour}|${shape}`;
  if (!wanted.has(key)) wanted.set(key, { rgb: wanted.get(colour)!.rgb, n: 0, shape });
  wanted.get(key)!.n += n;
}

const hash = (a: number, b: number): number => {
  let h = Math.imul((a ^ Math.imul(b + 1, 0x9e3779b1)) >>> 0, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export class LandHerdsLayer {
  private readonly stage: Stage;
  private readonly root: pc.Entity;
  private readonly box: pc.Mesh;
  private readonly dome: pc.Mesh;
  private readonly batches = new Map<string, Slot>();
  private drawn: Drawn[] = [];
  private dens: (Spot & { readonly kind: string; readonly key: number })[] = [];
  private beast: {
    readonly x: number;
    readonly z: number;
    readonly r: number;
    readonly parts: readonly Part[];
    readonly tones: Readonly<Record<Part["tone"], string>>;
    readonly scale: number;
    readonly ref: string;
    readonly name: string;
    readonly swims: boolean;
  } | null = null;
  private key = "";
  private undersea = false;
  /** Where each was put, this frame: to be pressed. */
  private spots: Spot[] = [];
  private gone = 0;
  private last = 0;
  private share = -1;
  private distance = 40;
  private moundBatch: InstancedBatch | null = null;
  private holeBatch: InstancedBatch | null = null;

  constructor(
    stage: Stage,
    root: pc.Entity,
    meshes: { readonly box: pc.Mesh; readonly dome: pc.Mesh },
  ) {
    this.stage = stage;
    this.root = root;
    this.box = meshes.box;
    this.dome = meshes.dome;
  }

  /** How far off the eye is: a beast is drawn so as to be told at this far. */
  eye(distance: number): void {
    this.distance = distance;
  }

  private slot(key: string, rgb: Rgb, n: number, shape = 0): void {
    const had = this.batches.get(key);
    if (had && had.batch.capacity >= n) return;
    had?.batch.destroy();
    const capacity = Math.max(32, Math.ceil(n * 1.3));
    this.batches.set(key, {
      batch: new InstancedBatch(
        this.stage,
        shape ? beastMeshes(this.stage, this.box)[shape]! : this.box,
        rgb,
        capacity,
        this.root,
      ),
      data: new Float32Array(capacity * 8),
      n: 0,
    });
  }

  private tonesOf(
    name: string,
    wool: boolean,
    want: Map<string, { rgb: Rgb; n: number; shape?: number }>,
    body?: Body | null,
  ) {
    const c = coatOf(name, wool, (body as { look?: Parameters<typeof coatOf>[2] } | null)?.look),
      add = (rgb: Rgb) => {
        const key = rgb.map((v) => v.toFixed(3)).join(",");
        if (!want.has(key)) want.set(key, { rgb, n: 0 });
        return key;
      };
    return { coat: add(c.coat as Rgb), dark: add(c.dark as Rgb), horn: add(c.horn as Rgb) };
  }

  /** A land's creatures as last asked: on its ground, clear of its towns and fields. */
  set(
    plan: LandHerds,
    g: LandGround,
    towns: readonly { readonly x: number; readonly z: number; readonly r: number }[],
  ): void {
    const key = `${plan.key}|${towns.length}`;
    if (key === this.key) return;
    this.key = key;
    this.undersea = plan.undersea;
    const half = ((g.size - 1) * g.tileKm) / 2,
      wanted = new Map<string, { rgb: Rgb; n: number; shape?: number }>(),
      /** How good a line across the map is: its ground, in the land's own stuff, and clear of what people have made. */
      lineScore = (ox: number, oz: number, ux: number, uz: number, reach: number) => {
        let good = 0;
        for (let s = -reach; s <= reach; s += reach / 12) {
          const x = ox + ux * s,
            z = oz + uz * s;
          if (Math.abs(x) > half || Math.abs(z) > half) continue;
          const t =
              Math.max(0, Math.min(g.size - 1, Math.round((z + half) / g.tileKm))) * g.size +
              Math.max(0, Math.min(g.size - 1, Math.round((x + half) / g.tileKm))),
            sea = g.water[t] === 1 || g.water[t] === 3,
            ok = plan.undersea ? sea : !sea;
          if (!ok) continue;
          let clear = true;
          for (const o of towns)
            if ((x - o.x) * (x - o.x) + (z - o.z) * (z - o.z) < (o.r + 2) * (o.r + 2)) {
              clear = false;
              break;
            }
          good += clear ? 1 : 0.2;
        }
        return good;
      };
    this.drawn = plan.herds.map((h, i) => {
      const [ux, uz] = h.way,
        px = -uz,
        pz = ux,
        reach = half * 0.92;
      let best = -1,
        ox = 0,
        oz = 0;
      for (let k = -6; k <= 6; k++) {
        const off = (k / 6) * half * 0.8,
          x = px * off,
          z = pz * off,
          // (Near the map's middle where the ground lets it, so that a person coming down sees them; a second kind a line apart.)
          v = lineScore(x, z, ux, uz, reach) - Math.abs(k - (i % 3) * 2) * 1.5;
        if (v > best) {
          best = v;
          ox = x;
          oz = z;
        }
      }
      // (A second kind on another line, so its numbers aren't lost among the first's.)
      const swims = plan.undersea || h.niche === "swimmer" || h.body?.moves === "swim",
        parts = partsOf(h.body, swims),
        tones = this.tonesOf(h.name, h.wool, wanted, h.body),
        cols = Math.max(2, Math.min(5, Math.round(Math.sqrt(h.n)))),
        seed = (h.ref.length * 2654435761) >>> 0,
        members: Member[] = [];
      for (let j = 0; j < h.n; j++) {
        const rank = Math.floor(j / cols),
          file = j % cols;
        members.push({
          along: -rank + (hash(seed, j) - 0.5) * 0.9,
          aside: file - (cols - 1) / 2 + (hash(seed, j + 100) - 0.5) * 0.9,
          key: hash(seed, j + 200) * 6.28,
        });
      }
      for (const p of parts) want(wanted, tones[p.tone], p.shape, h.n);
      return { herd: h, parts, tones, members, ox, oz, reach, scale: sizeOf(h.size), swims };
    });
    // A beast at large: about its town.
    if (plan.beast) {
      const m = tileMiddle(g, plan.beast.tile),
        swims = plan.undersea || plan.beast.body?.moves === "swim",
        parts = partsOf(plan.beast.body, swims),
        tones = this.tonesOf(plan.beast.kind, plan.beast.wool, wanted, plan.beast.body);
      for (const p of parts) want(wanted, tones[p.tone], p.shape, 1);
      const near = towns.find((o) => (o.x - m.x) * (o.x - m.x) + (o.z - m.z) * (o.z - m.z) < 25);
      this.beast = {
        x: m.x,
        z: m.z,
        r: Math.max(1.4, (near?.r ?? 0) + 0.8),
        parts,
        tones,
        scale: sizeOf(plan.beast.size) * 1.8,
        ref: plan.beast.ref,
        name: plan.beast.name,
        swims,
      };
    } else this.beast = null;
    for (const [k, w] of wanted) this.slot(k, w.rgb, w.n, w.shape ?? 0);
    for (const [k, b] of this.batches)
      if (!wanted.has(k)) {
        b.batch.set(0, () => {});
        b.n = 0;
      }
    // Their dens: on the ground (the sea's floor, a people of the water's), near where most of them cross, clear of what people have made.
    this.dens = [];
    for (const d of plan.dens) {
      let spot: { x: number; z: number } | null = null;
      for (let k = 0; k < 40 && !spot; k++) {
        const a = hash(d.key, 2 * k) * 6.283,
          r = half * (0.1 + 0.6 * hash(d.key, 2 * k + 1)),
          x = r * Math.cos(a),
          z = r * Math.sin(a),
          t =
            Math.max(0, Math.min(g.size - 1, Math.round((z + half) / g.tileKm))) * g.size +
            Math.max(0, Math.min(g.size - 1, Math.round((x + half) / g.tileKm))),
          sea = g.water[t] === 1 || g.water[t] === 3;
        if (plan.undersea ? !sea : sea) continue;
        if (
          towns.some((o) => (x - o.x) * (x - o.x) + (z - o.z) * (z - o.z) < (o.r + 2) * (o.r + 2))
        )
          continue;
        spot = { x, z };
      }
      if (spot)
        this.dens.push({
          ...spot,
          y: (plan.undersea ? floorAt : groundAt)(g, spot.x, spot.z),
          ref: d.ref,
          kind: d.kind,
          key: d.key,
        });
    }
    const moundN = Math.max(8, this.dens.length * 2);
    if (!this.moundBatch || this.moundBatch.capacity < moundN) {
      this.moundBatch?.destroy();
      this.moundBatch = new InstancedBatch(
        this.stage,
        this.dome,
        [0.46, 0.38, 0.27],
        moundN,
        this.root,
      );
    }
    if (!this.holeBatch || this.holeBatch.capacity < moundN) {
      this.holeBatch?.destroy();
      this.holeBatch = new InstancedBatch(
        this.stage,
        this.box,
        [0.08, 0.06, 0.05],
        moundN,
        this.root,
      );
    }
    this.share = -1;
  }

  /** Every beast where the year has taken it, walking while the clock runs and standing while it is held. */
  update(
    g: LandGround,
    towns: readonly { readonly x: number; readonly z: number; readonly r: number }[],
    share: number,
    running: boolean,
  ): void {
    const wall = performance.now() / 1000;
    if (running && this.last) this.gone += Math.min(0.25, wall - this.last);
    this.last = wall;
    if (
      !running &&
      Math.abs(share - this.share) < 1e-5 &&
      this.spots.length &&
      this.lastDistance === this.distance
    )
      return;
    this.share = share;
    this.lastDistance = this.distance;
    // A beast is drawn this long: a symbol of a dozen or more pixels at any zoom, at the size of its kind.
    const L = Math.max(0.16, Math.min(9, this.distance * 0.035));
    for (const b of this.batches.values()) b.n = 0;
    this.spots = [];
    const put = (
      parts: readonly Part[],
      tones: Readonly<Record<Part["tone"], string>>,
      scale: number,
      x: number,
      y: number,
      z: number,
      yaw: number,
    ) => {
      const sin = Math.sin(yaw),
        cos = Math.cos(yaw),
        k = L * scale;
      for (const p of parts) {
        const b = this.batches.get(p.shape ? `${tones[p.tone]}|${p.shape}` : tones[p.tone]);
        if (!b || b.n >= b.batch.capacity) continue;
        const o = b.n * 8,
          ax = p.along * k,
          sx = p.aside * k;
        b.data[o] = x + sin * ax + cos * sx;
        b.data[o + 1] = y + (p.up + p.tall / 2) * k;
        b.data[o + 2] = z + cos * ax - sin * sx;
        b.data[o + 3] = p.wide * k;
        b.data[o + 4] = p.tall * k;
        b.data[o + 5] = p.len * k;
        b.data[o + 6] = yaw + (p.yaw ?? 0);
        b.data[o + 7] = p.pitch ?? 0;
        b.n++;
      }
    };
    const half = ((g.size - 1) * g.tileKm) / 2,
      standsOn = (x: number, z: number): boolean => {
        const t =
            Math.max(0, Math.min(g.size - 1, Math.round((z + half) / g.tileKm))) * g.size +
            Math.max(0, Math.min(g.size - 1, Math.round((x + half) / g.tileKm))),
          sea = g.water[t] === 1 || g.water[t] === 3;
        return this.undersea ? sea : !sea;
      };
    for (const d of this.drawn) {
      const at = passAt(d.herd, share);
      if (at === null) continue;
      const later = passAt(d.herd, (share + NEXT) % 1),
        dir = later === null ? (at > 0 ? 1 : -1) : later - at;
      // (It goes on the line the year has it on, and turns about as it comes back.)
      const [ux, uz] = d.herd.way,
        sign = d.herd.still ? 1 : dir >= 0 ? 1 : -1,
        cx = d.ox + ux * at * d.reach + (d.herd.still ? Math.cos(this.gone * 0.05) * 6 : 0),
        cz = d.oz + uz * at * d.reach + (d.herd.still ? Math.sin(this.gone * 0.04) * 6 : 0),
        yaw = Math.atan2(ux * sign, uz * sign),
        gap = L * d.scale * 1.5,
        px = -uz,
        pz = ux;
      for (const m of d.members) {
        const sway = Math.sin(this.gone * 0.7 + m.key) * 0.14,
          along = m.along * sign,
          x0 = cx + ux * along * gap + px * (m.aside + sway) * gap,
          z0 = cz + uz * along * gap + pz * (m.aside + sway) * gap;
        let x = x0,
          z = z0;
        // (No beast goes onto a town: it goes round.)
        for (const o of towns) {
          const dx = x - o.x,
            dz = z - o.z,
            dd = dx * dx + dz * dz;
          if (dd > 0 && dd < o.r * o.r) {
            const l = o.r / Math.sqrt(dd);
            x = o.x + dx * l;
            z = o.z + dz * l;
          }
        }
        if (!standsOn(x, z) || Math.abs(x) > half || Math.abs(z) > half) continue;
        const y = d.swims
          ? this.undersea
            ? floorAt(g, x, z) + 0.2 * L
            : 0.02
          : groundAt(g, x, z) + 0.01;
        put(d.parts, d.tones, d.scale, x, y, z, yaw + (hash(m.key, 3) - 0.5) * 0.5);
        this.spots.push({ x, y: y + L * 0.5, z, ref: d.herd.ref });
      }
    }
    if (this.beast) {
      const a = this.gone * 0.09 + share * 40,
        b = this.beast,
        x = b.x + Math.cos(a) * b.r,
        z = b.z + Math.sin(a) * b.r;
      if (standsOn(x, z)) {
        const y = b.swims
          ? this.undersea
            ? floorAt(g, x, z) + 0.2 * L
            : 0.02
          : groundAt(g, x, z) + 0.01;
        put(b.parts, b.tones, b.scale, x, y, z, a + Math.PI);
        this.spots.push({ x, y: y + L * 0.8, z, ref: b.ref });
      }
    }
    for (const b of this.batches.values()) {
      const d = b.data;
      b.batch.set(b.n, (i, o) => {
        const q = i * 8;
        for (let k = 0; k < 8; k++) o[k] = d[q + k]!;
      });
    }
    // The dens, at the same symbol's size.
    const dens = this.dens,
      R = L * 0.3;
    this.moundBatch?.set(dens.length, (i, o) => {
      const d = dens[i]!;
      o[0] = d.x;
      o[1] = d.y;
      o[2] = d.z;
      o[3] = o[5] = R * 2;
      o[4] = R * (d.kind === "burrow" ? 0.7 : 1);
      o[6] = 0;
    });
    this.holeBatch?.set(dens.length, (i, o) => {
      const d = dens[i]!;
      o[0] = d.x + R * 0.8;
      o[1] = d.y + R * 0.18;
      o[2] = d.z;
      o[3] = R * 0.3;
      o[4] = R * 0.42;
      o[5] = R * 0.62;
      o[6] = 0;
    });
    for (const d of dens) this.spots.push({ x: d.x, y: d.y + R * 0.5, z: d.z, ref: d.ref });
    void towns;
  }
  private lastDistance = -1;

  /** The page of what is nearest a point of the screen, within a finger's reach. */
  pick(cam: pc.CameraComponent, x: number, y: number, reach = 30): string | null {
    const at = new pc.Vec3(),
      out = new pc.Vec3();
    let best: string | null = null,
      bestD = reach * reach;
    for (const s of this.spots) {
      at.set(s.x, s.y, s.z);
      cam.worldToScreen(at, out);
      if (out.z <= 0) continue;
      const d = (out.x - x) * (out.x - x) + (out.y - y) * (out.y - y);
      if (d < bestD) {
        bestD = d;
        best = s.ref;
      }
    }
    return best;
  }

  /** What is on the land now, and where (the look tools). */
  info(): {
    beasts: number;
    kinds: number;
    dens: number;
    beast: string | null;
    spots: { x: number; y: number; z: number; ref: string }[];
  } {
    return {
      beasts: this.spots.filter((s) => s.ref.startsWith("herd:")).length - this.dens.length,
      kinds: this.drawn.length,
      dens: this.dens.length,
      beast: this.beast?.name ?? null,
      spots: this.spots.map((s) => ({ ...s })),
    };
  }

  clear(): void {
    this.drawn = [];
    this.dens = [];
    this.beast = null;
    this.spots = [];
    this.key = "";
    for (const b of this.batches.values()) {
      b.batch.set(0, () => {});
      b.n = 0;
    }
    this.moundBatch?.set(0, () => {});
    this.holeBatch?.set(0, () => {});
  }

  destroy(): void {
    for (const b of this.batches.values()) b.batch.destroy();
    this.batches.clear();
    this.moundBatch?.destroy();
    this.holeBatch?.destroy();
  }
}
