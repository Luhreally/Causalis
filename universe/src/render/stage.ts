// The PlayCanvas stage (docs/architecture §29): one application, one camera, a
// sun and the sky. Engine-only — every scene is built from simulation data, so
// there is no Editor project. The device tier sets presentation budgets (pixel
// ratio, antialiasing); it never touches the simulation.
import * as pc from "playcanvas";
import { QUALITIES, type Quality } from "./quality.ts";
import type { ColonySky } from "../view/index.ts";

export type DeviceTier = {
  readonly name: "phone" | "desktop";
  readonly maxPixelRatio: number;
  readonly antialias: boolean;
  /** How many figures a crowd may show per cell and class. */
  readonly crowdCap: number;
};

export type Rgb = readonly [number, number, number];

/**
 * A vertex buffer destroyed takes with it the vertex arrays the engine made of it. The engine keeps one for every
 * pair of a mesh's buffer and an instancing buffer it has drawn (its `_vaoMap`), and never lets one go: each kept
 * array holds its buffers in the graphics card's memory after they are destroyed, so every batch rebuilt as the years
 * turn left its matrices there for good (2026-11-15: 13,400 arrays and 900 MB of them in the graphics process by year
 * 1,500 of a small world watched at a century a second).
 */
type VaoDevice = {
  _vaoMap?: Map<string, WebGLVertexArrayObject>;
  gl?: WebGL2RenderingContext;
  unbindVertexArray?: () => void;
};
/** How many vertex arrays a device keeps (for a gate to weigh; -1: it does not tell). */
export function vertexArraysKept(device: pc.GraphicsDevice): number {
  return (device as unknown as VaoDevice)._vaoMap?.size ?? -1;
}
{
  const destroy = pc.VertexBuffer.prototype.destroy;
  pc.VertexBuffer.prototype.destroy = function (this: pc.VertexBuffer): void {
    const device = this.device as unknown as VaoDevice,
      // (Its part of an array's key: none until it has been drawn with another.)
      part = (this as unknown as { _vaoKeyPart?: string | null })._vaoKeyPart,
      kept = device._vaoMap;
    if (part && kept?.size && device.gl) {
      let unbound = false;
      for (const [key, vao] of kept) {
        if (!key.startsWith(part) && !key.includes(`_${part}`)) continue;
        if (!unbound) device.unbindVertexArray?.();
        unbound = true;
        kept.delete(key);
        device.gl.deleteVertexArray(vao);
      }
    }
    destroy.call(this);
  };
}

/** Each kind's clear air by day (Phase 56): the haze its far land fades into. */
const KIND_HAZE: Readonly<Record<string, Rgb>> = {
  carbon: [0.74, 0.68, 0.58],
  sulfur: [0.92, 0.9, 0.7],
  ammonia: [0.82, 0.88, 0.9],
  methane: [0.95, 0.68, 0.4],
};

export class Stage {
  readonly app: pc.Application;
  readonly camera: pc.Entity;
  readonly root: pc.Entity;
  readonly device: pc.GraphicsDevice;
  private readonly updaters = new Set<(dt: number) => void>();
  private readonly sun: pc.Entity;
  /**
   * Out in space the key light keeps to the viewer's upper left, as the era's games lit
   * their worlds (every side of a globe shown lit); on the ground it stands in the sky.
   */
  private sunFollows = true;
  private readonly onResize = () => this.app.resizeCanvas();
  /** How finely the world is drawn (Phase 8 M76): set by the app, read by the scenes. */
  quality: Quality = QUALITIES.high;
  private readonly qualityListeners = new Set<(q: Quality) => void>();
  /** Whether the scale shown is on the ground and wants the sun's shadows, and how far. */
  private shadowsWanted = false;
  private shadowReach = 60;
  /**
   * The weather over the ground shown (Phase 30 M162), and the light and air of a clear sky it
   * greys: the sun's strength, the fill, the haze's colour and how far off it begins and ends.
   */
  private weathered = { cloud: 0, wet: 0, haze: 0, flash: 0 };
  private clear = {
    sun: 1.25,
    ambient: [0.34, 0.38, 0.5] as Rgb,
    fog: [0.78, 0.88, 1] as Rgb,
    start: 0,
    end: 0,
  };
  private readonly ambientNow = new pc.Color();
  private readonly fogNow = new pc.Color();
  /** The clear day's air over the ground: Earth's blue, or its world's kind's (Phase 56). */
  private air: Rgb = [0.78, 0.88, 1];

