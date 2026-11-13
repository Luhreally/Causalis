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
  G,
  REIGN,
  TERMS,
  TIES,
  answerOf,
  carried,
  decreeCost,
  mustCarry,
  peaceRefused,
  tieOf,
  warCost,
  type PeaceOffer,
  type Refusal,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { loreOf } from "../lore/lore.ts";
import {
  LAW,
  POLITY_EVENTS,
  cutOff,
  politiesOf,
  reach,
  realmName,
  type Polity,
} from "../polity/polity.ts";
import { interestsOf, pressure } from "../polity/interests.ts";
import { WAR, WAR_EVENTS, fieldedOf, frontier, strengthOf, warsOf } from "../war/war.ts";
import {
  bindPeace,
  bondsOf,
  canBind,
  grainMade,
  landOffered,
  owing,
  riseUp,
  spareOf,
  termsOfOffer,
} from "../war/bonds.ts";
import { DIPLOMACY_EVENTS, RIVALRY, diplomacyOf, relationRef } from "../diplomacy/diplomacy.ts";
import { openEmbassy, sendEnvoy, tiesOf } from "../war/ties.ts";
import type { MarketStore } from "../economy/market.ts";
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

export const REIGN_EVENTS = {
  wed: defineEventType("reign.wed", 5),
  /** The god's will carried through one of the realm, past what their station bounds: an omen the realm remembers. */
  channel: defineEventType("reign.channel", 4),
};

/**
 * Who a command is done as. `channel`: the god's will carried through them, past what their station bounds (the voices,
 * their standing, what others will hear); never past what the world has to do it with.
 */
export type RulerArgs = { readonly realm: Ref; readonly ruler: string; readonly channel?: boolean };
/** A law set, or the tithe: `to` is a law's position, or the tithe's parts in a hundred. */
export type DecreeArgs = RulerArgs & { readonly law: Law | "tithe"; readonly to: number };
/** A war on a realm, for a land of it (its frontier's first, if none is named). */
export type WarArgs = RulerArgs & { readonly against: Ref; readonly prize?: number };
/** Peace asked of a realm, and what is offered or demanded (absent: a truce, with nothing changed). */
export type PeaceArgs = RulerArgs & { readonly with: Ref; readonly offer?: PeaceOffer };
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
  channel = false,
): string | null {
  const o = orderOf(ctx.world)?.of(r.ref);
  if (!o) return "this realm has no order yet to set anything in";
  const st = stationOf(ctx, r);
  if (!channel && st.legitimacy < REIGN.wordLine)
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
    return channel ? null : carryProblem(st, titheVoices(ctx, r, to as number, t));
  }
  if (!(LAWS as readonly unknown[]).includes(law)) return `a law is wanted: ${LAWS.join(", ")}`;
  const l = law as Law,
    now = o.laws[LAW_OF[l]]!;
  if (to === now) return "It is its law already.";
  if (to !== now + 1 && to !== now - 1) return "A law moves a step at a time.";
  if ((to as number) < 0 || (to as number) > 2) return "There is no such law.";
  if (!st.writes && !channel)
    return "Nothing is written here: custom is the law, and no word changes what has always been done.";
  const step = to as number;
  if (l === "faith" && beliefOf(ctx.world).of(r.seat).faith === null)
    return "Your people keep no faith to make a law of.";
  if (!st.written && (l === "justice" || l === "faith") && step === 2)
    return `"${LAW_POSITIONS[l][2]}" has to be written, and nothing is written at your seat.`;
  if (channel) return null;
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
  channel = false,
): string | null {
  if (!foe) return "That realm has fallen.";
  if (foe === r) return "A realm cannot be set against itself.";
  if (warsOf(ctx.world).between(r.ref, foe.ref)) return "You are at war with them already.";
  const held = bondsOf(ctx.world),
    oath = held.oathOf(r.ref);
  if (oath)
    return `You have sworn to ${realmName(politiesOf(ctx.world).get(oath.to)!)}: you make no war of your own until year ${oath.until}, unless you rise.`;
  const bound = held.between(r.ref, foe.ref);
  if (bound)
    return bound.kind === "truce"
      ? `A truce holds you from them until year ${bound.until}.`
      : `${bound.from === r.ref ? "You pay them" : "They pay you"} tribute until year ${bound.until}: there is no war between you while it runs.`;
  if (tiesOf(ctx.world).sameLeague(r.ref, foe.ref))
    return "You stand in one league with them: none of you makes war on another while the fear holds.";
  const lands = frontier(ctx, r, foe);
  if (!lands.length) return "No land lies between you to fight for.";
  if (prize !== undefined && !lands.includes(prize as number))
    return "That land is not within your reach.";
  const st = stationOf(ctx, r);
  if (!channel && st.legitimacy < REIGN.marchLine)
    return `Only ${pct(st.legitimacy)} in a hundred hold your rule rightful: no one will march for you.`;
  if (fieldedOf(ctx, r) < 1) return "You have no one to send.";
  return channel ? null : carryProblem(st, warVoices(ctx, r, foe, t));
}

