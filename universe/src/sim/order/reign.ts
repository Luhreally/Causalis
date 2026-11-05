// A ruler ruled by the god's hand (Lives L4). Taking a ruler keeps nothing: the page knows whom it rules, and a
// world under a ruler who does nothing runs exactly as it would have. Each thing done is a command naming the realm
// and the ruler, refused in words when the ruler has not the standing, and told as what the world already tells: a
// law changed, a tithe set, a war declared and its peace, the same stores and the same pages. What a ruler can do
// comes from their station, read off what the world says they hold: what law rests on, whether anything is written,
// whose leave they rule by, how far the realm holds them rightful. Marriages of state are kept on the two realms'
// orders, and move one number: what the two realms think of each other, which war and pacts read.
import {
  defineEventType,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  REIGN,
  carried,
  decreeCost,
  mustCarry,
  peaceRefused,
  tieOf,
  warCost,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { loreOf } from "../lore/lore.ts";
import { LAW, POLITY_EVENTS, politiesOf, reach, realmName, type Polity } from "../polity/polity.ts";
import { interestsOf, pressure } from "../polity/interests.ts";
import { WAR, WAR_EVENTS, fieldedOf, frontier, warsOf } from "../war/war.ts";
import { DIPLOMACY_EVENTS, diplomacyOf, relationRef } from "../diplomacy/diplomacy.ts";
import { capacityOf, orderOf, realmOrder, type RealmOrder } from "./order.ts";
import {
  LAWS,
  LAW_EVENTS,
  LAW_OF,
  LAW_POSITIONS,
  approvalOf,
  stepVoices,
  swayOnLaws,
  type Law,
} from "./laws.ts";

export const REIGN_EVENTS = { wed: defineEventType("reign.wed", 5) };

/** Who a command is done as. */
export type RulerArgs = { readonly realm: Ref; readonly ruler: string };
/** A law set, or the tithe: `to` is a law's position, or the tithe's parts in a hundred. */
export type DecreeArgs = RulerArgs & { readonly law: Law | "tithe"; readonly to: number };
/** A war on a realm, for a land of it (its frontier's first, if none is named). */
export type WarArgs = RulerArgs & { readonly against: Ref; readonly prize?: number };
export type PeaceArgs = RulerArgs & { readonly with: Ref };
/** One of a house: who, and how they stand to its ruler ("self" is the ruler). */
export type HousePerson = {
  readonly name: string;
  readonly sex: number;
  readonly born: number;
  readonly tie: string;
};
export type WedArgs = RulerArgs & {
  readonly to: Ref;
  readonly who: HousePerson;
  readonly partner: HousePerson;
};

/** What a ruler holds, as the world says it. */
export type Station = {
  /** The share of the realm's voices they must have for a thing (0: they rule alone). */
  readonly carry: number;
  /** Whether anything is written at their seat, and whether a word of theirs can be law. */
  readonly written: boolean;
  readonly writes: boolean;
  readonly legitimacy: number;
  readonly capacity: number;
  readonly lands: number;
  /** Their lands past the seat's reach: a word stops short of them, and they chafe at it. */
  readonly beyond: readonly number[];
};

/** Voices for and against a thing, and the groups most against it. */
export type Voices = {
  readonly forIt: number;
  readonly against: number;
  readonly share: number;
  readonly names: readonly string[];
};

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));
const pct = (x: number) => Math.round(x * 100);
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** What a ruler holds now. */
export function stationOf(ctx: PopulationContext, r: Polity): Station {
  const lore = loreOf(ctx.world),
    written = lore.effect(r.seat, "writing") > 0,
    steps = reach(ctx, r),
    rules = 3 + lore.effect(r.seat, "reach"),
    o = orderOf(ctx.world)?.of(r.ref);
  return {
    carry: mustCarry(r.leadership, r.succession),
    written,
    writes: written || r.law !== LAW.indexOf("custom"),
    legitimacy: o?.legitimacy ?? 0.6,
    capacity: capacityOf(ctx, r).value,
    lands: r.members.length,
    beyond: r.members.filter((c) => (steps.get(c) ?? 0) > rules),
  };
}

