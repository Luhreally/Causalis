// A battle seen near (Phase 37 M183): what history says of one battle, for the eye to watch it
// fought — its hosts as they were in the field (how many each had, how many fell, what they
// fought with), who won and what came of it (the field, a siege laid, a land taken, a seat
// stormed), and the ground it was fought on: the land as it is now, its hills, its river, the
// seat's walls and the town behind them. Looked at, never lived.
import type { Ref, World } from "../kernel/index.ts";
import { BIOME } from "../gen/index.ts";
import {
  RISEN_KEPT,
  WAR_EVENTS,
  handOf,
  homePlanet,
  hostFor,
  loreOf,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
  wildsOf,
  type War,
} from "../sim/index.ts";
import { hostWords } from "./chain.ts";
import type { BattleNear, BattleOutcome, BattleSideNear } from "../bridge/index.ts";
import { hostDesign, kindsOf, realmArms } from "./arms.ts";
import { realmColor } from "./colors.ts";
import { levyPlaces } from "./fallen.ts";
import { peopleFigure } from "./folk.ts";
import { worldLook } from "./biochem.ts";
import { CIVIL_SHORT } from "./inspect/strife.ts";
import { landTitle } from "./inspect/names.ts";

/** How a land of now is drawn near, by its ground (as a camp's is). */
function lookOf(biome: number): string {
  switch (biome) {
    case BIOME.ice:
    case BIOME.tundra:
    case BIOME.alpine:
    case BIOME.borealForest:
      return "icehouse";
    case BIOME.tropicalRainforest:
    case BIOME.temperateRainforest:
      return "hothouse";
    case BIOME.hotDesert:
    case BIOME.coldDesert:
      return "dry";
    default:
      return "quiet";
  }
}

type Rgb = readonly [number, number, number];

/** Colours a host may be drawn in where its realm's is too like its foe's (or the grass's). */
const STRONG: readonly Rgb[] = [
  [0.82, 0.16, 0.12],
  [0.14, 0.32, 0.86],
  [0.95, 0.78, 0.16],
  [0.94, 0.94, 0.9],
  [0.13, 0.13, 0.15],
  [0.92, 0.48, 0.1],
  [0.1, 0.62, 0.66],
];
const GRASS: Rgb = [0.3, 0.55, 0.2];

const apart = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * The two hosts' colours on the field: each its realm's, unless the two are too alike to be told
 * apart (or one is the grass's own), when the defenders are drawn in the strong colour farthest
 * from the attackers' and the ground's.
 */
export function sideColors(a: Rgb, d: Rgb): [Rgb, Rgb] {
  const att =
    apart(a, GRASS) < 0.22
      ? STRONG.reduce((p, c) => (apart(c, GRASS) > apart(p, GRASS) ? c : p))
      : a;
  if (apart(att, d) >= 0.42 && apart(d, GRASS) >= 0.22) return [att, d];
  const score = (c: Rgb) => Math.min(apart(c, att), apart(c, GRASS) * 1.4);
  return [att, STRONG.reduce((p, c) => (score(c) > score(p) ? c : p))];
}

/** What history did at a moment, from the first thing done then (events are kept in time's order). */
function atMoment(world: World, t: number) {
  const all = world.events.all();
  let lo = 0,
    hi = all.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (all[mid]!.t < t) lo = mid + 1;
    else hi = mid;
  }
  const out = [];
  for (let i = lo; i < all.length && all[i]!.t === t; i++) out.push(all[i]!);
  return out;
}

/**
 * What a battle of history won: nothing (the defenders held), the field, a siege laid about a
 * seat, a land taken, a seat stormed — the land taken told by the taking it caused.
 */
export function battleOutcome(world: World, b: War["battles"][number]): BattleOutcome {
  const e = world.events.get(b.event),
    seat = b.seat ?? false,
    taken =
      !!e &&
      atMoment(world, e.t).some(
        (x) => x.type === WAR_EVENTS.taken.type && x.causes.some((c) => c.ref === b.event),
      );
  return !b.won ? "held" : taken ? (seat ? "stormed" : "taken") : seat ? "siege" : "field";
}

/** A side's men as a battle seen near counts them (Phase 55 M225). */
export type SideCounts = {
  /** Its men in the field: its host and the men who rose with it. */
  readonly fielded: number;
  readonly host: number;
  readonly risen: number;
  readonly fallen: number;
  /** Of its men, the wounded who lived, and of them the maimed (absent in older saves). */
  readonly wounded?: number;
  readonly maimed?: number;
};

