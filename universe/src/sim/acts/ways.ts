// The god's hand on a people's ways, speech and faith (Phase 14 M117): what WorldBox lets a god
// do to its peoples' cultures, languages and religions — a people's ways pushed (more warlike,
// more devout, more open…), a land taught another tongue or given a tongue of its own, a faith
// founded in a land. Each is a logged command whose event cites it; what follows is the
// simulation's own: ways drift back toward what moved them and on, a new tongue spreads to its
// kin or dies out, a new faith spreads to those who speak alike or splits far from its seat.
import {
  defineEventType,
  defineStream,
  yearOfMoment,
  type Ref,
  type World,
} from "../../kernel/index.ts";
import { shiftTongue, tongueName } from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, WAY_TRAITS, cultureOf, pushWays, type WayTrait } from "../culture/culture.ts";
import { LANGUAGE, LANGUAGE_EVENTS, freshName, languagesOf } from "../culture/languages.ts";
import { BELIEF_EVENTS, FAITH, TENETS, beliefOf, faithName, type Tenet } from "../belief/belief.ts";

export const WAYS_ACT_EVENTS = {
  ways: defineEventType("act.ways", 5),
  tongue: defineEventType("act.tongue", 5),
};

/** How far the god's push moves a people's ways (they run 0 … 1), and their base with them. */
export const WAYS_PUSH = 0.25;

/** A new tongue's own drift from the speech it grew from, in shifts of the land's tongue. */
const NEW_TONGUE_SHIFTS = 6;
const WAYS_SPEECH = defineStream("act.ways.speech");

export type WaysArgs = { cell: number; way: WayTrait; sign: 1 | -1 };
export type TongueArgs = { cell: number; language: Ref };
export type FaithArgs = { cell: number; tenet: Tenet };
type LandArgs = { cell: number };

/** Teach a peopled world the god's hand on its peoples' ways, speech and faith. */
export function installWaysActs(world: World, ctx: () => PopulationContext): void {
  const agent = (command: { id: Ref }) => [{ ref: command.id, role: "agent" as const, weight: 1 }],
    peopled = (cell: unknown): string | null => {
      if (!Number.isInteger(cell)) return "a land is wanted";
      const c = ctx();
      if (!((c.provinces.get(cell as number)?.total() ?? 0) > 0)) return "no one lives there";
      return cultureOf(world).get(cell as number) ? null : "they have no ways of their own yet";
    };

  // A people's ways pushed: one of them more, or less, held — and their base with it, so it lasts.
  world.defineCommand({
    type: "act.ways",
    validate: (args) => {
      const a = args as Partial<WaysArgs> | null,
        bad = peopled(a?.cell);
      if (bad) return bad;
      if (!(WAY_TRAITS as readonly string[]).includes(a!.way as string))
        return `a way is wanted: ${WAY_TRAITS.join(", ")}`;
      return a!.sign === 1 || a!.sign === -1 ? null : "sign must be 1 or -1";
    },
    apply: (command, t) => {
      const { cell, way, sign } = command.args as WaysArgs,
        c = ctx(),
        ways = cultureOf(world).get(cell)!,
        trait = WAY[way],
        year = yearOfMoment(t),
        event = world.events.emit({
          type: WAYS_ACT_EVENTS.ways.type,
          subjects: [c.provinces.get(cell)!.ref],
          place: c.provinces.get(cell)!.ref,
          causes: agent(command),
          data: { way, sign },
        });
      pushWays(ways, { event, year, trait, amount: sign * WAYS_PUSH });
      ways.base[trait] = Math.max(0.02, Math.min(0.98, ways.base[trait]! + sign * WAYS_PUSH));
    },
  });

  // A land taught another tongue: it speaks it, as its standard is spoken.
  world.defineCommand({
    type: "act.tongue",
    validate: (args) => {
      const a = args as Partial<TongueArgs> | null,
        bad = peopled(a?.cell);
      if (bad) return bad;
      const store = languagesOf(world),
        l = typeof a?.language === "string" ? store.get(a.language as Ref) : undefined;
      if (!l) return "a tongue is wanted";
      if (l.died !== null) return `${l.name} is spoken no more`;
      return store.of(a!.cell!) === l ? `they speak ${l.name} already` : null;
    },
    apply: (command) => {
      const { cell, language } = command.args as TongueArgs,
        c = ctx(),
        store = languagesOf(world),
        l = store.get(language)!,
        event = world.events.emit({
          type: WAYS_ACT_EVENTS.tongue.type,
          subjects: [l.ref, c.provinces.get(cell)!.ref],
          place: c.provinces.get(cell)!.ref,
          causes: agent(command),
          data: { name: l.name },
        });
      store.speak(cell, l.index, event);
      cultureOf(world).get(cell)!.tongue = { ...l.standard };
    },
  });

  // A tongue of their own: the land's speech, drifted a little further, a language of its own —
  // a daughter of the one it spoke, in the same family.
  world.defineCommand({
    type: "act.newtongue",
    validate: (args) => {
      const cell = (args as Partial<LandArgs> | null)?.cell,
        bad = peopled(cell);
      if (bad) return bad;
      return languagesOf(world).of(cell!) ? null : "they speak no tongue yet to grow from";
    },
    apply: (command, t) => {
      const cell = (command.args as LandArgs).cell,
        c = ctx(),
        store = languagesOf(world),
        was = store.of(cell)!,
        ways = cultureOf(world).get(cell)!,
        year = yearOfMoment(t);
      let tongue = ways.tongue;
      for (let k = 0; k < NEW_TONGUE_SHIFTS; k++)
        tongue = shiftTongue(tongue, world.rng.real(WAYS_SPEECH, cell, t, k));
      ways.tongue = tongue;
      const index = store.all().length,
        name = freshName(store, tongue, cell ^ (year << 12)),
        event = world.events.emit({
          type: LANGUAGE_EVENTS.arose.type,
          subjects: [was.ref],
          place: c.provinces.get(cell)!.ref,
          causes: agent(command),
          data: { name, from: was.name, kept: 0, year },
        });
      store.add({
        ref: world.minter.mint(LANGUAGE),
        index,
        name,
        parent: was.index,
        family: was.family,
        born: year,
        event,
        home: cell,
        standard: tongue,
        died: null,
      });
      store.speak(cell, index, event);
    },
  });

  // A faith founded in a land: its tenet the god's choosing, its name in the land's tongue.
  world.defineCommand({
    type: "act.faith",
    validate: (args) => {
      const a = args as Partial<FaithArgs> | null,
        bad = peopled(a?.cell);
      if (bad) return bad;
      return (TENETS as readonly string[]).includes(a!.tenet as string)
        ? null
        : `a tenet is wanted: ${TENETS.join(", ")}`;
    },
    apply: (command, t) => {
      const { cell, tenet } = command.args as FaithArgs,
        c = ctx(),
        store = beliefOf(world),
        ways = cultureOf(world).get(cell)!,
        now = store.of(cell),
        year = yearOfMoment(t),
        ref = world.minter.mint(FAITH),
        name = faithName(
          tenet,
          tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ 0xfa17 }, cell),
        ),
        event = world.events.emit({
          type: BELIEF_EVENTS.founded.type,
          subjects: [ref],
          place: c.provinces.get(cell)!.ref,
          causes: agent(command),
          data: { name, tenet },
        });
      store.add({ ref, name, tenet, founded: year, event, seat: cell, from: now.faith });
      store.set(cell, { faith: ref, since: year, event });
    },
  });
}