/** Why a ruler no longer can (null: they rule). */
export function rulerProblem(world: World, args: unknown): string | null {
  const a = args as Partial<RulerArgs> | null,
    r = typeof a?.realm === "string" ? politiesOf(world).get(a.realm) : undefined;
  if (!r || r.ended !== null) return "that realm has fallen";
  return r.ruler.name === a?.ruler ? null : `${String(a?.ruler)} no longer rules there`;
}

const standing = (world: World, ref: unknown): Polity | null => {
  const r = typeof ref === "string" ? politiesOf(world).get(ref as Ref) : undefined;
  return r && r.ended === null ? r : null;
};

/** The groups named in words, the first two. */
const namesOf = (groups: readonly { group: string; by: number }[]): string[] =>
  [...groups]
    .filter((g) => g.by < 0)
    .sort((a, b) => a.by - b.by || (a.group < b.group ? -1 : 1))
    .slice(0, 2)
    .map((g) => g.group);

const voicesOf = (forIt: number, against: number, names: readonly string[]): Voices => ({
  forIt,
  against,
  share: carried(forIt, against),
  names,
});

/** The realm's voices on a step of a law. */
export function lawVoices(
  ctx: PopulationContext,
  r: Polity,
  o: RealmOrder,
  law: Law,
  to: number,
  t: SimTime,
): Voices {
  const v = stepVoices(swayOnLaws(ctx, r, o, t), law, o.laws[LAW_OF[law]]!, to);
  return voicesOf(v.forIt, v.against, namesOf(v.groups));
}

/** The realm's voices on a tithe: what those who want it lighter and those who want it heavier ask. */
export function titheVoices(ctx: PopulationContext, r: Polity, to: number, t: SimTime): Voices {
  const voices = interestsOf(ctx, r, t),
    up = pressure(voices, "more tribute"),
    down = pressure(voices, "lighter tribute"),
    heavier = to > Math.round(r.tribute * 100),
    forIt = heavier ? up : down,
    against = heavier ? down : up,
    names = voices
      .filter((i) =>
        i.demands.some((d) => d.want === (heavier ? "lighter tribute" : "more tribute")),
      )
      .map((i) => ({ group: i.group, by: -i.sway }));
  return voicesOf(forIt.total, against.total, namesOf(names));
}

/** The realm's voices on a war on a realm. */
export function warVoices(ctx: PopulationContext, r: Polity, foe: Polity, t: SimTime): Voices {
  const voices = interestsOf(ctx, r, t),
    regard = diplomacyOf(ctx.world).get(r.ref, foe.ref);
  let forIt =
      pressure(voices, "war", foe.ref).total +
      REIGN.warHatred * Math.max(0, -(regard?.opinion ?? 0)),
    against = pressure(voices, "peace", foe.ref).total + (regard?.pact ? REIGN.warPactVoices : 0);
  const groups: { group: string; by: number }[] = [];
  for (const i of voices) {
    const lean = i.sway * (REIGN.warLeans[i.group] ?? 0);
    if (lean > 0) forIt += lean;
    else against -= lean;
    groups.push({ group: i.group, by: lean });
  }
  return voicesOf(forIt, against, namesOf(groups));
}

/** Why voices do not carry a thing (null: they do). */
function carryProblem(st: Station, v: Voices): string | null {
  if (v.share >= st.carry) return null;
  return `You must carry ${pct(st.carry)} in a hundred of the realm's voices, and have ${pct(v.share)}${v.names.length ? `: ${v.names.join(" and ")} stand against it` : ""}.`;
}

