// Past our ages, what a people makes of its sky and of itself (the Frontier lane; the mirrors, the remaking and the covered
// world are rules/late.ts). Each a figure its own star, its system's small bodies and its own numbers give.
//
//   Works in the sky: a works on a small body that builds the next of what it mines, tended by minds, doubles as the mirrors
//   do (rules/late.ts), its rock out of a shallow well instead of up a world's deep one; it sends down what it makes, as many
//   machines a year as its people would wear out, and no more. Its rock is its system's belt: the giant past the frost line
//   that stirs it also clears it (a belt left unstirred holds more, est). Lit by mirrors, it doubles twice as fast.
//   Bodies written for a world: a people that writes and grows its bodies writes its settlers' children for the world they
//   live on, as far as a body can be bent (a warmth some sixty degrees from home's, a sky's rays with mended cells: est); air
//   and pressure stay the halls' work. Machine limbs and senses (where minds are made) bear the cold and the rays besides.
//   Bodies written and parts replaced (2026-11-24, "engineered bodies and cyborgs"): how many of a people's children are
//   written a generation is what it knows of the body by what it can spare to pay for it (`rewritable`: no authored share),
//   over its own generations; how many carry made parts, the same of what its engines spare, where it makes minds
//   (`replaceable`). What either gains is read off the body's own limits (`bodyLimits`, its life table): its frailty (how
//   much of its first years' deaths is their being the first years), its wearing out (how much of each old band's deaths
//   is age, over the least its grown die at), and so its years. A written child is spared the first, a written or mended
//   body the second (`engineeredDeaths`); and one grown, not borne, costs no mother her work and is made when wanted
//   (sim/population/systems.ts transition, by rules/children.ts as any people's: no authored share of its bearing kept).
//   Minds past their makers: a people's made minds think as many sums a second as its crystal and its power allow, and the
//   crystal doubles every two years once minds design minds (Moore's law, est), until its power is all they can burn: a
//   sum a picojoule (est, far above Landauer's bound). A body's brain thinks some 1e16 a second (est). Past their makers'
//   sum the minds may be kept, or go their own way, as tightly as a people holds what it has made (its order and its
//   tradition: est); and a people whose bodies can be read may go up into them, as many as its ways are open, slowly.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { bandWidth, type LifeHistory } from "./species.ts";

export const BEYOND = {
  /** The first works in the sky (t): a station's weight in tools and seed works. */
  firstWorksT: 2000,
  /** Years a works takes to double, tended by minds; lit by mirrors (est). */
  doubling: 15,
  doublingLit: 8,
  /** Machines a tonne of works sends down a year at most, and the people's wear a head a year (rules/goods.ts machinesPerWorker). */
  machinesPerT: 0.05,
  perHead: 0.05,
  /** A belt's rock (home-world masses): stirred by a giant past the frost line (Earth's, 5e-4), or left whole (est). */
  beltStirred: 5e-4,
  beltWhole: 5e-3,
  /** A home world's mass (kg). */
  earthKg: 5.97e24,
  /** Of a belt, the share a people can reach and work in a chronicle (est). */
  beltReached: 1e-6,
  /** Years untended before a works falls silent. */
  untended: 30,
  /** How far a body can be bent: degrees of warmth from home's, a share of the sky's rays (est). */
  writtenDegrees: 60,
  writtenRays: 0.5,
  /** Sums a second a body's brain is reckoned to think (est). */
  brainSums: 1e16,
  /** Sums a second a head a people's first minds of crystal reckon (rules/ages.ts SUMS, "minds of crystal"). */
  crystalSums: 1e10,
  /** Years the minds' crystal takes to double once minds design minds (est, Moore's law). */
  mindsDoubling: 2,
  /** Sums a joule the made minds reach (est). */
  sumsPerJ: 1e12,
  /** A share a year of how far past their makers' sum the minds are (a tenfold) that they go their own way, unbound (est). */
  freeing: 0.004,
  /** A share a year of those whose ways are open who go up into minds, once they can (est). */
  goingUp: 0.01,
  /** Past this many of a land's people gone up, its people are told gone. */
  goneShare: 0.5,
} as const;

