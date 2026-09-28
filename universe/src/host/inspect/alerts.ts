// The chrome's host side (Phase 10 M96, M97): the alerts — what stands now and asks to be
// looked at, as a grand strategy game's alerts ask; the message log — everything told of
// what is followed, kept; and what each of the top bar's numbers is made of. Pure reads of
// the world (a person met is brought up to now in the observer ledger, which history never
// reads), so asking never moves it.
import { offworldSite } from "../../gen/index.ts";
import { parseRef, type Ref, type World } from "../../kernel/index.ts";
import { deepen, newsLog, observer, watches } from "../../causal/index.ts";
import {
  beliefOf,
  citiesOf,
  homePlanet,
  languagesOf,
  politiesOf,
  populationContext,
  warsOf,
} from "../../sim/index.ts";
import type {
  Alert,
  Block,
  Breakdown,
  Line,
  PageModel,
  Row,
  Span,
  Stat,
} from "../../bridge/index.ts";
import { bare, count, many, part, share, stat, yearNow } from "./words.ts";
import { faithLink, landLink, languageLink, nameOf, realmLink, townLink } from "./names.ts";
import { worldFirsts } from "./world.ts";

/** A land is going hungry below this much of its need met, in thousandths (as the top bar counts). */
const HUNGRY = 850;
/** A first in the world is news for this many years. */
const FIRST_YEARS = 25;
/** The most lines a number's breakdown shows. */
const BREAKDOWN_LINES = 6;

type AlertItem = Alert["items"][number];

/**
 * The world's firsts, read again only once its year or its history has moved on (the alerts
 * are asked every few seconds; reading the firsts reads all of history).
 */
const firstsKept = new WeakMap<World, { key: string; firsts: ReturnType<typeof worldFirsts> }>();
function firstsNow(world: World): ReturnType<typeof worldFirsts> {
  const key = `${yearNow(world)}:${world.events.all().length}`,
    kept = firstsKept.get(world);
  if (kept?.key === key) return kept.firsts;
  const firsts = worldFirsts(world);
  firstsKept.set(world, { key, firsts });
  return firsts;
}

/** A ref's kind: its first word ("cell", "town", "pol", "prsn"). */
function kindOf(ref: string): string {
  return ref.slice(0, ref.indexOf(":"));
}

/** A war as a link: "The war of Graiholt upon Febremon". */
function warLink(world: World, ref: string): Span {
  const name = nameOf(world, ref);
  return { text: name[0]!.toUpperCase() + name.slice(1), ref };
}

/**
 * What stands now and asks to be looked at: the wars of the realms followed (and of the
 * realms the lands and towns followed are in), the lands followed going hungry (and the
 * realms followed with hungry lands), the lives followed that have ended, the realms followed
 * that have fallen, and what the world did first in the last years.
 */
