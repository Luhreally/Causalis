// A wildfire drawn on a land (N1): its front as a line of flames going over the ground, its smoke going up, and its scar in the
// ground's own colours and in the woods gone from it. Nothing is built in a frame: flames and smoke are put in their batches,
// the ground painted a few times a second at most while the fire moves, its woods planted again at a plan's coming at most.
import * as pc from "playcanvas";
import type { LandBurn } from "../bridge/index.ts";
import {
  FIRE_POINT,
  bareTiles,
  burnBand,
  burnClock,
  burnTiles,
  burnedBy,
  flamesOf,
  scarAge,
  scarOver,
  smokeOf,
  type BurnTiles,
  type LandGround,
} from "../view/index.ts";
import { InstancedBatch, ballMesh, coneMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

/** The most flames and puffs drawn at once, on a phone's quality and above. */
const FLAMES = { low: 420, high: 700 };
const PUFFS = { low: 140, high: 220 };
/** How round a puff of smoke is: few faces, as anything here. */
const PUFF_BANDS = 3;
/** How often the ground is painted again while a fire moves, in real milliseconds at the least. */
const PAINT_WAIT = 350;
/** Into how many steps of its tiles and its years a fire's woods are told: each is one planting at most. */
const WOOD_STEPS = 16;

/** Seen by its own light, so that it reads in daylight and by night. */
function glowing(color: Rgb, opacity: number, glow: number): pc.StandardMaterial {
  const m = flatMaterial(color, opacity);
  m.emissive = new pc.Color(color[0] * glow, color[1] * glow, color[2] * glow);
  m.update();
  return m;
}

type Drawn = { readonly burn: LandBurn; readonly tiles: BurnTiles; local: number };

export class WildfireLayer {
  readonly root = new pc.Entity("wildfire");
  private readonly flames: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly most: { flames: number; puffs: number };
  private readonly flameAt: Float32Array;
  private readonly puffAt: Float32Array;
  private ground: LandGround | null = null;
  private burns = new Map<string, Drawn>();
  private flameLook = "";
  private smokeLook = "";
  private paintKey = 0;
  private paintedAt = -Infinity;
  private seconds = 0;
  private wall = 0;
  /** The moment it was last told. */
  private lastT = 0;
  private bare: Uint8Array | null = null;
  private bareCount = 0;
  /** What stands bare, as the woods read it: the same key, the same woods. */
  woodKey = "";
  /** What was drawn last (the look tools, the gate). */
  shown = { flames: 0, smoke: 0, scar: 0, burns: 0, bare: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    const low = stage.quality.name === "low";
    this.most = low
      ? { flames: FLAMES.low, puffs: PUFFS.low }
      : { flames: FLAMES.high, puffs: PUFFS.high };
    this.flames = new InstancedBatch(
      stage,
      keptMesh(coneMesh(stage, 0.5, 1, 5)),
      [1, 0.5, 0.1],
      FLAMES.high,
      this.root,
      glowing([1, 0.5, 0.1], 1, 0.95),
    );
    this.smoke = new InstancedBatch(
      stage,
      keptMesh(ballMesh(stage, 0.5, PUFF_BANDS)),
      [0.62, 0.6, 0.58],
      PUFFS.high,
      this.root,
      glowing([0.62, 0.6, 0.58], 0.42, 0.38),
    );
    this.flameAt = new Float32Array(FLAMES.high * FIRE_POINT);
    this.puffAt = new Float32Array(PUFFS.high * FIRE_POINT);
    parent.addChild(this.root);
  }

  /** A new land: nothing burning on it. */
  reset(ground: LandGround | null): void {
    this.ground = ground;
    this.burns.clear();
    this.bare = null;
    this.woodKey = "";
    this.paintKey = 0;
    this.flames.set(0, () => {});
    this.smoke.set(0, () => {});
    this.shown = { flames: 0, smoke: 0, scar: 0, burns: 0, bare: 0 };
  }

  /** The fires a land's plan tells (each one's way worked out once), and what stands bare at moment t. */
  set(burns: readonly LandBurn[], t: number, pace: number): void {
    const g = this.ground;
    if (!g) return;
    const seen = new Set<string>();
    for (const burn of burns) {
      if (!burn.spots.length || t >= burn.gone) continue;
      seen.add(burn.event);
      if (!this.burns.has(burn.event))
        this.burns.set(burn.event, {
          burn,
          tiles: burnTiles(burn, g),
          local: burnClock(burn, t, pace),
        });
    }
    for (const event of [...this.burns.keys()]) if (!seen.has(event)) this.burns.delete(event);
    this.lastT = t;
    this.woods(t, pace);
  }

  /** What stands bare for the woods, told in steps. */
  private woods(t: number, pace: number): void {
    const g = this.ground;
    if (!g || !this.burns.size) {
      this.bare = null;
      this.bareCount = 0;
      this.woodKey = "";
      return;
    }
    let key = "";
    const steps: { d: Drawn; done: number; age: number }[] = [];
    for (const d of this.burns.values()) {
      // (By its own clock, drawn out at a fast pace: the woods go as the front comes to them, not before.)
      const burned = burnedBy(d.tiles, burnClock(d.burn, t, pace)),
        all = d.tiles.tiles.length,
        step = Math.max(1, Math.ceil(all / WOOD_STEPS)),
        done = burned >= all ? all : Math.floor(burned / step) * step,
        age = scarAge(d.burn, t);
      steps.push({ d, done, age });
      key += `${d.burn.event}:${done}:${age > 2 / 3 ? Math.ceil(age * WOOD_STEPS) : 0};`;
    }
    if (key === this.woodKey) return;
    this.woodKey = key;
    const mask = new Uint8Array(g.size * g.size);
    for (const s of steps) bareTiles(mask, s.d.tiles, s.age, s.done);
    this.bare = mask;
    this.bareCount = mask.reduce((a, b) => a + b, 0);
  }

  /** The trees left standing, of those given. */
  standing<T extends { readonly tile: number }>(trees: readonly T[]): T[] {
    const bare = this.bare;
    return bare ? trees.filter((t) => !bare[t.tile]) : [...trees];
  }

  /**
   * Each frame: the flames and smoke of what burns at moment t, the eye `distance` away. Whether the ground must be painted
   * again (with `scarred`), a few times a second at most.
   */
  update(t: number, pace: number, distance: number, running: boolean): boolean {
    const wallNow = performance.now();
    if (running) this.seconds += Math.min(0.1, (wallNow - this.wall) / 1000);
    this.wall = wallNow;
    this.lastT = t;
    if (!this.burns.size) {
      const clean = this.shown.flames === 0 && this.shown.smoke === 0 && this.paintKey === 0;
      if (clean) return false;
    }
    let flames = 0,
      puffs = 0,
      key = 0,
      scar = 0,
      flame: readonly number[] | null = null,
      smoke: readonly number[] | null = null;
    for (const d of this.burns.values()) {
      const local = burnClock(d.burn, t, pace),
        band = burnBand(d.burn);
      d.local = local;
      const done = burnedBy(d.tiles, local),
        age = scarAge(d.burn, t);
      scar += done;
      key += (done + 1) * 257 + Math.floor(age * 24) + burnedBy(d.tiles, local - band);
      const before = flames;
      flames = flamesOf(d.tiles, band, local, this.most.flames - flames, this.flameAt, flames);
      const puffsBefore = puffs;
      puffs = smokeOf(d.tiles, band, local, this.most.puffs - puffs, this.puffAt, puffs);
      if (flames > before) flame = d.burn.flame;
      if (puffs > puffsBefore) smoke = d.burn.smoke;
    }
    if (flame) this.lookOfFlame(flame);
    if (smoke) this.lookOfSmoke(smoke);
    const d = Math.max(1, distance),
      size = Math.max(0.3, Math.min(4, d * 0.013)),
      s = this.seconds;
    if (flames || this.shown.flames)
      this.flames.set(flames, (i, o) => {
        const q = i * FIRE_POINT,
          k = this.flameAt[q + 3]!,
          r = this.flameAt[q + 4]!,
          flick = 0.72 + 0.28 * Math.sin(s * (6 + 5 * r) + r * 40),
          w = size * (0.75 + 0.55 * r) * (0.45 + 0.55 * k),
          h = size * (1.7 + 2 * r) * flick * (0.4 + 0.6 * k);
        o[0] = this.flameAt[q]!;
        o[1] = this.flameAt[q + 1]! + h / 2;
        o[2] = this.flameAt[q + 2]!;
        o[3] = w;
        o[4] = h;
        o[5] = w;
        o[6] = r * 6.28;
      });
    if (puffs || this.shown.smoke)
      this.smoke.set(puffs, (i, o) => {
        const q = i * FIRE_POINT,
          k = this.puffAt[q + 3]!,
          r = this.puffAt[q + 4]!,
          go = s * (0.12 + 0.08 * r) + r * 7,
          f = go - Math.floor(go),
          high = d * 0.2 * (0.35 + 0.65 * k),
          // (Swelling as it leaves the ground, and gone to nothing at the top of its rise: none pops.)
          puff = d * 0.026 * (0.6 + 0.5 * k) * Math.sin(Math.PI * Math.pow(f, 0.55));
        o[0] = this.puffAt[q]! + f * high * 0.5;
        o[1] = this.puffAt[q + 1]! + size + f * high;
        o[2] = this.puffAt[q + 2]! + f * high * 0.18;
        o[3] = puff;
        o[4] = puff * 0.8;
        o[5] = puff;
        o[6] = r * 6.28 + f;
      });
    this.shown = { flames, smoke: puffs, scar, burns: this.burns.size, bare: this.bareCount };
    if (key === this.paintKey || wallNow - this.paintedAt < PAINT_WAIT) return false;
    this.paintKey = key;
    this.paintedAt = wallNow;
    return true;
  }

  /** Where the flames stand now, on the whole (the look tools, the gate). */
  front(): { x: number; z: number } | null {
    const n = this.shown.flames;
    if (!n) return null;
    let x = 0,
      z = 0;
    for (let i = 0; i < n; i++) {
      x += this.flameAt[i * FIRE_POINT]!;
      z += this.flameAt[i * FIRE_POINT + 2]!;
    }
    return { x: x / n, z: z / n };
  }

  private lookOfFlame(c: readonly number[]): void {
    const key = c.join();
    if (key === this.flameLook) return;
    this.flameLook = key;
    this.flames.recolor([c[0]!, c[1]!, c[2]!]);
    this.flames.glow([c[0]! * 0.95, c[1]! * 0.95, c[2]! * 0.95]);
  }

  private lookOfSmoke(c: readonly number[]): void {
    const key = c.join();
    if (key === this.smokeLook) return;
    this.smokeLook = key;
    this.smoke.recolor([c[0]!, c[1]!, c[2]!]);
    this.smoke.glow([c[0]! * 0.38, c[1]! * 0.38, c[2]! * 0.38]);
  }

  /** A land's colours with its scars laid on (the same array, where it has none), as they stood at the last update. */
  scarred(colors: Uint8Array): Uint8Array {
    if (!this.burns.size) return colors;
    const out = colors.slice();
    for (const d of this.burns.values()) scarOver(out, d.tiles, d.burn, this.lastT, d.local);
    return out;
  }
}

/** The looks a fire is drawn with, for the stage to warm before a first descent. */
export function wildfireMaterials(
  stage: Stage,
): { material: pc.Material; instanced: boolean; mesh: pc.Mesh }[] {
  return [
    {
      material: glowing([1, 0.5, 0.1], 1, 0.95),
      instanced: true,
      mesh: coneMesh(stage, 0.5, 1, 5),
    },
    {
      material: glowing([0.62, 0.6, 0.58], 0.42, 0.38),
      instanced: true,
      mesh: ballMesh(stage, 0.5, PUFF_BANDS),
    },
  ];
}
