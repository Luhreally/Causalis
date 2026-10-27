// Blows seen where they land (Phase 55, asked for 2026-10-26: "and like even in the sim battles
// where its like reenactted or wtv it should be more graphic, and realistic where ever they are
// getting damaged yk"): over a battle as the field fights it (view/battle.ts), where each one
// struck was struck — the head, the trunk, an arm or a hand, a leg, by the rule of nines, the dead
// the more on the head and the trunk (a blow there kills more often: rules/wounds.ts's LETHAL) and
// the wounded who live the more on the limbs — with what (a blade, a spear, an arrow or a dart
// that sticks, a ball or a bullet, a cannon's ball, a bursting shell), how they went down (a leg
// giving way, crumpling, thrown back, knocked off their feet), the wound on the part and its
// blood, a limb cut off where an axe, a sword, a ball or a shell could do it, lying apart in its
// own blood; and history's wounded who lived, so many figures for so many men: reeling, down on a
// knee clutching the wound, then crawling, limping or helped back through the ranks, a trail of
// blood behind them, to sit behind the lines, the ranks closing up behind them. The battle's own
// plan is not changed — who falls and when, where each stands: its tests pin them — this is laid
// over it. Pure: the same moment always looks the same. Metres on the field, as view/battle.ts's.
import type { BattleSideNear } from "../bridge/index.ts";
import {
  CUTS_OFF,
  KILL,
  LETHAL,
  LIMB_KILL,
  MAIM,
  MAIMED_AT,
  NINES,
  blowOf,
  type Blow,
} from "../rules/index.ts";
import { armLook, isGun } from "./arms.ts";
import {
  BLOW_PLACES,
  CRAWL,
  FALL_LONG,
  FIELD,
  MOMENTS,
  STAGGER,
  bloodAt,
  closedUp,
  crawledTo,
  crawlsFor,
  gapOf,
  placeAt,
  shotBy,
  standY,
  trooperWho,
  type Act,
  type BattleField,
  type BattleNow,
  type BlowFall,
  type BlowLost,
  type BlowPlace,
  type FigureAnatomy,
  type LimbNow,
  type StuckNow,
  type Trooper,
  type TrooperNow,
  type WoundMark,
  type WoundNow,
} from "./battle.ts";
import { figureOf, partExtent, type Figure } from "./figure.ts";

/** How much of the blood and the wounds is drawn (the viewer's setting): all, less, none. */
export type Gore = "full" | "less" | "none";
export const GORES: readonly Gore[] = ["full", "less", "none"];

/** What struck: a hand's blow, an arrow or a dart (they stick), a bullet, a cannon's ball, a shell. */
export type Striker = "hand" | "arrow" | "dart" | "bullet" | "ball" | "shell";
/** How a wounded one who lives goes back: crawling, limping, propped on one who helps, slumped in the saddle. */
export type BackWay = "crawl" | "limp" | "propped" | "slump";

// The rule of nines, what kills on a limb and the head, what cuts off and where it maims: the
// body's own, rules/anatomy.ts (Phase 55 M226), the same for a battle's blows and a town's wounded.
export { CUTS_OFF, KILL, LIMB_KILL, MAIMED_AT, NINES };
/** A cannon's ball and a bursting shell kill as no hand does: on the head, the trunk, a limb. */
export const ORDNANCE_KILL = {
  ball: { head: 0.95, trunk: 0.95, limb: 0.4 },
  shell: { head: 0.95, trunk: 0.8, limb: 0.3 },
} as const;
/**
 * A cannon's shot: how long after its firing it strikes (s), the window it may strike in, and the
 * most of the other side's dead to missiles it takes (a ball's share; a shell's, smokeless powder).
 */
export const BALL = { flight: 0.35, from: 0.1, to: 1.2, share: 0.25, shells: 0.35 } as const;
/**
 * Of the dead, the share whose struck limb is cut off: by an axe or a sword, a cannon's ball, a
 * shell (at most .45, as the plan's anatomy severs); a head struck so, this share of that (an axe,
 * a sword, a ball). Of a side, at most `most` parts cut off, the dead's and the living's together.
 */
export const SEVER = { edge: 0.12, ball: 0.45, shell: 0.45, head: 0.35, most: 24 } as const;
/** The wounded who live drawn: at most this share of a side's figures that do not fall. */
export const HURT = { most: 0.8 } as const;
/** How long one wounded stays down on a knee before going back (s, after reeling). */
export const KNEEL = { least: 1.2, most: 2.4 } as const;
/**
 * Going back through the ranks: paces (m/s) crawling, limping, propped and walking (one who
 * helps); how far past their host's last rank they go (m), the most, how far one crawling goes at
 * most (and as much again at random), the share with a struck leg who crawl, the share helped.
 */
export const BACK = {
  crawl: 0.32,
  limp: 0.75,
  propped: 0.9,
  walk: 1.6,
  past: 4,
  most: 26,
  crawlFar: 7,
  legCrawl: 0.6,
  help: 0.35,
} as const;
/**
 * Blood: a wound's growing (s), its drying (s); a crawler's trail (a smear every so far, the most)
 * and a walker's (drops every so far over its first metres); the most pools and smears a battle
 * shows (render/battle.ts draws as many; the parts cut off keep theirs within it, 2 × SEVER.most).
 */
export const BLEED = {
  grow: 5,
  dry: 14,
  crawlStep: 1,
  crawlDrops: 8,
  walkStep: 1.5,
  walkDrops: 4,
  most: 3040,
} as const;
/** The blood thrown from a fresh wound: for how long (s), how many drops by what struck. */
export const SPRAY = {
  long: 0.6,
  hand: 7,
  arrow: 3,
  dart: 3,
  bullet: 6,
  ball: 10,
  shell: 10,
  /** A stump's: spurting so many drops a beat for so long (s). */
  stump: 4,
  pulse: 4,
} as const;
/** How the ranks close up behind one gone back: over how long (s), and who steps up. */
const CLOSE = 1.6;
const CLOSING: ReadonlySet<Act> = new Set(["stand", "march", "brace", "fight", "loose", "cheer"]);
/** A part cut off in the air: its flight (s), its arc (m) and its turns, by what cut it off. */
const FLIGHT = {
  hand: { flight: 0.35, arc: 0.5, turns: 1 },
  ball: { flight: 0.6, arc: 1.6, turns: 2.5 },
  shell: { flight: 0.7, arc: 1.8, turns: 2 },
} as const;
/** The wound's size as struck (m, on a man of 1.75 m), by its look. */
const SIZE: Readonly<Record<Exclude<WoundMark, "stump">, number>> = {
  cut: 0.13,
  stab: 0.05,
  hole: 0.045,
  bruise: 0.12,
  smash: 0.24,
};
/** The keys of a battle's blows, apart from its field's. */
const BLOW_KEY = 0x51ed27,
  WOUND_KEY = 0x7f4a7c15;

