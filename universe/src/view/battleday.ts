// The battle at the turn (Phase 55 M227, D4): history fights a year's battles at its turn, and each
// is watched fought the next morning on the field before the town its land's battles are fought
// before. The hosts lie the night before it drawn up by their fires; at eight in the morning they
// come on, a second of the battle's own a minute of the world's, until the beaten are put to flight;
// the fallen lie where they fell until noon two days on, when they are borne in, and at two their
// funeral leaves the square. The world's clock is slowed for each stage, once, where the viewer
// watches at a month a second or less: a day a second over the days toward it, an hour a second
// through the night, a minute a second in the town (ten on the land) while it is fought, a day a
// second after, an hour a second as the fallen are borne in and buried. Each slowing begins a little
// ahead of what it is for, so a clock running fast comes down to it in time. Pure: which stage a
// moment of the world's is at, and how fast the clock may run in it.
import { BATTLE_LENGTH } from "./battle.ts";

const MINUTE = 60,
  HOUR = 3600,
  DAY = 86_400,
  YEAR = 365 * DAY;

/** When the battle at a turn is fought, and what is around it (world seconds from the turn). */
export const BATTLE_DAY = {
  /** At eight in the morning of the turn's first day. */
  from: 8 * HOUR,
  /** A second of the battle's own is a minute of the world's. */
  second: MINUTE,
  /** Its own seconds (view/battle.ts). */
  length: BATTLE_LENGTH,
  /** The eve: the evening before the turn, from six. */
  eve: -6 * HOUR,
  /** The clock is slowed toward the battle from so many days before its turn (for the night before it to be caught). */
  toward: -10 * DAY,
  /** The clock is slowed for the battle so long before it begins, to be at its pace when it does. */
  ready: 10 * MINUTE,
  /** And for the fallen borne in so long before they are (a clock at a day a second comes down to them in time). */
  ahead: 6 * HOUR,
  /** The fallen borne in from the field from noon two days on, until their funeral leaves the square at two. */
  borne: 2 * DAY + 12 * HOUR,
  buried: 2 * DAY + 14 * HOUR,
} as const;

/**
 * The stages of a battle at the turn: the eve (its hosts drawn up by their fires), the morning (still
 * drawn up, history having decided it), the battle, after it (the fallen lying where they fell), and
 * the fallen borne in to be buried.
 */
export type BattleStage = "eve" | "morning" | "battle" | "after" | "borne";

/** What the clock is slowed for: the days toward the battle, the night before it, the battle, after it, its fallen borne in. */
export type BattleCap = "toward" | "eve" | "battle" | "after" | "borne";

/**
 * How fast the clock runs at most through each (world seconds a second): in a town, and on its land
 * (null: not slowed there — a land does not show its fallen borne in).
 */
export const BATTLE_CAPS: Readonly<
  Record<BattleCap, { readonly town: number; readonly land: number | null }>
> = {
  toward: { town: DAY, land: DAY },
  eve: { town: HOUR, land: HOUR },
  battle: { town: MINUTE, land: 10 * MINUTE },
  after: { town: DAY, land: DAY },
  borne: { town: HOUR, land: null },
};

/** The turn whose battle a moment is about: the coming turn's from its eve, else the last one's. */
export function battleTurn(t: number): number {
  const y = Math.floor(t / YEAR);
  return t >= (y + 1) * YEAR + BATTLE_DAY.eve ? y + 1 : y;
}

/** When the battle at a turn (the world's years) is fought, from its start to its end (world seconds). */
export function battleSpan(turn: number): { readonly from: number; readonly to: number } {
  const from = turn * YEAR + BATTLE_DAY.from;
  return { from, to: from + BATTLE_DAY.length * BATTLE_DAY.second };
}

/** The battle's own second at a moment (0 before it begins, its length once it is over). */
export function battleSecond(t: number, turn: number): number {
  const { from } = battleSpan(turn);
  return Math.max(0, Math.min(BATTLE_DAY.length, (t - from) / BATTLE_DAY.second));
}

/** The stage of the battle at a turn a moment is at (null: before its eve, or its fallen buried). */
export function battleStage(t: number, turn: number): BattleStage | null {
  const at = t - turn * YEAR,
    { from, to } = battleSpan(turn);
  if (at < BATTLE_DAY.eve || at >= BATTLE_DAY.buried) return null;
  if (at < 0) return "eve";
  if (t < from) return "morning";
  if (t < to) return "battle";
  return at < BATTLE_DAY.borne ? "after" : "borne";
}

/**
 * What the clock is slowed for at a moment, by the battle at a turn (null: nothing): the days toward
 * it, the night before it until just before eight, the battle, after it, and its fallen borne in
 * from a little before noon two days on until an hour after their funeral leaves the square.
 */
