// What arms and blasts sound by (asked for 2026-11-12: "add synthetic sfx for the missles and new firearms ... all the
// other stuff"): each read off its own physics, never off its name. A gun by its ball's energy and speed (a crack where it
// outruns sound) and its powder; a cannon and a burst by their charge, as a blast scales, with the cube root of its energy; a
// bow by its draw; a blade's ring by the speed of sound in its metal and how little that metal damps it; a shield or armour
// by what it is made of. And the battle's sounds by its own clock: what fires, looses, strikes and bursts in a stretch of
// its seconds, where. Pure: the same battle in the same stretch sounds the same. app/sound.ts plays what this says.
import { DROP_KG, ROCKET_LOAD_KG, ballOf, energyAt, firearm } from "../rules/index.ts";
import { armLook } from "./arms.ts";
import { BATTLE_LENGTH, MOMENTS, routAt, type BattleField, type BattleNow } from "./battle.ts";
import type { Blows } from "./blows.ts";

/** The kinds of sound an arm or a blast makes. */
export type HeardKind =
  | "gun"
  | "cannon"
  | "bow"
  | "dart"
  | "clash"
  | "thud"
  | "zap"
  | "rocket"
  | "whistle"
  | "blast";

/** The numbers a sound is made from (each kind reads those it needs; the rest unset). */
export type Voicing = {
  /** What it throws or brings: a ball's energy at the muzzle, a bow's at the arrow (J). */
  readonly joules?: number;
  /** How fast what it throws goes (m/s). */
  readonly speed?: number;
  /** Its bore (mm). */
  readonly bore?: number;
  /** Driven by black powder (a duller boom, and its fizz). */
  readonly black?: boolean;
  /** Rounds in one burst, and how far apart (s). */
  readonly rounds?: number;
  readonly apart?: number;
  /** A struck thing's ring (Hz) and how long it rings (s). */
  readonly ring?: number;
  readonly decay?: number;
  /** Rings of mail, struck: many small rings at once. */
  readonly mail?: boolean;
  /** A blast's energy (MJ). */
  readonly mj?: number;
  /** How long it is heard coming before it arrives (s of its own clock: a falling load, a rocket's way down). */
  readonly coming?: number;
  /** A beam's own pitch (Hz). */
  readonly hz?: number;
};

/** The speed of sound in Earth's air at 15 °C (m/s). */
export const SOUND_SPEED = 343;

/**
 * What a material is like to strike (est, handbook figures): its stiffness (GPa), its density (kg/m³) and its loss factor (the
 * share of its ringing it loses each turn). Sound runs through it at the root of stiffness over density; a blade's ring goes with
 * that speed; it rings for as long as its loss lets it.
 */
const STRUCK: Readonly<Record<string, readonly [gpa: number, kgM3: number, loss: number]>> = {
  wood: [11, 600, 0.012],
  reed: [6, 400, 0.02],
  hide: [0.3, 900, 0.1],
  stone: [70, 2500, 0.004],
  copper: [117, 8960, 0.002],
  bronze: [110, 8800, 0.0003],
  iron: [190, 7700, 0.0015],
  steel: [205, 7850, 0.0004],
  machined: [205, 7850, 0.0004],
  coral: [40, 2600, 0.01],
  shell: [50, 2700, 0.008],
  body: [2.5, 1300, 0.04],
  ice: [9, 917, 0.006],
  crystal: [150, 3500, 0.0002],
  "set edge": [70, 2600, 0.004],
  wound: [60, 1800, 0.01],
  "wound works": [60, 1800, 0.01],
  "pitch grit": [5, 1600, 0.05],
  "sulfur concrete": [25, 2300, 0.01],
};
/** A blade's ring against the speed of sound in its metal: a sword's (est: a struck steel blade's strongest ring, some 3 kHz). */
const RING_PER_SPEED = 0.62;

/** How a material rings when struck: its ring (Hz) and how long it lasts (s); unknown stuff as wood. */
export function ringOf(stuff: string | undefined, size = 1): { ring: number; decay: number } {
  const [gpa, kg, loss] = (stuff && Object.hasOwn(STRUCK, stuff) ? STRUCK[stuff] : null) ?? STRUCK.wood!,
    speed = Math.sqrt((gpa * 1e9) / kg),
    ring = Math.max(260, Math.min(6000, (RING_PER_SPEED * speed) / size));
  return { ring, decay: Math.max(0.025, Math.min(1.6, 1 / (Math.PI * ring * loss))) };
}

