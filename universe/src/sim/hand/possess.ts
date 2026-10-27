// The god's hand made flesh, as history keeps it (Phase 60): one of the hand's people taken over
// and steered by hand, in the town the hand rests on. Taking him lays a small world about him —
// the bodies near, where the view drew them, each with its day's way ahead; the town's solids and
// the places of its work and its stores — and each second of it the page sends twenty bids
// (`possess.input`), kept in the hand's store with the second each was stepped at, and the small
// world is stepped by them on keyed draws of its own (rules/possess.ts). Letting go writes back
// what lasts: those struck down dead die as the hand's people die (out of the counts, among the
// year's dead and their family's gone); those struck down who live keep the blow, their wounds
// told from it on the part struck (host/wounds.ts handWound); a thing made by hand is the town's,
// made by him (the market's made); goods carried off leave its stores; a word heard moves the
// hearer's spirits. All told as the god's hand. Nothing here is kept until a body is taken, so a
// world where no one was possessed keeps every hash.
import {
  MONTH,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Ref,
  type World,
} from "../../kernel/index.ts";
import {
  BODY_NATURE,
  HAND_FORMS,
  POSSESS_HZ,
  POSSESS_MOST,
  TRADE_PLACE,
  WORK_PLACES,
  bidsOf,
  localBody,
  localWorld,
  copyLocal,
  moodAt,
  stepLocal,
  woundCare,
  type HandDeed,
  type LifeHistory,
  type LocalBody,
  type LocalDraw,
  type LocalScene,
  type LocalWorld,
  type WorkPlace,
} from "../../rules/index.ts";
import { row } from "../population/model.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { loreOf } from "../lore/lore.ts";
import { agentName } from "../acts/local.ts";
import {
  GONE_KEPT,
  bandOfAge,
  handOf,
  type Agent,
  type PersonTrait,
  type Possession,
  type Window,
} from "./hand.ts";

export const POSSESS_EVENTS = {
  possessed: defineEventType("hand.possessed", 5),
  released: defineEventType("hand.released", 4),
  made: defineEventType("hand.made", 4),
  struck: defineEventType("hand.struck", 4),
  took: defineEventType("hand.took", 3),
  spoke: defineEventType("hand.spoke", 2),
};

/** The small world's own draws, keyed by whom, the step (counted from the possession's first second), and what for. */
export const HAND_POSSESS = defineStream("hand.possess");

/** Where the view drew a body, and how it goes: metres from the town's middle, radians, the view's task (-1: none), its walking pace. */
export type BodyAt = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly task: number;
  readonly pace: number;
};
/** One of the hand's people near the possessed, as the page saw them: who, where, and their day's way ahead (step, x, z, yaw, task each). */
export type NearArgs = BodyAt & { readonly id: number; readonly ways: readonly number[] };
/** One coming into the small world at a step of a second (0 … 19); one in it already takes the way given. */
export type JoinArgs = NearArgs & { readonly when: number };
export type TakeArgs = {
  /** The one taken (Agent.id), and where he was drawn. */
  readonly agent: number;
  readonly at: BodyAt;
  /** His trade by what his hands make, and the day's thing it makes (rules/possess.ts TRADE_PLACE, HAND_FORMS; "" none). */
  readonly trade: string;
  readonly form: string;
  readonly near: readonly NearArgs[];
  readonly solids: readonly number[];
  readonly places: readonly WorkPlace[];
};
/** A second's bids: the step it begins at, twenty bids in letters (rules/possess.ts bidLetters), and those joining. */
export type InputArgs = {
  readonly step: number;
  readonly steps: string;
  readonly joins?: readonly JoinArgs[];
};
/** Letting go: the bids of the second begun (at most twenty), and those joining it. */
export type ReleaseArgs = InputArgs;

const finite = (v: unknown, most: number): boolean =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= most;

/** Why a body's place is not one (null: it is). */
function atProblem(v: unknown): string | null {
  const a = v as Partial<BodyAt> | null;
  return a &&
    finite(a.x, 1e5) &&
    finite(a.z, 1e5) &&
    finite(a.yaw, 100) &&
    Number.isInteger(a.task) &&
    a.task! >= -1 &&
    a.task! < 256 &&
    finite(a.pace, 20) &&
    a.pace! > 0
    ? null
    : "a body is where it stands: x, z, yaw, task and pace";
}

