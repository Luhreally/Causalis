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
import { boxMesh, placeInstance, type InstancedBatch } from "./batch.ts";
import type { FloraLayer } from "./flora.ts";
import type { LandLayer } from "./land.ts";
import { fadedMaterial, type Rgb, type Stage } from "./stage.ts";

/** A far town's mark: its roofs and walls as they read from far off, in one tone (linear), and how high it stands of its spread. */
const MARK: Rgb = [0.62, 0.34, 0.24];
const MARK_HIGH = 0.06;
/** The far clumps' core (region units from the town): within it all drawn, past it fewer by rank, as the square of the core over
 * the distance (render/flora.ts draws its near things so): the woods far off read by the ground's own crowns under them. */
const CLUMP_CORE = 40;
/** Whether the land's far clumps are drawn about a town at all (they are not: what they cost). */
const FAR_CLUMPS = false;

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
    readonly cuts: readonly pc.Mesh[];
    /** Those of its cuts furthest from the town (past the last of BANDS). */
    readonly beyond: readonly pc.Mesh[];
    readonly collar: pc.Mesh | null;
    readonly ground: pc.Entity;
    readonly sea: pc.Entity | null;
  } | null = null;
  private at: { x: number; y: number; z: number; k: number } | null = null;
  /** The land's woods far off (its far clumps: render/flora.ts) and its other towns and their fields (render/land.ts), drawn
   * again for this eye where they stand past the town's own ground; and as which making of them. */
  private woods: FloraLayer | null = null;
  private towns: LandLayer | null = null;
  private madeWoods = -2;
  private madeTowns = -2;
  private copies: {
    readonly of: InstancedBatch;
    /** The land's own instances it was copied from, and how many there were. */
    readonly buffer: pc.VertexBuffer;
    readonly count: number;
    /** Its own: those of them that can be seen from the town. */
    readonly mine: pc.VertexBuffer | null;
    readonly drawn: pc.MeshInstance;
  }[] = [];
  private readonly copiesAt = new pc.Entity("far woods and towns");
  /** The land's towns' and fields' parts drawn for this eye (toned as the land's, faded about the town: stage.ts). */
  private readonly townLook = fadedMaterial();
  private sunOf: pc.Entity | null = null;
  private heightAt: ((x: number, z: number) => number) | null = null;
  private ref: string | null = null;
  private on = false;

  private readonly stage: Stage;

  constructor(stage: Stage) {
    this.stage = stage;
    const app = stage.app;
    // (Its things drawn nearest first, the nearer hiding the farther before they are shaded.)
    this.layer = new pc.Layer({ name: "far land", opaqueSortMode: pc.SORTMODE_FRONT2BACK });
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
    this.holder.addChild(this.copiesAt);
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
      readonly towns?: LandLayer | null;
      /** The land's height at a point (region units), for its other towns' marks. */
      readonly heightAt?: (x: number, z: number) => number;
      /** The town's own key, never marked. */
      readonly ref?: string;
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
      const { cuts, beyond, collar } = cutAbout(this.stage, ground.mesh, o.x, o.y, o.z, reach),
        g = new pc.Entity("far ground");
      g.addComponent("render", {
        meshInstances: [
          ...cuts.map((cut) => new pc.MeshInstance(cut, ground.material)),
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
      this.shown = { source: ground.mesh, cuts, beyond, collar, ground: g, sea: s };
      this.holeAt = { x: o.x, y: o.y, z: o.z, r: reach };
    }
    // (Read each time it is shown: the land's tiles are painted after it is first laid, and again with the season.)
    this.tones = tonesAbout(ground.material, o.x, o.z, reach);
    this.shownMaterial = ground.material;
    this.at = { x: o.x, y: o.y, z: o.z, k: o.k };
    this.woods = o.woods ?? null;
    this.towns = o.towns ?? null;
    this.heightAt = o.heightAt ?? null;
    this.ref = o.ref ?? null;
    this.madeWoods = -2;
    this.madeTowns = -2;
    return true;
  }
  private holeAt: { x: number; y: number; z: number; r: number } | null = null;
  /**
   * The land's own colours about the town as its ground's shader reads them (its tiles' texels, linear): its dry ground's
   * mean and its water's, within the town's own ground (null: none there). What the town's own are toned to (render/village.ts).
   */
  tones: { readonly ground: Rgb | null; readonly water: Rgb | null } | null = null;

  /**
   * The land's tiles' share of water at a point of it (land units) as its ground's shader reads it (its water's texels,
   * blended between the four about the point), or null where its land is not shown: the look tools hold a town's shore to it.
   */
  waterRead(x: number, z: number): number | null {
    const material = this.shownMaterial;
    if (!material) return null;
    const param = (name: string) =>
        (material.getParameter(name) as { data?: unknown } | undefined)?.data,
      tex = param("uWater") as pc.Texture | undefined,
      map = param("uTileMap") as number[] | undefined,
      water = (tex as { _levels?: (Uint8Array | null)[] } | undefined)?._levels?.[0] ?? null;
    if (!tex || !water || !map || !(map[3]! > 0.5)) return null;
    const size = tex.width,
      fx = (x + map[0]!) / map[1]!,
      fz = (z + map[0]!) / map[1]!,
      i = Math.max(0, Math.min(size - 2, Math.floor(fx))),
      j = Math.max(0, Math.min(size - 2, Math.floor(fz))),
      u = Math.max(0, Math.min(1, fx - i)),
      v = Math.max(0, Math.min(1, fz - j)),
      a = (p: number, q: number) => water[4 * (q * size + p) + 3]! / 255;
    return (
      (a(i, j) * (1 - u) + a(i + 1, j) * u) * (1 - v) +
      (a(i, j + 1) * (1 - u) + a(i + 1, j + 1) * u) * v
    );
  }
  private shownMaterial: pc.Material | null = null;

  /** What it draws (the look tools): whether, its land's facets kept and lifted about the town, its copies, the tones read. */
  info(): {
    on: boolean;
    facets: number;
    collar: number;
    beyond: number;
    copies: number;
    instances: number;
    tones: FarLand["tones"];
  } {
    const s = this.shown;
    return {
      on: this.on,
      facets: s ? s.cuts.reduce((n, cut) => n + cut.primitive[0]!.count / 3, 0) : 0,
      collar: s?.collar ? s.collar.vertexBuffer.numVertices / 3 : 0,
      beyond: s ? s.beyond.reduce((n, cut) => n + cut.primitive[0]!.count / 3, 0) : 0,
      copies: this.copies.length,
      instances:
        this.copies.reduce((n, c) => n + c.drawn.instancingCount, 0) +
        (this.marks?.drawn.instancingCount ?? 0),
      tones: this.tones,
    };
  }

  /** Which of its parts are drawn (the look tools, to time each): its ground and sea, its land's woods, towns and fields. */
  parts(o: {
    ground?: boolean;
    beyond?: boolean;
    sea?: boolean;
    copies?: boolean;
    clumps?: boolean;
    towns?: boolean;
  }): void {
    const s = this.shown;
    if (s && o.ground !== undefined) s.ground.enabled = o.ground;
    if (s && o.beyond !== undefined)
      for (const m of s.ground.render!.meshInstances)
        if (s.beyond.includes(m.mesh)) m.visible = o.beyond;
    if (s?.sea && (o.sea ?? o.ground) !== undefined) s.sea.enabled = (o.sea ?? o.ground)!;
    if (o.copies !== undefined) this.copiesAt.enabled = o.copies;
    for (const c of this.copies) {
      const town = c.drawn.material === this.townLook,
        on = town ? o.towns : o.clumps;
      if (on !== undefined && c.drawn.node) c.drawn.node.enabled = on;
    }
    if (o.towns !== undefined && this.marks?.drawn.node) this.marks.drawn.node.enabled = o.towns;
  }

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
    const was = shown?.cuts[0]?.vertexBuffer;
    if (shown && was && was !== shown.source.vertexBuffer) {
      const now = shown.source.vertexBuffer as pc.VertexBuffer | null;
      if (now && now.numVertices === was.numVertices)
        for (const cut of shown.cuts) cut.vertexBuffer = now;
      else {
        this.clear();
        return;
      }
    }
    // (The land's batches made anew, or one let go: drawn again from those it has now.)
    const madeWoods = this.woods?.farMade ?? -1,
      madeTowns = this.towns?.farMade ?? -1;
    let stale = this.madeWoods !== madeWoods || this.madeTowns !== madeTowns;
    for (const c of this.copies) {
      const src = c.of.drawing;
      if (src.instancingData?.vertexBuffer !== c.buffer || src.instancingCount !== c.count)
        stale = true;
    }
    if (stale) this.copy(madeWoods, madeTowns);
    const p = main.getPosition();
    // (Not drawn at all where the eye sees none of it: all it sees on the town's own ground.)
    const seen = this.inSight(main, lens, p, (this.holeAt?.r ?? 0) / at.k);
    if (this.eye.enabled !== seen) {
      this.eye.enabled = seen;
      this.sun.enabled = seen;
    }
    if (!seen) return;
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
    const sun = (this.sunOf ??= this.stage.app.root.findByName("sun") as pc.Entity | null),
      light = sun?.light;
    if (sun && light) {
      this.sun.setRotation(sun.getRotation());
      const mineLight = this.sun.light!;
      mineLight.color = light.color;
      mineLight.intensity = light.intensity;
    }
  }

  /**
   * Whether the town's eye sees past its own ground (`own`: how far that reaches, its units): its eye over its own ground and
   * every corner of its sight coming down on it within that (the ground it sees lies within those corners), or not.
   */
  private inSight(main: pc.Entity, lens: pc.CameraComponent, p: pc.Vec3, own: number): boolean {
    const r = own;
    if (p.x * p.x + p.z * p.z >= r * r) return true;
    const t = Math.tan((lens.fov * Math.PI) / 360),
      aspect = lens.aspectRatio || 1,
      tv = lens.horizontalFov ? t / aspect : t,
      th = lens.horizontalFov ? t : t * aspect,
      f = main.forward,
      u = main.up,
      x = main.right;
    for (let c = 0; c < 4; c++) {
      const sx = c & 1 ? th : -th,
        sy = c & 2 ? tv : -tv,
        dx = f.x + x.x * sx + u.x * sy,
        dy = f.y + x.y * sx + u.y * sy,
        dz = f.z + x.z * sx + u.z * sy;
      if (dy >= -1e-6) return true;
      const k = -p.y / dy,
        gx = p.x + dx * k,
        gz = p.z + dz * k;
      if (gx * gx + gz * gz >= r * r) return true;
    }
    return false;
  }

  /**
   * The land's far clumps, its towns' standing parts and its fields drawn for this eye: the land's own batches' instances (its
   * clumps in their own material, the towns' and fields' toned as theirs are), each given the town's square and a reach for
   * its fade (stage.ts fadedMaterial), so they stand only past where the town's own ground comes up to its land (RISEN of its
   * reach), shrinking to their feet nearer; the town itself, as its land draws it, within that and never drawn twice.
   */
  private copy(madeWoods: number, madeTowns: number): void {
    this.dropCopies();
    this.madeWoods = madeWoods;
    this.madeTowns = madeTowns;
    const at = this.at,
      hole = this.holeAt;
    if (!at || !hole) return;
    const reach = (hole.r * RISEN) / 0.94,
      near = [at.x, at.y, at.z, 0],
      fade = [-1, 1, reach, 0],
      // (Those wholly faded about the town, and those past where its haze hides all, never drawn: only the rest are copied,
      // into a store of this eye's own. The haze's end is the town's, in the land's units, from anywhere the eye may be.)
      hidden = reach * 0.72,
      hazed = this.stage.app.scene.fog.end * at.k + 2 * hole.r;
    this.townLook.setParameter("uNear", near);
    this.townLook.setParameter("uNearK", fade);
    const put = (of: InstancedBatch | null, look: pc.Material | null) => {
      const src = of?.drawing,
        buffer = src?.instancingData?.vertexBuffer;
      if (!of || !src || !buffer) return;
      const all = of.placed,
        count = src.instancingCount,
        keep: number[] = [];
      for (let i = 0; i < count; i++) {
        const d = Math.hypot(all[i * 16 + 12]! - at.x, all[i * 16 + 14]! - at.z);
        if (d <= hidden || d >= hazed) continue;
        // (Its rank, carried in its matrix's last corner with its lift: render/batch.ts rank.)
        const packed = all[i * 16 + 15]! - 1,
          rank = packed - 2 * Math.floor(packed * 0.5);
        if (rank < Math.min(1, (CLUMP_CORE / d) ** 2)) keep.push(i);
      }
      if (!keep.length) return;
      const data = new Float32Array(keep.length * 16);
      keep.forEach((i, j) => data.set(all.subarray(i * 16, i * 16 + 16), j * 16));
      const mine = new pc.VertexBuffer(this.stage.device, buffer.format, keep.length, {
        usage: pc.BUFFER_STATIC,
        data,
      });
      const drawn = new pc.MeshInstance(src.mesh, look ?? src.material);
      drawn.setInstancing(mine);
      drawn.instancingCount = keep.length;
      if (!look) {
        drawn.setParameter("uNear", near);
        drawn.setParameter("uNearK", fade);
      }
      drawn.cull = false;
      const e = new pc.Entity("far copy");
      e.addComponent("render", {
        meshInstances: [drawn],
        layers: [this.layer.id],
        castShadows: false,
        receiveShadows: false,
      });
      this.copiesAt.addChild(e);
      this.copies.push({ of, buffer, count, mine, drawn });
    };
    // (Its far woods by the ground's own crowns alone: their clumps drawn again here cost a phone 0.85 ms of the town view's
    // frame on sorrel and saffron, timed in the same page, even thinned to a tenth.)
    if (FAR_CLUMPS) for (const of of this.woods?.farClumps ?? []) put(of, null);
    // (Its other towns as marks: each a low block of its roofs' tone over as much ground as it spreads, as a town reads from
    // far off; its own never.)
    const towns = (this.towns?.farTowns() ?? []).filter((t) => {
      const d = Math.hypot(t.x - at.x, t.z - at.z);
      return t.ref !== this.ref && d > hidden && d < hazed;
    });
    if (towns.length && this.heightAt) {
      const data = new Float32Array(towns.length * 16),
        t = [0, 0, 0, 1, 1, 1, 0, 0, MARK[0], MARK[1], MARK[2]];
      towns.forEach((town, i) => {
        const w = Math.max(0.05, town.r * 1.2),
          h = w * MARK_HIGH;
        t[0] = town.x;
        t[1] = this.heightAt!(town.x, town.z) + h / 2;
        t[2] = town.z;
        t[3] = w;
        t[4] = h;
        t[5] = w;
        placeInstance(data, i * 16, t, true);
      });
      const format = pc.VertexFormat.getDefaultInstancingFormat(this.stage.device),
        mine = new pc.VertexBuffer(this.stage.device, format, towns.length, {
          usage: pc.BUFFER_STATIC,
          data,
        }),
        drawn = new pc.MeshInstance((this.markMesh ??= boxMesh(this.stage)), this.townLook);
      drawn.setInstancing(mine);
      drawn.instancingCount = towns.length;
      drawn.cull = false;
      const e = new pc.Entity("far marks");
      e.addComponent("render", {
        meshInstances: [drawn],
        layers: [this.layer.id],
        castShadows: false,
        receiveShadows: false,
      });
      this.copiesAt.addChild(e);
      this.marks = { drawn, mine };
    }
  }
  private markMesh: pc.Mesh | null = null;
  private marks: { drawn: pc.MeshInstance; mine: pc.VertexBuffer } | null = null;

  private dropCopies(): void {
    for (const c of this.copies) {
      c.drawn.node?.destroy();
      c.mine?.destroy();
    }
    this.copies = [];
    if (this.marks) {
      this.marks.drawn.node?.destroy();
      this.marks.mine.destroy();
      this.marks = null;
    }
  }

  private clear(): void {
    this.dropCopies();
    this.madeWoods = -2;
    this.madeTowns = -2;
    const s = this.shown;
    if (s) {
      // (Its cuts alone, let go before their drawings are, which would let go of their meshes and with them their vertices:
      // the land's own vertices stay the land's.)
      for (const cut of s.cuts)
        (cut as { vertexBuffer: pc.VertexBuffer | null }).vertexBuffer = null;
      s.ground.destroy();
      s.sea?.destroy();
    }
    this.shown = null;
    this.shownMaterial = null;
    this.holeAt = null;
    this.tones = null;
    this.at = null;
    this.visible = false;
  }
}

