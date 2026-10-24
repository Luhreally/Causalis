// A land's bands camped (Phase 28 M159): each camp a ring of tents about its fire on a patch of
// trodden ground, the fire's smoke going up, and a herding band's flocks grazing about it — drawn
// larger than life, as the land draws its woods and towns, to be seen from as near as its eye
// comes: smaller than a village, its smoke seen from further off. The smoke rises and the flocks
// drift while the clock runs, and stand while it is held.
import * as pc from "playcanvas";
import type { LandCamp } from "../bridge/index.ts";
import { LAND_ACROSS, LAND_UP, groundAt, tileMiddle, type LandGround } from "../view/index.ts";
import { InstancedBatch } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

/** How far a camp's ground goes, its tents' ring from the fire, a tent (metres). */
const PATCH = 16;
const RING = 8;
const TENT_W = 5;
const TENT_H = 4;
/** How far out its flock grazes (metres), and how many of a flock are drawn. */
const FLOCK = 42;
const FLOCK_HEAD = 14;
/** Puffs of smoke over a camp, and how high they go (metres). */
const PUFFS = 6;
const SMOKE_UP = 60;
/** How far over the ground a camp stands (region units), as the land's towns do; its name, over its tents. */
const LIFT = 0.01;
const NAME_UP = 0.6;
/**
 * How many times larger than the land draws its towns a camp is drawn (life-sized, a camp would be
 * a speck from as near as the land's eye comes): about as wide as a clump of its woods, a good
 * deal smaller than a village, its smoke seen from far off.
 */
const DRAWN = 6;
/** Region units to a camp's metre, across and up. */
const ACROSS = DRAWN * LAND_ACROSS;
const UP = DRAWN * LAND_UP;
/** The most camps a land draws (the host's MOST_CAMPS), and the most tents of one. */
const MOST = 16;
const MOST_TENTS = 14;

const HIDE: Rgb = [0.6, 0.45, 0.3];
const FELT: Rgb = [0.86, 0.82, 0.72];
const TRODDEN: Rgb = [0.52, 0.43, 0.31];
const SMOKE: Rgb = [0.72, 0.72, 0.74];
const FLEECE: Rgb = [0.92, 0.9, 0.84];

type Placed = {
  readonly camp: LandCamp;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly tents: number;
  /** A keyed number of the camp's own, for its tents' turn and its smoke's and flock's time. */
  readonly seed: number;
};

/** Tents to a camp of so many: one to every six, three at the fewest. */
function tentsOf(people: number): number {
  return Math.max(3, Math.min(MOST_TENTS, Math.round(people / 6)));
}

export class LandCamps {
  private readonly patch: InstancedBatch;
  private readonly hide: InstancedBatch;
  private readonly felt: InstancedBatch;
  private readonly fires: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly flocks: InstancedBatch;
  private placed: Placed[] = [];
  private key = "";
  /** The wall clock the smoke and flocks go by (held still while the land's clock is). */
  private time = 0;
  private wall = 0;

  constructor(
    stage: Stage,
    root: pc.Entity,
    meshes: { readonly box: pc.Mesh; readonly cone: pc.Mesh; readonly cyl: pc.Mesh },
  ) {
    const fire = new pc.StandardMaterial();
    fire.useLighting = false;
    fire.diffuse = new pc.Color(0, 0, 0);
    fire.emissive = new pc.Color(1, 0.55, 0.15);
    fire.update();
    this.patch = new InstancedBatch(stage, meshes.cyl, TRODDEN, MOST, root);
    this.hide = new InstancedBatch(stage, meshes.cone, HIDE, MOST * MOST_TENTS, root);
    this.felt = new InstancedBatch(stage, meshes.cone, FELT, MOST * MOST_TENTS, root);
    this.fires = new InstancedBatch(stage, meshes.cone, [1, 0.55, 0.15], MOST, root, fire);
    this.smoke = new InstancedBatch(
      stage,
      meshes.box,
      SMOKE,
      MOST * PUFFS,
      root,
      flatMaterial(SMOKE, 0.5),
    );
    this.flocks = new InstancedBatch(stage, meshes.box, FLEECE, MOST * FLOCK_HEAD, root);
  }

  /** The land's camps this season, set on its ground (laid again only when they move). */
  set(camps: readonly LandCamp[], g: LandGround): void {
    const key = camps.map((c) => `${c.id}:${c.tile}:${c.people}:${c.herds ? 1 : 0}`).join(",");
    if (key === this.key) return;
    this.key = key;
    this.placed = camps.slice(0, MOST).map((camp) => {
      const m = tileMiddle(g, camp.tile),
        seed = ((camp.id * 2654435761) ^ (camp.home * 40503)) >>> 0,
        // (Within its tile, a keyed spot: not all on the tiles' grid.)
        x = m.x + ((seed % 1000) / 1000 - 0.5) * 0.6 * g.tileKm,
        z = m.z + (((seed >>> 10) % 1000) / 1000 - 0.5) * 0.6 * g.tileKm;
      return { camp, x, z, y: groundAt(g, x, z) + LIFT, tents: tentsOf(camp.people), seed };
    });
    const tents = (felt: boolean) =>
      this.placed.flatMap((p) =>
        p.camp.herds === felt
          ? Array.from({ length: p.tents }, (_, k) => {
              // (A second ring about the first, for a camp of many.)
              const outer = k >= 8,
                n = outer ? p.tents - 8 : Math.min(8, p.tents),
                a =
                  ((outer ? k - 8 : k) / n) * 2 * Math.PI + (p.seed % 7) * 0.4 + (outer ? 0.3 : 0),
                r = RING * (outer ? 1.7 : 1) * ACROSS;
              return { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, y: p.y, a };
            })
          : [],
      );
    for (const [batch, list] of [
      [this.hide, tents(false)],
      [this.felt, tents(true)],
    ] as const)
      batch.set(list.length, (i, o) => {
        const t = list[i]!;
        o[0] = t.x;
        o[1] = t.y + (TENT_H * UP) / 2;
        o[2] = t.z;
        o[3] = o[5] = TENT_W * ACROSS;
        o[4] = TENT_H * UP;
        o[6] = t.a;
      });
    this.patch.set(this.placed.length, (i, o) => {
      const p = this.placed[i]!,
        r = PATCH * (p.tents > 8 ? 1.5 : 1) * ACROSS;
      o[0] = p.x;
      o[1] = p.y - 0.002;
      o[2] = p.z;
      o[3] = o[5] = r * 2;
      o[4] = 0.004;
    });
    this.wall = 0;
    this.update(true);
  }

