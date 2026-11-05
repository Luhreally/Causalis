// Order from fire (War past the line, W1; asked for 2026-11-05: "why do they line up medivially at
// the town still yk"). People stand apart until the ground their foe's fire makes deadly in a minute
// costs what they can bear, and no further than command reaches. One function of numbers, no era in
// it: what each side's arm looses (aimed rounds a minute, metres carried true: rules/firearms.ts,
// rules/means.ts), what a body bears, how far an order carries.
//
// Calibrated on Trevor Dupuy's ground to a soldier (Understanding War, 1986, p. 84), a whole force's
// rear included: about 10 m² in antiquity, 250 from 1650 to 1871, some 2,500 in 1914-18 (his table, from
// memory), 27,500 in 1939-45, some 50,000 at the Cold War's end. BEAR, READY, SPAN, the stand-off's share,
// the voice's reach and the muscle arms' figures below are estimates, fitted or judged, and marked so.
// Pure: the same numbers always give the same order.
import { WATER_ARMS, beam, firearm, firepowerOf, machined } from "../rules/index.ts";
import { armLook } from "./arms.ts";

/** What an arm looses: aimed rounds a minute, and how far it carries true (m). */
export type ArmFire = { readonly rate: number; readonly range: number };

/** How a host stands and comes on. */
export type HostOrder = {
  /** The ground one soldier holds (m²). */
  readonly area: number;
  /** How far apart they stand (m), that ground's square root. */
  readonly spacing: number;
  /** Shoulder to shoulder, to close by the hand: the line as it always stood. */
  readonly line: boolean;
  /** How many to a squad (1: no squads, a line). */
  readonly squad: number;
  /** Comes on by bounds: some down and firing while others rush. */
  readonly bounds: boolean;
  /** Seeks what stands between it and the fire. */
  readonly cover: boolean;
  /** How far from the foe it would fight (m; 0: it closes to the hand). */
  readonly standOff: number;
};

/** Antiquity's ground to a soldier (Dupuy, m²): 3.2 m apart, the line the town's hosts always stood in. */
export const LINE_AREA = 10;
/**
 * What a body bears: rounds-by-metres of fire a minute for each square metre it holds. Estimate, fitted
 * on one figure: the magazine rifle (15 × 500) at Dupuy's 2,500 m². The automatic then gives 36,000 m²,
 * between his 27,500 and 50,000, with nothing more fitted.
 */
export const BEAR = 3;
/** A made soldier spends a making, not a life: it bears this much more (estimate). It seeks no cover. */
export const MADE_BEAR = 12;
/** How far a voice carries an order (m, the plan's figure); a wire and a link past it (estimates). */
export const VOICE = 100,
  WIRE = 600,
  LINK = 3000;
/** The most one leader holds in a squad (estimate: Earth's sections run eight to twelve). */
export const SPAN = 8;
/** How much of what it carries true a host would fight across (estimate), and the most a town's ground has room for (m). */
const READY = 0.4,
  MOST_OFF = 200;
/** Under this a host has nothing to stand off with: it closes to the hand (m). */
const LEAST_OFF = 10;

/** What muscle looses (estimates; all of them under the line's mark, so none moves a host). */
const MUSCLE: Readonly<Record<string, ArmFire>> = {
  bow: { rate: 6, range: 150 },
  "horn-bow": { rate: 8, range: 200 },
  "shell-darts": { rate: 4, range: 30 },
};
/** What a hand arm reaches: a blow's. */
const HAND: ArmFire = { rate: 20, range: 2 };

/** What an arm looses, from the rules' own figures where they have them. */
export function armFire(arm: string | undefined): ArmFire {
  if (arm === undefined) return HAND;
  return (
    firearm(arm) ??
    beam(arm) ??
    (Object.hasOwn(WATER_ARMS, arm) ? WATER_ARMS[arm as keyof typeof WATER_ARMS] : undefined) ??
    (Object.hasOwn(MUSCLE, arm) ? MUSCLE[arm] : undefined) ??
    HAND
  );
}

