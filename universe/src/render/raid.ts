// A raid over a town drawn (War past the line, W2): its machines, each from its world's numbers, a wing, a
// body, a tail and its engines; its load falling; each hit's flash and dust where it lands. What burns after
// is the fire's own (render/blaze.ts). Units as the village's: a tenth of a unit to the metre. On the phone
// floor, at most 12 machines of 4 parts, 24 loads, 24 bursts of 2 parts: 120 instances in 5 draws, and none
// but while a raid is over the town.
import * as pc from "playcanvas";
import { InstancedBatch, boxMesh, coneMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import {
  LAND_FLYERS,
  MOST_BURSTS,
  MOST_FALLING,
  MOST_LAND_RAIDS,
  MOST_RAIDERS,
  type LandRaidNow,
  type RaidNow,
} from "../view/index.ts";

const M = 0.1;
const HULL: Rgb = [0.16, 0.17, 0.2],
  WING: Rgb = [0.24, 0.25, 0.28],
  LOAD: Rgb = [0.1, 0.1, 0.11],
  FLASH: Rgb = [1, 0.62, 0.18],
  DIRT: Rgb = [0.3, 0.26, 0.21];
const WING_PARTS = 2,
  HULL_PARTS = 2;
/** How much larger than life a machine is drawn, as a town's folk are, or at its height it is a line a pixel thin. */
const SEEN = 2.2;

export class RaidLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("raid");
  private readonly wings: InstancedBatch;
  private readonly hulls: InstancedBatch;
  private readonly loads: InstancedBatch;
  private readonly flashes: InstancedBatch;
  private readonly dust: InstancedBatch;
  /** What was last drawn (the look tools). */
  shown = { flyers: 0, falling: 0, bursts: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    parent.addChild(this.root);
    const box = boxMesh(stage),
      glow = new pc.StandardMaterial();
    glow.useLighting = false;
    glow.diffuse = new pc.Color(0, 0, 0);
    glow.emissive = new pc.Color(FLASH[0], FLASH[1], FLASH[2]);
    glow.update();
    this.wings = new InstancedBatch(stage, box, WING, MOST_RAIDERS * WING_PARTS, this.root);
    this.hulls = new InstancedBatch(stage, box, HULL, MOST_RAIDERS * HULL_PARTS, this.root);
    this.loads = new InstancedBatch(stage, box, LOAD, MOST_FALLING, this.root);
    this.flashes = new InstancedBatch(
      stage,
      coneMesh(stage, 0.5, 1, 6),
      FLASH,
      MOST_BURSTS,
      this.root,
      glow,
    );
    this.dust = new InstancedBatch(
      stage,
      box,
      DIRT,
      MOST_BURSTS,
      this.root,
      flatMaterial(DIRT, 0.7),
    );
  }

  update(now: RaidNow): void {
    const { flyers, falling, bursts } = now,
      n = Math.min(MOST_RAIDERS, flyers.length);
    this.shown = { flyers: n, falling: falling.length, bursts: bursts.length };
    // A wing across it and a tail's little one behind.
    this.wings.set(n * WING_PARTS, (i, out) => {
      const f = flyers[Math.floor(i / WING_PARTS)]!,
        tail = i % WING_PARTS === 1,
        back = (tail ? -f.length * 0.46 : f.length * 0.08) * SEEN;
      out[0] = (f.x + Math.sin(f.yaw) * back) * M;
      out[1] = f.y * M;
      out[2] = (f.z + Math.cos(f.yaw) * back) * M;
      out[3] = (tail ? f.span * 0.34 : f.span) * M * SEEN;
      out[4] = Math.max(0.5, f.span * 0.03) * M * SEEN;
      out[5] = (tail ? f.span * 0.1 : f.span / 6) * M * SEEN;
      out[6] = f.yaw;
    });
    // A body along it, and a fin up off its tail.
    this.hulls.set(n * HULL_PARTS, (i, out) => {
      const f = flyers[Math.floor(i / HULL_PARTS)]!,
        fin = i % HULL_PARTS === 1,
        back = (fin ? -f.length * 0.46 : 0) * SEEN;
      out[0] = (f.x + Math.sin(f.yaw) * back) * M;
      out[1] = (f.y + (fin ? f.span * 0.05 * SEEN : 0)) * M;
      out[2] = (f.z + Math.cos(f.yaw) * back) * M;
      out[3] = (fin ? f.span * 0.012 : f.span * 0.09) * M * SEEN;
      out[4] = (fin ? f.span * 0.1 : f.span * 0.09) * M * SEEN;
      out[5] = (fin ? f.span * 0.08 : f.length) * M * SEEN;
      out[6] = f.yaw;
    });
    this.loads.set(falling.length, (i, out) => {
      const b = falling[i]!;
      out[0] = b.x * M;
      out[1] = b.y * M;
      out[2] = b.z * M;
      out[3] = 0.32;
      out[4] = 1;
      out[5] = 0.32;
    });
    this.flashes.set(bursts.length, (i, out) => {
      const b = bursts[i]!,
        rise = (1 - b.k) * (1 - b.k);
      out[0] = b.x * M;
      out[1] = 0.1;
      out[2] = b.z * M;
      out[3] = 1.7 * rise + 0.2;
      out[4] = 4.6 * rise + 0.1;
      out[5] = 1.7 * rise + 0.2;
    });
    this.dust.set(bursts.length, (i, out) => {
      const b = bursts[i]!,
        grow = 0.5 + b.k * 1.8;
      out[0] = b.x * M;
      out[1] = 0.4 + b.k * 2.2;
      out[2] = b.z * M;
      out[3] = grow;
      out[4] = grow * 0.7;
      out[5] = grow;
      out[6] = i;
    });
  }
}

