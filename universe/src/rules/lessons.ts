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
import { needsMet, type Effect } from "./principles.ts";

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
  /**
   * What a principle must do to answer it (rules/principles.ts EFFECTS): a people it presses leans its finding toward the principles
   * whose own effects these are (sim/lore/lore.ts), so a realm beaten by better arms looks the harder for arms of its own.
   */
  readonly answers: readonly Effect[];
};

/**
 * How a response works, by name: `lessen` takes so much off what each strike of its cause costs at the point the world reckons it
 * (a share of homes that a braced frame keeps standing); `field` fields so much more of the fighting men; `doctrine:<axis>` weighs
 * an axis of a host's design so much more as it is drawn up (rules/designs.ts); `walls` and `siege` strengthen a host holding its
 * own ground or coming against another's.
 */
export type LessonHow =
  | "lessen"
  | "field"
  | "walls"
  | "siege"
  | "screen"
  | "steady"
  | "supply"
  | "stores"
  | `doctrine:${string}`;

/**
 * What a response is made of, by what its people know: the last of these whose needs they meet (rules/principles.ts needsMet: every
 * need, "a|b" either), so siegecraft is ladders and rams before throwing engines, and those before great guns. Words only: what and
 * with what, never how a thing is built.
 */
export type LessonMeans = readonly { readonly needs: readonly string[]; readonly words: string }[];

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
  /** What they do now, in words: "build braced frames". `{means}` stands for what it is made of now (`means`, or `arms`). */
  readonly does: string;
  /** What it is made of, by what they know (the first row has no needs: what anyone has). */
  readonly means?: LessonMeans;
  /**
   * Or, for a host's kit: the part of that role its realm can field now, drawn up for that axis alone (rules/designs.ts, by the
   * realm's own materials and knowledge: sim/design/design.ts hostBest); `means` where it has none.
   */
  readonly arms?: { readonly role: "arm" | "guard" | "mount"; readonly axis: string };
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
    answers: ["building"],
  },
  {
    id: "fire",
    scope: "land",
    words: "fire",
    lost: "homes lost to fire",
    each: ["fire", "fires"],
    answers: ["building"],
  },
  {
    id: "flood",
    scope: "land",
    words: "floods",
    lost: "lives lost to floods",
    each: ["flood", "floods"],
    answers: ["building"],
  },
  {
    id: "famine",
    scope: "land",
    words: "hunger",
    lost: "went hungry",
    each: ["famine", "famines"],
    answers: ["farmYield", "herdYield", "forageYield", "storage", "keeping", "tools"],
  },
  {
    id: "sickness",
    scope: "land",
    words: "sickness",
    lost: "lives lost to sickness",
    each: ["outbreak", "outbreaks"],
    answers: ["health"],
  },
  {
    id: "blades",
    scope: "realm",
    words: "their foes' blades and charges",
    lost: "men lost to their foes' blades and charges",
    each: ["battle", "battles"],
    answers: ["arms", "armour"],
  },
  {
    id: "volleys",
    scope: "realm",
    words: "their foes' shot and arrows",
    lost: "men lost to their foes' shot and arrows",
    each: ["battle", "battles"],
    answers: ["arms", "armour"],
  },
  {
    id: "numbers",
    scope: "realm",
    words: "being outnumbered",
    lost: "men lost to being outnumbered",
    each: ["battle", "battles"],
    answers: ["arms"],
  },
  {
    id: "strongholds",
    scope: "realm",
    words: "coming against walls and heights",
    lost: "men lost to coming against walls and heights",
    each: ["battle", "battles"],
    answers: ["sieges"],
  },
  {
    id: "invasion",
    scope: "realm",
    words: "invaders on their own ground",
    lost: "men lost to invaders on their own ground",
    each: ["battle", "battles"],
    answers: ["walls", "arms"],
  },
  // How a battle went, from its own exchanges (rules/combat.ts, as the battle keeps them): the men a side lost before the lines
  // closed, to what was loosed at them; the men cut down once it broke, in the flight.
  {
    id: "range",
    scope: "realm",
    words: "being shot down before the lines closed",
    lost: "men lost before the lines closed",
    each: ["battle", "battles"],
    answers: ["arms", "armour"],
  },
  {
    id: "rout",
    scope: "realm",
    words: "breaking and being cut down in the flight",
    lost: "men cut down in the flight",
    each: ["battle", "battles"],
    answers: ["arms", "armour"],
  },
  // What the foe rode, against what they rode (rules/designs.ts mobility); and a host far from its seat, or hungry at home.
  {
    id: "mounted",
    scope: "realm",
    words: "their foes' riders",
    lost: "men lost to their foes' riders",
    each: ["battle", "battles"],
    answers: ["mounts"],
  },
  {
    id: "supply",
    scope: "realm",
    words: "marching far from their bread",
    lost: "men lost far from their bread",
    each: ["battle", "battles"],
    answers: ["haul", "storage"],
  },
];