/** One struck: who, when, with what, where, and what came of it. */
export type BlowHit = {
  readonly id: number;
  readonly side: 0 | 1;
  /** When struck (battle s): for the dead, when they fall. */
  readonly at: number;
  readonly striker: Striker;
  readonly blow: Blow;
  readonly place: BlowPlace;
  /** The point struck on its part's face, across it and along it (each −0.35 … 0.35 of its extent). */
  readonly u: number;
  readonly v: number;
  /** The face struck: the front (1: toward the foe) or the back (−1: struck down running). */
  readonly face: 1 | -1;
  readonly mark: Exclude<WoundMark, "stump">;
  /** The wound's size as struck (m). */
  readonly size: number;
  /** A part cut off (null: none); a limb shattered (lost later, to the surgeon: M226). */
  readonly lost: BlowLost | null;
  readonly shattered: boolean;
  /** How the dead go down (null: as the battle alone has them fall; the living: null). */
  readonly fall: BlowFall | null;
  /** Where a fall that moves them lays them, fully down, and whether on their back (null: as the battle lays them). */
  readonly lie: { readonly x: number; readonly z: number; readonly back: boolean } | null;
  /** What sticks in them: the shaft's flight against their facing (rad), and how steeply it came down (rad). */
  readonly shaft: { readonly yaw: number; readonly dip: number } | null;
  /** Where they stood struck, and which way they faced (m, rad). */
  readonly x: number;
  readonly z: number;
  readonly facing: number;
  /** The living: their way back (null: of the dead). */
  readonly back: BlowBack | null;
};

/** A wounded one's way back through the ranks. */
export type BlowBack = {
  readonly way: BackWay;
  /** When they begin to go back (battle s), and when they are there. */
  readonly going: number;
  readonly there: number;
  /** Where they knelt, which way they go (a unit), how far (m). */
  readonly from: { readonly x: number; readonly z: number };
  readonly dir: { readonly x: number; readonly z: number };
  readonly far: number;
  /** Who helps them (a trooper's id; −1: none). */
  readonly helper: number;
};

/** One who helps a wounded one back, beside them on their left, and back to their place after. */
export type BlowHelp = {
  readonly id: number;
  /** The wounded one's hit (an index into the hits). */
  readonly hit: number;
  /** From when they go to the wounded one (battle s), from where; when there; when back at their place. */
  readonly start: number;
  readonly from: { readonly x: number; readonly z: number };
  readonly meet: number;
  readonly home: number;
};

/** A part cut off, flying from where it was cut and lying where it came down. */
export type BlowLoose = {
  /** Its hit (an index into the hits). */
  readonly hit: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly flight: number;
  readonly arc: number;
  /** Its turns as it flies (rad, signed). */
  readonly spin: number;
};

/** A battle's blows: each one struck (in the order struck), who helps whom, the parts cut off. */
export type Blows = {
  readonly hits: readonly BlowHit[];
  /** Each trooper's hit (an index; −1: never struck), and help (an index into helps; −1). */
  readonly of: readonly number[];
  readonly helps: readonly BlowHelp[];
  readonly helping: readonly number[];
  readonly loose: readonly BlowLoose[];
  /** Each side's figures fallen, wounded who lived, and of those maimed. */
  readonly dead: readonly [number, number];
  readonly hurt: readonly [number, number];
  readonly maimed: readonly [number, number];
};

/** A keyed draw (0 … 1): the battle view's own. */
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
const isLeg = (p: BlowPlace) => p === "leg-l" || p === "leg-r";
const isLimb = (p: BlowPlace) => p !== "head" && p !== "trunk";

/**
 * The parts of a figure by place: its trunk (the greatest part that is no limb), its head (every
 * other part that is no limb whose middle is above the trunk's top: the head, hair, eyes; its
 * wounds on the greatest of them), each side's arm (the chain of arm parts hinged at its highest
 * shoulder: the arm, then its hand) and hand (the chain's least part, where it has two), each
 * side's leg (the foremost leg's chain: the leg, its shoe). Left is +x.
 */
export function figureAnatomy(f: Figure): FigureAnatomy {
  const parts = f.parts,
    top = (i: number) => parts[i]!.y + partExtent(parts[i]!)[1] / 2,
    volume = (i: number) => {
      const e = partExtent(parts[i]!);
      return e[0] * e[1] * e[2];
    },
    plain = parts.map((_, i) => i).filter((i) => !parts[i]!.role),
    trunk = [...plain].sort((a, b) => volume(b) - volume(a) || a - b)[0],
    headParts =
      trunk === undefined ? [] : plain.filter((i) => i !== trunk && parts[i]!.y > top(trunk)),
    head = [...headParts].sort((a, b) => volume(b) - volume(a) || a - b)[0],
    chain = (role: "arm" | "leg", left: boolean): number[] => {
      const mine = parts
          .map((_, i) => i)
          .filter((i) => parts[i]!.role === role && parts[i]!.x > 0 === left),
        hinge = (i: number) => parts[i]!.y + (parts[i]!.pivot ?? 0);
      if (!mine.length) return [];
      // (An arm: the one from the highest shoulder; a leg: the foremost. Its chain: it and the
      // parts hinged with it at its place, a hand or a shoe, the longest first.)
      const lead = [...mine].sort((a, b) =>
        role === "arm" ? hinge(b) - hinge(a) || a - b : parts[b]!.z - parts[a]!.z || a - b,
      )[0]!;
      return mine
        .filter(
          (i) =>
            Math.abs(hinge(i) - hinge(lead)) < 1e-3 &&
            Math.abs(parts[i]!.x - parts[lead]!.x) < 0.02 &&
            Math.abs(parts[i]!.z - parts[lead]!.z) < 0.05,
        )
        .sort((a, b) => partExtent(parts[b]!)[1] - partExtent(parts[a]!)[1] || a - b);
    },
    armL = chain("arm", true),
    armR = chain("arm", false),
    legL = chain("leg", true),
    legR = chain("leg", false),
    hand = (c: number[]) => (c.length >= 2 ? [c[c.length - 1]!] : []);
  return {
    parts: {
      head: headParts,
      trunk: trunk === undefined ? [] : [trunk],
      "arm-l": armL,
      "arm-r": armR,
      "hand-l": hand(armL),
      "hand-r": hand(armR),
      "leg-l": legL,
      "leg-r": legR,
    },
    on: {
      head: head ?? -1,
      trunk: trunk ?? -1,
      "arm-l": armL[0] ?? -1,
      "arm-r": armR[0] ?? -1,
      "hand-l": hand(armL)[0] ?? armL[0] ?? -1,
      "hand-r": hand(armR)[0] ?? armR[0] ?? -1,
      "leg-l": legL[0] ?? -1,
      "leg-r": legR[0] ?? -1,
    },
  };
}

/** Where a place lands on a figure that has none (a limbless body): on the trunk. */
function onFigure(a: FigureAnatomy, p: BlowPlace): BlowPlace {
  return a.on[p] >= 0 ? p : "trunk";
}

/** How far along its part a blow lands (−0.35 … 0.35); a hand struck on a figure that draws none, at its arm's end. */
function alongOf(a: FigureAnatomy, p: BlowPlace, r: number): number {
  return (p === "hand-l" || p === "hand-r") && a.parts[p].length === 0 ? -0.45 : (r - 0.5) * 0.7;
}

