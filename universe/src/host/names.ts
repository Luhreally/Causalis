// Their own names (Phase 58, asked for 2026-10-26: "each people names its materials in its own
// language (the game already has languages), with the field guide giving the real chemistry, much
// like the original's field guide"): each thing of a world as each of its peoples calls it — what it
// is like (rules/names.ts) in their own words (gen/words.ts) — and, where a people first came by a
// thing from another (a craft learned from a neighbour, a metal down a road), the giver's word in the
// taker's sounds. A page asked for as they call it is told in the words of the people where one
// stands, their word first and the thing as it is after, as Classic's field guide gave a compound's
// own name and then its chemistry. Read, never kept: the names are worked out from the world as it
// stands, and no history moves for them.
import { YEAR, parseRef, yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import {
  BLOOD_WORDS,
  BONE_WORDS,
  ELEMENTS,
  GOODS,
  KIND_SUBSTANCES,
  LIFE_ELEMENTS,
  LIFE_SUBSTANCES,
  NOVEL_ELEMENTS,
  NOVEL_SUBSTANCES,
  SUBSTANCES,
  WORKED,
  colourSaid,
  elementLikeness,
  findElement,
  findSubstance,
  glossOf,
  kindBurns,
  likenessOf,
  metalOf,
  oresOn,
  stoneLikeness,
  stonesFor,
  usualStone,
  type Chemistry,
  type Colour,
  type Likeness,
  type NamingWorld,
  type Substance,
} from "../rules/index.ts";
import {
  fittedWord,
  marksChosen,
  marksTried,
  rootsOf,
  speechOf,
  wordOf,
  worldChemistry,
  type Lineage,
  type Root,
  type Said,
  type Speech,
} from "../gen/index.ts";
import {
  ECONOMY_EVENTS,
  LORE_EVENTS,
  homePlanet,
  languagesOf,
  loreOf,
  marketsOf,
  populationContext,
  type Language,
  type LanguageStore,
} from "../sim/index.ts";
import type { Block, Item, Line, PageModel, Place, Span, Stat } from "../bridge/index.ts";
import { lifeHere } from "./biochem.ts";
import { kindOf } from "./kinds.ts";
import { item, link, stat, yearNow } from "./inspect/words.ts";

/** What a page is asked for with (a query's `names`): as the people where one stands call things (`at`: a land), or as they are. */
export type NamesArg = { readonly as: "theirs" | "real"; readonly at?: number | null };

/** A word taken with a thing: from which language, by what record (the craft learned, the road), when. */
export type Taken = {
  readonly from: number;
  readonly event: Ref;
  readonly year: number;
  readonly how: "craft" | "road";
  /** What it came with, in words: "the craft of bronze", "copper down the road". */
  readonly with: string;
};

/** A thing as a people calls it. */
export type Called = {
  /** What it is: a substance's id, an element's ("elem:Cu"), or a stone of no one substance's ("rock:basalt"). */
  readonly id: string;
  readonly word: string;
  /** What the word says, in English ("black-edge-stone"); a word taken whole, what it says to its givers. */
  readonly gloss: string;
  /** Its roots as said, each with its meaning. */
  readonly said: Said;
  /** Where they took the word from another people (null: a word of their own). */
  readonly taken: Taken | null;
};

/** A people's words for its world's things, by what each is. */
export type Lexicon = { readonly language: Language; readonly by: ReadonlyMap<string, Called> };

/** What a world gives every people's names: its things in the order they are named, and the English words its pages use for them. */
type Facts = {
  readonly chem: Chemistry;
  readonly naming: NamingWorld;
  /** Every substance, its world's own first (its life's, its stones, ores and metals). */
  readonly order: readonly Substance[];
  /** Its stones of no one substance, by name. */
  readonly rocks: readonly {
    readonly name: string;
    readonly colour: readonly [number, number, number];
  }[];
  /** The English words for things on its pages, each with what it names, and one pattern of all of them. */
  readonly words: ReadonlyMap<string, string>;
  readonly pattern: RegExp;
};

/** What is worked out for a world: its facts once; its peoples' words and takings for a year. */
type Kept = {
  readonly facts: Facts;
  year: number;
  lexicons: Map<number, Lexicon>;
  taken: Map<number, Map<string, Taken & { readonly t: number }>> | null;
  /** The languages whose words are being worked out (a word taken in a ring is their own instead). */
  readonly making: Set<number>;
};
const KEPT = new WeakMap<World, Kept>();

/** Whether a world has peoples who name things (a world of languages). */
export function hasNames(world: World): boolean {
  return (
    world.storeNames().includes("culture.languages") &&
    world.storeNames().includes("planet.home") &&
    languagesOf(world).all().length > 0
  );
}

function keptOf(world: World): Kept {
  let k = KEPT.get(world);
  if (!k)
    KEPT.set(
      world,
      (k = {
        facts: factsOf(world),
        year: -1,
        lexicons: new Map(),
        taken: null,
        making: new Set(),
      }),
    );
  const year = yearNow(world);
  if (k.year !== year) {
    k.year = year;
    k.lexicons = new Map();
    k.taken = null;
  }
  return k;
}

const ALL_SUBSTANCES: readonly Substance[] = [
  ...SUBSTANCES,
  ...NOVEL_SUBSTANCES,
  ...KIND_SUBSTANCES,
  ...LIFE_SUBSTANCES,
];

/** The frozen form of a life's liquid, where the tables have one. */
const FROZEN: Readonly<Record<string, string>> = {
  water: "water-ice",
  "ammonia-water": "ammonia-hydrate",
};

function factsOf(world: World): Facts {
  const g = homePlanet(world).generated,
    chem = worldChemistry(g),
    l = lifeHere(world),
    lifeless = !g.life.species.length,
    table = oresOn(chem),
    stones = [usualStone(chem), ...Object.values(stonesFor(chem))],
    ores: Record<string, string> = {};
  for (const lies of Object.values(table))
    for (const [lie, ore] of Object.entries(lies ?? {}))
      if (ore && !(ore.mineral in ores)) ores[ore.mineral] = lie;
  const life = lifeless
      ? null
      : {
          liquid: l.liquid,
          frozen: FROZEN[l.liquid] ?? null,
          store: l.store,
          sugar: l.sugar,
          flesh: l.flesh,
          fibre: l.fibre,
          hair: l.hair,
          bone: BONE_WORDS[l.bone].subst,
          shell: BONE_WORDS[l.shell].subst,
          blood: BLOOD_WORDS[l.blood].subst,
          dye: l.dye,
          mirror: l.hand !== "left",
        },
    naming: NamingWorld = {
      life,
      burns: kindBurns(kindOf(world)),
      stones: [...new Set(stones.flatMap((s) => (s.subst ? [s.subst] : [])))],
      ores,
    };
  // Its own first, so the things nearest to hand take the plainest names.
  const metals = (["copper", "bronze", "iron", "steel"] as const).map(
      (r) => metalOf(chem, r).subst,
    ),
    first = [
      ...(life
        ? [life.liquid, life.frozen, life.store, life.sugar, life.flesh, life.fibre, life.hair]
        : []),
      ...(life ? [life.bone, life.shell, life.blood, life.dye] : []),
      ...naming.stones,
      ...Object.keys(ores),
      ...metals,
      chem.hardener,
    ].flatMap((id) => (id && findSubstance(id) ? [id] : [])),
    order = [...new Set([...first, ...ALL_SUBSTANCES.map((s) => s.id)])].map((id) =>
      findSubstance(id)!,
    );
  // The English words its pages name things by: every substance's, its stones', ores' and metals',
  // and its goods' (its tin is its hardener).
  const words = new Map<string, string>(),
    say = (word: string, id: string | null) => {
      if (id && !words.has(word.toLowerCase())) words.set(word.toLowerCase(), id);
    },
    rocks: Facts["rocks"][number][] = [];
  for (const s of stones) {
    say(s.name, s.subst ?? `rock:${s.name}`);
    if (!s.subst && !rocks.some((r) => r.name === s.name))
      rocks.push({ name: s.name, colour: s.colour });
  }
  for (const lies of Object.values(table))
    for (const ore of Object.values(lies ?? {})) if (ore) say(ore.name, ore.mineral);
  for (const r of ["copper", "bronze", "iron", "steel", "bog iron"] as const) {
    const m = metalOf(chem, r);
    say(m.name, m.subst);
  }
  say("iron fallen from the sky", "iron");
  say("tin", chem.hardener);
  say("coal", "carbon");
  for (const s of order) say(s.name, s.id);
  const all = [...words.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1)),
    pattern = new RegExp(
      `(?<![A-Za-z])(${all.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z])`,
      "gi",
    );
  return { chem, naming, order, rocks, words, pattern };
}

