// The god's great acts (docs/architecture §3.1, Phase 6 M65): acts on a whole world and
// on a star, beside the acts on a land. A world warmed or cooled for up to a thousand years, or for
// good (the climate's own rules read it as warming: rain moves, hot fields yield less; and as its
// ground follows over a generation, its ice, tundra, woods and deserts move by the rule that named
// them, opening land to live on and closing it: groundWarming); a star made
// to flare or to calm for up to a thousand years (every land under its light — the home system's
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
import { actFactor, actStrengthOf, strengthMark, strengthProblem } from "./acts.ts";
import { SPAN_MOST } from "./fortune.ts";

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

/**
 * The degrees a world is warmed or cooled at each strength (asked 2026-11-14: "heat or cool the world ... make more
 * habitable land sometimes"): a degree and a half at the strength of old, as it always was, and doubling past it, to
 * twelve at the greatest (an ice age is five or six colder than now).
 */
export const WARM_DEGREES: Readonly<Record<number, number>> = {
  0.5: 0.75,
  1: 1.5,
  1.5: 3,
  2: 6,
  3: 12,
};
export const warmDegrees = (strength: number | undefined): number =>
  WARM_DEGREES[strength ?? 1] ?? GREAT_ACT_STRENGTH.warm * (strength ?? 1);
/** A world warmed or cooled for good: its act ends this long after it was laid (longer than any world is watched). */
export const EVER = 1_000_000 * YEAR;
/** The years a world's ground takes to follow its air, warming or easing back, and the step it is read in (degrees). */
export const GROUND = { years: 30, step: 0.25 } as const;

export type GreatAct = {
  readonly command: Ref;
  readonly event: Ref;
  readonly kind: "warm" | "flare";
  /** The world (its planet) or the star it falls on. */
  readonly target: Ref;
  readonly sign: 1 | -1;
  readonly from: number;
  readonly until: number;
  /** How strong it was laid, where not at the strength it always had (1: absent). */
  readonly strength?: number;
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
  return a ? a.sign * warmDegrees(a.strength) : 0;
}

/** The warming or cooling the ground of a world follows now: the latest laid, holding or lifted (null: none ever). */
export function warmingAct(world: World, planet: Ref): GreatAct | null {
  let a: GreatAct | null = null;
  for (const x of greatActsOf(world)?.all() ?? [])
    if (x.kind === "warm" && x.target === planet && x.from <= world.now) a = x;
  return a;
}

// (The last world asked and when: one world runs at a time, and another asked in between is only reckoned again.)
const GROUND_NOW: { world: World | null; t: number; warm: number } = {
  world: null,
  t: -1,
  warm: 0,
};
/**
 * The degrees a world's ground has turned by the god's warming or cooling: what its ice, its woods and its deserts
 * answer to, and so what land can be lived on and farmed (population/model.ts biomeUnder). It follows the air over a
 * generation from the day the act was laid, and eases back over as long when it lifts; read in quarter degrees, so a
 * land's yield is reckoned again only as it moves. Exactly 0 on a world no god has warmed, and nothing kept: a pure
 * reading of the acts, asked once a moment.
 */
export function groundWarming(world: World, planet: Ref): number {
  const now = world.now,
    kept = GROUND_NOW;
  if (kept.world === world && kept.t === now) return kept.warm;
  let warm = 0;
  const a = greatActsOf(world)?.all().length ? warmingAct(world, planet) : null;
  if (a) {
    const span = GROUND.years * YEAR,
      rise = Math.min(1, (Math.min(now, a.until) - a.from) / span),
      fall = now < a.until ? 1 : Math.max(0, 1 - (now - a.until) / span),
      deg = a.sign * warmDegrees(a.strength) * rise * fall;
    // (Never a nought with a sign: the ground as it was made is 0.)
    warm = Math.trunc(deg / GROUND.step) * GROUND.step || 0;
  }
  kept.world = world;
  kept.t = now;
  kept.warm = warm;
  return warm;
}

/** The hazard a star's flare or calm lays on the lands under its light now (1: none). */
export function starHazard(world: World, star: Ref): { factor: number; act: GreatAct | null } {
  const a = greatActsOf(world)?.at("flare", star, world.now) ?? null;
  return {
    factor: !a
      ? 1
      : a.strength === undefined
        ? a.sign < 0
          ? GREAT_ACT_STRENGTH.flare
          : GREAT_ACT_STRENGTH.calm
        : a.sign < 0
          ? actFactor(true, GREAT_ACT_STRENGTH.flare - 1, a.strength)
          : actFactor(false, 1 - GREAT_ACT_STRENGTH.calm, a.strength),
    act: a,
  };
}

/**
 * Teach a world the great acts: "act.warm" on the world ({ sign, years } up to a thousand
 * years, or { sign, ever: true } for good) and "act.flare" on a star ({ star, sign, years }: −1 flares,
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
      const a = args as { sign?: unknown; years?: unknown; ever?: unknown } | null;
      if (!a || (a.sign !== 1 && a.sign !== -1)) return "sign must be 1 or -1";
      if (a.ever !== undefined && a.ever !== true) return "ever is true or left out";
      if (a.ever === true && a.years !== undefined) return "for good, or for so many years";
      if (a.ever === true) return strengthProblem(a);
      if (!Number.isInteger(a.years) || (a.years as number) < 1 || (a.years as number) > SPAN_MOST)
        return `years must be from 1 to ${SPAN_MOST}`;
      return strengthProblem(a);
    },
    apply: (command, t) => {
      const a = command.args as { sign: 1 | -1; years?: number; ever?: true },
        strong = strengthMark(actStrengthOf(a));
      const event = world.events.emit({
        type: GREAT_ACT_EVENTS.warm.type,
        place: null,
        subjects: [planet],
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: {
          sign: a.sign,
          ...(a.ever ? { ever: true } : { years: a.years }),
          ...strong,
          // (Told only where it is not the degree and a half it always was.)
          ...(strong.strength === undefined ? {} : { degrees: warmDegrees(strong.strength) }),
        },
      });
      store.add({
        command: command.id,
        event,
        kind: "warm",
        target: planet,
        sign: a.sign,
        from: t,
        until: a.ever ? t + EVER : t + a.years! * YEAR,
        ...strong,
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
      if (!Number.isInteger(a.years) || (a.years as number) < 1 || (a.years as number) > SPAN_MOST)
        return `years must be from 1 to ${SPAN_MOST}`;
      return strengthProblem(a);
    },
    apply: (command, t) => {
      const a = command.args as { star: Ref; sign: 1 | -1; years: number },
        strong = strengthMark(actStrengthOf(a));
      const event = world.events.emit({
        type: GREAT_ACT_EVENTS.flare.type,
        place: null,
        subjects: [a.star],
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: { sign: a.sign, years: a.years, ...strong },
      });
      store.add({
        command: command.id,
        event,
        kind: "flare",
        target: a.star,
        sign: a.sign,
        from: t,
        until: t + a.years * YEAR,
        ...strong,
      });
    },
  });
  return store;
}
