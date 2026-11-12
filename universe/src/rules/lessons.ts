// What a people learns from what has cost it (asked 2026-11-12: "they should learn at some point if they have this many earthquakes
// or wtv they should build structures that support that but this should emerge from data driven means not necessirly hardcoded in
// ... there should be countless like armies that lose a learn"). A principle says what it does, the world says how: nothing here
// says "a land of quakes builds strong". A land, or a realm, keeps what has cost it by cause, faded with the years; a response is a
// choice the world already makes that has another way of making it, which lowers the cost of a cause by what it does. How much a
// people leans on a response grows with what the cause has cost them, and with whether leaning on it lowered that cost; it is
// taken up by a keyed draw, never at a line drawn for one cause; it spreads to those beside who have felt the same; and it fades
// when the cost stops coming. So the lessons are the causes a world's record holds times the choices of the game, and adding one
// is a row: a cause and what it costs, or a response, the cause it answers and how it works.
import { dmath } from "../kernel/index.ts";

/** Who keeps a cause's cost: a land's people, or a realm (its hosts). */
export type LessonScope = "land" | "realm";

/** A cause of loss, as a world's history writes it. */
export type LessonCause = {
  readonly id: string;
  readonly scope: LessonScope;
  /** What it is, in a sentence: "quakes", "their foes' blades". */
  readonly words: string;
  /** What it takes, counted, after its count: "homes lost to quakes", "went hungry". */
  readonly lost: string;
  /** One strike of it, and more: "quake", "quakes". */
  readonly each: readonly [string, string];
};

/**
 * How a response works, by name: `lessen` takes so much off what each strike of its cause costs at the point the world reckons it
 * (a share of homes that a braced frame keeps standing); `store` puts by so many months more of a year's food; `field` fields so much more of the fighting men; `doctrine:<axis>` weighs
 * an axis of a host's design so much more as it is drawn up (rules/designs.ts); `walls` and `siege` strengthen a host holding its
 * own ground or coming against another's.
 */
export type LessonHow = "lessen" | "store" | "field" | "walls" | "siege" | `doctrine:${string}`;

/** A response: a way of making a choice the world already makes, and the cause it answers. */
export type LessonResponse = {
  readonly id: string;
  readonly cause: string;
  readonly how: LessonHow;
  /** At full use, how far it goes: the share of a strike's cost taken off, or what it adds. */
  readonly most: number;
  /**
   * What it asks of them, against what the cause costs (0 to 1): the more it asks, the more loss it takes before a people
   * leans on it (a raised floor asks little; a levy of more of the men asks much).
   */
  readonly asks: number;
  /** What they do now, in words: "build braced frames". */
  readonly does: string;
  /** What it is, for the annals: "braced frames against the quakes". */
  readonly name: string;
};

/** The causes of loss. Each is read off the events history already writes (sim/lore/lessons.ts holds the readings). */
export const LESSON_CAUSES: readonly LessonCause[] = [
  {
    id: "quake",
    scope: "land",
    words: "quakes",
    lost: "homes lost to quakes",
    each: ["quake", "quakes"],
  },
  { id: "fire", scope: "land", words: "fire", lost: "homes lost to fire", each: ["fire", "fires"] },
  {
    id: "flood",
    scope: "land",
    words: "floods",
    lost: "lives lost to floods",
    each: ["flood", "floods"],
  },
  {
    id: "famine",
    scope: "land",
    words: "hunger",
    lost: "went hungry",
    each: ["famine", "famines"],
  },
  {
    id: "sickness",
    scope: "land",
    words: "sickness",
    lost: "lives lost to sickness",
    each: ["outbreak", "outbreaks"],
  },
  {
    id: "blades",
    scope: "realm",
    words: "their foes' blades and charges",
    lost: "men lost to their foes' blades and charges",
    each: ["battle", "battles"],
  },
  {
    id: "volleys",
    scope: "realm",
    words: "their foes' shot and arrows",
    lost: "men lost to their foes' shot and arrows",
    each: ["battle", "battles"],
  },
  {
    id: "numbers",
    scope: "realm",
    words: "being outnumbered",
    lost: "men lost to being outnumbered",
    each: ["battle", "battles"],
  },
  {
    id: "strongholds",
    scope: "realm",
    words: "coming against walls and heights",
    lost: "men lost to coming against walls and heights",
    each: ["battle", "battles"],
  },
  {
    id: "invasion",
    scope: "realm",
    words: "invaders on their own ground",
    lost: "men lost to invaders on their own ground",
    each: ["battle", "battles"],
  },
];

/**
 * The responses. The figures are estimates, each from what the thing does: a braced or tied frame stands through shaking that
 * brings an unbraced one down (half and more of the homes kept, as retrofits are reckoned); lanes kept open between rows stop a
 * fire spreading from roof to roof; floors raised above the usual flood and a way to the high ground; a granary holds half a lean
 * year's want; keeping the sick apart and the water clean halve what a sickness takes where it comes.
 */
