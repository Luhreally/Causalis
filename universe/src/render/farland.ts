// A town's land about it, seen from the town (asked 2026-11-21: "when you look low across a town, the land around it should be
// the real land"). Past the town's own ground the land is drawn as its land view draws it — its relief, its ground's colours
// and woods' cover, its lakes and sea — by the land's own meshes and materials, untouched: a second eye in the land's own
// units, where the town's eye stands as the land would have it (LAND_SCALE times a town's metre), looking the same way with
// the same lens, its near and far as the town's in the land's units. A picture made so is the town's own picture of the land
// at its scale, the same depth for the same point, so the two eyes share one depth: the land is drawn after the town and
// only where the town has drawn nothing nearer. Its haze is the land's (the town's own, in the land's units). Where the town's
// own ground lies the land is cut away, and the rest of it set a few metres lower, so neither shows through the other there;
// about it the land comes up from the town's level to its own as the town's own ground would (cutAbout), so the town's flat
// ground runs on into its land with no step.
import * as pc from "playcanvas";
import type { InstancedBatch } from "./batch.ts";
import type { FloraLayer } from "./flora.ts";
import type { Stage } from "./stage.ts";

/** How much lower the land is set than the town's own ground (its units: a few metres, under all the town's ground). */
const DROP = 0.02;

export class FarLand {
  private readonly layer: pc.Layer;
  private readonly eye: pc.Entity;
  private readonly sun: pc.Entity;
  private readonly holder: pc.Entity;
  private readonly fog = new pc.FogParams();
  /** What is shown: the land's ground and sea (their meshes, the ground's cut about the town), and where the town is. */
  private shown: {
    readonly source: pc.Mesh;
    readonly cut: pc.Mesh;
    readonly collar: pc.Mesh | null;
    readonly ground: pc.Entity;
    readonly sea: pc.Entity | null;
  } | null = null;
  private at: { x: number; y: number; z: number; k: number } | null = null;
  /** The land's woods far off (its far clumps: render/flora.ts), drawn again for this eye where they stand past the town's
   * own trees; and as which making of them. */
  private woods: FloraLayer | null = null;
  private woodsMade = -1;
  private clumps: { readonly of: InstancedBatch; readonly drawn: pc.MeshInstance }[] = [];
  private readonly clumpsAt = new pc.Entity("far woods");
  private on = false;

  private readonly stage: Stage;

  constructor(stage: Stage) {
    this.stage = stage;
    const app = stage.app;
    this.layer = new pc.Layer({ name: "far land" });
    app.scene.layers.push(this.layer);
    this.eye = new pc.Entity("far land eye");
    this.eye.addComponent("camera", {
      layers: [this.layer.id],
      clearColorBuffer: false,
      clearDepthBuffer: false,
      clearStencilBuffer: false,
      priority: 1,
      fov: 45,
    });
    this.eye.camera!.fog = this.fog;
    this.eye.enabled = false;
    app.root.addChild(this.eye);
    // (Its own sun, as the scene's: no shadows cast for it, and none of the town's things lit twice.)
    this.sun = new pc.Entity("far land sun");
    this.sun.addComponent("light", {
      type: "directional",
      layers: [this.layer.id],
      castShadows: false,
    });
    this.sun.enabled = false;
    app.root.addChild(this.sun);
    this.holder = new pc.Entity("far land");
    app.root.addChild(this.holder);
    this.holder.addChild(this.clumpsAt);
    // (Placed as the frame is drawn, after all else has moved the town's eye.)
    app.on("prerender", () => {
      if (this.on) this.follow();
    });
  }

