// Life's kinds in play (Round D; the rules are rules/lineage.ts). Two things, each a land at a time, a fifth of the
// lands a year and each five years at once:
// - Kinds branching: a stock cut off (on a small body of land, or on one the risen sea has cut off: planet/motion.ts)
//   goes apart from its kind a generation at a time, the faster the shorter its generations and the harder it is
//   pressed; gone far enough it is a new kind of its own (the tree's new kinds, ecology/herds.ts), smaller or larger by
//   Foster's island rule.
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
import { cellRef, isProvinceWorld, lives } from "../../gen/index.ts";
import {
  HERD,
  LINEAGE,
  OCC,
  PARASITES,
  divergence,
  islandSize,
  newKindOf,
  parasiteLoad,
  parasiteToll,
} from "../../rules/index.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import { HERD_YIELD } from "../population/model.ts";
import { HERD_EVENTS, herdIndex, herdStock, herdsOf } from "./herds.ts";
import { ecologyOf } from "./ecology.ts";
import { shiftNow } from "../planet/motion.ts";

export const LINEAGE_EVENTS = {
  /** A people's flocks grown heavy with what lives off them. */
  parasites: defineEventType("life.parasites-heavy", 3),
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

export class LineageStore implements StateStore {
  readonly name = "life.lineage";
  /** Each cut-off land's stock gone apart from its kind (thousandths of the way to a kind of its own). */
  readonly apart = new Map<number, number>();
  readonly lands = new Map<number, Partners>();
  dormant(): boolean {
    return this.apart.size === 0 && this.lands.size === 0;
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
  }
  save(): unknown {
    if (this.dormant()) return {};
    const sorted = <T>(m: Map<number, T>) => [...m.entries()].sort((a, b) => a[0] - b[0]);
    return { apart: sorted(this.apart), lands: sorted(this.lands).map(([, v]) => v) };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as { apart?: [number, number][]; lands?: Partners[] };
    this.apart.clear();
    for (const [c, v] of s.apart ?? []) this.apart.set(c, v);
    this.lands.clear();
    for (const l of s.lands ?? []) this.lands.set(l.cell, { ...l });
  }
}

export function kindsInPlayOf(world: World): LineageStore | null {
  return world.hasStore("life.lineage") ? world.store<LineageStore>("life.lineage") : null;
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
      now = Math.min(
        1000,
        Math.round(was + 1000 * years * divergence(parent.size, hunted, shift.warm)),
      );
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

/** Teach a peopled world its kinds in play. */
export function installLineage(world: World, ctx: () => PopulationContext): LineageStore {
  const store = world.register(new LineageStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "119.life.lineage", every: YEAR, run: (t) => lineageYear(ctx(), t) });
  return store;
}
