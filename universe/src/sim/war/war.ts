// War (docs/architecture §23), v1 on the province graph. Rivals — and realms whose
// people starve beside a neighbour's full stores — may go to war; the decision's
// factors reach what drove it: the rivalry's reasons (a faith, a taken land), the
// famine and the dry year behind it, the land they want and its ground. A realm
// fields a share of its grown people, larger where they prize valour or keep a
// standing army, better armed with bronze, iron, mounts and walls. Each year of war
// brings a battle for a border land: hills and rivers favour those who hold them,
// walls more so, supply thins with distance from the seat and with famine at home.
// The fallen are written into the ledgers of deaths. A land won changes hands; its
// people's grievance may raise it in rebellion back to the realm it was taken from.
// Weariness brings peace, and the war is remembered in the realms' regard.
import {
  YEAR,
  defineEventType,
  defineKind,
  defineStream,
  drawWithoutReplacement,
  yearOfMoment,
  type CauseRef,
  type Factor,
  Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  BANDS,
  G,
  MALE,
  apportionCapped,
  packFell,
  unpackFell,
  type LandFell,
} from "../../rules/index.ts";
import { designsOf } from "../design/design.ts";
import { ArmsStore, armsOf } from "./arms.ts";
import {
  FELL_TOWN_YEARS,
  battleRecord,
  bodySize,
  fieldOf,
  hostTerms,
  type Bore,
  type Take,
} from "./fell.ts";
import { FALL_PURPOSE, fighting, levyOf, type Levy, type Pool } from "./levy.ts";
import { battleDead } from "./losses.ts";
import { COLS, row } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import { marketGoodRef, type MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { cutOff, endRealm, politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { interestsOf, pressure } from "../polity/interests.ts";
import { loreOf } from "../lore/lore.ts";
import { RIVALRY, diplomacyOf, relationRef } from "../diplomacy/diplomacy.ts";
import { CREDIT, warChest } from "../credit/credit.ts";
import { STRIFE, settleCivil } from "../strife/strife.ts";
import { GENERAL } from "../polity/polity.ts";

export const WAR = defineKind("war", "war", "minted");

export const WAR_EVENTS = {
  declared: defineEventType("war.declared", 6),
  battle: defineEventType("war.battle", 4),
  taken: defineEventType("war.taken", 5),
  rebellion: defineEventType("war.rebellion", 5),
  peace: defineEventType("war.peace", 5),
};

export type Battle = {
  readonly year: number;
  readonly land: number;
  readonly won: boolean;
  readonly fallen: readonly [number, number];
  readonly event: Ref;
  /**
   * The men each side brought to the field: the sum of its levy, before the battle (Phase 55 M224b;
   * before it, the host as reckoned after the fall, Phase 37 M183; absent in older saves).
   */
  readonly fielded?: readonly [number, number];
  /** Whether it was fought at the defender's seat, about its walls (M183). */
  readonly seat?: boolean;
  /**
   * What each side's arms were worth (Phase 52 M217): its host's power — the bare host's and as
   * much of its full kit's as it bore — and how armed it was (0 … 1). Absent in older saves.
   */
  readonly power?: readonly [number, number];
  readonly armed?: readonly [number, number];
  /** The designs each side was armed by (null: none yet; M217, absent in older saves). */
  readonly designs?: readonly [Ref | null, Ref | null];
  /** Whether its arms tipped it: with even arms, the same day would have gone the other way. */
  readonly tip?: boolean;
  /** Of each side, the wounded who lived and of them the maimed (Phase 55 M224; absent in older saves). */
  readonly wounded?: readonly [number, number];
  readonly maimed?: readonly [number, number];
  /** What each side bore: its arm and the stuff it was made of (null: no arm part; M224). */
  readonly bore?: readonly [Bore | null, Bore | null];
  /** Each side's men by the land and town they came from: sent, fallen, wounded (rules/apportion.ts LandFell; M224). */
  readonly fell?: readonly [readonly LandFell[], readonly LandFell[]];
};

/** What a civil war is fought over (Phase 22 M146): a throne at a succession, a general's revolt, a pretender's claim, an old court's return, the freed taken back. */
export type CivilKind = "succession" | "general" | "pretender" | "revolution" | "freed";

export type War = {
  readonly ref: Ref;
  readonly attacker: Ref;
  readonly defender: Ref;
  readonly declared: number;
  readonly event: Ref;
  /** The land the attacker wanted most. */
  readonly prize: number;
  battles: Battle[];
  /** What each side has lost, in the fallen. */
  fallen: [number, number];
  ended: number | null;
  peace: Ref | null;
  /** The embargo the war laid on the trade between the two realms' lands, once it cut any. */
  embargo?: Ref;
  /** A civil war: what it is fought over (M146). */
  readonly civil?: CivilKind;
};

const DECLARE = defineStream("war.declare");
/** Years after a peace before a realm is as ready for war as it was. */
export const WEARY_YEARS = 30;
const FIGHT = defineStream("war.fight");

/** A battle without its tallies by land and town (itself, where it has none). */
function omitFell(b: Battle): Battle {
  if (!b.fell) return b;
  const { fell, ...rest } = b;
  void fell;
  return rest;
}

/**
 * A war as it is hashed: its battles without their tallies by land and town, which are folded in
 * once, as each battle is fought (WarStore.noteFell), so that letting the towns go changes nothing.
 */
function bare(w: War): War {
  return { ...w, battles: w.battles.map(omitFell) };
}

/** A battle as kept in a save: its tallies by land and town packed (packFell). */
type KeptBattle = Omit<Battle, "fell"> & {
  readonly fellPacked?: readonly [readonly number[], readonly number[]];
};

/** A battle to keep: its tallies packed where its wounded let them be read back. */
function keep(b: Battle): Battle | KeptBattle {
  if (!b.fell || !b.wounded) return b;
  const { fell, ...rest } = b;
  return { ...rest, fellPacked: [packFell(fell[0]), packFell(fell[1])] };
}

/** A kept battle read back (a save from before the packing keeps its tallies whole). */
function unkeep(b: Battle | KeptBattle): Battle {
  if (!("fellPacked" in b) || !b.fellPacked || !b.wounded) return b as Battle;
  const { fellPacked, ...rest } = b;
  return {
    ...rest,
    fell: [unpackFell(fellPacked[0], b.wounded[0]), unpackFell(fellPacked[1], b.wounded[1])],
  };
}

/** A land's tally without its towns: the first four elements (rules/apportion.ts LandFell). */
function strip(lands: readonly LandFell[]): LandFell[] {
  return lands.map(([cell, sent, dead, hurt]): LandFell => [cell, sent, dead, hurt]);
}

export class WarStore implements StateStore {
  readonly name = "war.wars";
  private list: War[] = [];
  /** The same wars by ref. */
  private readonly byRef = new Map<string, War>();
  /** Wars that ended are folded into a digest once, at the end of their year, and not hashed again. */
  private digest = "";
  private readonly sealed = new Set<string>();
  /** Each battle's tallies by land and town, folded in once, as it is fought (Phase 55 M224). */
  private fellDigest = "";
  /**
   * The leading wars whose towns are all let go (not saved: after a load, forgetting again from
   * the first war is a no-op).
   */
  private forgotten = 0;

  /** Fold the wars that have ended into the digest (in ref order): they will not change again. */
  seal(): void {
    const ended = this.list
      .filter((w) => w.ended !== null && !this.sealed.has(w.ref))
      .sort((a, b) => (a.ref < b.ref ? -1 : 1));
    if (!ended.length) return;
    const h = new Hasher().string(this.digest);
    for (const w of ended) {
      h.value(bare(w));
      this.sealed.add(w.ref);
    }
    this.digest = h.hex();
  }

  /** Fold a battle's tallies by land and town into their digest, as it is fought. */
  noteFell(b: Battle): void {
    if (b.fell)
      this.fellDigest = new Hasher().string(this.fellDigest).string(b.event).value(b.fell).hex();
  }

  /**
   * Let go of the town tallies of the battles fought before `before` in the wars that have ended
   * (their lands' are kept for good). Nothing hashed changes: the tallies were folded in as fought.
   */
  forgetTowns(before: number): void {
    for (let i = this.forgotten; i < this.list.length; i++) {
      const w = this.list[i]!;
      if (!this.sealed.has(w.ref)) continue;
      for (let k = 0; k < w.battles.length; k++) {
        const b = w.battles[k]!;
        if (b.year < before && b.fell?.some((side) => side.some((land) => land.length > 4)))
          w.battles[k] = { ...b, fell: [strip(b.fell[0]), strip(b.fell[1])] };
      }
    }
    // (The leading wars ended and fought out before then are done with.)
    while (this.forgotten < this.list.length) {
      const w = this.list[this.forgotten]!;
      if (!this.sealed.has(w.ref) || (w.battles.at(-1)?.year ?? -Infinity) >= before) break;
      this.forgotten++;
    }
  }

  add(w: War): void {
    this.list.push(w);
    this.byRef.set(w.ref, w);
  }

  all(): readonly War[] {
    return this.list;
  }

  get(ref: Ref): War | undefined {
    return this.byRef.get(ref);
  }

  /** The wars a realm is fighting now. */
  fighting(realm: Ref): War[] {
    return this.list.filter(
      (w) => w.ended === null && (w.attacker === realm || w.defender === realm),
    );
  }

  between(a: Ref, b: Ref): War | undefined {
    return this.list.find(
      (w) =>
        w.ended === null &&
        ((w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a)),
    );
  }

  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const w of this.list) {
      refs.push(w.event);
      if (w.peace) refs.push(w.peace);
      for (const b of w.battles) refs.push(b.event);
    }
    return refs;
  }

  hashInto(h: Hasher): void {
    h.string(this.digest);
    // (A battle's town tallies are hashed once, as it is fought: the yearly hash does not grow
    // with them, and letting them go changes nothing hashed.)
    if (this.fellDigest) h.string(this.fellDigest);
    h.value(this.list.filter((w) => !this.sealed.has(w.ref)).map(bare));
  }

  save(): unknown {
    return {
      // (A battle's tallies by land and town are kept packed: what the rules give again is left out.)
      wars: this.list.map((w) => ({ ...w, battles: w.battles.map(keep) })),
      digest: this.digest,
      sealed: [...this.sealed].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
      fellDigest: this.fellDigest,
    };
  }

  load(state: unknown): void {
    this.list = (state as { wars: War[] }).wars.map((w) => ({
      ...w,
      battles: w.battles.map(unkeep),
      fallen: [...w.fallen] as [number, number],
    }));
    this.byRef.clear();
    for (const w of this.list) this.byRef.set(w.ref, w);
    const t = state as { digest?: string; sealed?: string[]; fellDigest?: string };
    this.digest = t.digest ?? "";
    this.sealed.clear();
    for (const r of t.sealed ?? []) this.sealed.add(r);
    this.fellDigest = t.fellDigest ?? "";
    this.forgotten = 0;
  }
}

