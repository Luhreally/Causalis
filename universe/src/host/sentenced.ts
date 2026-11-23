// A town's own people whom its land's court sentenced (sim/order/sentences.ts keeps the counts; this reads who): of the court's year,
// the town's share by its people, and of that, as many of its named lines as the lines are of its people (host/roster.ts), drawn
// by the year's key among its grown who live. One put to death the roster itself holds dead (host/roster.ts folds them); one held
// or at labour is held for a term drawn by their own key about the court's mean, so the town's prison names them while they are
// in it. Never drawn by the world and never kept: looking moves nothing. Level: a number a land (the court's), the town's share,
// and named persons (its lines).
import { finish, hashString, mix, yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import { DOES } from "../rules/index.ts";
import { bodyTitle, populationContext, prisonIn, sentencesOf, type Body } from "../sim/index.ts";
import { bodyWords } from "../causal/index.ts";
import { bodiesIn } from "./bodies.ts";
import { LINE, linesOf, townRoster, type Holder } from "./roster.ts";

const u = (seed: number, n: number) => finish(mix(seed, n), 13) / 4294967296;

/** The court of a land in words (null: none sits there). */
export function courtNameIn(world: World, cell: number): string | null {
  const court = bodiesIn(world, cell).find((x) => x.g.does === DOES.judge)?.g;
  return court ? bodyWords(court.name, bodyTitle(populationContext(world), court as Body)) : null;
}

/** A town's share of its land's court's year (heads): brought, fined, held, put to labour, put to death, not guilty. Null: none kept. */
export function townSentences(
  world: World,
  town: string,
  year: number,
): {
  brought: number;
  fined: number;
  held: number;
  labour: number;
  death: number;
  acquitted: number;
} | null {
  const s = populationContext(world).settlements.get(town as Ref),
    y = s ? sentencesOf(world)?.yearOf(s.cell, year) : null;
  if (!s || !y) return null;
  const k = s.population / 1e6;
  return {
    brought: Math.round(y.brought * k),
    fined: Math.round(y.fined * k),
    held: Math.round(y.held * k),
    labour: Math.round(y.labour * k),
    death: Math.round(y.death * k),
    acquitted: Math.round(y.acquitted * k),
  };
}

/** Those its land's court holds now who are of a town (heads): its share of the land's by its people. Null: none kept. */
export function townPrison(world: World, town: string): { inside: number; labour: number } | null {
  const ctx = populationContext(world),
    s = ctx.settlements.get(town as Ref),
    p = s ? prisonIn(world, s.cell) : null;
  if (!s || !p) return null;
  const all = Math.max(1, ctx.provinces.get(s.cell)?.total() ?? 1),
    k = Math.min(1, s.population / all);
  return { inside: Math.round(p.inside * k), labour: Math.round(p.labour * k) };
}

/** One of a town's lines its court holds: who, since and until when, and whether at labour. */
export type HeldOne = {
  readonly holder: Holder;
  readonly name: string;
  readonly year: number;
  readonly until: number;
  readonly labour: boolean;
};

/**
 * Those of a town's named lines its land's court holds now (or held in a year of the last few kept): of each year's held and put to
 * labour, by the town's lines, the first grown and living of a few lines by the year's key; each held a term of their own about
 * the court's mean.
 */
export function townHeld(world: World, town: string, now = yearOfMoment(world.now)): HeldOne[] {
  const ctx = populationContext(world),
    s = ctx.settlements.get(town as Ref),
    store = sentencesOf(world);
  if (!s || !store || s.population <= 0) return [];
  const mean = Math.max(1, prisonIn(world, s.cell)?.term ?? 1),
    lines = linesOf(s.population),
    roster = townRoster(world, town),
    grown = ctx.life.adulthood,
    out: HeldOne[] = [];
  let whole = 1;
  while (whole * 2 <= lines) whole *= 2;
  const about = lines >= 1.5 * whole ? 1.5 * whole : whole;
  for (let y = now - 2; y <= now; y++) {
    const kept = store.yearOf(s.cell, y);
    if (!kept) continue;
    for (const [rate, labour] of [
      [kept.held, false],
      [kept.labour, true],
    ] as const) {
      const hk = hashString(`held ${town} ${y} ${labour ? 1 : 0}`) >>> 0,
        x = (rate / 1e6) * about,
        n = Math.floor(x) + (u(hk, 7) < x - Math.floor(x) ? 1 : 0);
      for (let j = 0; j < Math.min(n, 24); j++)
        for (let i = 0; i < 12; i++) {
          const k = finish(mix(hk, 100 + 16 * j + i), 7) % Math.max(1, whole);
          const h = roster.holderAt(k, y);
          if (!h || y - h.born < grown || (h.died !== null && h.died <= y)) continue;
          if (out.some((o) => o.holder.ref === h.ref)) continue;
          // (Their own term about the court's mean: one in so many leave each year.)
          const term = Math.max(1, Math.round(-Math.log(Math.max(1e-6, u(h.key ^ hk, 3))) * mean));
          out.push({ holder: h, name: roster.nameOf(h), year: y, until: y + term, labour });
          break;
        }
    }
  }
  return out.filter((o) => o.until > now);
}

/** One of a town's own whom its court holds, by their page (null: not held). */
export function heldOneOf(world: World, ref: string): HeldOne | null {
  const m = /^folk:(town:\d+:\d+):/.exec(ref);
  if (!m) return null;
  return townHeld(world, m[1]!).find((o) => o.holder.ref === ref) ?? null;
}

export { LINE };
