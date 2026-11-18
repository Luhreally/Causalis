// Those a town's offices and great things are held by, whom the world keeps no one for by name: a great house's head (it keeps
// the house, its seat and its head's year of birth), the judge of a court that has one, the one who keeps a land's temple, the
// commander of a realm's host, the richest of a market town's merchants, the head of the gang that leads a street's federation.
// The world holds the thing; who holds it is read from the thing itself, the same every time: a name in the land's tongue and a
// year of birth drawn from a key of the office and the term it is held for, so the same one holds it year on year, another takes
// it when the term is out, and the one before is told as gone. Nothing here is kept, and nothing of the world moves by it: a
// reading, as a court's cases are. Each is one of their town's key figures (host/leaders.ts): a body at a house of their own.
import { hashString, type Ref, type World } from "../../kernel/index.ts";
import { cradleTongue, personName, tonguePersonName } from "../../gen/index.ts";
import { OCC } from "../../rules/index.ts";
import {
  GANG_ROW,
  beliefOf,
  cultureOf,
  gangsStore,
  housesOf,
  lifeOf,
  politiesOf,
  populationContext,
  realmName,
  underworldOf,
  warsOf,
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
import { landLink, townLink } from "./names.ts";
import { link, stat, yearNow } from "./words.ts";

export type NotableKind = "house" | "judge" | "priest" | "general" | "merchant" | "gang";

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
};

/** How long each office is held (years), about: its own term is drawn a little either side by its key. */
const TERM: Readonly<Record<Exclude<NotableKind, "house">, number>> = {
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
  kind: Exclude<NotableKind, "house">,
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
    termed = (
      kind: Exclude<NotableKind, "house">,
      key: string,
      title: string,
      did: string,
      of: Notable["of"],
      away?: Notable["away"],
    ) => {
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
  return out;
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
  if (!m || !now || now.kind === "house") return null;
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
            n.kind === "merchant" ? OCC.trader : n.kind === "gang" ? OCC.crafter : OCC.leader,
          sex: n.sex,
        },
    cannot: n.away ? `${n.away.words}.` : null,
  };
}

/** A notable's page: who they are, what they hold, where they live or are, who held it before; the way to them and to their life. */
export function notablePage(world: World, ref: string): PageModel {
  const n = notableOf(world, ref),
    gone = n ? null : goneNotable(world, ref),
    year = yearNow(world);
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
};
const WORK: Readonly<Record<NotableKind, string>> = {
  house: "head of a house",
  judge: "judge",
  priest: "keeper of a temple",
  general: "commander of a host",
  merchant: "merchant",
  gang: "head of a gang",
};

/** A realm's own of these, for its leaders: its host's commander and the heads of the houses seated at its seat. */
export function realmNotables(world: World, r: Polity): Notable[] {
  const seat = seatTownOf(world, r);
  return seat
    ? notablesIn(world, seat.ref).filter((n) => n.kind === "general" || n.kind === "house")
    : [];
}
