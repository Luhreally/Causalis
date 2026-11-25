// Several peoples on one world (the breadth gaps, 2026-11-24: "several peoples' demographies on one world", "interbreeding
// and hybrid peoples"). A world keeps one life table, its first people's, and one number of people a land. Where a land
// holds more than one people (a beast raised to thought beside its makers, those born of two peoples), it carries a share
// by people, and what its births, its deaths and its mouths are is each people's own body's, weighed by its share:
//   A people's own table (rules/species.ts lifeHistoryOf, from its body) is read at the ages of the world's bands
//     (`lifeOnBands`: what one of them bears and risks at each age in years), and set against the world's own: births
//     (`births`, the young a bearer has over the world's bearing years), each band's deaths (`deaths`, as the hazard is so many
//     times the world's, so the land's own pressures compound on it as on any), and its mouth (`appetite`).
//   The shares move by each people's own births and deaths a year, as the land is fed and pressed (`sharesAfter`): no draw,
//     no authored rate.
//   Whether two peoples can have young together follows from their kinship and their chemistry (`crossFertility`): none
//     where they are not of one tree of life (no line of theirs was ever one, whatever they are made of), none where their
//     bodies are not built of the same sugars turning the same way in the same liquid (rules/biochem.ts eats, both ways);
//     of one tree, as many generations as their lines have been apart against those that part a kind for good
//     (Dobzhansky and Muller's snowball: what keeps two lines apart gathers as the square of the time since they parted).
//   Where they can, the young of both are a people of their own whose body is the blend (`blendBody`), as many a year as
//     the two meet (each one's share), as their ways let them pair with a stranger and as they bear at all (`crossBorn`).
// Pure functions.
import { dmath } from "../kernel/index.ts";
import type { BodyPlan } from "./bodies.ts";
import { eats, type LifeChemistry } from "./biochem.ts";
import { SPECIATION } from "./lineage.ts";
import { bandOf, bandWidth, diedInBirthYear, girlsOf, type LifeHistory } from "./species.ts";

export const PEOPLES = {
  /**
   * How many times the generations that make a stock a kind of its own (rules/lineage.ts SPECIATION.generations) two lines
   * must be apart before half their crossings fail (est: Earth's kinds go on crossing long after they are told apart: lions
   * and tigers some hundred thousand generations on, with young that are seldom fertile).
   */
  barrenAt: 10,
  /** A share of a people on a land below which it is no longer kept there (thousandths). */
  least: 1,
} as const;

/** A people's own numbers against its world's table: what a land's births, deaths and mouths are multiplied by, for all of it of that people. */
export type PeopleRates = {
  /** Its births against the world's people's (x). */
  readonly births: number;
  /** Each of the world's bands: how many times the world's people's hazard its own is. */
  readonly deaths: readonly number[];
  /** Its mouth against the world's people's (x). */
  readonly appetite: number;
  /** Born and dying a head a year at plenty, by its own table on the world's bands. */
  readonly born: number;
  readonly dying: number;
};

const hazard = (p: number): number => -dmath.log(1 - Math.min(0.999, Math.max(0, p)));

/**
 * A people's own table read at the ages of another's bands: at each year of age of each band, what its own table bears
 * and risks at that age (a risk as a hazard, so years add). The last band runs as long as the bands' table says.
 */
export function lifeOnBands(own: LifeHistory, bands: LifeHistory): LifeHistory {
  if (own === bands) return own;
  const fertility: number[] = [],
    mortality: number[] = [];
  for (let b = 0; b < bands.bands.length; b++) {
    const lo = bands.bands[b]!,
      w = Math.max(1, Math.round(bandWidth(b, bands)));
    let f = 0,
      h = 0;
    for (let y = 0; y < w; y++) {
      const at = bandOf(lo + y, own);
      f += own.fertility[at]!;
      h += hazard(own.mortality[at]!);
    }
    fertility.push(f / w);
    mortality.push(1 - dmath.exp(-h / w));
  }
  return {
    ...own,
    bands: bands.bands,
    fertility,
    mortality,
    oldest: bands.oldest,
    adulthood: Math.min(own.adulthood, bands.bands.at(-1)!),
  };
}

