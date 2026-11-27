// Strife (Phase 22, asked for 2026-10-23: "political violence — repression, coups, civil war",
// "legitimacy … interest groups … collapse"). M145, the army and its coups: a realm's army is one
// of its interest groups — its guard in peace, its levy in war, every man it fields where it keeps
// a standing army — heard the more under a chief, the least in an assembly, above all under a
// general; it wants its pay, and war on those its realm resents. Where a realm's rule is doubted,
// its battles lost, its army unpaid and much skimmed, a general may reach for the seat: seizing it
// (the realm becomes a protectorate, ruled by its army) or foiled (the plotters purged, the army
// cowed for a generation). A rule seized by the sword is held the less rightful for a generation;
// it ends when its standing returns, its people press for a voice, or a general dies and none is
// chosen to follow — and the realm's own rule, of its people's ways as they are now, is restored.
// M146, civil war and revolution: a realm split at a ruler's death fights for the throne, the more
// often where rule passes by birth; a foiled general may flee to the far lands and raise them; the
// god may raise a pretender; a realm whose bound rose free may be marched on by its old masters to
// take them back. A civil war won takes the throne; a rising beaten is put down and its lands
// returned; else the realm stays parted. Where a realm's rule is in crisis and its people press for
// a voice or the land, they may rise at its seat: a revolution won makes it a commonwealth, its
// court purged, one law for all (and the land to those who till it, if that was what they rose
// for) — and its old court may flee to the far lands and fight to return; a revolution lost is
// drowned in blood and remembered.
// Every step is a decision whose factors cite what drove it.
import {
  FISC,
  LABOUR_STORE,
  TREASURY_STORE,
  deficitOf,
  giniOf,
  moneyStore,
  revenueOf,
  unionOf,
} from "../money/kept.ts";
import { houseOfGroup, housesRead } from "../order/houses.ts";
import { charterAgainstCoup, charterTorn } from "../order/charter.ts";
import { risingOrganised } from "../order/groups-kept.ts";
import {
  YEAR,
  defineEventType,
  defineStream,
  parseRef,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf, pushWays, type Ways } from "../culture/culture.ts";
import { loreOf } from "../lore/lore.ts";
import {
  GENERAL,
  LEADERSHIP,
  POLITY_EVENTS,
  crown,
  cutOff,
  endRealm,
  formFromPowers,
  politiesOf,
  raiseRealm,
  reach,
  realmName,
  type Polity,
} from "../polity/polity.ts";
import { interestsOf, type Interest } from "../polity/interests.ts";
import {
  WAR,
  WAR_EVENTS,
  fieldedAtPeace,
  fieldedOf,
  strengthOf,
  warsOf,
  type CivilKind,
  type War,
} from "../war/war.ts";
import {
  BOND,
  capacityOf,
  landOf,
  orderOf,
  remember,
  type Movement,
  type RealmOrder,
} from "../order/order.ts";
import { LAW_OF } from "../order/laws.ts";
import { DOMAIN, FEW_RULE, HOLD, HOLDING, ORG, TREASURY, satOf } from "../../rules/index.ts";
import { holdOf, holdsOf, setHeld } from "../order/holds.ts";
import { wantsOf } from "../order/wants.ts";
import { financeOf } from "../finance/finance.ts";
import { grieve, strike } from "../acts/disasters.ts";
import { armyDone, armyMoves, armyVoice, ordersChanged } from "../court/court.ts";
import { commandLeft } from "../notable/notables.ts";
import { notableRef, victoriousCommander } from "../notable/kept.ts";
import { rulerHazard } from "../acts/person.ts";

export const STRIFE_EVENTS = {
  /** A general seizes the seat. */
  coup: defineEventType("strife.coup", 6),
  /** A coup foiled, its plotters purged. */
  foiled: defineEventType("strife.foiled", 5),
  /** The army's rule ends, and the realm's own is restored. */
  restored: defineEventType("strife.restored", 5),
  /** A civil war won: the claimant's host takes the realm's seat, and the throne (M146). */
  throne: defineEventType("strife.throne", 6),
  /** A rising beaten: its realm put down, its lands returned. */
  subdued: defineEventType("strife.subdued", 5),
  /** A civil war ended with neither the throne taken nor the rising put down: the realm parted. */
  parted: defineEventType("strife.parted", 4),
  /** The many overthrow the court. */
  revolution: defineEventType("strife.revolution", 7),
  /** A revolution drowned in blood. */
  repressed: defineEventType("strife.repressed", 5),
};

/** The god's hand on a realm's army: stirred against its seat; its rule given back (M145). */
export const STRIFE_ACTS = {
  incite: defineEventType("act.incite", 5),
  restore: defineEventType("act.restore", 5),
  /** A claimant raised in a land, with the lands about it, against its realm (M146). */
  pretender: defineEventType("act.pretender", 5),
};

export const STRIFE = {
  /** The share of the men it could field a realm keeps under arms in peace (a chief's band, a seat's guard), and in war without a standing army. */
  guard: 0.3,
  levy: 0.8,
  /** A coup is weighed above this; its yearly chance for each point above. */
  line: 0.38,
  chance: 0.07,
  /** An army must hold this share of its realm's sway to reach for the seat. */
  least: 0.03,
  /** Years after a coup foiled before its army dares again; after one won, while its general's own men hold every post. */
  purged: 20,
  grip: 8,
  /** How much less rightful a rule seized by the sword is held, at first; the years that fades over. */
  seized: 0.15,
  remembered: 30,
  /** The yearly chance of rule restored, at the least; at a general's death. */
  restore: 0.015,
  heirless: 0.35,
  /** How much more of its men a protectorate fields. */
  fields: 0.04,
  /** A split at a ruler's death is fought for, by how rule passes: by birth, by choice, by acclaim (M146). */
  /** A split throne is fought for by this times the claimant's share of the two hosts' strength (a half: this over two). */
  contest: 1.4,
  /** A foiled general flees to the far lands and raises them, at least this often, more with the army's weight. */
  flees: 0.25,
  /** A rising is put down, at a civil war's end, this often at the least; the more if it was beaten back, the more
   * the realm's host outweighs its own, the less the less its seat reaches its lands. */
  putDown: 0.1,
  beaten: 0.3,
  might: 0.4,
  unreached: 0.3,
  /**
   * The reach at which a seat is as safe from its army, its streets and a rising in its far lands as reach makes it. These rules
   * were set while a lettered, settled realm of few lands read as wholly reached (0.95, nine realms in ten); read off what a realm
   * is (rules/capacity.ts) such a realm stands near three quarters, and against 1 every seat was a seat that cannot reach: coups
   * were three to seven times as many (first light, by century to 600: 17/49/44/44/36/34 where 8/24/17/14/7/5).
   */
  reached: 0.75,
  /** A revolution is weighed above this line, its yearly chance for each point above; a movement this strong to begin. */
  rising: 0.3,
  revolts: 0.08,
  movement: 0.25,
  /** What ideas of a voice and of rights, and the many massed in workshops, add to a revolution's weight. */
  ideas: 0.12,
  workshops: 0.1,
  /** A revolution's rule holds this many years before its people's ways may reform it. */
  holds: 30,
} as const;

/** A coup: won (the realm a protectorate) or foiled. */
export type Coup = {
  readonly realm: Ref;
  readonly year: number;
  readonly event: Ref;
  readonly won: boolean;
  /** The realm's name before: a coup won renames it. */
  readonly was: string;
  /** Who reached for the seat. */
  readonly general: string;
};

/** A realm's rule by its army: since when, the coup, and its rule before (who led, how rule passed, what law held). */
export type Junta = {
  readonly since: number;
  readonly event: Ref;
  readonly was: readonly [number, number, number];
};

export type RealmStrife = {
  readonly realm: Ref;
  junta: Junta | null;
  /** After a coup foiled, its army is cowed until this year. */
  purged: number;
};

export type Restoration = {
  readonly realm: Ref;
  readonly year: number;
  readonly event: Ref;
  /** The years its army ruled. */
  readonly years: number;
};

/** A civil war (M146): who rose against whom, over what, and how it came out. */
export type CivilWar = {
  readonly war: Ref;
  readonly kind: CivilKind;
  readonly year: number;
  /** The realm that rose (for the freed: the freed), and the realm it rose from. */
  readonly rebel: Ref;
  readonly loyal: Ref;
  /** The throne taken; the rising put down; the realm left parted; overtaken by another's war; the freed kept free. */
  outcome: "throne" | "subdued" | "parted" | "overtaken" | "kept" | null;
  ended: number | null;
  /** The event that settled it, where one did. */
  settled: Ref | null;
};

/** A revolution: the many risen at a realm's seat, won or drowned in blood. */
export type Revolution = {
  readonly realm: Ref;
  readonly year: number;
  readonly event: Ref;
  readonly won: boolean;
  /** What they rose for. */
  readonly cause: Movement["cause"];
};