/** Where the land is cut away under a town's own ground (of how far that reaches), and how far out it comes up from the town's
 * level to its own (as the town's own ground rises to its land's: view/townflora.ts townRiseAt). */
const HOLE = 0.85,
  RISEN = 1.6,
  /** Into how many wedges about the town the land past its rise is cut (cutAbout). */
  WEDGES = 16,
  /** And at what distances from it (land units) each wedge is cut again: a far wedge's box takes in less of the eye's sight. */
  BANDS = [40, 100];

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
): { cuts: pc.Mesh[]; beyond: pc.Mesh[]; collar: pc.Mesh | null } {
  const count = source.vertexBuffer.numVertices,
    at = new Float32Array(count * 3);
  source.getPositions(at);
  const kept: number[] = [],
    far: number[] = [],
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
    else {
      kept.push(v);
      far.push(a + b + c);
    }
  }
  // (Kept in wedges about the town, each drawn alone, so that those out of its eye's sight are not drawn at all: seen about the
  // town, the eye's sight takes in a few. Each nearest the town first: the eye stands about it, so what is nearer is drawn
  // first and hides what lies behind it before that is shaded.)
  const wedges: number[][] = Array.from({ length: WEDGES * (BANDS.length + 1) }, () => []);
  kept.forEach((v, i) => {
    const cx = at[3 * v]! + at[3 * v + 3]! + at[3 * v + 6]! - 3 * x,
      cz = at[3 * v + 2]! + at[3 * v + 5]! + at[3 * v + 8]! - 3 * z,
      w = Math.floor(((Math.atan2(cz, cx) / (2 * Math.PI) + 1) % 1) * WEDGES) % WEDGES,
      r = Math.hypot(cx, cz) / 3;
    let band = 0;
    while (band < BANDS.length && r >= BANDS[band]!) band++;
    wedges[band * WEDGES + w]!.push(i);
  });
  const cuts: pc.Mesh[] = [],
    beyond: pc.Mesh[] = [];
  for (const [b, wedge] of wedges.entries()) {
    if (!wedge.length) continue;
    wedge.sort((i, j) => far[i]! - far[j]!);
    const order = new Uint32Array(wedge.length * 3),
      lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity];
    wedge.forEach((i, n) => {
      const v = kept[i]!;
      for (let q = 0; q < 3; q++) {
        order[3 * n + q] = v + q;
        for (let c = 0; c < 3; c++) {
          const p = at[3 * (v + q) + c]!;
          if (p < lo[c]!) lo[c] = p;
          if (p > hi[c]!) hi[c] = p;
        }
      }
    });
    const mesh = new pc.Mesh(stage.device);
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
    const box = new pc.BoundingBox();
    box.setMinMax(new pc.Vec3(lo[0], lo[1], lo[2]), new pc.Vec3(hi[0], hi[1], hi[2]));
    mesh.aabb = box;
    cuts.push(mesh);
    if (b >= WEDGES * BANDS.length) beyond.push(mesh);
  }
  if (!near.length) return { cuts, beyond, collar: null };
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
  return { cuts, beyond, collar };
}

