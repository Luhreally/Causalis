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
  PinnedCodes,
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
  fellColumns,
  fellOfColumns,
  sightTerm,
  unpackFell,
  resolveCombat,
  type CombatRecord,
  type FellColumns,
  type LandFell,
} from "../../rules/index.ts";
import { designsOf } from "../design/design.ts";
import { grieve } from "../acts/disasters.ts";
import {
  fleetOf,
  payForRockets,
  strikeTown,
  targetsOf,
  throwAt,
  thrownAtOf,
  throwerOf,
  type Fleet,
  type Thrower,
} from "./air.ts";
import { ArmsStore, armsOf } from "./arms.ts";
import { farYear, installFar } from "./far.ts";
import { fireYear, holdBack, installFire } from "./fire.ts";
import {
  COLD_BATTLES,
  ColdWar,
  ColdWars,
  fellAgainstLast,
  fellFromLast,
  foughtAgain,
  givesItsExchanges,
  strengthsThatGiveIt,
  termsOf,
  type BattleDraw,
  type KeptStrength,
  type Terms,
} from "./coldwars.ts";
import {
  FELL_TOWN_YEARS,
  battleRecord,
  bodySize,
  fieldOf,
  hostTerms,
  type Bore,
  type HostTerms,
  type Take,
} from "./fell.ts";
import { FALL_PURPOSE, fighting, levyOf, type Levy, type Pool } from "./levy.ts";
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
import { driveHerds } from "../ecology/herds.ts";
import { GENERAL } from "../polity/polity.ts";
import {
  bindPeace,
  bondsOf,
  bondsYear,
  chooseAim,
  goesForPrize,
  installBonds,
  reckonPeace,
  sack,
  takesLand,
  type PeaceTerms,
} from "./bonds.ts";
import type { AimKind } from "../../rules/index.ts";

export const WAR = defineKind("war", "war", "minted");

export const WAR_EVENTS = {
  declared: defineEventType("war.declared", 6),
  battle: defineEventType("war.battle", 4),
  taken: defineEventType("war.taken", 5),
  rebellion: defineEventType("war.rebellion", 5),
  peace: defineEventType("war.peace", 5),
  /** A town struck from the air (W2): its town first among its subjects, as a fire's is. */
  strike: defineEventType("war.strike", 5),
};

/** A town struck from the air in a war (War past the line, W2): kept in the war store, and packed by column. */
export type WarStrike = {
  readonly war: Ref;
  readonly year: number;
  /** Who struck: 0 the attacker, 1 the defender. */
  readonly side: 0 | 1;
  readonly town: Ref;
  readonly cell: number;
  readonly dead: number;
  readonly homes: number;
  /** The food of its land that burned. */
  readonly stores: number;
  readonly flyers: number;
  readonly event: Ref;
  /** Rockets (W3; absent: machines): `flyers` then says how many were thrown at it. */
  readonly kind?: "rocket";
  /** The greatest fire (W5). */
  readonly great?: true;
  /** Where they left from, and how many landed on the town. */
  readonly from?: number;
  readonly landed?: number;
  /** The machines its land's works lost, and whether they stand idle after. */
  readonly machines?: number;
  readonly idled?: boolean;
};
/** How long a strike is kept by its town (years): after that, only in its war's tally. */
export const STRIKE_YEARS = 200;
/** What strikes came to in a war: how many, and the dead on the attacker's side and on the defender's, the homes down. */
export type StrikeTally = readonly [
  strikes: number,
  onAttacker: number,
  onDefender: number,
  homes: number,
];

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
  /** The exchanges that resolved this battle, shared with its field view. Absent in older saves. */
  readonly combat?: CombatRecord;
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
/** A war's aim among the reasons for it, in the words of its why (a land wanted has its own). */
const AIM_FACTOR: Readonly<Record<AimKind, string | null>> = {
  land: null,
  stores: "the hunger for their stores",
  back: "a land they lost to them",
  holy: "a holy war on unbelievers",
  tribute: "the tribute they would have of them",
  free: "an oath they would throw off",
};
/** Years after a peace before a realm is as ready for war as it was. */
export const WEARY_YEARS = 30;
const FIGHT = defineStream("war.fight");
/** How many years between looking for wars to put away. */
const FREEZE_EVERY = 10;
/** How many of a save's warm battles to prove in a year, so that going cold costs no year after a load. */
const PROVED_A_YEAR = 400;

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

/**
 * A battle as kept in a save: its tallies by land and town by column, what the rules give again
 * left out (fellColumns); in older saves, packed (packFell) or whole.
 */
type KeptBattle = Omit<Battle, "fell"> & {
  readonly fellColumns?: readonly [FellColumns, FellColumns];
  readonly fellPacked?: readonly [readonly number[], readonly number[]];
  /** The strengths its exchanges were fought at, in their place (see WarStore.keepWarm). */
  readonly strengths?: readonly [number, number];
};

/**
 * A battle to keep: its tallies by column where its fallen and wounded let them be read back as
 * they are (a battle whose tallies the rules would not give again is kept whole).
 */