const COUP = defineStream("strife.coup");

export class StrifeStore implements StateStore {
  readonly name = "strife.realms";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  realms = new Map<string, RealmStrife>();
  coups: Coup[] = [];
  restorations: Restoration[] = [];
  civil: CivilWar[] = [];
  revolutions: Revolution[] = [];

  of(realm: Ref): RealmStrife | undefined {
    return this.realms.get(realm);
  }
  ensure(realm: Ref): RealmStrife {
    let s = this.realms.get(realm);
    if (!s) this.realms.set(realm, (s = { realm, junta: null, purged: 0 }));
    return s;
  }
  /** A realm's rule by its army, if it is so ruled. */
  junta(realm: Ref): Junta | null {
    return this.realms.get(realm)?.junta ?? null;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const s of this.realms.values()) if (s.junta) out.push(s.junta.event);
    for (const c of this.coups) out.push(c.event);
    for (const r of this.restorations) out.push(r.event);
    for (const c of this.civil) if (c.settled) out.push(c.settled);
    for (const r of this.revolutions) out.push(r.event);
    return out;
  }
  save(): unknown {
    return {
      realms: [...this.realms.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1)),
      coups: this.coups,
      restorations: this.restorations,
      civil: this.civil,
      revolutions: this.revolutions,
    };
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  load(state: unknown): void {
    const s = state as {
      realms: RealmStrife[];
      coups: Coup[];
      restorations: Restoration[];
      civil?: CivilWar[];
      revolutions?: Revolution[];
    };
    this.realms = new Map(
      s.realms.map((r) => [r.realm, { ...r, junta: r.junta ? { ...r.junta } : null }]),
    );
    this.coups = [...s.coups];
    this.restorations = [...(s.restorations ?? [])];
    this.civil = (s.civil ?? []).map((c) => ({ ...c }));
    this.revolutions = [...(s.revolutions ?? [])];
  }
  /** A realm's civil wars, as either side. */
  civilOf(realm: Ref): CivilWar[] {
    return this.civil.filter((c) => c.rebel === realm || c.loyal === realm);
  }
}

export function strifeOf(world: World): StrifeStore | null {
  return world.peek<StrifeStore>("strife.realms") ?? null;
}

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));
const trait = (w: Ways | undefined, k: number) => w?.traits[k] ?? 0.5;
/** The strongest push behind a people's way, as a factor's source. */
const nudged = (w: Ways | undefined, k: number): CauseRef | null => {
  const n = w?.nudges.find((x) => x.trait === k);
  return n ? { ref: n.event, role: "pressure", weight: 1 } : null;
};

/**
 * A realm's army: how many it keeps under arms — its guard in peace, its levy in war, all it
 * fields where it keeps a standing army — whether it keeps one, whether it is at war.
 */
export function armyOf(
  ctx: PopulationContext,
  p: Polity,
): { people: number; standing: boolean; atWar: boolean } {
  const standing = !!loreOf(ctx.world).get(p.seat, "standing-army"),
    atWar = ctx.world.hasStore("war.wars") && warsOf(ctx.world).fighting(p.ref).length > 0;
  return {
    // (Its guard at peace is a part of what a realm keeps under arms at peace at the most, not of its whole levy for a war: the
    // levy came to be reckoned as what a season's campaign can feed, twice what it was, and a chief's band with it, two in a
    // hundred of all his people under arms in a year of peace. So many held every land they took: of first light's lands taken
    // in its first 140 years, 12 threw their holder off where 53 had (rl2-h4-fl.log, rl2-base-fl.log).)
    people: Math.round(
      standing
        ? fieldedOf(ctx, p)
        : atWar
          ? fieldedOf(ctx, p) * STRIFE.levy
          : fieldedAtPeace(ctx, p) * STRIFE.guard,
    ),
    standing,
    atWar,
  };
}

/** A realm's battles won and lost these five years, its last defeat and its last victory. */
export function battlesOf(
  world: World,
  p: Polity,
  year: number,
): { won: number; lost: number; last: Ref | null; lastWon: Ref | null } {
  let won = 0,
    lost = 0,
    last: Ref | null = null,
    lastWon: Ref | null = null,
    lastYear = -Infinity,
    wonYear = -Infinity;
  for (const w of warsOf(world).hotOf(p.ref)) {
    const side = w.attacker === p.ref ? 0 : w.defender === p.ref ? 1 : -1;
    if (side < 0) continue;
    for (const b of w.battles) {
      if (b.year < year - 5) continue;
      if (b.won === (side === 0)) {
        won++;
        if (b.year >= wonYear) [lastWon, wonYear] = [b.event, b.year];
      } else {
        lost++;
        if (b.year >= lastYear) [last, lastYear] = [b.event, b.year];
      }
    }
  }
  return { won, lost, last, lastWon };
}

/** What strife reads of a realm's wealth and its seat's bread (STRAIN's terms), each 0 … 1 but `few`, which is signed. */
export type Strain = {
  /** How narrowly its wealth is held, about the middle (rules/finance.ts spread): 0.5, a few's; -0.5, widely held. */
  readonly few: number;
  /** The share of its debt held by other peoples (none owed: 0). */
  readonly abroad: number;
  /** How far short of fed its seat's leanest month fell, this year. */
  readonly lean: number;
};
/**
 * Read off the realm's money (sim/finance) and its seat's land: continuous, where hunger was once only "a famine
 * within two years". A realm with no money kept reads as the middle, owing nothing.
 */
export function strainOf(ctx: PopulationContext, p: Polity): Strain {
  const m = financeOf(ctx.world)?.of(p.ref),
    held = m ? m.held.reduce((n, [, x]) => n + x, 0) : 0,
    owed = m ? m.home + held : 0,
    seat = ctx.provinces.get(p.seat);
  return {
    few: 0.5 - (m?.own[0] ?? 50) / 100,
    abroad: owed > 0 ? held / owed : 0,
    lean: seat ? clamp(0, 1, 1 - seat.leanest / 1000) : 0,
  };
}
/**
 * How much each weighs in the two sums (a coup's, a rising's). A famine's own term was 0.25 in each; it gives the lean
 * month a part of that, so a seat that starves weighs about as it did, and one short of bread only in its leanest
 * month weighs some. Sized on first light's history, 2026-11-15, so its coups and risings a century stay about as
 * they were (its risings came of its lean centuries, which births that answer to the bread put by have ended): there,
 * seats ate all year in all but 18 of 56,000 realm-years, wealth was held by a quarter where a people pressed to rise,
 * and such a realm owed strangers a quarter of its debt on average. Weighed 0.3 and 0.1, those two would have made
 * four times the risings the old sum made of that history; 0.1 and 0.05 make two in three again as many.
 */
export const STRAIN = {
  coup: { few: 0.1, abroad: 0.1, lean: 0.3, famine: 0.15 },
  rising: { few: 0.1, abroad: 0.05, lean: 0.4, famine: 0.15 },
} as const;

/**
 * The holds the groups that rose would have (what each has learned to want, sim/order/wants.ts), weighted by their sway and
 * by `part` (how far each was of the rising; 0: no part in it). Null where none of them has any sway or any wants.
 */
export function wantsOfRisen(
  interests: readonly Interest[],
  part: (group: string) => number,
  wantOf: (group: string) => readonly number[] | null,
): [number, number, number, number] | null {
  const out: [number, number, number, number] = [0, 0, 0, 0];
  let all = 0;
  for (const i of interests) {
    const w = i.sway * part(i.group),
      wants = wantOf(i.group);
    if (!(w > 0) || !wants) continue;
    all += w;
    for (let k = 0; k < 4; k++) out[k]! += w * wants[k]!;
  }
  if (!(all > 0)) return null;
  return out.map((x) => x / all) as [number, number, number, number];
}
/** What a group of a realm has learned to want of each number; where it has not yet weighed, the realm as it is held. */
const learnedOf =
  (world: World, realm: Ref) =>
  (group: string): readonly number[] =>
    wantsOf(world)?.wantOf(realm, group) ?? holdsOf(world, realm);
/** Those who give a realm back its rule from its army: all but the army. */
const notArmy = (group: string): number => (group === "the army" ? 0 : 1);
/** Who rises with the many: those who are not the seat's few; twice over those who till and herd, where the land is what they rose for. */
const manyRose =
  (cause: Movement["cause"]) =>
  (group: string): number =>
    FEW_RULE.has(group)
      ? 0
      : cause === "land" && (group === "farmers" || group === "herders")
        ? 2
        : 1;
/** Who stands with a great house: the court, and the army half as much. */
const houseRose = (group: string): number =>
  group === "the court" ? 1 : group === "the army" ? 0.5 : 0;
/** Who stands with a general: the army, and half as much whoever else is not the court he overthrows. */
const armyRose = (group: string): number =>
  group === "the army" ? 1 : group === "the court" ? 0 : 0.5;
