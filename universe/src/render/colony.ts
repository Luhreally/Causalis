// A colony's ground and sky drawn (Phase 64): that world's rock in facets, flat where its halls stand
// and rising into its hills about them, its ice, its boulders; the star as small as it is from there
// and the planet a moon circles hanging over its horizon, both kept far off as the eye moves (they
// are drawn near enough to be seen, inside the eye's reach, and go with it). And the lander: its
// settlers' ship, coming down on its flame in a storm of dust, setting them on the ground with a
// first camp of pods round it. One unit is ten metres, as in the town.
import * as pc from "playcanvas";
import type { ColonyLook } from "../bridge/index.ts";
import {
  colonyHash,
  colonyHeight,
  colonyRock,
  colonyRough,
  firstPods,
  landerParts,
  settlerAt,
  starHue,
  type LanderPart,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { billboard, glowMaterial } from "./glow.ts";
import type { Stage } from "./stage.ts";

const M = 0.1;
type Rgb = readonly [number, number, number];

/** A flame's or a wake's stuff: its own colour, unlit, in no fog. */
function fireMaterial(color: Rgb): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(color[0], color[1], color[2]);
  m.useFog = false;
  m.update();
  return m;
}

/** A lander's dust: low, thin. */
function dustMaterial(): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0.6, 0.56, 0.52);
  m.opacity = 0.3;
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = false;
  m.gloss = 0;
  m.update();
  return m;
}

/** The glass of what they grow under. */
function glassMaterial(): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0.76, 0.92, 1);
  m.emissive = new pc.Color(0.14, 0.22, 0.28);
  m.opacity = 0.42;
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = false;
  m.gloss = 0.7;
  m.update();
  return m;
}

/** A part of a ship or a lander, lit; `glowing`, a little of its own light (seen in the dark between worlds). */
function hullMaterial(color: Rgb, gloss: number, glowing = 0): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(color[0], color[1], color[2]);
  if (glowing)
    m.emissive = new pc.Color(color[0] * glowing, color[1] * glowing, color[2] * glowing);
  m.gloss = gloss;
  m.update();
  return m;
}

/** A world in another's sky: its own colours and the star's light on them, in no fog. */
function skyBodyMaterial(): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuseVertexColor = true;
  m.gloss = 0.1;
  m.useFog = false;
  m.update();
  return m;
}

/** A colony's rock, its facets seen from either side. */
function rockMaterial(): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuseVertexColor = true;
  m.gloss = 0.12;
  m.cull = pc.CULLFACE_NONE;
  m.update();
  return m;
}

/**
 * What a landing is drawn with, to ready ahead of need (the film's first burn must not stall on a
 * shader on a phone). One of each variant: the sky's and the ground's vertex colours, the flames, the
 * glass and the dust instanced, the hulls plain and glowing.
 */
export function colonyMaterials(
  stage: Stage,
): { material: pc.Material; instanced?: boolean; mesh?: pc.Mesh }[] {
  const dome = domeMesh(stage, 6, 2),
    cyl = cylinderMesh(stage, 0.5, 1, 6),
    box = boxMesh(stage),
    tinted = () => {
      const mesh = new pc.Mesh(stage.device);
      mesh.setPositions([0, 0, 0, 1e-4, 0, 0, 0, 1e-4, 0]);
      mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1]);
      mesh.setColors32(new Uint8Array(12).fill(255));
      mesh.setIndices([0, 1, 2]);
      mesh.update();
      return mesh;
    },
    glow = glowMaterial(stage, [
      [0, "rgba(255,255,255,1)"],
      [1, "rgba(255,255,255,0)"],
    ]);
  glow.useFog = false;
  glow.update();
  return [
    { material: rockMaterial(), mesh: tinted() },
    { material: skyBodyMaterial(), mesh: tinted() },
    { material: fireMaterial([1, 0.7, 0.3]), mesh: cyl },
    { material: fireMaterial([1, 0.7, 0.3]), instanced: true, mesh: box },
    { material: glassMaterial(), instanced: true, mesh: cyl },
    { material: glassMaterial(), instanced: true, mesh: dome },
    { material: dustMaterial(), instanced: true, mesh: dome },
    { material: hullMaterial([1, 1, 1], 0.4), mesh: cyl },
    { material: hullMaterial([1, 1, 1], 0.5, 0.3), mesh: cyl },
    { material: glow },
  ];
}

