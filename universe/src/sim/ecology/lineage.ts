// Life's kinds in play (Round D; the rules are rules/lineage.ts). Two things, each a land at a time, a fifth of the
// lands a year and each five years at once:
// - Kinds branching: a stock cut off (on a small body of land, or on one the risen sea has cut off: planet/motion.ts)
//   goes apart from its kind a generation at a time, the faster the shorter its generations and the harder it is
//   pressed; gone far enough it is a new kind of its own (the tree's new kinds, ecology/herds.ts), smaller or larger by
//   Foster's island rule.
// - Selection in play: each kind's stock keeps a few heritable traits (size, coat, wariness; rules/lineage.ts TRAITS) that
//   move a generation at a time toward what its lands ask by the breeder's equation: warmth turned from what it was made
//   for asks for a coat and a size, a people's hunting for wariness and a smaller body. What a kind has become is how it
//   fares on its lands (ecology/herds.ts holdsHere: its coat against the warmth, its wariness against the hunt) and how
//   one of it moves in the hand (hand/wild.ts).
// - Kinds parted on the land: a stock of a kind's lands parted from the rest of its range by ground it cannot cross
//   (heights, dry or frozen ground, a great river, for a swimmer the land), read off the ground between, goes its own way:
//   selected toward what its own lands ask, pulled back by what crosses the barrier, drifting. Gone far enough apart, by
//   drift and by what each side was selected for, it is a kind of its own, the barrier and the selection its causes.
// - Hunter and prey selecting each other (2026-11-24, rules/heredity.ts raceStep): each kind that is a land's great herd
//   and the hunting kind that lives on the most of its lands run a race, the prey's wariness against the hunter's
//   keenness, each moved a generation at a time by what the other's trait gains or costs it (the prey for its life, the
//   hunter for its dinner). As made, the two stand where neither gains by moving; a prey a people's hunt has made warier
//   moves its hunter, and its hunter so moved moves the prey in turn. One number a hunted kind.
// - Partners and parasites: the land's beasts and its people's flocks carry what lives off them, endemic where they
//   crowd past what it needs to pass from one to the next, kept down by the eaters of the dead and the small hunters
//   that pick them clean; the seed carriers spread what the wild gives. What they take and give is the year's food
//   (population/systems.ts foodMonth): exactly nothing where none of it stands.
import {
  YEAR,
  defineEventType,
  dmath,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { BIOME, cellRef, isProvinceWorld, lives, type Species } from "../../gen/index.ts";
import {
  BARRIERS,
  HERD,
  ISOLATES,
  LINEAGE,
  OCC,
  PARASITES,
  SELECTION,
  TRAITS,
  apartness,
  divergence,
  generationYears,
  islandSize,
  migrated,
  newKindOf,
  parasiteLoad,
  parasiteToll,
  HEREDITY,
  raceFrom,
  selected,
  traitFit,
  traitsAsked,
  waryEscape,
  type Barrier,
} from "../../rules/index.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import { HERD_YIELD } from "../population/model.ts";
import { HERD_EVENTS, herdIndex, herdStock, herdsOf } from "./herds.ts";
import { ecologyOf } from "./ecology.ts";
import { shiftNow } from "../planet/motion.ts";

export const LINEAGE_EVENTS = {
  /** A hunter's keenness has gone a quarter of a spread from what it was made, by what its prey has become. */
  race: defineEventType("life.arms-race", 3),
  /** A people's flocks grown heavy with what lives off them. */
  parasites: defineEventType("life.parasites-heavy", 3),
  /** A kind's stock changed by what its lands select: a spread of size, coat or wariness from where it was first seen. */
  changed: defineEventType("life.kind-changed", 3),
};

/** A kind's stock's traits (thousandths of a spread, TRAITS' order): now, and where they stood when first seen; what has been told (a bit a trait and way). */
export type KindTraits = {
  readonly kind: number;
  z: [number, number, number];
  readonly from: readonly [number, number, number];
  told: number;
};

/** A stock of a kind's parted from the rest of its range: its traits (thousandths), how far it has gone toward a kind of its own (thousandths of the way, unrounded), what parts it. */
export type Isolate = {
  readonly cell: number;
  readonly kind: number;
  z: [number, number, number];
  drift: number;
  readonly barrier: Barrier;
};

/** A stock behind a barrier as the ground lies (read once, not state): its kind, its lands, what parts it and where. */
type Site = {
  readonly cell: number;
  readonly kind: number;
  readonly lands: Int32Array;
  readonly barrier: Barrier;
  readonly across: number;
};
type Sites = {
  readonly key: string;
  /** Each kind's lands not behind a barrier, by its species index. */
  readonly main: ReadonlyMap<number, Int32Array>;
  readonly sites: readonly Site[];
  /** A land behind a barrier: its site. */
  readonly at: ReadonlyMap<number, Site>;
};

/** A fifth of the lands a year, each five years at once. */
export const LINEAGE_STEP = 5;

/** A land's partners and parasites (thousandths). */
export type Partners = {
  readonly cell: number;
  /** The load of what lives off its flocks, and off its wild beasts. */
  flocks: number;
  wild: number;
  /** How much the eaters of the dead and the small hunters keep it down; what its seed carriers give. */
  cleaned: number;
  carried: number;
  /** What it takes of its flocks' yield (thousandths), and the event of its turning heavy (null once eased). */
  toll: number;
  heavy: Ref | null;
};

/**
 * A hunted kind and the hunter on the most of its lands: how far the hunter's keenness has gone from what it was made
 * (thousandths of a spread), selected by what its prey's wariness has become (the prey's is its own trait, KindTraits).
 */
export type Race = {
  readonly prey: number;
  hunter: number;
  y: number;
  told: 0 | 1;
};

export class LineageStore implements StateStore {
  readonly name = "life.lineage";
  /** Each cut-off land's stock gone apart from its kind (thousandths of the way to a kind of its own, unrounded). */
  readonly apart = new Map<number, number>();
  readonly lands = new Map<number, Partners>();
  /** Each kind's traits in play, by its species index; each stock behind a barrier, by its first land. */
  readonly traits = new Map<number, KindTraits>();
  readonly isolates = new Map<number, Isolate>();
  /** Each hunted kind's race with its hunter, by its species index. */
  readonly races = new Map<number, Race>();
  /** Read from the ground, not state. */
  sites: Sites | null = null;
  dormant(): boolean {
    return (
      this.apart.size === 0 &&
      this.lands.size === 0 &&
      this.traits.size === 0 &&
      this.isolates.size === 0
    );
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const l of this.lands.values()) if (l.heavy) out.push(l.heavy);
    return out;
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    const sorted = <T>(m: Map<number, T>) => [...m.entries()].sort((a, b) => a[0] - b[0]);
    h.value(sorted(this.apart)).value(sorted(this.lands));
    // (Selection's, only once any is kept: a world saved before keeps its hash until its first.)
    if (this.traits.size || this.isolates.size)
      h.value(sorted(this.traits)).value(sorted(this.isolates));
    if (this.races.size) h.value(sorted(this.races));
  }
  save(): unknown {
    if (this.dormant()) return {};
    const sorted = <T>(m: Map<number, T>) => [...m.entries()].sort((a, b) => a[0] - b[0]);
    return {
      apart: sorted(this.apart),
      lands: sorted(this.lands).map(([, v]) => v),
      ...(this.traits.size ? { traits: sorted(this.traits).map(([, v]) => v) } : {}),
      ...(this.isolates.size ? { isolates: sorted(this.isolates).map(([, v]) => v) } : {}),
      ...(this.races.size ? { races: sorted(this.races).map(([, v]) => v) } : {}),
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      apart?: [number, number][];
      lands?: Partners[];
      traits?: KindTraits[];
      isolates?: Isolate[];
      races?: Race[];
    };
    this.races.clear();
    for (const r of s.races ?? []) this.races.set(r.prey, { ...r });
    this.traits.clear();
    for (const k of s.traits ?? [])
      this.traits.set(k.kind, { ...k, z: [...k.z], from: [...k.from] });
    this.isolates.clear();
    for (const k of s.isolates ?? []) this.isolates.set(k.cell, { ...k, z: [...k.z] });
    this.apart.clear();
    for (const [c, v] of s.apart ?? []) this.apart.set(c, v);
    this.lands.clear();
    for (const l of s.lands ?? []) this.lands.set(l.cell, { ...l });
  }
}

