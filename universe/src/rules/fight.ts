// A soldier possessed on the field (Phase 61; asked for 2026-10-27: "add in functionality to possess
// anything like worldbox/worldfall mod ... make sure it works right in mobile"): from the moment the
// hand takes him, the battle about him is fought man by man in a small world of its own, at the
// possession's step — each figure of the field there a body that comes on, holds its line, strikes
// with its host's arm, looses what its host looses, and flees or chases as the day goes; his by the
// bids: about the field at a walk or a run, a blow with the arm he bears, a parry, the men near him
// rallied, flight. Blows land by the blows track's rule (rules/blows.ts: where on the body by the
// nines, and what they do there by what struck against the guard); each side's heart fails as its
// men fall, lifted where he rallies them, until one breaks. The battle's outcome is the fight's: the
// side that breaks is beaten, the defenders holding where neither has by the time the plan has its
// victors cheering. Metres on the field (view/battle.ts's: x from the attackers' side to the
// defenders', z across). Pure: the scene, the bids and the world's keyed draws step it the same on
// every machine (no clock is read; every turn is dmath's). The sim keeps it and writes what it
// decided into the war (sim/hand/fight.ts); the host steps it ahead for the page (host/possess.ts).
import { dmath } from "../kernel/index.ts";
import { NINES } from "./anatomy.ts";
import { BLOW_PLACES, SEVER, blowPlaceOf, killShare, type Striker } from "./blows.ts";
import { HAND_ACT, POSSESS_HZ, type HandBid, type LocalDraw } from "./possess.ts";
import { TURN, type Blow } from "./wounds.ts";

const DT = 1 / POSSESS_HZ;

/** What a soldier is bid to do beyond a blow (HAND_ACT.strike: his arm's, or what he looses): parry, rally the men near, fly. */
export const FIGHT_ACT = { parry: 8, rally: 9, fly: 10 } as const;

/** What a soldier looses from afar: nothing, arrows, darts, or shot. */
export const LOOSES = ["none", "arrows", "darts", "shot"] as const;
export type Looses = (typeof LOOSES)[number];

/** Paces on the field (metres a second): coming on, at the charge, in flight; riders so much the faster. */
export const FIGHT_PACE = { walk: 1.5, run: 4.6, flee: 5.2, mounted: 1.6 } as const;
/** How far a blow reaches by what it is (metres): a spear's point the farthest, a bite the nearest. */
export const FIGHT_REACH: Readonly<Record<Blow, number>> = {
  point: 2.1,
  edge: 1.5,
  blunt: 1.4,
  shot: 1.6,
  crush: 1.2,
  fire: 1.4,
};
/** How far each missile carries (metres; from afar no nearer than two reaches). */
export const FIGHT_RANGE: Readonly<Record<Looses, number>> = {
  none: 0,
  arrows: 60,
  darts: 22,
  shot: 70,
};
/**
 * The share of blows that land, before might and strength: a body's in the press, a parried one's,
 * the possessed's (the god's hand guides it) and a parried one of his, a missile's at its nearest;
 * on one running, so much more.
 */
export const FIGHT_HIT = {
  blow: 0.06,
  parried: 0.015,
  hand: 0.3,
  handParried: 0.08,
  missile: 0.05,
  back: 1.6,
} as const;
/** How much a wound that does not kill takes out of one (1: down), by where it lands. */
export const FIGHT_HURT = { head: 0.7, trunk: 0.6, arm: 0.35, hand: 0.3, leg: 0.55 } as const;
/**
 * The god's hand on the body it holds, while it holds it: a blow landing on him kills so much less
 * often, and a wound takes so much less out of him (let go, he is as any other).
 */
export const FIGHT_WARD = { kill: 0.5, hurt: 0.6 } as const;
/**
 * Each side's heart: what its fallen take from it (the share of its men down, times this), what
 * those fallen before the hand took his took, what a rally gives (and the most), what one who flies
 * takes, and where it breaks (at might 1; the mightier break the later, by the root of their might).
 */
export const FIGHT_HEART = {
  loss: 2,
  before: 1,
  rally: 0.06,
  lift: 0.3,
  fly: 0.03,
  break: 0.4,
} as const;
/** How long things take (steps): between blows, a parry held, between rallies, a chase after the break, looking about for a foe. */
export const FIGHT_TAKES = { strike: 20, hand: 12, parry: 12, rally: 120, chase: 160, look: 10 };
/**
 * How near (metres) the men must be to be rallied, a foe to be parried, a foe for a defender to
 * step out to; the line held about the meet; bodies kept apart; one of its own close before it,
 * a body keeps its rank behind them.
 */
export const FIGHT_NEAR = { rally: 12, parry: 4, meet: 8, hold: 4, apart: 0.8, rank: 2 } as const;
/** The battle second from which the attackers, unbroken and not breaking the defenders, draw off (view/battle.ts MOMENTS.after). */
export const FIGHT_DRAW_OFF = 130;
/** How far past the field's ends one who flees is gone from it, or past its flanks (metres; view/battle.ts FIELD is 70 by 45). */
export const FIGHT_GONE = 84;
export const FIGHT_FLANK = 59;
/** The battle second of the charge: the attackers stop to loose before it, not after (view/battle.ts MOMENTS.charge). */
export const FIGHT_CHARGE = 40;
/** The last battle second a soldier may be taken at: the rout (view/battle.ts MOMENTS.rout); the day is decided after it. */
export const FIGHT_LAST = 108;
/** The most bodies a soldier's fight holds: he and the nearest of the field about him. */
export const FIGHT_MOST = 240;
/** How the day leans the way history had it: its victors' might against the beaten's (1 / this). */
export const FIGHT_TILT = 1.2;
/**
 * How many times at most the day is leant at a taking (FIGHT_TILT, then its square, its cube, …) until
 * the fight left alone goes history's way (fightLeaning).
 */