  constructor(canvas: HTMLCanvasElement, tier: DeviceTier, sky: Rgb) {
    this.quality = tier.name === "phone" ? QUALITIES.balanced : QUALITIES.high;
    this.app = new pc.Application(canvas, {
      graphicsDeviceOptions: {
        antialias: tier.antialias,
        // Clear, so the page paints the backdrop behind the world (a starfield, a sky).
        alpha: true,
        powerPreference: "high-performance",
      },
    });
    this.device = this.app.graphicsDevice;
    this.device.maxPixelRatio = Math.min(
      globalThis.devicePixelRatio || 1,
      tier.maxPixelRatio,
      this.quality.pixelRatio,
    );
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    globalThis.addEventListener("resize", this.onResize);

    // The era's light: a warm, hard key from the sun over a cool, low fill.
    this.app.scene.ambientLight = new pc.Color(0.34, 0.38, 0.5);
    this.root = new pc.Entity("world");
    this.app.root.addChild(this.root);

    this.camera = new pc.Entity("camera");
    this.camera.addComponent("camera", {
      clearColor: new pc.Color(sky[0], sky[1], sky[2], 0),
      fov: 45,
      nearClip: 0.1,
      farClip: 400,
    });
    this.app.root.addChild(this.camera);
    // A screen point's z, told as how far in front of the eye it stands. As it comes it is clip space, and
    // with the near plane pulled far out (the eye among spires cuts what stands in its way so, Phase 66) it
    // reads as behind for all within twice that plane: taps and labels there would find nothing.
    const eye = this.camera,
      lens = eye.camera!,
      toScreen = lens.worldToScreen.bind(lens);
    lens.worldToScreen = (at: pc.Vec3, out?: pc.Vec3): pc.Vec3 => {
      const s = toScreen(at, out),
        e = eye.getPosition(),
        f = eye.forward;
      s.z = (at.x - e.x) * f.x + (at.y - e.y) * f.y + (at.z - e.z) * f.z;
      return s;
    };

    const sun = (this.sun = new pc.Entity("sun"));
    sun.addComponent("light", {
      type: "directional",
      color: new pc.Color(1, 0.95, 0.84),
      intensity: 1.25,
    });
    sun.setEulerAngles(50, 35, 0);
    this.app.root.addChild(sun);

    const dir = new pc.Vec3(),
      side = new pc.Vec3(),
      down = new pc.Vec3();
    this.app.on("update", (dt: number) => {
      if (this.sunFollows) {
        // Shining the way the camera looks, from over the viewer's left shoulder (a
        // directional light shines along its own -y).
        side.copy(this.camera.right).mulScalar(0.55);
        down.copy(this.camera.up).mulScalar(-0.6);
        dir.copy(this.camera.forward).add(side).add(down);
        this.sun.setPosition(0, 0, 0);
        this.sun.lookAt(dir);
        this.sun.rotateLocal(90, 0, 0);
      }
      for (const u of this.updaters) u(dt);
    });
    this.app.start();
  }

  /**
   * The backdrop the page paints behind the world, and the air in front of it: out in
   * space a starfield and clear air; on the ground a sky, with haze toward the horizon
   * from `reach` (a scene's usual viewing distance) on.
   */
  /** Draw at a quality: its pixels and shadows now, and the scenes told. */
  setQuality(q: Quality): void {
    this.quality = q;
    this.device.maxPixelRatio = Math.min(globalThis.devicePixelRatio || 1, q.pixelRatio);
    this.app.resizeCanvas();
    this.applyShadows();
    for (const f of this.qualityListeners) f(q);
  }

  onQuality(fn: (q: Quality) => void): () => void {
    this.qualityListeners.add(fn);
    return () => this.qualityListeners.delete(fn);
  }

  private applyShadows(): void {
    const light = this.sun.light!,
      on = this.shadowsWanted && this.quality.shadows;
    light.castShadows = on;
    if (!on) return;
    light.shadowResolution = this.quality.shadowResolution;
    light.shadowDistance = this.shadowReach;
    light.shadowBias = 0.25;
    light.normalOffsetBias = 0.05;
  }

  /**
   * The scene's backdrop: space (no haze), or ground lit by the sun, its shadows cast as far as `reach` reaches, its haze from
   * as far (or from `haze`: a town's is its land's, 2026-11-21).
   */
  backdrop(kind: "space" | "ground", reach = 100, shadows = false, haze = reach): void {
    // (Out in space no colony's sky is over anything.)
    if (kind === "space") this.colonySky(null);
    this.shadowsWanted = kind === "ground" && shadows;
    this.shadowReach = Math.max(30, reach * 1.6);
    this.applyShadows();
    document.body.dataset.scale = kind;
    delete document.body.dataset.daylight;
    this.app.scene.ambientLight = new pc.Color(0.34, 0.38, 0.5);
    this.sun.light!.intensity = 1.25;
    this.sun.light!.color = new pc.Color(1, 0.95, 0.84);
    // The fog stays on at every scale, pushed out of reach in space: turning it on or off
    // would have every shader compiled afresh at the next frame (on a phone, a pause).
    const fog = this.app.scene.fog;
    this.sunFollows = kind === "space";
    fog.type = pc.FOG_LINEAR;
    if (kind === "space") {
      fog.start = 1e5;
      fog.end = 2e5;
      return;
    }
    this.sun.setEulerAngles(50, 35, 0);
    fog.color = new pc.Color(this.air[0], this.air[1], this.air[2]);
    fog.start = haze * 1.1;
    fog.end = haze * 3.2;
    this.clear = {
      sun: 1.25,
      ambient: [0.34, 0.38, 0.5],
      fog: this.air,
      start: fog.start,
      end: fog.end,
    };
    this.fogReach = { start: fog.start, end: fog.end };
    this.colonyLight();
    this.applyWeather();
  }

  /** Whether the star is up by the hour on the ground, and the way toward it (a colony's disc stands there). */
  private starUp = true;
  get starWay(): pc.Vec3 | null {
    return this.starUp ? this.sun.up : null;
  }