export function kindsInPlayOf(world: World): LineageStore | null {
  return world.peek<LineageStore>("life.lineage") ?? null;
}

/** What a land's partners and parasites do to its year's food: its flocks' and its wild's shares (exactly 1 where none stand). */
export function partnersOf(world: World, cell: number): { flocks: number; wild: number } {
  const l = kindsInPlayOf(world)?.lands.get(cell);
  if (!l) return ONE;
  const crowd = 0,
    wild = (1 - parasiteToll(l.wild / 1000, crowd)) * (1 + (PARASITES.carriers * l.carried) / 1000);
  return { flocks: 1 - l.toll / 1000, wild };
}
const ONE = { flocks: 1, wild: 1 } as const;

const CUT = new Map<string, readonly number[]>();
/** The lands cut off now: as the world was made, and where the sea has risen or fallen, the small bodies of land it leaves. */
function cutOffNow(ctx: PopulationContext): readonly number[] {
  const idx = herdIndex(ctx)!,
    shift = shiftNow(ctx.world);
  if (!shift.sea) return idx.cutOff;
  const key = `${idx.key}:${shift.key}`;
  let kept = CUT.get(key);
  if (kept) return kept;
  const g = ctx.generated,
    n = idx.lands,
    land = new Uint8Array(n);
  for (let c = 0; c < n; c++)
    land[c] =
      idx.kind[c]! >= 0 &&
      provinceCapacity(ctx, c).areaKm2 > 0 &&
      provinceCapacity(ctx, c).forage > 0
        ? 1
        : 0;
  const seen = new Uint8Array(n),
    out: number[] = [];
  for (let c = 0; c < n; c++) {
    if (!land[c] || seen[c]) continue;
    const body = [c];
    seen[c] = 1;
    for (let i = 0; i < body.length; i++) {
      const at = body[i]!;
      for (let k = g.grid.offsets[at]!; k < g.grid.offsets[at + 1]!; k++) {
        const m = g.grid.neighbours[k]!;
        if (m >= n || seen[m] || !land[m]) continue;
        seen[m] = 1;
        body.push(m);
      }
    }
    if (body.length <= LINEAGE.cutOff) out.push(...body);
  }
  kept = out.sort((a, b) => a - b);
  CUT.set(key, kept);
  if (CUT.size > 8) CUT.delete(CUT.keys().next().value!);
  return kept;
}