/** A bow's draw (est: a self bow's arrow at 45 m/s, 40 J; one of horn and sinew stores more for its length, 58 m/s, 55 J). */
const BOWS: Readonly<Record<string, readonly [speed: number, joules: number]>> = {
  bow: [45, 40],
  "horn-bow": [58, 55],
};
/** A team gun's burst: how far apart its rounds come (s; est, Earth's belt-fed guns at some 600 a minute). */
const BURST_APART = 0.09;
/** A field gun's ball (est: a six-pounder, 2.7 kg at 440 m/s, 93 mm), and one of smokeless powder (a 75 mm gun's 6.5 kg shell at 500 m/s). */
const FIELD_GUN = { black: [2.7, 440, 93], smokeless: [6.5, 500, 75] } as const;
/** What a shell bursts with (kg of ordinary charge; est, a 75 mm shell's), and what a kilogram of it holds (MJ: gun cotton). */
const SHELL_KG = 0.7,
  ORDINARY_MJ = 4.2;
/** What an armoured car carries for its gun, going up when it is knocked out (MJ; est). */
const CAR_GOES_MJ = 4;

/** What one firing of an arm sounds like, by its physics (null: it looses nothing). */
export function looseVoice(arm: string | undefined): { kind: HeardKind; v: Voicing } | null {
  const look = armLook(arm);
  if (look.looses === "none" || arm === undefined) return null;
  if (look.beam)
    return {
      kind: "zap",
      // (A beam's own pitch: higher as its light is bluer; a blow of sound, low.)
      v: { hz: look.fighter.includes("sound") ? 210 : 900 + 1400 * look.beam[2] },
    };
  if (look.looses === "arrows") {
    const b = Object.hasOwn(BOWS, arm) ? BOWS[arm]! : BOWS.bow!;
    return { kind: "bow", v: { speed: b[0], joules: b[1] } };
  }
  if (look.looses === "darts") return { kind: "dart", v: { speed: 60, joules: 30 } };
  const f = firearm(arm),
    ball = ballOf(arm);
  if (!f || !ball) return { kind: "gun", v: { joules: 2500, speed: 400, bore: 15, black: true } };
  return {
    kind: "gun",
    v: {
      joules: ball.joules,
      speed: ball.speed,
      bore: ball.bore,
      black: f.powder === "black",
      ...(look.burst > 1 ? { rounds: look.burst, apart: BURST_APART } : {}),
    },
  };
}

/** A field gun's firing: of black powder where its host's guns are, else of the smokeless. */
export function cannonVoice(black: boolean): Voicing {
  const [kg, speed, bore] = black ? FIELD_GUN.black : FIELD_GUN.smokeless;
  return { joules: 0.5 * kg * speed * speed, speed, bore, black };
}

/** A blade's or a club's blow, struck home: its ring by its stuff (a club is thick: a knock). */
export function strikeVoice(arm: string | undefined, stuff: string | undefined): Voicing {
  const blunt = arm === "club" || arm === "grapple" || arm === "tusks";
  return ringOf(stuff ?? (blunt ? "wood" : "bronze"), blunt ? 3 : 1);
}

/** What a blow lands on: a shield or armour by its stuff; mail as many small rings; nothing worn, a body. */
export function guardVoice(guard: string | undefined, stuff: string | undefined): Voicing {
  if (!guard || guard === "bare" || guard === "swimming") return { ...ringOf("body", 2) };
  const plate = guard === "plate" || guard === "driven-plate" || guard === "shell-plates";
  return {
    ...ringOf(stuff ?? (guard === "shield" ? "wood" : "hide"), plate ? 2.2 : 1.6),
    ...(guard === "mail" ? { mail: true } : {}),
  };
}

/** A blast, by its energy (MJ): a shell's, a dropped load's, a rocket's, by the charge each carries. */
export const BLASTS = {
  shell: SHELL_KG * ORDINARY_MJ,
  load: energyAt(DROP_KG, ORDINARY_MJ),
  rocket: energyAt(ROCKET_LOAD_KG, ORDINARY_MJ),
  car: CAR_GOES_MJ,
} as const;

/** One sound of a battle: what makes it, by what, when (battle s) and where (field m). */
export type BattleSound = {
  readonly kind: HeardKind;
  readonly v: Voicing;
  readonly t: number;
  readonly x: number;
  readonly z: number;
  /** An armoured car's (its id): where it is is read off the battle as it is drawn. */
  readonly car?: number;
};

type Side = { readonly arm?: string; readonly guard?: string; readonly stuff?: string; readonly guardStuff?: string };
/** A battle's timeline, read once: everything that sounds, in the order it sounds. */
const TIMELINES = new WeakMap<BattleField, readonly BattleSound[]>();

