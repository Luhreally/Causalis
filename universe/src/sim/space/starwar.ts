// War between the stars (docs/architecture §23, §26; Phase 6 M63–M64). Two roads to it: a
// realm that would take back a colony among the stars that broke away from it, and a realm
// and another starfaring people it has heard. A war is declared on news years old; its
// fleet — machines of the realm's own industry, on its fastest drive — sails for decades,
// and meets on arrival what has changed while it sailed; the defender fights with its
// own. The declaration's why reaches the realm's reach into the sky (and through it the
// home world's pull) and, for another people, the hearing of them and their world.
import {
  YEAR,
  defineEventType,
  defineStream,
  makeRef,
  defineKind,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { crossingYears, cruise, starDriveFor } from "../../rules/index.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { knows, loreOf } from "../lore/lore.ts";
import type { PopulationContext } from "../population/systems.ts";
import { civilizationsNear, contactsOf } from "./contact.ts";
import { machinesOfRealm, spaceOf, spendMachines } from "./space.ts";
import { starSitesOf } from "./stars.ts";

export const STARWAR = defineKind("swar", "war between the stars", "minted");

export const STARWAR_EVENTS = {
  declared: defineEventType("starwar.declared", 6),
  battle: defineEventType("starwar.battle", 5),
  peace: defineEventType("starwar.peace", 5),
};

const DECLARE = defineStream("starwar.declare");
const FIGHT = defineStream("starwar.fight");

/** Machines a fleet takes from its realm's lands. */
export const FLEET_MACHINES = 4_000_000;
/** The yearly chance a realm with a cause goes to war, before its valour. */
export const STARWAR_PACE = 0.02;

export type StarWar = {
  readonly ref: Ref;
  readonly realm: Ref;
  /** Its enemy: another people of the cluster, or a realm of its own people among the stars. */
  readonly enemy: Ref;
  readonly declared: number;
  readonly event: Ref;
  /** The fleet: when it sailed and when it arrives, and how strong it is. */
  readonly sailed: number;
  readonly arrives: number;
  readonly strength: number;
  battle: Ref | null;
  won: boolean | null;
  ended: Ref | null;
};

export class StarWarStore implements StateStore {
  readonly name = "space.starwars";
  private readonly wars: StarWar[] = [];

  all(): readonly StarWar[] {
    return this.wars;
  }
  add(w: StarWar): void {
    this.wars.push(w);
  }
  open(realm: Ref, enemy: Ref): StarWar | undefined {
    return this.wars.find((w) => w.realm === realm && w.enemy === enemy && !w.ended);
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const w of this.wars) {
      out.push(w.event);
      if (w.battle) out.push(w.battle);
      if (w.ended) out.push(w.ended);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.value(this.wars);
  }
  save(): unknown {
    return this.wars;
  }
  load(state: unknown): void {
    this.wars.length = 0;
    for (const w of state as StarWar[]) this.wars.push({ ...w });
  }
}

export function starWarsOf(world: World): StarWarStore {
  return world.store<StarWarStore>("space.starwars");
}

/** A cause for war between the stars, and where the enemy lies. */
type Cause = {
  enemy: Ref;
  distance: number;
  /** The enemy's strength when the fleet arrives. */
  defence: (year: number) => number;
  factor: Factor;
  /** Take the prize, if the fleet wins. */
  take?: () => void;
};

/** The causes a realm has for war between the stars. */
function causes(ctx: PopulationContext, p: Polity, year: number): Cause[] {
  const { world } = ctx,
    out: Cause[] = [],
    realms = politiesOf(world),
    sites = starSitesOf(world);
  // A colony among the stars it founded, broken away: a realm of its own out there.
  for (const [cell, site] of sites?.all() ?? []) {
    if (site.realm !== p.ref || !site.arrived) continue;
    const holder = realms.of(cell);
    if (!holder || holder.ref === p.ref || holder.seat !== cell) continue;
    out.push({
      enemy: holder.ref,
      distance: site.distance,
      defence: () => (ctx.provinces.get(cell)?.total() ?? 0) / 500 + 1,
      factor: {
        name: `a colony of its own among the stars, broken away (${site.distance.toFixed(1)} light-years out)`,
        value: site.distance,
        contribution: 1,
        source: { ref: holder.event, role: "trigger", weight: 1 },
      },
      take: () => {
        // The colony is the realm's again.
        realms.leave(holder, cell);
        realms.join(p, cell);
      },
    });
  }
  // Another people, heard, and sailing the stars too.
  const contacts = contactsOf(world);
  for (const civ of civilizationsNear(world)) {
    const heard = contacts.of(civ.ref);
    if (!heard || civ.stars > year) continue;
    out.push({
      enemy: civ.ref,
      distance: civ.distance,
      // An older starfaring people is the stronger, and the more for its pace.
      defence: (y) => 1 + (civ.pace * Math.max(0, y - civ.stars)) / 150,
      factor: {
        name: `another starfaring people, heard ${civ.distance.toFixed(1)} light-years away`,
        value: civ.distance,
        contribution: 0.8,
        source: { ref: heard.heard, role: "trigger", weight: 1 },
      },
    });
  }
  return out;
}

/** The year's wars between the stars: declarations, fleets arriving, and the peace after. */
export function starWarYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = starWarsOf(world),
    year = yearOfMoment(t),
    culture = cultureOf(world),
    lore = loreOf(world);
  // Fleets that arrive: a battle, and the war's end.
  for (const w of store.all()) {
    if (w.ended || year < w.arrives) continue;
    const realm = politiesOf(world).get(w.realm),
      p = realm && !realm.ended ? realm : null,
      cause = p ? causes(ctx, p, year).find((c) => c.enemy === w.enemy) : undefined,
      defence = cause ? cause.defence(year) : 1,
      odds = w.strength / (w.strength + defence),
      won = world.rng.real(FIGHT, 0, t, 0, store.all().indexOf(w)) < odds;
    w.won = won;
    w.battle = world.events.emit({
      type: STARWAR_EVENTS.battle.type,
      subjects: [w.realm, w.enemy],
      place: null,
      causes: [{ ref: w.event, role: "trigger", weight: 1 }],
      data: {
        won,
        strength: Math.round(w.strength * 10) / 10,
        defence: Math.round(defence * 10) / 10,
        year,
      },
    });
    if (won) cause?.take?.();
    w.ended = world.events.emit({
      type: STARWAR_EVENTS.peace.type,
      subjects: [w.realm, w.enemy],
      place: null,
      causes: [{ ref: w.battle, role: "trigger", weight: 1 }],
      data: { won, year },
    });
  }
  // Declarations: a realm with a fleet's drive and a cause, by its valour.
  for (const p of politiesOf(world).living()) {
    const prog = spaceOf(world).of(p.ref);
    if (!prog?.satellite) continue;
    const drive = starDriveFor((id) => knows(ctx, p.seat, id));
    if (!drive) continue;
    const valour = culture.get(p.seat)?.traits[WAY.valour] ?? 0.5,
      machines = machinesOfRealm(ctx, p);
    if (machines < 2 * FLEET_MACHINES) continue;
    for (const cause of causes(ctx, p, year)) {
      if (store.open(p.ref, cause.enemy)) continue;
      if (!(world.rng.real(DECLARE, p.seat, t, 0) < STARWAR_PACE * (0.5 + valour))) continue;
      spendMachines(ctx, p, FLEET_MACHINES);
      const years = Math.ceil(crossingYears(cause.distance, drive)),
        driveKnown = lore.get(p.seat, drive.needs[0]!),
        decision = world.decisions.record({
          rule: "starwar.declare",
          subject: p.ref,
          outcome: { enemy: cause.enemy, years },
          score: valour,
          threshold: 0,
          factors: [
            cause.factor,
            {
              name: `its reach into the sky (its first satellite in ${yearOfMoment(world.events.get(prog.satellite)!.t)})`,
              value: 1,
              contribution: 0.6,
              source: { ref: prog.satellite, role: "enabler", weight: 1 },
            },
            {
              name: `a fleet on ${drive.words}: ${Math.round(years)} years to arrive, on news ${Math.round(cause.distance)} years old`,
              value: cruise(drive),
              contribution: 0.6,
              source: driveKnown ? { ref: driveKnown.event, role: "enabler", weight: 1 } : null,
            },
            {
              name: "its rulers' valour",
              value: valour,
              contribution: valour,
              source: { ref: p.ref, role: "agent", weight: 1 },
            },
          ],
        }),
        causesOf: CauseRef[] = [{ ref: decision, role: "trigger", weight: 1 }],
        event = world.events.emit({
          type: STARWAR_EVENTS.declared.type,
          subjects: [p.ref, cause.enemy],
          place: ctx.provinces.get(p.seat)?.ref ?? null,
          causes: causesOf,
          data: { realm: p.town, distance: Math.round(cause.distance * 10) / 10, years, year },
        });
      store.add({
        ref: makeRef(STARWAR, 0, store.all().length),
        realm: p.ref,
        enemy: cause.enemy,
        declared: year,
        event,
        sailed: year,
        arrives: year + years,
        // A fleet is as strong as the machines behind it and the speed that brings them.
        strength: 2 + 10 * cruise(drive),
        battle: null,
        won: null,
        ended: null,
      });
      // One declaration a year in all the world.
      return;
    }
  }
}

export function installStarWars(world: World, ctx: () => PopulationContext): StarWarStore {
  const store = world.register(new StarWarStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "200.space.starwar", every: YEAR, run: (t) => starWarYear(ctx(), t) });
  return store;
}