/** Above this, what those who rose want of a realm's choices is an assembly of all; under it, a council of their elders. */
export const ASSEMBLY_WANTED = 0.66;

/**
 * What a revolution won leaves a realm: the holds those who rose would have (the many, by their sway; those who till
 * and herd twice over where the land is what they rose for), and the rule they make of it: an assembly of all where
 * they want the realm's choices widely carried, a council of their elders where they want less of it.
 */
export function risenRule(
  ctx: PopulationContext,
  p: Polity,
  movement: Movement["cause"],
  t: SimTime,
): { readonly leadership: 1 | 2; readonly wants: readonly [number, number, number, number] } {
  const wants =
    wantsOfRisen(interestsOf(ctx, p, t), manyRose(movement), learnedOf(ctx.world, p.ref)) ??
    ([...holdsOf(ctx.world, p.ref)] as [number, number, number, number]);
  return { leadership: wants[HOLD.voice]! >= ASSEMBLY_WANTED ? 2 : 1, wants };
}

/**
 * How near a realm's army is to reaching for its seat (its score, against STRIFE.line), and
 * why: a rule doubted, the army's sway, battles lost, an army unpaid, what is skimmed, a daring
 * people, generals who rule already — against a seat that reaches its lands, an army of
 * citizens, a sacred throne, an old rule.
 */
export function coupDanger(
  ctx: PopulationContext,
  p: Polity,
  o: RealmOrder,
  interests: readonly Interest[] = interestsOf(ctx, p, ctx.world.now),
): { score: number; weight: number; doubt: number; cap: number; factors: Factor[] } {
  const { world } = ctx,
    year = yearOfMoment(world.now),
    seat = cultureOf(world).get(p.seat),
    army = interests.find((i) => i.group === "the army"),
    weight = Math.min(1, 3 * (army?.sway ?? 0)),
    doubt = clamp(0, 1, (0.62 - o.legitimacy) * 2),
    ruler = world.events.get(p.ruler.event),
    untried = year - p.ruler.since <= 2 && ruler?.type === POLITY_EVENTS.succession.type,
    fought = battlesOf(world, p, year),
    defeats = fought.lost ? fought.lost / (fought.won + fought.lost) : 0,
    famine = ctx.provinces.get(p.seat)?.lastFamine ?? null,
    hungry = famine ? world.events.get(famine) : undefined,
    // (Its army goes unpaid where its treasury cannot pay what it spends on arms: nothing by it, and short of it this year past
    // what it can let run unborrowed (rules/money.ts TREASURY.strained, as the treasury reads itself strained). A realm that keeps
    // no treasury pays its host in kind, and goes short where its seat has starved. Until 2026-11-20 every realm's army was unpaid
    // only by a famine at its seat: a realm that could not pay its host, and was fed, was never short; one that starved, always.)
    purse = moneyStore(world, TREASURY_STORE)?.get(p.ref),
    unpaid = purse
      ? purse[FISC.arms]! > 0 &&
        purse[FISC.reserve]! <= 0 &&
        deficitOf(world, p.ref) > TREASURY.strained * Math.max(1, revenueOf(world, p.ref))
      : !!hungry && world.now - hungry.t <= 2 * YEAR,
    valour = trait(seat, WAY.valour),
    cap = reachedOf(capacityOf(ctx, p).value),
    junta = strifeOf(world)?.junta(p.ref) ?? null,
    old = Math.min(1, Math.max(0, year - p.founded) / 200),
    standing = loreOf(world).get(p.seat, "standing-army"),
    held = holdsOf(world, p.ref),
    strain = strainOf(ctx, p),
    houses = housesRead(world, p.ref);
  const factors: Factor[] = [
    {
      name: "a rule doubted",
      value: o.legitimacy,
      contribution: 0.8 * doubt,
      source: o.crisis ? { ref: o.crisis, role: "pressure", weight: 1 } : null,
    },
    {
      name: "the army's sway",
      value: army?.sway ?? 0,
      contribution: 0.5 * weight,
      source: standing ? { ref: standing.event, role: "enabler", weight: 1 } : null,
    },
    {
      name: "battles lost",
      value: fought.lost,
      contribution: 0.35 * defeats,
      source: fought.last ? { ref: fought.last, role: "pressure", weight: 1 } : null,
    },
    // (The one who won them, where the world keeps who commands its host: the more for a name made in the field. sim/notable.)
    ...((led) => [
      {
        name: led ? "a victorious commander" : "a victorious general",
        value: fought.won,
        contribution:
          fought.won >= 2 && !junta
            ? 0.12 *
              Math.min(1, fought.won / 4) *
              (led ? 0.5 + satOf(led.n.by[DOMAIN.war] ?? 0) : 1)
            : 0,
        source:
          (led?.last ?? fought.lastWon)
            ? { ref: (led?.last ?? fought.lastWon)!, role: "pressure" as const, weight: 1 }
            : null,
      },
    ])(victoriousCommander(world, p.ref, year)),
    {
      name: "an army unpaid",
      value: unpaid ? 1 : 0,
      contribution: unpaid ? STRAIN.coup.famine : 0,
      source: unpaid && !purse && famine ? { ref: famine, role: "pressure", weight: 1 } : null,
    },
    // (Read off its money and its seat's bread, continuously: an army eats what its seat eats; wealth in few hands
    // buys a general; a seat that pays strangers first pays its host last.)
    {
      name: "a lean month at the seat",
      value: strain.lean,
      contribution: STRAIN.coup.lean * strain.lean,
      source: null,
    },
    {
      name: "wealth in few hands",
      value: 0.5 - strain.few,
      contribution: STRAIN.coup.few * strain.few,
      source: null,
    },
    {
      name: "its debt held by strangers",
      value: strain.abroad,
      contribution: STRAIN.coup.abroad * strain.abroad,
      source: null,
    },
    {
      name: "what is skimmed",
      value: o.corruption,
      contribution: 0.3 * o.corruption,
      source: null,
    },
    {
      name: "a people who prize valour",
      value: valour,
      contribution: 0.3 * (valour - 0.5),
      source: nudged(seat, WAY.valour),
    },
    {
      name: "a new ruler, untried",
      value: untried ? 1 : 0,
      contribution: untried ? 0.08 : 0,
      source: untried ? { ref: p.ruler.event, role: "pressure", weight: 1 } : null,
    },
    {
      name: "generals who rule already",
      value: junta ? 1 : 0,
      contribution: junta ? 0.1 : 0,
      source: junta ? { ref: junta.event, role: "enabler", weight: 1 } : null,
    },
    {
      name: "a seat that reaches its lands",
      value: cap,
      contribution: -0.25 * cap,
      source: null,
    },
    {
      name: "an army of citizens, a sacred throne",
      value: p.leadership,
      contribution: p.leadership === 2 ? -0.2 : p.leadership === 3 ? -0.15 : 0,
      source: null,
    },
    {
      name: "an old rule",
      value: old,
      contribution: -0.1 * old,
      source: { ref: p.event, role: "constraint", weight: 1 },
    },
    // (How it is held, rules/holds.ts: a choice the many must carry is not taken by a few; arms kept to the host are the army's.)
    {
      name: "a choice the many must carry",
      value: held[HOLD.voice]!,
      contribution: -0.3 * (held[HOLD.voice]! - HOLDING.voiceMid),
      source: o.heldEvents?.[HOLD.voice]
        ? { ref: o.heldEvents[HOLD.voice]!, role: "constraint", weight: 1 }
        : null,
    },
    // (Round H, sim/order/houses.ts: a great house that outweighs the ruler's own, that a general can ride to the seat.)
    {
      name: "a great house that outweighs the crown",
      value: houses?.rival ?? 0,
      contribution: 0.25 * (houses?.rival ?? 0),
      source: null,
    },
    {
      name: "arms kept to the host",
      value: held[HOLD.force]!,
      contribution: 0.1 * (held[HOLD.force]! - 0.5),
      source: o.heldEvents?.[HOLD.force]
        ? { ref: o.heldEvents[HOLD.force]!, role: "enabler", weight: 1 }
        : null,
    },
    // (A lodge sworn against the seat, sim/order/groups.ts: told only where one is kept, so a realm without is as it was.)
    ...plotters(world, p.ref),
    // (A charter its people wrote: sim/order/charter.ts. Told only where one is.)
    ...charterAgainstCoup(world, p.ref),
  ];
  return {
    score: factors.reduce((s, f) => s + f.contribution, 0),
    weight,
    doubt,
    cap,
    factors,
  };
}

/** A ruler for a realm at a moment, drawn apart from its successions (a coup, a restoration). */
function newRuler(ctx: PopulationContext, p: Polity, t: SimTime, event: Ref, salt: number) {
  const { world } = ctx,
    ways = cultureOf(world).get(p.seat)!;
  return crown(world, ways, p.seat + salt * 1_000_003, t, event, null, ctx.life.adulthood);
}

