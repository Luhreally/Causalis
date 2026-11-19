// Notable people (the rules are rules/notables.ts; what is kept ./kept.ts). The one rule under every person history keeps by name
// who is not a ruler, a court figure or a group's head already: someone is kept when what they are or did crosses the line their
// own people would notice, and what kind of notable they are is read off what they did. No list of professions: a domain is what
// the deed was of (rules DOMAINS), a title is told from the deed (host/inspect/notable.ts).
//
// Once a year, after the year's other systems:
//   1. the year's events are read for occasions (the log since the last event read, by its serial): a thing found, a faith
//      founded or split, a seat seized, a realm risen or parted, a people's choice won, a law written, a house of lending
//      founded, a sea crossed, a land first peopled, a work designed or raised, a plot, a fraud, the god's inspiring. Each has a
//      doer: the land's standing notable of that domain where one is and the draw gives it to them (rules doneBy), or someone new
//      whom the deed makes, if the deed is weighty enough to be noticed (its importance). Battles are not read here: the war asks
//      who commands each host before it fights (commandIn) and tells how it went after (commandAfter);
//   2. each peopled land in its year of NOTE.every, where one of the names its people can hold is free (as many as their number
//      has digits, less one: a thousand hold two, a million five): the chance one of its doers is far past the rest, each
//      domain's rate added (its learned, its crafters, its clergy, its traders, those who tend its sick, those who judge, those
//      who kill; arisesRate: the doers, how developed the domain is there, what the land has to spare and its rich give, one of
//      name who taught there; less the more names its people hold), of which domain by its share of that, and how far past, from
//      a heavy tail. One a turn at the most. In a year of sickness out of its turn a land is weighed for its healers alone;
//   3. they age and die: by their people's life table, more in a year of sickness in their land (and those who tend the sick
//      more yet), by the fall of the seat they served (a coup, a revolution), in battle (commandAfter); a standing falls a little
//      each year without a deed; where a deed forces a name on a land that holds all it can, the least of them is let go, and
//      the least of a crowded world; the dead are kept as short records while past the line or newly mourned;
//   4. the greatest risings and deaths of the year are told (NOTE.told), each with its causes.
// What they do flows back through ./kept.ts, each a small bounded term an older system reads (rules ACTS: the most each can be):
// a commander in their host's strength, and a host shaken when one falls (sim/war/war.ts); the learned in how readily their land
// inquires (sim/lore/lore.ts) and in who rises after them; makers in their land's renown (sim/culture/art.ts); one who speaks
// for a faith in its spread from their land, its hold there, and its breaking from its seat (sim/belief/belief.ts); one who
// won a people's choice speaks for the group that won (sim/order/elections.ts reads it, at nothing yet: rules ACTS.speaks); healers in the deaths their land's care spares
// (sim/population/systems.ts); the rich in what their land has to spare for its other names (here). The god's acts on a person
// reach them (sim/acts/person.ts), and `notableTargets` / `strikeNotable` are the hook by which a group may strike at one.
// A people whose bodies live as one keep lines, not persons (rules keepsPersons): fewer, and never one body.
// Not done here, each a lever: one of the law moving their realm's law; a great fortune founding a house of lending (a house's
// founding does make its founder known); a notable moving to another land or realm; kin and heirs of a name.
import {
  YEAR,
  defineEventType,
  defineStream,
  dmath,
  kindCodeOf,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type HistoryEvent,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { tongueName, tonguePersonName } from "../../gen/index.ts";
import {
  DOMAIN,
  DOMAINS,
  FIELD,
  NOTE,
  ACTS,
  OCC,
  arisesRate,
  deedGain,
  diesWithin,
  doneBy,
  fieldGain,
  gainKept,
  namesHeld,
  keepsPersons,
  patronTerm,
  satOf,
  talentOf,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Province } from "../population/model.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { inquiresMore, loreOf } from "../lore/lore.ts";
import { readersOf } from "../lore/letters.ts";
import { learnedOf } from "../lore/academy.ts";
import { artMakers, artOf } from "../culture/art.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { courtOf } from "../court/court.ts";
import { bearerOddsOf } from "../society/kept.ts";
import { organisedIn } from "../order/groups-kept.ts";
import {
  NotablesStore,
  notableInquires,
  notableRef,
  notablesOf,
  type Deed,
  type Gone,
  type Notable,
} from "./kept.ts";

export const NOTABLE_EVENTS = {
  /** Someone's people came to know them by name. */
  arose: defineEventType("notable.arose", 3),
  /** One of name died. */
  died: defineEventType("notable.died", 3),
};

const DRAW = defineStream("people.notables");
const D = DOMAINS.length;

/**
 * The occasions: what an event of each type is a deed of, and of the deed's weight the share the doer has (a founder all of it,
 * one among many who rose a part). `note` is the word of the event's own telling kept for the doer's title.
 */
type Occasion = { readonly d: number; readonly share: number; readonly note?: string };
const OCCASIONS: Readonly<Record<string, Occasion>> = {
  "act.inspire": { d: DOMAIN.knowledge, share: 0.6 },
  "act.inspire-one": { d: DOMAIN.knowledge, share: 0.6 },
  "lore.found": { d: DOMAIN.knowledge, share: 1, note: "principle" },
  "lore.found-again": { d: DOMAIN.knowledge, share: 0.7, note: "principle" },
  "knowledge.metalworking": { d: DOMAIN.knowledge, share: 1 },
  "knowledge.cultivation": { d: DOMAIN.knowledge, share: 1 },
  "knowledge.herding": { d: DOMAIN.knowledge, share: 1 },
  "lore.material-found": { d: DOMAIN.making, share: 1, note: "material" },
  "design.works": { d: DOMAIN.making, share: 1, note: "words" },
  "design.house": { d: DOMAIN.making, share: 1, note: "words" },
  "design.host": { d: DOMAIN.making, share: 0.8, note: "words" },
  "town.temple": { d: DOMAIN.making, share: 1, note: "name" },
  "industry.works": { d: DOMAIN.wealth, share: 0.5 },
  "belief.founded": { d: DOMAIN.faith, share: 1, note: "name" },
  "belief.schism": { d: DOMAIN.faith, share: 1, note: "name" },
  "strife.coup": { d: DOMAIN.rule, share: 0.8, note: "realm" },
  "strife.revolution": { d: DOMAIN.rule, share: 0.7, note: "to" },
  "polity.seceded": { d: DOMAIN.rule, share: 0.7, note: "name" },
  "war.rebellion": { d: DOMAIN.rule, share: 0.7, note: "a" },
  "order.revolt": { d: DOMAIN.rule, share: 0.5, note: "realm" },
  "houses.demagogue": { d: DOMAIN.rule, share: 1, note: "name" },
  "order.elected": { d: DOMAIN.rule, share: 1, note: "group" },
  "order.law": { d: DOMAIN.law, share: 0.6, note: "realm" },
  "society.written": { d: DOMAIN.law, share: 1, note: "realm" },
  "credit.founded": { d: DOMAIN.wealth, share: 0.8, note: "name" },
  "trade.sea-route": { d: DOMAIN.exploration, share: 0.6, note: "good" },
  "province.peopled": { d: DOMAIN.exploration, share: 0.4 },
  "space.crew": { d: DOMAIN.exploration, share: 1 },
  "space.voyage": { d: DOMAIN.exploration, share: 0.8 },
  "space.colony": { d: DOMAIN.exploration, share: 0.6 },
  "strife.foiled": { d: DOMAIN.infamy, share: 0.6, note: "realm" },
  "houses.grifter": { d: DOMAIN.infamy, share: 1, note: "name" },
};
/** The god's act on one person (sim/acts/person.ts): an inspiring is an occasion. */
const INSPIRED = "person.act";
/** A sickness in a land this year: its healers are tried, and its notables die the more. */
const SICKNESS = "health.outbreak";
/** A seat's fall: those of name who served it may fall with it. */
const SEAT_FALLS: ReadonlySet<string> = new Set(["strife.coup", "strife.revolution"]);
/** The domains whose notables serve a seat. */
const SERVE: ReadonlySet<number> = new Set([DOMAIN.war, DOMAIN.rule, DOMAIN.law]);
const SICK_DIES = 0.04,
  PURGED = 0.3;

const serialOf = (ref: Ref): number => Number(ref.slice(ref.lastIndexOf(":") + 1));
const cellOf = (place: Ref | null): number | null =>
  place && kindCodeOf(place) === "cell" ? serialOf(place) : null;

type Run = {
  readonly ctx: PopulationContext;
  readonly world: World;
  readonly store: NotablesStore;
  readonly t: SimTime;
  readonly year: number;
  readonly many: boolean;
  /** What may be told this year: a standing, and how to tell it. */
  readonly tell: { standing: number; id: number; run: () => void }[];
  /** Where the world holds all the names it keeps: the least of them, which one newly noticed must pass (0: room yet). */
  bar: number;
};

function nameIn(r: Run, cell: number, key: number): { name: string; sex: number } {
  const { world } = r,
    ways = world.hasStore("culture.ways") ? cultureOf(world).get(cell) : undefined,
    u = (k: number) => world.rng.real(DRAW, key, r.t, 900 + k),
    // (A bearer (0) by the odds their people's roles give one of them a name past the hearth: as a ruler is drawn.)
    sex = u(0) < bearerOddsOf(world, cell) ? 0 : 1;
  if (!ways) return { name: `One of ${cell}`, sex };
  const given = r.many
      ? tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ 0x2e7a }, Math.floor(u(1) * 1e6))
      : tonguePersonName(ways.tongue, Math.floor(u(1) * 1e6), sex),
    family = tongueName(
      { ...ways.tongue, seed: ways.tongue.seed ^ 0x51f7 },
      Math.floor(u(2) * 1e6),
    );
  // (A line of a people who keep no one apart has one word, its own.)
  return { name: r.many ? given : `${given} ${family}`, sex };
}

