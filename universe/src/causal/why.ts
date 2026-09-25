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
// Domains teach it their kinds with registerExplainer.
import {
  COMMAND,
  DECISION,
  EVENT,
  kindByCode,
  kindCodeOf,
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

/** Edges for a list of causes, each expanding lazily. */
export function edges(world: World, causes: readonly CauseRef[]): ExplanationEdge[] {
  return causes.map((cause) => ({ cause, next: () => why(world, cause.ref) }));
}

function describeEvent(type: string, place: Ref | null, t: number): string {
  return `${type}${place ? ` at ${place}` : ""} (t=${t})`;
}

function explainEvent(world: World, ref: Ref): Explanation {
  const e = world.events.get(ref);
  if (e) {
    return {
      ref,
      claim: describeEvent(e.type, e.place, e.t),
      basis: "recorded",
      t: e.t,
      causes: edges(world, e.causes),
    };
  }
  const tomb = world.events.tombstone(ref);
  if (tomb)
    return {
      ref,
      claim: `${describeEvent(tomb.type, tomb.place, tomb.t)}, since forgotten`,
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
        claim: `${tomb.rule} for ${tomb.subject} (t=${tomb.t}), since forgotten`,
        basis: "forgotten",
        t: tomb.t,
        causes: [],
      };
    return { ref, claim: `${ref} is not in the history`, basis: "unknown", t: null, causes: [] };
  }
  const factors = d.factors
    .map((f) => `${f.name} ${f.contribution >= 0 ? "+" : ""}${f.contribution.toFixed(2)}`)
    .join(", ");
  return {
    ref,
    claim: `${d.rule} for ${d.subject}: score ${d.score.toFixed(2)} against ${d.threshold.toFixed(2)} (${factors})`,
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
  return { ref, claim: `the god's act ${c.type} (t=${c.t})`, basis: "command", t: c.t, causes: [] };
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
