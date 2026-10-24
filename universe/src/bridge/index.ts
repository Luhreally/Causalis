// bridge: the protocol between the page and the simulation host — message types,
// the client, the worker port and the in-thread pair. May import: kernel.
// See README.md and docs/architecture/universe-architecture.md §30.
export { HostClient, type CommandReceipt } from "./client.ts";
export {
  frameTransfer,
  type FrameArray,
  type FrameMessage,
  type Interest,
  type Port,
  type Query,
  type SaveMeta,
  type Status,
  type ToHost,
  type ToMain,
} from "./protocol.ts";
export { inlinePair, workerPort } from "./transport.ts";
export {
  LAKE_R,
  WATER_OUT,
  type BeastPlan,
  type VillageLife,
  type VillagePlan,
  type Visitor,
} from "./village.ts";
export type { WorldGlobe } from "./worlds.ts";
export {
  BLOCK_D,
  BLOCK_LOTS,
  BLOCK_REACH,
  BLOCK_W,
  GATE_TOWER,
  LOT,
  LOT_D,
  LOT_W,
  SHORE,
  SQUARE,
  STREET,
  WALL_THICK,
  WALL_TOWER,
  blocksHeld,
  civicMoments,
  footprint,
  lotStates,
  progress,
  townBlocks,
  townLots,
  townReach,
  wallRing,
  type CampNear,
  type LandCamp,
  type LandEra,
  type LandLane,
  type LandPlan,
  type LandRoad,
  type LandTown,
  type LotStates,
  type TownBlocks,
  type TownCivic,
  type TownDesign,
  type TownFamily,
  type TownLots,
  type TownPlan,
  type TownWater,
  type WallLength,
} from "./town.ts";
export type { Garrison, HostKinds, WarSide, WarsMap } from "./wars.ts";
export type { ActKindShown, ActMark, ActsMap, PaletteLand } from "./acts.ts";
export type { GenesisPlan, MeadowPlan } from "./genesis.ts";
export type { DepositPage, PlatePage, RealmPage, SpeciesPage } from "./pages.ts";
export { METALS, armsFor, type Arms, type Charge, type Division, type Holds } from "./arms.ts";
export {
  splitPageRef,
  type Alert,
  type Answer,
  type Block,
  type Breakdown,
  type Item,
  type Line,
  type PageKind,
  type PageModel,
  type Part,
  type PhyloLine,
  type DropKind,
  type Place,
  type Portrait,
  type Row,
  type Span,
  type Stat,
  type Tab,
  type Tip,
} from "./inspect.ts";
export type {
  ClusterPlan,
  ClusterStar,
  PeoplesSky,
  SkyState,
  StarPage,
  SystemPlan,
  SystemPlanBody,
  GalaxyPlan,
} from "./system.ts";
