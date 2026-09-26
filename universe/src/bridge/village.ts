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
};