/** What a host strikes with in the press: its arm's blow (a bow's bearer, a blow; a gun's, its bayonet; a team's, the rest's). */
export function pressBlow(arm: string | undefined): Blow {
  const look = armLook(arm);
  if (look.looses === "none") return blowOf(arm);
  if (look.bayonet) return "point";
  if (look.rest !== undefined) return pressBlow(look.rest);
  return look.looses === "darts" ? "point" : "blunt";
}

/** What a host's missiles are, as they strike: arrows, darts, bullets (a seat's throwers: arrows). */
function missileOf(arm: string | undefined): Striker {
  const looses = armLook(arm).looses;
  return looses === "shot" ? "bullet" : looses === "darts" ? "dart" : "arrow";
}

/** The blow a striker deals: a hand's by its arm, a shaft's a point, a bullet's and a shell's shot, a ball's a crushing one. */
function blowBy(striker: Striker, arm: string | undefined): Blow {
  switch (striker) {
    case "hand":
      return pressBlow(arm);
    case "arrow":
    case "dart":
      return "point";
    case "ball":
      return "crush";
    default:
      return "shot";
  }
}

/** Of blows that land on a place, the share that kill. */
export function killShare(place: BlowPlace, striker: Striker, blow: Blow): number {
  if (striker === "ball" || striker === "shell") {
    const k = ORDNANCE_KILL[striker];
    return place === "head" ? k.head : place === "trunk" ? k.trunk : k.limb;
  }
  return place === "head"
    ? Math.min(KILL.most, LETHAL[blow] * KILL.head)
    : place === "trunk"
      ? LETHAL[blow]
      : LIMB_KILL[blow];
}

/**
 * The weights of where a blow lands, given its outcome (in BLOW_PLACES' order): the nines, times
 * the share that kills (the dead) or that does not (the wounded who live); a maimed one's, on the
 * limbs alone (an axe's or a sword's by MAIMED_AT).
 */
export function placeWeights(
  outcome: "dead" | "wounded" | "maimed",
  striker: Striker,
  blow: Blow,
  cuts: boolean,
): number[] {
  return BLOW_PLACES.map((p) => {
    if (outcome === "maimed") {
      if (!isLimb(p)) return 0;
      if (cuts)
        return p.startsWith("hand")
          ? MAIMED_AT.hand
          : p.startsWith("arm")
            ? MAIMED_AT.arm
            : MAIMED_AT.leg;
      return NINES[p];
    }
    const k = killShare(p, striker, blow);
    return NINES[p] * (outcome === "dead" ? k : 1 - k);
  });
}

/** A place drawn by its weight (`r` 0 … 1). */
function pick(weights: readonly number[], r: number): BlowPlace {
  const total = weights.reduce((a, b) => a + b, 0);
  let at = r * total;
  for (let i = 0; i < BLOW_PLACES.length; i++) {
    at -= weights[i]!;
    if (at < 0) return BLOW_PLACES[i]!;
  }
  return BLOW_PLACES[weights.findLastIndex((w) => w > 0)] ?? "trunk";
}

/** A wound's look, by what struck and how. */
function markOf(striker: Striker, blow: Blow): Exclude<WoundMark, "stump"> {
  if (striker === "ball" || striker === "shell") return "smash";
  if (striker !== "hand") return "hole";
  return blow === "edge" ? "cut" : blow === "point" ? "stab" : "bruise";
}

/**
 * How many of a side's figures are drawn as its wounded who lived: so many for so many men, at most
 * HURT.most of those that may be (its figures that do not fall: the one rule, bridge/roll.ts
 * battleFigures, so the roll names each of them).
 */
export function hurtFigures(wounded: number, eligible: number, per: number): number {
  return wounded > 0
    ? Math.max(
        0,
        Math.min(Math.floor(HURT.most * eligible), Math.round(wounded / Math.max(1, per))),
      )
    : 0;
}

/** The side's words, and the other's. */
function sidesOf(field: BattleField, side: 0 | 1): { own: BattleSideNear; foe: BattleSideNear } {
  return side === 0
    ? { own: field.near.attacker, foe: field.near.defender }
    : { own: field.near.defender, foe: field.near.attacker };
}

/** An angle brought within (−π, π]. */
function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

type Building = BlowHit & { lost: BlowLost | null; shattered: boolean; back: BlowBack | null };

/**
 * A battle's blows, from its field: each fallen one's hit (where, with what, how they go down, a
 * part cut off); of the shot that struck them, those a cannon's ball or shell took; history's
 * wounded who lived, so many figures for so many men, each struck where and when, the maimed among
 * them, each one's way back and who helps them; the parts cut off, where they came to lie.
 */
