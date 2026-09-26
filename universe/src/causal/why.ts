// The explainer (docs/architecture §13): why(ref) answers "why is this so?" as a
// tree the observatory expands one level at a time. Each node says what it is and
// on what basis it is known:
//
//  - recorded: an event or decision whose causes were written when it happened;
//  - command: an act of the god — the root of whatever it caused;
//  - generated: a fact produced by a generator from the seed;
//  - reconstructed: rebuilt from the macro history (later milestones);
//  - forgotten: an event that aged out of the log; its tombstone says what and where;
//  - unknown: nothing records why.
//
// Domains teach it their kinds with registerExplainer, and say their events and
// decisions in words with registerEventWords and registerDecisionWords.
import {
  COMMAND,
  DECISION,
  EVENT,
  kindByCode,
  kindCodeOf,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type World,
} from "../kernel/index.ts";

export type Basis =
  "recorded" | "command" | "generated" | "reconstructed" | "forgotten" | "unknown";

export type Explanation = {
  readonly ref: Ref;
  readonly claim: string;
  readonly basis: Basis;
  readonly t: number | null;
  readonly causes: readonly ExplanationEdge[];
};

export type ExplanationEdge = { readonly cause: CauseRef; readonly next: () => Explanation };

export type Explainer = (world: World, ref: Ref) => Explanation | null;

const EXPLAINERS = new Map<string, Explainer>();

/** Teach why() a kind of reference (by kind code). */
export function registerExplainer(kindCode: string, explainer: Explainer): void {
  if (EXPLAINERS.has(kindCode)) throw new Error(`kind ${kindCode} already has an explainer`);
  EXPLAINERS.set(kindCode, explainer);
}

/** What an event says of itself; `data` is null once it has been forgotten. */
export type EventFacts = {
  readonly type: string;
  readonly t: number;
  readonly place: Ref | null;
  readonly subjects: readonly Ref[];
  readonly data: unknown;
};
export type EventWords = (world: World, e: EventFacts) => string;
export type DecisionFacts = {
  readonly rule: string;
  readonly t: number;
  readonly subject: Ref;
  readonly outcome: unknown;
};
export type DecisionWords = (world: World, d: DecisionFacts) => string;

const EVENT_WORDS = new Map<string, EventWords>();
const EVENT_KEEPERS: ((world: World, ref: Ref) => EventFacts | null)[] = [];
const DECISION_WORDS = new Map<string, DecisionWords>();
export type CommandWords = (world: World, c: { type: string; t: number; args: unknown }) => string;
const COMMAND_WORDS = new Map<string, CommandWords>();

/** Say a god's act in words. */
export function registerCommandWords(type: string, words: CommandWords): void {
  if (COMMAND_WORDS.has(type)) throw new Error(`command ${type} already has words`);
  COMMAND_WORDS.set(type, words);
}

/** Say an event type in words. */
export function registerEventWords(type: string, words: EventWords): void {
  if (EVENT_WORDS.has(type)) throw new Error(`event ${type} already has words`);
  EVENT_WORDS.set(type, words);
}

/** Something outside history that keeps copies of events history may forget. */
export function registerEventKeeper(keeper: (world: World, ref: Ref) => EventFacts | null): void {
  EVENT_KEEPERS.push(keeper);
}

/** Say a decision rule in words (the factors follow). */
export function registerDecisionWords(rule: string, words: DecisionWords): void {
  if (DECISION_WORDS.has(rule)) throw new Error(`decision ${rule} already has words`);
  DECISION_WORDS.set(rule, words);
}

/** Edges for a list of causes, each expanding lazily. */
export function edges(world: World, causes: readonly CauseRef[]): ExplanationEdge[] {
  return causes.map((cause) => ({ cause, next: () => why(world, cause.ref) }));
}

function describeEvent(world: World, e: EventFacts): string {
  const words = EVENT_WORDS.get(e.type);
  return words ? words(world, e) : `${e.type}${e.place ? ` at ${e.place}` : ""} (t=${e.t})`;
}

