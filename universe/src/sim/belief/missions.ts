// Missions, faith by faith (rules/missions.ts): once in ten years, in its turn, a faith with houses weighs sending preachers to
// the land its believers' trade reaches where they would win it the most; its granary pays. While a mission stands, its land may
// take the faith from the preachers as from a neighbour (sim/belief/belief.ts, step 2). One row a faith with a mission out.
import {
  defineEventType,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { MISSION, missionCanGo, missionChance, missionWorth } from "../../rules/index.ts";
import { politiesOf } from "../polity/polity.ts";
import { orderOf } from "../order/order.ts";
import { LAW_OF } from "../order/laws.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { keepMap, keptMap, type KeptMap } from "../culture/keptmap.ts";
import { TEMPLE_ROW, TEMPLE_STORE, cultureRows } from "../culture/rows.ts";
import { refNumber } from "../money/kept.ts";
import type { BeliefStore } from "./belief.ts";

export const MISSION_EVENTS = {
  /** A faith sends preachers to a land. */
  sent: defineEventType("belief.mission", 3),
};

/** A faith's mission: the land, the years it stands, the event, and how devout its senders were. */
export type Mission = {
  readonly cell: number;
  readonly since: number;
  readonly until: number;
  readonly event: Ref;
  readonly piety: number;
};

const STORE = "belief.missions";

export function missionsOf(world: World): KeptMap<Mission> | null {
  return keptMap<Mission>(world, STORE);
}

/** What a land's standing mission is: whose, the year's chance it takes that faith, and the event. */
export type MissionAt = { readonly faith: Ref; readonly chance: number; readonly event: Ref };

/**
 * The year's missions: ended ones let go, faiths in their turn weigh sending one; and the lands that have one standing, by
 * cell (null where there is none: the common case, and nothing more is asked).
 */
export function missionsYear(
  ctx: PopulationContext,
  store: BeliefStore,
  t: SimTime,
): Map<number, MissionAt> | null {
  const { world } = ctx,
    missions = missionsOf(world),
    temples = cultureRows(world, TEMPLE_STORE);
  if (!missions || !temples) return null;
  const year = yearOfMoment(t),
    culture = cultureOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    realms = politiesOf(world),
    order = orderOf(world);
  // (Over, or its land took the faith, or the faith is gone: each row by itself, so in no set order.)
  for (const [k, m] of missions.rows)
    if (year >= m.until || store.of(m.cell).faith === k || !store.get(k as Ref)) missions.drop(k);
  for (const f of store.all()) {
    const serial = refNumber(f.ref);
    if ((year + serial) % MISSION.every !== 0 || missions.get(f.ref)) continue;
    const row = temples.get(serial);
    if (!row || !(row[TEMPLE_ROW.granary]! > 0) || !(row[TEMPLE_ROW.faithful]! > 0)) continue;
    const lands = store.lands(f.ref);
    if (!lands.length) continue;
    const giving = row[TEMPLE_ROW.given]! / row[TEMPLE_ROW.faithful]!,
      piety = culture.get(f.seat)?.traits[WAY.piety] ?? 0.5,
      seen = new Set<number>();
    let best: {
      cell: number;
      people: number;
      holds: boolean;
      w: ReturnType<typeof missionWorth>;
    } | null = null;
    for (const i of markets.flowsAt(lands)) {
      const flow = markets.flows[i]!;
      for (const c of [flow.from, flow.to]) {
        if (seen.has(c)) continue;
        seen.add(c);
        const theirs = store.of(c).faith;
        if (theirs === f.ref) continue;
        const people = ctx.provinces.get(c)?.total() ?? 0;
        if (people <= 0) continue;
        const w = missionWorth(people, theirs !== null, piety, giving),
          net = w.worth - w.cost,
          // (Its own clergy go, a tenth of them at the most; and not where a realm's law allows one faith that is not theirs.)
          realm = realms.of(c),
          law = realm ? order?.realms.get(realm.ref)?.laws[LAW_OF.faith] : undefined;
        if (
          !missionCanGo(
            w.preachers,
            row[TEMPLE_ROW.clergy]!,
            law === 0,
            !!realm && store.of(realm.seat).faith === f.ref,
          )
        )
          continue;
        if (
          !best ||
          net > best.w.worth - best.w.cost ||
          (net === best.w.worth - best.w.cost && c < best.cell)
        )
          best = { cell: c, people, holds: theirs !== null, w };
      }
    }
    if (!best || best.w.worth <= best.w.cost || row[TEMPLE_ROW.granary]! < best.w.cost) continue;
    const prov = ctx.provinces.get(best.cell)!,
      theirEvent = best.holds ? store.of(best.cell).event : null,
      factors: Factor[] = [
        {
          name: "what its people would come to give the faith",
          value: best.people,
          contribution: best.w.worth / best.w.cost,
          source: null,
        },
        {
          name: "what keeping preachers among them costs its granary",
          value: best.w.preachers,
          contribution: -1,
          source: null,
        },
        {
          name: best.holds ? "they hold a faith of their own" : "they keep the old beliefs",
          value: Math.round(best.w.won * 100) / 100,
          contribution: 0,
          source: theirEvent ? { ref: theirEvent, role: "pressure", weight: 0.5 } : null,
        },
      ],
      decision = world.decisions.record({
        rule: "belief.mission",
        subject: f.ref,
        outcome: { land: best.cell, preachers: best.w.preachers },
        score: best.w.worth / best.w.cost,
        threshold: 1,
        factors,
      }),
      event = world.events.emit({
        type: MISSION_EVENTS.sent.type,
        subjects: [f.ref, prov.ref],
        place: prov.ref,
        causes: [
          { ref: decision, role: "trigger", weight: 1 },
          { ref: f.event, role: "enabler", weight: 0.4 },
        ],
        data: {
          name: f.name,
          preachers: best.w.preachers,
          people: best.people,
          cost: Math.round(best.w.cost),
        },
      }),
      next = [...row];
    next[TEMPLE_ROW.granary] = row[TEMPLE_ROW.granary]! - best.w.cost;
    temples.set(serial, next);
    missions.set(f.ref, {
      cell: best.cell,
      since: year,
      until: year + MISSION.years,
      event,
      piety: Math.round(piety * 100) / 100,
    });
  }
  if (!missions.size) return null;
  const at = new Map<number, MissionAt>();
  // (Two faiths' preachers in one land: the likelier is heard, of equals the one of the lesser ref; so in no set order.)
  for (const [k, m] of missions.rows) {
    const holds = store.of(m.cell).faith !== null,
      chance = missionChance(holds, m.piety),
      had = at.get(m.cell);
    if (!had || chance > had.chance || (chance === had.chance && k < had.faith))
      at.set(m.cell, { faith: k as Ref, chance, event: m.event });
  }
  return at;
}

export function installMissions(world: World): void {
  keepMap<Mission>(world, STORE, (m) => [m.event]);
}
