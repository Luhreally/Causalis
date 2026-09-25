// kernel: references, keyed randomness, deterministic math, time, hashing, the
// scheduler, dense tables and the world container with its checkpoint chain.
// May import nothing. See README.md and docs/architecture/universe-architecture.md §4–§7.
export { TWO32, TWO53, f64Hex, hexF64, hi32, lo32 } from "./bits.ts";
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
  gaussian,
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
export { CountDeltas, CountTable, FieldTable } from "./table.ts";
export { World, type Checkpoint, type StateStore, type WorldOptions } from "./world.ts";
