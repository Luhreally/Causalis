// A planet as a globe: the sphere grid as one mesh, raised by its relief and
// coloured per cell by the lens, with a marker on the picked place. Only the
// colours change when the lens does; the shape is built once per planet.
// The look (art track A4): low-poly facets — each triangle flat, lit by its own face
// and coloured by the most of its three cells — under a glossy sea, with a glow at the rim.
import * as pc from "playcanvas";
import { nearestCell, sphereGrid, type SphereGrid } from "../kernel/index.ts";
import { globeRadius } from "../view/index.ts";
import { InstancedBatch, cylinderMesh, keptMesh } from "./batch.ts";
import { billboard, glowMaterial, type GlowStops } from "./glow.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

/** The rim of air: clear in the middle (the globe hides it), a blue ring at the edge, fading out. */
const HALO: GlowStops = [
  [0, "rgba(0,0,0,0)"],
  [0.68, "rgba(0,0,0,0)"],
  [0.757, "rgba(120,210,255,0.85)"],
  [0.84, "rgba(60,120,255,0.35)"],
  [1, "rgba(20,40,120,0)"],
];

/**
 * Each kind's globe (Phase 56): its sea's colour, its air's glow about the rim, its clouds — an oil
 * world's dark gloss under grey-brown air, a sulfur world's sour sea and yellow haze, an ice world's
 * slate sea and pale air, a methane world's amber sea under a thick orange haze. A rocky world's own.
 */
const KIND_GLOBES: Readonly<
  Record<string, { readonly sea: Rgb; readonly halo: GlowStops; readonly clouds: Rgb }>
> = {
  rocky: { sea: [0.08, 0.28, 0.62], halo: HALO, clouds: [1, 1, 1] },
  carbon: {
    sea: [0.05, 0.045, 0.04],
    halo: [
      [0, "rgba(0,0,0,0)"],
      [0.68, "rgba(0,0,0,0)"],
      [0.757, "rgba(190,170,140,0.8)"],
      [0.84, "rgba(120,100,80,0.35)"],
      [1, "rgba(60,50,40,0)"],
    ],
    clouds: [0.66, 0.6, 0.52],
  },
  sulfur: {
    sea: [0.1, 0.42, 0.34],
    halo: [
      [0, "rgba(0,0,0,0)"],
      [0.68, "rgba(0,0,0,0)"],
      [0.757, "rgba(240,225,120,0.85)"],
      [0.84, "rgba(200,170,60,0.35)"],
      [1, "rgba(120,90,20,0)"],
    ],
    clouds: [1, 0.95, 0.72],
  },
  ammonia: {
    sea: [0.22, 0.38, 0.46],
    halo: [
      [0, "rgba(0,0,0,0)"],
      [0.68, "rgba(0,0,0,0)"],
      [0.757, "rgba(210,232,240,0.85)"],
      [0.84, "rgba(150,185,205,0.35)"],
      [1, "rgba(70,100,130,0)"],
    ],
    clouds: [0.95, 0.98, 1],
  },
  methane: {
    sea: [0.26, 0.14, 0.05],
    halo: [
      [0, "rgba(0,0,0,0)"],
      [0.66, "rgba(0,0,0,0)"],
      [0.74, "rgba(255,170,70,0.95)"],
      [0.84, "rgba(225,120,30,0.5)"],
      [1, "rgba(140,60,10,0)"],
    ],
    clouds: [1, 0.74, 0.44],
  },
};

/** The lights of halls seen from orbit (Phase 10 M95): a warm point, soft about it. */
const LIGHTS: GlowStops = [
  [0, "rgba(255,238,176,1)"],
  [0.16, "rgba(255,212,122,0.8)"],
  [0.5, "rgba(255,172,72,0.22)"],
  [1, "rgba(255,140,40,0)"],
];

/** The most points of light a world's settled ground draws (one draw call; 16 triangles each). */
const FILLED_MOST = 4000;

/** A plate of a world's face breaking away (W6). */
type Plate = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ax: number;
  readonly ay: number;
  readonly az: number;
  readonly spin: number;
  readonly speed: number;
  /** How far from the strike, 0 … 1: how late it goes. */
  readonly late: number;
};
type Shards = {
  readonly plates: readonly Plate[];
  readonly plateOf: Int16Array;
  readonly rim: Uint8Array;
  readonly late: Float32Array;
  readonly base: Float32Array;
  readonly work: Float32Array;
};
/** How many lumps of rubble, and of them still hot, a world unmade leaves (one draw call each, 30 triangles a lump). */
const RUBBLE = 900,
  EMBERS = 140;
