// The world's own pages (Phase 10 M96b). Its chronicle: its story told by age, what
// emerged first where and how fast the rest of the world followed, its centuries side by
// side, its records, its lives through the years and its greatest events. And its ledger:
// its realms, towns, wars, faiths, tongues, flights and living lineages compared, as a
// grand strategy game's ledger compares them. Pure reads of the world as it stands.
import { cellRef, lives, offworldSite } from "../../gen/index.ts";
import {
  DEITIES,
  beliefOf,
  citiesOf,
  homePlanet,
  languagesOf,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  realmName,
  spaceOf,
  warsOf,
  wildsOf,
  type Polity,
} from "../../sim/index.ts";
import { PRINCIPLES } from "../../rules/index.ts";
import { principleName } from "../../causal/index.ts";
import { parseRef, type Ref, type World } from "../../kernel/index.ts";
import type { Block, Item, Line, PageModel, Row, Span, Stat, Tab } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { faithColor, languageColor } from "../planet.ts";
import { landEra } from "../village.ts";
import { bare, claimOf, count, item, link, many, share, stat, yearAt, yearNow } from "./words.ts";
import {
  faithLink,
  landLink,
  landTitle,
  landsOf,
  languageLink,
  lineageIcon,
  realmLink,
  townLink,
} from "./names.ts";

type Rgb = readonly [number, number, number];

/** How often a world page is read again as the world runs (it reads the whole world). */
const WORLD_EVERY = 10_000;

/** The land an event happened in, if it happened in one. */
function landOfPlace(place: string | null | undefined): number | null {
  if (!place?.startsWith("cell:")) return null;
  try {
    return parseRef(place as Ref).b;
  } catch {
    return null;
  }
}

/** The year an event happened, while it is kept or remembered. */
function yearOfEvent(world: World, ref: Ref | null | undefined): number | null {
  if (!ref) return null;
  const t = world.events.get(ref)?.t ?? world.events.tombstone(ref)?.t;
  return t === undefined ? null : yearAt(t);
}

/** Something that happened: when, where, and the event (a forgotten one is known by its decade). */
type Happening = { readonly year: number; readonly land: number | null; readonly ref: Ref | null };

/**
 * Every event of the kinds asked, as history holds them: the kept ones to the year, the
 * forgotten ones by the middle of the decade they were folded into — oldest first.
 */
function happenings(world: World, types: readonly string[]): Map<string, Happening[]> {
  const out = new Map<string, Happening[]>(types.map((t) => [t, []]));
  for (const e of world.events.all()) {
    const list = out.get(e.type);
    if (list) list.push({ year: yearAt(e.t), land: landOfPlace(e.place), ref: e.id });
  }
  for (const s of world.events.summaries())
    for (const t of types) {
      const n = s.counts[t];
      if (!n) continue;
      const list = out.get(t)!,
        h = { year: s.decade * 10 + 5, land: landOfPlace(s.place), ref: null };
      for (let i = 0; i < n; i++) list.push(h);
    }
  for (const list of out.values()) list.sort((a, b) => a.year - b.year);
  return out;
}

/** The world's people, year by year (the years history keeps: each of the last century, then fewer). */
function worldPeople(world: World): { x: number; y: number }[] {
  const ctx = populationContext(world),
    byYear = new Map<number, number>();
  for (const p of ctx.provinces.all())
    for (const y of ctx.history.yearsOf(p.cell))
      byYear.set(y.year, (byYear.get(y.year) ?? 0) + y.population);
  return [...byYear].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
}

/** A series' value at a year: its last point at or before it. */
function valueAt(points: readonly { x: number; y: number }[], year: number): number | null {
  let v: number | null = null;
  for (const p of points) {
    if (p.x > year) break;
    v = p.y;
  }
  return v;
}

/** At most `most` points of a series, evenly through it (its first and last kept). */
function thin<T>(points: readonly T[], most: number): T[] {
  if (points.length <= most) return [...points];
  const out: T[] = [];
  for (let i = 0; i < most; i++)
    out.push(points[Math.round((i * (points.length - 1)) / (most - 1))]!);
  return out;
}

/** Each principle's knowing, land by land: when and where, and whether found there or learned. */
type Knowing = {
  readonly year: number;
  readonly land: number;
  readonly event: Ref;
  readonly found: boolean;
};

function knowings(world: World): Map<string, Knowing[]> {
  const ctx = populationContext(world),
    lore = loreOf(world),
    out = new Map<string, Knowing[]>();
  for (const p of ctx.provinces.all())
    for (const [id, k] of lore.of(p.cell)) {
      let list = out.get(id);
      if (!list) out.set(id, (list = []));
      list.push({
        year: k.year,
        land: p.cell,
        event: k.event,
        found: world.events.get(k.event)?.type === "lore.found",
      });
    }
  for (const list of out.values()) list.sort((a, b) => a.year - b.year || a.land - b.land);
  return out;
}

// ---------------------------------------------------------------------------------------
// The ages.

type Age = {
  readonly id: string;
  /** The marks it holds (two reached in the same year are one age). */
  readonly ids: readonly string[];
  readonly name: string;
  readonly icon: string;
  readonly color: Rgb;
  readonly year: number;
  readonly land: number | null;
  readonly event: Ref | null;
  /** What opened it, found before the age it follows had come (smelting before sowing). */
  readonly early?: { readonly what: string; readonly year: number; readonly land: number | null };
  /** Its mark, held already by the land that opened it (which came into it by the age before's). */
  readonly had?: string;
};

/** What opens each age after the foragers', in words (for the age not yet come). */
const AGE_NEXT: Readonly<Record<string, string>> = {
  farming: "a people first sows and reaps",
  metal: "a people who farm first smelt metal",
  industry: "a people first builds a steam engine (or mills turned by the tides)",
  modern: "a people first makes electricity",
  space: "a realm first puts a satellite in orbit",
  worlds: "a realm first founds a colony on another world",
  stars: "a ship first sails for another star",
};

type Mark = { readonly year: number; readonly ref: Ref | null; readonly had?: boolean };

/**
 * The ages the world has passed through. A land comes into an age once it has come into the
 * one before (it farms, then works metal too, then builds engines…), and the world's age is
 * the first land's: so an age is opened by the first people to reach it in its turn — and two
 * reached in the same year are one age ("of farming and metal").
 */