/** The year's work on life's kinds: a fifth of the cut-off lands go apart, a fifth of the peopled lands' partners move. */
export function lineageYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = kindsInPlayOf(world),
    herds = herdsOf(world);
  if (!store || !herds?.begun || !isProvinceWorld(g)) return;
  const year = yearOfMoment(t),
    idx = herdIndex(ctx)!,
    wilds = ecologyOf(world),
    shift = shiftNow(world),
    years = LINEAGE_STEP;
  // Kinds branching on the lands cut off.
  const cut = new Set(cutOffNow(ctx));
  for (const c of [...store.apart.keys()]) if (!cut.has(c)) store.apart.delete(c);
  for (const c of cut) {
    if ((c + year) % LINEAGE_STEP !== 0) continue;
    const kind = idx.kind[c]!,
      parent = g.life.species[kind];
    if (!parent || parent.died !== null || herds.kinds.some((k) => k.cell === c)) continue;
    if (herds.gone.some((k) => k.species === kind)) continue;
    const w = wilds.get(c),
      hunted = w ? 1 - Math.min(1, w.wild) : 0,
      was = store.apart.get(c) ?? 0,
      // (Unrounded: rounded, a beast of 300 kg cut off and unpressed gained a third of a thousandth in five years, and
      // never moved.)
      now = Math.min(1000, was + 1000 * years * divergence(parent.size, hunted, shift.warm));
    store.apart.set(c, now);
    if (
      now < 1000 ||
      year < LINEAGE.since ||
      herds.kinds.length >= LINEAGE.newMost ||
      (herds.stock[c] ?? 0) < HERD.least
    )
      continue;
    const isHunted = hunted > 0.3,
      named = newKindOf(parent.name, herds.kinds.length + c, isHunted),
      grown = islandSize(parent.size, idx.area[c]!, isHunted),
      event = world.events.emit({
        type: HERD_EVENTS.kindNew.type,
        subjects: [parent.ref as Ref],
        place: cellRef(0, c) as Ref,
        causes: [{ ref: parent.ref as Ref, role: "trigger", weight: 1 }],
        data: {
          name: named.name.replace(/^(little|great)/, grown.how === "smaller" ? "little" : "great"),
          parent: parent.name,
          how: grown.how,
        },
      });
    herds.kinds.push({
      id: herds.kinds.length + 1,
      name: named.name.replace(/^(little|great)/, grown.how === "smaller" ? "little" : "great"),
      parent: kind,
      cell: c,
      year,
      how: grown.how,
      size: Math.round(parent.size * grown.size),
      event,
    });
    herds.lastNew = year;
    herds.tally.newKinds++;
    store.apart.delete(c);
  }
  // Selection in play, and kinds parted on the land.
  selectionYear(ctx, store, year);
  // Partners and parasites on the peopled lands.
  for (const p of ctx.provinces.all()) {
    const c = p.cell;
    if (c >= idx.lands || (c + year) % LINEAGE_STEP !== 0) continue;
    const people = p.total(),
      w = wilds.get(c);
    if (people <= 0 || !w) {
      store.lands.delete(c);
      continue;
    }
    const cleaned =
        PARASITES.cleaners * (w.scavengerOf >= 0 ? Math.min(1, w.carrion) : 0) +
        PARASITES.cleaners * (w.lesserOf >= 0 ? Math.min(1, w.lesser) : 0),
      cap = provinceCapacity(ctx, c),
      pastureKm2 = cap.pasture / HERD_YIELD,
      head = p.herding ? p.occupation(OCC.herder) * PARASITES.headPerHerder : 0,
      density = pastureKm2 > 0 ? head / pastureKm2 : 0,
      flockTo = parasiteLoad(density, PARASITES.threshold, cleaned),
      wildTo = parasiteLoad(herdStock(ctx, c), PARASITES.wildThreshold, cleaned);
    let carriers = 0;
    for (const s of g.life.species)
      if (
        s.died === null &&
        (s.niche === "seed-eater" || s.niche === "browser") &&
        lives(g.life, c, s.index)
      )
        carriers++;
    const l = store.lands.get(c) ?? {
        cell: c,
        flocks: 0,
        wild: 0,
        cleaned: 0,
        carried: 0,
        toll: 0,
        heavy: null,
      },
      pace = 1 - dmath.pow(1 - PARASITES.pace, years);
    l.flocks = Math.round(l.flocks + pace * (1000 * flockTo - l.flocks));
    l.wild = Math.round(l.wild + pace * (1000 * wildTo - l.wild));
    l.cleaned = Math.round(1000 * cleaned);
    l.carried = Math.round(1000 * Math.min(1, carriers / 2));
    l.toll = Math.round(1000 * parasiteToll(l.flocks / 1000, head));
    if (!l.heavy && l.toll >= 100)
      l.heavy = world.events.emit({
        type: LINEAGE_EVENTS.parasites.type,
        place: p.ref,
        causes: p.herding ? [{ ref: p.herding, role: "enabler", weight: 1 }] : [],
        data: { toll: Math.round(l.toll / 10), head: Math.round(head) },
      });
    else if (l.heavy && l.toll < 50) l.heavy = null;
    if (l.flocks || l.wild || l.carried) store.lands.set(c, l);
    else store.lands.delete(c);
  }
}

