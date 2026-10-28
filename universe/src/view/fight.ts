// A soldier possessed, the view's part (Phase 61): the taking laid out from the battle fought before
// a town as it is drawn (view/placed.ts, view/battle.ts) — he and the nearest of those still standing
// about him (of each side its share, where the field stands more than his fight holds), where they
// stand, each as the roll names him; what each side looses and whether it rides; how many each side
// drew and had lost before now — and the battle drawn from his fight: those in it where the fight
// has them, struck where it struck them, lying where they fell; the rest of the field where the
// taking found them, holding their ground, or put to flight with their side once it breaks. The
// stick's bid turned from the town's ground onto the field's. Pure.
import type {
  BattleNear,
  BattleRoll,
  HeldBody,
  RollEntry,
  SoldierTakeArgs,
} from "../bridge/index.ts";
import {
  BLOW_PLACES,
  FIGHT_FLANK,
  FIGHT_GONE,
  FIGHT_MOST,
  FIGHT_PACE,
  type Blow,
  type HandBid,
} from "../rules/index.ts";
import { armLook } from "./arms.ts";
import {
  standY,
  type Act,
  type BattleField,
  type BattleNow,
  type BlowLost,
  type LimbNow,
  type TrooperNow,
  type WoundMark,
  type WoundNow,
} from "./battle.ts";
import type { PlacedFrame } from "./placed.ts";
import { BLEED, SPRAY } from "./blows.ts";
import { GORE_MOST, gorePieces, looseMotion, type GorePiece } from "./gore.ts";

/** Whether a figure still fights at a battle second: not fallen, not fled, drawn. */
function standing(field: BattleField, t: TrooperNow, s: number): boolean {
  const tr = field.troopers[t.id];
  return (
    !!tr &&
    t.size > 0 &&
    (tr.falls === null || tr.falls > s) &&
    (tr.flees === null || tr.flees > s) &&
    t.act !== "fall" &&
    t.act !== "flee"
  );
}

/**
 * Those about him his fight holds (FIGHT_MOST with him), of `near` (the others standing, the nearest
 * first): all, where there are no more; else the nearest of each side, as many as its share of those
 * standing (he counted in his side's) — so the fight is the battle in small, not his own ranks about
 * him against the few of the foe's front within reach. The nearest first still.
 */
export function fightShare<T extends { readonly side: 0 | 1 }>(
  near: readonly T[],
  side: 0 | 1,
): T[] {
  if (near.length <= FIGHT_MOST - 1) return [...near];
  const of = [0, 0];
  for (const t of near) of[t.side]!++;
  of[side]!++;
  const other = side === 0 ? 1 : 0,
    total = of[0]! + of[1]!;
  let mine = Math.max(1, Math.round((FIGHT_MOST * of[side]!) / total));
  if (FIGHT_MOST - mine > of[other]!) mine = FIGHT_MOST - of[other]!;
  mine = Math.min(mine, of[side]!);
  const want = [0, 0];
  want[side] = mine - 1;
  want[other] = FIGHT_MOST - mine;
  const taken = [0, 0],
    out: T[] = [];
  for (const t of near)
    if (taken[t.side]! < want[t.side]!) {
      taken[t.side]!++;
      out.push(t);
    }
  return out;
}

/**
 * The taking of one of the figures of a battle fought before a town (null: he does not stand to be
 * taken): the battle as drawn at second `s` (`now`, from view/battle.ts battleAt), its roll's names
 * by figure (view/placed.ts rollNames), the figures a side it was laid at.
 */
export function soldierTakeOf(
  near: BattleNear,
  field: BattleField,
  now: BattleNow,
  roll: BattleRoll,
  names: readonly (RollEntry | null)[],
  figure: number,
  s: number,
  most: number,
): SoldierTakeArgs | null {
  const me = now.troopers.find((t) => t.id === figure);
  if (!me || !standing(field, me, s)) return null;
  const others = fightShare(
      now.troopers
        .filter((t) => t.id !== figure && standing(field, t, s))
        .map((t) => ({ t, d: (t.x - me.x) * (t.x - me.x) + (t.z - me.z) * (t.z - me.z) }))
        .sort((a, b) => a.d - b.d || a.t.id - b.t.id)
        .map((x) => x.t),
      me.side,
    ),
    bodies: number[] = [],
    refs: string[] = [],
    names2: string[] = [];
  for (const t of [me, ...others]) {
    bodies.push(t.id, t.side, t.x, t.z, t.yaw, field.troopers[t.id]!.u);
    refs.push(names[t.id]?.ref ?? "");
    names2.push(names[t.id]?.name ?? "");
  }
  const before: [number, number] = [0, 0];
  for (const t of field.troopers) if (t.falls !== null && t.falls <= s) before[t.side]++;
  const e = names[figure],
    side = me.side,
    town =
      e && e.place >= 0
        ? ((side === 0 ? roll.attacker : roll.defender).towns[e.place]?.name ?? "")
        : "",
    looses = (k: 0 | 1) => armLook((k === 0 ? near.attacker : near.defender).host?.arm).looses;
  return {
    battle: near.event,
    most,
    per: field.per,
    meet: field.meet,
    figure,
    side,
    ref: e?.ref ?? "",
    name: e?.name || (side === 0 ? "one of the attackers" : "one of the defenders"),
    town,
    looses: [looses(0), looses(1)],
    mounted: [field.hosts[0].mounted !== null, field.hosts[1].mounted !== null],
    figures: [field.hosts[0].n, field.hosts[1].n],
    before: [Math.min(before[0], field.hosts[0].n), Math.min(before[1], field.hosts[1].n)],
    bodies,
    refs,
    names: names2,
  };
}

