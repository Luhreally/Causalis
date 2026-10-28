// render: the PlayCanvas adapter — the stage, instanced batches, the orbit camera,
// scenes that draw view specs, and the instancing benchmark. May import: kernel,
// bridge, view, and the playcanvas package. See README.md and docs/architecture §29.
export { InstancedBatch, capsuleMesh, cylinderMesh } from "./batch.ts";
export { runBench, type BenchResult } from "./bench.ts";
export { GlobeScene } from "./globe.ts";
export { GlobeWars } from "./wars.ts";
export { GlobeActs } from "./acts.ts";
export { RegionWars } from "./regionwars.ts";
export { GlobeTowns, type GlobeTown } from "./towns.ts";
export { FreeRig } from "./free.ts";
export { MicroScene } from "./micro.ts";
export { ParadeScene } from "./parade.ts";
export { FLIER_UP, MeadowScene, groundOfLook } from "./meadow.ts";
export { BattleLayer } from "./battle.ts";
export { BandLayer } from "./band.ts";
export { WeatherLayer } from "./weather.ts";
export { ActsNearLayer } from "./nearacts.ts";
export { OrbitRig, type OrbitOptions } from "./orbit.ts";
export {
  AutoQuality,
  QUALITIES,
  QUALITY_NAMES,
  type Quality,
  type QualityName,
} from "./quality.ts";
export { RegionScene, regionMaterials } from "./region.ts";
export type { CarrierKind } from "./landtraffic.ts";
export { SandboxScene } from "./sandbox.ts";
export { SystemScene, skyMaterials } from "./system.ts";
export { ClusterScene } from "./cluster.ts";
export { GalaxyScene, galaxyMaterial } from "./galaxy.ts";
export { VILLAGE_METRE, VillageScene } from "./village.ts";
export { Stage, flatMaterial, type DeviceTier, type Rgb } from "./stage.ts";
export {
  BEAST_EYE,
  EYE_FARTHEST,
  EYE_NEAREST,
  PossessEye,
  SOLDIER_EYE,
  lieDown,
} from "./possess.ts";