/**
 * The responses. The figures are estimates, each from what the thing does: a braced or tied frame stands through shaking that
 * brings an unbraced one down (half and more of the homes kept, as retrofits are reckoned); lanes kept open between rows stop a
 * fire spreading from roof to roof; floors raised above the usual flood and a way to the high ground; keeping the sick apart and
 * the water clean halve what a sickness takes where it comes.
 */
// (Hunger is kept, and told, but nothing answers it yet. Granaries that put more by, and stores kept from spoiling, were tried and
// measured on first light to year 800 beside the world without them: what went hungry rose five times and twice over. Why is not
// yet read: likely food kept lowers its price, draws hands from the fields, and feeds more into the next lean year. An answer to
// hunger wants a reserve drawn only in lean months: a number a land, its own.)
export const LESSON_RESPONSES: readonly LessonResponse[] = [
  {
    id: "braced-frames",
    cause: "quake",
    how: "lessen",
    most: 0.6,
    asks: 0.3,
    does: "build {means} that stand when the ground shakes",
    means: [
      { needs: [], words: "frames of lashed poles" },
      { needs: ["carpentry"], words: "braced timber frames" },
      { needs: ["steel|made-oxygen|drawn-carbon"], words: "frames braced with steel" },
    ],
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
    does: "raise their floors {means} and keep a way to the high ground",
    means: [
      { needs: [], words: "on mounds of earth" },
      { needs: ["masonry|reef-building"], words: "on stone" },
    ],
    name: "raised floors against the floods",
  },
  {
    id: "quarantine",
    cause: "sickness",
    how: "lessen",
    most: 0.45,
    asks: 0.3,
    does: "keep the sick apart{means}",
    means: [
      { needs: [], words: "" },
      { needs: ["sanitation"], words: " and their water clean" },
      { needs: ["germs"], words: ", their water clean and their wounds washed" },
      { needs: ["vaccines"], words: ", their water clean, and the well inoculated" },
    ],
    name: "keeping the sick apart",
  },
  // Grain put by against the lean years (a land's famine: what it keeps, sim/population/systems.ts, so much the more).
  {
    id: "granaries",
    cause: "famine",
    how: "stores",
    most: 0.4,
    asks: 0.3,
    does: "put grain by against the lean years, in {means}",
    means: [
      { needs: [], words: "pits and baskets" },
      { needs: ["pottery-wheel|pitch-ware|ice-ware"], words: "jars in every house" },
      { needs: ["granaries"], words: "common granaries kept full" },
    ],
    name: "stores against the lean years",
  },
  {
    id: "heavier-guard",
    cause: "blades",
    how: "doctrine:protection",
    most: 0.6,
    asks: 0.3,
    does: "arm their hosts for guard first, with {means}",
    arms: { role: "guard", axis: "protection" },
    means: [{ needs: [], words: "what guard they can make" }],
    name: "a heavier guard",
  },
  {
    id: "own-volleys",
    cause: "volleys",
    how: "doctrine:firepower",
    most: 0.6,
    asks: 0.3,
    does: "arm their hosts to shoot as their foes shot, with {means}",
    arms: { role: "arm", axis: "range" },
    means: [{ needs: [], words: "what they can throw" }],
    name: "shot of their own",
  },
  {
    id: "greater-levy",
    cause: "numbers",
    how: "field",
    most: 0.05,
    asks: 0.5,
    does: "keep more of their men under arms{means}",
    means: [
      { needs: [], words: "" },
      { needs: ["standing-army"], words: ", a standing host and its reserves" },
    ],
    name: "a greater levy",
  },
  {
    id: "siegecraft",
    cause: "strongholds",
    how: "siege",
    most: 0.35,
    asks: 0.35,
    does: "come against walls with {means}",
    means: [
      { needs: [], words: "ladders and rams, and mines dug beneath them" },
      { needs: ["siege-craft"], words: "ladders, rams and throwing engines" },
      { needs: ["gunpowder"], words: "great guns and powder mines" },
      { needs: ["gunpowder", "factories|sea-works"], words: "heavy siege guns" },
      { needs: ["dropped-loads|thrown-loads"], words: "siege guns and loads dropped from the air" },
    ],
    name: "siegecraft",
  },
  {
    id: "border-works",
    cause: "invasion",
    how: "walls",
    most: 0.3,
    asks: 0.3,
    does: "fortify the lands their foes have crossed with {means}",
    means: [
      { needs: [], words: "banks of earth and ditches" },
      { needs: ["masonry|reef-building"], words: "walls of stone" },
      { needs: ["fortification"], words: "walls, towers and ditches" },
      { needs: ["gunpowder"], words: "low, thick walls that guns cannot breach" },
      { needs: ["automatic-fire"], words: "trenches, wire and gun pits" },
    ],
    name: "works along the border",
  },
  // A screen loosed ahead of the line draws the foe's first fire and spoils its aim: what is loosed at them before the lines close
  // strikes so much less (half at full use, as skirmishers screened a line).
  {
    id: "skirmish-screen",
    cause: "range",
    how: "screen",
    most: 0.5,
    asks: 0.3,
    does: "send {means} ahead of the line",
    means: [
      { needs: [], words: "their quickest in open order" },
      { needs: ["archery"], words: "a screen of archers" },
      { needs: ["firearms"], words: "skirmishers in open order" },
      { needs: ["rifling"], words: "riflemen in open order" },
    ],
    name: "a screen ahead of the line",
  },
  // Close order holds a line together when it is pressed and when it gives ground: fewer break at the blows, fewer are cut down
  // as it falls back (at full use, morale shaken and the flight's losses each the less by a half and more).
  {
    id: "formations",
    cause: "rout",
    how: "steady",
    most: 0.6,
    asks: 0.35,
    does: "fight in {means}",
    means: [
      { needs: [], words: "close ranks that hold together" },
      { needs: ["standing-army"], words: "drilled ranks that give ground in order" },
      { needs: ["firearms"], words: "squares of pike and shot" },
      { needs: ["rifling"], words: "steady lines that fire by rank" },
      { needs: ["automatic-fire"], words: "sections dug in, each covering the next" },
    ],
    name: "formations that hold",
  },
  // Riders of their own on the wings: the host drawn up for mobility.
  {
    id: "mounted-wings",
    cause: "mounted",
    how: "doctrine:mobility",
    most: 0.6,
    asks: 0.35,
    does: "fight {means} on their wings",
    arms: { role: "mount", axis: "mobility" },
    means: [{ needs: [], words: "with their swiftest runners" }],
    name: "wings of their own riders",
  },
  // A host fed from behind it: what distance and hunger at home take from it, so much less (half at full use).
  {
    id: "supply-trains",
    cause: "supply",
    how: "supply",
    most: 0.5,
    asks: 0.4,
    does: "feed their hosts from {means}",
    means: [
      { needs: [], words: "carriers marching behind them" },
      { needs: ["cart"], words: "carts and depots along the road" },
      { needs: ["railways"], words: "trains to the front and depots" },
      { needs: ["engines"], words: "lorries and depots" },
    ],
    name: "supply trains and depots",
  },
];