// —— Selection in play, and kinds parted on the land ———————————————————————————————————————————————

/** What parts a land of a kind's range from the ground beside it, read off that ground (null: nothing, it is the kind's too). */
function barrierOf(ctx: PopulationContext, s: Species, from: number, to: number): Barrier | null {
  const g = ctx.generated,
    b = g.climate.biome[to]!,
    sea = b <= BIOME.seaIce;
  if (ctx.medium === "water") return sea ? null : "sea";
  if (sea) return "sea";
  if (g.tectonics.elevation[to]! >= ISOLATES.heights || b === BIOME.alpine) return "heights";
  if (b === BIOME.hotDesert || b === BIOME.coldDesert) return "dry";
  if (b === BIOME.ice || b === BIOME.tundra) return "cold";
  if (g.climate.precipitation[to]! < s.rainMin) return "dry";
  if (g.climate.temperature[to]! < s.warm - s.tolerance) return "cold";
  return g.tectonics.elevation[to]! > g.tectonics.elevation[from]! + 800 ? "heights" : "dry";
}

/** Ground no beast's herds keep to (heights, dry or frozen ground), whatever thin few live on it; null: open ground. */
function hostile(ctx: PopulationContext, c: number): Barrier | null {
  const g = ctx.generated,
    b = g.climate.biome[c]!;
  if (ctx.medium === "water") return null;
  if (g.tectonics.elevation[c]! >= ISOLATES.heights || b === BIOME.alpine) return "heights";
  if (b === BIOME.hotDesert || b === BIOME.coldDesert) return "dry";
  if (b === BIOME.ice || b === BIOME.tundra) return "cold";
  return null;
}

