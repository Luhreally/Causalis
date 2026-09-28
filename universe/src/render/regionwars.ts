// Wars in a land (Phase 10 M95, Phase 12 M110): the globe's hosts seen closer. Each host a
// column in ranks under its realm's banners, as many as the men it fields, and each of them as
// its host's design has it — on foot, on horseback or in chariots; with spears, swords, axes or
// bows; shields on their arms in their side's colour — marching in from the map's edge to what
// it wants, or out from its land toward the front, and over the sea in ships under its colours,
// as the globe shows it; the defenders in a block at what they hold; each battle fought here
// lately (as the globe shows it), its two hosts in lines face to face, crossed blades over a
// flare that pulses, the larger the more fell; a seat under siege ringed by its besiegers'
// tents behind a palisade, their fires burning; and by the seat of a realm at peace, its
// garrison under its banner. Instanced; the march plays over as the war lasts, as on the globe.
import * as pc from "playcanvas";
import type { HostKinds } from "../bridge/index.ts";
import { counterWords, holdShape, landColumn, landShape, type LandWars } from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, keptMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";

/** How long a host's march across the land takes on the screen (seconds). */
const LAND_MARCH = 16;
/** The most figures of one side drawn at once, the most ships of all sides, and the most of one kind of gear. */
const MOST = 240,
  MOST_SHIPS = 96,
  MOST_GEAR = 720;

type Flat = { readonly x: number; readonly z: number };

/**
 * A host's head, a defenders' block, a battle, a camp or a garrison: where it stands, its page
 * and name, and a host's realm and the men it fields (for its counter).
 */
type Mark = {
  x: number;
  z: number;
  ref: string;
  name: string;
  battle: boolean;
  realm?: string;
  fields?: number;
};

/** How one is carried to war, what they strike with, and whether they bear a shield. */
type Kit = { ride: "foot" | "horse" | "chariot"; arm: string; shield: boolean };

/** A figure: where it stands, which way it faces (yaw), how tall it is drawn (0 … 1: grown in), its kit. */
type Figure = {
  x: number;
  z: number;
  yaw: number;
  size: number;
  lead: boolean;
  side: number;
  kit: Kit;
};

/** A host's design as the figures of its column carry it (on foot with spears, where it has none). */
function kitOf(host: HostKinds | null | undefined): Kit {
  const mount = host?.mount ?? "foot";
  return {
    ride:
      mount === "chariot" ? "chariot" : mount === "horse" || mount === "cavalry" ? "horse" : "foot",
    arm: host?.arm ?? "spear",
    shield: host?.guard === "shield",
  };
}

/** How much higher a rider sits (on a horse), or one stands (in a chariot). */
function seatOf(f: Figure): number {
  return f.kit.ride === "horse" ? 0.72 : f.kit.ride === "chariot" ? 0.42 : 0;
}

export class RegionWars {
  readonly root = new pc.Entity("region-wars");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly tent: pc.Mesh;
  private land: LandWars | null = null;
  private colorKey = "";
  private height: (x: number, z: number) => number = () => 0;
  private sea: (x: number, z: number) => boolean = () => false;
  private sides: InstancedBatch[] = [];
  private flags: InstancedBatch[] = [];
  private tents: InstancedBatch[] = [];
  private readonly heads: InstancedBatch;
  private readonly poles: InstancedBatch;
  private readonly blades: InstancedBatch;
  private readonly flares: InstancedBatch;
  private readonly hulls: InstancedBatch;
  /** Horses (a body and a neck), and chariots' carts and wheels. */
  private readonly horses: InstancedBatch;
  private readonly necks: InstancedBatch;
  private readonly carts: InstancedBatch;
  /** Arms: spear shafts and bows of wood, spearheads and blades of steel. */
  private readonly shafts: InstancedBatch;
  private readonly steel: InstancedBatch;
  private readonly bows: InstancedBatch;
  /** A camp's palisade and its fires. */
  private readonly stakes: InstancedBatch;
  private readonly fires: InstancedBatch;
  /** The shields to draw with the banners (their colours share the banners' batches). */
  private shields: Figure[] = [];
  /**
   * Where each host's head, each defenders' block, each battle, camp and garrison stood at the
   * last update (for picking and naming): a host's with its realm and the men it fields, for
   * its counter.
   */
  private marks: Mark[] = [];
  /** How many figures were drawn at the last update (for the look tools). */
  drawn = 0;
  /** What was drawn at the last update, by kind (for the look tools and the gate). */
  counts = {
    riders: 0,
    chariots: 0,
    spears: 0,
    bows: 0,
    shields: 0,
    banners: 0,
    tents: 0,
    garrison: 0,
  };

