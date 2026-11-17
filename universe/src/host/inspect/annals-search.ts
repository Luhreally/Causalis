// A search of the years (asked 2026-11-16): the whole log read for what a person typed, the events the annals
// leave out as minor among them, a page at a time. Cheap by being lazy:
//   - The log is in the order things happened (and in the minter's), so a year range is two halvings and a page
//     reads on from the last event it gave, by its number.
//   - What can be told without an event's words is told first: its kind (by its type), its year, what it names.
//     Its words are made only for the events that get that far, and kept for the sitting, up to a bound.
//   - The world's names (realms, towns, people, houses, lands, faiths, tongues, peoples, goods...) are read once a
//     sitting (the page says which sitting it is), up to a bound, for suggestions and for names the words don't say.
//   - A page stops at its lines; the first counts on for a short while, then says it counted only so far.
import { YEAR, yearOfMoment, type HistoryEvent, type World } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { observer, why } from "../../causal/index.ts";
import {
  beliefOf,
  civilizationOf,
  contactsOf,
  courtOf,
  homePlanet,
  languagesOf,
  peopleWords,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
} from "../../sim/index.ts";
import { GOODS } from "../../rules/index.ts";
import {
  KIND_WORTH,
  fold,
  holds,
  holdsWhole,
  termOf,
  type AnnalFilter,
  type AnnalFound,
  type AnnalKey,
  type AnnalName,
  type AnnalsFound,
  type AnnalsSearchArgs,
  type Line,
} from "../../bridge/index.ts";
import { firstsNow } from "./alerts.ts";
import { ANNAL_TYPES, landName, lineOf, ruleOf, withoutYear } from "./annals.ts";
import { eventKind, TITLED_TYPES } from "./history.ts";
import { lineageIcon } from "./names.ts";

/** A page's lines at most, and when none is asked for. */
export const SEARCH_MOST = 100,
  SEARCH_LINES = 30;
/** How long a page reads to find its lines, and how long the first counts on past them (ms). */
export const FIND_MS = 400,
  COUNT_MS = 60;
/** How many events' words a sitting keeps, and how many names. */
export const WORDS_KEPT = 80_000,
  NAMES_KEPT = 60_000;
/** A word that names more things than this says nothing of which: it is matched by the words alone. */
const NAMED_MOST = 4_000;

/** A thing by its name, as kept for a sitting. */
type Named = AnnalName & { readonly folded: string; readonly weight: number };

/** What a sitting keeps: the world's names, events' words, the world's firsts. */
type Sitting = {
  readonly id: number;
  names: Named[] | null;
  readonly words: Map<number, string>;
  firsts: Set<string> | null;
};

const SITTINGS = new WeakMap<World, Sitting>();

function sittingOf(world: World, id: number): Sitting {
  const was = SITTINGS.get(world);
  if (was && was.id === id) return was;
  const s: Sitting = { id, names: null, words: new Map(), firsts: null };
  SITTINGS.set(world, s);
  return s;
}