/** A foe's answer, in its own ruler's voice. */
const answers = (foe: Polity, words: string) =>
  `${foe.ruler.name} of ${foe.town} answers: "${words}"`;

/** Why a foe will not hear of a peace on these terms (null: they will). */
export function peaceProblem(
  ctx: PopulationContext,
  r: Polity,
  foe: Polity | null,
  offer: PeaceOffer = "truce",
  channel = false,
): string | null {
  if (!foe) return "That realm has fallen.";
  const world = ctx.world,
    w = warsOf(world).between(r.ref, foe.ref);
  if (!w) return "You are not at war with them.";
  if (w.civil) return "This war is for your own seat: there is no one to ask for peace.";
  const year = yearOfMoment(world.now),
    side = w.attacker === r.ref ? 0 : 1,
    attacker = side === 0 ? r : foe,
    won = w.battles.filter((b) => b.won === (side === 0)).length,
    people = attacker.members.reduce((s, c) => s + (ctx.provinces.get(c)?.total() ?? 0), 0),
    weary = (w.fallen[0] + w.fallen[1]) / Math.max(1, people),
    refused = !!peaceRefused(
      side === 1,
      w.battles.length - 2 * won,
      year - w.declared,
      weary,
      attacker.members.includes(w.prize),
    ),
    held = bondsOf(world),
    giving = offer === "give-land" || offer === "give-tribute",
    payer = giving ? r : foe;
  // What cannot be given is not asked of anyone's will.
  if (offer === "give-land" && landOffered(ctx, w, r, foe, offer) === null)
    return "You have no land to give them but your seat.";
  if (offer === "take-land" && landOffered(ctx, w, r, foe, offer) === null)
    return answers(
      foe,
      "We have no land to give you but our seat, and that you must come and take.",
    );
  if (offer === "give-tribute" || offer === "take-tribute") {
    if (Math.floor(TERMS.tributeShare * grainMade(ctx, payer)) < 1)
      return giving
        ? "Your people make no grain to pay with."
        : answers(foe, "We make no grain to pay you with.");
    if (spareOf(ctx, payer) < termsOfOffer(ctx, w, r, foe, offer, year).grain)
      return giving
        ? "Your people eat all they make: you have nothing to spare to pay with."
        : answers(foe, "We eat all we make. There is nothing here to pay you with.");
    if (owing(world, payer) >= TERMS.owesMost)
      return giving
        ? "You already pay as many as your stores can bear."
        : answers(foe, "We already pay as many as our stores can bear.");
  }
  if (offer === "take-knee" && Math.floor(TERMS.oathShare * grainMade(ctx, foe)) < 1)
    return answers(foe, "We make no grain to pay you with.");
  const code: Refusal = answerOf(
    offer,
    2 * won - w.battles.length,
    strengthOf(ctx, r) / Math.max(1, strengthOf(ctx, foe)),
    refused,
    canBind(world, r, foe),
  );
  // (Channelled, their will gives way; what they cannot give, or bind, stays as it is.)
  if (channel && code !== "cannot-bind") return null;
  switch (code) {
    case "winning":
      return answers(
        foe,
        "We are winning, and we came for more than your word. Offer us land or grain, or fight on.",
      );
    case "all":
      return answers(foe, "We shall have it all. Keep your grain until we come for it.");
    case "not-beaten":
      return answers(
        foe,
        "You have not beaten us. We give nothing to one who has won no more than it has lost.",
      );
    case "not-knee":
      return answers(
        foe,
        "We would sooner fall. Beat us twice over, and be three times what we are, and ask again.",
      );
    case "cannot-bind":
      return held.oathOf(foe.ref)
        ? answers(foe, "We are sworn to another already.")
        : held.oathOf(r.ref)
          ? answers(foe, "You are sworn yourself: one who has knelt takes no oaths.")
          : held.vassalsOf(foe.ref).length
            ? answers(foe, "Others are sworn to us: we kneel to no one while they are.")
            : answers(foe, "You hold as many oaths as anyone can make good.");
    default:
      return null;
  }
}