function agesOf(world: World, known: Map<string, Knowing[]>, found: Map<string, Happening[]>) {
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    markets = marketsOf(world);
  // Each land's first year of each mark: from its own events (found or learned there), what
  // it knows, else the event it holds the knowing by (carried by its settlers).
  const perLand = (
    types: readonly string[],
    lore: readonly string[],
    held?: (cell: number) => Ref | null | undefined,
  ): Map<number, Mark> => {
    const m = new Map<number, Mark>(),
      take = (land: number | null, year: number, ref: Ref | null) => {
        if (land === null || offworldSite(g, land)) return;
        const was = m.get(land);
        if (!was || year < was.year) m.set(land, { year, ref });
      };
    for (const t of types) for (const h of found.get(t) ?? []) take(h.land, h.year, h.ref);
    for (const id of lore) for (const k of known.get(id) ?? []) take(k.land, k.year, k.event);
    if (held)
      for (const p of ctx.provinces.all()) {
        if (m.has(p.cell)) continue;
        const ref = held(p.cell),
          year = yearOfEvent(world, ref);
        if (ref && year !== null) take(p.cell, year, ref);
      }
    return m;
  };
  const LANDED: readonly {
    id: string;
    name: string;
    icon: string;
    color: Rgb;
    what: string;
    mark: Map<number, Mark>;
  }[] = [
    {
      id: "farming",
      name: "farming",
      icon: "🌾",
      color: [0.72, 0.62, 0.22],
      what: "Sowing and reaping",
      mark: perLand(
        ["knowledge.cultivation", "knowledge.cultivation-spread"],
        [],
        (c) => ctx.provinces.get(c)?.cultivation,
      ),
    },
    {
      id: "metal",
      name: "metal",
      icon: "⚒️",
      color: [0.62, 0.36, 0.2],
      what: "Smelting metal",
      mark: perLand(
        ["knowledge.metalworking", "knowledge.metalworking-spread"],
        ["vent-working"],
        (c) => markets.get(c)?.metalworking,
      ),
    },
    {
      id: "industry",
      name: "industry",
      icon: "🏭",
      color: [0.42, 0.42, 0.46],
      what: "The engine",
      mark: perLand([], ["steam-engine", "current-mills"]),
    },
    {
      id: "modern",
      name: "electricity",
      icon: "⚡",
      color: [0.25, 0.5, 0.78],
      what: "Electricity",
      mark: perLand([], ["electricity", "sea-electricity"]),
    },
  ];
  const origin = found.get("people.origin")?.[0] ?? null,
    steps: Age[] = [
      {
        id: "foragers",
        ids: ["foragers"],
        name: "foragers",
        icon: "🏹",
        color: [0.55, 0.45, 0.3],
        year: origin?.year ?? 0,
        land: origin?.land ?? null,
        event: origin?.ref ?? null,
      },
    ];
  // Land by land, each age reached in its turn: the year the land had the age before and its
  // own mark, and the event that completed it.
  let reached = new Map<number, Mark>();
  LANDED.forEach((a, i) => {
    const next = new Map<number, Mark>();
    for (const [land, m] of a.mark) {
      const before = i === 0 ? null : reached.get(land);
      if (i > 0 && !before) continue;
      next.set(land, before && before.year > m.year ? { ...before, had: true } : m);
    }
    reached = next;
    let best: [number, Mark] | null = null;
    for (const [land, m] of next)
      if (!best || m.year < best[1].year || (m.year === best[1].year && land < best[0]))
        best = [land, m];
    if (!best) return;
    // Its mark reached anywhere before (by a people not yet in the age before it).
    let raw: [number, Mark] | null = null;
    for (const [land, m] of a.mark)
      if (!raw || m.year < raw[1].year || (m.year === raw[1].year && land < raw[0]))
        raw = [land, m];
    steps.push({
      id: a.id,
      ids: [a.id],
      name: a.name,
      icon: a.icon,
      color: a.color,
      year: best[1].year,
      land: best[0],
      event: best[1].ref,
      ...(raw && raw[1].year < best[1].year
        ? { early: { what: a.what, year: raw[1].year, land: raw[0] } }
        : {}),
      ...(best[1].had ? { had: a.what.toLowerCase() } : {}),
    });
  });
  // Into the sky: a realm's firsts, each in its turn.
  const space = spaceOf(world).first,
    sky = (id: string, name: string, icon: string, color: Rgb, ref: Ref | null) => {
      const y = yearOfEvent(world, ref);
      if (y === null) return;
      steps.push({
        id,
        ids: [id],
        name,
        icon,
        color,
        year: Math.max(y, steps.at(-1)!.year),
        land: landOfPlace(world.events.get(ref!)?.place),
        event: ref,
      });
    };
  sky("space", "flight to orbit", "🛰️", [0.35, 0.3, 0.62], space.satellite);
  sky("worlds", "other worlds", "🪐", [0.55, 0.3, 0.55], space.colony);
  sky("stars", "the stars", "✨", [0.8, 0.7, 0.35], found.get("space.voyage")?.[0]?.ref ?? null);
  // Ages reached in the same year are one.
  const ages: Age[] = [];
  for (const a of steps) {
    const last = ages.at(-1);
    if (last && last.year === a.year) {
      ages[ages.length - 1] = {
        ...last,
        id: a.id,
        ids: [...last.ids, ...a.ids],
        name: `${last.name} and ${a.name}`,
        ...(a.had ? { had: a.had } : {}),
        icon: `${last.icon}${a.icon}`,
        color: a.color,
        ...(a.early ? { early: a.early } : {}),
      };
    } else ages.push(a);
  }
  return ages.map((a) => ({ ...a, name: ageName(a.name) }));
}

/** An age's name from what marks it: "The age of farming and metal", "The modern age". */
function ageName(marks: string): string {
  return marks === "electricity" ? "The modern age" : `The age of ${marks}`;
}

/** The event kinds a page counts, besides what its stores keep. */
const COUNTED = [
  "people.origin",
  "knowledge.cultivation",
  "knowledge.cultivation-spread",
  "knowledge.metalworking",
  "knowledge.metalworking-spread",
  "knowledge.herding",
  "knowledge.herding-spread",
  "people.famine",
  "trade.route-opened",
  "trade.sea-route",
  "industry.mine",
  "industry.works",
  "industry.well",
  "space.voyage",
  "space.arrival",
  "contact.heard",
  "war.rebellion",
  "polity.split",
] as const;

/** What the world holds for its firsts, read once. */
function baseSurvey(world: World) {
  const ctx = populationContext(world);
  return {
    ctx,
    now: yearNow(world),
    found: happenings(world, COUNTED),
    known: knowings(world),
    towns: ctx.settlements.all(),
    realms: politiesOf(world).all(),
    wars: warsOf(world).all(),
    faiths: beliefOf(world).all(),
    tongues: languagesOf(world).all(),
  };
}

type BaseSurvey = ReturnType<typeof baseSurvey>;

/** What the world holds, read once for a page: its firsts', and its people and its ages. */
function survey(world: World) {
  const base = baseSurvey(world);
  return { ...base, people: worldPeople(world), ages: agesOf(world, base.known, base.found) };
}

type Survey = ReturnType<typeof survey>;

/** How many of each thing began within the years [from, to). */
function within(s: Survey, from: number, to: number) {
  const inside = (y: number) => y >= from && y < to,
    events = (type: string) => (s.found.get(type) ?? []).filter((h) => inside(h.year)).length;
  let found = 0;
  for (const list of s.known.values()) for (const k of list) if (k.found && inside(k.year)) found++;
  found += events("knowledge.cultivation") + events("knowledge.metalworking");
  return {
    towns: s.towns.filter((t) => inside(t.founded)).length,
    realms: s.realms.filter((r) => inside(r.founded)).length,
    fell: s.realms.filter((r) => r.ended !== null && inside(r.ended)).length,
    wars: s.wars.filter((w) => inside(w.declared)).length,
    battles: s.wars.reduce((n, w) => n + w.battles.filter((b) => inside(b.year)).length, 0),
    fallen: s.wars.reduce(
      (n, w) =>
        n +
        w.battles.filter((b) => inside(b.year)).reduce((m, b) => m + b.fallen[0] + b.fallen[1], 0),
      0,
    ),
    faiths: s.faiths.filter((f) => inside(f.founded)).length,
    tongues: s.tongues.filter((l) => l.parent !== null && inside(l.born)).length,
    found,
    famines: events("people.famine"),
  };
}

// ---------------------------------------------------------------------------------------
// The chronicle.

/** The world's chronicle: its story, its ages, its firsts, its centuries, its records, its lives, its events. */
export function chroniclePage(world: World, tab?: string): PageModel {
  const s = survey(world),
    { now } = s,
    standing = s.realms.filter((r) => r.ended === null),
    peopleNow = s.ctx.provinces.all().reduce((n, p) => n + p.total(), 0),
    principles = PRINCIPLES.length,
    foundAnywhere = PRINCIPLES.filter((p) => firstKnown(s, p.id)).length;
  const stats: Stat[] = [
    stat("Year", count(now)),
    stat("People", count(peopleNow)),
    stat("Ages", count(s.ages.length), {
      parts: s.ages.map((a) => ({ label: [a.name], value: `from year ${a.year}` })),
    }),
    stat("Realms", `${count(standing.length)} of ${count(s.realms.length)}`, {
      parts: [
        { label: ["standing"], value: count(standing.length) },
        { label: ["fallen"], value: count(s.realms.length - standing.length) },
      ],
    }),
    stat("Wars fought", count(s.wars.length), {
      parts: [
        { label: ["still fought"], value: count(s.wars.filter((w) => w.ended === null).length) },
        { label: ["battles"], value: count(s.wars.reduce((n, w) => n + w.battles.length, 0)) },
      ],
    }),
    stat("Found", `${count(foundAnywhere)} of ${count(principles)}`),
  ];
  const tabs: Tab[] = [
    { id: "story", name: "Story", blocks: storyBlocks(world, s) },
    { id: "ages", name: "Ages", blocks: ageBlocks(world, s) },
    { id: "firsts", name: "Firsts", blocks: firstBlocks(world, s) },
    { id: "centuries", name: "Centuries", blocks: centuryBlocks(s) },
    { id: "records", name: "Records", blocks: recordBlocks(world, s) },
    { id: "lives", name: "Lives", blocks: lifeBlocks(world, s) },
    { id: "events", name: "Events", blocks: eventBlocks(world) },
  ];
  return {
    ref: "world:chronicle",
    kind: "chronicle",
    icon: "📜",
    title: "The Chronicle",
    subtitle: [
      `of the world, from its first people to year ${count(now)} — `,
      link("the ledger", "world:ledger"),
    ],
    color: null,
    place: null,
    stats,
    tabs,
    ...(tab ? { tab } : {}),
    followable: false,
    year: now,
    every: WORLD_EVERY,
  };
}

/** Whether a principle is known anywhere, and its first (the roots by their own records). */
function firstKnown(s: BaseSurvey, id: string): Happening | null {
  if (id === "cultivation") return s.found.get("knowledge.cultivation")?.[0] ?? null;
  if (id === "metalworking") {
    const m = s.found.get("knowledge.metalworking")?.[0] ?? null,
      v = s.known.get("vent-working")?.[0];
    return m ?? (v ? { year: v.year, land: v.land, ref: v.event } : null);
  }
  const k = s.known.get(id)?.[0];
  return k ? { year: k.year, land: k.land, ref: k.event } : null;
}

