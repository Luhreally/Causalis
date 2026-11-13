// A realm's fortune laid for years (asked 2026-11-13: "does a max strength 5 year curse collapse a country? cause thats
// how strong it should be"): a blessing or a curse with a strength and a span of years, two things apart. At the
// strength it always had and for one year it is the one-off it always was, and nothing is kept here. Any other is kept,
// and lays its weight on the realm again at each year's turn while it holds, through what the world already reads: its
// lands' grievance, the harvest and the deaths of its lands (the same acts the palette lays on a land), its standing
// with its people; a blessing's luck is envied by those who meet it. What follows is the world's own: famine, sickness,
// lands breaking away, a seat falling, or a golden age. Nothing kept, nothing hashed, not even a name, while no fortune
// holds anywhere.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";

/** How strong a fortune can be laid, weakest first: 1 is the strength it always had. */
export const FORTUNE_STRENGTHS = [0.5, 1, 1.5, 2, 3] as const;
/** What each strength is called. */
export const FORTUNE_WORDS: Readonly<Record<number, string>> = {
  0.5: "faint",
  1: "of old",
  1.5: "strong",
  2: "great",
  3: "the greatest",
};
/** The most years a fortune can be laid for. */
export const FORTUNE_YEARS = 5;

/** What a fortune does at its strength, a year at a time. First guesses, each a number to change. */
export const FORTUNE_WEIGHT = {
  /** Of a realm's lands, the share whose harvest is blighted (or blessed), by strength past 1. */
  harvestPer: 0.5,
  /** Of its lands, the share struck by sickness (or healed), by strength past this. */
  sickFrom: 1.5,
  sickPer: 1 / 1.5,
  /** Its standing with its people, moved at each year's turn, by strength past 1. */
  standing: 0.05,
  /** And the pull on what its people think of its rule while it holds, by strength past 1 (legitimacyFactors). */
  pull: 0.1,
  /** What those who meet a blessed realm remember of its luck, each year, by strength past 1. */
  envy: 0.1,
} as const;

/** Whether a strength is one the palette offers. */
export const isFortuneStrength = (s: unknown): s is number =>
  typeof s === "number" && (FORTUNE_STRENGTHS as readonly number[]).includes(s);

/** A fortune laid on a realm, and what it was when it was laid. */
export type Fortune = {
  readonly realm: Ref;
  /** 1: a blessing; -1: a curse. */
  readonly sign: 1 | -1;
  readonly strength: number;
  readonly years: number;
  readonly from: number;
  readonly until: number;
  readonly command: Ref;
  readonly event: Ref;
  readonly name: string;
  readonly people: number;
  readonly lands: number;
  readonly legitimacy: number;
  /** Years laid so far (the first, when it was cast). */
  laid: number;
  /** The years' events, oldest first. */
  told: Ref[];
};

export class FortuneStore implements StateStore {
  readonly name = "acts.fortunes";
  private list: Fortune[] = [];

  all(): readonly Fortune[] {
    return this.list;
  }
  add(f: Fortune): void {
    this.list.push(f);
  }
  drop(f: Fortune): void {
    this.list = this.list.filter((x) => x !== f);
  }
  /** The fortunes holding over a realm (none, nearly always). */
  over(realm: Ref): Fortune[] {
    return this.list.length ? this.list.filter((f) => f.realm === realm) : [];
  }
  pinned(): Ref[] {
    return this.list.flatMap((f) => [f.event, ...f.told]);
  }
  /** No fortune holds: nothing in a world's hash, not even a name. */
  dormant(): boolean {
    return !this.list.length;
  }
  hashInto(h: Hasher): void {
    h.value(this.list);
  }
  save(): unknown {
    return this.list.length ? { list: this.list } : {};
  }
  load(state: unknown): void {
    this.list = ((state as { list?: Fortune[] } | null)?.list ?? []).map((f) => ({
      ...f,
      told: [...f.told],
    }));
  }
}

export function fortunesOf(world: World): FortuneStore | null {
  return world.hasStore("acts.fortunes") ? world.store<FortuneStore>("acts.fortunes") : null;
}

/** How hard the fortunes on a realm pull on its people's regard for its rule (0 under none): +, a blessing's. */
export function fortunePull(world: World, realm: Ref): { pull: number; event: Ref | null } {
  const held = fortunesOf(world)?.over(realm) ?? [];
  let pull = 0,
    event: Ref | null = null;
  for (const f of held) {
    pull += f.sign * FORTUNE_WEIGHT.pull * Math.max(0, f.strength - 1);
    event = f.event;
  }
  return { pull, event };
}
