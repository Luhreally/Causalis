// Bodies written and parts replaced, at home (the breadth gaps, 2026-11-24: "engineered bodies and cyborgs"; the rules are
// rules/beyond.ts rewritable, replaceable, bodyLimits, engineeredDeaths). A land whose people write and grow their bodies
// (made-bodies) writes a share of its children a generation: what it knows of the body (its lore of health) by what it can
// spare to pay for it (the share of its work its engines do); one that makes minds gives a share of its people made parts,
// by what its engines spare alone. What either gains is read off the people's own life table: a written child is spared
// its first years' frailty, a written or mended body its wearing out. Read each reckoning from what the land knows, since
// when, and what it turns: nothing is kept. Once this was a flag: a land that knew made-bodies bore 0.95 of all its bodies
// could, and its settlers' bodies bent three-tenths a generation of twenty-five years, whatever it knew or could pay.
import { dmath, yearOfMoment, type World } from "../../kernel/index.ts";
import {
  engineeredDeaths,
  replaceable,
  rewritable,
  riskUnder,
  writtenAfter,
  type LifeHistory,
} from "../../rules/index.ts";
import { sparedShare } from "../economy/energy.ts";
import { loreOf } from "../lore/lore.ts";

/** Of the work a land turns, the share its engines and its current do, not its bodies, its beasts or its old mills: what it can spare. */
export function sparedWork(world: World, cell: number): number {
  const r = sparedShare(world, cell);
  return r === null ? 0 : dmath.clamp(r, 0, 1);
}

export type Engineered = {
  /** Of its people, the share written, and the share who carry made parts (0 … 1 each). */
  readonly written: number;
  readonly replaced: number;
  /** Of its children, the share written a generation now; of its people, the share given made parts a generation. */
  readonly writes: number;
  readonly replaces: number;
  /** What that does to each band's deaths (x), and its people's life table so. */
  readonly deaths: readonly number[];
  readonly life: LifeHistory;
};

// (Each band's deaths and the table so, by how far written and mended, to a hundredth: read once a life table.)
const BY = new Map<LifeHistory, Map<number, { deaths: number[]; life: LifeHistory }>>();
function gainOf(life: LifeHistory, written: number, replaced: number) {
  let by = BY.get(life);
  if (!by) {
    if (BY.size > 16) BY.clear();
    BY.set(life, (by = new Map()));
  }
  const w = Math.round(written * 100),
    r = Math.round(replaced * 100),
    key = w * 101 + r;
  let g = by.get(key);
  if (!g) {
    const deaths = engineeredDeaths(life, w / 100, r / 100);
    g = {
      deaths,
      life: { ...life, mortality: life.mortality.map((x, b) => riskUnder(x, deaths[b]!)) },
    };
    by.set(key, g);
  }
  return g;
}

/**
 * (vitalMonth's: each land's reading while its births and deaths are read, kept for the month's own second asking through
 * transition. Nothing it reads, what the land knows, its year, the work its engines spare, moves within those; other
 * systems of the same moment, which may, are not kept.)
 */
let MONTH_KEPT: Map<
  number,
  { life: LifeHistory; generation: number; made: Engineered | null }
> | null = null;
/** Keep each land's reading while `read` runs (see MONTH_KEPT). */
export function engineeredKept<T>(read: () => T): T {
  const was = MONTH_KEPT;
  MONTH_KEPT = new Map();
  try {
    return read();
  } finally {
    MONTH_KEPT = was;
  }
}

/**
 * How far a land's people are written and mended, and what it gains them (null: a land that neither writes bodies nor makes
 * minds, as every land of our own ages is).
 */
export function engineeredOf(
  world: World,
  cell: number,
  life: LifeHistory,
  generation: number,
): Engineered | null {
  const kept = MONTH_KEPT?.get(cell);
  if (kept && kept.life === life && kept.generation === generation) return kept.made;
  const made = engineeredRead(world, cell, life, generation);
  MONTH_KEPT?.set(cell, { life, generation, made });
  return made;
}

function engineeredRead(
  world: World,
  cell: number,
  life: LifeHistory,
  generation: number,
): Engineered | null {
  const lore = loreOf(world),
    bodies = lore.get(cell, "made-bodies"),
    minds = lore.get(cell, "machine-minds");
  if (!bodies && !minds) return null;
  const year = yearOfMoment(world.now),
    pays = sparedWork(world, cell),
    writes = bodies ? rewritable(lore.effect(cell, "health"), pays) : 0,
    replaces = replaceable(!!minds, pays),
    written = bodies ? writtenAfter(year - bodies.year, writes, generation) : 0,
    replaced = minds ? writtenAfter(year - minds.year, replaces, generation) : 0;
  if (!(written > 0) && !(replaced > 0)) return null;
  return { written, replaced, writes, replaces, ...gainOf(life, written, replaced) };
}
