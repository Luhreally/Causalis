// A town's plan for the view (Phase 23 M149): its fabric as the bridge carries it — the family
// of its streets, its runs, its buildings, its walls — with the looks of the designs its homes
// stand in (the design of each run, the oldest in their own), how long each level takes to
// raise, and whether its streets are paved. Looked at, never lived.
import { hashString, yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import { HOME_MONTHS, roofPitch } from "../rules/index.ts";
import { citiesOf, designsOf, houseFor, populationContext, townsOf } from "../sim/index.ts";
import type { TownDesign, TownPlan, TownWater } from "../bridge/index.ts";

/**
 * The plan of a town's fabric, its streets running along `axis` (null: it has none yet), out to
 * `most` lots from its square (a great city's far lots are its sprawl, seen from afar), laid about
 * its `water`.
 */
export function townPlan(
  world: World,
  ref: Ref,
  axis: number,
  most = Infinity,
  water: TownWater | null = null,
): TownPlan | null {
  const f = townsOf(world).get(ref);
  if (!f) return null;
  const lots = Math.min(f.next, most);
  const ctx = populationContext(world),
    s = ctx.settlements.get(ref),
    cell = s?.cell ?? 0,
    land = ctx.provinces.get(cell),
    rain = ctx.generated.climate.precipitation[cell] ?? 0,
    // Every design its land has housed itself in, oldest first (each run is in one of them).
    realized = land
      ? designsOf(world)
          .list()
          .filter((d) => d.kind === "house" && d.owner === land.ref)
      : [],
    // (And every one since: a worn home is rebuilt in its land's design of the day.)
    sinces = [
      ...new Set([
        ...f.changes.filter((c) => c[0] <= 1).map((c) => c[6]),
        ...realized.map((d) => d.since),
      ]),
    ].sort((a, b) => a - b),
    designs: TownDesign[] = sinces.map((since) => {
      const parts = realized.find((d) => d.since === since)?.parts ?? houseFor(ctx, cell),
        part = (role: string) => parts.find((p) => p.role === role)?.id ?? "",
        roof = part("roof");
      return {
        since,
        walls: part("walls"),
        roof,
        form: part("form"),
        pitch: roofPitch(roof, rain),
      };
    });
  let year = 0;
  for (const c of f.changes) year = Math.max(year, c[4]);
  for (const c of f.civics) year = Math.max(year, c.start, c.fell ?? 0);
  return {
    family: f.family,
    seed: hashString(`town ${ref}`),
    axis,
    lots,
    whole: f.next,
    runs: f.changes
      .filter((c) => c[1] < lots)
      .map((c) => [...c.slice(0, 2), Math.min(c[2], lots), ...c.slice(3)]),
    civics: f.civics.filter((c) => c.at + c.lots <= lots).map((c) => ({ ...c })),
    walls:
      f.walls && f.walls.reach <= lots
        ? { start: f.walls.start, end: f.walls.end, reach: f.walls.reach }
        : null,
    months: HOME_MONTHS,
    designs,
    paved: !!citiesOf(world).get(ref)?.paved,
    water,
    year: Math.min(year, yearOfMoment(world.now)),
  };
}
