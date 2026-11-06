// Wild lives (Z1, Classic 52, 42d, 21 and 23). A land's creatures as one number the world keeps, a look at each land once in five years: they go where the
// green is, walk in from the land beside, and give way to fields, towns and a people's flocks; a land emptied of them is told. What moves through a year is a
// reading of these numbers and never touches them. Beside them, the few things that are history: a beast people come to know, that takes their flocks and a
// hunter or two, is given a name and a song, and comes to its end; a realm's herds driven off in war, what its land eats the less for years; and the tree of life
// going on: a kind new on a land cut off, one gone with the last ground it lived on, one made tame. No draw is taken unless a thing is due.
// Read a world's worst before changing a rate: tools/z1-tally.ts.
import {
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  BIOME,
  cellRef,
  cradleTongue,
  isProvinceWorld,
  lives,
  offworldSite,
  tonguePersonName,
  type HomeWorld,
  type Species,
} from "../../gen/index.ts";
import {
  BEAST_KNOWN,
  G,
  HERD,
  HERD_RAID,
  LINEAGE,
  OCC,
  PRODUCTIVITY,
  beastByName,
  herdHolds,
  herdStep,
  newKindOf,
  type HerdWhy,
} from "../../rules/index.ts";
import { rainShift } from "../climate/air.ts";
import { longRain } from "../climate/long.ts";
import { cultureOf } from "../culture/culture.ts";
import type { MarketStore } from "../economy/market.ts";
import { realmName, type Polity } from "../polity/polity.ts";
import { capacity } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import { homePlanet } from "../planet/store.ts";
import { ecologyOf } from "./ecology.ts";
import { woodsRead } from "./woods.ts";

export const HERD_EVENTS = {
  /** A land's creatures gone from it, by fields, towns, flocks or the green's going. */
  emptied: defineEventType("ecology.herds-gone", 3),
  /** A land's pasture grazed down by its people's flocks. */
  grazed: defineEventType("ecology.overgrazed", 3),
  /** A beast people have come to know, and what became of it. */
  known: defineEventType("beast.known", 5),
  took: defineEventType("beast.took", 3),
  after: defineEventType("beast.after", 3),
  ended: defineEventType("beast.ended", 5),
  /** A realm's herds driven off in war. */
  driven: defineEventType("war.herds-driven", 4),
  /** The tree of life going on. */
  kindNew: defineEventType("life.kind-new", 5),
  kindGone: defineEventType("life.kind-gone", 5),
  tamed: defineEventType("life.tamed", 4),
};

const KNOWN = defineStream("herds.known");
const RAID = defineStream("herds.raid");
const TREE = defineStream("herds.tree");

/** A land's herds driven off, while the land has not bred them back. */
export type Driven = {
  readonly cell: number;
  /** What it took, of a hundred. */
  readonly share: number;
  readonly year: number;
  /** Who drove them, the realm's name then; the event. */
  readonly by: string;
  readonly event: Ref;
};

export type BeastEnd = "hunted" | "old" | "left" | "town";

/** A beast people know. */
export type KnownBeast = {
  readonly id: number;
  /** Its own name in its people's tongue, and what they call it. */
  readonly given: string;
  readonly by: string;
  readonly species: number;
  readonly cell: number;
  /** The town that named it, and that town's name then. */
  readonly town: Ref | null;
  readonly townName: string;
  readonly born: number;
  ended: number | null;
  how: BeastEnd | null;
  /** How many seasons' flocks it took, and whom. */
  flocks: number;
  fallen: string[];
  /** Who went after it. */
  after: string | null;
  /** Who ended it. */
  endedBy: string | null;
  readonly event: Ref;
  endEvent: Ref | null;
};

/** A kind new since its world's first peoples, cut off on its land. */
export type NewKind = {
  readonly id: number;
  readonly name: string;
  readonly parent: number;
  readonly cell: number;
  readonly year: number;
  readonly how: "smaller" | "larger";
  readonly size: number;
  readonly event: Ref;
};

/** A kind that has died out, with the last ground it lived on. */
export type GoneKind = {
  readonly species: number;
  readonly year: number;
  readonly cell: number;
  readonly why: "hunted" | "ground";
  readonly event: Ref;
};

/** A kind made tame. */
export type TamedKind = {
  readonly species: number;
  readonly year: number;
  readonly cell: number;
  readonly event: Ref;
};

export type HerdTally = {
  emptied: number;
  grazed: number;
  known: number;
  knownEnded: number;
  fallen: number;
  driven: number;
  head: number;
  newKinds: number;
  goneKinds: number;
  tamed: number;
};