/** The offers a ruler could make in a war, in the order they are shown. */
export const OFFERS: readonly PeaceOffer[] = [
  "truce",
  "give-land",
  "give-tribute",
  "take-land",
  "take-tribute",
  "take-knee",
];

/** Why a vassal cannot rise (null: it can). */
export function riseProblem(ctx: PopulationContext, r: Polity, channel = false): string | null {
  const oath = bondsOf(ctx.world).oathOf(r.ref);
  if (!oath) return "You have sworn no oath.";
  const st = stationOf(ctx, r);
  if (!channel && st.legitimacy < REIGN.marchLine)
    return `Only ${pct(st.legitimacy)} in a hundred hold your rule rightful: no one will rise with you.`;
  return null;
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
  channel = false,
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
  if (!channel && regard.opinion < REIGN.wedRefused)
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

/** What a ruler's envoy can be sent to ask. */
export const ERRANDS = ["embassy", "pact", "gift"] as const;
export type RulerErrand = (typeof ERRANDS)[number];
export type EnvoyArgs = RulerArgs & { readonly to: Ref; readonly errand: RulerErrand };

/** The grain a ruler's gift would carry. */
export const giftOf = (ctx: PopulationContext, r: Polity): number =>
  Math.min(spareOf(ctx, r), Math.floor(TERMS.tributeShare * grainMade(ctx, r)));

/** Why an envoy can't go, or won't be heard, in the other ruler's voice (null: it can, and they will). */
export function envoyProblem(
  ctx: PopulationContext,
  r: Polity,
  other: Polity | null,
  errand: unknown,
  channel = false,
): string | null {
  if (!other) return "That realm has fallen.";
  if (other === r) return "No envoy is needed to your own seat.";
  if (!(ERRANDS as readonly unknown[]).includes(errand)) return "There is no such errand.";
  const world = ctx.world,
    regard = diplomacyOf(world).get(r.ref, other.ref),
    ties = tiesOf(world);
  if (!regard) return "No border or road lies between you: no one could reach them.";
  // (Channelled, they hear an envoy even in war; but swear to no one whose host stands against theirs.)
  if ((!channel || errand === "pact") && warsOf(world).between(r.ref, other.ref))
    return answers(other, "Send us no one while your host stands against ours.");
  if (errand === "embassy") {
    if (ties.embassyOf(r.ref, other.ref)) return "Your people are at their seat already.";
    if (ties.embassiesOf(r.ref).length >= TIES.embassiesMost)
      return `You keep ${TIES.embassiesMost} houses at others' seats already: there is no one left to send.`;
    if (!channel && regard.opinion < RIVALRY)
      return answers(other, "We keep no house here for those who wish us ill.");
    return null;
  }
  if (errand === "pact") {
    if (regard.pact) return "You are sworn to them already.";
    if (!channel && regard.opinion < TIES.envoyPactAt)
      return answers(other, "We do not know you well enough to swear to anything.");
    return null;
  }
  if (giftOf(ctx, r) < 1) return "Your people eat all they make: you have nothing to send.";
  return null;
}

const orderHere = (world: World, r: Polity) =>
    realmOrder(
      orderOf(world)!,
      r,
      cultureOf(world).get(r.seat),
      beliefOf(world).of(r.seat).faith !== null,
    ),
  placeOf = (c: PopulationContext, r: Polity) => c.provinces.get(r.seat)?.ref ?? null,
  /** Whose word it was: the ruler's, or one of the realm's who put it to them (roles.ts). */
  wordOf = (by: string): Factor => ({
    name: `the word of ${by}`,
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
    world: World,
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

/** The god's will carried through one of a realm, told as an omen of its own: what it did, whose it was. */
export function channelled(
  world: World,
  c: PopulationContext,
  r: Polity,
  command: Ref,
  who: string,
  act: string,
): Ref {
  return world.events.emit({
    type: REIGN_EVENTS.channel.type,
    subjects: [r.ref],
    place: placeOf(c, r),
    causes: [{ ref: command, role: "agent", weight: 1 }],
    data: { realm: realmName(r), who, act },
  });
}

/** Whose word a thing is, what moved it (the command), and what else weighed (the god's will, who put it to them). */
export type WordBy = {
  readonly by: string;
  readonly cause: Ref;
  readonly extra?: readonly Factor[];
};

const GOD_WILL: Factor = {
  name: "the god's will through them",
  value: 1,
  contribution: 1,
  source: null,
};
/** The god's will as a decision's factor, when channelled. */
export const godWill = (on: boolean | undefined): Factor[] => (on ? [GOD_WILL] : []);

/** A law set, or the tithe, by a ruler's word or one put to them and carried. */
export function applyDecree(
  world: World,
  c: PopulationContext,
  r: Polity,
  law: Law | "tithe",
  to: number,
  t: SimTime,
  w: WordBy,
): Ref {
  const o = orderHere(world, r),
    st = stationOf(c, r),
    by = w.by,
    year = yearOfMoment(t),
    extra = w.extra ?? [];
  if (law === "tithe") {
    const from = Math.round(r.tribute * 100),
      v = titheVoices(c, r, to, t),
      decision = world.decisions.record({
        rule: "polity.tithe",
        subject: r.ref,
        outcome: { from, to },
        score: v.share,
        threshold: st.carry,
        factors: [wordOf(by), ...extra, ...voiced(v, st.carry)],
      }),
      event = world.events.emit({
        type: POLITY_EVENTS.tithe.type,
        subjects: [r.ref],
        place: placeOf(c, r),
        causes: [
          { ref: w.cause, role: "agent", weight: 1 },
          { ref: decision, role: "enabler", weight: 0.5 },
        ],
        data: { name: realmName(r), from, to, by },
      });
    r.tribute = to / 100;
    r.tithed = event;
    pay(world, c, r, o, decreeCost(v.against), v.against, event);
    return event;
  }
  const k = LAW_OF[law],
    from = o.laws[k]!,
    sway = swayOnLaws(c, r, o, t),
    v = stepVoices(sway, law, from, to),
    voices = voicesOf(v.forIt, v.against, namesOf(v.groups)),
    decision = world.decisions.record({
      rule: "order.law",
      subject: r.ref,
      outcome: {
        law,
        from: LAW_POSITIONS[law][from]!,
        to: LAW_POSITIONS[law][to]!,
      },
      score: voices.share,
      threshold: st.carry,
      factors: [wordOf(by), ...extra, ...voiced(voices, st.carry)],
    }),
    event = world.events.emit({
      type: LAW_EVENTS.changed.type,
      subjects: [r.ref],
      place: placeOf(c, r),
      causes: [
        { ref: w.cause, role: "agent", weight: 1 },
        { ref: decision, role: "enabler", weight: 0.5 },
      ],
      data: { realm: realmName(r), law, from, to, by, year },
    });
  o.laws[k] = to;
  o.lawEvents[k] = event;
  o.approval = approvalOf(o.laws, sway);
  pay(world, c, r, o, decreeCost(v.against), v.against, event);
  return event;
}

/** A war declared on a realm, by a ruler's word or one put to them and carried. */
export function applyWar(
  world: World,
  c: PopulationContext,
  r: Polity,
  foe: Polity,
  prizeAsked: number | undefined,
  t: SimTime,
  w: WordBy,
): Ref {
  const o = orderHere(world, r),
    st = stationOf(c, r),
    year = yearOfMoment(t),
    diplomacy = diplomacyOf(world),
    regard = diplomacy.get(r.ref, foe.ref),
    pact = regard?.pact ?? null,
    grievance = (regard?.opinion ?? 0) < 0,
    lands = frontier(c, r, foe),
    prize = prizeAsked ?? lands[0]!,
    v = warVoices(c, r, foe, t),
    factors: Factor[] = [
      wordOf(w.by),
      ...(w.extra ?? []),
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
        { ref: w.cause, role: "agent", weight: 1 },
        { ref: decision, role: "trigger", weight: 1 },
      ],
      // (`aimed`: the battles go for the land named, while it can be reached: war.ts.)
      data: { a: realmName(r), b: realmName(foe), by: w.by, aimed: true },
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
      data: { a: realmName(r), b: realmName(foe), reason: `the word of ${w.by}` },
    });
    diplomacy.remember(r.ref, foe.ref, {
      name: "a broken pact",
      value: -0.4,
      year,
      source: broken,
    });
    regard.pact = null;
  }
  pay(world, c, r, o, warCost(pact !== null, grievance), 0, event);
  return event;
}

