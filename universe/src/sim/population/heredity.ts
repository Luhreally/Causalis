// A people taking to its land, told (the breadth gaps, 2026-11-24; the rule is rules/heredity.ts takenTo, read each
// reckoning by population/systems.ts takenIn). How far each land's people have taken to its cold, its heat and its thin
// air is a pure reading of the years their lines have lived there and how hard the land kills those who have not: nothing
// of it is kept. All this holds is what was told: the first land of a world whose people, come to it within the
// chronicle, are half-way to bearing each of the three, with the decision that says why (the generations, the land's
// pressure, how much of the trait is passed on). Three rows a world at the most; nothing until the first.
import {
  YEAR,
  defineEventType,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { HEREDITY } from "../../rules/index.ts";
import { peopleKin } from "./life.ts";
import { takenIn, type PopulationContext } from "./systems.ts";

export const HEREDITY_EVENTS = {
  /** A land's people, come to it within the chronicle, have half taken to what it asks of their bodies. */
  taken: defineEventType("peoples.taken-to-land", 4),
};

const ASKS = ["cold", "heat", "air"] as const;
export type Taken = {
  readonly what: (typeof ASKS)[number];
  readonly cell: number;
  readonly year: number;
  readonly event: Ref;
};

export class HeredityStore implements StateStore {
  readonly name = "population.heredity";
  told: Taken[] = [];
  dormant(): boolean {
    return !this.told.length;
  }
  pinned(): Ref[] {
    return this.told.map((t) => t.event);
  }
  hashInto(h: Hasher): void {
    if (this.told.length) h.value(this.told.map((t) => [t.what, t.cell, t.year]));
  }
  save(): unknown {
    return this.told.length ? { told: this.told } : {};
  }
  load(state: unknown): void {
    this.told = [...(((state ?? {}) as { told?: Taken[] }).told ?? [])];
  }
}

export function heredityOf(world: World): HeredityStore | null {
  return world.peek<HeredityStore>("population.heredity") ?? null;
}

/** Once in five years, until each of the three is told: the land whose people have taken to it the furthest, past half-way. */
export function heredityYear(ctx: PopulationContext, t: SimTime): void {
  const store = heredityOf(ctx.world);
  if (!store || store.told.length >= ASKS.length) return;
  const year = yearOfMoment(t);
  if (year % 5 !== 0) return;
  const generation = peopleKin(ctx.generated).generation,
    best: ({ cell: number; taken: number } | null)[] = ASKS.map(() => null);
  for (const p of ctx.provinces.all()) {
    if (p.settledYear <= 0 || p.total() <= 0) continue;
    const taken = takenIn(ctx, p, year, generation);
    ASKS.forEach((what, i) => {
      if (store.told.some((x) => x.what === what)) return;
      const v = taken[what];
      // (1 where the land asks nothing of it: nothing to take to.)
      if (v >= 0.5 && v < 1 && (!best[i] || v > best[i].taken))
        best[i] = { cell: p.cell, taken: v };
    });
  }
  ASKS.forEach((what, i) => {
    const b = best[i];
    if (!b || store.told.some((x) => x.what === what)) return;
    const p = ctx.provinces.get(b.cell)!,
      gens = (year - p.settledYear) / Math.max(1, generation),
      decision = ctx.world.decisions.record({
        rule: "peoples.taken-to-land",
        subject: p.ref,
        outcome: { what, taken: Math.round(b.taken * 100) },
        score: b.taken,
        threshold: 0.5,
        factors: [
          {
            name: "generations their lines have lived there",
            value: Math.round(gens * 10) / 10,
            contribution: b.taken,
            source: p.arrival ? { ref: p.arrival, role: "enabler", weight: 1 } : null,
          },
          {
            name: "how much of it is passed on",
            value: HEREDITY.heritability[what],
            contribution: HEREDITY.heritability[what],
            source: null,
          },
          {
            name: "what a generation's response is (of the whole way)",
            value: gens > 0 ? b.taken / gens : 0,
            contribution: gens > 0 ? b.taken / gens : 0,
            source: null,
          },
        ],
      }),
      event = ctx.world.events.emit({
        type: HEREDITY_EVENTS.taken.type,
        place: p.ref,
        subjects: [p.ref],
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { what, taken: Math.round(b.taken * 100), generations: Math.round(gens), year },
      });
    store.told.push({ what, cell: b.cell, year, event });
  });
}

/** Teach a world to tell its people's taking to their lands. */
export function installHeredity(world: World, ctx: () => PopulationContext): HeredityStore {
  const store = world.register(new HeredityStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "136.population.heredity", every: YEAR, run: (t) => heredityYear(ctx(), t) });
  return store;
}