const emptyTally = (): HerdTally => ({
  emptied: 0,
  grazed: 0,
  known: 0,
  knownEnded: 0,
  fallen: 0,
  driven: 0,
  head: 0,
  newKinds: 0,
  goneKinds: 0,
  tamed: 0,
});

/** What a world's lands give their creatures, read once from its ground: never part of its state. */
type HerdIndex = {
  readonly key: string;
  readonly lands: number;
  /** How green each land is, 0..1; the kind that goes on it, or -1; its area (km²). */
  readonly green: Float32Array;
  readonly kind: Int16Array;
  readonly area: Float32Array;
  /** What its pasture carries (person-years). */
  readonly pasture: Float32Array;
  /** Kinds narrow enough to die out, with their lands. */
  readonly narrow: ReadonlyMap<number, readonly number[]>;
  /** Lands cut off: bodies of land (or shelf) too small for any to come or go. */
  readonly cutOff: readonly number[];
};

/** The living kinds that make the herds of a land, by what the world's people live in. */
const HERD_NICHES = ["grazer", "browser", "great beast"] as const;

/** The kind of a land's great numbers: the first that lives there, by niche. A people of the water's are its swimmers, and failing those, what walks there; any of the world's swimmers failing that. */
function kindHere(g: HomeWorld, cell: number, water: boolean, seaFolk: readonly Species[]): number {
  const here = (niche: string): number => {
    for (const s of g.life.species)
      if (s.niche === niche && s.died === null && lives(g.life, cell, s.index)) return s.index;
    return -1;
  };
  if (water) {
    const swimmer = here("swimmer");
    if (swimmer >= 0) return swimmer;
    return seaFolk.length ? seaFolk[cell % seaFolk.length]!.index : -1;
  }
  for (const n of HERD_NICHES) {
    const s = here(n);
    if (s >= 0) return s;
  }
  return -1;
}

function readHerds(ctx: PopulationContext): HerdIndex {
  const planet = homePlanet(ctx.world),
    g = planet.generated,
    n = g.offworld.base,
    water = ctx.medium === "water",
    green = new Float32Array(n),
    kind = new Int16Array(n).fill(-1),
    area = new Float32Array(n),
    pasture = new Float32Array(n),
    seaFolk = water ? g.life.species.filter((s) => s.niche === "swimmer" && s.died === null) : [],
    { offsets, neighbours } = g.grid;
  let most = 0;
  for (let c = 0; c < n; c++) {
    if (offworldSite(g, c)) continue;
    // (What the map calls sea, a coast's sliver of it, is no land's herds; what it calls land is no shoal's.)
    if (water !== g.climate.biome[c]! <= BIOME.seaIce) continue;
    const cap = capacity(g, c, ctx.medium);
    area[c] = cap.areaKm2;
    pasture[c] = cap.pasture;
    if (cap.areaKm2 <= 0) continue;
    const v = (water ? cap.forage : cap.pasture + cap.forage * 0.5) / cap.areaKm2;
    green[c] = v;
    if (v > most) most = v;
    if (v > 0) kind[c] = kindHere(g, c, water, seaFolk);
  }
  // (Green as what they would come for: the land's own, against the world's richest.)
  for (let c = 0; c < n; c++) green[c] = most > 0 ? Math.sqrt(green[c]! / most) : 0;
  // (A land green enough with no kind of its own takes the one that walks in from beside it.)
  const own = kind.slice();
  for (let c = 0; c < n; c++) {
    if (own[c]! >= 0 || green[c]! <= 0) continue;
    for (let k = offsets[c]!; k < offsets[c + 1]!; k++) {
      const m = neighbours[k]!;
      if (m < n && own[m]! >= 0) {
        kind[c] = own[m]!;
        break;
      }
    }
  }
  // Kinds of few lands: read once, every kind in every land, and never again.
  const counts = new Map<number, number[]>(),
    wide = new Set<number>();
  if (g.life.species.length)
    for (const s of g.life.species) {
      if (s.died !== null || s.body === null || s.niche === "upright ape") continue;
      const list: number[] = [];
      for (let c = 0; c < n; c++) {
        if (!lives(g.life, c, s.index)) continue;
        if (list.length >= LINEAGE.narrow) {
          wide.add(s.index);
          break;
        }
        list.push(c);
      }
      if (!wide.has(s.index) && list.length) counts.set(s.index, list);
    }
  // Bodies of ground too small for any to come or go.
  const seen = new Uint8Array(n),
    cutOff: number[] = [];
  for (let c = 0; c < n; c++) {
    if (seen[c] || green[c]! <= 0) continue;
    const body = [c];
    seen[c] = 1;
    for (let i = 0; i < body.length; i++) {
      const at = body[i]!;
      for (let k = offsets[at]!; k < offsets[at + 1]!; k++) {
        const m = neighbours[k]!;
        if (m >= n || seen[m] || green[m]! <= 0) continue;
        seen[m] = 1;
        body.push(m);
      }
    }
    if (body.length <= LINEAGE.cutOff) for (const b of body) if (kind[b]! >= 0) cutOff.push(b);
  }
  // A world of great lands and no small ones: the ends of its lands, hemmed in by sea or barren ground on all but a side or two.
  if (!cutOff.length)
    for (let c = 0; c < n; c++) {
      if (green[c]! <= 0 || kind[c]! < 0) continue;
      let open = 0;
      for (let k = offsets[c]!; k < offsets[c + 1]!; k++) {
        const m = neighbours[k]!;
        if (m < n && green[m]! > 0) open++;
      }
      if (open <= LINEAGE.hemmed) cutOff.push(c);
    }
  cutOff.sort((a, b) => a - b);
  return { key: planet.surfaceKey, lands: n, green, kind, area, pasture, narrow: counts, cutOff };
}

