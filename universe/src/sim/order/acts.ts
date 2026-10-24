// Bonds and freedoms in the god's hand (Phase 19 M138, asked for 2026-10-23: "slavery and
// forced labour … resistance, revolts, abolition … legitimacy"): the chains of every bound in a
// realm's lands broken at once — though its law, unchanged, may bind again; the bound of its
// most-held land stirred to rise now, winning or crushed as any rising; a sign from the heavens
// for its rule or against it, its standing moved at once and weighed on for forty years. Each a
// logged command, cited by what follows.
import { defineEventType, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf, pushWays } from "../culture/culture.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import {
  BOND,
  BONDS,
  MANDATE_PUSH,
  orderOf,
  realmOrder,
  remember,
  rise,
  type OrderStore,
} from "./order.ts";

export const ORDER_ACTS = {
  unchain: defineEventType("act.unchain", 6),
  stir: defineEventType("act.stir", 5),
  mandate: defineEventType("act.mandate", 5),
};

/** The least share of a land's people held for its bound to be stirred to rise. */
export const STIR_SHARE = 0.04;

/** The share of a land's people held, the condemned counting half (as a rising reckons them). */
function heldIn(store: OrderStore, cell: number): number {
  const l = store.lands.get(cell);
  return l ? l.shares.reduce((a, b, k) => a + (k === BOND.convict ? 0.5 * b : b), 0) : 0;
}

/** A realm's land the most of whose people are held (STIR_SHARE at least), or null. */
export function mostHeld(store: OrderStore, p: Polity): number | null {
  let best: number | null = null,
    most = STIR_SHARE;
  for (const c of [...p.members].sort((a, b) => a - b)) {
    const h = heldIn(store, c);
    if (h >= most) {
      most = h;
      best = c;
    }
  }
  return best;
}

/** Teach a peopled world the god's hand on bonds and freedoms. */
export function installOrderActs(world: World, ctx: () => PopulationContext): void {
  const agent = (command: { id: Ref }) => [{ ref: command.id, role: "agent" as const, weight: 1 }],
    standing = (args: unknown): Polity | null => {
      const ref = (args as { realm?: unknown } | null)?.realm,
        r = typeof ref === "string" ? politiesOf(world).get(ref as Ref) : undefined;
      return r && r.ended === null ? r : null;
    },
    seatOf = (c: PopulationContext, r: Polity) => c.provinces.get(r.seat)?.ref ?? null;

  // Every chain in a realm's lands broken: its bound go free, open to strangers the more.
  world.defineCommand({
    type: "act.unchain",
    validate: (args) => {
      const r = standing(args),
        store = orderOf(world);
      if (!r || !store) return "a realm that stands is wanted";
      return r.members.some((c) => store.bound(c) >= 0.0005) ? null : "none are held in its lands";
    },
    apply: (command, t) => {
      const r = standing(command.args)!,
        c = ctx(),
        store = orderOf(world)!,
        year = yearOfMoment(t);
      let count = 0;
      for (const cell of r.members)
        count += Math.round((c.provinces.get(cell)?.total() ?? 0) * store.bound(cell));
      const event = world.events.emit({
        type: ORDER_ACTS.unchain.type,
        subjects: [r.ref],
        place: seatOf(c, r),
        causes: agent(command),
        data: { realm: realmName(r), count },
      });
      for (const cell of [...r.members].sort((a, b) => a - b)) {
        const l = store.lands.get(cell);
        if (!l || l.shares.every((x) => x === 0)) continue;
        for (let k = 0; k < BONDS.length; k++) l.shares[k] = 0;
        l.cause = event;
        const ways = cultureOf(world).get(cell);
        if (ways) pushWays(ways, { event, year, trait: WAY.openness, amount: 0.05 });
      }
      remember(realmOrder(store, r, cultureOf(world).get(r.seat)), {
        what: "freedom",
        year,
        cell: r.seat,
        event,
      });
    },
  });

  // The bound of a realm's most-held land stirred to rise now.
  world.defineCommand({
    type: "act.stir",
    validate: (args) => {
      const r = standing(args),
        store = orderOf(world);
      if (!r || !store) return "a realm that stands is wanted";
      return mostHeld(store, r) === null
        ? `no land of it holds ${Math.round(STIR_SHARE * 100)} in a hundred of its people in bondage`
        : null;
    },
    apply: (command, t) => {
      const r = standing(command.args)!,
        c = ctx(),
        store = orderOf(world)!,
        cell = mostHeld(store, r)!,
        bound = heldIn(store, cell),
        l = store.lands.get(cell)!,
        event = world.events.emit({
          type: ORDER_ACTS.stir.type,
          subjects: [r.ref],
          place: c.provinces.get(cell)?.ref ?? null,
          causes: agent(command),
          data: { realm: realmName(r) },
        });
      rise(
        c,
        store,
        r,
        realmOrder(store, r, cultureOf(world).get(r.seat)),
        cell,
        bound,
        [
          {
            name: "the god stirred them",
            value: 1,
            contribution: 1,
            source: { ref: event, role: "agent", weight: 1 },
          },
          {
            name: "the bound among them",
            value: bound,
            contribution: 1.4 * bound,
            source: l.cause ? { ref: l.cause, role: "pressure", weight: 1 } : null,
          },
        ],
        1 + 1.4 * bound,
        t,
      );
    },
  });

  // A sign from the heavens for a realm's rule, or against it.
  world.defineCommand({
    type: "act.mandate",
    validate: (args) => {
      if (!standing(args) || !orderOf(world)) return "a realm that stands is wanted";
      const sign = (args as { sign?: unknown }).sign;
      return sign === 1 || sign === -1 ? null : "sign must be 1 or -1";
    },
    apply: (command, t) => {
      const r = standing(command.args)!,
        sign = (command.args as { sign: 1 | -1 }).sign,
        c = ctx(),
        o = realmOrder(orderOf(world)!, r, cultureOf(world).get(r.seat)),
        event = world.events.emit({
          type: ORDER_ACTS.mandate.type,
          subjects: [r.ref],
          place: seatOf(c, r),
          causes: agent(command),
          data: { realm: realmName(r), sign },
        });
      o.mandate = { sign, year: yearOfMoment(t), event };
      o.legitimacy = Math.max(0.02, Math.min(0.98, o.legitimacy + sign * MANDATE_PUSH));
    },
  });
}