/**
 * Who reaches for a realm's seat: its commander, where the world keeps one who has won of late (their victories their own:
 * sim/notable), else the one who holds the army's voice at court.
 */
function generalOf(
  world: World,
  p: Polity,
  year: number,
): {
  name: string;
  sex: number;
  born: number;
  fig?: number;
  cmd?: number;
  last?: Ref | null;
} | null {
  const led = victoriousCommander(world, p.ref, year);
  if (led)
    return { name: led.n.name, sex: led.n.sex, born: led.n.born, cmd: led.n.id, last: led.last };
  return armyVoice(world, p);
}

/**
 * What a coup won leaves a realm, by who carried it and who holds force after (the breadth round): where a great house that
 * outweighs the crown carried it more than the army's own weight did (the court's sway by the house's), its head takes the
 * throne and the realm is ruled as the court would have it ("palace"); where the arms are kept to the host (force at
 * HOLDING.forceMid or more), the army rules as an army ("junta": a protectorate, until its rule is restored); else the general
 * takes the throne and rules through the realm's own forms, read off the wants of those who stood with them ("crowned"), for
 * the arms lie in too many hands for an army to hold the seat alone.
 */
export type CoupKind = "palace" | "junta" | "crowned";
export function coupKindOf(
  interests: readonly Interest[],
  force: number,
  rival: number,
  commander: boolean,
): CoupKind {
  const sway = (g: string) => interests.find((i) => i.group === g)?.sway ?? 0,
    army = sway("the army") * (0.5 + force) + (commander ? 0.1 : 0),
    court = 2 * sway("the court") * rival;
  return court > army ? "palace" : force >= HOLDING.forceMid ? "junta" : "crowned";
}

/**
 * A coup seizes a realm's seat (coupKindOf says what follows): under its army, a protectorate (rule chosen by the army, its law
 * as it was); the old court's skimmers are purged. Returns the coup.
 */
