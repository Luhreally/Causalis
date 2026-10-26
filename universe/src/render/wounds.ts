// Wounds worn by a town's people (Phase 55 M226; asked for 2026-10-26: "Wounds and lost limbs shown
// on the person and told on their page"): the linen bound about a wound as each part is posed, an
// arm's cradle and its strap, a crutch under the arm, a patch and its strap over an eye, a scar on
// the face — so many of each, the nearest the eye first. The figure itself is cut short where a
// member is lost, and held as a wound holds it (render/village.ts). Units as the village's: a tenth
// of a unit to the metre.
import * as pc from "playcanvas";
import { BANDAGE_WIDE, WOUND_COLORS, type WoundBound, type WoundProp } from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";

/** The worn pieces drawn at most, by kind (a patch's strap among the patches). */
export const WOUND_MOST = { bandage: 160, patch: 48, sling: 48, crutch: 48, scar: 64 } as const;
export type WornKind = keyof typeof WOUND_MOST;
const KINDS: readonly WornKind[] = ["bandage", "patch", "sling", "crutch", "scar"];

/** A piece worn now: its kind, its placing ([x, y, z, sx, sy, sz, yaw, pitch], the village's units), and how far it is from the eye (squared). */
export type WornPiece = {
  readonly kind: WornKind;
  readonly m: readonly number[];
  readonly d2: number;
};

/** Of a limb kept from its hinge (`keep` of its length `len`): how far its middle comes up toward the hinge. */
export function stumpAlong(len: number, keep: number): number {
  return ((1 - keep) * len) / 2;
}

/**
 * A bandage about a part as it is placed now (`at`: the part's placing as render/village.ts's
 * place writes it; `ext`: its whole extent in the village's units; `keep`: how much of it is
 * left): so far along what is left of it from its middle toward its hinge, so long, a little
 * wider than it, turned and tipped with it.
 */
export function bandageOn(
  at: readonly number[],
  ext: readonly [number, number, number],
  keep: number,
  b: WoundBound,
): number[] {
  const yaw = at[6]!,
    pitch = at[7]!,
    len = ext[1] * keep,
    off = b.along * len,
    sp = Math.sin(pitch);
  return [
    at[0]! + off * sp * Math.sin(yaw),
    at[1]! + off * Math.cos(pitch),
    at[2]! + off * sp * Math.cos(yaw),
    ext[0] * BANDAGE_WIDE,
    len * b.long,
    ext[2] * BANDAGE_WIDE,
    yaw,
    pitch,
  ];
}

/**
 * A thing worn, rigid on one who stands at (x, z) metres facing `yaw`: placed as their figure is
 * (`size` its scale, `bob` the lift of their stride, in the figure's units; `M` the units to the
 * metre).
 */
export function propAt(
  x: number,
  z: number,
  yaw: number,
  size: number,
  bob: number,
  q: WoundProp,
  M: number,
): number[] {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [
    x * M + (q.x * c + q.z * s) * size,
    (q.y + bob) * size,
    z * M + (-q.x * s + q.z * c) * size,
    q.sx * size,
    q.sy * size,
    q.sz * size,
    yaw + q.yaw,
    q.pitch,
  ];
}

/** The pieces a town's wounded wear, drawn by kind. */
export class WoundsLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("wounds");
  private readonly batches: Record<WornKind, InstancedBatch>;
  /** How many of each were drawn last (the look tools). */
  readonly shown: Record<WornKind, number> = {
    bandage: 0,
    patch: 0,
    sling: 0,
    crutch: 0,
    scar: 0,
  };

  constructor(stage: Stage, parent: pc.Entity) {
    parent.addChild(this.root);
    // (Held: one mesh for every batch, kept while the village is laid out again.)
    const box = keptMesh(boxMesh(stage)),
      make = (kind: WornKind) =>
        new InstancedBatch(stage, box, WOUND_COLORS[kind], WOUND_MOST[kind], this.root);
    this.batches = {
      bandage: make("bandage"),
      patch: make("patch"),
      sling: make("sling"),
      crutch: make("crutch"),
      scar: make("scar"),
    };
  }

  /** Draw what is worn now: of each kind, the nearest the eye first, at most so many. */
  update(pieces: readonly WornPiece[]): void {
    for (const kind of KINDS) {
      const mine = pieces.filter((p) => p.kind === kind).sort((a, b) => a.d2 - b.d2),
        n = Math.min(mine.length, WOUND_MOST[kind]);
      this.batches[kind].set(n, (i, out) => {
        const m = mine[i]!.m;
        for (let k = 0; k < 8; k++) out[k] = m[k]!;
      });
      this.shown[kind] = n;
    }
  }
}