function faithOf(world: World, cell: number): Ref | null {
  return world.hasStore("belief.faiths") ? beliefOf(world).of(cell).faith : null;
}
const realmOf = (world: World, cell: number): Polity | undefined =>
  world.hasStore("polity.states") ? politiesOf(world).of(cell) : undefined;

function addDeed(n: Notable, given: Deed): void {
  // (A name is made once: a further deed adds the less the higher they stand. What it takes, it takes whole.)
  const deed =
    given.g > 0 && n.deeds.length
      ? { ...given, g: Math.round(given.g * gainKept(n.standing)) }
      : given;
  n.by[deed.d] = Math.max(0, Math.min(NOTE.most, (n.by[deed.d] ?? 0) + deed.g));
  let s = 0;
  for (let d = 0; d < D; d++) s += n.by[d] ?? 0;
  n.standing = Math.min(NOTE.most, s);
  n.best = Math.max(n.best, n.standing);
  n.last = deed.y;
  n.deeds.push(deed);
  if (n.deeds.length > NOTE.deeds) {
    // (The greatest and the latest are kept: the least of the older ones goes.)
    let least = 0;
    for (let i = 1; i < n.deeds.length - 1; i++) if (n.deeds[i]!.g < n.deeds[least]!.g) least = i;
    n.deeds.splice(least, 1);
  }
}

