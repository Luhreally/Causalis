// The levy's wounded borne home on litters (Phase 55 M229; asked for 2026-10-26: "Healers tending
// the wounded"): two poles and a canvas slung between them, borne at their bearers' hands between
// them — or set down, at the road's end as the column comes and at the door a while — the wounded on
// it under a blanket, hooded head to the front. In scene metres to match the folk, who are drawn
// about three times life (as the biers are: render/graveyard.ts).
import * as pc from "playcanvas";
import { MOST_LITTERS, partExtent, type Figure, type LitterNow } from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

/** Render units to the metre (the village's). */
const M = 0.1;
/** A litter's parts (metres): its canvas, its poles, the blanket over the one on it, their hooded head; how high its canvas rests set down. */
export const LITTER = {
  canvas: [1.8, 0.2, 5.0],
  pole: { long: 7.6, thick: 0.2 },
  blanket: [1.4, 0.6, 4.2],
  head: 0.9,
  rest: 0.3,
} as const;
const WOOD: Rgb = [0.45, 0.31, 0.19],
  CANVAS: Rgb = [0.78, 0.72, 0.58],
  BLANKET: Rgb = [0.42, 0.36, 0.3];

export type LitterPart = "canvas" | "pole" | "blanket" | "hood";
/** A piece of a litter: its part and its placing ([x, y, z, sx, sy, sz, yaw, pitch], render units). */
export type LitterPiece = { readonly part: LitterPart; readonly m: readonly number[] };

/** How high a litter's canvas is held (metres): at its bearers' hands, their arms hanging. */
export function litterHeld(figure: Figure): number {
  let low = Infinity;
  for (const p of figure.parts)
    if (p.role === "arm") low = Math.min(low, p.y - partExtent(p)[1] / 2);
  return Number.isFinite(low) ? (low * figure.scale) / M : 1.0;
}

/** How far apart a litter's poles are (metres): at its bearers' hands, either side of them. */
export function litterApart(figure: Figure): number {
  let x = 0;
  for (const p of figure.parts) if (p.role === "arm") x = Math.max(x, Math.abs(p.x));
  return x > 0 ? (2 * x * figure.scale) / M : 2.1;
}

/** A litter's pieces where it is now: borne, its canvas at `held` metres (else set down), its poles `apart` metres from each other. */
export function litterPieces(l: LitterNow, held: number, apart: number): LitterPiece[] {
  const y = l.borne ? held : LITTER.rest,
    s = Math.sin(l.face),
    c = Math.cos(l.face),
    // (So far along it toward its head, across it to its right, and up.)
    at = (
      part: LitterPart,
      along: number,
      across: number,
      up: number,
      w: number,
      h: number,
      d: number,
    ): LitterPiece => ({
      part,
      m: [
        (l.x + s * along + c * across) * M,
        up * M,
        (l.z + c * along - s * across) * M,
        w * M,
        h * M,
        d * M,
        l.face,
        0,
      ],
    }),
    top = y + LITTER.canvas[1] / 2,
    [cw, ch, cd] = LITTER.canvas,
    [bw, bh, bd] = LITTER.blanket,
    { long, thick } = LITTER.pole;
  return [
    at("canvas", 0, 0, y, cw, ch, cd),
    at("pole", 0, -apart / 2, y + 0.05, thick, thick, long),
    at("pole", 0, apart / 2, y + 0.05, thick, thick, long),
    at("blanket", -0.35, 0, top + bh / 2, bw, bh, bd),
    at(
      "hood",
      cd / 2 - LITTER.head / 2 - 0.1,
      0,
      top + LITTER.head / 2,
      LITTER.head,
      LITTER.head,
      LITTER.head,
    ),
  ];
}

/** The litters borne home now, drawn by part (at most MOST_LITTERS). */
export class LittersLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("litters");
  private readonly batches: Record<LitterPart, InstancedBatch>;
  /** How many were drawn last, and of them borne (the look tools). */
  shown = { litters: 0, borne: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    parent.addChild(this.root);
    const box = keptMesh(boxMesh(stage)),
      make = (color: Rgb, n: number) => new InstancedBatch(stage, box, color, n, this.root);
    this.batches = {
      canvas: make(CANVAS, MOST_LITTERS),
      pole: make(WOOD, MOST_LITTERS * 2),
      blanket: make(BLANKET, MOST_LITTERS),
      hood: make(BLANKET, MOST_LITTERS),
    };
  }

  /** Draw the litters now. */
  update(litters: readonly LitterNow[], held: number, apart: number): void {
    const drawn = litters.slice(0, MOST_LITTERS),
      pieces = drawn.flatMap((l) => litterPieces(l, held, apart));
    for (const part of ["canvas", "pole", "blanket", "hood"] as const) {
      const mine = pieces.filter((p) => p.part === part);
      this.batches[part].set(mine.length, (i, out) => {
        const m = mine[i]!.m;
        for (let k = 0; k < 8; k++) out[k] = m[k]!;
      });
    }
    this.shown = { litters: drawn.length, borne: drawn.filter((l) => l.borne).length };
  }
}
