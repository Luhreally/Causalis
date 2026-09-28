// gen: pure generators — the star, the planet, its plates, relief, climate,
// rivers and deposits now; the galaxy, deep-time life, species, cultures and
// languages as later milestones add them. May import: kernel, rules.
// See README.md and docs/architecture §24, §27.
export { makePlanet, makeStar, type Planet, type Star } from "./bodies.ts";
export {
  foreignPlanets,
  makeSystem,
  positionAt,
  type Air,
  type BodyKind,
  type ForeignPlanet,
  type Orbit,
  type StarSystem,
  type SystemBody,
  type Water,
} from "./system.ts";
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
  SEAM,
  seamRef,
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
  MOON,
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
  moonRef,
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
export { REGION, WATER, refineRegion, regionPoint, regionRef, type Region } from "./region.ts";
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
  tongueSounds,
  type Tongue,
} from "./names.ts";
export {
  HALL_AREA,
  PROVINCE_FREQUENCY,
  SITES_PER_BODY,
  STAR_SITES,
  isProvinceWorld,
  offworldSite,
  provinceWorld,
  type OffworldSite,
  type ProvinceWorld,
} from "./provinces.ts";
export {
  CLUSTER_LY,
  LOCAL_DENSITY,
  SECTOR_LY,
  clusterStars,
  densityAt,
  imfMass,
  makeGalaxy,
  sectorId,
  sectorStars,
  type Galaxy,
  type GalaxyStar,
} from "./galaxy.ts";
export {
  CIVILIZATION,
  HOME_PACE,
  MOST_CIVILIZATIONS,
  civilizationsOf,
  type Civilization,
} from "./civilizations.ts";
export { COVER, WORLD_FREQUENCY, otherWorld, type OtherWorld } from "./worlds.ts";
