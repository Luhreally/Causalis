// Honour among realms (rules/honour.ts): each realm's record of its word kept and broken, written where it answers a call or
// breaks a pact (sim/war/ties.ts, sim/order/reign.ts), read where another decides whether to come for it or bind itself to it
// (ties.ts answerOne; sim/diplomacy/diplomacy.ts pacts). One small row a realm with a record; nothing runs in a year.
import { defineEventType, type CauseRef, type Ref, type World } from "../../kernel/index.ts";
import { HONOUR, honourTerm, wordIn, wordKept, type WordRecord } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { keepMap, keptMap, type KeptMap } from "../culture/keptmap.ts";
import { realmName, type Polity } from "../polity/polity.ts";

export const HONOUR_EVENTS = {
  /** A realm's word is no longer taken among its peers. */
  shamed: defineEventType("diplomacy.shamed", 4),
};

/** A realm's record, its last breach, and whether it is spoken of as faithless (the event). */
export type Honour = WordRecord & { last: Ref | null; shamed: Ref | null };

const STORE = "diplomacy.honour";
/** Rows kept before the long-faded are let go. */
const MOST = 96;

export function honourStore(world: World): KeptMap<Honour> | null {
  return keptMap<Honour>(world, STORE);
}

/**
 * What a realm's honour adds to another's regard for it where that other must rely on its word, the chance it is thought to keep
 * it, and the breach (or the shaming) to cite. Exactly 0 for a realm with no record.
 */
export function honourIn(
  world: World,
  realm: Ref,
  year: number,
): { term: number; kept: number; source: CauseRef | null } {
  const h = honourStore(world)?.get(realm);
  if (!h) return { term: 0, kept: 0.5, source: null };
  const w = wordIn(h, year),
    cite = h.shamed ?? h.last;
  return {
    term: honourTerm(w.kept, w.broken),
    kept: wordKept(w.kept, w.broken),
    source: cite ? { ref: cite, role: "pressure", weight: 1 } : null,
  };
}

/** A realm kept its word where it cost (`kept`) or broke it, by `event`: its record moves; where it falls under the line, shame. */
export function noteWord(
  ctx: PopulationContext,
  p: Polity,
  kept: boolean,
  event: Ref,
  year: number,
): void {
  const { world } = ctx,
    store = honourStore(world);
  if (!store) return;
  const was = store.get(p.ref),
    w = was ? wordIn(was, year) : { kept: 0, broken: 0 },
    next: Honour = {
      kept: w.kept + (kept ? 1 : 0),
      broken: w.broken + (kept ? 0 : 1),
      at: year,
      last: kept ? (was?.last ?? null) : event,
      shamed: was?.shamed ?? null,
    },
    chance = wordKept(next.kept, next.broken);
  if (next.shamed && chance >= HONOUR.cleared) next.shamed = null;
  if (!kept && !next.shamed && chance < HONOUR.line)
    next.shamed = world.events.emit({
      type: HONOUR_EVENTS.shamed.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: [
        { ref: event, role: "trigger", weight: 1 },
        ...(was?.last && was.last !== event
          ? [{ ref: was.last, role: "pressure" as const, weight: 0.6 }]
          : []),
      ],
      data: {
        realm: realmName(p),
        broken: Math.round(next.broken * 10) / 10,
        kept: Math.round(next.kept * 10) / 10,
        chance: Math.round(chance * 100),
      },
    });
  store.set(p.ref, next);
  // (The long-faded are let go: a record of which nothing is left says what no record says.)
  if (store.size > MOST)
    for (const k of store.keys()) {
      const r = store.get(k)!,
        f = wordIn(r, year);
      if (f.kept + f.broken < 0.1 && !r.shamed) store.drop(k);
    }
}

export function installHonour(world: World): void {
  keepMap<Honour>(world, STORE, (h) => [h.last, h.shamed]);
}