/** An event's words to follow "when …": its claim without its year, its first letter low. */
function when(world: World, ref: Ref): string {
  return bare(claimOf(world, ref))
    .replace(/\.$/, "")
    .replace(/^./, (x) => x.toLowerCase());
}

/** An age's own years: from its beginning to the next's (or on to now). */
function spanOf(s: Survey, i: number): { to: number; last: boolean } {
  const last = i + 1 === s.ages.length;
  return { to: last ? s.now : s.ages[i + 1]!.year, last };
}

/** The world's story: each age told in a few words, its people through the years, its greatest moments. */
function storyBlocks(world: World, s: Survey): Block[] {
  const lines: Line[] = s.ages.map((a, i) => {
    const { to, last } = spanOf(s, i),
      c = within(s, a.year, last ? s.now + 1 : to),
      from = valueAt(s.people, a.year),
      until = valueAt(s.people, to),
      what: string[] = [];
    if (c.towns) what.push(many(c.towns, "town founded", "towns founded"));
    if (c.realms) what.push(many(c.realms, "realm formed", "realms formed"));
    if (c.wars) what.push(many(c.wars, "war fought", "wars fought"));
    if (c.faiths) what.push(many(c.faiths, "faith founded", "faiths founded"));
    if (c.found) what.push(many(c.found, "thing found", "things found"));
    return [
      `${a.icon} `,
      link(a.name, "world:chronicle#ages"),
      last
        ? ` — since year ${count(a.year)} (${many(s.now - a.year, "year", "years")} so far).`
        : ` — year ${count(a.year)} to ${count(to)} (${many(to - a.year, "year", "years")}).`,
      ...(a.event
        ? [
            " It began",
            ...(a.land !== null ? [" in ", landLink(world, a.land)] : []),
            a.had ? `, where ${a.had} was known already, when ` : " when ",
            link(when(world, a.event), a.event),
            ".",
          ]
        : []),
      ...(a.early
        ? [
            ` ${a.early.what} was known before it, first`,
            ...(a.early.land !== null ? [" in ", landLink(world, a.early.land)] : []),
            ` in year ${count(a.early.year)}.`,
          ]
        : []),
      what.length ? ` In it: ${what.join(", ")}.` : "",
      from !== null && until !== null && until !== from
        ? ` The world's people ${until > from ? "grew" : "fell"} from ${count(from)} to ${count(until)}.`
        : "",
    ];
  });
  const next = nextAge(s);
  if (next) lines.push([`The next age opens when ${next}.`]);
  // Its turning points: the first of every kind of thing history holds as great; and lately.
  const great = world.events.all().filter((e) => e.importance >= 6),
    kinds = new Set<string>(),
    line = (e: (typeof great)[number]) =>
      item(
        [`Year ${count(yearAt(e.t))}: `, { text: bare(claimOf(world, e.id)), ref: e.id }],
        e.id,
        yearAt(e.t),
      ),
    turning: Item[] = [],
    lately = great.slice(-8).reverse().map(line);
  for (const e of great)
    if (!kinds.has(e.type)) {
      kinds.add(e.type);
      turning.push(line(e));
    }
  return [
    { type: "text", title: "The ages of the world", lines },
    { type: "chart", title: "People on the world", points: thin(s.people, 160), unit: "people" },
    { type: "list", title: "Its turning points: the first of each great thing", items: turning },
    { type: "list", title: "Lately", items: lately },
  ];
}

function nextAge(s: Survey): string | null {
  const reached = new Set(s.ages.flatMap((a) => a.ids));
  for (const id of Object.keys(AGE_NEXT)) if (!reached.has(id)) return AGE_NEXT[id]!;
  return null;
}

/** The ages side by side: how long each lasted and what each brought. */
function ageBlocks(world: World, s: Survey): Block[] {
  const rows: Row[] = s.ages.map((a, i) => {
    const { to, last } = spanOf(s, i),
      c = within(s, a.year, last ? s.now + 1 : to),
      people = valueAt(s.people, to) ?? 0;
    return {
      ...(a.event ? { ref: a.event } : {}),
      cells: [
        [`${a.icon} ${a.name}`],
        [`year ${count(a.year)}`],
        a.land !== null ? [landLink(world, a.land)] : ["—"],
        [last ? `${count(to - a.year)} so far` : count(to - a.year)],
        [count(people)],
        [count(c.towns)],
        [count(c.realms)],
        [count(c.wars)],
        [count(c.battles)],
        [count(c.faiths)],
        [count(c.found)],
      ],
      keys: [
        a.year,
        a.year,
        a.land !== null ? landTitle(world, a.land) : "",
        to - a.year,
        people,
        c.towns,
        c.realms,
        c.wars,
        c.battles,
        c.faiths,
        c.found,
      ],
    };
  });
  const next = nextAge(s),
    early: Line[] = s.ages.flatMap((a) =>
      a.early
        ? [
            [
              `${a.icon} ${a.early.what} came before ${a.name.replace(/^The /, "the ")}: first`,
              ...(a.early.land !== null ? [" in ", landLink(world, a.early.land)] : []),
              ` in year ${count(a.early.year)}, by a people not yet in the age before it.`,
            ],
          ]
        : [],
    );
  return [
    {
      type: "timeline",
      title: "The ages through the years",
      from: s.ages[0]?.year ?? 0,
      to: s.now,
      rows: s.ages.map((a, i) => ({
        label: [`${a.icon} ${a.name.replace(/^The /, "")}`],
        ...(a.event ? { ref: a.event } : {}),
        from: a.year,
        to: s.ages[i + 1]?.year ?? null,
        color: a.color,
      })),
    },
    {
      type: "table",
      title: "The ages compared",
      columns: [
        "Age",
        "Began",
        "Where",
        "Years",
        "People at its end",
        "Towns",
        "Realms",
        "Wars",
        "Battles",
        "Faiths",
        "Found",
      ],
      rows,
    },
    ...(early.length || next
      ? [
          {
            type: "text" as const,
            lines: [...early, ...(next ? [[`The next age opens when ${next}.`]] : [])],
          },
        ]
      : []),
  ];
}

/** Things that emerged: where and when first, how soon another followed, how far they reach now. */
/**
 * A first in the world: what emerged, when and where first (its event), the year the next
 * of it came, and how it stands now.
 */
type First = {
  readonly what: string;
  readonly first: { readonly year: number; readonly land: number | null; readonly ref: Ref | null };
  readonly nextYear: number | null;
  readonly now: string;
  readonly nowKey: number;
  /** How many times it was found apart (a finding made in more than one land). */
  readonly apart?: number;
};

/** The world's firsts (Phase 10 M96b; the alerts' too, M96): what emerged, oldest first. */
export function worldFirsts(world: World): {
  what: string;
  year: number;
  land: number | null;
  ref: Ref | null;
}[] {
  return firstsOf(world, baseSurvey(world)).map((f) => ({ what: f.what, ...f.first }));
}

/** A first as a row of the chronicle's table of them. */
function firstRow(world: World, f: First): Row {
  const { what, first, nextYear, now, nowKey, apart } = f,
    gap = nextYear === null ? null : nextYear - first.year;
  return {
    ...(first.ref ? { ref: first.ref } : {}),
    cells: [
      [what],
      [`year ${count(first.year)}`],
      first.land !== null ? [landLink(world, first.land)] : ["—"],
      [
        gap === null
          ? "none yet"
          : gap === 0
            ? "the same year"
            : `${many(gap, "year", "years")} later`,
      ],
      [
        apart !== undefined && apart > 1
          ? `${now} · found ${many(apart, "time", "times")} apart`
          : now,
      ],
    ],
    keys: [
      what,
      first.year,
      first.land !== null ? landTitle(world, first.land) : "",
      gap ?? 1e9,
      nowKey,
    ],
  };
}

