// A battle's roll (Phase 55 M225): who fought it, figure by figure — each side's fallen, its wounded
// who lived, the rest — and where each came from; the one rule for how many figures a battle is drawn
// as (the field's, view/battle.ts newBattle, with the wounded who live, view/blows.ts); and the refs of
// those the roll names: a town's line holder, one of a battle's levy. Pure: no world.
import type { BattleNear, BattleSideNear, LevyPlace } from "./battle.ts";

/** The most figures a side's roll is asked for. */
export const ROLL_MOST = 400;
/** The figures a side is drawn as when the asker does not say (view/battle.ts mostFor at full detail). */
export const ROLL_DEFAULT = 360;
/** The wounded who live drawn: at most this share of a side's figures that do not fall (view/blows.ts HURT.most). */
export const HURT_MOST = 0.8;

/** A side's counts, as its figures are drawn from them. */
export type FigureCounts = Pick<BattleSideNear, "fielded" | "fallen" | "wounded">;
/** A side's figures: as many as the field draws, those that fall, its wounded who live, the rest. */
export type SideFigures = {
  readonly n: number;
  readonly falls: number;
  readonly hurt: number;
  readonly stood: number;
};
/** A battle's figures: men to a figure, and each side's (the attacker first). */
export type BattleFigures = {
  readonly per: number;
  readonly sides: readonly [SideFigures, SideFigures];
};

/**
 * How many figures a battle is drawn as, `most` to the greater side: the field's rule (view/battle.ts
 * newBattle: the victors keep one standing, the beaten a few) and the wounded who live, so many
 * figures for so many men, at most HURT_MOST of those that do not fall.
 */
export function battleFigures(
  near: Pick<BattleNear, "won"> & {
    readonly attacker: FigureCounts;
    readonly defender: FigureCounts;
  },
  most: number,
): BattleFigures {
  const a = near.attacker,
    d = near.defender,
    per = Math.max(1, Math.ceil(Math.max(a.fielded, d.fielded, 1) / most)),
    beaten: 0 | 1 = near.won ? 1 : 0,
    side = (s: FigureCounts, at: 0 | 1): SideFigures => {
      const n = Math.max(1, Math.round(s.fielded / per)),
        cap = at === beaten ? Math.ceil(n * 0.92) : n - 1,
        falls = Math.max(s.fallen > 0 && n > 1 ? 1 : 0, Math.min(cap, Math.round(s.fallen / per))),
        wounded = s.wounded ?? 0,
        hurt =
          wounded > 0
            ? Math.max(0, Math.min(Math.floor(HURT_MOST * (n - falls)), Math.round(wounded / per)))
            : 0;
      return { n, falls, hurt, stood: n - falls - hurt };
    };
  return { per, sides: [side(a, 0), side(d, 1)] };
}

/**
 * One the roll names: their page (a line holder's `folk:…`, one met `prsn:…`, one of the levy
 * `lv:…`), their name, where they came from (an index into their side's towns; −1: a battle with
 * no record of its men), their age that day, whether history keeps them (a line holder, one met),
 * and, of the wounded, the maimed.
 */
export type RollEntry = {
  readonly ref: string;
  readonly name: string;
  readonly place: number;
  readonly age: number;
  readonly kept: boolean;
  readonly maimed?: true;
};
/** What one man of a battle's roll bore there and who made it, told (Phase 55 M228: his card's words). */
export type ArmBorne = {
  /** "a chert-tipped spear". */
  readonly words: string;
  /** "Ana Talinor, a knapper of Elmstead" (null: none made it, a body's own). */
  readonly maker: string | null;
  /** Where it was made: "the knappers' ground" (null: none). */
  readonly at: string | null;
  readonly grade: string | null;
  /** Its page: `arms:<battle>:<side>:<his page>`. */
  readonly page: string;
  /** Its stuff as the people who made it call it, where asked (Phase 58): "of black-edge-stone, as the Kurnic call moissanite". */
  readonly called?: string;
};
/** A place a side's men came from, with its figures: fallen, wounded who lived, the rest. */
export type RollPlace = LevyPlace & { readonly figures: readonly [number, number, number] };
/** A side on the roll: its figures, those named in each lot (place by place), and its places. */
export type RollSide = {
  readonly realm: string;
  readonly figures: SideFigures;
  readonly fell: readonly RollEntry[];
  readonly hurt: readonly RollEntry[];
  readonly stood: readonly RollEntry[];
  /** Where its men came from (host/fallen.ts levyPlaces, all of them, the most dead first). */
  readonly towns: readonly RollPlace[];
};
export type BattleRoll = {
  readonly event: string;
  readonly war: string;
  readonly year: number;
  /** Men to a figure, and the most figures to a side it was drawn for. */
  readonly per: number;
  readonly most: number;
  readonly attacker: RollSide;
  readonly defender: RollSide;
};

/** A town's line holder's page: `folk:<town>:<line>:<n>`. */
export function townsfolkRef(town: string, line: number, n: number): string {
  return `folk:${town}:${line}:${n}`;
}
/** A line holder's ref's parts (n null: `folk:<town>:<line>`, the line's holder now); null: not one. */
export function parseTownsfolkRef(
  ref: string,
): { town: string; line: number; n: number | null } | null {
  const m = /^folk:(town:\d+:\d+):(\d+)(?::(\d+))?$/.exec(ref);
  return m
    ? { town: m[1]!, line: Number(m[2]), n: m[3] === undefined ? null : Number(m[3]) }
    : null;
}
/** One of a battle's levy, named for its roll: `lv:<battle>:<side>:<j>`. */
export function levyManRef(event: string, side: 0 | 1, j: number): string {
  return `lv:${event}:${side}:${j}`;
}
/** A levy man's ref's parts; null: not one. */
export function parseLevyManRef(ref: string): { event: string; side: 0 | 1; j: number } | null {
  const m = /^lv:(.+):([01]):(\d+)$/.exec(ref);
  return m ? { event: m[1]!, side: m[2] === "1" ? 1 : 0, j: Number(m[3]) } : null;
}
