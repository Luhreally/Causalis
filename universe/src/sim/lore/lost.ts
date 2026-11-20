// Knowledge that can be lost (K1, classic 81 and 106). A land that loses most of its people can lose what only many hands
// held: read off how deep the craft lies, how many are left who could hold it, and whether anything still stands on it,
// for no one loses the iron under a steel they still make. What a people keeps things in holds what went, and stays when
// they go: a fallen town's archive is there for whoever comes. And a land that came through a quake or a long dry age
// can come to what only that teaches. Only the lands that fell are read; a land that has lost nothing keeps nothing here.
import {
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef, meansOfWorld } from "../../gen/index.ts";
import {
  PRINCIPLES,
  PRINCIPLE_DEPTH,
  PRINCIPLE_INDEX,
  RESTS_ON,
  SEEN_TREE,
  affordsPrinciple,
  needsMet,
  reachIn,
  type CivicKind,
  type Principle,
} from "../../rules/index.ts";
import { politiesOf } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import type { Settlement } from "../population/stores.ts";
import { townsOf } from "../town/fabric.ts";
import { knows, loreOf } from "./lore.ts";
import {
  FALL_LEAST,
  HOLD_STEP,
  LostStore,
  READ_HANDS,
  RETAKE_AFTER,
  handsHolding,
  holdsAgain,
  isHive,
  lostOf,
  needOfHands,
  type Archive,
  type CraftBack,
  type KeepForm,
  type LostCraft,
  type LostWhy,
} from "./lost-store.ts";

export const LOST_EVENTS = {
  /** A land's crafts gone: below what history keeps for ever. */
  lost: defineEventType("lore.lost", 3),
  /** What it could be kept in, begun. */
  kept: defineEventType("lore.kept", 3),
  /** A land has what it lost again, from what was kept. */
  read: defineEventType("lore.read", 3),
  /** No one living holds it. */
  lostWorld: defineEventType("lore.lost-world", 5),
  /** Someone has it who no one could have taught. */
  foundAgain: defineEventType("lore.found-again", 5),
  /** Those who came to a land that had lost it brought it with them. */
  brought: defineEventType("lore.brought", 2),
};

const LOSE = defineStream("lore.lose");
const READ = defineStream("lore.read");
const SEE = defineStream("lore.see");

/** How far back a land's ledger is read for what it was. */
const FALL_YEARS = 10;
/** How readily, in a year, a land fallen all the way loses a craft that wants far more hands than it has. */
export const LOSE_RATE = 0.5;
/** What keeping does to that: a people that keeps things loses them less readily, and so do those with someone near who has it. */
export const KEPT_HOLDS = 0.6,
  NEAR_HOLDS = 0.6;
/** How readily, in a year, those with the hands find a craft again in what was kept: far sooner than from nothing. */
export const READ_RATE: Readonly<Record<KeepForm, number>> = {
  brood: 0.12,
  reef: 0.08,
  written: 0.08,
  reciters: 0.05,
  songs: 0.03,
};
/** How long each holds what it holds (years): a record lies; a song drifts. */
export const KEEP_YEARS: Readonly<Record<KeepForm, number>> = {
  brood: 2000,
  reef: 2000,
  written: 1200,
  reciters: 300,
  songs: 200,
};
/** How deep a song can carry: past this a craft is too much for any song. */
export const SONGS_REACH = 10;
/** How soon those who come to a fallen land can bring back what it lost, and how many more than were left it takes. */
export const BROUGHT_AFTER = 3,
  BROUGHT_MANY = 2;
/** Who keep things, in the order they are looked for. */
const KEEPERS: readonly CivicKind[] = [
  "academy",
  "school",
  "observatory",
  "hall",
  "temple",
  "shrine",
];
/** How readily a land that came through a thing comes to what it teaches, in the year after. */
export const SEEN_RATE = 0.25;
/** A long dry age: a drought now, and at least this many of the last ten years hungry. */
const DRY_YEARS = 5;