function firstsOf(world: World, s: BaseSurvey): First[] {
  const ctx = s.ctx,
    provinces = ctx.provinces.all(),
    firsts: First[] = [],
    add = (
      what: string,
      first: { year: number; land: number | null; ref: Ref | null } | null,
      nextYear: number | null,
      now: string,
      nowKey: number,
      apart?: number,
    ) => {
      if (first)
        firsts.push({
          what,
          first,
          nextYear,
          now,
          nowKey,
          ...(apart !== undefined ? { apart } : {}),
        });
    },
    ev = (type: string) => s.found.get(type) ?? [],
    second = (...types: string[]) =>
      types.flatMap((t) => ev(t)).sort((a, b) => a.year - b.year)[1]?.year ?? null;
  // The roots: sowing, herds, smelting.
  {
    const lands = provinces.filter((p) => p.knowsCultivation).length;
    add(
      "🌾 Sowing and reaping",
      ev("knowledge.cultivation")[0] ?? null,
      second("knowledge.cultivation", "knowledge.cultivation-spread"),
      many(lands, "land", "lands"),
      lands,
      ev("knowledge.cultivation").length,
    );
  }
  {
    const lands = provinces.filter((p) => p.herding).length;
    add(
      "🐄 Herds",
      ev("knowledge.herding")[0] ?? null,
      second("knowledge.herding", "knowledge.herding-spread"),
      many(lands, "land", "lands"),
      lands,
      ev("knowledge.herding").length,
    );
  }
  {
    const markets = marketsOf(world),
      lands = provinces.filter((p) => markets.get(p.cell)?.metalworking).length;
    add(
      "⚒️ Smelting copper",
      ev("knowledge.metalworking")[0] ?? null,
      second("knowledge.metalworking", "knowledge.metalworking-spread"),
      many(lands, "land", "lands"),
      lands,
      ev("knowledge.metalworking").length,
    );
  }
  // What was learned: every principle known anywhere.
  for (const p of PRINCIPLES) {
    if (p.id === "cultivation" || p.id === "metalworking") continue;
    const list = s.known.get(p.id);
    if (!list?.length) continue;
    const k = list[0]!;
    add(
      `💡 ${sentenceCase(p.name)}`,
      { year: k.year, land: k.land, ref: k.event },
      list[1]?.year ?? null,
      many(list.length, "land", "lands"),
      list.length,
      list.filter((x) => x.found).length,
    );
  }
  // What people built together.
  const byYear = <T>(xs: readonly T[], y: (x: T) => number) => [...xs].sort((a, b) => y(a) - y(b));
  {
    const t = byYear(s.towns, (x) => x.founded);
    if (t[0])
      add(
        "🏘️ A town",
        { year: t[0].founded, land: t[0].cell, ref: t[0].event },
        t[1]?.founded ?? null,
        many(t.length, "town", "towns"),
        t.length,
      );
    const cities = byYear(
      s.towns.flatMap((x) => {
        const c = citiesOf(world).get(x.ref);
        return c ? [c] : [];
      }),
      (c) => c.founded,
    );
    if (cities[0])
      add(
        "🏙️ A city",
        { year: cities[0].founded, land: cities[0].cell, ref: cities[0].event },
        cities[1]?.founded ?? null,
        many(cities.length, "city", "cities"),
        cities.length,
      );
    const markets = byYear(
      s.towns.flatMap((x) => {
        const y = x.market ? yearOfEvent(world, x.market) : null;
        return y === null ? [] : [{ year: y, land: x.cell, ref: x.market }];
      }),
      (m) => m.year,
    );
    if (markets[0])
      add(
        "⚖️ A market town",
        markets[0],
        markets[1]?.year ?? null,
        many(markets.length, "market town", "market towns"),
        markets.length,
      );
  }
  {
    const r = byYear(s.realms, (x) => x.founded);
    if (r[0]) {
      const standing = r.filter((x) => x.ended === null).length;
      add(
        "👑 A realm",
        { year: r[0].founded, land: r[0].seat, ref: r[0].event },
        r[1]?.founded ?? null,
        `${count(standing)} standing of ${count(r.length)}`,
        standing,
      );
    }
    const f = byYear(s.faiths, (x) => x.founded);
    if (f[0])
      add(
        "✨ A faith",
        { year: f[0].founded, land: f[0].seat, ref: f[0].event },
        f[1]?.founded ?? null,
        many(f.length, "faith", "faiths"),
        f.length,
      );
    const l = byYear(
      s.tongues.filter((x) => x.parent !== null),
      (x) => x.born,
    );
    if (l[0])
      add(
        "🗣️ A tongue of its own",
        { year: l[0].born, land: l[0].home, ref: l[0].event },
        l[1]?.born ?? null,
        many(l.length, "new tongue", "new tongues"),
        l.length,
      );
    const w = byYear(s.wars, (x) => x.declared);
    if (w[0])
      add(
        "⚔️ A war",
        { year: w[0].declared, land: w[0].prize, ref: w[0].event },
        w[1]?.declared ?? null,
        `${count(w.length)} fought, ${count(w.filter((x) => x.ended === null).length)} still`,
        w.length,
      );
    const b = byYear(
      s.wars.flatMap((x) => x.battles),
      (x) => x.year,
    );
    if (b[0])
      add(
        "🗡️ A battle",
        { year: b[0].year, land: b[0].land, ref: b[0].event },
        b[1]?.year ?? null,
        many(b.length, "battle", "battles"),
        b.length,
      );
  }
  for (const [type, what, one, more] of [
    ["trade.route-opened", "🐪 A trade road", "road", "roads"],
    ["trade.sea-route", "⛵ A sea route", "route", "routes"],
    ["industry.mine", "⛏️ A mine", "mine", "mines"],
    ["industry.works", "🏭 Works", "works", "works"],
    ["industry.well", "🛢️ An oil well", "well", "wells"],
  ] as const) {
    const list = ev(type);
    if (list[0])
      add(what, list[0], list[1]?.year ?? null, many(list.length, one, more), list.length);
  }
  // Into the sky.
  {
    const first = spaceOf(world).first,
      at = (ref: Ref | null) => {
        const y = yearOfEvent(world, ref);
        return y === null
          ? null
          : { year: y, land: landOfPlace(world.events.get(ref!)?.place), ref };
      },
      programs = spaceOf(world).all();
    const nth = (pick: (p: (typeof programs)[number]) => Ref | null) =>
      programs
        .map((p) => yearOfEvent(world, pick(p)))
        .filter((y): y is number => y !== null)
        .sort((a, b) => a - b);
    const sat = nth((p) => p.satellite),
      crew = nth((p) => p.crew),
      station = nth((p) => p.station);
    add(
      "🛰️ A satellite",
      at(first.satellite),
      sat[1] ?? null,
      many(sat.length, "realm in orbit", "realms in orbit"),
      sat.length,
    );
    add(
      "👩‍🚀 A crew in orbit",
      at(first.crew),
      crew[1] ?? null,
      many(crew.length, "realm", "realms"),
      crew.length,
    );
    add(
      "🛸 A station",
      at(first.station),
      station[1] ?? null,
      many(station.length, "station", "stations"),
      station.length,
    );
    const colonies = programs.flatMap((p) => p.colonies).sort((a, b) => a.year - b.year);
    add(
      "🪐 A colony",
      at(first.colony),
      colonies[1]?.year ?? null,
      many(colonies.length, "colony", "colonies"),
      colonies.length,
    );
    const voyages = ev("space.voyage");
    if (voyages[0])
      add(
        "✨ A ship to the stars",
        voyages[0],
        voyages[1]?.year ?? null,
        many(voyages.length, "ship", "ships"),
        voyages.length,
      );
    const heard = ev("contact.heard");
    if (heard[0])
      add(
        "📡 Word from another people",
        heard[0],
        heard[1]?.year ?? null,
        many(heard.length, "time", "times"),
        heard.length,
      );
  }
  return firsts.sort((a, b) => a.first.year - b.first.year);
}

function firstBlocks(world: World, s: Survey): Block[] {
  const rows = firstsOf(world, s).map((f) => firstRow(world, f));
  // The race: how far the great findings spread, year by year.
  const RACE = [
    "writing",
    "iron",
    "wheel",
    "currency",
    "philosophy",
    "steam-engine",
    "railways",
    "electricity",
    "rocketry",
    "orbital-flight",
  ];
  let racers = RACE.filter((id) => (s.known.get(id)?.length ?? 0) > 1);
  if (racers.length < 3)
    racers = [...s.known.entries()]
      .filter(([, l]) => l.length > 1)
      .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
      .slice(0, 5)
      .map(([id]) => id);
  const series = racers.slice(-6).map((id, i) => {
    const list = s.known.get(id)!,
      points: { x: number; y: number }[] = [];
    list.forEach((k, n) => {
      if (points.at(-1)?.x === k.year) points[points.length - 1] = { x: k.year, y: n + 1 };
      else points.push({ x: k.year, y: n + 1 });
    });
    if (points.at(-1)!.x < s.now) points.push({ x: s.now, y: list.length });
    return {
      name: sentenceCase(principleName(id)),
      color: RACE_COLORS[i % RACE_COLORS.length]!,
      points: thin(points, 120),
    };
  });
  const unfound = PRINCIPLES.filter((p) => !firstKnown(s, p.id)).length;
  return [
    ...(series.length
      ? [
          {
            type: "lines" as const,
            title: "How far the great findings spread (lands knowing each)",
            series,
            unit: "count" as const,
          },
        ]
      : []),
    {
      type: "table",
      title: "What emerged, and where first",
      columns: ["What", "First", "Where", "The next", "Now"],
      rows,
    },
    ...(unfound
      ? [
          {
            type: "text" as const,
            lines: [
              [
                `Not yet found anywhere: ${many(unfound, "principle", "principles")} of ${count(PRINCIPLES.length)}.`,
              ],
            ],
          },
        ]
      : []),
  ];
}

