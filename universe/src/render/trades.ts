// A town's trades seen at their buildings (Phase 41 M199): its mills' sails turning on their
// hubs, its kilns' mouths aglow while they are fired, and the sparks off the anvil before its
// smithy at each blow of the hammer. And things seen being made (Phase 51 M213): the furnace by
// the diggings aglow while its smelter works the bellows, and the rack before the smithy with the
// day's new tools hung on it, each in its own stuff. Units as the village's: a tenth of a unit to
// the metre; the sparks, the glow and the rack sized to its folk, drawn three times a person's
// size.
import * as pc from "playcanvas";
import { RACK_MOST, rackSlot, type CivicMotion, type Hung } from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1;
/** A mill's sails: how many, how long and how broad (metres), how far out from the hub. */
const SAILS = 4,
  SAIL_LONG = 7,
  SAIL_WIDE = 1.7,
  /** Sparks to a blow, and a blow's length (screen seconds). */
  SPARKS = 7,
  BLOW = 0.62;
const CANVAS: Rgb = [0.93, 0.9, 0.82],
  EMBER: Rgb = [1, 0.46, 0.12],
  SPARK: Rgb = [1, 0.8, 0.36],
  TIMBER: Rgb = [0.42, 0.3, 0.18],
  HAFT: Rgb = [0.5, 0.34, 0.2];
/** A rack's bar: how high (metres, at the folk's size). */
const RACK_HIGH = 4.8;
/**
 * A hung tool by what it is (metres, at the folk's size): its haft's length (a knife's handle, a
 * cord for a head hung alone), and its head across, down and out from the rack.
 */
const HUNG_SHAPE: Readonly<Record<string, readonly [number, number, number, number]>> = {
  sickle: [1.2, 0.12, 0.95, 0.6],
  hoe: [2.4, 0.8, 0.16, 0.62],
  axe: [2, 0.62, 0.52, 0.16],
  knife: [0.8, 0.1, 1.1, 0.24],
  spearhead: [0.6, 0.2, 1, 0.2],
  "plough share": [0.6, 0.85, 0.5, 0.72],
};
const HUNG_TOOL = [2, 0.5, 0.5, 0.5] as const;

/** Where the furnace by the diggings has its mouth (metres) and which way it faces. */
export type FurnaceAt = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  /** The top of its shaft, where the charcoal burns. */
  readonly top: { readonly x: number; readonly y: number; readonly z: number };
};

/** A smithy's rack now: where it stands, which way its bar runs, what hangs on it. */
export type RackAt = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly hung: readonly Hung[];
};

/** Who is at work at a kiln or a smithy now: where they stand and which way they face (metres). */
export type AtWork = { readonly x: number; readonly z: number; readonly yaw: number } | null;

