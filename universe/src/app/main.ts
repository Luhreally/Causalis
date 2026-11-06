// The page's entry: start the simulation host (in a worker, or in-thread with
// ?inline), run a universe, draw it with PlayCanvas and put the observatory over
// it. ?universe=earth (the default), alien or sandbox; ?seed=…; ?bench=N runs the
// instancing benchmark instead.
import "./styles.css";
import "./y2k.css";
import "./brushes.css";
import "./tour.css";
import "./can.css";
import "./years.css";
import { Checkpoint } from "./checkpoint.ts";
import { HostClient, LOT, inlinePair, lotStates, progress, workerPort } from "../bridge/index.ts";
import {
  FreeRig,
  GlobeActs,
  GlobeScene,
  GlobeTowns,
  GlobeWars,
  GlobeArcLayer,
  OrbitRig,
  RegionScene,
  RegionWars,
  SandboxScene,
  Stage,
  SystemScene,
  ClusterScene,
  VILLAGE_METRE,
  GalaxyScene,
  colonyMaterials,
  fleetMaterials,
  galaxyMaterial,
  skyMaterials,
  VillageScene,
  AutoQuality,
  QUALITIES,
  QUALITY_NAMES,
  regionMaterials,
  runBench,
  MeadowScene,
  BandLayer,
  BattleLayer,
  groundOfLook,
  WeatherLayer,
  ActsNearLayer,
  type CarrierKind,
  type GlobeTown,
  type QualityName,
} from "../render/index.ts";
import {
  LabelLayer,
  type Label,
  Tidings,
  PlanetPanel,
  RegionPanel,
  SandboxPanel,
  SystemPanel,
  ClusterPanel,
  VillagePanel,
  WorldPanel,
  CampPanel,
  BattlePanel,
  BattleSlowCaption,
  WarAgePanel,
  WarPanel,
  GalaxyPanel,
  GuidedWalk,
  FreeControls,
  MapLabels,
  MapModes,
  type FreeMode,
  Outliner,
  SearchBox,
  Tooltip,
  PageWindow,
  NamesSwitch,
  Alerts,
  Colonies,
  StarWars,
  ArmsBook,
  EventWindows,
  GodPalette,
  GodBrushes,
  type TownPlace,
  WAY_CHOICES,
  isGreat,
  HoverTips,
  LogButton,
  RunNote,
  type MapName,
  type PeopleEntry,
  type WorldStats,
  installTimeKeys,
  type TimeKeys,
  TimeBar,
  jumpToYear,
  typing,
  el,
  DirectorControls,
  DayTold,
  WarViews,
  type ManCard,
} from "../ui/index.ts";
import type {
  ActsMap,
  BeastPlan,
  CampCraft,
  CampNear,
  FolkNear,
  BattleNear,
  Campaign,
  WarAge,
  ClusterPlan,
  LandPlan,
  LandSky,
  SkyState,
  NationMap,
  StarLens,
  StarLensMap,
  StarTour,
  TourStop,
  NationSight,
  PeoplesSky,
  SystemPlan,
  VillagePlan,
  WorldGlobe,
  GalaxyPlan,
  PageModel,
  Place,
  StarPage,
  WarsMap,
  WorldFirst,
  WorldStage,
  ArmBorne,
  BattleRoll,
  RollEntry,
  ColonyEntry,
  PortPlan,
  FillPlan,
  ColonyLook,
  ColonyVoyage,
  StarFightList,
} from "../bridge/index.ts";
import { nearestCell, sphereGrid, yearOfMoment } from "../kernel/index.ts";

import {
  GOOD_CHOICES,
  LAW_CHOICES,
  colonyHour,
  landingToShow,
  colonySky,
  seaSky,
  newDirector,
  nextTake,
  starFightTake,
  starsWords,
  tourTake,
  WEALTH_CHOICES,
  wealthNote,
  wealthShades,
  untold,
  type Director,
  type Take,
  type TownSeen,
  type BattleSeen,
  goodsSpread,
  groundColors,
  cellAt,
  cellCenter,
  builtOverCells,
  frameKind,
  frameUndersea,
  builtOverTiles,
  globeColors,
  regionColors,
  regionFromGlobe,
  regionHeights,
  regionTrees,
  SIGNS,
  keepOut,
  orbitOf,
  villageGround,
  type FreeRules,
  type FreeState,
  battleFront,
  counterWords,
  LY_SCALE,
  filledCells,
  farFace,
  filledColors,
  hallCells,
  hallDomes,
  settleOrder,
  landTidings,
  campWords,
  BAND_DAY,
  CRAFT_DOINGS,
  MEADOW_STEP,
  bandHour,
  bandKitWords,
  bandPersonWords,
  bandWords,
  campFigure,
  campRoom,
  figureOf,
  figurePaint,
  folkLook,
  weatherAt,
  squareNow,
  downpourAt,
  seasonAt,
  seasonKey,
  seasonTiles,
  actsNear,
  type ActsNear,
  type GroundSeason,
  type Weather,
  newBand,
  newMeadow,
  BATTLE_LENGTH,
  BATTLE_SPEEDS,
  WAR_AGE_YEARS_A_SECOND,
  WAR_SPEEDS,
  WAR_YEARS_A_SECOND,
  warAgeAt,
  warAgeSpan,
  type WarAgeNow,
  RANK_STEP,
  hostsDepth,
  campaignAt,
  campaignSpan,
  foughtAt,
  type CampaignNow,
  MOMENTS,
  fieldMiddle,
  routAt,
  battleAt,
  menAt,
  mostFor,
  newBattle,
  trooperWords,
  fieldMeadow,
  type BattleField,
  type BattleNow,
  GORES,
  blowWords,
  blowsAt,
  newBlows,
  type Blows,
  type Gore,
  stepBand,
  stepMeadow,
  type BandKit,
  type BandState,
  type MeadowState,
  beliefColor,
  landWars,
  LandWays,
  globeInPlace,
  heartTown,
  landSpots,
  townWarNow,
  warNow,
  townDoingIcon,
  TIME_LADDERS,
  type TownWar,
  type TownWarScene,
  litColors,
  placeActs,
  warPaths,
  sandboxSpec,
  skyMarks,
  voyageMarks,
  peopleMarks,
  peopleSystemMarks,
  systemExtent,
  systemSpec,
  worldColors,
  lyFromHome,
  homeOf,
  nameShape,
  namesThatFit,
  withinName,
  LENS_NAMES,
  STANDING_COLORS,
  WAR_COLORS,
  type Lens,
  type Lit,
  type NameShape,
  type RegionLens,
  type SandboxSpec,
  type StoresNow,
  dayTold,
  legsTold,
  woundLines,
  type DayLine,
  FATE_WORDS,
  HAND_FATE_WORDS,
  battleCapAt,
  battleCapWords,
  battleSlowings,
  globeArcsNow,
  RAID_FIRES,
  raidEye,
  GREAT_LASTS,
  raidFilm,
  raidOver,
  raidSlowings,
  battleSecond,
  battleShelter,
  battleStage,
  borneNow,
  borneShare,
  fallenNow,
  fieldFrame,
  fieldWatchers,
  figureFate,
  placedCamp,
  placedMost,
  placedPoint,
  rollNames,
  foughtNow,
  warViewsClosed,
  type PlacedFrame,
  type Watcher,
  type WarView,
  type WarViewed,
  slowAhead,
  slowingBegun,
  type Slowing,
} from "../view/index.ts";

/** A point along a name's line: `d` radians from its centre, on the unit sphere. */
function rim(s: NameShape, d: number): { x: number; y: number; z: number } {
  const c = Math.cos(d),
    n = Math.sin(d);
  return { x: s.x * c + s.ax * n, y: s.y * c + s.ay * n, z: s.z * c + s.az * n };
}
import { deviceTier } from "./tier.ts";
import { installHeld, type HeldField } from "./held.ts";
import { installPossession } from "./possess.ts";
import { installHome, type HomeAsk } from "./home.ts";
import { installMoney } from "./money.ts";
import { installLeaders } from "./leaders.ts";
import { installLife } from "./life.ts";
import { installReign } from "./reign.ts";
import { installColonyFilm, type ColonyFilm } from "./colony-film.ts";
import { installContactFilm, type ContactFilm } from "./contact-film.ts";
import { installLandfallFilm, type LandfallFilm } from "./landfall-film.ts";
import { VisitorsLayer } from "../render/index.ts";
import { installFleetFilm, type FleetFilm } from "./fleet-film.ts";
import { installNationFilm, type FilmMark, type NationFilm } from "./nation-film.ts";
import { installFarFilm, type FarFilm } from "./far-film.ts";
import { installJumpFilm, type JumpFilm } from "./jump-film.ts";
import { sound } from "./sound.ts";
import { airOf, airOfWorld } from "./sound-mix.ts";
// (Anyone's family and body on their card, a war's soldiers named from its roll: Phase 55 wave 5.)
import { kinLines } from "../ui/index.ts";
import { seatRef, type KinCard, type StruckMember, type StruckNow } from "../bridge/index.ts";
import type { WealthBook, WealthMeasure } from "../bridge/index.ts";
import {
  hasSpires,
  mirrorStrength,
  struckOf,
  toldBlows,
  warManOf,
  warSlot,
} from "../view/index.ts";

const DAY = 86_400;
/** What the hand's people do, in words. */
const WORK_WORDS = [
  "a child",
  "a forager",
  "a farmer",
  "a herder",
  "a crafter",
  "a trader",
  "a leader",
];
/** The map modes whose tooltip breaks a land's number down (Phase 12 M108, Phase 14). */
const DEEP_LENSES: readonly Lens[] = [
  "unrest",
  "strength",
  "wealth",
  "knowledge",
  "growth",
  "ways",
  "belief",
  "goods",
  "ground",
  "bondage",
  "standing",
  "laws",
  "sickness",
  "debt",
];
/** The map modes that show the people (repainted as their numbers come, and turned to them). */
const PEOPLE_LENSES: readonly Lens[] = [
  "people",
  "food",
  "trade",
  "tongues",
  "realms",
  "faiths",
  "unrest",
  "strength",
  "wealth",
  "knowledge",
  "growth",
  "ways",
  "belief",
  "goods",
  "bondage",
  "standing",
  "laws",
  "sickness",
  "debt",
];
const YEAR = 365 * DAY;
const SKY = [0.09, 0.1, 0.13] as const;
/** How long what a town did lately stays on its label (ms). */
const TIDING_MS = 4000;
const SPACE = [0.02, 0.025, 0.045] as const;

const params = new URLSearchParams(location.search);
/** Whether the view turns slowly when left alone (a setting, off unless chosen), and how fast. */
const DRIFT_KEY = "causalis.drift";
let drifting = (() => {
  try {
    return localStorage.getItem(DRIFT_KEY) === "1";
  } catch {
    return false;
  }
})();
let driftRate = 1.5;
/** How much of the blood and the wounds a battle shows (a setting: all unless chosen; Phase 55). */
const GORE_KEY = "causalis.gore";
let gore: Gore = (() => {
  try {
    const v = localStorage.getItem(GORE_KEY);
    return v === "less" || v === "none" ? v : "full";
  } catch {
    return "full";
  }
})();
/** A scale's own rate of turning (degrees a second), or none unless turning is chosen. */
const drift = (rate = 1.5) => {
  driftRate = rate;
  return drifting ? rate : 0;
};
const seed = params.get("seed") ?? "first light";
const inline = params.has("inline");
const bench = Number(params.get("bench") ?? 0);
const universe = params.get("universe") ?? "earth";
const startYear = Number(params.get("year") ?? 0);
/** A save to take up on starting (the saves page opens another world's save this way). */
const loadName = params.get("load");
/** ?signs=0 keeps what people say unshown (for measuring). */
const signs = params.get("signs") !== "0";

type Exposed = {
  client?: HostClient;
  /** The year a world begun at a far year took up from (a world baked ahead's; 0: its beginning). */
  jumpedFrom?: number;
  mode?: string;
  seed?: string;
  universe?: string;
  /** How much is drawn: figures in the sandbox, painted cells on a globe. */
  drawn?: () => number;
  select?: (cell: number) => void;
  /** Go down from the globe to the region around a cell. */
  descend?: (cell: number) => void;
  /** How many villages the region on screen shows. */
  villages?: () => number;
  /** Down to a battle's field to watch it fought (Phase 37 M186): whether it is watched. */
  watchBattle?: (event: string) => Promise<boolean>;
  /**
   * A battle watched where it is now, as its page, the tidings and a war's bar watch it (Phase 55):
   * before the town it is fought before while it is fought, else on its field. The scale come to.
   */
  watchBattleWhere?: (event: string) => Promise<string>;
  /** The town a battle is watched fought before now (null: none — it is watched on its field). */
  battleTownNow?: (event: string) => Promise<string | null>;
  /** Down to a battle's field from the words it is given, not asked of the host: whether it is watched. */
  watchBattleNear?: (near: BattleNear) => Promise<boolean>;
  /** The battle watched: its moment and speed, its hosts as drawn and as history counts them, what is told, those seen. */
  battle?: () => {
    event: string;
    title: string;
    outcome: string;
    s: number;
    speed: number;
    per: number;
    figures: number[];
    standing: number[];
    fallen: number[];
    men: { standing: number[]; fallen: number[] };
    words: string;
    arrows: number;
    parts: number;
    followed: string | null;
    /** Those seen, where on the screen (a machine gun's team: `gun`). */
    onScreen: {
      id: number;
      side: number;
      act: string;
      gun?: true;
      at: { x: number; y: number } | null;
    }[];
    world: boolean;
    /** Beams in the air, pools of blood, puffs of smoke now (Phase 66). */
    bolts: number;
    blood: number;
    smoke: number;
    /** The armoured cars, those knocked out, those prone, the machine guns' teams, a trench, the weapon button. */
    cars: number;
    wrecks: number;
    prone: number;
    guns: number;
    trench: boolean;
    weapon: boolean;
    /** The one followed as his card names him (Phase 55 M227–M228), and how many figures the roll named. */
    named: ManCard | null;
    rolled: number;
  } | null;
  /** The battle watched set to a moment (its seconds), at one of its speeds (an index). */
  battleAt?: (s: number, speed?: number) => void;
  /**
   * The blows of the battle watched (Phase 55): the setting; each side's fallen, wounded who
   * lived and maimed (figures), the parts cut off; what is struck and drawn now; each part lying
   * apart and how far from where it was cut off; the struck and those who help, by what they are
   * at; each one struck (where on the screen: null where unseen).
   */
  blows?: () => {
    gore: string;
    dead: number[];
    hurt: number[];
    maimed: number[];
    loose: number;
    struck: number[];
    wounds: number;
    stuck: number;
    blood: number;
    limbs: { id: number; lost: string; striker: string; from: number; y: number }[];
    drawn: { wounds: number; ends: number; shafts: number; drops: number };
    acts: Record<string, number>;
    onScreen: {
      id: number;
      side: number;
      act: string;
      hit: string;
      striker: string;
      living: boolean;
      lost: string | null;
      fell: string | null;
      crawl: boolean;
      since: number;
      at: { x: number; y: number } | null;
    }[];
  } | null;
  /** The blood and the wounds shown: "full", "less" or "none" (Phase 55). */
  setGore?: (gore: string) => void;
  /** One who fought followed, by their id (null: the hosts again), as a tap on them does (Phase 55). */
  followFighter?: (id: number | null) => void;
  /** A war watched unfolding on the globe (Phase 38 M193): whether it is watched. */
  watchWar?: (ref: string) => Promise<boolean>;
  /** The war watched: its year and speed, what is told, its tallies, its host's way, what is drawn and marked. */
  war?: () => {
    ref: string;
    title: string;
    year: number;
    span: { from: number; to: number };
    speed: number;
    words: string;
    fought: number;
    battles: number;
    won: number[];
    fallen: number[];
    taken: number;
    march: number | null;
    siege: number | null;
    follow: boolean;
    drawn: { marching: number; battle: number; fallen: number; tents: number };
    marks: string[];
    world: boolean;
    panel: boolean;
  } | null;
  /** The war watched set to a year (fractional), at one of its speeds (an index). */
  warAt?: (year: number, speed?: number) => void;
  /** Leave the war watched, back to the world as it is. */
  leaveWar?: () => void;
  /** The wars of an age watched unfolding together (M194): whether they are watched. */
  watchWarAge?: (from?: number, to?: number) => Promise<boolean>;
  /** The age watched: its years and clock, what is told, its wars under way, its tallies, what is drawn and marked. */
  warAge?: () => {
    from: number;
    to: number;
    wars: number;
    year: number;
    span: { from: number; to: number };
    speed: number;
    words: string;
    under: number;
    fought: number;
    fallen: number;
    latest: { event: string; war: string } | null;
    drawn: { marching: number; battle: number; fallen: number; tents: number };
    marks: string[];
    world: boolean;
    panel: boolean;
  } | null;
  /** The age watched set to a year (fractional), at one of its speeds (an index). */
  warAgeAt?: (year: number, speed?: number) => void;
  /** Leave the age watched. */
  leaveWarAge?: () => void;
  /** The world's clock: whether it stands (paused, or held), and the speed asked of it. */
  clock?: () => { stopped: boolean; speed: number };
  /**
   * The battle at the turn fought before the town watched (Phase 55 M227): its stage and moment; its
   * figures, those the roll named, its fallen and wounded drawn against the one rule (battleFigures)
   * and the roll's lots; those drawn and lying now; those seen on the screen (named); what of its
   * blows is drawn; the town indoors and those watching; the hosts' fires; where its field lies; the
   * clock and its slowing.
   */
  placedBattle?: () => {
    event: string;
    turn: number;
    title: string;
    stage: string | null;
    s: number;
    per: number;
    figures: number[];
    named: number;
    falls: number[];
    hurt: number[];
    rule: { n: number; falls: number; hurt: number; stood: number }[];
    roll: { fell: number; hurt: number; stood: number }[];
    drawn: number;
    lying: number;
    onScreen: {
      id: number;
      side: number;
      act: string;
      crawl: boolean;
      hit: string | null;
      lost: string | null;
      fate: string;
      name: string | null;
      ref: string | null;
      at: { x: number; y: number } | null;
    }[];
    marks: { wounds: number; ends: number; shafts: number; drops: number };
    parts: number;
    shadows: boolean;
    watchers: number;
    sheltered: number;
    camp: number;
    frame: PlacedFrame;
    clock: { speed: number; pace: number; stopped: boolean };
    slowed: string | null;
    told: string;
  } | null;
  /** One who fought before the town tapped, as a tap on him does: his card's words (null: none). */
  tapPlaced?: (id: number) => Promise<string | null>;
  /** The ways to watch a battle shown (Phase 55 M230): the one watched, those open now; one chosen (the scale come to). */
  warViews?: () => { at: string | null; open: string[] };
  warView?: (view: string) => Promise<string>;
  /** A town of the land on screen as drawn from its fabric: its square and reach (region units); and the parts drawn in all (M150). */
  landTown?: (ref: string) => { x: number; z: number; r: number } | null;
  landParts?: () => number;
  land?: () => {
    towns: number;
    parts: number;
    fields: number;
    roads: number;
    lanes: number;
    traffic: Partial<Record<string, number>>;
    camps: number;
    campParts: number;
  };
  /** Down among a band of a land's camp (Phase 29 M160). */
  goNear?: (cell: number, camp: number) => Promise<void>;
  /** A world no people rose on: what the bar tells of it (null where people rose). */
  lifeless?: () => string | null;
  /** The world's stage as last read (Phase 31 M167). */
  worldStage?: () => WorldStage | null;
  /** The eye that watches by itself (Phase 31 M168): whether it watches, its caption, its take. */
  /** The port the eye is at (Phase 71). */
  portNow?: () => {
    at: { x: number; z: number };
    standing: number;
    flying: number;
    far: number;
    near: number;
    cell: number | null;
    chip: string | null;
  } | null;
  director?: () => {
    watching: boolean;
    told: string;
    take: { kind: string; words: string } | null;
    filming: boolean;
    /** The age of the stars being shown (Phase 73): how far through, of how many; the moment's key. */
    touring: boolean;
    tourAt: number;
    tourOf: number;
    stop: string | null;
  };
  /** The lens on the stars around (Phase 73), what it draws, and what it says. */
  starLens?: () => {
    lens: string | null;
    marks: number;
    lines: number;
    note: string | null;
  } | null;
  raidOn?: () => boolean;
  watchIt?: (on: boolean) => Promise<void>;
  /**
   * The look of the people seen near (Phase 34), at a camp or in a town: how they stand, their
   * arms, eyes and what grows on them, their hide's colour, the parts of their figure (null: the
   * upright apes, as ever, or none seen); where one of them stands and which way they face, and
   * the camp's middle (units, degrees), for the eye.
   */
  folk?: () => {
    stance: string;
    arms: number;
    eyes: number;
    crest: boolean;
    horns: number;
    feelers: boolean;
    tail: boolean;
    hide: string;
    mark: string;
    parts: number;
    at: { x: number; z: number } | null;
    middle: { x: number; z: number } | null;
    facing: number | null;
  } | null;
  /** A band of a land's camp seen near (Phase 29 M160): its people, the land's beasts, their hour, what they are at. */
  near?: () => {
    cell: number;
    camp: number;
    people: number;
    beasts: number;
    kinds: string[];
    hour: number;
    day: number;
    kills: number;
    doing: string;
    parts: number;
    /** Each of them by name, and the one the eye keeps to (Phase 29 M161). */
    names: string[];
    followed: string | null;
    onScreen: { id: number; at: { x: number; y: number } | null }[];
    /**
     * Their crafts (Phase 49 M211): who is at one, in their words; what the band keeps and has
     * made; the fire at this camp and the last made; what they make things of; the work ground and
     * the frame (units); the crafts as drawn.
     */
    crafting: {
      id: number;
      kin: string;
      doing: string;
      words: string;
      at: { x: number; z: number };
    }[];
    kit: BandKit;
    kitWords: string;
    made: number;
    camps: number;
    lit: boolean;
    kindled: string;
    craft: CampCraft;
    work: { x: number; z: number };
    frame: { x: number; z: number };
    drawn: { flakes: number; frame: number; hide: number; racked: number };
  } | null;
  /** The band seen near packs up at its next morning (Phase 49 M211). */
  moveCamp?: () => void;
  /** The weather where the eye is on the ground (Phase 30 M162): its land, how it is told, what is drawn. */
  weather?: () => {
    cell: number;
    words: string;
    icon: string;
    rain: number;
    snow: number;
    cloud: number;
    haze: number;
    warmth: number;
    drops: number;
    flakes: number;
    sky: string;
    /** In a town: how many are in out of a downpour. */
    sheltered: number;
    /** The god's acts on the land seen near (M163): told, and what is drawn of them. */
    hand: {
      told: string[];
      motes: number;
      flames: number;
      smoke: number;
      light: number;
      shake: number;
    };
    /** The weather's own seconds (they stand while the clock does). */
    seconds: number;
    /** The season on the ground (M164): snow lying, the leaves, how far turned, ice. */
    season: { snow: number; leaf: number; turned: number; ice: number };
    /** Among a band: the land about them greening or parching (else empty). */
    ground: string;
  } | null;
  /** A land's bands' camps as drawn (Phase 28 M159). */
  camps?: () => {
    cell: number;
    id: number;
    tile: number;
    x: number;
    z: number;
    people: number;
    herds: boolean;
  }[];
  /** Where the first cart, wagon, truck, train or ship of a land is now (Phase 26 M153). */
  landCarrier?: (kind: string) => { x: number; z: number } | null;
  /** Where on the screen one of the town's buildings, one of its homes and its walls are (M151). */
  townOnScreen?: () => unknown;
  /** The town seen near (the look tools): which, whether it is its land's heart, the battle it sees. */
  townShown?: () => { ref: string; name: string; heart: boolean; battle: string | null } | null;
  /** Where on the screen a point of the town seen near is (metres from its middle; M201), or null. */
  townScreen?: (x: number, z: number) => { x: number; y: number } | null;
  /** How many of each thing a town's countryside shows now (Phase 32), at the village scale. */
  country?: () => Record<string, number> | null;
  /** What a town's square shows now (Phase 33): its feast, its fire, its market; the bar's words. */
  feast?: () => (Record<string, number> & { words: string; feasts: number }) | null;
  /** Watch a village through the microscope; how many people are watched. */
  watch?: (ref: string) => void;
  watching?: () => number;
  /** Out to the home star's system; how many of its bodies are shown. */
  sky?: () => void;
  skyBodies?: () => number;
  skyMirrors?: () => number | null;
  /** Out to the stars around; how many are shown. */
  stars?: () => void;
  starCount?: () => number;
  bench?: unknown;
  /** The guided walk's step (from 0), or -1 when it is not showing. */
  walk?: () => number;
  /** The quality the world is drawn at now, and a choice of it (as the settings make it). */
  quality?: () => string;
  setQuality?: (choice: string) => void;
  /** Why the page could not start, if it could not ("webgl" when 3D is unavailable). */
  error?: string;
  /** The PlayCanvas stage, for debugging tools. */
  stage?: Stage;
  /** Beasts, birds and fish drawn about the village watched (0 elsewhere), and each beast now. */
  beasts?: () => number;
  /** How many lands visitors from another star are at now (Phase 18 M134). */
  visits?: () => number;
  /** Visitors from another star in the village shown (Phase 18 M134), or null off the village. */
  visitors?: () => { groups: number; figures: number; whys: string[] } | null;
  /** The peoples of other stars drawn in the system shown (M136), or null off a system. */
  systemPeople?: () => { worlds: number; craft: number; ships: number } | null;
  /** Where each group's ship stands on the screen, and a tap in the village as by hand. */
  visitorsOnScreen?: () => { key: string; text: string; x: number; y: number }[];
  tapVillage?: (x: number, y: number) => void;
  faunaNow?: () => {
    name: string;
    niche: string;
    x: number;
    y: number;
    z: number;
    doing: string;
  }[];
  /** Hold the beasts' clock at a screen time (seconds), or run it again (null). */
  holdFauna?: (s: number | null) => void;
  /** Down to another star's world (its star's ref, its place outward). */
  visitForeign?: (ref: string, index: number) => Promise<void>;
  /** Out to the galaxy, how many of its stars are drawn, and a tap on it (screen px). */
  galaxy?: () => void;
  galaxyStars?: () => number;
  tapGalaxy?: (x: number, y: number) => void;
  /** Down to a world of the system (by its index), and which world is seen now (-1 none). */
  visit?: (index: number) => void;
  /** Down to a colony's land (Phase 64). */
  visiting?: () => number;
  /** Out to a world being filled, by its key; what is drawn of it (Worlds filled). */
  seeFilled?: (key: string) => Promise<boolean>;
  fillShown?: () => { key: string; share: number; lit: number; cells: number } | null;
  /** How many halls stand on the world seen whole (M95: halls from orbit). */
  hallsShown?: () => number;
  colonyFilm?: ColonyFilm;
  contactFilm?: ContactFilm;
  landfallFilm?: LandfallFilm;
  toFolk?: (star: string, index: number, at?: number) => Promise<FolkNear | null>;
  fleetFilm?: FleetFilm;
  /** What is heard (Sound, first slice): its state and its measures, for a gate. */
  sound?: typeof sound;
  /** Realms among the stars (Phase 72): a realm's coming apart watched, the stars drawn held. */
  nationFilm?: NationFilm;
  nationsShown?: () => number | null;
  nationMap?: () => NationMap | null;
  jumpFilm?: JumpFilm;
  farFilm?: FarFilm;
  /** Another star's world seen whole, from anywhere (W6's gate and the pages). */
  seeWorld?: (star: string, planet: number) => Promise<void>;
  worldRuined?: () => boolean;
  /** A page opened by its ref (the look tools). */
  pageWindowOpen?: (ref: string) => void;
  planNow?: () => VillagePlan | null;
  /** What the lots of the town drawn are now (the look tools): fallen, homes standing whole, all. */
  townLots?: () => { fallen: number; homes: number; lots: number; civics: number } | null;
  closePage?: () => void;
  watched?: () => number | null;
  reloadPlan?: () => Promise<void>;
  /** Whether a great happening's window is open (M100). */
  eventOpen?: () => boolean;
  /** The god's palette (Phase 12 M106): the act in hand, an act taken up or put down, a tap. */
  palette?: {
    holding: () => string | null;
    take: (id: string) => void;
    putDown: () => void;
  };
  /** What the armies drawn are made of now (M110): on the globe and in a land, by kind. */
  armies?: () => { globe: Record<string, number>; land: Record<string, number> };
  /** Where each host, battle, camp and garrison stands in the land shown (its map's km). */
  landMarks?: () => { ref: string; name: string; x: number; z: number }[];
  /** The acts playing on the globe, and their marks drawn now. */
  actsPlaying?: () => number;
  actsDrawn?: () => number;
  /** The lands the palette lights now. */
  lit?: () => [number, string][];
  /** Into another star's own system (M95), by its ref; and whose system the sky shows. */
  starSystem?: (ref: string) => void;
  /** Where a star about us stands on the screen, while the stars are shown. */
  starOnScreen?: (ref: string) => { x: number; y: number } | null;
  skyOf?: () => string | null;
  /** Everyone carrying something in the village watched: where and what. */
  carriersNow?: () => { x: number; z: number; carry: string }[];
  /**
   * The town's stores now (Phase 39 M198): what each holds and how long it would last, what came
   * in and went out today, who is at what, what is going up; its heaps' pieces; its card's words.
   */
  stores?: () =>
    | (StoresNow & {
        heaps: {
          sacks: number;
          logs: number;
          stones: number;
          ore: number;
          granary: { x: number; z: number; heap: boolean };
          yard: { x: number; z: number; heap: boolean };
        } | null;
        card: string | null;
      })
    | null;
  /** Open the town's stores card (the look tools). */
  showStores?: () => void;
  /** Where on the screen one of those drawn in the town stands now. */
  personOnScreen?: (index: number) => { x: number; y: number } | null;
  /** The marks of war drawn on the globe now (for the look tools). */
  warsDrawn?: () => number;
  /** The hosts and battles a land's map shows of the wars (M95), and whether the wars are known. */
  landWars?: () => { marches: number; battles: number; ships: number; known: boolean };
  /** Where a land's battles stand on the screen now, by the eye as it is (none off the land's map). */
  battlesOnScreen?: () => { ref: string; x: number; y: number }[];
  /** A land's wars in place now (M203): each host's doing and place, the fights about the turn, the clock slowed for one. */
  /** Strikes from the air drawn over the land now (W2). */
  landRaids?: () => { raids: number; flyers: number; arcs: number; words: readonly string[] };
  /** Rockets' ways on the land's screen, on the globe's and over the town (W3's look tools). */
  landArcsOnScreen?: () => { x: number; y: number }[];
  globeArcsOnScreen?: () => { x: number; y: number }[];
  /** The eye onto where a rocket's way over the land comes down (the look tools). */
  faceLandArc?: () => boolean;
  streaksOnScreen?: () => { x: number; y: number }[];
  warsInPlace?: () => {
    marks: {
      ref: string;
      side: number;
      doing: string;
      x: number;
      z: number;
      men: number;
      name: string;
    }[];
    fights: { key: string; stage: string; k: number; x: number; z: number; name: string }[];
    camps: number;
    figures: number;
    fallen: number;
    slowed: string | null;
    told: string;
    wars: {
      ref: string;
      turn: number;
      f: number;
      attacker: string | null;
      defender: string | null;
    }[];
  } | null;
  /** How far along its way each of the world's wars' hosts is on the globe now (M203). */
  globeMarching?: () => Record<string, number>;
  faceLand?: (x: number, z: number, distance?: number) => boolean;
  /** The war about the town watched (Phase 40 M204): its hosts, its fight, its fallen, its camp and fires. */
  townWar?: () => {
    ref: string;
    words: string;
    told: string;
    hosts: { side: 0 | 1; doing: string; k: number; gathered: number }[];
    fight: TownWar["fight"];
    fought: TownWar["fought"];
    siege: boolean;
    burning: number;
    soldiers: number;
    fallen: number;
    doing: string[];
    middles: readonly ({ x: number; z: number } | null)[];
    tents: number;
    fires: number;
  } | null;
  faceTown?: (x: number, z: number, distance?: number) => boolean;
  /** Hold a battle made up before the town watched at one of its seconds, to see how it is fought (W1b; null: let go). */
  holdBattle?: (near: BattleNear | null, s?: number) => void;
  /** The battle held before the town as drawn now, its eye brought to it where asked (W1b's gate). */
  heldBattle?: (face?: boolean) => {
    s: number;
    fire: BattleField["fire"] | null;
    meet: number;
    words: string;
    flashes: number;
    streaks: number;
    cars: number;
    standing: number[];
    fallen: number[];
    troopers: {
      id: number;
      side: number;
      x: number;
      z: number;
      act: string;
      size: number;
      by: string | null;
      falls: number | null;
    }[];
  } | null;
  /** What one of the battle held before the town is told as, at its second. */
  heldWords?: (id: number) => string | null;
  /** Hold a war made up about the town watched, to see how its hosts stand (W1; null: its year's again). */
  holdTownWar?: (tw: TownWar | null) => void;
  /** The town war's whole scene as drawn now (W1's gate reads its figures). */
  townWarScene?: () => TownWarScene | null;
  /** The town's trades at their buildings as drawn (Phase 41 M199): its works, the sails' turn, kilns aglow, sparks. */
  trades?: () => {
    mills: number;
    kilns: number;
    smithies: number;
    turn: number;
    glowing: number;
    sparks: number;
    smelting: boolean;
    hung: number;
    /** Where the smithy's rack stands (metres; Phase 51 M213). */
    rack: { x: number; z: number } | null;
  } | null;
  /** Where each tool hung on the smithy's rack stands on the screen (Phase 51 M213). */
  rackOnScreen?: () => { x: number; y: number; form: string }[];
  /**
   * The crafts seen being made as drawn (Phase 51 M214): the potters' wheels (how many turn), the
   * pots on the kilns' boards, the looms (how many woven at), the clamp's round; where each is.
   */
  crafts?: () => {
    wheels: number;
    turning: number;
    pots: number;
    looms: number;
    weaving: number;
    clamp: { stage: number; smoking: boolean } | null;
    wheelsAt: { x: number; z: number; turning: boolean }[];
    boardsAt: { x: number; z: number; pots: number }[];
    loomsAt: { x: number; z: number; woven: number; index: number }[];
    clampAt: { x: number; z: number; stage: number; lit: boolean } | null;
  } | null;
  /** Where each pot on the kilns' boards, and each loom's cloth, is on the screen (Phase 51 M214). */
  potsOnScreen?: () => { x: number; y: number; form: string; kiln: number }[];
  /** Where each of the foundry's moulds lies on the screen, and whether it is poured (Phase 51 M215). */
  mouldsOnScreen?: () => { x: number; y: number; poured: boolean }[];
  /** Where each of the works' machines and each part on its bench is on the screen (Phase 51 M215). */
  machinesOnScreen?: () => { x: number; y: number; kind: "lathe" | "press"; running: boolean }[];
  benchOnScreen?: () => { x: number; y: number; form: string }[];
  loomsOnScreen?: () => { x: number; y: number; woven: number; index: number }[];
  /** One of those drawn: their day's legs, today (Phase 51 M213). */
  legs?: (index: number) => {
    from: number;
    to: number;
    why: string | null;
    carry: string | null;
    task: string | null;
  }[];
  /** What struck the town watched as drawn (Phase 42 M201): its homes alight, smoking, in dust; the ground shaking; who is at its fires, by what. */
  /** The god's wonders in a town seen near as drawn (M201): each, where it stands (metres). */
  wonders?: () => { kind: string; x: number; z: number }[];
  raidersOnScreen?: () => { x: number; y: number }[];
  watchRaid?: (event: string) => Promise<boolean>;
  raidFilming?: () => number | null;
  stopRaidFilm?: () => void;
  blaze?: () => {
    fires: number;
    smoke: number;
    dust: number;
    alight: number;
    shake: number;
    fight: Record<string, number>;
    burning: { x: number; z: number } | null;
    dusty: { x: number; z: number } | null;
  } | null;
  /**
   * The wounds of the town watched as drawn (Phase 55 M226, M229): how many wear a look and what of
   * it is drawn; who is abed, away with the levy, gone; the wounds healing; the marked for good; the
   * homecomings of the next ten days; its litters now; where its road leaves it.
   */
  wounds?: () => ReturnType<VillageScene["woundsShown"]>;
  /**
   * The graveyard of the town watched as drawn (Phase 43 M205): where it lies, its size, its
   * graves, what of them is drawn, today's open graves and biers, and its funerals of so many
   * days to come (when each leaves, comes to the graveyard, is done and filled in; how many it
   * buries and bears; who, where known).
   */
  graveyard?: (days?: number) => {
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
    bier: { x: number; z: number; borne: boolean } | null;
    funerals: {
      leaves: number;
      arrive: number;
      done: number;
      filled: number;
      biers: number;
      dead: number;
      bearers: number;
      grave: { x: number; z: number };
      struck: string | null;
      name: string | null;
    }[];
  } | null;
  /**
   * The trade of the town watched (Phase 48 M210): its plan's, its traders now, and the trips they
   * set out on from today for so many days.
   */
  trade?: (days?: number) => {
    trade: {
      out: { what: string; land: string; count: number }[];
      in: { what: string; land: string; count: number }[];
    } | null;
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
  } | null;
  /**
   * The hunt of the town watched as drawn (Phase 47 M209): today's, the game (by its day, and as
   * drawn), and those at the hunt now.
   */
  hunt?: () => {
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
  } | null;
  /**
   * The flock of the town watched as drawn (Phase 46 M208): what it is about and where, its fold,
   * the stubble it grazes (-1: its pasture), each of it (size, lying) and its herders now.
   */
  flock?: () => {
    state: string;
    x: number;
    z: number;
    fold: { x: number; z: number };
    stubble: number;
    beasts: { x: number; z: number; size: number; lying: boolean }[];
    herders: { x: number; z: number; why: string | null }[];
  } | null;
  /**
   * The year in the fields of the town watched as drawn (Phase 44 M206): how it stands (rain, dry,
   * lush, blight, blessed, worn, growth), its crop laid out, the fields being reaped and their
   * fronts, those watered and pulled today, and those at the fields' work now by what they are at.
   */
  fields?: () => {
    year: {
      rain: number;
      dry: number;
      lush: number;
      blight: number;
      blessed: number;
      worn: number;
      growth: number;
    };
    crop: {
      standing: number;
      withered: number;
      stubble: number;
      stooks: number;
      high: number;
      fires: number;
    };
    reaping: { field: number; share: number; x: number; z: number }[];
    watered: number[];
    pulled: number[];
    at: Record<string, number>;
  } | null;
  /** The woodlot as drawn (Phase 41 M200): trees down, stumps, saplings, the next to come down, those coming down or lying. */
  felling?: () => {
    down: number;
    stumps: number;
    saplings: number;
    next: number | null;
    falling: { over: number; left: number; x: number; z: number }[];
  } | null;
  battleSlowed?: () => { slowed: string | null; told: string };
  spotOnScreen?: (spot: number) => { x: number; y: number } | null;
  faceBattle?: () => boolean;
  /** How the camera is steered now (M98): the orbit's, or free — flying or walking. */
  roaming?: () => string;
  spotBelow?: () => {
    spot: number;
    province: number;
    peopled: boolean;
    near: { spot: number; cell: number } | null;
    land: number;
    map: number | null;
  } | null;
  /** Where the free camera stands and looks, and whether it is passing between scales (M98). */
  freeState?: () => {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    passing: boolean;
  };
  /** The thing under a point of the screen, at the scale shown (M93). */
  refAt?: (x: number, y: number) => string | null;
  /** Turn the globe to a spot of its fine grid, from so far off (for the look tools). */
  faceSpot?: (spot: number, distance?: number) => void;
  /** Zoom on through to the next scale in or out, and which scale is shown (M88, for the look tools). */
  zoomThrough?: (way: "in" | "out") => Promise<void>;
  /** Open a thing's page (Phase 10 M92), and the page open now. */
  open?: (ref: string) => Promise<void>;
  pageOpen?: () => string | null;
  /** Go to where a thing is to be seen. */
  goTo?: (ref: string) => Promise<void>;
  scale?: () => string;
  /** Everyone in sight now, and what they are at (for the look tools). */
  peopleNow?: () => {
    name: string;
    x: number;
    z: number;
    activity: number;
    task: string | null;
    size: number;
  }[];
  /** What the people in view are saying now, in signs (for the look tools). */
  bubblesNow?: () => { key: string; text: string; at: { x: number; y: number } | null }[];
  /** The camera's rig, for the look tools. */
  rig?: OrbitRig;
  /** The genesis played (Phase 24): its stage and clock, the seed as the hand left it, its drop. */
  genesis?: () => unknown;
  /**
   * Anyone's family and body as their card tells them, by their ref; the soldiers of the war about
   * the town and the litters borne in sight, on the screen (Phase 55 wave 5).
   */
  kin?: (ref: string) => Promise<KinCard>;
  warMenOnScreen?: () => {
    slot: number;
    fallen: boolean;
    x: number;
    y: number;
    ground: { x: number; z: number };
  }[];
  littersOnScreen?: () => { index: number; x: number; y: number }[];
};
const exposed: Exposed = {};
(globalThis as { causalis?: Exposed }).causalis = exposed;

async function connect(): Promise<{ client: HostClient; mode: string }> {
  if (!inline && typeof Worker !== "undefined") {
    try {
      const worker = new Worker(new URL("../host/worker.ts", import.meta.url), { type: "module" });
      return { client: new HostClient(workerPort(worker)), mode: "worker" };
    } catch {
      // Fall through to the in-thread host.
    }
  }
  const { SimHost, UNIVERSES, IndexedDbByteStore } = await import("../host/index.ts");
  const [page, hostEnd] = inlinePair();
  let storage: InstanceType<typeof IndexedDbByteStore> | undefined;
  try {
    storage = typeof indexedDB === "undefined" ? undefined : new IndexedDbByteStore();
  } catch {
    // Storage refused (a private window): the world runs, unsaved.
  }
  const host = new SimHost(hostEnd, UNIVERSES, {
    clock: () => performance.now(),
    budgetMs: 6,
    ...(storage ? { storage } : {}),
  });
  const loop = async () => {
    await host.pump();
    requestAnimationFrame(() => void loop());
  };
  void loop();
  return { client: new HostClient(page), mode: "in-thread" };
}

function page(): { canvas: HTMLCanvasElement; hud: HTMLElement } {
  const app = document.getElementById("app")!;
  const canvas = document.createElement("canvas");
  canvas.id = "world";
  const hud = document.createElement("div");
  hud.id = "hud";
  app.replaceChildren(canvas, hud);
  return { canvas, hud };
}

async function runBenchPage(): Promise<void> {
  const { canvas, hud } = page(),
    tier = deviceTier(),
    stage = new Stage(canvas, tier, SKY);
  stage.backdrop("ground", Math.sqrt(bench) * 0.4);
  new OrbitRig(stage, canvas, {
    distance: Math.sqrt(bench) * 0.28 * 1.4,
    minDistance: 2,
    maxDistance: 200,
    pitch: -35,
    onTap: () => {},
  });
  hud.innerHTML = `<header class="bar"><strong class="brand">Instancing benchmark</strong><span class="clock">${bench.toLocaleString()} moving figures · measuring…</span></header>`;
  const result = await runBench(stage, bench);
  exposed.bench = { ...result, tier: tier.name, pixelRatio: stage.device.maxPixelRatio };
  hud.querySelector(".clock")!.textContent =
    `${bench.toLocaleString()} moving figures · ${result.fps.toFixed(1)} fps (${result.frameMs.toFixed(1)} ms a frame) · ${tier.name}`;
}

async function runSandboxPage(): Promise<void> {
  const { canvas, hud } = page(),
    tier = deviceTier(),
    stage = new Stage(canvas, tier, SKY),
    scene = new SandboxScene(stage, tier);
  stage.backdrop("ground", 30);
  const { client, mode } = await connect();
  Object.assign(exposed, { client, mode, seed, universe, drawn: () => scene.figures(), stage });
  await client.start("sandbox", seed);
  const time = new TimeBar(client, "ring");
  installTimeKeys(time);
  client.setInterest({ view: "ring", focus: null });

  let spec: SandboxSpec | null = null;
  const panel = new SandboxPanel(hud, client);
  time.at("ring", panel.timeSlot);
  const select = (cell: number | null) => {
    panel.select(cell);
    scene.select(
      cell === null
        ? null
        : (() => {
            const [x, z] = cellCenter(cell, spec?.cells.length ?? 16);
            return { x, z };
          })(),
    );
  };
  panel.onClose = () => scene.select(null);
  exposed.select = (cell: number) => select(cell);
  // Fit the ring to the screen: a portrait phone needs the camera further back.
  // Refit when the window turns, unless the viewer has zoomed by hand.
  const fit = () => {
    const aspect = Math.max(0.3, innerWidth / Math.max(1, innerHeight));
    return aspect < 1 ? 26 / aspect : 30;
  };
  const rig = new OrbitRig(stage, canvas, {
    distance: fit(),
    minDistance: 8,
    maxDistance: 110,
    pitch: -42,
    drift: drift(),
    onTap: (x, y) => {
      const p = stage.groundPoint(x, y);
      select(p ? cellAt(p.x, p.z, spec?.cells.length ?? 16) : null);
    },
  });
  addEventListener("resize", () => {
    if (!rig.userZoomed) rig.distance = fit();
  });
  client.onFrame((frame) => {
    if (frame.view !== "ring") return;
    spec = sandboxSpec(frame, tier.crowdCap);
    scene.apply(spec);
  });
}

type Village = { ref: string; name: string; tile: number; population: number; founded: number };

async function runPlanetPage(): Promise<void> {
  const { canvas, hud } = page(),
    tier = deviceTier(),
    stage = new Stage(canvas, tier, SPACE),
    globe = new GlobeScene(stage),
    region = new RegionScene(stage),
    village = new VillageScene(stage),
    skyScene = new SystemScene(stage),
    starScene = new ClusterScene(stage),
    // Another world of the system, seen whole (M81); the whole galaxy (M80).
    worldScene = new GlobeScene(stage),
    galaxyScene = new GalaxyScene(stage),
    // The weather over the ground the eye is near (Phase 30 M162), and the god's acts on it (M163).
    weather = new WeatherLayer(stage, stage.root),
    handNear = new ActsNearLayer(stage, stage.root);
  stage.backdrop("space");
  // While the world is made, the shaders of the scales below are readied, so the first
  // "Look closer" draws at once.
  // (With the sun casting shadows: a village drawn at High casts them from its first frame.)
  stage.warm(
    [
      ...regionMaterials(stage),
      ...skyMaterials(stage),
      ...weather.materials(),
      ...handNear.materials(),
      ...colonyMaterials(stage),
      ...fleetMaterials(stage),
      { material: galaxyMaterial() },
    ],
    true,
  );
  const { client, mode } = await connect();
  let painted = 0,
    scale:
      | "globe"
      | "region"
      | "camp"
      | "battle"
      | "village"
      | "system"
      | "cluster"
      | "world"
      | "galaxy" = "globe",
    clusterPlan: ClusterPlan | null = null,
    systemPlan: SystemPlan | null = null,
    // The system the sky shows (the home star's, or another's, M95), which the sky's scene
    // holds built, and the star it is of when another's.
    skyPlan: SystemPlan | null = null,
    skyBuilt = "",
    skyStar: StarPage | null = null;
  Object.assign(exposed, { client, mode, seed, universe, drawn: () => painted, stage });
  const { ruleset } = await client.start(universe, seed);
  // ?load=name takes up a save; ?year=N starts the world N years on (it runs there
  // first, behind a screen that says how far it has come; history is the same).
  const loaded = loadName ? await client.load(loadName) : null;
  if (!loaded && startYear > 0)
    exposed.jumpedFrom = await jumpToYear(client, startYear, hud, { universe, seed, ruleset });
  client.setInterest({ view: "globe", focus: null });
  // One clock for every scale, its speeds the scale's own (asked for 2026-10-24): the date
  // drawn each frame, as the scales draw the world.
  const time = new TimeBar(client, "globe", true);
  // ?hold: the world stands where it was begun until told to go on (the gates: the same moment on
  // every machine, however long its first picture takes to draw).
  if (params.has("hold")) client.setSpeed(0);
  // The world waits for its first picture: else it runs on unseen at the globe's pace for as long
  // as that takes to draw (seconds on a phone, minutes on a machine drawing without a graphics
  // card), and the moment first seen is the machine's, not the world's. Held until its ground is
  // painted and drawn whole, two frames on; a speed chosen meanwhile lets it go at once.
  time.hold("first picture");
  let pictured: () => void = () => {};
  const firstPicture = new Promise<void>((done) => (pictured = done));
  {
    let frames = 0;
    const off = stage.onUpdate(() => {
      if (painted > 0) frames++;
      if (frames < 2) return;
      off();
      time.release("first picture");
      pictured();
    });
  }
  // (While a battle is watched, Space and the numbers work its own clock: Phase 37 M186; while a
  // war is watched unfolding, its own: Phase 38 M193.)
  let battleKeys: TimeKeys | null = null,
    warKeys: TimeKeys | null = null;
  installTimeKeys({
    toggle: () =>
      scale === "battle" && battleKeys
        ? battleKeys.toggle()
        : warKeys
          ? warKeys.toggle()
          : time.toggle(),
    pick: (i) =>
      scale === "battle" && battleKeys
        ? battleKeys.pick(i)
        : warKeys
          ? warKeys.pick(i)
          : time.pick(i),
  });
  let lens: Lens = "terrain",
    regionLens: RegionLens = "land",
    density = new Map<number, number>(),
    foodPrices = new Map<number, number>(),
    trade = new Map<number, number>(),
    // The deeper lenses' readings, land by land (Phase 12 M108); the way the ways lens shows, and
    // the colours of what each land has seen of the god (Phase 14).
    deepValues = new Map<Lens, Map<number, number>>(),
    waysTrait = "valour",
    goodShown = "grain",
    // (The law the laws lens shows: Phase 19 M139.)
    lawShown = "land",
    // (What the wealth lens weighs, and every realm's wealth last read: Lives L2.)
    wealthShown: WealthMeasure = "head",
    wealthBook: WealthBook | null = null,
    beliefColors = new Map<number, readonly [number, number, number]>(),
    // Every land's chief rock (Phase 15 M124), asked once: the ground does not change.
    groundPaint = new Map<number, readonly [number, number, number]>(),
    lastEntries: PeopleEntry[] = [],
    tongues = new Map<number, readonly [number, number, number]>(),
    realms = new Map<number, readonly [number, number, number]>(),
    faiths = new Map<number, readonly [number, number, number]>(),
    villages: Village[] = [],
    // The land's towns as drawn from their fabric, and its roads (Phase 25 M150); what each did
    // lately, on its label a while (Phase 26 M154).
    landPlan: LandPlan | null = null,
    townNews = new Map<string, { text: string; until: number }>(),
    // (Whether camps were labelled last frame: their labels let go when the last camp goes.)
    campsLabelled = false,
    regionCell = -1,
    stopVillages: (() => void) | null = null,
    // The lands the god's palette lights (its reach, its choices: Phase 12 M106).
    litLands: ReadonlyMap<number, Lit> = new Map();
  const planetPanel = new PlanetPanel(hud, client),
    regionPanel = new RegionPanel(hud, client),
    villagePanel = new VillagePanel(hud, client),
    labels = new LabelLayer(hud),
    // What the people in view are saying, in signs over their heads (M86).
    bubbles = new LabelLayer(hud, "bubble"),
    tidings = new Tidings(hud, client),
    // Every thing's page, in one window (Phase 10 M92).
    pageWindow = new PageWindow(hud, client);
  // (Set once the scales are made: what a page is of, lit in the scene.)
  let pointAt: (page: PageModel) => void = () => {};
  time.at("globe", planetPanel.timeSlot);
  planetPanel.tidings = regionPanel.tidings = villagePanel.tidings = tidings;
  pageWindow.tidings = tidings;
  // The tooltips that tell of a name or break a number down, on a desk (Phase 10 M97): a name
  // in one tells of its thing in turn, and a click on it opens its page.
  const hoverTips = new HoverTips(hud, client);
  hoverTips.onOpen = (ref) => void pageWindow.open(ref);
  pageWindow.hoverTips = planetPanel.hoverTips = hoverTips;
  // Their own names (Phase 58): the pages tell things as the people where the eye stands call them,
  // or as they are, as the viewer last chose on such a world (Earth's open as they are).
  const names = new NamesSwitch(
    universe,
    location.search,
    !!(navigator as { webdriver?: boolean }).webdriver,
  );
  pageWindow.names = hoverTips.names = names;
  // Realms' arms (Phase 11 M102): asked once each, borne beside their names everywhere.
  const armsBook = new ArmsBook(client);
  pageWindow.arms = hoverTips.arms = labels.arms = armsBook;
  // What is followed (its counters are "ours", and those that fight it its foes', M101).
  let followedRefs = new Set<string>();
  // The corner's tools under the bar (Phase 10 M96): the alerts, search for anything by name,
  // the outliner of what is followed and the message log; free roam's controls join them.
  const corner = document.createElement("div");
  corner.className = "corner-tools";
  hud.append(corner);
  const alerts = new Alerts(corner, client, hoverTips),
    searchBox = new SearchBox(corner, client),
    outliner = new Outliner(corner),
    logButton = new LogButton(corner);
  // 🔊 among them (Sound, first slice); nothing plays until a touch, and then only if it is on.
  sound.tell(airOf("globe"));
  sound.mount(corner);
  exposed.sound = sound;
  outliner.arms = searchBox.arms = armsBook;
  alerts.onOpen = (ref) => void pageWindow.open(ref);
  searchBox.onOpen = (ref) => void pageWindow.open(ref);
  outliner.onOpen = (ref) => void pageWindow.open(ref);
  outliner.onLetGo = (ref) => void tidings.unfollow(ref);
  tidings.onFollowed = (followed) => {
    outliner.set(followed);
    followedRefs = new Set(followed.map((f) => f.ref));
  };
  logButton.onOpen = () => void pageWindow.open("world:log");
  tidings.onTold = (n) => logButton.told(n);
  // Great happenings told in windows (Phase 11 M100), answered by the god's hand where it can:
  // or as cards, or not at all, as the viewer chooses.
  const events = new EventWindows(
    hud,
    client,
    // (Not in the way of a machine driving the page, unless it asks: ?events.)
    !!(navigator as { webdriver?: boolean }).webdriver && !params.has("events"),
  );
  events.clock = time;
  events.onShow = () => sound.cue("event");
  events.onOpen = (ref) => void pageWindow.open(ref);
  events.onGoTo = async (ref) => {
    const place = await client.query<Place | null>({ type: "place", args: { ref } });
    if (place) await goTo(place);
  };
  tidings.onGreat = (t) => {
    // (While the Director films, the world's own news comes as a card, not a window over the film.)
    if (!isGreat(t) || events.mode === "card" || (t.world && directorControls.watching))
      return false;
    if (events.mode === "window") events.tell(t);
    return true;
  };
  exposed.eventOpen = () => events.open;
  // (The world's own pages — its chronicle, saves, settings — open in its panel instead.)
  planetPanel.onWorldPage = () => pageWindow.close();
  // The world's chronicle and its ledger (Phase 10 M96b): pages of the window like any other.
  planetPanel.onChronicle = () => void pageWindow.open("world:chronicle");
  planetPanel.onLedger = () => void pageWindow.open("world:ledger");
  planetPanel.onConcepts = () => void pageWindow.open("concept:index");
  planetPanel.onNumbers = () => void pageWindow.open("world:stats");
  planetPanel.onMatter = () => void pageWindow.open("world:matter");
  planetPanel.onTree = () => void pageWindow.open("world:tree");
  planetPanel.onChip = (what) => {
    if (what === "hungry") {
      // (The hungry are shown on the map: the food lens.)
      planetPanel.onLens("food");
      return;
    }
    const at: Record<string, string> = {
      stage: "world:means",
      people: "world:chronicle#story",
      towns: "world:ledger#towns",
      realms: "world:ledger#realms",
      wars: "world:ledger#wars",
      shadow: "prin:greatest-fire",
      faiths: "world:ledger#faiths",
      tongues: "world:ledger#tongues",
      colonies: "world:ledger#sky",
    };
    void pageWindow.open(at[what] ?? "world:ledger");
  };
  // While a page is open the scales' own windows stand aside (their sheets would cover it).
  pageWindow.onOpen = (page) => {
    sound.cue("page");
    if (page.kind === "log") logButton.read();
    document.body.classList.add("paging");
    markBarBottom();
    pointAt(page);
  };
  // The page window stands below whichever scale's bar shows (its lines wrap as it narrows):
  // read as a page opens, as the date widens, and twice a second (a resize observer on the bars
  // trips WebKit's loop check as the scales' panels come and go).
  const markBarBottom = () => {
    const bar = [...document.querySelectorAll<HTMLElement>(".panel > header.bar")].find(
        (b) => b.offsetParent !== null,
      ),
      y = `${bar ? Math.round(bar.getBoundingClientRect().bottom) : 64}px`;
    if (document.documentElement.style.getPropertyValue("--bar-bottom") !== y)
      document.documentElement.style.setProperty("--bar-bottom", y);
  };
  setInterval(markBarBottom, 500);
  // (The corner's tools under the bar go down with it in the frame it takes another line, never
  // left under it for a moment where a tap on them would land on the bar.)
  time.onWiden = markBarBottom;
  pageWindow.onClose = () => document.body.classList.remove("paging");
  exposed.open = (ref: string) => pageWindow.open(ref);
  exposed.pageOpen = () => pageWindow.current;
  // The guided walk: on a first visit (not for a machine driving the page, unless asked
  // with ?walk), and again from Help.
  const walk = new GuidedWalk(planetPanel.bar);
  if (
    !GuidedWalk.walked() &&
    (!(navigator as { webdriver?: boolean }).webdriver || params.has("walk"))
  )
    walk.start();
  planetPanel.onHelp = () => walk.start();
  // A world no people rose on (a world never seen, its seed taken as it fell: one in ten): told
  // so in the bar, and on a world never seen, the way on to the nearest one life arises on.
  /** What is heard of this world: whether anything lives on it, and its air (Sound, first slice). */
  let worldAlive = true;
  const worldAir = { thin: 0, wind: 0 };
  const lifeless = el("div", "walk lifeless");
  lifeless.hidden = true;
  planetPanel.bar.append(lifeless);
  exposed.lifeless = () => (lifeless.hidden ? null : (lifeless.textContent ?? ""));
  void client
    .lifeOf(universe, seed)
    .then((life) => {
      worldAlive = life.living;
      if (life.peopled) return;
      const keep = el("button", "link", "Watch it as it is"),
        on = el("button", "walk-next", "🌱 To a world where life arises"),
        row = el("div", "walk-row");
      keep.onclick = () => (lifeless.hidden = true);
      on.onclick = async () => {
        on.disabled = true;
        on.textContent = "Finding one…";
        const { livingSeed, unmadeSeed } = await import("./title.ts");
        // (The nearest so made; where none near it knows life, the nearest with its making lifted.)
        let found = await livingSeed(client, universe, seed);
        if (!found.found && unmadeSeed(seed) !== seed)
          found = await livingSeed(client, universe, unmadeSeed(seed));
        if (!found.found) {
          on.textContent = "None found near it";
          return;
        }
        location.search = `?universe=${encodeURIComponent(universe)}&seed=${encodeURIComponent(found.seed)}`;
      };
      row.append(keep, ...(universe === "alien" ? [on] : []));
      lifeless.replaceChildren(
        el(
          "p",
          undefined,
          life.living
            ? "Life arose on this world, but no people rose from it: its beasts are all it will know."
            : `No life arose on this world: ${life.words}. No people will ever rise on it.`,
        ),
        row,
      );
      lifeless.hidden = false;
    })
    .catch(() => {});
  planetPanel.onAsked = () => walk.saw("why");
  pageWindow.onAsked = () => walk.saw("why");
  exposed.walk = () => walk.current;
  // Quality (M76): the viewer's choice, kept in this browser, or Auto — from the device's
  // kind, stepping down while frames drag (and up where a display runs faster than 60).
  const QUALITY_KEY = "causalis.quality",
    readChoice = (): QualityName | "auto" => {
      try {
        const v = localStorage.getItem(QUALITY_KEY);
        // (A machine driving the page — tests, tools — draws at High, fixed, so what it
        // measures does not move under it.)
        const fallback = (navigator as { webdriver?: boolean }).webdriver ? "high" : "auto";
        return v && (v === "auto" || (QUALITY_NAMES as readonly string[]).includes(v))
          ? (v as QualityName | "auto")
          : fallback;
      } catch {
        return "auto";
      }
    };
  /**
   * How finely the fields' bodies are built (a band's camp, a battle): the finer unless the
   * quality has stepped down past High (M197: a phone of today builds them as a desktop does).
   */
  const fieldDetail = (): 1 | 2 => (stage.quality.detail >= 2 ? 2 : 1);
  const autoCeiling: QualityName = tier.name === "phone" ? "balanced" : "ultra";
  let choice = readChoice(),
    auto: AutoQuality | null = null,
    fps = 0,
    frames: number[] = [];
  const setChoice = (c: QualityName | "auto") => {
    choice = c;
    try {
      localStorage.setItem(QUALITY_KEY, c);
    } catch {
      // Nothing to keep it in: it holds for this visit.
    }
    // A phone's automatic budget stays at Balanced or below. Frame rate alone cannot tell
    // whether a finer setting is about to exhaust Safari's graphics memory.
    const start: QualityName = c === "auto" ? (tier.name === "phone" ? "balanced" : "ultra") : c;
    auto = c === "auto" ? new AutoQuality(start, autoCeiling) : null;
    stage.setQuality(QUALITIES[start]);
  };
  setChoice(choice);
  stage.onUpdate((dt) => {
    // (A hitch — a tab come back, a world being made — is not the device's pace.)
    if (dt <= 0 || dt > 0.25 || !painted) return;
    frames.push(dt);
    if (frames.length >= 60) {
      fps = Math.round(frames.length / frames.reduce((a, b) => a + b, 0));
      frames = [];
    }
    const next = auto?.frame(dt * 1000);
    if (next) stage.setQuality(QUALITIES[next]);
  });
  stage.onQuality((q) => {
    if (scale === "globe") paintGlobe();
    const frame = client.latestFrame("region");
    if (scale === "region" && frame) region.plantTrees(regionTrees(frame, q.regionTrees));
    if (scale === "village" && plan) village.build(plan);
  });
  planetPanel.onQualityChoice = (c) => setChoice(c);
  planetPanel.qualityNow = () => ({ choice, name: stage.quality.name, fps });
  // The view turning when left alone: off unless chosen (asked for 2026-09-28).
  planetPanel.driftNow = () => drifting;
  planetPanel.onDrift = (on) => {
    drifting = on;
    try {
      localStorage.setItem(DRIFT_KEY, on ? "1" : "0");
    } catch {
      // Nowhere to remember it: for this visit only.
    }
    rig.configure({ drift: on ? driftRate : 0 });
  };
  exposed.quality = () => stage.quality.name;
  exposed.setQuality = (c: string) => setChoice(c as QualityName | "auto");
  labels.blockers = [regionPanel.inspector, villagePanel.inspector, pageWindow.inspector];
  bubbles.blockers = labels.blockers;
  // (Names and words kept below the scale's bar: a camp's name came under it, on CI's screen.)
  // (Read as the names are placed: the scales' panels come one by one, some later on.)
  labels.ceilings = () => document.querySelectorAll<HTMLElement>(".panel > header.bar");
  bubbles.ceilings = labels.ceilings;
  // The signs' font, readied before any village is entered: its first drawing is slow (a
  // colour font loaded and its glyphs drawn), and would otherwise stall a frame there.
  {
    const warm = document.createElement("span");
    warm.className = "bubble";
    warm.textContent = Object.values(SIGNS).join("");
    warm.style.opacity = "0.01";
    warm.style.pointerEvents = "none";
    hud.append(warm);
    setTimeout(() => warm.remove(), 4000);
  }

  /** The lands of the world built over from edge to edge (Phase 66), as last asked. */
  let builtLands: ReadonlySet<number> = new Set<number>(),
    builtAsked = -1;
  const askBuilt = async () => {
    const year = Math.floor(now() / YEAR);
    if (Math.abs(year - builtAsked) < 5) return;
    builtAsked = year;
    const cells = await client.query<number[]>({ type: "past.lands" }).catch(() => [] as number[]);
    if (cells.length === builtLands.size && cells.every((c) => builtLands.has(c))) return;
    builtLands = new Set(cells);
    mapModes.builtOver = cells.length > 0;
    paintGlobe();
  };
  stage.onUpdate(() => {
    if (scale === "globe") void askBuilt();
  });
  /** The globe's colours as its lens paints them (the land's "as the map" shows them, M95). */
  let globeLensColors: Uint8Array | null = null;
  let globeSurfaceKey = "";
  const paintGlobe = () => {
    const frame = client.latestFrame("globe");
    if (!frame) return;
    const surfaceKey = (frame.meta as { surfaceKey?: string }).surfaceKey ?? "";
    if (!globe.built || globeSurfaceKey !== surfaceKey) {
      globe.build(
        (frame.meta as { frequency: number }).frequency,
        frame.arrays.elevation as Float32Array,
      );
      globeSurfaceKey = surfaceKey;
      globe.visible = scale === "globe";
    }
    const colors = globeColors(
      frame,
      lens,
      lens === "food" ? foodPrices : lens === "trade" ? trade : (deepValues.get(lens) ?? density),
      lens === "realms" || lens === "wealth"
        ? realms
        : lens === "belief"
          ? beliefColors
          : lens === "ground"
            ? groundPaint
            : lens === "faiths"
              ? faiths
              : lens === "diplomacy"
                ? standings
                : lens === "war"
                  ? fronts
                  : tongues,
      // (Borders between realms, faiths, tongues: a grand strategy map's.)
      sphereGrid((frame.meta as { frequency: number }).frequency),
      // (Lands taken by force, still resenting it, in shadow: M104.)
      lens === "realms" || lens === "war" ? takenLands : undefined,
    );
    // (Lands built over, grey and lit from edge to edge, as the land's own colours: Phase 66.)
    if (lens === "terrain" && builtLands.size) builtOverCells(colors, frame, builtLands);
    globe.paint(litLands.size ? litColors(colors, frame, litLands) : colors);
    globe.clearSea(frameUndersea(frame) && lens !== "terrain");
    globeLensColors = colors;
    // Clouds over the land as it is; none over what a lens paints.
    globe.weather = lens === "terrain" && stage.quality.clouds;
    painted = colors.length / 4;
  };
  // The land's sky as last read, and the moment its season was last laid on its map (Phase 30:
  // the weather below keeps them).
  let landSky: LandSky | null = null,
    seasonT = 0,
    regionSurfaceKey = "";
  const paintRegion = () => {
    const frame = client.latestFrame("region");
    if (!frame || scale !== "region") return;
    const meta = frame.meta as {
      ref: string;
      surfaceKey?: string;
      center: number;
      size: number;
      tileKm: number;
      lat: number;
      lon: number;
    };
    if (region.key !== meta.ref || regionSurfaceKey !== (meta.surfaceKey ?? meta.ref)) {
      const t0 = performance.now();
      region.build(
        meta.ref,
        meta.size,
        meta.tileKm,
        regionHeights(frame),
        frame.arrays.water as Uint8Array | undefined,
        frame.arrays.fertility as Uint8Array | undefined,
      );
      regionSurfaceKey = meta.surfaceKey ?? meta.ref;
      // The phone's budgets are measured by these (npm run gate:7).
      performance.measure("region.build", { start: t0 });
      regionPanel.show(meta.center, meta.lat, meta.lon, meta.size * meta.tileKm);
      region.setVillages(villages);
      region.plantTrees(regionTrees(frame, stage.quality.regionTrees));
      if (landPlan) region.setTowns(landPlan, landPlan.t);
      showLandWars();
      // Come down from the globe onto a spot of it: that spot in the middle (M95).
      const parent = frame.arrays.parent as Int32Array | undefined;
      if (arriveAt !== null && parent) {
        let x = 0,
          z = 0,
          n = 0;
        const half = ((meta.size - 1) * meta.tileKm) / 2;
        for (let t = 0; t < parent.length; t++)
          if (parent[t] === arriveAt) {
            x += (t % meta.size) * meta.tileKm - half;
            z += Math.floor(t / meta.size) * meta.tileKm - half;
            n++;
          }
        if (n) rig.target.set(x / n, region.heightAt(x / n, z / n), z / n);
        // (Where a battle of it is drawn here, its field, once the land's towns are known: M203.)
        arriveField = { spot: arriveAt, cell: meta.center, until: performance.now() + 10_000 };
      }
      arriveAt = null;
    }
    // (The globe's lens seen in the land: each tile its spot's colour on the map, M95.)
    const parent = frame.arrays.parent as Int32Array | undefined,
      colors =
        regionLens === "world" && parent && globeLensColors
          ? regionFromGlobe(frame, parent, globeLensColors)
          : regionColors(frame, regionLens);
    // (The land as the season leaves it: snow on its hills, ice on its lakes; M164.)
    const seasoned =
      regionLens === "land" && landSky?.cell === regionCell
        ? seasonTiles(colors, frame, landSky, seasonT)
        : colors;
    // (A land built over: streets and roofs from shore to shore. Phase 66.)
    region.paint(
      regionLens === "land" && landPlan?.covered
        ? builtOverTiles(seasoned, frame, !!landPlan.undersea)
        : seasoned,
    );
    painted = colors.length / 4;
  };
  /** The spot of the globe a zoom went down into, to stand in the middle of its land's map. */
  let arriveAt: number | null = null;
  /** A spot come down onto, or a battle come back from (M203): its field faced once its land's
   *  towns are known. */
  let arriveField: { spot?: number; event?: string; cell: number; until: number } | null = null;
  let landBattleFocus: { event: string; cell: number } | null = null;
  /** Turn to the most peopled province; closer, for the lenses that show the people. */
  async function faceThePeople(closer: boolean): Promise<void> {
    const map = await client.query<PeopleEntry[]>({ type: "people.map" });
    const most = [...map].sort((a, b) => b.people - a.people || a.cell - b.cell)[0];
    if (!most || scale !== "globe") return;
    const place = await client.query<{ lat: number; lon: number }>({
      type: "cell",
      args: { cell: most.centre },
    });
    rig.face(place.lat, place.lon);
    if (closer && !rig.userZoomed) rig.distance = Math.min(rig.distance, 2);
  }
  planetPanel.onLens = (l) => {
    walk.saw("lens");
    lens = l;
    mapModes.lens = l;
    mapModes.say(null);
    if (l === "diplomacy") void readStandings();
    if (l === "ground" && !groundPaint.size)
      void client.query<{ cell: number; rock: string }[]>({ type: "ground.map" }).then((map) => {
        groundPaint = groundColors(map);
        paintGlobe();
      });
    if (l === "war") void readFronts();
    // (The wealth lens: a realm's, by a measure chosen under its legend; its ranking a press away.)
    mapModes.action(l === "wealth" ? "📊 The ranking" : null, () => {
      void pageWindow.open("world:ledger#wealth");
    });
    if (l === "wealth") {
      if (!deepValues.has("wealth")) deepValues.set("wealth", new Map());
      readWealth();
    }
    paintGlobe();
    if (PEOPLE_LENSES.includes(l)) void faceThePeople(true);
    // (The ways lens shows one way at a time, chosen under its legend: Phase 14 M119; the
    // goods lens one good: Phase 15 M123.)
    if (l === "goods")
      mapModes.choose(GOOD_CHOICES, goodShown, (id) => {
        goodShown = id;
        readGoods();
        tooltip.lens = `goods:${id}`;
        paintGlobe();
      });
    // (The laws lens one law at a time: Phase 19 M139.)
    else if (l === "wealth")
      mapModes.choose(WEALTH_CHOICES, wealthShown, (id) => {
        wealthShown = id as WealthMeasure;
        tooltip.lens = `wealth:${id}`;
        readWealth();
      });
    else if (l === "laws")
      mapModes.choose(LAW_CHOICES, lawShown, (id) => {
        lawShown = id;
        readLaws();
        tooltip.lens = `laws:${id}`;
        paintGlobe();
      });
    else
      mapModes.choose(l === "ways" ? WAY_CHOICES : null, waysTrait, (id) => {
        waysTrait = id;
        readWays();
        tooltip.lens = `ways:${id}`;
        paintGlobe();
      });
    tooltip.lens =
      l === "wealth"
        ? `wealth:${wealthShown}`
        : l === "ways"
          ? `ways:${waysTrait}`
          : l === "goods"
            ? `goods:${goodShown}`
            : l === "laws"
              ? `laws:${lawShown}`
              : l;
  };
  /** Every realm's wealth read, and the lens's colours of it (Lives L2). */
  function readWealth(): void {
    void client.query<WealthBook>({ type: "wealth.book" }).then((book) => {
      wealthBook = book;
      deepValues.set("wealth", wealthShades(book, wealthShown));
      if (lens !== "wealth") return;
      mapModes.say(wealthNote(book, wealthShown));
      paintGlobe();
    });
  }
  // (`Exposed` is a closed type: these two are for gate 68 alone.)
  Object.assign(exposed, {
    wealthNow: () => ({
      measure: wealthShown,
      book: wealthBook,
      shades: deepValues.get("wealth")?.size ?? 0,
    }),
    lensColorAt: (spot: number) =>
      globeLensColors ? [...globeLensColors.slice(spot * 4, spot * 4 + 3)] : null,
  });
  /** The chosen good in store a head, land by land. */
  function readGoods(): void {
    const i = Math.max(
      0,
      GOOD_CHOICES.findIndex(([id]) => id === goodShown),
    );
    // (Each good on its own scale: the world's spread of it.)
    deepValues.set(
      "goods",
      goodsSpread(
        new Map(
          lastEntries.flatMap((e) => (e.goods.length ? [[e.cell, e.goods[i]!] as const] : [])),
        ),
      ),
    );
  }
  /** The chosen law's position, land by land, laid from the old order (0) to the new (1). */
  function readLaws(): void {
    const i = Math.max(
      0,
      LAW_CHOICES.findIndex(([id]) => id === lawShown),
    );
    deepValues.set(
      "laws",
      new Map(
        lastEntries.flatMap((e) => (e.laws.length ? [[e.cell, e.laws[i]! / 2] as const] : [])),
      ),
    );
  }
  /** The chosen way's reading, land by land. */
  function readWays(): void {
    const i = Math.max(
      0,
      WAY_CHOICES.findIndex(([id]) => id === waysTrait),
    );
    deepValues.set(
      "ways",
      new Map(lastEntries.flatMap((e) => (e.ways.length ? [[e.cell, e.ways[i]!] as const] : []))),
    );
  }
  // The map modes' bar (Phase 10 M96), in the world's top bar (floating on a desk).
  const mapModes = new MapModes(lens);
  planetPanel.bar.append(mapModes.element);
  mapModes.onLens = (l) => planetPanel.onLens(l);
  // The diplomacy lens is of a realm: the one a page open is of (or its land's), else the
  // most peopled; the war lens shows the wars' sides, what they fight for, what was taken.
  let standings = new Map<number, readonly [number, number, number]>(),
    fronts = new Map<number, readonly [number, number, number]>(),
    takenLands = new Map<number, readonly [number, number, number]>(),
    focusRealm: string | null = null;
  const readStandings = async () => {
    const open = pageWindow.current,
      focus = open?.startsWith("pol:")
        ? open
        : open?.startsWith("cell:")
          ? (
              (
                await client.query<{
                  stats: { label: string; value: (string | { ref: string })[] }[];
                }>({
                  type: "page",
                  args: { ref: open },
                })
              ).stats
                .find((x) => x.label === "Realm")
                ?.value.find((v) => typeof v !== "string") as { ref: string } | undefined
            )?.ref
          : null;
    if (focus) focusRealm = focus;
    if (!focusRealm) {
      const rs = await client.query<{ ref: string; people: number }[]>({ type: "realms.map" });
      focusRealm = [...rs].sort((a, b) => b.people - a.people)[0]?.ref ?? null;
    }
    if (!focusRealm) return;
    const d = await client.query<{ name: string | null; lands: [number, string][] }>({
      type: "diplomacy.map",
      args: { realm: focusRealm },
    });
    standings = new Map(
      d.lands.map(([c, k]) => [c, STANDING_COLORS[k] ?? STANDING_COLORS.neutral!]),
    );
    mapModes.say(d.name ? `as ${d.name} sees them` : null);
    if (lens === "diplomacy") paintGlobe();
  };
  const readFronts = async () => {
    const w = await client.query<{
      lands: [number, string][];
      taken: [number, readonly [number, number, number]][];
    }>({ type: "war.lens" });
    fronts = new Map(w.lands.map(([c, k]) => [c, WAR_COLORS[k] ?? WAR_COLORS.attacker!]));
    takenLands = new Map(w.taken);
    if (lens === "war") mapModes.say(w.lands.length ? null : "no war is being fought");
    if (lens === "war" || lens === "realms") paintGlobe();
  };
  setInterval(() => {
    if (scale !== "globe") return;
    if (lens === "diplomacy") void readStandings();
    // (The realms' map too: the lands taken by force are in shadow on it.)
    if (lens === "war" || lens === "realms") void readFronts();
  }, 3000);
  // The top bar's numbers.
  client.subscribe<WorldStats>({ type: "world.stats" }, 2000, (st) => planetPanel.stats(st));
  // The world's stage (Phase 31 M167): what its peoples have come to, beside the date at every
  // scale.
  let stageNow: WorldStage | null = null;
  exposed.worldStage = () => stageNow;
  client.subscribe<WorldStage>({ type: "world.stage" }, 3000, (st) => {
    time.beside(planetPanel.stage(st));
    stageNow = st;
    // (Its star's mirrors in the sky over its ground: Phase 66.)
    if (st.mirrors) {
      document.body.dataset.mirrors = "1";
      document.body.style.setProperty("--mirrors", mirrorStrength(st.mirrors).toFixed(3));
    } else delete document.body.dataset.mirrors;
  });
  // Realms' names written across their lands on the political map, and a star at each seat.
  const mapNames = new MapLabels(hud);
  let realmNames: {
    ref: string;
    text: string;
    lands: number;
    shape: NameShape;
    seat: { x: number; y: number; z: number } | null;
  }[] = [];
  const readNames = async () => {
    const frame = client.latestFrame("globe");
    if (!frame) return;
    const grid = sphereGrid((frame.meta as { frequency: number }).frequency),
      rs = await client.query<{ ref: string; short: string; spots: number[]; seat: number }[]>({
        type: "realms.map",
      });
    realmNames = rs.flatMap((r) => {
      const shape = nameShape(r.spots, grid);
      if (!shape) return [];
      const p = grid.positions,
        seat =
          r.seat >= 0 && r.spots.length > 1
            ? { x: p[r.seat * 3]!, y: p[r.seat * 3 + 1]!, z: p[r.seat * 3 + 2]! }
            : null;
      return [{ ref: r.ref, text: r.short.toUpperCase(), lands: r.spots.length, shape, seat }];
    });
  };
  const NAMED: readonly Lens[] = ["realms", "diplomacy", "war"];
  setInterval(() => {
    if (scale === "globe" && NAMED.includes(lens)) void readNames();
  }, 5000);
  let namesAt = 0;
  stage.onUpdate(() => {
    if (scale !== "globe" || !NAMED.includes(lens)) {
      if (namesAt) {
        mapNames.clear();
        namesAt = 0;
      }
      return;
    }
    if (!realmNames.length) {
      if (!namesAt) void readNames();
      namesAt = 1;
      return;
    }
    // (Laid out a dozen times a second: they move with the globe, not with each frame.)
    const t = performance.now();
    if (t - namesAt < 80) return;
    namesAt = t;
    const points = realmNames.flatMap((r) => {
      const s = r.shape;
      return [
        { x: s.x, y: s.y, z: s.z },
        rim(s, s.half),
        rim(s, -s.half),
        ...(r.seat ? [r.seat] : [{ x: s.x, y: s.y, z: s.z }]),
      ];
    });
    const at = globe.screenOf(points),
      names: MapName[] = [],
      laid: { name: MapName; seat: MapName | null; lands: number }[] = [];
    realmNames.forEach((r, i) => {
      const c = at[i * 4]!,
        a = at[i * 4 + 1]!,
        b = at[i * 4 + 2]!,
        seat = at[i * 4 + 3]!;
      if (c.facing < 0.25) return;
      const len = Math.hypot(b.x - a.x, b.y - a.y),
        size = Math.min(44, len / (r.text.length * 0.95 + 1));
      let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      const alpha = Math.min(1, (c.facing - 0.25) / 0.3);
      if (size < 8) return;
      laid.push({
        lands: r.lands,
        name: { key: r.ref, text: r.text, x: c.x, y: c.y, angle, size, alpha },
        seat:
          r.seat && seat.facing > 0.25
            ? {
                key: `${r.ref} seat`,
                text: "★",
                x: seat.x,
                y: seat.y,
                angle: 0,
                size: Math.max(10, Math.min(18, size * 0.7)),
                alpha,
                seat: true,
              }
            : null,
      });
    });
    // (The largest first; one that would cross another is left out, as such maps do.)
    const fits = namesThatFit(
      laid.map((l) => ({ ...l.name, chars: l.name.text.length, rank: l.lands })),
    );
    laid.forEach((l, i) => {
      const k = fits[i]!;
      if (k) names.push({ ...l.name, size: l.name.size * k });
    });
    // A seat's star, where it does not sit on a name's letters.
    const written = names.map((n) => ({ ...n, chars: n.text.length }));
    laid.forEach((l, i) => {
      const s = l.seat;
      if (s && fits[i] && !written.some((n) => withinName(n, s.x, s.y))) names.push(s);
    });
    mapNames.update(names);
  });
  regionPanel.onLens = (l) => {
    regionLens = l;
    paintRegion();
  };
  client.subscribe<{ carbon: number; warming: number; warmer: string | null }>(
    { type: "planet.air" },
    5000,
    (air) => planetPanel.air(air),
  );
  // (Each land's middle spot on the globe, to turn to it: M88.)
  let centres = new Map<number, number>();
  client.subscribe<PeopleEntry[]>({ type: "people.map" }, 1000, (entries) => {
    planetPanel.people(entries);
    centres = new Map(entries.map((e) => [e.cell, e.centre]));
    density = new Map(entries.map((e) => [e.cell, e.density]));
    foodPrices = new Map(entries.map((e) => [e.cell, e.food]));
    trade = new Map(entries.map((e) => [e.cell, e.trade]));
    for (const k of [
      "unrest",
      "strength",
      "knowledge",
      "growth",
      "bondage",
      "standing",
      "sickness",
      "debt",
    ] as const)
      deepValues.set(k, new Map(entries.map((e) => [e.cell, e[k]])));
    lastEntries = entries;
    readWays();
    readGoods();
    readLaws();
    if (lens === "wealth") readWealth();
    beliefColors = new Map(
      entries.flatMap((e) => {
        const c = beliefColor(e.belief[0], e.belief[1], e.belief[2]);
        return c ? [[e.cell, c] as const] : [];
      }),
    );
    tongues = new Map(entries.flatMap((e) => (e.tongue ? [[e.cell, e.tongue] as const] : [])));
    realms = new Map(entries.flatMap((e) => (e.realm ? [[e.cell, e.realm] as const] : [])));
    faiths = new Map(entries.flatMap((e) => (e.faith ? [[e.cell, e.faith] as const] : [])));
    if (PEOPLE_LENSES.includes(lens) && scale === "globe") paintGlobe();
  });

  // The year's wars on the globe (M87): hosts marching toward what they want, ships where
  // their way crosses the sea, clashes where history fought.
  const globeWars = new GlobeWars(stage, stage.root);
  const globeArcs = new GlobeArcLayer(stage, globeWars.root);
  let warsKey = "",
    warsNow: WarsMap | null = null,
    /** The year's wars as last read (kept while a war watched unfolding is drawn instead). */
    warsLive: WarsMap | null = null,
    /** A war watched unfolding (Phase 38 M193: see watchWar), null: none. */
    campaign: {
      c: Campaign;
      /** When each of its battles is seen fought (years of the world's, fractional). */
      at: number[];
      /** Its moment (a year, fractional), its speed (of WAR_SPEEDS), the speed it was at before held. */
      year: number;
      speed: number;
      was: number;
      now: CampaignNow;
      /** What the globe was last given of it (its key), and how far its host is along its way. */
      drawn: string;
      marching: Map<string, number>;
      /**
       * Whether the eye goes with its host (let go when the globe is turned by hand, taken up
       * again as each battle is fought), and how many had been fought when it last looked.
       */
      follow: boolean;
      seen: number;
      /** Whether the eye has been brought nearer or farther by hand (else it keeps its host's way in view). */
      zoomed: boolean;
      /** Whether each battle, as it is fought, is gone down to and watched on its field (M196). */
      fields: boolean;
    } | null = null,
    /** The wars of an age watched unfolding together (M194: see watchWarAge), null: none. */
    warAge: {
      a: WarAge;
      /** When each of its wars' battles is seen fought. */
      at: number[][];
      year: number;
      speed: number;
      was: number;
      now: WarAgeNow;
      drawn: string;
      /** Whether the eye goes to each battle as it is fought; the battles fought when it last looked. */
      follow: boolean;
      seen: number;
      zoomed: boolean;
    } | null = null;
  /** Wars drawn on the globe and in a land: the year's, or a war's watched unfolding. */
  const showWars = (map: WarsMap) => {
    const frame = client.latestFrame("globe");
    if (!frame) return;
    warsNow = map;
    // (Their soldiers' heads in their people's own hide, where they have a look of their own.)
    const paint = figurePaint(map.body ?? null, "metal", 0);
    globeWars.skin(paint.folk ? paint.tones[0] : null);
    regionWars.skin(paint.folk ? paint.tones[0] : null);
    showLandWars();
    // (The world's own wars are drawn in place on the globe, as their year goes: M203.)
    if (map === warsLive && !campaign && !warAge) {
      liveLegs = "";
      return;
    }
    globeWars.set(
      warPaths(
        map,
        sphereGrid((frame.meta as { frequency: number }).frequency),
        frame.arrays.elevation as Float32Array,
      ),
    );
  };
  /**
   * The moment the year's wars are drawn at (in years): the world's, but for a year turned before its
   * wars are come — history fights its battles at the turn, and until the page has them it keeps
   * the wars as they were the moment before (Phase 55 M227: the hosts drawn up through the night,
   * the slowing for the battle the morning after kept, not let go for a frame or two as at peace).
   */
  const warsAt = (y: number) =>
    warsLive && Math.floor(y) > warsLive.year ? warsLive.year + 1 - 1e-9 : y;
  const takeWars = (map: WarsMap) => {
    const frame = client.latestFrame("globe"),
      key = JSON.stringify(map);
    if (!frame || key === warsKey) return;
    warsKey = key;
    warsLive = map;
    // (While a war, or an age's, is watched unfolding, it is drawn instead.)
    if (!campaign && !warAge) showWars(map);
  };
  client.subscribe<WarsMap>({ type: "wars.map" }, 2000, takeWars);
  /**
   * The world's own wars in place on the globe (Phase 40 M203): each host as far along its way as
   * its year has gone, on the world's clock. Their ways as last drawn (by their ends), and how far.
   */
  let liveLegs = "",
    liveMarching: Map<string, number> | undefined,
    /** When the wars were last asked for at a year's turn (ms). */
    warsAsked = 0,
    /** The battle the land's clock is slowed for now (M203), and every battle slowed for once. */
    slowFor: string | null = null,
    /** How the slowing is told. */
    slowWords = "",
    /** The speed the clock was last held to for it (0: not yet). */
    slowCap = 0,
    /** When the last frame was drawn (ms), and how long frames take (s: the longest lately, let go slowly). */
    frameAt = 0,
    frameSlow = 1 / 60,
    /** The war about the town watched, as its year has it now (Phase 40 M204). */
    townWar: TownWar | null = null,
    /** A war made up by the look tools, held about the town (W1; null: its year's). */
    heldTownWar: TownWar | null = null,
    preferredTownBattle: { event: string; town: string } | null = null;
  const slowedOnce = new Set<string>();
  stage.onUpdate(() => {
    globeWars.root.enabled = scale === "globe";
    // (The eye leaning over a war watched: its figures drawn as seen from the side.)
    globeWars.lean = Math.min(1, rig.lean / 45);
    const y = now() / YEAR,
      yw = warsAt(y);
    // (A year turned: its battles asked for at once, not at the next telling.)
    if (
      (scale === "globe" || scale === "region" || scale === "village") &&
      warsLive &&
      Math.floor(y) > warsLive.year &&
      performance.now() - warsAsked > 600
    ) {
      warsAsked = performance.now();
      void client.query<WarsMap>({ type: "wars.map" }).then(takeWars);
    }
    if (scale === "globe") {
      const frame = client.latestFrame("globe");
      if (!campaign && !warAge && warsLive && frame) {
        const placed = globeInPlace(warsLive, yw),
          legs = placed.map.wars
            .map((w) => `${w.ref}:${w.from}:${w.to}:${w.ended}:${w.siege}`)
            .join("|");
        if (legs !== liveLegs) {
          liveLegs = legs;
          globeWars.set(
            warPaths(
              placed.map,
              sphereGrid((frame.meta as { frequency: number }).frequency),
              frame.arrays.elevation as Float32Array,
            ),
          );
        }
        liveMarching = placed.marching;
      } else liveMarching = undefined;
      globeWars.update(
        performance.now() / 1000,
        rig.distance,
        campaign?.marching ?? warAge?.now.marching ?? liveMarching,
      );
      // (Rockets' ways from where they left to where they fell: W3.)
      if (frame)
        globeArcs.update(
          globeArcsNow(
            warsLive,
            yw,
            sphereGrid((frame.meta as { frequency: number }).frequency).positions,
          ),
          rig.distance,
        );
    }
    regionWars.visible = scale === "region";
    if (scale === "region") regionWars.update(performance.now() / 1000, yw);
    // Come down onto a battle's spot: the eye over its field, where it is drawn.
    if (arriveField) {
      const at =
        scale === "region" && regionCell === arriveField.cell && landPlan && regionWars.now
          ? arriveField.event !== undefined
            ? regionWars.now.fields.get(arriveField.event)
            : regionWars.now.lands.get(arriveField.spot ?? -1)
          : undefined;
      if (at) {
        rig.flyTo({ target: { x: at.x, y: region.heightAt(at.x, at.z), z: at.z } }, 0.8);
        arriveField = null;
      } else if (performance.now() > arriveField.until || scale !== "region") arriveField = null;
    }
    // The battle at the turn drawn near (Phase 55 M227, D4; M203 before): the clock slowed once for
    // each of its stages where the viewer watches at a month a second or less — toward it, through
    // the night before it, while it is fought (in its town at its own pace, a minute a second; on its
    // land ten), after it, and in its town as its fallen are borne in — let go at a speed the viewer
    // sets meanwhile, or once what it was for is over. (And brought down to each as it nears it, so
    // as to come to its beginning at its own speed: where frames come slowly, as software draws them,
    // or after one long in the making, it is not carried past it between two of them.)
    const frameMs = performance.now();
    frameSlow = Math.min(
      1,
      Math.max(1 / 60, frameAt ? (frameMs - frameAt) / 1000 : 0, frameSlow * 0.98),
    );
    frameAt = frameMs;
    const t = now(),
      slowings = slowingsNow(),
      live = !time.stopped && time.pace <= 30 * DAY;
    // (The viewer's word — a speed chosen, or "Go on" — lets go of the slowing in force.)
    if (slowCap > 0 && !time.capped("battle")) {
      slowCap = 0;
      slowFor = null;
    }
    const begun = live ? slowingBegun(slowings, t, time.pace, slowedOnce) : null;
    if (begun) {
      slowedOnce.add(begun.key);
      slowFor = begun.key;
      slowWords = battleCapWords(begun.cap, begun.speed, begun.turn);
    }
    const held = slowFor ? slowings.find((s) => s.key === slowFor) : undefined;
    if (slowFor && (!held || t >= held.to)) slowFor = null;
    const ahead = live ? slowAhead(slowings, t, frameSlow, slowedOnce) : null,
      inForce = slowFor && held ? held.speed : Infinity,
      limit = Math.min(inForce, ahead?.speed ?? Infinity);
    if (limit < time.pace) {
      if (limit !== slowCap) {
        slowCap = limit;
        time.cap("battle", limit);
      }
    } else if (slowCap > 0) {
      slowCap = 0;
      time.uncap("battle");
    }
    // (Told as what holds the clock: the stage ahead it is brought down to, where slower.)
    battleSlow.show(
      slowCap > 0 && ahead?.s && ahead.speed < inForce
        ? battleCapWords(ahead.s.cap, ahead.s.speed, ahead.s.turn)
        : slowFor
          ? slowWords
          : null,
    );
  });
  const battleSlow = new BattleSlowCaption(hud);
  battleSlow.onGo = () => time.uncap("battle");
  /**
   * The slowings of the battle at the turn the clock may be slowed for, the earliest first: a town's,
   * where it is its land's heart; a land's, where drawn on it.
   */
  function slowingsNow(): Slowing[] {
    const townTurn =
      scale === "village" && plan && townWar
        ? (townWar.placed?.turn ??
          (townWar.fight ? Number(townWar.fight.key.split(":").at(-1)) : null))
        : null;
    // (A raid over the town, W2: slowed so that it can be watched.)
    const raids = scale === "village" && plan?.town ? raidSlowings(plan.town) : [];
    if (raids.length && townTurn !== null && townWar)
      return [...battleSlowings(`${townWar.ref}:${townTurn}`, "town"), ...raids].sort(
        (a, b) => a.from - b.from,
      );
    if (raids.length) return raids;
    return townTurn !== null && townWar
      ? battleSlowings(`${townWar.ref}:${townTurn}`, "town")
      : scale === "region" && regionWars.now
        ? regionWars.now.fights
            .flatMap((f) => battleSlowings(f.key, "land"))
            .sort((a, b) => a.from - b.from)
        : [];
  }
  exposed.warsInPlace = () => {
    const n = regionWars.now;
    return n
      ? {
          marks: n.marks.map((m) => ({
            ref: m.ref,
            side: m.side,
            doing: m.doing,
            x: m.x,
            z: m.z,
            men: m.men,
            name: m.name,
          })),
          fights: n.fights.map((f) => ({
            key: f.key,
            stage: f.stage,
            k: f.k,
            x: f.x,
            z: f.z,
            name: f.name,
          })),
          camps: n.camps.length,
          figures: n.figures.length,
          fallen: n.figures.filter((f) => f.fallen).length,
          slowed: slowFor,
          told: battleSlow.told,
          wars: n.wars.flatMap((w) =>
            w
              ? [
                  {
                    ref: w.ref,
                    turn: w.turn,
                    f: w.f,
                    attacker: w.attacker?.doing ?? null,
                    defender: w.defender?.doing ?? null,
                  },
                ]
              : [],
          ),
        }
      : null;
  };
  exposed.globeMarching = () => Object.fromEntries(liveMarching ?? []);
  // The battle a clock is slowed for now (a land's or a town's), and how it is told.
  exposed.battleSlowed = () => ({ slowed: slowFor, told: battleSlow.told });
  // The eye over a point of the land, so far off (for the look tools: to watch a host or a fight).
  exposed.faceLand = (x: number, z: number, distance = 30) => {
    if (scale !== "region") return false;
    rig.target.set(x, region.heightAt(x, z), z);
    rig.userZoomed = true;
    rig.distance = distance;
    return true;
  };
  exposed.warsDrawn = () =>
    scale === "globe" ? globeWars.drawn : scale === "region" ? regionWars.drawn : 0;
  exposed.landWars = () => ({ ...regionWars.shown, known: warsNow !== null });
  exposed.battlesOnScreen = () => (scale === "region" ? regionWars.battlesOnScreen() : []);
  // What the armies drawn are made of now (M110): on the globe and in a land.
  exposed.armies = () => ({ globe: { ...globeWars.counts }, land: { ...regionWars.counts } });
  exposed.landMarks = () => regionWars.places();
  exposed.landRaids = () => regionWars.raidsShown();
  const onScreen = (list: readonly { x: number; y: number; z: number }[]) =>
    list.flatMap((f) => {
      const s = stage.camera.camera!.worldToScreen(rig.target.clone().set(f.x, f.y, f.z));
      return s.z > 0 ? [{ x: s.x, y: s.y }] : [];
    });
  exposed.landArcsOnScreen = () => (scale === "region" ? onScreen(regionWars.arcsAt()) : []);
  exposed.faceLandArc = () => {
    const a = scale === "region" ? regionWars.arcsAt().at(-1) : undefined;
    if (!a) return false;
    rig.halt();
    rig.target.set(a.x, rig.target.y, a.z);
    return true;
  };
  exposed.globeArcsOnScreen = () => (scale === "globe" ? onScreen(globeArcs.places) : []);
  exposed.streaksOnScreen = () => (scale === "village" ? onScreen(village.streaksShown()) : []);
  // Where a spot of the globe is on the screen (for the look tools: to zoom at a thing).
  exposed.spotOnScreen = (spot: number) => {
    const frame = client.latestFrame("globe");
    if (!frame || scale !== "globe") return null;
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions,
      [at] = globe.screenOf([{ x: p[spot * 3]!, y: p[spot * 3 + 1]!, z: p[spot * 3 + 2]! }]);
    return at && at.facing > 0 ? { x: at.x, y: at.y } : null;
  };
  // The same wars seen closer in a land (Phase 10 M95): its hosts coming in for what they
  // want or going out to the front, its defenders, its battles of this year and last; since
  // Phase 40 (M203) each host where its year has it, by the land's roads.
  const regionWars = new RegionWars(stage);
  /** The ways a land's hosts go by, worked out once for each land (M203). */
  let landWays: { key: string; ways: LandWays } | null = null;
  const showLandWars = () => {
    const frame = client.latestFrame("region"),
      globeFrame = client.latestFrame("globe"),
      parent = frame?.arrays.parent as Int32Array | undefined;
    if (
      !frame ||
      !globeFrame ||
      !warsNow ||
      !parent ||
      region.key !== (frame.meta as { ref: string }).ref
    ) {
      regionWars.set(null, () => 0);
      return;
    }
    const meta = frame.meta as { size: number; tileKm: number },
      grid = sphereGrid((globeFrame.meta as { frequency: number }).frequency);
    regionWars.set(
      landWars(warsNow, parent, meta.size, meta.tileKm, grid),
      (x, z) => region.heightAt(x, z),
      (x, z) => region.seaAt(x, z),
    );
    // Each of the world's own wars where its year has its hosts (not a war watched unfolding).
    const g = region.landGround;
    if (!g || campaign || warAge || warsNow !== warsLive) {
      regionWars.inPlace(null, null);
      return;
    }
    if (!landWays || landWays.key !== regionSurfaceKey)
      landWays = { key: regionSurfaceKey, ways: new LandWays(g) };
    // (Of its peopled towns, as the host finds a town's heart: a ruin is fought past.)
    const town = heartTown(
        (landPlan?.towns ?? [])
          .filter((t) => t.population > 0)
          .flatMap((t) => {
            const at = region.land.townAt(t.ref);
            return at ? [{ ...at, name: t.name, population: t.population, ref: t.ref }] : [];
          }),
      ),
      spots = landSpots(parent, meta.size, meta.tileKm, grid);
    regionWars.inPlace(warsNow, {
      spots,
      ways: landWays.ways,
      town,
      sea: (x, z) => region.seaAt(x, z),
      townAt: (ref) => region.land.townAt(ref),
    });
  };
  // The world's towns on the globe (M95): what is zoomed into is there before it, and named
  // as the view closes in.
  const globeTowns = new GlobeTowns(stage);
  let townsShown: GlobeTown[] = [],
    townsAt = -Infinity;
  const readTowns = async () => {
    townsAt = performance.now();
    const frame = client.latestFrame("globe");
    if (!frame) return;
    townsShown = await client.query<GlobeTown[]>({ type: "towns.map" });
    globeTowns.set(
      townsShown,
      sphereGrid((frame.meta as { frequency: number }).frequency),
      frame.arrays.elevation as Float32Array,
    );
  };
  /**
   * How a host stands to what is followed (M101): its own realm followed ("ours"), or fighting
   * a realm followed ("foe").
   */
  const stanceOf = (realm: string, war: string): "ours" | "foe" | undefined => {
    if (followedRefs.has(realm)) return "ours";
    const w = warsNow?.wars.find((x) => x.ref === war),
      enemy = w ? (w.attacker.ref === realm ? w.defender.ref : w.attacker.ref) : null;
    return enemy && followedRefs.has(enemy) ? "foe" : undefined;
  };
  /** Each seat under siege, marked where it stands (M104): a victory there, the seat still held. */
  const siegeMarks = (): Label[] => {
    const frame = client.latestFrame("globe");
    if (!frame || !warsNow || !globeWars.root.enabled) return [];
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions,
      besieged = warsNow.wars.filter((w) => w.siege !== null),
      at = globe.screenOf(
        besieged.map((w) => ({
          x: p[w.siege! * 3]!,
          y: p[w.siege! * 3 + 1]!,
          z: p[w.siege! * 3 + 2]!,
        })),
        1.03,
      );
    return besieged.flatMap((w, i) =>
      at[i]!.facing > 0.15
        ? [
            {
              key: `siege:${w.ref}`,
              text: `🏰 ${w.defender.name.split(" of ").at(-1)} besieged`,
              at: { x: at[i]!.x, y: at[i]!.y },
              priority: 1.6e9,
            },
          ]
        : [],
    );
  };
  /**
   * A war watched unfolding (M193): each battle lately fought and how many fell, each land taken;
   * the wars of an age (M194): the year's bloodiest battles and lands taken.
   */
  const campaignMarks = (): Label[] => {
    const frame = client.latestFrame("globe"),
      marks = campaign?.now.marks ?? warAge?.now.marks;
    if (!frame || !marks || !globeWars.root.enabled) return [];
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions,
      at = globe.screenOf(
        marks.map((m) => ({ x: p[m.spot * 3]!, y: p[m.spot * 3 + 1]!, z: p[m.spot * 3 + 2]! })),
        1.03,
      );
    return marks.flatMap((m, i) =>
      at[i]!.facing > 0.15
        ? [
            {
              key: `war:${m.key}`,
              text: m.text,
              // (A land taken over its battle's mark, not under it.)
              at: { x: at[i]!.x, y: at[i]!.y - (m.key.startsWith("taken:") ? 20 : 0) },
              priority: 1.65e9,
            },
          ]
        : [],
    );
  };
  // Visitors from another star (Phase 18 M134): over each land where they came down, keep an
  // embassy, or struck, their name.
  let visits: { cell: number; text: string; event: string }[] = [];
  client.subscribe<typeof visits>({ type: "peoples.visits" }, 3000, (v) => (visits = v));
  const visitMarks = (): Label[] => {
    const frame = client.latestFrame("globe");
    if (!frame || !visits.length) return [];
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions,
      at = globe.screenOf(
        visits.map((v) => ({ x: p[v.cell * 3]!, y: p[v.cell * 3 + 1]!, z: p[v.cell * 3 + 2]! })),
        1.04,
      );
    return visits.flatMap((v, i) =>
      at[i]!.facing > 0.15
        ? [
            {
              key: `visit:${v.event}`,
              text: v.text,
              at: { x: at[i]!.x, y: at[i]!.y - 16 },
              priority: 1.7e9,
            },
          ]
        : [],
    );
  };
  exposed.visits = () => visits.length;
  /** Each host on the globe as its counter (M101): its realm's arms and the men it fields. */
  const globeCounters = (): Label[] =>
    globeWars.hostsOnScreen().flatMap((h) => {
      const w = warsNow?.wars.find((x) => x.ref === h.ref),
        side = w ? (h.attacker ? w.attacker : w.defender) : null;
      return side
        ? [
            {
              key: `${h.ref}:${side.ref}`,
              text: counterWords(side.fields),
              at: { x: h.x, y: h.y },
              priority: 1.5e9,
              badge: { realm: side.ref, stance: stanceOf(side.ref, h.ref) },
            },
          ]
        : [];
    });
  let townsNamed = false;
  stage.onUpdate(() => {
    globeTowns.visible = scale === "globe";
    if (scale !== "globe") return;
    // (Read again every half-minute while near enough to be seen.)
    if (rig.distance < 2.6 && performance.now() - townsAt > 30_000) void readTowns();
    // (The eye leaning over a war watched: the cities' towers lower, not a forest of posts.)
    globeTowns.low = Math.min(1, rig.lean / 45);
    globeTowns.update(rig.distance);
    // (While a war is watched unfolding, its marks only: the towns' names stand aside.)
    const named = campaign || warAge ? [] : globeTowns.named(stage.camera.camera!, rig.distance),
      counters = [...visitMarks(), ...siegeMarks(), ...campaignMarks(), ...globeCounters()];
    if (named.length || counters.length || townsNamed)
      labels.update([
        ...counters,
        ...named.map((n) => ({
          key: n.town.ref,
          text: n.town.city ? `🏙️ ${n.town.name}` : n.town.name,
          at: { x: n.x, y: n.y },
          priority: n.town.people,
        })),
      ]);
    townsNamed = named.length + counters.length > 0;
  });
  /** The town drawn nearest a point of the screen on the globe, within a finger's reach. */
  const townAt = (x: number, y: number): GlobeTown | null => {
    let best: GlobeTown | null = null,
      bestD = 24;
    for (const n of globeTowns.named(stage.camera.camera!, rig.distance)) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) {
        bestD = d;
        best = n.town;
      }
    }
    return best;
  };

  const aspect = () => Math.max(0.3, innerWidth / Math.max(1, innerHeight));
  const globeFit = () => (aspect() < 1 ? 3.1 / aspect() : 3.3);
  // (Near enough that its towns, drawn from their fabric, are seen growing: M150.)
  const regionFit = () => (aspect() < 1 ? 74 / aspect() : 80);
  // A land touched on the globe: its page (a spot of the sea, the spot's own).
  const selectCell = (cell: number | null) => {
    globe.mark(cell);
    if (cell === null) {
      pageWindow.close();
      return;
    }
    walk.saw("land");
    const frame = client.latestFrame("globe"),
      province = (frame?.arrays.province as Int32Array | undefined)?.[cell] ?? -1;
    if (province >= 0) {
      // (Its region readied, so "go to" and zooming in draw at once.)
      void client.query({ type: "region.prepare", args: { cell: province } }).catch(() => {});
      void pageWindow.open(`cell:0:${province}`);
    } else void pageWindow.open(`spot:0:${cell}`);
  };
  // Among the stars: a ship, a hall, a fleet or a battle (M93), else a star.
  const tapStars = (x: number, y: number) => {
    const voyage = starScene.pickVoyage(x, y);
    if (voyage) void pageWindow.open(voyage);
    else selectStar(starScene.pick(x, y));
  };
  const tapGlobe = (x: number, y: number) => {
    const town = townAt(x, y),
      war = town ? null : globeWars.pick(x, y);
    if (town || war) {
      globe.mark(null);
      void pageWindow.open(town ? town.ref : war!);
    } else selectCell(globe.pick(x, y));
  };
  /**
   * A band's camp on the land (Phase 28 M159) at a point of the screen: by its name where that is
   * shown (moved in from the edge or from under the bar), else by its fire or its name's place.
   */
  const campAt = (x: number, y: number): number | null => {
    const named = /^camp:\d+:(\d+)$/.exec(labels.keyAt(x, y) ?? "");
    return named ? Number(named[1]) : region.land.camps.pick(stage.camera.camera!, x, y);
  };
  const tapRegion = (x: number, y: number) => {
    const war = regionWars.pick(x, y),
      // A band's camp (Phase 28 M159): its page.
      camp = war ? null : campAt(x, y);
    if (war) void pageWindow.open(war);
    else if (camp !== null) {
      region.mark(null);
      void pageWindow.open(`camp:${regionCell}:${camp}`);
    } else selectTile(region.pick(x, y));
  };
  const selectTile = (tile: number | null) => {
    region.mark(tile);
    const village = tile === null ? null : region.villageNear(tile);
    const hit = village === null ? undefined : villages.find((v) => v.tile === village);
    if (hit) {
      region.mark(hit.tile);
      void pageWindow.open(hit.ref);
      return;
    }
    if (tile === null) {
      pageWindow.close();
      return;
    }
    // The ground there: what lies in it, or the land's own page.
    void client
      .query<{ deposit: { ref: string } | null }>({
        type: "tile",
        args: { center: regionCell, tile },
      })
      .then((t) => pageWindow.open(t.deposit ? t.deposit.ref : `cell:0:${regionCell}`));
  };
  const rig = new OrbitRig(stage, canvas, {
    distance: globeFit(),
    minDistance: 1.35,
    maxDistance: 12,
    pitch: -18,
    minPitch: -80,
    maxPitch: 80,
    drift: drift(),
    onTap: (x, y) =>
      palette.armed &&
      (scale === "globe" || scale === "region" || scale === "camp" || scale === "village")
        ? tapPalette(x, y)
        : scale === "globe"
          ? tapGlobe(x, y)
          : scale === "region"
            ? tapRegion(x, y)
            : scale === "system"
              ? tapSystem(x, y)
              : scale === "cluster"
                ? tapStars(x, y)
                : scale === "world"
                  ? tapWorld(x, y)
                  : scale === "galaxy"
                    ? tapGalaxy(x, y)
                    : scale === "camp"
                      ? tapCamp(x, y)
                      : scale === "battle"
                        ? tapBattle(x, y)
                        : tapVillage(x, y),
  });
  /**
   * What stands at a point of a village's ground, of what is not a person or a beast (M93):
   * its battle's hosts (the battle), a home (its household, if met, else its town's
   * families), a field (its town).
   */
  const villageThingAt = (x: number, y: number): string | null => {
    const at = plan ? onPlane(x, y, 0) : null;
    if (!plan || !at) return null;
    const mx = at.x / VILLAGE_METRE,
      mz = at.z / VILLAGE_METRE,
      front = battleFront(plan),
      event = plan.life?.battle?.event;
    if (townWar && village.soldierAt(mx, mz)) return townWar.fought?.event ?? townWar.ref;
    if (front && event && Math.hypot(mx - front.x, mz - front.z) < 30) return event;
    // A town drawn from its fabric (Phase 25 M151): one of its buildings, its walls, a lot of it —
    // a watched family's home on it, theirs.
    const thing = village.townThingAt(mx, mz, now());
    if (thing) {
      if (thing.kind === "civic") return `bldg:${plan.ref}:${thing.at}:${thing.start}`;
      if (thing.kind === "walls") return `walls:${plan.ref}`;
      const lot = village.townLot(thing.lot),
        theirs = lot
          ? plan.homes.find((h) => h.household && Math.hypot(h.x - lot.x, h.z - lot.z) < 1)
          : undefined;
      return theirs?.household ?? `lot:${plan.ref}:${thing.lot}`;
    }
    let home = -1,
      near = 7;
    plan.homes.forEach((h, k) => {
      const d = Math.hypot(h.x - mx, h.z - mz);
      if (d < near) {
        near = d;
        home = k;
      }
    });
    if (home >= 0) return plan.homes[home]!.household ?? `${plan.ref}#families`;
    for (const f of plan.fields) {
      const c = Math.cos(-f.yaw),
        s = Math.sin(-f.yaw),
        dx = mx - f.x,
        dz = mz - f.z,
        lx = dx * c - dz * s,
        lz = dx * s + dz * c;
      if (Math.abs(lx) < f.w / 2 && Math.abs(lz) < f.d / 2) return plan.ref;
    }
    return null;
  };
  /** The thing under a point of the screen, at the scale shown (for the tooltip). */
  const refAt = (x: number, y: number): string | null => {
    switch (scale) {
      case "globe": {
        // (Under one of the deeper lenses the tip tells the land's number there, what its colour
        // says: not the town, host or garrison standing in it, M108.)
        const reading = DEEP_LENSES.includes(lens);
        const town = reading ? null : townAt(x, y);
        if (town) return town.ref;
        const war = reading ? null : globeWars.pick(x, y);
        if (war) return war;
        const spot = globe.pick(x, y),
          frame = client.latestFrame("globe"),
          province =
            spot === null ? -1 : ((frame?.arrays.province as Int32Array | undefined)?.[spot] ?? -1);
        return spot === null ? null : province >= 0 ? `cell:0:${province}` : `spot:0:${spot}`;
      }
      case "camp":
        return campThingAt(x, y);
      case "battle": {
        // (One who fought: their side's realm.)
        const who = fight && battleLayer ? battleLayer.pick(fight.now, x, y) : null,
          t = who === null ? undefined : fight?.now.troopers[who];
        return t ? (t.side === 0 ? fight!.info.attacker.ref : fight!.info.defender.ref) : null;
      }
      case "region": {
        const war = regionWars.pick(x, y);
        if (war) return war;
        const camp = campAt(x, y);
        if (camp !== null) return `camp:${regionCell}:${camp}`;
        const tile = region.pick(x, y),
          near = tile === null ? null : region.villageNear(tile),
          v = near === null ? undefined : villages.find((w) => w.tile === near);
        return v ? v.ref : tile === null ? null : `cell:0:${regionCell}`;
      }
      case "village": {
        const i = village.pick(x, y);
        if (i !== null && plan?.people[i]) return plan.people[i]!.ref;
        const visitors = village.pickVisitors(x, y);
        if (visitors) return visitors.event;
        const beast = village.pickBeast(x, y);
        return beast ? beast.ref : villageThingAt(x, y);
      }
      case "system": {
        const ship = skyScene.pickPeople(x, y);
        if (ship) return ship;
        const i = skyScene.pick(x, y);
        return i === null ? null : (skyPlan?.bodies[i]?.ref ?? null);
      }
      case "cluster": {
        const voyage = starScene.pickVoyage(x, y);
        if (voyage) return voyage;
        const i = starScene.pick(x, y);
        return i === null ? null : (clusterPlan?.stars[i]?.ref ?? null);
      }
      case "world":
        return hallAt(x, y);
      default:
        return null;
    }
  };
  // The tooltip (M93): on a desk, what the pointer rests on, in a few words.
  const tooltip = new Tooltip(hud, client);
  let hoverAt = 0;
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || e.buttons) {
      tooltip.hide();
      return;
    }
    // (Asked a dozen times a second at most: a pick reads the scene.)
    const now = performance.now();
    if (now - hoverAt < 80) return;
    hoverAt = now;
    const rect = canvas.getBoundingClientRect(),
      x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    // With an act in hand the palette says what it will do where the pointer is, and lights it.
    if (
      palette.armed &&
      (scale === "globe" || scale === "region" || scale === "camp" || scale === "village")
    ) {
      tooltip.hide();
      const at = paletteAt(x, y);
      palette.hover(at.cell, at.town);
      return;
    }
    tooltip.point(refAt(x, y), e.clientX, e.clientY);
  });
  canvas.addEventListener("pointerleave", () => tooltip.hide());
  canvas.addEventListener("pointerdown", () => tooltip.hide());
  canvas.addEventListener("wheel", () => tooltip.hide(), { passive: true });
  // (The view moved under a pointer at rest — steered by the keys, or another scale come to —
  // its tip is of what was there: put away.)
  let tippedAt: string = scale;
  stage.onUpdate(() => {
    if (rig.steering || tippedAt !== scale) tooltip.hide();
    tippedAt = scale;
  });
  exposed.refAt = refAt;

  // The god's palette (Phase 12 M106): an act taken in hand falls where the map is touched,
  // its reach lit under the pointer before it is cast.
  const palette = new GodPalette(hud, client);
  document.body.classList.add("with-palette");
  /** The land (province) and the town under a point of the screen, for the palette. */
  const paletteAt = (
    x: number,
    y: number,
  ): { cell: number | null; town: string | null; place?: TownPlace } => {
    if (scale === "camp") return { cell: regionCell >= 0 ? regionCell : null, town: null };
    // In a town watched (Phase 42 M201): the town, and where in it the hand touches.
    if (scale === "village") {
      const at = plan ? onPlane(x, y, 0) : null;
      if (!plan) return { cell: null, town: null };
      const mx = at ? at.x / VILLAGE_METRE : 0,
        mz = at ? at.z / VILLAGE_METRE : 0;
      return {
        cell: plan.cell ?? null,
        town: plan.ref,
        ...(at ? { place: { x: mx, z: mz, lot: village.lotAt(mx, mz) } } : {}),
      };
    }
    if (scale === "region") {
      const tile = region.pick(x, y),
        near = tile === null ? null : region.villageNear(tile),
        v = near === null ? undefined : villages.find((w) => w.tile === near);
      return { cell: regionCell >= 0 ? regionCell : null, town: v?.ref ?? null };
    }
    const town = townAt(x, y),
      spot = globe.pick(x, y),
      frame = client.latestFrame("globe"),
      province =
        spot === null ? -1 : ((frame?.arrays.province as Int32Array | undefined)?.[spot] ?? -1);
    return {
      cell: town ? town.cell : province >= 0 ? province : null,
      town: town?.ref ?? null,
    };
  };
  const tapPalette = (x: number, y: number) => {
    const at = paletteAt(x, y);
    void palette.tap(at.cell, at.town, at.place);
  };
  palette.onOpen = (ref) => void pageWindow.open(ref);
  palette.onArmed = (armed) => {
    document.body.classList.toggle("casting", armed);
    tooltip.hide();
    if (armed) walk.saw("hand");
  };
  palette.onLight = (lit) => {
    litLands = lit;
    const frame = client.latestFrame("globe");
    if (scale === "globe" && frame && globeLensColors)
      globe.paint(lit.size ? litColors(globeLensColors, frame, lit) : globeLensColors);
  };
  // (A right click puts the act in hand down.)
  canvas.addEventListener("contextmenu", (e) => {
    if (!palette.armed) return;
    e.preventDefault();
    palette.putDown();
  });
  exposed.palette = {
    holding: () => palette.holding,
    take: (id) => palette.take(id),
    putDown: () => palette.putDown(),
  };
  exposed.lit = () => [...litLands];
  // The acts playing where they fell: rain over a land, fire on a town, threads between realms.
  const globeActs = new GlobeActs(stage, stage.root);
  let actsKey = "";
  const showActs = (map: ActsMap) => {
    const frame = client.latestFrame("globe");
    if (!frame) return;
    // (Placed again as acts come and go, and as they fade, a step at a time.)
    const key = JSON.stringify(map.acts.map((a) => [a.event, Math.round(a.left * 10)]));
    if (key === actsKey) return;
    actsKey = key;
    globeActs.set(
      placeActs(
        map.acts,
        sphereGrid((frame.meta as { frequency: number }).frequency),
        frame.arrays.elevation as Float32Array,
      ),
    );
  };
  client.subscribe<ActsMap>({ type: "acts.map" }, 2000, showActs);
  palette.onCast = () => void client.query<ActsMap>({ type: "acts.map" }).then(showActs);
  stage.onUpdate(() => {
    globeActs.root.enabled = scale === "globe";
    if (scale === "globe") globeActs.update(performance.now() / 1000, rig.distance);
    // (The palette's acts fall on the world and its lands: at the other scales it stands aside,
    // and an act in hand is put down.)
    // (Among a band, on their land: Phase 29 M160.)
    // (Nor while a war of history is watched unfolding: Phase 38 M193.)
    // (And in a town watched, on it and its land: Phase 42 M201.)
    const castable =
      (scale === "globe" && !campaign && !warAge) ||
      scale === "region" ||
      scale === "camp" ||
      scale === "village";
    if (document.body.classList.contains("palette-off") === castable) {
      document.body.classList.toggle("palette-off", !castable);
      if (!castable) palette.putDown();
    }
  });
  exposed.actsPlaying = () => globeActs.playing;
  exposed.actsDrawn = () => (scale === "globe" ? globeActs.drawn : 0);
  // A zoom goes toward what is under the pointer (Phase 10 M95): the globe turns it to the
  // middle; a flat scene (a land, a village, a sky, the stars, the galaxy) slides it there.
  type Point = { x: number; y: number; z: number };
  const onPlane = (x: number, y: number, h = 0): Point | null => {
    const cam = stage.camera.camera!,
      from = cam.screenToWorld(x, y, cam.nearClip),
      to = cam.screenToWorld(x, y, cam.farClip),
      dy = to.y - from.y;
    if (Math.abs(dy) < 1e-9) return null;
    const k = (h - from.y) / dy;
    return k < 0 || k > 1
      ? null
      : { x: from.x + (to.x - from.x) * k, y: h, z: from.z + (to.z - from.z) * k };
  };
  const onGlobe = (x: number, y: number): Point | null => {
    const cam = stage.camera.camera!,
      from = cam.screenToWorld(x, y, cam.nearClip),
      to = cam.screenToWorld(x, y, cam.farClip),
      dx = to.x - from.x,
      dy = to.y - from.y,
      dz = to.z - from.z,
      a = dx * dx + dy * dy + dz * dz,
      b = 2 * (from.x * dx + from.y * dy + from.z * dz),
      c = from.x * from.x + from.y * from.y + from.z * from.z - 1.01 * 1.01,
      disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const k = (-b - Math.sqrt(disc)) / (2 * a);
    return { x: from.x + dx * k, y: from.y + dy * k, z: from.z + dz * k };
  };
  rig.anchor = (x, y) =>
    scale === "globe" || scale === "world"
      ? onGlobe(x, y)
      : scale === "region"
        ? region.pointAt(x, y)
        : onPlane(x, y);
  stage.onUpdate(() => {
    rig.round = scale === "globe" || scale === "world";
    const regionFrame = scale === "region" ? client.latestFrame("region") : null,
      half = regionFrame
        ? (((regionFrame.meta as { size: number }).size - 1) *
            (regionFrame.meta as { tileKm: number }).tileKm) /
          2
        : 0;
    rig.bounds =
      scale === "region"
        ? { x: 0, z: 0, reach: half * 0.85 }
        : scale === "village"
          ? {
              x: 0,
              z: 0,
              // (Out to its countryside: its farthest fields and its pasture, Phase 32.)
              reach: Math.max(plan?.districts ? 600 : 300, village.countryReach()) * VILLAGE_METRE,
            }
          : scale === "battle"
            ? // (Over the field it was fought on: seventy metres either way.)
              { x: 0, z: 0, reach: 7.5 }
            : null;
  });
  // Framed between the bar of whichever scale is up and, on a phone, the sheet open below
  // (read a few times a second, not each frame).
  let covered = { top: 0, bottom: 0 },
    coveredAt = -Infinity;
  rig.covered = () => {
    const now = performance.now();
    if (now - coveredAt > 250) {
      coveredAt = now;
      const h = Math.max(1, innerHeight),
        bar =
          hud.querySelector<HTMLElement>(".war-panel:not([hidden]) .bar") ??
          hud.querySelector<HTMLElement>(".panel:not([hidden]) .bar"),
        // (A page open stands over the scales' own windows.)
        sheet =
          hud.querySelector<HTMLElement>(".page-panel .inspector:not([hidden])") ??
          hud.querySelector<HTMLElement>(".panel:not([hidden]) .inspector:not([hidden])"),
        s = sheet?.getBoundingClientRect(),
        // A sheet across the foot of the screen (a phone's), not a column at its side.
        across = !!s && s.width > innerWidth * 0.8 && s.bottom > h - 40;
      covered = {
        top: bar ? bar.getBoundingClientRect().bottom / h : 0,
        bottom: across ? (h - s!.top) / h : 0,
      };
    }
    // (A war watched unfolding is framed on the globe's face, nearer the eye than its middle:
    // the lift that frames the middle lifts its face the more, the nearer the eye is.)
    if ((campaign || warAge) && scale === "globe") {
      const k = Math.max(0, (rig.distance - 1) / rig.distance);
      return { top: covered.top * k, bottom: covered.bottom * k };
    }
    return covered;
  };

  // Down to a region, and back up to the world: the camera, the scene, the panel,
  // the labels and the host's interest all move together.
  const toRegion = (cell: number) => {
    scale = "region";
    // (A land of another body shows its own ground, no lens of the home world's.)
    const offworld = isColonyLand(cell);
    // The globe's lens, seen in the land too (M95): its terrain, the land's own; else the map's.
    regionLens = lens === "terrain" || offworld ? "land" : "world";
    regionPanel.markLens(regionLens);
    regionPanel.mapLens(lens === "terrain" || offworld ? null : LENS_NAMES[lens]);
    stage.backdrop("ground", regionFit());
    if (offworld) void colonySkyOver(cell);
    else stage.colonySky(null);
    regionPanel.backTo = offworld ? "Its world" : "The world";
    regionCell = cell;
    globe.visible = false;
    region.visible = true;
    planetPanel.visible = false;
    regionPanel.visible = true;
    time.at("region", regionPanel.timeSlot);
    rig.configure({
      distance: regionFit(),
      minDistance: 12,
      maxDistance: 260,
      pitch: -48,
      minPitch: -85,
      maxPitch: -12,
      drift: drift(),
      target: [0, 0, 0],
    });
    client.setInterest({ view: "region", focus: `cell:0:${cell}` });
    villages = [];
    landPlan = null;
    townNews.clear();
    stopVillages?.();
    // Its towns drawn from their fabric, their fields and its roads, as they grow (M150).
    stopVillages = client.subscribe<LandPlan>(
      { type: "towns.land", args: { cell, most: stage.quality.landLots } },
      1000,
      (plan) => {
        if (regionCell !== cell) return;
        villages = plan.towns.map((v) => ({
          ref: v.ref,
          name: v.name,
          tile: v.tile,
          population: v.population,
          founded: v.founded,
        }));
        // What each town did since the last plan, on its label a while (M154).
        const wall = performance.now();
        for (const [ref, text] of landTidings(landPlan, plan))
          townNews.set(ref, { text, until: wall + TIDING_MS });
        const firstOfIt = landPlan === null;
        landPlan = plan;
        if (plan.covered) paintRegion();
        const t0 = performance.now();
        region.setTowns(plan, plan.t);
        performance.measure("region.towns", { start: t0 });
        // (A colony's land is its town, in a land of nothing else: the eye goes to it.)
        if (offworld && firstOfIt && plan.towns[0]) {
          const at = region.land.townAt(plan.towns[0].ref),
            ground = region.groundAt(plan.towns[0].tile);
          if (at) {
            rig.halt();
            rig.target.set(at.x, ground?.y ?? 0, at.z);
            rig.userZoomed = true;
            rig.distance = Math.max(14, at.r * 7);
          }
        }
        // (Its wars' battles fought before its greatest town, its sieges laid about it: M203.)
        showLandWars();
      },
    );
    paintRegion();
  };
  const toGlobe = () => {
    scale = "globe";
    stage.backdrop("space");
    regionCell = -1;
    stopVillages?.();
    stopVillages = null;
    villages = [];
    landPlan = null;
    labels.clear();
    bubbles.clear();
    region.visible = false;
    skyScene.visible = false;
    systemPanel.visible = false;
    starScene.visible = false;
    clusterPanel.visible = false;
    globe.visible = true;
    regionPanel.visible = false;
    planetPanel.visible = true;
    time.at("globe", planetPanel.timeSlot);
    rig.configure({
      distance: globeFit(),
      minDistance: 1.35,
      maxDistance: 12,
      minPitch: -80,
      maxPitch: 80,
      drift: drift(),
      target: [0, 0, 0],
    });
    client.setInterest({ view: "globe", focus: null });
    paintGlobe();
  };
  planetPanel.onCloser = (cell) => {
    walk.saw("scale");
    void toRegion(cell);
  };
  // Out to the star's system, and back to the world: the worlds go round at the sky's speeds.
  const systemPanel = new SystemPanel(hud, client);
  let sky: SkyState = { programs: [], colonies: [] },
    stopSky: (() => void) | null = null,
    // The peoples among the stars while another star's system is shown (M136), read alone.
    starPeoples: PeoplesSky | null = null,
    stopStarPeoples: (() => void) | null = null;
  /** A tap in a system: a ship of another star's people (its crossing), else a body. */
  const tapSystem = (x: number, y: number) => {
    const ship = skyScene.pickPeople(x, y);
    if (ship) return void pageWindow.open(ship);
    selectBody(skyScene.pick(x, y));
  };
  const selectBody = (i: number | null) => {
    skyScene.mark(i);
    const b = i === null ? undefined : skyPlan?.bodies[i];
    if (b) void pageWindow.open(b.ref);
    else {
      pageWindow.close();
      systemPanel.select(null);
    }
  };
  // What has gone up and out among the stars, asked again every second while the sky is shown
  // (from the home star's system, the stars about it, or another star's system).
  const watchSky = () => {
    stopSky?.();
    stopSky = client.subscribe<SkyState>({ type: "space.state" }, 1000, (s) => {
      sky = s;
      systemPanel.update(s);
      clusterPanel.update(s);
      if (scale === "world" && worldFrom === "system" && seen) showHalls(seenAt, seen);
    });
  };
  const toSystem = async () => {
    scale = "system";
    stage.backdrop("space");
    labels.clear();
    bubbles.clear();
    globe.visible = false;
    planetPanel.visible = false;
    systemPlan ??= await client.query<SystemPlan>({ type: "planet.system" });
    // (Built again when another star's was shown since.)
    if (skyBuilt !== "home") {
      skyScene.build(systemPlan);
      skyBuilt = "home";
    }
    skyPlan = systemPlan;
    skyStar = null;
    systemPanel.show(systemPlan);
    skyScene.mark(null);
    skyScene.visible = true;
    watchSky();
    systemPanel.visible = true;
    time.at("system", systemPanel.timeSlot);
    rig.configure({
      // The whole system in view: its farthest orbit across the screen's narrow side.
      distance: (systemExtent(systemPlan) * 2.9) / Math.min(1, aspect()),
      minDistance: 2,
      maxDistance: 400,
      pitch: -60,
      minPitch: -89,
      maxPitch: -10,
      drift: drift(0.6),
      target: [0, 0, 0],
    });
  };
  // Its beginning (M89): the genesis of this very world, from the galaxy's birth.
  planetPanel.onGenesis = () => {
    location.search = `?universe=${encodeURIComponent(universe)}&seed=${encodeURIComponent(seed)}&genesis=1`;
  };
  planetPanel.onSky = () => {
    walk.saw("scale");
    void toSystem();
  };
  // Keeping the world: a save of one's own, and a checkpoint every minute and on leaving.
  const saveName = `${universe}:${seed}`;
  const rememberSave = (name: string) => {
    const url = new URL(location.href);
    url.searchParams.set("load", name);
    history.replaceState(history.state, "", url);
  };
  planetPanel.onSave = async () => {
    try {
      const { bytes } = await client.save(saveName);
      rememberSave(saveName);
      return `saved (${(bytes / 1e6).toFixed(1)} MB)`;
    } catch (error) {
      return `not saved: ${(error as Error).message}`;
    }
  };
  // Another world's save opens in a page of its own world, and loads there.
  const elsewhere = (u: string, s: string, name: string) => {
    location.search = `?universe=${encodeURIComponent(u)}&seed=${encodeURIComponent(s)}&load=${encodeURIComponent(name)}`;
  };
  planetPanel.onSaves = () => client.saves();
  /** What a world taken up again in place has to forget. */
  const takeUp: (() => void)[] = [];
  planetPanel.onLoadSave = async (save) => {
    if (save.universe !== universe || save.seed !== seed) {
      elsewhere(save.universe, save.seed, save.name);
      return "opening that world…";
    }
    try {
      const got = await client.load(save.name);
      tidings.fromNow();
      for (const f of takeUp) f();
      rememberSave(save.name);
      paintGlobe();
      return `back at year ${Math.floor(got.t / YEAR)}${got.fellBack ? " (from the save before; the latest did not read)" : ""}`;
    } catch (error) {
      return `not loaded: ${(error as Error).message}`;
    }
  };
  planetPanel.onDeleteSave = async (save) => {
    try {
      await client.deleteSave(save.name);
      return `“${save.seed}”, year ${Math.floor(save.t / YEAR)}, deleted${save.name === `${saveName}:auto` ? " (this world keeps itself again in a minute)" : ""}`;
    } catch (error) {
      return `not deleted: ${(error as Error).message}`;
    }
  };
  planetPanel.onExport = async () => {
    try {
      const bytes = await client.exportSave(),
        a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/gzip" }));
      a.download = `causalis-${universe}-${seed.replace(/[^a-z0-9]+/gi, "-")}.causalis`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      return `kept as ${a.download} (${(bytes.length / 1e6).toFixed(1)} MB)`;
    } catch (error) {
      return `not kept: ${(error as Error).message}`;
    }
  };
  planetPanel.onImport = async (file) => {
    try {
      const got = await client.importSave(new Uint8Array(await file.arrayBuffer()));
      if (got.universe !== universe || got.seed !== seed) {
        // Another world: keep it under its own name, and open it there.
        const name = `${got.universe}:${got.seed}`;
        await client.save(name);
        elsewhere(got.universe, got.seed, name);
        return "opening that world…";
      }
      paintGlobe();
      return `back at year ${Math.floor(got.t / YEAR)}`;
    } catch (error) {
      return `not opened: ${(error as Error).message}`;
    }
  };
  const saveWarning = document.createElement("div");
  saveWarning.className = "save-warning";
  saveWarning.setAttribute("role", "status");
  saveWarning.hidden = true;
  hud.append(saveWarning);
  const checkpoint = new Checkpoint(
    () => client.save(`${saveName}:auto`),
    (error) => {
      saveWarning.hidden = error === null;
      if (error !== null) {
        saveWarning.textContent =
          "Progress could not be saved in this browser. Open Saves and keep a copy as a file.";
        return;
      }
      // A reload (including Safari recovering a discarded tab) takes up the committed save,
      // rather than making the seed's first year again. Only name it once it has been written.
      rememberSave(`${saveName}:auto`);
    },
  );
  void firstPicture.then(() => checkpoint.save());
  const brushes = new GodBrushes(
    hud,
    client,
    (x, y) => {
      if (scale === "globe") return globe.pick(x, y);
      if (scale === "village") return plan?.spot ?? null;
      if (scale === "camp") return brushes.state?.centres[regionCell] ?? null;
      if (scale === "region") {
        const tile = region.pick(x, y),
          frame = client.latestFrame("region");
        return tile === null
          ? null
          : ((frame?.arrays.parent as Int32Array | undefined)?.[tile] ?? null);
      }
      return null;
    },
    (on) => (on ? time.hold("brush") : time.release("brush")),
  );
  rig.brush = brushes;
  corner.append(brushes.button);
  brushes.onArmed = () => {
    palette.putDown();
    tooltip.hide();
  };
  brushes.onOpen = (ref) => void pageWindow.open(ref);
  brushes.onCast = async () => {
    if (!(await checkpoint.save(true)))
      throw new Error("Stroke recorded, but saving failed. Open Saves and export your world.");
    if (scale === "village" && plan) await loadPlan(plan.ref);
    paintGlobe();
    paintRegion();
    await client.query<ActsMap>({ type: "acts.map" }).then(showActs);
  };
  stage.onUpdate(() => {
    const usable =
      ["globe", "region", "camp", "village"].includes(scale) && rig.enabled && !onColony();
    brushes.button.hidden = !usable;
    if (!usable && brushes.armed) brushes.close();
  });
  setInterval(() => {
    if (!document.hidden) void checkpoint.save();
  }, 60_000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      time.hold("background");
      void checkpoint.save();
    } else time.release("background");
  });
  addEventListener("pagehide", () => {
    time.hold("page hidden");
    void checkpoint.save();
  });
  addEventListener("pageshow", () => {
    time.release("page hidden");
    if (!document.hidden) time.release("background");
  });
  if (document.hidden) time.hold("background");
  // PlayCanvas restores its GPU resources itself. Keep the world while that happens and
  // let the clock go on only once the picture can return; never reload the page to recover.
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    time.hold("graphics");
    void checkpoint.save();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    stage.setQuality(QUALITIES.low);
    if (choice === "auto") auto = new AutoQuality("low", autoCeiling);
    time.release("graphics");
  });
  // Back to the title screen: the world kept on its own first, so Continue takes it up.
  planetPanel.onMenu = async () => {
    try {
      await client.save(`${saveName}:auto`);
    } catch (error) {
      // Kept or not, the viewer asked to go: a world that could not be kept is said so.
      if (!confirm(`The world could not be kept (${(error as Error).message}). Leave it anyway?`))
        return "stayed";
    }
    location.href = location.pathname;
    return "to the title…";
  };
  // Out to the stars around, and back to the star's system.
  const clusterPanel = new ClusterPanel(hud, client);
  // Who holds the stars (Phase 72): read now and then while they are looked at, or a film's marks in their place.
  let nationNow: NationMap | null = null,
    nationAsked = 0,
    nationFilming = false;
  /** Those drawn in the colour of no one: its own people's, and one in the dark, whose star is put out. */
  const FREE_MARK = [0.62, 0.62, 0.68] as const,
    DARK_MARK = [0.09, 0.07, 0.09] as const;
  /** How large a disc reads on the phone, given how far the stars shown lie. */
  const heldReach = (plan: ClusterPlan, stars: readonly string[]): number => {
    let far = 0;
    const of = new Map(plan.stars.map((s) => [s.ref, s.distance]));
    for (const s of stars) far = Math.max(far, of.get(s) ?? 0);
    return Math.max(14, Math.min(plan.radius, far * 1.12));
  };
  const drawHeld = (
    plan: ClusterPlan,
    marks: readonly { star: string; color: readonly [number, number, number]; scale: number }[],
    reach: number,
  ) => {
    const of = new Map(plan.stars.map((s, i) => [s.ref, i])),
      size = reach * LY_SCALE * 0.036;
    starScene.nations(
      plan,
      marks.flatMap((m) => {
        const index = of.get(m.star);
        return index === undefined ? [] : [{ index, color: m.color, size: size * m.scale }];
      }),
    );
  };
  /** How many of the greatest realms are marked plainly (the hues host/nations.ts gives). */
  const NATIONS_MARKED = 10;
  /** How many worlds of no realm are marked at full size; past that each is the smaller, so hundreds of them leave the stars to be seen. */
  const NO_ONE_PLAIN = 60;
  const drawNations = (m: NationMap) => {
    nationNow = m;
    nationRead = performance.now();
    clusterPanel.nations(m);
    if (!clusterPlan || nationFilming || clusterPanel.lenses.lens !== "holds") return;
    const noOne = m.stars.filter((s) => !m.nations[s.nation]).length,
      fewer = Math.min(1, Math.sqrt(NO_ONE_PLAIN / Math.max(1, noOne)));
    drawHeld(
      clusterPlan,
      m.stars.map((s) => {
        const n = m.nations[s.nation];
        return {
          star: s.star,
          color: n ? n.color : s.dark ? DARK_MARK : FREE_MARK,
          // (The greatest plain, those who hold little small beneath them; a world of no one, least.)
          scale: n
            ? s.seat
              ? 1.5
              : s.nation < NATIONS_MARKED
                ? 1
                : 0.55
            : (s.dark ? 0.7 : 0.4) * fewer,
        };
      }),
      heldReach(
        clusterPlan,
        m.stars.map((s) => s.star),
      ),
    );
    // (The greatest are named by the chips below; the rest here.)
    const free = m.stars.filter((s) => !m.nations[s.nation] && !s.dark).length,
      dark = m.stars.filter((s) => !m.nations[s.nation] && s.dark).length,
      held = m.stars.length - free - dark;
    clusterPanel.lenses.say(
      [
        ...(free
          ? [
              {
                color: FREE_MARK,
                words: `${free === 1 ? "1 world" : `${free} worlds`} of no realm`,
              },
            ]
          : []),
        ...(dark
          ? [
              {
                color: DARK_MARK,
                words: `${dark === 1 ? "1 world" : `${dark} worlds`} in the dark`,
              },
            ]
          : []),
      ],
      held
        ? `${held === 1 ? "1 world" : `${held} worlds`} held by ${m.nations.length === 1 ? "1 realm" : `${m.nations.length} realms`}; a larger mark, its seat.`
        : m.stars.length
          ? null
          : "No realm holds a world of another star yet.",
    );
    lensCounts = { marks: m.stars.length, lines: 0, note: null };
  };
  // The lenses of the stars around (Phase 73): one on at a time, read as the map of who holds them is, every two seconds while the stars are looked at, and with none on nothing is.
  let lensCounts: { marks: number; lines: number; note: string | null } | null = null,
    /** A star a moment of the age points at, marked out over the lens. */
    lensFocus: string | null = null,
    /** The eye to go as far out as the lens has something to show, at its next reading. */
    lensFit = false,
    nationRead = 0;
  /** How far out the eye stands to see stars this far off. */
  const starsDistance = (reach: number) => (reach * 0.3 * 2.8) / Math.min(1, aspect());
  const drawLens = (m: StarLensMap) => {
    if (!clusterPlan || nationFilming || clusterPanel.lenses.lens !== m.lens) return;
    const marks = [
        ...m.marks,
        ...(lensFocus ? [{ star: lensFocus, color: [1, 0.1, 0.06] as const, scale: 2.6 }] : []),
      ],
      reach = heldReach(
        clusterPlan,
        marks.map((x) => x.star),
      );
    drawHeld(clusterPlan, marks, reach);
    starScene.lensLines(clusterPlan, m.lines);
    clusterPanel.lenses.say(m.keys, m.note);
    lensCounts = { marks: m.marks.length, lines: m.lines.length, note: m.note };
    if (lensFit) {
      lensFit = false;
      rig.flyTo({ distance: starsDistance(reach) }, 0.9);
    }
  };
  const askNations = async () => {
    nationAsked = performance.now();
    const lens = clusterPanel.lenses.lens;
    if (lens === "holds" || !nationNow || performance.now() - nationRead > 10000)
      drawNations(await client.query<NationMap>({ type: "nation.map" }));
    if (lens && lens !== "holds")
      drawLens(await client.query<StarLensMap>({ type: "star.lens", args: { lens } }));
  };
  /** A lens on, or none: what the map has been drawing of the last put away. */
  const setLens = (lens: StarLens | null) => {
    clusterPanel.lenses.lens = lens;
    clusterPanel.chips = lens === "holds";
    starScene.lanes(lens === "lanes" ? "lit" : !lens || lens === "holds" ? "plain" : "off");
    if (clusterPlan) {
      starScene.lensLines(clusterPlan, []);
      if (lens !== "holds") starScene.nations(clusterPlan, []);
    }
    lensCounts = null;
    lensFit = !!lens && lens !== "holds";
    if (scale === "cluster") void askNations();
  };
  clusterPanel.lenses.onLens = (lens) => setLens(lens);
  exposed.starLens = () =>
    scale === "cluster" && clusterPlan
      ? {
          lens: clusterPanel.lenses.lens,
          marks: lensCounts?.marks ?? 0,
          lines: lensCounts?.lines ?? 0,
          note: lensCounts?.note ?? null,
        }
      : null;
  const selectStar = (i: number | null) => {
    starScene.mark(i, clusterPlan);
    const s = i === null ? undefined : clusterPlan?.stars[i];
    if (s) void pageWindow.open(s.ref);
    else {
      pageWindow.close();
      void clusterPanel.select(null);
    }
  };
  const toCluster = async () => {
    // (However it was come to, from a village or a land too, only the stars show.)
    if (scale === "village") leaveScale();
    region.visible = false;
    regionPanel.visible = false;
    scale = "cluster";
    stage.backdrop("space");
    globe.visible = false;
    planetPanel.visible = false;
    skyScene.visible = false;
    systemPanel.visible = false;
    if (!clusterPlan) {
      clusterPlan = await client.query<ClusterPlan>({ type: "galaxy.cluster" });
      starScene.build(clusterPlan);
    }
    // (A star with a world unmade, on the map from then on: W6.)
    starScene.scars(
      clusterPlan,
      (await client.query<{ stars: number[] }>({ type: "far.scars" })).stars,
    );
    await askNations();
    clusterPanel.show(clusterPlan);
    // (Come here other than by the home star's system: the sky watched from here too.)
    if (!stopSky) watchSky();
    starScene.mark(null, clusterPlan);
    starScene.visible = true;
    clusterPanel.visible = true;
    time.at("cluster", clusterPanel.timeSlot);
    rig.configure({
      // (As far out as anyone holds a world, once anyone does: what is held is what there is to read.)
      distance:
        ((nationNow?.stars.length
          ? heldReach(
              clusterPlan,
              nationNow.stars.map((s) => s.star),
            )
          : clusterPlan.radius) *
          0.3 *
          2.8) /
        Math.min(1, aspect()),
      minDistance: 1,
      maxDistance: 200,
      pitch: -30,
      minPitch: -89,
      maxPitch: 60,
      drift: drift(1),
      target: [0, 0, 0],
    });
  };
  systemPanel.onStars = () => void toCluster();
  systemPanel.onPage = (ref) => pageWindow.open(ref);
  clusterPanel.onSelect = (i) => starScene.mark(i, clusterPlan);
  clusterPanel.onBack = () => {
    starScene.visible = false;
    clusterPanel.visible = false;
    void toSystem();
  };
  exposed.stars = () => void toCluster();
  exposed.starOnScreen = (ref: string) => {
    const i = clusterPlan?.stars.findIndex((s) => s.ref === ref) ?? -1;
    return scale === "cluster" && i >= 0 ? starScene.starOnScreen(i) : null;
  };
  exposed.starCount = () => (scale === "cluster" && clusterPlan ? clusterPlan.stars.length : 0);
  systemPanel.onSelect = (i) => skyScene.mark(i);
  // Down to a world of the system: made whole on the host (a moment), painted, turned.
  const worldPanel = new WorldPanel(hud);
  let seen: WorldGlobe | null = null,
    seenAt = -1;
  /** Whether a land is of another body (lands past the home world's own are its offworld sites). */
  const isColonyLand = (cell: number) => cell >= landsOfHome();
  /** How many lands the home world has of its own, as its globe was first sent. */
  const landsOfHome = () => {
    const frame = client.latestFrame("globe"),
      p = frame?.arrays.province as Int32Array | undefined;
    if (!p) return Infinity;
    if (homeLands === 0) for (const c of p) homeLands = Math.max(homeLands, c + 1);
    return homeLands;
  };
  let homeLands = 0;
  /** A colony's town, by its ref (they are numbered apart: host/colony.ts). */
  const colonyRef = (ref: string) => ref.startsWith("town:1:") || Number(ref.split(":")[1]) >= 1000;
  /** Whether the scale shown stands on a colony's ground. */
  const onColony = () =>
    (scale === "region" && isColonyLand(regionCell)) ||
    (scale === "village" && !!plan && colonyRef(plan.ref)) ||
    (scale === "camp" && !!near?.info.native);
  /** A land's sky over it, once it is known. */
  const colonySkyOver = async (cell: number) => {
    const c = await client.query<{ look: ColonyLook | null; voyage: ColonyVoyage | null }>({
      type: "colony.look",
      args: { cell },
    });
    if (c.look && scale === "region" && regionCell === cell) stage.colonySky(colonySky(c.look));
  };
  /** The sky's clock while a crossing is filmed (Phase 64); null: the world's. */
  let skyFilmed: number | null = null;
  /** A colony's landing watched (Phase 64). */
  let colonyFilm: ColonyFilm | null = null;
  /** A fight among the stars watched (Phase 67). */
  let fleetFilm: FleetFilm | null = null;
  let directorNation: ((event: string) => Promise<void>) | null = null;
  let directorJump: (() => Promise<boolean>) | null = null;
  let directorFar: ((event: string) => Promise<boolean>) | null = null;
  /** Every scale put away, for a film or a list to go on from. */
  const allAway = () => {
    leaveScale();
    stopVillages?.();
    stopVillages = null;
    villages = [];
    landPlan = null;
    labels.clear();
    bubbles.clear();
    globe.visible = false;
    planetPanel.visible = false;
    region.visible = false;
    regionPanel.visible = false;
    village.visible = false;
    villagePanel.visible = false;
    plan = null;
    worldScene.visible = false;
    worldPanel.visible = false;
    seen = null;
    skyScene.visible = false;
    systemPanel.visible = false;
    starScene.visible = false;
    clusterPanel.visible = false;
    galaxyScene.visible = false;
    galaxyPanel.visible = false;
  };
  /** Down to a colony's town, from anywhere. */
  const toColonyTown = async (cell: number, ref: string) => {
    allAway();
    regionCell = cell;
    await toVillage(ref);
  };
  /** A people's own world seen whole, from anywhere (Phase 69). */
  const toFolkWorld = async (star: string, index: number) => {
    allAway();
    regionCell = -1;
    folkFilmedAt = null;
    stage.colonySky(null);
    client.setInterest({ view: "globe", focus: null });
    stage.backdrop("space");
    const page = await client.query<StarPage>({ type: "galaxy.star", args: { ref: star } });
    skyStar = page;
    await toForeignWorld(page, index, "star");
  };
  /** Down to a people on its own world: its camp, or its town (ruins: what stood); read at a year, or now. */
  const toFolk = async (star: string, index: number, at?: number) => {
    const info = await client.query<FolkNear | null>({
      type: "folk.near",
      args: { star, index, ...(at !== undefined ? { at } : {}) },
    });
    if (!info) return null;
    allAway();
    regionCell = -1;
    folkFilmedAt = at ?? null;
    if (info.camp) await toCamp(-1, 0, info.camp);
    else await toVillage(info.town!);
    return info;
  };
  exposed.toFolk = toFolk;
  /** Those who came, on a people's ground, a film's while. */
  let campComers: VisitorsLayer | null = null;
  const goDownToFolk = (star: string, index: number) => {
    pageWindow.close();
    void fadeOver(() => ready("their ground", () => toFolk(star, index).then(() => {}), true));
  };
  worldPanel.onFolk = goDownToFolk;
  pageWindow.onFolk = goDownToFolk;
  const playMeeting = (star: string, index: number) => {
    pageWindow.close();
    void contactFilm?.play(star, index);
  };
  worldPanel.onMeeting = playMeeting;
  pageWindow.onMeeting = playMeeting;
  /** A first meeting watched (Phase 69). */
  let contactFilm: ContactFilm | null = null;
  /** A landing on a world of natives watched (Phase 70). */
  let landfallFilm: LandfallFilm | null = null;
  const playLandfall = (star: string, index: number, n = 0) => {
    pageWindow.close();
    void landfallFilm?.play(star, index, n);
  };
  worldPanel.onLandfall = playLandfall;
  pageWindow.onFolkLandfall = playLandfall;
  /** A colony's world seen whole, from anywhere. */
  const toWorldOfColony = async (c: ColonyEntry) => {
    allAway();
    regionCell = -1;
    stage.backdrop("space");
    if (c.star !== null && c.planet !== null) {
      const page = await client.query<StarPage>({ type: "galaxy.star", args: { ref: c.star } });
      skyStar = page;
      await toForeignWorld(page, c.planet, "star");
      await showForeignHalls(c);
      return;
    }
    systemPlan ??= await client.query<SystemPlan>({ type: "planet.system" });
    watchSky();
    sky = await client.query<SkyState>({ type: "space.state" });
    skyStar = null;
    worldFrom = "system";
    worldPanel.backTo = "The sky";
    await toWorld(c.bodyIndex);
  };
  /** Down to a colony's land, from anywhere. */
  const toColonyLand = (cell: number) => {
    allAway();
    return toRegion(cell);
  };
  /** Out to a colony's world seen whole, its halls turned to. */
  const toColonyWorld = async (cell: number) => {
    const list = await client.query<ColonyEntry[]>({ type: "colony.list" }),
      c = list.find((x) => x.cell === cell);
    if (!c) return;
    stopVillages?.();
    stopVillages = null;
    villages = [];
    landPlan = null;
    region.visible = false;
    regionPanel.visible = false;
    labels.clear();
    bubbles.clear();
    regionCell = -1;
    client.setInterest({ view: "globe", focus: null });
    stage.backdrop("space");
    if (c.star !== null && c.planet !== null) {
      const page = await client.query<StarPage>({ type: "galaxy.star", args: { ref: c.star } });
      skyStar = page;
      await toForeignWorld(page, c.planet, "star");
      await showForeignHalls(c);
      return;
    }
    systemPlan ??= await client.query<SystemPlan>({ type: "planet.system" });
    watchSky();
    sky = await client.query<SkyState>({ type: "space.state" });
    skyStar = null;
    worldFrom = "system";
    worldPanel.backTo = "The sky";
    await toWorld(c.bodyIndex);
  };
  /** Halls on a world of another star's (Phase 64): its colony's, from the list of them. */
  const showForeignHalls = async (c: ColonyEntry) => {
    const { look } = await client.query<{ look: ColonyLook | null }>({
      type: "colony.look",
      args: { cell: c.cell },
    });
    if (!look) return;
    worldScene.setHalls([{ cell: look.hall, domes: hallDomes(c.people) }]);
    hallsShown = [
      {
        ref: `cell:0:${c.cell}`,
        label: `🏛️ The halls of ${c.founder ?? c.realm ?? "a fallen realm"}`,
        people: c.people,
        cell: c.cell,
      },
    ];
    const hall = worldScene.hallsAt[0];
    if (hall) {
      rig.halt();
      rig.yaw = (Math.atan2(hall.x, hall.z) * 180) / Math.PI;
      rig.pitch = (-Math.asin(hall.y) * 180) / Math.PI;
    }
    worldPanel.foreignHalls(
      c.cell,
      `${c.people.toLocaleString("en")} people, since ${c.founded}${c.realm ? ` — of ${c.realm}` : " — their own"}`,
    );
  };
  exposed.planNow = () => plan;
  exposed.townLots = () => {
    const t = plan?.town;
    if (!t) return null;
    const s = lotStates(t),
      at = now();
    let fallen = 0,
      homes = 0;
    for (let p = 0; p < t.lots; p++) {
      if (s.what[p] === LOT.fallen || s.what[p] === LOT.razed) fallen++;
      else if (s.what[p] === LOT.home && progress(s.began[p]!, s.takes[p]!, at) >= 1) homes++;
    }
    return {
      fallen,
      homes,
      lots: t.lots,
      civics: t.civics.filter((c) => c.fell === null || c.fell === undefined).length,
    };
  };
  exposed.closePage = () => pageWindow.close();
  exposed.watched = () => watched;
  exposed.reloadPlan = () => (plan ? loadPlan(plan.ref) : Promise.resolve());
  const toWorld = async (index: number) => {
    if (!systemPlan) return;
    const body = systemPlan.bodies[index]!,
      w = await client.query<WorldGlobe>({ type: "world.globe", args: { ref: body.ref } });
    scale = "world";
    seen = w;
    seenAt = index;
    // (A world of the home star's: back leads to its sky.)
    worldFrom = "system";
    skyScene.visible = false;
    systemPanel.visible = false;
    showWorld(w);
    showHalls(index, w);
    // (Its halls, if it has any, turned to: what was seen from the sky is seen closer.)
    const hall = worldScene.hallsAt[0];
    if (hall) {
      rig.halt();
      rig.yaw = (Math.atan2(hall.x, hall.z) * 180) / Math.PI;
      rig.pitch = (-Math.asin(hall.y) * 180) / Math.PI;
    }
    worldPanel.show(systemPlan, index, w, sky);
    worldPanel.visible = true;
    void showFilled(w, { star: null, planet: -1, body: index });
    time.at("world", worldPanel.timeSlot);
  };
  // Halls from orbit (M95): a body of the home star's seen whole shows the halls set down on
  // it, where the view places each site, its domes as many as its people, its lights aglow.
  let hallsShown: { ref: string; label: string; people: number; cell: number }[] = [],
    hallsNamed = false;
  const showHalls = (index: number, w: WorldGlobe) => {
    const here = (sky?.colonies ?? []).filter((c) => c.body === index),
      cells = hallCells(w.frequency, w.cover);
    worldScene.setHalls(
      here.map((c) => ({ cell: cells[c.site % cells.length]!, domes: hallDomes(c.people) })),
    );
    hallsShown = here.map((c) => ({
      ref: `cell:0:${c.cell}`,
      label: `🏛️ The halls of ${c.founder ?? c.realm ?? "a fallen realm"}`,
      people: c.people,
      cell: c.cell,
    }));
  };
  /** The land of the halls drawn nearest a point of the screen, of those facing the eye; or the only ones. */
  const hallsNearest = (x: number, y: number): number | null => {
    if (scale !== "world" || !hallsShown.length) return null;
    let best: number | null = null,
      bestD = Infinity;
    worldScene.screenOf(worldScene.hallsAt, 1.02).forEach((at, i) => {
      const d = Math.hypot(at.x - x, at.y - y);
      if (at.facing > 0 && d < bestD && hallsShown[i]) {
        bestD = d;
        best = hallsShown[i]!.cell;
      }
    });
    return best ?? hallsShown[0]!.cell;
  };
  exposed.hallsShown = () => (scale === "world" ? hallsShown.length : 0);
  /** The halls drawn nearest a point of the screen, within a finger's reach; or null. */
  const hallAt = (x: number, y: number): string | null => {
    if (scale !== "world" || !hallsShown.length) return null;
    let best: string | null = null,
      bestD = 26;
    worldScene.screenOf(worldScene.hallsAt, 1.02).forEach((at, i) => {
      const d = Math.hypot(at.x - x, at.y - y);
      if (at.facing > 0.1 && d < bestD && hallsShown[i]) {
        bestD = d;
        best = hallsShown[i]!.ref;
      }
    });
    return best;
  };
  /** A tap on a world seen whole: its halls (their page), else the spot of it tapped. */
  const tapWorld = (x: number, y: number) => {
    const hall = hallAt(x, y);
    if (hall) void pageWindow.open(hall);
    else if (seen) worldPanel.cell(seen, worldScene.pick(x, y));
  };
  stage.onUpdate(() => {
    if (scale !== "world") return;
    const named = hallsShown.length
      ? worldScene.screenOf(worldScene.hallsAt, 1.04).flatMap((at, i) =>
          at.facing > 0.12 && hallsShown[i]
            ? [
                {
                  key: hallsShown[i]!.ref,
                  text: hallsShown[i]!.label,
                  at: { x: at.x, y: at.y },
                  priority: hallsShown[i]!.people,
                },
              ]
            : [],
        )
      : [];
    if (named.length || hallsNamed) labels.update(named);
    hallsNamed = named.length > 0;
  });
  // A world's settled ground (Worlds filled): its cells in the order they fill, and how many of them now. Read again every
  // few seconds while it is looked at, and drawn again only when the share has moved, so the lights spread as years pass.
  let fillShown: {
    w: WorldGlobe;
    where: { star: string | null; planet: number; body: number };
    order: Int32Array | null;
    plan: FillPlan;
    at: number;
    drawn: number;
  } | null = null;
  const drawFilled = (f: NonNullable<typeof fillShown>) => {
    const lit = filledCells(f.order!, f.plan.share);
    f.drawn = f.plan.share;
    worldScene.setFilled(lit);
    const face = filledColors(worldColors(f.w, Math.floor(now() / YEAR)), lit);
    worldScene.paint(
      f.w.burned || f.w.scarred ? farFace(face, f.w, f.w.burned ? 1 : 0, !!f.w.scarred) : face,
    );
  };
  const showFilled = async (
    w: WorldGlobe,
    where: { star: string | null; planet: number; body: number },
  ) => {
    fillShown = null;
    worldScene.setFilled([]);
    const plan = await client.query<FillPlan | null>({ type: "filled.world", args: where });
    if (!plan || seen !== w || w.kind === "giant" || w.kind === "ice giant") return;
    worldPanel.filling(plan.head, () => void pageWindow.open(plan.ref));
    if (plan.sailing) return;
    const starts = hallCells(w.frequency, w.cover).slice(0, 3);
    fillShown = {
      w,
      where,
      order: settleOrder(w, starts, plan.sea),
      plan,
      at: performance.now(),
      drawn: -1,
    };
    drawFilled(fillShown);
  };
  stage.onUpdate(() => {
    if (scale !== "world" || !fillShown || performance.now() - fillShown.at < 4000) return;
    const f = fillShown;
    f.at = performance.now();
    void client
      .query<FillPlan | null>({ type: "filled.world", args: f.where })
      .then((plan) => {
        if (!plan || fillShown !== f) return;
        f.plan = plan;
        worldPanel.filling(plan.head, () => void pageWindow.open(plan.ref));
        if (Math.abs(plan.share - f.drawn) > 0.002) drawFilled(f);
      })
      .catch(() => {});
  });
  /** Out to a world by the event that told of its filling (a tiding, the Director's first). */
  const seeFilledEvent = async (ref: string): Promise<boolean> => {
    const plan = await client
      .query<FillPlan | null>({ type: "filled.ofEvent", args: { ref } })
      .catch(() => null);
    if (!plan) return false;
    return seeFilled(plan);
  };
  /** Out to a world being filled, from anywhere. */
  const seeFilled = async (plan: FillPlan): Promise<boolean> => {
    allAway();
    stage.backdrop("space");
    client.setInterest({ view: "globe", focus: null });
    if (plan.star) {
      const page = await client.query<StarPage>({ type: "galaxy.star", args: { ref: plan.star } });
      skyStar = page;
      await toForeignWorld(page, plan.planet, "star");
      return true;
    }
    systemPlan ??= await client.query<SystemPlan>({ type: "planet.system" });
    watchSky();
    sky = await client.query<SkyState>({ type: "space.state" });
    skyStar = null;
    worldFrom = "system";
    worldPanel.backTo = "The sky";
    await toWorld(plan.body);
    return true;
  };
  exposed.seeFilled = (key: string) =>
    client
      .query<FillPlan[]>({ type: "filled.list" })
      .then((l) => l.find((p) => p.key === key) ?? null)
      .then((p) => (p ? seeFilled(p) : false));
  exposed.fillShown = () =>
    fillShown
      ? {
          key: fillShown.plan.key,
          share: fillShown.plan.share,
          lit: filledCells(fillShown.order!, fillShown.plan.share).length,
          cells: fillShown.order!.length,
        }
      : null;
  /** A world made whole, drawn and turned to (every other scale and its panel put away). */
  const showWorld = (w: WorldGlobe) => {
    hallsShown = [];
    fillShown = null;
    globe.visible = false;
    planetPanel.visible = false;
    region.visible = false;
    regionPanel.visible = false;
    village.visible = false;
    villagePanel.visible = false;
    skyScene.visible = false;
    systemPanel.visible = false;
    worldScene.build(w.frequency, w.elevation);
    // (A glow about the rim where there is air enough to glow; clouds where it carries them —
    // a giant's bands are its clouds.)
    const airy = w.air !== "none" && w.air !== "trace",
      giant = w.kind === "giant" || w.kind === "ice giant";
    worldScene.features(
      w.water === "seas",
      airy,
      stage.quality.clouds &&
        !giant &&
        (w.air === "thick" || w.air === "crushing" || w.air === "breathable"),
    );
    worldScene.paint(worldColors(w, Math.floor(now() / YEAR)));
    worldScene.visible = true;
    rig.configure({
      distance: globeFit(),
      minDistance: 1.35,
      maxDistance: 12,
      pitch: -18,
      minPitch: -80,
      maxPitch: 80,
      drift: drift(),
      target: [0, 0, 0],
    });
  };
  systemPanel.onVisit = (i) => {
    // (Another star's world, from its own system; else one of the home star's.)
    if (skyStar) {
      void toForeignWorld(skyStar, i, "star");
      return;
    }
    worldFrom = "system";
    worldPanel.backTo = "The sky";
    void toWorld(i);
  };
  // Where a world seen whole was come to from: back leads there.
  let worldFrom: "system" | "cluster" | "galaxy" | "star" = "system";
  worldPanel.onBack = () => {
    worldScene.visible = false;
    worldPanel.visible = false;
    seen = null;
    if (worldFrom === "galaxy") void toGalaxy();
    else if (worldFrom === "cluster") void toCluster();
    else if (worldFrom === "star" && skyStar) void toStarSystem(skyStar);
    else void toSystem();
  };
  /**
   * Another star's own system (M95), as the home star's is shown: its worlds on their orbits,
   * each tapped for its page and gone to, seen whole; back, the stars about it.
   */
  const toStarSystem = async (star: StarPage) => {
    const plan = await client.query<SystemPlan>({
      type: "galaxy.system",
      args: { ref: star.ref },
    });
    if (scale === "village") leaveScale();
    scale = "system";
    stage.backdrop("space");
    labels.clear();
    bubbles.clear();
    for (const hide of [globe, starScene, galaxyScene, worldScene, region]) hide.visible = false;
    for (const hide of [planetPanel, clusterPanel, galaxyPanel, worldPanel, regionPanel])
      hide.visible = false;
    skyScene.build(plan);
    skyBuilt = star.ref;
    skyPlan = plan;
    skyStar = star;
    // (Our sky's news is of our star: not read while another's is shown.)
    stopSky?.();
    stopSky = null;
    // (The peoples about it are: read while it is shown, and no longer.)
    stopStarPeoples?.();
    starPeoples = null;
    stopStarPeoples = client.subscribe<PeoplesSky | null>({ type: "peoples.sky" }, 1000, (p) => {
      if (scale !== "system" || !skyStar) {
        stopStarPeoples?.();
        stopStarPeoples = null;
        return;
      }
      starPeoples = p;
    });
    systemPanel.show(plan, true);
    skyScene.mark(null);
    skyScene.visible = true;
    systemPanel.visible = true;
    time.at("system", systemPanel.timeSlot);
    rig.configure({
      distance: (systemExtent(plan) * 2.9) / Math.min(1, aspect()),
      minDistance: 2,
      maxDistance: 400,
      pitch: -60,
      minPitch: -89,
      maxPitch: -10,
      drift: drift(0.6),
      target: [0, 0, 0],
    });
  };
  exposed.starSystem = (ref: string) =>
    void client
      .query<StarPage>({ type: "galaxy.star", args: { ref } })
      .then((page) => toStarSystem(page));
  /** Another star's world, made whole and shown. */
  const toForeignWorld = async (
    star: StarPage,
    index: number,
    from: "cluster" | "galaxy" | "star",
    stood = false,
  ) => {
    const w = await client.query<WorldGlobe>({
      type: "world.globe",
      args: { star: star.ref, index },
    });
    scale = "world";
    seen = w;
    seenAt = index;
    worldFrom = from;
    starScene.visible = false;
    clusterPanel.visible = false;
    galaxyScene.visible = false;
    galaxyPanel.visible = false;
    showWorld(w);
    // (What fell on it stays: W6. A film of it begins from how it stood.)
    if (!stood && w.unmade) worldScene.ruin(true);
    else if (!stood && (w.burned || w.scarred)) {
      worldScene.blacken(!!w.burned);
      worldScene.paint(
        farFace(worldColors(w, Math.floor(now() / YEAR)), w, w.burned ? 1 : 0, !!w.scarred),
      );
    }
    worldPanel.backTo =
      from === "galaxy" ? "The galaxy" : from === "star" ? "Its star" : "The stars around";
    worldPanel.showForeign(star, index, w, Math.floor(now() / YEAR));
    worldPanel.visible = true;
    time.at("world", worldPanel.timeSlot);
    void showFilled(w, { star: star.ref, planet: index, body: -1 });
  };
  // Out to the whole galaxy: its disk drawn from its own numbers, tapped for the stars there.
  const galaxyPanel = new GalaxyPanel(hud, client);
  let galaxyPlan: GalaxyPlan | null = null,
    galaxyDrawn = "";
  const GALAXY_STARS = { low: 6000, balanced: 15000, high: 30000, ultra: 50000 } as const;
  const toGalaxy = async () => {
    galaxyPlan ??= await client.query<GalaxyPlan>({ type: "galaxy.plan" });
    scale = "galaxy";
    // (The names of the stars around: nothing here draws over them.)
    labels.update([]);
    stage.backdrop("space");
    globe.visible = false;
    planetPanel.visible = false;
    starScene.visible = false;
    clusterPanel.visible = false;
    skyScene.visible = false;
    systemPanel.visible = false;
    if (galaxyDrawn !== stage.quality.name) {
      galaxyScene.build(galaxyPlan, GALAXY_STARS[stage.quality.name]);
      galaxyDrawn = stage.quality.name;
    }
    galaxyScene.mark(null);
    {
      const scars = await client.query<{ at: { x: number; y: number }[] }>({ type: "far.scars" }),
        home = homeOf(galaxyPlan);
      galaxyScene.scars(
        scars.at.map((s) => ({ x: home.x + s.x / 1000, z: home.z + s.y / 1000 })),
        galaxyPlan.radius / 1000 / 14,
      );
    }
    galaxyScene.visible = true;
    galaxyPanel.show(galaxyPlan);
    galaxyPanel.visible = true;
    time.at("galaxy", galaxyPanel.timeSlot);
    const R = galaxyPlan.radius / 1000;
    rig.configure({
      distance: (R * 2.3) / Math.min(1, aspect()),
      minDistance: 2,
      maxDistance: R * 6,
      pitch: -55,
      minPitch: -89,
      maxPitch: -5,
      drift: drift(0.4),
      target: [0, 0, 0],
    });
  };
  const tapGalaxy = (x: number, y: number) => {
    if (!galaxyPlan) return;
    const at = galaxyScene.pick(x, y);
    if (!at) return;
    galaxyScene.mark(at, galaxyPlan.radius / 1000 / 40);
    const from = lyFromHome(galaxyPlan, at.x, at.z);
    void galaxyPanel.near(from.x, from.y);
  };
  galaxyPanel.onStar = (s) => {
    if (!galaxyPlan || !s) return;
    const home = homeOf(galaxyPlan);
    galaxyScene.mark(
      { x: home.x + s.x / 1000, z: home.z + s.y / 1000 },
      galaxyPlan.radius / 1000 / 80,
    );
  };
  galaxyPanel.onVisit = (star, i) => void toForeignWorld(star, i, "galaxy");
  galaxyPanel.onBack = () => {
    galaxyScene.visible = false;
    galaxyPanel.visible = false;
    void toCluster();
  };
  clusterPanel.onGalaxy = () => void toGalaxy();
  clusterPanel.onPeoples = () => void pageWindow.open("world:peoples");
  clusterPanel.onLaw = () => void pageWindow.open("world:law");
  planetPanel.onLaw = () => void pageWindow.open("world:law");
  clusterPanel.onVisit = (star, i) => void toForeignWorld(star, i, "cluster");
  // One zoom (M88): pushing on past a scale's nearest or farthest view goes through to the
  // next — out from a village to its land, the world, its sky, the stars about it and the
  // galaxy; in again to the land and the village under the middle of the screen — each
  // readied ahead as the view nears its edge, a quick fade over the swap, and a word on the
  // screen only while a scale is still being readied (at once, on a phone, for the heavy ones).
  const readying = document.createElement("div"),
    swap = document.createElement("div"),
    edgeHint = document.createElement("div");
  readying.className = "readying";
  readying.hidden = true;
  swap.className = "swap";
  edgeHint.className = "edge-hint";
  edgeHint.style.opacity = "0";
  hud.append(swap, readying, edgeHint);
  const ready = async <T>(what: string, work: () => Promise<T> | T, heavy = false): Promise<T> => {
    const say = () => {
      readying.textContent = `Readying ${what}…`;
      readying.hidden = false;
    };
    const late = setTimeout(say, heavy && tier.name === "phone" ? 0 : 160);
    // (The world waits while the eye goes to another scale: else it runs on at the pace of the
    // scale left for as long as the next takes to ready — on a slow machine, years from the
    // globe, the morning gone dark and what was gone to see come and gone.)
    time.hold("readying");
    try {
      return await work();
    } finally {
      clearTimeout(late);
      readying.hidden = true;
      time.release("readying");
    }
  };
  const fadeOver = async (swapNow: () => Promise<void> | void) => {
    swap.classList.add("on");
    await new Promise((r) => setTimeout(r, 90));
    try {
      await swapNow();
    } finally {
      requestAnimationFrame(() => swap.classList.remove("on"));
    }
  };
  /** Turn the globe to a spot of its fine grid, from so far off. */
  const faceSpot = (spot: number, distance?: number) => {
    const frame = client.latestFrame("globe");
    if (!frame) return;
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions;
    rig.halt();
    rig.yaw = (Math.atan2(p[spot * 3]!, p[spot * 3 + 2]!) * 180) / Math.PI;
    rig.pitch = (-Math.asin(p[spot * 3 + 1]!) * 180) / Math.PI;
    if (distance) {
      rig.userZoomed = true;
      rig.distance = distance;
    }
  };
  /**
   * Readied ahead, as the view nears the far edge of the world, its sky or the stars: the
   * next scale out only (built as its own scale would build it), and never nearer in, where
   * the land and the village are drawn.
   */
  let aheadBusy = false;
  const readyAhead = () => {
    if (aheadBusy) return;
    const next =
      scale === "globe" && !systemPlan
        ? async () => {
            systemPlan = await client.query<SystemPlan>({ type: "planet.system" });
            skyScene.build(systemPlan);
            skyBuilt = "home";
          }
        : scale === "system" && !clusterPlan
          ? async () => {
              clusterPlan = await client.query<ClusterPlan>({ type: "galaxy.cluster" });
              starScene.build(clusterPlan);
            }
          : scale === "cluster" && !galaxyPlan
            ? async () => {
                galaxyPlan = await client.query<GalaxyPlan>({ type: "galaxy.plan" });
              }
            : null;
    if (!next) return;
    aheadBusy = true;
    void next().finally(() => {
      aheadBusy = false;
    });
  };
  const OUT_TO: Partial<Record<string, string>> = {
      village: "its land",
      camp: "its land",
      region: "the world",
      globe: "the sky",
      system: "the stars about us",
      cluster: "the galaxy",
      world: "where you came from",
    },
    IN_TO: Partial<Record<string, string>> = {
      galaxy: "the stars about us",
      cluster: "the star under the pointer",
      system: "the world under the pointer",
      globe: "the land under the pointer",
      region: "the village nearest the pointer",
    };
  stage.onUpdate(() => {
    const edge = rig.edge,
      // (A land of bands with no village yet goes in among a camp's.)
      inTo =
        scale === "region" && !villages.length && landPlan?.camps.length
          ? "the camp nearest the pointer"
          : IN_TO[scale],
      next = edge > 0 ? OUT_TO[scale] : edge < 0 ? inTo : undefined;
    if (edge > 0.6) readyAhead();
    // At an edge with somewhere to go: say so.
    const show = !!next && Math.abs(edge) > 0.97;
    edgeHint.textContent = next ? `${edge > 0 ? "Zoom on out" : "Zoom on in"} to ${next}` : "";
    edgeHint.style.opacity = show ? String(0.55 + 0.45 * rig.pushing) : "0";
  });
  // Out from the world, the sky's view follows the home world round its orbit while it is
  // close, and eases onto the star as it draws back.
  let followHome = false;
  stage.onUpdate(() => {
    if (scale !== "system" || !systemPlan || skyStar || !followHome) return;
    const home = systemSpec(systemPlan, now())[0]!,
      k = Math.max(0, Math.min(1, (rig.distance - 4) / 30));
    rig.target.set(home.x * (1 - k), 0, home.z * (1 - k));
    if (k >= 1) followHome = false;
  });
  let through = false;
  /**
   * A battle by fire on a tall screen: how far down the eye looks (degrees); the ground each unit of distance
   * shows along the line of sight below the town's bar, its hosts' depth taken in by counting the gap 2.4 times;
   * and how far past the fight's middle to aim, so its near host is not cut off by the screen's foot
   * (a field of view of 45 degrees, the bar a quarter of the screen: 0.41 behind the aim, 0.33 ahead of it).
   */
  const FIRE_VIEW = { pitch: -30, off: 40, most: 36, ground: 0.75, below: -0.02 } as const;
  /**
   * The eye on a battle fought before the town (Phase 55 M227): from its side, a little behind the
   * attackers' line — the two lines and where they meet, the town beyond — some hundred metres off,
   * so the clash is drawn in full (render/battle.ts LOD); on a narrow screen (a phone held upright)
   * drawn back till some fifty-five metres about the clash fill its width. (Its side nearer the
   * eye: the short turn.)
   */
  const placedView = (frame: PlacedFrame, meet: number, span = 0) => {
    const m = placedPoint(frame, meet, 0);
    // (Two hosts that stand apart to fight, on a tall screen: seen from over the attackers, both in the picture and
    // neither a speck, the fight's middle in the middle of what the town's bar leaves of the screen (W1b); and off their
    // line of fire, since from straight behind a man lying down looks like a man standing with a pole (W1c).)
    if (span > 0 && aspect() < 1) {
      const distance = Math.min(
          FIRE_VIEW.most,
          Math.max(14, (span * 2.4 * VILLAGE_METRE) / FIRE_VIEW.ground),
        ),
        ahead = FIRE_VIEW.below * distance;
      return {
        target: {
          x: (m.x + (frame.ux * ahead) / VILLAGE_METRE) * VILLAGE_METRE,
          y: 0,
          z: (m.z + (frame.uz * ahead) / VILLAGE_METRE) * VILLAGE_METRE,
        },
        yaw: (Math.atan2(-frame.ux, -frame.uz) * 180) / Math.PI + FIRE_VIEW.off,
        pitch: FIRE_VIEW.pitch,
        distance,
      };
    }
    const here = (rig.yaw * Math.PI) / 180,
      side = -frame.uz * Math.sin(here) + frame.ux * Math.cos(here) >= 0 ? 1 : -1,
      back = (25 * Math.PI) / 180,
      dx = -side * frame.uz * Math.cos(back) - frame.ux * Math.sin(back),
      dz = side * frame.ux * Math.cos(back) - frame.uz * Math.sin(back);
    return {
      target: { x: m.x * VILLAGE_METRE, y: 0, z: m.z * VILLAGE_METRE },
      yaw: (Math.atan2(dx, dz) * 180) / Math.PI,
      pitch: -28,
      distance: Math.max(
        Math.min(16, Math.max(10, 6.8 / aspect())),
        Math.min(30, (span * 1.35 * VILLAGE_METRE * Math.cos(back)) / (0.828 * aspect())),
      ),
    };
  };
  /** The view of a battle laid before a town: between its hosts where they stand apart to fight. */
  const placedViewOf = (P: { readonly frame: PlacedFrame; readonly field: BattleField }) =>
    placedView(P.frame, fieldMiddle(P.field), P.field.fire?.metres ?? 0);
  /** A village's view turned on its battle, the line where the hosts meet (M95). */
  const faceBattle = (): boolean => {
    // (Fought in place before it, Phase 55 M227: from its side.)
    const inPlace = scale === "village" && plan ? placed : null;
    if (inPlace) {
      const v = placedViewOf(inPlace);
      rig.halt();
      rig.target.set(v.target.x, 0, v.target.z);
      rig.yaw = v.yaw;
      rig.pitch = v.pitch;
      rig.distance = v.distance;
      rig.userZoomed = true;
      return true;
    }
    // (The night before it, its hosts drawn up by their fires before the town: between them.)
    const middles = scale === "village" && townWar?.eve ? village.warNow()?.scene.middles : null,
      hosts = middles?.filter((m): m is NonNullable<typeof m> => m !== null) ?? [];
    if (hosts.length) {
      rig.halt();
      rig.target.set(
        (hosts.reduce((s, m) => s + m.x, 0) / hosts.length) * VILLAGE_METRE,
        0,
        (hosts.reduce((s, m) => s + m.z, 0) / hosts.length) * VILLAGE_METRE,
      );
      rig.userZoomed = true;
      rig.distance = 12;
      return true;
    }
    const front = scale === "village" && plan ? battleFront(plan) : null;
    if (!front) return false;
    rig.target.set(front.x * VILLAGE_METRE, 0, front.z * VILLAGE_METRE);
    rig.userZoomed = true;
    // (Near enough to see each soldier: some ninety metres off.)
    rig.distance = 9;
    return true;
  };
  exposed.faceBattle = faceBattle;
  /** Where a point of the land (km) is on the screen now, a little above its ground (null: behind the eye). */
  const landOnScreen = (x: number, z: number, lift = 0.8) => {
    const s = stage.camera.camera!.worldToScreen(
      rig.target.clone().set(x, region.heightAt(x, z) + lift, z),
    );
    return s.z > 0 ? { x: s.x, y: s.y } : null;
  };
  const zoomThrough = async (way: "in" | "out") => {
    followHome = false;
    if (way === "out") {
      if (scale === "camp") await leaveCamp();
      else if (scale === "battle") await leaveBattle();
      else if (scale === "village") {
        const tile = villages.find((v) => v.ref === plan?.ref)?.tile;
        await fadeOver(() => villagePanel.onBack?.());
        // Low over the village, its land about it.
        const at = tile === undefined ? null : region.groundAt(tile);
        if (at) rig.target.set(at.x, at.y, at.z);
        rig.userZoomed = true;
        rig.distance = 18;
      } else if (scale === "region" && onColony()) {
        // (A colony's land: out to its world seen whole, its halls turned to.)
        await fadeOver(() => toColonyWorld(regionCell));
      } else if (scale === "region") {
        // Facing the spot the land's map was looked at, not only its middle.
        // (This land's map only: another's, not yet replaced, would face somewhere else.)
        const frame = client.latestFrame("region"),
          own = (frame?.meta as { center?: number } | undefined)?.center === regionCell,
          parent = own ? (frame?.arrays.parent as Int32Array | undefined) : undefined,
          looked = parent?.[region.tileAt(rig.target.x, rig.target.z)],
          spot = looked ?? centres.get(regionCell);
        await fadeOver(() => toGlobe());
        if (spot !== undefined) faceSpot(spot, 1.6);
      } else if (scale === "globe") {
        await fadeOver(() => ready("the sky", () => toSystem(), true));
        // Close on the home world (followed round its orbit), the rest of its system about it.
        followHome = true;
        rig.userZoomed = true;
        rig.distance = 3.2;
      } else if (scale === "system") {
        await fadeOver(() => ready("the stars about us", () => toCluster(), true));
        rig.userZoomed = true;
        rig.distance = 20;
        // (Out of another star's system: the stars about it, it in the middle.)
        const star = skyStar ? clusterPlan?.stars.find((x) => x.ref === skyStar!.ref) : undefined;
        if (star) rig.target.set(star.x * LY_SCALE, star.z * LY_SCALE, star.y * LY_SCALE);
      } else if (scale === "world") {
        await fadeOver(() => worldPanel.onBack());
      } else if (scale === "cluster") {
        await fadeOver(() => ready("the galaxy", () => toGalaxy(), true));
        if (galaxyPlan) {
          const home = homeOf(galaxyPlan);
          rig.target.set(home.x, 0, home.z);
        }
        rig.userZoomed = true;
        rig.distance = 70;
      }
    } else if (scale === "galaxy") {
      await fadeOver(() =>
        ready(
          "the stars about us",
          () => {
            galaxyScene.visible = false;
            galaxyPanel.visible = false;
            return toCluster();
          },
          true,
        ),
      );
      rig.userZoomed = true;
      rig.distance = 150;
    } else if (scale === "cluster") {
      // Into the star under the pointer: another's, its world seen whole; our own, our sky.
      const i = rig.pointer ? starScene.pick(rig.pointer.x, rig.pointer.y) : null,
        star = i === null ? undefined : clusterPlan?.stars[i];
      if (star && star.distance > 0 && star.planets > 0) {
        const page = await client.query<StarPage>({ type: "galaxy.star", args: { ref: star.ref } });
        await fadeOver(() => ready("its worlds", () => toStarSystem(page), true));
        return;
      }
      await fadeOver(() =>
        ready(
          "our sky",
          () => {
            starScene.visible = false;
            clusterPanel.visible = false;
            return toSystem();
          },
          true,
        ),
      );
      rig.userZoomed = true;
      rig.distance = 260;
    } else if (scale === "system") {
      // Into the world under the pointer: another of the system, seen whole; else our own.
      const i = rig.pointer ? skyScene.pick(rig.pointer.x, rig.pointer.y) : null;
      // (Another star's: the world under the pointer, else the nearest to the middle.)
      if (skyStar && skyPlan?.bodies.length) {
        const star = skyStar,
          at = i ?? skyScene.pick(innerWidth / 2, innerHeight / 2) ?? 0;
        await fadeOver(() => ready("that world", () => toForeignWorld(star, at, "star"), true));
        return;
      }
      if (i !== null && i > 0 && systemPlan?.bodies[i]) {
        worldFrom = "system";
        worldPanel.backTo = "The sky";
        await fadeOver(() => ready("that world", () => toWorld(i), true));
        return;
      }
      await fadeOver(() => {
        stopSky?.();
        stopSky = null;
        toGlobe();
      });
      rig.userZoomed = true;
      rig.distance = 10;
    } else if (scale === "globe") {
      // (Zoomed before the lands' first reading has come: asked for now, not a zoom that does nothing.)
      if (density.size === 0) {
        const entries = await client.query<PeopleEntry[]>({ type: "people.map" });
        centres = new Map(entries.map((e) => [e.cell, e.centre]));
        density = new Map(entries.map((e) => [e.cell, e.density]));
      }
      // Down into the land under the pointer (else the middle of the screen; the sea has
      // none), that spot of it in the middle.
      const frame = client.latestFrame("globe"),
        at = rig.aimed,
        len = at ? Math.hypot(at.x, at.y, at.z) || 1 : 1;
      let spot = !frame
          ? null
          : at
            ? nearestCell(
                sphereGrid((frame.meta as { frequency: number }).frequency),
                at.x / len,
                at.y / len,
                at.z / len,
              )
            : globe.pick(innerWidth / 2, innerHeight / 2),
        cell =
          spot === null || !frame
            ? null
            : ((frame.arrays.province as Int32Array | undefined)?.[spot] ?? null);
      // (Over the sea near a coast: the nearest land, a few spots off, is what was meant.)
      if ((cell === null || cell < 0) && spot !== null && frame) {
        const near = landNear(spot, frame);
        if (near) {
          spot = near.spot;
          cell = near.cell;
        }
      }
      if (cell === null || cell < 0 || !density.has(cell)) return;
      arriveAt = spot;
      await fadeOver(() => ready("the land", () => toRegion(cell)));
      rig.userZoomed = true;
      rig.distance = 150;
    } else if (scale === "region") {
      // Into the village nearest the pointer (else the middle of the screen).
      const aim = rig.pointer ?? { x: innerWidth / 2, y: innerHeight / 2 },
        on = region.screenOf(villages.map((v) => v.tile));
      let best = -1,
        bestD = Infinity;
      on.forEach((p, i) => {
        if (!p) return;
        const d = Math.hypot(p.x - aim.x, p.y - aim.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      // Zoomed in on a battle: down onto its field to watch it fought (Phase 37 M186) — or, while it
      // is fought, into the town it is fought before, facing it (Phase 55; asked for 2026-10-27: "i
      // meant open world warfare on town view not land view").
      const aimed = rig.aimed,
        focused = landBattleFocus?.cell === regionCell ? landBattleFocus.event : undefined,
        picked = regionWars.pick(aim.x, aim.y, 160, true, focused),
        near = picked || !aimed ? null : regionWars.battleNear(aimed.x, aimed.z, BATTLE_NEAR_KM),
        field = regionWars.pick(aim.x, aim.y, 90, true, focused);
      // (A battle fought now — from the night before it, its hosts drawn up by their fires, until
      // the beaten fly — before any past marked with it: its land's last was fought on the same field.)
      for (const f of regionWars.now?.fights ?? []) {
        const turn = Number(f.key.split(":").at(-1)),
          on = foughtNow(now(), turn) ? landOnScreen(f.x, f.z) : null,
          to =
            on && Math.hypot(on.x - aim.x, on.y - aim.y) < 90
              ? await townFoughtBefore(f.ref, turn)
              : null;
        if (to) {
          await toTownFight(to);
          return;
        }
      }
      if (field?.startsWith("ev:")) {
        await watchBattleWhere(field);
        return;
      }
      // Near enough it, its village, its view facing the fight: the town of its land it is fought
      // before (asked of the host — a slow machine may not have drawn this land's towns yet, and a
      // battle its map shows may be the next land's). Near enough: its mark within reach of the
      // pointer, or the ground zoomed toward nearer it than any town but that one (the mark goes
      // off the pointer as the eye closes in toward the ground beside it).
      const toward = picked ?? near?.ref ?? null,
        fought = toward?.startsWith("ev:")
          ? warsNow?.wars.flatMap((w) => w.battles).find((b) => b.event === toward)
          : undefined,
        globeFrame = fought ? client.latestFrame("globe") : null,
        land =
          fought && globeFrame
            ? ((globeFrame.arrays.province as Int32Array | undefined)?.[fought.spot] ?? -1)
            : -1,
        heart =
          land >= 0
            ? await client.query<string | null>({ type: "land.heart", args: { cell: land } })
            : null,
        townNearest = (but: string | null): number => {
          let d = Infinity;
          for (const v of villages) {
            const g = v.ref === but ? null : region.groundAt(v.tile);
            if (g && aimed) d = Math.min(d, Math.hypot(g.x - aimed.x, g.z - aimed.z));
          }
          return d;
        },
        war = picked ?? (near && heart && near.d < townNearest(heart) ? near.ref : null),
        battleTown = war?.startsWith("ev:") ? heart : null;
      // A band's camp under the pointer, nearer it than any village (Phase 29 M160): down among
      // them — not where a battle is zoomed into, nor a camp far off the pointer while a village
      // stands on the land.
      let camp = -1,
        campD = Infinity;
      if (!war)
        for (const [id, p] of region.land.camps.named(stage.camera.camera!)) {
          const d = p ? Math.hypot(p.x - aim.x, p.y - aim.y) : Infinity;
          if (d < campD) {
            campD = d;
            camp = id;
          }
        }
      if (camp >= 0 && campD < bestD && (best < 0 || campD < CAMP_REACH)) {
        await fadeOver(() => ready("the band", () => toCamp(regionCell, camp)));
        return;
      }
      // (Beside a battle on a land no town stands on, and no village in view: down onto its field,
      // the one thing there to be seen near, not nowhere.)
      if (best < 0 && !battleTown && war?.startsWith("ev:")) {
        await fadeOver(() => ready("the battle", () => toBattle(war)));
        return;
      }
      if (best < 0 && !battleTown) return;
      if (battleTown) regionCell = land;
      const ref = battleTown ?? villages[best]!.ref;
      await fadeOver(() => ready("the village", () => toVillage(ref)));
      if (war?.startsWith("ev:")) faceBattle();
    } else if (scale === "world") {
      // (Down to the land about its halls, if it has any under or near the pointer, Phase 64;
      // a world with none goes in no further.)
      const aim = rig.pointer ?? { x: innerWidth / 2, y: innerHeight / 2 },
        cell = hallsNearest(aim.x, aim.y);
      if (cell !== null) await fadeOver(() => ready("the land", () => toColonyLand(cell), true));
      return;
    }
  };
  // Free roam (Phase 10 M98): the camera flown where the viewer will — or walked, among a
  // village's people — above the ground and out of the walls, and on through the scales by
  // height, as zooming goes: up out of a village into its land and out to the world, down
  // out of the sky into the land below and into the village flown down to.
  const free = new FreeRig(stage, canvas),
    freeControls = new FreeControls(corner);
  let roaming: FreeMode = "orbit",
    passing = false;
  /** How the free camera moves at the scale shown. */
  const roamRules = (mode: FreeMode): FreeRules => {
    const M = VILLAGE_METRE;
    switch (scale) {
      case "village":
        // (Walking at a jog, Shift a run: a village is crossed in a minute, not five.)
        return mode === "walk"
          ? { speed: 4 * M, height: 5, clearance: 0.1 * M, walk: { eye: 1.7 * M } }
          : { speed: 5 * M, height: 25 * M, clearance: 1.5 * M };
      case "region":
        return { speed: 0.5, height: 8, clearance: 0.12 };
      case "camp":
      case "battle":
        // (The meadow's metres a tenth of a unit: at a run, as high as a tall tree's top or more.)
        return { speed: 0.6, height: 3.5, clearance: 0.05 };
      case "globe":
      case "world":
        // (As fast as it is high over the globe's face: its width crossed in a few seconds.)
        return {
          speed: 0.02,
          height: 0.15,
          clearance: 0,
          space: true,
          round: true,
          pace: (s) => Math.max(0.01, Math.hypot(s.x, s.y, s.z) - 1),
        };
      default:
        // The sky, the stars, the galaxy: as quick as the view is wide.
        return {
          speed: Math.max(0.05, rig.distance * 0.06),
          height: rig.distance * 0.5,
          clearance: 0,
          space: true,
        };
    }
  };
  const roamGround = (): ((x: number, z: number) => number | null) =>
    scale === "village"
      ? () => 0
      : scale === "region"
        ? (x, z) => region.heightAt(x, z)
        : () => null;
  const roamKeep = (mode: FreeMode): ((s: FreeState) => FreeState) | null => {
    if (scale === "village" && plan) {
      const ground = villageGround(plan),
        M = VILLAGE_METRE;
      // (Among the homes, out of their walls: walking, or flown as low as their roofs.)
      return (s) => {
        if (mode !== "walk" && s.y > 9 * M) return s;
        const p = { x: s.x / M, z: s.z / M };
        keepOut(ground, p, 0.4);
        return { ...s, x: p.x * M, z: p.z * M };
      };
    }
    if (scale === "globe" || scale === "world")
      return (s) => {
        // Off its face, and no farther than its sky (a world seen whole has no sky to go on to).
        const r = Math.hypot(s.x, s.y, s.z),
          k = r < 1.03 ? 1.03 / r : r > 16 ? 16 / r : 1;
        return k === 1 ? s : { ...s, x: s.x * k, y: s.y * k, z: s.z * k };
      };
    return null;
  };
  const setRoam = (asked: FreeMode, handBack = true) => {
    const mode: FreeMode = asked === "walk" && scale !== "village" ? "fly" : asked;
    if (mode === "orbit") {
      if (free.on && handBack) {
        // Handed back to the orbit: turning about where the free camera looks, from where it stood.
        const l = rig.limits,
          groundY = scale === "region" ? region.heightAt(free.state.x, free.state.z) : 0,
          round = scale === "globe" || scale === "world";
        if (round) {
          const s = free.state;
          rig.target.set(0, 0, 0);
          rig.yaw = (Math.atan2(s.x, s.z) * 180) / Math.PI;
          rig.pitch = Math.max(
            l.minPitch,
            Math.min(
              l.maxPitch,
              (-Math.asin(s.y / (Math.hypot(s.x, s.y, s.z) || 1)) * 180) / Math.PI,
            ),
          );
          rig.distance = Math.max(l.min, Math.min(l.max, Math.hypot(s.x, s.y, s.z)));
        } else {
          const o = orbitOf(free.state, groundY, l.max * 0.5);
          rig.target.set(o.target.x, o.target.y, o.target.z);
          rig.yaw = o.yaw;
          rig.pitch = Math.max(l.minPitch, Math.min(l.maxPitch, o.pitch));
          rig.distance = Math.max(l.min, Math.min(l.max, o.distance));
        }
        rig.userZoomed = true;
      }
      free.stop(passing);
      rig.enabled = true;
    } else {
      free.ground = roamGround();
      free.keep = roamKeep(mode);
      // (From the orbit's own place, not the camera lifted clear of the bar: over a globe that
      // lift is degrees of its face, and "up" would rise over another spot. Out already, it goes
      // on from where it is: walking, then flown up from where the walker stands, not from the
      // orbit high over the village, which had it out of the village before a key could rise.)
      const v = rig.view,
        y = (v.yaw * Math.PI) / 180,
        p = (v.pitch * Math.PI) / 180;
      free.start(
        roamRules(mode),
        free.on
          ? free.state
          : {
              x: v.target.x + v.distance * Math.cos(p) * Math.sin(y),
              y: v.target.y - v.distance * Math.sin(p),
              z: v.target.z + v.distance * Math.cos(p) * Math.cos(y),
              yaw: v.yaw,
              pitch: v.pitch,
            },
      );
      rig.enabled = false;
      // Walking: down among the people, at the eye's height, looking along the ground.
      if (mode === "walk" && roaming !== "walk") {
        const s = free.state,
          o = orbitOf(s, 0, 40 * VILLAGE_METRE);
        free.state = { ...s, x: o.target.x, y: 1.7 * VILLAGE_METRE, z: o.target.z, pitch: -4 };
      }
    }
    roaming = mode;
    // (The scales' own hints — "drag to turn" — are not how a free camera goes.)
    document.body.classList.toggle("roaming", mode !== "orbit");
    freeControls.set(mode, scale === "village");
  };
  freeControls.onMode = setRoam;
  exposed.roaming = () => roaming;
  exposed.freeState = () => ({ ...free.state, passing });
  // The spot of the globe under the free camera, its land, and the land nearest (look tools).
  exposed.spotBelow = () => {
    const frame = client.latestFrame("globe"),
      s = free.state,
      r = Math.hypot(s.x, s.y, s.z) || 1;
    if (!frame) return null;
    const spot = nearestCell(
        sphereGrid((frame.meta as { frequency: number }).frequency),
        s.x / r,
        s.y / r,
        s.z / r,
      ),
      province = (frame.arrays.province as Int32Array | undefined)?.[spot] ?? -1;
    return {
      spot,
      province,
      peopled: density.has(province),
      near: landNear(spot, frame),
      land: regionCell,
      map: (client.latestFrame("region")?.meta as { center?: number } | undefined)?.center ?? null,
    };
  };
  freeControls.onStick = (s) => (free.stick = s);
  free.onTap = (x, y) => rig.tap(x, y);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && roaming !== "orbit") setRoam("orbit");
  });
  // Where the free camera's scale should change (by its height), and into what.
  free.onMoved = (s) => {
    if (passing || roaming === "orbit") return;
    const mode = roaming,
      go = (how: () => Promise<void>) => {
        passing = true;
        setRoam("orbit");
        void how().finally(() => {
          // (A frame for the next scale's orbit to stand the camera, then on roaming.)
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              passing = false;
              setRoam(mode === "walk" && scale !== "village" ? "fly" : mode);
            }),
          );
        });
      };
    if (scale === "village" && s.y > 140 * VILLAGE_METRE) go(() => zoomThrough("out"));
    else if ((scale === "camp" || scale === "battle") && s.y > 3.2) go(() => zoomThrough("out"));
    else if (scale === "region") {
      const under = region.heightAt(s.x, s.z);
      if (s.y - under > 180) {
        // Out to the world, facing the spot flown over (set once the orbit has the camera
        // back: handing it back turns it about where the free camera looked).
        go(async () => {
          rig.target.set(s.x, under, s.z);
          await zoomThrough("out");
        });
      } else if (s.y - under < 0.6) {
        const tile = region.villageNear(region.tileAt(s.x, s.z), 1),
          v = tile === null ? undefined : villages.find((x) => x.tile === tile);
        if (v)
          go(async () => {
            await fadeOver(() => ready("the village", () => toVillage(v.ref)));
            rig.distance = 20;
          });
      }
    } else if (scale === "globe") {
      const r = Math.hypot(s.x, s.y, s.z);
      // Far out from the world: on into its sky.
      if (r > 14) go(() => zoomThrough("out"));
      else if (r < 1.07) {
        // Down into the land flown down to.
        rig.aimed = { x: s.x / r, y: s.y / r, z: s.z / r };
        rig.pointer = null;
        go(() => zoomThrough("in"));
      }
    }
  };
  // (A scale left while roaming by its own buttons, or gone to: the orbit takes the camera back,
  // as the new scale stands it.)
  let roamedAt = "";
  stage.onUpdate(() => {
    if (roamedAt !== scale) {
      if (roaming !== "orbit" && !passing) setRoam("orbit", false);
      freeControls.set(roaming, scale === "village");
      roamedAt = scale;
    }
  });
  rig.onBeyond = (way) => {
    if (through) return;
    through = true;
    // (The wheel turned on through is spent: none of it zooms the scale come to, toward wherever
    // the pointer rests, off what the eye was turned to there — a battle faced, a land's spot.)
    rig.hush(Infinity);
    void zoomThrough(way).finally(() => {
      through = false;
      rig.hush(500);
    });
  };
  exposed.zoomThrough = (way: "in" | "out") => zoomThrough(way);
  exposed.scale = () => scale;
  /** The scale now (read through a call, so a check after an await is not narrowed by one before it). */
  const scaleNow = () => scale;
  exposed.faceSpot = faceSpot;
  exposed.galaxy = () => void toGalaxy();
  exposed.visitForeign = async (ref: string, index: number) =>
    toForeignWorld(
      await client.query<StarPage>({ type: "galaxy.star", args: { ref } }),
      index,
      "cluster",
    );
  exposed.galaxyStars = () =>
    scale === "galaxy" && galaxyPlan ? GALAXY_STARS[stage.quality.name] : 0;
  exposed.tapGalaxy = tapGalaxy;
  exposed.visit = (i: number) => void toWorld(i);
  exposed.visiting = () => (scale === "world" && seen ? seenAt : -1);
  systemPanel.onBack = () => {
    // (From another star's system, back to the stars about it.)
    if (skyStar) {
      skyScene.visible = false;
      systemPanel.visible = false;
      void toCluster();
      return;
    }
    stopSky?.();
    stopSky = null;
    toGlobe();
  };
  exposed.sky = () => void toSystem();
  exposed.skyBodies = () => (scale === "system" && skyPlan ? skyPlan.bodies.length : 0);
  exposed.skyMirrors = () => (scale === "system" ? skyScene.mirrorsShown : null);
  exposed.systemPeople = () => (scale === "system" ? skyScene.peopleShown : null);
  /** Whose system the sky shows: the home star's (null), or another's ref. */
  exposed.skyOf = () => (scale === "system" ? (skyStar?.ref ?? null) : null);
  let fleetsNamed = false,
    peoplesAway = false;
  const NO_PEOPLES = {
    holds: [],
    own: [],
    ships: [],
    fleets: [],
    lines: [],
    reactions: [],
    raids: [],
    landings: [],
  };
  stage.onUpdate(() => {
    if (scale !== "cluster" || !clusterPlan) return;
    if (!nationFilming && performance.now() - nationAsked > 2000) void askNations();
    starScene.voyages(voyageMarks(clusterPlan, sky, now() / YEAR));
    // The peoples of other stars among them (Phase 18 M134), and how they met where they met; put away under a lens with something else to say (Phase 73).
    const lensOn = clusterPanel.lenses.lens;
    if (lensOn === "trade" || lensOn === "war" || lensOn === "lanes") {
      if (!peoplesAway) starScene.peoples(NO_PEOPLES);
      peoplesAway = true;
    } else {
      peoplesAway = false;
      starScene.peoples(peopleMarks(clusterPlan, sky, now() / YEAR));
    }
    const met: Label[] = starScene.reactionsOnScreen().map((r) => ({
      key: `met:${r.ref}`,
      text: r.text,
      at: { x: r.sx, y: r.sy },
      priority: 1.2e9,
    }));
    // Each war fleet as its counter (M101): its realm's arms and its strength, edged by how
    // it stands to what is followed.
    const counters: Label[] = starScene.fleetsOnScreen().map((h) => ({
      key: `fleet:${h.ref}`,
      text: h.strength.toFixed(1),
      at: { x: h.sx, y: h.sy },
      priority: 1.5e9,
      badge: {
        realm: h.realm,
        stance: followedRefs.has(h.realm) ? "ours" : followedRefs.has(h.enemy) ? "foe" : undefined,
      },
    }));
    if (counters.length || met.length || fleetsNamed) labels.update([...counters, ...met]);
    fleetsNamed = counters.length + met.length > 0;
  });
  stage.onUpdate(() => {
    if (scale !== "system" || !skyPlan) return;
    const t = skyFilmed ?? now(),
      spots = systemSpec(skyPlan, t),
      screen = performance.now() / 1000;
    skyScene.update(spots);
    // (Another star's has none of ours about it; nor has a crossing played again the marks of this
    // year's flights about the worlds of its own.)
    const filmed = skyFilmed !== null;
    skyScene.marks(
      skyMarks(skyStar || filmed ? { programs: [], colonies: [] } : sky, spots, screen),
    );
    skyScene.mirrors(skyStar || filmed ? 0 : (sky.mirrors?.km2 ?? 0));
    // The peoples of other stars about it (M136): their worlds, craft and ships, named.
    const peoples = filmed ? undefined : skyStar ? starPeoples : sky.peoples;
    skyScene.peoples(
      peopleSystemMarks(peoples, skyStar?.ref ?? peoples?.home ?? "", spots, t / YEAR, screen),
    );
    labels.update(
      skyScene.peopleOnScreen().map((n) => ({
        key: n.key,
        text: n.text,
        at: { x: n.x, y: n.y },
        priority: 1.3e9,
      })),
    );
  });
  planetPanel.onClose = () => globe.mark(null);
  // Down into a village to watch its day, and back up to its land. Watching is
  // looking: the plan is read from the host, the day is drawn by the view, and
  // nothing is sent back but the speed.
  let plan: VillagePlan | null = null,
    planYear = -1,
    watched: number | null = null,
    clock = { t: 0, wall: 0, speed: 0 },
    shown = 0,
    /** The town's stores as last put on its panel (Phase 39 M198). */
    storesTold: StoresNow | null = null;
  // (Asked for more than it can give, a world goes at what it gives: a date carried forward at the speed
  // asked for ran on ahead, by 54 years at a hundred years a second on a slow machine, and stepped back
  // when the clock stopped.)
  client.onStatus(
    (s) =>
      (clock = {
        t: s.t,
        wall: performance.now(),
        speed: s.achieved > 0 && s.achieved < s.speed * 0.7 ? s.achieved : s.speed,
      }),
  );
  /** The sim time now, carried forward smoothly between the host's reports. */
  const now = () => {
    const ahead = Math.min(1, (performance.now() - clock.wall) / 1000) * clock.speed;
    shown = Math.max(shown, clock.t + ahead);
    return Math.min(shown, clock.t + clock.speed);
  };
  stage.onUpdate(() => time.tick(now()));
  // (A speed chosen inside a stage of the battle at the turn not yet slowed for goes to the world
  // already slowed: a frame late, at a month a second, is days — the battle gone by before the
  // clock comes down to it.)
  time.govern = (speed) => {
    if (!(speed > 0 && speed <= 30 * DAY)) return speed;
    const t = now(),
      slowings = slowingsNow();
    return Math.min(
      speed,
      slowingBegun(slowings, t, speed, slowedOnce)?.speed ?? Infinity,
      slowAhead(slowings, t, frameSlow, slowedOnce).speed,
    );
  };
  // The land's towns rising as its clock runs, its fields at the season, its roads at the year.
  stage.onUpdate(() => {
    if (scale === "region") region.land.update(now(), time.speed > 0);
  });
  /** Whether the town is of spires, the eye then kept out of their walls (Phase 66). */
  let spires = false;
  stage.onUpdate(() => {
    rig.spires = spires && scale === "village";
  });
  /** The year a people's town is read at while a meeting is filmed (Phase 69; null: now). */
  let folkFilmedAt: number | null = null;
  /** A town's money told its plan was read again (Lives L6). */
  let moneyPlan: (() => void) | null = null;
  const loadPlan = async (ref: string) => {
    // Asked once a year: the year is marked before the answer comes.
    planYear = Math.floor(clock.t / YEAR);
    // (The same town read again as the years turn keeps what its panel shows.)
    const fresh = plan?.ref !== ref;
    const q0 = performance.now();
    plan = await client.query<VillagePlan>({
      type: "village.plan",
      args: {
        ref,
        families: stage.quality.families,
        folk: stage.quality.crowdCap,
        figures: true,
        ...(folkFilmedAt !== null ? { at: folkFilmedAt } : {}),
      },
    });
    spires = !!plan.town && hasSpires(plan.town);
    performance.measure("village.plan", { start: q0 });
    const t0 = performance.now();
    village.build(plan, now());
    performance.measure("village.build", { start: t0 });
    villagePanel.show(plan.name, fresh);
    villagePanel.foreign = !!plan.native;
    moneyPlan?.();
    storesTold = null;
    villagePanel.hand = plan.hand;
    villagePanel.works = {
      era: plan.era,
      what: plan.works?.mine?.what ?? null,
      ...(plan.metal ? { metal: plan.metal } : {}),
      ...(plan.stuff ? { stuff: plan.stuff } : {}),
    };
  };
  // The war about the town (Phase 40 M204): of the world's wars, the one its year brings to it now —
  // its men mustering and marching out; before its land's heart, the hosts drawn up and fighting,
  // the siege, the storm — drawn as its land plays it, and told on a line under its bar.
  stage.onUpdate(() => {
    // (A raid being played again holds the town's war: Phase 67. So does a landing, Phase 70.)
    if (fleetFilm?.townHeld || landfallFilm?.townHeld) return;
    // (The look tools hold a war made up, to see how a host stands: W1.)
    if (heldTownWar) {
      townWar = scale === "village" ? heldTownWar : null;
      village.war(townWar);
      return;
    }
    const spot =
        scale === "village" && plan ? (plan.spot ?? centres.get(plan.cell ?? -1)) : undefined,
      tw =
        plan && warsLive && spot !== undefined
          ? townWarNow(
              warsLive,
              warsAt(now() / YEAR),
              { spot, heart: plan.life?.heart ?? true },
              preferredTownBattle?.town === plan.ref ? preferredTownBattle.event : undefined,
            )
          : null;
    if (tw === null && townWar === null) return;
    townWar = tw;
    village.war(tw);
    villagePanel.warNow(tw?.words ?? null, tw ? (tw.fought?.event ?? tw.ref) : null);
  });
  exposed.holdTownWar = (tw: TownWar | null) => {
    heldTownWar = tw;
  };
  exposed.townWarScene = () => (scale === "village" ? (village.warNow()?.scene ?? null) : null);
  villagePanel.onWar = (ref) => void pageWindow.open(ref);
  villagePanel.onPage = (ref) => void pageWindow.open(ref);
  // (Where the eye stands, whose names the pages tell: the town's land, or the land shown.)
  names.standing = () =>
    scale === "village" ? (plan?.cell ?? null) : scale === "region" ? regionCell : null;
  // The battle at the turn fought before the town watched (Phase 55 M227, D1, D4, asked for
  // 2026-10-25: "the battles should be fought on the land, by the townsfolk, where you can see
  // them"): history fights it at the turn; the morning after, on the field before the town its
  // land's battles are fought before, it is drawn soldier by soldier in the town's own scene on the
  // world's clock — every figure a man of its roll, its fallen and wounded as many as history counts
  // them, its fallen lying until they are borne in; the town indoors while it is fought, but for some
  // come out to its edge to watch; the hosts' fires the night before. Asked for once its turn has come.
  let placed: {
      /** The town and the battle (`<town>|<event>`), the turn it is fought at, the detail it was laid at. */
      key: string;
      turn: number;
      detail: number;
      /** The figures a side it was laid at (a battle the god fought: those he was taken at, Phase 61). */
      most: number;
      info: BattleNear;
      field: BattleField;
      blows: Blows;
      roll: BattleRoll;
      /** Who each figure is, as its roll names him. */
      names: readonly (RollEntry | null)[];
      /** Where history struck each man of the roll, by his ref (Phase 55 wave 5). */
      members: Readonly<Record<string, StruckMember>>;
      frame: PlacedFrame;
      /** The hosts' fires behind their lines the night before it. */
      camp: readonly { readonly x: number; readonly z: number }[];
      /** The battle at its end (its fallen where they lie), worked out once for the blood shown. */
      end: BattleNow | null;
      /** The battle as drawn now (null: not drawn); those come out to watch it, and the day they are of. */
      now: BattleNow | null;
      watchers: readonly Watcher[];
      watchDay: number;
      /** The eye brought to it as it begins (once). */
      faced: boolean;
    } | null = null,
    /** The battle before the town asked for (its key), and whether the asking came to nothing. */
    placedAsked = "",
    placedFailed = false;
  /** The battle before the town let go: no longer drawn, the clock no longer waiting for it. */
  const unplace = () => {
    if (!placed && !placedAsked) return;
    placed = null;
    placedAsked = "";
    placedFailed = false;
    village.placeBattle(null);
    village.battleAt(null);
    time.release("battle-roll");
  };
  /**
   * The battle before the town laid on its field: its words, then its roll at as many figures a side
   * as the setting draws — or, where the god fought in it (Phase 61), as many as he was taken at.
   */
  const layBattle = async (town: VillagePlan, event: string, turn: number, key: string) => {
    const detail = stage.quality.detail,
      near = await client
        .query<BattleNear | null>({ type: "battle.near", args: { event } })
        .catch(() => null),
      most = near?.hand?.most ?? placedMost(detail),
      [info, roll, members] = near
        ? await Promise.all([
            near,
            client.query<BattleRoll | null>({ type: "battle.roll", args: { event, most } }),
            // (Where history struck each man of it: his figure struck there, Phase 55 wave 5.)
            client.query<Record<string, StruckMember>>({
              type: "battle.members",
              args: { event, most },
            }),
          ]).catch(() => [null, null, null] as const)
        : ([null, null, null] as const);
    // (Moved on meanwhile: to another town, or the battle let go.)
    if (placedAsked !== key || plan?.ref !== town.ref) return;
    if (!info || !roll) {
      placedFailed = true;
      time.release("battle-roll");
      return;
    }
    const field = newBattle(info, most, true),
      drawn = newBlows(field),
      names = rollNames(field, drawn, roll),
      // (Each named man struck where history struck him: his fate, and so his name, the same.)
      blows = members ? newBlows(field, toldBlows(names, members)) : drawn,
      frame = fieldFrame(town, field);
    village.placeBattle({
      field,
      frame,
      figure: info.figure ? figureOf(info.figure, detail) : null,
      body: info.figure,
    });
    placed = {
      key,
      turn,
      detail,
      most,
      info,
      field,
      blows,
      roll,
      names,
      members: members ?? {},
      frame,
      camp: placedCamp(frame, field),
      end: null,
      now: null,
      watchers: [],
      watchDay: -1,
      faced: false,
    };
    time.release("battle-roll");
  };
  /** A battle made up by the look tools, held before the town at one of its seconds (W1b; null: none). */
  let heldBattleS: number | null = null;
  exposed.holdBattle = (near: BattleNear | null, s = 0) => {
    if (!near) {
      if (heldBattleS !== null) unplace();
      heldBattleS = null;
      return;
    }
    if (!plan) return;
    const key = `held|${near.event}`;
    if (placed?.key !== key) {
      unplace();
      const detail = stage.quality.detail,
        most = placedMost(detail),
        field = newBattle(near, most, true),
        frame = fieldFrame(plan, field);
      village.placeBattle({
        field,
        frame,
        figure: near.figure ? figureOf(near.figure, detail) : null,
        body: near.figure,
      });
      placed = {
        key,
        turn: 0,
        detail,
        most,
        info: near,
        field,
        blows: newBlows(field),
        roll: {} as BattleRoll,
        names: field.troopers.map(() => null),
        members: {},
        frame,
        camp: [],
        end: null,
        now: null,
        watchers: [],
        watchDay: -1,
        faced: true,
      };
    }
    heldBattleS = s;
  };
  /** The battle held before the town as drawn now, and the eye brought to it as the town's view brings it (W1b's gate). */
  exposed.heldBattle = (face = false) => {
    const P = placed;
    if (!P || heldBattleS === null) return null;
    if (face) {
      const v = placedViewOf(P);
      rig.halt();
      rig.target.set(v.target.x, 0, v.target.z);
      rig.yaw = v.yaw;
      rig.pitch = v.pitch;
      rig.distance = v.distance;
      rig.userZoomed = true;
    }
    const n = P.now;
    return {
      s: heldBattleS,
      fire: P.field.fire ?? null,
      meet: P.field.meet,
      words: n?.words ?? "",
      flashes: n?.flashes.length ?? 0,
      streaks: n?.bolts?.length ?? 0,
      cars: n?.vehicles?.length ?? 0,
      standing: n ? [...n.standing] : [0, 0],
      fallen: n ? [...n.fallen] : [0, 0],
      troopers: (n?.troopers ?? []).map((q) => ({
        id: q.id,
        side: q.side,
        x: q.x,
        z: q.z,
        act: q.act,
        size: q.size,
        by: P.field.troopers[q.id]!.by,
        falls: P.field.troopers[q.id]!.falls,
      })),
    };
  };
  exposed.heldWords = (id: number) => {
    const P = placed;
    return P && heldBattleS !== null
      ? (blowWords(P.field, P.blows, id, heldBattleS) ?? trooperWords(P.field, id, heldBattleS))
      : null;
  };
  stage.onUpdate(() => {
    // (A battle held by the look tools, at its second: W1b.)
    if (heldBattleS !== null && placed && scale === "village") {
      const shown = blowsAt(placed.field, placed.blows, battleAt(placed.field, heldBattleS), gore);
      placed.now = shown;
      village.battleAt(shown, [], []);
      return;
    }
    // (Its layer built on the eve, ahead of the morning.)
    if (scale === "village" && townWar?.eve) village.readyBattle();
    const p = scale === "village" && plan ? (townWar?.placed ?? null) : null;
    if (!p || !plan) {
      unplace();
      return;
    }
    const key = `${plan.ref}|${p.event}`;
    // (Laid again at a setting's detail as the setting moves: so many figures as it draws; not
    // while one of its men is possessed, Phase 61.)
    if (placed && placed.detail !== stage.quality.detail && !handHeld.holds(placed.info.event))
      unplace();
    if (placedAsked !== key) {
      unplace();
      placedAsked = key;
      void layBattle(plan, p.event, p.turn, key);
    }
    const t = now(),
      seen = time.lapse ? Math.floor(t / DAY) * DAY + 10 * 3600 : t,
      at = battleStage(seen, p.turn),
      P = placed;
    if (!P) {
      // (Not laid yet as it is about to begin: the world waits for it.)
      if (!placedFailed && battleCapAt(seen, p.turn) === "battle") time.hold("battle-roll");
      village.battleAt(null);
      return;
    }
    // The battle at its moment; once over, its fallen where they lie, borne in from noon two days on.
    // (One of its men possessed, or the god fought in it: as his fight has it, Phase 61.)
    let shown: BattleNow | null = handHeld.battleShown(P, seen);
    if (shown) {
      // (As the hand has it.)
    } else if (at === "morning" || at === "battle")
      shown = blowsAt(P.field, P.blows, battleAt(P.field, battleSecond(seen, P.turn)), gore);
    else if (at === "after" || at === "borne") {
      P.end ??= fallenNow(
        P.field,
        blowsAt(P.field, P.blows, battleAt(P.field, BATTLE_LENGTH), gore),
      );
      shown = at === "borne" ? borneNow(P.field, P.end, borneShare(seen, P.turn)) : P.end;
    }
    P.now = shown;
    // The town indoors through it, but for those come out to its edge to watch (told once a day; none
    // stand out to watch a fight by fire: W1b).
    const kept = battleShelter(P.turn),
      watching = !P.field.fire && seen >= kept.from && seen < kept.to,
      day = Math.floor(seen / DAY);
    if (watching && P.watchDay !== day) {
      P.watchers = fieldWatchers(plan, P.frame, seen);
      P.watchDay = day;
    }
    // (The hosts' fires behind their lines until the dawn before it.)
    const dark = at === "morning" && seen < P.turn * YEAR + 6.5 * 3600;
    village.battleAt(shown, watching ? P.watchers : [], dark ? P.camp : []);
    // The eye to where the lines meet as it begins (once; not where the viewer has it on someone).
    if (!P.faced && battleCapAt(seen, P.turn) === "battle" && watched === null) {
      P.faced = true;
      rig.flyTo(placedViewOf(P), 1.2);
    }
  });
  // The eye onto a raid as its machines come (once; not where the viewer has it on someone, or is steering it).
  let raidFaced = "";
  stage.onUpdate(() => {
    if (scale !== "village" || watched !== null || rig.steering || !plan?.town?.struck) return;
    const k = raidOver(plan.town, now());
    if (!k || k.event === raidFaced) return;
    raidFaced = k.event;
    rig.flyTo(raidEye(k), 1.2);
  });
  // A raid played again in its town (W2): that morning, from its first machine to its fires at their height, the world's
  // clock held. At a year a second one is over between two frames, and it falls on three towns a year.
  let raidPlaying: {
    t: number;
    calm: number;
    to: number;
    speed: number;
    words: HTMLElement;
  } | null = null;
  const endRaidFilm = () => {
    if (!raidPlaying) return;
    raidPlaying.words.remove();
    raidPlaying = null;
    time.release("raid film");
  };
  const watchRaid = async (event: string): Promise<boolean> => {
    const where = await client.query<{ town: string } | null>({
      type: "raid.where",
      args: { event },
    });
    if (!where) return false;
    endRaidFilm();
    // (Nothing over what is to be seen.)
    pageWindow.close();
    if (scale !== "village" || plan?.ref !== where.town) await toVillage(where.town);
    const k = plan?.town?.struck?.find((x) => x.event === event && x.raid);
    if (!k) return false;
    const film = raidFilm(k),
      words = document.createElement("button");
    words.className = "film-words raid-film";
    words.textContent = `${
      k.raid!.great
        ? `☢️ ${plan!.name}, the greatest fire, by ${k.raid!.by}`
        : k.raid!.rocket
          ? `🚀 ${plan!.name}, the rockets thrown by ${k.raid!.by}`
          : `✈ ${plan!.name}, the raid by ${k.raid!.by}`
    }: played again. Tap to stop.`;
    words.onclick = endRaidFilm;
    hud.append(words);
    raidPlaying = { t: film.from, calm: film.calm, to: film.to, speed: film.speed, words };
    time.hold("raid film");
    raidFaced = event;
    rig.flyTo(raidEye(k), 1);
    return true;
  };
  stage.onUpdate((dt) => {
    if (!raidPlaying) return;
    if (scale !== "village") return endRaidFilm();
    raidPlaying.t += dt * (raidPlaying.t < raidPlaying.calm ? raidPlaying.speed : RAID_FIRES);
    if (raidPlaying.t >= raidPlaying.to) endRaidFilm();
  });
  exposed.watchRaid = watchRaid;
  exposed.raidOn = () => !!raidPlaying;
  // The greatest fire's light over the whole screen (W5): white, for a moment, then the world comes back from it; a brown dusk under the cloud after.
  const greatLight = document.createElement("div");
  greatLight.className = "great-light";
  greatLight.hidden = true;
  hud.prepend(greatLight);
  stage.onUpdate(() => {
    const g = scale === "village" ? village.blazeShown()?.great : null,
      s = g?.since ?? -1,
      white = s < 0 ? 0 : s < 0.6 ? 1 : s < 6 ? Math.pow(1 - (s - 0.6) / 5.4, 2) : 0,
      dusk = s < 0 ? 0 : 0.26 * Math.min(1, s / 30) * Math.max(0, 1 - s / GREAT_LASTS);
    sound.fireSeen(s);
    greatLight.hidden = white <= 0 && dusk <= 0;
    if (greatLight.hidden) return;
    greatLight.style.background =
      white > dusk ? `rgba(255,250,235,${white.toFixed(3)})` : `rgba(48,28,14,${dusk.toFixed(3)})`;
  });
  // The year the world holds its breath (W5): the clock comes down to a month a second until it is over, wherever the eye is; and the world's panel reads how near.
  client.subscribe<{ crises: number } | null>({ type: "fire.shadow" }, 1000, (s) => {
    if (s && s.crises > 0) {
      if (!time.capped("fire")) time.cap("fire", YEAR / 12);
    } else if (time.capped("fire")) time.uncap("fire");
  });
  exposed.raidFilming = () => raidPlaying?.t ?? null;
  exposed.stopRaidFilm = endRaidFilm;
  /**
   * The eye brought onto the battle before the town once it is drawn there, where the town is gone
   * into for it (until then: wall-clock ms; 0: not) — its field once laid; the night before it, its
   * hosts by their fires once the town draws them; by then, what the town has. (Let go as the viewer
   * steers.)
   */
  let faceFightBy = 0;
  stage.onUpdate(() => {
    if (!faceFightBy) return;
    const P = placed,
      laying = !!townWar?.placed && !placedFailed,
      drawing = !!townWar?.eve && !village.warNow()?.scene.middles.some((m) => m !== null);
    if (scale !== "village" || rig.steering) faceFightBy = 0;
    else if (P) {
      faceFightBy = 0;
      rig.flyTo(placedViewOf(P), 1.2);
    } else if (performance.now() > faceFightBy || !(laying || drawing)) {
      faceFightBy = 0;
      faceBattle();
    }
  });
  /** What a man of a battle's roll bore there, asked of the host once (Phase 55 M228). */
  const borneAsked = new Map<string, Promise<ArmBorne | null>>();
  /** One who fought, as his card tells him (Phase 55 M227–M228). */
  const cardOf = async (
    event: string,
    roll: BattleRoll,
    side: 0 | 1,
    e: RollEntry,
    fate: string,
  ): Promise<ManCard> => {
    const key = `${event}|${side}|${e.ref}|${names.mode}`;
    let asked = borneAsked.get(key);
    if (!asked) {
      if (borneAsked.size > 2000) borneAsked.clear();
      asked = client
        .query<ArmBorne | null>({
          type: "arms.borne",
          args: { event, side, who: e.ref, ...names.args() },
        })
        .catch(() => null);
      borneAsked.set(key, asked);
    }
    const borne = await asked;
    return {
      name: e.name,
      page: e.ref,
      side,
      from: (side === 0 ? roll.attacker : roll.defender).towns[e.place]?.name ?? null,
      age: e.age,
      fate,
      arm: borne?.words ?? null,
      maker: borne?.maker ?? null,
      armPage: borne?.page ?? null,
      called: borne?.called ?? null,
    };
  };
  /** One who fought before the town tapped: his card (null: none of the roll is his). */
  const showFighter = async (id: number): Promise<string | null> => {
    const P = placed,
      e = P?.names[id],
      t = P?.field.troopers[id];
    if (!P || !e || !t) return null;
    selectPerson(null);
    // (A battle the god fought: as his fight left him, Phase 61.)
    const hand = handHeld.fateOf(P, id),
      s = Math.min(BATTLE_LENGTH, battleSecond(now(), P.turn)),
      m = await cardOf(
        P.info.event,
        P.roll,
        t.side,
        e,
        FATE_WORDS[hand ?? figureFate(P.field, P.blows, id)],
      );
    if (placed !== P) return null;
    villagePanel.showSoldier(
      m,
      (t.side === 0 ? P.info.attacker : P.info.defender).name,
      hand
        ? HAND_FATE_WORDS[hand]
        : (blowWords(P.field, P.blows, id, s) ?? trooperWords(P.field, id, s)),
    );
    // His family, and his body as the battle so far leaves him while it is fought (Phase 55 wave 5).
    await kinOnCard(
      e.ref,
      s < BATTLE_LENGTH && !hand
        ? {
            event: P.info.event,
            struck: struckOf(P.field, P.blows, id, s, P.members[e.ref]?.member),
          }
        : undefined,
    );
    return villagePanel.cardShown();
  };
  exposed.tapPlaced = (id: number) => showFighter(id);
  exposed.placedBattle = () => {
    const P = scale === "village" ? placed : null,
      layer = village.placedBattle;
    if (!P || !layer) return null;
    const t = now(),
      seen = time.lapse ? Math.floor(t / DAY) * DAY + 10 * 3600 : t,
      n = P.now,
      sideOf = (s: number) => (s === 0 ? P.roll.attacker : P.roll.defender);
    return {
      event: P.info.event,
      turn: P.turn,
      title: P.info.title,
      stage: battleStage(seen, P.turn),
      s: battleSecond(seen, P.turn),
      per: P.field.per,
      figures: [P.field.hosts[0].n, P.field.hosts[1].n],
      named: P.names.filter((e) => e !== null).length,
      falls: [0, 1].map(
        (s) => P.field.troopers.filter((q) => q.side === s && q.falls !== null).length,
      ),
      hurt: [...P.blows.hurt],
      rule: [0, 1].map((s) => ({ ...sideOf(s).figures })),
      roll: [0, 1].map((s) => ({
        fell: sideOf(s).fell.length,
        hurt: sideOf(s).hurt.length,
        stood: sideOf(s).stood.length,
      })),
      drawn: n ? n.troopers.filter((q) => q.size > 0.01).length : 0,
      lying: n
        ? n.troopers.filter((q) => q.size > 0.01 && P.field.troopers[q.id]!.falls !== null).length
        : 0,
      onScreen: n
        ? n.troopers
            .filter((q) => q.size > 0.3)
            .slice(0, 400)
            .map((q) => ({
              id: q.id,
              side: q.side,
              act: q.act,
              crawl: q.crawl > 0,
              hit: q.hit ?? null,
              lost: q.lost ?? null,
              fate: figureFate(P.field, P.blows, q.id),
              name: P.names[q.id]?.name ?? null,
              ref: P.names[q.id]?.ref ?? null,
              at: layer.onScreen(q),
            }))
        : [],
      marks: layer.marks(),
      parts: layer.count(),
      shadows: layer.casts,
      watchers: village.watching,
      sheltered: village.shelteredNow(),
      camp: village.warNow()?.camp ?? 0,
      frame: P.frame,
      clock: { speed: time.speed, pace: time.pace, stopped: time.stopped },
      slowed: slowFor,
      told: battleSlow.told,
    };
  };
  // (An act cast on the town watched — fire sent on it, a spring, a shrine, its land shaken — read
  // again at once, so it is seen as it falls: Phase 42 M201.)
  const castOnTown = palette.onCast;
  palette.onCast = (receipt) => {
    castOnTown(receipt);
    if (scale === "village" && plan) void loadPlan(plan.ref);
  };
  exposed.blaze = () => (scale === "village" ? village.blazeShown() : null);
  exposed.raidersOnScreen = () =>
    scale === "village"
      ? village.raidersShown().flatMap((f) => {
          const s = stage.camera.camera!.worldToScreen(rig.target.clone().set(f.x, f.y, f.z));
          return s.z > 0 ? [{ x: s.x, y: s.y }] : [];
        })
      : [];
  exposed.wonders = () => (scale === "village" ? village.wonders : []);
  exposed.townWar = () => {
    const w = scale === "village" ? village.warNow() : null;
    if (!w) return null;
    const drawn = w.scene.soldiers.filter((q) => q.size > 0.5);
    return {
      ref: w.war.ref,
      words: w.war.words,
      told: villagePanel.warTold,
      hosts: w.war.hosts.map((h) => ({
        side: h.side,
        doing: h.doing,
        k: h.k,
        gathered: h.gathered,
      })),
      fight: w.war.fight,
      fought: w.war.fought,
      siege: w.war.siege,
      burning: w.war.burning,
      soldiers: drawn.filter((q) => q.doing !== "fallen").length,
      fallen: drawn.filter((q) => q.doing === "fallen").length,
      doing: [...new Set(drawn.map((q) => q.doing))],
      middles: w.scene.middles,
      tents: w.tents,
      fires: w.fires,
    };
  };
  // The eye over a point of the town (metres), so far off (the look tools: to watch its hosts).
  exposed.faceTown = (x: number, z: number, distance = 30) => {
    if (scale !== "village") return false;
    rig.target.set(x * VILLAGE_METRE, 0, z * VILLAGE_METRE);
    rig.userZoomed = true;
    rig.distance = distance;
    return true;
  };
  const toVillage = async (ref: string) => {
    scale = "village";
    stage.backdrop("ground", 40, true);
    // (A town of a colony's halls under its own sky: Phase 64.)
    if (!colonyRef(ref)) stage.colonySky(null);
    labels.clear();
    bubbles.clear();
    // Whichever way it came (a region, or straight from the globe), only the village shows.
    globe.visible = false;
    planetPanel.visible = false;
    region.visible = false;
    regionPanel.visible = false;
    watched = null;
    village.mark(null);
    shown = 0;
    await loadPlan(ref);
    village.visible = true;
    villagePanel.visible = true;
    time.at("village", villagePanel.timeSlot);
    // A town is seen from as far off as it spreads (Phase 23); a city's quarters from further off.
    const reach = village.townReach() * 0.1,
      far = reach > 0 ? Math.min(170, Math.max(26, reach * 1.4)) : plan?.districts ? 78 : 26;
    rig.configure({
      distance: far,
      minDistance: 3,
      maxDistance: Math.max(140, far * 1.6),
      pitch: -38,
      minPitch: -85,
      // (On a colony's ground the eye may rest low enough to see its sky over its skyline.)
      maxPitch: colonyRef(ref) ? -2 : -8,
      drift: drift(0.8),
      target: [0, 0, 0],
    });
    // Visitors from another star (M134): the village opens facing them.
    const facing = village.visitorsFacing();
    if (facing !== null) rig.yaw = facing;
    // (And its haze starts as far off.)
    if (reach > 0 || plan?.districts) stage.backdrop("ground", Math.max(110, far * 2.2), true);
    if (plan?.colony) {
      stage.colonySky(colonySky(plan.colony));
      colonyFrom = now();
      stage.daylight(colonyHour(plan.colony, 0));
      // (Its skyline against its sky, what hangs there behind it; or its star's light from the side.)
      const way = village.colony.hanging ?? stage.starWay;
      rig.halt();
      rig.pitch = -3;
      rig.distance = Math.max(24, far * 0.82);
      rig.target.set(0, Math.min(14, far * 0.09), 0);
      if (way)
        rig.yaw = (Math.atan2(-way.x, -way.z) * 180) / Math.PI + (village.colony.hanging ? 0 : 50);
    } else {
      // (A town of a people of the water: seen from under their sea.)
      const world = client.latestFrame("globe");
      if (world && frameUndersea(world)) stage.colonySky(seaSky(frameKind(world)));
    }
  };
  /** The moment the eye came down to a colony's town: its sun's morning. */
  let colonyFrom = 0;
  // A tap in the village: someone, else a beast (its lineage and what it is doing), else no one.
  let lifeTap: ((x: number, y: number) => boolean) | null = null;
  // (A home open: a tap is for what is in it. Lives L6.)
  let moneyTap: ((x: number, y: number) => boolean) | null = null,
    homeTap: ((x: number, y: number) => boolean) | null = null,
    homeOpen: () => boolean = () => false;
  /** Whether a ruler is being ruled (Lives L4): the town is seen by day then, as one watched growing is. */
  let ruling: () => boolean = () => false,
    ruleLeave: () => void = () => {};
  const tapVillage = (x: number, y: number) => {
    // (The sheet of lives up: one tapped goes on it, Lives L3.)
    if (homeTap?.(x, y)) return;
    if (lifeTap?.(x, y)) return;
    // (A town's money over it: a home tapped gives its page, whoever stands before it. Lives L6.)
    if (moneyTap?.(x, y)) return;
    // One borne home on a litter (Phase 55 wave 5): their card, as anyone's.
    const borne = plan ? village.pickLitter(x, y) : null;
    if (borne !== null) return selectPerson(borne);
    // A thing being made (Phase 51 M213–M215): a tool on the smithy's rack, a pot drying on a
    // kiln's boards, the cloth on a loom, a casting in its mould, a part at the works — its page,
    // from the ground to where it is — tapped right on it, though its makers stand before it; near
    // it, if no one is nearer.
    const on = plan ? village.madeAt(x, y, 12) : null,
      i = on ? null : village.pick(x, y);
    if (i !== null) return selectPerson(i);
    // One who fought before the town (Phase 55 M227): his card, named from the battle's roll.
    const fighter = placed?.now ? (village.placedBattle?.pick(placed.now, x, y) ?? null) : null;
    if (fighter !== null) {
      void showFighter(fighter);
      return;
    }
    const made = on ?? (plan ? village.madeAt(x, y) : null);
    if (made && plan) {
      selectPerson(null);
      void pageWindow.open(
        `made:${plan.ref}:${made.day}:${made.trade}:${plan.people[made.index]?.trade?.seat ?? 0}:${made.n}:${made.form}`,
      );
      return;
    }
    // Visitors from another star (M134): their landing, their embassy's latest, or their raid;
    // the eye goes down to them, near enough to see them among the people.
    const visitors = village.pickVisitors(x, y);
    if (visitors) {
      selectPerson(null);
      rig.flyTo({ target: visitors.at, distance: visitors.distance, pitch: visitors.pitch });
      void pageWindow.open(visitors.event);
      return;
    }
    // A soldier of the war about the town (Phase 55 wave 5): the man of its battle's roll he stands
    // for, on his card; or what he stands for.
    if (tapWarMan(x, y)) return;
    const beast = village.pickBeast(x, y);
    if (!beast) {
      selectPerson(null);
      // (A soldier of its battle, a home, a field: their pages.)
      const thing = villageThingAt(x, y);
      if (thing) void pageWindow.open(thing);
      else pageWindow.close();
      return;
    }
    selectPerson(null);
    village.markBeast(beast.index);
    void pageWindow.open(beast.ref).then(() => pageWindow.setLive(`Now ${beast.doing}`));
  };
  // A card's family and body (Phase 55 wave 5): the host's lines for whom the card is, put on it as
  // they come, if it is still theirs.
  let kinAsked = 0;
  // (In a battle being fought: their body as its blows so far leave it, `during`.)
  const kinOnCard = async (
    ref: string,
    during?: { readonly event: string; readonly struck: readonly StruckNow[] },
  ) => {
    const asked = ++kinAsked,
      card = await client.query<KinCard>({
        type: "kin.card",
        args: { ref, t: now(), ...(during ? { during } : {}) },
      });
    if (asked === kinAsked) villagePanel.folkKin.replaceChildren(...kinLines(card));
  };
  // The rolls of the battles fought before the towns watched, asked once each (as warManOf reads them).
  type WarRoll = Parameters<typeof warManOf>[3];
  const rolls = new Map<string, Promise<WarRoll | null>>();
  const rollOf = (event: string) => {
    let r = rolls.get(event);
    if (!r)
      rolls.set(
        event,
        (r = client.query<WarRoll | null>({ type: "battle.roll", args: { event } })),
      );
    return r;
  };
  /** A tap on a soldier of the war about the town: his card (false: no soldier there). */
  const tapWarMan = (x: number, y: number): boolean => {
    const war = townWar,
      hit = plan && war ? village.pickSoldier(x, y) : null,
      at = hit ? warSlot(hit.slot, hit.each) : null;
    if (!war || !hit || !at) return false;
    selectPerson(null);
    pageWindow.close();
    const host = war.sides[at.side].name,
      sign = at.side === 0 ? "⚔️" : "🛡️",
      fought = war.fought,
      asked = ++kinAsked;
    if (!fought) {
      villagePanel.showMan(
        `${sign} One of the host of ${host}`,
        [war.words],
        null,
        "One of a host drawn for its many: history names a battle's men once the battle is fought.",
      );
      return true;
    }
    villagePanel.showMan(
      `${sign} One of the host of ${host}`,
      [],
      null,
      "Reading the battle's roll…",
    );
    void rollOf(fought.event).then(async (roll) => {
      if (asked !== kinAsked) return;
      const scene = village.warNow()?.scene,
        man = roll && scene ? warManOf(scene, hit.each, hit.slot, roll) : null;
      if (!man) {
        villagePanel.showMan(
          `${sign} One of the host of ${host}`,
          [at.fallen ? "Fell in the battle before the town" : war.words],
          null,
          "One of the host the battle's roll does not name: it names so many of each side's men, not every one.",
        );
        return;
      }
      const e = man.entry;
      villagePanel.showMan(
        `${sign} ${e.name}`,
        [
          `Of the host of ${host}; ${e.age} years old`,
          man.fate === "fell"
            ? "Fell in the battle before the town"
            : man.fate === "maimed"
              ? "Maimed in it, and lived"
              : man.fate === "wounded"
                ? "Wounded in it, and lived"
                : "Came through it unhurt",
        ],
        e.ref,
        "One of the battle fought before the town, named from its roll: their page tells their family and their body.",
      );
      await kinOnCard(e.ref);
    });
    return true;
  };
  const selectPerson = (i: number | null) => {
    watched = i;
    village.mark(i);
    if (i !== null) village.markBeast(null);
    villagePanel.closeCard();
    if (i === null || !plan) return;
    const p = plan.people[i]!;
    // (One of the town's many drawn for its crowd, Phase 39 M198: their card, and their line's page, Phase 55 M225.)
    if (p.folk) {
      pageWindow.close();
      villagePanel.showFolk(
        p.name,
        p.trade
          ? `${p.role ?? p.trade.kind}, ${p.trade.years} years at the ${p.trade.kind === "smith" ? "anvil" : p.trade.kind === "potter" ? "wheel" : "loom"}`
          : (p.role ?? null),
        village.workToday(i),
        // (Inspired or blessed where they are met, Phase 54: the hand laid on the town from them. A
        // people of another world's has no land under the hand: Phase 69.)
        plan.native
          ? undefined
          : {
              town: plan.ref,
              name: p.name,
              age: p.age,
              occupation: p.occupation,
              ...(p.sex !== undefined ? { sex: p.sex } : {}),
              done: (agent) => void touched(agent),
            },
        // (The healer's page is their seat's: Phase 55 M229; a maker's, theirs: wave 5.)
        p.healer
          ? `heal:${plan.ref}`
          : p.trade
            ? seatRef(plan.ref, p.trade.kind, p.trade.seat)
            : p.ref,
        // (Their wounds as they are now: Phase 55 M226.)
        woundLines(p, now()),
      );
      // (Their family and body: Phase 55 wave 5.)
      if (plan.native) return;
      void kinOnCard(
        p.healer
          ? `heal:${plan.ref}`
          : p.trade
            ? seatRef(plan.ref, p.trade.kind, p.trade.seat)
            : p.ref,
      );
      return;
    }
    void pageWindow.open(p.ref);
  };
  // One of a town's people touched by the god's hand (Phase 54): the town drawn again with its
  // people under the hand, and the one touched looked at among them.
  const touched = async (agent: string) => {
    if (scale !== "village" || !plan) {
      void pageWindow.open(agent);
      return;
    }
    await loadPlan(plan.ref);
    const j = plan.people.findIndex((x) => x.ref === agent);
    if (j >= 0) selectPerson(j);
    else void pageWindow.open(agent);
  };
  pageWindow.onTouched = (agent) => void touched(agent);
  // One of a town's people possessed (Phase 60; asked for 2026-10-27: "add in functionality to
  // possess anything like worldbox/worldfall mod ... make sure it works right in mobile"): the god's
  // hand made flesh, walked and set to work by hand, from the palette or a person's card.
  const person = installPossession({
    stage,
    canvas,
    hud,
    client,
    time,
    rig,
    village,
    palette,
    pages: pageWindow,
    plan: () => (scale === "village" ? plan : null),
    scale: () => scale,
    reload: loadPlan,
    toOrbit: () => setRoam("orbit"),
  });
  // One of the men of the battle fought before the town, or a beast about it, possessed (Phase 61):
  // the god fights as him and the day goes as the hand fights it; runs as the beast, and what it
  // does stays done.
  const handHeld = installHeld({
    gore: () => gore,
    stage,
    canvas,
    hud,
    client,
    time,
    rig,
    village,
    palette,
    person,
    plan: () => (scale === "village" ? plan : null),
    scale: () => scale,
    placed: () => (scale === "village" ? placed : null),
    drawnAt: (s) =>
      placed ? blowsAt(placed.field, placed.blows, battleAt(placed.field, s), "full") : null,
    relay: () => unplace(),
    reload: loadPlan,
    toOrbit: () => setRoam("orbit"),
  });
  villagePanel.onStores = () => {
    selectPerson(null);
    pageWindow.close();
  };
  regionPanel.onWatch = (ref) => void toVillage(ref);
  // A camp of a land's bands seen near (Phase 29 M160, asked for 2026-10-24: "i should be able to
  // be in my game and see the cell stage and every stage like spore i would just watch it
  // emerge"): one of its bands living its day among the land's own beasts — gathering, hunting,
  // sleeping about the fire — their day the world's day, at the band's own speeds; back up to the
  // land by the bar, or by zooming out.
  const campPanel = new CampPanel(hud);
  let meadowScene: MeadowScene | null = null,
    bandLayer: BandLayer | null = null,
    near: {
      readonly info: CampNear;
      readonly meadow: MeadowState;
      readonly band: BandState;
      readonly bodies: readonly (BeastPlan | null)[];
      /** The world's moment last stepped to; the band's seconds owed, and gone (for the drawing). */
      t: number;
      owed: number;
      time: number;
      toldAt: number;
      /** The one of them the eye keeps to (their id; -1: the band). */
      followed: number;
      /** The world's day they were come down among on (their first day: their day 0). */
      readonly day0: number;
      /** The last fire made at a fresh camp, as told (Phase 49 M211; the look tools). */
      kindled: string;
    } | null = null;
  /** How near the pointer (px) a camp must be to be zoomed into while a village stands on the land. */
  const CAMP_REACH = 90;
  /** How near a battle (km) the ground zoomed toward may be for its town to be gone down into, facing it. */
  const BATTLE_NEAR_KM = 24;
  /** How near the eye must be for the band's names to be told over them (the one followed always is). */
  const NAMES_WITHIN = 9;
  /** The world's seconds to one of the band's: their day is the world's day. */
  const BAND_SECOND = DAY / BAND_DAY;
  /** Where the eye keeps: between the fire and the band, or on them as they walk on. */
  const bandMiddle = () => {
    if (!near) return null;
    const b = near.band;
    let x = 0,
      z = 0;
    for (const q of b.people) {
      x += q.x;
      z += q.z;
    }
    const n = b.people.length || 1,
      mx = b.going ? x / n : (b.camp.x * 2 + x / n) / 3,
      mz = b.going ? z / n : (b.camp.z * 2 + z / n) / 3;
    return { x: mx * 0.1, y: 0.2, z: mz * 0.1 };
  };
  const toCamp = async (cell: number, id: number, given?: CampNear) => {
    const info =
      given ?? (await client.query<CampNear | null>({ type: "camp.near", args: { cell, id } }));
    if (!info) return;
    leaveScale();
    scale = "camp";
    const detail = fieldDetail();
    if (!meadowScene) {
      meadowScene = new MeadowScene(stage);
      meadowScene.setDetail(detail);
      bandLayer = new BandLayer(stage, meadowScene.root);
    }
    labels.clear();
    bubbles.clear();
    globe.visible = false;
    planetPanel.visible = false;
    region.visible = false;
    regionPanel.visible = false;
    regionCell = cell;
    // (A people of another world has no land of ours under it: Phase 69.)
    client.setInterest(
      info.native ? { view: "globe", focus: null } : { view: "region", focus: `cell:0:${cell}` },
    );
    meadowScene.reset();
    // (A land of now: green, its woods standing.)
    const meadow = newMeadow(info.plan, 0, info.plan.seed, true);
    // (Their own flock grazes among the land's beasts: the hunters leave it be.)
    for (const k of meadow.kinds) if (info.flocks.includes(k.lineage)) k.tame = true;
    // (As far apart about their fire as their figures are drawn large; their things made of the
    // ground their camp stands on, Phase 49 M211.)
    const drawn = campFigure(figureOf(info.figure, detail)),
      room = campRoom(drawn),
      band = newBand(
        meadow,
        info.size,
        info.people,
        info.plan.seed,
        info.hour,
        info.names,
        room,
        info.craft,
      );
    bandLayer!.people(drawn, info.figure);
    near = {
      info,
      meadow,
      band,
      bodies: info.plan.lineages.map((l) => l.body),
      t: now(),
      owed: 0,
      time: 0,
      toldAt: -Infinity,
      followed: -1,
      day0: Math.floor(now() / DAY),
      kindled: "",
    };
    meadowScene.visible = true;
    bandLayer!.root.enabled = true;
    stage.backdrop("ground", 40);
    if (info.native) stage.colonySky(colonySky(info.native.look));
    campPanel.backTo = info.native ? "Their world" : "The land";
    campPanel.show(
      info.native ? `The ${info.people} · ${info.land}` : `${campWords(info.camp)} · ${info.land}`,
    );
    campPanel.visible = true;
    time.at("camp", campPanel.timeSlot);
    // (A great people's camp is seen from as much further off as they stand taller: Phase 69.)
    const campFar = Math.max(7, 3.4 * room);
    rig.configure({
      distance: campFar,
      minDistance: 2,
      maxDistance: Math.max(30, campFar * 1.6),
      pitch: -26,
      minPitch: -85,
      maxPitch: -8,
      drift: 0,
      target: [band.camp.x * 0.1, 0.2, band.camp.z * 0.1],
    });
    rig.follow = bandMiddle;
  };
  /** Down among a band of a land's camp, from wherever the eye is. */
  const goNear = async (cell: number, id: number) => {
    walk.saw("scale");
    pageWindow.close();
    await fadeOver(() => ready("the band", () => toCamp(cell, id)));
  };
  pageWindow.onNear = (cell, id) => void goNear(cell, id);
  exposed.goNear = goNear;
  /** Back up to the land, low over the camp the band was of. */
  const leaveCamp = async () => {
    const was = near?.info;
    if (!was) return;
    if (was.native) {
      const { star, index } = was.native;
      await fadeOver(() => ready("that world", () => toFolkWorld(star, index)));
      return;
    }
    await fadeOver(() =>
      ready("the land", () => {
        leaveScale();
        toRegion(was.cell);
      }),
    );
    const at = region.groundAt(was.camp.tile);
    if (at) rig.target.set(at.x, at.y, at.z);
    rig.userZoomed = true;
    rig.distance = 18;
  };
  campPanel.onBack = () => void leaveCamp();
  campPanel.onPage = () => {
    if (near)
      void pageWindow.open(near.info.native?.ref ?? `camp:${near.info.cell}:${near.info.camp.id}`);
  };
  /** The one of the band nearest a point of the screen, within a finger's reach (their id). */
  const bandPersonAt = (x: number, y: number): number | null => {
    if (!near || !bandLayer) return null;
    let best: number | null = null,
      bestD = 24;
    for (const p of near.band.people) {
      const at = bandLayer.onScreen(near.band, p.id),
        d = at ? Math.hypot(at.x - x, at.y - y) : Infinity;
      if (d < bestD) {
        best = p.id;
        bestD = d;
      }
    }
    return best;
  };
  /** What stands at a point of the screen among the band: a beast (its lineage), one of them (their camp). */
  const campThingAt = (x: number, y: number): string | null => {
    if (!near || !meadowScene || !bandLayer) return null;
    const beast = meadowScene.pick(near.meadow, x, y),
      kind = beast === null ? undefined : near.meadow.beasts.find((b) => b.id === beast)?.kind;
    if (kind !== undefined) return near.meadow.kinds[kind]?.ref ?? null;
    return bandPersonAt(x, y) === null
      ? null
      : (near.info.native?.ref ?? `camp:${near.info.cell}:${near.info.camp.id}`);
  };
  /** The eye kept on one of the band as they go about their day (Phase 29 M161), or on the band (null). */
  const followPerson = (id: number | null) => {
    if (!near) return;
    near.followed = id ?? -1;
    near.toldAt = -Infinity;
    const p = id === null ? undefined : near.band.people.find((q) => q.id === id);
    rig.follow = p
      ? () => {
          const q = near?.band.people.find((r) => r.id === p.id);
          return q ? { x: q.x * 0.1, y: 0.2, z: q.z * 0.1 } : null;
        }
      : bandMiddle;
    if (p)
      rig.flyTo(
        { target: { x: p.x * 0.1, y: 0.2, z: p.z * 0.1 }, distance: Math.min(rig.distance, 6) },
        0.8,
      );
  };
  // A tap among the band: one of them followed (tapped again, their camp's page); a beast's page;
  // the open ground, the band again.
  const tapCamp = (x: number, y: number) => {
    if (!near) return;
    const who = bandPersonAt(x, y);
    if (who !== null) {
      if (who === near.followed)
        void pageWindow.open(
          near.info.native?.ref ?? `camp:${near.info.cell}:${near.info.camp.id}`,
        );
      else followPerson(who);
      return;
    }
    const ref = campThingAt(x, y);
    if (ref) void pageWindow.open(ref);
    else if (near.followed >= 0) followPerson(null);
  };
  stage.onUpdate(() => {
    if (scale !== "camp" || !near || !meadowScene || !bandLayer) return;
    const t = now(),
      d = t - near.t;
    near.t = t;
    // (A leap of the world's clock — a day gone at once — is not lived through, step by step.)
    if (d > 0 && d < DAY) {
      near.owed += d / BAND_SECOND;
      near.time += d / BAND_SECOND;
    }
    let n = 0;
    while (near.owed >= MEADOW_STEP && n < 12) {
      stepMeadow(near.meadow);
      stepBand(near.band, near.meadow);
      near.owed -= MEADOW_STEP;
      n++;
    }
    if (n === 12) near.owed = 0;
    // Their hour kept to the world's (a slow machine's frames, too few to step every moment,
    // would leave their day behind it).
    const hour = ((t % DAY) / DAY) * 24,
      off = Math.abs(bandHour(near.band) - hour);
    // (While a first meeting is filmed, its own hour: Phase 69.)
    if (Math.min(off, 24 - off) > 0.5 && !contactFilm?.playing && !landfallFilm?.playing) {
      near.band.clock = (hour / 24) * BAND_DAY;
      // (Set on past midnight, a new day of theirs, as the world's: they are counted together.)
      near.band.day = Math.max(near.band.day, Math.floor(t / DAY) - near.day0);
    }
    for (const line of near.band.news)
      if (/ fire .* at the new camp\.$/.test(line)) near.kindled = line;
    near.band.news.length = 0;
    meadowScene.update(near.meadow, near.bodies);
    // (While a landing is fought at their camp, those who live there are what the film draws: Phase 70.)
    bandLayer.update(
      landfallFilm?.holdsGround ? { ...near.band, people: [] } : near.band,
      near.time,
      near.meadow,
    );
    campComers?.update(performance.now() / 1000);
    stage.daylight(bandHour(near.band) / 24);
    // Their names over them, once the eye is near enough to tell one from another; the one
    // followed, from any way off.
    const all = rig.distance < NAMES_WITHIN,
      named = all || near.followed >= 0 ? bandLayer.namesOnScreen(near.band) : [];
    labels.update(
      named.flatMap(({ id, at }) => {
        const p = near!.band.people.find((q) => q.id === id),
          followed = id === near!.followed;
        return p?.name && (all || followed)
          ? [
              {
                key: `band:${id}`,
                text: followed ? `👁 ${p.name}` : p.name,
                at,
                priority: followed ? 2 : 1,
              },
            ]
          : [];
      }),
    );
    const wall = performance.now();
    if (wall - near.toldAt >= 250) {
      near.toldAt = wall;
      campPanel.say(
        near.followed >= 0
          ? bandPersonWords(near.band, near.meadow, near.followed) || bandWords(near.band)
          : bandWords(near.band),
      );
      // (What they keep, under it: Phase 49 M211.)
      campPanel.kit(bandKitWords(near.band));
    }
  });
  exposed.folk = () => {
    const body =
        scale === "camp"
          ? (near?.info.figure ?? null)
          : scale === "village"
            ? (plan?.body ?? null)
            : null,
      look = folkLook(body);
    if (!body || !look) return null;
    const hex = (c: readonly number[]) =>
        "#" +
        c
          .map((x) =>
            Math.round(x * 255)
              .toString(16)
              .padStart(2, "0"),
          )
          .join(""),
      band = scale === "camp" ? near?.band : undefined,
      // (At a camp, the one awake standing most in the open: clear of the fire, the shelters and
      // the rest of the band.)
      open = (x: number, z: number) =>
        band
          ? Math.min(
              Math.hypot(x - band.camp.x, z - band.camp.z),
              ...band.shelters.map((s) => Math.hypot(x - s.x, z - s.z)),
              ...band.people
                .filter((q) => q.x !== x || q.z !== z)
                .map((q) => Math.hypot(x - q.x, z - q.z)),
            )
          : 0,
      one = band
        ? [...band.people]
            .filter(
              (p) =>
                p.doing !== "sleeping" && Math.hypot(p.x - band.camp.x, p.z - band.camp.z) < 40,
            )
            .sort((a, b) => open(b.x, b.z) - open(a.x, a.z) || a.id - b.id)[0]
        : village.peopleNow().find((p) => p.activity !== 0);
    return {
      stance: look.stance,
      arms: look.arms,
      eyes: look.eyes,
      crest: look.crest > 0,
      horns: look.horns,
      feelers: look.feelers,
      tail: look.tail > 0.12,
      hide: hex(look.hide),
      mark: hex(look.mark),
      parts: figureOf(body, fieldDetail()).parts.length,
      at: one ? { x: one.x * 0.1, z: one.z * 0.1 } : null,
      middle: band ? { x: band.camp.x * 0.1, z: band.camp.z * 0.1 } : null,
      // (Which way the one at the camp faces, as the eye's turn: the eye there sees their face.)
      facing: band && one && "heading" in one ? (one.heading * 180) / Math.PI : null,
    };
  };
  exposed.near = () =>
    near && bandLayer
      ? {
          cell: near.info.cell,
          camp: near.info.camp.id,
          people: near.band.people.length,
          beasts: near.meadow.beasts.length,
          kinds: near.meadow.kinds.map((k) => k.name),
          hour: bandHour(near.band),
          day: near.band.day,
          kills: near.band.kills,
          doing: bandWords(near.band),
          parts: bandLayer.count(),
          names: near.band.people.map((p) => p.name),
          followed:
            near.followed >= 0
              ? (near.band.people.find((p) => p.id === near!.followed)?.name ?? null)
              : null,
          // (Where each of them is on the screen, for the look tools to tap.)
          onScreen: near.band.people.map((p) => ({
            id: p.id,
            at: bandLayer!.onScreen(near!.band, p.id),
          })),
          // Their crafts (Phase 49 M211): who is at one and what they are making, in their words;
          // what the band keeps; the things made; the fire at this camp, and the last one made;
          // what they make them of; the work ground, and the crafts as drawn.
          crafting: near.band.people
            .filter((p) => CRAFT_DOINGS.includes(p.doing))
            .map((p) => ({
              id: p.id,
              kin: p.kin,
              doing: p.doing,
              words: bandPersonWords(near!.band, near!.meadow, p.id),
              at: { x: p.x * 0.1, z: p.z * 0.1 },
            })),
          kit: { ...near.band.kit },
          kitWords: bandKitWords(near.band),
          made: near.band.made,
          camps: near.band.camps,
          lit: near.band.lit,
          kindled: near.kindled,
          craft: near.info.craft,
          work: { x: near.band.work.x * 0.1, z: near.band.work.z * 0.1 },
          frame: { x: near.band.frame.x * 0.1, z: near.band.frame.z * 0.1 },
          drawn: bandLayer.craftsDrawn(),
        }
      : null;
  // (The look tools: the band seen near packs up at its next morning, as when the land about its
  // camp is eaten bare — to watch the fire made at fresh ground.)
  exposed.moveCamp = () => {
    if (near) near.band.here = Math.max(near.band.here, 5);
  };
  // A battle watched (Phase 37 M186, asked for 2026-10-24: "i still cant see warfare and like wars
  // like theres no coherent animations and battle between them or a way to make time in a way for
  // me to see the carnage"): down on the field a battle of history was fought on, the world's
  // clock held while it is watched, and the battle on a clock of its own — held still, at half
  // its pace, its own, twice or four times, again from its start, or drawn back and forth to any
  // moment of it; one who fought followed where tapped, and told.
  const battlePanel = new BattlePanel(hud);
  let battleLayer: BattleLayer | null = null,
    fight: {
      info: BattleNear;
      field: BattleField;
      meadow: MeadowState;
      /** Its moment (its seconds), its speed (of BATTLE_SPEEDS), the speed it was at before held. */
      s: number;
      speed: number;
      was: number;
      now: BattleNow;
      /** Where each one struck was struck and what came of it (Phase 55). */
      blows: Blows;
      /** Who each figure is, as the battle's roll names him (Phase 55 M227; none: no roll). */
      names: readonly (RollEntry | null)[];
      roll: BattleRoll | null;
      /** The one followed (-1: the hosts), and when they were told last. */
      followed: number;
      toldAt: number;
      /** A battle the god fought (Phase 61): the field his fight is drawn over, and whether it is now. */
      held: HeldField | null;
      hand: boolean;
    } | null = null;
  /**
   * The close field now: as history fought it — or, in a battle the god fought in a soldier's body
   * (Phase 61), from the second he was taken as his fight went.
   */
  const fieldNow = (f: NonNullable<typeof fight>): BattleNow => {
    const drawn = f.held ? handHeld.fieldShown(f.held, f.s) : null;
    f.hand = drawn !== null;
    return drawn ?? blowsAt(f.field, f.blows, battleAt(f.field, f.s), gore);
  };
  /** Where the eye keeps: on the line where they fight, else midway between the two hosts as they go. */
  const battleMiddle = () => {
    if (!fight) return null;
    let fx = 0,
      fz = 0,
      fn = 0;
    for (const t of fight.now.troopers)
      if (t.act === "fight") {
        fx += t.x;
        fz += t.z;
        fn++;
      }
    if (fn >= 6) return { x: (fx / fn) * 0.1, y: 0.15, z: (fz / fn) * 0.1 };
    const mid = [0, 1].map((side) => {
      let x = 0,
        z = 0,
        n = 0;
      for (const t of fight!.now.troopers)
        if (t.side === side && t.act !== "fall" && t.size > 0.3) {
          x += t.x;
          z += t.z;
          n++;
        }
      return n ? { x: x / n, z: z / n } : null;
    });
    const [a, d] = mid,
      at = a && d ? { x: (a.x + d.x) / 2, z: (a.z + d.z) / 2 } : (a ?? d ?? { x: 0, z: 0 });
    return { x: at.x * 0.1, y: 0.15, z: at.z * 0.1 };
  };
  /** The one followed named on the battle's card (Phase 55 M227–M228), as the roll names him. */
  const nameFollowed = () => {
    const f = fight,
      id = f ? f.followed : -1,
      e = f && id >= 0 ? f.names[id] : null;
    if (!f || !e || !f.roll) {
      battlePanel.named(null);
      return;
    }
    void cardOf(
      f.info.event,
      f.roll,
      f.field.troopers[id]!.side,
      e,
      FATE_WORDS[(f.held && handHeld.fateOf(f.held, id)) || figureFate(f.field, f.blows, id)],
    ).then((m) => {
      if (fight === f && f.followed === id) battlePanel.named(m);
    });
  };
  /** The eye kept on one who fought (their id), or on the hosts (null). */
  const followTrooper = (id: number | null) => {
    if (!fight) return;
    fight.followed = id ?? -1;
    fight.toldAt = -Infinity;
    nameFollowed();
    rig.follow =
      id === null
        ? battleMiddle
        : () => {
            const t = fight?.now.troopers[id];
            return t ? { x: t.x * 0.1, y: 0.12 + t.y * 0.1, z: t.z * 0.1 } : null;
          };
    if (id !== null) {
      const t = fight.now.troopers[id];
      if (t)
        rig.flyTo(
          {
            target: { x: t.x * 0.1, y: 0.12 + t.y * 0.1, z: t.z * 0.1 },
            distance: Math.min(rig.distance, 3.5),
          },
          0.8,
        );
    }
  };
  /** The battle's clock: at speed `i` of its own (0 holds it still). */
  const battleSpeed = (i: number) => {
    if (!fight) return;
    const was = fight.speed;
    fight.speed = Math.max(0, Math.min(BATTLE_SPEEDS.length - 1, i));
    if (fight.speed === 0 && was > 0) fight.was = was;
    // (Run on from its end: again from its start.)
    if (fight.speed > 0 && fight.s >= BATTLE_LENGTH) fight.s = 0;
  };
  battleKeys = {
    toggle: () => {
      if (fight) battleSpeed(fight.speed === 0 ? fight.was : 0);
    },
    pick: (i) => {
      if (!fight || i < 1 || i >= BATTLE_SPEEDS.length) return false;
      battleSpeed(i);
      return true;
    },
  };
  // (Given its words, a battle is watched from them; else they are asked of the host.)
  const toBattle = async (event: string, given?: BattleNear): Promise<void> => {
    // (Each figure a man of the battle's roll, Phase 55 M227: asked for with its words.)
    const [info, roll0, members0] = await Promise.all([
      given ?? client.query<BattleNear | null>({ type: "battle.near", args: { event } }),
      client
        .query<BattleRoll | null>({
          type: "battle.roll",
          args: { event, most: mostFor(fieldDetail()) },
        })
        .catch(() => null),
      // (Where history struck each man of it, Phase 55 wave 5.)
      client
        .query<Record<string, StruckMember>>({
          type: "battle.members",
          args: { event, most: mostFor(fieldDetail()) },
        })
        .catch(() => null),
    ]);
    if (!info) return;
    // (A battle the god fought: laid at the figures a side he was taken at, its roll with it, so his
    // fight's bodies are its figures — Phase 61.)
    const most = info.hand?.most ?? mostFor(fieldDetail()),
      [roll, members] =
        most === mostFor(fieldDetail())
          ? [roll0, members0]
          : await Promise.all([
              client
                .query<BattleRoll | null>({ type: "battle.roll", args: { event, most } })
                .catch(() => null),
              client
                .query<Record<string, StruckMember>>({
                  type: "battle.members",
                  args: { event, most },
                })
                .catch(() => null),
            ]);
    leaveScale();
    scale = "battle";
    const detail = fieldDetail();
    if (!meadowScene) {
      meadowScene = new MeadowScene(stage);
      meadowScene.setDetail(detail);
      bandLayer = new BandLayer(stage, meadowScene.root);
    }
    battleLayer ??= new BattleLayer(stage, meadowScene.root);
    labels.clear();
    bubbles.clear();
    globe.visible = false;
    planetPanel.visible = false;
    region.visible = false;
    regionPanel.visible = false;
    regionCell = info.cell;
    client.setInterest({ view: "region", focus: `cell:0:${info.cell}` });
    meadowScene.reset();
    const meadow = newMeadow(info.plan, 0, info.plan.seed, true),
      field = newBattle(info, most);
    // (The field cleared for the hosts, trodden where they go and worn where the fallen lie.)
    fieldMeadow(field, meadow);
    battleLayer.setup(
      field,
      info.figure ? figureOf(info.figure, detail) : null,
      info.figure,
      groundOfLook(meadow.kindOfAge).grass,
    );
    const drawn = newBlows(field),
      names = roll ? rollNames(field, drawn, roll) : [],
      // (Each named man struck where history struck him: his fate, and so his name, the same.)
      blows = roll && members ? newBlows(field, toldBlows(names, members)) : drawn;
    fight = {
      info,
      field,
      meadow,
      s: 0,
      speed: 2,
      was: 2,
      now: blowsAt(field, blows, battleAt(field, 0), gore),
      blows,
      names,
      roll,
      followed: -1,
      toldAt: -Infinity,
      held: info.hand
        ? {
            key: `field|${event}|${most}`,
            most,
            info,
            field,
            drawn: (s) => blowsAt(field, blows, battleAt(field, s), "full"),
          }
        : null,
      hand: false,
    };
    battlePanel.named(null);
    if (bandLayer) bandLayer.root.enabled = false;
    meadowScene.visible = true;
    meadowScene.season(null);
    stage.backdrop("ground", 40);
    battlePanel.show(info, field.per, Math.min(...(field.perOf ?? [field.per])));
    battlePanel.visible = true;
    // (The world waits while its battle is watched.)
    time.hold("battle");
    rig.configure({
      distance: 7.5 * battleWider(),
      minDistance: 1.2,
      maxDistance: 24,
      pitch: -20,
      minPitch: -85,
      maxPitch: -5,
      drift: 0,
      target: [-1, 0.15, 0],
    });
    // (Two hosts that stand apart to fight, on a tall screen: seen more along their line of fire. W1b.)
    rig.yaw = field.fire && aspect() < 1 ? 52 : 14;
    rig.follow = battleMiddle;
  };
  /** A war watched unfolding left for one of its battles (M193): which, where it was, at what speed. */
  type WarLeft = {
    ref: string;
    year: number;
    speed: number;
    /** Left from the wars of an age (M194): its years. */
    age?: { from: number; to: number };
    /** Gone down to as it came (M196): watched from the eve of the charge, the war gone back to once the field is won. */
    fields?: boolean;
  };
  /** The war to go back to from the battle watched (null: none). */
  let warReturn: WarLeft | null = null;
  /** Down to a battle's field, from wherever the eye is (from a war unfolding: back to it after). */
  const watchBattle = async (event: string, fromWar: WarLeft | null = null) => {
    walk.saw("scale");
    pageWindow.close();
    warReturn = fromWar;
    battlePanel.backTo(fromWar?.age ? "‹ The wars" : fromWar ? "‹ The war" : "‹ The land");
    await fadeOver(() => ready("the battle", () => toBattle(event)));
    // (Not shown: nothing to go back from. Gone down to as it came in a war, M196: from the eve
    // of the charge, a step faster than the war went.)
    if (scale !== "battle") warReturn = null;
    else if (fromWar?.fields && fight) {
      fight.s = MOMENTS.charge - 4;
      fight.now = fieldNow(fight);
      battleSpeed(Math.max(1, Math.min(BATTLE_SPEEDS.length - 1, fromWar.speed + 1)));
    }
  };
  /**
   * The town a battle of the world's wars is fought before now, and its land (null: none): while it
   * is fought (`foughtNow`), the town its land's battles are fought before, where one stands there.
   * Its war, the turn it is fought at, and where history fought it (once it has).
   */
  const townFoughtBefore = async (
    war: string,
    turn: number,
    spot?: number,
  ): Promise<{ cell: number; town: string } | null> => {
    const w = warsLive?.wars.find((x) => x.ref === war);
    if (!w || !warsLive || !foughtNow(now(), turn)) return null;
    const n = warNow(w, warsAt(now() / YEAR), warsLive.year),
      at = n?.closing?.at === turn ? n.closing.spot : -1,
      cell =
        at >= 0 && (spot === undefined || spot === at)
          ? ((client.latestFrame("globe")?.arrays.province as Int32Array | undefined)?.[at] ?? -1)
          : -1;
    if (cell < 0) return null;
    const town = await client.query<string | null>({ type: "land.heart", args: { cell } });
    return town ? { cell, town } : null;
  };
  /** The town a battle (its event) is fought before now, and its land (null: watched on its field). */
  const battleTownNow = (event: string) => {
    const w = warsLive?.wars.find((x) => x.battles.some((b) => b.event === event)),
      b = w?.battles.find((x) => x.event === event);
    return w && b ? townFoughtBefore(w.ref, b.year + 1, b.spot) : Promise.resolve(null);
  };
  /** Into the town a battle is fought before, from wherever the eye is: the eye on the fight. */
  const toTownFight = async (to: { cell: number; town: string }, event?: string) => {
    preferredTownBattle = event ? { event, town: to.town } : null;
    walk.saw("scale");
    pageWindow.close();
    warReturn = null;
    arriveField = null;
    if (scale !== "village" || plan?.ref !== to.town)
      await fadeOver(() =>
        ready("the village", async () => {
          leaveScale();
          regionCell = to.cell;
          await toVillage(to.town);
        }),
      );
    faceFightBy = performance.now() + 8000;
  };
  /**
   * A battle watched where it is now (asked for 2026-10-27: "i meant open world warfare on town view
   * not land view"): while it is fought, before the town it is fought before, facing it; a battle
   * past, or on a land no town stands on, on its field (from a war unfolding: back to it after).
   */
  const watchBattleWhere = async (event: string, fromWar: WarLeft | null = null) => {
    const before = await battleTownNow(event);
    if (before) await toTownFight(before, event);
    else await watchBattle(event, fromWar);
  };
  pageWindow.onBattle = (event) => void watchBattleWhere(event);
  tidings.onBattle = (event) => void watchBattleWhere(event);
  events.onBattle = (event) => void watchBattleWhere(event);
  /** Back up to the land it was fought in, low over it (or to the war it was watched from). */
  const leaveBattle = async () => {
    const was = fight?.info;
    if (!was) return;
    if (warReturn) {
      const back = warReturn;
      warReturn = null;
      if (await (back.age ? watchWarAge(back.age, back) : watchWar(back.ref, back))) return;
    }
    await fadeOver(() =>
      ready("the land", () => {
        leaveScale();
        toRegion(was.cell);
        // (Its field faced, where the land draws it: M203 fights before the land's town.)
        arriveField = { event: was.event, cell: was.cell, until: performance.now() + 10_000 };
      }),
    );
  };
  battlePanel.onBack = () => void leaveBattle();
  battlePanel.onPage = () => {
    if (fight) void pageWindow.open(fight.info.event);
  };
  battlePanel.onAgain = () => {
    if (!fight) return;
    fight.s = 0;
    if (fight.speed === 0) battleSpeed(fight.was);
  };
  battlePanel.onSpeed = (i) => battleSpeed(i);
  battlePanel.onScrub = (s) => {
    if (!fight) return;
    fight.s = Math.max(0, Math.min(BATTLE_LENGTH, s));
    fight.now = fieldNow(fight);
  };
  battlePanel.onSide = (ref) => void pageWindow.open(ref);
  // Their weapon traced: the page of what they fought with, from the ground to their hand.
  battlePanel.onWeapon = () => {
    if (fight && fight.followed >= 0) {
      const t = fight.field.troopers[fight.followed];
      if (t) void pageWindow.open(`arm:${fight.info.event}:${t.side}:${t.id}`);
    }
  };
  battlePanel.onMan = (ref) => void pageWindow.open(ref);
  // A tap on the field: one who fought followed (tapped again, the battle's page); the open
  // ground, the hosts again.
  const tapBattle = (x: number, y: number) => {
    if (!fight || !battleLayer) return;
    const who = battleLayer.pick(fight.now, x, y);
    if (who !== null) {
      if (who === fight.followed) void pageWindow.open(fight.info.event);
      else followTrooper(who);
      return;
    }
    if (fight.followed >= 0) followTrooper(null);
  };
  /** How near the eye keeps as the battle goes, unless the viewer has set it: nearer as the lines meet. */
  /**
   * On a tall screen the field is seen from further off, or the two hosts drawn up to shoot at one another are
   * never in the picture together (an upright phone holds under half the breadth a wide one does).
   */
  const battleWider = () => Math.min(1.7, Math.max(1, 0.8 / aspect()));
  const battleDistance = (s: number) => {
    const rout = fight ? routAt(fight.field) : MOMENTS.rout,
      after = Math.min(148, rout + 20),
      wider = battleWider(),
      far = 7.5 * wider,
      // (Hand to hand less so: the lines have closed, and it is the men that are watched.)
      close = 4.8 * (1 + (wider - 1) / 2),
      fire = fight?.field.fire;
    // (Fought by fire no one closes: both hosts kept in the picture to the end. W1b.)
    if (fire?.stands[0] && fire.stands[1])
      return Math.max(
        far * 0.7,
        Math.min(20, (fire.apart * 1.35 * 0.1 * (aspect() < 1 ? 0.8 : 0.95)) / (0.828 * aspect())),
      );
    return s < MOMENTS.charge
      ? far
      : s < MOMENTS.melee
        ? far + (close - far) * ((s - MOMENTS.charge) / (MOMENTS.melee - MOMENTS.charge))
        : s < rout
          ? close
          : s < after
            ? close + (far - close) * ((s - rout) / (after - rout))
            : far;
  };
  stage.onUpdate((dt) => {
    if (scale !== "battle" || !fight || !battleLayer || !meadowScene) return;
    const pace = BATTLE_SPEEDS[fight.speed] ?? 0;
    if (!rig.userZoomed && fight.followed < 0 && !rig.steering)
      rig.distance +=
        (battleDistance(fight.s) - rig.distance) * (1 - Math.exp(-Math.min(dt, 0.1) * 1.5));
    if (pace > 0) {
      fight.s = Math.min(BATTLE_LENGTH, fight.s + Math.min(dt, 0.1) * pace);
      // (At its end it stands, the field as it was left.)
      if (fight.s >= BATTLE_LENGTH) battleSpeed(0);
      // (Gone down to as it came in a war, M196: the field won, back to the war.)
      if (warReturn?.fields && fight.s >= MOMENTS.after + 4) {
        void leaveBattle();
        return;
      }
    }
    fight.now = fieldNow(fight);
    meadowScene.update(fight.meadow, []);
    battleLayer.update(fight.now);
    // A battle fought by day: from the morning into the afternoon as it goes.
    stage.daylight((9 + (7 * fight.s) / BATTLE_LENGTH) / 24);
    const men = menAt(fight.field, fight.now);
    battlePanel.tally(fight.s, men.standing, men.fallen, fight.now.words, fight.speed);
    // Each host's name over it, with how many of it stand; the one followed, marked over them.
    const sides = [fight.info.attacker, fight.info.defender] as const,
      over = battleLayer.hostsOnScreen(fight.now),
      followed = fight.followed >= 0 ? fight.now.troopers[fight.followed] : undefined;
    labels.update([
      ...sides.flatMap((side, i) =>
        over[i]
          ? [
              {
                key: `host:${i}`,
                text: `${i === 0 ? "⚔️" : "🛡️"} ${side.name} · ${men.standing[i]!.toLocaleString("en-US")}`,
                at: over[i],
                priority: 2,
                badge: { realm: side.ref },
              },
            ]
          : [],
      ),
      ...(followed
        ? [{ key: "followed", text: "👁", at: battleLayer.onScreen(followed, 0.3), priority: 3 }]
        : []),
    ]);
    const wall = performance.now();
    if (fight.followed >= 0 && wall - fight.toldAt >= 250) {
      fight.toldAt = wall;
      const hand = fight.hand && fight.held ? handHeld.fateOf(fight.held, fight.followed) : null;
      battlePanel.follow(
        hand
          ? HAND_FATE_WORDS[hand]
          : (blowWords(fight.field, fight.blows, fight.followed, fight.s) ??
              trooperWords(fight.field, fight.followed, fight.s)),
        fight.now.troopers[fight.followed]?.side ?? null,
      );
    } else if (fight.followed < 0 && fight.toldAt !== -Infinity) {
      fight.toldAt = -Infinity;
      battlePanel.follow("", null);
    }
  });
  exposed.watchBattle = async (event: string) => {
    await watchBattle(event);
    return scale === "battle";
  };
  exposed.watchBattleWhere = async (event: string) => {
    await watchBattleWhere(event);
    return scale;
  };
  exposed.battleTownNow = async (event: string) => (await battleTownNow(event))?.town ?? null;
  // Down to a battle's field from the words it is given (its near words, already in hand).
  exposed.watchBattleNear = async (near: BattleNear) => {
    walk.saw("scale");
    pageWindow.close();
    warReturn = null;
    battlePanel.backTo("‹ The land");
    await fadeOver(() => ready("the battle", () => toBattle(near.event, near)));
    return scale === "battle";
  };
  exposed.battle = () =>
    fight && battleLayer
      ? {
          event: fight.info.event,
          hand: fight.hand,
          title: fight.info.title,
          outcome: fight.info.outcome,
          s: fight.s,
          speed: BATTLE_SPEEDS[fight.speed] ?? 0,
          per: fight.field.per,
          figures: [fight.field.hosts[0].n, fight.field.hosts[1].n],
          standing: [...fight.now.standing],
          fallen: [...fight.now.fallen],
          men: menAt(fight.field, fight.now),
          words: fight.now.words,
          bolts: fight.now.bolts?.length ?? 0,
          blood: fight.now.blood.length,
          smoke: fight.now.smoke.length,
          arrows: fight.now.flying.length,
          parts: battleLayer.count(),
          followed:
            fight.followed >= 0
              ? (blowWords(fight.field, fight.blows, fight.followed, fight.s) ??
                trooperWords(fight.field, fight.followed, fight.s))
              : null,
          onScreen: fight.now.troopers
            .filter((t) => t.size > 0.3)
            .slice(0, 400)
            .map((t) => ({
              id: t.id,
              side: t.side,
              act: t.act,
              ...(t.gun ? { gun: true } : {}),
              x: t.x,
              at: battleLayer!.onScreen(t),
            })),
          world: time.stopped,
          cars: fight.now.vehicles?.length ?? 0,
          wrecks: fight.now.vehicles?.filter((v) => v.knocked > 0.5).length ?? 0,
          prone: fight.now.troopers.filter((t) => t.act === "prone").length,
          guns: fight.now.troopers.filter((t) => t.gun).length,
          trench: !!fight.field.ground.trench,
          fire: fight.field.fire ?? null,
          weapon: battlePanel.weaponShown,
          named: battlePanel.manNamed,
          rolled: fight.names.filter((e) => e !== null).length,
        }
      : null;
  exposed.battleAt = (s: number, speed?: number) => {
    if (!fight) return;
    fight.s = Math.max(0, Math.min(BATTLE_LENGTH, s));
    fight.now = fieldNow(fight);
    if (speed !== undefined) battleSpeed(speed);
  };
  // The blood and the wounds shown (Phase 55): a setting, kept in this browser.
  planetPanel.goreNow = () => gore;
  planetPanel.onGore = (g) => {
    gore = g;
    try {
      localStorage.setItem(GORE_KEY, g);
    } catch {
      // Nowhere to remember it: for this visit only.
    }
    if (fight) fight.now = fieldNow(fight);
    // (The battle before the town, drawn again as it ended, in the blood now shown.)
    if (placed) placed.end = null;
  };
  exposed.setGore = (g: string) => {
    if ((GORES as readonly string[]).includes(g)) planetPanel.onGore(g as Gore);
  };
  exposed.followFighter = (id: number | null) => followTrooper(id);
  exposed.blows = () => {
    if (!fight || !battleLayer) return null;
    const { blows, now } = fight,
      acts: Record<string, number> = {};
    for (const t of now.troopers)
      if (t.hit !== undefined || blows.helping[t.id]! >= 0) {
        const key = t.crawl ? "crawl" : t.act;
        acts[key] = (acts[key] ?? 0) + 1;
      }
    return {
      gore,
      dead: [...blows.dead],
      hurt: [...blows.hurt],
      maimed: [...blows.maimed],
      loose: blows.loose.length,
      struck: [...(now.hurt ?? [0, 0])],
      wounds: now.wounds?.length ?? 0,
      stuck: now.stuck?.length ?? 0,
      blood: now.blood.length,
      limbs: (now.limbs ?? []).map((l) => {
        const h = blows.hits[blows.of[l.id]!]!;
        return {
          id: l.id,
          lost: l.lost,
          striker: h.striker,
          from: Math.hypot(l.x - h.x, l.z - h.z),
          y: l.y,
        };
      }),
      drawn: battleLayer.marks(),
      acts,
      onScreen: now.troopers
        .filter((t) => t.hit !== undefined && t.size > 0.3)
        .map((t) => ({
          id: t.id,
          side: t.side,
          act: t.act,
          hit: t.hit!,
          striker: blows.hits[blows.of[t.id]!]!.striker,
          living: blows.hits[blows.of[t.id]!]!.back !== null,
          lost: t.lost ?? null,
          fell: t.fell ?? null,
          crawl: t.crawl > 0,
          since: t.since ?? 0,
          at: battleLayer!.onScreen(t),
        })),
    };
  };
  exposed.clock = () => ({ stopped: time.stopped, speed: time.speed });

  // A war watched unfolding (Phase 38 M193, asked for 2026-10-24: "i still cant see warfare and
  // like wars like theres no coherent animations and battle between them or a way to make time in
  // a way for me to see the carnage"): out on the whole world, a war of history played again on a
  // clock of its own while the world's waits — its host marching from where it set out to each of
  // its battles in turn, each flaring where it was fought as its turn comes, the fallen of each
  // side mounting, the lands taken marked, a seat besieged ringed by the besiegers' tents; the eye
  // going with its host; told as it goes, the battle told of a tap away to be watched fought, and
  // back to the war after.
  const warPanel = new WarPanel(hud);
  /** Whether a war watched goes down to each battle as it is fought (M196): the viewer's, kept from war to war. */
  let warFields = false;
  /** How much larger than the year's a war watched unfolding's figures are drawn, near as the eye comes. */
  const WAR_GRAND = 1.8;
  /**
   * How far the eye leans back over the land while a war is watched (degrees, M195): its hosts
   * seen from the side as they march and meet, not from above — fully this near the face, not at
   * all from where the whole world is seen.
   */
  const WAR_LEAN = 55;
  /** How many men abreast and deep each of its figures is drawn as (M195): its hosts crowds. */
  const WAR_SQUAD = 3;
  const warLean = () => WAR_LEAN * Math.max(0, Math.min(1, (2.7 - rig.distance) / 1.1));
  /** The war's clock: at speed `i` of its own (0 holds it still). */
  const warSpeed = (i: number) => {
    if (!campaign) return;
    const was = campaign.speed,
      span = campaignSpan(campaign.c);
    campaign.speed = Math.max(0, Math.min(WAR_SPEEDS.length - 1, i));
    if (campaign.speed === 0 && was > 0) campaign.was = was;
    // (Run on from its end: again from its declaring.)
    if (campaign.speed > 0 && campaign.year >= span.to) {
      campaign.year = span.from;
      campaign.follow = true;
    }
  };
  /** What of wars watched unfolding changes the globe's drawing (not their hosts' march along their ways). */
  const drawnKey = (map: WarsMap) =>
    `${map.year}|${map.wars
      .map((w) => `${w.ref}:${w.from}:${w.to}:${w.ended}:${w.siege}:${w.battles.length}`)
      .join(",")}`;
  /** The war drawn as it is at its moment: the globe given it anew only when what it shows changes. */
  const drawWar = () => {
    if (!campaign) return;
    campaign.now = campaignAt(campaign.c, campaign.year, campaign.at);
    const map = { ...campaign.now.map, ...(warsLive?.body ? { body: warsLive.body } : {}) },
      key = drawnKey(map);
    if (key !== campaign.drawn) {
      campaign.drawn = key;
      showWars(map);
    }
    campaign.marching.clear();
    if (campaign.now.march !== null) campaign.marching.set(campaign.c.ref, campaign.now.march);
  };
  /** Where the eye looks for the war now: its host's head on its way, else its latest battle, else what it wanted. */
  const warEye = (): { x: number; y: number; z: number } | null => {
    const frame = client.latestFrame("globe");
    if (!frame || !campaign) return null;
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions,
      unitOf = (s: number) => ({ x: p[s * 3]!, y: p[s * 3 + 1]!, z: p[s * 3 + 2]! }),
      w = campaign.now.map.wars[0]!,
      k = campaign.now.march;
    if (k === null) {
      const last = campaign.now.fought.at(-1);
      return unitOf(last && last.spot >= 0 ? last.spot : w.to);
    }
    // (Along the great circle from where it last fought to where it fights next: between its
    // host's head and the defenders' front, as they are drawn.)
    const a = unitOf(w.from),
      b = unitOf(w.to),
      theta = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)));
    if (theta < 1e-6) return b;
    const head = (k * Math.max(0, theta - RANK_STEP * WAR_GRAND)) / theta,
      f = (head + 1) / 2,
      s0 = Math.sin((1 - f) * theta) / Math.sin(theta),
      s1 = Math.sin(f * theta) / Math.sin(theta);
    return { x: a.x * s0 + b.x * s1, y: a.y * s0 + b.y * s1, z: a.z * s0 + b.z * s1 };
  };
  /** The way a war's host goes now (from where it last fought to where it fights next): the eye looks across it. */
  const wayOf = (
    w: WarsMap["wars"][number] | undefined,
  ): { x: number; y: number; z: number } | null => {
    const frame = client.latestFrame("globe");
    if (!frame || !w || w.from === w.to) return null;
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions;
    return {
      x: p[w.to * 3]! - p[w.from * 3]!,
      y: p[w.to * 3 + 1]! - p[w.from * 3 + 1]!,
      z: p[w.to * 3 + 2]! - p[w.from * 3 + 2]!,
    };
  };
  /** How far off the eye keeps to see its host's way and its two hosts whole: nearer for a march from a land next door. */
  const warDistance = (): number => {
    const frame = client.latestFrame("globe");
    if (!frame || !campaign || campaign.now.march === null) return 1.9;
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions,
      w = campaign.now.map.wars[0]!,
      chord = Math.hypot(
        p[w.from * 3]! - p[w.to * 3]!,
        p[w.from * 3 + 1]! - p[w.to * 3 + 1]!,
        p[w.from * 3 + 2]! - p[w.to * 3 + 2]!,
      );
    return Math.max(
      1.4,
      Math.min(
        2.4,
        1 + 2.3 * (chord + hostsDepth(w.attacker.fields, w.defender.fields, WAR_GRAND)),
      ),
    );
  };
  /** The globe turned toward a place on it, eased (`dt` seconds' worth; at once if none). */
  const lookToward = (v: { x: number; y: number; z: number }, dt?: number) => {
    const l = Math.hypot(v.x, v.y, v.z) || 1,
      yaw = (Math.atan2(v.x, v.z) * 180) / Math.PI,
      pitch = Math.max(-78, Math.min(78, (-Math.asin(v.y / l) * 180) / Math.PI)),
      k = dt === undefined ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 1.6),
      turn = ((((yaw - rig.yaw) % 360) + 540) % 360) - 180;
    rig.yaw += turn * k;
    rig.pitch += (pitch - rig.pitch) * k;
  };
  /** Leave the war watched: the world as it is drawn again, its clock let go. */
  const endWar = () => {
    if (!campaign) return;
    campaign = null;
    warKeys = null;
    rig.lean = 0;
    rig.across = null;
    warPanel.visible = false;
    labels.clear();
    time.release("war");
    globeWars.grand = 1;
    globeWars.squad = 1;
    if (scale === "globe") planetPanel.visible = true;
    if (warsLive) showWars(warsLive);
  };
  /** Out on the whole world to watch a war unfold, from its declaring (or as it was left). */
  const watchWar = async (ref: string, left?: WarLeft): Promise<boolean> => {
    const c = await client.query<Campaign | null>({ type: "war.campaign", args: { ref } });
    if (!c) return false;
    pageWindow.close();
    endWar();
    endWarAge();
    await toWholeWorld();
    if (scale !== "globe") return false;
    const span = campaignSpan(c),
      at = foughtAt(c),
      y = Math.max(span.from, Math.min(span.to, left?.year ?? span.from)),
      now = campaignAt(c, y, at);
    campaign = {
      c,
      at,
      year: y,
      speed: left?.speed ?? 2,
      was: 2,
      now,
      drawn: "",
      marching: new Map(),
      follow: true,
      // (Back from a battle: those fought are seen; only the next is gone down to.)
      seen: left ? now.fought.length : -1,
      zoomed: false,
      fields: left?.fields ?? warFields,
    };
    // (The world waits while its war is watched.)
    time.hold("war");
    globeWars.grand = WAR_GRAND;
    globeWars.squad = WAR_SQUAD;
    planetPanel.visible = false;
    warPanel.show(c);
    warPanel.fieldsOn = campaign.fields;
    warPanel.visible = true;
    warKeys = {
      toggle: () => {
        if (campaign) warSpeed(campaign.speed === 0 ? campaign.was : 0);
      },
      pick: (i) => {
        if (!campaign || i < 1 || i >= WAR_SPEEDS.length) return false;
        warSpeed(i);
        return true;
      },
    };
    drawWar();
    warPanel.tally(campaign.now, campaign.speed);
    // Near enough to see its host march, facing it.
    const eye = warEye();
    rig.halt();
    if (eye) lookToward(eye);
    rig.userZoomed = true;
    rig.distance = warDistance();
    return true;
  };
  pageWindow.onWar = (ref) => void watchWar(ref);
  tidings.onWar = (event) => void watchWar(event);
  warPanel.onBack = () => endWar();
  warPanel.onPage = () => {
    if (campaign) void pageWindow.open(campaign.c.ref);
  };
  warPanel.onAgain = () => {
    if (!campaign) return;
    campaign.year = campaignSpan(campaign.c).from;
    campaign.follow = true;
    if (campaign.speed === 0) warSpeed(campaign.was);
  };
  warPanel.onSpeed = (i) => warSpeed(i);
  warPanel.onScrub = (year) => {
    if (!campaign) return;
    const span = campaignSpan(campaign.c);
    campaign.year = Math.max(span.from, Math.min(span.to, year));
    drawWar();
    // (Drawn to a moment: its battles by then seen, not gone down to.)
    campaign.seen = campaign.now.fought.length;
    campaign.follow = true;
  };
  warPanel.onFields = (on) => {
    warFields = on;
    if (campaign) campaign.fields = on;
    warPanel.fieldsOn = on;
  };
  warPanel.onSide = (ref) => void pageWindow.open(ref);
  warPanel.onBattle = (event) => {
    if (campaign)
      void watchBattleWhere(event, {
        ref: campaign.c.ref,
        year: campaign.year,
        speed: campaign.speed,
      });
  };
  // (Turning the globe by hand lets the eye's following go, till the next battle is fought.)
  canvas.addEventListener("pointerdown", () => {
    if (campaign) campaign.follow = false;
  });
  // (Nor, brought nearer or farther by hand, does it keep its host's way in view by itself.)
  canvas.addEventListener(
    "wheel",
    () => {
      if (campaign) campaign.zoomed = true;
    },
    { passive: true },
  );
  stage.onUpdate((dt) => {
    if (!campaign) return;
    // (Gone from the globe — into a land, out to the sky, down to a battle: the war is left.)
    if (scale !== "globe") {
      endWar();
      return;
    }
    const span = campaignSpan(campaign.c),
      pace = WAR_SPEEDS[campaign.speed] ?? 0;
    if (pace > 0) {
      campaign.year = Math.min(
        span.to,
        campaign.year + Math.min(dt, 0.1) * pace * WAR_YEARS_A_SECOND,
      );
      // (At its end it stands, the world as the war left it.)
      if (campaign.year >= span.to) warSpeed(0);
    }
    drawWar();
    if (rig.steering) campaign.follow = false;
    if (campaign.now.fought.length !== campaign.seen) {
      // (A battle fought as the war's clock went on, each gone down to: its field, then back, M196.)
      const latest = campaign.now.fought.at(-1),
        down =
          campaign.fields &&
          pace > 0 &&
          campaign.seen >= 0 &&
          campaign.now.fought.length > campaign.seen &&
          !!latest &&
          latest.spot >= 0;
      campaign.seen = campaign.now.fought.length;
      campaign.follow = true;
      if (down) {
        const speed = campaign.speed;
        // (Held while the eye goes down.)
        campaign.was = speed;
        campaign.speed = 0;
        void watchBattle(latest!.event, {
          ref: campaign.c.ref,
          year: campaign.year,
          speed,
          fields: true,
        });
        return;
      }
    }
    rig.lean = warLean();
    // (Its two hosts side by side on the screen: the eye looks across its host's way, while it
    // follows; let go, it turns back to the screen's top, as the globe is turned by hand.)
    rig.across = campaign.follow ? (wayOf(campaign.now.map.wars[0]) ?? rig.across) : null;
    const eye = campaign.follow && !rig.flying ? warEye() : null;
    if (eye) {
      lookToward(eye, dt);
      if (!campaign.zoomed)
        rig.distance += (warDistance() - rig.distance) * (1 - Math.exp(-Math.min(dt, 0.1) * 1.2));
    }
    warPanel.tally(campaign.now, campaign.speed);
  });
  exposed.watchWar = (ref: string) => watchWar(ref);
  exposed.war = () =>
    campaign
      ? {
          ref: campaign.c.ref,
          title: campaign.c.title,
          year: campaign.year,
          span: campaignSpan(campaign.c),
          speed: WAR_SPEEDS[campaign.speed] ?? 0,
          words: campaign.now.words,
          fought: campaign.now.fought.length,
          battles: campaign.c.battles.length,
          won: [...campaign.now.won],
          fallen: [...campaign.now.fallen],
          taken: campaign.now.taken.length,
          march: campaign.now.march,
          siege: campaign.now.map.wars[0]!.siege,
          follow: campaign.follow,
          lean: rig.lean,
          across: rig.across !== null,
          fields: campaign.fields,
          drawn: {
            marching: globeWars.counts.marching,
            battle: globeWars.counts.battle,
            fallen: globeWars.counts.fallen,
            tents: globeWars.counts.tents,
            men: globeWars.counts.men,
          },
          marks: campaignMarks().map((m) => m.text),
          world: time.stopped,
          panel: !warPanel.element.hidden,
        }
      : null;
  exposed.warAt = (year: number, speed?: number) => {
    if (!campaign) return;
    const span = campaignSpan(campaign.c);
    campaign.year = Math.max(span.from, Math.min(span.to, year));
    if (speed !== undefined) warSpeed(speed);
    drawWar();
    campaign.seen = campaign.now.fought.length;
    campaign.follow = true;
  };
  exposed.leaveWar = () => endWar();

  // The wars of an age watched unfolding together (Phase 38 M194): out on the whole world, the
  // bloodiest wars of a hundred years played again at once on a clock of their own (two years a
  // second at their own pace), while the world's waits — each host marching from battle to battle,
  // each battle flaring in its turn, the eye going to each as it is fought; the age's battles and
  // fallen mounting; its latest battle and its war a tap away.
  const warAgePanel = new WarAgePanel(hud);
  const ageSpeed = (i: number) => {
    if (!warAge) return;
    const was = warAge.speed,
      span = warAgeSpan(warAge.a);
    warAge.speed = Math.max(0, Math.min(WAR_SPEEDS.length - 1, i));
    if (warAge.speed === 0 && was > 0) warAge.was = was;
    if (warAge.speed > 0 && warAge.year >= span.to) {
      warAge.year = span.from;
      warAge.follow = true;
    }
  };
  const drawWarAge = () => {
    if (!warAge) return;
    warAge.now = warAgeAt(warAge.a, warAge.year, warAge.at);
    const map = { ...warAge.now.map, ...(warsLive?.body ? { body: warsLive.body } : {}) },
      key = drawnKey(map);
    if (key !== warAge.drawn) {
      warAge.drawn = key;
      showWars(map);
    }
  };
  /** Leave the age watched: the world as it is drawn again, its clock let go. */
  const endWarAge = () => {
    if (!warAge) return;
    warAge = null;
    warKeys = null;
    rig.lean = 0;
    rig.across = null;
    warAgePanel.visible = false;
    labels.clear();
    time.release("wars");
    globeWars.grand = 1;
    globeWars.squad = 1;
    if (scale === "globe") planetPanel.visible = true;
    if (warsLive) showWars(warsLive);
  };
  /** Out on the whole world to watch the wars of an age unfold (the last hundred years, if not said). */
  const watchWarAge = async (
    years?: { from?: number; to?: number },
    left?: WarLeft,
  ): Promise<boolean> => {
    const a = await client.query<WarAge>({
      type: "wars.age",
      args: {
        ...(years?.from !== undefined ? { from: years.from } : {}),
        ...(years?.to !== undefined ? { to: years.to } : {}),
      },
    });
    pageWindow.close();
    endWar();
    endWarAge();
    await toWholeWorld();
    if (scale !== "globe") return false;
    const span = warAgeSpan(a),
      at = a.wars.map((c) => foughtAt(c)),
      y = Math.max(span.from, Math.min(span.to, left?.year ?? span.from));
    warAge = {
      a,
      at,
      year: y,
      speed: left?.speed ?? 2,
      was: 2,
      now: warAgeAt(a, y, at),
      drawn: "",
      follow: true,
      seen: -1,
      zoomed: false,
    };
    time.hold("wars");
    globeWars.grand = WAR_GRAND;
    globeWars.squad = 2;
    planetPanel.visible = false;
    warAgePanel.show(a);
    warAgePanel.visible = true;
    warKeys = {
      toggle: () => {
        if (warAge) ageSpeed(warAge.speed === 0 ? warAge.was : 0);
      },
      pick: (i) => {
        if (!warAge || i < 1 || i >= WAR_SPEEDS.length) return false;
        ageSpeed(i);
        return true;
      },
    };
    drawWarAge();
    warAgePanel.tally(warAge.now, warAge.speed);
    rig.halt();
    rig.userZoomed = true;
    rig.distance = 2.6;
    return true;
  };
  /** Where the eye looks for the age now: its latest battle (else its first war's way). */
  const ageEye = (): { x: number; y: number; z: number } | null => {
    const frame = client.latestFrame("globe");
    if (!frame || !warAge) return null;
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions,
      spot = warAge.now.latest?.battle.spot ?? warAge.now.map.wars[0]?.to ?? -1;
    return spot >= 0 ? { x: p[spot * 3]!, y: p[spot * 3 + 1]!, z: p[spot * 3 + 2]! } : null;
  };
  warAgePanel.onBack = () => endWarAge();
  warAgePanel.onAgain = () => {
    if (!warAge) return;
    warAge.year = warAgeSpan(warAge.a).from;
    warAge.follow = true;
    if (warAge.speed === 0) ageSpeed(warAge.was);
  };
  warAgePanel.onSpeed = (i) => ageSpeed(i);
  warAgePanel.onScrub = (year) => {
    if (!warAge) return;
    const span = warAgeSpan(warAge.a);
    warAge.year = Math.max(span.from, Math.min(span.to, year));
    drawWarAge();
  };
  warAgePanel.onBattle = (event) => {
    if (!warAge) return;
    const war = warAge.now.latest?.war.ref ?? "";
    void watchBattleWhere(event, {
      ref: war,
      year: warAge.year,
      speed: warAge.speed,
      age: { from: warAge.a.from, to: warAge.a.to },
    });
  };
  warAgePanel.onWar = (ref) => void watchWar(ref);
  pageWindow.onWars = (from, to) => void watchWarAge({ from, to });
  canvas.addEventListener("pointerdown", () => {
    if (warAge) warAge.follow = false;
  });
  canvas.addEventListener(
    "wheel",
    () => {
      if (warAge) warAge.zoomed = true;
    },
    { passive: true },
  );
  stage.onUpdate((dt) => {
    if (!warAge) return;
    if (scale !== "globe") {
      endWarAge();
      return;
    }
    const span = warAgeSpan(warAge.a),
      pace = WAR_SPEEDS[warAge.speed] ?? 0;
    if (pace > 0) {
      warAge.year = Math.min(
        span.to,
        warAge.year + Math.min(dt, 0.1) * pace * WAR_AGE_YEARS_A_SECOND,
      );
      if (warAge.year >= span.to) ageSpeed(0);
    }
    drawWarAge();
    if (rig.steering) warAge.follow = false;
    if (warAge.now.fought !== warAge.seen) {
      warAge.seen = warAge.now.fought;
      warAge.follow = true;
    }
    rig.lean = warLean();
    // (Across the way of the war of its latest battle.)
    const latest = warAge.now.latest?.war.ref;
    rig.across = warAge.follow
      ? (wayOf(warAge.now.map.wars.find((w) => w.ref === latest) ?? warAge.now.map.wars[0]) ??
        rig.across)
      : null;
    const eye = warAge.follow && !rig.flying ? ageEye() : null;
    if (eye) {
      lookToward(eye, dt);
      if (!warAge.zoomed)
        rig.distance += (2.3 - rig.distance) * (1 - Math.exp(-Math.min(dt, 0.1) * 1.2));
    }
    warAgePanel.tally(warAge.now, warAge.speed);
  });
  exposed.watchWarAge = (from?: number, to?: number) =>
    watchWarAge({ ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) });
  exposed.warAge = () =>
    warAge
      ? {
          from: warAge.a.from,
          to: warAge.a.to,
          wars: warAge.a.wars.length,
          year: warAge.year,
          span: warAgeSpan(warAge.a),
          speed: WAR_SPEEDS[warAge.speed] ?? 0,
          words: warAge.now.words,
          under: warAge.now.under,
          fought: warAge.now.fought,
          fallen: warAge.now.fallen,
          latest: warAge.now.latest
            ? { event: warAge.now.latest.battle.event, war: warAge.now.latest.war.ref }
            : null,
          drawn: {
            marching: globeWars.counts.marching,
            battle: globeWars.counts.battle,
            fallen: globeWars.counts.fallen,
            tents: globeWars.counts.tents,
          },
          marks: campaignMarks().map((m) => m.text),
          world: time.stopped,
          panel: !warAgePanel.element.hidden,
        }
      : null;
  exposed.warAgeAt = (year: number, speed?: number) => {
    if (!warAge) return;
    const span = warAgeSpan(warAge.a);
    warAge.year = Math.max(span.from, Math.min(span.to, year));
    if (speed !== undefined) ageSpeed(speed);
    drawWarAge();
  };
  exposed.leaveWarAge = () => endWarAge();
  // The ways to watch a battle, a tap apart (Phase 55 M230): its war over the world, its hosts on
  // the land, fought before its town, its field close — offered wherever one is watched; each gone
  // to as from nowhere (what the view left held — its clock, the one followed, the way back to a war
  // or to a field coming down to — let go).
  const warViews = new WarViews(hud);
  /** The battle watched now and the view it is watched in (null: none). */
  const viewedNow = (): { at: WarView; b: WarViewed } | null => {
    const near = (i: BattleNear): WarViewed => ({
      war: i.war,
      event: i.event,
      cell: i.cell,
      year: i.year,
    });
    if (scale === "battle" && fight) return { at: "field", b: near(fight.info) };
    const preferred = preferredTownBattle;
    if (scale === "village" && preferred && preferred.town === plan?.ref) {
      for (const w of warsLive?.wars ?? []) {
        const b = w.battles.find((b) => b.event === preferred.event);
        if (b && battleStage(now(), b.year + 1))
          return {
            at: "town",
            b: { war: w.ref, event: b.event, cell: plan!.cell ?? regionCell, year: b.year },
          };
      }
    }
    if (scale === "village" && placed) return { at: "town", b: near(placed.info) };
    if (scale === "globe" && campaign) {
      const last = campaign.now.fought.at(-1);
      return last && last.cell >= 0
        ? {
            at: "globe",
            b: { war: campaign.c.ref, event: last.event, cell: last.cell, year: last.year },
          }
        : null;
    }
    if (scale === "region" && regionWars.now && warsLive) {
      const focus = landBattleFocus;
      if (focus?.cell === regionCell)
        for (const w of warsLive.wars) {
          const b = w.battles.find((b) => b.event === focus.event);
          if (b)
            return {
              at: "land",
              b: { war: w.ref, event: b.event, cell: regionCell, year: b.year },
            };
        }
      for (const f of regionWars.now.fights) {
        if (f.stage === "drawn") continue;
        const turn = Number(f.key.split(":").at(-1)),
          b = warsLive.wars.find((w) => w.ref === f.ref)?.battles.find((x) => x.year === turn - 1);
        if (b)
          return { at: "land", b: { war: f.ref, event: b.event, cell: regionCell, year: b.year } };
      }
    }
    return null;
  };
  stage.onUpdate(() => {
    const v = viewedNow();
    warViews.show(v?.at ?? null, v ? warViewsClosed(v.b, now()) : {});
    // (Under the close field's bar, or the war's over the world, as it grows with what it tells —
    // its hosts' cards and its lines are in it; read each frame, after the frame's words are set.)
    const bar =
      v === null
        ? null
        : scale === "battle"
          ? battlePanel.element.querySelector("header")
          : scale === "globe" && campaign
            ? warPanel.element.querySelector("header")
            : null;
    warViews.below(bar ? bar.getBoundingClientRect().bottom : null);
  });
  /** To a view of the battle watched now. */
  const switchView = async (to: WarView): Promise<void> => {
    const v = viewedNow();
    if (!v || v.at === to || warViewsClosed(v.b, now())[to] !== undefined) return;
    const b = v.b;
    walk.saw("scale");
    pageWindow.close();
    warReturn = null;
    arriveField = null;
    if (to === "field") {
      await watchBattle(b.event);
      return;
    }
    if (to === "globe") {
      await watchWar(b.war, { ref: b.war, year: b.year + 1, speed: 0, fields: false });
      return;
    }
    if (to === "land") {
      landBattleFocus = { event: b.event, cell: b.cell };
      await fadeOver(() =>
        ready("the land", () => {
          leaveScale();
          toRegion(b.cell);
          arriveField = { event: b.event, cell: b.cell, until: performance.now() + 10_000 };
        }),
      );
      return;
    }
    // Before its town: the town its land's battles are fought before, at the world's moment.
    const heart = await client.query<string | null>({ type: "land.heart", args: { cell: b.cell } });
    if (!heart) return;
    await toTownFight({ cell: b.cell, town: heart }, b.event);
  };
  warViews.onView = (to) => void switchView(to);
  exposed.warViews = () => warViews.state;
  exposed.warView = async (to: string) => {
    await switchView(to as WarView);
    return scale;
  };
  // The land's weather where the eye is on the ground (Phase 30 M162, asked for 2026-10-24: "be
  // able to pause and influence and all that"): among a band, over a land, in a town — its sky
  // read every few seconds (and at once when the god's hand falls), and played moment by moment:
  // showers and storms, snow, a dry year's haze, the god's rain poured down or withheld. Told by
  // the spell, the day or the season as fast as the clock runs; still while it is.
  let skyAsked = { cell: -1, at: -Infinity },
    landSeason = { key: "", at: -Infinity },
    weatherSeconds = 0,
    weatherNow: Weather | null = null,
    /** Whether a storm's thunder can be heard from where a person is, and the last flash (Sound, first slice). */
    thunderHere = false,
    flashWas = 0,
    handNow: ActsNear | null = null,
    seasonNow: GroundSeason | null = null;
  /** The land's middle where the eye is (an inspiration's light, a stone's fall): a band's fire, a land's middle, a town's square. */
  const landMiddle = (): { x: number; y: number; z: number } | null => {
    if (scale === "camp" && near)
      return { x: near.band.camp.x * 0.1, y: 0.02, z: near.band.camp.z * 0.1 };
    if (scale === "region") {
      const g = region.groundAt(region.tileAt(0, 0));
      return g ? { x: 0, y: g.y, z: 0 } : null;
    }
    return scale === "village" ? { x: 0, y: 0, z: 0 } : null;
  };
  /** Where a town of the land is, and how far it reaches, where the eye is (null: not seen). */
  const townSpot = (ref: string) => {
    if (scale === "region") {
      const d = region.land.townAt(ref);
      if (d) {
        const g = region.groundAt(region.tileAt(d.x, d.z));
        return { x: d.x, y: g?.y ?? 0, z: d.z, r: d.r };
      }
      const v = villages.find((w) => w.ref === ref),
        g = v ? region.groundAt(v.tile) : null;
      return g ? { x: g.x, y: g.y, z: g.z, r: 0.5 } : null;
    }
    // (A town drawn lot by lot shows a fire on it home by home, each catching and burning as it
    // did — Phase 42 M201 — and not these flames over the whole of it.)
    return scale === "village" && plan?.ref === ref && village.townReach() <= 0
      ? { x: 0, y: 0, z: 0, r: 40 * VILLAGE_METRE }
      : null;
  };
  const weatherCell = () =>
    // (No weather is told of a colony's ground: its halls are sealed: Phase 64.)
    onColony()
      ? -1
      : scale === "camp"
        ? (near?.info.cell ?? -1)
        : scale === "region"
          ? regionCell
          : scale === "village"
            ? (plan?.cell ?? regionCell)
            : -1;
  const castWas = palette.onCast;
  palette.onCast = (receipt) => {
    castWas(receipt);
    skyAsked.at = -Infinity;
  };
  stage.onUpdate((dt) => {
    const cell = weatherCell(),
      sky = cell >= 0 && landSky?.cell === cell ? landSky : null;
    if (cell >= 0) {
      const wall = performance.now();
      if (cell !== skyAsked.cell || wall - skyAsked.at > 3000) {
        skyAsked = { cell, at: wall };
        void client
          .query<LandSky>({ type: "land.sky", args: { cell } })
          .then((s) => (landSky = s))
          .catch(() => {});
      }
    }
    // (No rain falls in a town under the sea.)
    const world = client.latestFrame("globe");
    if (!sky || (scale === "village" && !plan?.colony && world && frameUndersea(world))) {
      if (weatherNow) {
        weatherNow = null;
        handNow = null;
        weather.update(null, rig.target, rig.target, rig.distance, weatherSeconds, 0);
        handNear.update(null, rig.target, rig.target, null, () => null, rig.distance, 0, 0);
        stage.weather(null);
        time.weather("", null, "");
      }
      return;
    }
    const running = time.speed > 0;
    if (running) weatherSeconds += dt;
    // Among a band, the land about them greens under the god's rain and parches under a drought
    // (theirs or the god's): its grass and leaf come back the faster or the slower.
    if (scale === "camp" && near) {
      const m = near.meadow;
      if (sky.sent > 0) m.lush = Math.max(m.lush, 1);
      else if (sky.sent < 0 || sky.year < 0.72) m.dry = Math.max(m.dry, 1);
    }
    const t = now(),
      w = weatherAt(sky, t, time.pace, running ? performance.now() / 1000 : null),
      eye = stage.camera.getPosition().clone();
    weatherNow = w;
    // (A flash is over in a moment, so its thunder is read here, as it is drawn.)
    if (w.flash > 0.3 && flashWas <= 0.3 && thunderHere) sound.cue("thunder");
    flashWas = w.flash;
    weather.update(w, rig.target, eye, rig.distance, weatherSeconds, 1100);
    // The season on the ground (M164): snow lying, the leaves turned or fallen, ice on still water.
    const ground = seasonAt(sky, t);
    if (scale === "camp") meadowScene?.season(ground);
    else if (scale === "village") village.season(ground);
    else if (scale === "region") {
      region.season(ground);
      const key = `${cell}:${regionLens}:${seasonKey(ground)}`,
        wall = performance.now();
      if (key !== landSeason.key && wall - landSeason.at > 250) {
        landSeason = { key, at: wall };
        seasonT = t;
        paintRegion();
      }
    }
    seasonNow = ground;
    // The god's hand on the land, seen near (M163): a blessed harvest's gold, a blight's dust, a
    // plague's pall, a town afire, the ground shaking, a stone from the sky.
    const hand = actsNear(sky, t, time.pace);
    handNow = hand;
    handNear.update(
      hand,
      rig.target,
      eye,
      landMiddle(),
      townSpot,
      rig.distance,
      weatherSeconds,
      700,
    );
    // (A blessed harvest greens the band's land as the rain does; a blight parches it.)
    if (scale === "camp" && near) {
      if (hand.motes.some((m) => m.kind === "gold"))
        near.meadow.lush = Math.max(near.meadow.lush, 1);
      if (hand.motes.some((m) => m.kind === "dust")) near.meadow.dry = Math.max(near.meadow.dry, 1);
    }
    stage.weather({
      cloud: w.cloud,
      wet: Math.max(w.rain, w.snow),
      haze: w.haze,
      flash: Math.max(w.flash, hand.strike?.flash ?? 0),
    });
    // The ground shakes while the clock runs (after the rig has set the eye: a jolt, not a drift).
    if (hand.shake > 0 && running) {
      const k = hand.shake * rig.distance * 0.012,
        wall = performance.now();
      stage.camera.translate(
        Math.sin(wall * 0.061) * k,
        Math.sin(wall * 0.083 + 1) * k * 0.6,
        Math.sin(wall * 0.047 + 2) * k,
      );
    }
    // A feast kept in the town seen near, or its market standing (Phase 33 M174–M175); in a downpour,
    // those at their ease in out of it.
    const square =
      scale === "village" && plan ? squareNow(plan, t, village.shelteredNow() > 0) : null;
    time.weather(
      w.icon,
      w.celsius,
      [w.words, ...(square ? [square.words] : []), ...hand.told.map((x) => x.words)].join("; "),
      (square?.icon ?? "") +
        hand.told
          .slice(0, 3)
          .map((x) => x.icon)
          .join(""),
    );
  });
  exposed.weather = () =>
    weatherNow
      ? {
          cell: weatherCell(),
          words: weatherNow.words,
          icon: weatherNow.icon,
          rain: weatherNow.rain,
          snow: weatherNow.snow,
          cloud: weatherNow.cloud,
          haze: weatherNow.haze,
          warmth: weatherNow.warmth,
          drops: weather.shown.drops,
          flakes: weather.shown.flakes,
          hand: {
            told: handNow?.told.map((x) => x.words) ?? [],
            ...handNear.shown,
            shake: handNow?.shake ?? 0,
          },
          sky: document.body.dataset.sky ?? "",
          sheltered: scale === "village" ? village.shelteredNow() : 0,
          seconds: weatherSeconds,
          season: seasonNow ?? { snow: 0, leaf: 1, turned: 0, ice: 0 },
          ground:
            scale === "camp" && near
              ? near.meadow.lush > 0
                ? "greening"
                : near.meadow.dry > 0
                  ? "parching"
                  : ""
              : "",
        }
      : null;
  villagePanel.onClose = () => selectPerson(null);
  villagePanel.onBack = () => {
    const native = plan?.native;
    village.visible = false;
    villagePanel.visible = false;
    plan = null;
    if (native) return void toFolkWorld(native.star, native.index);
    toRegion(regionCell);
  };
  stage.onUpdate(() => {
    if (scale !== "village" || !plan) return;
    // (While its landing is filmed, there is no town yet.)
    if (colonyFilm?.townAway) return;
    const t = now(),
      // A town watched growing (days, months, years a second): its people at their morning's
      // work and its sky by day, not a day's round flashing by in every frame.
      seen = raidPlaying
        ? raidPlaying.t
        : fleetFilm?.townHeld
          ? Math.floor(t / DAY) * DAY + fleetFilm.hour * DAY
          : landfallFilm?.townHeld
            ? Math.floor(t / DAY) * DAY + landfallFilm.hour * DAY
            : time.lapse || ruling()
              ? Math.floor(t / DAY) * DAY + 10 * 3600
              : t;
    stage.daylight(
      plan.colony
        ? colonyHour(plan.colony, time.lapse ? 0 : seen - colonyFrom)
        : // (A home looked into is seen by day, whatever the hour its people keep: Lives L6.)
          homeOpen()
          ? 0.45
          : (seen % DAY) / DAY,
    );
    // Those at their ease go in out of a downpour (Phase 30), and come out when it is over; and all
    // of the town while a battle is fought before it, but for those come out to watch (Phase 55 M227).
    const sky = landSky?.cell === weatherCell() ? landSky : null,
      kept = placed ? battleShelter(placed.turn) : null;
    village.update(
      seen,
      // (All indoors while raiders are in the streets, Phase 67, or machines are over the town, W2.)
      fleetFilm?.townHeld ||
        landfallFilm?.townHeld ||
        (scale === "village" && raidOver(plan?.town, seen))
        ? { from: seen - 3600, to: seen + 3600, all: true }
        : kept && seen >= kept.from && seen < kept.to
          ? { ...kept, all: true }
          : sky
            ? downpourAt(sky, seen, time.pace)
            : null,
      !time.lapse,
    );
    // The town's stores and its work today (Phase 39 M198), as they are told.
    // (No stores are told of a people's town on another world: history keeps none.)
    const told = plan?.native ? null : village.storesShown();
    if (told !== storesTold) villagePanel.storesNow((storesTold = told));
    if (watched !== null) {
      villagePanel.moment(
        village.momentAt(watched),
        plan.people[watched]?.tool,
        village.borneNow(watched),
      );
      // (What they are doing now, on their page.)
      const m = village.momentAt(watched),
        p = plan.people[watched];
      if (m && p && pageWindow.current === p.ref)
        pageWindow.setLive(villagePanel.nowWords(m, p.tool, village.borneNow(watched)));
      // Their day told (Phase 45 M207), on their page or the card of one of the town's many: a
      // town watched growing has no day to tell.
      const fine = !time.lapse,
        day = Math.floor(seen / DAY);
      if (
        !theirs ||
        theirs.plan !== plan ||
        theirs.i !== watched ||
        theirs.day !== day ||
        theirs.fine !== fine
      )
        theirs = { plan, i: watched, day, fine, lines: fine ? dayTold(plan, watched, day) : [] };
      const slot = p?.folk
        ? villagePanel.folkMore
        : p && pageWindow.current === p.ref
          ? pageWindow.liveMore
          : null;
      if (slot && theirDay.element.parentElement !== slot) slot.append(theirDay.element);
      theirDay.show(slot ? theirs.lines : null, seen - day * DAY, `${plan.ref}|${watched}|${day}`);
    } else theirDay.show(null, 0, "");
    // The years turn: re-read the plan, so those who died are gone.
    if (Math.floor(clock.t / YEAR) !== planYear) void loadPlan(plan.ref);
    if (signs) bubbles.update(village.bubbles());
    // Families met are named over their homes; under the hand, the village is its own name.
    // Visitors from another star named over their ship (M134).
    const visitors = village.visitorsOnScreen().map((v) => ({
      key: v.key,
      text: v.text,
      at: { x: v.x, y: v.y },
      priority: 1e9,
    }));
    const war = townWar,
      hosts = war
        ? village.hostsOnScreen().flatMap((at, side) => {
            const h = war.hosts.find((x) => x.side === side),
              who = war.sides[side]!;
            return at && h
              ? [
                  {
                    key: `host:${war.ref}:${side}`,
                    text: `${townDoingIcon(h.doing, war.sides[0].host?.arm)} ${who.name.charAt(0).toUpperCase()}${who.name.slice(1)}`,
                    at,
                    priority: 2e9,
                    badge: { realm: who.ref },
                  },
                ]
              : [];
          })
        : [];
    if (plan.hand) {
      labels.update([...hosts, ...visitors]);
      return;
    }
    const names = new Map(
      plan.people.map((p) => [plan!.homes[p.home]!.household, p.name.split(" ").at(-1)!]),
    );
    labels.update([
      ...hosts,
      ...visitors,
      ...village.homesOnScreen().map((h) => ({
        key: h.household,
        text: names.get(h.household) ?? "",
        at: h.at,
        priority: 1,
      })),
    ]);
  });
  exposed.watch = (ref: string) => void toVillage(ref);
  exposed.watching = () => (scale === "village" && plan ? plan.people.length : 0);
  exposed.townOnScreen = () => (scale === "village" && plan ? village.townOnScreen(now()) : null);
  exposed.townShown = () =>
    scale === "village" && plan
      ? {
          ref: plan.ref,
          name: plan.name,
          heart: plan.life?.heart ?? false,
          battle: plan.life?.battle?.event ?? null,
        }
      : null;
  exposed.townScreen = (x: number, z: number) =>
    scale === "village" && plan ? village.screenOf(x, z) : null;
  exposed.country = () => (scale === "village" && plan ? village.countryNow() : null);
  exposed.feast = () =>
    scale === "village" && plan
      ? Object.assign(village.feastNow(), {
          words: squareNow(plan, now(), village.shelteredNow() > 0)?.words ?? "",
          feasts: plan.life?.feasts?.length ?? 0,
        })
      : null;
  exposed.beasts = () => (scale === "village" ? village.beastsDrawn : 0);
  exposed.visitors = () => (scale === "village" ? village.visitorsShown() : null);
  exposed.visitorsOnScreen = () => (scale === "village" ? village.visitorsOnScreen() : []);
  exposed.tapVillage = tapVillage;
  exposed.faunaNow = () => (scale === "village" ? village.faunaNow() : []);
  exposed.holdFauna = (s: number | null) => {
    village.heldFauna = s;
  };
  exposed.carriersNow = () => (scale === "village" ? village.carriersNow() : []);
  exposed.stores = () => {
    const s = scale === "village" && plan ? village.storesShown() : null;
    return s ? { ...s, heaps: village.heapsNow(), card: villagePanel.cardShown() } : null;
  };
  exposed.showStores = () => villagePanel.showStores();
  exposed.personOnScreen = (i: number) =>
    scale === "village" && plan ? village.personOnScreen(i) : null;
  exposed.bubblesNow = () => (scale === "village" ? village.bubbles() : []);
  exposed.peopleNow = () => (scale === "village" ? village.peopleNow() : []);
  exposed.trades = () => (scale === "village" ? village.tradesNow() : null);
  exposed.rackOnScreen = () => (scale === "village" ? village.rackOnScreen() : []);
  exposed.crafts = () => (scale === "village" ? village.craftsNow() : null);
  exposed.potsOnScreen = () => (scale === "village" ? village.potsOnScreen() : []);
  exposed.mouldsOnScreen = () => (scale === "village" ? village.mouldsOnScreen() : []);
  exposed.machinesOnScreen = () => (scale === "village" ? village.machinesOnScreen() : []);
  exposed.benchOnScreen = () => (scale === "village" ? village.benchOnScreen() : []);
  exposed.loomsOnScreen = () => (scale === "village" ? village.loomsOnScreen() : []);
  exposed.legs = (i: number) =>
    scale === "village" && plan ? legsTold(plan, i, Math.floor(now() / 86_400)) : [];
  exposed.felling = () => (scale === "village" ? village.fellingShown() : null);
  exposed.graveyard = (days = 30) => (scale === "village" ? village.graveyardShown(days) : null);
  exposed.wounds = () => (scale === "village" ? village.woundsShown() : null);
  exposed.kin = (ref: string) =>
    client.query<KinCard>({ type: "kin.card", args: { ref, t: now() } });
  exposed.warMenOnScreen = () => (scale === "village" ? village.soldiersOnScreen() : []);
  exposed.littersOnScreen = () => (scale === "village" ? village.littersOnScreen() : []);
  exposed.fields = () => (scale === "village" ? village.fieldsShown() : null);
  exposed.flock = () => (scale === "village" ? village.flockShown() : null);
  exposed.hunt = () => (scale === "village" ? village.huntShown() : null);
  exposed.trade = (days = 0) => (scale === "village" ? village.tradeShown(days) : null);
  exposed.rig = rig;

  // Going to anything (Phase 10 M92): a page's place, from whatever scale is up — the scale
  // left as its own way back would leave it, the world's clock given back, and the way
  // there taken under one fade (through the world, which every scale opens from).
  const leaveScale = () => {
    if (scale === "village") {
      village.visible = false;
      villagePanel.visible = false;
      plan = null;
      watched = null;
    } else if (scale === "camp") {
      if (meadowScene) meadowScene.visible = false;
      if (bandLayer) bandLayer.root.enabled = false;
      campPanel.visible = false;
      rig.follow = null;
      near = null;
    } else if (scale === "battle") {
      if (meadowScene) meadowScene.visible = false;
      battleLayer?.clear();
      if (battleLayer) battleLayer.root.enabled = false;
      battlePanel.visible = false;
      battlePanel.follow("", null);
      battlePanel.named(null);
      labels.clear();
      rig.follow = null;
      fight = null;
      // (The world goes on as it went before the battle was watched.)
      time.release("battle");
    } else if (
      scale === "system" ||
      scale === "cluster" ||
      scale === "galaxy" ||
      scale === "world"
    ) {
      stopSky?.();
      stopSky = null;
      galaxyScene.visible = false;
      galaxyPanel.visible = false;
      worldScene.visible = false;
      worldPanel.visible = false;
    }
  };
  // Keeping a person in view (Phase 10 M94): the village's view follows them as they go.
  let keeping: string | null = null;
  // A person's day told (Phase 45 M207): a line of it still to come, tapped, takes the clock on to
  // it, the eye kept on them.
  const theirDay = new DayTold();
  let theirs: {
    plan: VillagePlan;
    i: number;
    day: number;
    fine: boolean;
    lines: DayLine[];
  } | null = null;
  theirDay.onGo = (s) => {
    const p = watched !== null ? plan?.people[watched] : undefined;
    if (!p || !theirs) return;
    // (The world's clock goes by whole seconds: on to the line's first, not short of it.)
    void client.advance(Math.ceil(theirs.day * DAY + s));
    if (!p.folk) keep(p.ref);
  };
  const keep = (ref: string | null) => {
    keeping = ref;
    rig.follow = ref
      ? () => {
          const i = plan?.people.findIndex((p) => p.ref === keeping) ?? -1,
            m = i >= 0 ? village.momentAt(i) : null;
          return m && !m.hidden ? { x: m.x * VILLAGE_METRE, y: 0, z: m.z * VILLAGE_METRE } : null;
        }
      : null;
    pageWindow.redrawActions();
  };
  // (Steered on over the land, the view lets the person kept in view go.)
  rig.onLetGo = () => keep(null);
  pageWindow.sceneActions = (page) => {
    if (
      scale !== "village" ||
      page.kind !== "person" ||
      !plan?.people.some((p) => p.ref === page.ref)
    )
      return [];
    const on = keeping === page.ref;
    return [
      {
        label: on ? "🎯 Kept in view ✓" : "🎯 Keep in view",
        title: "The view follows them as they go (a drag still turns about them)",
        on,
        run: () => {
          keep(on ? null : page.ref);
          if (!on) rig.flyTo({ distance: Math.min(rig.distance, 9) }, 0.8);
        },
      },
    ];
  };
  // (Kept in view only in their village: another scale, or another village, lets them go.)
  stage.onUpdate(() => {
    if (keeping && (scale !== "village" || !plan?.people.some((p) => p.ref === keeping)))
      keep(null);
  });
  /** The land nearest a spot of the sea, within a few spots (a coast zoomed at), if any. */
  const landNear = (
    spot: number,
    frame: NonNullable<ReturnType<typeof client.latestFrame>>,
  ): { spot: number; cell: number } | null => {
    const grid = sphereGrid((frame.meta as { frequency: number }).frequency),
      province = frame.arrays.province as Int32Array | undefined;
    if (!province) return null;
    let ring = [spot];
    const seen = new Set(ring);
    for (let step = 0; step < 3; step++) {
      const next: number[] = [];
      for (const s of ring)
        for (let k = grid.offsets[s]!; k < grid.offsets[s + 1]!; k++) {
          const n = grid.neighbours[k]!;
          if (seen.has(n)) continue;
          seen.add(n);
          const cell = province[n] ?? -1;
          if (cell >= 0 && density.has(cell)) return { spot: n, cell };
          next.push(n);
        }
      ring = next;
    }
    return null;
  };
  /** Where a spot of the globe is to be faced from (the orbit's turn and tilt). */
  const facingOf = (spot: number): { yaw: number; pitch: number } | null => {
    const frame = client.latestFrame("globe");
    if (!frame) return null;
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions;
    return {
      yaw: (Math.atan2(p[spot * 3]!, p[spot * 3 + 2]!) * 180) / Math.PI,
      pitch: (-Math.asin(p[spot * 3 + 1]!) * 180) / Math.PI,
    };
  };
  const goTo = async (place: Place) => {
    walk.saw("scale");
    // Where it is already in the scene shown: a flight there, not a fade (M94).
    if (scale === "globe" && place.scale === "globe") {
      const f = facingOf(place.spot);
      if (f) {
        rig.flyTo({ ...f, distance: 2.2 });
        globe.mark(place.spot);
        return;
      }
    }
    if (scale === "region" && place.scale === "region" && place.cell === regionCell) {
      const at = place.tile === undefined ? null : region.groundAt(place.tile);
      rig.flyTo({ target: at ?? { x: 0, y: 0, z: 0 }, distance: at ? 60 : regionFit() });
      if (place.tile !== undefined) region.mark(place.tile);
      return;
    }
    if (scale === "village" && place.scale === "village" && place.town === plan?.ref) {
      const who = place.person,
        i = who ? plan.people.findIndex((p) => p.ref === who) : -1,
        m = i >= 0 ? village.momentAt(i) : null;
      if (m) {
        watched = i;
        village.mark(i);
        rig.flyTo({
          target: { x: m.x * VILLAGE_METRE, y: 0, z: m.z * VILLAGE_METRE },
          distance: 8,
        });
        keep(who!);
      } else rig.flyTo({ target: { x: 0, y: 0, z: 0 }, distance: plan.districts ? 78 : 26 });
      return;
    }
    const town =
      place.scale === "village"
        ? await client.query<{ cell: number }>({ type: "settlement", args: { ref: place.town } })
        : null;
    const star =
      place.scale === "world"
        ? await client.query<StarPage>({ type: "galaxy.star", args: { ref: place.star } })
        : null;
    await fadeOver(async () => {
      leaveScale();
      if (scale !== "globe") toGlobe();
      switch (place.scale) {
        case "globe":
          faceSpot(place.spot, 2.2);
          globe.mark(place.spot);
          swoop();
          return;
        case "region": {
          await ready("the land", () => toRegion(place.cell));
          const at = place.tile === undefined ? null : region.groundAt(place.tile);
          if (at) {
            rig.target.set(at.x, at.y, at.z);
            rig.distance = 60;
            region.mark(place.tile!);
          }
          swoop();
          return;
        }
        case "village": {
          regionCell = town!.cell;
          await ready("the village", () => toVillage(place.town));
          const who = place.person;
          if (who && plan) {
            const i = plan.people.findIndex((p) => p.ref === who);
            if (i >= 0) {
              watched = i;
              village.mark(i);
              // (Their village come to: the view on them, kept on them as they go.)
              const m = village.momentAt(i);
              if (m) {
                rig.target.set(m.x * VILLAGE_METRE, 0, m.z * VILLAGE_METRE);
                rig.distance = 8;
              }
              keep(who);
            }
          }
          swoop();
          return;
        }
        case "system":
          await ready("the sky", () => toSystem(), true);
          if (place.body !== undefined) skyScene.mark(place.body);
          return;
        case "body":
          await ready("the sky", () => toSystem(), true);
          await toWorld(place.index);
          return;
        case "cluster": {
          await ready("the stars about us", () => toCluster(), true);
          const i = clusterPlan?.stars.findIndex((x) => x.ref === place.star) ?? -1;
          if (i >= 0) starScene.mark(i, clusterPlan);
          return;
        }
        case "galaxy":
          await ready("the galaxy", () => toGalaxy(), true);
          return;
        case "world":
          await toForeignWorld(star!, place.index, "cluster");
          return;
      }
    });
  };
  /** Come to a scale: drawn back a little, and in to where it stands, as if flown there. */
  const swoop = () => {
    const to = rig.distance;
    rig.distance = Math.min(rig.limits.max, to * 1.8);
    rig.flyTo({ distance: to }, 0.9);
  };
  pageWindow.onGoTo = (place) => void goTo(place);
  // A realm's key figures, each with a home in the town view and a body to take (Lives L1).
  const leaders = installLeaders({
    stage,
    hud,
    client,
    rig,
    village,
    pages: pageWindow,
    possession: person,
    plan: () => (scale === "village" ? plan : null),
    scale: () => scale,
    goTown: (town) => goTo({ scale: "village", town }),
    reload: loadPlan,
    toOrbit: () => setRoam("orbit"),
  });
  pageWindow.onLeaderHome = (l) => void leaders.home(l);
  // A life lived by the god's hand (Lives L3): a possession with a day pace, from Live here or a body held.
  const lifeFlow = installLife({
    stage,
    hud,
    client,
    time,
    rig,
    village,
    pages: pageWindow,
    possession: person,
    plan: () => (scale === "village" ? plan : null),
    scale: () => scale,
    reload: loadPlan,
    toOrbit: () => setRoam("orbit"),
  });
  lifeTap = lifeFlow.tapped;
  // A home looked into (Lives L6): from a page, a lot tapped, the strip of a life.
  const homeFlow = installHome({
    stage,
    hud,
    client,
    time,
    rig,
    village,
    pages: pageWindow,
    possession: person,
    plan: () => (scale === "village" ? plan : null),
    scale: () => scale,
    goTown: (town) => goTo({ scale: "village", town }),
    reload: loadPlan,
    now,
    live: (agent) => lifeFlow.liveAgent(agent),
  });
  homeTap = homeFlow.tapped;
  // A town's money over it (Lives L6): 💰 on its bar.
  const moneyFlow = installMoney({
    stage,
    hud,
    client,
    village,
    rig,
    pages: pageWindow,
    panel: villagePanel,
    plan: () => (scale === "village" ? plan : null),
    scale: () => scale,
    now,
  });
  moneyTap = moneyFlow.tapped;
  moneyPlan = moneyFlow.planNow;
  // (A page's Go to, from a home: the home closed, then gone to.)
  const goToPage = pageWindow.onGoTo;
  pageWindow.onGoTo = (place, ref) => {
    homeFlow.close();
    goToPage(place, ref);
  };
  homeOpen = () => homeFlow.on;
  pageWindow.onHomeLook = (ask: HomeAsk) => void homeFlow.open(ask);
  lifeFlow.onGoIn = (town, who) => void homeFlow.open({ town, person: who });
  villagePanel.onLive = () => void lifeFlow.liveHere();
  regionPanel.onLive = (ref) =>
    void goTo({ scale: "village", town: ref }).then(() => lifeFlow.liveHere());
  // (A ruler's body lived on from: the bar of rule goes; 👑 Rule on the life's tray brings it back.)
  person.onLive = (agent) => {
    ruleLeave();
    leaders.keepHand();
    void lifeFlow.liveAgent(agent);
  };
  // A ruler ruled by the god's hand (Lives L4): decrees, war and peace, marriages, from the leaders tab, a chip at their
  // home, or a life lived as them.
  const reign = installReign({
    stage,
    hud,
    client,
    time,
    pages: pageWindow,
    possession: person,
    leaders,
  });
  const ruleLeader = (l: { ref: string }) => void reign.take(l.ref.slice("rule:".length));
  pageWindow.onLeaderRule = ruleLeader;
  leaders.onRule = ruleLeader;
  lifeFlow.onRule = (realm) => void reign.take(realm);
  ruling = () => reign.on;
  ruleLeave = () => reign.leave();
  // Watch a town grow (Phase 26 M154): down to its land, the eye on it, the clock a year a second.
  const watchGrow = async (cell: number, town: string) => {
    if (!(scale === "region" && regionCell === cell)) await goTo({ scale: "region", cell });
    // (Its land's towns come a moment after the land: the eye goes to the town once it is there.)
    const here = () => scale === "region" && regionCell === cell,
      by = performance.now() + 15000;
    while (here() && !villages.some((v) => v.ref === town) && performance.now() < by)
      await new Promise((done) => setTimeout(done, 100));
    if (!here()) return;
    const fly = () => {
      const tile = villages.find((v) => v.ref === town)?.tile,
        at = region.land.townAt(town),
        ground = tile === undefined ? null : region.groundAt(tile),
        target = at ? { x: at.x, y: ground?.y ?? 0, z: at.z } : (ground ?? { x: 0, y: 0, z: 0 });
      rig.flyTo({ target, distance: Math.max(14, (at?.r ?? 1) * 9), pitch: -42 });
      return { target, drawn: !!at };
    };
    const first = fly();
    time.pick(4);
    if (first.drawn) return;
    // (Its land's towns drawn from their fabric come later still on a slow machine — a minute or
    // more on one drawing in software — the town drawn kilometres from its tile, or the land's
    // ground not yet there to fly to: the eye goes on to it once it is drawn, unless the viewer
    // has moved it meanwhile.)
    const drawnBy = performance.now() + 180_000,
      left = () => {
        const t = rig.target;
        return Math.hypot(t.x - first.target.x, t.z - first.target.z) < 1 || rig.flying;
      };
    while (
      here() &&
      left() &&
      (!region.land.townAt(town) || rig.flying) &&
      performance.now() < drawnBy
    )
      await new Promise((done) => setTimeout(done, 250));
    if (here() && left() && region.land.townAt(town)) fly();
  };
  pageWindow.onWatch = (cell, town) => void watchGrow(cell, town);
  // What a page is of, lit in the scene when it is there (a link followed, not only a tap).
  pointAt = (page) => {
    const p = page.place;
    if (!p) return;
    if (scale === "globe") {
      const spot =
        p.scale === "globe" ? p.spot : p.scale === "region" ? centres.get(p.cell) : undefined;
      if (spot !== undefined) globe.mark(spot);
    } else if (scale === "region") {
      if (p.scale === "village") {
        const v = villages.find((x) => x.ref === p.town);
        if (v) region.mark(v.tile);
      } else if (p.scale === "region" && p.tile !== undefined && p.cell === regionCell)
        region.mark(p.tile);
    } else if (scale === "village" && plan) {
      if (page.kind === "lineage") village.markLineage(page.ref);
      else if (p.scale === "village" && p.person && p.town === plan.ref) {
        const i = plan.people.findIndex((x) => x.ref === p.person);
        if (i >= 0) {
          watched = i;
          village.mark(i);
          village.markBeast(null);
        }
      }
    } else if (scale === "system" && (p.scale === "body" || p.scale === "system")) {
      const i = p.scale === "body" ? p.index : p.body;
      if (i !== undefined) skyScene.mark(i);
    } else if (scale === "cluster" && p.scale === "cluster") {
      const i = clusterPlan?.stars.findIndex((x) => x.ref === p.star) ?? -1;
      if (i >= 0) starScene.mark(i, clusterPlan);
    }
  };
  exposed.goTo = async (ref: string) => {
    const place = await client.query<Place | null>({ type: "place", args: { ref } });
    if (place) await goTo(place);
  };

  regionPanel.onBack = () => {
    if (onColony()) void fadeOver(() => toColonyWorld(regionCell));
    else toGlobe();
  };
  regionPanel.onClose = () => region.mark(null);
  exposed.select = (n: number) => (scale === "globe" ? selectCell(n) : selectTile(n));
  exposed.descend = (cell: number) => toRegion(cell);
  exposed.villages = () => villages.length;
  exposed.landTown = (ref: string) => region.land.townAt(ref);
  exposed.landParts = () => region.land.count;
  exposed.land = () => region.land.info();
  exposed.camps = () =>
    scale === "region" ? region.land.camps.info().map((c) => ({ ...c, cell: regionCell })) : [];
  exposed.landCarrier = (kind: string) => region.land.carrier(kind as CarrierKind);

  stage.onUpdate(() => {
    const camps = landPlan?.camps ?? [];
    if (scale !== "region" || (!villages.length && !camps.length && !campsLabelled)) return;
    campsLabelled = camps.length > 0;
    const at = region.screenOf(villages.map((v) => v.tile)),
      campsAt = region.land.camps.named(stage.camera.camera!),
      wall = performance.now();
    labels.update([
      ...villages.map((v, i) => {
        const said = townNews.get(v.ref);
        return {
          key: v.ref,
          text: said && said.until > wall ? `${v.name} · ${said.text}` : v.name,
          at: at[i] ?? null,
          priority: v.population,
        };
      }),
      // Its bands' camps, under its towns' names (Phase 28 M159).
      ...camps.map((c) => ({
        key: `camp:${regionCell}:${c.id}`,
        text: campWords(c),
        at: campsAt.get(c.id) ?? null,
        priority: -1 + c.people / 1e6,
      })),
      // Its hosts' counters and its battles, over the towns about them (M95, M101).
      ...regionWars.labels().map((l) =>
        l.badge
          ? {
              ...l,
              badge: { realm: l.badge.realm, stance: stanceOf(l.badge.realm, l.badge.war) },
            }
          : l,
      ),
    ]);
  });
  addEventListener("resize", () => {
    if (!rig.userZoomed) rig.distance = scale === "globe" ? globeFit() : regionFit();
  });
  // Open facing the people (the most peopled province), not wherever the camera starts.
  void faceThePeople(false);
  // Begun when strangers come down (?contact, Phase 20 M142): the god calls a people of another
  // star down to the most peopled land; once they have crossed (a year), the eye goes down to
  // the town they came down by. (None at the stars yet: what they are, and that they will come.)
  const strangersCome = async () => {
    const map = await client.query<{ cell: number; people: number }[]>({
        type: "people.map",
        args: {},
      }),
      land = [...map].sort((a, b) => b.people - a.people || a.cell - b.cell)[0];
    if (!land) return;
    const called = await client.command("act.summon", { cell: land.cell }).then(
      (receipt) => receipt,
      () => null,
    );
    if (!called) {
      void pageWindow.open("concept:contact");
      return;
    }
    // (They set out in the year the call took hold, as the world counts its years — at the
    // first moment of a year that is still the year before — and come down after it.)
    const sailed = yearOfMoment(called.t);
    type Sky = { peoples?: { landings: { cell: number; year: number }[] } };
    const landed = async () =>
      !!(await client.query<Sky>({ type: "space.state", args: {} })).peoples?.landings.some(
        (l) => l.cell === land.cell && l.year > sailed,
      );
    // The clock held from the call until the eye is among them: the world is carried on by
    // hand, a year at a time, to the morning after they come down (their landing told at the
    // turn of the year after it), and the town readied, not run on at the globe's pace meanwhile
    // — on a slow machine each ask took seconds, and years went by in them: they had come and
    // gone before they could be seen.
    time.hold("strangers");
    try {
      for (let years = 0; years < 4 && !(await landed()); years++) {
        const now = (await client.advance(0)).t;
        await client.advance((Math.floor(now / YEAR) + 1) * YEAR + 9 * (DAY / 24));
      }
      if (await landed()) {
        await toStrangers(land.cell);
        return;
      }
    } finally {
      time.release("strangers");
    }
    // (Not come in the years carried on: waited on as the world runs.)
    for (let tries = 0; tries < 240; tries++) {
      if (await landed()) {
        time.hold("strangers");
        try {
          await toStrangers(land.cell);
        } finally {
          time.release("strangers");
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  };
  /** Down to the greatest town of the land strangers came down in, and among them there. */
  const toStrangers = async (cell: number) => {
    const towns = await client.query<{ ref: string; cell: number; people: number }[]>({
        type: "towns.map",
        args: {},
      }),
      town = towns.filter((t) => t.cell === cell).sort((a, b) => b.people - a.people)[0];
    if (!town) return;
    // (Seen by day: on to the next morning if they came down by night.)
    const at = (await client.advance(0)).t,
      hour = DAY / 24,
      of = at % DAY;
    if (of < 7 * hour || of >= 17 * hour)
      await client.advance(at - of + (of < 7 * hour ? 0 : DAY) + 9 * hour);
    await exposed.goTo?.(town.ref);
    // Once they are drawn among its people, the eye goes down to them, as a tap on their ship
    // would take it (waited on for as long as a slow machine takes to draw the town).
    for (const end = performance.now() + 120_000; performance.now() < end;) {
      const view = scale === "village" ? village.visitorsView() : null;
      if (view) {
        rig.flyTo({ target: view.at, distance: view.distance, pitch: view.pitch });
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  };
  if (params.has("contact") && !loaded) void strangersCome();
  /** Down in a town at night: the clock taken on to its morning (a town is watched by day). */
  const byDay = async () => {
    const at = (await client.advance(0)).t,
      hour = DAY / 24,
      of = ((at % DAY) + DAY) % DAY;
    if (of < 7 * hour || of >= 17 * hour)
      await client.advance(at - of + (of < 7 * hour ? 0 : DAY) + 9 * hour);
  };
  // Begun from the genesis at the first people (?cradle, Phase 24): the rising flows on into their
  // first years — the eye down on the land most peopled, its bands camped about it (Phase 28
  // M159), near the greatest camp, while they wander; and down to the first camp they settle as
  // it is made (by day), unless the viewer has gone elsewhere by then.
  /**
   * Begun at the first people: their first years rushed by at a year a second (below), unless the
   * god's hand is laid on the world meanwhile — an act cast is watched, not raced past (the rain
   * sent for three years gone in three seconds): the land's clock goes back to its pace then, and
   * is not rushed after. `back`: the land's speed to go back to (its ladder's place; 0, none).
   */
  let cradle: { acted: boolean; back: number } | null = null;
  const castBeforeCradle = palette.onCast;
  palette.onCast = (receipt) => {
    castBeforeCradle(receipt);
    if (!cradle) return;
    cradle.acted = true;
    if (cradle.back > 0 && time.scale === "region" && time.speed === YEAR) time.pick(cradle.back);
    cradle.back = 0;
  };
  const toTheCradle = async (): Promise<boolean> => {
    const map = await client.query<{ cell: number; people: number }[]>({
        type: "people.map",
        args: {},
      }),
      land = [...map].sort((a, b) => b.people - a.people || a.cell - b.cell)[0];
    let down = -1;
    if (land && scale === "globe" && !pageWindow.current) {
      await fadeOver(() => ready("the land", () => toRegion(land.cell)));
      down = land.cell;
      // (Near its greatest camp once the land's camps are drawn.)
      const here = () => scaleNow() === "region" && regionCell === down;
      for (let wait = 0; wait < 40 && here(); wait++) {
        const camps = region.land.camps.info(),
          most = [...camps].sort((a, b) => b.people - a.people)[0];
        if (most) {
          rig.userZoomed = true;
          rig.flyTo({
            target: { x: most.x, y: region.land.camps.points()[camps.indexOf(most)]!.y, z: most.z },
            distance: 18,
            pitch: -36,
          });
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      // (Their first years go by a year a second while they wander: a people's first village may
      // be many years in coming, and at the land's month a second the eye would wait minutes. Not
      // until the eye has come down near them — on a machine slow to draw, the years would go by
      // while it flies, and the first village come before the camps were ever seen — and not over
      // the clock as the viewer has held it or set it going themselves meanwhile; nor before the
      // world goes at all, at its first picture.)
      await firstPicture;
      const pace = time.speed,
        watch = (cradle = { acted: false, back: 0 });
      for (let wait = 0; wait < 240 && here() && rig.flying; wait++)
        await new Promise((r) => setTimeout(r, 250));
      if (here() && !time.stopped && time.speed === pace && !watch.acted) {
        watch.back = TIME_LADDERS.region.speeds.indexOf(pace) + 1;
        time.pick(4);
      }
    }
    const watching = () =>
      !pageWindow.current &&
      (scaleNow() === "globe" || (scaleNow() === "region" && regionCell === down));
    for (let tries = 0; tries < 900; tries++) {
      const towns = await client.query<{ ref: string; cell: number; people: number }[]>({
          type: "towns.map",
          args: {},
        }),
        town = [...towns].sort((a, b) => b.people - a.people)[0];
      if (town) {
        // (Their first village come: the rush over, whatever comes of it.)
        cradle = null;
        if (!watching()) return false;
        await byDay();
        await exposed.goTo?.(town.ref);
        return true;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    cradle = null;
    return false;
  };
  // The eye that watches by itself (Phase 31 M168, asked for 2026-10-24: "i would just watch it
  // emerge and be able to pause and influence and all that"): 🎬 sets it going — each first in
  // the world as it comes, seen where it happened, and the round of the world's life between
  // (view/director.ts). It holds while the clock does or a page is open; the god's hand may be
  // laid on the world while it watches; the viewer's own steering (a drag, the wheel, the keys,
  // free roam) takes the eye back. Begun from the genesis (?watch), it watches from the first
  // village on.
  const directorControls = new DirectorControls(corner, hud);
  // What a run of years came to, once the eye is free to read it (A1).
  const runNote = new RunNote(
    tidings.element,
    client,
    time,
    (ref) => void pageWindow.open(ref),
    () =>
      events.open ||
      directorControls.watching ||
      ["filming", "fleet-filming", "homing", "living", "possessing", "ruling", "paging"].some((c) =>
        document.body.classList.contains(c),
      ) ||
      !!document.querySelector(".jump-screen"),
  );
  if (exposed.jumpedFrom !== undefined) runNote.jumped();
  takeUp.push(() => runNote.fromNow());
  clusterPanel.under(directorControls.caption);
  // A colony's landing watched (Phase 64), and the list of the worlds settled that leads to it.
  colonyFilm = installColonyFilm({
    stage,
    hud,
    client,
    time,
    rig,
    village,
    world: worldScene,
    sky: skyScene,
    now,
    toSystem: async () => {
      allAway();
      regionCell = -1;
      await toSystem();
      return systemPlan!;
    },
    toStars: async () => {
      allAway();
      regionCell = -1;
      await toCluster();
      return clusterPlan!;
    },
    toWorld: toWorldOfColony,
    toTown: toColonyTown,
    cut: (what, work) => fadeOver(() => ready(what, work, true)),
    skyAt: (t) => {
      skyFilmed = t;
    },
    plan: () => (scale === "village" ? plan : null),
    toOrbit: () => {
      setRoam("orbit");
      // (A war or an age of wars being watched is left for it.)
      endWar();
      endWarAge();
    },
  });
  const colonies = new Colonies(hud, client);
  colonies.toldAloud = !navigator.webdriver || params.has("landings");
  corner.prepend(colonies.button);
  colonies.onLanding = (cell) => void colonyFilm!.play(cell);
  colonies.onWorld = (cell) => void toColonyWorld(cell);
  colonies.onFar = (key) => void exposed.seeFilled?.(key);
  tidings.onFilled = (ref) => void seeFilledEvent(ref);
  colonies.onPage = (ref) => {
    colonies.show(false);
    void pageWindow.open(ref);
  };
  colonies.onDown = (cell) =>
    void fadeOver(() => ready("its ground", () => toColonyLand(cell), true));
  colonies.onShown = () => pageWindow.close();
  // Down to a colony's port (Phase 71): its town, the eye over its pads, and a chip that says whose they are.
  const portChip = el("button", "port-chip");
  portChip.hidden = true;
  hud.append(portChip);
  let portCell: number | null = null;
  const toPort = async (cell: number) => {
    const list = await client.query<ColonyEntry[]>({ type: "colony.list" }),
      c = list.find((x) => x.cell === cell);
    if (!c?.town) return;
    const town = c.town;
    await fadeOver(() => ready("its port", () => toColonyTown(cell, town), true));
    const port = await client.query<PortPlan | null>({ type: "trade.port", args: { cell } });
    portCell = cell;
    await new Promise((r) => setTimeout(r, 300));
    const at = village.colony.portNow?.at;
    if (at) rig.flyTo({ target: { x: at.x, y: 2, z: at.z }, distance: 128, pitch: -30 }, 1.2);
    if (port) {
      portChip.textContent = `🛰️ ${port.head}`;
      portChip.dataset.run = port.run;
      portChip.hidden = false;
    }
  };
  portChip.onclick = () => {
    if (portChip.dataset.run) void pageWindow.open(portChip.dataset.run);
  };
  stage.onUpdate(() => {
    if (!portChip.hidden && (scale !== "village" || filming)) portChip.hidden = true;
    // (A page read here stands over the port: the chip gives way to it, and lies over none of its words.)
    portChip.style.visibility = pageWindow.current ? "hidden" : "";
  });
  colonies.onPort = (cell) => void toPort(cell);
  exposed.portNow = () =>
    scale === "village" && village.colony.portNow
      ? {
          ...village.colony.portNow,
          cell: portCell,
          chip: portChip.hidden ? null : portChip.textContent,
        }
      : null;
  worldPanel.onLanding = (cell) => void colonyFilm!.play(cell);
  worldPanel.onDown = colonies.onDown;
  pageWindow.onLanding = (cell) => {
    pageWindow.close();
    void colonyFilm!.play(cell);
  };
  /** The landing an event tells of, if there is one to play. */
  const landingOfEvent = async (event: string) =>
    (await client.query<ColonyEntry[]>({ type: "colony.list" }).catch(() => [])).find(
      (c) => c.event === event && c.town,
    ) ?? null;
  const watchLanding = async (event: string) => {
    const c = await landingOfEvent(event);
    if (c) await colonyFilm!.play(c.cell);
    else {
      const place = await client.query<Place | null>({ type: "place", args: { ref: event } });
      if (place) await goTo(place);
    }
  };
  tidings.onLanding = (event) => void watchLanding(event);
  events.onLanding = (event) => void watchLanding(event);
  // Begun at a landing (?landing, the title's shortest way to one): played once the world stands, the
  // one that shows the most; then the eye is on that ground, and told what it may do there.
  const firstLanding = async () => {
    const list = (await client.query<ColonyEntry[]>({ type: "colony.list" })).filter((c) => c.town),
      best = landingToShow(list, Math.floor(now() / YEAR));
    if (!best) {
      colonies.say("🚀 No ship has come down on another world yet here: it is still to come.");
      return;
    }
    if (await colonyFilm!.play(best.cell))
      colonies.say(
        `🏛️ ${best.name ?? "Its halls"}: tap anyone to read them. 🚀 lists the other worlds.`,
      );
  };
  if (params.has("landing") && !loaded) void firstLanding();
  // Begun at the ages past ours (?past, the title's way to them: Phase 66): in its greatest town, towards
  // evening, when its floors are lit and its streets still seen; then told what it may do there.
  const firstPast = async () => {
    const [top, worlds] = await Promise.all([
      client.query<{ ref: string; name: string; people: number } | null>({ type: "past.town" }),
      client.query<ColonyEntry[]>({ type: "colony.list" }).catch(() => [] as ColonyEntry[]),
    ]);
    if (!top) return;
    // (Its clock held while the town is raised: years go by on the world's own speed otherwise.)
    client.setSpeed(0);
    await exposed.goTo?.(top.ref);
    // (Low and far out, its towers against its sky, its ground under the eye's aim to come down to.)
    rig.flyTo({ target: { x: 0, y: 0.6, z: 0 }, distance: 272, pitch: -8 });
    const remade = new Set(worlds.filter((c) => (c.remade ?? 0) >= 1).map((c) => c.body)).size;
    colonies.say(
      `🌃 ${top.name}, ${top.people.toLocaleString("en")} people. Tap the chip for what this world can do; ⚔️ for its wars; zoom out for its land and its world${remade ? `; 🚀 for the ${remade === 1 ? "world" : `${remade} worlds`} it has remade, and the film of how` : ""}.`,
    );
    // (Said once: the first tap anywhere is the eye's own, and the words stand in its way.)
    document.addEventListener("pointerdown", () => colonies.hush(), { once: true, capture: true });
    if (params.has("hold")) return;
    // (Dusk, and slowly: the last of the light behind them, their windows coming on within the minute.)
    const dusk = Math.floor(now() / DAY) * DAY + 18 * 3600;
    if (dusk > now()) await client.advance(Math.round(dusk));
    client.setSpeed(60);
  };
  if (params.has("past") && !loaded) void firstPast();
  exposed.colonyFilm = colonyFilm;
  contactFilm = installContactFilm({
    stage,
    hud,
    client,
    time,
    rig,
    world: worldScene,
    toWorld: toFolkWorld,
    toGround: toFolk,
    comers: (v) => {
      if (scale === "camp" && near && meadowScene) {
        campComers ??= new VisitorsLayer(stage, meadowScene.root);
        campComers.root.setLocalPosition(near.band.camp.x * 0.1, 0, near.band.camp.z * 0.1);
        campComers.build(
          {
            visitors: v ? [v] : [],
            homes: [],
            fields: [],
            districts: null,
          } as unknown as VillagePlan,
          stage.quality.detail,
        );
      } else if (scale === "village") village.comers(v);
    },
    comersSpot: () =>
      scale === "camp"
        ? (campComers?.spot() ??
          (near ? { x: near.band.camp.x * 0.1 + 6, z: near.band.camp.z * 0.1 } : null))
        : village.comersSpot(),
    cut: (what, work) => fadeOver(() => ready(what, work, true)),
    toOrbit: () => {
      setRoam("orbit");
      endWar();
      endWarAge();
    },
  });
  exposed.contactFilm = contactFilm;
  landfallFilm = installLandfallFilm({
    stage,
    hud,
    client,
    time,
    rig,
    world: worldScene,
    village,
    toWorld: toFolkWorld,
    toGround: toFolk,
    camp: () => (near ? { x: near.band.camp.x, z: near.band.camp.z } : null),
    plan: () => plan,
    scale: () => scale,
    cut: (what, work) => fadeOver(() => ready(what, work, true)),
    toOrbit: () => {
      setRoam("orbit");
      endWar();
      endWarAge();
    },
  });
  exposed.landfallFilm = landfallFilm;
  // A fight among the stars watched (Phase 67, asked for 2026-11-03: "i wanna see the star wars and
  // landing in planets and colonization and all that stuff"), and the list of them under the ⚔️.
  fleetFilm = installFleetFilm({
    stage,
    hud,
    canvas,
    client,
    time,
    rig,
    village,
    toHomeWorld: async () => {
      allAway();
      regionCell = -1;
      toGlobe();
      return globe;
    },
    toForeignWorld: async (star, planet) => {
      allAway();
      regionCell = -1;
      stage.backdrop("space");
      const page = await client.query<StarPage>({ type: "galaxy.star", args: { ref: star } });
      skyStar = page;
      await toForeignWorld(page, planet, "star");
    },
    toDark: () => {
      allAway();
      regionCell = -1;
      stage.backdrop("space");
    },
    toTown: toColonyTown,
    cut: (what, work) => fadeOver(() => ready(what, work, true)),
    plan: () => (scale === "village" ? plan : null),
    toOrbit: () => {
      setRoam("orbit");
      endWar();
      endWarAge();
    },
    openPage: (ref) => void pageWindow.open(ref),
    pageOpen: () => !!pageWindow.current,
    busy: () => !!colonyFilm?.playing,
    overlays: (on) => {
      globeWars.root.enabled = on;
    },
    say: (words) => colonies.say(words),
    hush: () => colonies.hush(),
  });
  exposed.fleetFilm = fleetFilm;
  const nationFilm = installNationFilm({
    stage,
    hud,
    client,
    time,
    toStars: async () => {
      pageWindow.close();
      allAway();
      regionCell = -1;
      // (Its map is who holds them, whatever lens was on.)
      setLens("holds");
      await toCluster();
      clusterPanel.inspector.hidden = true;
    },
    show: (marks: readonly FilmMark[]) => {
      if (!clusterPlan) return;
      nationFilming = true;
      drawHeld(
        clusterPlan,
        marks.map((m) => ({
          star: m.star,
          color:
            m.flash > 0
              ? ([1, 0.92 - 0.5 * (1 - m.flash), 0.7 - 0.6 * (1 - m.flash)] as const)
              : m.dark
                ? DARK_MARK
                : m.color,
          scale: m.flash > 0 ? 1 + 1.5 * m.flash : m.dark ? 0.9 : 1,
        })),
        heldReach(
          clusterPlan,
          marks.map((m) => m.star),
        ),
      );
    },
    done: () => {
      nationFilming = false;
      void askNations();
    },
    openPage: (ref) => void pageWindow.open(ref),
    watchFleet: (id) => void fleetFilm!.play(id),
    busy: () =>
      !!colonyFilm?.playing ||
      !!fleetFilm?.playing ||
      !!contactFilm?.playing ||
      !!landfallFilm?.playing,
  });
  exposed.nationFilm = nationFilm;
  exposed.nationsShown = () => (scale === "cluster" ? starScene.nationsShown : null);
  exposed.nationMap = () => nationNow;
  clusterPanel.onNation = (ref) => void pageWindow.open(ref);
  pageWindow.onNationFall = (ref) => {
    pageWindow.close();
    void nationFilm.play(ref);
  };
  // Great news of a realm among the stars: its coming apart, or the stars as they stand, or the world in the dark.
  const seeNationEvent = async (event: string, auto = false) => {
    const s = await client.query<NationSight>({ type: "nation.sight", args: { event } });
    if (
      /dark/.test(
        (await client.query<{ title: string }>({ type: "page", args: { ref: event } })).title,
      )
    ) {
      if (s.key) await pageWindow.open(s.key);
      return;
    }
    if (s.nation && (await nationFilm.play(s.nation, auto))) return;
    allAway();
    regionCell = -1;
    await toCluster();
  };
  events.onNation = (event) => void seeNationEvent(event);
  tidings.onNation = (event) => void seeNationEvent(event);
  directorNation = (event) => seeNationEvent(event, true);
  // The first jump watched (Phase 68), from its tiding, the law's page and the Director's firsts.
  const jumpFilm = installJumpFilm({
    stage,
    hud,
    client,
    time,
    rig,
    toHomeWorld: async () => {
      allAway();
      regionCell = -1;
      toGlobe();
    },
    toForeignWorld: async (star, planet) => {
      allAway();
      regionCell = -1;
      stage.backdrop("space");
      const page = await client.query<StarPage>({ type: "galaxy.star", args: { ref: star } });
      skyStar = page;
      await toForeignWorld(page, planet, "star");
    },
    cut: (what, work) => fadeOver(() => ready(what, work, true)),
    toOrbit: () => {
      setRoam("orbit");
      endWar();
      endWarAge();
    },
    busy: () =>
      !!colonyFilm?.playing ||
      !!fleetFilm?.playing ||
      !!contactFilm?.playing ||
      !!landfallFilm?.playing,
  });
  exposed.jumpFilm = jumpFilm;
  pageWindow.onJump = () => {
    pageWindow.close();
    void jumpFilm.play();
  };
  tidings.onJump = () => void jumpFilm.play();
  events.onJump = () => void jumpFilm.play();
  directorJump = () => jumpFilm.play(true);
  // What fell on a world of another star (W6): from its tiding, its page, its world's panel and the Director's firsts; the god's hand.
  const farStood = async (star: string, planet: number, stood: boolean) => {
    allAway();
    regionCell = -1;
    stage.backdrop("space");
    const page = await client.query<StarPage>({ type: "galaxy.star", args: { ref: star } });
    skyStar = page;
    await toForeignWorld(page, planet, "star", stood);
  };
  const farFilm = installFarFilm({
    stage,
    hud,
    client,
    time,
    rig,
    scene: worldScene,
    toWorld: farStood,
    paintFace: (dark, mark) => {
      if (seen)
        worldScene.paint(farFace(worldColors(seen, Math.floor(now() / YEAR)), seen, dark, mark));
    },
    cut: (what, work) => fadeOver(() => ready(what, work, true)),
    busy: () =>
      !!colonyFilm?.playing ||
      !!fleetFilm?.playing ||
      !!contactFilm?.playing ||
      !!landfallFilm?.playing ||
      jumpFilm.playing,
    fit: globeFit,
  });
  exposed.farFilm = farFilm;
  exposed.seeWorld = (star, planet) => farStood(star, planet, false);
  exposed.worldRuined = () => worldScene.ruined;
  directorFar = (event) => farFilm.play(event, true);
  tidings.onFar = (event) => void farFilm.play(event);
  events.onFar = (event) => void farFilm.play(event);
  pageWindow.onFar = (event) => {
    pageWindow.close();
    void farFilm.play(event);
  };
  worldPanel.onFarWatch = (event) => void farFilm.play(event);
  worldPanel.onFarPage = (ref) => void pageWindow.open(ref);
  worldPanel.onFarStrike = (star, planet, rung) => {
    void client
      .command("far.strike", { star, planet, rung })
      .then(() => client.query<{ event: string }[]>({ type: "far.falls" }))
      .then((falls) => {
        const f = falls.at(-1);
        if (f) void farFilm.play(f.event);
      })
      .catch((error: Error) => colonies.say(error.message));
  };
  exposed.pageWindowOpen = (ref) => void pageWindow.open(ref);
  const starWars = new StarWars(hud);
  starWars.onWatch = (id) => void fleetFilm!.play(id);
  starWars.onPage = (ref) => {
    starWars.show(false);
    void pageWindow.open(ref);
  };
  starWars.onShown = () => pageWindow.close();
  pageWindow.onStarFight = (id) => {
    pageWindow.close();
    void fleetFilm!.play(id);
  };
  tidings.onStarFight = (id) => void fleetFilm!.play(id);
  pageWindow.onRaid = (event) => void watchRaid(event);
  tidings.onRaid = (event) => void watchRaid(event);
  events.onRaid = (event) => void watchRaid(event);
  // Begun at the wars among the stars (?starwar, the title's way to them): the one best to watch, played
  // once the world stands; then the eye is where it ended.
  const firstStarWar = async () => {
    const fights = await client.query<StarFightList>({ type: "star.fights" });
    if (!fights.best) {
      colonies.say("🌌 No fleet has fought among the stars here yet: it is still to come.");
      return;
    }
    // (Its clock held while the world is taken up: years go by on the world's own speed otherwise.)
    client.setSpeed(0);
    await fleetFilm!.play(fights.best);
    if (params.has("hold")) return;
    // (Then the town as it stands now, at dusk and slowly: its windows coming on, the eye the viewer's.)
    const dusk = Math.floor(now() / DAY) * DAY + 18 * 3600;
    if (dusk > now()) await client.advance(Math.round(dusk));
    client.setSpeed(60);
  };
  if (params.has("starwar") && !loaded) void firstStarWar();
  // (Beside it, the world's wars of the last hundred years watched unfolding: M194.)
  const warsButton = el("button", "director-button wars-button", "⚔️");
  warsButton.title =
    "The world's wars: the bloodiest of the last hundred years played again at once, each host marching from battle to battle";
  warsButton.setAttribute("aria-label", "Watch the world's wars");
  // (Where wars have been fought among the stars, the ⚔️ lists them, the world's wars first: Phase 67.)
  warsButton.onclick = () => {
    if (warAge) return void endWarAge();
    if (starWars.shown) return starWars.show(false);
    void client
      .query<StarFightList>({ type: "star.fights" })
      .catch(() => null)
      .then((fights) => {
        if (fights?.total) starWars.show(true, fights);
        else void watchWarAge();
      });
  };
  starWars.onAge = () => void watchWarAge();
  directorControls.button.after(warsButton);
  let director: Director | null = null,
    take: Take | null = null,
    takeUntil = 0,
    filming = false,
    /** Showing the age of the stars: the clock held, since it is what has been (Phase 73). */
    touring = false,
    /** The lenses worth a look, for the eye's round among the stars; none: this world has not come to them. */
    roundLenses: readonly StarLens[] = [],
    /** The moment shown, and what the viewer has asked of it. */
    stopNow: TourStop | null = null,
    stopAsked: "next" | "page" | null = null,
    /** Asked to stop here: its page, once the film is over. */
    stopPage: string | null = null;
  /** Into the whole world from wherever the eye is. */
  const toWholeWorld = async () => {
    if (scale === "globe") return;
    await fadeOver(() => {
      leaveScale();
      toGlobe();
    });
  };
  /** The stars around under a lens, from wherever the eye is. */
  const toStarsShot = async (lens: StarLens | null) => {
    pageWindow.close();
    if (scale !== "cluster") {
      setLens(lens);
      await fadeOver(() =>
        ready(
          "the stars",
          async () => {
            allAway();
            regionCell = -1;
            await toCluster();
          },
          true,
        ),
      );
    } else setLens(lens);
    clusterPanel.inspector.hidden = true;
    selectStarNone();
  };
  const selectStarNone = () => {
    starScene.mark(null, clusterPlan);
  };
  /** Whichever film is playing, told to skip. */
  const skipFilms = () => {
    if (jumpFilm.playing) jumpFilm.skip();
    if (colonyFilm!.playing) colonyFilm!.skip();
    if (contactFilm!.playing) contactFilm!.skip();
    if (landfallFilm!.playing) landfallFilm!.skip();
    if (fleetFilm!.playing) fleetFilm!.skip();
    if (nationFilm.playing) nationFilm.skip();
    if (farFilm.playing) farFilm.skip();
  };
  const anyFilm = () =>
    jumpFilm.playing ||
    !!colonyFilm?.playing ||
    !!contactFilm?.playing ||
    !!landfallFilm?.playing ||
    !!fleetFilm?.playing ||
    nationFilm.playing ||
    farFilm.playing;
  /** A moment seen with no film of its own: held so long, or until asked on; time the viewer stops, or spends on a page, does not count. */
  const holdStop = async (seconds: number, over: () => boolean = () => false) => {
    let left = seconds * 1000,
      last = performance.now();
    while (left > 0 && !stopAsked && directorControls.watching && !over()) {
      await new Promise((r) => setTimeout(r, 120));
      const t = performance.now();
      if (!time.paused && !pageWindow.current) left -= t - last;
      last = t;
    }
  };
  /** A moment of the age: its film played or its place shown, with its line over it. */
  const filmStop = async (stop: TourStop, n: number, of: number): Promise<void> => {
    const f = stop.film;
    stopNow = stop;
    stopAsked = null;
    directorControls.showStop({ words: stop.words, n, of, page: !!stop.page });
    // (A film's closing card waits for a press where a person watches; the eye moves on when it has been read.)
    let cardAt = 0;
    const closing = setInterval(() => {
      if (stopAsked) skipFilms();
      const card =
        (landfallFilm!.playing && landfallFilm!.state().card) ||
        (contactFilm!.playing && contactFilm!.state().card);
      if (!card) cardAt = 0;
      else if (!cardAt) cardAt = performance.now();
      else if (performance.now() - cardAt > 9000 && !pageWindow.current) skipFilms();
    }, 200);
    try {
      switch (f.kind) {
        case "jump":
          await jumpFilm.play(true);
          break;
        case "landing":
          await colonyFilm!.play(f.cell);
          break;
        case "landfall":
          await landfallFilm!.play(f.star, f.index, f.n);
          break;
        case "contact":
          await contactFilm!.play(f.star, f.index);
          break;
        case "fleet":
          await fleetFilm!.play(f.id);
          break;
        case "nation":
          await nationFilm.play(f.ref, true);
          break;
        case "far":
          await farFilm.play(f.event, true);
          break;
        case "port":
          await toPort(f.cell);
          document.body.classList.add("filming");
          await holdStop(9);
          break;
        case "world":
          await farStood(f.star, f.planet, false);
          document.body.classList.add("filming");
          await holdStop(8);
          break;
        case "filled":
          if (await exposed.seeFilled?.(f.key)) {
            document.body.classList.add("filming");
            await holdStop(8);
          }
          break;
        case "map":
          lensFocus = f.star;
          await toStarsShot(f.lens);
          document.body.classList.add("filming");
          await holdStop(8);
          break;
        case "fire":
          if (await watchRaid(f.event)) {
            document.body.classList.add("filming");
            await holdStop(45, () => !raidPlaying);
            endRaidFilm();
          }
          break;
      }
    } finally {
      clearInterval(closing);
      lensFocus = null;
      document.body.classList.remove("filming");
      directorControls.showStop(null);
      stopNow = null;
    }
  };
  directorControls.onStopNext = () => {
    stopAsked = "next";
    skipFilms();
  };
  directorControls.onStopPage = () => {
    stopPage = stopNow?.page ?? null;
    stopAsked = "page";
    skipFilms();
  };
  /** Film a take: the eye taken where it is seen, the clock at the pace it is best seen at. */
  const film = async (next: Take): Promise<void> => {
    const s = next.shot;
    switch (s.kind) {
      case "stars":
        await toStarsShot(s.lens);
        // (Past the age told, the years go by among them.)
        if (!touring) time.pick(1);
        return;
      case "stop":
        await filmStop(s.stop, s.n, s.of);
        return;
      case "starfight":
        await fleetFilm!.play(s.id);
        return;
      case "first": {
        sound.cue("first");
        // (The first jump: played from its leaving, Phase 68.)
        if (s.first.what.startsWith("🌀") && directorJump) {
          await directorJump();
          return;
        }
        // (What fell on a world of another star: played from it whole, W6.)
        if (/^(🌑|🌫️|☄️)/u.test(s.first.what) && s.first.ref && directorFar) {
          await directorFar(s.first.ref);
          return;
        }
        // (A realm among the stars at its height, coming apart or fallen: on the map of who holds them, Phase 72.)
        if (/^(👑|💔|🏚️)/u.test(s.first.what) && s.first.ref && directorNation) {
          await directorNation(s.first.ref);
          return;
        }
        // (A world filled: out to it, lit across its face.)
        if (s.first.what.startsWith("🌆") && s.first.ref) {
          await seeFilledEvent(s.first.ref);
          return;
        }
        // (The first landing on another world: played from its crossing, not only flown to.)
        const landing = s.first.ref ? await landingOfEvent(s.first.ref) : null;
        if (landing) {
          await colonyFilm!.play(landing.cell);
          return;
        }
        const place = s.first.ref
            ? await client
                .query<Place | null>({ type: "place", args: { ref: s.first.ref } })
                .catch(() => null)
            : null,
          to: Place | null =
            place ?? (s.first.land !== null ? { scale: "region", cell: s.first.land } : null);
        if (!to) await toWholeWorld();
        else {
          if (to.scale === "village") await byDay();
          await goTo(to);
        }
        // (A town's hour, a land's month, the world's year a second.)
        time.pick(scale === "village" ? 2 : scale === "region" ? 3 : 2);
        return;
      }
      case "bands": {
        if (!(scale === "region" && regionCell === s.cell))
          await goTo({ scale: "region", cell: s.cell });
        const camps = region.land.camps.info(),
          most = [...camps].sort((a, b) => b.people - a.people)[0];
        if (most)
          rig.flyTo({
            target: { x: most.x, y: region.land.camps.points()[camps.indexOf(most)]!.y, z: most.z },
            distance: 18,
            pitch: -36,
          });
        time.pick(4);
        return;
      }
      case "camp": {
        if (!(scale === "region" && regionCell === s.cell))
          await goTo({ scale: "region", cell: s.cell });
        // (The land's camps come a moment after the land.)
        for (let wait = 0; wait < 40 && !region.land.camps.info().length; wait++)
          await new Promise((r) => setTimeout(r, 250));
        const most = [...region.land.camps.info()].sort((a, b) => b.people - a.people)[0];
        if (most && scale === "region") await goNear(s.cell, most.id);
        return;
      }
      case "grow":
        await watchGrow(s.cell, s.town);
        return;
      case "street":
        await byDay();
        await exposed.goTo?.(s.town);
        time.pick(2);
        return;
      case "world":
        await toWholeWorld();
        time.pick(2);
        return;
      case "battle":
        // (Down onto its field just before the charge, at twice its pace.)
        await watchBattle(s.event);
        if (scale === "battle") exposed.battleAt?.(36, 3);
        return;
    }
  };
  /** The next take, when the one shown has had its time or a first comes. */
  const direct = async () => {
    if (!directorControls.watching || filming || !director) return;
    // (Held while the clock is, a page is read, or the god's hand holds an act to lay on the
    // world shown: the take lasts on. While it tells the age of the stars the eye itself holds the clock: only the viewer's pause holds it.)
    if (
      (touring ? time.paused : time.stopped && scale !== "battle") ||
      pageWindow.current ||
      palette.holding
    ) {
      takeUntil = Math.max(takeUntil, performance.now() + 1500);
      return;
    }
    filming = true;
    try {
      const firsts = await client.query<WorldFirst[]>({ type: "world.firsts" });
      const news = !touring && untold(director, firsts).length > 0;
      if (performance.now() < takeUntil && !(news && take?.shot.kind !== "first")) return;
      // (The age of the stars, while there is more of it to show; then the clock is let go.)
      const tourNext = tourTake(director);
      if (tourNext) {
        directorControls.tell(tourNext.words);
        take = tourNext;
        takeUntil = Infinity;
        await film(tourNext);
        takeUntil = performance.now() + tourNext.seconds * 1000;
        if (stopPage) {
          const page = stopPage;
          stopPage = null;
          stopWatching();
          await pageWindow.open(page);
        }
        return;
      }
      if (touring) {
        touring = false;
        time.release("tour");
      }
      const towns = await client.query<TownSeen[]>({ type: "towns.map", args: {} }),
        peopled = await client.query<{ cell: number; people: number }[]>({
          type: "people.map",
          args: {},
        });
      if (!directorControls.watching) return;
      // (The battles of the last two years, as the wars' map has them.)
      const battles: BattleSeen[] = warsNow
          ? warsNow.wars.flatMap((w) =>
              w.battles
                .filter((b) => b.year >= warsNow!.year - 2)
                .map((b) => ({ event: b.event, year: b.year, fallen: b.fallen })),
            )
          : [],
        fights = await client.query<StarFightList>({ type: "star.fights" }).catch(() => null),
        star = fights ? starFightTake(director, fights, Math.floor(now() / YEAR)) : null,
        next: Take = star
          ? {
              shot: { kind: "starfight", id: star.id, year: star.year },
              seconds: 6,
              words: star.words,
            }
          : nextTake(director, firsts, towns.slice(0, 12), peopled, battles, roundLenses);
      directorControls.tell(next.words);
      take = next;
      takeUntil = Infinity;
      await film(next);
      takeUntil = performance.now() + next.seconds * 1000;
    } catch {
      // (A take that could not be filmed: the next in its time.)
      takeUntil = performance.now() + 5000;
    } finally {
      filming = false;
    }
  };
  setInterval(() => void direct(), 1000);
  /** Watching from now: what is already in the world is history; `first`, a take already showing. */
  const watchIt = async (first?: { words: string; seconds: number }) => {
    const firsts = await client.query<WorldFirst[]>({ type: "world.firsts" }).catch(() => []),
      tour = await client
        .query<StarTour>({ type: "star.tour" })
        .catch((): StarTour => ({ stops: [], lenses: [] }));
    director = newDirector(firsts);
    director.tour = first ? [] : tour.stops;
    roundLenses = tour.lenses;
    // (Among the stars first, and a battle at home in its turn.)
    if (roundLenses.length) director.battled = 0;
    if (director.tour.length) {
      touring = true;
      // (What has been is told with the clock held, even a clock the viewer had stopped: they asked to be shown.)
      time.holdOverPause("tour");
    }
    take = null;
    takeUntil = first ? performance.now() + first.seconds * 1000 : 0;
    directorControls.watching = true;
    directorControls.tell(first?.words ?? "Watching it emerge…");
  };
  const stopWatching = () => {
    if (!directorControls.watching) return;
    directorControls.watching = false;
    director = null;
    stopAsked = stopAsked ?? "next";
    if (touring) {
      touring = false;
      time.release("tour");
    }
  };
  directorControls.onToggle = (on: boolean) => void (on ? watchIt() : stopWatching());
  // The viewer's own steering takes the eye back: a drag on the world, the wheel, the keys that
  // steer, free roam. (A tap — a place chosen, the hand cast — does not.)
  let pressedAt: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => (pressedAt = { x: e.clientX, y: e.clientY }), true);
  canvas.addEventListener(
    "pointermove",
    (e) => {
      // (Over a film the eye is the film's, and a thumb moved takes nothing back.)
      if (
        pressedAt &&
        e.buttons &&
        !(touring && anyFilm()) &&
        Math.hypot(e.clientX - pressedAt.x, e.clientY - pressedAt.y) > 8
      )
        stopWatching();
    },
    true,
  );
  addEventListener("pointerup", () => (pressedAt = null), true);
  canvas.addEventListener("wheel", () => stopWatching(), { capture: true, passive: true });
  stage.onUpdate(() => {
    if (directorControls.watching && (rig.steering || roaming !== "orbit")) stopWatching();
  });
  exposed.director = () => ({
    watching: directorControls.watching,
    told: directorControls.told,
    take: take ? { kind: take.shot.kind, words: take.words } : null,
    filming,
    touring,
    tourAt: director?.tourAt ?? 0,
    tourOf: director?.tour?.length ?? 0,
    stop: stopNow?.key ?? null,
  });
  exposed.watchIt = (on: boolean) => (on ? watchIt() : (stopWatching(), Promise.resolve()));
  if (params.has("cradle") && !loaded)
    void toTheCradle().then((down) => {
      // (Begun from the genesis, watching: from the first village on.)
      if (down && params.has("watch") && !directorControls.watching)
        void watchIt({ words: "🏘️ Their first village", seconds: 20 });
    });
  else if (params.has("watch")) void watchIt();
  // What is heard here (Sound, first slice): read as a person sees it, four times a second and only
  // while someone is listening, and told only as it changes (app/sound.ts). Nothing goes back.
  const heard = airOf("globe");
  let heardAt = 0,
    worldAirAsked = false;
  /** How much of the land shown is sea (a sample of its tiles; no list made, nothing kept). */
  const seaOfLand = () => {
    const e = client.latestFrame("region")?.arrays.elevation as Float32Array | undefined;
    if (!e) return 0;
    let sea = 0,
      all = 0;
    for (let i = 0; i < e.length; i += 23) {
      all++;
      if (e[i]! <= 0) sea++;
    }
    return sea / Math.max(1, all);
  };
  stage.onUpdate(() => {
    const wall = performance.now();
    if (wall < heardAt || !sound.listening) return;
    heardAt = wall + 250;
    // (A world's air, read once, as soon as anyone is listening: nothing asked for one who has it off.)
    if (!worldAirAsked) {
      worldAirAsked = true;
      void client
        .query<SystemPlan>({ type: "planet.system" })
        .then((sys) => {
          const home = sys.bodies.find((b) => b.kind === "home");
          if (home) Object.assign(worldAir, airOfWorld(home.pressure, home.gravity));
        })
        .catch(() => {});
    }
    // A film's own place and its own hour, not the world's behind it.
    const filmHolds = !!fleetFilm?.townHeld || !!landfallFilm?.townHeld,
      film =
        !!fleetFilm?.playing ||
        !!landfallFilm?.playing ||
        !!colonyFilm?.playing ||
        !!contactFilm?.playing ||
        jumpFilm.playing ||
        farFilm.playing ||
        nationFilm.playing,
      inSpace =
        film && !filmHolds && !(colonyFilm?.playing && !colonyFilm.townAway && scale === "village"),
      inTown = scale === "village" && !!plan,
      world = client.latestFrame("globe"),
      hour = document.body.dataset.daylight,
      sea = !inSpace && scale === "region" ? seaOfLand() : 0;
    heard.place = inSpace
      ? "stars"
      : scale === "galaxy"
        ? "galaxy"
        : scale === "cluster" || scale === "system"
          ? "stars"
          : scale === "globe" || scale === "world"
            ? "globe"
            : scale === "battle"
              ? "battle"
              : onColony()
                ? "halls"
                : scale === "village"
                  ? "town"
                  : sea > 0.08
                    ? "shore"
                    : "land";
    heard.night = inSpace ? 0 : hour === "night" ? 1 : hour === "dusk" || hour === "dawn" ? 0.5 : 0;
    heard.rain = inSpace ? 0 : (weatherNow?.rain ?? 0);
    const square =
      inTown && !film && !raidPlaying && !time.lapse && plan ? squareNow(plan, now(), false) : null;
    heard.market = square?.icon === "🛒";
    heard.feast = !!square && square.icon !== "🛒";
    heard.war =
      inTown &&
      (filmHolds || !!townWar || !!raidOver(plan?.town, raidPlaying ? raidPlaying.t : now()));
    heard.under =
      !inSpace &&
      (inTown
        ? plan?.body?.medium === "water" || (!plan?.native && !!world && frameUndersea(world))
        : scale === "region"
          ? !!landPlan?.undersea
          : scale === "camp" && !!world && frameUndersea(world));
    // (A people met on another world's own ground has life about it, whatever this one's.)
    heard.alive = !!plan?.native || worldAlive;
    heard.thin = plan?.native || inSpace ? 0 : worldAir.thin;
    heard.wind = plan?.native || inSpace ? 0 : worldAir.wind;
    heard.hush = Math.max(
      sound.fireHush,
      inSpace || weatherCell() < 0 ? 0 : 0.7 * (landSky?.dark?.soot ?? 0),
    );
    heard.held = time.paused && !film && !raidPlaying;
    sound.tell(heard);
    thunderHere =
      !inSpace && (heard.place === "town" || heard.place === "land" || heard.place === "shore");
  });
  // The world's kind (Phase 56): its globe's seas, air and clouds, a land's sea, the sky over its
  // ground, its warmth's legend.
  client.onFrame((frame) => {
    if (frame.view !== "globe") return;
    const kind = (frame.meta as { kind?: string }).kind ?? "rocky";
    globe.kind(kind);
    region.kind(kind);
    stage.worldKind(kind);
    mapModes.kind = kind;
    // (And its life's colours: a land's woods, the map's legend — Phase 57.)
    const look = (frame.meta as { lifeLook?: string }).lifeLook;
    region.lifeLook(look);
    mapModes.lifeLook = look;
  });
  client.onFrame((frame) => {
    if (frame.view === "globe") paintGlobe();
    else if (frame.view === "region") paintRegion();
  });
}

/**
 * The title screen (a bare address, or ?menu): Continue, a new world, the worlds kept, the
 * sandbox, how to play. The first visit shows how to play at once.
 */
async function runTitlePage(): Promise<void> {
  let first = true;
  try {
    first = localStorage.getItem("causalis.welcomed") !== "1";
    localStorage.setItem("causalis.welcomed", "1");
  } catch {
    // Storage may be shut (a private window): how to play shown, harmlessly.
  }
  const { showTitle } = await import("./title.ts");
  sound.tell(airOf("title"));
  sound.mount(null, true);
  exposed.sound = sound;
  showTitle({ connect, first });
}

/**
 * The genesis (M89): the world's own beginning, stage by stage, and then where to begin —
 * the world's page, at the year chosen.
 */
async function runGenesisPage(): Promise<void> {
  const { canvas, hud } = page(),
    tier = deviceTier(),
    stage = new Stage(canvas, tier, SPACE);
  stage.backdrop("space");
  const { client, mode } = await connect();
  Object.assign(exposed, { client, mode, seed, universe, stage, drawn: () => 1 });
  await client.start(universe, seed);
  sound.tell(airOf("stars"));
  sound.mount(null);
  exposed.sound = sound;
  const { runGenesis } = await import("./genesis.ts");
  await runGenesis({
    stage,
    hud,
    canvas,
    client,
    tier,
    universe,
    seed,
    // (Begun from the seed's text as the genesis left it: the acts laid on its dawn in it.)
    // (At the first people, the eye goes down to their first camp; and from the genesis the eye
    // watches by itself on — Phase 31 — until the viewer takes it.)
    beginAt: (year, text) =>
      (location.search = `?universe=${encodeURIComponent(universe)}&seed=${encodeURIComponent(text)}${year > 0 ? `&year=${year}` : "&cradle=1"}&watch=1`),
    // (Another world never seen, one life arises on: a genesis is the coming of its life.)
    another: async () => {
      const u = new Uint32Array(1);
      crypto.getRandomValues(u);
      const { livingSeed } = await import("./title.ts"),
        found = await livingSeed(client, "alien", `genesis ${u[0]! % 100000}`).catch(() => ({
          seed: `genesis ${u[0]! % 100000}`,
        }));
      location.search = `?universe=alien&seed=${encodeURIComponent(found.seed)}&genesis=1`;
    },
    // (The world made again by the hand on its making: its genesis on from the stage it was laid at.)
    remakeFrom: (text, at) =>
      (location.search = `?universe=${encodeURIComponent(universe)}&seed=${encodeURIComponent(text)}&genesis=1&from=${encodeURIComponent(at)}`),
    from: params.get("from"),
    expose: (hooks) => Object.assign(exposed, hooks),
  });
}

/**
 * A game's page, not a document (asked for 2026-09-28: a long press copied the screen): no
 * menu from a held touch or the right button (but in the fields typed in), and no pinch of
 * the page itself (the scenes take pinches for their own). What is not selected nor called
 * out by a touch held is the stylesheet's (styles.css).
 */
function gameSurface(): void {
  addEventListener("contextmenu", (e) => {
    if (!typing(e)) e.preventDefault();
  });
  // (Safari's own pinch of the page.)
  for (const type of ["gesturestart", "gesturechange"])
    addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

async function main(): Promise<void> {
  gameSurface();
  if (!location.search || params.has("menu")) return runTitlePage();
  if (bench > 0) return runBenchPage();
  if (universe === "sandbox") return runSandboxPage();
  if (params.has("genesis")) return runGenesisPage();
  return runPlanetPage();
}

main().catch((error: Error) => {
  // A browser that cannot draw in 3D (WebGL off or missing) is told so plainly.
  const webgl = /webgl/i.test(error.message);
  exposed.error = webgl ? "webgl" : error.message;
  const app = document.getElementById("app")!;
  app.innerHTML = "";
  const box = document.createElement("div");
  box.className = "failure";
  const title = document.createElement("h1");
  title.textContent = "Causalis Universe";
  const text = document.createElement("p");
  text.textContent = webgl
    ? "This browser cannot draw in 3D (WebGL is turned off or missing), so the universe cannot be shown here."
    : `Something went wrong while starting: ${error.message}`;
  const back = document.createElement("a");
  back.href = location.pathname;
  back.textContent = "Back to saved worlds";
  box.append(title, text, back);
  app.append(box);
});