function keep(b: Battle): Battle | KeptBattle {
  if (!b.fell || !b.wounded) return b;
  const { fell, ...rest } = b,
    kept: KeptBattle = {
      ...rest,
      fellColumns: [fellColumns(fell[0], b.fallen[0]), fellColumns(fell[1], b.fallen[1])],
    };
  return sameFell(unkeep(kept).fell!, fell) ? kept : b;
}

/** A kept battle read back (a save from before the packing keeps its tallies whole). */
function unkeep(b: Battle | KeptBattle): Battle {
  if ("fellColumns" in b && b.fellColumns && b.wounded) {
    const { fellColumns: kept, ...rest } = b;
    return {
      ...rest,
      fell: [
        fellOfColumns(kept[0], b.fallen[0], b.wounded[0]),
        fellOfColumns(kept[1], b.fallen[1], b.wounded[1]),
      ],
    };
  }
  if (!("fellPacked" in b) || !b.fellPacked || !b.wounded) return b as Battle;
  const { fellPacked, ...rest } = b;
  return {
    ...rest,
    fell: [unpackFell(fellPacked[0], b.wounded[0]), unpackFell(fellPacked[1], b.wounded[1])],
  };
}

/** Whether two battles' tallies are the same, number for number (and land for land). */
function sameFell(a: NonNullable<Battle["fell"]>, b: NonNullable<Battle["fell"]>): boolean {
  for (let s = 0; s < 2; s++) {
    const x = a[s]!,
      y = b[s]!;
    if (x.length !== y.length) return false;
    for (let k = 0; k < x.length; k++) {
      const p = x[k]!,
        q = y[k]!;
      if (p.length !== q.length) return false;
      for (let j = 0; j < 4; j++) if (p[j] !== q[j]) return false;
      const pt = p[4],
        qt = q[4];
      if (pt === undefined || qt === undefined) {
        if (pt !== qt) return false;
        continue;
      }
      if (pt.length !== qt.length) return false;
      for (let j = 0; j < pt.length; j++) if (pt[j] !== qt[j]) return false;
    }
  }
  return true;
}

/** A land's tally without its towns: the first four elements (rules/apportion.ts LandFell). */
function strip(lands: readonly LandFell[]): LandFell[] {
  return lands.map(([cell, sent, dead, hurt]): LandFell => [cell, sent, dead, hurt]);
}

export class WarStore implements StateStore {
  readonly name = "war.wars";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  /** How many battles fill a block (tests make it few, so that blocks fill). */
  coldBattles = COLD_BATTLES;
  /** All wars, in the order they were declared. */
  private list: War[] = [];
  /** Those not gone cold, in the same order: all that a year reads (see hot). */
  private warm: War[] = [];
  /** The wars gone cold (sim/war/coldwars.ts). */
  private readonly cold = new ColdWars();
  /** Each side's terms for the battles still warm: what their exchanges will be proved by. */
  private readonly terms = new Map<string, readonly [Terms, Terms]>();
  /** The battles proved to give their exchanges again (a cache: proved again if asked). */
  private readonly proved = new Set<string>();
  /**
   * What a battle's exchanges are kept at when it goes cold: a cache, made as a battle is fought
   * (proved at the last if it is not here: a save just loaded).
   */
  private readonly proofs = new Map<string, readonly [KeptStrength, KeptStrength]>();
  /** A save's warm battles not yet proved, the oldest last: a few a year (proveSome). */
  private toProve: { readonly w: War; readonly b: Battle }[] = [];
  /** The body the world's people fight in, as those terms were read against it. */
  private size = 0;
  /** The same wars by ref. */
  private readonly byRef = new Map<string, War>();
  /**
   * The same wars by each realm that fought them, attacker or defender, in the order they were
   * declared (a cache, never saved: what reads one realm's wars need not walk every war fought).
   */
  private readonly byRealm = new Map<string, War[]>();
  /** Those not gone cold, likewise. */
  private readonly warmByRealm = new Map<string, War[]>();
  /** Wars that ended are folded into a digest once, at the end of their year, and not hashed again. */
  private digest = "";
  private readonly sealed = new Set<string>();
  /** Each battle's tallies by land and town, folded in once, as it is fought (Phase 55 M224). */
  private fellDigest = "";
  /** The strikes from the air of the last STRIKE_YEARS, in the order they fell, and each war's tally of all its strikes (W2). */
  private strikes: WarStrike[] = [];
  private readonly strikeTally = new Map<string, StrikeTally>();
  /** Every strike folded in once, as it falls. */
  private strikeDigest = "";
  /** How many rockets each war's sides have thrown in all, those that fell wide too (W3). */
  private readonly thrownTally = new Map<string, number>();

  /** How a battle's draws are had again (given when the world installs its wars). */
  drawn(draw: BattleDraw): void {
    this.cold.draw = draw;
  }

  /** The same, for a store loaded beside this one. */
  get draws(): BattleDraw {
    return this.cold.draw!;
  }