/** What was lost in a fall's years, and what caused it: events that fall a land, kept in what's told first. */
const FALL_TYPES: readonly (readonly [string, LostWhy])[] = [
  ["war.strike", "strike"],
  ["war.taken", "war"],
  ["act.meteor", "stone"],
  ["act.quake", "quake"],
  ["health.outbreak", "plague"],
  ["health.rose", "plague"],
  ["people.famine", "hunger"],
  ["act.fire", "fire"],
  ["wild.fire", "fire"],
  ["act.flood", "flood"],
  ["war.battle", "war"],
];
const FALL_WHY: ReadonlyMap<string, LostWhy> = new Map(FALL_TYPES);
const FALL_ORDER: ReadonlyMap<string, number> = new Map(FALL_TYPES.map(([t], i) => [t, i]));

/** The people a land had, within its ledger's last ten years. */
function peopleBefore(ctx: PopulationContext, cell: number): number {
  const lines = ctx.history.yearsOf(cell),
    n = lines.length;
  if (!n) return 0;
  let most = lines[n - 1]!.population;
  if (n > 3) most = Math.max(most, lines[n - 4]!.population);
  if (n > 6) most = Math.max(most, lines[n - 7]!.population);
  if (n > 10) most = Math.max(most, lines[n - 11]!.population);
  return most;
}

/**
 * The people a land had and kept: the most, at any year of its ledger's last ten, that it had held through the ten years before
 * that one. Those who came within ten years are not yet the hands its crafts lie in (the same ten years a craft must have been
 * held for a fall to take it: FALL_YEARS), and those who go are the last who came: a land swollen for some years by the fled,
 * by settlers its soil could not keep, or by a host's captives held at its seat, and back to what it was, has lost none of the
 * hands that held anything. Never more than `peopleBefore`; the same where a land has not grown.
 */
export function keptBefore(populations: readonly number[]): number {
  const n = populations.length;
  let most = 0;
  for (let s = n - 1; s >= 0 && s >= n - 1 - FALL_YEARS; s--) {
    let least = populations[s]!;
    for (let j = s - 1; j >= 0 && j >= s - FALL_YEARS && least > most; j--)
      if (populations[j]! < least) least = populations[j]!;
    if (least > most) most = least;
  }
  return most;
}

/** Why a land fell: the worst of what happened to it in these years, and its event. */
function whyFell(
  world: World,
  place: Ref,
  since: number,
  cache: { walked: Map<string, { ref: Ref; type: string }[]> | null },
): { why: LostWhy; cause: Ref | null } {
  if (!cache.walked) {
    const walked = new Map<string, { ref: Ref; type: string }[]>(),
      log = world.events;
    for (let i = log.count - 1; i >= 0; i--) {
      const e = log.at(i);
      if (e.t < since) break;
      if (!e.place || !FALL_WHY.has(e.type)) continue;
      const list = walked.get(e.place);
      if (list) list.push({ ref: e.id, type: e.type });
      else walked.set(e.place, [{ ref: e.id, type: e.type }]);
    }
    cache.walked = walked;
  }
  let best: { ref: Ref; type: string } | null = null;
  for (const c of cache.walked.get(place) ?? [])
    if (!best || FALL_ORDER.get(c.type)! < FALL_ORDER.get(best.type)!) best = c;
  return best ? { why: FALL_WHY.get(best.type)!, cause: best.ref } : { why: "left", cause: null };
}

/** The town and building a land's people keep things in, and in what: read off what they are. */
export function keeperOf(
  ctx: PopulationContext,
  cell: number,
): {
  form: KeepForm;
  town: Settlement;
  civic: CivicKind | null;
  at: number;
} | null {
  const towns = ctx.settlements.inProvince(cell);
  if (!towns.length) return null;
  const biggest = [...towns].sort(
      (a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1),
    )[0]!,
    body = ctx.generated.life.people?.body;
  if (isHive(ctx)) return { form: "brood", town: biggest, civic: null, at: -1 };
  if (body?.medium === "water") return { form: "reef", town: biggest, civic: null, at: -1 };
  const lore = loreOf(ctx.world),
    written = lore.effect(cell, "writing") > 0,
    fabrics = townsOf(ctx.world);
  if (written) {
    for (const kind of KEEPERS)
      for (const s of [...towns].sort(
        (a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1),
      )) {
        const c = fabrics.get(s.ref)?.civics.find((x) => x.kind === kind && x.fell === null);
        if (c) return { form: "written", town: s, civic: kind, at: c.at };
      }
    // (Letters and no house for them: those who hold it by heart, if they choose their own.)
    return politiesOf(ctx.world).of(cell)
      ? null
      : { form: "reciters", town: biggest, civic: null, at: -1 };
  }
  return { form: "songs", town: biggest, civic: null, at: -1 };
}