/** A battle's counts as seen near — the field's and the roll's one source (Phase 55 M225). */
export function nearCounts(b: War["battles"][number]): {
  readonly won: boolean;
  readonly attacker: SideCounts;
  readonly defender: SideCounts;
} {
  // (A battle of an older save knew not how many were in the field: as many as fell, ten times.)
  const hosts: readonly [number, number] = b.fielded ?? [
      Math.max(b.fallen[0] * 10, 20),
      Math.max(b.fallen[1] * 10, 20),
    ],
    side = (at: 0 | 1): SideCounts => {
      const host = hosts[at],
        fallen = b.fallen[at],
        // (Where more fell than its host had in the field, the men who rose with it are counted
        // with it, a remnant of them all left standing.)
        risen = fallen > host * RISEN_KEPT ? Math.ceil(fallen / RISEN_KEPT) - host : 0;
      return {
        fielded: host + risen,
        host,
        risen,
        fallen,
        ...(b.wounded ? { wounded: b.wounded[at], maimed: b.maimed?.[at] ?? 0 } : {}),
      };
    };
  return { won: b.won, attacker: side(0), defender: side(1) };
}

export function battleNear(world: World, ref: string): BattleNear | null {
  const e = world.events.get(ref as Ref);
  if (!e || e.type !== WAR_EVENTS.battle.type) return null;
  // (A battle the god fought is told as history had it before him, and laid as it was when he
  // was taken: Phase 61.)
  const war = warsOf(world).get(e.subjects[0]!),
    fought = handOf(world).foughtOf(ref),
    b = fought?.was ?? war?.battles.find((x) => x.event === ref);
  if (!war || !b) return null;
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    realms = politiesOf(world),
    lore = loreOf(world),
    data = e.data as { a?: string; b?: string },
    colors = sideColors(realmColor(war.attacker), realmColor(war.defender)),
    // (Its hosts as they were in the field, with the men who rose with them: as the roll counts them.)
    counts = nearCounts(b),
    side = (realm: Ref, said: string | undefined, c: SideCounts, color: Rgb, at: 0 | 1) => {
      const r = realms.get(realm),
        // (Armed as it was that day: the design it fought by, M217.)
        parts =
          hostDesign(world, realm, { year: b.year, design: b.designs?.[at] })?.parts ??
          (r ? hostFor(ctx, r).parts : null);
      return {
        ref: realm,
        name: said ?? (r ? realmName(r) : "a fallen realm"),
        color: [color[0], color[1], color[2]] as [number, number, number],
        arms: realmArms(world, realm),
        fielded: c.fielded,
        fallen: c.fallen,
        ...(c.risen ? { risen: c.risen } : {}),
        // (Of its men, the wounded who lived and the maimed; where they came from: M224.)
        ...(c.wounded !== undefined ? { wounded: c.wounded, maimed: c.maimed ?? 0 } : {}),
        ...(b.fell ? { levy: levyPlaces(world, b, at) } : {}),
        host: parts ? kindsOf(parts) : null,
        kit: parts ? hostWords(world, realm, parts) : "spears, on foot",
        ...(b.armed ? { armed: b.armed[at] } : {}),
        // (Cannon where its seat knew powder by the battle's year, not by now — Phase 53 M219.)
        ...(r && (lore.get(r.seat, "gunpowder")?.year ?? Infinity) <= b.year
          ? { cannon: true }
          : {}),
      } satisfies BattleSideNear;
    },
    land = b.land,
    seat = b.seat ?? false,
    outcome = battleOutcome(world, b),
    town = seat ? (ctx.settlements.inProvince(land)[0]?.name ?? null) : null,
    wilds = wildsOf(ctx, land);
  return {
    event: ref,
    war: war.ref,
    title: `The battle at ${landTitle(world, land, true)}`,
    cell: land,
    land: landTitle(world, land),
    year: b.year,
    attacker: side(war.attacker, data.a, counts.attacker, colors[0], 0),
    defender: side(war.defender, data.b, counts.defender, colors[1], 1),
    won: b.won,
    outcome,
    ...(b.tip ? { tip: true } : {}),
    civil: war.civil ? CIVIL_SHORT[war.civil] : null,
    hills: g.tectonics.elevation[land]! > 600,
    river: !!g.water.river[land],
    // (A seat stands behind its palisade, or its stone walls where its people build them.)
    walls: seat ? (lore.effect(land, "walls") > 0 && lore.get(land, "masonry") ? 2 : 1) : 0,
    town,
    figure: peopleFigure(g),
    plan: {
      seed: `${world.seed.text} battle ${ref}`,
      ages: [
        {
          index: 0,
          from: 0,
          to: 0,
          kind: lookOf(g.climate.biome[land] ?? -1),
          seaLevel: 0,
          warmth: 0,
          forests: wilds.firstForest * wilds.forest >= 0.25,
        },
      ],
      // (No beast stays on a field where hosts meet.)
      lineages: [],
      // (Its life's colours: Phase 57.)
      ...worldLook(world),
    },
    ...(fought
      ? {
          hand: {
            name: fought.name,
            figure: fought.figure,
            side: fought.side,
            most: fought.most,
            from: fought.from,
            won: (war.battles.find((x) => x.event === ref)?.won ?? b.won) === (fought.side === 0),
          },
        }
      : {}),
  };
}
