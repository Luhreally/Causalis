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
import { BANDS, HUMANLIKE, SEXES, bandWidth } from "../../rules/index.ts";
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
};

export type Window = {
  readonly command: Ref;
  readonly event: Ref;
  readonly village: Ref;
  readonly cell: number;
  readonly laid: number;
  agents: Agent[];
  /** The next agent's id: newborns take it. */
  next: number;
};

/** Which age band an age falls in. */
export function bandOfAge(age: number): number {
  let b = 0;
  while (b + 1 < BANDS && HUMANLIKE.bands[b + 1]! <= age) b++;
  return b;
}

export class HandStore implements StateStore {
  readonly name = "hand.window";
  resting: Window | null = null;

  /** The window over a province, if the hand rests there. */
  over(cell: number): Window | null {
    return this.resting && this.resting.cell === cell ? this.resting : null;
  }

  /** The window's people as counts (row × occupation) in a given year. */
  composition(cell: number, year: number): number[] | null {
    const w = this.over(cell);
    if (!w) return null;
    const out = new Array<number>(ROWS * COLS).fill(0);
    for (const a of w.agents) {
      const i = row(a.sex, bandOfAge(year - a.birthYear)) * COLS + a.occupation;
      out[i] = out[i]! + 1;
    }
    return out;
  }

  pinned(): Ref[] {
    return this.resting ? [this.resting.event] : [];
  }

  hashInto(h: Hasher): void {
    h.value(this.resting);
  }

  save(): unknown {
    return { resting: this.resting };
  }

  load(state: unknown): void {
    const w = (state as { resting: Window | null }).resting;
    this.resting = w ? { ...w, agents: w.agents.map((a) => ({ ...a })) } : null;
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
        year = Math.floor(t / YEAR);
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
              HUMANLIKE.bands[band]! +
              Math.floor(world.rng.real(COLLAPSE, v.cell, t, 1, id) * bandWidth(band));
          agents.push({ id, sex, birthYear: year - age, occupation: o });
        }
      });
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