/** The peopled lands next to a land, by land and by its ships. */
function nearLands(ctx: PopulationContext, cell: number): number[] {
  const g = ctx.generated,
    out: number[] = [],
    from = g.grid.offsets[cell],
    to = g.grid.offsets[cell + 1];
  if (from !== undefined && to !== undefined)
    for (let k = from; k < to; k++) out.push(g.grid.neighbours[k]!);
  for (const n of ctx.world.store<MarketStore>("economy.markets").seaPartners(cell)) out.push(n);
  return out.filter((n) => (ctx.provinces.get(n)?.total() ?? 0) > 0);
}

type Fallen = {
  readonly cell: number;
  readonly now: number;
  readonly then: number;
};

/** A land's fall this year: who it loses, deepest first, what still stands on it held up by that. */
function loseFrom(
  ctx: PopulationContext,
  t: SimTime,
  f: Fallen,
  lost: LostStore,
  cache: { walked: Map<string, { ref: Ref; type: string }[]> | null },
  touched: Set<string>,
): void {
  const { world } = ctx,
    lore = loreOf(world),
    prov = ctx.provinces.get(f.cell)!,
    year = yearOfMoment(t),
    emptied = f.now === 0,
    fall = 1 - f.now / Math.max(1, f.then),
    held = lore.of(f.cell).map(([id, k]) => ({ p: PRINCIPLES[PRINCIPLE_INDEX.get(id)!]!, k })),
    near = emptied ? [] : nearLands(ctx, f.cell);
  // (A keeper read before the fall's own words: what stood is what holds it.)
  const keeper = keeperOf(ctx, f.cell),
    keptChance = keeper ? KEPT_HOLDS : 1,
    goneNow = new Set<string>(),
    still = (id: string) => !goneNow.has(id) && knows(ctx, f.cell, id),
    going: { p: Principle; since: number; hands: number; need: number }[] = [];
  held.sort(
    (a, b) =>
      (PRINCIPLE_DEPTH.get(b.p.id) ?? 0) - (PRINCIPLE_DEPTH.get(a.p.id) ?? 0) ||
      PRINCIPLE_INDEX.get(a.p.id)! - PRINCIPLE_INDEX.get(b.p.id)!,
  );
  for (const { p, k } of held) {
    const hands = handsHolding(ctx, prov, p),
      need = needOfHands(p);
    if (!emptied) {
      if (hands >= need) continue;
      // (What they took up since it fell isn't what the fall took: the ledger still says it fell for ten years.)
      if (year - k.year <= FALL_YEARS) continue;
      // (Nothing goes from under what still stands on it: no one loses the iron under a steel they still make.)
      const rests = RESTS_ON.get(p.id);
      if (rests?.some((q) => still(q.id) && !needsMet(q, (x) => x !== p.id && still(x)))) continue;
      const nearly = near.some((n) => lore.get(n, p.id)),
        chance = LOSE_RATE * fall * (1 - hands / need) * keptChance * (nearly ? NEAR_HOLDS : 1);
      if (!(world.rng.real(LOSE, f.cell, t, PRINCIPLE_INDEX.get(p.id)!) < chance)) continue;
    }
    goneNow.add(p.id);
    going.push({ p, since: k.year, hands, need });
  }
  if (!going.length) return;
  const place = prov.ref,
    { why, cause } =
      emptied && f.then === 0
        ? { why: "left" as LostWhy, cause: null }
        : whyFell(world, place, t - 12 * YEAR, cache),
    cited: CauseRef[] = cause ? [{ ref: cause, role: "trigger", weight: 1 }] : [],
    event = world.events.emit({
      type: LOST_EVENTS.lost.type,
      place,
      causes: cited,
      data: {
        crafts: going.slice(0, 8).map((g) => g.p.id),
        n: going.length,
        then: Math.round(f.then),
        left: Math.round(f.now),
        why: emptied && why === "left" ? "emptied" : why,
      },
    });
  let archive: Archive | null = null;
  for (const g of going) {
    lore.forget(f.cell, g.p.id);
    touched.add(g.p.id);
    const depth = PRINCIPLE_DEPTH.get(g.p.id) ?? 0,
      keeps = keeper && (keeper.form !== "songs" || (depth <= SONGS_REACH && !emptied));
    if (keeps && !archive) {
      archive = lost.archiveFor({
        cell: f.cell,
        town: keeper.town.ref,
        name: keeper.town.name,
        form: keeper.form,
        civic: keeper.civic,
        at: keeper.at,
        year,
        event: world.events.emit({
          type: LOST_EVENTS.kept.type,
          place,
          subjects: [keeper.town.ref],
          causes: [{ ref: event, role: "trigger", weight: 1 }],
          data: {
            town: keeper.town.name,
            form: keeper.form,
            civic: keeper.civic,
            crafts: going.length,
          },
        }),
      });
    }
    if (keeps && archive) lost.keep(archive, g.p.id);
    lost.addLoss({
      id: g.p.id,
      cell: f.cell,
      year,
      event,
      why: emptied && why === "left" ? "emptied" : why,
      cause,
      then: Math.round(f.then),
      left: Math.round(f.now),
      hands: Math.round(g.hands),
      need: Math.round(g.need),
      others: lore.landsKnowing(g.p.id),
      kept: keeps && archive ? archive.n : null,
      since: g.since,
      back: null,
    });
  }
}