/** A peace made with a foe on an offer, by a ruler's word or one put to them and heard. */
export function applyPeace(
  world: World,
  c: PopulationContext,
  r: Polity,
  foe: Polity,
  offerAsked: PeaceOffer | undefined,
  t: SimTime,
  w: WordBy,
): Ref {
  const wr = warsOf(world).between(r.ref, foe.ref)!,
    attacker = wr.attacker === r.ref ? r : foe,
    defender = attacker === r ? foe : r,
    year = yearOfMoment(t),
    offer: PeaceOffer = offerAsked ?? "truce",
    made = termsOfOffer(c, wr, r, foe, offer, year),
    o = orderHere(world, r);
  // (Land that passes by the peace is land won, as a battle's is: the war came out as it says.)
  let won = attacker.members.includes(wr.prize);
  if (made.land === wr.prize) won = offer === "give-land" ? attacker === foe : attacker === r;
  wr.ended = year;
  wr.peace = world.events.emit({
    type: WAR_EVENTS.peace.type,
    subjects: [wr.ref, attacker.ref, defender.ref],
    place: placeOf(c, attacker),
    causes: [{ ref: w.cause, role: "agent", weight: 1 }],
    data: {
      a: realmName(attacker),
      b: realmName(defender),
      years: year - wr.declared,
      won,
      by: w.by,
      terms: made.terms,
    },
  });
  diplomacyOf(world).remember(attacker.ref, defender.ref, {
    name: "a war between them",
    value: -0.45,
    year,
    source: wr.event,
  });
  if (made.land !== null) {
    const from = offer === "give-land" ? r : foe,
      to = offer === "give-land" ? foe : r,
      realms = politiesOf(world);
    realms.leave(from, made.land);
    realms.join(to, made.land);
    realms.setDiscontent(made.land, { level: 0.6, cause: wr.peace });
    cutOff(c, from, wr.peace);
  }
  bindPeace(c, wr, made, wr.peace, year);
  // (What is given costs standing, what is won brings it; a truce goes by how the war stood.)
  o.legitimacy = clamp(
    0.02,
    0.98,
    o.legitimacy +
      (offer === "truce"
        ? won === (attacker === r)
          ? REIGN.peaceWon
          : REIGN.peaceLost
        : offer.startsWith("give")
          ? 2 * REIGN.peaceLost
          : 2 * REIGN.peaceWon),
  );
  return wr.peace;
}

