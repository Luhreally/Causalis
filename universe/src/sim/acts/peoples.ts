// The god's hold on the peoples (Phase 12 M107, Phase 13 M113): acts not on the weather but on
// the realms and their lands, as WorldBox's powers over its kingdoms — one realm set upon
// another, a war ended, two realms made to remember each other kindly or with grievance, a land
// stirred to rise from its realm, a land turned to a faith; and the god's making — settlers sent
// into a land, two realms made one, a realm's lands blessed with content or cursed with unrest.
// Each is a logged command whose event cites it; what follows (the battles, the pacts and
// rivalries, the new realm and the war to take it back, the faith's spread, the new land's
// villages and speech) is the simulation's own.
import { defineEventType, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { cellRef, offworldSite } from "../../gen/index.ts";
import { GOODS } from "../../rules/index.ts";
import { COLS, Province } from "../population/model.ts";
import {
  POPULATION_EVENTS,
  livableFor,
  marketsOf,
  type PopulationContext,
} from "../population/systems.ts";
import {
  POLITY_EVENTS,
  cutOff,
  endRealm,
  politiesOf,
  raiseRealm,
  realmName,
} from "../polity/polity.ts";
import { WAR, WAR_EVENTS, frontier, warsOf } from "../war/war.ts";
import { diplomacyOf } from "../diplomacy/diplomacy.ts";
import { BELIEF_EVENTS, beliefOf } from "../belief/belief.ts";

export const PEOPLE_ACT_EVENTS = {
  friendship: defineEventType("act.friendship", 5),
  discord: defineEventType("act.discord", 5),
  settle: defineEventType("act.settle", 5),
  union: defineEventType("act.union", 6),
  bless: defineEventType("act.bless", 5),
  curse: defineEventType("act.curse", 5),
};

/** Settlers sent: this share of the land they come from, at most so many, and no fewer than it can spare. */
export const SETTLERS = { share: 0.08, most: 2000, fewest: 200 };
/** How far a blessing eases a land's grievance, and a curse deepens it. */
export const FORTUNE = 0.5;

/** How strongly the god's friendship or discord is remembered (a war between them is 0.45). */
export const REGARD = 0.5;
/** How bitterly a realm remembers a land that rose against it (a land taken is 0.35). */
export const RISEN = 0.4;

/** Two realms: the one acting (or named first) and the one acted on. */
export type PairArgs = { a: Ref; b: Ref };
/** A land. */
export type LandArgs = { cell: number };
/** A land, and the faith it is turned to. */
export type ConvertArgs = { cell: number; faith: Ref };
/** A realm. */
export type RealmArgs = { realm: Ref };

/** The most peopled land beside a land (by land, or across the sea its traders cross) that can spare settlers. */
export function settlersFrom(ctx: PopulationContext, cell: number): number | null {
  const g = ctx.generated,
    near = new Set<number>();
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++)
    near.add(g.grid.neighbours[k]!);
  for (const n of marketsOf(ctx.world).seaPartners(cell)) near.add(n);
  let best: number | null = null,
    most = SETTLERS.fewest - 1;
  for (const n of [...near].sort((a, b) => a - b)) {
    const people = ctx.provinces.get(n)?.total() ?? 0;
    if (people > most && !offworldSite(g, n)) {
      most = people;
      best = n;
    }
  }
  return best;
}