  /**
   * The land about a town to show: its ground and sea as its land view has them now (render/region.ts, its "region" root;
   * none built, none shown), the town's square on it (land units) and how far the town's own ground reaches (its units), `k` a town's
   * unit in the land's (LAND_ACROSS / VILLAGE_METRE). Null: none.
   */
  show(
    o: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
      readonly reach: number;
      readonly k: number;
      readonly woods?: FloraLayer | null;
    } | null,
  ): boolean {
    const land = this.stage.root.findByName("region"),
      terrain = o ? (land?.findByName("terrain") as pc.Entity | null) : null,
      seaSheet = o ? (land?.findByName("sea") as pc.Entity | null) : null,
      ground = terrain?.render?.meshInstances[0],
      sea = seaSheet?.render?.meshInstances[0];
    if (!o || !ground) {
      this.clear();
      return false;
    }
    const reach = o.reach * o.k,
      had = this.shown;
    if (
      !had ||
      had.source !== ground.mesh ||
      this.holeAt?.x !== o.x ||
      this.holeAt.y !== o.y ||
      this.holeAt.z !== o.z ||
      this.holeAt.r !== reach
    ) {
      this.clear();
      const { cut, collar } = cutAbout(this.stage, ground.mesh, o.x, o.y, o.z, reach),
        g = new pc.Entity("far ground");
      g.addComponent("render", {
        meshInstances: [
          new pc.MeshInstance(cut, ground.material),
          ...(collar ? [new pc.MeshInstance(collar, ground.material)] : []),
        ],
        layers: [this.layer.id],
        castShadows: false,
        receiveShadows: false,
      });
      this.holder.addChild(g);
      let s: pc.Entity | null = null;
      if (sea) {
        s = new pc.Entity("far sea");
        s.addComponent("render", {
          meshInstances: [new pc.MeshInstance(sea.mesh, sea.material)],
          layers: [this.layer.id],
          castShadows: false,
          receiveShadows: false,
        });
        s.setLocalPosition(seaSheet!.getLocalPosition());
        this.holder.addChild(s);
      }
      this.shown = { source: ground.mesh, cut, collar, ground: g, sea: s };
      this.holeAt = { x: o.x, y: o.y, z: o.z, r: reach };
    }
    this.at = { x: o.x, y: o.y, z: o.z, k: o.k };
    this.woods = o.woods ?? null;
    this.woodsMade = -1;
    return true;
  }
  private holeAt: { x: number; y: number; z: number; r: number } | null = null;

  /** Whether it is drawn now (a town shown with its land about it). */
  set visible(on: boolean) {
    on &&= !!this.shown;
    if (on === this.on) return;
    this.on = on;
    this.eye.enabled = on;
    this.sun.enabled = on;
    this.holder.enabled = on;
  }
  get visible(): boolean {
    return this.on;
  }

  /** Its eye where the town's stands, in the land's units; its sun and haze the scene's. */
  private follow(): void {
    const at = this.at,
      main = this.stage.camera,
      lens = main.camera!,
      mine = this.eye.camera!;
    if (!at) return;
    // (The land's vertices made anew under it, as many: drawn from those; the land let go of: none drawn.)
    const shown = this.shown;
    if (shown && shown.cut.vertexBuffer !== shown.source.vertexBuffer) {
      const now = shown.source.vertexBuffer as pc.VertexBuffer | null;
      if (now && now.numVertices === shown.cut.vertexBuffer.numVertices)
        shown.cut.vertexBuffer = now;
      else {
        this.clear();
        return;
      }
    }
    const woods = this.woods;
    if (woods && woods.farMade !== this.woodsMade) this.plantClumps(woods);
    for (const c of this.clumps) {
      const n = c.of.drawing.instancingCount;
      if (c.drawn.instancingCount !== n) c.drawn.instancingCount = n;
    }
    const p = main.getPosition();
    this.eye.setPosition(at.x + p.x * at.k, at.y + p.y * at.k + DROP, at.z + p.z * at.k);
    this.eye.setRotation(main.getRotation());
    if (mine.fov !== lens.fov) mine.fov = lens.fov;
    if (mine.horizontalFov !== lens.horizontalFov) mine.horizontalFov = lens.horizontalFov;
    const near = lens.nearClip * at.k,
      far = lens.farClip * at.k;
    if (mine.nearClip !== near) mine.nearClip = near;
    if (mine.farClip !== far) mine.farClip = far;
    const scene = this.stage.app.scene.fog,
      fog = this.fog;
    fog.type = scene.type;
    fog.color.copy(scene.color);
    fog.density = scene.density / at.k;
    fog.start = scene.start * at.k;
    fog.end = scene.end * at.k;
    const sun = this.stage.app.root.findByName("sun") as pc.Entity | null,
      light = sun?.light;
    if (sun && light) {
      this.sun.setRotation(sun.getRotation());
      const mineLight = this.sun.light!;
      mineLight.color = light.color;
      mineLight.intensity = light.intensity;
    }
  }

  /**
   * The far clumps drawn for this eye: the land's own batches' instances and materials, each drawing given the town's square
   * and reach for its fade (stage.ts fadedMaterial), so they stand only past where the town's own trees and ground come up to
   * its land (RISEN of its reach), shrinking to their feet nearer, as the land's give way to the trees where its eye looks.
   */
  private plantClumps(woods: FloraLayer): void {
    this.dropClumps();
    this.woodsMade = woods.farMade;
    const at = this.at,
      hole = this.holeAt;
    if (!at || !hole) return;
    const reach = (hole.r * RISEN) / 0.94;
    for (const of of woods.farClumps) {
      if (!of) continue;
      const src = of.drawing,
        buffer = src.instancingData?.vertexBuffer;
      if (!buffer) continue;
      const drawn = new pc.MeshInstance(src.mesh, src.material);
      drawn.setInstancing(buffer);
      drawn.instancingCount = src.instancingCount;
      drawn.setParameter("uNear", [at.x, at.y, at.z, 0]);
      drawn.setParameter("uNearK", [-1, 1, reach, 0]);
      drawn.cull = false;
      const e = new pc.Entity("far clumps");
      e.addComponent("render", {
        meshInstances: [drawn],
        layers: [this.layer.id],
        castShadows: false,
        receiveShadows: false,
      });
      this.clumpsAt.addChild(e);
      this.clumps.push({ of, drawn });
    }
  }

  private dropClumps(): void {
    for (const c of this.clumps) c.drawn.node?.destroy();
    this.clumps = [];
  }

  private clear(): void {
    this.dropClumps();
    this.woodsMade = -1;
    const s = this.shown;
    if (s) {
      // (Its cut alone, let go before its drawing is, which would let go of its mesh and with it its vertices: the land's own
      // vertices stay the land's.)
      (s.cut as { vertexBuffer: pc.VertexBuffer | null }).vertexBuffer = null;
      s.ground.destroy();
      s.sea?.destroy();
    }
    this.shown = null;
    this.holeAt = null;
    this.at = null;
    this.visible = false;
  }
}

