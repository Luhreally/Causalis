// What binds realms, as pages (D1): a realm's bonds tab, a war's sides, a bloc, a league, a marriage, an envoy. It reads, it never touches. A bloc is who stands
// with whom now: a realm stands with the strongest it is bound to, if that one is stronger than it, so a chain of pacts ends at one head and no bloc swallows
// a world by a long thin thread. Each thing bound says why, and links to what made it. Words read off what a people is: a hive gives of its brood, a people of
// the water graft a reef, those who choose their rulers foster each other's young.
import { hashString, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { offworldSite } from "../../gen/index.ts";
import {
  bondsOf,
  diplomacyOf,
  fieldedOf,
  homePlanet,
  livingMatches,
  misreadOf,
  politiesOf,
  populationContext,
  realmName,
  tieFormOf,
  tiesOf,
  warsOf,
  type Envoy,
  type League,
  type Polity,
  type Relation,
  type TieCall,
  type War,
} from "../../sim/index.ts";
import { BOND_WORDS, CALL_WHY, ERRAND_WORDS, leagueWords } from "../../causal/index.ts";
import type { Block, Item, Line, PageModel, Stat, Tab } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { realmLink, spotOfLand } from "./names.ts";
import { claimOf, count, item, link, many, stat, yearNow } from "./words.ts";

type Rgb = readonly [number, number, number];

const BOND_NAMES: Readonly<Record<string, string>> = {
  overlord: "its overlord",
  vassal: "sworn to it",
  league: "of its compact",
  pact: "sworn by a pact",
  kin: "kin by a marriage",
};

/** What a marriage is called, by what a people has for one. */
const FORM_NAMES: Readonly<Record<string, string>> = {
  wed: "A marriage",
  foster: "A fostering",
  brood: "A gift of brood",
  graft: "A grafted reef",
};

type BlocRead = {
  /** Each realm's head. */
  readonly head: ReadonlyMap<string, Ref>;
  /** Each head with those who stand with it (itself first, then the strongest): only blocs of two or more. */
  readonly blocs: ReadonlyMap<string, readonly Ref[]>;
};

const MEMO = new Map<World, { year: number; count: number; read: BlocRead }>();

/** Who stands with whom: read once a year (the strength of each realm is its host as fielded, without its arms: cheap on seven hundred realms). */
export function blocsOf(world: World): BlocRead {
  const year = yearOfMoment(world.now),
    events = world.events.count,
    hit = MEMO.get(world);
  if (hit && hit.year === year && hit.count === events) return hit.read;
  const ctx = populationContext(world),
    realms = politiesOf(world),
    living = realms.living(),
    strength = new Map<string, number>();
  for (const p of living) strength.set(p.ref, fieldedOf(ctx, p));
  const s = (r: Ref) => strength.get(r) ?? 0,
    stronger = (a: Ref, b: Ref) => s(a) > s(b) || (s(a) === s(b) && a < b),
    leader = new Map<string, Ref>(),
    offer = (who: Ref, to: Ref) => {
      if (!strength.has(to) || !stronger(to, who)) return;
      const had = leader.get(who);
      if (!had || stronger(to, had)) leader.set(who, to);
    };
  for (const r of diplomacyOf(world).all())
    if (r.pact) {
      offer(r.a, r.b);
      offer(r.b, r.a);
    }
  const store = tiesOf(world);
  for (const l of store.open()) {
    const top = [...l.members].sort((a, b) => s(b) - s(a) || (a < b ? -1 : 1))[0];
    if (top) for (const m of l.members) if (m !== top) leader.set(m, top);
  }
  // (An oath binds before all else.)
  for (const b of bondsOf(world).all())
    if (b.kind === "vassal" && strength.has(b.to)) leader.set(b.from, b.to);
  const head = new Map<string, Ref>(),
    climb = (r: Ref) => {
      let at = r,
        steps = 0;
      while (leader.has(at) && steps++ < 64) at = leader.get(at)!;
      return at;
    };
  for (const p of living) head.set(p.ref, climb(p.ref));
  const lists = new Map<string, Ref[]>();
  for (const p of living) {
    const h = head.get(p.ref)!;
    (lists.get(h) ?? lists.set(h, []).get(h)!).push(p.ref);
  }
  const blocs = new Map<string, readonly Ref[]>();
  for (const [h, list] of lists)
    if (list.length >= 2)
      blocs.set(
        h,
        [...list].sort(
          (a, b) => Number(b === h) - Number(a === h) || s(b) - s(a) || (a < b ? -1 : 1),
        ),
      );
  const read = { head, blocs };
  MEMO.clear();
  MEMO.set(world, { year, count: events, read });
  return read;
}

/**
 * An alliance's colours: as far apart as a map's can be, and none the grey of those who stand
 * alone, the sea's deep blue, or a realm's pale own (so an alliance never reads as one realm).
 */
export const ALLIANCE_COLORS: readonly Rgb[] = [
  [0.9, 0.2, 0.18],
  [0.98, 0.56, 0.08],
  [0.98, 0.88, 0.14],
  [0.56, 0.86, 0.12],
  [0.08, 0.6, 0.22],
  [0.06, 0.74, 0.68],
  [0.55, 0.28, 0.92],
  [0.9, 0.22, 0.8],
  [1, 0.6, 0.74],
  [0.62, 0.36, 0.14],
  [0.56, 0.06, 0.2],
  [0.74, 0.66, 1],
];
/** Those who stand alone, under the alliances lens: dim, so the alliances are what is seen. */
export const ALONE_COLOR: Rgb = [0.34, 0.34, 0.32];

/** The colour each alliance was given, kept while it stands (a map read again keeps its colours). */
const GIVEN = new WeakMap<World, Map<string, number>>();

/**
 * Each standing alliance's colour, by its head: the one it had, else its own if free, else the next
 * free; with more alliances than colours, the colour of those furthest off (by their heads' seats,
 * `at` a spot's latitude and longitude), so two of one colour are never neighbours if it can be helped.
 */
function allianceColors(
  world: World,
  heads: readonly string[],
  at: (head: string) => readonly [number, number] | null,
): Map<string, Rgb> {
  const had = GIVEN.get(world) ?? new Map<string, number>(),
    kept = new Map<string, number>(),
    used = new Set<number>(),
    n = ALLIANCE_COLORS.length,
    // (The angle between two seats, as its cosine: the larger, the nearer.)
    near = (a: readonly [number, number], b: readonly [number, number]) =>
      Math.sin(a[0]) * Math.sin(b[0]) + Math.cos(a[0]) * Math.cos(b[0]) * Math.cos(a[1] - b[1]);
  for (const h of heads) {
    const i = had.get(h);
    if (i !== undefined && !used.has(i)) {
      kept.set(h, i);
      used.add(i);
    }
  }
  for (const h of [...heads].sort()) {
    if (kept.has(h)) continue;
    const own = (hashString(h) >>> 0) % n;
    let i = own;
    for (let step = 0; step < n && used.has(i); step++) i = (own + step + 1) % n;
    if (used.has(i)) {
      const here = at(h);
      let best = Infinity;
      for (let c = 0; c < n && here; c++) {
        let nearest = -Infinity;
        for (const [o, oc] of kept) {
          const there = oc === c ? at(o) : null;
          if (there) nearest = Math.max(nearest, near(here, there));
        }
        if (nearest < best) {
          best = nearest;
          i = c;
        }
      }
    }
    kept.set(h, i);
    used.add(i);
  }
  GIVEN.set(world, kept);
  return new Map([...kept].map(([h, i]) => [h, ALLIANCE_COLORS[i]!]));
}

/** An alliance as the map and the list tell it: who stands in it, how much it holds, since when, what it fights. */
export type Alliance = {
  readonly head: Ref;
  readonly ref: string;
  readonly name: string;
  readonly color: Rgb;
  /** Its head first, then the strongest. */
  readonly members: readonly Ref[];
  readonly lands: number;
  readonly people: number;
  /** The year of its oldest bond still standing (null: none written down). */
  readonly since: number | null;
  /** The wars its realms fight now, and against whom (those outside it). */
  readonly wars: readonly { readonly war: Ref; readonly foe: Ref }[];
  /** The compact it is, if it is one (it keeps the name it was sworn by). */
  readonly compact: League | undefined;
};

const ALLIED = new Map<World, { year: number; count: number; list: Alliance[] }>();

const RELATIONS = new WeakMap<
  World,
  { year: number; count: number; by: Map<string, Relation[]> }
>();

/** Each realm's relations, by realm: read in one pass (diplomacy's own `of` reads every relation each time it is asked). */
export function relationsOf(world: World): ReadonlyMap<string, readonly Relation[]> {
  const year = yearOfMoment(world.now),
    events = world.events.count,
    hit = RELATIONS.get(world);
  if (hit && hit.year === year && hit.count === events) return hit.by;
  const by = new Map<string, Relation[]>();
  for (const x of diplomacyOf(world).all()) {
    (by.get(x.a) ?? by.set(x.a, []).get(x.a)!).push(x);
    (by.get(x.b) ?? by.set(x.b, []).get(x.b)!).push(x);
  }
  RELATIONS.set(world, { year, count: events, by });
  return by;
}

/** Every standing alliance, the greatest first (by its people, then its realms): read once a year. */
export function alliancesOf(world: World): Alliance[] {
  const year = yearOfMoment(world.now),
    events = world.events.count,
    hit = ALLIED.get(world);
  if (hit && hit.year === year && hit.count === events) return hit.list;
  const read = blocsOf(world),
    realms = politiesOf(world),
    ctx = populationContext(world),
    g = homePlanet(world).generated,
    store = tiesOf(world),
    relations = relationsOf(world),
    bonds = bondsOf(world),
    wars = warsOf(world),
    colors = allianceColors(world, [...read.blocs.keys()], (h) => {
      const seat = realms.get(h as Ref)?.seat,
        spot = seat === undefined ? undefined : g.centre[seat];
      return spot === undefined ? null : [g.fine.grid.lat[spot]!, g.fine.grid.lon[spot]!];
    }),
    yearOf = (e: Ref | null | undefined) => {
      const t = e ? world.events.get(e)?.t : undefined;
      return t === undefined ? null : Math.floor(t / (365 * 86400));
    },
    list: Alliance[] = [];
  for (const [head, members] of read.blocs) {
    const inIt = new Set<string>(members);
    let lands = 0,
      people = 0,
      since: number | null = null;
    const older = (y: number | null) => {
      if (y !== null && (since === null || y < since)) since = y;
    };
    for (const r of members) {
      const p = realms.get(r);
      if (!p) continue;
      for (const c of p.members) {
        if (offworldSite(g, c)) continue;
        lands++;
        people += ctx.provinces.get(c)?.total() ?? 0;
      }
      for (const x of relations.get(r) ?? [])
        if (x.pact && inIt.has(x.a === r ? x.b : x.a)) older(yearOf(x.pact));
      const oath = bonds.oathOf(r);
      if (oath && inIt.has(oath.to)) older(oath.since);
    }
    const compact = store
      .open()
      .find((l) => l.members.includes(head as Ref) && l.members.every((m) => inIt.has(m)));
    if (compact) older(compact.since);
    const fought = new Map<string, { war: Ref; foe: Ref }>();
    for (const r of members)
      for (const w of wars.fighting(r)) {
        const foe = w.attacker === r ? w.defender : w.attacker;
        if (!inIt.has(foe) && !fought.has(w.ref)) fought.set(w.ref, { war: w.ref, foe });
      }
    list.push({
      head: head as Ref,
      ref: `bloc:${head}`,
      name: compact ? leagueName(world, compact) : blocName(world, head),
      color: colors.get(head) ?? ALONE_COLOR,
      members,
      lands,
      people,
      since,
      wars: [...fought.values()],
      compact,
    });
  }
  list.sort(
    (a, b) =>
      b.people - a.people || b.members.length - a.members.length || (a.head < b.head ? -1 : 1),
  );
  ALLIED.clear();
  ALLIED.set(world, { year, count: events, list });
  return list;
}

/** The alliance a land's realm stands in, as the alliances lens's tooltip tells it (null: it stands alone). */
export function allianceOfLand(
  world: World,
  land: number,
): { line: string; stats: { label: string; value: string }[] } | null {
  const r = politiesOf(world).of(land),
    a = r ? alliancesOf(world).find((x) => x.members.includes(r.ref)) : undefined;
  if (!r || !a) return null;
  return {
    line: `${r.town} stands in ${a.name}: a press opens it`,
    stats: [
      { label: "Realms", value: count(a.members.length) },
      { label: "People", value: count(a.people) },
      { label: "At war", value: a.wars.length ? many(a.wars.length, "war", "wars") : "at peace" },
    ],
  };
}

/** The alliances lens: every alliance at once, each its own colour over all its realms' lands; those who stand alone, dim. */
export function blocsLens(world: World) {
  const g = homePlanet(world).generated,
    read = blocsOf(world),
    realms = politiesOf(world),
    list = alliancesOf(world),
    colorOf = new Map(list.map((a) => [a.head as string, a.color])),
    lands: [number, Rgb][] = [],
    // (Each land in an alliance, and which: a press on it opens its alliance.)
    allied: [number, string][] = [];
  let alone = 0;
  for (const p of realms.living()) {
    const h = read.head.get(p.ref),
      color = (h !== undefined && colorOf.get(h)) || ALONE_COLOR;
    if (color === ALONE_COLOR) alone++;
    for (const c of p.members) {
      if (offworldSite(g, c)) continue;
      lands.push([c, color]);
      if (color !== ALONE_COLOR) allied.push([c, `bloc:${h}`]);
    }
  }
  const top = list[0];
  return {
    lands,
    allied,
    blocs: list.length,
    alliances: list.map((a) => ({
      ref: a.ref,
      name: a.name,
      town: realms.get(a.head)?.town ?? a.name,
      color: a.color,
      realms: a.members.length,
      people: a.people,
      // (Its head's seat, and the spot at its middle, to turn the globe to it.)
      seat: realms.get(a.head)?.seat ?? null,
      centre: g.centre[realms.get(a.head)?.seat ?? -1] ?? null,
    })),
    note: top
      ? `${many(list.length, "alliance", "alliances")}; ${count(alone)} ${alone === 1 ? "realm stands" : "realms stand"} alone`
      : "each realm stands alone: there is no alliance",
    biggest: top ? top.ref : null,
  };
}

const named = (world: World, r: Ref) => realmLink(world, r);

/** How a people's league is called. */
export function leagueName(world: World, l: League): string {
  const h = politiesOf(world).get(l.against);
  return leagueWords(l.town, h ? tieFormOf(world, h) : "wed");
}

/** A call, as a line anyone can read aloud. */
export function callLine(world: World, c: TieCall): Line {
  return [
    `Year ${c.year}: `,
    named(world, c.friend),
    " called ",
    named(world, c.called),
    " against ",
    named(world, c.foe),
    `, by ${BOND_WORDS[c.bond] ?? "what was between them"}. `,
    link(`It ${CALL_WHY[c.why] ?? "gave no answer"}.`, c.event),
    ...(c.opened ? [" ", link("Its war.", c.opened)] : []),
  ];
}

/** A war's own side of it: those who came, those who wouldn't, those it was called to. */
export function warSideBlocks(world: World, w: War): { stats: Stat[]; blocks: Block[] } {
  const store = tiesOf(world),
    calls = store.callsIn(w.ref),
    wars = warsOf(world),
    said = world.events.get(w.event)?.data as {
      aim?: string;
      call?: Ref;
      friendRef?: Ref;
      bond?: string;
    } | null,
    came = wars
      .hotOf(w.defender)
      .concat(w.attacker === w.defender ? [] : wars.hotOf(w.attacker))
      .filter((x) => (world.events.get(x.event)?.data as { call?: Ref } | null)?.call === w.ref),
    seen = new Set<string>(),
    items: Item[] = [],
    stats: Stat[] = [];
  for (const x of came) {
    if (seen.has(x.ref)) continue;
    seen.add(x.ref);
    items.push(
      item(
        [
          named(world, x.attacker),
          " came to fight ",
          named(world, x.defender),
          ". ",
          link("Its war.", x.ref),
        ],
        x.ref,
        x.declared,
      ),
    );
  }
  const stood = calls.filter((c) => !c.came);
  if (seen.size)
    stats.push(
      stat(
        "With allies",
        `${count(seen.size + 2)} realms in it: ${many(seen.size, "came", "came")}`,
        { why: w.event },
      ),
    );
  if (stood.length) stats.push(stat("Called, and stood by", many(stood.length, "realm", "realms")));
  if (said?.aim === "ally" && said.call)
    stats.push(
      stat(
        "Called to",
        [
          link("the war", said.call),
          " of ",
          ...(said.friendRef ? [named(world, said.friendRef)] : ["a friend"]),
          `, by ${BOND_WORDS[said.bond ?? ""] ?? "what was between them"}`,
        ],
        { why: said.call },
      ),
    );
  const blocks: Block[] = [];
  if (items.length || stood.length)
    blocks.push({
      type: "list",
      title: "Who was called",
      items: [...items, ...stood.map((c) => item(callLine(world, c), c.event, c.year))],
    });
  return { stats, blocks };
}

/** Who a match was, and whose: for a realm's page. */
function matchLines(world: World, r: Polity, year: number): Item[] {
  return livingMatches(world, r.ref, year).map((m) => {
    const other = politiesOf(world).get(m.with),
      name = FORM_NAMES[m.form ?? "wed"] ?? "A marriage";
    return item(
      [
        link(`${name}, year ${m.year}`, `match:${m.event}`),
        `: ${m.who}${m.tie === "child" && m.of ? `, child of ${m.of},` : ""} and ${m.to} of `,
        other ? named(world, other.ref) : "a realm now gone",
        `. Anyone of it could come forward if the house of ${r.town} ends.`,
      ],
      `match:${m.event}`,
      m.year,
    );
  });
}

/** What a realm thinks it knows of another's host. */
function knownLine(world: World, r: Polity, q: Polity): Line {
  const ctx = populationContext(world),
    year = yearNow(world),
    truth = fieldedOf(ctx, q),
    factor = misreadOf(world, r.ref, q.ref, year),
    believed = Math.round(truth * factor),
    kept = tiesOf(world).embassyOf(r.ref, q.ref);
  return [
    named(world, q.ref),
    `: ${r.town} believes its host is about ${count(believed)}; it is ${count(Math.round(truth))}. `,
    kept ? `Their people at that seat keep it true.` : `No one of theirs is there to say.`,
  ];
}

/** Who a realm stands with, its calls and its envoys: its page's tab. */
export function realmTiesTab(world: World, r: Polity): Tab {
  const year = yearNow(world),
    store = tiesOf(world),
    realms = politiesOf(world),
    blocs = blocsOf(world),
    h = blocs.head.get(r.ref),
    bloc = h ? blocs.blocs.get(h) : undefined,
    pacts = diplomacyOf(world)
      .of(r.ref)
      .filter((x) => x.pact)
      .map((x) => (x.a === r.ref ? x.b : x.a)),
    league = store.leagueOf(r.ref),
    against = store.open().filter((l) => l.against === r.ref),
    oath = bondsOf(world).oathOf(r.ref),
    vassals = bondsOf(world).vassalsOf(r.ref),
    rows: Stat[] = [];
  const allied = bloc ? alliancesOf(world).find((a) => a.head === h) : undefined;
  if (bloc)
    rows.push(
      stat("Stands with", [link(cap(allied?.name ?? blocName(world, h!)), `bloc:${h}`)], {
        why: `bloc:${h}`,
      }),
    );
  else rows.push(stat("Stands with", "no one: it is bound to none stronger, and none to it"));
  rows.push(stat("Alliances", [link("Every alliance in the world", "world:alliances")]));
  if (oath) rows.push(stat("Sworn to", [named(world, oath.to)], { why: oath.event }));
  if (vassals.length)
    rows.push(
      stat(
        "Sworn to it",
        vassals.flatMap((b, i) => [...(i ? [", "] : []), named(world, b.from)]),
      ),
    );
  if (pacts.length)
    rows.push(
      stat(
        "Pacts",
        pacts.slice(0, 8).flatMap((q, i) => [...(i ? [", "] : []), named(world, q)]),
      ),
    );
  if (league)
    rows.push(
      stat("Sworn with", [link(leagueName(world, league), `league:${league.event}`)], {
        why: league.event,
      }),
    );
  for (const l of against)
    rows.push(
      stat("Feared by", [link(leagueName(world, l), `league:${l.event}`)], { why: l.event }),
    );
  const blocks: Block[] = [{ type: "facts", rows }],
    matches = matchLines(world, r, year),
    calls = store
      .callsOf(r.ref)
      .slice(-10)
      .reverse()
      .map((c) => item(callLine(world, c), c.event, c.year)),
    embassies = store.embassiesOf(r.ref),
    knownOf = [
      ...embassies.map((e) => (e.a === r.ref ? e.b : e.a)),
      ...pacts.filter((q) => !store.embassyOf(r.ref, q)),
    ]
      .map((q) => realms.get(q))
      .filter((q): q is Polity => !!q && q.ended === null)
      .slice(0, 5),
    envoys = store
      .envoys()
      .filter((e) => e.from === r.ref || e.to === r.ref)
      .slice(-6)
      .reverse()
      .map((e) => item(envoyLine(world, e), `envoy:${e.event}`, e.year));
  if (matches.length)
    blocks.push({ type: "list", title: "Whose houses it is tied to", items: matches });
  if (calls.length) blocks.push({ type: "list", title: "Called, and answered", items: calls });
  if (knownOf.length)
    blocks.push({
      type: "list",
      title: "What it knows of others' hosts",
      items: knownOf.map((q) => item(knownLine(world, r, q), q.ref)),
    });
  if (envoys.length) blocks.push({ type: "list", title: "Envoys", items: envoys });
  return { id: "ties", name: "Bonds", blocks };
}

/** An envoy, as a line. */
export function envoyLine(world: World, e: Envoy): Line {
  return [
    link(`${e.name}, year ${e.year}`, `envoy:${e.event}`),
    ": from ",
    named(world, e.from),
    " to ",
    named(world, e.to),
    `, carrying ${ERRAND_WORDS[e.errand] ?? "word"}. Told ${e.answer === "no" ? "no" : "yes"}.`,
  ];
}

/** An alliance by whoever stands at its head (the UI's "alliance": "league" is a realm's title already). */
const blocName = (world: World, head: string): string => {
  const p = politiesOf(world).get(head as Ref);
  return p ? `the alliance of ${p.town}` : "those who stood together";
};

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** How a realm stands in an alliance: at its head, sworn, of its compact, or by a pact. */
export function standsHow(world: World, head: Ref, list: readonly Ref[], r: Ref): string {
  const realms = politiesOf(world);
  if (r === head) return "at its head";
  const oath = bondsOf(world).oathOf(r);
  if (oath && list.includes(oath.to)) return `sworn to ${realms.get(oath.to)?.town ?? "another"}`;
  const l = tiesOf(world).leagueOf(r);
  if (l && l.members.includes(head)) return `of ${leagueName(world, l)}`;
  const diplomacy = diplomacyOf(world),
    by = list.find((q) => q !== r && diplomacy.get(q, r)?.pact);
  return by ? `by a pact with ${realms.get(by)?.town ?? "another"}` : "by those it is sworn to";
}

/** What an alliance fights now, as a line: against whom, each a link (empty: at peace). */
function warsLine(world: World, a: Alliance): Line {
  const foes = [...new Map(a.wars.map((w) => [w.foe as string, w])).values()];
  if (!foes.length) return [];
  return [
    "At war with ",
    ...foes.slice(0, 4).flatMap((w, i) => [...(i ? [", "] : []), named(world, w.foe)]),
    ...(foes.length > 4 ? [`, and ${count(foes.length - 4)} more`] : []),
  ];
}

/** An alliance's line on the list of them: its size, its age, what it fights. */
function allianceLine(world: World, a: Alliance): Line {
  const fights = warsLine(world, a);
  return [
    link(cap(a.name), a.ref),
    `: ${many(a.members.length, "realm", "realms")}, ${many(a.lands, "land", "lands")}, ${many(Math.round(a.people), "soul", "people")}`,
    a.since !== null ? `; bound since year ${a.since}` : "",
    ...(fights.length ? [". ", ...fights] : ["; at peace"]),
    ".",
  ];
}

/** Every alliance in the world, the greatest first: each its colour, who stands in it (each a link), and what it fights. */
export function alliancesBlocks(world: World): Block[] {
  const list = alliancesOf(world),
    realms = politiesOf(world),
    alone = realms.living().filter((p) => !list.some((a) => a.members.includes(p.ref))).length;
  if (!list.length)
    return [
      {
        type: "text",
        lines: [
          [
            "No two realms stand together now: none is bound to another stronger by a pact, an oath or a compact.",
          ],
        ],
      },
    ];
  const blocks: Block[] = [
    {
      type: "bars",
      title: "By their people",
      bars: list.slice(0, 12).map((a) => ({
        // (By its head's seat: the chart is narrow on a phone, and the page says what they are.)
        label: [realms.get(a.head)?.town ?? cap(a.name)],
        ref: a.ref,
        value: Math.round(a.people),
        color: a.color,
      })),
      unit: "people",
    },
    {
      type: "text",
      lines: [
        [
          link("Every alliance ranked", "world:alliances"),
          ": their lands, people, hosts, wealth and wars side by side, each a page of its own.",
        ],
      ],
    },
  ];
  for (const a of list)
    blocks.push({
      type: "list",
      title: cap(a.name),
      items: [
        { ...item(allianceLine(world, a), a.ref), swatch: a.color },
        ...a.members.map((r) =>
          item([named(world, r), `: ${standsHow(world, a.head, a.members, r)}`], r),
        ),
      ],
    });
  blocks.push({
    type: "text",
    lines: [[`${many(alone, "realm stands", "realms stand")} alone, in no alliance.`]],
  });
  return blocks;
}

/** A marriage's own page: who is whose, and what can come of it. */
export function matchPage(world: World, ref: string): PageModel {
  const event = ref.slice("match:".length) as Ref,
    e = world.events.get(event);
  if (!e) throw new Error(`no match ${ref}`);
  const d = e.data as {
      realm?: string;
      other?: string;
      who?: string;
      to?: string;
      form?: string;
    } | null,
    form = d?.form ?? "wed",
    [a, b] = e.subjects,
    year = yearNow(world),
    realms = politiesOf(world),
    orderA = a ? livingMatches(world, a, year).find((m) => m.event === event) : undefined,
    alive = !!orderA,
    whose: Line =
      form === "wed"
        ? [
            `${d?.who ?? "One"} of the house of `,
            a ? named(world, a) : "a realm",
            `, and ${d?.to ?? "another"} of the house of `,
            b ? named(world, b) : "another",
            ". Their children are of both houses.",
          ]
        : form === "foster"
          ? [
              "Their peoples choose who rules them, and keep no houses. ",
              `${d?.who ?? "One"} of `,
              a ? named(world, a) : "a realm",
              ` grew up among those of `,
              b ? named(world, b) : "another",
              `, and ${d?.to ?? "another"} the other way. One fostered can be named, if the seat stands empty: no one can march on it.`,
            ]
          : form === "brood"
            ? [
                "A hive has no houses. ",
                a ? named(world, a) : "One hive",
                ` gave of its brood to `,
                b ? named(world, b) : "another",
                `: ${d?.who ?? "one"} went, and ${d?.to ?? "another"} came, and each hive knows the other's own as its own.`,
              ]
            : [
                "A people of the water keep no houses. ",
                a ? named(world, a) : "One",
                " and ",
                b ? named(world, b) : "another",
                ` grafted reef to reef: ${d?.who ?? "one"} and ${d?.to ?? "another"} keep what grows between them.`,
              ];
  return {
    ref,
    kind: "match",
    icon: form === "wed" ? "💍" : "🪢",
    title: `${FORM_NAMES[form] ?? "A marriage"} between ${(a && realms.get(a)?.town) ?? "one"} and ${(b && realms.get(b)?.town) ?? "another"}`,
    subtitle: [`Year ${Math.floor(e.t / (365 * 86400))}`],
    color: a ? realmColor(a) : null,
    place: null,
    stats: [
      stat("Made", `year ${Math.floor(e.t / (365 * 86400))}`, { why: event }),
      stat(
        "Its claim",
        alive
          ? "Standing: if a house of either ends with no one left, someone of this can come forward."
          : "Lapsed: those of it are gone, or a realm of it has fallen.",
      ),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "text", lines: [whose] },
          { type: "why", title: "How it came about", ref: event },
        ],
      },
    ],
    followable: false,
    year,
  };
}

