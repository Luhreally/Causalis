// Wars in a land (Phase 10 M95, Phase 12 M110): the globe's hosts seen closer. Each host a
// column in ranks under its realm's banners, as many as the men it fields, and each of them as
// its host's design has it — on foot, on horseback, in chariots, or with armoured cars among
// them (Phase 53); with spears, swords, axes or bows; shields on their arms in their side's
// colour — marching in from the map's edge to what it wants, or out from its land toward the
// front, and over the sea in ships under its colours, as the globe shows it; the defenders in a
// block at what they hold; each battle fought here lately (as the globe shows it), its two hosts
// in lines face to face, crossed blades over a flare that pulses, the larger the more fell; a seat
// under siege ringed by its besiegers' tents behind a palisade, their fires burning; and by the
// seat of a realm at peace, its garrison under its banner. Instanced. Since Phase 40 (M203) each
// war's hosts are where its year has them on the world's clock (view/warplay.ts): mustering,
// marching by the roads, drawn up, engaged at the year's turn, routed, entering a land taken,
// camped about a seat and storming it, going home; a land's battles' fallen lie on their fields.
import * as pc from "playcanvas";
import type { HostKinds, WarsMap } from "../bridge/index.ts";
import {
  DOING_ICON,
  armorColor,
  counterWords,
  isGun,
  landBattle,
  landInPlace,
  type LandPlay,
  type LandPlayNow,
  type LandWars,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

/** The most figures of one side drawn at once, the most ships of all sides, and the most of one kind of gear. */
const MOST = 240,
  MOST_SHIPS = 96,
  MOST_GEAR = 720,
  /** The most armoured cars drawn at once: a car's pieces fit the gear's batches (Phase 53). */
  MOST_CARS = MOST_GEAR / 4;
/** A head's colour where the people have no look of their own (Earth's upright apes). */
const SKIN: Rgb = [0.9, 0.72, 0.56];
/** A car's gun and wheels. */
const DARK: Rgb = [0.07, 0.07, 0.07];

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
  /** A host's doing's sign before its counter, and the realm it fights (M203). */
  icon?: string;
  foe?: string;
  /** Its own key among the labels (a host's, M203), and whether a fight now (named before all). */
  key?: string;
  fight?: boolean;
};

/**
 * How one is carried to war, what they strike with, and whether they bear a shield. An armoured
 * host's men go on foot; its cars come among them.
 */
type Kit = {
  ride: "foot" | "horse" | "chariot" | "armoured";
  arm: string;
  shield: boolean;
  guard: string;
};

/** A figure: where it stands, which way it faces (yaw), how tall it is drawn (0 … 1: grown in), its kit. */
type Figure = {
  x: number;
  z: number;
  yaw: number;
  size: number;
  lead: boolean;
  side: number;
  kit: Kit;
  /** Fallen in a battle: laid on the ground, its mount and arms gone from it. */
  fallen?: boolean;
  /** An armoured car, drawn in place of its man (Phase 53). Left out for the others. */
  car?: true;
};

