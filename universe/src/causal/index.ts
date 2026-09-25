// causal: the Causal Field above the simulation — the explainer (why) now; the
// observer ledger, resolvers and macro history as later milestones add them.
// May import: kernel, rules, gen, sim. See README.md and docs/architecture/universe-architecture.md.
export {
  edges,
  registerExplainer,
  spine,
  why,
  type Basis,
  type Explainer,
  type Explanation,
  type ExplanationEdge,
} from "./why.ts";
