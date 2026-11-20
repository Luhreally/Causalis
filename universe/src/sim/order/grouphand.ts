// The hand on groups (asked 2026-11-19; the audit's item 30: "no god act or ruler's decree targets an Org"). A group
// (sim/order/groups.ts) or a body (sim/order/institutions.ts) acted on by name, by the god or by its realm's ruler:
//   - the god blesses it (more come to it), curses it (fewer), keeps its realm's hand off it, or sets how its realm holds it
//     (chartered, outlawed) whatever its realm would have done, for GROUP_ACT_YEARS;
//   - a ruler the god's hand rules through charters it, outlaws it or lets it be again, for the same years, at a cost to their
//     standing where what they outlaw is strong among their realm's groups (`reign.charter`).
// What is set is kept on the group or the body itself and read in its own reckoning: its members move toward a fifth more or
// fewer, its realm's hand takes none of it, its standing is what was set. Nothing is kept and nothing is hashed while no one
// has acted: a world no one touches runs exactly as before. A faith's clergy are a body that keeps worship, a lending circle a
// group, a paper a body: each is reached as one of these (a house of lending has its own acts: sim/credit).
import { defineEventType, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { ORG_KINDS, ORG_STANDING } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { politiesOf, realmName } from "../polity/polity.ts";
import { orgsOf, type Org, type RealmOrgs } from "./groups-kept.ts";
import { bodiesOf, type Body, type RealmBodies } from "./institutions-kept.ts";
import { bodyTitle } from "./institutions.ts";
import { orderOf } from "./order.ts";
import { rulerProblem } from "./reign.ts";
import { creditOf, houseDecreed, type House } from "../credit/credit.ts";
import { FISC, TREASURY_STORE, moneyStore } from "../money/kept.ts";

/** Of its reserve, what a seat puts into a house of lending it charters. */
export const BACKS = 0.1;

/**
 * What a ruler's word may fall on, by the ref given: a group (the event it rose by), a body (the event it was founded by), a
 * faith's seat in their realm (the faith's ref: the body that keeps its worship there), a house of lending (its ref).
 */
export function charterTarget(
  world: World,
  realm: Ref,
  target: string,
):
  | { kind: "org"; realm: Ref; v: Readonly<RealmOrgs>; g: Org }
  | { kind: "body"; realm: Ref; v: RealmBodies; g: Body }
  | { kind: "house"; realm: Ref; h: House }
  | null {
  const org = findOrg(world, target as Ref);
  if (org) return { kind: "org", ...org };
  const body = findBody(world, target as Ref);
  if (body) return { kind: "body", ...body };
  // (A faith's seat: the body of this realm that its tithes keep.)
  const v = bodiesOf(world)?.of(realm) as RealmBodies | undefined,
    clergy = v?.bodies
      .filter((x) => x.keeper === target && x.keeper !== "")
      .sort((a, b) => b.staff - a.staff || a.id - b.id)[0];
  if (v && clergy) return { kind: "body", realm, v, g: clergy };
  const h = creditOf(world)
    ?.standing()
    .find((x) => x.ref === target);
  if (h) {
    const of = politiesOf(world).of(h.cell);
    return of ? { kind: "house", realm: of.ref, h } : null;
  }
  return null;
}

/** Why a ruler's word on one cannot be given (null: it can), in the words the world refuses it with. */
export function charterProblem(world: World, args: unknown): string | null {
  const bad = rulerProblem(world, args);
  if (bad) return bad;
  const a = args as { realm?: Ref; target?: string; to?: string };
  if (!a.to || !(CHARTER_ACTS as readonly string[]).includes(a.to)) return "no such decree";
  const at = a.realm && a.target ? charterTarget(world, a.realm, a.target) : null;
  if (!at) return "it no longer stands";
  if (at.realm !== a.realm) return "it is not of your realm";
  // (A group in another realm's pay is that realm's to hold, not theirs.)
  if (at.kind === "org" && at.g.patron && at.g.patron !== a.realm && a.to === "charter")
    return "another realm pays it";
  if (at.kind === "house" && a.to === "let be") return "a house of lending stands or is closed";
  if (at.kind === "house" && a.to === "charter") {
    const reserve = moneyStore(world, TREASURY_STORE)?.at(a.realm!, FISC.reserve) ?? 0;
    if (!(reserve * BACKS >= 1)) return "your treasury has nothing to put into it";
  }
  const now = at.kind === "house" ? -1 : at.g.standing,
    want = a.to === "charter" ? 2 : a.to === "outlaw" ? 0 : 1;
  if (now === want && at.kind !== "house" && at.g.decree === want)
    return "your word already holds it so";
  return null;
}

export const GROUP_HAND_EVENTS = {
  /** The god's hand laid on a group. */
  act: defineEventType("act.group", 4),
  /** A ruler chartered or outlawed a group or a body by name, or let it be again. */
  charter: defineEventType("reign.charter", 3),
};

/** What the god's hand may do to a group. */
export const GROUP_ACTS = ["bless", "curse", "protect", "charter", "outlaw"] as const;
export type GroupAct = (typeof GROUP_ACTS)[number];
/** What a ruler may decree of a group or a body. */
export const CHARTER_ACTS = ["charter", "outlaw", "let be"] as const;
export type CharterAct = (typeof CHARTER_ACTS)[number];
/** How long the hand's mark and a decree hold (years). */
export const GROUP_ACT_YEARS = 20;
/** What outlawing the strongest of a realm's groups costs its ruler's standing (a share of how strong it is among them). */
export const OUTLAW_COSTS = 0.04;

/** A group by the event it rose by, with its realm's record (null: none stands so). */
function findOrg(
  world: World,
  founded: Ref,
): { realm: Ref; v: Readonly<RealmOrgs>; g: Org } | null {
  const store = orgsOf(world);
  if (!store) return null;
  for (const realm of store.realmsKept()) {
    const v = store.of(realm)!,
      g = v.orgs.find((x) => x.event === founded);
    if (g) return { realm, v, g };
  }
  return null;
}
function findBody(world: World, founded: Ref): { realm: Ref; v: RealmBodies; g: Body } | null {
  const store = bodiesOf(world);
  if (!store) return null;
  for (const realm of store.realmsKept()) {
    const v = store.of(realm) as RealmBodies,
      g = v.bodies.find((x) => x.event === founded);
    if (g) return { realm, v, g };
  }
  return null;
}

/** A group's record written again with one of its groups changed (the store folds it into its digest). */
function putOrg(world: World, realm: Ref, v: Readonly<RealmOrgs>, g: Org, set: Partial<Org>): Org {
  const next = { ...g, ...set };
  orgsOf(world)!.put(realm, { ...v, orgs: v.orgs.map((x) => (x === g ? next : x)) });
  return next;
}

const standingOfAct = (act: string): number | undefined =>
  act === "charter" ? 2 : act === "outlaw" ? 0 : undefined;

/** Teach a peopled world the hand on its groups: "act.group" (the god's), "reign.charter" (a ruler's, of a group or a body). */
export function installGroupHand(world: World, ctx: () => PopulationContext): void {
  world.defineCommand({
    type: "act.group",
    validate: (args) => {
      const a = args as { group?: string; act?: string };
      if (!a.act || !(GROUP_ACTS as readonly string[]).includes(a.act)) return "no such act";
      return a.group && findOrg(world, a.group as Ref) ? null : "it no longer stands";
    },
    apply: (command) => {
      const a = command.args as { group: Ref; act: GroupAct },
        at = findOrg(world, a.group)!,
        year = yearOfMoment(world.now),
        until = year + GROUP_ACT_YEARS,
        standing = standingOfAct(a.act),
        g = putOrg(
          world,
          at.realm,
          at.v,
          at.g,
          standing !== undefined
            ? { decree: standing, decreeUntil: until, standing }
            : { hand: a.act === "bless" ? 1 : a.act === "curse" ? -1 : 2, handUntil: until },
        ),
        p = politiesOf(world).get(at.realm);
      world.events.emit({
        type: GROUP_HAND_EVENTS.act.type,
        subjects: [at.realm],
        place: ctx().provinces.get(g.home)?.ref ?? null,
        causes: [
          { ref: command.id, role: "agent", weight: 1 },
          { ref: g.event, role: "enabler", weight: 1 },
        ],
        data: {
          realm: p ? realmName(p) : "a realm",
          group: g.name,
          kind: ORG_KINDS[g.kind],
          gids: [g.id],
          act: a.act,
          until,
        },
      });
    },
  });

  world.defineCommand({
    type: "reign.charter",
    validate: (args) => charterProblem(world, args),
    apply: (command) => {
      const a = command.args as { realm: Ref; ruler: string; target: Ref; to: CharterAct },
        c = ctx(),
        year = yearOfMoment(world.now),
        until = year + GROUP_ACT_YEARS,
        p = politiesOf(world).get(a.realm)!,
        at = charterTarget(world, a.realm, a.target)!,
        org = at.kind === "org" ? at : null,
        standing = standingOfAct(a.to);
      let name: string,
        what: string,
        home: number,
        was: number,
        cost = 0;
      if (org) {
        was = org.g.standing;
        const g = putOrg(
          world,
          org.realm,
          org.v,
          org.g,
          standing !== undefined
            ? { decree: standing, decreeUntil: until, standing }
            : { decree: 1, decreeUntil: until, standing: 1 },
        );
        name = g.name;
        what = ORG_KINDS[g.kind] ?? "group";
        home = g.home;
        // (To outlaw what is strong among its realm's groups costs the one who does it.)
        if (a.to === "outlaw") cost = OUTLAW_COSTS * (g.power / 1000);
      } else if (at.kind === "house") {
        // (A house of lending: closed, or backed from the seat's reserve. The closing is told by its own failing, which
        // stands on this word.)
        was = 1;
        name = at.h.name;
        what = "house of lending";
        home = at.h.cell;
        if (a.to === "outlaw") cost = OUTLAW_COSTS;
      } else if (at.kind === "body") {
        const body = at;
        was = body.g.standing;
        body.g.decree = standing ?? 1;
        body.g.decreeUntil = until;
        body.g.standing = standing ?? 1;
        bodiesOf(world)!.put(body.realm, body.v);
        name = body.g.name;
        what = bodyTitle(c, body.g);
        home = body.g.home;
        if (a.to === "outlaw") cost = OUTLAW_COSTS * 0.5;
      } else return;
      const o = orderOf(world)?.of(a.realm);
      if (o && cost > 0) o.legitimacy = Math.max(0.02, o.legitimacy - cost);
      const told = world.events.emit({
        type: GROUP_HAND_EVENTS.charter.type,
        subjects: [a.realm],
        place: c.provinces.get(home)?.ref ?? null,
        causes: [
          { ref: command.id, role: "agent", weight: 1 },
          {
            ref: at.kind === "house" ? at.h.event : at.g.event,
            role: "enabler",
            weight: 1,
          },
        ],
        data: {
          realm: realmName(p),
          by: a.ruler,
          name,
          what,
          to: a.to,
          was: ORG_STANDING[was] ?? "let be",
          until,
          ...(org ? { gids: [org.g.id] } : {}),
          ...(cost > 0 ? { cost: Math.round(cost * 1000) / 1000 } : {}),
        },
      });
      if (at.kind === "house") {
        const fisc = moneyStore(world, TREASURY_STORE),
          row = fisc?.get(a.realm),
          stake = a.to === "charter" && row ? Math.floor(row[FISC.reserve]! * BACKS) : 0;
        if (fisc && row && stake > 0) {
          const next = [...row];
          next[FISC.reserve] = row[FISC.reserve]! - stake;
          fisc.set(a.realm, next);
        }
        houseDecreed(c, at.h.ref, a.to === "outlaw" ? "outlaw" : "charter", told, world.now, stake);
      }
    },
  });
}
