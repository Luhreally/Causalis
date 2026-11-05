// A town's plan for the view (Phase 23 M149): its fabric as the bridge carries it — the family
// of its streets, its runs, its buildings, its walls — with the looks of the designs its homes
// stand in (the design of each run, the oldest in their own), how long each level takes to
// raise, and whether its streets are paved. Looked at, never lived.
import { YEAR, hashString, yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import { COVER } from "../gen/index.ts";
import { HOME_MONTHS, rockOf, roofPitch, strikeHurt } from "../rules/index.ts";
import {
  DISASTER_EVENTS,
  LOCAL_ACT_EVENTS,
  citiesOf,
  designsOf,
  houseFor,
  populationContext,
  siteGround,
  townsOf,
  type Fabric,
} from "../sim/index.ts";
import type { TownCivic, TownDesign, TownPlan, TownStrike, TownWater } from "../bridge/index.ts";
import { kindOf } from "./kinds.ts";
import { worldLook } from "./biochem.ts";
import { colonyRemade, colonyTownCell } from "./colony.ts";

/** How long what struck a town is told to its plan: its homes burn a day, and lie in ruin years. */
const STRUCK_SHOWN = 2 * YEAR;

/**
 * What struck a town these two years past, oldest first (Phase 42 M201): fire sent on it, the
 * ground shaken or fire fallen from the sky on its land (`land`: its province's ref).
 */
export function strikesOn(world: World, ref: Ref, land: Ref | null): TownStrike[] {
  const events = world.events,
    since = world.now - STRUCK_SHOWN,
    out: TownStrike[] = [],
    // (A quake's or a fallen fire's dead are its land's: the town's share of them, by its people.)
    ctx = populationContext(world),
    v = ctx.settlements.get(ref),
    all = v ? (ctx.provinces.get(v.cell)?.total() ?? 0) : 0,
    share = v && all > 0 ? Math.min(1, v.population / all) : 0;
  for (let i = events.count - 1; i >= 0 && events.at(i).t > since; i--) {
    const e = events.at(i),
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
/**
 * The works past our ages of a town greater than what is drawn of it (Phase 66): they rose at its edge as it
 * spread, far past the lots the eye is given, and a town that runs on them should be seen to. Drawn spread along
 * the rim of what is drawn, clear of what stands there; each keeps the lot it truly stands on, for its page.
 */
export function rimWorks(f: Fabric, lots: number): TownCivic[] {
  // (Numbered among all that ever rose out there, fallen too, and a fixed stride apart: one rising or falling
  // moves none of the others.)
  const far = f.civics.filter(
    (c) => (c.kind === "fusion" || c.kind === "vats") && c.at + c.lots > lots,
  );
  if (!far.length) return [];
  const taken = f.civics
      .filter((c) => c.at + c.lots <= lots)
      .map((c) => [c.at, c.at + c.lots] as [number, number]),
    stride = Math.max(1, Math.floor(lots * 0.015)),
    out: TownCivic[] = [];
  far.forEach((c, i) => {
    if (c.fell !== null) return;
    let at = Math.floor((lots - 1 - (i % 20) * stride - c.lots) / c.lots) * c.lots;
    while (at >= 0 && taken.some(([a, b]) => a < at + c.lots && at < b)) at -= c.lots;
    if (at < 0) return;
    taken.push([at, at + c.lots]);
    out.push({ ...c, at, truly: c.at });
  });
  return out;
}

export function townPlan(
  world: World,
  ref: Ref,
  axis: number,
  most = Infinity,
  water: TownWater | null = null,
  /** Its fabric, if it is read of another than the one that stands now (a colony as it stood: Phase 64). */
  fabric?: Fabric,
): TownPlan | null {
  const f = fabric ?? townsOf(world).get(ref);
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
    civics: [
      ...f.civics.filter((c) => c.at + c.lots <= lots).map((c) => ({ ...c })),
      ...rimWorks(f, lots),
    ],
    walls:
      f.walls && f.walls.reach <= lots
        ? { start: f.walls.start, end: f.walls.end, reach: f.walls.reach }
        : null,
    months: HOME_MONTHS,
    designs,
    paved: !!citiesOf(world).get(ref)?.paved || colonyTownCell(ref) !== null,
    water,
    year: Math.min(year, yearOfMoment(world.now)),
    // (What struck it lately: Phase 42 M201.)
    ...(() => {
      const struck = strikesOn(world, ref, land?.ref ?? null);
      return struck.length ? { struck } : {};
    })(),
    // (A colony's: its halls, on its own world's ground, Phase 64; no home world's colours.)
    ...(() => {
      const ground = colonyTownCell(ref) === null ? null : siteGround(world, cell);
      // (On a world fully remade its people are out from under their halls: Phase 66.)
      if (ground && colonyRemade(world, cell) >= 1) return {};
      return ground
        ? {
            sealed: {
              rock: rockOf(
                ground.body.kind,
                ground.body.air,
                ground.world.tint,
                ground.world.temperature[ground.hall] ?? 0,
              ),
              icy: ground.world.cover[ground.hall] === COVER.ice,
            },
          }
        : {
            // (Its world's kind, for its yards' colours: Phase 56.)
            ...(kindOf(world) === "rocky" ? {} : { kind: kindOf(world) }),
            // (Its life's colours, for its yards' grass: Phase 57.)
            ...worldLook(world),
          };
    })(),
  };
}