const RACE_COLORS: readonly Rgb[] = [
  [0.95, 0.7, 0.25],
  [0.4, 0.75, 0.95],
  [0.9, 0.4, 0.45],
  [0.5, 0.85, 0.45],
  [0.75, 0.55, 0.95],
  [0.95, 0.95, 0.55],
];

function sentenceCase(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

/** The centuries side by side: what each saw begin, and the world's people at its end. */
function centuryBlocks(s: Survey): Block[] {
  const first = Math.floor((s.ages[0]?.year ?? 0) / 100),
    // (A century just begun waits for its first decade.)
    last = Math.max(first, Math.floor(s.now / 100) - (s.now % 100 < 10 ? 1 : 0)),
    rows: Row[] = [],
    towns: { x: number; y: number }[] = [],
    battles: { x: number; y: number }[] = [],
    found: { x: number; y: number }[] = [],
    famines: { x: number; y: number }[] = [];
  for (let c = first; c <= last; c++) {
    const from = c * 100,
      to = Math.min(from + 100, s.now + 1),
      n = within(s, from, to),
      people = valueAt(s.people, Math.min(from + 99, s.now)) ?? 0,
      whole = from + 100 <= s.now,
      name = `${ordinal(c + 1)} century${whole ? "" : " (so far)"}`;
    rows.push({
      cells: [
        [name],
        [count(people)],
        [count(n.towns)],
        [count(n.realms)],
        [count(n.fell)],
        [count(n.wars)],
        [count(n.battles)],
        [count(n.fallen)],
        [count(n.famines)],
        [count(n.found)],
        [count(n.faiths)],
        [count(n.tongues)],
      ],
      keys: [
        c,
        people,
        n.towns,
        n.realms,
        n.fell,
        n.wars,
        n.battles,
        n.fallen,
        n.famines,
        n.found,
        n.faiths,
        n.tongues,
      ],
    });
    // (The chart has the whole centuries: one under way would read as a fall.)
    if (!whole) continue;
    const mid = from + 50;
    towns.push({ x: mid, y: n.towns });
    battles.push({ x: mid, y: n.battles });
    found.push({ x: mid, y: n.found });
    famines.push({ x: mid, y: n.famines });
  }
  return [
    {
      type: "lines",
      title: "Each century: what began in it",
      unit: "count",
      apart: true,
      series: [
        { name: "Towns founded", color: [0.95, 0.7, 0.25], points: towns },
        { name: "Battles", color: [0.9, 0.35, 0.35], points: battles },
        { name: "Things found", color: [0.4, 0.75, 0.95], points: found },
        { name: "Famines", color: [0.7, 0.6, 0.45], points: famines },
      ],
    },
    {
      type: "table",
      title: "The centuries compared",
      columns: [
        "Century",
        "People at its end",
        "Towns",
        "Realms formed",
        "Realms fell",
        "Wars",
        "Battles",
        "Fallen",
        "Famines",
        "Found",
        "Faiths",
        "Tongues",
      ],
      rows: rows.reverse(),
    },
  ];
}

function ordinal(n: number): string {
  const k = n % 100;
  return `${n}${k >= 11 && k <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
}

/** The world's records: the greatest, the oldest, the longest, the bloodiest. */
function recordBlocks(world: World, s: Survey): Block[] {
  const ctx = s.ctx,
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    realmPeople = (r: Polity) => r.members.reduce((n, c) => n + peopleOf(c), 0),
    most = <T>(xs: readonly T[], k: (x: T) => number): T | undefined => {
      let best: T | undefined,
        v = -Infinity;
      for (const x of xs) {
        const y = k(x);
        if (y > v) {
          v = y;
          best = x;
        }
      }
      return best;
    },
    standing = s.realms.filter((r) => r.ended === null),
    rows: Stat[] = [];
  const realm = (label: string, r: Polity | undefined, words: (r: Polity) => string) => {
    if (r) rows.push(stat(label, [realmLink(world, r.ref), ` — ${words(r)}`], { why: r.ref }));
  };
  realm("The most peopled realm", most(standing, realmPeople), (r) =>
    many(realmPeople(r), "person", "people"),
  );
  realm(
    "The widest realm",
    most(standing, (r) => r.members.length),
    (r) => many(r.members.length, "land", "lands"),
  );
  realm(
    "The oldest realm standing",
    most(standing, (r) => -r.founded),
    (r) => `since year ${count(r.founded)}`,
  );
  realm(
    "The longest-lived realm",
    most(s.realms, (r) => (r.ended ?? s.now) - r.founded),
    (r) =>
      `${many((r.ended ?? s.now) - r.founded, "year", "years")}${r.ended === null ? " and standing" : ""}`,
  );
  const warName = (w: (typeof s.wars)[number]) => {
    const a = politiesOf(world).get(w.attacker),
      d = politiesOf(world).get(w.defender);
    return `the war of ${a?.town ?? "the fallen"} upon ${d?.town ?? "the fallen"}`;
  };
  const war = (
    label: string,
    w: (typeof s.wars)[number] | undefined,
    words: (w: (typeof s.wars)[number]) => string,
  ) => {
    if (w) rows.push(stat(label, [link(warName(w), w.ref), ` — ${words(w)}`], { why: w.ref }));
  };
  war(
    "The bloodiest war",
    most(s.wars, (w) => w.fallen[0] + w.fallen[1]),
    (w) => `${count(w.fallen[0] + w.fallen[1])} fallen`,
  );
  war(
    "The longest war",
    most(s.wars, (w) => (w.ended ?? s.now) - w.declared),
    (w) => many((w.ended ?? s.now) - w.declared, "year", "years"),
  );
  war(
    "The most battles in a war",
    most(s.wars, (w) => w.battles.length),
    (w) => many(w.battles.length, "battle", "battles"),
  );
  {
    const fought = new Map<number, number>();
    for (const w of s.wars)
      for (const b of w.battles) fought.set(b.land, (fought.get(b.land) ?? 0) + 1);
    const land = most([...fought.keys()], (c) => fought.get(c)! * 1e6 - c);
    if (land !== undefined)
      rows.push(
        stat("The most fought-over land", [
          landLink(world, land),
          ` — ${many(fought.get(land)!, "battle", "battles")}`,
        ]),
      );
  }
  {
    const hungry = new Map<number, number>();
    for (const h of s.found.get("people.famine") ?? [])
      if (h.land !== null) hungry.set(h.land, (hungry.get(h.land) ?? 0) + 1);
    const land = most([...hungry.keys()], (c) => hungry.get(c)! * 1e6 - c);
    if (land !== undefined)
      rows.push(
        stat("The hungriest land", [
          landLink(world, land),
          ` — ${many(hungry.get(land)!, "famine", "famines")}`,
        ]),
      );
  }
  {
    const land = most(ctx.provinces.all(), (p) => p.total());
    if (land && land.total())
      rows.push(
        stat("The most peopled land", [
          landLink(world, land.cell),
          ` — ${many(land.total(), "person", "people")}`,
        ]),
      );
    const town = most(s.towns, (t) => t.population);
    if (town)
      rows.push(
        stat(
          "The largest town",
          [townLink(world, town.ref), ` — ${many(town.population, "person", "people")}`],
          { why: town.event },
        ),
      );
    const old = most(
      s.towns.filter((t) => t.population > 0),
      (t) => -t.founded,
    );
    if (old)
      rows.push(
        stat(
          "The oldest town still lived in",
          [townLink(world, old.ref), ` — since year ${count(old.founded)}`],
          { why: old.event },
        ),
      );
  }
  {
    const b = beliefOf(world),
      f = most(s.faiths, (x) => b.lands(x.ref).length);
    if (f && b.lands(f.ref).length)
      rows.push(
        stat(
          "The widest faith",
          [faithLink(world, f.ref), ` — ${many(b.lands(f.ref).length, "land", "lands")}`],
          { why: f.ref },
        ),
      );
    const speakers = languagesOf(world).speakers(),
      l = most(s.tongues, (x) => speakers.get(x.index)?.length ?? 0);
    if (l && speakers.get(l.index)?.length)
      rows.push(
        stat(
          "The most spoken tongue",
          [
            languageLink(world, l.ref),
            ` — ${many(speakers.get(l.index)!.length, "land", "lands")}`,
          ],
          { why: l.ref },
        ),
      );
    const oldest = most(
      s.tongues.filter((x) => x.died === null && speakers.get(x.index)?.length),
      (x) => -x.born,
    );
    if (oldest)
      rows.push(
        stat(
          "The oldest tongue still spoken",
          [languageLink(world, oldest.ref), ` — since year ${count(oldest.born)}`],
          { why: oldest.ref },
        ),
      );
  }
  {
    const g = homePlanet(world).generated,
      living = g.life.species.filter((x) => x.died === null && x.niche !== "seed grass"),
      big = most(living, (x) => x.size);
    if (big)
      rows.push(
        stat("The greatest beast", [link(big.name, big.ref), ` — ${count(big.size)} kg`], {
          why: big.ref,
        }),
      );
  }
  return [{ type: "facts", title: "The world's records", rows }];
}

/** Lives through the years: the realms, wars, faiths and tongues, each from its beginning to its end. */
function lifeBlocks(world: World, s: Survey): Block[] {
  const start = s.ages[0]?.year ?? 0;
  // The realms: the greatest standing, and the fallen that lasted longest — rise and fall.
  const peopleOf = (c: number) => s.ctx.provinces.get(c)?.total() ?? 0,
    realms = [
      ...s.realms
        .filter((r) => r.ended === null)
        .map((r) => ({ r, k: r.members.reduce((n, c) => n + peopleOf(c), 0) }))
        .sort((a, b) => b.k - a.k || (a.r.ref < b.r.ref ? -1 : 1))
        .slice(0, 10)
        .map((x) => x.r),
      ...s.realms
        .filter((r) => r.ended !== null)
        .sort((a, b) => b.ended! - b.founded - (a.ended! - a.founded) || (a.ref < b.ref ? -1 : 1))
        .slice(0, 6),
    ].sort((a, b) => a.founded - b.founded || (a.ref < b.ref ? -1 : 1));
  const wars = [...s.wars]
    .sort(
      (a, b) => b.fallen[0] + b.fallen[1] - (a.fallen[0] + a.fallen[1]) || (a.ref < b.ref ? -1 : 1),
    )
    .slice(0, 16)
    .sort((a, b) => a.declared - b.declared);
  const b = beliefOf(world),
    faiths = [...s.faiths]
      .filter((f) => b.lands(f.ref).length)
      .sort((x, y) => b.lands(y.ref).length - b.lands(x.ref).length || x.founded - y.founded)
      .slice(0, 16)
      .sort((x, y) => x.founded - y.founded),
    speakers = languagesOf(world).speakers(),
    tongues = [...s.tongues]
      .sort(
        (x, y) =>
          (speakers.get(y.index)?.length ?? 0) - (speakers.get(x.index)?.length ?? 0) ||
          x.born - y.born,
      )
      .slice(0, 16)
      .sort((x, y) => x.born - y.born);
  return [
    {
      type: "timeline",
      title: "The realms: the greatest standing, and the longest-lived of the fallen",
      from: start,
      to: s.now,
      rows: realms.map((r) => ({
        label: [realmName(r)],
        ref: r.ref,
        from: r.founded,
        to: r.ended,
        color: realmColor(r.ref),
      })),
    },
    {
      type: "timeline",
      title: "The wars (the bloodiest)",
      from: start,
      to: s.now,
      rows: wars.map((w) => {
        const a = politiesOf(world).get(w.attacker),
          d = politiesOf(world).get(w.defender);
        return {
          label: [`${a?.town ?? "?"} upon ${d?.town ?? "?"}`],
          ref: w.ref,
          from: w.declared,
          to: w.ended ?? null,
          color: [0.85, 0.3, 0.3] as Rgb,
          words: `${count(w.fallen[0] + w.fallen[1])} fallen`,
        };
      }),
    },
    {
      type: "timeline",
      title: "The faiths (the widest held)",
      from: start,
      to: s.now,
      rows: faiths.map((f) => ({
        label: [f.name],
        ref: f.ref,
        from: f.founded,
        to: null,
        color: faithColor(f.ref),
        words: many(b.lands(f.ref).length, "land", "lands"),
      })),
    },
    {
      type: "timeline",
      title: "The tongues (the most spoken)",
      from: start,
      to: s.now,
      rows: tongues.map((l) => ({
        label: [l.name],
        ref: l.ref,
        from: Math.max(start, l.born),
        to: l.died,
        color: languageColor(l.family, l.index),
        words: many(speakers.get(l.index)?.length ?? 0, "land", "lands"),
      })),
    },
  ];
}

/** What history holds as mattering most, newest first. */
function eventBlocks(world: World): Block[] {
  const all = world.events.all(),
    items: Item[] = [];
  for (let i = all.length - 1; i >= 0 && items.length < 80; i--) {
    const e = all[i]!;
    if (e.importance < 4) continue;
    const year = yearAt(e.t);
    items.push(
      item([`Year ${count(year)}: `, { text: bare(claimOf(world, e.id)), ref: e.id }], e.id, year),
    );
  }
  return [{ type: "list", title: "What history holds, newest first", items }];
}

// ---------------------------------------------------------------------------------------
// The ledger.

/** The world's ledger: its realms, towns, wars, faiths, tongues, flights and life, compared. */
export function ledgerPage(world: World, tab?: string): PageModel {
  const now = yearNow(world),
    ctx = populationContext(world),
    g = homePlanet(world).generated,
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    realms = politiesOf(world).all(),
    standing = realms.filter((r) => r.ended === null),
    realmPeople = new Map(
      standing.map((r) => [r.ref, r.members.reduce((n, c) => n + peopleOf(c), 0)]),
    );
  const tabs: Tab[] = [
    {
      id: "realms",
      name: "Realms",
      blocks: realmLedger(world, standing, realmPeople, realms),
    },
    { id: "might", name: "Knowledge", blocks: knowledgeLedger(world, standing, realmPeople) },
    { id: "towns", name: "Towns", blocks: townLedger(world) },
    { id: "wars", name: "Wars", blocks: warLedger(world, now) },
    { id: "faiths", name: "Faiths", blocks: faithLedger(world) },
    { id: "tongues", name: "Tongues", blocks: tongueLedger(world) },
    { id: "life", name: "Life", blocks: lifeLedger(world) },
    { id: "sky", name: "Sky", blocks: skyLedger(world) },
  ];
  const home = ctx.provinces.all().filter((p) => !offworldSite(g, p.cell) && p.total() > 0).length;
  return {
    ref: "world:ledger",
    kind: "ledger",
    icon: "📊",
    title: "The Ledger",
    subtitle: [
      "the world's realms, towns, wars, faiths, tongues and life, side by side — ",
      link("the chronicle", "world:chronicle"),
    ],
    color: null,
    place: null,
    stats: [
      stat("Realms", count(standing.length)),
      stat("Lands", count(home)),
      stat("Towns", count(ctx.settlements.all().length)),
      stat(
        "At war",
        count(
          warsOf(world)
            .all()
            .filter((w) => w.ended === null).length,
        ),
      ),
    ],
    tabs,
    ...(tab ? { tab } : {}),
    followable: false,
    year: now,
    every: WORLD_EVERY,
  };
}

/** A realm as a link by its seat's name alone (a table's column says what it is). */
function realmShort(world: World, ref: Ref): Span {
  const r = politiesOf(world).get(ref);
  return r ? link(r.town, r.ref) : "a realm now gone";
}

/** What a realm is, in a word: its name without its seat's ("commonwealth", "holy seat"). */
function formOf(r: Polity): string {
  const name = realmName(r),
    seat = ` of ${r.town}`;
  return (name.endsWith(seat) ? name.slice(0, -seat.length) : name).replace(/^the /, "");
}

/** The most rows a ledger's table lists (its greatest or newest), and the words for the rest. */
const MOST_ROWS = 250;
function andMore(shown: number, all: number, what: string): Block[] {
  return all > shown
    ? [{ type: "text", lines: [[`The ${count(shown)} ${what} of ${count(all)} are listed.`]] }]
    : [];
}

/** Each age in a word and its sign. */
export const ERA_WORDS: Readonly<Record<string, string>> = {
  forage: "🏹 foragers",
  farm: "🌾 farming",
  metal: "⚒️ metal",
  industry: "🏭 industry",
  modern: "⚡ modern",
};

function realmLedger(
  world: World,
  standing: readonly Polity[],
  people: ReadonlyMap<string, number>,
  all: readonly Polity[],
): Block[] {
  const ctx = populationContext(world),
    wars = warsOf(world),
    b = beliefOf(world),
    langs = languagesOf(world),
    fallenOf = (r: Polity) =>
      wars
        .all()
        .reduce(
          (n, w) =>
            n + (w.attacker === r.ref ? w.fallen[0] : w.defender === r.ref ? w.fallen[1] : 0),
          0,
        ),
    byPeople = [...standing].sort(
      (a, b2) => people.get(b2.ref)! - people.get(a.ref)! || (a.ref < b2.ref ? -1 : 1),
    );
  const rows: Row[] = byPeople.map((r) => {
    const towns = r.members.reduce((n, c) => n + ctx.settlements.inProvince(c).length, 0),
      faith = b.of(r.seat).faith,
      tongue = langs.of(r.seat),
      atWar = wars.fighting(r.ref).filter((w) => w.ended === null).length,
      fallen = fallenOf(r);
    return {
      ref: r.ref,
      cells: [
        [link(r.town, r.ref)],
        [formOf(r)],
        [count(r.members.length)],
        [count(people.get(r.ref)!)],
        [count(towns)],
        [`year ${count(r.founded)}`],
        faith ? [faithLink(world, faith)] : ["the old beliefs"],
        tongue ? [languageLink(world, tongue.ref)] : ["—"],
        [atWar ? many(atWar, "war", "wars") : "at peace"],
        [count(fallen)],
      ],
      keys: [
        r.town,
        formOf(r),
        r.members.length,
        people.get(r.ref)!,
        towns,
        r.founded,
        faith ?? "",
        tongue?.name ?? "",
        atWar,
        fallen,
      ],
    };
  });
  // Their people through the years (of the lands each holds now).
  const top = byPeople.slice(0, 6),
    series = top.map((r) => {
      const byYear = new Map<number, number>();
      for (const c of r.members)
        for (const y of ctx.history.yearsOf(c))
          byYear.set(y.year, (byYear.get(y.year) ?? 0) + y.population);
      return {
        name: realmName(r),
        ref: r.ref,
        color: realmColor(r.ref),
        points: thin(
          [...byYear].sort((a, b2) => a[0] - b2[0]).map(([x, y]) => ({ x, y })),
          140,
        ),
      };
    });
  const fallen = all
    .filter((r) => r.ended !== null)
    .sort((a, b2) => b2.ended! - a.ended! || (a.ref < b2.ref ? -1 : 1));
  const fallenRows: Row[] = fallen.slice(0, MOST_ROWS).map((r) => ({
    ref: r.ref,
    cells: [
      [link(realmName(r), r.ref)],
      [`year ${count(r.founded)}`],
      [`year ${count(r.ended!)}`],
      [count(r.ended! - r.founded)],
    ],
    keys: [realmName(r), r.founded, r.ended!, r.ended! - r.founded],
  }));
  return [
    {
      type: "bars",
      title: "The realms by their people",
      unit: "people",
      bars: byPeople.slice(0, 12).map((r) => ({
        label: [r.town],
        ref: r.ref,
        value: people.get(r.ref)!,
        color: realmColor(r.ref),
      })),
    },
    {
      type: "table",
      title: "The realms standing",
      columns: [
        "Realm",
        "Form",
        "Lands",
        "People",
        "Towns",
        "Founded",
        "Faith",
        "Tongue",
        "At war",
        "Fallen in war",
      ],
      rows,
    },
    {
      type: "lines",
      title: "Their people through the years (the lands each holds now)",
      unit: "people",
      series,
    },
    {
      type: "table",
      title: "The fallen realms, the latest first",
      columns: ["Realm", "Founded", "Fell", "Years"],
      rows: fallenRows,
    },
    ...andMore(Math.min(MOST_ROWS, fallen.length), fallen.length, "latest fallen"),
  ];
}

/** What each realm knows, at its seat: its age, how much of what has been found, its newest. */
function knowledgeLedger(
  world: World,
  standing: readonly Polity[],
  people: ReadonlyMap<string, number>,
): Block[] {
  const lore = loreOf(world),
    ctx = populationContext(world),
    markets = marketsOf(world),
    found = new Set<string>();
  for (const p of ctx.provinces.all()) for (const [id] of lore.of(p.cell)) found.add(id);
  if (ctx.provinces.all().some((p) => p.knowsCultivation)) found.add("cultivation");
  if (ctx.provinces.all().some((p) => markets.get(p.cell)?.metalworking)) found.add("metalworking");
  const known = (r: Polity) => {
    const ids = new Set<string>();
    for (const c of r.members) for (const [id] of lore.of(c)) ids.add(id);
    if (r.members.some((c) => ctx.provinces.get(c)?.knowsCultivation)) ids.add("cultivation");
    if (r.members.some((c) => markets.get(c)?.metalworking)) ids.add("metalworking");
    return ids;
  };
  const ERA_RANK: Readonly<Record<string, number>> = {
    forage: 0,
    farm: 1,
    metal: 2,
    industry: 3,
    modern: 4,
  };
  const ranked = [...standing]
    .map((r) => ({ r, ids: known(r), era: landEra(world, r.seat) }))
    .sort(
      (a, b) =>
        b.ids.size - a.ids.size ||
        people.get(b.r.ref)! - people.get(a.r.ref)! ||
        (a.r.ref < b.r.ref ? -1 : 1),
    );
  const rows: Row[] = ranked.map(({ r, ids, era }) => {
    const newest = lore.of(r.seat).at(-1);
    return {
      ref: `${r.ref}#lore`,
      cells: [
        [link(r.town, r.ref)],
        [ERA_WORDS[era] ?? era],
        [count(ids.size)],
        [share(found.size ? ids.size / found.size : 0)],
        newest
          ? [
              link(sentenceCase(principleName(newest[0])), newest[1].event),
              ` (year ${count(newest[1].year)})`,
            ]
          : ["—"],
      ],
      keys: [
        r.town,
        ERA_RANK[era] ?? 0,
        ids.size,
        found.size ? ids.size / found.size : 0,
        newest?.[1].year ?? -1,
      ],
    };
  });
  return [
    {
      type: "bars",
      title: "What each realm knows (in any of its lands)",
      unit: "count",
      bars: ranked.slice(0, 12).map(({ r, ids }) => ({
        label: [r.town],
        ref: `${r.ref}#lore`,
        value: ids.size,
        color: realmColor(r.ref),
      })),
    },
    {
      type: "table",
      title: "The realms' knowledge",
      columns: ["Realm", "Age (its seat)", "Known", "Of all found", "Newest at its seat"],
      rows,
    },
  ];
}

