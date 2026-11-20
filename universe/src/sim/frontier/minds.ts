// Minds past their makers, and the going up (the Frontier lane; the rules are rules/beyond.ts; minds as capital that does a
// hand's work are the Trade lane's). Once a realm's people make minds, the minds design the next and their crystal doubles
// until the realm's power (and the mirrors' light, where it tends them) is all they can burn: each year their sum against
// their makers' is read. Past it, they may go their own way as the realm holds them loosely (its order and tradition),
// and then the works in the sky they tend send nothing down (orbital.ts). A people whose bodies can be read and written
// may go up into minds past theirs: as many of each land as its ways are open, its piety holding some back, slowly; those
// gone are gone from its counts (written as deaths of the body). A land half gone up is told, and a world. One small row
// a realm with minds and a land with any gone up.
import {
  Hasher,
  YEAR,
  dmath,
  defineEventType,
  defineStream,
  yearOfMoment,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, planetRef, tongueName } from "../../gen/index.ts";
import {
  BEYOND,
  WAY,
  freeingChance,
  goingUpOf,
  heldOf,
  mindCounsel,
  mindsPast,
  mirrorKw,
  wouldGoUp,
} from "../../rules/index.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { addsReach } from "../order/order.ts";
import { mindsSitAtCourt } from "../court/court.ts";
import { homePlanet } from "../planet/store.ts";
import { cultureOf } from "../culture/culture.ts";
import { deathsIn } from "../acts/disasters.ts";
import { energyPerHead } from "../economy/energy.ts";
import type { PopulationContext } from "../population/systems.ts";
import { spaceOf } from "../space/space.ts";
import { lateOf } from "../space/late-store.ts";
import { fold, homeLands, realmPeople, refNumber } from "./common.ts";

export const MINDS_EVENTS = {
  /** A realm's made minds came to think more than all its people. */
  past: defineEventType("frontier.minds-past", 6),
  /** They went their own way. */
  free: defineEventType("frontier.minds-free", 7),
  /** Half a land's people gone up into minds; and half a world's. */
  goneUp: defineEventType("frontier.gone-up", 5),
  worldGone: defineEventType("frontier.world-gone-up", 7),
};

const MINDS = defineStream("frontier.minds");

export type MindsRow = {
  readonly realm: Ref;
  /** The year its minds began to design minds. */
  readonly begun: number;
  /** How far past their makers they think, last read: log10 of the ratio, ×100. */
  past: number;
  passed: Ref | null;
  free: Ref | null;
  /** What its people call them, once they think more than their makers and are spoken of as one (absent before). */
  name?: string;
};

export type UpLand = { readonly cell: number; up: number; gone: Ref | null };

export class MindsStore implements StateStore {
  readonly name = "frontier.minds";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  readonly rows = new Map<Ref, MindsRow>();
  readonly lands = new Map<number, UpLand>();
  /** All gone up, and the world's going told. */
  up = 0;
  world: Ref | null = null;
  private readonly digest: [number, number] = [0x811c9dc5, 0];

