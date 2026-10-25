// A war's course, to be watched unfolding on the globe (Phase 38 M193, asked for 2026-10-24: "i
// still cant see warfare and like wars like theres no coherent animations and battle between
// them"): the war's two sides as they were, where its host set out from and what it marched for,
// and each of its battles in turn — where and when, what came of it, how many of each side fell.
// Looked at, never lived: the war is history's, and what is drawn follows what it says.
import type { BattleOutcome } from "./battle.ts";
import type { WarSide } from "./wars.ts";

/** One of a war's battles, in its turn. */
export type CampaignBattle = {
  readonly event: string;
  readonly year: number;
  /** Its land, and that land's spot on the globe's fine grid. */
  readonly cell: number;
  readonly spot: number;
  /** "Lithiv's land", as told mid-sentence. */
  readonly land: string;
  readonly won: boolean;
  /** Of the attacker, of the defender. */
  readonly fallen: readonly [number, number];
  /** What it won: the field, a siege laid, a land taken, a seat stormed — or held. */
  readonly outcome: BattleOutcome;
};

export type Campaign = {
  readonly ref: string;
  /** "The war of the holy seat of X upon the league of Y". */
  readonly title: string;
  readonly attacker: WarSide;
  readonly defender: WarSide;
  /** Where the attacker's host set out from and the land it marched for (fine-grid spots). */
  readonly from: number;
  readonly to: number;
  /** The land it was fought for, as told mid-sentence. */
  readonly prize: string;
  readonly declared: number;
  /** The year it ended (null: still fought, played to now). */
  readonly ended: number | null;
  readonly now: number;
  readonly battles: readonly CampaignBattle[];
  /** A rising (a civil war's): what it was fought over (null: a war between realms). */
  readonly civil: string | null;
};