// —— Whose words, and their line ——————————————————————————————————————————————————————————

/** The language of the people where one stands (a land), else the world's most spoken. */
export function speakersAt(world: World, at: number | null): Language | null {
  if (!hasNames(world)) return null;
  const store = languagesOf(world);
  if (at !== null) {
    const here = store.of(at);
    if (here) return here;
  }
  const speakers = store.speakers();
  let best: Language | null = null,
    most = -1;
  for (const l of store.all()) {
    const n = l.died === null ? (speakers.get(l.index)?.length ?? 0) : -1;
    if (n > most) [best, most] = [l, n];
  }
  return best;
}

/** A language's people, as a page names them: "the Kurnic". */
export function peopleOf(l: Language): string {
  return `the ${l.name}`;
}

/** A language's line: its family's first, down to it. */
function lineageOf(store: LanguageStore, l: Language): Lineage {
  const line: number[] = [];
  for (let x: Language | undefined = l; x;) {
    line.unshift(x.index);
    x = x.parent === null || x.index === x.family ? undefined : store.at(x.parent);
  }
  return { seed: l.standard.seed, line };
}

// —— The words taken with things ————————————————————————————————————————————————————————

/** The crafts a thing's word comes with (rules/principles.ts ids), and the thing on a world. */
const CRAFTS: Readonly<
  Record<string, { readonly what: string; readonly stuff: (c: Chemistry) => string }>
