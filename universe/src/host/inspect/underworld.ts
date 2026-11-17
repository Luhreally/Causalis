// The underworld lens (2026-11-16): what goes on under the law, land by land, one of six ways at a time. It reads, it never
// touches: every number is a store's, as the systems that keep them last set it, and nothing here flows back.
//   smuggling  the share of what a land's realm bars or taxes that slips past its borders (Round B's smuggling row, SMUGGLE).
//   cartels    how organised those who carry what its realm forbids are (Round B's law on intoxicants, BAR.cartel); and the realms
//              that hold a good's trade among them (trade's cartels, cartelsNow), marked on the map apart.
//   addiction  the share of a land's people who need what they take, and who die of it (Round B's intoxicants, INTOX).
//   crime      what leads its towns' people wrong, as their cases are read (host/inspect/justice.ts townWrong): its towns weighed
//              by their people.
//   roofless   the share of its towns' people on the street (the society sweep, society/roofless.ts).
//   gangs      how far the strongest crime group holds it (the underworld's row a land, sim/order/underworld-kept.ts groupsIn); its
//              killing a year and a crew of the realm's own enforcers working it, marked on the map apart.
// A land's five kept in stores are read in one pass over the lands, once a year (the stores turn yearly), with the map's other
// lenses; its crime, read of its towns' years as their cases are, in a pass of its own, once a year and only while it is shown (a
// year's read of a far world's towns takes some 20 ms, and the record they are read from as much again). Each is broken down for
// the tip under a finger, with the page that tells it whole.
import { potencyWords } from "./mobs.ts";
import { Hasher, type World } from "../../kernel/index.ts";
import { GOODS, INTOX_KINDS, INTOX_WORDS } from "../../rules/index.ts";
import {
  BAR,
  BAR_STORE,
  CARTEL_STORE,
  INTOX,
  INTOX_STORE,
  ROOFLESS_STORE,
  ROOF_ROW,
  SMUGGLE,
  SMUGGLE_STORE,
  GANG_ROW,
  capacityOf,
  cartelsNow,
  gangsStore,
  groupsIn,
  kindOfGroup,
  underworldOf,
  moneyStore,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  refNumber,
  societyStore,
  tradeStore,
  type Polity,
  type Settlement,
} from "../../sim/index.ts";
import { groupWords } from "../../causal/index.ts";
import { fedRef, groupRef } from "../underworld.ts";
import { townWrong } from "./justice.ts";
import { count, yearNow } from "./words.ts";

/** The lens's six ways, in the order a land's readings hold them. */
export const UNDERWORLD_VIEWS = [
  "smuggling",
  "cartels",
  "addiction",
  "crime",
  "roofless",
  "gangs",
] as const;
export type UnderworldView = (typeof UNDERWORLD_VIEWS)[number];

/** The most of a land's towns its crime is read of, its most peopled (a far land holds 48; the first few hold most of its people). */
export const CRIME_TOWNS = 4;

// (A small share told to a tenth of one in a hundred: a land where one in a hundred and fifty needs what they take is not one where none do.)
const pc = (x: number) =>
    x > 0 && x < 0.001
      ? "under 0.1%"
      : x < 0.1
        ? `${+(x * 100).toFixed(1)}%`
        : `${Math.round(x * 100)}%`,
  per = (thousandths: number) => pc(thousandths / 1000),
  grain = (n: number) => `${count(Math.round(n))} grain's worth`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A land's towns its crime is read of: those standing a year or more, its most peopled first. */
function townsRead(world: World, cell: number, year: number): { towns: Settlement[]; all: number } {
  const standing = populationContext(world)
    .settlements.inProvince(cell)
    .filter((t) => t.population > 0 && t.founded < year)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1));
  return { towns: standing.slice(0, CRIME_TOWNS), all: standing.length };
}

