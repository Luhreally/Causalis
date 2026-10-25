// A town's square on its feast days and its market days, drawn (Phase 33 M174–M175): bunting
// strung pole to pole about the square, long tables on their trestles set with bread and pots and
// benches along them, a bonfire laid — lit at dusk, its flames flickering and its light on the
// ground about it, wider as the night comes on; and of a market morning, the stalls under their
// striped awnings with their goods. Placed once from the view's pure square (view/feast.ts) as
// the plan is built; shown and put away by the moment; the flames posed by the screen's clock.
import * as pc from "playcanvas";
import type { VillagePlan } from "../bridge/index.ts";
import {
  FLAG_COLORS,
  feastAt,
  feastScene,
  fireOf,
  flamesAt,
  lamplight,
  marketAt,
  marketScene,
  squareScale,
  type SquarePiece,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { glowMaterial } from "./glow.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1, // units per metre, as the village's
  DAY = 86_400;

const WOOD: Rgb = [0.5, 0.36, 0.22],
  BOARD: Rgb = [0.62, 0.46, 0.3],
  BREAD: Rgb = [0.8, 0.58, 0.3],
  LOGS: Rgb = [0.3, 0.2, 0.12],
  /** The awnings' stripes, in turn about the square; the goods laid out under them. */
  AWNINGS: readonly Rgb[] = [
    [0.86, 0.24, 0.2],
    [0.22, 0.44, 0.82],
    [0.95, 0.78, 0.24],
    [0.26, 0.62, 0.34],
  ],
  GOODS: readonly Rgb[] = [
    [0.82, 0.32, 0.2],
    [0.88, 0.72, 0.32],
    [0.42, 0.62, 0.26],
  ];

function put(out: number[], p: SquarePiece): void {
  out[0] = p.x * M;
  out[1] = p.y * M;
  out[2] = p.z * M;
  out[3] = p.sx * M;
  out[4] = p.sy * M;
  out[5] = p.sz * M;
  out[6] = p.yaw;
}

export class FeastLayer {
  private readonly stage: Stage;
  readonly root = new pc.Entity("feast");
  private batches: InstancedBatch[] = [];
  private readonly box: pc.Mesh;
  private readonly cyl: pc.Mesh;
  private readonly cone: pc.Mesh;
  /** The feast's dressing of the square, its fire, the market's stalls: each shown as a whole. */
  private readonly dressing = new pc.Entity("feast-dressing");
  private readonly fire = new pc.Entity("feast-fire");
  private readonly market = new pc.Entity("market-stalls");
  private readonly flameMaterial: pc.StandardMaterial;
  private readonly light: pc.Entity;
  private flames: InstancedBatch | null = null;
  private plan: VillagePlan | null = null;
  /** What shows now: the square dressed, its fire burning, the market standing. */
  private shown = { dressed: false, lit: false, market: false };
  private tally = { flags: 0, tables: 0, stalls: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    this.cyl = keptMesh(cylinderMesh(stage, 0.5, 1, 10));
    this.cone = keptMesh(coneMesh(stage, 0.5, 1, 7));
    const fire = new pc.StandardMaterial();
    fire.useLighting = false;
    fire.diffuse = new pc.Color(0, 0, 0);
    fire.emissive = new pc.Color(1, 0.55, 0.14);
    fire.update();
    this.flameMaterial = fire;
    // (The firelight on the square about it: a flat disc, added to what lies under it.)
    this.light = new pc.Entity("feast-firelight");
    this.light.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          pc.Mesh.fromGeometry(
            stage.device,
            new pc.PlaneGeometry({ halfExtents: new pc.Vec2(0.5, 0.5) }),
          ),
          glowMaterial(stage, [
            [0, "rgba(255,170,80,0.8)"],
            [0.45, "rgba(255,120,40,0.32)"],
            [1, "rgba(255,90,20,0)"],
          ]),
        ),
      ],
    });
    this.fire.addChild(this.light);
    for (const e of [this.dressing, this.fire, this.market]) {
      e.enabled = false;
      this.root.addChild(e);
    }
    parent.addChild(this.root);
  }

  private batch(
    group: pc.Entity,
    mesh: pc.Mesh,
    color: Rgb,
    count: number,
    material?: pc.Material,
  ): InstancedBatch {
    const b = new InstancedBatch(this.stage, mesh, color, Math.max(1, count), group, material);
    this.batches.push(b);
    return b;
  }

  /** Pieces placed once in a batch of their own (none: no batch). */
  private placed(group: pc.Entity, mesh: pc.Mesh, color: Rgb, pieces: readonly SquarePiece[]) {
    if (!pieces.length) return;
    this.batch(group, mesh, color, pieces.length).set(pieces.length, (i, out) =>
      put(out, pieces[i]!),
    );
  }

  /** Lay out the square's feast and its market for a plan (shown only on their days). */
  build(plan: VillagePlan): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.plan = plan;
    const f = feastScene(plan),
      m = marketScene(plan);
    this.placed(this.dressing, this.cyl, WOOD, f.poles);
    f.flags.forEach((flags, k) => this.placed(this.dressing, this.box, FLAG_COLORS[k]!, flags));
    this.placed(this.dressing, this.box, BOARD, f.tables);
    this.placed(this.dressing, this.box, WOOD, f.trestles);
    this.placed(this.dressing, this.cyl, BREAD, f.food);
    this.placed(this.dressing, this.cone, LOGS, [f.logs]);
    this.flames = this.batch(this.fire, this.cone, [1, 0.5, 0.1], 4, this.flameMaterial);
    this.placed(this.market, this.box, WOOD, m.stalls);
    this.placed(this.market, this.cyl, WOOD, m.posts);
    m.awnings.forEach((a, k) =>
      this.placed(this.market, this.box, AWNINGS[k % AWNINGS.length]!, a),
    );
    GOODS.forEach((color, k) =>
      this.placed(
        this.market,
        this.box,
        color,
        m.goods.filter((_, i) => i % GOODS.length === k),
      ),
    );
    this.tally = {
      flags: f.flags.reduce((n, l) => n + l.length, 0),
      tables: f.tables.length,
      stalls: m.stalls.length,
    };
    this.shown = { dressed: false, lit: false, market: false };
    this.dressing.enabled = this.fire.enabled = this.market.enabled = false;
  }

  /** The square at moment t: dressed on a feast day, its fire lit at dusk; the market of a market morning. */
  update(t: number, clock: number): void {
    const plan = this.plan;
    if (!plan) return;
    const at = feastAt(plan, t),
      now = { dressed: !!at?.dressed, lit: !!at?.lit, market: marketAt(plan, t) };
    if (now.dressed !== this.shown.dressed) this.dressing.enabled = now.dressed;
    if (now.lit !== this.shown.lit) this.fire.enabled = now.lit;
    if (now.market !== this.shown.market) this.market.enabled = now.market;
    this.shown = now;
    if (!now.lit || !this.flames) return;
    const flames = flamesAt(plan, clock);
    this.flames.set(flames.length, (i, out) => put(out, flames[i]!));
    // The firelight: wider as the dark comes on, flickering with the flames.
    const night = lamplight((((t % DAY) + DAY) % DAY) / 3600),
      flick = 0.92 + 0.08 * Math.sin(clock * 7.3),
      reach = (7 + 9 * night) * squareScale(plan) * 2 * M * flick,
      fire = fireOf(plan);
    // (Over a town's paved square, which stands a little above the ground.)
    this.light.setLocalPosition(fire.x * M, plan.town ? 0.045 : 0.012, fire.z * M);
    this.light.setLocalScale(reach, 1, reach);
  }

  /** What the square shows now (the look tools): feast 1 while dressed, lit 1 while its fire burns, market 1 while it stands. */
  counts(): Record<string, number> {
    return {
      feast: this.shown.dressed ? 1 : 0,
      lit: this.shown.lit ? 1 : 0,
      market: this.shown.market ? 1 : 0,
      flags: this.shown.dressed ? this.tally.flags : 0,
      tables: this.shown.dressed ? this.tally.tables : 0,
      stalls: this.shown.market ? this.tally.stalls : 0,
    };
  }
}