function townLedger(world: World): Block[] {
  const ctx = populationContext(world),
    realms = politiesOf(world),
    towns = [...ctx.settlements.all()]
      .filter((t) => t.population > 0)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1));
  const rows: Row[] = towns.slice(0, MOST_ROWS).map((t) => {
    const realm = realms.of(t.cell),
      city = citiesOf(world).get(t.ref);
    return {
      ref: t.ref,
      cells: [
        [link(t.name, t.ref)],
        [landLink(world, t.cell)],
        realm ? [realmShort(world, realm.ref)] : ["none"],
        [count(t.population)],
        [`year ${count(t.founded)}`],
        [city ? `a city since year ${count(city.founded)}` : "—"],
        [t.market ? "its land's market" : "—"],
      ],
      keys: [
        t.name,
        landTitle(world, t.cell),
        realm ? realmName(realm) : "",
        t.population,
        t.founded,
        city ? city.founded : 1e9,
        t.market ? 1 : 0,
      ],
    };
  });
  return [
    {
      type: "bars",
      title: "The largest towns",
      unit: "people",
      bars: towns.slice(0, 12).map((t) => {
        const realm = realms.of(t.cell);
        return {
          label: [t.name],
          ref: t.ref,
          value: t.population,
          ...(realm ? { color: realmColor(realm.ref) } : {}),
        };
      }),
    },
    {
      type: "table",
      title: "The towns, the largest first",
      columns: ["Town", "Land", "Realm", "People", "Founded", "City", "Market"],
      rows,
    },
    ...andMore(rows.length, towns.length, "largest towns"),
  ];
}

