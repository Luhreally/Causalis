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
  private readonly onResize = () => this.app.resizeCanvas();

  constructor(canvas: HTMLCanvasElement, tier: DeviceTier, sky: Rgb) {
    this.app = new pc.Application(canvas, {
      graphicsDeviceOptions: {
        antialias: tier.antialias,
        alpha: false,
        powerPreference: "high-performance",
      },
    });
    this.device = this.app.graphicsDevice;
    this.device.maxPixelRatio = Math.min(globalThis.devicePixelRatio || 1, tier.maxPixelRatio);
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    globalThis.addEventListener("resize", this.onResize);

    this.app.scene.ambientLight = new pc.Color(0.42, 0.44, 0.5);
    this.root = new pc.Entity("world");
    this.app.root.addChild(this.root);

    this.camera = new pc.Entity("camera");
    this.camera.addComponent("camera", {
      clearColor: new pc.Color(sky[0], sky[1], sky[2]),
      fov: 45,
      nearClip: 0.1,
      farClip: 400,
    });
    this.app.root.addChild(this.camera);

    const sun = new pc.Entity("sun");
    sun.addComponent("light", {
      type: "directional",
      color: new pc.Color(1, 0.96, 0.9),
      intensity: 1.1,
    });
    sun.setEulerAngles(50, 35, 0);
    this.app.root.addChild(sun);

    this.app.on("update", (dt: number) => {
      for (const u of this.updaters) u(dt);
    });
    this.app.start();
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