/** Someone new: born a grown life ago, of this land, its realm and its faith, with their first deed. */
function arise(
  r: Run,
  cell: number,
  key: number,
  standing: number,
  deed: Deed,
  given?: { name: string; sex: number; born?: number; as?: string },
): Notable {
  const { ctx, world, store, year } = r,
    u = world.rng.real(DRAW, key, r.t, 950),
    named = given ?? nameIn(r, cell, key),
    n: Notable = {
      id: store.mint(),
      name: named.name,
      sex: named.sex,
      many: r.many,
      born: given?.born ?? year - Math.round(ctx.life.adulthood * (1.2 + 1.4 * u)),
      since: year,
      home: cell,
      realm: realmOf(world, cell)?.ref ?? null,
      faith: faithOf(world, cell),
      by: new Array<number>(D).fill(0),
      standing: 0,
      best: 0,
      last: year,
      deeds: [],
      ...(given?.as ? { as: given.as } : {}),
    };
  addDeed(n, { ...deed, g: standing });
  // (Whoever of the same domain stood highest there taught them, where one stood before them; the nearest in standing is whom
  // they are measured against.)
  let teacher: Notable | undefined, rival: Notable | undefined;
  for (const o of store.in(cell)) {
    if ((o.by[deed.d] ?? 0) <= 0) continue;
    if (o.since < year - 5 && (!teacher || o.by[deed.d]! > teacher.by[deed.d]!)) teacher = o;
    else if (!rival || Math.abs(o.standing - standing) < Math.abs(rival.standing - standing))
      rival = o;
  }
  if (teacher) n.teacher = teacher.id;
  if (rival) {
    n.rival = rival.id;
    rival.rival ??= n.id;
  }
  store.add(n);
  return n;
}

/**
 * One the world keeps already who is this one given by name (a court's figure, a ruler): of the same name and the same birth
 * or the same figure, among those of the land and the one who commands the realm's host. A general who commands a host and
 * then seizes the seat is one person, and so is one who seized it and then takes the field: without this each occasion
 * made them anew (first light, year 1,500: Eai Giaigeamere, born 1461, kept as 99260 and 99337).
 */
function keptAs(
  store: NotablesStore,
  cell: number,
  realm: Ref | undefined,
  given: { name: string; born?: number; as?: string },
): Notable | undefined {
  const is = (n: Notable | undefined): n is Notable =>
      !!n &&
      n.name === given.name &&
      ((given.born !== undefined && n.born === given.born) ||
        (!!given.as && given.as !== "rule" && n.as === given.as)),
    holds = realm ? store.holder("command", realm) : undefined;
  return is(holds) ? holds : store.in(cell).find(is);
}

/** Tell a rising, if the year's telling has room for it (the greatest first). */
function tellRise(r: Run, n: Notable, causes: CauseRef[], factors?: Factor[]): void {
  if (n.standing < NOTE.tellAt * NOTE.line) return;
  r.tell.push({
    standing: n.standing,
    id: n.id,
    run: () => {
      const { world } = r,
        deed = n.deeds[0]!,
        decision = factors
          ? world.decisions.record({
              rule: "notable.arose",
              subject: notableRef(n.id),
              outcome: { domain: DOMAINS[deed.d] },
              score: n.standing / NOTE.line,
              threshold: 1,
              factors,
            })
          : null,
        realm = n.realm;
      n.event = world.events.emit({
        type: NOTABLE_EVENTS.arose.type,
        importance: n.standing >= NOTE.great * NOTE.line ? 4 : NOTABLE_EVENTS.arose.importance,
        subjects: realm ? [notableRef(n.id), realm] : [notableRef(n.id)],
        place: r.ctx.provinces.get(n.home)?.ref ?? null,
        causes: decision ? [{ ref: decision, role: "trigger", weight: 1 }, ...causes] : causes,
        data: {
          id: n.id,
          name: n.name,
          domain: DOMAINS[deed.d],
          what: deed.w,
          ...(deed.n ? { of: deed.n } : {}),
          ...(n.many ? { many: true } : {}),
          ...atOf(r, n.home),
        },
      });
    },
  });
}

/** A land as its people call it, for a telling: its first town's name. */
function atOf(r: Run, cell: number): { at?: string } {
  const town = r.ctx.settlements.inProvince(cell)[0]?.name;
  return town ? { at: town } : {};
}

