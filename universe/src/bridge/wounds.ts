// A person's wounds, as a town's day shows them and their page tells them (Phase 55 M226, M229;
// asked for 2026-10-26: "Wounds and lost limbs shown on the person and told on their page. Healers
// tending the wounded."): each as history dealt it — in a battle their town sent its men to, or a
// fire, a quake or a fire from the sky on it — where on them, what came of it and how it shows for
// good, who tended it, and its days: away with the levy till they came home, abed, up with it
// bound, mended. The host lays them over a town's plan and a person's page (host/wounds.ts); they
// are told and drawn from these alone.

/** What dealt it. */
export type WoundFrom = "battle" | "fire" | "quake" | "meteor";
/** The kind of blow (rules/wounds.ts Blow). */
export type WoundBlow = "edge" | "point" | "blunt" | "shot" | "crush" | "fire";
/** Where on them (rules/anatomy.ts Member); left is their own. */
export type WoundMember =
  | "head"
  | "trunk"
  | "arm-l"
  | "arm-r"
  | "hand-l"
  | "hand-r"
  | "leg-l"
  | "leg-r"
  | "eye-l"
  | "eye-r";
/** What came of it. */
export type WoundOutcome = "healed" | "scarred" | "lame" | "lost";
/** Who tended it: a hospital, the town's healer, their household, kin. */
export type WoundTended = "hospital" | "healer" | "household" | "kin";
/** How it shows once mended, for good (rules/anatomy.ts Lasting; null: nothing). */
export type Lasting = "crutch" | "limp" | "stiff" | "patch" | "stump" | "scar" | null;

export type Wound = {
  /** The battle's event, or the strike's. */
  readonly event: string;
  readonly from: WoundFrom;
  /** The battle's year (fought at the next year's turn), or the strike's. */
  readonly year: number;
  /** Where, in words: "the battle at Pounholt's land", "the fire in Sairis". */
  readonly where: string;
  readonly blow: WoundBlow;
  /** What dealt it, one of it ("a bronze axe", "an arrow", "a musket ball"); null: a strike, or no arm told. */
  readonly arm: string | null;
  readonly member: WoundMember;
  /** The member in their body's own words, `~` for whose: "~ left hand", "an eye", "one of ~ tentacles". */
  readonly words: string;
  readonly outcome: WoundOutcome;
  /** How it was lost (only an outcome of "lost"). */
  readonly how: "cut off" | "taken off" | "put out" | null;
  readonly lasting: Lasting;
  /** When it was dealt, when they came home with it, rose from their bed, the binding came off (world seconds). */
  readonly at: number;
  readonly home: number;
  readonly up: number;
  readonly mended: number;
  readonly tended: WoundTended;
  /** Who tended it, in words that follow "tended" or "bound": "by Sairis's healer, Mira Vell", "at the hospital of Sairis", "at home", "by kin". */
  readonly by: string;
  /** Borne home from the road on a litter. */
  readonly borne: boolean;
};

/** Days away with the levy (world seconds): from the battle's turn till they came home; the battle, in words. */
export type Away = {
  readonly event: string;
  readonly from: number;
  readonly until: number;
  readonly where: string;
};

export type WoundStage = "before" | "away" | "abed" | "mending" | "done";
/** Where a wound stands at t: not yet dealt; away with the levy; abed; up with it bound; mended. */
export function woundStage(w: Wound, t: number): WoundStage {
  return t < w.at
    ? "before"
    : t < w.home
      ? "away"
      : t < w.up
        ? "abed"
        : t < w.mended
          ? "mending"
          : "done";
}

export type Side = "l" | "r";
/** How a person's wounds show at a moment: what is gone (an arm takes its hand), what is bound, a sling, a crutch, a limp, an arm held stiff, a patch, scars; abed. */
export type WoundLook = {
  readonly lost: readonly WoundMember[];
  readonly bound: readonly WoundMember[];
  readonly sling: Side | null;
  readonly crutch: Side | null;
  readonly limp: Side | null;
  readonly stiff: Side | null;
  readonly patch: Side | null;
  readonly scars: readonly WoundMember[];
  readonly abed: boolean;
};
export const NO_LOOK: WoundLook = {
  lost: [],
  bound: [],
  sling: null,
  crutch: null,
  limp: null,
  stiff: null,
  patch: null,
  scars: [],
  abed: false,
};

const sideOf = (m: WoundMember): Side => (m.endsWith("-l") ? "l" : "r");
const otherSide = (s: Side): Side => (s === "l" ? "r" : "l");

/**
 * How their wounds show at t, the earliest dealt first. A member lost is gone from the moment it
 * was (an arm's hand with it). Abed or up, the wound is bound: up, an arm or a hand in a sling (not
 * an arm lost), a leg on a crutch where it will take one (else limping), an eye lost patched.
 * Mended, it shows as it will stay. A crutch goes under the arm on the side of the leg it stands
 * for; where that arm is lost or in a sling, under the other.
 */