/** The rock a system's belt holds (kg), by whether a giant stirs it. */
export const beltKg = (stirred: boolean): number =>
  (stirred ? BEYOND.beltStirred : BEYOND.beltWhole) * BEYOND.earthKg;

/** The most a system's works can grow to (t): what of its belt a people can reach. */
export const mostWorksT = (stirred: boolean): number =>
  (beltKg(stirred) * BEYOND.beltReached) / 1000;

/** A year of a works tended (or so many at once): doubled by its doubling's share, no more than its belt allows. */
export function worksNextYear(
  t: number,
  most: number,
  lit: boolean,
  mindsPast: number,
  years = 1,
): number {
  const d =
    (lit ? BEYOND.doublingLit : BEYOND.doubling) /
    (1 + Math.max(0, dmath.log10(Math.max(1, mindsPast))));
  return Math.min(most, t * dmath.pow(2, Math.max(0, years) / Math.max(1, d)));
}

/** Machines a works sends down a year: by its weight, no more than its realm's people wear out. */
export const worksMachines = (t: number, people: number): number =>
  Math.floor(Math.min(t * BEYOND.machinesPerT, Math.max(0, people) * BEYOND.perHead));

/**
 * The share of a land's halls' upkeep a written body bears, from the needs it lists (rules/habitat.ts Need ids and their
 * upkeep): heating and cooling as far as the warmth lies within the bend, the rays' shelter a share; air and pressure none.
 */
export function writableShare(
  needs: readonly { readonly id: string; readonly upkeep: number }[],
  degreesOff: number,
  /** The share of them who carry limbs and senses of machines (`replaceable`), which feel neither: 0 … 1. */
  limbs: number,
): number {
  const k = BEYOND,
    extra = dmath.clamp(limbs, 0, 1);
  let all = 0,
    bent = 0;
  for (const n of needs) {
    all += n.upkeep;
    if (n.id === "heat" || n.id === "cool")
      bent +=
        n.upkeep *
        Math.min(1, dmath.clamp(k.writtenDegrees / Math.max(1, degreesOff), 0, 1) + extra);
    else if (n.id === "shelter") bent += n.upkeep * Math.min(1, k.writtenRays + extra);
  }
  return all > 0 ? dmath.clamp(bent / all, 0, 1) : 0;
}

/**
 * Of a people's children, the share written a generation: what it knows of the body (`knows`, 0 … 1: its lore of health)
 * by what it can spare to pay for it (`pays`, 0 … 1: the share of its work its engines do, not its bodies).
 */
export const rewritable = (knows: number, pays: number): number =>
  dmath.clamp(knows, 0, 1) * dmath.clamp(pays, 0, 1);

/** Of a people, the share who carry made parts a generation: what its engines spare, where it makes minds to run them. */
export const replaceable = (makesMinds: boolean, pays: number): number =>
  makesMinds ? dmath.clamp(pays, 0, 1) : 0;

/** How far a people is written (or mended) after so many years: `share` of its children a generation of its own, compounding. */
export const writtenAfter = (years: number, share: number, generation: number): number =>
  1 - dmath.pow(1 - dmath.clamp(share, 0, 0.999), Math.max(0, years) / Math.max(1, generation));

const hazardOf = (p: number): number => -dmath.log(1 - Math.min(0.999, Math.max(0, p)));

/**
 * A body's own limits, read off its life table: of its first years' deaths, the share that is their being the first
 * (over the hazard of the years after); of each band's deaths, the share that is age (over the least its grown die at);
 * and the years its grown would live at that least (its span were it not to wear).
 */