/** One of the living ends: kept among the gone, their post empty, and told if they stood high. */
function end(r: Run, n: Notable, how: string, by: Ref | null): void {
  const { store, year } = r,
    gone: Gone = {
      id: n.id,
      name: n.name,
      sex: n.sex,
      many: n.many,
      born: n.born,
      since: n.since,
      died: year,
      how,
      home: n.home,
      realm: n.realm,
      faith: n.faith,
      field: firstField(n),
      standing: n.standing,
      best: n.best,
      // (Their greatest deeds, two.)
      deeds: [...n.deeds].sort((a, b) => b.g - a.g || a.y - b.y).slice(0, 2),
      ...(n.teacher ? { teacher: n.teacher } : {}),
      ...(n.rival ? { rival: n.rival } : {}),
      ...(n.as ? { as: n.as } : {}),
      ...(by ? { event: by } : {}),
      ...(n.event ? { rose: n.event } : {}),
    };
  store.remove(n.id, gone);
  if (n.best < NOTE.tellAt * NOTE.line) return;
  r.tell.push({
    standing: n.best,
    id: n.id,
    run: () => {
      const realm = n.realm,
        event = r.world.events.emit({
          type: NOTABLE_EVENTS.died.type,
          importance: n.best >= NOTE.great * NOTE.line ? 4 : NOTABLE_EVENTS.died.importance,
          subjects: realm ? [notableRef(n.id), realm] : [notableRef(n.id)],
          place: r.ctx.provinces.get(n.home)?.ref ?? null,
          causes: [
            ...(by ? [{ ref: by, role: "trigger" as const, weight: 1 }] : []),
            ...(n.event ? [{ ref: n.event, role: "enabler" as const, weight: 0.3 }] : []),
          ],
          data: {
            id: n.id,
            name: n.name,
            domain: DOMAINS[gone.field],
            how,
            age: year - n.born,
            ...(gone.deeds[0]?.n ? { of: gone.deeds[0].n } : {}),
            what: gone.deeds[0]?.w ?? "stood out",
            ...(n.many ? { many: true } : {}),
            ...atOf(r, n.home),
          },
        });
      // (The record kept is told by its own event from here on.)
      const kept = store.goneOf(n.id);
      if (kept) (kept as { event?: Ref }).event = event;
    },
  });
}

/** The domain a notable stands highest in. */
export function firstField(n: { readonly by: readonly number[] }): number {
  let best = 0;
  for (let d = 1; d < D; d++) if ((n.by[d] ?? 0) > (n.by[best] ?? 0)) best = d;
  return best;
}

/** The land's standing notable of a domain, the highest. */
function standingIn(store: NotablesStore, cell: number, d: number): Notable | undefined {
  let best: Notable | undefined;
  for (const n of store.in(cell))
    if (
      (n.by[d] ?? 0) > 0 &&
      (!best || n.by[d]! > best.by[d]! || (n.by[d] === best.by[d] && n.id < best.id))
    )
      best = n;
  return best;
}

/** An occasion's deed done: by the land's standing notable of its domain, or by someone new it makes. */
function occasion(r: Run, e: HistoryEvent, o: Occasion, inspired: Map<number, number>): void {
  const { world, store, year } = r,
    realmRef = e.subjects.find((s) => kindCodeOf(s) === "pol"),
    realm = realmRef ? politiesOf(world).get(realmRef) : undefined,
    cell = cellOf(e.place) ?? realm?.seat ?? null;
  if (cell === null || !r.ctx.provinces.get(cell)?.total()) return;
  const data = (e.data ?? {}) as Record<string, unknown>,
    key = serialOf(e.id),
    u = (k: number) => world.rng.real(DRAW, key, r.t, k),
    word = o.note && typeof data[o.note] === "string" ? (data[o.note] as string) : undefined,
    gain = deedGain(e.importance, o.share),
    deed: Deed = { y: year, d: o.d, w: e.type, e: e.id, g: gain, ...(word ? { n: word } : {}) };
  // (A people's choice kept as it was makes no one new.)
  if (e.type === "order.elected" && data.held === true) return;
  /** One who won a people's choice speaks for the group that won, until another does (one who commands a host keeps to it). */
  const speaksNow = (n: Notable): void => {
    if (e.type !== "order.elected" || !realm || typeof data.group !== "string" || n.post) return;
    const was = store.holder("speaks", realm.ref);
    if (was) delete was.post;
    n.post = { kind: "speaks", of: realm.ref, group: data.group };
    store.moved();
  };
  // (One the god inspired this year is the one who found what their land then found.)
  // (And one who led a faith out is named by the faith's own telling: sim/belief.)
  const led = e.type.startsWith("lore.")
      ? inspired.get(cell)
      : typeof data.by === "string"
        ? store.in(cell).find((n) => n.name === data.by)?.id
        : undefined,
    standing = led !== undefined ? store.get(led) : standingIn(store, cell, o.d),
    // (One who founds a faith or leads one out speaks for the new one from then on.)
    spoken = e.type.startsWith("belief.")
      ? e.subjects.find((s) => kindCodeOf(s) === "faith")
      : undefined;
  // (A seat seized is its general's deed, and no one else's: with more of name at a seat (those its people chose), the
  // land's standing one was now and then given a seizing the general did.)
  const byGeneral =
    e.type === "strife.coup" && typeof data.general === "string" && data.general !== "";
  if (
    standing &&
    (!byGeneral || standing.name === data.general) &&
    (led !== undefined || u(1) < doneBy(standing.by[o.d] ?? 0))
  ) {
    // (One person does one such thing a year: where a land's towns each raise a temple in one year, the rest are others' work,
    // and no one is known for them.)
    if (standing.deeds.some((x) => x.y === year && x.w === e.type)) return;
    addDeed(standing, deed);
    if (spoken) standing.faith = spoken;
    if (e.type.startsWith("act.inspire") || e.type === INSPIRED) inspired.set(cell, standing.id);
    speaksNow(standing);
    return;
  }
  // (A seat seized is seized by its general, whom the court may keep already.)
  // (Where the seat is theirs after it, they are its ruler: one person, kept in both places, `as` saying so.)
  const figure =
      e.type === "strife.coup" && realm && typeof data.fig === "number"
        ? courtOf(world)
            ?.of(realm.ref)
            ?.figures.find((f) => f.id === data.fig)
        : undefined,
    rules = e.type === "strife.coup" && realm && realm.ruler.name === data.general,
    general =
      e.type === "strife.coup" && typeof data.general === "string" && data.general
        ? {
            name: data.general,
            sex: rules ? realm.ruler.sex : (figure?.sex ?? 1),
            ...(rules
              ? { born: realm.ruler.born, as: "rule" }
              : figure
                ? { born: figure.born, as: `court:${figure.id}` }
                : {}),
          }
        : undefined,
    // (And the general the world keeps already, as their host's commander or for an earlier seizing, did it: the deed is theirs
    // whether or not it would have made a name alone.)
    same = general
      ? keptAs(store, cell, realm?.ref, {
          ...general,
          ...(typeof data.fig === "number" ? { as: `court:${data.fig}` } : {}),
        })
      : undefined;
  if (same) {
    if (!same.deeds.some((x) => x.y === year && x.w === e.type)) addDeed(same, deed);
    if (rules) same.as = "rule";
    return;
  }
  // (Is the deed weighty enough that the one who did it is noticed for it alone? Among a hive, seldom.)
  // (One who writes a law is known for it where its people read; one a people chose is one of many they have chosen.)
  const read = o.d === DOMAIN.law ? 0.1 + 0.9 * Math.min(1, 2 * readersOf(world, cell)) : 1,
    made = Math.round(0.75 * NOTE.line + gain),
    noticed =
      made >= NOTE.line &&
      u(2) <
        Math.min(1, (e.importance - 2) / 3) *
          read *
          (e.type === "order.elected" ? 0.5 : 1) *
          (r.many ? NOTE.hiveShare : 1);
  if (!noticed && !e.type.startsWith("act.inspire") && e.type !== INSPIRED) return;
  // (One a people chose by name, a party's head: the one who arises is that person, of that name and birth.)
  const chosen =
    e.type === "order.elected" && typeof data.by === "string" && data.by
      ? {
          name: data.by,
          sex: u(3) < 0.5 ? 1 : 0,
          ...(typeof data.born === "number" ? { born: data.born } : {}),
        }
      : undefined;
  const n = arise(r, cell, key, Math.max(NOTE.line, made), deed, general ?? chosen);
  if (e.type.startsWith("act.inspire") || e.type === INSPIRED) inspired.set(cell, n.id);
  if (spoken) n.faith = spoken;
  speaksNow(n);
  tellRise(r, n, [{ ref: e.id, role: "trigger", weight: 1 }]);
}

