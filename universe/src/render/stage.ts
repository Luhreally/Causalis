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
    const fog = this.app.scene.fog;
    this.sunFollows = kind === "space";
    if (kind === "space") {
      fog.type = pc.FOG_NONE;
      return;
    }
    this.sun.setEulerAngles(50, 35, 0);
    fog.type = pc.FOG_LINEAR;
    fog.color = new pc.Color(0.78, 0.88, 1);
    fog.start = reach * 1.1;
    fog.end = reach * 3.2;
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
