// The god's acts drawn near (Phase 30 M163): motes over the land about the eye — a blessed
// harvest's gold, a blight's dust, a plague's pall, healing's glints, a curse's wisps — an
// inspiration's light standing over the land's middle, a town's flames and smoke, a stone
// falling from the sky and the smoke where it struck. Sized by the eye's distance, as the
// weather is, so they read the same among a band, in a town and over a land.
import * as pc from "playcanvas";
import type { ActsNear, NearMote } from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

/** The most of each kind drawn at once. */
const MOST = 700;
type P = { readonly x: number; readonly y: number; readonly z: number };

/** Each mote's look: its colour, how much it is seen through, its size (a share of the eye's distance). */
const MOTE_LOOK: Record<NearMote, { color: Rgb; opacity: number; size: number; flat: number }> = {
  gold: { color: [1, 0.84, 0.26], opacity: 1, size: 0.0042, flat: 1 },
  dust: { color: [0.55, 0.45, 0.3], opacity: 0.75, size: 0.007, flat: 0.5 },
  pall: { color: [0.6, 0.72, 0.22], opacity: 0.32, size: 0.045, flat: 0.45 },
  glint: { color: [1, 1, 0.94], opacity: 1, size: 0.0032, flat: 1 },
  wisp: { color: [0.36, 0.12, 0.46], opacity: 0.5, size: 0.03, flat: 0.5 },
};
const MOTE_KINDS = Object.keys(MOTE_LOOK) as NearMote[];

/** Seen by its own light, so a mote or a flame reads by night. */
function glowing(color: Rgb, opacity: number, glow: number): pc.StandardMaterial {
  const m = flatMaterial(color, opacity);
  m.emissive = new pc.Color(color[0] * glow, color[1] * glow, color[2] * glow);
  m.update();
  return m;
}

