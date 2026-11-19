// Those a town's offices and great things are held by, whom the world keeps no one for by name: a great house's head (it keeps
// the house, its seat and its head's year of birth), the judge of a court that has one, the one who keeps a land's temple, the
// commander of a realm's host, the richest of a market town's merchants, the head of the gang that leads a street's federation.
// The world holds the thing; who holds it is read from the thing itself, the same every time: a name in the land's tongue and a
// year of birth drawn from a key of the office and the term it is held for, so the same one holds it year on year, another takes
// it when the term is out, and the one before is told as gone. Nothing here is kept, and nothing of the world moves by it: a
// reading, as a court's cases are. Each is one of their town's key figures (host/leaders.ts): a body at a house of their own.
//
// Since 2026-11-18 the world does keep people by name (sim/notable: whoever crossed the line their people notice, their kind read
// off what they did). Where one of them holds what an office here is read from, they ARE its holder: the commander of a realm's
// host is the one the war asks for before each battle; a land's judge, the keeper of its temple and the richest of its merchants
// are its standing notable of law, of its faith, of wealth, where it has one. The drawn name is kept only where the world keeps
// no one. The rest of a land's notables live in its first town as themselves (kind "named"), and the dead among them are read
// from the short record the world keeps (`goneNamed`).
import { hashString, type Ref, type World } from "../../kernel/index.ts";
import { cradleTongue, personName, tonguePersonName } from "../../gen/index.ts";
import { ACTS, DOMAIN, DOMAINS, NOTE, OCC, commandTerm, satOf } from "../../rules/index.ts";
import { NOTABLE_ENDS, deedLine, notableTitle } from "../../causal/index.ts";
import {
  GANG_ROW,
  beliefOf,
  cultureOf,
  gangsStore,
  housesOf,
  firstField,
  lifeOf,
  notablesOf,
  politiesOf,
  populationContext,
  realmName,
  underworldOf,
  warsOf,
  type Deed,
  type GoneNotable,
  type Notable as Named,
  type Polity,
  type Settlement,
} from "../../sim/index.ts";
import type { Block, Leader, PageModel, Place, Stat } from "../../bridge/index.ts";
import { workshopOf } from "../chain.ts";
import { landEra, peopleBody } from "../village.ts";
import { seatTownOf } from "../leaders.ts";
import { fedRef } from "../underworld.ts";
import { boardRef } from "./board.ts";
import { courtFormOf } from "./justice.ts";
import { faithLink, landLink, landTitle, realmLink, townLink } from "./names.ts";
import { item, link, stat, yearNow } from "./words.ts";

export type NotableKind =
  | "house"
  | "judge"
  | "priest"
  | "general"
  | "merchant"
  | "gang"
  /** One the world keeps by name who holds no office here: known for what they did. */
  | "named";

/** One who holds an office or heads a great thing of a town, as read. */
export type Notable = {
  readonly ref: string;
  readonly kind: NotableKind;
  readonly name: string;
  readonly born: number;
  readonly sex: number;
  /** Since when they have held it (null: the world keeps no year for it). */
  readonly since: number | null;
  /** "Judge of the town's bench of Vouguis". */
  readonly title: string;
  /** What they are and do, a sentence. */
  readonly did: string;
  readonly town: string;
  readonly townName: string;
  /** The thing they hold or head: its page and name. */
  readonly of: { readonly ref: string; readonly name: string };
  /** Not in their town now: where they are in words, and where "go to" takes one instead. */
  readonly away?: { readonly words: string; readonly place: Place };
  /** Who held it before them, and until when (the term before's). */
  readonly before?: { readonly ref: string; readonly name: string; readonly year: number };
  /** What of them is read and not kept, in a line for their page. */
  readonly read: string;
  /** The one the world keeps by name whom this is (sim/notable), where it keeps one. */
  readonly sim?: Named;
};

/** A notable the world keeps, by their page's ref. */
export const namedRef = (id: number): string => `note:named:${id}`;
const namedId = (ref: string): number | null => {
  const m = /^note:named:(\d+)$/.exec(ref);
  return m ? Number(m[1]) : null;
};
const KEPT_READ =
  "The world keeps them by name: their standing among their people, what they did, who taught them and how they end.";
const cap1 = (t: string): string => (t ? t[0]!.toUpperCase() + t.slice(1) : t);