export const FIGHT_LEANS = 4;
/**
 * When the battle at a turn is fought (view/battleday.ts BATTLE_DAY's): from eight in the morning of
 * the turn's first day (world seconds), a minute of the world's to a battle second, its seconds.
 */
export const FIGHT_DAY = { from: 8 * 3600, second: 60, length: 150 } as const;
/** The seconds between a side's missiles by what it looses. */
export const FIGHT_RELOAD: Readonly<Record<Looses, number>> = {
  none: 0,
  arrows: 4,
  darts: 6,
  shot: 12,
};
/** The numbers a body is sent as: its figure, its side, where it stands (x, z, yaw), its own draw (0 … 1). */
export const FIGHT_PACKED = 6;
/** The most steps a fight is fought out in once the hand lets go (the battle's length at the possession's step). */
export const FIGHT_OUT_MOST = FIGHT_DAY.length * POSSESS_HZ;

/** One side of the battle as the fight knows it. */
export type FightSide = {
  /** What it strikes with hand to hand, and whether that cuts off a limb (an axe's, a sword's). */
  readonly blow: Blow;
  readonly cuts: boolean;
  /** What it looses from afar, and the seconds between its missiles. */
  readonly looses: Looses;
  readonly reload: number;
  /** Its guard (0 … 1: how much of a blow its protection turns, by rules/wounds.ts TURN) and its shock (0 … 1.4). */
  readonly guard: number;
  readonly shock: number;
  /** Its might against the other's (0.25 … 4): its arms' power, and the defenders' ground. */
  readonly might: number;
  readonly mounted: boolean;
  /** Its figures on the field, and those of them fallen before the hand took his. */
  readonly figures: number;
  readonly before: number;
};

/** The field the hand took a soldier on. */
export type FightScene = {
  readonly sides: readonly [FightSide, FightSide];
  /** The battle's second he was taken at, and its last. */
  readonly from: number;
  readonly length: number;
  /** Where the lines meet (x): the defenders hold about it. */
  readonly meet: number;
  /** Whether the defenders flee off its flanks (a battle fought before their town, which stands behind them). */
  readonly flanks: boolean;
  /** Its people's paces against an upright ape's (rules/possess.ts personFrame's run; absent: 1). */
  readonly pace?: number;
};

/**
 * What a body is doing: standing; coming on; at the line (striking as it may); a parry held;
 * loosing; rallying the men near; fleeing; after the beaten; down (wounded out of it), dead, gone
 * from the field.
 */
export const FIGHT_DOINGS = [
  "stand",
  "come",
  "fight",
  "parry",
  "loose",
  "rally",
  "flee",
  "chase",
  "down",
  "dead",
  "gone",
] as const;
export type FightDoing = (typeof FIGHT_DOINGS)[number];

export type FightBody = {
  /** Its figure on the field (view/battle.ts Trooper.id), and its side. */
  readonly id: number;
  readonly side: 0 | 1;
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  doing: FightDoing;
  /** The step its doing holds to (a parry, a rally). */
  until: number;
  /** The body it goes for (an index; -1: none). */
  foe: number;
  /** How hurt (1: down), and the place struck last (BLOW_PLACES' index; -1: none), cut off (-1: none). */
  hurt: number;
  struck: number;
  lost: number;
  /** The step its next blow may fall, and its next missile be loosed (-1: it looses none). */
  ready: number;
  loaded: number;
  /** As strong as it is (0.85 … 1.15). */
  readonly strength: number;
};

/** One struck down in the fight: when, by whom (figures), where, by what, dead or wounded out of it, a limb cut off. */
export type FightDeed = {
  readonly step: number;
  readonly by: number;
  readonly id: number;
  /** BLOW_PLACES' index, and what struck (FIGHT_STRIKERS' index). */
  readonly place: number;
  readonly striker: number;
  readonly dead: boolean;
  readonly lost: boolean;
};

/** What strikes in the fight, by index: a hand's blow, an arrow, a dart, a bullet. */
export const FIGHT_STRIKERS: readonly Striker[] = ["hand", "arrow", "dart", "bullet"];

/**
 * What the fight tells of the possessed's doings, by index (the host words them): his blow felled one,
 * wounded one out of it, missed, was parried (more 1: he parried one's); he loosed; rallied (more: how
 * many); fled; struck one who fights on; his side broke, the other's; he stood again; nothing came of
 * his act (more: 0 no foe, 1 none in reach or range, 2 too soon); he was hit (more: where).
 */
export const FIGHT_TOLD = [
  "",
  "felled",
  "wounded",
  "missed",
  "parried",
  "loosed",
  "rallied",
  "fled",
  "struck",
  "broke",
  "beaten",
  "stood",
  "nothing",
  "hit",
] as const;
export type FightTold = (typeof FIGHT_TOLD)[number];

