// causal: the Causal Field above the simulation — the explainer (why), the
// explanations of generated and recorded things, and the observer ledger with its
// resolvers (meet a household, follow a life, tell a biography).
// May import: kernel, rules, gen, sim. See README.md and docs/architecture/universe-architecture.md.
export { TRAITS, deepen, residence, resolvePerson } from "./biography.ts";
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
export { isObserved } from "./people.ts";
import "./population.ts";
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
} from "./why.ts";