  /** The hosts and battles shown (for the look tools). */
  get shown(): {
    marches: number;
    battles: number;
    ships: number;
    camps: number;
    garrisons: number;
  } {
    return {
      marches: this.land?.marches.length ?? 0,
      battles: this.land?.battles.length ?? 0,
      ships: this.afloat,
      camps: this.land?.camps.length ?? 0,
      garrisons: this.land?.garrisons.length ?? 0,
    };
  }
  /** How many ships were drawn at the last update. */
  private afloat = 0;

  constructor(stage: Stage) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    this.tent = keptMesh(coneMesh(stage, 0.5, 1, 4));
    const make = (color: readonly [number, number, number], n: number) =>
      new InstancedBatch(stage, this.box, color, n, this.root);
    this.heads = make([0.9, 0.72, 0.56], MOST * 2);
    this.poles = make([0.42, 0.3, 0.18], 160);
    this.blades = make([0.86, 0.88, 0.92], 64);
    this.flares = make([1, 0.78, 0.26], 32);
    this.hulls = make([0.34, 0.22, 0.12], MOST_SHIPS);
    this.horses = make([0.44, 0.28, 0.16], MOST_GEAR);
    this.necks = make([0.36, 0.22, 0.12], MOST_GEAR);
    this.carts = make([0.3, 0.2, 0.1], MOST_GEAR);
    this.shafts = make([0.5, 0.36, 0.2], MOST_GEAR);
    this.steel = make([0.78, 0.8, 0.84], MOST_GEAR);
    this.bows = make([0.38, 0.24, 0.1], MOST_GEAR);
    this.stakes = make([0.4, 0.28, 0.16], 256);
    this.fires = make([1, 0.52, 0.12], 32);
    stage.root.addChild(this.root);
    this.root.enabled = false;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** The wars in the land now shown, the height of its ground at a point, and whether it is sea. */
  set(
    land: LandWars | null,
    height: (x: number, z: number) => number,
    sea: (x: number, z: number) => boolean = () => false,
  ): void {
    this.land = land;
    this.height = height;
    this.sea = sea;
    const colors = land?.colors ?? [],
      key = JSON.stringify(colors);
    // (The same colours as before: the same batches, not made anew each year.)
    if (key === this.colorKey) return;
    this.colorKey = key;
    for (const b of [...this.sides, ...this.flags, ...this.tents]) b.destroy();
    this.sides = colors.map((c) => new InstancedBatch(this.stage, this.box, c, MOST, this.root));
    // (Banners and shields a little brighter than their bearers.)
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
          // (Their banners, their shields and the sails of their ships.)
          MOST * 2,
          this.root,
        ),
    );
    this.tents = colors.map((c) => new InstancedBatch(this.stage, this.tent, c, 64, this.root));
  }

  /** Put every host, battle, camp and garrison where it is at screen time `s` (seconds). */
  update(s: number): void {
    const land = this.land;
    if (!land || !this.root.enabled) return;
    const figures: Figure[] = [],
      banners: { at: Flat; yaw: number; side: number; size: number }[] = [],
      ships: { at: Flat; yaw: number; side: number; size: number }[] = [],
      marks: Mark[] = [];
    land.marches.forEach((m, n) => {
      const dx = m.to.x - m.from.x,
        dz = m.to.z - m.from.z,
        len = Math.hypot(dx, dz) || 1,
        ux = dx / len,
        uz = dz / len,
        // The column: in ranks as the men it fields, its banners over its head and every third
        // rank; over the sea, in ships.
        col = landColumn(
          m.from,
          m.to,
          (s / LAND_MARCH + n * 0.37) % 1,
          this.sea,
          landShape(m.attacker.fields),
        ),
        yaw = col.yaw,
        kit = kitOf(m.hosts.attacker);
      for (const f of col.people) {
        figures.push({ x: f.x, z: f.z, yaw, size: f.size, lead: f.lead, side: m.side, kit });
        if (f.banner) banners.push({ at: f, yaw, side: m.side, size: f.size });
      }
      for (const f of col.ships) ships.push({ at: f, yaw, side: m.side, size: f.size });
      if (col.head)
        marks.push({
          ...col.head,
          ref: m.ref,
          name: `${col.afloat ? "⛵" : "🚩"} ${m.name}`,
          battle: false,
          realm: m.attacker.ref,
          fields: m.attacker.fields,
        });
      // The defenders, in a block before what they hold, facing the way the host comes: as
      // many ranks as the men they field.
      if (m.held) {
        const hold = holdShape(m.defender.fields),
          files = hold.files + 2,
          dkit = kitOf(m.hosts.defender);
        for (let k = 0; k < files * hold.ranks; k++) {
          const row = Math.floor(k / files),
            c = (k % files) - (files - 1) / 2;
          figures.push({
            x: m.to.x - ux * (1.4 + row * 0.9) + -uz * c * 0.9,
            z: m.to.z - uz * (1.4 + row * 0.9) + ux * c * 0.9,
            yaw: yaw + Math.PI,
            size: 1,
            lead: k === Math.floor(files / 2),
            side: m.foe,
            kit: dkit,
          });
        }
        banners.push({
          at: { x: m.to.x - ux * 1.4, z: m.to.z - uz * 1.4 },
          yaw: yaw + Math.PI,
          side: m.foe,
          size: 1,
        });
        marks.push({
          x: m.to.x - ux * 1.4,
          z: m.to.z - uz * 1.4,
          ref: m.ref,
          name: m.name,
          battle: false,
          realm: m.defender.ref,
          fields: m.defender.fields,
        });
      }
    });
    // Battles: two lines face to face, closing and falling back as they fight.
    const clashes: { at: Flat; size: number; pulse: number }[] = [];
    land.battles.forEach((b, n) => {
      const fresh = b.age === 0 ? 1 : b.age === 1 ? 0.7 : 0.45,
        count = Math.round(4 + 6 * b.size * fresh),
        sway = Math.sin(s * 2.2 + n) * 0.25;
      for (const [side, dir, host] of [
        [b.side, -1, b.hosts.attacker],
        [b.foe, 1, b.hosts.defender],
      ] as const) {
        const kit = kitOf(host);
        for (let k = 0; k < count; k++) {
          const across = (k - (count - 1) / 2) * 0.8,
            gap = 0.9 + (dir > 0 ? sway : -sway) + (k % 2) * 0.5;
          figures.push({
            x: b.at.x + across,
            // (Riders need the more room.)
            z: b.at.z + dir * gap * (kit.ride === "foot" ? 1 : 1.4),
            yaw: dir > 0 ? Math.PI : 0,
            size: 1,
            lead: k === Math.floor(count / 2),
            side,
            kit,
          });
        }
      }
      clashes.push({
        at: b.at,
        size: (1.4 + 2.6 * b.size) * fresh,
        pulse: 0.75 + 0.25 * Math.sin(s * 5 + n * 1.7),
      });
      marks.push({ x: b.at.x, z: b.at.z, ref: b.event, name: `⚔️ ${b.name}`, battle: true });
    });
    // The camps about a seat under siege: tents in a ring behind a palisade, fires among them.
    const tents: { at: Flat; side: number; yaw: number }[] = [],
      stakes: Flat[] = [],
      fires: Flat[] = [];
    for (const c of land.camps) {
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI * 2) / 10;
        tents.push({
          at: { x: c.at.x + Math.cos(a) * 3.4, z: c.at.z + Math.sin(a) * 3.4 },
          side: c.side,
          yaw: a,
        });
      }
      for (let i = 0; i < 28; i++) {
        const a = (i * Math.PI * 2) / 28;
        stakes.push({ x: c.at.x + Math.cos(a) * 4.6, z: c.at.z + Math.sin(a) * 4.6 });
      }
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3 + 0.5;
        fires.push({ x: c.at.x + Math.cos(a) * 2.3, z: c.at.z + Math.sin(a) * 2.3 });
      }
      banners.push({ at: { x: c.at.x + 3.4, z: c.at.z }, yaw: 0, side: c.side, size: 1.2 });
      marks.push({ x: c.at.x, z: c.at.z, ref: c.war, name: c.name, battle: false });
    }
    // A garrison by the seat of a realm at peace: two ranks under its banner.
    let garrisoned = 0;
    for (const g of land.garrisons) {
      const kit = kitOf(g.host),
        files = g.men >= 20000 ? 5 : 3;
      for (let k = 0; k < files * 2; k++) {
        const row = Math.floor(k / files),
          c = (k % files) - (files - 1) / 2;
        figures.push({
          x: g.at.x + 2.6 + c * 0.9,
          z: g.at.z + 2.2 + row * 0.9,
          yaw: 0,
          size: 1,
          lead: k === Math.floor(files / 2),
          side: g.side,
          kit,
        });
        garrisoned++;
      }
      banners.push({ at: { x: g.at.x + 2.6, z: g.at.z + 1.6 }, yaw: 0, side: g.side, size: 1 });
      marks.push({ x: g.at.x + 2.6, z: g.at.z + 2.6, ref: g.realm, name: g.name, battle: false });
    }
    this.marks = marks;
    this.drawFigures(figures, s);
    this.drawBanners(ships, banners, s);
    // The tents in their side's colours; the palisade; the fires, flickering.
    this.tents.forEach((batch, side) => {
      const mine = tents.filter((t) => t.side === side);
      batch.set(mine.length, (i, out) => {
        const t = mine[i]!;
        out[0] = t.at.x;
        out[1] = this.height(t.at.x, t.at.z) + 0.55;
        out[2] = t.at.z;
        out[3] = 1.3;
        out[4] = 1.1;
        out[5] = 1.3;
        out[6] = t.yaw;
      });
    });
    this.stakes.set(stakes.length, (i, out) => {
      const p = stakes[i]!;
      out[0] = p.x;
      out[1] = this.height(p.x, p.z) + 0.45;
      out[2] = p.z;
      out[3] = out[5] = 0.14;
      out[4] = 0.9;
    });
    this.fires.set(fires.length, (i, out) => {
      const p = fires[i]!,
        flick = 0.7 + 0.4 * Math.abs(Math.sin(s * 8 + i * 2.1));
      out[0] = p.x;
      out[1] = this.height(p.x, p.z) + 0.2 * flick;
      out[2] = p.z;
      out[3] = out[5] = 0.3;
      out[4] = 0.4 * flick;
      out[6] = s * 2;
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
    this.counts.tents = tents.length;
    this.counts.garrison = garrisoned;
    this.counts.banners = banners.length;
  }

  /** Every figure: its body in its side's colour and its head, its mount, its arms. */
  private drawFigures(figures: Figure[], s: number): void {
    const bySide = new Map<number, Figure[]>();
    for (const f of figures) {
      let list = bySide.get(f.side);
      if (!list) bySide.set(f.side, (list = []));
      if (list.length < MOST) list.push(f);
    }
    const shown = [...bySide.values()].flat(),
      tall = (f: Figure) => (f.lead ? 0.95 : 0.75) * f.size,
      ground = (f: Figure) => this.height(f.x, f.z),
      // A point beside a figure: `right` of it and `ahead` before it.
      beside = (f: Figure, right: number, ahead: number): Flat => ({
        x: f.x + Math.cos(f.yaw) * right + Math.sin(f.yaw) * ahead,
        z: f.z - Math.sin(f.yaw) * right + Math.cos(f.yaw) * ahead,
      });
    this.sides.forEach((batch, side) => {
      const mine = bySide.get(side) ?? [];
      batch.set(mine.length, (i, out) => {
        const f = mine[i]!,
          h = tall(f);
        out[0] = f.x;
        out[1] = ground(f) + seatOf(f) * f.size + h / 2;
        out[2] = f.z;
        out[3] = 0.42 * f.size;
        out[4] = h;
        out[5] = 0.3 * f.size;
        out[6] = f.yaw;
      });
    });
    this.heads.set(shown.length, (i, out) => {
      const f = shown[i]!,
        h = tall(f),
        r = 0.3 * f.size;
      out[0] = f.x;
      out[1] = ground(f) + seatOf(f) * f.size + h + r / 2;
      out[2] = f.z;
      out[3] = out[4] = out[5] = r;
      out[6] = f.yaw;
    });
    // Horses under the riders, and before the chariots; the chariots' carts behind them.
    const mounted = shown.filter((f) => f.kit.ride !== "foot"),
      horseAt = (f: Figure): Flat => (f.kit.ride === "chariot" ? beside(f, 0, 0.95 * f.size) : f);
    this.horses.set(mounted.length, (i, out) => {
      const f = mounted[i]!,
        p = horseAt(f),
        stride = Math.sin(s * 7 + i) * 0.04;
      out[0] = p.x;
      out[1] = ground(f) + (0.5 + stride) * f.size;
      out[2] = p.z;
      out[3] = 0.34 * f.size;
      out[4] = 0.42 * f.size;
      out[5] = 1.05 * f.size;
      out[6] = f.yaw;
    });
    this.necks.set(mounted.length, (i, out) => {
      const f = mounted[i]!,
        p = horseAt(f),
        head = beside({ ...f, x: p.x, z: p.z }, 0, 0.55 * f.size);
      out[0] = head.x;
      out[1] = ground(f) + 0.85 * f.size;
      out[2] = head.z;
      out[3] = 0.2 * f.size;
      out[4] = 0.5 * f.size;
      out[5] = 0.28 * f.size;
      out[6] = f.yaw;
      out[7] = 0.5;
    });
    const chariots = shown.filter((f) => f.kit.ride === "chariot");
    this.carts.set(chariots.length * 3, (i, out) => {
      const f = chariots[Math.floor(i / 3)]!,
        part = i % 3;
      if (part === 0) {
        // The cart, the one in it standing.
        out[0] = f.x;
        out[1] = ground(f) + 0.3 * f.size;
        out[2] = f.z;
        out[3] = 0.8 * f.size;
        out[4] = 0.32 * f.size;
        out[5] = 0.7 * f.size;
        out[6] = f.yaw;
        return;
      }
      // Its wheels, one at each side.
      const w = beside(f, (part === 1 ? -0.46 : 0.46) * f.size, 0);
      out[0] = w.x;
      out[1] = ground(f) + 0.28 * f.size;
      out[2] = w.z;
      out[3] = 0.08 * f.size;
      out[4] = 0.56 * f.size;
      out[5] = 0.56 * f.size;
      out[6] = f.yaw;
    });
    // Arms: a spear upright at the right hand, its head of steel; a blade at the hip; a bow (or
    // a club) in the left hand.
    const spears = shown.filter((f) => f.kit.arm === "spear"),
      blades = shown.filter((f) => f.kit.arm === "sword" || f.kit.arm === "axe"),
      bows = shown.filter(
        (f) => f.kit.arm === "bow" || f.kit.arm === "horn-bow" || f.kit.arm === "club",
      );
    this.shafts.set(spears.length, (i, out) => {
      const f = spears[i]!,
        p = beside(f, 0.3 * f.size, 0.05);
      out[0] = p.x;
      out[1] = ground(f) + seatOf(f) * f.size + 0.85 * f.size;
      out[2] = p.z;
      out[3] = out[5] = 0.05 * f.size;
      out[4] = 1.7 * f.size;
      out[6] = f.yaw;
    });
    this.steel.set(spears.length + blades.length, (i, out) => {
      if (i < spears.length) {
        const f = spears[i]!,
          p = beside(f, 0.3 * f.size, 0.05);
        out[0] = p.x;
        out[1] = ground(f) + seatOf(f) * f.size + 1.78 * f.size;
        out[2] = p.z;
        out[3] = out[5] = 0.09 * f.size;
        out[4] = 0.22 * f.size;
        out[6] = f.yaw;
        return;
      }
      const f = blades[i - spears.length]!,
        p = beside(f, 0.3 * f.size, 0.12);
      out[0] = p.x;
      out[1] = ground(f) + seatOf(f) * f.size + 0.45 * f.size;
      out[2] = p.z;
      out[3] = 0.06 * f.size;
      out[4] = (f.kit.arm === "axe" ? 0.4 : 0.55) * f.size;
      out[5] = (f.kit.arm === "axe" ? 0.2 : 0.1) * f.size;
      out[6] = f.yaw;
      out[7] = 0.35;
    });
    this.bows.set(bows.length, (i, out) => {
      const f = bows[i]!,
        p = beside(f, -0.3 * f.size, 0.1);
      out[0] = p.x;
      out[1] = ground(f) + seatOf(f) * f.size + 0.55 * f.size;
      out[2] = p.z;
      out[3] = 0.05 * f.size;
      out[4] = (f.kit.arm === "club" ? 0.5 : 0.95) * f.size;
      out[5] = 0.08 * f.size;
      out[6] = f.yaw;
      out[7] = f.kit.arm === "club" ? 0.6 : 0.15;
    });
    // (Shields on the left arm are drawn with the banners, in their colours.)
    this.shields = shown.filter((f) => f.kit.shield);
    this.drawn = shown.length;
    this.counts.riders = mounted.length - chariots.length;
    this.counts.chariots = chariots.length;
    this.counts.spears = spears.length;
    this.counts.bows = bows.filter((f) => f.kit.arm !== "club").length;
    this.counts.shields = this.shields.length;
  }

  /** The ships on the swell, the banners and the ships' masts, and the shields (in the banners' batches). */
  private drawBanners(
    ships: { at: Flat; yaw: number; side: number; size: number }[],
    banners: { at: Flat; yaw: number; side: number; size: number }[],
    s: number,
  ): void {
    const afloat = ships.slice(0, MOST_SHIPS),
      bob = (i: number) => Math.sin(s * 1.7 + i * 1.3) * 0.05;
    this.afloat = afloat.length;
    this.hulls.set(afloat.length, (i, out) => {
      const f = afloat[i]!;
      out[0] = f.at.x;
      out[1] = 0.16 * f.size + bob(i);
      out[2] = f.at.z;
      out[3] = 0.8 * f.size;
      out[4] = 0.32 * f.size;
      out[5] = 1.9 * f.size;
      out[6] = f.yaw;
      out[7] = Math.sin(s * 1.3 + i) * 0.05;
    });
    this.poles.set(banners.length + afloat.length, (i, out) => {
      if (i >= banners.length) {
        const f = afloat[i - banners.length]!;
        out[0] = f.at.x;
        out[1] = 1.2 * f.size + bob(i - banners.length);
        out[2] = f.at.z;
        out[3] = out[5] = 0.07;
        out[4] = 2 * f.size;
        out[6] = f.yaw;
        return;
      }
      const b = banners[i]!;
      out[0] = b.at.x;
      out[1] = this.height(b.at.x, b.at.z) + 1.1 * b.size;
      out[2] = b.at.z;
      out[3] = out[5] = 0.07;
      out[4] = 2.2 * b.size;
      out[6] = b.yaw;
    });
    this.flags.forEach((batch, side) => {
      const mine = banners.filter((b) => b.side === side),
        sails = afloat.map((f, i) => ({ f, i })).filter(({ f }) => f.side === side),
        shields = this.shields.filter((f) => f.side === side);
      batch.set(mine.length + sails.length + shields.length, (i, out) => {
        if (i >= mine.length + sails.length) {
          // A shield on the left arm, square to the way they face.
          const f = shields[i - mine.length - sails.length]!,
            right = -0.3 * f.size,
            ahead = 0.14;
          out[0] = f.x + Math.cos(f.yaw) * right + Math.sin(f.yaw) * ahead;
          out[1] = this.height(f.x, f.z) + seatOf(f) * f.size + 0.42 * f.size;
          out[2] = f.z - Math.sin(f.yaw) * right + Math.cos(f.yaw) * ahead;
          out[3] = 0.42 * f.size;
          out[4] = 0.5 * f.size;
          out[5] = 0.07;
          out[6] = f.yaw;
          return;
        }
        if (i >= mine.length) {
          // (Across the hull, filled by the wind.)
          const { f, i: k } = sails[i - mine.length]!;
          out[0] = f.at.x;
          out[1] = 1.35 * f.size + bob(k);
          out[2] = f.at.z;
          out[3] = 1.3 * f.size;
          out[4] = 1.1 * f.size;
          out[5] = 0.08;
          out[6] = f.yaw;
          out[7] = -0.12;
          return;
        }
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
  }

  /**
   * Where each battle's name and each host's counter stands on the screen (CSS pixels), a
   * battle first: a host's counter bears its realm's arms and the men it fields (Phase 11 M101;
   * its name is told on a hover, as its war).
   */
  labels(): {
    key: string;
    text: string;
    at: { x: number; y: number } | null;
    priority: number;
    badge?: { realm: string; war: string };
  }[] {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      out = new pc.Vec3();
    return this.marks.map((m) => {
      at.set(m.x, this.height(m.x, m.z) + 3, m.z);
      cam.worldToScreen(at, out);
      const where = out.z > 0 ? { x: out.x, y: out.y } : null;
      return m.realm
        ? {
            key: `${m.ref}:${m.realm}`,
            text: counterWords(m.fields ?? 0),
            at: where,
            priority: 1.5e9,
            badge: { realm: m.realm, war: m.ref },
          }
        : // (Named before the towns about it.)
          { key: m.ref, text: m.name, at: where, priority: m.battle ? 2e9 : 1e9 };
    });
  }

  /** Where each host, battle, camp and garrison stood at the last update (for the look tools). */
  places(): { ref: string; name: string; x: number; z: number }[] {
    return this.marks.map((m) => ({ ref: m.ref, name: m.name, x: m.x, z: m.z }));
  }

  /** The host, battle, camp or garrison nearest a screen point, within `reach` (a finger's), its ref; or null. */
  pick(x: number, y: number, reach = 28): string | null {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      out = new pc.Vec3();
    let best: string | null = null,
      bestD = reach;
    for (const m of this.marks)
      // (At the mark, or at its name over it: either is it.)
      for (const lift of [0.8, 3]) {
        at.set(m.x, this.height(m.x, m.z) + lift, m.z);
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