export type FightWorld = {
  step: number;
  bodies: FightBody[];
  /** Each side's heart lifted by rallies and lowered by flight (at most FIGHT_HEART.lift either way). */
  lift: [number, number];
  /** The side that broke (-1: neither yet), and the step it broke at. */
  broke: -1 | 0 | 1;
  brokeAt: number;
  /** The step the possessed last rallied his men at. */
  rallied: number;
  deeds: FightDeed[];
  /** What was last told of the possessed: what (FIGHT_TOLD's index), the step, of whom (a figure; -1), and more. */
  told: [number, number, number, number];
  /** Why it ended for the possessed ("": it goes on): dead, wounded down, fled from the field, the battle over. */
  ended: "" | "dead" | "down" | "fled" | "over";
};

/** A body as the fight takes it: where the field had it, how strong. */
export function fightBody(
  id: number,
  side: 0 | 1,
  at: { x: number; z: number; yaw: number },
  strength: number,
  looses: boolean,
): FightBody {
  return {
    id,
    side,
    x: at.x,
    z: at.z,
    yaw: at.yaw,
    vx: 0,
    vz: 0,
    doing: "stand",
    until: 0,
    foe: -1,
    hurt: 0,
    struck: -1,
    lost: -1,
    ready: 0,
    loaded: looses ? 0 : -1,
    strength,
  };
}

/**
 * Each side's might (its blows land and its heart holds by its root): the day leaning toward history's
 * victor by `tilt` (FIGHT_TILT) each way, and the more by the root of how far it was outnumbered by
 * those still standing (it won by its ground, its walls or its arms, which the fight does not lay out).
 * So a fight left to itself goes history's way some nineteen times in twenty (tools/probe-fight.ts),
 * the day leant the more where it does not (fightLeaning), and the god's hand can turn it.
 */
export function fightMights(
  victor: 0 | 1,
  alive: readonly [number, number],
  tilt = FIGHT_TILT,
): [number, number] {
  const beaten = victor === 0 ? 1 : 0,
    ratio = tilt * tilt * Math.max(1, dmath.sqrt(alive[beaten] / Math.max(1, alive[victor]))),
    m = dmath.clamp(dmath.sqrt(ratio), 1, 4),
    out: [number, number] = [1, 1];
  out[victor] = m;
  out[beaten] = Math.max(0.25, 1 / m);
  return out;
}

/**
 * A side as the fight takes it, from its host's terms (sim/war/fell.ts HostTerms: the blow its arm
 * strikes, its guard, its shock), what the field drew it loosing and riding, its might (fightMights),
 * its figures and those fallen before the taking.
 */
export function fightSide(
  terms: { readonly blow: Blow; readonly protection: number; readonly shock: number },
  looses: Looses,
  mounted: boolean,
  might: number,
  figures: number,
  before: number,
): FightSide {
  return {
    blow: terms.blow,
    cuts: terms.blow === "edge",
    looses,
    reload: FIGHT_RELOAD[looses],
    guard: dmath.clamp(terms.protection, 0, 1),
    shock: dmath.clamp(terms.shock, 0, 1.4),
    might,
    mounted,
    figures,
    before,
  };
}

/** The bodies sent packed (FIGHT_PACKED numbers each), as the fight takes them. */
export function unpackFight(packed: readonly number[], scene: FightScene): FightBody[] {
  const out: FightBody[] = [];
  for (let i = 0; i + FIGHT_PACKED <= packed.length; i += FIGHT_PACKED) {
    const side: 0 | 1 = packed[i + 1] === 1 ? 1 : 0;
    out.push(
      fightBody(
        packed[i]!,
        side,
        { x: packed[i + 2]!, z: packed[i + 3]!, yaw: packed[i + 4]! },
        0.85 + 0.3 * dmath.clamp(packed[i + 5]!, 0, 1),
        scene.sides[side].looses !== "none",
      ),
    );
  }
  return out;
}

/** A fresh fight: the possessed first, then the bodies about him. */
export function fightWorld(bodies: FightBody[]): FightWorld {
  return {
    step: 0,
    bodies,
    lift: [0, 0],
    broke: -1,
    brokeAt: -1,
    rallied: -FIGHT_TAKES.rally,
    deeds: [],
    told: [0, 0, -1, 0],
    ended: "",
  };
}

/** A copy of a fight to step ahead without touching the kept one. */
export function copyFight(f: FightWorld): FightWorld {
  return {
    step: f.step,
    bodies: f.bodies.map((b) => ({ ...b })),
    lift: [f.lift[0], f.lift[1]],
    broke: f.broke,
    brokeAt: f.brokeAt,
    rallied: f.rallied,
    deeds: [...f.deeds],
    told: [...f.told],
    ended: f.ended,
  };
}

/** The battle's own second a fight stands at. */
export function fightSecond(scene: FightScene, f: FightWorld): number {
  return scene.from + f.step / POSSESS_HZ;
}

