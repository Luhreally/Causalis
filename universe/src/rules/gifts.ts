// The god's gifts to a body held (asked for 2026-11-21: "when i play as a person too make like sprint faster or add a god
// mode tab that can give me special powers when i possess them"), and a body's own pace at a sprint. Pure: what a body
// can do by itself — its top speed from its kind, its age, its health and wounds, what it carries, and the breath a
// sprint spends and a walk gives back — and what each gift changes of that, or of the bodies about it. The small worlds
// a body is held in (rules/possess.ts a town's, rules/fight.ts a field's) read these; what a gift does to another body
// (a blow that does no harm, one felled at a touch, one healed, a bolt at a place) is done there, by the bids and the
// gifts each second sent carries, so a world replays it as it was done.
// est: a young adult untrained sprints about 6–7 m/s for 10–15 s before the legs fail (the anaerobic store), jogs on at
// half that; top speed falls about a percent a year past thirty (masters' sprint records fall a little slower, the
// untrained faster); a load of a quarter of the body's weight costs about a quarter of a sprint; a lame leg more than half.
import { dmath } from "../kernel/index.ts";

/** The gifts, in the order the sheet shows them (each a bit of a second's `gifts`, in this order). */
export const GIFTS = [
  "swift",
  "wings",
  "unbreakable",
  "strength",
  "healing",
  "smite",
  "unseen",
  "command",
  "slow",
] as const;
export type Gift = (typeof GIFTS)[number];
export const GIFT_BIT: Readonly<Record<Gift, number>> = Object.fromEntries(
  GIFTS.map((g, i) => [g, 1 << i]),
) as Record<Gift, number>;
/** Every gift's bit. */
export const GIFT_ALL = (1 << GIFTS.length) - 1;
/** Whether a second's gifts hold one. */
export const gifted = (gifts: number | undefined, g: Gift): boolean =>
  ((gifts ?? 0) & GIFT_BIT[g]) !== 0;

/** The act a healing touch is bid as (a town's acts take 1 … 7, a field's 8 … 10). */
export const GIFT_ACT = { heal: 11 } as const;

/** What the god's hand may call down at a place: a bolt, fire, the ground shaken, rain. */
export const SMITES = ["lightning", "fire", "quake", "rain"] as const;
export type SmiteKind = (typeof SMITES)[number];
/** A smiting at a step of the second (0 … 19), where (metres of the small world's ground), which. */
export type Smite = {
  readonly when: number;
  readonly kind: number;
  readonly x: number;
  readonly z: number;
};
/** The most smitings a second, and how far from the one held a place may be (metres). */
export const SMITE_MOST = { second: 4, far: 120 } as const;
/**
 * What each does where it falls (metres): a bolt strikes down those it falls among and throws those near it; fire burns
 * those it falls among, the rest run from it; the ground shaken throws down all who stand within its reach; rain parts
 * the fighting under it. `seen`: how far it is seen (a bolt or a fire far further than a blow).
 */
export const SMITE_REACH = {
  lightning: { strikes: 2.2, throws: 6, scatters: 24, seen: 60 },
  fire: { burns: 3.5, harm: 0.6, scatters: 14, seen: 50 },
  quake: { throws: 28, seen: 40 },
  rain: { parts: 30, seen: 40 },
} as const;

/** Why smitings sent with a second are not (null: they are). */
export function smitesProblem(v: unknown, steps: number): string | null {
  if (v === undefined) return null;
  if (!Array.isArray(v) || v.length > SMITE_MOST.second)
    return `at most ${SMITE_MOST.second} smitings a second`;
  for (const s of v as Partial<Smite>[])
    if (
      !s ||
      !Number.isInteger(s.when) ||
      s.when! < 0 ||
      s.when! >= steps ||
      !Number.isInteger(s.kind) ||
      s.kind! < 0 ||
      s.kind! >= SMITES.length ||
      typeof s.x !== "number" ||
      typeof s.z !== "number" ||
      !Number.isFinite(s.x) ||
      !Number.isFinite(s.z) ||
      Math.abs(s.x) > 1e5 ||
      Math.abs(s.z) > 1e5
    )
      return "a smiting is a step of the second, one of the god's strokes, and where";
  return null;
}

