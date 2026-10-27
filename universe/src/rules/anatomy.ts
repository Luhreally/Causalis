// A body's members and what a wound does to them (Phase 55 M226; asked for 2026-10-26: "Wounds and
// lost limbs shown on the person and told on their page"): where on any body a wound lands, by the
// rule of nines (Wallace 1951) less where a blow there kills (rules/wounds.ts LETHAL) — an upright
// ape's head, chest, arms, hands and legs; a crawler's forelegs and claws, a burrower's mandibles,
// a swimmer's tentacles, a trunk giant's trunk — the members it may lose and live (never its head
// or its body, nor the trunk it feeds by), an arm taking its hand with it, an eye where its people
// see; what came of a wound (healed, scarred, lame, lost), how a member was lost (cut off in the
// blow — at most SEVER_MOST of an axe's or a sword's, as Classic severs — else taken off after; an
// eye put out), and how it shows for good. The battle's blows (view/blows.ts) land by these nines.
import { LETHAL, type Blow } from "./wounds.ts";
import type { BodyPlan } from "./bodies.ts";

/** Where a blow lands on a body (view/battle.ts BlowPlace's names). Left is the body's own (+x on a figure). */
export type BodyPlace =
  "head" | "trunk" | "arm-l" | "arm-r" | "hand-l" | "hand-r" | "leg-l" | "leg-r";
/** A member a wound may take: a place, or an eye. */
export type Member = BodyPlace | "eye-l" | "eye-r";
export const BODY_PLACES: readonly BodyPlace[] = [
  "head",
  "trunk",
  "arm-l",
  "arm-r",
  "hand-l",
  "hand-r",
  "leg-l",
  "leg-r",
];
export const MEMBERS: readonly Member[] = [...BODY_PLACES, "eye-l", "eye-r"];

/** The rule of nines (Wallace 1951): head 9, trunk 36, each arm 9 (7 the arm, 2 its hand), each leg 18. */
export const NINES: Readonly<Record<BodyPlace, number>> = {
  head: 9,
  trunk: 36,
  "arm-l": 7,
  "arm-r": 7,
  "hand-l": 2,
  "hand-r": 2,
  "leg-l": 18,
  "leg-r": 18,
};
/**
 * Of blows that land on a limb, the share that kill (a great vessel opened); the head and the
 * trunk kill by rules/wounds.ts's LETHAL, the head half as often again (at most KILL.most).
 */
export const LIMB_KILL: Readonly<Record<Blow, number>> = {
  edge: 0.06,
  point: 0.03,
  blunt: 0.02,
  shot: 0.05,
  crush: 0.15,
  fire: 0.02,
};
export const KILL = { head: 1.5, most: 0.95 } as const;
/** The arms whose edge cuts off a limb (a claw's or a jaw's does not). */
export const CUTS_OFF: ReadonlySet<string> = new Set(["axe", "sword"]);
/** Where an axe or a sword maims: an arm, a hand, a leg (weights; other blows maim by the nines). */
export const MAIMED_AT = { arm: 5, hand: 4, leg: 3 } as const;
/** An eye among the members a blow takes, by the blow: against the nines' limbs (an axe's or a sword's, against MAIMED_AT). */
export const EYE_LOST: Readonly<Record<Blow, number>> = {
  edge: 0.5,
  point: 2,
  blunt: 1,
  shot: 1.5,
  crush: 0.5,
  fire: 1,
};
/** Of the wounds that take nothing: the share that leave a limb lame (care at its fullest takes LAME_CARE of that off), and that leave a scar. */
export const LAME: Readonly<Record<Blow, number>> = {
  edge: 0.12,
  point: 0.1,
  blunt: 0.1,
  shot: 0.18,
  crush: 0.2,
  fire: 0.08,
};
export const SCAR: Readonly<Record<Blow, number>> = {
  edge: 0.45,
  point: 0.3,
  blunt: 0.15,
  shot: 0.35,
  crush: 0.25,
  fire: 0.6,
};
export const LAME_CARE = 0.5;
/** Of the members an axe or a sword takes, the most cut off in the blow (as Classic severs); the rest, mangled, taken off after. */
export const SEVER_MOST = 0.45;

export type Outcome = "healed" | "scarred" | "lame" | "lost";
export type LostHow = "cut off" | "taken off" | "put out";
/** How a wound shows once mended, for good: a crutch, a limp, a limb held stiff, a patch, a stump, a scar (null: nothing). */
export type Lasting = "crutch" | "limp" | "stiff" | "patch" | "stump" | "scar" | null;

/**
 * A body's members: those it has and those it may lose and live (in MEMBERS' order), each in the
 * body's own words (`~` for whose: "~ left hand", "an eye", "one of ~ tentacles"), whether it
 * stands on two legs (a lost leg takes a crutch), whether it is built round (a mantle and its
 * tentacles).
 */