/** A land's crime: what weighs on its towns' peace, weighed by their people; the cases they are due; each weight by name. */
function crimeOf(
  world: World,
  cell: number,
  year: number,
): {
  weigh: number;
  due: number;
  towns: Settlement[];
  /** How many towns it holds a year old and more, of which `towns` are its greatest. */
  all: number;
  pressing: [string, number][];
} | null {
  const { towns, all } = townsRead(world, cell, year);
  if (!towns.length) return null;
  let people = 0,
    weigh = 0,
    due = 0;
  const by = new Map<string, number>();
  for (const t of towns) {
    const w = townWrong(world, t, year);
    people += t.population;
    weigh += t.population * w.weigh;
    due += w.due;
    for (const [name, v] of w.pressing) by.set(name, (by.get(name) ?? 0) + t.population * v);
  }
  return {
    weigh: weigh / people,
    due,
    towns,
    all,
    pressing: [...by].map(([name, v]): [string, number] => [name, v / people]),
  };
}

/** Each land's readings by UNDERWORLD_VIEWS (-1 where nothing is kept; its crime -1 here, read by underworldCrime), and the lands
 * of realms in a cartel among realms. */
export type UnderworldRead = {
  readonly lands: ReadonlyMap<number, readonly number[]>;
  /** Each land whose realm holds a good's trade with others: how many goods' cartels it is in. */
  readonly cartelLands: ReadonlyMap<number, number>;
  /** Each land where the underworld kills: those killed a year, in a hundred thousand of its people. */
  readonly killings: ReadonlyMap<number, number>;
  /** Each land a crew of its realm's own enforcers works: how far (0 … 1). */
  readonly badge: ReadonlyMap<number, number>;
};

const KEPT = new WeakMap<World, { key: string; read: UnderworldRead }>();

/**
 * The year, and the running digest of every store it reads (each keeps one of every row set down in it, a few numbers to fold): a
 * row set down within a year reads again, whether by a world's yearly sweep or by a test's hand.
 */
function keptKey(world: World): string {
  const h = new Hasher().int(yearNow(world)).int(populationContext(world).provinces.all().length);
  for (const s of [
    moneyStore(world, SMUGGLE_STORE),
    moneyStore(world, BAR_STORE),
    moneyStore(world, INTOX_STORE),
    societyStore(world, ROOFLESS_STORE),
    tradeStore(world, CARTEL_STORE),
    gangsStore(world),
  ])
    if (s) s.hashInto(h);
    else h.int(-1);
  return h.hex();
}

/** Every land's underworld, in one pass over the lands, once a year. */
export function underworldRead(world: World): UnderworldRead {
  const key = keptKey(world),
    hit = KEPT.get(world);
  if (hit && hit.key === key) return hit.read;
  const ctx = populationContext(world),
    realms = politiesOf(world),
    smuggle = moneyStore(world, SMUGGLE_STORE),
    bars = moneyStore(world, BAR_STORE),
    intox = moneyStore(world, INTOX_STORE),
    roof = societyStore(world, ROOFLESS_STORE),
    gangs = gangsStore(world),
    // (A realm's serial, in each good's cartel among realms: trade's store.)
    inCartels = new Map<number, number>();
  for (const c of cartelsNow(world).values())
    for (const m of c.members) inCartels.set(m, (inCartels.get(m) ?? 0) + 1);
  const lands = new Map<number, readonly number[]>(),
    cartelLands = new Map<number, number>(),
    killings = new Map<number, number>(),
    badge = new Map<number, number>();
  for (const p of ctx.provinces.all()) {
    const cell = p.cell,
      realm = realms.of(cell),
      r = realm && realm.ended === null ? realm.ref : null,
      sm = r ? smuggle?.get(r) : undefined,
      bar = r ? bars?.get(r) : undefined,
      ix = intox?.get(cell),
      rf = roof?.get(cell),
      gr = gangs?.get(cell);
    lands.set(cell, [
      sm ? sm[SMUGGLE.share]! / 1000 : -1,
      bar ? bar[BAR.cartel]! / 1000 : -1,
      ix ? ix[INTOX.dependent]! / 1000 : -1,
      // (Its crime is read apart, and only while it is shown: underworldCrime.)
      -1,
      rf ? rf[ROOF_ROW.street]! / 1000 : -1,
      gr ? gr[GANG_ROW.control]! / 1000 : -1,
    ]);
    // (As groupsIn reads them: killings kept in millionths of its people, a crew's working in thousandths.)
    if (gr && gr[GANG_ROW.killings]! > 0) killings.set(cell, gr[GANG_ROW.killings]! / 10);
    if (gr && gr[GANG_ROW.badge]! > 0) badge.set(cell, gr[GANG_ROW.badge]! / 1000);
    const n = r ? inCartels.get(refNumber(r)) : undefined;
    if (n) cartelLands.set(cell, n);
  }
  const read = { lands, cartelLands, killings, badge };
  KEPT.set(world, { key, read });
  return read;
}

