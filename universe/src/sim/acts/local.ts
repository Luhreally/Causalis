// The god's acts on a place and on a person (docs/architecture §3.1): the grammar's
// finer scales. On a place — a village or a city: a shrine raised (a sign the
// devout read), a fire sent (a city's quarters burn and some die), a spring opened
// (the village draws people to it). On a person — only where the hand rests, since
// only there are people the world's own: inspiration (their land comes upon the
// next thing it could know, and they are remembered for it) and blessing (they are
// spared death for twenty years). Each is a logged command whose event cites it;
// what follows is the simulation's own.
import { defineEventType, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { BANDS, PRINCIPLES } from "../../rules/index.ts";
import { cradleTongue, tonguePersonName } from "../../gen/index.ts";
import { COLS } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Settlement } from "../population/stores.ts";
import { handOf, type Agent } from "../hand/hand.ts";
import { cultureOf } from "../culture/culture.ts";
import { citiesOf, USE } from "../city/city.ts";
import { knows, loreOf } from "../lore/lore.ts";

export const LOCAL_ACT_EVENTS = {
  shrine: defineEventType("act.shrine", 5),
  fire: defineEventType("act.fire", 5),
  spring: defineEventType("act.spring", 5),
  inspireOne: defineEventType("act.inspire-one", 5),
  blessOne: defineEventType("act.bless-one", 4),
};

type PlaceArgs = { village: Ref };
type PersonArgs = { agent: number };

/** One of the hand's people by name, in their land's tongue: "Asha of Kirath". */
export function agentName(ctx: PopulationContext, a: Agent, v: Settlement): string {
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
        data: { name: v.name },
      });
    },
  });

  world.defineCommand({
    type: "act.fire",
    validate: (args) => {
      const problem = village(args);
      if (problem) return problem;
      return citiesOf(world).get((args as PlaceArgs).village)
        ? null
        : "only a city burns: this is a village";
    },
    apply: (command, t) => {
      const c = ctx(),
        v = c.settlements.get((command.args as PlaceArgs).village)!,
        city = citiesOf(world).get(v.ref)!,
        year = yearOfMoment(t);
      // A fifth of the built blocks burn, the nearest the middle first; a hundredth of the people die.
      const built = city.uses
          .map((u, k) => ({ u, k }))
          .filter((b) => b.u !== USE.open && b.u !== USE.temple),
        burnt = built.slice(0, Math.ceil(built.length / 5));
      for (const b of burnt) city.uses[b.k] = USE.open;
      const p = c.provinces.get(v.cell)!;
      let dead = Math.round(v.population / 100);
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
        data: { name: v.name, blocks: burnt.length },
      });
    },
  });

  world.defineCommand({
    type: "act.spring",
    validate: (args) =>
      village(args) ??
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
        data: { name: v.name },
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
          (p) => p.rate > 0 && !lore.get(w.cell, p.id) && p.needs.every((n) => knows(c, w.cell, n)),
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
      a.blessedUntil = year + 20;
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
}
