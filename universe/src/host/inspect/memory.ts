// Memory in the town (T1, classic 52, 58 and 50): the stones a town raised to what happened in it, and the songs a people make of what
// happened to them. It reads, it never touches: every stone and every line comes from the world's log of events, once, and is kept outside
// the world until the log has moved on. The log keeps importance 4 for 400 years, 5 for 1,200, 6 on for good, so a small battle's stone is
// lost to the reading as it is lost to the chronicle.
//
// A stone is a place's own memory, and it finds its town so:
//   - what names a town (a strike, the greatest fire): that town;
//   - what names a land before a town (a battle, a landing): the land's heart, the town its battles are fought before, as long as it stood
//     then; else the land's oldest then. No town stood then: no stone, though the song is still sung;
//   - what fell on a whole land (a sickness, a hunger, a rising): one of its towns standing then, drawn by the event;
//   - a ruler: the town their realm is named for, at its seat in that year.
// The stone belongs to the town, whoever holds it now. Who raised it is whoever the event says held the place that year. If they are
// gone the page says so ("which is gone"), and who keeps it now. Far-off realms don't get to rewrite the stone.
//
// What it is made of comes from who raised it: the rock of their land, cut; a people who cannot grip heap stones and don't cut; a people
// of the water bind shell and coral. What it looks like comes from what happened. A town keeps its five greatest, at most two of a kind.
import {
  hashString,
  YEAR,
  yearOfMoment,
  type HistoryEvent,
  type World,
} from "../../kernel/index.ts";
import { tongueName, tonguePersonName, meansOfWorld, type Tongue } from "../../gen/index.ts";
import {
  fireOf,
  homePlanet,
  languagesOf,
  loreOf,
  politiesOf,
  populationContext,
  type Settlement,
} from "../../sim/index.ts";
import type {
  Block,
  Line,
  Memorial,
  MemorialForm,
  PageModel,
  Span,
  Tab,
  TownSong,
} from "../../bridge/index.ts";
import { flockOf, landStone } from "../chain.ts";
import { landHeart } from "../village.ts";
import { lineOf, landName } from "./annals.ts";
import { landLink, languageLink, realmLink, townLink } from "./names.ts";
import { item, link, stat, yearNow } from "./words.ts";
import {
  cutOn,
  songOf,
  spoken,
  wornBy,
  type Song,
  type SongFacts,
  type SongKind,
} from "./verse.ts";

type Shape = "stone" | "wall" | "stump" | "tomb" | "ring" | "column";

/** Something that happened that a people can remember. */
export type Deed = {
  /** The event it is told from. */
  readonly id: string;
  readonly kind: SongKind;
  readonly year: number;
  readonly cell: number | null;
  /** The town it names, or its land's (null: no town stood there then). */
  town: string | null;
  dead: number;
  homes: number;
  years: number;
  what: string | null;
  /** What opens the page of `what`, or of who it is about. */
  whatRef: string | null;
  who: string | null;
  whoRef: string | null;
  age: number;
  to: string | null;
  /** Those who sing it and their foe (a realm's own name), with their realms' full names and refs. */
  us: string | null;
  usFull: string | null;
  usRef: string | null;
  them: string | null;
  themFull: string | null;
  themRef: string | null;
  won: boolean | null;
  count: number;
  worth: number;
  /** What it raised (null: only a song). */
  shape: Shape | null;
  /** Who held the place when it was raised: 0 us, 1 them. */
  raiser: 0 | 1;
};

/** The most stones a town keeps, and of one kind. */
export const MOST_STONES = 5;
const MOST_OF_A_KIND = 2;

const year = (e: HistoryEvent): number => yearOfMoment(e.t);
const bare = (name: unknown): string | null =>
  typeof name === "string" && name ? name.replace(/^the [a-z ]+ of /, "") : null;
const full = (name: unknown): string | null => (typeof name === "string" && name ? name : null);
const cellOf = (e: HistoryEvent): number | null => {
  const m = /^cell:\d+:(\d+)$/.exec(e.place ?? "");
  return m ? Number(m[1]) : null;
};
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const log = (n: number): number => Math.log10(Math.max(1, n));

function blank(e: HistoryEvent, kind: SongKind, worth: number, shape: Shape | null): Deed {
  return {
    id: e.id,
    kind,
    year: year(e),
    cell: cellOf(e),
    town: null,
    dead: 0,
    homes: 0,
    years: 0,
    what: null,
    whatRef: null,
    who: null,
    whoRef: null,
    age: 0,
    to: null,
    us: null,
    usFull: null,
    usRef: null,
    them: null,
    themFull: null,
    themRef: null,
    won: null,
    count: 0,
    worth,
    shape,
    raiser: 0,
  };
}

/** How the god's acts are said, what they leave and what they are. */
const ACTS: Readonly<Record<string, readonly [string, Shape, SongKind]>> = {
  "act.flood": ["the flood", "stone", "sky"],
  "act.fire": ["the burning", "stump", "sky"],
  "act.meteor": ["the falling star", "stump", "sky"],
  "act.quake": ["the quake", "column", "sky"],
  "act.curse": ["the curse", "stone", "sky"],
  "act.loose": ["what was let loose", "wall", "sky"],
  "act.plague": ["the god's sickness", "wall", "plague"],
};