/** Teach a peopled world what a ruler can do by the god's hand: "reign.decree", "reign.war", "reign.peace", "reign.rise", "reign.wed". */
export function installReign(world: World, ctx: () => PopulationContext): void {
  world.defineCommand({
    type: "reign.decree",
    validate: (args) => {
      const bad = rulerProblem(world, args);
      if (bad) return bad;
      const a = args as DecreeArgs;
      return decreeProblem(ctx(), standing(world, a.realm)!, a.law, a.to, world.now, !!a.channel);
    },
    apply: (command, t) => {
      const a = command.args as DecreeArgs,
        c = ctx(),
        r = standing(world, a.realm)!;
      applyDecree(world, c, r, a.law, a.to, t, {
        by: r.ruler.name,
        cause: command.id,
        extra: godWill(a.channel),
      });
      if (a.channel) channelled(world, c, r, command.id, r.ruler.name, "decree");
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
        !!a.channel,
      );
    },
    apply: (command, t) => {
      const a = command.args as WarArgs,
        c = ctx(),
        r = standing(world, a.realm)!;
      applyWar(world, c, r, standing(world, a.against)!, a.prize, t, {
        by: r.ruler.name,
        cause: command.id,
        extra: godWill(a.channel),
      });
      if (a.channel) channelled(world, c, r, command.id, r.ruler.name, "war");
    },
  });

  world.defineCommand({
    type: "reign.peace",
    validate: (args) => {
      const bad = rulerProblem(world, args);
      if (bad) return bad;
      const a = args as PeaceArgs;
      if (a.offer !== undefined && !OFFERS.includes(a.offer)) return "There is no such offer.";
      return peaceProblem(
        ctx(),
        standing(world, a.realm)!,
        standing(world, a.with),
        a.offer,
        !!a.channel,
      );
    },
    apply: (command, t) => {
      const a = command.args as PeaceArgs,
        c = ctx(),
        r = standing(world, a.realm)!;
      applyPeace(world, c, r, standing(world, a.with)!, a.offer, t, {
        by: r.ruler.name,
        cause: command.id,
      });
      if (a.channel) channelled(world, c, r, command.id, r.ruler.name, "peace");
    },
  });

  world.defineCommand({
    type: "reign.rise",
    validate: (args) => {
      const bad = rulerProblem(world, args);
      if (bad) return bad;
      const a = args as RulerArgs;
      return riseProblem(ctx(), standing(world, a.realm)!, !!a.channel);
    },
    apply: (command, t) => {
      const a = command.args as RulerArgs,
        c = ctx(),
        r = standing(world, a.realm)!,
        o = orderHere(world, r);
      riseUp(c, bondsOf(world).oathOf(r.ref)!, t, r.ruler.name, command.id);
      o.legitimacy = clamp(0.02, 0.98, o.legitimacy - warCost(true, true));
      if (a.channel) channelled(world, c, r, command.id, r.ruler.name, "rise");
    },
  });

  world.defineCommand({
    type: "reign.envoy",
    validate: (args) => {
      const bad = rulerProblem(world, args);
      if (bad) return bad;
      const a = args as Partial<EnvoyArgs>;
      return envoyProblem(
        ctx(),
        standing(world, a.realm)!,
        standing(world, a.to),
        a.errand,
        !!a.channel,
      );
    },
    apply: (command, t) => {
      const a = command.args as EnvoyArgs,
        c = ctx(),
        r = standing(world, a.realm)!,
        other = standing(world, a.to)!,
        year = yearOfMoment(t),
        diplomacy = diplomacyOf(world),
        regard = diplomacy.get(r.ref, other.ref)!;
      if (a.channel) channelled(world, c, r, command.id, r.ruler.name, "envoy");
      if (a.errand === "embassy") {
        openEmbassy(c, r, other, command.id, t);
        return;
      }
      if (a.errand === "pact") {
        const envoy = sendEnvoy(c, r, other, "pact", command.id, "yes", t);
        regard.pact = world.events.emit({
          type: DIPLOMACY_EVENTS.pact.type,
          subjects: [regard.a, regard.b],
          place: placeOf(c, r),
          causes: [
            { ref: command.id, role: "agent", weight: 1 },
            { ref: envoy.event, role: "trigger", weight: 1 },
          ],
          data: {
            a: realmName(r),
            b: realmName(other),
            reason: "an envoy they heard",
            by: r.ruler.name,
          },
        });
        return;
      }
      const grain = giftOf(c, r),
        envoy = sendEnvoy(c, r, other, "gift", command.id, "yes", t),
        markets = world.store<MarketStore>("economy.markets"),
        from = markets.get(r.seat),
        into = markets.get(other.seat);
      if (from && into) into.move("in", G.grain, from.move("out", G.grain, grain));
      diplomacy.remember(r.ref, other.ref, {
        name: "a gift they sent",
        value: TIES.giftAt,
        year,
        source: envoy.event,
      });
    },
  });

  world.defineCommand({
    type: "reign.wed",
    validate: (args) => {
      const bad = rulerProblem(world, args);
      if (bad) return bad;
      const a = args as Partial<WedArgs>;
      return wedProblem(
        ctx(),
        standing(world, a.realm)!,
        standing(world, a.to),
        a.who,
        a.partner,
        !!a.channel,
      );
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
        const o = orderHere(world, p);
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
      if (a.channel) channelled(world, c, r, command.id, r.ruler.name, "wed");
    },
  });
}