/** Why a law cannot be set, or the tithe (null: it can). */
export function decreeProblem(
  ctx: PopulationContext,
  r: Polity,
  law: unknown,
  to: unknown,
  t: SimTime,
): string | null {
  const o = orderOf(ctx.world)?.of(r.ref);
  if (!o) return "this realm has no order yet to set anything in";
  const st = stationOf(ctx, r);
  if (st.legitimacy < REIGN.wordLine)
    return `Only ${pct(st.legitimacy)} in a hundred hold your rule rightful: your word stops at the seat's door.`;
  if (law === "tithe") {
    const now = Math.round(r.tribute * 100);
    if (
      !Number.isInteger(to) ||
      (to as number) < REIGN.titheLeast ||
      (to as number) > REIGN.titheMost
    )
      return `The tithe is ${REIGN.titheLeast} to ${REIGN.titheMost} parts in a hundred of the grain.`;
    if (to === now) return "It is so already.";
    return carryProblem(st, titheVoices(ctx, r, to as number, t));
  }
  if (!(LAWS as readonly unknown[]).includes(law)) return `a law is wanted: ${LAWS.join(", ")}`;
  const l = law as Law,
    now = o.laws[LAW_OF[l]]!;
  if (to === now) return "It is its law already.";
  if (to !== now + 1 && to !== now - 1) return "A law moves a step at a time.";
  if ((to as number) < 0 || (to as number) > 2) return "There is no such law.";
  if (!st.writes)
    return "Nothing is written here: custom is the law, and no word changes what has always been done.";
  const step = to as number;
  if (l === "faith" && beliefOf(ctx.world).of(r.seat).faith === null)
    return "Your people keep no faith to make a law of.";
  if (!st.written && (l === "justice" || l === "faith") && step === 2)
    return `"${LAW_POSITIONS[l][2]}" has to be written, and nothing is written at your seat.`;
  const v = stepVoices(swayOnLaws(ctx, r, o, t), l, now, step);
  // (Under the sacred, the temple's word on a law is the law's.)
  if (
    r.law === LAW.indexOf("the sacred") &&
    (v.groups.find((g) => g.group === "the temple")?.by ?? 0) < -0.02
  )
    return "Law here is the sacred, and the temple stands against it.";
  return carryProblem(st, voicesOf(v.forIt, v.against, namesOf(v.groups)));
}

/** Why a ruler cannot go to war on a realm (null: they can). */
export function warProblem(
  ctx: PopulationContext,
  r: Polity,
  foe: Polity | null,
  prize: unknown,
  t: SimTime,
): string | null {
  if (!foe) return "That realm has fallen.";
  if (foe === r) return "A realm cannot be set against itself.";
  if (warsOf(ctx.world).between(r.ref, foe.ref)) return "You are at war with them already.";
  const lands = frontier(ctx, r, foe);
  if (!lands.length) return "No land lies between you to fight for.";
  if (prize !== undefined && !lands.includes(prize as number))
    return "That land is not within your reach.";
  const st = stationOf(ctx, r);
  if (st.legitimacy < REIGN.marchLine)
    return `Only ${pct(st.legitimacy)} in a hundred hold your rule rightful: no one will march for you.`;
  if (fieldedOf(ctx, r) < 1) return "You have no one to send.";
  return carryProblem(st, warVoices(ctx, r, foe, t));
}

/** Why a foe will not hear of peace (null: they will). */
export function peaceProblem(ctx: PopulationContext, r: Polity, foe: Polity | null): string | null {
  if (!foe) return "That realm has fallen.";
  const w = warsOf(ctx.world).between(r.ref, foe.ref);
  if (!w) return "You are not at war with them.";
  if (w.civil) return "This war is for your own seat: there is no one to ask for peace.";
  const year = yearOfMoment(ctx.world.now),
    side = w.attacker === r.ref ? 0 : 1,
    attacker = side === 0 ? r : foe,
    won = w.battles.filter((b) => b.won === (side === 0)).length,
    people = attacker.members.reduce((s, c) => s + (ctx.provinces.get(c)?.total() ?? 0), 0),
    weary = (w.fallen[0] + w.fallen[1]) / Math.max(1, people);
  return peaceRefused(
    side === 1,
    w.battles.length - 2 * won,
    year - w.declared,
    weary,
    attacker.members.includes(w.prize),
  )
    ? `${cap(realmName(foe))} is winning, and holds out for the land it came for.`
    : null;
}

/** What a marriage of state between two realms would be remembered at (0: their peoples keep no houses). */
export function tieBetween(world: World, a: Polity, b: Polity): number {
  const culture = cultureOf(world),
    kin = (p: Polity) => culture.get(p.seat)?.traits[WAY.kinship] ?? 0.5;
  return tieOf(kin(a), kin(b), a.succession === 0, b.succession === 0);
}

