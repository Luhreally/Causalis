// The microscope's plan of a village, as the host sends it (docs/architecture §9,
// watch mode): what the view needs to draw a village's day. Positions are metres
// from the village's middle.
export type VillagePlan = {
  readonly ref: string;
  readonly name: string;
  readonly population: number;
  readonly market: boolean;
  /** Whether the god's hand rests here: then everyone shown is one of the hand's people. */
  readonly hand: boolean;
  /** The biome the village stands in (gen's code), for the ground's colour. */
  readonly biome: number;
  readonly seed: number;
  /** Positions in metres from the village's middle; `household` for the watched homes. */
  readonly homes: readonly { x: number; z: number; yaw: number; household: string | null }[];
  readonly fields: readonly { x: number; z: number; w: number; d: number; yaw: number }[];
  readonly pasture: { x: number; z: number; r: number };
  /** How far out the wild begins. */
  readonly wild: number;
  readonly water: { x: number; z: number } | null;
  /**
   * How its houses are built (the land's design): walls, roof and shape by
   * realization id ("mudbrick", "flat", "court"), the roof's pitch in degrees, and
   * the design's ref for its why.
   */
  readonly house: {
    readonly walls: string;
    readonly roof: string;
    readonly form: string;
    readonly pitch: number;
    readonly design: string | null;
  };
  /** Where the road out leads, at the edge of what is shown. */
  readonly road: { x: number; z: number };
  /**
   * A city's quarters, if it is one: blocks of `blockM` metres, `blocks` to a side,
   * each put to a use (0 open, 1 houses, 2 crowded houses, 3 market, 4 workshops,
   * 5 temple), and whether the road through it is paved.
   */
  readonly districts: {
    readonly blocks: number;
    readonly blockM: number;
    readonly uses: readonly number[];
    readonly paved: boolean;
  } | null;
  readonly people: readonly {
    ref: string;
    name: string;
    home: number;
    age: number;
    occupation: number;
    child: boolean;
  }[];
  /**
   * How far their land has come, for what they wear and carry (art track A2): gatherers
   * in hides, farmers in undyed cloth, smiths' people in dyed cloth, the engines' in
   * coats, the modern world in bright colours. Absent: farmers.
   */
  readonly era?: "forage" | "farm" | "metal" | "industry" | "modern";
  /**
   * What lives about it (Phase 8 M77): the land's wild lineages, each with how much of it
   * still stands against what the land first held (its hunters, against as many as the
   * game kept); its flocks and how many of the village keep them; and whether the land's
   * hunters raid the flocks. Absent: nothing drawn.
   */
  readonly fauna?: {
    readonly wild: readonly {
      readonly ref: string;
      readonly name: string;
      readonly niche: string;
      readonly size: number;
      readonly wool: boolean;
      readonly stock: number;
    }[];
    readonly flock: {
      readonly ref: string;
      readonly name: string;
      readonly size: number;
      readonly wool: boolean;
      readonly herders: number;
    } | null;
    readonly raided: boolean;
  };
  /** Their body, as the figure needs it (null: upright apes, as ever). */
  readonly body: {
    readonly clade: string;
    readonly medium: "land" | "shore" | "water";
    readonly symmetry: "bilateral" | "radial";
    readonly manipulators: string;
    readonly limbs: number;
    readonly skin: string;
    readonly size: number;
    /** How long they live, years: their old age comes as late. */
    readonly span: number;
  } | null;
};
