// A raid over a town drawn (War past the line, W2–W5). Its machines as their age built them, each from its world's numbers: the
// first with two wings and their engines between them, later ones with one wing and their engines along it, the last swept back
// on engines of fire; in wedges of three. Their loads falling nose down along their way. Rockets diving out of the sky on their
// fire, the smoke they leave hanging and drifting on the wind. Each hit's flash; its fireball swelling and darkening into smoke;
// a ring of dust going out along the ground; what it threw coming down on the roofs and the ground and lying there till it
// fades; the ground it scorched. The greatest fire's white, its fire climbing on its column into a head that rolls and darkens,
// the dust going out along the ground and the shock across the town. What burns after is the fire's own (render/blaze.ts). Units
// as the village's: a tenth of a unit to the metre. At most some 1,800 instances in 22 batches, drawn only while a raid is over
// the town, and nothing made from frame to frame.
import * as pc from "playcanvas";
import { InstancedBatch, ballMesh, boxMesh, coneMesh, cylinderMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import {
  BIT,
  DIVE_SEEN,
  GREAT_LASTS,
  LAND_FLYERS,
  MOST_BURSTS,
  MOST_FALLING,
  MOST_LAND_RAIDS,
  MOST_MARKS,
  MOST_RAIDERS,
  MOST_STREAKS,
  ROCKET_BITS,
  STREAK_HANGS,
  diveAt,
  greatGone,
  type GreatNow,
  type LandRaidNow,
  type RaidNow,
} from "../view/index.ts";

const M = 0.1;
const HULL: Rgb = [0.16, 0.17, 0.2],
  WING: Rgb = [0.24, 0.25, 0.28],
  FLASH: Rgb = [1, 0.62, 0.18],
  DIRT: Rgb = [0.3, 0.26, 0.21],
  HEAD: Rgb = [1, 0.86, 0.5];
/** How much larger than life a machine, a load and a rocket are drawn, as a town's folk are: at their height or their distance each would be a speck. */
const SEEN = 2.2,
  LOAD_SEEN = 2.6,
  ROCKET_SEEN = 2.4;
/** Which way the wind takes smoke over a town (as its fires' smoke goes, render/blaze.ts), and how fast (m/s). */
const WIND_X = 0.932,
  WIND_Z = 0.362,
  WIND = 2.4;
/** Earth's pull, for what is thrown (m/s²). */
const PULL = 9.81;

/**
 * A part of a machine: where it sits (across, up, ahead of its middle) and how big it is (across, up, along), each a share of its
 * span; a turn of its own (a swept wing's, radians) and a tip about its own across (a disc turned to face ahead, a fin swept back).
 */
type Part = readonly [number, number, number, number, number, number, number, number];
/** A machine as its age built it: its parts by what each is drawn in, and its colours. */
type Look = {
  /** Boxes, rounded parts, wings and their struts, screws turning, where its crew sit, its engines' fire. */
  readonly body: readonly Part[];
  readonly hull: readonly Part[];
  readonly wing: readonly Part[];
  readonly prop: readonly Part[];
  readonly glass: readonly Part[];
  readonly fire: readonly Part[];
  readonly colour: Rgb;
  readonly wings: Rgb;
};
/** A disc turned to face ahead; how far a swept wing is turned back (radians). */
const DISC = Math.PI / 2,
  SWEEP = 0.6;
/**
 * The machines of three ages. Of oil and steam: two wings braced one over the other, a body of boxes, an engine between the wings to
 * either side. Of the lamp and the wire: one wing, four engines along it, a glazed nose. Past them: wings swept back, engines slung
 * under them with fire at their backs, no screws.
 */
const LOOKS: Readonly<Record<"first" | "later" | "last", Look>> = {
  first: {
    body: [
      [0, 0, 0.12, 0.075, 0.085, 0.3, 0, 0],
      [0, 0.008, -0.2, 0.05, 0.06, 0.34, 0, 0],
      [0, 0.055, -0.36, 0.008, 0.08, 0.075, 0, 0],
      [-0.17, 0.035, 0.1, 0.055, 0.055, 0.14, 0, 0],
      [0.17, 0.035, 0.1, 0.055, 0.055, 0.14, 0, 0],
    ],
    hull: [],
    wing: [
      [0, 0.1, 0.06, 1, 0.012, 0.13, 0, 0],
      [0, -0.03, 0.05, 0.9, 0.012, 0.12, 0, 0],
      [0, 0.02, -0.34, 0.3, 0.01, 0.08, 0, 0],
      [-0.26, 0.035, 0.055, 0.008, 0.13, 0.012, 0, 0],
      [0.26, 0.035, 0.055, 0.008, 0.13, 0.012, 0, 0],
      [-0.43, 0.035, 0.055, 0.008, 0.13, 0.012, 0, 0],
      [0.43, 0.035, 0.055, 0.008, 0.13, 0.012, 0, 0],
    ],
    prop: [
      [-0.17, 0.035, 0.175, 0.15, 0.006, 0.15, 0, DISC],
      [0.17, 0.035, 0.175, 0.15, 0.006, 0.15, 0, DISC],
    ],
    glass: [[0, 0.045, 0.16, 0.045, 0.014, 0.06, 0, 0]],
    fire: [],
    colour: [0.58, 0.5, 0.36],
    wings: [0.76, 0.69, 0.5],
  },
  later: {
    body: [[0, 0.075, -0.31, 0.012, 0.14, 0.12, 0, 0]],
    hull: [
      [0, 0, -0.01, 0.1, 0.105, 0.74, 0, 0],
      [-0.15, -0.006, 0.1, 0.055, 0.055, 0.17, 0, 0],
      [0.15, -0.006, 0.1, 0.055, 0.055, 0.17, 0, 0],
      [-0.3, -0.006, 0.085, 0.048, 0.048, 0.15, 0, 0],
      [0.3, -0.006, 0.085, 0.048, 0.048, 0.15, 0, 0],
    ],
    wing: [
      [0, -0.012, 0.04, 0.62, 0.018, 0.17, 0, 0],
      [0, -0.012, 0.035, 1, 0.012, 0.11, 0, 0],
      [0, 0.012, -0.31, 0.36, 0.01, 0.085, 0, 0],
    ],
    prop: [
      [-0.15, -0.006, 0.19, 0.11, 0.006, 0.11, 0, DISC],
      [0.15, -0.006, 0.19, 0.11, 0.006, 0.11, 0, DISC],
      [-0.3, -0.006, 0.165, 0.1, 0.006, 0.1, 0, DISC],
      [0.3, -0.006, 0.165, 0.1, 0.006, 0.1, 0, DISC],
    ],
    glass: [
      [0, 0.004, 0.36, 0.06, 0.055, 0.025, 0, 0],
      [0, 0.05, 0.22, 0.05, 0.022, 0.06, 0, 0],
    ],
    fire: [],
    colour: [0.4, 0.42, 0.31],
    wings: [0.45, 0.47, 0.36],
  },
  last: {
    body: [[0, 0.08, -0.36, 0.012, 0.15, 0.1, 0, -0.5]],
    hull: [
      [0, 0, -0.02, 0.085, 0.09, 0.82, 0, 0],
      [-0.17, -0.05, -0.006, 0.045, 0.05, 0.16, 0, 0],
      [0.17, -0.05, -0.006, 0.045, 0.05, 0.16, 0, 0],
      [-0.32, -0.05, -0.109, 0.042, 0.046, 0.15, 0, 0],
      [0.32, -0.05, -0.109, 0.042, 0.046, 0.15, 0, 0],
    ],
    wing: [
      [0.206, -0.01, -0.081, 0.52, 0.013, 0.15, SWEEP, 0],
      [-0.206, -0.01, -0.081, 0.52, 0.013, 0.15, -SWEEP, 0],
      [0.07, 0.012, -0.388, 0.18, 0.01, 0.07, SWEEP, 0],
      [-0.07, 0.012, -0.388, 0.18, 0.01, 0.07, -SWEEP, 0],
    ],
    prop: [],
    glass: [[0, 0.035, 0.36, 0.05, 0.022, 0.05, 0, 0]],
    fire: [
      [-0.17, -0.05, -0.1, 0.03, 0.07, 0.03, 0, -DISC],
      [0.17, -0.05, -0.1, 0.03, 0.07, 0.03, 0, -DISC],
      [-0.32, -0.05, -0.198, 0.028, 0.065, 0.028, 0, -DISC],
      [0.32, -0.05, -0.198, 0.028, 0.065, 0.028, 0, -DISC],
    ],
    colour: [0.74, 0.76, 0.8],
    wings: [0.66, 0.68, 0.72],
  },
};
/** The most parts of a kind any machine has. */
const MOST_PARTS = { body: 5, hull: 5, wing: 7, prop: 4, glass: 2, fire: 4 };

/** A load (m): its body's breadth and length, how far back its fins are and how broad. */
const LOAD_WIDE = 0.42,
  LOAD_LONG = 1.6,
  LOAD_FINS = 0.75,
  LOAD_FIN = 0.6;
/** A rocket (m): its breadth, its body and nose, its fins, its fire. */
const ROCKET_WIDE = 1.7,
  ROCKET_BODY = 11,
  ROCKET_NOSE = 3,
  ROCKET_FIN = 3.6,
  ROCKET_FIRE = 9;
/** Into how many lengths a rocket's smoke is drawn along its way, and how broad it is when it is left (m). */
const TRAIL = 40,
  TRAIL_WIDE = 12;
/** A hit's puffs of smoke, its dust going out along the ground, the lobes of its fireball. */
const SMOKES = 4,
  DUSTS = 8,
  LOBES = 3;
/** How long a hit's flash, its fire's heart and its fireball last (world seconds), and its dust. */
const FLASH_S = 0.3,
  CORE_S = 1.2,
  FIREBALL_S = 2.1,
  DUST_S = 3.4;
/** How long what a hit threw lies before it is gone (the last of its burst: world seconds). */
const LIES_FADE = 3;

/** The greatest fire (W5): what it is drawn in, and when its fire goes out and its cloud begins to thin (world seconds). */
const GREAT_WHITE: Rgb = [1, 0.98, 0.9],
  GREAT_FIRE: Rgb = [1, 0.48, 0.12],
  GREAT_CLOUD: Rgb = [0.6, 0.51, 0.43],
  GREAT_STEM: Rgb = [0.52, 0.46, 0.4],
  GREAT_DUST: Rgb = [0.66, 0.59, 0.49];
const GREAT_COOLS = 40,
  GREAT_THIN = 300;
/** Its head: puffs about its roll (two rings of so many), over its top, of its fire inside; its column; the dust about its foot and its shock. */
const ROLL = 14,
  CROWN = 9,
  INSIDE = 14,
  COLUMN = 14,
  SURGE = 16,
  SHOCK = 40;

/** How much larger than life a hit is drawn, as a machine is: from where the eye watches a raid a house's width is a few pixels. */
const BLAST_SEEN = 1.3;
/** How large a hit is drawn by how great it was (a bomb's 1, a rocket's more); how much longer its fire and dust last. */
function blastSize(b: { readonly size?: number }): number {
  return Math.pow(b.size ?? 1, 0.8) * BLAST_SEEN;
}
function blastLong(b: { readonly size?: number }): number {
  return Math.pow(b.size ?? 1, 0.35);
}

/** Seen by its own light as well as the sun's (as the land's fires are, render/wildfire.ts). */
function glowing(color: Rgb, opacity: number, glow: number): pc.StandardMaterial {
  const m = flatMaterial(color, opacity);
  m.emissive = new pc.Color(color[0] * glow, color[1] * glow, color[2] * glow);
  m.update();
  return m;
}

/** A share of [0, 1) by two whole numbers, for a hit's own scatter. */
function share(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Nothing drawn: an instance of no size. */
function none(out: number[]): void {
  out[3] = out[4] = out[5] = 0;
}

export class RaidLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("raid");
  private readonly bodies: InstancedBatch;
  private readonly hulls: InstancedBatch;
  private readonly wings: InstancedBatch;
  private readonly props: InstancedBatch;
  /** Small dark things: where a machine's crew sit, a load's fins, a rocket's. */
  private readonly dark: InstancedBatch;
  /** Engines' fire: a jet's, a rocket's. */
  private readonly fire: InstancedBatch;
  private readonly loads: InstancedBatch;
  private readonly rockets: InstancedBatch;
  private readonly noses: InstancedBatch;
  private readonly trail: InstancedBatch;
  private readonly flashes: InstancedBatch;
  private readonly cores: InstancedBatch;
  private readonly balls: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly dust: InstancedBatch;
  private readonly bits: InstancedBatch;
  private readonly scorch: InstancedBatch;
  /** The greatest fire (W5): what it is seen as, each lit but its heart, so that it stands up as a thing and not a sticker. */
  private readonly greatHot: InstancedBatch;
  private readonly greatFire: InstancedBatch;
  private readonly greatCloud: InstancedBatch;
  private readonly greatStem: InstancedBatch;
  private readonly greatSkirt: InstancedBatch;
  /** Which age's machines are drawn now. */
  private age: keyof typeof LOOKS = "first";
  private readonly d = [0, 0, 0];
  /** What was last drawn (the look tools). */
  shown = { flyers: 0, falling: 0, bursts: 0, streaks: 0, great: 0, marks: 0 };
  /** The greatest fire now (the look tools; the page's flash reads it too). */
  greatNow: GreatNow | null = null;

  constructor(stage: Stage, parent: pc.Entity) {
    parent.addChild(this.root);
    const root = this.root,
      box = boxMesh(stage),
      round = ballMesh(stage, 0.5, 5),
      puff = ballMesh(stage, 0.5, 4),
      cone = coneMesh(stage, 0.5, 1, 6),
      drum = cylinderMesh(stage, 0.5, 1, 10),
      first = LOOKS.first,
      most = MOST_RAIDERS;
    this.bodies = new InstancedBatch(stage, box, first.colour, most * MOST_PARTS.body, root);
    this.hulls = new InstancedBatch(stage, round, first.colour, most * MOST_PARTS.hull, root);
    this.wings = new InstancedBatch(stage, box, first.wings, most * MOST_PARTS.wing, root);
    this.props = new InstancedBatch(
      stage,
      drum,
      [0.2, 0.2, 0.2],
      most * MOST_PARTS.prop,
      root,
      flatMaterial([0.2, 0.2, 0.2], 0.4),
    ).shadows(false);
    this.dark = new InstancedBatch(
      stage,
      box,
      [0.12, 0.12, 0.13],
      most * MOST_PARTS.glass + MOST_FALLING * 2 + MOST_STREAKS * 2,
      root,
    );
    this.fire = new InstancedBatch(
      stage,
      cone,
      FLASH,
      most * MOST_PARTS.fire + MOST_STREAKS,
      root,
      glowing([1, 0.62, 0.2], 1, 1),
    ).shadows(false);
    this.loads = new InstancedBatch(stage, round, [0.2, 0.21, 0.18], MOST_FALLING, root);
    this.rockets = new InstancedBatch(stage, drum, [0.86, 0.86, 0.84], MOST_STREAKS, root);
    this.noses = new InstancedBatch(stage, cone, [0.2, 0.2, 0.22], MOST_STREAKS, root);
    this.trail = new InstancedBatch(
      stage,
      round,
      [0.93, 0.92, 0.9],
      MOST_STREAKS * TRAIL,
      root,
      glowing([0.95, 0.94, 0.92], 0.94, 0.85),
    ).shadows(false);
    this.flashes = new InstancedBatch(
      stage,
      round,
      [1, 0.97, 0.86],
      MOST_BURSTS + MOST_STREAKS,
      root,
      glowing([1, 0.97, 0.86], 1, 1),
    ).shadows(false);
    this.cores = new InstancedBatch(
      stage,
      round,
      [1, 0.82, 0.32],
      MOST_BURSTS,
      root,
      glowing([1, 0.82, 0.32], 1, 1),
    ).shadows(false);
    this.balls = new InstancedBatch(
      stage,
      round,
      FLASH,
      MOST_BURSTS * LOBES,
      root,
      glowing([1, 0.45, 0.1], 1, 0.9),
    ).shadows(false);
    this.smoke = new InstancedBatch(
      stage,
      puff,
      [0.4, 0.37, 0.35],
      MOST_BURSTS * SMOKES,
      root,
      glowing([0.4, 0.37, 0.35], 0.8, 0.3),
    ).shadows(false);
    this.dust = new InstancedBatch(
      stage,
      puff,
      DIRT,
      MOST_BURSTS * DUSTS,
      root,
      glowing([0.64, 0.57, 0.47], 0.75, 0.4),
    ).shadows(false);
    this.bits = new InstancedBatch(stage, box, [0.27, 0.23, 0.19], MOST_BURSTS * ROCKET_BITS, root);
    this.scorch = new InstancedBatch(stage, drum, [0.09, 0.08, 0.08], MOST_MARKS, root).shadows(
      false,
    );
    this.greatHot = new InstancedBatch(
      stage,
      round,
      GREAT_WHITE,
      1,
      root,
      glowing(GREAT_WHITE, 1, 1),
    ).shadows(false);
    this.greatFire = new InstancedBatch(
      stage,
      round,
      GREAT_FIRE,
      INSIDE,
      root,
      glowing(GREAT_FIRE, 1, 0.95),
    ).shadows(false);
    this.greatCloud = new InstancedBatch(stage, round, GREAT_CLOUD, ROLL * 2 + CROWN, root).shadows(
      false,
    );
    this.greatStem = new InstancedBatch(stage, round, GREAT_STEM, COLUMN, root).shadows(false);
    this.greatSkirt = new InstancedBatch(
      stage,
      puff,
      GREAT_DUST,
      SURGE + SHOCK,
      root,
      glowing(GREAT_DUST, 0.88, 0.25),
    ).shadows(false);
  }

  /** Whether anything of a raid is drawn now (the village keeps calling until nothing is). */
  get busy(): boolean {
    const s = this.shown;
    return s.flyers + s.falling + s.bursts + s.streaks + s.great + s.marks > 0;
  }

  /**
   * What of a raid is over the town now: its machines in the look of the age (`era`, `past`: as far past our ages as its land has
   * come), by the screen's clock `clock` for their screws and fire; the eye where it is (units), for none of the greatest fire's
   * puffs to be drawn about it.
   */
  update(
    now: RaidNow,
    era: string | undefined,
    past: boolean,
    clock: number,
    eye: { x: number; y: number; z: number } | null = null,
  ): void {
    this.drawGreat(now.great, eye);
    const age = past ? "last" : era === "modern" ? "later" : "first";
    if (age !== this.age) {
      this.age = age;
      this.bodies.recolor(LOOKS[age].colour);
      this.hulls.recolor(LOOKS[age].colour);
      this.wings.recolor(LOOKS[age].wings);
    }
    const look = LOOKS[age],
      flyers = now.flyers,
      n = Math.min(MOST_RAIDERS, flyers.length),
      falling = now.falling,
      nl = Math.min(MOST_FALLING, falling.length),
      streaks = now.streaks,
      nr = Math.min(MOST_STREAKS, streaks.length),
      bursts = now.bursts,
      nb = Math.min(MOST_BURSTS, bursts.length),
      marks = now.marks,
      nm = Math.min(MOST_MARKS, marks.length);
    this.shown = {
      flyers: n,
      falling: nl,
      bursts: nb,
      streaks: nr,
      great: now.great ? 1 : 0,
      marks: nm,
    };
    // A machine's part, set in its frame: across, up and ahead of where it flies, at its drawn size.
    const part = (parts: readonly Part[], i: number, out: number[]) => {
      const f = flyers[Math.floor(i / parts.length)]!,
        q = parts[i % parts.length]!,
        S = f.span * SEEN * M,
        c = Math.cos(f.yaw),
        s = Math.sin(f.yaw),
        u = q[0] * S,
        w = q[2] * S;
      out[0] = f.x * M + u * c + w * s;
      out[1] = f.y * M + q[1] * S;
      out[2] = f.z * M - u * s + w * c;
      out[3] = q[3] * S;
      out[4] = q[4] * S;
      out[5] = q[5] * S;
      out[6] = f.yaw + q[6];
      out[7] = q[7];
    };
    this.bodies.set(n * look.body.length, (i, out) => part(look.body, i, out));
    this.hulls.set(n * look.hull.length, (i, out) => part(look.hull, i, out));
    this.wings.set(n * look.wing.length, (i, out) => part(look.wing, i, out));
    // (Screws turning: a disc that shivers a little by the screen's clock.)
    this.props.set(n * look.prop.length, (i, out) => {
      part(look.prop, i, out);
      const k = 0.92 + 0.08 * Math.sin(clock * 37 + i * 2.1);
      out[3] = out[3]! * k;
      out[5] = out[5]! * k;
    });
    // Where a rocket's part sits, so far back of its nose along its way (m, as drawn), into out.
    const back = (k: (typeof streaks)[number], m: number, out: number[]) => {
      const c = Math.cos(k.slant),
        b = m * ROCKET_SEEN;
      out[0] = (k.x - Math.sin(k.yaw) * c * b) * M;
      out[1] = (k.y + Math.sin(k.slant) * b) * M;
      out[2] = (k.z - Math.cos(k.yaw) * c * b) * M;
    };
    // Its crew's glass; each load's fins, crossed at its tail; each rocket's.
    const glass = n * look.glass.length,
      fins = nl * 2;
    this.dark.set(glass + fins + nr * 2, (i, out) => {
      if (i < glass) return part(look.glass, i, out);
      if (i < glass + fins) {
        const b = falling[Math.floor((i - glass) / 2)]!,
          across = (i - glass) % 2 === 0,
          L = LOAD_SEEN,
          c = Math.cos(b.pitch);
        out[0] = (b.x - Math.sin(b.yaw) * c * LOAD_FINS * L) * M;
        out[1] = (b.y + Math.sin(b.pitch) * LOAD_FINS * L) * M;
        out[2] = (b.z - Math.cos(b.yaw) * c * LOAD_FINS * L) * M;
        out[3] = (across ? LOAD_FIN : 0.05) * L * M;
        out[4] = (across ? 0.05 : LOAD_FIN) * L * M;
        out[5] = 0.5 * L * M;
        out[6] = b.yaw;
        out[7] = b.pitch;
        return;
      }
      const j = i - glass - fins,
        k = streaks[Math.floor(j / 2)]!;
      if (!k.falling) return none(out);
      back(k, ROCKET_NOSE + ROCKET_BODY - 1.2, out);
      const across = j % 2 === 0,
        R = ROCKET_SEEN * M;
      out[3] = (across ? ROCKET_FIN : 0.15) * R;
      out[4] = (across ? 0.15 : ROCKET_FIN) * R;
      out[5] = 2.4 * R;
      out[6] = k.yaw;
      out[7] = k.slant;
    });
    // A jet's fire at its engines' backs; a rocket's at its tail, flickering by the screen's clock.
    const jets = n * look.fire.length;
    this.fire.set(jets + nr, (i, out) => {
      if (i < jets) {
        part(look.fire, i, out);
        out[4] = out[4]! * (0.85 + 0.3 * Math.abs(Math.sin(clock * 23 + i)));
        return;
      }
      const k = streaks[i - jets]!;
      if (!k.falling) return none(out);
      const flick = 0.8 + 0.35 * Math.abs(Math.sin(clock * 29 + i * 1.7)),
        R = ROCKET_SEEN * M;
      back(k, ROCKET_NOSE + ROCKET_BODY + (ROCKET_FIRE * flick) / 2, out);
      out[3] = out[5] = ROCKET_WIDE * 0.9 * R;
      out[4] = ROCKET_FIRE * flick * R;
      out[6] = k.yaw;
      // (Its point back up its way.)
      out[7] = k.slant - Math.PI / 2;
    });
    this.loads.set(nl, (i, out) => {
      const b = falling[i]!,
        L = LOAD_SEEN * M;
      out[0] = b.x * M;
      out[1] = b.y * M;
      out[2] = b.z * M;
      out[3] = out[4] = LOAD_WIDE * L;
      out[5] = LOAD_LONG * L;
      out[6] = b.yaw;
      out[7] = b.pitch;
    });
    // A rocket: its body along its way behind its nose, its nose at its head.
    this.rockets.set(nr, (i, out) => {
      const k = streaks[i]!;
      if (!k.falling) return none(out);
      const R = ROCKET_SEEN * M;
      back(k, ROCKET_NOSE + ROCKET_BODY / 2, out);
      out[3] = out[5] = ROCKET_WIDE * R;
      out[4] = ROCKET_BODY * R;
      out[6] = k.yaw;
      out[7] = k.slant + Math.PI / 2;
    });
    this.noses.set(nr, (i, out) => {
      const k = streaks[i]!;
      if (!k.falling) return none(out);
      const R = ROCKET_SEEN * M;
      back(k, ROCKET_NOSE / 2, out);
      out[3] = out[5] = ROCKET_WIDE * R;
      out[4] = ROCKET_NOSE * R;
      out[6] = k.yaw;
      out[7] = k.slant + Math.PI / 2;
    });
    // The smoke a rocket leaves, length by length up its way: each left as its head went by, broadening and drifting on the
    // wind from then, gone at the last; the topmost thinner, where it was first seen.
    const d = this.d;
    this.trail.set(nr * TRAIL, (i, out) => {
      const k = streaks[Math.floor(i / TRAIL)]!,
        j = i % TRAIL,
        len = (DIVE_SEEN - k.stop) / TRAIL,
        sigma = k.stop + (j + 0.5) * len,
        age = k.since + (sigma - k.stop) / k.speed;
      if (sigma < k.head || age < 0 || age > STREAK_HANGS) return none(out);
      diveAt(sigma, d);
      const fade = age > STREAK_HANGS * 0.65 ? (STREAK_HANGS - age) / (STREAK_HANGS * 0.35) : 1,
        top = j >= TRAIL - 3 ? (TRAIL - j) / 4 : 1,
        wide = (TRAIL_WIDE + 4 * Math.sqrt(age)) * fade * top * (0.75 + 0.5 * share(k.key, 40 + j)),
        drift = WIND * age,
        wobble = (share(k.key, j) - 0.5) * age * 0.9;
      out[0] = (k.ax - Math.sin(k.yaw) * d[0]! + WIND_X * drift + wobble) * M;
      out[1] = (k.ay + d[1]! + 0.6 * age) * M;
      out[2] = (k.az - Math.cos(k.yaw) * d[0]! + WIND_Z * drift - wobble * 0.5) * M;
      out[3] = out[4] = wide * M;
      out[5] = (len * 1.3 + age * 0.4) * M;
      out[6] = k.yaw;
      out[7] = d[2]!;
    });
    // Each hit: its flash, at once and gone; a rocket's fire bright at its tail.
    this.flashes.set(nb + nr, (i, out) => {
      if (i >= nb) {
        const k = streaks[i - nb]!;
        if (!k.falling) return none(out);
        back(k, ROCKET_NOSE + ROCKET_BODY + 0.5, out);
        out[3] =
          out[4] =
          out[5] =
            ROCKET_WIDE * 2.2 * ROCKET_SEEN * M * (0.85 + 0.25 * Math.sin(clock * 31 + i));
        return;
      }
      const b = bursts[i]!;
      const q = blastSize(b),
        u = b.s / blastLong(b);
      if (u > FLASH_S) return none(out);
      const r = (10 + 8 * q) * Math.sqrt(1 - u / FLASH_S);
      out[0] = b.x * M;
      out[1] = (b.y + 2 * q) * M;
      out[2] = b.z * M;
      out[3] = out[4] = out[5] = r * M;
    });
    // Its fireball: a white-hot heart swelling and gone in a moment, and lobes of fire about it climbing and dying into its smoke.
    this.cores.set(nb, (i, out) => {
      const b = bursts[i]!;
      const q = blastSize(b),
        u = b.s / blastLong(b);
      if (u > CORE_S) return none(out);
      const swell = 1 - Math.exp(-u / 0.07),
        r = 4.4 * q * swell * Math.pow(1 - u / CORE_S, 0.6);
      out[0] = b.x * M;
      out[1] = (b.y + q * (1.2 + 2.2 * u)) * M;
      out[2] = b.z * M;
      out[3] = out[5] = 2 * r * M;
      out[4] = 1.7 * r * M;
    });
    this.balls.set(nb * LOBES, (i, out) => {
      const b = bursts[Math.floor(i / LOBES)]!,
        l = i % LOBES;
      const q = blastSize(b),
        u = b.s / blastLong(b);
      if (u > FIREBALL_S) return none(out);
      const swell = 1 - Math.exp(-u / 0.1),
        r = 3.8 * q * swell * Math.pow(1 - u / FIREBALL_S, 0.7),
        a = share(b.key, 11 + l) * 2 * Math.PI,
        off = r * 0.55 * (0.6 + u);
      out[0] = (b.x + Math.cos(a) * off) * M;
      out[1] = (b.y + q * (1 + 2.6 * u + l * 0.6)) * M;
      out[2] = (b.z + Math.sin(a) * off) * M;
      out[3] = out[5] = 2 * r * M;
      out[4] = 1.7 * r * M;
      out[6] = a;
    });
    // Its smoke: puffs after the fire, climbing, broadening and drifting on the wind; thinning away at the last.
    this.smoke.set(nb * SMOKES, (i, out) => {
      const b = bursts[Math.floor(i / SMOKES)]!,
        j = i % SMOKES,
        age = b.s - (0.7 + 0.4 * j) * blastLong(b);
      if (age <= 0) return none(out);
      const q = blastSize(b),
        life = b.s / Math.max(1e-6, b.k),
        grow = 1 - Math.exp(-age / 1.4),
        fade = b.k > 0.6 ? Math.max(0, (1 - b.k) / 0.4) : 1,
        r = ((2.4 + 0.5 * j) * q * (0.45 + 0.55 * grow) + 0.25 * age * q) * fade,
        a = share(b.key, 21 + j) * 2 * Math.PI;
      out[0] = (b.x + WIND_X * WIND * 0.8 * age + Math.cos(a) * 1.5 * q) * M;
      out[1] = (b.y + 2 * q + (4 + 2 * j) * q * grow + 0.8 * age * q) * M;
      out[2] = (b.z + WIND_Z * WIND * 0.8 * age + Math.sin(a) * 1.5 * q) * M;
      out[3] = out[5] = 2 * r * M;
      out[4] = 1.6 * r * M;
      out[6] = a + life;
    });
    // Its dust: a ring going out along the ground from under it (less from a roof's, what it shook down), settling as it goes.
    this.dust.set(nb * DUSTS, (i, out) => {
      const b = bursts[Math.floor(i / DUSTS)]!,
        j = i % DUSTS;
      const q = blastSize(b),
        u = b.s / blastLong(b);
      if (u > DUST_S) return none(out);
      const roof = b.y > 3 ? 0.65 : 1,
        reach = (3 + 8 * q) * (1 - Math.exp(-u / 0.4)) * roof,
        r = (2.2 * q * (1 - u / DUST_S) + 0.4) * roof,
        a = (j / DUSTS) * 2 * Math.PI + share(b.key, 31) * 0.8;
      out[0] = (b.x + Math.cos(a) * reach) * M;
      out[1] = (0.5 + r * 0.35) * M;
      out[2] = (b.z + Math.sin(a) * reach) * M;
      out[3] = out[5] = 2 * r * M;
      out[4] = 0.9 * r * M;
      out[6] = a;
    });
    // What it threw: tumbling off on its own slant, then lying where it came down on a roof or the ground; gone at the last.
    this.bits.set(nb * ROCKET_BITS, (i, out) => {
      const b = bursts[Math.floor(i / ROCKET_BITS)]!,
        c = i % ROCKET_BITS,
        o = c * BIT,
        bits = b.bits;
      if (o >= bits.length) return none(out);
      const vx = bits[o]!,
        vy = bits[o + 1]!,
        vz = bits[o + 2]!,
        land = bits[o + 3]!,
        size = bits[o + 7]!,
        life = b.s / Math.max(1e-6, b.k),
        left = life - b.s,
        k = left < LIES_FADE ? Math.max(0, left / LIES_FADE) : 1,
        rest = bits[o + 5]! + size * 0.25,
        y0 = b.y + 0.6;
      if (b.s < land) {
        const s = b.s;
        out[0] = (b.x + vx * s) * M;
        out[1] = (y0 + vy * s - 0.5 * PULL * s * s) * M;
        out[2] = (b.z + vz * s) * M;
        out[6] = c * 1.7 + s * (5 + c);
        out[7] = s * (4 + 0.6 * c);
      } else {
        // (Come down: lying flat; one that met a wall drops to its foot.)
        const high = y0 + vy * land - 0.5 * PULL * land * land,
          drop = Math.min(1, (b.s - land) / 0.4);
        out[0] = bits[o + 4]! * M;
        out[1] = (high > rest + 1 ? high + (rest - high) * drop * drop : rest) * M;
        out[2] = bits[o + 6]! * M;
        out[6] = c * 1.7 + land * (5 + c);
        out[7] = 0;
      }
      out[3] = size * k * M;
      out[4] = size * 0.55 * k * M;
      out[5] = size * 0.8 * k * M;
    });
    // The ground it scorched: dark, a little out of round; fading in the last third of its time.
    this.scorch.set(nm, (i, out) => {
      const m = marks[i]!,
        e = share(Math.round(m.x * 7), Math.round(m.z * 7)),
        k = m.k < 0.66 ? 1 : Math.max(0, (1 - m.k) / 0.34);
      out[0] = m.x * M;
      out[1] = 0.56 * M;
      out[2] = m.z * M;
      out[3] = 2 * m.r * (0.85 + 0.3 * e) * k * M;
      out[4] = 0.1 * M;
      out[5] = 2 * m.r * (1.15 - 0.3 * e) * k * M;
      out[6] = e * 6;
    });
  }

  /**
   * The greatest fire (W5), by how long since it fell: white over the town, gone in moments; out of it a ball of fire climbing on
   * a column of dust and smoke drawn up from the ground, spreading into a head that rolls on itself as it rises, its fire going
   * out inside it as it darkens; a ring of dust going out along the ground under it, and before it all, the shock crossing the
   * town as the lots catch (view/raid.ts greatGone). The cloud stands, leaning on the wind, and thins. All of it far taller than
   * anything of the town's, and larger than a rocket's by more than can be mistaken; drawn to some half a kilometre, less than
   * life, so that the eye over a town on a phone held upright has the whole of it from foot to head. None of it drawn about the eye.
   */
  private drawGreat(
    g: GreatNow | undefined,
    eye: { x: number; y: number; z: number } | null,
  ): void {
    this.greatNow = g ?? null;
    if (!g) {
      for (const b of [
        this.greatHot,
        this.greatFire,
        this.greatCloud,
        this.greatStem,
        this.greatSkirt,
      ])
        b.set(0, () => {});
      return;
    }
    const s = g.since,
      x = g.x,
      z = g.z,
      ease = (u: number) => 1 - (1 - u) * (1 - u),
      // (Its head's middle, how far its roll reaches from it, and how thick the roll is: metres.)
      H = 70 + 350 * ease(Math.min(1, s / 60)),
      R = 45 + 85 * ease(Math.min(1, s / 70)),
      r = R * 0.5,
      form = Math.min(1, s / 9),
      hot = s < GREAT_COOLS ? 1 - s / GREAT_COOLS : 0,
      thin = s > GREAT_THIN ? Math.max(0, 1 - (s - GREAT_THIN) / (GREAT_LASTS - GREAT_THIN)) : 1,
      // (Leaning on the wind, slowly: it stays where it can be seen.)
      drift = Math.min(110, Math.max(0, s - 30) * 0.25),
      hx = x + WIND_X * drift,
      hz = z + WIND_Z * drift,
      // (A puff the eye is in, or nearly, is not drawn: it would fill the screen.)
      clear = (px: number, py: number, pz: number, size: number, out: number[]) => {
        if (
          !eye ||
          (px - eye.x) ** 2 + (py - eye.y) ** 2 + (pz - eye.z) ** 2 > (size * 0.55 + 3) ** 2
        )
          return true;
        none(out);
        return false;
      };
    // White, swelling over the town and gone in moments, rising a little as it goes.
    this.greatHot.set(s < 7 ? 1 : 0, (_, out) => {
      const w =
        150 * Math.sqrt(Math.min(1, s / 0.7)) * (s < 1.5 ? 1 : Math.max(0, 1 - (s - 1.5) / 5.5));
      out[0] = x * M;
      out[1] = (w * 0.35 + 18 * s) * M;
      out[2] = z * M;
      out[3] = out[4] = out[5] = 2 * w * M;
    });
    // Its fire: the ball the white cools into, climbing; then within its head's roll, going out.
    this.greatFire.set(hot > 0 ? INSIDE : 0, (n, out) => {
      const a = (n / INSIDE) * 2 * Math.PI + s * 0.05,
        early = 1 - form,
        reach = (R - r * 0.35) * (0.35 + 0.65 * form),
        size = (r * 1.15 * Math.pow(hot, 0.7) + early * R * 0.9) * (0.8 + 0.4 * share(n, 7)),
        px = hx + Math.cos(a) * reach,
        py = H - r * 0.2 + ((n % 3) - 1) * r * 0.25,
        pz = hz + Math.sin(a) * reach;
      if (!clear(px * M, py * M, pz * M, size * M, out)) return;
      out[0] = px * M;
      out[1] = py * M;
      out[2] = pz * M;
      out[3] = out[5] = size * M;
      out[4] = size * 0.85 * M;
      out[6] = a;
    });
    // Its head: two rings of puffs rolling about its roll, outward over the top and in under it; a crown over them.
    this.greatCloud.set(s > 0.6 ? ROLL * 2 + CROWN : 0, (n, out) => {
      let px: number, py: number, pz: number, size: number;
      if (n < ROLL * 2) {
        const ring = n >= ROLL ? 1 : 0,
          i = n % ROLL,
          a = (i / ROLL) * 2 * Math.PI + ring * (Math.PI / ROLL) + s * 0.01,
          phi = (ring ? 3.6 : 0.6) + s * 0.07 + share(i, 3 + ring) * 0.5,
          out1 = R + r * Math.cos(phi);
        px = hx + Math.cos(a) * out1;
        py = H + r * 0.85 * Math.sin(phi);
        pz = hz + Math.sin(a) * out1;
        size = r * 1.3 * form * (0.85 + 0.3 * share(i, 9 + ring)) * (0.6 + 0.4 * thin);
      } else {
        const i = n - ROLL * 2,
          a = (i / CROWN) * 2 * Math.PI + 0.3,
          reach = i === 0 ? 0 : R * 0.5;
        px = hx + Math.cos(a) * reach;
        py = H + r * (i === 0 ? 0.9 : 0.6);
        pz = hz + Math.sin(a) * reach;
        size = r * 1.35 * form * (0.6 + 0.4 * thin);
      }
      if (!clear(px * M, py * M, pz * M, size * M, out)) return;
      out[0] = px * M;
      out[1] = py * M;
      out[2] = pz * M;
      out[3] = out[5] = size * M;
      out[4] = size * 0.82 * M;
      out[6] = n * 0.7;
    });
    // Its column: drawn up from the ground into its head, broad at the foot and narrowing, leaning as its head drifts.
    const top = Math.min(H - r * 0.5, 30 + 70 * s);
    this.greatStem.set(s > 1 && thin > 0.05 ? COLUMN : 0, (n, out) => {
      const u = (n + 0.5) / COLUMN,
        py = 15 + u * (top - 15),
        wide = R * (0.4 - 0.2 * u) * (0.55 + 0.45 * form) * (0.5 + 0.5 * thin),
        lean = py / Math.max(1, H),
        a = share(n, 13) * 2 * Math.PI,
        px = x + WIND_X * drift * lean + Math.cos(a) * wide * 0.12,
        pz = z + WIND_Z * drift * lean + Math.sin(a) * wide * 0.12,
        size = 2 * wide;
      if (!clear(px * M, py * M, pz * M, size * M, out)) return;
      out[0] = px * M;
      out[1] = py * M;
      out[2] = pz * M;
      out[3] = out[5] = size * M;
      out[4] = Math.max(size, ((top - 15) / COLUMN) * 1.6) * M;
      out[6] = a;
    });
    // About its foot, a ring of dust going out and settling; and before it, the shock going out over the town as it takes it.
    const shock = greatGone(s);
    this.greatSkirt.set(s > 0.5 && s < 300 ? SURGE + SHOCK : 0, (n, out) => {
      let px: number, py: number, pz: number, size: number, flat: number, a: number;
      if (n < SURGE) {
        const k = s < 140 ? 1 : Math.max(0, 1 - (s - 140) / 160),
          reach = 40 + 300 * ease(Math.min(1, s / 50));
        a = (n / SURGE) * 2 * Math.PI;
        size = (60 + 40 * Math.min(1, s / 30)) * k;
        px = x + Math.cos(a) * reach;
        pz = z + Math.sin(a) * reach;
        py = size * 0.18;
        flat = 0.45;
      } else {
        if (!(shock < Infinity) || s > 21) return none(out);
        const i = n - SURGE;
        a = (i / SHOCK) * 2 * Math.PI + 0.04;
        size = (34 + 20 * Math.min(1, s / 3)) * Math.min(1, (21 - s) / 3);
        px = x + Math.cos(a) * shock;
        pz = z + Math.sin(a) * shock;
        py = size * 0.22;
        flat = 0.55;
      }
      if (!clear(px * M, py * M, pz * M, size * M, out)) return;
      out[0] = px * M;
      out[1] = py * M;
      out[2] = pz * M;
      out[3] = out[5] = size * M;
      out[4] = size * flat * M;
      out[6] = a;
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
