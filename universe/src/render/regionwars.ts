// Wars in a land (Phase 10 M95): the globe's hosts seen closer. Each host a column under its
// realm's colours — a banner-bearer and those behind — marching in from the map's edge to
// what it wants, or out from its land toward the front; the defenders standing in a block at
// what they hold; and each battle fought here lately (as the globe shows it), its two hosts in lines face
// to face, crossed blades over a flare that pulses, the larger the more fell. Instanced; the
// march plays over as the war lasts, as on the globe.
import * as pc from "playcanvas";
import type { LandWars } from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";

/** How long a host's march across the land takes on the screen (seconds). */
const LAND_MARCH = 16;
/** The most figures of one side drawn at once. */
const MOST = 160;

type Flat = { readonly x: number; readonly z: number };

/** A figure: where it stands, which way it faces (yaw), how tall it is drawn (0 … 1: grown in). */
type Figure = { x: number; z: number; yaw: number; size: number; lead: boolean };

export class RegionWars {
  readonly root = new pc.Entity("region-wars");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private land: LandWars | null = null;
  private height: (x: number, z: number) => number = () => 0;
  private sides: InstancedBatch[] = [];
  private flags: InstancedBatch[] = [];
  private readonly heads: InstancedBatch;
  private readonly poles: InstancedBatch;
  private readonly blades: InstancedBatch;
  private readonly flares: InstancedBatch;
  /** Where each host's head and each battle stood at the last update (for picking, naming). */
  private marks: { x: number; z: number; ref: string; name: string; battle: boolean }[] = [];
  /** How many figures were drawn at the last update (for the look tools). */
  drawn = 0;

  /** The hosts and battles shown (for the look tools). */
  get shown(): { marches: number; battles: number } {
    return { marches: this.land?.marches.length ?? 0, battles: this.land?.battles.length ?? 0 };
  }

  constructor(stage: Stage) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    const make = (color: readonly [number, number, number], n: number) =>
      new InstancedBatch(stage, this.box, color, n, this.root);
    this.heads = make([0.9, 0.72, 0.56], MOST * 2);
    this.poles = make([0.42, 0.3, 0.18], 64);
    this.blades = make([0.86, 0.88, 0.92], 64);
    this.flares = make([1, 0.78, 0.26], 32);
    stage.root.addChild(this.root);
    this.root.enabled = false;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** The wars in the land now shown, and the height of its ground at a point. */
  set(land: LandWars | null, height: (x: number, z: number) => number): void {
    this.land = land;
    this.height = height;
    for (const b of [...this.sides, ...this.flags]) b.destroy();
    const colors = land?.colors ?? [];
    this.sides = colors.map((c) => new InstancedBatch(this.stage, this.box, c, MOST, this.root));
    // (Banners a little brighter than their bearers.)
    this.flags = colors.map(
      (c) =>
        new InstancedBatch(
          this.stage,
          this.box,
          [
            Math.min(1, c[0] * 1.2 + 0.08),
            Math.min(1, c[1] * 1.2 + 0.08),
            Math.min(1, c[2] * 1.2 + 0.08),
          ],
          32,
          this.root,
        ),
    );
  }

