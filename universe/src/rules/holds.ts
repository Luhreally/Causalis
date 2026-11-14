// How a realm is held (asked 2026-11-13: "maybe some countires ban guns/weapons etc and rule over their citizen like authortiarians,
// maybe others are more democratic, maybe some countires learn from other countires faults ... strip it down to first principles so it
// all gets encompassed and emerges and potential alien combos"). Four numbers a realm, each 0 … 1, and nothing named:
//   force: the share of the means of violence its seat keeps from its people (0: every household bears what force their world
//          gives; 1: only its host does);
//   voice: how widely a choice must be carried (0: one; 1: every grown one);
//   word:  how freely word moves among its people (0: every word watched; 1: free);
//   trust: how far it binds itself to others, in pacts and in loans (0: to none; 1: freely).
// Every arrangement a people has comes of these and of what it is: an arms ban is force near 1 on a world of guns; a democracy, voice
// near 1 among upright apes; a hive whose every member decides as one and whose soldiers alone bear stings is voice and force both
// high, on a body that lives as one. The names a player reads are read off the numbers, the body and its means, and never kept.
// What moves them is the same machinery as a realm's laws (sim/order/holds.ts): its interest groups' wants by their sway, its ways,
// its memories; and what it learns, which is one rule: an outcome (a rising crushed, a pact that failed it, a neighbour's fall), the
// cause a people believes lay behind it (its own fault, others', weakness, the gods'), read off its ways, and a change to these
// numbers that follows from that belief. Pure tables and functions.
import type { BodyPlan } from "./bodies.ts";

/** The four, in the order a realm keeps them. */
export const HOLD_KINDS = ["force", "voice", "word", "trust"] as const;
export type Hold = (typeof HOLD_KINDS)[number];
export const HOLD: Readonly<Record<Hold, number>> = { force: 0, voice: 1, word: 2, trust: 3 };

/** The machinery's constants. */
export const HOLDING = {
  /** How far a weighing moves a number toward what is wanted of it, and the least gap worth moving. */
  pace: 0.3,
  least: 0.06,
  /** How much a pull from a lesson keeps, each weighing (every ten years). */
  pullKept: 0.5,
  /** How far a realm can see another's fate: the days of news its fastest word covers (rules/signals.ts wordPace). */
  newsDays: 45,
  /** A lesson from another's fate weighs this much of one's own. */
  seen: 0.5,
  /** A realm keeps its last few lessons of rule, for its page. */
  kept: 4,
  /** Years a woe blamed on outsiders sours a realm's regard for its neighbours, and by how much at first (sim/diplomacy). */
  grudge: 30,
  grudgeBy: 0.2,
  /** Within this of its seat (km), another realm's fall is told as a lesson, not only weighed. */
  nearKm: 1200,
  /** Where a voice neither quiets nor stirs a seizing or a rising: a choice carried by the great in council. Fewer are the riskier. */
  voiceMid: 0.35,
  /** Where a chief, a priest-king or a general holds a realm's voice (firstHolds): a want of a voice is as it was about here. */
  voiceOne: 0.15,
  /** Where arms in the people's hands neither stir nor quiet a rising: where a realm with a host kept standing comes to hold them. */
  forceMid: 0.55,
} as const;

/** What each interest group wants of each number (a level, 0 … 1): the court and the army hold force; makers and traders want word and voice. */
export const HOLD_WANTS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  farmers: [0.3, 0.6, 0.6, 0.5],
  herders: [0.2, 0.5, 0.6, 0.4],
  crafters: [0.5, 0.75, 0.8, 0.6],
  traders: [0.6, 0.75, 0.9, 0.9],
  "the court": [0.85, 0.1, 0.25, 0.5],
  "the temple": [0.6, 0.3, 0.3, 0.4],
  "the army": [0.9, 0.2, 0.4, 0.3],
};