  /** The sky over a colony (Phase 64), null where it is a land of the home world's. */
  private colonyOver: ColonySky | null = null;
  private fogReach = { start: 0, end: 0 };
  /** The air before a colony's own came over it. */
  private homeAir: Rgb | null = null;

  /**
   * A colony's sky (Phase 64): the page's backdrop in its own colours (black and starred over no air),
   * its haze, how far off it starts, its star's colour and strength. Null: back to the home world's.
   */
  colonySky(sky: ColonySky | null): void {
    const b = document.body;
    if (!sky) {
      if (!this.colonyOver) return;
      this.colonyOver = null;
      delete b.dataset.colony;
      if (this.homeAir) this.air = this.homeAir;
      this.homeAir = null;
      return;
    }
    this.homeAir ??= this.air;
    this.colonyOver = sky;
    b.dataset.colony = sky.airless ? "black" : "air";
    sky.stops.forEach((c, i) => b.style.setProperty(`--colony-sky-${i}`, c));
    this.air = sky.haze ?? [0.02, 0.02, 0.05];
    this.colonyLight();
  }

  /** A colony's light and air laid on the clear day's (see `clear`). */
  private colonyLight(): void {
    const sky = this.colonyOver;
    if (!sky || this.sunFollows) return;
    const fog = this.app.scene.fog,
      start = this.fogReach.start * sky.clearness,
      end = this.fogReach.end * sky.clearness;
    this.clear = {
      sun: 1.25 * sky.strength,
      ambient: sky.fill,
      fog: this.air,
      start: sky.haze ? start : 1e5,
      end: sky.haze ? end : 2e5,
    };
    fog.start = this.clear.start;
    fog.end = this.clear.end;
    this.sun.light!.color = new pc.Color(sky.sun[0], sky.sun[1], sky.sun[2]);
    this.sun.light!.intensity = this.clear.sun;
  }

  /**
   * Its world's kind (Phase 56): the page's sky over its ground (y2k.css) and the haze its far land
   * fades into — an oil world's grey-brown, a sulfur world's pale yellow, an ice world's pale slate,
   * a methane world's orange.
   */
  worldKind(kind: string): void {
    if (kind === "rocky") delete document.body.dataset.world;
    else document.body.dataset.world = kind;
    this.air = KIND_HAZE[kind] ?? [0.78, 0.88, 1];
  }

  /**
   * The weather over the ground shown (Phase 30 M162; null: a clear sky): the sun dimmed and the
   * air greyed by cloud, the far land lost in rain or snow, yellowed by a dry haze, and lit white
   * for a moment by lightning. The page's sky goes grey under cloud, pale gold in a haze.
   */
  weather(w: { cloud: number; wet: number; haze: number; flash: number } | null): void {
    this.weathered = w ?? { cloud: 0, wet: 0, haze: 0, flash: 0 };
    this.applyWeather();
    const sky = !w ? "" : w.cloud > 0.5 ? "grey" : w.haze > 0.3 ? "haze" : "";
    if ((document.body.dataset.sky ?? "") !== sky) {
      if (sky) document.body.dataset.sky = sky;
      else delete document.body.dataset.sky;
    }
  }

  private applyWeather(): void {
    if (this.sunFollows) return;
    const w = this.weathered,
      c = this.clear,
      grey = Math.min(1, w.cloud),
      thick = Math.min(1, w.wet),
      haze = Math.min(1, w.haze),
      flash = Math.min(1, w.flash),
      mix = (a: number, b: number, k: number) => a + (b - a) * k;
    this.sun.light!.intensity = c.sun * (1 - 0.5 * grey) + 1.8 * flash;
    const dim = 1 - 0.12 * grey;
    this.ambientNow.set(
      c.ambient[0] * dim + 0.3 * flash,
      c.ambient[1] * dim + 0.3 * flash,
      c.ambient[2] * dim + 0.35 * flash,
    );
    this.app.scene.ambientLight = this.ambientNow;
    // (Greyed and yellowed as bright as the clear air was: a night's air stays dark.)
    const fog = this.app.scene.fog,
      lum = 0.3 * c.fog[0] + 0.59 * c.fog[1] + 0.11 * c.fog[2],
      g = 0.6 * grey,
      h = 0.55 * haze,
      at = (i: 0 | 1 | 2) =>
        mix(
          mix(
            mix(c.fog[i], lum * [0.95, 0.98, 1.02][i]!, g),
            Math.min(1, lum * [1.15, 1, 0.72][i]!),
            h,
          ),
          1,
          flash * 0.6,
        );
    this.fogNow.set(at(0), at(1), at(2));
    fog.color = this.fogNow;
    if (c.end > 0) {
      fog.start = c.start * (1 - 0.35 * thick - 0.3 * haze);
      fog.end = c.end * (1 - 0.3 * thick - 0.25 * haze);
    }
  }

  /**
   * The hour on the ground (a village under the microscope has one): `day` is the share
   * of the day gone, 0 at midnight. The sun climbs from the east and sets in the west,
   * warm and low at dawn and dusk; at night a moon's cool light and a dark sky.
   */
  /** A fill of light a scene asks for, over the hour's own (0: none): added to its ambient the next time the hour is set. */
  fill = 0;