/** How high over its ground a land's view flies them, and how many flames and puffs over a town burning. */
const LAND_HIGH = 9,
  LAND_FLAMES = 3;

/** Strikes from the air on a land's view (W2): machines over the land going to their towns, each town burning under them. At most 48 parts, 24 flames and 24 puffs, in 4 draws. */
export class LandRaidLayer {
  private readonly wings: InstancedBatch;
  private readonly hulls: InstancedBatch;
  private readonly flames: InstancedBatch;
  private readonly smoke: InstancedBatch;
  /** What was last drawn (the look tools). */
  shown = { raids: 0, flyers: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    const box = boxMesh(stage),
      glow = new pc.StandardMaterial();
    glow.useLighting = false;
    glow.diffuse = new pc.Color(0, 0, 0);
    glow.emissive = new pc.Color(FLASH[0], FLASH[1], FLASH[2]);
    glow.update();
    const most = MOST_LAND_RAIDS * LAND_FLYERS;
    this.wings = new InstancedBatch(stage, box, WING, most, parent);
    this.hulls = new InstancedBatch(stage, box, HULL, most, parent);
    this.flames = new InstancedBatch(
      stage,
      coneMesh(stage, 0.5, 1, 6),
      FLASH,
      MOST_LAND_RAIDS * LAND_FLAMES,
      parent,
      glow,
    );
    this.smoke = new InstancedBatch(
      stage,
      box,
      DIRT,
      MOST_LAND_RAIDS * LAND_FLAMES,
      parent,
      flatMaterial(DIRT, 0.6),
    );
  }

  update(list: readonly LandRaidNow[], height: (x: number, z: number) => number, s: number): void {
    const flyers = list.flatMap((r) => r.flyers),
      burning = list.filter((r) => r.burn > 0);
    this.shown = { raids: list.length, flyers: flyers.length };
    this.wings.set(flyers.length, (i, out) => {
      const f = flyers[i]!;
      out[0] = f.x;
      out[1] = height(f.x, f.z) + LAND_HIGH;
      out[2] = f.z;
      out[3] = 4.2;
      out[4] = 0.14;
      out[5] = 0.8;
      out[6] = f.yaw;
    });
    this.hulls.set(flyers.length, (i, out) => {
      const f = flyers[i]!;
      out[0] = f.x;
      out[1] = height(f.x, f.z) + LAND_HIGH;
      out[2] = f.z;
      out[3] = 0.5;
      out[4] = 0.4;
      out[5] = 3;
      out[6] = f.yaw;
    });
    const flame = (n: number) => {
      const r = burning[Math.floor(n / LAND_FLAMES)]!,
        k = n % LAND_FLAMES,
        a = k * 2.1 + r.x,
        d = r.r * 0.4;
      return { r, x: r.x + Math.cos(a) * d, z: r.z + Math.sin(a) * d, k };
    };
    this.flames.set(burning.length * LAND_FLAMES, (n, out) => {
      const f = flame(n),
        lick = 1 + 0.25 * Math.sin(s * 7 + n);
      out[0] = f.x;
      out[1] = height(f.x, f.z);
      out[2] = f.z;
      out[3] = 1.6 * f.r.burn;
      out[4] = 3.4 * f.r.burn * lick;
      out[5] = 1.6 * f.r.burn;
    });
    this.smoke.set(burning.length * LAND_FLAMES, (n, out) => {
      const f = flame(n),
        rise = (s * 0.35 + n * 0.37) % 1;
      out[0] = f.x + rise * 2;
      out[1] = height(f.x, f.z) + 3 + rise * 7;
      out[2] = f.z;
      out[3] = (1.2 + rise * 2) * f.r.burn;
      out[4] = (1 + rise) * f.r.burn;
      out[5] = (1.2 + rise * 2) * f.r.burn;
      out[6] = n;
    });
  }
}