/**
 * How far a host's orders carry, read from how fine what it bears is made: by hand, a voice; what is
 * machined at a works wants drawn brass, so a wire can be had; smokeless powder comes with current at
 * scale, so a link; burning light, or a host of made soldiers, a link. An estimate, for the town's view
 * alone: a war's sides do not say what their people know (W2's).
 */
export function commandOf(arm: string | undefined, made = false): number {
  if (made || (arm !== undefined && beam(arm))) return LINK;
  const gun = arm === undefined ? undefined : firearm(arm);
  if (!gun || !machined(gun)) return VOICE;
  return gun.powder === "smokeless" ? LINK : WIRE;
}

/**
 * A host's order, from the fire it stands against. It drills for fire like its own, so `fire` is the
 * greater of its foe's and its own: a host of machine guns does not bunch up because spears are all it
 * meets, and spears against machine guns come on apart. The line holds while a charge still gets home
 * (firepowerOf's own zero: the rifle's rounds-by-metres and under, twelve aimed rounds or fewer in the
 * crossing at a run); past that it breaks all at once, and each soldier holds what the fire costs.
 */
export function orderFrom(input: {
  readonly foe: ArmFire;
  readonly own: ArmFire;
  /** How far its orders carry (m). */
  readonly command: number;
  /** What a body of it bears (BEAR, or MADE_BEAR). */
  readonly bear?: number;
}): HostOrder {
  const bear = input.bear ?? BEAR,
    swept = Math.max(input.foe.rate * input.foe.range, input.own.rate * input.own.range),
    // (As a body of flesh would feel it: a made soldier stands closer for as long.)
    felt = (swept * BEAR) / bear,
    line = firepowerOf({ rate: felt, range: 1 }) <= 0;
  if (line)
    return {
      area: LINE_AREA,
      spacing: Math.sqrt(LINE_AREA),
      line,
      squad: 1,
      bounds: false,
      cover: false,
      standOff: 0,
    };
  const spacing = Math.min(Math.sqrt(swept / bear), input.command),
    flesh = bear <= BEAR,
    off = Math.min(MOST_OFF, input.own.range * READY);
  return {
    area: spacing * spacing,
    spacing,
    line,
    squad: Math.max(2, Math.min(SPAN, 1 + Math.floor(input.command / spacing))),
    bounds: flesh,
    cover: flesh,
    standOff: off < LEAST_OFF ? 0 : off,
  };
}

/** The order of a side of a war, against the other, by what their hosts bear. */
export function hostOrder(
  own: { readonly arm: string; readonly mount: string } | null | undefined,
  foe: { readonly arm: string } | null | undefined,
): HostOrder {
  const made = own?.mount === "machine-host";
  return orderFrom({
    foe: armFire(foe?.arm),
    own: armFire(own?.arm),
    command: commandOf(own?.arm, made),
    bear: made ? MADE_BEAR : BEAR,
  });
}

/** How a battle past the rifle is fought (W1b): who stands off and fires, who has nothing to answer with and closes, and how far apart (m). */
export type FireOrder = {
  /** Whether each side stands off and fights by fire (false: it comes on and closes to the hand). */
  readonly stands: readonly [boolean, boolean];
  /** How far from the foe the fight is joined: the lesser reach of those who stand off, for the other must come within it to answer (m). */
  readonly off: number;
};

/**
 * How a battle goes, from its two hosts' orders (null: as it always went, the hosts closing to the hand).
 * Two lines close. Past the line a host with a stand-off keeps it; one with none charges, whichever side it is.
 * At a seat's walls a host that must raise ladders to come at them closes, as one with nothing on the walls to
 * answer it has no need to stand off: there the moment makes it so. Numbers only; pure.
 */
