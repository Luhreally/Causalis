// Who gains by a market and who is held in it (Round B): how much its makers can ask above their cost, the guilds and unions they
// bind themselves in, how a land's income is shared out, and whom its holders bind. A rule says what a thing does; the world says how
// much.
//   Market power (lerner): a market's few makers ask above their cost by one over their number times how far buyers can go without
//     (Cournot's Lerner index); a guild that acts as one asks as a single maker would; goods from abroad hold it down.
//   Guilds and unions (organised): crafters bind themselves where they are many together, can read and keep a roll, the law lets
//     them meet, and what they would win by it is worth it; where works gather them, those under one roof the more.
//   Land rent and inequality (rentOf, lorenz): the harvest above what its tillers earn at the margin is the land's rent (Ricardo);
//     it goes to whoever holds the land (few or many, or all in common); every kind of worker's earnings, the bound's living and the
//     holders' rent, sorted, make the land's Lorenz curve, five shares a land.
//   Bondage (bindPull): where hands are scarce against the land, what a tiller makes is worth far more than his living and his holder
//     would keep the difference (Domar); he can where the realm's arms reach and its law allows, and cannot where open land lets the
//     bound walk off. As hands grow plentiful, arms weaken or the law turns, it ends.
// Pure functions.
import { dmath } from "../kernel/index.ts";

// —— 5. Market power ————————————————————————————————————————————————————————————————————————————————————

/** Crafters a shop holds, before works and in works (est: a master and his journeymen; a mill's floor). */
export const SHOP = { hands: 5, works: 60 } as const;

/**
 * What a market's makers of a good can ask above their cost, as a share of its price (the Lerner index, 0 … 0.6): with `shops`
 * independent makers and buyers who go without by `elasticity`, 1 / (shops × elasticity); a guild of strength `guild` acts toward
 * one maker; goods from abroad (`imported`, the share of it bought from elsewhere) hold it down toward what a carrier's margin allows.
 */
export function lerner(shops: number, elasticity: number, guild: number, imported: number): number {
  const e = Math.max(0.2, elasticity),
    alone = 1 / (Math.max(1, shops) * e),
    one = 1 / e,
    g = dmath.clamp(guild, 0, 1),
    asked = (1 - g) * alone + g * one,
    held = asked * (1 - dmath.clamp(imported, 0, 1) * 0.8);
  return dmath.clamp(held, 0, 0.6);
}

// —— Guilds and unions ——————————————————————————————————————————————————————————————————————————————————

/** What lets those who work organise. */
export type Organising = {
  /** How many of them work in the land, and how many to a shop. */
  readonly workers: number;
  readonly perShop: number;
  /** How far its people read (0 … 1: its writing and learning). */
  readonly letters: number;
  /** How the realm is held (rules/holds.ts): force, voice; and whether its law lets strangers and the many gather (its laws). */
  readonly force: number;
  readonly voice: number;
  /** What they would win by it: the rent their market leaves them, as a share of what they sell or earn. */
  readonly gain: number;
};

/**
 * How strongly those who work bind themselves (0 … 1): many together (the more shops, the harder each is to keep in line, so the
 * more those under one roof count), a roll they can keep, a law that lets them meet (arms against it, a voice for it), and what they
 * win by it.
 */
export function organised(o: Organising): number {
  const many = o.workers / (o.workers + 200),
    roof = dmath.clamp(o.perShop / SHOP.works, 0, 1),
    together = many * (0.5 + 0.5 * roof),
    roll = 0.3 + 0.7 * dmath.clamp(o.letters, 0, 1),
    let_ = dmath.clamp(1.2 - 1.2 * o.force + 0.5 * o.voice, 0, 1),
    worth = dmath.clamp(o.gain * 4, 0, 1);
  return dmath.clamp(2.5 * together * roll * let_ * worth, 0, 1);
}

/** How far organising moves toward what the land allows, a year; what a union wins of its trade's rent. */
export const ORGANISE = { pace: 0.08, share: 0.5 } as const;

// —— 8. Land rent and inequality ——————————————————————————————————————————————————————————————————————————