export function newBlows(field: BattleField): Blows {
  const key = (hashText(field.near.event) ^ BLOW_KEY) >>> 0,
    draw = (id: number, purpose: number) => unit(key, id * 32 + purpose),
    anatomy = figureAnatomy(figureOf(field.near.figure, 1)),
    climbers = new Set(field.ladders.map((l) => l.climber)),
    arrowOf = new Map<number, BattleField["arrows"][number]>(),
    strikers = new Map<number, Striker>();
  for (const a of field.arrows) if (a.hits >= 0 && !arrowOf.has(a.hits)) arrowOf.set(a.hits, a);
  for (const t of field.troopers)
    if (t.falls !== null)
      strikers.set(
        t.id,
        t.by === "arrow" ? missileOf(sidesOf(field, t.side).foe.host?.arm) : "hand",
      );
  // Of the shot that struck down the other side, those a cannon's ball (or shell) took: for each
  // firing in turn, the one struck down nearest its ball's flight after it, within its window.
  for (const side of [0, 1] as const) {
    const target = side === 0 ? 1 : 0,
      arm = sidesOf(field, side).own.host?.arm,
      kind: Striker = isGun(arm) && armLook(arm).smoke < 1 ? "shell" : "ball",
      fires = field.cannon
        .map((c, ci) => ({ c, ci }))
        .filter(({ c }) => c.side === side)
        .flatMap(({ c, ci }) => c.fires.map((f) => ({ f, ci })))
        .sort((p, q) => p.f - q.f || p.ci - q.ci),
      missiles = field.troopers.filter((t) => t.side === target && t.by === "arrow"),
      most = Math.round(missiles.length * (kind === "shell" ? BALL.shells : BALL.share));
    let taken = 0;
    for (const { f } of fires) {
      if (taken >= most) break;
      let best: Trooper | null = null,
        bestOff = Infinity;
      for (const t of missiles) {
        const was = strikers.get(t.id);
        if (was === "ball" || was === "shell") continue;
        const d = t.falls! - f;
        if (d < BALL.from || d > BALL.to) continue;
        const off = Math.abs(d - BALL.flight);
        if (off < bestOff) {
          best = t;
          bestOff = off;
        }
      }
      if (best) {
        strikers.set(best.id, kind);
        taken++;
      }
    }
  }
  const hits: Building[] = [];
  // The fallen.
  for (const t of field.troopers) {
    if (t.falls === null) continue;
    const { foe } = sidesOf(field, t.side),
      arm = foe.host?.arm,
      striker = strikers.get(t.id)!,
      blow = blowBy(striker, arm),
      rout = t.by === "rout",
      place = onFigure(anatomy, pick(placeWeights("dead", striker, blow, false), draw(t.id, 0))),
      p = placeAt(field, t, t.falls),
      // (Riders lie with their horses, a seat's defenders on its walk, its climbers at its foot,
      // the battle's crawlers as it has them crawl: their falls the battle's own.)
      still =
        field.hosts[t.side]!.mounted !== null ||
        (!!field.ground.wall && t.side === 1) ||
        climbers.has(t.id) ||
        crawlsFor(field, t) > 0,
      fall: BlowFall | null = still
        ? null
        : striker === "ball" || striker === "shell"
          ? "blasted"
          : isLeg(place)
            ? "buckle"
            : rout
              ? null
              : place === "head"
                ? "crumple"
                : place === "trunk"
                  ? draw(t.id, 3) < (blow === "shot" || blow === "point" ? 0.5 : 0.6)
                    ? "thrown"
                    : "crumple"
                  : "thrown",
      sever =
        striker === "ball"
          ? SEVER.ball
          : striker === "shell"
            ? SEVER.shell
            : striker === "hand" && arm !== undefined && CUTS_OFF.has(arm)
              ? SEVER.edge
              : 0,
      can =
        sever > 0 &&
        place !== "trunk" &&
        anatomy.parts[place].length > 0 &&
        (place !== "head" || striker !== "shell"),
      lost: BlowLost | null =
        can && draw(t.id, 4) < sever * (place === "head" ? SEVER.head : 1)
          ? (place as BlowLost)
          : null,
      mark = markOf(striker, blow),
      a = striker === "arrow" || striker === "dart" ? arrowOf.get(t.id) : undefined,
      shaft =
        striker !== "arrow" && striker !== "dart"
          ? null
          : a
            ? (() => {
                // (Its flight's way, and its slope as it came down: view/battle.ts's arc.)
                const dx = a.to.x - a.from.x,
                  dz = a.to.z - a.from.z,
                  far = Math.hypot(dx, dz),
                  top = 2 + far * 0.22;
                return {
                  yaw: wrap(Math.atan2(dx, dz) - p.yaw),
                  dip: Math.atan((4 * top + 0.9) / Math.max(1, far)),
                };
              })()
            : {
                yaw: wrap(Math.PI + (draw(t.id, 5) - 0.5) * 0.6),
                dip: striker === "dart" ? 0.35 : 0.75,
              };
    hits.push({
      id: t.id,
      side: t.side,
      at: t.falls,
      striker,
      blow,
      place,
      u: (draw(t.id, 1) - 0.5) * 0.7,
      v: alongOf(anatomy, place, draw(t.id, 2)),
      face: rout ? -1 : 1,
      mark,
      size: SIZE[mark] * (0.8 + 0.4 * draw(t.id, 9)),
      lost,
      shattered: false,
      fall,
      lie:
        fall === "buckle"
          ? { x: p.x + Math.sin(p.yaw) * 0.55, z: p.z + Math.cos(p.yaw) * 0.55, back: false }
          : fall === "crumple"
            ? {
                x: p.x - Math.sin(p.yaw) * 0.15,
                z: p.z - Math.cos(p.yaw) * 0.15,
                back: draw(t.id, 17) < 0.5,
              }
            : fall === "blasted"
              ? (() => {
                  const far = 1.2 + 1.6 * draw(t.id, 14);
                  return {
                    x: p.x - Math.sin(p.yaw) * far,
                    z: p.z - Math.cos(p.yaw) * far,
                    back: true,
                  };
                })()
              : null,
      shaft,
      x: p.x,
      z: p.z,
      facing: p.yaw,
      back: null,
    });
  }
  // History's wounded who lived, side by side.
  const helps: BlowHelp[] = [],
    helpers = new Set<number>(),
    living: { hit: Building; t: Trooper }[] = [];
  for (const side of [0, 1] as const) {
    const { own, foe } = sidesOf(field, side),
      arm = foe.host?.arm,
      wounded = own.wounded ?? 0,
      h = field.hosts[side]!,
      standing = field.troopers.filter((t) => t.side === side && t.falls === null),
      n = hurtFigures(wounded, standing.length, field.per),
      // (Struck of those in the ranks, not a banner's bearer, a gun's team or one on a ladder;
      // where too few, of those too.)
      ranks = standing.filter((t) => !t.bearer && !t.gun && !climbers.has(t.id)),
      eligible = ranks.length >= n ? ranks : standing;
    if (!n) continue;
    // As the side's dead fell: so many to what the other side loosed, the rest in the press.
    const dead = field.troopers.filter((t) => t.side === side && t.falls !== null),
      nA = dead.filter((t) => t.by === "arrow").length,
      nB = dead.filter((t) => t.by === "blow").length,
      wA = nA + nB > 0 ? Math.round((n * nA) / (nA + nB)) : 0,
      wB = n - wA,
      continuous = armLook(arm).fire === "continuous",
      events: { at: number; arrow: boolean }[] = [];
    for (let k = 0; k < wA; k++)
      events.push({
        at: continuous
          ? MOMENTS.arrows +
            2 +
            (MOMENTS.rout - MOMENTS.arrows - 8) * Math.pow((k + 0.5) / wA, 1.15) +
            0.37
          : MOMENTS.arrows + 2 + (k % 9) * 3.2 + 0.15 * Math.floor(k / 9) + 0.07,
        arrow: true,
      });
    for (let k = 0; k < wB; k++)
      events.push({
        at:
          MOMENTS.melee +
          1.5 +
          (MOMENTS.rout - MOMENTS.melee - 3) * Math.pow((k + 0.5) / wB, 0.85) +
          0.23,
        arrow: false,
      });
    events.sort((p, q) => p.at - q.at || Number(q.arrow) - Number(p.arrow));
    // Who: at the line for a blow (the front of their file then), anyone for a shaft.
    const taken = new Set<number>(),
      picks: { t: Trooper; at: number; arrow: boolean }[] = [];
    events.forEach((e, j) => {
      const free = eligible.filter((t) => !taken.has(t.id) && (t.flees === null || e.at < t.flees));
      if (!free.length) return;
      const front = e.arrow ? [] : free.filter((t) => closedUp(field, t, e.at) < 0.6),
        pool = front.length ? front : free,
        t = pool[Math.floor(unit(key ^ WOUND_KEY, side * 65536 + j) * pool.length)]!;
      taken.add(t.id);
      picks.push({ t, at: e.at, arrow: e.arrow });
    });
    // The maimed among them: as many as history's maimed are of its wounded (or, unknown, the
    // share each blow maims: rules/wounds.ts's MAIM), the more likely the more their blow maims.
    const strikes = picks.map((p) => (p.arrow ? missileOf(arm) : ("hand" as Striker))),
      blows = strikes.map((st) => blowBy(st, arm)),
      many =
        own.maimed !== undefined
          ? Math.min(picks.length, Math.round((picks.length * own.maimed) / wounded))
          : Math.round(blows.reduce((m, b) => m + MAIM[b], 0)),
      ranked = picks
        .map((p, i) => ({ i, k: Math.pow(draw(p.t.id, 10), 1 / Math.max(1e-6, MAIM[blows[i]!])) }))
        .sort((a, b) => b.k - a.k || picks[a.i]!.t.id - picks[b.i]!.t.id),
      maimed = new Set(ranked.slice(0, many).map((r) => r.i));
    picks.forEach((pk, i) => {
      const t = pk.t,
        striker = strikes[i]!,
        blow = blows[i]!,
        hurt = maimed.has(i),
        edge = striker === "hand" && arm !== undefined && CUTS_OFF.has(arm),
        place = onFigure(
          anatomy,
          pick(placeWeights(hurt ? "maimed" : "wounded", striker, blow, edge), draw(t.id, 0)),
        ),
        cuts = hurt && edge && isLimb(place) && anatomy.parts[place].length > 0,
        mark = markOf(striker, blow),
        p = placeAt(field, t, pk.at),
        rear = side === 0 ? -1 : 1,
        mounted = h.mounted !== null,
        walls = !!field.ground.wall && side === 1,
        lost: BlowLost | null = cuts ? (place as BlowLost) : null,
        way: BackWay = mounted
          ? "slump"
          : !walls &&
              (lost === "leg-l" ||
                lost === "leg-r" ||
                (isLeg(place) && draw(t.id, 11) < BACK.legCrawl))
            ? "crawl"
            : !walls && draw(t.id, 16) < BACK.help
              ? "propped"
              : "limp",
        veer = (draw(t.id, 13) - 0.5) * 0.3,
        norm = Math.hypot(1, veer),
        dir = { x: rear / norm, z: veer / norm },
        from = { x: p.x + rear * 0.4, z: p.z },
        deep = Math.min(
          BACK.most,
          (h.ranks - Math.max(0, closedUp(field, t, pk.at))) * gapOf(h).rank + BACK.past,
        ),
        far = way === "crawl" ? Math.min(deep, BACK.crawlFar + 6 * draw(t.id, 14)) : deep,
        going = pk.at + STAGGER + KNEEL.least + (KNEEL.most - KNEEL.least) * draw(t.id, 12),
        pace = way === "crawl" ? BACK.crawl : way === "propped" ? BACK.propped : BACK.limp,
        hit: Building = {
          id: t.id,
          side,
          at: pk.at,
          striker,
          blow,
          place,
          u: (draw(t.id, 1) - 0.5) * 0.7,
          v: alongOf(anatomy, place, draw(t.id, 2)),
          face: 1,
          mark,
          size: SIZE[mark] * (0.8 + 0.4 * draw(t.id, 9)) * (hurt && !lost ? 2 : 1),
          lost,
          shattered: hurt && !lost,
          fall: null,
          lie: null,
          shaft:
            striker === "arrow" || striker === "dart"
              ? {
                  yaw: wrap(Math.PI + (draw(t.id, 5) - 0.5) * 0.6),
                  dip: striker === "dart" ? 0.35 : 0.75,
                }
              : null,
          x: p.x,
          z: p.z,
          facing: p.yaw,
          back: { way, going, there: going + far / pace, from, dir, far, helper: -1 },
        };
      hits.push(hit);
      living.push({ hit, t });
    });
    // Who helps the propped back: of their side, one standing behind them in their file or the
    // next, who never falls and is not wounded, back at their place before their side runs.
    for (const w of living) {
      if (w.hit.side !== side || w.hit.back!.way !== "propped") continue;
      const back = w.hit.back!,
        left = { x: back.dir.z, z: -back.dir.x },
        beside = (q: { x: number; z: number }) => ({
          x: q.x + left.x * 0.45,
          z: q.z + left.z * 0.45,
        }),
        cands = field.troopers
          .filter(
            (c) =>
              c.side === side &&
              c.falls === null &&
              !taken.has(c.id) &&
              !helpers.has(c.id) &&
              !c.bearer &&
              !c.gun &&
              !climbers.has(c.id) &&
              Math.abs(c.file - w.t.file) <= 1 &&
              c.rank > w.t.rank,
          )
          .sort(
            (a, b) =>
              Math.abs(a.file - w.t.file) - Math.abs(b.file - w.t.file) ||
              a.rank - b.rank ||
              a.id - b.id,
          );
      let found = false;
      for (const c of cands) {
        const start = w.hit.at + STAGGER,
          s0 = placeAt(field, c, start),
          to = beside(back.from),
          meet = start + Math.hypot(to.x - s0.x, to.z - s0.z) / BACK.walk,
          going = Math.max(back.going, meet + 0.4),
          there = going + back.far / BACK.propped,
          drop = beside({
            x: back.from.x + back.dir.x * back.far,
            z: back.from.z + back.dir.z * back.far,
          }),
          home0 = placeAt(field, c, there + 1),
          home = there + 1 + Math.hypot(home0.x - drop.x, home0.z - drop.z) / BACK.walk;
        if (c.flees !== null && home > c.flees - 1) continue;
        helpers.add(c.id);
        w.hit.back = { ...back, going, there, helper: c.id };
        helps.push({ id: c.id, hit: -1, start, from: { x: s0.x, z: s0.z }, meet, home });
        found = true;
        break;
      }
      if (!found) w.hit.back = { ...back, way: "limp", there: back.going + back.far / BACK.limp };
    }
  }
  // In the order struck; at most SEVER.most parts cut off a side (the rest shattered, or none).
  hits.sort((p, q) => p.at - q.at || p.id - q.id);
  const cut = [0, 0];
  for (const h of hits) {
    if (!h.lost) continue;
    if (cut[h.side]! >= SEVER.most) {
      h.shattered = h.back !== null;
      h.lost = null;
    } else cut[h.side]!++;
  }
  const of = field.troopers.map(() => -1);
  hits.forEach((h, i) => (of[h.id] = i));
  const helping = field.troopers.map(() => -1),
    helpList = helps.map((hp) => ({ ...hp, hit: hits.findIndex((h) => h.back?.helper === hp.id) }));
  helpList.forEach((hp, i) => (helping[hp.id] = i));
  // Where each part cut off flies and lies: back from the blow, turned a little either way.
  const loose: BlowLoose[] = [];
  hits.forEach((h, i) => {
    if (!h.lost) return;
    const how =
        h.striker === "ball" ? FLIGHT.ball : h.striker === "shell" ? FLIGHT.shell : FLIGHT.hand,
      rear = h.side === 0 ? -1 : 1,
      a = (draw(h.id, 6) - 0.5) * 1.6,
      u = draw(h.id, 7),
      dist =
        h.lost === "head"
          ? 0.6 + 0.9 * u
          : h.striker === "ball"
            ? 2 + 2 * u
            : h.striker === "shell"
              ? 1.5 + 2 * u
              : 0.5 + 0.7 * u;
    loose.push({
      hit: i,
      x: h.x + rear * Math.cos(a) * dist,
      z: h.z + Math.sin(a) * dist,
      yaw: draw(h.id, 8) * 2 * Math.PI,
      flight: how.flight,
      arc: how.arc,
      spin: how.turns * 2 * Math.PI * (draw(h.id, 15) < 0.5 ? -1 : 1),
    });
  });
  const count = (f: (h: BlowHit) => boolean): [number, number] => [
    hits.filter((h) => h.side === 0 && f(h)).length,
    hits.filter((h) => h.side === 1 && f(h)).length,
  ];
  return {
    hits,
    of,
    helps: helpList,
    helping,
    loose,
    dead: count((h) => h.back === null),
    hurt: count((h) => h.back !== null),
    maimed: count((h) => h.back !== null && (h.lost !== null || h.shattered)),
  };
}