export function alertsOf(world: World): Alert[] {
  const realms = politiesOf(world),
    ctx = populationContext(world),
    ledger = observer(world),
    now = yearNow(world),
    followed = ledger.allWatches().map((w) => w.ref as string),
    atWar = new Set<string>(),
    lands = new Set<number>(),
    realmsFollowed: string[] = [],
    death: AlertItem[] = [],
    fallen: AlertItem[] = [];
  for (const ref of followed) {
    const kind = kindOf(ref);
    if (kind === "pol") {
      const r = realms.get(ref as Ref);
      if (!r) continue;
      if (r.ended !== null)
        fallen.push({
          line: [realmLink(world, ref), ` fell in year ${count(r.ended)}`],
          ref,
          key: `fallen:${ref}`,
        });
      else {
        realmsFollowed.push(ref);
        atWar.add(ref);
      }
    } else if (kind === "cell" || kind === "town") {
      const cell = kind === "cell" ? parseRef(ref as Ref).b : ctx.settlements.get(ref as Ref)?.cell;
      if (cell === undefined) continue;
      lands.add(cell);
      const r = realms.of(cell);
      if (r && r.ended === null) atWar.add(r.ref);
    } else if (kind === "prsn") {
      const known = ledger.person(ref as Ref);
      if (!known) continue;
      const p = deepen(world, known);
      if (!p.alive && p.diedYear !== null)
        death.push({
          line: [
            { text: `${p.name} ${p.surname}`, ref },
            ` died in year ${count(p.diedYear)}, at ${p.diedYear - p.birthYear}`,
          ],
          ref,
          key: `death:${ref}`,
        });
    }
  }
  // At war: each war once, of the realms asked after.
  const war: AlertItem[] = warsOf(world)
    .all()
    .filter((w) => w.ended === null && (atWar.has(w.attacker) || atWar.has(w.defender)))
    .map((w) => ({
      line: [
        warLink(world, w.ref),
        `: since year ${count(w.declared)}, ${many(w.fallen[0] + w.fallen[1], "fallen", "fallen")}`,
      ],
      ref: w.ref,
      key: `war:${w.ref}`,
    }));
  // Going hungry: the lands followed, then the realms followed by their hungry lands.
  const hunger: AlertItem[] = [];
  for (const cell of lands) {
    const p = ctx.provinces.get(cell);
    if (p && p.total() > 0 && p.fed < HUNGRY)
      hunger.push({
        line: [landLink(world, cell), ` is going hungry: ${share(p.fed / 1000)} fed`],
        ref: `cell:0:${cell}`,
        key: `hunger:${cell}`,
      });
  }
  if (realmsFollowed.length) {
    const hungry = new Map<string, number>();
    for (const p of ctx.provinces.all()) {
      if (p.fed >= HUNGRY || p.total() <= 0) continue;
      const r = realms.of(p.cell);
      if (r) hungry.set(r.ref, (hungry.get(r.ref) ?? 0) + 1);
    }
    for (const ref of realmsFollowed) {
      const n = hungry.get(ref) ?? 0;
      if (n)
        hunger.push({
          line: [realmLink(world, ref), ` has ${many(n, "land", "lands")} going hungry`],
          ref,
          key: `hunger:${ref}`,
        });
    }
  }
  // Firsts: what the world did first lately, the newest first.
  const first: AlertItem[] = firstsNow(world)
    .filter((f) => f.year >= now - FIRST_YEARS)
    .reverse()
    .map((f) => ({
      line: [
        f.what,
        `, year ${count(f.year)}`,
        ...(f.land !== null ? [", ", landLink(world, f.land)] : []),
      ],
      ref: f.ref ?? (f.land !== null ? `cell:0:${f.land}` : "world:chronicle#firsts"),
      key: `first:${f.what}`,
    }));
  const alerts: Alert[] = [
    { id: "war", icon: "⚔️", title: "At war", tone: "war", items: war },
    { id: "hunger", icon: "🍂", title: "Going hungry", tone: "want", items: hunger },
    { id: "fallen", icon: "🏳️", title: "A realm fallen", tone: "loss", items: fallen },
    { id: "death", icon: "🕯️", title: "A life ended", tone: "loss", items: death },
    { id: "first", icon: "🌟", title: "A first in the world", tone: "news", items: first },
  ];
  return alerts.filter((a) => a.items.length);
}

/** How often the message log is read again as the world runs (ms). */
const LOG_EVERY = 4000;
/** The most messages of one thing followed listed under it. */
const LOG_EACH = 30;

