// A battle's roll (Phase 55 M225): who fought it, figure by figure. Each side is drawn as so many
// figures (bridge battleFigures, the field's rule) — those that fall, its wounded who lived, the rest
// — shared out over the places its men came from, its fallen by their dead, its wounded by their
// wounded, the rest by those who came home whole. Each place's figures are named: first the town's
// line holders the battle levied (host/roster.ts), then the people met who went (the observer's war
// fates), then men of its levy named for the roll alone, in their land's tongue, by a ref that tells
// where each came from and how he came home. History keeps the counts, not the men: no list of
// every man is made, and a levy man is read back from his ref alone. A battle of an older save, with
// no record of its men, still names its levy, though not where they came from.
import { YEAR, apportion, finish, hashString, mix, type Ref, type World } from "../kernel/index.ts";
import {
  cradleTongue,
  personName,
  tongueName,
  tonguePersonName,
  type Tongue,
} from "../gen/index.ts";
import { cultureOf, politiesOf, populationContext, type Battle, type War } from "../sim/index.ts";
import { observer, settleAll, type Person, type WarFate } from "../causal/index.ts";
import {
  ROLL_DEFAULT,
  ROLL_MOST,
  battleFigures,
  levyManRef,
  parseLevyManRef,
  type BattleRoll,
  type LevyPlace,
  type RollEntry,
  type RollPlace,
  type RollSide,
} from "../bridge/index.ts";
import { nearCounts } from "./battle.ts";
import { battleOf } from "./burials.ts";
import { levyPlaces } from "./fallen.ts";
import {
  ROSTER_YEARS,
  fellLinesOf,
  hurtLinesOf,
  levyLinesOf,
  townRoster,
  type Fate,
} from "./roster.ts";

/** A side's figures in three lots: 0 those that fell, 1 its wounded who lived, 2 the rest. */
export type Lot = 0 | 1 | 2;

/** One of a battle's levy, as his ref tells him (Phase 55 M225). */
export type LevyMan = {
  readonly ref: string;
  readonly name: string;
  /** His age that day. */
  readonly age: number;
  readonly event: string;
  readonly war: string;
  readonly side: 0 | 1;
  /** The realm whose host he was of. */
  readonly realm: string;
  readonly year: number;
  /** Where the battle was fought. */
  readonly land: number;
  /** Where he came from (null: a battle with no record of its men). */
  readonly place: LevyPlace | null;
  readonly fate: Fate;
};

/** The men a lot of a place may name: well past ROLL_MOST, so an index never spills into the next lot. */
const LOT_SPAN = 65536;

const u = (seed: number, n: number) => finish(mix(seed, n), 13) / 4294967296;

/**
 * A levy man's number in his ref: his place (an index into his side's places; −1: no record), his
 * lot, and which of the lot's unnamed men of that place he is.
 */
export function encodeLevy(place: number, lot: Lot, i: number): number {
  return ((place + 1) * 3 + lot) * LOT_SPAN + i;
}

/** A levy man's number read back (null: not one). */
export function decodeLevy(j: number): { place: number; lot: Lot; i: number } | null {
  if (!Number.isSafeInteger(j) || j < 0) return null;
  const q = Math.floor(j / LOT_SPAN);
  return { place: Math.floor(q / 3) - 1, lot: (q % 3) as Lot, i: j % LOT_SPAN };
}

/** The lot a fate is told in (the maimed among the wounded). */
const lotOf = (fate: Fate): Lot => (fate === "fell" ? 0 : fate === "stood" ? 2 : 1);

/** A land's speech for its levy's names: its tongue (none: the cradle's names), and its family names'. */
type Speech = { readonly tongue: Tongue | undefined; readonly family: Tongue };
type Namer = (key: number, cell: number) => { readonly name: string; readonly age: number };

/**
 * Names for a battle's levy, by a man's key (his ref's hash) and the land he came from: a man's given
 * name in its tongue (or the cradle's), a family name in it, and an age of the levy (grown, of the
 * ages that fight). Each land's speech is read once.
 */