/** Why a second's gifts are not (null: they are, or none was sent). */
export function giftsProblem(v: unknown): string | null {
  return v === undefined || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= GIFT_ALL)
    ? null
    : "gifts are the god's gifts, one bit each";
}

// —— A body at a sprint ——————————————————————————————————————————————————————————

export const GAIT = {
  /** A grown upright ape in its prime at its fastest (m/s). */
  prime: 6.4,
  /** Its prime runs to this age; past it so much of the top is lost a year, to no less than `oldest` of it. */
  peakTo: 30,
  ageing: 0.012,
  oldest: 0.3,
  /** A child at its youngest runs so much of a grown one's top (and more as it grows). */
  young: 0.5,
  /** Out of breath, a sprint is so much of the top (a jog); never below the body's own walk. */
  spent: 0.5,
  /** Seconds a sprint lasts from full breath (a body in its prime; the old tire the sooner). */
  breath: 12,
  /** Seconds to get the breath back at a walk, and standing. */
  backWalking: 30,
  backStanding: 12,
  /** One hurt runs so much of its top at no strength left (and its whole top whole). */
  hurt: 0.4,
  /** A blow in the last month; one lame or lost leg, both. */
  sore: 0.8,
  lame: 0.45,
  lamer: 0.25,
  hardy: 1.05,
  frail: 0.85,
} as const;

/** What a load slows a sprint to, by how it is carried (the view's Carry): a sack of grain the most. */
export const LOAD: Readonly<Record<string, number>> = {
  sack: 0.72,
  sheaf: 0.85,
  pots: 0.85,
  raw: 0.88,
  tool: 0.96,
  cloth: 0.97,
};
/** A soldier's arms and armour: his guard (0 … 1) costs so much of a sprint at the most, his arms this. */
export const ARMOUR_LOAD = 0.28,
  ARMS_LOAD = 0.04;

/** What a body's sprint is read from: its age and its people's, its kind's pace (personFrame's run), traits, wounds. */
export type BodyRead = {
  readonly age: number;
  readonly adulthood: number;
  /** Its people's pace against an upright ape's (1: one). */
  readonly kind: number;
  readonly hardy?: boolean;
  readonly frail?: boolean;
  /** A blow in the last month not yet healed; legs lame or lost by lasting wounds (0, 1, 2). */
  readonly sore?: boolean;
  readonly lame?: number;
  /** As strong as it was drawn (a soldier's 0.85 … 1.15; 1). */
  readonly strength?: number;
};

/** How much of its prime a body of an age runs. */
export function ageShare(age: number, adulthood: number): number {
  if (age < adulthood)
    return GAIT.young + (1 - GAIT.young) * dmath.clamp(age / Math.max(1, adulthood), 0, 1);
  return age <= GAIT.peakTo ? 1 : Math.max(GAIT.oldest, 1 - GAIT.ageing * (age - GAIT.peakTo));
}

/** A body's top speed (m/s), unhurt and unladen. */
export function sprintTop(r: BodyRead): number {
  const lame = r.lame ?? 0;
  return (
    GAIT.prime *
    r.kind *
    ageShare(r.age, r.adulthood) *
    (r.hardy ? GAIT.hardy : 1) *
    (r.frail ? GAIT.frail : 1) *
    (r.sore ? GAIT.sore : 1) *
    (lame >= 2 ? GAIT.lamer : lame === 1 ? GAIT.lame : 1) *
    (r.strength ?? 1)
  );
}

/** A body's breath and height as it is held: 0 … 1 breath left; metres above the ground (a flier's). */
export type Gait = { wind: number; y: number };
export const FRESH_GAIT: Gait = { wind: 1, y: 0 };

/** Swift: so much faster than the body's top, and never tiring. Slow: the one held moves so many times on a step. */
export const SWIFT = 1.6,
  SLOW = 4;

