// view: pure view-spec builders — simulation frames to what is drawn and shown.
// May import: kernel, rules, bridge. See README.md and docs/architecture §28.
export {
  CELL_RADIUS,
  CLASS_COLORS,
  CLASS_NAMES,
  PEOPLE_PER_FIGURE,
  RING_RADIUS,
  cellAt,
  cellCenter,
  priceColor,
  sandboxSpec,
  type CellSpec,
  type CrowdSpec,
  type Rgb,
  type SandboxSpec,
} from "./sandbox.ts";
export {
  DEPOSIT_COLORS,
  LENSES,
  biomeColor,
  LENS_NAMES,
  globeColors,
  globeRadius,
  type Lens,
} from "./globe.ts";
export {
  REGION_LENSES,
  REGION_LENS_NAMES,
  REGION_RELIEF,
  regionColors,
  regionHeights,
  regionTrees,
  type RegionTree,
  type RegionLens,
} from "./region.ts";
export {
  ACTIVITY,
  ACTIVITY_WORDS,
  SIGNS,
  TASKS,
  houseLook,
  momentOf,
  personGroup,
  sayOf,
  treesOf,
  type Activity,
  type HouseLook,
  type Moment,
  type Task,
  type Tree,
} from "./village.ts";
export { STRIDES, bobOf, limbPitch } from "./motion.ts";
export {
  BATTLE_ROUND,
  MARCH,
  battleOf,
  warPaths,
  warTokens,
  type Soldier,
  type WarPath,
  type WarPaths,
  type WarToken,
} from "./war.ts";

export {
  HAIRS,
  SHEEN,
  carryWords,
  hairOf,
  homeDetail,
  lamplight,
  metalOf,
  type HomePiece,
} from "./detail.ts";
export {
  CARRIES,
  MATERIALS,
  cartAt,
  factoryPieces,
  itemParts,
  materialColor,
  minePieces,
  smokeAt,
  toolHead,
  travellerAt,
  wellPieces,
  type Carry,
  type ItemPart,
  type Material,
  type Mine,
  type MinePiece,
  type Puff,
  type Road,
} from "./work.ts";
export {
  TRAFFIC_PACE,
  beastsAt,
  birdsAt,
  coatOf,
  defaultBody,
  doingOf,
  faunaOf,
  fishAt,
  type BeastNow,
  type BirdNow,
  type Coat,
  type Fauna,
  type FaunaSpecies,
  type FishNow,
  type Traffic,
} from "./fauna.ts";
export { dryAt, keepOut, villageGround, type Ground, type Solid } from "./ground.ts";
export {
  BEAST_SCALE,
  MOST_OF_TONE,
  MOST_PARTS,
  buildBody,
  posed,
  strideOf,
  type BeastPart,
  type Built,
  type Pose,
} from "./creature.ts";
export {
  figureOf,
  paceOf,
  type Figure,
  type FigureBody,
  type FigurePart,
  type PartShape,
} from "./figure.ts";
export {
  HOME_DISTANCE,
  STAR_SIZE,
  bodyColor,
  bodyFacts,
  bodySize,
  orbitRings,
  routeWords,
  skyMarks,
  systemExtent,
  systemSpec,
  type SkyMarks,
  type SystemSpot,
} from "./system.ts";
export {
  LY_SCALE,
  clusterSpec,
  clusterWords,
  starColor,
  voyageMarks,
  type Rgb3,
} from "./cluster.ts";
export { bandsOf, groundOf, worldColors } from "./worlds.ts";
export {
  GALAXY_LY,
  galaxyPoints,
  homeOf,
  lyFromHome,
  starWords,
  type GalaxyPoints,
} from "./galaxy.ts";