export function bodyLimits(life: LifeHistory): {
  readonly frail: number;
  readonly worn: readonly number[];
  readonly unworn: number;
} {
  let least = Infinity;
  for (let b = 0; b < life.bands.length; b++)
    if (life.bands[b]! >= life.adulthood) least = Math.min(least, hazardOf(life.mortality[b]!));
  if (!(least < Infinity)) least = hazardOf(life.mortality.at(-1)!);
  const first = hazardOf(life.mortality[0]!),
    next = hazardOf(life.mortality[1] ?? life.mortality[0]!);
  return {
    frail: first > 0 ? dmath.clamp(1 - next / first, 0, 1) : 0,
    worn: life.bands.map((lo, b) => {
      const h = hazardOf(life.mortality[b]!);
      return lo >= life.adulthood && h > 0 ? dmath.clamp(1 - least / h, 0, 1) : 0;
    }),
    unworn: least > 0 ? 1 / least : Infinity,
  };
}

/**
 * What a people's written and mended bodies do to its deaths, each band's (x): its first years spared their frailty as far
 * as its children are written, every band its wearing as far as its bodies are written or carry made parts.
 */
export function engineeredDeaths(life: LifeHistory, written: number, replaced: number): number[] {
  const limits = bodyLimits(life),
    w = dmath.clamp(written, 0, 1),
    either = 1 - (1 - w) * (1 - dmath.clamp(replaced, 0, 1));
  return life.bands.map(
    (_, b) => (b === 0 ? 1 - w * limits.frail : 1) * (1 - either * limits.worn[b]!),
  );
}

/** The years a people so written and mended lives from its coming of age, against its body's own (x: 1 where neither). */
export function engineeredYears(life: LifeHistory, written: number, replaced: number): number {
  const by = engineeredDeaths(life, written, replaced),
    years = (factor: (b: number) => number) => {
      let live = 1,
        sum = 0;
      for (let b = 0; b < life.bands.length; b++) {
        if (life.bands[b]! < life.adulthood) continue;
        const h = hazardOf(life.mortality[b]!) * factor(b),
          w = bandWidth(b, life),
          // (The last band runs on at its own hazard.)
          last = b === life.bands.length - 1;
        sum += live * (h > 0 ? (last ? 1 / h : (1 - dmath.exp(-h * w)) / h) : w);
        live *= dmath.exp(-h * w);
      }
      return sum;
    },
    own = years(() => 1);
  return own > 0 ? years((b) => by[b]!) / own : 1;
}

/**
 * How many times their makers' sum a people's minds think (a ratio), `years` after minds began to design minds: their
 * crystal at the start (sums a second a head), doubling, no more than their power (kW a head) burns.
 */
export function mindsPast(sumsAHead: number, kwAHead: number, years: number): number {
  const k = BEYOND,
    grown = Math.max(0, sumsAHead) * dmath.pow(2, Math.max(0, years) / k.mindsDoubling),
    power = Math.max(0, kwAHead) * 1000 * k.sumsPerJ;
  return Math.min(grown, power) / k.brainSums;
}

/** The years from the start until the minds pass their makers (Infinity where their power never lets them). */
export function yearsToPass(sumsAHead: number, kwAHead: number): number {
  const k = BEYOND;
  if (kwAHead * 1000 * k.sumsPerJ < k.brainSums || !(sumsAHead > 0)) return Infinity;
  return Math.max(0, k.mindsDoubling * dmath.log2(k.brainSums / sumsAHead));
}

/** A year's chance the minds go their own way: the farther past their makers, the likelier; the tighter held, the less. */
export function freeingChance(past: number, held: number): number {
  if (!(past > 1)) return 0;
  return BEYOND.freeing * dmath.log10(past) * (1 - dmath.clamp(held, 0, 1));
}

/**
 * Minds as someone (the audit's "made minds as someone"): once a realm's minds think more than all its people, its people
 * speak of them as one, by a name. Kept, that one counsels the seat, and a seat so counselled reaches farther over its lands
 * (by how far past their makers they think, a tenfold a third of the most); gone their own way, they are a power in the realm
 * that answers to no one, and the seat that leaned on them reaches the less.
 */
