// What a realm's seat tells its people, how far it carries and whether it is believed (the culture sweep, 2026-11-16; audit
// "Media, propaganda", where how freely word moved in a realm was one number and nothing was ever said). Each realm's seat says,
// each year, what it most needs its people to hold:
//   its right to rule, as far as its standing has fallen;
//   that the foe is at the gate, while it is at war, the more the worse the war goes;
//   that its lands are one people, as far as those it rules count it strangers and imagine an "us" that leaves it out;
//   whose fault a hunger is, as far as its lands are hungry: those who are not of them;
//   that its rule is the faith's, as far as its people share the seat's faith and are devout.
// It carries as far as there are those who hear it: at its seat, from its heralds; in every land of its faith, from the pulpit,
// as far as that faith's clergy are many there; and in writing to those who read, the more the faster word joins its far lands.
// It is believed as far as what people see does not give it the lie (a right to rule told to the aggrieved, a war told won and
// seen lost, one people told to strangers), and the less the more freely word moves among readers, where other voices answer it.
// Told and believed, it holds a rule the more rightful; told and seen to be false, the less. Where word is free, what other
// voices tell of a realm's grievances weighs against it besides. Blame for a hunger laid on strangers closes a people to them.
// One people told and believed draws the lands it reaches nearer the seat's. Pure tables and functions.
import { dmath } from "../kernel/index.ts";

/** What a seat may tell its people, in the order they are weighed. */
export const VOICE_TOPICS = ["right", "foe", "one", "blame", "faith"] as const;
export type VoiceTopic = (typeof VOICE_TOPICS)[number];

export const VOICE = {
  /** How far the seat's heralds are heard at the seat itself. */
  seat: 0.6,
  /** In a land of the seat's faith, how far its clergy carry the seat's word, at clergy that teach every young one. */
  pulpit: 0.5,
  /** Of those who read, the share a written word reaches where it goes at a walk; the rest as far as word joins far lands. */
  readNear: 0.3,
  /** How far free word among readers checks what the seat says (at word wholly free and all reading). */
  checked: 0.6,
  /** Standing a year from what is told and believed (at reach 1 and credence 1; the same taken where it is seen false). */
  push: 0.08,
  /** Standing taken by what free voices tell of its lands' grievance (at word free, all reading, all aggrieved). */
  told: 0.1,
  /** Openness a land's ways are drawn down by, at blame for a hunger laid on strangers carried to all and believed. */
  blame: 0.05,
  /** How much nearer one people told and believed draws a land's kin to its seat's (at reach 1, credence 1). */
  one: 0.1,
  /** Need below which a seat says nothing new (it keeps telling what it told). */
  quiet: 0.05,
} as const;

/** What a realm stands in, as its seat reads it. Shares are of its people. */
export type VoiceSituation = {
  /** Its standing with its people (0 … 1). */
  readonly legitimacy: number;
  /** Whether it is at war, and the share of its battles of the last five years it lost. */
  readonly atWar: boolean;
  readonly lost: number;
  /** How far its people count its seat's people strangers (1 - kin), and how far their "us" reaches (people-weighted). */
  readonly apart: number;
  readonly nation: number;
  /** The share of its people hungry these two years. */
  readonly hungry: number;
  /** The share of its people of its seat's faith, and the seat's piety. */
  readonly shared: number;
  readonly piety: number;
  /** Its lands' mean grievance (0 … 1). */
  readonly grievance: number;
};

/** How much a seat needs to tell each thing (0 … 1). */
export function voiceNeeds(s: VoiceSituation): number[] {
  return VOICE_TOPICS.map((t) => {
    switch (t) {
      case "right":
        return dmath.clamp(0.6 - s.legitimacy, 0, 1);
      case "foe":
        return s.atWar ? 0.3 + 0.4 * dmath.clamp(s.lost, 0, 1) : 0;
      case "one":
        return dmath.clamp(s.apart * s.nation * 2, 0, 1);
      case "blame":
        return dmath.clamp(s.hungry, 0, 1);
      case "faith":
        return dmath.clamp(s.shared * (s.piety - 0.3), 0, 1);
    }
  });
}

/** What a seat tells: the thing it most needs to (first in VOICE_TOPICS on a tie), or null where it needs nothing. */
export function voiceTopic(needs: readonly number[]): VoiceTopic | null {
  let best = -1;
  for (let k = 0; k < needs.length; k++)
    if (needs[k]! > VOICE.quiet && (best < 0 || needs[k]! > needs[best]!)) best = k;
  return best < 0 ? null : VOICE_TOPICS[best]!;
}

/** How far what people see gives the lie to what is told (0 … 1). */
export function voiceBelied(topic: VoiceTopic, s: VoiceSituation): number {
  switch (topic) {
    case "right":
      return dmath.clamp(s.grievance, 0, 1);
    case "foe":
      return dmath.clamp(s.lost, 0, 1);
    case "one":
      return dmath.clamp(s.apart * 1.5, 0, 1);
    case "blame":
      // (Blame needs someone to bear it: a realm of one people has no strangers among it to blame.)
      return 1 - dmath.clamp(s.apart * 3, 0, 1);
    case "faith":
      return 1 - dmath.clamp(s.shared, 0, 1);
  }
}

/** How far a land hears its seat (0 … 1): its heralds at the seat, its faith's pulpit, its readers as far as word joins them. */
export function voiceHeard(seat: boolean, pulpit: number, readers: number, joined: number): number {
  const read =
    dmath.clamp(readers, 0, 1) *
    (VOICE.readNear + (1 - VOICE.readNear) * dmath.clamp(joined, 0, 1));
  return dmath.clamp(
    (seat ? VOICE.seat : 0) + VOICE.pulpit * dmath.clamp(pulpit, 0, 1) + read,
    0,
    1,
  );
}

/** How far what is told is believed (0 … 1): not given the lie by what is seen, and not answered by free voices among readers. */
export function voiceCredence(belied: number, free: number, readers: number): number {
  return (
    (1 - dmath.clamp(belied, 0, 1)) *
    (1 - VOICE.checked * dmath.clamp(free, 0, 1) * dmath.sqrt(dmath.clamp(readers, 0, 1)))
  );
}

/** A realm's standing from what it tells: for it as far as believed, against it as far as seen false. */
export function voiceStanding(reach: number, credence: number): number {
  return VOICE.push * dmath.clamp(reach, 0, 1) * (2 * dmath.clamp(credence, 0, 1) - 1);
}

/** A realm's standing taken by what free voices tell of its lands' grievance. */
export function toldStanding(free: number, readers: number, grievance: number): number {
  return (
    -VOICE.told *
    dmath.clamp(free, 0, 1) *
    dmath.sqrt(dmath.clamp(readers, 0, 1)) *
    dmath.clamp(grievance, 0, 1)
  );
}

/** What a seat tells, in words. */
export const VOICE_WORDS: Readonly<Record<VoiceTopic, string>> = {
  right: "that its rule is rightful",
  foe: "that the foe is at the gate",
  one: "that all its lands are one people",
  blame: "that the hunger is the strangers' doing",
  faith: "that its rule is the faith's",
};
