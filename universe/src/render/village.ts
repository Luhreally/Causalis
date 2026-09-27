// A village under the microscope (docs/architecture §9, §28): its ground, fields
// that green and ripen with the year, the pasture and water, the road out, homes
// with their roofs, the square or the market hall, and the watched people going
// about their day. One unit is ten metres; people are drawn three times their size
// so a phone can see them. Instanced throughout: a village is a handful of draw calls.
import * as pc from "playcanvas";
import { LAKE_R, type VillagePlan } from "../bridge/index.ts";
import {
  ACTIVITY,
  HAIRS,
  EYES,
  GROUP_COLORS,
  SKIN,
  clothes,
  biomeColor,
  battleOf,
  bobOf,
  figureOf,
  hairOf,
  keepApart,
  present,
  villageSolids,
  type Presence,
  homeDetail,
  lamplight,
  houseLook,
  limbPitch,
  momentOf,
  personGroup,
  sayOf,
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
import { FaunaLayer, type PickedBeast } from "./fauna.ts";
import { WorkLayer, type Carrier } from "./work.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1; // units per metre
/** How many a side a village's battle draws, by the setting's detail. */
const SOLDIERS = [6, 10, 14, 20];
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

/**
 * Windows' glass: dark by day; by night the lamplight glows out of them (its glow never
 * quite out, so dusk makes no new shader: the one warmed at the start serves all day).
 */
export function windowMaterial(): pc.StandardMaterial {
  const m = flatMaterial([0.14, 0.18, 0.24]);
  glowWindows(m, 0);
  return m;
}

function glowWindows(m: pc.StandardMaterial, glow: number): void {
  const g = 0.02 + 0.98 * glow;
  m.emissive = new pc.Color(1 * g, 0.78 * g, 0.4 * g);
  m.update();
}

export class VillageScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("village");
  private plan: VillagePlan | null = null;
  private fields: InstancedBatch | null = null;
  /** Each group's batch for each part of the figure (null: a part drawn by the person's hair). */
  private people: (InstancedBatch | null)[][] = [];
  /** A battle's two hosts (M87): each side's batch for each part of the figure, and their spears. */
  private soldiers: InstancedBatch[][] = [];
  private spears: InstancedBatch | null = null;
  private soldiersEach = 0;
  /** For each part of hair, a batch per hair colour (M79). */
  private hair: (InstancedBatch[] | null)[] = [];
  /** Windows, lit from dusk to dawn (their material's glow set by the hour). */
  private windows: pc.StandardMaterial | null = null;
  private lit = -1;
  private figure: Figure = figureOf(null);
  private moments: Moment[] = [];
  private readonly marker: pc.Entity;
  private marked: number | null = null;
  /** What lives about the village: its herds, hunters, flocks, birds and fish (M77). */
  private readonly fauna: FaunaLayer;
  /** Its work you can see: what its people carry, its mine and works, its road, its smoke (M78). */
  private readonly work: WorkLayer;
  private readonly carriers: Carrier[] = [];
  /** Where smoke rises: roof tops, and a city's workshop chimneys (metres). */
  private hearths: { x: number; y: number; z: number }[] = [];
  private stacks: { x: number; y: number; z: number }[] = [];
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
    this.fauna = new FaunaLayer(stage, this.root);
    this.work = new WorkLayer(stage, this.root);
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
    for (const child of [...this.root.children])
      if (child !== this.marker && child !== this.fauna.root && child !== this.work.root)
        child.destroy();
    this.stacks = [];
    this.plan = plan;
    // (A new village's people are drawn afresh; the same village's, carried on.)
    if (this.presenceOf !== plan.ref) {
      this.presence.clear();
      this.limbs.clear();
      this.presenceClock = null;
      this.presenceOf = plan.ref;
    }
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
    if (plan.water) disc(LAKE_R * M, [0.2, 0.4, 0.6], plan.water.x * M, plan.water.z * M, 0.014);
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
      // (The workshops' chimneys smoke.)
      this.stacks = chimneys.map((c) => ({ x: c.x / M, y: (c.y + c.h / 2) / M, z: c.z / M }));
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
    // The next home rising (M86): its footing, its walls as far built as the families it
    // will house have come, the scaffold about them, the timber waiting, and its roof going
    // on at the last.
    const site = plan.life?.site;
    if (site && !look.tent) {
      const L = look.length,
        Wd = look.width,
        high = wallHigh * Math.min(1, site.progress / 0.8),
        thin = 0.045,
        c = Math.cos(site.yaw),
        sn = Math.sin(site.yaw),
        put = (
          batch: InstancedBatch,
          list: readonly (readonly [number, number, number, number, number, number])[],
        ) =>
          batch.set(list.length, (i, out) => {
            const [dx, y, dz, sx, sy, sz] = list[i]!;
            out[0] = site.x * M + dx * c + dz * sn;
            out[1] = y;
            out[2] = site.z * M - dx * sn + dz * c;
            out[3] = sx;
            out[4] = sy;
            out[5] = sz;
            out[6] = site.yaw;
          });
      put(this.batch(s, box, [0.62, 0.6, 0.56], 1, this.root), [
        [0, 0.012, 0, L * 1.08, 0.024, Wd * 1.08],
      ]);
      put(this.batch(s, box, [...look.wall], 4, this.root), [
        [0, 0.024 + high / 2, Wd / 2 - thin / 2, L, high, thin],
        [0, 0.024 + high / 2, -Wd / 2 + thin / 2, L, high, thin],
        [L / 2 - thin / 2, 0.024 + high / 2, 0, thin, high, Wd],
        [-L / 2 + thin / 2, 0.024 + high / 2, 0, thin, high, Wd],
      ]);
      const pole = high + 0.16,
        out = 0.07;
      put(this.batch(s, box, [0.52, 0.36, 0.2], 9, this.root), [
        // Poles at the corners, planks along the long sides, and the timber waiting.
        [L / 2 + out, pole / 2, Wd / 2 + out, 0.022, pole, 0.022],
        [-L / 2 - out, pole / 2, Wd / 2 + out, 0.022, pole, 0.022],
        [L / 2 + out, pole / 2, -Wd / 2 - out, 0.022, pole, 0.022],
        [-L / 2 - out, pole / 2, -Wd / 2 - out, 0.022, pole, 0.022],
        [0, high * 0.6 + 0.02, Wd / 2 + out, L + 2 * out, 0.014, 0.07],
        [0, high * 0.6 + 0.02, -Wd / 2 - out, L + 2 * out, 0.014, 0.07],
        [L * 0.95, 0.018, Wd * 0.9, 0.5, 0.035, 0.045],
        [L * 0.95, 0.052, Wd * 0.9 + 0.01, 0.5, 0.035, 0.045],
        [L * 0.95, 0.018, Wd * 0.9 + 0.06, 0.5, 0.035, 0.045],
      ]);
      if (site.progress > 0.85 && !look.open) {
        const done = Math.min(1, (site.progress - 0.85) / 0.15);
        this.batch(s, roofMesh, [...look.roof], 1, this.root).set(1, (_, o) => {
          o[0] = site.x * M + (L * (1 - done) * 0.5 * 1.15 * c) / 2;
          o[1] = 0.024 + wallHigh + roofHigh / 2;
          o[2] = site.z * M - (L * (1 - done) * 0.5 * 1.15 * sn) / 2;
          o[3] = L * 1.15 * Math.max(0.3, done);
          o[4] = roofHigh;
          o[5] = Wd * 1.15;
          o[6] = site.yaw;
        });
      }
    }
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
    this.figure = figureOf(plan.body, s.quality.detail);
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
        part.tone === 3
          ? null
          : this.batch(
              s,
              meshes[part.shape],
              part.tone === 2 ? SKIN : part.tone === 4 ? EYES : part.tone ? wear.legs : wear.body,
              Math.max(1, plan.people.length),
              this.root,
            ),
      );
    });
    // Hair, each person's own colour (a batch a colour, whatever their group).
    this.hair = this.figure.parts.map((part) =>
      part.tone === 3
        ? HAIRS.map((c) =>
            this.batch(s, meshes[part.shape], c, Math.max(1, plan.people.length), this.root),
          )
        : null,
    );
    // A battle in its land this year or last (M87): the two hosts, each in its realm's
    // colour, spears in hand — as many a side as the setting draws.
    const battle = plan.life?.battle;
    this.soldiersEach = battle ? (SOLDIERS[s.quality.detail] ?? 10) : 0;
    this.soldiers = battle
      ? [battle.attacker.color, battle.defender.color].map((c) => {
          const body: Rgb = [c[0], c[1], c[2]],
            legs: Rgb = [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5];
          return this.figure.parts.map((part) =>
            this.batch(
              s,
              meshes[part.shape],
              part.tone === 2
                ? SKIN
                : part.tone === 4
                  ? EYES
                  : part.tone === 3
                    ? HAIRS[1]!
                    : part.tone
                      ? legs
                      : body,
              this.soldiersEach,
              this.root,
            ),
          );
        })
      : [];
    this.spears = battle
      ? this.batch(s, meshes.box, [0.52, 0.38, 0.24], this.soldiersEach * 2, this.root)
      : null;
    // Homes built more finely (M79): windows lit at night, chimneys, porches, fences.
    this.windows = null;
    this.lit = -1;
    const pieces = plan.homes.flatMap((h) =>
        homeDetail(
          look,
          wallHigh * storeys(h),
          wallHigh * storeys(h) + roofHigh,
          plan.era,
          s.quality.detail,
          !!h.household,
        ).map((p) => ({ h, p })),
      ),
      byRole = (role: string) => pieces.filter((x) => x.p.role === role),
      detailed = (list: typeof pieces, color: Rgb, material?: pc.StandardMaterial) => {
        if (!list.length) return;
        const b = new InstancedBatch(s, box, color, list.length, this.root, material);
        this.batches.push(b);
        b.set(list.length, (i, out) => {
          const { h, p } = list[i]!,
            c = Math.cos(h.yaw),
            sn = Math.sin(h.yaw);
          out[0] = h.x * M + p.x * c + p.z * sn;
          out[1] = p.y;
          out[2] = h.z * M - p.x * sn + p.z * c;
          out[3] = p.sx;
          out[4] = p.sy;
          out[5] = p.sz;
          out[6] = h.yaw + p.yaw;
        });
      };
    if (pieces.length) {
      this.windows = windowMaterial();
      detailed(byRole("window"), [0.14, 0.18, 0.24], this.windows);
      detailed(
        byRole("chimney"),
        plan.era === "industry" || plan.era === "modern" ? [0.6, 0.28, 0.2] : [0.55, 0.52, 0.48],
      );
      detailed(byRole("porch"), [...look.roof]);
      detailed(byRole("post"), [0.45, 0.3, 0.18]);
      detailed(byRole("fence"), [0.58, 0.42, 0.26]);
    }
    this.moments = [];
    // Beasts about it, as many as the setting draws; birds and fish where small motions are drawn.
    this.fauna.build(plan, s.quality.wildlife, s.quality.detail, s.quality.motion);
    // Its work: what its people carry, its mine and works, its road's traffic, its smoke
    // (the watched homes' hearths first).
    this.hearths =
      look.tent || look.open
        ? []
        : [...plan.homes]
            .sort((a, b) => Number(!!b.household) - Number(!!a.household))
            .map((h) => {
              // Out of the chimney's top where it has one; else through the roof's peak.
              const chimney = homeDetail(
                  look,
                  wallHigh * storeys(h),
                  wallHigh * storeys(h) + roofHigh,
                  plan.era,
                  1,
                  false,
                ).find((p) => p.role === "chimney"),
                c = Math.cos(h.yaw),
                sn = Math.sin(h.yaw);
              return chimney
                ? {
                    x: h.x + (chimney.x * c + chimney.z * sn) / M,
                    y: (chimney.y + chimney.sy / 2) / M,
                    z: h.z + (-chimney.x * sn + chimney.z * c) / M,
                  }
                : { x: h.x, y: (look.raised + wallHigh * storeys(h) + roofHigh) / M, z: h.z };
            });
    this.work.build(
      plan,
      s.quality,
      this.fauna.road,
      this.fauna.species,
      this.hearths,
      this.stacks,
    );
  }

  /** The beasts' clock held at this screen time, if held (for the look tools); null runs it. */
  heldFauna: number | null = null;

  /** What is drawn of each person, carried smoothly from frame to frame (view/presence.ts). */
  private readonly presence = new Map<string, Presence>();
  private presenceClock: number | null = null;
  private presenceOf = "";
  /** Each person's drawn size now (0 gone … 1 whole), and their stride's own clock. */
  private sizes: number[] = [];
  private strides: number[] = [];
  /** Each person's limbs as last drawn (a pitch a part, by their ref): eased toward each new pose. */
  private readonly limbs = new Map<string, Float32Array>();
  /** Each soldier's limbs as last drawn (a pitch a part, by their place in the ranks). */
  private soldierLimbs = new Float32Array(0);

  /** Put everyone where they are at time t. */
  update(t: number): void {
    const plan = this.plan;
    if (!plan) return;
    this.fields?.recolor(fieldColor(t));
    // Lamplight in the windows from dusk to dawn (set only as it changes).
    if (this.windows) {
      const glow = Math.round(lamplight((t % 86_400) / 3600) * 20) / 20;
      if (glow !== this.lit) {
        this.lit = glow;
        glowWindows(this.windows, glow);
      }
    }
    // (The beasts move by the screen's clock: a look, at any speed the world runs.)
    const screen = this.heldFauna ?? performance.now() / 1000;
    this.fauna.update(screen);
    const parts = this.figure.parts,
      // Strides and the motions of work: by the screen's clock, each person a little out of step.
      clock = performance.now() / 1000,
      // The battle, if its land was fought over (its soldiers stand where they stand).
      troops = this.soldiers.length ? battleOf(plan, this.soldiersEach, clock) : [];
    const targets = plan.people.map((_, i) => momentOf(plan, i, t));
    // No one stands in anyone else, nor in a soldier; and no one jumps: each is carried to
    // where their day has them, however fast the world runs.
    keepApart(plan, targets, troops);
    const dt = this.presenceClock === null ? 0 : clock - this.presenceClock;
    this.presenceClock = clock;
    const drawn = present(
      this.presence,
      plan.people.map((p) => p.ref),
      targets,
      dt,
      villageSolids(plan),
    );
    this.moments = drawn.map((d) => d.moment);
    this.sizes = drawn.map((d) => d.size);
    this.strides = drawn.map((d) => d.stride);
    // Each limb eased toward its pose now: a stride begun or ended, a task taken up, is a
    // turn of the arm, not a jump of it.
    const ease = dt > 0 ? 1 - Math.exp(-Math.min(0.1, dt) / 0.08) : 1,
      pitches = plan.people.map((p, i) => {
        const m = this.moments[i]!;
        let drawnPitch = this.limbs.get(p.ref);
        if (!drawnPitch || drawnPitch.length !== parts.length) {
          drawnPitch = new Float32Array(parts.length).fill(Number.NaN);
          this.limbs.set(p.ref, drawnPitch);
        }
        if (m.hidden) return drawnPitch;
        const walking = m.activity === ACTIVITY.walking;
        parts.forEach((part, pi) => {
          const aim = limbPitch(part, m.task, walking, walking ? this.strides[i]! : clock, i),
            was = drawnPitch[pi]!;
          drawnPitch[pi] = Number.isNaN(was) ? aim : was + (aim - was) * ease;
        });
        return drawnPitch;
      });
    /** A part of person i's figure, where it is now. */
    const place = (out: number[], p: VillagePlan["people"][number], i: number, pi: number) => {
      const part = parts[pi]!,
        m = this.moments[i]!,
        size = (p.child ? 0.7 : 1) * this.figure.scale * (this.sizes[i] ?? 1),
        c = Math.cos(m.yaw),
        sn = Math.sin(m.yaw),
        // A limb swings about its hinge: in the stride, or in the work at hand.
        pitch = pitches[i]![pi]!,
        hinge = part.pivot ?? 0,
        dy = hinge - hinge * Math.cos(pitch),
        dz = -hinge * Math.sin(pitch),
        px = part.x,
        pz = part.z + dz;
      // The part's place about the figure's middle, turned to the way it faces.
      out[0] = m.x * M + (px * c + pz * sn) * size;
      out[1] = (part.y + dy + bobOf(m.task, clock, i)) * size;
      out[2] = m.z * M + (-px * sn + pz * c) * size;
      out[3] = part.sx * size;
      out[4] = part.sy * size;
      out[5] = part.sz * size;
      out[6] = m.yaw;
      out[7] = pitch;
    };
    this.people.forEach((batches, gi) => {
      const members = plan.people
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => personGroup(p) === gi && !this.moments[i]!.hidden);
      batches.forEach((batch, pi) =>
        batch?.set(members.length, (k, out) => place(out, members[k]!.p, members[k]!.i, pi)),
      );
    });
    // Hair, by each person's own colour.
    this.hair.forEach((colours, pi) => {
      if (!colours) return;
      const span = plan.body?.span ?? 70;
      colours.forEach((batch, hi) => {
        const wearers = plan.people
          .map((p, i) => ({ p, i }))
          .filter(({ p, i }) => !this.moments[i]!.hidden && hairOf(p.ref, p.age, span) === hi);
        batch.set(wearers.length, (k, out) => place(out, wearers[k]!.p, wearers[k]!.i, pi));
      });
    });
    // The battle, if its land was fought over: closing, fighting, falling, falling back.
    if (this.soldiers.length) {
      if (this.soldierLimbs.length !== 2 * this.soldiersEach * parts.length)
        this.soldierLimbs = new Float32Array(2 * this.soldiersEach * parts.length).fill(Number.NaN);
      /** A part of a soldier's figure now (lying on their back, if fallen). */
      const soldierPart = (out: number[], k: number, pi: number, side: number) => {
        const q = troops[side * this.soldiersEach + k]!,
          size = this.figure.scale * q.size,
          part = parts[pi]!,
          c = Math.cos(q.yaw),
          sn = Math.sin(q.yaw),
          walking = q.doing === "advance" || q.doing === "fall back",
          aim =
            q.doing === "fallen"
              ? 0
              : limbPitch(
                  part,
                  walking ? null : k % 2 ? "drill" : "brawl",
                  walking,
                  clock * (walking ? 1.4 : 1),
                  k + side * 31,
                ),
          // (Eased, as the villagers' are: from the march to the fight is a turn of the arm.)
          slot = ((side * this.soldiersEach + k) * parts.length + pi) | 0,
          was = this.soldierLimbs[slot]!,
          pitch = Number.isNaN(was) ? aim : was + (aim - was) * ease,
          hinge = part.pivot ?? 0,
          px = part.x;
        this.soldierLimbs[slot] = pitch;
        let py = part.y + hinge - hinge * Math.cos(pitch),
          pz = part.z - hinge * Math.sin(pitch),
          pp = pitch;
        if (q.doing === "fallen") {
          // On their back: what stood up lies back along the ground.
          const up = py;
          py = 0.06 + pz;
          pz = -up;
          pp = pitch - Math.PI / 2;
        }
        out[0] = q.x * M + (px * c + pz * sn) * size;
        out[1] = py * size;
        out[2] = q.z * M + (-px * sn + pz * c) * size;
        out[3] = part.sx * size;
        out[4] = part.sy * size;
        out[5] = part.sz * size;
        out[6] = q.yaw;
        out[7] = pp;
      };
      this.soldiers.forEach((batches, side) =>
        batches.forEach((batch, pi) =>
          batch.set(this.soldiersEach, (k, out) => soldierPart(out, k, pi, side)),
        ),
      );
      // Their spears: held upright on the march, thrust in the fight, dropped by the fallen.
      this.spears?.set(troops.length, (i, out) => {
        const q = troops[i]!,
          size = this.figure.scale * q.size,
          c = Math.cos(q.yaw),
          sn = Math.sin(q.yaw),
          fallen = q.doing === "fallen",
          thrust =
            q.doing === "fight"
              ? -0.5 - 0.7 * Math.abs(Math.sin(clock * 2 * Math.PI * 0.8 + i * 1.7))
              : -0.25,
          across = 0.13,
          ahead = fallen ? -0.35 : 0.05;
        out[0] = q.x * M + (across * c + ahead * sn) * size;
        out[1] = (fallen ? 0.03 : 0.36) * size;
        out[2] = q.z * M + (-across * sn + ahead * c) * size;
        out[3] = 0.018 * size;
        out[4] = 0.8 * size;
        out[5] = 0.018 * size;
        out[6] = q.yaw;
        out[7] = fallen ? -Math.PI / 2 : thrust;
      });
    }
    // What they carry, where they go with it.
    let n = 0;
    plan.people.forEach((p, i) => {
      const m = this.moments[i]!;
      if (m.hidden || !m.carry) return;
      const c =
        this.carriers[n] ?? (this.carriers[n] = { x: 0, z: 0, yaw: 0, carry: "tool", size: 1 });
      c.x = m.x * M;
      c.z = m.z * M;
      c.yaw = m.yaw;
      c.carry = m.carry;
      c.size = (p.child ? 0.7 : 1) * this.figure.scale * (this.sizes[i] ?? 1);
      n++;
    });
    this.carriers.length = n;
    this.work.update((t % 86_400) / 3600, screen, this.carriers);
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

  /** Everyone in sight now: where (metres), doing what, at what (for the look tools). */
  peopleNow(): {
    name: string;
    x: number;
    z: number;
    activity: number;
    task: string | null;
    size: number;
  }[] {
    const plan = this.plan;
    if (!plan) return [];
    return this.moments.flatMap((m, i) =>
      m.hidden
        ? []
        : [
            {
              name: plan.people[i]!.name,
              x: m.x,
              z: m.z,
              activity: m.activity,
              task: m.task,
              size: this.sizes[i] ?? 1,
            },
          ],
    );
  }

  /** Everyone carrying something now: where (metres) and what (for the look tools). */
  carriersNow(): { x: number; z: number; carry: string }[] {
    return this.carriers.map((c) => ({ x: c.x / M, z: c.z / M, carry: c.carry }));
  }

  /** Every beast about the village now (for the look tools). */
  faunaNow(): ReturnType<FaunaLayer["now"]> {
    return this.fauna.now();
  }

  /** How many beasts, birds and fish are drawn now. */
  get beastsDrawn(): number {
    return this.fauna.drawn;
  }

  /** The beast nearest a screen point, if no one is: its lineage and what it is doing. */
  pickBeast(x: number, y: number): PickedBeast | null {
    return this.fauna.pick(x, y);
  }

  mark(index: number | null): void {
    this.marked = index;
    if (index === null) this.marker.enabled = false;
  }

  /** Light a beast about the village (as picked), or none. */
  markBeast(index: number | null): void {
    this.fauna.mark(index);
  }

  /** Light a beast of a lineage about the village, if one stands there. */
  markLineage(ref: string): boolean {
    return this.fauna.markLineage(ref);
  }

  /**
   * What the people in view are saying now (M86), as signs over their heads: at most `most`
   * of them, the nearest first.
   */
  bubbles(
    most = 24,
  ): { key: string; text: string; at: { x: number; y: number } | null; priority: number }[] {
    const plan = this.plan;
    if (!plan) return [];
    const cam = this.stage.camera.camera!,
      eye = this.stage.camera.getPosition(),
      clock = performance.now() / 1000,
      head = new pc.Vec3(),
      out: { key: string; text: string; at: { x: number; y: number } | null; priority: number }[] =
        [];
    this.moments.forEach((m, i) => {
      const text = sayOf(plan, i, m, clock);
      if (!text) return;
      const p = plan.people[i]!,
        tall = 0.66 * (p.child ? 0.7 : 1) * this.figure.scale;
      head.set(m.x * M, tall, m.z * M);
      const d = head.distance(eye);
      if (d > 14) return;
      const at = cam.worldToScreen(head);
      out.push({
        key: p.ref,
        text,
        at: at.z > 0 ? { x: at.x, y: at.y } : null,
        priority: -d,
      });
    });
    return out.sort((a, b) => b.priority - a.priority).slice(0, most);
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
