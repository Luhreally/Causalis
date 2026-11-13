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
import { G, GOODS, designWords, type Part } from "../../rules/index.ts";
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
function learningFor(c: PopulationContext, seat: number, most: number): string[] {
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
    atWar = !!war && war.ended === null;
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
      return learningFor(c, to.seat, 1).length
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
        by = { by: held.by, cause: command.id, extra: godWill(true) };
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
          let grain = 0;
          for (const cell of to.members) {
            const n = Math.round((c.provinces.get(cell)?.total() ?? 0) * GOD_BREAD);
            if (n > 0) grain += markets.of(cell).move("made", G.grain, n);
          }
          emit({ grain });
          return;
        }
        case "wealth":
        case "poorer": {
          let before = 0,
            after = 0;
          for (const cell of to.members) {
            const m = markets.get(cell);
            if (!m) continue;
            for (let g = 0; g < GOODS.length; g++) {
              const had = Math.max(0, m.stock[g]!);
              before += had * GOODS[g]!.value;
              if (a.what === "wealth") m.move("made", g, Math.floor(had));
              else m.move("spoiled", g, Math.floor(had / 2));
              after += Math.max(0, m.stock[g]!) * GOODS[g]!.value;
            }
          }
          const people = Math.max(1, peopleOf(c, to));
          emit({ before: before / people, after: after / people });
          return;
        }
        case "people": {
          let added = 0;
          for (const cell of to.members) {
            const p = c.provinces.get(cell);
            if (!p) continue;
            for (let r = 0; r < p.counts.rows; r++)
              for (let o = 0; o < COLS; o++) {
                const n = Math.floor(p.counts.get(r, o) * GOD_PEOPLE);
                if (n > 0) {
                  p.counts.add(r, o, n);
                  added += n;
                }
              }
          }
          emit({ people: added });
          return;
        }
        case "town": {
          const cell = emptyBeside(c, to)!,
            from = c.provinces.get(to.seat) ?? c.provinces.get(to.members[0]!)!,
            event = emit({ people: GOD_TOWN, cell });
          let dest = c.provinces.get(cell);
          if (!dest) {
            dest = c.provinces.add(new Province(cell, year, event));
            world.events.emit({
              type: POPULATION_EVENTS.peopled.type,
              place: dest.ref,
              causes: [{ ref: event, role: "trigger", weight: 1 }],
              data: { people: GOD_TOWN },
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
              const n = Math.floor((from.counts.get(r, o) * GOD_TOWN) / all);
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
          const most = a.what === "age" ? GOD_AGE : 1,
            ids = learningFor(c, to.seat, most),
            event = emit({ crafts: ids, lands: to.members.length });
          for (const cell of to.members) {
            const p = c.provinces.get(cell);
            if (!p?.total()) continue;
            for (const id of cell === to.seat ? ids : learningFor(c, cell, most)) {
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
          o.legitimacy = a.what === "rightful" ? 0.98 : 0.02;
          emit({ from: was, to: o.legitimacy });
          return;
        }
        case "calm":
        case "stir": {
          const event = emit({ lands: to.members.length });
          for (const cell of to.members)
            realms.setDiscontent(
              cell,
              a.what === "calm" ? { level: 0, cause: null } : { level: 1, cause: event },
            );
          return;
        }
        case "peace": {
          const event = emit({});
          applyPeace(world, c, to, other!, "truce", t, { ...by, cause: event });
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
          const event = emit({});
          bondsOf(world).add({
            kind: "vassal",
            from: other!.ref,
            to: to.ref,
            war: event,
            event,
            grain: 0,
            since: year,
            until: year + 30,
            paid: 0,
            short: 0,
            shortSince: 0,
          });
          return;
        }
        case "annex": {
          const cell = frontier(c, to, other!)[0]!,
            event = emit({ cell });
          realms.leave(other!, cell);
          realms.join(to, cell);
          realms.setDiscontent(cell, { level: 0.3, cause: event });
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
