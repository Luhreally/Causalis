// A body as it stands at a moment (Phase 55 wave 5; asked for 2026-10-27: "i cant click on the
// soldiers on the field and see they family and anatomy etc in town vieww"): its people's members,
// each as its wounds leave it then — whole, struck in a battle being fought, abed with it, up with
// it bound, healed, scarred, lame, lost — the blow that killed it where one did, and what it can
// still do (limp, one-handed, an eye patched). A pure function of the person and the moment, free
// of any page: their page's Body tab tells and draws it, their card says it in a line, and a body
// taken in hand (possession, Phases 60–61) shows it live. Told from wave 3's wounds alone
// (bridge/wounds.ts), never a second copy of their rules.
import {
  memberWords,
  woundStage,
  type Wound,
  type WoundBlow,
  type WoundFrom,
  type WoundMember,
} from "./wounds.ts";

/**
 * A people's body plan as a body is told (rules/anatomy.ts Anatomy, as the host reads it): its
 * members, those it may lose and live, each in its own words (`~` for whose: "~ left hand", "an
 * eye", "one of ~ tentacles"), whether it stands on two legs, whether it is built round.
 */
export type BodyFrame = {
  readonly members: readonly WoundMember[];
  readonly losable: readonly WoundMember[];
  readonly words: Readonly<Partial<Record<WoundMember, string>>>;
  readonly biped: boolean;
  readonly radial: boolean;
};

/** The upright ape's plan, for a page with none told (an old save's people). */
export const APE_FRAME: BodyFrame = {
  members: [
    "head",
    "trunk",
    "arm-l",
    "arm-r",
    "hand-l",
    "hand-r",
    "leg-l",
    "leg-r",
    "eye-l",
    "eye-r",
  ],
  losable: ["arm-l", "arm-r", "hand-l", "hand-r", "leg-l", "leg-r", "eye-l", "eye-r"],
  words: {
    head: "~ head",
    trunk: "~ chest",
    "arm-l": "~ left arm",
    "arm-r": "~ right arm",
    "hand-l": "~ left hand",
    "hand-r": "~ right hand",
    "leg-l": "~ left leg",
    "leg-r": "~ right leg",
    "eye-l": "an eye",
    "eye-r": "an eye",
  },
  biped: true,
  radial: false,
};

/** The blow that killed them: where on them, what dealt it, at which battle or in which strike, when. */
export type DeathBlow = {
  readonly event: string;
  readonly from: WoundFrom;
  /** The battle's year (fought at the next year's turn), or the strike's. */
  readonly year: number;
  /** Where, in words: "the battle at Pounholt", "the fire in Sairis". */
  readonly where: string;
  readonly blow: WoundBlow;
  /** What dealt it, one of it ("a bronze axe", "an arrow"); null: none told. */
  readonly arm: string | null;
  readonly member: WoundMember;
  /** The member in their body's own words, `~` for whose. */
  readonly words: string;
  /** When (world seconds). */
  readonly at: number;
};

/** A blow taken in a battle being fought now, as the battle view draws it: where, and whether it took the member or killed. */
export type StruckNow = {
  readonly member: WoundMember;
  readonly lost: boolean;
  readonly fell: boolean;
};

/**
 * Where history struck one of a battle's men (the host's "battle.members"): the member, and whether
 * it was cut off there and then (one a healer took off later was struck there, not severed).
 */
export type StruckMember = { readonly member: WoundMember; readonly cut: boolean };

/** How a member is at a moment. */
export type MemberState =
  "whole" | "struck" | "abed" | "healing" | "healed" | "scarred" | "lame" | "lost" | "killed";

/** A member as it is now: its words, its state, and its wounds dealt by then (indices into those given, the first first). */
export type BodyMember = {
  readonly member: WoundMember;
  readonly words: string;
  readonly state: MemberState;
  readonly wounds: readonly number[];
};

/** A body at a moment: each member, what it can still do, the blow that killed it. */
export type BodyNow = {
  readonly members: readonly BodyMember[];
  /** What the wounds leave it able to do, in words that follow its name ("walks on a crutch"). */
  readonly able: readonly string[];
  readonly death: DeathBlow | null;
  readonly abed: boolean;
};

/** How grave each state is, for a member a wound and a blow both fell on. */
const GRAVE: Readonly<Record<MemberState, number>> = {
  whole: 0,
  healed: 1,
  scarred: 2,
  lame: 3,
  healing: 4,
  abed: 5,
  struck: 6,
  lost: 7,
  killed: 8,
};

