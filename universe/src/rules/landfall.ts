// A landing on a world of natives, by both sides' numbers (Phase 70, first slice; asked for 2026-11-04: "wars of
// like the people going to other planets and fighting the primitive aliens there with machines"). Who wins is no
// one's choice: no scripted defeat and no scripted upset. The fight at the hand is the fight of any war
// (rules/combat.ts, the terms sim/war/war.ts gives it: a host landing fights at 0.6, those who hold their ground at
// 1.5, walls at 1.25). What that formula cannot say is what comes before the hand, and left alone it says nonsense:
// a beam rifle against a stone spear comes out only 5.5 to 1 a head, where a host of magazine rifles killed about 500
// to 1 a head against spears at Omdurman (1898), because history's wars set like arms against like and its `advantage`
// is bounded. So one term is added ahead of it, by the same numbers `view/order.ts` reads: a host with no stand-off
// must cross its foe's fire to strike at all, and rate x time under fire x a hit share says what falls on the way.
//
// Checked against spears and guns as they went (all from memory, so estimates): Omdurman, 25,000 magazine rifles on
// 50,000, the spears broken crossing; Isandlwana, 1,300 rifles on 20,000, overrun; Shangani, 700 with machine guns
// on 5,000, the spears broken. tests/landfall.test.ts holds them. Every figure marked (est.) is a judgement. Pure.
import { dmath } from "../kernel/index.ts";
import { resolveCombat, type CombatFrame, type CombatSide } from "./combat.ts";
import { hostPower, performanceOf, type Part } from "./designs.ts";
import { beam, firearm, firepowerOf } from "./firearms.ts";
import { blowOf, fallenShare } from "./wounds.ts";

/** A host landing from the sea fights at this share of its strength; those on their own ground at this. As sim/war/war.ts. */
export const LANDED = 0.6,
  ON_THEIR_GROUND = 1.5,
  WALLED = 1.25;
/** The share of a ship's people who can be put in the field: the rest keep what keeps them alive (est.). */
export const FIGHTING_SHARE = 0.5;
/**
 * What a ship has to spend (tonnes, est.). A starship costs 8,000,000 machines; take a machine at a tonne of what
 * leaves. Two burns of a mass ratio of ten bring a hundredth of that across, half of it hull: 40,000 tonnes. A settler
 * eats a tonne of it a year, whatever is lost past recycling (est.); a made soldier with its cells and spares weighs
 * ten (est.). So a slow ship eats all of it, and the fast ones bring hundreds to thousands.
 */
export const SHIP_LOAD = 40_000,
  KEEP_TONNES = 1,
  MADE_TONNES = 10;
/** Of shots at a mass running at you, how many strike (est.; Omdurman comes out near one struck to a rifle, as it was). */
export const HIT = 0.1;
/** A run with a spear (m/s, est.): the same legs under a heavier pull go slower. */
export const RUN = 4;
/** How much of its fire a host keeps on a mass where the ground hides those coming: streets take most of it (est.). */
export const COVER: Readonly<Record<string, number>> = {
  camps: 1,
  villages: 0.7,
  towns: 0.4,
  cities: 0.25,
  works: 0.25,
};
/** The people's share within a season's walk of where a ship comes down, by how far word and food carry; and of those, who fight (est.). */
export const WITHIN: Readonly<Record<string, number>> = {
  camps: 0.5,
  villages: 0.2,
  towns: 0.1,
  cities: 0.05,
  works: 0.05,
};
export const NATIVE_FIGHTERS = 0.25;
/** A body that must fight sealed keeps this share of its strength, for it can only carry so much air and power; one of the water, this (est.). */
export const SEALED = 0.6,
  SEALED_WATER = 0.4;