/** What each of the fight's draws is for (its `purpose`): a blow landing, where, killing, cutting off, a pace. */
export const FIGHT_DRAWS = { hit: 1, place: 2, kill: 3, cut: 4, pace: 5 } as const;
const P = FIGHT_DRAWS;
const fighting = (b: FightBody) => b.doing !== "down" && b.doing !== "dead" && b.doing !== "gone";
const fled = (b: FightBody) => b.doing === "flee" || b.doing === "gone";
const isLimbPlace = (k: number) => k >= 2;
/** How far apart two stand (metres), and that squared. */
const far2 = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z);
const far = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.sqrt(far2(a, b));
const told = (f: FightWorld, what: FightTold, id = -1, more = 0) => {
  f.told = [FIGHT_TOLD.indexOf(what), f.step, id, more];
};

/** A body's missile, what it strikes as, and the blow it deals. */
function missileOf(looses: Looses): { striker: number; blow: Blow } {
  return looses === "shot"
    ? { striker: 3, blow: "shot" }
    : { striker: looses === "darts" ? 2 : 1, blow: "point" };
}

/** How much a wound that does not kill takes out of one, by where (BLOW_PLACES' index). */
function hurtAt(k: number): number {
  const p = BLOW_PLACES[k]!;
  return p === "head"
    ? FIGHT_HURT.head
    : p === "trunk"
      ? FIGHT_HURT.trunk
      : p.startsWith("leg")
        ? FIGHT_HURT.leg
        : p.startsWith("hand")
          ? FIGHT_HURT.hand
          : FIGHT_HURT.arm;
}

/** The nines in BLOW_PLACES' order: where a blow lands before what it does there. */
const LANDS = BLOW_PLACES.map((p) => NINES[p]);

/**
 * A blow (or a missile) from `a` at `b`: whether it lands — by the share that land (the more where
 * the hand deals it, `byHand`), the might of the two sides, `a`'s strength, `b` parrying or running
 * — where, and what it does there by what struck against `b`'s guard: dead, or hurt (down at 1), a
 * limb cut off where an axe or a sword cut it; on the possessed while he is held (`held`), as
 * FIGHT_WARD has it. Told where the possessed (index 0) struck or was struck.
 */
function strike(
  scene: FightScene,
  f: FightWorld,
  ai: number,
  bi: number,
  missile: boolean,
  draw: LocalDraw,
  byHand = false,
  held = false,
): void {
  const a = f.bodies[ai]!,
    b = f.bodies[bi]!,
    own = scene.sides[a.side],
    foe = scene.sides[b.side],
    s = f.step,
    m = missile ? missileOf(own.looses) : { striker: 0, blow: own.blow },
    near = far(a, b),
    range = FIGHT_RANGE[own.looses],
    base = missile
      ? FIGHT_HIT.missile * (1 - (0.75 * Math.min(range, near)) / Math.max(1, range))
      : b.doing === "parry"
        ? byHand
          ? FIGHT_HIT.handParried
          : FIGHT_HIT.parried
        : byHand
          ? FIGHT_HIT.hand
          : FIGHT_HIT.blow,
    lands =
      base *
      dmath.sqrt(own.might / foe.might) *
      a.strength *
      (own.mounted && !missile ? 1.15 : 1) *
      (fled(b) ? FIGHT_HIT.back : 1);
  if (draw(a.id, s, P.hit) >= Math.min(0.95, lands)) {
    if (ai === 0) told(f, b.doing === "parry" && !missile ? "parried" : "missed", b.id);
    else if (bi === 0 && b.doing === "parry") told(f, "parried", a.id, 1);
    return;
  }
  const place = BLOW_PLACES.indexOf(blowPlaceOf(LANDS, draw(b.id, s, P.place))),
    striker = FIGHT_STRIKERS[m.striker]!,
    ward = held && bi === 0,
    kills =
      killShare(BLOW_PLACES[place]!, striker, m.blow) *
      (1 - TURN[m.blow] * dmath.clamp(foe.guard, 0, 1)) *
      (0.6 + 0.5 * dmath.clamp(own.shock, 0, 1.4)) *
      (ward ? FIGHT_WARD.kill : 1),
    dead = draw(b.id, s, P.kill) < kills,
    cut =
      !missile &&
      own.cuts &&
      (isLimbPlace(place) || (dead && place === 0)) &&
      draw(b.id, s, P.cut) < (dead ? SEVER.edge * (place === 0 ? SEVER.head : 1) : SEVER.edge / 2);
  b.struck = place;
  if (cut) b.lost = place;
  if (dead) b.doing = "dead";
  else {
    b.hurt = Math.min(1, b.hurt + hurtAt(place) * (ward ? FIGHT_WARD.hurt : 1));
    if (b.hurt >= 1 || cut) b.doing = "down";
  }
  const down = b.doing === "dead" || b.doing === "down";
  if (down) {
    b.vx = 0;
    b.vz = 0;
    f.deeds.push({ step: s, by: a.id, id: b.id, place, striker: m.striker, dead, lost: cut });
  }
  if (ai === 0) told(f, down ? (dead ? "felled" : "wounded") : "struck", b.id, place);
  else if (bi === 0) told(f, "hit", a.id, place);
}

/** Turn `from` toward `to` by at most `most` (radians). */
function turned(from: number, to: number, most: number): number {
  let d = (to - from) % dmath.TAU;
  if (d > dmath.PI) d -= dmath.TAU;
  if (d < -dmath.PI) d += dmath.TAU;
  return from + Math.max(-most, Math.min(most, d));
}

