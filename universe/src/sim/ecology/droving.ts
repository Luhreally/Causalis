// Seasonal herding, land by land (rules/droving.ts): once in five years, in its turn, a herding land's herders weigh driving
// their flocks to the neighbouring pasture that would give them the most; where it pays, the land's herds yield the more
// (`droveGain`, read where a land's meat is made and its herders' wage reckoned). One row a land that drives its flocks away.
import {
  YEAR,
  defineEventType,
  yearOfMoment,
  type Factor,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { offworldSite } from "../../gen/index.ts";
import {
  DROVE,
  GROWS_ABOVE,
  OCC,
  PRODUCTIVITY,
  droveWorth,
  drovePays,
  shareAbove,
} from "../../rules/index.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import { DROVE_ROW, DROVE_STORE, cultureRows } from "../culture/rows.ts";
import { kmBetween } from "../economy/sea.ts";

export const DROVE_EVENTS = {
  /** A land's herders take up driving their flocks to a neighbour's pasture for its season (or, `ended`, leave off). */
  taken: defineEventType("ecology.droving", 3),
};

/** How much more a land's herds yield for the away pasture its herders drive them to (1 where they stay). */
export function droveGain(world: World, cell: number): number {
  const g = cultureRows(world, DROVE_STORE)?.at(cell, DROVE_ROW.gain) ?? 0;
  return g > 0 ? g / 1000 : 1;
}

/** Where a land's herders drive their flocks, and since when (null where they stay). */
export function droveOf(
  world: World,
  cell: number,
): { to: number; since: number; gain: number } | null {
  const row = cultureRows(world, DROVE_STORE)?.get(cell);
  return row && row[DROVE_ROW.gain]! > 0
    ? { to: row[DROVE_ROW.to]!, since: row[DROVE_ROW.since]!, gain: row[DROVE_ROW.gain]! / 1000 }
    : null;
}

export function drovingYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    rows = cultureRows(world, DROVE_STORE);
  if (!rows) return;
  const year = yearOfMoment(t),
    yearDays = g.planet.yearDays,
    work = PRODUCTIVITY[OCC.herder]! * ctx.life.appetite;
  for (const p of ctx.provinces.all()) {
    if ((p.cell + year) % DROVE.every !== 0) continue;
    const was = rows.get(p.cell),
      herders = p.herding ? p.occupation(OCC.herder) : 0;
    if (herders <= 0 || offworldSite(g, p.cell)) {
      if (was) rows.drop(p.cell);
      continue;
    }
    const pasture = provinceCapacity(ctx, p.cell).pasture;
    let best: {
      cell: number;
      w: ReturnType<typeof droveWorth>;
      spare: number;
      grows: number;
    } | null = null;
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!,
        theirs = ctx.provinces.get(n),
        // (Its grazing as its own people were fed in its leanest month: a land in want, its pasture burnt by the drought that
        // starves it, is no summer's grass to drive a herd to. See migrateYear.)
        cap = provinceCapacity(ctx, n).pasture * ((theirs?.leanest ?? 1000) / 1000);
      if (!(cap > 0)) continue;
      const spare = cap - (theirs?.herding ? theirs.occupation(OCC.herder) * work : 0);
      if (!(spare > 0)) continue;
      const grows = shareAbove(g.climate.temperature[n]!, g.climate.seasonality[n]!, GROWS_ABOVE),
        w = droveWorth(
          pasture,
          herders * work,
          { spare, grows, km: kmBetween(g, p.cell, n) },
          yearDays,
        );
      if (!best || w.gain > best.w.gain) best = { cell: n, w, spare, grows };
    }
    if (!best || !drovePays(best.w.gain, !!was)) {
      if (was) {
        rows.drop(p.cell);
        world.events.emit({
          type: DROVE_EVENTS.taken.type,
          importance: 2,
          subjects: [p.ref],
          place: p.ref,
          causes: p.herding ? [{ ref: p.herding, role: "enabler", weight: 1 }] : [],
          data: { ended: true, years: year - was[DROVE_ROW.since]! },
        });
      }
      continue;
    }
    const next: number[] = [];
    next[DROVE_ROW.gain] = best.w.gain * 1000;
    next[DROVE_ROW.to] = best.cell;
    next[DROVE_ROW.since] = was ? was[DROVE_ROW.since]! : year;
    rows.set(p.cell, next);
    if (was) continue;
    const factors: Factor[] = [
        {
          name: "the neighbouring pasture its own herders leave ungrazed, for the season its grass stands",
          value: Math.round(best.grows * 100) / 100,
          contribution: best.w.gain - 1 + best.w.road,
          source: null,
        },
        {
          name: "the share of the year on the way there and back",
          value: Math.round(best.w.road * 1000) / 1000,
          contribution: -best.w.road,
          source: null,
        },
        {
          name: "how hard their own pasture is grazed",
          value: pasture > 0 ? Math.round(((herders * work) / pasture) * 100) / 100 : 0,
          contribution: 0,
          source: p.herding ? { ref: p.herding, role: "enabler", weight: 1 } : null,
        },
      ],
      decision = world.decisions.record({
        rule: "ecology.droving",
        subject: p.ref,
        outcome: { to: best.cell },
        score: best.w.gain - 1,
        threshold: DROVE.least,
        factors,
      });
    world.events.emit({
      type: DROVE_EVENTS.taken.type,
      subjects: [
        p.ref,
        ...(ctx.provinces.get(best.cell) ? [ctx.provinces.get(best.cell)!.ref] : []),
      ],
      place: p.ref,
      causes: [
        { ref: decision, role: "trigger", weight: 1 },
        ...(p.herding ? [{ ref: p.herding, role: "enabler" as const, weight: 0.5 }] : []),
      ],
      data: {
        to: best.cell,
        gain: Math.round((best.w.gain - 1) * 100),
        season: Math.round(best.grows * 100),
        days: Math.round(best.w.road * yearDays),
      },
    });
  }
}

export function installDroving(world: World, ctx: () => PopulationContext): void {
  world.system({ key: "117.herds.year.droving", every: YEAR, run: (t) => drovingYear(ctx(), t) });
}