/**
 * A land's rent (grain's worth a year): what its fields and pastures yield beyond what their workers earn at the margin (Ricardo);
 * none where the margin earns all.
 */
export function rentOf(yieldWorth: number, workers: number, marginWage: number): number {
  return Math.max(0, yieldWorth - workers * marginWage);
}

/** A kind of household in a land: how many people, and what each earns a year (grain's worth). */
export type Earners = { readonly people: number; readonly each: number };

/** A land's Lorenz curve: the share of all earned by each fifth of its people, poorest first; its Gini; its top tenth's share. */
export type Lorenz = {
  readonly fifths: readonly number[];
  readonly gini: number;
  readonly top: number;
};

/**
 * The Lorenz curve of what a land's people earn: its kinds of household sorted by what each earns, the curve read off at each fifth,
 * and the Gini (one less twice the area under it). Within a kind all earn alike, so it is the least the inequality can be.
 */
export function lorenz(groups: readonly Earners[]): Lorenz {
  const g = groups.filter((x) => x.people > 0 && x.each >= 0).sort((a, b) => a.each - b.each),
    people = g.reduce((s, x) => s + x.people, 0),
    all = g.reduce((s, x) => s + x.people * x.each, 0);
  if (people <= 0 || all <= 0) return { fifths: [0.2, 0.2, 0.2, 0.2, 0.2], gini: 0, top: 0.1 };
  // The curve at any share of the people.
  const at = (p: number) => {
    let n = 0,
      w = 0;
    for (const x of g) {
      if (n + x.people >= p * people) return (w + (p * people - n) * x.each) / all;
      n += x.people;
      w += x.people * x.each;
    }
    return 1;
  };
  const marks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(at),
    fifths = [0, 1, 2, 3, 4].map((i) => Math.max(0, marks[i + 1]! - marks[i]!));
  // Gini: exact over the kinds (each a straight piece of the curve).
  let area = 0,
    cum = 0;
  for (const x of g) {
    const dp = x.people / people,
      dw = (x.people * x.each) / all;
    area += dp * (2 * cum + dw);
    cum += dw;
  }
  return { fifths, gini: dmath.clamp(1 - area, 0, 1), top: 1 - at(0.9) };
}

/**
 * Among how many a land's rent is shared: where its wealth lies with few (spread 0) one household in a hundred holds its land, with
 * every household (spread 1) half of them; what the realm holds for all (common) is shared by everyone.
 */
export function holdersShare(spread: number): number {
  return 0.01 + 0.49 * dmath.clamp(spread, 0, 1);
}

// —— 9. Bondage —————————————————————————————————————————————————————————————————————————————————————————

/** What a land's holders weigh in binding its tillers. */
export type Binding = {
  /** What a free tiller earns at the margin, and what keeps him and his (grain's worth a year). */
  readonly wage: number;
  readonly living: number;
  /** Open land within reach a bound tiller could walk to, against its people (0: none; 1: as much again as is tilled). */
  readonly open: number;
  /** How far the realm's arms reach its lands (force × capacity, with rank set hard). */
  readonly power: number;
  /** Its law on the land: 1 the lord's, 0.5 leased, 0 the tiller's own; 0 once bondage is outlawed. */
  readonly law: number;
};

/** The most of a land's tillers that are bound. */
export const BIND_MOST = 0.6;

/**
 * The share of a land's tillers its holders bind (0 … BIND_MOST), and its parts: what binding would keep (the tiller's wage above
 * his living, as a share of it: high where hands are scarce), how much of the bound the realm's arms can hold against the open land
 * they could flee to, and what the law allows.
 */
export function bindPull(b: Binding): { share: number; gain: number; hold: number } {
  const gain = b.wage > 0 ? dmath.clamp((b.wage - b.living) / b.wage, 0, 1) : 0,
    flee = dmath.clamp(b.open, 0, 2),
    power = dmath.clamp(b.power, 0, 1),
    hold = power / (power + flee * (1 - power) + 0.15);
  return {
    share: dmath.clamp(BIND_MOST * dmath.clamp(b.law, 0, 1) * gain * hold * 1.6, 0, BIND_MOST),
    gain,
    hold,
  };
}