/** How long each office is held (years), about: its own term is drawn a little either side by its key. */
type Termed = Exclude<NotableKind, "house" | "named">;
const TERM: Readonly<Record<Termed, number>> = {
  judge: 9,
  priest: 15,
  general: 11,
  merchant: 13,
  gang: 6,
};

const u = (text: string): number => (hashString(text) >>> 0) / 4294967296;

/** The term an office is in, in a year: which one, since when, and until when. */
function termIn(key: string, span: number, year: number): { n: number; from: number; to: number } {
  const long = Math.max(3, Math.round(span * (0.75 + 0.5 * u(`${key}|span`)))),
    phase = Math.floor(u(`${key}|phase`) * long),
    n = Math.floor((year + phase) / long);
  return { n, from: n * long - phase, to: (n + 1) * long - phase };
}

/** A given name in a land's tongue by a key (its people's cradle tongue where the land keeps none). */
function givenName(world: World, cell: number, key: number, sex: number): string {
  const tongue = cultureOf(world).get(cell)?.tongue;
  return tongue
    ? tonguePersonName(tongue, key, sex as 0 | 1)
    : personName(populationContext(world).culture, key, sex as 0 | 1);
}
/** A family's name in a land's tongue by a key: a given name's, as a line's is its founder's. */
function familyName(world: World, cell: number, key: number): string {
  const tongue =
    cultureOf(world).get(cell)?.tongue ?? cradleTongue(populationContext(world).culture);
  return tonguePersonName(tongue, key ^ 0x5f3759df, 1);
}

/** One who holds a termed office, by its key, in a year: the same one through the term. */
function holder(
  world: World,
  key: string,
  kind: Termed,
  cell: number,
  year: number,
): { name: string; born: number; sex: number; since: number; n: number } {
  const t = termIn(key, TERM[kind], year),
    k = hashString(`${key}|${t.n}`) >>> 0,
    sex = kind === "general" || kind === "gang" ? 1 : k & 1,
    grown = lifeOf(world).adulthood;
  return {
    name: `${givenName(world, cell, k, sex)} ${familyName(world, cell, k)}`,
    // (Of an age for it as they take it: a gang's head young, a judge or one who keeps a temple older.)
    born: t.from - grown - (kind === "gang" ? 4 : 14) - Math.floor(u(`${key}|${t.n}|age`) * 12),
    sex,
    since: t.from,
    n: t.n,
  };
}

const first = (world: World, cell: number): Settlement | null =>
  populationContext(world)
    .settlements.inProvince(cell)
    .filter((t) => t.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0] ?? null;

type Kept = { now: number; by: Map<string, readonly Notable[]> };
const KEPT = new WeakMap<World, Kept>();

/** Those who hold a town's offices and head its great things, as read (kept while the world's moment stands). */
export function notablesIn(world: World, town: string): readonly Notable[] {
  let kept = KEPT.get(world);
  if (!kept || kept.now !== world.now) KEPT.set(world, (kept = { now: world.now, by: new Map() }));
  const hit = kept.by.get(town);
  if (hit) return hit;
  const made = read(world, town);
  kept.by.set(town, made);
  return made;
}

/** What was read of a world's towns let go (a test that changes what they are read of). */
export function forgetNotables(world: World): void {
  KEPT.delete(world);
}