export function warsOf(world: World): WarStore {
  return world.store<WarStore>("war.wars");
}

/** The share of its fighting men a realm fields: more by its valour, more with a standing army, more under a general. */
function fieldShare(ctx: PopulationContext, p: Polity): number {
  const valour = cultureOf(ctx.world).get(p.seat)?.traits[WAY.valour] ?? 0.5,
    lore = loreOf(ctx.world);
  return (
    0.04 +
    0.1 * valour +
    0.03 * lore.effect(p.seat, "arms") * (lore.get(p.seat, "standing-army") ? 1 : 0) +
    (p.leadership === GENERAL ? STRIFE.fields : 0)
  );
}

/** A realm's grown men of fighting age, in all its lands. */
function fightingMen(ctx: PopulationContext, p: Polity): number {
  let men = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    for (let b = 0; b < BANDS; b++)
      if (fighting(ctx.life, b)) men += prov.counts.rowSum(row(MALE, b));
  }
  return men;
}

/** How many a realm fields (for its counters, Phase 11 M101): its fighting men, the share it fields. */
export function fieldedOf(ctx: PopulationContext, p: Polity): number {
  return fightingMen(ctx, p) * fieldShare(ctx, p);
}

/**
 * What the host a realm fields is made of (the strength lens's breakdown, Phase 12 M108): its
 * fighting men, the share of them it fields, its people's valour, whether it keeps a standing army.
 */