/** Why bodies are not bodies (null: they are). */
function nearProblem(v: unknown, most: number, joining: boolean): string | null {
  if (!Array.isArray(v) || v.length > most) return `at most ${most} bodies come at once`;
  for (const n of v as Partial<JoinArgs>[]) {
    if (!n || !Number.isInteger(n.id) || n.id! < 0) return "a body is one of the hand's people";
    const bad = atProblem(n);
    if (bad) return bad;
    const w = n.ways;
    if (
      !Array.isArray(w) ||
      w.length % 5 ||
      w.length > POSSESS_MOST.ways * 5 ||
      !w.every((x) => finite(x, 1e13))
    )
      return `a body's way is step, x, z, yaw and task, ${POSSESS_MOST.ways} at most`;
    if (joining && (!Number.isInteger(n.when) || n.when! < 0 || n.when! >= POSSESS_HZ))
      return "one joins at a step of the second";
  }
  return null;
}

/** Why the town's solids and places are not (null: they are). */
function sceneProblem(a: Partial<TakeArgs>): string | null {
  const s = a.solids;
  if (
    !Array.isArray(s) ||
    s.length % 7 ||
    s.length > POSSESS_MOST.solids * 7 ||
    !s.every((x) => finite(x, 1e5))
  )
    return `the town's solids are x, z, r, ax, az, half, across each, ${POSSESS_MOST.solids} at most`;
  const p = a.places;
  if (!Array.isArray(p) || p.length > POSSESS_MOST.places)
    return `at most ${POSSESS_MOST.places} places`;
  for (const q of p as Partial<WorkPlace>[])
    if (
      !q ||
      !(WORK_PLACES as readonly string[]).includes(q.kind as string) ||
      !finite(q.x, 1e5) ||
      !finite(q.z, 1e5) ||
      !finite(q.yaw, 100) ||
      (q.w !== undefined && (!finite(q.w, 1e4) || q.w <= 0)) ||
      (q.d !== undefined && (!finite(q.d, 1e4) || q.d <= 0))
    )
      return "a place is a kind of the town's, where one stands at it and which way they face";
  return null;
}

/** One of the hand's people by id (they are kept in the order they came: found by halving). */
export function agentById(w: Window, id: number): Agent | undefined {
  const list = w.agents;
  let lo = 0,
    hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid]!.id < id) lo = mid + 1;
    else hi = mid;
  }
  return list[lo]?.id === id ? list[lo] : list.find((a) => a.id === id);
}

/** A body of the small world for one of the hand's people: what they are like, as strong as their age and nature. */
export function bodyFor(
  a: Agent,
  at: BodyAt,
  ways: readonly number[],
  t: number,
  life: LifeHistory,
  hand = false,
): LocalBody {
  const year = yearOfMoment(t),
    age = year - a.birthYear,
    child = age < life.adulthood,
    old = age >= life.bands[life.bands.length - 2]!,
    has = (trait: PersonTrait) => a.traits?.includes(trait) ?? false,
    N = BODY_NATURE,
    nature =
      (has("brave") ? N.brave : 0) |
      (has("kind") ? N.kind : 0) |
      (has("greedy") ? N.greedy : 0) |
      (has("pious") ? N.pious : 0) |
      (has("hardy") ? N.hardy : 0) |
      (has("frail") ? N.frail : 0) |
      (child ? N.child : 0) |
      (old ? N.old : 0),
    // (A blow in the last month not yet healed leaves them the weaker.)
    sore = a.struck?.some((h) => t - h.at < MONTH) ?? false,
    strength =
      (child ? 0.5 : old ? 0.7 : 1) *
      (has("hardy") ? 1.15 : 1) *
      (has("frail") ? 0.8 : 1) *
      (sore ? 0.6 : 1);
  return localBody(a.id, at, nature, strength, ways, hand);
}

/** The care for wounds a land knows (rules/wounds.ts woundCare), by its lore. */
function careIn(world: World, cell: number, year: number): number {
  const lore = loreOf(world);
  return woundCare((id) => (lore.get(cell, id)?.year ?? Infinity) <= year);
}

/** The small world's draws for a possession. */
function drawsOf(world: World, p: Possession): LocalDraw {
  const at = p.from * POSSESS_HZ;
  return (subject, step, purpose, n = 0) =>
    world.rng.real(HAND_POSSESS, subject, at + step, purpose, n);
}