function read(world: World, town: string): Notable[] {
  const s = populationContext(world).settlements.get(town as Ref);
  if (!s || s.population <= 0) return [];
  const year = yearNow(world),
    r = politiesOf(world).of(s.cell),
    chief = first(world, s.cell)?.ref === town,
    out: Notable[] = [],
    kept = notablesOf(world),
    // (Those of this land the world keeps by name, the highest first: each holds at most one office here.)
    named = chief && kept ? [...kept.in(s.cell)].sort((a, b) => b.standing - a.standing) : [],
    placed = new Set<number>(),
    /** One the world keeps, as they are here: holding an office, or as themselves. */
    asKept = (
      n: Named,
      kind: NotableKind,
      office?: { title: string; did: string; of: Notable["of"]; away?: Notable["away"] },
    ) => {
      const realm = n.post?.kind === "command" ? politiesOf(world).get(n.post.of) : r,
        known = notableTitle(
          world,
          n,
          realm ? realmName(realm) : null,
          landTitle(world, n.home, true),
        );
      placed.add(n.id);
      out.push({
        ref: namedRef(n.id),
        kind,
        name: n.name,
        born: n.born,
        sex: n.sex,
        since: n.since,
        title: office?.title ?? cap1(known),
        did: office ? `${office.did} Known as ${known}.` : `${cap1(known)}.`,
        town,
        townName: s.name,
        of: office?.of ?? {
          ref: populationContext(world).provinces.get(n.home)?.ref ?? town,
          name: landTitle(world, n.home),
        },
        ...(office?.away ? { away: office.away } : {}),
        read: KEPT_READ,
        sim: n,
      });
    },
    /** A land's standing notable of a domain not yet placed (of its faith, where asked). */
    standing = (d: number, faith?: string): Named | undefined =>
      named.find(
        (n) => !placed.has(n.id) && !n.post && firstField(n) === d && (!faith || n.faith === faith),
      ),
    termed = (
      kind: Termed,
      key: string,
      title: string,
      did: string,
      of: Notable["of"],
      away?: Notable["away"],
      who?: Named,
    ) => {
      if (who) return asKept(who, kind, { title, did, of, ...(away ? { away } : {}) });
      const h = holder(world, key, kind, s.cell, year),
        ref = `note:${kind}:${key}`,
        was = holder(world, key, kind, s.cell, h.since - 1);
      out.push({
        ref,
        kind,
        name: h.name,
        born: h.born,
        sex: h.sex,
        since: h.since,
        title,
        did,
        town,
        townName: s.name,
        of,
        ...(away ? { away } : {}),
        before: { ref: `${ref}~${was.n}`, name: was.name, year: h.since },
        read: "The world keeps this office and what it does, and no one by name for it: who holds it is read from the office and its years, the same every time.",
      });
    };

  // A great house seated in this land, at its first town: its head, born when the house's record says.
  if (chief && r) {
    const rec = housesOf(world)?.of(r.ref);
    for (const h of rec?.houses ?? []) {
      if (h.seat !== s.cell) continue;
      const k = hashString(`${h.event}|${h.generation}|${h.headBorn}`) >>> 0,
        sex = k & 1,
        name = `${givenName(world, s.cell, k, sex)} ${h.name}`;
      out.push({
        ref: `note:house:${r.ref}:${h.event}`,
        kind: "house",
        name,
        born: h.headBorn,
        sex,
        since: null,
        title: `Head of the house of ${h.name}${h.crown ? `, which holds the seat of ${realmName(r)}` : ""}`,
        did: `Heads the house of ${h.name}, seated here since year ${h.since}, in its ${ordinal(h.generation + 1)} generation.`,
        town,
        townName: s.name,
        of: { ref: `${r.ref}#houses`, name: `the house of ${h.name}` },
        read: "The world keeps the house, its seat and the year its head was born; their given name is read from those, the same every time.",
      });
      if (out.length >= 2) break;
    }
  }
  // The judge, where the court is one that has one.
  const form = courtFormOf(world, s);
  if (form === "magistrate" || form === "bench")
    termed(
      "judge",
      town,
      form === "magistrate"
        ? `The ruler's magistrate at ${s.name}`
        : `First of the bench of ${s.name}`,
      form === "magistrate"
        ? `Hears what is brought before the court of ${s.name} in the ruler's name, and says what comes of it.`
        : `Sits first on the bench of ${s.name}, which hears what is brought before it.`,
      { ref: `${town}#law`, name: `the court of ${s.name}` },
      undefined,
      standing(DOMAIN.law),
    );
  // The one who keeps its temple, where it has one and its land a faith.
  const held = beliefOf(world).of(s.cell).faith,
    faith = held ? beliefOf(world).get(held) : undefined,
    temple = workshopOf(world, town, ["temple", "shrine"], year);
  if (faith && temple)
    termed(
      "priest",
      `${town}:${faith.ref}`,
      `Keeper of the temple of ${s.name}`,
      `Keeps the temple of ${s.name} for ${faith.name}, and leads those who pray there on the day of rest.`,
      { ref: faith.ref, name: faith.name },
      undefined,
      standing(DOMAIN.faith, faith.ref),
    );
  // The commander of the realm's host: at its seat in peace; with the host while it is at war.
  if (r && r.ended === null && seatTownOf(world, r)?.ref === town) {
    const war = warsOf(world)
        .fighting(r.ref)
        .find((x) => x.ended === null),
      foe = war
        ? politiesOf(world).get(war.attacker === r.ref ? war.defender : war.attacker)
        : null,
      fought = war?.battles.at(-1);
    termed(
      "general",
      r.ref,
      `Commander of the host of ${realmName(r)}`,
      `Commands the host of ${realmName(r)}${foe ? `, in the field against ${realmName(foe)} since year ${war!.declared}` : ": at its seat while it is at peace"}.`,
      {
        ref: war?.ref ?? r.ref,
        name: war && foe ? `the war against ${realmName(foe)}` : realmName(r),
      },
      war && foe
        ? {
            words: fought
              ? `With the host, in the war against ${realmName(foe)}: it last fought in year ${fought.year}, and that is where to look for them`
              : `With the host, in the war against ${realmName(foe)}: it has fought no battle yet, and marches from the seat's land`,
            place: { scale: "region", cell: fought?.land ?? r.seat },
          }
        : undefined,
      // (The one the war asks for before each battle, where the world keeps one: sim/notable commandIn.)
      kept?.holder("command", r.ref),
    );
  }
  // The richest of a market town's merchants.
  if (s.market !== null)
    termed(
      "merchant",
      `${town}:market`,
      `The richest of the merchants of ${s.name}`,
      `Trades at the market of ${s.name}, and is at their stall on its market days.`,
      { ref: boardRef(town), name: `the market of ${s.name}` },
      undefined,
      standing(DOMAIN.wealth),
    );
  // The head of the gang that leads its street's federation.
  if (chief && r) {
    const row = gangsStore(world),
      id = row?.at(s.cell, GANG_ROW.fedA) ?? 0,
      fed =
        id > 0
          ? underworldOf(world)
              ?.of(r.ref)
              ?.feds.find((f) => f.id === id - 1)
          : undefined;
    if (fed)
      termed(
        "gang",
        `${r.ref}:${fed.event}:${town}`,
        `Head of the leading gang of the ${fed.name} federation in ${s.name}`,
        `Heads the gang of the ${fed.name} federation that keeps a corner of ${s.name}.`,
        { ref: fedRef(r.ref, fed.event), name: `the ${fed.name} federation` },
      );
  }
  // The rest of the land's notables, as themselves.
  for (const n of named) if (!placed.has(n.id) && !n.post) asKept(n, "named");
  return out;
}

