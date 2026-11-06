// The age of the stars, told (Phase 73, first slice): the moments this seed's history holds, read from each phase's own record and put in
// the order they happened: the first jump, the first landing, a people conquered, the first run and the first hold taken, a fleet's
// battle, a realm's greatest and its fall, a world in the dark, the fullest world, the greatest fire, what fell on a world across the
// stars. Nothing is filmed that did not happen here. Read only when the eye asks, and nothing here writes: `hashes` stands the same after.
import type { World } from "../kernel/index.ts";
import {
  arrivalsAt,
  farOf,
  filledOf,
  fireOf,
  folksNear,
  nationsOf,
  starWarsOf,
  tradeOf,
  type Folk,
} from "../sim/index.ts";
import type { LandfallPlan, StarLens, StarTour, TourStop } from "../bridge/index.ts";
import { colonyList } from "./colony.ts";
import { peopleWords as bigWords, filledList } from "./filling.ts";
import { landfallPlans } from "./landfall.ts";
import { jumpPlan } from "./lanes.ts";
import { nationMap, nationRef } from "./nations.ts";
import { starFights } from "./starfight.ts";
import type { QueryHandler } from "./host.ts";
import { many } from "./inspect/words.ts";

/** The most moments the eye goes through: a chapter each, one after another. */
const MOST = 12;

/** The landing best to watch: the earliest where those who came won, and, if those who live there ever held, the earliest of those. */
function landings(world: World): { p: LandfallPlan; f: Folk }[] {
  const out: { p: LandfallPlan; f: Folk }[] = [];
  for (const f of folksNear(world)) {
    if (!arrivalsAt(world, f).length) continue;
    for (const p of landfallPlans(world, f)) out.push({ p, f });
  }
  return out.sort((a, b) => a.p.year - b.p.year || (a.p.id < b.p.id ? -1 : 1));
}