export const LESSON_RESPONSES: readonly LessonResponse[] = [
  {
    id: "braced-frames",
    cause: "quake",
    how: "lessen",
    most: 0.6,
    asks: 0.3,
    does: "build braced frames that stand when the ground shakes",
    name: "braced frames against the quakes",
  },
  {
    id: "firebreaks",
    cause: "fire",
    how: "lessen",
    most: 0.5,
    asks: 0.25,
    does: "keep open lanes between their rows, so a fire stops at them",
    name: "firebreaks between the rows",
  },
  {
    id: "raised-floors",
    cause: "flood",
    how: "lessen",
    most: 0.55,
    asks: 0.2,
    does: "raise their floors and keep a way to the high ground",
    name: "raised floors against the floods",
  },
  {
    id: "granaries",
    cause: "famine",
    how: "store",
    most: 6,
    asks: 0.35,
    does: "fill common granaries against the lean years",
    name: "granaries against hunger",
  },
  {
    id: "quarantine",
    cause: "sickness",
    how: "lessen",
    most: 0.45,
    asks: 0.3,
    does: "keep the sick apart and their water clean",
    name: "keeping the sick apart",
  },
  {
    id: "heavier-guard",
    cause: "blades",
    how: "doctrine:protection",
    most: 0.6,
    asks: 0.3,
    does: "arm their hosts for guard first",
    name: "a heavier guard",
  },
  {
    id: "own-volleys",
    cause: "volleys",
    how: "doctrine:firepower",
    most: 0.6,
    asks: 0.3,
    does: "arm their hosts to shoot as their foes shot",
    name: "shot of their own",
  },
  {
    id: "greater-levy",
    cause: "numbers",
    how: "field",
    most: 0.05,
    asks: 0.5,
    does: "keep more of their men under arms",
    name: "a greater levy",
  },
  {
    id: "siegecraft",
    cause: "strongholds",
    how: "siege",
    most: 0.35,
    asks: 0.35,
    does: "bring ladders, rams and engines against walls",
    name: "siegecraft",
  },
  {
    id: "border-works",
    cause: "invasion",
    how: "walls",
    most: 0.3,
    asks: 0.3,
    does: "fortify the lands their foes have crossed",
    name: "works along the border",
  },
];

/** The same rows by id. */
export const LESSON_CAUSE: ReadonlyMap<string, LessonCause> = new Map(
  LESSON_CAUSES.map((c) => [c.id, c]),
);
export const LESSON_RESPONSE: ReadonlyMap<string, LessonResponse> = new Map(
  LESSON_RESPONSES.map((r) => [r.id, r]),
);
/** Each cause's responses. */
export const LESSONS_FOR: ReadonlyMap<string, readonly LessonResponse[]> = new Map(
  LESSON_CAUSES.map((c) => [c.id, LESSON_RESPONSES.filter((r) => r.cause === c.id)]),
);

/** The one set of figures every lesson learns by, whatever its cause. */
export const LESSON = {
  /** Years for what a cause cost to be half forgotten: about a lifetime's telling of it. */
  fade: 40,
  /** Years for a practice to be half let go once nothing presses it: it outlives the pain by a generation. */
  keep: 60,
  /**
   * What a cause has cost a people, as a share of them, that presses them as much as can be (e to the minus one short of it):
   * lose a fortieth of a land's people, or its homes, within remembered years, and it is never out of mind.
   */
  presses: 0.025,
  /** How far one strike moves them toward full use, pressed as hard as can be. */
  gain: 0.45,
  /** How readily those beside, who have felt the same, take it up when a people does: against their own pressure. */
  spread: 0.6,
  /** What of a neighbour's use a people struck takes up, when the neighbour's has worked. */
  copy: 0.7,
  /** How many strikes since it was taken up before a people judges whether it worked. */
  judged: 2,
  /** How far its working (what each strike costs since, against before) moves them: halving the cost doubles the gain. */
  trust: 1,
  /** Below this use a practice is let go and forgotten. */
  least: 0.03,
} as const;

/** The share of their cost a people's use of a response takes off a strike (`lessen`). */
export function lessenBy(r: Pick<LessonResponse, "most">, use: number): number {
  return Math.max(0, Math.min(1, r.most * Math.max(0, Math.min(1, use))));
}

/** How hard what a cause has cost them presses them (0 to 1), from the share of them it has cost, faded. */
export function pressOf(share: number): number {
  return share > 0 ? 1 - dmath.exp(-share / LESSON.presses) : 0;
}

/** What is left of something after `years`, at a half-life of `half`. */
export function faded(v: number, years: number, half: number): number {
  return years <= 0 ? v : v * dmath.pow(0.5, years / half);
}

/**
 * Whether a response has worked: what each strike cost them since it was taken up, against before (as a factor the gain is moved
 * by: above 1 it worked; under 1 it did not, and they lean on it less), or 1 while too few have come to judge.
 */
export function trustOf(before: number, since: number, strikes: number): number {
  if (strikes < LESSON.judged || before <= 0) return 1;
  const ratio = before / Math.max(since, before * 0.1);
  return Math.max(0.25, Math.min(3, dmath.pow(ratio, LESSON.trust)));
}

/**
 * One strike's move of a people's use of a response: toward full use by how hard the cause presses them, against what the response
 * asks of them, and by whether it has worked; away from it, where it has not.
 */
export function useAfter(use: number, press: number, asks: number, trust: number): number {
  const pull = press * (1 - asks) * LESSON.gain;
  const next =
    trust >= 1
      ? use + (1 - use) * Math.min(1, pull * trust)
      : use * trust + (1 - use) * pull * trust;
  return Math.max(0, Math.min(1, next));
}

/** The chance a people pressed so hard first takes a response up at a strike (a keyed draw against it). */
export function takeUpChance(press: number, asks: number): number {
  return Math.max(0, Math.min(1, press * (1 - asks)));
}
