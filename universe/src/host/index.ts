// host: the simulation host that runs in the worker — command intake and stamping,
// the step driver and its pacing, the snapshot builder, the query server, and the
// save slots. May import: kernel, rules, gen, sim, causal, bridge.
// See README.md and docs/architecture/universe-architecture.md.
export {
  IndexedDbByteStore,
  MemoryByteStore,
  SaveSlots,
  decodeSave,
  encodeSave,
  requestPersistentStorage,
  type ByteStore,
} from "./storage.ts";
