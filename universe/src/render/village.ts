// A village under the microscope (docs/architecture §9, §28): its ground, fields
// that green and ripen with the year, the pasture and water, the road out, homes
// with their roofs, the square or the market hall, and the watched people going
// about their day. One unit is ten metres; people are drawn three times their size
// so a phone can see them. Instanced throughout: a village is a handful of draw calls. A battle
// fought before it in its own scene (Phase 55 M227): its field laid along its road (render/battle.ts),
// its people indoors while it is fought but for those come out to its edge to watch.
import { TownTraffic } from "./towntraffic.ts";
import * as pc from "playcanvas";
import {
  LAKE_R,
  LOT_D,
  LOT_W,
  townLots,
  townReach,
  woundStage,
  type ColonyLook,
  type HomeMoney,
  type TradeGood,
  type VillagePlan,
  type Visitor,
} from "../bridge/index.ts";
import { TownMoneyLayer, type MoneyHome } from "./townmoney.ts";
import {
  MONEY_LET,
  MONEY_RAMP,
  MONEY_RUIN,
  moneyStep,
  ACTIVITY,
  ARM_LOOKS,
  armLook,
  isGun,
  HAIRS,
  EYES,
  GROUP_COLORS,
  MACHINE_TONES,
  fliersOf,
  SKIN,
  dressedOn,
  biomeColor,
  kindWater,
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
  figureAnatomy,
  armorPanels,
  armorColor,
  type FigurePart,
  keepApart,
  partExtent,
  present,
  ringTurn,
  villageSolids,
  type Presence,
  homeDetail,
  lamplight,
  lifeTint,
  houseLook,
  limbPitch,
  momentsOf,
  rideMoments,
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
  sungAt,
  fireOf,
  type BlazeNow,
  type Burnable,
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
  type LitterNow,
  type WoundGear,
  type BattleField,
  type BattleNow,
  type FigureBody,
  type PlacedFrame,
  type Watcher,
  PORT_ROOM,
} from "../view/index.ts";
import {
  InstancedBatch,
  boxMesh,
  capsuleMesh,
  coneMesh,
  cylinderMesh,
  gableMesh,
} from "./batch.ts";
import { FlierLayer } from "./fliers.ts";
import { FaunaLayer, type PickedBeast } from "./fauna.ts";
import { VisitorsLayer } from "./visitors.ts";
import { WorkLayer, type Carrier } from "./work.ts";
import { ColonyLayer } from "./colony.ts";
import { TownLayer } from "./town.ts";
import { CountryLayer } from "./country.ts";
import { FeastLayer } from "./feast.ts";
import { TownWarLayer } from "./townwar.ts";
import { BattleLayer } from "./battle.ts";
import { TradesLayer, type AtWork, type RackAt } from "./trades.ts";
import { CraftsLayer, type BoardsAt, type ClampAt, type LoomAt, type WheelAt } from "./crafts.ts";
import { FoundryLayer, type FoundryAt } from "./foundry.ts";
import { FloorLayer, type FloorAt } from "./floor.ts";
import { BlazeLayer } from "./blaze.ts";
import { RaidLayer } from "./raid.ts";
import { GraveyardLayer } from "./graveyard.ts";
import { MemorialLayer } from "./memorial.ts";
import { CourtLayer } from "./court.ts";
import { DIVE_SEEN, courtCaseAt, courtSitting, diveAt } from "../view/index.ts";
import { WoundsLayer, bandageOn, propAt, type WornPiece } from "./wounds.ts";
import { LittersLayer, litterApart, litterHeld } from "./litters.ts";
import { FolkPoses, nearReach, redrawn } from "./folk.ts";
import type { PosedHook } from "../view/index.ts";
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
/** The grass of a battle's field before a town (laid flat: no ridge to colour). */
const PLACED_GRASS: Rgb = [0.42, 0.56, 0.3];
/** How many a side a village's battle draws, by the setting's detail (M202: hosts the size of a town's). */
const SOLDIERS = [10, 18, 28, 44];
/** A host's arms that fire (Phase 37 M188): carried as a spear is, levelled to fire. */
const GUNS: readonly string[] = Object.keys(ARM_LOOKS).filter(isGun);
const YEAR = 365 * 86_400;
/** How many beams a side has in the air over a town at once (Phase 66). */
const BOLTS_A_SIDE = 16;
/** A machine gun's tracer rounds, as they burn (W1); a muzzle's flash; powder smoke; the earth a round throws up. */
const TRACER: Rgb = [1, 0.5, 0.18],
  MUZZLE: Rgb = [1, 0.82, 0.42],
  POWDER: Rgb = [0.86, 0.86, 0.84],
  KICKED: Rgb = [0.5, 0.42, 0.32];
/**
 * How a gun fires in a town's fight, as seen (asked for 2026-11-11: a rifle shooting "lasers" made no
 * sense for what it is): how often (s, its rounds a minute hastened for the eye), whether its line
 * fires together, how long its smoke hangs (s) and how thick (black powder's a bank, smokeless
 * powder's a wisp). Its round is not seen in flight; a machine gun's tracers are.
 */
const TOWN_FIRE: Readonly<
  Record<string, { every: number; volley: boolean; smoke: number; thick: number }>
> = {
  musket: { every: 7, volley: true, smoke: 3.4, thick: 1 },
  rifle: { every: 5.5, volley: true, smoke: 3, thick: 0.9 },
  repeater: { every: 2.4, volley: false, smoke: 2.6, thick: 0.8 },
  autoloader: { every: 1.5, volley: false, smoke: 0.8, thick: 0.3 },
  automatic: { every: 1.1, volley: false, smoke: 0.8, thick: 0.3 },
};
/** A gun with no row of its own above. */
const TOWN_FIRE_ELSE = { every: 3, volley: false, smoke: 1.2, thick: 0.5 };
/** A machine gun's burst: so many rounds, so far apart (s); the earth a round throws up hangs so long (s). */
const BURST = { rounds: 5, apart: 0.09 },
  KICK_S = 0.5;
/** A whole number's place between 0 and 1, the same each time (for who fires when). */
const hashUnit = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A material of its own light: a beam's. */
function litMaterial(color: Rgb): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(color[0], color[1], color[2]);
  m.update();
  return m;
}

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

