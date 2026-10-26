// A battle seen near (Phase 37 M183): what history says of one battle, for the eye to watch it
// fought — its hosts as they were in the field (how many each had, how many fell, what they
// fought with), who won and what came of it (the field, a siege laid, a land taken, a seat
// stormed), and the ground it was fought on: the land as it is now, its hills, its river, the
// seat's walls and the town behind them. Looked at, never lived.
import type { Ref, World } from "../kernel/index.ts";
import { BIOME } from "../gen/index.ts";
import {
  WAR_EVENTS,
  designsOf,
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
import { hostKinds, realmArms } from "./arms.ts";
import { realmColor } from "./colors.ts";
import { peopleFigure } from "./folk.ts";
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
/** The most of those in the field that fall: a remnant is left standing (the rest risen with it). */
const KEPT = 0.9;

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

export function battleNear(world: World, ref: string): BattleNear | null {
  const e = world.events.get(ref as Ref);
  if (!e || e.type !== WAR_EVENTS.battle.type) return null;
  const war = warsOf(world).get(e.subjects[0]!),
    b = war?.battles.find((x) => x.event === ref);
  if (!war || !b) return null;
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    realms = politiesOf(world),
    lore = loreOf(world),
    data = e.data as { a?: string; b?: string },
    colors = sideColors(realmColor(war.attacker), realmColor(war.defender)),
    side = (realm: Ref, said: string | undefined, host: number, fallen: number, color: Rgb) => {
      const r = realms.get(realm),
        // (Where more fell than its host had in the field, the men who rose with it are counted
        // with it, a remnant of them all left standing.)
        risen = fallen > host * KEPT ? Math.ceil(fallen / KEPT) - host : 0,
        parts = designsOf(world).of(realm)?.parts ?? (r ? hostFor(ctx, r).parts : null);
      return {
        ref: realm,
        name: said ?? (r ? realmName(r) : "a fallen realm"),
        color: [color[0], color[1], color[2]] as [number, number, number],
        arms: realmArms(world, realm),
        fielded: host + risen,
        fallen,
        ...(risen ? { risen } : {}),
        host: parts
          ? (hostKinds(world, realm) ?? {
              arm: parts.find((p) => p.role === "arm")?.id ?? "",
              guard: parts.find((p) => p.role === "guard")?.id ?? "",
              mount: parts.find((p) => p.role === "mount")?.id ?? "",
            })
          : null,
        kit: parts ? hostWords(world, realm, parts) : "spears, on foot",
        ...(r && lore.get(r.seat, "gunpowder") ? { cannon: true } : {}),
      } satisfies BattleSideNear;
    },
    // (A battle of an older save knew not how many were in the field: as many as fell, ten times.)
    fielded = b.fielded ?? [Math.max(b.fallen[0] * 10, 20), Math.max(b.fallen[1] * 10, 20)],
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
    attacker: side(war.attacker, data.a, fielded[0], b.fallen[0], colors[0]),
    defender: side(war.defender, data.b, fielded[1], b.fallen[1], colors[1]),
    won: b.won,
    outcome,
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
    },
  };
}
