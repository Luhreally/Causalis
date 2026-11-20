// Peoples abroad (rules/abroad.ts; what is kept and read: ./abroad-kept.ts). Each year the migrations since the last read (they
// are numbered: sim/population/stores.ts flows) are gone through once: those who came into a land that speaks another language
// than the land they left are of a people abroad there, by their share of the land's people now. Once in ABROAD.every years, each
// land in its own year, a land's peoples abroad are aged (the young take the speech around them), the least let go, and one
// whose language the land has itself come to speak is no longer abroad. Flight from war and want is migration here like any
// other: whatever names the cause of a move, this reads only who went where.
// The first time a people abroad passes a tenth of a land's people it is told. Work a year: the year's moves, and a fifth of the
// lands that keep any.
import {
  YEAR,
  defineEventType,
  yearOfMoment,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { tongueLikeness } from "../../gen/index.ts";
import { ABROAD, CREED, abroadAfter } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { languagesOf } from "./languages.ts";
import { readersOf } from "../lore/letters.ts";
import { cultureOf } from "./culture.ts";
import { AbroadStore, abroadOf, type Abroad } from "./abroad-kept.ts";

export const ABROAD_EVENTS = {
  /** A people abroad came to be a tenth of a land's people. */
  settled: defineEventType("people.abroad", 3),
};

/** The share at which a people abroad in a land is told (thousandths). */
const TOLD = 100;

export function abroadYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = abroadOf(world);
  if (!store || !world.hasStore("culture.languages")) return;
  const year = yearOfMoment(t),
    languages = languagesOf(world),
    history = ctx.history,
    flows = history.flows(),
    base = history.flowOffset,
    end = base + flows.length;
  // 1. The moves since the last read.
  for (let i = Math.max(store.seen, base); i < end; i++) {
    const f = flows[i - base]!;
    // (Only the moves of this year and the last: a save from before this was kept holds a lifetime of old moves, which are
    // not counted as if they had all come now.)
    if (f.count <= 0 || f.year < year - 1) continue;
    const from = languages.of(f.from),
      to = languages.of(f.to);
    if (!from || !to || from.index === to.index) continue;
    const people = ctx.provinces.get(f.to)?.total() ?? 0;
    if (people <= 0) continue;
    const add = Math.round((1000 * Math.min(f.count, people)) / people);
    if (add <= 0) continue;
    const list: Abroad[] = (store.of(f.to) ?? []).map((e) => [...e] as Abroad),
      was = list.find((e) => e[0] === from.index),
      before = was?.[1] ?? 0;
    if (was) {
      was[1] += add;
      // (The land most came from: the newcomers' where they are the more.)
      if (add > before) was[2] = f.from;
    } else list.push([from.index, add, f.from, year]);
    let sum = 0;
    for (const e of list) sum += e[1];
    if (sum > ABROAD.most) for (const e of list) e[1] = Math.floor((e[1] * ABROAD.most) / sum);
    const kept = list
      .filter((e) => e[1] >= ABROAD.least)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, ABROAD.keep);
    store.set(f.to, kept);
    const now = kept.find((e) => e[0] === from.index)?.[1] ?? 0;
    if (before < TOLD && now >= TOLD)
      world.events.emit({
        type: ABROAD_EVENTS.settled.type,
        subjects: [from.ref],
        place: ctx.provinces.get(f.to)!.ref,
        causes: [{ ref: f.event, role: "trigger", weight: 1 }],
        data: { people: from.name, share: now, from: f.from },
      });
  }
  store.seen = end;
  if (!store.size) return;

  // 2. Each land that keeps any, in its own year: aged, and those no longer abroad let go.
  const culture = cultureOf(world),
    generation = (CREED.generation * Math.max(5, ctx.generated.life.people?.body.span ?? 70)) / 70;
  for (const c of store.cells()) {
    if ((year + c) % ABROAD.every !== 0) continue;
    const own = languages.of(c),
      mine = culture.get(c);
    if (!ctx.provinces.get(c)?.total() || !own) {
      store.set(c, []);
      continue;
    }
    const kept: Abroad[] = [];
    for (const e of store.of(c)!) {
      if (e[0] === own.index) continue;
      const theirs = languages.at(e[0]),
        like = mine && theirs ? tongueLikeness(mine.tongue, theirs.standard) : 0,
        share = Math.floor(abroadAfter(e[1], ABROAD.every, generation, like, readersOf(world, c)));
      if (share >= ABROAD.least) kept.push([e[0], share, e[2], e[3]]);
    }
    store.set(c, kept);
  }
}

/** Teach a peopled world its peoples abroad. */
export function installAbroad(world: World, ctx: () => PopulationContext): AbroadStore {
  const store = world.register(new AbroadStore());
  world.system({ key: "163.culture.abroad", every: YEAR, run: (t) => abroadYear(ctx(), t) });
  return store;
}
