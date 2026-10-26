// A person's wounds seen (Phase 55 M226; asked for 2026-10-26: "Wounds and lost limbs shown on the
// person and told on their page"): as the town's day shows them — away with the levy till they come
// home with it from the road's end, the litters first; abed indoors; up with the wound bound, an arm
// in a sling, a stump bandaged, on a crutch; mended as it will stay — a stump, a crutch, a limp, an
// arm held stiff, a patch over an eye, a scar — and what of their figure that hides, cuts short,
// holds or adds. Pure, from the plan's records alone (bridge/wounds.ts): the same moment always
// looks the same.
import {
  NO_LOOK,
  woundLookAt,
  woundNow,
  woundStage,
  woundWords,
  type Away,
  type VillagePlan,
  type Wound,
  type WoundLook,
  type WoundMember,
  type WoundOutcome,
} from "../bridge/index.ts";
import type { BlowPlace } from "./battle.ts";
import { figureAnatomy } from "./blows.ts";
import { partExtent, type Figure } from "./figure.ts";
import { STRIDES } from "./motion.ts";

const DAY = 86_400,
  HOUR = 3_600;

/** Of a lost arm or leg, the share left from its hinge: the stump (render/blows.ts STUMP.keep, the battle's). */
export const STUMP_KEEP = 0.35;
/** A hand lost where the figure draws none: so much of its arm left. */
export const HANDLESS_KEEP = 0.8;
/** How fast they walk, of their kind's pace: on a crutch; a leg gone where they go on many; limping; a leg bound; any wound bound. */
export const WOUND_PACE = {
  crutch: 0.55,
  legGone: 0.85,
  limp: 0.8,
  legBound: 0.7,
  bound: 0.9,
} as const;
/** How a wound holds a limb (rad): an arm in a sling, forward and up; one on a crutch; one held stiff. The share of its swing a limping leg keeps, and a stump. */
export const WOUND_HOLD = { sling: -1.0, crutch: -0.15, stiff: 0, limp: 0.35, stump: 0.3 } as const;
/** A homecoming's column in from the road's end (s apart): each litter, each walking wounded, each of the rest; and a day's next column after the last man of the one before. */
export const COLUMN_GAP = { litter: 40, walker: 20, stood: 10, between: 120 } as const;
/** One up and bound goes to be dressed every third day from their first up: at one of six twenty-minute slots from one o'clock, for so long (s). */
export const DRESSING = { every: 3, from: 13, slot: 20 * 60, slots: 6, long: 25 * 60 } as const;
/** A limp's dip at each step on the bad leg (the figure's units). */
export const LIMP_DIP = 0.012;
/** How much wider than its part a bandage is wound about it. */
export const BANDAGE_WIDE = 1.18;
/** What they wear for it, by its colour: bandage and sling (linen), patch and its strap, crutch (wood), a scar. */
export const WOUND_COLORS = {
  bandage: [0.93, 0.92, 0.86],
  patch: [0.08, 0.07, 0.07],
  sling: [0.86, 0.84, 0.78],
  crutch: [0.45, 0.31, 0.19],
  scar: [0.55, 0.22, 0.2],
} as const;

/** A thing worn by one wounded, rigid on them: where (the figure's units about its middle: +x their left, +z their front, before its turn), its size, its turn and tip. */
export type WoundProp = {
  readonly kind: "patch" | "strap" | "sling" | "crutch" | "scar";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly yaw: number;
  readonly pitch: number;
};
/** A bandage about a part as it is posed: the part, where along what is left of it (0.5 its hinge end … −0.5 its far end), and how much of that length. */
export type WoundBound = { readonly part: number; readonly along: number; readonly long: number };
/**
 * What a figure's wounds do to it now, part by part: the length kept (1 whole; 0 gone; between, a
 * stump kept from its hinge), the pitch held (NaN: as its pose has it), its swing scaled; what is
 * worn on it; and a limp's dip in the stride.
 */
export type WoundGear = {
  readonly keep: Float64Array;
  readonly hold: Float64Array;
  readonly swing: Float64Array;
  readonly props: readonly WoundProp[];
  readonly bound: readonly WoundBound[];
  readonly limp: number;
};

/** Their look now (none once gone). */
export function lookNow(p: VillagePlan["people"][number], t: number): WoundLook {
  return p.gone !== undefined && p.gone <= t ? NO_LOOK : woundLookAt(p.wounds, t);
}
/** A look's key: the same key, the same gear. */
export function lookKey(l: WoundLook): string {
  return `${l.lost.join()}|${l.bound.join()}|${l.sling}|${l.crutch}|${l.limp}|${l.stiff}|${l.patch}|${l.scars.join()}`;
}
/** Whether a look shows anything on them. */
export function looksHurt(l: WoundLook): boolean {
  return !!(
    l.lost.length ||
    l.bound.length ||
    l.scars.length ||
    l.sling ||
    l.crutch ||
    l.limp ||
    l.stiff ||
    l.patch
  );
}