  daylight(day: number): void {
    const a = 2 * Math.PI * (day - 0.25),
      high = Math.sin(a),
      phase = high > 0.25 ? "day" : high > -0.08 ? (day < 0.5 ? "dawn" : "dusk") : "night";
    if (document.body.dataset.daylight !== phase) document.body.dataset.daylight = phase;
    const up = Math.max(0, high),
      warm = phase === "dawn" || phase === "dusk";
    // Up to seventy degrees at noon; turning from east to west through the day.
    this.sun.setEulerAngles(12 + 58 * up, 90 - 180 * ((day - 0.25) / 0.5), 0);
    this.sun.light!.intensity = phase === "night" ? 0.28 : 0.35 + 0.95 * Math.min(1, up * 1.6);
    this.sun.light!.color =
      phase === "night"
        ? new pc.Color(0.55, 0.64, 1)
        : warm
          ? new pc.Color(1, 0.7, 0.45)
          : new pc.Color(1, 0.95, 0.84);
    const night = phase === "night" ? 1 : warm ? 0.4 : 0;
    // (And what fill a scene asks: light with no side to it, so what stands in a street's shade keeps its colours.)
    const fill = this.fill;
    this.app.scene.ambientLight = new pc.Color(
      0.34 - 0.24 * night + fill,
      0.38 - 0.24 * night + fill,
      0.5 - 0.16 * night + fill * 0.9,
    );
    const fog: Rgb = phase === "night" ? [0.06, 0.08, 0.2] : warm ? [1, 0.66, 0.5] : this.air;
    this.clear = {
      ...this.clear,
      sun: this.sun.light!.intensity,
      ambient: [
        0.34 - 0.24 * night + fill,
        0.38 - 0.24 * night + fill,
        0.5 - 0.16 * night + fill * 0.9,
      ],
      fog,
    };
    // A colony's star and air (Phase 64): its hue, its strength; no blue dusk where it has no air;
    // its star climbing truly (low at its dawn, its shadows long), and its night seen by its floodlights.
    const sky = this.colonyOver;
    this.starUp = phase !== "night";
    if (sky) {
      const dark = phase === "night",
        k = dark ? 0.32 : 1;
      this.sun.setEulerAngles(72 - 52 * up, 90 - 180 * ((day - 0.25) / 0.5), 0);
      this.sun.light!.color = dark
        ? new pc.Color(0.55, 0.62, 0.9)
        : new pc.Color(sky.sun[0], sky.sun[1], sky.sun[2]);
      this.sun.light!.intensity = (dark ? 0.3 : 0.35 + 0.95 * Math.min(1, up * 1.6)) * sky.strength;
      this.clear = {
        ...this.clear,
        sun: this.sun.light!.intensity,
        ambient: dark
          ? [Math.max(0.2, sky.fill[0]), Math.max(0.2, sky.fill[1]), Math.max(0.25, sky.fill[2])]
          : [sky.fill[0], sky.fill[1], sky.fill[2]],
        fog: dark ? [0.03, 0.03, 0.07] : this.air,
      };
    }
    this.applyWeather();
  }

  /**
   * Draw each material once, a speck in front of the camera for two frames, so its shaders
   * are compiled before a scale needs them (a first compile is the slowest part of a first
   * frame on a phone). `instanced` draws it as the batches do.
   */
  /**
   * Compile shaders ahead of need: draw each part once, a speck before the camera, for a
   * few frames — with the sun casting shadows over them if `shadows` (so the shadow pass's
   * shaders are ready too, before the first village with shadows is shown).
   */
  warm(
    parts: readonly { material: pc.Material; instanced?: boolean; mesh?: pc.Mesh }[],
    shadows = false,
  ): void {
    const tri = new pc.Mesh(this.device);
    tri.setPositions([0, 0, 0, 1e-4, 0, 0, 0, 1e-4, 0]);
    tri.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    tri.setColors32(new Uint8Array(12).fill(255));
    tri.setIndices([0, 1, 2]);
    tri.update();
    const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      buffers: pc.VertexBuffer[] = [],
      instances = parts.map(({ material, instanced, mesh }) => {
        // (A mesh of its own when its vertices differ from the speck's: the shader does too.)
        const mi = new pc.MeshInstance(mesh ?? tri, material);
        if (instanced) {
          const vb = new pc.VertexBuffer(
            this.device,
            pc.VertexFormat.getDefaultInstancingFormat(this.device),
            1,
            { data: identity },
          );
          buffers.push(vb);
          mi.setInstancing(vb);
          mi.instancingCount = 1;
        }
        return mi;
      }),
      holder = new pc.Entity("warm");
    holder.addComponent("render", { meshInstances: instances, castShadows: shadows });
    this.camera.addChild(holder);
    holder.setLocalPosition(0, 0, -1);
    holder.setLocalScale(1e-4, 1e-4, 1e-4);
    // Drawn first as the scales without shadows draw (the globe, a land, the sky), then —
    // if asked — with the sun casting its shadows exactly as over a village: each is its
    // own shader, and both are wanted. Then the sun as the scale shown wants it again.
    const wanted = this.shadowsWanted,
      reach = this.shadowReach;
    let frames = 0;
    const off = this.onUpdate(() => {
      frames++;
      if (shadows && frames === 3) {
        this.shadowsWanted = true;
        this.shadowReach = 64;
        this.applyShadows();
      }
      if (frames < (shadows ? 6 : 3)) return;
      off();
      holder.destroy();
      for (const b of buffers) b.destroy();
      if (shadows) {
        this.shadowsWanted = wanted;
        this.shadowReach = reach;
        this.applyShadows();
      }
    });
  }

