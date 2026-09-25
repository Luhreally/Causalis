// gen: pure generators — the star, the planet, its plates, relief, climate,
// rivers and deposits now; the galaxy, deep-time life, species, cultures and
// languages as later milestones add them. May import: kernel, rules.
// See README.md and docs/architecture §24, §27.
export { makePlanet, makeStar, type Planet, type Star } from "./bodies.ts";
export { BIOME, BIOME_NAMES, classify, makeClimate, type Biome, type Climate } from "./climate.ts";
export {
  DEPOSIT_KINDS,
  makeDeposits,
  type Deposit,
  type DepositKind,
  type Process,
} from "./deposits.ts";
export { PLANET_FREQUENCY, generateHomeWorld, type HomeWorld } from "./homeworld.ts";
export { makeHydrology, type Hydrology } from "./hydrology.ts";
export {
  DEPOSIT,
  HOME,
  PLANET,
  PLATE,
  STAR,
  SURFACE_CELL,
  cellRef,
  depositRef,
  planetRef,
  plateRef,
  starRef,
} from "./kinds.ts";
export {
  BOUNDARY,
  makeTectonics,
  type BoundaryKind,
  type Plate,
  type Tectonics,
} from "./plates.ts";
export { REGION, WATER, refineRegion, regionRef, type Region } from "./region.ts";
export { personName, placeName } from "./names.ts";