const prop = (
  kind: WoundProp["kind"],
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): WoundProp => ({ kind, x, y, z, sx, sy, sz, yaw: 0, pitch: 0 });

/** What a figure's wounds do to it, as its look has them now. */
export function woundGear(figure: Figure, look: WoundLook): WoundGear {
  const parts = figure.parts,
    n = parts.length,
    a = figureAnatomy(figure),
    keep = new Float64Array(n).fill(1),
    hold = new Float64Array(n).fill(Number.NaN),
    swing = new Float64Array(n).fill(1),
    props: WoundProp[] = [],
    bound: WoundBound[] = [],
    eyeOf = (left: boolean) => parts.findIndex((q) => q.tone === 4 && q.x > 0 === left),
    armOf = (s: "l" | "r") => a.parts[s === "l" ? "arm-l" : "arm-r"],
    legOf = (s: "l" | "r") => a.parts[s === "l" ? "leg-l" : "leg-r"],
    sign = (s: "l" | "r") => (s === "l" ? 1 : -1);
  // Gone: an arm's or a leg's first part a stump, the rest of its chain with it; a hand (where the
  // figure draws none, its arm the shorter); an eye.
  for (const m of look.lost) {
    if (m === "eye-l" || m === "eye-r") {
      const e = eyeOf(m === "eye-l");
      if (e >= 0) keep[e] = 0;
    } else if (m === "hand-l" || m === "hand-r") {
      const hand = a.parts[m],
        arm = armOf(m === "hand-l" ? "l" : "r")[0];
      if (hand.length) for (const i of hand) keep[i] = 0;
      else if (arm !== undefined) keep[arm] = Math.min(keep[arm]!, HANDLESS_KEEP);
    } else if (m !== "head" && m !== "trunk")
      a.parts[m].forEach((i, k) => {
        keep[i] = k === 0 ? Math.min(keep[i]!, STUMP_KEEP) : 0;
        swing[i] = WOUND_HOLD.stump;
      });
  }
  // Bound: about the part (a stump's end; a lost hand's arm's end; the head for an eye).
  const bandaged = new Set<number>(),
    bind = (part: number | undefined, along: number, long: number) => {
      if (part === undefined || part < 0 || bandaged.has(part) || keep[part] === 0) return;
      bandaged.add(part);
      bound.push({ part, along, long });
    };
  for (const m of look.bound) {
    const gone = look.lost.includes(m);
    if (m === "head" || m === "eye-l" || m === "eye-r") bind(a.on.head, 0.15, 0.35);
    else if (m === "trunk") bind(a.on.trunk, 0.05, 0.35);
    else if (m === "hand-l" || m === "hand-r") {
      const hand = a.parts[m][0],
        arm = armOf(m === "hand-l" ? "l" : "r")[0];
      if (!gone && hand !== undefined) bind(hand, 0, 1.1);
      else bind(arm, -0.4, 0.25);
    } else bind(a.parts[m as BlowPlace][0], gone ? -0.3 : 0, gone ? 0.4 : 0.45);
  }
  // Held: an arm stiff, on a crutch, in a sling (the last wins); a limping leg swinging less.
  const holdArm = (s: "l" | "r" | null, pitch: number) => {
    if (s) for (const i of armOf(s)) hold[i] = pitch;
  };
  holdArm(look.stiff, WOUND_HOLD.stiff);
  holdArm(look.crutch, WOUND_HOLD.crutch);
  holdArm(look.sling, WOUND_HOLD.sling);
  if (look.limp) for (const i of legOf(look.limp)) swing[i] = Math.min(swing[i]!, WOUND_HOLD.limp);
  // Worn: a patch over the eye and its strap; a crutch under the arm; a sling's cradle and strap; a scar.
  const head = a.on.head >= 0 ? parts[a.on.head] : undefined,
    trunk = a.on.trunk >= 0 ? parts[a.on.trunk] : undefined;
  if (look.patch && head) {
    const e = partExtent(head),
      s = sign(look.patch);
    props.push(
      prop(
        "patch",
        head.x + s * 0.23 * e[0],
        head.y + 0.08 * e[1],
        head.z + 0.5 * e[2] + 0.004,
        0.3 * e[0],
        0.28 * e[1],
        0.012,
      ),
      prop("strap", head.x, head.y + 0.16 * e[1], head.z, 1.04 * e[0], 0.07 * e[1], 1.04 * e[2]),
    );
  }
  if (look.crutch) {
    const s = look.crutch,
      lead = armOf(s)[0],
      arm = (lead !== undefined ? parts[lead] : undefined) ?? trunk;
    if (arm) {
      const e = partExtent(arm),
        top = arm.y + (arm.pivot ?? e[1] / 2) - 0.015,
        x = arm.x + sign(s) * (0.5 * e[0] + 0.018),
        z = arm.z + 0.015;
      props.push(
        prop("crutch", x, top / 2, z, 0.022, top, 0.022),
        prop("crutch", x, top + 0.01, z, 0.024, 0.02, 0.085),
      );
    }
  }
  if (look.sling && trunk) {
    const e = partExtent(trunk),
      s = sign(look.sling);
    // (Its cradle under the arm held forward at its side; its strap down the chest from the other shoulder.)
    props.push(
      prop(
        "sling",
        trunk.x + s * (0.5 * e[0] + 0.02),
        trunk.y - 0.03,
        trunk.z + 0.5 * e[2] + 0.06,
        0.055,
        0.045,
        0.11,
      ),
      prop(
        "sling",
        trunk.x - s * 0.18 * e[0],
        trunk.y + 0.25 * e[1],
        trunk.z + 0.5 * e[2] + 0.006,
        0.08 * e[0],
        0.62 * e[1],
        0.012,
      ),
    );
  }
  if (head && look.scars.includes("head")) {
    const e = partExtent(head);
    props.push(
      prop(
        "scar",
        head.x - 0.22 * e[0],
        head.y - 0.02 * e[1],
        head.z + 0.5 * e[2] + 0.003,
        0.06 * e[0],
        0.4 * e[1],
        0.008,
      ),
    );
  }
  return { keep, hold, swing, props, bound, limp: look.limp || look.crutch ? LIMP_DIP : 0 };
}