/** Go toward (tx, tz) at `pace`, no farther than it is. */
function go(b: FightBody, tx: number, tz: number, pace: number): void {
  const dx = tx - b.x,
    dz = tz - b.z,
    far = Math.sqrt(dx * dx + dz * dz);
  if (far < 1e-6) {
    b.vx = 0;
    b.vz = 0;
    return;
  }
  const step = Math.min(far, pace * DT);
  b.vx = (dx / far) * step * POSSESS_HZ;
  b.vz = (dz / far) * step * POSSESS_HZ;
  b.x += (dx / far) * step;
  b.z += (dz / far) * step;
  b.yaw = turned(b.yaw, dmath.atan2(dx, dz), 0.35);
}

/** Face (tx, tz), standing. */
function face(b: FightBody, tx: number, tz: number): void {
  b.vx = 0;
  b.vz = 0;
  b.yaw = turned(b.yaw, dmath.atan2(tx - b.x, tz - b.z), 0.3);
}

/** The nearest of the other side still in the fight (or, after a break, fleeing) to `i` (-1: none). */
function nearestFoe(f: FightWorld, i: number, fleeing: boolean): number {
  const a = f.bodies[i]!;
  let best = -1,
    bestD = Infinity;
  for (let j = 0; j < f.bodies.length; j++) {
    const b = f.bodies[j]!;
    if (b.side === a.side || !fighting(b) || (!fleeing && b.doing === "flee")) continue;
    const d = far2(a, b);
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  }
  return best;
}

/** Whether `i`'s foe is still one to go for. */
function foeHolds(f: FightWorld, i: number, fleeing: boolean): boolean {
  const b = f.bodies[f.bodies[i]!.foe];
  return !!b && fighting(b) && (fleeing || b.doing !== "flee");
}

/** Where one flees to: off its own end of the field (before a town, its defenders off either flank). */
function fleeTo(scene: FightScene, b: FightBody): { x: number; z: number } {
  if (b.side === 1 && scene.flanks) return { x: b.x, z: (b.z < 0 ? -1 : 1) * (FIGHT_FLANK + 10) };
  return { x: b.side === 0 ? -FIGHT_GONE - 10 : FIGHT_GONE + 10, z: b.z };
}

/** Whether one fleeing is off the field. */
function offField(scene: FightScene, b: FightBody): boolean {
  return (
    Math.abs(b.x) > FIGHT_GONE || (scene.flanks && b.side === 1 && Math.abs(b.z) > FIGHT_FLANK)
  );
}

/** How fast a body of a side goes at a pace. */
function paceOf(scene: FightScene, b: FightBody, pace: number): number {
  return (
    pace *
    (scene.pace ?? 1) *
    (scene.sides[b.side].mounted ? FIGHT_PACE.mounted : 1) *
    (1 - 0.35 * b.hurt)
  );
}

/** One of the bodies the fight moves (not the possessed, while he is held: `held`, his ward on him). */
function think(scene: FightScene, f: FightWorld, i: number, draw: LocalDraw, held = false): void {
  const b = f.bodies[i]!,
    s = f.step,
    own = scene.sides[b.side];
  if (!fighting(b)) return;
  // Its side broken: away off its end of the field, gone once past it.
  if (f.broke === b.side) {
    const to = fleeTo(scene, b);
    b.doing = "flee";
    go(b, to.x, to.z, paceOf(scene, b, FIGHT_PACE.flee));
    if (offField(scene, b)) b.doing = "gone";
    return;
  }
  const won = f.broke >= 0;
  // (Looked for afresh every so often, each at its own step of the round, or when its foe is gone.)
  if ((s + i) % FIGHT_TAKES.look === 0 || !foeHolds(f, i, won)) b.foe = nearestFoe(f, i, won);
  const foe = f.bodies[b.foe];
  if (!foe) {
    b.doing = "stand";
    b.vx = 0;
    b.vz = 0;
    return;
  }
  const d = far(foe, b),
    reach = FIGHT_REACH[own.blow];
  // The other side broken: after them a while, then standing on the field won.
  if (won) {
    if (s - f.brokeAt > FIGHT_TAKES.chase || d > 30) {
      b.doing = "stand";
      face(b, foe.x, foe.z);
      return;
    }
    b.doing = "chase";
    if (d > reach * 0.9) go(b, foe.x, foe.z, paceOf(scene, b, FIGHT_PACE.run));
    else if (s >= b.ready) {
      strike(scene, f, i, b.foe, false, draw, false, held);
      b.ready = s + FIGHT_TAKES.strike;
    }
    return;
  }
  if (d <= reach) {
    b.doing = "fight";
    face(b, foe.x, foe.z);
    if (s >= b.ready) {
      strike(scene, f, i, b.foe, false, draw, false, held);
      b.ready = s + Math.round(FIGHT_TAKES.strike * (1.2 - 0.4 * draw(b.id, s, P.pace)));
    }
    return;
  }
  // From afar: loose where it may (the attackers until the charge, the defenders as they come).
  if (
    b.loaded >= 0 &&
    b.loaded <= s &&
    d > 2 * reach &&
    d <= FIGHT_RANGE[own.looses] &&
    (b.side === 1 || fightSecond(scene, f) < FIGHT_CHARGE)
  ) {
    b.doing = "loose";
    face(b, foe.x, foe.z);
    strike(scene, f, i, b.foe, true, draw, false, held);
    b.loaded = s + Math.round(own.reload * POSSESS_HZ);
    return;
  }
  // The attackers come on, at the charge near the line; the defenders hold about it, stepping out
  // to meet one come near.
  // (Behind one of its own nearer the foe, it keeps its rank: only the front closes.)
  if (
    (b.side === 1 && Math.abs(b.x - scene.meet) > FIGHT_NEAR.hold && d > FIGHT_NEAR.meet) ||
    behind(f, i, foe)
  ) {
    b.doing = "stand";
    face(b, foe.x, foe.z);
    return;
  }
  b.doing = "come";
  go(b, foe.x, foe.z, paceOf(scene, b, d < 12 ? FIGHT_PACE.run : FIGHT_PACE.walk));
}