function namerOf(world: World): Namer {
  const ctx = populationContext(world),
    culture = cultureOf(world),
    life = ctx.life,
    years = Math.max(0, life.bands[7]! - life.adulthood),
    speeches = new Map<number, Speech>();
  return (key, cell) => {
    let speech = speeches.get(cell);
    if (!speech) {
      const tongue = culture.get(cell)?.tongue,
        family = tongue ?? cradleTongue(ctx.culture);
      speech = { tongue, family: { ...family, seed: family.seed ^ 0xf00d } };
      speeches.set(cell, speech);
    }
    const given = speech.tongue
      ? tonguePersonName(speech.tongue, key, 1)
      : personName(ctx.culture, key, 1);
    return {
      name: `${given} ${tongueName(speech.family, key >>> 3)}`,
      age: life.adulthood + Math.floor(u(key, 2) * years),
    };
  };
}

/** A levy man's name and age that day, from his ref and the land he came from. */
export function levyName(
  world: World,
  ref: string,
  cell: number,
): { readonly name: string; readonly age: number } {
  return namerOf(world)(hashString(ref), cell);
}

/** Of a side's wounded who lived, the share maimed (0 where unrecorded). */
function maimedShare(b: Battle, side: 0 | 1): number {
  const wounded = b.wounded?.[side] ?? 0;
  return wounded > 0 ? (b.maimed?.[side] ?? 0) / wounded : 0;
}

/** The land a side's levy is named in where no record tells where its men came from: its realm's seat, else the field's. */
function homeOf(world: World, realm: Ref, b: Battle): number {
  return politiesOf(world).get(realm)?.seat ?? b.land;
}

/** A lot's figures shared out over the places by weight (by men sent where no place has any weight). */
function shareOut(
  total: number,
  places: readonly LevyPlace[],
  weight: (p: LevyPlace) => number,
): number[] {
  if (total <= 0) return places.map(() => 0);
  const weights = places.map(weight);
  return apportion(
    total,
    weights.some((w) => w > 0) ? weights : places.map((p) => Math.max(1, p.sent)),
  );
}

/**
 * Whether a town's line holders could fill any of its figures here. Its levy (host/roster.ts) names
 * so many of its lines by twelves of the men it sent — no more than it has eligible — and of them
 * the fallen and the wounded by twelves of theirs, the rest standing; those counts bound the men of
 * each lot, so a town whose levy can name no man in a lot it has figures for is not folded at all
 * (the roster's own counts, levyLinesOf and the rest, so the two cannot part).
 */
function mayFill(
  event: string,
  town: string,
  p: LevyPlace,
  want: readonly [number, number, number],
): boolean {
  const levied = levyLinesOf(event, town, p.sent);
  if (levied <= 0) return false;
  const fell = fellLinesOf(event, town, p.dead);
  if (want[0] > 0 && fell > 0) return true;
  const back = levied - fell;
  if (back <= 0 || want[1] + want[2] === 0) return false;
  const hurt = hurtLinesOf(event, town, p.hurt);
  return (want[1] > 0 && hurt > 0) || (want[2] > 0 && back > hurt);
}

/** The most battles whose places are kept at once. */
const PLACES_KEPT = 64;
/**
 * The places of the battles last rolled or asked of, each side's, while the world stands still (a
 * battle whose towns are let go is a new record, so a new key).
 */
const PLACES = new WeakMap<
  World,
  {
    readonly now: number;
    readonly battles: Map<Battle, [LevyPlace[] | null, LevyPlace[] | null]>;
  }
>();

/** What is kept of a battle's places while the world stands still. */
function keptPlaces(world: World, b: Battle): [LevyPlace[] | null, LevyPlace[] | null] {
  let kept = PLACES.get(world);
  if (!kept || kept.now !== world.now)
    PLACES.set(world, (kept = { now: world.now, battles: new Map() }));
  let sides = kept.battles.get(b);
  if (!sides) {
    if (kept.battles.size >= PLACES_KEPT) kept.battles.clear();
    kept.battles.set(b, (sides = [null, null]));
  }
  return sides;
}