/** A low dome a unit across and a unit high, its flat base at -0.5: its faces its own facets. */
export function domeMesh(stage: Stage, sides = 10, rings = 3): pc.Mesh {
  const pos: number[] = [],
    nor: number[] = [],
    ring = (j: number) => (j / rings) * (Math.PI / 2),
    at = (i: number, j: number): [number, number, number] => {
      const a = (i / sides) * 2 * Math.PI,
        b = ring(j),
        r = 0.5 * Math.cos(b);
      return [r * Math.cos(a), Math.sin(b) - 0.5, r * Math.sin(a)];
    },
    tri = (p: number[], q: number[], s: number[]) => {
      const ux = q[0]! - p[0]!,
        uy = q[1]! - p[1]!,
        uz = q[2]! - p[2]!,
        vx = s[0]! - p[0]!,
        vy = s[1]! - p[1]!,
        vz = s[2]! - p[2]!,
        nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx,
        l = Math.hypot(nx, ny, nz) || 1;
      for (const c of [p, q, s]) {
        pos.push(c[0]!, c[1]!, c[2]!);
        nor.push(nx / l, ny / l, nz / l);
      }
    };
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < sides; i++) {
      const a = at(i, j),
        b = at(i + 1, j),
        c = at(i, j + 1),
        d = at(i + 1, j + 1);
      tri(a, c, b);
      if (j < rings - 1) tri(b, c, d);
    }
  const mesh = new pc.Mesh(stage.device);
  mesh.setPositions(pos);
  mesh.setNormals(nor);
  mesh.setIndices(pos.map((_, k) => k).slice(0, pos.length / 3));
  mesh.update();
  return mesh;
}

/** A sphere of facets with its colours, for a body hung in the sky: no fog on it, no light but its own. */
function skyBall(stage: Stage, color: (x: number, y: number, z: number) => Rgb): pc.Entity {
  const lat = 12,
    lon = 18,
    pos: number[] = [],
    nor: number[] = [],
    col: number[] = [],
    at = (i: number, j: number): [number, number, number] => {
      const a = (i / lon) * 2 * Math.PI,
        b = (j / lat) * Math.PI - Math.PI / 2,
        r = Math.cos(b);
      return [r * Math.cos(a), Math.sin(b), r * Math.sin(a)];
    },
    push = (p: number[]) => {
      pos.push(p[0]!, p[1]!, p[2]!);
      nor.push(p[0]!, p[1]!, p[2]!);
    };
  for (let j = 0; j < lat; j++)
    for (let i = 0; i < lon; i++) {
      const a = at(i, j),
        b = at(i + 1, j),
        c = at(i, j + 1),
        d = at(i + 1, j + 1),
        m = color((a[0] + d[0]) / 2, (a[1] + d[1]) / 2, (a[2] + d[2]) / 2);
      for (const p of [a, c, b, b, c, d]) {
        push(p);
        col.push(Math.round(m[0] * 255), Math.round(m[1] * 255), Math.round(m[2] * 255), 255);
      }
    }
  const mesh = new pc.Mesh(stage.device);
  mesh.setPositions(pos);
  mesh.setNormals(nor);
  mesh.setColors32(col);
  mesh.setIndices(pos.map((_, k) => k).slice(0, pos.length / 3));
  mesh.update();
  const e = new pc.Entity("sky body");
  e.addComponent("render", {
    meshInstances: [new pc.MeshInstance(mesh, skyBodyMaterial())],
    castShadows: false,
    receiveShadows: false,
  });
  return e;
}

/** What a giant or a rock in the sky is painted: a giant's bands; a rock's greys; a keyed storm. */
function bodyColor(kind: string, tint: number): (x: number, y: number, z: number) => Rgb {
  // (The world they came from, hanging over the one they came to: its seas, its lands, its cloud.)
  if (kind === "home")
    return (x, y, z) => {
      const land = Math.sin(x * 5 + tint * 9) * Math.cos(z * 4 + y * 3),
        cloud = Math.sin(y * 13 + x * 3 + tint * 5);
      return cloud > 0.82 ? [0.92, 0.94, 0.96] : land > 0.3 ? [0.38, 0.5, 0.3] : [0.16, 0.36, 0.68];
    };
  if (kind === "giant" || kind === "ice giant") {
    const warm: readonly Rgb[] = [
        [0.88, 0.8, 0.64],
        [0.72, 0.52, 0.36],
        [0.93, 0.89, 0.8],
        [0.64, 0.44, 0.3],
      ],
      cold: readonly Rgb[] = [
        [0.52, 0.74, 0.86],
        [0.44, 0.64, 0.8],
        [0.62, 0.82, 0.9],
        [0.48, 0.7, 0.84],
      ],
      use = kind === "ice giant" ? cold : warm;
    return (_, y) => {
      const band = Math.floor(((y + 1) / 2) * (6 + 5 * tint));
      return use[band % use.length]!;
    };
  }
  const base: Rgb = [0.5 + 0.2 * tint, 0.46 + 0.16 * tint, 0.42 + 0.1 * tint];
  return (x, y, z) => {
    const k = 0.82 + 0.26 * (0.5 + 0.5 * Math.sin(x * 9 + tint * 7) * Math.cos(z * 7 + y * 5));
    return [base[0] * k, base[1] * k, base[2] * k];
  };
}

