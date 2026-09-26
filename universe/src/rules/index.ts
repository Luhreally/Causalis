// rules: data tables and their schemas — generation priors now; commodities,
// principles, body-plan primitives and the rest as later milestones need them.
// May import: kernel. See README.md and docs/architecture §34.
export {
  FOODS,
  FORAGER_HIDES,
  G,
  GOODS,
  HERD_GOODS,
  HOME_MADE,
  PORTERAGE_PER_PERSON,
  RECIPES,
  TOOL_GAIN,
  TOOL_USERS,
  TRADER_CAPACITY,
  WANTS,
  type Good,
  type Recipe,
} from "./goods.ts";
export { EARTHLIKE, OPEN, PRIORS, type Prior, type Range } from "./priors.ts";
export {
  BANDS,
  FEMALE,
  HUMANLIKE,
  MALE,
  OCC,
  OCCUPATIONS,
  PRODUCTIVITY,
  SEXES,
  bandWidth,
  type LifeHistory,
  type Occupation,
} from "./species.ts";