/** A side's places, as the roll last read them while the world stood still, else read now. */
function placesOf(world: World, b: Battle, side: 0 | 1): readonly LevyPlace[] {
  return b.fell ? (keptPlaces(world, b)[side] ??= levyPlaces(world, b, side, Infinity)) : [];
}

/** The people met who went to a battle, by side: each with his fate there, the first met first. */
function metAt(world: World, event: string): [Person, WarFate][][] {
  const out: [Person, WarFate][][] = [[], []];
  for (const p of observer(world).persons.values())
    for (const w of p.wars ?? []) if (w.event === event) out[w.side]!.push([p, w]);
  for (const list of out) list.sort((x, y) => x[0].seq - y[0].seq);
  return out;
}

/**
 * A battle's roll, `most` figures to the greater side (1 … ROLL_MOST; ROLL_DEFAULT where not a
 * number): each side's figures by lot, place by place — in each place its line holders the battle
 * levied, by line, then the people met who went, then the rest of its levy named for the roll.
 */
export function rollOf(world: World, war: War, b: Battle, most: number = ROLL_DEFAULT): BattleRoll {
  const m = Number.isFinite(most)
      ? Math.min(ROLL_MOST, Math.max(1, Math.round(most)))
      : ROLL_DEFAULT,
    figs = battleFigures(nearCounts(b), m),
    ctx = populationContext(world),
    nameOf = namerOf(world),
    met = metAt(world, b.event),
    // (A battle before the rosters' window: no town's lines tell its men.)
    rostered = b.year >= Math.floor(world.now / YEAR) - ROSTER_YEARS;
  const rollSide = (side: 0 | 1): RollSide => {
    const figures = figs.sides[side],
      realm = side === 0 ? war.attacker : war.defender,
      lots: [RollEntry[], RollEntry[], RollEntry[]] = [[], [], []],
      maimed = maimedShare(b, side),
      // One of the levy named for the roll: his ref tells his place, his lot and which he is.
      levy = (place: number, lot: Lot, i: number, cell: number): RollEntry => {
        const ref = levyManRef(b.event, side, encodeLevy(place, lot, i)),
          key = hashString(ref),
          { name, age } = nameOf(key, cell);
        return {
          ref,
          name,
          place,
          age,
          kept: false,
          ...(lot === 1 && maimed > 0 && u(key, 5) < maimed ? { maimed: true as const } : {}),
        };
      };
    // (Read fresh, and kept for the levy's pages while the world stands still.)
    const places = b.fell
      ? (keptPlaces(world, b)[side] = levyPlaces(world, b, side, Infinity))
      : [];
    if (places.length === 0) {
      // (No record of where its men came from: its levy named in its realm's tongue.)
      const home = homeOf(world, realm, b),
        counts = [figures.falls, figures.hurt, figures.stood] as const;
      for (const lot of [0, 1, 2] as const)
        for (let i = 0; i < counts[lot]; i++) lots[lot].push(levy(-1, lot, i, home));
      return { realm, figures, fell: lots[0], hurt: lots[1], stood: lots[2], towns: [] };
    }
    // Each lot's figures shared out over the places: the fallen by their dead, the wounded by their
    // wounded, the rest by those who came home whole.
    const fell = shareOut(figures.falls, places, (p) => p.dead),
      hurt = shareOut(figures.hurt, places, (p) => p.hurt),
      stood = shareOut(figures.stood, places, (p) => Math.max(0, p.sent - p.dead - p.hurt));
    // Where each of the people met came from: his town, his land's countryside, or the land whole.
    const metHere = new Map<number, [Person, WarFate][]>();
    if (met[side]!.length > 0) {
      const towns = new Map<string, number>(),
        country = new Map<number, number>(),
        whole = new Map<number, number>();
      places.forEach((p, i) => {
        if (p.kind === "town") {
          if (p.ref !== null) towns.set(p.ref, i);
        } else (p.kind === "land" ? whole : country).set(p.cell, i);
      });
      for (const [person, w] of met[side]!) {
        const at =
          whole.get(w.cell) ??
          (w.town === null
            ? country.get(w.cell)
            : towns.get(ctx.settlements.inProvince(w.cell)[w.town]?.ref ?? ""));
        if (at === undefined) continue;
        const list = metHere.get(at);
        if (list) list.push([person, w]);
        else metHere.set(at, [[person, w]]);
      }
    }
    const rolled = places.map((p, i): RollPlace => {
      const want = [fell[i]!, hurt[i]!, stood[i]!] as const;
      if (want[0] + want[1] + want[2] === 0) return { ...p, figures: want };
      const got = [0, 0, 0],
        take = (lot: Lot, entry: () => RollEntry) => {
          if (got[lot]! >= want[lot]) return;
          lots[lot].push(entry());
          got[lot]!++;
        };
      // Its line holders the battle levied, by line.
      if (rostered && p.kind === "town" && p.ref !== null && mayFill(b.event, p.ref, p, want)) {
        const roster = townRoster(world, p.ref, b.year + 1),
          rb = roster.battles.find((x) => x.event === b.event && x.side === side);
        for (const man of rb?.men ?? [])
          take(lotOf(man.fate), () => ({
            ref: man.holder.ref,
            name: roster.nameOf(man.holder),
            place: i,
            age: b.year - man.holder.born,
            kept: true,
            ...(man.fate === "maimed" ? { maimed: true as const } : {}),
          }));
      }
      // The people met who went from here, the first met first.
      for (const [person, w] of metHere.get(i) ?? [])
        take(lotOf(w.fate), () => ({
          ref: person.ref,
          name: `${person.name} ${person.surname}`,
          place: i,
          age: w.year - person.birthYear,
          kept: true,
          ...(w.fate === "maimed" ? { maimed: true as const } : {}),
        }));
      // The rest of its levy, named for the roll.
      for (const lot of [0, 1, 2] as const)
        for (let k = 0; got[lot]! < want[lot]; k++) take(lot, () => levy(i, lot, k, p.cell));
      return { ...p, figures: want };
    });
    return { realm, figures, fell: lots[0], hurt: lots[1], stood: lots[2], towns: rolled };
  };
  return {
    event: b.event,
    war: war.ref,
    year: b.year,
    per: figs.per,
    most: m,
    attacker: rollSide(0),
    defender: rollSide(1),
  };
}

