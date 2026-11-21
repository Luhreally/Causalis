// The god's hand made flesh (Phase 60; asked for 2026-10-27: "add in functionality to possess
// anything like worldbox/worldfall mod ... make sure it works right in mobile"): one of a town's
// people taken over and steered by hand, and the bodies about them moved by a small world of their
// own at a fixed step — each going its way through the town as its day had it, kept out of the
// town's walls and blocks and off each other, and answering what the possessed does to them: a
// word, a blow, a hold, a theft seen. Pure: the scene and the bids kept, and the world's keyed
// draws, give the same world step for step on every machine (no clock is read; every turn is
// dmath's). The sim keeps it and writes back what lasts (sim/hand/possess.ts); the host steps it
// ahead for the page between the seconds sent (host/possess.ts). A body's moves come from what it
// is (a person's hands, legs and trade): Phase 61's soldier, beast and creature add their own.
import { dmath } from "../kernel/index.ts";
import {
  BODY_PLACES,
  CUTS_OFF,
  MEMBERS,
  NINES,
  anatomyOf,
  killShareOf,
  lastingOf,
  lostHow,
  memberOf,
  outcomeOf,
  type Anatomy,
  type BodyPlace,
  type BodyWound,
  type Member,
} from "./anatomy.ts";
import { affordancesOf, bodyFunction, type BodyPlan, type Manipulator } from "./bodies.ts";
import { G } from "./goods.ts";
import { maimedShare, type Blow } from "./wounds.ts";
import {
  FLIGHT,
  FRESH_GAIT,
  GIFT_ACT,
  LOAD,
  SLOW,
  SMITES,
  SMITE_MOST,
  SMITE_REACH,
  gaitStep,
  gifted,
  type Gait,
  type SmiteKind,
} from "./gifts.ts";

/** Steps a second: a bid is sampled, and the small world stepped, this often. */
export const POSSESS_HZ = 20;
const DT = 1 / POSSESS_HZ;
/** A body's half breadth (metres): kept this far off a wall, and twice it off another's middle. */
export const FLESH_R = 0.35;
/** A run (metres a second); a walk is the body's own pace (the view's), the possessed's a stride more. */
export const RUN_PACE = 3.4;
export const HAND_STRIDE = 1.3;
/** How far each act reaches (metres). */
export const HAND_REACH = { work: 2.4, talk: 3.2, strike: 1.6, wrestle: 1.4, take: 2.8, pick: 1.9 };
/** How far a deed is seen, and a brawl heard (metres). */
export const SEEN_M = 18,
  HEARD_M = 28;
/** The most a small world holds: bodies, solids, places, way points a body, bodies joined a second. */
export const POSSESS_MOST = { bodies: 200, solids: 1200, places: 64, ways: 12, joins: 16 };
/** How far from where he was taken the possessed may go (metres: about the town drawn). */
export const POSSESS_BOUNDS = 260;
/** Undisturbed, a body this far from the possessed goes back to the views (metres). */
export const LEAVE_M = 75;
/** Acts of work that make a thing. */
export const WORK_STAGES = 4;
/**
 * How often a bare hand's blow kills or maims, against an arm's of the same kind (rules/anatomy.ts
 * killShareOf, rules/wounds.ts maimedShare): a brawl's fists are not a battle's clubs.
 */
export const BARE_SHARE = 0.2;
/** How long things take (steps): a stage of work, a blow, a hold, lying thrown, a word heard, flight, a look, a word shown, between a fighter's blows. */
export const HAND_TAKES = {
  work: 16,
  strike: 8,
  wrestle: 20,
  thrown: 40,
  listen: 40,
  flee: 100,
  watch: 60,
  say: 50,
  fight: 12,
  come: 600,
};
/** How long one come running waits before parting a brawl (steps). */
const PARTS = 30;
/** For good (a step no possession reaches). */
const EVER = 2 ** 31;

/** What the possessed is bid to do at a step (0: nothing). Phase 61's bodies take 8 and on. */
export const HAND_ACT = {
  none: 0,
  work: 1,
  talk: 2,
  strike: 3,
  wrestle: 4,
  take: 5,
  pick: 6,
  drop: 7,
};

/**
 * What a body is doing: going its day's way; moved by hand (the possessed); at work by hand;
 * hearing a word; a blow's swing; locked in a hold; thrown and getting up; struck down (hurt, or
 * dead); fleeing, fighting, come running; looking on.
 */
export const BODY_DOINGS = [
  "way",
  "hand",
  "work",
  "listen",
  "strike",
  "wrestle",
  "thrown",
  "down",
  "dead",
  "flee",
  "fight",
  "come",
  "watch",
  // (Following the one held where the god's Command calls those near: rules/gifts.ts.)
  "follow",
] as const;
export type BodyDoing = (typeof BODY_DOINGS)[number];

/** What a body is like (bits): of the traits that weigh in a brawl, and its age. */
export const BODY_NATURE = {
  brave: 1,
  kind: 2,
  greedy: 4,
  pious: 8,
  child: 16,
  old: 32,
  hardy: 64,
  frail: 128,
};
/** What the hand's deeds did to a body (bits). */
export const HAND_MARK = {
  struck: 1,
  saw: 2,
  theft: 4,
  spoken: 8,
  thrown: 16,
  came: 32,
  // (Called to follow him by the god's Command: rules/gifts.ts.)
  follows: 64,
  healed: 128,
};
/** The words shown over a body (0: none). */
export const BODY_SAYS = ["", "💬", "😊", "😠", "😨", "Thief!", "Stop!", "✋"] as const;
const SAY = { none: 0, talk: 1, glad: 2, cross: 3, afraid: 4, thief: 5, stop: 6, hold: 7 };

/** The places of a town the possessed works or takes at. */
export const WORK_PLACES = [
  "forge",
  "wheel",
  "loom",
  "row",
  "granary",
  "rack",
  "boards",
  "shop",
] as const;
export type WorkPlaceKind = (typeof WORK_PLACES)[number];
/** A place: where one stands at it and which way they face; a field's row, the field's middle and its breadth and depth. */
export type WorkPlace = {
  readonly kind: WorkPlaceKind;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly w?: number;
  readonly d?: number;
};
/** Where each trade works by hand, and where what it makes is set. */
export const TRADE_PLACE: Readonly<Record<string, WorkPlaceKind>> = {
  smith: "forge",
  potter: "wheel",
  weaver: "loom",
  farmer: "row",
};
export const GIVEN_AT: Readonly<Record<string, WorkPlaceKind>> = {
  smith: "rack",
  potter: "boards",
  weaver: "shop",
  farmer: "granary",
};
/** What each store keeps, to be taken (rules/goods.ts G). */
export const STORE_GOOD: Readonly<Partial<Record<WorkPlaceKind, number>>> = {
  granary: G.grain,
  rack: G.tools,
  boards: G.pottery,
  shop: G.clothing,
};

/**
 * What a thing in hand is: the good it is the town's as (so many made to a unit), the blow it
 * strikes, how hard, how often against an arm's its blow kills or maims (BARE_SHARE for bare
 * hands and soft things; rules/anatomy.ts and rules/wounds.ts deal an arm's), and how it is
 * carried (the view's Carry).
 */
export type InHand = {
  readonly good: number;
  readonly per: number;
  readonly blow: Blow;
  readonly harm: number;
  readonly arm: number;
  readonly carry: string;
};
/** The day's things made by hand, by their form. */
export const HAND_FORMS: Readonly<Record<string, InHand>> = {
  sickle: { good: G.tools, per: 1, blow: "edge", harm: 0.42, arm: 1, carry: "tool" },
  hoe: { good: G.tools, per: 1, blow: "edge", harm: 0.34, arm: 1, carry: "tool" },
  axe: { good: G.tools, per: 1, blow: "edge", harm: 0.5, arm: 1, carry: "tool" },
  knife: { good: G.tools, per: 1, blow: "edge", harm: 0.4, arm: 1, carry: "tool" },
  spearhead: { good: G.tools, per: 1, blow: "point", harm: 0.45, arm: 1, carry: "tool" },
  "plough share": { good: G.tools, per: 1, blow: "blunt", harm: 0.32, arm: 0.5, carry: "tool" },
  "storage jar": { good: G.pottery, per: 1, blow: "blunt", harm: 0.26, arm: 0.4, carry: "raw" },
  "cooking pot": { good: G.pottery, per: 1, blow: "blunt", harm: 0.24, arm: 0.4, carry: "raw" },
  bowl: { good: G.pottery, per: 1, blow: "blunt", harm: 0.16, arm: 0.3, carry: "raw" },
  jug: { good: G.pottery, per: 1, blow: "blunt", harm: 0.2, arm: 0.3, carry: "raw" },
  cloth: { good: G.clothing, per: 1, blow: "blunt", harm: 0.05, arm: BARE_SHARE, carry: "cloth" },
  sheaf: { good: G.grain, per: 10, blow: "blunt", harm: 0.04, arm: BARE_SHARE, carry: "sheaf" },
  // (A row hoed or sown out of the harvest: work done, nothing to carry.)
  row: { good: -1, per: 1, blow: "blunt", harm: 0, arm: BARE_SHARE, carry: "" },
};
/** A good taken from a store, in hand. */
const GOOD_HELD: Readonly<Partial<Record<number, InHand>>> = {
  [G.grain]: { good: G.grain, per: 1, blow: "blunt", harm: 0.1, arm: BARE_SHARE, carry: "sack" },
  [G.tools]: { good: G.tools, per: 1, blow: "edge", harm: 0.36, arm: 1, carry: "tool" },
  [G.pottery]: { good: G.pottery, per: 1, blow: "blunt", harm: 0.2, arm: 0.4, carry: "pots" },
  [G.clothing]: {
    good: G.clothing,
    per: 1,
    blow: "blunt",
    harm: 0.05,
    arm: BARE_SHARE,
    carry: "cloth",
  },
};
/** Bare hands. */
export const BARE_HANDS: InHand = {
  good: -1,
  per: 1,
  blow: "blunt",
  harm: 0.2,
  arm: BARE_SHARE,
  carry: "",
};

