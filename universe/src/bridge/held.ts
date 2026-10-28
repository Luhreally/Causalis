// A soldier or a beast possessed (Phase 61): what the page sends to take one (`possess.soldier`,
// `possess.beast`), to steer it a second at a time and let it go (`possess.held`, `possess.leave`, as
// a person's: bridge/possess.ts PossessInputArgs without those joining), and what the host answers of
// the small world about it (`held.now`, `held.live`) and of a battle the god fought (`held.fought`).
// The page builds the taking from what it draws (view/fight.ts, view/wild.ts) and draws the bodies
// the host steps; the host keeps the world (sim/hand/fight.ts, sim/hand/wild.ts) and tells it in
// words (host/held.ts).
import type { PossessOffer, PossessStrip } from "./possess.ts";

/** What a side looses from afar: nothing, arrows, darts, or shot (rules/fight.ts LOOSES). */
export type Looses = "none" | "arrows" | "darts" | "shot";

/**
 * `possess.soldier`: the battle (its event); the field as the page laid it — its figures a side, the
 * men a figure stands for, where the lines meet — and the one taken: his figure and side, his roll's
 * ref, name and town; what each side looses and whether it rides; each side's figures and those of
 * them fallen before now; the bodies, he first (figure, side, x, z, yaw, its own draw: six numbers
 * each, at most 240), and each one's ref and name as the roll names it.
 */
export type SoldierTakeArgs = {
  readonly battle: string;
  readonly most: number;
  readonly per: number;
  readonly meet: number;
  readonly figure: number;
  readonly side: 0 | 1;
  readonly ref: string;
  readonly name: string;
  readonly town: string;
  readonly looses: readonly [Looses, Looses];
  readonly mounted: readonly [boolean, boolean];
  readonly figures: readonly [number, number];
  readonly before: readonly [number, number];
  readonly bodies: readonly number[];
  readonly refs: readonly string[];
  readonly names: readonly string[];
};

/**
 * `possess.beast`: the town it was drawn about, what it is called; the kinds of the small world (each
 * a lineage's ref); the bodies, it first (id, kind, herd, x, z, yaw: six numbers each, at most 120),
 * each one's member of the town's flock (-1: the wild's); each herd's middle and whether it is the
 * town's flock (x, z, 0 or 1 each); the water near and the flock's pasture (x, z, r; []: none).
 */
export type BeastTakeArgs = {
  readonly village: string;
  readonly name: string;
  readonly kinds: readonly string[];
  readonly bodies: readonly number[];
  readonly members: readonly number[];
  readonly herds: readonly number[];
  readonly water: readonly number[];
  readonly pasture: readonly number[];
};

/** A soldier held, as taken (`held.now`). */
export type HeldSoldierNow = {
  readonly kind: "soldier";
  readonly name: string;
  readonly town: string;
  readonly ref: string;
  readonly battle: string;
  readonly war: string;
  readonly side: 0 | 1;
  readonly figure: number;
  readonly most: number;
  readonly per: number;
  /** The world's moment he was taken, the battle's second it was, and the step kept. */
  readonly from: number;
  readonly second: number;
  readonly step: number;
  /** The figures of the small world (by its bodies' order), him first. */
  readonly bodies: readonly number[];
  /** What each side's blow is (rules/blows.ts Blow: "edge", "point", "shot", …), for its wounds' look. */
  readonly blows: readonly [string, string];
  readonly ended: string;
};
/** A beast held, as taken (`held.now`). */
export type HeldBeastNow = {
  readonly kind: "beast";
  readonly name: string;
  /** Its lineage's ref and name; the town it was drawn about, its ref and name. */
  readonly species: string;
  readonly kindName: string;
  readonly village: string;
  readonly townName: string;
  readonly from: number;
  readonly step: number;
  /** Where it was taken (metres from the town's middle). */
  readonly x: number;
  readonly z: number;
  /** The bodies of the small world (their ids, view/fauna.ts BeastNow.id), it first; each one's member of the flock (-1). */
  readonly bodies: readonly number[];
  readonly members: readonly number[];
  readonly ended: string;
};
export type HeldNow = HeldSoldierNow | HeldBeastNow;

/**
 * A body of a held one's small world as the page draws it: which (a figure of the field, a beast's
 * id), where (the field's metres, the town's), which way it goes; what it is doing (rules/fight.ts
 * FIGHT_DOINGS, rules/wild.ts WILD_DOINGS); how hurt (0 … 1), the place struck last and the place cut
 * off (rules/blows.ts BLOW_PLACES' index; -1 none).
 */
export type HeldBody = {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly vx: number;
  readonly vz: number;
  readonly doing: string;
  readonly hurt: number;
  readonly struck: number;
  readonly lost: number;
  /** Battle seconds of the disabling blow (read from its deed, never separate saved state). */
  readonly struckAt?: number;
};

/** One side of a battle as the tally tells it: its realm (and its seat's name, as the bar names it), its men standing and fallen (so many a figure). */
export type HeldSide = {
  readonly realm: string;
  readonly short: string;
  readonly standing: number;
  readonly fallen: number;
  readonly morale?: number;
};
/** One struck down in a soldier's fight, named: by whom, dead or wounded out of it, by the god's hand. */
export type HeldFallen = {
  readonly name: string;
  readonly side: 0 | 1;
  readonly dead: boolean;
  readonly by: string;
  readonly god: boolean;
};
/**
 * The battle's tally while a soldier is held: each side, the last struck down named, the side broken
 * (-1 none) and the battle second it broke at (-1), his side.
 */
export type HeldTally = {
  readonly sides: readonly [HeldSide, HeldSide];
  readonly named: readonly HeldFallen[];
  readonly broke: -1 | 0 | 1;
  readonly brokeAt: number;
  readonly mine: 0 | 1;
};

/** A held one's small world as the host steps it ahead by the bids not yet sent (`held.live`). */
export type HeldLive = {
  readonly kind: "soldier" | "beast";
  readonly step: number;
  readonly kept: number;
  readonly bodies: readonly HeldBody[];
  readonly offers: readonly PossessOffer[];
  readonly told: { readonly words: string; readonly step: number; readonly good: boolean } | null;
  readonly strip: PossessStrip;
  /** A soldier's battle as it stands (null: a beast's). */
  readonly tally: HeldTally | null;
  readonly ended: string;
};

/**
 * A battle the god fought in a soldier's body, at a step of its fight (`held.fought`): who he was and
 * where, the field it was laid at, the moments he was taken and let go, the battle's second he was
 * taken at, the step this is and the last it was fought to, its bodies then, the side broken and the
 * battle second it broke at (-1: none), each side's blow.
 */
export type FoughtNow = {
  readonly battle: string;
  readonly name: string;
  readonly figure: number;
  readonly side: 0 | 1;
  readonly most: number;
  readonly per: number;
  readonly from: number;
  readonly to: number;
  readonly second: number;
  readonly step: number;
  readonly last: number;
  readonly bodies: readonly HeldBody[];
  readonly broke: -1 | 0 | 1;
  readonly brokeAt: number;
  readonly blows: readonly [string, string];
};
