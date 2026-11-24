// Bodies written for a world (the Frontier lane; the rules are rules/beyond.ts). A realm whose people write and grow their
// bodies, and that holds halls on another world, begins to write its settlers' children for the worlds they live on: each
// generation a share more of what their halls keep out is borne by their bodies instead, as far as a body can be bent (a
// warmth some sixty degrees from home's, a sky's rays with mended cells); where it makes minds it gives them limbs and
// senses of machines that bear more of the cold and the rays. The halls' upkeep falls by it (population/systems.ts
// hallsShare, by writtenCut), so more of their people's work goes to their fields and their numbers. One row a realm.
import {
  Hasher,
  YEAR,
  defineEventType,
  yearOfMoment,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, offworldSite, worldLife } from "../../gen/index.ts";
import {
  habitability,
  replaceable,
  rewritable,
  writableShare,
  writtenAfter,
  type Ground,
} from "../../rules/index.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { politiesOf } from "../polity/polity.ts";
import { homePlanet } from "../planet/store.ts";
import type { PopulationContext } from "../population/systems.ts";
import { peopleKin } from "../population/life.ts";
import { sparedWork } from "./engineered.ts";
import { clusterOf, starSitesOf } from "../space/stars.ts";
import { worldsOf } from "../space/voyages.ts";
import { fold, homeLands, refNumber } from "./common.ts";

export const WRITTEN_EVENTS = {
  /** A realm began to write its settlers' bodies for their worlds. */
  begun: defineEventType("frontier.bodies-written", 6),
  /** It gave them limbs and senses of machines. */
  limbs: defineEventType("frontier.machine-limbs", 5),
};

export type WrittenRow = {
  readonly realm: Ref;
  readonly year: number;
  readonly event: Ref;
  limbs: Ref | null;
};

export class WrittenStore implements StateStore {
  readonly name = "frontier.written";
  readonly rows = new Map<Ref, WrittenRow>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];

  dormant(): boolean {
    return !this.rows.size;
  }
  all(): WrittenRow[] {
    return [...this.rows.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const r of this.rows.values()) for (const x of [r.event, r.limbs]) if (x) out.push(x);
    return out;
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.value(this.all()).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    if (this.dormant()) return {};
    return { rows: this.all(), digest: [...this.digest] };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as { rows?: WrittenRow[]; digest?: [number, number] };
    this.rows.clear();
    for (const r of s.rows ?? []) this.rows.set(r.realm, { ...r });
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
  }
  noteRow(r: WrittenRow, year: number): void {
    fold(this.digest, [refNumber(r.realm), year, r.limbs ? 1 : 0]);
  }
}

export function writtenOf(world: World): WrittenStore | null {
  return world.peek<WrittenStore>("frontier.written") ?? null;
}

/** The ground a land of another world stands on, as its halls' needs read it (null: a ship still sailing, or home). */
function groundOf(world: World, cell: number): Ground | null {
  const g = homePlanet(world).generated,
    site = offworldSite(g, cell);
  if (!site) return null;
  if (site.body >= 0) return g.system.bodies[site.body] ?? null;
  const ship = starSitesOf(world)?.get(cell);
  if (!ship?.arrived) return null;
  const star = clusterOf(world).find((s) => s.ref === ship.star);
  return (star && worldsOf(world, star)[ship.planet]) ?? null;
}

/**
 * How far a realm's settlers are written now, and the share of them who carry limbs of machines (0 … 1 each): a share of
 * their children a generation of their own, what the realm's seat knows of the body by what its engines spare
 * (rules/beyond.ts rewritable, replaceable); the limbs to a twentieth.
 */
export function writtenSoFar(world: World, row: WrittenRow): { written: number; limbs: number } {
  const p = politiesOf(world).get(row.realm),
    year = yearOfMoment(world.now);
  if (!p) return { written: 0, limbs: 0 };
  const lore = loreOf(world),
    pays = sparedWork(world, p.seat),
    generation = peopleKin(homePlanet(world).generated).generation,
    minds = row.limbs ? lore.get(p.seat, "machine-minds") : undefined;
  return {
    written: writtenAfter(
      year - row.year,
      rewritable(lore.effect(p.seat, "health"), pays),
      generation,
    ),
    limbs: minds
      ? Math.round(20 * writtenAfter(year - minds.year, replaceable(true, pays), generation)) / 20
      : 0,
  };
}

