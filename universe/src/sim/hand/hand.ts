// The hand (docs/architecture §9): a divine act that makes one village
// authoritative at the level of its people. Laying it collapses the village's
// residents out of the province's counts into individuals, with the simulation's
// own draws; while it rests, their births, deaths and coming of age are decided
// one by one and written back into the counts and the ledgers, so the counts stay
// the one aggregate truth every other system reads; lifting it lets them go back
// to being counted. With no time between, laying and lifting leaves every
// aggregate exactly as it was. One hand at a time.
import {
  YEAR,
  defineEventType,
  defineStream,
  drawWithoutReplacement,
  type Hasher,
  type Ref,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  BANDS,
  FEMALE,
  MALE,
  OCC,
  SEXES,
  bandOf,
  bandWidth,
  type LifeHistory,
} from "../../rules/index.ts";
import { lifeOf } from "../population/life.ts";
import { COLS, ROWS, row } from "../population/model.ts";
import type { PopulationStore, SettlementStore } from "../population/stores.ts";

export const HAND_EVENTS = {
  laid: defineEventType("hand.laid", 5),
  lifted: defineEventType("hand.lifted", 5),
};

const COLLAPSE = defineStream("hand.collapse");
export const HAND_VITAL = defineStream("hand.vital");

/** One of the village's people, while the hand rests on it. */
export type Agent = {
  readonly id: number;
  readonly sex: number;
  readonly birthYear: number;
  occupation: number;
  /** Spared death until this year, by the god's blessing. */
  blessedUntil?: number;
  /** Their mother and father, of the hand's people (Phase 14 M118): as the village knew them when the hand was laid, or born under it. */
  mother?: number;
  father?: number;
  /** Who they live with as husband or wife. */
  partner?: number;
  /** What they are like: each of PERSON_TRAITS they have. */
  traits?: PersonTrait[];
};

/**
 * What a person may be like (Phase 14 M118), as WorldBox's units are: some weigh on their
 * lives — the hardy and the lucky die the less, the frail the more, the fertile bear the more
 * children — the rest are who they are, told on their page. A child takes each of its parents'
 * traits by half, and now and then one of its own.
 */
export const PERSON_TRAITS = [
  "hardy",
  "frail",
  "fertile",
  "lucky",
  "clever",
  "brave",
  "kind",
  "pious",
  "greedy",
  "wise",
] as const;
export type PersonTrait = (typeof PERSON_TRAITS)[number];

/**
 * How a trait weighs on the chance of death, of a child coming to a couple (either of them
 * fertile), and — a kind mother's or father's — on the death of the young in their care.
 */
export const TRAIT_WEIGHT: Readonly<
  Partial<Record<PersonTrait, { death?: number; birth?: number; care?: number }>>
> = {
  hardy: { death: 0.75 },
  frail: { death: 1.35 },
  lucky: { death: 0.9 },
  fertile: { birth: 1.4 },
  kind: { care: 0.85 },
};

/** The work a trait draws one to as they come of age, and how strongly (the clever to a craft). */
export const TRAIT_WORK: Readonly<
  Partial<Record<PersonTrait, readonly (readonly [number, number])[]>>
> = {
  clever: [[OCC.crafter, 3]],
  greedy: [[OCC.trader, 3]],
  wise: [[OCC.leader, 3]],
  brave: [
    [OCC.forager, 2],
    [OCC.herder, 2],
  ],
};

/** How much longer the god's blessing holds on the pious. */
export const PIOUS_BLESSING = 1.5;

/** How often one has a trait (when the hand is laid), takes a parent's, or has one of their own. */
export const TRAIT_SHARE = 0.12,
  TRAIT_INHERITED = 0.5,
  TRAIT_ANEW = 0.04;

/** The traits that cannot be had together. */
const OPPOSED: readonly (readonly [PersonTrait, PersonTrait])[] = [["hardy", "frail"]];

/** The trait that cannot be had with this one, if any. */
export function opposedTo(t: PersonTrait): PersonTrait | null {
  for (const [a, b] of OPPOSED) {
    if (t === a) return b;
    if (t === b) return a;
  }
  return null;
}