/** What has come back to the lands that lost it: the event it came by says how, and from where. */
function settleBacks(ctx: PopulationContext, lost: LostStore): void {
  const { world } = ctx,
    lore = loreOf(world);
  for (const l of lost.allOpen()) {
    const k = lore.get(l.cell, l.id);
    if (!k) continue;
    const e = world.events.get(k.event),
      read = e?.type === LOST_EVENTS.read.type,
      brought = e?.type === LOST_EVENTS.brought.type,
      from = read || brought ? ((e!.data as { from?: number } | null)?.from ?? null) : null,
      back: CraftBack = {
        year: k.year,
        how: read ? "kept" : brought ? "brought" : e?.type === "lore.found" ? "found" : "taught",
        from,
        kept: read ? ((e!.data as { archive?: number } | null)?.archive ?? null) : null,
        event: k.event,
      };
    lost.closeLoss(l, back);
  }
}

/**
 * Those who have moved into a land that lost a craft bring what they know, all at once, shallowest first: a land emptied and filled again is
 * filled by people from next door, and they did not forget on the way. So too a land grown back to what it was, among those who have it.
 */
function broughtIn(ctx: PopulationContext, t: SimTime, lost: LostStore, year: number): void {
  const { world, generated: g } = ctx,
    lore = loreOf(world),
    means = meansOfWorld(g);
  for (const cell of lost.lands()) {
    const prov = ctx.provinces.get(cell),
      now = prov?.total() ?? 0;
    if (!prov || !now) continue;
    const ready = [...lost.ofLand(cell)!.values()]
      .filter((l) => year - l.year >= BROUGHT_AFTER && now >= BROUGHT_MANY * Math.max(1, l.left))
      .sort(
        (a, b) =>
          (PRINCIPLE_DEPTH.get(a.id) ?? 0) - (PRINCIPLE_DEPTH.get(b.id) ?? 0) ||
          PRINCIPLE_INDEX.get(a.id)! - PRINCIPLE_INDEX.get(b.id)!,
      );
    if (!ready.length) continue;
    const near = nearLands(ctx, cell),
      come: { l: LostCraft; p: Principle; from: number }[] = [],
      coming = new Set<string>(),
      has = (x: string) => coming.has(x) || knows(ctx, cell, x);
    for (const l of ready) {
      const p = PRINCIPLES[PRINCIPLE_INDEX.get(l.id)!]!;
      if (!holdsAgain(ctx, prov, p, l.then)) continue;
      const from = near.find((n) => lore.get(n, l.id));
      if (from === undefined || lore.get(cell, l.id) || !needsMet(p, has)) continue;
      if (!affordsPrinciple(p, ctx.medium, reachIn(means, has), means.wants)) continue;
      come.push({ l, p, from });
      coming.add(l.id);
    }
    if (!come.length) continue;
    const event = world.events.emit({
      type: LOST_EVENTS.brought.type,
      place: prov.ref,
      causes: [{ ref: come[0]!.l.event, role: "enabler", weight: 1 }],
      data: {
        crafts: come.slice(0, 8).map((c) => c.l.id),
        n: come.length,
        from: come[0]!.from,
      },
    });
    for (const c of come) lore.learn(cell, c.l.id, { year, event }, c.p);
  }
  void t;
}