export function fieldedParts(
  ctx: PopulationContext,
  p: Polity,
): { men: number; share: number; valour: number; standing: boolean } {
  return {
    men: fightingMen(ctx, p),
    share: fieldShare(ctx, p),
    valour: cultureOf(ctx.world).get(p.seat)?.traits[WAY.valour] ?? 0.5,
    standing: !!loreOf(ctx.world).get(p.seat, "standing-army"),
  };
}

/** How many a realm can field, and how well armed: grown men, a share by valour and a standing army. */
export function strengthOf(ctx: PopulationContext, p: Polity): number {
  const share = fieldShare(ctx, p),
    // What its host fights with: its design (realized now, if the realm is newer than it), as
    // its seat makes it and as much of it as the host bears (Phase 52 M217: sim/war/arms.ts),
    // borne by bodies as strong as they are.
    arms = armsOf(ctx, p).power * ctx.affords.strength;
  return fightingMen(ctx, p) * share * arms;
}

/** The border lands of `b` next to `a`, richest in food first. */
export function frontier(ctx: PopulationContext, a: Polity, b: Polity): number[] {
  const g = ctx.generated,
    markets = ctx.world.store<MarketStore>("economy.markets"),
    // A realm with ships fights for lands across the sea its traders have reached.
    sails = loreOf(ctx.world).effect(a.seat, "ships") > 0,
    theirs = new Set(b.members),
    out = new Set<number>();
  const near = (c: number, take: (n: number) => void) => {
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) take(g.grid.neighbours[k]!);
    if (sails) for (const n of markets.seaPartners(c)) take(n);
  };
  for (const c of a.members)
    near(c, (n) => {
      if (theirs.has(n) && n !== b.seat) out.add(n);
    });
  // The seat itself is fought for only once nothing else of the realm stands before it.
  if (!out.size && theirs.has(b.seat))
    for (const c of a.members)
      near(c, (n) => {
        if (n === b.seat) out.add(n);
      });
  return [...out].sort((x, y) => stores(ctx, y) - stores(ctx, x) || x - y);
}