/** What each way of handling the world strikes with bare: claws cut, mandibles and tentacles crush, a trunk swings (Phase 61). */
export const BARE_OF: Readonly<Record<Manipulator, InHand>> = {
  hands: BARE_HANDS,
  claws: { ...BARE_HANDS, blow: "edge", harm: 0.4, arm: 0.45 },
  mandibles: { ...BARE_HANDS, blow: "crush", harm: 0.38, arm: 0.45 },
  tentacles: { ...BARE_HANDS, blow: "crush", harm: 0.26, arm: 0.3 },
  trunk: { ...BARE_HANDS, blow: "blunt", harm: 0.45, arm: 0.5 },
};

/**
 * A people's body as the hand moves it (Phase 61: the peoples of other worlds by their own plans):
 * its run against an upright ape's (as its walk is against one's: view/figure.ts paceOf), its
 * strength (rules/bodies.ts affordancesOf), what its bare blows deal and how hard, and its members
 * (rules/anatomy.ts: where a blow lands on it, and what it is called there).
 */
export type PersonFrame = {
  readonly run: number;
  readonly strength: number;
  readonly bare: InHand;
  readonly anatomy: Anatomy;
};

/** A people's frame (null: an upright ape with hands, moved as Phase 60 moves them). */
export function personFrame(body: BodyPlan | null): PersonFrame | null {
  // (An upright ape's own: a people risen from its world's tree always moves by its own frame, B4.)
  if (!body || (!bodyFunction(body).risen && body.clade === "ape" && body.manipulators === "hands"))
    return null;
  const walk =
    body.medium === "water"
      ? 1.4
      : body.skin === "feathers"
        ? 2
        : body.manipulators === "trunk"
          ? 1
          : body.skin === "shell"
            ? 0.75
            : body.skin === "scales"
              ? 0.9
              : 1.15;
  return {
    run: walk / 1.25,
    strength: dmath.clamp(affordancesOf(body).strength, 0.5, 2),
    bare: BARE_OF[body.manipulators] ?? BARE_HANDS,
    anatomy: anatomyOf(body),
  };
}

/** Where a blow lands on a body (weights in MEMBERS' order): the nines, laid on what bears a place it lacks (a hand's on its arm, else the body). */
export function landsOn(a: Anatomy): number[] {
  const has = new Set(a.members),
    w = MEMBERS.map(() => 0);
  for (const p of BODY_PLACES) {
    const arm: Member | null = p === "hand-l" ? "arm-l" : p === "hand-r" ? "arm-r" : null,
      on: Member = has.has(p) ? p : arm && has.has(arm) ? arm : "trunk",
      k = MEMBERS.indexOf(on);
    w[k] = (w[k] ?? 0) + NINES[p];
  }
  return w;
}

/** A body of the small world. */
export type LocalBody = {
  /** The hand's person it is (Agent.id). */
  readonly id: number;
  /** Where it stands (metres from the town's middle), which way it faces (0 toward +z, a quarter turn toward +x, as the view's), how it moves (metres a second). */
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  doing: BodyDoing;
  /** The step its doing ends (a fighter's: its next blow). */
  until: number;
  /** Whom it is set on — fighting, fleeing, hearing, coming to, held by (an id; -1 none). */
  foe: number;
  /** Strength left: 0 … 1 (struck down at none). */
  strength: number;
  /** What it carries: 0 nothing, a good + 1, or -(k + 1) the k-th thing made by hand. */
  carry: number;
  /** What it is like (NATURE's bits). */
  readonly nature: number;
  /** Its walking pace (metres a second). */
  readonly pace: number;
  /** Its day's way ahead, as the view had it: step, x, z, yaw, task each, in order. */
  ways: number[];
  /** What it is seen at standing at its way (the view's TASKS index; -1 none). */
  task: number;
  /** What the hand's deeds did to it (MARK's bits). */
  marks: number;
  /** How the hand moved its spirits: -1 … 1. */
  mood: number;
  /** A word over it (SAYS' index) and the step it goes. */
  say: number;
  sayUntil: number;
};

/** What the possessed did, or was done to him, that lasts. */
export type HandDeed =
  | { readonly kind: "made"; readonly step: number; readonly form: string; readonly made: number }
  | {
      readonly kind: "struck";
      readonly step: number;
      readonly agent: number;
      readonly by: number;
      readonly blow: Blow;
      readonly place: BodyPlace;
      readonly dead: boolean;
      readonly maimed: boolean;
      /** What struck it, in hand ("sickle"; null: bare hands). */
      readonly arm: string | null;
      /** Struck down by a gift: at a touch (strength), or by a stroke called down; and by how many seen. */
      readonly gift?: "strength" | SmiteKind;
      readonly seen?: number;
    }
  | { readonly kind: "spoke"; readonly step: number; readonly agent: number; readonly mood: number }
  | {
      readonly kind: "took";
      readonly step: number;
      readonly good: number;
      readonly from: WorkPlaceKind;
      /** How many saw it. */
      readonly seen: number;
    }
  | {
      readonly kind: "gave";
      readonly step: number;
      readonly carry: number;
      readonly to: WorkPlaceKind;
    }
  | { readonly kind: "parted"; readonly step: number; readonly by: number }
  // The god's gifts (rules/gifts.ts): one healed by his touch (was down, hurt, or whole but for old wounds); a stroke called
  // down at a place and those it struck down; a blow on him that did no harm; his rising into the air; each seen by so many.
  | {
      readonly kind: "healed";
      readonly step: number;
      readonly agent: number;
      readonly was: "down" | "hurt" | "whole";
      readonly seen: number;
    }
  | {
      readonly kind: "smote";
      readonly step: number;
      readonly smite: SmiteKind;
      readonly x: number;
      readonly z: number;
      readonly struck: number;
      readonly seen: number;
    }
  | { readonly kind: "warded"; readonly step: number; readonly by: number; readonly seen: number }
  | { readonly kind: "flew"; readonly step: number; readonly seen: number };

/** The town about him, as the view drew it when he was taken. */
export type LocalScene = {
  /** Where he was taken (metres from the town's middle): the middle of where he may go. */
  readonly x: number;
  readonly z: number;
  /** The town's solids about him: x, z, r, ax, az, half, across each (view/ground.ts Solid; 0 for none). */
  readonly solids: readonly number[];
  readonly places: readonly WorkPlace[];
  /** His trade, by what his hands make ("smith", "potter", "weaver", "farmer"; "" none), and the day's thing it makes. */
  readonly trade: string;
  readonly form: string;
  /** The care for wounds his land knows (rules/wounds.ts woundCare): 0 … 1. */
  readonly care: number;
  /** His people's body, where it is not an upright ape's with hands (Phase 61: personFrame). */
  readonly frame?: PersonFrame;
  /**
   * His top speed at a sprint, unhurt and unladen (m/s: rules/gifts.ts sprintTop), and his age's share of a prime body's
   * breath; how high the town's roofs stand (m), over which a flier is not held by its walls. Absent (a possession taken
   * before 2026-11-21): a run at RUN_PACE, as it always was.
   */
  readonly top?: number;
  readonly age?: number;
  readonly roofs?: number;
};

/** The small world as it stands. */
export type LocalWorld = {
  step: number;
  /** Its bodies, the possessed first. */
  bodies: LocalBody[];
  /** Things lying on the ground: where, and what (a carry). */
  lying: { x: number; z: number; carry: number }[];
  /** The things made by hand: their form, when, where. */
  made: { form: string; step: number; x: number; z: number }[];
  deeds: HandDeed[];
  /** Stages done of the thing at hand. */
  work: number;
  /** What was done last, for its words: TOLD's index, the step, whom, and a number more (a stage, a place, a good). */
  told: number[];
  /** Why it ended ("": it goes on; "down": the possessed struck down). */
  ended: string;
  /** The possessed's breath and height (absent: full breath, on the ground); the god's gifts this second (absent: none). */
  gait?: Gait;
  gifts?: number;
  /** Whom the possessed last struck at (an id; absent: none): those he commands go for them. */
  aim?: number;
};

/** What the last act came to, for its words. */
export const HAND_TOLD = [
  "",
  "worked",
  "made",
  "no-trade",
  "no-place",
  "spoke",
  "no-one",
  "struck",
  "missed",
  "felled",
  "held",
  "threw",
  "thrown",
  "took",
  "nothing",
  "full",
  "picked",
  "set",
  "gave",
  "empty",
  "busy",
  "parted",
  "down",
  // (The god's gifts: rules/gifts.ts.)
  "warded",
  "healed",
  "no-heal",
  "smote",
  "aloft",
] as const;
export type HandTold = (typeof HAND_TOLD)[number];
const told = (l: LocalWorld, what: HandTold, step: number, id = -1, more = 0) => {
  l.told = [HAND_TOLD.indexOf(what), step, id, more];
};

