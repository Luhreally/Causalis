// A raid over a town drawn (War past the line, W2): its machines, each from its world's numbers, a wing, a
// body, a tail and its engines; its load falling; each hit's flash and dust where it lands. What burns after
// is the fire's own (render/blaze.ts). Units as the village's: a tenth of a unit to the metre. On the phone
// floor, at most 12 machines of 4 parts, 24 loads, 24 bursts of 2 parts: 120 instances in 5 draws, and none
// but while a raid is over the town.
import * as pc from "playcanvas";
import { InstancedBatch, ballMesh, boxMesh, coneMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import {
  GREAT_LASTS,
  LAND_FLYERS,
  MOST_BURSTS,
  MOST_FALLING,
  MOST_LAND_RAIDS,
  MOST_RAIDERS,
  MOST_STREAKS,
  type GreatNow,
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
/** A rocket's streak: its smoke, its head; each drawn wider than life, or at that distance a pixel. */
const SMOKE: Rgb = [0.92, 0.92, 0.9],
  HEAD: Rgb = [1, 0.86, 0.5];
const STREAK_WIDE = 0.42,
  HEAD_WIDE = 1.5;
/** The greatest fire (W5): what it is drawn in, how many parts its head and its skirt have, when its fire goes out, and when its cloud begins to thin (world seconds). */
const GREAT_WHITE: Rgb = [1, 0.98, 0.9],
  GREAT_FIRE: Rgb = [1, 0.45, 0.1],
  GREAT_SMOKE: Rgb = [0.34, 0.27, 0.22],
  GREAT_STEM: Rgb = [0.3, 0.24, 0.2],
  GREAT_DUST: Rgb = [0.5, 0.44, 0.36];
const GREAT_PUFFS = 9,
  GREAT_SKIRT = 14,
  GREAT_COOLS = 40,
  GREAT_THIN = 300;

export class RaidLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("raid");
  private readonly wings: InstancedBatch;
  private readonly hulls: InstancedBatch;
  private readonly loads: InstancedBatch;
  private readonly flashes: InstancedBatch;
  private readonly balls: InstancedBatch;
  private readonly cores: InstancedBatch;
  private readonly dust: InstancedBatch;
  private readonly smokes: InstancedBatch;
  private readonly heads: InstancedBatch;
  /** The greatest fire (W5): what it is seen as, each lit but its heart, so that it stands up as a thing and not a sticker. */
  private readonly greatHot: InstancedBatch;
  private readonly greatFire: InstancedBatch;
  private readonly greatCloud: InstancedBatch;
  private readonly greatStem: InstancedBatch;
  private readonly greatSkirt: InstancedBatch;
  /** What was last drawn (the look tools). */
  shown = { flyers: 0, falling: 0, bursts: 0, streaks: 0, great: 0 };
  /** The greatest fire now (the look tools; the page's flash reads it too). */
  greatNow: GreatNow | null = null;

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
    const lit = new pc.StandardMaterial();
    lit.useLighting = false;
    lit.diffuse = new pc.Color(0, 0, 0);
    lit.emissive = new pc.Color(HEAD[0], HEAD[1], HEAD[2]);
    lit.update();
    const bright = new pc.StandardMaterial();
    bright.useLighting = false;
    bright.diffuse = new pc.Color(0, 0, 0);
    bright.emissive = new pc.Color(SMOKE[0], SMOKE[1], SMOKE[2]);
    bright.update();
    this.smokes = new InstancedBatch(stage, box, SMOKE, MOST_STREAKS, this.root, bright);
    this.heads = new InstancedBatch(stage, box, HEAD, MOST_STREAKS, this.root, lit);
    const ball = ballMesh(stage, 0.5);
    this.balls = new InstancedBatch(stage, ball, FLASH, MOST_STREAKS, this.root, glow);
    this.cores = new InstancedBatch(stage, ball, HEAD, MOST_STREAKS, this.root, lit);
    const white = new pc.StandardMaterial();
    white.useLighting = false;
    white.diffuse = new pc.Color(0, 0, 0);
    white.emissive = new pc.Color(GREAT_WHITE[0], GREAT_WHITE[1], GREAT_WHITE[2]);
    white.update();
    const fierce = new pc.StandardMaterial();
    fierce.useLighting = false;
    fierce.diffuse = new pc.Color(0, 0, 0);
    fierce.emissive = new pc.Color(GREAT_FIRE[0], GREAT_FIRE[1], GREAT_FIRE[2]);
    fierce.update();
    const round = ballMesh(stage, 0.5, 10);
    this.greatHot = new InstancedBatch(stage, round, GREAT_WHITE, 1, this.root, white);
    this.greatFire = new InstancedBatch(stage, round, GREAT_FIRE, GREAT_PUFFS, this.root, fierce);
    this.greatCloud = new InstancedBatch(
      stage,
      round,
      GREAT_SMOKE,
      GREAT_PUFFS * 2,
      this.root,
      flatMaterial(GREAT_SMOKE),
    );
    this.greatStem = new InstancedBatch(
      stage,
      coneMesh(stage, 0.5, 1, 10),
      GREAT_SMOKE,
      1,
      this.root,
      flatMaterial(GREAT_STEM),
    );
    this.greatSkirt = new InstancedBatch(
      stage,
      round,
      GREAT_DUST,
      GREAT_SKIRT,
      this.root,
      flatMaterial(GREAT_DUST),
    );
  }

  /**
   * The greatest fire (W5), by how long since it fell: a white ball swells over the town and is gone in moments; out of it a head of fire
   * climbs on a column, the fire going out of it as it rises and spreads; a ring of dust goes out along the ground; the cloud stands, leaning
   * on the wind, and thins. All of it far taller than anything of the town's, and larger than a rocket's by more than can be mistaken.
   */
  private drawGreat(g: GreatNow | undefined): void {
    this.greatNow = g ?? null;
    const none = (b: InstancedBatch) => b.set(0, () => {});
    if (!g) {
      for (const b of [
        this.greatHot,
        this.greatFire,
        this.greatCloud,
        this.greatStem,
        this.greatSkirt,
      ])
        none(b);
      this.shown.great = 0;
      return;
    }
    const s = g.since,
      x = g.x * M,
      z = g.z * M,
      ease = (u: number) => 1 - (1 - u) * (1 - u),
      rise = ease(Math.min(1, s / 70)),
      top = 8 + 92 * rise,
      head = 7 + 26 * ease(Math.min(1, s / 90)),
      thin = s > GREAT_THIN ? Math.max(0, 1 - (s - GREAT_THIN) / (GREAT_LASTS - GREAT_THIN)) : 1,
      // (Leaning on the wind, slowly: it stays where it can be seen.)
      drift = Math.min(40, Math.max(0, s - 30) * 0.06);
    this.greatHot.set(s < 5 ? 1 : 0, (_, out) => {
      const r =
        26 * Math.sqrt(Math.min(1, s / 0.8)) * (s < 1.5 ? 1 : Math.max(0, 1 - (s - 1.5) / 3.5));
      out[0] = x;
      out[1] = r * 0.3;
      out[2] = z;
      out[3] = out[4] = out[5] = 2 * r;
    });
    const hot = s < GREAT_COOLS ? 1 - s / GREAT_COOLS : 0;
    this.greatFire.set(hot > 0 ? GREAT_PUFFS : 0, (n, out) => {
      const a = (n / GREAT_PUFFS) * 2 * Math.PI + s * 0.05,
        out1 = head * (n % 2 ? 0.55 : 0.25),
        r = head * 0.55 * (0.35 + 0.65 * hot);
      out[0] = x + Math.cos(a) * out1;
      out[1] = top - 2 + (n % 3) * 2;
      out[2] = z + Math.sin(a) * out1;
      out[3] = out[5] = r;
      out[4] = r * 0.8;
    });
    this.greatCloud.set(s > 1 ? GREAT_PUFFS * 2 : 0, (n, out) => {
      const under = n >= GREAT_PUFFS,
        i = n % GREAT_PUFFS,
        a = (i / GREAT_PUFFS) * 2 * Math.PI + (under ? 0.5 : 0) + s * 0.012,
        spread = head * (under ? 0.95 : 0.55),
        r = head * (under ? 0.5 : 0.72) * (0.5 + 0.5 * Math.min(1, s / 25)) * (0.6 + 0.4 * thin);
      out[0] = x + Math.cos(a) * spread + drift;
      out[1] = top + (under ? -head * 0.25 : head * 0.12) + ((i % 3) - 1) * 1.5;
      out[2] = z + Math.sin(a) * spread;
      out[3] = out[5] = thin > 0 ? r * 1.4 : 0;
      out[4] = thin > 0 ? r : 0;
      out[6] = a;
    });
    this.greatStem.set(s > 1 && thin > 0.05 ? 1 : 0, (_, out) => {
      const wide = (5 + head * 0.34) * (0.5 + 0.5 * thin);
      out[0] = x + drift / 2;
      out[1] = top / 2;
      out[2] = z;
      // (Its broad end down: a column from the fire, narrowing up into the head.)
      out[3] = out[5] = wide;
      out[4] = top;
    });
    this.greatSkirt.set(s > 0.5 && s < 300 ? GREAT_SKIRT : 0, (n, out) => {
      const a = (n / GREAT_SKIRT) * 2 * Math.PI,
        far = 6 + 62 * ease(Math.min(1, s / 45)),
        k = s < 120 ? 1 : Math.max(0, 1 - (s - 120) / 180),
        r = (5 + 10 * Math.min(1, s / 40)) * k;
      out[0] = x + Math.cos(a) * far;
      out[1] = r * 0.3;
      out[2] = z + Math.sin(a) * far;
      out[3] = out[5] = r * 1.6;
      out[4] = r * 0.8;
      out[6] = a;
    });
    this.shown.great = 1;
  }

  update(now: RaidNow): void {
    this.drawGreat(now.great);
    const { flyers, falling, bursts } = now,
      n = Math.min(MOST_RAIDERS, flyers.length);
    const { streaks } = now,
      s = Math.min(MOST_STREAKS, streaks.length),
      coming = streaks.filter((k) => k.falling).slice(0, MOST_STREAKS);
    this.shown = {
      flyers: n,
      falling: falling.length,
      bursts: bursts.length,
      streaks: s,
      great: now.great ? 1 : 0,
    };
    // Each a long thin box up its way: its middle half its length back along the way it came.
    this.smokes.set(s, (i, out) => {
      const k = streaks[i]!,
        wide = STREAK_WIDE * (1 + k.fade * 3) * (1 - k.fade * 0.75),
        half = k.length / 2,
        cos = Math.cos(k.slant);
      out[0] = (k.x - Math.sin(k.yaw) * cos * half) * M;
      out[1] = (k.y + Math.sin(k.slant) * half) * M;
      out[2] = (k.z - Math.cos(k.yaw) * cos * half) * M;
      out[3] = wide;
      out[4] = wide;
      out[5] = k.length * M;
      out[6] = k.yaw;
      out[7] = k.slant;
    });
    this.heads.set(coming.length, (i, out) => {
      const k = coming[i]!;
      out[0] = k.x * M;
      out[1] = k.y * M;
      out[2] = k.z * M;
      out[3] = HEAD_WIDE;
      out[4] = HEAD_WIDE;
      out[5] = HEAD_WIDE * 3;
      out[6] = k.yaw;
      out[7] = k.slant;
    });
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
    // A load's flash is gone in a moment; a rocket's is a ball of fire that swells over the roofs, white at its heart.
    const loads = bursts.filter((b) => !b.size || b.size <= 1),
      falls = bursts.filter((b) => (b.size ?? 1) > 1).slice(0, MOST_STREAKS),
      swell = (b: (typeof falls)[number]) =>
        (b.size ?? 1) * 3.4 * Math.sqrt(b.k) * (1 - b.k * b.k * b.k) + 0.3;
    this.flashes.set(loads.length, (i, out) => {
      const b = loads[i]!,
        rise = (1 - b.k) * (1 - b.k);
      out[0] = b.x * M;
      out[1] = 0.1;
      out[2] = b.z * M;
      out[3] = 1.7 * rise + 0.2;
      out[4] = 4.6 * rise + 0.1;
      out[5] = 1.7 * rise + 0.2;
    });
    this.balls.set(falls.length, (i, out) => {
      const b = falls[i]!,
        r = swell(b);
      out[0] = b.x * M;
      out[1] = r * 0.32;
      out[2] = b.z * M;
      out[3] = r;
      out[4] = r * 0.82;
      out[5] = r;
    });
    this.cores.set(falls.length, (i, out) => {
      const b = falls[i]!,
        r = swell(b) * 0.62 * (1 - b.k);
      out[0] = b.x * M;
      out[1] = swell(b) * 0.32;
      out[2] = b.z * M;
      out[3] = r;
      out[4] = r * 0.82;
      out[5] = r;
    });
    this.dust.set(bursts.length, (i, out) => {
      const b = bursts[i]!,
        grow = (0.5 + b.k * 1.8) * (b.size ?? 1);
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
/** How many lengths to a rocket's way over a land, and how wide each is drawn. */
const LAND_DOTS = 24,
  LAND_DOT = 0.42;

/** Strikes from the air on a land's view (W2): machines over the land going to their towns, each town burning under them. At most 48 parts, 24 flames and 24 puffs, in 4 draws. */
export class LandRaidLayer {
  private readonly wings: InstancedBatch;
  private readonly hulls: InstancedBatch;
  private readonly flames: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly dots: InstancedBatch;
  /** What was last drawn (the look tools); `arcAt` the middle of each rocket's way now. */
  shown = { raids: 0, flyers: 0, arcs: 0 };
  arcAt: { x: number; y: number; z: number }[] = [];

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
    const white = new pc.StandardMaterial();
    white.useLighting = false;
    white.diffuse = new pc.Color(0, 0, 0);
    white.emissive = new pc.Color(HEAD[0], HEAD[1], HEAD[2]);
    white.update();
    this.dots = new InstancedBatch(stage, box, HEAD, MOST_LAND_RAIDS * LAND_DOTS, parent, white);
  }

  update(list: readonly LandRaidNow[], height: (x: number, z: number) => number, s: number): void {
    const flyers = list.flatMap((r) => r.flyers),
      burning = list.filter((r) => r.burn > 0);
    const arcs = list.filter((r) => r.arc),
      place = (r: LandRaidNow, u: number) => {
        const a = r.arc!,
          x = a.x + (r.x - a.x) * u,
          z = a.z + (r.z - a.z) * u;
        return { x, y: height(x, z) + 1 + a.high * 4 * u * (1 - u), z };
      };
    this.shown = { raids: list.length, flyers: flyers.length, arcs: arcs.length };
    this.arcAt = arcs.flatMap((r) =>
      [0.7, 0.8, 0.9, 0.95, 0.98].filter((u) => u <= r.arc!.k).map((u) => place(r, u)),
    );
    // A line of lengths, each from where the way is to where it goes next, as far as its head has come.
    this.dots.set(arcs.length * LAND_DOTS, (i, out) => {
      const r = arcs[Math.floor(i / LAND_DOTS)]!,
        j = i % LAND_DOTS,
        on = (j + 1) / LAND_DOTS <= r.arc!.k + 1e-6,
        a = place(r, j / LAND_DOTS),
        b = place(r, (j + 1) / LAND_DOTS),
        dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z,
        h = Math.hypot(dx, dz);
      out[0] = (a.x + b.x) / 2;
      out[1] = on ? (a.y + b.y) / 2 : -1000;
      out[2] = (a.z + b.z) / 2;
      out[3] = LAND_DOT;
      out[4] = LAND_DOT;
      out[5] = Math.hypot(h, dy) * 1.05;
      out[6] = Math.atan2(dx, dz);
      out[7] = Math.atan2(-dy, h);
    });
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
