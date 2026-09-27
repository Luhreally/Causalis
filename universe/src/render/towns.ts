// Towns on the globe (Phase 10 M95): what is zoomed into is there before it — each of the
// world's largest towns where its land's map puts it, a cluster of huts as many as it is
// large (the huts the land's map draws it with), a city's tower over them. They grow in as
// the view closes on the globe, and are gone when it draws back.
import * as pc from "playcanvas";
import { nearestCell, type SphereGrid } from "../kernel/index.ts";
import { globeRadius } from "../view/index.ts";
import { InstancedBatch, boxMesh, cylinderMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";

/** A town as the globe shows it: where it stands (a unit direction), how many, a city or not. */
export type GlobeTown = {
  readonly ref: string;
  readonly name: string;
  readonly people: number;
  readonly city: boolean;
  readonly at: readonly [number, number, number];
  readonly color: readonly [number, number, number] | null;
};

/** Beyond this distance (the globe's radius is 1) no town is drawn; nearer than NEAR, all are. */
const FAR = 2.6,
  NEAR = 1.7;

export class GlobeTowns {
  readonly root = new pc.Entity("globe-towns");
  private readonly huts: InstancedBatch;
  private readonly towers: InstancedBatch;
  /** Each town's ground on the globe, and the way up there. */
  private placed: { town: GlobeTown; at: pc.Vec3; up: pc.Vec3 }[] = [];
  private grown = -1;

  constructor(stage: Stage) {
    this.huts = new InstancedBatch(
      stage,
      cylinderMesh(stage, 0.3, 0.42, 4),
      [0.9, 0.76, 0.55],
      2400,
      this.root,
    );
    this.towers = new InstancedBatch(stage, boxMesh(stage), [0.86, 0.84, 0.8], 200, this.root);
    stage.root.addChild(this.root);
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** The towns shown, stood on the globe's ground (its grid and relief). */
  set(towns: readonly GlobeTown[], grid: SphereGrid, elevation: Float32Array): void {
    this.placed = towns.map((town) => {
      const [x, y, z] = town.at,
        cell = nearestCell(grid, x, y, z),
        r = globeRadius(elevation[cell] ?? 0);
      return { town, at: new pc.Vec3(x * r, y * r, z * r), up: new pc.Vec3(x, y, z) };
    });
    this.grown = -1;
  }

  /** The towns as large as the view's nearness has them (`distance`: the camera's from the middle). */
  update(distance: number): void {
    if (!this.root.enabled) return;
    const k = Math.max(0, Math.min(1, (FAR - distance) / (FAR - NEAR)));
    // (Laid again only as they grow or shrink.)
    if (Math.abs(k - this.grown) < 0.02 && !(k === 0 && this.grown !== 0)) return;
    this.grown = k;
    const s = 0.006 * k,
      huts: [pc.Vec3, pc.Vec3, number][] = [],
      towers: [pc.Vec3, pc.Vec3][] = [];
    if (k > 0)
      for (const p of this.placed) {
        const n = Math.max(1, Math.min(12, Math.round(Math.sqrt(p.town.people) / 18))),
          // A tangent frame at the town: its huts laid about it on the ground.
          east = new pc.Vec3().cross(pc.Vec3.UP, p.up).normalize(),
          north = new pc.Vec3().cross(p.up, east);
        for (let i = 0; i < n; i++) {
          const a = i * 2.399963,
            r = s * 0.9 * Math.sqrt(i + 0.3),
            at = p.at
              .clone()
              .add(east.clone().mulScalar(Math.cos(a) * r))
              .add(north.clone().mulScalar(Math.sin(a) * r));
          huts.push([at, p.up, a]);
        }
        if (p.town.city) towers.push([p.at, p.up]);
      }
    const lay = (out: number[], at: pc.Vec3, up: pc.Vec3, w: number, h: number, a: number) => {
      out[0] = at.x + up.x * h * 0.5;
      out[1] = at.y + up.y * h * 0.5;
      out[2] = at.z + up.z * h * 0.5;
      out[3] = w;
      out[4] = h;
      out[5] = w;
      out[6] = up.x;
      out[7] = up.y;
      out[8] = up.z;
      out[9] = Math.cos(a);
      out[10] = 0;
      out[11] = Math.sin(a);
    };
    this.huts.setBasis(huts.length, (i, out) => {
      const [at, up, a] = huts[i]!;
      lay(out, at, up, s * 0.8, s * 0.9, a);
    });
    this.towers.setBasis(towers.length, (i, out) => {
      const [at, up] = towers[i]!;
      lay(out, at, up, s * 1.1, s * 4.5, 0);
    });
  }

  /** The towns on the screen to be named: each its place (CSS pixels), how large it is. */
  named(camera: pc.CameraComponent, distance: number): { town: GlobeTown; x: number; y: number }[] {
    if (!this.root.enabled || distance > NEAR + 0.25) return [];
    const eye = camera.entity.getPosition(),
      el = eye.length() || 1,
      out: { town: GlobeTown; x: number; y: number }[] = [],
      s = new pc.Vec3();
    for (const p of this.placed) {
      // (Only what faces the eye: not the far side.)
      if ((p.up.x * eye.x + p.up.y * eye.y + p.up.z * eye.z) / el < 0.35) continue;
      camera.worldToScreen(p.at, s);
      if (s.z > 0) out.push({ town: p.town, x: s.x, y: s.y });
    }
    return out;
  }
}