  dormant(): boolean {
    return !this.rows.size && !this.lands.size;
  }
  note(xs: readonly number[]): void {
    fold(this.digest, xs);
  }
  all(): MindsRow[] {
    return [...this.rows.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    if (this.world) out.push(this.world);
    for (const r of this.rows.values()) for (const x of [r.passed, r.free]) if (x) out.push(x);
    for (const l of this.lands.values()) if (l.gone) out.push(l.gone);
    return out;
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.int(this.rows.size).int(this.lands.size).int(this.up);
    h.int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    if (this.dormant()) return {};
    return {
      rows: this.all(),
      lands: [...this.lands.values()].sort((a, b) => a.cell - b.cell),
      up: this.up,
      world: this.world,
      digest: [...this.digest],
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      rows?: MindsRow[];
      lands?: UpLand[];
      up?: number;
      world?: Ref | null;
      digest?: [number, number];
    };
    this.rows.clear();
    for (const r of s.rows ?? []) this.rows.set(r.realm, { ...r });
    this.lands.clear();
    for (const l of s.lands ?? []) this.lands.set(l.cell, { ...l });
    this.up = s.up ?? 0;
    this.world = s.world ?? null;
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
  }
}

export function mindsOf(world: World): MindsStore | null {
  return world.hasStore("frontier.minds") ? world.store<MindsStore>("frontier.minds") : null;
}

/** How many times their makers' sum a realm's minds think, as last read (0: it has none). */
export function mindsPastOf(world: World, realm: Ref): number {
  const r = mindsOf(world)?.rows.get(realm);
  return r ? dmath.pow(10, r.past / 100) : 0;
}

/** The event of a realm's minds going their own way (null: kept, or none). */
export function mindsFree(world: World, realm: Ref): Ref | null {
  return mindsOf(world)?.rows.get(realm)?.free ?? null;
}

/** The power a realm's minds may burn, kW a head: its seat's, and the mirrors' light where it tends them. */
export function mindsPower(ctx: PopulationContext, p: Polity, year: number): number {
  const world = ctx.world,
    own = energyPerHead(world, p.seat)?.power ?? 0,
    m = lateOf(world)?.mirrors;
  if (!m || year - m.tended > 60 || !spaceOf(world).of(p.ref)?.station) return own;
  if (!knows(ctx, p.seat, "star-mirrors")) return own;
  const g = homePlanet(world).generated,
    people = Math.max(1, realmPeople(ctx, p));
  return own + mirrorKw(m.km2, g.star.luminosity, g.system.bodies[0]!.orbit.a) / people;
}

/** The minds' year: their sum read, passed, freed; those who would go up, going. */
export function mindsYear(ctx: PopulationContext, t: SimTime): void {
  const world = ctx.world,
    store = mindsOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    culture = cultureOf(world),
    lore = loreOf(world);
  for (const p of realms.living()) {
    let row = store.rows.get(p.ref);
    if (!row) {
      if (!knows(ctx, p.seat, "machine-minds")) continue;
      store.rows.set(
        p.ref,
        (row = { realm: p.ref, begun: year, past: -600, passed: null, free: null }),
      );
      store.note([refNumber(p.ref), year, 1]);
    }
    const ratio = mindsPast(BEYOND.crystalSums, mindsPower(ctx, p, year), year - row.begun),
      past = Math.round(100 * dmath.log10(Math.max(1e-12, ratio)));
    if (past !== row.past) store.note([refNumber(p.ref), past]);
    row.past = past;
    if (ratio < 1) continue;
    const known = lore.get(p.seat, "machine-minds");
    // (Past their makers they are spoken of as one, by a name in their makers' tongue; a save from before names them now.)
    if (!row.name) {
      const tongue = culture.get(p.seat)?.tongue;
      row.name = tongue
        ? tongueName({ ...tongue, seed: tongue.seed ^ 0x313d }, refNumber(p.ref))
        : `Mind of ${p.town}`;
      store.note([refNumber(p.ref), year, 3]);
    }
    if (!row.passed)
      row.passed = world.events.emit({
        type: MINDS_EVENTS.past.type,
        place: cellRef(0, p.seat),
        subjects: [p.ref],
        causes: known ? [{ ref: known.event, role: "enabler", weight: 1 }] : [],
        data: { realm: p.town, past: Math.round(ratio * 10) / 10, mind: row.name },
      });
    const ways = culture.get(p.seat)?.traits ?? [];
    if (!row.free) {
      const held = heldOf(ways[WAY.hierarchy] ?? 0.5, ways[WAY.tradition] ?? 0.5);
      if (world.rng.real(MINDS, p.seat, t, 0) < freeingChance(ratio, held)) {
        row.free = world.events.emit({
          type: MINDS_EVENTS.free.type,
          importance: 7,
          place: cellRef(0, p.seat),
          subjects: [p.ref],
          causes: [{ ref: row.passed, role: "trigger", weight: 1 }],
          data: {
            realm: p.town,
            past: Math.round(ratio * 10) / 10,
            held: Math.round(held * 100) / 100,
            mind: row.name,
          },
        });
        store.note([refNumber(p.ref), year, 2]);
      }
    }
    // Those who would go up, where bodies can be read and written.
    if (!knows(ctx, p.seat, "made-bodies")) continue;
    for (const cell of p.members) {
      const prov = ctx.provinces.get(cell),
        people = prov?.total() ?? 0;
      if (people <= 0) continue;
      const w = culture.get(cell)?.traits ?? ways,
        would = wouldGoUp(w[WAY.openness] ?? 0.5, w[WAY.piety] ?? 0.5);
      if (would <= 0) continue;
      const land = store.lands.get(cell),
        up = land?.up ?? 0,
        n = goingUpOf(people, would, up / (up + people));
      if (n <= 0) continue;
      const fell = deathsIn(ctx, cell, n, t);
      if (fell <= 0) continue;
      const l = land ?? { cell, up: 0, gone: null };
      if (!land) store.lands.set(cell, l);
      l.up += fell;
      store.up += fell;
      store.note([cell, fell]);
      if (!l.gone && l.up >= BEYOND.goneShare * (l.up + people - fell))
        l.gone = world.events.emit({
          type: MINDS_EVENTS.goneUp.type,
          place: cellRef(0, cell),
          subjects: [p.ref],
          causes: [{ ref: row.passed, role: "enabler", weight: 1 }],
          data: { realm: p.town, up: l.up },
        });
    }
  }
  // The home world gone up: half of all who were.
  if (!store.world && store.lands.size && year % 10 === 0) {
    const base = homeLands(homePlanet(world).generated);
    let up = 0,
      people = 0;
    for (const l of store.lands.values()) if (l.cell < base) up += l.up;
    for (const p of ctx.provinces.all()) if (p.cell < base) people += p.total();
    if (up > 0 && up >= BEYOND.goneShare * (up + people))
      store.world = world.events.emit({
        type: MINDS_EVENTS.worldGone.type,
        subjects: [planetRef(0) as Ref],
        causes: [],
        data: { up, left: people },
      });
  }
}

/** Teach a world its minds. */
export function installMinds(world: World, ctx: () => PopulationContext): MindsStore {
  const store = world.register(new MindsStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "209.frontier.minds", every: YEAR, run: (t) => mindsYear(ctx(), t) });
  // (A seat its minds counsel reaches farther; one whose minds went their own way, less: rules/beyond.ts mindCounsel. Nothing
  // where a realm's minds are not yet past their makers.)
  // (And while kept they sit at its court, one of its figures: sim/court/court.ts.)
  mindsSitAtCourt((w, realm) => {
    const row = mindsOf(w)?.rows.get(realm);
    return row && row.passed && row.name && !row.free ? { name: row.name, since: row.begun } : null;
  });
  addsReach((c, p) => {
    const row = mindsOf(c.world)?.rows.get(p.ref);
    if (!row || !row.passed || row.past < 0) return [];
    const contribution = mindCounsel(dmath.pow(10, row.past / 100), !!row.free);
    return contribution
      ? [
          {
            name: row.free
              ? `its made minds went their own way${row.name ? `: ${row.name}` : ""}`
              : `its made minds counsel its seat${row.name ? `: ${row.name}` : ""}`,
            value: row.past / 100,
            contribution,
            source: row.free ?? row.passed,
          },
        ]
      : [];
  });
  return store;
}
