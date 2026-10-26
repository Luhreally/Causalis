// Met people go to war (Phase 55 M225). History keeps each battle's men by the land and the town they
// came from (the battle's record, sim/war/fell.ts): those sent, their fallen, their wounded who lived.
// A man the observer has met is drawn into the battles his land fought while he was of fighting age:
// levied by his land's share of its fighting men sent, then falling, or coming home wounded (and of
// the wounded, maimed by the side's share) or whole. Each fate is claimed from the tally of the place
// he was sent from (his town's, his land's countryside's, or the land's whole where its towns were
// let go), and drawn from what that tally leaves unclaimed by those met before him, so no more of the
// met went, fell, came home hurt or came home whole than history holds. Followed forward, a man who
// falls claims his death from the death ledger as any other death. Met for the first time, his past
// wars are drawn as well, but only as one who came home: he is alive to be met. Every draw is on the
// observer's life stream (purposes 70–77), and nothing here is hashed into history. A battle of an
// older save, with no record of its men, sends no one.
import type { Ref, World } from "../kernel/index.ts";
import { MALE, bandOf, unpackTowns, type LandFell } from "../rules/index.ts";
import { fighting, poolOf, warsOf, type PopulationContext } from "../sim/index.ts";
import type { ObserverLedger, Person } from "./observer.ts";

/** A battle a met man went to, and how he came home, or did not. */
export type WarFate = {
  readonly event: Ref;
  readonly war: Ref;
  readonly year: number;
  readonly side: 0 | 1;
  /** Where the battle was fought. */
  readonly land: number;
  /** The land he was sent from. */
  readonly cell: number;
  /** His town's index among its land's settlements; null: the countryside, or the land whole. */
  readonly town: number | null;
  readonly fate: "stood" | "hurt" | "maimed" | "fell";
};

/** How far back a man met is asked which battles he came home from (within the town tallies kept). */
export const WAR_PAST_YEARS = 39;

/** The observer's life-stream purposes for war (its moves use 1–64; 75 would be a past fall, never drawn). */
export const WAR_DRAWS = {
  levy: 70,
  fell: 71,
  hurt: 72,
  maimed: 73,
  pastLevy: 74,
  pastHurt: 76,
  pastMaimed: 77,
} as const;

/** One land's part in one side of a battle, as a met man of that land is drawn into it. */
export type Front = {
  readonly event: Ref;
  readonly war: Ref;
  /** The battle event's number: what its draws are keyed by. */
  readonly n: number;
  readonly year: number;
  readonly side: 0 | 1;
  /** Where the battle was fought. */
  readonly land: number;
  /** The land's tally: its cell, sent, fallen, wounded who lived and (while kept) its towns'. */
  readonly fell: LandFell;
  /** Of the side's wounded who lived, the share maimed (0 where unrecorded). */
  readonly maimed: number;
};

/** The battles of some years, by year and by the land that sent men; each land's fighting men, memoized. */
export type Fronts = {
  readonly byYear: ReadonlyMap<number, ReadonlyMap<number, readonly Front[]>>;
  /** A land's fighting men in a year, by `${cell}:${year}` (filled as asked). */
  readonly men: Map<string, number>;
};

type Tally = readonly [sent: number, dead: number, hurt: number];
/** Where a man was sent from: his town (its index), his land's countryside ("c"), or the land whole ("l"). */
type Place = number | "c" | "l";

/** The number of an event `ev:<a>:<n>`. */
function eventNumber(event: Ref): number {
  return Number(event.split(":")[2]);
}

