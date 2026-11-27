// A body's tissues under a wound (town mode, asked 2026-11-26: "members and tissues behind the existing N9 wounds. Where a
// wound lands, and the tissue it hits, sets bleeding, pain and what it takes from work and walking"). Under the skin of a
// member lie its flesh (the muscle that moves it), its bone, the great vessels that run along it and, in the head and the
// body, the organs a blow there may reach. How deep a blow goes is the wound's own draw, the one its bleeding is drawn by
// (rules/healing.ts bleedOf: the harder a wound bleeds, the deeper it went): so the dead of a wound stay as many as
// rules/wounds.ts DIED_OF_WOUNDS says, and the tissue says why one bled so. Each blow reaches the tissues in its own
// shares: an edge mostly cuts skin and flesh; a point goes deep, through flesh to a vessel or an organ; a blunt blow and a
// crushing break bone; a ball tears flesh and breaks bone; a fire burns the skin and the flesh under it (est. from the
// wound literature's proportions). The tissue sets how much a wound hurts (a broken bone the most, a burn more than a cut),
// how long it takes to mend (bone the longest, skin the least), and what of a member's work it takes while it mends
// (bone all, skin a little), each against the blow's mean, so a blow's wounds hurt and mend as long as the tables say on
// the mean. Pure.
import type { Blow } from "./wounds.ts";
import type { Member } from "./anatomy.ts";

/** The tissues a wound may reach, from the outside in. */
export const TISSUES = ["skin", "flesh", "bone", "vessel", "organ"] as const;
export type Tissue = (typeof TISSUES)[number];

/** Of each blow's wounds, the share that reach each tissue at the deepest (TISSUES' order; est.). */
export const TISSUE_REACH: Readonly<Record<Blow, readonly number[]>> = {
  edge: [0.45, 0.35, 0.08, 0.1, 0.02],
  point: [0.2, 0.38, 0.05, 0.15, 0.22],
  blunt: [0.4, 0.28, 0.27, 0.03, 0.02],
  shot: [0.05, 0.4, 0.2, 0.15, 0.2],
  crush: [0.1, 0.25, 0.55, 0.05, 0.05],
  fire: [0.7, 0.3, 0, 0, 0],
};
/**
 * The order the tissues bleed in, least first, as the wound's draw rises: skin, bone, flesh, organ, a great vessel. A
 * wound's tissue is where its own draw falls among its blow's shares laid in this order.
 */
const BLEED_ORDER: readonly Tissue[] = [
  "skin",
  "bone",
  "flesh",
  "organ",
  "vessel",
];
/** How much each hurts, against a cut to the flesh (est.: a broken bone the most; a burn's skin more than a cut's). */
const PAIN: Readonly<Record<Tissue, number>> = {
  skin: 0.7,
  flesh: 1,
  bone: 1.5,
  vessel: 0.9,
  organ: 1.3,
};
/** How long each takes to mend, against the flesh's. */
const MENDS: Readonly<Record<Tissue, number>> = {
  skin: 0.6,
  flesh: 1,
  bone: 1.6,
  vessel: 1.1,
  organ: 1.4,
};
/** What of a member's work each takes while it mends (the flesh that moves it most of it; a bone broken all). */
const TAKES: Readonly<Record<Tissue, number>> = {
  skin: 0.25,
  flesh: 0.7,
  bone: 1,
  vessel: 0.6,
  organ: 0.8,
};

/** Whether a member has organs under it (the head, the body). */
const deep = (m: Member): boolean => m === "head" || m === "trunk";
/** An eye is its own: what reaches it reaches the organ. */
const eye = (m: Member): boolean => m === "eye-l" || m === "eye-r";

/** A blow's shares at a member: a limb has no organ under it (that share goes to its vessels); an eye is all organ. */
export function reachAt(blow: Blow, member: Member): readonly number[] {
  if (eye(member)) return [0, 0, 0, 0, 1];
  const r = TISSUE_REACH[blow];
  return deep(member) ? r : [r[0]!, r[1]!, r[2]!, r[3]! + r[4]!, 0];
}
/** The tissue a wound of a blow at a member reaches, by the draw its bleeding is drawn by (u 0 … 1). */
export function tissueOf(blow: Blow, member: Member, u: number): Tissue {
  const r = reachAt(blow, member),
    x = Math.max(0, Math.min(1, u)) * r.reduce((a, b) => a + b, 0);
  let sum = 0;
  for (const t of BLEED_ORDER) {
    sum += r[TISSUES.indexOf(t)]!;
    if (x < sum) return t;
  }
  return (
    BLEED_ORDER.filter((t) => r[TISSUES.indexOf(t)]! > 0).at(-1) ?? "flesh"
  );
}
/** A measure of each tissue against its mean over a blow's wounds at a member (so the blow's mean is the tables'). */
function againstMean(
  m: Readonly<Record<Tissue, number>>,
  blow: Blow,
  member: Member,
  t: Tissue,
): number {
  const r = reachAt(blow, member);
  let mean = 0,
    all = 0;
  TISSUES.forEach((x, k) => {
    mean += r[k]! * m[x];
    all += r[k]!;
  });
  return all > 0 && mean > 0 ? m[t] / (mean / all) : 1;
}
/** How much a wound hurts against the blow's mean wound at that member. */
export const tissuePain = (blow: Blow, member: Member, t: Tissue): number =>
  againstMean(PAIN, blow, member, t);
/** How long it takes to mend against the blow's mean. */
export const tissueMends = (blow: Blow, member: Member, t: Tissue): number =>
  againstMean(MENDS, blow, member, t);
/** What of its member's work it takes while it mends (0 … 1). */
export const tissueTakes = (t: Tissue): number => TAKES[t];
/** A tissue in words, as a wound to it is told: "the skin", "the flesh", "the bone broken". */
export const TISSUE_WORDS: Readonly<Record<Tissue, string>> = {
  skin: "the skin",
  flesh: "into the flesh",
  bone: "the bone broken",
  vessel: "a great vessel opened",
  organ: "through to what lies within",
};
