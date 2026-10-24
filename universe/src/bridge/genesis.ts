// A world's beginning, as the genesis shows it (Phase 9 M89): its deep ages, oldest first;
// every lineage of its living things — the age it arose in and the age it died out in, its
// body in words and in plan; and the people that rose to thought, where and why. Played on a
// deep clock (Phase 24): how old the world is, the steps of life's dawn and when each came, a
// drop of its first seas, and the acts the god's hand laid on its dawn.
import type { Block } from "./inspect.ts";
import type { BeastPlan } from "./village.ts";

export type GenesisPlan = {
  /** The seed's text this is the beginning of (its acts in it), and its world's name. */
  readonly seed: string;
  readonly name: string;
  /** How old the world is, millions of years. */
  readonly worldAge: number;
  /**
   * The steps of life's dawn, oldest first: when each came (millions of years ago), and what
   * it was — the first replicators, cells, light-eaters, the air, the nucleus, cells together,
   * the first bodies, their great radiation, life ashore.
   */
  readonly rungs: readonly {
    readonly id: string;
    readonly name: string;
    readonly at: number;
    readonly words: string;
  }[];
  /** A drop of its first seas, for the dawn to be watched in (its small lives by their ways). */
  readonly drop: Extract<Block, { type: "drop" }> | null;
  /** The acts laid on its dawn: the ages made otherwise (index, kind), what prospered in its seas. */
  readonly acts: {
    readonly ages: readonly { readonly age: number; readonly kind: string }[];
    readonly dawn: string | null;
    /** The ages whose living world prospered under the hand, and the way that did (Phase 27). */
    readonly lives: readonly { readonly age: number; readonly way: string }[];
  };
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