/** A people's ways, as the numbers here read them (sim/culture/culture.ts WAY_TRAITS, each 0 … 1). */
export type WaysRead = {
  readonly hierarchy: number;
  readonly openness: number;
  readonly tradition: number;
  readonly valour: number;
  readonly piety: number;
  readonly trade: number;
  readonly thrift: number;
};

/** A hive, as every rule reads one: those who live as one, small, on land or shore (rules/designs.ts hive). */
const hiveOf = (b: BodyPlan | null | undefined) =>
  (b?.social ?? 0) >= 0.9 && (b?.size ?? 100) < 100 && b?.medium !== "water";

/** What a body makes of each number (the bodies' grammar, rules/bodies.ts), as an offset: the same for every realm of that people. */
export function bodyLean(b: BodyPlan | null | undefined): [number, number, number, number] {
  if (!b) return [0, 0, 0, 0];
  const hive = hiveOf(b),
    // (A giant is its own weapon: its force cannot be taken from it. A hive is born to its castes, its soldiers among them.)
    big = b.size > 150 ? -Math.min(0.3, (b.size - 150) / 1000) : 0,
    // (Those who live as one decide as one; those who live apart are hard to gather to a choice.)
    together = (b.social - 0.6) * 0.5,
    // (Words that carry far, in water, through the dark, are hard to watch.)
    carries = b.medium === "water" || b.senses.includes("echo") ? 0.15 : 0,
    scent = b.senses.includes("smell") && !b.senses.includes("hearing") ? -0.1 : 0;
  return [big + (hive ? 0.25 : 0), together + (hive ? 0.2 : 0), carries + scent, 0];
}

/** A realm's first numbers, of the rule it was founded under, its people's ways and their body. */
export function firstHolds(
  rule: { readonly leadership: number; readonly law: number; readonly succession: number },
  w: WaysRead,
  body: BodyPlan | null | undefined,
): number[] {
  const lean = bodyLean(body),
    // (A chief or a priest-king, a general: one decides; elders: a few; an assembly: many.)
    byRule = [0.12, 0.35, 0.7, 0.15, 0.08][rule.leadership] ?? 0.2,
    decree = rule.law === 1 ? -0.08 : 0;
  return [
    0.35 + 0.5 * (w.hierarchy - 0.5) - 0.4 * (w.valour - 0.5) + lean[0],
    byRule + decree + 0.2 * (0.5 - w.hierarchy) + lean[1],
    0.5 + 0.5 * (w.openness - 0.5) - 0.35 * (w.hierarchy - 0.5) + lean[2],
    0.45 + 0.5 * (w.trade - 0.5) + 0.25 * (w.openness - 0.5) + lean[3],
  ].map(unit);
}

/** A number kept as a whole hundredth (a realm's numbers are saved so: 0 … 100). */
export const unit = (x: number): number => Math.round(Math.max(0, Math.min(1, x)) * 100) / 100;

// —— What a people believes lay behind what befell it ——————————————————————————————————————————————————

/** Who a people blames: itself (and so reforms), others (and so hardens), weakness (it was not them: pride), the gods (nothing to mend). */
export type Blame = "ours" | "theirs" | "weakness" | "the gods'";

/**
 * Who a people blames for an outcome, read off its ways: the open and the untraditional look to themselves; the proud and those
 * who keep to rank to others; the devout to the gods. One who only saw it befall another, and held them a rival, or prizes valour
 * and old ways, holds them weak: "that won't happen to us".
 */
export function blameOf(w: WaysRead, own: boolean, rival: boolean): Blame {
  const ours = w.openness + 0.5 * (1 - w.tradition) - (rival ? 0.3 : 0),
    theirs = 0.5 * w.valour + 0.5 * w.hierarchy + (own ? 0.2 : 0),
    weakness = own ? -1 : w.tradition + 0.5 * w.valour + (rival ? 0.3 : 0) - 0.2,
    gods = 1.4 * w.piety - 0.35;
  const best = Math.max(ours, theirs, weakness, gods);
  return best === ours
    ? "ours"
    : best === theirs
      ? "theirs"
      : best === weakness
        ? "weakness"
        : "the gods'";
}