/** What a host's fire falls short by: past this share struck on the way, a mass breaks before it arrives (combat.ts's own: 1 - 1.7 x loss under 0.34). */
export const CROSSING_BREAK = 0.39;
/** The most a first sickness takes of a people with no one who has met it; what a crowded people's own takes of those who come open-faced (est.). */
export const SICK_NEVER_MET = 0.33;
export const SICK_CROWDED: Readonly<Record<string, number>> = {
  camps: 0,
  villages: 0.05,
  towns: 0.1,
  cities: 0.2,
  works: 0.2,
};

/** What an arm looses: aimed rounds a minute, and how far it carries true (m). 0 for what strikes by the hand. */
export function looses(arm: string): { readonly rate: number; readonly range: number } {
  return firearm(arm) ?? beam(arm) ?? { rate: 0, range: 0 };
}

/** How far a host with this arm would fight across (m; 0: it must close). As view/order.ts: 0.4 of what it carries true, at most 200. */
export function standOff(arm: string): number {
  const off = Math.min(200, looses(arm).range * 0.4);
  return off < 10 ? 0 : off;
}

/** What a ship brings across (each of `ships`): its people's fighting share, and the made soldiers the crossing's keep leaves room for. */
export function shipForce(
  ships: number,
  colonists: number,
  years: number,
  madeSoldiers: boolean,
): { readonly flesh: number; readonly made: number } {
  const left = SHIP_LOAD - colonists * KEEP_TONNES * years;
  return {
    flesh: Math.round(ships * colonists * FIGHTING_SHARE),
    made: madeSoldiers ? Math.round(ships * Math.max(0, left / MADE_TONNES)) : 0,
  };
}

/** What a people's hands fight with at a stage, as a host's parts (`folkArms` tells the same in words). */
export function nativeHost(
  stage: string,
  body: { readonly manipulators: string; readonly dexterity: number },
  grip: number,
  keen: number,
  edge: boolean,
  charge: boolean,
): readonly Part[] {
  const armed = body.dexterity >= grip,
    natural =
      body.manipulators === "claws"
        ? "claws"
        : body.manipulators === "mandibles"
          ? "mandibles"
          : body.manipulators === "trunk"
            ? "tusks"
            : body.manipulators === "tentacles"
              ? "grapple"
              : "club",
    arm: Part = !armed
      ? { role: "arm", id: natural, material: natural === "club" ? "wood" : "body" }
      : stage === "works" && charge
        ? { role: "arm", id: "rifle", material: "iron" }
        : (stage === "cities" || stage === "works") && edge
          ? { role: "arm", id: "sword", material: "iron" }
          : { role: "arm", id: "spear", material: "stone", here: { edge: keen } };
  return [
    arm,
    { role: "guard", id: "bare", material: "hide" },
    { role: "mount", id: "foot", material: "hide" },
  ];
}

/** What the fight wants of those who came. */
export type ComerNumbers = {
  readonly flesh: number;
  readonly made: number;
  readonly parts: readonly Part[];
  /** Whether their flesh can draw this air; whether they are of the water. */
  readonly breathes: boolean;
  readonly water: boolean;
  /** Their home's pull. */
  readonly gravity: number;
  /** How strong a body of theirs is (affordances), and their wound care (0 … 1). */
  readonly strength: number;
  readonly care: number;
};
/** What the fight wants of those who met them. */
export type NativeNumbers = {
  readonly stage: string;
  /** How many of them there are in all, by the estimate of their world. */
  readonly people: number;
  readonly parts: readonly Part[];
  readonly gravity: number;
  readonly strength: number;
  readonly size: number;
  /** Whether a town's walls stand there. */
  readonly walls: boolean;
};
/** Three keyed draws for this landing, each in [0, 1): where it came down, and each side's sickness. */
export type LandfallDraws = {
  readonly where: number;
  readonly sickThere: number;
  readonly sickHome: number;
  readonly round: (round: number, side: number) => number;
};

export type LandfallTerm = { readonly name: string; readonly value: number; readonly words: string };