export function battleCapAt(t: number, turn: number): BattleCap | null {
  const at = t - turn * YEAR,
    { from, to } = battleSpan(turn);
  if (at < BATTLE_DAY.toward || at >= BATTLE_DAY.buried + HOUR) return null;
  if (at < BATTLE_DAY.eve) return "toward";
  if (t < from - BATTLE_DAY.ready) return "eve";
  if (t < to) return "battle";
  return at < BATTLE_DAY.borne - BATTLE_DAY.ahead ? "after" : "borne";
}

/**
 * When each of the clock's slowings for the battle at a turn begins and ends (world seconds), in
 * order, one after another as `battleCapAt` has them: for a clock to come down to one before it
 * begins where its frames come slowly.
 */
export function battleCapSpans(
  turn: number,
): readonly { readonly cap: BattleCap; readonly from: number; readonly to: number }[] {
  const T = turn * YEAR,
    { from, to } = battleSpan(turn),
    borne = T + BATTLE_DAY.borne - BATTLE_DAY.ahead;
  return [
    { cap: "toward", from: T + BATTLE_DAY.toward, to: T + BATTLE_DAY.eve },
    { cap: "eve", from: T + BATTLE_DAY.eve, to: from - BATTLE_DAY.ready },
    { cap: "battle", from: from - BATTLE_DAY.ready, to },
    { cap: "after", from: to, to: borne },
    { cap: "borne", from: borne, to: T + BATTLE_DAY.buried + HOUR },
  ];
}

/**
 * One of the clock's slowings for the battle at a turn, where it is watched: its key (the battle,
 * where, the stage), its turn, the stage, how fast the clock may run in it, and when it begins and
 * ends (world seconds).
 */
export type Slowing = {
  readonly key: string;
  readonly turn: number;
  readonly cap: BattleCap;
  readonly speed: number;
  readonly from: number;
  readonly to: number;
};

/**
 * The slowings of a battle at the turn (its key: `<war>:<turn>`) where it is watched, in order: five
 * in its town; four on its land (a land does not show its fallen borne in).
 */
export function battleSlowings(key: string, where: "town" | "land"): Slowing[] {
  const turn = Number(key.split(":").at(-1));
  return battleCapSpans(turn).flatMap((s) => {
    const speed = BATTLE_CAPS[s.cap][where];
    return speed === null
      ? []
      : [{ key: `${key}:${where}:${s.cap}`, turn, cap: s.cap, speed, from: s.from, to: s.to }];
  });
}

/**
 * The stage begun at moment t that is to be slowed for now (null: none): not slowed for yet
 * (`done`), and the speed chosen runs past it.
 */
export function slowingBegun(
  slowings: readonly Slowing[],
  t: number,
  chosen: number,
  done: ReadonlySet<string>,
): Slowing | null {
  const s = slowings.find((x) => x.from <= t && t < x.to);
  return s && !done.has(s.key) && chosen > s.speed ? s : null;
}

/**
 * How fast the clock may run at moment t as it nears the stages ahead not slowed for yet, its frames
 * `frame` seconds apart: no faster than would carry it half way to one by the next frame, nor
 * slower than that one's own speed — so it comes to each beginning at its own speed, however slowly
 * its frames come (Infinity: none within two frames). And the stage that holds it so.
 */
export function slowAhead(
  slowings: readonly Slowing[],
  t: number,
  frame: number,
  done: ReadonlySet<string>,
): { readonly speed: number; readonly s: Slowing | null } {
  let speed = Infinity,
    s: Slowing | null = null;
  for (const x of slowings)
    if (x.from > t && !done.has(x.key)) {
      const v = Math.max(x.speed, (x.from - t) / (2 * frame));
      if (v < speed) {
        speed = v;
        s = x;
      }
    }
  return { speed, s };
}

/** How the clock's slowing for a battle at a turn is told: "Slowed to a minute a second for the battle at the turn of year 364". */
export function battleCapWords(cap: BattleCap, speed: number, turn: number): string {
  const pace =
      speed <= MINUTE
        ? "a minute"
        : speed <= 10 * MINUTE
          ? "ten minutes"
          : speed <= HOUR
            ? "an hour"
            : "a day",
    battle = battleTurnWords(turn);
  return `Slowed to ${pace} a second ${
    cap === "toward"
      ? `toward ${battle}`
      : cap === "eve"
        ? `through the night before ${battle}`
        : cap === "battle"
          ? `for ${battle}`
          : cap === "after"
            ? `after ${battle}`
            : `as the fallen of ${battle} are borne in`
  }`;
}

/** How much of the battle's fallen have been borne in from the field (0 … 1): over an hour and a half from noon two days on. */
export function borneShare(t: number, turn: number): number {
  const at = t - turn * YEAR - BATTLE_DAY.borne;
  return Math.max(0, Math.min(1, at / (1.5 * HOUR)));
}

/** The battle at a turn, as captions and the land's words call it (D4: by the year it was fought in). */
export function battleTurnWords(turn: number): string {
  return `the battle at the turn of year ${turn - 1}`;
}