/** The battles fought in the years [from, to) that kept a record of their men: one front for each land of each side. */
export function warFronts(world: World, from: number, to: number): Fronts {
  const byYear = new Map<number, Map<number, Front[]>>();
  if (from < to && world.storeNames().includes("war.wars"))
    for (const w of warsOf(world).all())
      for (const b of w.battles) {
        if (!b.fell || b.year < from || b.year >= to) continue;
        const n = eventNumber(b.event);
        let cells = byYear.get(b.year);
        if (!cells) byYear.set(b.year, (cells = new Map()));
        for (const side of [0, 1] as const) {
          const wounded = b.wounded?.[side] ?? 0,
            maimed = wounded > 0 ? (b.maimed?.[side] ?? 0) / wounded : 0;
          for (const fell of b.fell[side]) {
            let list = cells.get(fell[0]);
            if (!list) cells.set(fell[0], (list = []));
            list.push({
              event: b.event,
              war: w.ref,
              n,
              year: b.year,
              side,
              land: b.land,
              fell,
              maimed,
            });
          }
        }
      }
  for (const cells of byYear.values())
    for (const list of cells.values()) list.sort((p, q) => p.n - q.n || p.side - q.side);
  return { byYear, men: new Map() };
}

/** The key of a war claim on a place's tally: "l" levied (of its sent), "w" fell (of its dead), "h" wounded (of its hurt). */
export function warClaimKey(
  kind: "l" | "w" | "h",
  event: Ref,
  side: 0 | 1,
  cell: number,
  place: number | "c" | "l",
): string {
  const [, a, n] = event.split(":");
  return `${kind}:${a}:${n}:${side}:${cell}:${place}`;
}

/** The tally of the place a man was sent from (`town`: his town's index, or null: the countryside). */
function placeOf(fell: LandFell, town: number | null): { place: Place; tally: Tally } {
  const towns = fell[4];
  // (Its towns let go: the land whole.)
  if (towns === undefined) return { place: "l", tally: [fell[1], fell[2], fell[3]] };
  const kept = unpackTowns(towns);
  if (town !== null) return { place: town, tally: kept[town] ?? [0, 0, 0] };
  const country: [number, number, number] = [fell[1], fell[2], fell[3]];
  for (const [sent, dead, hurt] of kept) {
    country[0] -= sent;
    country[1] -= dead;
    country[2] -= hurt;
  }
  return { place: "c", tally: country };
}

/**
 * How many units a war claim may take: the count of its place's tally that it claims from (a town key
 * whose battle has since let its towns go: the land's, a superset); 0 for a battle history no longer holds.
 */
export function warClaimLimit(world: World, key: string): number {
  const [kind, a, n, s, c, p] = key.split(":");
  if (kind !== "l" && kind !== "w" && kind !== "h") return 0;
  if (!world.storeNames().includes("war.wars")) return 0;
  const event = `ev:${a}:${n}`,
    side = s === "1" ? 1 : 0,
    cell = Number(c);
  for (const w of warsOf(world).all())
    for (const b of w.battles) {
      if (b.event !== event) continue;
      const land = b.fell?.[side].find((l) => l[0] === cell);
      if (!land) return 0;
      const { tally } =
        p === "l" || land[4] === undefined
          ? placeOf([land[0], land[1], land[2], land[3]], null)
          : placeOf(land, p === "c" ? null : Number(p));
      return kind === "l" ? tally[0] : kind === "w" ? tally[1] : tally[2];
    }
  return 0;
}

/** A land's people in a past year, from its yearly ledger line (the last year at or before it). */
function peopleAt(ctx: PopulationContext, cell: number, year: number): number {
  const years = ctx.history.yearsOf(cell);
  for (let i = years.length - 1; i >= 0; i--)
    if (years[i]!.year <= year) return Math.max(1, years[i]!.population);
  return Math.max(1, ctx.provinces.get(cell)?.total() ?? 1);
}

/** Of the world's people now, the share who are its fighting men (for a land no one lives in now). */
function worldShare(ctx: PopulationContext, year: number): number {
  let men = 0,
    people = 0;
  for (const p of ctx.provinces.all()) {
    const total = p.total();
    if (total <= 0) continue;
    men += poolOf(ctx, p.cell, year).men;
    people += total;
  }
  return people > 0 ? men / people : 0;
}

