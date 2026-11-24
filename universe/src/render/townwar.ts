// A town's war drawn about it (Phase 40 M204): the besiegers' tents ringing it and their camp's
// fires, and its houses burning when it is stormed — flames and the smoke over them; the hosts'
// fires the night before a battle before it (Phase 55 M227). Its soldiers
// are the village's own figures in their sides' colours (render/village.ts). Units as the
// village's: a tenth of a unit to the metre; tents and camp fires laid for a person drawn three times life and drawn by the
// folk's drawn size (`folk`: view/village.ts folkOf), as are what stands past the line (FOLK_METRE), a group's carriers and
// the siege's works, each made by and for its folk's bodies (a man's at true size); flames sized to houses, a shell's burst
// to its charge.
import * as pc from "playcanvas";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import { VehicleLayer } from "./vehicles.ts";
import { SiegeWorksLayer } from "./siegeworks.ts";
import type { TownWarScene } from "../view/index.ts";

const M = 0.1;
/** The most of a group's carriers drawn. */
const CARRIERS = 4;
/** The most tents, camp fires, burning houses (each its flames and its smoke's puffs). */
const MOST_TENTS = 16,
  MOST_CAMP = 24,
  MOST_FIRES = 16,
  FLAMES = 3,
  PUFFS = 5;
const CANVAS: Rgb = [0.86, 0.8, 0.64],
  SMOKE: Rgb = [0.3, 0.29, 0.28];
/** Past the line (W1): the most team guns and their parts, field guns and theirs, bursts at once and each one's puffs. */
const MOST_GUNS = 24,
  GUN_PARTS = 3,
  MOST_BATTERY = 8,
  BATTERY_PARTS = 4,
  MOST_BURSTS = 12,
  STEEL: Rgb = [0.17, 0.18, 0.2],
  DIRT: Rgb = [0.3, 0.25, 0.19];
/** How long a shell's burst lasts (s), and how often one lands (s). */
const BURST_S = 1.5,
  LANDS_S = 0.7;
/** A field gun's flash: while sin(s * BATTERY_HZ + n * BATTERY_APART) is past BATTERY_ON (the screen's clock s, its gun n). */
const BATTERY_HZ = 1.9,
  BATTERY_APART = 1.7,
  BATTERY_ON = 0.93,
  BATTERY_RISE = Math.asin(BATTERY_ON);
/** Whether field gun `n` shows its flash at second `s` of the screen's clock. */
export const batteryFlashing = (s: number, n: number): boolean =>
  Math.sin(s * BATTERY_HZ + n * BATTERY_APART) > BATTERY_ON;

/**
 * What the guns past the line fire from `c0` to `c1` of the screen's clock (s), as the layer draws it: each field gun as its
 * flash begins, each shell as it lands (where, metres). Into `out` (added to; for what is heard).
 */
export function firesBetween(
  scene: TownWarScene | null,
  c0: number,
  c1: number,
  black: boolean,
  out: {
    t: number;
    x: number;
    z: number;
    arm: string;
    kind?: "cannon" | "blast";
    black?: boolean;
  }[],
): void {
  if (!scene || c1 <= c0) return;
  const field = scene.battery ?? [],
    shells = scene.shells ?? [],
    nb = Math.min(MOST_BATTERY, field.length),
    turn = (2 * Math.PI) / BATTERY_HZ;
  for (let n = 0; n < nb; n++) {
    const g = field[n]!,
      // (Its flash begins each turn as its sine rises past BATTERY_ON.)
      first = (BATTERY_RISE - n * BATTERY_APART) / BATTERY_HZ;
    for (let k = Math.floor((c0 - first) / turn) + 1; first + k * turn <= c1; k++)
      out.push({ t: first + k * turn, x: g.x, z: g.z, arm: "", kind: "cannon", black });
  }
  if (shells.length)
    for (let b = Math.floor(c0 / LANDS_S) + 1; b * LANDS_S <= c1; b++) {
      const at = shells[(((b * 7) % shells.length) + shells.length) % shells.length]!;
      out.push({ t: b * LANDS_S, x: at.x, z: at.z, arm: "", kind: "blast" });
    }
}
/** Units to a true metre of what stands among its folk, for a person drawn three times life (times the folk's drawn size: true). */
const FOLK_METRE = 0.55 / 1.75;

