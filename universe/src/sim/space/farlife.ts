// Far peoples alive (round F, "the galaxy alive"; the rules are rules/farlife.ts, the reading farlife-read.ts). Once a year, after
// the peoples among the stars have sailed, met, traded and fought (201.space.peoples) and the realms' fleets have come in
// (200.space.starwar): what was done to a far people that year enters its numbers (a fleet's raid or a battle wearies it, a
// lesson or goods from another fill what it lacked, a landing on a people of another world kills, sickens, frightens and teaches
// it), and each far people whose year of ten it is steps its life on by as many years as have passed since it last did (a deep-time
// path: ten at once, or a thousand). A followed people's life is taken up in the year its signals first leave it (all history
// reads of it before then is its rungs, which are history's); a people only come down on, in the year of the first landing on it.
// What each fears of the others it knows, and how much (rules/farlife.ts farThreat: stronger, seen, exposed, with much to lose), is
// read at its step; a people whose holding together breaks is told, and one that falls.
import {
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { worldLife, type Civilization } from "../../gen/index.ts";
import {
  FAR_LIFE,
  STARS_RUNG,
  battleWearies,
  farDearness,
  farGain,
  farStep,
  farStrength,
  farThreat,
  landed,
  meetingLeans,
  starDriveFor,
  taught,
  warAim,
  type FarAim,
  type FarFacts,
  type FarGain,
  type FarState,
  type FarThreat,
} from "../../rules/index.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { knows } from "../lore/lore.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { homePlanet } from "../planet/store.ts";
import type { PopulationContext } from "../population/systems.ts";
import { civilizationsNear } from "./contact.ts";
import {
  civReading,
  clockRung,
  fellWords,
  heldTo,
  livedState,
  readAt,
  type FarReading,
} from "./farlife-read.ts";
import {
  FarLifeStore,
  farLifeOf,
  pack,
  rungInto,
  sampleInto,
  tellOn,
  unpack,
  type FarRow,
} from "./farlife-store.ts";
import { filledOf } from "./filled-store.ts";
import { landfallsOf } from "./landfall.ts";
import { folkByRef, folkOf, type Folk } from "./natives.ts";
import {
  holdWorld,
  peopleNature,
  peopleWords,
  peoplesOf,
  realmStrength,
  starPoint,
} from "./peoples.ts";
import { spaceOf } from "./space.ts";
import { clusterOf, starSitesOf } from "./stars.ts";
import { starWarsOf } from "./starwar.ts";

export const FARLIFE_EVENTS = {
  /** A far people's holding together broke: strife, its works idle. */
  broke: defineEventType("farlife.broke", 4),
  /** A far people fell. */
  fell: defineEventType("farlife.fell", 5),
  /** A landing struck a people down: those a sickness and the fight took. */
  struck: defineEventType("farlife.struck", 5),
};

const FARLIFE = defineStream("space.farlife");

/** A ref's whole number (a far people's own subject in its stream, and its year of ten). */
export function refKey(ref: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < ref.length; i++) h = Math.imul(h ^ ref.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// —— Reading a far people's numbers ——————————————————————————————————————————————————————————————

/**
 * The followed peoples as history reads them in a year (`year` left out: as a page reads them). Every reader of them here goes
 * through this one, so that a reading of them by the year (universe/rules-next's civilizationsNear(world, year)) is one line.
 */
export const followedIn = (world: World, _year?: number): Civilization[] =>
  civilizationsNear(world);

/** A people's life as read off its world: a followed people's, or one history does not follow (null: none is read). */
export function lifeReadingOf(world: World, ref: string, year?: number): FarReading | null {
  const civ = followedIn(world, year).find((c) => c.ref === ref);
  if (civ) return civReading(world, civ);
  return folkByRef(world, ref)?.lived ?? null;
}

/** A far people's numbers in a year: as history holds them where it has taken them up, else as read. */
export function farNow(
  world: World,
  ref: string,
  year: number,
): { readonly state: FarState; readonly facts: FarFacts; readonly row: FarRow | null } | null {
  const r = lifeReadingOf(world, ref, year);
  if (!r) return null;
  const civ = followedIn(world, year).find((c) => c.ref === ref),
    row = farLifeOf(world)?.get(ref) ?? null;
  const state = civ
    ? livedState(world, civ, year)
    : row && year >= row.since
      ? unpack(row)
      : readAt(r, year);
  return state ? { state, facts: r.facts, row } : null;
}

/** Whether a followed people is broken now (strife: no ship of it sails). */
export function heldBroken(world: World, ref: string): boolean {
  const row = farLifeOf(world)?.get(ref);
  return !!row && row.s[15] === 1;
}

// —— What the home world is, as a far people reads it ——————————————————————————————————————————

/** The rung a realm of the home world stands at, by what its seat knows: its works, its current, its orbit, its stars. */
export function homeRung(ctx: PopulationContext, p: Polity | null): number {
  if (!p) return 2;
  const k = (id: string) => knows(ctx, p.seat, id);
  if (starDriveFor(k)) return STARS_RUNG;
  if (spaceOf(ctx.world).of(p.ref)?.satellite) return 6;
  if (k("electronics")) return 5;
  if (["steam-engine", "sun-engines", "heat-engines", "cold-chemistry"].some(k)) return 4;
  return 3;
}

/** A realm's numbers as a far people's meeting reads them: its people, its rung and what it turns as its rung asks. */
function realmNumbers(ctx: PopulationContext, p: Polity | null) {
  let people = 0;
  if (p) for (const c of p.members) people += ctx.provinces.get(c)?.total() ?? 0;
  const rung = homeRung(ctx, p);
  return {
    people,
    know: rung + 0.5,
    rung,
    made: FAR_LIFE.asks[rung]! * 0.8,
    fed: 1,
    cohesion: 0.6,
  };
}

/** Two sides of a meeting among the stars, as peoples.ts holds them. */
export type FarSide =
  | { readonly kind: "home"; readonly cell: number; readonly realm: Polity | null }
  | { readonly kind: "people"; readonly civ: Civilization };

/** What a side is to the reading of a meeting: its strength, its numbers, where it lives and how. */
function sideNumbers(ctx: PopulationContext, side: FarSide, year: number) {
  const world = ctx.world;
  if (side.kind === "people") {
    const s = livedState(world, side.civ, year),
      facts = civReading(world, side.civ)?.facts;
    return {
      strength: s ? farStrength(s) : 0.3,
      state: s ?? { people: 0, know: 0, made: 0, rung: 0, fed: 1, cohesion: 0.5 },
      star: side.civ.star,
      warmth: facts?.warmth ?? 15,
      pressure: facts?.pressure ?? 1,
      sea: facts?.sea ?? side.civ.medium === "water",
    };
  }
  const g = homePlanet(world).generated,
    n = realmNumbers(ctx, side.realm);
  return {
    strength: side.realm ? realmStrength(ctx, side.realm) : 0.3,
    state: n,
    star: g.star.ref as Ref,
    warmth: g.planet.meanTemperature,
    pressure: g.system.bodies[0]!.pressure,
    sea: g.life.people?.body.medium === "water",
  };
}

/** Whether the one's bodies could live where the other lives: its warmth near theirs, its air as thick, the same medium (est.). */
const couldLive = (
  a: { warmth: number; pressure: number; sea: boolean },
  b: { warmth: number; pressure: number; sea: boolean },
) =>
  a.sea === b.sea &&
  Math.abs(a.warmth - b.warmth) < 25 &&
  b.pressure / Math.max(0.05, a.pressure) < 2.6 &&
  a.pressure / Math.max(0.05, b.pressure) < 2.6;

const apart = (world: World, a: Ref, b: Ref) => {
  const p = starPoint(world, a),
    q = starPoint(world, b),
    x = p.x - q.x,
    y = p.y - q.y,
    z = p.z - q.z;
  return Math.sqrt(x * x + y * y + z * z);
};

/**
 * What `me` fears of `them` and stands to gain of them, from what it knows (their numbers as the light between them is old): their strength against its own, how well that is
 * seen (`seen`: 1 their ships came; a half, heard only), whether their bodies could live on its ground, how far apart, how
 * much of it there is to lose and how well it holds together.
 */
export function meetingReading(
  ctx: PopulationContext,
  me: FarSide,
  them: FarSide,
  year: number,
  seen: number,
): {
  readonly threat: FarThreat;
  readonly gain: FarGain;
  readonly mine: number;
  readonly theirs: number;
} {
  // (What one people knows of another's numbers is as old as the light between them: what it hears of them left them so long ago.
  // A realm of the home world met on its own ground is seen as it is.)
  const a = sideNumbers(ctx, me, year),
    lag =
      me.kind === "people" && them.kind === "people"
        ? Math.ceil(apart(ctx.world, me.civ.star, them.civ.star))
        : 0,
    b = sideNumbers(ctx, them, year - lag),
    threat = farThreat({
      mine: a.strength,
      theirs: b.strength,
      seen,
      livable: couldLive(b, a),
      apart: apart(ctx.world, a.star, b.star),
      people: a.state.people,
      cohesion: a.state.cohesion,
    });
  return { threat, gain: farGain(a.state, b.state), mine: a.strength, theirs: b.strength };
}

/**
 * How a side meets another, weighed (wonder, fear, trade, war): a people by its nature, a land of the home world by its ways, each
 * by what it fears of the other and stands to gain (rules/farlife.ts meetingLeans).
 */
export function meetingWeights(
  ctx: PopulationContext,
  me: FarSide,
  them: FarSide,
  year: number,
  r: { readonly omen: boolean; readonly speak: boolean; readonly pressed: number },
): {
  readonly weights: readonly [number, number, number, number];
  readonly threat: FarThreat;
  readonly gain: FarGain;
  readonly leaning: { curious: number; wary: number; bold: number; trading: number };
} {
  const world = ctx.world,
    read = meetingReading(ctx, me, them, year, me.kind === "home" || r.omen ? 1 : 0.8);
  let leaning: { curious: number; wary: number; bold: number; trading: number };
  if (me.kind === "people") leaning = peopleNature(world, me.civ);
  else {
    const ways = cultureOf(world).get(me.cell)?.traits ?? [],
      t = (k: keyof typeof WAY) => ways[WAY[k]!] ?? 0.5;
    leaning = {
      curious: 0.5 * t("openness") + 0.4 * t("piety"),
      wary: 0.5 * t("tradition") + 0.5 * (1 - t("openness")),
      bold: t("valour") * (1 - 0.5 * t("openness")),
      trading: 0.8 * t("trade") + 0.2 * t("openness"),
    };
  }
  const weights = meetingLeans({
    threat: read.threat,
    gain: read.gain,
    ...leaning,
    speak: r.speak,
    pressed: r.pressed,
    omen: r.omen,
  });
  return { weights, threat: read.threat, gain: read.gain, leaning };
}

/**
 * Why a people at odds with another would send a fleet, and how much it wants to (rules/farlife.ts warAim): ground it lacks where
 * it is crowded and the other's world would take it, a threat it would end, goods it lacks that the other has.
 */
export function fleetWill(
  ctx: PopulationContext,
  civ: Civilization,
  them: FarSide,
  year: number,
  crowded: boolean,
): { readonly aim: FarAim; readonly will: number } {
  const me: FarSide = { kind: "people", civ },
    s = livedState(ctx.world, civ, year);
  if (!s) return { aim: null, will: 0 };
  const read = meetingReading(ctx, me, them, year, 1),
    b = sideNumbers(ctx, them, year),
    a = sideNumbers(ctx, me, year);
  return warAim({
    mine: s,
    crowded,
    threat: read.threat.level,
    gain: read.gain.level,
    theirLivable: couldLive(a, b),
  });
}

/** How far a people's weariness of war and another's pull them to peace (a people's own; a realm's, none kept). */
export function warWeary(world: World, a: Ref, b: Ref): number {
  const w = (ref: Ref) => {
    const row = farLifeOf(world)?.get(ref);
    return row ? row.s[13]! / 1000 : 0;
  };
  return 0.5 * (w(a) + w(b));
}

/** What a far people has to spare of what it makes, and how dear it asks (trade.ts reads this of a people that sells). */
export function farSpare(world: World, ref: string, year: number): { dear: number; spare: number } {
  const now = farNow(world, ref, year);
  return now ? farDearness(now.state) : { dear: 1, spare: 0.5 };
}

// —— The year ————————————————————————————————————————————————————————————————————————————————

/** A new row, from what is read of a people that year. */
function takeUp(
  store: FarLifeStore,
  ref: Ref,
  followed: boolean,
  s: FarState,
  year: number,
): FarRow {
  const row: FarRow = {
    ref,
    followed,
    since: year,
    last: year,
    s: pack(s),
    fell: s.fell,
    fearOf: null,
    ring: [],
    told: [],
    broke: null,
    rungs: [year, s.rung],
    why: null,
  };
  sampleInto(row, year, s);
  store.set(row);
  return row;
}

/** Set a row's numbers from a state, as of a year (its samples and rungs too). */
function setState(store: FarLifeStore, row: FarRow, s: FarState, year: number): void {
  row.s = pack(s);
  row.fell = s.fell;
  rungInto(row, year, s.fell !== null ? 0 : s.rung);
  store.set(row);
}

/** What raids among the peoples did this year: each side wearied by its losses, a hold taken taking its people. */
function raidsYear(world: World, store: FarLifeStore, year: number): void {
  const peoples = peoplesOf(world);
  if (!peoples) return;
  for (const r of peoples.raids) {
    if (r.year !== year) continue;
    const by = store.get(r.civ);
    if (by) {
      const s = unpack(by);
      setState(
        store,
        by,
        { ...s, war: Math.min(1, s.war + battleWearies(0, s.people, r.won)) },
        year,
      );
      tellOn(by, { year, what: "raid", by: r.other, amount: r.won ? 1 : 0, event: r.event });
    }
    const on = store.get(r.other);
    if (on) {
      const s = unpack(on),
        holds = Math.max(1, peoples.holdsOf(on.ref).length + (r.taken ? 1 : 0)),
        // (A hold taken takes those who lived about it: one of its stars' share, est. half of them.)
        lost = r.taken ? (0.5 * s.people) / holds : 0;
      setState(
        store,
        on,
        {
          ...s,
          people: s.people - lost,
          war: Math.min(1, s.war + battleWearies(lost, s.people, !r.won)),
        },
        year,
      );
      tellOn(on, {
        year,
        what: "raid",
        by: r.civ,
        amount: lost / Math.max(1, s.people),
        event: r.event,
      });
    }
  }
}

/** What the realms' fleets did to a far people this year: a battle lost wearies it and costs it a little of its numbers. */
function battlesYear(world: World, store: FarLifeStore, year: number): void {
  if (!world.hasStore("space.starwars")) return;
  for (const w of starWarsOf(world).all()) {
    if (w.arrives !== year || w.won === null) continue;
    const row = store.get(w.enemy);
    if (!row) continue;
    const s = unpack(row),
      lost = w.won ? 0.01 * s.people : 0;
    setState(
      store,
      row,
      {
        ...s,
        people: s.people - lost,
        war: Math.min(1, s.war + battleWearies(lost, s.people, !w.won)),
      },
      year,
    );
    tellOn(row, { year, what: "battle", by: w.realm, amount: w.won ? 1 : 0, event: w.battle });
  }
}

/** What passed between peoples this year: a lesson moves the taker's knowledge, goods its power or its food. */
function exchangesYear(world: World, store: FarLifeStore, year: number): void {
  const peoples = peoplesOf(world);
  if (!peoples) return;
  for (const x of peoples.exchanges) {
    if (x.year !== year || x.what === "ways" || !x.detail) continue;
    // (Between two peoples the detail names who took; to a realm, the people gave.)
    const taker = store.get(x.detail),
      giver = store.get(x.detail === x.civ ? x.other : x.civ);
    if (!taker || !giver) continue;
    const t = unpack(taker),
      g = unpack(giver);
    if (x.what === "knowledge") {
      const gain = taught(g.know - t.know);
      setState(store, taker, { ...t, know: t.know + gain }, year);
      tellOn(taker, { year, what: "lesson", by: giver.ref, amount: gain, event: x.event });
    } else {
      // (What a few holds carry: a twentieth more of power a head for a short people, food for a hungry one; est.)
      const made = t.made < g.made ? t.made * 1.05 : t.made,
        fed = t.fed < 1 && g.fed > 1 ? Math.min(1, t.fed + 0.03) : t.fed;
      setState(store, taker, { ...t, made, fed }, year);
      tellOn(taker, { year, what: "goods", by: giver.ref, amount: made - t.made, event: x.event });
    }
  }
}

/** The worlds anyone came down on this year: home's ships, its lane visits and far colonies, the peoples' settlers. */
function landedOn(world: World, year: number): { star: Ref; planet: number }[] {
  const out: { star: Ref; planet: number }[] = [],
    add = (star: Ref | null, planet: number) => {
      if (star && planet >= 0 && !out.some((x) => x.star === star && x.planet === planet))
        out.push({ star, planet });
    },
    sites = starSitesOf(world);
  for (const [, site] of sites?.all() ?? [])
    if (site.arrived && site.arrives === year) add(site.star, site.planet);
  for (const v of sites?.visits ?? []) if (v.arrived && v.arrives === year) add(v.star, v.planet);
  for (const w of filledOf(world)?.all() ?? [])
    if (w.arrived && w.arrives === year && w.cell === null) add(w.star, w.planet);
  const peoples = peoplesOf(world);
  if (peoples)
    for (const c of followedIn(world, year))
      for (const h of peoples.holdsOf(c.ref))
        if (h.year === year && h.event && !h.from) add(h.star, holdWorld(world, c, h.star) ?? -1);
  return out;
}

/** A landing on a people this year: their numbers struck as the fight and the sickness say, and those who came wearied. */
function landingsYear(ctx: PopulationContext, store: FarLifeStore, year: number): void {
  const world = ctx.world,
    spots = landedOn(world, year);
  if (!spots.length) return;
  const stars = clusterOf(world);
  for (const spot of spots) {
    const s = stars.find((x) => x.ref === spot.star),
      f: Folk | null = s ? folkOf(world, s, spot.planet) : null;
    if (!f || f.followed || !f.lived) continue;
    for (const l of landfallsOf(world, f, worldLife(ctx.generated))) {
      if (l.arrival.year !== year) continue;
      const row = store.get(f.ref) ?? takeUp(store, f.ref, false, readAt(f.lived, year), year),
        before = unpack(row);
      if (before.fell !== null) continue;
      const civ =
          l.arrival.kind === "people"
            ? followedIn(world, year).find((c) => c.ref === l.arrival.civ)
            : null,
        comers = civ ? livedState(world, civ, year) : null,
        realm = l.arrival.kind === "home" ? (politiesOf(world).get(l.ref) ?? null) : null,
        comersKnow = comers
          ? comers.know
          : homeRung(ctx, realm && realm.ended === null ? realm : null) + 0.5,
        after = landed(before, {
          fieldDead: 1,
          fielded: l.fight.dead[1] / Math.max(1, before.people),
          sickShare: l.sick.there,
          won: l.fight.won,
          stay: l.stay,
          comersKnow,
          comersStrength: comers ? farStrength(comers) : 1,
        }),
        lostShare = 1 - after.people / Math.max(1, before.people),
        event = world.events.emit({
          type: FARLIFE_EVENTS.struck.type,
          place: null,
          subjects: [f.ref, l.ref],
          causes: l.arrival.event ? [{ ref: l.arrival.event, role: "trigger", weight: 1 }] : [],
          data: {
            name: f.name,
            sick: Math.round(l.sick.there * 100) / 100,
            lost: Math.round(lostShare * 1000) / 1000,
            dead: l.fight.dead[1],
            won: l.fight.won,
            year,
          },
        });
      setState(store, row, after, year);
      if (lostShare > 0)
        tellOn(row, {
          year,
          what: l.sick.there > 0 ? "sickness" : "landing",
          by: l.ref,
          amount: lostShare,
          event,
        });
      else tellOn(row, { year, what: "landing", by: l.ref, amount: 0, event });
      if (after.broken && !before.broken) row.broke = event;
      // (And the reverse: a people of the stars that came down is wearied by what it lost, and by the sickness that crossed back.)
      const theirs = civ ? store.get(civ.ref) : undefined;
      if (theirs && comers) {
        const c = unpack(theirs);
        setState(
          store,
          theirs,
          {
            ...c,
            war: Math.min(
              1,
              c.war +
                battleWearies(l.fight.dead[0], Math.max(1, l.comers.flesh * 50), l.fight.won) * 0.2,
            ),
            sick: Math.max(c.sick, l.sick.home * 0.05),
          },
          year,
        );
        tellOn(theirs, { year, what: "landing", by: f.ref, amount: l.fight.won ? 1 : 0, event });
      }
    }
  }
}

/** What a followed people fears most, of those it has met: its reading of each (the latest of their numbers it can know). */
function fearOf(
  ctx: PopulationContext,
  civ: Civilization,
  year: number,
): { readonly level: number; readonly of: Ref | null } {
  const peoples = peoplesOf(ctx.world);
  if (!peoples) return { level: 0, of: null };
  const civs = followedIn(ctx.world, year),
    me: FarSide = { kind: "people", civ };
  let best = 0,
    of: Ref | null = null;
  for (const m of peoples.meetings) {
    if (m.civ !== civ.ref && m.other !== civ.ref) continue;
    const otherRef = (m.civ === civ.ref ? m.other : m.civ) as Ref;
    let them: FarSide | null = null;
    if (m.with === "people" || m.civ !== civ.ref) {
      const c = civs.find((x) => x.ref === otherRef);
      if (c) them = { kind: "people", civ: c };
    } else {
      const realm = politiesOf(ctx.world).get(otherRef);
      them = { kind: "home", cell: m.cell, realm: realm && realm.ended === null ? realm : null };
    }
    if (!them) continue;
    // (What is known of them is what reached it: their raids seen, else their ships and signals.)
    const t = meetingReading(ctx, me, them, year, m.raids ? 1 : m.talking ? 0.8 : 0.5).threat.level;
    if (t > best) [best, of] = [t, otherRef];
  }
  return { level: best, of };
}

/** One far people's step: as many years as have passed since its last. */
function stepRow(
  ctx: PopulationContext,
  store: FarLifeStore,
  row: FarRow,
  year: number,
  t: SimTime,
): void {
  const world = ctx.world,
    civ = row.followed ? followedIn(world, year).find((c) => c.ref === row.ref) : undefined,
    reading = civ ? civReading(world, civ) : (folkByRef(world, row.ref)?.lived ?? null);
  if (!reading || (row.followed && !civ)) return;
  const s = unpack(row),
    name = civ ? peopleWords(world, civ).name : (folkByRef(world, row.ref)?.name ?? null),
    years = year - row.last,
    lived = farStep(reading.facts, s, years, world.rng.real(FARLIFE, refKey(row.ref), t, 0), year);
  let next = civ ? heldTo(s, lived, clockRung(civ, year)) : lived;
  if (civ) {
    const f = fearOf(ctx, civ, year);
    next = { ...next, fear: Math.max(next.fear, f.level) };
    row.fearOf = f.of;
  }
  row.last = year;
  if (next.broken && !s.broken) {
    const event = world.events.emit({
      type: FARLIFE_EVENTS.broke.type,
      place: null,
      subjects: [row.ref],
      causes: row.told.length
        ? [{ ref: row.told[row.told.length - 1]!.event ?? row.ref, role: "pressure", weight: 0.5 }]
        : [],
      data: {
        name,
        hungry: next.fed < 0.9,
        war: Math.round(next.war * 100) / 100,
        sick: Math.round(next.sick * 100) / 100,
        year,
      },
    });
    row.broke = event;
    tellOn(row, { year, what: "broke", by: null, amount: next.cohesion, event });
  } else if (!next.broken && s.broken) {
    row.broke = null;
    tellOn(row, { year, what: "mended", by: null, amount: next.cohesion, event: null });
  }
  if (next.fell !== null && s.fell === null) {
    row.why = fellWords(s, s.top);
    const event = world.events.emit({
      type: FARLIFE_EVENTS.fell.type,
      place: null,
      subjects: [row.ref],
      causes: row.broke ? [{ ref: row.broke, role: "trigger", weight: 1 }] : [],
      data: { name, why: row.why, peak: Math.round(s.peak), year },
    });
    tellOn(row, { year, what: "fell", by: null, amount: 1, event });
  }
  sampleInto(row, year, next);
  setState(store, row, next, year);
}

/** The year of the far peoples' lives (205.space.farlife). */
export function farLifeYear(ctx: PopulationContext, t: SimTime): void {
  const world = ctx.world,
    store = farLifeOf(world);
  if (!store) return;
  const year = yearOfMoment(t);
  // A followed people's life is taken up the year its signals leave it.
  for (const civ of followedIn(world, year)) {
    if (store.get(civ.ref) || !(year >= civ.electronics)) continue;
    const s = livedState(world, civ, year);
    if (s) takeUp(store, civ.ref, true, s, year);
  }
  // (A landing takes up the life of those it came down on, whether or not any other is held yet.)
  landingsYear(ctx, store, year);
  if (store.dormant()) return;
  raidsYear(world, store, year);
  battlesYear(world, store, year);
  exchangesYear(world, store, year);
  // Each in its year of ten steps on.
  for (const row of store.all()) {
    if (row.fell !== null || row.last >= year) continue;
    if ((((refKey(row.ref) + year) % FAR_LIFE.step) + FAR_LIFE.step) % FAR_LIFE.step !== 0)
      continue;
    stepRow(ctx, store, row, year, t);
  }
}

export function installFarLife(world: World, ctx: () => PopulationContext): FarLifeStore {
  const store = world.register(new FarLifeStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "205.space.farlife", every: YEAR, run: (t) => farLifeYear(ctx(), t) });
  return store;
}