/** A bid as the stick gave it on the town's ground, turned onto the field's (its x toward the defenders, z across). */
export function fieldBid(frame: PlacedFrame, bid: HandBid): HandBid {
  const mx = bid.mx * frame.ux + bid.mz * frame.uz,
    mz = -bid.mx * frame.uz + bid.mz * frame.ux;
  return { ...bid, mx: Math.round(mx), mz: Math.round(mz) };
}

/** What each doing of the fight is drawn as. */
const ACT_OF: Readonly<Record<string, Act>> = {
  stand: "stand",
  come: "march",
  fight: "fight",
  parry: "brace",
  loose: "loose",
  rally: "cheer",
  flee: "flee",
  chase: "run",
  down: "kneel",
  dead: "fall",
  gone: "flee",
};
/** A wound's look by the blow that made it. */
const MARK_OF: Readonly<Record<Blow, WoundMark> & Record<string, WoundMark | undefined>> = {
  edge: "cut",
  point: "stab",
  shot: "hole",
  blunt: "bruise",
  crush: "smash",
  fire: "bruise",
};

/**
 * The battle drawn from a soldier's fight at battle second `s`: `base` the battle as drawn when he was
 * taken (at second `from`), `bodies` the fight's now (their figures, where, doing what, struck where),
 * `broke` the side broken (-1: none) and the battle second it broke at, `blows` each side's blow
 * (rules/blows.ts Blow, for its wounds' look). Those not in the fight stand where the taking found
 * them, or fly off the field with their side once it breaks; those fallen before it lie as they lay.
 */
export function heldFightNow(
  field: BattleField,
  base: BattleNow,
  bodies: readonly HeldBody[],
  broke: -1 | 0 | 1,
  brokeAt: number,
  s: number,
  blows: readonly [string, string],
): BattleNow {
  const by = new Map<number, HeldBody>();
  for (const b of bodies) by.set(b.id, b);
  const wounds: WoundNow[] = [],
    limbs: LimbNow[] = [],
    gibs: GorePiece[] = [],
    blood: { x: number; z: number; r: number }[] = [...base.blood],
    standingN: [number, number] = [0, 0],
    fallenN: [number, number] = [0, 0],
    since = Math.max(0, s - brokeAt);
  const troopers = base.troopers.map((t): TrooperNow => {
    const b = by.get(t.id);
    if (!b) {
      const lying = t.act === "fall" || t.down > 0.5;
      if (lying) fallenN[t.side]++;
      else standingN[t.side]++;
      // (Not in his fight: holding where the taking found them, or in flight once their side breaks.)
      if (lying || broke !== t.side || brokeAt < 0) return t;
      const run = FIGHT_PACE.flee * since,
        out = t.side === 1 && field.placed,
        x = out ? t.x : t.x + (t.side === 0 ? -run : run),
        z = out ? t.z + (t.z < 0 ? -run : run) : t.z,
        gone = Math.abs(x) > FIGHT_GONE || (out && Math.abs(z) > FIGHT_FLANK);
      return {
        ...t,
        x,
        z,
        y: standY(field, t.side, x, z),
        yaw: out ? (t.z < 0 ? Math.PI : 0) : t.side === 0 ? -Math.PI / 2 : Math.PI / 2,
        act: "flee",
        cycle: s + t.id * 0.37,
        size: gone ? 0 : t.size,
      };
    }
    const dead = b.doing === "dead",
      down = dead || b.doing === "down",
      speed = Math.hypot(b.vx, b.vz),
      act: Act =
        b.doing === "come" && speed > 2.6
          ? "run"
          : b.doing === "stand" && t.side === 1
            ? "brace"
            : (ACT_OF[b.doing] ?? "stand"),
      place = b.struck >= 0 ? BLOW_PLACES[b.struck] : undefined,
      lost =
        b.lost >= 0 && BLOW_PLACES[b.lost] !== "trunk"
          ? (BLOW_PLACES[b.lost] as BlowLost)
          : undefined;
    if (down) fallenN[t.side]++;
    else standingN[t.side]++;
    const age = Math.max(0, b.struckAt === undefined ? 1 : s - b.struckAt);
    if (place)
      wounds.push({
        id: t.id,
        place,
        u: ((t.id * 37) % 7) / 10 - 0.3,
        v: ((t.id * 53) % 7) / 10 - 0.3,
        face: 1,
        mark: lost ? "stump" : (MARK_OF[blows[t.side === 0 ? 1 : 0]] ?? "cut"),
        size: lost ? 0.12 : 0.09,
        bleed: dead ? 0.24 : 0.14,
        wet: age < BLEED.dry,
        age,
        spray: lost && age < SPRAY.pulse ? SPRAY.stump : age < SPRAY.long ? SPRAY.hand : 0,
      });
    if (lost)
      limbs.push({
        id: t.id,
        side: t.side,
        lost,
        ...looseMotion(
          b.x,
          b.z,
          b.x + 0.9 * Math.sin(b.yaw + 1.2),
          b.z + 0.9 * Math.cos(b.yaw + 1.2),
          age,
          0.42,
          0.65,
          b.yaw + 1.2,
          Math.PI * 2,
        ),
      });
    if (lost) gorePieces(t.id, b.x, b.z, age, false, gibs);
    if (dead || lost) blood.push({ x: b.x, z: b.z, r: Math.min(1, age / 4) * (lost ? 1.1 : 0.85) });
    const gone = b.doing === "gone";
    // (One shape for all, every field in TrooperNow's order: view/battle.ts.)
    return {
      id: t.id,
      side: t.side,
      x: b.x,
      y: standY(field, t.side, b.x, b.z),
      z: b.z,
      yaw: b.yaw,
      act,
      cycle: s * (act === "run" || act === "flee" ? 1.6 : 1) + t.id * 0.37,
      down: dead ? 1 : 0,
      back: dead && t.id % 2 === 0,
      size: gone ? 0 : t.size,
      bearer: t.bearer,
      crawl: 0,
      gun: t.gun,
      hit: place,
      since: place ? age : undefined,
      lost,
      fell: dead ? "crumple" : undefined,
    };
  });
  return {
    ...base,
    s,
    troopers,
    flying: [],
    spray: [],
    smoke: [],
    flashes: [],
    dust: [],
    blood: blood.slice(-BLEED.most),
    standing: standingN,
    fallen: fallenN,
    words: "",
    wounds: [...(base.wounds ?? []).filter((w) => !by.has(w.id)), ...wounds],
    limbs: [...(base.limbs ?? []).filter((l) => !by.has(l.id)), ...limbs],
    gibs: [...(base.gibs ?? []), ...gibs].slice(-GORE_MOST),
    stuck: (base.stuck ?? []).filter((w) => !by.has(w.id)),
  };
}