/**
 * A possession's small world `l` stepped by a second's bids (or fewer, letting go): those of its
 * bodies who have died of their years since it was last stepped go from it, and those joining come
 * in at their steps. It stops where the possessed is struck down.
 */
function advance(
  world: World,
  life: LifeHistory,
  w: Window,
  p: Possession,
  l: LocalWorld,
  letters: string,
  joins: readonly JoinArgs[],
  t: number,
): void {
  const last = p.inputs.at(-1)?.at ?? p.from;
  // (The hand's people die only as the months are reckoned: looked for when one has passed.)
  if (Math.floor(t / MONTH) !== Math.floor(last / MONTH))
    l.bodies = l.bodies.filter((b, i) => i === 0 || agentById(w, b.id) !== undefined);
  const bids = bidsOf(letters)!,
    draw = drawsOf(world, p);
  for (let k = 0; k < bids.length && !l.ended; k++) {
    const coming: LocalBody[] = [];
    for (const j of joins) {
      if (j.when !== k) continue;
      const a = agentById(w, j.id);
      if (a && a.id !== p.agent) coming.push(bodyFor(a, j, j.ways, t, life));
    }
    stepLocal(p.scene, l, bids[k]!, draw, coming);
  }
}

/**
 * The small world of the one possessed as the bids not yet sent would make it (the host's, for the
 * page between the seconds it sends): a copy of the kept one stepped by them, as the next second's
 * command will step it at `t` — the kept one untouched; or `onto`, a copy already stepped by the
 * second's first bids, stepped on by the rest (`joins` then counted from the first of them). Null:
 * no one is possessed, or the bids or those joining are not (as the command would refuse them).
 */
export function possessionAhead(
  world: World,
  life: LifeHistory,
  letters: string,
  joins: readonly JoinArgs[] = [],
  t: number = world.now + 1,
  onto?: LocalWorld,
): LocalWorld | null {
  const w = handOf(world).resting,
    p = w?.possessed;
  if (!w || !p || letters.length > POSSESS_HZ * 3 || !bidsOf(letters)) return null;
  if (nearProblem(joins, POSSESS_MOST.joins, true)) return null;
  const l = onto ?? copyLocal(p.local);
  advance(world, life, w, p, l, letters, joins, t);
  return l;
}

