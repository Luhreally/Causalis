// A battle fought before the eye (Phase 37 M184, asked for 2026-10-24: "i still cant see warfare
// and like wars like theres no coherent animations and battle between them or a way to make time
// in a way for me to see the carnage"): the battle history fought, played out on a clock of its
// own. The two hosts drawn up in their ranks under their banners — a figure for every man, or
// for so many — with what they fought with; the attackers coming on, arrows falling on them where
// either side has bows; the charge; the lines meeting, each front rank at the one before it, those
// behind stepping up as the front falls; the line giving way where it is beaten; the beaten
// breaking and running, the victors after them; the field after, the fallen where they fell, the
// victors cheering under their banners. At a seat, before its walls: held, a siege laid about it,
// or its gate broken and the town taken, burning. As many fall of each side as history says fell
// (so many figures for so many men). Pure: the same moment of a battle always looks the same.
// Metres on the field, x from the attackers' side (−) to the defenders' (+), z across.
import type { BattleNear } from "../bridge/index.ts";
import { armLook, isGun, type Stroke } from "./arms.ts";
import { cellMiddle, type MeadowState } from "./meadow.ts";

export type { Stroke } from "./arms.ts";

/** How long a battle plays at its own pace, in its seconds: two and a half minutes. */
export const BATTLE_LENGTH = 150;
/** The battle's speeds: paused, half, its own, twice and four times. */
export const BATTLE_SPEEDS = [0, 0.5, 1, 2, 4] as const;
/** The field's half-width (x) and half-depth (z), metres: the meadow it is fought on. */
export const FIELD = { x: 70, z: 45 } as const;

/** When each part of a battle begins (its seconds). */
export const MOMENTS = {
  advance: 10,
  arrows: 16,
  charge: 40,
  melee: 48,
  gate: 100,
  rout: 108,
  after: 130,
} as const;

/**
 * A wing's wheel about the other host's flank (where one host's front reaches far past the
 * other's): from when to when, and how far it turns (radians, short of a right angle).
 */
const WHEEL = { from: MOMENTS.melee + 3, to: MOMENTS.melee + 20, turn: 1.4 } as const;

/**
 * The wounded who crawl (of those struck down by blows and arrows, not cut down running): what
 * share of them, how long after they fall they begin, how fast they go (m a second), and for how
 * long at least and at most — back toward their own lines, before they lie still.
 */
export const CRAWL = { share: 0.28, after: 1.2, pace: 0.32, least: 5, most: 13 } as const;

/**
 * Open order (Phase 53 M220): the metres between files, the rank gap (m), the depth (m) a host
 * stands no deeper than, and how many files fit across the field.
 */
const OPEN = { file: 3, rank: 4, depth: 30, files: Math.floor((2 * FIELD.z - 6) / 3) + 1 } as const;

/**
 * The rushes an attacker in open order comes on in, from the advance to the charge (Phase 53
 * M220): the field taken in so many bounds, a cycle of the two groups' rushes (the second group
 * `apart` s after the first), how long a rush lasts (s), how far each one's timing is shifted (s),
 * and how far a machine gun's team rushes to its place (a share of the way to the stop).
 */
const RUSH = { bounds: 5, cycle: 6, long: 2.2, apart: 3, shift: 0.6, gun: 0.4 } as const;

/**
 * Fire without pause (Phase 53 M220): how long a ball flies (s), how far apart a burst's rounds
 * are (s), the most shots a side fires in a second, and the most rounds it looses in all.
 */
const SHOTS = { flight: 0.15, burst: 0.09, most: 12, rounds: 700 } as const;

/**
 * What one who fought is at ("prone": down in the grass between rushes, firing; Phase 53 M220).
 * Phase 55's blows (view/blows.ts) add the wounded who live: reeling ("stagger"), down on one knee
 * clutching the wound ("kneel"), limping back ("limp"), propped on one who helps ("propped"),
 * sitting behind the lines ("sit"), slumped in the saddle ("slump"); and one who helps ("help").
 */
export type Act =
  | "stand"
  | "march"
  | "run"
  | "brace"
  | "fight"
  | "loose"
  | "fall"
  | "flee"
  | "cheer"
  | "prone"
  | "stagger"
  | "kneel"
  | "limp"
  | "propped"
  | "sit"
  | "slump"
  | "help";

/** Where a blow lands (Phase 55): the rule of nines' places, each arm's hand apart. */
export type BlowPlace =
  "head" | "trunk" | "arm-l" | "arm-r" | "hand-l" | "hand-r" | "leg-l" | "leg-r";
/** The places, in order (each one's bit in the render's masks is 1 << its index). */
export const BLOW_PLACES: readonly BlowPlace[] = [
  "head",
  "trunk",
  "arm-l",
  "arm-r",
  "hand-l",
  "hand-r",
  "leg-l",
  "leg-r",
];
/**
 * The parts of a figure each place is made of (indices into its parts), and the part its wounds
 * are drawn on (−1: none): view/blows.ts's figureAnatomy.
 */
export type FigureAnatomy = {
  readonly parts: Readonly<Record<BlowPlace, readonly number[]>>;
  readonly on: Readonly<Record<BlowPlace, number>>;
};
/** What a blow may cut off: a limb, a hand, or (of the dead, to an edge or a ball) the head. */
export type BlowLost = Exclude<BlowPlace, "trunk">;
/** How one struck dead goes down: a leg giving way, folding where they stood, thrown back, knocked off their feet. */
export type BlowFall = "buckle" | "crumple" | "thrown" | "blasted";
/** A wound's look: a cut, a stab, a hole (an arrow's, a ball's), a bruise, a smashed wound, a stump. */
export type WoundMark = "cut" | "stab" | "hole" | "bruise" | "smash" | "stump";
/** How long each way of going down takes (s): the view moves the body, the render poses it, alike. */
export const FALL_LONG: Readonly<Record<BlowFall, number>> = {
  buckle: 0.9,
  crumple: 0.85,
  thrown: 0.5,
  blasted: 0.6,
};
/** How long one wounded who lives reels from the blow before going down on a knee (s). */
export const STAGGER = 0.6;

/** A wound now, on one struck (the render poses it on their part as drawn). */
export type WoundNow = {
  readonly id: number;
  readonly place: BlowPlace;
  /** The point on its part's face, across it and along it (each −0.45 … 0.35 of its extent). */
  readonly u: number;
  readonly v: number;
  /** The face it is on: the front (1, toward the foe) or the back (−1). */
  readonly face: 1 | -1;
  readonly mark: WoundMark;
  /** The wound (m of the figure), and the blood about it as it has spread (m). */
  readonly size: number;
  readonly bleed: number;
  /** Fresh (wet), and how long since struck (s). */
  readonly wet: boolean;
  readonly age: number;
  /** The drops of blood thrown from it now (0: none). */
  readonly spray: number;
};
/** A shaft stuck where it struck: its way in against their facing, how steeply (rad); a dart's. */
export type StuckNow = {
  readonly id: number;
  readonly place: BlowPlace;
  readonly u: number;
  readonly v: number;
  /** Its flight's way against their facing (rad: π, straight at their face), and how steeply it came down (rad). */
  readonly yaw: number;
  readonly dip: number;
  readonly dart: boolean;
};
/** A part cut off, now: whose, which, where (m: y above the ground), turned (rad). */
export type LimbNow = {
  readonly id: number;
  readonly side: 0 | 1;
  readonly lost: BlowLost;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly pitch: number;
};

/** How a host is carried and what it fights with, as the field shows it. */
export type HostDrawn = {
  /** How many figures it is drawn as, in how many files and ranks. */
  readonly n: number;
  readonly files: number;
  readonly ranks: number;
  /** On horses (riders) or in chariots: drawn mounted, wider apart, faster. */
  readonly mounted: "horse" | "chariot" | null;
  /** Whether it looses arrows (or darts) before the lines meet. */
  readonly missiles: boolean;
  readonly stroke: Stroke;
  /** How many of its figures fall (as many as fell of its men, so many figures for so many). */
  readonly falls: number;
  /**
   * In open order (Phase 53 M220: the magazine rifle and since): files and ranks wide apart, coming
   * on in rushes and going to ground between them, firing as each will (absent: shoulder to shoulder).
   */
  readonly open?: true;
  /** How many armoured cars go with it (absent: none). */
  readonly vehicles?: number;
};

/** An armoured car brought to the field (Phase 53 M220): where across it goes, and its fate. */
export type Vehicle = {
  readonly id: number;
  readonly side: 0 | 1;
  /** Where across the field it goes (m). */
  readonly z: number;
  /** When it is knocked out (battle seconds; null: it comes through). */
  readonly knocked: number | null;
  /** Its own draw (0 … 1). */
  readonly u: number;
};