/**
 * The battle at `base`'s moment with its blows (`base` is battleAt(field, s)): each one struck
 * posed by where they were struck and how they fell; history's wounded who lived reeling,
 * kneeling, going back and sitting, the ranks closing up behind them; those who help them; the
 * wounds on the struck, the shafts in them, the parts cut off where they lie; the blood — under
 * the fallen, along the ways the wounded went, under the parts cut off — as much as `gore` shows
 * (less: smaller, sparser, nothing cut off or thrown; none: none of it, the wounded still going
 * back).
 */
export function blowsAt(
  field: BattleField,
  b: Blows,
  base: BattleNow,
  gore: Gore = "full",
): BattleNow {
  const s = base.s,
    full = gore === "full",
    shown = gore !== "none",
    less = gore === "less" ? 0.6 : 1,
    troopers = base.troopers.slice(),
    blood: BattleNow["blood"][number][] = [],
    wounds: WoundNow[] = [],
    stuck: StuckNow[] = [],
    limbs: LimbNow[] = [],
    dust = base.dust.slice(),
    flashes = base.flashes.slice(),
    hurt: [number, number] = [0, 0];
  let up: Float64Array | null = null;
  for (let i = 0; i < b.hits.length; i++) {
    const h = b.hits[i]!;
    if (s < h.at) break;
    const t = field.troopers[h.id]!,
      was = troopers[h.id]!,
      since = s - h.at,
      lost = full ? h.lost : null;
    if (h.back) {
      hurt[h.side]++;
      troopers[h.id] = livingNow(field, h, t, was, s, lost);
      // (The ranks behind them close up into the place they left.)
      if (h.back.way !== "slump" && s >= h.back.going) {
        const k = smooth((s - h.back.going) / CLOSE),
          file = field.files[h.side]![t.file]!;
        let behind = false;
        for (const o of file) {
          if (o === t) behind = true;
          else if (behind) {
            up ??= new Float64Array(field.troopers.length);
            up[o.id] = up[o.id]! + k;
          }
        }
      }
    } else troopers[h.id] = fallenNow(field, h, t, was, s, lost);
    if (shown) {
      const grow = full ? smooth(since / BLEED.grow) : 1,
        now = troopers[h.id]!;
      // (The wound on the part struck; a part cut off has its raw end instead, below.)
      if (lost !== h.place)
        wounds.push({
          id: h.id,
          place: h.place,
          u: h.u,
          v: h.v,
          face: h.face,
          mark: h.mark,
          size: h.size * less,
          bleed: h.size * less * (full ? 1.2 + (h.back ? 0.6 : 1.2) * grow : 1.2),
          wet: full && since < BLEED.dry,
          age: since,
          spray: full && since < SPRAY.long ? SPRAY[h.striker] : 0,
        });
      // (A bullet through one who lies on their face: its way out on their back.)
      if (h.striker === "bullet" && !h.back && h.face === 1 && now.act === "fall" && !now.back)
        wounds.push({
          id: h.id,
          place: h.place,
          u: -h.u,
          v: h.v,
          face: -1,
          mark: "hole",
          size: h.size * less * 1.8 * smooth((since - 0.5) / 0.8),
          bleed: h.size * less * 2.6 * grow,
          wet: full && since < BLEED.dry,
          age: since,
          spray: 0,
        });
      if (lost)
        wounds.push({
          id: h.id,
          place: lost,
          u: 0,
          v: 0.5,
          face: 1,
          mark: "stump",
          size: 0.1,
          bleed: 0.1 * (1.2 + 0.8 * grow),
          wet: since < BLEED.dry,
          age: since,
          spray: since < SPRAY.pulse ? SPRAY.stump : 0,
        });
      if (h.shaft)
        stuck.push({
          id: h.id,
          place: h.place,
          u: h.u,
          v: h.v,
          yaw: h.shaft.yaw,
          dip: h.shaft.dip,
          dart: h.striker === "dart",
        });
      // The blood: under the fallen, or where the wounded knelt, along their way, where they sat.
      bleedOf(field, h, t, now, s, less, gore === "less", blood);
    }
    // A ball's dirt thrown up where it struck; a shell's burst.
    if (h.striker === "ball" && since < 0.8)
      for (let k = 0; k < 3; k++)
        dust.push({
          x: h.x + (k - 1) * 0.5,
          y: 0.3 + 1.4 * since,
          z: h.z + (k - 1) * 0.3,
          r: 0.5 + 1.2 * since,
        });
    if (h.striker === "shell" && since < 1.5) {
      if (since < 0.12) flashes.push({ x: h.x, y: 0.6, z: h.z, yaw: 0 });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * 2 * Math.PI;
        dust.push({
          x: h.x + Math.cos(a) * 1.2 * since,
          y: 0.4 + 2.2 * since,
          z: h.z + Math.sin(a) * 1.2 * since,
          r: 0.6 + 1.8 * since,
        });
      }
    }
  }
  // Those who help the wounded back.
  for (const hp of b.helps) {
    if (hp.hit < 0 || s < hp.start || s >= hp.home) continue;
    const w = b.hits[hp.hit]!;
    troopers[hp.id] = helperNow(field, hp, w, troopers[hp.id]!, troopers[w.id]!, s);
  }
  // The ranks closing up: each one behind a wounded one gone back steps up a rank for each (not
  // those struck, nor those who help: they keep their own places).
  if (up)
    for (let id = 0; id < up.length; id++) {
      const k = up[id]!,
        j = b.of[id]!;
      if (k <= 0 || b.helping[id]! >= 0 || (j >= 0 && s >= b.hits[j]!.at)) continue;
      const cur = troopers[id]!;
      if (!CLOSING.has(cur.act)) continue;
      const o = field.troopers[id]!,
        x = cur.x - (o.side === 0 ? -1 : 1) * gapOf(field.hosts[o.side]!).rank * k;
      troopers[id] = {
        ...cur,
        x,
        y: cur.y + standY(field, o.side, x, cur.z) - standY(field, o.side, cur.x, cur.z),
        act: cur.act === "brace" && closedUp(field, o, s) - k < 0.6 ? "fight" : cur.act,
      };
    }
  // (As much blood as is drawn: the parts cut off keep theirs.)
  if (blood.length > BLEED.most - 2 * SEVER.most) blood.length = BLEED.most - 2 * SEVER.most;
  // The parts cut off: flying, then lying in their own blood.
  if (full)
    for (const l of b.loose) {
      const h = b.hits[l.hit]!;
      if (s < h.at) continue;
      const f = Math.min(1, (s - h.at) / l.flight);
      limbs.push({
        id: h.id,
        side: h.side,
        lost: h.lost!,
        x: h.x + (l.x - h.x) * f,
        y: l.arc * 4 * f * (1 - f),
        z: h.z + (l.z - h.z) * f,
        yaw: l.yaw,
        pitch: Math.PI / 2 + l.spin * (f - 1),
      });
      if (f >= 1)
        blood.push({
          x: l.x,
          z: l.z,
          r: (0.22 + 0.12 * unit(h.id, 140)) * smooth((s - h.at - l.flight) / 3),
        });
    }
  return {
    ...base,
    troopers,
    blood,
    spray: [],
    dust,
    flashes,
    wounds,
    stuck,
    limbs,
    hurt,
  };
}