const isArm = (m: WoundMember) => m === "arm-l" || m === "arm-r";
const isHand = (m: WoundMember) => m === "hand-l" || m === "hand-r";
const isLeg = (m: WoundMember) => m === "leg-l" || m === "leg-r";
const isEye = (m: WoundMember) => m === "eye-l" || m === "eye-r";
/** The hand an arm bears (gone with it). */
const handOf = (m: WoundMember): WoundMember | null =>
  m === "arm-l" ? "hand-l" : m === "arm-r" ? "hand-r" : null;

/**
 * A body at t: each member of its plan as the wounds dealt by t leave it — lost from the moment it
 * was (an arm's hand with it), else as the gravest of its wounds stands (away with the levy:
 * struck; abed; up with it bound: healing; mended: lame, scarred, healed) — then the blows of a
 * battle being fought now (`struck`), then the blow that killed it, from its moment. Pure.
 */
export function bodyAt(
  frame: BodyFrame,
  wounds: readonly Wound[],
  t: number,
  death: DeathBlow | null = null,
  struck: readonly StruckNow[] = [],
): BodyNow {
  const state = new Map<WoundMember, MemberState>(),
    on = new Map<WoundMember, number[]>(),
    worse = (m: WoundMember, s: MemberState) => {
      const was = state.get(m) ?? "whole";
      if (GRAVE[s] > GRAVE[was]) state.set(m, s);
    };
  let abed = false,
    away = false;
  wounds.forEach((w, i) => {
    const stage = woundStage(w, t);
    if (stage === "before") return;
    const list = on.get(w.member);
    if (list) list.push(i);
    else on.set(w.member, [i]);
    if (stage === "abed") abed = true;
    if (stage === "away") away = true;
    if (w.outcome === "lost") {
      worse(w.member, "lost");
      const hand = handOf(w.member);
      if (hand) worse(hand, "lost");
      return;
    }
    worse(
      w.member,
      stage === "away"
        ? "struck"
        : stage === "abed"
          ? "abed"
          : stage === "mending"
            ? "healing"
            : w.outcome,
    );
  });
  for (const s of struck) {
    worse(s.member, s.lost ? "lost" : "struck");
    const hand = s.lost ? handOf(s.member) : null;
    if (hand) worse(hand, "lost");
  }
  const dead = death !== null && death.at <= t;
  if (dead) worse(death.member, "killed");
  const members = frame.members.map((m) => ({
      member: m,
      words: frame.words[m] ?? "~ body",
      state: state.get(m) ?? "whole",
      wounds: on.get(m) ?? [],
    })),
    of = (m: WoundMember) => state.get(m) ?? "whole",
    able: string[] = [];
  // (Not yet home, or abed: that is all it does; what its wounds leave it able to do, once up.)
  if (!dead && !struck.some((s) => s.fell) && (away || abed))
    able.push(away ? "is still with the levy, wounded" : "is abed");
  else if (!dead && !struck.some((s) => s.fell)) {
    // What it can do as it is left: on its legs, with its hands, with its eyes.
    const legs = frame.members.filter(isLeg),
      lostLegs = legs.filter((m) => of(m) === "lost").length,
      lameLegs = legs.filter((m) => of(m) === "lame").length;
    if (lostLegs > 0)
      able.push(
        frame.biped && lostLegs === 1
          ? "walks on a crutch"
          : frame.biped
            ? "cannot walk"
            : "goes lame on the legs left",
      );
    else if (lameLegs > 0) able.push("limps");
    const hands = frame.members.filter(isHand),
      arms = frame.members.filter(isArm),
      grips = hands.length ? hands : arms,
      lostGrips = grips.filter((m) => of(m) === "lost").length;
    if (grips.length && lostGrips >= grips.length)
      able.push(hands.length ? "has no hand left to work with" : "has nothing left to grip with");
    else if (lostGrips > 0)
      able.push(
        hands.length === 2
          ? "works one-handed"
          : hands.length
            ? "has a hand fewer"
            : "grips with one",
      );
    if (arms.some((m) => of(m) === "lame")) able.push("keeps an arm stiff");
    const eyes = frame.members.filter(isEye),
      lostEyes = eyes.filter((m) => of(m) === "lost").length;
    if (eyes.length && lostEyes >= eyes.length) able.push("is blind");
    else if (lostEyes > 0) able.push("sees with one eye, a patch over the other");
    if ([...state.values()].includes("healing")) able.unshift("is up, a wound still bound");
  }
  return { members, able, death: dead ? death : null, abed };
}

