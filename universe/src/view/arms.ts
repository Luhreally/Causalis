// The arms a host fights with, as one table (Phase 53 M220): for each arm, how it strikes hand to
// hand, what it looses at a distance (nothing, arrows, darts, or powder and shot), the share of the
// other side's dead that falls to what it looses, the words for one who bore it and for what struck
// one down from afar, how long it is held in the battle (a gun), its smoke and its bayonet. The
// battle's views read these from here, so a new gun is one row; an arm with no row looks as the
// code always has (DEFAULT_LOOK). Pure: the same arm always looks and fires the same way.

/** How a host strikes hand to hand: a thrust (spears, tusks), a blow (swords, axes, clubs, claws), a bite, a grapple. */
export type Stroke = "thrust" | "strike" | "bite" | "grapple";

/** How one arm looks and fires. */
export type ArmLook = {
  /** How it strikes hand to hand. */
  readonly stroke: Stroke;
  /** What it looses at a distance: nothing, arrows, darts, or powder and shot. */
  readonly looses: "none" | "arrows" | "darts" | "shot";
  /** The share of a host's dead that fall to what the other side looses (when the OTHER side has this arm). */
  readonly loosed: number;
  /** One who fought with it ("a rifleman"). */
  readonly fighter: string;
  /** What struck one down from afar, when the other side bore it ("a bullet"). */
  readonly shotWords: string;
  /** Held length in the battle render (m), where it is a long arm (else undefined: the default rule). */
  readonly long?: number;
  /** Rounds in one burst (1: a single shot). */
  readonly burst: number;
  /** Smoke left by its firing (0 none … 1 black powder's white bank). */
  readonly smoke: number;
  /** A bayonet fixed on its muzzle. */
  readonly bayonet: boolean;
  /**
   * How its bearers stand and come on: shoulder to shoulder ("close"), or apart and going to ground
   * as they come, in rushes ("open": the magazine rifle and since, Phase 53 M220).
   */
  readonly order: "close" | "open";
  /** How it fires: in volleys, or as each bearer will, without pause ("continuous": the magazine and since). */
  readonly fire: "volley" | "continuous";
  /** Whether those who bear it raise ladders against a seat's walls (from the self-loading rifle on, they blow its gate). */
  readonly ladders: boolean;
  /** A team's gun: one for so many of its host, on a tripod (absent: each bears their own). */
  readonly team?: number;
  /** What the rest of a team gun's host bear (absent: the same). */
  readonly rest?: string;
};

/**
 * Every arm the views know, by its realization id. The guns come in the order the realms took them
 * up (the village lists its guns in this order).
 */
export const ARM_LOOKS: Readonly<Record<string, ArmLook>> = {
  club: {
    stroke: "strike",
    looses: "none",
    loosed: 0.25,
    fighter: "a clubman",
    shotWords: "an arrow",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  spear: {
    stroke: "thrust",
    looses: "none",
    loosed: 0.25,
    fighter: "a spearman",
    shotWords: "an arrow",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  axe: {
    stroke: "strike",
    looses: "none",
    loosed: 0.25,
    fighter: "an axeman",
    shotWords: "an arrow",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  sword: {
    stroke: "strike",
    looses: "none",
    loosed: 0.25,
    fighter: "a swordsman",
    shotWords: "an arrow",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  claws: {
    stroke: "strike",
    looses: "none",
    loosed: 0.25,
    fighter: "a clawed fighter",
    shotWords: "an arrow",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  mandibles: {
    stroke: "bite",
    looses: "none",
    loosed: 0.25,
    fighter: "a biter",
    shotWords: "an arrow",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  tusks: {
    stroke: "thrust",
    looses: "none",
    loosed: 0.25,
    fighter: "a tusker",
    shotWords: "an arrow",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  grapple: {
    stroke: "grapple",
    looses: "none",
    loosed: 0.25,
    fighter: "a grappler",
    shotWords: "an arrow",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  bow: {
    stroke: "strike",
    looses: "arrows",
    loosed: 0.25,
    fighter: "a bowman",
    shotWords: "an arrow",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  "horn-bow": {
    stroke: "strike",
    looses: "arrows",
    loosed: 0.25,
    fighter: "a bowman",
    shotWords: "an arrow",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  "shell-darts": {
    stroke: "thrust",
    looses: "darts",
    loosed: 0.25,
    fighter: "a darter",
    shotWords: "a dart",
    burst: 1,
    smoke: 0,
    bayonet: false,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  musket: {
    stroke: "thrust",
    looses: "shot",
    loosed: 0.45,
    fighter: "a musketeer",
    shotWords: "a musket ball",
    long: 1,
    burst: 1,
    smoke: 1,
    bayonet: true,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  rifle: {
    stroke: "thrust",
    looses: "shot",
    loosed: 0.6,
    fighter: "a rifleman",
    shotWords: "a bullet",
    long: 0.9,
    burst: 1,
    smoke: 1,
    bayonet: true,
    order: "close",
    fire: "volley",
    ladders: true,
  },
  repeater: {
    stroke: "thrust",
    looses: "shot",
    loosed: 0.65,
    fighter: "a rifleman",
    shotWords: "a bullet",
    long: 0.9,
    burst: 1,
    smoke: 1,
    bayonet: true,
    order: "open",
    fire: "continuous",
    ladders: true,
  },
  autoloader: {
    stroke: "thrust",
    looses: "shot",
    loosed: 0.7,
    fighter: "a rifleman",
    shotWords: "a bullet",
    long: 0.85,
    burst: 1,
    smoke: 0.15,
    bayonet: true,
    order: "open",
    fire: "continuous",
    ladders: false,
  },
  automatic: {
    stroke: "strike",
    looses: "shot",
    loosed: 0.8,
    fighter: "a machine gunner",
    shotWords: "a machine-gun bullet",
    long: 1.1,
    burst: 5,
    smoke: 0.15,
    bayonet: false,
    order: "open",
    fire: "continuous",
    ladders: false,
    team: 6,
    rest: "autoloader",
  },
};

/** What the views do for an arm with no row, or for no arm at all: a blow, no shot, "one" who fought. */
export const DEFAULT_LOOK: ArmLook = {
  stroke: "strike",
  looses: "none",
  loosed: 0.25,
  fighter: "one",
  shotWords: "an arrow",
  burst: 1,
  smoke: 0,
  bayonet: false,
  order: "close",
  fire: "volley",
  ladders: true,
};

/** An arm's look: its row, else DEFAULT_LOOK (an own row only, so no inherited name reads as one). */
export function armLook(arm: string | undefined): ArmLook {
  return arm !== undefined && Object.hasOwn(ARM_LOOKS, arm) ? ARM_LOOKS[arm]! : DEFAULT_LOOK;
}

/** Whether an arm fires powder and shot (Phase 37 M188): a musket, a rifle, and the guns since. */
export function isGun(arm: string | undefined): boolean {
  return armLook(arm).looses === "shot";
}
