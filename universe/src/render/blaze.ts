// What strikes a town, drawn as it plays out (Phase 42 M201): tongues of flame over each home
// alight, licking up its walls and leaping over its roof, a hot core in them, sparks flying up off
// them; the smoke rolling up from them and drifting off, thinner from those smouldering; the dust
// over homes a quake shook down. Units as the village's: a tenth of a unit to the metre. Those
// nearest the eye are drawn, so many of each.
import * as pc from "playcanvas";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import type { Alight, BlazeNow } from "../view/index.ts";

const M = 0.1;
/** The most homes drawn alight, smoking and in dust; tongues, sparks, puffs and clouds to each. */
const MOST_FIRES = 60,
  FLAMES = 4,
  SPARKS = 3,
  MOST_SMOKE = 60,
  PUFFS = 5,
  MOST_DUST = 40,
  CLOUDS = 4,
  MOST_BUTTS = 8;
const FLAME: Rgb = [1, 0.42, 0.08],
  CORE: Rgb = [1, 0.82, 0.32],
  SPARK: Rgb = [1, 0.68, 0.2],
  SMOKE: Rgb = [0.2, 0.19, 0.18],
  DUST: Rgb = [0.8, 0.74, 0.64],
  BUTT: Rgb = [0.46, 0.32, 0.18];

/** A material glowing of itself, unlit (a flame, a spark). */
function glowing(c: Rgb): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(c[0], c[1], c[2]);
  m.update();
  return m;
}

