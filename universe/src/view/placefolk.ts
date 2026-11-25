// A place's people laid over the town drawn (town mode, first slice): where the host's place has each of them, lot by
// lot and tick by tick (bridge/place.ts PlaceFrame), drawn between ticks by the town's own clock. The town's scene and
// eye are the town view's; only where its people stand is the place's. They walk straight from door to door: the
// place reckons a walk by its length, not by the streets (a later slice's: view/streets.ts has the graph).
import {
  PLACE_ACT,
  PLACE_AT,
  placedId,
  type PlaceFrame,
  type VillagePlan,
} from "../bridge/index.ts";
import type { PosedHook } from "./possess.ts";
import type { Presence } from "./presence.ts";
import { ACTIVITY, type Activity, type Moment } from "./village.ts";

type Point = { x: number; z: number };

const unit = (h: number) => (h >>> 0) / 4294967296;
/** A scramble of two whole numbers, for where one of many stands about a spot: the same each time. */
function spread(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 13)) >>> 0;
}

/** What each of a place's doings is drawn as (bridge/place.ts PLACE_ACT's order). */
const DOING: readonly Activity[] = [
  ACTIVITY.home,
  ACTIVITY.asleep,
  ACTIVITY.eating,
  ACTIVITY.working,
  ACTIVITY.walking,
  ACTIVITY.walking,
  ACTIVITY.sheltering,
  ACTIVITY.gathering,
  ACTIVITY.resting,
];

export class PlaceBodies implements PosedHook {
  readonly downed = new Set<number>();
  /** The plan's people by who they are in the place (null: not of it). */
  readonly ids: readonly (number | null)[];
  frame: PlaceFrame | null = null;
  private now = 0;
  private readonly plan: VillagePlan;
  private readonly lotAt: (lot: number) => Point | null;
  private readonly strides: number[];
  private strideAt = 0;

  constructor(plan: VillagePlan, lotAt: (lot: number) => Point | null) {
    this.plan = plan;
    this.lotAt = lotAt;
    this.ids = plan.people.map((p) => placedId(p.ref));
    this.strides = plan.people.map(() => 0);
  }

  /** Those of the plan the place keeps, for asking where they are. */
  get asked(): number[] {
    return this.ids.filter((id): id is number => id !== null);
  }

  at(t: number): number {
    this.now = t;
    return t;
  }

  /** Where one stands at a lot, the square or the fields: about it, each in a spot of their own. */
  spot(i: number, lot: number): Point {
    const plan = this.plan,
      person = plan.people[i]!,
      id = this.ids[i] ?? i,
      a = unit(spread(id, 1)) * 2 * Math.PI;
    if (lot === PLACE_AT.square) {
      const r = 3 + 9 * unit(spread(id, 2));
      return { x: r * Math.cos(a), z: r * Math.sin(a) };
    }
    if (lot === PLACE_AT.fields) {
      // (A herder with the flock, anyone else in a field of their own.)
      const f = plan.fields.length ? plan.fields[spread(id, 3) % plan.fields.length]! : null;
      if (person.occupation === 3 || !f) {
        const r = plan.pasture.r * 0.8 * Math.sqrt(unit(spread(id, 4)));
        return { x: plan.pasture.x + r * Math.cos(a), z: plan.pasture.z + r * Math.sin(a) };
      }
      const u = (unit(spread(id, 5)) - 0.5) * f.w * 0.8,
        v = (unit(spread(id, 6)) - 0.5) * f.d * 0.8,
        c = Math.cos(f.yaw),
        s = Math.sin(f.yaw);
      return { x: f.x + u * c + v * s, z: f.z - u * s + v * c };
    }
    const home = plan.homes[person.home],
      at = (lot >= 0 ? this.lotAt(lot) : null) ?? home ?? { x: 0, z: 0 },
      // (Before its door, a few steps off its middle.)
      r = 5.5 + 2.5 * unit(spread(id, 7));
    return { x: at.x + r * Math.cos(a), z: at.z + r * Math.sin(a) };
  }

  pose(
    drawn: { moment: Moment; size: number; stride: number }[],
    presence: Map<string, Presence>,
  ): void {
    const f = this.frame;
    if (!f) return;
    const t = this.now,
      // (How far through the tick the town's clock is: a walk goes on between the host's words.)
      sub = Math.max(0, Math.min(1, (t - f.t) / f.tick)),
      dt = Math.max(0, Math.min(0.25, (t - this.strideAt) / 60));
    this.strideAt = t;
    let k = -1;
    for (let i = 0; i < this.ids.length; i++) {
      if (this.ids[i] === null) continue;
      k++;
      const at = f.at[k],
        to = f.to[k] ?? PLACE_AT.none,
        eta = f.eta[k] ?? 0,
        trip = f.trip[k] ?? 0,
        act = f.act[k] ?? 0,
        own = drawn[i];
      if (at === undefined || !own) continue;
      if (at === PLACE_AT.none && !f.why[k]) {
        // (Gone since the plan was read: not drawn until it is read again.)
        drawn[i] = { moment: { ...own.moment, hidden: true }, size: 0, stride: own.stride };
        continue;
      }
      const walking = eta > 0 && trip > 0,
        a = this.spot(i, at),
        b = walking ? this.spot(i, to) : a,
        along = walking ? Math.max(0, Math.min(1, 1 - (eta - sub) / trip)) : 0,
        x = a.x + (b.x - a.x) * along,
        z = a.z + (b.z - a.z) * along,
        // (Asleep, or indoors getting warm: within.)
        hidden = !walking && (act === PLACE_ACT.sleep || act === PLACE_ACT.warm),
        yaw = walking ? Math.atan2(b.x - a.x, b.z - a.z) : own.moment.yaw,
        moment: Moment = {
          x,
          z,
          yaw,
          activity: walking ? ACTIVITY.walking : (DOING[act] ?? ACTIVITY.home),
          task: null,
          hidden,
          hunger: f.hunger[k] ?? 0,
          tiredness: f.tired[k] ?? 0,
          carry: null,
          why: f.why[k] ?? null,
        };
      if (walking) this.strides[i]! += dt;
      drawn[i] = { moment, size: hidden ? 0 : 1, stride: this.strides[i]! };
      const p = presence.get(this.plan.people[i]!.ref);
      if (p) {
        p.x = x;
        p.z = z;
        p.yaw = yaw;
        p.vx = 0;
        p.vz = 0;
        p.size = hidden ? 0 : 1;
        p.blinking = false;
        p.stride = this.strides[i]!;
      }
    }
  }
}