/** Why two of two houses cannot be wed (null: they can). */
export function wedProblem(
  ctx: PopulationContext,
  r: Polity,
  other: Polity | null,
  who: Partial<HousePerson> | null | undefined,
  partner: Partial<HousePerson> | null | undefined,
): string | null {
  const world = ctx.world;
  if (!other) return "That realm has fallen.";
  if (other === r) return "They are of your own house.";
  const person = (p: Partial<HousePerson> | null | undefined) =>
    !!p &&
    typeof p.name === "string" &&
    p.name.length > 0 &&
    Number.isInteger(p.sex) &&
    Number.isInteger(p.born) &&
    typeof p.tie === "string";
  if (!person(who) || !person(partner)) return "Who is to be wed to whom?";
  const year = yearOfMoment(world.now),
    grown = ctx.life.adulthood;
  if (year - who!.born! < grown) return `${who!.name} is not grown.`;
  if (year - partner!.born! < grown) return `${partner!.name} is not grown.`;
  // (L3's limit: the hand's births need a mother and a father; L5 fixes the kin words first.)
  if (who!.sex === partner!.sex) return "Two of one sex are not yet wed in this world.";
  if (who!.tie === "self" && who!.name !== r.ruler.name) return `${who!.name} does not rule.`;
  if (partner!.tie === "self" && partner!.name !== other.ruler.name)
    return `${partner!.name} does not rule there.`;
  const regard = diplomacyOf(world).get(r.ref, other.ref);
  if (!regard) return "Your houses have never met: no border or road lies between you.";
  if (warsOf(world).between(r.ref, other.ref)) return "You are at war with them.";
  if (regard.opinion < REIGN.wedRefused)
    return `${cap(realmName(other))} thinks too ill of you to give you one of its own.`;
  if (tieBetween(world, r, other) <= 0)
    return "Your peoples do not count kin so: a match would bind two people, not two realms.";
  const orders = orderOf(world),
    mine = orders?.of(r.ref)?.matches ?? [],
    theirs = orders?.of(other.ref)?.matches ?? [];
  if (mine.some((m) => m.with === other.ref && year - m.year < REIGN.wedAgain))
    return `A marriage ties your house to ${realmName(other)} already.`;
  if (mine.some((m) => m.who === who!.name)) return `${who!.name} is wed already.`;
  if (theirs.some((m) => m.who === partner!.name)) return `${partner!.name} is wed already.`;
  return null;
}