/** One the world kept by name who is gone, by their page's ref (null: none such). */
export function goneNamed(world: World, ref: string): GoneNotable | null {
  const id = namedId(ref);
  return id === null ? null : (notablesOf(world)?.goneOf(id) ?? null);
}

/** A name for one the world keeps or kept, by id, and their page (null: let go). */
function namedLink(world: World, id: number | undefined): ReturnType<typeof link> | null {
  if (id === undefined) return null;
  const n = notablesOf(world)?.get(id) ?? notablesOf(world)?.goneOf(id);
  return n ? link(n.name, namedRef(id)) : null;
}

/** A land's notable people for a page: the living by standing, then those remembered. */
export function notablePeopleBlock(world: World, cells: readonly number[], most = 8): Block | null {
  const kept = notablesOf(world);
  if (!kept) return null;
  const set = new Set(cells),
    realm = (r: string | null) => (r ? politiesOf(world).get(r as Ref) : undefined),
    living = cells
      .flatMap((c) => [...kept.in(c)])
      .sort((a, b) => b.standing - a.standing || a.id - b.id)
      .slice(0, most),
    gone = kept
      .gone()
      .filter((g) => set.has(g.home) && g.standing >= NOTE.line)
      .sort((a, b) => b.standing - a.standing || a.id - b.id)
      .slice(0, Math.max(3, most >> 1));
  if (!living.length && !gone.length) return null;
  const year = yearNow(world);
  return {
    type: "list",
    title: "Its notable people",
    items: [
      ...living.map((n) => {
        const r = realm(n.post?.kind === "command" ? n.post.of : n.realm);
        return item(
          [
            link(n.name, namedRef(n.id)),
            `, ${year - n.born}: ${notableTitle(world, n, r ? realmName(r) : null, landTitle(world, n.home, true))}`,
          ],
          namedRef(n.id),
        );
      }),
      ...gone.map((g) => {
        const r = realm(g.realm);
        return item(
          [
            link(g.name, namedRef(g.id)),
            ` (${g.born} to ${g.died}), remembered: ${notableTitle(world, g, r ? realmName(r) : null, landTitle(world, g.home, true))}`,
          ],
          namedRef(g.id),
        );
      }),
    ],
  };
}