/** Born and dying a head a year at plenty, of a table at its own steady ages (as rules/species.ts growthOf reckons a year). */
export function crudeRates(life: LifeHistory, years = 200): { born: number; dying: number } {
  const bands = life.bands.length,
    newborn = 1 - diedInBirthYear(life.mortality[0]!);
  let n = new Array<number>(bands).fill(0),
    born = 0,
    dying = 0;
  n[Math.min(3, bands - 1)] = 1000;
  for (let y = 0; y < years; y++) {
    let births = 0,
      deaths = 0;
    for (let b = 0; b < bands; b++) {
      births += n[b]! * life.fertility[b]!;
      deaths += n[b]! * Math.min(1, life.mortality[b]!);
    }
    births *= girlsOf(life);
    n = n.map((x, b) => x * (1 - Math.min(1, life.mortality[b]!)));
    n[0] = n[0]! + births * newborn;
    const moved = n.map((x, b) => (b < bands - 1 ? x / bandWidth(b, life) : 0));
    for (let b = 0; b < bands; b++) {
      n[b] = n[b]! - moved[b]!;
      if (b + 1 < bands) n[b + 1] = n[b + 1]! + moved[b]!;
    }
    const total = n.reduce((a, x) => a + x, 0);
    if (!(total > 0)) return { born: 0, dying: 1 };
    born = births / 1000;
    dying = (deaths + births * (1 - newborn)) / 1000;
    n = n.map((x) => (x * 1000) / total);
  }
  return { born, dying };
}

/** A people's numbers against its world's table (`world`): its own table read on the world's bands, and set against it. */
export function ratesOf(own: LifeHistory, world: LifeHistory): PeopleRates {
  const mine = lifeOnBands(own, world),
    crude = crudeRates(mine);
  if (mine === world) return { births: 1, deaths: world.bands.map(() => 1), appetite: 1, ...crude };
  let f = 0,
    f0 = 0;
  for (let b = 0; b < world.bands.length; b++) {
    const w = bandWidth(b, world);
    f += mine.fertility[b]! * w;
    f0 += world.fertility[b]! * w;
  }
  return {
    births: f0 > 0 ? (f * girlsOf(mine)) / (f0 * girlsOf(world)) : 1,
    deaths: world.bands.map((_, b) => {
      const h0 = hazard(world.mortality[b]!);
      return h0 > 0 ? dmath.clamp(hazard(mine.mortality[b]!) / h0, 0.05, 20) : 1;
    }),
    appetite: world.appetite > 0 ? mine.appetite / world.appetite : 1,
    ...crude,
  };
}

/**
 * A land's shares by people after `years`: each people grown by its own births, as the land is fed (`fed`, 0 … 1 of its
 * births at plenty), less its own deaths, as the land is pressed (`press`, x its deaths at plenty). Shares of one whole.
 */
export function sharesAfter(
  shares: readonly number[],
  rates: readonly Pick<PeopleRates, "born" | "dying">[],
  fed: number,
  press: number,
  years = 1,
): number[] {
  const grown = shares.map((s, i) => {
    const r = rates[i]!,
      net =
        Math.max(0, fed) * r.born -
        (1 - dmath.pow(1 - Math.min(0.999, r.dying), Math.max(0, press)));
    return Math.max(0, s) * dmath.pow(Math.max(0, 1 + net), Math.max(0, years));
  });
  const all = grown.reduce((a, x) => a + x, 0);
  return all > 0 ? grown.map((x) => x / all) : shares.map((s) => s);
}

/** How two peoples stand to each other in life's tree: of one tree or not, and how long their lines have been apart. */
export type Kinship = {
  readonly sameTree: boolean;
  /** Generations since their lines parted (0: one line still). */
  readonly generations: number;
};