/** A limb's pitch as a wound has it: held, or its pose's swing the less. */
export function woundPitch(g: WoundGear, part: number, posed: number): number {
  const held = g.hold[part]!;
  return Number.isNaN(held) ? posed * g.swing[part]! : held;
}
/** A limp's dip at each step (`t` the stride's clock as limbPitch takes it; `i` their place in the plan). */
export function woundBob(g: WoundGear, t: number, i: number): number {
  return g.limp ? -g.limp * Math.max(0, Math.sin(t * 2 * Math.PI * STRIDES + i * 1.7)) : 0;
}

/** Their walk to be dressed: from and till (seconds into the day), to whom, why. */
export type DressAt = {
  readonly at: number;
  readonly until: number;
  readonly to: "healer" | "hospital";
  readonly why: string;
};
/**
 * A day as their wounds and the levy make it (times in seconds into the day): a day as any; away
 * all day; home today from the road at `at`, then abed, up and bound, or their evening; struck down
 * (or killed) at `at` and abed (gone) from then; abed all day; up and bound, perhaps to be dressed;
 * gone.
 */
export type WoundDay =
  | { readonly kind: "whole" }
  | { readonly kind: "away"; readonly why: string }
  | { readonly kind: "gone" }
  | {
      readonly kind: "cut";
      readonly at: number;
      readonly then: "abed" | "gone";
      readonly why: string;
    }
  | { readonly kind: "abed"; readonly where: "home" | "hospital"; readonly why: string }
  | { readonly kind: "mending"; readonly why: string; readonly dress: DressAt | null }
  | {
      readonly kind: "home";
      readonly event: string;
      readonly at: number;
      readonly then: "abed" | "mending" | "whole";
      readonly where: "home" | "hospital";
      readonly borne: boolean;
      /** On the way in, in words; and after. */
      readonly away: string;
      readonly why: string;
    };
export const WHOLE_DAY: WoundDay = { kind: "whole" };
const GONE: WoundDay = { kind: "gone" };

/** A homecoming of the levy from a battle (Phase 55 M226): when its column comes in from the road's end, the battle in words, and who comes in what order — the litters first, then the walking wounded, then the rest. */
export type Homecoming = {
  readonly event: string;
  readonly at: number;
  readonly where: string;
  readonly people: readonly {
    readonly index: number;
    readonly at: number;
    readonly borne: boolean;
    readonly wounded: boolean;
  }[];
};
const COMINGS = new WeakMap<VillagePlan, Map<number, readonly Homecoming[]>>();