/** An armoured car now. */
export type VehicleNow = {
  readonly id: number;
  readonly side: 0 | 1;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Which way its hull faces (radians, as a trooper's yaw). */
  readonly yaw: number;
  /** Its turret's turn from its hull's facing (radians). */
  readonly turret: number;
  /** Its gun's kick as it fires (1, easing to 0). */
  readonly recoil: number;
  /** How far knocked out (0 running … 1 a wreck), and how fiercely it burns (0 … 1). */
  readonly knocked: number;
  readonly burning: number;
};

/** One who fought: their place in their host, their fate in the battle. */
export type Trooper = {
  readonly id: number;
  /** 0 the attackers, 1 the defenders. */
  readonly side: 0 | 1;
  readonly file: number;
  readonly rank: number;
  /** Where across the field their file stands (metres). */
  readonly z: number;
  /** A banner's bearer. */
  readonly bearer: boolean;
  /** When they fall (battle seconds; null: they live through it), and how. */
  falls: number | null;
  by: "arrow" | "blow" | "rout" | null;
  /** When they turn and run (the beaten; null: they hold). */
  flees: number | null;
  /** Of the victors' front, who go after the beaten. */
  pursues: boolean;
  /** Through the broken gate, at a seat stormed. */
  gate: boolean;
  /** Their own draw (0 … 1): their step, their pace. */
  readonly u: number;
  /** Of a machine gun's team, at its tripod (Phase 53 M220; absent: they bear their own arm). */
  gun?: true;
  /** Where they lie, once worked out (they lie where they fell). */
  lies?: { x: number; z: number; yaw: number; run: boolean; fled: number };
};

/** A cannon brought to the field: where it stands (m), which way it points, when it fires. */
export type Cannon = {
  readonly side: 0 | 1;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly fires: readonly number[];
};

/** An arrow loosed: from where, at what, when, how long it flies; whom it strikes (-1: the ground). */
export type Arrow = {
  readonly side: 0 | 1;
  readonly from: { readonly x: number; readonly z: number };
  readonly to: { readonly x: number; readonly z: number };
  readonly at: number;
  readonly flight: number;
  readonly hits: number;
  /** A gun's ball (none seen in flight: its muzzle's flash and smoke), not an arrow. */
  readonly shot?: boolean;
};

export type BattleGround = {
  /** A ridge the defenders hold: its middle (x), its reach along and across, its height (m). */
  readonly hill: {
    readonly x: number;
    readonly rx: number;
    readonly rz: number;
    readonly h: number;
  } | null;
  /** A river between them: its middle (x) and half its width. */
  readonly river: { readonly x: number; readonly w: number } | null;
  /** A seat's walls: their line (x), how high, the gate's half-width; the town behind them. */
  readonly wall: {
    readonly x: number;
    readonly high: number;
    readonly gate: number;
    readonly stone: boolean;
  } | null;
  /**
   * The trench the defenders dug where they stand in open order, in the open (Phase 53 M220): its
   * line (x), half its width and its depth (m) (absent: none).
   */
  readonly trench?: { readonly x: number; readonly w: number; readonly depth: number };
};

export type BattleField = {
  readonly near: BattleNear;
  /** How many men a figure stands for. */
  readonly per: number;
  readonly hosts: readonly [HostDrawn, HostDrawn];
  readonly troopers: readonly Trooper[];
  /** Each side's files, each front first (who steps up as the front falls). */
  readonly files: readonly (readonly (readonly Trooper[])[])[];
  readonly arrows: readonly Arrow[];
  /**
   * At a seat's walls, the attackers' ladders: where along the walls (z, m), when each is raised
   * against them, and when thrown down (null: where the walls did not hold, they stay).
   */
  readonly ladders: readonly {
    readonly z: number;
    readonly up: number;
    readonly down: number | null;
    /** The one who climbs it (-1: none). */
    readonly climber: number;
  }[];
  /** The cannon each side brought, where its realm knew black powder (Phase 37 M188). */
  readonly cannon: readonly Cannon[];
  /** The side beaten: 1 where the attackers won, else 0. */
  readonly beaten: 0 | 1;
  readonly ground: BattleGround;
  /** Where the lines meet when they first meet (x), and how far the victors drive them (m). */
  readonly meet: number;
  readonly drive: number;
  /** What is told as the battle goes: from when, in words. */
  readonly moments: readonly { readonly at: number; readonly words: string }[];
  /**
   * The host whose front reaches far past the other's, in the open, and where the other's flanks
   * are (|z|, m): its files beyond them wheel about them once the lines have met (none: neither).
   */
  readonly wings: { readonly side: 0 | 1; readonly z: number } | null;
  /** The armoured cars of both sides (Phase 53 M220; absent: none). */
  readonly vehicles?: readonly Vehicle[];
  /**
   * Fought before a town in its own scene (Phase 55 M227): on the town's flat ground, with no ridge or
   * river of its own; the beaten defenders fly to either flank, or in behind their walls, out of
   * sight there (absent: the close field).
   */
  readonly placed?: true;
};

/**
 * One who fought, now. Each is made with every field below, in this order, those unset undefined:
 * one shape for all, so the render's loops over them stay fast however they are marked (Phase 55).
 */
export type TrooperNow = {
  readonly id: number;
  readonly side: 0 | 1;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Which way they face (radians: 0 toward +z, π/2 toward +x). */
  readonly yaw: number;
  readonly act: Act;
  /** Their stride's or their stroke's turn (seconds of its own). */
  readonly cycle: number;
  /** How far toppled (0 standing … 1 lying), and whether onto their back. */
  readonly down: number;
  readonly back: boolean;
  /** How much of them is drawn (they fade at the field's edge, run off it). */
  readonly size: number;
  readonly bearer: boolean;
  /** Wounded, dragging themselves back toward their own lines (1), or not (0). */
  readonly crawl: number;
  /** At a machine gun on its tripod, set before them (Phase 53 M220; unset: not). */
  readonly gun?: true;
  /**
   * Phase 55 (view/blows.ts; unset: not struck): where they were struck, how long ago (s), the
   * part cut off, and how they went down (unset: as the battle lays them).
   */
  readonly hit?: BlowPlace;
  readonly since?: number;
  readonly lost?: BlowLost;
  readonly fell?: BlowFall;
};

export type BattleNow = {
  readonly s: number;
  readonly troopers: readonly TrooperNow[];
  /** Arrows in flight: where, which way along (yaw) and up (pitch). */
  readonly flying: readonly { x: number; y: number; z: number; yaw: number; pitch: number }[];
  /** Arrows spent in the ground. */
  readonly spent: readonly { x: number; z: number; yaw: number }[];
  /** The blood of the fallen: where, how wide (m). */
  readonly blood: readonly { x: number; z: number; r: number }[];
  /** The blood thrown up as a blow or an arrow strikes home (m). */
  readonly spray: readonly { x: number; y: number; z: number; r: number }[];
  /** Powder smoke where guns have fired, drifting off; a muzzle's flash as one fires (m). */
  readonly smoke: readonly { x: number; y: number; z: number; r: number }[];
  readonly flashes: readonly { x: number; y: number; z: number; yaw: number }[];
  /** The cannon where they stand, each thrown back as it fires (recoil 1, easing to 0). */
  readonly cannon: readonly { x: number; z: number; yaw: number; recoil: number }[];
  /** Dust thrown up where they run and fight. */
  readonly dust: readonly { x: number; y: number; z: number; r: number }[];
  /** Each side's figures standing and fallen (of those drawn). */
  readonly standing: readonly [number, number];
  readonly fallen: readonly [number, number];
  /**
   * The ladders at a seat's walls: the foot of each (x, z, m), how far it is raised (radians up off
   * the ground toward the walls: past a right angle, thrown down away from them), how long (m).
   */
  readonly ladders: readonly { x: number; z: number; rise: number; long: number }[];
  /** How far the gate stands open (0 … 1), the fires in the town (0 … 1), the siege's tents pitched (0 … 1). */
  readonly gate: number;
  readonly burning: number;
  readonly camp: number;
  /** What is told now. */
  readonly words: string;
  /** The armoured cars (Phase 53 M220; absent: none). */
  readonly vehicles?: readonly VehicleNow[];
  /** Black smoke rising off burning wrecks, and the flames on them (m; absent: none). */
  readonly fumes?: readonly { x: number; y: number; z: number; r: number }[];
  readonly flames?: readonly { x: number; y: number; z: number; r: number }[];
  /**
   * Phase 55 (view/blows.ts; absent: none): the wounds on those struck, the shafts stuck in them,
   * the parts cut off, and each side's wounded who lived struck so far.
   */
  readonly wounds?: readonly WoundNow[];
  readonly stuck?: readonly StuckNow[];
  readonly limbs?: readonly LimbNow[];
  readonly hurt?: readonly [number, number];
};

/** The most figures a side is drawn as (a phone draws fewer). */
export function mostFor(detail: number): number {
  return detail >= 2 ? 360 : 120;
}

/** A keyed draw (0 … 1). */
function unit(a: number, b: number): number {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** How a host's arm strikes hand to hand (its row in the arms table). */
export function strokeOf(arm: string | undefined): Stroke {
  return armLook(arm).stroke;
}

/** Whether a host's arm looses at a distance: arrows, darts, or powder and shot. */
export function loosesFrom(arm: string | undefined): boolean {
  return armLook(arm).looses !== "none";
}

/** Whether a host's arm fires powder and shot (Phase 37 M188): a musket, a rifle, the guns since. */
export function firesFrom(arm: string | undefined): boolean {
  return isGun(arm);
}

/** The share of a host's dead that fall to what the other side looses: more to shot than to arrows. */
function loosedShare(arm: string | undefined): number {
  return armLook(arm).loosed;
}

/** Metres between files and between ranks: riders and chariots stand wider. */
function spacing(mounted: HostDrawn["mounted"]): { file: number; rank: number } {
  return mounted === "chariot"
    ? { file: 3.6, rank: 4.6 }
    : mounted === "horse"
      ? { file: 2.6, rank: 3.6 }
      : { file: 1.55, rank: 1.9 };
}

/**
 * A host's gaps, in metres between files and between ranks: close order as it always stood; in
 * open order (Phase 53 M220) three metres between files and four between ranks, but no deeper
 * than the depth allows.
 */
export function gapOf(h: HostDrawn): { file: number; rank: number } {
  return h.open
    ? { file: OPEN.file, rank: Math.min(OPEN.rank, OPEN.depth / Math.max(1, h.ranks - 1)) }
    : spacing(h.mounted);
}

/** The ground's height under a point (a ridge the defenders hold). */
export function battleGroundAt(g: BattleGround, x: number, z: number): number {
  const h = g.hill;
  if (!h) return 0;
  const a = (x - h.x) / h.rx,
    b = z / h.rz;
  return h.h * Math.max(0, 1 - a * a) * Math.max(0, 1 - b * b);
}

/**
 * A battle made ready to watch: its hosts drawn up, as many figures each as the men it had (or
 * one for so many: `most` the most of a side), and each one's fate in it — who falls, when and
 * how, who runs, who gives chase — as history's numbers have it. `placed`: fought before a town in
 * its own scene (Phase 55 M227), on the town's ground.
 */
export function newBattle(near: BattleNear, most: number, placed = false): BattleField {
  const key = hashText(near.event),
    a = near.attacker,
    d = near.defender,
    per = Math.max(1, Math.ceil(Math.max(a.fielded, d.fielded, 1) / most)),
    beaten: 0 | 1 = near.won ? 1 : 0,
    walls = near.walls > 0,
    ground: BattleGround = {
      // (Before a town the ground is the town's own, flat: no ridge or river of the field's.)
      hill: near.hills && !walls && !placed ? { x: 18, rx: 17, rz: 52, h: 3.6 } : null,
      river: near.river && !walls && !placed ? { x: 3, w: 3.2 } : null,
      wall: walls
        ? { x: 14, high: near.walls === 2 ? 3.4 : 2.6, gate: 3.6, stone: near.walls === 2 }
        : null,
    };
  // Each host as the field draws it.
  const drawnOf = (s: typeof a, side: 0 | 1): HostDrawn => {
    const n = Math.max(1, Math.round(s.fielded / per)),
      look = armLook(s.host?.arm),
      // (In open order a host fights on foot: the magazine's riders dismount to it.)
      open = look.order === "open",
      // (Behind its walls a seat's defenders stand them on foot, their horses within.)
      mount = side === 1 && walls ? undefined : s.host?.mount,
      mounted: HostDrawn["mounted"] = open
        ? null
        : mount === "chariot"
          ? "chariot"
          : mount === "horse" || mount === "cavalry"
            ? "horse"
            : null,
      files = open
        ? Math.max(1, Math.min(n, OPEN.files, Math.round(Math.sqrt(n * 1.6))))
        : Math.max(1, Math.min(n, Math.round(Math.sqrt(n * (mounted ? 2.2 : 3.6))))),
      ranks = Math.ceil(n / files),
      // (As many fall as fell of its men: the victors keep some standing, the beaten a few.)
      most = side === beaten ? Math.ceil(n * 0.92) : n - 1,
      falls = Math.max(s.fallen > 0 && n > 1 ? 1 : 0, Math.min(most, Math.round(s.fallen / per)));
    return {
      n,
      files,
      ranks,
      mounted,
      missiles: loosesFrom(s.host?.arm),
      // (The rest of a machine gun's team strike with the arm they bear, not the gun's.)
      stroke: strokeOf(look.rest ?? s.host?.arm),
      falls,
      ...(open ? { open: true as const } : {}),
      // (An armoured host brings its cars: one for so many of its figures, from one to sixteen.)
      ...(s.host?.mount === "armoured"
        ? { vehicles: Math.min(16, Math.max(1, Math.round(n / 12))) }
        : {}),
    };
  };
  const hosts = [drawnOf(a, 0), drawnOf(d, 1)] as const;
  // Where the lines meet: at the defenders' front (before their walls, on their ridge's brow,
  // past the river), and how far the victors drive the beaten before they break.
  const meet = ground.wall ? ground.wall.x - 1.3 : ground.river ? 8.4 : ground.hill ? 8 : 6,
    // (The defenders in open order dig a trench where they stand, in the open (Phase 53 M220): it
    // holds, so the lines do not drive.)
    trench = hosts[1].open && !walls ? { x: meet + 1, w: 0.7, depth: 1.25 } : undefined,
    drive = ground.wall || trench ? 0 : near.won ? 5 : -5;
  // Each one in their rank and file.
  const troopers: Trooper[] = [];
  for (const side of [0, 1] as const) {
    const h = hosts[side],
      gap = gapOf(h).file,
      // (A machine gun's team: the first two ranks, every third file, are its gunners.)
      team = armLook((side === 0 ? a : d).host?.arm).team !== undefined;
    for (let i = 0; i < h.n; i++) {
      const file = i % h.files,
        rank = Math.floor(i / h.files),
        // (The last rank, short, stands to the middle.)
        inRank = rank === h.ranks - 1 ? h.n - rank * h.files : h.files,
        across = (file - (inRank - 1) / 2) * gap,
        u = unit(key + side * 7919, i),
        gun = team && rank < 2 && file % 3 === 1;
      troopers.push({
        id: troopers.length,
        side,
        file,
        rank,
        z: Math.max(-FIELD.z + 3, Math.min(FIELD.z - 3, across + (u - 0.5) * gap * 0.3)),
        // (Those in open order carry no banners.)
        bearer:
          !h.open && rank === 1 % h.ranks && (file === Math.floor(inRank / 2) || file % 14 === 7),
        falls: null,
        by: null,
        flees: null,
        pursues: false,
        gate: false,
        u,
        ...(gun ? { gun: true as const } : {}),
      });
    }
  }
  // A front reaching far past the other's, in the open (no walls, no river between), closes its
  // wings about the other's flanks.
  const reach = [0, 1].map((side) =>
      troopers.reduce((m, t) => (t.side === side ? Math.max(m, Math.abs(t.z)) : m), 0),
    ),
    wider: 0 | 1 = reach[0]! >= reach[1]! ? 0 : 1,
    narrow = reach[wider === 0 ? 1 : 0]!,
    wings =
      !ground.wall && !ground.river && reach[wider]! > narrow + 6
        ? { side: wider, z: narrow + 1.5 }
        : null;
  // At a seat's walls, the attackers' ladders along their front, either side of the gate: raised
  // against the walls as they rush them, thrown down where the walls held.
  const ladders: { z: number; up: number; down: number | null; climber: number }[] = [];
  // (From the self-loading rifle on, the attackers raise no ladders: they blow the gate instead.)
  if (ground.wall && armLook(a.host?.arm).ladders) {
    const gate = ground.wall.gate,
      far = Math.max(gate + 4, Math.min(reach[0]!, FIELD.z - 5)),
      n = Math.max(2, Math.min(7, Math.round(hosts[0].files / 5))),
      each = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const out = i % 2 ? 1 : -1,
        k = Math.floor(i / 2);
      ladders.push({
        z: out * (gate + 3 + ((far - gate - 3) * (k + 0.5)) / each + (unit(key, 300 + i) - 0.5)),
        up: MOMENTS.melee + 0.5 + 2.5 * unit(key, 310 + i),
        down: near.outcome === "held" ? MOMENTS.rout - 4 + 3 * unit(key, 320 + i) : null,
        climber: -1,
      });
    }
    // (Who climbs each: the one at the front of the file nearest it.)
    const taken = new Set<number>();
    for (const l of ladders) {
      let best: Trooper | null = null;
      for (const t of troopers)
        if (
          t.side === 0 &&
          t.rank === 0 &&
          !taken.has(t.id) &&
          (!best || Math.abs(t.z - l.z) < Math.abs(best.z - l.z))
        )
          best = t;
      if (best) {
        taken.add(best.id);
        l.climber = best.id;
      }
    }
  }
  // The armoured cars of both sides, spread across the front. A keyed few of each side's are
  // knocked out: as many as its falls were of its figures, at most three in four of them.
  const vehicles: Vehicle[] = [];
  for (const side of [0, 1] as const) {
    const h = hosts[side],
      count = h.vehicles ?? 0,
      wrecked = new Set(
        Array.from({ length: count }, (_, i) => i)
          .sort((p, q) => unit(key + 5000 + side, p) - unit(key + 5000 + side, q))
          .slice(0, Math.round(count * Math.min(0.75, (1.2 * h.falls) / Math.max(1, h.n)))),
      );
    for (let i = 0; i < count; i++)
      vehicles.push({
        id: vehicles.length,
        side,
        z:
          (i - (count - 1) / 2) * Math.min(10, (2 * FIELD.z - 10) / count) +
          (unit(key + 5100 + side, i) - 0.5) * 2,
        // (Knocked out at a keyed time, from the arrows' sixth second to the rout's fourth.)
        knocked: wrecked.has(i)
          ? MOMENTS.arrows +
            6 +
            (MOMENTS.rout + 4 - MOMENTS.arrows - 6) * unit(key + 5200 + side, i)
          : null,
        u: unit(key + 5300 + side, i),
      });
  }
  const field: BattleField = {
    near,
    per,
    hosts,
    troopers,
    files: [0, 1].map((side) =>
      Array.from({ length: hosts[side]!.files }, (_, f) =>
        troopers.filter((t) => t.side === side && t.file === f).sort((p, q) => p.rank - q.rank),
      ),
    ),
    arrows: [],
    cannon: cannonOf(near, key),
    ladders,
    beaten,
    ground: trench ? { ...ground, trench } : ground,
    meet,
    drive,
    moments: momentsOf(near, wings, vehicles, trench !== undefined),
    wings,
    ...(vehicles.length ? { vehicles } : {}),
    ...(placed ? { placed: true as const } : {}),
  };
  fates(field, key);
  return field;
}

/**
 * The cannon a side brings where its realm knows black powder: the attackers' behind their line
 * on its flanks, firing as they come on and until the lines meet (at a seat, until its gate is
 * broken); the defenders' at their line (on their walls, at a seat), firing the while.
 */
function cannonOf(near: BattleNear, key: number): Cannon[] {
  const out: Cannon[] = [];
  for (const side of [0, 1] as const) {
    const s = side === 0 ? near.attacker : near.defender;
    if (!s.cannon) continue;
    const n = Math.max(2, Math.min(6, Math.round(Math.sqrt(s.fielded) / 6))),
      walls = near.walls > 0,
      until = side === 0 && walls && near.outcome === "stormed" ? MOMENTS.gate : MOMENTS.melee - 2;
    for (let i = 0; i < n; i++) {
      const across = (i - (n - 1) / 2) * 9 + (unit(key + side, i + 71) - 0.5) * 2,
        x = side === 0 ? -40 - 3 * unit(key, i + 81) : walls ? 17 : 26 + 2 * unit(key, i + 91),
        fires: number[] = [];
      for (let at = MOMENTS.advance + 4 + 3 * unit(key + side * 13, i); at < until;)
        fires.push((at += 3.5 + 2.5 * unit(key + i, Math.round(at * 10))));
      out.push({
        side,
        x,
        z: across,
        yaw: side === 0 ? Math.PI / 2 : -Math.PI / 2,
        fires: fires.filter((f) => f < until),
      });
    }
  }
  return out;
}

/**
 * What is told as the battle goes, and of the later arms' doings (Phase 53 M220): the cars that
 * roll forward, the machine guns that open up, the first car knocked out, the trench, the gate
 * blown in. Told in the order the battle comes to them.
 */
function momentsOf(
  near: BattleNear,
  wings: BattleField["wings"],
  vehicles: readonly Vehicle[],
  trench: boolean,
): { at: number; words: string }[] {
  const a = near.attacker.name,
    d = near.defender.name,
    cap = (s: string) => s[0]!.toUpperCase() + s.slice(1),
    town = near.town ?? "the town",
    arrows = loosesFrom(near.attacker.host?.arm) || loosesFrom(near.defender.host?.arm),
    guns = firesFrom(near.attacker.host?.arm) || firesFrom(near.defender.host?.arm),
    continuous = [near.attacker, near.defender].some(
      (s) => armLook(s.host?.arm).fire === "continuous",
    ),
    team = [near.attacker, near.defender].some((s) => armLook(s.host?.arm).team !== undefined),
    open = armLook(near.attacker.host?.arm).order === "open",
    // (An attacker that raises no ladders blows the gate: the self-loading rifle on.)
    blown = !armLook(near.attacker.host?.arm).ladders,
    firstKnock = vehicles.reduce<number | null>(
      (m, v) => (v.knocked !== null && (m === null || v.knocked < m) ? v.knocked : m),
      null,
    );
  const out: { at: number; words: string }[] = [
    {
      at: 0,
      words: near.walls
        ? `${cap(a)} draw up before the walls of ${town}`
        : `The hosts draw up: ${a} against ${d}`,
    },
    { at: MOMENTS.advance, words: open ? `${cap(a)} come on in rushes` : `${cap(a)} come on` },
  ];
  if (arrows)
    out.push({
      at: MOMENTS.arrows,
      words: continuous
        ? "Fire breaks out all along the line"
        : guns
          ? "Volleys of shot ring out as they come"
          : "Arrows fall on them as they come",
    });
  if (team) out.push({ at: MOMENTS.arrows + 3, words: "Machine guns open up" });
  if (vehicles.some((v) => v.side === 0))
    out.push({ at: MOMENTS.advance + 3, words: `The armoured cars of ${a} roll forward` });
  out.push(
    {
      at: MOMENTS.charge,
      words: near.walls
        ? `${cap(a)} rush the walls`
        : open
          ? `${cap(a)} rise and rush the line`
          : `${cap(a)} charge`,
    },
    {
      at: MOMENTS.melee,
      words: near.walls
        ? "They fight at the walls"
        : trench
          ? "They fight in the trench"
          : "The lines meet",
    },
  );
  if (wings) {
    const [wide, hemmed] = wings.side === 0 ? [a, d] : [d, a];
    out.push(
      { at: WHEEL.from + 2, words: `The wings of ${wide} close about ${hemmed}` },
      { at: WHEEL.to + 6, words: `${cap(hemmed)} are hemmed in, fighting on three sides` },
    );
  }
  if (near.outcome === "stormed")
    out.push({ at: MOMENTS.gate, words: blown ? "The gate is blown in" : "The gate is broken" });
  if (firstKnock !== null)
    out.push({ at: firstKnock, words: "An armoured car is knocked out, burning" });
  out.push({
    at: MOMENTS.rout,
    words:
      near.outcome === "held"
        ? near.walls
          ? `${cap(a)} fall back from the walls`
          : `${cap(a)} break and run`
        : near.outcome === "siege"
          ? `${cap(d)} fall back behind their walls`
          : near.outcome === "stormed"
            ? `${cap(a)} pour into ${town}`
            : `${cap(d)} break and run`,
  });
  out.push({
    at: MOMENTS.after,
    words:
      near.outcome === "held"
        ? `The field is ${d}'s`
        : near.outcome === "siege"
          ? `${cap(a)} make camp about ${town}: the siege is laid`
          : near.outcome === "stormed"
            ? `${cap(town)} is taken: it burns`
            : near.outcome === "taken"
              ? `The field is ${a}'s, and ${near.land} with it`
              : `The field is ${a}'s`,
  });
  return out.sort((p, q) => p.at - q.at);
}

/**
 * Each one's fate, in time's order: the arrows' dead from the volleys (where either side looses),
 * the dead of the blows along the line (always the front of a file, those behind stepping up), the
 * beaten turning to run — the rear first — and the dead of the rout among them; the victors' front
 * after them.
 */
function fates(field: BattleField, key: number): void {
  const { hosts, troopers, beaten, ground } = field,
    victor: 0 | 1 = beaten === 0 ? 1 : 0,
    bySide = [0, 1].map((side) => troopers.filter((t) => t.side === side)),
    // Each file's living, front first.
    alive = [0, 1].map((side) =>
      Array.from({ length: hosts[side]!.files }, (_, f) =>
        bySide[side]!.filter((t) => t.file === f).sort((p, q) => p.rank - q.rank),
      ),
    ),
    rnd = (() => {
      let n = 0;
      return () => unit(key, ++n);
    })(),
    kill = (t: Trooper, at: number, by: Trooper["by"]) => {
      t.falls = at;
      t.by = by;
      const file = alive[t.side]![t.file]!;
      file.splice(file.indexOf(t), 1);
    };
  // The beaten run: the rear ranks first.
  for (const t of bySide[beaten]!) {
    const h = hosts[beaten]!;
    t.flees = MOMENTS.rout + 3 * (1 - t.rank / Math.max(1, h.ranks - 1 || 1)) * 0.6 + 3 * t.u;
  }
  // How each side's dead fall: to the arrows where the other side looses, to the blows along the
  // line, and (the beaten) in the rout.
  const shares = (side: 0 | 1) => {
    const n = hosts[side]!.falls,
      other = side === 0 ? field.near.defender : field.near.attacker,
      arrows = hosts[side === 0 ? 1 : 0]!.missiles
        ? loosedShare(other.host?.arm)
        : ground.wall && side === 0
          ? 0.1
          : 0,
      rout = side === beaten ? (ground.wall && beaten === 1 ? 0.15 : 0.32) : 0,
      // (Shot and rout never take more of the side than its falls.)
      byRout = Math.round(n * rout),
      byArrow = Math.min(Math.round(n * arrows), n - byRout);
    return { arrow: byArrow, rout: byRout, blow: n - byArrow - byRout };
  };
  type Death = { at: number; side: 0 | 1; by: "arrow" | "blow" | "rout" };
  const deaths: Death[] = [];
  const arrows: Arrow[] = [];
  for (const side of [0, 1] as const) {
    const s = shares(side),
      shooters = (side === 0 ? 1 : 0) as 0 | 1;
    // The arrows' dead, a share of each volley's; from the arms that fire without pause, spread
    // over the fight instead.
    if (fireOf(field.near, shooters) === "continuous") {
      for (let k = 0; k < s.arrow; k++)
        deaths.push({
          at:
            MOMENTS.arrows +
            2 +
            (MOMENTS.rout - MOMENTS.arrows - 8) * Math.pow((k + 0.5) / s.arrow, 1.15),
          side,
          by: "arrow",
        });
    } else if (hosts[shooters]!.missiles || s.arrow) {
      const volleys = 9;
      for (let v = 0; v < volleys; v++) {
        const lands = MOMENTS.arrows + 2 + v * 3.2;
        for (let k = 0; k < Math.floor(s.arrow / volleys) + (v < s.arrow % volleys ? 1 : 0); k++)
          deaths.push({ at: lands + 0.15 * k, side, by: "arrow" });
      }
    }
    // The blows' dead along the line, more as the fight goes on.
    for (let k = 0; k < s.blow; k++) {
      const f = (k + 0.5) / Math.max(1, s.blow);
      deaths.push({
        at: MOMENTS.melee + 1.5 + (MOMENTS.rout - MOMENTS.melee - 3) * Math.pow(f, 0.85),
        side,
        by: "blow",
      });
    }
    // The rout's dead, as the victors catch them.
    for (let k = 0; k < s.rout; k++)
      deaths.push({
        at: MOMENTS.rout + 4 + 15 * ((k + rnd()) / Math.max(1, s.rout)),
        side,
        by: "rout",
      });
  }
  deaths.sort((p, q) => p.at - q.at || p.side - q.side);
  // Whose files are at the line: those across from the other host's.
  const reach = [0, 1].map((side) => {
    const ts = bySide[side]!;
    return ts.length ? Math.max(...ts.map((t) => Math.abs(t.z))) : 0;
  });
  const front = (side: 0 | 1) => {
    const files = alive[side]!,
      other = reach[side === 0 ? 1 : 0]! + 1.5,
      inReach = files.filter((f) => f.length && Math.abs(f[0]!.z) <= other);
    return inReach.length ? inReach : files.filter((f) => f.length);
  };
  // The host whose flanks the other's wings close about, and its outermost files still standing
  // (on one side or the other): where the wings bite.
  const hemmed = field.wings ? (field.wings.side === 0 ? 1 : 0) : -1,
    flank = (side: 0 | 1) => {
      const sign = rnd() < 0.5 ? -1 : 1,
        files = alive[side]!.filter((f) => f.length && Math.sign(f[0]!.z) === sign);
      if (!files.length) return undefined;
      const out = files.reduce((p, q) => (Math.abs(q[0]!.z) > Math.abs(p[0]!.z) ? q : p));
      return out[Math.floor(rnd() * out.length)];
    };
  for (const death of deaths) {
    let victim: Trooper | undefined;
    if (death.by === "blow") {
      // (Once the wings have closed about a host, many of its dead fall on its flanks.)
      if (death.side === hemmed && death.at >= WHEEL.to - 4 && rnd() < 0.4)
        victim = flank(death.side);
      const files = front(death.side);
      victim ??= files.length ? files[Math.floor(rnd() * files.length)]![0] : undefined;
    } else {
      const living = alive[death.side]!.flat().filter(
        (t) => death.by !== "rout" || (t.flees !== null && t.flees <= death.at - 0.6),
      );
      victim = living.length ? living[Math.floor(rnd() * living.length)] : undefined;
    }
    if (victim) kill(victim, death.at, death.by);
  }
  // The arrows themselves: each volley from the living archers at the other host — those that
  // strike, at whom they struck; the rest into the ground about them.
  for (const shooters of [0, 1] as const) {
    // (Those on a seat's walls throw down on the attackers, bows or none.)
    if (!hosts[shooters]!.missiles && !(ground.wall && shooters === 1)) continue;
    // (The arms that fire without pause loose their shots as each will: see continuousFire.)
    if (fireOf(field.near, shooters) === "continuous") {
      arrows.push(...continuousFire(field, shooters, key));
      continue;
    }
    const target = (shooters === 0 ? 1 : 0) as 0 | 1,
      struck = troopers.filter((t) => t.side === target && t.by === "arrow");
    for (let v = 0; v < 9; v++) {
      const lands = MOMENTS.arrows + 2 + v * 3.2,
        archers = troopers.filter(
          (t) => t.side === shooters && (t.falls === null || t.falls > lands - 1.6),
        ),
        hitting = struck.filter((t) => t.falls! >= lands - 0.01 && t.falls! < lands + 3.19),
        loosed = Math.min(26, archers.length);
      for (let k = 0; k < loosed; k++) {
        const from = archers[Math.floor(unit(key + v, k * 3 + shooters) * archers.length)]!,
          hit = hitting[k],
          at = hit ? hit.falls! : lands + 0.15 * k,
          // (A ball is there as soon as it is fired.)
          shot = firesFrom((shooters === 0 ? field.near.attacker : field.near.defender).host?.arm),
          flight = shot ? 0.15 : 1.6,
          src = placeAt(field, from, at - flight),
          dst = hit
            ? placeAt(field, hit, at)
            : (() => {
                const anyone =
                    bySide[target]![Math.floor(unit(key + 31 * v, k) * bySide[target]!.length)]!,
                  p = placeAt(field, anyone, at);
                return {
                  x: p.x + (unit(key + v * 5, k + 99) - 0.5) * 9,
                  z: p.z + (unit(key + v * 7, k + 199) - 0.5) * 7,
                };
              })();
        arrows.push({
          side: shooters,
          from: { x: src.x, z: src.z },
          to: { x: dst.x, z: dst.z },
          at: at - flight,
          flight,
          hits: hit ? hit.id : -1,
          ...(shot ? { shot } : {}),
        });
      }
    }
  }
  (field as { arrows: readonly Arrow[] }).arrows = arrows;
  // The victors' front goes after the beaten; at a seat stormed, those before the gate go in.
  const wall = ground.wall;
  for (const t of bySide[victor]!) {
    const living = t.falls === null || t.falls > MOMENTS.rout;
    if (!living) continue;
    if (wall && field.near.outcome === "stormed" && victor === 0)
      t.gate = Math.abs(t.z) < wall.gate + 3 && t.rank < 6;
    t.pursues = !wall ? t.rank < 2 || unit(key + 17, t.id) < 0.2 : t.gate;
  }
}

/** How a side fires: in volleys, or without pause, as each will (the later arms, Phase 53 M220). */
function fireOf(near: BattleNear, side: 0 | 1): "volley" | "continuous" {
  return armLook((side === 0 ? near.attacker : near.defender).host?.arm).fire;
}

/** Whether one is running at `s`: fled from the field, or rushing forward (in open order). */
function runningAt(field: BattleField, t: Trooper, s: number): boolean {
  return (t.flees !== null && s >= t.flees) || lineOrder(field, t, s).run;
}

/**
 * Fire without pause (Phase 53 M220): a side that fires as each will fires every second from the
 * arrows to the rout, a shot from each of its living who are not running then, at a hit that falls
 * in that second if there is one, else into the ground near one of the other side. Twelve a second
 * at most, scaled down so the side's rounds stay within the most they may loose. A machine gun's
 * team fires its bursts from its tripod.
 */
function continuousFire(field: BattleField, shooters: 0 | 1, key: number): Arrow[] {
  const { troopers } = field,
    target = (shooters === 0 ? 1 : 0) as 0 | 1,
    burst = armLook((shooters === 0 ? field.near.attacker : field.near.defender).host?.arm).burst,
    own = troopers.filter((t) => t.side === shooters),
    onTarget = troopers.filter((t) => t.side === target),
    struck = onTarget.filter((t) => t.by === "arrow"),
    living = (s: number) => own.filter((t) => t.falls === null || t.falls > s),
    perSecond: number[] = [];
  let rounds = 0;
  for (let s = MOMENTS.arrows; s <= MOMENTS.rout - 2; s++) {
    const n = Math.min(SHOTS.most, Math.ceil(living(s).length / 4));
    perSecond.push(n);
    rounds += n * burst;
  }
  const scale = Math.min(1, SHOTS.rounds / Math.max(1, rounds)),
    out: Arrow[] = [];
  perSecond.forEach((n, i) => {
    const s = MOMENTS.arrows + i,
      per = Math.floor(n * scale),
      alive = living(s),
      free = alive.filter((t) => !runningAt(field, t, s)),
      pool = free.length ? free : alive,
      hits = struck
        .filter((t) => t.falls! >= s && t.falls! < s + 1)
        .sort((p, q) => p.falls! - q.falls!);
    if (!pool.length) return;
    for (let k = 0; k < per; k++) {
      const seat = s * 16 + k,
        from = pool[Math.floor(unit(key + 5400 + shooters, seat) * pool.length)]!,
        hit = hits[k],
        // (A shot at a hit is fired as it falls; any other is fired within its second.)
        fire = hit ? hit.falls! - SHOTS.flight : s + ((k + 0.5) / per) * 0.9,
        src = placeAt(field, from, fire);
      // (A burst's first round only may hit.)
      for (let j = 0; j < (from.gun ? burst : 1); j++) {
        const at = fire + SHOTS.burst * j,
          aim = j === 0 ? hit : undefined;
        let dst: { x: number; z: number };
        if (aim) dst = placeAt(field, aim, aim.falls!);
        else {
          const anyone =
              onTarget[Math.floor(unit(key + 5450 + shooters, seat * 8 + j) * onTarget.length)]!,
            p = placeAt(field, anyone, at + SHOTS.flight);
          dst = {
            x: p.x + (unit(key + 5500 + shooters, seat * 8 + j) - 0.5) * 9,
            z: p.z + (unit(key + 5600 + shooters, seat * 8 + j) - 0.5) * 7,
          };
        }
        out.push({
          side: shooters,
          from: { x: src.x, z: src.z },
          to: { x: dst.x, z: dst.z },
          at,
          flight: SHOTS.flight,
          hits: aim ? aim.id : -1,
          shot: true,
        });
      }
    }
  });
  return out;
}

/** The line's front, where the lines meet now (x). */
function meetAt(field: BattleField, s: number): number {
  return field.meet + field.drive * smooth((s - MOMENTS.melee) / (MOMENTS.rout - MOMENTS.melee));
}

/** How far a file has closed up by `s`: one rank for each who fell before them in it. */
export function closedUp(field: BattleField, t: Trooper, s: number): number {
  let ahead = 0;
  for (const o of field.files[t.side]![t.file]!) {
    if (o === t) break;
    if (o.falls !== null && o.falls < s) ahead += clamp01((s - o.falls) / 1.6);
  }
  return t.rank - ahead;
}

/**
 * Where one who fought stands at `s` in their host's order (before any flight): in its line, or
 * wheeling with its wing.
 */
function inOrder(
  field: BattleField,
  t: Trooper,
  s: number,
): { x: number; z: number; run: boolean; yaw?: number } {
  return wheeled(field, t, s, lineOrder(field, t, s));
}

/**
 * Where a wing's file stands as it wheels about the other host's flank: turned about the flank's
 * corner at the line, as a door on its hinge, from facing the other's front to facing its flank,
 * running as it goes (those not of a wing, as they were).
 */
function wheeled(
  field: BattleField,
  t: Trooper,
  s: number,
  p: { x: number; z: number; run: boolean },
): { x: number; z: number; run: boolean; yaw?: number } {
  const w = field.wings;
  if (!w || t.side !== w.side || Math.abs(t.z) <= w.z || s <= WHEEL.from) return p;
  const turn = WHEEL.turn * smooth((s - WHEEL.from) / (WHEEL.to - WHEEL.from)),
    way = t.side === 0 ? 1 : -1,
    out = Math.sign(t.z),
    hinge = meetAt(field, s),
    // (Ahead of the hinge toward the other host, and out past its flank.)
    ahead = (p.x - hinge) * way,
    past = Math.abs(p.z) - w.z,
    c = Math.cos(turn),
    sn = Math.sin(turn);
  return {
    x: hinge + (ahead * c + past * sn) * way,
    z: out * (w.z + (past * c - ahead * sn)),
    run: p.run || s < WHEEL.to,
    yaw: Math.atan2(way * c, -out * sn),
  };
}

/** Where one who fought stands at `s` in their host's line (before any wheel or flight). */
function lineOrder(
  field: BattleField,
  t: Trooper,
  s: number,
): { x: number; z: number; run: boolean } {
  const h = field.hosts[t.side]!,
    gap = gapOf(h),
    rank = closedUp(field, t, s),
    wall = field.ground.wall,
    meet = meetAt(field, s),
    sway = Math.sin(s * 0.7 + t.u * 6) * 0.25;
  if (t.side === 1) {
    // The defenders stand where they are found: on the walls, on the ridge, past the river.
    const front = s < MOMENTS.melee ? field.meet + 1 : meet + 1;
    if (wall) {
      const x =
        rank < 1 ? wall.x + 0.7 + 1.9 * Math.max(0, rank) : wall.x + 2.6 + (rank - 1) * gap.rank;
      return { x, z: t.z + sway * 0.4, run: false };
    }
    return { x: front + rank * gap.rank, z: t.z + (s >= MOMENTS.melee ? sway : 0), run: false };
  }
  // (The attackers in open order come on in rushes: see openLine.)
  if (h.open) return openLine(field, t, s);
  // The attackers come on: walk, stand to loose where they bear bows, charge, and fight at the line.
  const start = -32 - (h.mounted ? 6 : 0),
    stop = field.meet - 16,
    loose = h.missiles ? field.meet - 30 : stop,
    walk =
      s < MOMENTS.advance
        ? start
        : h.missiles
          ? s < 26
            ? start + (loose - start) * smooth((s - MOMENTS.advance) / 16)
            : s < 36
              ? loose
              : loose + (stop - loose) * smooth((s - 36) / 4)
          : start +
            (stop - start) * smooth((s - MOMENTS.advance) / (MOMENTS.charge - MOMENTS.advance)),
    front =
      s < MOMENTS.charge
        ? walk
        : s < MOMENTS.melee
          ? stop +
            (field.meet - 1 - stop) *
              smooth((s - MOMENTS.charge) / (MOMENTS.melee - MOMENTS.charge))
          : meet - 1;
  return {
    x: front - rank * gap.rank,
    z: t.z + (s >= MOMENTS.melee ? sway : 0),
    run: s >= MOMENTS.charge && s < MOMENTS.melee,
  };
}

/**
 * Where an attacker in open order is at `s` in the line (Phase 53 M220). From the advance its
 * group's front comes up the field in bounds, a rush at a time, and each one goes to ground between
 * them; a machine gun's team makes one rush to its place and fires from there; from the charge the
 * rest rise and rush the line, and at the line they fight as the close order does.
 */
function openLine(
  field: BattleField,
  t: Trooper,
  s: number,
): { x: number; z: number; run: boolean } {
  const gap = gapOf(field.hosts[0]!),
    rank = closedUp(field, t, s),
    start = -32,
    stop = field.meet - 22,
    sway = Math.sin(s * 0.7 + t.u * 6) * 0.25;
  if (t.gun) {
    // (Its one rush, a share of the way to the stop, and then down behind its tripod.)
    const at = s - MOMENTS.advance - (t.u - 0.5) * RUSH.shift,
      front = start + (stop - start) * RUSH.gun * smooth(at / RUSH.long);
    return {
      x: front - rank * gap.rank,
      z: t.z + (s >= MOMENTS.melee ? sway : 0),
      run: at >= 0 && at < RUSH.long,
    };
  }
  const front =
    s < MOMENTS.charge
      ? start + (stop - start) * rushedTo(groupOf(t), s)
      : s < MOMENTS.melee
        ? stop +
          (field.meet - 1 - stop) * smooth((s - MOMENTS.charge) / (MOMENTS.melee - MOMENTS.charge))
        : meetAt(field, s) - 1;
  return {
    x: front - rank * gap.rank,
    z: t.z + (s >= MOMENTS.melee ? sway : 0),
    run: s < MOMENTS.charge ? rushingAt(t, s) : s < MOMENTS.melee,
  };
}

/**
 * How far up the field one group's front has come by `s` in the rushes: 0 at the start, 1 at the
 * stop.
 */
function rushedTo(group: number, s: number): number {
  const x = s - MOMENTS.advance - RUSH.apart * group;
  if (x < 0) return 0;
  const c = Math.floor(x / RUSH.cycle),
    r = x - c * RUSH.cycle,
    bounds = r < RUSH.long ? c + smooth(r / RUSH.long) : c + 1;
  return Math.min(RUSH.bounds, bounds) / RUSH.bounds;
}

/** The group one in open order rushes with: a checkerboard across its files and ranks. */
function groupOf(t: Trooper): number {
  return (t.file + t.rank) % 2;
}

/**
 * Whether one in open order is rushing forward at `s`: its group's rush, shifted by its own draw.
 */
function rushingAt(t: Trooper, s: number): boolean {
  const x = s - MOMENTS.advance - RUSH.apart * groupOf(t) - (t.u - 0.5) * RUSH.shift;
  return x >= 0 && s < MOMENTS.charge && x - RUSH.cycle * Math.floor(x / RUSH.cycle) < RUSH.long;
}

/**
 * Whether a defender stands in the trench at `s` (Phase 53 M220): at the front of its file, closed
 * up to the line, and not yet run from the field. Those in it stand sunk to their shoulders.
 */
function inTrench(field: BattleField, t: Trooper, s: number): boolean {
  return (
    !!field.ground.trench &&
    t.side === 1 &&
    (t.flees === null || s < t.flees) &&
    closedUp(field, t, s) < 0.6
  );
}

/**
 * Where they run to: the beaten off their side of the field, or (defenders at a seat) into the town;
 * before a town in its own scene, its defenders off either flank, away from the town behind them.
 */
function fleeTo(field: BattleField, t: Trooper): { x: number; z: number } {
  if (t.side === 1 && field.ground.wall) return { x: FIELD.x + 12, z: t.z * 0.5 };
  if (t.side === 1 && field.placed)
    return { x: FIELD.x * 0.35 + 12 * t.u, z: (t.z < 0 ? -1 : 1) * (FIELD.z + 16) };
  const way = t.side === 0 ? -1 : 1;
  return { x: way * (FIELD.x + 14), z: t.z * 1.25 + (t.u - 0.5) * 18 };
}

/** Where one who fought is at `s` (frozen where they fell, once fallen). */
export function placeAt(
  field: BattleField,
  t: Trooper,
  s: number,
): { x: number; z: number; yaw: number; run: boolean; fled: number } {
  if (t.falls !== null && s >= t.falls) return (t.lies ??= placed(field, t, t.falls));
  return placed(field, t, s);
}

function placed(
  field: BattleField,
  t: Trooper,
  when: number,
): { x: number; z: number; yaw: number; run: boolean; fled: number } {
  const facing = t.side === 0 ? Math.PI / 2 : -Math.PI / 2;
  // On a ladder, or over the walls from it.
  const climb = climbing(field, t, when);
  if (climb && (t.flees === null || when < t.flees))
    return { x: climb.x, z: climb.z, yaw: facing, run: climb.act === "run", fled: 0 };
  // Fled: from where the rout found them, toward their edge (or the town), running.
  if (t.flees !== null && when >= t.flees) {
    const p = inOrder(field, t, t.flees),
      to = fleeTo(field, t),
      dx = to.x - p.x,
      dz = to.z - p.z,
      far = Math.hypot(dx, dz) || 1,
      pace = (field.hosts[t.side]!.mounted ? 8 : 5.2) * (0.85 + 0.3 * t.u),
      gone = Math.min(far, pace * (when - t.flees));
    return {
      x: p.x + (dx / far) * gone,
      z: p.z + (dz / far) * gone,
      yaw: Math.atan2(dx, dz),
      run: gone < far,
      fled: gone,
    };
  }
  // After them: the victors' front, for a while; at a seat stormed, through the gate.
  if (t.pursues && when >= MOMENTS.rout + 1) {
    const p = inOrder(field, t, MOMENTS.rout + 1),
      wall = field.ground.wall;
    if (wall && t.gate) {
      // Into the gate, then up into the town.
      const at = when - (MOMENTS.rout + 1),
        door = {
          x: wall.x + 2,
          z: Math.max(-wall.gate + 0.8, Math.min(wall.gate - 0.8, t.z * 0.4)),
        },
        toDoor = Math.hypot(door.x - p.x, door.z - p.z) || 1,
        pace = 4.4 * (0.85 + 0.3 * t.u),
        gone = pace * at;
      if (gone < toDoor)
        return {
          x: p.x + ((door.x - p.x) / toDoor) * gone,
          z: p.z + ((door.z - p.z) / toDoor) * gone,
          yaw: Math.atan2(door.x - p.x, door.z - p.z),
          run: true,
          fled: 0,
        };
      // (Before a town in its own scene, no further than its outworks' gate: the town is its own.)
      const on = Math.min(field.placed ? 3 + 3 * t.u : 28 + 10 * t.u, gone - toDoor);
      return {
        x: door.x + on,
        z: door.z + (t.u - 0.5) * on * 0.9,
        yaw: Math.PI / 2,
        run: on < 28,
        fled: 0,
      };
    }
    const way = field.beaten === 0 ? -1 : 1,
      chase = Math.min(7, when - (MOMENTS.rout + 1)),
      pace = (field.hosts[t.side]!.mounted ? 7.5 : 4.6) * (0.85 + 0.3 * t.u),
      // (Before a town in its own scene, no further than where the beaten stood: the town is its own.)
      stop = wall
        ? wall.x - 2.2
        : field.placed && way > 0
          ? Math.min(FIELD.x, field.meet + 12)
          : way * FIELD.x,
      x = way > 0 ? Math.min(stop, p.x + pace * chase) : Math.max(stop, p.x - pace * chase);
    return { x, z: p.z, yaw: facing, run: chase < 7 && x !== stop, fled: 0 };
  }
  // At a siege laid, the attackers draw back from the walls to their camp.
  if (field.near.outcome === "siege" && t.side === 0 && when >= MOMENTS.after) {
    const p = inOrder(field, t, MOMENTS.after),
      back = 10 * smooth((when - MOMENTS.after) / 8);
    return { x: p.x - back, z: p.z, yaw: facing, run: false, fled: 0 };
  }
  const p = inOrder(field, t, when);
  return { x: p.x, z: p.z, yaw: p.yaw ?? facing, run: p.run, fled: 0 };
}

/**
 * Where one fallen comes to lie from where they fell (`p`), as far down as they are (0 … 1):
 * knocked back by the blow or the arrow, or pitched on along their way where they were cut down
 * running; turned as they went.
 */
function lying(
  t: Trooper,
  p: { x: number; z: number; yaw: number },
  down: number,
): { x: number; z: number; yaw: number } {
  const turn = (unit(t.id, 5) - 0.5) * (t.by === "rout" ? 0.9 : 1.8),
    back = (t.by === "rout" ? -0.6 : 0.25 + 0.75 * unit(t.id, 9)) * down;
  return {
    x: p.x - Math.sin(p.yaw) * back,
    z: p.z - Math.cos(p.yaw) * back,
    yaw: p.yaw + turn * down,
  };
}

/** Where the blood of one fallen spreads: under them, where their body lies (m). */
export function bloodAt(
  t: Trooper,
  p: { x: number; z: number; yaw: number },
): { x: number; z: number } {
  const l = lying(t, p, 1),
    // (On their back, their body lies behind their feet; on their face, before them.)
    along = t.by === "rout" ? 0.6 : -0.6;
  return { x: l.x + Math.sin(l.yaw) * along, z: l.z + Math.cos(l.yaw) * along };
}

/**
 * Before a town in its own scene, how much of one is drawn as they leave the field (1: all): fading
 * past either flank, and the defenders who fled in behind their walls once through them.
 */
function placedFade(
  field: BattleField,
  t: Trooper,
  p: { readonly x: number; readonly z: number },
  s: number,
): number {
  if (!field.placed) return 1;
  const flank = clamp01((FIELD.z + 12 - Math.abs(p.z)) / 10),
    wall = field.ground.wall;
  return wall && t.side === 1 && t.flees !== null && s >= t.flees
    ? flank * clamp01((wall.x + 8 - p.x) / 4)
    : flank;
}

/** What one who fought is at now, and how they stand (a machine gun's team marked as it is). */
function trooperNow(field: BattleField, t: Trooper, s: number): TrooperNow {
  const now = trooperNowAt(field, t, s);
  return t.gun ? { ...now, gun: true as const } : now;
}

/** What one who fought is at now, and how they stand (every field of TrooperNow, the marks unset). */
function trooperNowAt(field: BattleField, t: Trooper, s: number): TrooperNow {
  const p = placeAt(field, t, s),
    h = field.hosts[t.side]!,
    ground = field.ground,
    // (In the trench, sunk to the shoulders: the head, the shoulders and the gun above the ground.)
    trenched = inTrench(field, t, s),
    sunk = trenched ? ground.trench!.depth - 0.15 : 0,
    y = standY(field, t.side, p.x, p.z);
  const size = clamp01((FIELD.x + 10 - Math.abs(p.x)) / 10) * placedFade(field, t, p, s),
    cycle = s * (p.run ? 1.6 : 1) + t.u * 3;
  if (t.falls !== null && s >= t.falls) {
    const down = smooth((s - t.falls) / 0.7),
      dur = crawlsFor(field, t);
    if (dur) {
      // Wounded: face down, dragging themselves back toward their own lines a while.
      const c = crawledTo(field, t, s, dur);
      return {
        id: t.id,
        side: t.side,
        x: c.x,
        y: groundY(ground, c.x, c.z),
        z: c.z,
        yaw: c.yaw,
        act: "fall",
        cycle: s,
        down,
        back: false,
        size: 1,
        bearer: t.bearer,
        crawl: c.going ? 1 : 0,
        gun: undefined,
        hit: undefined,
        since: undefined,
        lost: undefined,
        fell: undefined,
      };
    }
    // Fallen: onto their back where struck from before them, on their face where they ran.
    const l = lying(t, p, down);
    return {
      id: t.id,
      side: t.side,
      x: l.x,
      y,
      z: l.z,
      yaw: l.yaw,
      act: "fall",
      cycle: 0,
      down,
      back: t.by !== "rout",
      size: 1,
      bearer: t.bearer,
      crawl: 0,
      gun: undefined,
      hit: undefined,
      since: undefined,
      lost: undefined,
      fell: undefined,
    };
  }
  const climb = climbing(field, t, s);
  if (climb && (t.flees === null || s < t.flees))
    return {
      id: t.id,
      side: t.side,
      x: p.x,
      y: climb.y,
      z: p.z,
      yaw: p.yaw,
      act: climb.act,
      cycle,
      down: 0,
      back: false,
      size: 1,
      bearer: t.bearer,
      crawl: 0,
      gun: undefined,
      hit: undefined,
      since: undefined,
      lost: undefined,
      fell: undefined,
    };
  let act: Act;
  if (t.flees !== null && s >= t.flees) act = "flee";
  else if (p.run) act = "run";
  // (A machine gun's team fires from its place, from its rush to the rout.)
  else if (t.gun && s >= MOMENTS.advance && s < MOMENTS.rout) act = "prone";
  else if (s >= MOMENTS.after && t.side !== field.beaten)
    act = unit(t.id, Math.floor(s / 3)) < 0.55 ? "cheer" : "stand";
  else if (s >= MOMENTS.melee) {
    // At the line: the front strikes, those behind press on.
    const rank = closedUp(field, t, s);
    act = rank < 0.6 || (h.mounted && rank < 1.6) ? "fight" : "brace";
  }
  // (The attackers in open order, between their rushes: down in the grass, firing.)
  else if (t.side === 0 && h.open && s >= MOMENTS.advance && s < MOMENTS.charge) act = "prone";
  // (In the trench the front rank fires, and the rest lie behind it until the lines meet.)
  else if (ground.trench && t.side === 1 && s >= MOMENTS.arrows) act = trenched ? "loose" : "prone";
  else if (
    h.missiles &&
    s >= MOMENTS.arrows &&
    s < MOMENTS.charge - 1 &&
    (t.side === 1 || (s >= 26 && s < 36))
  )
    act = "loose";
  else if (t.side === 0 && s >= MOMENTS.advance && s < MOMENTS.charge) act = "march";
  else if (t.side === 1 && s >= MOMENTS.charge) act = "brace";
  else act = "stand";
  return {
    id: t.id,
    side: t.side,
    x: p.x,
    y: y - sunk,
    z: p.z,
    yaw: p.yaw,
    act,
    cycle,
    down: 0,
    back: false,
    size: p.fled > 0 ? size : 1,
    bearer: t.bearer,
    crawl: 0,
    gun: undefined,
    hit: undefined,
    since: undefined,
    lost: undefined,
    fell: undefined,
  };
}

/** A ladder raised against a seat's walls: where its foot stands (x, m), how it leans, how long it is. */
function ladderOn(w: NonNullable<BattleGround["wall"]>): {
  foot: number;
  lean: number;
  long: number;
} {
  const run = 1.3,
    high = w.high + 0.3;
  return {
    foot: w.x - (w.stone ? 0.7 : 0.21) - run,
    lean: Math.atan2(high, run),
    long: Math.hypot(run, high),
  };
}

/**
 * Where one who climbs a ladder is at `s` (null: not on it then): to its foot once it is raised,
 * up it, fighting at its top; down it again before it is thrown down where the walls held (or
 * before the field's end, at a siege laid), or over the walls onto their walk once the gate of a
 * seat stormed is broken.
 */
function climbing(
  field: BattleField,
  t: Trooper,
  s: number,
): { x: number; y: number; z: number; act: Act } | null {
  const l = field.ladders.find((x) => x.climber === t.id),
    w = field.ground.wall;
  if (!l || !w) return null;
  const { foot, lean, long } = ladderOn(w),
    start = l.up + 1.6,
    atFoot = start + 0.8,
    atTop = atFoot + 2.6,
    top = long - 0.55,
    stormed = field.near.outcome === "stormed",
    back = stormed ? null : (l.down ?? MOMENTS.rout + 1) - 2.6,
    on = (along: number) => ({
      x: foot + Math.cos(lean) * along,
      y: Math.sin(lean) * along,
      z: l.z,
    });
  if (s < start) return null;
  if (s < atFoot) {
    const from = lineOrder(field, t, start),
      f = smooth((s - start) / 0.8);
    return { x: from.x + (foot - from.x) * f, y: 0, z: from.z + (l.z - from.z) * f, act: "run" };
  }
  if (s < atTop) return { ...on(top * smooth((s - atFoot) / 2.6)), act: "march" };
  if (back === null) {
    if (s < MOMENTS.gate) return { ...on(top), act: "fight" };
    // Over the walls onto their walk, and there they stand.
    const at = on(top),
      f = smooth((s - MOMENTS.gate) / 1.2);
    return {
      x: at.x + (w.x - at.x) * f,
      y: at.y + (w.high - 1.1 - at.y) * f,
      z: l.z,
      act: s >= MOMENTS.after ? "cheer" : "stand",
    };
  }
  if (s < back) return { ...on(top), act: "fight" };
  if (s < back + 2) return { ...on(top * (1 - smooth((s - back) / 2))), act: "march" };
  if (s < back + 2.8) {
    const to = lineOrder(field, t, back + 2.8),
      f = smooth((s - back - 2) / 0.8);
    return { x: foot + (to.x - foot) * f, y: 0, z: l.z + (to.z - l.z) * f, act: "run" };
  }
  return null;
}

/**
 * The ground one of `side` stands on at (x, z): the field's, a seat's wall walk (its defenders, on
 * its front), a river's bed (wading).
 */
export function standY(field: BattleField, side: 0 | 1, x: number, z: number): number {
  const ground = field.ground,
    wall = ground.wall;
  let y = battleGroundAt(ground, x, z);
  // (On the walls, those of its front stand on its walk; in the river, wading.)
  if (wall && side === 1 && x > wall.x - 0.4 && Math.abs(z) > wall.gate)
    y = (wall.high - 1.1) * clamp01((wall.x + 2.4 - x) / 1.2);
  if (ground.river && Math.abs(x - ground.river.x) < ground.river.w) y = -0.55;
  return y;
}

/** The ground's height where one lies (in the river, under its water). */
function groundY(ground: BattleGround, x: number, z: number): number {
  return ground.river && Math.abs(x - ground.river.x) < ground.river.w
    ? -0.55
    : battleGroundAt(ground, x, z);
}

/** How long one fallen crawls (seconds; 0: they lie where they fell). */
export function crawlsFor(field: BattleField, t: Trooper): number {
  if (t.by === null || t.by === "rout") return 0;
  // (Not off a seat's walls: those struck down on them lie on its walk.)
  if (t.side === 1 && field.ground.wall) return 0;
  // (Nor riders: they lie with their horses.)
  if (field.hosts[t.side]!.mounted) return 0;
  return unit(t.id, 13) < CRAWL.share
    ? CRAWL.least + (CRAWL.most - CRAWL.least) * unit(t.id, 14)
    : 0;
}

/**
 * Where one wounded has dragged themselves to by `s`, from where they fell — back toward their own
 * lines, veering a little — whether they are still going, and how far they have come (m).
 */
export function crawledTo(
  field: BattleField,
  t: Trooper,
  s: number,
  dur: number,
): { x: number; z: number; yaw: number; going: boolean; gone: number } {
  const from = placeAt(field, t, t.falls!),
    on = s - t.falls! - CRAWL.after,
    gone = CRAWL.pace * Math.max(0, Math.min(dur, on)),
    dx = t.side === 0 ? -1 : 1,
    dz = (unit(t.id, 15) - 0.5) * 0.5,
    n = Math.hypot(dx, dz);
  return {
    x: from.x + (dx / n) * gone,
    z: from.z + (dz / n) * gone,
    yaw: Math.atan2(dx, dz),
    going: on > 0 && on < dur,
    gone,
  };
}

/** The smoke a side's arm leaves when it fires (0 none … 1 black powder's white bank). */
function smokeOf(near: BattleNear, side: 0 | 1): number {
  return armLook((side === 0 ? near.attacker : near.defender).host?.arm).smoke;
}

/** The two attackers' cars nearest the gate (smallest |z|): at a seat stormed, they drive in. */
function gateCars(field: BattleField): number[] {
  return (field.vehicles ?? [])
    .filter((v) => v.side === 0)
    .sort((p, q) => Math.abs(p.z) - Math.abs(q.z))
    .slice(0, 2)
    .map((v) => v.id);
}

/**
 * Where an armoured car is at `s` on its own way (before it is knocked out): its place across and
 * along the field, and which way its hull faces (radians, as a trooper's yaw).
 */
function carWay(field: BattleField, v: Vehicle, s: number): { x: number; z: number; yaw: number } {
  const wall = field.ground.wall,
    trench = field.ground.trench;
  if (v.side === 0) {
    // The attackers' cars come on at an even pace, from before the advance to where the lines meet
    // (or to the walls), and hold there firing.
    const start = -24,
      hold = wall ? wall.x - 6 : field.meet - 6,
      pace = clamp01((s - MOMENTS.advance) / (MOMENTS.charge + 4 - MOMENTS.advance));
    let x = start + (hold - start) * pace,
      z = v.z;
    if (s >= MOMENTS.rout) {
      // (The victors drive on across the open; the beaten back off, still facing the foe.)
      if (field.beaten === 1) {
        if (!wall) x += 12 * clamp01((s - MOMENTS.rout) / 10);
      } else x -= 20 * clamp01((s - MOMENTS.rout) / 12);
    }
    // (At a seat stormed, the two cars nearest the gate drive in through it, toward its middle.)
    if (wall && field.near.outcome === "stormed" && gateCars(field).includes(v.id)) {
      const p = clamp01((s - (MOMENTS.gate + 2)) / 8);
      x += (wall.x + 14 - x) * p;
      z *= 1 - p;
    }
    return { x, z, yaw: Math.PI / 2 };
  }
  // The defenders' cars hold their trench's line, or their walls, firing; beaten, they turn about
  // and drive off the field's far edge.
  const hold = trench ? trench.x + 10 : wall ? wall.x + 6 : field.meet + 10;
  if (field.beaten === 1 && s >= MOMENTS.rout)
    return {
      x: hold + (FIELD.x + 14 - hold) * clamp01((s - MOMENTS.rout - 2) / 12),
      z: v.z,
      yaw: -Math.PI / 2 + Math.PI * smooth((s - MOMENTS.rout) / 2),
    };
  return { x: hold, z: v.z, yaw: -Math.PI / 2 };
}

/**
 * One armoured car at `s` (Phase 53 M220): where it is, its turret, its gun's kick and the flash of
 * each round. Its gun fires a burst of five rounds a tenth of a second apart every 1.6 s (from its
 * own offset), from the arrows to the rout, while it runs; knocked out, it stops and fires no more,
 * and its turret is turned askew.
 */
function vehicleNow(
  field: BattleField,
  v: Vehicle,
  s: number,
  flashes: BattleNow["flashes"][number][],
): VehicleNow {
  // (Knocked out, it stops where it was then: `since` is how long ago that was.)
  const k = v.knocked,
    since = k === null || s < k ? null : s - k,
    stopAt = s - (since ?? 0),
    way = carWay(field, v, stopAt),
    turret = since === null ? 0.35 * Math.sin(s * 0.4 + v.u * 6) : (v.u - 0.5) * 0.8,
    first = MOMENTS.arrows + v.u * 1.6,
    fired = Math.min(stopAt, MOMENTS.rout);
  // (The last round fired by then: the latest burst begun, as far along as it has got.)
  let last = -Infinity;
  if (fired >= first) {
    const b = first + 1.6 * Math.floor((fired - first) / 1.6);
    last = b + 0.1 * Math.min(4, Math.floor((fired - b) / 0.1 + 1e-9));
  }
  const kick = s - last;
  if (kick < 0.05)
    flashes.push({
      x: way.x + Math.sin(way.yaw + turret) * 2.4,
      y: 2.1,
      z: way.z + Math.cos(way.yaw + turret) * 2.4,
      yaw: way.yaw + turret,
    });
  return {
    id: v.id,
    side: v.side,
    x: way.x,
    y: groundY(field.ground, way.x, way.z),
    z: way.z,
    yaw: way.yaw,
    turret,
    recoil: kick < 0.1 ? 1 - kick / 0.1 : 0,
    knocked: since === null ? 0 : smooth(since / 1.2),
    burning: since === null ? 0 : 1 - smooth((since - 40) / 30),
  };
}

/** The battle at `s` of its seconds (0 … BATTLE_LENGTH). */
export function battleAt(field: BattleField, s: number): BattleNow {
  const t = Math.max(0, Math.min(BATTLE_LENGTH, s)),
    troopers = field.troopers.map((x) => trooperNow(field, x, t)),
    standing: [number, number] = [0, 0],
    fallen: [number, number] = [0, 0];
  for (const x of field.troopers) {
    if (x.falls !== null && t >= x.falls) fallen[x.side]++;
    else standing[x.side]++;
  }
  // Arrows in flight, and those spent in the ground.
  const flying: BattleNow["flying"][number][] = [],
    spent: BattleNow["spent"][number][] = [];
  const smoke: BattleNow["smoke"][number][] = [],
    flashes: BattleNow["flashes"][number][] = [];
  for (const a of field.arrows) {
    const f = (t - a.at) / a.flight;
    if (f < 0) continue;
    if (a.shot) {
      // A gun fired: its flash at the muzzle, its smoke rolling out before it and drifting off
      // on the wind, rising and spreading, for a few seconds.
      const age = t - a.at,
        dx = a.to.x - a.from.x,
        dz = a.to.z - a.from.z,
        far = Math.hypot(dx, dz) || 1,
        ux = dx / far,
        uz = dz / far;
      if (age < 0.09)
        flashes.push({
          x: a.from.x + ux * 1.1,
          y: 1.35,
          z: a.from.z + uz * 1.1,
          yaw: Math.atan2(dx, dz),
        });
      if (smokeOf(field.near, a.side) < 1) {
        // (Smokeless powder leaves one thin puff, gone in a moment.)
        if (age < 1.2) {
          const out = 1.2 + 1.6 * smooth(age / 1.2);
          smoke.push({
            x: a.from.x + ux * out + 0.6 * age,
            y: 1.3 + 0.32 * age,
            z: a.from.z + uz * out - 0.25,
            r: (0.35 + 1.05 * smooth(age / 2.2)) * 0.35,
          });
        }
      } else if (age < 3.2)
        for (let k = 0; k < 2; k++) {
          const out = 1.2 + 1.6 * smooth(age / 1.2) + k * 0.7;
          smoke.push({
            x: a.from.x + ux * out + 0.6 * age,
            y: 1.3 + 0.32 * age + k * 0.25,
            z: a.from.z + uz * out + (k - 0.5) * 0.5,
            r: (0.35 + 1.05 * smooth(age / 2.2)) * (1 - 0.25 * k),
          });
        }
      continue;
    }
    const dx = a.to.x - a.from.x,
      dz = a.to.z - a.from.z,
      yaw = Math.atan2(dx, dz);
    if (f >= 1) {
      if (a.hits < 0) spent.push({ x: a.to.x, z: a.to.z, yaw });
      continue;
    }
    const far = Math.hypot(dx, dz),
      top = 2 + far * 0.22,
      // Up and over: a curve whose slope is the arrow's pitch.
      y = 1.6 + top * 4 * f * (1 - f) - 0.9 * f,
      climb = (top * 4 * (1 - 2 * f) - 0.9) / Math.max(1, far);
    flying.push({
      x: a.from.x + dx * f,
      y,
      z: a.from.z + dz * f,
      yaw,
      pitch: -Math.atan(climb),
    });
  }
  // The blood of the fallen, spreading under them; and thrown up as each is struck down, out
  // from them and falling.
  const blood: BattleNow["blood"][number][] = [],
    spray: BattleNow["spray"][number][] = [];
  for (const x of field.troopers) {
    if (x.falls === null || t < x.falls) continue;
    const p = placeAt(field, x, x.falls),
      dur = crawlsFor(field, x);
    if (dur) {
      // The wounded: a lesser pool where they fell, a smear every so far along the way they
      // dragged themselves, and where they came to lie still, their blood spreading.
      const c = crawledTo(field, x, t, dur);
      if (t > x.falls + 0.3)
        blood.push({ x: p.x, z: p.z, r: (0.45 + 0.4 * x.u) * smooth((t - x.falls - 0.3) / 3) });
      for (let d = 0.9; d < c.gone; d += 0.9)
        blood.push({
          x: p.x + ((c.x - p.x) * d) / c.gone,
          z: p.z + ((c.z - p.z) * d) / c.gone,
          r: 0.26 + 0.12 * unit(x.id, 80 + Math.round(d * 10)),
        });
      const still = t - (x.falls + CRAWL.after + dur);
      if (still > 0) blood.push({ x: c.x, z: c.z, r: (0.7 + 0.8 * x.u) * smooth(still / 4) });
    } else if (t > x.falls + 0.3) {
      const at = bloodAt(x, p);
      blood.push({
        x: at.x,
        z: at.z,
        r: (0.75 + 0.85 * x.u) * smooth((t - x.falls - 0.3) / 4),
      });
    }
    const age = t - x.falls;
    if (age < 0.6)
      for (let k = 0; k < 7; k++) {
        const a = unit(x.id, 40 + k) * 2 * Math.PI,
          out = 0.8 + 2.2 * unit(x.id, 50 + k),
          up = 1.2 + 2.4 * unit(x.id, 60 + k),
          y = 1.15 + up * age - 4.9 * age * age;
        if (y > 0.05)
          spray.push({
            x: p.x + Math.cos(a) * out * age,
            y,
            z: p.z + Math.sin(a) * out * age,
            r: 0.07 + 0.08 * unit(x.id, 70 + k),
          });
      }
  }
  // Dust where they run and where the lines meet.
  const dust: BattleNow["dust"][number][] = [];
  for (const x of troopers)
    if ((x.act === "run" || x.act === "flee" || x.act === "fight") && x.id % 5 === 0) {
      const ph = (t * 0.9 + x.id * 0.37) % 1;
      dust.push({
        x: x.x - Math.sin(x.yaw) * 0.6 * ph,
        y: 0.2 + 1.2 * ph,
        z: x.z - Math.cos(x.yaw) * 0.6 * ph,
        r: (0.5 + 1.1 * ph) * (x.act === "fight" ? 0.8 : 1),
      });
    }
  // The cannon: the smoke of their firing, a great cloud rolling out before each; the flash.
  const cannon: BattleNow["cannon"][number][] = [];
  for (const c of field.cannon) {
    const last = c.fires.filter((f) => f <= t).at(-1) ?? null,
      ux = Math.sin(c.yaw),
      uz = Math.cos(c.yaw);
    cannon.push({
      x: c.x,
      z: c.z,
      yaw: c.yaw,
      recoil: last === null ? 0 : Math.max(0, 1 - (t - last) / 0.6),
    });
    for (const f of c.fires) {
      const age = t - f;
      if (age < 0 || age >= 4.5) continue;
      if (age < 0.12) flashes.push({ x: c.x + ux * 2.4, y: 1.0, z: c.z + uz * 2.4, yaw: c.yaw });
      for (let k = 0; k < 4; k++) {
        const out = 2.4 + 4 * smooth(age / 1.5) + k * 1.4;
        smoke.push({
          x: c.x + ux * out + 0.6 * age,
          y: 1.0 + 0.45 * age + k * 0.35,
          z: c.z + uz * out + (unit(f * 10, k) - 0.5) * 2,
          r: (0.8 + 2.2 * smooth(age / 3)) * (1 - 0.15 * k),
        });
      }
    }
  }
  // The armoured cars: where each stands and turns, its guns' kick and flashes, and the smoke and
  // the flame of the wrecks that burn.
  const cars: VehicleNow[] = [],
    fumes: { x: number; y: number; z: number; r: number }[] = [],
    flames: { x: number; y: number; z: number; r: number }[] = [];
  for (const v of field.vehicles ?? []) {
    const car = vehicleNow(field, v, t, flashes);
    cars.push(car);
    // (A wreck's flames die down within a minute or so; it smoulders on, smoking, to the end.)
    if (car.knocked > 0)
      for (let k = 0; k < 6; k++) {
        const phase = (t * 0.8 + k * 0.37 + v.u) % 1,
          y = 2 + 9 * phase;
        fumes.push({
          x: car.x + 0.3 * (y - 2),
          y,
          z: car.z,
          r: (0.6 + 1.6 * phase) * Math.max(0.35, car.burning) * car.knocked,
        });
      }
    if (car.burning > 0) {
      for (let k = 0; k < 3; k++) {
        const flicker = 0.5 + 0.5 * Math.sin(t * 9 + k * 2.1 + v.u * 6),
          off = (k - 1) * 1.2;
        flames.push({
          x: car.x + Math.sin(car.yaw) * off,
          y: 1.2 + 0.2 * flicker,
          z: car.z + Math.cos(car.yaw) * off,
          r: (0.5 + 0.4 * flicker) * car.burning,
        });
      }
    }
  }
  // The ladders at a seat's walls: lying at their feet a moment, raised against them, and where
  // the walls held, thrown down off them.
  const w = field.ground.wall,
    ladders: BattleNow["ladders"][number][] = [];
  if (w)
    for (const l of field.ladders) {
      if (t < l.up - 0.6) continue;
      const { foot, lean, long } = ladderOn(w);
      ladders.push({
        x: foot,
        z: l.z,
        rise:
          l.down !== null && t >= l.down
            ? lean + (Math.PI - lean) * smooth((t - l.down) / 1.4)
            : lean * smooth((t - l.up) / 1.6),
        long,
      });
    }
  const stormed = field.near.outcome === "stormed",
    moment = [...field.moments].reverse().find((m) => t >= m.at);
  return {
    s: t,
    troopers,
    flying,
    spent,
    blood,
    spray,
    smoke,
    flashes,
    cannon,
    dust,
    standing,
    fallen,
    ladders,
    gate: stormed ? smooth((t - MOMENTS.gate) / 3) : 0,
    burning: stormed ? smooth((t - MOMENTS.gate - 6) / 14) : 0,
    camp: field.near.outcome === "siege" ? smooth((t - MOMENTS.after - 4) / 10) : 0,
    words: moment?.words ?? "",
    ...(field.vehicles ? { vehicles: cars, fumes, flames } : {}),
  };
}

/**
 * The meadow made the field a battle was fought on: no pool, no wood where the hosts stand,
 * march and run; its grass trodden short where they go (the blood of the fallen seen over it),
 * worn to the earth under the walls and the town behind them, none in the river.
 */
export function fieldMeadow(field: BattleField, meadow: MeadowState): void {
  const g = field.ground;
  meadow.pond = null;
  meadow.shrubs.splice(
    0,
    meadow.shrubs.length,
    ...meadow.shrubs.filter((s) => Math.abs(s.z) > 34 || Math.abs(s.x) > 64),
  );
  for (let i = 0; i < meadow.grass.length; i++) {
    const m = cellMiddle(i),
      u = unit(i, 77);
    meadow.grass[i] =
      g.river && Math.abs(m.x - g.river.x) < g.river.w / 2 + 0.6
        ? 0
        : g.wall && m.x > g.wall.x - 1.5
          ? 0.12
          : Math.abs(m.z) < TRODDEN.z && Math.abs(m.x) < TRODDEN.x
            ? 0.22 + 0.2 * u
            : 0.55 + 0.4 * u;
  }
}

/** Where the hosts tread the grass short (metres either way): over it, the blood is seen. */
export const TRODDEN = { x: 66, z: 40 } as const;

/**
 * What struck one down from afar: an arrow, a dart, a ball, a bullet (the other side's arm). A
 * machine gun's team strikes with its own bullets one time in three (where `id` % 3 is 0), and
 * with its rest's bullets the rest of the time.
 */
export function shotBy(other: BattleNear["attacker"], id: number): string {
  const look = armLook(other.host?.arm);
  return look.team !== undefined && id % 3 !== 0 && look.rest !== undefined
    ? armLook(look.rest).shotWords
    : look.shotWords;
}

/**
 * What one in the later arms is doing as the battle goes on (Phase 53 M220): a machine gun's team
 * rushes once and fires from its tripod; those of an open host rush and go to ground between; the
 * trench's front fires, the rest lie behind it, and those in the trench fight there. Null: the
 * line's own words.
 */
function laterWords(field: BattleField, t: Trooper, s: number): string | null {
  if (t.gun && s >= MOMENTS.advance && s < MOMENTS.rout)
    return runningAt(field, t, s) ? "rushing forward" : "at their machine gun, firing";
  if (t.side === 0 && field.hosts[0]!.open && s >= MOMENTS.advance && s < MOMENTS.melee)
    return runningAt(field, t, s) ? "rushing forward" : "down in the grass, firing";
  if (field.ground.trench && t.side === 1 && s >= MOMENTS.arrows && s < MOMENTS.rout) {
    const trenched = inTrench(field, t, s);
    if (s < MOMENTS.melee)
      return trenched ? "in the trench, firing" : "lying behind the trench, waiting";
    return trenched ? "fighting in the trench" : null;
  }
  return null;
}

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];