  /**
   * What a battle's two hosts fought with, as its exchanges read it: kept while it is warm. Proved
   * now that they give it again, while it is one more exchange among a year's (see proofs).
   */
  noteTerms(w: War, b: Battle, a: HostTerms, c: HostTerms, size: number): void {
    const terms = [termsOf(a), termsOf(c)] as const,
      draw = this.cold.draw;
    this.terms.set(b.event, terms);
    this.size = size;
    if (!draw || !b.combat) return;
    const kept = strengthsThatGiveIt(w, b, terms, size, draw);
    if (kept) this.proofs.set(b.event, kept);
  }

  /** A few more of a save's warm battles proved (see proofs). */
  proveSome(most: number): void {
    const draw = this.cold.draw;
    if (!draw) return;
    while (most-- > 0 && this.toProve.length) {
      const { w, b } = this.toProve.pop()!,
        terms = this.terms.get(b.event),
        kept = terms && strengthsThatGiveIt(w, b, terms, this.size, draw);
      if (kept) this.proofs.set(b.event, kept);
    }
  }

  /**
   * A battle still warm as a save keeps it: its tallies by column (keep), and its exchanges not at
   * all where the rules give them again from its strengths, once that is proved.
   */
  private keepWarm(w: War, b: Battle): Battle | KeptBattle {
    const kept = keep(b),
      terms = this.terms.get(b.event);
    if (!b.combat || !terms) return kept;
    if (!this.proved.has(b.event)) {
      if (!givesItsExchanges(w, b, terms, this.size, this.cold.draw!)) return kept;
      this.proved.add(b.event);
    }
    const { combat, ...rest } = kept;
    return { ...rest, strengths: combat!.power };
  }

  /** A battle still warm as a save kept it. */
  private unkeepWarm(w: War, kept: Battle | KeptBattle): Battle {
    const b = unkeep(kept);
    if (!("strengths" in b)) return b;
    const { strengths, ...rest } = b as Battle & { strengths: readonly [number, number] },
      made = foughtAgain(
        w,
        rest,
        strengths,
        this.terms.get(rest.event)!,
        this.size,
        this.cold.draw!,
      );
    this.proved.add(rest.event);
    return { ...rest, combat: made! };
  }