/** The message log: everything told of what is followed since it was taken up, the newest first. */
export function logPage(world: World, tab?: string): PageModel {
  const log = newsLog(world),
    followed = watches(world),
    now = yearNow(world),
    rows: Row[] = log.map((m) => ({
      ref: m.ref,
      cells: [[`year ${count(m.year)}`], [{ text: m.label, ref: m.watch }], [bare(m.claim)]],
      keys: [m.year, m.label, m.claim],
    })),
    byWatch = new Map<string, typeof log>();
  for (const m of log) {
    const list = byWatch.get(m.watch) ?? [];
    list.push(m);
    byWatch.set(m.watch, list);
  }
  const each: Block[] = followed.map((w) => {
    const list = byWatch.get(w.ref) ?? [];
    return {
      type: "list",
      title: w.label,
      items: list.slice(0, LOG_EACH).map((m) => ({
        line: [`Year ${count(m.year)}: `, { text: bare(m.claim), ref: m.ref }],
        ref: m.ref,
        year: m.year,
      })),
      ...(list.length > LOG_EACH ? { more: list.length - LOG_EACH } : {}),
    };
  });
  const none: Block = {
    type: "text",
    lines: [
      followed.length
        ? ["Nothing has been told yet of what you follow: its news is kept here as it comes."]
        : [
            "Nothing followed yet. A page's “Follow” adds a land, a town, a realm or a person met, and what is told of them is kept here.",
          ],
    ],
  };
  const stats: Stat[] = [
    stat("Messages", count(log.length)),
    stat("Followed", count(followed.length), {
      parts: followed.map((w) =>
        part([{ text: w.label, ref: w.ref }], count(byWatch.get(w.ref)?.length ?? 0)),
      ),
    }),
  ];
  return {
    ref: "world:log",
    kind: "log",
    icon: "📬",
    title: "The message log",
    subtitle: [
      "what was told of what you follow — the world's own story is in ",
      { text: "the chronicle", ref: "world:chronicle" },
    ],
    color: null,
    place: null,
    stats,
    tabs: [
      {
        id: "all",
        name: "All",
        blocks: rows.length
          ? [
              {
                type: "table",
                title: "The newest first",
                columns: ["When", "Of", "What was told"],
                rows,
              },
            ]
          : [none],
      },
      ...(followed.length ? [{ id: "each", name: "By what you follow", blocks: each }] : []),
    ],
    ...(tab ? { tab } : {}),
    followable: false,
    year: now,
    every: LOG_EVERY,
  };
}

/** What the top bar counts, each of its numbers. */
export type Counted =
  "people" | "towns" | "realms" | "wars" | "faiths" | "tongues" | "hungry" | "colonies";

/** The greatest first, as far as the breakdown shows, and how many more. */
function greatest<T>(
  xs: readonly T[],
  by: (x: T) => number,
  line: (x: T) => Line,
  what: [string, string],
) {
  const sorted = [...xs].sort((a, b) => by(b) - by(a)),
    rest = sorted.length - BREAKDOWN_LINES;
  return {
    lines: sorted.slice(0, BREAKDOWN_LINES).map(line),
    ...(rest > 0 ? { more: `and ${many(rest, ...what)} more` } : {}),
  };
}

/**
 * What one of the top bar's numbers is made of (Phase 10 M97): the most peopled realms, the
 * largest towns, the greatest realms, the wars being fought, the faiths and tongues most held,
 * the hungriest lands, the halls beyond the world — each a line, its names links.
 */
