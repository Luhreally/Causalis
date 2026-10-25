// A town's war drawn about it (Phase 40 M204): the besiegers' tents ringing it and their camp's
// fires, and its houses burning when it is stormed — flames and the smoke over them. Its soldiers
// are the village's own figures in their sides' colours (render/village.ts). Units as the
// village's: a tenth of a unit to the metre; tents and flames sized to its folk, drawn three times
// a person's size.
import * as pc from "playcanvas";
import { InstancedBatch, boxMesh, coneMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import type { TownWarScene } from "../view/index.ts";

const M = 0.1;
/** The most tents, camp fires, burning houses (each its flames and its smoke's puffs). */
const MOST_TENTS = 16,
  MOST_FIRES = 16,
  FLAMES = 3,
  PUFFS = 5;
const CANVAS: Rgb = [0.86, 0.8, 0.64],
  SMOKE: Rgb = [0.3, 0.29, 0.28];

export class TownWarLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("town-war");
  private readonly tents: InstancedBatch;
  private readonly campFires: InstancedBatch;
  private readonly flames: InstancedBatch;
  private readonly smoke: InstancedBatch;
  /** What was last drawn (the look tools). */
  shown = { tents: 0, fires: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    parent.addChild(this.root);
    const root = this.root,
      fire = new pc.StandardMaterial();
    fire.useLighting = false;
    fire.diffuse = new pc.Color(0, 0, 0);
    fire.emissive = new pc.Color(1, 0.5, 0.12);
    fire.update();
    const cone = coneMesh(stage, 0.5, 1, 6);
    this.tents = new InstancedBatch(stage, coneMesh(stage, 0.5, 1, 4), CANVAS, MOST_TENTS, root);
    this.campFires = new InstancedBatch(stage, cone, [1, 0.5, 0.12], MOST_TENTS, root, fire);
    this.flames = new InstancedBatch(stage, cone, [1, 0.5, 0.12], MOST_FIRES * FLAMES, root, fire);
    this.smoke = new InstancedBatch(
      stage,
      boxMesh(stage),
      SMOKE,
      MOST_FIRES * PUFFS,
      root,
      flatMaterial(SMOKE, 0.55),
    );
  }

  /** The war about the town now (null: none), its flames and smoke moving by the screen's clock `s`. */
  update(scene: TownWarScene | null, s: number): void {
    const tents = scene?.tents ?? [],
      fires = scene?.fires ?? [],
      nt = Math.min(MOST_TENTS, tents.length),
      nf = Math.min(MOST_FIRES, fires.length);
    this.shown = { tents: nt, fires: nf };
    this.tents.set(nt, (i, out) => {
      const t = tents[i]!;
      out[0] = t.x * M;
      out[1] = 0.32;
      out[2] = t.z * M;
      out[3] = 0.95;
      out[4] = 0.64;
      out[5] = 0.95;
      out[6] = t.yaw + Math.PI / 4;
    });
    // (A fire before every third tent.)
    const camp = Math.ceil(nt / 3);
    this.campFires.set(camp, (j, out) => {
      const t = tents[j * 3]!,
        a = Math.atan2(t.z, t.x),
        flick = 0.85 + 0.15 * Math.sin(s * 9 + j * 2.1);
      out[0] = (t.x - Math.cos(a) * 9) * M;
      out[1] = 0.1 * flick;
      out[2] = (t.z - Math.sin(a) * 9) * M;
      out[3] = 0.16;
      out[4] = 0.22 * flick;
      out[5] = 0.16;
      out[6] = s * 2 + j;
    });
    // Its houses alight: tongues of flame leaping, and their smoke rolling up and away.
    this.flames.set(nf * FLAMES, (n, out) => {
      const f = fires[Math.floor(n / FLAMES)]!,
        k = n % FLAMES,
        a = k * 2.1 + n * 0.7,
        flick = 0.7 + 0.3 * Math.sin(s * (7 + k) + n * 1.9),
        h = (0.55 + 0.45 * f.size) * flick * (k ? 0.75 : 1.1);
      out[0] = f.x * M + Math.cos(a) * 0.12 * k;
      out[1] = h * 0.5;
      out[2] = f.z * M + Math.sin(a) * 0.12 * k;
      out[3] = 0.3 * (0.6 + 0.4 * f.size);
      out[4] = h;
      out[5] = 0.3 * (0.6 + 0.4 * f.size);
      out[6] = s * 3 + n;
    });
    this.smoke.set(nf * PUFFS, (n, out) => {
      const f = fires[Math.floor(n / PUFFS)]!,
        k = n % PUFFS,
        rise = (s * 0.22 + k / PUFFS + n * 0.13) % 1,
        grow = (0.25 + 0.75 * rise) * (0.5 + 0.5 * f.size);
      out[0] = f.x * M + rise * 0.6;
      out[1] = 0.8 + rise * 3.2 * (0.6 + 0.4 * f.size);
      out[2] = f.z * M + rise * 0.25;
      out[3] = 0.5 * grow;
      out[4] = 0.4 * grow;
      out[5] = 0.5 * grow;
      out[6] = n * 0.9 + rise;
    });
  }

  destroy(): void {
    for (const b of [this.tents, this.campFires, this.flames, this.smoke]) b.destroy();
  }
}