/** A land's doers by domain, how developed each is there, and what it has to spare for those of name. */
function doersOf(
  r: Run,
  p: Province,
): { doers: number[]; dev: number[]; patronage: number; spare: number } {
  const { ctx, world } = r,
    cell = p.cell,
    people = p.total(),
    m = artMakers(ctx, p),
    readers = readersOf(world, cell),
    learned = learnedOf(world, cell),
    lore = loreOf(world),
    known = Math.min(1, lore.sizeOf(cell) / 80),
    ways = world.hasStore("culture.ways") ? cultureOf(world).get(cell) : undefined,
    piety = ways?.traits[WAY.piety] ?? 0.5,
    care = Math.min(1, lore.effect(cell, "health") / 0.3),
    working = Math.max(1, people - p.occupation(OCC.dependent)),
    traders = p.occupation(OCC.trader),
    art = artOf(world, cell),
    killed = organisedIn(world, cell)?.violence ?? 0,
    rich = notablesOf(world)?.at(cell, DOMAIN.wealth) ?? 0,
    doers = new Array<number>(D).fill(0),
    dev = new Array<number>(D).fill(0);
  // (Those who keep what is known where few read are few; where many are learned, the learned.)
  doers[DOMAIN.knowledge] = people * Math.max(0.0005, learned, 0.01 * readers);
  dev[DOMAIN.knowledge] = known * (0.3 + 0.7 * Math.min(1, readers * 2));
  doers[DOMAIN.making] = m.makers;
  dev[DOMAIN.making] = Math.min(1, 0.4 * known + 0.6 * Math.min(1, art?.renown ?? 0));
  doers[DOMAIN.faith] = m.clergy + people * 0.001 * piety;
  dev[DOMAIN.faith] = piety;
  doers[DOMAIN.wealth] = traders;
  dev[DOMAIN.wealth] = Math.min(1, (traders / working) * 8);
  doers[DOMAIN.healing] = people * 0.002 * (0.2 + care);
  dev[DOMAIN.healing] = care;
  doers[DOMAIN.law] = m.rulers * readers;
  dev[DOMAIN.law] = Math.min(1, readers * 2);
  // (Those who kill for a living: its groups' killing a year, in a hundred thousand of its people.)
  doers[DOMAIN.infamy] = (people * killed) / 1e5;
  dev[DOMAIN.infamy] = 1;
  return {
    doers,
    dev,
    patronage: Math.min(1, m.spare + (rich > 0 ? patronTerm(rich) : 0)),
    spare: m.spare,
  };
}

/**
 * A land's turn. Its people hold only so many names (rules namesHeld): where one is free, whether someone of its doers crosses the
 * line this turn (each domain's rate added), of which domain (by its share of that), and how far (the heavy tail). One at the
 * most a turn; a land whose names are all held notices no one new until a name is let go, unless a deed forces one on it.
 * In a year of sickness out of its turn, only those who tend its sick are weighed, for that year.
 */
