// A colony's port drawn (Phase 71, first slice): its apron, pads and sheds; its yard's stacks; its craft coming down, standing and going
// up, in the colours of those who run them, a far people's a different shape from a realm's. A dozen and a half draw calls at the most,
// a few hundred boxes, and a little arithmetic a frame. It stands in the colony's own layer, so a town's rebuilding does not touch it.
import * as pc from "playcanvas";
import type { PortPlan } from "../bridge/index.ts";
import { portCartAt, craftAt, portLayout, type PortBox, type PortLayout } from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";

type Rgb = readonly [number, number, number];

/** Their own colour, unlit, in no fog: a flame, a beacon, a lit window. */
function selfLit(color: Rgb): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(color[0], color[1], color[2]);
  m.useFog = false;
  m.update();
  return m;
}

const TONES: readonly Rgb[] = [
  [0.86, 0.42, 0.14],
  [0.2, 0.46, 0.72],
  [0.76, 0.72, 0.28],
];
const MOST_CALLERS = 6;

export class PortLayer {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("port");
  private readonly meshes: { box: pc.Mesh; cyl: pc.Mesh; cone: pc.Mesh };
  private batches: InstancedBatch[] = [];
  private key = "";
  private plan: PortPlan | null = null;
  private layout: PortLayout | null = null;
  private hulls: InstancedBatch | null = null;
  private drives: InstancedBatch | null = null;
  private bands: InstancedBatch[] = [];
  private saucers: InstancedBatch | null = null;
  private domes: InstancedBatch | null = null;
  private flames: InstancedBatch | null = null;
  private carts: InstancedBatch | null = null;
  private beacons: InstancedBatch | null = null;
  /** What was last drawn, for the gate: craft on pads, craft in the air, by whom. */
  shown = { standing: 0, flying: 0, far: 0, near: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    this.root.enabled = false;
    this.meshes = {
      box: keptMesh(boxMesh(stage)),
      cyl: keptMesh(cylinderMesh(stage, 0.5, 1, 14)),
      cone: keptMesh(coneMesh(stage, 0.5, 1, 10)),
    };
    stage.onUpdate(() => this.frame());
  }

  /** Where it stands, from the town's middle (units); null: there is none. */
  get where(): { x: number; z: number } | null {
    return this.layout && this.root.enabled ? { x: this.layout.x, z: this.layout.z } : null;
  }