/** The moments, the earliest first. */
export function starTour(world: World): StarTour {
  const stops: TourStop[] = [];
  // The first jump.
  const jump = jumpPlan(world);
  if (jump) {
    stops.push({
      key: "jump",
      year: jump.year,
      words: `🌀 The first jump through a lane, year ${jump.year}`,
      page: "world:law",
      film: { kind: "jump" },
      lens: "lanes",
    });
  }
  // The first landing at another star, and if none, on another world of home's.
  const colonies = colonyList(world).filter((c) => c.town && !c.sailing),
    landed =
      [...colonies]
        .filter((c) => c.star)
        .sort((a, b) => (a.arrives ?? a.founded) - (b.arrives ?? b.founded))[0] ??
      [...colonies].sort((a, b) => a.founded - b.founded)[0];
  if (landed) {
    const year = landed.arrives ?? landed.founded;
    stops.push({
      key: "landing",
      year,
      words: landed.star
        ? `🪐 The first landing at another star, year ${year}${landed.founder ? `: settlers of ${landed.founder}` : ""}`
        : `🪐 The first landing on another world, year ${year}${landed.founder ? `: settlers of ${landed.founder}` : ""}`,
      page: `cell:0:${landed.cell}`,
      film: { kind: "landing", cell: landed.cell },
      lens: null,
    });
  }
  // A people conquered, or who held; else the first meeting.
  const fought = landings(world),
    won = fought.find((x) => x.p.won),
    held = fought.find((x) => !x.p.won);
  for (const x of [won, held]) {
    if (!x) continue;
    const { p, f } = x;
    stops.push({
      key: p.won ? "conquest" : "held",
      year: p.year,
      words: p.won
        ? `⚔ A people conquered, year ${p.year}: ${p.who} came down on the ${p.natives}, ${p.stage}`
        : `⚔ A people who held, year ${p.year}: the ${p.natives} drove off ${p.who}`,
      page: f.ref,
      film: { kind: "landfall", star: p.star, index: p.index, n: p.n },
      lens: "peoples",
    });
  }
  if (!fought.length) {
    const met = folksNear(world)
      .map((f) => ({ f, a: arrivalsAt(world, f)[0] }))
      .filter((x) => x.a && x.a.found !== "ruins")
      .sort((a, b) => a.a!.year - b.a!.year)[0];
    if (met)
      stops.push({
        key: "contact",
        year: met.a!.year,
        words: `👥 The first meeting, year ${met.a!.year}: the ${met.f.name}`,
        page: met.f.ref,
        film: { kind: "contact", star: met.f.star, index: met.f.planet },
        lens: "peoples",
      });
  }
  // The first run for gain, and the first hold taken.
  const trade = tradeOf(world),
    runs = trade?.all() ?? [],
    firstRun = [...runs].sort((a, b) => a.year - b.year || (a.ref < b.ref ? -1 : 1))[0];
  if (firstRun) {
    const port = colonies.find((c) => c.cell === firstRun.to);
    if (port)
      stops.push({
        key: "run",
        year: firstRun.firstYear ?? firstRun.year,
        words: `🛰️ The first run for gain, year ${firstRun.year}: ${firstRun.name} to ${port.name ?? "a world away"}`,
        page: firstRun.ref,
        film: { kind: "port", cell: firstRun.to },
        lens: "trade",
      });
  }
  const raided = runs
    .filter((r) => r.raided > 0)
    .sort((a, b) => a.lastRaidYear - b.lastRaidYear || (a.ref < b.ref ? -1 : 1))[0];
  if (raided)
    stops.push({
      key: "raid",
      year: raided.lastRaidYear,
      words: `🏴 A run raided, year ${raided.lastRaidYear}: ${many(raided.raided, "hold", "holds")} of ${raided.name} taken${raided.raider ? ` by ${raided.raider}` : ""}`,
      page: raided.ref,
      film: { kind: "map", lens: "trade", star: raided.toStar },
      lens: null,
    });
  // A fleet's battle.
  const fights = starFights(world),
    best = fights.fights.find((x) => x.id === fights.best);
  if (best)
    stops.push({
      key: "fleet",
      year: best.year,
      words: `🚀 A fleet's battle, year ${best.year}: ${best.attacker} against ${best.defender}`,
      page: best.page,
      film: { kind: "fleet", id: best.id },
      lens: "war",
    });
  // A realm at its greatest, and its fall.
  const map = nationMap(world),
    realms = nationsOf(world)?.allNations() ?? [],
    fallen = map.fallen ? realms.find((n) => n.ref === map.fallen) : undefined,
    greatest = map.nations[0],
    realm = fallen ?? (greatest ? realms.find((n) => n.ref === greatest.ref) : undefined);
  if (realm && realm.greatest >= 2)
    stops.push({
      key: "realm",
      year: realm.fell?.year ?? realm.greatestYear,
      words: realm.fell
        ? `👑 ${realm.name} at its greatest, ${realm.greatest} worlds in year ${realm.greatestYear}, and its fall in ${realm.fell.year}`
        : `👑 ${realm.name} at its greatest: ${realm.greatest} worlds, year ${realm.greatestYear}`,
      page: nationRef(realm.ref),
      film: { kind: "nation", ref: realm.ref },
      lens: "holds",
    });
  // A world in the dark.
  const dark = (nationsOf(world)?.all() ?? [])
    .filter((h) => h.dark && filledOf(world)?.get(h.key)?.gone === undefined)
    .sort((a, b) => a.dark!.since - b.dark!.since || (a.key < b.key ? -1 : 1))[0];
  if (dark)
    stops.push({
      key: "dark",
      year: dark.dark!.since,
      words: `🌘 A world in the dark, year ${dark.dark!.since}: cut off, with ${bigWords(dark.dark!.before)} on it`,
      page: dark.key,
      film: { kind: "world", star: dark.star as string, planet: dark.planet },
      lens: "holds",
    });
  // A world settled to the fullest.
  const filled = filledList(world).filter((p) => p.star && p.people > 0)[0];
  if (filled)
    stops.push({
      key: "filled",
      year: filled.year,
      words: `🌆 The fullest of the worlds settled: ${bigWords(filled.people)}, first come to in year ${filled.year}`,
      page: filled.ref,
      film: { kind: "filled", key: filled.key },
      lens: "peoples",
    });
  // The greatest fire, on a town of the home world.
  const fire = world.hasStore("war.fire") ? fireOf(world).state.falls[0] : undefined;
  if (fire)
    stops.push({
      key: "fire",
      year: fire.year,
      words: `☢️ The greatest fire falling, year ${fire.year}`,
      page: fire.event,
      film: { kind: "fire", event: fire.event },
      lens: "war",
    });
  // What fell on a world across the stars: the first of each rung, the worst first if there is no room.
  const falls = world.hasStore("war.fire") ? (farOf(world)?.falls ?? []) : [];
  for (const [rung, sign, words] of [
    ["world", "🌑", "A world unmade"],
    ["sky", "🌫️", "A sky burned"],
    ["carried", "☄️", "A fire carried to another world"],
  ] as const) {
    const f = falls.find((x) => x.rung === rung);
    if (f)
      stops.push({
        key: `far-${rung}`,
        year: f.year,
        words: `${sign} ${words}, year ${f.year}${f.name ? `, by ${f.name}` : ""}`,
        page: f.event,
        film: { kind: "far", event: f.event },
        lens: "war",
      });
  }
  // (More than can be shown: the lesser let go, in this order, each a chapter some other tells as well.)
  const LESSER = ["held", "filled", "far-carried", "contact", "dark", "run"];
  for (const key of LESSER) {
    if (stops.length <= MOST) break;
    const at = stops.findIndex((s) => s.key === key);
    if (at >= 0) stops.splice(at, 1);
  }
  stops.sort((a, b) => a.year - b.year || (a.key < b.key ? -1 : 1));
  // The map's lenses worth a look, once this world has come to another star.
  const lenses: StarLens[] = [];
  const reached = colonies.some((c) => c.star) || (filledOf(world)?.all().length ?? 0) > 0;
  if (reached) {
    if (map.stars.length) lenses.push("holds");
    if (runs.length) lenses.push("trade");
    if (world.hasStore("space.starwars") && starWarsOf(world).all().length) lenses.push("war");
    lenses.push("lanes", "peoples");
  }
  return { stops, lenses };
}

export const TOUR_QUERIES: Readonly<Record<string, QueryHandler>> = {
  "star.tour": (world) => starTour(world),
};