export type Anatomy = {
  readonly members: readonly Member[];
  readonly losable: readonly Member[];
  readonly words: Readonly<Partial<Record<Member, string>>>;
  readonly biped: boolean;
  readonly radial: boolean;
};

const SIDES = ["l", "r"] as const;
const SIDE_WORDS = { l: "left", r: "right" } as const;

/** A body's members from its plan (null: an upright ape). */
export function anatomyOf(body: BodyPlan | null): Anatomy {
  const manip = body?.manipulators ?? "hands",
    radial = !!body && (body.symmetry === "radial" || manip === "tentacles"),
    sees = !body || body.senses.includes("sight"),
    has = new Set<Member>(["head", "trunk"]),
    words: Partial<Record<Member, string>> = { head: "~ head", trunk: "~ body" };
  let biped = false;
  for (const s of SIDES) {
    const side = SIDE_WORDS[s],
      arm = `arm-${s}` as const,
      hand = `hand-${s}` as const,
      leg = `leg-${s}` as const,
      eye = `eye-${s}` as const;
    if (radial) {
      // A mantle above a ring of tentacles: those before it handle, those behind it carry.
      has.add(arm).add(leg);
      words[arm] = words[leg] = "one of ~ tentacles";
    } else if (manip === "trunk") {
      // A great body on four legs, its one trunk before it (on its right among a figure's places).
      if (s === "r") {
        has.add(arm);
        words[arm] = "~ trunk";
      }
      has.add(leg);
      words[leg] = `one of ~ ${side} legs`;
    } else if (manip === "mandibles") {
      has.add(arm).add(leg);
      words[arm] = `~ ${side} mandible`;
      words[leg] = `one of ~ ${side} legs`;
    } else if (manip === "claws") {
      // A shelled body's great claws; a scaled crawler's forelegs, a claw at the end of each.
      has.add(arm).add(leg);
      if (body?.skin === "shell") words[arm] = `~ ${side} claw`;
      else {
        has.add(hand);
        words[arm] = `~ ${side} foreleg`;
        words[hand] = `~ ${side} claw`;
      }
      words[leg] = `one of ~ ${side} legs`;
    } else {
      // Hands: an upright ape, a strider, one stooping on two legs with four hands.
      const many = (body?.limbs ?? 2) > 2;
      has.add(arm).add(hand).add(leg);
      words[arm] = many ? `one of ~ ${side} arms` : `~ ${side} arm`;
      words[hand] = many ? `one of ~ ${side} hands` : `~ ${side} hand`;
      words[leg] = `~ ${side} leg`;
      biped = true;
    }
    if (sees) {
      has.add(eye);
      words[eye] = radial ? "one of ~ eyes" : "an eye";
    }
  }
  if (biped) words.trunk = "~ chest";
  else if (radial) words.trunk = "~ mantle";
  const members = MEMBERS.filter((m) => has.has(m)),
    // (Never the head or the body; never the trunk a trunk giant feeds and drinks by.)
    losable = members.filter(
      (m) => m !== "head" && m !== "trunk" && !(manip === "trunk" && !radial && m === "arm-r"),
    );
  return { members, losable, words, biped, radial };
}

/** Of a hand's blows that land on a place, the share that kill (as view/blows.ts killShare deals them). */
export function killShareOf(p: BodyPlace, blow: Blow): number {
  return p === "head"
    ? Math.min(KILL.most, LETHAL[blow] * KILL.head)
    : p === "trunk"
      ? LETHAL[blow]
      : LIMB_KILL[blow];
}

const isEye = (m: Member) => m === "eye-l" || m === "eye-r";
const isLeg = (m: Member) => m === "leg-l" || m === "leg-r";
const isLimb = (m: Member) => m !== "head" && m !== "trunk" && !isEye(m);

/**
 * Where a wound that let them live lands (weights in MEMBERS' order): the nines, less the share a
 * blow there kills; a place the body lacks, on what bears it (a hand's on its arm, else the
 * body). An eye is only ever lost, so it weighs nothing here.
 */
export function hurtWeights(a: Anatomy, blow: Blow): number[] {
  const has = new Set(a.members),
    w = MEMBERS.map(() => 0);
  for (const p of BODY_PLACES) {
    const arm: Member | null = p === "hand-l" ? "arm-l" : p === "hand-r" ? "arm-r" : null,
      on: Member = has.has(p) ? p : arm && has.has(arm) ? arm : "trunk",
      k = MEMBERS.indexOf(on);
    w[k] = (w[k] ?? 0) + NINES[p] * (1 - killShareOf(p, blow));
  }
  return w;
}

/**
 * Where a blow that killed landed (weights in MEMBERS' order; Phase 55 wave 5, a fallen man's
 * death blow told on his page): the nines, by the share a blow there kills — laid on what bears a
 * place the body lacks, as hurtWeights lays them.
 */