/** The stocks behind barriers as the ground lies, read once (and again where the ground has moved). */
function sitesOf(ctx: PopulationContext, store: LineageStore): Sites {
  const idx = herdIndex(ctx)!;
  if (store.sites?.key === idx.key) return store.sites;
  const g = ctx.generated,
    n = idx.lands,
    { offsets, neighbours } = g.grid,
    water = g.water;
  // (A river parts its banks where it carries a share of its world's greatest, by the root: the great rivers only.)
  let greatest = 0;
  for (let c = 0; c < n; c++)
    if (water.river[c] && water.discharge[c]! > greatest) greatest = water.discharge[c]!;
  const great = (c: number) =>
      ctx.medium !== "water" &&
      water.river[c] === 1 &&
      greatest > 0 &&
      Math.sqrt(water.discharge[c]! / greatest) >= ISOLATES.river,
    kinds = new Set<number>();
  for (let c = 0; c < n; c++) if (idx.kind[c]! >= 0) kinds.add(idx.kind[c]!);
  const main = new Map<number, Int32Array>(),
    sites: Site[] = [],
    comp = new Int32Array(n).fill(-1);
  for (const kind of [...kinds].sort((a, b) => a - b)) {
    const s = g.life.species[kind];
    if (!s) continue;
    const inRange = (c: number) =>
        idx.green[c]! > 0 && (idx.kind[c] === kind || lives(g.life, c, kind)),
      // (Ground it lives on only thinly, where it is not the land's great herd, it crosses little: heights, dry or frozen
      // ground, a great river.)
      parting = (c: number): Barrier | null =>
        idx.kind[c] === kind ? null : great(c) ? "river" : hostile(ctx, c);
    // The kind's range in bodies the beasts can walk (or swim) between: a great river's own lands part its banks.
    const bodies: { lands: number; herd: number[]; across: Map<Barrier, number> }[] = [];
    for (let c = 0; c < n; c++) {
      if (comp[c] === kind || !inRange(c) || parting(c)) continue;
      const body = [c],
        herd: number[] = [],
        across = new Map<Barrier, number>();
      comp[c] = kind;
      for (let i = 0; i < body.length; i++) {
        const at = body[i]!;
        if (idx.kind[at] === kind) herd.push(at);
        for (let k = offsets[at]!; k < offsets[at + 1]!; k++) {
          const m = neighbours[k]!;
          if (m >= n || comp[m] === kind) continue;
          const parts = inRange(m) ? parting(m) : barrierOf(ctx, s, at, m);
          if (inRange(m) && !parts) {
            comp[m] = kind;
            body.push(m);
          } else if (parts && !across.has(parts)) across.set(parts, m);
        }
      }
      if (herd.length) bodies.push({ lands: body.length, herd, across });
    }
    if (!bodies.length) continue;
    // The greatest body is the kind's own; the rest, of enough of its lands and not small bodies of land (an island's own rule), are parted.
    let big = 0;
    for (let i = 1; i < bodies.length; i++)
      if (bodies[i]!.herd.length > bodies[big]!.herd.length) big = i;
    const own: number[] = [];
    bodies.forEach((b, i) => {
      if (i !== big && b.herd.length >= ISOLATES.least && b.lands > LINEAGE.cutOff) {
        // (What parts it from the rest: of the ground its edge meets, the most crossed, since its kind comes over that way;
        // the sea only where nothing else bounds it, for its open shore parts it from nothing on its own side of the water.)
        let why: Barrier = "sea",
          at = -1;
        for (const [w, m] of b.across)
          if (
            at < 0 ||
            (why === "sea" && w !== "sea") ||
            (w !== "sea" && BARRIERS[w] > BARRIERS[why])
          ) {
            why = w;
            at = m;
          }
        if (at >= 0) {
          b.herd.sort((x, y) => x - y);
          sites.push({
            cell: b.herd[0]!,
            kind,
            lands: Int32Array.from(b.herd),
            barrier: why,
            across: at,
          });
          return;
        }
      }
      own.push(...b.herd);
    });
    main.set(kind, Int32Array.from(farEnds(ctx, s, own, sites).sort((a, b) => a - b)));
  }
  // (The greatest stocks behind barriers, so many at most; the rest are counted their kind's own.)
  sites.sort((a, b) => b.lands.length - a.lands.length || a.cell - b.cell);
  const kept = sites.slice(0, ISOLATES.most),
    at = new Map<number, Site>();
  for (const st of sites.slice(ISOLATES.most)) {
    const m = main.get(st.kind) ?? new Int32Array(0);
    main.set(st.kind, Int32Array.from([...m, ...st.lands].sort((a, b) => a - b)));
  }
  for (const st of kept) for (const c of st.lands) at.set(c, st);
  store.sites = { key: idx.key, main, sites: kept, at };
  return store.sites;
}

/**
 * A range's far ends, with nothing between them and the rest but its length: its lands whose warmth asks a coat a spread
 * and more from what the whole range asks, together, enough of them, are each a stock of its own, mixing with the rest
 * only so much (BARRIERS.far). Pushed to `sites`; what is left is the kind's own.
 */