  onUpdate(fn: (dt: number) => void): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  /** Where a screen point (CSS pixels) meets the ground plane y = 0, or null. */
  groundPoint(x: number, y: number): pc.Vec3 | null {
    const cam = this.camera.camera!,
      from = cam.screenToWorld(x, y, cam.nearClip),
      to = cam.screenToWorld(x, y, cam.farClip),
      dy = to.y - from.y;
    if (Math.abs(dy) < 1e-9) return null;
    const s = -from.y / dy;
    if (s < 0 || s > 1) return null;
    return new pc.Vec3(from.x + (to.x - from.x) * s, 0, from.z + (to.z - from.z) * s);
  }

  destroy(): void {
    globalThis.removeEventListener("resize", this.onResize);
    this.app.destroy();
  }
}

/** A lit, flat-coloured material. */
/**
 * A material whose every instance carries its own colour (asked 2026-11-20: one batch, many tones). An instanced batch's
 * matrices have a last row that is always 0, 0, 0, 1: the first three hold the instance's colour instead (linear), read in
 * the vertex shader and put back to nothing before the matrix is used, so no buffer grows and no draw is added. A town's
 * walls, roofs and ground of every colour are then one batch to a mesh. `snow`: how far its instances are whitened (a
 * roof's snow), set by toneSnow.
 */
const TONE_VS = `
attribute vec4 instance_line1;
attribute vec4 instance_line2;
attribute vec4 instance_line3;
attribute vec4 instance_line4;
varying vec3 vTone;
mat4 getModelMatrix() {
	vTone = vec3(instance_line1.w, instance_line2.w, instance_line3.w);
	return matrix_model * mat4(vec4(instance_line1.xyz, 0.0), vec4(instance_line2.xyz, 0.0), vec4(instance_line3.xyz, 0.0), instance_line4);
}
`;
const TONE_PS = `
uniform vec3 material_diffuse;
uniform float uToneSnow;
varying vec3 vTone;
void getAlbedo() {
	dAlbedo = mix(material_diffuse.rgb * vTone, vec3(0.852, 0.893, 0.957), uToneSnow);
}
`;
export function tonedMaterial(gloss = 0.25): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(1, 1, 1);
  m.gloss = gloss;
  const chunks = m.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
  chunks.set("transformInstancingVS", TONE_VS);
  chunks.set("diffusePS", TONE_PS);
  m.shaderChunksVersion = pc.CHUNKAPI_2_8;
  m.setAttribute("instance_line1", pc.SEMANTIC_ATTR11);
  m.setAttribute("instance_line2", pc.SEMANTIC_ATTR12);
  m.setAttribute("instance_line3", pc.SEMANTIC_ATTR14);
  m.setAttribute("instance_line4", pc.SEMANTIC_ATTR15);
  m.setParameter("uToneSnow", 0);
  m.update();
  return m;
}
/**
 * A toned material whose instances are drawn by how far they stand from the eye (render/flora.ts: what grows on a land), as
 * in true perspective, each by its own rank, which its matrix's last corner carries (1 + rank: the corner put back to 1 before
 * use). `uNear`: the eye (x, y, z) and the core within which all are drawn; past the core fewer, by rank, as the square of the
 * core over the distance (as many on the screen however far). `uNearK`: x 1 for the near things, -1 for the far (drawn where
 * the near are not), y how much the near are drawn at all (the eye far: 0), z the reach (from the eye) past which none are.
 * An instance half drawn is drawn at half its size, shrunk to its foot (a tree to the foot of its trunk, a crown into the
 * ground under it), and opaque all the way: it comes and goes by degrees with no screen door's stipple; one not drawn is
 * folded to nothing. All in the vertex shader (a mesh a unit high about its middle: its foot at -0.5; a crown's lift over the
 * ground carried with its rank, render/batch.ts rank).
 */
