// kernel: references, keyed randomness, deterministic math, time, hashing, the
// scheduler, dense tables and the world container with its checkpoint chain.
// May import nothing. See README.md and docs/architecture/universe-architecture.md §4–§7.
export {
  TWO32,
  TWO53,
  decodeFloat64s,
  encodeFloat64s,
  f64Hex,
  hexF64,
  hi32,
  lo32,
} from "./bits.ts";
export { Hasher, finish, hashString, mix, mixFloat, mixInt } from "./hash.ts";
export * as dmath from "./dmath.ts";
export {
  Minter,
  compareRefs,
  defineKind,
  indexRef,
  isRef,
  kindByCode,
  kindCodeOf,
  kinds,
  makeRef,
  parseRef,
  refHash,
  structuralRef,
  type Kind,
  type KindOrigin,
  type Ref,
  type RefParts,
} from "./ref.ts";
export {
  Rng,
  defineStream,
  purpose,
  seedFromText,
  streams,
  type Seed,
  type Stream,
} from "./rng.ts";
export {
  Permutation,
  apportion,
  drawWithoutReplacement,
  gaussian,
  multinomial,
  poisson,
  selectLowest,
  toUnit,
  weightedIndex,
  weightedKey,
  type Keyed,
} from "./sample.ts";
export {
  DAY,
  HOUR,
  MINUTE,
  MONTH,
  SECOND,
  TIME_ZERO,
  WEEK,
  YEAR,
  addTime,
  periodIndex,
  simTime,
  yearOf,
  type DeepTime,
  type SimTime,
} from "./time.ts";
export { Scheduler, type AgendaHandler, type AgendaItem, type SystemSpec } from "./schedule.ts";
export { CountDeltas, CountTable, FieldTable, type TableState } from "./table.ts";
export { World, type Checkpoint, type StateStore, type WorldOptions } from "./world.ts";
export { CommandLog, type Command, type CommandSpec } from "./command.ts";
export {
  COMMAND,
  DECISION,
  DecisionLog,
  EVENT,
  EventLog,
  MAX_CAUSES,
  MAX_FACTORS,
  MAX_SUBJECTS,
  defineEventType,
  eventType,
  eventTypes,
  type CauseRef,
  type CauseRole,
  type DecisionRecord,
  type DecisionTombstone,
  type EmitSpec,
  type EventTypeSpec,
  type Factor,
  type HistoryEvent,
  type RetentionOptions,
  type Summary,
  type Tombstone,
} from "./history.ts";
export {
  SAVE_FORMAT,
  SaveError,
  defineMigration,
  loadWorld,
  rulesetId,
  saveWorld,
  verifyByReplay,
  type LoadOptions,
  type Loaded,
  type SaveDocument,
  type StoreChunk,
} from "./save.ts";
export { MinHeap } from "./heap.ts";
export { fbm3, noise3 } from "./noise.ts";
export { forNeighbours, nearestCell, sphereGrid, type SphereGrid } from "./sphere.ts";
