// Ships through the lanes to a people seen (Phase 68, first slice). A realm that knows the lanes and has a station looks
// across the dark: fields, and towns lit at night, show on a world within its reach, as they stood when the light left
// them. It may send a ship to them, once for each stage it sees them at; a crossing on any drive would not have been
// asked of its own for it. A ship carries no one to stay and takes no land: it goes, it comes down, and history holds
// that it came. What passed there is Phase 70's reading (rules/landfall.ts).
import { YEAR, defineStream, yearOfMoment, type SimTime, type World } from "../../kernel/index.ts";
import { cellRef, isProvinceWorld } from "../../gen/index.ts";
import {
  crossingYears,
  cruise,
  routeMachines,
  routeYears,
  starDriveFor,
  type LaneRoute,
  type StarDrive,
} from "../../rules/index.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";
import { FLIGHT_PACE, machinesOfRealm, spaceOf, spendMachines } from "./space.ts";
import { folkStage, folksNear, type Folk } from "./natives.ts";
import { LANE_EVENTS, LANE_ROW, laneLawOf, laneMapOf, laneRoute, lanesOf } from "./lanes.ts";
import type { StarSiteStore } from "./stars.ts";
import { noteFirstJump } from "./voyages.ts";

const SEND = defineStream("space.lanes.send");

/** What a ship sent to look costs, in machines: a hull with no one to keep past the crossing. */
export const VISIT_MACHINES = 2_000_000;
/** The stages that show across the dark: fields and towns; a camp shows nothing. */
const SEEN_STAGES: ReadonlySet<string> = new Set(["villages", "towns", "cities", "works"]);

const FOLKS = new Map<string, readonly Folk[]>();
function peoplesNear(world: World): readonly Folk[] {
  const key = world.seed.text;
  let list = FOLKS.get(key);
  if (!list) {
    if (FOLKS.size > 4) FOLKS.clear();
    FOLKS.set(key, (list = folksNear(world)));
  }
  return list;
}

/** The people a realm would send to now: seen at a stage no ship has gone to them at, the nearest in time. */
function seenBy(
  world: World,
  store: StarSiteStore,
  drive: StarDrive,
  home: string,
  year: number,
): { folk: Folk; stage: string; route: LaneRoute; years: number } | null {
  let best: { folk: Folk; stage: string; route: LaneRoute; years: number } | null = null;
  const v = cruise(drive);
  for (const f of peoplesNear(world)) {
    const route = laneRoute(world, home, f.star);
    if (!route) continue;
    // (As the light that shows them left them.)
    const stage = folkStage(f, year - Math.ceil(lightYearsTo(world, f.star)));
    if (!SEEN_STAGES.has(stage)) continue;
    if (store.visits.some((x) => x.folk === f.ref && x.seen === stage)) continue;
    const years = routeYears(route, v);
    if (!best || years < best.years) best = { folk: f, stage, route, years };
  }
  return best;
}

/** The year's ships through the lanes: those that come, and one that sails. */
export function laneYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx;
  if (!isProvinceWorld(g) || !laneLawOf(world).open) return;
  const store = lanesOf(world)!,
    year = yearOfMoment(t);
  for (const v of store.visits) {
    if (v.arrived || year < v.arrives) continue;
    v.arrived = world.events.emit({
      type: LANE_EVENTS.came.type,
      place: null,
      subjects: [v.realm, v.folk, v.star],
      causes: [{ ref: v.event, role: "trigger", weight: 1 }],
      data: { realm: v.name, folk: v.folk, seen: v.seen, sailed: v.sailed, year },
    });
  }
  // One a year in all the world, by the realm with most reason: the first found able.
  const able = (p: Polity) => !!spaceOf(world).of(p.ref)?.station && knows(ctx, p.seat, LANE_ROW);
  for (const p of politiesOf(world).living()) {
    if (!able(p)) continue;
    const machines = machinesOfRealm(ctx, p);
    if (machines * 0.5 < VISIT_MACHINES) continue;
    const drive = starDriveFor((id) => knows(ctx, p.seat, id));
    if (!drive) continue;
    // (Asked only now and again: the reading of who is seen is the dear part.)
    if (!(world.rng.real(SEND, p.seat, t, 0) < FLIGHT_PACE * 0.2)) continue;
    const pick = seenBy(world, store, drive, g.star.ref as string, year);
    if (!pick) return;
    const { folk: f, stage, route, years } = pick,
      charge = routeMachines(route);
    if (machines * 0.5 < VISIT_MACHINES + charge) continue;
    spendMachines(ctx, p, VISIT_MACHINES + charge);
    const known = loreOf(world).get(p.seat, LANE_ROW),
      distance = lightYearsTo(world, f.star),
      byDrive = Math.round(crossingYears(distance, drive)),
      arrives = year + Math.ceil(years),
      decision = world.decisions.record({
        rule: "lanes.sent",
        subject: p.ref,
        outcome: { folk: f.ref, stage, years: Math.ceil(years) },
        score: years,
        threshold: 0,
        factors: [
          {
            name: `${stage === "villages" ? "fields" : "lit towns"} seen on a world ${distance.toFixed(1)} light-years out, as they stood ${Math.ceil(distance)} years before`,
            value: distance,
            contribution: 1,
            source: { ref: f.star, role: "enabler" as const, weight: 1 },
          },
          {
            name: `${route.hops} lane${route.hops === 1 ? "" : "s"}, ${Math.ceil(years)} years by them; ${byDrive} by ${drive.words} alone`,
            value: years,
            contribution: 0.8,
            source: known ? { ref: known.event, role: "enabler" as const, weight: 1 } : null,
          },
          {
            name: "machines enough to send a ship",
            value: machines / VISIT_MACHINES,
            contribution: 0.4,
            source: { ref: p.ref, role: "agent" as const, weight: 1 },
          },
        ],
      }),
      event = world.events.emit({
        type: LANE_EVENTS.sent.type,
        place: cellRef(0, p.seat),
        subjects: [p.ref, f.ref, f.star],
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: {
          realm: p.town,
          folk: f.name,
          hops: route.hops,
          years: Math.ceil(years),
          byDrive,
          distance: Math.round(distance * 10) / 10,
          year,
        },
      });
    store.visits.push({
      realm: p.ref,
      name: p.town,
      folk: f.ref,
      star: f.star,
      planet: f.planet,
      seen: stage,
      sailed: year,
      arrives,
      hops: route.hops,
      distance,
      byDrive,
      drive: drive.id,
      event,
      arrived: null,
    });
    noteFirstJump(ctx, p, {
      what: "envoys",
      cell: null,
      star: f.star,
      planet: f.planet,
      route,
      drive,
      distance,
      arrives,
      thrown: null,
      cause: event,
      year,
    });
    return;
  }
}

/** How far a star lies from home (light-years). */
function lightYearsTo(world: World, ref: string): number {
  const map = laneMapOf(world),
    s = map.stars[map.at.get(ref)!]!;
  return Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
}

export function installLanes(world: World, ctx: () => PopulationContext): void {
  world.system({ key: "202.space.lanes", every: YEAR, run: (t) => laneYear(ctx(), t) });
}