const CRIME = new WeakMap<World, { key: string; lands: [number, number][] }>();

/** Every land's crime, as the lens's crime view colours it: what weighs on its towns' peace, weighed by their people (once a year). */
export function underworldCrime(world: World): readonly (readonly [number, number])[] {
  const key = `${yearNow(world)}|${populationContext(world).provinces.all().length}`,
    hit = CRIME.get(world);
  if (hit && hit.key === key) return hit.lands;
  const year = yearNow(world),
    lands: [number, number][] = [];
  for (const p of populationContext(world).provinces.all()) {
    const c = crimeOf(world, p.cell, year);
    if (c) lands.push([p.cell, Math.round(c.weigh * 1000) / 1000]);
  }
  CRIME.set(world, { key, lands });
  return lands;
}

/** The underworld's queries: every land's crime (the rest come with the map's other lenses, `people.map`). */
export const UNDERWORLD_QUERIES = {
  "underworld.crime": (world: World) => underworldCrime(world),
};

/** A land under the underworld lens, for the tip under the pointer: its number, its biggest causes, and the page that tells it. */
export type UnderworldReading = {
  readonly line: string;
  readonly stats: { label: string; value: string }[];
  readonly go?: { readonly ref: string; readonly words: string };
};

/** The view a lens's choice names (smuggling where it names none). */
export const underworldView = (way: string | undefined): UnderworldView =>
  (UNDERWORLD_VIEWS as readonly string[]).includes(way ?? "")
    ? (way as UnderworldView)
    : "smuggling";

/** The living realm a land is of. */
function realmOf(world: World, cell: number): Polity | undefined {
  const r = politiesOf(world).of(cell);
  return r && r.ended === null ? r : undefined;
}

/** Biggest first, what is there at all, at most `n`. */
const biggest = (xs: readonly (readonly [string, number, string])[], n = 3) =>
  [...xs]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, , value]) => ({ label, value }));

