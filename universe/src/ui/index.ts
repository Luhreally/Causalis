// ui: the observatory — panels that read through queries and subscriptions and act
// only through commands, in plain words. May import: kernel, bridge, view.
// See README.md and docs/architecture §31.
export { SandboxPanel } from "./panel.ts";
export { LabelLayer, type Label } from "./labels.ts";
export { PlanetPanel, type ChipKind, type PeopleEntry, type WorldStats } from "./planet-panel.ts";
export { RegionPanel } from "./region-panel.ts";
export { SystemPanel } from "./system-panel.ts";
export { WorldPanel } from "./world-panel.ts";
export { CampPanel } from "./camp-panel.ts";
export { GalaxyPanel } from "./galaxy-panel.ts";
export { ClusterPanel } from "./cluster-panel.ts";
export { VillagePanel } from "./village-panel.ts";
export { WhyTree, el, type WhyNode } from "./why.ts";
export { claimWords, clockWords, eventWords, roleWords, speedWords, when } from "./words.ts";
export { TimeBar } from "./timebar.ts";
export { Tidings, type Tiding } from "./tidings.ts";
export { GuidedWalk, type WalkCue } from "./walk.ts";
export { PageWindow } from "./inspector.ts";
export { MapLabels, type MapName } from "./maplabels.ts";
export { MapModes } from "./mapmodes.ts";
export { FreeControls, type FreeMode } from "./free.ts";
export { DirectorControls } from "./director.ts";
export { KEY_LINES, installTimeKeys, steerWords, touching, typing, type TimeKeys } from "./keys.ts";
export { SearchBox } from "./search.ts";
export { Outliner } from "./outliner.ts";
export { Tooltip } from "./tooltip.ts";
export { HoverTips, breakdownCard, tipCard } from "./hovertip.ts";
export { Alerts, LogButton } from "./alerts.ts";
export { ArmsBook, drawArms, paintArms } from "./arms.ts";
export { EventWindows, isGreat, type EventMode } from "./events.ts";
export { GodPalette, PALETTE_KINDS, WAY_CHOICES } from "./palette.ts";