> = {
  metalworking: { what: "the craft of working copper", stuff: (c) => metalOf(c, "copper").subst },
  bronze: { what: "the craft of bronze", stuff: (c) => metalOf(c, "bronze").subst },
  iron: { what: "the craft of iron", stuff: (c) => metalOf(c, "iron").subst },
  steel: { what: "the craft of steel", stuff: () => "steel" },
  glass: { what: "the craft of glass", stuff: () => "glass" },
  tanning: { what: "the craft of tanning", stuff: () => "leather" },
  brewing: { what: "the craft of brewing", stuff: () => "ethanol" },
  "pottery-wheel": { what: "the potter's wheel", stuff: () => "fired-clay" },
  "coal-mining": { what: "the craft of digging coal", stuff: () => "carbon" },
  "oil-drilling": { what: "the craft of drawing oil", stuff: () => "crude" },
  gunpowder: { what: "the craft of powder", stuff: () => "black-powder" },
  "cold-hammering": { what: "the craft of hammering copper cold", stuff: () => "native-copper" },
  "diamond-grit": { what: "the craft of diamond grit", stuff: () => "diamond" },
  "pitch-ware": { what: "the craft of pitch ware", stuff: () => "pitch-grit" },
  "sulfur-concrete": { what: "the craft of sulfur concrete", stuff: () => "sulfur-concrete" },
  "carbide-blades": { what: "the craft of carbide blades", stuff: () => "cohenite-iron" },
  "acid-leaching": { what: "the craft of leaching copper", stuff: () => "blue-vitriol" },
};

/** A good's stuff on a world (its tin is its hardener), where it is one thing. */
function goodStuff(c: Chemistry, good: string): string | null {
  if (good === "copper") return metalOf(c, "copper").subst;
  if (good === "tin") return c.hardener;
  if (good === "iron") return metalOf(c, "iron").subst;
  if (good === "coal") return "carbon";
  if (good === "oil") return "crude";
  return null;
}

/** A land of a place ref ("cell:0:12"), or none. */
function cellOf(ref: string | null | undefined): number | null {
  if (!ref || !ref.startsWith("cell:")) return null;
  try {
    return parseRef(ref as Ref).b;
  } catch {
    return null;
  }
}

/** One way a land came by a thing: by itself (`from` null), or from another land, when, by what record. */
type Came = {
  readonly cell: number;
  readonly id: string;
  readonly t: number;
  readonly from: number | null;
  readonly event: Ref;
  readonly how: "craft" | "road";
  readonly with: string;
};

/**
 * Every record of a land first coming by a thing (history's own, read): crafts found or learned from
 * a neighbour, copper-working found or learned down a road, the metals its tools were first headed
 * with and where each came from, and each road's first good. (The markets' flows are last year's only,
 * so they tell no "first".)
 */