/** Teach a peopled world possession: "possess.take", "possess.input" a second at a time, "possess.release". */
export function installPossession(world: World, ctx: () => PopulationContext): void {
  const resting = () => handOf(world).resting;

  world.defineCommand({
    type: "possess.take",
    validate: (args) => {
      const w = resting();
      if (!w) return "your hand rests on no town: lay it on one to take one of its people";
      if (w.possessed) return "your hand is in one of its people already: let them go first";
      const a = args as Partial<TakeArgs> | null;
      if (!a || !Number.isInteger(a.agent)) return "agent must be one of the hand's people";
      if (!agentById(w, a.agent!)) return "no such person under your hand";
      if (typeof a.trade !== "string" || (a.trade !== "" && !Object.hasOwn(TRADE_PLACE, a.trade)))
        return `a trade is one of ${Object.keys(TRADE_PLACE).join(", ")}, or none`;
      if (typeof a.form !== "string" || (a.form !== "" && !Object.hasOwn(HAND_FORMS, a.form)))
        return "a thing made by hand is one of the day's things";
      return (
        atProblem(a.at) ?? nearProblem(a.near, POSSESS_MOST.bodies - 1, false) ?? sceneProblem(a)
      );
    },
    apply: (command, t) => {
      const c = ctx(),
        w = resting()!,
        a = command.args as TakeArgs,
        v = c.settlements.get(w.village)!,
        me = agentById(w, a.agent)!,
        name = agentName(c, me, v),
        scene: LocalScene = {
          x: a.at.x,
          z: a.at.z,
          solids: [...a.solids],
          places: a.places.map((p) => ({ ...p })),
          trade: a.trade,
          form: a.form,
          care: careIn(world, w.cell, yearOfMoment(t)),
        },
        bodies = [bodyFor(me, a.at, [], t, c.life, true)];
      // (Those of the hand's people near him; one died since the page drew them is not.)
      for (const n of a.near) {
        const ag = agentById(w, n.id);
        if (ag && ag.id !== me.id && !bodies.some((b) => b.id === n.id))
          bodies.push(bodyFor(ag, n, n.ways, t, c.life));
      }
      const event = world.events.emit({
        type: POSSESS_EVENTS.possessed.type,
        subjects: [w.village],
        place: c.provinces.get(w.cell)!.ref,
        causes: [
          { ref: command.id, role: "agent", weight: 0.8 },
          { ref: w.event, role: "enabler", weight: 0.2 },
        ],
        data: { agent: me.id, name, town: v.name, trade: a.trade, form: a.form },
      });
      w.notables = [...(w.notables ?? []), { agent: me.id, deed: event }];
      w.possessed = {
        agent: me.id,
        name,
        command: command.id,
        event,
        from: t,
        scene,
        local: localWorld(0, bodies),
        inputs: [],
      };
    },
  });

  /** Why a second's bids (or a letting go's) cannot be taken (null: they can). */
  const bidsProblem = (args: unknown, whole: boolean): string | null => {
    const p = resting()?.possessed;
    if (!p) return "no one is possessed";
    const a = args as Partial<InputArgs> | null;
    if (!a || a.step !== p.local.step) return `out of step: it stands at step ${p.local.step}`;
    if (
      typeof a.steps !== "string" ||
      (whole ? a.steps.length !== POSSESS_HZ * 3 : a.steps.length > POSSESS_HZ * 3) ||
      !bidsOf(a.steps)
    )
      return whole
        ? `a second's bids are ${POSSESS_HZ}, three letters each`
        : `the bids of a second begun: at most ${POSSESS_HZ}, three letters each`;
    return a.joins === undefined ? null : nearProblem(a.joins, POSSESS_MOST.joins, true);
  };

  world.defineCommand({
    type: "possess.input",
    validate: (args) => bidsProblem(args, true),
    apply: (command, t) => {
      const w = resting()!,
        p = w.possessed!,
        a = command.args as InputArgs;
      advance(world, ctx().life, w, p, p.local, a.steps, a.joins ?? [], t);
      p.inputs.push({ at: t, steps: a.steps });
      // Struck down, or dead of his years: the hand lets him go.
      if (p.local.ended || !agentById(w, p.agent)) letGo(world, ctx(), w, command.id, t);
    },
  });

  world.defineCommand({
    type: "possess.release",
    validate: (args) => bidsProblem(args, false),
    apply: (command, t) => {
      const w = resting()!,
        p = w.possessed!,
        a = command.args as ReleaseArgs;
      if (a.steps) {
        advance(world, ctx().life, w, p, p.local, a.steps, a.joins ?? [], t);
        p.inputs.push({ at: t, steps: a.steps });
      }
      letGo(world, ctx(), w, command.id, t);
    },
  });
}