/**
 * The land's own colours within `reach` of a point (land units), off its ground material's tiles (stage.ts groundMaterial: a
 * texel a tile, `uTileMap` placing them; the land's alpha 255 less its woods' cover, the water's 255 where it is water): the
 * mean of its dry tiles' colours (the woods' crowns over them as much as they cover, as the shader draws them on average)
 * and of its water's, each linear (0 ... 1). None read: null.
 */
function tonesAbout(
  material: pc.Material,
  x: number,
  z: number,
  reach: number,
): { ground: Rgb | null; water: Rgb | null } | null {
  const levels = (t: pc.Texture | undefined) =>
    (t as { _levels?: (Uint8Array | null)[] } | undefined)?._levels?.[0] ?? null;
  const param = (name: string) =>
    (material.getParameter(name) as { data?: unknown } | undefined)?.data;
  const landTex = param("uLand") as pc.Texture | undefined,
    waterTex = param("uWater") as pc.Texture | undefined,
    map = param("uTileMap") as number[] | undefined,
    land = levels(landTex),
    water = levels(waterTex);
  if (!landTex || !land || !water || !map || !(map[3]! > 0.5)) return null;
  const size = landTex.width,
    // (Texel i, j lies at (i, j) times uTileMap.y less uTileMap.x: stage.ts GROUND_PS.)
    step = map[1]!,
    off = map[0]!,
    g = new Float64Array(4),
    w = new Float64Array(4),
    lo = (v: number) => Math.max(0, Math.floor((v - reach + off) / step)),
    hi = (v: number) => Math.min(size - 1, Math.ceil((v + reach + off) / step));
  for (let j = lo(z); j <= hi(z); j++)
    for (let i = lo(x); i <= hi(x); i++) {
      const px = i * step - off,
        pz = j * step - off;
      if ((px - x) ** 2 + (pz - z) ** 2 > reach * reach) continue;
      const q = 4 * (j * size + i),
        into = water[q + 3]! > 127 ? w : g,
        from = into === w ? water : land;
      into[0]! += from[q]! / 255;
      into[1]! += from[q + 1]! / 255;
      into[2]! += from[q + 2]! / 255;
      into[3]!++;
    }
  const mean = (a: Float64Array): Rgb | null =>
    a[3]! ? [a[0]! / a[3]!, a[1]! / a[3]!, a[2]! / a[3]!] : null;
  return { ground: mean(g), water: mean(w) };
}
