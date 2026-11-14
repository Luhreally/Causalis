// Lessons from what has cost a people (rules/lessons.ts holds the rule; lessons-store.ts what is kept). Once a year the events
// history wrote since are read, each kind by its reading: what struck whom, and what it cost them. A strike moves what its cause
// has cost the one it struck, and how far they lean on each response to it: by how hard it presses them, against what the response
// asks, and by whether leaning on it has lowered what each strike costs. A response is first taken up by a keyed draw; when a land
// takes one up, those beside it and those its ships reach who have felt the same may take it from them, and a land struck takes up
// what a neighbour does where it has worked there. Nothing else is read: the year's events are walked back only as far as the last
// one read. The owning systems read what is learned where they reckon a loss (lessened, lessonAdds, doctrineAdds).
import {
  YEAR,
  codeOf,
  defineEventType,
  dmath,
  defineStream,
  yearOfMoment,
  type HistoryEvent,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  LESSON,
  LESSON_CAUSE,
  LESSON_CAUSES,
  LESSON_RESPONSES,
  LESSONS_FOR,
  faded,
  pressOf,
  takeUpChance,
  trustOf,
  useAfter,
  doesWords,
  partWords,
  performanceOf,
  type LessonResponse,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { politiesOf, realmName } from "../polity/polity.ts";
import { farFromSeat, hostHungry, warsOf } from "../war/war.ts";
import { designsOf, hostBest } from "../design/design.ts";
import { knows, loreOf } from "./lore.ts";
import { LessonStore, lessonAdds, lessonsOf, useIn, type Holder } from "./lessons-store.ts";
import { HOLD_READ, readOutcomes } from "../order/holds.ts";

/** The kinds of event a realm learns of rule from (sim/order/holds.ts). */
const OUTCOME_TYPES: ReadonlySet<string> = new Set(HOLD_READ);

export {
  LessonStore,
  lessonsOf,
  lessened,
  lessonAdds,
  lessonUse,
  pressIn,
  useIn,
} from "./lessons-store.ts";
export type { CauseMark, Holder, Use } from "./lessons-store.ts";

export const LESSON_EVENTS = {
  /** A people took up a response by their own reckoning. */
  taken: defineEventType("lessons.taken", 3),
  /** A people took it from others who had it. */
  copied: defineEventType("lessons.copied", 2),
};

const TAKE = defineStream("lessons.take");
const RESPONSE_INDEX: ReadonlyMap<string, number> = new Map(
  LESSON_RESPONSES.map((r, i) => [r.id, i]),
);

/** A family's home lost weighs this much of one of them lost, a head: what a cause of homes costs a people. */
export const HOMELESS = 0.1;
/** The people of a home, as a town's fabric counts them (rules/dwelling.ts FAMILY_SIZE). */
const FAMILY = 4.5;

/** What one event did to one holder: the cause, the share of them it cost, its count in the cause's unit, and the lives among it. */
export type Strike = {
  readonly holder: string;
  readonly cause: string;
  readonly share: number;
  readonly lost: number;
  readonly dead: number;
};
/** A reading: what an event did, and who stood it without loss (counted, so what each strike costs is reckoned over all of them). */
type Reading = (
  ctx: PopulationContext,
  e: HistoryEvent,
) => { struck: Strike[]; stood?: { holder: string; cause: string }[] } | null;

const num = (d: unknown, k: string): number => {
  const v = (d as Record<string, unknown> | null)?.[k];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};
const cellOf = (place: Ref | string | null): number | null => {
  if (!place || !place.startsWith("cell:0:")) return null;
  const c = Number(place.slice(7));
  return Number.isInteger(c) ? c : null;
};
const homesOf = (d: unknown): number => {
  const h = (d as { homes?: unknown } | null)?.homes;
  if (typeof h === "number") return h;
  if (h && typeof h === "object")
    return Object.values(h as Record<string, unknown>).reduce<number>(
      (a, b) => a + (typeof b === "number" ? b : 0),
      0,
    );
  return 0;
};

/** A land's people now, and before a loss of `dead`. */
const peopleOf = (ctx: PopulationContext, cell: number, dead: number): number =>
  (ctx.provinces.get(cell)?.total() ?? 0) + dead;

/** A strike on a land, of homes and lives, as a share of its people. */
function onLand(
  ctx: PopulationContext,
  cell: number | null,
  cause: string,
  homes: number,
  dead: number,
  count: number,
): Strike[] {
  if (cell === null) return [];
  const people = peopleOf(ctx, cell, dead);
  if (people <= 0 || (homes <= 0 && dead <= 0)) return [];
  return [
    {
      holder: cellRef(0, cell),
      cause,
      share: Math.min(1, (dead + HOMELESS * FAMILY * homes) / people),
      lost: count,
      dead,
    },
  ];
}

/** A realm's people, in all its lands. */
function realmPeople(ctx: PopulationContext, ref: Ref): number {
  const r = politiesOf(ctx.world).get(ref);
  let n = 0;
  for (const c of r?.members ?? []) n += ctx.provinces.get(c)?.total() ?? 0;
  return n;
}

/** The causes a battle's losses fall under, for its loser: each by how far the winner stood above them in it (log of the ratio). */
export function battleCauses(
  ctx: PopulationContext,
  e: HistoryEvent,
): {
  loser: Ref;
  winner: Ref;
  fallen: number;
  weights: [string, number][];
  /** Of the loser's fallen, the shares its own exchanges put to a cause outright: before the lines closed, in the flight. */
  carved: [string, number][];
} | null {
  const [war, a, b] = e.subjects as Ref[];
  if (!war || !a || !b) return null;
  const wars = warsOf(ctx.world),
    w = wars.get(war),
    battle = w?.battles.findLast((x) => x.event === e.id);
  if (!battle) return null;
  const won = battle.won,
    L = won ? 1 : 0,
    W = won ? 0 : 1,
    fallen = battle.fallen[L] ?? 0,
    terms = wars.termsAt(e.id),
    ln = (x: number) => (x > 0 ? dmath.log(x) : 0),
    weights: [string, number][] = [];
  const fieldW = battle.fielded?.[W] ?? 0,
    fieldL = battle.fielded?.[L] ?? 0;
  if (fieldW > 0 && fieldL > 0) weights.push(["numbers", ln(fieldW / fieldL)]);
  if (terms) {
    const [s0, p0, r0, f0] = terms[W],
      [s1, p1, r1, f1] = terms[L];
    // (Their blades against our guard, over ours against theirs; their shot over ours.)
    weights.push(["blades", ln(((1 + s0) / (1 + p1)) * ((1 + p0) / (1 + s1)))]);
    weights.push(["volleys", ln((1 + r0 + f0) / (1 + r1 + f1))]);
  } else
    weights.push(["blades", ln((battle.power?.[W] ?? 1) / Math.max(0.01, battle.power?.[L] ?? 1))]);
  if (L === 0) {
    // The loser came against them: their ground, their seat's walls.
    const g = ctx.generated,
      land = battle.land,
      hills = g.tectonics.elevation[land]! > 600 ? 1.3 : 1,
      river = g.water.river[land] ? 1.1 : 1,
      walls = 1 + 0.25 * loreOf(ctx.world).effect(land, "walls");
    weights.push(["strongholds", ln((battle.seat ? 2 : 1) * hills * river * walls)]);
    // And far from its seat, or hungry at home: as much as the march took from its strength (sim/war/war.ts), the less where its
    // supply trains fed it.
    const realm = politiesOf(ctx.world).get(a as Ref);
    if (realm) {
      const fed = Math.min(1, lessonAdds(ctx.world, realm.ref, "supply", yearOfMoment(e.t))),
        far = farFromSeat(ctx, realm, land) * (1 - fed),
        hungry = hostHungry(ctx, realm, e.t as SimTime);
      weights.push(["supply", ln(1 + 0.15 * far) + (hungry ? ln(1 / (1 - 0.3 * (1 - fed))) : 0)]);
    }
  } else weights.push(["invasion", dmath.log(1.5)]);
  // Their riders against ours: what each side's kit was drawn up to move at (rules/designs.ts mobility).
  const designs = designsOf(ctx.world),
    mobility = (k: number) => {
      const ref = battle.designs?.[k];
      const d = ref ? designs.get(ref) : undefined;
      return d ? (performanceOf(d.parts).mobility ?? 0) : 0;
    },
    mW = mobility(W),
    mL = mobility(L);
  if (mW > 0) weights.push(["mounted", ln((1 + mW) / (1 + mL))]);
  // What its own exchanges say outright (rules/combat.ts): the loser's dead before the lines closed, and once it broke.
  const carved: [string, number][] = [],
    frames = battle.combat?.frames;
  if (frames?.length) {
    const end = frames.at(-1)!.dead[L] ?? 0;
    if (end > 0) {
      let before = 0;
      for (const f of frames) if (f.at < 48) before = Math.max(before, f.dead[L] ?? 0);
      const rout = battle.combat!.rout,
        broke =
          rout === null || battle.combat!.broken !== L
            ? end
            : (frames.find((f) => f.at >= rout)?.dead[L] ?? end);
      if (before > 0) carved.push(["range", Math.min(1, before / end)]);
      if (end > broke) carved.push(["rout", Math.min(1, (end - broke) / end)]);
    }
  }
  return {
    loser: (L === 0 ? a : b) as Ref,
    winner: (W === 0 ? a : b) as Ref,
    fallen,
    weights: weights.filter((x) => x[1] > 0.02),
    carved: carved.filter((x) => x[1] > 0.02),
  };
}

const REALM_CAUSES: readonly string[] = LESSON_CAUSES.filter((c) => c.scope === "realm").map(
  (c) => c.id,
);

/** Each kind of event that tells a loss, and how it is read. */
const READINGS: Readonly<Record<string, Reading>> = {
  // Quakes, the god's and the world's own (sim/acts/disasters.ts, wild.ts): their homes by town, and their dead.
  "act.quake": (ctx, e) => {
    const homes = homesOf(e.data),
      dead = num(e.data, "dead");
    return { struck: onLand(ctx, cellOf(e.place), "quake", homes, dead, homes) };
  },
  // A town's fire, the god's or one the wild fire reached (sim/acts/local.ts, wild.ts): homes and dead.
  "act.fire": (ctx, e) => {
    const homes = homesOf(e.data),
      dead = num(e.data, "dead");
    return { struck: onLand(ctx, cellOf(e.place), "fire", homes, dead, homes) };
  },
  // A flood (sim/acts/disasters.ts): its dead, told at the land it rose in.
  "act.flood": (ctx, e) => {
    const dead = num(e.data, "dead");
    return { struck: onLand(ctx, cellOf(e.place), "flood", 0, dead, dead) };
  },
  // A famine (sim/population/systems.ts): those who needed food, by how far short they went. It is told as those who went hungry.
  "people.famine": (ctx, e) => {
    const cell = cellOf(e.place);
    if (cell === null) return null;
    const need = num(e.data, "people"),
      short = Math.max(0, 1 - num(e.data, "fed") / 1000),
      people = peopleOf(ctx, cell, 0);
    if (people <= 0 || need <= 0 || short <= 0) return null;
    // (A month short by a third is a share of their year's want: a twelfth of it.)
    return {
      struck: [
        {
          holder: cellRef(0, cell),
          cause: "famine",
          share: Math.min(1, (need * short) / 12 / people),
          lost: Math.round(need * short),
          dead: 0,
        },
      ],
    };
  },
  // A sickness come to a land (sim/health/health.ts): its dead.
  "health.outbreak": (ctx, e) => {
    const dead = num(e.data, "dead");
    return { struck: onLand(ctx, cellOf(e.place), "sickness", 0, dead, dead) };
  },
  // A battle (sim/war/war.ts): the loser's fallen, under what the winner stood above them in; both sides stood a battle.
  "war.battle": (ctx, e) => {
    const read = battleCauses(ctx, e);
    if (!read) return null;
    const stood: { holder: string; cause: string }[] = [];
    for (const c of REALM_CAUSES) stood.push({ holder: read.winner, cause: c });
    const total = read.weights.reduce((s, x) => s + x[1], 0),
      people = realmPeople(ctx, read.loser) + read.fallen,
      struck: Strike[] = [],
      // (What its exchanges put to a cause outright comes first; the rest by how far the winner stood above them.)
      outright = Math.min(
        1,
        read.carved.reduce((s, x) => s + x[1], 0),
      ),
      rest = read.fallen * (1 - outright),
      add = (cause: string, part: number) =>
        struck.push({
          holder: read.loser,
          cause,
          share: part / people,
          lost: Math.round(part),
          dead: Math.round(part),
        });
    if (read.fallen > 0 && people > 0) {
      for (const [cause, x] of read.carved) add(cause, read.fallen * x);
      if (total > 0 && rest > 0)
        for (const [cause, wt] of read.weights) add(cause, (rest * wt) / total);
    }
    for (const c of REALM_CAUSES)
      if (!struck.some((s) => s.cause === c)) stood.push({ holder: read.loser, cause: c });
    return { struck, stood };
  },
};

/**
 * What a holder does by a response now, in words: made of what its people know (a land's own lore; a realm's, its seat's), and for a
 * host's kit the part its realm could field drawn up for that alone (sim/design/design.ts hostBest). Siegecraft is ladders and rams
 * before it is engines; a heavier guard is the guard they can make. Only reads.
 */
export function lessonDoes(ctx: PopulationContext, holder: string, r: LessonResponse): string {
  const cell = cellOf(holder),
    realm = cell === null ? politiesOf(ctx.world).get(holder as Ref) : undefined,
    at = cell ?? realm?.seat ?? null,
    here = (id: string) => at !== null && knows(ctx, at, id),
    part = r.arms && realm ? hostBest(ctx, realm, r.arms.role, r.arms.axis as never) : null;
  return doesWords(r, here, part ? partWords(part) : null);
}

/** The kinds of event read for lessons. */
export const LESSON_READ: readonly string[] = Object.keys(READINGS);

/** A holder's number for its draws. */
const subjectOf = (holder: string): number => {
  const c = cellOf(holder);
  if (c !== null) return c;
  const n = Number(holder.split(":").at(-1));
  return 1_000_000 + (Number.isFinite(n) ? n : 0);
};

/** Those a land's lessons reach: its neighbours, and the lands its ships reach. */
function besideOf(ctx: PopulationContext, holder: string): string[] {
  const c = cellOf(holder);
  if (c === null) return [];
  const { offsets, neighbours } = ctx.generated.grid,
    out: string[] = [];
  if (c < offsets.length - 1)
    for (let k = offsets[c]!; k < offsets[c + 1]!; k++) out.push(cellRef(0, neighbours[k]!));
  const sea = ctx.world.store<MarketStore>("economy.markets").seaPartners(c);
  for (const m of sea) out.push(cellRef(0, m));
  return out;
}

/** Who a holder is, in words, for the annals: a land's name is read later; a realm's is kept. */
function heldBy(ctx: PopulationContext, holder: string): string {
  const r = politiesOf(ctx.world).get(holder as Ref);
  return r ? realmName(r) : "";
}

/** What each strike of a cause cost a holder, on the whole, before now (a share of them). */
const perStrike = (h: Holder, cause: string): number => {
  const m = h.causes.get(cause);
  return m && m.strikes > 0 ? m.share / m.strikes : 0;
};

/** One response taken up by a holder, from its own reckoning or from another: told, and passed on to those beside who need it. */
function takeUp(
  ctx: PopulationContext,
  store: LessonStore,
  holder: string,
  h: Holder,
  r: LessonResponse,
  w: number,
  year: number,
  t: SimTime,
  from: string | null,
  cause: Ref | null,
): void {
  const m = h.causes.get(r.cause)!,
    first = !store.firsts.some((f) => f[0] === r.id);
  const ref = ctx.world.events.emit({
    type: from ? LESSON_EVENTS.copied.type : LESSON_EVENTS.taken.type,
    ...(first && !from ? { importance: 4 } : {}),
    place: cellOf(holder) !== null ? (holder as Ref) : null,
    subjects: cellOf(holder) === null ? [holder as Ref] : [],
    causes: cause ? [{ ref: cause, role: "trigger", weight: 1 }] : [],
    data: {
      lesson: r.id,
      cause: r.cause,
      lost: Math.round(m.lost),
      dead: Math.round(m.dead),
      strikes: m.strikes,
      since: m.first,
      year,
      realm: heldBy(ctx, holder),
      does: lessonDoes(ctx, holder, r),
      ...(from ? { from } : {}),
      ...(first ? { first } : {}),
    },
  });
  if (first) store.firsts.push([r.id, year, ref]);
  h.uses.set(r.id, {
    w,
    at: year,
    taken: year,
    from,
    ref,
    before: perStrike(h, r.cause),
    strikes: 0,
    since: 0,
  });
  if (from) store.copied++;
  else store.taken++;
  if (from) return;
  // Those beside who have felt the same may take it up from them.
  const i = RESPONSE_INDEX.get(r.id) ?? 0;
  for (const n of besideOf(ctx, holder)) {
    const there = store.get(n);
    if (!there || there.uses.has(r.id)) continue;
    const mark = there.causes.get(r.cause);
    if (!mark) continue;
    const press = pressOf(faded(mark.cost, year - mark.at, LESSON.fade)),
      p = takeUpChance(press, r.asks) * LESSON.spread;
    if (p > 0 && ctx.world.rng.real(TAKE, subjectOf(n), t, 100 + i, mark.strikes) < p)
      takeUp(
        ctx,
        store,
        n,
        there,
        r,
        useAfter(0, press, r.asks, 1) * LESSON.copy,
        year,
        t,
        holder,
        ref,
      );
  }
}

/** A strike on a holder: what it cost, and how far it moves them to each response. */
export function strike(
  ctx: PopulationContext,
  store: LessonStore,
  s: Strike,
  year: number,
  t: SimTime,
  event: Ref | null,
): void {
  if (!LESSON_CAUSE.has(s.cause)) return;
  const h = store.holder(s.holder);
  let m = h.causes.get(s.cause);
  if (!m) {
    m = { cost: 0, at: year, lost: 0, dead: 0, first: year, strikes: 0, share: 0 };
    h.causes.set(s.cause, m);
  }
  m.cost = faded(m.cost, year - m.at, LESSON.fade) + s.share;
  m.at = year;
  m.lost += s.lost;
  m.dead += s.dead;
  m.strikes++;
  m.share += s.share;
  const press = pressOf(m.cost);
  for (const r of LESSONS_FOR.get(s.cause) ?? []) {
    const u = h.uses.get(r.id);
    if (u) {
      // How it has gone since they took it up, and so how far it moves them now.
      u.strikes++;
      u.since += s.share;
      const now = faded(u.w, year - u.at, LESSON.keep),
        trust = trustOf(u.before, u.since / u.strikes, u.strikes);
      u.w = useAfter(now, press, r.asks, trust);
      u.at = year;
      continue;
    }
    const i = RESPONSE_INDEX.get(r.id) ?? 0;
    // Their own reckoning: a draw against how hard it presses them, less what it asks.
    if (
      ctx.world.rng.real(TAKE, subjectOf(s.holder), t, i, m.strikes) < takeUpChance(press, r.asks)
    ) {
      takeUp(ctx, store, s.holder, h, r, useAfter(0, press, r.asks, 1), year, t, null, event);
      continue;
    }
    // Or what a neighbour does, where it has worked there.
    let best: { n: string; w: number } | null = null;
    for (const n of besideOf(ctx, s.holder)) {
      const there = store.get(n),
        u2 = there?.uses.get(r.id);
      if (!there || !u2) continue;
      const w2 = useIn(there, r.id, year),
        trust = trustOf(u2.before, u2.strikes ? u2.since / u2.strikes : 0, u2.strikes);
      if (w2 > 0 && trust >= 1 && (!best || w2 > best.w)) best = { n, w: w2 };
    }
    if (
      best &&
      ctx.world.rng.real(TAKE, subjectOf(s.holder), t, 50 + i, m.strikes) < press * LESSON.spread
    )
      takeUp(ctx, store, s.holder, h, r, best.w * LESSON.copy, year, t, best.n, event);
  }
}

/** A strike stood without loss: counted against what each strike of its cause costs, since and before. */
function stood(store: LessonStore, holder: string, cause: string): void {
  const h = store.get(holder);
  const m = h?.causes.get(cause);
  if (!h || !m) return;
  m.strikes++;
  for (const r of LESSONS_FOR.get(cause) ?? []) {
    const u = h.uses.get(r.id);
    if (u) u.strikes++;
  }
}

/** A year of lessons: what history wrote since the last one read. */
export function lessonsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = lessonsOf(world);
  if (!store) return;
  const log = world.events,
    year = yearOfMoment(t),
    fresh: HistoryEvent[] = [];
  let top = store.read;
  for (let i = log.count - 1; i >= 0; i--) {
    const e = log.at(i),
      code = codeOf(e.id);
    // (Back only as far as the last read, and never past a year and a little: an old save's first year reads no more.)
    if (code <= store.read || e.t < t - 2 * YEAR) break;
    if (code > top) top = code;
    if (READINGS[e.type] || OUTCOME_TYPES.has(e.type)) fresh.push(e);
  }
  store.read = top;
  // (What befell realms, and what they learn of rule from it: sim/order/holds.ts, oldest first.)
  const outcomes = fresh.filter((e) => OUTCOME_TYPES.has(e.type)).reverse();
  if (outcomes.length) readOutcomes(ctx, outcomes, t);
  for (let i = fresh.length - 1; i >= 0; i--) {
    const e = fresh[i]!,
      reading = READINGS[e.type];
    if (!reading) continue;
    const got = reading(ctx, e);
    if (!got) continue;
    const at = yearOfMoment(e.t);
    for (const s of got.struck) strike(ctx, store, s, at, t, e.id);
    for (const s of got.stood ?? []) stood(store, s.holder, s.cause);
  }
  // Once in ten years, what no one leans on and nothing presses is forgotten, and realms gone with their records.
  if (year % 10 === 0) forget(ctx, store, year);
}

function forget(ctx: PopulationContext, store: LessonStore, year: number): void {
  const realms = politiesOf(ctx.world);
  for (const [k, h] of [...store.holders]) {
    if (cellOf(k) === null) {
      const r = realms.get(k as Ref);
      if (!r || r.ended !== null) {
        store.holders.delete(k);
        continue;
      }
    }
    for (const [id] of [...h.uses]) if (useIn(h, id, year) <= 0) h.uses.delete(id);
    for (const [c, m] of [...h.causes]) {
      if (pressOf(faded(m.cost, year - m.at, LESSON.fade)) >= LESSON.least) continue;
      if ((LESSONS_FOR.get(c) ?? []).some((r) => h.uses.has(r.id))) continue;
      h.causes.delete(c);
    }
    if (!h.causes.size && !h.uses.size) store.holders.delete(k);
  }
}

/** Teach a peopled world to learn from what costs it. */
export function installLessons(world: World, ctx: () => PopulationContext): LessonStore {
  const store = world.register(new LessonStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "880.lessons.year", every: YEAR, run: (t) => lessonsYear(ctx(), t) });
  return store;
}