/** The marks of a blow on one struck: where, how long since, the part cut off (shown), how they went down. */
function marked(h: BlowHit, s: number, lost: BlowLost | null): Partial<TrooperNow> {
  return {
    hit: h.place,
    since: s - h.at,
    ...(lost ? { lost } : {}),
    ...(h.fall ? { fell: h.fall } : {}),
  };
}

/** One fallen now: as the battle has them, posed by how they went down and placed where it took them. */
function fallenNow(
  field: BattleField,
  h: BlowHit,
  t: Trooper,
  was: TrooperNow,
  s: number,
  lost: BlowLost | null,
): TrooperNow {
  const marks = marked(h, s, lost);
  if (!h.fall || !h.lie) return { ...was, ...marks };
  const since = s - h.at,
    f = smooth(since / FALL_LONG[h.fall]),
    x = h.x + (h.lie.x - h.x) * f,
    z = h.z + (h.lie.z - h.z) * f,
    lift = h.fall === "blasted" ? 0.9 * 4 * clamp01(since / 0.6) * (1 - clamp01(since / 0.6)) : 0;
  return {
    ...was,
    ...marks,
    x,
    y: standY(field, t.side, x, z) + lift,
    z,
    back: h.lie.back,
  };
}

/** One of the wounded who lived, now: reeling, kneeling, going back, sitting (or slumped in the saddle). */
function livingNow(
  field: BattleField,
  h: BlowHit,
  t: Trooper,
  was: TrooperNow,
  s: number,
  lost: BlowLost | null,
): TrooperNow {
  const back = h.back!,
    since = s - h.at,
    marks = marked(h, s, lost);
  if (back.way === "slump")
    return was.act === "flee" ? { ...was, ...marks } : { ...was, ...marks, act: "slump" };
  const rear = h.side === 0 ? -1 : 1;
  let x: number,
    z: number,
    yaw: number,
    act: Act,
    down = 0,
    crawl = 0,
    cycle = was.cycle;
  if (since < STAGGER) {
    x = h.x + rear * 0.4 * smooth(since / STAGGER);
    z = h.z;
    yaw = h.facing;
    act = "stagger";
  } else if (s < back.going) {
    x = back.from.x;
    z = back.from.z;
    yaw = h.facing;
    act = "kneel";
    down = smooth((since - STAGGER) / 0.4);
  } else {
    const pace =
        back.way === "crawl" ? BACK.crawl : back.way === "propped" ? BACK.propped : BACK.limp,
      gone = Math.min(back.far, pace * (s - back.going)),
      going = gone < back.far;
    x = back.from.x + back.dir.x * gone;
    z = back.from.z + back.dir.z * gone;
    yaw = Math.atan2(back.dir.x, back.dir.z);
    if (back.way === "crawl") {
      act = "fall";
      down = 1;
      crawl = going ? 1 : 0;
      cycle = s;
    } else if (going) {
      act = back.way === "propped" ? "propped" : "limp";
      cycle = s * 0.6 + t.u * 3;
    } else {
      act = "sit";
      down = 1;
      yaw = h.facing;
    }
  }
  const trench = field.ground.trench,
    sunk = trench && h.side === 1 && Math.abs(x - trench.x) <= trench.w ? trench.depth - 0.15 : 0;
  return {
    ...was,
    ...marks,
    x,
    y: standY(field, h.side, x, z) - sunk,
    z,
    yaw,
    act,
    cycle,
    down,
    back: false,
    crawl,
    size: Math.abs(x) > FIELD.x ? clamp01((FIELD.x + 10 - Math.abs(x)) / 10) : 1,
  };
}

