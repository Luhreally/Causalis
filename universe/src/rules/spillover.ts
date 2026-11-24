// Where sicknesses arise (the breadth round, 2026-11-23). A new sickness is a life of another kind's body, or of the water and
// the ground, that crosses into a people and goes on among them. So a land's yearly hazard of one is the crossings its people
// meet, each force by itself, times the share of crossings that go on among them before they go out:
// - beasts kept close: herds and flocks share their sicknesses with those who keep them, the more the nearer kin their bodies
//   (Wolfe, Dunavan and Diamond 2007: most of the old crowd sicknesses came from the herds; Olival et al. 2017: sicknesses are
//   shared the less the farther apart the hosts' kinds, so the crossing falls as the square of how alike their bodies are);
// - wild beasts hunted: those who hunt and butcher them meet their blood, the more the more kinds about and the fuller the wild
//   (Jones et al. 2008: new sicknesses rise where many people meet many wild kinds);
// - standing water and warmth: warm, wet ground breeds what carries a sickness (vermin, foul water), and both speed it, a
//   doubling for every ten degrees (the Q10 of the living), so a cold land breeds none; clean water and drains halve it;
// - and of every crossing, the share that goes on: most go out among the few they reach (Wolfe 2007's stages: a sickness of
//   beasts that passes from one person to a few, then stops). Some go on anywhere (those whose survivors are spared only a
//   while, or that linger); one whose survivors are spared for life goes on only in a community large enough that births bring
//   it new hosts as fast as it spares them, its critical community size (Bartlett 1957: about a quarter of a million for
//   measles): a land's own town and the towns its trade roads reach. So the crowd is no source of its own, but the most of
//   what a crossing needs to become a sickness of a people, and a rising is named for it where it weighed most;
// - the roads: a crossing that reaches a land on many trade roads is carried on before it can go out.
// Read off a land's facts and its people's body, never Earth's: a people of the water live in their standing water, and a herd
// of cold-blooded, scaled beasts shares little with a warm-blooded people. Pure functions; sim/health/health.ts sums them over
// a world's lands, draws where a new one rises, and names it for the force that led there.
import { dmath } from "../kernel/index.ts";

/** What a sickness's rising is weighed by. Rates are a land's yearly chance of a crossing at the full of each force. */
export const ARISE = {
  /** A land's yearly chance of a sickness crossing from its herds, at the full (herds of their own kin, many people). */
  herds: 3e-4,
  /** From the wild beasts its hunters take, at the full (all hunting, a full wild of many kinds of their own kin). */
  wild: 1.5e-4,
  /** From its warm standing water, at the full (hot, wet and standing, many people). */
  marsh: 1.8e-4,
  /** Of crossings, the share that goes on whatever the crowd; the rest go on as the community nears the critical size. */
  goes: 0.3,
  /** People in a land at which half the beasts' sicknesses that can reach them have (the pool is finite: so many kinds). */
  pool: 20000,
  /** The critical community size (Bartlett 1957, measles): the people a sickness that spares for life needs to go on. */
  ccs: 250000,
  /** Of a land's trade-linked towns, the share counted in its community (those who come and go between them). */
  linked: 0.25,
  /** Kinds of beast about a land at which its wild holds half the sicknesses it could. */
  kinds: 6,
  /** Warmth (°C) at which the living's pace is the reference, and how much it rises in ten degrees (Q10). */
  warm: 20,
  q10: 2,
  /** The coolest at which what carries a sickness in standing water breeds (°C), and how much warmer it is at the full. */
  breeds: 12,
  full: 12,
  /** Rain (mm) at which a land's ground is half as wet as it could be. */
  wet: 1000,
  /** How much clean water and drains take off the water's sicknesses. */
  clean: 0.5,
  /** Those who hunt where a people sow (the rest of their food from fields and flocks). */
  hunt: 0.2,
  /** How much more a crossing takes hold on a land with many trade roads, at the full, and the roads at half of it. */
  carried: 0.6,
  roads: 4,
} as const;

/** The forces a sickness rises by: beasts kept, wild beasts hunted, crowds, warm standing water. */
export const FORCES = ["herds", "wild", "crowds", "marsh"] as const;
export type Force = (typeof FORCES)[number];

/** What a land's people meet that a sickness can come of. */
export type Exposure = {
  /** Its people. */
  readonly people: number;
  /** Its greatest town, and the greatest towns of the lands its trade roads reach, summed. */
  readonly town: number;
  readonly linked: number;
  /** Its trade roads. */
  readonly roads: number;
  /** Whether its people keep herds, and how near kin those beasts are to them (0 … 1). */
  readonly herds: boolean;
  readonly herdKin: number;
  /** How far its people keep off their herds, their creed forbidding them (0 … 1; rules/taboo.ts). Absent: not at all. */
  readonly keptOff?: number;
  /** The share of its people who hunt (0 … 1), how full its wild is (1 as it was), how many kinds about, the nearest kin. */
  readonly hunt: number;
  readonly wild: number;
  readonly kinds: number;
  readonly wildKin: number;
  /** Its warmth (°C) and rain (mm); how much standing water it has about it (0 … 1); whether its people live in the water. */
  readonly warmth: number;
  readonly rain: number;
  readonly standing: number;
  readonly inWater: boolean;
  /** Whether it has drains and clean water. */
  readonly clean: boolean;
};

