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
} from "./village.ts";
export type { WorldGlobe } from "./worlds.ts";
export type { WarsMap } from "./wars.ts";
export type { GenesisPlan } from "./genesis.ts";
export type { DepositPage, PlatePage, RealmPage, SpeciesPage } from "./pages.ts";
export {
  splitPageRef,
  type Block,
  type Item,
  type Line,
  type PageKind,
  type PageModel,
  type Part,
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
  SkyState,
  StarPage,
  SystemPlan,
  SystemPlanBody,
  GalaxyPlan,
} from "./system.ts";