/** A lander, built of its parts, its flame and its dust. */
class Lander {
  readonly root = new pc.Entity("lander");
  private readonly flame: pc.Entity;
  private readonly glow: pc.Entity;
  private readonly dust: InstancedBatch;
  private dustOn = 0;
  constructor(stage: Stage, parent: pc.Entity, meshes: Record<LanderPart["mesh"], pc.Mesh>) {
    parent.addChild(this.root);
    for (const p of landerParts()) {
      const e = new pc.Entity("part");
      e.addComponent("render", {
        meshInstances: [new pc.MeshInstance(meshes[p.mesh], hullMaterial(p.color, 0.4))],
        castShadows: true,
      });
      e.setLocalPosition(p.x * M, p.y * M, p.z * M);
      e.setLocalScale(p.sx * M, p.sy * M, p.sz * M);
      this.root.addChild(e);
    }
    // Its flame: a cone of white-gold, unlit, under its bells; a glow about it.
    this.flame = new pc.Entity("flame");
    this.flame.addComponent("render", {
      meshInstances: [new pc.MeshInstance(meshes.cone, fireMaterial([1, 0.74, 0.32]))],
      castShadows: false,
    });
    this.flame.setLocalEulerAngles(180, 0, 0);
    this.root.addChild(this.flame);
    this.glow = billboard(
      stage,
      glowMaterial(stage, [
        [0, "rgba(255,240,200,0.95)"],
        [0.25, "rgba(255,170,70,0.55)"],
        [1, "rgba(255,90,20,0)"],
      ]),
      1,
      this.root,
      true,
    );
    this.glow.render!.castShadows = false;
    this.dust = new InstancedBatch(
      stage,
      meshes.dome,
      [0.6, 0.56, 0.52],
      40,
      parent,
      dustMaterial(),
    );
    this.dust.set(0, () => {});
  }
  set rockColour(c: Rgb) {
    this.dust.recolor([c[0] * 0.9 + 0.1, c[1] * 0.9 + 0.1, c[2] * 0.9 + 0.1]);
  }
  /**
   * The lander at a height over the ground (units; `short` of its pad along the way (wx, wz) it comes
   * by, leaning back against that way), burning so hard, its dust thrown up about its pad.
   */
  at(
    wx: number,
    wz: number,
    high: number,
    short: number,
    burn: number,
    lean: number,
    wall: number,
    dt: number,
  ) {
    this.root.setLocalPosition(wx * short, high, wz * short);
    // (Leaning back: its nose away from its pad, about the level line across its way.)
    this.root.setLocalEulerAngles(lean * 40 * wz, 0, -lean * 40 * wx);
    const on = burn > 0.02;
    this.flame.enabled = on;
    this.glow.enabled = on;
    if (on) {
      const k = burn * (0.85 + 0.15 * Math.sin(wall * 41)),
        len = 3.2 * k;
      this.flame.setLocalPosition(0, 0.45 - len / 2, 0);
      this.flame.setLocalScale(0.9, len, 0.9);
      this.glow.setLocalPosition(0, 0.1, 0);
      this.glow.setLocalScale(2.2 + 2 * k, 2.2 + 2 * k, 2.2 + 2 * k);
    }
    // Its blast raises the dust when it is low.
    const near = on ? Math.max(0, 1 - high / 36) : 0;
    this.dustOn = Math.max(0, Math.min(1, this.dustOn + (near > 0 ? dt : -0.4 * dt)));
    const n = this.dustOn > 0.01 ? 34 : 0;
    this.dust.set(n, (i, out) => {
      const a = colonyHash(77, i, 0) * 2 * Math.PI,
        run = ((wall * (0.16 + 0.14 * colonyHash(77, i, 1)) + colonyHash(77, i, 2)) % 1) as number,
        r = 0.5 + run * (5.5 + 4 * colonyHash(77, i, 3)),
        size = (0.35 + 1.5 * run) * this.dustOn * (0.5 + 0.5 * near);
      out[0] = Math.cos(a) * r;
      out[1] = 0.04 + run * 0.28;
      out[2] = Math.sin(a) * r;
      out[3] = size;
      out[4] = size * 0.34;
      out[5] = size;
      out[6] = 0;
    });
  }
  set visible(on: boolean) {
    this.root.enabled = on;
    if (!on) this.dust.set(0, () => {});
  }
}

