// causal: the Causal Field above the simulation — the explainer (why), the
// explanations of generated and recorded things, and the observer ledger with its
// resolvers (meet a household, follow a life, tell a biography).
// May import: kernel, rules, gen, sim. See README.md and docs/architecture/universe-architecture.md.
export { TRAITS, deepen, residence, resolvePerson } from "./biography.ts";
export {
  bestWalk,
  domainOf,
  hopImportance,
  northStar,
  type NorthStar,
  type Walk,
} from "./north-star.ts";
export { isGenerated, landWords } from "./generated.ts";
export {
  HOUSEHOLD,
  MEMORY,
  ObserverLedger,
  PERSON,
  catchUp,
  meetHousehold,
  observer,
  settleAll,
  type Household,
  type LifeEvent,
  type Memory,
  type Move,
  type Person,
  type Role,
} from "./observer.ts";
export { LIFE_WORDS, MEMORY_WORDS, isObserved } from "./people.ts";
export { WAR_DRAWS, WAR_PAST_YEARS, warClaimKey, warClaimLimit, type WarFate } from "./warfates.ts";
export { FOLK, folkRef } from "./population.ts";
import "./economy.ts";
import "./acts.ts";
export { fortuneHow, fortuneWhat } from "./acts.ts";
import "./possess.ts";
import "./gifts.ts";
import "./life.ts";
import "./reign.ts";
export { againWords, shareWords, timesWords } from "./reign.ts";
export { ANSWER_WORD, firstWords, raiseName, raiseThe } from "./asks.ts";
export { FELL_WORDS, keptWords } from "./lost.ts";
import "./court.ts";
import "./held.ts";
export { WAYS, WAY_WORDS, kept, waysRef, waysWords } from "./culture.ts";
export { governmentWords } from "./polity.ts";
import "./belief.ts";
import "./rights.ts";
export { principleName } from "./lore.ts";
export { standingWords } from "./diplomacy.ts";
import "./war.ts";
import "./uprooted.ts";
import "./warcraft.ts";
export { aimPhrase, grainSum, termsPhrase, warAimWords } from "./war.ts";
export { BOND_WORDS, CALL_WHY, ERRAND_WORDS, leagueWords } from "./ties.ts";
import "./city.ts";
import "./design.ts";
import "./ecology.ts";
import "./languages.ts";
import "./climate.ts";
import "./nature.ts";
import "./space.ts";
import "./frontier.ts";
import "./order.ts";
import "./houses.ts";
import "./underworld.ts";
export { groupWords } from "./underworld.ts";
import "./groups.ts";
export { ORG_IS, orgWords } from "./groups.ts";
import "./institutions.ts";
export { bodyWords, doesWords } from "./institutions.ts";
import "./deeds.ts";
export { sentenceWords, struckAt } from "./deeds.ts";
import "./notables.ts";
import "./ideas.ts";
import "./abroad.ts";
export { schoolAsks, schoolWords, workFormWords, workThemeWords } from "./ideas.ts";
export { NOTABLE_ENDS, deedLine, notableTitle, type Titled } from "./notables.ts";
import "./health.ts";
import "./credit.ts";
import "./finance.ts";
import "./money.ts";
import "./society.ts";
import "./strife.ts";
import "./town.ts";
import "./lessons.ts";
// A faith's head, a commander held (2026-11-22).
import "./gaps.ts";
export { CLASH_WHAT_WORDS, FAITH_FORM_WORDS } from "./gaps.ts";
export { priceWords } from "./economy.ts";
export { ROUTE_WORDS, SOURCE_WORDS, VIA_WORDS, oneIn, sparedWords, strangersOf } from "./health.ts";
export {
  canWatch,
  defineWatchKind,
  firstAfter,
  label,
  newsLog,
  setWatch,
  tidings,
  worldNews,
  watches,
  type Tiding,
  type Watch,
  type WatchKind,
} from "./watch.ts";
export {
  edges,
  registerDecisionWords,
  registerEventWords,
  registerExplainer,
  spine,
  why,
  type Basis,
  type Explainer,
  type Explanation,
  type ExplanationEdge,
  eventHasWords,
} from "./why.ts";
export { heldPhrase } from "./uprooted.ts";