const ordinal = (n: number): string =>
  ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"][n] ?? `${n}th`;

/** One who holds an office, by their page's ref (null: none such now; one of a term before reads as gone, by `goneNotable`). */
export function notableOf(world: World, ref: string): Notable | null {
  const town = townOfRef(world, ref);
  return (town && notablesIn(world, town).find((n) => n.ref === ref)) || null;
}

/** The town a notable's ref is of. */
function townOfRef(world: World, ref: string): string | null {
  const m = /^note:([a-z]+):(.+)$/.exec(ref);
  if (!m) return null;
  if (m[1] === "named") {
    const n = notablesOf(world)?.get(Number(m[2]));
    if (!n) return null;
    const of = n.post?.kind === "command" ? politiesOf(world).get(n.post.of) : undefined;
    return (of ? seatTownOf(world, of)?.ref : first(world, n.home)?.ref) ?? null;
  }
  const key = m[2]!,
    town = /^(town:\d+:\d+)/.exec(key)?.[1],
    realm = /^(pol:\d+:\d+)/.exec(key)?.[1],
    inTown = /:(town:\d+:\d+)$/.exec(key)?.[1];
  if (inTown) return inTown;
  if (town) return town;
  const r = realm ? politiesOf(world).get(realm as Ref) : undefined;
  if (!r) return null;
  if (m[1] === "house") {
    const h = housesOf(world)
      ?.of(r.ref)
      ?.houses.find((x) => key.endsWith(x.event));
    return h ? (first(world, h.seat)?.ref ?? null) : null;
  }
  return seatTownOf(world, r)?.ref ?? null;
}

/** One who held an office in a term before the one that holds it now, by their page's ref (`…:<term>`): their name, and when they left it. */
export function goneNotable(
  world: World,
  ref: string,
): { name: string; year: number; now: Notable } | null {
  const m = /^(note:[a-z]+:.+)~(-?\d+)$/.exec(ref),
    now = m ? notableOf(world, m[1]!) : null;
  if (!m || !now || now.kind === "house" || now.kind === "named") return null;
  const key = m[1]!.slice(`note:${now.kind}:`.length),
    cell = populationContext(world).settlements.get(now.town as Ref)?.cell ?? 0;
  // (Back through the terms to theirs: each begins where the one before it ends.)
  let year = now.since ?? yearNow(world);
  for (let k = 0; k < 40; k++) {
    const was = holder(world, key, now.kind, cell, year - 1);
    if (String(was.n) === m[2]) return { name: was.name, year, now };
    year = was.since;
  }
  return null;
}

/** A notable as one of their town's key figures: whom the hand is laid from, and where they live (not one who is away). */
export function notableLeader(world: World, n: Notable): Leader {
  const year = yearNow(world);
  return {
    ref: n.ref,
    kind: "head",
    name: n.name,
    title: n.title,
    did: n.did,
    why: null,
    town: n.town,
    townName: n.townName,
    as: n.away
      ? null
      : {
          name: n.name,
          age: Math.max(lifeOf(world).adulthood, Math.min(300, year - n.born)),
          occupation:
            n.kind === "merchant" || (n.sim && firstField(n.sim) === DOMAIN.wealth)
              ? OCC.trader
              : n.kind === "gang" || (n.sim && firstField(n.sim) === DOMAIN.making)
                ? OCC.crafter
                : OCC.leader,
          sex: n.sex,
        },
    cannot: n.away ? `${n.away.words}.` : null,
  };
}

