// host: the simulation host that runs in the worker — command intake and stamping,
// the step driver and its pacing, the frame builder, the query server, and the
// save slots. May import: kernel, rules, gen, sim, causal, bridge.
// See README.md and docs/architecture/universe-architecture.md §30.
export {
  SimHost,
  serializeWhy,
  type FrameBuilder,
  type FramePayload,
  type HostOptions,
  type QueryHandler,
  type Universe,
  type WhyNode,
} from "./host.ts";
export { ALIEN, EARTH } from "./planet.ts";
export { SANDBOX } from "./sandbox.ts";
export {
  IndexedDbByteStore,
  MemoryByteStore,
  SaveSlots,
  decodeSave,
  encodeSave,
  requestPersistentStorage,
  type ByteStore,
} from "./storage.ts";
export { UNIVERSES } from "./universes.ts";