/** What one on a ladder is at, in words. */
const CLIMB_WORDS: Partial<Record<Act, string>> = {
  run: "making for a ladder",
  march: "on a ladder",
  fight: "fighting at the top of a ladder",
  stand: "over the walls",
  cheer: "over the walls",
};

/**
 * One who fought, told (the one followed, Phase 37 M186): who they were in their host, and what
 * had become of them by `s` — waiting in the line, coming on, in the press, fallen and how,
 * running from the field, after the beaten.
 */
export function trooperWords(field: BattleField, id: number, s: number): string {
  const t = field.troopers[id];
  if (!t) return "";
  const won = t.side === field.beaten ? false : true,
    // (Of a wing that wheels about the other host's flank.)
    wing = !!field.wings && field.wings.side === t.side && Math.abs(t.z) > field.wings.z,
    crawls = crawlsFor(field, t),
    climb = climbing(field, t, s),
    later = laterWords(field, t, s),
    fate =
      t.falls !== null && s >= t.falls && crawls && s < t.falls + CRAWL.after + crawls
        ? "struck down, dragging themselves back toward their lines"
        : t.falls !== null && s >= t.falls
          ? t.by === "arrow"
            ? `fell to ${shotBy(t.side === 0 ? field.near.defender : field.near.attacker, t.id)}`
            : t.by === "rout"
              ? "cut down as they ran"
              : "fell in the press"
          : t.flees !== null && s >= t.flees
            ? "running from the field"
            : climb
              ? (CLIMB_WORDS[climb.act] ?? "on a ladder")
              : t.gate && s >= MOMENTS.gate
                ? "through the broken gate"
                : t.pursues && s >= MOMENTS.rout && s < MOMENTS.after
                  ? "after the beaten"
                  : later !== null
                    ? later
                    : s < MOMENTS.advance
                      ? "waiting in the line"
                      : s < MOMENTS.melee
                        ? t.side === 0
                          ? "coming on"
                          : "holding the line"
                        : s < MOMENTS.rout
                          ? wing && s > WHEEL.from
                            ? s < WHEEL.to
                              ? "wheeling about their flank"
                              : "falling on their flank"
                            : "in the press"
                          : won
                            ? "standing on the field, its victor"
                            : "standing still";
  return `${trooperWho(field, id)}: ${fate}.`;
}

