// What each land knows of making stuffs (Materials round; the rule is rules/materials.ts). Asked 2026-11-16: "dont forget
// materials science".
//   158.lore.materials, a land every five years in its turn (by its cell and the year), stepped five years at once:
//     - each way it may come to (MATERIAL_WAYS) is open to it where it knows the tools the way asks, has made what the way
//       builds on, its world holds what the way is made of, and its hottest fire reaches the heat the way's own physics names
//       (a forged edge's austenite, calcite's breaking, mullite's vitrifying, its switching crystal's melt);
//     - of the open ways it finds at most one, the first that its makers come to: by its crafters at the work, and the more
//       by its readers at their measures the deeper the way lies (rules/letters.ts inquiryOf), on its own stream;
//     - else it takes one up from a neighbour by land or sea that has made it (twice as readily down a road, the more in a
//       realm in common);
//     - and its practice brings the purity of what it refines toward the most its methods allow (rules/materials.ts
//       purityCeiling), the faster the more it inquires.
//   Read back by history: a host's metal kit is the keener for its seat's treatments and alloys, and the less so in a world
//   cold enough to make its iron brittle (war/arms.ts partQuality); it wears the slower where its metal does not rust under
//   its world's air (rearmYear); and a land takes up switches of pure crystal (lore.ts) only once its crystal is as pure as
//   a switch at its world's warmth wants.
// One row of whole numbers a land; nothing grows with history but one event a land for each way found or taken up.
import {
  YEAR,
  Hasher,
  defineEventType,
  defineStream,
  dmath,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  cellRef,
  functionsOf,
  meansNumbers,
  meansOfWorld,
  worldChemistry,
} from "../../gen/index.ts";
import {
  ASKS_PURITY,
  ATOMS,
  G,
  MATERIAL_WAYS,
  METALS,
  METAL_RECIPES,
  OCC,
  PROPERTIES,
  PURITY_PACE,
  WAY,
  WAY_INDEX,
  atomsPerM3,
  bandGapOf,
  crustPpm,
  findSubstance,
  inquiryOf,
  measuresOf,
  metalMake,
  purityCeiling,
  purityNeeded,
  qualityOf,
  reachIn,
  recipeEdge,
  rustRate,
  treatedRecipe,
  wayOpen,
  FRAME_SHARE,
  flyerFrame,
  stageDry,
  type Frame,
  type MaterialWay,
  type WayFacts,
} from "../../rules/index.ts";
import { populationContext, type PopulationContext } from "../population/systems.ts";
import { homeField } from "../planet/motion.ts";
import type { MarketStore } from "../economy/market.ts";
import { furnaceHeat } from "../economy/heat.ts";
import { knows, loreOf } from "./lore.ts";
import { lettersOf } from "./letters.ts";
import { cultureOf } from "../culture/culture.ts";
import { politiesOf } from "../polity/polity.ts";

export const MATERIALS_EVENTS = {
  found: defineEventType("lore.material-found", 3),
  learned: defineEventType("lore.material-learned", 2),
};

const FIND = defineStream("lore.materials.find"),
  LEARN = defineStream("lore.materials.learn");

/** A land steps once in so many years, that many at once. */
export const MATERIALS_EVERY = 5;
/** How readily a land takes up a way a neighbour has made, a year, before a road and a realm in common. */
export const MATERIALS_LEARNING = 0.03;
/** Of a host's metal kit worn away in a year, the share that is rust (est: the rest is broken, lost and blunted). */
export const RUST_SHARE = 0.3;

/** A land's making, as kept: the ways it has made (a bit each), its purity (hundredths of nines), when and by what it last came to one. */
export type Making = {
  readonly cell: number;
  made: number;
  purity: number;
  year: number;
  event: Ref | null;
  /** The year it came to each way it has made, in MATERIAL_WAYS' order (0: not made). */
  years: number[];
};

/** Fold whole numbers into a running digest (two 32-bit words): what a checkpoint hashes in place of every row. */
function fold(d: [number, number], xs: readonly number[]): void {
  let a = d[0],
    b = d[1];
  for (const x of xs) {
    const lo = x | 0,
      hi = Math.floor(x / 4294967296) | 0;
    a = Math.imul(a ^ lo, 0x01000193) ^ hi;
    b = Math.imul(b + lo + 0x9e3779b9, 0x85ebca6b) ^ (b >>> 13);
  }
  d[0] = a;
  d[1] = b;
}

export class MaterialsStore implements StateStore {
  readonly name = "lore.materials";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly map = new Map<number, Making>();
  /** Every row set, folded in as it is set: a checkpoint hashes this, not every land's row (O(1) a checkpoint). */
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  private sets = 0;

