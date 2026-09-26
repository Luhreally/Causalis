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
  marketsOf,
  populationContext,
  provinceCapacity,
  regionOf,
  support,
  type PopulationContext,
} from "./population/systems.ts";
export { FIRST_PEOPLE, chooseHome, makePopulationWorld } from "./population/world.ts";
export {
  GOOD_COUNT,
  LEDGER,
  MARKET_GOOD,
  MARKET_YEARS,
  Market,
  MarketStore,
  marketGoodRef,
  type LedgerLine,
  type MarketYear,
  type TradeFlow,
} from "./economy/market.ts";
export {
  ECONOMY_EVENTS,
  HAUL_PER_100KM,
  economyYear,
  installEconomy,
  metalYear,
} from "./economy/systems.ts";
export {
  ACT_EVENTS,
  ACT_KINDS,
  ACT_STRENGTH,
  ActStore,
  actsOf,
  type Act,
  type ActArgs,
  type ActKind,
} from "./acts/acts.ts";
export {
  HAND_EVENTS,
  HandStore,
  bandOfAge,
  handOf,
  installHand,
  type Agent,
  type Window,
} from "./hand/hand.ts";
