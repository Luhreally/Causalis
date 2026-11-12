// What a people has learned from what has cost it (L1 of the lessons; rules/lessons.ts holds the rule and its rows). A land's people
// and a realm keep, by cause, what it has cost them (a share of them, faded with the years, and the count), and, by response, how
// far they lean on it and whether it has worked. A few numbers each, for those a cause has struck; nothing is swept year by year:
// what is faded is faded when it is read. This module only keeps and reads (the owning systems read it where they reckon a loss);
// sim/lore/lessons.ts reads history into it.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";
import {
  LESSON,
  LESSON_RESPONSE,
  LESSONS_FOR,
  faded,
  lessenBy,
  pressOf,
  type LessonHow,
} from "../../rules/index.ts";

/** What a cause has cost a people. */
export type CauseMark = {
  /** The share of them it has cost, faded to `at`. */
  cost: number;
  at: number;
  /** All it has cost them, as its rows count it, since `first`: the count (homes, lives or men) and the lives among it. */
  lost: number;
  dead: number;
  first: number;
  /** How many times it has struck, and the share of them all those strikes cost, unfaded. */
  strikes: number;
  share: number;
};

/** How far a people leans on a response. */
export type Use = {
  /** 0 to 1, as at `at`; it fades with the years when nothing presses it. */
  w: number;
  at: number;
  /** The year it was first taken up, and from whom (a land's or realm's ref; null: their own finding), and the event that told it. */
  taken: number;
  from: string | null;
  ref: Ref | null;
  /** What each strike of its cause cost them before (a share of them), and the strikes since and what they cost. */
  before: number;
  strikes: number;
  since: number;
};

export type Holder = {
  readonly causes: Map<string, CauseMark>;
  readonly uses: Map<string, Use>;
};

export class LessonStore implements StateStore {
  readonly name = "lore.lessons";
  /** Each holder (a land's ref, `cell:0:N`, or a realm's) and what it keeps. */
  readonly holders = new Map<string, Holder>();
  /** The last event read into it, by its code. */
  read = 0;
  /** How many lessons have been taken up in all, by their own finding and from others: for tallies. */
  taken = 0;
  copied = 0;
  /** The responses some people of this world has taken up, the year each first was and its telling (kept), in that order. */
  readonly firsts: [string, number, Ref | null][] = [];

  /** Nothing has cost anyone yet: hashed as if not there (what it has read is the log's own, and moves nothing). */
  dormant(): boolean {
    return this.holders.size === 0;
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  /** Kept as they are, not rounded: a world loaded must go on as the one saved would have. */
  save(): unknown {
    if (this.dormant()) return this.read ? { read: this.read } : {};
    return {
      read: this.read,
      taken: this.taken,
      copied: this.copied,
      firsts: this.firsts.map((f) => [...f]),
      holders: [...this.holders.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([k, h]) => [
          k,
          [...h.causes.entries()].map(([c, m]) => [
            c,
            m.cost,
            m.at,
            m.lost,
            m.dead,
            m.first,
            m.strikes,
            m.share,
          ]),
          [...h.uses.entries()].map(([r, u]) => [
            r,
            u.w,
            u.at,
            u.taken,
            u.from,
            u.ref,
            u.before,
            u.strikes,
            u.since,
          ]),
        ]),
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      read?: number;
      taken?: number;
      copied?: number;
      firsts?: [string, number, Ref | null][];
      holders?: [string, unknown[][], unknown[][]][];
    };
    this.holders.clear();
    this.read = s.read ?? 0;
    this.taken = s.taken ?? 0;
    this.copied = s.copied ?? 0;
    this.firsts.length = 0;
    for (const [id, year, ref] of s.firsts ?? []) this.firsts.push([id, year, ref ?? null]);
    for (const [k, causes, uses] of s.holders ?? []) {
      const h: Holder = { causes: new Map(), uses: new Map() };
      for (const [c, cost, at, lost, dead, first, strikes, share] of causes as [
        string,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ][])
        h.causes.set(c, { cost, at, lost, dead, first, strikes, share });
      for (const [r, w, at, taken, from, ref, before, strikes, since] of uses as [
        string,
        number,
        number,
        number,
        string | null,
        Ref | null,
        number,
        number,
        number,
      ][])
        h.uses.set(r, { w, at, taken, from, ref, before, strikes, since });
      this.holders.set(k, h);
    }
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const h of this.holders.values())
      for (const u of h.uses.values()) if (u.ref) out.push(u.ref);
    for (const f of this.firsts) if (f[2]) out.push(f[2]);
    return out;
  }

  get(holder: string): Holder | undefined {
    return this.holders.get(holder);
  }
  holder(key: string): Holder {
    let h = this.holders.get(key);
    if (!h) this.holders.set(key, (h = { causes: new Map(), uses: new Map() }));
    return h;
  }
}

export function lessonsOf(world: World): LessonStore | null {
  return world.hasStore("lore.lessons") ? world.store<LessonStore>("lore.lessons") : null;
}

/** How far a holder leans on a response in a year (0: not at all, or let go). */
export function useIn(h: Holder | undefined, response: string, year: number): number {
  const u = h?.uses.get(response);
  if (!u) return 0;
  const w = faded(u.w, year - u.at, LESSON.keep);
  return w < LESSON.least ? 0 : w;
}

/** How hard a cause presses a holder in a year, from what it has cost them, faded. */
export function pressIn(h: Holder | undefined, cause: string, year: number): number {
  const m = h?.causes.get(cause);
  return m ? pressOf(faded(m.cost, year - m.at, LESSON.fade)) : 0;
}

/** How far a holder leans on a response (a land's ref or a realm's). */
export function lessonUse(world: World, holder: string, response: string, year: number): number {
  return useIn(lessonsOf(world)?.get(holder), response, year);
}

/**
 * What is left of a strike of a cause on a holder, after every response to it they lean on that lessens what it costs: exactly 1
 * where they have learned nothing of it (so a world that never learns is the world as it was).
 */
export function lessened(world: World, holder: string, cause: string, year: number): number {
  const h = lessonsOf(world)?.get(holder);
  if (!h || !h.uses.size) return 1;
  let left = 1;
  for (const r of LESSONS_FOR.get(cause) ?? []) {
    if (r.how !== "lessen") continue;
    const w = useIn(h, r.id, year);
    if (w > 0) left *= 1 - lessenBy(r, w);
  }
  return left;
}

/**
 * What every response that works by `how` adds for a holder (`store`: months of food put by; `field`: a share more of the men
 * fielded; `walls`, `siege`: a host's strength; `doctrine:<axis>`: a weight on an axis of its design): each row's most, by how far
 * they lean on it. Exactly 0 where they lean on none.
 */
export function lessonAdds(world: World, holder: string, how: LessonHow, year: number): number {
  const h = lessonsOf(world)?.get(holder);
  if (!h || !h.uses.size) return 0;
  let add = 0;
  for (const [id] of h.uses) {
    const r = LESSON_RESPONSE.get(id);
    if (r?.how === how) add += r.most * useIn(h, id, year);
  }
  return add;
}