export function breakdownOf(world: World, what: Counted): Breakdown {
  const ctx = populationContext(world),
    realms = politiesOf(world),
    g = homePlanet(world).generated,
    home = ctx.provinces.all().filter((p) => !offworldSite(g, p.cell) && p.total() > 0);
  switch (what) {
    case "people":
    case "realms": {
      const byRealm = new Map<string, { people: number; lands: number }>();
      let unruled = 0;
      for (const p of home) {
        const r = realms.of(p.cell);
        if (!r || r.ended !== null) {
          unruled += p.total();
          continue;
        }
        const e = byRealm.get(r.ref) ?? { people: 0, lands: 0 };
        e.people += p.total();
        e.lands += 1;
        byRealm.set(r.ref, e);
      }
      const list = [...byRealm].map(([ref, e]) => ({ ref, ...e }));
      if (what === "people") {
        const b = greatest(
          list,
          (x) => x.people,
          (x) => [realmLink(world, x.ref), `: ${count(x.people)}`],
          ["realm", "realms"],
        );
        return {
          title: "The most peopled realms",
          lines: [...b.lines, ...(unruled ? [[`Under no realm: ${count(unruled)}`]] : [])],
          ...(b.more ? { more: b.more } : {}),
        };
      }
      return {
        title: "The greatest realms",
        ...greatest(
          list,
          (x) => x.lands * 1e9 + x.people,
          (x) => [
            realmLink(world, x.ref),
            `: ${many(x.lands, "land", "lands")}, ${count(x.people)} people`,
          ],
          ["realm", "realms"],
        ),
      };
    }
    case "towns": {
      const cities = citiesOf(world);
      return {
        title: "The largest towns",
        ...greatest(
          ctx.settlements.all().filter((t) => t.population > 0 && !offworldSite(g, t.cell)),
          (t) => t.population,
          (t) => [
            townLink(world, t.ref),
            `: ${count(t.population)}${cities.get(t.ref) ? ", a city" : ""}`,
          ],
          ["town", "towns"],
        ),
      };
    }
    case "wars": {
      const fought = warsOf(world)
        .all()
        .filter((w) => w.ended === null);
      return {
        title: "The wars being fought",
        ...greatest(
          fought,
          (w) => w.fallen[0] + w.fallen[1],
          (w) => [
            warLink(world, w.ref),
            `: since year ${count(w.declared)}, ${many(w.fallen[0] + w.fallen[1], "fallen", "fallen")}`,
          ],
          ["war", "wars"],
        ),
      };
    }
    case "faiths": {
      const beliefs = beliefOf(world),
        held = new Map<string, { lands: number; people: number }>();
      for (const p of home) {
        const f = beliefs.of(p.cell).faith;
        if (!f) continue;
        const e = held.get(f) ?? { lands: 0, people: 0 };
        e.lands += 1;
        e.people += p.total();
        held.set(f, e);
      }
      return {
        title: "The faiths most held",
        ...greatest(
          [...held].map(([ref, e]) => ({ ref, ...e })),
          (x) => x.people,
          (x) => [
            faithLink(world, x.ref),
            `: ${count(x.people)} in ${many(x.lands, "land", "lands")}`,
          ],
          ["faith", "faiths"],
        ),
      };
    }
    case "tongues": {
      const tongues = languagesOf(world),
        spoken = new Map<string, { lands: number; people: number }>();
      for (const p of home) {
        const l = tongues.of(p.cell);
        if (!l) continue;
        const e = spoken.get(l.ref) ?? { lands: 0, people: 0 };
        e.lands += 1;
        e.people += p.total();
        spoken.set(l.ref, e);
      }
      return {
        title: "The tongues most spoken",
        ...greatest(
          [...spoken].map(([ref, e]) => ({ ref, ...e })),
          (x) => x.people,
          (x) => [
            languageLink(world, x.ref),
            `: ${count(x.people)} in ${many(x.lands, "land", "lands")}`,
          ],
          ["tongue", "tongues"],
        ),
      };
    }
    case "hungry":
      return {
        title: "The hungriest lands",
        ...greatest(
          home.filter((p) => p.fed < HUNGRY),
          (p) => -p.fed,
          (p) => [
            landLink(world, p.cell),
            `: ${share(p.fed / 1000)} fed, ${count(p.total())} people`,
          ],
          ["land", "lands"],
        ),
      };
    case "colonies":
      return {
        title: "The halls beyond the world",
        ...greatest(
          ctx.provinces.all().filter((p) => offworldSite(g, p.cell) && p.total() > 0),
          (p) => p.total(),
          (p) => [landLink(world, p.cell), `: ${count(p.total())} people`],
          ["hall", "halls"],
        ),
      };
  }
}
