// Who a land counts its own, and how far its "us" reaches (rules/folk.ts), land by land: once in five years in the land's own year
// (as its readers are reckoned once in ten), coming a share of the way a year toward what its ties to its seat and its readers and
// word make it, and read each year where a land's grievance is (sim/polity/polity.ts readsApart) and a realm's standing
// (sim/order/order.ts addsStanding). One row a land; nothing a person, nothing that grows with history.
import { YEAR, yearOfMoment, type Factor, type SimTime, type World } from "../../kernel/index.ts";
import { tongueLikeness } from "../../gen/index.ts";
import {
  INQUIRY,
  VOICE_TOPICS,
  VOICE,
  apartGrievance,
  folkAfter,
  joinedBy,
  kinToSeat,
  nationTarget,
  onenessStanding,
  warRemembered,
  wordPace,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { politiesOf, readsApart, type Polity } from "../polity/polity.ts";
import { beliefOf } from "../belief/belief.ts";
import { knows } from "../lore/lore.ts";
import { readersOf } from "../lore/letters.ts";
import { warsOf } from "../war/war.ts";
import { addsStanding } from "../order/order.ts";
import { refNumber } from "../money/kept.ts";
import { cultureOf } from "./culture.ts";
import { FOLK_ROW, FOLK_STORE, VOICE_ROW, VOICE_STORE, cultureRows } from "./rows.ts";

/** A land weighs who its own are once in so many years, each land in its own year. */
export const FOLK_EVERY = 5;
/** Speech less alike than this is another people's (sim/culture/languages.ts APART: a language of its own). */
const OTHER_SPEECH = 0.72;
/** The most years a land's identity is carried at once (a land long unweighed: a world loaded from before the sweep). */
const MOST_YEARS = 50;

/** What a land shares with its seat now, and what its "us" would reach: the targets its identity moves toward. Only reads. */
export function folkTargets(
  ctx: PopulationContext,
  cell: number,
  realm: Polity,
  since: number,
  joined: number,
  war: boolean | number,
): {
  kin: number;
  nation: number;
  like: number;
  sameFaith: boolean;
  waysGap: number;
  years: number;
} {
  const { world } = ctx,
    culture = cultureOf(world),
    mine = culture.get(cell),
    seat = culture.get(realm.seat),
    faiths = beliefOf(world),
    year = yearOfMoment(world.now),
    span = ctx.generated.life.people?.body.span ?? 70,
    like = mine && seat ? tongueLikeness(mine.tongue, seat.tongue) : 1,
    sameFaith = faiths.of(cell).faith === faiths.of(realm.seat).faith,
    waysGap =
      mine && seat
        ? mine.traits.reduce((s, v, k) => s + Math.abs(v - seat.traits[k]!), 0) /
          Math.max(1, mine.traits.length)
        : 0,
    years = Math.max(0, year - since);
  let kin = cell === realm.seat ? 1 : kinToSeat({ like, sameFaith, waysGap, years, span });
  // (One people told by its seat and believed draws a land nearer it: sim/order/voice.ts.)
  const voice = cultureRows(world, VOICE_STORE)?.get(refNumber(realm.ref));
  if (voice && VOICE_TOPICS[voice[VOICE_ROW.topic]! - 1] === "one")
    kin = Math.min(
      1,
      kin + (VOICE.one * voice[VOICE_ROW.reach]! * Math.max(0, voice[VOICE_ROW.credence]!)) / 1e6,
    );
  return {
    kin,
    nation: nationTarget(readersOf(world, cell), joined, war),
    like,
    sameFaith,
    waysGap,
    years,
  };
}

/** How far a realm's word joins its far lands (0 … 1 of the most it can: rules/letters.ts joinedBy). */
export function realmJoined(ctx: PopulationContext, realm: Polity): number {
  return joinedBy(wordPace((id) => knows(ctx, realm.seat, id), ctx.medium).kmADay) / INQUIRY.joined;
}

/** Whether a realm is at war with one whose seat speaks another people's speech. */
export function atWarWithStrangers(world: World, realm: Polity): boolean {
  const culture = cultureOf(world),
    realms = politiesOf(world),
    mine = culture.get(realm.seat);
  if (!mine) return false;
  // (Its wars still fought: it read every war of its not yet gone cold, ended or not, so a realm stood "at war with strangers"
  // for forty years and more after its peace, until its war's block filled, and the same world with blocks of another size
  // was another world from the first block on: found by coldab.mts, first light, year 115.)
  for (const w of warsOf(world).hotOf(realm.ref)) {
    if (w.ended !== null) continue;
    const other = realms.get(w.attacker === realm.ref ? w.defender : w.attacker),
      theirs = other ? culture.get(other.seat) : undefined;
    if (theirs && tongueLikeness(mine.tongue, theirs.tongue) < OTHER_SPEECH) return true;
  }
  return false;
}

/**
 * How far a realm's "us" is sharpened by war with those whose seat speaks another people's speech (0 … 1, rules/folk.ts
 * warRemembered): wholly while one is fought, then as far as those who lived through the last are left. Only wars over fewer
 * than WAR_KEPT years are asked for: they are in the wars' store as they were fought whatever its blocks' size (one over more
 * than forty years may have gone cold or not). It read "at war" alone after reading every war not yet cold: at the first a
 * realm's "us" stood sharpened for centuries after a peace, at the second it fell back from the day of the peace, and what a
 * land ruled by strangers makes of that (rules/folk.ts apartGrievance) had been set against the first.
 */
export const WAR_KEPT = 40;
export function warWithStrangers(ctx: PopulationContext, realm: Polity, year: number): number {
  const { world } = ctx,
    culture = cultureOf(world),
    realms = politiesOf(world),
    mine = culture.get(realm.seat);
  if (!mine) return 0;
  const span = ctx.generated.life.people?.body.span ?? 70;
  let most = 0;
  for (const w of warsOf(world).hotOf(realm.ref)) {
    const over = w.ended === null ? null : year - w.ended;
    if (over !== null && over >= WAR_KEPT) continue;
    const level = warRemembered(over, span, WAR_KEPT);
    if (level <= most) continue;
    const other = realms.get(w.attacker === realm.ref ? w.defender : w.attacker),
      theirs = other ? culture.get(other.seat) : undefined;
    if (theirs && tongueLikeness(mine.tongue, theirs.tongue) < OTHER_SPEECH) most = level;
  }
  return most;
}

/** A land's kin to its seat and the reach of its "us" (0 … 1 each), as last weighed under the realm that holds it now, or null. */
export function identityOf(
  world: World,
  cell: number,
): { kin: number; nation: number; since: number } | null {
  const rows = cultureRows(world, FOLK_STORE),
    row = rows?.get(cell),
    realm = row ? politiesOf(world).of(cell) : undefined;
  if (!row || !realm || row[FOLK_ROW.realm] !== refNumber(realm.ref)) return null;
  return {
    kin: row[FOLK_ROW.kin]! / 1000,
    nation: row[FOLK_ROW.nation]! / 1000,
    since: row[FOLK_ROW.since]!,
  };
}

/** The year's identities: each peopled land of a realm in its year of five comes the years' way toward what it is drawn to. */
export function folkYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    rows = cultureRows(world, FOLK_STORE);
  if (!rows || !world.hasStore("polity.states")) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    joined = new Map<string, number>(),
    war = new Map<string, number>();
  for (const p of ctx.provinces.all()) {
    if ((year + p.cell) % FOLK_EVERY !== 0) continue;
    const realm = realms.of(p.cell);
    if (!realm || !p.total()) {
      if (rows.get(p.cell)) rows.drop(p.cell);
      continue;
    }
    const row = rows.get(p.cell),
      serial = refNumber(realm.ref),
      same = row !== undefined && row[FOLK_ROW.realm] === serial,
      // (Held since it was first weighed under this realm; a land first weighed in a realm's first years, since its founding.)
      since = same ? row[FOLK_ROW.since]! : row ? year : realm.founded;
    let j = joined.get(realm.ref);
    if (j === undefined) joined.set(realm.ref, (j = realmJoined(ctx, realm)));
    let w = war.get(realm.ref);
    if (w === undefined) war.set(realm.ref, (w = warWithStrangers(ctx, realm, year)));
    const target = folkTargets(ctx, p.cell, realm, since, j, w),
      years = row ? Math.min(MOST_YEARS, Math.max(1, year - row[FOLK_ROW.at]!)) : 0,
      // (A land first weighed, or newly under this realm, is what it is at once: who it counts its own is not learned anew.)
      kin = row ? folkAfter(row[FOLK_ROW.kin]! / 1000, target.kin, years) : target.kin,
      nation = row ? folkAfter(row[FOLK_ROW.nation]! / 1000, target.nation, years) : target.nation;
    rows.set(p.cell, [
      Math.round((same ? kin : target.kin) * 1000),
      Math.round(nation * 1000),
      serial,
      since,
      year,
    ]);
  }
}