/** What a response is made of, by what its people know (`means`: the last row whose needs they meet). */
export function meansWords(
  r: Pick<LessonResponse, "means">,
  knows: (id: string) => boolean,
): string {
  let words = "";
  for (const m of r.means ?? []) if (needsMet(m, knows)) words = m.words;
  return words;
}

/** What they do, in words: the response's, its means filled in (`made`: what it is made of, else by what they know). */
export function doesWords(
  r: Pick<LessonResponse, "does" | "means">,
  knows: (id: string) => boolean,
  made?: string | null,
): string {
  return r.does.replace("{means}", made || meansWords(r, knows));
}

/**
 * The causes a principle answers: those whose answers (an effect) it has among its own effects (rules/principles.ts). Read from the
 * principle's effects, never listed by hand: steel answers blades and shot by its arms and armour; a granary, hunger by its storage.
 */
export function causesAnswered(p: { readonly effects: Partial<Record<Effect, number>> }): string[] {
  return LESSON_CAUSES.filter((c) => c.answers.some((e) => (p.effects[e] ?? 0) > 0)).map(
    (c) => c.id,
  );
}

/** How much more readily a principle is found by a people its answered causes press (1: not at all), from each cause's press. */
export function pushOf(answered: readonly string[], press: (cause: string) => number): number {
  let sum = 0;
  for (const c of answered) sum += press(c);
  return 1 + LESSON.push * Math.min(1, sum);
}

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
  /**
   * How much more readily a people finds a principle whose own effects answer what has cost it, pressed as hard as can be: at most
   * twice as readily (a realm beaten by better arms looks the harder for arms; Europe's case). Bounded, so no cost makes it certain.
   */
  push: 1,
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