export class HerdStore implements StateStore {
  readonly name = "ecology.herds";
  /** Each land's creatures, in hundredths of the most a land could hold (empty: not begun). */
  stock: Uint8Array = new Uint8Array(0);
  /** The most each land ever held, for what it has lost. */
  most: Uint8Array = new Uint8Array(0);
  /** What drove them off, by land, while they are gone from it (the event that told it). */
  readonly emptied = new Map<
    number,
    { readonly year: number; readonly why: HerdWhy; readonly ref: Ref | null }
  >();
  readonly grazed = new Map<number, { readonly year: number; readonly ref: Ref | null }>();
  readonly driven = new Map<number, Driven>();
  known: KnownBeast[] = [];
  kinds: NewKind[] = [];
  gone: GoneKind[] = [];
  tame: TamedKind[] = [];
  tally: HerdTally = emptyTally();
  lastKnown = -1000;
  lastNew = -1000;
  lastTame = -1000;
  /** Read from the world's own ground once, not state. */
  index: HerdIndex | null = null;
  /** Lands with a beast at large; kept from `known`, not state. */
  private readonly atLarge = new Map<number, KnownBeast>();

  get begun(): boolean {
    return this.stock.length > 0;
  }
  dormant(): boolean {
    return !this.begun;
  }
  refresh(): void {
    this.atLarge.clear();
    for (const b of this.known) if (b.ended === null) this.atLarge.set(b.cell, b);
  }
  /** The beast at large on a land, if one is. */
  beastOn(cell: number): KnownBeast | undefined {
    return this.atLarge.get(cell);
  }
  /** Any beasts at large. */
  beasts(): readonly KnownBeast[] {
    return [...this.atLarge.values()];
  }
  hashInto(h: Hasher): void {
    if (!this.begun) return;
    for (let c = 0; c < this.stock.length; c++) h.int(this.stock[c]!).int(this.most[c]!);
    h.value({
      emptied: [...this.emptied.entries()].sort((a, b) => a[0] - b[0]),
      grazed: [...this.grazed.entries()].sort((a, b) => a[0] - b[0]),
      driven: [...this.driven.entries()].sort((a, b) => a[0] - b[0]),
      known: this.known,
      kinds: this.kinds,
      gone: this.gone,
      tame: this.tame,
      tally: this.tally,
      last: [this.lastKnown, this.lastNew, this.lastTame],
    });
  }
  save(): unknown {
    if (!this.begun) return {};
    return {
      stock: [...this.stock],
      most: [...this.most],
      emptied: [...this.emptied.entries()].sort((a, b) => a[0] - b[0]),
      grazed: [...this.grazed.entries()].sort((a, b) => a[0] - b[0]),
      driven: [...this.driven.entries()].sort((a, b) => a[0] - b[0]),
      known: this.known,
      kinds: this.kinds,
      gone: this.gone,
      tame: this.tame,
      tally: this.tally,
      last: [this.lastKnown, this.lastNew, this.lastTame],
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      stock?: number[];
      most?: number[];
      emptied?: [number, { year: number; why: HerdWhy; ref: Ref | null }][];
      grazed?: [number, { year: number; ref: Ref | null }][];
      driven?: [number, Driven][];
      known?: KnownBeast[];
      kinds?: NewKind[];
      gone?: GoneKind[];
      tame?: TamedKind[];
      tally?: Partial<HerdTally>;
      last?: [number, number, number];
    };
    this.stock = Uint8Array.from(s.stock ?? []);
    this.most = Uint8Array.from(s.most ?? []);
    this.emptied.clear();
    for (const [c, v] of s.emptied ?? []) this.emptied.set(c, v);
    this.grazed.clear();
    for (const [c, v] of s.grazed ?? []) this.grazed.set(c, v);
    this.driven.clear();
    for (const [c, v] of s.driven ?? []) this.driven.set(c, v);
    this.known = (s.known ?? []).map((b) => ({ ...b, fallen: [...b.fallen] }));
    this.kinds = [...(s.kinds ?? [])];
    this.gone = [...(s.gone ?? [])];
    this.tame = [...(s.tame ?? [])];
    this.tally = { ...emptyTally(), ...s.tally };
    [this.lastKnown, this.lastNew, this.lastTame] = s.last ?? [-1000, -1000, -1000];
    this.refresh();
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const v of this.emptied.values()) if (v.ref) out.push(v.ref);
    for (const v of this.grazed.values()) if (v.ref) out.push(v.ref);
    for (const v of this.driven.values()) out.push(v.event);
    for (const b of this.known) {
      out.push(b.event);
      if (b.endEvent) out.push(b.endEvent);
    }
    for (const k of this.kinds) out.push(k.event);
    for (const k of this.gone) out.push(k.event);
    for (const k of this.tame) out.push(k.event);
    return out;
  }
}