/** Let go: what was done in the god's body written back, and told. */
function letGo(world: World, c: PopulationContext, w: Window, cause: Ref, t: number): void {
  const p = w.possessed!,
    l = p.local,
    v = c.settlements.get(w.village)!,
    prov = c.provinces.get(w.cell)!,
    year = yearOfMoment(t),
    market = marketsOf(world).get(w.cell),
    deeds = l.deeds,
    nameOf = (id: number) => {
      if (id === p.agent) return p.name;
      const a = agentById(w, id);
      return a ? agentName(c, a, v) : "one of the town";
    },
    emit = (type: string, data: Record<string, unknown>, importance?: number) =>
      world.events.emit({
        type,
        subjects: [w.village],
        place: prov.ref,
        causes: [
          { ref: cause, role: "agent", weight: 0.7 },
          { ref: p.event, role: "enabler", weight: 0.3 },
        ],
        ...(importance !== undefined ? { importance } : {}),
        data,
      }),
    notable = (agent: number, deed: Ref) => (w.notables = [...(w.notables ?? []), { agent, deed }]),
    of = <K extends HandDeed["kind"]>(kind: K) =>
      deeds.filter((d): d is Extract<HandDeed, { kind: K }> => d.kind === kind);

  // The things made by hand: the town's, made by him (so many to a unit of their good).
  const made = new Map<string, number>();
  for (const d of of("made")) made.set(d.form, (made.get(d.form) ?? 0) + 1);
  if (made.size) {
    for (const [form, n] of made) {
      const h = HAND_FORMS[form];
      if (market && h && h.good >= 0) market.move("made", h.good, Math.floor(n / h.per));
    }
    notable(
      p.agent,
      emit(POSSESS_EVENTS.made.type, {
        agent: p.agent,
        name: p.name,
        trade: p.scene.trade,
        things: [...made].map(([form, n]) => ({ form, n })),
      }),
    );
  }

  // Goods carried off: out of the market's stores (what he gave back to one, not).
  const took = of("took");
  if (took.length) {
    const net = new Map<number, number>();
    for (const d of took) net.set(d.good, (net.get(d.good) ?? 0) + 1);
    for (const d of of("gave"))
      if (d.carry > 0) net.set(d.carry - 1, (net.get(d.carry - 1) ?? 0) - 1);
    for (const [good, n] of net) if (market && n > 0) market.take("carriedOut", good, n);
    notable(
      p.agent,
      emit(POSSESS_EVENTS.took.type, {
        agent: p.agent,
        name: p.name,
        goods: took.map((d) => ({ good: d.good, from: d.from, seen: d.seen })),
        seen: took.reduce((s, d) => s + d.seen, 0),
      }),
    );
  }

  // The struck down: dead, or wounded on the part struck.
  let struck = 0;
  for (const d of of("struck")) {
    const victim = agentById(w, d.agent);
    if (!victim) continue;
    struck++;
    const byGod = d.by === p.agent,
      event = emit(
        POSSESS_EVENTS.struck.type,
        {
          agent: d.agent,
          name: nameOf(d.agent),
          sex: victim.sex,
          by: d.by,
          byName: nameOf(d.by),
          god: byGod,
          hand: p.name,
          dead: d.dead,
          blow: d.blow,
          place: d.place,
          maimed: d.maimed,
          arm: d.arm,
        },
        d.dead ? 5 : 4,
      );
    notable(d.agent, event);
    if (byGod) notable(p.agent, event);
    if (d.dead) die(c, w, victim, year);
    else
      victim.struck = [
        ...(victim.struck ?? []),
        {
          event,
          at: t,
          blow: d.blow,
          place: d.place,
          maimed: d.maimed,
          arm: d.arm,
          by: nameOf(d.by),
        },
      ];
  }

  // Spirits moved: each one's, onto what it was (as it has faded since).
  for (const b of l.bodies) {
    if (!b.mood) continue;
    const a = agentById(w, b.id);
    if (!a) continue;
    const was = a.mood ? moodAt(a.mood.by, a.mood.at, t) : 0;
    a.mood = { by: Math.max(-1, Math.min(1, was + b.mood)), at: t };
  }
  // A word heard: told on the hearer's page.
  const heard = new Map<number, number>();
  for (const d of of("spoke")) heard.set(d.agent, (heard.get(d.agent) ?? 0) + d.mood);
  for (const [agent, mood] of heard)
    if (agentById(w, agent))
      notable(
        agent,
        emit(POSSESS_EVENTS.spoke.type, {
          agent,
          name: nameOf(agent),
          hand: p.name,
          mood: Math.round(mood * 1000) / 1000,
        }),
      );

  const me = agentById(w, p.agent);
  notable(
    p.agent,
    emit(POSSESS_EVENTS.released.type, {
      agent: p.agent,
      name: p.name,
      seconds: Math.round(l.step / POSSESS_HZ),
      made: of("made").length,
      struck,
      took: took.length,
      spoke: heard.size,
      // (Why the hand let go of him, where it did not let go of its own accord.)
      ended: l.ended || (me ? "" : "died"),
    }),
  );
  delete w.possessed;
}

/**
 * One of the hand's people dead of a blow: out of the counts and among the year's dead, and
 * remembered among the hand's gone, as one dead of their years is (sim/population/systems.ts
 * vitalMonth).
 */
function die(c: PopulationContext, w: Window, a: Agent, year: number): void {
  const band = bandOfAge(year - a.birthYear, c.life);
  c.provinces.get(w.cell)!.counts.add(row(a.sex, band), a.occupation, -1);
  c.history.addDeaths(w.cell, year, band, 1);
  (w.gone ??= []).push({
    id: a.id,
    sex: a.sex,
    birthYear: a.birthYear,
    died: year,
    ...(a.mother !== undefined ? { mother: a.mother } : {}),
    ...(a.father !== undefined ? { father: a.father } : {}),
    ...(a.partner !== undefined ? { partner: a.partner } : {}),
    ...(a.traits?.length ? { traits: a.traits } : {}),
    ...(a.name ? { name: a.name } : {}),
  });
  if (w.gone.length > GONE_KEPT) w.gone.splice(0, w.gone.length - GONE_KEPT);
  w.agents = w.agents.filter((x) => x !== a);
}
