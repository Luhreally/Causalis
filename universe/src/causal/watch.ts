// Watches (docs/architecture §14, §31): the observer follows a land, a village, a
// realm or a person met, and is told when something that matters happens there —
// a famine in the land, a war the realm declared, the day the person moved away or
// died. Watches live in the observer ledger — saved with the world, never read by
// the simulation — so following a land never changes what happens in it.
import {
  YEAR,
  kindCodeOf,
  parseRef,
  yearOfMoment,
  type HistoryEvent,
  type Ref,
  type World,
} from "../kernel/index.ts";
import { SURFACE_CELL } from "../gen/index.ts";
import { POLITY, SETTLEMENT, politiesOf, populationContext, realmName } from "../sim/index.ts";
import { deepen } from "./biography.ts";
import { landWords } from "./generated.ts";
import { PERSON, observer } from "./observer.ts";
import { LIFE_WORDS } from "./people.ts";
import { why } from "./why.ts";

export type Watch = {
  /** What is followed: a land (a cell), a village, a realm or a person met. */
  readonly ref: Ref;
  /** When the observer began to follow it. */
  readonly since: number;
  /** The moment up to which its tidings have been told. */
  seen: number;
};

export type Tiding = {
  /** What was being followed, and its name. */
  readonly watch: Ref;
  readonly label: string;
  /** What happened (an event, or the person), for its why. */
  readonly ref: Ref;
  readonly year: number;
  readonly claim: string;
};

/** How important news of a land or a realm must be to be told. */
const NEWS = 4;
/** A land's first villages are news; once it has this many, another is not. */
const SETTLED_LAND = 3;
/** At most this many tidings of one thing at a time: the weightiest. */
const MOST = 4;

/** Whether a ref names something that can be followed. */
export function canWatch(world: World, ref: Ref): boolean {
  return label(world, ref) !== null;
}

/** What a followed thing is called: "the land of Kirath", "the Kingdom of Asha", "Dena Vorath". */
export function label(world: World, ref: Ref): string | null {
  const kind = kindCodeOf(ref);
  if (kind === SURFACE_CELL.code) {
    const cell = parseRef(ref).b,
      ctx = populationContext(world);
    if (!ctx.provinces.get(cell)) return null;
    const town = ctx.settlements
      .inProvince(cell)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0];
    return town ? `the land of ${town.name}` : landWords(world, ref);
  }
  if (kind === SETTLEMENT.code) return populationContext(world).settlements.get(ref)?.name ?? null;
  if (kind === POLITY.code) {
    const p = politiesOf(world).get(ref);
    return p ? realmName(p) : null;
  }
  if (kind === PERSON.code) {
    const p = observer(world).person(ref);
    return p ? `${p.name} ${p.surname}` : null;
  }
  return null;
}

/** Everything followed, in the order it was taken up. */
export function watches(world: World): (Watch & { label: string })[] {
  return observer(world)
    .allWatches()
    .map((w) => ({ ...w, label: label(world, w.ref) ?? "something gone from the world" }));
}

/** Follow something, or stop following it. Only the observer ledger changes. */
export function setWatch(world: World, ref: Ref, on: boolean): boolean {
  const ledger = observer(world);
  if (!on) return ledger.watches.delete(ref);
  if (ledger.watches.has(ref) || !canWatch(world, ref)) return false;
  ledger.watches.set(ref, { ref, since: world.now, seen: world.now });
  return true;
}

/** The first event after moment `t` (events are kept in the order they happened). */
function firstAfter(events: readonly HistoryEvent[], t: number): number {
  let lo = 0,
    hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.t > t) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** What has happened to everything followed since it was last told, and mark it told. */
export function tidings(world: World): Tiding[] {
  const ledger = observer(world),
    ctx = populationContext(world),
    events = world.events.all(),
    told = new Set<string>(),
    out: Tiding[] = [];
  for (const w of ledger.allWatches()) {
    if (w.seen >= world.now) continue;
    const name = label(world, w.ref);
    if (name === null) {
      w.seen = world.now;
      continue;
    }
    const kind = kindCodeOf(w.ref);
    if (kind === PERSON.code) {
      out.push(...personTidings(world, w, name));
      continue;
    }
    // A land's news happens in it (a land long settled does not count its new villages; a
    // change of faith is news); a village's names it; a realm's names it and matters.
    const settled =
      kind === SURFACE_CELL.code &&
      ctx.settlements.inProvince(parseRef(w.ref).b).length > SETTLED_LAND;
    const news = (e: HistoryEvent) =>
      kind === SURFACE_CELL.code
        ? e.place === w.ref &&
          (e.importance >= NEWS || e.type === "belief.converted") &&
          !(settled && e.type === "settlement.founded")
        : e.subjects.includes(w.ref) && (kind === SETTLEMENT.code || e.importance >= NEWS);
    const hits: HistoryEvent[] = [];
    for (let i = firstAfter(events, w.seen); i < events.length; i++)
      if (news(events[i]!) && !told.has(events[i]!.id)) hits.push(events[i]!);
    for (const e of hits
      .sort((a, b) => b.importance - a.importance || b.t - a.t)
      .slice(0, MOST)
      .sort((a, b) => a.t - b.t)) {
      // What two things followed share is told once.
      told.add(e.id);
      out.push({
        watch: w.ref,
        label: name,
        ref: e.id,
        year: yearOfMoment(e.t),
        claim: why(world, e.id).claim,
      });
    }
    w.seen = world.now;
  }
  return out;
}

/** A person's news: what they lived through in the whole years since last told, and their death. */
function personTidings(world: World, w: Watch, name: string): Tiding[] {
  // Years told through: the year before `seen`'s (a year's news is complete at its end).
  const from = Math.floor(w.seen / YEAR),
    to = Math.floor(world.now / YEAR) - 1,
    out: Tiding[] = [];
  if (to < from) return out;
  const p = deepen(world, observer(world).person(w.ref)!);
  for (const l of p.life ?? [])
    if (l.year >= from && l.year <= to)
      out.push({
        watch: w.ref,
        label: name,
        ref: l.event ?? p.ref,
        year: l.year,
        claim: `${name}: ${LIFE_WORDS[l.kind] ?? l.kind}, at ${l.age}, in year ${l.year}`,
      });
  if (!p.alive && p.diedYear !== null && p.diedYear >= from && p.diedYear <= to)
    out.push({
      watch: w.ref,
      label: name,
      ref: p.ref,
      year: p.diedYear,
      claim: `${name} died in year ${p.diedYear}, at ${p.diedYear - p.birthYear}`,
    });
  // Whole years only: a year still under way is told once it is over.
  w.seen = Math.max(w.seen, (to + 1) * YEAR);
  return out.slice(-MOST);
}
