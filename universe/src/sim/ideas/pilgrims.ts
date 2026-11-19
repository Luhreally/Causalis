// Pilgrimage (rules/ideas.ts PILGRIM): the going of those who hold a thing of the mind to the land where it began. One rule for a
// faith's seat and a school's: of a land's people who hold it, those who go in a year come of how devout they are (a faith: their
// piety; a school: those who read, and more where a body teaches) and how long the way is (half as many for each PILGRIM.half
// kilometres; a land with no road, no ship and no neighbour on the way sends none over the sea it cannot cross). Read once in
// PILGRIM.every years, one pass over the lands that hold anything: for each seat the sum, and its few greatest ways (for the
// land's roads to carry and the pages to tell). What they leave feeds the seat's town: its town draws the more (sim/population/
// urban.ts reads `pilgrimFeed`). A seat's first pilgrimage is told. Kept: one short record a seat that has one; nothing that
// grows with history. A people of the water goes by the sea's floor as its trade does: nothing here asks for land.
import {
  YEAR,
  defineEventType,
  yearOfMoment,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { PILGRIM, pilgrimsFeed, pilgrimsFrom } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { kmBetween } from "../economy/sea.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { readersOf } from "../lore/letters.ts";
import { loreOf } from "../lore/lore.ts";
import { taughtIn } from "../order/institutions-kept.ts";
import { schoolRef, schoolsOf } from "./kept.ts";
import { PilgrimsStore, pilgrimsOf } from "./pilgrims-kept.ts";

export const PILGRIM_EVENTS = {
  /** A seat's first pilgrimage: enough come in a year to be one. */
  began: defineEventType("ideas.pilgrimage", 4),
};

type Sum = { seat: number; event: Ref; pilgrims: number; lands: number; ways: [number, number][] };

/** The year's pilgrimages, read once in PILGRIM.every years. */
export function pilgrimsYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = pilgrimsOf(world),
    year = yearOfMoment(t);
  if (!store || year % PILGRIM.every !== 0 || !world.hasStore("belief.faiths")) return;
  const belief = beliefOf(world),
    schools = schoolsOf(world),
    culture = cultureOf(world),
    lore = loreOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    sums = new Map<Ref, Sum>(),
    // (A people of the water has no sea to cross. Of others, a land far from the seat sends pilgrims only where it has ships.)
    water = ctx.medium === "water",
    go = (of: Ref, seat: number, event: Ref, from: number, holders: number, devotion: number) => {
      if (from === seat || holders <= 0 || devotion <= 0) return;
      const km = kmBetween(g, from, seat);
      if (
        !water &&
        km > 1.5 * PILGRIM.half &&
        !(lore.effect(from, "ships") > 0) &&
        !markets.seaPartners(from).length
      )
        return;
      const n = pilgrimsFrom(holders, devotion, km);
      if (n <= 0) return;
      let s = sums.get(of);
      if (!s) sums.set(of, (s = { seat, event, pilgrims: 0, lands: 0, ways: [] }));
      s.pilgrims += n;
      s.lands++;
      s.ways.push([from, n]);
    };
  for (const p of ctx.provinces.all()) {
    const people = p.total();
    if (!people) continue;
    const b = belief.of(p.cell),
      f = b.faith ? belief.get(b.faith) : undefined;
    if (f && ctx.provinces.get(f.seat)?.total())
      go(f.ref, f.seat, f.event, p.cell, people, culture.get(p.cell)?.traits[WAY.piety] ?? 0);
    const h = schools?.of(p.cell),
      s = h ? schools!.get(h.school) : undefined;
    if (s && ctx.provinces.get(s.seat)?.total())
      go(
        schoolRef(s.id),
        s.seat,
        s.event,
        p.cell,
        people,
        // (Those who go to where a teaching began are those who read, and more where a body teaches: half of them at the most.)
        Math.min(0.5, 2 * readersOf(world, p.cell) + (taughtIn(world, p.cell) ? 0.05 : 0)),
      );
  }
  // What stands, moved; what no longer comes, let go; what is new, told.
  for (const p of store.all())
    if ((sums.get(p.of)?.pilgrims ?? 0) < PILGRIM.least / 4) store.drop(p.of);
  for (const [of, s] of [...sums].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (s.pilgrims < (store.get(of) ? PILGRIM.least / 4 : PILGRIM.least)) continue;
    const ways = s.ways.sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, PILGRIM.ways),
      feed = Math.round(1000 * pilgrimsFeed(s.pilgrims, ctx.provinces.get(s.seat)?.total() ?? 0)),
      was = store.get(of);
    if (was) {
      was.pilgrims = s.pilgrims;
      was.lands = s.lands;
      was.feed = feed;
      was.ways = ways;
      continue;
    }
    const place = ctx.provinces.get(s.seat)!.ref,
      road = ways[0] ? markets.route(s.seat, ways[0][0]) : undefined,
      event = world.events.emit({
        type: PILGRIM_EVENTS.began.type,
        subjects: [of],
        place,
        causes: [
          { ref: s.event, role: "trigger", weight: 1 },
          ...(road ? [{ ref: road, role: "enabler" as const, weight: 0.4 }] : []),
        ],
        data: { pilgrims: s.pilgrims, lands: s.lands, school: of.startsWith("idea:") },
      });
    store.set({
      of,
      seat: s.seat,
      pilgrims: s.pilgrims,
      lands: s.lands,
      feed,
      ways,
      since: year,
      event,
    });
  }
  store.reckon();
}

/** Teach a peopled world its pilgrimages. */
export function installPilgrims(world: World, ctx: () => PopulationContext): PilgrimsStore {
  const store = world.register(new PilgrimsStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "198.ideas.zpilgrims", every: YEAR, run: (t) => pilgrimsYear(ctx(), t) });
  return store;
}
