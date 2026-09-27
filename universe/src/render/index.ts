// render: the PlayCanvas adapter — the stage, instanced batches, the orbit camera,
// scenes that draw view specs, and the instancing benchmark. May import: kernel,
// bridge, view, and the playcanvas package. See README.md and docs/architecture §29.
export { InstancedBatch, capsuleMesh, cylinderMesh } from "./batch.ts";
export { runBench, type BenchResult } from "./bench.ts";
export { GlobeScene } from "./globe.ts";
export { OrbitRig, type OrbitOptions } from "./orbit.ts";
export {
  AutoQuality,
  QUALITIES,
  QUALITY_NAMES,
  type Quality,
  type QualityName,
} from "./quality.ts";
export { RegionScene, regionMaterials } from "./region.ts";
export { SandboxScene } from "./sandbox.ts";
export { SystemScene } from "./system.ts";
export { ClusterScene } from "./cluster.ts";
export { VillageScene } from "./village.ts";
export { Stage, flatMaterial, type DeviceTier, type Rgb } from "./stage.ts";