function weighLand(r: Run, p: Province, sick: boolean, turn: boolean): void {
  const { world, store, year } = r,
    cell = p.cell,
    here = store.in(cell);
  let held = 0;
  for (const n of here) if (!n.post) held++;
  if (held >= namesHeld(p.total())) return;
  const row = store.row(cell),
    { doers, dev, patronage, spare } = doersOf(r, p),
    u = (k: number) => world.rng.real(DRAW, cell, r.t, k),
    rates = new Array<number>(D).fill(0);
  let all = 0;
  for (let k = 0; k < D; k++) {
    if (!(doers[k]! > 0) || !NOTE.doerYears[k]) continue;
    // (Out of its turn a land is weighed only for those who tend its sick, in a year of sickness.)
    if (!turn && k !== DOMAIN.healing) continue;
    const lineage = row && row[k]! > 0 ? 1 + ACTS.lineage * satOf(row[k]!) : 1;
    rates[k] = arisesRate(
      k,
      doers[k]!,
      dev[k]!,
      k === DOMAIN.infamy ? 1 : patronage,
      lineage * (k === DOMAIN.healing && sick ? 6 : 1),
      here.length,
    );
    all += rates[k]!;
  }
  const chance = (1 - dmath.exp(-all * (turn ? NOTE.every : 1))) * (r.many ? NOTE.hiveShare : 1);
  if (!(all > 0) || !(u(10) < chance)) return;
  // (Of which domain: each by its share of the land's rate.)
  let d = 0,
    at = u(11) * all;
  for (let k = 0; k < D; k++) {
    if (!rates[k]) continue;
    d = k;
    at -= rates[k]!;
    if (at < 0) break;
  }
  {
    const taught = row && row[d]! > 0 ? 1 + ACTS.lineage * satOf(row[d]!) : 1,
      tried = d === DOMAIN.healing && sick ? 6 : 1,
      pat = d === DOMAIN.infamy ? 1 : patronage,
      standing = talentOf(u(30));
    // (The world's names all held by greater: not noticed.)
    if (standing <= r.bar) return;
    const n = arise(r, cell, cell * 16 + d, standing, {
      y: year,
      d,
      w: "stood out",
      e: null,
      g: standing,
    });
    tellRise(
      r,
      n,
      [],
      [
        {
          name: `its doers of this (${Math.round(doers[d]!)})`,
          value: doers[d]!,
          contribution: chance * (rates[d]! / all),
          source: null,
        },
        {
          name: "how far the craft has come there",
          value: dev[d]!,
          contribution: 0.9 * dev[d]!,
          source: null,
        },
        {
          name: "what the land can spare",
          value: spare,
          contribution: 0.7 * spare,
          source: null,
        },
        ...(pat > spare
          ? [
              {
                name: "its rich",
                value: pat - spare,
                contribution: 0.7 * (pat - spare),
                source: null,
              },
            ]
          : []),
        ...(taught > 1
          ? [
              {
                name: "one of name taught there",
                value: taught,
                contribution: taught - 1,
                source: null,
              },
            ]
          : []),
        ...(tried > 1
          ? [
              {
                name: "a sickness tried its healers",
                value: tried,
                contribution: tried - 1,
                source: null,
              },
            ]
          : []),
        ...(here.length
          ? [
              {
                name: "names held already",
                value: here.length,
                contribution: -here.length / (1 + here.length),
                source: null,
              },
            ]
          : []),
      ].slice(0, 6),
    );
  }
}

/** The year's notable people. */
export function notablesYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = notablesOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    r: Run = {
      ctx,
      world,
      store,
      t,
      year,
      many: !keepsPersons(ctx.generated.life.people?.body.social),
      tell: [],
      bar: 0,
    },
    events = world.events;
  // 1. The year's occasions, oldest first.
  const found: HistoryEvent[] = [],
    sick = new Map<number, Ref>(),
    fell = new Map<Ref, Ref>();
  let newest = store.seen;
  for (let i = events.count - 1; i >= 0; i--) {
    const e = events.at(i),
      serial = serialOf(e.id);
    if (serial <= store.seen || e.t <= t - 2 * YEAR) break;
    if (serial > newest) newest = serial;
    if (e.type === SICKNESS) {
      const c = cellOf(e.place);
      if (c !== null) sick.set(c, e.id);
    } else if (OCCASIONS[e.type] || e.type === INSPIRED) found.push(e);
    if (SEAT_FALLS.has(e.type))
      for (const s of e.subjects) if (kindCodeOf(s) === "pol") fell.set(s, e.id);
  }
  store.seen = newest;
  const inspired = new Map<number, number>();
  for (let i = found.length - 1; i >= 0; i--) {
    const e = found[i]!;
    if (e.type !== INSPIRED) {
      occasion(r, e, OCCASIONS[e.type]!, inspired);
      continue;
    }
    // (The god inspired one person: one of name is then the one who finds what their land finds this year; anyone else, and
    // someone of their land is, as when the god inspires a land.)
    const d = e.data as { kind?: string; who?: string } | null,
      cell = cellOf(e.place),
      m = /^note:named:(\d+)$/.exec(d?.who ?? "");
    if (d?.kind !== "inspire" || cell === null) continue;
    if (m && store.get(Number(m[1]))) inspired.set(cell, Number(m[1]));
    else occasion(r, e, OCCASIONS["act.inspire-one"]!, inspired);
  }
  // 2. The lands whose turn it is, and those a sickness tries. (Where the world holds all the names it keeps, one newly
  // noticed must stand past the least of them: read once.)
  {
    const free = store.all().filter((n) => !n.post);
    if (free.length >= NOTE.keepWorld) {
      free.sort((a, b) => b.standing - a.standing || a.id - b.id);
      r.bar = free[NOTE.keepWorld - 1]!.standing;
    }
  }
  for (const p of ctx.provinces.all()) {
    const turn = (year + p.cell) % NOTE.every === 0;
    if ((!turn && !sick.has(p.cell)) || !p.total()) continue;
    weighLand(r, p, sick.has(p.cell), turn);
  }
  // 3. They age, fade, fall with their seat, and die.
  const realms = world.hasStore("polity.states") ? politiesOf(world) : null,
    generation = Math.max(4, Math.round(ctx.life.adulthood / 2));
  for (const n of store.all()) {
    const u = (k: number) => world.rng.real(DRAW, n.id, t, 500 + k),
      age = year - n.born,
      realm = realms?.of(n.home)?.ref ?? null,
      plague = sick.get(n.home),
      falls = n.realm ? fell.get(n.realm) : undefined;
    if (n.favour && n.favour.until < year) delete n.favour;
    const guarded = n.favour?.kind === "protect" || n.favour?.kind === "bless";
    // (Those who served a seat that fell this year, and did not seize it themselves.)
    if (falls && SERVE.has(firstField(n)) && n.last < year && !guarded && u(1) < PURGED) {
      end(r, n, "purge", falls);
      continue;
    }
    if (plague && !guarded && u(2) < SICK_DIES * ((n.by[DOMAIN.healing] ?? 0) > 0 ? 2 : 1)) {
      end(r, n, "sickness", plague);
      continue;
    }
    if (
      u(3) <
      diesWithin(ctx.life, age, 1) * (n.favour?.kind === "curse" ? 2 : guarded ? 0.5 : 1)
    ) {
      // (Of their years where they were old; of the common ills of their time where they were not.)
      end(
        r,
        n,
        age >= 0.75 * (ctx.life.bands[ctx.life.bands.length - 1] ?? 60) ? "age" : "ills",
        null,
      );
      continue;
    }
    // (A post is held of a living realm: a commander of a realm that ended commands no one.)
    if (n.post && !(realms?.get(n.post.of)?.ended === null)) {
      delete n.post;
      store.moved();
    }
    n.realm = realm;
    if (n.last < year - generation) {
      for (let d = 0; d < D; d++) if (n.by[d]) n.by[d] = Math.round(n.by[d]! * (1 - NOTE.fade));
      let s = 0;
      for (let d = 0; d < D; d++) s += n.by[d] ?? 0;
      n.standing = s;
    }
  }
  store.settle(year);
  cull(r);
  // 4. The year's telling: the greatest first.
  r.tell.sort((a, b) => b.standing - a.standing || a.id - b.id);
  for (const x of r.tell.slice(0, NOTE.told)) x.run();
  store.sum();
  store.fold(year);
}

