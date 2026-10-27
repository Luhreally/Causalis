// Designs (docs/architecture §22): what a people build, realized from what they know
// and what their land gives. Every five years each settled land weighs how it would
// house itself — against its cold, its heat and its rain, with its wood, stone, clay
// or earth, as far as its lore allows — and each realm how it would arm its host,
// with the metals its seat can work (Phase 52 M216: the craft known and the metal
// held in its market — smelted from ore within reach, brought down a road, or kept).
// When the answer changes, history records the new design and why: the principle
// newly known, the land's climate and materials, where the metal came from. The
// host's design is what its armies fight with; the house is what the microscope draws.
import {
  YEAR,
  defineEventType,
  defineKind,
  dmath,
  yearOfMoment,
  type CauseRef,
  Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { BIOME, offworldSite, surfaceOre, worldKindOf } from "../../gen/index.ts";
import {
  G,
  HOST_ROLES,
  HOUSE_ROLES,
  OCC,
  WORKED,
  WORKS_ROLES,
  compose,
  designWords,
  kindBurns,
  realization,
  type Doctrine,
  type Material,
  type Part,
  OPEN_AIR_DRIVES,
  SEALED_DRIVES,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { metalSource, metalsAt, sourceRef } from "../economy/metals.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { wildsOf } from "../ecology/ecology.ts";

export const DESIGN = defineKind("dsgn", "design", "minted");

export const DESIGN_EVENTS = {
  house: defineEventType("design.house", 3),
  host: defineEventType("design.host", 4),
  works: defineEventType("design.works", 3),
};

export type Design = {
  readonly ref: Ref;
  readonly kind: "house" | "host" | "works";
  /** The land (for a house) or the realm (for a host) it belongs to. */
  readonly owner: Ref;
  readonly parts: readonly Part[];
  readonly since: number;
  readonly event: Ref;
};

export class DesignStore implements StateStore {
  readonly name = "design.designs";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
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
  /** The works a land's crafts are done in, now. */
  worksOf(owner: Ref): Design | undefined {
    const ref = this.current.get(`works|${owner}`);
    return ref ? this.all.get(ref) : undefined;
  }
  /**
   * The design an owner had of a kind in a year (Phase 52 M216): a realm's host as it was armed
   * then, for a battle fought or a page of the past. (Old designs stay, so this is exact.)
   */
  at(owner: Ref, year: number, kind: Design["kind"] = "host"): Design | undefined {
    let best: Design | undefined;
    for (const d of this.all.values())
      if (
        d.owner === owner &&
        d.kind === kind &&
        d.since <= year &&
        (!best || d.since > best.since || (d.since === best.since && d.ref > best.ref))
      )
        best = d;
    return best;
  }
  /**
   * The design its owner had of the same kind before this one (Phase 53 M219: what a realm re-armed
   * in place of), if any. (Old designs stay, so this is exact.)
   */
  before(ref: Ref): Design | undefined {
    const d = this.all.get(ref);
    if (!d) return undefined;
    let best: Design | undefined;
    for (const x of this.all.values())
      if (
        x.owner === d.owner &&
        x.kind === d.kind &&
        x.ref !== d.ref &&
        (x.since < d.since || (x.since === d.since && x.ref < d.ref)) &&
        (!best || x.since > best.since || (x.since === best.since && x.ref > best.ref))
      )
        best = x;
    return best;
  }
  /** Every design folded in as it is realized (designs never change once made). */
  private digest = "";

  set(d: Design): void {
    this.all.set(d.ref, d);
    this.current.set(d.kind === "works" ? `works|${d.owner}` : d.owner, d.ref);
    this.digest = new Hasher().string(this.digest).value(d).hex();
  }
  list(): Design[] {
    return [...this.all.values()].sort((a, b) => (a.ref < b.ref ? -1 : 1));
  }
  pinned(): Ref[] {
    return [...this.current.values()].map((r) => this.all.get(r)!.event);
  }
  hashInto(h: Hasher): void {
    h.string(this.digest);
    h.value([...this.current.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  }
  save(): unknown {
    return {
      designs: this.list(),
      current: [...this.current.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      digest: this.digest,
    };
  }
  load(state: unknown): void {
    const s = state as { designs: Design[]; current: [string, Ref][]; digest?: string };
    this.digest = s.digest ?? "";
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

/** What a place gives its people to build with: the land's, or the shelf's for a people of the water. */
export function landMaterials(ctx: PopulationContext, cell: number): Set<Material> {
  if (ctx.medium === "water") return seaMaterials(ctx, cell);
  const out = landGives(ctx, cell);
  // A people of the shore have the tide's gifts besides.
  if (ctx.medium === "shore") for (const m of seaMaterials(ctx, cell)) out.add(m);
  return out;
}

/** The shelf's: shell and the rock of the sea floor everywhere, its mud; coral where the sea is warm, kelp where it is cooler. */
function seaMaterials(ctx: PopulationContext, cell: number): Set<Material> {
  const warm = ctx.generated.climate.temperature[cell]!,
    out = new Set<Material>(["shell", "stone", "earth"]);
  if (warm >= 18) out.add("coral");
  if (warm < 22) out.add("kelp");
  // (An ice world's ice: floes on its ammonia sea, the floor of its methane sea — Phase 56.)
  const kind = worldKindOf(ctx.generated);
  if (kind === "ammonia" || kind === "methane") out.add("ice");
  return out;
}

function landGives(ctx: PopulationContext, cell: number): Set<Material> {
  const g = ctx.generated,
    rain = g.climate.precipitation[cell]!,
    warm = g.climate.temperature[cell]!,
    wet = !!g.water.river[cell] || !!g.water.lake[cell],
    out = new Set<Material>(["earth", "hide"]);
  if (rain < 900 && warm >= 6) out.add("mud");
  if (rain >= 350 && warm < 10) out.add("sod");
  // Wood where trees grow — and still stand: a land whose forest is cleared has little.
  if (
    (FOREST.has(g.climate.biome[cell]!) || (rain >= 500 && warm >= -2)) &&
    wildsOf(ctx, cell).forest > 0.25
  )
    out.add("wood");
  if (rain >= 250 || wet) out.add("reed");
  if (g.tectonics.elevation[cell]! > 450) out.add("stone");
  // (Where nothing burns no clay is fired; a kind's walls are of what its ground gives: Phase 56.)
  const kind = worldKindOf(g);
  if ((wet || rain >= 500) && kindBurns(kind)) out.add("fired clay");
  if (kind === "ammonia" || kind === "methane") out.add("ice");
  if (kind === "carbon") out.add("pitch grit");
  if (kind === "sulfur") out.add("sulfur concrete");
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
  // What their body asks of a house: cold blood seeks warmth, a warm coat shade; a big
  // body room; a people who live as one, together; climbers and the feathered, height.
  // Under the water no rain is shed and no sun is shaded.
  const body = ctx.generated.life.people?.body,
    blood = body && !body.warm ? 1.4 : body?.skin === "fur" || body?.skin === "feathers" ? 0.6 : 1,
    coat = body?.skin === "fur" ? 1.3 : body?.skin === "scales" || body?.skin === "shell" ? 0.6 : 1,
    wet = ctx.medium === "water" ? 0 : 1,
    size = body ? dmath.cbrt(body.size / 60) : 1;
  const doctrine: Doctrine = {
    warmth: Math.max(0, (14 - warm) / 10) * blood,
    cool: Math.max(0, (warm - 12) / 8) * (rain < 900 ? 1 : 0.4) * coat * wet,
    shedding: (rain / 1000) * wet,
    lasting: 0.3 + wealth,
    room: (0.3 + 0.2 * (1 - roaming)) * size,
    mobile: roaming > 0.5 ? 1.2 * roaming : 0,
    together: body?.social ?? 0.8,
    high:
      body?.manipulators === "hands" && (body?.limbs ?? 2) >= 4
        ? 1
        : body?.skin === "feathers"
          ? 0.5
          : 0,
    cost: 0.7 - wealth,
  };
  return compose(
    HOUSE_ROLES,
    (id) => knows(ctx, cell, id),
    (m) => at.has(m),
    doctrine,
    body,
  );
}

/**
 * A realm keeps the arms its host has unless what it could arm it with instead is better by this
 * share of their worth (Phase 52 M217): re-arming a host costs its markets their metal, and a
 * realm near the line between two kits does not change back and forth at every review.
 */
export const HOST_KEEP = 0.1;

/**
 * Where a realm's machined arms would come from (Phase 53 M219): a member land that knows steel and
 * has works whose machines are made or kept there (citing its first works), else machines brought
 * down a road into one of its lands (citing the road). Null: nothing in its reach can cut a bolt.
 */
export function machinedFor(ctx: PopulationContext, p: Polity): Ref | null {
  const markets = ctx.world.store<MarketStore>("economy.markets"),
    lands = [...p.members].sort((a, b) => a - b);
  for (const c of lands) {
    const m = markets.get(c);
    if (!m?.works || !knows(ctx, c, "steel")) continue;
    if (m.stock[G.machines]! > 0 || (m.years.at(-1)?.ledger[0]?.[G.machines] ?? 0) > 0)
      return m.works;
  }
  const flow = markets.flows.find((f) => f.good === G.machines && lands.includes(f.to));
  return flow ? (markets.route(flow.from, flow.to) ?? null) : null;
}

/**
 * Where a realm's engines would get their oil (Phase 53 M219): a member land that holds oil, drawn
 * there (citing its first well) or brought in (citing the road). Null: none.
 */
export function fuelFor(ctx: PopulationContext, p: Polity): Ref | null {
  const markets = ctx.world.store<MarketStore>("economy.markets"),
    lands = [...p.members].sort((a, b) => a - b);
  for (const c of lands) {
    const m = markets.get(c);
    if (!m || m.stock[G.oil]! <= 0) continue;
    if (m.well) return m.well;
    const flow = markets.flows.find((f) => f.good === G.oil && f.to === c),
      road = flow ? markets.route(flow.from, c) : undefined;
    return road ?? ctx.provinces.get(c)!.ref;
  }
  return null;
}

/**
 * How a realm would arm its host now, and where its metals come from: only the metals its seat
 * can work this year (`metalsAt`: the craft known, the metal held), each citing its source — the
 * ore within reach, the road it came down, or the market that keeps it. (Machined arms, Phase 53
 * M219: only from works it can reach, and an armoured car's engine only with oil.)
 */
export function hostFor(
  ctx: PopulationContext,
  p: Polity,
): { parts: Part[]; sources: Partial<Record<Material, Ref>> } {
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
    sources: Partial<Record<Material, Ref>> = {};
  for (const metal of metalsAt(ctx, p.seat)) {
    if (metal === "stone") continue;
    // (Bronze cites its tin: the copper is the bronze-smith's as much as the copper-smith's.)
    const good = WORKED[metal].from.at(-1)!,
      source = metalSource(ctx, p.seat, good);
    if (source) sources[metal] = sourceRef(p.seat, good, source);
  }
  // What a host can be made of where its people live, and their own bodies.
  const at = new Set<Material>(
    ctx.medium === "water"
      ? ["shell", "stone", "coral", "body"]
      : ["wood", "reed", "hide", "stone", "body"],
  );
  if (ctx.medium === "shore") at.add("shell");
  const machined = seatKnows("repeating-fire") ? machinedFor(ctx, p) : null,
    oil = machined && seatKnows("armoured-vehicles") ? fuelFor(ctx, p) : null;
  if (machined) sources.machined = machined;
  if (oil) sources.oil = oil;
  for (const m of Object.keys(sources) as Material[]) at.add(m);
  const doctrine: Doctrine = {
    shock: 0.6 + valour,
    reach: 0.3,
    range: 0.4,
    protection: 0.4 + wealth,
    mobility: 0.2 + (2 * herders) / Math.max(1, people),
    cost: 0.6 - 0.5 * wealth,
    firepower: 0.35,
    breach: 0.3,
  };
  return {
    parts: compose(
      HOST_ROLES,
      seatKnows,
      (m) => at.has(m),
      doctrine,
      ctx.generated.life.people?.body,
      undefined,
      designsOf(ctx.world).of(p.ref)?.parts,
      HOST_KEEP,
    ),
    sources,
  };
}

/** What a land's crafts are done in and driven by, now: none until it knows mills or engines. */
export function worksFor(ctx: PopulationContext, cell: number): Part[] | null {
  const p = ctx.provinces.get(cell)!;
  if (
    !knows(ctx, cell, "mills") &&
    !knows(ctx, cell, "steam-engine") &&
    !knows(ctx, cell, "current-mills")
  )
    return null;
  const markets = ctx.world.store<MarketStore>("economy.markets"),
    m = markets.get(cell),
    at = landMaterials(ctx, cell),
    // Fuel is at hand where the land digs or draws it, or has it in store.
    fuel = (g: number, seam: "coal" | "oil") =>
      (m?.stock[g] ?? 0) > 0 || surfaceOre(ctx.generated, cell, seam);
  // (Sealed halls on another world and ships between the stars burn no coal or oil.)
  const sealed = !!offworldSite(ctx.generated, cell);
  if (!sealed && fuel(G.coal, "coal")) at.add("coal");
  if (!sealed && fuel(G.oil, "oil")) at.add("oil");
  if (knows(ctx, cell, "iron")) at.add("iron");
  if (knows(ctx, cell, "steel") || knows(ctx, cell, "refined-metals")) at.add("steel");
  const crafts = p.occupation(OCC.crafter) / Math.max(1, p.total()),
    wealth = Math.min(0.4, (p.occupation(OCC.trader) / Math.max(1, p.total())) * 4);
  const doctrine: Doctrine = {
    output: 0.6 + 4 * crafts,
    lasting: 0.2 + wealth,
    cost: 0.6 - wealth,
  };
  return compose(
    WORKS_ROLES,
    (id) => knows(ctx, cell, id),
    (x) => at.has(x),
    doctrine,
    ctx.generated.life.people?.body,
    (id) => (sealed ? !OPEN_AIR_DRIVES.includes(id) : !SEALED_DRIVES.includes(id)),
  );
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
  // The works of lands that know mills or engines.
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    const parts = worksFor(ctx, p.cell);
    if (!parts) continue;
    const before = store.worksOf(p.ref);
    if (before && same(before.parts, parts)) continue;
    const ref = mint(),
      event = world.events.emit({
        type: DESIGN_EVENTS.works.type,
        subjects: [ref],
        place: p.ref,
        causes: [
          { ref: p.ref, role: "constraint", weight: 0.3 },
          ...principlesOf(ctx, p.cell, parts),
        ],
        data: { words: designWords(parts) },
      });
    store.set({ ref, kind: "works", owner: p.ref, parts, since: year, event });
  }
  for (const realm of politiesOf(world).living()) {
    const { parts, sources } = hostFor(ctx, realm),
      before = store.of(realm.ref);
    if (before && same(before.parts, parts)) continue;
    const metal = parts.map((x) => sources[x.material]).find((c) => c !== undefined),
      // (And where its engines' oil comes from, Phase 53 M219.)
      fuel = parts.some((x) => realization(x.id).with?.includes("oil")) ? sources.oil : undefined;
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
            ? [{ ref: metal, role: "constraint" as const, weight: 0.3 }]
            : []),
          ...(fuel !== undefined ? [{ ref: fuel, role: "constraint" as const, weight: 0.2 }] : []),
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