/** A town's homecomings of a day (days since the world began): the columns in turn, the earliest first, each after the last man of the one before. */
export function homecomingsOn(plan: VillagePlan, day: number): readonly Homecoming[] {
  let days = COMINGS.get(plan);
  if (!days) COMINGS.set(plan, (days = new Map()));
  const known = days.get(day);
  if (known) return known;
  const d0 = day * DAY,
    d1 = d0 + DAY,
    by = new Map<
      string,
      { at: number; where: string; people: { index: number; borne: boolean; wounded: boolean }[] }
    >();
  plan.people.forEach((p, index) => {
    if (p.gone !== undefined && p.gone < d1) return;
    for (const a of p.away ?? []) {
      if (a.until < d0 || a.until >= d1) continue;
      const hurt = (p.wounds ?? []).filter((w) => w.event === a.event),
        c = by.get(a.event) ?? { at: a.until, where: a.where, people: [] };
      c.at = Math.min(c.at, a.until);
      c.people.push({ index, borne: hurt.some((w) => w.borne), wounded: hurt.length > 0 });
      by.set(a.event, c);
    }
  });
  const rank = (q: { borne: boolean; wounded: boolean }) => (q.borne ? 0 : q.wounded ? 1 : 2);
  // (Columns of one day come in by one road: each waits for the one before it to be in.)
  let free = -Infinity;
  const out: Homecoming[] = [...by.entries()]
    .sort(([e1, a], [e2, b]) => a.at - b.at || (e1 < e2 ? -1 : e1 > e2 ? 1 : 0))
    .map(([event, c]) => {
      const at = Math.max(c.at, free);
      let t = at;
      const people = [...c.people]
        .sort((a, b) => rank(a) - rank(b) || a.index - b.index)
        .map((q) => {
          const mine = t;
          t += q.borne ? COLUMN_GAP.litter : q.wounded ? COLUMN_GAP.walker : COLUMN_GAP.stood;
          return { ...q, at: mine };
        });
      free = t + COLUMN_GAP.between;
      return { event, at, where: c.where, people };
    });
  if (days.size > 64) days.clear();
  days.set(day, out);
  return out;
}

/** Their walk to be dressed on a day they are up and bound: every third day from their first up, to the healer's door or the hospital's (null: tended at home, or no healer). */
function dressOf(plan: VillagePlan, index: number, w: Wound, day: number): DressAt | null {
  const healer = plan.people.findIndex((q) => !!q.healer),
    to =
      w.tended === "hospital"
        ? "hospital"
        : w.tended === "healer" && healer >= 0 && healer !== index
          ? "healer"
          : null;
  if (!to || (day - Math.floor(w.up / DAY)) % DRESSING.every !== 1) return null;
  const at = DRESSING.from * HOUR + (index % DRESSING.slots) * DRESSING.slot;
  return {
    at,
    until: at + DRESSING.long,
    to,
    why:
      to === "hospital"
        ? "Having the wound dressed at the hospital"
        : `Having the wound dressed by ${plan.people[healer]!.name}, the healer`,
  };
}

/** A person's day as their wounds and the levy make it (any but "whole" is the view's to lay: view/village.ts). */
export function woundDay(plan: VillagePlan, index: number, day: number): WoundDay {
  const p = plan.people[index];
  if (!p || (!p.wounds?.length && !p.away?.length && p.gone === undefined)) return WHOLE_DAY;
  const d0 = day * DAY,
    d1 = d0 + DAY,
    wounds = p.wounds ?? [];
  if (p.gone !== undefined && p.gone < d1)
    return p.gone <= d0
      ? GONE
      : { kind: "cut", at: p.gone - d0, then: "gone", why: "Killed where they were struck" };
  // Away with the levy all day; or home today from the road.
  let back: Away | null = null;
  for (const a of p.away ?? []) {
    if (a.until <= d0 || a.from >= d1) continue;
    if (a.until >= d1) return { kind: "away", why: `Away with the levy, at ${a.where}` };
    if (!back || a.until > back.until) back = a;
  }
  if (back) {
    const b = back,
      me = homecomingsOn(plan, day)
        .find((h) => h.event === b.event)
        ?.people.find((q) => q.index === index),
      after = b.until + 60,
      hurt = wounds.filter((w) => w.event === b.event),
      abed = hurt.find((w) => woundStage(w, after) === "abed"),
      mending = hurt.find((w) => woundStage(w, after) === "mending"),
      told = abed ?? mending;
    return {
      kind: "home",
      event: b.event,
      at: (me?.at ?? b.until) - d0,
      then: abed ? "abed" : mending ? "mending" : "whole",
      where: abed?.tended === "hospital" ? "hospital" : "home",
      borne: me?.borne ?? false,
      away: `Coming home from ${b.where}`,
      why: (told && woundNow(told, after, p.sex)) ?? `Home from ${b.where}`,
    };
  }
  // Struck down by a strike today: abed from that moment.
  const struck = wounds.find((w) => w.from !== "battle" && w.at >= d0 && w.at < d1);
  if (struck)
    return {
      kind: "cut",
      at: struck.at - d0,
      then: "abed",
      why: woundNow(struck, struck.at + 1, p.sex) ?? "Abed with their wounds",
    };
  // Abed, or up and bound, as noon finds them.
  const noon = d0 + 12 * HOUR,
    abed = wounds.find((w) => woundStage(w, noon) === "abed");
  if (abed)
    return {
      kind: "abed",
      where: abed.tended === "hospital" ? "hospital" : "home",
      why: woundNow(abed, noon, p.sex) ?? "Abed with their wounds",
    };
  const mending = wounds.find((w) => woundStage(w, noon) === "mending");
  if (mending)
    return {
      kind: "mending",
      why: woundNow(mending, noon, p.sex) ?? "Up again, the wound still bound",
      dress: dressOf(plan, index, mending, day),
    };
  return WHOLE_DAY;
}