/** The least of a crowded land and a crowded world are let go; the dead fade, and the least of them. */
function cull(r: Run): void {
  const { store, year } = r,
    all = store.all(),
    byLand = new Map<number, Notable[]>();
  const leave = new Set<number>();
  for (const n of all) {
    // (One whose standing has faded to half a line is no longer spoken of.)
    if (n.standing < NOTE.line / 2 && !n.post) {
      leave.add(n.id);
      continue;
    }
    if (n.post) continue;
    const l = byLand.get(n.home);
    if (l) l.push(n);
    else byLand.set(n.home, [n]);
  }
  // (One with a deed this year is on everyone's lips: where a name must be let go it is not theirs, whatever they stand at.
  // Without this the finder of a thing in a land that held all its names was let go the year they found it: at 1,000 on first
  // light one finder was kept of the 74 things found in the century before.)
  // (A deed, not a first noticing: one who merely stood out this year is weighed with the rest. Protected too, a year's
  // noticings took the places of older and greater names each year, on a world with more lands than names kept.)
  const fresh = (n: Notable) =>
      n.last === year && n.deeds[n.deeds.length - 1]?.w !== "stood out" ? 1 : 0,
    rank = (a: Notable, b: Notable) =>
      fresh(b) - fresh(a) || b.standing - a.standing || a.id - b.id;
  for (const [cell, l] of byLand) {
    const held = Math.max(1, namesHeld(r.ctx.provinces.get(cell)?.total() ?? 0));
    if (l.length <= held) continue;
    l.sort(rank);
    for (const n of l.slice(held)) leave.add(n.id);
  }
  const left = all.filter((n) => !leave.has(n.id));
  if (left.length > NOTE.keepWorld) {
    left.sort(rank);
    for (const n of left.slice(NOTE.keepWorld)) if (!n.post) leave.add(n.id);
  }
  for (const id of leave) store.remove(id);
  // (The dead: mourned a generation whatever they were, then kept while past the line; a land's few, a world's few.)
  if (year % 5 !== 0) return;
  const gone = store.gone(),
    perLand = new Map<number, number>(),
    kept: Gone[] = [];
  for (const g of gone) g.standing = Math.round(g.standing * (1 - NOTE.goneFade * 5));
  const ranked = [...gone].sort((a, b) => b.standing - a.standing || a.id - b.id);
  for (const g of ranked) {
    if (kept.length >= NOTE.goneWorld) break;
    if (g.standing < NOTE.line && g.died < year - NOTE.mourned) continue;
    const k = perLand.get(g.home) ?? 0;
    if (k >= NOTE.goneLand) continue;
    perLand.set(g.home, k + 1);
    kept.push(g);
  }
  // (In the order they died, as they were kept.)
  const keep = new Set(kept.map((g) => g.id));
  store.setGone(gone.filter((g) => keep.has(g.id)));
}

// —— The war's commanders (sim/war/war.ts asks before a battle and tells after) ————————————————————————————————

/** Who commands a host: `told` where they stand high enough that a battle is told with their name. */
export type Command = { readonly id: number; readonly name: string; readonly told: boolean } | null;

