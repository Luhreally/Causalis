// A town's plan for the view (Phase 23 M149): its fabric as the bridge carries it — the family
// of its streets, its runs, its buildings, its walls — with the looks of the designs its homes
// stand in (the design of each run, the oldest in their own), how long each level takes to
// raise, and whether its streets are paved. Looked at, never lived.
import { YEAR, hashString, yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import { HOME_MONTHS, roofPitch, strikeHurt } from "../rules/index.ts";
import {
  DISASTER_EVENTS,
  LOCAL_ACT_EVENTS,
  citiesOf,
  designsOf,
  houseFor,
  populationContext,
  townsOf,
} from "../sim/index.ts";
import type { TownDesign, TownPlan, TownStrike, TownWater } from "../bridge/index.ts";
import { kindOf } from "./kinds.ts";

/** How long what struck a town is told to its plan: its homes burn a day, and lie in ruin years. */
const STRUCK_SHOWN = 2 * YEAR;

/**
 * What struck a town these two years past, oldest first (Phase 42 M201): fire sent on it, the
 * ground shaken or fire fallen from the sky on its land (`land`: its province's ref).
 */
export function strikesOn(world: World, ref: Ref, land: Ref | null): TownStrike[] {
  const events = world.events.all(),
    since = world.now - STRUCK_SHOWN,
    out: TownStrike[] = [],
    // (A quake's or a fallen fire's dead are its land's: the town's share of them, by its people.)
    ctx = populationContext(world),
    v = ctx.settlements.get(ref),
    all = v ? (ctx.provinces.get(v.cell)?.total() ?? 0) : 0,
    share = v && all > 0 ? Math.min(1, v.population / all) : 0;
  for (let i = events.length - 1; i >= 0 && events[i]!.t > since; i--) {
    const e = events[i]!,
      kind =
        e.type === LOCAL_ACT_EVENTS.fire.type && e.subjects[0] === ref
          ? "fire"
          : land !== null && e.place === land && e.type === DISASTER_EVENTS.quake.type
            ? "quake"
            : land !== null && e.place === land && e.type === DISASTER_EVENTS.meteor.type
              ? "meteor"
              : null;
    if (!kind) continue;
    const data = e.data as { lot?: unknown; homes?: unknown; dead?: unknown } | null,
      lot = data?.lot,
      told = typeof data?.dead === "number" ? data.dead : 0,
      dead = kind === "fire" ? told : Math.round(told * share),
      // (A fire tells how many of its homes it brought down; a quake or fire from the sky, how
      // many of each town's.)
      homes =
        kind === "fire"
          ? data?.homes
          : typeof data?.homes === "object" && data.homes !== null
            ? ((data.homes as Record<string, unknown>)[ref] ?? 0)
            : undefined;
    out.push({
      kind,
      at: e.t,
      lot: typeof lot === "number" ? lot : -1,
      homes: typeof homes === "number" ? homes : -1,
      event: e.id,
      ...(dead > 0 ? { dead, hurt: strikeHurt(kind, dead) } : {}),
    });
  }
  return out.reverse();
}

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
    // (What struck it lately: Phase 42 M201.)
    ...(() => {
      const struck = strikesOn(world, ref, land?.ref ?? null);
      return struck.length ? { struck } : {};
    })(),
    // (Its world's kind, for its yards' colours: Phase 56.)
    ...(kindOf(world) === "rocky" ? {} : { kind: kindOf(world) }),
  };
}
