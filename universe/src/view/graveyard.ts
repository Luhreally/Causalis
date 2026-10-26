// A town's dead and their burying (Phase 43 M205; asked for 2026-10-25: "...work on bringing back
// og causlisis like town/country game play and sim like the depth the og game had ... and just
// actions of stuff yk"). Classic kept a graveyard by every village and laid its dead in it; here a
// town's stands just past its homes, walled, its gate toward the town, row on row of graves — its
// share of its land's dead since it was founded, the oldest nearest the gate and the rows running
// back as they fill (full, the oldest dug again). Its dead of the year are buried on the days they
// fall, as many as its share of its land's dead last year — the same days for the same town and
// year; the watched households' dead by name, from their own homes; the rest from any of its
// homes — and those a fire or a quake killed two days after it, borne from its square together —
// and a battle's fallen, from its square at two, two days after it was fought before the town or
// four where they are brought home (Phase 55 M225). Each funeral leaves at ten, its dead on a bier
// borne by four, to a grave dug that morning and filled after. Pure: a town's plan gives the same
// funerals and the same graves.
import { finish, hashString, mix } from "../kernel/index.ts";
import type { VillagePlan, VillageRest, WarRest } from "../bridge/index.ts";

const DAY = 86_400,
  HOUR = 3_600;

type Point = { readonly x: number; readonly z: number };

/**
 * How a graveyard's plots lie (metres): so many across a section of it, each so wide and deep; a
 * path up each section's middle and along its front, inside its gate; its rim inside its wall.
 */
// (Sized as the town's folk are drawn, a head taller than its houses' doors.)
export const PLOT = { across: 12, wide: 3.4, deep: 5, path: 3, rim: 3 } as const;
/** How wide a section of plots is, its path up its middle with it. */
export const SECTION_W = PLOT.across * PLOT.wide + PLOT.path;
/** The most rows a graveyard runs back, and the most sections side by side: full, the oldest graves are dug again. */
export const MOST_ROWS = 24;
export const MOST_SECTIONS = 4;
/** A great town's graveyard keeps so many years of its dead before the oldest graves are dug again (a little one's, a section's rows at least). */
export const KEPT_YEARS = 4;
/** The most biers borne at once (those a strike killed: the rest laid with them). */
export const MOST_BIERS = 6;
/** The most funerals a town keeps on a day (a great city's: the rest of its dead buried with them). */
export const MOST_A_DAY = 6;
/**
 * A funeral's hours (seconds into its day, or long): it leaves at ten, gathered half an hour
 * before; its grave dug from half past seven; they stand at it a while, the dead lowered in after
 * a little; the grave filled after. Those a strike killed are buried two days on, at two.
 */
export const FUNERAL = {
  leaves: 10 * HOUR,
  gather: 30 * 60,
  dig: 7.5 * HOUR,
  stand: 25 * 60,
  lowered: 8 * 60,
  fill: 40 * 60,
  struckAfter: 2 * DAY,
  struckLeaves: 14 * HOUR,
} as const;

/** A town's graveyard: its gate's middle (metres), the way its rows run back from the town, its rows, its sections side by side, its size and its middle. */
export type Graveyard = {
  readonly gate: Point;
  /** Radians: back along x = cos, z = sin. */
  readonly way: number;
  readonly rows: number;
  readonly sections: number;
  readonly w: number;
  readonly d: number;
  readonly x: number;
  readonly z: number;
};

/**
 * A graveyard opening at `gate` and running back along `way`: room for the `graves` it holds and
 * a year's more at `perYear` — no more than its dead of KEPT_YEARS years, a section's rows at
 * least — in sections side by side, as near square as they go.
 */
export function graveyardAt(gate: Point, way: number, graves: number, perYear = 0): Graveyard {
  const room = Math.max(
      1,
      Math.min(graves + perYear + 8, Math.max(MOST_ROWS * PLOT.across, perYear * KEPT_YEARS)),
    ),
    // (As near square as it goes: a section's width to so many rows' depth.)
    square = Math.round(Math.sqrt((room * PLOT.deep) / (PLOT.across * SECTION_W))),
    sections = Math.max(
      1,
      Math.min(MOST_SECTIONS, Math.max(square, Math.ceil(room / (MOST_ROWS * PLOT.across)))),
    ),
    rows = Math.max(3, Math.min(MOST_ROWS, Math.ceil(room / (sections * PLOT.across)))),
    w = sections * SECTION_W + 2 * PLOT.rim,
    d = PLOT.path + rows * PLOT.deep + 2 * PLOT.rim;
  return {
    gate,
    way,
    rows,
    sections,
    w,
    d,
    x: gate.x + (Math.cos(way) * d) / 2,
    z: gate.z + (Math.sin(way) * d) / 2,
  };
}

/** A point of a graveyard by its own frame: `u` across from its middle line, `v` back from its gate (metres). */
export function yardPoint(g: Graveyard, u: number, v: number): Point {
  const c = Math.cos(g.way),
    s = Math.sin(g.way);
  return { x: g.gate.x + v * c - u * s, z: g.gate.z + v * s + u * c };
}

