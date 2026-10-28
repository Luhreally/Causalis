import { defineEventType, type Ref, type World } from "../../kernel/index.ts";
import { DEPOSIT_KINDS, cellRef, type HomeWorld } from "../../gen/index.ts";
import { BRUSH_KINDS, BRUSH_LIMIT, brushCells, type BrushArgs } from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { surfaceBiome, type SurfacePatch } from "../planet/surface.ts";
import { politiesOf } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";
import { strike, raze, grieve } from "./disasters.ts";

export const BRUSH_EVENT = defineEventType("act.brush", 6);

function checked(world: World, args: unknown): BrushArgs {
  const a = args as BrushArgs | null,
    g = homePlanet(world).generated;
  if (!a || !BRUSH_KINDS.includes(a.kind)) throw new Error("Choose a brush.");
  if (
    !Array.isArray(a.cells) ||
    !a.cells.length ||
    a.cells.length > BRUSH_LIMIT.centres ||
    a.cells.some((c) => !Number.isInteger(c) || c < 0 || c >= g.fine.grid.count)
  )
    throw new Error("Choose up to 64 spots on this world's ground.");
  if (
    !Number.isInteger(a.radius) ||
    a.radius < 0 ||
    a.radius > BRUSH_LIMIT.radius ||
    !Number.isInteger(a.strength) ||
    a.strength < 1 ||
    a.strength > 4
  )
    throw new Error("Brush size or strength is out of range.");
  if (a.kind === "ore" && !DEPOSIT_KINDS.includes(a.ore!))
    throw new Error("Choose an ore of this world's chemistry.");
  if (a.kind === "claim") {
    const r = politiesOf(world).get(a.realm as Ref);
    if (!r || r.ended !== null) throw new Error("Choose a living realm.");
  }
  return a;
}

export function brushPreview(ctx: PopulationContext, args: unknown) {
  const world = ctx.world,
    a = checked(world, args),
    home = homePlanet(world),
    g = home.generated,
    cells = brushCells(g.fine.grid, a.cells, a.radius),
    provinces = [...new Set(cells.map((c) => g.provinceOf[c]!))].sort((a, b) => a - b),
    shares = new Map<number, number>();
  let seeded = 0;
  for (const c of cells) {
    const e = g.fine.tectonics.elevation[c]!,
      flood =
        (a.kind === "water" && e > 0 && !g.fine.water.lake[c]) ||
        (a.kind === "lower" && e > 0 && e - BRUSH_LIMIT.rise * a.strength <= 0),
      share = a.kind === "lightning" ? 0.01 * a.strength : flood ? 0.2 : 0,
      province = g.provinceOf[c]!,
      kids = g.childOffsets[province + 1]! - g.childOffsets[province]!;
    shares.set(province, Math.min(0.8, (shares.get(province) ?? 0) + share / kids));
    if (a.kind === "life") seeded += suitableLife(g.fine, c).length;
  }
  if (a.kind === "life" && !seeded)
    throw new Error("No living lineage of this world suits this ground. Try warmer, watered land.");
  if (a.kind === "claim")
    for (const p of provinces) {
      const old = politiesOf(world).of(p);
      if (old && old.ref !== a.realm && old.seat === p)
        throw new Error(
          "A realm's capital cannot be claimed with a brush. Use Make union to take its whole realm.",
        );
    }
  // A conservative warning: the held people are immune to aggregate deaths, and tiny cohorts
  // may round down. The command rechecks this at execution time so a stale preview is harmless.
  const atRisk = provinces.reduce(
      (n, p) => n + Math.ceil((ctx.provinces.get(p)?.total() ?? 0) * (shares.get(p) ?? 0)),
      0,
    ),
    towns = provinces.reduce(
      (n, p) => n + ((shares.get(p) ?? 0) > 0 ? ctx.settlements.inProvince(p).length : 0),
      0,
    );
  return { cells, provinces, atRisk, towns, shares, seeded, kind: a.kind };
}

function suitableLife(f: HomeWorld, c: number) {
  const t = f.climate.temperature[c]!,
    rain = f.climate.precipitation[c]!;
  if (f.tectonics.elevation[c]! <= 0) return [];
  return f.life.species.filter(
    (s) =>
      s.died === null &&
      s.niche !== "upright ape" &&
      s.niche !== "swimmer" &&
      Math.abs(t - s.warm) <= s.tolerance &&
      rain >= s.rainMin &&
      rain <= s.rainMax,
  );
}