/** Whoever can read what was kept comes to it again. */
function readArchives(ctx: PopulationContext, t: SimTime, lost: LostStore, year: number): void {
  const { world, generated: g } = ctx,
    lore = loreOf(world),
    means = meansOfWorld(g);
  for (const a of [...lost.liveArchives()]) {
    const home = ctx.provinces.get(a.cell)?.total() ?? 0;
    if (
      year - a.year > KEEP_YEARS[a.form] ||
      (!home && (a.form === "songs" || a.form === "reciters"))
    ) {
      lost.fade(a, year);
      continue;
    }
    // Those there, and a written or grown record's neighbours, who may come to it.
    const readers = [
      ...(home ? [a.cell] : []),
      ...(a.form === "songs" ? [] : nearLands(ctx, a.cell)),
    ];
    let wanting = false;
    for (const id of a.crafts) {
      const p = PRINCIPLES[PRINCIPLE_INDEX.get(id)!]!;
      if (lore.get(a.cell, id) && a.read.some((r) => r.id === id)) continue;
      if (!lore.get(a.cell, id)) wanting = true;
      for (const cell of readers) {
        if (lore.get(cell, id)) continue;
        const prov = ctx.provinces.get(cell)!;
        const had = lost.ofLand(cell)?.get(id);
        if (had && year - had.year < RETAKE_AFTER) continue;
        // (Whoever lost it, when they are enough of what they were; anyone else, with hands enough to read it.)
        if (
          !(had && holdsAgain(ctx, prov, p, had.then)) &&
          handsHolding(ctx, prov, p) < Math.min(needOfHands(p), READ_HANDS)
        )
          continue;
        if (!needsMet(p, (x) => knows(ctx, cell, x))) continue;
        const reach = reachIn(means, (n) => knows(ctx, cell, n));
        if (!affordsPrinciple(p, ctx.medium, reach, means.wants)) continue;
        if (
          !(world.rng.real(READ, cell, t, PRINCIPLE_INDEX.get(id)! + a.n * 400) < READ_RATE[a.form])
        )
          continue;
        const event = world.events.emit({
          type: LOST_EVENTS.read.type,
          place: prov.ref,
          subjects: [a.town],
          causes: [{ ref: a.event, role: "enabler", weight: 1 }],
          data: {
            principle: id,
            archive: a.n,
            from: a.cell,
            town: a.name,
            form: a.form,
            civic: a.civic,
          },
        });
        lore.learn(cell, id, { year, event }, p);
        lost.read(a, { id, cell, year, event });
        break;
      }
    }
    if (!wanting) lost.rest(a);
  }
}

/** Who is left in the world that holds what any land lost this year; who has come to what no one held. */
function worldLosses(
  ctx: PopulationContext,
  lost: LostStore,
  year: number,
  touched: ReadonlySet<string>,
): void {
  const { world } = ctx,
    lore = loreOf(world);
  for (const w of lost.worldLosses()) {
    if (!lore.landsKnowing(w.id)) continue;
    const cell = lore.knowers(w.id)[0]!,
      k = lore.get(cell, w.id)!,
      event = world.events.emit({
        type: LOST_EVENTS.foundAgain.type,
        place: cellRef(0, cell),
        causes: [
          { ref: k.event, role: "trigger", weight: 1 },
          { ref: w.event, role: "enabler", weight: 0.5 },
        ],
        data: { principle: w.id, lostIn: w.year, years: year - w.year },
      });
    lost.closeWorldLoss(w, { year, cell, event });
  }
  for (const id of [...touched].sort((a, b) => (a < b ? -1 : 1))) {
    if (lore.landsKnowing(id) > 0 || lost.worldLoss(id)) continue;
    const list = lost.losses(id),
      last = list[0];
    if (!last) continue;
    const p = PRINCIPLES[PRINCIPLE_INDEX.get(id)!]!,
      deep = (PRINCIPLE_DEPTH.get(id) ?? 0) >= GREAT_DEPTH,
      kept = lost.archives.some((a) => a.faded === null && a.crafts.includes(id));
    const event = world.events.emit({
      type: LOST_EVENTS.lostWorld.type,
      // (The greatest of them is news no one should read in a corner.)
      importance: deep && !kept ? 6 : 5,
      place: cellRef(0, last.cell),
      causes: [{ ref: last.event, role: "trigger", weight: 1 }],
      data: { principle: p.id, kept },
    });
    lost.addWorldLoss({ id, year, event, last: last.cell, lastEvent: last.event, found: null });
  }
}