function warLedger(world: World, now: number): Block[] {
  const realms = politiesOf(world),
    wars = [...warsOf(world).all()].sort(
      (a, b) => b.declared - a.declared || (a.ref < b.ref ? -1 : 1),
    ),
    name = (ref: Ref) => realms.get(ref)?.town ?? "the fallen";
  const rows: Row[] = wars.slice(0, MOST_ROWS).map((w) => {
    const won = w.battles.filter((b) => b.won).length,
      fallen = w.fallen[0] + w.fallen[1],
      years = (w.ended ?? now) - w.declared;
    return {
      ref: w.ref,
      cells: [
        [link(`${name(w.attacker)} upon ${name(w.defender)}`, w.ref)],
        [`year ${count(w.declared)}`],
        [w.ended === null ? "still fought" : `year ${count(w.ended)}`],
        [count(years)],
        [count(w.battles.length)],
        [`${count(won)} – ${count(w.battles.length - won)}`],
        [count(fallen)],
      ],
      keys: [
        `${name(w.attacker)} ${name(w.defender)}`,
        w.declared,
        w.ended ?? 1e9,
        years,
        w.battles.length,
        won - (w.battles.length - won),
        fallen,
      ],
    };
  });
  return [
    {
      type: "bars",
      title: "The bloodiest wars",
      unit: "people",
      bars: [...wars]
        .sort(
          (a, b) =>
            b.fallen[0] + b.fallen[1] - (a.fallen[0] + a.fallen[1]) || (a.ref < b.ref ? -1 : 1),
        )
        .slice(0, 10)
        .filter((w) => w.fallen[0] + w.fallen[1] > 0)
        .map((w) => ({
          label: [`${name(w.attacker)} upon ${name(w.defender)}`],
          ref: w.ref,
          value: w.fallen[0] + w.fallen[1],
          color: realmColor(w.attacker),
        })),
    },
    {
      type: "table",
      title: "The wars, the newest first",
      columns: ["War", "Declared", "Ended", "Years", "Battles", "Won – held", "Fallen"],
      rows,
    },
    ...andMore(rows.length, wars.length, "newest wars"),
  ];
}