const FADE_VS = `
attribute vec4 instance_line1;
attribute vec4 instance_line2;
attribute vec4 instance_line3;
attribute vec4 instance_line4;
uniform vec4 uNear;
uniform vec4 uNearK;
uniform vec4 uSnowLine;
varying vec3 vTone;
varying float vSnow;
mat4 getModelMatrix() {
	vTone = vec3(instance_line1.w, instance_line2.w, instance_line3.w);
	vec4 at = matrix_model * vec4(instance_line4.xyz, 1.0);
	// (Over the snow's line, as the land's season lies on its heights: whitened as the season whitens it, or, grass, under it.)
	float lying = uSnowLine.z + uSnowLine.w > 0.0 ? smoothstep(uSnowLine.x, uSnowLine.y, at.y - 0.5 * instance_line2.y) : 0.0;
	vSnow = uSnowLine.z * lying;
	float d = length(at.xyz - uNear.xyz);
	float fade;
	float packed = instance_line4.w - 1.0, liftQ = floor(packed * 0.5), lift = liftQ / 256.0;
	if (uNearK.x > 0.0) {
		float rank = packed - 2.0 * liftQ;
		float keep = min(1.0, (uNear.w * uNear.w) / max(d * d, 1e-6));
		fade = clamp((keep - rank) / (0.2 * keep + 1e-4), 0.0, 1.0) * (1.0 - smoothstep(uNearK.z * 0.8, uNearK.z, d)) * uNearK.y;
	} else {
		fade = 1.0 - uNearK.y * (1.0 - smoothstep(uNearK.z * 0.72, uNearK.z * 0.94, d));
	}
	fade *= 1.0 - uSnowLine.w * lying;
	if (fade <= 0.0) return mat4(0.0);
	// (Shrunk to the tree's foot: its own foot, less how high that stands over the ground.)
	vec3 base = instance_line4.xyz - 0.5 * instance_line2.xyz - vec3(0.0, lift, 0.0);
	vec3 foot = base + fade * (instance_line4.xyz - base);
	return matrix_model * mat4(vec4(instance_line1.xyz * fade, 0.0), vec4(instance_line2.xyz * fade, 0.0), vec4(instance_line3.xyz * fade, 0.0), vec4(foot, 1.0));
}
`;
const FADE_PS = `
uniform vec3 material_diffuse;
uniform float uToneSnow;
varying vec3 vTone;
varying float vSnow;
void getAlbedo() {
	dAlbedo = mix(material_diffuse.rgb * vTone, vec3(0.852, 0.893, 0.957), max(uToneSnow, vSnow));
}
`;
export function fadedMaterial(gloss = 0.25): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(1, 1, 1);
  m.gloss = gloss;
  const chunks = m.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
  chunks.set("transformInstancingVS", FADE_VS);
  chunks.set("diffusePS", FADE_PS);
  m.shaderChunksVersion = pc.CHUNKAPI_2_8;
  m.setAttribute("instance_line1", pc.SEMANTIC_ATTR11);
  m.setAttribute("instance_line2", pc.SEMANTIC_ATTR12);
  m.setAttribute("instance_line3", pc.SEMANTIC_ATTR14);
  m.setAttribute("instance_line4", pc.SEMANTIC_ATTR15);
  m.setParameter("uToneSnow", 0);
  m.setParameter("uNear", [0, 0, 0, 1]);
  m.setParameter("uNearK", [1, 0, 1, 0]);
  m.setParameter("uSnowLine", [1e6, 2e6, 0, 0]);
  m.update();
  return m;
}
/**
 * The land's ground (render/region.ts). A map's lens: each facet its colour, flat (a realm's borders kept). The land as it is
 * (`uTileMap.w` 1): its tiles' colours read off textures of them (a texel a tile, at the grid's corners, blended between the
 * four about each point): the land's (with its woods' cover; carried over the water a texel, so land blends only with land),
 * its woods' crowns seen from above (carried the same), and the water's (with how wet: carried over the land a texel). Where
 * the water's share passes a half, wavered by the land's own grain, the shore, soft over about a pixel, never a polygon's
 * straight side. On the land the grain of the ground (broad drifts, finer patches, a little warmer and cooler); and the woods'
 * crowns standing over as much of it as they cover, in stands fixed to the land, lit on top and darker between, the open ground
 * about them. All of it fixed to the land (its x and z), never to the eye or the screen; the grain is a texture of noise about
 * its mean, mipmapped, and the stands, finer than a pixel or so, are drawn as their mean (the crowns' colour and the open
 * ground's mixed by the woods' share): the ground is the same colour near and far and never shimmers as the eye moves.
 */