/**
 * A land's fighting men in a year: its people then, by the share of them who are its fighting men now
 * (a land no one lives in now: by the world's share, not as if it had one man).
 */
function menOf(ctx: PopulationContext, fronts: Fronts, cell: number, year: number): number {
  const key = `${cell}:${year}`;
  let men = fronts.men.get(key);
  if (men === undefined) {
    const total = ctx.provinces.get(cell)?.total() ?? 0,
      people = peopleAt(ctx, cell, year);
    men = Math.max(
      1,
      Math.round(
        total > 0 ? (people * poolOf(ctx, cell, year).men) / total : people * worldShare(ctx, year),
      ),
    );
    fronts.men.set(key, men);
  }
  return men;
}

/** The claim keys of a man's place in a front. */
function keysOf(f: Front, cell: number, place: Place): { l: string; w: string; h: string } {
  return {
    l: warClaimKey("l", f.event, f.side, cell, place),
    w: warClaimKey("w", f.event, f.side, cell, place),
    h: warClaimKey("h", f.event, f.side, cell, place),
  };
}

/**
 * What a place's tally leaves unclaimed by the men met before: of its fallen, of its wounded who lived,
 * and of the rest who came home whole (together: its sent, less those met who went).
 */
function roomOf(
  ledger: ObserverLedger,
  keys: { l: string; w: string; h: string },
  tally: Tally,
): { fell: number; hurt: number; stood: number } {
  const [sent, dead, hurt] = tally,
    l = ledger.claimed(keys.l),
    w = ledger.claimed(keys.w),
    h = ledger.claimed(keys.h);
  return {
    fell: Math.max(0, dead - w),
    hurt: Math.max(0, hurt - h),
    stood: Math.max(0, sent - dead - hurt - (l - w - h)),
  };
}

/** Whether a man of this age is of the levy: grown, and of the ages that fight. */
function ofFightingAge(ctx: PopulationContext, age: number): boolean {
  return age >= ctx.life.adulthood && fighting(ctx.life, bandOf(age, ctx.life));
}

/** His town's index among a land's settlements (null: he lives in none of them). */
function townIndex(ctx: PopulationContext, cell: number, village: Ref | null): number | null {
  if (!village) return null;
  const k = ctx.settlements.inProvince(cell).findIndex((s) => s.ref === village);
  return k < 0 ? null : k;
}

/**
 * A met man's battles at the turn of `year` (followed forward, the year followLife follows): of each
 * battle his land sent men to, levied by its share of its fighting men sent; then falling (his death
 * claimed from the death ledger, `claimDeath`), or coming home wounded (maimed by the side's share), or
 * whole — each as his place's tally leaves room. A man who falls is dead at the year's turn.
 */