/** Whether a realm reaches a land only across the sea (none of its lands borders it). */
function overseas(ctx: PopulationContext, a: Polity, land: number): boolean {
  const g = ctx.generated;
  for (let k = g.grid.offsets[land]!; k < g.grid.offsets[land + 1]!; k++)
    if (a.members.includes(g.grid.neighbours[k]!)) return false;
  return true;
}

/** The finest ship-craft a land knows: the event it was learned in. */
function shipCraft(ctx: PopulationContext, cell: number): Ref | null {
  const lore = loreOf(ctx.world);
  for (const id of ["astronomy", "shipbuilding", "sailing"]) {
    const k = lore.get(cell, id);
    if (k) return k.event;
  }
  return null;
}

/** A host landing from the sea fights at this share of its strength. */
const LANDING = 0.6;

/**
 * How fire tells in a battle (Phase 53 M219), by the firepower of each side's arms (rules/firearms.ts,
 * 0 for the rifle and all before it): a defender digs in by `dig` for each unit of its fire beyond
 * what the attacker's armour breaches (`breach` units of fire for each of armour); and both sides lie
 * low under it, so that fewer fall by `disperse` for each unit of the fiercer side's fire. With equal
 * men: rifles against rifles the attacker wins 0.40, machine guns against machine guns 0.33, armour
 * against armour 0.36, armour against rifles 0.48.
 */
export const FIRE = { dig: 0.06, breach: 3, disperse: 0.12 } as const;

/**
 * A battle's fire terms (Phase 53 M219): how far its defender digs in against the attacker, and the
 * share of the fallen that still fall. Exactly 1 and 1 where neither side's arms loose more than a
 * rifle's.
 */
export function fireTerms(
  attacker: { readonly fire: number; readonly breach: number },
  defender: { readonly fire: number },
): { entrench: number; disperse: number } {
  return {
    entrench: 1 + FIRE.dig * Math.max(0, defender.fire - FIRE.breach * attacker.breach),
    disperse: 1 / (1 + FIRE.disperse * Math.max(attacker.fire, defender.fire)),
  };
}

/** A land's food in store (its grain, pulses and roots): what a coveting realm wants of it. */
function stores(ctx: PopulationContext, cell: number): number {
  const markets = ctx.world.store<MarketStore>("economy.markets");
  return markets.get(cell)?.stock.reduce((s, v, i) => (i < 3 ? s + v : s), 0) ?? 0;
}

/**
 * Lose `n` of a land's men to battle: drawn from its pool (its fighting men at work, never the
 * hand's own: levy.ts), written as deaths.
 */
function fall(
  ctx: PopulationContext,
  pool: Pool,
  n: number,
  t: SimTime,
  subject: number,
  purpose: number,
): number {
  const prov = ctx.provinces.get(pool.cell),
    take = Math.min(n, pool.men);
  if (!prov || !(take > 0)) return 0;
  const year = yearOfMoment(t),
    drawn = drawWithoutReplacement(take, pool.counts, (i) =>
      ctx.world.rng.real(FIGHT, subject, t, purpose, i),
    );
  drawn.forEach((k, i) => {
    if (!k) return;
    const r = Math.floor(pool.rows[i]! / COLS),
      o = pool.rows[i]! % COLS;
    prov.counts.add(r, o, -k);
    ctx.history.addDeaths(pool.cell, year, r % BANDS, k);
  });
  return take;
}

/**
 * A side's dead split over the lands that sent its men, by the men each sent (never more than it
 * sent), and drawn from each: its k-th land by FALL_PURPOSE + k. Each land's part: its cell, the men
 * it sent, its dead.
 */
