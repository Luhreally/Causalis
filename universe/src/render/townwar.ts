// A town's war drawn about it (Phase 40 M204): the besiegers' tents ringing it and their camp's
// fires, and its houses burning when it is stormed — flames and the smoke over them; the hosts'
// fires the night before a battle before it (Phase 55 M227). Its soldiers
// are the village's own figures in their sides' colours (render/village.ts). Units as the
// village's: a tenth of a unit to the metre; tents and flames sized to its folk, drawn three times
// a person's size.
import * as pc from "playcanvas";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import { VehicleLayer } from "./vehicles.ts";
import type { TownWarScene } from "../view/index.ts";

const M = 0.1;
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
/** Units to a true metre of what stands among its folk, who are drawn three times a person's size. */
const FOLK_METRE = 0.55 / 1.75;

export class TownWarLayer {
  /** Its own entity, kept as the village is laid out again. */
  readonly root = new pc.Entity("town-war");
  private readonly tents: InstancedBatch;
  private readonly campFires: InstancedBatch;
  private readonly flames: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly teamGuns: InstancedBatch;
  private readonly battery: InstancedBatch;
  private readonly flashes: InstancedBatch;
  private readonly bursts: InstancedBatch;
  private readonly dirt: InstancedBatch;
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
  }

  /** Each side's colour, for its cars' paint. */
  colors(a: Rgb, d: Rgb): void {
    if (this.colored[0] === a && this.colored[1] === d) return;
    this.colored = [a, d];
    this.vehicles?.setup(this.colored);
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
          .filter((_, n) => Math.sin(s * 1.9 + n * 1.7) > 0.93)
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
    camp: readonly { readonly x: number; readonly z: number }[] = [],
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
    this.past(scene, s, folk);
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
    // (A fire before every third tent; then the hosts' fires.)
    const byTents = Math.ceil(nt / 3);
    this.campFires.set(byTents + nc, (j, out) => {
      if (j >= byTents) {
        const c = lines[j - byTents]!,
          flick = 0.85 + 0.15 * Math.sin(s * 9 + j * 2.1);
        out[0] = c.x * M;
        out[1] = 0.1 * flick;
        out[2] = c.z * M;
        out[3] = 0.16;
        out[4] = 0.22 * flick;
        out[5] = 0.16;
        out[6] = s * 2 + j;
        return;
      }
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
    for (const b of [
      this.tents,
      this.campFires,
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