/**
 * A land's hazard, force by force, each its part of the total: herds, wild and marsh their crossings times the share that goes
 * on anywhere; crowds, all crossings times the more the crowd lets go on; each raised by the roads.
 */
export type Forces = Readonly<Record<Force, number>> & {
  /** How much the roads raise every force (1: none). */
  readonly carried: number;
  /** Of crossings, the share that goes on here (ARISE.goes … 1). */
  readonly goesOn: number;
  /** The land's yearly hazard: the forces summed. */
  readonly total: number;
};

/** The living's pace at a warmth, against the reference (Q10), between a fifth and twice. */
export function lifePace(warmth: number): number {
  return dmath.clamp(dmath.pow(ARISE.q10, (warmth - ARISE.warm) / 10), 0.15, 2);
}

/** A land's yearly hazard of a new sickness, force by force. */
export function ariseForces(e: Exposure): Forces {
  const people = Math.max(0, e.people),
    hosts = people / (people + ARISE.pool),
    pace = lifePace(e.warmth),
    community = Math.max(0, e.town) + ARISE.linked * Math.max(0, e.linked),
    breeds = dmath.clamp((e.warmth - ARISE.breeds) / ARISE.full, 0, 1.5),
    wet = e.inWater ? 1.5 : dmath.clamp((2 * e.rain) / (e.rain + ARISE.wet), 0, 1.5),
    herds = e.herds
      ? ARISE.herds *
        e.herdKin *
        e.herdKin *
        hosts *
        dmath.sqrt(pace) *
        (1 - dmath.clamp(e.keptOff ?? 0, 0, 1))
      : 0,
    wild =
      ARISE.wild *
      dmath.clamp(e.hunt, 0, 1) *
      dmath.clamp(e.wild, 0, 1.5) *
      (e.kinds / (e.kinds + ARISE.kinds)) *
      e.wildKin *
      e.wildKin *
      hosts *
      pace,
    marsh =
      ARISE.marsh *
      breeds *
      breeds *
      wet *
      dmath.clamp(e.standing, 0, 1) *
      hosts *
      (e.clean ? 1 - ARISE.clean : 1),
    carried = 1 + (ARISE.carried * e.roads) / (e.roads + ARISE.roads),
    crowd = (1 - ARISE.goes) * (community / (community + ARISE.ccs)),
    crossings = herds + wild + marsh,
    by = ARISE.goes * carried;
  return {
    herds: herds * by,
    wild: wild * by,
    marsh: marsh * by,
    crowds: crossings * crowd * carried,
    carried,
    goesOn: ARISE.goes + crowd,
    total: crossings * (ARISE.goes + crowd) * carried,
  };
}

/** The force that weighs most in a land's hazard (the first of FORCES at a tie). */
export function leadingForce(f: Forces): Force {
  let best: Force = FORCES[0];
  for (const x of FORCES) if (f[x] > f[best]) best = x;
  return best;
}

/** A people's body as kinship reads it. */
export type KinBody = {
  readonly warm: boolean;
  readonly symmetry: string;
  /** Its covering, in the body's or the beast's own word (skin, fur, wool, feathers, scales, shell, plates, slick). */
  readonly skin: string;
  /** Whether it lives in the water. */
  readonly water: boolean;
};

/** A covering's family: hair (bare skin of a warm body, fur, wool), feathers, scales, shell (shell, plates), slick. */
function coatOf(b: KinBody): string {
  if (b.skin === "fur" || b.skin === "wool" || (b.skin === "skin" && b.warm)) return "hair";
  if (b.skin === "skin" || b.skin === "slick") return "slick";
  if (b.skin === "plates") return "shell";
  return b.skin;
}

/**
 * How near kin a beast's body is to a people's (0.1 … 1), from what both bodies are: warm or cold blood weighs most (a sickness
 * must live at its host's warmth), then their covering, their symmetry, and whether both live in the water. Earth's people and
 * their cattle are 1; a people and a fish a quarter.
 */
export function bodyKin(people: KinBody, beast: KinBody): number {
  const alike =
    0.45 * (people.warm === beast.warm ? 1 : 0) +
    0.25 * (coatOf(people) === coatOf(beast) ? 1 : 0) +
    0.15 * (people.symmetry === beast.symmetry ? 1 : 0) +
    0.15 * (people.water === beast.water ? 1 : 0);
  return 0.1 + 0.9 * alike;
}