export class BlazeLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("blaze");
  private readonly flames: InstancedBatch;
  private readonly cores: InstancedBatch;
  private readonly sparks: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly dust: InstancedBatch;
  private readonly butts: InstancedBatch;
  /** What was last drawn (the look tools): homes alight, smoking, in dust. */
  shown = { fires: 0, smoke: 0, dust: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    parent.addChild(this.root);
    const root = this.root,
      cone = coneMesh(stage, 0.5, 1, 6),
      box = boxMesh(stage);
    this.flames = new InstancedBatch(stage, cone, FLAME, MOST_FIRES * FLAMES, root, glowing(FLAME));
    this.cores = new InstancedBatch(stage, cone, CORE, MOST_FIRES, root, glowing(CORE));
    this.sparks = new InstancedBatch(stage, box, SPARK, MOST_FIRES * SPARKS, root, glowing(SPARK));
    this.smoke = new InstancedBatch(
      stage,
      box,
      SMOKE,
      MOST_SMOKE * PUFFS,
      root,
      flatMaterial(SMOKE, 0.6),
    );
    this.dust = new InstancedBatch(
      stage,
      box,
      DUST,
      MOST_DUST * CLOUDS,
      root,
      flatMaterial(DUST, 0.72),
    );
    this.butts = new InstancedBatch(stage, cylinderMesh(stage, 0.5, 1, 10), BUTT, MOST_BUTTS, root);
  }

  /** The neighbours' water butts the bucket lines fill from (metres), while they are at it. */
  waterButts(at: readonly { x: number; z: number }[]): void {
    this.butts.set(Math.min(MOST_BUTTS, at.length), (n, out) => {
      out[0] = at[n]!.x * M;
      out[1] = 0.11;
      out[2] = at[n]!.z * M;
      out[3] = out[5] = 0.16;
      out[4] = 0.22;
    });
  }

  /**
   * What is alight, smoking and in dust now, moving by the screen's clock `s` (held still where
   * small motions are not drawn: `motion` false); those nearest where the eye looks (`focus`,
   * metres) drawn first, and none in the eye's face (`eye`).
   */
  update(
    b: BlazeNow,
    s: number,
    motion: boolean,
    eye: { x: number; y: number; z: number } | null,
    focus: { x: number; z: number } | null = eye,
  ): void {
    const clock = motion ? s : 0,
      // (A puff the eye is in, or nearly, is not drawn: it would fill the screen.)
      clear = (x: number, y: number, z: number, size: number) =>
        !eye || (x - eye.x) ** 2 + (y - eye.y) ** 2 + (z - eye.z) ** 2 > (size * 0.8 + 4) ** 2,
      near = (list: readonly Alight[], most: number): readonly Alight[] =>
        list.length <= most || !focus
          ? list.slice(0, most)
          : [...list]
              .sort(
                (a, c) =>
                  Math.hypot(a.x - focus.x, a.z - focus.z) -
                  Math.hypot(c.x - focus.x, c.z - focus.z),
              )
              .slice(0, most),
      fires = near(b.fires, MOST_FIRES),
      smoke = near(b.smoke, MOST_SMOKE),
      dust = near(b.dust, MOST_DUST);
    this.shown = { fires: fires.length, smoke: smoke.length, dust: dust.length };
    // Tongues of flame: one leaping out of the roof, the rest licking up its walls about it.
    this.flames.set(fires.length * FLAMES, (n, out) => {
      const f = fires[Math.floor(n / FLAMES)]!,
        k = n % FLAMES,
        flick = 0.72 + 0.28 * Math.sin(clock * (6.5 + k * 1.7) + n * 2.3),
        a = f.yaw + k * 2.1 + n * 0.37,
        round = k ? f.wide * 0.55 : 0,
        tall = (k ? 3 + f.high * 0.4 : 5 + f.high * 0.6) * (0.35 + 0.65 * f.k) * flick,
        y = k ? f.high * (0.15 + 0.2 * k) : f.high * 0.8;
      out[0] = (f.x + Math.cos(a) * round) * M;
      out[1] = (y + tall / 2) * M;
      out[2] = (f.z + Math.sin(a) * round) * M;
      out[3] = out[5] = (k ? 1.8 : 2.8) * (0.5 + 0.5 * f.k) * Math.min(2, f.size) * M * 2;
      out[4] = tall * M;
      out[6] = clock * 2 + n;
    });
    this.cores.set(fires.length, (n, out) => {
      const f = fires[n]!,
        flick = 0.8 + 0.2 * Math.sin(clock * 9 + n * 1.3),
        tall = (3 + f.high * 0.35) * f.k * flick;
      out[0] = f.x * M;
      out[1] = (f.high * 0.82 + tall / 2) * M;
      out[2] = f.z * M;
      out[3] = out[5] = 1.6 * Math.min(2, f.size) * f.k * M * 2;
      out[4] = tall * M;
      out[6] = n;
    });
    // Sparks flying up off them.
    this.sparks.set(fires.length * SPARKS, (n, out) => {
      const f = fires[Math.floor(n / SPARKS)]!,
        j = n % SPARKS,
        rise = (clock * 0.45 + j / SPARKS + n * 0.37) % 1;
      out[0] = (f.x + Math.sin(n * 1.7 + rise * 4) * 2.5) * M;
      out[1] = (f.high + 2 + rise * (8 + f.high * 0.3)) * M;
      out[2] = (f.z + Math.cos(n * 2.3 + rise * 3) * 2.5) * M;
      out[3] = out[4] = out[5] = 0.35 * (1 - rise) * f.k * M * 2;
      out[6] = n + rise * 6;
    });
    // The smoke rolling up and drifting off downwind, as thick as the fire under it is fierce.
    this.smoke.set(smoke.length * PUFFS, (n, out) => {
      const f = smoke[Math.floor(n / PUFFS)]!,
        j = n % PUFFS,
        rise = (clock * 0.09 + j / PUFFS + n * 0.13) % 1,
        grow = (0.3 + 0.7 * rise) * (0.4 + 0.6 * f.k) * Math.min(2.2, f.size),
        x = f.x + rise * 9,
        y = f.high + 1 + rise * (10 + 26 * f.k),
        z = f.z + rise * 3.5,
        k = clear(x, y, z, 6 * grow) ? 1 : 0;
      out[0] = x * M;
      out[1] = y * M;
      out[2] = z * M;
      out[3] = 6 * grow * M * k;
      out[4] = 4.5 * grow * M * k;
      out[5] = 6 * grow * M * k;
      out[6] = n * 0.9 + rise;
    });
    // Dust over homes shaken down: thrown up thick as they fall, billowing out and up, thinning
    // as it settles.
    this.dust.set(dust.length * CLOUDS, (n, out) => {
      const f = dust[Math.floor(n / CLOUDS)]!,
        j = n % CLOUDS,
        gone = 1 - f.k,
        a = j * 1.57 + n * 0.3 + gone * 0.8,
        spread = gone * 6 + 1.5 + j * 0.8,
        wide = (6 + gone * 9) * (0.45 + 0.55 * f.k) * Math.min(1.6, 0.7 + f.size * 0.3),
        x = f.x + Math.cos(a) * spread,
        y = 1.2 + gone * 5 + j * 1.3,
        z = f.z + Math.sin(a) * spread,
        k = clear(x, y, z, wide) ? 1 : 0;
      out[0] = x * M;
      out[1] = y * M;
      out[2] = z * M;
      out[3] = out[5] = wide * M * k;
      out[4] = (2.5 + j * 0.9) * (0.5 + 0.5 * f.k) * M * k;
      out[6] = a;
    });
  }

  destroy(): void {
    for (const b of [this.flames, this.cores, this.sparks, this.smoke, this.dust, this.butts])
      b.destroy();
  }
}