export function drawWar(
  ctx: PopulationContext,
  ledger: ObserverLedger,
  person: Person,
  year: number,
  fronts: Fronts,
  draw: (purpose: number, n: number) => number,
  claimDeath: (band: number) => boolean,
): void {
  const age = year - person.birthYear;
  if (!person.alive || person.sex !== MALE || !ofFightingAge(ctx, age)) return;
  const cell = person.cell,
    town = townIndex(ctx, cell, person.village);
  for (const f of fronts.byYear.get(year)?.get(cell) ?? []) {
    const { place, tally } = placeOf(f.fell, town),
      [sent, dead, hurt] = tally;
    if (sent <= 0) continue;
    if (!(draw(WAR_DRAWS.levy, f.n) < Math.min(1, f.fell[1] / menOf(ctx, fronts, cell, year))))
      continue;
    const keys = keysOf(f, cell, place),
      room = roomOf(ledger, keys, tally),
      all = room.fell + room.hurt + room.stood;
    if (all <= 0 || !ledger.claim(keys.l, sent)) continue;
    let fate: WarFate["fate"] | null = null;
    // (With nothing yet claimed: of the sent, the dead; of those who came home, the wounded.)
    if (
      room.fell > 0 &&
      draw(WAR_DRAWS.fell, f.n) < room.fell / all &&
      ledger.claim(keys.w, dead)
    ) {
      if (claimDeath(bandOf(age, ctx.life))) fate = "fell";
      else ledger.release(keys.w);
    }
    if (fate === null) {
      const back = room.hurt + room.stood;
      if (back <= 0) {
        // He could not fall, and no one else came home: he did not go.
        ledger.release(keys.l);
        continue;
      }
      fate =
        room.hurt > 0 && draw(WAR_DRAWS.hurt, f.n) < room.hurt / back && ledger.claim(keys.h, hurt)
          ? draw(WAR_DRAWS.maimed, f.n) < f.maimed
            ? "maimed"
            : "hurt"
          : "stood";
    }
    (person.wars ??= []).push({
      event: f.event,
      war: f.war,
      year,
      side: f.side,
      land: f.land,
      cell,
      town: typeof place === "number" ? place : null,
      fate,
    });
    if (fate === "fell") {
      person.alive = false;
      person.diedYear = year;
      return;
    }
  }
}

/** Where a person lived in a year: the land of their last move by then, else where they were born. */
function cellAt(person: Person, year: number): number {
  let cell = person.birthCell;
  for (const m of person.moves) if (m.year <= year) cell = m.to;
  return cell;
}

/**
 * A man's battles of the years before he was met (`now`, the year of meeting), within WAR_PAST_YEARS
 * and while he was of fighting age: drawn as drawWar draws them, but only as one who came home — he
 * lives to be met — so never fallen, and only where his place's tally leaves room among those who came
 * home. His town counts where he lived in it then (no move since, and it stood).
 */
export function drawPastWars(
  ctx: PopulationContext,
  ledger: ObserverLedger,
  person: Person,
  now: number,
  fronts: Fronts,
  draw: (purpose: number, n: number, year: number) => number,
): void {
  if (!person.alive || person.sex !== MALE || fronts.byYear.size === 0) return;
  const village = person.village ? ctx.settlements.get(person.village) : undefined;
  for (
    let year = Math.max(now - WAR_PAST_YEARS, person.birthYear + ctx.life.adulthood);
    year < now;
    year++
  ) {
    if (!ofFightingAge(ctx, year - person.birthYear)) continue;
    const cell = cellAt(person, year),
      list = fronts.byYear.get(year)?.get(cell);
    if (!list) continue;
    const settled =
        village &&
        village.cell === cell &&
        village.founded <= year &&
        !person.moves.some((m) => m.year > year),
      town = settled ? townIndex(ctx, cell, village.ref) : null;
    for (const f of list) {
      const { place, tally } = placeOf(f.fell, town),
        [sent, , hurt] = tally;
      if (sent <= 0) continue;
      if (
        !(
          draw(WAR_DRAWS.pastLevy, f.n, year) <
          Math.min(1, f.fell[1] / menOf(ctx, fronts, cell, year))
        )
      )
        continue;
      const keys = keysOf(f, cell, place),
        room = roomOf(ledger, keys, tally),
        back = room.hurt + room.stood;
      // (None came home of his place whom the met have not been already: he was not among them.)
      if (back <= 0 || !ledger.claim(keys.l, sent)) continue;
      const fate: WarFate["fate"] =
        room.hurt > 0 &&
        draw(WAR_DRAWS.pastHurt, f.n, year) < room.hurt / back &&
        ledger.claim(keys.h, hurt)
          ? draw(WAR_DRAWS.pastMaimed, f.n, year) < f.maimed
            ? "maimed"
            : "hurt"
          : "stood";
      (person.wars ??= []).push({
        event: f.event,
        war: f.war,
        year,
        side: f.side,
        land: f.land,
        cell,
        town: typeof place === "number" ? place : null,
        fate,
      });
    }
  }
}