export const MIND = { counsel: 0.05, gone: 0.03 } as const;
/** How far past their makers a realm's minds think, as their counsel and their doings are read (0 … 1): a third at their makers'
 * sum, all at a hundred times it. */
export function mindReach(past: number): number {
  return past >= 1 ? dmath.clamp(dmath.log10(past) / 3 + 1 / 3, 0, 1) : 0;
}
export function mindCounsel(past: number, free: boolean): number {
  if (!(past >= 1)) return 0;
  return free ? -MIND.gone : MIND.counsel * mindReach(past);
}

/**
 * Made minds as a group (the audit's item 28, 2026-11-22): kept, they sit at their realm's court (sim/court/court.ts) with
 * sway as far as they think past their makers (MIND_GROUP.sway at the most), and the seat weighs their want of its groups
 * when it gives its own word on them (sim/order/grouphand.ts); gone their own way, they are one of its groups (basis
 * "minds", sim/order/groups.ts). What they do as one, read as their counsel is (mindReach): at first they inquire (they
 * design the next minds) and trade (for the power they burn and the works they tend); the farther past their makers, and
 * the more tightly their makers would hold what they make (heldOf), the more they work against the seat that would hold
 * them (conspire: sim/order/deeds.ts strikes at its ruler and its judges). A people that holds its makings tightly heeds
 * them the less: their sway at court is less by half that hold. Their hands: those of its people in their pay, at most
 * MIND_GROUP.hands of them (one in ten thousand: a ministry's staff, not a host). Nothing where a realm has no minds past
 * their makers.
 */
export const MIND_GROUP = { hands: 0.0001, sway: 0.3 } as const;
export function mindAims(
  past: number,
  held: number,
): { inquire: number; trade: number; conspire: number } {
  const x = mindReach(past),
    inquire = 0.5 * (1 - x) + 0.2,
    trade = 0.3,
    conspire = 0.6 * x * dmath.clamp(held, 0, 1),
    all = inquire + trade + conspire;
  return {
    inquire: Math.round((1000 * inquire) / all),
    trade: Math.round((1000 * trade) / all),
    conspire: 1000 - Math.round((1000 * inquire) / all) - Math.round((1000 * trade) / all),
  };
}
/** Their sway at court, kept (a share of the realm's, as its other voices'). */
export function mindSway(past: number, held: number): number {
  return MIND_GROUP.sway * mindReach(past) * (1 - 0.5 * dmath.clamp(held, 0, 1));
}

/** How tightly a people holds what it has made (0 … 1), from its ways: its order and its tradition. */
export const heldOf = (hierarchy: number, tradition: number): number =>
  dmath.clamp(0.5 * hierarchy + 0.5 * tradition, 0, 1);

/** The share of a land's people who would go up into minds (0 … 1): as open as its ways are, its piety holding some back. */
export const wouldGoUp = (openness: number, piety: number): number =>
  dmath.clamp(openness - 0.35 - 0.5 * Math.max(0, piety - 0.5), 0, 0.9);

/** Those of a land's people who go up this year: a share of those who would and have not yet. */
export function goingUpOf(people: number, would: number, gone: number): number {
  const left = Math.max(0, would - gone);
  return Math.floor(Math.max(0, people) * BEYOND.goingUp * left);
}

// —— Spun habitats ———————————————————————————————————————————————————————————————————————————————————
// A people with works in the sky, halls it knows how to build and fibres strong enough to spin them, hollows its belt's rock
// into wheels turning for their weight: as many live in them as their rock shields and their light keeps (est: some 500 t
// of rock a person against the rays, some 10 kW a person for light, air and food). Their numbers grow of themselves, and
// by those who go up from the realm's lands while there is room. They are no land of the world: their holding is a
// number on the works' row.