/** A colony's ground and sky about its town. */
export class ColonyLayer {
  readonly root = new pc.Entity("colony");
  private readonly stage: Stage;
  private ground: pc.Entity | null = null;
  private rock: pc.StandardMaterial | null = null;
  private batches: InstancedBatch[] = [];
  private readonly meshes: Record<LanderPart["mesh"], pc.Mesh>;
  private star: pc.Entity | null = null;
  private starGlow: pc.StandardMaterial | null = null;
  private over: pc.Entity | null = null;
  private lander: Lander | null = null;
  private pods: InstancedBatch | null = null;
  private podsGlass: InstancedBatch | null = null;
  private podsAt: readonly { x: number; z: number; r: number }[] = [];
  private vaults: InstancedBatch | null = null;
  private byre: InstancedBatch | null = null;
  private footings: InstancedBatch | null = null;
  private suits: InstancedBatch | null = null;
  private visors: InstancedBatch | null = null;
  /** Where in the sky what hangs there stands (a direction), kept with the eye. */
  private overWay = new pc.Vec3(0, 1, 0);
  private key = "";

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    this.root.enabled = false;
    this.meshes = {
      box: keptMesh(boxMesh(stage)),
      cyl: keptMesh(cylinderMesh(stage, 0.5, 1, 12)),
      cone: keptMesh(coneMesh(stage, 0.5, 1, 12)),
      dome: keptMesh(domeMesh(stage)),
    };
    stage.onUpdate(() => this.keepSky());
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** Its ground and sky, from its world's look; `flat` units about its middle are level for its halls. */
  build(look: ColonyLook, seed: number, flat: number): void {
    const key = `${look.bodyRef} ${seed} ${Math.round(flat / 8)} ${Math.round((look.remade ?? 0) * 20)}`;
    if (this.key === key) return;
    this.key = key;
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.ground?.destroy();
    this.rock?.destroy();
    this.over?.destroy();
    this.star?.destroy();
    this.starGlow?.emissiveMap?.destroy();
    this.starGlow?.destroy();
    this.over = null;
    const s = this.stage,
      tones = colonyRock(look),
      rough = colonyRough(look),
      mid = Math.max(30, flat),
      reach = 395,
      rings = 26,
      sectors = 64,
      pos: number[] = [],
      nor: number[] = [],
      col: number[] = [],
      radius = (j: number) =>
        j === 0 ? 0 : mid * 0.7 * Math.pow(reach / (mid * 0.7), (j - 1) / (rings - 1)),
      vertex = (i: number, j: number): [number, number, number] => {
        const a = ((i % sectors) / sectors) * 2 * Math.PI + (j % 2 ? Math.PI / sectors : 0),
          r = radius(j),
          x = r * Math.cos(a),
          z = r * Math.sin(a);
        return [x, colonyHeight(seed, x, z, mid * 1.1, rough), z];
      },
      facet = (p: number[], q: number[], w: number[], c: Rgb) => {
        const ux = q[0]! - p[0]!,
          uy = q[1]! - p[1]!,
          uz = q[2]! - p[2]!,
          vx = w[0]! - p[0]!,
          vy = w[1]! - p[1]!,
          vz = w[2]! - p[2]!,
          nx = uy * vz - uz * vy,
          ny = uz * vx - ux * vz,
          nz = ux * vy - uy * vx,
          l = Math.hypot(nx, ny, nz) || 1;
        for (const v of [p, q, w]) {
          pos.push(v[0]!, v[1]!, v[2]!);
          nor.push(nx / l, ny / l, nz / l);
          col.push(Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255), 255);
        }
      };
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < sectors; i++) {
        const a = vertex(i, j),
          b = vertex(i + 1, j),
          c = vertex(i, j + 1),
          d = vertex(i + 1, j + 1),
          // (A facet's colour: rock, darker or lighter by a keyed share, its ice in its hollows and on its heights.)
          shade = (k: number, y: number) => {
            const h = colonyHash(seed, i * 991 + j, k),
              near = j <= 2,
              base = near
                ? tones.apron
                : (look.icy && h > 0.5) || (look.water === "ice" && y > 14 && h > 0.35)
                  ? tones.ice
                  : h < 0.33
                    ? tones.dark
                    : h > 0.75
                      ? tones.light
                      : tones.rock,
              f = 0.94 + 0.12 * colonyHash(seed, i * 577 + j, k + 3);
            return [base[0] * f, base[1] * f, base[2] * f] as const;
          };
        if (j > 0) facet(a, b, c, shade(0, (a[1] + b[1] + c[1]) / 3));
        else facet(a, b, c, shade(0, 0));
        facet(b, d, c, shade(1, (b[1] + c[1] + d[1]) / 3));
      }
    const mesh = new pc.Mesh(s.device);
    mesh.setPositions(pos);
    mesh.setNormals(nor);
    mesh.setColors32(col);
    mesh.setIndices(pos.map((_, k) => k).slice(0, pos.length / 3));
    mesh.update();
    this.rock = rockMaterial();
    this.ground = new pc.Entity("colony ground");
    this.ground.addComponent("render", {
      meshInstances: [new pc.MeshInstance(mesh, this.rock)],
      castShadows: false,
      receiveShadows: true,
    });
    this.root.addChild(this.ground);
    // Its boulders, from a stride off its apron out to the near hills, in its rock's tones.
    const rocks = s.quality.detail >= 2 ? 240 : 110,
      place = (i: number) => {
        const a = colonyHash(seed, i, 21) * 2 * Math.PI,
          r = mid * 1.02 + colonyHash(seed, i, 22) * mid * 2.2,
          x = r * Math.cos(a),
          z = r * Math.sin(a);
        return { x, z, y: colonyHeight(seed, x, z, mid * 1.1, rough), k: colonyHash(seed, i, 23) };
      };
    for (const [tone, mesh2] of [
      [tones.dark, this.meshes.cone],
      [tones.light, this.meshes.box],
      [look.water === "ice" ? tones.ice : tones.rock, this.meshes.dome],
    ] as const) {
      const n = Math.floor(rocks / 3),
        at = tone === tones.dark ? 0 : tone === tones.light ? 1 : 2,
        b = new InstancedBatch(s, mesh2, [tone[0], tone[1], tone[2]], n, this.root);
      b.set(n, (i, out) => {
        const p = place(i * 3 + at),
          size = 0.08 + 0.55 * p.k * p.k;
        out[0] = p.x;
        out[1] = p.y + size * 0.2;
        out[2] = p.z;
        out[3] = size * (0.8 + colonyHash(seed, i, 31));
        out[4] = size * (0.6 + 0.7 * colonyHash(seed, i, 32));
        out[5] = size * (0.8 + colonyHash(seed, i, 33));
        out[6] = colonyHash(seed, i, 34) * 6.28;
      });
      this.batches.push(b);
    }
    // The star: as small as it is from there (the Sun from Earth, half a degree, drawn four times
    // as wide as it stands, a star's glare wider than its disc); hot-white at its heart.
    const hue = starHue(look.star.temperature),
      c = (k: number, a: number) =>
        `rgba(${Math.round(255 * hue[0] * k)},${Math.round(255 * hue[1] * k)},${Math.round(255 * hue[2] * k)},${a})`;
    this.starGlow = glowMaterial(s, [
      [0, "rgba(255,255,255,1)"],
      [0.22, "rgba(255,255,255,1)"],
      [0.3, c(1, 0.8)],
      [0.55, c(0.9, 0.22)],
      [1, c(0.6, 0)],
    ]);
    this.starGlow.useFog = false;
    this.starGlow.update();
    this.star = billboard(s, this.starGlow, 1, this.root, true);
    this.star.render!.castShadows = false;
    const wide = Math.max(3.4, Math.min(40, look.star.disc * 26));
    this.star.setLocalScale(wide, wide, wide);
    // What hangs in its sky, low over its horizon, a third of the way round from its star's morning
    // (lit from the side, as it stands when the eye comes down), its lower limb a little over its hills.
    if (look.over) {
      const span = Math.max(4, Math.min(60, look.over.degrees)),
        ball = skyBall(s, bodyColor(look.over.kind, look.over.tint)),
        // (Its width at the distance it is drawn at, 340 units off.)
        r = Math.tan((span / 2) * (Math.PI / 180)) * 340,
        // (The star's morning stands east of south: as stage.daylight has it, in its own degrees.)
        morning = ((90 - 180 * ((0.31 - 0.25) / 0.5)) * Math.PI) / 180,
        oa = morning + 2.1 * (colonyHash(seed, 2, 41) < 0.5 ? 1 : -1),
        rise = Math.tan(((span * 0.46 + 6 + 3 * colonyHash(seed, 3, 41)) * Math.PI) / 180);
      ball.setLocalScale(r, r, r);
      this.overWay.set(Math.sin(oa), rise, Math.cos(oa)).normalize();
      this.root.addChild(ball);
      this.over = ball;
    }
    this.keepSky();
    // The lander's pad and first camp are made once, and shown when a landing is watched.
    if (!this.lander) this.lander = new Lander(s, this.root, this.meshes);
    this.lander.rockColour = tones.light;
    this.lander.visible = false;
  }

  /** The bodies in its sky kept far off as the eye moves. */
  private keepSky(): void {
    if (!this.root.enabled) return;
    const eye = this.stage.camera.getPosition(),
      way = this.stage.starWay;
    if (this.star) {
      this.star.enabled = way !== null;
      if (way) this.star.setPosition(eye.x + way.x * 345, eye.y + way.y * 345, eye.z + way.z * 345);
    }
    this.over?.setPosition(
      eye.x + this.overWay.x * 340,
      eye.y + this.overWay.y * 340,
      eye.z + this.overWay.z * 340,
    );
  }

  /** A landing watched: the lander at a moment of its descent, along the way (wx, wz) it comes by. */
  landing(
    wx: number,
    wz: number,
    high: number,
    short: number,
    burn: number,
    lean: number,
    wall: number,
    dt: number,
  ): void {
    if (!this.lander) return;
    this.lander.visible = true;
    this.lander.at(wx, wz, high, short, burn, lean, wall, dt);
  }

  /** The lander gone from the scene (flown off, or a landing done with). */
  landerGone(): void {
    if (this.lander) this.lander.visible = false;
  }

  /**
   * Those who came, out of its door at a moment of the first camp (0 … 1): suited, each going to a
   * pod (a dozen and a half drawn for all of them).
   */
  settlers(k: number, wall: number): void {
    const s = this.stage;
    if (!this.suits) {
      this.suits = new InstancedBatch(s, this.meshes.cyl, [0.92, 0.92, 0.9], 18, this.root);
      this.visors = new InstancedBatch(s, this.meshes.dome, [0.86, 0.62, 0.22], 18, this.root);
      this.podsAt = firstPods(24);
    }
    const n = k <= 0 ? 0 : 18,
      place = (i: number) => {
        const p = settlerAt(i, k, this.podsAt[i % 24]!),
          bob = p.walking ? Math.abs(Math.sin(wall * 9 + i)) * 0.03 : 0;
        return { x: p.x * M, y: p.y * M + bob, z: p.z * M };
      };
    this.suits.set(n, (i, out) => {
      const p = place(i);
      out[0] = p.x;
      out[1] = p.y + 0.24;
      out[2] = p.z;
      out[3] = 0.2;
      out[4] = 0.46;
      out[5] = 0.2;
      out[6] = 0;
    });
    this.visors!.set(n, (i, out) => {
      const p = place(i);
      out[0] = p.x;
      out[1] = p.y + 0.56;
      out[2] = p.z;
      out[3] = 0.21;
      out[4] = 0.17;
      out[5] = 0.21;
      out[6] = 0;
    });
  }

  /** The first camp's pods risen so far (0 … n), about the pad. */
  camp(n: number, rise: number): void {
    const s = this.stage;
    if (!this.pods) {
      this.pods = new InstancedBatch(s, this.meshes.dome, [0.9, 0.9, 0.86], 24, this.root);
      this.podsGlass = new InstancedBatch(s, this.meshes.cyl, [0.5, 0.52, 0.56], 24, this.root);
      this.podsAt = firstPods(24);
    }
    const count = Math.min(24, Math.ceil(n));
    this.pods.set(count, (i, out) => {
      const p = this.podsAt[i]!,
        g = i < count - 1 ? 1 : rise;
      out[0] = p.x * M;
      out[1] = (p.r * g * M) / 2 + 0.03;
      out[2] = p.z * M;
      out[3] = p.r * 2 * M;
      out[4] = p.r * g * M;
      out[5] = p.r * 2 * M;
      out[6] = 0;
    });
    this.podsGlass!.set(count, (i, out) => {
      const p = this.podsAt[i]!;
      out[0] = p.x * M;
      out[1] = 0.02;
      out[2] = p.z * M;
      out[3] = (p.r * 2 + 0.8) * M;
      out[4] = 0.05;
      out[5] = (p.r * 2 + 0.8) * M;
      out[6] = 0;
    });
  }

  /** Done with its first camp: its pods and those at them, folded into the town. */
  campGone(): void {
    this.pods?.set(0, () => {});
    this.podsGlass?.set(0, () => {});
    this.suits?.set(0, () => {});
    this.visors?.set(0, () => {});
  }

  /** Done with all a landing showed. */
  landed(): void {
    this.campGone();
    this.landerGone();
  }

  /**
   * What its people grow under glass (metres, as the plan's): a long vault over each of its fields on a
   * dark footing, its pasture a great dome. Seen through, those at work in them seen in them.
   */
  glasshouses(
    fields: readonly { x: number; z: number; w: number; d: number; yaw: number }[],
    pasture: { x: number; z: number; r: number } | null,
  ): void {
    const s = this.stage;
    this.vaults?.destroy();
    this.byre?.destroy();
    this.footings?.destroy();
    this.vaults = this.byre = this.footings = null;
    const n = fields.length + (pasture ? 1 : 0);
    if (!n) return;
    const glass = glassMaterial();
    if (fields.length) {
      // (A cylinder laid along each field's depth, half sunk: its width the field's, its height its own.)
      this.vaults = new InstancedBatch(
        s,
        this.meshes.cyl,
        [0.76, 0.92, 1],
        fields.length,
        this.root,
        glass,
      );
      this.vaults.set(fields.length, (i, out) => {
        const f = fields[i]!;
        out[0] = f.x * M;
        out[1] = 0;
        out[2] = f.z * M;
        out[3] = f.w * M * 1.02;
        out[4] = f.d * M * 1.02;
        out[5] = 16 * M;
        out[6] = f.yaw;
        out[7] = Math.PI / 2;
      });
    }
    if (pasture) {
      this.byre = new InstancedBatch(s, this.meshes.dome, [0.76, 0.92, 1], 1, this.root, glass);
      this.byre.set(1, (_, out) => {
        out[0] = pasture.x * M;
        out[1] = 1.3;
        out[2] = pasture.z * M;
        out[3] = pasture.r * 2 * M;
        out[4] = 2.6;
        out[5] = pasture.r * 2 * M;
        out[6] = 0;
      });
    }
    this.footings = new InstancedBatch(s, this.meshes.box, [0.66, 0.68, 0.7], n, this.root);
    this.footings.set(n, (i, out) => {
      const f = fields[i];
      out[0] = (f ? f.x : pasture!.x) * M;
      out[1] = 0.01;
      out[2] = (f ? f.z : pasture!.z) * M;
      out[3] = (f ? f.w * 1.06 : pasture!.r * 2.04) * M;
      out[4] = 0.05;
      out[5] = (f ? f.d * 1.06 : pasture!.r * 2.04) * M;
      out[6] = f ? f.yaw : 0;
    });
  }

  /** The way toward what hangs in its sky (null: nothing does): a landing is filmed against it. */
  get hanging(): pc.Vec3 | null {
    return this.over ? this.overWay : null;
  }
}

