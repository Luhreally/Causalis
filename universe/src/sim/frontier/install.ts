// The Frontier (the galaxy's hazards and the far future), taught to a world in one call: the home star's weather, the
// great stones, the galaxy's fire, the works in the sky, bodies written for a world, and minds past their makers.
import type { World } from "../../kernel/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { installWeather } from "./weather.ts";
import { installImpacts } from "./impacts.ts";
import { installGalactic } from "./galactic.ts";
import { installOrbital } from "./orbital.ts";
import { installWritten } from "./written.ts";
import { installMinds } from "./minds.ts";

export function installFrontier(world: World, ctx: () => PopulationContext): void {
  installWeather(world, ctx);
  installImpacts(world, ctx);
  installGalactic(world, ctx);
  installMinds(world, ctx);
  installOrbital(world, ctx);
  installWritten(world, ctx);
}
