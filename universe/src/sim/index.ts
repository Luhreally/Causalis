// sim: the authoritative systems by domain: the home planet (generated, with its
// deviations) and the Phase 0 sandbox. May import: kernel, rules, gen. See README.md and docs/architecture/universe-architecture.md.
export {
  BLESSING_EVENT,
  CELL,
  CELLS,
  CLASSES,
  EXODUS_EVENT,
  FLOODPLAIN,
  FLOOD_EVENT,
  ToyMarket,
  ToyMemory,
  ToyPopulation,
  cellRef,
  floodplainRef,
  makeToyWorld,
  type ToyOptions,
} from "./sandbox/toy.ts";
export {
  HomePlanet,
  homePlanet,
  makePlanetWorld,
  type PlanetWorldOptions,
} from "./planet/store.ts";
export { COLS, Province, ROWS, capacity, row, type Capacity } from "./population/model.ts";
export {
  HistoryStore,
  PopulationStore,
  SETTLEMENT,
  SettlementStore,
  type Flow,
  type Settlement,
  type YearSummary,
} from "./population/stores.ts";
export {
  POPULATION_EVENTS,
  VILLAGE_SIZE,
  installPopulation,
  occupationTargets,
  populationContext,
  support,
  type PopulationContext,
} from "./population/systems.ts";
export { FIRST_PEOPLE, chooseHome, makePopulationWorld } from "./population/world.ts";