function cameBy(world: World, chem: Chemistry): Came[] {
  const out: Came[] = [],
    lore = loreOf(world),
    markets = marketsOf(world);
  for (const p of populationContext(world).provinces.all())
    for (const [craft, c] of Object.entries(CRAFTS)) {
      const known = lore.get(p.cell, craft),
        e = known ? world.events.get(known.event) : undefined;
      if (!e) continue;
      const teacher = e.causes.find((x) => x.role === "trigger"),
        from =
          e.type === LORE_EVENTS.learned.type
            ? cellOf(teacher ? world.events.get(teacher.ref)?.place : null)
            : null;
      out.push({
        cell: p.cell,
        id: c.stuff(chem),
        t: e.t,
        from,
        event: e.id,
        how: "craft",
        with: c.what,
      });
    }
  const copper = metalOf(chem, "copper").subst;
  for (const m of markets.all()) {
    const e = m.metalworking ? world.events.get(m.metalworking) : undefined;
    if (e?.type === ECONOMY_EVENTS.metalworkingSpread.type)
      out.push({
        cell: m.cell,
        id: copper,
        t: e.t,
        from: cellOf(e.subjects[1]),
        event: e.id,
        how: "craft",
        with: CRAFTS.metalworking!.what,
      });
    else if (e?.type === ECONOMY_EVENTS.metalworking.type)
      out.push({
        cell: m.cell,
        id: copper,
        t: e.t,
        from: null,
        event: e.id,
        how: "craft",
        with: "",
      });
    // Its tools' first metals: each good the metal is worked from, by its ore or down a road.
    for (const x of m.toolMetals) {
      const e2 = x.event ? world.events.get(x.event) : undefined,
        goods = (WORKED as Readonly<Record<string, { readonly from: readonly number[] }>>)[x.metal]
          ?.from;
      if (!e2 || !goods) continue;
      const sources = e2.causes.filter((c) => c.role === "enabler");
      goods.forEach((good, i) => {
        const id = goodStuff(chem, GOODS[good]!.id),
          src = sources[i]?.ref;
        if (!id || !src || src.startsWith("mkt:")) return;
        const road = world.events.get(src),
          ends = road && /^trade\./.test(road.type) ? road.subjects.map((r) => cellOf(r)) : null,
          from = ends
            ? (ends.find((c) => c !== null && c !== m.cell) ?? null)
            : cellOf(src) !== m.cell
              ? cellOf(src)
              : null;
        out.push({
          cell: m.cell,
          id,
          t: e2.t,
          from,
          event: from !== null && road ? road.id : e2.id,
          how: from !== null ? "road" : "craft",
          with: from !== null ? `${GOODS[good]!.name} down the road` : "",
        });
      });
    }
  }
  // Each road's first good: what the land at its end first came by down it.
  for (const [, ev] of markets.allRoutes()) {
    const e = world.events.get(ev),
      good = (e?.data as { good?: string } | undefined)?.good,
      id = good ? goodStuff(chem, good) : null;
    if (!e || !id) continue;
    const from = cellOf(e.subjects[0]),
      to = cellOf(e.subjects[1]);
    if (from === null || to === null) continue;
    out.push({
      cell: to,
      id,
      t: e.t,
      from,
      event: e.id,
      how: "road",
      with: `${good} down the road`,
    });
  }
  return out;
}

/**
 * The words each language took with things: where its people first came by a thing from another
 * people's land, before any record of their own, it is the giver's word. A record from before a land
 * spoke as it speaks now tells nothing of its speech (too thin to say). A daughter keeps what her
 * mother took before she was born.
 */
function takenAll(world: World, k: Kept): Map<number, Map<string, Taken & { readonly t: number }>> {
  if (k.taken) return k.taken;
  const store = languagesOf(world),
    since = (cell: number) => world.events.get(store.since(cell) ?? ("" as Ref))?.t ?? 0,
    first = new Map<string, Came>();
  for (const found of cameBy(world, k.facts.chem)) {
    // Giving a thing away proves the giver already knew it. Without that evidence, two
    // later surviving trade records could make their names borrow from each other in a ring.
    const contacts: Came[] = [found];
    if (found.from !== null) contacts.push({ ...found, cell: found.from, from: null });
    for (const c of contacts) {
      const l = store.of(c.cell);
      if (!l || since(c.cell) > c.t) continue;
      const key = `${l.index}|${c.id}`,
        was = first.get(key);
      if (!was || c.t < was.t || (c.t === was.t && c.from === null && was.from !== null))
        first.set(key, c);
    }
  }
  const own = new Map<number, Map<string, Taken & { readonly t: number }>>();
  for (const [key, c] of first) {
    const l = Number(key.slice(0, key.indexOf("|"))),
      giver = c.from !== null ? store.of(c.from) : undefined;
    if (!giver || giver.index === l || since(c.from!) > c.t) continue;
    let mine = own.get(l);
    if (!mine) own.set(l, (mine = new Map()));
    mine.set(c.id, {
      from: giver.index,
      event: c.event,
      year: yearOfMoment(c.t),
      how: c.how,
      with: c.with,
      t: c.t,
    });
  }
  // (Mothers before daughters: a daughter's index is always after her mother's.)
  const out = new Map<number, Map<string, Taken & { readonly t: number }>>();
  for (const l of store.all()) {
    const mine = new Map<string, Taken & { readonly t: number }>(),
      mother = l.parent !== null && l.index !== l.family ? out.get(l.parent) : undefined;
    if (mother) for (const [id, t] of mother) if (t.t < l.born * YEAR) mine.set(id, t);
    for (const [id, t] of own.get(l.index) ?? [])
      if (!mine.has(id) && t.from !== l.index) mine.set(id, t);
    if (mine.size) out.set(l.index, mine);
  }
  return (k.taken = out);
}