export function herdsOf(world: World): HerdStore | null {
  return world.hasStore("ecology.herds") ? world.store<HerdStore>("ecology.herds") : null;
}

/** What a world's ground gives its creatures (made once, and again if its ground has moved). */
export function herdIndex(ctx: PopulationContext): HerdIndex | null {
  const store = herdsOf(ctx.world);
  if (!store) return null;
  const key = homePlanet(ctx.world).surfaceKey;
  if (store.index?.key !== key) store.index = readHerds(ctx);
  return store.index;
}

/** A land's number, whatever has happened: as the ground gives it where the world has not begun them. */
export function herdStock(ctx: PopulationContext, cell: number): number {
  const store = herdsOf(ctx.world);
  if (!store || cell >= homePlanet(ctx.world).generated.offworld.base) return 0;
  if (store.begun) return store.stock[cell] ?? 0;
  const idx = herdIndex(ctx)!;
  return idx.kind[cell]! >= 0 ? Math.round(100 * idx.green[cell]!) : 0;
}

/** What a land's own people have done to its flocks: what war has driven off and what a beast takes, 0..1. Exactly 0 where nothing has. */
export function herdLoss(world: World, cell: number, t: SimTime): number {
  const store = herdsOf(world);
  if (!store) return 0;
  let loss = 0;
  if (store.driven.size) {
    const d = store.driven.get(cell);
    if (d) {
      const y = yearOfMoment(t),
        left = 1 - (y - d.year) / HERD_RAID.heal;
      if (left > 0) loss = (d.share / 100) * left;
    }
  }
  if (store.beastOn(cell)) loss = 1 - (1 - loss) * (1 - BEAST_KNOWN.loss);
  return loss;
}

/** A people of the water's herds are in pens: what its pens lose for that. Exactly 1 for any other people, and where nothing is lost. */
export function pensLeft(ctx: PopulationContext, loss: number): number {
  return ctx.medium === "water" && loss > 0 ? 1 - HERD_RAID.pens * loss : 1;
}

const causes = (...refs: (Ref | null | undefined)[]): CauseRef[] =>
  refs.flatMap((r, i) =>
    r
      ? [{ ref: r, role: i === 0 ? "trigger" : "enabler", weight: i === 0 ? 1 : 0.5 } as CauseRef]
      : [],
  );