  /** The fires, smoke and flocks a frame on (standing while the land's clock is held). */
  update(running: boolean): void {
    const wall = performance.now() / 1000;
    if (running && this.wall > 0) this.time += Math.min(0.25, wall - this.wall);
    this.wall = wall;
    const s = this.time,
      list = this.placed;
    this.fires.set(list.length, (i, o) => {
      const p = list[i]!,
        flick = 0.8 + 0.2 * Math.sin(s * 9 + p.seed);
      o[0] = p.x;
      o[1] = p.y + (1.2 * flick * UP) / 2;
      o[2] = p.z;
      o[3] = o[5] = 1.6 * ACROSS;
      o[4] = 1.2 * flick * UP;
      o[6] = s;
    });
    this.smoke.set(list.length * PUFFS, (i, o) => {
      const p = list[Math.floor(i / PUFFS)]!,
        u = (s * 0.12 + (i % PUFFS) / PUFFS + (p.seed % 97) / 97) % 1,
        // (Widening as it rises, leaning with the wind.)
        w = (4 + 16 * u) * ACROSS;
      o[0] = p.x + 22 * u * ACROSS;
      o[1] = p.y + (4 + SMOKE_UP * u) * UP;
      o[2] = p.z + 6 * u * ACROSS;
      o[3] = o[4] = o[5] = w;
      o[6] = (i % PUFFS) * 0.9 + s * 0.1;
    });
    const herds = list.filter((p) => p.camp.herds);
    this.flocks.set(herds.length * FLOCK_HEAD, (i, o) => {
      const p = herds[Math.floor(i / FLOCK_HEAD)]!,
        k = i % FLOCK_HEAD,
        // (The flock together, grazing round the camp slowly; each a little about the rest.)
        a = (p.seed % 628) / 100 + s * 0.02,
        cx = p.x + Math.cos(a) * FLOCK * ACROSS,
        cz = p.z + Math.sin(a) * FLOCK * ACROSS,
        b = k * 2.399963,
        r = 3.2 * Math.sqrt(k + 0.5) * ACROSS;
      o[0] = cx + Math.cos(b) * r;
      o[1] = p.y + 0.6 * UP;
      o[2] = cz + Math.sin(b) * r;
      o[3] = 2.4 * ACROSS;
      o[4] = 1.2 * UP;
      o[5] = 1.6 * ACROSS;
      o[6] = a + Math.PI / 2;
    });
  }

  /** None drawn (a new land). */
  clear(): void {
    this.key = "";
    this.placed = [];
    for (const b of [this.patch, this.hide, this.felt, this.fires, this.smoke, this.flocks])
      b.set(0, () => {});
  }

  /** The camps drawn: each with where it is (region units), its people and whether it herds (the look tools). */
  info(): { id: number; tile: number; x: number; z: number; people: number; herds: boolean }[] {
    return this.placed.map((p) => ({
      id: p.camp.id,
      tile: p.camp.tile,
      x: p.x,
      z: p.z,
      people: p.camp.people,
      herds: p.camp.herds,
    }));
  }

  /** Where each camp is, raised over its fire (region units), for its label. */
  points(): { x: number; y: number; z: number }[] {
    return this.placed.map((p) => ({ x: p.x, y: p.y + 0.12, z: p.z }));
  }

  /** Each camp drawn by its id, with its name's place on the screen over its smoke (null: behind the eye). */
  named(cam: pc.CameraComponent): Map<number, { x: number; y: number } | null> {
    const at = new pc.Vec3(),
      out = new pc.Vec3(),
      named = new Map<number, { x: number; y: number } | null>();
    for (const p of this.placed) {
      at.set(p.x, p.y + NAME_UP, p.z);
      cam.worldToScreen(at, out);
      named.set(p.camp.id, out.z > 0 ? { x: out.x, y: out.y } : null);
    }
    return named;
  }

  /** The camp drawn nearest a point of the screen, within a finger's reach: at its fire, or at its name. */
  pick(cam: pc.CameraComponent, x: number, y: number, reach = 28): number | null {
    const at = new pc.Vec3(),
      out = new pc.Vec3();
    let best: number | null = null,
      bestD = reach;
    for (const p of this.placed)
      for (const lift of [0, NAME_UP]) {
        at.set(p.x, p.y + lift, p.z);
        cam.worldToScreen(at, out);
        if (out.z <= 0) continue;
        const d = Math.hypot(out.x - x, out.y - y);
        if (d < bestD) {
          bestD = d;
          best = p.camp.id;
        }
      }
    return best;
  }

  /** Parts drawn in all (for the budgets). */
  get count(): number {
    return [this.patch, this.hide, this.felt, this.fires, this.smoke, this.flocks].reduce(
      (n, b) => n + b.size,
      0,
    );
  }

  destroy(): void {
    for (const b of [this.patch, this.hide, this.felt, this.fires, this.smoke, this.flocks])
      b.destroy();
  }
}
