// The god's acts on a place and on a person (docs/architecture §3.1): the grammar's
// finer scales. On a place — a village or a city: a shrine raised (a sign the
// devout read), a fire sent (a town's homes burn — and a city's quarters — and some
// die), a spring opened (the village draws people to it); each where the hand sets
// it in the town, if it does (Phase 42 M201). On a person — only where the hand rests, since
// only there are people the world's own: inspiration (their land comes upon the
// next thing it could know, and they are remembered for it) and blessing (they are
// spared death for twenty years). Each is a logged command whose event cites it;
// what follows is the simulation's own.
import { defineEventType, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { BANDS, PRINCIPLES, needsMet } from "../../rules/index.ts";
import { cradleTongue, tonguePersonName } from "../../gen/index.ts";
import { COLS } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Settlement } from "../population/stores.ts";
import {
  PERSON_TRAITS,
  PIOUS_BLESSING,
  handOf,
  opposedTo,
  type Agent,
  type PersonTrait,
} from "../hand/hand.ts";

/** How many years the god's blessing spares one of the people under the hand. */
export const BLESSING = 20;
import { cultureOf } from "../culture/culture.ts";
import { citiesOf, USE } from "../city/city.ts";
import { homesStand, razeTown } from "../town/fabric.ts";
import { knows, loreOf } from "../lore/lore.ts";

export const LOCAL_ACT_EVENTS = {
  shrine: defineEventType("act.shrine", 5),
  fire: defineEventType("act.fire", 5),
  spring: defineEventType("act.spring", 5),
  inspireOne: defineEventType("act.inspire-one", 5),
  blessOne: defineEventType("act.bless-one", 4),
  traitOne: defineEventType("act.trait", 4),
};

type PlaceArgs = {
  village: Ref;
  /** Where in it (metres from its middle), if the hand sets it there (Phase 42 M201). */
  x?: number;
  z?: number;
};
/** A fire: the lot of the town's plan it falls on, if the hand sends it there. */
type FireArgs = PlaceArgs & { lot?: number };
type PersonArgs = { agent: number };

/** How far from a town's middle the hand may set a thing in it (metres). */
const REACH_M = 4000;

/** Why a place's spot is no spot, if it is not (none given is none wanted). */
function spotProblem(args: unknown): string | null {
  const { x, z } = (args ?? {}) as Partial<PlaceArgs>;
  if (x === undefined && z === undefined) return null;
  return typeof x === "number" &&
    typeof z === "number" &&
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    x * x + z * z <= REACH_M * REACH_M
    ? null
    : "a spot in the town is x and z, metres from its middle";
}

/** The spot set, for the event's data (none: nothing). */
function spotOf(args: unknown): { x: number; z: number } | Record<string, never> {
  const { x, z } = args as PlaceArgs;
  return typeof x === "number" && typeof z === "number"
    ? { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }
    : {};
}

/** One of the hand's people by name, in their land's tongue: "Asha of Kirath". */
export function agentName(ctx: PopulationContext, a: Agent, v: Settlement): string {
  // (Known by a name of their own: the one the hand was laid from, Phase 54.)
  if (a.name) return a.name;
  const tongue = cultureOf(ctx.world).get(v.cell)?.tongue ?? cradleTongue(ctx.culture);
  return `${tonguePersonName(tongue, a.id, a.sex)} of ${v.name}`;
}