export class TradesLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("trades");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly ember: pc.StandardMaterial;
  private readonly spark: pc.StandardMaterial;
  private batches: InstancedBatch[] = [];
  private sails: InstancedBatch | null = null;
  private glow: InstancedBatch | null = null;
  private sparks: InstancedBatch | null = null;
  private furnace: FurnaceAt | null = null;
  private furnaceGlow: InstancedBatch | null = null;
  private rack: { frame: InstancedBatch; hafts: InstancedBatch; heads: InstancedBatch } | null =
    null;
  /** The mills, kilns and smithies drawn (the town's, as last laid out). */
  works: readonly CivicMotion[] = [];
  /**
   * What was last drawn (the look tools): the first mill's sails' turn, the kilns aglow, the sparks
   * flying; the furnace aglow (Phase 51 M213), the tools on the rack.
   */
  shown = {
    turn: 0,
    glowing: 0,
    sparks: 0,
    smelting: false,
    hung: 0,
    rack: null as { x: number; z: number } | null,
  };

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    // (Held: its batches are made anew each time the town is laid out, and the last of them
    // ending would otherwise destroy it with itself.)
    this.box = keptMesh(boxMesh(stage));
    const lit = (c: Rgb) => {
      const m = new pc.StandardMaterial();
      m.useLighting = false;
      m.diffuse = new pc.Color(0, 0, 0);
      m.emissive = new pc.Color(c[0], c[1], c[2]);
      m.update();
      return m;
    };
    this.ember = lit(EMBER);
    this.spark = lit(SPARK);
  }

  /**
   * The town's mills, kilns and smithies standing (none, a village); the furnace by its diggings
   * (null: none); and, where its smiths hang their tools on a rack, their heads' colour.
   */
  build(
    works: readonly CivicMotion[],
    furnace: FurnaceAt | null = null,
    tool: Rgb | null = null,
  ): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.works = works;
    this.furnace = furnace;
    const count = (k: CivicMotion["kind"]) => works.filter((w) => w.kind === k).length,
      make = (color: Rgb, n: number, material?: pc.Material) => {
        if (!n) return null;
        const b = new InstancedBatch(this.stage, this.box, color, n, this.root, material);
        this.batches.push(b);
        return b;
      };
    this.sails = make(CANVAS, count("mill") * SAILS);
    this.glow = make(EMBER, count("kiln"), this.ember);
    this.sparks = make(SPARK, count("smithy") * SPARKS, this.spark);
    this.furnaceGlow = furnace ? make(EMBER, 2, this.ember) : null;
    const frame = tool ? make(TIMBER, 3) : null,
      hafts = tool ? make(HAFT, RACK_MOST) : null,
      heads = tool ? make(tool, RACK_MOST) : null;
    this.rack = frame && hafts && heads ? { frame, hafts, heads } : null;
    this.shown = { turn: 0, glowing: 0, sparks: 0, smelting: false, hung: 0, rack: null };
  }

  /**
   * The furnace and the rack now (Phase 51 M213): the furnace's mouth aglow, flickering, while its
   * smelter works the bellows; the rack standing, the day's tools hung on it as they are made.
   */
  making(s: number, smelting: boolean, rack: RackAt | null): void {
    const f = this.furnace;
    if (this.furnaceGlow) {
      this.shown.smelting = smelting && !!f;
      // (Its mouth, toward the town; and the charcoal burning at its top, seen from every side.)
      this.furnaceGlow.set(this.shown.smelting ? 2 : 0, (i, out) => {
        const flick = 0.8 + 0.2 * Math.sin(s * 13 + i * 2) * Math.sin(s * 4.1 + 1 + i);
        if (i === 0) {
          out[0] = f!.x * M;
          out[1] = 1.1 * flick * M;
          out[2] = f!.z * M;
          out[3] = 2.3 * M;
          out[4] = 1.9 * flick * M;
          out[5] = 0.3 * M;
        } else {
          out[0] = f!.top.x * M;
          out[1] = (f!.top.y + 0.2 * flick) * M;
          out[2] = f!.top.z * M;
          out[3] = out[5] = 3.6 * M;
          out[4] = 0.5 * flick * M;
        }
        out[6] = f!.yaw + s * (i ? 0.7 : 0);
      });
    }
    if (!this.rack) return;
    const { frame, hafts, heads } = this.rack;
    if (!rack) {
      frame.set(0, () => {});
      hafts.set(0, () => {});
      heads.set(0, () => {});
      this.shown.hung = 0;
      this.shown.rack = null;
      return;
    }
    this.shown.rack = { x: rack.x, z: rack.z };
    // Its two posts and the bar between them, along its front.
    const half = (RACK_MOST / 2) * 0.75 + 0.5,
      c = Math.cos(rack.yaw),
      sn = Math.sin(rack.yaw);
    frame.set(3, (i, out) => {
      const along = i === 2 ? 0 : i === 0 ? -half : half;
      out[0] = (rack.x + c * along) * M;
      out[1] = (i === 2 ? RACK_HIGH : RACK_HIGH / 2) * M;
      out[2] = (rack.z - sn * along) * M;
      out[3] = (i === 2 ? half * 2 + 0.3 : 0.3) * M;
      out[4] = (i === 2 ? 0.25 : RACK_HIGH) * M;
      out[5] = (i === 2 ? 0.25 : 0.3) * M;
      out[6] = rack.yaw;
    });
    // Each tool hung by its haft from the bar, its head down, in the order made.
    const n = Math.min(RACK_MOST, rack.hung.length);
    this.shown.hung = n;
    const shape = (k: number) => HUNG_SHAPE[rack.hung[k]!.form] ?? HUNG_TOOL;
    hafts.set(n, (k, out) => {
      const at = rackSlot(rack, k),
        [haft] = shape(k);
      out[0] = at.x * M;
      out[1] = (RACK_HIGH - haft / 2) * M;
      out[2] = at.z * M;
      out[3] = out[5] = (haft < 1 ? 0.06 : 0.12) * M;
      out[4] = haft * M;
      out[6] = rack.yaw;
    });
    heads.set(n, (k, out) => {
      const at = rackSlot(rack, k),
        [haft, across, down, outward] = shape(k);
      out[0] = at.x * M;
      out[1] = (RACK_HIGH - haft - down / 2) * M;
      out[2] = at.z * M;
      out[3] = across * M;
      out[4] = down * M;
      out[5] = outward * M;
      out[6] = rack.yaw;
    });
  }

  /**
   * Their work now, by the screen's clock `s`: the sails turning (held still where small motions
   * are not drawn); each kiln aglow while one tends it, each smithy's anvil sparking while one
   * strikes at it (`busy`, by the works' order: who is at it, or null).
   */
  update(s: number, motion: boolean, busy: readonly AtWork[]): void {
    const works = this.works,
      clock = motion ? s : 0;
    if (this.sails) {
      const mills = works.filter((w) => w.kind === "mill"),
        r = SAIL_LONG / 2 + 0.4;
      this.sails.set(mills.length * SAILS, (i, out) => {
        const w = mills[Math.floor(i / SAILS)]!,
          k = Math.floor(i / SAILS),
          spin = clock * 0.8 + k * 1.3,
          p = spin + ((i % SAILS) * 2 * Math.PI) / SAILS,
          // (Turned about the hub's axis, which runs out of the mill's front.)
          yaw = w.yaw - Math.PI / 2,
          sy = Math.sin(yaw);
        if (i === 0) this.shown.turn = spin;
        out[0] = (w.x + sy * Math.sin(p) * r) * M;
        out[1] = (w.y + Math.cos(p) * r) * M;
        out[2] = (w.z + Math.cos(yaw) * Math.sin(p) * r) * M;
        out[3] = 0.3 * M;
        out[4] = SAIL_LONG * M;
        out[5] = SAIL_WIDE * M;
        out[6] = yaw;
        out[7] = p;
      });
    }
    // The kilns being fired: their mouths aglow, flickering.
    if (this.glow) {
      const fired = works
        .map((w, k) => ({ w, k }))
        .filter(({ w, k }) => w.kind === "kiln" && busy[k]);
      this.shown.glowing = fired.length;
      this.glow.set(fired.length, (i, out) => {
        const { w, k } = fired[i]!,
          flick = 0.85 + 0.15 * Math.sin(s * 11 + k * 2.3) * Math.sin(s * 3.7 + k);
        out[0] = w.x * M;
        out[1] = w.y * flick * M;
        out[2] = w.z * M;
        out[3] = 1.7 * M;
        out[4] = 1.3 * flick * M;
        out[5] = 0.3 * M;
        out[6] = w.yaw;
      });
    }
    // At each smithy where one strikes: sparks off the anvil before them, flung up and falling.
    if (this.sparks) {
      const anvils: { x: number; z: number; k: number }[] = [];
      works.forEach((w, k) => {
        const at = busy[k];
        if (w.kind !== "smithy" || !at) return;
        anvils.push({ x: at.x + Math.sin(at.yaw) * 2.2, z: at.z + Math.cos(at.yaw) * 2.2, k });
      });
      const n = anvils.length * SPARKS;
      this.shown.sparks = n;
      this.sparks.set(n, (i, out) => {
        const a = anvils[Math.floor(i / SPARKS)]!,
          j = i % SPARKS,
          blow = Math.floor(s / BLOW),
          q = (s / BLOW) % 1,
          turn = j * 2.1 + blow * 1.3 + a.k,
          far = (0.6 + 0.5 * ((j * 7 + blow) % 3)) * q * 2.4,
          size = 0.28 * (1 - q) + 0.05;
        out[0] = (a.x + Math.cos(turn) * far) * M;
        out[1] = (2.6 + q * 3.2 - q * q * 4.4) * M;
        out[2] = (a.z + Math.sin(turn) * far) * M;
        out[3] = out[4] = out[5] = size * M;
        out[6] = turn;
      });
    }
  }

  destroy(): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.root.destroy();
  }
}