export function fireOrder(
  attacker: { readonly arm: string; readonly mount: string } | null | undefined,
  defender: { readonly arm: string; readonly mount: string } | null | undefined,
  walls: boolean,
): FireOrder | null {
  const a = hostOrder(attacker, defender),
    d = hostOrder(defender, attacker);
  if (a.line && d.line) return null;
  const offA = a.line ? 0 : a.standOff,
    offD = d.line ? 0 : d.standOff;
  if (walls && (offA === 0 || offD === 0 || armLook(attacker?.arm).ladders)) return null;
  if (offA === 0 && offD === 0) return null;
  return {
    stands: [offA > 0, offD > 0],
    off: offA > 0 && offD > 0 ? Math.min(offA, offD) : Math.max(offA, offD),
  };
}

/** One of a host in its order on the ground, in metres from its forward edge's middle. */
export type OrderPlace = {
  /** Which squad. */
  readonly squad: number;
  /** Across the front (m). */
  readonly across: number;
  /** Back from its forward edge (m). */
  readonly depth: number;
  /** Bears the team's gun, where its arm has one. */
  readonly gun: boolean;
};

/** A squad's drawn figures stand this close, at most: legible at a phone's size (m). */
const WITHIN = 7;
/** A front is so much wider than it is deep. */
const WIDE = 1.15;

const clampDrawn = (squad: number) => Math.max(2, Math.min(5, Math.ceil(squad / 2)));

/**
 * The ground a host's drawn figures hold, at most (m²): a figure stands for many men and a town's ground
 * is a few hundred metres across. So the law sets the ground each figure holds, up to what the town has
 * room for, and the figures are squads staggered in depth: the law's own measure (ground to a soldier)
 * stays true where one thin line would run off both edges of the screen.
 */
export const MOST_GROUND = 100_000;

/**
 * Where each drawn figure of a host stands (`each` of them): squads of half a true squad, up to five,
 * staggered in depth, wider than deep, no deeper than `deepest` metres. `key` keys the scatter. Pure.
 */
export function orderPlaces(
  order: HostOrder,
  each: number,
  team: number | undefined,
  key: number,
  deepest: number,
): readonly OrderPlace[] {
  const drawn = clampDrawn(order.squad),
    squads = Math.max(1, Math.ceil(each / drawn)),
    area = Math.min(order.area, MOST_GROUND / Math.max(1, each)),
    pitch = Math.sqrt(drawn * area),
    within = Math.min(order.spacing, WITHIN),
    back = pitch / WIDE,
    // (As deep as it may be, then wider.)
    rows = Math.max(
      1,
      Math.min(Math.ceil(Math.sqrt(squads / WIDE)), Math.floor(deepest / back) + 1),
    ),
    cols = Math.ceil(squads / rows),
    across = pitch * WIDE,
    // (A gun for so many of its host: the first of every so many squads.)
    gunEvery = team !== undefined ? Math.max(1, Math.round(team / drawn)) : 0,
    out: OrderPlace[] = [];
  for (let i = 0; i < each; i++) {
    const squad = Math.floor(i / drawn),
      q = i % drawn,
      col = squad % cols,
      row = Math.floor(squad / cols),
      inRow = row === rows - 1 ? squads - row * cols : cols,
      j1 = scatter(squad, key + 11),
      j2 = scatter(squad, key + 23),
      // (Each row a half-pitch off the one before: no one stands behind another's fire.)
      x = (col - (inRow - 1) / 2 + (row % 2 ? 0.25 : -0.25)) * across + (j1 - 0.5) * pitch * 0.3,
      z = row * back + (j2 - 0.5) * pitch * 0.25,
      // (Its leader forward, the rest to either hand and a little back.)
      rank = Math.ceil(q / 2),
      hand = q % 2 ? -1 : 1;
    out.push({
      squad,
      across: x + hand * rank * within,
      depth: Math.max(0, z) + rank * within * 0.6,
      gun: gunEvery > 0 && q === 0 && squad % gunEvery === 0,
    });
  }
  return out;
}

/** How many of its host a figure's squad draws. */
export const drawnSquad = clampDrawn;

/** A keyed number in [0, 1). */
function scatter(a: number, b: number): number {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Whether a host's besiegers stand off and shell where they would once have raised ladders (the close field's own rule). */
export const shellsWalls = (arm: string | undefined): boolean =>
  armLook(arm).looses === "shot" && !armLook(arm).ladders;
