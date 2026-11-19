// A town's form's facts, read from what the world keeps (bridge/form.ts says what they make): how its people get about and
// what their body is, the first of its blocks laid since engines came to its land (read off its fabric's own years), its
// land's rain and warmth, whether it builds in stone, whether it holds a market, the realm seated in it. Nothing kept.
import { YEAR, type Ref, type World } from "../kernel/index.ts";
import { bodyFunction } from "../rules/index.ts";
import { homePlanet, loreOf, populationContext, type Fabric } from "../sim/index.ts";
import {
  streetsLaid,
  walkBlocks,
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
 * The first block of a town laid for engines (-1: they are not come to its land). A town founded since they came is laid for
 * them from its first block. One that stood before keeps the lanes it was walked in as far out as a household walks
 * (bridge/form.ts walkBlocks): past that only engines make ground worth holding, so what stands there was laid for them.
 * Both are read off what never changes (the year it was founded, the year engines came, its people's body), so no block
 * moves as the years go: a fabric's runs lose their first years as its homes are rebuilt, and cannot say where it had got
 * to when engines came (read so, a third of first light's towns moved between years 1,000 and 1,500).
 */
export function laidForEngines(
  founded: number,
  year: number | null,
  now: number,
  mass: number,
): number {
  if (year === null || year > now) return -1;
  return founded >= year ? 0 : walkBlocks(mass);
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
    engines: laidForEngines(
      s.founded,
      machinesYear(world, s.cell),
      Math.floor(world.now / YEAR),
      body?.size ?? 70,
    ),
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