/** A year of the world's creatures: one land in five looked at. */
export function herdsYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = herdsOf(world);
  if (!store || !isProvinceWorld(g) || !ctx.provinces.all().length) return;
  const idx = herdIndex(ctx)!,
    n = idx.lands,
    year = yearOfMoment(t),
    water = ctx.medium === "water";
  if (!store.begun) {
    store.stock = new Uint8Array(n);
    store.most = new Uint8Array(n);
    for (let c = 0; c < n; c++) {
      if (idx.kind[c]! < 0) continue;
      const niche = g.life.species[idx.kind[c]!]?.niche ?? "grazer",
        { holds } = herdHolds({
          green: idx.green[c]!,
          niche,
          woods: woodsRead(ctx, c).now,
          rain: 1,
          wild: 1,
          density: 0,
          flocks: 0,
        }),
        here = holdsHere(ctx, idx, c, year);
      // (As the land stands now: a world loaded far on has not just lost them, and no one is told it has.)
      store.most[c] = Math.round(holds);
      store.stock[c] = Math.round(Math.min(holds, here.holds));
      if (store.stock[c]! < HERD.gone && store.most[c]! >= HERD.had)
        store.emptied.set(c, { year, why: here.why, ref: null });
      if (here.flocks >= HERD.overgrazed) store.grazed.set(c, { year, ref: null });
    }
  }
  const { offsets, neighbours } = g.grid;
  for (let c = year % HERD.every; c < n; c += HERD.every) {
    const kind = idx.kind[c]!;
    if (kind < 0) continue;
    const s = g.life.species[kind]!,
      p = ctx.provinces.get(c),
      people = p?.total() ?? 0,
      { holds, why, flocks } = holdsHere(ctx, idx, c, year),
      now = store.stock[c]!;
    let beside = 0;
    for (let k = offsets[c]!; k < offsets[c + 1]!; k++) {
      const m = neighbours[k]!;
      if (m < n && store.stock[m]! > beside) beside = store.stock[m]!;
    }
    const next = Math.max(0, Math.min(255, Math.round(herdStep(now, holds, beside))));
    store.stock[c] = next;
    if (next > store.most[c]!) store.most[c] = next;
    // Told once a land's people have watched them go, and again only once they have come back and gone.
    const place = cellRef(0, c) as Ref,
      seen = people > 0 && ctx.settlements.seenIn(c).length > 0;
    if (next < HERD.gone && store.most[c]! >= HERD.had && !store.emptied.has(c)) {
      const ref = seen
        ? world.events.emit({
            type: HERD_EVENTS.emptied.type,
            subjects: [s.ref as Ref],
            place,
            causes: causes(p?.ref, s.ref as Ref),
            data: { beast: s.name, why, year, water },
          })
        : null;
      store.emptied.set(c, { year, why, ref });
      store.tally.emptied++;
    } else if (next >= HERD.back && store.emptied.has(c)) store.emptied.delete(c);
    // A people's flocks grazing a land's pasture down.
    if (flocks >= HERD.overgrazed && !store.grazed.has(c) && seen) {
      const ref = world.events.emit({
        type: HERD_EVENTS.grazed.type,
        place,
        causes: causes(p?.herding, p?.ref),
        data: { beast: s.name, press: Math.round(flocks * 10) / 10, year },
      });
      store.grazed.set(c, { year, ref });
      store.tally.grazed++;
    } else if (flocks > 0 && flocks < HERD.overgrazed / 2 && store.grazed.has(c))
      store.grazed.delete(c);
  }
  // A land that has bred its herds back.
  if (store.driven.size)
    for (const [c, d] of [...store.driven.entries()])
      if (year - d.year >= HERD_RAID.heal) store.driven.delete(c);
  knownYear(ctx, store, t, year);
  if (year % LINEAGE.every === 0) treeYear(ctx, store, idx, t, year);
}

/** What a land holds now, as it stands: read by its first look as by every other. */
function holdsHere(
  ctx: PopulationContext,
  idx: HerdIndex,
  c: number,
  year: number,
): { holds: number; why: HerdWhy; flocks: number } {
  const g = ctx.generated,
    s = g.life.species[idx.kind[c]!]!,
    p = ctx.provinces.get(c),
    people = p?.total() ?? 0,
    w = people > 0 ? ecologyOf(ctx.world).get(c) : undefined,
    flocks =
      p && people > 0 && idx.pasture[c]! > 0
        ? (p.occupation(OCC.herder) * PRODUCTIVITY[OCC.herder]! * ctx.life.appetite) /
          idx.pasture[c]!
        : 0;
  return {
    ...herdHolds({
      green: idx.green[c]!,
      niche: s.niche,
      woods: woodsRead(ctx, c).now,
      rain: rainShift(ctx, c) * longRain(ctx, c, year),
      wild: w ? w.wild : 1,
      density: idx.area[c]! > 0 ? people / idx.area[c]! : 0,
      flocks,
    }),
    flocks,
  };
}

/** What goes on the people's ground that could be known: a hunter, a great beast, or in the water what swims there. */
function beastHere(ctx: PopulationContext, cell: number, lost: readonly number[]): Species | null {
  const g = ctx.generated;
  let best: Species | null = null;
  for (const s of g.life.species) {
    if (s.died !== null || !s.body || lost.includes(s.index)) continue;
    if (
      s.niche !== "hunter" &&
      s.niche !== "great beast" &&
      s.niche !== "small hunter" &&
      s.niche !== "scavenger"
    )
      continue;
    if (!lives(g.life, cell, s.index)) continue;
    if (
      !best ||
      (s.niche === "hunter" && best.niche !== "hunter") ||
      (s.niche === best.niche && s.size > best.size)
    )
      best = s;
  }
  if (!best && ctx.medium === "water") {
    for (const s of g.life.species)
      if (s.died === null && s.body && (s.niche === "swimmer" || s.niche === "hunter"))
        if (!best || s.size > best.size) best = s;
  }
  return best;
}