  /** Its plan, or none, about a town level to `flat` units before the port's own room. */
  build(plan: PortPlan | null, seed: number, flat: number): void {
    const key = plan
      ? `${seed} ${Math.round(flat / 4)} ${plan.pads} ${plan.sheds} ${plan.stacks} ${plan.quiet} ${plan.callers.map((c) => c.color.join()).join()}`
      : "";
    this.plan = plan;
    if (key === this.key) {
      this.root.enabled = !!plan;
      return;
    }
    this.key = key;
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.bands = [];
    this.hulls =
      this.drives =
      this.saucers =
      this.domes =
      this.flames =
      this.carts =
      this.beacons =
        null;
    this.layout = null;
    this.root.enabled = !!plan;
    if (!plan) return;
    const layout = portLayout(plan, seed, flat),
      s = this.stage,
      { box, cyl, cone } = this.meshes,
      add = (b: InstancedBatch) => {
        this.batches.push(b);
        return b;
      },
      boxes = (list: readonly PortBox[], color: Rgb, material?: pc.Material) => {
        const b = add(
          new InstancedBatch(
            s,
            box,
            [color[0], color[1], color[2]],
            Math.max(1, list.length),
            this.root,
            material,
          ),
        );
        b.set(list.length, (i, out) => {
          const p = list[i]!;
          out[0] = p.x;
          out[1] = p.y;
          out[2] = p.z;
          out[3] = p.w;
          out[4] = p.h;
          out[5] = p.d;
          out[6] = 0;
        });
        return b;
      };
    this.layout = layout;
    this.root.setLocalPosition(layout.x, 0, layout.z);
    this.root.setLocalEulerAngles(0, (layout.yaw * 180) / Math.PI, 0);
    // Its apron, raised clear of the ground it stands on.
    boxes(
      [{ x: 0, y: 0.1, z: 0, w: layout.width, h: 0.2, d: layout.depth, tone: 0 }],
      plan.quiet ? [0.21, 0.2, 0.2] : [0.3, 0.31, 0.34],
    );
    // Its pads, lit at the rim.
    const rims = add(
        new InstancedBatch(
          s,
          cyl,
          [1, 0.74, 0.2],
          Math.max(1, layout.pads.length),
          this.root,
          selfLit(plan.quiet ? [0.3, 0.2, 0.1] : [1, 0.72, 0.18]),
        ),
      ),
      pads = add(
        new InstancedBatch(s, cyl, [0.5, 0.51, 0.54], Math.max(1, layout.pads.length), this.root),
      );
    rims.set(layout.pads.length, (i, out) => {
      const p = layout.pads[i]!;
      out[0] = p.x;
      out[1] = 0.2;
      out[2] = p.z;
      out[3] = out[5] = 2 * p.r + 0.5;
      out[4] = 0.06;
      out[6] = 0;
    });
    pads.set(layout.pads.length, (i, out) => {
      const p = layout.pads[i]!;
      out[0] = p.x;
      out[1] = 0.24;
      out[2] = p.z;
      out[3] = out[5] = 2 * p.r;
      out[4] = 0.06;
      out[6] = 0;
    });
    boxes(
      layout.paint.map((p) => ({ ...p, y: 0.29 })),
      plan.quiet ? [0.36, 0.34, 0.3] : [0.94, 0.92, 0.82],
    );
    boxes(layout.sheds, plan.quiet ? [0.28, 0.26, 0.25] : [0.58, 0.6, 0.64]);
    // The sheds' lit doors, while anyone is at them.
    if (!plan.quiet)
      boxes(
        layout.sheds.map((b) => ({
          ...b,
          y: 1.1,
          z: b.z - b.d / 2 - 0.05,
          w: b.w * 0.74,
          h: 2.2,
          d: 0.1,
        })),
        [1, 0.86, 0.5],
        selfLit([1, 0.86, 0.5]),
      );
    // Its yard: what has come in, stacked.
    TONES.forEach((tone, t) => {
      boxes(
        layout.crates.filter((c) => c.tone === t),
        plan.quiet ? [tone[0] * 0.42, tone[1] * 0.42, tone[2] * 0.42] : tone,
      );
    });
    // Its tower.
    const tower = add(new InstancedBatch(s, cyl, [0.72, 0.74, 0.78], 1, this.root)),
      top = add(
        new InstancedBatch(
          s,
          cyl,
          [1, 1, 1],
          1,
          this.root,
          selfLit(plan.quiet ? [0.2, 0.2, 0.22] : [0.6, 0.92, 1]),
        ),
      );
    tower.set(1, (_, out) => {
      out[0] = layout.tower.x;
      out[1] = 4.2;
      out[2] = layout.tower.z;
      out[3] = out[5] = 1.5;
      out[4] = 8.4;
      out[6] = 0;
    });
    top.set(1, (_, out) => {
      out[0] = layout.tower.x;
      out[1] = 8.8;
      out[2] = layout.tower.z;
      out[3] = out[5] = 2.6;
      out[4] = 1;
      out[6] = 0;
    });
    if (plan.quiet) return;
    // Its craft: at most one a pad, in as many bands as there are callers.
    const n = Math.max(1, layout.pads.length);
    this.hulls = add(new InstancedBatch(s, cyl, [0.82, 0.84, 0.86], n, this.root));
    this.drives = add(new InstancedBatch(s, box, [0.34, 0.35, 0.38], 2 * n, this.root));
    for (const c of plan.callers.slice(0, MOST_CALLERS))
      this.bands.push(
        add(
          new InstancedBatch(
            s,
            box,
            [c.color[0], c.color[1], c.color[2]],
            n,
            this.root,
            selfLit(c.color),
          ),
        ),
      );
    if (plan.callers.some((c) => c.far)) {
      this.saucers = add(new InstancedBatch(s, cyl, [0.34, 0.3, 0.44], n, this.root));
      this.domes = add(new InstancedBatch(s, cone, [0.5, 0.42, 0.66], n, this.root));
    }
    this.flames = add(
      new InstancedBatch(s, cone, [1, 0.74, 0.32], n, this.root, selfLit([1, 0.74, 0.32])),
    );
    this.carts = add(new InstancedBatch(s, box, [0.9, 0.78, 0.18], 16, this.root));
    this.beacons = add(
      new InstancedBatch(s, box, [1, 0.2, 0.14], n * 2, this.root, selfLit([1, 0.22, 0.14])),
    );
  }