/** Teach a peopled world what a ruler can do by the god's hand: "reign.decree", "reign.war", "reign.peace", "reign.wed". */
export function installReign(world: World, ctx: () => PopulationContext): void {
  const orderHere = (r: Polity) =>
      realmOrder(
        orderOf(world)!,
        r,
        cultureOf(world).get(r.seat),
        beliefOf(world).of(r.seat).faith !== null,
      ),
    placeOf = (c: PopulationContext, r: Polity) => c.provinces.get(r.seat)?.ref ?? null,
    word = (r: Polity): Factor => ({
      name: `the word of ${r.ruler.name}`,
      value: 1,
      contribution: 1,
      source: null,
    }),
    voiced = (v: Voices, carry: number): Factor[] => [
      {
        name: carry > 0 ? "the voices carried" : "the voices for it",
        value: v.share,
        contribution: v.forIt,
        source: null,
      },
      ...(v.names.length
        ? [
            {
              name: `${v.names.join(" and ")} against it`,
              value: v.against,
              contribution: -v.against,
              source: null,
            },
          ]
        : []),
    ],
    /** A word's cost: in standing, and in the grievance of the lands past the seat's reach. */
    pay = (
      c: PopulationContext,
      r: Polity,
      o: RealmOrder,
      cost: number,
      against: number,
      event: Ref,
    ) => {
      o.legitimacy = clamp(0.02, 0.98, o.legitimacy - cost);
      const realms = politiesOf(world);
      if (against > 0)
        for (const land of stationOf(c, r).beyond) {
          if (land === r.seat) continue;
          const d = realms.discontent(land);
          realms.setDiscontent(land, {
            level: d.level + REIGN.pastReach * against,
            cause: event,
          });
        }
    };

  world.defineCommand({
    type: "reign.decree",
    validate: (args) => {
      const bad = rulerProblem(world, args);
      if (bad) return bad;
      const a = args as DecreeArgs;
      return decreeProblem(ctx(), standing(world, a.realm)!, a.law, a.to, world.now);
    },
    apply: (command, t) => {
      const a = command.args as DecreeArgs,
        c = ctx(),
        r = standing(world, a.realm)!,
        o = orderHere(r),
        st = stationOf(c, r),
        by = r.ruler.name,
        year = yearOfMoment(t);
      if (a.law === "tithe") {
        const from = Math.round(r.tribute * 100),
          v = titheVoices(c, r, a.to, t),
          decision = world.decisions.record({
            rule: "polity.tithe",
            subject: r.ref,
            outcome: { from, to: a.to },
            score: v.share,
            threshold: st.carry,
            factors: [word(r), ...voiced(v, st.carry)],
          }),
          event = world.events.emit({
            type: POLITY_EVENTS.tithe.type,
            subjects: [r.ref],
            place: placeOf(c, r),
            causes: [
              { ref: command.id, role: "agent", weight: 1 },
              { ref: decision, role: "enabler", weight: 0.5 },
            ],
            data: { name: realmName(r), from, to: a.to, by },
          });
        r.tribute = a.to / 100;
        r.tithed = event;
        pay(c, r, o, decreeCost(v.against), v.against, event);
        return;
      }
      const k = LAW_OF[a.law],
        from = o.laws[k]!,
        sway = swayOnLaws(c, r, o, t),
        v = stepVoices(sway, a.law, from, a.to),
        voices = voicesOf(v.forIt, v.against, namesOf(v.groups)),
        decision = world.decisions.record({
          rule: "order.law",
          subject: r.ref,
          outcome: {
            law: a.law,
            from: LAW_POSITIONS[a.law][from]!,
            to: LAW_POSITIONS[a.law][a.to]!,
          },
          score: voices.share,
          threshold: st.carry,
          factors: [word(r), ...voiced(voices, st.carry)],
        }),
        event = world.events.emit({
          type: LAW_EVENTS.changed.type,
          subjects: [r.ref],
          place: placeOf(c, r),
          causes: [
            { ref: command.id, role: "agent", weight: 1 },
            { ref: decision, role: "enabler", weight: 0.5 },
          ],
          data: { realm: realmName(r), law: a.law, from, to: a.to, by, year },
        });
      o.laws[k] = a.to;
      o.lawEvents[k] = event;
      o.approval = approvalOf(o.laws, sway);
      pay(c, r, o, decreeCost(v.against), v.against, event);
    },
  });

  world.defineCommand({
    type: "reign.war",
    validate: (args) => {
      const bad = rulerProblem(world, args);
      if (bad) return bad;
      const a = args as WarArgs;
      return warProblem(
        ctx(),
        standing(world, a.realm)!,
        standing(world, a.against),
        a.prize,
        world.now,
      );
    },
    apply: (command, t) => {
      const a = command.args as WarArgs,
        c = ctx(),
        r = standing(world, a.realm)!,
        foe = standing(world, a.against)!,
        o = orderHere(r),
        st = stationOf(c, r),
        year = yearOfMoment(t),
        diplomacy = diplomacyOf(world),
        regard = diplomacy.get(r.ref, foe.ref),
        pact = regard?.pact ?? null,
        grievance = (regard?.opinion ?? 0) < 0,
        lands = frontier(c, r, foe),
        prize = a.prize ?? lands[0]!,
        v = warVoices(c, r, foe, t),
        factors: Factor[] = [
          word(r),
          {
            name: "the land they want",
            value: prize,
            contribution: 0.5,
            source: { ref: cellRef(0, prize), role: "enabler", weight: 1 },
          },
          ...voiced(v, st.carry),
        ];
      if (regard)
        factors.push({
          name: "what they think of each other",
          value: regard.opinion,
          contribution: -regard.opinion,
          source: { ref: relationRef(r.ref, foe.ref), role: "pressure", weight: 1 },
        });
      const decision = world.decisions.record({
          rule: "war.declare",
          subject: r.ref,
          outcome: { against: foe.ref, prize },
          score: v.share,
          threshold: st.carry,
          factors,
        }),
        ref = world.minter.mint(WAR),
        event = world.events.emit({
          type: WAR_EVENTS.declared.type,
          subjects: [ref, r.ref, foe.ref],
          place: cellRef(0, prize),
          causes: [
            { ref: command.id, role: "agent", weight: 1 },
            { ref: decision, role: "trigger", weight: 1 },
          ],
          // (`aimed`: the battles go for the land named, while it can be reached: war.ts.)
          data: { a: realmName(r), b: realmName(foe), by: r.ruler.name, aimed: true },
        });
      warsOf(world).add({
        ref,
        attacker: r.ref,
        defender: foe.ref,
        declared: year,
        event,
        prize,
        battles: [],
        fallen: [0, 0],
        ended: null,
        peace: null,
      });
      if (regard && pact) {
        const broken = world.events.emit({
          type: DIPLOMACY_EVENTS.broken.type,
          subjects: [regard.a, regard.b],
          place: placeOf(c, r),
          causes: [
            { ref: pact, role: "enabler", weight: 0.4 },
            { ref: event, role: "trigger", weight: 0.6 },
          ],
          data: { a: realmName(r), b: realmName(foe), reason: `the word of ${r.ruler.name}` },
        });
        diplomacy.remember(r.ref, foe.ref, {
          name: "a broken pact",
          value: -0.4,
          year,
          source: broken,
        });
        regard.pact = null;
      }
      pay(c, r, o, warCost(pact !== null, grievance), 0, event);
    },
  });

  world.defineCommand({
    type: "reign.peace",
    validate: (args) => {
      const bad = rulerProblem(world, args);
      if (bad) return bad;
      const a = args as PeaceArgs;
      return peaceProblem(ctx(), standing(world, a.realm)!, standing(world, a.with));
    },
    apply: (command, t) => {
      const a = command.args as PeaceArgs,
        c = ctx(),
        r = standing(world, a.realm)!,
        foe = standing(world, a.with)!,
        w = warsOf(world).between(r.ref, foe.ref)!,
        attacker = w.attacker === r.ref ? r : foe,
        defender = attacker === r ? foe : r,
        year = yearOfMoment(t),
        won = attacker.members.includes(w.prize),
        o = orderHere(r);
      w.ended = year;
      w.peace = world.events.emit({
        type: WAR_EVENTS.peace.type,
        subjects: [w.ref, attacker.ref, defender.ref],
        place: placeOf(c, attacker),
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: {
          a: realmName(attacker),
          b: realmName(defender),
          years: year - w.declared,
          won,
          by: r.ruler.name,
        },
      });
      diplomacyOf(world).remember(attacker.ref, defender.ref, {
        name: "a war between them",
        value: -0.45,
        year,
        source: w.event,
      });
      o.legitimacy = clamp(
        0.02,
        0.98,
        o.legitimacy + (won === (attacker === r) ? REIGN.peaceWon : REIGN.peaceLost),
      );
    },
  });

  world.defineCommand({
    type: "reign.wed",
    validate: (args) => {
      const bad = rulerProblem(world, args);
      if (bad) return bad;
      const a = args as Partial<WedArgs>;
      return wedProblem(ctx(), standing(world, a.realm)!, standing(world, a.to), a.who, a.partner);
    },
    apply: (command, t) => {
      const a = command.args as WedArgs,
        c = ctx(),
        r = standing(world, a.realm)!,
        other = standing(world, a.to)!,
        year = yearOfMoment(t),
        tie = tieBetween(world, r, other),
        event = world.events.emit({
          type: REIGN_EVENTS.wed.type,
          subjects: [r.ref, other.ref],
          place: placeOf(c, r),
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: {
            realm: realmName(r),
            other: realmName(other),
            who: a.who.name,
            to: a.partner.name,
            by: r.ruler.name,
            tie,
          },
        }),
        diplomacy = diplomacyOf(world),
        term = { name: "a marriage between their houses", value: tie };
      diplomacy.remember(r.ref, other.ref, { ...term, year, source: event });
      // (It weighs at once: it is what they think of each other from today, and is reckoned again each year.)
      const regard = diplomacy.get(r.ref, other.ref);
      if (regard) {
        regard.terms = [...regard.terms, { ...term, source: event }];
        regard.opinion = clamp(-1, 1, regard.opinion + tie);
      }
      const keep = (p: Polity, who: HousePerson, to: HousePerson, withRealm: Ref) => {
        const o = orderHere(p);
        o.matches = [
          ...(o.matches ?? []),
          {
            with: withRealm,
            who: who.name,
            whoSex: who.sex,
            whoBorn: who.born,
            to: to.name,
            toSex: to.sex,
            toBorn: to.born,
            year,
            event,
          },
        ];
      };
      keep(r, a.who, a.partner, other.ref);
      keep(other, a.partner, a.who, r.ref);
    },
  });
}