/** An event's number: its place in the minter's order. */
const serialOf = (id: string) => Number(id.slice(id.lastIndexOf(":") + 1));

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** The world's names, read once a sitting: the greater of each sort first, up to a bound. */
function namesOf(world: World, s: Sitting): Named[] {
  if (s.names) return s.names;
  const out: Named[] = [],
    add = (
      key: AnnalKey,
      ref: string | null,
      name: string,
      title: string,
      icon: string,
      note: string,
      weight: number,
      also = "",
    ) => {
      if (!name) return;
      out.push({ key, ref, name, title, icon, note, weight, folded: fold(`${name} ${also}`) });
    };
  const ctx = populationContext(world),
    peopleIn = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    realms = politiesOf(world);
  for (const r of realms.all()) {
    const people = r.members.reduce((n, c) => n + peopleIn(c), 0),
      living = r.ended === null,
      name = realmName(r);
    add(
      "realm",
      r.ref,
      name,
      name,
      "👑",
      living ? `${fmt(people)} people` : `fell in year ${fmt(r.ended!)}`,
      (living ? 1e7 : 0) + people,
      r.town,
    );
    // (Its ruler, and the house that rules it: by their names.)
    const family = r.ruler.name.split(" ").slice(1).join(" ");
    add(
      "person",
      `rule:${r.ref}`,
      r.ruler.name,
      r.ruler.name,
      "👑",
      `${living ? "rules" : "last ruled"} ${name}`,
      (living ? 1e6 : 0) + people,
    );
    if (family)
      add(
        "house",
        `rule:${r.ref}`,
        family,
        `the house of ${family}`,
        "🏰",
        `rules ${name}`,
        (living ? 1e6 : 0) + people,
      );
  }
  for (const c of courtOf(world)?.all() ?? []) {
    const realm = realms.get(c.realm),
      of = realm ? realmName(realm) : "a realm";
    for (const f of c.figures)
      add("person", `court:${c.realm}:${f.id}`, f.name, f.name, "🗡️", `of the court of ${of}`, 1e5);
    for (const g of c.gone)
      add(
        "person",
        `court:${c.realm}:${g.id}`,
        g.name,
        g.name,
        "🗡️",
        `once of the court of ${of}`,
        1e3,
      );
  }
  for (const t of ctx.settlements.all())
    add(
      "town",
      t.ref,
      t.name,
      t.name,
      "🏘️",
      t.population > 0 ? `${fmt(t.population)} people` : "a town now gone",
      t.population,
    );
  for (const p of ctx.provinces.all()) {
    const first = ctx.settlements.seenIn(p.cell)[0];
    if (!first || !p.total()) continue;
    add(
      "land",
      cellRef(0, p.cell),
      `${first.name}'s land`,
      `${first.name}'s land`,
      "🗺️",
      landName(world, p.cell),
      p.total() / 10,
    );
  }
  const beliefs = beliefOf(world);
  for (const f of beliefs.all()) {
    const lands = beliefs.lands(f.ref).length;
    add(
      "faith",
      f.ref,
      f.name,
      f.name,
      "✨",
      lands ? `held in ${fmt(lands)} lands` : "no land holds it now",
      lands * 1000,
    );
  }
  const tongues = languagesOf(world),
    speakers = tongues.speakers();
  for (const l of tongues.all()) {
    const lands = speakers.get(l.index)?.length ?? 0;
    add(
      "tongue",
      l.ref,
      l.name,
      l.name,
      "🗣️",
      lands ? `spoken in ${fmt(lands)} lands` : "no longer spoken",
      lands * 1000,
    );
  }
  for (const w of warsOf(world).all()) {
    const a = realms.get(w.attacker)?.town ?? "the fallen",
      d = realms.get(w.defender)?.town ?? "the fallen",
      name = `the war of ${a} upon ${d}`;
    add(
      "war",
      w.ref,
      name,
      name,
      "⚔️",
      w.ended === null ? "still fought" : `year ${fmt(w.declared)}–${fmt(w.ended)}`,
      w.fallen[0] + w.fallen[1],
    );
  }
  for (const sp of homePlanet(world).generated.life.species) {
    const flies = !!sp.body && sp.body.wings > 0 && sp.body.moves === "fly";
    add(
      "beast",
      sp.ref,
      sp.name,
      sp.name,
      lineageIcon(sp.niche, flies),
      sp.died === null ? sp.niche : `${sp.niche}, gone`,
      sp.size,
    );
  }
  // (The peoples of other stars this world has heard: each read alone, half a second the first time, so no more.)
  for (const heard of contactsOf(world).all().slice(0, 4)) {
    const c = civilizationOf(world, heard.civ);
    if (!c) continue;
    const w = peopleWords(world, c);
    add("people", c.ref, w.name, `the ${w.name}`, "👽", `${w.kind} of another star`, 1e4, w.kind);
  }
  for (const g of GOODS) add("good", `good:${g.id}`, g.name, g.name, "📦", "a good", 10);
  const ledger = observer(world);
  for (const p of ledger.persons.values()) {
    const name = `${p.name} ${p.surname}`;
    add(
      "person",
      p.ref,
      name,
      name,
      "🧑",
      p.alive ? `born in year ${fmt(p.birthYear)}` : `died in year ${fmt(p.diedYear ?? 0)}`,
      p.alive ? 10 : 1,
    );
  }
  for (const h of ledger.households.values())
    add(
      "house",
      h.ref,
      h.surname,
      `the ${h.surname} household`,
      "🏠",
      "a household",
      h.members.length,
    );
  // The kinds of events, by what they are called: those the annals and the pages name, and any the log holds.
  const types = new Set([...ANNAL_TYPES, ...TITLED_TYPES]);
  for (let i = 0; i < world.events.count; i++) types.add(world.events.at(i).type);
  for (const type of types) {
    const k = eventKind(type);
    add(
      "kind",
      null,
      type,
      k.title,
      k.icon,
      k.heading,
      5,
      `${type.replace(/[.-]/g, " ")} ${k.heading}`,
    );
  }
  out.sort((a, b) => b.weight - a.weight);
  s.names = out.slice(0, NAMES_KEPT);
  return s.names;
}

