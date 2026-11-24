// Canals (the breadth round's "canals and built waterways"). A horse draws a tonne or two in a cart on a road and
// thirty to fifty in a barge on still water, so goods go by a dug waterway at about what they go by a river. A
// realm digs one between two of its lands where what the trade already passing between them would save, over the
// years a realm counts on, is more than the work of digging: so many hands a kilometre of cut, more for every lock
// the ground's rise asks, each hand fed and taken from other work for the years it digs. It needs water at one end
// to fill it, and hands enough to dig it in the years a realm will dig for. Pure tables and functions:
// sim/economy/canals.ts keeps which roads have one.
export const CANAL = {
  /** What carrying costs along a canal against the road beside it (a river's share: sim/economy edges). */
  carries: 0.6,
  /** Person-years to dig a kilometre of cut on level ground (est: the Erie's some 120, the Midi's nearer 300). */
  digPerKm: 200,
  /** A lock lifts a barge some three metres, and costs as much as a kilometre and a half of cut (est). */
  lockRise: 3,
  lockWork: 300,
  /** A digger is fed a person's year of grain and his hands are missed from the fields for it: grain for each person-year. */
  keep: 2,
  /** The years of saving a realm counts a canal's worth over (est: a generation). */
  horizon: 30,
  /** The share of its people a realm can set to digging, and the most years it will dig for (est). */
  hands: 0.02,
  years: 15,
  /** A realm weighs its roads for one every so many years. */
  every: 10,
} as const;

/** The work of digging a canal: its length of cut and a lock for each rise of the ground (person-years). */
export function canalWork(km: number, climb: number): number {
  return Math.max(0, km) * CANAL.digPerKm + (Math.max(0, climb) / CANAL.lockRise) * CANAL.lockWork;
}

/** What a canal saves a year of what the road's trade pays in carrying (grain). */
export function canalSaves(haul: number): number {
  return Math.max(0, haul) * (1 - CANAL.carries);
}

export type CanalWeighed = {
  /** Whether it is dug. */
  readonly dig: boolean;
  /** The work (person-years), what it costs (grain), and what it saves over the years counted (grain). */
  readonly work: number;
  readonly cost: number;
  readonly saved: number;
  /** The years its diggers would take. */
  readonly years: number;
  /** Why not, where it is not dug. */
  readonly why: string | null;
};

/**
 * Whether a realm digs a canal between two of its lands: what the trade saved over the years it counts on against
 * the work of digging (its length, the rise between its ends, its diggers' keep), with water to fill it and hands
 * enough.
 */
export function weighCanal(i: {
  /** Kilometres between the two lands, and the rise between them (m). */
  readonly km: number;
  readonly climb: number;
  /** What the trade passing between them paid in carrying last year (grain). */
  readonly haul: number;
  /** The realm's people. */
  readonly people: number;
  /** Whether a river or a lake at either end can fill it. */
  readonly watered: boolean;
}): CanalWeighed {
  const work = canalWork(i.km, i.climb),
    cost = work * CANAL.keep,
    saved = canalSaves(i.haul) * CANAL.horizon,
    diggers = Math.max(0, i.people) * CANAL.hands,
    years = diggers > 0 ? work / diggers : Infinity,
    why = !i.watered
      ? "no river or lake at either end to fill it"
      : saved <= cost
        ? "the trade passing would not save the work of digging"
        : years > CANAL.years
          ? "too few hands to dig it in the years a realm will dig for"
          : null;
  return { dig: why === null, work, cost, saved, years, why };
}