/**
 * Who commands a realm's host as it takes the field: the one who does already, or someone the day makes (the one its court
 * keeps for its army, where it keeps one), untried, of the line's standing. Null where no one is kept apart.
 */
export function commandIn(ctx: PopulationContext, p: Polity, t: SimTime): Command {
  const { world } = ctx,
    store = notablesOf(world);
  if (!store) return null;
  const held = store.holder("command", p.ref);
  if (held) return { id: held.id, name: held.name, told: held.standing >= NOTE.tellAt * NOTE.line };
  const year = yearOfMoment(t),
    r: Run = {
      ctx,
      world,
      store,
      t,
      year,
      many: !keepsPersons(ctx.generated.life.people?.body.social),
      tell: [],
      bar: 0,
    },
    key = serialOf(p.ref) * 8 + 5,
    figure = courtOf(world)
      ?.of(p.ref)
      ?.figures.find((f) => f.seat === "the army"),
    given =
      figure && !r.many
        ? { name: figure.name, sex: figure.sex, born: figure.born, as: `court:${figure.id}` }
        : undefined,
    deed: Deed = {
      y: year,
      d: DOMAIN.war,
      w: "took command",
      e: null,
      g: NOTE.line,
      n: realmName(p),
    },
    // (The court's soldier whom the world keeps already, for a seat seized or a host led before, is the one who takes it.)
    same = given ? keptAs(store, p.seat, undefined, given) : undefined,
    n = same ?? arise(r, p.seat, key, NOTE.line, deed, given);
  if (n === same) addDeed(n, deed);
  n.post = { kind: "command", of: p.ref };
  store.moved();
  return { id: n.id, name: n.name, told: false };
}

/**
 * A battle fought: each commander's standing by how it went (the fielded on each side), and whether they fell or were taken
 * (their host then shaken a year). Returns what befell each, for the battle's own telling.
 */
export function commandAfter(
  ctx: PopulationContext,
  sides: readonly [Command, Command],
  realms: readonly [Polity, Polity],
  won: boolean,
  fielded: readonly [number, number],
  battle: Ref,
  land: string,
  t: SimTime,
): void {
  const { world } = ctx,
    store = notablesOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    key = serialOf(battle);
  for (let s = 0; s < 2; s++) {
    const n = sides[s] ? store.get(sides[s]!.id) : undefined;
    if (!n) continue;
    const victor = s === 0 ? won : !won,
      foe = sides[1 - s] ? store.get(sides[1 - s]!.id) : undefined,
      gain = fieldGain(n.by[DOMAIN.war] ?? 0, fielded[s]!, fielded[1 - s]!, victor);
    addDeed(n, {
      y: year,
      d: DOMAIN.war,
      w: victor ? "war.battle won" : "war.battle lost",
      e: battle,
      g: gain,
      n: land,
    });
    if (foe) n.rival = foe.id;
    const u = world.rng.real(DRAW, key, t, 700 + s),
      guarded = n.favour?.kind === "protect",
      falls = victor ? FIELD.fallsWon : FIELD.fallsLost;
    if (guarded) continue;
    if (u < falls || (!victor && u < falls + FIELD.taken)) {
      const r: Run = { ctx, world, store, t, year, many: n.many, tell: [], bar: 0 };
      end(r, n, u < falls ? "battle" : "taken", battle);
      // (Told at once: the year's own telling is the notables' year's, and a commander's fall is the battle's news.)
      for (const x of r.tell) x.run();
      store.shake(realms[s]!.ref, year + 1);
    }
  }
}

/**
 * A realm's commander gone from it to raise lands against it (a foiled general fled: sim/strife): its host is no longer theirs.
 */
export function commandLeft(world: World, realm: Ref, name: string): void {
  const store = notablesOf(world),
    n = store?.holder("command", realm);
  if (!n || n.name !== name) return;
  delete n.post;
  store!.moved();
}

/**
 * The god's hand, or a group's, on one of name (a hook: sim/acts/person.ts and the groups may strike, bless, curse or guard):
 * ended at once (`how`: "struck", "killed"), or under a favour until a year.
 */
export function strikeNotable(
  ctx: PopulationContext,
  id: number,
  how: "struck" | "killed" | "executed",
  event: Ref,
  t: SimTime,
): boolean {
  const store = notablesOf(ctx.world),
    n = store?.get(id);
  if (!store || !n) return false;
  const r: Run = {
    ctx,
    world: ctx.world,
    store,
    t,
    year: yearOfMoment(t),
    many: n.many,
    tell: [],
    bar: 0,
  };
  end(r, n, how, event);
  for (const x of r.tell) x.run();
  if (n.post?.kind === "command") store.shake(n.post.of, r.year + 1);
  return true;
}
export function favourNotable(
  world: World,
  id: number,
  kind: "bless" | "curse" | "protect",
  until: number,
  event: Ref,
): boolean {
  const n = notablesOf(world)?.get(id);
  if (!n) return false;
  n.favour = { kind, until, event };
  // (A blessing lifts their name, a curse lowers it: a tenth of a line.)
  if (kind !== "protect") {
    const d = firstField(n),
      by = kind === "bless" ? 100 : -100;
    n.by[d] = Math.max(0, (n.by[d] ?? 0) + by);
    n.standing = Math.max(0, n.standing + by);
  }
  return true;
}

export function installNotables(world: World, ctx: () => PopulationContext): NotablesStore {
  const store = world.register(new NotablesStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "197.people.notables", every: YEAR, run: (t) => notablesYear(ctx(), t) });
  // (A land with the learned of name inquires the more readily: exactly 1 where none is kept.)
  inquiresMore(notableInquires);
  return store;
}