/** How far a realm's people count themselves one with its seat, and imagine an "us" so wide: people-weighted, of lands weighed. */
export function realmFolk(
  ctx: PopulationContext,
  realm: Polity,
): { kin: number; nation: number; apart: number; weighed: number } {
  let people = 0,
    kin = 0,
    nation = 0,
    apart = 0;
  for (const c of realm.members) {
    const f = identityOf(ctx.world, c),
      n = ctx.provinces.get(c)?.total() ?? 0;
    if (!f || !n) continue;
    people += n;
    kin += n * f.kin;
    nation += n * f.nation;
    apart += n * (1 - f.kin);
  }
  return people
    ? { kin: kin / people, nation: nation / people, apart: apart / people, weighed: people }
    : { kin: 1, nation: 0, apart: 0, weighed: 0 };
}

/** A realm's standing from how far its people count themselves one with its seat. */
function folkStanding(ctx: PopulationContext, realm: Polity): Factor[] {
  const f = realmFolk(ctx, realm);
  if (!f.weighed) return [];
  const contribution = onenessStanding(f.kin, f.nation);
  return [
    {
      name:
        contribution >= 0
          ? "a people who count themselves one with its seat"
          : "lands that count its seat's people strangers",
      value: f.kin,
      contribution,
      source: null,
    },
  ];
}

/** What being ruled by those a land counts strangers breeds of grievance, as last weighed (as unlike speech alone, else). */
function apartFrom(world: World, cell: number, foreign: number): number {
  const f = identityOf(world, cell);
  return f ? apartGrievance(f.kin, f.nation) : 0.3 * foreign * foreign;
}

/** Teach a peopled world who its lands count their own. */
export function installFolk(world: World, ctx: () => PopulationContext): void {
  world.system({ key: "177.culture.folk", every: YEAR, run: (t) => folkYear(ctx(), t) });
  readsApart(apartFrom);
  addsStanding(folkStanding);
}