/** A landing, fought. */
export type LandfallFight = {
  /** Whether those who came won the ground. */
  readonly won: boolean;
  /** How it ended. */
  readonly how: "broke crossing" | "broke at the hand" | "overrun" | "held";
  /** Of those who came, in the field; of those who met them. */
  readonly fielded: readonly [number, number];
  readonly dead: readonly [number, number];
  /** How many of them were struck crossing the comers' fire; of those struck, the share who die of it. */
  readonly crossed: number;
  readonly killedShare: number;
  /** Of those who came and were struck, the share who die of it; how far across the fire the natives came before they broke (0 … 1). */
  readonly comerKilledShare: number;
  readonly brokeShare: number;
  /** How far apart the comers stand off (m), and whether the natives can stand off too. */
  readonly off: number;
  readonly nativeOff: number;
  /** Rounds a minute and metres, each side. */
  readonly fire: readonly [
    { readonly rate: number; readonly range: number },
    { readonly rate: number; readonly range: number },
  ];
  /** The fight's clock (combat.ts's), in its own seconds: its dead and morale. */
  readonly frames: readonly CombatFrame[];
  readonly rout: number | null;
  /** The share of their strength each side's numbers cut: to turn it, as a page says. */
  readonly terms: readonly LandfallTerm[];
};

const perCent = (x: number) => `${Math.round(x * 100)}%`;