export const HABITAT = {
  /** Tonnes of the works' rock a person living in it takes, and kW a person (est). */
  tonnes: 500,
  kw: 10,
  /** The share of a works' weight hollowed for living in (est). */
  share: 0.5,
  /** What a works' own engines give, kW a tonne of it, where no mirrors light it (est). */
  ownKwPerT: 0.01,
  /** Their growth of themselves a year, and the share of the realm's people who go up a year while there is room (est). */
  growth: 0.008,
  moving: 0.001,
} as const;

/** How many can live in a works' habitats: by its rock and by its light (kW), the less of the two. */
export function skyRoom(tonnes: number, kw: number): number {
  const h = HABITAT;
  return Math.floor(Math.min((Math.max(0, tonnes) * h.share) / h.tonnes, Math.max(0, kw) / h.kw));
}

/** A year of the habitats: their own growth, and those who come up from the realm while there is room (no more than room). */
export function skyYear(
  sky: number,
  room: number,
  realmPeople: number,
): { readonly sky: number; readonly came: number } {
  const h = HABITAT,
    grown = Math.min(room, Math.floor(sky * (1 + h.growth))),
    came = Math.max(0, Math.min(room - grown, Math.floor(Math.max(0, realmPeople) * h.moving)));
  return { sky: grown + came, came };
}

// —— Uplift ————————————————————————————————————————————————————————————————————————————————————————————
// A people that writes bodies and writes words may raise a beast of its world to thought: it writes the beast's young a
// larger, longer-growing brain and teaches them. Which beast is the one whose body already leans that way (est from what
// selects for minds on Earth: warm blood, a body big enough to carry a brain, a life lived in herds, hands, the hunt). The
// raised people's ways are what that body makes of them: a herd's kinship and order, a hunter's valour, a tame beast's
// tradition. A few thousand at first, once in some centuries a realm at most.

export const UPLIFT = {
  /** Those raised at first (est: a people's least lasting number, as COLONISTS). */
  founders: 2000,
  /** Years between one realm's raisings at the least, and a year's chance a realm able to does (est). */
  gapYears: 300,
  chance: 0.01,
  /** The lightest and heaviest beasts a mind can be written into (kg, est). */
  leastKg: 3,
  mostKg: 3000,
} as const;

/** A beast's body as the uplift reads it. */
export type UpliftBeast = {
  readonly size: number;
  readonly herd: number;
  readonly docility: number;
  readonly level: number;
  readonly warm: boolean;
  readonly arms: number;
};

/** How far a beast's body leans toward a mind (0: none can be raised). */
export function upliftScore(b: UpliftBeast): number {
  const k = UPLIFT;
  if (b.size < k.leastKg || b.size > k.mostKg || b.level < 2) return 0;
  const big = dmath.clamp(dmath.log10(b.size) / 3, 0.1, 1);
  return (
    (b.warm ? 1 : 0.4) *
    big *
    (0.5 + dmath.clamp(b.herd, 0, 1)) *
    (b.arms > 0 ? 1.5 : 1) *
    (b.level >= 3 ? 1.2 : 1)
  );
}

/**
 * The raised people's ways, in rules/ways.ts WAY_TRAITS order (kinship, hierarchy, piety, valour, trade, openness,
 * tradition, thrift), from the beast's body: a herd's kinship and order, a hunter's valour, a tame beast's tradition.
 */
export function upliftWays(b: UpliftBeast): number[] {
  const herd = dmath.clamp(b.herd, 0, 1),
    tame = dmath.clamp(b.docility, 0, 1),
    hunter = b.level >= 3 ? 1 : 0,
    big = dmath.clamp(dmath.log10(Math.max(1, b.size)) / 3, 0, 1);
  return [
    0.3 + 0.5 * herd,
    0.25 + 0.35 * herd * big + 0.1 * hunter,
    0.5,
    0.35 + 0.35 * hunter,
    0.4 - 0.1 * hunter,
    0.7 - 0.4 * tame,
    0.3 + 0.4 * tame,
    0.4 + 0.2 * (1 - hunter),
  ].map((x) => dmath.clamp(x, 0, 1));
}
