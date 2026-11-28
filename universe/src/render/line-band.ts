// What a hand leading a band sees besides the band (Live a Line's tribe, S6, 2026-11-28): the spot it looks at (a ring on
// the ground, where the band is sent), the cold hearths of the camps it left (where it dropped seed), and the wild grain
// come up on one of them. Our own simple look, laid in the meadow's frame (render/meadow.ts: 0.1 units a metre), all of it
// on the ground (y 0), none on water: the band camps on dry ground only (view/band.ts campGround).
import * as pc from "playcanvas";
import { InstancedBatch, ballMesh, cylinderMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";

const M = 0.1,
  RING = 16,
  STONES = 7,
  HEARTHS = 8,
  STALKS = 120;

export type BandMarks = {
  /** Where the hand looks (m), and whether an order can go there. */
  readonly look: { x: number; z: number; can: boolean };
  /** The camps left behind (m). */
  readonly hearths: readonly { x: number; z: number }[];
  /** Where the grain came up (m), or null. */
  readonly sprouted: { x: number; z: number } | null;
  /** Ground the band has put things on (m): its shelters, fire, work ground and frame, each with its room. */
  readonly clear: readonly { x: number; z: number; r: number }[];
  /** The meadow's clock (s): the ring turns, the grain sways. */
  readonly t: number;
};

export class LineBandMarks {
  private readonly ring: InstancedBatch;
  private readonly ringOff: InstancedBatch;
  private readonly stones: InstancedBatch;
  private readonly stalks: InstancedBatch;
  private readonly heads: InstancedBatch;

  constructor(stage: Stage, parent: pc.Entity) {
    const ball = ballMesh(stage, 0.5, 6),
      rod = cylinderMesh(stage, 0.5, 1, 5);
    this.ring = new InstancedBatch(stage, ball, [1, 0.86, 0.32], RING, parent);
    this.ringOff = new InstancedBatch(stage, ball, [0.62, 0.62, 0.66], RING, parent);
    this.stones = new InstancedBatch(stage, ball, [0.3, 0.28, 0.26], STONES * HEARTHS, parent);
    this.stalks = new InstancedBatch(stage, rod, [0.56, 0.66, 0.26], STALKS, parent);
    this.heads = new InstancedBatch(stage, ball, [0.86, 0.74, 0.34], STALKS, parent);
  }

  update(d: BandMarks): void {
    // The spot looked at: a ring of beads on the ground, turning; grey where no order can go.
    const r = 2.4 * M,
      bead = 0.35 * M,
      lay = (i: number, out: number[]) => {
        const a = (i / RING) * Math.PI * 2 + d.t * 0.6;
        out[0] = d.look.x * M + Math.cos(a) * r;
        out[1] = bead * 0.5;
        out[2] = d.look.z * M + Math.sin(a) * r;
        out[3] = out[4] = out[5] = bead;
      };
    this.ring.set(d.look.can ? RING : 0, lay);
    this.ringOff.set(d.look.can ? 0 : RING, lay);
    // A cold hearth at each camp left: a ring of fire-blackened stones, half sunk in the ground.
    const hearths = d.hearths
        .filter((h) => !d.clear.some((c) => Math.hypot(c.x - h.x, c.z - h.z) < c.r))
        .slice(-HEARTHS),
      stone = 0.6 * M;
    this.stones.set(hearths.length * STONES, (i, out) => {
      const h = hearths[Math.floor(i / STONES)]!,
        a = ((i % STONES) / STONES) * Math.PI * 2;
      out[0] = h.x * M + Math.cos(a) * 1.1 * M;
      out[1] = stone * 0.25;
      out[2] = h.z * M + Math.sin(a) * 1.1 * M;
      out[3] = out[5] = stone;
      out[4] = stone * 0.6;
    });
    // The wild grain come up: stalks standing from the ground about the old hearth, each with its head, swaying; none where
    // the band has put up a shelter, its fire or its work ground (one thing on a piece of ground: the grain gives way).
    const s = d.sprouted,
      tall = 1.3 * M,
      stalks: { x: number; z: number; a: number; lean: number }[] = [];
    // (Camped on the old ground again: the grain a fringe about the camp, from its edge out.)
    const inner = s
      ? Math.max(
          1.6,
          ...d.clear.filter((c) => Math.hypot(c.x - s.x, c.z - s.z) < 2).map((c) => c.r),
        )
      : 0;
    if (s)
      for (let i = 0; i < STALKS; i++) {
        const a = i * 2.39996,
          rr = inner + 4.4 * Math.sqrt((i + 0.5) / STALKS),
          x = s.x + Math.cos(a) * rr,
          z = s.z + Math.sin(a) * rr;
        if (d.clear.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) continue;
        stalks.push({ x, z, a, lean: 0.12 * Math.sin(d.t * 1.3 + i) });
      }
    this.stalks.set(stalks.length, (i, out) => {
      const k = stalks[i]!;
      out[0] = k.x * M;
      out[1] = tall / 2;
      out[2] = k.z * M;
      out[3] = out[5] = 0.12 * M;
      out[4] = tall;
      out[6] = k.a;
      out[7] = k.lean;
    });
    this.heads.set(stalks.length, (i, out) => {
      const k = stalks[i]!;
      out[0] = k.x * M + Math.sin(k.lean) * tall * Math.cos(k.a) * 0.5;
      out[1] = tall * Math.cos(k.lean);
      out[2] = k.z * M + Math.sin(k.lean) * tall * Math.sin(k.a) * 0.5;
      out[3] = out[5] = 0.32 * M;
      out[4] = 0.55 * M;
      out[6] = 0;
    });
  }
}