/** A land under the underworld lens, one of its five ways, broken down (null: not a land of the people). */
export function underworldReading(
  world: World,
  cell: number,
  way: string | undefined,
): UnderworldReading | null {
  if (!populationContext(world).provinces.get(cell)) return null;
  const view = underworldView(way),
    realm = realmOf(world, cell),
    treasury = realm
      ? { ref: `${realm.ref}#treasury`, words: `the Treasury of ${realmName(realm)}` }
      : undefined;
  switch (view) {
    case "smuggling": {
      const row = realm ? moneyStore(world, SMUGGLE_STORE)?.get(realm.ref) : undefined;
      if (!realm) return { line: "Smuggling: no realm here to bar or tax a thing", stats: [] };
      if (!row) return { line: `Smuggling: ${realmName(realm)} keeps no border yet`, stats: [] };
      const cartel = (moneyStore(world, BAR_STORE)?.at(realm.ref, BAR.cartel) ?? 0) / 1000,
        // (Its border's pull, as the smuggling rule weighs it: four for every land of it on a border, two for its carriers organised.)
        edge = Math.max(0, (row[SMUGGLE.border]! / 1000 - 2 * cartel) / 4);
      return {
        line: `Smuggling: ${per(row[SMUGGLE.share]!)} of what ${realmName(realm)} bars or taxes slips past`,
        stats: [
          ...biggest([
            ["What it bars or lays on", row[SMUGGLE.wedge]! / 1000, per(row[SMUGGLE.wedge]!)],
            ["Of its lands on a border", Math.min(1, edge), pc(Math.min(1, edge))],
            ["Its carriers organised", cartel, pc(cartel)],
          ]),
          ...(row[SMUGGLE.worth]! > 0
            ? [{ label: "Smuggled a year", value: grain(row[SMUGGLE.worth]!) }]
            : []),
        ],
        ...(treasury ? { go: treasury } : {}),
      };
    }
    case "cartels": {
      if (!realm) return { line: "Cartels: no realm here to forbid a thing", stats: [] };
      const row = moneyStore(world, BAR_STORE)?.get(realm.ref),
        n = refNumber(realm.ref),
        trade = [...cartelsNow(world)]
          .filter(([, c]) => c.members.has(n))
          .sort((a, b) => b[1].markup - a[1].markup || a[0] - b[0]),
        o = orderOf(world)?.of(realm.ref),
        organised = row ? row[BAR.cartel]! : 0;
      return {
        line:
          organised > 0
            ? `Cartels: those who carry what ${realmName(realm)} forbids are ${per(organised)} organised`
            : row && row[BAR.barred]! >= 100
              ? `Cartels: what ${realmName(realm)} forbids is carried, but no one has organised it`
              : `Cartels: ${realmName(realm)} forbids nothing worth carrying`,
        stats: [
          ...(row && organised > 0
            ? biggest([
                ["How far it forbids them", row[BAR.barred]! / 1000, per(row[BAR.barred]!)],
                ["Its officers bought", o?.corruption ?? 0, pc(o?.corruption ?? 0)],
                [
                  "Beyond its reach",
                  1 - capacityOf(populationContext(world), realm).value,
                  pc(1 - capacityOf(populationContext(world), realm).value),
                ],
              ])
            : []),
          ...(trade.length
            ? [
                {
                  label: "In cartels among realms",
                  value: trade
                    .slice(0, 3)
                    .map(([g, c]) => `${GOODS[g]?.name ?? "a good"} (+${pc(c.markup)})`)
                    .join(", "),
                },
              ]
            : []),
        ],
        ...(treasury ? { go: treasury } : {}),
      };
    }
    case "addiction": {
      const row = moneyStore(world, INTOX_STORE)?.get(cell),
        go = { ref: `cell:0:${cell}#wealth`, words: "its Wealth page" };
      if (!row) return { line: "Addiction: nothing they take is kept here yet", stats: [] };
      const most = INTOX_KINDS.map((k, i) => [k, row[INTOX.use + i]!] as const).sort(
          (a, b) => b[1] - a[1],
        )[0]!,
        lost = row[INTOX.lost]!,
        barred = realm ? (moneyStore(world, BAR_STORE)?.at(realm.ref, BAR.barred) ?? 0) : 0;
      return {
        line: `Addiction: ${per(row[INTOX.dependent]!)} of its people need what they take`,
        stats: [
          // (How strong what it carries is, where a ban is hunted: the underworld round, mobs.ts potencyWords.)
          ...(() => {
            const r = realmOf(world, cell),
              pw = r ? potencyWords(world, r.ref) : null;
            return pw ? [{ label: "How strong", value: pw.strength }] : [];
          })(),
          {
            label: "Who die of it a year",
            value: `${+(row[INTOX.deaths]! / 10_000).toFixed(2)}% of its people`,
          },
          ...biggest([
            [
              most[1] > 0 ? cap(`Taken: ${INTOX_WORDS[most[0]].name}`) : "Taken",
              most[1] / 1000,
              `by ${per(most[1])}`,
            ],
            ["Work lost to it", lost / 1000, per(lost)],
            ["Its realm forbids them", barred / 1000, per(barred)],
          ]),
        ],
        go,
      };
    }
    case "crime": {
      const year = yearNow(world),
        c = crimeOf(world, cell, year);
      if (!c) return { line: "Crime: no town here old enough to hold a court", stats: [] };
      const town = c.towns[0]!;
      return {
        line: `Crime: ${count(c.due)} ${c.due === 1 ? "case" : "cases"} due this year in ${c.all === 1 ? town.name : c.all === c.towns.length ? `its ${count(c.all)} towns` : `its ${count(c.towns.length)} greatest towns, of ${count(c.all)}`}`,
        stats: [
          { label: "What weighs on its peace", value: `${c.weigh.toFixed(2)} (0.50 a quiet year)` },
          ...biggest(c.pressing.map(([name, v]) => [cap(name), v, `+${v.toFixed(2)}`] as const)),
        ],
        go: { ref: `${town.ref}#law`, words: `the law at ${town.name}` },
      };
    }
    case "gangs": {
      const g = groupsIn(world, cell);
      if (!g) return { line: "Gangs: no one keeps a count of who holds it", stats: [] };
      // (The land's realm as the underworld keeps it: its groups are its realm's, ended or not.)
      const r = politiesOf(world).of(cell),
        rec = r ? underworldOf(world)?.of(r.ref) : undefined,
        group = g.group !== null ? rec?.groups.find((x) => x.id === g.group) : undefined,
        fedIds = [GANG_ROW.fedA, GANG_ROW.fedB]
          .map((i) => gangsStore(world)?.at(cell, i) ?? 0)
          .filter((x) => x > 0),
        fed = fedIds.length ? rec?.feds.find((f) => f.id === fedIds[0]! - 1) : undefined,
        kind = group ? kindOfGroup(group) : null,
        what = !group
          ? null
          : group.squad
            ? "a death squad"
            : kind === "cartel"
              ? "a cartel"
              : kind === "badge"
                ? "a badge crew"
                : "a family",
        named = group ? groupWords(group.name, kind ?? undefined) : null,
        fedNamed = fed ? `the ${fed.name} federation` : null,
        stats: { label: string; value: string }[] = [];
      if (named) stats.push({ label: cap(named), value: `${what}, holding ${pc(g.control)}` });
      if (fedNamed) stats.push({ label: cap(fedNamed), value: "a street federation" });
      stats.push({ label: "Killed a year", value: `${+g.violence.toFixed(1)} in 100,000` });
      if (g.protection > 0)
        stats.push({ label: "Trade under protection", value: pc(g.protection) });
      if (g.gangs > 0)
        stats.push({
          label: "Street gangs",
          value: `${count(g.gangs)}, pulling ${pc(g.street)} of the young`,
        });
      if (g.badge > 0)
        stats.push({ label: "Its realm's own enforcers work it", value: pc(g.badge) });
      return {
        line: named
          ? `Gangs: ${named} holds ${pc(g.control)} of it`
          : fedNamed
            ? `Gangs: no group holds it; ${fedNamed} runs its street`
            : g.gangs > 0
              ? `Gangs: no group holds it; ${count(g.gangs)} street ${g.gangs === 1 ? "gang" : "gangs"}`
              : "Gangs: no group holds it",
        stats,
        ...(r && group
          ? { go: { ref: groupRef(r.ref, group.event), words: `the page of ${named}` } }
          : r && fed
            ? { go: { ref: fedRef(r.ref, fed.event), words: `the page of ${fedNamed}` } }
            : r && rec
              ? {
                  go: {
                    ref: `${r.ref}#underworld`,
                    words: `the Underworld of ${realmName(r)}`,
                  },
                }
              : {}),
      };
    }
    case "roofless": {
      const row = societyStore(world, ROOFLESS_STORE)?.get(cell),
        go = { ref: `cell:0:${cell}#lives`, words: "its Lives page" };
      if (!row) return { line: "Without a roof: no town here keeps a count", stats: [] };
      return {
        line: `Without a roof: ${per(row[ROOF_ROW.street]!)} of its towns' people on the street`,
        stats: [
          ...biggest([
            ["Can't meet the least rent", row[ROOF_ROW.rent]!, per(row[ROOF_ROW.rent]!)],
            ["Beyond the homes raised", row[ROOF_ROW.beyond]!, per(row[ROOF_ROW.beyond]!)],
            [
              "Turned out by war, fire or flood",
              row[ROOF_ROW.displaced]!,
              per(row[ROOF_ROW.displaced]!),
            ],
            ["Who need what they take", row[ROOF_ROW.addicted]!, per(row[ROOF_ROW.addicted]!)],
            ["Frail, and kept by no one", row[ROOF_ROW.old]!, per(row[ROOF_ROW.old]!)],
          ]),
          {
            label: "Taken in",
            value: per(row[ROOF_ROW.kin]! + row[ROOF_ROW.temple]! + row[ROOF_ROW.realm]!),
          },
        ],
        go,
      };
    }
  }
}
