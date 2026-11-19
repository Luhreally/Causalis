// A town's form's facts, read from what the world keeps (bridge/form.ts says what they make): how its people get about and
// what their body is, the first of its blocks laid since engines came to its land (read off its fabric's own years), its
// land's rain and warmth, whether it builds in stone, whether it holds a market, the realm seated in it. Nothing kept.
import { YEAR, type Ref, type World } from "../kernel/index.ts";
import { bodyFunction } from "../rules/index.ts";
import { homePlanet, loreOf, populationContext, type Fabric } from "../sim/index.ts";
import {
  BLOCK_LOTS,
  streetsLaid,
  townForm,
  type FormFacts,
  type StreetsLaid,
  type TownForm,
  type TownRank,
} from "../bridge/index.ts";
import { getAbout, machinesYear } from "./roads.ts";
import { kindOf } from "./kinds.ts";
import { landEra } from "./village.ts";

/**
 * The first block of a town laid since a year (-1: the year is not come): past every lot it had taken before then, as its
 * fabric's runs and buildings keep their years. A town founded since is laid so from its first block.
 */
export function laidSince(f: Fabric, year: number | null, now: number): number {
  if (year === null || year > now) return -1;
  let lots = 0;
  for (const c of f.changes) if (c[3] < year) lots = Math.max(lots, c[2]);
  for (const c of f.civics) if (c.start < year) lots = Math.max(lots, c.at + c.lots);
  return Math.ceil(Math.min(lots, f.next) / BLOCK_LOTS);
}

/** A town's form's facts (null: no such town). */
export function formFacts(
  world: World,
  ref: Ref,
  f: Fabric,
  rank: TownRank | null,
): FormFacts | null {
  const ctx = populationContext(world),
    s = ctx.settlements.get(ref);
  if (!s) return null;
  const g = homePlanet(world).generated,
    body = g.life.people?.body,
    about = getAbout(world, s.cell, landEra(world, s.cell)),
    water = body?.medium === "water",
    lore = loreOf(world),
    climate = ctx.generated.climate;
  return {
    how: about.how,
    share: about.share,
    mass: body?.size ?? 70,
    winged: !!body && !water && bodyFunction(body).stance === "winged",
    water,
    social: body?.social ?? 0.6,
    engines: laidSince(f, machinesYear(world, s.cell), Math.floor(world.now / YEAR)),
    rain: climate.precipitation[s.cell] ?? 0,
    warm: climate.temperature[s.cell] ?? 10,
    stone: !!lore.get(s.cell, "masonry"),
    market: f.civics.some((c) => c.kind === "market" && c.fell === null),
    seat: rank?.seat ? 1 + rank.seat.grade : 0,
    people: s.population,
    own: water || kindOf(world) !== "rocky",
  };
}

/** A town's form and how its streets were laid (null: no such town). */
export function townFormOf(
  world: World,
  ref: Ref,
  f: Fabric,
  rank: TownRank | null,
): { form: TownForm; laid: StreetsLaid[] | undefined } | null {
  const facts = formFacts(world, ref, f, rank);
  return facts ? { form: townForm(facts), laid: streetsLaid(facts) } : null;
}
