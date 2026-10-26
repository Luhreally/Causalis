// A village under the microscope (docs/architecture §9, §28): its ground, fields
// that green and ripen with the year, the pasture and water, the road out, homes
// with their roofs, the square or the market hall, and the watched people going
// about their day. One unit is ten metres; people are drawn three times their size
// so a phone can see them. Instanced throughout: a village is a handful of draw calls.
import * as pc from "playcanvas";
import { LAKE_R, woundStage, type TradeGood, type VillagePlan } from "../bridge/index.ts";
import {
  ACTIVITY,
  ARM_LOOKS,
  isGun,
  HAIRS,
  EYES,
  GROUP_COLORS,
  SKIN,
  figurePaint,
  biomeColor,
  cropColor,
  FAIR_YEAR,
  cropTint,
  fieldsNow,
  flockAt,
  foldOf,
  gameAt,
  huntOn,
  type FlockState,
  frontOf,
  pulledOn,
  reapedAt,
  reapingOn,
  wateredOn,
  grassTint,
  soilTint,
  type FieldsNow,
  bobOf,
  FIGURE_CAPSULE,
  figureOf,
  hairOf,
  keepApart,
  partExtent,
  present,
  ringTurn,
  villageSolids,
  type Presence,
  homeDetail,
  lamplight,
  houseLook,
  limbPitch,
  momentOf,
  personGroup,
  prepareDay,
  sayOf,
  storesNow,
  workTold,
  seasonGround,
  seasonKey,
  seasonLeaf,
  seasonNeedle,
  seasonWater,
  treesOf,
  bierBetween,
  burialNow,
  buttsNow,
  fellingNow,
  fightNow,
  funeralsAhead,
  graveyardFor,
  gravesBefore,
  TOWN_WELL,
  wonderSpot,
  type BlazeNow,
  type Felling,
  type Figure,
  type GroundSeason,
  type Tree,
  type Moment,
  type PartShape,
  type TownThing,
  type Crop,
  type StoresNow,
  townWarScene,
  traderSeat,
  tripOn,
  furnaceOf,
  rackNow,
  rackSlot,
  type Hung,
  boardSlot,
  boardsNow,
  clampNow,
  benchSlot,
  floorNow,
  foundryNow,
  loomsNow,
  wheelsNow,
  type Thrown,
  type TownWar,
  type TownWarScene,
  homecomingsOn,
  littersNow,
  littersOn,
  lookKey,
  roadEdge,
  lookNow,
  looksHurt,
  woundBob,
  woundGear,
  woundPitch,
  type LitterNow,
  type WoundGear,
} from "../view/index.ts";
import {
  InstancedBatch,
  boxMesh,
  capsuleMesh,
  coneMesh,
  cylinderMesh,
  gableMesh,
} from "./batch.ts";
import { FaunaLayer, type PickedBeast } from "./fauna.ts";
import { VisitorsLayer } from "./visitors.ts";
import { WorkLayer, type Carrier } from "./work.ts";
import { TownLayer } from "./town.ts";
import { CountryLayer } from "./country.ts";
import { FeastLayer } from "./feast.ts";
import { TownWarLayer } from "./townwar.ts";
import { TradesLayer, type AtWork, type RackAt } from "./trades.ts";
import { CraftsLayer, type BoardsAt, type ClampAt, type LoomAt, type WheelAt } from "./crafts.ts";
import { FoundryLayer, type FoundryAt } from "./foundry.ts";
import { FloorLayer, type FloorAt } from "./floor.ts";
import { BlazeLayer } from "./blaze.ts";
import { GraveyardLayer } from "./graveyard.ts";
import { WoundsLayer, bandageOn, propAt, stumpAlong, type WornPiece } from "./wounds.ts";
import { LittersLayer, litterApart, litterHeld } from "./litters.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1; // units per metre
/** The most trees drawn coming down or lying at once (Phase 41 M200). */
const FELLING = 16;
/** A crown's place up its tree, its breadth and its height (units at a tree's size: as they are grown). */
const CROWNS = {
  conifer: { at: 1.05, w: 0.9, h: 1.5 },
  broadleaf: { at: 1.05, w: 1.2, h: 1 },
  palm: { at: 1.35, w: 1.1, h: 0.3 },
} as const;
/** A village scene's units per metre (its plans are in metres). */
export const VILLAGE_METRE = M;
/** How many a side a village's battle draws, by the setting's detail (M202: hosts the size of a town's). */
const SOLDIERS = [10, 18, 28, 44];
/** A host's arms that fire (Phase 37 M188): carried as a spear is, levelled to fire. */
const GUNS: readonly string[] = Object.keys(ARM_LOOKS).filter(isGun);
const YEAR = 365 * 86_400;

/** A city's quarters by use: open, houses, crowded houses, markets, workshops, the temple. */
const QUARTER_COLORS: readonly Rgb[] = [
  [0, 0, 0],
  [0.74, 0.62, 0.46],
  [0.6, 0.47, 0.36],
  [0.88, 0.76, 0.4],
  [0.5, 0.5, 0.54],
  [0.9, 0.88, 0.82],
];

/**
 * Windows' glass: dark by day; by night the lamplight glows out of them (its glow never
 * quite out, so dusk makes no new shader: the one warmed at the start serves all day).
 */
export function windowMaterial(): pc.StandardMaterial {
  const m = flatMaterial([0.14, 0.18, 0.24]);
  glowWindows(m, 0);
  return m;
}

function glowWindows(m: pc.StandardMaterial, glow: number): void {
  const g = 0.02 + 0.98 * glow;
  m.emissive = new pc.Color(1 * g, 0.78 * g, 0.4 * g);
  m.update();
}

