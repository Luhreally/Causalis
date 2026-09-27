// The PlayCanvas stage (docs/architecture §29): one application, one camera, a
// sun and the sky. Engine-only — every scene is built from simulation data, so
// there is no Editor project. The device tier sets presentation budgets (pixel
// ratio, antialiasing); it never touches the simulation.
import * as pc from "playcanvas";

export type DeviceTier = {
  readonly name: "phone" | "desktop";
  readonly maxPixelRatio: number;
  readonly antialias: boolean;
  /** How many figures a crowd may show per cell and class. */
  readonly crowdCap: number;
};

export type Rgb = readonly [number, number, number];

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

  constructor(canvas: HTMLCanvasElement, tier: DeviceTier, sky: Rgb) {
    this.app = new pc.Application(canvas, {
      graphicsDeviceOptions: {
        antialias: tier.antialias,
        // Clear, so the page paints the backdrop behind the world (a starfield, a sky).
        alpha: true,
        powerPreference: "high-performance",
      },
    });
    this.device = this.app.graphicsDevice;
    this.device.maxPixelRatio = Math.min(globalThis.devicePixelRatio || 1, tier.maxPixelRatio);
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
  backdrop(kind: "space" | "ground", reach = 100): void {
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
    fog.color = new pc.Color(0.78, 0.88, 1);
    fog.start = reach * 1.1;
    fog.end = reach * 3.2;
  }

  /**
   * The hour on the ground (a village under the microscope has one): `day` is the share
   * of the day gone, 0 at midnight. The sun climbs from the east and sets in the west,
   * warm and low at dawn and dusk; at night a moon's cool light and a dark sky.
   */
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
    this.app.scene.ambientLight = new pc.Color(
      0.34 - 0.24 * night,
      0.38 - 0.24 * night,
      0.5 - 0.16 * night,
    );
    const fog = this.app.scene.fog;
    fog.color =
      phase === "night"
        ? new pc.Color(0.06, 0.08, 0.2)
        : warm
          ? new pc.Color(1, 0.66, 0.5)
          : new pc.Color(0.78, 0.88, 1);
  }

  /**
   * Draw each material once, a speck in front of the camera for two frames, so its shaders
   * are compiled before a scale needs them (a first compile is the slowest part of a first
   * frame on a phone). `instanced` draws it as the batches do.
   */
  warm(parts: readonly { material: pc.Material; instanced?: boolean; mesh?: pc.Mesh }[]): void {
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
    holder.addComponent("render", { meshInstances: instances });
    this.camera.addChild(holder);
    holder.setLocalPosition(0, 0, -1);
    holder.setLocalScale(1e-4, 1e-4, 1e-4);
    let frames = 0;
    const off = this.onUpdate(() => {
      if (++frames < 3) return;
      off();
      holder.destroy();
      for (const b of buffers) b.destroy();
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
export function flatMaterial(color: Rgb, opacity = 1): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(color[0], color[1], color[2]);
  m.gloss = 0.25;
  if (opacity < 1) {
    m.opacity = opacity;
    m.blendType = pc.BLEND_NORMAL;
    m.depthWrite = false;
  }
  m.update();
  return m;
}