const BREAK_GLOW: GlowStops = [
    [0, "rgba(255,250,235,1)"],
    [0.3, "rgba(255,220,150,0.85)"],
    [0.6, "rgba(255,120,40,0.35)"],
    [1, "rgba(120,20,0,0)"],
  ],
  SHOCK: GlowStops = [
    [0, "rgba(0,0,0,0)"],
    [0.78, "rgba(255,160,90,0)"],
    [0.92, "rgba(255,235,200,0.9)"],
    [0.97, "rgba(255,170,110,0.4)"],
    [1, "rgba(120,40,10,0)"],
  ],
  CINDER: GlowStops = [
    [0, "rgba(255,120,40,0.75)"],
    [0.3, "rgba(190,50,12,0.3)"],
    [1, "rgba(60,10,0,0)"],
  ];

export class GlobeScene {
  private readonly stage: Stage;
  private grid: SphereGrid | null = null;
  private mesh: pc.Mesh | null = null;
  private entity: pc.Entity | null = null;
  private readonly marker: pc.Entity;
  private positions: Float32Array | null = null;
  /** For each drawn corner, the cell it colours by (three corners a triangle). */
  private corners: Int32Array | null = null;
  private colors: Uint8Array | null = null;
  private readonly sea: pc.Entity;
  private readonly halo: pc.Entity;
  private readonly clouds: pc.Entity;
  /** Whether the clouds are wanted (the Land lens: they would hide what other lenses paint). */
  private cloudy = true;
  /** Whether the world has seas to shine, and an air to glow about its rim (M81: not every world does). */
  private seas = true;
  private air = true;
  /** Halls on its face, seen from orbit (M95): each site's domes, and the glow of its lights. */
  private readonly hallRoot = new pc.Entity("halls");
  private halls: InstancedBatch | null = null;
  private lightMaterial: pc.Material | null = null;
  private readonly lights: pc.Entity[] = [];
  private hallSites: { x: number; y: number; z: number }[] = [];
  /** A world's settled ground, as points of light (Worlds filled). */
  private filled: InstancedBatch | null = null;
  /** Its world's kind as drawn (Phase 56), and each kind's air glow, made when first wanted. */
  private kindShown = "rocky";
  private readonly glows = new Map<string, pc.Material>();
  /** A world's corners as built, to break apart (W6). */
  private drawn: Float32Array | null = null;
  private breaking: Shards | null = null;
  /** The fire inside it as it breaks, its light about it and the ring it throws out; what is left. */
  private core: pc.Entity | null = null;
  private coreGlow: pc.Entity | null = null;
  private shock: pc.Entity | null = null;
  private readonly ruinRoot = new pc.Entity("ruin");
  private rubble: InstancedBatch | null = null;
  private embers: InstancedBatch | null = null;
  private cinderGlow: pc.Entity | null = null;
  private isRuin = false;
  private blackened = false;

