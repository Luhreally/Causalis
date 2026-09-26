// The calibration bands (docs/architecture §I.3, M34): on the Earth seed, the years
// the chronicle's turning points should first come in, and what the planet should
// hold at given centuries. The chronicle compresses time as it goes: the bands before
// it spread over every land in the ages before; sowing within its first century or
// two, states and writing in the next, iron by the middle of the first millennium of
// the chronicle, and the engines toward its end.
import type { Century } from "./calibration.ts";

export type Turn =
  "sowing" | "state" | "writing" | "iron" | "coal" | "steam" | "factory" | "electricity";

export const TURNS: readonly {
  readonly id: Turn;
  readonly name: string;
  /** The event that marks it, or the principle whose finding does. */
  readonly event?: string;
  readonly principle?: string;
  /** The years (of the chronicle) it should first come between. */
  readonly band: readonly [number, number];
}[] = [
  { id: "sowing", name: "sowing", event: "knowledge.cultivation", band: [1, 150] },
  // The first realm (a chiefdom, often, before a kingdom): soon after sowing and towns.
  { id: "state", name: "the first realm", event: "polity.formed", band: [10, 200] },
  { id: "writing", name: "writing", principle: "writing", band: [60, 300] },
  { id: "iron", name: "iron", principle: "iron", band: [200, 450] },
  // Coal is dug for warmth once iron is worked, long before engines burn it.
  { id: "coal", name: "coal dug", event: "industry.mine", band: [250, 700] },
  { id: "steam", name: "the steam engine", principle: "steam-engine", band: [400, 750] },
  { id: "factory", name: "the first factory", event: "industry.works", band: [450, 800] },
  { id: "electricity", name: "electricity", principle: "electricity", band: [500, 900] },
];

export const BANDS: readonly {
  readonly name: string;
  readonly year: number;
  readonly measure: (c: Century) => number;
  readonly band: readonly [number, number];
  readonly words: (v: number) => string;
}[] = [
  {
    name: "people",
    year: 300,
    measure: (c) => c.people,
    band: [2e6, 40e6],
    words: (v) => `${(v / 1e6).toFixed(1)}M`,
  },
  {
    name: "people",
    year: 600,
    measure: (c) => c.people,
    band: [5e6, 200e6],
    words: (v) => `${(v / 1e6).toFixed(1)}M`,
  },
  {
    name: "wars a realm a century",
    year: 500,
    measure: (c) => c.wars / Math.max(1, c.realms),
    // Most are a season's campaign for one land: fragmented realms fight often.
    band: [0.5, 8],
    words: (v) => v.toFixed(1),
  },
  {
    name: "realms standing",
    year: 500,
    measure: (c) => c.realms,
    band: [10, 120],
    words: (v) => v.toFixed(0),
  },
  {
    name: "tongues spoken",
    year: 500,
    measure: (c) => c.languages,
    band: [30, 400],
    words: (v) => v.toFixed(0),
  },
];
