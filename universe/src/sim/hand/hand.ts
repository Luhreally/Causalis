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
  copyLocal,
  type Blow,
  type BodyPlace,
  type LifeHistory,
  type LocalScene,
  type LocalWorld,
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
  /**
   * The name they were known by when the hand was laid from them (Phase 54: one of a town's people
   * tapped and blessed or inspired, the hand laid on their town to touch them): theirs while it rests.
   */
  name?: string;
  /** Their spirits as the god's hand in one of their people moved them (Phase 60): by so much, at that moment (fading: rules/possess.ts moodAt). */
  mood?: { readonly by: number; readonly at: number };
  /** Blows that struck them down by the god's hand in a body, and they lived (Phase 60): their wounds are told from these (host/wounds.ts handWound). */
  struck?: HandHit[];
};

/** A blow that struck one of the hand's people down in a possessed body's small world, and they lived: when, how, where it landed. */
export type HandHit = {
  /** The hand's event that tells it. */
  readonly event: Ref;
  readonly at: number;
  readonly blow: Blow;
  readonly place: BodyPlace;
  readonly maimed: boolean;
  /** What struck it, in hand ("sickle"; null: bare hands). */
  readonly arm: string | null;
  /** Who struck it: the god in a body, by that body's name, or one of the town struck by him. */
  readonly by: string;
};

/**
 * One of the hand's people possessed (Phase 60): who, the take and its event, the second taken, his
 * name; the town about him as the view drew it, the small world as it stands, and the bids that
 * moved it, a second at a time with the second each was stepped at (sim/hand/possess.ts).
 */
export type Possession = {
  readonly agent: number;
  readonly name: string;
  readonly command: Ref;
  readonly event: Ref;
  readonly from: number;
  readonly scene: LocalScene;
  local: LocalWorld;
  inputs: { readonly at: number; readonly steps: string }[];
};

/** One of a town's people the hand is laid from: who the god meant to touch. */
export type LaidFrom = {
  readonly name: string;
  readonly age: number;
  readonly occupation: number;
  readonly sex?: number;
};

/**
 * Which of the hand's people is the one it was laid from: of their sex and work the nearest in age,
 * else of their sex, else anyone the nearest in age (ties: the first drawn).
 */
export function laidFromAgent(
  agents: readonly Agent[],
  from: LaidFrom,
  year: number,
): Agent | null {
  const near = (pool: readonly Agent[]) =>
    pool.reduce<Agent | null>(
      (best, a) =>
        best === null ||
        Math.abs(year - a.birthYear - from.age) < Math.abs(year - best.birthYear - from.age)
          ? a
          : best,
      null,
    );
  const sexed = from.sex === undefined ? agents : agents.filter((a) => a.sex === from.sex);
  return near(sexed.filter((a) => a.occupation === from.occupation)) ?? near(sexed) ?? near(agents);
}

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
 * sex (within a dozen years) who lives alone too (of the nearest, the least id). As the village
 * would: a keyed order, no draw.
 */