/** Whether one of `i`'s own stands close before it, nearer its foe: it keeps its rank behind them. */
function behind(f: FightWorld, i: number, foe: FightBody): boolean {
  const b = f.bodies[i]!,
    dx = foe.x - b.x,
    dz = foe.z - b.z,
    d = Math.sqrt(dx * dx + dz * dz) || 1,
    ux = dx / d,
    uz = dz / d,
    rank = FIGHT_NEAR.rank;
  for (let j = 0; j < f.bodies.length; j++) {
    const o = f.bodies[j]!;
    if (j === i || o.side !== b.side || !fighting(o) || o.doing === "flee") continue;
    const ox = o.x - b.x,
      oz = o.z - b.z;
    if (ox * ox + oz * oz > rank * rank) continue;
    if (ox * ux + oz * uz > 0.6 && Math.abs(ox * uz - oz * ux) < 0.9) return true;
  }
  return false;
}

/** The possessed, by his bid: about the field, a blow (or a missile), a parry, a rally, flight. */
function hand(scene: FightScene, f: FightWorld, bid: HandBid, draw: LocalDraw): void {
  const b = f.bodies[0]!,
    s = f.step,
    own = scene.sides[b.side];
  if (!fighting(b)) return;
  const m = Math.min(1, Math.sqrt(bid.mx * bid.mx + bid.mz * bid.mz) / 31),
    flying = b.doing === "flee";
  // Flight is his while he holds to it: flight bid again, a blow, a parry or a rally takes him back
  // into the fight.
  if (bid.act === FIGHT_ACT.fly && !flying) {
    b.doing = "flee";
    f.lift[b.side] = Math.max(-FIGHT_HEART.lift, f.lift[b.side] - FIGHT_HEART.fly);
    told(f, "fled");
  } else if (flying && bid.act === FIGHT_ACT.fly) {
    b.doing = "stand";
    told(f, "stood");
  } else if (
    flying &&
    (bid.act === HAND_ACT.strike || bid.act === FIGHT_ACT.parry || bid.act === FIGHT_ACT.rally)
  )
    b.doing = "stand";
  if (m > 0.05) {
    const pace =
      b.doing === "flee" ? FIGHT_PACE.flee : bid.run ? FIGHT_PACE.run : FIGHT_PACE.walk * 1.3;
    go(b, b.x + bid.mx, b.z + bid.mz, paceOf(scene, b, pace) * m);
  } else {
    b.vx = 0;
    b.vz = 0;
  }
  if (b.doing === "flee") {
    if (offField(scene, b)) b.doing = "gone";
    return;
  }
  if (b.doing === "parry" && s >= b.until) b.doing = "stand";
  const fi = nearestFoe(f, 0, f.broke >= 0),
    foe = f.bodies[fi],
    d = foe ? far(foe, b) : Infinity,
    reach = FIGHT_REACH[own.blow];
  b.foe = fi;
  if (bid.act === HAND_ACT.strike) {
    if (foe && d <= reach * 1.15 && s >= b.ready) {
      face(b, foe.x, foe.z);
      b.yaw = dmath.atan2(foe.x - b.x, foe.z - b.z);
      b.doing = "fight";
      strike(scene, f, 0, fi, false, draw, true);
      b.ready = s + FIGHT_TAKES.hand;
    } else if (foe && b.loaded >= 0 && b.loaded <= s && d <= FIGHT_RANGE[own.looses]) {
      b.yaw = dmath.atan2(foe.x - b.x, foe.z - b.z);
      b.doing = "loose";
      strike(scene, f, 0, fi, true, draw, true);
      b.loaded = s + Math.round(own.reload * POSSESS_HZ);
      if (f.told[1] !== s) told(f, "loosed", foe.id);
    } else told(f, "nothing", -1, foe ? 1 : 0);
  } else if (bid.act === FIGHT_ACT.parry) {
    b.doing = "parry";
    b.until = s + FIGHT_TAKES.parry;
  } else if (bid.act === FIGHT_ACT.rally) {
    if (s - f.rallied >= FIGHT_TAKES.rally && f.broke !== b.side) {
      f.rallied = s;
      let n = 0;
      for (let j = 1; j < f.bodies.length; j++) {
        const o = f.bodies[j]!;
        if (o.side !== b.side || !fighting(o)) continue;
        if (far2(o, b) > FIGHT_NEAR.rally * FIGHT_NEAR.rally) continue;
        n++;
        if (o.doing === "flee") o.doing = "stand";
      }
      f.lift[b.side] = Math.min(
        FIGHT_HEART.lift,
        f.lift[b.side] + FIGHT_HEART.rally * Math.min(1, n / 6),
      );
      told(f, "rallied", -1, n);
    } else told(f, "nothing", -1, 2);
  } else if (b.doing === "fight" || b.doing === "loose") {
    if (!foe || d > reach * 1.15) b.doing = m > 0.05 ? "come" : "stand";
  } else if (b.doing !== "parry") b.doing = m > 0.05 ? "come" : "stand";
  // (Facing his foe when one is at hand and he stands; else the way he goes.)
  if (foe && d <= reach * 1.5 && m <= 0.05) face(b, foe.x, foe.z);
}