/** Traits by keyed draws: each had at `share` (or inherited from `parents` at TRAIT_INHERITED, else anew). */
export function drawTraits(
  u: (k: number) => number,
  parents: readonly (readonly PersonTrait[])[] | null,
): PersonTrait[] {
  const out: PersonTrait[] = [];
  PERSON_TRAITS.forEach((t, k) => {
    const had = parents?.some((p) => p.includes(t)) ?? false,
      chance = parents ? (had ? TRAIT_INHERITED : TRAIT_ANEW) : TRAIT_SHARE;
    if (
      u(k) < chance &&
      !OPPOSED.some(([a, b]) => (t === a && out.includes(b)) || (t === b && out.includes(a)))
    )
      out.push(t);
  });
  return out;
}

/** How a person's traits weigh on their chance of death, of a child, or on their young's deaths. */
export function traitWeight(a: Agent, what: "death" | "birth" | "care"): number {
  let k = 1;
  for (const t of a.traits ?? []) k *= TRAIT_WEIGHT[t]?.[what] ?? 1;
  return k;
}

/** The work one coming of age takes up, weighed: their society's needs, pulled by what they are like. */
export function workWeights(targets: readonly number[], a: Agent): readonly number[] {
  const pulls = (a.traits ?? []).flatMap((t) => TRAIT_WORK[t] ?? []);
  if (!pulls.length) return targets;
  const out = [...targets];
  for (const [o, k] of pulls) out[o] = out[o]! * k;
  return out;
}

/**
 * Pair the grown who live alone, the eldest first, each with the nearest in age of the other
 * sex (within a dozen years) who lives alone too. As the village would: a keyed order, no draw.
 */
export function pairUp(agents: readonly Agent[], year: number, adulthood: number): void {
  const living = new Set(agents.map((a) => a.id)),
    alone = (a: Agent) => a.partner === undefined || !living.has(a.partner),
    grown = agents.filter((a) => year - a.birthYear >= adulthood),
    women = grown
      .filter((a) => a.sex === FEMALE && alone(a))
      .sort((a, b) => a.birthYear - b.birthYear || a.id - b.id),
    men = grown.filter((a) => a.sex === MALE && alone(a));
  for (const w of women) {
    let best: Agent | null = null;
    for (const m of men) {
      if (!alone(m)) continue;
      const gap = Math.abs(m.birthYear - w.birthYear);
      if (gap > 12) continue;
      if (
        !best ||
        gap < Math.abs(best.birthYear - w.birthYear) ||
        (gap === Math.abs(best.birthYear - w.birthYear) && m.id < best.id)
      )
        best = m;
    }
    if (best) {
      w.partner = best.id;
      best.partner = w.id;
    }
  }
}

export type Window = {
  readonly command: Ref;
  readonly event: Ref;
  readonly village: Ref;
  readonly cell: number;
  readonly laid: number;
  agents: Agent[];
  /** The next agent's id: newborns take it. */
  next: number;
  /** Those the god touched, and the deed each is remembered for. */
  notables?: { readonly agent: number; readonly deed: Ref }[];
  /** Those who died while it rests (Phase 14 M118): who they were, for their families' trees. */
  gone?: Gone[];
};

/** One of the hand's people who died while it rests: who they were, and when they died. */
export type Gone = {
  readonly id: number;
  readonly sex: number;
  readonly birthYear: number;
  readonly died: number;
  readonly mother?: number;
  readonly father?: number;
  readonly partner?: number;
  readonly traits?: readonly PersonTrait[];
};

/** The most of the dead the hand remembers (the eldest let go first). */
export const GONE_KEPT = 4000;

/** Which age band an age falls in. */
export function bandOfAge(age: number, life: LifeHistory): number {
  return bandOf(age, life);
}

export class HandStore implements StateStore {
  readonly name = "hand.window";
  resting: Window | null = null;

  /** The window over a province, if the hand rests there. */
  over(cell: number): Window | null {
    return this.resting && this.resting.cell === cell ? this.resting : null;
  }

  /** The window's people as counts (row × occupation) in a given year, by their life table. */
  composition(cell: number, year: number, life: LifeHistory): number[] | null {
    const w = this.over(cell);
    if (!w) return null;
    const out = new Array<number>(ROWS * COLS).fill(0);
    for (const a of w.agents) {
      const i = row(a.sex, bandOfAge(year - a.birthYear, life)) * COLS + a.occupation;
      out[i] = out[i]! + 1;
    }
    return out;
  }

  pinned(): Ref[] {
    // The window, and the deeds of those the god touched while it rests.
    return this.resting
      ? [this.resting.event, ...(this.resting.notables ?? []).map((n) => n.deed)]
      : [];
  }

  hashInto(h: Hasher): void {
    h.value(this.resting);
  }