/**
 * A battle's roll by its event (null: no battle of history), `most` figures to the greater side;
 * the people met followed to now first, so their wars are told.
 */
export function battleRoll(
  world: World,
  event: string,
  most: number = ROLL_DEFAULT,
): BattleRoll | null {
  const fought = battleOf(world, event);
  if (!fought) return null;
  settleAll(world);
  return rollOf(world, fought.war, fought.b, most);
}

/**
 * One of a battle's levy from his ref alone (`lv:<battle>:<side>:<n>`): his name and age, where he
 * came from and how he came home (null: no such battle, or a place it does not tell).
 */
export function resolveLevyMan(world: World, ref: string): LevyMan | null {
  const parsed = parseLevyManRef(ref),
    at = parsed && decodeLevy(parsed.j),
    fought = parsed && battleOf(world, parsed.event);
  if (!parsed || !at || !fought) return null;
  const { war, b } = fought,
    side = parsed.side,
    places = placesOf(world, b, side);
  // (A place out of range; or none told where the battle has a record of where its men came from.)
  if (at.place >= places.length || (at.place < 0 && places.length > 0)) return null;
  const place = at.place >= 0 ? places[at.place]! : null,
    realm = side === 0 ? war.attacker : war.defender,
    key = hashString(ref),
    { name, age } = namerOf(world)(key, place ? place.cell : homeOf(world, realm, b)),
    maimed = maimedShare(b, side);
  return {
    ref,
    name,
    age,
    event: b.event,
    war: war.ref,
    side,
    realm,
    year: b.year,
    land: b.land,
    place,
    fate:
      at.lot === 0
        ? "fell"
        : at.lot === 2
          ? "stood"
          : maimed > 0 && u(key, 5) < maimed
            ? "maimed"
            : "hurt",
  };
}