/** One who helps a wounded one back, now: going to them, beside them on their left, then back to their place. */
function helperNow(
  field: BattleField,
  hp: BlowHelp,
  w: BlowHit,
  was: TrooperNow,
  wounded: TrooperNow,
  s: number,
): TrooperNow {
  const back = w.back!,
    t = field.troopers[hp.id]!,
    left = { x: back.dir.z, z: -back.dir.x },
    beside = (q: { x: number; z: number }) => ({ x: q.x + left.x * 0.45, z: q.z + left.z * 0.45 });
  let x: number, z: number, yaw: number, act: Act, cycle: number;
  if (s < hp.meet) {
    const to = beside(back.from),
      f = (s - hp.start) / Math.max(1e-6, hp.meet - hp.start);
    x = hp.from.x + (to.x - hp.from.x) * f;
    z = hp.from.z + (to.z - hp.from.z) * f;
    yaw = Math.atan2(to.x - hp.from.x, to.z - hp.from.z);
    act = "march";
    cycle = s * 1.6 + t.u * 3;
  } else if (s < back.there + 1) {
    const q = beside(s < back.going ? back.from : { x: wounded.x, z: wounded.z });
    x = q.x;
    z = q.z;
    yaw = Math.atan2(back.dir.x, back.dir.z);
    act = "help";
    cycle = wounded.cycle;
  } else {
    const drop = beside({
        x: back.from.x + back.dir.x * back.far,
        z: back.from.z + back.dir.z * back.far,
      }),
      home = placeAt(field, t, s),
      f = clamp01((s - back.there - 1) / Math.max(1e-6, hp.home - back.there - 1));
    x = drop.x + (home.x - drop.x) * f;
    z = drop.z + (home.z - drop.z) * f;
    yaw = Math.atan2(home.x - drop.x, home.z - drop.z);
    act = "march";
    cycle = s * 1.6 + t.u * 3;
  }
  return {
    ...was,
    x,
    y: standY(field, t.side, x, z),
    z,
    yaw,
    act,
    cycle,
    down: 0,
    back: false,
    crawl: 0,
  };
}

/**
 * The blood of one struck, now: under a fallen body (as the battle spreads it), a crawler's
 * trail; a wounded one's where they knelt, along their way, where they came to sit.
 */
