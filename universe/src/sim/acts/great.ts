// The god's great acts (docs/architecture §3.1, Phase 6 M65): acts on a whole world and
// on a star, beside the acts on a land. A world warmed or cooled for up to a century (the
// climate's own rules read it as warming: rain moves, hot fields yield less); a star made
// to flare or to calm for up to a decade (every land under its light — the home system's
// halls, a colony at another star, a ship near it — finds death the likelier or the
// rarer). Each is a logged command whose event cites it; what follows cites the event.
import {
  YEAR,
  defineEventType,
  type Hasher,
  type Ref,
  type StateStore,
  type World,
} from "../../kernel/index.ts";

export const GREAT_ACT_EVENTS = {
  warm: defineEventType("act.warm", 6),
  flare: defineEventType("act.flare", 6),
};

/** How strongly a great act moves what it touches. */
export const GREAT_ACT_STRENGTH = {
  /** Degrees the world is warmed (or cooled). */
  warm: 1.5,
  /** Under a flare, deaths this many times as likely; under a calm, this share of them. */
  flare: 2,
  calm: 0.8,
} as const;

export type GreatAct = {
  readonly command: Ref;
  readonly event: Ref;
  readonly kind: "warm" | "flare";
  /** The world (its planet) or the star it falls on. */
  readonly target: Ref;
  readonly sign: 1 | -1;
  readonly from: number;
  readonly until: number;
};

export class GreatActStore implements StateStore {
  readonly name = "acts.great";
  private list: GreatAct[] = [];

  add(a: GreatAct): void {
    this.list.push(a);
  }
  all(): readonly GreatAct[] {
    return this.list;
  }
  /** The latest great act of a kind in force on a target at time t. */
  at(kind: GreatAct["kind"], target: Ref, t: number): GreatAct | null {
    let found: GreatAct | null = null;
    for (const a of this.list)
      if (a.kind === kind && a.target === target && a.from <= t && t < a.until) found = a;
    return found;
  }
  pinned(): Ref[] {
    return this.list.map((a) => a.event);
  }
  hashInto(h: Hasher): void {
    h.value(this.list);
  }
  save(): unknown {
    return { acts: this.list };
  }
  load(state: unknown): void {
    this.list = [...(state as { acts: GreatAct[] }).acts];
  }
}

export function greatActsOf(world: World): GreatActStore | null {
  return world.hasStore("acts.great") ? world.store<GreatActStore>("acts.great") : null;
}

/** The god's warming of a world now (degrees; 0 when none). */
export function divineWarming(world: World, planet: Ref): number {
  const a = greatActsOf(world)?.at("warm", planet, world.now);
  return a ? a.sign * GREAT_ACT_STRENGTH.warm : 0;
}

/** The hazard a star's flare or calm lays on the lands under its light now (1: none). */
export function starHazard(world: World, star: Ref): { factor: number; act: GreatAct | null } {
  const a = greatActsOf(world)?.at("flare", star, world.now) ?? null;
  return {
    factor: !a ? 1 : a.sign < 0 ? GREAT_ACT_STRENGTH.flare : GREAT_ACT_STRENGTH.calm,
    act: a,
  };
}

/**
 * Teach a world the great acts: "act.warm" on the world ({ sign, years } up to a
 * century) and "act.flare" on a star ({ star, sign, years } up to a decade: −1 flares,
 * +1 calms). `stars` says which star refs the god can touch.
 */
export function installGreatActs(
  world: World,
  planet: Ref,
  stars: (ref: string) => boolean,
): GreatActStore {
  const store = world.register(new GreatActStore());
  world.addPinner(() => store.pinned());
  world.defineCommand({
    type: "act.warm",
    validate: (args) => {
      const a = args as { sign?: unknown; years?: unknown } | null;
      if (!a || (a.sign !== 1 && a.sign !== -1)) return "sign must be 1 or -1";
      if (!Number.isInteger(a.years) || (a.years as number) < 1 || (a.years as number) > 100)
        return "years must be from 1 to 100";
      return null;
    },
    apply: (command, t) => {
      const a = command.args as { sign: 1 | -1; years: number };
      const event = world.events.emit({
        type: GREAT_ACT_EVENTS.warm.type,
        place: null,
        subjects: [planet],
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: { sign: a.sign, years: a.years },
      });
      store.add({
        command: command.id,
        event,
        kind: "warm",
        target: planet,
        sign: a.sign,
        from: t,
        until: t + a.years * YEAR,
      });
    },
  });
  world.defineCommand({
    type: "act.flare",
    validate: (args) => {
      const a = args as { star?: unknown; sign?: unknown; years?: unknown } | null;
      if (!a || typeof a.star !== "string" || !stars(a.star))
        return "star must be a star within reach";
      if (a.sign !== 1 && a.sign !== -1) return "sign must be 1 or -1";
      if (!Number.isInteger(a.years) || (a.years as number) < 1 || (a.years as number) > 10)
        return "years must be from 1 to 10";
      return null;
    },
    apply: (command, t) => {
      const a = command.args as { star: Ref; sign: 1 | -1; years: number };
      const event = world.events.emit({
        type: GREAT_ACT_EVENTS.flare.type,
        place: null,
        subjects: [a.star],
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: { sign: a.sign, years: a.years },
      });
      store.add({
        command: command.id,
        event,
        kind: "flare",
        target: a.star,
        sign: a.sign,
        from: t,
        until: t + a.years * YEAR,
      });
    },
  });
  return store;
}
