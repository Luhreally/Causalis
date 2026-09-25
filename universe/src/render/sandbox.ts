// Draws a SandboxSpec: a ground disc, a tile per cell, water over flooded cells,
// a selection ring, and one instanced crowd per class.
import * as pc from "playcanvas";
import { CELL_RADIUS, RING_RADIUS, type SandboxSpec } from "../view/index.ts";
import { InstancedBatch, capsuleMesh, cylinderMesh } from "./batch.ts";
import { flatMaterial, type DeviceTier, type Stage } from "./stage.ts";

type Tile = {
  entity: pc.Entity;
  material: pc.StandardMaterial;
  water: pc.Entity;
  waterMaterial: pc.StandardMaterial;
  color: string;
};

export class SandboxScene {
  private readonly stage: Stage;
  private readonly tiles: Tile[] = [];
  private readonly crowds: InstancedBatch[] = [];
  private readonly ring: pc.Entity;
  private readonly tier: DeviceTier;
  private readonly tile: pc.Mesh;
  private readonly figure: pc.Mesh;

  constructor(stage: Stage, tier: DeviceTier) {
    this.stage = stage;
    this.tier = tier;
    this.tile = cylinderMesh(stage, CELL_RADIUS, 0.3, 6);
    this.figure = capsuleMesh(stage, 0.07, 0.34);
    const ground = new pc.Entity("ground");
    ground.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          cylinderMesh(stage, RING_RADIUS + CELL_RADIUS * 2.2, 0.2, 64),
          flatMaterial([0.17, 0.2, 0.24]),
        ),
      ],
    });
    ground.setLocalPosition(0, -0.25, 0);
    stage.root.addChild(ground);
    this.ring = new pc.Entity("selection");
    this.ring.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          cylinderMesh(stage, CELL_RADIUS * 1.12, 0.05, 32),
          flatMaterial([1, 1, 1], 0.55),
        ),
      ],
    });
    this.ring.enabled = false;
    stage.root.addChild(this.ring);
  }

  private ensureTiles(n: number): void {
    while (this.tiles.length < n) {
      const material = flatMaterial([0.5, 0.5, 0.5]),
        entity = new pc.Entity("cell");
      entity.addComponent("render", { meshInstances: [new pc.MeshInstance(this.tile, material)] });
      this.stage.root.addChild(entity);
      const waterMaterial = flatMaterial([0.3, 0.55, 0.9], 0.6),
        water = new pc.Entity("water");
      water.addComponent("render", {
        meshInstances: [new pc.MeshInstance(this.tile, waterMaterial)],
      });
      water.enabled = false;
      this.stage.root.addChild(water);
      this.tiles.push({ entity, material, water, waterMaterial, color: "" });
    }
  }

  apply(spec: SandboxSpec): void {
    this.ensureTiles(spec.cells.length);
    for (const cell of spec.cells) {
      const tile = this.tiles[cell.index]!,
        key = cell.color.map((v) => v.toFixed(3)).join(",");
      tile.entity.setLocalPosition(cell.x, 0, cell.z);
      if (key !== tile.color) {
        tile.material.diffuse.set(cell.color[0], cell.color[1], cell.color[2]);
        tile.material.update();
        tile.color = key;
      }
      tile.water.enabled = cell.flood > 0;
      if (cell.flood > 0) {
        tile.water.setLocalPosition(cell.x, 0.2, cell.z);
        tile.water.setLocalScale(1.05, 0.2 + cell.flood, 1.05);
        tile.waterMaterial.opacity = 0.15 + 0.5 * cell.flood;
        tile.waterMaterial.update();
      }
    }
    while (this.crowds.length < spec.crowds.length) {
      const crowd = spec.crowds[this.crowds.length]!;
      this.crowds.push(
        new InstancedBatch(
          this.stage,
          this.figure,
          crowd.color,
          spec.cells.length * this.tier.crowdCap,
        ),
      );
    }
    spec.crowds.forEach((crowd, k) => {
      const p = crowd.positions;
      this.crowds[k]!.set(p.length / 2, (i, out) => {
        out[0] = p[i * 2]!;
        out[1] = 0.33;
        out[2] = p[i * 2 + 1]!;
        out[3] = out[4] = out[5] = 1;
        out[6] = i;
      });
    });
  }

  select(cell: { x: number; z: number } | null): void {
    this.ring.enabled = cell !== null;
    if (cell) this.ring.setLocalPosition(cell.x, 0.02, cell.z);
  }

  /** Figures currently drawn (for the HUD and tests). */
  figures(): number {
    return this.crowds.reduce((s, c) => s + c.size, 0);
  }
}