  get(cell: number): Making | undefined {
    return this.map.get(cell);
  }
  set(m: Making): void {
    this.map.set(m.cell, m);
    fold(this.digest, [m.cell, m.made, m.purity, m.year, m.event ? 1 : 0, ...m.years]);
    this.sets++;
  }
  /** Whether a land has made a way. */
  made(cell: number, way: string): boolean {
    const i = WAY_INDEX.get(way);
    return i !== undefined && !!((this.map.get(cell)?.made ?? 0) & (1 << i));
  }
  /** The year a land came to a way (null: it has not). */
  madeIn(cell: number, way: string): number | null {
    const i = WAY_INDEX.get(way);
    return i !== undefined && this.made(cell, way) ? (this.map.get(cell)?.years[i] ?? null) : null;
  }
  /** The purity a land reaches (nines). */
  purity(cell: number): number {
    return (this.map.get(cell)?.purity ?? 0) / 100;
  }
  /** Whether a land may take up a principle its stuffs must meet: a switch of crystal wants its crystal pure (lore.ts asks). */
  allows(ctx: PopulationContext, cell: number, principle: string): boolean {
    if (!ASKS_PURITY.has(principle)) return true;
    const need = crystalNeed(ctx);
    if (need === null || this.purity(cell) >= need.nines) return true;
    if (this.made(cell, "pure-crystal")) return false;
    // (Where its fire or its world cannot make the crystal pure at all, the world's own reading decides, as before: a land is
    // held back only from what it could come to.)
    const way = MATERIAL_WAYS[WAY_INDEX.get("pure-crystal")!]!;
    return !wayOpen(way, factsAt(ctx, cell, this.map.get(cell))).open;
  }
  /** It holds nothing yet: hashed as if it were not there. */
  dormant(): boolean {
    return this.map.size === 0;
  }
  all(): Making[] {
    return [...this.map.values()].sort((a, b) => a.cell - b.cell);
  }
  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const m of this.map.values()) if (m.event) refs.push(m.event);
    return refs;
  }
  hashInto(h: Hasher): void {
    h.int(this.map.size).int(this.sets).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    return { lands: this.all(), digest: [...this.digest], sets: this.sets };
  }
  load(state: unknown): void {
    this.map.clear();
    const s = state as { lands?: Making[]; digest?: [number, number]; sets?: number } | null;
    for (const m of s?.lands ?? []) this.map.set(m.cell, { ...m, years: [...m.years] });
    // (The fold goes on from where it stood.)
    this.digest[0] = s?.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s?.digest?.[1] ?? 0;
    this.sets = s?.sets ?? 0;
  }
}

/** A world's making store (null on a world that keeps none). */
export function materialsOf(world: World): MaterialsStore | null {
  return world.peek<MaterialsStore>("lore.materials") ?? null;
}

// —— What a world holds for its ways, read once ——————————————————————————————————————————————————————————————

type WorldHolds = {
  readonly ppm: Map<string, number>;
  readonly rock: ReadonlySet<string>;
  readonly air: ReadonlySet<string>;
  readonly crystal: { readonly subst: string; readonly meltC: number } | null;
};
const HOLDS = new Map<string, WorldHolds>();

function holdsOf(ctx: PopulationContext): WorldHolds {
  const g = ctx.generated;
  let h = HOLDS.get(g.digest);
  if (!h) {
    if (HOLDS.size >= 8) HOLDS.delete(HOLDS.keys().next().value!);
    const n = meansNumbers(g),
      sw = functionsOf(g).find((f) => f.id === "switch-in-crystal"),
      subst = sw?.met ? sw.subst : null,
      melts = subst ? findSubstance(subst)?.melts : null;
    h = {
      ppm: new Map(),
      rock: new Set([...n.rockHolds, ...n.groundHolds]),
      air: new Set(n.airHolds),
      crystal: subst ? { subst, meltC: melts ?? 0 } : null,
    };
    HOLDS.set(g.digest, h);
  }
  return h;
}

/** The purity a switch of its world's crystal wants at its world's warmth (null: no crystal there switches a current). */
export function crystalNeed(
  ctx: PopulationContext,
): { readonly subst: string; readonly gap: number; readonly nines: number } | null {
  const c = holdsOf(ctx).crystal;
  if (!c) return null;
  const formula = findSubstance(c.subst)?.formula,
    // (A Creator's binding widens every gap as it deepens every bond: rules/laws.ts.)
    binding = ctx.generated.laws?.binding ?? 1,
    gap = (PROPERTIES[c.subst]?.bandGap ?? (formula ? bandGapOf(formula) : null) ?? 1.1) * binding,
    kelvin = ctx.generated.planet.meanTemperature + 273.15;
  return {
    subst: c.subst,
    gap,
    nines: purityNeeded(gap, Math.max(20, kelvin), atomsPerM3(c.subst)),
  };
}