/** Teach a peopled world the finer acts. */
export function installLocalActs(world: World, ctx: () => PopulationContext): void {
  const village = (args: unknown): string | null => {
    const ref = (args as Partial<PlaceArgs> | null)?.village;
    if (typeof ref !== "string") return "village must be a village's ref";
    return ctx().settlements.get(ref as Ref) ? null : `no village ${ref}`;
  };
  const agent = (args: unknown): string | null => {
    const id = (args as Partial<PersonArgs> | null)?.agent,
      w = handOf(world).resting;
    if (!w) return "your hand rests on no village: a person can be touched only where it rests";
    if (!Number.isInteger(id)) return "agent must be one of the hand's people";
    return w.agents.some((a) => a.id === id) ? null : "no such person under your hand";
  };

  world.defineCommand({
    type: "act.shrine",
    validate: (args) =>
      village(args) ??
      spotProblem(args) ??
      (ctx().settlements.get((args as PlaceArgs).village)!.shrine
        ? "a shrine already stands there"
        : null),
    apply: (command) => {
      const v = ctx().settlements.get((command.args as PlaceArgs).village)!;
      v.shrine = world.events.emit({
        type: LOCAL_ACT_EVENTS.shrine.type,
        subjects: [v.ref],
        place: ctx().provinces.get(v.cell)!.ref,
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: { name: v.name, ...spotOf(command.args) },
      });
    },
  });

  world.defineCommand({
    type: "act.fire",
    validate: (args) => {
      const problem = village(args);
      if (problem) return problem;
      const { village: ref, lot } = args as FireArgs;
      if (lot !== undefined && (!Number.isInteger(lot) || lot < 0))
        return "lot must be one of the town's lots";
      // (Any town whose homes stand burns, not a city only: Phase 42 M201.)
      return citiesOf(world).get(ref) || homesStand(world, ref)
        ? null
        : "nothing stands there to burn";
    },
    apply: (command, t) => {
      const c = ctx(),
        { lot } = command.args as FireArgs,
        v = c.settlements.get((command.args as PlaceArgs).village)!,
        city = citiesOf(world).get(v.ref),
        year = yearOfMoment(t);
      // A fifth of a city's built blocks burn, the nearest the middle first; a hundredth of the
      // people die.
      const built = (city?.uses ?? [])
          .map((u, k) => ({ u, k }))
          .filter((b) => b.u !== USE.open && b.u !== USE.temple),
        burnt = built.slice(0, Math.ceil(built.length / 5));
      for (const b of burnt) city!.uses[b.k] = USE.open;
      // (And as great a share of its homes, the heart first — or those about the lot it fell on:
      // Phase 23, Phase 42 M201.)
      const homes = razeTown(c, v.ref, 0.2, t, lot);
      const p = c.provinces.get(v.cell)!,
        toll = Math.round(v.population / 100);
      let dead = toll;
      for (let b = 0; b < BANDS && dead > 0; b++)
        for (let r = b; r < 2 * BANDS && dead > 0; r += BANDS)
          for (let o = 0; o < COLS && dead > 0; o++) {
            const n = Math.min(dead, Math.floor(p.counts.get(r, o) / 50));
            if (!n) continue;
            p.counts.add(r, o, -n);
            c.history.addDeaths(v.cell, year, b, n);
            dead -= n;
          }
      world.events.emit({
        type: LOCAL_ACT_EVENTS.fire.type,
        subjects: [v.ref],
        place: p.ref,
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        // (How many it killed: told, for their burying — Phase 43 M205.)
        data: {
          name: v.name,
          blocks: burnt.length,
          homes,
          dead: toll - dead,
          ...(lot !== undefined ? { lot } : {}),
        },
      });
    },
  });

  world.defineCommand({
    type: "act.spring",
    validate: (args) =>
      village(args) ??
      spotProblem(args) ??
      (ctx().settlements.get((args as PlaceArgs).village)!.spring
        ? "a spring already rises there"
        : null),
    apply: (command) => {
      const v = ctx().settlements.get((command.args as PlaceArgs).village)!;
      v.spring = world.events.emit({
        type: LOCAL_ACT_EVENTS.spring.type,
        subjects: [v.ref],
        place: ctx().provinces.get(v.cell)!.ref,
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: { name: v.name, ...spotOf(command.args) },
      });
    },
  });

  world.defineCommand({
    type: "act.inspire-one",
    validate: agent,
    apply: (command, t) => {
      const c = ctx(),
        w = handOf(world).resting!,
        id = (command.args as PersonArgs).agent,
        a = w.agents.find((x) => x.id === id)!,
        lore = loreOf(world),
        year = yearOfMoment(t),
        // What their land could come to know next.
        next = PRINCIPLES.find(
          (p) => p.rate > 0 && !lore.get(w.cell, p.id) && needsMet(p, (n) => knows(c, w.cell, n)),
        );
      const event = world.events.emit({
        type: LOCAL_ACT_EVENTS.inspireOne.type,
        subjects: [w.village],
        place: c.provinces.get(w.cell)!.ref,
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: {
          agent: id,
          name: agentName(c, a, c.settlements.get(w.village)!),
          principle: next?.id ?? null,
        },
      });
      w.notables = [...(w.notables ?? []), { agent: id, deed: event }];
      if (next) {
        const found = world.events.emit({
          type: "lore.found",
          place: c.provinces.get(w.cell)!.ref,
          causes: [{ ref: event, role: "trigger", weight: 1 }],
          data: { principle: next.id },
        });
        lore.learn(w.cell, next.id, { year, event: found }, next);
      }
    },
  });

  world.defineCommand({
    type: "act.bless-one",
    validate: agent,
    apply: (command, t) => {
      const c = ctx(),
        w = handOf(world).resting!,
        id = (command.args as PersonArgs).agent,
        a = w.agents.find((x) => x.id === id)!,
        year = yearOfMoment(t);
      // (The pious are kept the longer.)
      a.blessedUntil =
        year + Math.round(BLESSING * (a.traits?.includes("pious") ? PIOUS_BLESSING : 1));
      const event = world.events.emit({
        type: LOCAL_ACT_EVENTS.blessOne.type,
        subjects: [w.village],
        place: c.provinces.get(w.cell)!.ref,
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: {
          agent: id,
          name: agentName(c, a, c.settlements.get(w.village)!),
          age: year - a.birthYear,
          until: a.blessedUntil,
        },
      });
      w.notables = [...(w.notables ?? []), { agent: id, deed: event }];
    },
  });

  // A trait given or taken (Phase 14 M118): what they are like, by the god's hand — and, for
  // the traits that weigh on a life, how their life goes from then on.
  world.defineCommand({
    type: "act.trait",
    validate: (args) => {
      const bad = agent(args);
      if (bad) return bad;
      const a = args as { agent: number; trait?: unknown; on?: unknown },
        t = a.trait as PersonTrait;
      if (!(PERSON_TRAITS as readonly string[]).includes(String(a.trait)))
        return `a trait is wanted: ${PERSON_TRAITS.join(", ")}`;
      if (typeof a.on !== "boolean") return "on must be true (to give) or false (to take)";
      const who = handOf(world).resting!.agents.find((x) => x.id === a.agent)!,
        has = who.traits?.includes(t) ?? false;
      if (a.on && has) return "they are so already";
      if (!a.on && !has) return "they are not so";
      const against = opposedTo(t);
      return a.on && against && who.traits?.includes(against)
        ? `the ${against} cannot be made ${t}: take that first`
        : null;
    },
    apply: (command, t) => {
      const c = ctx(),
        w = handOf(world).resting!,
        {
          agent: id,
          trait,
          on,
        } = command.args as { agent: number; trait: PersonTrait; on: boolean },
        a = w.agents.find((x) => x.id === id)!,
        year = yearOfMoment(t);
      a.traits = on ? [...(a.traits ?? []), trait] : (a.traits ?? []).filter((x) => x !== trait);
      const event = world.events.emit({
        type: LOCAL_ACT_EVENTS.traitOne.type,
        subjects: [w.village],
        place: c.provinces.get(w.cell)!.ref,
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: {
          agent: id,
          name: agentName(c, a, c.settlements.get(w.village)!),
          age: year - a.birthYear,
          trait,
          on,
        },
      });
      w.notables = [...(w.notables ?? []), { agent: id, deed: event }];
    },
  });
}