/** How deep a craft lies for its going, kept nowhere, to come as a window. */
export const GREAT_DEPTH = 6;

/** Those that came through what only that teaches. */
function seenYear(ctx: PopulationContext, t: SimTime, year: number): void {
  const { world } = ctx,
    lore = loreOf(world),
    means = meansOfWorld(ctx.generated),
    log = world.events,
    since = t - YEAR;
  for (let i = log.count - 1; i >= 0; i--) {
    const e = log.at(i);
    if (e.t < since) break;
    const kind =
      e.type === "act.quake"
        ? ("quake" as const)
        : e.type === "weather.drought"
          ? ("dry" as const)
          : null;
    if (!kind || !e.place) continue;
    const prov = ctx.provinces.all().find((p) => p.ref === e.place);
    if (!prov || !prov.total()) continue;
    const cell = prov.cell;
    for (const p of SEEN_TREE) {
      if (p.seen !== kind || lore.get(cell, p.id)) continue;
      if (!needsMet(p, (x) => knows(ctx, cell, x))) continue;
      const reach = reachIn(means, (n) => knows(ctx, cell, n));
      if (!affordsPrinciple(p, ctx.medium, reach, means.wants)) continue;
      if (kind === "dry") {
        const lines = ctx.history.yearsOf(cell).slice(-10);
        if (lines.filter((y) => y.fed < 950).length < DRY_YEARS) continue;
      }
      const had = lost(world).ofLand(cell)?.get(p.id);
      if (had && year - had.year < RETAKE_AFTER) continue;
      if (!(world.rng.real(SEE, cell, t, PRINCIPLE_INDEX.get(p.id)!) < SEEN_RATE)) continue;
      const decision = world.decisions.record({
          rule: "lore.see",
          subject: prov.ref,
          outcome: { principle: p.id },
          score: SEEN_RATE,
          threshold: 0,
          factors: [
            {
              name: kind === "quake" ? "the ground shook here" : "the years it went dry here",
              value: 1,
              contribution: 1,
              source: { ref: e.id, role: "trigger", weight: 1 },
            },
          ],
        }),
        found = world.events.emit({
          type: "lore.found",
          place: prov.ref,
          causes: [{ ref: decision, role: "trigger", weight: 1 }],
          data: { principle: p.id, seen: e.id },
        });
      lore.learn(cell, p.id, { year, event: found }, p);
    }
  }
}

const lost = (world: World): LostStore => lostOf(world);

/** The year of what falls, what's kept, and what comes back. */
export function lostYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = lostOf(world),
    lore = loreOf(world),
    year = yearOfMoment(t),
    touched = new Set<string>(),
    cache: { walked: Map<string, { ref: Ref; type: string }[]> | null } = { walked: null };
  settleBacks(ctx, store);
  readArchives(ctx, t, store, year);
  broughtIn(ctx, t, store, year);
  for (const prov of ctx.provinces.all()) {
    const cell = prov.cell;
    if (!lore.sizeOf(cell)) continue;
    const now = prov.total(),
      then = peopleBefore(ctx, cell);
    if (now > 0 && now >= then * (1 - FALL_LEAST)) continue;
    // (Fallen from its most: but only against those it had kept is anything of its crafts gone. An emptied land lost them all.)
    const kept = now > 0 ? keptBefore(ctx.history.yearsOf(cell).map((l) => l.population)) : then;
    if (now > 0 && now >= kept * (1 - FALL_LEAST)) continue;
    loseFrom(ctx, t, { cell, now, then: kept }, store, cache, touched);
  }
  worldLosses(ctx, store, year, touched);
  seenYear(ctx, t, year);
  store.prune(year);
}

/** Teach a peopled world what can be lost. */
export function installLost(world: World, ctx: () => PopulationContext): LostStore {
  const store = world.register(new LostStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "158.lore.lost", every: YEAR, run: (t) => lostYear(ctx(), t) });
  return store;
}

export { FALL_LEAST, HOLD_STEP };
export type { LostCraft };