/** A land's facts as its ways are asked of. */
function factsAt(ctx: PopulationContext, cell: number, row: Making | undefined): WayFacts {
  const g = ctx.generated,
    held = holdsOf(ctx),
    chem = worldChemistry(g),
    here = (id: string) => knows(ctx, cell, id),
    m = ctx.world.store<MarketStore>("economy.markets").get(cell),
    heat = ctx.affords.fire
      ? furnaceHeat(ctx, cell)
      : (() => {
          const r = reachIn(meansOfWorld(g), here);
          return typeof r === "number" ? r : 0;
        })();
  return {
    heat,
    knows: here,
    made: (w) => {
      const i = WAY_INDEX.get(w);
      return i !== undefined && !!((row?.made ?? 0) & (1 << i));
    },
    ppm: (el) => {
      let p = held.ppm.get(el);
      if (p === undefined) held.ppm.set(el, (p = crustPpm(chem, el)));
      return p;
    },
    rock: (s) => held.rock.has(s),
    air: (s) => held.air.has(s),
    fuel:
      (g.deep.coal[cell] ?? 0) > 0 ||
      (g.deep.oil[cell] ?? 0) > 0 ||
      (m?.stock[G.coal] ?? 0) > 0 ||
      (m?.stock[G.oil] ?? 0) > 0,
    crystal: held.crystal,
  };
}

/** The ways open to a land now, and why the rest are shut (for its page). */
export function waysAt(
  ctx: PopulationContext,
  cell: number,
): {
  /** Each open way, with the heat it wants here. */
  readonly open: readonly (readonly [MaterialWay, number])[];
  readonly shut: readonly (readonly [MaterialWay, string])[];
} {
  const row = materialsOf(ctx.world)?.get(cell),
    f = factsAt(ctx, cell, row),
    open: [MaterialWay, number][] = [],
    shut: [MaterialWay, string][] = [];
  for (const w of MATERIAL_WAYS) {
    if (f.made(w.id)) continue;
    const o = wayOpen(w, f);
    if (o.open) open.push([w, w.heat(f)]);
    else shut.push([w, o.shut!]);
  }
  return { open, shut };
}

/** The heat a land's hottest fire reaches, as its ways read it (°C). */
export function makingHeat(ctx: PopulationContext, cell: number): number {
  return factsAt(ctx, cell, materialsOf(ctx.world)?.get(cell)).heat;
}

// —— The year ——————————————————————————————————————————————————————————————————————————————————————————————

const stepped = (p: number) => 1 - dmath.pow(1 - Math.min(1, Math.max(0, p)), MATERIALS_EVERY);