/** Changes to a realm's numbers, by name (absent: unchanged). */
export type HoldChange = Partial<Record<Hold, number>>;

/**
 * One kind of outcome a realm can learn from: the event that tells it, who it befell (the event's subject at `at`), what it is in
 * words, and what follows for its numbers where they blame themselves (`mend`) and where they blame others (`harden`). Weakness
 * hardens by half (pride, not fear); the gods change nothing. `seen`: others who know of it weigh it too.
 */
export type RuleOutcome = {
  readonly id: string;
  readonly event: string;
  /** The event's subject it befell: an index, or read off the event's data. */
  readonly at: number | ((d: Record<string, unknown>) => number);
  /** What befell them: "the rising crushed at their seat". */
  readonly words: string;
  /** Of another: "the fall of {them}". */
  readonly of?: string;
  readonly mend: HoldChange;
  readonly harden: HoldChange;
  readonly seen?: boolean;
  /** A good outcome: its blame is credit (BLAME_WORDS good). */
  readonly good?: boolean;
  /** Only where the event's data says so. */
  readonly when?: (d: Record<string, unknown>) => boolean;
};

export const OUTCOMES: readonly RuleOutcome[] = [
  // Their people rose and overthrew their rulers: share the choice, let word move; or keep arms and word closer.
  {
    id: "overthrown",
    event: "strife.revolution",
    at: 0,
    words: "their rulers overthrown by their own people",
    of: "the overthrow of {them}",
    mend: { voice: 0.15, word: 0.1 },
    harden: { force: 0.15, word: -0.15 },
    seen: true,
  },
  // A rising drowned in blood: the many given a say; or a tighter grip.
  {
    id: "crushed",
    event: "strife.repressed",
    at: 0,
    words: "a rising drowned in blood at their seat",
    of: "the rising drowned in blood in {them}",
    mend: { voice: 0.2, word: 0.1 },
    harden: { force: 0.2, word: -0.2 },
    seen: true,
  },
  // The army took the seat: the host under the many, arms among the people; or the host kept close and word watched.
  {
    id: "seized",
    event: "strife.coup",
    at: 0,
    words: "their seat seized by their own army",
    of: "the seizing of {them} by its army",
    mend: { voice: 0.1, force: -0.15 },
    harden: { force: 0.1, word: -0.15 },
    seen: true,
  },
  // A realm gone: bind to others and put arms in more hands against the day; or arm the seat and trust none.
  {
    id: "fell",
    event: "polity.ended",
    at: 0,
    words: "their realm's fall",
    of: "the fall of {them}",
    mend: { trust: 0.1, force: -0.05 },
    harden: { force: 0.1, trust: -0.1 },
    seen: true,
  },
  // Those they called stood aside: bind more carefully; or trust no one.
  {
    id: "forsaken",
    event: "ties.answered",
    at: 1,
    words: "a friend who stood aside when they called",
    mend: { trust: -0.05 },
    harden: { trust: -0.2 },
    when: (d) => d.came === false && !["truce", "sworn", "both", "noway"].includes(String(d.why)),
  },
  // Those they called came: bind themselves the more.
  {
    id: "rescued",
    event: "ties.answered",
    at: 1,
    words: "a friend who came when they called",
    mend: { trust: 0.15 },
    harden: { trust: 0.05 },
    good: true,
    when: (d) => d.came === true,
  },
  // A war lost (its peace made against them): put arms in many hands and look for friends; or arm the seat and trust none.
  {
    id: "beaten",
    event: "war.peace",
    at: (d) => (d.won === true ? 2 : 1),
    words: "a war lost",
    mend: { force: -0.1, trust: 0.05 },
    harden: { force: 0.1, trust: -0.1 },
  },
  // What they lent, never repaid (the lender's realm, its third subject); what they owed, never paid: borrow and lend the less
  // either way, the more so blaming others.
  {
    id: "unpaid",
    event: "credit.defaulted",
    at: 2,
    words: "a debt owed them never repaid",
    mend: { trust: -0.1 },
    harden: { trust: -0.2 },
  },
  {
    id: "defaulted",
    event: "credit.defaulted",
    at: 0,
    words: "a debt they could not pay",
    mend: { trust: -0.15 },
    harden: { trust: -0.1, force: 0.05 },
    when: (d) => d.fallen !== true,
  },
];