export class VillageScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("village");
  private plan: VillagePlan | null = null;
  /** The sown fields, a batch to each crop (Phase 32: a patchwork), and the colour each was last drawn in. */
  private crops: { crop: Crop; batch: InstancedBatch; shown: string }[] = [];
  /** Each group's batch for each part of the figure (null: a part drawn by the person's hair). */
  private people: (InstancedBatch | null)[][] = [];
  /**
   * A war's two hosts about the town (M87; on the world's clock, Phase 40 M204): each side's
   * batch for each part of the figure, and their spears. Each side's `soldiersEach`: its host,
   * then the fallen of a battle fought before the town.
   */
  private soldiers: InstancedBatch[][] = [];
  private spears: InstancedBatch | null = null;
  private soldiersEach = 0;
  /** The war about the town now, as last drawn, and the sides its soldiers are armed for. */
  private townWar: TownWar | null = null;
  private warScene: TownWarScene | null = null;
  private armed = "";
  private soldierBatches: InstancedBatch[] = [];
  private meshes: Record<PartShape, pc.Mesh> | null = null;
  /** The besiegers' tents and fires, a town burning (M204). */
  private readonly warLayer: TownWarLayer;
  /**
   * What each side bears, as its host's design has it (Phase 13 M114): its arm (a spear, a
   * sword, an axe, a bow), whether a shield; and the batches of blades, bows and each side's
   * shields.
   */
  private kits: { arm: string; shield: boolean }[] = [];
  private blades: InstancedBatch | null = null;
  private bows: InstancedBatch | null = null;
  private shields: (InstancedBatch | null)[] = [];
  /** For each part of hair, a batch per hair colour (M79). */
  private hair: (InstancedBatch[] | null)[] = [];
  /** Windows, lit from dusk to dawn (their material's glow set by the hour). */
  private windows: pc.StandardMaterial | null = null;
  private lit = -1;
  /** A town's windows' glass (one for every plan of it: its batches are kept). */
  private townLamps: pc.StandardMaterial | null = null;
  private figure: Figure = figureOf(null);
  private moments: Moment[] = [];
  /**
   * The trees about it (Phase 41 M200): each part's batch (trunks, crowns by kind) and the trees it
   * holds, by their places in the trees drawn — those felled hidden, saplings grown small — and
   * the woodlot's own: what is coming down and lying today, and the stumps.
   */
  private forest: {
    readonly batch: InstancedBatch;
    readonly list: readonly Tree[];
    readonly index: readonly number[];
    readonly y: (t: Tree) => number;
    readonly w: (t: Tree) => number;
    readonly h: (t: Tree) => number;
  }[] = [];
  private forestTrees: readonly Tree[] = [];
  private felled: {
    readonly trunks: InstancedBatch;
    readonly crowns: ReadonlyMap<Tree["kind"], InstancedBatch>;
    readonly stumps: InstancedBatch;
  } | null = null;
  private fellKey = "";
  private fellNow: Felling | null = null;
  private readonly marker: pc.Entity;
  private marked: number | null = null;
  /** What lives about the village: its herds, hunters, flocks, birds and fish (M77). */
  private readonly fauna: FaunaLayer;
  /** Visitors from another star (Phase 18 M134): their ship and their people. */
  private readonly visitors: VisitorsLayer;
  /** Its work you can see: what its people carry, its mine and works, its road, its smoke (M78). */
  private readonly work: WorkLayer;
  /** A town built lot by lot (Phase 23), drawn from its fabric in place of its homes and quarters. */
  private readonly town: TownLayer;
  /** Its countryside (Phase 32): the fields' bounds, orchards, barns, mills, tractors, the pasture's fence. */
  private readonly country: CountryLayer;
  /** Its square on feast days and market days (Phase 33): bunting, tables, the bonfire; the stalls. */
  private readonly feast: FeastLayer;
  /** Its trades at their buildings (Phase 41 M199): mills' sails turning, kilns aglow, sparks at the anvil. */
  private readonly trades: TradesLayer;
  /** Its crafts seen being made (Phase 51 M214): the potters' wheels and boards, the looms, the clamp. */
  private readonly crafts: CraftsLayer;
  /** Its foundry by the works (Phase 51 M215): the cupola blowing, the iron tapped and poured, the castings. */
  private readonly foundryLayer: FoundryLayer;
  /** Its works' floor in the modern age (Phase 51 M215): the presses and lathes at work, the bench. */
  private readonly floorLayer: FloorLayer;
  /** What struck it, as it plays out (Phase 42 M201): its homes alight, their smoke, the dust of the fallen. */
  private readonly blazeLayer: BlazeLayer;
  private blazed: BlazeNow | null = null;
  /** Its graveyard and its burying (Phase 43 M205): its graves, those open today, the biers borne to them. */
  private readonly graveyard: GraveyardLayer;
  /** Wounds worn (Phase 55 M226): bandages, patches, slings, crutches, scars. */
  private readonly worn: WoundsLayer;
  /** The levy's wounded borne home on litters (Phase 55 M229), and those last drawn. */
  private readonly litters: LittersLayer;
  private littersShown: LitterNow[] = [];
  /** Each look's gear by its key (the same look, the same gear); each one's now (null: none), read for the world's ten minutes `gearAt`; the stumps drawn last. */
  private readonly gears = new Map<string, WoundGear>();
  private gearNow: (WoundGear | null)[] = [];
  private gearAt = Number.NaN;
  private stumpsDrawn = 0;
  /** Whether the town mourns now (those a strike killed being buried): its talk of them. */
  private mourning = false;
  /** The god's wonders in it as drawn (the look tools): where each stands, off what is built (metres). */
  wonders: { kind: string; x: number; z: number }[] = [];
  private shaken = false;
  /** The moment last drawn, for a rebuild between moments. */
  private lastT = 0;
  private readonly carriers: Carrier[] = [];
  /** Where smoke rises: roof tops, and a city's workshop chimneys (metres). */
  private hearths: { x: number; y: number; z: number }[] = [];
  private stacks: { x: number; y: number; z: number }[] = [];
  key: string | null = null;

  constructor(stage: Stage) {
    this.stage = stage;
    stage.root.addChild(this.root);
    this.marker = new pc.Entity("person-marker");
    this.marker.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(cylinderMesh(stage, 0.16, 0.02, 16), flatMaterial([1, 1, 1], 0.85)),
      ],
    });
    this.marker.enabled = false;
    this.root.addChild(this.marker);
    this.fauna = new FaunaLayer(stage, this.root);
    this.work = new WorkLayer(stage, this.root);
    this.visitors = new VisitorsLayer(stage, this.root);
    this.town = new TownLayer(stage, this.root);
    this.country = new CountryLayer(stage, this.root);
    this.feast = new FeastLayer(stage, this.root);
    this.warLayer = new TownWarLayer(stage, this.root);
    this.trades = new TradesLayer(stage, this.root);
    this.crafts = new CraftsLayer(stage, this.root);
    this.foundryLayer = new FoundryLayer(stage, this.root);
    this.floorLayer = new FloorLayer(stage, this.root);
    this.blazeLayer = new BlazeLayer(stage, this.root);
    this.graveyard = new GraveyardLayer(stage, this.root);
    this.worn = new WoundsLayer(stage, this.root);
    this.litters = new LittersLayer(stage, this.root);
    this.root.enabled = false;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** Every batch the village is built of, so a rebuild frees their buffers too. */
  private batches: InstancedBatch[] = [];
  /**
   * What the season dresses (Phase 30 M164): the ground and the lake, the leaves and the needles,
   * each with its own colour and how to paint it; the season as last dressed.
   */
  private dressed: {
    kind: "ground" | "water" | "leaf" | "needle" | "roof";
    base: Rgb;
    paint: (c: Rgb) => void;
    /** Grass (the ground about the town, its pasture): browning in a dry year (Phase 44 M206). */
    grass?: boolean;
  }[] = [];
  /** How dry the year in the fields last dressed the grass (tenths); the year in them now. */
  private dryAs = 0;
  private yearNow: FieldsNow = FAIR_YEAR;
  private seasonNow: GroundSeason | null = null;
  private seasonSeen = "";

  /** The season on the ground (null: none told): snow lying, the leaves turned or fallen, the lake frozen. */
  season(s: GroundSeason | null): void {
    const key = s ? seasonKey(s) : "";
    if (key === this.seasonSeen) return;
    this.seasonSeen = key;
    this.seasonNow = s;
    this.dress();
  }

  private dress(): void {
    const s = this.seasonNow;
    this.town.season(s?.snow ?? 0);
    this.graveyard.season(s?.snow ?? 0);
    this.country.season(s);
    for (const d of this.dressed)
      d.paint(
        !s
          ? d.grass
            ? grassTint(d.base, { ...FAIR_YEAR, dry: this.dryAs })
            : d.base
          : d.kind === "ground"
            ? seasonGround(
                d.grass ? grassTint(d.base, { ...FAIR_YEAR, dry: this.dryAs }) : d.base,
                s,
              )
            : d.kind === "roof"
              ? seasonGround(d.base, { ...s, snow: s.snow * 0.87 })
              : d.kind === "water"
                ? seasonWater(d.base, s)
                : d.kind === "needle"
                  ? seasonNeedle(d.base, s)
                  : seasonLeaf(d.base, s),
      );
  }
  private batch(...args: ConstructorParameters<typeof InstancedBatch>): InstancedBatch {
    const b = new InstancedBatch(...args);
    this.batches.push(b);
    return b;
  }

  /** Lay out a village from its plan. */
  build(plan: VillagePlan, t = this.lastT): void {
    // (Batches first: an entity destroyed does not free the instance buffer it was given.)
    for (const b of this.batches) b.destroy();
    this.batches = [];
    for (const child of [...this.root.children])
      if (
        child !== this.marker &&
        child !== this.fauna.root &&
        child !== this.work.root &&
        child !== this.visitors.root &&
        child !== this.town.root &&
        child !== this.country.root &&
        child !== this.feast.root &&
        child !== this.warLayer.root &&
        child !== this.trades.root &&
        child !== this.crafts.root &&
        child !== this.foundryLayer.root &&
        child !== this.floorLayer.root &&
        child !== this.blazeLayer.root &&
        child !== this.graveyard.root &&
        child !== this.worn.root &&
        child !== this.litters.root
      )
        child.destroy();
    this.stacks = [];
    this.dressed = [];
    this.plan = plan;
    // (A new village's people are drawn afresh; the same village's, carried on.)
    if (this.presenceOf !== plan.ref) {
      this.presence.clear();
      this.limbs.clear();
      this.presenceClock = null;
      this.presenceOf = plan.ref;
    }
    this.key = plan.ref;
    const s = this.stage,
      disc = (
        r: number,
        color: Rgb,
        x = 0,
        z = 0,
        y = 0,
        kind: "ground" | "water" = "ground",
        grass = false,
      ) => {
        const e = new pc.Entity("disc"),
          m = flatMaterial(color);
        e.addComponent("render", {
          meshInstances: [new pc.MeshInstance(cylinderMesh(s, r, 0.02, 48), m)],
        });
        e.setLocalPosition(x, y, z);
        this.root.addChild(e);
        this.dressed.push({
          kind,
          base: color,
          paint: (c) => {
            m.diffuse.set(c[0], c[1], c[2]);
            m.update();
          },
          grass,
        });
      };
    const g = biomeColor(plan.biome),
      // (The ground runs out past its farthest fields and pasture, and the mills on their rim — a
      // great city's lie kilometres out — to the horizon's edge.)
      reach = Math.max(
        plan.fields.reduce((m, f) => Math.max(m, Math.hypot(f.x, f.z) + Math.max(f.w, f.d)), 0),
        Math.hypot(plan.pasture.x, plan.pasture.z) + plan.pasture.r,
      );
    this.reach = reach;
    disc(
      Math.min(390, Math.max(140, (reach + 300) * M)),
      [g[0] * 0.95 + 0.03, g[1] * 0.95 + 0.05, g[2] * 0.9],
      0,
      0,
      0,
      "ground",
      true,
    );
    disc(
      plan.pasture.r * M,
      [g[0] * 0.8 + 0.12, g[1] * 0.85 + 0.14, g[2] * 0.7 + 0.05],
      plan.pasture.x * M,
      plan.pasture.z * M,
      0.012,
      "ground",
      true,
    );
    if (plan.water)
      disc(LAKE_R * M, [0.2, 0.4, 0.6], plan.water.x * M, plan.water.z * M, 0.014, "water");
    // The road out (through a city, both ways; paved stone once it is paved), and the square.
    const quarters = plan.districts,
      paved = !!quarters?.paved;
    const road = this.batch(
      s,
      boxMesh(s),
      paved ? [0.72, 0.7, 0.64] : [0.62, 0.55, 0.42],
      1,
      this.root,
    );
    const len = Math.hypot(plan.road.x, plan.road.z) * M;
    road.set(1, (_, out) => {
      out[0] = quarters ? 0 : (plan.road.x * M) / 2;
      out[1] = 0.015;
      out[2] = quarters ? 0 : (plan.road.z * M) / 2;
      out[3] = paved ? 1.4 : 0.5;
      out[4] = 0.02;
      out[5] = quarters ? 2 * len : len;
      out[6] = Math.atan2(plan.road.x, plan.road.z);
    });
    // A town built lot by lot draws its own streets, homes and buildings (Phase 23).
    const town = plan.town ?? null;
    // (Its windows' glass, lit from dusk to dawn as the village's are.)
    if (town) this.townLamps ??= windowMaterial();
    this.town.build(town, plan.ref, t, town ? this.townLamps : null);
    // (The furnace by the diggings and the smithy's rack, where its people smelt and smith: Phase
    // 51 M213.)
    const furnace = plan.stuff?.ore ? furnaceOf(plan.works?.mine) : null,
      smiths = plan.people.some((p) => p.trade?.kind === "smith");
    this.trades.build(
      town ? this.town.motions(t) : [],
      furnace
        ? { x: furnace.mouth.x, z: furnace.mouth.z, yaw: furnace.yaw, top: furnace.top }
        : null,
      smiths ? (plan.stuff?.metal?.colour ?? plan.stuff?.tool.colour ?? null) : null,
    );
    this.furnaceStand = furnace?.stand ?? null;
    this.rackKept = null;
    // (The potters' wheels and boards, the weavers' looms and the charcoal clamp, each as many as the
    // town has now and a few more, as its kilns and workshops go up: Phase 51 M214.)
    const solids = villageSolids(plan),
      wheels = wheelsNow(plan, solids, t).length,
      boards = boardsNow(plan, solids, t).length,
      looms = loomsNow(plan, solids, t).length;
    this.crafts.build(
      {
        wheels: wheels ? wheels + 6 : 0,
        boards: boards ? boards + 2 : 0,
        looms: looms ? looms + 2 : 0,
        clamp: !!clampNow(plan, solids, t),
      },
      {
        raw: plan.stuff?.clay.raw ?? [0.5, 0.4, 0.32],
        fired: plan.stuff?.clay.fired ?? [0.74, 0.42, 0.26],
        cloth: plan.stuff?.cloth.colour ?? [0.78, 0.7, 0.54],
      },
    );
    const foundry = foundryNow(plan, solids, t);
    this.foundryLayer.build(!!foundry, foundry?.moulds.length ?? 0);
    this.floorLayer.build(floorNow(plan, solids, t)?.machines.length ?? 0);
    this.craftsKept = null;
    // Its graveyard, just past its homes (Phase 43 M205).
    this.graveyard.build(graveyardFor(plan));
    // A town's well in the middle of its square, where its bucket lines draw (Phase 42 M201): a
    // ring of stone about its water, two posts and a little roof over it.
    if (town) {
      const stone = this.batch(s, cylinderMesh(s, 0.5, 1, 12), [0.6, 0.58, 0.54], 1, this.root),
        well = this.batch(s, cylinderMesh(s, 0.5, 1, 12), [0.2, 0.36, 0.5], 1, this.root),
        posts = this.batch(s, boxMesh(s), [0.42, 0.3, 0.18], 2, this.root),
        cover = this.batch(s, gableMesh(s), [0.5, 0.26, 0.18], 1, this.root);
      stone.set(1, (_, out) => {
        out[0] = TOWN_WELL.x * M;
        out[1] = 0.08;
        out[2] = TOWN_WELL.z * M;
        out[3] = out[5] = 0.42;
        out[4] = 0.16;
      });
      well.set(1, (_, out) => {
        out[0] = TOWN_WELL.x * M;
        out[1] = 0.162;
        out[2] = TOWN_WELL.z * M;
        out[3] = out[5] = 0.32;
        out[4] = 0.01;
      });
      posts.set(2, (i, out) => {
        out[0] = (TOWN_WELL.x + (i ? 1.9 : -1.9)) * M;
        out[1] = 0.3;
        out[2] = TOWN_WELL.z * M;
        out[3] = out[5] = 0.04;
        out[4] = 0.6;
      });
      cover.set(1, (_, out) => {
        out[0] = TOWN_WELL.x * M;
        out[1] = 0.66;
        out[2] = TOWN_WELL.z * M;
        out[3] = 0.5;
        out[4] = 0.14;
        out[5] = 0.36;
        out[6] = Math.PI / 2;
      });
    }
    // The god's wonders in it (Phase 42 M201): a spring's pool brimming in a basin of stone where
    // it welled up (above a square's paving), stones about its rim, its water rising in the
    // middle; a shrine where it was raised — a stone, a white stele and its gold flame.
    this.wonders = [];
    for (const w of plan.wonders ?? []) {
      const at = wonderSpot(plan, w);
      this.wonders.push({ kind: w.kind, x: at.x, z: at.z });
      if (w.kind === "spring") {
        const basin = this.batch(s, cylinderMesh(s, 0.5, 1, 16), [0.62, 0.6, 0.56], 1, this.root),
          stones = this.batch(s, boxMesh(s), [0.58, 0.56, 0.52], 10, this.root),
          rise = this.batch(s, coneMesh(s, 0.5, 1, 8), [0.7, 0.86, 0.95], 1, this.root);
        basin.set(1, (_, out) => {
          out[0] = at.x * M;
          out[1] = 0.03;
          out[2] = at.z * M;
          out[3] = out[5] = 0.72;
          out[4] = 0.06;
        });
        disc(0.3, [0.24, 0.5, 0.68], at.x * M, at.z * M, 0.058, "water");
        stones.set(10, (i, out) => {
          const a = (i / 10) * 2 * Math.PI;
          out[0] = (at.x + Math.cos(a) * 3.5) * M;
          out[1] = 0.065;
          out[2] = (at.z + Math.sin(a) * 3.5) * M;
          out[3] = 0.09;
          out[4] = 0.06;
          out[5] = 0.07;
          out[6] = a;
        });
        rise.set(1, (_, out) => {
          out[0] = at.x * M;
          out[1] = 0.12;
          out[2] = at.z * M;
          out[3] = out[5] = 0.08;
          out[4] = 0.1;
        });
      } else {
        const stone = this.batch(s, boxMesh(s), [0.66, 0.64, 0.6], 1, this.root),
          stele = this.batch(s, boxMesh(s), [0.95, 0.94, 0.9], 1, this.root),
          flame = this.batch(s, coneMesh(s, 0.5, 1, 8), [0.98, 0.8, 0.25], 1, this.root);
        stone.set(1, (_, out) => {
          out[0] = at.x * M;
          out[1] = 0.05;
          out[2] = at.z * M;
          out[3] = out[5] = 0.3;
          out[4] = 0.1;
        });
        stele.set(1, (_, out) => {
          out[0] = at.x * M;
          out[1] = 0.33;
          out[2] = at.z * M;
          out[3] = out[5] = 0.12;
          out[4] = 0.46;
        });
        flame.set(1, (_, out) => {
          out[0] = at.x * M;
          out[1] = 0.66;
          out[2] = at.z * M;
          out[3] = out[5] = 0.14;
          out[4] = 0.2;
        });
      }
    }
    // A city's quarters: each block's ground coloured by its use, and a hall at its heart.
    if (quarters && !town) {
      const patch = boxMesh(s),
        side = quarters.blockM * M * 0.94;
      QUARTER_COLORS.forEach((color, use) => {
        if (!use) return;
        const blocks = quarters.uses.map((u, k) => ({ u, k })).filter((b) => b.u === use);
        if (!blocks.length) return;
        const batch = this.batch(s, patch, color, blocks.length, this.root);
        batch.set(blocks.length, (i, out) => {
          const k = blocks[i]!.k,
            half = (quarters.blocks - 1) / 2;
          out[0] = ((k % quarters.blocks) - half) * quarters.blockM * M;
          out[1] = 0.012;
          out[2] = (Math.floor(k / quarters.blocks) - half) * quarters.blockM * M;
          out[3] = out[5] = side;
          out[4] = 0.01;
          out[6] = 0;
        });
      });
      // What each quarter holds (art track A3): markets their stalls under striped awnings,
      // workshops their sheds and chimneys, the temple a stepped pile with a gilded crown.
      const half = (quarters.blocks - 1) / 2,
        centre = (k: number) => ({
          x: ((k % quarters.blocks) - half) * quarters.blockM * M,
          z: (Math.floor(k / quarters.blocks) - half) * quarters.blockM * M,
        }),
        blocksOf = (use: number) =>
          quarters.uses.map((u, k) => ({ u, k })).filter((b) => b.u === use),
        span = quarters.blockM * M,
        pieces = (
          list: { x: number; y: number; z: number; w: number; h: number; d: number }[],
          color: Rgb,
        ) => {
          if (!list.length) return;
          this.batch(s, patch, color, list.length, this.root).set(list.length, (i, out) => {
            const p = list[i]!;
            out[0] = p.x;
            out[1] = p.y;
            out[2] = p.z;
            out[3] = p.w;
            out[4] = p.h;
            out[5] = p.d;
            out[6] = 0;
          });
        };
      const stalls: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [],
        awnings: (typeof stalls)[] = [[], [], [], []];
      for (const { k } of blocksOf(3)) {
        const c = centre(k);
        for (let a = 0; a < 3; a++)
          for (let b = 0; b < 3; b++) {
            const x = c.x + (a - 1) * span * 0.28,
              z = c.z + (b - 1) * span * 0.28;
            stalls.push({ x, y: 0.35, z, w: 1.4, h: 0.7, d: 1.1 });
            awnings[(k + a * 3 + b) % 4]!.push({ x, y: 0.78, z, w: 1.7, h: 0.12, d: 1.4 });
          }
      }
      pieces(stalls, [0.62, 0.46, 0.3]);
      const AWNINGS: readonly Rgb[] = [
        [0.9, 0.22, 0.2],
        [0.98, 0.8, 0.2],
        [0.2, 0.45, 0.9],
        [0.25, 0.7, 0.35],
      ];
      awnings.forEach((list, i) => pieces(list, AWNINGS[i]!));
      const sheds: typeof stalls = [],
        chimneys: typeof stalls = [];
      for (const { k } of blocksOf(4)) {
        const c = centre(k);
        for (const a of [-1, 1]) {
          const x = c.x + a * span * 0.22;
          sheds.push({ x, y: 0.9, z: c.z, w: span * 0.34, h: 1.8, d: span * 0.5 });
          chimneys.push({ x: x + span * 0.1, y: 2, z: c.z - span * 0.16, w: 0.55, h: 4, d: 0.55 });
        }
      }
      pieces(sheds, [0.5, 0.48, 0.46]);
      pieces(chimneys, [0.62, 0.26, 0.2]);
      // (The workshops' chimneys smoke.)
      this.stacks = chimneys.map((c) => ({ x: c.x / M, y: (c.y + c.h / 2) / M, z: c.z / M }));
      const tiers: typeof stalls = [],
        crowns: typeof stalls = [];
      for (const { k } of blocksOf(5)) {
        const c = centre(k),
          base = span * 0.6;
        [1, 0.72, 0.46].forEach((f, n) =>
          tiers.push({ x: c.x, y: 0.7 + n * 1.4, z: c.z, w: base * f, h: 1.4, d: base * f }),
        );
        crowns.push({ x: c.x, y: 4.9, z: c.z, w: base * 0.2, h: 1.2, d: base * 0.2 });
      }
      pieces(tiers, [0.94, 0.92, 0.86]);
      pieces(crowns, [0.98, 0.8, 0.25]);
    }
    if (!town) disc(2.2, [0.66, 0.6, 0.48], 0, 0, 0.016);
    // Its countryside (Phase 32): the orchards drawn there under their trees; the rest sown here,
    // a batch to each crop.
    this.country.build(plan, houseLook(plan.house), s.quality);
    this.feast.build(plan);
    const crop = this.country.crop;
    this.crops = (["grain", "greens", "fallow"] as const).flatMap((kind) => {
      const sown = plan.fields.filter((_, k) => crop[k] === kind);
      if (!sown.length) return [];
      const batch = this.batch(s, boxMesh(s), cropColor(kind, t), sown.length, this.root);
      batch.set(sown.length, (i, out) => {
        const f = sown[i]!;
        out[0] = f.x * M;
        out[1] = 0.02;
        out[2] = f.z * M;
        out[3] = f.w * M;
        out[4] = 0.02;
        out[5] = f.d * M;
        out[6] = f.yaw;
      });
      return [{ crop: kind, batch, shown: "" }];
    });
    // Homes, as the land builds them (its design): walls of its material, four-square
    // or round, long or wide; roofs pitched to the rain, flat, or conical; tents whole
    // cones of hide. The watched homes lighter.
    const look = houseLook(plan.house),
      sides = look.round ? 8 : 4,
      box = boxMesh(s),
      shell = look.round ? cylinderMesh(s, Math.SQRT1_2, 1, sides) : box,
      lighter: [number, number, number] = [
        look.wall[0] + (1 - look.wall[0]) * 0.4,
        look.wall[1] + (1 - look.wall[1]) * 0.4,
        look.wall[2] + (1 - look.wall[2]) * 0.4,
      ],
      wallHigh =
        (look.tent ? 0.06 : look.length > 0.85 && look.width > 0.85 ? 0.36 : 0.44) * look.height,
      flat = look.rise < 0.1,
      roofHigh = look.tent ? 0.75 : flat ? 0.08 : Math.min(0.6, look.rise * look.width * 0.5),
      // Square homes wear a gable along their length; round ones a cone.
      roofMesh = flat ? box : look.round ? coneMesh(s, Math.SQRT1_2, 1, sides) : gableMesh(s),
      walls = this.batch(s, shell, [...look.wall], plan.homes.length, this.root),
      watched = this.batch(s, shell, lighter, plan.homes.length, this.root),
      roofs = this.batch(s, roofMesh, [...look.roof], plan.homes.length, this.root);
    // (Snow lies on them in a cold land's winter: M164.)
    this.dressed.push({ kind: "roof", base: [...look.roof], paint: (c) => roofs.recolor(c) });
    // In a city's crowded quarters homes stand two storeys high.
    const storeys = (h: VillagePlan["homes"][number]) => {
        const q = plan.districts;
        if (!q) return 1;
        const i = Math.round(h.x / q.blockM + (q.blocks - 1) / 2),
          j = Math.round(h.z / q.blockM + (q.blocks - 1) / 2);
        return q.uses[j * q.blocks + i] === 2 ? 2 : 1;
      },
      place = (list: VillagePlan["homes"][number][], batch: InstancedBatch) =>
        batch.set(list.length, (i, out) => {
          const h = list[i]!,
            high = wallHigh * storeys(h);
          out[0] = h.x * M;
          // Nests and platforms stand off the ground.
          out[1] = look.raised + high / 2;
          out[2] = h.z * M;
          out[3] = look.length;
          out[4] = high;
          out[5] = look.width;
          out[6] = h.yaw;
        });
    place(town ? [] : plan.homes.filter((h) => !h.household), walls);
    place(town ? [] : plan.homes.filter((h) => h.household), watched);
    // A house open to the water above has no roof.
    roofs.set(look.open || town ? 0 : plan.homes.length, (i, out) => {
      const h = plan.homes[i]!;
      out[0] = h.x * M;
      out[1] = look.raised + wallHigh * storeys(h) + roofHigh / 2;
      out[2] = h.z * M;
      // The eaves overhang the walls a little (a flat roof sits on them).
      out[3] = look.length * (flat ? 1.02 : 1.15);
      out[4] = roofHigh;
      out[5] = look.width * (flat ? 1.02 : 1.15);
      out[6] = h.yaw;
    });
    // The next home rising (M86): its footing, its walls as far built as the families it
    // will house have come, the scaffold about them, the timber waiting, and its roof going
    // on at the last.
    const site = town ? undefined : plan.life?.site;
    if (site && !look.tent) {
      const L = look.length,
        Wd = look.width,
        high = wallHigh * Math.min(1, site.progress / 0.8),
        thin = 0.045,
        c = Math.cos(site.yaw),
        sn = Math.sin(site.yaw),
        put = (
          batch: InstancedBatch,
          list: readonly (readonly [number, number, number, number, number, number])[],
        ) =>
          batch.set(list.length, (i, out) => {
            const [dx, y, dz, sx, sy, sz] = list[i]!;
            out[0] = site.x * M + dx * c + dz * sn;
            out[1] = y;
            out[2] = site.z * M - dx * sn + dz * c;
            out[3] = sx;
            out[4] = sy;
            out[5] = sz;
            out[6] = site.yaw;
          });
      put(this.batch(s, box, [0.62, 0.6, 0.56], 1, this.root), [
        [0, 0.012, 0, L * 1.08, 0.024, Wd * 1.08],
      ]);
      put(this.batch(s, box, [...look.wall], 4, this.root), [
        [0, 0.024 + high / 2, Wd / 2 - thin / 2, L, high, thin],
        [0, 0.024 + high / 2, -Wd / 2 + thin / 2, L, high, thin],
        [L / 2 - thin / 2, 0.024 + high / 2, 0, thin, high, Wd],
        [-L / 2 + thin / 2, 0.024 + high / 2, 0, thin, high, Wd],
      ]);
      const pole = high + 0.16,
        out = 0.07;
      put(this.batch(s, box, [0.52, 0.36, 0.2], 9, this.root), [
        // Poles at the corners, planks along the long sides, and the timber waiting.
        [L / 2 + out, pole / 2, Wd / 2 + out, 0.022, pole, 0.022],
        [-L / 2 - out, pole / 2, Wd / 2 + out, 0.022, pole, 0.022],
        [L / 2 + out, pole / 2, -Wd / 2 - out, 0.022, pole, 0.022],
        [-L / 2 - out, pole / 2, -Wd / 2 - out, 0.022, pole, 0.022],
        [0, high * 0.6 + 0.02, Wd / 2 + out, L + 2 * out, 0.014, 0.07],
        [0, high * 0.6 + 0.02, -Wd / 2 - out, L + 2 * out, 0.014, 0.07],
        [L * 0.95, 0.018, Wd * 0.9, 0.5, 0.035, 0.045],
        [L * 0.95, 0.052, Wd * 0.9 + 0.01, 0.5, 0.035, 0.045],
        [L * 0.95, 0.018, Wd * 0.9 + 0.06, 0.5, 0.035, 0.045],
      ]);
      if (site.progress > 0.85 && !look.open) {
        const done = Math.min(1, (site.progress - 0.85) / 0.15);
        this.batch(s, roofMesh, [...look.roof], 1, this.root).set(1, (_, o) => {
          o[0] = site.x * M + (L * (1 - done) * 0.5 * 1.15 * c) / 2;
          o[1] = 0.024 + wallHigh + roofHigh / 2;
          o[2] = site.z * M - (L * (1 - done) * 0.5 * 1.15 * sn) / 2;
          o[3] = L * 1.15 * Math.max(0.3, done);
          o[4] = roofHigh;
          o[5] = Wd * 1.15;
          o[6] = site.yaw;
        });
      }
    }
    // Trees about the village, as its land grows them: dark cones of pine, round crowns,
    // palms, low scrub — facets in a handful of batches.
    const trees = treesOf(plan, s.quality.villageTrees),
      drawnAt = new Map(trees.map((t, k) => [t, k])),
      byKind = (k: Tree["kind"]) => trees.filter((t) => t.kind === k),
      trunk = cylinderMesh(s, 0.5, 1, 5),
      crown = pc.Mesh.fromGeometry(
        s.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 3, longitudeBands: 6 }),
      ),
      pine = coneMesh(s, 0.5, 1, 6),
      g2 = biomeColor(plan.biome),
      leaf: Rgb = [g2[0] * 0.45 + 0.02, g2[1] * 0.55 + 0.22, g2[2] * 0.4 + 0.04],
      grow = (
        list: Tree[],
        mesh: pc.Mesh,
        color: Rgb,
        y: (t: Tree) => number,
        w: (t: Tree) => number,
        h: (t: Tree) => number,
        dressed?: "leaf" | "needle",
      ) => {
        if (!list.length) return;
        const b = this.batch(s, mesh, color, list.length, this.root);
        if (dressed) this.dressed.push({ kind: dressed, base: color, paint: (c) => b.recolor(c) });
        this.forest.push({ batch: b, list, index: list.map((t) => drawnAt.get(t)!), y, w, h });
      };
    this.forest = [];
    this.forestTrees = trees;
    this.fellKey = "";
    this.fellNow = null;
    // (What the woodlot fells: a few coming down or lying at once, and their stumps.)
    this.felled = trees.length
      ? {
          trunks: this.batch(s, trunk, [0.42, 0.28, 0.16], FELLING, this.root),
          crowns: new Map([
            ["conifer", this.batch(s, pine, [0.06, 0.36, 0.2], FELLING, this.root)],
            ["broadleaf", this.batch(s, crown, leaf, FELLING, this.root)],
            ["palm", this.batch(s, crown, [0.2, 0.62, 0.22], FELLING, this.root)],
          ]),
          stumps: this.batch(s, trunk, [0.6, 0.48, 0.32], Math.min(trees.length, 600), this.root),
        }
      : null;
    const standing = trees.filter((t) => t.kind !== "shrub");
    grow(
      standing,
      trunk,
      [0.42, 0.28, 0.16],
      (t) => 0.35 * t.size,
      () => 0.12,
      (t) => 0.7 * t.size,
    );
    grow(
      byKind("conifer"),
      pine,
      [0.06, 0.36, 0.2],
      (t) => 1.05 * t.size,
      (t) => 0.9 * t.size,
      (t) => 1.5 * t.size,
      "needle",
    );
    grow(
      byKind("broadleaf"),
      crown,
      leaf,
      (t) => 1.05 * t.size,
      (t) => 1.2 * t.size,
      (t) => 1 * t.size,
      "leaf",
    );
    grow(
      byKind("palm"),
      crown,
      [0.2, 0.62, 0.22],
      (t) => 1.35 * t.size,
      (t) => 1.1 * t.size,
      (t) => 0.3 * t.size,
    );
    grow(
      byKind("shrub"),
      crown,
      [leaf[0] * 0.9 + 0.08, leaf[1] * 0.85, leaf[2] * 0.8],
      (t) => 0.18 * t.size,
      (t) => 0.5 * t.size,
      (t) => 0.36 * t.size,
      "leaf",
    );
    this.plant(null);
    // (In the season the land is in, from the first frame.)
    this.dress();
    // A door on each home, facing out from its front (a town draws its own homes).
    if (!look.tent && !look.open && !town) {
      const door = this.batch(s, box, [0.2, 0.12, 0.08], plan.homes.length, this.root),
        doorHigh = Math.min(wallHigh * 0.7, 0.26);
      door.set(plan.homes.length, (i, out) => {
        const h = plan.homes[i]!,
          front = look.width / 2 + 0.012;
        out[0] = h.x * M + Math.sin(h.yaw) * front;
        out[1] = look.raised + doorHigh / 2;
        out[2] = h.z * M + Math.cos(h.yaw) * front;
        out[3] = 0.13;
        out[4] = doorHigh;
        out[5] = 0.02;
        out[6] = h.yaw;
      });
    }
    // The market hall, or the well in the square.
    const hall = this.batch(
      s,
      box,
      plan.market ? [0.62, 0.42, 0.3] : [0.5, 0.5, 0.55],
      1,
      this.root,
    );
    hall.set(1, (_, out) => {
      out[0] = plan.market ? 1.4 : 0;
      out[1] = plan.market ? 0.35 : 0.06;
      out[2] = plan.market ? -1 : 0;
      out[3] = plan.market ? 1.8 : 0.25;
      out[4] = plan.market ? 0.7 : 0.12;
      out[5] = plan.market ? 1.1 : 0.25;
      out[6] = 0;
    });
    // People: drawn three times their size, so a phone can see them — as their body is
    // built (one figure for a people, part by part, each part a batch per colour group).
    this.figure = figureOf(plan.body, s.quality.detail);
    // (A new figure, new gear: Phase 55 M226.)
    this.gears.clear();
    this.gearAt = Number.NaN;
    const meshes: Record<PartShape, pc.Mesh> = {
      capsule: capsuleMesh(s, FIGURE_CAPSULE.radius, FIGURE_CAPSULE.height),
      box: boxMesh(s),
      cylinder: cylinderMesh(s, 0.5, 1, 8),
      cone: coneMesh(s, 0.5, 1, 8),
    };
    // Each part a batch per group, dressed as the land's era dresses them (a people in their own
    // look in their hide, their clothes over it: Phase 34).
    this.people = GROUP_COLORS.map((_, gi) => {
      const paint = figurePaint(plan.body, plan.era, gi);
      return this.figure.parts.map((part) =>
        part.tone === 3
          ? null
          : this.batch(
              s,
              meshes[part.shape],
              paint.tones[part.tone],
              Math.max(1, plan.people.length),
              this.root,
            ),
      );
    });
    // Hair (a people's markings), each person's own colour (a batch a colour, whatever their group).
    const hairs = figurePaint(plan.body, plan.era, 0).hairs;
    this.hair = this.figure.parts.map((part) =>
      part.tone === 3
        ? hairs.map((c) =>
            this.batch(s, meshes[part.shape], c, Math.max(1, plan.people.length), this.root),
          )
        : null,
    );
    // The soldiers of a war about the town (M87, M204), armed afresh for it.
    this.meshes = meshes;
    this.armed = "";
    this.soldierBatches = [];
    this.soldiers = [];
    this.arm(this.townWar?.sides ?? null);
    // Homes built more finely (M79): windows lit at night, chimneys, porches, fences.
    this.windows = town ? this.townLamps : null;
    this.lit = -1;
    const pieces = (town ? [] : plan.homes).flatMap((h) =>
        homeDetail(
          look,
          wallHigh * storeys(h),
          wallHigh * storeys(h) + roofHigh,
          plan.era,
          s.quality.detail,
          !!h.household,
        ).map((p) => ({ h, p })),
      ),
      byRole = (role: string) => pieces.filter((x) => x.p.role === role),
      detailed = (list: typeof pieces, color: Rgb, material?: pc.StandardMaterial) => {
        if (!list.length) return;
        const b = new InstancedBatch(s, box, color, list.length, this.root, material);
        this.batches.push(b);
        b.set(list.length, (i, out) => {
          const { h, p } = list[i]!,
            c = Math.cos(h.yaw),
            sn = Math.sin(h.yaw);
          out[0] = h.x * M + p.x * c + p.z * sn;
          out[1] = p.y;
          out[2] = h.z * M - p.x * sn + p.z * c;
          out[3] = p.sx;
          out[4] = p.sy;
          out[5] = p.sz;
          out[6] = h.yaw + p.yaw;
        });
      };
    if (pieces.length) {
      this.windows = windowMaterial();
      detailed(byRole("window"), [0.14, 0.18, 0.24], this.windows);
      detailed(
        byRole("chimney"),
        plan.era === "industry" || plan.era === "modern" ? [0.6, 0.28, 0.2] : [0.55, 0.52, 0.48],
      );
      detailed(byRole("porch"), [...look.roof]);
      detailed(byRole("post"), [0.45, 0.3, 0.18]);
      detailed(byRole("fence"), [0.58, 0.42, 0.26]);
    }
    this.moments = [];
    // Beasts about it, as many as the setting draws; birds and fish where small motions are drawn.
    this.fauna.build(plan, s.quality.wildlife, s.quality.detail, s.quality.motion);
    this.visitors.build(plan, s.quality.detail);
    // Its work: what its people carry, its mine and works, its road's traffic, its smoke
    // (the watched homes' hearths first).
    this.hearths = town
      ? plan.homes.flatMap((h) => {
          // (In a town, from the roof of the home its fabric draws.)
          const at = this.town.hearth(h.x, h.z, t);
          return at ? [{ x: at.x, y: at.y, z: at.z }] : [];
        })
      : look.tent || look.open
        ? []
        : [...plan.homes]
            .sort((a, b) => Number(!!b.household) - Number(!!a.household))
            .map((h) => {
              // Out of the chimney's top where it has one; else through the roof's peak.
              const chimney = homeDetail(
                  look,
                  wallHigh * storeys(h),
                  wallHigh * storeys(h) + roofHigh,
                  plan.era,
                  1,
                  false,
                ).find((p) => p.role === "chimney"),
                c = Math.cos(h.yaw),
                sn = Math.sin(h.yaw);
              return chimney
                ? {
                    x: h.x + (chimney.x * c + chimney.z * sn) / M,
                    y: (chimney.y + chimney.sy / 2) / M,
                    z: h.z + (-chimney.x * sn + chimney.z * c) / M,
                  }
                : { x: h.x, y: (look.raised + wallHigh * storeys(h) + roofHigh) / M, z: h.z };
            });
    // (A town's kilns, smithies, workshops and works smoke from their chimneys: Phase 41 M199.)
    if (town) this.stacks = this.town.chimneys(t);
    this.work.build(
      plan,
      s.quality,
      this.fauna.road,
      this.fauna.species,
      this.hearths,
      this.stacks,
      t,
    );
    this.stores = null;
  }

  /** The beasts' clock held at this screen time, if held (for the look tools); null runs it. */
  heldFauna: number | null = null;

  /** What is drawn of each person, carried smoothly from frame to frame (view/presence.ts). */
  private readonly presence = new Map<string, Presence>();
  private presenceClock: number | null = null;
  private presenceOf = "";
  /** Each person's drawn size now (0 gone … 1 whole), and their stride's own clock. */
  private sizes: number[] = [];
  private strides: number[] = [];
  /** Each person's limbs as last drawn (a pitch a part, by their ref): eased toward each new pose. */
  private readonly limbs = new Map<string, Float32Array>();
  /** Each soldier's limbs as last drawn (a pitch a part, by their place in the ranks). */
  private soldierLimbs = new Float32Array(0);

  /** Put everyone where they are at time t. */
  /** How far out the town's lots reach (metres; 0 for a village drawn without its fabric). */
  townReach(): number {
    return this.town.visible ? this.town.reach() : 0;
  }

  /** How far out its countryside reaches (metres): its farthest fields and its pasture. */
  private reach = 0;
  countryReach(): number {
    return this.reach;
  }

  /** What its square shows now (Phase 33; the look tools): a feast, its fire, the market. */
  feastNow(): Record<string, number> {
    return this.feast.counts();
  }

  /** How many of each thing its countryside shows now (Phase 32; the look tools). */
  countryNow(): Record<string, number> {
    return this.country.counts();
  }

  /** What of a town drawn from its fabric stands at a point (metres from its middle), for a tap (M151). */
  townThingAt(x: number, z: number, t: number): TownThing | null {
    return this.town.thingAt(x, z, t);
  }

  /** Where on the screen a point of the town is (metres from its middle; the look tools), or null behind the eye. */
  screenOf(x: number, z: number): { x: number; y: number } | null {
    const s = this.stage.camera.camera!.worldToScreen(new pc.Vec3(x * M, 0, z * M));
    return s.z > 0 ? { x: s.x, y: s.y } : null;
  }

  /** Where on the screen one of the town's buildings, one of its homes and its walls are, at moment t (the look tools). */
  townOnScreen(t: number): {
    civic: { x: number; y: number; at: number; start: number } | null;
    lot: { x: number; y: number; lot: number } | null;
    walls: { x: number; y: number } | null;
    /** Where a length of its walls stands in the scene (units), for the eye to be turned to it. */
    wallsAt: { x: number; z: number } | null;
  } {
    const spots = this.town.spots(t),
      cam = this.stage.camera.camera!,
      on = (p: { x: number; z: number } | null) => {
        if (!p) return null;
        const s = cam.worldToScreen(new pc.Vec3(p.x * M, 0, p.z * M));
        return s.z > 0 ? { x: s.x, y: s.y } : null;
      };
    // (A home well within the screen with no one standing before it: a tap there finds the home,
    // not one of the townsfolk going about their day in front of it.)
    const rect = this.stage.app.graphicsDevice.clientRect,
      inView = (p: { x: number; y: number }) =>
        p.x > 24 && p.x < rect.width - 24 && p.y > 130 && p.y < rect.height - 24,
      home = this.town
        .homes(t)
        .map((h) => ({ h, s: on(h) }))
        .find(({ s }) => !!s && inView(s) && this.pick(s.x, s.y, 40) === null),
      civic = on(spots.civic),
      lot = home
        ? { ...home.s!, lot: home.h.lot }
        : (() => {
            const s = on(spots.lot);
            return s && spots.lot ? { ...s, lot: spots.lot.lot } : null;
          })();
    return {
      civic:
        civic && spots.civic ? { ...civic, at: spots.civic.at, start: spots.civic.start } : null,
      lot,
      walls: on(spots.walls),
      wallsAt: spots.walls ? { x: spots.walls.x * M, z: spots.walls.z * M } : null,
    };
  }

  /** Where a lot of the town is (metres from its middle). */
  townLot(p: number): { x: number; z: number } | null {
    return this.town.lotAt(p);
  }

  /**
   * The town's stores as last told (Phase 39 M198): the moment and way they were told, and when
   * on the screen's clock (ms).
   */
  private stores: { now: StoresNow; t: number; fine: boolean; at: number } | null = null;
  /** Where the furnace's smelter stands (metres; null: no furnace), and the rack as last laid. */
  private furnaceStand: { readonly x: number; readonly z: number } | null = null;
  private rackKept: { key: number; rack: RackAt | null } | null = null;
  /** The crafts as last laid (Phase 51 M214): the wheels, the boards, the looms and the clamp. */
  private craftsKept: {
    key: number;
    day: number;
    wheels: WheelAt[];
    boards: (BoardsAt & { pots: Thrown[] })[];
    looms: (LoomAt & { index: number; day: number })[];
    clamp: ClampAt | null;
    foundry: (FoundryAt & { moulds: { index: number; day: number }[] }) | null;
    floor:
      | (FloorAt & {
          machines: { index: number; n: number }[];
          benched: { index: number; n: number; form: string }[];
        })
      | null;
  } | null = null;

  /**
   * The village at moment t. `downpour`: the span of a downpour over it, if one falls (those at
   * their ease go in out of it). `fine`: its people at their day's errands (else, a town watched
   * growing, each at their work as it was before Phase 39, walking straight to it).
   */
  update(
    t: number,
    downpour: { readonly from: number; readonly to: number } | null = null,
    fine = true,
  ): void {
    const plan = this.plan;
    if (!plan) return;
    const step = t - this.lastT;
    this.lastT = t;
    this.town.update(t);
    // The fields as the year in them has it (Phase 44 M206): their crop's colour now — parched,
    // lush, sallow — the earth between their rows where the crop stands in rows, snow lying on
    // them in a cold land's winter (set only as it changes); the grass browning in a dry year.
    const year = fieldsNow(plan, t),
      snowed = (c: Rgb): Rgb => (this.seasonNow ? seasonGround(c, this.seasonNow) : c),
      sown = (kind: Crop): Rgb => snowed(cropTint(kind, t, year)),
      earth = (kind: Crop): Rgb =>
        !this.country.sown
          ? sown(kind)
          : kind === "fallow"
            ? snowed(grassTint(cropTint("fallow", t, year), year))
            : snowed(soilTint(year));
    for (const c of this.crops) {
      const color = earth(c.crop),
        key = color.map((x) => x.toFixed(3)).join();
      if (key === c.shown) continue;
      c.shown = key;
      c.batch.recolor(color);
    }
    const dry = Math.round(year.dry * 10) / 10;
    if (dry !== this.dryAs) {
      this.dryAs = dry;
      this.dress();
    }
    this.yearNow = year;
    // Lamplight in the windows from dusk to dawn (set only as it changes).
    if (this.windows) {
      const glow = Math.round(lamplight((t % 86_400) / 3600) * 20) / 20;
      if (glow !== this.lit) {
        this.lit = glow;
        glowWindows(this.windows, glow);
      }
    }
    // (The beasts move by the screen's clock: a look, at any speed the world runs.)
    const screen = this.heldFauna ?? performance.now() / 1000;
    this.fauna.update(screen, t);
    this.country.update(t, screen, sown, year);
    this.feast.update(t, screen);
    this.visitors.update(screen);
    const parts = this.figure.parts,
      // Strides and the motions of work: by the screen's clock, each person a little out of step.
      clock = performance.now() / 1000,
      // The war about the town (M204): its hosts where its year has them, its fallen where they fell.
      scene =
        this.townWar && this.soldiers.length
          ? townWarScene(plan, this.townWar, this.soldiersEach / 2)
          : null,
      troops = scene?.soldiers ?? [];
    this.warScene = scene;
    this.warLayer.update(scene, screen);
    const targets = plan.people.map((_, i) => momentOf(plan, i, t, downpour, fine));
    // Through the evening the next day is laid out, a few at a time (as many a frame as see it
    // laid by midnight at the speed the day goes), so its turn comes without a stall.
    const into = t % 86_400;
    if (fine && into >= 18 * 3600) {
      const frames = step > 0 ? Math.max(1, (86_400 - into) / step) : 360;
      prepareDay(
        plan,
        Math.floor(t / 86_400) + 1,
        Math.max(6, Math.ceil(plan.people.length / frames) + 2),
      );
    }
    // The stores (told again as their day moves them, every half minute of it; a town watched
    // growing, four times a second), and their heaps.
    const told = this.stores,
      wall = performance.now();
    if (
      !told ||
      told.fine !== fine ||
      (Math.abs(t - told.t) >= 30 && (fine || wall - told.at >= 250))
    ) {
      const now = storesNow(plan, t, fine);
      this.stores = { now, t, fine, at: wall };
      this.work.heapsAt({
        grain: now.lasts.grain,
        wood: now.have.wood,
        stone: now.have.stone,
        ore: now.lasts.ore,
      });
    }
    // What struck the town (Phase 42 M201): its homes alight, their smoke rolling up, the dust of
    // those shaken down — the nearest the eye drawn; and while a quake shakes it, the ground
    // under it all.
    if (plan.town?.struck?.length || this.blazed) {
      const b = this.town.blaze(t),
        eye = this.stage.camera.getPosition(),
        // (Where the eye looks, on the ground: what is drawn of it, the nearest there.)
        ahead = this.stage.camera.forward,
        reach = ahead.y < -0.05 ? -eye.y / ahead.y : 0;
      this.blazeLayer.update(
        b,
        screen,
        this.stage.quality.motion,
        { x: eye.x / M, y: eye.y / M, z: eye.z / M },
        { x: (eye.x + ahead.x * reach) / M, z: (eye.z + ahead.z * reach) / M },
      );
      this.blazeLayer.waterButts(buttsNow(plan, t));
      this.blazed = b.fires.length || b.smoke.length || b.dust.length || b.shake ? b : null;
      if (b.shake > 0 && this.stage.quality.motion) {
        const a = 0.06 * b.shake;
        this.root.setLocalPosition(a * Math.sin(screen * 41), 0, a * Math.cos(screen * 37));
        this.shaken = true;
      } else if (this.shaken) {
        this.root.setLocalPosition(0, 0, 0);
        this.shaken = false;
      }
    }
    // The woodlot (Phase 41 M200): a tree coming down at its feller's first blows' end, lying
    // as it is cut up, then its stump; saplings growing where trees were felled.
    if (this.forest.length) {
      const f = fellingNow(plan, t);
      if (f.key !== this.fellKey) {
        this.fellKey = f.key;
        this.plant(f);
      }
      this.fallen(f);
      this.fellNow = f;
    }
    // A feast's ring going round its fire (Phase 33), by the screen's clock.
    for (const m of targets)
      if (m.task === "dance" && !m.hidden) Object.assign(m, ringTurn(plan, m, screen));
    // No one stands in anyone else, nor in a soldier; and no one jumps: each is carried to
    // where their day has them, however fast the world runs.
    keepApart(
      plan,
      targets,
      troops.filter((q) => q.size > 0.5),
    );
    const dt = this.presenceClock === null ? 0 : clock - this.presenceClock;
    this.presenceClock = clock;
    const drawn = present(
      this.presence,
      plan.people.map((p) => p.ref),
      targets,
      dt,
      villageSolids(plan),
    );
    this.moments = drawn.map((d) => d.moment);
    // The town's trades at their buildings (Phase 41 M199): who tends each kiln now (or throws
    // pots by it), and who strikes at each smithy's anvil.
    if (this.trades.works.length) {
      const busy = this.trades.works.map((w): AtWork => {
        if (w.kind === "mill") return null;
        for (const m of this.moments)
          if (
            !m.hidden &&
            (w.kind === "kiln" ? m.task === "tend" || m.task === "throw" : m.task === "hammer") &&
            Math.hypot(m.x - w.door.x, m.z - w.door.z) < 9
          )
            return m;
        return null;
      });
      this.trades.update(screen, this.stage.quality.motion, busy);
    }
    // Things seen being made (Phase 51 M213): the furnace aglow while one works its bellows; the
    // rack before the smithy, the day's tools hung on it as they are made (laid again each half
    // minute of the world's clock).
    const stand = this.furnaceStand,
      smelting =
        !!stand &&
        this.moments.some(
          (m) => !m.hidden && m.task === "tend" && Math.hypot(m.x - stand.x, m.z - stand.z) < 6,
        ),
      key = Math.floor(t / 30);
    if (this.rackKept?.key !== key)
      this.rackKept = { key, rack: rackNow(plan, villageSolids(plan), t, fine) };
    this.trades.making(screen, smelting, this.rackKept.rack);
    // The crafts seen being made (Phase 51 M214): the wheels turning as the pots are thrown, the
    // boards filling as they are set out to dry, the cloth growing on the looms, the clamp's round.
    if (this.craftsKept?.key !== key) {
      const solids = villageSolids(plan);
      this.craftsKept = {
        key,
        day: Math.floor(t / 86_400),
        wheels: wheelsNow(plan, solids, t, fine),
        boards: boardsNow(plan, solids, t, fine),
        looms: loomsNow(plan, solids, t, fine),
        clamp: clampNow(plan, solids, t, fine),
        foundry: foundryNow(plan, solids, t, fine),
        floor: floorNow(plan, solids, t, fine),
      };
    }
    this.crafts.update(screen, this.stage.quality.motion, this.craftsKept);
    this.foundryLayer.update(screen, this.stage.quality.motion, this.craftsKept.foundry);
    this.floorLayer.update(screen, this.stage.quality.motion, this.craftsKept.floor);
    // Its dead and their burying (Phase 43 M205): the graves open today, their earth heaped
    // beside them; the dead on their biers, on their bearers' shoulders where they are drawn.
    this.mourning = false;
    if (this.graveyard.yard) {
      const b = burialNow(plan, t),
        moments = this.moments;
      this.mourning = b.mourning;
      this.graveyard.update(
        {
          open: b.open,
          biers: b.biers.map((q) => {
            const ms = q.bearers.map((i) => moments[i]).filter((m) => !!m && !m.hidden) as Moment[];
            return q.borne && ms.length === q.bearers.length && ms.length >= 2
              ? { ...q, ...bierBetween(ms) }
              : q;
          }),
          graves: b.graves,
          freshFrom: gravesBefore(plan),
          perYear: plan.rest?.perYear ?? 0,
        },
        // (Held up on their raised hands, over their heads.)
        6.1 * this.figure.scale,
      );
    }
    // Their wounds as they show now (Phase 55 M226): the gear of each one's look, read again each
    // ten minutes of the world (a look turns at its wound's hours), kept by the look's key.
    if (Math.floor(t / 600) !== this.gearAt) {
      this.gearAt = Math.floor(t / 600);
      this.gearNow = plan.people.map((p) => {
        if (!p.wounds?.length) return null;
        const look = lookNow(p, t);
        if (!looksHurt(look)) return null;
        const key = lookKey(look);
        let g = this.gears.get(key);
        if (!g) {
          if (this.gears.size >= 256) this.gears.clear();
          g = woundGear(this.figure, look);
          this.gears.set(key, g);
        }
        return g;
      });
    }
    this.sizes = drawn.map((d) => d.size);
    this.strides = drawn.map((d) => d.stride);
    // Each limb eased toward its pose now: a stride begun or ended, a task taken up, is a
    // turn of the arm, not a jump of it.
    const ease = dt > 0 ? 1 - Math.exp(-Math.min(0.1, dt) / 0.08) : 1,
      pitches = plan.people.map((p, i) => {
        const m = this.moments[i]!;
        let drawnPitch = this.limbs.get(p.ref);
        if (!drawnPitch || drawnPitch.length !== parts.length) {
          drawnPitch = new Float32Array(parts.length).fill(Number.NaN);
          this.limbs.set(p.ref, drawnPitch);
        }
        if (m.hidden) return drawnPitch;
        const walking = m.activity === ACTIVITY.walking;
        parts.forEach((part, pi) => {
          const posed = limbPitch(part, m.task, walking, walking ? this.strides[i]! : clock, i),
            gear = this.gearNow[i],
            aim = gear ? woundPitch(gear, pi, posed) : posed,
            was = drawnPitch[pi]!;
          drawnPitch[pi] = Number.isNaN(was) ? aim : was + (aim - was) * ease;
        });
        return drawnPitch;
      });
    /** A part of person i's figure, where it is now. */
    const place = (out: number[], p: VillagePlan["people"][number], i: number, pi: number) => {
      const part = parts[pi]!,
        m = this.moments[i]!,
        size = (p.child ? 0.7 : 1) * this.figure.scale * (this.sizes[i] ?? 1),
        c = Math.cos(m.yaw),
        sn = Math.sin(m.yaw),
        // A limb swings about its hinge: in the stride, or in the work at hand.
        pitch = pitches[i]![pi]!,
        // (A wound's: a member gone, a stump kept from its hinge, a limp's dip: Phase 55 M226.)
        gear = this.gearNow[i] ?? null,
        keep = gear ? gear.keep[pi]! : 1,
        lift = keep < 1 ? stumpAlong(partExtent(part)[1], keep) : 0,
        hinge = (part.pivot ?? 0) - lift,
        dy = hinge - hinge * Math.cos(pitch),
        dz = -hinge * Math.sin(pitch),
        px = part.x,
        pz = part.z + dz,
        limp = gear && m.activity === ACTIVITY.walking ? woundBob(gear, this.strides[i]!, i) : 0;
      // The part's place about the figure's middle, turned to the way it faces.
      out[0] = m.x * M + (px * c + pz * sn) * size;
      out[1] = (part.y + lift + dy + bobOf(m.task, clock, i) + limp) * size;
      out[2] = m.z * M + (-px * sn + pz * c) * size;
      out[3] = keep > 0 ? part.sx * size : 0;
      out[4] = part.sy * size * keep;
      out[5] = keep > 0 ? part.sz * size : 0;
      out[6] = m.yaw;
      out[7] = pitch;
    };
    this.people.forEach((batches, gi) => {
      const members = plan.people
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => personGroup(p) === gi && !this.moments[i]!.hidden);
      batches.forEach((batch, pi) =>
        batch?.set(members.length, (k, out) => place(out, members[k]!.p, members[k]!.i, pi)),
      );
    });
    // Hair, by each person's own colour.
    this.hair.forEach((colours, pi) => {
      if (!colours) return;
      const span = plan.body?.span ?? 70;
      colours.forEach((batch, hi) => {
        const wearers = plan.people
          .map((p, i) => ({ p, i }))
          .filter(({ p, i }) => !this.moments[i]!.hidden && hairOf(p.ref, p.age, span) === hi);
        batch.set(wearers.length, (k, out) => place(out, wearers[k]!.p, wearers[k]!.i, pi));
      });
    });
    // Their wounds worn (Phase 55 M226): linen bound about the parts as they are posed now, and
    // what they wear for them — a patch, a sling, a crutch, a scar — the nearest the eye first.
    const pieces: WornPiece[] = [],
      eye = this.stage.camera.getPosition(),
      placed = [0, 0, 0, 1, 1, 1, 0, 0];
    let stumps = 0;
    this.gearNow.forEach((g, i) => {
      const m = this.moments[i];
      if (!g || !m || m.hidden) return;
      const p = plan.people[i]!,
        size = (p.child ? 0.7 : 1) * this.figure.scale * (this.sizes[i] ?? 1),
        d2 = (m.x * M - eye.x) ** 2 + (m.z * M - eye.z) ** 2,
        bob =
          bobOf(m.task, clock, i) +
          (m.activity === ACTIVITY.walking ? woundBob(g, this.strides[i]!, i) : 0);
      for (const k of g.keep) if (k > 0 && k < 1) stumps++;
      for (const b of g.bound) {
        place(placed, p, i, b.part);
        const e = partExtent(parts[b.part]!);
        pieces.push({
          kind: "bandage",
          m: bandageOn(placed, [e[0] * size, e[1] * size, e[2] * size], g.keep[b.part]!, b),
          d2,
        });
      }
      for (const q of g.props)
        pieces.push({
          kind: q.kind === "strap" ? "patch" : q.kind,
          m: propAt(m.x, m.z, m.yaw, size, bob, q, M),
          d2,
        });
    });
    this.worn.update(pieces);
    this.stumpsDrawn = stumps;
    // The levy's wounded borne home on litters (Phase 55 M229): between their bearers where they
    // are drawn, else where their day has them.
    this.littersShown = littersNow(plan, t).map((q) => {
      const ms = q.bearers.map((i) => this.moments[i]).filter((m) => !!m && !m.hidden) as Moment[];
      return q.borne && ms.length === q.bearers.length && ms.length >= 2
        ? { ...q, ...bierBetween(ms) }
        : q;
    });
    this.litters.update(this.littersShown, litterHeld(this.figure), litterApart(this.figure));
    // The war about the town: its hosts mustering, marching, drawn up, closing, fighting, falling,
    // in flight; its fallen where they fell.
    if (this.soldiers.length && troops.length) {
      if (this.soldierLimbs.length !== 2 * this.soldiersEach * parts.length)
        this.soldierLimbs = new Float32Array(2 * this.soldiersEach * parts.length).fill(Number.NaN);
      /** A part of a soldier's figure now (lying on their back, if fallen). */
      const soldierPart = (out: number[], k: number, pi: number, side: number) => {
        const q = troops[side * this.soldiersEach + k]!,
          size = this.figure.scale * q.size,
          part = parts[pi]!,
          c = Math.cos(q.yaw),
          sn = Math.sin(q.yaw),
          walking = q.doing === "advance" || q.doing === "fall back",
          aim =
            q.doing === "fallen"
              ? 0
              : limbPitch(
                  part,
                  // (Standing in their ranks at rest; at the drill as they muster; in the fight, thrusting.)
                  walking || q.doing === "stand"
                    ? null
                    : q.doing === "drill" || k % 2
                      ? "drill"
                      : "brawl",
                  walking,
                  clock * (walking ? 1.4 : 1),
                  k + side * 31,
                ),
          // (Eased, as the villagers' are: from the march to the fight is a turn of the arm.)
          slot = ((side * this.soldiersEach + k) * parts.length + pi) | 0,
          was = this.soldierLimbs[slot]!,
          pitch = Number.isNaN(was) ? aim : was + (aim - was) * ease,
          hinge = part.pivot ?? 0,
          px = part.x;
        this.soldierLimbs[slot] = pitch;
        let py = part.y + hinge - hinge * Math.cos(pitch),
          pz = part.z - hinge * Math.sin(pitch),
          pp = pitch;
        if (q.doing === "fallen") {
          // On their back: what stood up lies back along the ground.
          const up = py;
          py = 0.06 + pz;
          pz = -up;
          pp = pitch - Math.PI / 2;
        }
        out[0] = q.x * M + (px * c + pz * sn) * size;
        out[1] = py * size;
        out[2] = q.z * M + (-px * sn + pz * c) * size;
        out[3] = part.sx * size;
        out[4] = part.sy * size;
        out[5] = part.sz * size;
        out[6] = q.yaw;
        out[7] = pp;
      };
      this.soldiers.forEach((batches, side) =>
        batches.forEach((batch, pi) =>
          batch.set(this.soldiersEach, (k, out) => soldierPart(out, k, pi, side)),
        ),
      );
      // Their spears: held upright on the march, thrust in the fight, dropped by the fallen (a
      // musket or a rifle shouldered on the march, levelled to fire in the fight).
      const armed = (arms: readonly string[]) =>
          troops
            .map((q, i) => ({ q, i }))
            .filter(({ q }) => arms.includes(this.kits[q.side]?.arm ?? "spear")),
        spearmen = armed(["spear", ...GUNS]);
      this.spears?.set(spearmen.length, (n, out) => {
        const { q, i } = spearmen[n]!,
          size = this.figure.scale * q.size,
          c = Math.cos(q.yaw),
          sn = Math.sin(q.yaw),
          fallen = q.doing === "fallen",
          gun = GUNS.includes(this.kits[q.side]?.arm ?? ""),
          thrust =
            q.doing === "fight"
              ? gun
                ? -1.42
                : -0.5 - 0.7 * Math.abs(Math.sin(clock * 2 * Math.PI * 0.8 + i * 1.7))
              : -0.25,
          across = 0.13,
          ahead = fallen ? -0.35 : 0.05;
        out[0] = q.x * M + (across * c + ahead * sn) * size;
        out[1] = (fallen ? 0.03 : 0.36) * size;
        out[2] = q.z * M + (-across * sn + ahead * c) * size;
        out[3] = (gun ? 0.026 : 0.018) * size;
        out[4] = (gun ? 0.62 : 0.8) * size;
        out[5] = (gun ? 0.026 : 0.018) * size;
        out[6] = q.yaw;
        out[7] = fallen ? -Math.PI / 2 : thrust;
      });
      // Swords and axes: at the hip on the march, swung in the fight, dropped by the fallen.
      const swordsmen = armed(["sword", "axe"]);
      this.blades?.set(swordsmen.length, (n, out) => {
        const { q, i } = swordsmen[n]!,
          size = this.figure.scale * q.size,
          c = Math.cos(q.yaw),
          sn = Math.sin(q.yaw),
          fallen = q.doing === "fallen",
          swing = q.doing === "fight" ? -1.2 * Math.abs(Math.sin(clock * 2.6 + i * 1.3)) : 0.2,
          axe = this.kits[q.side]!.arm === "axe",
          across = 0.14,
          ahead = fallen ? -0.3 : 0.08;
        out[0] = q.x * M + (across * c + ahead * sn) * size;
        out[1] = (fallen ? 0.03 : 0.3) * size;
        out[2] = q.z * M + (-across * sn + ahead * c) * size;
        out[3] = 0.016 * size;
        out[4] = (axe ? 0.3 : 0.38) * size;
        out[5] = (axe ? 0.07 : 0.03) * size;
        out[6] = q.yaw;
        out[7] = fallen ? -Math.PI / 2 : swing;
      });
      // Bows: in the left hand, drawn in the fight, dropped by the fallen.
      const archers = armed(["bow", "horn-bow"]);
      this.bows?.set(archers.length, (n, out) => {
        const { q } = archers[n]!,
          size = this.figure.scale * q.size,
          c = Math.cos(q.yaw),
          sn = Math.sin(q.yaw),
          fallen = q.doing === "fallen",
          across = -0.14,
          ahead = fallen ? -0.3 : q.doing === "fight" ? 0.2 : 0.06;
        out[0] = q.x * M + (across * c + ahead * sn) * size;
        out[1] = (fallen ? 0.03 : 0.42) * size;
        out[2] = q.z * M + (-across * sn + ahead * c) * size;
        out[3] = 0.014 * size;
        out[4] = 0.5 * size;
        out[5] = 0.03 * size;
        out[6] = q.yaw;
        out[7] = fallen ? -Math.PI / 2 : 0;
      });
      // Shields on the left arm, square to the foe; the fallen's lying by them.
      this.shields.forEach((batch, side) => {
        if (!batch) return;
        batch.set(this.soldiersEach, (k, out) => {
          const q = troops[side * this.soldiersEach + k]!,
            size = this.figure.scale * q.size,
            c = Math.cos(q.yaw),
            sn = Math.sin(q.yaw),
            fallen = q.doing === "fallen",
            across = fallen ? -0.25 : -0.15,
            ahead = fallen ? 0.1 : 0.1;
          out[0] = q.x * M + (across * c + ahead * sn) * size;
          out[1] = (fallen ? 0.02 : 0.34) * size;
          out[2] = q.z * M + (-across * sn + ahead * c) * size;
          out[3] = 0.22 * size;
          out[4] = (fallen ? 0.02 : 0.28) * size;
          out[5] = (fallen ? 0.24 : 0.025) * size;
          out[6] = q.yaw;
        });
      });
    }
    // What they carry, where they go with it.
    let n = 0;
    plan.people.forEach((p, i) => {
      const m = this.moments[i]!;
      if (m.hidden || !m.carry) return;
      const c =
        this.carriers[n] ?? (this.carriers[n] = { x: 0, z: 0, yaw: 0, carry: "tool", size: 1 });
      c.x = m.x * M;
      c.z = m.z * M;
      c.yaw = m.yaw;
      c.carry = m.carry;
      c.size = (p.child ? 0.7 : 1) * this.figure.scale * (this.sizes[i] ?? 1);
      n++;
    });
    this.carriers.length = n;
    this.work.update((t % 86_400) / 3600, screen, this.carriers);
    if (this.marked !== null) {
      const m = this.moments[this.marked];
      this.marker.enabled = !!m && !m.hidden;
      if (m) this.marker.setLocalPosition(m.x * M, 0.03, m.z * M);
    }
  }

  /**
   * A war's two hosts armed (M87; Phase 40 M204: as a war comes to the town): each side in its
   * realm's colour, each part of the figure a batch, its arms (spears, blades, bows) and its
   * shields — as many a side as the setting draws, and their fallen. Armed again only when the
   * sides change.
   */
  private arm(sides: TownWar["sides"] | null): void {
    const key = sides
      ? sides
          .map((x) => `${x.color.join(",")}:${x.host?.arm ?? ""}:${x.host?.guard ?? ""}`)
          .join("|")
      : "";
    if (key === this.armed || !this.plan || !this.meshes) return;
    this.armed = key;
    for (const b of this.soldierBatches) b.destroy();
    this.batches = this.batches.filter((b) => !this.soldierBatches.includes(b));
    this.soldierBatches = [];
    this.soldierLimbs = new Float32Array(0);
    const plan = this.plan,
      s = this.stage,
      meshes = this.meshes,
      battle = sides ? { attacker: sides[0], defender: sides[1] } : null,
      kept = (...args: ConstructorParameters<typeof InstancedBatch>) => {
        const b = this.batch(...args);
        this.soldierBatches.push(b);
        return b;
      };
    this.soldiersEach = battle ? 2 * (SOLDIERS[s.quality.detail] ?? 10) : 0;

    this.soldiers = battle
      ? [battle.attacker.color, battle.defender.color].map((c) => {
          const body: Rgb = [c[0], c[1], c[2]],
            legs: Rgb = [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5],
            paint = figurePaint(plan.body, plan.era, 0);
          // (A people in their own look fight in their hide, their realm's colour over it.)
          return this.figure.parts.map((part) =>
            kept(
              s,
              meshes[part.shape],
              paint.folk
                ? part.tone === 5
                  ? body
                  : paint.tones[part.tone]
                : part.tone === 2
                  ? SKIN
                  : part.tone === 4
                    ? EYES
                    : part.tone === 3
                      ? HAIRS[1]!
                      : part.tone
                        ? legs
                        : body,
              this.soldiersEach,
              this.root,
            ),
          );
        })
      : [];
    this.kits = battle
      ? [battle.attacker, battle.defender].map((side) => ({
          arm: side.host?.arm || "spear",
          shield: side.host?.guard === "shield",
        }))
      : [];
    const bears = (arms: readonly string[]) => this.kits.some((k) => arms.includes(k.arm));
    this.spears = bears(["spear", ...GUNS])
      ? kept(s, meshes.box, [0.52, 0.38, 0.24], this.soldiersEach * 2, this.root)
      : null;
    this.blades = bears(["sword", "axe"])
      ? kept(s, meshes.box, [0.8, 0.82, 0.86], this.soldiersEach * 2, this.root)
      : null;
    this.bows = bears(["bow", "horn-bow"])
      ? kept(s, meshes.box, [0.4, 0.26, 0.12], this.soldiersEach * 2, this.root)
      : null;
    // (Shields in their side's colour, a little brighter.)
    this.shields = battle
      ? [battle.attacker.color, battle.defender.color].map((c, side) =>
          this.kits[side]!.shield
            ? kept(
                s,
                meshes.box,
                [
                  Math.min(1, c[0] * 1.2 + 0.1),
                  Math.min(1, c[1] * 1.2 + 0.1),
                  Math.min(1, c[2] * 1.2 + 0.1),
                ],
                this.soldiersEach,
                this.root,
              )
            : null,
        )
      : [];
  }

  /**
   * The trees as the woodlot has them (Phase 41 M200): each part's trees, those felled hidden and
   * saplings grown small (none felled: `f` null); and the stumps.
   */
  private plant(f: Felling | null): void {
    for (const part of this.forest)
      part.batch.set(part.list.length, (i, out) => {
        const t = part.list[i]!,
          k = part.index[i]!;
        let as = t;
        if (f?.down.has(k)) {
          const g = f.saplings.get(k);
          if (g === undefined) {
            out[0] = t.x * M;
            out[1] = -10;
            out[2] = t.z * M;
            out[3] = out[4] = out[5] = 0;
            out[6] = 0;
            return;
          }
          as = { ...t, size: t.size * (0.2 + 0.8 * g) };
        }
        out[0] = t.x * M;
        out[1] = part.y(as);
        out[2] = t.z * M;
        out[3] = out[5] = part.w(as);
        out[4] = part.h(as);
        out[6] = t.x + t.z;
      });
    const stumps = (f?.stumps ?? []).filter((k) => k < this.forestTrees.length),
      fb = this.felled;
    if (!fb) return;
    fb.stumps.set(stumps.length, (i, out) => {
      const t = this.forestTrees[stumps[i]!]!;
      out[0] = t.x * M;
      out[1] = 0.025;
      out[2] = t.z * M;
      out[3] = out[5] = 0.15;
      out[4] = 0.05;
      out[6] = t.x;
    });
  }

  /** The trees coming down or lying now: tipped over away from their fellers, cut shorter as their logs go. */
  private fallen(f: Felling): void {
    const fb = this.felled;
    if (!fb) return;
    const trees = this.forestTrees,
      list = f.falling.filter((x) => x.index < trees.length).slice(0, FELLING),
      /** Along a tree's length, tipped by `p` toward `yaw`: from its foot, `d` up its height; its own breadth `r` lifting it off the ground as it lies. */
      put = (out: number[], t: Tree, yaw: number, p: number, d: number, r: number) => {
        out[0] = t.x * M + Math.sin(yaw) * Math.sin(p) * d;
        out[1] = Math.cos(p) * d + r * Math.sin(p);
        out[2] = t.z * M + Math.cos(yaw) * Math.sin(p) * d;
        out[6] = yaw;
        out[7] = p;
      },
      tip = (over: number) => over * (Math.PI / 2 - 0.05);
    // (Cut into logs from its foot: what is left lies toward its crown's end.)
    fb.trunks.set(list.length, (i, out) => {
      const x = list[i]!,
        t = trees[x.index]!,
        whole = 0.7 * t.size,
        h = whole * Math.max(0.15, x.left);
      put(out, t, x.yaw, tip(x.over), whole - h / 2, 0.06);
      out[3] = out[5] = 0.12;
      out[4] = h;
    });
    // (Its crown goes with the first logs: lopped, then carried off as brush.)
    for (const [kind, b] of fb.crowns) {
      const mine = list.filter((x) => trees[x.index]!.kind === kind && x.left > 0.6),
        shape = CROWNS[kind as "conifer" | "broadleaf" | "palm"];
      b.set(mine.length, (i, out) => {
        const x = mine[i]!,
          t = trees[x.index]!;
        put(out, t, x.yaw, tip(x.over), shape.at * t.size, (shape.w * t.size) / 2);
        out[3] = out[5] = shape.w * t.size;
        out[4] = shape.h * t.size;
      });
    }
  }

  /** The woodlot as last drawn (the look tools): trees down, stumps, saplings, and those coming down or lying. */
  fellingShown(): {
    down: number;
    stumps: number;
    saplings: number;
    next: number | null;
    falling: { over: number; left: number; x: number; z: number }[];
  } | null {
    const f = this.fellNow;
    if (!f) return null;
    return {
      down: f.down.size,
      stumps: f.stumps.length,
      saplings: f.saplings.size,
      next: f.next,
      falling: f.falling.map((x) => ({
        over: x.over,
        left: x.left,
        x: this.forestTrees[x.index]?.x ?? 0,
        z: this.forestTrees[x.index]?.z ?? 0,
      })),
    };
  }

  /** The lot of the town's plan nearest a point of it (metres; -1: none, or no town). */
  lotAt(x: number, z: number): number {
    return this.plan?.town ? this.town.lotOf(x, z) : -1;
  }

  /**
   * What struck the town as last drawn (the look tools, Phase 42 M201): its homes alight, smoking,
   * in dust, drawn and in all; how the ground shakes; who is at its fires and rubble, by what.
   */
  blazeShown(): {
    fires: number;
    smoke: number;
    dust: number;
    alight: number;
    shake: number;
    fight: Record<string, number>;
    /** Where the first home alight and the first in dust are (metres), if any. */
    burning: { x: number; z: number } | null;
    dusty: { x: number; z: number } | null;
  } | null {
    const plan = this.plan;
    if (!plan?.town) return null;
    const b = this.town.blaze(this.lastT),
      spot = (f: { x: number; z: number } | undefined) => (f ? { x: f.x, z: f.z } : null);
    return {
      ...this.blazeLayer.shown,
      alight: b.fires.length,
      shake: b.shake,
      fight: fightNow(plan, this.lastT),
      burning: spot(b.fires[0]),
      dusty: spot(b.dust[0]),
    };
  }

  /**
   * The town's hunt as drawn (the look tools, Phase 47 M209): today's (where the rush finds the
   * herd, where one falls), the game now (as the day has it, and as drawn), and those at the hunt
   * now — what they are about, how, and what they carry.
   */
  huntShown(): {
    hunt: { target: { x: number; z: number }; kill: { x: number; z: number } | null } | null;
    game: {
      x: number;
      z: number;
      alert: number;
      running: boolean;
      down: { x: number; z: number } | null;
    } | null;
    drawn: { alive: number; dead: number; x: number; z: number; running: boolean } | null;
    hunters: {
      x: number;
      z: number;
      why: string | null;
      task: string | null;
      carry: string | null;
    }[];
  } | null {
    const plan = this.plan;
    if (!plan) return null;
    const hunt = huntOn(plan, Math.floor(this.lastT / 86_400)),
      game = gameAt(plan, this.lastT);
    return {
      hunt: hunt
        ? {
            target: { x: hunt.target.x, z: hunt.target.z },
            kill: hunt.kill ? { x: hunt.kill.x, z: hunt.kill.z } : null,
          }
        : null,
      game: game
        ? {
            x: game.x,
            z: game.z,
            alert: game.alert,
            running: game.running,
            down: game.down ? { x: game.down.x, z: game.down.z } : null,
          }
        : null,
      drawn: this.fauna.gameNow(),
      hunters: this.moments
        .filter(
          (m) =>
            m &&
            !m.hidden &&
            (m.carry === "kill" ||
              /hunt|the herd|the kill|after game/i.test(m.why ?? "") ||
              m.task === "stalk" ||
              m.task === "strike"),
        )
        .map((m) => ({ x: m.x, z: m.z, why: m.why, task: m.task, carry: m.carry })),
    };
  }

  /**
   * The town's trade as drawn (the look tools, Phase 48 M210): its plan's, and each of its traders
   * now (by their place in the plan) — where, what they are about and carry, and whether drawn.
   */
  tradeShown(days = 0): {
    trade: { out: TradeGood[]; in: TradeGood[] } | null;
    traders: {
      index: number;
      x: number;
      z: number;
      why: string | null;
      carry: string | null;
      hidden: boolean;
    }[];
    trips: {
      index: number;
      out: number;
      back: number;
      land: string;
      take: string | null;
      bring: string | null;
    }[];
  } | null {
    const plan = this.plan;
    if (!plan) return null;
    // (The trips its traders set out on from today for so many days, by the day they set out.)
    const today = Math.floor(this.lastT / 86_400),
      trips: {
        index: number;
        out: number;
        back: number;
        land: string;
        take: string | null;
        bring: string | null;
      }[] = [];
    if (days > 0)
      plan.people.forEach((_, index) => {
        const seat = traderSeat(plan, index);
        if (seat >= 0)
          for (let d = today; d < today + days; d++) {
            const on = tripOn(plan, seat, d);
            if (on?.part === "out")
              trips.push({
                index,
                out: on.trip.out,
                back: on.trip.back,
                land: on.trip.land,
                take: on.trip.take?.what ?? null,
                bring: on.trip.bring?.what ?? null,
              });
          }
      });
    return {
      trade: plan.trade ? { out: [...plan.trade.out], in: [...plan.trade.in] } : null,
      traders: plan.people.flatMap((_, index) => {
        const m = this.moments[index];
        return traderSeat(plan, index) >= 0 && m
          ? [{ index, x: m.x, z: m.z, why: m.why, carry: m.carry, hidden: m.hidden }]
          : [];
      }),
      trips: trips.sort((a, b) => a.out - b.out || a.index - b.index),
    };
  }

  /**
   * The town's flock as drawn (the look tools, Phase 46 M208): what it is about and where, its fold,
   * the stubble it grazes (a field's index; -1: its pasture), each of it (how big, lying or not),
   * and its herders at work now with what they are about.
   */
  flockShown(): {
    state: FlockState;
    x: number;
    z: number;
    fold: { x: number; z: number };
    stubble: number;
    beasts: { x: number; z: number; size: number; lying: boolean }[];
    herders: { x: number; z: number; why: string | null }[];
  } | null {
    const plan = this.plan,
      fl = plan ? flockAt(plan, this.lastT) : null;
    if (!plan || !fl) return null;
    const fold = foldOf(plan);
    return {
      state: fl.state,
      x: fl.x,
      z: fl.z,
      fold: { x: fold.x, z: fold.z },
      stubble: fl.stubble,
      beasts: this.fauna.flockNow(),
      herders: this.moments
        .filter((m) => m && !m.hidden && m.task === "herd")
        .map((m) => ({ x: m.x, z: m.z, why: m.why })),
    };
  }

  /**
   * The year in the town's fields as drawn (the look tools, Phase 44 M206): how it stands; its crop
   * as laid out (rows standing, withered, in stubble; stooks; fires of the blighted crop); the
   * fields being reaped today (how far, where their front is); those watered and pulled today;
   * and how many of those drawn are at the fields' work now, by what they are at ("cart": those
   * carrying in the sheaves of the fields reaped).
   */
  fieldsShown(): {
    year: FieldsNow;
    crop: ReturnType<CountryLayer["cropShown"]>;
    reaping: { field: number; share: number; x: number; z: number }[];
    watered: number[];
    pulled: number[];
    at: Record<string, number>;
  } | null {
    const plan = this.plan;
    if (!plan) return null;
    const t = this.lastT,
      day = Math.floor(t / 86_400),
      at: Record<string, number> = {};
    for (const m of this.moments) {
      if (!m || m.hidden) continue;
      if (m.task && ["reap", "gather", "water", "pull", "fill"].includes(m.task))
        at[m.task] = (at[m.task] ?? 0) + 1;
      // (Those carrying in the sheaves of the fields reaped, out to the stooks or back.)
      else if (
        m.why &&
        /^(Out to the stooks|Taking up sheaves|Carrying the sheaves in)/.test(m.why)
      )
        at["cart"] = (at["cart"] ?? 0) + 1;
    }
    return {
      year: this.yearNow,
      crop: this.country.cropShown(),
      reaping: reapingOn(plan, day).map((k) => {
        const f = frontOf(plan, k, t)!;
        return { field: k, share: reapedAt(plan, k, t), x: f.x, z: f.z };
      }),
      watered: wateredOn(plan, day, this.yearNow),
      pulled: pulledOn(plan, day, this.yearNow),
      at,
    };
  }

  /**
   * The wounds as last drawn (the look tools, Phase 55 M226): how many drawn wear a look, and what
   * of them is drawn by kind; who is abed now, how many away with the levy or gone; the homes of
   * those abed; the wounds healing now or to come; those marked for good; the homecomings of the
   * next ten days.
   */
  woundsShown(): {
    looks: number;
    drawn: {
      bandage: number;
      patch: number;
      sling: number;
      crutch: number;
      scar: number;
      stumps: number;
    };
    abed: number[];
    away: number;
    gone: number;
    homes: { index: number; x: number; z: number }[];
    healing: { index: number; ref: string; up: number; mended: number }[];
    lasting: { index: number; ref: string; marks: string[] }[];
    homecomings: {
      event: string;
      at: number;
      where: string;
      people: number;
      wounded: number;
      borne: number;
    }[];
    /** The day's litters (Phase 55 M229): whom each bears, when it is taken up and set down, its bearers. */
    litters: { index: number; start: number; arrive: number; bearers: number[] }[];
    /** The litters drawn now: where, whether borne, whom. */
    littersNow: { x: number; z: number; borne: boolean; index: number }[];
    /** Where the road leaves the town (metres). */
    edge: { x: number; z: number };
  } | null {
    const plan = this.plan;
    if (!plan) return null;
    const t = this.lastT,
      day = Math.floor(t / 86_400),
      abed: number[] = [],
      homes: { index: number; x: number; z: number }[] = [],
      healing: { index: number; ref: string; up: number; mended: number }[] = [],
      lasting: { index: number; ref: string; marks: string[] }[] = [];
    let away = 0,
      gone = 0;
    plan.people.forEach((p, i) => {
      if (p.gone !== undefined && p.gone <= t) gone++;
      else if (p.away?.some((a) => a.from <= t && t < a.until)) away++;
      if (!p.wounds?.length) return;
      if (
        p.wounds.some((w) => woundStage(w, t) === "abed") &&
        !(p.gone !== undefined && p.gone <= t)
      ) {
        abed.push(i);
        const h = plan.homes[p.home];
        if (h) homes.push({ index: i, x: h.x, z: h.z });
      }
      for (const w of p.wounds)
        if (w.mended > t) healing.push({ index: i, ref: p.ref, up: w.up, mended: w.mended });
      const l = lookNow(p, t),
        marks = [
          ...(l.crutch ? ["crutch"] : []),
          ...(l.limp ? ["limp"] : []),
          ...(l.stiff ? ["stiff"] : []),
          ...(l.patch ? ["patch"] : []),
          ...(l.lost.some((m) => !m.startsWith("eye")) ? ["stump"] : []),
        ];
      if (marks.length) lasting.push({ index: i, ref: p.ref, marks });
    });
    // (The homecomings of the next ten days: each, how many come, of them wounded, borne.)
    const homecomings = Array.from({ length: 11 }, (_, k) => homecomingsOn(plan, day + k))
      .flat()
      .map((h) => ({
        event: h.event,
        at: h.at,
        where: h.where,
        people: h.people.length,
        wounded: h.people.filter((q) => q.wounded).length,
        borne: h.people.filter((q) => q.borne).length,
      }));
    return {
      looks: this.gearNow.filter((g, i) => g && !this.moments[i]?.hidden).length,
      drawn: { ...this.worn.shown, stumps: this.stumpsDrawn },
      abed,
      away,
      gone,
      homes,
      healing: healing.sort((a, b) => a.up - b.up || a.index - b.index),
      lasting,
      homecomings,
      litters: littersOn(plan, day).map((l) => ({
        index: l.index,
        start: l.start,
        arrive: l.arrive,
        bearers: [...l.bearers],
      })),
      littersNow: this.littersShown.map((q) => ({
        x: q.x,
        z: q.z,
        borne: q.borne,
        index: q.index,
      })),
      edge: roadEdge(plan),
    };
  }

  /**
   * The town's graveyard and its burying as last drawn (the look tools, Phase 43 M205): where it
   * lies and how it is laid out; its graves; what of them is drawn; the funerals to come.
   */
  graveyardShown(days = 30): {
    gate: { x: number; z: number };
    way: number;
    rows: number;
    sections: number;
    w: number;
    d: number;
    x: number;
    z: number;
    graves: number;
    freshFrom: number;
    perYear: number;
    stones: number;
    fallen: number;
    crosses: number;
    fresh: number;
    mounds: number;
    open: number;
    heaps: number;
    biers: number;
    borne: number;
    /** Where the first bier is now (metres), and whether it is borne. */
    bier: { x: number; z: number; borne: boolean } | null;
    funerals: ReturnType<typeof funeralsAhead>;
  } | null {
    const plan = this.plan,
      yard = this.graveyard.yard;
    if (!plan || !yard) return null;
    const b = burialNow(plan, this.lastT);
    return {
      gate: { x: yard.gate.x, z: yard.gate.z },
      way: yard.way,
      rows: yard.rows,
      sections: yard.sections,
      w: yard.w,
      d: yard.d,
      x: yard.x,
      z: yard.z,
      graves: b.graves,
      freshFrom: gravesBefore(plan),
      perYear: plan.rest?.perYear ?? 0,
      ...this.graveyard.shown,
      bier: b.biers[0] ? { x: b.biers[0].x, z: b.biers[0].z, borne: b.biers[0].borne } : null,
      funerals: funeralsAhead(plan, this.lastT, days),
    };
  }

  /**
   * The town's trades as last drawn (the look tools): its works by kind, the sails' turn, kilns
   * aglow, sparks; the furnace aglow and the tools on the rack (Phase 51 M213).
   */
  tradesNow(): {
    mills: number;
    kilns: number;
    smithies: number;
    turn: number;
    glowing: number;
    sparks: number;
    smelting: boolean;
    hung: number;
    rack: { x: number; z: number } | null;
  } {
    const n = (k: string) => this.trades.works.filter((w) => w.kind === k).length;
    return { mills: n("mill"), kilns: n("kiln"), smithies: n("smithy"), ...this.trades.shown };
  }

  /**
   * The tool hung on the smithy's rack nearest a point of the screen, if one is within `reach`
   * pixels of it (Phase 51 M213): who made it, which of theirs today, what — and the rack's day.
   */
  rackItemAt(x: number, y: number, reach = 26): (Hung & { readonly day: number }) | null {
    const rack = this.rackKept?.rack;
    if (!rack) return null;
    let best: Hung | null = null,
      near = reach;
    this.rackOnScreen().forEach((p, k) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < near) {
        near = d;
        best = rack.hung[k]!;
      }
    });
    return best ? { ...(best as Hung), day: Math.floor(this.lastT / 86_400) } : null;
  }

  /** A point of the scene on the screen (behind the eye, nowhere). */
  private onScreen(x: number, y: number, z: number): { x: number; y: number } {
    const p = this.stage.camera.camera!.worldToScreen(new pc.Vec3(x * M, y * M, z * M));
    return p.z > 0 ? { x: p.x, y: p.y } : { x: -1e6, y: -1e6 };
  }

  /** Where each pot on the kilns' boards stands on the screen now (the look tools, Phase 51 M214). */
  potsOnScreen(): { x: number; y: number; form: string; kiln: number }[] {
    return (this.craftsKept?.boards ?? []).flatMap((b, kiln) =>
      b.pots.map((pot, k) => {
        const at = boardSlot(b, k);
        return { ...this.onScreen(at.x, 2.6, at.z), form: pot.form, kiln };
      }),
    );
  }

  /** Where each of the foundry's moulds lies on the screen now (the look tools, Phase 51 M215). */
  mouldsOnScreen(): { x: number; y: number; poured: boolean }[] {
    return (this.craftsKept?.foundry?.moulds ?? []).map((m) => ({
      ...this.onScreen(m.x, 1, m.z),
      poured: m.since !== null,
    }));
  }

  /** Where each of the works' machines stands on the screen now, and whether it runs (the look tools, Phase 51 M215). */
  machinesOnScreen(): { x: number; y: number; kind: "lathe" | "press"; running: boolean }[] {
    return (this.craftsKept?.floor?.machines ?? []).map((m) => ({
      ...this.onScreen(m.x, m.kind === "lathe" ? 3.5 : 2, m.z),
      kind: m.kind,
      running: m.running,
    }));
  }

  /** Where each finished part on the works' bench lies on the screen now (the look tools, Phase 51 M215). */
  benchOnScreen(): { x: number; y: number; form: string }[] {
    const floor = this.craftsKept?.floor;
    if (!floor) return [];
    return floor.benched.map((part, k) => {
      const at = benchSlot(floor, k);
      return { ...this.onScreen(at.x, 2.7, at.z), form: part.form };
    });
  }

  /** Where the middle of each loom's cloth hangs on the screen now (the look tools, Phase 51 M214). */
  loomsOnScreen(): { x: number; y: number; woven: number; index: number }[] {
    return (this.craftsKept?.looms ?? []).map((l) => ({
      ...this.onScreen(l.x, 5.75 - Math.max(0.3, l.woven) * 1.8, l.z),
      woven: l.woven,
      index: l.index,
    }));
  }

  /**
   * The crafts as last drawn (the look tools, Phase 51 M214): the wheels and how many turn, the
   * pots on the boards, the looms and how many are woven at, the clamp's round; where each is.
   */
  craftsNow(): CraftsLayer["shown"] & {
    wheelsAt: { x: number; z: number; turning: boolean }[];
    boardsAt: { x: number; z: number; pots: number }[];
    loomsAt: { x: number; z: number; woven: number; index: number }[];
    clampAt: { x: number; z: number; stage: number; lit: boolean } | null;
    foundry: FoundryLayer["shown"];
    foundryAt: { x: number; z: number; moulds: { x: number; z: number; poured: boolean }[] } | null;
    floor: FloorLayer["shown"];
    floorAt: {
      machines: { x: number; z: number; kind: "lathe" | "press"; running: boolean }[];
      bench: { x: number; z: number };
      benched: number;
    } | null;
  } {
    const k = this.craftsKept,
      f = k?.foundry ?? null,
      w = k?.floor ?? null;
    return {
      ...this.crafts.shown,
      foundry: this.foundryLayer.shown,
      floor: this.floorLayer.shown,
      floorAt: w
        ? {
            machines: w.machines.map((m) => ({ x: m.x, z: m.z, kind: m.kind, running: m.running })),
            bench: { x: w.bench.x, z: w.bench.z },
            benched: w.benched.length,
          }
        : null,
      foundryAt: f
        ? {
            x: f.cupola.x,
            z: f.cupola.z,
            moulds: f.moulds.map((m) => ({ x: m.x, z: m.z, poured: m.since !== null })),
          }
        : null,
      wheelsAt: (k?.wheels ?? []).map((w) => ({ x: w.x, z: w.z, turning: w.turning })),
      boardsAt: (k?.boards ?? []).map((b) => ({ x: b.x, z: b.z, pots: b.pots.length })),
      loomsAt: (k?.looms ?? []).map((l) => ({ x: l.x, z: l.z, woven: l.woven, index: l.index })),
      clampAt: k?.clamp
        ? { x: k.clamp.x, z: k.clamp.z, stage: k.clamp.stage, lit: k.clamp.lit }
        : null,
    };
  }

  /**
   * The thing being made nearest a point of the screen, within `reach` pixels (Phase 51 M213–M215):
   * a tool on the smithy's rack, a pot on a kiln's boards, the cloth on a loom (its cloth's middle,
   * a reach and a half), a casting in its mould, a part on the works' bench or in a machine at work
   * — its maker (among those drawn), their trade, which of theirs, what, the day.
   */
  madeAt(
    x: number,
    y: number,
    reach = 26,
  ): {
    trade: "smith" | "potter" | "weaver" | "founder" | "machinist";
    index: number;
    n: number;
    form: string;
    day: number;
  } | null {
    let best: ReturnType<VillageScene["madeAt"]> = null,
      near = Infinity;
    const offer = (d: number, made: NonNullable<typeof best>) => {
      if (d < near) {
        near = d;
        best = made;
      }
    };
    const rack = this.rackKept?.rack,
      today = Math.floor(this.lastT / 86_400);
    if (rack)
      this.rackOnScreen().forEach((p, k) => {
        const d = Math.hypot(p.x - x, p.y - y),
          h = rack.hung[k];
        if (h && d < reach)
          offer(d, { trade: "smith", index: h.index, n: h.n, form: h.form, day: today });
      });
    const boards = this.craftsKept?.boards ?? [];
    this.potsOnScreen().forEach((p, j) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d >= reach) return;
      // (The j-th pot drawn: its kiln's and its place on those boards.)
      let k = j,
        b = 0;
      while (b < boards.length && k >= boards[b]!.pots.length) k -= boards[b++]!.pots.length;
      const pot = boards[b]?.pots[k];
      if (pot)
        offer(d, { trade: "potter", index: pot.index, n: pot.n, form: pot.form, day: pot.day });
    });
    const foundry = this.craftsKept?.foundry;
    this.mouldsOnScreen().forEach((p, m) => {
      const d = Math.hypot(p.x - x, p.y - y),
        mould = foundry?.moulds[m];
      if (mould?.form && mould.index >= 0 && d < reach)
        offer(d, { trade: "founder", index: mould.index, n: m, form: mould.form, day: mould.day });
    });
    const floor = this.craftsKept?.floor;
    this.benchOnScreen().forEach((p, k) => {
      const d = Math.hypot(p.x - x, p.y - y),
        part = floor?.benched[k];
      if (part && d < reach)
        offer(d, { trade: "machinist", index: part.index, n: part.n, form: part.form, day: today });
    });
    this.machinesOnScreen().forEach((p, m) => {
      const d = Math.hypot(p.x - x, p.y - y),
        mc = floor?.machines[m];
      if (mc?.running && mc.part && mc.index >= 0 && d < reach * 1.5)
        offer(d / 1.5, { trade: "machinist", index: mc.index, n: mc.n, form: mc.part, day: today });
    });
    this.loomsOnScreen().forEach((p, j) => {
      const d = Math.hypot(p.x - x, p.y - y),
        loom = this.craftsKept?.looms[j];
      if (loom && d < reach * 1.5)
        offer(d / 1.5, { trade: "weaver", index: loom.index, n: 0, form: "length", day: loom.day });
    });
    return best;
  }

  /** Where each tool on the rack hangs on the screen now (the look tools), the first made first. */
  rackOnScreen(): { x: number; y: number; form: string }[] {
    const rack = this.rackKept?.rack;
    if (!rack) return [];
    return rack.hung.map((h, k) => {
      const at = rackSlot(rack, k),
        // (Halfway down its haft, where a tap on it lands; behind the eye, nowhere.)
        p = this.stage.camera.camera!.worldToScreen(new pc.Vec3(at.x * M, 3 * M, at.z * M));
      return p.z > 0 ? { x: p.x, y: p.y, form: h.form } : { x: -1e6, y: -1e6, form: h.form };
    });
  }

  /** The war about the town now (null: none): its soldiers armed for its sides as it comes. */
  war(tw: TownWar | null): void {
    this.townWar = tw;
    this.arm(tw?.sides ?? null);
  }

  /** The war about the town as last drawn (the look tools). */
  warNow(): { war: TownWar; scene: TownWarScene; tents: number; fires: number } | null {
    return this.townWar && this.warScene
      ? { war: this.townWar, scene: this.warScene, ...this.warLayer.shown }
      : null;
  }

  /** Whether a soldier of the war about the town stands at a point of its ground (metres). */
  soldierAt(x: number, z: number, reach = 4): boolean {
    return !!this.warScene?.soldiers.some(
      (q) => q.size > 0.5 && Math.hypot(q.x - x, q.z - z) < reach,
    );
  }

  /** Where each host of the war about the town stands on the screen (null: none, or off it). */
  hostsOnScreen(): ({ x: number; y: number } | null)[] {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3();
    return (this.warScene?.middles ?? [null, null]).map((m) => {
      if (!m) return null;
      const p = cam.worldToScreen(new pc.Vec3(m.x * M, 0.8, m.z * M), at);
      return p.z > 0 ? { x: p.x, y: p.y } : null;
    });
  }

  /** What a watched person is doing now. */
  momentAt(index: number): Moment | null {
    return this.moments[index] ?? null;
  }

  /** The watched person nearest a screen point, within a finger's reach. */
  pick(x: number, y: number, reach = 28): number | null {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3();
    let best: number | null = null,
      bestD = reach * reach;
    this.moments.forEach((m, i) => {
      if (m.hidden) return;
      const p = cam.worldToScreen(new pc.Vec3(m.x * M, 0.2, m.z * M), at),
        d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (p.z > 0 && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /** Everyone in sight now: where (metres), doing what, at what (for the look tools). */
  peopleNow(): {
    name: string;
    x: number;
    z: number;
    activity: number;
    task: string | null;
    size: number;
    /** Which of those drawn, their ref, whether one of the town's many (Phase 39), what they carry and why. */
    index: number;
    ref: string;
    folk: boolean;
    carry: string | null;
    why: string | null;
  }[] {
    const plan = this.plan;
    if (!plan) return [];
    return this.moments.flatMap((m, i) =>
      m.hidden
        ? []
        : [
            {
              name: plan.people[i]!.name,
              x: m.x,
              z: m.z,
              activity: m.activity,
              task: m.task,
              size: this.sizes[i] ?? 1,
              index: i,
              ref: plan.people[i]!.ref,
              folk: !!plan.people[i]!.folk,
              carry: m.carry,
              why: m.why,
            },
          ],
    );
  }

  /** How many are in out of a downpour now (for the look tools). */
  shelteredNow(): number {
    return this.moments.filter((m) => m.activity === ACTIVITY.sheltering).length;
  }

  /**
   * What one of those drawn is at today, in words (Phase 39 M198): "felling timber" (null: a town
   * watched growing, or a day of rest).
   */
  workToday(index: number): string | null {
    const plan = this.plan;
    if (!plan || !this.stores?.fine) return null;
    // (As their day was laid: the care of the wounded, a wound's, or the errand the ground gave.)
    return workTold(plan, index, Math.floor(this.lastT / 86_400));
  }

  /** The town's stores now (Phase 39 M198), as last told; null before the first frame. */
  storesShown(): StoresNow | null {
    return this.stores?.now ?? null;
  }

  /** How many of each piece the stores' heaps are drawn with now (the look tools). */
  heapsNow(): ReturnType<WorkLayer["heapsNow"]> {
    return this.work.heapsNow();
  }

  /** Where on the screen one of those drawn stands now (null: out of sight, or indoors). */
  personOnScreen(index: number): { x: number; y: number } | null {
    const m = this.moments[index];
    if (!m || m.hidden) return null;
    const s = this.stage.camera.camera!.worldToScreen(new pc.Vec3(m.x * M, 0.2, m.z * M));
    return s.z > 0 ? { x: s.x, y: s.y } : null;
  }

  /** Everyone carrying something now: where (metres) and what (for the look tools). */
  carriersNow(): { x: number; z: number; carry: string }[] {
    return this.carriers.map((c) => ({ x: c.x / M, z: c.z / M, carry: c.carry }));
  }

  /** Visitors from another star shown (Phase 18 M134): how many groups, figures, and why each is here. */
  visitorsShown(): VisitorsLayer["shown"] {
    return this.visitors.shown;
  }
  /** The visitors (their ship) nearest a screen point: their event, and where to look at them. */
  pickVisitors(x: number, y: number): ReturnType<VisitorsLayer["pick"]> {
    return this.visitors.pick(x, y);
  }
  /** Where to look from to see the first visitors and their people (null with none here). */
  visitorsView(): ReturnType<VisitorsLayer["view"]> {
    return this.visitors.view();
  }
  /** Each group's name over its ship, where it is on the screen. */
  visitorsOnScreen(): ReturnType<VisitorsLayer["onScreen"]> {
    return this.visitors.onScreen();
  }
  /** The eye's yaw that faces the visitors across the village, or null with none. */
  visitorsFacing(): number | null {
    return this.visitors.facing();
  }

  /** Every beast about the village now (for the look tools). */
  faunaNow(): ReturnType<FaunaLayer["now"]> {
    return this.fauna.now();
  }

  /** How many beasts, birds and fish are drawn now. */
  get beastsDrawn(): number {
    return this.fauna.drawn;
  }

  /** The beast nearest a screen point, if no one is: its lineage and what it is doing. */
  pickBeast(x: number, y: number): PickedBeast | null {
    return this.fauna.pick(x, y);
  }

  mark(index: number | null): void {
    this.marked = index;
    if (index === null) this.marker.enabled = false;
  }

  /** Light a beast about the village (as picked), or none. */
  markBeast(index: number | null): void {
    this.fauna.mark(index);
  }

  /** Light a beast of a lineage about the village, if one stands there. */
  markLineage(ref: string): boolean {
    return this.fauna.markLineage(ref);
  }

  /**
   * What the people in view are saying now (M86), as signs over their heads, and the visitors
   * from another star how they came (M134): at most `most` of them, the nearest first.
   */
  bubbles(
    most = 24,
  ): { key: string; text: string; at: { x: number; y: number } | null; priority: number }[] {
    const plan = this.plan;
    if (!plan) return [];
    const cam = this.stage.camera.camera!,
      eye = this.stage.camera.getPosition(),
      clock = performance.now() / 1000,
      head = new pc.Vec3(),
      out: { key: string; text: string; at: { x: number; y: number } | null; priority: number }[] =
        [];
    this.moments.forEach((m, i) => {
      const text = sayOf(plan, i, m, clock, this.blazed !== null, this.mourning);
      if (!text) return;
      const p = plan.people[i]!,
        // (Over their heads, as high as their figure stands.)
        tall =
          (Math.max(...this.figure.parts.map((q) => q.y + partExtent(q)[1] / 2)) + 0.11) *
          (p.child ? 0.7 : 1) *
          this.figure.scale;
      head.set(m.x * M, tall, m.z * M);
      const d = head.distance(eye);
      if (d > 14) return;
      const at = cam.worldToScreen(head);
      out.push({
        key: p.ref,
        text,
        at: at.z > 0 ? { x: at.x, y: at.y } : null,
        priority: -d,
      });
    });
    out.push(...this.visitors.bubbles(clock));
    return out.sort((a, b) => b.priority - a.priority).slice(0, most);
  }

  /** Screen positions of the watched homes, for their families' names. */
  homesOnScreen(): { household: string; at: { x: number; y: number } | null }[] {
    const plan = this.plan;
    if (!plan) return [];
    const cam = this.stage.camera.camera!;
    return plan.homes
      .filter((h) => h.household)
      .map((h) => {
        const p = cam.worldToScreen(new pc.Vec3(h.x * M, 0.9, h.z * M));
        return { household: h.household!, at: p.z > 0 ? { x: p.x, y: p.y } : null };
      });
  }
}
