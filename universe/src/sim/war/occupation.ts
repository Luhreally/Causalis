// Lands held by force, and those who fight their holder there (round E, order). A land taken in war is held by its taker
// against its people's will: its resistance (0 … 1) grows each year as far as they resent it (their grievance, the more as their
// speech and faith are strange to their holder's seat), as their ground hides those who fight (the relief of its fine ground,
// from the world as made), and as they still bear arms (how far the realm they were taken from left arms in its people's
// hands, rules/holds.ts force); and falls as far as their holder keeps a host there (its host a land, the nearer its seat the
// more). Resistance is grievance the holder's rule reads (its discontent, and so its risings and secessions); past a half it is
// an insurgency, told; at its height, where no realm of their own is near to take them back, the land throws off its holder
// and goes its own way. A land that has borne its holder a generation without resisting is held, not occupied, and let go.
// A few numbers a land taken, kept only while it is held so.
import {
  defineEventType,
  dmath,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  cellRef,
  isProvinceWorld,
  keptKey,
  tongueLikeness,
  type HomeWorld,
} from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { cutOff, politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { holdsOf } from "../order/holds.ts";
import { armyOf } from "../strife/strife.ts";

export const OCCUPATION_EVENTS = {
  /** Those of a land held by force took up arms against its holder, or were put down, or threw it off. */
  insurgency: defineEventType("war.insurgency", 4),
};

export const OCCUPYING = {
  /** How fast resistance grows from a full grievance, on middling ground, among a people half armed. */
  grow: 0.3,
  /** How fast a host of one in twenty of the land's people puts it down. */
  quell: 0.4,
  /** A host a land of this share of its people holds it fully. */
  garrison: 0.05,
  /** Relief (m, the spread of its fine ground's heights) at which the ground hides those who fight as well as it can. */
  relief: 800,
  /** Past this, an insurgency; at this, the land goes its own way. */
  rising: 0.5,
  free: 0.95,
  /** Years without resisting after which a land is held, not occupied. */
  settled: 30,
} as const;

export type Occupied = {
  /** Who holds it, and whom it was taken from. */
  holder: Ref;
  from: Ref;
  since: number;
  resistance: number;
  /** Whether it is now an insurgency, and its last event. */
  rising: boolean;
  event: Ref | null;
  /** The last year it resisted at all. */
  quiet: number;
};

export class OccupationStore implements StateStore {
  readonly name = "war.occupation";
  private readonly lands = new Map<number, Occupied>();
  dormant(): boolean {
    return this.lands.size === 0;
  }
  of(cell: number): Readonly<Occupied> | undefined {
    return this.lands.get(cell);
  }
  /** The same, to be changed by the year that reads it. */
  held(cell: number): Occupied | undefined {
    return this.lands.get(cell);
  }
  /** The lands a realm holds by force. */
  heldBy(realm: Ref): number[] {
    return this.cells().filter((c) => this.lands.get(c)!.holder === realm);
  }
  cells(): number[] {
    return [...this.lands.keys()].sort((a, b) => a - b);
  }
  begin(cell: number, holder: Ref, from: Ref, year: number): void {
    this.lands.set(cell, {
      holder,
      from,
      since: year,
      resistance: 0,
      rising: false,
      event: null,
      quiet: year,
    });
  }
  end(cell: number): void {
    this.lands.delete(cell);
  }
  pinned(): Ref[] {
    return [...this.lands.values()].flatMap((o) => (o.event ? [o.event] : []));
  }
  hashInto(h: Hasher): void {
    const cs = this.cells();
    h.int(cs.length);
    for (const c of cs) h.int(c).value(this.lands.get(c));
  }
  save(): unknown {
    return this.cells().map((c) => [c, this.lands.get(c)]);
  }
  load(state: unknown): void {
    this.lands.clear();
    for (const [c, o] of (state as [number, Occupied][]) ?? []) this.lands.set(c, o);
  }
}

export function occupationOf(world: World): OccupationStore | null {
  return world.hasStore("war.occupation") ? world.store<OccupationStore>("war.occupation") : null;
}

/** A land taken in war: held by force from now (sim/war/war.ts, where it is taken). */
export function occupy(world: World, cell: number, holder: Ref, from: Ref, year: number): void {
  occupationOf(world)?.begin(cell, holder, from, year);
}

const RELIEF = new Map<string, Float32Array>();
/** The spread of each land's fine ground's heights (m): how well its ground hides those who fight. Kept by world. */
export function reliefOf(g: HomeWorld): Float32Array {
  const key = `${keptKey(g)} ${g.grid.count}`,
    kept = RELIEF.get(key);
  if (kept) return kept;
  const out = new Float32Array(g.grid.count);
  if (isProvinceWorld(g)) {
    const e = g.fine.tectonics.elevation;
    for (let p = 0; p < g.grid.count && p < g.childOffsets.length - 1; p++) {
      let n = 0,
        sum = 0,
        sq = 0;
      for (let k = g.childOffsets[p]!; k < g.childOffsets[p + 1]!; k++) {
        const h = Math.max(0, e[g.children[k]!]!);
        n++;
        sum += h;
        sq += h * h;
      }
      out[p] = n > 1 ? dmath.sqrt(Math.max(0, sq / n - (sum / n) * (sum / n))) : 0;
    }
  }
  if (RELIEF.size >= 16) RELIEF.clear();
  RELIEF.set(key, out);
  return out;
}

/** The year of every land held by force: its resistance grown or put down, told, and thrown off at its height. */
export function occupationYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = occupationOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    culture = cultureOf(world),
    faiths = beliefOf(world),
    relief = reliefOf(ctx.generated),
    hosts = new Map<Ref, number>();
  // (A holder's host, a land: what it keeps under arms over the lands it holds, the nearer its seat the more.)
  const hostOf = (p: Polity) => {
    let h = hosts.get(p.ref);
    if (h === undefined)
      hosts.set(p.ref, (h = armyOf(ctx, p).people / Math.max(1, p.members.length)));
    return h;
  };
  for (const c of store.cells()) {
    const o = store.held(c)!,
      holder = realms.get(o.holder);
    // (No longer theirs, or theirs again: not held by force.)
    if (!holder || holder.ended !== null || realms.of(c) !== holder) {
      store.end(c);
      continue;
    }
    const prov = ctx.provinces.get(c),
      people = prov?.total() ?? 0;
    if (!people) {
      store.end(c);
      continue;
    }
    const here = culture.get(c),
      seat = culture.get(holder.seat),
      strange = here && seat ? 1 - tongueLikeness(here.tongue, seat.tongue) : 0,
      faith = faiths.of(c).faith,
      unbelief = faith && faith !== faiths.of(holder.seat).faith ? 1 : 0,
      grievance = Math.min(1, realms.discontent(c).level * (0.5 + 0.5 * strange + 0.3 * unbelief)),
      // (Halls on another world have no ground of their own to hide in: none, not a number that is none. Unread, a land
      // taken there had a resistance that was no number, which no save keeps: the world saved then did not load back.)
      ground = Math.min(1, (relief[c] ?? 0) / OCCUPYING.relief),
      armed = 1 - (holdsOf(world, o.from)[0] ?? 0.5),
      garrison = Math.min(1, hostOf(holder) / Math.max(1, OCCUPYING.garrison * people)),
      was = o.resistance;
    o.resistance =
      Math.round(
        dmath.clamp(
          was +
            OCCUPYING.grow * grievance * (0.5 + ground) * (0.5 + armed) -
            OCCUPYING.quell * garrison * (1 - 0.5 * ground),
          0,
          1,
        ) * 1000,
      ) / 1000;
    if (o.resistance > 0.02) o.quiet = year;
    // (Its resistance is grievance its holder's rule reads.)
    const d = realms.discontent(c);
    if (o.resistance > d.level)
      realms.setDiscontent(c, { level: o.resistance, cause: o.event ?? d.cause });
    const tell = (kind: "rose" | "crushed" | "free") =>
      world.events.emit({
        type: OCCUPATION_EVENTS.insurgency.type,
        subjects: [holder.ref, o.from],
        place: cellRef(0, c),
        causes: [
          ...(d.cause ? [{ ref: d.cause, role: "pressure" as const, weight: 1 }] : []),
          ...(o.event ? [{ ref: o.event, role: "enabler" as const, weight: 0.5 }] : []),
        ],
        data: {
          a: realmName(holder),
          b: realms.get(o.from) ? realmName(realms.get(o.from)!) : "the realm it was taken from",
          kind,
          resistance: o.resistance,
        },
      });
    if (!o.rising && o.resistance >= OCCUPYING.rising) {
      o.rising = true;
      o.event = tell("rose");
    } else if (o.rising && o.resistance < OCCUPYING.rising / 2) {
      o.rising = false;
      o.event = tell("crushed");
    }
    // At its height, the land throws off its holder and goes its own way.
    if (o.resistance >= OCCUPYING.free) {
      const freed = tell("free");
      realms.leave(holder, c);
      // (And what the holder held only through it is cut off from its seat, and goes its own way as after any land lost:
      // first light, year 300, Aer held a land thirteen years with no land or ship between it and the seat.)
      cutOff(ctx, holder, freed);
      realms.setDiscontent(c, { level: 0, cause: freed });
      store.end(c);
      continue;
    }
    // A generation borne without resisting: held, not occupied.
    if (year - o.quiet >= OCCUPYING.settled) store.end(c);
  }
}