/** How many graves a graveyard holds before the oldest are dug again. */
export function plotsOf(g: Graveyard): number {
  return g.rows * g.sections * PLOT.across;
}

/** The middle of each section of a graveyard, across its frame (metres from its middle line): its path runs back there. */
export function sectionsOf(g: Graveyard): number[] {
  return Array.from({ length: g.sections }, (_, s) => (s - (g.sections - 1) / 2) * SECTION_W);
}

/**
 * Where the k-th grave dug in it since the town was founded lies: row on row back from the path
 * inside its gate, each row across all its sections before the next, a path up each section's
 * middle.
 */
export function plotAt(g: Graveyard, k: number): Point {
  const per = g.sections * PLOT.across,
    cap = g.rows * per,
    slot = ((k % cap) + cap) % cap,
    row = Math.floor(slot / per),
    c = slot % per,
    section = Math.floor(c / PLOT.across),
    col = c % PLOT.across,
    u =
      (section - (g.sections - 1) / 2) * SECTION_W +
      (col - (PLOT.across - 1) / 2) * PLOT.wide +
      (col >= PLOT.across / 2 ? PLOT.path / 2 : -PLOT.path / 2),
    v = PLOT.rim + PLOT.path + PLOT.deep / 2 + row * PLOT.deep;
  return yardPoint(g, u, v);
}

/**
 * A funeral: from where it leaves — one of the town's watched homes (its place in the plan's
 * homes), its square (-1: those a strike killed), or another of its homes standing (-2: `pick`
 * of the way through them) — when it leaves, its first grave (one for each it buries), how many it
 * buries and on how many biers they are borne, the strike that killed them (its event), if one
 * did; and who it buries, where they are known by name.
 */
export type Funeral = {
  readonly key: string;
  readonly home: number;
  readonly pick: number;
  readonly leaves: number;
  readonly plot: number;
  readonly dead: number;
  readonly biers: number;
  readonly struck: string | null;
  readonly name: string | null;
  readonly age: number | null;
  /** A battle's fallen (Phase 55 M225): the battle, in words, and those of them known by name. Its `struck` is null. */
  readonly war?: WarRest;
};

const unit = (h: number) => (h >>> 0) / 4294967296,
  draw = (seed: number, a: number, b: number) => unit(finish(mix(mix(seed, a), b), 41));

/**
 * The day of a year (1 … 20) a watched household's dead of the year before is buried on, in the
 * first weeks after the year's turn tells them dead; at a quarter to eleven.
 */
function namedDay(
  seed: number,
  n: { readonly name: string; readonly home: number },
  year: number,
): number {
  return 1 + Math.floor(draw(seed, hashString(`${n.name}|${n.home}`), year + 3) * 20);
}
const NAMED_LEAVES = FUNERAL.leaves + 0.75 * HOUR;

const YEARS = new WeakMap<VillagePlan, readonly Funeral[]>();

/**
 * The funerals of a town's year (the year its graves were counted to), in the order they leave:
 * the watched households' dead of the year each on its own day, from their home; the rest as its
 * rate falls on each day (a town drawn lot by lot, from any of its homes); and each strike's dead
 * two days after it.
 */