/** Teach a peopled world the god's acts on its peoples. */
export function installPeopleActs(world: World, ctx: () => PopulationContext): void {
  const realms = () => politiesOf(world),
    standing = (ref: unknown) => {
      const r = typeof ref === "string" ? realms().get(ref as Ref) : undefined;
      return r && r.ended === null ? r : null;
    },
    pair = (args: unknown): string | null => {
      const a = args as Partial<PairArgs> | null;
      if (!standing(a?.a) || !standing(a?.b)) return "two standing realms are wanted";
      return a!.a === a!.b ? "a realm cannot be set against itself" : null;
    },
    agent = (command: { id: Ref }) => [{ ref: command.id, role: "agent" as const, weight: 1 }];

  // War: one realm set upon another, for the land of the other's it wants most.
  world.defineCommand({
    type: "act.war",
    validate: (args) => {
      const bad = pair(args);
      if (bad) return bad;
      const { a, b } = args as PairArgs;
      if (warsOf(world).between(a, b)) return "they are at war already";
      return frontier(ctx(), standing(a)!, standing(b)!).length
        ? null
        : "no land lies between them to fight for";
    },
    apply: (command, t) => {
      const { a, b } = command.args as PairArgs,
        attacker = standing(a)!,
        defender = standing(b)!,
        prize = frontier(ctx(), attacker, defender)[0]!,
        ref = world.minter.mint(WAR),
        event = world.events.emit({
          type: WAR_EVENTS.declared.type,
          subjects: [ref, attacker.ref, defender.ref],
          place: cellRef(0, prize),
          causes: agent(command),
          data: { a: realmName(attacker), b: realmName(defender) },
        });
      warsOf(world).add({
        ref,
        attacker: attacker.ref,
        defender: defender.ref,
        declared: yearOfMoment(t),
        event,
        prize,
        battles: [],
        fallen: [0, 0],
        ended: null,
        peace: null,
      });
    },
  });

  // Peace: a war between two realms ended, and remembered as its sides would remember it.
  world.defineCommand({
    type: "act.peace",
    validate: (args) => {
      const bad = pair(args);
      if (bad) return bad;
      const { a, b } = args as PairArgs;
      return warsOf(world).between(a, b) ? null : "they are not at war";
    },
    apply: (command, t) => {
      const { a, b } = command.args as PairArgs,
        w = warsOf(world).between(a, b)!,
        attacker = realms().get(w.attacker)!,
        defender = realms().get(w.defender)!,
        year = yearOfMoment(t);
      w.ended = year;
      w.peace = world.events.emit({
        type: WAR_EVENTS.peace.type,
        subjects: [w.ref, attacker.ref, defender.ref],
        place: ctx().provinces.get(attacker.seat)?.ref ?? null,
        causes: agent(command),
        data: {
          a: realmName(attacker),
          b: realmName(defender),
          years: year - w.declared,
          won: attacker.members.includes(w.prize),
        },
      });
      diplomacyOf(world).remember(attacker.ref, defender.ref, {
        name: "a war between them",
        value: -0.45,
        year,
        source: w.event,
      });
    },
  });

  // Friendship and discord: two realms made to remember each other kindly, or with
  // grievance, fading as other memories fade.
  for (const [kind, value, name] of [
    ["friendship", REGARD, "the god's favour on their friendship"],
    ["discord", -REGARD, "a discord the god sowed between them"],
  ] as const)
    world.defineCommand({
      type: `act.${kind}`,
      validate: pair,
      apply: (command, t) => {
        const { a, b } = command.args as PairArgs,
          event = world.events.emit({
            type: PEOPLE_ACT_EVENTS[kind].type,
            subjects: [a, b],
            place: null,
            causes: agent(command),
            data: { a: realmName(standing(a)!), b: realmName(standing(b)!) },
          });
        diplomacyOf(world).remember(a, b, { name, value, year: yearOfMoment(t), source: event });
      },
    });

  // A rising: a land stirred to break from its realm. Where it has a town, it raises its own
  // realm there under a claimant (and the realm it left remembers it bitterly); else it goes
  // its own way, too aggrieved to bow to another soon. What the land joined to the seat is
  // cut off with it.
  world.defineCommand({
    type: "act.rise",
    validate: (args) => {
      const cell = (args as Partial<LandArgs> | null)?.cell;
      if (!Number.isInteger(cell)) return "a land is wanted";
      const r = realms().of(cell!);
      if (!r || r.ended !== null) return "that land is no realm's";
      return r.seat === cell ? "a realm's seat cannot rise against itself" : null;
    },
    apply: (command, t) => {
      const cell = (command.args as LandArgs).cell,
        c = ctx(),
        p = realms().of(cell)!,
        prov = c.provinces.get(cell)!,
        seceded = world.events.emit({
          type: POLITY_EVENTS.seceded.type,
          subjects: [p.ref, prov.ref],
          place: prov.ref,
          causes: agent(command),
          data: { name: realmName(p) },
        });
      realms().leave(p, cell);
      const town = [...c.settlements.inProvince(cell)].sort(
          (x, y) =>
            (y.market ? 1 : 0) - (x.market ? 1 : 0) ||
            y.population - x.population ||
            (x.ref < y.ref ? -1 : 1),
        )[0],
        risen = town ? raiseRealm(c, town, [cell], seceded, t) : null;
      if (risen)
        diplomacyOf(world).remember(p.ref, risen.ref, {
          name: "a land that rose against them",
          value: -RISEN,
          year: yearOfMoment(t),
          source: seceded,
        });
      else realms().setDiscontent(cell, { level: 1, cause: seceded });
      cutOff(c, p, seceded);
    },
  });

  // Settlers: a share of the most peopled land beside it sent into a land (empty, or not), with
  // what they know and their share of its stores; an empty land is peopled by them, and takes
  // their ways and speech.
  world.defineCommand({
    type: "act.settle",
    validate: (args) => {
      const cell = (args as Partial<LandArgs> | null)?.cell,
        c = ctx();
      if (!Number.isInteger(cell) || cell! < 0 || cell! >= c.generated.grid.count)
        return "a land is wanted";
      if (offworldSite(c.generated, cell!) || !livableFor(c, cell!))
        return "no people could live there";
      return settlersFrom(c, cell!) === null ? "no people near enough to send" : null;
    },
    apply: (command, t) => {
      const c = ctx(),
        cell = (command.args as LandArgs).cell,
        year = yearOfMoment(t),
        from = c.provinces.get(settlersFrom(c, cell)!)!,
        count = Math.min(SETTLERS.most, Math.floor(from.total() * SETTLERS.share)),
        decision = world.decisions.record({
          rule: "act.settle",
          subject: from.ref,
          outcome: { to: cellRef(0, cell), count },
          score: 1,
          threshold: 0,
          factors: [
            {
              name: "sent by your hand",
              value: 1,
              contribution: 1,
              source: { ref: command.id, role: "agent", weight: 1 },
            },
          ],
        }),
        event = world.events.emit({
          type: PEOPLE_ACT_EVENTS.settle.type,
          subjects: [from.ref, cellRef(0, cell)],
          place: cellRef(0, cell),
          causes: agent(command),
          data: { count },
        });
      let dest = c.provinces.get(cell);
      if (!dest) {
        dest = c.provinces.add(new Province(cell, year, event));
        world.events.emit({
          type: POPULATION_EVENTS.peopled.type,
          place: dest.ref,
          causes: [{ ref: event, role: "trigger", weight: 1 }],
          data: { people: count },
        });
      }
      // They carry what they know, and their share of what their people have.
      if (from.knowsCultivation && !dest.knowsCultivation) {
        dest.knowsCultivation = true;
        dest.cultivation = from.cultivation;
      }
      if (from.herding && !dest.herding) dest.herding = from.herding;
      const markets = marketsOf(world),
        out = markets.of(from.cell),
        into = markets.of(cell),
        people = Math.max(1, from.total());
      for (let g = 0; g < GOODS.length; g++)
        into.move(
          "carriedIn",
          g,
          out.move("carriedOut", g, Math.floor((out.stock[g]! * count) / people)),
        );
      if (out.metalworking && !into.metalworking) into.metalworking = out.metalworking;
      // Of every age and trade alike, as many as are sent.
      const share = count / people,
        byOccupation = new Array<number>(COLS).fill(0);
      let moved = 0;
      for (let r = 0; r < from.counts.rows && moved < count; r++)
        for (let o = 0; o < COLS && moved < count; o++) {
          const m = Math.min(count - moved, Math.floor(from.counts.get(r, o) * share));
          if (m <= 0) continue;
          from.counts.add(r, o, -m);
          dest.counts.add(r, o, m);
          byOccupation[o] = byOccupation[o]! + m;
          moved += m;
        }
      c.history.addFlow({
        from: from.cell,
        to: cell,
        year,
        count: moved,
        byOccupation,
        decision,
        event,
      });
    },
  });

  // Union: the second realm joins the first, its lands and all, and ends as a realm of its own.
  world.defineCommand({
    type: "act.union",
    validate: pair,
    apply: (command, t) => {
      const { a, b } = command.args as PairArgs,
        into = standing(a)!,
        gone = standing(b)!,
        event = world.events.emit({
          type: PEOPLE_ACT_EVENTS.union.type,
          subjects: [into.ref, gone.ref],
          place: ctx().provinces.get(gone.seat)?.ref ?? null,
          causes: agent(command),
          data: { a: realmName(into), b: realmName(gone), lands: gone.members.length },
        });
      for (const cell of [...gone.members]) {
        realms().leave(gone, cell);
        realms().join(into, cell);
      }
      endRealm(ctx(), gone, t, { ref: event, role: "trigger", weight: 1 });
    },
  });

  // A blessing and a curse on a realm: every land of it the more content, or the more restless.
  for (const [kind, sign] of [
    ["bless", -1],
    ["curse", 1],
  ] as const)
    world.defineCommand({
      type: `act.${kind}`,
      validate: (args) =>
        standing((args as Partial<RealmArgs> | null)?.realm) ? null : "a standing realm is wanted",
      apply: (command) => {
        const r = standing((command.args as RealmArgs).realm)!,
          event = world.events.emit({
            type: PEOPLE_ACT_EVENTS[kind].type,
            subjects: [r.ref],
            place: ctx().provinces.get(r.seat)?.ref ?? null,
            causes: agent(command),
            data: { name: realmName(r), lands: r.members.length },
          });
        for (const cell of r.members) {
          const d = realms().discontent(cell),
            level = Math.max(0, d.level + sign * FORTUNE);
          realms().setDiscontent(cell, {
            level,
            cause: sign > 0 ? event : level > 0 ? d.cause : null,
          });
        }
      },
    });

  // Conversion: a land turned to a faith.
  world.defineCommand({
    type: "act.convert",
    validate: (args) => {
      const a = args as Partial<ConvertArgs> | null;
      if (!Number.isInteger(a?.cell) || !((ctx().provinces.get(a!.cell!)?.total() ?? 0) > 0))
        return "a peopled land is wanted";
      if (typeof a?.faith !== "string" || !beliefOf(world).get(a.faith as Ref))
        return "a faith is wanted";
      return beliefOf(world).of(a.cell!).faith === a.faith ? "they hold that faith already" : null;
    },
    apply: (command, t) => {
      const { cell, faith } = command.args as ConvertArgs,
        prov = ctx().provinces.get(cell)!,
        store = beliefOf(world),
        event = world.events.emit({
          type: BELIEF_EVENTS.converted.type,
          subjects: [faith, prov.ref],
          place: prov.ref,
          causes: agent(command),
          data: { name: store.get(faith)!.name },
        });
      store.set(cell, { faith, since: yearOfMoment(t), event });
    },
  });
}
