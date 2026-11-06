// What binds realms, as pages (D1): a realm's bonds tab, a war's sides, a bloc, a league, a marriage, an envoy. It reads, it never touches. A bloc is who stands
// with whom now: a realm stands with the strongest it is bound to, if that one is stronger than it, so a chain of pacts ends at one head and no bloc swallows
// a world by a long thin thread. Each thing bound says why, and links to what made it. Words read off what a people is: a hive gives of its brood, a people of
// the water graft a reef, those who choose their rulers foster each other's young.
import { yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
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
  type TieCall,
  type War,
} from "../../sim/index.ts";
import { BOND_WORDS, CALL_WHY, ERRAND_WORDS, leagueWords } from "../../causal/index.ts";
import type { Block, Item, Line, PageModel, Stat, Tab } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { realmLink } from "./names.ts";
import { claimOf, count, item, link, many, stat, yearNow } from "./words.ts";

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

/** The blocs lens: each land by the colour of the head of its bloc; those who stand alone, dim. */
export function blocsLens(world: World) {
  const g = homePlanet(world).generated,
    read = blocsOf(world),
    realms = politiesOf(world),
    lands: [number, readonly [number, number, number]][] = [],
    biggest = [...read.blocs.entries()].sort(
      (a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1),
    );
  for (const p of realms.living()) {
    const h = read.head.get(p.ref),
      inBloc = h !== undefined && read.blocs.has(h),
      color = inBloc ? realmColor(h) : ([0.4, 0.4, 0.38] as const);
    for (const c of p.members) if (!offworldSite(g, c)) lands.push([c, color]);
  }
  const top = biggest[0],
    head = top ? realms.get(top[0] as Ref) : undefined;
  return {
    lands,
    blocs: read.blocs.size,
    note: head
      ? `${count(read.blocs.size)} ${read.blocs.size === 1 ? "bloc" : "blocs"}; the greatest stands with ${head.town}: ${count(top![1].length)} realms`
      : "each realm stands alone",
    biggest: top ? `bloc:${top[0]}` : null,
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
  if (bloc)
    rows.push(stat("Stands with", [link(blocName(world, h!), `bloc:${h}`)], { why: `bloc:${h}` }));
  else rows.push(stat("Stands with", "no one: it is bound to none stronger, and none to it"));
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

const blocName = (world: World, head: string): string => {
  const p = politiesOf(world).get(head as Ref);
  return p ? `those who stand with ${p.town}` : "those who stood together";
};

/** A bloc's own page: who stands in it, by what; how much of the world it holds. */
export function blocPage(world: World, ref: string): PageModel {
  const head = ref.slice("bloc:".length) as Ref,
    read = blocsOf(world),
    realms = politiesOf(world),
    h = realms.get(head),
    list = read.blocs.get(head) ?? (h ? [head] : []),
    ctx = populationContext(world),
    people = list.reduce(
      (s, r) =>
        s +
        (realms.get(r)?.members ?? []).reduce(
          (n, c) => n + (ctx.provinces.get(c)?.total() ?? 0),
          0,
        ),
      0,
    ),
    lands = list.reduce((s, r) => s + (realms.get(r)?.members.length ?? 0), 0),
    host = list.reduce((s, r) => {
      const p = realms.get(r);
      return s + (p ? fieldedOf(ctx, p) : 0);
    }, 0),
    diplomacy = diplomacyOf(world),
    bonds = bondsOf(world),
    store = tiesOf(world),
    how = (r: Ref): string => {
      if (r === head) return "at its head";
      const oath = bonds.oathOf(r);
      if (oath && list.includes(oath.to))
        return `sworn to ${realms.get(oath.to)?.town ?? "another"}`;
      const l = store.leagueOf(r);
      if (l && l.members.includes(head)) return `of ${leagueName(world, l)}`;
      const by = list.find((q) => q !== r && diplomacy.get(q, r)?.pact);
      return by ? `by a pact with ${realms.get(by)?.town ?? "another"}` : "by those it is sworn to";
    },
    items = list.map((r) => item([named(world, r), `: ${how(r)}`], r));
  return {
    ref,
    kind: "bloc",
    icon: "🤝",
    title: `${blocName(world, head)[0]!.toUpperCase()}${blocName(world, head).slice(1)}`,
    subtitle: [
      list.length >= 2
        ? `${count(list.length)} realms who would answer each other's call`
        : "It stands alone now.",
    ],
    color: h ? realmColor(h.ref) : null,
    place: null,
    stats: [
      stat("Realms", count(list.length)),
      stat("Lands", count(lands)),
      stat("People", count(people)),
      stat("Hosts", count(Math.round(host))),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [{ type: "list", title: "Who stands in it", items }],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** A league's own page. */
export function leaguePage(world: World, ref: string): PageModel {
  const event = ref.slice("league:".length),
    l = tiesOf(world).leagueBy(event);
  if (!l) throw new Error(`no league ${ref}`);
  const realms = politiesOf(world),
    h = realms.get(l.against),
    name = leagueName(world, l),
    title = name[0]!.toUpperCase() + name.slice(1),
    wars = warsOf(world)
      .hotOf(l.against)
      .filter((w) => w.declared >= l.since && (l.until === null || w.declared <= l.until))
      .filter((w) => l.members.includes(w.attacker) || l.members.includes(w.defender))
      .slice(-8)
      .reverse();
  return {
    ref,
    kind: "league",
    icon: "🛡️",
    title,
    subtitle: [
      "Against ",
      named(world, l.against),
      l.until === null ? `, since year ${l.since}` : `, from year ${l.since} to year ${l.until}`,
    ],
    color: h ? realmColor(h.ref) : null,
    place: null,
    stats: [
      stat("Sworn", `year ${l.since}`, { why: l.event }),
      stat("Members", count(l.members.length)),
      stat(
        "It feared",
        `${Math.round(l.share * 100)} in a hundred of the world's people under one realm`,
      ),
      stat(
        "Holds",
        l.until === null
          ? "as long as the fear does: none of them makes war on another, and each answers the others' call"
          : `no longer: ended in year ${l.until}`,
        { why: l.ended },
      ),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "list",
            title: "Who gathered",
            items: l.members.map((m) => item([named(world, m)], m)),
          },
          ...(wars.length
            ? [
                {
                  type: "list" as const,
                  title: "What it fought",
                  items: wars.map((w) =>
                    item([link(claimOf(world, w.event), w.ref)], w.ref, w.declared),
                  ),
                },
              ]
            : []),
          { type: "why", title: "Why they gathered", ref: l.event },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
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