/** The outcomes read off each kind of event. */
export const OUTCOMES_OF: ReadonlyMap<string, readonly RuleOutcome[]> = (() => {
  const m = new Map<string, RuleOutcome[]>();
  for (const o of OUTCOMES) m.set(o.event, [...(m.get(o.event) ?? []), o]);
  return m;
})();
export const OUTCOME: ReadonlyMap<string, RuleOutcome> = new Map(OUTCOMES.map((o) => [o.id, o]));

/** What a blame does with an outcome: its change, scaled (`by`: 1 for one's own; HOLDING.seen for another's). */
export function changeOf(o: RuleOutcome, blame: Blame, by: number): HoldChange {
  const base =
      blame === "ours"
        ? o.mend
        : blame === "theirs"
          ? o.harden
          : blame === "weakness"
            ? o.harden
            : {},
    k = (blame === "weakness" ? 0.5 : 1) * by,
    out: HoldChange = {};
  for (const h of HOLD_KINDS) if (base[h]) out[h] = base[h]! * k;
  return out;
}

/** A change in words: "gave its people more say and let word move the more freely". */
export function changeWords(c: HoldChange): string {
  const parts: string[] = [];
  const say = (h: Hold, up: string, down: string) => {
    const v = c[h];
    if (v && Math.abs(v) >= 0.02) parts.push(v > 0 ? up : down);
  };
  say("voice", "gave its people more say", "kept its choices in fewer hands");
  say("word", "let word move the more freely", "watched its people's words the closer");
  say("force", "kept arms closer to its host", "put arms in its people's hands");
  say("trust", "sought others to bind itself to", "grew wary of binding itself to others");
  return parts.length <= 1
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** Who a people blamed, in words: for what befell itself, for what it saw befall another, and whom it credited for a good outcome. */
export const BLAME_WORDS: Readonly<
  Record<Blame, readonly [own: string, seen: string, good: string]>
> = {
  ours: ["held it its own fault", "took it as a warning to itself", "held it its own doing"],
  theirs: ["blamed others for it", "blamed those who brought them down", "credited its friends"],
  weakness: [
    "held it weakness",
    "held them weak: it would not happen to it",
    "held it its strength",
  ],
  "the gods'": ["held it the gods' will", "held it the gods' will", "thanked the gods"],
};
/** A blame in words, for an outcome of its own or another's. */
export const blameWords = (o: RuleOutcome | undefined, blame: Blame, seen: boolean): string =>
  BLAME_WORDS[blame][o?.good ? 2 : seen ? 1 : 0];

/** Whose wants weigh as a realm weighs its numbers: the few who hold the seat, the more as its choices are kept to one. */
export const FEW_RULE: ReadonlySet<string> = new Set(["the court", "the army", "the temple"]);
export const weighsFor = (group: string, voice: number): number => {
  const x = FEW_RULE.has(group) ? 1.2 - voice : 0.2 + voice;
  return x * x;
};

// —— The names a player reads ———————————————————————————————————————————————————————————————————————————

/** What the names are read off: the people's body, what force is on their world (their best arm, in words), how far word goes. */
export type HeldBy = {
  readonly body: BodyPlan | null | undefined;
  /** Their realm's best arm in words ("muskets", "flint-tipped spears"), or null where none is drawn. */
  readonly arm: string | null;
  /** Their fastest way of word, in words, where it outruns any messenger ("a word down the telegraph's wire", "a voice through the
   * deep"); else null. */
  readonly far: string | null;
};

/** The force a body has of itself, where no arm is drawn. */
function bodyArms(b: BodyPlan | null | undefined): string {
  if (!b) return "arms";
  if (b.manipulators === "mandibles") return "their stings and mandibles";
  if (b.manipulators === "claws") return "claws and the arms they make";
  if (b.size > 300) return "their own great bulk";
  return "arms";
}
/** How a people talks, read off its senses and medium: words, songs, scents, pulses, clicks, signs. */
export function talkOf(b: BodyPlan | null | undefined): string {
  if (!b) return "words";
  if (b.medium === "water" && (b.senses.includes("hearing") || b.senses.includes("echo")))
    return "songs";
  if (b.senses.includes("hearing")) return "words";
  if (b.senses.includes("smell")) return "scents";
  if (b.senses.includes("electric")) return "pulses";
  if (b.senses.includes("echo")) return "clicks";
  return "signs";
}

/** Each number's name, read off it and the people. */
export function holdWords(h: Hold, v: number, by: HeldBy): string {
  const b = by.body,
    hive = hiveOf(b),
    arm = by.arm ?? bodyArms(b),
    eldest = (b?.span ?? 80) >= 150,
    brood = (b?.young ?? 1) >= 4 && b?.bearing !== "live",
    talk = talkOf(b),
    far = by.far ? `, even ${by.far}` : "";
  if (h === "force")
    return v < 0.3
      ? hive
        ? `every worker bears ${arm}`
        : `every household bears ${arm}`
      : v < 0.65
        ? `${arm} borne by the realm's leave`
        : hive
          ? `only the soldier caste bears ${arm}`
          : `only the realm's host bears ${arm}`;
  if (h === "voice")
    return v < 0.2
      ? hive && brood
        ? "the brood-mother's will alone"
        : eldest
          ? "the eldest's word alone"
          : "the ruler's word alone"
      : v < 0.45
        ? hive
          ? "the eldest brood decides"
          : eldest
            ? "a council of the eldest"
            : "the great in council"
        : v < 0.7
          ? hive
            ? "the brood-chambers decide together"
            : brood
              ? "the heads of each brood choose"
              : "the heads of households choose"
          : hive
            ? "the whole hive decides as one"
            : brood
              ? "every grown one of every brood chooses"
              : "every citizen chooses";
  if (h === "word")
    return v < 0.3
      ? hive && talk === "scents"
        ? `every scent read by the watchers${far}`
        : `${talk} watched and censored${far}`
      : v < 0.65
        ? `${talk} tolerated, if watched${far}`
        : hive && talk === "scents"
          ? `scents pass freely through the hive${far}`
          : `${talk} pass freely${far}`;
  return v < 0.3
    ? "wary of every pact and loan"
    : v < 0.65
      ? "binds itself to others with care"
      : "binds itself freely to others";
}

/** The four together, in a line: "Held by one, its people disarmed and watched". */
export function heldWords(v: readonly number[]): string {
  const [force, voice, word] = v as [number, number, number],
    who =
      voice < 0.2
        ? "Held by one"
        : voice < 0.45
          ? "Held by a few"
          : voice < 0.7
            ? "Held by many"
            : "Held by all",
    arms = force >= 0.65 ? "disarmed" : force < 0.3 ? "armed" : "",
    said = word < 0.3 ? "watched" : word >= 0.65 ? "free-spoken" : "",
    people = [arms, said].filter(Boolean);
  return people.length ? `${who}, its people ${people.join(" and ")}` : who;
}

/** What the numbers come to, as Earth's history names such realms (for a reader's count, never kept). */
export function formOf(v: readonly number[]): {
  readonly oneRules: boolean;
  readonly allChoose: boolean;
  readonly armed: boolean;
  readonly disarmed: boolean;
  readonly watched: boolean;
  readonly free: boolean;
} {
  const [force, voice, word] = v as [number, number, number];
  return {
    oneRules: voice < 0.2 && word < 0.35,
    allChoose: voice >= 0.7,
    armed: force < 0.3,
    disarmed: force >= 0.65,
    watched: word < 0.3,
    free: word >= 0.65,
  };
}