/** A notable's page: who they are, what they hold, where they live or are, who held it before; the way to them and to their life. */
export function notablePage(world: World, ref: string): PageModel {
  const n = notableOf(world, ref),
    year = yearNow(world),
    dead = n ? null : goneNamed(world, ref);
  if (dead) return gonePage(world, ref, dead);
  // (One the world keeps whose land has no town to show them in: their page all the same, at their land.)
  const apart = n ? null : (notablesOf(world)?.get(namedId(ref) ?? -1) ?? null);
  if (apart) return apartPage(world, ref, apart);
  const gone = n ? null : goneNotable(world, ref);
  if (!n && !gone) throw new Error(`no one holds ${ref}`);
  const s = populationContext(world).settlements.get((n ?? gone!.now).town as Ref)!,
    body = peopleBody(world);
  if (gone) {
    const now = gone.now;
    return {
      ref,
      kind: "person",
      icon: "🕯️",
      title: gone.name,
      subtitle: [`Once ${lower(now.title)}`],
      color: null,
      place: null,
      stats: [stat("Held it until", `year ${gone.year}`)],
      tabs: [
        {
          id: "overview",
          name: "Overview",
          blocks: [
            {
              type: "facts",
              rows: [
                stat("Was", [`${now.title}, of `, link(now.of.name, now.of.ref)]),
                stat(
                  "Until",
                  `year ${gone.year}: their term was out, and history keeps no more of them`,
                ),
                stat("After them", [link(now.name, now.ref)]),
              ],
            },
            { type: "text", lines: [[now.read]] },
          ],
        },
      ],
      followable: false,
      year,
    };
  }
  const who = n!,
    age = year - who.born,
    rows: Stat[] = [
      stat("Born", `year ${who.born}`),
      stat("Who", [who.title, ": ", link(who.of.name, who.of.ref)]),
      ...(who.since !== null ? [stat("Since", `year ${who.since}`)] : []),
      who.away
        ? stat("Where", [who.away.words, ". Their house is in ", townLink(world, who.town), "."])
        : stat("Lives in", [
            townLink(world, who.town),
            ", ",
            landLink(world, s.cell, true),
            ": at their own house",
          ]),
      ...(who.before
        ? [
            stat("Before them", [
              link(who.before.name, who.before.ref),
              `, until year ${who.before.year}`,
            ]),
          ]
        : []),
    ],
    blocks: Block[] = [
      { type: "facts", rows },
      {
        type: "tool",
        tool: "leader.card",
        args: { leader: notableLeader(world, who), short: true },
      },
      { type: "text", lines: [[who.did], [who.read]] },
      ...(who.sim ? keptBlocks(world, who.sim) : []),
    ];
  return {
    ref,
    kind: "person",
    icon: ICON[who.kind],
    portrait: {
      kind: "person",
      ref,
      age,
      span: body?.span ?? 70,
      occupation: who.kind === "merchant" ? OCC.trader : OCC.leader,
      child: false,
      era: landEra(world, s.cell),
      body,
    },
    title: who.name,
    subtitle: [`${age}, ${lower(who.title)}`],
    color: null,
    place: who.away ? who.away.place : { scale: "village", town: who.town, person: ref },
    stats: [
      stat("Age", `${age}`),
      stat("Work", WORK[who.kind]),
      stat("Home", [townLink(world, who.town)]),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: true,
    year,
  };
}
const lower = (t: string): string => (t ? t[0]!.toLowerCase() + t.slice(1) : t);
const ICON: Readonly<Record<NotableKind, string>> = {
  house: "🏰",
  judge: "⚖️",
  priest: "🛐",
  general: "⚔️",
  merchant: "💰",
  gang: "🧍",
  named: "⭐",
};
/** What the world keeps of one of name, for their page: what they did, their ties, what their name does, why they are known. */
function keptBlocks(world: World, n: Named): Block[] {
  const kept = notablesOf(world)!,
    year = yearNow(world),
    lines = (n.standing / NOTE.line).toFixed(1),
    fields = n.by
      .map((x, d) => [d, x] as const)
      .filter(([, x]) => x > 0)
      .sort((a, b) => b[1] - a[1]),
    teacher = namedLink(world, n.teacher),
    rival = namedLink(world, n.rival),
    students = kept
      .all()
      .filter((o) => o.teacher === n.id)
      .slice(0, 4),
    does = fields.map(([d, x]) => DOES[d]?.(x)).filter((t): t is string => !!t),
    court = n.as && n.realm ? `${n.as.replace("court:", `court:${n.realm}:`)}` : null;
  return [
    {
      type: "facts",
      title: "Among their people",
      rows: [
        stat(
          "Standing",
          `${lines} times what it takes to be known by name${n.best > n.standing * 1.1 ? ` (once ${(n.best / NOTE.line).toFixed(1)})` : ""}`,
        ),
        stat("Known for", fields.map(([d]) => FOR[d] ?? DOMAINS[d]!).join(", ")),
        stat("Known since", `year ${n.since}, at ${n.since - n.born}`),
        ...(n.realm ? [stat("Their realm", [realmLink(world, n.realm)])] : []),
        ...(n.faith ? [stat("Their faith", [faithLink(world, n.faith)])] : []),
        ...(court ? [stat("Also", [link("one of their realm's court", court)])] : []),
        ...(teacher ? [stat("Taught by", [teacher])] : []),
        ...(students.length
          ? [
              stat(
                "Taught",
                students.flatMap((o, i) => [i ? ", " : "", link(o.name, namedRef(o.id))]),
              ),
            ]
          : []),
        ...(rival ? [stat("Measured against", [rival])] : []),
        ...(n.favour
          ? [stat("Under the god's hand", `${FAVOUR[n.favour.kind]} until year ${n.favour.until}`)]
          : []),
      ],
    },
    {
      type: "list",
      title: "What they did",
      items: n.deeds.map((d) => deedItem(world, d, n.home, n.many)),
    },
    ...(does.length
      ? [{ type: "text" as const, title: "What their name does", lines: does.map((t) => [t]) }]
      : []),
    ...(n.event
      ? [
          {
            type: "text" as const,
            title: "Why they are known",
            lines: [[link(`How ${n.name} came to be known, and what it rested on`, n.event)]],
          },
        ]
      : []),
    ...(year - n.last > 0 && n.standing < n.best
      ? [
          {
            type: "text" as const,
            lines: [
              [
                `Their last deed was in year ${n.last}. A name with nothing new to it fades a little each year, and is let go below half of what it takes to be known.`,
              ],
            ],
          },
        ]
      : []),
  ];
}
const deedItem = (world: World, d: Deed, home: number, many: boolean) =>
  item(`Year ${d.y}: ${deedLine(world, d, home, many, landTitle(world, home, true))}`, d.e, d.y);
const FOR: readonly string[] = [
  "war",
  "what they know",
  "what they make",
  "their faith",
  "their wealth",
  "moving people",
  "healing",
  "the law",
  "going where none had",
  "the harm they did",
];
const FAVOUR = { bless: "blessed", curse: "cursed", protect: "guarded" } as const;
const pct = (x: number) => `${(Math.abs(x) * 100).toFixed(1)} in a hundred`;
/** What standing in each domain does, in words with its size (sim/notable/kept.ts: the terms the older systems read). */
const DOES: readonly (((x: number) => string) | null)[] = [
  (x) =>
    commandTerm(x) >= 1
      ? `The host they command fights ${pct(commandTerm(x) - 1)} the stronger for them. Should they fall, it is shaken for a year.`
      : `The host they command fights ${pct(1 - commandTerm(x))} the weaker under them.`,
  (x) =>
    `Their land comes upon new things ${pct(ACTS.inquiry * satOf(x))} more readily while they live, and another of the learned is likelier to rise where they taught.`,
  (x) => `Their land's works are ${pct(ACTS.renown * satOf(x))} the more renowned for theirs.`,
  (x) =>
    `Their faith passes from their land to its neighbours ${pct(ACTS.faith * satOf(x))} more readily, and their own land is ${pct(ACTS.faithHolds * satOf(x))} slower to leave it.`,
  (x) =>
    `What they have keeps others of name: their land has ${pct(ACTS.patron * satOf(x))} more to spare for its makers, its learned and its healers.`,
  (x) =>
    `Where they speak for a group in their realm's choosing, its candidate draws others ${pct(ACTS.speaks * satOf(x))} nearer.`,
  (x) => `Of their land's deaths, ${pct(ACTS.heal * satOf(x))} are spared.`,
  null,
  null,
  null,
];

/** The page of one the world keeps by name whose land has no town they could be met in. */
function apartPage(world: World, ref: string, n: Named): PageModel {
  const r =
      n.post?.kind === "command" ? politiesOf(world).get(n.post.of) : politiesOf(world).of(n.home),
    title = notableTitle(world, n, r ? realmName(r) : null, landTitle(world, n.home, true)),
    year = yearNow(world);
  return {
    ref,
    kind: "person",
    icon: "⭐",
    title: n.name,
    subtitle: [`${year - n.born}, ${title}`],
    color: null,
    place: { scale: "region", cell: n.home },
    stats: [stat("Age", `${year - n.born}`), stat("Of", [landLink(world, n.home, true)])],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Born", `year ${n.born}`),
              stat("Who", cap1(title)),
              stat("Lives in", [
                landLink(world, n.home, true),
                ": a land with no town to find them in, so there is no house of theirs to go to",
              ]),
            ],
          },
          { type: "text", lines: [[KEPT_READ]] },
          ...keptBlocks(world, n),
        ],
      },
    ],
    followable: false,
    year,
  };
}