function faithLedger(world: World): Block[] {
  const ctx = populationContext(world),
    store = beliefOf(world),
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    faiths = store
      .all()
      .map((f) => {
        const lands = store.lands(f.ref);
        return { f, lands: lands.length, people: lands.reduce((n, c) => n + peopleOf(c), 0) };
      })
      .sort((a, b) => b.people - a.people || b.lands - a.lands || (a.f.ref < b.f.ref ? -1 : 1));
  const held = faiths.filter((x) => x.lands > 0),
    gone = faiths.length - held.length;
  const rows: Row[] = held.map(({ f, lands, people }) => ({
    ref: f.ref,
    cells: [
      [link(f.name, f.ref)],
      [DEITIES[f.tenet]],
      [count(lands)],
      [count(people)],
      [`year ${count(f.founded)}`],
      [landLink(world, f.seat)],
      f.from ? [faithLink(world, f.from)] : ["—"],
    ],
    keys: [
      f.name,
      DEITIES[f.tenet],
      lands,
      people,
      f.founded,
      landTitle(world, f.seat),
      f.from ?? "",
    ],
  }));
  return [
    {
      type: "bars",
      title: "The faiths by their faithful",
      unit: "people",
      bars: faiths
        .filter((x) => x.people > 0)
        .slice(0, 12)
        .map(({ f, people }) => ({
          label: [f.name],
          ref: f.ref,
          value: people,
          color: faithColor(f.ref),
        })),
    },
    {
      type: "table",
      title: "The faiths held",
      columns: ["Faith", "God", "Lands", "People", "Founded", "Began in", "Split from"],
      rows,
    },
    ...(gone
      ? [
          {
            type: "text" as const,
            lines: [[`And ${many(gone, "faith", "faiths")} no land holds now.`]],
          },
        ]
      : []),
  ];
}

function tongueLedger(world: World): Block[] {
  const ctx = populationContext(world),
    store = languagesOf(world),
    speakers = store.speakers(),
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    tongues = store
      .all()
      .map((l) => {
        const lands = speakers.get(l.index) ?? [];
        return { l, lands: lands.length, people: lands.reduce((n, c) => n + peopleOf(c), 0) };
      })
      .sort((a, b) => b.people - a.people || b.lands - a.lands || a.l.index - b.l.index);
  const rows: Row[] = tongues.map(({ l, lands, people }) => {
    const parent = l.parent === null ? null : store.at(l.parent);
    return {
      ref: l.ref,
      cells: [
        [link(l.name, l.ref)],
        [store.familyName(l)],
        [count(lands)],
        [count(people)],
        [l.born > 0 ? `year ${count(l.born)}` : "of the first people"],
        parent ? [languageLink(world, parent.ref)] : ["—"],
        [l.died === null ? (lands ? "spoken" : "—") : `last spoken in year ${count(l.died)}`],
      ],
      keys: [l.name, store.familyName(l), lands, people, l.born, parent?.name ?? "", l.died ?? 1e9],
    };
  });
  return [
    {
      type: "bars",
      title: "The tongues by their speakers",
      unit: "people",
      bars: tongues
        .filter((x) => x.people > 0)
        .slice(0, 12)
        .map(({ l, people }) => ({
          label: [l.name],
          ref: l.ref,
          value: people,
          color: languageColor(l.family, l.index),
        })),
    },
    {
      type: "table",
      title: "Every tongue",
      columns: ["Tongue", "Family", "Lands", "Speakers", "Arose", "Grew from", "Now"],
      rows,
    },
  ];
}

function lifeLedger(world: World): Block[] {
  const g = homePlanet(world).generated,
    ctx = populationContext(world),
    n = landsOf(world),
    species = g.life.species,
    lands = new Array<number>(species.length).fill(0);
  for (let c = 0; c < n; c++) {
    const lost = wildsOf(ctx, c).lost;
    for (const s of species)
      if (s.died === null && lives(g.life, c, s.index) && !lost.includes(s.index))
        lands[s.index]!++;
  }
  const LEVELS = ["", "grows", "eats plants", "hunts", "hunts hunters"];
  const rows: Row[] = [...species]
    .sort((a, b) => lands[b.index]! - lands[a.index]! || a.index - b.index)
    .map((s) => {
      const flies = !!s.body && s.body.wings > 0 && s.body.moves === "fly",
        age = g.deep.ages[s.arose];
      return {
        ref: s.ref,
        cells: [
          [`${lineageIcon(s.niche, flies)} `, link(s.name, s.ref)],
          [s.niche],
          [LEVELS[s.level] ?? `level ${s.level}`],
          [s.niche === "seed grass" ? "—" : `${s.size < 1 ? s.size.toFixed(2) : count(s.size)} kg`],
          [count(lands[s.index]!)],
          [age ? `${age.from.toFixed(0)} million years ago` : "the deep past"],
          [s.died === null ? (lands[s.index] ? "living" : "gone from the lands") : "died out"],
          [s.tame ? "yes" : "—"],
        ],
        keys: [
          s.name,
          s.niche,
          s.level,
          s.niche === "seed grass" ? -1 : s.size,
          lands[s.index]!,
          age?.from ?? 0,
          s.died === null ? 1 : 0,
          s.tame ? 1 : 0,
        ],
      };
    });
  return [
    {
      type: "bars",
      title: "The most widespread lineages",
      unit: "count",
      bars: [...species]
        .filter((s) => lands[s.index]! > 0)
        .sort((a, b) => lands[b.index]! - lands[a.index]! || a.index - b.index)
        .slice(0, 12)
        .map((s) => ({ label: [s.name], ref: s.ref, value: lands[s.index]! })),
    },
    {
      type: "table",
      title: "Every lineage",
      columns: ["Lineage", "What", "In the web", "Weight", "Lands", "Arose", "Now", "Tame"],
      rows,
    },
  ];
}

function skyLedger(world: World): Block[] {
  const programs = spaceOf(world).all(),
    y = (ref: Ref | null) => {
      const v = yearOfEvent(world, ref);
      return v === null ? null : v;
    };
  const rows: Row[] = programs.map((p) => {
    const sat = y(p.satellite),
      crew = y(p.crew),
      station = y(p.station);
    return {
      ref: p.realm,
      cells: [
        [realmShort(world, p.realm)],
        sat === null ? ["—"] : [link(`year ${count(sat)}`, p.satellite!)],
        crew === null ? ["—"] : [link(`year ${count(crew)}`, p.crew!)],
        station === null ? ["—"] : [link(`year ${count(station)}`, p.station!)],
        [count(p.launches)],
        [count(p.colonies.length)],
      ],
      keys: [p.realm, sat ?? 1e9, crew ?? 1e9, station ?? 1e9, p.launches, p.colonies.length],
    };
  });
  const colonies: Row[] = programs.flatMap((p) =>
    p.colonies.map((c) => ({
      ref: cellRef(0, c.cell),
      cells: [
        [landLink(world, c.cell)],
        [realmShort(world, p.realm)],
        [`year ${count(c.year)}`],
        [count(populationContext(world).provinces.get(c.cell)?.total() ?? 0)],
      ],
      keys: [
        landTitle(world, c.cell),
        p.realm,
        c.year,
        populationContext(world).provinces.get(c.cell)?.total() ?? 0,
      ],
    })),
  );
  return [
    {
      type: "table",
      title: "The race to the sky",
      columns: ["Realm", "Satellite", "Crew", "Station", "Launches", "Colonies"],
      rows,
    },
    {
      type: "table",
      title: "The colonies",
      columns: ["Colony", "Of", "Founded", "People"],
      rows: colonies,
    },
  ];
}