export function seize(ctx: PopulationContext, p: Polity, causes: CauseRef[], t: SimTime): Ref {
  const { world } = ctx,
    store = strifeOf(world)!,
    s = store.ensure(p.ref),
    o = orderOf(world)?.of(p.ref),
    year = yearOfMoment(t),
    was = realmName(p),
    interests = interestsOf(ctx, p, t),
    held = holdsOf(world, p.ref),
    // (Named before the event that crowns them, so the event can say who: a commander whose victories are their own, or the one
    // who holds the army's voice at court, if any does.)
    man = generalOf(world, p, year),
    // (A coup among generals keeps the army's rule: the first of them made it a junta.)
    kind: CoupKind = s.junta
      ? "junta"
      : coupKindOf(interests, held[HOLD.force]!, housesRead(world, p.ref)?.rival ?? 0, !!man?.cmd),
    house = kind === "palace" ? houseOfGroup(world, p.ref, "the court") : null,
    // (Who stood with it, by their sway: the court, and the army half as much, for a house; the army, and half as much whoever
    // else is not the court it overthrew, for a general. What they want of the realm's numbers is what it is held to after.)
    wants =
      wantsOfRisen(interests, kind === "palace" ? houseRose : armyRose, learnedOf(world, p.ref)) ??
      ([...held] as [number, number, number, number]),
    sway: Record<string, number> = {};
  for (const i of interests) sway[i.group] = i.sway;
  const form =
      kind === "junta"
        ? null
        : formFromPowers(
            [wants[HOLD.force]!, Math.min(held[HOLD.voice]!, wants[HOLD.voice]!)],
            sway,
            p,
            loreOf(world).effect(p.seat, "writing") > 0,
          ),
    seated =
      kind === "palace"
        ? crown(
            world,
            cultureOf(world).get(p.seat)!,
            p.seat + 7 * 1_000_003,
            t,
            p.event,
            house,
            ctx.life.adulthood,
          )
        : null,
    general = seated?.name ?? man?.name ?? newRuler(ctx, p, t, p.event, 1).name,
    to = form ? realmName({ leadership: form.leadership, town: p.town }) : null,
    event = world.events.emit({
      type: STRIFE_EVENTS.coup.type,
      subjects: man?.cmd && kind !== "palace" ? [p.ref, notableRef(man.cmd)] : [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: man?.last
        ? [...causes.slice(0, 5), { ref: man.last, role: "enabler", weight: 0.5 }]
        : causes,
      data: {
        realm: was,
        general,
        from: LEADERSHIP[p.leadership],
        ...(kind !== "junta" ? { how: kind, to } : {}),
        ...(house ? { house } : {}),
        ...(man?.fig !== undefined && kind !== "palace" ? { fig: man.fig } : {}),
        ...(man?.cmd && kind !== "palace" ? { cmd: man.cmd } : {}),
      },
    });
  s.purged = year + STRIFE.grip;
  if (kind === "junta") {
    // (The new general's own men hold every post for a while.)
    s.junta ??= { since: year, event, was: [p.leadership, p.succession, p.law] };
    p.leadership = GENERAL;
    p.succession = 1;
  } else {
    p.leadership = form!.leadership;
    p.succession = form!.succession;
    p.law = form!.law;
  }
  ordersChanged(world, p);
  p.ruler = seated
    ? { ...seated, event }
    : man
      ? { name: man.name, sex: man.sex, born: man.born, since: year, event }
      : { ...newRuler(ctx, p, t, event, 1), event };
  if (o) {
    o.corruption *= 0.6;
    o.crisis = null;
    // (Its choices, its arms and its word as those who stood with it would have them, by their sway. So a general raised with
    // traders at his back leaves word freer than one the temple stood behind. Never more of a voice than a seat taken by force
    // can give; under an army, never fewer arms kept to the host: rules/holds.ts.)
    setHeld(o, "voice", Math.min(0.3, wants[HOLD.voice]!), "most", event);
    if (kind === "junta") setHeld(o, "force", Math.max(0.6, wants[HOLD.force]!), "least", event);
    setHeld(o, "word", Math.min(0.5, wants[HOLD.word]!), "most", event);
  }
  store.coups.push({ realm: p.ref, year, event, won: true, was, general });
  // (An army or a general made master tears what its people wrote: a house that takes the throne rules under it.)
  if (kind !== "palace") charterTorn(ctx, p, event);
  armyDone(world, p, event, kind !== "palace");
  return event;
}

/** A coup foiled: the plotters purged, the army cowed; the court stands the firmer for a while. */
export function foil(
  ctx: PopulationContext,
  p: Polity,
  causes: CauseRef[],
  t: SimTime,
  weight = 0,
): Ref {
  const { world } = ctx,
    store = strifeOf(world)!,
    o = orderOf(world)?.of(p.ref),
    year = yearOfMoment(t),
    man = generalOf(world, p, year),
    general = man?.name ?? newRuler(ctx, p, t, p.event, 3).name,
    event = world.events.emit({
      type: STRIFE_EVENTS.foiled.type,
      subjects: man?.cmd ? [p.ref, notableRef(man.cmd)] : [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes,
      data: {
        realm: realmName(p),
        general,
        ...(man?.fig !== undefined ? { fig: man.fig } : {}),
        ...(man?.cmd ? { cmd: man.cmd } : {}),
      },
    });
  store.ensure(p.ref).purged = year + STRIFE.purged;
  if (o) o.legitimacy = clamp(0.02, 0.98, o.legitimacy + 0.03);
  store.coups.push({ realm: p.ref, year, event, won: false, was: realmName(p), general });
  armyDone(world, p, event, false);
  // (The foiled general may flee to the far lands, raise them and march on the seat: M146.)
  if (world.rng.real(COUP, parseRef(p.ref).b >>> 0, t, 5) < STRIFE.flees + 0.5 * weight) {
    // (The one who fled is the one who rules what he raised: his own sex and birth, not ones drawn anew, and the host he
    // left is no longer his. First light, year 1,000: Raisair Gritaien, born 956, still commanded the host of Drywyndis and
    // ruled Brythis as one born 962.)
    const raised = breakAway(ctx, p, farLands(ctx, p), event, "general", t, general);
    if (raised && man) raised.ruler = { ...raised.ruler, sex: man.sex, born: man.born };
    if (raised) commandLeft(world, p.ref, general);
  }
  return event;
}

/**
 * Where a revolt is raised: a realm's farthest land and the lands about it, two steps or more from
 * its seat (or cut off from it), out to a third of the realm — never its seat.
 */
export function farLands(ctx: PopulationContext, p: Polity): number[] {
  if (p.members.length < 3) return [];
  const steps = reach(ctx, p),
    far = Math.max(0, ...p.members.map((c) => steps.get(c) ?? 99));
  if (far < 2) return [];
  const g = ctx.generated,
    mine = new Set(p.members),
    away = (c: number) => c !== p.seat && (steps.get(c) ?? 99) >= 2,
    start = p.members.find((c) => (steps.get(c) ?? 99) === far)!,
    most = Math.max(1, Math.floor(p.members.length / 3)),
    out = [start],
    seen = new Set(out);
  for (let i = 0; i < out.length && out.length < most; i++)
    for (
      let k = g.grid.offsets[out[i]!]!;
      k < g.grid.offsets[out[i]! + 1]! && out.length < most;
      k++
    ) {
      const n = g.grid.neighbours[k]!;
      if (mine.has(n) && !seen.has(n) && away(n)) {
        seen.add(n);
        out.push(n);
      }
    }
  return out.sort((a, b) => a - b);
}

/**
 * The town to raise a realm at among lands: their greatest market town; none where no market town stands among them. (It
 * was "a market town first, then the most peopled": a general who broke away with lands of hamlets seated a realm in a
 * village of 71 with no market, which stood for a century and a half beside realms of millions. Every other way a realm
 * is raised asks a market town to seat it: polity.form, a split at a ruler's death, a land freed.)
 */
function townAmong(ctx: PopulationContext, lands: readonly number[]) {
  return lands
    .flatMap((c) => ctx.settlements.inProvince(c))
    .filter((x) => x.market)
    .sort((x, y) => y.population - x.population || (x.ref < y.ref ? -1 : 1))[0];
}

/**
 * Lands break from a realm under a rival — a general, a pretender, an old court — raising their
 * own realm at their best town, which marches on the realm's seat: a civil war of `kind`. The
 * general's (and an old court's of a general) is ruled by its army. Null where none can be raised.
 */
export function breakAway(
  ctx: PopulationContext,
  p: Polity,
  lands: readonly number[],
  cause: Ref,
  kind: CivilKind,
  t: SimTime,
  leader: string | null = null,
): Polity | null {
  const { world } = ctx,
    realms = politiesOf(world),
    mine = lands.filter((c) => c !== p.seat && realms.of(c)?.ref === p.ref),
    town = townAmong(ctx, mine);
  if (!mine.length || !town) return null;
  for (const c of mine) realms.leave(p, c);
  const raised = raiseRealm(ctx, town, mine, cause, t, p.ref);
  cutOff(ctx, p, cause);
  if (!raised) return null;
  if (kind === "general") {
    strifeOf(world)!.ensure(raised.ref).junta = {
      since: yearOfMoment(t),
      event: cause,
      was: [raised.leadership, raised.succession, raised.law],
    };
    raised.leadership = GENERAL;
    raised.succession = 1;
  }
  if (leader) raised.ruler = { ...raised.ruler, name: leader };
  civilWar(ctx, raised, p, kind, [{ ref: cause, role: "trigger", weight: 1 }], t);
  return raised;
}

/**
 * A civil war declared: the realm that rose marches on the seat of the realm it rose from (for the
 * freed, their old masters march on theirs). Its prize is that seat; its why, `causes`.
 */
export function civilWar(
  ctx: PopulationContext,
  rebel: Polity,
  loyal: Polity,
  kind: CivilKind,
  causes: CauseRef[],
  t: SimTime,
): Ref {
  const { world } = ctx,
    year = yearOfMoment(t),
    ref = world.minter.mint(WAR),
    [a, b] = kind === "freed" ? [loyal, rebel] : [rebel, loyal],
    event = world.events.emit({
      type: WAR_EVENTS.declared.type,
      subjects: [ref, a.ref, b.ref],
      place: cellRef(0, b.seat),
      causes,
      data: { a: realmName(a), b: realmName(b), civil: kind },
    });
  warsOf(world).add({
    ref,
    attacker: a.ref,
    defender: b.ref,
    declared: year,
    event,
    prize: b.seat,
    battles: [],
    fallen: [0, 0],
    ended: null,
    peace: null,
    civil: kind,
  });
  strifeOf(world)!.civil.push({
    war: ref,
    kind,
    year,
    rebel: rebel.ref,
    loyal: loyal.ref,
    outcome: null,
    ended: null,
    settled: null,
  });
  return event;
}

/**
 * A civil war's end (called as its peace is made): the throne taken where the claimant's host took
 * the seat; a rising put down where it was beaten, or its host is far the weaker — its lands
 * returned, aggrieved; else the realm stays parted. The freed, marched on by their old masters:
 * taken back and bound again, or kept free.
 */
export function settleCivil(
  ctx: PopulationContext,
  w: War,
  won: boolean,
  repulsed: boolean,
  t: SimTime,
): void {
  const { world } = ctx,
    store = strifeOf(world),
    c = store?.civil.find((x) => x.war === w.ref);
  if (!store || !c || c.ended !== null) return;
  const realms = politiesOf(world),
    rebel = realms.get(c.rebel)!,
    loyal = realms.get(c.loyal)!,
    attacker = realms.get(w.attacker)!,
    defender = realms.get(w.defender)!,
    year = yearOfMoment(t),
    why: CauseRef[] = [{ ref: w.peace ?? w.event, role: "trigger", weight: 1 }];
  c.ended = year;
  if (won && defender.ended !== null) {
    c.outcome = "throne";
    c.settled = world.events.emit({
      type: STRIFE_EVENTS.throne.type,
      subjects: [attacker.ref, defender.ref],
      place: ctx.provinces.get(w.prize)?.ref ?? null,
      causes: why,
      data: {
        a: realmName(attacker),
        b: realmName(defender),
        ruler: attacker.ruler.name,
        kind: c.kind,
      },
    });
    // The freed taken back are bound again, where their old masters' law still binds.
    const order = orderOf(world);
    if (c.kind === "freed" && order && order.of(attacker.ref)?.abolished === null)
      for (const cell of attacker.members)
        if (realms.formerly(cell) === defender.ref) {
          const l = landOf(order, cell);
          l.shares[BOND.chattel] = Math.max(l.shares[BOND.chattel]!, 0.15);
          l.cause = c.settled;
        }
    return;
  }
  if (c.kind === "freed") {
    c.outcome = rebel.ended === null ? "kept" : "overtaken";
    return;
  }
  if (rebel.ended !== null || loyal.ended !== null) {
    c.outcome = "overtaken";
    return;
  }
  // Put down, or parted: a rising beaten back, the realm's host against the rising's, and how far
  // its seat reaches — a realm that could not hold its far lands seldom wins them back.
  const mine = strengthOf(ctx, loyal),
    theirs = strengthOf(ctx, rebel),
    might = 2 * Math.max(0, mine / Math.max(1, mine + theirs) - 0.5),
    cap = reachedOf(capacityOf(ctx, loyal).value),
    factors: Factor[] = [
      {
        name: "a rising beaten back",
        value: repulsed ? 1 : 0,
        contribution: repulsed ? STRIFE.beaten : 0,
        source: repulsed ? { ref: w.peace ?? w.event, role: "trigger", weight: 1 } : null,
      },
      {
        name: "the realm's host against the rising's",
        value: mine / Math.max(1, theirs),
        contribution: STRIFE.might * might,
        source: null,
      },
      {
        name: "a seat that cannot reach its far lands",
        value: cap,
        contribution: -STRIFE.unreached * (1 - cap),
        source: null,
      },
    ],
    chance = clamp(0.05, 0.9, STRIFE.putDown + factors.reduce((sum, f) => sum + f.contribution, 0)),
    down = world.rng.real(COUP, parseRef(rebel.ref).b >>> 0, t, 14) < chance,
    decision = world.decisions.record({
      rule: "strife.subdue",
      subject: loyal.ref,
      outcome: { subdued: down, rebel: rebel.ref },
      score: chance,
      threshold: 0,
      factors,
    }),
    causes: CauseRef[] = [...why, { ref: decision, role: "trigger", weight: 1 }];
  if (!down) {
    c.outcome = "parted";
    c.settled = world.events.emit({
      type: STRIFE_EVENTS.parted.type,
      subjects: [rebel.ref, loyal.ref],
      place: ctx.provinces.get(rebel.seat)?.ref ?? null,
      causes,
      data: { a: realmName(rebel), b: realmName(loyal), lands: rebel.members.length, kind: c.kind },
    });
    return;
  }
  const subdued = world.events.emit({
    type: STRIFE_EVENTS.subdued.type,
    subjects: [loyal.ref, rebel.ref],
    place: ctx.provinces.get(rebel.seat)?.ref ?? null,
    causes,
    data: { a: realmName(rebel), b: realmName(loyal), lands: rebel.members.length, kind: c.kind },
  });
  for (const cell of [...rebel.members]) {
    realms.leave(rebel, cell);
    realms.join(loyal, cell);
    realms.setDiscontent(cell, { level: 0.5, cause: subdued });
  }
  endRealm(ctx, rebel, t, { ref: subdued, role: "trigger", weight: 1 });
  cutOff(ctx, loyal, subdued);
  c.outcome = "subdued";
  c.settled = subdued;
}

/** Whether a realm's revolution is young enough that its rule holds against its people's ways. */
export function revolutionHolds(world: World, realm: Ref, year: number): boolean {
  return !!strifeOf(world)?.revolutions.some(
    (r) => r.realm === realm && r.won && year - r.year < STRIFE.holds,
  );
}

/** What a realm's revolutionary groups add to the danger of a rising (none where none is kept). */
function risers(world: World, realm: Ref): Factor[] {
  const k = risingOrganised(world, realm).rising;
  return k > 0
    ? [{ name: "a rising organised", value: k, contribution: ORG.rising * k, source: null }]
    : [];
}
/** What a realm's lodges add to the danger of a coup (none where none is kept). */
function plotters(world: World, realm: Ref): Factor[] {
  const k = risingOrganised(world, realm).plot;
  return k > 0
    ? [
        {
          name: "a lodge sworn against the seat",
          value: k,
          contribution: ORG.plot * k,
          source: null,
        },
      ]
    : [];
}

/**
 * How near a realm's people are to rising at its seat (its score, against STRIFE.rising), and
 * why: a rule doubted, a movement for a voice or the land, hunger at the seat, a seat that cannot
 * reach its lands — against an army loyal to the court, and rank set hard.
 */
export function revolutionDanger(
  ctx: PopulationContext,
  p: Polity,
  o: RealmOrder,
  interests: readonly Interest[] = interestsOf(ctx, p, ctx.world.now),
): { score: number; movement: Movement | null; weight: number; doubt: number; factors: Factor[] } {
  const { world } = ctx,
    movement =
      [...o.movements]
        .filter((m) => m.cause === "voice" || m.cause === "land")
        .sort((a, b) => b.strength - a.strength || (a.cause < b.cause ? -1 : 1))[0] ?? null,
    army = interests.find((i) => i.group === "the army"),
    weight = Math.min(1, 3 * (army?.sway ?? 0)),
    doubt = clamp(0, 1, (0.62 - o.legitimacy) * 2),
    famine = ctx.provinces.get(p.seat)?.lastFamine ?? null,
    hungry = famine ? world.events.get(famine) : undefined,
    starving = !!hungry && world.now - hungry.t <= 2 * YEAR,
    cap = reachedOf(capacityOf(ctx, p).value),
    lore = loreOf(world),
    thought = lore.get(p.seat, "philosophy"),
    works = lore.get(p.seat, "factories"),
    held = holdsOf(world, p.ref),
    strain = strainOf(ctx, p),
    organisedAtSeat =
      works && moneyStore(world, LABOUR_STORE)?.get(p.seat) ? unionOf(world, p.seat).union : null,
    gini = giniOf(world, p.seat),
    following = housesRead(world, p.ref)?.following ?? 0;
  const factors: Factor[] = [
    {
      name: "a rule doubted",
      value: o.legitimacy,
      contribution: 0.9 * doubt,
      source: o.crisis ? { ref: o.crisis, role: "pressure", weight: 1 } : null,
    },
    {
      name: movement?.cause === "land" ? "a people who want the land" : "a people who want a voice",
      value: movement?.strength ?? 0,
      contribution: 0.8 * (movement?.strength ?? 0),
      source: movement ? { ref: movement.event, role: "pressure", weight: 1 } : null,
    },
    {
      name: "hunger at the seat",
      value: starving ? 1 : 0,
      contribution: starving ? STRAIN.rising.famine : 0,
      source: starving ? { ref: famine!, role: "pressure", weight: 1 } : null,
    },
    // (Read off its money and its seat's bread, continuously: the leanest month of the year, however short of a
    // famine; how narrowly its wealth is held; how much of what it owes it owes to strangers.)
    {
      name: "a lean month at the seat",
      value: strain.lean,
      contribution: STRAIN.rising.lean * strain.lean,
      source: null,
    },
    {
      name: "wealth in few hands",
      value: 0.5 - strain.few,
      contribution: STRAIN.rising.few * strain.few,
      source: null,
    },
    {
      name: "its debt held by strangers",
      value: strain.abroad,
      contribution: STRAIN.rising.abroad * strain.abroad,
      source: null,
    },
    {
      name: "a seat that cannot reach its lands",
      value: cap,
      contribution: 0.2 * (1 - cap),
      source: null,
    },
    {
      name: "an army loyal to the seat",
      value: army?.sway ?? 0,
      contribution: -(p.leadership === GENERAL ? 0.6 : 0.5) * weight,
      source: null,
    },
    { name: "rank set hard", value: o.caste, contribution: -0.15 * o.caste, source: null },
    {
      name: "ideas of a voice and of rights",
      value: thought ? 1 : 0,
      contribution: thought ? STRIFE.ideas : 0,
      source: thought ? { ref: thought.event, role: "enabler", weight: 1 } : null,
    },
    // (The many massed in workshops count as far as they have bound themselves to act together, where it is weighed: Round B.)
    {
      name: "the many massed in workshops",
      value: organisedAtSeat ?? (works ? 1 : 0),
      contribution:
        organisedAtSeat !== null
          ? STRIFE.workshops * Math.min(1, 2 * organisedAtSeat)
          : works
            ? STRIFE.workshops
            : 0,
      source: works ? { ref: works.event, role: "enabler", weight: 1 } : null,
    },
    // (Wealth held by few: its lands' Gini above what a people of farmers alike would show, Round B rules/labour.ts lorenz.)
    {
      name: "wealth held by few",
      value: gini ?? 0,
      contribution: gini !== null ? 0.5 * Math.max(0, gini - 0.35) : 0,
      source: null,
    },
    // (How it is held, rules/holds.ts: a voice already given; arms in the people's hands; grievances kept unspoken, that burst
    // where the rule is doubted.)
    {
      name: "a voice already given",
      value: held[HOLD.voice]!,
      contribution: -0.35 * (held[HOLD.voice]! - HOLDING.voiceMid),
      source: o.heldEvents?.[HOLD.voice]
        ? { ref: o.heldEvents[HOLD.voice]!, role: "constraint", weight: 1 }
        : null,
    },
    {
      name: "arms in the people's hands",
      value: 1 - held[HOLD.force]!,
      contribution: 0.15 * (HOLDING.forceMid - held[HOLD.force]!),
      source: o.heldEvents?.[HOLD.force]
        ? { ref: o.heldEvents[HOLD.force]!, role: "enabler", weight: 1 }
        : null,
    },
    // (Round H, sim/order/houses.ts: one risen on the people's grievance, carried as far as word carries.)
    {
      name: "a demagogue's following",
      value: following,
      contribution: 0.5 * following,
      source: null,
    },
    {
      name: "grievances kept unspoken",
      value: 1 - held[HOLD.word]!,
      contribution: 0.6 * (0.5 - held[HOLD.word]!) * (doubt - 0.3),
      source: o.heldEvents?.[HOLD.word]
        ? { ref: o.heldEvents[HOLD.word]!, role: "pressure", weight: 1 }
        : null,
    },
    // (Those organised to rise, sim/order/groups.ts: told only where they are kept, so a realm without is as it was.)
    ...risers(world, p.ref),
  ];
  return {
    score: factors.reduce((s, f) => s + f.contribution, 0),
    movement,
    weight,
    doubt,
    factors,
  };
}

/**
 * The many overthrow the court: the realm a commonwealth, its rule by acclaim, one law for all (and
 * the land to those who till it, where that is what they rose for); its rank broken, its skimmers
 * gone, its standing renewed. Its old court may flee to the far lands and fight to return.
 */
export function revolt(
  ctx: PopulationContext,
  p: Polity,
  movement: Movement["cause"],
  causes: CauseRef[],
  t: SimTime,
  court = 0,
): Ref {
  const { world } = ctx,
    store = strifeOf(world)!,
    o = orderOf(world)?.of(p.ref),
    year = yearOfMoment(t),
    was = realmName(p),
    before = p.leadership,
    // (What those who rose would have, and the rule they make of it: risenRule, rules/holds.ts HOLD_WANTS.)
    { leadership: to, wants } = risenRule(ctx, p, movement, t),
    event = world.events.emit({
      type: STRIFE_EVENTS.revolution.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes,
      data: { realm: was, cause: movement, to: realmName({ leadership: to, town: p.town }) },
    });
  p.leadership = to;
  p.succession = 2;
  ordersChanged(world, p);
  p.ruler = { ...newRuler(ctx, p, t, event, 4), event };
  const s = store.ensure(p.ref);
  s.junta = null;
  if (o) {
    o.caste = clamp(0, 1, o.caste - 0.3);
    o.corruption *= 0.3;
    o.legitimacy = Math.max(o.legitimacy, 0.55);
    o.crisis = null;
    o.laws[LAW_OF.justice] = 2;
    o.lawEvents[LAW_OF.justice] = event;
    if (movement === "land") {
      o.laws[LAW_OF.land] = 2;
      o.lawEvents[LAW_OF.land] = event;
    }
    for (const m of o.movements) if (m.cause === movement) m.strength *= 0.4;
    // (Its choices and its word as those who rose would have them, never less than they were; arms no more kept
    // to the host than they would keep them: rules/holds.ts.)
    setHeld(o, "voice", wants[HOLD.voice]!, "least", event);
    setHeld(o, "word", wants[HOLD.word]!, "least", event);
    setHeld(o, "force", wants[HOLD.force]!, "most", event);
  }
  const ways = cultureOf(world).get(p.seat);
  if (ways) {
    pushWays(ways, { event, year, trait: WAY.hierarchy, amount: -0.1 });
    pushWays(ways, { event, year, trait: WAY.openness, amount: 0.04 });
  }
  store.revolutions.push({ realm: p.ref, year, event, won: true, cause: movement });
  // (Its old court flees to the far lands, under the rule it had, and fights to return.)
  if (world.rng.real(COUP, parseRef(p.ref).b >>> 0, t, 7) < clamp(0, 0.6, 2 * court)) {
    const rump = breakAway(ctx, p, farLands(ctx, p), event, "revolution", t);
    if (rump && before !== to) rump.leadership = before;
  }
  return event;
}

/** A revolution drowned in blood: its people struck down at the seat, its movement broken, its rank the harder, remembered. */
export function repress(
  ctx: PopulationContext,
  p: Polity,
  movement: Movement["cause"],
  causes: CauseRef[],
  t: SimTime,
): Ref {
  const { world } = ctx,
    o = orderOf(world)?.of(p.ref),
    year = yearOfMoment(t),
    // (A people with arms in its hands is put down the harder: rules/holds.ts force.)
    dead = strike(ctx, p.seat, 0.02 * (1.5 - holdOf(world, p.ref, HOLD.force)), t),
    event = world.events.emit({
      type: STRIFE_EVENTS.repressed.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes,
      data: { realm: realmName(p), cause: movement, dead },
    });
  if (o) {
    remember(o, { what: "massacre", year, cell: p.seat, event });
    o.caste = clamp(0, 1, o.caste + 0.05);
    for (const m of o.movements) if (m.cause === movement) m.strength *= 0.4;
  }
  grieve(world, p.seat, 0.3, event);
  strifeOf(world)!.revolutions.push({ realm: p.ref, year, event, won: false, cause: movement });
  return event;
}

/** A realm's reach as these rules weigh it: whole at STRIFE.reached. */
const reachedOf = (reach: number): number => Math.min(1, reach / STRIFE.reached);

/** The odds a coup tried is won: the army's weight and a rule doubted, against a seat that reaches its lands. */
function coupOdds(danger: { weight: number; doubt: number; cap: number }): number {
  return clamp(0.2, 0.85, 0.3 + 0.5 * danger.weight + 0.3 * danger.doubt - 0.2 * danger.cap);
}

/** The army's rule ends: the realm's own rule, of its people's ways as they are now, restored. */
export function restore(
  ctx: PopulationContext,
  p: Polity,
  causes: CauseRef[],
  t: SimTime,
): Ref | null {
  const { world } = ctx,
    store = strifeOf(world),
    s = store?.of(p.ref),
    ways = cultureOf(world).get(p.seat);
  if (!store || !s?.junta || !ways) return null;
  // (The rule given back is read off what those who are not the army want of its numbers, by their sway: the many, the court,
  // the temple; and whose sway is greatest without the army's. The rule it had before the army is what is eased toward.)
  const interests = interestsOf(ctx, p, t),
    wants =
      wantsOfRisen(interests, notArmy, learnedOf(world, p.ref)) ??
      ([...holdsOf(world, p.ref)] as [number, number, number, number]),
    sway: Record<string, number> = {};
  for (const i of interests) if (i.group !== "the army") sway[i.group] = i.sway;
  const [l0, s0, w0] = s.junta.was,
    year = yearOfMoment(t),
    inst = formFromPowers(
      [wants[HOLD.force]!, wants[HOLD.voice]!],
      sway,
      { leadership: l0 ?? 0, succession: s0 ?? 0, law: w0 ?? 0 },
      loreOf(world).effect(p.seat, "writing") > 0,
    ),
    was = realmName(p),
    event = world.events.emit({
      type: STRIFE_EVENTS.restored.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes,
      data: {
        realm: was,
        to: realmName({ ...inst, town: p.town }),
        years: year - s.junta.since,
      },
    });
  store.restorations.push({ realm: p.ref, year, event, years: year - s.junta.since });
  p.leadership = inst.leadership;
  p.succession = inst.succession;
  ordersChanged(world, p);
  p.law = inst.law;
  p.ruler = { ...newRuler(ctx, p, t, event, 2), event };
  s.junta = null;
  // (Its people's say given back as far as those who restored it want it.)
  const o = orderOf(world)?.of(p.ref);
  if (o) setHeld(o, "voice", wants[HOLD.voice]!, "least", event);
  return event;
}

/** The year of strife: rule restored where the army's rule ends; coups weighed, and tried. */
export function strifeYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = strifeOf(world),
    order = orderOf(world);
  if (!store || !order) return;
  const realms = politiesOf(world),
    year = yearOfMoment(t);

  // 0. Realms raised this year from another (M146): a split at a ruler's death fought for —
  // the more often where rule passes by birth; the freed marched on by their old masters, where
  // they still hold the bound and are the stronger.
  for (const q of realms.living()) {
    if (!q.from || q.founded !== year || store.civil.some((c) => c.rebel === q.ref)) continue;
    const old = realms.get(q.from),
      formed = world.events.get(q.event),
      why = formed?.causes[0] ? world.events.get(formed.causes[0].ref) : undefined;
    if (!old || old.ended !== null || !why) continue;
    const key = parseRef(q.ref).b >>> 0;
    if (why.type === POLITY_EVENTS.split.type) {
      // (A split throne is fought for as far as the claimant's host can hope to take it: its strength against the realm's, and
      // the more by a people who prize valour.)
      const share = strengthOf(ctx, q) / Math.max(1, strengthOf(ctx, q) + strengthOf(ctx, old)),
        chance = clamp(
          0.05,
          0.9,
          STRIFE.contest * share + 0.3 * (trait(cultureOf(world).get(q.seat), WAY.valour) - 0.5),
        );
      if (!(world.rng.real(COUP, key, t, 8) < chance)) continue;
      const decision = world.decisions.record({
        rule: "strife.civil",
        subject: q.ref,
        outcome: { against: old.ref, kind: "succession" },
        score: chance,
        threshold: 0,
        factors: [
          {
            name: "a throne contested",
            value: old.succession,
            contribution: 0,
            source: { ref: why.id, role: "trigger", weight: 1 },
          },
          {
            name: "the claimant's host against the realm's",
            value: share,
            contribution: STRIFE.contest * share,
            source: null,
          },
        ],
      });
      civilWar(ctx, q, old, "succession", [{ ref: decision, role: "trigger", weight: 1 }], t);
    } else if (why.type === "order.freed") {
      const oo = order.of(old.ref),
        hier = trait(cultureOf(world).get(old.seat), WAY.hierarchy),
        chance =
          oo && oo.abolished === null && strengthOf(ctx, old) > strengthOf(ctx, q)
            ? clamp(0, 0.8, 1.5 * (hier - 0.4) + 0.5 * oo.caste)
            : 0;
      if (!(chance > 0 && world.rng.real(COUP, key, t, 9) < chance)) continue;
      const decision = world.decisions.record({
        rule: "strife.civil",
        subject: old.ref,
        outcome: { against: q.ref, kind: "freed" },
        score: chance,
        threshold: 0,
        factors: [
          {
            name: "the bound who rose free",
            value: 1,
            contribution: 0.3,
            source: { ref: why.id, role: "trigger", weight: 1 },
          },
          {
            name: "a people who keep to rank",
            value: hier,
            contribution: 1.5 * (hier - 0.4),
            source: nudged(cultureOf(world).get(old.seat), WAY.hierarchy),
          },
          { name: "rank set hard", value: oo!.caste, contribution: 0.5 * oo!.caste, source: null },
        ],
      });
      civilWar(ctx, q, old, "freed", [{ ref: decision, role: "trigger", weight: 1 }], t);
    }
  }

  for (const p of realms.living()) {
    const o = order.of(p.ref);
    if (!o) continue;
    const s = store.of(p.ref),
      key = parseRef(p.ref).b >>> 0;

    // 1. Under its army's rule: restored, the likelier as its standing returns, its people press
    // for a voice, or at a general's death.
    if (s?.junta && p.leadership === GENERAL) {
      const voice = o.movements.find((m) => m.cause === "voice"),
        succeeded = world.events.get(p.ruler.event),
        heirless = p.ruler.since === year && succeeded?.type === POLITY_EVENTS.succession.type,
        standing = Math.max(0, o.legitimacy - 0.5),
        chance =
          STRIFE.restore +
          0.1 * standing +
          0.05 * (voice?.strength ?? 0) +
          (heirless ? STRIFE.heirless : 0);
      if (world.rng.real(COUP, key, t, 1) < chance) {
        const decision = world.decisions.record({
          rule: "strife.restore",
          subject: p.ref,
          outcome: { realm: p.ref },
          score: chance,
          threshold: 0,
          factors: [
            {
              name: "the army's rule",
              value: year - s.junta.since,
              contribution: STRIFE.restore,
              source: { ref: s.junta.event, role: "enabler", weight: 1 },
            },
            {
              name: "a rule held rightful again",
              value: o.legitimacy,
              contribution: 0.1 * standing,
              source: null,
            },
            {
              name: "a people who want a voice",
              value: voice?.strength ?? 0,
              contribution: 0.05 * (voice?.strength ?? 0),
              source: voice ? { ref: voice.event, role: "pressure", weight: 1 } : null,
            },
            {
              name: "a general dead, none chosen to follow",
              value: heirless ? 1 : 0,
              contribution: heirless ? STRIFE.heirless : 0,
              source: heirless ? { ref: p.ruler.event, role: "trigger", weight: 1 } : null,
            },
          ],
        });
        restore(ctx, p, [{ ref: decision, role: "trigger", weight: 1 }], t);
        continue;
      }
    }

    // 2. A revolution weighed (M146): a realm whose people press for a voice or the land.
    const interests = interestsOf(ctx, p, t);
    if (
      p.leadership !== 2 &&
      o.movements.some((m) => m.cause !== "abolition" && m.strength >= STRIFE.movement)
    ) {
      const danger = revolutionDanger(ctx, p, o, interests);
      if (
        danger.movement &&
        danger.score > STRIFE.rising &&
        world.rng.real(COUP, key, t, 10) < STRIFE.revolts * (danger.score - STRIFE.rising)
      ) {
        const odds = clamp(
            0.15,
            0.85,
            0.25 +
              0.5 * danger.movement.strength +
              0.3 * danger.doubt -
              0.4 * danger.weight +
              // (A people with arms in its hands wins the more often: rules/holds.ts force.)
              0.3 * (HOLDING.forceMid - holdOf(world, p.ref, HOLD.force)),
          ),
          won = world.rng.real(COUP, key, t, 11) < odds,
          decision = world.decisions.record({
            rule: "strife.revolution",
            subject: p.ref,
            outcome: { won, cause: danger.movement.cause },
            score: danger.score,
            threshold: STRIFE.rising,
            factors: danger.factors,
          }),
          causes: CauseRef[] = [{ ref: decision, role: "trigger", weight: 1 }];
        if (won)
          revolt(
            ctx,
            p,
            danger.movement.cause,
            causes,
            t,
            interests.find((i) => i.group === "the court")?.sway ?? 0,
          );
        else repress(ctx, p, danger.movement.cause, causes, t);
        continue;
      }
    }

    // 3. A coup weighed: an army with sway enough, uncowed, in a realm old enough to have a seat worth taking.
    if ((s?.purged ?? 0) > year || year - p.founded < 5) continue;
    const army = interests.find((i) => i.group === "the army");
    if (!army || army.sway < STRIFE.least) continue;
    const danger = coupDanger(ctx, p, o, interests);
    if (danger.score <= STRIFE.line) continue;
    const chance = STRIFE.chance * (danger.score - STRIFE.line);
    if (!(world.rng.real(COUP, key, t, 2) < chance)) continue;
    // (A blessing on the ruler halves a coup's odds against them, a curse doubles them: exactly as ever where none holds.)
    const by = rulerHazard(world, p.ref, p.ruler.event, year),
      odds = by === 1 ? coupOdds(danger) : Math.min(1, coupOdds(danger) * by),
      won = world.rng.real(COUP, key, t, 3) < odds,
      decision = world.decisions.record({
        rule: "strife.coup",
        subject: p.ref,
        outcome: { won },
        score: danger.score,
        threshold: STRIFE.line,
        factors: danger.factors,
      });
    // (Under the name of the one who holds the army's voice at court, a year's warning first: Lives L5.)
    if (armyMoves(ctx, p, decision, odds, won, t)) continue;
    if (won) seize(ctx, p, [{ ref: decision, role: "trigger", weight: 1 }], t);
    else foil(ctx, p, [{ ref: decision, role: "trigger", weight: 1 }], t, danger.weight);
  }
}

/** A rule seized by the sword, as its people hold it (a factor of its legitimacy), while remembered. */
export function seizedFactor(world: World, p: Polity): Factor | null {
  const junta = strifeOf(world)?.junta(p.ref);
  if (!junta) return null;
  const fade = Math.max(0, 1 - (yearOfMoment(world.now) - junta.since) / STRIFE.remembered);
  return fade > 0
    ? {
        name: "a rule seized by the sword",
        value: fade,
        contribution: -STRIFE.seized * fade,
        source: { ref: junta.event, role: "pressure", weight: 1 },
      }
    : null;
}

/** The god's hand on a realm's army (M145): stirred against its seat; its rule given back. */
export function installStrifeActs(world: World, ctx: () => PopulationContext): void {
  const realmAt = (args: unknown): Polity | string => {
    const cell = (args as { cell?: unknown } | null)?.cell;
    if (!Number.isInteger(cell)) return "a land is wanted";
    if (!ctx().provinces.get(cell as number)) return "no one lives there";
    return politiesOf(world).of(cell as number) ?? "no realm holds it";
  };
  // Its army stirred against its seat: a coup tried now, the likelier won for the god's hand in it.
  world.defineCommand({
    type: "act.incite",
    validate: (args) => {
      if (!strifeOf(world) || !orderOf(world)) return "this world knows no strife";
      const p = realmAt(args);
      return typeof p === "string" ? p : null;
    },
    apply: (command, t) => {
      const c = ctx(),
        p = realmAt(command.args) as Polity,
        o = orderOf(world)!.of(p.ref),
        cell = (command.args as { cell: number }).cell,
        stirred = world.events.emit({
          type: STRIFE_ACTS.incite.type,
          subjects: [p.ref],
          place: c.provinces.get(cell)?.ref ?? null,
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { realm: realmName(p) },
        }),
        danger = o ? coupDanger(c, p, o) : { weight: 0.3, doubt: 0, cap: 0.5 },
        odds = Math.min(0.95, coupOdds(danger) + 0.3),
        causes: CauseRef[] = [{ ref: stirred, role: "trigger", weight: 1 }];
      if (world.rng.real(COUP, parseRef(p.ref).b >>> 0, t, 4) < odds) seize(c, p, causes, t);
      else foil(c, p, causes, t);
    },
  });
  // A pretender raised (M146): a claimant in a land, with the realm's lands about it, rises
  // against its seat and marches on it.
  world.defineCommand({
    type: "act.pretender",
    validate: (args) => {
      if (!strifeOf(world)) return "this world knows no strife";
      const p = realmAt(args);
      if (typeof p === "string") return p;
      const cell = (args as { cell: number }).cell;
      if (cell === p.seat) return "a realm's seat cannot rise against itself";
      return ctx().settlements.kept(cell).length ? null : "no town there to raise a claimant in";
    },
    apply: (command, t) => {
      const c = ctx(),
        p = realmAt(command.args) as Polity,
        cell = (command.args as { cell: number }).cell,
        g = c.generated,
        about = [cell];
      for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
        const n = g.grid.neighbours[k]!;
        if (n !== p.seat && p.members.includes(n)) about.push(n);
      }
      const raised = world.events.emit({
        type: STRIFE_ACTS.pretender.type,
        subjects: [p.ref],
        place: c.provinces.get(cell)?.ref ?? null,
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: { realm: realmName(p), lands: about.length },
      });
      breakAway(c, p, about, raised, "pretender", t);
    },
  });
  // Its own rule given back: the army's rule ends at once.
  world.defineCommand({
    type: "act.restore",
    validate: (args) => {
      if (!strifeOf(world)) return "this world knows no strife";
      const p = realmAt(args);
      if (typeof p === "string") return p;
      return strifeOf(world)!.junta(p.ref) && p.leadership === GENERAL
        ? null
        : "its army does not rule it";
    },
    apply: (command, t) => {
      const c = ctx(),
        p = realmAt(command.args) as Polity,
        cell = (command.args as { cell: number }).cell,
        given = world.events.emit({
          type: STRIFE_ACTS.restore.type,
          subjects: [p.ref],
          place: c.provinces.get(cell)?.ref ?? null,
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { realm: realmName(p) },
        });
      restore(c, p, [{ ref: given, role: "trigger", weight: 1 }], t);
    },
  });
}

/** Teach a peopled world its strife. */
export function installStrife(world: World, ctx: () => PopulationContext): StrifeStore {
  const store = world.register(new StrifeStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "189.strife.year", every: YEAR, run: (t) => strifeYear(ctx(), t) });
  return store;
}