export function pairUp(agents: readonly Agent[], year: number, adulthood: number): void {
  const living = new Set(agents.map((a) => a.id)),
    alone = (a: Agent) => a.partner === undefined || !living.has(a.partner),
    grown = agents.filter((a) => year - a.birthYear >= adulthood),
    women = grown
      .filter((a) => a.sex === FEMALE && alone(a))
      .sort((a, b) => a.birthYear - b.birthYear || a.id - b.id),
    men = grown.filter((a) => a.sex === MALE && alone(a));
  // The men by birth year, each year's by id, and the first of each year still alone (one paired
  // is passed over for good): a woman's man is found among the years either side of hers, the
  // nearest first — as each man was weighed against each, in a city's tens of thousands
  // (Phase 60: a great town's hand took minutes to lay, and as long each month it rested).
  const years = [...new Set(men.map((m) => m.birthYear))].sort((a, b) => a - b),
    index = new Map(years.map((y, k) => [y, k])),
    born: Agent[][] = years.map(() => []),
    first: number[] = years.map(() => 0);
  for (const m of men) born[index.get(m.birthYear)!]!.push(m);
  for (const list of born) list.sort((a, b) => a.id - b.id);
  const free = (k: number): Agent | null => {
    const list = born[k]!;
    while (first[k]! < list.length && !alone(list[first[k]!]!)) first[k]!++;
    return list[first[k]!] ?? null;
  };
  for (const w of women) {
    // (The first year at or after hers, and the last before.)
    let hi = 0,
      top = years.length;
    while (hi < top) {
      const mid = (hi + top) >> 1;
      if (years[mid]! < w.birthYear) hi = mid + 1;
      else top = mid;
    }
    let lo = hi - 1;
    while (lo >= 0 && !free(lo)) lo--;
    while (hi < years.length && !free(hi)) hi++;
    const below = lo >= 0 ? w.birthYear - years[lo]! : Infinity,
      above = hi < years.length ? years[hi]! - w.birthYear : Infinity,
      gap = Math.min(below, above);
    if (gap > 12) continue;
    const a = below === gap ? free(lo) : null,
      b = above === gap ? free(hi) : null,
      best = (a && b ? (a.id < b.id ? a : b) : (a ?? b))!;
    w.partner = best.id;
    best.partner = w.id;
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
  /** One of them possessed, while the god's hand is in their body (Phase 60). */
  possessed?: Possession;
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
  /** The name they were known by, where the hand was laid from them (Phase 54). */
  readonly name?: string;
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
          agents: w.agents.map((a) => ({
            ...a,
            ...(a.traits ? { traits: [...a.traits] } : {}),
            ...(a.struck ? { struck: [...a.struck] } : {}),
          })),
          // (The small world steps in place: its own copy.)
          ...(w.possessed
            ? {
                possessed: {
                  ...w.possessed,
                  local: copyLocal(w.possessed.local),
                  inputs: [...w.possessed.inputs],
                },
              }
            : {}),
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
      const from = (args as { as?: unknown }).as;
      if (from !== undefined) {
        const f = from as Partial<LaidFrom> | null;
        if (
          !f ||
          typeof f.name !== "string" ||
          !f.name.trim() ||
          f.name.length > 80 ||
          !Number.isInteger(f.age) ||
          f.age! < 0 ||
          f.age! > 300 ||
          !Number.isInteger(f.occupation) ||
          f.occupation! < 0 ||
          f.occupation! >= COLS ||
          (f.sex !== undefined && f.sex !== 0 && f.sex !== SEXES - 1)
        )
          return "as must be one of its people: a name, an age, a work and a sex";
      }
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
        ),
        // (Those who could have borne a child of a year, found once for every child of it.)
        ables = new Map<number, Agent[]>();
      for (const c of agents) {
        if (year - c.birthYear >= life.adulthood) continue;
        let able = ables.get(c.birthYear);
        if (!able)
          ables.set(
            c.birthYear,
            (able = mothers.filter(
              (m) => c.birthYear - m.birthYear >= 16 && c.birthYear - m.birthYear <= 44,
            )),
          );
        if (!able.length) continue;
        const m = able[Math.floor(world.rng.real(COLLAPSE, v.cell, t, 3, c.id) * able.length)]!;
        c.mother = m.id;
        if (m.partner !== undefined) c.father = m.partner;
      }
      // Laid from one of its people (Phase 54): they are among them, as they were known.
      const from = (command.args as { as?: LaidFrom }).as;
      if (from) {
        const a = laidFromAgent(agents, from, year);
        if (a) a.name = from.name.trim();
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
    validate: () =>
      !store.resting
        ? "your hand rests on no village"
        : store.resting.possessed
          ? "your hand is in one of its people: let them go first"
          : null,
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