/** The bodies kept off each other: those nearer than FIGHT_NEAR.apart pushed apart, the fallen not. */
function apart(f: FightWorld): void {
  const n = f.bodies.length,
    room = FIGHT_NEAR.apart;
  // (Sorted along x by insertion each step: a body moves little between steps.)
  const order = sorted(f);
  for (let a = 0; a < n; a++) {
    const p = f.bodies[order[a]!]!;
    if (!fighting(p) || p.doing === "flee") continue;
    for (let c = a + 1; c < n; c++) {
      const q = f.bodies[order[c]!]!;
      if (q.x - p.x > room) break;
      if (!fighting(q) || q.doing === "flee") continue;
      const dx = q.x - p.x,
        dz = q.z - p.z,
        d2 = dx * dx + dz * dz;
      if (d2 >= room * room) continue;
      if (d2 < 1e-12) {
        p.z -= room / 2;
        q.z += room / 2;
        continue;
      }
      const d = Math.sqrt(d2),
        push = (room - d) / 2 / d;
      p.x -= dx * push;
      p.z -= dz * push;
      q.x += dx * push;
      q.z += dz * push;
    }
  }
}

/** The bodies' indices along x (kept between steps, for the fight they were sorted for). */
let orderKept: { of: FightBody[]; order: number[] } | null = null;
function sorted(f: FightWorld): number[] {
  if (!orderKept || orderKept.of !== f.bodies || orderKept.order.length !== f.bodies.length)
    orderKept = { of: f.bodies, order: f.bodies.map((_, i) => i) };
  const order = orderKept.order,
    bodies = f.bodies;
  for (let i = 1; i < order.length; i++) {
    const k = order[i]!,
      x = bodies[k]!.x;
    let j = i - 1;
    while (j >= 0 && (bodies[order[j]!]!.x > x || (bodies[order[j]!]!.x === x && order[j]! > k))) {
      order[j + 1] = order[j]!;
      j--;
    }
    order[j + 1] = k;
  }
  return order;
}

/** Each side's bodies in the fight when it began, and down (dead or wounded out) now. */
export function fightCounts(f: FightWorld): { bodies: [number, number]; down: [number, number] } {
  const bodies: [number, number] = [0, 0],
    down: [number, number] = [0, 0];
  for (const b of f.bodies) {
    bodies[b.side]++;
    if (b.doing === "dead" || b.doing === "down") down[b.side]++;
  }
  return { bodies, down };
}

/** Each side's heart now (it breaks below its breaking point). */
export function fightHeart(scene: FightScene, f: FightWorld): [number, number] {
  const { bodies, down } = fightCounts(f);
  return [0, 1].map((k) => {
    const side = scene.sides[k]!;
    return (
      1 +
      f.lift[k]! -
      (FIGHT_HEART.loss * down[k]!) / Math.max(1, bodies[k]!) -
      (FIGHT_HEART.before * side.before) / Math.max(1, side.figures)
    );
  }) as [number, number];
}

/** Where a side's heart breaks: the mightier the later. */
export function breakingPoint(side: FightSide): number {
  return FIGHT_HEART.break / dmath.sqrt(dmath.clamp(side.might, 0.25, 4));
}

/** A side breaks where its heart fails, the worse first; the attackers draw off unbroken late in the day. */
function breaks(scene: FightScene, f: FightWorld): void {
  if (f.broke >= 0) return;
  const heart = fightHeart(scene, f),
    short = [0, 1].map((k) => breakingPoint(scene.sides[k]!) - heart[k]!);
  let side: -1 | 0 | 1 = -1;
  if (short[0]! > 0 || short[1]! > 0) side = short[0]! >= short[1]! ? 0 : 1;
  else if (fightSecond(scene, f) >= FIGHT_DRAW_OFF) side = 0;
  if (side < 0) return;
  f.broke = side;
  f.brokeAt = f.step;
  const me = f.bodies[0]!;
  told(f, side === me.side ? "broke" : "beaten", -1, side);
}

/**
 * The fight stepped by one bid of the possessed (`held` false: let go, he fights as the rest do):
 * he and every body moved, the blows struck, the bodies kept apart, each side's heart weighed. It
 * ends for him where he falls, is wounded out of it, has fled the field, or the battle is over.
 */
