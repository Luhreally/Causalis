// view: pure view-spec builders — simulation frames to what is drawn and shown.
// May import: kernel, rules, bridge. See README.md and docs/architecture §28.
export {
  CELL_RADIUS,
  CLASS_COLORS,
  CLASS_NAMES,
  PEOPLE_PER_FIGURE,
  RING_RADIUS,
  cellAt,
  cellCenter,
  priceColor,
  sandboxSpec,
  type CellSpec,
  type CrowdSpec,
  type Rgb,
  type SandboxSpec,
} from "./sandbox.ts";
export {
  DEPOSIT_COLORS,
  LENSES,
  biomeColor,
  LENS_NAMES,
  globeColors,
  globeRadius,
  type Lens,
} from "./globe.ts";
export {
  REGION_LENSES,
  REGION_LENS_NAMES,
  REGION_RELIEF,
  regionColors,
  regionHeights,
  type RegionLens,
} from "./region.ts";
export {
  ACTIVITY,
  ACTIVITY_WORDS,
  momentOf,
  personGroup,
  type Activity,
  type Moment,
} from "./village.ts";