  constructor(stage: Stage) {
    this.stage = stage;
    // The sea: a glossy shell at sea level, clear enough to show what a lens paints under it.
    const water = new pc.StandardMaterial();
    water.diffuse = new pc.Color(0.08, 0.28, 0.62);
    water.specular = new pc.Color(0.9, 0.95, 1);
    water.gloss = 0.86;
    water.opacity = 0.38;
    water.blendType = pc.BLEND_NORMAL;
    water.depthWrite = false;
    water.update();
    this.sea = new pc.Entity("sea");
    this.sea.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          pc.Mesh.fromGeometry(
            stage.device,
            new pc.SphereGeometry({ radius: 1.0005, latitudeBands: 48, longitudeBands: 96 }),
          ),
          water,
        ),
      ],
    });
    this.sea.enabled = false;
    stage.root.addChild(this.sea);
    // The air: a glow about the rim, a camera-facing disc behind the globe's middle.
    this.halo = billboard(stage, glowMaterial(stage, HALO), 1.32, stage.root);
    this.halo.enabled = false;
    // Clouds: a shell a little above the land, drifting slowly (a look, not the weather).
    this.clouds = new pc.Entity("clouds");
    this.clouds.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          pc.Mesh.fromGeometry(
            stage.device,
            new pc.SphereGeometry({ radius: 1.018, latitudeBands: 32, longitudeBands: 64 }),
          ),
          cloudMaterial(stage),
        ),
      ],
    });
    this.clouds.enabled = false;
    stage.root.addChild(this.clouds);
    stage.onUpdate((dt) => {
      if (this.clouds.enabled) this.clouds.rotateLocal(0, dt * 0.6, 0);
    });
    this.marker = new pc.Entity("marker");
    this.marker.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(cylinderMesh(stage, 0.012, 0.08, 12), flatMaterial([1, 1, 1])),
      ],
    });
    this.marker.enabled = false;
    stage.root.addChild(this.marker);
    stage.root.addChild(this.hallRoot);
    stage.root.addChild(this.ruinRoot);
    this.ruinRoot.enabled = false;
    stage.onUpdate((dt) => {
      if (this.ruinRoot.enabled) this.ruinRoot.rotateLocal(0, dt * 1.1, 0);
    });
  }

  /** Build the globe for a grid frequency and relief (once per planet). */
  build(frequency: number, elevation: Float32Array): void {
    // Relief can now be repainted. Release the previous GPU buffers and material before
    // allocating their replacements, especially on a phone with a small graphics budget.
    const oldMaterial = this.entity?.render?.meshInstances[0]?.material;
    this.entity?.destroy();
    this.entity = null;
    this.mesh?.destroy();
    oldMaterial?.destroy();
    // (A new face: whatever broke or burned of the last one is no part of it: W6.)
    this.breaking = null;
    this.ruin(false);
    this.blacken(false);
    this.breakLight(0, 0, 0);
    const grid = sphereGrid(frequency),
      n = grid.count,
      positions = new Float32Array(n * 3);
    for (let c = 0; c < n; c++) {
      // Seabeds a little under the sea's shell, so its gloss lies over them.
      const r = elevation[c]! <= 0 ? 0.997 : globeRadius(elevation[c]!);
      positions[c * 3] = grid.positions[c * 3]! * r;
      positions[c * 3 + 1] = grid.positions[c * 3 + 1]! * r;
      positions[c * 3 + 2] = grid.positions[c * 3 + 2]! * r;
    }
    // Every triangle its own three corners, with its face's normal, wound to face out:
    // facets, not a blur.
    const tris = grid.triangles.length / 3,
      corners = new Int32Array(tris * 3),
      at = new Float32Array(tris * 9),
      normals = new Float32Array(tris * 9),
      indices = new Uint32Array(tris * 3);
    for (let t = 0; t < tris; t++) {
      const o = 9 * t;
      for (let k = 0; k < 3; k++) {
        const cell = grid.triangles[3 * t + k]!;
        corners[3 * t + k] = cell;
        at[o + 3 * k] = positions[3 * cell]!;
        at[o + 3 * k + 1] = positions[3 * cell + 1]!;
        at[o + 3 * k + 2] = positions[3 * cell + 2]!;
      }
      const ux = at[o + 3]! - at[o]!,
        uy = at[o + 4]! - at[o + 1]!,
        uz = at[o + 5]! - at[o + 2]!,
        vx = at[o + 6]! - at[o]!,
        vy = at[o + 7]! - at[o + 1]!,
        vz = at[o + 8]! - at[o + 2]!;
      let nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx;
      const outward = nx * at[o]! + ny * at[o + 1]! + nz * at[o + 2]! >= 0;
      if (!outward) [nx, ny, nz] = [-nx, -ny, -nz];
      const len = Math.hypot(nx, ny, nz) || 1;
      for (let k = 0; k < 3; k++) {
        normals[o + 3 * k] = nx / len;
        normals[o + 3 * k + 1] = ny / len;
        normals[o + 3 * k + 2] = nz / len;
      }
      indices[3 * t] = 3 * t;
      indices[3 * t + 1] = outward ? 3 * t + 1 : 3 * t + 2;
      indices[3 * t + 2] = outward ? 3 * t + 2 : 3 * t + 1;
    }
    this.drawn = at;
    const mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(at);
    mesh.setNormals(normals);
    this.colors = new Uint8Array(tris * 12).fill(128);
    mesh.setColors32(this.colors);
    mesh.setIndices(indices);
    mesh.update();
    const material = new pc.StandardMaterial();
    material.diffuseVertexColor = true;
    material.diffuse = new pc.Color(1, 1, 1);
    // Matte facets: the era's plain lit colour, no sheen.
    material.specular = new pc.Color(0.06, 0.06, 0.08);
    material.gloss = 0.1;
    material.update();
    this.entity = new pc.Entity("globe");
    this.entity.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)] });
    this.stage.root.addChild(this.entity);
    this.grid = grid;
    this.mesh = mesh;
    this.positions = positions;
    this.corners = corners;
    this.sea.enabled = this.seas;
    this.halo.enabled = this.air;
    this.clouds.enabled = this.cloudy;
    // (A world anew: none of the last one's halls, or its lights.)
    this.setHalls([]);
    this.setFilled([]);
  }

  /** What the world has about it: seas, an air (its glow), clouds. */
  features(seas: boolean, air: boolean, clouds: boolean): void {
    this.seas = seas;
    this.air = air;
    this.cloudy = clouds;
    const on = !!this.entity?.enabled;
    this.sea.enabled = on && seas;
    this.halo.enabled = on && air;
    this.clouds.enabled = on && clouds;
  }

  /** Draw it as its world's kind (Phase 56): its sea, its air's glow and its clouds its kind's. */
  kind(kind: string): void {
    const look = KIND_GLOBES[kind] ?? KIND_GLOBES.rocky!;
    if (kind === this.kindShown || !KIND_GLOBES[kind]) return;
    this.kindShown = kind;
    const sea = this.sea.render!.meshInstances[0]!.material as pc.StandardMaterial;
    sea.diffuse = new pc.Color(look.sea[0], look.sea[1], look.sea[2]);
    sea.update();
    let glow = this.glows.get(kind);
    if (!glow) this.glows.set(kind, (glow = glowMaterial(this.stage, look.halo)));
    this.halo.render!.meshInstances[0]!.material = glow;
    const clouds = this.clouds.render!.meshInstances[0]!.material as pc.StandardMaterial;
    clouds.diffuse = new pc.Color(look.clouds[0], look.clouds[1], look.clouds[2]);
    clouds.update();
  }

  /** Show the clouds or not (they are for the Land lens). */
  set weather(on: boolean) {
    this.cloudy = on;
    this.clouds.enabled = on && !!this.entity?.enabled;
  }

  set visible(on: boolean) {
    const whole = on && !this.isRuin;
    if (this.entity) this.entity.enabled = whole;
    this.sea.enabled = whole && this.entity !== null && this.seas;
    this.halo.enabled = whole && this.entity !== null && this.air;
    this.clouds.enabled = whole && this.entity !== null && this.cloudy;
    this.hallRoot.enabled = whole;
    this.ruinRoot.enabled = on && this.isRuin;
    if (!on) {
      this.marker.enabled = false;
      this.breakLight(0, 0, 0);
    }
  }

  /**
   * Begin breaking it (W6): its face in plates about its own cells, each with its own way out and its own turn, the plates nearest
   * the strike going first. Nothing else about it is a list: the shards are its own triangles, the colours its own.
   */
  breakBegin(strike: { x: number; y: number; z: number }): void {
    const grid = this.grid,
      corners = this.corners,
      drawn = this.drawn;
    if (!grid || !corners || !drawn) return;
    const PLATES = 72,
      unit = grid.positions,
      hash = (i: number, k: number) => {
        const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
        return s - Math.floor(s);
      },
      plates: Plate[] = [];
    for (let i = 0; i < PLATES; i++) {
      const y = 1 - (2 * (i + 0.5)) / PLATES,
        r = Math.sqrt(1 - y * y),
        a = i * 2.399963 + hash(i, 1) * 0.5,
        cx = r * Math.cos(a),
        cz = r * Math.sin(a),
        ax = hash(i, 2) - 0.5,
        ay = hash(i, 3) - 0.5,
        az = hash(i, 4) - 0.5,
        al = Math.hypot(ax, ay, az) || 1,
        away = Math.acos(Math.max(-1, Math.min(1, cx * strike.x + y * strike.y + cz * strike.z)));
      plates.push({
        x: cx,
        y,
        z: cz,
        ax: ax / al,
        ay: ay / al,
        az: az / al,
        spin: 0.8 + hash(i, 5) * 2.6,
        speed: 0.8 + hash(i, 6) * 1.1,
        late: away / Math.PI,
      });
    }
    const cellPlate = new Int16Array(grid.count);
    for (let c = 0; c < grid.count; c++) {
      // (A little of each cell's own wander, so a plate's edge is no straight line.)
      const px = unit[3 * c]! + (hash(c, 7) - 0.5) * 0.12,
        py = unit[3 * c + 1]! + (hash(c, 8) - 0.5) * 0.12,
        pz = unit[3 * c + 2]! + (hash(c, 9) - 0.5) * 0.12;
      let best = 0,
        most = -Infinity;
      for (let i = 0; i < PLATES; i++) {
        const p = plates[i]!,
          d = p.x * px + p.y * py + p.z * pz;
        if (d > most) {
          most = d;
          best = i;
        }
      }
      cellPlate[c] = best;
    }
    const tris = corners.length / 3,
      plateOf = new Int16Array(tris),
      rim = new Uint8Array(tris),
      late = new Float32Array(tris);
    for (let t = 0; t < tris; t++) {
      const a = corners[3 * t]!,
        b = corners[3 * t + 1]!,
        c = corners[3 * t + 2]!,
        pa = cellPlate[a]!;
      plateOf[t] = pa;
      rim[t] = pa !== cellPlate[b]! || pa !== cellPlate[c]! ? 1 : 0;
      late[t] =
        Math.acos(
          Math.max(
            -1,
            Math.min(
              1,
              unit[3 * a]! * strike.x + unit[3 * a + 1]! * strike.y + unit[3 * a + 2]! * strike.z,
            ),
          ),
        ) / Math.PI;
    }
    this.breaking = { plates, plateOf, rim, late, base: drawn.slice(), work: drawn };
    const m = this.entity?.render?.meshInstances[0]?.material as pc.StandardMaterial | undefined;
    if (m) {
      m.cull = pc.CULLFACE_NONE;
      m.update();
    }
    this.sea.enabled = false;
    if (!this.core) {
      const fire = new pc.StandardMaterial();
      fire.useLighting = false;
      fire.diffuse = new pc.Color(0, 0, 0);
      fire.emissive = new pc.Color(1, 0.5, 0.12);
      fire.update();
      this.core = new pc.Entity("core");
      this.core.addComponent("render", {
        meshInstances: [
          new pc.MeshInstance(
            pc.Mesh.fromGeometry(
              this.stage.device,
              new pc.SphereGeometry({ radius: 1, latitudeBands: 16, longitudeBands: 24 }),
            ),
            fire,
          ),
        ],
      });
      this.stage.root.addChild(this.core);
      this.coreGlow = billboard(this.stage, glowMaterial(this.stage, BREAK_GLOW), 1, this.stage.root, true);
      this.shock = billboard(this.stage, glowMaterial(this.stage, SHOCK), 1, this.stage.root, true);
    }
  }

  /**
   * Where it has got to (W6): `crack` 0 … 1, the seams opening from the strike out; `apart` 0 … 1, the plates going, those
   * nearest first, out past the eye. Every corner of its face moved by a plate's way and turn: one mesh, one draw call.
   */
  breakTo(crack: number, apart: number): void {
    const b = this.breaking;
    if (!b || !this.mesh) return;
    const out = b.work,
      base = b.base,
      n = b.plateOf.length,
      moved = b.plates.map((p) => {
        const k = Math.max(0, Math.min(1, (apart - p.late * 0.35) / 0.65)),
          e = k * k * (3 - 2 * k),
          turn = p.spin * e,
          push = p.speed * 7 * e * e + 0.25 * k;
        return { p, c: Math.cos(turn), s: Math.sin(turn), push };
      });
    for (let t = 0; t < n; t++) {
      const o = 9 * t;
      if (b.rim[t]! && crack >= b.late[t]!) {
        // (A seam open: nothing there but the fire under it.)
        for (let i = 0; i < 9; i++) out[o + i] = 0;
        continue;
      }
      const m = moved[b.plateOf[t]!]!,
        p = m.p;
      for (let k = 0; k < 3; k++) {
        const q = o + 3 * k,
          vx = base[q]! - p.x,
          vy = base[q + 1]! - p.y,
          vz = base[q + 2]! - p.z,
          dot = (vx * p.ax + vy * p.ay + vz * p.az) * (1 - m.c);
        // (Rodrigues about its own axis, then out along its own way.)
        out[q] = p.x + vx * m.c + (p.ay * vz - p.az * vy) * m.s + p.ax * dot + p.x * m.push;
        out[q + 1] = p.y + vy * m.c + (p.az * vx - p.ax * vz) * m.s + p.ay * dot + p.y * m.push;
        out[q + 2] = p.z + vz * m.c + (p.ax * vy - p.ay * vx) * m.s + p.az * dot + p.z * m.push;
      }
    }
    this.mesh.setPositions(out);
    this.mesh.update();
  }

  /** The fire inside it: how hot (0 dark … 1 white), how large, and the light and ring about it (0: none of them). */
  breakLight(heat: number, size: number, shock: number, glow = size * 3): void {
    if (!this.core) return;
    const on = heat > 0.002 && size > 0;
    this.core.enabled = on;
    this.coreGlow!.enabled = on && glow > 0;
    this.shock!.enabled = shock > 0;
    if (on) {
      const m = this.core.render!.meshInstances[0]!.material as pc.StandardMaterial,
        k = Math.min(1, heat);
      m.emissive.set(Math.min(1, k * 1.5), k * k * 0.62, k * k * k * k * 0.32);
      m.update();
      this.core.setLocalScale(size, size, size);
      const g = glow * (0.4 + 0.6 * k);
      this.coreGlow!.setLocalScale(g, g, g);
      // (Out of its shell its light lies over it, hot at the heart: a flat colour reads as a sticker.)
      const mat = this.coreGlow!.render!.meshInstances[0]!.material as pc.StandardMaterial,
        over = size < 0.95;
      if (mat.depthTest === over) {
        mat.depthTest = !over;
        mat.update();
      }
    }
    if (shock > 0) this.shock!.setLocalScale(shock, shock, shock);
  }

  /** What is left drawn in its place, or the world itself again (W6): rubble going round where it was and a cinder at the heart of it. */
  ruin(on: boolean): void {
    this.isRuin = on;
    if (on && !this.rubble) {
      const lump = keptMesh(
          pc.Mesh.fromGeometry(
            this.stage.device,
            new pc.SphereGeometry({ radius: 1, latitudeBands: 3, longitudeBands: 5 }),
          ),
        ),
        hash = (i: number, k: number) => {
          const s = Math.sin(i * 91.17 + k * 37.71) * 24634.6345;
          return s - Math.floor(s);
        };
      this.rubble = new InstancedBatch(this.stage, lump, [0.42, 0.38, 0.35], RUBBLE, this.ruinRoot);
      this.rubble.set(RUBBLE, (i, out) => {
        // A broad ring tilted to the eye: thick and close at its heart, thin and far out at its edge.
        const k = hash(i, 1),
          r = 0.22 + 2.1 * k * Math.sqrt(k + 0.05),
          a = hash(i, 2) * Math.PI * 2,
          lift = (hash(i, 3) - 0.5) * (0.5 / (1 + 2.2 * r)),
          big = hash(i, 4);
        out[0] = r * Math.cos(a);
        out[1] = lift + r * Math.cos(a) * 0.14;
        out[2] = r * Math.sin(a);
        const s = 0.006 + 0.052 * big * big * big + 0.012 * (1 - k);
        out[3] = s;
        out[4] = s * (0.55 + 0.6 * hash(i, 5));
        out[5] = s * (0.7 + 0.6 * hash(i, 6));
        out[6] = hash(i, 7) * 6.283;
        out[7] = hash(i, 8) * 3.1;
      });
      const hot = new pc.StandardMaterial();
      hot.useLighting = false;
      hot.diffuse = new pc.Color(0, 0, 0);
      hot.emissive = new pc.Color(1, 0.36, 0.08);
      hot.update();
      this.embers = new InstancedBatch(this.stage, lump, [1, 0.4, 0.1], EMBERS, this.ruinRoot, hot);
      this.embers.set(EMBERS, (i, out) => {
        const k = hash(i, 11),
          r = 0.1 + 0.62 * k,
          a = hash(i, 12) * Math.PI * 2;
        out[0] = r * Math.cos(a);
        out[1] = (hash(i, 13) - 0.5) * 0.18 + r * Math.cos(a) * 0.14;
        out[2] = r * Math.sin(a);
        out[3] = out[4] = out[5] = 0.006 + 0.016 * hash(i, 14);
        out[6] = hash(i, 15) * 6.283;
      });
      this.cinderGlow = billboard(this.stage, glowMaterial(this.stage, CINDER), 0.95, this.ruinRoot, true);
    }
    if (on) {
      if (this.entity) this.entity.enabled = false;
      this.sea.enabled = this.halo.enabled = this.clouds.enabled = false;
      this.hallRoot.enabled = false;
      this.marker.enabled = false;
      this.ruinRoot.enabled = true;
    } else this.ruinRoot.enabled = false;
  }

  /** Whether what is drawn is what is left of it. */
  get ruined(): boolean {
    return this.isRuin;
  }

  /** Its whole sky burned (W6): its air's glow out, its clouds thick and brown over all of it. */
  blacken(on: boolean): void {
    if (on === this.blackened) return;
    this.blackened = on;
    const clouds = this.clouds.render!.meshInstances[0]!.material as pc.StandardMaterial,
      look = KIND_GLOBES[this.kindShown] ?? KIND_GLOBES.rocky!;
    if (on) {
      clouds.diffuse = new pc.Color(0.16, 0.12, 0.09);
      clouds.opacityMap = null;
      clouds.opacity = 0.86;
      this.cloudy = true;
      this.air = false;
      if (this.entity?.enabled) {
        this.clouds.enabled = true;
        this.halo.enabled = false;
      }
    } else {
      clouds.diffuse = new pc.Color(look.clouds[0], look.clouds[1], look.clouds[2]);
      clouds.opacityMap = clouds.diffuseMap;
      clouds.opacity = 0.65;
    }
    clouds.update();
  }

  /**
   * Halls at sites of the globe (each its cell and its domes, in its own plane), or none: the
   * domes set half in its ground, and a warm glow of lights over each, seen from far out.
   */
  setHalls(
    sites: readonly { cell: number; domes: readonly { u: number; v: number; r: number }[] }[],
  ): void {
    const p = this.positions,
      domes: { x: number; y: number; z: number; r: number }[] = [];
    this.hallSites = [];
    for (const site of p ? sites : []) {
      const cx = p![site.cell * 3]!,
        cy = p![site.cell * 3 + 1]!,
        cz = p![site.cell * 3 + 2]!,
        len = Math.hypot(cx, cy, cz) || 1,
        nx = cx / len,
        ny = cy / len,
        nz = cz / len;
      // The site's own plane: east about the pole, and north across it.
      const el = Math.hypot(nx, nz),
        ex = el < 1e-6 ? 1 : nz / el,
        ez = el < 1e-6 ? 0 : -nx / el,
        qx = ny * ez,
        qy = nz * ex - nx * ez,
        qz = -ny * ex;
      for (const d of site.domes) {
        const x = nx + ex * d.u + qx * d.v,
          y = ny + qy * d.v,
          z = nz + ez * d.u + qz * d.v,
          l = Math.hypot(x, y, z) || 1;
        domes.push({ x: (x / l) * len, y: (y / l) * len, z: (z / l) * len, r: d.r });
      }
      this.hallSites.push({ x: nx, y: ny, z: nz });
    }
    if (!this.halls && domes.length) {
      const m = new pc.StandardMaterial();
      m.diffuse = new pc.Color(0.86, 0.88, 0.92);
      // (Lit from within: seen on the night side too.)
      m.emissive = new pc.Color(0.34, 0.27, 0.12);
      m.gloss = 0.5;
      m.update();
      this.halls = new InstancedBatch(
        this.stage,
        keptMesh(
          pc.Mesh.fromGeometry(
            this.stage.device,
            new pc.SphereGeometry({ radius: 1, latitudeBands: 4, longitudeBands: 8 }),
          ),
        ),
        [1, 1, 1],
        64,
        this.hallRoot,
        m,
      );
    }
    this.halls?.set(domes.length, (i, out) => {
      const d = domes[i]!;
      out[0] = d.x;
      out[1] = d.y;
      out[2] = d.z;
      out[3] = out[4] = out[5] = d.r;
    });
    this.lightMaterial ??= glowMaterial(this.stage, LIGHTS);
    while (this.lights.length < this.hallSites.length)
      this.lights.push(billboard(this.stage, this.lightMaterial, 0.05, this.hallRoot));
    this.lights.forEach((e, i) => {
      const at = this.hallSites[i];
      e.enabled = !!at;
      if (at) e.setLocalPosition(at.x * 1.014, at.y * 1.014, at.z * 1.014);
    });
  }

  /**
   * A world's settled ground as its lights (Worlds filled): a point of light at each cell, in one batch, one draw call
   * however many. Called with none, it draws nothing.
   */
  setFilled(cells: readonly number[], size = 0.0085): void {
    const p = this.positions;
    if (!p) return;
    if (!this.filled && cells.length) {
      const m = new pc.StandardMaterial();
      m.diffuse = new pc.Color(0.1, 0.08, 0.05);
      m.emissive = new pc.Color(1, 0.9, 0.5);
      m.useLighting = false;
      m.update();
      this.filled = new InstancedBatch(
        this.stage,
        keptMesh(
          pc.Mesh.fromGeometry(
            this.stage.device,
            new pc.SphereGeometry({ radius: 1, latitudeBands: 2, longitudeBands: 4 }),
          ),
        ),
        [1, 1, 1],
        FILLED_MOST,
        this.hallRoot,
        m,
      );
    }
    const step = Math.max(1, cells.length / FILLED_MOST),
      n = Math.min(cells.length, FILLED_MOST);
    this.filled?.set(n, (i, out) => {
      const c = cells[Math.floor(i * step)]!,
        x = p[c * 3]!,
        y = p[c * 3 + 1]!,
        z = p[c * 3 + 2]!;
      // (On the ground as it is drawn, hills and all, and a little over it.)
      out[0] = x * 1.006;
      out[1] = y * 1.006;
      out[2] = z * 1.006;
      out[3] = out[4] = out[5] = size * (0.7 + 0.6 * ((c * 2654435761) % 1000) * 0.001);
    });
  }

  /** The way to a cell of it from its middle (a unit direction). */
  wayOf(cell: number): { x: number; y: number; z: number } {
    const p = this.positions;
    if (!p) return { x: 0, y: 0, z: 1 };
    const x = p[cell * 3]!,
      y = p[cell * 3 + 1]!,
      z = p[cell * 3 + 2]!,
      l = Math.hypot(x, y, z) || 1;
    return { x: x / l, y: y / l, z: z / l };
  }

  /** Where each site's halls stand (unit directions), for their names and a finger's pick. */
  get hallsAt(): readonly { x: number; y: number; z: number }[] {
    return this.hallSites;
  }

  get built(): boolean {
    return this.grid !== null;
  }

  /** Recolour the globe (RGBA per cell): each facet the colour most of its three cells have. */
  paint(colors: Uint8Array): void {
    if (!this.mesh || !this.corners || !this.colors) return;
    const cells = new Uint32Array(colors.buffer, colors.byteOffset, colors.length >> 2),
      out = new Uint32Array(this.colors.buffer),
      k = this.corners;
    for (let t = 0; t < k.length; t += 3) {
      const a = cells[k[t]!]!,
        b = cells[k[t + 1]!]!,
        c = cells[k[t + 2]!]!,
        face = a === b || a === c ? a : b === c ? b : a;
      out[t] = out[t + 1] = out[t + 2] = face;
    }
    this.mesh.setColors32(this.colors);
    this.mesh.update();
  }

  /** The cell under a screen point, or null when the point misses the globe. */
  pick(x: number, y: number): number | null {
    if (!this.grid || this.isRuin) return null;
    const cam = this.stage.camera.camera!,
      from = cam.screenToWorld(x, y, cam.nearClip),
      to = cam.screenToWorld(x, y, cam.farClip);
    const dx = to.x - from.x,
      dy = to.y - from.y,
      dz = to.z - from.z,
      a = dx * dx + dy * dy + dz * dz,
      b = 2 * (from.x * dx + from.y * dy + from.z * dz),
      c = from.x * from.x + from.y * from.y + from.z * from.z - 1.01 * 1.01,
      disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = (-b - Math.sqrt(disc)) / (2 * a);
    return nearestCell(this.grid, from.x + dx * s, from.y + dy * s, from.z + dz * s);
  }

  /**
   * Where points just over the globe's face (unit directions) fall on the screen (CSS
   * pixels), and how squarely each faces the eye (1 face on, 0 at the rim, less: behind).
   */
  screenOf(
    points: readonly { x: number; y: number; z: number }[],
    lift = 1.02,
  ): {
    x: number;
    y: number;
    facing: number;
  }[] {
    const cam = this.stage.camera,
      eye = cam.getPosition(),
      el = Math.hypot(eye.x, eye.y, eye.z) || 1,
      at = new pc.Vec3(),
      out = new pc.Vec3();
    return points.map((p) => {
      at.set(p.x * lift, p.y * lift, p.z * lift);
      cam.camera!.worldToScreen(at, out);
      return {
        x: out.x,
        y: out.y,
        facing: (p.x * eye.x + p.y * eye.y + p.z * eye.z) / el,
      };
    });
  }

  /** Mark a place (or clear the mark). */
  mark(cell: number | null): void {
    this.marker.enabled = cell !== null && this.positions !== null;
    if (cell === null || !this.positions || !this.grid) return;
    const p = this.positions,
      x = p[cell * 3]!,
      y = p[cell * 3 + 1]!,
      z = p[cell * 3 + 2]!;
    this.marker.setLocalPosition(x * 1.02, y * 1.02, z * 1.02);
    // Stand the marker along the surface normal.
    const up = new pc.Vec3(x, y, z).normalize(),
      q = new pc.Quat();
    const axis = new pc.Vec3().cross(pc.Vec3.UP, up),
      angle = Math.acos(Math.max(-1, Math.min(1, up.y)));
    if (axis.length() > 1e-6) q.setFromAxisAngle(axis.normalize(), (angle * 180) / Math.PI);
    this.marker.setLocalRotation(q);
  }
}