export function deathWeights(a: Anatomy, blow: Blow): number[] {
  const has = new Set(a.members),
    w = MEMBERS.map(() => 0);
  for (const p of BODY_PLACES) {
    const arm: Member | null = p === "hand-l" ? "arm-l" : p === "hand-r" ? "arm-r" : null,
      on: Member = has.has(p) ? p : arm && has.has(arm) ? arm : "trunk",
      k = MEMBERS.indexOf(on);
    w[k] = (w[k] ?? 0) + NINES[p] * killShareOf(p, blow);
  }
  return w;
}

/** Where the blow that killed one of `a`'s kind landed (`r` 0 … 1, its own draw). */
export function deathMember(a: Anatomy, blow: Blow, r: number): Member {
  return memberOf(deathWeights(a, blow), r);
}

/** The members a blow may take (weights in MEMBERS' order), only those the body may lose: an axe's or a sword's by MAIMED_AT, any other's by the nines' limbs; an eye by EYE_LOST. */
export function lostWeights(a: Anatomy, blow: Blow, cuts: boolean): number[] {
  const lose = new Set(a.losable);
  return MEMBERS.map((m) => {
    if (!lose.has(m)) return 0;
    if (isEye(m)) return EYE_LOST[blow];
    if (!cuts) return NINES[m as BodyPlace];
    return m.startsWith("hand")
      ? MAIMED_AT.hand
      : m.startsWith("arm")
        ? MAIMED_AT.arm
        : MAIMED_AT.leg;
  });
}

/** A member drawn by weight (`r` 0 … 1); none weighted, the body. */
export function memberOf(weights: readonly number[], r: number): Member {
  const total = weights.reduce((s, x) => s + x, 0);
  if (!(total > 0)) return "trunk";
  let at = r * total;
  for (let i = 0; i < MEMBERS.length; i++) {
    at -= weights[i] ?? 0;
    if (at < 0) return MEMBERS[i]!;
  }
  return MEMBERS[weights.findLastIndex((x) => x > 0)] ?? "trunk";
}

/** What came of a wound that took nothing (`r` 0 … 1): a limb left lame (the fewer with care), a scar, or healed clean. */
export function outcomeOf(
  member: Member,
  blow: Blow,
  care: number,
  r: number,
): Exclude<Outcome, "lost"> {
  const lame = isLimb(member) ? LAME[blow] * (1 - LAME_CARE * Math.min(1, Math.max(0, care))) : 0;
  return r < lame ? "lame" : r < lame + SCAR[blow] ? "scarred" : "healed";
}

/** How a member was lost (`r` 0 … 1): an eye put out; to an axe or a sword, cut off in the blow at most SEVER_MOST of the time; else taken off after. */
export function lostHow(member: Member, cuts: boolean, r: number): LostHow {
  return isEye(member) ? "put out" : cuts && r < SEVER_MOST ? "cut off" : "taken off";
}

/**
 * How a wound shows once mended, by the body: a lost leg a crutch where it stands on two, else a
 * limp (a round body's, a stump); a lost arm, hand or tentacle a stump; a lost eye a patch; a lame
 * leg a limp, any other lame limb held stiff; a scar.
 */
export function lastingOf(a: Anatomy, member: Member, outcome: Outcome): Lasting {
  if (outcome === "lost")
    return isEye(member)
      ? "patch"
      : isLeg(member) && !a.radial
        ? a.biped
          ? "crutch"
          : "limp"
        : "stump";
  if (outcome === "lame") return isLeg(member) && !a.radial ? "limp" : "stiff";
  return outcome === "scarred" ? "scar" : null;
}

/** A wound on a body: where, what came of it, how it was lost, how it shows. */
export type BodyWound = {
  readonly member: Member;
  readonly outcome: Outcome;
  readonly how: LostHow | null;
  readonly lasting: Lasting;
};

/** A wound dealt to one of `a`'s kind (`r1`–`r3` its own draws, 0 … 1): a maimed one's member lost where the body has one to lose (else a limb left lame). */
export function woundOf(
  a: Anatomy,
  fate: "hurt" | "maimed",
  blow: Blow,
  cuts: boolean,
  care: number,
  r1: number,
  r2: number,
  r3: number,
): BodyWound {
  if (fate === "maimed") {
    const w = lostWeights(a, blow, cuts);
    if (w.some((x) => x > 0)) {
      const member = memberOf(w, r1);
      return {
        member,
        outcome: "lost",
        how: lostHow(member, cuts, r3),
        lasting: lastingOf(a, member, "lost"),
      };
    }
  }
  const member = memberOf(hurtWeights(a, blow), r1),
    outcome: Outcome =
      fate === "maimed" && isLimb(member) ? "lame" : outcomeOf(member, blow, care, r2);
  return { member, outcome, how: null, lasting: lastingOf(a, member, outcome) };
}
