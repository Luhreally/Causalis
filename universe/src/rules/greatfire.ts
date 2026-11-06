// The greatest fire (War past the line, W5; asked for 2026-11-05: "where are the missles and nukes", and of it: "make it
// high stakes that everyone feels like real life"). The rule: the greater the fire, the rarer it falls and the more everyone
// feels it. What it is here is what it does, as any encyclopedia tells it: the ground it makes deadly (the one sum of
// rules/reach.ts), what the wind carries, the soot of what burned and the cold years under it, what a strike back would cost. Its
// strength is one game number, an estimate; how such a thing is made is no part of this game. It is not the top of any ladder: past
// it energy keeps going, to what would unmake a world, and a page sets that number beside it. Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { meansOf, type MeansWorld } from "./means.ts";
import { LOT_M2, deadlyGround, firstRocket, hitShare, liftingEngine, townRadius } from "./reach.ts";

/** The principle a people must know. */
export const FIRE_ID = "greatest-fire";

export const FIRE = {
  /** What one brings to its target (MJ): one game number, an estimate. Some 16,000 lots flat on the rule's sum, a great city's heart. */
  mj: 4.2e8,
  /** The least of its star's metals (against the Sun's) at which a world's ground holds its densest store within reach (est). */
  leastMetals: 0.5,
  /** How far past what it flattens its fire reaches (est: Earth's towns burned far past their heaviest blast), and how many of those in that ground die (est). */
  fireReach: 3,
  kills: 0.5,
  /** The most of a town one can take (est: some always live). */
  mostGone: 0.9,
  /** How long what it made flat lies before anyone builds there (years, est: a ruined heart is cleared and rebuilt in a decade or so; a rocket's ash lies 3). */
  ashYears: 12,
  /** Years a great works takes, and what it takes of the realm's machines, iron and fuel in each of them (est). */
  worksYears: 12,
  worksShare: 0.04,
  /** Only a realm with this share of the machines of the world's richest can pay for one (est): a power among powers. */
  worksRich: 0.25,
  /** What holding them costs a year, of its machines (est). */
  keepShare: 0.002,
  /** At what a realm's reasons come to a start at most, a year (est). */
  worksChance: 0.04,
  /** How many it holds when its works are done, one more each so many years, at most this many (est). */
  everyYears: 8,
  mostLoads: 12,
  /** How badly a war must go for a holder before the world holds its breath (0 … 1, est), and how long after one the world has before the next: it does not hold its breath every year (years, est). */
  crisisLine: 0.5,
  crisisQuiet: 12,
  /** Two holders this deep at odds may come to the brink with no war between them, at most so often a year (est). */
  brinkHatred: 0.7,
  brinkChance: 0.012,
  /** At its height, the chance a ruler looses it (est): holding back is what the numbers usually say. */
  mostChance: 0.28,
  /** What of its people dead in a strike back frightens a ruler at 63 parts in a hundred (est). */
  fearAt: 0.004,
  /** How deep a first fall sets the dread, each more, the least it ever falls back to, and what is left of it each year: remembered for generations (est). */
  dreadFirst: 0.6,
  dreadMore: 0.15,
  dreadLeast: 0.25,
  dreadKept: 0.995,
  /** What each of a town's people burned out adds to the soot in the high air (est: what stands about a person is what burns), and what of it is left each year. */
  sootPerSoul: 1 / 1.5e6,
  sootKept: 0.62,
  /** Under soot told as dark years; degrees of cold at soot 1; what it takes of a land's rain and of its fields at soot 1 (est). */
  sootTold: 0.05,
  coldAt: 8,
  rainAt: 0.4,
  fieldsAt: 0.6,
  /** How many lands the wind carries it over, what of each land dies at the first (est), and how long fields lie sick at the first (years) and what they then yield. */
  windLands: 6,
  windDead: 0.01,
  sickYears: 4,
  sickFields: 0.5,
  /** How long a struck land's works stand idle (years, est). */
  worksDown: 12,
} as const;

/** The ground one makes flat, in lots (half of a town's ground is streets and yards). */
export const fireLots = (): number => deadlyGround(FIRE.mj) / (LOT_M2 * 2);

/** What one falling on a town does: pure, so a page and history reckon alike. */
export function greatFallOf(input: {
  readonly lots: number;
  readonly people: number;
  readonly miss: number;
}): {
  readonly landed: number;
  readonly flattened: number;
  readonly burned: number;
  readonly share: number;
  readonly dead: number;
} {
  const flat = fireLots(),
    groundR = dmath.pow((flat * LOT_M2 * 2) / Math.PI, 0.5),
    landed = hitShare(townRadius(input.lots) + groundR, input.miss),
    flattened = flat * landed,
    burned = flattened * FIRE.fireReach,
    share = input.lots > 0 ? Math.min(FIRE.mostGone, burned / input.lots) : 0;
  return {
    landed,
    flattened: Math.min(flattened, input.lots),
    burned: Math.min(burned, input.lots),
    share,
    dead: Math.round(share * input.people * FIRE.kills),
  };
}

