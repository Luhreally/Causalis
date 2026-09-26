// ui: the observatory — panels that read through queries and subscriptions and act
// only through commands, in plain words. May import: kernel, bridge, view.
// See README.md and docs/architecture §31.
export { SPEEDS, SandboxPanel } from "./panel.ts";
export { LabelLayer, type Label } from "./labels.ts";
export { PLANET_SPEEDS, PlanetPanel, type PeopleEntry } from "./planet-panel.ts";
export { RegionPanel } from "./region-panel.ts";
export { VillagePanel, WATCH_SPEEDS, clockWords } from "./village-panel.ts";
export { WhyTree, el, type WhyNode } from "./why.ts";
export { claimWords, eventWords, roleWords, speedWords, when } from "./words.ts";
export { Tidings, type Tiding } from "./tidings.ts";