const GROUND_PS = `
#define SAND 0.07
#define FOAM 0.025
uniform vec3 material_diffuse;
uniform sampler2D uLand;
uniform sampler2D uWater;
uniform sampler2D uCrowns;
uniform sampler2D uGrain;
uniform vec4 uTileMap;
void getAlbedo() {
	if (uTileMap.w < 0.5) {
		dAlbedo = material_diffuse.rgb * clamp(vVertexColor.rgb, 0.0, 1.0);
		return;
	}
	vec2 p = vPositionW.xz;
	vec2 uv = ((p + uTileMap.x) / uTileMap.y + 0.5) / uTileMap.z;
	vec4 land = texture2D(uLand, uv), water = texture2D(uWater, uv), crown = texture2D(uCrowns, uv);
	// (Three grains, four fields each, about 0.5: broad, middling, fine; the fourth field spread evenly over 0 … 1.)
	vec4 a = texture2D(uGrain, p * 0.031) - 0.5;
	vec4 b = texture2D(uGrain, mat2(0.8, -0.6, 0.6, 0.8) * p * 0.13 + vec2(0.37, 0.61)) - 0.5;
	vec4 c = texture2D(uGrain, mat2(0.6, 0.8, -0.8, 0.6) * p * 0.53 + vec2(0.71, 0.13)) - 0.5;
	float woods = 1.0 - land.a;
	// (The open ground: the tile's colour less its crowns' share of it.)
	vec3 g = clamp((land.rgb - woods * crown.rgb) / max(1.0 - woods, 0.08), 0.0, 1.0);
	g *= 1.0 + 0.14 * a.r + 0.09 * b.r + 0.05 * c.r;
	g.r *= 1.0 + 0.06 * a.g;
	g.b *= 1.0 - 0.06 * a.g;
	// (The crowns: lit tops and the shade between them, a stand lighter or darker than the next.)
	vec3 top = crown.rgb * (1.0 + 0.55 * (smoothstep(-0.25, 0.25, c.g) - 0.5) + 0.35 * b.g);
	// (Where they stand: as much of the ground as they cover, in stands; finer than a pixel or so, their share's mean.)
	float n = b.a + 0.5, e = max(0.7 * fwidth(n), 0.04);
	float near = 1.0 - smoothstep(0.05, 0.14, fwidth(p.x) + fwidth(p.y));
	float m = mix(woods, smoothstep(n - e, n + e, woods), near);
	vec3 ground = mix(g, top, m);
	// (Rock: where a mountain lies bare (its steep faces and ridges, the tiles' share in crown.a, render/region.ts groundRelief)
	// and as steep as the ground takes the light there (a mountain's facet its own; rolling ground's smooth bend, so a hill's
	// outcrop has no facet's edge, region.ts groundBend), high: past a threshold wavered by the grain, so it shows along the
	// steepest parts and the ridges with a ragged edge; finer than a pixel, its share's mean.)
	// (The screen's steps taken here, outside the branch: only high ground works the rest out.)
	vec3 dx = dFdx(vPositionW), dy = dFdy(vPositionW);
	float fs = 0.6 * fwidth(b.a) + 0.4 * fwidth(c.a), fb = 1.6 * fwidth(a.r) + 0.6 * fwidth(b.g);
	if (vPositionW.y > 4.0) {
		float up = min((vPositionW.y - 4.0) / 6.0, 1.0);
		float s0 = 0.6 * (1.0 - smoothstep(0.55, 0.8, normalize(vNormalW).y)) + 0.6 * crown.a - 0.55;
		if (s0 > -0.2) {
			float sc = s0 + 0.35 * (0.6 * b.a + 0.4 * c.a), se = max(0.25 * fs, 0.02);
			float rock = up * mix(clamp(s0 / 0.35 + 0.5, 0.0, 1.0), smoothstep(-se, se, sc), near);
			// (Its beds: uneven in width and spacing, pinched out along the face, faint, none on some of it; each as much as its
			// pixel shows of it, so seen from far off their mean, the stone's own. The stone cool grey to warm brown-grey across a
			// range.)
			float ph = vPositionW.y * 0.8 + 0.1 * dot(p, vec2(0.6, 0.8)) + 1.6 * a.r + 0.6 * b.g;
			float pw = 0.8 * (abs(dx.y) + abs(dy.y)) + 0.1 * (abs(dx.x) + abs(dy.x) + abs(dx.z) + abs(dy.z)) + fb;
			float wid = clamp(0.14 + 0.35 * b.b, 0.0, 0.32) * smoothstep(-0.05, 0.15, c.g);
			float bed = 1.0 - smoothstep(wid - pw, wid + pw, abs(fract(ph) - 0.5));
			float beds = (bed - 2.0 * wid) * clamp(6.0 * a.a, -1.0, 1.0) * smoothstep(-0.1, 0.15, a.g) * (1.0 - smoothstep(0.15, 0.35, pw));
			vec3 stone = mix(vec3(0.12, 0.13, 0.15), vec3(0.165, 0.14, 0.12), smoothstep(-0.25, 0.25, a.b + 0.5 * b.r));
			stone = (stone + 0.04 * g) * (1.0 + 0.26 * beds + 0.08 * c.r + 0.06 * b.r);
			ground = mix(ground, stone, rock);
		}
	}
	// (The shore: where the water's share passes a half, wavered by the land's grain; soft over about a pixel.)
	float s = water.a + 0.17 * a.b + 0.08 * b.b;
	float f = max(0.5 * fwidth(s), 0.01);
	float wet = smoothstep(0.5 - f, 0.5 + f, s);
	// (The water a little lighter and darker in broad swells and finer ripples, fixed to the land; about its own colour.)
	vec3 sea = water.rgb * (1.0 + 0.07 * b.r + 0.05 * c.r);
	// (A band of wet sand along it on the land's side, and a line of foam on the water's, broken by the water's grain: each as
	// much of a pixel as it covers, so seen from far off it is their mean, never a line that comes and goes. Only near it.)
	if (abs(s - 0.5) < SAND + FOAM + 2.0 * f) {
		float sand = smoothstep(0.5 - SAND - f, 0.5 - SAND + f, s) - wet;
		float foam = wet - smoothstep(0.5 + FOAM - f, 0.5 + FOAM + f, s);
		ground = mix(ground, ground * vec3(0.74, 0.72, 0.68), sand);
		sea = mix(sea, mix(sea, vec3(0.9, 0.94, 0.95), 0.4), foam * smoothstep(-0.2, 0.2, c.b));
	}
	dAlbedo = material_diffuse.rgb * mix(ground, sea, wet);
}
`;
/**
 * The land's ground lit as it lies, but its water as a level sheet: where its water is painted (the water's share past a half,
 * as the albedo draws it, a little softer), its light that of a flat surface, so no facet of the ground under a lake or the sea
 * shows its edge across it.
 */