/** A step's bid: which way on the ground (x and z, -31 … 31: a unit of the ground's), at a run or not, the act; rising (wings). */
export type HandBid = {
  readonly mx: number;
  readonly mz: number;
  readonly run: boolean;
  readonly act: number;
  readonly rise?: boolean;
};
export const NO_HAND_BID: HandBid = { mx: 0, mz: 0, run: false, act: 0 };
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** A bid in three letters (six bits each): x and z each from 0 (6 bits), a run (1 bit), the act (4 bits), rising (1 bit). */
export function bidLetters(b: HandBid): string {
  const k = (v: number) => Math.max(-31, Math.min(31, Math.round(v))) + 31,
    n =
      k(b.mx) |
      (k(b.mz) << 6) |
      ((b.run ? 1 : 0) << 12) |
      ((b.act & 15) << 13) |
      ((b.rise ? 1 : 0) << 17);
  return LETTERS[n & 63]! + LETTERS[(n >> 6) & 63]! + LETTERS[(n >> 12) & 63]!;
}

/** The bids in letters, three to a step (null: not bids). */
export function bidsOf(letters: string): HandBid[] | null {
  if (letters.length % 3) return null;
  const out: HandBid[] = [];
  for (let i = 0; i < letters.length; i += 3) {
    const a = LETTERS.indexOf(letters[i]!),
      b = LETTERS.indexOf(letters[i + 1]!),
      c = LETTERS.indexOf(letters[i + 2]!);
    if (a < 0 || b < 0 || c < 0) return null;
    const n = a | (b << 6) | (c << 12),
      mx = (n & 63) - 31,
      mz = ((n >> 6) & 63) - 31;
    if (mx > 31 || mz > 31) return null;
    out.push({
      mx,
      mz,
      run: ((n >> 12) & 1) === 1,
      act: (n >> 13) & 15,
      ...((n >> 17) & 1 ? { rise: true } : {}),
    });
  }
  return out;
}

/** A keyed draw of the world's (0 … 1): about whom, at which step, for what, its n-th. */
export type LocalDraw = (subject: number, step: number, purpose: number, n?: number) => number;
/** What each draw is for. */
const P = { hit: 1, harm: 2, answer: 3, come: 4, place: 5, kill: 6, maim: 7, mood: 8, throw: 9 };

/** A body as it joins: where the view drew it, what it is like and its day's way ahead. */
export function localBody(
  id: number,
  at: { x: number; z: number; yaw: number; task: number; pace: number },
  nature: number,
  strength: number,
  ways: readonly number[],
  hand = false,
): LocalBody {
  return {
    id,
    x: at.x,
    z: at.z,
    yaw: at.yaw,
    vx: 0,
    vz: 0,
    doing: hand ? "hand" : "way",
    until: 0,
    foe: -1,
    strength,
    carry: 0,
    nature,
    pace: at.pace,
    ways: [...ways],
    task: at.task,
    marks: 0,
    mood: 0,
    say: 0,
    sayUntil: 0,
  };
}

/** A fresh small world: the possessed and the bodies about him. */
export function localWorld(step: number, bodies: LocalBody[]): LocalWorld {
  return {
    step,
    bodies,
    lying: [],
    made: [],
    deeds: [],
    work: 0,
    told: [0, step, -1, 0],
    ended: "",
  };
}

/** A copy of a small world to step ahead without touching the kept one (the host's). */
export function copyLocal(l: LocalWorld): LocalWorld {
  return {
    step: l.step,
    bodies: l.bodies.map((b) => ({ ...b, ways: b.ways })),
    lying: l.lying.map((x) => ({ ...x })),
    made: [...l.made],
    deeds: [...l.deeds],
    work: l.work,
    told: [...l.told],
    ended: l.ended,
    ...(l.gait ? { gait: { ...l.gait } } : {}),
    ...(l.gifts ? { gifts: l.gifts } : {}),
    ...(l.aim !== undefined ? { aim: l.aim } : {}),
  };
}

// —— The town's solids ——————————————————————————————————————————————————————————

/** The solids' cells (8 m), kept for the scene they were found for. */
const CELL = 8;
let solidsKept: { solids: readonly number[]; cells: Map<number, number[]> } | null = null;
const cellKey = (ix: number, iz: number) => (ix + 32768) * 65536 + (iz + 32768);

function solidCells(solids: readonly number[]): Map<number, number[]> {
  if (solidsKept?.solids === solids) return solidsKept.cells;
  const cells = new Map<number, number[]>();
  for (let s = 0; s < solids.length; s += 7) {
    const half = solids[s + 5]!,
      across = solids[s + 6]!,
      reach = solids[s + 2]! + dmath.sqrt(half * half + across * across) + FLESH_R + 0.5,
      x0 = Math.floor((solids[s]! - reach) / CELL),
      x1 = Math.floor((solids[s]! + reach) / CELL),
      z0 = Math.floor((solids[s + 1]! - reach) / CELL),
      z1 = Math.floor((solids[s + 1]! + reach) / CELL);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const k = cellKey(ix, iz),
          list = cells.get(k);
        if (list) list.push(s);
        else cells.set(k, [s]);
      }
  }
  solidsKept = { solids, cells };
  return cells;
}

/** Push a point out of the s-th solid (with `reach` to spare) to the nearest point of its wall, in place (view/ground.ts pushOut's). */
function pushOut(
  solids: readonly number[],
  s: number,
  p: { x: number; z: number },
  reach: number,
): void {
  const sx = solids[s]!,
    sz = solids[s + 1]!,
    sr = solids[s + 2]!,
    h = solids[s + 5]!,
    w = solids[s + 6]!,
    ax = h || w ? solids[s + 3]! : 1,
    az = h || w ? solids[s + 4]! : 0;
  // (The point of its core nearest: along its axis, and across it for a box.)
  let cx = sx,
    cz = sz;
  if (h || w) {
    const dx = p.x - sx,
      dz = p.z - sz,
      t = Math.max(-h, Math.min(h, dx * ax + dz * az));
    if (!w) {
      cx = sx + ax * t;
      cz = sz + az * t;
    } else {
      const n = Math.max(-w, Math.min(w, -dx * az + dz * ax));
      cx = sx + ax * t - az * n;
      cz = sz + az * t + ax * n;
    }
  }
  const r = sr + reach,
    dx = p.x - cx,
    dz = p.z - cz,
    d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  const d = dmath.sqrt(d2);
  if (d < 1e-9) {
    if (w) {
      // (Within a box's core: out by its nearer side.)
      const ex = p.x - sx,
        ez = p.z - sz,
        t = ex * ax + ez * az,
        n = -ex * az + ez * ax;
      if (h - Math.abs(t) < w - Math.abs(n)) {
        const out = (t < 0 ? -1 : 1) * (h + r);
        p.x = sx + ax * out - az * n;
        p.z = sz + az * out + ax * n;
      } else {
        const out = (n < 0 ? -1 : 1) * (w + r);
        p.x = sx + ax * t - az * out;
        p.z = sz + az * t + ax * out;
      }
      return;
    }
    // (On the core itself: out across it.)
    p.x = cx - az * r;
    p.z = cz + ax * r;
    return;
  }
  p.x = cx + (dx / d) * r;
  p.z = cz + (dz / d) * r;
}

/** Keep a body out of the town's solids (pushed again where out of one is into the next). */
function keepOut(scene: LocalScene, b: LocalBody): void {
  const cells = solidCells(scene.solids),
    list = cells.get(cellKey(Math.floor(b.x / CELL), Math.floor(b.z / CELL)));
  if (!list) return;
  for (let pass = 0; pass < 2; pass++) {
    const x = b.x,
      z = b.z;
    for (const s of list) pushOut(scene.solids, s, b, FLESH_R);
    if (b.x === x && b.z === z) return;
  }
}

// —— Who is where ———————————————————————————————————————————————————————————————

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  dmath.sqrt((a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z));
const standing = (b: LocalBody) => b.doing !== "down" && b.doing !== "dead" && b.doing !== "thrown";
const grown = (b: LocalBody) => !(b.nature & (BODY_NATURE.child | BODY_NATURE.old));

/** A turn toward `to` from `from`, the short way round, at most `most` (radians). */
function turned(from: number, to: number, most: number): number {
  let d = to - from;
  while (d > dmath.PI) d -= dmath.TAU;
  while (d < -dmath.PI) d += dmath.TAU;
  return from + Math.max(-most, Math.min(most, d));
}
const facing = (from: { x: number; z: number }, to: { x: number; z: number }) =>
  dmath.atan2(to.x - from.x, to.z - from.z);

/**
 * The body before `a` within `reach` that an act falls on: the nearest of those standing in
 * front of it (within a third of a turn either side), else the nearest within half the reach.
 */
export function bodyBefore(l: LocalWorld, a: LocalBody, reach: number): LocalBody | null {
  const fx = dmath.sin(a.yaw),
    fz = dmath.cos(a.yaw);
  let best: LocalBody | null = null,
    bestD = Infinity;
  for (const b of l.bodies) {
    if (b === a || !standing(b)) continue;
    const d = dist(a, b);
    if (d > reach || d >= bestD) continue;
    const ahead = d > 1e-6 ? ((b.x - a.x) * fx + (b.z - a.z) * fz) / d : 1;
    if (ahead < 0.5 && d > reach / 2) continue;
    best = b;
    bestD = d;
  }
  return best;
}