function changedGround(
  ctx: PopulationContext,
  a: BrushArgs,
  cells: readonly number[],
): SurfacePatch[] {
  const home = homePlanet(ctx.world),
    f = home.generated.fine;
  let nextOre = home.nextDeposit();
  return cells.map((cell) => {
    const p = home.surface(cell),
      before = p.elevation;
    if (a.kind === "raise" || a.kind === "lower") {
      p.elevation = Math.fround(
        Math.max(
          -12000,
          Math.min(
            16000,
            p.elevation + (a.kind === "raise" ? 1 : -1) * BRUSH_LIMIT.rise * a.strength,
          ),
        ),
      );
      p.temperature = Math.fround(p.temperature - (p.elevation - before) * 0.0065);
      surfaceBiome(p, f.climate.precipitation[cell]!);
    }
    if (a.kind === "water" && p.elevation > 0) {
      p.lake = 1;
      p.filled = Math.fround(p.elevation + 5 * a.strength);
    }
    if (a.kind === "drain") {
      p.lake = 0;
      p.river = 0;
      p.discharge = 0;
      p.elevation = Math.max(1, p.elevation);
      p.filled = p.elevation;
      surfaceBiome(p, f.climate.precipitation[cell]!);
    }
    if (a.kind === "life")
      for (const s of suitableLife(f, cell)) {
        p.present[s.index >>> 5] = (p.present[s.index >>> 5]! | (1 << (s.index & 31))) >>> 0;
        if (
          s.niche === "seed grass" &&
          s.tame &&
          (p.grass < 0 || s.seed > f.life.species[p.grass]!.seed)
        )
          p.grass = s.index;
        if (
          s.niche !== "seed grass" &&
          s.tame &&
          (p.beast < 0 ||
            s.docility * s.growth >
              f.life.species[p.beast]!.docility * f.life.species[p.beast]!.growth)
        )
          p.beast = s.index;
      }
    if (a.kind === "life")
      p.diversity = f.life.species.filter(
        (s) =>
          s.niche !== "seed grass" &&
          s.niche !== "upright ape" &&
          (p.present[s.index >>> 5]! & (1 << (s.index & 31))) !== 0,
      ).length;
    if (a.kind === "ore")
      p.ore = { kind: a.ore!, richness: 100000 * a.strength, index: p.ore?.index ?? nextOre++ };
    return p;
  });
}

export function installBrushes(world: World, context: () => PopulationContext): void {
  const home = homePlanet(world);
  world.addPinner(() => home.brushStrokes().map((s) => s.event));
  world.defineCommand({
    type: "act.brush",
    validate: (args) => {
      try {
        const p = brushPreview(context(), args);
        return (p.atRisk || p.towns) && (args as BrushArgs).confirmed !== true
          ? "This stroke may kill people or damage homes. Confirm its consequences first."
          : null;
      } catch (error) {
        return (error as Error).message;
      }
    },
    apply: (command, t) => {
      const a = command.args as BrushArgs,
        ctx = context(),
        p = brushPreview(ctx, a);
      if (a.kind !== "lightning" && a.kind !== "claim")
        home.changeSurface(changedGround(ctx, a, p.cells));
      let dead = 0,
        blocks = 0;
      const homes: Record<string, number> = {};
      for (const [cell, share] of p.shares)
        if (share > 0) {
          dead += strike(ctx, cell, share, t);
          blocks += raze(ctx, cell, share, t, homes);
        }
      const event = world.events.emit({
        type: BRUSH_EVENT.type,
        subjects: p.provinces.map((c) => cellRef(0, c)),
        place: cellRef(0, p.provinces[0]!),
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: {
          kind: a.kind,
          cells: p.cells.length,
          dead,
          blocks,
          homes,
          ore: a.ore ?? null,
          realm: a.realm ?? null,
        },
      });
      if (a.kind === "claim") {
        const realms = politiesOf(world),
          into = realms.get(a.realm as Ref)!;
        for (const cell of p.provinces) {
          const old = realms.of(cell);
          if (old === into) continue;
          if (old) realms.leave(old, cell);
          realms.join(into, cell);
          realms.setDiscontent(cell, { level: 0, cause: event });
        }
      }
      for (const [cell, share] of p.shares) if (share > 0) grieve(world, cell, share, event);
      home.recordStroke({ event, kind: a.kind, cells: p.cells, provinces: p.provinces, t, dead });
    },
  });
}