/** A number in [0, 1) of its own for a mote and a draw. */
function rand(i: number, n: number, k: number): number {
  let h = (Math.imul(i ^ 0x1b873593, 0x85ebca6b) ^ Math.imul(n + k * 0x27d4eb2d, 0xcc9e2d51)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

export class ActsNearLayer {
  readonly root = new pc.Entity("acts-near");
  private readonly motes: Record<NearMote, InstancedBatch>;
  private readonly flames: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly light: InstancedBatch;
  private readonly looks: pc.Material[] = [];
  /** What was drawn last (the look tools). */
  shown = { motes: 0, flames: 0, smoke: 0, light: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    const box = keptMesh(boxMesh(stage)),
      batch = (color: Rgb, look: pc.Material) => {
        this.looks.push(look);
        return new InstancedBatch(stage, box, color, MOST, this.root, look);
      };
    this.motes = Object.fromEntries(
      MOTE_KINDS.map((k) => {
        const l = MOTE_LOOK[k];
        return [k, batch(l.color, glowing(l.color, l.opacity, 0.55))];
      }),
    ) as Record<NearMote, InstancedBatch>;
    this.flames = batch([1, 0.5, 0.1], glowing([1, 0.5, 0.1], 0.95, 0.9));
    this.smoke = batch([0.34, 0.32, 0.33], glowing([0.34, 0.32, 0.33], 0.55, 0.1));
    this.light = batch([1, 0.94, 0.62], glowing([1, 0.94, 0.62], 0.45, 1));
    parent.addChild(this.root);
  }

  /** Its looks, for the stage to ready their shaders before they are wanted. */
  materials(): { material: pc.Material; instanced: boolean }[] {
    return this.looks.map((material) => ({ material, instanced: true }));
  }

  /**
   * The acts about a point the eye looks at from `distance` away (the eye at `eye`), at `s`
   * seconds of the viewer's time (held while the clock is). `middle`: the land's middle (an
   * inspiration's light, a stone's fall), or null; `townAt`: where a town afire is, if seen.
   */
  update(
    acts: ActsNear | null,
    at: P,
    eye: P,
    middle: P | null,
    townAt: (ref: string) => (P & { r: number }) | null,
    distance: number,
    s: number,
    most: number,
  ): void {
    const d = Math.max(0.5, distance),
      reach = d * 0.95,
      clear = (d * 0.35) ** 2,
      near = (x: number, y: number, z: number) =>
        (x - eye.x) ** 2 + (y - eye.y) ** 2 + (z - eye.z) ** 2 < clear;
    let motes = 0;
    for (const kind of MOTE_KINDS) {
      const m = acts?.motes.find((x) => x.kind === kind),
        look = MOTE_LOOK[kind],
        n = m ? Math.round(Math.min(MOST, most) * m.strength * (kind === "pall" ? 0.25 : 0.6)) : 0;
      motes += n;
      this.motes[kind].set(n, (i, out) => {
        // (Each mote rises or settles through its band and comes round again, drifting as it goes.)
        const band = m!.low ? d * 0.12 : d * 0.6,
          speed = Math.abs(m!.rise) * d || d * 0.01,
          go = (s * speed) / band + rand(i, 0, 1),
          lap = Math.floor(go),
          f = go - lap,
          a = rand(i, lap, 2) * Math.PI * 2,
          r = reach * Math.sqrt(rand(i, lap, 3)),
          drift = Math.sin(s * 0.7 + rand(i, 0, 4) * 6.28) * d * 0.015,
          x = at.x + Math.cos(a) * r + drift,
          y = at.y + (m!.rise >= 0 ? f : 1 - f) * band,
          z = at.z + Math.sin(a) * r - drift * 0.5,
          k = near(x, y, z) ? 0 : d * look.size * (0.7 + 0.6 * rand(i, 0, 5));
        out[0] = x;
        out[1] = y;
        out[2] = z;
        out[3] = k;
        out[4] = k * look.flat;
        out[5] = k;
        out[6] = s * 0.4 + i;
        out[7] = 0;
      });
    }
    // A town afire: flames among its homes, smoke going up off it.
    const burning = (acts?.fires ?? []).flatMap((f) => {
      const p = townAt(f.town);
      return p ? [{ ...p, strength: f.strength }] : [];
    });
    const flames: number[][] = [],
      smoke: number[][] = [];
    for (const [j, b] of burning.entries()) {
      const nFlames = Math.round(60 * b.strength),
        nSmoke = Math.round(40 * b.strength),
        size = Math.max(b.r * 0.06, d * 0.006);
      for (let i = 0; i < nFlames; i++) {
        const a = rand(i, j, 6) * Math.PI * 2,
          r = b.r * 0.7 * Math.sqrt(rand(i, j, 7)),
          flick = 0.6 + 0.4 * Math.sin(s * 9 + i * 1.7),
          tall = size * (1.2 + 1.6 * rand(i, j, 8)) * flick;
        flames.push([
          b.x + Math.cos(a) * r,
          b.y + tall / 2,
          b.z + Math.sin(a) * r,
          size * 0.7,
          tall,
          size * 0.7,
          s * 2 + i,
          0,
        ]);
      }
      for (let i = 0; i < nSmoke; i++) {
        const go = s * 0.18 + rand(i, j, 9),
          f = go - Math.floor(go),
          a = rand(i, j, 10) * Math.PI * 2,
          r = b.r * 0.5 * Math.sqrt(rand(i, j, 11)) + f * b.r * 0.6,
          puff = size * (1.5 + 3 * f);
        smoke.push([
          b.x + Math.cos(a) * r + f * size * 6,
          b.y + size * 2 + f * b.r * 3,
          b.z + Math.sin(a) * r,
          puff,
          puff,
          puff,
          s * 0.3 + i,
          0,
        ]);
      }
    }
    // A stone from the sky: its streak as it falls, the smoke where it struck.
    const st = acts?.strike;
    if (st && middle) {
      if (st.fall < 1) {
        const from = { x: middle.x - d * 0.35, y: middle.y + d * 1.3, z: middle.z + d * 0.25 },
          x = from.x + (middle.x - from.x) * st.fall,
          y = from.y + (middle.y - from.y) * st.fall,
          z = from.z + (middle.z - from.z) * st.fall;
        flames.push([x, y, z, d * 0.012, d * 0.012, d * 0.012, s * 5, 0]);
        for (let i = 1; i < 8; i++)
          smoke.push([
            x - (middle.x - from.x) * 0.02 * i,
            y - (middle.y - from.y) * 0.02 * i,
            z - (middle.z - from.z) * 0.02 * i,
            d * 0.01 * (1 + i * 0.3),
            d * 0.01 * (1 + i * 0.3),
            d * 0.01 * (1 + i * 0.3),
            i,
            0,
          ]);
      }
      if (st.smoke > 0)
        for (let i = 0; i < Math.round(36 * st.smoke); i++) {
          const go = s * 0.25 + rand(i, 99, 12),
            f = go - Math.floor(go),
            puff = d * (0.01 + 0.03 * f) * st.smoke;
          smoke.push([
            middle.x + (rand(i, 99, 13) - 0.5) * d * 0.04 + f * d * 0.05,
            middle.y + f * d * 0.35,
            middle.z + (rand(i, 99, 14) - 0.5) * d * 0.04,
            puff,
            puff,
            puff,
            s * 0.2 + i,
            0,
          ]);
        }
    }
    const put = (b: InstancedBatch, list: number[][]) =>
      b.set(list.length, (i, out) => {
        for (let k = 0; k < 8; k++) out[k] = list[i]![k]!;
      });
    put(this.flames, flames);
    put(this.smoke, smoke);
    // An inspiration's light standing over the land's middle.
    const pillar = acts?.pillar ?? 0;
    this.light.set(pillar > 0 && middle ? 1 : 0, (_, out) => {
      const w = d * 0.03 * (0.6 + 0.4 * Math.sin(s * 2.2)) * pillar;
      out[0] = middle!.x;
      out[1] = middle!.y + d * 0.45;
      out[2] = middle!.z;
      out[3] = w;
      out[4] = d * 0.9;
      out[5] = w;
      out[6] = s * 0.5;
      out[7] = 0;
    });
    this.shown = {
      motes,
      flames: flames.length,
      smoke: smoke.length,
      light: pillar > 0 && middle ? 1 : 0,
    };
  }
}