export class TownWarLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("town-war");
  private readonly tents: InstancedBatch;
  private readonly campFires: InstancedBatch;
  /** Each camp fire's light on the ground. */
  private readonly glows: InstancedBatch;
  /** A group's carriers (view/townwar.ts): their plate, their wheels, a band of their side's colour on each. */
  private readonly plate: InstancedBatch;
  private readonly wheels: InstancedBatch;
  private readonly bands: [InstancedBatch, InstancedBatch];
  private banded: readonly [Rgb, Rgb] | null = null;
  private readonly flames: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly teamGuns: InstancedBatch;
  private readonly battery: InstancedBatch;
  private readonly flashes: InstancedBatch;
  private readonly bursts: InstancedBatch;
  private readonly dirt: InstancedBatch;
  /** A kept siege's works about the town (render/siegeworks.ts). */
  private readonly works: SiegeWorksLayer;
  /** An armoured host's cars (built when first brought to the town), and each side's colour. */
  private vehicles: VehicleLayer | null = null;
  private colored: readonly [Rgb, Rgb] = [
    [0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5],
  ];
  private readonly stage: Stage;
  /** What was last drawn (the look tools). */
  shown = { tents: 0, fires: 0, camp: 0, teamGuns: 0, battery: 0, shells: 0, cars: 0 };

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    parent.addChild(this.root);
    const root = this.root,
      fire = new pc.StandardMaterial();
    fire.useLighting = false;
    fire.diffuse = new pc.Color(0, 0, 0);
    fire.emissive = new pc.Color(1, 0.5, 0.12);
    fire.update();
    const cone = coneMesh(stage, 0.5, 1, 6);
    this.tents = new InstancedBatch(stage, coneMesh(stage, 0.5, 1, 4), CANVAS, MOST_TENTS, root);
    this.campFires = new InstancedBatch(
      stage,
      cone,
      [1, 0.5, 0.12],
      MOST_TENTS + MOST_CAMP,
      root,
      fire,
    );
    const glow = new pc.StandardMaterial();
    glow.useLighting = false;
    glow.diffuse = new pc.Color(0, 0, 0);
    glow.emissive = new pc.Color(1, 0.55, 0.18);
    glow.opacity = 0.3;
    glow.blendType = pc.BLEND_ADDITIVEALPHA;
    glow.depthWrite = false;
    glow.update();
    this.plate = new InstancedBatch(stage, boxMesh(stage), [0.3, 0.32, 0.35], CARRIERS * 3, root);
    this.wheels = new InstancedBatch(stage, boxMesh(stage), [0.1, 0.1, 0.11], CARRIERS * 4, root);
    this.bands = [
      new InstancedBatch(stage, boxMesh(stage), [0.5, 0.5, 0.5], CARRIERS, root),
      new InstancedBatch(stage, boxMesh(stage), [0.5, 0.5, 0.5], CARRIERS, root),
    ];
    this.glows = new InstancedBatch(
      stage,
      coneMesh(stage, 0.5, 1, 14),
      [1, 0.55, 0.18],
      MOST_CAMP,
      root,
      glow,
    );
    this.flames = new InstancedBatch(stage, cone, [1, 0.5, 0.12], MOST_FIRES * FLAMES, root, fire);
    this.smoke = new InstancedBatch(
      stage,
      boxMesh(stage),
      SMOKE,
      MOST_FIRES * PUFFS,
      root,
      flatMaterial(SMOKE, 0.55),
    );
    const box = boxMesh(stage);
    this.teamGuns = new InstancedBatch(stage, box, STEEL, MOST_GUNS * GUN_PARTS, root);
    this.battery = new InstancedBatch(stage, box, STEEL, MOST_BATTERY * BATTERY_PARTS, root);
    this.flashes = new InstancedBatch(
      stage,
      cone,
      [1, 0.5, 0.12],
      MOST_BURSTS + MOST_GUNS + MOST_BATTERY,
      root,
      fire,
    );
    this.bursts = new InstancedBatch(
      stage,
      box,
      SMOKE,
      MOST_BURSTS * 2,
      root,
      flatMaterial(SMOKE, 0.7),
    );
    this.dirt = new InstancedBatch(stage, box, DIRT, MOST_BURSTS, root);
    this.works = new SiegeWorksLayer(stage, root);
  }

  /** Each side's colour, for its cars' paint. */
  colors(a: Rgb, d: Rgb): void {
    if (this.colored[0] === a && this.colored[1] === d) return;
    this.colored = [a, d];
    this.vehicles?.setup(this.colored);
  }

  /** A group's carriers: each a plated box on wheels, a cab before it or a cart's shaft, its side's colour round it. */
  private carriers(scene: TownWarScene | null, folk: number): void {
    const list = (scene?.carriers ?? []).slice(0, CARRIERS);
    if (this.banded !== this.colored) {
      this.banded = this.colored;
      this.bands[0].recolor(this.colored[0]);
      this.bands[1].recolor(this.colored[1]);
    }
    /** A box of a carrier: so far forward and aside of its middle, so high, so large (metres of a man's; K of them to its folk's). */
    const K = (folk * FOLK_METRE) / M,
      box = (
        out: number[],
        c: (typeof list)[number],
        fore: number,
        aside: number,
        high: number,
        long: number,
        wide: number,
        tall: number,
      ) => {
        const sn = Math.sin(c.yaw),
          cs = Math.cos(c.yaw);
        out[0] = (c.x + (sn * fore + cs * aside) * K) * M;
        out[1] = high * K * M;
        out[2] = (c.z + (cs * fore - sn * aside) * K) * M;
        out[3] = wide * K * M;
        out[4] = tall * K * M;
        out[5] = long * K * M;
        out[6] = c.yaw;
      };
    this.plate.set(list.length * 3, (i, out) => {
      const c = list[Math.floor(i / 3)]!,
        part = i % 3;
      // (A truck: its plated box, its cab, a plate over its front. A cart: its boarded box, its shaft, a board raised before it.)
      if (c.cart) {
        if (part === 0) box(out, c, -0.3, 0, 1.05, 2.8, 1.7, 1.0);
        else if (part === 1) box(out, c, 2.0, 0, 0.75, 1.9, 0.14, 0.14);
        else box(out, c, 1.1, 0, 1.75, 0.12, 1.7, 0.5);
      } else if (part === 0) box(out, c, -0.7, 0, 1.4, 3.2, 2.0, 1.6);
      else if (part === 1) box(out, c, 1.6, 0, 1.15, 1.4, 1.9, 1.1);
      else box(out, c, 2.34, 0, 1.3, 0.1, 2.0, 0.9);
    });
    this.wheels.set(list.length * 4, (i, out) => {
      const c = list[Math.floor(i / 4)]!,
        w = i % 4,
        aside = (w % 2 ? 1 : -1) * (c.cart ? 0.95 : 1.05);
      if (c.cart) box(out, c, w < 2 ? -0.3 : -0.3, aside, 0.55, 1.1, 0.16, 1.1);
      else box(out, c, w < 2 ? 1.5 : -1.6, aside, 0.42, 0.84, 0.3, 0.84);
    });
    for (const side of [0, 1] as const) {
      const mine = list.filter((c) => c.side === side);
      this.bands[side].set(mine.length, (i, out) => {
        const c = mine[i]!;
        if (c.cart) box(out, c, -0.3, 0, 1.25, 2.86, 1.76, 0.22);
        else box(out, c, -0.7, 0, 1.75, 3.26, 2.06, 0.3);
      });
    }
  }

  /** What is past the line: a team gun's parts, the guns standing off, the shells landing, the cars. */
  private past(scene: TownWarScene | null, s: number, folk: number): void {
    const guns = scene?.teamGuns ?? [],
      field = scene?.battery ?? [],
      shells = scene?.shells ?? [],
      cars = scene?.cars ?? [],
      ng = Math.min(MOST_GUNS, guns.length),
      nb = Math.min(MOST_BATTERY, field.length),
      m = folk * FOLK_METRE;
    // A team gun: its receiver and its barrel, low on its tripod's legs.
    this.teamGuns.set(ng * GUN_PARTS, (n, out) => {
      const g = guns[Math.floor(n / GUN_PARTS)]!,
        k = n % GUN_PARTS,
        c = Math.cos(g.yaw),
        sn = Math.sin(g.yaw),
        along = k === 1 ? 0.75 * m : 0;
      out[0] = g.x * M + sn * along;
      out[1] = (k === 2 ? 0.28 : 0.62) * m;
      out[2] = g.z * M + c * along;
      out[3] = (k === 0 ? 0.36 : k === 1 ? 0.13 : 0.75) * m;
      out[4] = (k === 0 ? 0.36 : k === 1 ? 0.13 : 0.55) * m;
      out[5] = (k === 0 ? 0.8 : k === 1 ? 1.1 : 0.75) * m;
      out[6] = g.yaw;
    });
    // A gun standing off: its trail on the ground, its barrel raised, its wheels.
    this.battery.set(nb * BATTERY_PARTS, (n, out) => {
      const g = field[Math.floor(n / BATTERY_PARTS)]!,
        k = n % BATTERY_PARTS,
        c = Math.cos(g.yaw),
        sn = Math.sin(g.yaw),
        along = k === 0 ? -1.5 * m : k === 1 ? 1.1 * m : 0,
        aside = k === 2 ? 0.9 * m : k === 3 ? -0.9 * m : 0;
      out[0] = g.x * M + sn * along + c * aside;
      out[1] = (k === 0 ? 0.42 : k === 1 ? 1.05 : 0.65) * m;
      out[2] = g.z * M + c * along - sn * aside;
      out[3] = (k === 0 ? 0.45 : k === 1 ? 0.3 : 0.25) * m;
      out[4] = (k === 0 ? 0.3 : k === 1 ? 0.3 : 1.3) * m;
      out[5] = (k === 0 ? 3 : k === 1 ? 3.6 : 1.3) * m;
      out[6] = g.yaw;
      out[7] = k === 1 ? -0.22 : 0;
    });
    // A burst in the town's lots: one landing every so often, each its flash, its dirt thrown up, its smoke.
    const landing: { x: number; z: number; k: number; n: number }[] = [];
    if (shells.length) {
      const last = Math.floor(s / LANDS_S),
        back = Math.ceil(BURST_S / LANDS_S);
      for (let b = last; b > last - back && landing.length < MOST_BURSTS; b--) {
        const age = s - b * LANDS_S;
        if (age < 0 || age >= BURST_S) continue;
        const at = shells[(((b * 7) % shells.length) + shells.length) % shells.length]!;
        landing.push({ x: at.x, z: at.z, k: age / BURST_S, n: b });
      }
    }
    const firing = ng ? guns.filter((g) => g.firing) : [],
      flash = (n: number) => Math.sin(s * 19 + n * 2.3) > 0.55,
      muzzles = [
        ...firing
          .filter((_, n) => flash(n))
          .map((g) => ({ x: g.x, z: g.z, yaw: g.yaw, big: false })),
        ...field
          .slice(0, nb)
          .filter((_, n) => batteryFlashing(s, n))
          .map((g) => ({ x: g.x, z: g.z, yaw: g.yaw, big: true })),
      ];
    this.flashes.set(landing.length + muzzles.length, (n, out) => {
      if (n < landing.length) {
        const b = landing[n]!,
          h = (1 - b.k) * (1 - b.k) * 2.4;
        out[0] = b.x * M;
        out[1] = 0.5 + h * 0.5;
        out[2] = b.z * M;
        out[3] = 0.7 * (1 - b.k * 0.5);
        out[4] = h;
        out[5] = 0.7 * (1 - b.k * 0.5);
        out[6] = b.n;
        return;
      }
      const g = muzzles[n - landing.length]!,
        far = (g.big ? 3.1 : 1.45) * m,
        w = (g.big ? 0.8 : 0.5) * m;
      out[0] = g.x * M + Math.sin(g.yaw) * far;
      out[1] = (g.big ? 1.5 : 0.62) * m;
      out[2] = g.z * M + Math.cos(g.yaw) * far;
      out[3] = w;
      out[4] = w * 1.3;
      out[5] = w;
      out[6] = g.yaw;
      out[7] = -Math.PI / 2;
    });
    this.dirt.set(landing.length, (n, out) => {
      const b = landing[n]!,
        up = Math.sin(Math.min(1, b.k * 1.6) * Math.PI);
      out[0] = b.x * M;
      out[1] = 0.4 + up * 1.1;
      out[2] = b.z * M;
      out[3] = 0.32 * (1 - b.k * 0.5);
      out[4] = 0.4 * up;
      out[5] = 0.32 * (1 - b.k * 0.5);
      out[6] = b.n * 1.3;
    });
    this.bursts.set(landing.length * 2, (n, out) => {
      const b = landing[n >> 1]!,
        k = n & 1,
        grow = 0.22 + b.k * 0.62;
      out[0] = b.x * M + k * 0.35 * b.k;
      out[1] = 0.8 + b.k * (2.2 + k);
      out[2] = b.z * M - k * 0.3 * b.k;
      out[3] = out[4] = out[5] = grow * (1 - b.k * 0.25);
      out[6] = b.n * 0.7 + k;
    });
    if (cars.length) this.vehicles ??= this.buildCars();
    if (this.vehicles) {
      // (A car knocked out burns, its smoke rolling up from it.)
      const wrecks = cars.filter((v) => v.knocked > 0.5);
      this.vehicles.update(
        cars,
        wrecks.map((v, n) => ({
          x: v.x,
          y: 12 + ((s * 7 + n * 3) % 20),
          z: v.z,
          r: 5,
        })),
        wrecks.map((v) => ({ x: v.x, y: 5, z: v.z, r: 3.5 })),
        m,
      );
    }
    this.shown = {
      ...this.shown,
      teamGuns: ng,
      battery: nb,
      shells: landing.length,
      cars: cars.length,
    };
  }

  private buildCars(): VehicleLayer {
    const v = new VehicleLayer(
      this.stage,
      this.root,
      boxMesh(this.stage),
      cylinderMesh(this.stage, 0.5, 1, 10),
      coneMesh(this.stage, 0.5, 1, 6),
    );
    v.setup(this.colored);
    return v;
  }

  /**
   * The war about the town now (null: none), its flames and smoke moving by the screen's clock `s`;
   * and `camp`, the fires of a battle's hosts drawn up before it in place the night before (metres).
   */
  update(
    scene: TownWarScene | null,
    s: number,
    camp: readonly { readonly x: number; readonly z: number; readonly lamp?: boolean }[] = [],
    folk = 1,
  ): void {
    const tents = scene?.tents ?? [],
      fires = scene?.fires ?? [],
      nt = Math.min(MOST_TENTS, tents.length),
      nf = Math.min(MOST_FIRES, fires.length),
      // (The hosts' fires the night before a battle before it: drawn up about the town, or in place.)
      lines = [...(scene?.camp ?? []), ...camp],
      nc = Math.min(MOST_CAMP, lines.length);
    this.shown = { ...this.shown, tents: nt, fires: nf, camp: nc };
    this.works.update(scene?.works ?? null, (folk * FOLK_METRE) / M);
    this.past(scene, s, folk);
    this.tents.set(nt, (i, out) => {
      const t = tents[i]!;
      out[0] = t.x * M;
      out[1] = 0.32 * folk;
      out[2] = t.z * M;
      out[3] = 0.95 * folk;
      out[4] = 0.64 * folk;
      out[5] = 0.95 * folk;
      out[6] = t.yaw + Math.PI / 4;
    });
    // (A fire before every third tent; then the hosts' fires.)
    const byTents = Math.ceil(nt / 3);
    this.carriers(scene, folk);
    // (Its light on the ground about it, breathing with the flame.)
    this.glows.set(nc, (j, out) => {
      const c = lines[j]!,
        r = (c.lamp ? 0.7 : 1.1) * (0.92 + 0.08 * Math.sin(s * 7 + j * 1.3)) * folk;
      out[0] = c.x * M;
      out[1] = 0.012;
      out[2] = c.z * M;
      out[3] = r;
      out[4] = 0.004;
      out[5] = r;
      out[6] = 0;
    });
    this.campFires.set(byTents + nc, (j, out) => {
      if (j >= byTents) {
        const c = lines[j - byTents]!,
          flick = 0.85 + 0.15 * Math.sin(s * 9 + j * 2.1);
        const k = (c.lamp ? 0.45 : 1) * folk;
        out[0] = c.x * M;
        out[1] = 0.1 * flick * k;
        out[2] = c.z * M;
        out[3] = 0.16 * k;
        out[4] = 0.22 * flick * k;
        out[5] = 0.16 * k;
        out[6] = s * 2 + j;
        return;
      }
      const t = tents[j * 3]!,
        a = Math.atan2(t.z, t.x),
        flick = 0.85 + 0.15 * Math.sin(s * 9 + j * 2.1);
      out[0] = (t.x - Math.cos(a) * 9 * folk) * M;
      out[1] = 0.1 * flick * folk;
      out[2] = (t.z - Math.sin(a) * 9 * folk) * M;
      out[3] = 0.16 * folk;
      out[4] = 0.22 * flick * folk;
      out[5] = 0.16 * folk;
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
    for (const b of [
      this.tents,
      this.campFires,
      this.glows,
      this.plate,
      this.wheels,
      ...this.bands,
      this.flames,
      this.smoke,
      this.teamGuns,
      this.battery,
      this.flashes,
      this.bursts,
      this.dirt,
    ])
      b.destroy();
  }
}