type Reading = {
  /** The events it was read from: read again once these have moved on. */
  readonly version: string;
  /** What is remembered, in the order it happened. */
  readonly deeds: readonly Deed[];
  /** What is remembered of each land, of each realm, and by each town in stone. */
  readonly byCell: ReadonlyMap<number, readonly Deed[]>;
  readonly byRealm: ReadonlyMap<string, readonly Deed[]>;
  readonly stones: ReadonlyMap<string, readonly Deed[]>;
  readonly byId: ReadonlyMap<string, Deed>;
};

const KEPT = new WeakMap<World, Reading>();

/** The reading of a world's memory: once for each state of its log. */
export function memoryOf(world: World): Reading {
  const version = `${world.events.count}|${world.events.count ? world.events.at(world.events.count - 1).id : ""}`,
    known = KEPT.get(world);
  if (known?.version === version) return known;
  const read = readMemory(world, version);
  KEPT.set(world, read);
  return read;
}

function readMemory(world: World, version: string): Reading {
  const ctx = populationContext(world),
    realms = politiesOf(world),
    falls = new Map(fireOf(world).state.falls.map((f) => [f.event as string, f])),
    gathered = new Map<string, Deed>(),
    single: Deed[] = [],
    reign = new Map<string, number>(),
    events = world.events,
    // (Its own towns, once a land: the eye's read of a colony's halls makes that whole world, 7 s on harrow 348.)
    inLand = new Map<number, readonly Settlement[]>(),
    townsIn = (cell: number): readonly Settlement[] => {
      let l = inLand.get(cell);
      if (!l) inLand.set(cell, (l = ctx.settlements.inProvince(cell)));
      return l;
    },
    seatTown = (name: string | null, cell: number | null, y: number): string | null => {
      if (cell === null || !name) return null;
      return townsIn(cell).find((s) => s.name === name && s.founded <= y)?.ref ?? null;
    };
  const gather = (key: string, make: () => Deed): Deed => {
    let d = gathered.get(key);
    if (!d) gathered.set(key, (d = make()));
    return d;
  };
  for (let i = 0; i < events.count; i++) {
    const e = events.at(i),
      t = e.type,
      dot = t.indexOf("."),
      domain = t.slice(0, dot);
    // (Most of a world's log is none of this: said at once.)
    if (!MEMORABLE.has(domain)) continue;
    const d = (e.data ?? {}) as Record<string, unknown>,
      pols = e.subjects.filter((s) => s.startsWith("pol:")),
      town = e.subjects.find((s) => s.startsWith("town:")) ?? null;
    switch (t) {
      case "war.battle": {
        const fallen = num(d.fallen),
          war = e.subjects.find((s) => s.startsWith("war:")) ?? "",
          cell = cellOf(e);
        if (fallen < 100 || cell === null) break;
        const k = gather(`b|${war}|${cell}`, () => blank(e, "battle", 0, "stone"));
        if (fallen <= k.dead) break;
        Object.assign(k, {
          id: e.id,
          dead: fallen,
          worth: 2 + log(fallen),
          them: bare(d.a),
          themFull: full(d.a),
          themRef: pols[0] ?? null,
          us: bare(d.b),
          usFull: full(d.b),
          usRef: pols[1] ?? null,
          won: !d.won,
          raiser: d.won ? 1 : 0,
          whatRef: war || null,
          year: year(e),
        });
        break;
      }
      case "war.strike": {
        const dead = num(d.dead);
        if (!town || dead <= 0) break;
        const fall = falls.get(e.id);
        if (fall) {
          const k = blank(e, "fire", 14, "stump");
          Object.assign(k, {
            town,
            cell: fall.cell,
            dead: fall.dead,
            homes: fall.homes,
            them: bare(d.a),
            themFull: full(d.a),
            themRef: pols[0] ?? null,
            us: bare(d.b),
            usFull: full(d.b),
            usRef: pols[1] ?? null,
          });
          single.push(k);
          break;
        }
        const war = e.subjects.find((s) => s.startsWith("war:")) ?? "",
          k = gather(`s|${war}|${town}`, () => {
            const n = blank(e, "struck", 0, "wall");
            n.town = town;
            return n;
          });
        Object.assign(k, {
          dead: k.dead + dead,
          homes: k.homes + num(d.homes),
          worth: 2 + log(k.dead + dead),
          them: bare(d.a),
          themFull: full(d.a),
          themRef: pols[0] ?? null,
          us: bare(d.b),
          usFull: full(d.b),
          usRef: pols[1] ?? null,
          whatRef: war || null,
        });
        break;
      }
      case "health.rose":
      case "health.outbreak": {
        const cell = cellOf(e),
          sick = e.subjects.find((s) => s.startsWith("sick:")) ?? "";
        if (cell === null) break;
        const k = gather(`p|${sick}|${cell}`, () => blank(e, "plague", 0, "wall")),
          dead = k.dead + num(d.dead);
        Object.assign(k, {
          dead,
          what: full(d.sickness) ?? k.what,
          whatRef: sick || null,
          worth: 1.5 + log(dead) + (t === "health.rose" || k.age === 1 ? 1 : 0),
          // (Where it rose is remembered, however few it took there.)
          age: t === "health.rose" ? 1 : k.age,
        });
        break;
      }
      case "people.famine": {
        const cell = cellOf(e),
          fed = num(d.fed) || 1000;
        if (cell === null || fed > 900) break;
        const k = gather(`f|${cell}|${Math.floor(year(e) / 12)}`, () =>
            blank(e, "hunger", 0, "stone"),
          ),
          worth = 2.5 + (1000 - fed) / 110;
        if (worth <= k.worth) break;
        Object.assign(k, { worth, id: e.id, year: year(e), count: num(d.people) });
        break;
      }
      case "polity.succession": {
        const pol = pols[0],
          r = pol ? realms.get(pol as never) : undefined,
          since = pol ? (reign.get(pol) ?? r?.founded ?? year(e)) : year(e),
          sat = year(e) - since;
        if (pol) reign.set(pol, year(e));
        if (!pol || !full(d.old) || (sat < 12 && num(d.age) < 70)) break;
        const k = blank(e, "ruler", 3 + sat / 10, sat >= 20 || num(d.age) >= 80 ? "tomb" : null);
        Object.assign(k, {
          who: full(d.old),
          whoRef: pol,
          age: num(d.age),
          to: full(d.to),
          years: sat,
          us: bare(d.name),
          usFull: full(d.name),
          usRef: pol,
          town: seatTown(r?.town ?? null, cellOf(e), year(e)),
        });
        single.push(k);
        break;
      }
      case "polity.ended":
      case "nation.fell": {
        const pol = pols[0],
          name = t === "nation.fell" ? bare(d.realm) : bare(d.name),
          r = pol ? realms.get(pol as never) : undefined,
          k = blank(e, "fall", t === "nation.fell" ? 7.5 : 6.5, "column");
        if (!name) break;
        Object.assign(k, {
          what: name,
          whatRef: pol ?? null,
          years: r ? Math.max(0, year(e) - r.founded) : 0,
          us: name,
          usFull: full(d.name) ?? name,
          usRef: pol ?? null,
          town: t === "polity.ended" ? seatTown(r?.town ?? null, cellOf(e), year(e)) : null,
        });
        single.push(k);
        break;
      }
      case "strife.revolution":
      case "strife.repressed":
      case "order.crushed": {
        const dead = num(d.dead),
          k = blank(
            e,
            "rising",
            t === "strife.revolution" ? 6.5 : 2.5 + log(dead),
            t === "strife.revolution" ? "stone" : dead >= 200 ? "wall" : null,
          );
        Object.assign(k, {
          dead,
          us: bare(d.realm),
          usFull: full(d.realm),
          usRef: pols[0] ?? null,
          won: t === "strife.revolution",
        });
        single.push(k);
        break;
      }
      case "order.freed":
      case "order.abolished": {
        const k = blank(e, "freed", 6, "stone");
        Object.assign(k, {
          count: num(d.count),
          us: bare(d.realm),
          usFull: full(d.realm),
          usRef: pols[0] ?? null,
          won: true,
        });
        single.push(k);
        break;
      }
      case "strife.coup":
      case "court.seized": {
        const who = full(d.general) ?? full(d.who);
        if (!who) break;
        const k = blank(e, "coup", 4, null);
        Object.assign(k, {
          who,
          whoRef: pols[0] ?? null,
          us: bare(d.realm),
          usFull: full(d.realm),
          usRef: pols[0] ?? null,
        });
        single.push(k);
        break;
      }
      case "people.origin":
      case "knowledge.cultivation":
      case "knowledge.herding":
      case "knowledge.metalworking":
      case "lanes.first": {
        single.push(
          blank(
            e,
            "first",
            t === "people.origin" ? 9 : 5.5,
            t === "people.origin" ? "ring" : "stone",
          ),
        );
        break;
      }
      // What a town raised because it was asked (H1): its stone says who asked and it says what; a ruler's word or the god's.
      case "town.raised": {
        const k = blank(e, "asked", 12, "stone");
        Object.assign(k, {
          what: typeof d.what === "string" ? d.what : null,
          who: typeof d.ruler === "string" ? d.ruler : null,
          town: (e.subjects ?? [])[0] ?? null,
        });
        single.push(k);
        break;
      }
      case "beast.ended": {
        // (A beast people knew: its song, and a stone where it took many. Z1.)
        const fallen = num(d.fallen),
          k = blank(e, "beast", 4 + log(1 + fallen) * 2, "stone"),
          given = typeof d.given === "string" ? d.given : null;
        Object.assign(k, {
          what: given,
          who: typeof d.killer === "string" ? d.killer : null,
          dead: fallen,
          years: num(d.years),
          town: (e.subjects ?? []).find((s) => String(s).startsWith("town:")) ?? null,
        });
        single.push(k);
        break;
      }
      case "peoples.landed":
      case "peoples.raid":
      case "contact.met":
      case "contact.heard": {
        const k = gather(`c|${cellOf(e)}|${full(d.name) ?? ""}`, () =>
          blank(e, "strangers", 7.5, t === "contact.heard" ? null : "stone"),
        );
        Object.assign(k, {
          what: full(d.name) ?? k.what,
          whatRef: e.subjects.find((s) => s.startsWith("civ:")) ?? k.whatRef,
          us: bare(d.realm) ?? k.us,
          usRef: pols[0] ?? k.usRef,
          usFull: full(d.realm) ?? k.usFull,
        });
        break;
      }
      case "belief.founded": {
        const k = blank(e, "faith", 5, "stone");
        Object.assign(k, {
          what: full(d.name),
          whatRef: e.subjects.find((s) => s.startsWith("faith:")) ?? null,
        });
        single.push(k);
        break;
      }
      case "war.peace": {
        const years = num(d.years);
        if (years < 3) break;
        const k = blank(e, "peace", 2.5 + years / 6, null);
        Object.assign(k, {
          years,
          us: bare(d.b),
          usFull: full(d.b),
          usRef: pols[1] ?? null,
          them: bare(d.a),
          themFull: full(d.a),
          themRef: pols[0] ?? null,
          won: !d.won,
        });
        single.push(k);
        break;
      }
      case "nation.left":
      case "space.colony":
      case "space.voyage": {
        const k = blank(e, "leaving", 3.5, null);
        Object.assign(k, {
          us: bare(d.realm) ?? bare(d.name),
          usFull: full(d.realm) ?? full(d.name),
          usRef: pols[0] ?? null,
        });
        single.push(k);
        break;
      }
      default: {
        const act = ACTS[t];
        if (!act) break;
        // (What the world did by itself, by what it did: a small shock is no one's stone or song. N1.)
        const natural = d.natural === true,
          dead = num(d.dead) || num(d.killed);
        if (natural && dead < 100) break;
        const worst =
            natural && d.homes && typeof d.homes === "object"
              ? Object.entries(d.homes as Record<string, number>).sort(
                  (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
                )[0]?.[0]
              : null,
          k = blank(e, act[2], natural ? 2.5 + log(dead) : 7, act[1]);
        Object.assign(k, { what: act[0], town: town ?? worst ?? null, dead });
        single.push(k);
      }
    }
  }
  const deeds = [...single, ...gathered.values()];
  // What is too small to carve; where each finds its town.
  const heart = new Map<number, string | null>(),
    stood = (ref: string, y: number) => {
      const s = ctx.settlements.get(ref as never);
      return !!s && s.founded <= y;
    },
    townOfLand = (cell: number, y: number): string | null => {
      if (!heart.has(cell)) heart.set(cell, townsIn(cell).length ? landHeart(world, cell) : null);
      const h = heart.get(cell) ?? null;
      if (h && stood(h, y)) return h;
      let oldest: Settlement | null = null;
      for (const s of townsIn(cell))
        if (s.founded <= y && s.population > 0 && (!oldest || s.founded < oldest.founded))
          oldest = s;
      return oldest?.ref ?? null;
    };
  // (What fell on a whole land, not before one town: one of its towns standing then, drawn by the event, so a land's stones don't all stand in its heart.)
  const anyTownOfLand = (cell: number, y: number, id: string): string | null => {
    const then = townsIn(cell).filter((s) => s.founded <= y && s.population > 0);
    return then.length ? then[(hashString(id) >>> 0) % then.length]!.ref : townOfLand(cell, y);
  };
  const byCell = new Map<number, Deed[]>(),
    byRealm = new Map<string, Deed[]>(),
    byTown = new Map<string, Deed[]>(),
    byId = new Map<string, Deed>();
  const put = <K>(m: Map<K, Deed[]>, k: K, d: Deed) => {
    const l = m.get(k);
    if (l) l.push(d);
    else m.set(k, [d]);
  };
  const hungerStone = new Map<number, number>();
  deeds.sort((a, b) => a.year - b.year || (a.id < b.id ? -1 : 1));
  for (const d of deeds) {
    if (d.cell !== null && !d.town)
      d.town =
        d.kind === "hunger" || d.kind === "plague" || d.kind === "rising"
          ? anyTownOfLand(d.cell, d.year, d.id)
          : townOfLand(d.cell, d.year);
    byId.set(d.id, d);
    if (d.cell !== null) put(byCell, d.cell, d);
    if (d.usRef) put(byRealm, d.usRef, d);
    if (d.themRef) put(byRealm, d.themRef, d);
    if (!d.shape || !d.town || d.worth < STONE_WORTH[d.kind]!) continue;
    // (A land raises one hunger stone a long lifetime: on a world that goes hungry often, the rest are songs.)
    if (d.kind === "hunger" && d.cell !== null) {
      if (d.year - (hungerStone.get(d.cell) ?? -Infinity) < 120) continue;
      hungerStone.set(d.cell, d.year);
    }
    put(byTown, d.town, d);
  }
  // A town's five greatest, at most two of a kind.
  const stones = new Map<string, readonly Deed[]>();
  for (const [town, list] of byTown) {
    const kept: Deed[] = [],
      kinds = new Map<SongKind, number>();
    for (const d of [...list].sort((a, b) => b.worth - a.worth || a.year - b.year)) {
      const n = kinds.get(d.kind) ?? 0;
      if (n >= MOST_OF_A_KIND) continue;
      kinds.set(d.kind, n + 1);
      kept.push(d);
      if (kept.length >= MOST_STONES) break;
    }
    stones.set(
      town,
      kept.sort((a, b) => a.year - b.year || (a.id < b.id ? -1 : 1)),
    );
  }
  return { version, deeds, byCell, byRealm, stones, byId };
}

/** The domains of event there is anything to remember from. */
const MEMORABLE = new Set([
  "town",
  "war",
  "health",
  "people",
  "polity",
  "nation",
  "strife",
  "order",
  "court",
  "knowledge",
  "lanes",
  "peoples",
  "contact",
  "belief",
  "space",
  "act",
]);

/** The least a thing of each kind is worth a stone (measured over whole worlds: tools/t1-tally.ts). */
const STONE_WORTH: Readonly<Partial<Record<SongKind, number>>> = {
  battle: 5.5,
  struck: 5,
  fire: 0,
  plague: 4.5,
  hunger: 5.2,
  fall: 0,
  ruler: 5.5,
  rising: 6,
  freed: 0,
  first: 0,
  strangers: 0,
  faith: 0,
  sky: 0,
  beast: 4.5,
};

// —— Who they are, and what they have to hand ——————————————————————————————————————————————

type Hand = {
  readonly water: boolean;
  readonly grips: boolean;
  readonly fireless: boolean;
  readonly rock: string;
  readonly colour: readonly [number, number, number];
};

/** What a land's people have to raise a thing with. */
function handOf(world: World, cell: number | null): Hand {
  const g = homePlanet(world).generated,
    means = meansOfWorld(g),
    medium = g.life.people?.body.medium ?? "land",
    land = cell !== null && cell < g.offworld.base ? cell : (g.life.people?.cell ?? 0),
    got = landStone(world, land);
  return {
    water: medium === "water",
    grips: means.grips,
    fireless: !means.burns,
    rock: got.rock.replace(/[-_]/g, " "),
    colour: got.stone.colour,
  };
}

/** Lore that says a people pour black glass by that year (their far age). */
function farAge(world: World, cell: number | null, y: number): boolean {
  if (cell === null) return false;
  const known = loreOf(world).get(cell, "fusion-power")?.year;
  return known !== undefined && known <= y;
}

/** What a thing raised comes to, by what happened and who raised it: its form, and its words. */
function formOf(
  shape: Shape,
  hand: Hand,
  far: boolean,
): { readonly form: MemorialForm; readonly stuff: string; readonly built: string } {
  if (shape === "stump")
    return {
      form: "stump",
      stuff: "what was left",
      built: "No one raised it: it is what was left standing, and they have left it so.",
    };
  if (hand.water) {
    const bound = "bound shell and coral";
    switch (shape) {
      case "wall":
        return {
          form: "reef",
          stuff: bound,
          built: "A long reef grown on purpose, each head set for someone.",
        };
      case "tomb":
        return {
          form: "dome",
          stuff: bound,
          built: "A low dome of coral, grown over one who ruled.",
        };
      case "ring":
        return { form: "reef", stuff: bound, built: "A ring of coral heads, older than any town." };
      default:
        return {
          form: "pillar",
          stuff: bound,
          built:
            "A pillar of shell bound with weed and grown over with coral. It stands in the current.",
        };
    }
  }
  if (!hand.grips) {
    const heaped = `heaped ${hand.rock}`;
    switch (shape) {
      case "wall":
        return {
          form: "heap",
          stuff: heaped,
          built:
            "A long row of heaps, a stone carried here for each who is gone. No one here can cut a name; they carry.",
        };
      case "tomb":
        return {
          form: "barrow",
          stuff: heaped,
          built: "A barrow, raised a mouthful and a pawful at a time. No one here can cut a name.",
        };
      case "ring":
        return {
          form: "ring",
          stuff: heaped,
          built: "A ring of stones rolled here by those who could not lift them.",
        };
      default:
        return {
          form: "cairn",
          stuff: heaped,
          built:
            "A cairn, every stone of it carried here. No one here can cut a word, so nothing is written on it, and everyone knows what it says.",
        };
    }
  }
  if (far && shape !== "ring" && shape !== "column")
    return {
      form: shape === "wall" ? "wall" : shape === "tomb" ? "tomb" : "slab",
      stuff: "black glass",
      built:
        shape === "wall"
          ? "A long wall of black glass, its names lit from within."
          : shape === "tomb"
            ? "A tomb of black glass, poured in one piece."
            : "A slab of black glass, cast in one piece, with no mark on it till you touch it.",
    };
  const rock = hand.rock;
  switch (shape) {
    case "wall":
      return {
        form: "wall",
        stuff: rock,
        built: `A long wall of ${rock}, cut with as many names as were known.`,
      };
    case "tomb":
      return { form: "tomb", stuff: rock, built: `A tomb of ${rock}, roofed and shut.` };
    case "ring":
      return {
        form: "ring",
        stuff: rock,
        built: `A ring of rough ${rock} stones, older than the square about them.`,
      };
    case "column":
      return {
        form: "column",
        stuff: rock,
        built: `A column of ${rock}, broken on purpose, its top laid at its foot.`,
      };
    default:
      return { form: "stone", stuff: rock, built: `A standing stone of ${rock}, cut on one face.` };
  }
}

const shade = (c: readonly [number, number, number], k: number): [number, number, number] => [
  c[0] * k,
  c[1] * k,
  c[2] * k,
];

const STONE_NAMES: Readonly<Record<SongKind, string>> = {
  battle: "stone of the field",
  struck: "wall of the night",
  fire: "stump of the greatest fire",
  plague: "wall of the sick",
  hunger: "hunger stone",
  fall: "broken column",
  ruler: "tomb",
  rising: "stone of those who asked",
  freed: "stone of the freed",
  coup: "stone",
  first: "first stone",
  strangers: "stone of the landing",
  faith: "stone of the word",
  peace: "stone of the peace",
  leaving: "stone of those who went",
  sky: "stone of the god's hand",
  beast: "stone of the beast",
  asked: "stone of the asking",
};

/** Colours by what it is made of. */
const CORAL: readonly [number, number, number] = [0.84, 0.66, 0.6],
  HEAP_DIM = 0.86,
  GLASS: readonly [number, number, number] = [0.2, 0.21, 0.28];

// —— What a person gets ———————————————————————————————————————————————————————————————————

const stoneRef = (town: string, d: Deed): string => `stone:${town}:${d.id}`;
export const songRef = (d: Deed): string => `song:${d.id}`;

/** A town's stones, as its plan carries them (none: its past has none). */
export function memorialsOf(world: World, town: string): readonly Memorial[] {
  const list = memoryOf(world).stones.get(town) ?? [],
    now = yearNow(world);
  return list.map((d) => {
    const hand = handOf(world, d.cell),
      far = farAge(world, d.cell, d.year),
      f = formOf(d.shape!, hand, far),
      colour =
        f.form === "stump"
          ? ([0.1, 0.09, 0.08] as const)
          : f.stuff === "black glass"
            ? GLASS
            : hand.water
              ? CORAL
              : shade(hand.colour, hand.grips ? 1 : HEAP_DIM);
    return {
      ref: stoneRef(town, d),
      form: f.form,
      title: `The ${STONE_NAMES[d.kind]}`,
      year: d.year,
      age: Math.max(0, now - d.year),
      size: Math.max(0.75, Math.min(1.7, 0.6 + d.worth / 10)),
      colour: [colour[0], colour[1], colour[2]],
      dark:
        f.stuff === "black glass"
          ? [0.42, 0.72, 0.95]
          : f.form === "stump"
            ? [0.03, 0.03, 0.03]
            : shade(colour, 0.42),
    };
  });
}

/** The tongue of a land, and a word of it (null: they have none of their own yet). */
function tongueOf(
  world: World,
  cell: number | null,
): { name: string; standard: Tongue; ref: string; born: number } | null {
  if (cell === null) return null;
  const l = languagesOf(world).of(cell);
  return l ? (l as never) : null;
}

const LAND_FACTS = new WeakMap<
  World,
  Map<number, { beast: string | null; god: string | null; land: string | null }>
>();
function landFacts(world: World, cell: number | null) {
  const key = cell ?? -1;
  let map = LAND_FACTS.get(world);
  if (!map) LAND_FACTS.set(world, (map = new Map()));
  let got = map.get(key);
  if (!got) {
    let beast: string | null = null,
      land: string | null = null;
    try {
      if (cell !== null) {
        beast = flockOf(world, cell)?.name ?? null;
        land = landName(world, cell);
      }
    } catch {
      // (A land of another body: no flocks to name, and its words are the town's.)
    }
    const t = tongueOf(world, cell);
    got = {
      beast,
      land,
      god: t ? tongueName({ ...t.standard, seed: t.standard.seed ^ 0x60d }, 7) : null,
    };
    map.set(key, got);
  }
  return got;
}

/** What a song is made from: the deed, read now. */
function factsOf(world: World, d: Deed): SongFacts {
  const hand = handOf(world, d.cell),
    place = landFacts(world, d.cell),
    towns = populationContext(world).settlements,
    town = d.town ? (towns.get(d.town as never)?.name ?? null) : null;
  return {
    key: hashString(`song ${d.id}`) >>> 0,
    kind: d.kind,
    age: Math.max(0, yearNow(world) - d.year),
    year: d.year,
    town,
    land: place.land,
    us: d.us,
    them: d.them,
    who: d.who,
    dead: d.dead,
    homes: d.homes,
    years: d.years,
    what: d.what,
    won: d.won,
    water: hand.water,
    fireless: hand.fireless,
    stone: hand.rock,
    beast: place.beast,
    god: place.god,
  };
}

/** What only some lines of a song can use, while it still holds it. */
function extraOf(d: Deed, age: number): Record<string, string> {
  const w = wornBy(age);
  return {
    ...(d.age > 1 && w === 0 ? { age: spoken(d.age) } : {}),
    ...(d.to && w === 0 ? { to: d.to } : {}),
    ...(d.count > 0 && d.kind === "freed" && w === 0 ? { freed: spoken(d.count) } : {}),
  };
}

const SUNG = new WeakMap<World, Map<string, Song>>();
/** A deed's song as it is sung now (its words kept while its wear stands). */
export function songFor(world: World, d: Deed): Song {
  const age = Math.max(0, yearNow(world) - d.year),
    key = `${d.id}|${wornBy(age)}`;
  let map = SUNG.get(world);
  if (!map) SUNG.set(world, (map = new Map()));
  let s = map.get(key);
  if (!s) map.set(key, (s = songOf(factsOf(world, d), extraOf(d, age))));
  return s;
}

/** What is told of a town: its own stones first, then its land's, then its realm's, then all the world's great ones. */
function deedsOfTown(world: World, town: Settlement, most: number): Deed[] {
  const m = memoryOf(world),
    seen = new Set<string>(),
    out: Deed[] = [],
    take = (list: readonly Deed[], n: number) => {
      const best = [...list].sort((a, b) => b.worth - a.worth || b.year - a.year);
      let k = 0;
      for (const d of best) {
        if (out.length >= most || k >= n) break;
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        out.push(d);
        k++;
      }
    },
    realm = politiesOf(world).of(town.cell);
  take(m.stones.get(town.ref) ?? [], MOST_STONES);
  take(m.byCell.get(town.cell) ?? [], 5);
  if (realm) take(m.byRealm.get(realm.ref) ?? [], 3);
  take(
    m.deeds.filter(
      (d) => d.worth >= 7.5 && (d.kind === "first" || d.kind === "strangers" || d.kind === "fire"),
    ),
    2,
  );
  return out;
}

/** A town's songs, for its plan: what its feasts may sing. */
export function townSongs(world: World, ref: string): readonly TownSong[] {
  const town = populationContext(world).settlements.get(ref as never);
  if (!town) return [];
  return deedsOfTown(world, town, 8).map((d) => {
    const s = songFor(world, d);
    return { ref: songRef(d), title: s.title, line: s.line, kind: d.kind };
  });
}

/** A song's row in a list. */
function songItem(world: World, d: Deed): ReturnType<typeof item> {
  const s = songFor(world, d);
  return item(
    [link(s.title, songRef(d)), `, ${s.form}, of year ${d.year}. ${s.line}`],
    songRef(d),
    d.year,
  );
}

/** A town's Songs and tales tab. */
export function townSongsTab(world: World, ref: string): Tab | null {
  const town = populationContext(world).settlements.get(ref as never);
  if (!town) return null;
  const deeds = deedsOfTown(world, town, 12),
    stones = memoryOf(world).stones.get(ref) ?? [],
    blocks: Block[] = deeds.length
      ? [
          {
            type: "list",
            title: "What they sing here",
            items: deeds.map((d) => songItem(world, d)),
          },
        ]
      : [
          {
            type: "text",
            lines: [["Nothing has happened here yet that anyone has made a song of."]],
          },
        ];
  if (stones.length)
    blocks.push({
      type: "list",
      title: "What they raised",
      items: stones.map((d) => {
        const f = formOf(d.shape!, handOf(world, d.cell), farAge(world, d.cell, d.year));
        return item(
          [link(`The ${STONE_NAMES[d.kind]}`, stoneRef(ref, d)), `, of ${f.stuff}, year ${d.year}`],
          stoneRef(ref, d),
          d.year,
        );
      }),
    });
  return { id: "songs", name: "Songs and tales", blocks };
}

/** A realm's or a people's Songs and tales tab. */
export function deedsSongsTab(world: World, deeds: readonly Deed[], none: string): Tab {
  const best = [...deeds].sort((a, b) => b.worth - a.worth || b.year - a.year).slice(0, 14);
  return {
    id: "songs",
    name: "Songs and tales",
    blocks: best.length
      ? [{ type: "list", title: "What they sing", items: best.map((d) => songItem(world, d)) }]
      : [{ type: "text", lines: [[none]] }],
  };
}

/** A realm's Songs and tales tab. */
export function realmSongsTab(world: World, ref: string): Tab {
  return deedsSongsTab(
    world,
    memoryOf(world).byRealm.get(ref) ?? [],
    "Nothing has yet happened to this realm that anyone has made a song of.",
  );
}

/** A people's (those who speak a tongue) Songs and tales tab. */
export function peopleSongsTab(world: World, language: { readonly index: number }): Tab {
  const lands = languagesOf(world).speakers().get(language.index) ?? [],
    m = memoryOf(world);
  return deedsSongsTab(
    world,
    lands.flatMap((c) => m.byCell.get(c) ?? []),
    "Nothing has yet happened to this people that they have made a song of.",
  );
}

const say = (world: World, ref: string | null, words: string | null): Span =>
  ref?.startsWith("pol:") ? realmLink(world, ref) : link(words ?? "", ref);

/** Who raised a stone, in a sentence's words, and what became of them; who keeps it now. */
function raisedWords(
  world: World,
  d: Deed,
  town: Settlement,
): { raised: Line; keeps: Line | null } {
  const realms = politiesOf(world),
    side = d.raiser === 1 ? { ref: d.themRef, name: d.themFull } : { ref: d.usRef, name: d.usFull },
    now = realms.of(town.cell),
    by = side.ref ? realms.get(side.ref as never) : undefined,
    raised: Line =
      d.kind === "fire"
        ? [`Left standing by the people of `, townLink(world, town.ref), ` in year ${d.year}.`]
        : side.ref && side.name
          ? [
              `Raised after year ${d.year} by `,
              link(side.name, side.ref),
              ...(by && by.ended !== null ? [", which is gone."] : ["."]),
            ]
          : [`Raised after year ${d.year} by the people of `, townLink(world, town.ref), "."];
  const keeps: Line | null =
    town.population <= 0
      ? [`No one lives in `, townLink(world, town.ref), " now. It still stands."]
      : now && now.ref !== side.ref
        ? [
            "The town is ",
            realmLink(world, now.ref),
            d.raiser === 1 || side.ref
              ? "'s now, and they let it stand."
              : "'s now, and they let it stand.",
          ]
        : null;
  return { raised, keeps };
}

/** A tongue younger than a stone can't read it. */
function tongueWords(world: World, d: Deed): Line | null {
  const t = tongueOf(world, d.cell);
  if (!t) return null;
  if (t.born > d.year + 30)
    return [
      "It was cut before ",
      languageLink(world, t.ref),
      " was spoken here. Those who pass it now can't read it, and they know what it says.",
    ];
  return null;
}

function page(
  world: World,
  ref: string,
  icon: string,
  title: string,
  subtitle: Line,
  stats: PageModel["stats"],
  blocks: Block[],
): PageModel {
  return {
    ref,
    kind: "event",
    icon,
    title,
    subtitle,
    color: null,
    place: null,
    stats,
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: yearNow(world),
  };
}

const ICONS: Readonly<Record<MemorialForm, string>> = {
  stone: "🪨",
  wall: "🧱",
  stump: "🌑",
  tomb: "⚰️",
  ring: "⭕",
  column: "🏛️",
  cairn: "🪨",
  heap: "🪨",
  barrow: "⛰️",
  pillar: "🐚",
  reef: "🪸",
  dome: "🐚",
  slab: "⬛",
};

/** A stone's page: what it is, who raised it, the year, what happened, what is cut on it and what they sing of it. */
export function stonePage(world: World, ref: string): PageModel {
  const m = /^stone:(town:\d+:\d+):(.+)$/.exec(ref),
    town = m ? populationContext(world).settlements.get(m[1] as never) : undefined,
    d = m ? memoryOf(world).byId.get(m[2]!) : undefined;
  if (!town || !d || !d.shape)
    return page(
      world,
      ref,
      "🪨",
      "A stone",
      ["Of a town now gone"],
      [],
      [{ type: "text", lines: [["Nothing that is known stands there."]] }],
    );
  const hand = handOf(world, d.cell),
    f = formOf(d.shape, hand, farAge(world, d.cell, d.year)),
    age = Math.max(0, yearNow(world) - d.year),
    facts = factsOf(world, d),
    cut = !hand.water && hand.grips && f.form !== "stump" ? cutOn(facts, extraOf(d, 0)) : null,
    song = songFor(world, d),
    { raised, keeps } = raisedWords(world, d, town),
    tongue = cut ? tongueWords(world, d) : null,
    wornAway = cut && age >= 800,
    told: Line[] = [
      [f.built],
      raised,
      ...(keeps ? [keeps] : []),
      ...(wornAway
        ? [
            [
              `What was cut on it has worn away. You can make out "${d.year}", if you know to look for it.`,
            ],
          ]
        : cut
          ? [[`Cut on it: "${cut}"`]]
          : []),
      ...(tongue && !wornAway ? [tongue] : []),
    ];
  const blocks: Block[] = [
    {
      type: "facts",
      rows: [
        stat("Year", String(d.year), { why: d.id }),
        stat("Stands in", [townLink(world, town.ref)]),
        stat("Made of", f.stuff),
        ...(d.dead > 0 ? [stat("Dead", spoken(d.dead))] : []),
      ],
    },
    { type: "text", lines: told },
    {
      type: "text",
      title: "What happened",
      lines: [lineOf(world, world.events.get(d.id as never)!, d.year)],
    },
    {
      type: "text",
      title: "What they sing of it",
      lines: [[link(song.title, songRef(d)), `, ${song.form}: ${song.line}`]],
    },
  ];
  return {
    ...page(
      world,
      ref,
      ICONS[f.form],
      `The ${STONE_NAMES[d.kind]} of ${town.name}`,
      [`${f.stuff}, year ${d.year}, in `, townLink(world, town.ref)],
      [stat("Year", String(d.year)), stat("Town", [townLink(world, town.ref)])],
      blocks,
    ),
    place: { scale: "village", town: town.ref, stone: ref },
  };
}

/** A song's page: its words, what it tells of, what has changed in the telling, who made it and where it is sung. */
export function songPage(world: World, ref: string): PageModel {
  const id = ref.slice("song:".length),
    d = memoryOf(world).byId.get(id);
  if (!d)
    return page(
      world,
      ref,
      "🎵",
      "A song",
      ["No one sings it now"],
      [],
      [{ type: "text", lines: [["No one left knows how it went."]] }],
    );
  const s = songFor(world, d),
    age = Math.max(0, yearNow(world) - d.year),
    w = wornBy(age),
    t = tongueOf(world, d.cell),
    towns = populationContext(world).settlements,
    town = d.town ? towns.get(d.town as never) : undefined,
    maker = t
      ? tonguePersonName(t.standard, hashString(`maker ${d.id}`) >>> 0, hashString(d.id) & 1)
      : null,
    changed: Line =
      w === 0
        ? [
            `It is ${age < 2 ? "new" : `${spoken(age)} years old`}, and it still ${d.dead > 0 ? "counts the dead" : "says who was there"}.`,
          ]
        : w === 1
          ? [
              `It is ${spoken(age)} years old. The numbers in it have gone round; the names have held.`,
            ]
          : w === 2
            ? [`It is ${spoken(age)} years old. Its numbers are gone and its names are worn short.`]
            : [
                `It is ${spoken(age)} years old. No name is left in it, and it is sung by people who don't know it is about anything.`,
              ],
    truth = world.events.get(d.id as never);
  const blocks: Block[] = [
    { type: "text", lines: s.lines.map((l) => [l]) },
    { type: "text", title: "How it has changed", lines: [changed] },
    {
      type: "text",
      title: "What really happened",
      lines: truth
        ? [lineOf(world, truth, d.year)]
        : [[`Something in year ${d.year}, and the record of it is lost.`]],
    },
    {
      type: "facts",
      rows: [
        stat("Happened", `year ${d.year}`, { why: d.id }),
        ...(town
          ? [stat("Where", [townLink(world, town.ref)])]
          : d.cell !== null
            ? [stat("Where", [landLink(world, d.cell)])]
            : []),
        ...(t ? [stat("Sung in", [languageLink(world, t.ref)])] : []),
        ...(maker && w < 2
          ? [stat("Made by", `${maker}, of whom nothing else is known`)]
          : [stat("Made by", "No one remembers")]),
        ...(town && d.shape && (memoryOf(world).stones.get(town.ref) ?? []).includes(d)
          ? [stat("Its stone", [link(`The ${STONE_NAMES[d.kind]}`, stoneRef(town.ref, d))])]
          : []),
        ...(d.usRef ? [stat("Those it tells of", [say(world, d.usRef, d.usFull)])] : []),
      ],
    },
  ];
  return page(
    world,
    ref,
    "🎵",
    s.title,
    [`${s.form}, of year ${d.year}`],
    [stat("Of year", String(d.year))],
    blocks,
  );
}

/** The whole of a world's memory, by the numbers: for the tally and the gate. */
export function memoryTally(world: World) {
  const m = memoryOf(world),
    towns = populationContext(world).settlements.all();
  return { deeds: m.deeds.length, towns: towns.length, stones: m.stones };
}

export { YEAR as _YEAR };