/** The share of a land's halls' upkeep a written body bears, so many of them with machine limbs (kept by the world's surface). */
const WRITABLE = new Map<string, number>();
export function writableOf(world: World, cell: number, limbs: number): number {
  const planet = homePlanet(world),
    site = offworldSite(planet.generated, cell),
    ship = site && site.body < 0 ? starSitesOf(world)?.get(cell) : null,
    key = `${planet.surfaceKey}:${cell}:${Math.round(limbs * 20)}:${ship ? `${ship.star}/${ship.planet}` : ""}`;
  let share = WRITABLE.get(key);
  if (share === undefined) {
    const ground = groundOf(world, cell),
      g = planet.generated,
      home = g.system.bodies[0]!;
    share = 0;
    if (ground) {
      const h = habitability(ground, g.life.people?.body ?? null, home, worldLife(g));
      share = h.livable
        ? writableShare(h.needs, Math.abs(ground.temperature - home.temperature), limbs)
        : 0;
    }
    if (WRITABLE.size > 4096) WRITABLE.clear();
    WRITABLE.set(key, share);
  }
  return share;
}

/** What written bodies take off a land's halls' upkeep now (0 … 1: 0 where none are written). */
export function writtenCut(world: World, cell: number): number {
  const store = writtenOf(world);
  if (!store || !store.rows.size) return 0;
  const p = politiesOf(world).of(cell);
  if (!p) return 0;
  const row = store.rows.get(p.ref);
  if (!row) return 0;
  const years = yearOfMoment(world.now) - row.year;
  if (years <= 0) return 0;
  const so = writtenSoFar(world, row);
  return so.written > 0 ? writableOf(world, cell, so.limbs) * so.written : 0;
}

/** The year's writing: a realm able to begins; one that comes to make minds gives its settlers machine limbs. */
export function writtenYear(ctx: PopulationContext, t: SimTime): void {
  const world = ctx.world,
    store = writtenOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    base = homeLands(ctx.generated),
    lore = loreOf(world);
  for (const p of politiesOf(world).living()) {
    let row = store.rows.get(p.ref);
    if (!row) {
      if (!knows(ctx, p.seat, "made-bodies")) continue;
      const far = p.members.find((c) => c >= base && (ctx.provinces.get(c)?.total() ?? 0) > 0);
      if (far === undefined) continue;
      const known = lore.get(p.seat, "made-bodies");
      row = {
        realm: p.ref,
        year,
        event: world.events.emit({
          type: WRITTEN_EVENTS.begun.type,
          place: cellRef(0, far),
          subjects: [p.ref],
          causes: known ? [{ ref: known.event, role: "enabler", weight: 1 }] : [],
          data: { realm: p.town, share: Math.round(writableOf(world, far, 0) * 100) },
        }),
        limbs: null,
      };
      store.rows.set(p.ref, row);
      store.noteRow(row, year);
    }
    if (!row.limbs && knows(ctx, p.seat, "machine-minds")) {
      const known = lore.get(p.seat, "machine-minds");
      row.limbs = world.events.emit({
        type: WRITTEN_EVENTS.limbs.type,
        place: cellRef(0, p.seat),
        subjects: [p.ref],
        causes: [
          { ref: row.event, role: "trigger", weight: 1 },
          ...(known ? [{ ref: known.event, role: "enabler" as const, weight: 0.8 }] : []),
        ],
        data: { realm: p.town },
      });
      store.noteRow(row, year);
    }
  }
}

/** Teach a world its written bodies. */
export function installWritten(world: World, ctx: () => PopulationContext): WrittenStore {
  const store = world.register(new WrittenStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "209.frontier.written", every: YEAR, run: (t) => writtenYear(ctx(), t) });
  return store;
}
