// The ways a battle of a war is watched (Phase 55 M230, asked for 2026-10-25: "...like the more fluid
// views of wars and just actions of stuff yk"): its war unfolding over the world on a clock of its own
// (Phase 38 M193), its hosts on its land on the world's clock (Phase 40 M203), fought man by man before
// the town its land's battles are fought before (M227), and its field close on the battle's own clock
// (Phase 37 M186) — each a tap from the others. Each is gone to as from nowhere: what one view holds
// (its clock held or slowed, the one followed, the way back) is let go of in the next. Pure: the views,
// and which of them a battle can be watched in at a moment of the world's.
import { battleStage } from "./battleday.ts";

/** A way to watch a battle: its war over the world, its land, its town, its field close. */
export type WarView = "globe" | "land" | "town" | "field";

/** The views, in the order they are offered (from the whole world down to the field). */
export const WAR_VIEWS: readonly WarView[] = ["globe", "land", "town", "field"];

/** Each view's sign, its name and what it shows. */
export const WAR_VIEW_WORDS: Readonly<
  Record<WarView, { readonly icon: string; readonly words: string; readonly title: string }>
> = {
  globe: {
    icon: "🌍",
    words: "The war",
    title: "Its war unfolding over the world, on a clock of its own",
  },
  land: { icon: "🗺️", words: "The land", title: "Its hosts on the land, on the world's clock" },
  town: {
    icon: "🏘️",
    words: "The town",
    title: "Fought man by man before the town, on the world's clock",
  },
  field: { icon: "⚔️", words: "The field", title: "Its field close, on the battle's own clock" },
};

/** A battle as its views know it: its war, its event, its land, the year it was fought in. */
export type WarViewed = {
  readonly war: string;
  readonly event: string;
  readonly cell: number;
  readonly year: number;
};

/**
 * Whether the battle at a turn is being fought at a moment of the world's: from its eve, its hosts
 * drawn up by their fires the night before, through the morning, until the beaten are put to flight.
 * So long, a way into it — its mark on its land zoomed onto, its page, the tidings, a war's bar —
 * goes before the town it is fought before, where one stands on its land (asked for 2026-10-27: "i
 * meant open world warfare on town view not land view"); a battle past, onto its field.
 */
export function foughtNow(t: number, turn: number): boolean {
  const stage = battleStage(t, turn);
  return stage === "eve" || stage === "morning" || stage === "battle";
}

/**
 * Why each view of a battle cannot be watched at a moment of the world's (a view not named can):
 * before its town only from the morning it is fought, the turn after its year, until its fallen are
 * buried — the world's clock goes one way; the rest at any time.
 */
export function warViewsClosed(b: WarViewed, t: number): Partial<Record<WarView, string>> {
  const stage = battleStage(t, b.year + 1);
  return stage === null || stage === "eve"
    ? {
        town: `Fought before its town the morning of the turn of year ${b.year}: the world is not there now`,
      }
    : {};
}