function timelineOf(field: BattleField, blows: Blows | null, sides: readonly [Side, Side]): readonly BattleSound[] {
  const out: BattleSound[] = [],
    near = field.near,
    voice = [0, 1].map((s) => {
      const side = sides[s]!,
        arm = side.arm ?? (s === 0 ? near.attacker : near.defender).host?.arm,
        look = armLook(arm);
      return {
        loose: looseVoice(arm),
        // (Beside a team's gun, the rest of its host fire what they bear.)
        rest: look.team !== undefined ? looseVoice(look.rest) : null,
        team: look.team ?? 0,
        strike: strikeVoice(arm, side.stuff),
        black: firearm(look.rest ?? arm ?? "")?.powder !== "smokeless",
      };
    });
  field.arrows.forEach((a, i) => {
    const sv = voice[a.side]!;
    let l =
      a.shot || sv.loose?.kind === "bow" || sv.loose?.kind === "dart"
        ? sv.loose
        : looseVoice("bow");
    // (One figure in so many of a team gun's host is at its gun.)
    if (a.shot && sv.team && sv.rest && (i * 2654435761) % sv.team !== 0) l = sv.rest;
    if (l) out.push({ kind: l.kind, v: l.v, t: a.at, x: a.from.x, z: a.from.z });
  });
  for (const c of field.cannon)
    for (const f of c.fires)
      out.push({ kind: "cannon", v: cannonVoice(voice[c.side]!.black), t: f, x: c.x, z: c.z });
  for (const b of field.fire?.bursts ?? [])
    out.push({ kind: "blast", v: { mj: BLASTS.shell }, t: b.at, x: b.x, z: b.z });
  // Each blow struck home by the hand: the striker's arm on what the struck one wears.
  for (const h of blows?.hits ?? []) {
    if (h.striker !== "hand") continue;
    const by = voice[h.side === 0 ? 1 : 0]!,
      worn = sides[h.side]!,
      guard = worn.guard ?? (h.side === 0 ? near.attacker : near.defender).host?.guard;
    out.push({ kind: "clash", v: by.strike, t: h.at, x: h.x, z: h.z });
    out.push({ kind: "thud", v: guardVoice(guard, worn.guardStuff), t: h.at + 0.02, x: h.x, z: h.z });
  }
  // The armoured cars' guns: a burst of five every 1.6 s from the arrows to the rout while they run (view/battle.ts
  // vehicleNow); knocked out, what they carry goes up.
  const rout = routAt(field),
    car = looseVoice("automatic")!.v;
  for (const v of field.vehicles ?? []) {
    const first = MOMENTS.arrows + v.u * 1.6,
      last = Math.min(v.knocked ?? BATTLE_LENGTH, rout);
    for (let t = first; t < last; t += 1.6)
      out.push({ kind: "gun", v: { ...car, rounds: 5, apart: 0.1 }, t, x: 0, z: 0, car: v.id });
    if (v.knocked !== null)
      out.push({ kind: "blast", v: { mj: BLASTS.car }, t: v.knocked, x: 0, z: 0, car: v.id });
  }
  out.sort((p, q) => p.t - q.t);
  return out;
}

/**
 * What sounds in a battle from `from` to `to` (its seconds; `from` not included), each where it is: a car's where it is
 * now (`now`). `sides`: what each host's arm and guard are made of, where told.
 */
export function battleSounds(
  field: BattleField,
  blows: Blows | null,
  from: number,
  to: number,
  now: BattleNow | null,
  sides: readonly [Side, Side] = [{}, {}],
  out: BattleSound[] = [],
): BattleSound[] {
  out.length = 0;
  let line = TIMELINES.get(field);
  if (!line) TIMELINES.set(field, (line = timelineOf(field, blows, sides)));
  let lo = 0,
    hi = line.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (line[mid]!.t <= from) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < line.length && line[i]!.t <= to; i++) {
    const e = line[i]!;
    if (e.car === undefined) out.push(e);
    else {
      // (A car's: where it is now.)
      const c = now?.vehicles?.find((v) => v.id === e.car);
      if (c) out.push({ ...e, x: c.x, z: c.z });
    }
  }
  return out;
}

/** How many of a host are at hand-to-hand now (0 … 1 of those standing): what the field's clash of iron is. */
export function meleeShare(now: BattleNow): number {
  let up = 0,
    fighting = 0;
  for (const t of now.troopers)
    if (t.down < 0.5 && t.size > 0.3) {
      up++;
      if (t.act === "fight") fighting++;
    }
  return up ? fighting / up : 0;
}
