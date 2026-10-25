// The eye that watches by itself (Phase 31 M168, asked for 2026-10-24: "i would just watch it
// emerge and be able to pause and influence and all that"): turned on, it goes from one thing to
// the next as a documentary would — each first in the world as it comes (the first village, the
// first realm, the first city, writing, iron, the steam engine, a war's first battle, the first
// satellite…), seen where it happened; and between them the round of the world's life: before
// any village, its bands wandering their land and down among one of them; after, the greatest
// town growing on its land, a day in its streets, the whole world turning — and now and then a
// great battle lately fought, down on its field (Phase 37 M187). Pure: what to watch next, for how
// long, and how it is told; the page flies there.
import type { WorldFirst } from "../bridge/index.ts";

/** A town of the world, as the towns' map tells it. */
export type TownSeen = {
  readonly ref: string;
  readonly name: string;
  readonly cell: number;
  readonly people: number;
  readonly city: boolean;
};

/** What the eye watches. */
export type Shot =
  /** A first in the world, where it happened (its place, or the whole world if it has none). */
  | { readonly kind: "first"; readonly first: WorldFirst }
  /** A land's bands wandering it, the years passing a second at a time. */
  | { readonly kind: "bands"; readonly cell: number }
  /** Down among one of its bands, their day. */
  | { readonly kind: "camp"; readonly cell: number }
  /** A town on its land, growing, a year a second. */
  | { readonly kind: "grow"; readonly town: string; readonly name: string; readonly cell: number }
  /** A day in a town's streets, by day. */
  | { readonly kind: "street"; readonly town: string; readonly name: string; readonly cell: number }
  /** The whole world turning, a year a second. */
  | { readonly kind: "world" }
  /** A great battle lately fought, watched on its field (Phase 37 M187). */
  | {
      readonly kind: "battle";
      readonly event: string;
      readonly year: number;
      readonly fallen: number;
    };

/** A battle of the world, as its wars' map tells it: its event, its year, how many fell in it. */
export type BattleSeen = { readonly event: string; readonly year: number; readonly fallen: number };

/** A shot, how long it is held (seconds of the viewer's own), and its caption. */
export type Take = { readonly shot: Shot; readonly seconds: number; readonly words: string };

/**
 * What the eye has told so far, how far round the world's life it has gone, and at which turn of
 * it it last went down onto a battle's field.
 */
export type Director = { readonly told: Set<string>; round: number; battled: number };

/** How long each kind of shot is held. */
const HOLD: Readonly<Record<Shot["kind"], number>> = {
  first: 16,
  bands: 18,
  camp: 24,
  grow: 22,
  street: 18,
  world: 16,
  // (From the charge to the field won, at twice its pace.)
  battle: 48,
};

/** How many must fall in a battle for the eye to go down to it; how many turns of the round between two. */
export const GREAT_BATTLE = 100;
const BATTLE_EVERY = 3;

/**
 * How many firsts may wait to be shown before the eye has fallen behind the world: then the
 * lesser ones are let go, and only those that open a stage of the world are kept.
 */
export const BEHIND = 3;

/** A director begun now: the firsts already in the world are history, not news. */
export function newDirector(firsts: readonly WorldFirst[]): Director {
  return { told: new Set(firsts.map((f) => f.what)), round: 0, battled: -BATTLE_EVERY };
}

/** The firsts not yet told, the earliest first. */
export function untold(d: Director, firsts: readonly WorldFirst[]): WorldFirst[] {
  return firsts.filter((f) => !d.told.has(f.what)).sort((a, b) => a.year - b.year);
}

/** A first's words, its sign kept ("🏙️ A city" → "🏙️ The first city"; "💡 Iron" → "💡 Iron found"). */
export function firstWords(f: WorldFirst): string {
  const m = /^(\S+)\s+(.*)$/u.exec(f.what),
    sign = m ? m[1]! : "",
    what = m ? m[2]! : f.what;
  // (Not "the first new sickness": a new thing is told as it is.)
  const told = /^an? (?!new )/i.test(what)
    ? `The first ${what.replace(/^an? /i, "")}`
    : sign === "💡"
      ? `${what}, first known`
      : what;
  return `${sign} ${told} — year ${f.year.toLocaleString("en-US")}${
    f.stage ? ` · a new stage: ${f.stage}` : ""
  }`.trim();
}

/**
 * The next take: the earliest first not yet told (marked told) — only those that open a stage,
 * if the eye has fallen behind; else the next of the round of the world's life — before any
 * town, its most peopled land's bands and down among them; after, the greatest towns growing
 * and their streets, and the world whole; and now and then, of `battles` lately fought, the
 * greatest not yet watched, where enough fell in it, down on its field.
 */
export function nextTake(
  d: Director,
  firsts: readonly WorldFirst[],
  towns: readonly TownSeen[],
  peopled: readonly { readonly cell: number; readonly people: number }[],
  battles: readonly BattleSeen[] = [],
): Take {
  const waiting = untold(d, firsts);
  // (Fallen behind the world — more waiting than can be shown in their time — the lesser are let
  // go, the stages kept.)
  if (waiting.length > BEHIND) for (const f of waiting) if (!f.stage) d.told.add(f.what);
  const news = waiting.find((f) => !d.told.has(f.what));
  if (news) {
    d.told.add(news.what);
    return { shot: { kind: "first", first: news }, seconds: HOLD.first, words: firstWords(news) };
  }
  const fight = battles
    .filter((b) => b.fallen >= GREAT_BATTLE && !d.told.has(`battle:${b.event}`))
    .sort((a, b) => b.fallen - a.fallen || b.year - a.year)[0];
  if (fight && d.round - d.battled >= BATTLE_EVERY) {
    d.told.add(`battle:${fight.event}`);
    d.battled = d.round;
    return {
      shot: { kind: "battle", event: fight.event, year: fight.year, fallen: fight.fallen },
      seconds: HOLD.battle,
      words: `⚔️ A battle of year ${fight.year.toLocaleString("en-US")}: ${fight.fallen.toLocaleString("en-US")} fall`,
    };
  }
  const round = d.round++;
  if (!towns.length) {
    const land = [...peopled].sort((a, b) => b.people - a.people || a.cell - b.cell)[0];
    if (!land) return { shot: { kind: "world" }, seconds: HOLD.world, words: "🌍 The world" };
    return round % 2 === 0
      ? {
          shot: { kind: "bands", cell: land.cell },
          seconds: HOLD.bands,
          words: "🔥 The bands wander their land, the years passing",
        }
      : {
          shot: { kind: "camp", cell: land.cell },
          seconds: HOLD.camp,
          words: "⛺ Among a band: their day",
        };
  }
  // (The greatest towns in turn, so the round goes about the world.)
  const greatest = [...towns].sort((a, b) => b.people - a.people || (a.ref < b.ref ? -1 : 1)),
    town = greatest[Math.floor(round / 3) % Math.min(3, greatest.length)]!;
  switch (round % 3) {
    case 0:
      return {
        shot: { kind: "grow", town: town.ref, name: town.name, cell: town.cell },
        seconds: HOLD.grow,
        words: `🏘️ ${town.name} growing, a year a second`,
      };
    case 1:
      return {
        shot: { kind: "street", town: town.ref, name: town.name, cell: town.cell },
        seconds: HOLD.street,
        words: `🚶 A day in ${town.name}`,
      };
    default:
      return {
        shot: { kind: "world" },
        seconds: HOLD.world,
        words: "🌍 The whole world turning, a year a second",
      };
  }
}