  save(): unknown {
    return { resting: this.resting };
  }

  load(state: unknown): void {
    const w = (state as { resting: Window | null }).resting;
    this.resting = w
      ? {
          ...w,
          agents: w.agents.map((a) => ({ ...a, ...(a.traits ? { traits: [...a.traits] } : {}) })),
        }
      : null;
  }
}

export function handOf(world: World): HandStore {
  return world.store<HandStore>("hand.window");
}

/** Teach a peopled world the hand: "hand.lay" on a village, "hand.lift" to let it go. */
export function installHand(world: World): HandStore {
  const store = world.register(new HandStore());
  world.addPinner(() => store.pinned());
  const provinces = () => world.store<PopulationStore>("population.provinces"),
    settlements = () => world.store<SettlementStore>("population.settlements");
  world.defineCommand({
    type: "hand.lay",
    validate: (args) => {
      const ref = (args as { village?: unknown } | null)?.village;
      if (typeof ref !== "string") return "village must be a village's ref";
      const v = settlements().get(ref as Ref);
      if (!v) return `no village ${ref}`;
      if (!v.population) return "no one lives there";
      if (store.resting) return "your hand already rests on a village: lift it first";
      return null;
    },
    apply: (command, t) => {
      const v = settlements().get((command.args as { village: Ref }).village)!,
        p = provinces().get(v.cell)!,
        year = Math.floor(t / YEAR),
        life = lifeOf(world);
      const event = world.events.emit({
        type: HAND_EVENTS.laid.type,
        subjects: [v.ref],
        place: p.ref,
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: { name: v.name, people: v.population },
      });
      // The village's people, drawn from the province's counts with the world's own draws.
      const counts: number[] = [];
      for (let r = 0; r < ROWS; r++) for (let o = 0; o < COLS; o++) counts.push(p.counts.get(r, o));
      const n = Math.min(v.population, p.total()),
        taken = drawWithoutReplacement(n, counts, (i) => world.rng.real(COLLAPSE, v.cell, t, 0, i)),
        agents: Agent[] = [];
      taken.forEach((k, i) => {
        const r = Math.floor(i / COLS),
          o = i % COLS,
          sex = Math.floor(r / BANDS),
          band = r % BANDS;
        for (let j = 0; j < k; j++) {
          const id = agents.length,
            age =
              life.bands[band]! +
              Math.floor(world.rng.real(COLLAPSE, v.cell, t, 1, id) * bandWidth(band, life));
          agents.push({ id, sex, birthYear: year - age, occupation: o });
        }
      });
      // What each is like, and the families the village knew: couples paired as it would pair
      // them, each child with a mother who bore it young enough, and her husband (M118).
      for (const a of agents)
        a.traits = drawTraits((k) => world.rng.real(COLLAPSE, v.cell, t, 4 + k, a.id), null);
      pairUp(agents, year, life.adulthood);
      const mothers = agents.filter(
        (a) => a.sex === FEMALE && year - a.birthYear >= life.adulthood,
      );
      for (const c of agents) {
        if (year - c.birthYear >= life.adulthood) continue;
        const able = mothers.filter(
          (m) => c.birthYear - m.birthYear >= 16 && c.birthYear - m.birthYear <= 44,
        );
        if (!able.length) continue;
        const m = able[Math.floor(world.rng.real(COLLAPSE, v.cell, t, 3, c.id) * able.length)]!;
        c.mother = m.id;
        if (m.partner !== undefined) c.father = m.partner;
      }
      store.resting = {
        command: command.id,
        event,
        village: v.ref,
        cell: v.cell,
        laid: t,
        agents,
        next: agents.length,
      };
    },
  });
  world.defineCommand({
    type: "hand.lift",
    validate: () => (store.resting ? null : "your hand rests on no village"),
    apply: (command) => {
      const w = store.resting!;
      world.events.emit({
        type: HAND_EVENTS.lifted.type,
        subjects: [w.village],
        place: provinces().get(w.cell)!.ref,
        causes: [
          { ref: command.id, role: "agent", weight: 0.7 },
          { ref: w.event, role: "enabler", weight: 0.3 },
        ],
        data: { people: w.agents.length },
      });
      // They go back to being counted: they never left the counts.
      store.resting = null;
    },
  });
  return store;
}

/** A newborn's sex, by the keyed draw that decides it. */
export function newbornSex(u: number): number {
  return u < 0.488 ? 0 : SEXES - 1;
}
