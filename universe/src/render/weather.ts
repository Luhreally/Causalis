// The weather drawn (Phase 30 M162): rain and snow falling about what the eye looks at, as near or
// as far as it is — the same at every scale on the ground (a band's camp, a town, a land), sized by
// the eye's distance so a shower reads as a shower however high the eye. Still while the clock is.
import * as pc from "playcanvas";
import type { Weather } from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

/** The most drops, and flakes, drawn at once. */
const MOST = 1600;
/** Rain falls through its height in this many seconds; snow, drifting, in this many. */
const RAIN_FALL = 0.85,
  SNOW_FALL = 7;
const RAIN: Rgb = [0.72, 0.8, 0.94];
const SNOW: Rgb = [0.97, 0.98, 1];

/** Seen by its own light a little, so a night's rain is not lost in the dark. */
function weatherMaterial(color: Rgb, opacity: number): pc.StandardMaterial {
  const m = flatMaterial(color, opacity);
  m.emissive = new pc.Color(color[0] * 0.5, color[1] * 0.5, color[2] * 0.5);
  m.update();
  return m;
}

/** A number in [0, 1) of its own for a drop and its fall. */
function rand(i: number, fall: number, k: number): number {
  let h =
    (Math.imul(i ^ 0x5bd1e995, 0x85ebca6b) ^ Math.imul(fall + k * 0x27d4eb2d, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

export class WeatherLayer {
  readonly root = new pc.Entity("weather");
  private readonly drops: InstancedBatch;
  private readonly flakes: InstancedBatch;
  private readonly rainLook = weatherMaterial(RAIN, 0.5);
  private readonly snowLook = weatherMaterial(SNOW, 0.92);
  /** How many drops and flakes were drawn last (the look tools). */
  shown = { drops: 0, flakes: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    const box = keptMesh(boxMesh(stage));
    this.drops = new InstancedBatch(stage, box, RAIN, MOST, this.root, this.rainLook);
    this.flakes = new InstancedBatch(stage, box, SNOW, MOST, this.root, this.snowLook);
    parent.addChild(this.root);
  }

  /** Its looks, for the stage to ready their shaders before they are wanted. */
  materials(): { material: pc.Material; instanced: boolean }[] {
    return [
      { material: this.rainLook, instanced: true },
      { material: this.snowLook, instanced: true },
    ];
  }

  /**
   * The weather about a point the eye looks at from `distance` away (the eye itself at `eye`),
   * at `s` seconds of the viewer's time (held while the clock is): at most `most` drops or
   * flakes, as many as it falls; none so near the eye that it would fill the view.
   */
  update(
    w: Weather | null,
    at: { x: number; y: number; z: number },
    eye: { x: number; y: number; z: number },
    distance: number,
    s: number,
    most: number,
  ): void {
    const d = Math.max(0.5, distance),
      reach = d * 0.95,
      low = at.y - d * 0.08,
      high = d * 0.85,
      // (A breath of wind: the rain slants a little, the snow drifts.)
      lean = 0.18,
      clear = (d * 0.4) ** 2,
      near = (x: number, y: number, z: number) =>
        (x - eye.x) ** 2 + (y - eye.y) ** 2 + (z - eye.z) ** 2 < clear;
    const nRain = w ? Math.round(Math.min(MOST, most) * Math.min(1, w.rain)) : 0,
      nSnow = w ? Math.round(Math.min(MOST, most) * 0.7 * Math.min(1, w.snow)) : 0;
    this.drops.set(nRain, (i, out) => {
      const go = s / RAIN_FALL + rand(i, 0, 9),
        fall = Math.floor(go),
        f = go - fall,
        a = rand(i, fall, 1) * Math.PI * 2,
        r = reach * Math.sqrt(rand(i, fall, 2)),
        y = low + high * (1 - f),
        x = at.x + Math.cos(a) * r + lean * 0.3 * high * f,
        z = at.z + Math.sin(a) * r,
        k = near(x, y, z) ? 0 : d;
      out[0] = x;
      out[1] = y;
      out[2] = z;
      out[3] = k * 0.0016;
      out[4] = k * 0.045;
      out[5] = k * 0.0016;
      out[6] = 0;
      out[7] = 0;
    });
    this.flakes.set(nSnow, (i, out) => {
      const go = s / SNOW_FALL + rand(i, 0, 7),
        fall = Math.floor(go),
        f = go - fall,
        a = rand(i, fall, 3) * Math.PI * 2,
        r = reach * Math.sqrt(rand(i, fall, 4)),
        sway = Math.sin(s * 1.3 + rand(i, 0, 5) * 6.28) * d * 0.02,
        x = at.x + Math.cos(a) * r + sway + lean * 0.4 * high * f,
        y = low + high * (1 - f),
        z = at.z + Math.sin(a) * r + sway * 0.6,
        size = near(x, y, z) ? 0 : d * (0.0028 + 0.0022 * rand(i, 0, 6));
      out[0] = x;
      out[1] = y;
      out[2] = z;
      out[3] = size;
      out[4] = size;
      out[5] = size;
      out[6] = s * 0.7 + i;
      out[7] = s * 0.5 + i;
    });
    this.shown = { drops: nRain, flakes: nSnow };
  }
}