const GROUND_NORMAL_PS = `
uniform sampler2D uWaterLie;
uniform vec4 uTileMapLie;
void getNormal() {
	dNormalW = dVertexNormalW;
	if (uTileMapLie.w > 0.5) {
		vec2 uv = ((vPositionW.xz + uTileMapLie.x) / uTileMapLie.y + 0.5) / uTileMapLie.z;
		float level = smoothstep(0.35, 0.6, texture2D(uWaterLie, uv).a);
		dNormalW = normalize(mix(dVertexNormalW, vec3(0.0, 1.0, 0.0), level));
	}
}
`;
export function groundMaterial(
  land: pc.Texture,
  water: pc.Texture,
  crowns: pc.Texture,
  grain: pc.Texture,
): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuseVertexColor = true;
  m.specular = new pc.Color(0.05, 0.05, 0.06);
  m.gloss = 0.1;
  m.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("diffusePS", GROUND_PS);
  m.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("normalMapPS", GROUND_NORMAL_PS);
  m.shaderChunksVersion = pc.CHUNKAPI_2_8;
  m.setParameter("uLand", land);
  m.setParameter("uWater", water);
  m.setParameter("uCrowns", crowns);
  m.setParameter("uGrain", grain);
  m.setParameter("uTileMap", [0, 1, 1, 0]);
  m.setParameter("uWaterLie", water);
  m.setParameter("uTileMapLie", [0, 1, 1, 0]);
  m.update();
  return m;
}

/**
 * The grain of a land's ground (stage.ts groundMaterial): four fields of smooth noise, tiling, a 128 texels square: three
 * about 0.5, the fourth spread evenly over 0 … 1.
 */
export function grainTexture(stage: Stage): pc.Texture {
  const n = 128,
    cell = 8,
    m = n / cell,
    data = new Uint8Array(n * n * 4);
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0;
    seed = (seed + 0x6d2b79f5) >>> 0;
    return ((seed ^ (seed >>> 13)) >>> 0) / 4294967296;
  };
  for (let ch = 0; ch < 4; ch++) {
    const lattice = Array.from({ length: m * m }, rand),
      at = (i: number, j: number) => lattice[(((j % m) + m) % m) * m + (((i % m) + m) % m)]!,
      out = new Float32Array(n * n);
    let lo = Infinity,
      hi = -Infinity,
      sum = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const fx = x / cell,
          fy = y / cell,
          i = Math.floor(fx),
          j = Math.floor(fy),
          u = fx - i,
          v = fy - j,
          su = u * u * (3 - 2 * u),
          sv = v * v * (3 - 2 * v),
          // (Two octaves, the second turned a quarter: no grid's lines.)
          o1 =
            (at(i, j) * (1 - su) + at(i + 1, j) * su) * (1 - sv) +
            (at(i, j + 1) * (1 - su) + at(i + 1, j + 1) * su) * sv,
          gx = (y * 2) / cell,
          gy = (x * 2) / cell,
          k = Math.floor(gx),
          l = Math.floor(gy),
          p = gx - k,
          q = gy - l,
          sp = p * p * (3 - 2 * p),
          sq = q * q * (3 - 2 * q),
          o2 =
            (at(k + 3, l + 5) * (1 - sp) + at(k + 4, l + 5) * sp) * (1 - sq) +
            (at(k + 3, l + 6) * (1 - sp) + at(k + 4, l + 6) * sp) * sq,
          f = o1 * 0.7 + o2 * 0.3;
        out[y * n + x] = f;
        lo = Math.min(lo, f);
        hi = Math.max(hi, f);
        sum += f;
      }
    // (About its mean, at 0.5: a grain finer than a pixel, mipmapped away, leaves the ground its own colour.)
    const mean = sum / (n * n),
      span = Math.max(hi - mean, mean - lo) || 1;
    if (ch < 3)
      for (let t = 0; t < n * n; t++)
        data[4 * t + ch] = Math.round(127.5 + (127 * (out[t]! - mean)) / span);
    else {
      // (The fourth spread evenly over 0 … 1, by its rank: a share of the ground below a level is that level.)
      const order = Array.from(out.keys()).sort((x, y) => out[x]! - out[y]!);
      order.forEach((t, k) => (data[4 * t + 3] = Math.round((255 * (k + 0.5)) / (n * n))));
    }
  }
  const tex = new pc.Texture(stage.device, {
    width: n,
    height: n,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_REPEAT,
    addressV: pc.ADDRESS_REPEAT,
  });
  (tex.lock() as Uint8Array).set(data);
  tex.unlock();
  return tex;
}
/** A colour as a toned material's instance carries it: linear, as the light is reckoned. */
export function toneOf(c: number): number {
  return Math.pow(Math.max(0, c), 2.2);
}

export function flatMaterial(
  color: Rgb,
  opacity = 1,
  gloss = 0.25,
  shine = 0,
): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(color[0], color[1], color[2]);
  m.gloss = gloss;
  // (A sheen of its own: metal and wet things catch the light; the rest stay matte.)
  if (shine > 0) m.specular = new pc.Color(shine, shine, shine);
  if (opacity < 1) {
    m.opacity = opacity;
    m.blendType = pc.BLEND_NORMAL;
    m.depthWrite = false;
  }
  m.update();
  return m;
}
