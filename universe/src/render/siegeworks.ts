// A siege's works drawn about a town (view/siegeworks.ts): the besiegers' bank of earth, their approaches dug toward the
// walls, what they throw with, and the walls' rubble where they are open. Four instanced batches, set only when the works
// change (a siege moves once a year): nothing is written while a town stands under it.
import type * as pc from "playcanvas";
import { SIEGE_WORKS, type SiegeWorks } from "../view/index.ts";
import { InstancedBatch, boxMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1;
const EARTH: Rgb = [0.36, 0.29, 0.2],
  DUG: Rgb = [0.2, 0.16, 0.12],
  TIMBER: Rgb = [0.3, 0.22, 0.14],
  IRON: Rgb = [0.17, 0.18, 0.2],
  STONE: Rgb = [0.5, 0.48, 0.44];
/** The boxes an engine is drawn of: its frame's two sides, its beam, its arm; a gun's trail, barrel and two wheels. */
const PARTS = 4;

export class SiegeWorksLayer {
  private readonly banks: InstancedBatch;
  private readonly saps: InstancedBatch;
  private readonly engines: InstancedBatch;
  private readonly rubble: InstancedBatch;
  private drawn: SiegeWorks | null = null;
  private key = "";
  private body = 1;
  /** What was last drawn (the look tools). */
  shown = { banks: 0, saps: 0, engines: 0, rubble: 0 };

  constructor(stage: Stage, root: pc.Entity) {
    const box = boxMesh(stage),
      W = SIEGE_WORKS;
    this.banks = new InstancedBatch(stage, box, EARTH, W.banks, root);
    this.saps = new InstancedBatch(stage, box, DUG, W.saps, root);
    this.engines = new InstancedBatch(stage, box, TIMBER, W.engines * PARTS, root);
    this.rubble = new InstancedBatch(stage, box, STONE, W.rubble, root);
  }

  /** The works now (null: none), `body` times a man's size: what its folk dug and built for their own bodies. */
  update(works: SiegeWorks | null, body = 1): void {
    if (works === this.drawn && body === this.body) return;
    this.drawn = works;
    this.body = body;
    // (The scene is made anew each frame: drawn again only when what it says has changed.)
    const s = works?.state,
      key = works
        ? `${works.banks.length} ${works.banks[0]?.x} ${works.saps.length} ${works.rubble.length} ${works.guns} ${s!.breach} ${s!.years} ${body}`
        : "";
    if (key === this.key) return;
    this.key = key;
    const banks = works?.banks ?? [],
      saps = works?.saps ?? [],
      engines = works?.engines ?? [],
      rubble = works?.rubble ?? [];
    this.shown = {
      banks: banks.length,
      saps: saps.length,
      engines: engines.length,
      rubble: rubble.length,
    };
    this.banks.set(banks.length, (i, o) => {
      const b = banks[i]!;
      o[0] = b.x * M;
      o[1] = 0.07 * body;
      o[2] = b.z * M;
      o[3] = 2.6 * body * M;
      o[4] = 0.14 * body;
      o[5] = b.long * M;
      o[6] = b.yaw;
    });
    this.saps.set(saps.length, (i, o) => {
      const b = saps[i]!;
      o[0] = b.x * M;
      o[1] = 0.012;
      o[2] = b.z * M;
      o[3] = 1.5 * body * M;
      o[4] = 0.024 * body;
      o[5] = b.long * M;
      o[6] = b.yaw;
    });
    const guns = !!works?.guns;
    this.engines.recolor(guns ? IRON : TIMBER);
    this.engines.set(engines.length * PARTS, (k, o) => {
      const e = engines[(k / PARTS) | 0]!,
        part = k % PARTS,
        c = Math.cos(e.yaw),
        sn = Math.sin(e.yaw),
        // (Across it, up, along it, in metres; then its size; then its tip.)
        at = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, tip = 0) => {
          const u = body * M;
          o[0] = e.x * M + (dx * c + dz * sn) * u;
          o[1] = dy * u;
          o[2] = e.z * M + (-dx * sn + dz * c) * u;
          o[3] = sx * u;
          o[4] = sy * u;
          o[5] = sz * u;
          o[6] = e.yaw;
          o[7] = tip;
        };
      if (guns) {
        // A gun on its carriage: its trail, its barrel laid up at the walls, a wheel a side.
        if (part === 0) at(0, 0.5, -0.8, 0.5, 0.3, 2.4);
        else if (part === 1) at(0, 1.0, 0.7, 0.42, 0.42, 2.6, -0.2);
        else at(part === 2 ? -0.75 : 0.75, 0.65, 0.2, 0.22, 1.3, 1.3);
      } else {
        // An engine: its frame's two sides, the beam across them, its arm thrown up.
        if (part === 0) at(-1.1, 1.5, 0, 0.3, 3, 3.4);
        else if (part === 1) at(1.1, 1.5, 0, 0.3, 3, 3.4);
        else if (part === 2) at(0, 3, 0, 2.5, 0.3, 0.3);
        else at(0, 3.6, -0.6, 0.26, 0.26, 6.4, -0.75);
      }
    });
    this.rubble.set(rubble.length, (i, o) => {
      const b = rubble[i]!;
      o[0] = b.x * M;
      o[1] = b.size * 0.3 * M;
      o[2] = b.z * M;
      o[3] = b.size * 1.5 * M;
      o[4] = b.size * 0.6 * M;
      o[5] = b.size * M;
      o[6] = b.yaw;
    });
  }

  destroy(): void {
    for (const b of [this.banks, this.saps, this.engines, this.rubble]) b.destroy();
  }
}