/** A home of a village's ring, not of a lot of its plan (host/home.ts). */
const RING_HOME = 1_000_000;

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
  /** The soldiers about the town told from outside (Phase 67: a raid played again), not by its war's year. */
  warSceneOverride: (() => TownWarScene | null) | null = null;
  /** A film's own fires over the town, in place of what struck it (Phase 67): null to leave it to the town. */
  blazeOverride: (() => BlazeNow | null) | null = null;
  private warScene: TownWarScene | null = null;
  private armed = "";
  private soldierBatches: InstancedBatch[] = [];
  /** Each side's beams in the air, where it bears them (Phase 66); a machine gun's tracers. */
  private townBolts: (InstancedBatch | null)[] = [];
  /** The guns' firing about the town: muzzles' flashes, the powder's smoke, the earth rounds throw up. */
  private townFlash: InstancedBatch | null = null;
  private townPowder: InstancedBatch | null = null;
  private townKicks: InstancedBatch | null = null;
  /** Who fires now, kept from frame to frame (the list made again each frame, not its room). */
  private readonly shotsNow: {
    i: number;
    age: number;
    n: number;
    f: (typeof TOWN_FIRE)[string];
  }[] = [];
  private readonly tracersNow: { x: number; z: number; yaw: number; k: number }[] = [];
  private soldierArmor: InstancedBatch[] = [];
  private soldierArmorParts: FigurePart[][] = [];
  private meshes: Record<PartShape, pc.Mesh> | null = null;
  /** The besiegers' tents and fires, a town burning (M204). */
  private readonly warLayer: TownWarLayer;
  /**
   * A battle fought before the town in its own scene (Phase 55 M227): its layer (made when first
   * wanted), the frame its field is laid on (null: none), whether it casts shadows (the finest
   * setting alone); those come out to watch it and the hosts' fires the night before, as last given.
   */
  private placedLayer: BattleLayer | null = null;
  private placedFrame: PlacedFrame | null = null;
  private placedShadows = false;
  private watchers: readonly Watcher[] = [];
  private campNow: readonly { readonly x: number; readonly z: number }[] = [];
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
  private readonly fliers: FlierLayer;
  /** Visitors from another star (Phase 18 M134): their ship and their people. */
  private readonly visitors: VisitorsLayer;
  /** Its work you can see: what its people carry, its mine and works, its road, its smoke (M78). */
  private readonly work: WorkLayer;
  /** A town built lot by lot (Phase 23), drawn from its fabric in place of its homes and quarters. */
  private readonly town: TownLayer;
  /** A colony's own ground and sky (Phase 64), in place of its land's. */
  readonly colony: ColonyLayer;
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
  private readonly raidLayer: RaidLayer;
  private raided = false;
  private blazed: BlazeNow | null = null;
  /** Its graveyard and its burying (Phase 43 M205): its graves, those open today, the biers borne to them. */
  private readonly graveyard: GraveyardLayer;
  /** What it raised to what happened in it, and the song at its feast (T1). */
  private readonly memorialLayer: MemorialLayer;
  private readonly courtLayer: CourtLayer;
  /** What a town's people keep and ride (R1). */
  private readonly rides: TownTraffic;
  /** The moment last drawn (a possession's clock isn't the world's: J1). */
  private courtT = 0;
  /** Who sings at its feast now: their place among those drawn (-1: no one), and the day it was chosen for. */
  private singer = -1;
  private singerDay = -1;
  /** Wounds worn (Phase 55 M226): bandages, patches, slings, crutches, scars. */
  private readonly worn: WoundsLayer;
  /** The levy's wounded borne home on litters (Phase 55 M229), and those last drawn. */
  private readonly litters: LittersLayer;
  /** Its money laid over it (Lives L6): made when first asked for. */
  private readonly moneyLayer: TownMoneyLayer;
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
  /** What stands on its square, and whether it is shown (put afresh when that changes). */
  private squareHall: { shown: boolean; put: (shown: boolean) => void } | null = null;
  key: string | null = null;
  /**
   * One of its people possessed (Phase 60): the clock the town is drawn at, the bodies the small
   * world moves drawn where it has them, those it struck down lying where they fell.
   */
  posed: PosedHook | null = null;

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
    this.fliers = new FlierLayer(stage, this.root);
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
    this.raidLayer = new RaidLayer(stage, this.root);
    this.graveyard = new GraveyardLayer(stage, this.root);
    this.memorialLayer = new MemorialLayer(stage, this.root);
    this.courtLayer = new CourtLayer(stage, this.root);
    this.rides = new TownTraffic(stage, this.root);
    this.worn = new WoundsLayer(stage, this.root);
    this.litters = new LittersLayer(stage, this.root);
    this.moneyLayer = new TownMoneyLayer(stage, this.root);
    this.colony = new ColonyLayer(stage, stage.root);
    this.root.enabled = false;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
    this.colony.visible = on && !!this.plan?.colony;
  }

  /**
   * A colony's ground and sky alone, its town put away (Phase 64): what a landing is watched on,
   * before there is a town there.
   */
  groundOnly(): void {
    this.root.enabled = false;
    this.colony.visible = !!this.plan?.colony;
  }

  /** How far about a colony's middle its ground lies level. */
  private colonyFlat = 30;
  /** A colony's ground as its world stood at a moment of a landing's film (Phase 66): its plan's own, to go back. */
  colonyAs(look: ColonyLook): void {
    const plan = this.plan;
    if (!plan?.colony) return;
    this.colony.build(look, plan.seed, this.colonyFlat + (look.port ? PORT_ROOM : 0));
    this.colony.port(look.port ?? null, plan.seed, this.colonyFlat);
    const open = (look.remade ?? 0) >= 1;
    this.colony.glasshouses(open ? [] : plan.fields, open ? null : plan.pasture);
  }

  /** A colony's town as it stood at a year of a film of its growth, on its ground; null: gone. */
  private asItStood: TownLayer | null = null;
  growth(town: VillagePlan["town"], ref: string, t: number): void {
    if (!town) {
      if (this.asItStood) this.asItStood.visible = false;
      return;
    }
    this.asItStood ??= new TownLayer(this.stage, this.colony.root);
    this.townLamps ??= windowMaterial();
    glowWindows(this.townLamps, 0.7);
    this.asItStood.build(town, `grown ${ref}`, t, this.townLamps);
  }
  /** It rising, on to moment t. */
  growthAt(t: number): void {
    this.asItStood?.update(t);
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
        child !== this.raidLayer.root &&
        child !== this.graveyard.root &&
        child !== this.memorialLayer.root &&
        child !== this.courtLayer.root &&
        child !== this.worn.root &&
        child !== this.rides.root &&
        child !== this.litters.root &&
        child !== this.moneyLayer.root &&
        child !== this.placedLayer?.root
      )
        child.destroy();
    this.stacks = [];
    this.dressed = [];
    this.plan = plan;
    // (A new village's people are drawn afresh; the same village's, carried on.)
    if (this.presenceOf !== plan.ref) {
      this.presence.clear();
      this.folk.forget();
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
    const g = biomeColor(plan.biome, plan.kind, plan.lifeLook),
      // (The ground runs out past its farthest fields and pasture, and the mills on their rim — a
      // great city's lie kilometres out — to the horizon's edge.)
      reach = Math.max(
        plan.fields.reduce((m, f) => Math.max(m, Math.hypot(f.x, f.z) + Math.max(f.w, f.d)), 0),
        Math.hypot(plan.pasture.x, plan.pasture.z) + plan.pasture.r,
      );
    this.reach = reach;
    // (A colony's ground is its own world's: Phase 64.)
    this.colony.visible = !!plan.colony && this.root.enabled;
    if (plan.colony && plan.town) {
      // (Level as far as its glasshouses stand, its hills beyond them.)
      this.colonyFlat = Math.max(
        30,
        Math.min(300, reach * M),
        townReach(
          townLots(plan.town.family, plan.town.seed, plan.town.axis, plan.town.whole, null),
        ) *
          M *
          1.12,
      );
      // (Its port, Phase 71: level ground beyond the town for it.)
      this.colony.build(
        plan.colony,
        plan.seed,
        this.colonyFlat + (plan.colony.port ? PORT_ROOM : 0),
      );
      this.colony.port(plan.colony.port ?? null, plan.seed, this.colonyFlat);
    } else if (plan.colony) {
      this.colonyFlat = 30;
      this.colony.build(plan.colony, plan.seed, 30 + (plan.colony.port ? PORT_ROOM : 0));
      this.colony.port(plan.colony.port ?? null, plan.seed, 30);
    }
    // (None, once its fields lie open under its own air: Phase 66.)
    if (plan.colony) {
      const open = (plan.colony.remade ?? 0) >= 1;
      this.colony.glasshouses(open ? [] : plan.fields, open ? null : plan.pasture);
    }
    if (plan.past?.covered)
      // (Built over from edge to edge: its ground, street and roof to the haze. Phase 66.)
      disc(900, [0.27, 0.28, 0.31], 0, 0, 0, "ground", false);
    else if (!plan.colony) {
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
    }
    if (plan.water)
      disc(
        LAKE_R * M,
        kindWater(plan.kind)?.lake ?? [0.2, 0.4, 0.6],
        plan.water.x * M,
        plan.water.z * M,
        0.014,
        "water",
      );
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
    road.set(plan.colony ? 0 : 1, (_, out) => {
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
    // (None where nothing burns, and no kiln glows or anvil sparks there: Phase 56.)
    const furnace = plan.stuff?.ore && !plan.fireless ? furnaceOf(plan.works?.mine) : null,
      smiths = plan.people.some((p) => p.trade?.kind === "smith");
    this.trades.build(
      town ? this.town.motions(t).filter((m) => !plan.fireless || m.kind === "mill") : [],
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
    this.graveyard.build(graveyardFor(plan), plan.lifeLook);
    // What it raised to what happened in it, on its square's rim (T1).
    this.memorialLayer.build(plan);
    this.courtLayer.build(plan);
    this.singer = this.singerDay = -1;
    // A town's well in the middle of its square, where its bucket lines draw (Phase 42 M201): a
    // ring of stone about its water, two posts and a little roof over it.
    if (town && !plan.colony) {
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
    this.country.build(plan, houseLook(plan.house, plan.lifeLook), s.quality);
    this.feast.build(plan);
    const crop = this.country.crop;
    this.crops = (["grain", "greens", "fallow"] as const).flatMap((kind) => {
      const sown = plan.past?.covered ? [] : plan.fields.filter((_, k) => crop[k] === kind);
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
    const look = houseLook(plan.house, plan.lifeLook),
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
    // (Where the land built over has its fields: halls of vats, those who tend them inside. Phase 66.)
    if (plan.past?.covered) {
      const halls = plan.fields,
        walls = this.batch(s, box, [0.52, 0.6, 0.58], halls.length, this.root),
        glass = this.batch(s, box, [0.5, 0.82, 0.74], halls.length, this.root);
      walls.set(halls.length, (i, out) => {
        const f = halls[i]!;
        out[0] = f.x * M;
        out[1] = 0.45;
        out[2] = f.z * M;
        out[3] = f.w * M;
        out[4] = 0.9;
        out[5] = f.d * M;
        out[6] = f.yaw;
      });
      glass.set(halls.length, (i, out) => {
        const f = halls[i]!;
        out[0] = f.x * M;
        out[1] = 0.96;
        out[2] = f.z * M;
        out[3] = f.w * M * 0.82;
        out[4] = 0.12;
        out[5] = f.d * M * 0.82;
        out[6] = f.yaw;
      });
    }
    const trees =
        (plan.colony && (plan.colony.remade ?? 0) < 0.8) || plan.past?.covered
          ? []
          : treesOf(plan, s.quality.villageTrees),
      drawnAt = new Map(trees.map((t, k) => [t, k])),
      byKind = (k: Tree["kind"]) => trees.filter((t) => t.kind === k),
      trunk = cylinderMesh(s, 0.5, 1, 5),
      crown = pc.Mesh.fromGeometry(
        s.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 3, longitudeBands: 6 }),
      ),
      pine = coneMesh(s, 0.5, 1, 6),
      g2 = biomeColor(plan.biome, plan.kind),
      // (Its trees in its life's own colours: Phase 57.)
      life = (c: Rgb): Rgb => lifeTint(c, plan.lifeLook),
      leaf: Rgb = life([g2[0] * 0.45 + 0.02, g2[1] * 0.55 + 0.22, g2[2] * 0.4 + 0.04]),
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
            ["conifer", this.batch(s, pine, life([0.06, 0.36, 0.2]), FELLING, this.root)],
            ["broadleaf", this.batch(s, crown, leaf, FELLING, this.root)],
            ["palm", this.batch(s, crown, life([0.2, 0.62, 0.22]), FELLING, this.root)],
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
      life([0.06, 0.36, 0.2]),
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
      life([0.2, 0.62, 0.22]),
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
    this.squareHall = {
      shown: false,
      put: (shown) =>
        hall.set(shown ? 1 : 0, (_, out) => {
          out[0] = plan.market ? 1.4 : 0;
          out[1] = plan.market ? 0.35 : 0.06;
          out[2] = plan.market ? -1 : 0;
          out[3] = plan.market ? 1.8 : 0.25;
          out[4] = plan.market ? 0.7 : 0.12;
          out[5] = plan.market ? 1.1 : 0.25;
          out[6] = 0;
        }),
    };
    this.squareHall.put((this.squareHall.shown = true));
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
    // look in their hide, their clothes over it: Phase 34). (The parts of one shape and one colour
    // share a batch: a draw for them all, not one a part — render/folk.ts.)
    const figured = this.figure.parts,
      alike = figured.map((part) =>
        figured.findIndex((p) => p.shape === part.shape && p.tone === part.tone),
      ),
      each = (pi: number) =>
        Math.max(1, plan.people.length * alike.filter((a) => a === alike[pi]).length);
    this.people = GROUP_COLORS.map((_, gi) => {
      const paint = dressedOn(plan.body, plan.era, gi, plan.colony),
        made: InstancedBatch[] = [];
      return figured.map((part, pi) =>
        part.tone === 3
          ? null
          : (made[alike[pi]!] ??= this.batch(
              s,
              meshes[part.shape],
              paint.tones[part.tone],
              each(pi),
              this.root,
            )),
      );
    });
    // (Those of made limbs, in a group of their own, whoever they are: Phase 66.)
    const machines = plan.people.some((p) => p.machine);
    if (machines) {
      const made: InstancedBatch[] = [];
      this.people.push(
        figured.map((part, pi) =>
          part.tone === 3
            ? null
            : (made[alike[pi]!] ??= this.batch(
                s,
                meshes[part.shape],
                MACHINE_TONES[part.tone]!,
                each(pi),
                this.root,
              )),
        ),
      );
    }
    // Hair (a people's markings), each person's own colour (a batch a colour, whatever their group).
    const hairs = [
        ...dressedOn(plan.body, plan.era, 0, plan.colony).hairs,
        ...(machines ? [MACHINE_TONES[3]!] : []),
      ],
      haired: InstancedBatch[][] = [];
    this.hair = figured.map((part, pi) =>
      part.tone === 3
        ? (haired[alike[pi]!] ??= hairs.map((c) =>
            this.batch(s, meshes[part.shape], c, each(pi), this.root),
          ))
        : null,
    );
    // The soldiers of a war about the town (M87, M204), armed afresh for it.
    this.meshes = meshes;
    this.armed = "";
    this.soldierBatches = [];
    this.soldiers = [];
    this.soldierArmor = [];
    this.soldierArmorParts = [];
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
    this.fliers.build(fliersOf(plan));
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
    // (Where nothing burns no hearth or stack smokes, and no lamp is lit before electric light:
    // Phase 56.)
    if (plan.fireless) {
      this.hearths = [];
      this.stacks = [];
      if (plan.era !== "modern") this.windows = null;
    }
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
  /** Each person's figure as last posed, their limbs eased toward each new pose (render/folk.ts). */
  private readonly folk = new FolkPoses();
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

  /**
   * Who sings at the feast now (T1): one grown person near its fire, the same through the evening while they stay there; the notes
   * over them. Nobody drawn near: the notes go up from the fire, and no one's name is told.
   */
  private singNow(plan: VillagePlan, t: number, clock: number): void {
    const song = sungAt(plan, t);
    if (!song) {
      this.singer = -1;
      this.memorialLayer.sing(null, clock);
      return;
    }
    const fire = fireOf(plan),
      near = (i: number) => {
        const m = this.moments[i],
          who = plan.people[i];
        return (
          !!m && !m.hidden && !!who && !who.child && Math.hypot(m.x - fire.x, m.z - fire.z) < 26
        );
      };
    if (this.singerDay !== song.day || this.singer < 0 || !near(this.singer)) {
      this.singerDay = song.day;
      this.singer = -1;
      const n = this.moments.length,
        from = n ? song.day % n : 0;
      for (let k = 0; k < n; k++)
        if (near((from + k) % n)) {
          this.singer = (from + k) % n;
          break;
        }
    }
    const m = this.singer >= 0 ? this.moments[this.singer] : null;
    this.memorialLayer.sing(
      m ? { x: m.x, z: m.z, up: 6 * this.figure.scale } : { x: fire.x, z: fire.z, up: 4 },
      clock,
    );
  }

  /** The song at the feast now and who sings it (T1; null: none), where it shows on the screen. */
  sungNow(t: number): {
    readonly ref: string;
    readonly title: string;
    readonly line: string;
    readonly who: string | null;
    readonly x: number;
    readonly y: number;
  } | null {
    const plan = this.plan,
      song = plan ? sungAt(plan, t) : null;
    if (!plan || !song) return null;
    const m = this.singer >= 0 ? this.moments[this.singer] : null,
      fire = fireOf(plan),
      p = this.stage.camera.camera!.worldToScreen(
        new pc.Vec3((m?.x ?? fire.x) * M, (6 * this.figure.scale + 3) * M, (m?.z ?? fire.z) * M),
      );
    return {
      ref: song.song.ref,
      title: song.song.title,
      line: song.song.line,
      who: m ? (plan.people[this.singer]?.name ?? null) : null,
      x: p.x,
      y: p.z > 0 ? p.y : -1,
    };
  }

  /** The case its court opens from a point of the screen (J1; null: nothing of the court there; its town: no case yet). */
  courtAt(x: number, y: number, t = this.courtT): string | null {
    const plan = this.plan;
    if (!plan?.court || !this.courtLayer.at(this.stage.camera.camera!, x, y)) return null;
    return courtCaseAt(plan, t) ?? plan.envoy?.ref ?? plan.ref;
  }
  /** The court now, where it shows, and what sits (J1; the look tools). */
  courtNow(t = this.courtT) {
    const plan = this.plan;
    if (!plan?.court) return null;
    const sit = courtSitting(plan, t),
      i = sit ? plan.people.findIndex((p) => p.ref === sit.accused) : -1,
      m = i >= 0 ? this.momentAt(i) : null;
    return {
      stands: m ? { x: m.x, z: m.z, activity: m.activity, hidden: m.hidden } : null,
      form: plan.court.form,
      law: plan.court.law,
      sittings: plan.court.sittings.length,
      sitting: sit,
      held: plan.court.sittings
        .filter((s) => {
          const day = Math.floor(t / 86400);
          return (
            (s.sentence === "stocks" || s.sentence === "cell") &&
            day > s.day &&
            day < s.day + s.days
          );
        })
        .map((s) => {
          const k = plan.people.findIndex((p) => p.ref === s.accused),
            n = k >= 0 ? this.momentAt(k) : null;
          return { who: s.who, sentence: s.sentence, x: n?.x ?? null, z: n?.z ?? null };
        }),
      parts: this.courtLayer.parts,
      batches: this.courtLayer.batchesUsed,
      place: this.courtLayer.onScreen(this.stage.camera.camera!),
    };
  }
  courtShown(on: boolean): void {
    this.courtLayer.shown(on);
  }

  /** Whether a thing raised stands right under the finger, nearer the eye than `depth`. */
  stoneOver(x: number, y: number, depth: number): boolean {
    return this.memorialLayer.over(this.stage.camera.camera!, x, y, depth);
  }
  /**
   * The thing raised under the finger, unless someone stands right there in front of it (T1). Feet bunch up towards the far ground, so
   * many stand within a finger of a tall stone's body from behind it, and they aren't in its way. Only near it: anyone right there comes first.
   */
  stoneUnder(x: number, y: number): string | null {
    const cam = this.stage.camera.camera!,
      on = this.memorialLayer.under(cam, x, y);
    if (on) return this.pick(x, y, 10, on.depth) === null ? on.p.m.ref : null;
    const near = this.memorialLayer.at(cam, x, y);
    return near && this.pick(x, y, 10) === null ? near.m.ref : null;
  }
  /** The thing raised at a point of the screen (T1; null: none), and how a person presses it. */
  stoneAt(x: number, y: number): string | null {
    return this.memorialLayer.at(this.stage.camera.camera!, x, y)?.m.ref ?? null;
  }
  /** Where what a town was asked to raise stands, in metres from its middle (H1; null: not drawn here). */
  askedSpot(
    ref: string,
    t: number,
  ): { x: number; z: number; size: number; flag?: { x: number; z: number } } | null {
    return this.town.askedSpot(ref, t);
  }
  /** What a town raised, as drawn (the look tools). */
  stonesOnScreen(): ReturnType<MemorialLayer["onScreen"]> {
    return this.memorialLayer.onScreen(this.stage.camera.camera!);
  }
  stonesDrawn(): { readonly parts: number; readonly batches: number; readonly placed: number } {
    return {
      parts: this.memorialLayer.parts,
      batches: this.memorialLayer.batchesUsed,
      placed: this.memorialLayer.placed.length,
    };
  }
  stonesShown(on: boolean): void {
    this.memorialLayer.shown(on);
  }

  /** What of a town drawn from its fabric stands at a point (metres from its middle), for a tap (M151). */
  townThingAt(x: number, z: number, t: number): TownThing | null {
    return this.town.thingAt(x, z, t);
  }

  /** Where on the screen a point of the town is (metres from its middle; the look tools), or null behind the eye. */
  screenOf(x: number, z: number, high = 0): { x: number; y: number } | null {
    const s = this.stage.camera.camera!.worldToScreen(new pc.Vec3(x * M, high * M, z * M));
    return s.z > 0 ? { x: s.x, y: s.y } : null;
  }

  /** The homes standing at moment t nearest a way through the town, for a film's burning. */
  homesAlong(
    t: number,
    way: readonly { readonly x: number; readonly z: number }[],
    most: number,
  ): Burnable[] {
    return this.town.homesAlong(t, way, most);
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
  /** A town's money laid over it (Lives L6): how many homes it was laid on. */
  moneyShow(data: HomeMoney, t: number): number {
    const plan = this.plan;
    if (!plan || plan.ref !== data.town) return 0;
    const homes: MoneyHome[] = [],
      ruin = MONEY_RAMP.length,
      // (A village's homes are as its look draws them, as broad as a lot: the block over one must be broader.)
      look = houseLook(plan.house, plan.lifeLook),
      ringW = (look.length * 1.15) / M + 1.2,
      ringD = (look.width * 1.15) / M + 1.2,
      ringH = (look.raised + 0.44 * look.height * 2 + 0.75) / M + 0.6;
    data.n.forEach((n, i) => {
      const ring = n >= RING_HOME,
        box = ring ? null : this.town.homeBox(n, t),
        h = ring ? plan.homes[n - RING_HOME] : null;
      if (!box && !h) return;
      const coin = data.coin[i]!,
        colour = coin < 0 ? ruin : moneyStep(coin, data.lo, data.hi);
      homes.push({
        n,
        x: box?.x ?? h!.x,
        z: box?.z ?? h!.z,
        yaw: box?.yaw ?? h!.yaw,
        w: box?.w ?? ringW,
        d: box?.d ?? ringD,
        h: box?.h ?? ringH,
        pw: box ? LOT_W - 0.6 : ringW * 1.5,
        pd: box ? LOT_D - 0.6 : ringD * 1.5,
        colour,
        let: data.tenure === "mixed" && data.lets[i] === 1,
      });
    });
    this.moneyLayer.show(homes, [...MONEY_RAMP, MONEY_RUIN], MONEY_LET);
    return homes.length;
  }
  moneyReach(): number {
    return this.moneyLayer.reach();
  }
  moneyClear(): void {
    this.moneyLayer.clear();
  }
  moneyPick(x: number, y: number): number | null {
    return this.moneyLayer.pick(x, y);
  }
  moneySpots(): { n: number; x: number; y: number; colour: number }[] {
    return this.moneyLayer.spots();
  }

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
   * their ease go in out of it; `all`, all of them: a battle fought before it, Phase 55 M227).
   * `fine`: its people at their day's errands (else, a town watched growing, each at their work as
   * it was before Phase 39, walking straight to it).
   */
  update(
    t: number,
    downpour: { readonly from: number; readonly to: number; readonly all?: boolean } | null = null,
    fine = true,
  ): void {
    const plan = this.plan;
    if (!plan) return;
    if (this.posed) t = this.posed.at(t);
    const step = t - this.lastT;
    this.lastT = t;
    this.town.update(t);
    // The fields as the year in them has it (Phase 44 M206): their crop's colour now — parched,
    // lush, sallow — the earth between their rows where the crop stands in rows, snow lying on
    // them in a cold land's winter (set only as it changes); the grass browning in a dry year.
    const year = fieldsNow(plan, t),
      // (Its crops and grass in its life's own colours: Phase 57.)
      snowed = (c: Rgb): Rgb => {
        const own = lifeTint(c, plan.lifeLook);
        return this.seasonNow ? seasonGround(own, this.seasonNow) : own;
      },
      sown = (kind: Crop): Rgb => snowed(cropTint(kind, t, year)),
      earth = (kind: Crop): Rgb =>
        !this.country.sown
          ? sown(kind)
          : kind === "fallow"
            ? snowed(grassTint(cropTint("fallow", t, year), year))
            : snowed(soilTint(year));
    for (const c of this.crops) {
      const color: Rgb = this.plan?.colony ? [0.28, 0.6, 0.26] : earth(c.crop),
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
      // (A sealed hall's ports are never quite dark.)
      const glow =
        Math.round(Math.max(this.plan?.colony ? 0.35 : 0, lamplight((t % 86_400) / 3600)) * 20) /
        20;
      if (glow !== this.lit) {
        this.lit = glow;
        glowWindows(this.windows, glow);
      }
    }
    // (The beasts move by the screen's clock: a look, at any speed the world runs.)
    const screen = this.heldFauna ?? performance.now() / 1000;
    this.fauna.update(screen, t);
    this.fliers.update(screen);
    this.country.update(t, screen, sown, year);
    this.feast.update(t, screen);
    this.visitors.update(screen);
    const parts = this.figure.parts,
      // Strides and the motions of work: by the screen's clock, each person a little out of step.
      clock = performance.now() / 1000,
      // The war about the town (M204): its hosts where its year has them, its fallen where they fell.
      scene =
        this.townWar && this.soldiers.length
          ? (this.warSceneOverride?.() ??
            townWarScene(plan, this.townWar, this.soldiersEach / 2, this.placedFrame !== null))
          : null,
      troops = scene?.soldiers ?? [];
    this.warScene = scene;
    this.warLayer.update(scene, screen, this.campNow, this.figure.scale);
    const targets = momentsOf(plan, t, downpour, fine);
    // (Those gone by car or on a line, in it, not walking beside it: R1.)
    rideMoments(plan, targets, t, fine);
    // Those come out to watch a battle fought before the town (Phase 55 M227): at its edge, facing it.
    for (const w of this.watchers) {
      const m = targets[w.index];
      if (!m) continue;
      m.x = w.x;
      m.z = w.z;
      m.yaw = w.yaw;
      m.activity = ACTIVITY.gathering;
      m.task = null;
      m.hidden = false;
      m.carry = null;
      m.why = "Come out to watch the battle before the town";
    }
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
      this.work.heapsAt(
        {
          grain: now.lasts.grain,
          wood: now.have.wood,
          stone: now.have.stone,
          ore: now.lasts.ore,
        },
        this.town.ashGone(t) > 0,
      );
    }
    // What struck the town (Phase 42 M201): its homes alight, their smoke rolling up, the dust of
    // those shaken down — the nearest the eye drawn; and while a quake shakes it, the ground
    // under it all.
    const filmed = this.blazeOverride?.() ?? null;
    if (filmed || plan.town?.struck?.length || this.blazed) {
      const b = filmed ?? this.town.blaze(t),
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
    // A raid over the town (W2): its machines, its load falling, each hit's burst.
    if (plan.town?.struck?.some((k) => k.raid) || this.raided) {
      // (Its machines in the look of the town's age; none of the greatest fire's cloud drawn about the eye.)
      const r = this.town.raid(t);
      this.raidLayer.update(
        r,
        plan.era,
        !!plan.past,
        performance.now() / 1000,
        this.stage.camera.getPosition(),
      );
      this.raided = this.raidLayer.busy;
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
    // (Those the small world moves, posed every frame: render/folk.ts.)
    const unposed = this.posed ? drawn.slice() : null;
    this.posed?.pose(drawn, this.presence);
    this.moments = drawn.map((d) => d.moment);
    this.rides.update(
      plan,
      // (Where their day has them, not as drawn: one hidden in what they ride is drawn standing where they got in.)
      targets,
      t,
      step !== 0,
      fine,
      M,
      (this.posed as { lived?: number } | null)?.lived ?? null,
    );
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
      this.trades.update(screen, this.stage.quality.motion, busy, this.town.ashGone(t));
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
    // The song at its feast (T1): notes rising over whoever sings it.
    this.singNow(plan, t, screen);
    this.courtLayer.update(plan, t);
    this.courtT = t;
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
    // Each one's figure posed part by part and drawn in their group's batches and their hair's
    // (render/folk.ts): each limb eased toward its pose now, a stride begun or ended, a task taken
    // up, a turn of the arm, not a jump of it; those small on the screen posed every other frame.
    const ease = dt > 0 ? 1 - Math.exp(-Math.min(0.1, dt) / 0.08) : 1,
      cam = this.stage.camera,
      at = cam.getPosition();
    /** A part of person i's figure, where it is now. */
    const place = this.folk.pose({
      plan,
      figure: this.figure,
      moments: this.moments,
      sizes: this.sizes,
      strides: this.strides,
      gear: this.gearNow,
      clock,
      dt,
      downed: this.posed?.downed ?? null,
      kept: unposed ? redrawn(unposed, drawn) : null,
      people: this.people,
      hair: this.hair,
      eye: { x: at.x / M, y: at.y / M, z: at.z / M },
      near: nearReach(
        this.figure,
        cam.camera!.fov,
        this.stage.app.graphicsDevice.clientRect.height,
      ),
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
      stumps += g.stumps;
      for (const b of g.bound) {
        place(placed, i, b.part);
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
      const soldierPart = (
        out: number[],
        k: number,
        pi: number,
        side: number,
        shell?: FigurePart,
      ) => {
        const q = troops[side * this.soldiersEach + k]!,
          size = this.figure.scale * q.size,
          part = shell ?? parts[pi]!,
          c = Math.cos(q.yaw),
          sn = Math.sin(q.yaw),
          walking = q.doing === "advance" || q.doing === "fall back",
          aim =
            q.doing === "fallen"
              ? 0
              : q.doing === "fire"
                ? // (Up and firing: the arms levelled to the gun, the rest still.)
                  part.role === "arm"
                  ? -1.35
                  : 0
                : q.doing === "prone"
                  ? // (Down: the arms out ahead of them to the gun.)
                    part.role === "arm"
                    ? -2.75
                    : 0
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
          pitch = shell ? 0 : Number.isNaN(was) ? aim : was + (aim - was) * ease,
          hinge = part.pivot ?? 0,
          px = part.x;
        if (!shell) this.soldierLimbs[slot] = pitch;
        let py = part.y + hinge - hinge * Math.cos(pitch),
          pz = part.z - hinge * Math.sin(pitch),
          pp = pitch;
        if (q.doing === "fallen") {
          // On their back: what stood up lies back along the ground.
          const up = py;
          py = 0.06 + pz;
          pz = -up;
          pp = pitch - Math.PI / 2;
        } else if (q.doing === "prone") {
          // On their front, the head toward the foe: what stood up lies forward along the ground.
          const up = py;
          py = 0.06 - pz;
          pz = up;
          pp = pitch + Math.PI / 2;
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
      this.soldierArmor.forEach((batch, side) => {
        const shells = this.soldierArmorParts[side]!;
        batch.set(this.soldiersEach * shells.length, (i, out) =>
          soldierPart(out, Math.floor(i / shells.length), 0, side, shells[i % shells.length]),
        );
      });
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
          prone = q.doing === "prone",
          gun = GUNS.includes(this.kits[q.side]?.arm ?? ""),
          thrust =
            q.doing === "fight" || q.doing === "fire"
              ? gun
                ? -1.42
                : -0.5 - 0.7 * Math.abs(Math.sin(clock * 2 * Math.PI * 0.8 + i * 1.7))
              : prone
                ? -Math.PI / 2
                : -0.25,
          across = 0.13,
          ahead = fallen ? -0.35 : prone ? 0.62 : 0.05;
        out[0] = q.x * M + (across * c + ahead * sn) * size;
        out[1] = (fallen ? 0.03 : prone ? 0.07 : 0.36) * size;
        out[2] = q.z * M + (-across * sn + ahead * c) * size;
        out[3] = (gun ? 0.026 : 0.018) * size;
        out[4] = (gun ? 0.62 : 0.8) * size;
        out[5] = (gun ? 0.026 : 0.018) * size;
        out[6] = q.yaw;
        out[7] = fallen ? -Math.PI / 2 : thrust;
      });
      // Burning light: from each who fights, now and again, a straight line out at the foe, there and gone.
      this.townBolts.forEach((batch, side) => {
        if (!batch || !armLook(this.kits[side]?.arm).beam) return;
        const firing: { x: number; z: number; yaw: number; k: number }[] = [];
        for (let i = side * this.soldiersEach; i < (side + 1) * this.soldiersEach; i++) {
          const q = troops[i];
          if (!q || (q.doing !== "fight" && q.doing !== "fire") || firing.length >= BOLTS_A_SIDE)
            continue;
          const beat = clock * 1.3 + i * 0.37,
            k = beat - Math.floor(beat);
          if (k < 0.14) firing.push({ x: q.x, z: q.z, yaw: q.yaw, k: 1 - k / 0.14 });
        }
        batch.set(firing.length, (n, out) => {
          const b = firing[n]!,
            long = 34,
            size = this.figure.scale;
          out[0] = (b.x + Math.sin(b.yaw) * (long / 2 + 1)) * M;
          out[1] = 0.62 * size;
          out[2] = (b.z + Math.cos(b.yaw) * (long / 2 + 1)) * M;
          out[3] = 0.018 * b.k + 0.006;
          out[4] = 0.018 * b.k + 0.006;
          out[5] = long * M;
          out[6] = b.yaw;
        });
      });
      // Swords and axes: at the hip on the march, swung in the fight, dropped by the fallen.
      const swordsmen = armed(["sword", "axe"]);
      this.blades?.set(swordsmen.length, (n, out) => {
        const { q, i } = swordsmen[n]!,
          size = this.figure.scale * q.size,
          c = Math.cos(q.yaw),
          sn = Math.sin(q.yaw),
          fallen = q.doing === "fallen" || q.doing === "prone",
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
          fallen = q.doing === "fallen" || q.doing === "prone",
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
            fallen = q.doing === "fallen" || q.doing === "prone",
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
    this.gunfire(troops, clock);
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
    const burned = this.town.ashGone(t);
    this.work.update((t % 86_400) / 3600, screen, this.carriers, burned);
    // (Nothing stands on a square the greatest fire has burned.)
    if (this.squareHall && this.squareHall.shown !== burned <= 0)
      this.squareHall.put((this.squareHall.shown = burned <= 0));
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
    const anatomy = figureAnatomy(this.figure),
      chest = this.figure.parts[anatomy.on.trunk],
      head = this.figure.parts[anatomy.on.head];
    this.soldierArmorParts = sides
      ? sides.map((side) => {
          const guard = side.host?.guard ?? "",
            pieces: FigurePart[] = [];
          if (chest) {
            const e = partExtent(chest);
            for (const p of armorPanels(guard))
              pieces.push({
                shape: "box",
                tone: 0,
                x: chest.x + p.x * e[0],
                y: chest.y + p.y * e[1],
                z: chest.z + p.z * e[2],
                sx: p.w * e[0],
                sy: p.h * e[1],
                sz: p.d * e[2],
              });
          }
          if (head && ["helmet", "mail", "scale", "plate", "driven-plate"].includes(guard)) {
            const e = partExtent(head);
            pieces.push({
              shape: "box",
              tone: 0,
              x: head.x,
              y: head.y + e[1] * 0.27,
              z: head.z,
              sx: e[0] * 1.13,
              sy: e[1] * 0.62,
              sz: e[2] * 1.13,
            });
          }
          return pieces;
        })
      : [];
    this.soldierArmor = sides
      ? sides.map((side, i) =>
          kept(
            s,
            meshes.box,
            armorColor(side.host?.guard ?? "", ""),
            Math.max(1, this.soldiersEach * this.soldierArmorParts[i]!.length),
            this.root,
          ),
        )
      : [];

    this.soldiers = battle
      ? [battle.attacker, battle.defender].map(({ color: c, host }) => {
          const body: Rgb = [c[0], c[1], c[2]],
            legs: Rgb = [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5],
            paint = dressedOn(plan.body, plan.era, 0, plan.colony);
          // (A people in their own look fight in their hide, their realm's colour over it; soldiers of
          // made limbs in their shells: Phase 66.)
          const made = host?.mount === "machine-host";
          return this.figure.parts.map((part) =>
            kept(
              s,
              meshes[part.shape],
              made
                ? part.tone === 5 || part.tone === 0
                  ? ([0.42 + body[0] * 0.3, 0.44 + body[1] * 0.3, 0.48 + body[2] * 0.3] as Rgb)
                  : MACHINE_TONES[part.tone]!
                : paint.folk
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
    // (Burning light: bodies with no wood in them; a beam of its own colour for each side that has it.)
    const lights = this.kits.map((k) => armLook(k.arm).beam ?? null);
    this.spears = bears(["spear", ...GUNS])
      ? kept(
          s,
          meshes.box,
          lights.every(Boolean) ? [0.09, 0.1, 0.13] : [0.52, 0.38, 0.24],
          this.soldiersEach * 2,
          this.root,
        )
      : null;
    // (Burning light is seen as a beam out at the foe, Phase 66. A gun's round is not seen in flight,
    // only its flash, its smoke and the earth where it strikes; but a machine gun's tracers, a glint.)
    this.townBolts = this.kits.map((k, i) => {
      const light = lights[i] ?? (armLook(k.arm).team !== undefined ? TRACER : null);
      return light
        ? kept(s, meshes.box, light as Rgb, BOLTS_A_SIDE, this.root, litMaterial(light as Rgb))
        : null;
    });
    const guns = this.kits.some((k) => isGun(k.arm) && !armLook(k.arm).beam),
      most = 2 * this.soldiersEach;
    this.townFlash = guns
      ? kept(s, meshes.cone, MUZZLE, most, this.root, litMaterial(MUZZLE))
      : null;
    this.townPowder = guns
      ? kept(s, meshes.box, POWDER, most * 2, this.root, flatMaterial(POWDER, 0.55))
      : null;
    this.townKicks = guns
      ? kept(s, meshes.box, KICKED, most, this.root, flatMaterial(KICKED, 0.85))
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
   * The guns' firing about the town now (asked for 2026-11-11: a rifle shooting "lasers" made no
   * sense for what it is): each who fires, at their arm's pace (a line of muskets together, repeaters
   * each in their own time; beside a machine gun, the rest of its host with what they bear), a flash
   * at the muzzle, the powder's smoke rolling out and drifting off on the wind (black powder's a bank
   * that hangs, smokeless powder's a wisp), the earth a round throws up among the foe; and each
   * machine gun's tracers, a glint going out from its tripod. Nothing when no one fires.
   */
  private gunfire(troops: TownWarScene["soldiers"], clock: number): void {
    const flash = this.townFlash,
      powder = this.townPowder,
      kicks = this.townKicks;
    if (!flash || !powder || !kicks) return;
    const each = this.soldiersEach,
      size = this.figure.scale,
      shots = this.shotsNow;
    shots.length = 0;
    for (let i = 0; i < 2 * each; i++) {
      const q = troops[i];
      if (!q || q.size < 0.5 || (q.doing !== "fight" && q.doing !== "fire")) continue;
      const kit = this.kits[q.side];
      if (!kit || !isGun(kit.arm)) continue;
      const look = armLook(kit.arm);
      if (look.beam) continue;
      const f = TOWN_FIRE[look.rest ?? kit.arm] ?? TOWN_FIRE_ELSE,
        lead = f.volley
          ? q.side * 1.7 + Math.floor((i - q.side * each) / 8) * 0.18 + hashUnit(i) * 0.3
          : hashUnit(i) * f.every,
        t = clock + lead,
        n = Math.floor(t / f.every),
        age = t - n * f.every;
      if (age < Math.max(f.smoke, KICK_S + 0.1)) shots.push({ i, age, n, f });
    }
    const muzzle = (q: TownWarScene["soldiers"][number], ahead: number, out: number[]) => {
      out[0] = q.x * M + Math.sin(q.yaw) * ahead * size;
      out[1] = 0.42 * size;
      out[2] = q.z * M + Math.cos(q.yaw) * ahead * size;
    };
    const flashing = shots.filter((s) => s.age < 0.09);
    flash.set(flashing.length, (j, out) => {
      const s = flashing[j]!,
        q = troops[s.i]!,
        w = (0.05 + 0.05 * s.f.thick) * size;
      muzzle(q, 0.62, out);
      out[3] = w;
      out[4] = w * 2.2;
      out[5] = w;
      out[6] = q.yaw;
      // (Its point along the way it fires.)
      out[7] = Math.PI / 2;
    });
    const smoking = shots.filter((s) => s.age < s.f.smoke);
    powder.set(smoking.length, (j, out) => {
      const s = smoking[j]!,
        q = troops[s.i]!,
        k = s.age / s.f.smoke,
        r = (0.1 + 0.42 * Math.sqrt(k)) * (0.4 + 0.6 * s.f.thick) * size;
      muzzle(q, 0.5 + 0.9 * Math.min(1, s.age / 1.2), out);
      // (Off on the wind, and rising.)
      out[0] = out[0]! + 0.22 * s.age * size;
      out[1] = out[1]! + 0.16 * s.age * size;
      out[3] = r * 2;
      out[4] = r * 1.6;
      out[5] = r * 2;
      out[6] = s.i * 0.7 + s.n;
      out[7] = s.i * 0.3;
    });
    // (Where its round strikes, among the foe as they stand: the earth thrown up, settling.)
    const struck = shots.filter((s) => s.age >= 0.05 && s.age < 0.05 + KICK_S);
    kicks.set(struck.length, (j, out) => {
      const s = struck[j]!,
        q = troops[s.i]!,
        foe = troops[(1 - q.side) * each + ((s.i * 7 + s.n * 13) % Math.max(1, each))],
        ph = (s.age - 0.05) / KICK_S,
        r = (0.05 + 0.13 * ph) * size,
        at = foe && foe.size > 0.5 ? foe : null,
        x = at ? at.x : q.x + Math.sin(q.yaw) * 30,
        z = at ? at.z : q.z + Math.cos(q.yaw) * 30;
      out[0] = (x + (hashUnit(s.i * 31 + s.n) - 0.5) * 6) * M;
      out[1] = (0.03 + 0.22 * ph) * size;
      out[2] = (z + (hashUnit(s.i * 17 + s.n * 3) - 0.5) * 6) * M;
      out[3] = r;
      out[4] = r * 1.4;
      out[5] = r;
      out[6] = s.n;
    });
    // A machine gun's tracers: a burst a second or so, one of its rounds burning, out along its way.
    const guns = (this.warScene?.teamGuns ?? []).filter((g) => g.firing),
      side = this.kits.findIndex((k) => armLook(k.arm).team !== undefined),
      bolts = side >= 0 ? this.townBolts[side] : null;
    if (bolts && !armLook(this.kits[side]?.arm).beam) {
      const going = this.tracersNow;
      going.length = 0;
      guns.forEach((g, j) => {
        const age = (clock + hashUnit(j + 11) * 1.1) % 1.1;
        if (age < 0.22) going.push({ x: g.x, z: g.z, yaw: g.yaw, k: age / 0.22 });
      });
      bolts.set(going.length, (j, out) => {
        const g = going[j]!,
          d = 3 + g.k * 40;
        out[0] = (g.x + Math.sin(g.yaw) * d) * M;
        out[1] = 0.3 * size;
        out[2] = (g.z + Math.cos(g.yaw) * d) * M;
        out[3] = 0.012;
        out[4] = 0.012;
        out[5] = 8 * M;
        out[6] = g.yaw;
      });
    }
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
  /** Where a raid's machines are now, in the village's units (W2's look tools). */
  raidersShown(): { x: number; y: number; z: number }[] {
    return this.town
      .raid(this.lastT)
      .flyers.map((f) => ({ x: f.x * 0.1, y: f.y * 0.1, z: f.z * 0.1 }));
  }

  /** Where rockets' streaks are now, the head and part way up, in the village's units (W3's look tools). */
  streaksShown(): { x: number; y: number; z: number }[] {
    const d = [0, 0, 0];
    return this.town.raid(this.lastT).streaks.map((k) => {
      // (Part way up the smoke it left: as far up its way from its head as the smoke goes, at most 180 m.)
      diveAt(Math.min(k.head + 180, DIVE_SEEN), d);
      return {
        x: (k.ax - Math.sin(k.yaw) * d[0]!) * 0.1,
        y: (k.ay + d[1]!) * 0.1,
        z: (k.az - Math.cos(k.yaw) * d[0]!) * 0.1,
      };
    });
  }

  blazeShown(): {
    fires: number;
    smoke: number;
    dust: number;
    /** A raid over it now (W2): what is drawn of it, and whose. */
    raid: { flyers: number; falling: number; bursts: number; streaks: number; by: string | null };
    /** The greatest fire over it now (W5). */
    great: { x: number; z: number; since: number } | null;
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
      raid: { ...this.raidLayer.shown, by: this.town.raid(this.lastT).by },
      great: this.raidLayer.greatNow,
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
    openGraves: { x: number; z: number }[];
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
      openGraves: b.open.map(({ x, z }) => ({ x, z })),
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
    if (tw) this.warLayer.colors(tw.sides[0].color as Rgb, tw.sides[1].color as Rgb);
  }

  /** How many a side the war about the town is drawn as. */
  get warEach(): number {
    return this.soldiersEach / 2;
  }
  /** The war about the town as last drawn (the look tools). */
  warNow(): {
    war: TownWar;
    scene: TownWarScene;
    tents: number;
    fires: number;
    camp: number;
  } | null {
    return this.townWar && this.warScene
      ? { war: this.townWar, scene: this.warScene, ...this.warLayer.shown }
      : null;
  }

  /** The battle before the town made ready on its eve (Phase 55 M227): its layer built ahead of the morning. */
  readyBattle(): void {
    this.placedLayer ??= new BattleLayer(this.stage, this.root);
  }

  /**
   * A battle fought before the town in its scene (Phase 55 M227; null: none): its field laid on its
   * frame, in the figure of the people who fought it.
   */
  placeBattle(
    p: {
      readonly field: BattleField;
      readonly frame: PlacedFrame;
      readonly figure: Figure | null;
      readonly body: FigureBody | null;
    } | null,
  ): void {
    this.placedFrame = p?.frame ?? null;
    this.watchers = [];
    this.campNow = [];
    if (!p) {
      if (this.placedLayer) {
        this.placedLayer.clear();
        this.placedLayer.root.enabled = false;
      }
      return;
    }
    this.placedLayer ??= new BattleLayer(this.stage, this.root);
    this.placedLayer.setup(p.field, p.figure, p.body, PLACED_GRASS);
    this.placedShadows = this.stage.quality.name === "ultra";
    this.placedLayer.place(p.frame, this.placedShadows);
  }

  /**
   * The battle before the town at its moment (Phase 55 M227; null: not drawn now), those of the
   * town come out to its edge to watch it, and the hosts' fires behind their lines the night before.
   * (Given before the town's moment is drawn: those watching stand there in it.)
   */
  battleAt(
    now: BattleNow | null,
    watchers: readonly Watcher[] = [],
    camp: readonly { readonly x: number; readonly z: number }[] = [],
  ): void {
    this.watchers = watchers;
    this.campNow = camp;
    const layer = this.placedLayer;
    if (!layer || !this.placedFrame) return;
    if (!now) {
      layer.root.enabled = false;
      return;
    }
    // (Shadows at the finest setting alone, as the setting moves.)
    const ultra = this.stage.quality.name === "ultra";
    if (ultra !== this.placedShadows) {
      this.placedShadows = ultra;
      layer.place(this.placedFrame, ultra);
    }
    layer.update(now);
  }

  /** How many of the town stand at its edge watching the battle before it now (the look tools). */
  get watching(): number {
    return this.placedFrame ? this.watchers.length : 0;
  }

  /** The layer of the battle laid before the town (null: none), for its figures on the screen and a tap. */
  get placedBattle(): BattleLayer | null {
    return this.placedFrame ? this.placedLayer : null;
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
  /** The car or line at a point of the screen (R1): its owner's place, or its line, and whether the finger is right on it. */
  pickRide(x: number, y: number): ReturnType<TownTraffic["pick"]> {
    return this.rides.pick(this.stage.camera.camera!, x, y);
  }

  /** What a town's people keep and ride, and where each is on the screen (the look tools, R1). */
  ridesInfo() {
    return this.rides.info(this.stage.camera.camera!);
  }

  pick(x: number, y: number, reach = 28, nearer = Infinity): number | null {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3();
    let best: number | null = null,
      bestD = reach * reach;
    this.moments.forEach((m, i) => {
      if (m.hidden) return;
      const p = cam.worldToScreen(new pc.Vec3(m.x * M, 0.2, m.z * M), at),
        d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (p.z > 0 && p.z < nearer && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /**
   * The one borne on the litter nearest a screen point, within a finger's reach (Phase 55 wave 5):
   * their index (null: no litter there, or none on it).
   */
  pickLitter(x: number, y: number, reach = 22): number | null {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3();
    let best: number | null = null,
      bestD = reach * reach;
    for (const q of this.littersShown) {
      if (!q.borne) continue;
      const p = cam.worldToScreen(new pc.Vec3(q.x * M, 0.6, q.z * M), at),
        d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (p.z > 0 && d < bestD) {
        bestD = d;
        best = q.index;
      }
    }
    return best;
  }

  /** Whether one of the town is borne on a litter now (Phase 55 wave 5: their card says so). */
  borneNow(index: number): boolean {
    return this.littersShown.some((q) => q.borne && q.index === index);
  }

  /** Where a soldier of the war about the town shows on the screen: about their middle, or on the ground where they lie. */
  private soldierOnScreen(q: TownWarScene["soldiers"][number], at: pc.Vec3): pc.Vec3 {
    const up = q.doing === "fallen" ? 0.05 : 0.2 * this.figure.scale * q.size;
    return this.stage.camera.camera!.worldToScreen(new pc.Vec3(q.x * M, up, q.z * M), at);
  }

  /**
   * The soldier of the war about the town nearest a screen point, within a finger's reach (Phase 55
   * wave 5): their slot in its scene, and how many of a side's host are drawn (null: none there).
   */
  pickSoldier(x: number, y: number, reach = 22): { slot: number; each: number } | null {
    const at = new pc.Vec3();
    let best = -1,
      bestD = reach * reach;
    (this.warScene?.soldiers ?? []).forEach((q, k) => {
      if (q.size <= 0.5) return;
      const p = this.soldierOnScreen(q, at),
        d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (p.z > 0 && d < bestD) {
        bestD = d;
        best = k;
      }
    });
    return best >= 0 ? { slot: best, each: this.soldiersEach / 2 } : null;
  }

  /**
   * The soldiers of the war about the town in sight now (the look tools): their slots, where on the
   * screen, and where they stand on its ground (metres).
   */
  soldiersOnScreen(): {
    slot: number;
    fallen: boolean;
    x: number;
    y: number;
    ground: { x: number; z: number };
  }[] {
    const at = new pc.Vec3(),
      out: ReturnType<VillageScene["soldiersOnScreen"]> = [];
    (this.warScene?.soldiers ?? []).forEach((q, slot) => {
      if (q.size <= 0.5) return;
      const p = this.soldierOnScreen(q, at);
      if (p.z > 0)
        out.push({
          slot,
          fallen: q.doing === "fallen",
          x: p.x,
          y: p.y,
          ground: { x: q.x, z: q.z },
        });
    });
    return out;
  }

  /** The litters borne in sight now (the look tools): whom each bears, and where on the screen. */
  littersOnScreen(): { index: number; x: number; y: number }[] {
    const cam = this.stage.camera.camera!,
      at = new pc.Vec3(),
      out: { index: number; x: number; y: number }[] = [];
    for (const q of this.littersShown) {
      if (!q.borne) continue;
      const p = cam.worldToScreen(new pc.Vec3(q.x * M, 0.6, q.z * M), at);
      if (p.z > 0) out.push({ index: q.index, x: p.x, y: p.y });
    }
    return out;
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
  /** Those who came to a people's town, a film's while (Phase 69): laid about it, or gone. */
  comers(v: Visitor | null): void {
    const plan = this.plan;
    if (plan) this.visitors.build({ ...plan, visitors: v ? [v] : [] }, this.stage.quality.detail);
  }
  /** Where they came down (scene units). */
  comersSpot(): { readonly x: number; readonly z: number } | null {
    return this.visitors.spot();
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

  /** Every beast in front of the eye, and where on the screen (the look tools). */
  beastsOnScreen(): ReturnType<FaunaLayer["onScreen"]> {
    return this.fauna.onScreen();
  }

  /** The beast nearest a screen point, if no one is: its lineage and what it is doing. */
  pickBeast(x: number, y: number): PickedBeast | null {
    return this.fauna.pick(x, y);
  }

  /** The beasts about the village (Phase 61: one possessed taken from them as laid, its small world drawn over them). */
  get faunaLayer(): FaunaLayer {
    return this.fauna;
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