function farEnds(ctx: PopulationContext, s: Species, own: number[], sites: Site[]): number[] {
  if (own.length < ISOLATES.span) return own;
  const g = ctx.generated,
    asked = new Map<number, number>();
  let mean = 0;
  for (const c of own) {
    const a = traitsAsked(s.warm - g.climate.temperature[c]!, 0)[1]!;
    asked.set(c, a);
    mean += a;
  }
  mean /= own.length;
  const side = (c: number) => {
      const d = asked.get(c)! - mean;
      return d >= ISOLATES.cline ? 1 : d <= -ISOLATES.cline ? -1 : 0;
    },
    { offsets, neighbours } = g.grid,
    taken = new Set<number>();
  for (const c of own) {
    const way = side(c);
    if (!way || taken.has(c)) continue;
    const end = [c];
    let across = -1;
    taken.add(c);
    for (let i = 0; i < end.length; i++) {
      const at = end[i]!;
      for (let k = offsets[at]!; k < offsets[at + 1]!; k++) {
        const m = neighbours[k]!;
        if (!asked.has(m) || taken.has(m)) continue;
        if (side(m) === way) {
          taken.add(m);
          end.push(m);
        } else if (across < 0) across = m;
      }
    }
    if (end.length < ISOLATES.endLeast || across < 0) {
      for (const x of end) taken.delete(x);
      // (Too few to be a stock of their own: left with the rest, and not looked at again.)
      for (const x of end) asked.set(x, mean);
      continue;
    }
    end.sort((a, b) => a - b);
    sites.push({
      cell: end[0]!,
      kind: s.index,
      lands: Int32Array.from(end),
      barrier: "far",
      across,
    });
  }
  return own.filter((c) => !taken.has(c));
}

/** How hard a land's people hunt its game (0 … 1: its wild thinned to nothing). */
function huntedOn(ctx: PopulationContext, c: number): number {
  const w = ecologyOf(ctx.world).get(c);
  return w ? 1 - Math.min(1, w.wild) : 0;
}

/** What a set of a kind's lands asks of its traits, weighed by the beasts on each: now, and as made (no hunt, the warmth as made). */
function askedOver(
  ctx: PopulationContext,
  s: Species,
  lands: Int32Array,
  warm: number,
): { now: number[]; made: number[]; hunted: number; most: number } {
  const g = ctx.generated,
    herds = herdsOf(ctx.world)!,
    now = [0, 0, 0],
    made = [0, 0, 0];
  let weight = 0,
    hunted = 0,
    most = -1,
    mostHunted = 0;
  for (const c of lands) {
    const wgt = Math.max(1, herds.stock[c] ?? 0),
      colder = s.warm - g.climate.temperature[c]!,
      h = huntedOn(ctx, c),
      a = traitsAsked(colder - warm, h),
      a0 = traitsAsked(colder, 0);
    for (let t = 0; t < 3; t++) {
      now[t] = now[t]! + wgt * a[t]!;
      made[t] = made[t]! + wgt * a0[t]!;
    }
    weight += wgt;
    hunted += wgt * h;
    if (h > mostHunted) {
      mostHunted = h;
      most = c;
    }
  }
  const w = weight || 1;
  return { now: now.map((x) => x / w), made: made.map((x) => x / w), hunted: hunted / w, most };
}

const milli = (x: number) => Math.round(1000 * x);

/**
 * A kind's turn, once in LINEAGE_STEP years: its stock's traits selected toward what its lands ask; each stock of it
 * behind a barrier selected toward its own, pulled back by what crosses, drifting; one gone far enough apart a kind of
 * its own. Told where a trait has gone a spread from where it was first seen.
 */
