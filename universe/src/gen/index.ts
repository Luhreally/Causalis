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
export {
  PLANET_FREQUENCY,
  generateHomeWorld,
  surfaceCopper,
  surfaceOre,
  type HomeWorld,
} from "./homeworld.ts";
export { makeHydrology, type Hydrology } from "./hydrology.ts";
export {
  MAX_SPECIES,
  NICHES,
  livingIn,
  lives,
  makeBiosphere,
  type Biosphere,
  type Niche,
  type Species,
} from "./biosphere.ts";
export {
  AGES,
  AGE_KINDS,
  AGE_MY,
  makeDeepTime,
  pastLatitude,
  pastPosition,
  type Age,
  type AgeKind,
  type DeepTime,
} from "./deeptime.ts";
export {
  AGE,
  SPECIES,
  DEPOSIT,
  HOME,
  PLANET,
  PLATE,
  STAR,
  SURFACE_CELL,
  SPOT,
  ageRef,
  speciesRef,
  spotRef,
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
export {
  borrowSound,
  commonTongue,
  cradleTongue,
  languageName,
  personName,
  placeName,
  shiftTongue,
  tongueLikeness,
  tongueName,
  tonguePersonName,
  type Tongue,
} from "./names.ts";
export {
  PROVINCE_FREQUENCY,
  isProvinceWorld,
  provinceWorld,
  type ProvinceWorld,
} from "./provinces.ts";