// —— A people's words ————————————————————————————————————————————————————————————————————

const COLOURS: readonly string[] = [
  "black",
  "white",
  "red",
  "green",
  "yellow",
  "blue",
  "brown",
  "grey",
  "orange",
  "purple",
];

/** Where a name falls on one already taken: set apart by where it lies, in turn. */
const APART = ["deep", "hill", "river", "field", "sky", "sea", "marsh", "bog"];

/** A language's words for every thing of its world (worked out once a year). */
export function lexiconOf(world: World, l: Language): Lexicon {
  const k = keptOf(world),
    hit = k.lexicons.get(l.index);
  if (hit) return hit;
  k.making.add(l.index);
  const store = languagesOf(world),
    lineage = lineageOf(store, l),
    roots = rootsOf(lineage),
    speech = speechOf(lineage),
    taken = takenAll(world, k).get(l.index),
    by = new Map<string, Called>(),
    words = new Set<string>(),
    glosses = new Set<string>(),
    f = k.facts;
  const keep = (c: Called) => {
    by.set(c.id, c);
    words.add(c.word);
    glosses.add(c.gloss);
  };
  // The words taken with things first: they came with them.
  for (const [id, t] of taken ?? []) {
    const giver = store.at(t.from),
      theirs = k.making.has(giver.index)
        ? ownName(f, store, giver, id)
        : lexiconOf(world, giver).by.get(id);
    if (!theirs) continue;
    const said = fittedWord(theirs.said, l.standard);
    keep({ id, word: said.text, gloss: theirs.gloss, said, taken: t });
  }
  // Then their own, none the same as another.
  const own = (id: string, like: Likeness) => {
    if (by.has(id)) return;
    const named = nameIn(
      l,
      lineage,
      roots,
      speech,
      id,
      like,
      (gloss, word) => !glosses.has(gloss) && !words.has(word),
    );
    keep({ id, ...named, taken: null });
  };
  for (const s of f.order) own(s.id, likenessOf(s, f.naming));
  for (const r of f.rocks) own(`rock:${r.name}`, stoneLikeness(r.colour));
  // An element: the word for its own substance, or the stuff of what holds it.
  for (const e of [...ELEMENTS, ...NOVEL_ELEMENTS, ...LIFE_ELEMENTS]) {
    const like = elementLikeness(e.symbol),
      id = `elem:${e.symbol}`;
    if (!like) continue;
    if ("same" in like) {
      const same = by.get(like.same);
      if (same) by.set(id, { ...same, id });
    } else own(id, like);
  }
  k.making.delete(l.index);
  const out = { language: l, by };
  k.lexicons.set(l.index, out);
  return out;
}

/** A thing's own name in a language, apart from its others (where its words are still being worked out: on its own). */
function ownName(f: Facts, store: LanguageStore, l: Language, id: string): Called | undefined {
  const s = findSubstance(id);
  if (!s) return undefined;
  const lineage = lineageOf(store, l),
    named = nameIn(
      l,
      lineage,
      rootsOf(lineage),
      speechOf(lineage),
      id,
      likenessOf(s, f.naming),
      () => true,
    );
  return { id, ...named, taken: null };
}