/** An envoy's errand: what they carry, for whom, why now, how it was answered. */
export function envoyPage(world: World, ref: string): PageModel {
  const event = ref.slice("envoy:".length) as Ref,
    e = world.events.get(event);
  if (!e) throw new Error(`no envoy ${ref}`);
  const d = e.data as {
      who?: string;
      errand?: string;
      answer?: string;
      a?: string;
      b?: string;
      fromTown?: string;
      toTown?: string;
    } | null,
    [from, to] = e.subjects,
    cause = e.causes[0]?.ref,
    year = Math.floor(e.t / (365 * 86400)),
    answer = d?.answer === "no" ? "No" : "Yes",
    fromR = from ? politiesOf(world).get(from) : undefined,
    toR = to ? politiesOf(world).get(to) : undefined,
    answered = toR
      ? `${toR.ruler.name.split(" ")[0] ?? "Its ruler"} of ${toR.town} sent word back: ${answer === "Yes" ? "it would be as asked" : "it would not be"}.`
      : `Word came back: ${answer === "Yes" ? "it would be as asked" : "it would not be"}.`;
  return {
    ref,
    kind: "envoy",
    icon: "📜",
    title: `${d?.who ?? "An envoy"}, envoy of ${d?.fromTown ?? "one seat"}`,
    subtitle: [`To ${d?.toTown ?? "another seat"}, year ${year}`],
    color: from ? realmColor(from) : null,
    place: riderPlace(world, event),
    stats: [
      stat("For", from ? [named(world, from)] : "a realm now gone"),
      stat("To", to ? [named(world, to)] : "a realm now gone"),
      stat("Carrying", ERRAND_WORDS[d?.errand ?? ""] ?? "word", { why: event }),
      stat("Why now", cause ? [link(claimOf(world, cause), cause)] : "no one wrote down why"),
      stat("Answered", answer, { why: event }),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "text",
            lines: [
              [
                `${d?.who ?? "An envoy"} set out from ${d?.fromTown ?? "one seat"}${fromR ? ` at the word of ${fromR.ruler.name}` : ""} and went by road to the court at ${d?.toTown ?? "another"}. ${answered}`,
              ],
            ],
          },
        ],
      },
    ],
    followable: false,
    year,
  };
}