function selectionYear(ctx: PopulationContext, store: LineageStore, year: number): void {
  const { world, generated: g } = ctx,
    herds = herdsOf(world)!,
    sites = sitesOf(ctx, store),
    warm = shiftNow(world).warm;
  for (const [kind, lands] of sites.main) {
    if ((kind + year) % LINEAGE_STEP !== 0 || !lands.length) continue;
    const s = g.life.species[kind]!;
    if (s.died !== null || !s.body) continue;
    const gens = LINEAGE_STEP / generationYears(s.size),
      asked = askedOver(ctx, s, lands, warm);
    let rec = store.traits.get(kind);
    if (!rec) {
      const from = asked.made.map(milli) as [number, number, number];
      rec = { kind, z: [from[0], from[1], from[2]], from, told: 0 };
      store.traits.set(kind, rec);
    }
    for (let i = 0; i < 3; i++)
      rec.z[i] = milli(selected(rec.z[i]! / 1000, asked.now[i]!, gens, i));
    // A hunter and its prey select each other (rules/heredity.ts raceStep): this kind, a land's great herd, and the hunting
    // kind that lives on the most of its lands.
    if (s.level === 2) {
      let hunter = -1,
        shared = 0;
      for (const o of g.life.species) {
        if (o.level < 3 || o.died !== null || !o.body) continue;
        let n = 0;
        for (const c of lands) if (lives(g.life, c, o.index)) n++;
        if (n > shared) {
          shared = n;
          hunter = o.index;
        }
      }
      if (hunter >= 0) {
        let race = store.races.get(kind);
        if (!race) store.races.set(kind, (race = { prey: kind, hunter, y: 0, told: 0 }));
        race.hunter = hunter;
        const o = g.life.species[hunter]!,
          next = raceFrom(
            rec.z[2]! / 1000,
            race.y / 1000,
            gens,
            LINEAGE_STEP / generationYears(o.size),
            // (How much of the prey's dying this hunter is: the share of its lands the hunter lives on.)
            shared / lands.length,
          );
        // (The hunter answers what its prey has become; the prey, what its hunter has become since it was made.)
        rec.z[2] = milli(next.x);
        race.y = milli(next.y);
        if (!race.told && Math.abs(next.y) >= HEREDITY.raceTold) {
          race.told = 1;
          const by = asked.most >= 0 ? ctx.provinces.get(asked.most) : undefined;
          world.events.emit({
            type: LINEAGE_EVENTS.race.type,
            subjects: [o.ref as Ref, s.ref as Ref],
            place: (by?.ref ?? cellRef(0, lands[0]!)) as Ref,
            causes: [
              { ref: s.ref as Ref, role: "trigger", weight: 1 },
              ...(by ? [{ ref: by.ref, role: "agent" as const, weight: 0.6 }] : []),
            ],
            data: {
              hunter: o.name,
              prey: s.name,
              wary: Math.round(next.x * 10) / 10,
              keen: Math.round(next.y * 100) / 100,
              lands: shared,
            },
          });
        }
      }
    }
    // Told once a trait has gone a spread, each way once.
    for (let i = 0; i < 3; i++) {
      const moved = (rec.z[i]! - rec.from[i]!) / 1000,
        bit = 1 << (2 * i + (moved > 0 ? 0 : 1));
      if (Math.abs(moved) < SELECTION.told || rec.told & bit) continue;
      rec.told |= bit;
      const byHunt =
          i === 2 ||
          (i === 0 && asked.hunted * SELECTION.sizeHunted > Math.abs(warm) / SELECTION.sizeDegrees),
        p = byHunt && asked.most >= 0 ? ctx.provinces.get(asked.most) : undefined;
      world.events.emit({
        type: LINEAGE_EVENTS.changed.type,
        subjects: [s.ref as Ref],
        place: (p?.ref ?? cellRef(0, lands[0]!)) as Ref,
        causes: [
          { ref: s.ref as Ref, role: "trigger", weight: 1 },
          ...(p ? [{ ref: p.ref, role: "agent" as const, weight: 0.8 }] : []),
        ],
        data: {
          beast: s.name,
          trait: TRAITS[i],
          way: moved > 0 ? "more" : "less",
          spreads: Math.round(moved * 10) / 10,
          why: byHunt ? "hunted" : warm > 0 ? "warmer" : "colder",
          warm: Math.round(warm * 10) / 10,
          hunted: Math.round(asked.hunted * 100),
        },
      });
    }
    // Its stocks behind barriers.
    for (const st of sites.sites) {
      if (st.kind !== kind) continue;
      let iso = store.isolates.get(st.cell);
      if (!iso) {
        iso = {
          cell: st.cell,
          kind,
          z: [rec.z[0], rec.z[1], rec.z[2]],
          drift: 0,
          barrier: st.barrier,
        };
        store.isolates.set(st.cell, iso);
      }
      const own = askedOver(ctx, s, st.lands, warm),
        m = BARRIERS[st.barrier];
      for (let i = 0; i < 3; i++) {
        const z = selected(iso.z[i]! / 1000, own.now[i]!, gens, i);
        iso.z[i] = milli(migrated(z, rec.z[i]! / 1000, m, gens));
      }
      // (Unrounded: a great beast's five years are a small part of a thousandth.)
      let gap2 = 0,
        most = 0,
        mostGap = 0;
      for (let i = 0; i < 3; i++) {
        const d = (iso.z[i]! - rec.z[i]!) / 1000;
        gap2 += d * d;
        if (Math.abs(d) > mostGap) {
          mostGap = Math.abs(d);
          most = i;
        }
      }
      const gap = Math.sqrt(gap2);
      // (Unrounded: a great beast's five years are a small part of a thousandth.)
      iso.drift = Math.min(
        1000,
        iso.drift + 1000 * LINEAGE_STEP * apartness(s.size, gap, own.hunted, warm),
      );
      if (
        iso.drift < 1000 ||
        year < LINEAGE.since ||
        herds.kinds.length >= LINEAGE.newMost ||
        herds.kinds.some((k) => k.cell === st.cell) ||
        (herds.stock[st.cell] ?? 0) < HERD.least
      )
        continue;
      // A kind of its own: of the size its own lands selected (against the kind's own), told with what parted it and what set it apart.
      const grew = dmath.exp(SELECTION.sizePerSpread * ((iso.z[0]! - rec.z[0]!) / 1000)),
        how = grew < 1 ? ("smaller" as const) : ("larger" as const),
        named = newKindOf(s.name, herds.kinds.length + st.cell, own.hunted > 0.3),
        name = named.name.replace(/^(little|great)/, how === "smaller" ? "little" : "great"),
        hunter = own.most >= 0 ? ctx.provinces.get(own.most) : undefined,
        event = world.events.emit({
          type: HERD_EVENTS.kindNew.type,
          subjects: [s.ref as Ref],
          place: cellRef(0, st.cell) as Ref,
          causes: [
            { ref: s.ref as Ref, role: "trigger", weight: 1 },
            { ref: cellRef(0, st.across) as Ref, role: "enabler", weight: 0.7 },
            ...(most === 2 && hunter
              ? [{ ref: hunter.ref, role: "agent" as const, weight: 0.5 }]
              : []),
          ],
          data: {
            name,
            parent: s.name,
            how,
            barrier: st.barrier,
            trait: TRAITS[most],
            gap: Math.round(gap * 10) / 10,
            drift: Math.round(iso.drift / 10),
            lands: st.lands.length,
            water: ctx.medium === "water",
          },
        });
      herds.kinds.push({
        id: herds.kinds.length + 1,
        name,
        parent: kind,
        cell: st.cell,
        year,
        how,
        size: Math.round(s.size * grew),
        event,
      });
      herds.lastNew = year;
      herds.tally.newKinds++;
      store.isolates.delete(st.cell);
    }
  }
}