/**
 * Soft white clouds on a clear sky, painted once on a canvas (equirectangular): puffs
 * gathered in bands, as the era's globes wore them. A look only, from its own hash.
 */
function cloudMaterial(stage: Stage): pc.StandardMaterial {
  const w = 512,
    h = 256,
    canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  let seed = 0x2f6b3a1d;
  const rand = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0;
    seed = (seed ^ (seed >>> 12)) >>> 0;
    return seed / 4294967296;
  };
  for (let k = 0; k < 140; k++) {
    // More at the stormy middle latitudes, few at the equator's calm and the poles.
    const lat = (rand() - 0.5) * Math.PI * 0.9,
      band = Math.abs(Math.sin(2 * lat)),
      x = rand() * w,
      y = h / 2 - (lat / Math.PI) * h;
    if (rand() > 0.2 + 0.8 * band) continue;
    const r = 3 + rand() * 8,
      puffs = 3 + Math.floor(rand() * 5);
    for (let p = 0; p < puffs; p++) {
      const px = x + (rand() - 0.5) * r * 3,
        py = y + (rand() - 0.5) * r,
        pr = r * (0.5 + rand() * 0.6);
      for (const dx of [0, -w, w]) {
        const grad = g.createRadialGradient(px + dx, py, 0, px + dx, py, pr);
        grad.addColorStop(0, "rgba(255,255,255,0.7)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(px + dx - pr, py - pr, pr * 2, pr * 2);
      }
    }
  }
  const texture = new pc.Texture(stage.device, {
    width: w,
    height: h,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: true,
  });
  texture.setSource(canvas);
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(1, 1, 1);
  m.diffuseMap = texture;
  m.opacityMap = texture;
  m.opacityMapChannel = "a";
  m.opacity = 0.65;
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = false;
  m.specular = new pc.Color(0, 0, 0);
  m.update();
  return m;
}
