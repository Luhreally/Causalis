// The god's hand through one it has entered (asked 2026-11-13: "when i rule i should have ultimate power if god is
// channelled ... spawn shit and edit shit like an actual god"): with the god in a ruler, or in one of a court, they can
// do what no station allows and what no people could make: stand up a host out of nothing, armed with the best their
// world's physics allows, fill their stores, people their lands, raise a town on an empty land, give a land its next
// craft or a whole age of learning, make a realm's rule rightful or wrongful, calm or stir every land of it, end a war
// or start one, swear two realms to a pact, make a realm sworn to theirs, take a land of another. Each is a command in
// the world's log, told in the annals as done by the god in them; nothing here runs unless it is asked, and nothing is
// kept but the hosts it stands up (war/godhost.ts). What the world has no physics for is still refused: no craft its
// matter cannot hold, no arms its people's bodies cannot bear, no war on a realm no land of theirs can reach.
import { YEAR, defineEventType, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { G, GOODS, TERMS, designWords, type Part } from "../../rules/index.ts";
import { COLS, Province } from "../population/model.ts";
import {
  POPULATION_EVENTS,
  livableFor,
  marketsOf,
  type PopulationContext,
} from "../population/systems.ts";
import { cutOff, politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { DIPLOMACY_EVENTS, diplomacyOf } from "../diplomacy/diplomacy.ts";
import { frontier, warsOf } from "../war/war.ts";
import { armsOf } from "../war/arms.ts";
import { bondsOf } from "../war/bonds.ts";
import { GOD_HOST_LEAST, GOD_HOST_WASTE, GodHostStore } from "../war/godhost.ts";
import { bestHostFor } from "../design/design.ts";
import { giveLore, loreOf, openTo } from "../lore/lore.ts";
import { orderOf } from "./order.ts";
import { applyPeace, applyWar, godWill, rulerProblem } from "./reign.ts";
import { roleHeld } from "../court/roles.ts";

export const GOD_EVENTS = {
  /** A thing done by the god's hand through one it entered. */
  did: defineEventType("reign.god", 5),
};

/** What the god's hand through them can do. */
export const GOD_ACTS = [
  "host",
  "grain",
  "wealth",
  "poorer",
  "people",
  "town",
  "craft",
  "age",
  "rightful",
  "wrongful",
  "calm",
  "stir",
  "peace",
  "war",
  "pact",
  "swear",
  "annex",
] as const;
export type GodAct = (typeof GOD_ACTS)[number];
/** The acts that ask a second realm: the one it is done with, or to. */
export const GOD_PAIRED: readonly GodAct[] = ["peace", "war", "pact", "swear", "annex"];

/** The hosts the hand offers; any whole number between the least and the most can be asked. */
export const GOD_HOSTS = [10_000, 100_000, 1_000_000] as const;
export const GOD_HOST_MOST = 10_000_000;
/** Crafts in an age of learning: as many as a land comes to in the tree's order, each opening the next. */
export const GOD_AGE = 12;
/** A year's bread for one, in the market's measures (a mouth eats about twelve a year: economy/systems.ts). */
export const GOD_BREAD = 12;
/** People added to each land, as a share of those there. */
export const GOD_PEOPLE = 0.5;
/** People a town raised on an empty land begins with. */
export const GOD_TOWN = 5000;

/**
 * How much the hand does, where an amount means something (asked 2026-11-13: "add sliders for whatever else is relevant to
 * on those god hand options"): for each such act, the argument that carries it, the stops a slider offers (gentlest first)
 * and the amount it always did, which is what it does when none is asked. A host may be any whole number between the
 * least and the most; every other amount is one of its stops. A craft (the next one: an age is many), a war (begun or
 * not) and a pact (it holds while the two think well enough of each other: no span of years binds it) have none.
 */
export const GOD_AMOUNTS = {
  /** Men stood up. */
  host: {
    key: "men",
    stops: [1_000, 3_000, 10_000, 30_000, 100_000, 300_000, 1_000_000, 3_000_000, 10_000_000],
    was: 100_000,
  },
  /** Years of bread for all its people. */
  grain: { key: "years", stops: [0.25, 0.5, 1, 2, 5, 10], was: 1 },
  /** Every store made so many times what it was. */
  wealth: { key: "by", stops: [1.25, 1.5, 2, 3, 5, 10], was: 2 },
  /** Of every store, the share taken. */
  poorer: { key: "share", stops: [0.1, 0.25, 0.5, 0.75, 0.9], was: 0.5 },
  /** People added to each land, as a share of those there. */
  people: { key: "share", stops: [0.1, 0.25, 0.5, 1, 2, 4], was: 0.5 },
  /** People the town begins with. */
  town: {
    key: "people",
    stops: [500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000],
    was: 5000,
  },
  /** Crafts in the age. */
  age: { key: "crafts", stops: [3, 6, 12, 24, 48], was: 12 },
  /** Of its people, the share holding its rule rightful. */
  rightful: { key: "level", stops: [0.6, 0.75, 0.9, 0.98], was: 0.98 },
  wrongful: { key: "level", stops: [0.4, 0.25, 0.1, 0.02], was: 0.02 },
  /** Of every land's grievance, the share forgotten. */
  calm: { key: "share", stops: [0.25, 0.5, 0.75, 1], was: 1 },
  /** The grievance every land holds at the least. */
  stir: { key: "level", stops: [0.25, 0.5, 0.75, 1], was: 1 },
  /** Years the truce binds. */
  peace: { key: "years", stops: [2, 5, TERMS.truceYears, 15, 30, 50], was: TERMS.truceYears },
  /** Years a realm is sworn. */
  swear: { key: "years", stops: [5, 10, 20, 30, 50, 100], was: 30 },
  /** Lands taken, the nearest first. */
  annex: { key: "lands", stops: [1, 2, 3, 5, 8], was: 1 },
} as const;
type AmountSpec = { readonly key: string; readonly stops: readonly number[]; readonly was: number };
const amountSpec = (what: GodAct): AmountSpec | undefined =>
  (GOD_AMOUNTS as Partial<Record<GodAct, AmountSpec>>)[what];

/** How much an act was asked to do: the amount it always did, where none was asked (1 for an act with none). */
export function godAmount(a: GodArgs): number {
  const spec = amountSpec(a.what);
  if (!spec) return 1;
  const v = (a as unknown as Record<string, unknown>)[spec.key];
  return typeof v === "number" ? v : spec.was;
}
/** Whether an act was asked an amount other than the one it always did (its event then says how much). */
const asked = (a: GodArgs): boolean => {
  const spec = amountSpec(a.what);
  return !!spec && a.what !== "host" && godAmount(a) !== spec.was;
};

/** Why an amount asked is not one the hand gives (null: it is, or none was asked). */
function amountProblem(a: GodArgs): string | null {
  const spec = amountSpec(a.what);
  if (!spec || a.what === "host") return null;
  const v = (a as unknown as Record<string, unknown>)[spec.key];
  if (v === undefined) return null;
  return typeof v === "number" && spec.stops.includes(v)
    ? null
    : `How much is one of ${spec.stops.join(", ")}.`;
}

/** Who acts (a ruler, or one of a court), with the god in them, and what is asked. */
export type GodArgs = {
  readonly realm: Ref;
  readonly ruler?: string;
  readonly fig?: number;
  readonly name?: string;
  readonly channel?: boolean;
  readonly what: GodAct;
  /** The realm it is done to (absent: their own). */
  readonly to?: Ref;
  /** The second realm: the foe a peace or war is with, a pact's other, the realm sworn, the realm a land is taken from. */
  readonly with?: Ref;
  /** A host: how many, and armed as their realm arms them now or with the best their world allows. */
  readonly men?: number;
  readonly arms?: "theirs" | "best";
  /** How much, where an amount means something (GOD_AMOUNTS; absent: as it always was). */
  readonly years?: number;
  readonly by?: number;
  readonly share?: number;
  readonly people?: number;
  readonly crafts?: number;
  readonly level?: number;
  readonly lands?: number;
};

const standing = (world: World, ref: unknown): Polity | null => {
  const r = typeof ref === "string" ? politiesOf(world).get(ref as Ref) : undefined;
  return r && r.ended === null ? r : null;
};

/** Who holds the god's hand, and their realm; or why they do not. */
function holderOf(world: World, a: GodArgs): { r: Polity; by: string } | string {
  if (typeof a.fig === "number") {
    const held = roleHeld(world, a);
    return typeof held === "string" ? held : { r: held.r, by: held.f.name };
  }
  const bad = rulerProblem(world, a);
  return bad ?? { r: standing(world, a.realm)!, by: a.ruler! };
}

const peopleOf = (c: PopulationContext, r: Polity) =>
  r.members.reduce((n, k) => n + (c.provinces.get(k)?.total() ?? 0), 0);

/** The empty land beside a realm people could live in, nearest its seat by the grid's order. */
function emptyBeside(c: PopulationContext, r: Polity): number | null {
  const g = c.generated,
    seen = new Set<number>();
  for (const cell of [r.seat, ...r.members])
    for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (seen.has(n)) continue;
      seen.add(n);
      if (
        (c.provinces.get(n)?.total() ?? 0) === 0 &&
        !politiesOf(c.world).of(n) &&
        livableFor(c, n)
      )
        return n;
    }
  return null;
}

/** What a land could come to next, each opening the next: one craft, or an age of them (with what it opens, ids). */
export function godLearning(c: PopulationContext, seat: number, most: number): string[] {
  const known = new Set<string>(),
    prov = c.provinces.get(seat),
    markets = marketsOf(c.world),
    lore = (id: string) =>
      known.has(id) ||
      (id === "cultivation"
        ? !!prov?.knowsCultivation
        : id === "metalworking"
          ? !!markets.get(seat)?.metalworking
          : !!loreOf(c.world).get(seat, id)),
    out: string[] = [];
  if (!prov?.knowsCultivation && most > 0) {
    out.push("cultivation");
    known.add("cultivation");
  }
  while (out.length < most) {
    const next = openTo(c, seat, lore)[0];
    if (!next) break;
    out.push(next.id);
    known.add(next.id);
  }
  return out;
}

/** Why the god's hand through them cannot do this (null: it can). */
export function godProblem(world: World, c: PopulationContext, args: unknown): string | null {
  const a = args as GodArgs | null;
  if (!a || !(GOD_ACTS as readonly string[]).includes(String(a.what)))
    return "nothing the god's hand does was asked";
  const held = holderOf(world, a);
  if (typeof held === "string") return held;
  if (!a.channel) return "Only with the god in them: as a mortal, they can do no such thing.";
  const to = a.to === undefined ? held.r : standing(world, a.to);
  if (!to) return "That realm has fallen.";
  const other = GOD_PAIRED.includes(a.what) ? standing(world, a.with) : null;
  if (GOD_PAIRED.includes(a.what)) {
    if (!other) return "Another realm that stands is wanted.";
    if (other.ref === to.ref) return "A realm cannot be set against itself.";
  }
  const war = other ? warsOf(world).between(to.ref, other.ref) : undefined,
    atWar = !!war && war.ended === null,
    much = amountProblem(a);
  if (much) return much;
  switch (a.what) {
    case "host": {
      const men = a.men;
      if (
        typeof men !== "number" ||
        !Number.isInteger(men) ||
        men < GOD_HOST_LEAST ||
        men > GOD_HOST_MOST
      )
        return `A host of ${GOD_HOST_LEAST} to ${GOD_HOST_MOST} is wanted.`;
      if (a.arms !== "theirs" && a.arms !== "best")
        return "Armed as they are, or with the best their world allows.";
      if (a.arms === "best" && !bestHostFor(c).parts.length)
        return "No arms could be made on this world.";
      return null;
    }
    case "people":
    case "grain":
    case "wealth":
    case "poorer":
      return peopleOf(c, to) > 0 ? null : "No one lives in its lands.";
    case "town":
      return emptyBeside(c, to) === null
        ? "No empty land lies beside it that people could live in."
        : null;
    case "craft":
    case "age":
      return godLearning(c, to.seat, 1).length
        ? null
        : "There is nothing more its world's matter lets its people know.";
    case "rightful":
    case "wrongful":
    case "calm":
    case "stir":
      return orderOf(world)?.of(to.ref) || a.what === "calm" || a.what === "stir"
        ? null
        : "This world knows no rule to hold rightful.";
    case "peace":
      return atWar ? null : "They are not at war.";
    case "war":
      if (atWar) return "They are at war already.";
      return frontier(c, to, other!).length
        ? null
        : "No land of theirs can be reached: no host can go where no land or sea road lies between.";
    case "pact": {
      const regard = diplomacyOf(world).get(to.ref, other!.ref);
      if (!regard) return "They have never met: there is no one to swear to.";
      if (regard.pact) return "They are sworn to each other already.";
      return atWar ? "They are at war: make the peace first." : null;
    }
    case "swear":
      if (bondsOf(world).between(other!.ref, to.ref)?.kind === "vassal")
        return "They are sworn already.";
      return atWar ? "They are at war: make the peace first." : null;
    case "annex":
      return frontier(c, to, other!).length
        ? null
        : "No land of theirs lies beside it to take (a realm's seat is taken with the realm: unite them with the god's hand).";
  }
  return null;
}

/** Teach a peopled world the god's hand through one it entered: "reign.god". */
export function installGodHand(world: World, ctx: () => PopulationContext): void {
  const hosts = world.register(new GodHostStore());
  world.defineCommand({
    type: "reign.god",
    validate: (args) => godProblem(world, ctx(), args),
    apply: (command, t) => {
      const a = command.args as GodArgs,
        c = ctx(),
        held = holderOf(world, a) as { r: Polity; by: string },
        to = a.to === undefined ? held.r : standing(world, a.to)!,
        other = GOD_PAIRED.includes(a.what) ? standing(world, a.with)! : null,
        year = yearOfMoment(t),
        realms = politiesOf(world),
        markets = marketsOf(world),
        place = c.provinces.get(to.seat)?.ref ?? cellRef(0, to.seat),
        base = {
          by: held.by,
          realm: realmName(held.r),
          what: a.what,
          of: realmName(to),
          at: to.town,
          ...(other ? { with: realmName(other) } : {}),
        },
        emit = (data: Record<string, unknown>) =>
          world.events.emit({
            type: GOD_EVENTS.did.type,
            subjects: [...new Set([held.r.ref, to.ref, ...(other ? [other.ref] : [])])],
            place,
            causes: [{ ref: command.id, role: "agent", weight: 1 }],
            data: { ...base, ...data },
          }),
        by = { by: held.by, cause: command.id, extra: godWill(true) },
        /** An older truce, tribute or oath between two realms ended, where the god's word puts another in its place. */
        unbind = (x: Ref, y: Ref) => {
          const bonds = bondsOf(world);
          for (let b = bonds.between(x, y); b; b = bonds.between(x, y)) bonds.remove(b);
        };
      switch (a.what) {
        case "host": {
          const arms: { parts: readonly Part[]; power: number } =
              a.arms === "best"
                ? bestHostFor(c)
                : (() => {
                    const x = armsOf(c, to);
                    return { parts: x.parts, power: x.full };
                  })(),
            words = designWords(arms.parts),
            event = emit({ men: a.men, arms: words, best: a.arms === "best" });
          hosts.add({
            realm: to.ref,
            cell: to.seat,
            men: a.men!,
            raised: a.men!,
            power: arms.power,
            arms: words,
            year,
            event,
          });
          return;
        }
        case "grain": {
          // (A year's bread for each, or as many years' as asked.)
          const years = godAmount(a);
          let grain = 0;
          for (const cell of to.members) {
            const n = Math.round(
              (c.provinces.get(cell)?.total() ?? 0) * GOD_BREAD * (years === 1 ? 1 : years),
            );
            if (n > 0) grain += markets.of(cell).move("made", G.grain, n);
          }
          emit({ grain, ...(asked(a) ? { years } : {}) });
          return;
        }
        case "wealth":
        case "poorer": {
          // (Doubled or halved, as they always were, unless another amount is asked: so many times, or such a share taken.)
          const much = godAmount(a),
            plain = !asked(a);
          let before = 0,
            after = 0;
          for (const cell of to.members) {
            const m = markets.get(cell);
            if (!m) continue;
            for (let g = 0; g < GOODS.length; g++) {
              const had = Math.max(0, m.stock[g]!);
              before += had * GOODS[g]!.value;
              if (a.what === "wealth")
                m.move("made", g, Math.floor(plain ? had : had * (much - 1)));
              else m.move("spoiled", g, Math.floor(plain ? had / 2 : had * much));
              after += Math.max(0, m.stock[g]!) * GOODS[g]!.value;
            }
          }
          const people = Math.max(1, peopleOf(c, to));
          emit({
            before: before / people,
            after: after / people,
            ...(plain ? {} : a.what === "wealth" ? { times: much } : { share: much }),
          });
          return;
        }
        case "people": {
          const share = godAmount(a);
          let added = 0;
          for (const cell of to.members) {
            const p = c.provinces.get(cell);
            if (!p) continue;
            for (let r = 0; r < p.counts.rows; r++)
              for (let o = 0; o < COLS; o++) {
                const n = Math.floor(p.counts.get(r, o) * share);
                if (n > 0) {
                  p.counts.add(r, o, n);
                  added += n;
                }
              }
          }
          emit({ people: added, ...(asked(a) ? { share } : {}) });
          return;
        }
        case "town": {
          const many = godAmount(a),
            cell = emptyBeside(c, to)!,
            from = c.provinces.get(to.seat) ?? c.provinces.get(to.members[0]!)!,
            event = emit({ people: many, cell });
          let dest = c.provinces.get(cell);
          if (!dest) {
            dest = c.provinces.add(new Province(cell, year, event));
            world.events.emit({
              type: POPULATION_EVENTS.peopled.type,
              place: dest.ref,
              causes: [{ ref: event, role: "trigger", weight: 1 }],
              data: { people: many },
            });
          }
          if (from.knowsCultivation && !dest.knowsCultivation) {
            dest.knowsCultivation = true;
            dest.cultivation = from.cultivation;
          }
          if (from.herding && !dest.herding) dest.herding = from.herding;
          // (Of every age and trade as its seat is, as many as the town begins with, and a year's bread for them.)
          const all = Math.max(1, from.total());
          let made = 0;
          for (let r = 0; r < from.counts.rows; r++)
            for (let o = 0; o < COLS; o++) {
              const n = Math.floor((from.counts.get(r, o) * many) / all);
              if (n > 0) {
                dest.counts.add(r, o, n);
                made += n;
              }
            }
          markets.of(cell).move("made", G.grain, made * GOD_BREAD);
          realms.join(to, cell);
          return;
        }
        case "craft":
        case "age": {
          // (Each land its own next crafts, in the tree's order from what it knows: its seat's are told.)
          const most = a.what === "age" ? godAmount(a) : 1,
            ids = godLearning(c, to.seat, most),
            event = emit({ crafts: ids, lands: to.members.length });
          for (const cell of to.members) {
            const p = c.provinces.get(cell);
            if (!p?.total()) continue;
            for (const id of cell === to.seat ? ids : godLearning(c, cell, most)) {
              if (id === "cultivation") {
                if (!p.knowsCultivation) {
                  p.knowsCultivation = true;
                  p.cultivation = event;
                }
                continue;
              }
              const pr = openTo(c, cell).find((x) => x.id === id);
              if (pr) giveLore(c, cell, pr, event);
            }
          }
          return;
        }
        case "rightful":
        case "wrongful": {
          const o = orderOf(world)!.of(to.ref)!,
            was = o.legitimacy;
          o.legitimacy = godAmount(a);
          emit({ from: was, to: o.legitimacy });
          return;
        }
        case "calm":
        case "stir": {
          // (Every grievance forgotten, or every land sore, as they always were; or a share of each grievance forgotten,
          // or every land at least so sore.)
          const much = godAmount(a),
            event = emit({
              lands: to.members.length,
              ...(asked(a) ? (a.what === "calm" ? { share: much } : { level: much }) : {}),
            });
          for (const cell of to.members) {
            const d = realms.discontent(cell);
            realms.setDiscontent(
              cell,
              !asked(a)
                ? a.what === "calm"
                  ? { level: 0, cause: null }
                  : { level: 1, cause: event }
                : a.what === "calm"
                  ? { level: d.level * (1 - much), cause: d.cause }
                  : d.level >= much
                    ? d
                    : { level: much, cause: event },
            );
          }
          return;
        }
        case "peace": {
          const years = godAmount(a),
            event = emit(asked(a) ? { years } : {});
          // (Whatever bound the two before gives way to the god's truce: its years are the ones that hold.)
          unbind(to.ref, other!.ref);
          applyPeace(world, c, to, other!, "truce", t, { ...by, cause: event }, years);
          return;
        }
        case "war": {
          const event = emit({});
          applyWar(world, c, to, other!, undefined, t, { ...by, cause: event });
          return;
        }
        case "pact": {
          const event = emit({}),
            regard = diplomacyOf(world).get(to.ref, other!.ref)!;
          regard.pact = world.events.emit({
            type: DIPLOMACY_EVENTS.pact.type,
            subjects: [regard.a, regard.b],
            place,
            causes: [{ ref: event, role: "agent", weight: 1 }],
            data: { a: realmName(to), b: realmName(other!), reason: "the god's word", by: held.by },
          });
          return;
        }
        case "swear": {
          const years = godAmount(a),
            event = emit(asked(a) ? { years } : {});
          unbind(to.ref, other!.ref);
          bondsOf(world).add({
            kind: "vassal",
            from: other!.ref,
            to: to.ref,
            war: event,
            event,
            grain: 0,
            since: year,
            until: year + years,
            paid: 0,
            short: 0,
            shortSince: 0,
          });
          return;
        }
        case "annex": {
          // (The land of theirs nearest, or as many as asked, each the nearest left: never their seat past the first.)
          const most = godAmount(a),
            cell = frontier(c, to, other!)[0]!,
            event = emit({ cell, ...(asked(a) ? { lands: most } : {}) });
          for (let n = 0, at: number | undefined = cell; at !== undefined;) {
            realms.leave(other!, at);
            realms.join(to, at);
            realms.setDiscontent(at, { level: 0.3, cause: event });
            if (++n >= most || other!.members.length <= 1) break;
            at = frontier(c, to, other!).find((x) => x !== other!.seat);
          }
          cutOff(c, other!, event);
          return;
        }
      }
    },
  });
  // The god's hosts waste as any host kept under arms does, and are gone with their realm: nothing while none stands.
  world.system({
    key: "169.war.godhosts",
    every: YEAR,
    run: () => {
      if (hosts.dormant()) return;
      for (const h of [...hosts.all()]) {
        const r = politiesOf(world).get(h.realm);
        h.men -= Math.round(h.men * GOD_HOST_WASTE);
        if (!r || r.ended !== null || h.men < GOD_HOST_LEAST) hosts.drop(h);
      }
    },
  });
}