/** Each land in its turn: what it finds, what it takes up from its neighbours, how pure it refines. */
export function materialsYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = materialsOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    lore = loreOf(world),
    letters = lettersOf(world),
    culture = cultureOf(world),
    realms = politiesOf(world),
    markets = world.store<MarketStore>("economy.markets");
  for (const prov of ctx.provinces.all()) {
    const cell = prov.cell;
    if ((cell + year) % MATERIALS_EVERY !== 0 || !prov.total()) continue;
    const was = store.get(cell);
    // (A land with no fire and no craft has nothing to make: it waits until it has metalworking or pottery.)
    if (!was && !knows(ctx, cell, "metalworking") && !knows(ctx, cell, "pottery")) continue;
    const row: Making = was
        ? { ...was, years: [...was.years] }
        : { cell, made: 0, purity: 0, year: 0, event: null, years: MATERIAL_WAYS.map(() => 0) },
      f = factsAt(ctx, cell, row),
      here = f.knows,
      crafters = prov.occupation(OCC.crafter);
    let inquiry = -1;
    const inquiryHere = () => {
      if (inquiry >= 0) return inquiry;
      const ways = culture.get(cell);
      return (inquiry = inquiryOf(
        (letters?.of(cell) ?? 0) * prov.total(),
        measuresOf(here),
        ways?.traits[WAY.openness] ?? 0.5,
        ways?.traits[WAY.tradition] ?? 0.5,
      ));
    };
    const open = MATERIAL_WAYS.filter((w) => !f.made(w.id) && wayOpen(w, f).open);
    let came: { way: MaterialWay; found: boolean; from: number | null; by: number } | null = null;
    for (const w of open) {
      const many = 1 + dmath.log10(1 + crafters / 10_000),
        finding = (1 - w.depth) * many + w.depth * inquiryHere(),
        chance = stepped(w.rate * (0.3 + Math.min(1, crafters / 50)) * finding);
      if (world.rng.real(FIND, cell, t, WAY_INDEX.get(w.id)!) < chance) {
        came = {
          way: w,
          found: true,
          from: null,
          by: Math.round((100 * w.depth * inquiryHere()) / finding),
        };
        break;
      }
    }
    if (!came && open.length) {
      // Taken up from a neighbour by land or sea that has made it.
      const near = [
        ...g.grid.neighbours.subarray(g.grid.offsets[cell]!, g.grid.offsets[cell + 1]!),
        ...markets.seaPartners(cell),
      ];
      let best: { way: MaterialWay; from: number; chance: number } | null = null;
      for (const n of near) {
        const theirs = store.get(n);
        if (!theirs) continue;
        const road = markets.route(cell, n) ? 2 : 1,
          kin = realms.of(cell) && realms.of(cell) === realms.of(n) ? 1.5 : 1;
        for (const w of open) {
          if (!(theirs.made & (1 << WAY_INDEX.get(w.id)!))) continue;
          const chance = stepped(MATERIALS_LEARNING * road * kin);
          if (!best || chance > best.chance || (chance === best.chance && n < best.from))
            best = { way: w, from: n, chance };
        }
      }
      if (best && world.rng.real(LEARN, cell, t, 0) < best.chance)
        came = { way: best.way, found: false, from: best.from, by: 0 };
    }
    if (came) {
      const i = WAY_INDEX.get(came.way.id)!,
        tool = came.way.tools
          .flatMap((entry) => entry.split("|"))
          .map((p) => lore.get(cell, p)?.event)
          .find((e) => e !== undefined),
        causes: CauseRef[] = [
          ...(tool ? [{ ref: tool, role: "enabler" as const, weight: 0.5 }] : []),
          ...(came.from !== null && store.get(came.from)?.event
            ? [{ ref: store.get(came.from)!.event!, role: "trigger" as const, weight: 0.7 }]
            : []),
        ],
        event = world.events.emit({
          type: came.found ? MATERIALS_EVENTS.found.type : MATERIALS_EVENTS.learned.type,
          place: cellRef(0, cell),
          causes,
          data: {
            way: came.way.id,
            heat: came.way.heat(f),
            ...(came.from !== null ? { from: came.from } : {}),
            ...(came.by >= 5 ? { by: came.by } : {}),
          },
        });
      row.made |= 1 << i;
      row.years[i] = year;
      row.year = year;
      row.event = event;
    }
    // Its practice: what it refines comes toward the purest its methods allow.
    const ceiling = purityCeiling(here, (w) => !!(row.made & (1 << (WAY_INDEX.get(w) ?? 31)))),
      p = row.purity / 100;
    if (ceiling > p) {
      const pace = PURITY_PACE * Math.min(3, inquiryHere());
      row.purity = Math.round(100 * (p + (ceiling - p) * stepped(pace)));
    } else if (ceiling < p) row.purity = Math.round(100 * ceiling);
    if (!was || came || row.purity !== was.purity) store.set(row);
  }
}

// —— What history reads of it ——————————————————————————————————————————————————————————————————————————————

const GAINS = new Map<string, number>();

/** A world's warmth in tens of kelvin (a metal's figures are read at it: a whole world, not a season). */
const warmthOf = (ctx: PopulationContext) =>
  10 * Math.round((ctx.generated.planet.meanTemperature + 273.15) / 10);

/**
 * How much keener a host's metal kit is than its material's usual: by what its seat has made of its metal (tempered iron
 * edges, crucible and alloy steel), and by its world's warmth against the 15 °C its usual is reckoned at (iron below its
 * brittle point breaks). 1 where nothing moves it, or where its stuff is its world's own (bog, native, carbide iron).
 */