const tongueHere = (ctx: PopulationContext, cell: number) =>
  cultureOf(ctx.world).get(cell)?.tongue ?? cradleTongue(ctx.culture);

function tellEnd(
  ctx: PopulationContext,
  store: HerdStore,
  b: KnownBeast,
  how: BeastEnd,
  by: string | null,
  year: number,
): void {
  const { world, generated: g } = ctx,
    s = g.life.species[b.species]!;
  b.ended = year;
  b.how = how;
  b.endedBy = by;
  b.endEvent = world.events.emit({
    type: HERD_EVENTS.ended.type,
    subjects: [s.ref as Ref, ...(b.town ? [b.town] : [])],
    place: cellRef(0, b.cell) as Ref,
    causes: causes(b.event),
    data: {
      id: b.id,
      given: b.given,
      by: b.by,
      beast: s.name,
      town: b.townName,
      how,
      killer: by,
      years: year - b.born,
      fallen: b.fallen.length,
      flocks: b.flocks,
    },
  });
  store.tally.knownEnded++;
  store.refresh();
}

/** A year of the beasts people know: one risen, those at large going on and coming to their ends. */
function knownYear(ctx: PopulationContext, store: HerdStore, t: SimTime, year: number): void {
  const { world, generated: g } = ctx;
  for (const b of store.beasts()) {
    const p = ctx.provinces.get(b.cell),
      people = p?.total() ?? 0,
      town = b.town ? ctx.settlements.get(b.town) : undefined,
      lives_ = year - b.born,
      key = b.id;
    // (Its town is gone: no one left there to know it. It goes on, as a beast does, untold.)
    if (people <= 0 || (b.town && (!town || town.population <= 0))) {
      tellEnd(ctx, store, b, "town", null, year);
      continue;
    }
    b.flocks++;
    const tongue = tongueHere(ctx, b.cell),
      s = g.life.species[b.species]!;
    if (world.rng.real(KNOWN, key, t, 1) < BEAST_KNOWN.kills) {
      const who = tonguePersonName(
        tongue,
        key * 97 + year,
        Math.floor(world.rng.real(KNOWN, key, t, 2) * 2),
      );
      b.fallen.push(who);
      store.tally.fallen++;
      world.events.emit({
        type: HERD_EVENTS.took.type,
        subjects: [s.ref as Ref, ...(b.town ? [b.town] : [])],
        place: cellRef(0, b.cell) as Ref,
        causes: causes(b.event),
        data: { id: b.id, given: b.given, by: b.by, beast: s.name, town: b.townName, who },
      });
    }
    if (lives_ >= BEAST_KNOWN.after && !b.after) {
      b.after = tonguePersonName(
        tongue,
        key * 131 + 7,
        Math.floor(world.rng.real(KNOWN, key, t, 3) * 2),
      );
      world.events.emit({
        type: HERD_EVENTS.after.type,
        subjects: [s.ref as Ref, ...(b.town ? [b.town] : [])],
        place: cellRef(0, b.cell) as Ref,
        causes: causes(b.event),
        data: { id: b.id, given: b.given, by: b.by, beast: s.name, town: b.townName, who: b.after },
      });
    }
    if (b.after) {
      const chance = BEAST_KNOWN.ends + BEAST_KNOWN.endsMore * lives_,
        draw = world.rng.real(KNOWN, key, t, 4);
      if (draw < chance) {
        const old = lives_ >= BEAST_KNOWN.oldFrom && world.rng.real(KNOWN, key, t, 5) < 0.4;
        if (old) tellEnd(ctx, store, b, "old", null, year);
        else if (world.rng.real(KNOWN, key, t, 6) < 0.15)
          tellEnd(ctx, store, b, "left", null, year);
        else tellEnd(ctx, store, b, "hunted", b.after, year);
      }
    }
  }
  // One risen, seldom, wherever one can stand out.
  if (year - store.lastKnown < BEAST_KNOWN.gap) return;
  if (world.rng.real(KNOWN, 0, t, 0) >= BEAST_KNOWN.perYear) return;
  const lands = ctx.provinces.all(),
    n = lands.length;
  if (!n) return;
  // (Every land from a drawn place, only when one is due: on a crowded world few still hold anything that can.)
  const start = Math.floor(world.rng.real(KNOWN, 0, t, 10) * n);
  for (let i = 0; i < n; i++) {
    const p = lands[(start + i) % n]!,
      c = p.cell;
    if (offworldSite(g, c) || p.total() <= 0 || store.beastOn(c)) continue;
    const wilds = ecologyOf(world).get(c);
    if (!wilds) continue;
    const towns = ctx.settlements.seenIn(c).filter((v) => v.population > 0);
    if (!towns.length) continue;
    const s = beastHere(ctx, c, wilds.lost);
    if (!s) continue;
    if (s.niche === "hunter" && wilds.hunter === s.index && wilds.hunters < BEAST_KNOWN.least)
      continue;
    const town = [...towns].sort(
        (a, b) => a.population - b.population || (a.ref < b.ref ? -1 : 1),
      )[0]!,
      id = store.known.length + 1,
      tongue = tongueHere(ctx, c),
      given = tonguePersonName(tongue, id * 53 + year, 1),
      by = beastByName(s.name, s.body, id * 7 + year),
      event = world.events.emit({
        type: HERD_EVENTS.known.type,
        subjects: [s.ref as Ref, town.ref],
        place: cellRef(0, c) as Ref,
        causes: causes(s.ref as Ref, p.herding),
        data: {
          id,
          given,
          by,
          beast: s.name,
          town: town.name,
          flocks: p.occupation(OCC.herder) > 0,
          water: ctx.medium === "water",
        },
      });
    store.known.push({
      id,
      given,
      by,
      species: s.index,
      cell: c,
      town: town.ref,
      townName: town.name,
      born: year,
      ended: null,
      how: null,
      flocks: 0,
      fallen: [],
      after: null,
      endedBy: null,
      event,
      endEvent: null,
    });
    store.lastKnown = year;
    store.tally.known++;
    store.refresh();
    return;
  }
}