/**
 * A battle the god fought once it is over (view/placed.ts fallenNow, by what each did, not by the
 * plan history laid): those struck dead lying where they fell, in their blood, with what was cut off
 * them; the living gone from the field.
 */
export function foughtLying(now: BattleNow): BattleNow {
  const lying = new Set(now.troopers.filter((t) => t.act === "fall").map((t) => t.id));
  return {
    ...now,
    troopers: now.troopers.map((t) => (lying.has(t.id) ? t : { ...t, size: 0 })),
    flying: [],
    spray: [],
    smoke: [],
    flashes: [],
    cannon: [],
    dust: [],
    ...(now.wounds ? { wounds: now.wounds.filter((w) => lying.has(w.id)) } : {}),
    ...(now.stuck ? { stuck: now.stuck.filter((w) => lying.has(w.id)) } : {}),
    ...(now.limbs ? { limbs: now.limbs.filter((l) => lying.has(l.id)) } : {}),
    ...(now.gibs ? { gibs: now.gibs.filter((p) => lying.has(p.id)) } : {}),
  };
}

/** Its fallen borne in from the field, so far as `share` (0 … 1: view/battleday.ts borneShare) has them, each by its own lot. */
export function foughtBorne(now: BattleNow, share: number): BattleNow {
  if (share <= 0) return now;
  const gone = (id: number) => share >= 1 || ((id * 2654435761) >>> 0) / 4294967296 < share,
    borne = new Set(now.troopers.filter((t) => t.size > 0 && gone(t.id)).map((t) => t.id));
  if (!borne.size) return now;
  return {
    ...now,
    troopers: now.troopers.map((t) => (borne.has(t.id) ? { ...t, size: 0 } : t)),
    ...(now.limbs ? { limbs: now.limbs.filter((l) => !borne.has(l.id)) } : {}),
    ...(now.gibs ? { gibs: now.gibs.filter((p) => !borne.has(p.id)) } : {}),
    ...(now.wounds ? { wounds: now.wounds.filter((w) => !borne.has(w.id)) } : {}),
    ...(now.stuck ? { stuck: now.stuck.filter((w) => !borne.has(w.id)) } : {}),
  };
}

/** The battle second a moment of the world's is at, for a soldier taken at `from` (a world moment) at battle second `second`. */
export function fightSecondOf(t: number, from: number, second: number): number {
  return second + (t - from) / 60;
}

/** The fight's step a moment of the world's is at (twenty to a battle second, a minute of the world's). */
export function fightStepOf(t: number, from: number): number {
  return Math.max(0, Math.floor(((t - from) / 60) * 20));
}

/** How one of a battle the god fought came out of his fight, on his card and as he is followed. */
export const HAND_FATE_WORDS: Readonly<Record<"fell" | "wounded" | "stood", string>> = {
  fell: "fell in the fight the god fought",
  wounded: "struck down in the fight the god fought",
  stood: "came through the fight the god fought",
};