function fallAll(
  ctx: PopulationContext,
  levy: Levy,
  dead: number,
  t: SimTime,
  subject: number,
): Take[] {
  const each = apportionCapped(dead, levy.sent, levy.sent);
  return levy.pools.map((pool, k): Take => [
    pool.cell,
    levy.sent[k]!,
    fall(ctx, pool, each[k]!, t, subject, FALL_PURPOSE + k),
  ]);
}

const pairKey = (a: Ref, b: Ref) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** The year's wars: declarations, a battle in each war, rebellions, peace. */
export function warYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    wars = warsOf(world),
    realms = politiesOf(world),
    diplomacy = diplomacyOf(world),
    culture = cultureOf(world),
    lore = loreOf(world),
    year = yearOfMoment(t);

  // 1. Declarations: rivals, and realms who covet a neighbour's stores in a famine.
  // A realm fresh from war is slow to go to war again: its fallen are still mourned.
  const lastPeace = new Map<string, War>(),
    fighting = new Set<string>();
  for (const w of wars.all()) {
    if (w.ended === null) fighting.add(pairKey(w.attacker, w.defender));
    else if (w.peace)
      for (const side of [w.attacker, w.defender])
        if ((lastPeace.get(side)?.ended ?? -1) < w.ended) lastPeace.set(side, w);
  }
  // Each realm's strength, reckoned once this year.
  const strengths = new Map<string, number>(),
    strength = (p: Polity) => {
      let s = strengths.get(p.ref);
      if (s === undefined) strengths.set(p.ref, (s = strengthOf(ctx, p)));
      return s;
    };
  for (const r of diplomacy.all()) {
    if (fighting.has(pairKey(r.a, r.b))) continue;
    const covets = r.terms.find((x) => /for their stores$/.test(x.name));
    // Without hatred or hunger there is no will to war, whatever else holds.
    if (!covets && -r.opinion - -RIVALRY <= 0) continue;
    const a0 = realms.get(r.a)!,
      b0 = realms.get(r.b)!;
    // The one who resents more, or hungers, attacks: the stronger of the two by default.
    const hungry = covets
        ? covets.name === `the hunger of ${realmName(a0)} for their stores`
          ? a0
          : b0
        : null,
      [sa, sb] = [strength(a0), strength(b0)],
      attacker = hungry ?? (sa >= sb ? a0 : b0),
      defender = attacker === a0 ? b0 : a0,
      ratio = (attacker === a0 ? sa : sb) / Math.max(1, attacker === a0 ? sb : sa);
    const valour = culture.get(attacker.seat)?.traits[WAY.valour] ?? 0.5,
      hatred = Math.max(0, -r.opinion - (covets ? 0 : -RIVALRY)),
      last = lastPeace.get(attacker.ref),
      rested = last ? Math.min(1, (year - last.ended!) / WEARY_YEARS) : 1,
      base =
        Math.min(0.5, (hatred * 0.12 + (covets ? 0.08 : 0)) * Math.min(2, ratio) * (0.5 + valour)) *
        rested,
      draw = world.rng.real(DECLARE, Number(attacker.ref.split(":")[2]), t, 0);
    // Its people's voices at most double the chance: a draw beyond that cannot be met, and
    // the land it would want and the voices need not be reckoned.
    if (base <= 0 || !(draw < 2 * base)) continue;
    const prize = frontier(ctx, attacker, defender)[0];
    if (prize === undefined) continue;
    // Its people's voices: traders who want peace with those they trade with hold it
    // back; a temple that wants war on unbelievers urges it on.
    const voices = interestsOf(ctx, attacker, t),
      peace = pressure(voices, "peace", defender.ref),
      holy = pressure(voices, "war", defender.ref),
      swayed = (1 - 0.7 * Math.min(1, 2 * peace.total)) * (1 + Math.min(1, 2 * holy.total)),
      chance = base * swayed;
    if (chance <= 0 || !(draw < chance)) continue;
    const factors: Factor[] = [
      {
        name: "their rivalry",
        value: r.opinion,
        contribution: Math.max(0, -r.opinion),
        source: { ref: relationRef(r.a, r.b), role: "pressure", weight: 1 },
      },
      // (What they fight for: weighed so it is always among the factors kept.)
      {
        name: "the land they want",
        value: prize,
        contribution: 0.5,
        source: { ref: cellRef(0, prize), role: "enabler", weight: 1 },
      },
      { name: "their strength", value: ratio, contribution: Math.min(2, ratio) / 2, source: null },
      {
        name: "a people who prize valour",
        value: valour,
        contribution: valour - 0.5,
        source: null,
      },
    ];
    // The rivalry's own reasons, as they stood — so the war's why holds when the realms are gone.
    for (const term of r.terms
      .filter((x) => x.value < 0 && x.source && !/for their stores$/.test(x.name))
      .sort((x, y) => x.value - y.value || (x.name < y.name ? -1 : 1))
      .slice(0, 2))
      factors.push({
        name: term.name,
        value: term.value,
        contribution: -term.value,
        source: { ref: term.source!, role: "pressure", weight: 1 },
      });
    for (const [voice, role, sign] of [
      [peace, "constraint", -1],
      [holy, "pressure", 1],
    ] as const)
      if (voice.strongest)
        factors.push({
          name: voice.strongest.name,
          value: voice.total,
          contribution: sign * Math.min(1, 2 * voice.total),
          source: voice.strongest.source ? { ref: voice.strongest.source, role, weight: 1 } : null,
        });
    // The land wanted is the one with the fullest stores.
    factors.push({
      name: "the stores of the land they want",
      value: stores(ctx, prize),
      contribution: 0.3,
      source: { ref: marketGoodRef(prize, G.grain), role: "enabler", weight: 1 },
    });
    if (last && rested < 1)
      factors.push({
        name: "the years since their last war",
        value: year - last.ended!,
        contribution: rested - 1,
        source: { ref: last.peace!, role: "constraint", weight: 1 },
      });
    // A land across the sea is fought for only with ships to carry the host.
    const ships = overseas(ctx, attacker, prize) ? shipCraft(ctx, attacker.seat) : null;
    if (ships)
      factors.push({
        name: "ships to carry the host",
        value: 1,
        contribution: 0.25,
        source: { ref: ships, role: "enabler", weight: 1 },
      });
    if (covets?.source)
      factors.push({
        name: "hunger",
        value: 1,
        contribution: 0.3,
        source: { ref: covets.source, role: "trigger", weight: 1 },
      });
    const decision = world.decisions.record({
      rule: "war.declare",
      subject: attacker.ref,
      outcome: { against: defender.ref, prize },
      score: chance,
      threshold: 0,
      factors,
    });
    const ref = world.minter.mint(WAR),
      event = world.events.emit({
        type: WAR_EVENTS.declared.type,
        subjects: [ref, attacker.ref, defender.ref],
        place: cellRef(0, prize),
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { a: realmName(attacker), b: realmName(defender) },
      });
    wars.add({
      ref,
      attacker: attacker.ref,
      defender: defender.ref,
      declared: year,
      event,
      prize,
      battles: [],
      fallen: [0, 0],
      ended: null,
      peace: null,
    });
  }

  // 2. A battle in each war: for the land the attacker wants, held by the defender.
  for (const w of wars.all()) {
    if (w.ended !== null || w.declared === year) continue;
    const a = realms.get(w.attacker)!,
      b = realms.get(w.defender)!;
    if (a.ended !== null || b.ended !== null) {
      w.ended = year;
      if (w.civil) settleCivil(ctx, w, false, false, t);
      continue;
    }
    const land = frontier(ctx, a, b)[0];
    if (land === undefined) {
      // No land left between them to fight over: the war ends, and history says so.
      w.ended = year;
      w.peace = world.events.emit({
        type: WAR_EVENTS.peace.type,
        subjects: [w.ref, a.ref, b.ref],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: [{ ref: w.event, role: "trigger", weight: 1 }],
        data: { a: realmName(a), b: realmName(b), years: year - w.declared, won: false },
      });
      if (w.civil) settleCivil(ctx, w, false, false, t);
      continue;
    }
    const key = Number(w.ref.split(":")[2]),
      far = (() => {
        // Supply thins with distance from the seat.
        const dx = g.grid.positions[3 * land]! - g.grid.positions[3 * a.seat]!,
          dy = g.grid.positions[3 * land + 1]! - g.grid.positions[3 * a.seat + 1]!,
          dz = g.grid.positions[3 * land + 2]! - g.grid.positions[3 * a.seat + 2]!;
        // In steps between neighbouring lands (about 0.0175 of the world's radius apart).
        return Math.sqrt(dx * dx + dy * dy + dz * dz) / 0.0175;
      })(),
      hungry = a.members.some((c) => {
        const f = ctx.provinces.get(c)?.lastFamine;
        const e = f ? world.events.get(f) : undefined;
        return e && t - e.t <= YEAR;
      }),
      // (A host paid from a war chest fights the harder, and its lands' hunger slows it not — M144.)
      chestA = warChest(world, a.ref, w.ref),
      chestB = warChest(world, b.ref, w.ref),
      attack =
        strengthOf(ctx, a) *
        (1 / (1 + 0.15 * far)) *
        (hungry && !chestA ? 0.7 : 1) *
        (chestA ? CREDIT.chest : 1) *
        (1 + 0.3 * lore.effect(a.seat, "sieges")) *
        (overseas(ctx, a, land) ? LANDING : 1),
      hills = g.tectonics.elevation[land]! > 600 ? 1.3 : 1,
      river = g.water.river[land] ? 1.1 : 1,
      walls = 1 + 0.25 * lore.effect(land, "walls"),
      // Those who hold the land know its ground, and every village is a stronghold; at
      // its seat the whole realm stands.
      seat = land === b.seat,
      armsA = armsOf(ctx, a),
      armsB = armsOf(ctx, b),
      // (Fire, Phase 53 M219: a host whose arms loose much digs in where it stands, unless armour
      // breaches its line; and the more there is in the air, the more both sides lie low and the
      // fewer fall. Both exactly 1 before the magazine.)
      { entrench, disperse } = fireTerms(armsA, armsB),
      defend =
        strengthOf(ctx, b) *
        1.5 *
        (seat ? 2 : 1) *
        hills *
        river *
        walls *
        (chestB ? CREDIT.chest : 1) *
        entrench,
      odds = attack / Math.max(1, attack + defend),
      draw = world.rng.real(FIGHT, key, t, 0),
      won = draw < odds,
      // (Its arms tipped it where, the same day with even arms, it would have gone the other way.)
      evenA = attack / armsA.power,
      evenB = defend / (armsB.power * entrench),
      tip = won !== draw < evenA / Math.max(1, evenA + evenB),
      tipped = tip ? designsOf(world).of((won ? a : b).ref)?.event : undefined;
    // The fallen (Phase 55 M224b): every land of each realm on its home world sends men by its
    // fighting men (D2); of those who close with the foe a share is struck down by the foe's arms
    // against their guard, more when beaten, fewer the farther and thicker the fire, and of the
    // struck the share the blow and the care kill (D5: losses.ts, rules/wounds.ts).
    const levyA = levyOf(ctx, a, Math.round(fieldedOf(ctx, a)), year),
      levyB = levyOf(ctx, b, Math.round(fieldedOf(ctx, b)), year),
      fielded: [number, number] = [
        levyA.sent.reduce((n, x) => n + x, 0),
        levyB.sent.reduce((n, x) => n + x, 0),
      ],
      termsA = hostTerms(ctx, a, armsA),
      termsB = hostTerms(ctx, b, armsB),
      [deadA, deadB] = battleDead(
        { fielded: fielded[0], terms: termsA },
        { fielded: fielded[1], terms: termsB },
        won,
        disperse,
        bodySize(ctx),
      ),
      takesA = fallAll(ctx, levyA, deadA, t, key * 2),
      takesB = fallAll(ctx, levyB, deadB, t, key * 2 + 1),
      fa = takesA.reduce((n, x) => n + x[2], 0),
      fb = takesB.reduce((n, x) => n + x[2], 0);
    w.fallen = [w.fallen[0] + fa, w.fallen[1] + fb];
    const record = battleRecord(ctx, [
      { terms: termsA, field: fieldOf(fielded[0], fa), fallen: fa, takes: takesA },
      { terms: termsB, field: fieldOf(fielded[1], fb), fallen: fb, takes: takesB },
    ]);
    const battle = world.events.emit({
      type: WAR_EVENTS.battle.type,
      subjects: [w.ref, a.ref, b.ref],
      place: cellRef(0, land),
      causes: [
        { ref: w.event, role: "trigger", weight: 1 },
        ...(chestA ? [{ ref: chestA, role: "enabler" as const, weight: 0.5 }] : []),
        ...(chestB ? [{ ref: chestB, role: "enabler" as const, weight: 0.5 }] : []),
        // The winner's arms, where they tipped it.
        ...(tipped ? [{ ref: tipped, role: "enabler" as const, weight: 0.4 }] : []),
      ],
      data: { a: realmName(a), b: realmName(b), won, fallen: fa + fb, ...(tip ? { tip } : {}) },
    });
    const fought: Battle = {
      year,
      land,
      won,
      fallen: [fa, fb],
      event: battle,
      fielded,
      seat,
      power: [Math.round(armsA.power * 1000) / 1000, Math.round(armsB.power * 1000) / 1000],
      armed: [Math.round(armsA.armed * 1000) / 1000, Math.round(armsB.armed * 1000) / 1000],
      designs: [armsA.design, armsB.design],
      tip,
      ...record,
    };
    w.battles.push(fought);
    wars.noteFell(fought);
    // A seat is not taken in a day: the first victory there lays a siege, the second takes it.
    const besieged = seat && won && !w.battles.slice(0, -1).some((x) => x.land === land && x.won);
    if (won && !besieged) {
      const taken = world.events.emit({
        type: WAR_EVENTS.taken.type,
        subjects: [a.ref, b.ref],
        place: cellRef(0, land),
        causes: [{ ref: battle, role: "trigger", weight: 1 }],
        data: { a: realmName(a), b: realmName(b) },
      });
      realms.leave(b, land);
      realms.join(a, land);
      // A land taken by force resents its taker.
      realms.setDiscontent(land, { level: 1, cause: battle });
      // A realm whose seat is taken falls, and its lands pass to its conqueror, aggrieved
      // (those not joined to the conqueror's own go their own way); else what the taken
      // land joined to its seat is cut off.
      if (land === b.seat) {
        for (const c of [...b.members]) {
          realms.leave(b, c);
          realms.join(a, c);
          realms.setDiscontent(c, { level: 0.6, cause: battle });
        }
        endRealm(ctx, b, t, { ref: battle, role: "trigger", weight: 1 });
        cutOff(ctx, a, taken);
      } else cutOff(ctx, b, taken);
    }
    // 3. Peace: weariness — the fallen against their people — or the prize won.
    const peopleA = a.members.reduce((s, c) => s + (ctx.provinces.get(c)?.total() ?? 0), 0),
      weary = w.fallen[0] / Math.max(1, peopleA) + w.fallen[1] / Math.max(1, peopleA),
      years = year - w.declared,
      prizeWon = a.members.includes(w.prize);
    // A beaten attacker often gives up; a won prize, a weary people or long years end it too.
    const repulsed = !won && world.rng.real(FIGHT, key, t, 6) < 0.5;
    if (
      prizeWon ||
      repulsed ||
      weary > 0.02 ||
      years >= 6 ||
      world.rng.real(FIGHT, key, t, 5) < 0.12
    ) {
      w.ended = year;
      w.peace = world.events.emit({
        type: WAR_EVENTS.peace.type,
        subjects: [w.ref, a.ref, b.ref],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: [{ ref: battle, role: "trigger", weight: 1 }],
        data: { a: realmName(a), b: realmName(b), years, won: prizeWon },
      });
      diplomacy.remember(a.ref, b.ref, {
        name: "a war between them",
        value: -0.45,
        year,
        source: w.event,
      });
      if (w.civil) settleCivil(ctx, w, prizeWon, repulsed, t);
    }
  }

  // 4. Rebellion: a taken land still aggrieved rises back to the realm it was taken from.
  for (const p of realms.living())
    for (const c of [...p.members]) {
      if (c === p.seat) continue;
      const d = realms.discontent(c),
        former = realms.formerly(c),
        home = former ? realms.get(former) : undefined;
      if (!home || home.ref === p.ref || home.ended !== null || d.level < 0.8) continue;
      const touches = (() => {
        for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++)
          if (home.members.includes(g.grid.neighbours[k]!)) return true;
        return false;
      })();
      if (!touches || !(world.rng.real(FIGHT, c, t, 7) < 0.1 * d.level)) continue;
      const causes: CauseRef[] = d.cause ? [{ ref: d.cause, role: "pressure", weight: 1 }] : [];
      const rose = world.events.emit({
        type: WAR_EVENTS.rebellion.type,
        subjects: [p.ref, home.ref],
        place: cellRef(0, c),
        causes,
        data: { a: realmName(p), b: realmName(home) },
      });
      realms.leave(p, c);
      realms.join(home, c);
      realms.setDiscontent(c, { level: 0.2, cause: d.cause });
      cutOff(ctx, p, rose);
    }
  // The wars that ended this year will not change again: fold them into the digest.
  wars.seal();
  // (Their battles' town tallies are kept FELL_TOWN_YEARS, their lands' for good.)
  wars.forgetTowns(year - FELL_TOWN_YEARS);
}

/** Teach a peopled world its wars. */
export function installWar(world: World, ctx: () => PopulationContext): WarStore {
  const store = world.register(new WarStore());
  world.register(new ArmsStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "185.war.year", every: YEAR, run: (t) => warYear(ctx(), t) });
  return store;
}
