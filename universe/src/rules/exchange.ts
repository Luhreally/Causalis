// Pests and beasts carried on contact (the sweep, Nature lane): a coarse biotic exchange beside the crops (rules/crops.ts). A
// land's fields carry the weeds and pests that grew up with its crop's lineage; where its people come to meet a land sowing a
// lineage they have never met (by its spread, or across the sea where its ships newly trade), that lineage's weeds and pests
// come with the seed and the sacks, and its fields lose a share they had never lost, until over the decades they learn to keep
// them down and the pests' own enemies follow (est: crops' losses to pests and weeds today some 20–40%, Oerke 2006; the
// Columbian exchange's weeds, the Irish blight). And the herd beast a land keeps is its own best tame grazer, or the one it
// learned herding with; where it meets a land keeping a beast that would give it a tenth more, fitted to its warmth and rain, it
// takes that beast up, as the Old World's cattle, sheep and horses went with their peoples.
import { dmath } from "../kernel/index.ts";
import { cropFit, type CropField } from "./crops.ts";

export const EXCHANGE = {
  /** The share of a crop a lineage's weeds and pests take in their first years on fields that never met them (est). */
  strike: 0.25,
  /** The most of a crop carried pests take together. */
  most: 0.5,
  /** Their share falls by this much a year as a land learns to keep them down (half gone in some twenty years, est). */
  fade: 0.035,
  /** A beast met is taken up where it would give a tenth more than the one kept. */
  better: 1.1,
} as const;

/** A tame grazer as the exchange weighs it: how tame and how quick it grows, and the warmth and rain it was bred under. */
export type Beast = {
  readonly docility: number;
  readonly growth: number;
  readonly warm: number;
  readonly tolerance: number;
  readonly rainMin: number;
  readonly rainMax: number;
};

/** What a beast gives a land: how tame and quick it is, as its warmth and rain fit the land's (its days count for no beast). */
export function beastWorth(b: Beast, f: CropField): number {
  const fit = cropFit({ ...b, lat: f.lat }, f);
  return Math.max(0, b.docility * b.growth) * fit;
}

/** Carried pests' share of a crop after `years` of keeping them down. */
export function pestsAfter(pests: number, years: number): number {
  return pests * dmath.exp(-EXCHANGE.fade * years);
}

/** Carried pests' share when a lineage's own come to fields that never met them. */
export function pestStrike(pests: number): number {
  return Math.min(EXCHANGE.most, pests + EXCHANGE.strike * (1 - pests));
}

/** A crop's lineage as a bit of a land's memory of the lineages its fields have met (32 bits: a few lineages may share one). */
export function lineageBit(crop: number): number {
  return 1 << ((Math.imul(crop + 3, 0x9e3779b1) >>> 27) & 31);
}
