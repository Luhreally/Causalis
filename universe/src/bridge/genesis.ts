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
    /** The acts laid on its peopling (Phase 28): the seas lowered, a kind or a hard age, where they were bidden to rise (a cell). */
    readonly peopling: {
      readonly seasLow: boolean;
      readonly age: "kind" | "hard" | null;
      readonly cradle: number | null;
    };
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
  /**
   * How the first people spread over the land before the chronicle opened (Phase 28), as the
   * world is begun from: the lands their bands reached in the order they came, and the tongues
   * each spoke at the opening, by family.
   */
  readonly peopling: {
    /** The province they rose in, and its middle (a cell of the world's fine grid). */
    readonly cradle: number;
    readonly middle: number;
    /** Each land reached: [province, steps from the cradle, the province its bands came from], in the order they came. */
    readonly lands: readonly (readonly [number, number, number])[];
    /** How many lived in each at the chronicle's opening. */
    readonly sizes: readonly number[];
    /** The family of tongues each spoke then (an index into families). */
    readonly family: readonly number[];
    readonly families: readonly {
      readonly name: string;
      /** The province its first tongue was first spoken in, and that province's middle (a fine cell). */
      readonly root: number;
      readonly middle: number;
      readonly lands: number;
      readonly tongues: number;
      readonly people: number;
    }[];
    /** The steps from the cradle each tongue of the opening arose at (ascending). */
    readonly tongues: readonly number[];
    /** The provinces of the world its people could live in, reached or not. */
    readonly livable: number;
  } | null;
};