/** Why a world's people can never have it (null: they can). Read off its numbers and not its kind. */
export type FireShut = "sea" | "ice" | "poor" | "carried" | null;
export function fireShutBy(w: MeansWorld): FireShut {
  if (w.medium === "water") return "sea";
  if (!w.rock) return "ice";
  if (w.metalShare < FIRE.leastMetals) return "poor";
  return !liftingEngine(w) && !firstRocket(w, meansOf(w).worksCharge?.mj) ? "carried" : null;
}

/** What it is called, from the point its people reached: by what it would be beside its own sun. */
export function fireName(w: Pick<MeansWorld, "sunWm2" | "kelvin">): string {
  if (w.sunWm2 < 400) return "the false dawn";
  if (w.sunWm2 < 1000) return "the second sun";
  return w.kelvin > 330 ? "the white noon" : "the sun brought down";
}

/** What it would take to unmake a world (MJ): its binding energy, 3 g² R³ / (5 G), by its pull and radius. Past this people's fire by far: W6's. */
export function unmakeMj(w: Pick<MeansWorld, "pull" | "radius">): number {
  const g = w.pull * 9.81,
    R = 6.371e6 * w.radius;
  return (3 * g * g * R * R * R) / (5 * 6.674e-11) / 1e6;
}

/** How many a holder holds, so many years after its works were done. */
export const loadsAfter = (years: number): number =>
  Math.min(FIRE.mostLoads, 1 + Math.max(0, Math.floor(years / FIRE.everyYears)));

/** How a war is going for one side, as its ruler reads it (0 … 1): battles lost over won, its own fallen, lands gone, and the foe at its seat. */
export function desperationOf(i: {
  readonly lost: number;
  readonly won: number;
  /** Its fallen in this war, of its people. */
  readonly fallen: number;
  /** Lands taken from it in this war, of what it held. */
  readonly gone: number;
  /** Whether nothing stands between the foe and its seat. */
  readonly seat: boolean;
}): number {
  const going = Math.max(0, i.lost - i.won) / Math.max(3, i.lost + i.won);
  return Math.min(
    1,
    0.45 * going +
      0.25 * Math.min(1, i.fallen / 0.02) +
      0.5 * Math.min(1, i.gone / 0.3) +
      (i.seat ? 0.4 : 0),
  );
}

/** What a strike back would frighten a ruler at (0 … 1), by the share of their people it would kill. */
export const fearOf = (share: number): number => 1 - dmath.exp(-share / FIRE.fearAt);

/**
 * The chance a ruler looses it, once they stand at the brink: how badly it goes, their people's ways, what a strike back would
 * cost, and how the world has come to dread it. No number here says "if they both hold it": fear of the answer does that.
 */
export function chanceOfFall(i: {
  readonly desperation: number;
  readonly valour: number;
  readonly fear: number;
  readonly dread: number;
}): number {
  const held = (1 - i.fear) * (1 - i.dread);
  return FIRE.mostChance * i.desperation * (0.4 + 0.6 * i.valour) * held * held;
}

/** How much less likely a war on a realm is, by what that realm's answer would cost (1: not at all). */
export const holdBackBy = (fear: number): number => (1 - fear) * (1 - fear);

/** What a realm's reasons come to, to begin a great works: hatred, a stronger rival, a rival who holds it, a war now. */
export function worksChance(i: {
  readonly hatred: number;
  /** Its strongest rival's strength against its own. */
  readonly ratio: number;
  readonly rivalHolds: boolean;
  readonly atWar: boolean;
  readonly dread: number;
}): number {
  const reasons =
    Math.min(1, i.hatred) * Math.min(1.5, i.ratio) + (i.rivalHolds ? 1 : 0) + (i.atWar ? 0.3 : 0);
  return FIRE.worksChance * Math.min(1, reasons / 2) * (1 - i.dread * 0.5);
}

/** What soot does, year by year: pure. Exactly nothing at none. */
export const coldDegrees = (soot: number): number => soot * FIRE.coldAt;
export const rainUnder = (soot: number): number => 1 - FIRE.rainAt * Math.min(1, soot);
export const fieldsUnder = (soot: number): number => 1 - FIRE.fieldsAt * Math.min(1, soot);
export const sootOfBurned = (people: number): number => people * FIRE.sootPerSoul;

/** The least a year of crisis reads. */
const SHADOW_IN_CRISIS = 50;

/**
 * How near the world stands (0 … 100): a reading of who holds it, who is at odds, how a war between them is going. Nothing
 * is kept for it. No one holding: nothing.
 */
export function shadowOf(i: {
  readonly holders: number;
  readonly atOdds: number;
  /** Wars with a holder in them, and those going badly for one (its worst going, 0 … 1). */
  readonly wars: number;
  readonly worst: number;
  readonly crises: number;
  readonly dread: number;
}): number {
  if (i.holders <= 0 && i.crises <= 0) return 0;
  const read =
    8 +
    4 * Math.min(5, i.holders) +
    8 * Math.min(4, i.atOdds) +
    4 * Math.min(3, i.wars) +
    25 * i.worst +
    (i.crises > 0 ? 40 : 0) -
    10 * i.dread;
  // (A year the whole world holds its breath reads as one, however much a first fall has taught them.)
  return Math.round(Math.max(i.crises > 0 ? SHADOW_IN_CRISIS : 0, Math.min(100, read)));
}
