// Runs among the stars, as history holds them (Phase 71, first slice): a few dozen ways goods go between two lands of a world's
// history (or from a people of the stars to one), each with who runs it, what has gone by it and what became of it. It imports
// nothing of the space rules, and it holds nothing and is no part of the world's hash until a first run opens, so a history
// before that holds bit for bit, and an old save loads.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";

/** A hold under way. */
export type Convoy = {
  readonly sailed: number;
  readonly arrives: number;
  /** The goods aboard, each with what it clears a unit: `[good, count, margin]`. */
  readonly cargo: readonly (readonly [number, number, number])[];
  /** What it cost those who sent it (machines). */
  readonly machines: number;
};

/** A house a run makes rich: a family of the town at its sending end. */
export type RunHouse = {
  readonly name: string;
  /** The land it keeps its books in (-1: among a people of the stars). */
  readonly cell: number;
  /** All it has cleared, in grain. */
  worth: number;
  /** The event that told it was great, if it has come to that. */
  rich: Ref | null;
};

/** How a land stood when its first ship was sent for, to set beside what it came to. */
export type RunBefore = {
  readonly people: number;
  readonly tools: number;
  readonly clothing: number;
  readonly pottery: number;
  readonly machines: number;
  /** What each good fetched there. */
  readonly prices: readonly number[];
  /** What each good cost here. */
  readonly here: readonly number[];
};

export type StarRun = {
  readonly ref: Ref;
  /** The land it sends from (-1: a people of the stars, `civ`) and the land it sends to. */
  readonly from: number;
  readonly to: number;
  readonly civ: Ref | null;
  /** The stars of each end; which world at the far end. */
  readonly fromStar: Ref;
  readonly toStar: Ref;
  readonly planet: number;
  /** Who runs it: a realm's name then, and its ref (a people of the stars: `civ`). */
  readonly realm: Ref;
  readonly name: string;
  readonly house: RunHouse;
  /** The crossing, as it was reckoned when it opened. */
  drive: string;
  ly: number;
  hops: number;
  years: number;
  machinesTonne: number;
  readonly year: number;
  /** The event of its opening, and of its first ship in (null: none yet). */
  readonly opened: Ref;
  first: Ref | null;
  firstYear: number | null;
  /** Units come to port, by good; units lost on the way; ships in, and ships lost. */
  readonly landed: number[];
  readonly lost: number[];
  ships: number;
  raided: number;
  /** The last ship in; the last ship sent; the last raid, and the year. */
  lastIn: number;
  lastOut: number;
  lastRaid: Ref | null;
  lastRaidYear: number;
  /** Who raided it last, in words. */
  raider: string | null;
  /** How much of a load those who send it reckon on losing (0 … 1). */
  risk: number;
  readonly before: RunBefore;
  readonly under: Convoy[];
  /** Its end, and why (null: it runs). */
  closed: Ref | null;
  closedYear: number | null;
  closedWhy: "gone" | "war" | "empty" | "fallen" | "unpaid" | null;
};

export class TradeStore implements StateStore {
  readonly name = "space.trade";
  private readonly list: StarRun[] = [];
  /** How many there have ever been (a run's ref). */
  count = 0;
  /** The first ship in of any run, and of a run from another people; the first hold taken. */
  first: Ref | null = null;
  firstBetween: Ref | null = null;
  firstRaid: Ref | null = null;

  dormant(): boolean {
    return !this.count;
  }
  all(): readonly StarRun[] {
    return this.list;
  }
  open(): StarRun[] {
    return this.list.filter((r) => !r.closed);
  }
  add(r: StarRun): void {
    this.list.push(r);
    this.count++;
  }
  /** Let the oldest ended runs go, past a most kept. */
  trim(most: number): void {
    while (this.list.length > most) {
      const at = this.list.findIndex((r) => r.closed);
      if (at < 0) return;
      this.list.splice(at, 1);
    }
  }
  get(ref: string): StarRun | undefined {
    return this.list.find((r) => r.ref === ref);
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const r of this.list) {
      out.push(r.opened);
      for (const x of [r.first, r.lastRaid, r.closed, r.house.rich]) if (x) out.push(x);
    }
    if (this.first) out.push(this.first);
    if (this.firstBetween) out.push(this.firstBetween);
    if (this.firstRaid) out.push(this.firstRaid);
    return out;
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  save(): unknown {
    return {
      runs: this.list,
      count: this.count,
      first: this.first,
      firstBetween: this.firstBetween,
      firstRaid: this.firstRaid,
    };
  }
  load(state: unknown): void {
    const s = state as {
      runs: StarRun[];
      count: number;
      first: Ref | null;
      firstBetween: Ref | null;
      firstRaid: Ref | null;
    };
    this.list.length = 0;
    for (const r of s.runs)
      this.list.push({
        ...r,
        house: { ...r.house },
        landed: [...r.landed],
        lost: [...r.lost],
        under: r.under.map((c) => ({ ...c })),
      });
    this.count = s.count;
    this.first = s.first;
    this.firstBetween = s.firstBetween;
    this.firstRaid = s.firstRaid;
  }
}

/** The store of runs (none on a world with no space rules). */
export function tradeOf(world: World): TradeStore | null {
  return world.hasStore("space.trade") ? world.store<TradeStore>("space.trade") : null;
}