/** Whether one is out of sight at any time in [from, until) (world seconds): away with the levy, abed, gone. */
export function unseen(plan: VillagePlan, index: number, from: number, until: number): boolean {
  const p = plan.people[index];
  if (!p) return false;
  if (p.gone !== undefined && p.gone < until) return true;
  for (const a of p.away ?? []) if (a.from < until && a.until > from) return true;
  for (const w of p.wounds ?? []) {
    const down = w.from === "battle" ? w.home : w.at;
    if (w.up > down && down < until && w.up > from) return true;
  }
  return false;
}

/** Whether a wound keeps one from the town's heavy work on a day (bearing, the bucket line, digging, its errands): away, abed, up and bound or gone that day; on a crutch, limping, an arm or a hand lost. */
export function hurtOn(plan: VillagePlan, index: number, day: number): boolean {
  const p = plan.people[index];
  if (!p || (!p.wounds?.length && !p.away?.length && p.gone === undefined)) return false;
  if (woundDay(plan, index, day).kind !== "whole") return true;
  const l = lookNow(p, day * DAY + 12 * HOUR);
  return !!(l.crutch || l.limp || l.lost.some((m) => m.startsWith("arm") || m.startsWith("hand")));
}

/** Whether they go to their own work on a day (the town's errands): not kept from it by the levy or a wound still healing, nor on a crutch. A stump, a limp, an arm held stiff or a patch keeps no one from it. */
export function fitOn(plan: VillagePlan, index: number, day: number): boolean {
  const p = plan.people[index];
  if (!p || (!p.wounds?.length && !p.away?.length && p.gone === undefined)) return true;
  return woundDay(plan, index, day).kind === "whole" && !lookNow(p, day * DAY + 12 * HOUR).crutch;
}

/** How fast they walk on a day, of their kind's pace (1: as ever). */
export function woundPace(plan: VillagePlan, index: number, day: number): number {
  const p = plan.people[index];
  if (!p?.wounds?.length) return 1;
  const l = lookNow(p, day * DAY + 12 * HOUR),
    leg = (m: WoundMember) => m === "leg-l" || m === "leg-r";
  if (l.crutch) return WOUND_PACE.crutch;
  if (l.lost.some(leg)) return WOUND_PACE.legGone;
  if (l.limp) return WOUND_PACE.limp;
  if (l.bound.some(leg)) return WOUND_PACE.legBound;
  return l.bound.length ? WOUND_PACE.bound : 1;
}

const GRIEF: Readonly<Record<WoundOutcome, number>> = { lost: 0, lame: 1, scarred: 2, healed: 3 };
/** Their wounds told at t (their card): how one heals now, if one does, then the gravest first (at most three). */
export function woundLines(p: VillagePlan["people"][number], t: number): string[] {
  const dealt = (p.wounds ?? []).filter((w) => w.at <= t);
  if (!dealt.length) return [];
  const healing = dealt
      .filter((w) => {
        const s = woundStage(w, t);
        return s === "abed" || s === "mending";
      })
      .sort((a, b) => b.at - a.at)[0],
    now = healing ? woundNow(healing, t, p.sex) : null,
    told = [...dealt]
      .sort((a, b) => GRIEF[a.outcome] - GRIEF[b.outcome] || b.at - a.at)
      .slice(0, 3)
      .map((w) => woundWords(w, p.sex));
  return now ? [now, ...told] : told;
}