function bleedOf(
  field: BattleField,
  h: BlowHit,
  t: Trooper,
  now: TrooperNow,
  s: number,
  k: number,
  sparse: boolean,
  out: BattleNow["blood"][number][],
): void {
  const since = s - h.at;
  if (!h.back) {
    if (since <= 0.3) return;
    const dur = crawlsFor(field, t);
    if (dur) {
      // (As the battle has its crawlers bleed: a lesser pool where they fell, a smear every so
      // far, a pool where they lie.)
      const p = placeAt(field, t, t.falls!),
        c = crawledTo(field, t, s, dur);
      out.push({ x: p.x, z: p.z, r: (0.45 + 0.4 * t.u) * smooth((since - 0.3) / 3) * k });
      for (let d = 0.9; d < c.gone; d += sparse ? 1.8 : 0.9)
        out.push({
          x: p.x + ((c.x - p.x) * d) / c.gone,
          z: p.z + ((c.z - p.z) * d) / c.gone,
          r: (0.26 + 0.12 * unit(t.id, 80 + Math.round(d * 10))) * k,
        });
      const still = s - (t.falls! + CRAWL.after + dur);
      if (still > 0) out.push({ x: c.x, z: c.z, r: (0.7 + 0.8 * t.u) * smooth(still / 4) * k });
      return;
    }
    const r =
      (0.75 + 0.85 * t.u) *
      smooth((since - 0.3) / 4) *
      (h.lost && !sparse ? 1.35 : 1) *
      (h.fall === "blasted" ? 1.25 : 1) *
      k;
    if (!h.lie) {
      const at = bloodAt(t, { x: h.x, z: h.z, yaw: h.facing });
      out.push({ x: at.x, z: at.z, r });
      return;
    }
    // (The body's middle: behind their feet on their back, before them on their face.)
    const along = h.lie.back ? -0.6 : 0.6;
    out.push({
      x: h.lie.x + Math.sin(now.yaw) * along,
      z: h.lie.z + Math.cos(now.yaw) * along,
      r,
    });
    return;
  }
  const back = h.back;
  if (back.way === "slump") return;
  if (since > STAGGER)
    out.push({ x: back.from.x, z: back.from.z, r: 0.28 * smooth((since - STAGGER) / 3) * k });
  if (s <= back.going) return;
  const pace =
      back.way === "crawl" ? BACK.crawl : back.way === "propped" ? BACK.propped : BACK.limp,
    gone = Math.min(back.far, pace * (s - back.going)),
    crawl = back.way === "crawl",
    step = crawl ? BLEED.crawlStep : BLEED.walkStep,
    drops = crawl ? BLEED.crawlDrops : BLEED.walkDrops;
  for (let j = 0; j < drops && (j + 0.5) * step < gone; j++) {
    if (sparse && j % 2) continue;
    const d = (j + 0.5) * step,
      u = unit(t.id, 120 + j);
    out.push({
      x: back.from.x + back.dir.x * d,
      z: back.from.z + back.dir.z * d,
      r: (crawl ? 0.18 + 0.1 * u : 0.1 + 0.08 * u) * k,
    });
  }
  if (gone >= back.far)
    out.push({
      x: back.from.x + back.dir.x * back.far,
      z: back.from.z + back.dir.z * back.far,
      r: 0.35 * smooth((s - back.there) / 5) * k,
    });
}

const PLACE_WORDS: Readonly<Record<BlowPlace, string>> = {
  head: "the head",
  trunk: "the body",
  "arm-l": "the left arm",
  "arm-r": "the right arm",
  "hand-l": "the left hand",
  "hand-r": "the right hand",
  "leg-l": "the left leg",
  "leg-r": "the right leg",
};
/** What a hand struck with, in words, by the arm (else by its blow). */
const PRESS_WORDS: Readonly<Record<string, string>> = {
  sword: "a sword",
  axe: "an axe",
  spear: "a spear",
  club: "a club",
  claws: "claws",
  mandibles: "jaws",
  tusks: "tusks",
  grapple: "a crushing grip",
  "shell-darts": "a dart",
};

/** Where on them, in words: a trunk struck in front, the chest or the belly by how high; behind, the back. */
function placeWords(h: BlowHit): string {
  if (h.place !== "trunk") return PLACE_WORDS[h.place];
  return h.face < 0 ? "the back" : h.v > 0.1 ? "the chest" : h.v < -0.15 ? "the belly" : "the body";
}

/** What struck one, in words. */
function strikerWords(field: BattleField, h: BlowHit): string {
  const foe = sidesOf(field, h.side).foe,
    arm = foe.host?.arm;
  switch (h.striker) {
    case "hand":
      return arm !== undefined && Object.hasOwn(PRESS_WORDS, arm)
        ? PRESS_WORDS[arm]!
        : h.blow === "point"
          ? "a bayonet"
          : h.blow === "edge"
            ? "a blade"
            : "a blow";
    case "arrow":
      return "an arrow";
    case "dart":
      return "a dart";
    case "ball":
      return "a cannon ball";
    case "shell":
      return "a shell";
    default:
      return shotBy(foe, h.id);
  }
}

/**
 * One who fought, told with their blow (the one followed): where they were struck and with what,
 * what was cut off, and what they are doing — reeling, down on one knee, going back, sitting
 * behind the lines; or helping one back. Null where no blow has touched them by `s` (the battle's
 * own words then: view/battle.ts's trooperWords).
 */
export function blowWords(field: BattleField, b: Blows, id: number, s: number): string | null {
  const who = trooperWho(field, id);
  if (!who) return null;
  const i = b.of[id] ?? -1,
    h = i >= 0 ? b.hits[i]! : null;
  if (h && s >= h.at) {
    const where = placeWords(h),
      what = strikerWords(field, h),
      their = (p: BlowLost) =>
        p === "head" ? "the head" : PLACE_WORDS[p].replace("the ", "their "),
      off = h.lost
        ? `, ${their(h.lost)} ${h.lost === "head" ? "struck off" : h.striker === "hand" ? "cut off" : "torn off"}`
        : h.shattered
          ? `, ${their(h.place as BlowLost)} shattered`
          : "";
    if (!h.back) {
      const t = field.troopers[id]!,
        crawls = crawlsFor(field, t);
      if (crawls && s < h.at + CRAWL.after + crawls)
        return `${who}: struck in ${where} by ${what}${off}, dragging themselves back toward their lines.`;
      if (h.striker === "ball" || h.striker === "shell")
        return `${who}: knocked off their feet by ${what}${off}.`;
      if (t.by === "rout")
        return `${who}: cut down as they ran, struck in ${where} by ${what}${off}.`;
      return h.striker === "hand"
        ? `${who}: fell in the press, struck in ${where} by ${what}${off}.`
        : `${who}: fell, ${what} in ${where}${off}.`;
    }
    const back = h.back,
      wound = `wounded in ${where} by ${what}${off}`;
    if (back.way === "slump") return `${who}: ${wound}, slumped over their mount.`;
    if (s < h.at + STAGGER) return `${who}: struck in ${where} by ${what}${off}, reeling.`;
    if (s < back.going) return `${who}: ${wound}, down on one knee.`;
    if (s < back.there)
      return `${who}: ${wound}, ${
        back.way === "crawl"
          ? "crawling back through the ranks"
          : back.way === "propped"
            ? "helped back through the ranks"
            : "limping back through the ranks"
      }.`;
    return `${who}: ${wound}, ${back.way === "crawl" ? "lying" : "sitting"} behind the lines.`;
  }
  const j = b.helping[id] ?? -1,
    hp = j >= 0 ? b.helps[j]! : null;
  if (hp && hp.hit >= 0 && s >= hp.start && s < hp.home) {
    const w = b.hits[hp.hit]!;
    return s < w.back!.there + 1
      ? `${who}: helping a wounded comrade back through the ranks.`
      : `${who}: going back to their place in the line.`;
  }
  return null;
}