/** A kind's traits on a land: its stock's there (behind a barrier, that stock's), or null where nothing has been selected yet. */
function traitsOn(
  ctx: PopulationContext,
  kind: number,
  cell: number,
): { z: readonly number[]; rec: KindTraits } | null {
  const store = kindsInPlayOf(ctx.world),
    rec = store?.traits.get(kind);
  if (!store || !rec) return null;
  // (Read off the ground the same whether or not this world has read it since it was loaded.)
  const site = sitesOf(ctx, store).at.get(cell),
    iso = site && site.kind === kind ? store.isolates.get(site.cell) : undefined;
  return { z: iso?.z ?? rec.z, rec };
}

/**
 * What a kind has become, on a land (spreads from the kind as made; null where nothing has been selected yet): its size
 * and coat against where they were first seen, its wariness, and its coat against what the land's warmth asks now
 * (> 0: too thick for it).
 */
export function traitsAt(
  ctx: PopulationContext,
  kind: number,
  cell: number,
): { size: number; coat: number; wary: number; heat: number } | null {
  const on = traitsOn(ctx, kind, cell);
  if (!on) return null;
  const { z, rec } = on,
    s = ctx.generated.life.species[kind]!,
    colder = s.warm - ctx.generated.climate.temperature[cell]! - shiftNow(ctx.world).warm;
  return {
    size: (z[0]! - rec.from[0]!) / 1000,
    coat: (z[1]! - rec.from[1]!) / 1000,
    wary: z[2]! / 1000,
    heat: z[1]! / 1000 - traitsAsked(colder, 0)[1]!,
  };
}

/**
 * How a land's beasts of its kind fare for what their kind has become (exactly 1 and 0 where nothing has been selected):
 * their size and coat against the warmth the land has now, against how they fit it as made (Lande's load), and what of
 * the land's hunt their wariness escapes.
 */
export function fitHere(
  ctx: PopulationContext,
  kind: number,
  cell: number,
): { fit: number; escape: number } {
  const on = traitsOn(ctx, kind, cell);
  if (!on) return FIT_AS_MADE;
  const { z, rec } = on,
    s = ctx.generated.life.species[kind]!,
    colder = s.warm - ctx.generated.climate.temperature[cell]!,
    now = traitsAsked(colder - shiftNow(ctx.world).warm, 0),
    made = traitsAsked(colder, 0);
  let gap = 0,
    gap0 = 0;
  for (let i = 0; i < 2; i++) {
    const d = now[i]! - z[i]! / 1000,
      d0 = made[i]! - rec.from[i]! / 1000;
    gap += d * d;
    gap0 += d0 * d0;
  }
  return { fit: traitFit(Math.sqrt(gap), Math.sqrt(gap0)), escape: waryEscape(z[2]! / 1000) };
}
const FIT_AS_MADE = { fit: 1, escape: 0 } as const;

/** Teach a peopled world its kinds in play. */
export function installLineage(world: World, ctx: () => PopulationContext): LineageStore {
  const store = world.register(new LineageStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "119.life.lineage", every: YEAR, run: (t) => lineageYear(ctx(), t) });
  return store;
}