/** A host's design as the figures of its column carry it (on foot with spears, where it has none). */
function kitOf(host: HostKinds | null | undefined): Kit {
  const mount = host?.mount ?? "foot";
  return {
    ride:
      mount === "chariot"
        ? "chariot"
        : mount === "horse" || mount === "cavalry"
          ? "horse"
          : mount === "armoured"
            ? "armoured"
            : "foot",
    arm: host?.arm ?? "spear",
    shield: host?.guard === "shield",
    guard: host?.guard ?? "",
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
  private readonly armor: { guard: string; batch: InstancedBatch }[];
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
  /**
   * The armoured cars: each side's hulls, upper decks and turrets (in set()); the wrecks' charred
   * pieces; the guns and wheels.
   */
  private carBodies: InstancedBatch[] = [];
  private readonly carWrecks: InstancedBatch;
  private readonly carGuns: InstancedBatch;
  private readonly carWheels: InstancedBatch;
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
    cars: 0,
    spears: 0,
    guns: 0,
    bows: 0,
    shields: 0,
    banners: 0,
    tents: 0,
    garrison: 0,
    fought: 0,
    fallen: 0,
  };

  /** The hosts and battles shown (for the look tools). */
  get shown(): {
    marches: number;
    battles: number;
    ships: number;
    camps: number;
    garrisons: number;
    fights: number;
  } {
    return {
      // (Each war's hosts drawn where their year has them, M203.)
      marches: this.now ? this.now.marks.length : (this.land?.marches.length ?? 0),
      battles: this.land?.battles.length ?? 0,
      ships: this.afloat,
      camps: this.now ? this.now.camps.length : (this.land?.camps.length ?? 0),
      garrisons: this.land?.garrisons.length ?? 0,
      fights: this.now?.fights.length ?? 0,
    };
  }
  /** How many ships were drawn at the last update. */
  private afloat = 0;
  /** The wars in place (M203): the map they are of, and what they are played on (its colours aside). */
  private play: { map: WarsMap; play: Omit<LandPlay, "colorOf"> } | null = null;
  /** The wars in place at the last update (for the look tools and the clock). */
  now: LandPlayNow | null = null;

  /** The wars of a map played in place on a land (M203), or none. */
  inPlace(map: WarsMap | null, play: Omit<LandPlay, "colorOf"> | null): void {
    this.play = map && play ? { map, play } : null;
  }

  constructor(stage: Stage) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    this.tent = keptMesh(coneMesh(stage, 0.5, 1, 4));
    const make = (color: readonly [number, number, number], n: number) =>
      new InstancedBatch(stage, this.box, color, n, this.root);
    this.heads = make(SKIN, MOST * 2);
    this.armor = ["leather", "mail", "scale", "plate", "helmet"].map((guard) => ({
      guard,
      batch: make(armorColor(guard, ""), MOST_GEAR * 2),
    }));
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
    this.carWrecks = make([0.12, 0.11, 0.1], MOST_CARS * 3);
    this.carGuns = make(DARK, MOST_CARS);
    this.carWheels = make(DARK, MOST_CARS * 4);
    stage.root.addChild(this.root);
    this.root.enabled = false;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** Its soldiers' heads in their people's own hide (null: as Earth's upright apes'). */
  skin(c: Rgb | null): void {
    this.heads.recolor(c ?? SKIN);
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
    for (const b of [...this.sides, ...this.flags, ...this.tents, ...this.carBodies]) b.destroy();
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
    this.tents = colors.map((c) => new InstancedBatch(this.stage, this.tent, c, 96, this.root));
    // (A car's hull, upper deck and turret: its side's colour mixed half with drab olive.)
    this.carBodies = colors.map(
      (c) =>
        new InstancedBatch(
          this.stage,
          this.box,
          [(c[0] + 0.33) / 2, (c[1] + 0.36) / 2, (c[2] + 0.26) / 2],
          MOST_CARS * 3,
          this.root,
        ),
    );
  }

  /**
   * Put every host, battle, camp and garrison where it is at screen time `s` (seconds), the
   * world's year `y` (fractional): each war's hosts where its year has them (M203).
   */
  update(s: number, y = 0): void {
    const land = this.land;
    if (!land || !this.root.enabled) return;
    const figures: Figure[] = [],
      banners: { at: Flat; yaw: number; side: number; size: number }[] = [],
      ships: { at: Flat; yaw: number; side: number; size: number }[] = [],
      marks: Mark[] = [],
      colors = land.colors,
      colorOf = (c: readonly [number, number, number]) =>
        Math.max(
          0,
          colors.findIndex((k) => k[0] === c[0] && k[1] === c[1] && k[2] === c[2]),
        ),
      now = this.play ? landInPlace(this.play.map, y, { ...this.play.play, colorOf }, s) : null,
      wars = this.play?.map.wars ?? [];
    this.now = now;
    // Each war's hosts where its year has them: in column, drawn up, on the walls; over the sea in
    // ships (one for every four of a column afloat).
    let afloat = 0;
    // (Each host's men counted as they are made: in an armoured host every sixth is a car.)
    const counted = new Map<string, number>();
    for (const f of now?.figures ?? []) {
      const w = wars[f.war]!,
        kit = kitOf(f.side === 0 ? w.attacker.host : w.defender.host),
        host = `${f.war}:${f.side}`,
        k = counted.get(host) ?? 0;
      counted.set(host, k + 1);
      if (f.afloat && !f.fallen) {
        if (afloat++ % 4 === 0) ships.push({ at: f, yaw: f.yaw, side: f.color, size: f.size });
        continue;
      }
      const car = kit.ride === "armoured" && k % 6 === 3;
      figures.push({
        x: f.x,
        z: f.z,
        yaw: f.yaw,
        size: f.size,
        lead: f.lead,
        side: f.color,
        kit,
        ...(car ? { car: true as const } : {}),
        ...(f.fallen ? { fallen: true } : {}),
      });
      if (f.banner && !f.fallen && !car)
        banners.push({ at: f, yaw: f.yaw, side: f.color, size: f.size });
    }
    for (const m of now?.marks ?? []) {
      const w = wars[m.war]!;
      marks.push({
        x: m.x,
        z: m.z,
        ref: m.ref,
        name: m.name,
        battle: false,
        realm: m.realm,
        fields: m.men,
        icon: DOING_ICON[m.doing],
        foe: m.side === 0 ? w.defender.ref : w.attacker.ref,
        key: `${m.key}:${m.realm}`,
      });
    }
    // The battles fought here lately: their fallen lie on their fields (the living are the hosts,
    // where their war has them now).
    const clashes: { at: Flat; size: number; pulse: number }[] = [];
    let fought = 0,
      fell = 0;
    for (const f of now?.figures ?? [])
      if (f.fallen) {
        fought++;
        fell++;
      }
    land.battles.forEach((b, n) => {
      const at = now?.fields.get(b.event) ?? b.at,
        fresh = b.age === 0 ? 1 : b.age === 1 ? 0.7 : 0.45,
        each = Math.max(6, Math.min(18, Math.round(6 + 12 * b.size * fresh))),
        kits = [kitOf(b.hosts.attacker), kitOf(b.hosts.defender)] as const;
      // (Each side's soldiers counted as they are made: in an armoured host every sixth is a car.)
      const soldiers = [0, 0];
      for (const f of landBattle({ ...b, at, age: Math.max(1, b.age) }, each, s)) {
        const k = soldiers[f.side]!;
        soldiers[f.side] = k + 1;
        if (f.doing !== "fallen" && now) continue;
        figures.push({
          x: f.x,
          z: f.z,
          yaw: f.yaw,
          size: 1,
          lead: f.lead,
          side: f.side === 0 ? b.side : b.foe,
          kit: kits[f.side],
          fallen: f.doing === "fallen",
          ...(kits[f.side].ride === "armoured" && k % 6 === 3 ? { car: true as const } : {}),
        });
        fought++;
        if (f.doing === "fallen") fell++;
      }
      // (Its mark over the field, small: the fallen are the battle now.)
      clashes.push({
        at,
        size: (0.35 + 0.5 * b.size) * fresh,
        pulse: 0.75 + 0.25 * Math.sin(s * 5 + n * 1.7),
      });
      marks.push({ x: at.x, z: at.z, ref: b.event, name: `⚔️ ${b.name}`, battle: true });
    });
    // The fights the year ends in, as they are fought: a flare over the line, pulsing the harder
    // the nearer the turn; the line's figures are the hosts'.
    for (const f of now?.fights ?? []) {
      const hot = f.stage === "drawn" ? 0.25 : f.stage === "engaged" ? 0.6 + 0.4 * f.k : 1 - f.k;
      clashes.push({
        at: f,
        size: 0.35 + 0.65 * hot,
        pulse: 0.7 + 0.3 * Math.sin(s * (5 + 6 * hot)),
      });
      if (f.stage !== "drawn") fought += 2;
      marks.push({ x: f.x, z: f.z, ref: f.key, name: f.name, battle: false, fight: true });
    }
    // The camps about a seat under siege: tents in a ring behind a palisade, fires among them.
    const tents: { at: Flat; side: number; yaw: number }[] = [],
      stakes: Flat[] = [],
      fires: Flat[] = [];
    const camps = now
      ? now.camps.map((c) => ({ at: c, side: c.color, war: c.ref, name: c.name, r: c.r }))
      : land.camps.map((c) => ({ ...c, r: 3.4 }));
    for (const c of camps) {
      const r = c.r,
        many = Math.max(10, Math.round(r * 3));
      for (let i = 0; i < many; i++) {
        const a = (i * Math.PI * 2) / many;
        tents.push({
          at: { x: c.at.x + Math.cos(a) * r, z: c.at.z + Math.sin(a) * r },
          side: c.side,
          yaw: a,
        });
      }
      const ring = Math.max(28, Math.round(r * 8));
      for (let i = 0; i < ring; i++) {
        const a = (i * Math.PI * 2) / ring;
        stakes.push({ x: c.at.x + Math.cos(a) * (r + 1.2), z: c.at.z + Math.sin(a) * (r + 1.2) });
      }
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3 + 0.5;
        fires.push({ x: c.at.x + Math.cos(a) * (r - 1.1), z: c.at.z + Math.sin(a) * (r - 1.1) });
      }
      banners.push({ at: { x: c.at.x + r, z: c.at.z }, yaw: 0, side: c.side, size: 1.2 });
      marks.push({ x: c.at.x, z: c.at.z + r, ref: c.war, name: c.name, battle: false });
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
          ...(kit.ride === "armoured" && k % 6 === 3 ? { car: true as const } : {}),
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
      out[1] = this.height(c.at.x, c.at.z) + 3.4;
      out[2] = c.at.z;
      out[3] = out[4] = out[5] = k;
      out[6] = s;
    });
    this.blades.set(clashes.length * 2, (i, out) => {
      const c = clashes[i >> 1]!;
      out[0] = c.at.x;
      out[1] = this.height(c.at.x, c.at.z) + 3.5;
      out[2] = c.at.z;
      out[3] = 0.07;
      out[4] = 1.1 + c.size;
      out[5] = 0.09;
      out[6] = 0;
      out[7] = i % 2 ? 0.7 : -0.7;
    });
    this.counts.tents = tents.length;
    this.counts.garrison = garrisoned;
    this.counts.banners = banners.length;
    this.counts.fought = fought;
    this.counts.fallen = fell;
  }

  /** Every figure: its body in its side's colour and its head, its mount, its arms. */
  private drawFigures(figures: Figure[], s: number): void {
    const bySide = new Map<number, Figure[]>(),
      vehicles: Figure[] = [];
    for (const f of figures) {
      // (A car is drawn in place of its man, with its own batches below.)
      if (f.car) {
        if (vehicles.length < MOST_CARS) vehicles.push(f);
        continue;
      }
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
        if (f.fallen) {
          // (Laid along the ground, the way they faced.)
          out[0] = f.x;
          out[1] = ground(f) + 0.16;
          out[2] = f.z;
          out[3] = 0.42 * f.size;
          out[4] = h;
          out[5] = 0.3 * f.size;
          out[6] = f.yaw;
          out[7] = Math.PI / 2;
          return;
        }
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
      if (f.fallen) {
        const p = beside(f, 0, h / 2 + r / 2);
        out[0] = p.x;
        out[1] = ground(f) + 0.16;
        out[2] = p.z;
        out[3] = out[4] = out[5] = r;
        out[6] = f.yaw;
        return;
      }
      out[0] = f.x;
      out[1] = ground(f) + seatOf(f) * f.size + h + r / 2;
      out[2] = f.z;
      out[3] = out[4] = out[5] = r;
      out[6] = f.yaw;
    });
    // Coarse shells keep the host's actual guard visible at the regional level too.
    for (const { guard, batch } of this.armor) {
      const mine = shown.filter((f) => f.kit.guard === guard).slice(0, MOST_GEAR),
        pieces = guard === "leather" || guard === "helmet" ? 1 : 2;
      batch.set(mine.length * pieces, (i, out) => {
        const f = mine[Math.floor(i / pieces)]!,
          h = tall(f),
          helmet = guard === "helmet" || i % pieces === 1,
          up = helmet ? h + 0.22 * f.size : h * 0.68,
          p = f.fallen ? beside(f, 0, up - h / 2) : f;
        out[0] = p.x;
        out[1] = ground(f) + (f.fallen ? 0.16 : seatOf(f) * f.size + up);
        out[2] = p.z;
        out[3] = (helmet ? 0.34 : 0.47) * f.size;
        out[4] = helmet ? 0.19 * f.size : 0.68 * h;
        out[5] = (helmet ? 0.34 : 0.35) * f.size;
        out[6] = f.yaw;
        out[7] = f.fallen ? Math.PI / 2 : 0;
      });
    }
    // (The fallen have lost their mounts and let fall their arms.)
    const standing = shown.filter((f) => !f.fallen);
    // Horses under the riders, and before the chariots; the chariots' carts behind them.
    const mounted = standing.filter((f) => f.kit.ride === "horse" || f.kit.ride === "chariot"),
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
    const chariots = standing.filter((f) => f.kit.ride === "chariot");
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
    // The armoured cars, in place of their men: a hull, an upper deck and a turret in their side's
    // colour (a wreck's charred, its turret askew), a gun out of the turret's front (standing), four
    // wheels at the corners.
    const standingCars = vehicles.filter((f) => !f.fallen),
      wrecks = vehicles.filter((f) => f.fallen),
      // A piece of a car: `right` of its middle, `up` off the ground and `ahead` of it, its size
      // (as the car's), and how far it is turned beyond the car's own yaw.
      piece = (
        f: Figure,
        out: number[],
        [right, up, ahead]: readonly [number, number, number],
        [sx, sy, sz]: readonly [number, number, number],
        turn = 0,
      ) => {
        const p = beside(f, right * f.size, ahead * f.size);
        out[0] = p.x;
        out[1] = ground(f) + up * f.size;
        out[2] = p.z;
        out[3] = sx * f.size;
        out[4] = sy * f.size;
        out[5] = sz * f.size;
        out[6] = f.yaw + turn;
      },
      // A car's body in three pieces: its hull (0), its upper deck (1), its turret (2).
      body = (f: Figure, out: number[], part: number, turn = 0) => {
        if (part === 0) piece(f, out, [0, 0.225, 0], [0.75, 0.45, 1.6]);
        else if (part === 1) piece(f, out, [0, 0.55, 0], [0.6, 0.2, 1]);
        else piece(f, out, [0, 0.8, 0], [0.55, 0.3, 0.55], turn);
      };
    this.carBodies.forEach((batch, side) => {
      const mine = standingCars.filter((f) => f.side === side);
      batch.set(mine.length * 3, (i, out) => body(mine[Math.floor(i / 3)]!, out, i % 3));
    });
    this.carWrecks.set(wrecks.length * 3, (i, out) =>
      body(wrecks[Math.floor(i / 3)]!, out, i % 3, 0.6),
    );
    this.carGuns.set(standingCars.length, (i, out) =>
      piece(standingCars[i]!, out, [0, 0.8, 0.575], [0.06, 0.06, 0.6]),
    );
    this.carWheels.set(vehicles.length * 4, (i, out) => {
      const k = i % 4;
      piece(
        vehicles[Math.floor(i / 4)]!,
        out,
        [k % 2 ? 0.375 : -0.375, 0.16, k < 2 ? 0.6 : -0.6],
        [0.12, 0.32, 0.32],
      );
    });
    // Arms: a spear upright at the right hand, its head of steel (a musket or a rifle shouldered,
    // its bayonet fixed); a blade at the hip; a bow (or a club) in the left hand.
    const gun = (f: (typeof standing)[number]) => isGun(f.kit.arm),
      spears = standing.filter((f) => f.kit.arm === "spear" || gun(f)),
      blades = standing.filter((f) => f.kit.arm === "sword" || f.kit.arm === "axe"),
      bows = standing.filter(
        (f) => f.kit.arm === "bow" || f.kit.arm === "horn-bow" || f.kit.arm === "club",
      );
    this.shafts.set(spears.length, (i, out) => {
      const f = spears[i]!,
        p = beside(f, 0.3 * f.size, 0.05),
        long = gun(f) ? 1.2 : 1.7;
      out[0] = p.x;
      out[1] = ground(f) + seatOf(f) * f.size + (long / 2) * f.size;
      out[2] = p.z;
      out[3] = out[5] = (gun(f) ? 0.07 : 0.05) * f.size;
      out[4] = long * f.size;
      out[6] = f.yaw;
    });
    this.steel.set(spears.length + blades.length, (i, out) => {
      if (i < spears.length) {
        const f = spears[i]!,
          p = beside(f, 0.3 * f.size, 0.05),
          long = gun(f) ? 1.2 : 1.7;
        out[0] = p.x;
        out[1] = ground(f) + seatOf(f) * f.size + (long + 0.08) * f.size;
        out[2] = p.z;
        out[3] = out[5] = (gun(f) ? 0.04 : 0.09) * f.size;
        out[4] = (gun(f) ? 0.16 : 0.22) * f.size;
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
    this.shields = standing.filter((f) => f.kit.shield);
    this.drawn = shown.length + vehicles.length;
    this.counts.riders = mounted.length - chariots.length;
    this.counts.chariots = chariots.length;
    this.counts.cars = standingCars.length;
    this.counts.guns = spears.filter(gun).length;
    this.counts.spears = spears.length - this.counts.guns;
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
            key: m.key ?? `${m.ref}:${m.realm}`,
            text: `${m.icon ? `${m.icon} ` : ""}${counterWords(m.fields ?? 0)}`,
            at: where,
            priority: 1.5e9,
            badge: { realm: m.realm, war: m.ref },
          }
        : // (Named before the towns about it; a fight now before the battles lately fought.)
          {
            key: m.ref,
            text: m.name,
            at: where,
            priority: m.fight ? 2.5e9 : m.battle ? 2e9 : 1e9,
          };
    });
  }

  /** Where each host, battle, camp and garrison stood at the last update (for the look tools). */
  places(): { ref: string; name: string; x: number; z: number }[] {
    return this.marks.map((m) => ({ ref: m.ref, name: m.name, x: m.x, z: m.z }));
  }

  /** The battle marked nearest a point of the land (km), within `reach` km of it: its ref and how far; or null. */
  battleNear(x: number, z: number, reach: number): { ref: string; d: number } | null {
    let best: { ref: string; d: number } | null = null;
    for (const m of this.marks) {
      const d = Math.hypot(m.x - x, m.z - z);
      if (m.battle && d < (best?.d ?? reach)) best = { ref: m.ref, d };
    }
    return best;
  }

  /**
   * Where each battle marked stands on the screen now, by the eye as it is (the look tools: a name
   * over it is moved on a frame later, which a slow machine shows late).
   */
  battlesOnScreen(): { ref: string; x: number; y: number }[] {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      out = new pc.Vec3(),
      on: { ref: string; x: number; y: number }[] = [];
    for (const m of this.marks) {
      if (!m.battle) continue;
      at.set(m.x, this.height(m.x, m.z) + 0.8, m.z);
      cam.worldToScreen(at, out);
      if (out.z > 0) on.push({ ref: m.ref, x: out.x, y: out.y });
    }
    return on;
  }

  /** The host, battle, camp or garrison nearest a screen point, within `reach` (a finger's), its ref; or null. */
  pick(x: number, y: number, reach = 28, battles = false): string | null {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      out = new pc.Vec3();
    let best: string | null = null,
      bestD = reach;
    for (const m of this.marks) {
      // (A battle zoomed into: a camp or a garrison nearer the pointer is not it.)
      if (battles && !m.battle) continue;
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
    }
    return best;
  }
}