  /** Put every host and battle where it is at screen time `s` (seconds). */
  update(s: number): void {
    const land = this.land;
    if (!land || !this.root.enabled) return;
    const bySide: Figure[][] = land.colors.map(() => []),
      banners: { at: Flat; yaw: number; side: number; size: number }[] = [],
      marks: { x: number; z: number; ref: string; name: string; battle: boolean }[] = [];
    land.marches.forEach((m, n) => {
      const dx = m.to.x - m.from.x,
        dz = m.to.z - m.from.z,
        len = Math.hypot(dx, dz) || 1,
        ux = dx / len,
        uz = dz / len,
        yaw = Math.atan2(ux, uz),
        cycle = (s / LAND_MARCH + n * 0.37) % 1,
        lead = cycle * 0.92,
        grown = loopSize(cycle, 0.06, 0.08);
      // The column: a banner-bearer and those behind, two abreast.
      for (let k = 0; k < 12; k++) {
        const back = Math.floor(k / 2) * 1.1,
          aside = (k % 2 ? 0.45 : -0.45) * (k ? 1 : 0),
          along = lead * len - back;
        if (along < 0) break;
        const at = { x: m.from.x + ux * along - uz * aside, z: m.from.z + uz * along + ux * aside };
        bySide[m.side]!.push({
          ...at,
          yaw,
          size: Math.min(grown, loopSize(along / (len * 0.92), 0.06, 0)),
          lead: k === 0,
        });
        if (k === 0) {
          banners.push({ at, yaw, side: m.side, size: grown });
          marks.push({ ...at, ref: m.ref, name: `🚩 ${m.name}`, battle: false });
        }
      }
      // The defenders, in a block before what they hold, facing the way the host comes.
      if (m.held) {
        for (let k = 0; k < 9; k++) {
          const row = Math.floor(k / 3),
            col = (k % 3) - 1,
            at = {
              x: m.to.x - ux * (1.4 + row * 0.9) + -uz * col * 0.9,
              z: m.to.z - uz * (1.4 + row * 0.9) + ux * col * 0.9,
            };
          bySide[m.foe]!.push({ ...at, yaw: yaw + Math.PI, size: 1, lead: k === 1 });
        }
        banners.push({
          at: { x: m.to.x - ux * 1.4, z: m.to.z - uz * 1.4 },
          yaw: yaw + Math.PI,
          side: m.foe,
          size: 1,
        });
      }
    });
    // Battles: two lines face to face, closing and falling back as they fight.
    const clashes: { at: Flat; size: number; pulse: number }[] = [];
    land.battles.forEach((b, n) => {
      const fresh = b.age === 0 ? 1 : b.age === 1 ? 0.7 : 0.45,
        count = Math.round(4 + 6 * b.size * fresh),
        sway = Math.sin(s * 2.2 + n) * 0.25;
      for (const [side, dir] of [
        [b.side, -1],
        [b.foe, 1],
      ] as const)
        for (let k = 0; k < count; k++) {
          const across = (k - (count - 1) / 2) * 0.8,
            gap = 0.9 + (dir > 0 ? sway : -sway) + (k % 2) * 0.5;
          bySide[side]!.push({
            x: b.at.x + across,
            z: b.at.z + dir * gap,
            yaw: dir > 0 ? Math.PI : 0,
            size: 1,
            lead: k === Math.floor(count / 2),
          });
        }
      clashes.push({
        at: b.at,
        size: (1.4 + 2.6 * b.size) * fresh,
        pulse: 0.75 + 0.25 * Math.sin(s * 5 + n * 1.7),
      });
      marks.push({ x: b.at.x, z: b.at.z, ref: b.event, name: `⚔️ ${b.name}`, battle: true });
    });
    this.marks = marks;
    // Draw them: bodies in their side's colour, a head on each.
    let drawn = 0;
    const heads: Figure[] = [];
    bySide.forEach((figures, side) => {
      const mine = figures.slice(0, MOST);
      drawn += mine.length;
      heads.push(...mine);
      this.sides[side]?.set(mine.length, (i, out) => {
        const f = mine[i]!,
          h = (f.lead ? 0.95 : 0.75) * f.size;
        out[0] = f.x;
        out[1] = this.height(f.x, f.z) + h / 2;
        out[2] = f.z;
        out[3] = 0.42 * f.size;
        out[4] = h;
        out[5] = 0.3 * f.size;
        out[6] = f.yaw;
      });
    });
    const shown = heads.slice(0, MOST * 2);
    this.heads.set(shown.length, (i, out) => {
      const f = shown[i]!,
        h = (f.lead ? 0.95 : 0.75) * f.size,
        r = 0.3 * f.size;
      out[0] = f.x;
      out[1] = this.height(f.x, f.z) + h + r / 2;
      out[2] = f.z;
      out[3] = out[4] = out[5] = r;
      out[6] = f.yaw;
    });
    // The banners: a pole and its side's flag.
    this.poles.set(banners.length, (i, out) => {
      const b = banners[i]!;
      out[0] = b.at.x;
      out[1] = this.height(b.at.x, b.at.z) + 1.1 * b.size;
      out[2] = b.at.z;
      out[3] = out[5] = 0.07;
      out[4] = 2.2 * b.size;
      out[6] = b.yaw;
    });
    this.flags.forEach((batch, side) => {
      const mine = banners.filter((b) => b.side === side);
      batch.set(mine.length, (i, out) => {
        const b = mine[i]!,
          wave = Math.sin(s * 4 + i) * 0.12;
        out[0] = b.at.x - Math.sin(b.yaw) * 0.35;
        out[1] = this.height(b.at.x, b.at.z) + 1.95 * b.size;
        out[2] = b.at.z - Math.cos(b.yaw) * 0.35;
        out[3] = 0.05;
        out[4] = 0.45 * b.size;
        out[5] = 0.7 * b.size;
        out[6] = b.yaw + wave;
      });
    });
    // Each clash: crossed blades over a pulsing flare.
    this.flares.set(clashes.length, (i, out) => {
      const c = clashes[i]!,
        k = c.size * c.pulse;
      out[0] = c.at.x;
      out[1] = this.height(c.at.x, c.at.z) + 0.25 + k * 0.4;
      out[2] = c.at.z;
      out[3] = out[4] = out[5] = k;
      out[6] = s;
    });
    this.blades.set(clashes.length * 2, (i, out) => {
      const c = clashes[i >> 1]!;
      out[0] = c.at.x;
      out[1] = this.height(c.at.x, c.at.z) + 1.4 + c.size * 0.6;
      out[2] = c.at.z;
      out[3] = 0.09;
      out[4] = 1.6 + c.size;
      out[5] = 0.09;
      out[6] = 0;
      out[7] = i % 2 ? 0.7 : -0.7;
    });
    this.drawn = drawn;
  }