/**
 * Flight (the gift of wings): risen so fast while bid to rise (m/s), sunk so fast while not (a glide down, landing safe),
 * no higher than `most`; across the ground at `pace` (m/s; Swift the more). Above `clear` no blow by hand reaches the one
 * flying nor theirs any other; above a town's roofs (`roofs`, else `over`) its walls do not hold them.
 */
export const FLIGHT = { rise: 4, sink: 2.5, most: 40, pace: 8, clear: 2.2, over: 10 } as const;

/**
 * A step of a body's gait (`dt` seconds): how fast it may go now (m/s) bid at a sprint or not, and its breath and height
 * after. `walk`: its own walk; `top`: its top speed, unhurt; `health`: its strength left against its whole (0 … 1); `load`:
 * what it carries costs (1: nothing); `moving`: pushed at all. Breath spent at a sprint (sooner the older: `age`), got back
 * at a walk, sooner standing. Swift never tires and runs past the top; wings rise and glide.
 */
export function gaitStep(
  g: Gait,
  o: {
    readonly dt: number;
    readonly walk: number;
    readonly top: number;
    readonly health: number;
    readonly load: number;
    readonly sprint: boolean;
    readonly moving: boolean;
    readonly age: number;
    readonly swift: boolean;
    readonly wings: boolean;
    readonly rise: boolean;
  },
): { pace: number; gait: Gait } {
  const top = o.top * (GAIT.hurt + (1 - GAIT.hurt) * dmath.clamp(o.health, 0, 1)) * o.load,
    sprinting = o.sprint && o.moving;
  let wind = g.wind;
  if (o.swift) wind = 1;
  else if (sprinting) wind = Math.max(0, wind - o.dt / (GAIT.breath * Math.max(0.4, o.age)));
  else wind = Math.min(1, wind + o.dt / (o.moving ? GAIT.backWalking : GAIT.backStanding));
  const y = o.wings
    ? dmath.clamp(g.y + (o.rise ? FLIGHT.rise : -FLIGHT.sink) * o.dt, 0, FLIGHT.most)
    : Math.max(0, g.y - FLIGHT.sink * o.dt);
  const pace =
    y > 0 && o.wings
      ? FLIGHT.pace * (o.swift ? SWIFT : 1)
      : o.swift && o.sprint
        ? Math.max(o.walk, top * SWIFT)
        : sprinting
          ? Math.max(o.walk, top * (GAIT.spent + (1 - GAIT.spent) * wind))
          : o.walk;
  return { pace, gait: { wind, y } };
}

// —— Wonders seen ———————————————————————————————————————————————————————————————

/** What a people may take a wonder done through a body to show of the god (sim/belief/belief.ts omenOf's tenets). */
export type WonderTenet = "healing" | "fire" | "rain" | "presence";
/** What each wonder shows: a healing the healer; a bolt or fire one who sends fire; rain the rain's keeper; the rest a presence. */
export const WONDER_TENET: Readonly<Record<string, WonderTenet>> = {
  healed: "healing",
  lightning: "fire",
  fire: "fire",
  rain: "rain",
  quake: "presence",
  warded: "presence",
  felled: "presence",
  flew: "presence",
};
/**
 * How strongly a wonder seen is a sign (belief.ts omenOf's strength, 1 a god's act on a land): so many who saw it make it as
 * strong as one, no more than `most`; one seen by none is no sign. Wonders of one tenet in one holding are one sign, seen by
 * the most any of them was (they do not add up past what one great one would be).
 */
export const WONDER = { full: 12, most: 1.2 } as const;
export function wonderStrength(seen: number): number {
  return seen > 0 ? Math.min(WONDER.most, seen / WONDER.full) : 0;
}

/**
 * One of the god's acts on a land or a town called down through a body held (a smiting by fire, the ground shaken, rain:
 * the act's own effects), its event says through whom: `through`, their name (at most 80 letters; absent: none).
 */
export function throughOf(args: unknown): { through?: string } {
  const t = (args as { through?: unknown } | null)?.through;
  return typeof t === "string" && t.length > 0 && t.length <= 80 ? { through: t } : {};
}
