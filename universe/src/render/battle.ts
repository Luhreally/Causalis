// A battle drawn (Phase 37 M185): the field it was fought on — its ridge, its river, a seat's walls
// with their gate and the town behind them — and its two hosts on it, each one who fought in the
// parts of their people's own figure, in their side's colour, with what their host fought with
// (spears levelled, swords and axes raised and brought down, bows drawn), shields on their arms,
// helmets where they wore mail or plate, on horses or in chariots where they rode; their banners
// over them, falling with those who bore them; arrows in the air and spent in the ground; the
// fallen where they fell, their blood spreading under them; dust where they run and where the lines
// meet; the town burning, once stormed; the besiegers' tents, a siege laid. Posed afresh every frame
// from the battle at its moment. Units as the meadow's: a tenth of a unit to the metre.
import * as pc from "playcanvas";
import {
  FIELD,
  STRIDES,
  figurePaint,
  battleGroundAt,
  partExtent,
  type BattleField,
  type BattleNow,
  type Figure,
  type FigureBody,
  type FigurePart,
  type PartShape,
  type TrooperNow,
  FIGURE_CAPSULE,
  armLook,
  isGun,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, capsuleMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";
import { VehicleLayer } from "./vehicles.ts";

const M = 0.1;
/** How large one who fought is drawn, against a band's figure (theirs drawn 3.2 times life). */
const SOLDIER = 0.5;
/** The most of one side's figures the batches hold. */
const MOST = 380;
/** The rungs of a ladder. */
const RUNGS = 6;
/** The pieces the defenders' trench is cut into along the field. */
const TRENCH_PIECES = 18;
/** The trench's measures (m, the field's): its strip of earth, its bank's width and height, and the bank's gap from the strip. */
const TRENCH = { strip: 0.03, bankWide: 1, bankHigh: 0.5, bankAway: 0.55 } as const;
/**
 * A machine gun on its tripod (metres of the arms: drawn as large against its gunner as the rifles
 * are held, GUN_SCALE of a unit a metre at k 1): set this far ahead of one standing to it, its legs'
 * length, their tilt, and the tripod's head above its feet.
 */
const GUN_SCALE = 0.7,
  GUN_SET = 0.75,
  LEG = 0.6,
  TILT = 0.75,
  HEAD = LEG * Math.sin(TILT),
  // (One leg ahead, two back to either side.)
  LEG_ANGLES = [0, 2.1, -2.1] as const;
const WOOD: Rgb = [0.46, 0.33, 0.19],
  IRON: Rgb = [0.7, 0.71, 0.74],
  BRONZE: Rgb = [0.72, 0.52, 0.26],
  HORSE: Rgb = [0.42, 0.28, 0.17],
  BLOOD: Rgb = [0.4, 0.02, 0.03],
  DUST: Rgb = [0.66, 0.58, 0.46],
  STONE: Rgb = [0.6, 0.57, 0.52],
  STAKE: Rgb = [0.5, 0.38, 0.24],
  ROOF: Rgb = [0.55, 0.3, 0.2],
  HOUSE: Rgb = [0.78, 0.72, 0.6],
  SMOKE: Rgb = [0.13, 0.12, 0.12],
  POWDER: Rgb = [0.86, 0.86, 0.84],
  WATER: Rgb = [0.24, 0.46, 0.64],
  // (Fresh-cut timber, paler than the hafts about it.)
  LADDER: Rgb = [0.8, 0.64, 0.42];
// (The later arms: drab steel helmets, the trench's dug earth and its bank, a machine gun's steel.)
const DRAB: Rgb = [0.36, 0.38, 0.33],
  EARTH: Rgb = [0.2, 0.16, 0.11],
  PARAPET: Rgb = [0.52, 0.44, 0.3],
  GUN: Rgb = [0.2, 0.2, 0.22];

const darker = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

/**
 * A host's shields: of what its kit says they are made, faced in its colour (the copper alloys of
 * other chemistries as bronze; their irons as iron: Phase 54).
 */
export function shieldOf(kit: string, c: Rgb): Rgb {
  const stuff: Rgb = /bronze|cupronickel|arsenical/.test(kit)
    ? BRONZE
    : /iron|steel/.test(kit)
      ? IRON
      : /wood/.test(kit)
        ? WOOD
        : [0.55, 0.42, 0.28];
  return [
    stuff[0] * 0.55 + c[0] * 0.45,
    stuff[1] * 0.55 + c[1] * 0.45,
    stuff[2] * 0.55 + c[2] * 0.45,
  ];
}

/** A keyed draw (0 … 1). */
function unit(a: number, b: number): number {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** How far a limb is swung (radians about its hinge) by what its bearer is at. */
function limbAt(part: FigurePart, t: TrooperNow, stroke: string): number {
  const swing = part.swing ?? 0;
  if (!swing) return 0;
  const right = swing > 0,
    ph = t.cycle * 2 * Math.PI,
    off = t.id * 1.7;
  if (part.role !== "arm") {
    // Legs: a stride as they go, a stance where they fight.
    switch (t.act) {
      case "march":
        return swing * Math.sin(ph * STRIDES + off);
      case "run":
      case "flee":
        return swing * 1.5 * Math.sin(ph * 2.4 + off);
      case "fight":
        return 0.25 * Math.sign(swing) + 0.12 * Math.sin(ph * 1.3 + off);
      case "brace":
        return 0.3 * Math.sign(swing);
      case "fall":
        // (The wounded kick on as they drag themselves along.)
        return t.crawl
          ? 0.25 * Math.sign(swing) + 0.35 * Math.sin(ph * 1.1 + off + (right ? 0 : Math.PI))
          : 0.25 * Math.sign(swing) * t.down;
      // (Down in the grass, the legs straight back.)
      case "prone":
        return 0.05 * Math.sign(swing);
      default:
        return 0;
    }
  }
  switch (t.act) {
    case "march":
      return right ? -0.35 : swing * Math.sin(ph * STRIDES + off);
    case "run":
      return right ? -1.2 : swing * 1.2 * Math.sin(ph * 2.4 + off);
    case "flee":
      return swing * 1.6 * Math.sin(ph * 2.4 + off);
    case "brace":
      return right ? -1.25 : -0.95;
    case "fight": {
      if (!right) return stroke === "grapple" ? -1.5 : -0.95;
      switch (stroke) {
        case "thrust":
          // Jabbing: drawn back and driven out.
          return -1.25 + 0.65 * Math.sin(ph * 2.1 + off);
        case "grapple":
          return -1.5 + 0.2 * Math.sin(ph * 2 + off);
        case "bite":
          return -0.6;
        default:
          // Raised high and brought down.
          return -0.5 - 2.3 * Math.pow(Math.max(0, Math.sin(ph * 1.7 + off)), 0.6);
      }
    }
    case "loose":
      // The bow arm out; the string drawn back and let go.
      return right ? -1.25 + 0.3 * Math.max(0, Math.sin(ph * 0.31 + off)) : -1.55;
    case "cheer":
      return -2.7 + 0.35 * Math.sin(ph * 3 + (right ? Math.PI : 0) + off);
    case "fall":
      // (The wounded reach out ahead, one arm and then the other, to drag themselves on.)
      return t.crawl
        ? -2.3 - 0.6 * Math.sin(ph * 1.1 + off + (right ? 0 : Math.PI))
        : (right ? -0.7 : 0.5) * t.down;
    // (Down in the grass, the rifle reached forward to the ground in front.)
    case "prone":
      return right ? -2.75 + 0.05 * Math.sin(ph * 0.5 + off) : -2.9;
    default:
      return right ? -0.15 : 0;
  }
}

/** How far the whole of them leans forward (+) or back (−), about their feet. */
function leanOf(t: TrooperNow, stroke: string): number {
  switch (t.act) {
    case "run":
    case "flee":
      return 0.2;
    case "fight":
      return stroke === "bite"
        ? 0.3 * Math.max(0, Math.sin(t.cycle * 2 * Math.PI * 2 + t.id))
        : 0.08 + 0.06 * Math.sin(t.cycle * 2 * Math.PI * 1.7 + t.id * 1.7);
    case "fall":
      return (t.back ? -1 : 1) * t.down * (Math.PI / 2 - 0.1);
    // (Lying face down, toward the foe along their yaw.)
    case "prone":
      return Math.PI / 2 - 0.12;
    default:
      return 0;
  }
}

type Rig = {
  readonly f: Figure;
  /** The part they hold things in (their right arm, if they have one), their left, their head. */
  readonly hand: FigurePart | null;
  readonly off: FigurePart | null;
  readonly head: FigurePart | null;
  /** How high they stand (units at k 1). */
  readonly high: number;
};

function rigOf(f: Figure): Rig {
  const arms = f.parts.filter((p) => p.role === "arm"),
    top = (p: FigurePart) => p.y + partExtent(p)[1] / 2,
    high = Math.max(...f.parts.map(top)),
    // (Their head: the highest part that is no limb.)
    head =
      [...f.parts]
        .filter((p) => !p.role && p.shape !== "cone")
        .sort((a, b) => top(b) - top(a))[0] ?? null;
  return {
    f,
    hand: arms.find((p) => (p.swing ?? 0) > 0) ?? null,
    off: arms.find((p) => (p.swing ?? 0) < 0) ?? null,
    head,
    high,
  };
}

/** A point of a figure, posed: its limb's hinge turned by `lp`, the whole tipped by `lean`, set at `k`. */
function posedPoint(
  part: FigurePart,
  lp: number,
  lean: number,
  along: number,
): { y: number; z: number } {
  const hinge = part.pivot ?? 0,
    // The far end of the limb (`along` of its length below its middle), turned about its hinge.
    reach = hinge + along,
    py = part.y + hinge - reach * Math.cos(lp),
    pz = part.z - reach * Math.sin(lp);
  return {
    y: py * Math.cos(lean) - pz * Math.sin(lean),
    z: py * Math.sin(lean) + pz * Math.cos(lean),
  };
}

export class BattleLayer {
  readonly root = new pc.Entity("battle");
  private readonly stage: Stage;
  private readonly shapes: Record<PartShape, pc.Mesh>;
  private readonly box: pc.Mesh;
  private readonly cone: pc.Mesh;
  private readonly cyl: pc.Mesh;
  /** Each side's figure batches (a batch to a part), their shields, flags and the stripes on them. */
  private sides: {
    parts: InstancedBatch[];
    shields: InstancedBatch;
    flags: InstancedBatch;
    stripes: InstancedBatch;
  }[] = [];
  private rig: Rig | null = null;
  private readonly shafts: InstancedBatch;
  private readonly blades: InstancedBatch;
  private readonly helmets: InstancedBatch;
  private readonly steelHelmets: InstancedBatch;
  private readonly poles: InstancedBatch;
  private readonly horses: InstancedBatch;
  private readonly necks: InstancedBatch;
  private readonly legs: InstancedBatch;
  private readonly cars: InstancedBatch;
  private readonly wheels: InstancedBatch;
  private readonly arrows: InstancedBatch;
  private readonly blood: InstancedBatch;
  private readonly spray: InstancedBatch;
  private readonly dust: InstancedBatch;
  private readonly flames: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly tents: InstancedBatch;
  /** Powder smoke, a muzzle's flash; the cannon: barrels, carriages, wheels (Phase 37 M188). */
  private readonly powder: InstancedBatch;
  private readonly flash: InstancedBatch;
  private readonly barrels: InstancedBatch;
  private readonly carriages: InstancedBatch;
  private readonly cannonWheels: InstancedBatch;
  /** The defenders' trench, its strips of earth and its banks (laid for each battle). */
  private readonly trenches: InstancedBatch;
  private readonly parapets: InstancedBatch;
  /** The machine guns: their receivers, their water jackets and barrel tips, their tripods' legs. */
  private readonly gunBodies: InstancedBatch;
  private readonly gunTubes: InstancedBatch;
  private readonly tripods: InstancedBatch;
  /** The armoured cars, with the smoke and fire off the wrecks (Phase 53 M220). */
  private readonly vehicles: VehicleLayer;
  /** The field's own: its walls, its town, its river and its ridge (built for each battle). */
  private readonly walls: InstancedBatch;
  private readonly tops: InstancedBatch;
  private readonly gates: InstancedBatch;
  /** The ladders against a seat's walls: their rails and rungs. */
  private readonly ladders: InstancedBatch;
  private readonly houses: InstancedBatch;
  private readonly roofs: InstancedBatch;
  private readonly river: pc.Entity;
  private hill: pc.Entity | null = null;
  private field: BattleField | null = null;
  /** The town's houses, where a seat stands behind its walls. */
  private town: { x: number; z: number; w: number; d: number; h: number }[] = [];
  private shown = 0;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    this.cone = keptMesh(coneMesh(stage, 0.5, 1, 8));
    this.cyl = keptMesh(cylinderMesh(stage, 0.5, 1, 8));
    this.shapes = {
      box: this.box,
      capsule: keptMesh(capsuleMesh(stage, FIGURE_CAPSULE.radius, FIGURE_CAPSULE.height)),
      cylinder: this.cyl,
      cone: this.cone,
    };
    const batch = (mesh: pc.Mesh, color: Rgb, n: number, material?: pc.Material) =>
      new InstancedBatch(stage, mesh, color, n, this.root, material);
    this.shafts = batch(this.box, WOOD, MOST * 2);
    this.blades = batch(this.box, IRON, MOST * 2, flatMaterial(IRON, 1, 0.6, 0.5));
    this.helmets = batch(this.cone, IRON, MOST * 2, flatMaterial(IRON, 1, 0.6, 0.4));
    this.steelHelmets = batch(this.cone, DRAB, MOST * 2, flatMaterial(DRAB, 1, 0.6, 0.4));
    this.poles = batch(this.cyl, WOOD, 64);
    this.horses = batch(this.box, HORSE, MOST * 2);
    this.necks = batch(this.box, HORSE, MOST * 4);
    this.legs = batch(this.box, darker(HORSE, 0.8), MOST * 8);
    this.cars = batch(this.box, WOOD, MOST);
    this.wheels = batch(this.cyl, darker(WOOD, 0.7), MOST * 2);
    this.arrows = batch(this.box, [0.36, 0.26, 0.16], 900);
    this.blood = batch(this.cyl, BLOOD, MOST * 4, flatMaterial(BLOOD, 0.9, 0.7, 0.3));
    this.spray = batch(
      this.box,
      [0.62, 0.03, 0.04],
      420,
      flatMaterial([0.62, 0.03, 0.04], 1, 0.5, 0.2),
    );
    this.dust = batch(this.box, DUST, 240, flatMaterial(DUST, 0.32));
    const fire = new pc.StandardMaterial();
    fire.useLighting = false;
    fire.diffuse = new pc.Color(0, 0, 0);
    fire.emissive = new pc.Color(1, 0.5, 0.12);
    fire.update();
    this.flames = batch(this.cone, [1, 0.5, 0.1], 48, fire);
    this.smoke = batch(this.box, SMOKE, 240, flatMaterial(SMOKE, 0.62));
    this.tents = batch(this.cone, [0.8, 0.76, 0.66], 24);
    this.powder = batch(this.box, POWDER, 900, flatMaterial(POWDER, 0.55));
    const flare = new pc.StandardMaterial();
    flare.useLighting = false;
    flare.diffuse = new pc.Color(0, 0, 0);
    flare.emissive = new pc.Color(1, 0.86, 0.4);
    flare.update();
    this.flash = batch(this.cone, [1, 0.86, 0.4], 240, flare);
    this.barrels = batch(
      this.cyl,
      [0.2, 0.2, 0.22],
      16,
      flatMaterial([0.2, 0.2, 0.22], 1, 0.7, 0.45),
    );
    this.carriages = batch(this.box, darker(WOOD, 0.85), 16);
    this.cannonWheels = batch(this.cyl, darker(WOOD, 0.6), 32);
    this.trenches = batch(this.box, EARTH, TRENCH_PIECES);
    this.parapets = batch(this.box, PARAPET, TRENCH_PIECES);
    this.gunBodies = batch(this.box, GUN, MOST * 2, flatMaterial(GUN, 1, 0.7, 0.45));
    this.gunTubes = batch(this.cyl, GUN, MOST * 4, flatMaterial(GUN, 1, 0.7, 0.45));
    this.tripods = batch(this.box, GUN, MOST * 6);
    this.walls = batch(this.box, STONE, 260);
    this.tops = batch(this.box, STONE, 260);
    this.gates = batch(this.box, darker(WOOD, 0.75), 4);
    this.ladders = batch(this.box, LADDER, 7 * (2 + RUNGS));
    this.houses = batch(this.box, HOUSE, 40);
    this.roofs = batch(this.cone, ROOF, 40);
    this.vehicles = new VehicleLayer(stage, this.root, this.box, this.cyl, this.cone);
    this.river = new pc.Entity("river");
    this.river.addComponent("render", {
      meshInstances: [new pc.MeshInstance(this.box, flatMaterial(WATER, 0.88, 0.85, 0.35))],
    });
    this.root.addChild(this.river);
    parent.addChild(this.root);
    this.root.enabled = false;
  }

  /**
   * A battle's field and hosts made ready: its figures in their sides' colours (their people's
   * own look, their cloth in their colour), its walls and town, its river, its ridge in `grass`.
   */
  setup(field: BattleField, f: Figure | null, body: FigureBody | null, grass: Rgb): void {
    this.clear();
    this.field = field;
    this.rig = f ? rigOf(f) : null;
    const paint = figurePaint(body, "metal", 0);
    this.sides = ([field.near.attacker, field.near.defender] as const).map((s) => {
      const c = s.color as Rgb,
        // (Their cloth in their side's colour: an upright ape's tunic, or what a people wears over its hide.)
        tones: Rgb[] = paint.folk
          ? [...paint.tones.slice(0, 5), c]
          : [c, darker(c, 0.55), paint.tones[2], paint.tones[3], paint.tones[4], c],
        metal = s.arms?.field[1] ?? [0.92, 0.93, 0.96];
      return {
        parts: (f?.parts ?? []).map(
          (p) =>
            new InstancedBatch(this.stage, this.shapes[p.shape], tones[p.tone]!, MOST, this.root),
        ),
        shields: new InstancedBatch(this.stage, this.box, shieldOf(s.kit, c), MOST, this.root),
        flags: new InstancedBatch(this.stage, this.box, c, 32, this.root),
        stripes: new InstancedBatch(this.stage, this.box, metal as Rgb, 32, this.root),
      };
    });
    this.tents.recolor(darker(field.near.attacker.color as Rgb, 0.9));
    // The field's own.
    const g = field.ground,
      w = g.wall;
    this.walls.recolor(w?.stone ? STONE : STAKE);
    this.tops.recolor(w?.stone ? STONE : darker(STAKE, 0.85));
    if (w) {
      // The wall's run, either side of its gate, in blocks (stone) or stakes (a palisade).
      const step = w.stone ? 2.2 : 0.7,
        runs: number[] = [];
      for (let z = -FIELD.z; z <= FIELD.z; z += step) if (Math.abs(z) > w.gate + 0.2) runs.push(z);
      this.walls.set(runs.length, (i, out) => {
        out[0] = w.x * M;
        out[1] = (w.high * M) / 2;
        out[2] = runs[i]! * M;
        out[3] = (w.stone ? 1.4 : 0.42) * M;
        out[4] = w.high * M;
        out[5] = (w.stone ? step : 0.42) * M;
      });
      // (Battlements on the stone; points on the stakes; a tower either side of the gate.)
      const tops = runs.filter((_, i) => !w.stone || i % 2 === 0);
      this.tops.set(tops.length + 2, (i, out) => {
        if (i >= tops.length) {
          const side = i === tops.length ? -1 : 1;
          out[0] = w.x * M;
          out[1] = (w.high + 1.4) * M * 0.5 * 1.6;
          out[2] = side * (w.gate + 1.3) * M;
          out[3] = 2.4 * M;
          out[4] = (w.high + 1.4) * M * 1.6;
          out[5] = 2.4 * M;
          return;
        }
        out[0] = w.x * M;
        out[1] = (w.high + 0.35) * M;
        out[2] = tops[i]! * M;
        out[3] = (w.stone ? 1.4 : 0.3) * M;
        out[4] = 0.7 * M;
        out[5] = (w.stone ? 0.9 : 0.3) * M;
        out[6] = w.stone ? 0 : Math.PI / 4;
      });
      // The town behind its walls.
      this.town = [];
      for (let i = 0; i < 26; i++) {
        const u = unit(i, 3),
          v = unit(i, 7);
        this.town.push({
          x: w.x + 9 + u * (FIELD.x - w.x - 12),
          z: (v - 0.5) * (FIELD.z * 1.7),
          w: 4 + 2 * unit(i, 11),
          d: 5 + 3 * unit(i, 13),
          h: 3 + 2 * unit(i, 17),
        });
      }
      this.houses.set(this.town.length, (i, out) => {
        const h = this.town[i]!;
        out[0] = h.x * M;
        out[1] = (h.h * M) / 2;
        out[2] = h.z * M;
        out[3] = h.w * M;
        out[4] = h.h * M;
        out[5] = h.d * M;
      });
      this.roofs.set(this.town.length, (i, out) => {
        const h = this.town[i]!;
        out[0] = h.x * M;
        out[1] = (h.h + 1.2) * M;
        out[2] = h.z * M;
        out[3] = h.w * M * 1.2;
        out[4] = 2.4 * M;
        out[5] = h.d * M * 1.2;
        out[6] = Math.PI / 4;
      });
    } else {
      this.walls.set(0, () => {});
      this.tops.set(0, () => {});
      this.houses.set(0, () => {});
      this.roofs.set(0, () => {});
      this.town = [];
    }
    const r = g.river;
    this.river.enabled = !!r;
    if (r) {
      this.river.setLocalPosition(r.x * M, 0.006, 0);
      this.river.setLocalScale(r.w * 2 * M, 0.012, (FIELD.z * 2 + 2) * M);
    }
    // The defenders' trench: a strip of dug earth across the field, its bank on the attackers' side.
    const tr = g.trench;
    if (tr) {
      const piece = (FIELD.z * 2) / TRENCH_PIECES,
        across = (i: number) => -FIELD.z + (i + 0.5) * piece;
      this.trenches.set(TRENCH_PIECES, (i, out) => {
        const z = across(i);
        out[0] = tr.x * M;
        // (Just above the ground, so it does not sink into it.)
        out[1] = (battleGroundAt(g, tr.x, z) + 0.02) * M;
        out[2] = z * M;
        out[3] = 2 * tr.w * M;
        out[4] = TRENCH.strip * M;
        out[5] = piece * M;
      });
      this.parapets.set(TRENCH_PIECES, (i, out) => {
        const z = across(i),
          x = tr.x - tr.w - TRENCH.bankAway;
        out[0] = x * M;
        out[1] = (battleGroundAt(g, x, z) + TRENCH.bankHigh / 2) * M;
        out[2] = z * M;
        out[3] = TRENCH.bankWide * M;
        out[4] = TRENCH.bankHigh * M;
        out[5] = piece * M;
      });
    } else {
      this.trenches.set(0, () => {});
      this.parapets.set(0, () => {});
    }
    this.vehicles.setup([field.near.attacker.color as Rgb, field.near.defender.color as Rgb]);
    if (g.hill) this.hill = this.ridge(field, grass);
  }

  /** The ridge the defenders hold: the ground raised as the battle's ground is. */
  private ridge(field: BattleField, grass: Rgb): pc.Entity {
    const h = field.ground.hill!,
      cols = 36,
      rows = 28,
      x0 = h.x - h.rx,
      x1 = h.x + h.rx,
      z0 = -FIELD.z,
      z1 = FIELD.z,
      positions: number[] = [],
      indices: number[] = [];
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        const x = x0 + ((x1 - x0) * i) / cols,
          z = z0 + ((z1 - z0) * j) / rows;
        positions.push(x * M, battleGroundAt(field.ground, x, z) * M + 0.002, z * M);
      }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i,
          b = a + 1,
          c = a + cols + 1,
          d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    const normals = pc.calculateNormals(positions, indices),
      mesh = new pc.Mesh(this.stage.device);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setIndices(indices);
    mesh.update();
    const e = new pc.Entity("ridge");
    e.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, flatMaterial(grass))] });
    this.root.addChild(e);
    return e;
  }

  /** The field let go. */
  clear(): void {
    for (const s of this.sides) {
      for (const b of s.parts) b.destroy();
      s.shields.destroy();
      s.flags.destroy();
      s.stripes.destroy();
    }
    this.sides = [];
    this.hill?.destroy();
    this.hill = null;
    this.field = null;
  }

  /** The battle at its moment. */
  update(now: BattleNow): void {
    const field = this.field,
      rig = this.rig;
    if (!field || !rig) {
      this.root.enabled = false;
      return;
    }
    this.root.enabled = true;
    const f = rig.f,
      k = SOLDIER * f.scale,
      // (A true metre of the figure: it stands 1.75 of them.)
      metre = (rig.high * k) / 1.75,
      hosts = field.hosts,
      mountedOf = (t: TrooperNow) => hosts[t.side]!.mounted,
      lift = (t: TrooperNow) => {
        const m = mountedOf(t);
        // (A rider sits up on their horse; one in a chariot stands in its car. Those down lie on the ground.)
        return t.act === "fall" || t.act === "prone"
          ? 0
          : m === "horse"
            ? 0.33 * k
            : m === "chariot"
              ? 0.17 * k
              : 0;
      };
    let shown = 0;
    // Each one who fought, in the parts of their figure.
    for (const side of [0, 1] as const) {
      const s = this.sides[side]!,
        list = now.troopers.filter((t) => t.side === side && t.size > 0.01),
        stroke = hosts[side]!.stroke;
      f.parts.forEach((part, i) => {
        s.parts[i]!.set(list.length, (j, out) => {
          const t = list[j]!,
            kk = k * t.size,
            lp = limbAt(part, t, stroke),
            lean = leanOf(t, stroke),
            p = posedPoint(part, lp, lean, -(part.pivot ?? 0)),
            c = Math.cos(t.yaw),
            sn = Math.sin(t.yaw),
            // (Lying, they rest on the ground, not in it.)
            rest = t.act === "fall" ? 0.06 * kk * t.down : t.act === "prone" ? 0.06 * kk : 0;
          out[0] = t.x * M + (part.x * c + p.z * sn) * kk;
          out[1] = t.y * M + lift(t) + p.y * kk + rest;
          out[2] = t.z * M + (-part.x * sn + p.z * c) * kk;
          out[3] = part.sx * kk;
          out[4] = part.sy * kk;
          out[5] = part.sz * kk;
          out[6] = t.yaw;
          out[7] = lp + lean;
        });
      });
      shown += list.length * f.parts.length;
      // Shields on their off arms, where their host bore them.
      const shielded = field.near[side === 0 ? "attacker" : "defender"].host?.guard === "shield";
      const bearers = shielded ? list.filter((t) => t.act !== "flee") : [];
      s.shields.set(bearers.length, (j, out) => {
        const t = bearers[j]!,
          arm = rig.off ?? rig.hand,
          lean = leanOf(t, stroke),
          lp = arm ? limbAt(arm, t, stroke) : 0,
          at = arm
            ? posedPoint(arm, lp, lean, partExtent(arm)[1] * 0.35)
            : { y: rig.high * 0.5, z: 0.1 },
          ax = arm?.x ?? -0.1,
          c = Math.cos(t.yaw),
          sn = Math.sin(t.yaw),
          fall = t.act === "fall";
        out[0] = t.x * M + (ax * 1.1 * c + (at.z + 0.06) * sn) * k;
        out[1] = fall ? t.y * M + 0.012 : t.y * M + lift(t) + at.y * k;
        out[2] = t.z * M + (-ax * 1.1 * sn + (at.z + 0.06) * c) * k;
        out[3] = 0.24 * k;
        out[4] = 0.3 * k;
        out[5] = 0.035 * k;
        out[6] = t.yaw + (fall ? 0.9 : 0);
        out[7] = fall ? Math.PI / 2 : lean;
      });
      // Banners over those who bear them; fallen with them.
      const banners = list.filter((t) => t.bearer && t.act !== "flee");
      const flagAt = (t: TrooperNow) => {
        const fall = t.act === "fall",
          pole = 1.45 * k,
          c = Math.cos(t.yaw),
          sn = Math.sin(t.yaw),
          hx = (rig.hand?.x ?? 0.1) * k;
        // (Lying, the pole lies along the ground beside them.)
        return fall
          ? {
              x: t.x * M + hx * c + sn * pole * 0.5 * t.down,
              y: t.y * M + 0.02,
              z: t.z * M - hx * sn + c * pole * 0.5 * t.down,
              fall,
              pole,
            }
          : { x: t.x * M + hx * c, y: t.y * M + lift(t), z: t.z * M - hx * sn, fall, pole };
      };
      s.flags.set(banners.length, (j, out) => {
        const t = banners[j]!,
          a = flagAt(t),
          wave = Math.sin(now.s * 3.1 + t.id) * 0.3;
        out[0] = a.x + (a.fall ? 0 : Math.sin(t.yaw + Math.PI / 2 + wave) * 0.24 * k);
        out[1] = a.fall ? a.y : a.y + a.pole - 0.17 * k;
        out[2] = a.z + (a.fall ? 0 : Math.cos(t.yaw + Math.PI / 2 + wave) * 0.24 * k);
        out[3] = 0.02 * k;
        out[4] = a.fall ? 0.02 * k : 0.32 * k;
        out[5] = 0.48 * k;
        out[6] = t.yaw + Math.PI / 2 + wave;
        out[7] = a.fall ? 0 : 0;
      });
      s.stripes.set(banners.length, (j, out) => {
        const t = banners[j]!,
          a = flagAt(t),
          wave = Math.sin(now.s * 3.1 + t.id) * 0.3;
        out[0] = a.x + (a.fall ? 0 : Math.sin(t.yaw + Math.PI / 2 + wave) * 0.24 * k);
        out[1] = a.fall ? a.y + 0.004 : a.y + a.pole - 0.17 * k;
        out[2] = a.z + (a.fall ? 0 : Math.cos(t.yaw + Math.PI / 2 + wave) * 0.24 * k);
        out[3] = 0.024 * k;
        out[4] = a.fall ? 0.024 * k : 0.08 * k;
        out[5] = 0.5 * k;
        out[6] = t.yaw + Math.PI / 2 + wave;
      });
    }
    // The banners' poles, of both sides.
    const bearers = now.troopers.filter((t) => t.bearer && t.act !== "flee" && t.size > 0.01);
    this.poles.set(bearers.length, (j, out) => {
      const t = bearers[j]!,
        fall = t.act === "fall",
        pole = 1.45 * k,
        hx = (rig.hand?.x ?? 0.1) * k,
        c = Math.cos(t.yaw),
        sn = Math.sin(t.yaw);
      out[0] = t.x * M + hx * c + (fall ? sn * pole * 0.5 * t.down : 0);
      out[1] = fall ? t.y * M + 0.015 : t.y * M + lift(t) + pole / 2;
      out[2] = t.z * M - hx * sn + (fall ? c * pole * 0.5 * t.down : 0);
      out[3] = 0.025 * k;
      out[4] = pole;
      out[5] = 0.025 * k;
      out[6] = t.yaw;
      out[7] = fall ? (Math.PI / 2) * t.down : 0;
    });
    // What they fight with: a shaft (a spear's, an axe's haft, a bow) and a blade (a spear's head,
    // a sword, an axe's head) in their right hand; on the ground beside them, fallen.
    const armed: { t: TrooperNow; arm: string }[] = [];
    for (const t of now.troopers) {
      // (A machine gun's team holds its gun, not a rifle; the rest of such a host bear the self-loading one.)
      if (t.size <= 0.01 || t.bearer || t.gun) continue;
      const own = field.near[t.side === 0 ? "attacker" : "defender"].host?.arm ?? "spear",
        arm = armLook(own).rest ?? own;
      if (arm === "claws" || arm === "mandibles" || arm === "tusks" || arm === "grapple") continue;
      if (t.act === "flee" && unit(t.id, 5) < 0.6) continue;
      armed.push({ t, arm });
    }
    const hold = (t: TrooperNow, arm: string) => {
      const part = arm === "bow" || arm === "horn-bow" ? (rig.off ?? rig.hand) : rig.hand,
        stroke = hosts[t.side]!.stroke,
        lp = part ? limbAt(part, t, stroke) : 0,
        lean = leanOf(t, stroke),
        at = part
          ? posedPoint(part, lp, lean, partExtent(part)[1] * 0.5)
          : { y: rig.high * 0.45, z: 0.1 },
        x = part?.x ?? 0.1,
        c = Math.cos(t.yaw),
        sn = Math.sin(t.yaw),
        fall = t.act === "fall";
      // Which way the thing held points (up and ahead, in the figure's frame).
      let up: number, ahead: number, long: number;
      if (isGun(arm)) {
        // Levelled to fire, the bayonet levelled in the press, else shouldered.
        // (Its length is its row's in the arms table.)
        long = armLook(arm).long!;
        [up, ahead] =
          t.act === "loose"
            ? [0.05, 1]
            : t.act === "prone"
              ? [0.02, 1]
              : t.act === "fight" || t.act === "brace" || t.act === "run"
                ? [0.16, 1]
                : [1, 0.3];
      } else {
        switch (arm) {
          case "spear":
            long = 1.35;
            [up, ahead] =
              t.act === "fight" || t.act === "brace" || t.act === "run" ? [0.12, 1] : [1, 0.12];
            break;
          case "bow":
          case "horn-bow":
            long = 0.75;
            [up, ahead] = [1, 0.05];
            break;
          case "shell-darts":
            long = 0.5;
            [up, ahead] = [0.6, 1];
            break;
          default:
            // A blade or a head on a haft, along the forearm and on past the hand.
            long = arm === "axe" ? 0.62 : arm === "club" ? 0.5 : 0.58;
            [up, ahead] = [Math.cos(lp + lean - 1.2), Math.sin(lp + lean - 1.2)];
        }
      }
      const n = Math.hypot(up, ahead) || 1;
      up /= n;
      ahead /= n;
      return {
        // The middle of the thing held, a little past the hand.
        x: t.x * M + (x * c + (at.z + ahead * long * 0.35) * sn) * k,
        y: fall ? t.y * M + 0.02 : t.y * M + lift(t) + (at.y + up * long * 0.35) * k,
        z: t.z * M + (-x * sn + (at.z + ahead * long * 0.35) * c) * k,
        // (Its length along its own z: pitched so its z runs up and ahead as it points.)
        pitch: fall ? 0 : Math.atan2(-up, ahead),
        yaw: t.yaw + (fall ? 1.1 + unit(t.id, 9) : 0),
        long,
      };
    };
    this.shafts.set(armed.length, (j, out) => {
      const { t, arm } = armed[j]!,
        h = hold(t, arm),
        bladed = arm === "sword",
        gun = isGun(arm);
      out[0] = h.x;
      out[1] = h.y;
      out[2] = h.z;
      out[3] = (bladed ? 0.018 : gun ? 0.034 : 0.026) * k;
      out[4] = (bladed ? 0.018 : gun ? 0.04 : 0.026) * k;
      out[5] = (bladed ? h.long * 0.25 : h.long) * k;
      out[6] = h.yaw;
      out[7] = h.pitch;
    });
    this.blades.set(armed.length, (j, out) => {
      const { t, arm } = armed[j]!,
        h = hold(t, arm),
        bow = arm === "bow" || arm === "horn-bow",
        gun = isGun(arm),
        // The blade at the far end (a spear's head, an axe's, a bayonet), or the length of a sword.
        tip = arm === "sword" ? 0.12 : bow ? 0 : h.long * (gun ? 0.56 : 0.46),
        dir = { up: -Math.sin(h.pitch), ahead: Math.cos(h.pitch) },
        c = Math.cos(h.yaw),
        sn = Math.sin(h.yaw);
      out[0] = h.x + sn * dir.ahead * tip * k;
      out[1] = h.y + dir.up * tip * k;
      out[2] = h.z + c * dir.ahead * tip * k;
      out[3] = (arm === "axe" ? 0.02 : bow ? 0.012 : 0.03) * k;
      out[4] = (arm === "axe" ? 0.12 : bow ? 0.012 : 0.012) * k;
      out[5] = (arm === "sword" ? 0.5 : arm === "axe" ? 0.09 : bow ? 0.02 : gun ? 0.16 : 0.1) * k;
      out[6] = h.yaw;
      out[7] = h.pitch;
    });
    // Helmets where they wore mail, scale or plate (bronze on scale), and the steel helmets the
    // later arms wore: wider and flatter, in drab.
    const helmet = (t: TrooperNow, out: number[], wide: number, flat: number) => {
      const head = rig.head,
        lean = leanOf(t, hosts[t.side]!.stroke),
        y = head ? head.y + partExtent(head)[1] * 0.35 : rig.high * 0.9,
        z = head?.z ?? 0,
        p = {
          y: y * Math.cos(lean) - z * Math.sin(lean),
          z: y * Math.sin(lean) + z * Math.cos(lean),
        },
        w = head ? Math.max(partExtent(head)[0], partExtent(head)[2]) * 1.15 : 0.2;
      out[0] = t.x * M + Math.sin(t.yaw) * p.z * k;
      out[1] =
        t.y * M +
        lift(t) +
        p.y * k +
        (t.act === "fall" ? 0.03 * t.down : t.act === "prone" ? 0.03 : 0);
      out[2] = t.z * M + Math.cos(t.yaw) * p.z * k;
      out[3] = w * wide * k;
      out[4] = w * 0.8 * flat * k;
      out[5] = w * wide * k;
      out[6] = t.yaw;
      out[7] = lean;
    };
    const helmed = now.troopers.filter((t) => {
      const g = field.near[t.side === 0 ? "attacker" : "defender"].host?.guard;
      return t.size > 0.01 && (g === "mail" || g === "plate" || g === "scale");
    });
    this.helmets.set(helmed.length, (j, out) => helmet(helmed[j]!, out, 1, 1));
    this.helmets.recolor(field.near.attacker.host?.guard === "scale" ? BRONZE : IRON);
    const steel = now.troopers.filter((t) => {
      const g = field.near[t.side === 0 ? "attacker" : "defender"].host?.guard;
      return t.size > 0.01 && g === "helmet";
    });
    this.steelHelmets.set(steel.length, (j, out) => helmet(steel[j]!, out, 1.3, 0.5));
    // Their horses (riders) and chariots, under them.
    const ridden = now.troopers.filter((t) => t.size > 0.01 && mountedOf(t) !== null);
    const horseAt = (t: TrooperNow) => {
      const chariot = mountedOf(t) === "chariot",
        // (A chariot's horse goes before its car.)
        ahead = chariot ? 0.42 : 0,
        hk = k * (chariot ? 0.9 : 1),
        fall = t.act === "fall";
      return {
        x: t.x * M + Math.sin(t.yaw) * ahead * k,
        z: t.z * M + Math.cos(t.yaw) * ahead * k,
        y: t.y * M,
        hk,
        fall,
        gallop: t.act === "run" || t.act === "flee",
      };
    };
    this.horses.set(ridden.length, (j, out) => {
      const t = ridden[j]!,
        h = horseAt(t);
      out[0] = h.x;
      out[1] = h.y + (h.fall ? 0.1 : 0.3) * h.hk;
      out[2] = h.z;
      out[3] = 0.17 * h.hk;
      out[4] = 0.19 * h.hk;
      out[5] = 0.52 * h.hk;
      out[6] = t.yaw + (h.fall ? 0.4 : 0);
      out[7] = h.fall ? 0 : h.gallop ? 0.06 * Math.sin(t.cycle * 15) : 0;
    });
    this.necks.set(ridden.length * 2, (j, out) => {
      const t = ridden[j >> 1]!,
        h = horseAt(t),
        head = (j & 1) === 1,
        c = Math.sin(t.yaw),
        d = Math.cos(t.yaw),
        fwd = head ? 0.36 : 0.27,
        up = h.fall ? (head ? 0.06 : 0.1) : head ? 0.56 : 0.45;
      out[0] = h.x + c * fwd * h.hk;
      out[1] = h.y + up * h.hk;
      out[2] = h.z + d * fwd * h.hk;
      out[3] = (head ? 0.08 : 0.09) * h.hk;
      out[4] = (head ? 0.09 : 0.2) * h.hk;
      out[5] = (head ? 0.18 : 0.12) * h.hk;
      out[6] = t.yaw;
      out[7] = head ? 0.3 : -0.5;
    });
    this.legs.set(ridden.length * 4, (j, out) => {
      const t = ridden[j >> 2]!,
        h = horseAt(t),
        q = j & 3,
        across = (q & 1 ? 0.06 : -0.06) * h.hk,
        along = (q & 2 ? 0.19 : -0.19) * h.hk,
        swing = h.gallop
          ? 0.7 * Math.sin(t.cycle * 15 + q * 1.6)
          : t.act === "fight"
            ? 0.2 * Math.sin(t.cycle * 6 + q)
            : 0,
        c = Math.cos(t.yaw),
        sn = Math.sin(t.yaw);
      out[0] = h.x + across * c + along * sn;
      out[1] = h.fall ? h.y + 0.04 * h.hk : h.y + 0.15 * h.hk;
      out[2] = h.z - across * sn + along * c;
      out[3] = 0.045 * h.hk;
      out[4] = 0.3 * h.hk;
      out[5] = 0.045 * h.hk;
      out[6] = t.yaw;
      out[7] = h.fall ? Math.PI / 2 : swing;
    });
    const chariots = ridden.filter((t) => mountedOf(t) === "chariot");
    this.cars.set(chariots.length, (j, out) => {
      const t = chariots[j]!;
      out[0] = t.x * M;
      out[1] = t.y * M + 0.12 * k;
      out[2] = t.z * M;
      out[3] = 0.34 * k;
      out[4] = 0.16 * k;
      out[5] = 0.3 * k;
      out[6] = t.yaw;
    });
    this.wheels.set(chariots.length * 2, (j, out) => {
      const t = chariots[j >> 1]!,
        side = j & 1 ? 1 : -1,
        c = Math.cos(t.yaw),
        sn = Math.sin(t.yaw);
      out[0] = t.x * M + side * 0.2 * k * c;
      out[1] = t.y * M + 0.12 * k;
      out[2] = t.z * M - side * 0.2 * k * sn;
      out[3] = 0.24 * k;
      out[4] = 0.04 * k;
      out[5] = 0.24 * k;
      out[6] = t.yaw + Math.PI / 2;
      out[7] = Math.PI / 2;
    });
    // Arrows in the air and spent in the ground.
    const arrows = now.flying.length + now.spent.length;
    this.arrows.set(arrows, (j, out) => {
      if (j < now.flying.length) {
        const a = now.flying[j]!;
        out[0] = a.x * M;
        out[1] = a.y * M;
        out[2] = a.z * M;
        out[3] = 0.008;
        out[4] = 0.008;
        out[5] = 0.085;
        out[6] = a.yaw;
        out[7] = a.pitch;
        return;
      }
      const a = now.spent[j - now.flying.length]!;
      out[0] = a.x * M;
      out[1] = 0.025;
      out[2] = a.z * M;
      out[3] = 0.008;
      out[4] = 0.008;
      out[5] = 0.07;
      out[6] = a.yaw;
      out[7] = 0.9;
    });
    // Powder smoke where guns have fired, rolling and drifting; a muzzle's flash.
    this.powder.set(Math.min(this.powder.capacity, now.smoke.length), (j, out) => {
      const d = now.smoke[j]!;
      out[0] = d.x * M;
      out[1] = (battleGroundAt(field.ground, d.x, d.z) + d.y) * M;
      out[2] = d.z * M;
      out[3] = d.r * 2 * M;
      out[4] = d.r * 1.6 * M;
      out[5] = d.r * 2 * M;
      out[6] = j * 0.7 + d.r;
      out[7] = j * 0.3;
    });
    this.flash.set(Math.min(this.flash.capacity, now.flashes.length), (j, out) => {
      const f = now.flashes[j]!;
      out[0] = f.x * M;
      out[1] = (battleGroundAt(field.ground, f.x, f.z) + f.y) * M;
      out[2] = f.z * M;
      out[3] = 0.45 * M;
      out[4] = 1.1 * M;
      out[5] = 0.45 * M;
      out[6] = f.yaw;
      // (Its point along the way it fires.)
      out[7] = Math.PI / 2;
    });
    // The cannon: each a barrel on its carriage between two wheels, thrown back as it fires.
    const guns = now.cannon;
    this.barrels.set(guns.length, (j, out) => {
      const c = guns[j]!,
        back = 0.5 * c.recoil;
      out[0] = (c.x - Math.sin(c.yaw) * back) * M;
      out[1] = (battleGroundAt(field.ground, c.x, c.z) + 1.0) * M;
      out[2] = (c.z - Math.cos(c.yaw) * back) * M;
      out[3] = 0.42 * M;
      out[4] = 2.6 * M;
      out[5] = 0.42 * M;
      out[6] = c.yaw;
      // (Laid along the way it points, its muzzle a little raised.)
      out[7] = Math.PI / 2 - 0.12;
    });
    this.carriages.set(guns.length, (j, out) => {
      const c = guns[j]!,
        back = 0.35 * c.recoil + 0.5;
      out[0] = (c.x - Math.sin(c.yaw) * back) * M;
      out[1] = (battleGroundAt(field.ground, c.x, c.z) + 0.55) * M;
      out[2] = (c.z - Math.cos(c.yaw) * back) * M;
      out[3] = 0.8 * M;
      out[4] = 0.4 * M;
      out[5] = 2.4 * M;
      out[6] = c.yaw;
      out[7] = 0.18;
    });
    this.cannonWheels.set(guns.length * 2, (j, out) => {
      const c = guns[j >> 1]!,
        side = j & 1 ? 1 : -1,
        back = 0.35 * c.recoil,
        // (Either side of the carriage, across the way it points.)
        ax = Math.cos(c.yaw) * side * 0.6,
        az = -Math.sin(c.yaw) * side * 0.6;
      out[0] = (c.x + ax - Math.sin(c.yaw) * back) * M;
      out[1] = (battleGroundAt(field.ground, c.x, c.z) + 0.6) * M;
      out[2] = (c.z + az - Math.cos(c.yaw) * back) * M;
      out[3] = 1.2 * M;
      out[4] = 0.16 * M;
      out[5] = 1.2 * M;
      out[6] = c.yaw + Math.PI / 2;
      out[7] = Math.PI / 2;
    });
    // Machine guns on their tripods (a fallen gunner's stays where it was set): on the bank before
    // a trench's gunner, past the head of one lying down, a step ahead of one standing.
    const gm = GUN_SCALE * k,
      trench = field.ground.trench,
      mgs = now.troopers
        .filter((t) => t.gun && t.act !== "flee" && t.size > 0.01)
        .map((t) => {
          const s = Math.sin(t.yaw),
            c = Math.cos(t.yaw),
            banked = !!trench && t.y < -0.3,
            ahead = banked
              ? (trench.w + TRENCH.bankAway + TRENCH.bankWide / 2) * M
              : t.act === "prone" || t.act === "fall"
                ? rig.high * k + 0.04
                : GUN_SET * gm,
            gx = t.x * M + s * ahead,
            gz = t.z * M + c * ahead,
            base =
              (battleGroundAt(field.ground, gx / M, gz / M) + (banked ? TRENCH.bankHigh : 0)) * M;
          return { s, c, gx, gz, yaw: t.yaw, hy: base + HEAD * gm };
        });
    this.gunBodies.set(mgs.length, (j, out) => {
      const g = mgs[j]!;
      out[0] = g.gx;
      out[1] = g.hy;
      out[2] = g.gz;
      out[3] = 0.14 * gm;
      out[4] = 0.14 * gm;
      out[5] = 0.45 * gm;
      out[6] = g.yaw;
      out[7] = 0;
    });
    // Each gun's water jacket laid along it, and its barrel's tip beyond.
    this.gunTubes.set(mgs.length * 2, (j, out) => {
      const g = mgs[j >> 1]!,
        tip = (j & 1) === 1,
        along = (tip ? 0.9 : 0.5) * gm;
      out[0] = g.gx + g.s * along;
      out[1] = g.hy;
      out[2] = g.gz + g.c * along;
      out[3] = (tip ? 0.04 : 0.12) * gm;
      out[4] = (tip ? 0.25 : 0.55) * gm;
      out[5] = (tip ? 0.04 : 0.12) * gm;
      out[6] = g.yaw;
      out[7] = Math.PI / 2;
    });
    // Three legs to each tripod, splayed, their feet where its head stands above.
    this.tripods.set(mgs.length * 3, (j, out) => {
      const g = mgs[Math.floor(j / 3)]!,
        yaw = g.yaw + LEG_ANGLES[j % 3]!,
        half = (LEG / 2) * gm;
      out[0] = g.gx + Math.sin(yaw) * Math.cos(TILT) * half;
      out[1] = g.hy - Math.sin(TILT) * half;
      out[2] = g.gz + Math.cos(yaw) * Math.cos(TILT) * half;
      out[3] = 0.03 * gm;
      out[4] = 0.03 * gm;
      out[5] = LEG * gm;
      out[6] = yaw;
      out[7] = TILT;
    });
    // The blood of the fallen.
    // (Over the trodden grass, where the fallen lie.)
    this.blood.set(Math.min(this.blood.capacity, now.blood.length), (j, out) => {
      const b = now.blood[j]!;
      out[0] = b.x * M;
      // (Just over the grass the hosts trod short: 0.03 units at its tallest.)
      out[1] = battleGroundAt(field.ground, b.x, b.z) * M + 0.031 + (j % 7) * 0.0004;
      out[2] = b.z * M;
      out[3] = b.r * 2 * M;
      out[4] = 0.003;
      out[5] = b.r * 1.6 * M;
      out[6] = b.x * 3.1;
    });
    // The blood thrown up as they are struck down.
    this.spray.set(Math.min(this.spray.capacity, now.spray.length), (j, out) => {
      const d = now.spray[j]!;
      out[0] = d.x * M;
      out[1] = (battleGroundAt(field.ground, d.x, d.z) + d.y) * M;
      out[2] = d.z * M;
      out[3] = d.r * M;
      out[4] = d.r * M;
      out[5] = d.r * M;
      out[6] = j * 1.3;
      out[7] = j * 0.7;
    });
    // Dust.
    this.dust.set(now.dust.length, (j, out) => {
      const d = now.dust[j]!;
      out[0] = d.x * M;
      out[1] = d.y * M;
      out[2] = d.z * M;
      out[3] = d.r * M;
      out[4] = d.r * M;
      out[5] = d.r * M;
      out[6] = j * 0.7;
    });
    // The ladders: two rails and their rungs, as far up as they are raised.
    this.ladders.set(now.ladders.length * (2 + RUNGS), (j, out) => {
      const l = now.ladders[Math.floor(j / (2 + RUNGS))]!,
        part = j % (2 + RUNGS),
        along = part < 2 ? l.long / 2 : (l.long * (part - 2 + 0.5)) / RUNGS;
      out[0] = (l.x + Math.cos(l.rise) * along) * M;
      out[1] = (Math.sin(l.rise) * along + 0.05) * M;
      out[2] = (l.z + (part === 0 ? -0.26 : part === 1 ? 0.26 : 0)) * M;
      out[3] = (part < 2 ? 0.12 : 0.6) * M;
      out[4] = 0.09 * M;
      out[5] = (part < 2 ? l.long : 0.07) * M;
      out[6] = Math.PI / 2;
      out[7] = -l.rise;
    });
    // The gate, open as far as it is broken open.
    const w = field.ground.wall;
    this.gates.set(w ? 2 : 0, (j, out) => {
      const side = j === 0 ? -1 : 1,
        open = now.gate * 1.4,
        // (Each leaf hinged at its post, swung in.)
        hinge = side * w!.gate,
        half = w!.gate / 2,
        a = side * open;
      out[0] = (w!.x + Math.sin(open) * half) * M;
      out[1] = w!.high * 0.45 * M;
      out[2] = (hinge - side * Math.cos(open) * half) * M;
      out[3] = 0.4 * M;
      out[4] = w!.high * 0.9 * M;
      out[5] = w!.gate * M;
      out[6] = a;
    });
    // The town burning, once stormed: flames on its roofs, smoke over it.
    const burning =
      now.burning > 0 ? this.town.filter((_, i) => unit(i, 23) < 0.25 + 0.6 * now.burning) : [];
    this.flames.set(burning.length * 2, (j, out) => {
      const h = burning[j >> 1]!,
        flick = 0.75 + 0.25 * Math.sin(now.s * 9 + j * 2.1),
        tall = (2.4 + 2 * now.burning) * flick;
      out[0] = (h.x + ((j & 1) - 0.5) * 1.6) * M;
      out[1] = (h.h + 1 + tall / 2) * M;
      out[2] = h.z * M;
      out[3] = 1.6 * M;
      out[4] = tall * M;
      out[5] = 1.6 * M;
      out[6] = j;
    });
    // (Its smoke in a column of puffs, each rising, spreading and leaning off with the wind.)
    this.smoke.set(Math.min(this.smoke.capacity, burning.length * 6), (j, out) => {
      const h = burning[Math.floor(j / 6)]!,
        u = (now.s * 0.1 + (j % 6) / 6 + unit(j, 61) * 0.1) % 1,
        r = (0.7 + 2.1 * u) * (0.8 + 0.4 * unit(j, 67));
      out[0] = (h.x + 3.5 * u * u) * M;
      out[1] = (h.h + 1.5 + 15 * u) * M;
      out[2] = (h.z + 1.6 * u * u + (unit(j, 71) - 0.5) * 1.2) * M;
      out[3] = r * M;
      out[4] = r * 0.8 * M;
      out[5] = r * M;
      out[6] = j * 0.9 + now.s * 0.15;
      out[7] = j * 0.6;
    });
    // The besiegers' tents, a siege laid.
    const tents = now.camp > 0 ? Math.round(14 * now.camp) : 0;
    this.tents.set(tents, (j, out) => {
      const x = -26 - 9 * unit(j, 41),
        z = (j - 6.5) * 6 + (unit(j, 43) - 0.5) * 2;
      out[0] = x * M;
      out[1] = 1.4 * M;
      out[2] = z * M;
      out[3] = 3.4 * M;
      out[4] = 2.8 * M;
      out[5] = 3.4 * M;
      out[6] = j;
    });
    // The armoured cars, and the smoke and fire off the wrecks.
    this.vehicles.update(now.vehicles ?? [], now.fumes ?? [], now.flames ?? [], metre);
    this.shown = shown;
  }

  /** Where one who fought is on the screen, at their middle (or so far over it: `over`, units), or null where not seen. */
  onScreen(t: TrooperNow, over = 0): { x: number; y: number } | null {
    const rig = this.rig;
    if (!rig) return null;
    const k = SOLDIER * rig.f.scale * Math.max(0.3, t.size),
      up = t.act === "fall" || t.act === "prone" ? 0.1 * k : rig.high * k * 0.55,
      out = this.stage.camera.camera!.worldToScreen(
        new pc.Vec3(t.x * M, t.y * M + up + over, t.z * M),
      );
    return out.z > 0 ? { x: out.x, y: out.y } : null;
  }

  /** The one who fought nearest a point of the screen, within a finger's reach (their id), or null. */
  pick(now: BattleNow, x: number, y: number, reach = 26): number | null {
    let best: number | null = null,
      bd = reach;
    for (const t of now.troopers) {
      if (t.size <= 0.01) continue;
      const at = this.onScreen(t),
        d = at ? Math.hypot(at.x - x, at.y - y) : Infinity;
      if (d < bd) {
        bd = d;
        best = t.id;
      }
    }
    return best;
  }

  /** Over each host on the screen, where its name is told: over its standing middle (null: none stand, or unseen). */
  hostsOnScreen(
    now: BattleNow,
  ): [{ x: number; y: number } | null, { x: number; y: number } | null] {
    const at = (side: 0 | 1) => {
      let x = 0,
        y = 0,
        z = 0,
        n = 0;
      for (const t of now.troopers)
        if (t.side === side && t.act !== "fall" && t.size > 0.01) {
          x += t.x;
          y = Math.max(y, t.y);
          z += t.z;
          n++;
        }
      if (!n) return null;
      const out = this.stage.camera.camera!.worldToScreen(
        new pc.Vec3((x / n) * M, (y + 9) * M, (z / n) * M),
      );
      return out.z > 0 ? { x: out.x, y: out.y } : null;
    };
    return [at(0), at(1)];
  }

  /** How many figures' parts, and the cars' parts, are drawn (the look tools). */
  count(): number {
    return this.shown + this.vehicles.count();
  }
}