  /** Each host's and battle's name where it stands on the screen (CSS pixels), a battle first. */
  labels(): { key: string; text: string; at: { x: number; y: number } | null; priority: number }[] {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      out = new pc.Vec3();
    return this.marks.map((m) => {
      at.set(m.x, this.height(m.x, m.z) + 3, m.z);
      cam.worldToScreen(at, out);
      return {
        key: m.ref,
        text: m.name,
        at: out.z > 0 ? { x: out.x, y: out.y } : null,
        // (Named before the towns about it.)
        priority: m.battle ? 2e9 : 1e9,
      };
    });
  }

  /** The host or battle nearest a screen point, within `reach` (a finger's), its ref; or null. */
  pick(x: number, y: number, reach = 28): string | null {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      out = new pc.Vec3();
    let best: string | null = null,
      bestD = reach;
    for (const m of this.marks) {
      at.set(m.x, this.height(m.x, m.z) + 0.8, m.z);
      cam.worldToScreen(at, out);
      if (out.z <= 0) continue;
      const d = Math.hypot(out.x - x, out.y - y);
      if (d < bestD) {
        bestD = d;
        best = m.ref;
      }
    }
    return best;
  }
}

/** A loop's drawn size at its phase (0 … 1): grown over `grow` of it, shrunk over the last `shrink`. */
function loopSize(phase: number, grow: number, shrink: number): number {
  const k =
    phase < grow ? phase / grow : shrink > 0 && phase > 1 - shrink ? (1 - phase) / shrink : 1;
  return Math.max(0, Math.min(1, k * k * (3 - 2 * k)));
}
