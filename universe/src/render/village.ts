// A village under the microscope (docs/architecture §9, §28): its ground, fields
// that green and ripen with the year, the pasture and water, the road out, homes
// with their roofs, the square or the market hall, and the watched people going
// about their day. One unit is ten metres; people are drawn three times their size
// so a phone can see them. Instanced throughout: a village is a handful of draw calls.
import * as pc from "playcanvas";
import type { VillagePlan } from "../bridge/index.ts";
import {
  ACTIVITY,
  biomeColor,
  figureOf,
  houseLook,
  momentOf,
  personGroup,
  treesOf,
  type Figure,
  type Tree,
  type Moment,
  type PartShape,
} from "../view/index.ts";
import {
  InstancedBatch,
  boxMesh,
  capsuleMesh,
  coneMesh,
  cylinderMesh,
  gableMesh,
} from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1; // units per metre
const YEAR = 365 * 86_400;

/** A city's quarters by use: open, houses, crowded houses, markets, workshops, the temple. */
const QUARTER_COLORS: readonly Rgb[] = [
  [0, 0, 0],
  [0.74, 0.62, 0.46],
  [0.6, 0.47, 0.36],
  [0.88, 0.76, 0.4],
  [0.5, 0.5, 0.54],
  [0.9, 0.88, 0.82],
];

/** Fields through the year: bare, sprouting, green, ripe, stubble. */
function fieldColor(t: number): Rgb {
  const d = (t % YEAR) / YEAR;
  if (d < 0.2) return [0.46, 0.36, 0.24];
  if (d < 0.35) return [0.5, 0.62, 0.3];
  if (d < 0.6) return [0.34, 0.58, 0.24];
  if (d < 0.75) return [0.82, 0.7, 0.32];
  return [0.6, 0.52, 0.34];
}

const GROUP_COLORS: readonly Rgb[] = [
  [0.85, 0.35, 0.2],
  [0.2, 0.45, 0.95],
  [0.95, 0.78, 0.15],
  [0.95, 0.55, 0.75],
];
/** Bare skin, arms and faces (the upright apes'). */
const SKIN: Rgb = [0.88, 0.66, 0.5];

/**
 * What a figure wears, by its land's era, for each group (workers of the land, makers
 * and carriers, leaders, the young): body and legs. Gatherers in hides; farmers in
 * undyed wool and linen, the leaders' a little brighter; the smiths' people in dyed
 * cloth; the engines' in dark coats with a colour at the chest; the modern world in the
 * bright colours of its day.
 */
function clothes(era: VillagePlan["era"], group: number): { body: Rgb; legs: Rgb } {
  const bright = GROUP_COLORS[group]!,
    dim = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k],
    mix = (a: Rgb, b: Rgb, k: number): Rgb => [
      a[0] + (b[0] - a[0]) * k,
      a[1] + (b[1] - a[1]) * k,
      a[2] + (b[2] - a[2]) * k,
    ];
  switch (era) {
    case "forage":
      return { body: mix([0.55, 0.38, 0.22], bright, 0.12), legs: [0.45, 0.3, 0.18] };
    case "metal":
      return { body: bright, legs: dim(bright, 0.55) };
    case "industry":
      return { body: mix([0.2, 0.22, 0.3], bright, 0.35), legs: [0.16, 0.16, 0.2] };
    case "modern":
      return { body: mix(bright, [1, 1, 1], 0.1), legs: [0.22, 0.32, 0.62] };
    default:
      return { body: mix([0.86, 0.8, 0.66], bright, 0.3), legs: [0.52, 0.44, 0.34] };
  }
}
/** Strides a second of a walking figure, on the screen's clock (a look, not the world's). */
const STRIDES = 1.6;