/** The page of one the world kept by name who is gone. */
function gonePage(world: World, ref: string, g: GoneNotable): PageModel {
  const r = g.realm ? politiesOf(world).get(g.realm) : undefined,
    title = notableTitle(world, g, r ? realmName(r) : null, landTitle(world, g.home, true)),
    teacher = namedLink(world, g.teacher),
    rival = namedLink(world, g.rival),
    year = yearNow(world),
    end = NOTABLE_ENDS[g.how] ?? "was gone";
  return {
    ref,
    kind: "person",
    icon: "🕯️",
    title: g.name,
    subtitle: [`${g.born} to ${g.died}: ${title}`],
    color: null,
    place: { scale: "region", cell: g.home },
    stats: [stat("Died", `year ${g.died}, at ${g.died - g.born}`)],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Was", cap1(title)),
              stat("Of", [landLink(world, g.home, true)]),
              stat("Born", `year ${g.born}`),
              stat("Known from", `year ${g.since}`),
              stat("End", [
                `In year ${g.died}, at ${g.died - g.born}: ${end}`,
                ...(g.event ? [". ", link("What is told of it", g.event)] : []),
              ]),
              stat(
                "Remembered",
                g.standing >= NOTE.line
                  ? `${(g.standing / NOTE.line).toFixed(1)} times what it takes to be known by name, ${year - g.died} years on`
                  : "still spoken of by those who knew them; history will let them go",
              ),
              ...(r ? [stat("Their realm", [realmLink(world, r.ref)])] : []),
              ...(g.faith ? [stat("Their faith", [faithLink(world, g.faith)])] : []),
              ...(teacher ? [stat("Taught by", [teacher])] : []),
              ...(rival ? [stat("Measured against", [rival])] : []),
            ],
          },
          {
            type: "list",
            title: "What they did",
            items: g.deeds.map((d) => deedItem(world, d, g.home, g.many)),
          },
          ...(g.rose
            ? [
                {
                  type: "text" as const,
                  title: "Why they were known",
                  lines: [[link(`How ${g.name} came to be known`, g.rose)]],
                },
              ]
            : []),
          { type: "text", lines: [[KEPT_READ]] },
        ],
      },
    ],
    followable: false,
    year,
  };
}

const WORK: Readonly<Record<NotableKind, string>> = {
  house: "head of a house",
  judge: "judge",
  priest: "keeper of a temple",
  general: "commander of a host",
  merchant: "merchant",
  gang: "head of a gang",
  named: "one known by name",
};

/** A realm's own of these, for its leaders: its host's commander and the heads of the houses seated at its seat. */
export function realmNotables(world: World, r: Polity): Notable[] {
  const seat = seatTownOf(world, r);
  if (!seat) return [];
  const at = notablesIn(world, seat.ref),
    own = at.filter((n) => n.kind === "general" || n.kind === "house"),
    // (And the highest of those its lands know by name, wherever in it they live: three.)
    has = new Set(own.map((n) => n.ref)),
    kept = notablesOf(world),
    named = kept
      ? r.members
          .flatMap((c) => [...kept.in(c)])
          .filter((n) => !n.post && !has.has(namedRef(n.id)))
          .sort((a, b) => b.standing - a.standing || a.id - b.id)
          .slice(0, 3)
          .map((n) => notableOf(world, namedRef(n.id)))
          .filter((n): n is Notable => n !== null)
      : [];
  return [...own, ...named];
}
