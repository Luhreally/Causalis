// A village under the microscope (docs/architecture §9, §28): its ground, fields
// that green and ripen with the year, the pasture and water, the road out, homes
// with their roofs, the square or the market hall, and the watched people going
// about their day. One unit is ten metres; people are drawn three times their size
// so a phone can see them. Instanced throughout: a village is a handful of draw calls.
import * as pc from "playcanvas";
import type { VillagePlan } from "../bridge/index.ts";
import {
  biomeColor,
  figureOf,
  houseLook,
  momentOf,
  personGroup,
  type Figure,
  type Moment,
  type PartShape,
} from "../view/index.ts";
import { InstancedBatch, capsuleMesh, coneMesh, cylinderMesh } from "./batch.ts";
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

  /** Lay out a village from its plan. */
  build(plan: VillagePlan): void {
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
    disc(140, [g[0] * 0.85, g[1] * 0.85, g[2] * 0.85]);
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
    const road = new InstancedBatch(
      s,
      cylinderMesh(s, Math.SQRT1_2, 1, 4),
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
      const patch = cylinderMesh(s, Math.SQRT1_2, 1, 4),
        side = quarters.blockM * M * 0.94;
      QUARTER_COLORS.forEach((color, use) => {
        if (!use) return;
        const blocks = quarters.uses.map((u, k) => ({ u, k })).filter((b) => b.u === use);
        if (!blocks.length) return;
        const batch = new InstancedBatch(s, patch, color, blocks.length, this.root);
        batch.set(blocks.length, (i, out) => {
          const k = blocks[i]!.k,
            half = (quarters.blocks - 1) / 2;
          out[0] = ((k % quarters.blocks) - half) * quarters.blockM * M;
          out[1] = 0.012;
          out[2] = (Math.floor(k / quarters.blocks) - half) * quarters.blockM * M;
          out[3] = out[5] = side;
          out[4] = 0.01;
          out[6] = Math.PI / 4;
        });
      });
      const temple = quarters.uses.indexOf(5);
      if (temple >= 0) {
        const hall = new InstancedBatch(s, patch, [0.92, 0.9, 0.84], 1, this.root),
          half = (quarters.blocks - 1) / 2;
        hall.set(1, (_, out) => {
          out[0] = ((temple % quarters.blocks) - half) * quarters.blockM * M;
          out[1] = 0.6;
          out[2] = (Math.floor(temple / quarters.blocks) - half) * quarters.blockM * M;
          out[3] = out[5] = 4.2;
          out[4] = 1.2;
          out[6] = Math.PI / 4;
        });
      }
    }
    disc(2.2, [0.66, 0.6, 0.48], 0, 0, 0.016);
    this.fields = new InstancedBatch(
      s,
      cylinderMesh(s, Math.SQRT1_2, 1, 4),
      fieldColor(0),
      plan.fields.length,
      this.root,
    );
    this.fields.set(plan.fields.length, (i, out) => {
      const f = plan.fields[i]!;
      out[0] = f.x * M;
      out[1] = 0.02;
      out[2] = f.z * M;
      out[3] = f.w * M;
      out[4] = 0.02;
      out[5] = f.d * M;
      out[6] = f.yaw + Math.PI / 4;
    });
    // Homes, as the land builds them (its design): walls of its material, four-square
    // or round, long or wide; roofs pitched to the rain, flat, or conical; tents whole
    // cones of hide. The watched homes lighter.
    const look = houseLook(plan.house),
      sides = look.round ? 8 : 4,
      box = cylinderMesh(s, Math.SQRT1_2, 1, 4),
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
      roofMesh = flat ? box : coneMesh(s, Math.SQRT1_2, 1, sides),
      walls = new InstancedBatch(s, shell, [...look.wall], plan.homes.length, this.root),
      watched = new InstancedBatch(s, shell, lighter, plan.homes.length, this.root),
      roofs = new InstancedBatch(s, roofMesh, [...look.roof], plan.homes.length, this.root);
    const place = (list: VillagePlan["homes"][number][], batch: InstancedBatch) =>
      batch.set(list.length, (i, out) => {
        const h = list[i]!;
        out[0] = h.x * M;
        // Nests and platforms stand off the ground.
        out[1] = look.raised + wallHigh / 2;
        out[2] = h.z * M;
        out[3] = look.length;
        out[4] = wallHigh;
        out[5] = look.width;
        out[6] = h.yaw + Math.PI / 4;
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
      out[1] = look.raised + wallHigh + roofHigh / 2;
      out[2] = h.z * M;
      // The eaves overhang the walls a little (a flat roof sits on them).
      out[3] = look.length * (flat ? 1.02 : 1.15);
      out[4] = roofHigh;
      out[5] = look.width * (flat ? 1.02 : 1.15);
      out[6] = h.yaw + Math.PI / 4;
    });
    // The market hall, or the well in the square.
    const hall = new InstancedBatch(
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
      out[6] = Math.PI / 4;
    });
    // People: drawn three times their size, so a phone can see them — as their body is
    // built (one figure for a people, part by part, each part a batch per colour group).
    this.figure = figureOf(plan.body);
    const meshes: Record<PartShape, pc.Mesh> = {
      capsule: capsuleMesh(s, 0.11, 0.55),
      box: cylinderMesh(s, Math.SQRT1_2, 1, 4),
      cylinder: cylinderMesh(s, 0.5, 1, 8),
      cone: coneMesh(s, 0.5, 1, 8),
    };
    this.people = GROUP_COLORS.map((c) =>
      this.figure.parts.map(
        (part) =>
          new InstancedBatch(
            s,
            meshes[part.shape],
            part.tone ? [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7] : c,
            Math.max(1, plan.people.length),
            this.root,
          ),
      ),
    );
    this.moments = [];
  }

  /** Put everyone where they are at time t. */
  update(t: number): void {
    const plan = this.plan;
    if (!plan) return;
    this.fields?.recolor(fieldColor(t));
    this.moments = plan.people.map((_, i) => momentOf(plan, i, t));
    const parts = this.figure.parts;
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
            sn = Math.sin(m.yaw);
          // The part's place about the figure's middle, turned to the way it faces.
          out[0] = m.x * M + (part.x * c + part.z * sn) * size;
          out[1] = part.y * size;
          out[2] = m.z * M + (-part.x * sn + part.z * c) * size;
          out[3] = part.sx * size;
          out[4] = part.sy * size;
          out[5] = part.sz * size;
          out[6] = m.yaw + (part.shape === "box" ? Math.PI / 4 : 0);
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