export function funeralsOf(plan: VillagePlan): readonly Funeral[] {
  const rest = plan.rest;
  if (!rest || !plan.homes.length) return [];
  const known = YEARS.get(plan);
  if (known) return known;
  const year = rest.year,
    first = year * 365,
    named = namedFunerals(plan),
    perDay = Math.max(0, rest.perYear) / 365,
    whole = Math.floor(perDay),
    many = !!plan.town,
    list: Omit<Funeral, "plot">[] = [];
  for (let d = 0; d < 365; d++) {
    const n = Math.min(MOST_A_DAY, whole + (draw(plan.seed, year, d) < perDay - whole ? 1 : 0));
    for (let i = 0; i < n; i++)
      list.push({
        key: `${year}:${d}:${i}`,
        home: many ? -2 : Math.floor(draw(plan.seed, d * 31 + i, year + 7) * plan.homes.length),
        pick: draw(plan.seed, d * 31 + i, year + 11),
        leaves: (first + d) * DAY + FUNERAL.leaves + i * 1.5 * HOUR,
        dead: 1,
        biers: 1,
        struck: null,
        name: null,
        age: null,
      });
  }
  for (const n of named) {
    const d = namedDay(plan.seed, n, year);
    list.push({
      key: `named:${n.name}:${n.home}`,
      home: n.home,
      pick: 0,
      leaves: (first + d) * DAY + NAMED_LEAVES,
      dead: 1,
      biers: 1,
      struck: null,
      name: n.name,
      age: n.age,
    });
  }
  for (const k of plan.town?.struck ?? []) {
    const dead = k.dead ?? 0,
      day = Math.floor((k.at + FUNERAL.struckAfter) / DAY);
    if (dead <= 0 || day < first || day >= first + 365) continue;
    list.push({
      key: `struck:${k.event}`,
      home: -1,
      pick: 0,
      leaves: day * DAY + FUNERAL.struckLeaves,
      dead,
      biers: Math.min(dead, MOST_BIERS),
      struck: k.event,
      name: null,
      age: null,
    });
  }
  // A battle's fallen (Phase 55 M225): borne from the square together on the day they are buried.
  for (const w of rest.war ?? []) {
    const day = Math.floor(w.at / DAY);
    if (w.dead <= 0 || day < first || day >= first + 365) continue;
    list.push({
      key: `war:${w.event}`,
      home: -1,
      pick: 0,
      leaves: w.at,
      dead: w.dead,
      biers: Math.min(w.dead, MOST_BIERS),
      struck: null,
      name: null,
      age: null,
      war: w,
    });
  }
  list.sort((a, b) => a.leaves - b.leaves || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  let plot = gravesBefore(plan);
  const out = list.map((f) => {
    const g = { ...f, plot };
    plot += f.dead;
    return g;
  });
  YEARS.set(plan, out);
  return out;
}

/**
 * The watched households' dead buried this year: those of the year just ended (the year's turn
 * tells who of them died in it — seen alive through it, they are buried in the first weeks of
 * the next), from their homes.
 */
function namedFunerals(plan: VillagePlan): VillageRest["named"] {
  const rest = plan.rest;
  if (!rest) return [];
  return rest.named.filter((d) => d.year === rest.year - 1 && d.home < plan.homes.length);
}

/** How many graves a town's graveyard holds as its year begins (the year's named dead and its war dead, though counted, not yet among them). */
export function gravesBefore(plan: VillagePlan): number {
  const rest = plan.rest;
  return rest ? Math.max(0, rest.graves - namedFunerals(plan).length - warDeadOf(plan)) : 0;
}

/** The fallen its war funerals bury this year: counted with its graves (its land's dead of last year), not yet in them as its year begins. */
function warDeadOf(plan: VillagePlan): number {
  const rest = plan.rest;
  if (!rest?.war) return 0;
  const first = rest.year * 365;
  let dead = 0;
  for (const w of rest.war) {
    const day = Math.floor(w.at / DAY);
    if (w.dead > 0 && day >= first && day < first + 365) dead += w.dead;
  }
  return dead;
}

/** Whether a town buries those a fire or a quake killed, or a battle's fallen, on a day (its square kept for them that day: no market, no feast). */
export function buryingDay(
  plan: Pick<VillagePlan, "town"> & { readonly rest?: VillageRest },
  day: number,
): boolean {
  return (
    !!plan.town?.struck?.some(
      (k) => (k.dead ?? 0) > 0 && Math.floor((k.at + FUNERAL.struckAfter) / DAY) === day,
    ) || !!plan.rest?.war?.some((w) => w.dead > 0 && Math.floor(w.at / DAY) === day)
  );
}

/** The funerals leaving on a day (days since the world began). */
export function funeralsOn(plan: VillagePlan, day: number): readonly Funeral[] {
  return funeralsOf(plan).filter((f) => Math.floor(f.leaves / DAY) === day);
}

/**
 * The watched households' dead and the graves they lie in — the year each died, how old — and when
 * each was laid there (world seconds): those of the years before buried in the first weeks of the
 * year after, among the first of its graves; last year's, by their funerals this year (not yet
 * buried while it is earlier).
 */
export function namedGraves(plan: VillagePlan): {
  readonly plot: number;
  readonly name: string;
  readonly year: number;
  readonly age: number;
  readonly buried: number;
}[] {
  const rest = plan.rest;
  if (!rest) return [];
  const out: ReturnType<typeof namedGraves> = [],
    taken = new Set<number>(),
    per = Math.max(1, rest.perYear),
    base = gravesBefore(plan);
  for (const n of rest.named) {
    if (n.year >= rest.year - 1 || base <= 0) continue;
    // (Buried the year after they died: its graves so many years' dead back from the last dug
    // as this year began; on their day of it, so far into them.)
    const year = n.year + 1,
      d = namedDay(plan.seed, n, year),
      from = Math.max(0, base - Math.ceil((rest.year - year) * per));
    let plot = Math.min(base - 1, from + Math.floor((d / 365) * per));
    for (let k = 0; k < base && taken.has(plot); k++) plot = (plot + 1) % base;
    if (taken.has(plot)) continue;
    taken.add(plot);
    out.push({
      plot,
      name: n.name,
      year: n.year,
      age: n.age,
      buried: (year * 365 + d) * DAY + NAMED_LEAVES,
    });
  }
  for (const f of funeralsOf(plan))
    if (f.name !== null)
      out.push({
        plot: f.plot,
        name: f.name,
        year: rest.year - 1,
        age: f.age ?? 0,
        buried: f.leaves,
      });
  // A battle's fallen known by name, in the first of the graves their funeral digs.
  for (const f of funeralsOf(plan))
    if (f.war)
      f.war.named.slice(0, f.dead).forEach((n, i) =>
        out.push({
          plot: f.plot + i,
          name: n.name,
          year: rest.year - 1,
          age: n.age,
          buried: f.leaves,
        }),
      );
  return out.sort((a, b) => a.plot - b.plot);
}