function describeDecision(world: World, d: DecisionFacts): string | null {
  return DECISION_WORDS.get(d.rule)?.(world, d) ?? null;
}

function explainEvent(world: World, ref: Ref): Explanation {
  const e = world.events.get(ref);
  if (e) {
    return {
      ref,
      claim: describeEvent(world, e),
      basis: "recorded",
      t: e.t,
      causes: edges(world, e.causes),
    };
  }
  const tomb = world.events.tombstone(ref);
  const kept = tomb ? EVENT_KEEPERS.map((k) => k(world, ref)).find((f) => f) : null;
  if (tomb && kept)
    return {
      ref,
      claim: `${describeEvent(world, kept)}; history has forgotten it, but those who lived it remember`,
      basis: "forgotten",
      t: tomb.t,
      causes: [],
    };
  if (tomb)
    return {
      ref,
      claim: `${describeEvent(world, { ...tomb, data: null })}, since forgotten`,
      basis: "forgotten",
      t: tomb.t,
      causes: [],
    };
  return { ref, claim: `${ref} is not in the history`, basis: "unknown", t: null, causes: [] };
}

function explainDecision(world: World, ref: Ref): Explanation {
  const d = world.decisions.get(ref);
  if (!d) {
    const tomb = world.decisions.tombstone(ref);
    if (tomb)
      return {
        ref,
        claim: `${describeDecision(world, { ...tomb, outcome: null }) ?? `${tomb.rule} for ${tomb.subject} (t=${tomb.t})`}, since forgotten`,
        basis: "forgotten",
        t: tomb.t,
        causes: [],
      };
    return { ref, claim: `${ref} is not in the history`, basis: "unknown", t: null, causes: [] };
  }
  const factors = d.factors
    .map((f) => `${f.name} ${f.contribution >= 0 ? "+" : ""}${f.contribution.toFixed(2)}`)
    .join(", ");
  const words = describeDecision(world, d),
    weighed = `score ${d.score.toFixed(2)} against ${d.threshold.toFixed(2)}`;
  return {
    ref,
    claim: words
      ? `${words}, in year ${yearOfMoment(d.t)} (${factors}; ${weighed})`
      : `${d.rule} for ${d.subject}: ${weighed} (${factors})`,
    basis: "recorded",
    t: d.t,
    causes: edges(world, world.decisions.causesOf(ref)),
  };
}

function explainCommand(world: World, ref: Ref): Explanation {
  const c = world.commands.get(ref);
  if (!c)
    return {
      ref,
      claim: `${ref} is not in the command log`,
      basis: "unknown",
      t: null,
      causes: [],
    };
  const words = COMMAND_WORDS.get(c.type)?.(world, c);
  return {
    ref,
    claim: words ?? `the god's act ${c.type} (t=${c.t})`,
    basis: "command",
    t: c.t,
    causes: [],
  };
}

/** Why is this so? Always answers; the basis says how much is known. */
export function why(world: World, ref: Ref): Explanation {
  const code = kindCodeOf(ref);
  if (code === EVENT.code) return explainEvent(world, ref);
  if (code === DECISION.code) return explainDecision(world, ref);
  if (code === COMMAND.code) return explainCommand(world, ref);
  const custom = EXPLAINERS.get(code)?.(world, ref);
  if (custom) return custom;
  const kind = kindByCode(code);
  return {
    ref,
    claim: kind ? `a ${kind.name} (${ref})` : ref,
    basis: "unknown",
    t: null,
    causes: [],
  };
}

/** Walk the strongest cause at each step: the spine of an explanation, for tests and summaries. */
export function spine(world: World, ref: Ref, maxDepth = 64): Explanation[] {
  const out: Explanation[] = [];
  let node: Explanation | null = why(world, ref);
  const seen = new Set<string>();
  while (node && out.length < maxDepth && !seen.has(node.ref)) {
    seen.add(node.ref);
    out.push(node);
    const strongest: ExplanationEdge | undefined = [...node.causes].sort(
      (a, b) => b.cause.weight - a.cause.weight,
    )[0];
    node = strongest ? strongest.next() : null;
  }
  return out;
}