/** How well a folded name answers a folded term: the name itself, its beginning, a word's, or not at all. */
function scoreOf(folded: string, term: string): number {
  if (folded === term) return 100;
  if (folded.startsWith(term)) return 70;
  return holds(folded, term) ? 50 : 0;
}

/** Things by their names as a person types: of one key, or of all; the best first. */
export function annalsNames(
  world: World,
  args: { session: number; text: string; key?: AnnalKey | null; most?: number },
): AnnalName[] {
  const words = args.text.split(/\s+/).map(termOf).filter(Boolean);
  if (!words.length || (words.join(" ").length < 2 && !args.key)) return [];
  const most = Math.min(24, args.most ?? 8),
    found: { n: Named; score: number }[] = [];
  for (const n of namesOf(world, sittingOf(world, args.session))) {
    if (args.key && n.key !== args.key) continue;
    let score = 0;
    for (const w of words) {
      const k = scoreOf(n.folded, w);
      if (!k) {
        score = 0;
        break;
      }
      score += k;
    }
    if (score)
      found.push({ n, score: score * 1000 + Math.min(999, Math.log10(1 + n.weight) * 100) });
  }
  // (One of each name: the greatest by that name.)
  const seen = new Set<string>();
  return found
    .sort((a, b) => b.score - a.score)
    .filter(({ n }) => {
      const k = `${n.key}|${n.name}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, most)
    .map(({ n }) => ({
      key: n.key,
      ref: n.ref,
      name: n.name,
      title: n.title,
      icon: n.icon,
      note: n.note,
    }));
}

/** What a filter asks of an event: one of these things named, or one of these names said. */
type Want = {
  readonly key: AnnalKey;
  readonly refs: ReadonlySet<string>;
  /** Names said whole. */
  readonly names: readonly string[];
  /** Or, when the world names nothing so, these words at the start of words. */
  readonly loose: readonly string[];
  /** A kind of event: its type, or words of what it is called. */
  readonly types: ReadonlySet<string>;
};

/** A free word: in the words, in the kind, or naming one of these. */
type Word = { readonly term: string; readonly refs: ReadonlySet<string> };

/** Every name of a key whose words hold all of these, the greater first. */
function named(all: readonly Named[], key: AnnalKey | null, terms: readonly string[]): Named[] {
  return all.filter(
    (n) =>
      (key === null ? n.key !== "kind" : n.key === key) && terms.every((t) => holds(n.folded, t)),
  );
}

function wantOf(all: readonly Named[], f: AnnalFilter): Want {
  const terms = f.value.split(/\s+/).map(termOf).filter(Boolean),
    whole = termOf(f.value);
  if (f.key === "kind") {
    const types = new Set<string>();
    for (const n of all)
      if (
        n.key === "kind" &&
        (n.name === f.value ||
          n.name.startsWith(`${f.value}.`) ||
          terms.every((t) => holds(n.folded, t)))
      )
        types.add(n.name);
    // (A type named as the log has it is that type and those under it; words are what a kind is called.)
    return {
      key: f.key,
      refs: new Set(),
      names: [],
      loose: f.value.includes(".") ? [] : terms,
      types,
    };
  }
  if (f.ref) {
    // (Tapped: the very thing, or its name said whole.)
    const refs = new Set([f.ref]);
    if (f.ref.startsWith("rule:")) refs.add(f.ref.slice("rule:".length));
    return { key: f.key, refs, names: whole ? [whole] : [], loose: [], types: new Set() };
  }
  const hits = named(all, f.key === "about" ? null : f.key, terms).slice(0, NAMED_MOST),
    names = [...new Set(hits.slice(0, 24).map((n) => fold(n.name)))];
  const refs = new Set<string>();
  for (const n of hits)
    if (n.ref) {
      refs.add(n.ref);
      // (A ruler or a ruling house is found in what their realm did.)
      if (n.ref.startsWith("rule:") && f.key === "realm") refs.add(n.ref.slice("rule:".length));
    }
  return { key: f.key, refs, names, loose: hits.length ? [] : terms, types: new Set() };
}

/** Every thing an event names, by ref: its subjects, its place, one of a court, the lands its data numbers. */
function refsOf(e: HistoryEvent): Set<string> {
  const out = new Set<string>(e.subjects);
  if (e.place) out.add(e.place);
  const d = (e.data ?? {}) as Record<string, unknown>;
  if (typeof d.fig === "number" && e.subjects[0]) out.add(`court:${e.subjects[0]}:${d.fig}`);
  for (const k of ["from", "to", "cell", "land"])
    if (typeof d[k] === "number" && Number.isInteger(d[k])) out.add(cellRef(0, d[k] as number));
  return out;
}

/** What a kind of event is, in folded words: its type and what it is called. */
const KIND_WORDS = new Map<string, string>();
function kindWords(type: string): string {
  let w = KIND_WORDS.get(type);
  if (w === undefined) {
    const k = eventKind(type);
    w = fold(`${type.replace(/[.-]/g, " ")} ${k.title} ${k.heading}`);
    KIND_WORDS.set(type, w);
  }
  return w;
}

/** The first event at or after a moment, by halving: the log is in the order things happened. */
function firstAt(world: World, t: number): number {
  let lo = 0,
    hi = world.events.count;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (world.events.at(mid).t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The first event past a number, by halving: the log is in the minter's order. */
function firstPast(world: World, serial: number): number {
  let lo = 0,
    hi = world.events.count;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (serialOf(world.events.at(mid).id) <= serial) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** An event's line, and if its words fail, what the explainer keeps of it. */
function lineOrClaim(world: World, e: HistoryEvent, year: number): Line {
  try {
    return lineOf(world, e, year);
  } catch {
    return [withoutYear(why(world, e.id).claim, year)];
  }
}

/** The whole log read for what a person asked, a page at a time (see the head of this file). */
export function annalsSearch(world: World, args: AnnalsSearchArgs): AnnalsFound {
  const t0 = performance.now(),
    s = sittingOf(world, args.session),
    limit = Math.max(1, Math.min(SEARCH_MOST, args.limit ?? SEARCH_LINES)),
    first = args.after === null || args.after === undefined,
    only = new Set(args.only),
    words: Word[] = [],
    terms = new Set<string>();
  const needNames = args.filters.length > 0 || args.words.length > 0,
    all = needNames ? namesOf(world, s) : [];
  for (const raw of args.words) {
    const term = termOf(raw);
    if (!term) continue;
    terms.add(term);
    const hits = named(all, null, [term]),
      refs = new Set<string>();
    if (hits.length <= NAMED_MOST) for (const n of hits) if (n.ref) refs.add(n.ref);
    words.push({ term, refs });
  }
  const wants = args.filters.map((f) => wantOf(all, f));
  for (const w of wants) for (const t of [...w.names, ...w.loose]) terms.add(t);
  if (!words.length && !wants.length && !only.size && args.from === null && args.to === null)
    return {
      years: [],
      matched: 0,
      whole: true,
      next: null,
      reached: null,
      terms: [],
      scanned: 0,
      ms: 0,
    };
  if (only.has(1) && !s.firsts)
    s.firsts = new Set(firstsNow(world).flatMap((f) => (f.ref ? [f.ref] : [])));
  const firsts = s.firsts ?? new Set<string>();

  // The stretch of the log the years asked lie in, and where this page begins in it.
  const log = world.events,
    // (A year is the moments after its turn, up to and with the next: yearOfMoment.)
    lo = args.from === null || args.from <= 0 ? 0 : firstAt(world, args.from * YEAR + 1),
    hi =
      args.to !== null && args.to < 0
        ? -1
        : (args.to === null ? log.count : firstAt(world, (args.to + 1) * YEAR + 1)) - 1,
    step = args.newest ? -1 : 1;
  let i = args.newest ? hi : lo;
  // (Read on from the last event a page gave: before it, newest first; after it, oldest first.)
  if (!first)
    i = args.newest
      ? Math.min(hi, firstPast(world, args.after! - 1) - 1)
      : Math.max(lo, firstPast(world, args.after!));

  const textOf = (e: HistoryEvent, year: number): string => {
    const n = serialOf(e.id);
    let t = s.words.get(n);
    if (t === undefined) {
      t = fold(withoutYear(why(world, e.id).claim, year));
      if (s.words.size < WORDS_KEPT) s.words.set(n, t);
    }
    return t;
  };
  const answers = (e: HistoryEvent): { kind: number; worth: number } | null => {
    const [kind0, worth0] = ruleOf(e),
      isFirst = firsts.has(e.id),
      kind = isFirst && kind0 === 0 ? 1 : kind0;
    if (only.size && !only.has(kind) && !(isFirst && only.has(1))) return null;
    const kw = kindWords(e.type);
    for (const w of wants)
      if (
        w.key === "kind" &&
        !(w.types.has(e.type) || (w.loose.length && w.loose.every((t) => holds(kw, t))))
      )
        return null;
    const year = yearOfMoment(e.t);
    let refs: Set<string> | null = null,
      text: string | null = null;
    const refsNow = () => (refs ??= refsOf(e)),
      textNow = () => (text ??= textOf(e, year));
    for (const w of wants) {
      if (w.key === "kind") continue;
      const r = refsNow();
      let ok = false;
      for (const x of w.refs)
        if (r.has(x)) {
          ok = true;
          break;
        }
      if (!ok && w.names.length) ok = w.names.some((n) => holdsWhole(textNow(), n));
      if (!ok && w.loose.length) ok = w.loose.every((t) => holds(textNow(), t));
      if (!ok) return null;
    }
    for (const w of words) {
      if (holds(kw, w.term)) continue;
      if (w.refs.size) {
        const r = refsNow();
        let ok = false;
        for (const x of r)
          if (w.refs.has(x)) {
            ok = true;
            break;
          }
        if (ok) continue;
      }
      if (!holds(textNow(), w.term)) return null;
    }
    return { kind, worth: isFirst ? 8 : worth0 };
  };

  const years: { year: number; lines: AnnalFound[] }[] = [];
  let matched = 0,
    scanned = 0,
    next: number | null = null,
    whole = true,
    lastSerial: number | null = null,
    lastLine: number | null = null,
    reached: number | null = null;
  // (The reading's own clock: the names a sitting reads once are not counted against it.)
  const s0 = performance.now();
  for (; i >= lo && i <= hi; i += step) {
    const e = log.at(i);
    scanned++;
    if ((scanned & 127) === 0) {
      const ms = performance.now() - s0;
      // (Its lines found, the first page counts on a while; else a page reads until it has them, or until it must stop.)
      if (ms > (years.length && matched >= limit ? COUNT_MS : FIND_MS)) {
        whole = false;
        reached = yearOfMoment(e.t);
        if (next === null) next = lastSerial ?? serialOf(e.id);
        break;
      }
    }
    lastSerial = serialOf(e.id);
    const got = answers(e);
    if (!got) continue;
    matched++;
    if (matched <= limit) {
      const year = yearOfMoment(e.t),
        line: AnnalFound = {
          kind: got.kind,
          worth: got.worth,
          ref: e.id,
          line: lineOrClaim(world, e, year),
          minor: got.worth < KIND_WORTH,
          what: eventKind(e.type).title,
        },
        last = years[years.length - 1];
      if (last?.year === year) last.lines.push(line);
      else years.push({ year, lines: [line] });
      lastLine = lastSerial;
      continue;
    }
    next ??= lastLine;
    // (A page past the first does not count.)
    if (!first) {
      whole = false;
      break;
    }
  }
  if (whole) next = matched > limit ? next : null;
  return {
    years,
    matched,
    whole,
    next,
    reached: reached ?? (years.length ? years[years.length - 1]!.year : null),
    terms: [...terms].slice(0, 32),
    scanned,
    ms: Math.round((performance.now() - t0) * 10) / 10,
  };
}

/** The search's queries (A1's Years, 2026-11-16). */
export const ANNALS_SEARCH_QUERIES = {
  "annals.search": (world: World, args: unknown) => annalsSearch(world, args as AnnalsSearchArgs),
  "annals.names": (world: World, args: unknown) =>
    annalsNames(
      world,
      args as { session: number; text: string; key?: AnnalKey | null; most?: number },
    ),
};