/** Whether two peoples can have young together, how far (0 … 1 of their crossings bearing), and why. */
export function crossFertility(
  kin: Kinship,
  a: LifeChemistry,
  b: LifeChemistry,
): { readonly fertility: number; readonly why: string } {
  if (!kin.sameTree)
    return {
      fertility: 0,
      why: "they are not of one tree of life: no line of theirs was ever one, and nothing of one's making reads the other's",
    };
  if (!eats(a, b) || !eats(b, a) || a.hand !== b.hand)
    return {
      fertility: 0,
      why: "their bodies are not built of the same stuff turning the same way: nothing of one could grow in the other",
    };
  const far = Math.max(0, kin.generations) / (PEOPLES.barrenAt * SPECIATION.generations),
    // (Half fail at `barrenAt` times a kind's parting; what keeps them apart gathers as the square of the time.)
    fertility = dmath.exp(-dmath.LN2 * far * far);
  return fertility < 0.001
    ? {
        fertility: 0,
        why: "their lines have been apart too long: what each has become since no longer fits the other",
      }
    : {
        fertility,
        why:
          fertility > 0.95
            ? "their lines are all but one still: their young are as any"
            : "their lines parted not long since: some of their crossings bear, and those born can bear in turn",
      };
}

/**
 * Of a land's births in a year, the share born of two peoples: as often as the two meet (each one's share of the land,
 * either way), as their ways let them pair with a stranger (`open`, 0 … 1), and as far as their crossings bear.
 */
export function crossBorn(a: number, b: number, open: number, fertility: number): number {
  return (
    2 *
    dmath.clamp(a, 0, 1) *
    dmath.clamp(b, 0, 1) *
    dmath.clamp(open, 0, 1) *
    dmath.clamp(fertility, 0, 1)
  );
}

/**
 * The body of those born of two peoples: between the two by how much of each is in them (`ofA`, 0 … 1). What is measured
 * lies between (weight and span on their logs, as bodies scale; the young at a birth, how close they live); what is one
 * thing or another (its blood, its skin, how it bears) is that of the people most of it is.
 */
export function blendBody(a: BodyPlan, b: BodyPlan, ofA = 0.5): BodyPlan {
  const w = dmath.clamp(ofA, 0, 1),
    most = w >= 0.5 ? a : b,
    geo = (x: number, y: number) =>
      dmath.exp(w * dmath.log(Math.max(1e-6, x)) + (1 - w) * dmath.log(Math.max(1e-6, y))),
    lin = (x: number, y: number) => w * x + (1 - w) * y;
  return {
    ...most,
    clade: a.clade === b.clade ? a.clade : `${a.clade}×${b.clade}`,
    name: a.name === b.name ? a.name : `those born of ${a.name} and ${b.name}`,
    size: Math.max(1, Math.round(geo(a.size, b.size))),
    span: Math.max(1, Math.round(geo(a.span, b.span))),
    young: Math.max(1, Math.round(lin(a.young, b.young))),
    social: Math.round(lin(a.social, b.social) * 100) / 100,
    limbs: Math.max(1, Math.round(lin(a.limbs, b.limbs))),
  };
}

/**
 * The body of a beast raised to thought (sim/frontier/uplift.ts), as a people's body: its makers' own in what was written
 * into it (its senses and hands as they left them), its own in what it weighs, its blood, and the years its weight gives
 * it (lives run long as weight to about the fifth, warm blood longer: rules/rise.ts risenBody's reckoning, without its draw).
 */
export function raisedBody(
  makers: BodyPlan,
  beast: { readonly name: string; readonly size: number; readonly warm: boolean },
): BodyPlan {
  const size = Math.max(2, Math.round(beast.size)),
    span = Math.round(
      dmath.clamp(18 * dmath.pow(Math.max(0.5, size), 0.2) * (beast.warm ? 1.3 : 1), 15, 140),
    );
  return {
    ...makers,
    clade: "raised",
    name: beast.name,
    size,
    warm: beast.warm,
    span,
    bearing: beast.warm ? "live" : "eggs",
    young: !beast.warm ? 4 : size > 300 ? 1 : 2,
  };
}