  private frame(): void {
    const plan = this.plan,
      layout = this.layout;
    if (!plan || !layout || !this.root.enabled || !this.hulls) return;
    const wall = performance.now() / 1000,
      now = layout.pads.map((_, i) => craftAt(plan, i, wall));
    let standing = 0,
      flying = 0,
      far = 0,
      near = 0;
    const seen: { i: number; far: boolean; band: number }[] = [];
    now.forEach((c, i) => {
      if (!c) return;
      if (c.high > 0) flying++;
      else standing++;
      const caller = plan.callers[c.caller]!;
      if (caller.far) far++;
      else near++;
      seen.push({ i, far: caller.far, band: c.caller });
    });
    this.shown = { standing, flying, far, near };
    const nearOnes = seen.filter((c) => !c.far),
      farOnes = seen.filter((c) => c.far),
      place = (i: number) => ({ p: layout.pads[i]!, h: now[i]!.high });
    this.hulls.set(nearOnes.length, (k, out) => {
      const { p, h } = place(nearOnes[k]!.i);
      out[0] = p.x;
      out[1] = h + 5.6;
      out[2] = p.z;
      out[3] = 4.4;
      out[4] = 11;
      out[5] = 4.4;
      out[6] = 0;
    });
    this.drives!.set(nearOnes.length * 2, (k, out) => {
      const { p, h } = place(nearOnes[k >> 1]!.i),
        side = k & 1 ? 1 : -1;
      out[0] = p.x + side * 3.4;
      out[1] = h + 2.4;
      out[2] = p.z;
      out[3] = 2.2;
      out[4] = 4.8;
      out[5] = 3;
      out[6] = 0;
    });
    this.bands.forEach((b, who) => {
      const mine = nearOnes.filter((c) => c.band === who);
      b.set(mine.length, (k, out) => {
        const { p, h } = place(mine[k]!.i);
        out[0] = p.x;
        out[1] = h + 8.4;
        out[2] = p.z;
        out[3] = 4.8;
        out[4] = 1.6;
        out[5] = 4.8;
        out[6] = 0;
      });
    });
    this.saucers?.set(farOnes.length, (k, out) => {
      const { p, h } = place(farOnes[k]!.i);
      out[0] = p.x;
      out[1] = h + 1.4;
      out[2] = p.z;
      out[3] = out[5] = 8.2;
      out[4] = 1;
      out[6] = 0;
    });
    this.domes?.set(farOnes.length, (k, out) => {
      const { p, h } = place(farOnes[k]!.i);
      out[0] = p.x;
      out[1] = h + 2.9;
      out[2] = p.z;
      out[3] = out[5] = 5;
      out[4] = 2.2;
      out[6] = 0;
    });
    const burning = seen.filter((c) => now[c.i]!.burn > 0);
    this.flames!.set(burning.length, (k, out) => {
      const c = burning[k]!,
        { p, h } = place(c.i),
        burn = now[c.i]!.burn,
        len = 12 * burn * (0.86 + 0.14 * Math.sin(wall * 37 + c.i));
      out[0] = p.x;
      out[1] = Math.max(0.3, h - len / 2);
      out[2] = p.z;
      out[3] = out[5] = 3.6;
      out[4] = len;
      out[6] = 0;
      out[7] = Math.PI;
    });
    this.carts!.set(Math.min(16, Math.ceil(plan.busy)), (i, out) => {
      const c = portCartAt(layout, i, wall);
      out[0] = c.x;
      out[1] = 0.62;
      out[2] = c.z;
      out[3] = 1;
      out[4] = 0.7;
      out[5] = 1.8;
      out[6] = c.yaw;
    });
    const blink = Math.sin(wall * 3.1) > 0;
    this.beacons!.set(blink ? layout.pads.length * 2 : 0, (i, out) => {
      const p = layout.pads[i >> 1]!,
        side = i & 1 ? 1 : -1;
      out[0] = p.x + side * (p.r + 0.4);
      out[1] = 0.8;
      out[2] = p.z;
      out[3] = out[5] = 0.5;
      out[4] = 1.2;
      out[6] = 0;
    });
  }
}