export function woundLookAt(wounds: readonly Wound[] | undefined, t: number): WoundLook {
  if (!wounds?.length) return NO_LOOK;
  const lost: WoundMember[] = [],
    bound: WoundMember[] = [],
    scars: WoundMember[] = [],
    add = (list: WoundMember[], m: WoundMember) => {
      if (!list.includes(m)) list.push(m);
    };
  let sling: Side | null = null,
    crutch: Side | null = null,
    limp: Side | null = null,
    stiff: Side | null = null,
    patch: Side | null = null,
    abed = false,
    any = false;
  const order = [...wounds].sort(
    (a, b) => a.at - b.at || (a.event < b.event ? -1 : a.event > b.event ? 1 : 0),
  );
  for (const w of order) {
    const stage = woundStage(w, t);
    if (stage === "before") continue;
    any = true;
    const m = w.member,
      s = sideOf(m),
      arm = m.startsWith("arm") || m.startsWith("hand"),
      leg = m.startsWith("leg"),
      eye = m.startsWith("eye");
    if (w.outcome === "lost") {
      add(lost, m);
      if (m === "arm-l") add(lost, "hand-l");
      if (m === "arm-r") add(lost, "hand-r");
    }
    if (stage === "away") continue;
    if (stage === "abed") {
      abed = true;
      add(bound, m);
      continue;
    }
    if (stage === "mending") {
      add(bound, m);
      if (arm && !(w.outcome === "lost" && m.startsWith("arm"))) sling ??= s;
      if (leg) {
        if (w.lasting === "crutch") crutch ??= s;
        else limp ??= s;
      }
      if (eye && w.outcome === "lost") patch ??= s;
      continue;
    }
    if (w.lasting === "crutch") crutch ??= s;
    else if (w.lasting === "limp") limp ??= s;
    else if (w.lasting === "stiff") stiff ??= s;
    else if (w.lasting === "patch") patch ??= s;
    else if (w.lasting === "scar") add(scars, m);
  }
  if (!any) return NO_LOOK;
  if (crutch && (lost.includes(crutch === "l" ? "arm-l" : "arm-r") || sling === crutch))
    crutch = otherSide(crutch);
  if (sling && lost.includes(sling === "l" ? "arm-l" : "arm-r")) sling = null;
  return { lost, bound, sling, crutch, limp, stiff, patch, scars, abed };
}

const whose = (sex?: number) => (sex === 0 ? "her" : sex === 1 ? "his" : "their");
const they = (sex?: number) => (sex === 0 ? "she" : sex === 1 ? "he" : "they");

/** The member, theirs, in words: "his left hand", "an eye", "one of her tentacles". */
export function memberWords(w: Wound, sex?: number): string {
  return w.words.replace("~", whose(sex));
}

/**
 * A wound told (a person's page, their card): "Lost his left hand at the battle at Pounholt's land
 * in year 312, to a bronze axe; the stump bound by Sairis's healer, Mira Vell." — "Wounded in his
 * left leg at the battle at …, by a bronze-tipped spear; it healed, but he limps." — "Burned on
 * her right arm in the fire in Sairis in year 312; it left a scar."
 */
export function woundWords(w: Wound, sex?: number): string {
  const part = memberWords(w, sex),
    at = `${w.from === "battle" ? " at" : " in"} ${w.where} in year ${w.year}`,
    many = sex === undefined;
  if (w.outcome === "lost") {
    const to = w.arm ? `, to ${w.arm}` : "";
    if (w.how === "put out")
      return `Lost ${part}${at}${to}; ${they(sex)} ${many ? "wear" : "wears"} a patch over it.`;
    if (w.how === "cut off") return `Lost ${part}${at}${to}; the stump bound ${w.by}.`;
    return `Lost ${part}${at}${to}: it was taken off ${w.by}.`;
  }
  const by = w.arm ? `, by ${w.arm}` : "",
    hurt = w.from === "battle" ? "Wounded in" : w.blow === "fire" ? "Burned on" : "Hurt in",
    end =
      w.outcome === "lame"
        ? w.lasting === "limp"
          ? `it healed, but ${they(sex)} ${many ? "limp" : "limps"}`
          : "it healed stiff"
        : w.outcome === "scarred"
          ? "it left a scar"
          : "it healed";
  return `${hurt} ${part}${at}${by}; ${end}.`;
}

/** How a wound is with them at t while it heals (null: not dealt yet, away, or mended): "Abed with his wounds, tended by Sairis's healer, Mira Vell"; "Up again, the stump still bound". */
export function woundNow(w: Wound, t: number, sex?: number): string | null {
  const stage = woundStage(w, t);
  if (stage === "abed") return `Abed with ${whose(sex)} wounds, tended ${w.by}`;
  if (stage !== "mending") return null;
  if (w.outcome === "lost")
    return w.how === "put out"
      ? "Up again, the eye still bound"
      : "Up again, the stump still bound";
  return `Up again, ${memberWords(w, sex)} still bound`;
}