/** A world's tree going on, once in so many years. */
function treeYear(
  ctx: PopulationContext,
  store: HerdStore,
  idx: HerdIndex,
  t: SimTime,
  year: number,
): void {
  const { world, generated: g } = ctx,
    wilds = ecologyOf(world),
    gone = new Set(store.gone.map((k) => k.species));
  // One gone with the last of its ground: of those few-landed kinds whose every land has lost it.
  for (const [index, lands] of idx.narrow) {
    if (gone.has(index)) continue;
    const s = g.life.species[index]!;
    let hunted = 0,
      emptied = 0;
    for (const c of lands) {
      const w = wilds.get(c);
      // (No land with no one on it loses a kind: nothing there has pressed it.)
      if (!w) break;
      if (w.lost.includes(index)) hunted++;
      else if (store.stock[c]! < LINEAGE.gone && store.most[c]! >= HERD.had) emptied++;
      else break;
    }
    if (hunted + emptied < lands.length) continue;
    const last = lands[lands.length - 1]!,
      why = hunted >= emptied ? ("hunted" as const) : ("ground" as const),
      event = world.events.emit({
        type: HERD_EVENTS.kindGone.type,
        subjects: [s.ref as Ref],
        place: cellRef(0, last) as Ref,
        causes: causes(s.ref as Ref),
        data: { beast: s.name, why, lands: lands.length },
      });
    store.gone.push({ species: index, year, cell: last, why, event });
    store.tally.goneKinds++;
  }
  // The first peoples must have been here long enough for anything to have changed.
  if (year < LINEAGE.since) return;
  // A kind new on a land cut off.
  if (
    idx.cutOff.length &&
    store.kinds.length < LINEAGE.newMost &&
    year - store.lastNew >= LINEAGE.newGap &&
    world.rng.real(TREE, 0, t, 0) < LINEAGE.newChance
  ) {
    const c = idx.cutOff[Math.floor(world.rng.real(TREE, 1, t, 0) * idx.cutOff.length)]!,
      kind = idx.kind[c]!,
      parent = g.life.species[kind];
    if (
      parent &&
      !gone.has(kind) &&
      store.stock[c]! >= HERD.least &&
      !store.kinds.some((k) => k.cell === c)
    ) {
      const hunted = wilds.get(c)?.hunter !== undefined && (wilds.get(c)?.hunter ?? -1) >= 0,
        made = newKindOf(parent.name, store.kinds.length + c, hunted),
        id = store.kinds.length + 1,
        event = world.events.emit({
          type: HERD_EVENTS.kindNew.type,
          subjects: [parent.ref as Ref],
          place: cellRef(0, c) as Ref,
          causes: causes(parent.ref as Ref),
          data: { name: made.name, parent: parent.name, how: made.how },
        });
      store.kinds.push({
        id,
        name: made.name,
        parent: kind,
        cell: c,
        year,
        how: made.how,
        size: Math.round(parent.size * made.size),
        event,
      });
      store.lastNew = year;
      store.tally.newKinds++;
    }
  }
  // One made tame, where a people keeps flocks and something else there could stand to be kept.
  if (
    store.tame.length < LINEAGE.tameMost &&
    year - store.lastTame >= LINEAGE.tameGap &&
    world.rng.real(TREE, 2, t, 0) < LINEAGE.tameChance
  ) {
    const lands = ctx.provinces.all();
    for (let i = 0; i < 8 && lands.length; i++) {
      const p = lands[Math.floor(world.rng.real(TREE, 3, t, i) * lands.length)]!,
        c = p.cell;
      if (!p.herding || p.total() <= 0 || offworldSite(g, c)) continue;
      const could = g.life.species.find(
        (s) =>
          s.died === null &&
          !s.tame &&
          s.docility >= LINEAGE.tameFrom &&
          (s.niche === "grazer" || s.niche === "browser") &&
          lives(g.life, c, s.index) &&
          !gone.has(s.index) &&
          !store.tame.some((k) => k.species === s.index),
      );
      if (!could) continue;
      const event = world.events.emit({
        type: HERD_EVENTS.tamed.type,
        subjects: [could.ref as Ref],
        place: cellRef(0, c) as Ref,
        causes: causes(p.herding),
        data: { beast: could.name },
      });
      store.tame.push({ species: could.index, year, cell: c, event });
      store.lastTame = year;
      store.tally.tamed++;
      break;
    }
  }
}

