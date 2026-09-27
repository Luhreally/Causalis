// The wars of the year as the globe draws them (Phase 9 M87): each war's sides in their
// colours, the land its host marches from and the land it marches for (fine-grid spots),
// and the battles fought lately — where, whether the attacker won, how many fell.
export type WarsMap = {
  readonly year: number;
  readonly wars: readonly {
    readonly ref: string;
    readonly attacker: {
      readonly ref: string;
      readonly name: string;
      readonly color: readonly [number, number, number];
    };
    readonly defender: {
      readonly ref: string;
      readonly name: string;
      readonly color: readonly [number, number, number];
    };
    /** Where the attacker's host sets out (its land nearest what it wants), and what it wants. */
    readonly from: number;
    readonly to: number;
    readonly declared: number;
    /** The year it ended (null: still fought). */
    readonly ended: number | null;
    readonly battles: readonly {
      readonly spot: number;
      readonly year: number;
      readonly won: boolean;
      readonly fallen: number;
      readonly event: string;
    }[];
  }[];
};