/**
 * Who one who fought was in their host, told ("👁 A spearman of the realm of Ash, in the second
 * rank"): the words before what had become of them ("" for no such one).
 */
export function trooperWho(field: BattleField, id: number): string {
  const t = field.troopers[id];
  if (!t) return "";
  const side = t.side === 0 ? field.near.attacker : field.near.defender,
    h = field.hosts[t.side]!,
    look = armLook(side.host?.arm),
    who =
      h.mounted === "chariot"
        ? "a chariot's warrior"
        : h.mounted === "horse"
          ? "a rider"
          : t.bearer
            ? "a banner's bearer"
            : t.gun || look.team === undefined
              ? look.fighter
              : armLook(look.rest).fighter,
    rank = ORDINALS[t.rank] ?? `${t.rank + 1}th`,
    each = field.per > 1 ? ` (a figure for ${field.per.toLocaleString("en-US")} men)` : "";
  return `👁 ${who[0]!.toUpperCase()}${who.slice(1)} of ${side.name}, in the ${rank} rank${each}`;
}

/** The men standing and fallen of each side at `s`, as history counts them (so many for each figure). */
export function menAt(
  field: BattleField,
  now: BattleNow,
): { standing: [number, number]; fallen: [number, number] } {
  const men = (side: 0 | 1) => {
    const n = field.hosts[side]!.n,
      fielded = side === 0 ? field.near.attacker.fielded : field.near.defender.fielded,
      fell = side === 0 ? field.near.attacker.fallen : field.near.defender.fallen,
      drawnFalls = field.hosts[side]!.falls,
      // (As the figures fall, so the men: all who fell, once all the figures to fall have.)
      down = drawnFalls ? Math.round((now.fallen[side] / drawnFalls) * fell) : 0;
    return { fallen: down, standing: Math.max(0, fielded - down), n };
  };
  const a = men(0),
    d = men(1);
  return { standing: [a.standing, d.standing], fallen: [a.fallen, d.fallen] };
}