/** The land of a seat whose roads one on an errand is on now, to be looked at there (null: their errand is over). */
function riderPlace(world: World, event: Ref): PageModel["place"] {
  const e = tiesOf(world)
    .envoys()
    .find((x) => x.event === event);
  if (!e) return null;
  const realms = politiesOf(world),
    cell = [realms.get(e.from)?.seat, realms.get(e.to)?.seat].find(
      (c): c is number => c !== undefined && envoysIn(world, c).some((x) => x.event === event),
    );
  return cell === undefined ? null : { scale: "region", cell, rider: `envoy:${event}` };
}

/** One come to this town's court this year or last, where it is a realm's seat: for its plan. */
export function envoyAtCourt(world: World, town: Ref) {
  const year = yearOfMoment(world.now),
    s = populationContext(world).settlements.get(town),
    realm = s ? politiesOf(world).of(s.cell) : undefined;
  if (!s || !realm || realm.seat !== s.cell || realm.town !== s.name) return {};
  const e = [...tiesOf(world).envoys()]
    .reverse()
    .find((x) => x.to === realm.ref && x.year >= year - 1);
  return e ? { envoy: { ref: `envoy:${e.event}`, name: e.name, color: realmColor(e.from) } } : {};
}

/** Whoever goes along this land's roads this year on an errand, for its plan. */
export function envoysIn(world: World, cell: number): Envoy[] {
  const year = yearOfMoment(world.now),
    realms = politiesOf(world);
  return tiesOf(world)
    .envoys()
    .filter((e) => {
      if (e.year < year - 1) return false;
      return realms.get(e.from)?.seat === cell || realms.get(e.to)?.seat === cell;
    })
    .slice(-3);
}