/** A landing, by both sides' numbers: the same numbers and draws, always the same fight. */
export function landfallFight(
  c: ComerNumbers,
  n: NativeNumbers,
  sick: boolean,
  d: LandfallDraws,
): LandfallFight {
  const armC = c.parts.find((p) => p.role === "arm")!.id,
    armN = n.parts.find((p) => p.role === "arm")!.id,
    fireC = looses(armC),
    fireN = looses(armN),
    offC = standOff(armC),
    offN = standOff(armN),
    terms: LandfallTerm[] = [],
    within = WITHIN[n.stage] ?? 0.05;
  // Who can come: by where the ship came down, and how far their word carries.
  let meet = n.people * within * NATIVE_FIGHTERS * (0.5 + d.where),
    flesh = c.flesh;
  // A sickness crosses only where a life of the same liquid meets bare faces: those who come sealed, or made, carry none.
  const open = c.flesh > 0 && c.breathes,
    crosses = sick && open;
  if (crosses) {
    const there = SICK_NEVER_MET * d.sickThere,
      home = (SICK_CROWDED[n.stage] ?? 0) * d.sickHome * (1 - c.care);
    meet *= 1 - there;
    flesh *= 1 - home;
    terms.push({
      name: "sickness",
      value: there - home,
      words: `A sickness crossed before the fight: ${perCent(there)} of those who would have met them, ${perCent(home)} of the flesh who came.`,
    });
  }
  // The pull and the air are flesh's limits: a made soldier asks neither.
  const heavy = Math.min(1, c.gravity / Math.max(0.05, n.gravity)),
    air = c.breathes ? 1 : c.water ? SEALED_WATER : SEALED,
    fleshCut = heavy * air,
    fielded = Math.round(flesh + c.made),
    keep = fielded > 0 ? (flesh * fleshCut + c.made) / fielded : 0;
  if (heavy < 1)
    terms.push({
      name: "pull",
      value: heavy,
      words: `Their world's pull is ${(n.gravity / c.gravity).toFixed(1)} times home's: their flesh fights at ${perCent(heavy)}.`,
    });
  if (air < 1)
    terms.push({
      name: "air",
      value: air,
      words: `They cannot breathe there, so their flesh fights sealed, at ${perCent(air)}: what they carry is all they have.`,
    });
  const met = Math.round(meet);
  // The crossing: what falls between where the fire opens and the hand, if they must cross it at all.
  const run = Math.max(1.5, RUN / Math.sqrt(Math.max(0.3, n.gravity))),
    under = offN > 0 ? 0 : offC / run,
    tough = dmath.cbrt(n.size / 60),
    cover = COVER[n.stage] ?? 0.25,
    shots = (fireC.rate * under) / 60,
    wouldStrike = (fielded * keep * shots * HIT * cover) / tough,
    // (Past the break they turn, and are under fire as long again going back: twice the share they broke at, at most.)
    breaks = met === 0 || wouldStrike / met > CROSSING_BREAK,
    struck = Math.min(met, Math.round(breaks ? 2 * CROSSING_BREAK * met : wouldStrike));
  if (cover < 1)
    terms.push({
      name: "cover",
      value: cover,
      words: `Their ${n.stage} hide those who come on: only ${perCent(cover)} of the fire finds them.`,
    });
  if (tough > 1.1)
    terms.push({
      name: "bodies",
      value: tough,
      words: `Bodies of ${Math.round(n.size).toLocaleString("en")} kg take ${tough.toFixed(1)} times what a body of sixty does.`,
    });
  const doesC = performanceOf(c.parts),
    doesN = performanceOf(n.parts),
    careN = 0,
    sideC: CombatSide = {
      fielded,
      power: fielded * hostPower(c.parts) * c.strength * keep * LANDED,
      shock: doesC.shock ?? 0,
      protection: doesC.protection ?? 0,
      fire: firepowerOf(fireC),
      range: doesC.range ?? 0,
      care: c.care,
      blow: blowOf(armC),
    },
    arrive = Math.max(0, met - struck),
    sideN: CombatSide = {
      fielded: arrive,
      power:
        arrive * hostPower(n.parts) * n.strength * ON_THEIR_GROUND * (n.walls ? WALLED : 1),
      shock: doesN.shock ?? 0,
      protection: doesN.protection ?? 0,
      fire: fireN.rate ? firepowerOf(fireN) : 0,
      range: doesN.range ?? 0,
      care: careN,
      blow: blowOf(armN),
    },
    killsN = fallenShare({
      blow: sideC.blow,
      shock: sideC.shock,
      protection: sideN.protection,
      care: careN,
      size: n.size,
    }),
    deadCrossing = Math.round(struck * killsN),
    killsC = fallenShare({
      blow: sideN.blow,
      shock: sideN.shock,
      protection: sideC.protection,
      care: c.care,
      size: n.size,
    }),
    brokeShare = wouldStrike > 0 ? Math.min(1, (CROSSING_BREAK * met) / wouldStrike) : 1;
  // Broken before they arrive: no fight at the hand, and the comers hold the ground they stand on.
  if (breaks || arrive === 0) {
    return {
      won: true,
      how: "broke crossing",
      fielded: [fielded, met],
      dead: [0, deadCrossing],
      crossed: struck,
      killedShare: killsN,
      comerKilledShare: killsC,
      brokeShare,
      off: offC,
      nativeOff: offN,
      fire: [fireC, fireN],
      frames: [
        { at: 16, dead: [0, 0], morale: [1, 1], pressure: 0 },
        {
          at: 44,
          dead: [0, deadCrossing],
          morale: [1, Math.round(Math.max(0, 1 - CROSSING_BREAK * 1.7) * 1000) / 1000],
          pressure: 1,
        },
      ],
      rout: 44,
      terms,
    };
  }
  const fought = resolveCombat([sideC, sideN], n.size, d.round),
    // (The clock of the hand starts after the crossing: what crossing took is counted in from the first.)
    frames = fought.combat.frames.map((f) => ({
      ...f,
      dead: [f.dead[0], f.dead[1] + deadCrossing] as const,
    }));
  // Neither broke: those who came cannot take what they cannot finish. Those who live there hold it.
  const held = fought.combat.broken === -1;
  return {
    won: !held && fought.won,
    how: held ? "held" : fought.won ? "broke at the hand" : "overrun",
    fielded: [fielded, met],
    dead: [fought.dead[0], fought.dead[1] + deadCrossing],
    crossed: struck,
    killedShare: killsN,
    comerKilledShare: killsC,
    brokeShare,
    off: offC,
    nativeOff: offN,
    fire: [fireC, fireN],
    frames,
    rout: fought.combat.rout,
    terms,
  };
}