/** A thing's name in a tongue: its likeness's marks as the tongue chooses them, the first way of saying it not already taken. */
function nameIn(
  l: Language,
  lineage: Lineage,
  roots: ReadonlyMap<string, Root>,
  speech: Speech,
  id: string,
  like: Likeness,
  free: (gloss: string, word: string) => boolean,
): { word: string; gloss: string; said: Said } {
  const marks = [
      ...new Set(
        like.marks.map((m) => (COLOURS.includes(m) ? colourSaid(m as Colour, speech.colours) : m)),
      ),
    ],
    tries = [
      ...(like.bare ? [[] as string[]] : []),
      ...marksTried(marksChosen(lineage, id, marks, speech), marks),
    ];
  for (const ms of [...tries, ...APART.map((a) => [a, ...(tries[0] ?? [])])]) {
    const gloss = glossOf(like.head, ms),
      said = wordOf(l.standard, roots, speech, [...ms, like.head]),
      // (Two of its roots fallen together in the tongue's sounds would say one root twice.)
      echoes = said.roots.some((r, i) => i > 0 && r.text === said.roots[i - 1]!.text);
    if (!echoes && free(gloss, said.text)) return { word: said.text, gloss, said };
  }
  const ms = tries[0] ?? [],
    said = wordOf(l.standard, roots, speech, [...ms, like.head]);
  return { word: said.text, gloss: glossOf(like.head, ms), said };
}

/** A thing as the people of a language call it (null: nothing so named). */
export function calledIn(world: World, l: Language, id: string): Called | null {
  return lexiconOf(world, l).by.get(id) ?? null;
}

// —— Pages as they call things ——————————————————————————————————————————————————————————

