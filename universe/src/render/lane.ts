// A lane's mouth and what a jump looks like (Phase 68): a ring of lights that opens across the dark, a thread of light
// running out of it to a far star, and streaks of the sky drawn past a ship inside. Everything is laid along the scene's z
// axis, the way the ship goes, and placed each frame by the film; three batches and a few glows, about 7 draw calls.
import * as pc from "playcanvas";
import { InstancedBatch } from "./batch.ts";
import { billboard, glowMaterial } from "./glow.ts";
import type { Rgb, Stage } from "./stage.ts";

const RING = 56;
const STREAKS = 280;

function lit(color: Rgb): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(color[0], color[1], color[2]);
  m.useFog = false;
  m.update();
  return m;
}

/** A draw from a streak's number: a little hash, the same each time, so a frame is a function of its time. */
const hashed = (i: number, k: number) => {
  const x = Math.sin((i + 1) * 12.9898 + (k + 1) * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export class LaneLayer {
  private readonly root = new pc.Entity("lane");
  private readonly ringLights: InstancedBatch;
  private readonly thread: InstancedBatch;
  private readonly streaks: InstancedBatch;
  private readonly mouth: pc.Entity;
  private readonly far: pc.Entity;
  private readonly home: pc.Entity;
  private readonly farMaterial: pc.StandardMaterial;

  constructor(stage: Stage) {
    stage.root.addChild(this.root);
    const box = pc.Mesh.fromGeometry(
      stage.device,
      new pc.BoxGeometry({ halfExtents: new pc.Vec3(0.5, 0.5, 0.5) }),
    );
    this.ringLights = new InstancedBatch(
      stage,
      box,
      [0.6, 0.9, 1],
      RING,
      this.root,
      lit([0.62, 0.92, 1]),
    );
    this.thread = new InstancedBatch(stage, box, [0.5, 0.8, 1], 1, this.root, lit([0.5, 0.8, 1]));
    this.streaks = new InstancedBatch(
      stage,
      box,
      [0.8, 0.9, 1],
      STREAKS,
      this.root,
      lit([0.82, 0.9, 1]),
    );
    this.mouth = billboard(
      stage,
      glowMaterial(stage, [
        [0, "rgba(235,250,255,0.95)"],
        [0.45, "rgba(120,200,255,0.55)"],
        [1, "rgba(60,120,255,0)"],
      ]),
      1,
      this.root,
      true,
    );
    this.farMaterial = glowMaterial(stage, [
      [0, "rgba(255,255,255,1)"],
      [0.22, "rgba(255,250,235,0.9)"],
      [0.5, "rgba(255,235,190,0.28)"],
      [1, "rgba(255,220,160,0)"],
    ]);
    this.far = billboard(stage, this.farMaterial, 1, this.root, true);
    this.home = billboard(
      stage,
      glowMaterial(stage, [
        [0, "rgba(255,255,255,1)"],
        [0.25, "rgba(255,245,215,0.8)"],
        [1, "rgba(255,225,170,0)"],
      ]),
      1,
      this.root,
      true,
    );
    this.root.enabled = false;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** The ring at a place along the way, so wide, its lights turned so far; `lit` 0 … 1 its size of light. */
  ring(z: number, radius: number, turn: number, light: number): void {
    const n = light <= 0 ? 0 : RING;
    this.ringLights.set(n, (i, out) => {
      const a = (i / RING) * Math.PI * 2 + turn,
        wave = 0.7 + 0.3 * Math.sin(i * 0.9 + turn * 5),
        s = radius * 0.05 * (0.35 + 0.65 * light) * wave;
      out[0] = Math.cos(a) * radius;
      out[1] = Math.sin(a) * radius;
      out[2] = z;
      out[3] = out[4] = out[5] = s;
      out[6] = 0;
    });
  }

  /** The glow filling the ring (0: none). */
  mouthGlow(z: number, radius: number): void {
    this.mouth.enabled = radius > 0.01;
    if (!this.mouth.enabled) return;
    this.mouth.setPosition(0, 0, z);
    this.mouth.setLocalScale(radius, radius, radius);
  }

  /** The thread of light from `from` to `to` along the way (`wide` 0: none). */
  threadOut(from: number, to: number, wide: number): void {
    this.thread.set(wide > 0 ? 1 : 0, (_, out) => {
      out[0] = 0;
      out[1] = 0;
      out[2] = (from + to) / 2;
      out[3] = out[4] = wide;
      out[5] = to - from;
      out[6] = 0;
    });
  }

  /** The star at the way's end, or at the start of it, where the film puts it, so large (0: not there). */
  star(which: "far" | "home", x: number, y: number, z: number, size: number): void {
    const e = which === "far" ? this.far : this.home;
    e.enabled = size > 0;
    if (!e.enabled) return;
    e.setPosition(x, y, z);
    e.setLocalScale(size, size, size);
  }

  /**
   * The sky drawn past: `at` the ship's place along the way, `length` how far each is drawn out (0: none), `run` how far
   * it has gone. The further a streak lies out from the way, the wider it lies, so the eye is inside it.
   */
  sky(at: number, length: number, run: number): void {
    const span = 90;
    this.streaks.set(length <= 0 ? 0 : STREAKS, (i, out) => {
      const a = hashed(i, 1) * Math.PI * 2,
        r = 1.1 + 8 * hashed(i, 2) * hashed(i, 3),
        z = ((hashed(i, 4) * span + run * (0.7 + 0.6 * hashed(i, 5))) % span) - span / 2,
        w = 0.012 + 0.03 * hashed(i, 6);
      out[0] = Math.cos(a) * r;
      out[1] = Math.sin(a) * r;
      out[2] = at - z;
      out[3] = out[4] = w;
      out[5] = length * (0.5 + hashed(i, 7));
      out[6] = 0;
    });
  }

  /** Everything off. */
  clear(): void {
    this.ring(0, 0, 0, 0);
    this.mouthGlow(0, 0);
    this.threadOut(0, 0, 0);
    this.sky(0, 0, 0);
    this.star("far", 0, 0, 0, 0);
    this.star("home", 0, 0, 0, 0);
  }
}
