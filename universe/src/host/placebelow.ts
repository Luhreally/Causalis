// What lies below a town and the water it draws (town mode, O8): its land's soil over its rocks, each its share of its
// bedrock (inspect/ground.ts); what its lodes have given, how deep they are dug and whether they gave out (sim/economy
// lodes.ts, E1); its water at hand, a river, a lake or the sea beside it (sim/ecology watersOf, as its Build sheet asks a
// well by it), else the wells it has raised, else none, and the rain on its land. Read only, of its world.
import { YEAR, type World } from "../kernel/index.ts";
import { isProvinceWorld, worldChemistry } from "../gen/index.ts";
import { roleWord } from "../rules/index.ts";
import { homePlanet, knows, lodesOf, populationContext, townsOf, watersOf } from "../sim/index.ts";
import { PLACE_AT, placeBelowRef, placeLotRef, type PlaceInspectBelow } from "../bridge/index.ts";
import { groundLayers } from "./inspect/ground.ts";
import type { Place } from "./place.ts";

/** How deep a lode is dug, by its depth (rules/lodes.ts LODE.depths: as far as anyone can dig, then deeper, ...). */
const DEEP_WORDS = ["near the top", "deeper", "deep", "as deep as it goes"] as const;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** What lies below a town now and the water it draws (O8). */
export function placeBelow(world: World, place: Place): PlaceInspectBelow {
  const g = homePlanet(world).generated,
    cell = place.cell,
    year = Math.floor(place.t / YEAR),
    ctx = populationContext(world),
    undersea = ctx.medium === "water",
    layers = groundLayers(world, cell),
    chem = worldChemistry(g),
    lodes = (lodesOf(world)?.all() ?? [])
      .filter((l) => l.cell === cell && (l.dug > 0 || l.out !== null))
      .map((l) => {
        const name = roleWord(chem, l.kind),
          tier = Math.max(0, Math.min(3, l.tier));
        return {
          name,
          tier,
          out: l.out,
          words:
            l.out !== null
              ? `${cap(name)}: dug ${DEEP_WORDS[tier]}, and given out in the year ${l.out}`
              : `${cap(name)}: dug ${DEEP_WORDS[tier]}, and worked still`,
        };
      }),
    // (Its rain at its land's middle, on the fine grid its land's page reads: inspect/land.ts.)
    fine = isProvinceWorld(g) ? g.fine : g,
    spot = isProvinceWorld(g) ? (g.centre[cell] ?? -1) : cell,
    rain = spot >= 0 ? Math.round(fine.climate.precipitation[spot] ?? 0) : 0,
    water: PlaceInspectBelow["water"] = !watersOf(g, cell)
      ? null
      : g.water.river[cell]
        ? "river"
        : g.water.lake[cell]
          ? "lake"
          : "sea",
    wells =
      townsOf(world)
        .get(place.town)
        ?.civics.filter(
          (c) => c.kind === "well" && c.end <= year && (c.fell === null || c.fell > year),
        ).length ?? 0,
    piped = knows(ctx, cell, "electricity");
  const said = undersea
    ? "They live in the water: what is below them is the sea's bed, and the water they live in is all they drink."
    : water
      ? `Its water is at hand: ${water === "river" ? "a river runs through its land" : water === "lake" ? "a lake lies in its land" : "the sea is beside it, salt: they drink from the streams that come down to it and the rain they keep"}${wells ? `; and ${wells} ${wells === 1 ? "well" : "wells"} besides` : ""}.`
      : piped
        ? `No water is at hand on its land: its water comes by pipe${wells ? `, and ${wells} ${wells === 1 ? "well stands" : "wells stand"} from before` : ""}.`
        : wells
          ? `No water is at hand on its land: it draws from its ${wells} ${wells === 1 ? "well" : "wells"}.`
          : "No water is at hand on its land and no well is dug: it lives on the rain it keeps. A well may be asked for (Build).";
  return {
    kind: "below",
    ref: placeBelowRef(place.town),
    lotRef: placeLotRef(place.town, PLACE_AT.square),
    name: "Below the town",
    icon: "⛏️",
    soil: undersea ? "the sea's bed" : (layers?.soil ?? "its soil"),
    rocks: layers?.rocks ?? [],
    lodes,
    water: undersea ? null : water,
    wells,
    rain,
    undersea,
    words: `${said} ${rain} mm of rain a year fall on its land.`,
  };
}