/** A thing's name as it is, in words ("moissanite", "copper"). */
function realName(id: string): string {
  if (id.startsWith("elem:")) return findElement(id.slice(5))?.name ?? id;
  if (id.startsWith("rock:")) return id.slice(5);
  return findSubstance(id)?.name ?? id;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
/** A word in the case of the words it stands for (capitalised where they were). */
const caseOf = (was: string, word: string) => (/^[A-Z]/.test(was) ? cap(word) : word);

/** The thing a link names, if it is a thing: a substance or an element. */
function thingOf(ref: string): string | null {
  const bare = ref.split("#")[0]!;
  if (bare.startsWith("subst:")) return bare.slice(6);
  if (bare.startsWith("elem:")) return bare;
  return null;
}

/** Pages of a made thing, a good, a building: their names say what they are made of. */
const MADE_REFS = /^(thing|made|arm|arms|mkt|good|bldg|lot|seat):/;

/** The land a page's place is, if it is a land's or a town's. */
function landOfPlace(world: World, place: Place | null): number | null {
  if (!place) return null;
  if (place.scale === "region") return place.cell;
  if (place.scale === "village")
    return populationContext(world).settlements.get(place.town as Ref)?.cell ?? null;
  return null;
}

/**
 * A page as the people where one stands call things (`at`: the land one stands in; none, the page's
 * own land, else the world's most spoken tongue): every name of a substance or an element their word,
 * the first time in each tab with the thing as it is beside it; made things, goods and a list's or a
 * table's words for things in their words; a substance's or an element's own page led by their name
 * and what it says, where it came from, and others' words for it, then the thing as it is.
 */
export function namedPage(world: World, page: PageModel, at: number | null): PageModel {
  const l = speakersAt(world, at ?? landOfPlace(world, page.place));
  if (!l) return page;
  const lex = lexiconOf(world, l).by,
    f = keptOf(world).facts,
    own = thingOf(page.ref),
    // (A thing's own page, and the guide: their facts and words are the thing as it is.)
    asItIs = own !== null || page.ref === "world:matter",
    called = (id: string) => lex.get(id),
    /** Words for things in a run of words: their word, the thing as it is beside it the first time. */
    say = (text: string, seen: Set<string> | null) =>
      text.replace(f.pattern, (m: string) => {
        const id = f.words.get(m.toLowerCase()),
          c = id ? called(id) : undefined;
        if (!c) return m;
        const first = seen !== null && !seen.has(c.id);
        seen?.add(c.id);
        return caseOf(m, c.word) + (first ? ` (${m.toLowerCase()})` : "");
      }),
    span = (s: Span, seen: Set<string> | null, plain: boolean): Span => {
      if (typeof s === "string") return plain ? say(s, seen) : s;
      const id = thingOf(s.ref),
        c = id ? called(id) : undefined;
      if (c) {
        const first = seen !== null && !seen.has(c.id);
        seen?.add(c.id);
        return { ...s, text: caseOf(s.text, c.word) + (first ? ` (${s.text.toLowerCase()})` : "") };
      }
      return MADE_REFS.test(s.ref) ? { ...s, text: say(s.text, null) } : s;
    },
    line = (l2: Line, seen: Set<string> | null, plain: boolean): Line =>
      l2.map((s) => span(s, seen, plain)),
    stats = (rows: readonly Stat[], seen: Set<string> | null, plain: boolean): Stat[] =>
      rows.map((r) => ({ ...r, value: line(r.value, seen, plain) })),
    block = (b: Block, seen: Set<string>): Block => {
      const title =
        "title" in b && typeof b.title === "string" ? { title: say(b.title, null) } : {};
      switch (b.type) {
        case "text":
          return { ...b, ...title, lines: b.lines.map((x) => line(x, seen, false)) };
        case "facts":
          return { ...b, ...title, rows: stats(b.rows, seen, !asItIs) };
        case "list":
          return {
            ...b,
            ...title,
            items: b.items.map((i) => ({ ...i, line: line(i.line, seen, true) })),
          };
        case "table":
          return {
            ...b,
            ...title,
            rows: b.rows.map((r) => ({ ...r, cells: r.cells.map((c) => line(c, seen, true)) })),
          };
        case "composition":
          return {
            ...b,
            ...title,
            parts: b.parts.map((p) => ({ ...p, name: line(p.name, seen, true) })),
          };
        case "bars":
          return {
            ...b,
            ...title,
            bars: b.bars.map((x) => ({ ...x, label: line(x.label, seen, true) })),
          };
        default:
          return b;
      }
    };
  const c = own !== null ? called(own) : undefined,
    head = new Set<string>(c ? [c.id] : []),
    tabs = page.tabs.map((t, i) => {
      const seen = new Set(head),
        blocks = t.blocks.map((b) => block(b, seen));
      return i === 0 && c
        ? { ...t, blocks: [...ownBlocks(world, l, c.id), ...asItIsFirst(blocks)] }
        : { ...t, blocks };
    });
  return {
    ...page,
    title: c
      ? own!.startsWith("elem:")
        ? `${cap(c.word)} (${own!.slice(5)})`
        : cap(c.word)
      : MADE_REFS.test(page.ref)
        ? say(page.title, null)
        : page.title,
    subtitle: c
      ? [`“${c.gloss}” · ${realName(own!)} · `, ...page.subtitle]
      : line(page.subtitle, head, false),
    ...(page.crumbs ? { crumbs: line(page.crumbs, null, false) } : {}),
    stats: stats(page.stats, null, true),
    tabs,
  };
}

/** A thing's own page's first words, the thing as it is: titled so, after their name. */
function asItIsFirst(blocks: readonly Block[]): Block[] {
  const [first, ...rest] = blocks;
  return first && first.type === "text" && !first.title
    ? [{ ...first, title: "As it is" }, ...rest]
    : [...blocks];
}

/**
 * A thing's own page's head as a people calls it: their word, its roots and what they mean, and
 * (a word taken) whom from and with what; then what the other peoples of the world call it.
 */
export function ownBlocks(world: World, l: Language, id: string): Block[] {
  const c = calledIn(world, l, id);
  if (!c) return [];
  const rows: Stat[] = [
    stat("Their word", c.word),
    stat("What it says", `“${c.gloss}”`),
    c.taken
      ? stat("Where it came from", takenLine(world, c.taken))
      : stat("Its parts", c.said.roots.map((r) => `${r.text} (${r.meaning})`).join(" · ")),
  ];
  const blocks: Block[] = [{ type: "facts", title: `As ${peopleOf(l)} call it`, rows }],
    others = othersFor(world, l, id);
  if (others.length) blocks.push({ type: "list", title: "What others call it", items: others });
  return blocks;
}

/** Whom a word was taken from, with what and when: "the Bregrish, with the craft of bronze, year 132". */
function takenLine(world: World, t: Taken): Line {
  const giver = languagesOf(world).at(t.from);
  return [
    link(cap(peopleOf(giver)), giver.ref),
    `, with ${t.with || "the thing itself"} (`,
    link(`year ${t.year}`, t.event),
    `): their word, said their way`,
  ];
}

/** Of the other living tongues (those met first, then the most spoken), what each calls a thing. */
export function othersFor(world: World, l: Language, id: string, most = 6): Item[] {
  const store = languagesOf(world),
    speakers = store.speakers(),
    others = store
      .all()
      .filter((x) => x.died === null && x.index !== l.index && speakers.get(x.index)?.length)
      .sort(
        (a, b) =>
          Number(store.haveMet(l.family, b.family)) - Number(store.haveMet(l.family, a.family)) ||
          (speakers.get(b.index)?.length ?? 0) - (speakers.get(a.index)?.length ?? 0) ||
          a.index - b.index,
      )
      .slice(0, most);
  return others.flatMap((x) => {
    const c = calledIn(world, x, id);
    return c
      ? [
          item(
            [
              link(cap(peopleOf(x)), x.ref),
              `: ${c.word} — “${c.gloss}”${c.taken ? `, from ${peopleOf(store.at(c.taken.from))}` : ""}`,
            ],
            x.ref,
          ),
        ]
      : [];
  });
}

/** The things a tongue's page names, its world's own first: its liquid, its stone, its ores and metals, its life's. */
export function namesBlock(world: World, l: Language, most = 12): Block | null {
  if (!hasNames(world)) return null;
  const f = keptOf(world).facts,
    ids = f.order.slice(0, most).map((s) => s.id),
    lex = lexiconOf(world, l).by;
  const items = ids.flatMap((id) => {
    const c = lex.get(id);
    if (!c) return [];
    const store = languagesOf(world);
    return [
      item(
        [
          link(c.word, `subst:${id}`),
          ` — “${c.gloss}”: ${realName(id)}${c.taken ? `, from ${peopleOf(store.at(c.taken.from))}` : ""}`,
        ],
        `subst:${id}`,
      ),
    ];
  });
  return items.length ? { type: "list", title: "Its names for things", items } : null;
}

/**
 * The guide's "In their own words" (on a world not the Sun's): what the most spoken people call its
 * hardener, its surface copper, its bog iron and its usual stone — each as it is, then their word and
 * what it says.
 */
export function ownWordsItems(
  world: World,
  things: readonly { readonly english: string; readonly id: string; readonly ref: string | null }[],
): Item[] {
  const l = speakersAt(world, null);
  return things.map((x) => {
    const c = l ? calledIn(world, l, x.id) : null;
    return item(
      [
        link(cap(x.english), x.ref),
        c && l ? ` — ${peopleOf(l)} call it ${c.word}, “${c.gloss}”` : "",
      ],
      x.ref,
    );
  });
}

/**
 * What a man bore, as the people who made it call its stuff: "of black-edge-stone, as the Kurnic call
 * moissanite" (null: no stuff of a name, or a world with no peoples' words).
 */
export function borneWords(world: World, words: string, cell: number | null): string | null {
  const l = speakersAt(world, cell);
  if (!l) return null;
  const f = keptOf(world).facts;
  for (const m of words.matchAll(f.pattern)) {
    const id = f.words.get(m[0].toLowerCase()),
      c = id ? calledIn(world, l, id) : null;
    if (c) return `of ${c.gloss}, as ${peopleOf(l)} call ${m[0].toLowerCase()}`;
  }
  return null;
}

/** Words for things in a run of words as the people of a land call them (a man's arm on his card). */
export function sayIn(world: World, text: string, cell: number | null): string {
  const l = speakersAt(world, cell);
  if (!l) return text;
  const f = keptOf(world).facts,
    lex = lexiconOf(world, l).by;
  return text.replace(f.pattern, (m: string) => {
    const id = f.words.get(m.toLowerCase()),
      c = id ? lex.get(id) : undefined;
    return c ? caseOf(m, c.word) : m;
  });
}

/** Every word one people took from another with a thing, for the look tools and the survey. */
export function takenWordsOf(world: World): {
  readonly language: string;
  readonly ref: string;
  readonly land: number | null;
  readonly thing: string;
  readonly word: string;
  readonly from: string;
  readonly theirs: string;
  readonly event: string;
  readonly year: number;
}[] {
  if (!hasNames(world)) return [];
  const store = languagesOf(world),
    speakers = store.speakers(),
    out: ReturnType<typeof takenWordsOf>[number][] = [];
  for (const l of store.all()) {
    if (l.died !== null) continue;
    for (const c of lexiconOf(world, l).by.values()) {
      if (!c.taken || c.id.startsWith("elem:")) continue;
      const giver = store.at(c.taken.from);
      out.push({
        language: l.name,
        ref: l.ref,
        land: speakers.get(l.index)?.[0] ?? null,
        thing: c.id,
        word: c.word,
        from: giver.name,
        theirs: calledIn(world, giver, c.id)?.word ?? "",
        event: c.taken.event,
        year: c.taken.year,
      });
    }
  }
  return out;
}