  /** Fold the wars that have ended into the digest (in ref order): they will not change again. */
  seal(): void {
    const ended = this.warm
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

  /** A strike that fell (W2). */
  noteStrike(s: WarStrike): void {
    this.strikes.push(s);
    this.strikeDigest = new Hasher().string(this.strikeDigest).value(s).hex();
    const [n, a, d, h] = this.strikeTally.get(s.war) ?? [0, 0, 0, 0];
    this.strikeTally.set(s.war, [
      n + 1,
      a + (s.side === 1 ? s.dead : 0),
      d + (s.side === 0 ? s.dead : 0),
      h + s.homes,
    ]);
  }

  /** Rockets a war's sides threw this year (W3): all of them, whatever became of them. */
  noteThrown(war: Ref, rockets: number): void {
    this.thrownTally.set(war, (this.thrownTally.get(war) ?? 0) + rockets);
    this.strikeDigest = new Hasher().string(this.strikeDigest).string(war).int(rockets).hex();
  }

  /** How many rockets a war's sides have thrown (W3). */
  thrownIn(war: Ref): number {
    return this.thrownTally.get(war) ?? 0;
  }

  /** The strikes kept, in the order they fell (those of the last STRIKE_YEARS). */
  allStrikes(): readonly WarStrike[] {
    return this.strikes;
  }

  /** What a war's strikes came to (null: it struck no one). */
  tallyOfStrikes(war: Ref): StrikeTally | null {
    return this.strikeTally.get(war) ?? null;
  }

  /** Let go of strikes older than `before`: their wars' tallies keep what they came to. */
  forgetStrikes(before: number): void {
    let k = 0;
    while (k < this.strikes.length && this.strikes[k]!.year < before) k++;
    if (k) this.strikes = this.strikes.slice(k);
  }

  /**
   * Let go of the town tallies of the battles fought before `before` in the wars that have ended
   * (their lands' are kept for good). Nothing hashed changes: the tallies were folded in as fought.
   */
  forgetTowns(before: number): void {
    for (const w of this.warm) {
      if (!this.sealed.has(w.ref)) continue;
      for (let k = 0; k < w.battles.length; k++) {
        const b = w.battles[k]!;
        if (b.year < before && b.fell?.some((side) => side.some((land) => land.length > 4)))
          w.battles[k] = { ...b, fell: [strip(b.fell[0]), strip(b.fell[1])] };
      }
    }
  }

  /**
   * The wars that have been over since before `before`, all their battles too, go cold, a block's
   * worth at a time (the rest wait for more). Nothing a year does reads them after: see hot. `size`
   * is the body the world's people fight in.
   */
  freeze(before: number, size: number): void {
    const ready: War[] = [];
    let battles = 0;
    for (const w of this.warm) {
      if (!this.goneBy(w, before)) continue;
      ready.push(w);
      battles += w.battles.length;
    }
    if (battles < this.coldBattles) return;
    // Where each stands among all wars (the warm keep the order of all).
    const at = new Map<War, number>();
    let next = 0;
    for (const w of ready) {
      while (this.list[next] !== w) next++;
      at.set(w, next);
    }
    let from = 0;
    const gone = new Set<War>();
    while (battles >= this.coldBattles) {
      const block: { war: War; at: number }[] = [];
      let held = 0;
      while (held < this.coldBattles && from < ready.length) {
        const w = ready[from++]!;
        block.push({ war: w, at: at.get(w)! });
        held += w.battles.length;
      }
      battles -= held;
      const cold = this.cold.freeze(block, (event) => this.terms.get(event), size, this.proofs);
      for (let k = 0; k < block.length; k++) {
        const w = block[k]!.war;
        this.becomeCold(w, cold[k]!);
        gone.add(w);
      }
    }
    this.warm = this.warm.filter((w) => !gone.has(w));
    for (const [realm, wars] of this.warmByRealm) {
      const left = wars.filter((w) => !gone.has(w));
      if (left.length) this.warmByRealm.set(realm, left);
      else this.warmByRealm.delete(realm);
    }
  }

  /** Whether a war is past all a year reads, and may go into a block. */
  private goneBy(w: War, before: number): boolean {
    return (
      w.ended !== null &&
      w.ended < before &&
      this.sealed.has(w.ref) &&
      (w.battles.at(-1)?.year ?? -Infinity) < before &&
      ColdWars.fits(w)
    );
  }

  /** What knew a war as it was knows it cold. */
  private becomeCold(w: War, cold: ColdWar): void {
    this.list[cold.at] = cold;
    this.byRef.set(w.ref, cold);
    for (const realm of w.attacker === w.defender ? [w.attacker] : [w.attacker, w.defender]) {
      const wars = this.byRealm.get(realm)!;
      wars[wars.indexOf(w)] = cold;
    }
    this.sealed.delete(w.ref);
    for (const b of w.battles) {
      this.proofs.delete(b.event);
      this.terms.delete(b.event);
      this.proved.delete(b.event);
    }
  }

  add(w: War): void {
    this.list.push(w);
    this.warm.push(w);
    this.byRef.set(w.ref, w);
    this.index(w, this.byRealm);
    this.index(w, this.warmByRealm);
  }

  /** A war under each realm that fights it (once, should a realm be on both sides). */
  private index(w: War, by: Map<string, War[]>): void {
    for (const realm of w.attacker === w.defender ? [w.attacker] : [w.attacker, w.defender]) {
      const wars = by.get(realm);
      if (wars) wars.push(w);
      else by.set(realm, [w]);
    }
  }

  /** Every war ever fought, in the order they were declared: for pages. */
  all(): readonly War[] {
    return this.list;
  }

  /**
   * The wars not gone cold, in the order they were declared: all that any year has to read.
   * A cold war has been over more than FELL_TOWN_YEARS, and so have its battles: its peace has
   * stopped weighing on its realms, and nothing asks after a battle that old.
   */
  hot(): readonly War[] {
    return this.warm;
  }

  /** A realm's wars not gone cold, attacker or defender, in the order they were declared. */
  hotOf(realm: Ref): readonly War[] {
    return this.warmByRealm.get(realm) ?? [];
  }

  /** The battles fought in the years [from, to), in the order of their wars, each war's as fought. */
  battlesIn(from: number, to: number): { war: War; b: Battle }[] {
    const out: { war: War; b: Battle }[] = [],
      cold = this.cold.warsIn(from, to);
    for (const w of cold.size ? this.list : this.warm) {
      if (w instanceof ColdWar && !cold.has(w)) continue;
      for (const b of w.battles) if (b.year >= from && b.year < to) out.push({ war: w, b });
    }
    return out;
  }

  /** A battle by its event: its war, where it stands in it (null: none such). */
  battleBy(event: string): { war: War; k: number; b: Battle } | null {
    const wars = this.warm;
    for (let i = wars.length - 1; i >= 0; i--) {
      const w = wars[i]!;
      for (let k = w.battles.length - 1; k >= 0; k--)
        if (w.battles[k]!.event === event) return { war: w, k, b: w.battles[k]! };
    }
    return this.cold.battleBy(event);
  }

  get(ref: Ref): War | undefined {
    return this.byRef.get(ref);
  }

  /** A realm's wars, attacker or defender, ended or not, in the order they were declared. */
  of(realm: Ref): readonly War[] {
    return this.byRealm.get(realm) ?? [];
  }

  /** The wars a realm is fighting now. */
  fighting(realm: Ref): War[] {
    return this.hotOf(realm).filter(
      (w) => w.ended === null && (w.attacker === realm || w.defender === realm),
    );
  }

  between(a: Ref, b: Ref): War | undefined {
    // (Among a's wars, in the order they were declared: the first of all wars that matches.)
    return this.hotOf(a).find(
      (w) =>
        w.ended === null &&
        ((w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a)),
    );
  }

  pinned(): (Ref | PinnedCodes)[] {
    const refs: (Ref | PinnedCodes)[] = [];
    let run: number[] | null = null;
    for (const w of this.list) {
      if (w instanceof ColdWar) {
        if (!run) refs.push(new PinnedCodes((run = [])));
        w.pins(run);
        continue;
      }
      run = null;
      refs.push(w.event);
      if (w.peace) refs.push(w.peace);
      for (const b of w.battles) refs.push(b.event);
    }
    for (const s of this.strikes) refs.push(s.event);
    return refs;
  }

  hashInto(h: Hasher): void {
    h.string(this.digest);
    // (A battle's town tallies are hashed once, as it is fought: the yearly hash does not grow
    // with them, and letting them go changes nothing hashed.)
    if (this.fellDigest) h.string(this.fellDigest);
    if (this.strikeDigest) h.string(this.strikeDigest);
    h.value(this.warm.filter((w) => !this.sealed.has(w.ref)).map(bare));
  }

  save(): unknown {
    return {
      // (A battle's tallies by land and town are kept packed: what the rules give again is left out.)
      wars: fellAgainstLast(
        this.warm.map((w) => ({ ...w, battles: w.battles.map((b) => this.keepWarm(w, b)) })),
      ),
      against: true,
      digest: this.digest,
      sealed: [...this.sealed].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
      fellDigest: this.fellDigest,
      ...(this.terms.size ? { terms: [...this.terms], size: this.size } : {}),
      ...(this.cold.blocks.length ? { cold: this.cold.save() } : {}),
      ...(this.strikeDigest
        ? {
            strikes: this.strikes,
            strikeTally: [...this.strikeTally].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
            strikeDigest: this.strikeDigest,
            ...(this.thrownTally.size
              ? { thrown: [...this.thrownTally].sort((a, b) => (a[0] < b[0] ? -1 : 1)) }
              : {}),
          }
        : {}),
    };
  }

  load(state: unknown): void {
    // (A save from before Phase 63 keeps every war warm, and they go cold as they may.)
    const t = state as {
        digest?: string;
        sealed?: string[];
        fellDigest?: string;
        terms?: [string, [Terms, Terms]][];
        size?: number;
        cold?: unknown;
        against?: boolean;
        strikes?: WarStrike[];
        strikeTally?: [string, StrikeTally][];
        strikeDigest?: string;
        thrown?: [string, number][];
      },
      cold = this.cold.load(t.cold ?? { blocks: [], words: [] }),
      wars = (state as { wars: War[] }).wars;
    this.size = t.size ?? 0;
    this.terms.clear();
    this.proved.clear();
    this.proofs.clear();
    for (const [event, terms] of t.terms ?? []) this.terms.set(event, terms);
    this.warm = (t.against ? fellFromLast<Battle, War>(wars) : wars).map((w) => ({
      ...w,
      battles: w.battles.map((b) => this.unkeepWarm(w, b)),
      fallen: [...w.fallen] as [number, number],
    }));
    this.toProve = this.warm.flatMap((w) => w.battles.map((b) => ({ w, b }))).reverse();
    // Each cold war where it stood, and the warm in order about them.
    this.list = new Array<War>(this.warm.length + cold.length);
    for (const w of cold) this.list[w.at] = w;
    let next = 0;
    for (const w of this.warm) {
      while (this.list[next]) next++;
      this.list[next] = w;
    }
    this.byRef.clear();
    this.byRealm.clear();
    this.warmByRealm.clear();
    for (const w of this.list) {
      this.byRef.set(w.ref, w);
      this.index(w, this.byRealm);
    }
    for (const w of this.warm) this.index(w, this.warmByRealm);
    this.digest = t.digest ?? "";
    this.sealed.clear();
    for (const r of t.sealed ?? []) this.sealed.add(r);
    this.fellDigest = t.fellDigest ?? "";
    // (A save from before W2 has none.)
    this.strikes = t.strikes ?? [];
    this.strikeTally.clear();
    for (const [war, tally] of t.strikeTally ?? []) this.strikeTally.set(war, tally);
    this.strikeDigest = t.strikeDigest ?? "";
    this.thrownTally.clear();
    for (const [war, n] of t.thrown ?? []) this.thrownTally.set(war, n);
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

/**
 * A side's machines go over: as many towns of the foe's as lie in reach of the front and hurt it most,
 * the machines shared among them (W2). Each strike an event with the war as its cause. No draws.
 */
function raids(
  ctx: PopulationContext,
  w: War,
  side: 0 | 1,
  fleet: Fleet,
  foe: Polity,
  by: Polity,
  front: number,
  t: SimTime,
): void {
  if (fleet.mj <= 0) return;
  const { world, generated: g } = ctx,
    chord = fleet.flyer.reachKm / (6371 * g.planet.radius),
    targets = targetsOf(ctx, foe, front, chord);
  if (!targets.length) return;
  const each = Math.max(1, Math.floor(fleet.flyers / targets.length)),
    wars = warsOf(world),
    year = yearOfMoment(t);
  for (const target of targets) {
    const done = strikeTown(ctx, target, fleet, each, t);
    if (done.homes <= 0 && done.dead <= 0) continue;
    const event = world.events.emit({
      type: WAR_EVENTS.strike.type,
      subjects: [target.ref, w.ref, by.ref, foe.ref],
      place: ctx.provinces.get(target.cell)!.ref,
      causes: [{ ref: w.event, role: "trigger", weight: 1 }],
      data: {
        name: target.name,
        a: realmName(by),
        b: realmName(foe),
        dead: done.dead,
        homes: done.homes,
        stores: done.stores,
        flyers: each,
        span: Math.round(fleet.flyer.spanM * 10) / 10,
        speed: Math.round(fleet.flyer.speed),
      },
    });
    wars.noteStrike({
      war: w.ref,
      year,
      side,
      town: target.ref,
      cell: target.cell,
      dead: done.dead,
      homes: done.homes,
      stores: done.stores,
      flyers: each,
      event,
    });
    if (done.dead > 0)
      grieve(
        world,
        target.cell,
        Math.min(0.05, (done.dead / Math.max(1, ctx.provinces.get(target.cell)!.total())) * 2),
        event,
      );
  }
}

/**
 * A side's rockets go over (W3): at as many towns of the foe's as lie in their reach and hurt it most, wherever
 * the front is, shared among them. They leave from its land nearest the front. Each fall an event with the war
 * as its cause, read by a town's roll and page as a raid is. No draws.
 */
function thrown(
  ctx: PopulationContext,
  w: War,
  side: 0 | 1,
  t2: Thrower,
  foe: Polity,
  by: Polity,
  front: number,
  t: SimTime,
): void {
  const { world, generated: g } = ctx,
    p = g.grid.positions,
    radiusKm = 6371 * g.planet.radius;
  let from = by.seat,
    near = Infinity;
  for (const c of by.members) {
    const dx = p[3 * c]! - p[3 * front]!,
      dy = p[3 * c + 1]! - p[3 * front + 1]!,
      dz = p[3 * c + 2]! - p[3 * front + 2]!,
      d = dx * dx + dy * dy + dz * dz;
    if (d < near || (d === near && c < from)) {
      near = d;
      from = c;
    }
  }
  const targets = thrownAtOf(ctx, foe, from, t2, radiusKm);
  if (!targets.length) return;
  const wars = warsOf(world),
    year = yearOfMoment(t),
    each = Math.max(1, Math.floor(t2.rockets / targets.length));
  payForRockets(ctx, by, t2.rockets);
  wars.noteThrown(w.ref, each * targets.length);
  for (const target of targets) {
    const done = throwAt(ctx, target, t2, each, t);
    if (done.homes <= 0 && done.dead <= 0) continue;
    const event = world.events.emit({
      type: WAR_EVENTS.strike.type,
      subjects: [target.ref, w.ref, by.ref, foe.ref],
      place: ctx.provinces.get(target.cell)!.ref,
      causes: [{ ref: w.event, role: "trigger", weight: 1 }],
      data: {
        name: target.name,
        a: realmName(by),
        b: realmName(foe),
        dead: done.dead,
        homes: done.homes,
        stores: done.stores,
        flyers: each,
        rocket: true,
        from,
        km: Math.round(target.km),
        landed: Math.round(done.landed * 10) / 10,
        machines: done.machines,
        idled: done.idled,
        speed: Math.round(t2.rocket.speed),
      },
    });
    wars.noteStrike({
      war: w.ref,
      year,
      side,
      town: target.ref,
      cell: target.cell,
      dead: done.dead,
      homes: done.homes,
      stores: done.stores,
      flyers: each,
      event,
      kind: "rocket",
      from,
      landed: Math.round(done.landed * 10) / 10,
      machines: done.machines,
      idled: done.idled,
    });
    if (done.dead > 0)
      grieve(
        world,
        target.cell,
        Math.min(0.05, (done.dead / Math.max(1, ctx.provinces.get(target.cell)!.total())) * 2),
        event,
      );
  }
}

/** The year's wars: declarations, a battle in each war, rebellions, peace. */
export function warYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    wars = warsOf(world),
    realms = politiesOf(world),
    diplomacy = diplomacyOf(world),
    culture = cultureOf(world),
    lore = loreOf(world),
    bonds = bondsOf(world),
    year = yearOfMoment(t);

  // What peace left behind: what falls due and runs out, who stops paying, who rises (W7).
  bondsYear(ctx, t);

  // 1. Declarations: rivals, and realms who covet a neighbour's stores in a famine.
  // A realm fresh from war is slow to go to war again: its fallen are still mourned.
  const lastPeace = new Map<string, War>(),
    fighting = new Set<string>();
  // (A peace past FELL_TOWN_YEARS weighs no more, so the cold wars need no reading: see hot.)
  for (const w of wars.hot()) {
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
    // (A truce, a tribute or an oath holds the two from war while it runs: W7.)
    if (bonds.between(r.a, r.b)) continue;
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
    // (One who has sworn an oath declares no war of its own: W7.)
    if (bonds.oathOf(attacker.ref)) continue;
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
    const front = frontier(ctx, attacker, defender);
    if (!front.length) continue;
    // Its people's voices: traders who want peace with those they trade with hold it
    // back; a temple that wants war on unbelievers urges it on.
    const voices = interestsOf(ctx, attacker, t),
      peace = pressure(voices, "peace", defender.ref),
      holy = pressure(voices, "war", defender.ref),
      swayed = (1 - 0.7 * Math.min(1, 2 * peace.total)) * (1 + Math.min(1, 2 * holy.total)),
      // (What their answer would cost, W5: exactly 1 where the other holds no great fire.)
      answer = holdBack(ctx, attacker, defender, year),
      chance = base * swayed * answer;
    if (chance <= 0 || !(draw < chance)) continue;
    // What it is about, read off what drove it, and the land it goes for (W7).
    const chosen = chooseAim(
        ctx,
        attacker,
        defender,
        r,
        !!covets,
        pressure(
          voices.filter((i) => i.group === "the temple"),
          "war",
          defender.ref,
        ).total,
        pressure(voices, "more tribute").total,
        ratio,
        front,
      ),
      prize = chosen.prize,
      aimName = AIM_FACTOR[chosen.aim.aim];
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
    if (aimName)
      factors.push({
        name: aimName,
        value: 1,
        contribution: 0.45,
        source: chosen.source ? { ref: chosen.source, role: "pressure", weight: 1 } : null,
      });
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
    if (answer < 1)
      factors.push({
        name: "what their answer would cost",
        value: answer,
        contribution: answer - 1,
        source: null,
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
      outcome: { against: defender.ref, prize, aim: chosen.aim.aim },
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
        data: {
          a: realmName(attacker),
          b: realmName(defender),
          ...chosen.aim,
          ...(goesForPrize(chosen.aim.aim) ? { aimed: true } : {}),
        },
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
  for (const w of wars.hot()) {
    if (w.ended !== null || w.declared === year) continue;
    const a = realms.get(w.attacker)!,
      b = realms.get(w.defender)!;
    if (a.ended !== null || b.ended !== null) {
      w.ended = year;
      if (w.civil) settleCivil(ctx, w, false, false, t);
      continue;
    }
    // (A ruler's aim, Lives L4: the land named is fought for while it can be reached.)
    const front = frontier(ctx, a, b),
      declared = world.events.get(w.event)?.data as { aimed?: boolean; aim?: AimKind } | null,
      aimed = declared?.aimed === true,
      aim = declared?.aim,
      land = aimed && front.includes(w.prize) ? w.prize : front[0];
    if (land === undefined) {
      // No land left between them to fight over: the war ends, and history says so, with what it came to (W7).
      w.ended = year;
      const made = w.civil
        ? null
        : reckonPeace(ctx, w, a, b, aim, a.members.includes(w.prize), year);
      w.peace = world.events.emit({
        type: WAR_EVENTS.peace.type,
        subjects: [w.ref, a.ref, b.ref],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: [{ ref: w.event, role: "trigger", weight: 1 }],
        data: {
          a: realmName(a),
          b: realmName(b),
          years: year - w.declared,
          won: false,
          ...(made ? { terms: made.terms } : {}),
        },
      });
      if (made) bindPeace(ctx, w, made, w.peace, year);
      if (w.civil) settleCivil(ctx, w, false, false, t);
      continue;
    }
    // (From the air, W2: what each side flies, and first its strikes, before the armies meet. Neither has
    // any before the first machine is found: the terms below are then exactly 1.)
    const fleetA = fleetOf(ctx, a, () => fieldedOf(ctx, a)),
      fleetB = fleetOf(ctx, b, () => fieldedOf(ctx, b));
    if (fleetA) raids(ctx, w, 0, fleetA, b, a, land, t);
    if (fleetB) raids(ctx, w, 1, fleetB, a, b, land, t);
    // (And its rockets, W3: at what feeds the fight, not only at the front. None before the first is found.)
    const throwA = throwerOf(ctx, a, () => fieldedOf(ctx, a)),
      throwB = throwerOf(ctx, b, () => fieldedOf(ctx, b));
    if (throwA) thrown(ctx, w, 0, throwA, b, a, land, t);
    if (throwB) thrown(ctx, w, 1, throwB, a, b, land, t);
    // (A host on a land's ground drives off what it can: Z1.)
    driveHerds(ctx, w.ref, w.event, a, b, land, t);
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
        (overseas(ctx, a, land) ? LANDING : 1) *
        sightTerm(fleetA?.flyers ?? 0, fleetB?.flyers ?? 0),
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
      { entrench } = fireTerms(armsA, armsB),
      defend =
        strengthOf(ctx, b) *
        1.5 *
        (seat ? 2 : 1) *
        hills *
        river *
        walls *
        (chestB ? CREDIT.chest : 1) *
        entrench *
        sightTerm(fleetB?.flyers ?? 0, fleetA?.flyers ?? 0);
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
      draws = (round: number, side: number) => world.rng.real(FIGHT, key, t, 100 + round, side),
      combatSides = [
        { ...termsA, fielded: fielded[0], power: attack },
        { ...termsB, fielded: fielded[1], power: defend },
      ] as const,
      resolved = resolveCombat(combatSides, bodySize(ctx), draws),
      won = resolved.won,
      // The same exchanges with equal equipment: only the material advantage is removed.
      even = resolveCombat(
        [
          { ...combatSides[0], power: attack / Math.max(0.01, armsA.power) },
          { ...combatSides[1], power: defend / Math.max(0.01, armsB.power * entrench) },
        ],
        bodySize(ctx),
        draws,
      ),
      tip = won !== even.won,
      tipped = tip ? designsOf(world).of((won ? a : b).ref)?.event : undefined,
      [deadA, deadB] = resolved.dead,
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
      combat: resolved.combat,
      ...record,
    };
    w.battles.push(fought);
    wars.noteFell(fought);
    wars.noteTerms(w, fought, termsA, termsB, bodySize(ctx));
    // A seat is not taken in a day: the first victory there lays a siege, the second takes it.
    const besieged = seat && won && !w.battles.slice(0, -1).some((x) => x.land === land && x.won);
    // (A host come for grain carries it off; come for tribute, or to be free, it leaves the land where it lies: W7.)
    const hauled = won && aim === "stores" ? sack(ctx, a, b, land, battle) : 0;
    if (won && !besieged && takesLand(aim)) {
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
      // (Those a strike killed weigh as those who fell: W2.)
      struck = wars.tallyOfStrikes(w.ref),
      weary =
        w.fallen[0] / Math.max(1, peopleA) +
        w.fallen[1] / Math.max(1, peopleA) +
        (struck ? (struck[1] + struck[2]) / Math.max(1, peopleA) : 0),
      years = year - w.declared,
      prizeWon = a.members.includes(w.prize),
      // (What it came for, W7, where that is not a land: the grain carried off, the field won.)
      got =
        hauled > 0 ||
        (won &&
          (aim === "free" ||
            (aim === "tribute" && 2 * w.battles.filter((x) => x.won).length > w.battles.length)));
    // A beaten attacker often gives up; a won prize, a weary people or long years end it too.
    const repulsed = resolved.combat.broken === 0 && world.rng.real(FIGHT, key, t, 6) < 0.5;
    if (
      prizeWon ||
      got ||
      repulsed ||
      weary > 0.02 ||
      years >= 6 ||
      world.rng.real(FIGHT, key, t, 5) < 0.12
    ) {
      w.ended = year;
      // (Its terms, where both still stand and it was not a realm's war with itself; else, who is no more: W7.)
      const made =
          !w.civil && a.ended === null && b.ended === null
            ? reckonPeace(ctx, w, a, b, aim, prizeWon || got, year)
            : null,
        gone: PeaceTerms | null =
          !w.civil && !made ? { kind: "fell", payer: realmName(a.ended !== null ? a : b) } : null;
      w.peace = world.events.emit({
        type: WAR_EVENTS.peace.type,
        subjects: [w.ref, a.ref, b.ref],
        place: ctx.provinces.get(a.seat)?.ref ?? null,
        causes: [{ ref: battle, role: "trigger", weight: 1 }],
        data: {
          a: realmName(a),
          b: realmName(b),
          years,
          won: prizeWon || got,
          ...(made ? { terms: made.terms } : gone ? { terms: gone } : {}),
        },
      });
      if (made) bindPeace(ctx, w, made, w.peace, year);
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
  // The greatest fire's year (W5): works, the brink, what falls and what the sky does after.
  fireYear(ctx, t);
  // And past the town's (W6): a fire carried, a sky, a world.
  farYear(ctx, t);
  // The wars that ended this year will not change again: fold them into the digest.
  wars.seal();
  // (Their battles' town tallies are kept FELL_TOWN_YEARS, their lands' for good.)
  wars.forgetTowns(year - FELL_TOWN_YEARS);
  wars.forgetStrikes(year - STRIKE_YEARS);
  // (And those long over go out of the way, a little at a time: see coldwars.ts.)
  wars.proveSome(PROVED_A_YEAR);
  if (year % FREEZE_EVERY === 0) wars.freeze(year - FELL_TOWN_YEARS, bodySize(ctx));
}

/** Teach a peopled world its wars. */
export function installWar(world: World, ctx: () => PopulationContext): WarStore {
  const store = world.register(new WarStore());
  store.drawn((key, t, round, side) => world.rng.real(FIGHT, key, t, 100 + round, side));
  world.register(new ArmsStore());
  installBonds(world);
  installFire(world);
  installFar(world, ctx);
  world.addPinner(() => store.pinned());
  world.system({ key: "185.war.year", every: YEAR, run: (t) => warYear(ctx(), t) });
  return store;
}