/** Where the land is cut away under a town's own ground (of how far that reaches), and how far out it comes up from the town's
 * level to its own (as the town's own ground rises to its land's: view/townflora.ts townRiseAt). */
const HOLE = 0.85,
  RISEN = 1.6;

/**
 * A land's ground mesh about a town (each facet three vertices of its own, in order: render/region.ts build): the facets
 * wholly under the town's own ground (within HOLE of its `reach`, land units) left out; those near it (a corner within RISEN
 * of its reach) copied into a collar of their own, their heights brought to the town's level (`y`) at its own ground's edge and
 * rising to the land's own by RISEN, so the town's flat ground and its land meet with no step (the sea's floor kept as it
 * lies, under the sea); the rest kept as they are, their vertices the land's own, shared.
 */
function cutAbout(
  stage: Stage,
  source: pc.Mesh,
  x: number,
  y: number,
  z: number,
  reach: number,
): { cut: pc.Mesh; collar: pc.Mesh | null } {
  const count = source.vertexBuffer.numVertices,
    at = new Float32Array(count * 3);
  source.getPositions(at);
  const kept: number[] = [],
    near: number[] = [],
    hole2 = (reach * HOLE) ** 2,
    risen2 = (reach * RISEN) ** 2,
    d2 = (v: number) => (at[3 * v]! - x) ** 2 + (at[3 * v + 2]! - z) ** 2;
  for (let v = 0; v + 2 < count; v += 3) {
    const a = d2(v),
      b = d2(v + 1),
      c = d2(v + 2);
    if (a < hole2 && b < hole2 && c < hole2) continue;
    if (a < risen2 || b < risen2 || c < risen2) near.push(v);
    else kept.push(v, v + 1, v + 2);
  }
  const order = new Uint32Array(kept),
    mesh = new pc.Mesh(stage.device);
  mesh.vertexBuffer = source.vertexBuffer;
  mesh.indexBuffer[0] = new pc.IndexBuffer(
    stage.device,
    pc.INDEXFORMAT_UINT32,
    order.length,
    pc.BUFFER_STATIC,
    order,
  );
  mesh.primitive[0] = {
    type: pc.PRIMITIVE_TRIANGLES,
    base: 0,
    baseVertex: 0,
    count: order.length,
    indexed: true,
  };
  mesh.aabb = source.aabb;
  if (!near.length) return { cut: mesh, collar: null };
  const colours = new Uint8Array(count * 4);
  source.getColors(colours);
  const n = near.length * 3,
    pos = new Float32Array(n * 3),
    nor = new Float32Array(n * 3),
    col = new Uint8Array(n * 4),
    own = reach,
    span = reach * (RISEN - 1);
  near.forEach((v, f) => {
    for (let q = 0; q < 3; q++) {
      const from = v + q,
        to = 3 * f + q,
        px = at[3 * from]!,
        py = at[3 * from + 1]!,
        pz = at[3 * from + 2]!,
        t = Math.max(0, Math.min(1, (Math.sqrt(d2(from)) - own) / span)),
        w = t * t * (3 - 2 * t);
      pos[3 * to] = px;
      pos[3 * to + 1] = py < 0 ? py : y + (py - y) * w;
      pos[3 * to + 2] = pz;
      for (let c = 0; c < 4; c++) col[4 * to + c] = colours[4 * from + c]!;
    }
    // (Each facet lit as it now lies, flat, facing up: as the land's own are.)
    const o = 9 * f,
      ux = pos[o + 3]! - pos[o]!,
      uy = pos[o + 4]! - pos[o + 1]!,
      uz = pos[o + 5]! - pos[o + 2]!,
      vx = pos[o + 6]! - pos[o]!,
      vy = pos[o + 7]! - pos[o + 1]!,
      vz = pos[o + 8]! - pos[o + 2]!;
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    if (ny < 0) [nx, ny, nz] = [-nx, -ny, -nz];
    const len = Math.hypot(nx, ny, nz) || 1;
    for (let q = 0; q < 3; q++) {
      nor[o + 3 * q] = nx / len;
      nor[o + 3 * q + 1] = ny / len;
      nor[o + 3 * q + 2] = nz / len;
    }
  });
  const collar = new pc.Mesh(stage.device);
  collar.setPositions(pos);
  collar.setNormals(nor);
  collar.setColors32(col);
  collar.update();
  return { cut: mesh, collar };
}