/**
 * A ship among the worlds or among the stars (Phase 64): its hull and tanks and wings, its drive's flame,
 * and the way it has come drawn behind it. It goes where it is told, as long as it is told to: nothing
 * in history is moved by it. Drawn `size` to the unit, for a scene's own scale.
 */
export class ShipMark {
  private readonly root = new pc.Entity("colony ship");
  private readonly flame: pc.Entity;
  private readonly glow: pc.Entity;
  private readonly wake: InstancedBatch;
  private readonly came: { x: number; y: number; z: number }[] = [];
  private since = 0;

  constructor(stage: Stage) {
    stage.root.addChild(this.root);
    this.root.enabled = false;
    const body = new pc.Entity("hull");
    // (Its long way along the way it looks: a hull built up its own height.)
    body.setLocalEulerAngles(-90, 0, 0);
    this.root.addChild(body);
    const meshes = {
        cyl: keptMesh(cylinderMesh(stage, 0.5, 1, 10)),
        cone: keptMesh(coneMesh(stage, 0.5, 1, 10)),
        box: keptMesh(boxMesh(stage)),
      },
      part = (
        mesh: keyof typeof meshes,
        color: Rgb,
        glowing: number,
        x: number,
        y: number,
        z: number,
        sx: number,
        sy: number,
        sz: number,
      ) => {
        const e = new pc.Entity("part");
        e.addComponent("render", {
          meshInstances: [new pc.MeshInstance(meshes[mesh], hullMaterial(color, 0.5, glowing))],
          castShadows: false,
        });
        e.setLocalPosition(x, y, z);
        e.setLocalScale(sx, sy, sz);
        body.addChild(e);
      };
    const HULL_WHITE: Rgb = [0.92, 0.93, 0.94],
      BAND: Rgb = [0.92, 0.42, 0.16],
      TANK: Rgb = [0.72, 0.74, 0.78],
      WING: Rgb = [0.2, 0.36, 0.74],
      BELL: Rgb = [0.24, 0.25, 0.28];
    part("cyl", HULL_WHITE, 0.35, 0, 0.1, 0, 0.42, 1.5, 0.42);
    part("cyl", BAND, 0.4, 0, 0.4, 0, 0.44, 0.16, 0.44);
    part("cone", HULL_WHITE, 0.35, 0, 1.08, 0, 0.42, 0.48, 0.42);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * 2 * Math.PI;
      part("cyl", TANK, 0.3, Math.cos(a) * 0.3, -0.4, Math.sin(a) * 0.3, 0.26, 0.9, 0.26);
    }
    part("box", WING, 0.5, 0.74, 0.3, 0, 0.92, 0.5, 0.03);
    part("box", WING, 0.5, -0.74, 0.3, 0, 0.92, 0.5, 0.03);
    part("cone", BELL, 0.1, 0, -0.95, 0, 0.36, 0.34, 0.36);
    this.flame = new pc.Entity("flame");
    this.flame.addComponent("render", {
      meshInstances: [new pc.MeshInstance(meshes.cone, fireMaterial([1, 0.74, 0.34]))],
      castShadows: false,
    });
    this.flame.setLocalEulerAngles(180, 0, 0);
    body.addChild(this.flame);
    this.glow = billboard(
      stage,
      glowMaterial(stage, [
        [0, "rgba(255,244,214,0.95)"],
        [0.3, "rgba(255,170,80,0.5)"],
        [1, "rgba(255,110,30,0)"],
      ]),
      1,
      this.root,
      true,
    );
    this.glow.render!.castShadows = false;
    this.wake = new InstancedBatch(
      stage,
      meshes.box,
      [1, 0.62, 0.3],
      60,
      stage.root,
      fireMaterial([1, 0.62, 0.3]),
    );
    this.wake.set(0, () => {});
  }

  set visible(on: boolean) {
    this.root.enabled = on;
    if (!on) {
      this.came.length = 0;
      this.wake.set(0, () => {});
    }
  }

  /** The ship at a point, looking along (dx, dy, dz), `size` to the unit, burning so hard. */
  at(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    size: number,
    burn: number,
    dt: number,
    /** How many times its length it is drawn out along its way (Phase 68: going into a lane). */
    stretch = 1,
  ): void {
    this.root.setPosition(x, y, z);
    const l = Math.hypot(dx, dy, dz);
    if (l > 1e-9) this.root.lookAt(x + dx / l, y + dy / l, z + dz / l);
    this.root.setLocalScale(size, size, size * stretch);
    const on = burn > 0.02;
    this.flame.enabled = on;
    this.glow.enabled = on;
    if (on) {
      this.flame.setLocalPosition(0, -1.15 - 0.55 * burn, 0);
      this.flame.setLocalScale(0.3, 1.1 * burn, 0.3);
      this.glow.setLocalPosition(0, 0, 1.25);
      this.glow.setLocalScale(1.1 * burn, 1.1 * burn, 1.1 * burn);
    }
    // The way it has come: a point dropped so often, the oldest going as new ones come.
    this.since += dt;
    if (this.since > 0.1) {
      this.since = 0;
      this.came.push({ x, y, z });
      if (this.came.length > 60) this.came.shift();
    }
    const n = this.came.length;
    this.wake.set(n, (i, out) => {
      const p = this.came[i]!,
        w = size * 0.1 * (0.25 + (0.75 * (i + 1)) / n);
      out[0] = p.x;
      out[1] = p.y;
      out[2] = p.z;
      out[3] = w;
      out[4] = w;
      out[5] = w;
      out[6] = 0;
    });
  }
}