/** Whether a kind has died out in history, and how. */
export function kindGone(world: World, index: number): GoneKind | undefined {
  return herdsOf(world)?.gone.find((k) => k.species === index);
}

/**
 * War over a land: one who holds it may lose its herds to whoever comes against it, seldom in any year. What is taken is less food in its land for years, and more at
 * the taker's seat for one. A people of the water's are in its pens. No draw where a land keeps nothing that can be driven.
 */
export function driveHerds(
  ctx: PopulationContext,
  war: Ref,
  warEvent: Ref,
  by: Polity,
  foe: Polity,
  land: number,
  t: SimTime,
): void {
  const { world, generated: g } = ctx,
    store = herdsOf(world);
  if (!store || offworldSite(g, land)) return;
  const p = ctx.provinces.get(land);
  if (!p || p.total() <= 0) return;
  const water = ctx.medium === "water",
    herders = p.occupation(OCC.herder);
  if (!water && (!p.herding || herders <= 0)) return;
  const year = yearOfMoment(t),
    had = store.driven.get(land);
  if (had && year - had.year < HERD_RAID.gap) return;
  const key = Number(war.split(":")[2]) || 0;
  if (world.rng.real(RAID, key, t, land) >= HERD_RAID.chance) return;
  const share = HERD_RAID.least + HERD_RAID.more * world.rng.real(RAID, key, t, land + 1),
    markets = world.store<MarketStore>("economy.markets"),
    from = markets.get(land),
    into = markets.get(by.seat),
    n = from ? Math.floor(from.stock[G.meat]! * share) : 0,
    moved = from && n > 0 ? from.move("out", G.meat, n) : 0;
  if (into && moved > 0) into.move("in", G.meat, moved);
  const beast =
      p.herding && g.life.herdBeast[land]! >= 0
        ? (g.life.species[g.life.herdBeast[land]!]?.name ?? null)
        : (g.life.species[herdIndexKind(ctx, land)]?.name ?? null),
    head = Math.round((water ? p.total() * 0.05 : herders) * 8 * share),
    event = world.events.emit({
      type: HERD_EVENTS.driven.type,
      subjects: [p.ref, war, by.ref, foe.ref],
      place: p.ref,
      causes: causes(warEvent, p.herding),
      data: {
        a: realmName(by),
        b: realmName(foe),
        beast,
        share: Math.round(share * 100),
        head,
        water,
      },
    });
  store.driven.set(land, {
    cell: land,
    share: Math.round(share * 100),
    year,
    by: realmName(by),
    event,
  });
  store.tally.driven++;
  store.tally.head += head;
}

/** The kind of a land's creatures, from the world's own ground. */
function herdIndexKind(ctx: PopulationContext, cell: number): number {
  const idx = herdIndex(ctx);
  return idx?.kind[cell] ?? -1;
}

/** Teach a peopled world its wild lives. */
export function installHerds(world: World, ctx: () => PopulationContext): HerdStore {
  const store = world.register(new HerdStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "117.herds.year", every: YEAR, run: (t) => herdsYear(ctx(), t) });
  return store;
}