export function kitGain(
  ctx: PopulationContext,
  seat: number,
  material: string,
  stuff: string,
): number {
  const recipe = METAL_RECIPES[stuff];
  if (!recipe) return 1;
  const store = materialsOf(ctx.world),
    usual = METALS[stuff as keyof typeof METALS] !== undefined && stuff === material,
    treated = usual && store ? treatedRecipe(material, (w) => store.made(seat, w)) : null,
    kelvin = warmthOf(ctx),
    // (Its universe's binding: its atoms hold faster and melt hotter, rules/laws.ts.)
    binding = ctx.generated.laws?.binding ?? 1,
    key = `${stuff}:${treated ? JSON.stringify(treated) : "-"}:${kelvin}:${binding}`;
  let gain = GAINS.get(key);
  if (gain === undefined) {
    if (GAINS.size > 256) GAINS.clear();
    const base = recipeEdge(recipe),
      here = recipeEdge({ ...(treated ?? recipe), kelvin, binding });
    gain =
      here.keen === base.keen && here.tough === base.tough
        ? 1
        : qualityOf(here, 0.5, 15) / qualityOf(base, 0.5, 15);
    GAINS.set(key, gain);
  }
  return gain;
}

/** How fast a host's kit wears against Earth's iron's (1): its metal's rust under its world's air is a share of its wear. */
export function kitWear(ctx: PopulationContext, metal: string): number {
  const formula = findSubstance(metal)?.formula,
    host = formula ? metalMake(formula)?.host : null;
  if (!host || !ATOMS[host]) return 1;
  const chem = worldChemistry(ctx.generated),
    wet = meansNumbers(ctx.generated).seaIsWater,
    o2 = meansNumbers(ctx.generated).freeOxygen ? chem.o2 : 0,
    rust = rustRate(host, o2, wet) / rustRate("Fe", 0.2095, true);
  return 1 - RUST_SHARE + RUST_SHARE * Math.min(3, rust);
}

// —— What the made stuffs do elsewhere ——————————————————————————————————————————————————————————

/** What of a land's building is rebuilt in reinforced concrete once it makes it (est: its frames, not every home), and over how many years. */
export const CONCRETE_SHARE = 0.6,
  REBUILD_YEARS = 50;

/** What of a land stands in reinforced concrete this year: its share, as the years since it came to it rebuild it (0: it has not). */
export function concreteBuilt(world: World, cell: number, year: number): number {
  const since = materialsOf(world)?.madeIn(cell, "reinforced-concrete") ?? null;
  if (since === null) return 0;
  return CONCRETE_SHARE * Math.min(1, Math.max(0, year - since + 1) / REBUILD_YEARS);
}

/** How much farther a land's ships carry once a lodestone's needle finds north out of sight of land (est: half again). */
export const COMPASS_REACH = 1.5;

/** A land's ships' reach against what its ship-crafts give: half again with the lodestone's needle. */
export function compassReach(world: World, cell: number): number {
  if (!materialsOf(world)?.made(cell, "lodestone")) return 1;
  // (A needle points only where its world's core turns over in one strong dipole: sim/planet/motion.ts homeField.)
  const f = homeField(populationContext(world).generated);
  return f.dynamo && f.dipole ? COMPASS_REACH : 1;
}

/** What a land's flying machines are framed in: glass fibre, else the light alloy, else the steel their figures are reckoned for (null). */
export function frameStuffOf(world: World, cell: number): "glass-fibre" | "light-alloy" | null {
  const m = materialsOf(world);
  if (m?.made(cell, "glass-fibre")) return "glass-fibre";
  if (m?.made(cell, "light-alloy")) return "light-alloy";
  return null;
}

/** A land's flying machines' frame share (rules/reach.ts FRAME_SHARE with steel), lighter in what it makes. */
export function flyerFrameOf(world: World, cell: number): number {
  return flyerFrame(FRAME_SHARE, frameStuffOf(world, cell));
}

/** The launch frames a land's made stuffs give it beside steel's (rules/launch.ts FRAMES): each stage's dry share, from its walls' stuff. */
export function madeFrames(world: World, cell: number): readonly Frame[] {
  const m = materialsOf(world),
    out: Frame[] = [];
  // (What a tonne of each costs against steel's, est: aluminium is won by current, glass fibre drawn and set in resin.)
  if (m?.made(cell, "light-alloy"))
    out.push({
      id: "alloy-frame",
      words: "frames of light alloy",
      needs: ["rocketry"],
      dry: stageDry("light-alloy"),
      cost: 1.2,
    });
  if (m?.made(cell, "glass-fibre"))
    out.push({
      id: "fibre-frame",
      words: "frames wound of glass fibre",
      needs: ["rocketry"],
      dry: stageDry("glass-fibre"),
      cost: 1.3,
    });
  return out;
}

/** Teach a peopled world what its lands make. */
export function installMaterials(world: World, ctx: () => PopulationContext): MaterialsStore {
  const store = world.register(new MaterialsStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "158.lore.materials", every: YEAR, run: (t) => materialsYear(ctx(), t) });
  return store;
}