export class VillageScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("village");
  private plan: VillagePlan | null = null;
  private fields: InstancedBatch | null = null;
  private people: InstancedBatch[][] = [];
  private figure: Figure = figureOf(null);
  private moments: Moment[] = [];
  private readonly marker: pc.Entity;
  private marked: number | null = null;
  key: string | null = null;

  constructor(stage: Stage) {
    this.stage = stage;
    stage.root.addChild(this.root);
    this.marker = new pc.Entity("person-marker");
    this.marker.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(cylinderMesh(stage, 0.16, 0.02, 16), flatMaterial([1, 1, 1], 0.85)),
      ],
    });
    this.marker.enabled = false;
    this.root.addChild(this.marker);
    this.root.enabled = false;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** Every batch the village is built of, so a rebuild frees their buffers too. */
  private batches: InstancedBatch[] = [];
  private batch(...args: ConstructorParameters<typeof InstancedBatch>): InstancedBatch {
    const b = new InstancedBatch(...args);
    this.batches.push(b);
    return b;
  }

  /** Lay out a village from its plan. */
  build(plan: VillagePlan): void {
    // (Batches first: an entity destroyed does not free the instance buffer it was given.)
    for (const b of this.batches) b.destroy();
    this.batches = [];
    for (const child of [...this.root.children]) if (child !== this.marker) child.destroy();
    this.plan = plan;
    this.key = plan.ref;
    const s = this.stage,
      disc = (r: number, color: Rgb, x = 0, z = 0, y = 0) => {
        const e = new pc.Entity("disc");
        e.addComponent("render", {
          meshInstances: [new pc.MeshInstance(cylinderMesh(s, r, 0.02, 48), flatMaterial(color))],
        });
        e.setLocalPosition(x, y, z);
        this.root.addChild(e);
      };
    const g = biomeColor(plan.biome);
    disc(140, [g[0] * 0.95 + 0.03, g[1] * 0.95 + 0.05, g[2] * 0.9]);
    disc(
      plan.pasture.r * M,
      [g[0] * 0.8 + 0.12, g[1] * 0.85 + 0.14, g[2] * 0.7 + 0.05],
      plan.pasture.x * M,
      plan.pasture.z * M,
      0.012,
    );
    if (plan.water) disc(22, [0.2, 0.4, 0.6], plan.water.x * M, plan.water.z * M, 0.014);
    // The road out (through a city, both ways; paved stone once it is paved), and the square.
    const quarters = plan.districts,
      paved = !!quarters?.paved;
    const road = this.batch(
      s,
      boxMesh(s),
      paved ? [0.72, 0.7, 0.64] : [0.62, 0.55, 0.42],
      1,
      this.root,
    );
    const len = Math.hypot(plan.road.x, plan.road.z) * M;
    road.set(1, (_, out) => {
      out[0] = quarters ? 0 : (plan.road.x * M) / 2;
      out[1] = 0.015;
      out[2] = quarters ? 0 : (plan.road.z * M) / 2;
      out[3] = paved ? 1.4 : 0.5;
      out[4] = 0.02;
      out[5] = quarters ? 2 * len : len;
      out[6] = Math.atan2(plan.road.x, plan.road.z);
    });
    // A city's quarters: each block's ground coloured by its use, and a hall at its heart.
    if (quarters) {
      const patch = boxMesh(s),
        side = quarters.blockM * M * 0.94;
      QUARTER_COLORS.forEach((color, use) => {
        if (!use) return;
        const blocks = quarters.uses.map((u, k) => ({ u, k })).filter((b) => b.u === use);
        if (!blocks.length) return;
        const batch = this.batch(s, patch, color, blocks.length, this.root);
        batch.set(blocks.length, (i, out) => {
          const k = blocks[i]!.k,
            half = (quarters.blocks - 1) / 2;
          out[0] = ((k % quarters.blocks) - half) * quarters.blockM * M;
          out[1] = 0.012;
          out[2] = (Math.floor(k / quarters.blocks) - half) * quarters.blockM * M;
          out[3] = out[5] = side;
          out[4] = 0.01;
          out[6] = 0;
        });
      });
      // What each quarter holds (art track A3): markets their stalls under striped awnings,
      // workshops their sheds and chimneys, the temple a stepped pile with a gilded crown.
      const half = (quarters.blocks - 1) / 2,
        centre = (k: number) => ({
          x: ((k % quarters.blocks) - half) * quarters.blockM * M,
          z: (Math.floor(k / quarters.blocks) - half) * quarters.blockM * M,
        }),
        blocksOf = (use: number) =>
          quarters.uses.map((u, k) => ({ u, k })).filter((b) => b.u === use),
        span = quarters.blockM * M,
        pieces = (
          list: { x: number; y: number; z: number; w: number; h: number; d: number }[],
          color: Rgb,
        ) => {
          if (!list.length) return;
          this.batch(s, patch, color, list.length, this.root).set(list.length, (i, out) => {
            const p = list[i]!;
            out[0] = p.x;
            out[1] = p.y;
            out[2] = p.z;
            out[3] = p.w;
            out[4] = p.h;
            out[5] = p.d;
            out[6] = 0;
          });
        };
      const stalls: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [],
        awnings: (typeof stalls)[] = [[], [], [], []];
      for (const { k } of blocksOf(3)) {
        const c = centre(k);
        for (let a = 0; a < 3; a++)
          for (let b = 0; b < 3; b++) {
            const x = c.x + (a - 1) * span * 0.28,
              z = c.z + (b - 1) * span * 0.28;
            stalls.push({ x, y: 0.35, z, w: 1.4, h: 0.7, d: 1.1 });
            awnings[(k + a * 3 + b) % 4]!.push({ x, y: 0.78, z, w: 1.7, h: 0.12, d: 1.4 });
          }
      }
      pieces(stalls, [0.62, 0.46, 0.3]);
      const AWNINGS: readonly Rgb[] = [
        [0.9, 0.22, 0.2],
        [0.98, 0.8, 0.2],
        [0.2, 0.45, 0.9],
        [0.25, 0.7, 0.35],
      ];
      awnings.forEach((list, i) => pieces(list, AWNINGS[i]!));
      const sheds: typeof stalls = [],
        chimneys: typeof stalls = [];
      for (const { k } of blocksOf(4)) {
        const c = centre(k);
        for (const a of [-1, 1]) {
          const x = c.x + a * span * 0.22;
          sheds.push({ x, y: 0.9, z: c.z, w: span * 0.34, h: 1.8, d: span * 0.5 });
          chimneys.push({ x: x + span * 0.1, y: 2, z: c.z - span * 0.16, w: 0.55, h: 4, d: 0.55 });
        }
      }
      pieces(sheds, [0.5, 0.48, 0.46]);
      pieces(chimneys, [0.62, 0.26, 0.2]);
      const tiers: typeof stalls = [],
        crowns: typeof stalls = [];
      for (const { k } of blocksOf(5)) {
        const c = centre(k),
          base = span * 0.6;
        [1, 0.72, 0.46].forEach((f, n) =>
          tiers.push({ x: c.x, y: 0.7 + n * 1.4, z: c.z, w: base * f, h: 1.4, d: base * f }),
        );
        crowns.push({ x: c.x, y: 4.9, z: c.z, w: base * 0.2, h: 1.2, d: base * 0.2 });
      }
      pieces(tiers, [0.94, 0.92, 0.86]);
      pieces(crowns, [0.98, 0.8, 0.25]);
    }
    disc(2.2, [0.66, 0.6, 0.48], 0, 0, 0.016);
    this.fields = this.batch(s, boxMesh(s), fieldColor(0), plan.fields.length, this.root);
    this.fields.set(plan.fields.length, (i, out) => {
      const f = plan.fields[i]!;
      out[0] = f.x * M;
      out[1] = 0.02;
      out[2] = f.z * M;
      out[3] = f.w * M;
      out[4] = 0.02;
      out[5] = f.d * M;
      out[6] = f.yaw;
    });
    // Homes, as the land builds them (its design): walls of its material, four-square
    // or round, long or wide; roofs pitched to the rain, flat, or conical; tents whole
    // cones of hide. The watched homes lighter.
    const look = houseLook(plan.house),
      sides = look.round ? 8 : 4,
      box = boxMesh(s),
      shell = look.round ? cylinderMesh(s, Math.SQRT1_2, 1, sides) : box,
      lighter: [number, number, number] = [
        look.wall[0] + (1 - look.wall[0]) * 0.4,
        look.wall[1] + (1 - look.wall[1]) * 0.4,
        look.wall[2] + (1 - look.wall[2]) * 0.4,
      ],
      wallHigh =
        (look.tent ? 0.06 : look.length > 0.85 && look.width > 0.85 ? 0.36 : 0.44) * look.height,
      flat = look.rise < 0.1,
      roofHigh = look.tent ? 0.75 : flat ? 0.08 : Math.min(0.6, look.rise * look.width * 0.5),
      // Square homes wear a gable along their length; round ones a cone.
      roofMesh = flat ? box : look.round ? coneMesh(s, Math.SQRT1_2, 1, sides) : gableMesh(s),
      walls = this.batch(s, shell, [...look.wall], plan.homes.length, this.root),
      watched = this.batch(s, shell, lighter, plan.homes.length, this.root),
      roofs = this.batch(s, roofMesh, [...look.roof], plan.homes.length, this.root);
    // In a city's crowded quarters homes stand two storeys high.
    const storeys = (h: VillagePlan["homes"][number]) => {
        const q = plan.districts;
        if (!q) return 1;
        const i = Math.round(h.x / q.blockM + (q.blocks - 1) / 2),
          j = Math.round(h.z / q.blockM + (q.blocks - 1) / 2);
        return q.uses[j * q.blocks + i] === 2 ? 2 : 1;
      },
      place = (list: VillagePlan["homes"][number][], batch: InstancedBatch) =>
        batch.set(list.length, (i, out) => {
          const h = list[i]!,
            high = wallHigh * storeys(h);
          out[0] = h.x * M;
          // Nests and platforms stand off the ground.
          out[1] = look.raised + high / 2;
          out[2] = h.z * M;
          out[3] = look.length;
          out[4] = high;
          out[5] = look.width;
          out[6] = h.yaw;
        });
    place(
      plan.homes.filter((h) => !h.household),
      walls,
    );
    place(
      plan.homes.filter((h) => h.household),
      watched,
    );
    // A house open to the water above has no roof.
    roofs.set(look.open ? 0 : plan.homes.length, (i, out) => {
      const h = plan.homes[i]!;
      out[0] = h.x * M;
      out[1] = look.raised + wallHigh * storeys(h) + roofHigh / 2;
      out[2] = h.z * M;
      // The eaves overhang the walls a little (a flat roof sits on them).
      out[3] = look.length * (flat ? 1.02 : 1.15);
      out[4] = roofHigh;
      out[5] = look.width * (flat ? 1.02 : 1.15);
      out[6] = h.yaw;
    });
    // Trees about the village, as its land grows them: dark cones of pine, round crowns,
    // palms, low scrub — facets in a handful of batches.
    const trees = treesOf(plan, s.quality.villageTrees),
      byKind = (k: Tree["kind"]) => trees.filter((t) => t.kind === k),
      trunk = cylinderMesh(s, 0.5, 1, 5),
      crown = pc.Mesh.fromGeometry(
        s.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 3, longitudeBands: 6 }),
      ),
      pine = coneMesh(s, 0.5, 1, 6),
      g2 = biomeColor(plan.biome),
      leaf: Rgb = [g2[0] * 0.45 + 0.02, g2[1] * 0.55 + 0.22, g2[2] * 0.4 + 0.04],
      grow = (
        list: Tree[],
        mesh: pc.Mesh,
        color: Rgb,
        y: (t: Tree) => number,
        w: (t: Tree) => number,
        h: (t: Tree) => number,
      ) => {
        if (!list.length) return;
        this.batch(s, mesh, color, list.length, this.root).set(list.length, (i, out) => {
          const t = list[i]!;
          out[0] = t.x * M;
          out[1] = y(t);
          out[2] = t.z * M;
          out[3] = out[5] = w(t);
          out[4] = h(t);
          out[6] = t.x + t.z;
        });
      };
    const standing = trees.filter((t) => t.kind !== "shrub");
    grow(
      standing,
      trunk,
      [0.42, 0.28, 0.16],
      (t) => 0.35 * t.size,
      () => 0.12,
      (t) => 0.7 * t.size,
    );
    grow(
      byKind("conifer"),
      pine,
      [0.06, 0.36, 0.2],
      (t) => 1.05 * t.size,
      (t) => 0.9 * t.size,
      (t) => 1.5 * t.size,
    );
    grow(
      byKind("broadleaf"),
      crown,
      leaf,
      (t) => 1.05 * t.size,
      (t) => 1.2 * t.size,
      (t) => 1 * t.size,
    );
    grow(
      byKind("palm"),
      crown,
      [0.2, 0.62, 0.22],
      (t) => 1.35 * t.size,
      (t) => 1.1 * t.size,
      (t) => 0.3 * t.size,
    );
    grow(
      byKind("shrub"),
      crown,
      [leaf[0] * 0.9 + 0.08, leaf[1] * 0.85, leaf[2] * 0.8],
      (t) => 0.18 * t.size,
      (t) => 0.5 * t.size,
      (t) => 0.36 * t.size,
    );
    // A door on each home, facing out from its front.
    if (!look.tent && !look.open) {
      const door = this.batch(s, box, [0.2, 0.12, 0.08], plan.homes.length, this.root),
        doorHigh = Math.min(wallHigh * 0.7, 0.26);
      door.set(plan.homes.length, (i, out) => {
        const h = plan.homes[i]!,
          front = look.width / 2 + 0.012;
        out[0] = h.x * M + Math.sin(h.yaw) * front;
        out[1] = look.raised + doorHigh / 2;
        out[2] = h.z * M + Math.cos(h.yaw) * front;
        out[3] = 0.13;
        out[4] = doorHigh;
        out[5] = 0.02;
        out[6] = h.yaw;
      });
    }
    // The market hall, or the well in the square.
    const hall = this.batch(
      s,
      box,
      plan.market ? [0.62, 0.42, 0.3] : [0.5, 0.5, 0.55],
      1,
      this.root,
    );
    hall.set(1, (_, out) => {
      out[0] = plan.market ? 1.4 : 0;
      out[1] = plan.market ? 0.35 : 0.06;
      out[2] = plan.market ? -1 : 0;
      out[3] = plan.market ? 1.8 : 0.25;
      out[4] = plan.market ? 0.7 : 0.12;
      out[5] = plan.market ? 1.1 : 0.25;
      out[6] = 0;
    });
    // People: drawn three times their size, so a phone can see them — as their body is
    // built (one figure for a people, part by part, each part a batch per colour group).
    this.figure = figureOf(plan.body);
    const meshes: Record<PartShape, pc.Mesh> = {
      capsule: capsuleMesh(s, 0.11, 0.55),
      box: boxMesh(s),
      cylinder: cylinderMesh(s, 0.5, 1, 8),
      cone: coneMesh(s, 0.5, 1, 8),
    };
    // Each part a batch per group, dressed as the land's era dresses them.
    this.people = GROUP_COLORS.map((_, gi) => {
      const wear = clothes(plan.era, gi);
      return this.figure.parts.map((part) =>
        this.batch(
          s,
          meshes[part.shape],
          part.tone === 2 ? SKIN : part.tone ? wear.legs : wear.body,
          Math.max(1, plan.people.length),
          this.root,
        ),
      );
    });
    this.moments = [];
  }

  /** Put everyone where they are at time t. */
  update(t: number): void {
    const plan = this.plan;
    if (!plan) return;
    this.fields?.recolor(fieldColor(t));
    this.moments = plan.people.map((_, i) => momentOf(plan, i, t));
    const parts = this.figure.parts,
      // The swing of a stride: by the screen's clock, each person a little out of step.
      now = (performance.now() / 1000) * STRIDES * 2 * Math.PI;
    this.people.forEach((batches, gi) => {
      const members = plan.people
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => personGroup(p) === gi && !this.moments[i]!.hidden);
      batches.forEach((batch, pi) => {
        const part = parts[pi]!;
        batch.set(members.length, (k, out) => {
          const { p, i } = members[k]!,
            m = this.moments[i]!,
            size = (p.child ? 0.7 : 1) * this.figure.scale,
            c = Math.cos(m.yaw),
            sn = Math.sin(m.yaw),
            // A walking limb swings about its hinge; standing, it hangs still.
            walking = m.activity === ACTIVITY.walking && !!part.swing,
            pitch = walking ? part.swing! * Math.sin(now + i * 1.7) : 0,
            hinge = part.pivot ?? 0,
            dy = hinge - hinge * Math.cos(pitch),
            dz = -hinge * Math.sin(pitch),
            px = part.x,
            pz = part.z + dz;
          // The part's place about the figure's middle, turned to the way it faces.
          out[0] = m.x * M + (px * c + pz * sn) * size;
          out[1] = (part.y + dy) * size;
          out[2] = m.z * M + (-px * sn + pz * c) * size;
          out[3] = part.sx * size;
          out[4] = part.sy * size;
          out[5] = part.sz * size;
          out[6] = m.yaw;
          out[7] = pitch;
        });
      });
    });
    if (this.marked !== null) {
      const m = this.moments[this.marked];
      this.marker.enabled = !!m && !m.hidden;
      if (m) this.marker.setLocalPosition(m.x * M, 0.03, m.z * M);
    }
  }

  /** What a watched person is doing now. */
  momentAt(index: number): Moment | null {
    return this.moments[index] ?? null;
  }

  /** The watched person nearest a screen point, within a finger's reach. */
  pick(x: number, y: number, reach = 28): number | null {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3();
    let best: number | null = null,
      bestD = reach * reach;
    this.moments.forEach((m, i) => {
      if (m.hidden) return;
      const p = cam.worldToScreen(new pc.Vec3(m.x * M, 0.2, m.z * M), at),
        d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (p.z > 0 && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  mark(index: number | null): void {
    this.marked = index;
    if (index === null) this.marker.enabled = false;
  }

  /** Screen positions of the watched homes, for their families' names. */
  homesOnScreen(): { household: string; at: { x: number; y: number } | null }[] {
    const plan = this.plan;
    if (!plan) return [];
    const cam = this.stage.camera.camera!;
    return plan.homes
      .filter((h) => h.household)
      .map((h) => {
        const p = cam.worldToScreen(new pc.Vec3(h.x * M, 0.9, h.z * M));
        return { household: h.household!, at: p.z > 0 ? { x: p.x, y: p.y } : null };
      });
  }
}