export function stepFight(
  scene: FightScene,
  f: FightWorld,
  bid: HandBid,
  draw: LocalDraw,
  held = true,
): void {
  if (held && f.ended) return;
  if (held) hand(scene, f, bid, draw);
  for (let i = held ? 1 : 0; i < f.bodies.length; i++) think(scene, f, i, draw, held);
  apart(f);
  breaks(scene, f);
  f.step++;
  if (!held) return;
  const me = f.bodies[0]!;
  if (me.doing === "dead") f.ended = "dead";
  else if (me.doing === "down") f.ended = "down";
  else if (me.doing === "gone") f.ended = "fled";
  else if (fightSecond(scene, f) >= scene.length) f.ended = "over";
}

/**
 * The fight fought out once the hand lets go, he fighting as the rest do: stepped until a side has
 * broken and the chase is done, or the battle's end (`most` steps at most). Returns the steps taken.
 */
export function fightOut(scene: FightScene, f: FightWorld, draw: LocalDraw, most: number): number {
  const still: HandBid = { mx: 0, mz: 0, run: false, act: 0 };
  let n = 0;
  while (
    n < most &&
    fightSecond(scene, f) < scene.length &&
    !(f.broke >= 0 && f.step - f.brokeAt > FIGHT_TAKES.chase)
  ) {
    stepFight(scene, f, still, draw, false);
    n++;
  }
  return n;
}

/** What the fight decided: the side beaten (-1: not yet), and each side's bodies down dead and wounded out. */
export function fightDecided(f: FightWorld): {
  beaten: -1 | 0 | 1;
  dead: [number, number];
  down: [number, number];
} {
  const dead: [number, number] = [0, 0],
    down: [number, number] = [0, 0];
  for (const b of f.bodies) {
    if (b.doing === "dead") dead[b.side]++;
    else if (b.doing === "down") down[b.side]++;
  }
  return { beaten: f.broke, dead, down };
}

/**
 * The day as a taking leans it: the scene laid at FIGHT_TILT (`sceneAt`), and the fight fought out
 * from `start` with no hand in it by the draws the hand's will draw; where it broke history's victor
 * (`victor`), laid again leaning the more — FIGHT_TILT times over, FIGHT_LEANS at most — so that,
 * left alone, the fight goes history's way and only the hand turns it (the fight is a sample of the
 * battle about him, and a sample may go against the whole). The scene, and the fight left alone.
 */
export function fightLeaning(
  sceneAt: (tilt: number) => FightScene,
  start: FightWorld,
  victor: 0 | 1,
  draw: LocalDraw,
): { scene: FightScene; idle: FightWorld } {
  let tilt = FIGHT_TILT,
    scene = sceneAt(tilt),
    idle = copyFight(start);
  fightOut(scene, idle, draw, FIGHT_OUT_MOST);
  for (let k = 1; k < FIGHT_LEANS && idle.broke === victor; k++) {
    tilt *= FIGHT_TILT;
    scene = sceneAt(tilt);
    idle = copyFight(start);
    fightOut(scene, idle, draw, FIGHT_OUT_MOST);
  }
  return { scene, idle };
}

/** Why an act is not his to do now (the host words it): no foe in reach, none in range, none near, too soon, his side broken. */
export const FIGHT_WHY = ["", "reach", "range", "near", "soon", "broken", "fled"] as const;
export type FightWhy = (typeof FIGHT_WHY)[number];

/** One of the four acts before him: which, whether he can, and why not. */
export type FightOffer = {
  readonly act: number;
  readonly kind: "strike" | "loose" | "parry" | "rally" | "fly" | "stand";
  readonly can: boolean;
  readonly why: FightWhy;
};

/** The four acts before the possessed: a blow (or a missile, where none is in reach), a parry, a rally, flight (or a stand, fleeing). */
export function fightOffers(scene: FightScene, f: FightWorld): FightOffer[] {
  const b = f.bodies[0]!,
    s = f.step,
    own = scene.sides[b.side],
    fi = nearestFoe(f, 0, f.broke >= 0),
    foe = f.bodies[fi],
    d = foe ? far(foe, b) : Infinity,
    reach = FIGHT_REACH[own.blow] * 1.15,
    looses = own.looses !== "none",
    loaded = b.loaded >= 0 && b.loaded <= s,
    inRange = d <= FIGHT_RANGE[own.looses],
    flying = b.doing === "flee",
    strike: FightOffer =
      d <= reach || !looses
        ? {
            act: HAND_ACT.strike,
            kind: "strike",
            can: d <= reach && s >= b.ready,
            why: d <= reach ? (s >= b.ready ? "" : "soon") : "reach",
          }
        : {
            act: HAND_ACT.strike,
            kind: "loose",
            can: loaded && inRange,
            why: !inRange ? "range" : loaded ? "" : "soon",
          };
  return [
    strike,
    {
      act: FIGHT_ACT.parry,
      kind: "parry",
      can: d <= FIGHT_NEAR.parry,
      why: d <= FIGHT_NEAR.parry ? "" : "near",
    },
    {
      act: FIGHT_ACT.rally,
      kind: "rally",
      can: s - f.rallied >= FIGHT_TAKES.rally && f.broke !== b.side,
      why: f.broke === b.side ? "broken" : s - f.rallied >= FIGHT_TAKES.rally ? "" : "soon",
    },
    { act: FIGHT_ACT.fly, kind: flying ? "stand" : "fly", can: true, why: "" },
  ];
}