const whose = (sex?: number) => (sex === 0 ? "her" : sex === 1 ? "his" : "their");
const they = (sex?: number) => (sex === 0 ? "she" : sex === 1 ? "he" : "they");

/** How a wound came out, in a few words after where it struck ("healed", "healed with a scar"). */
const CAME: Readonly<Record<Wound["outcome"], string>> = {
  healed: "healed",
  scarred: "healed with a scar",
  lame: "healed lame",
  lost: "lost",
};

/** A wound in a few words, for a card: "lost his right hand at the battle at Pounholt in 371", "struck in his left arm, healed". */
export function woundShort(w: Wound, t: number, sex?: number): string {
  const part = memberWords(w, sex),
    at = `${w.from === "battle" ? "at" : "in"} ${w.where} in ${w.year}`;
  if (w.outcome === "lost") return `lost ${part} ${at}`;
  const stage = woundStage(w, t),
    struck = w.from === "battle" ? "struck in" : w.blow === "fire" ? "burned on" : "hurt in";
  if (stage === "away") return `${struck} ${part} ${at}, coming home`;
  if (stage === "abed") return `${struck} ${part} ${at}, abed with it`;
  if (stage === "mending") return `${struck} ${part} ${at}, still bound`;
  return `${struck} ${part}, ${CAME[w.outcome]}`;
}

/** The blow that killed them, in words: "killed by a blow to his head at the battle at Pounholt in 371, from a bronze axe". */
export function deathWords(d: DeathBlow, sex?: number): string {
  const part = d.words.replace("~", whose(sex)),
    at = `${d.from === "battle" ? "at" : "in"} ${d.where} in ${d.year}`,
    by = d.arm ? `, from ${d.arm}` : "";
  return d.from === "battle"
    ? `killed by a blow to ${part} ${at}${by}`
    : `killed ${at}, ${d.blow === "fire" ? "burned" : "crushed"} about ${part}`;
}

/** Which wound a card names first: one that took a member, then lamed, then scarred, then healed. */
const RANK: Readonly<Record<Wound["outcome"], number>> = {
  lost: 3,
  lame: 2,
  scarred: 1,
  healed: 0,
};

/**
 * A body in a line, for a card: "Whole"; "Struck in his left arm, healed"; "Lost his right hand at
 * the battle at Pounholt in 371"; the blow that killed them; the blows of a battle being fought.
 * The gravest first, at most two.
 */
export function bodyLine(b: BodyNow, wounds: readonly Wound[], t: number, sex?: number): string {
  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  if (b.death) return cap(deathWords(b.death, sex));
  const dealt = wounds
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => woundStage(w, t) !== "before")
      .sort((a, c) => RANK[c.w.outcome] - RANK[a.w.outcome] || c.w.at - a.w.at || a.i - c.i),
    // (This day's blows, no wound of history's yet: a member struck, or taken — a hand gone with
    // its arm told by its arm.)
    gone = (m: WoundMember) => b.members.some((x) => x.member === m && x.state === "lost"),
    fresh = b.members.filter(
      (m) =>
        !m.wounds.length &&
        (m.state === "struck" ||
          (m.state === "lost" &&
            !(m.member === "hand-l" && gone("arm-l")) &&
            !(m.member === "hand-r" && gone("arm-r")))),
    );
  const told = [
    ...fresh.map(
      (m) =>
        `${m.state === "lost" ? "lost" : "struck in"} ${m.words.replace("~", whose(sex))} this day`,
    ),
    ...dealt.map(({ w }) => woundShort(w, t, sex)),
  ];
  if (!told.length) return "Whole";
  const line = told.slice(0, 2).join("; ");
  return cap(told.length > 2 ? `${line}; and more` : line);
}

/** What the wounds leave them able to do, as a sentence ("He walks on a crutch and works one-handed."); null: nothing to say. */
export function ableWords(b: BodyNow, sex: number): string | null {
  if (!b.able.length) return null;
  const list =
      b.able.length === 1
        ? b.able[0]!
        : `${b.able.slice(0, -1).join(", ")} and ${b.able[b.able.length - 1]!}`,
    who = they(sex);
  return `${who[0]!.toUpperCase()}${who.slice(1)} ${list}.`;
}

/** A member's state told after its name ("lost", "whole", "healing, bound"). */
export const STATE_WORDS: Readonly<Record<MemberState, string>> = {
  whole: "whole",
  struck: "struck",
  abed: "wounded, abed",
  healing: "healing, still bound",
  healed: "wounded once, healed",
  scarred: "scarred",
  lame: "healed lame",
  lost: "lost",
  killed: "the blow that killed",
};
