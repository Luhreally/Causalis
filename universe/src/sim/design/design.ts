// Designs (docs/architecture §22): what a people build, realized from what they know
// and what their land gives. Every five years each settled land weighs how it would
// house itself — against its cold, its heat and its rain, with its wood, stone, clay
// or earth, as far as its lore allows — and each realm how it would arm its host,
// with the metals its lands (and the lands within two steps of them) hold. When the
// answer changes, history records the new design and why: the principle newly known,
// the land's climate and materials, the ore. The host's design is what its armies
// fight with; the house is what the microscope draws.
import {
  YEAR,
  defineEventType,
  defineKind,
  yearOfMoment,
  type CauseRef,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { BIOME, cellRef, surfaceOre } from "../../gen/index.ts";
import {
  HOST_ROLES,
  HOUSE_ROLES,
  OCC,
  compose,
  designWords,
  realization,
  type Doctrine,
  type Material,
  type Part,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";

export const DESIGN = defineKind("dsgn", "design", "minted");

export const DESIGN_EVENTS = {
  house: defineEventType("design.house", 3),
  host: defineEventType("design.host", 4),
};

export type Design = {
  readonly ref: Ref;
  readonly kind: "house" | "host";
  /** The land (for a house) or the realm (for a host) it belongs to. */
  readonly owner: Ref;
  readonly parts: readonly Part[];
  readonly since: number;
  readonly event: Ref;
};

export class DesignStore implements StateStore {
  readonly name = "design.designs";
  /** Every design ever realized, by ref (old ones stay, for the whys that cite them). */
  private readonly all = new Map<string, Design>();
  private readonly current = new Map<string, Ref>();

  get(ref: Ref): Design | undefined {
    return this.all.get(ref);
  }
  /** The design a land houses itself in, or a realm arms its host with, now. */
  of(owner: Ref): Design | undefined {
    const ref = this.current.get(owner);
    return ref ? this.all.get(ref) : undefined;
  }
  set(d: Design): void {
    this.all.set(d.ref, d);
    this.current.set(d.owner, d.ref);
  }
  list(): Design[] {
    return [...this.all.values()].sort((a, b) => (a.ref < b.ref ? -1 : 1));
  }
  pinned(): Ref[] {
    return [...this.current.values()].map((r) => this.all.get(r)!.event);
  }
  hashInto(h: Hasher): void {
    h.value(this.list());
    h.value([...this.current.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  }
  save(): unknown {
    return {
      designs: this.list(),
      current: [...this.current.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    };
  }
  load(state: unknown): void {
    const s = state as { designs: Design[]; current: [string, Ref][] };
    this.all.clear();
    this.current.clear();
    for (const d of s.designs) this.all.set(d.ref, { ...d, parts: [...d.parts] });
    for (const [owner, ref] of s.current) this.current.set(owner, ref);
  }
}

export function designsOf(world: World): DesignStore {
  return world.store<DesignStore>("design.designs");
}

const FOREST: ReadonlySet<number> = new Set([
  BIOME.borealForest,
  BIOME.temperateForest,
  BIOME.temperateRainforest,
  BIOME.tropicalDryForest,
  BIOME.tropicalRainforest,
]);

/** What a land gives to build with. */
export function landMaterials(ctx: PopulationContext, cell: number): Set<Material> {
  const g = ctx.generated,
    rain = g.climate.precipitation[cell]!,
    warm = g.climate.temperature[cell]!,
    wet = !!g.water.river[cell] || !!g.water.lake[cell],
    out = new Set<Material>(["earth", "hide"]);
  if (rain < 900 && warm >= 6) out.add("mud");
  if (rain >= 350 && warm < 10) out.add("sod");
  if (FOREST.has(g.climate.biome[cell]!) || (rain >= 500 && warm >= -2)) out.add("wood");
  if (rain >= 250 || wet) out.add("reed");
  if (g.tectonics.elevation[cell]! > 450) out.add("stone");
  if (wet || rain >= 500) out.add("fired clay");
  return out;
}

/** The event that brought a principle to a land (the older systems' own for sowing and copper). */
function knownBy(ctx: PopulationContext, cell: number, id: string): Ref | null {
  if (id === "cultivation") return ctx.provinces.get(cell)?.cultivation ?? null;
  if (id === "metalworking")
    return ctx.world.store<MarketStore>("economy.markets").get(cell)?.metalworking ?? null;
  return loreOf(ctx.world).get(cell, id)?.event ?? null;
}

/** How a settled land's people would house themselves now. */
export function houseFor(ctx: PopulationContext, cell: number): Part[] {
  const g = ctx.generated,
    p = ctx.provinces.get(cell)!,
    rain = g.climate.precipitation[cell]!,
    warm = g.climate.temperature[cell]!,
    total = Math.max(1, p.total()),
    roaming = (p.occupation(OCC.herder) + p.occupation(OCC.forager)) / total,
    trade = p.occupation(OCC.trader) / total,
    town = ctx.settlements.inProvince(cell).some((s) => s.market),
    wealth = Math.min(0.4, trade * 4 + (town ? 0.15 : 0)),
    at = landMaterials(ctx, cell);
  const doctrine: Doctrine = {
    warmth: Math.max(0, (14 - warm) / 10),
    cool: Math.max(0, (warm - 12) / 8) * (rain < 900 ? 1 : 0.4),
    shedding: rain / 1000,
    lasting: 0.3 + wealth,
    room: 0.3 + 0.2 * (1 - roaming),
    mobile: roaming > 0.5 ? 1.2 * roaming : 0,
    cost: 0.7 - wealth,
  };
  return compose(
    HOUSE_ROLES,
    (id) => knows(ctx, cell, id),
    (m) => at.has(m),
    doctrine,
  );
}

/** The lands within two steps of a realm's lands, and whether any holds an ore. */
function oreFor(ctx: PopulationContext, p: Polity, kind: string): number | null {
  const g = ctx.generated,
    seen = new Set<number>(p.members),
    ring = [...p.members];
  for (let step = 0; step < 2; step++) {
    const next: number[] = [];
    for (const c of ring)
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
        const n = g.grid.neighbours[k]!;
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    ring.splice(0, ring.length, ...next);
  }
  for (const c of [...seen].sort((a, b) => a - b)) if (surfaceOre(g, c, kind)) return c;
  return null;
}

/** How a realm would arm its host now, and where its metals come from. */
export function hostFor(
  ctx: PopulationContext,
  p: Polity,
): { parts: Part[]; ores: Partial<Record<Material, number>> } {
  const culture = cultureOf(ctx.world),
    ways = culture.get(p.seat),
    valour = ways?.traits[WAY.valour] ?? 0.5;
  let people = 0,
    herders = 0,
    traders = 0;
  for (const c of p.members) {
    const q = ctx.provinces.get(c);
    if (!q) continue;
    people += q.total();
    herders += q.occupation(OCC.herder);
    traders += q.occupation(OCC.trader);
  }
  const wealth = Math.min(0.4, (traders / Math.max(1, people)) * 4 + 0.05),
    seatKnows = (id: string) => knows(ctx, p.seat, id),
    ores: Partial<Record<Material, number>> = {};
  const copper = seatKnows("metalworking") ? oreFor(ctx, p, "copper") : null,
    tin = seatKnows("bronze") && copper !== null ? oreFor(ctx, p, "tin") : null,
    iron = seatKnows("iron") ? oreFor(ctx, p, "iron") : null;
  if (copper !== null) ores.copper = copper;
  if (tin !== null) ores.bronze = tin;
  if (iron !== null) {
    ores.iron = iron;
    if (seatKnows("steel")) ores.steel = iron;
  }
  const at = new Set<Material>(["wood", "reed", "hide", "stone"]);
  for (const m of Object.keys(ores) as Material[]) at.add(m);
  const doctrine: Doctrine = {
    shock: 0.6 + valour,
    reach: 0.3,
    range: 0.4,
    protection: 0.4 + wealth,
    mobility: 0.2 + (2 * herders) / Math.max(1, people),
    cost: 0.6 - 0.5 * wealth,
  };
  return {
    parts: compose(HOST_ROLES, seatKnows, (m) => at.has(m), doctrine),
    ores,
  };
}

const same = (a: readonly Part[], b: readonly Part[]) =>
  a.length === b.length &&
  a.every((x, i) => x.id === b[i]!.id && x.material === b[i]!.material && x.role === b[i]!.role);

/** The principles a design rests on, newest first. */
function principlesOf(ctx: PopulationContext, cell: number, parts: readonly Part[]): CauseRef[] {
  const refs = new Map<string, number>();
  for (const part of parts)
    for (const id of realization(part.id).needs) {
      const ref = knownBy(ctx, cell, id),
        e = ref ? ctx.world.events.get(ref) : undefined;
      if (ref && e) refs.set(ref, e.t);
    }
  return [...refs.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 2)
    .map(([ref]) => ({ ref: ref as Ref, role: "enabler" as const, weight: 0.3 }));
}

/** The designs' years: every fifth, each settled land's house and each realm's host, recorded when they change. */
export function designYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = designsOf(world),
    year = yearOfMoment(t);
  if (year % 5 !== 0) return;
  const mint = () => world.minter.mint(DESIGN);
  for (const p of ctx.provinces.all()) {
    if (!ctx.settlements.inProvince(p.cell).length) continue;
    const parts = houseFor(ctx, p.cell),
      before = store.of(p.ref);
    if (before && same(before.parts, parts)) continue;
    const ref = mint(),
      event = world.events.emit({
        type: DESIGN_EVENTS.house.type,
        subjects: [ref],
        place: p.ref,
        causes: [
          // The land: its cold, heat and rain, and what it gives to build with.
          { ref: p.ref, role: "constraint", weight: 0.4 },
          ...principlesOf(ctx, p.cell, parts),
        ],
        data: { words: designWords(parts) },
      });
    store.set({ ref, kind: "house", owner: p.ref, parts, since: year, event });
  }
  for (const realm of politiesOf(world).living()) {
    const { parts, ores } = hostFor(ctx, realm),
      before = store.of(realm.ref);
    if (before && same(before.parts, parts)) continue;
    const metal = parts.map((x) => ores[x.material]).find((c) => c !== undefined);
    const ref = mint(),
      event = world.events.emit({
        type: DESIGN_EVENTS.host.type,
        subjects: [ref, realm.ref],
        place: ctx.provinces.get(realm.seat)?.ref ?? null,
        causes: [
          { ref: realm.event, role: "enabler", weight: 0.2 },
          ...principlesOf(ctx, realm.seat, parts),
          // Where its metal comes from.
          ...(metal !== undefined
            ? [{ ref: cellRef(0, metal), role: "constraint" as const, weight: 0.3 }]
            : []),
        ],
        data: { words: designWords(parts), realm: realm.ref },
      });
    store.set({ ref, kind: "host", owner: realm.ref, parts, since: year, event });
  }
}

/** Teach a peopled world its designs. */
export function installDesigns(world: World, ctx: () => PopulationContext): DesignStore {
  const store = world.register(new DesignStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "195.design.year", every: YEAR, run: (t) => designYear(ctx(), t) });
  return store;
}
