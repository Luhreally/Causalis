// A world's beginning, as the genesis shows it (Phase 9 M89): its deep ages, oldest first;
// every lineage of its living things — the age it arose in and the age it died out in, its
// body in words and in plan; and the people that rose to thought, where and why.
import type { BeastPlan } from "./village.ts";

export type GenesisPlan = {
  readonly ages: readonly {
    readonly index: number;
    /** Millions of years ago, its start and end. */
    readonly from: number;
    readonly to: number;
    readonly kind: string;
    readonly seaLevel: number;
    readonly warmth: number;
    readonly forests: boolean;
  }[];
  readonly lineages: readonly {
    readonly ref: string;
    readonly name: string;
    readonly niche: string;
    readonly arose: number;
    readonly died: number | null;
    readonly size: number;
    readonly level: number;
    readonly body: BeastPlan | null;
    readonly words: string | null;
  }[];
  readonly people: {
    readonly name: string;
    readonly words: string;
    readonly because: string;
    readonly cradle: string;
    readonly arose: number;
    /** Their figure's body, as a village's plan carries it. */
    readonly figure: {
      readonly clade: string;
      readonly medium: "land" | "shore" | "water";
      readonly symmetry: "bilateral" | "radial";
      readonly manipulators: string;
      readonly limbs: number;
      readonly skin: string;
      readonly size: number;
      readonly span?: number;
    };
  } | null;
};
