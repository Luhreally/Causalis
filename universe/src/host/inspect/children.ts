// How many children a land's people bear, and why (rules/children.ts, sim/population/systems.ts transition): what a mother's
// body could bear, how many of them live to bear their own, how many living they want, and what makes each cost to raise.
// Pure readings, made when a page is read.
import type { World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import {
  CHILDREN,
  bearingHeld,
  bearingOf,
  childrenWanted,
  girlsOf,
  livingToBear,
} from "../../rules/index.ts";
import {
  bearersSent,
  familySizeOf,
  landDemography,
  machineShare,
  populationContext,
  raisingCost,
  readersOf,
  slowDeaths,
  transition,
} from "../../sim/index.ts";
import { share, stat, yearNow } from "./words.ts";

const one = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

/** A land's children, for its People tab (nothing where no one lives). */
export function childrenBlock(world: World, cell: number): Block | null {
  const ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p?.total()) return null;
  const life = ctx.life,
    could = bearingOf(life).born,
    kept = transition(ctx, cell),
    live = livingToBear(life, slowDeaths(ctx, cell)),
    wanted = childrenWanted(raisingCost(ctx, cell), 0, girlsOf(life)),
    dem = landDemography(ctx, cell),
    born = ctx.history.birthsIn(cell, yearNow(world) - 1),
    rows: Stat[] = [
      stat("A mother bears", `${one(could * kept)} at plenty, of the ${one(could)} her body could`),
      stat("Living to bear their own", share(live)),
      stat("Living children they want", `${one(wanted)} (${one(1 / girlsOf(life))} replace them)`),
      stat(
        "Born",
        `${share(girlsOf(life))} who will bear, as many as are even when grown where two raise the young (more of the sex whose young die the more)`,
      ),
      stat(
        "A hearth",
        `${one(familySizeOf(world))} mouths, by how they pair and how many young they raise`,
      ),
      stat("Schooled before they work", share(readersOf(world, cell))),
      stat("Work engines do", share(machineShare(ctx, cell))),
      stat("Born last year", `${one((1000 * born) / p.total())} in a thousand`),
      stat(
        "Mothers held by their young",
        `${share(Math.min(1, bearingHeld(ctx.generated.life.people?.body, life)))} of the years they bear`,
      ),
      stat("Mothers sent to war", share(bearersSent(ctx))),
    ];
  if (dem) {
    if (dem.mated < 0.995)
      rows.push(
        stat(
          "Short of mates",
          `${one(dem.sires)} grown sires to a mother: ${share(1 - dem.mated)} fewer born`,
        ),
      );
    rows.push(stat("Taken to their land", share(dem.adapted)));
    if (Math.abs(dem.stature) >= 0.1)
      rows.push(
        stat(
          "Their stature",
          `${one(Math.abs(dem.stature))} of a spread ${dem.stature > 0 ? "larger" : "smaller"} than their people as made: a ${dem.stature > 0 ? "colder" : "warmer"} land's bodies, as far as they have taken to it`,
        ),
      );
    if (dem.heights > 1.005)
      rows.push(stat("The thin air of the heights", `${share(dem.heights - 1)} more deaths`));
    if (dem.long < 0.995)
      rows.push(
        stat(
          "Their old live longer",
          `${share(1 - dem.long)} fewer of the old die, by what they know of the body`,
        ),
      );
  }
  return { type: "facts", title: "Children", rows };
}
