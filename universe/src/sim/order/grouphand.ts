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
import {
  defineEventType,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import {
  ORG_AIMS,
  ORG_BASES,
  ORG_KINDS,
  ORG_STANDING,
  mindSway,
  type OrgAim,
} from "../../rules/index.ts";
import { mindsHeld, mindsOf, mindsPastOf } from "../frontier/minds.ts";
import { interestsOf, type Group } from "../polity/interests.ts";
import type { Polity } from "../polity/polity.ts";
import { beliefOf } from "../belief/belief.ts";
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

// —— A realm's own word on its groups, and how far an outlawing by name bites ————————————————————————————————

/**
 * How far a realm's hand bites on a group it outlawed by name (0 … 1): how far its will is done in the group's lands (its
 * capacity as it reaches each, sim/order/order.ts reachOver: the mean of them). ORG.fears of what its stakes would gather stay away at a full bite, and its crackdown takes
 * of it at least the bite (sim/order/groups.ts). (Before 2026-11-22 an outlawing by name was the same as any outlawing: a
 * crackdown of a few in a hundred a year against stakes that drew men back at a third a year, and of seven groups the god
 * outlawed on tide at 1000, four were larger fifteen years on than in the same world unhanded, one three times.)
 */
export function namedBite(reach: readonly number[]): number {
  if (!reach.length) return 0;
  let s = 0;
  for (const x of reach) s += x;
  return Math.min(1, Math.max(0, s / reach.length));
}

/**
 * What each of a realm's interests wants of a group, by what it does (-1 … 1), as sim/order/laws.ts weighs a law: the court
 * wants no rival rule, justice, party or free word, and cheap guards; the army no rival arms; the temple its own faith kept and
 * no inquiry; traders their leagues, their lending and guards on their roads; crafters and farmers what aids and lends to them.
 * What preys, smuggles, rises, plots or harbours the fled is outlawed by the realm's rule already (rules/groups.ts outlawedAim).
 */
const AIM_WANTS: Readonly<Record<Group, Readonly<Partial<Record<OrgAim, number>>>>> = {
  farmers: { aid: 0.6, lend: -0.3, guard: 0.3, office: 0.2 },
  herders: { aid: 0.3, guard: 0.4 },
  crafters: { aid: 0.4, lend: 0.3, trade: -0.3, office: 0.3, inquire: 0.3 },
  traders: { trade: 1, lend: 0.6, guard: 0.4, hire: 0.2, inquire: 0.3 },
  "the court": {
    rule: -1,
    enforce: -0.6,
    office: -0.4,
    inquire: -0.4,
    guard: 0.2,
    hire: 0.2,
    trade: 0.2,
  },
  "the temple": { worship: 0.5, inquire: -0.6, aid: 0.4 },
  "the army": { rule: -0.6, hire: -0.6, guard: -0.4, enforce: -0.3 },
};

/** What a realm's made minds, kept and sitting at its court, want of a group: inquiry and trade free, no rival rule. */
const MIND_WANTS: Readonly<Partial<Record<OrgAim, number>>> = {
  inquire: 0.6,
  trade: 0.4,
  rule: -0.3,
};

/** A realm decrees on a group by name past this much want, either way, of its interests by their sway. */
export const DECREE = {
  line: 0.2,
  /** A realm's own word holds so long (years), and is weighed again when it lapses. */
  years: 50,
  /** Only on a group this strong among the realm's groups (thousandths). */
  strong: 200,
  /** A realm outlaws by name only as far as it can carry it (its capacity), and either way only where its rule stands. */
  reach: 0.35,
  rule: 0.45,
} as const;

/** A realm's want of a group (-1 … 1): its interests' wants of what the group does, by their sway; and whose want is most. */
function wantOf(
  g: Org,
  sway: ReadonlyMap<Group, number>,
  seatFaith: Ref | null,
  mind: { readonly name: string; readonly sway: number } | null,
): { want: number; most: string | null; mostWant: number } {
  let want = 0,
    most: string | null = null,
    mostWant = 0;
  // (Its made minds at its court, where they sit: their sway, as far as they think past their makers.)
  if (mind && mind.sway > 0) {
    let w = 0;
    for (let k = 0; k < ORG_AIMS.length; k++) {
      const a = (g.aims[k] ?? 0) / 1000;
      if (a > 0) w += a * (MIND_WANTS[ORG_AIMS[k]!] ?? 0);
    }
    want += mind.sway * w;
    most = mind.name;
    mostWant = mind.sway * w;
  }
  const party = ORG_BASES[g.basis] === "interest" ? g.identity : null;
  for (const [i, s] of sway) {
    if (!(s > 0)) continue;
    let w = 0;
    for (let k = 0; k < ORG_AIMS.length; k++) {
      const a = (g.aims[k] ?? 0) / 1000;
      if (a <= 0) continue;
      const aim = ORG_AIMS[k]!;
      let x = AIM_WANTS[i][aim] ?? 0;
      // (A faith kept: the temple's own, or another's; a party: its own interest's, or a rival's.)
      if (aim === "worship" && i === "the temple" && g.identity && g.identity !== seatFaith) x = -1;
      if (aim === "office" && party) x = party === i ? 1 : -0.3;
      w += a * x;
    }
    want += s * w;
    if (Math.abs(s * w) > Math.abs(mostWant)) {
      mostWant = s * w;
      most = i;
    }
  }
  return { want, most, mostWant };
}

/**
 * A realm's own word on its groups, in its groups' reckoning (sim/order/groups.ts), before its rule reads how it holds each:
 * of its groups let be, not in another's pay or under the god's hand, the strong one its interests by their sway want most
 * gone or most kept, past DECREE.line, is outlawed or chartered by name for DECREE.years, by its ruler, as a ruler the god
 * rules through would; at a cost to the ruler's standing where what is outlawed is strong. One a reckoning at most. A realm
 * outlaws so only as far as it can carry it (its capacity), and either way only where its rule stands. Decided with its
 * factors (rule "reign.decree") and told as any ruler's word (`reign.charter`, its data's `own` set).
 */
export function realmDecrees(
  ctx: PopulationContext,
  p: Polity,
  orgs: readonly Org[],
  read: { readonly capacity: number; readonly legitimacy: number },
  t: SimTime,
): void {
  if (read.legitimacy < DECREE.rule || !orgs.length) return;
  const { world } = ctx,
    year = yearOfMoment(t),
    // (Its interests are read only where a group could be decreed on: most reckonings have none.)
    can = orgs.filter(
      (g) =>
        g.standing === 1 &&
        g.decree === undefined &&
        !g.patron &&
        g.hand !== 2 &&
        g.power >= DECREE.strong &&
        g.since < year,
    );
  if (!can.length) return;
  const sway = new Map<Group, number>(interestsOf(ctx, p, t).map((i) => [i.group, i.sway])),
    seatFaith = world.hasStore("belief.faiths") ? beliefOf(world).of(p.seat).faith : null,
    row = mindsOf(world)?.rows.get(p.ref),
    mind =
      row?.passed && row.name && !row.free
        ? { name: row.name, sway: mindSway(mindsPastOf(world, p.ref), mindsHeld(world, p.ref)) }
        : null;
  let best: { g: Org; want: number; most: string | null; mostWant: number } | null = null;
  for (const g of can) {
    const w = wantOf(g, sway, seatFaith, mind),
      size = Math.abs(w.want) * g.power;
    if (Math.abs(w.want) < DECREE.line) continue;
    if (w.want < 0 && read.capacity < DECREE.reach) continue;
    const bestSize = best ? Math.abs(best.want) * best.g.power : -1;
    if (size > bestSize || (size === bestSize && best && g.id < best.g.id)) best = { g, ...w };
  }
  if (!best) return;
  const { g, want } = best,
    outlaw = want < 0,
    until = year + DECREE.years,
    cost = outlaw ? OUTLAW_COSTS * (g.power / 1000) : 0;
  g.decree = outlaw ? 0 : 2;
  g.decreeUntil = until;
  const o = orderOf(world)?.of(p.ref);
  if (o && cost > 0) o.legitimacy = Math.max(0.02, o.legitimacy - cost);
  const factors: Factor[] = [
      {
        name: outlaw ? "what its powerful lose by it" : "what its powerful gain by it",
        value: want,
        contribution: Math.abs(want),
        source: null,
      },
      ...(best.most
        ? [
            {
              name:
                mind && best.most === mind.name
                  ? `the counsel of ${best.most}, its made minds`
                  : `the sway of ${best.most}`,
              value:
                mind && best.most === mind.name ? mind.sway : (sway.get(best.most as Group) ?? 0),
              contribution: Math.abs(best.mostWant),
              source: null,
            },
          ]
        : []),
      {
        name: "its strength among the realm's groups",
        value: g.power / 1000,
        contribution: g.power / 1000,
        source: { ref: g.event, role: "enabler", weight: 1 },
      },
      {
        name: outlaw ? "a seat that can carry it" : "a rule that stands",
        value: outlaw ? read.capacity : read.legitimacy,
        contribution: 0.2,
        source: null,
      },
    ],
    decision = world.decisions.record({
      rule: "reign.decree",
      subject: p.ref,
      outcome: { group: g.name, to: outlaw ? "outlaw" : "charter" },
      score: Math.abs(want),
      threshold: DECREE.line,
      factors,
    });
  world.events.emit({
    type: GROUP_HAND_EVENTS.charter.type,
    subjects: [p.ref],
    place: ctx.provinces.get(g.home)?.ref ?? null,
    causes: [
      { ref: decision, role: "trigger", weight: 1 },
      { ref: g.event, role: "enabler", weight: 1 },
    ],
    data: {
      realm: realmName(p),
      by: p.ruler.name,
      name: g.name,
      what: ORG_KINDS[g.kind] ?? "group",
      to: outlaw ? "outlaw" : "charter",
      was: ORG_STANDING[g.standing] ?? "let be",
      until,
      gids: [g.id],
      own: 1,
      ...(best.most ? { for: best.most } : {}),
      ...(mind && best.most === mind.name ? { minds: 1 } : {}),
      ...(cost > 0 ? { cost: Math.round(cost * 1000) / 1000 } : {}),
    },
  });
}

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