/** Whether a point stands at a place: within `reach` of where one stands at it; a field's anywhere on it. */
function atPlace(p: WorkPlace, x: number, z: number, reach: number): number {
  if (p.kind === "row" && p.w && p.d) {
    const ax = dmath.cos(p.yaw),
      az = -dmath.sin(p.yaw),
      dx = x - p.x,
      dz = z - p.z,
      a = Math.abs(dx * ax + dz * az) - p.w / 2,
      b = Math.abs(-dx * az + dz * ax) - p.d / 2;
    return Math.max(0, a, b) <= 1 ? 0 : Infinity;
  }
  const d = dmath.sqrt((x - p.x) * (x - p.x) + (z - p.z) * (z - p.z));
  return d <= reach ? d : Infinity;
}

/** The nearest place of a kind (any of `kinds`) within reach of a body (-1: none). */
export function workPlaceNear(
  scene: LocalScene,
  b: LocalBody,
  kinds: readonly WorkPlaceKind[],
  reach: number,
): number {
  let best = -1,
    bestD = Infinity;
  scene.places.forEach((p, i) => {
    if (!kinds.includes(p.kind)) return;
    const d = atPlace(p, b.x, b.z, reach);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** The nearest place of a kind at all (-1: none), and how far. */
export function nearestWorkPlace(
  scene: LocalScene,
  b: LocalBody,
  kind: WorkPlaceKind,
): { place: number; far: number } {
  let place = -1,
    far = Infinity;
  scene.places.forEach((p, i) => {
    if (p.kind !== kind) return;
    const d = dmath.sqrt((b.x - p.x) * (b.x - p.x) + (b.z - p.z) * (b.z - p.z));
    if (d < far) {
      place = i;
      far = d;
    }
  });
  return { place, far };
}

/** What a body has in hand: the thing made, the good taken, or bare hands (its people's: `bare`). */
export function inHand(
  l: LocalWorld,
  carry: number,
  bare: InHand = BARE_HANDS,
): InHand & { readonly form: string | null } {
  if (carry < 0) {
    const form = l.made[-carry - 1]?.form ?? "";
    return { ...(HAND_FORMS[form] ?? bare), form: form || null };
  }
  if (carry > 0) {
    const h = GOOD_HELD[carry - 1];
    return { ...(h ?? bare), form: null };
  }
  return { ...bare, form: null };
}

/** The good a carried thing is the town's as (-1: none). */
export function carriedGood(l: LocalWorld, carry: number): number {
  if (carry < 0) return HAND_FORMS[l.made[-carry - 1]?.form ?? ""]?.good ?? -1;
  return carry > 0 ? carry - 1 : -1;
}

// —— What the hand's deeds do to those about ————————————————————————————————————

/** How hard a blow lands on a body, by what it is like: the hardy the less, the frail, the young and the old the more. */
function toughness(b: LocalBody): number {
  return (
    (b.nature & BODY_NATURE.hardy ? 0.8 : 1) *
    (b.nature & BODY_NATURE.frail ? 1.3 : 1) *
    (b.nature & BODY_NATURE.child ? 1.5 : b.nature & BODY_NATURE.old ? 1.2 : 1)
  );
}

/** How strong a body is whole, by what it is like (as sim/hand/possess.ts bodyFor draws it, a fresh blow aside). */
export function wholeStrength(nature: number, frame?: PersonFrame): number {
  const N = BODY_NATURE;
  return (
    (nature & N.child ? 0.5 : nature & N.old ? 0.7 : 1) *
    (nature & N.hardy ? 1.15 : 1) *
    (nature & N.frail ? 0.8 : 1) *
    (frame?.strength ?? 1)
  );
}

/** How many standing within `r` of a point see what is done there (the possessed not among them). */
function witnesses(l: LocalWorld, x: number, z: number, r: number): number {
  let n = 0;
  for (let i = 1; i < l.bodies.length; i++) {
    const b = l.bodies[i]!;
    if (standing(b) && (b.x - x) * (b.x - x) + (b.z - z) * (b.z - z) <= r * r) n++;
  }
  return n;
}

/** Whether the possessed is up in the air on the god's wings, out of any reach by hand. */
export const aloft = (l: LocalWorld): boolean => (l.gait?.y ?? 0) > FLIGHT.clear;
/** Whether others do not notice the possessed (the god's gift of being unseen). */
const unseen = (l: LocalWorld) => gifted(l.gifts, "unseen");

/** What a stroke called down strikes with: a bolt's fire, a fire's. */
const BOLT: InHand & { readonly form: string } = {
  good: -1,
  per: 1,
  blow: "fire",
  harm: 1,
  arm: 1,
  carry: "",
  form: "lightning",
};
const FLAME: InHand & { readonly form: string } = { ...BOLT, arm: 0.7, form: "fire" };

/** Struck down: where the last blow landed (by the nines), and whether it killed or maimed (the blows' own shares). */
function strikeDown(
  scene: LocalScene,
  l: LocalWorld,
  b: LocalBody,
  by: number,
  held: InHand & { readonly form: string | null },
  draw: LocalDraw,
  s: number,
  gift?: "strength" | SmiteKind,
): void {
  const weights = scene.frame
      ? landsOn(scene.frame.anatomy)
      : MEMBERS.map((m) => NINES[m as BodyPlace] ?? 0),
    place = memberOf(weights, draw(b.id, s, P.place)) as BodyPlace,
    dead = draw(b.id, s, P.kill) < killShareOf(place, held.blow) * held.arm,
    maimed =
      !dead &&
      draw(b.id, s, P.maim) <
        maimedShare(held.blow, scene.care) *
          held.arm *
          (held.form && CUTS_OFF.has(held.form) ? 1.5 : 1);
  b.strength = 0;
  b.doing = dead ? "dead" : "down";
  b.until = EVER;
  b.vx = b.vz = 0;
  b.say = 0;
  // (What it carried falls by it.)
  if (b.carry) {
    l.lying.push({ x: b.x, z: b.z, carry: b.carry });
    b.carry = 0;
  }
  l.deeds.push({
    kind: "struck",
    step: s,
    agent: b.id,
    by,
    blow: held.blow,
    place,
    dead,
    maimed,
    arm: held.form,
    ...(gift ? { gift } : {}),
    ...(gift === "strength" ? { seen: unseen(l) ? 0 : witnesses(l, b.x, b.z, SEEN_M) } : {}),
  });
  if (b === l.bodies[0]) {
    l.ended = "down";
    told(l, "down", s, by);
  }
}

/** One struck (or thrown) and standing answers: fights back if it has the heart and the strength for it, else flees. */
function answer(b: LocalBody, foe: LocalBody, draw: LocalDraw, s: number): void {
  if (b.doing === "fight") {
    b.foe = foe.id;
    return;
  }
  const fights =
    grown(b) &&
    draw(b.id, s, P.answer) <
      (b.nature & BODY_NATURE.brave ? 0.75 : 0.35) + 0.3 * (b.strength - foe.strength);
  b.doing = fights ? "fight" : "flee";
  b.foe = foe.id;
  b.until = fights ? s + 4 : s + HAND_TAKES.flee;
  b.say = fights ? SAY.cross : SAY.afraid;
  b.sayUntil = s + HAND_TAKES.say;
}

/**
 * Those about a blow or a hold see it: the bold beside it stand with the one struck; others come
 * running to part it, flee, or look on; the brawl is heard further.
 */
function seen(l: LocalWorld, a: LocalBody, at: LocalBody, draw: LocalDraw, s: number): void {
  for (const c of l.bodies) {
    if (c === a || c === at || !standing(c)) continue;
    if (c.doing === "fight" || c.doing === "come" || c.doing === "flee" || c.doing === "wrestle")
      continue;
    const d = dist(c, at),
      r = draw(c.id, s, P.come);
    if (d <= SEEN_M) {
      c.marks |= HAND_MARK.saw;
      c.mood = Math.max(-1, c.mood - 0.08);
      if (d <= 3 && grown(c) && c.nature & BODY_NATURE.brave && r < 0.5) {
        c.doing = "fight";
        c.foe = a.id;
        c.until = s + HAND_TAKES.fight;
        c.say = SAY.cross;
        c.sayUntil = s + HAND_TAKES.say;
      } else if (grown(c) && r < (c.nature & BODY_NATURE.brave ? 0.55 : 0.22)) {
        c.doing = "come";
        c.foe = a.id;
        c.until = s + HAND_TAKES.come;
        c.say = SAY.stop;
        c.sayUntil = s + HAND_TAKES.say;
      } else if (!grown(c) || r < 0.6) {
        c.doing = "flee";
        c.foe = a.id;
        c.until = s + HAND_TAKES.flee;
        c.say = SAY.afraid;
        c.sayUntil = s + HAND_TAKES.say;
      } else {
        c.doing = "watch";
        c.foe = a.id;
        c.until = s + HAND_TAKES.watch;
      }
    } else if (d <= HEARD_M && grown(c) && r < (c.nature & BODY_NATURE.brave ? 0.25 : 0.08)) {
      c.doing = "come";
      c.foe = a.id;
      c.until = s + HAND_TAKES.come;
    }
  }
}

/** A theft seen: by how many, their spirits lowered, the first crying it, the bold coming. */
function theftSeen(l: LocalWorld, a: LocalBody, draw: LocalDraw, s: number): number {
  let n = 0;
  for (const c of l.bodies) {
    if (c === a || !standing(c) || dist(c, a) > SEEN_M) continue;
    n++;
    c.marks |= HAND_MARK.theft;
    c.mood = Math.max(-1, c.mood - 0.12);
    if (n === 1) {
      c.say = SAY.thief;
      c.sayUntil = s + HAND_TAKES.say;
    }
    if (
      grown(c) &&
      c.doing !== "fight" &&
      c.doing !== "come" &&
      draw(c.id, s, P.come) < (c.nature & BODY_NATURE.brave ? 0.4 : 0.15)
    ) {
      c.doing = "come";
      c.foe = a.id;
      c.until = s + HAND_TAKES.come;
    }
  }
  return n;
}

// —— The god's gifts in a body (rules/gifts.ts) ——————————————————————————————————

/** One running from `a`, afraid. */
function fleeFrom(b: LocalBody, a: LocalBody, s: number): void {
  b.doing = "flee";
  b.foe = a.id;
  b.until = s + HAND_TAKES.flee;
  b.say = SAY.afraid;
  b.sayUntil = s + HAND_TAKES.say;
}

/** One thrown to the ground where they stood (by a bolt near them, the ground shaken). */
function throwDown(b: LocalBody, s: number): void {
  b.doing = "thrown";
  b.foe = -1;
  b.until = s + HAND_TAKES.thrown;
  b.vx = b.vz = 0;
  b.marks |= HAND_MARK.thrown;
  b.say = SAY.afraid;
  b.sayUntil = s + HAND_TAKES.say;
}

/** Whether a body is hurt: struck down or thrown, or less strong than it is whole. */
function hurt(scene: LocalScene, b: LocalBody): boolean {
  return (
    b.doing === "down" ||
    b.doing === "thrown" ||
    b.strength < wholeStrength(b.nature, scene.frame) - 1e-6
  );
}

/**
 * Whom a healing touch falls on: of those within a word's reach (the struck down too: they are touched where they lie,
 * the dead not), the nearest hurt, else the nearest; else himself, where he is hurt (null: none to heal).
 */
export function healTarget(scene: LocalScene, l: LocalWorld, a: LocalBody): LocalBody | null {
  let best: LocalBody | null = null,
    bestD = Infinity,
    hurtBest = false;
  for (const b of l.bodies) {
    if (b === a || b.doing === "dead") continue;
    const d = dist(a, b);
    if (d > HAND_REACH.talk) continue;
    const h = hurt(scene, b);
    if ((h && !hurtBest) || (h === hurtBest && d < bestD)) {
      best = b;
      bestD = d;
      hurtBest = h;
    }
  }
  if (best && hurtBest) return best;
  if (hurt(scene, a)) return a;
  return best;
}

/**
 * A healing touch: the one touched made whole (up from where they lay, their strength back, and, written back in
 * sim/hand/possess.ts, the wounds they bore healed) and gladdened; seen by those about (by none but the healed, where
 * he is unseen).
 */
function heal(scene: LocalScene, l: LocalWorld, a: LocalBody, s: number): void {
  if (!gifted(l.gifts, "healing")) return told(l, "no-heal", s);
  const b = healTarget(scene, l, a);
  if (!b) return told(l, "no-heal", s);
  const was =
    b.doing === "down" || b.doing === "thrown" ? "down" : hurt(scene, b) ? "hurt" : "whole";
  b.strength = Math.max(b.strength, wholeStrength(b.nature, scene.frame));
  b.marks |= HAND_MARK.healed;
  if (b !== a) {
    if (b.doing === "down" || b.doing === "thrown") {
      b.doing = "watch";
      b.until = s + HAND_TAKES.watch;
    }
    b.foe = a.id;
    b.mood = Math.min(1, b.mood + 0.3);
    b.say = SAY.glad;
    b.sayUntil = s + HAND_TAKES.say;
    a.yaw = facing(a, b);
  }
  l.deeds.push({
    kind: "healed",
    step: s,
    agent: b.id,
    was,
    seen: unseen(l) ? (b === a ? 0 : 1) : witnesses(l, b.x, b.z, SEEN_M),
  });
  told(l, "healed", s, b.id);
}

/**
 * The god's hand called down at a place of the small world (within SMITE_MOST.far of the one held): a bolt strikes down
 * those it falls among, throws down those near it, scatters the rest; fire burns those it falls among and the rest run;
 * the ground shaken throws down all within its reach; rain parts the fighting under it. Never on the one it is called
 * through. Seen far, by all who stand within its sight, whether he is seen or not.
 */
export function smiteAt(
  scene: LocalScene,
  l: LocalWorld,
  kind: number,
  x: number,
  z: number,
  draw: LocalDraw,
  s: number,
): void {
  const a = l.bodies[0]!,
    what = SMITES[kind];
  if (!what || dist(a, { x, z }) > SMITE_MOST.far) return;
  const seenBy = witnesses(l, x, z, SMITE_REACH[what].seen);
  let struck = 0;
  for (let i = 1; i < l.bodies.length; i++) {
    const b = l.bodies[i]!;
    if (!standing(b)) continue;
    const d = dist(b, { x, z });
    if (what === "lightning") {
      if (d <= SMITE_REACH.lightning.strikes) {
        b.strength = 0;
        b.marks |= HAND_MARK.struck;
        strikeDown(scene, l, b, a.id, BOLT, draw, s, "lightning");
        struck++;
      } else if (d <= SMITE_REACH.lightning.throws) {
        b.strength -= 0.15 * toughness(b);
        throwDown(b, s);
      } else if (d <= SMITE_REACH.lightning.scatters) fleeFrom(b, a, s);
    } else if (what === "fire") {
      if (d <= SMITE_REACH.fire.burns) {
        b.strength -= SMITE_REACH.fire.harm * (0.75 + 0.5 * draw(b.id, s, P.harm)) * toughness(b);
        b.marks |= HAND_MARK.struck;
        if (b.strength <= 0) {
          strikeDown(scene, l, b, a.id, FLAME, draw, s, "fire");
          struck++;
        } else fleeFrom(b, a, s);
      } else if (d <= SMITE_REACH.fire.scatters) fleeFrom(b, a, s);
    } else if (what === "quake") {
      if (d <= SMITE_REACH.quake.throws) throwDown(b, s);
    } else if (
      d <= SMITE_REACH.rain.parts &&
      (b.doing === "fight" || b.doing === "come" || b.doing === "flee")
    ) {
      b.doing = "watch";
      b.until = s + HAND_TAKES.watch;
      b.mood = Math.min(1, b.mood + 0.02);
    }
  }
  l.deeds.push({ kind: "smote", step: s, smite: what, x, z, struck, seen: seenBy });
  told(l, "smote", s, -1, kind);
}

/** Those near called to follow him by the god's Command (each second): the grown about him going their way, at most 8. */
export const COMMAND = { reach: 12, most: 8, chase: 20 } as const;
function command(l: LocalWorld): void {
  const a = l.bodies[0]!;
  let n = 0;
  for (const b of l.bodies) if (b.doing === "follow") n++;
  for (const b of l.bodies) {
    if (n >= COMMAND.most) return;
    if (b === a || !standing(b) || !grown(b) || b.marks & HAND_MARK.struck) continue;
    if (b.doing !== "way" && b.doing !== "watch" && b.doing !== "listen") continue;
    if (dist(a, b) > COMMAND.reach) continue;
    b.doing = "follow";
    b.foe = a.id;
    b.marks |= HAND_MARK.follows;
    b.say = SAY.glad;
    b.sayUntil = l.step + HAND_TAKES.say;
    n++;
  }
}

/** One following him: after whoever fights him, else whom he last struck at; else close behind him. */
function follow(l: LocalWorld, b: LocalBody, s: number): void {
  const a = l.bodies[0]!;
  if (!gifted(l.gifts, "command") || !standing(a)) {
    b.doing = "way";
    b.foe = -1;
    return;
  }
  const foe =
    l.bodies.find(
      (c) =>
        c !== b &&
        c !== a &&
        standing(c) &&
        c.doing === "fight" &&
        c.foe === a.id &&
        !(c.marks & HAND_MARK.follows),
    ) ??
    (l.aim !== undefined
      ? l.bodies.find((c) => c.id === l.aim && c !== b && standing(c) && c.doing !== "follow")
      : undefined);
  if (foe && dist(b, foe) <= COMMAND.chase) {
    b.doing = "fight";
    b.foe = foe.id;
    b.until = s + 4;
    b.say = SAY.cross;
    b.sayUntil = s + HAND_TAKES.say;
    return;
  }
  const k = (b.id % 5) - 2,
    back = 2 + (b.id % 3) * 0.8,
    fx = dmath.sin(a.yaw),
    fz = dmath.cos(a.yaw),
    tx = a.x - fx * back + fz * k * 0.9,
    tz = a.z - fz * back - fx * k * 0.9,
    d = dmath.sqrt((tx - b.x) * (tx - b.x) + (tz - b.z) * (tz - b.z));
  if (d < 0.3) {
    stand(b);
    b.yaw = turned(b.yaw, a.yaw, 0.3);
    return;
  }
  steer(
    b,
    tx,
    tz,
    d > 4 ? RUN_PACE : Math.max(b.pace * 1.4, dmath.sqrt(a.vx * a.vx + a.vz * a.vz)),
  );
}

// —— The possessed's acts ———————————————————————————————————————————————————————

function act(
  scene: LocalScene,
  l: LocalWorld,
  a: LocalBody,
  code: number,
  draw: LocalDraw,
  s: number,
): void {
  // (Up in the air nothing is done by hand: come down first.)
  if (aloft(l)) return told(l, "aloft", s);
  switch (code) {
    case GIFT_ACT.heal:
      return heal(scene, l, a, s);
    case HAND_ACT.work: {
      const kind = TRADE_PLACE[scene.trade];
      if (!kind || !scene.form) return told(l, "no-trade", s);
      const at = workPlaceNear(scene, a, [kind], HAND_REACH.work);
      if (at < 0) return told(l, "no-place", s, -1, nearestWorkPlace(scene, a, kind).place);
      const p = scene.places[at]!;
      a.doing = "work";
      a.until = s + HAND_TAKES.work;
      a.vx = a.vz = 0;
      if (p.kind !== "row") a.yaw = p.yaw;
      l.work++;
      if (l.work < WORK_STAGES) return told(l, "worked", s, -1, l.work);
      // The thing made: in his hands, or by him where they are full (a row is done, not carried).
      l.work = 0;
      const k = l.made.length,
        held = HAND_FORMS[scene.form]?.carry !== "";
      l.made.push({ form: scene.form, step: s, x: a.x, z: a.z });
      if (held && !a.carry) a.carry = -(k + 1);
      else if (held) l.lying.push({ x: a.x, z: a.z, carry: -(k + 1) });
      l.deeds.push({ kind: "made", step: s, form: scene.form, made: k });
      return told(l, "made", s, -1, k);
    }
    case HAND_ACT.talk: {
      const b = bodyBefore(l, a, HAND_REACH.talk);
      if (!b) return told(l, "no-one", s);
      // A word from one who struck them, or in the middle of a brawl, is not taken kindly.
      const r = draw(b.id, s, P.mood),
        sore = b.marks & HAND_MARK.struck || b.doing === "fight" || b.doing === "flee",
        mood = sore
          ? -0.06
          : (0.08 + 0.1 * r + (b.nature & BODY_NATURE.kind ? 0.05 : 0)) *
            (b.marks & (HAND_MARK.saw | HAND_MARK.theft) ? 0.3 : 1);
      b.mood = Math.max(-1, Math.min(1, b.mood + mood));
      b.marks |= HAND_MARK.spoken;
      if (!sore && b.doing !== "come") {
        b.doing = "listen";
        b.foe = a.id;
        b.until = s + HAND_TAKES.listen;
        b.vx = b.vz = 0;
      }
      a.yaw = facing(a, b);
      a.say = SAY.talk;
      a.sayUntil = s + HAND_TAKES.say;
      b.say = mood > 0 ? SAY.glad : SAY.cross;
      b.sayUntil = s + HAND_TAKES.say;
      l.deeds.push({ kind: "spoke", step: s, agent: b.id, mood });
      return told(l, "spoke", s, b.id);
    }
    case HAND_ACT.strike: {
      const b = bodyBefore(l, a, HAND_REACH.strike);
      if (!b) return told(l, "no-one", s, -1, 1);
      const held = inHand(l, a.carry, scene.frame?.bare),
        strong = gifted(l.gifts, "strength"),
        hidden = unseen(l);
      a.doing = "strike";
      a.until = s + HAND_TAKES.strike;
      a.vx = a.vz = 0;
      a.yaw = facing(a, b);
      l.aim = b.id;
      if (draw(b.id, s, P.hit) >= (b.doing === "flee" ? 0.55 : 0.8)) {
        told(l, "missed", s, b.id);
        if (hidden) fleeFrom(b, a, s);
        else answer(b, a, draw, s);
      } else {
        // (The god's strength: a blow that lands fells at once.)
        b.strength = strong
          ? 0
          : b.strength - held.harm * (0.75 + 0.5 * draw(b.id, s, P.harm)) * toughness(b);
        b.marks |= HAND_MARK.struck;
        b.mood = Math.max(-1, b.mood - 0.2);
        if (b.strength <= 0) {
          strikeDown(scene, l, b, a.id, held, draw, s, strong ? "strength" : undefined);
          told(l, "felled", s, b.id);
        } else {
          told(l, "struck", s, b.id);
          // (Struck by one none sees: they do not know whom to answer, and run.)
          if (hidden) fleeFrom(b, a, s);
          else answer(b, a, draw, s);
        }
      }
      if (!hidden) seen(l, a, b, draw, s);
      return;
    }
    case HAND_ACT.wrestle: {
      const b = bodyBefore(l, a, HAND_REACH.wrestle);
      if (!b || b.doing === "wrestle") return told(l, "no-one", s, -1, 2);
      a.doing = b.doing = "wrestle";
      a.until = b.until = s + HAND_TAKES.wrestle;
      a.foe = b.id;
      b.foe = a.id;
      a.vx = a.vz = b.vx = b.vz = 0;
      a.yaw = facing(a, b);
      b.yaw = facing(b, a);
      b.marks |= HAND_MARK.struck;
      b.say = SAY.hold;
      b.sayUntil = s + HAND_TAKES.say;
      if (!unseen(l)) seen(l, a, b, draw, s);
      return told(l, "held", s, b.id);
    }
    case HAND_ACT.take: {
      if (a.carry) return told(l, "full", s);
      const at = workPlaceNear(
        scene,
        a,
        WORK_PLACES.filter((k) => STORE_GOOD[k] !== undefined),
        HAND_REACH.take,
      );
      if (at < 0) return told(l, "nothing", s);
      const p = scene.places[at]!,
        good = STORE_GOOD[p.kind]!;
      a.carry = good + 1;
      l.deeds.push({
        kind: "took",
        step: s,
        good,
        from: p.kind,
        seen: unseen(l) ? 0 : theftSeen(l, a, draw, s),
      });
      return told(l, "took", s, -1, good);
    }
    case HAND_ACT.pick: {
      if (a.carry) return told(l, "full", s);
      let k = -1,
        best = HAND_REACH.pick;
      l.lying.forEach((x, i) => {
        const d = dist(a, x);
        if (d <= best) {
          k = i;
          best = d;
        }
      });
      if (k < 0) return told(l, "nothing", s, -1, 1);
      a.carry = l.lying[k]!.carry;
      l.lying.splice(k, 1);
      return told(l, "picked", s, -1, a.carry);
    }
    case HAND_ACT.drop: {
      if (!a.carry) return told(l, "empty", s);
      const good = carriedGood(l, a.carry),
        at = workPlaceNear(
          scene,
          a,
          WORK_PLACES.filter((k) => STORE_GOOD[k] === good),
          HAND_REACH.take,
        ),
        carry = a.carry;
      a.carry = 0;
      if (at >= 0) {
        l.deeds.push({ kind: "gave", step: s, carry, to: scene.places[at]!.kind });
        return told(l, "gave", s, -1, carry);
      }
      l.lying.push({ x: a.x + 0.5 * dmath.sin(a.yaw), z: a.z + 0.5 * dmath.cos(a.yaw), carry });
      return told(l, "set", s, -1, carry);
    }
  }
}

/** A hold's end: the stronger throws the other (the young are thrown the easier). */
function holdEnds(
  scene: LocalScene,
  l: LocalWorld,
  a: LocalBody,
  draw: LocalDraw,
  s: number,
): void {
  const b = l.bodies.find((x) => x.id === a.foe);
  a.doing = "hand";
  a.foe = -1;
  if (!b || b.doing !== "wrestle") return;
  const p = gifted(l.gifts, "strength")
    ? 1
    : 0.5 +
      0.45 * (a.strength - b.strength) +
      (b.nature & BODY_NATURE.child ? 0.3 : 0) -
      (b.nature & BODY_NATURE.brave ? 0.05 : 0);
  const [won, lost] = draw(b.id, s, P.throw) < p ? [a, b] : [b, a];
  lost.doing = "thrown";
  lost.until = s + HAND_TAKES.thrown;
  lost.marks |= HAND_MARK.thrown;
  // (Thrown, the unbreakable takes no hurt of it.)
  if (!(lost === a && gifted(l.gifts, "unbreakable")))
    lost.strength -= lost === a ? 0.1 : 0.15 * toughness(lost);
  won.doing = won === a ? "hand" : "fight";
  won.foe = won === a ? -1 : a.id;
  won.until = s + HAND_TAKES.fight;
  if (lost.strength <= 0)
    strikeDown(
      scene,
      l,
      lost,
      won.id,
      { ...(scene.frame?.bare ?? BARE_HANDS), form: null },
      draw,
      s,
    );
  if (!l.ended) told(l, lost === b ? "threw" : "thrown", s, b.id);
}

// —— The step ———————————————————————————————————————————————————————————————————

/** Where a body's way has it a little after step s: x, z, and standing there its yaw and task. */
function wayAt(
  b: LocalBody,
  s: number,
): { x: number; z: number; yaw: number; task: number } | null {
  const w = b.ways;
  if (w.length < 5) return null;
  if (s <= w[0]!) return { x: w[1]!, z: w[2]!, yaw: w[3]!, task: w[4]! };
  for (let i = 0; i + 5 < w.length; i += 5) {
    const s0 = w[i]!,
      s1 = w[i + 5]!;
    if (s < s1) {
      const k = (s - s0) / Math.max(1, s1 - s0);
      return {
        x: w[i + 1]! + (w[i + 6]! - w[i + 1]!) * k,
        z: w[i + 2]! + (w[i + 7]! - w[i + 2]!) * k,
        yaw: w[i + 3]!,
        task: w[i + 4]!,
      };
    }
  }
  const e = w.length - 5;
  return { x: w[e + 1]!, z: w[e + 2]!, yaw: w[e + 3]!, task: w[e + 4]! };
}

/** Steer a body toward a point at most `most` metres a second (eased: quick to start and stop). */
function steer(b: LocalBody, tx: number, tz: number, most: number): void {
  const dx = tx - b.x,
    dz = tz - b.z,
    d = dmath.sqrt(dx * dx + dz * dz),
    speed = Math.min(most, d / 0.4),
    wx = d > 1e-6 ? (dx / d) * speed : 0,
    wz = d > 1e-6 ? (dz / d) * speed : 0;
  b.vx += (wx - b.vx) * 0.6;
  b.vz += (wz - b.vz) * 0.6;
}
function stand(b: LocalBody): void {
  b.vx *= 0.3;
  b.vz *= 0.3;
  if (Math.abs(b.vx) < 1e-3) b.vx = 0;
  if (Math.abs(b.vz) < 1e-3) b.vz = 0;
}

/** One of the others, a step on: as its doing has it. */
function moveOther(
  scene: LocalScene,
  l: LocalWorld,
  b: LocalBody,
  draw: LocalDraw,
  s: number,
): void {
  const a = l.bodies[0]!;
  // (One none sees is lost track of: those after him go their way.)
  if (b.foe === a.id && (b.doing === "fight" || b.doing === "come") && unseen(l)) {
    b.doing = "way";
    b.foe = -1;
  }
  const foe = b.foe >= 0 ? l.bodies.find((x) => x.id === b.foe) : undefined;
  switch (b.doing) {
    case "follow":
      return follow(l, b, s);
    case "dead":
    case "down":
      b.vx = b.vz = 0;
      return;
    case "thrown":
    case "wrestle":
      stand(b);
      if (s < b.until) return;
      if (b.doing === "thrown" && foe) answer(b, foe, draw, s);
      else b.doing = "way";
      return;
    case "listen":
    case "watch":
      stand(b);
      if (foe) b.yaw = turned(b.yaw, facing(b, foe), 0.4);
      if (s >= b.until) b.doing = "way";
      return;
    case "flee": {
      const from = foe ?? a,
        d = dist(b, from) || 1;
      steer(b, b.x + ((b.x - from.x) / d) * 6, b.z + ((b.z - from.z) / d) * 6, RUN_PACE * 0.95);
      if (s >= b.until) b.doing = "way";
      return;
    }
    case "come": {
      if (!standing(a) || s >= b.until) {
        b.doing = "watch";
        b.foe = a.id;
        b.until = s + HAND_TAKES.watch;
        return;
      }
      if (dist(b, a) > 1.8) return steer(b, a.x, a.z, RUN_PACE * 0.85);
      // Come — and once it has gone on a moment, the brawl parted: those fighting him stand off
      // and look on.
      stand(b);
      b.yaw = turned(b.yaw, facing(b, a), 0.4);
      if (s < b.until - HAND_TAKES.come + PARTS) return;
      b.marks |= HAND_MARK.came;
      b.doing = "watch";
      b.until = s + HAND_TAKES.watch;
      b.say = SAY.stop;
      b.sayUntil = s + HAND_TAKES.say;
      let parted = false;
      for (const c of l.bodies)
        if (c.doing === "fight" && c.foe === a.id) {
          c.doing = "watch";
          c.until = s + HAND_TAKES.watch;
          parted = true;
        }
      if (parted) {
        l.deeds.push({ kind: "parted", step: s, by: b.id });
        told(l, "parted", s, b.id);
      }
      return;
    }
    case "fight": {
      if (!foe || !standing(foe) || dist(b, foe) > 15) {
        // (One who follows him goes back to it.)
        b.doing = b.marks & HAND_MARK.follows && gifted(l.gifts, "command") ? "follow" : "watch";
        b.until = s + HAND_TAKES.watch;
        return;
      }
      if (dist(b, foe) > HAND_REACH.strike * 0.8) return steer(b, foe.x, foe.z, RUN_PACE * 0.9);
      stand(b);
      b.yaw = turned(b.yaw, facing(b, foe), 0.5);
      // (Up out of reach on the god's wings: they can only look up at him.)
      if (foe === a && aloft(l)) return;
      if (s < b.until) return;
      // A blow back: bare-handed, or with what they hold.
      b.until = s + HAND_TAKES.fight;
      if (draw(b.id, s, P.hit) >= 0.65) return;
      const held = inHand(l, b.carry, scene.frame?.bare);
      // (The unbreakable: the blow lands, and is heard, and does no harm.)
      if (foe === a && gifted(l.gifts, "unbreakable")) {
        foe.marks |= HAND_MARK.struck;
        l.deeds.push({
          kind: "warded",
          step: s,
          by: b.id,
          seen: unseen(l) ? 0 : witnesses(l, a.x, a.z, SEEN_M),
        });
        told(l, "warded", s, b.id);
        return;
      }
      foe.strength -=
        (held.harm * 0.55 + 0.05 * draw(b.id, s, P.harm)) *
        (b.nature & BODY_NATURE.brave ? 1.15 : 1) *
        toughness(foe);
      foe.marks |= HAND_MARK.struck;
      if (foe.strength <= 0) strikeDown(scene, l, foe, b.id, held, draw, s);
      else if (foe !== a) answer(foe, b, draw, s);
      return;
    }
    default: {
      // Its day's way, as the view had it.
      const at = wayAt(b, s + 10);
      if (!at) return stand(b);
      const d = dmath.sqrt((at.x - b.x) * (at.x - b.x) + (at.z - b.z) * (at.z - b.z));
      if (d < 0.08) {
        stand(b);
        b.yaw = turned(b.yaw, at.yaw, 0.3);
        b.task = at.task;
        return;
      }
      b.task = -1;
      steer(b, at.x, at.z, d > 6 ? RUN_PACE : b.pace * 1.4);
    }
  }
}

/** The possessed, a step on: moved by the bid, or at what he does. */
function moveHand(
  scene: LocalScene,
  l: LocalWorld,
  a: LocalBody,
  bid: HandBid,
  draw: LocalDraw,
  s: number,
): void {
  if (a.doing === "down" || a.doing === "dead") return;
  if (a.doing !== "hand" && s >= a.until) {
    if (a.doing === "wrestle") holdEnds(scene, l, a, draw, s);
    else a.doing = "hand";
  }
  const mx = bid.mx / 31,
    mz = bid.mz / 31,
    m = dmath.sqrt(mx * mx + mz * mz),
    free = a.doing === "hand",
    // (His own gait, from his body: a sprint's breath spent and got back, a flier's height; rules/gifts.ts.)
    gait = scene.top !== undefined ? gaitOf(scene, l, a, bid, free && m > 0.05) : null;
  if (!free) return stand(a);
  if (bid.act) act(scene, l, a, bid.act, draw, s);
  if (a.doing !== "hand") return stand(a);
  // (Which way, as far as the stick is pushed: at a walk, or at a run.)
  const pace =
      (gait ??
        (bid.run ? RUN_PACE * (scene.frame?.run ?? 1) : a.pace * HAND_STRIDE) * Math.min(1, m)) *
      (gait !== null && gifted(l.gifts, "slow") ? SLOW : 1),
    wx = m > 1e-6 ? (mx / m) * pace : 0,
    wz = m > 1e-6 ? (mz / m) * pace : 0;
  a.vx += (wx - a.vx) * 0.6;
  a.vz += (wz - a.vz) * 0.6;
  if (Math.abs(a.vx) < 1e-3 && !wx) a.vx = 0;
  if (Math.abs(a.vz) < 1e-3 && !wz) a.vz = 0;
}

/**
 * The possessed's gait a step on (rules/gifts.ts gaitStep): his pace now (m/s, as far as the stick is pushed), his breath
 * and height kept (none kept while he is fresh and on the ground). His rising over the town told, and by how many seen.
 */
function gaitOf(
  scene: LocalScene,
  l: LocalWorld,
  a: LocalBody,
  bid: HandBid,
  moving: boolean,
): number {
  const was = l.gait ?? FRESH_GAIT,
    held = a.carry ? inHand(l, a.carry) : null,
    m = Math.min(1, dmath.sqrt(bid.mx * bid.mx + bid.mz * bid.mz) / 31),
    r = gaitStep(was, {
      dt: DT,
      walk: a.pace * HAND_STRIDE,
      top: scene.top!,
      health: a.strength / wholeStrength(a.nature, scene.frame),
      load: held && !gifted(l.gifts, "strength") ? (LOAD[held.carry] ?? 1) : 1,
      sprint: bid.run,
      moving,
      age: scene.age ?? 1,
      swift: gifted(l.gifts, "swift"),
      wings: gifted(l.gifts, "wings"),
      rise: !!bid.rise,
    });
  if (was.y <= FLIGHT.clear && r.gait.y > FLIGHT.clear)
    l.deeds.push({
      kind: "flew",
      step: l.step,
      seen: unseen(l) ? 0 : witnesses(l, a.x, a.z, SEEN_M * 2),
    });
  if (r.gait.wind >= 1 && r.gait.y <= 0) delete l.gait;
  else l.gait = r.gait;
  return r.pace * m;
}

/** Keep the bodies off each other: those standing pushed apart, the possessed the least; the fallen not at all. */
function apart(l: LocalWorld): void {
  // (Up over their heads, he is in no one's way.)
  const flying = aloft(l);
  const cells = new Map<number, number[]>(),
    bodies = l.bodies;
  bodies.forEach((b, i) => {
    const k = cellKey(Math.floor(b.x), Math.floor(b.z)),
      list = cells.get(k);
    if (list) list.push(i);
    else cells.set(k, [i]);
  });
  const near = 2 * FLESH_R;
  bodies.forEach((b, i) => {
    const ix = Math.floor(b.x),
      iz = Math.floor(b.z);
    for (let x = ix - 1; x <= ix + 1; x++)
      for (let z = iz - 1; z <= iz + 1; z++) {
        const list = cells.get(cellKey(x, z));
        if (!list) continue;
        for (const j of list) {
          if (j <= i) continue;
          if (flying && i === 0) continue;
          const c = bodies[j]!,
            dx = c.x - b.x,
            dz = c.z - b.z,
            d2 = dx * dx + dz * dz;
          if (d2 >= near * near) continue;
          const d = dmath.sqrt(d2),
            ux = d > 1e-6 ? dx / d : 1,
            uz = d > 1e-6 ? dz / d : 0,
            over = near - d,
            fixedB = !standing(b),
            fixedC = !standing(c);
          if (fixedB && fixedC) continue;
          // (The possessed gives a third of the way; one fallen gives none.)
          const kb = fixedB ? 0 : fixedC ? 1 : i === 0 ? 0.3 : 0.5,
            kc = fixedC ? 0 : 1 - kb;
          b.x -= ux * over * kb;
          b.z -= uz * over * kb;
          c.x += ux * over * kc;
          c.z += uz * over * kc;
        }
      }
  });
}

/**
 * The small world a step on: those joining it at this step come in (a body already in it takes
 * its new way ahead); the possessed moves as he is bid and does what he is bid; the others as
 * their doing has it; all kept off each other and out of the town's solids, and the possessed
 * within his bounds. Once a second, those undisturbed and far from him go back to the views.
 */
export function stepLocal(
  scene: LocalScene,
  l: LocalWorld,
  bid: HandBid,
  draw: LocalDraw,
  joins: readonly LocalBody[] = [],
  smites: readonly { readonly kind: number; readonly x: number; readonly z: number }[] = [],
): void {
  if (l.ended) return;
  const s = l.step;
  for (const j of joins) {
    const had = l.bodies.find((b) => b.id === j.id);
    if (had) had.ways = [...j.ways];
    else if (l.bodies.length < POSSESS_MOST.bodies) l.bodies.push({ ...j, ways: [...j.ways] });
  }
  const a = l.bodies[0]!;
  // (The god's strokes called down at this step, and those near called to follow: rules/gifts.ts.)
  if (gifted(l.gifts, "smite"))
    for (const k of smites) smiteAt(scene, l, k.kind, k.x, k.z, draw, s);
  if (s % POSSESS_HZ === 0 && gifted(l.gifts, "command")) command(l);
  moveHand(scene, l, a, bid, draw, s);
  for (let i = 1; i < l.bodies.length; i++) moveOther(scene, l, l.bodies[i]!, draw, s);
  for (const b of l.bodies) {
    if (b.say && s >= b.sayUntil) b.say = 0;
    if (!b.vx && !b.vz) continue;
    b.x += b.vx * DT;
    b.z += b.vz * DT;
    // (Facing the way they go, once they go at more than a shuffle.)
    if (Math.abs(b.vx) + Math.abs(b.vz) > 0.3) b.yaw = turned(b.yaw, dmath.atan2(b.vx, b.vz), 0.5);
  }
  apart(l);
  // (A flier over the roofs is not held by the town's walls: come down among them, he is set out of them.)
  const over = (l.gait?.y ?? 0) > (scene.roofs ?? FLIGHT.over);
  for (const b of l.bodies) if (standing(b) && !(over && b === a)) keepOut(scene, b);
  // (Within his bounds: about the town drawn.)
  const ox = a.x - scene.x,
    oz = a.z - scene.z,
    far = dmath.sqrt(ox * ox + oz * oz);
  if (far > POSSESS_BOUNDS) {
    a.x = scene.x + (ox / far) * POSSESS_BOUNDS;
    a.z = scene.z + (oz / far) * POSSESS_BOUNDS;
  }
  if (s % POSSESS_HZ === 0)
    l.bodies = l.bodies.filter(
      (b, i) =>
        i === 0 ||
        b.doing !== "way" ||
        b.marks !== 0 ||
        b.mood !== 0 ||
        b.carry !== 0 ||
        dist(a, b) <= LEAVE_M,
    );
  l.step = s + 1;
}

// —— What can be done now ———————————————————————————————————————————————————————

/** Why an act cannot be done now ("": it can). */
export const HAND_WHY = [
  "",
  "no-trade",
  "no-place",
  "busy",
  "no-one",
  "full",
  "nothing",
  "empty",
  "down",
  // (Up in the air on the god's wings, out of reach of anything by hand: rules/gifts.ts.)
  "aloft",
] as const;
export type HandWhy = (typeof HAND_WHY)[number];

/** An act the possessed may do now, or not and why; whom it falls on and at what place (-1: none). */
export type HandOffer = {
  readonly act: number;
  readonly why: HandWhy;
  readonly target: number;
  readonly place: number;
};

/**
 * The acts before the possessed now, four, each always in its own place under the thumb: the one
 * that fits (his work at its place; what he carries given to its store; a store's goods taken; a
 * thing lying picked up; what he carries set down — else his work, and why it cannot be done
 * here); a word; a blow; a hold.
 */
export function handOffers(scene: LocalScene, l: LocalWorld): HandOffer[] {
  const a = l.bodies[0]!,
    healing = gifted(l.gifts, "healing"),
    acts: number[] = [HAND_ACT.work, HAND_ACT.talk, HAND_ACT.strike, HAND_ACT.wrestle];
  // (With the god's healing, a fifth: a touch that heals: rules/gifts.ts.)
  if (healing) acts.push(GIFT_ACT.heal);
  if (l.ended || aloft(l))
    return acts.map((act) => ({
      act,
      why: l.ended ? "down" : "aloft",
      target: -1,
      place: -1,
    }));
  const busy = a.doing !== "hand",
    no = (o: HandOffer): HandOffer => (busy && !o.why ? { ...o, why: "busy" } : o),
    trade = TRADE_PLACE[scene.trade],
    works = !!trade && !!scene.form,
    work = works ? workPlaceNear(scene, a, [trade!], HAND_REACH.work) : -1,
    good = a.carry ? carriedGood(l, a.carry) : -1,
    giveAt =
      a.carry && good >= 0
        ? workPlaceNear(
            scene,
            a,
            WORK_PLACES.filter((k) => STORE_GOOD[k] === good),
            HAND_REACH.take,
          )
        : -1,
    store = a.carry
      ? -1
      : workPlaceNear(
          scene,
          a,
          WORK_PLACES.filter((k) => STORE_GOOD[k] !== undefined),
          HAND_REACH.take,
        ),
    lying = !a.carry && l.lying.some((x) => dist(a, x) <= HAND_REACH.pick),
    talk = bodyBefore(l, a, HAND_REACH.talk),
    strike = bodyBefore(l, a, HAND_REACH.strike),
    hold = bodyBefore(l, a, HAND_REACH.wrestle);
  const fits: HandOffer =
    work >= 0
      ? { act: HAND_ACT.work, why: "", target: -1, place: work }
      : giveAt >= 0
        ? { act: HAND_ACT.drop, why: "", target: -1, place: giveAt }
        : store >= 0
          ? { act: HAND_ACT.take, why: "", target: -1, place: store }
          : lying
            ? { act: HAND_ACT.pick, why: "", target: -1, place: -1 }
            : a.carry
              ? { act: HAND_ACT.drop, why: "", target: -1, place: -1 }
              : {
                  act: HAND_ACT.work,
                  why: works ? "no-place" : "no-trade",
                  target: -1,
                  place: trade ? nearestWorkPlace(scene, a, trade).place : -1,
                };
  const out = [
    no(fits),
    no({ act: HAND_ACT.talk, why: talk ? "" : "no-one", target: talk?.id ?? -1, place: -1 }),
    no({ act: HAND_ACT.strike, why: strike ? "" : "no-one", target: strike?.id ?? -1, place: -1 }),
    no({ act: HAND_ACT.wrestle, why: hold ? "" : "no-one", target: hold?.id ?? -1, place: -1 }),
  ];
  if (healing) {
    const h = healTarget(scene, l, a);
    out.push(no({ act: GIFT_ACT.heal, why: h ? "" : "no-one", target: h?.id ?? -1, place: -1 }));
  }
  return out;
}

/** How a body's mood fades: half of what the hand moved gone in this many seconds. */
export const MOOD_HALF = 2 * 86_400;
/** A mood moved by the hand at `at` (seconds), as it stands at t. */
export function moodAt(mood: number, at: number, t: number): number {
  return t <= at ? mood : mood * dmath.pow(0.5, (t - at) / MOOD_HALF);
}

/**
 * The wound a blow by hand left where it landed (`r2`, `r3` its own draws, 0 … 1), by the body's
 * own rules (rules/anatomy.ts): the place struck as this body has it (a hand's on its arm where it
 * has none, else on its body); maimed, the member lost where the body may lose it, else a limb left
 * lame; else what came of it as any wound that took nothing — and how it shows.
 */
export function woundAt(
  a: Anatomy,
  place: BodyPlace,
  maimed: boolean,
  blow: Blow,
  cuts: boolean,
  care: number,
  r2: number,
  r3: number,
): BodyWound {
  const has = new Set<Member>(a.members),
    arm: Member | null = place === "hand-l" ? "arm-l" : place === "hand-r" ? "arm-r" : null,
    member: Member = has.has(place) ? place : arm && has.has(arm) ? arm : "trunk";
  if (maimed && a.losable.includes(member))
    return {
      member,
      outcome: "lost",
      how: lostHow(member, cuts, r3),
      lasting: lastingOf(a, member, "lost"),
    };
  const limb = member !== "head" && member !== "trunk",
    outcome = maimed && limb ? "lame" : outcomeOf(member, blow, care, r2);
  return { member, outcome, how: null, lasting: lastingOf(a, member, outcome) };
}
