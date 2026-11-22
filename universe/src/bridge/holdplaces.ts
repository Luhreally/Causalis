// Where a town's strongholds and seats stand (bridge/strongholds.ts holdSpot): each on the ground an attacker would face the
// most about it, the realm's near the town, the great houses' out in its land. The town's own view, its land's map and its
// countryside's fields read the same places, so nothing is laid on another: what a stronghold stands on is its own, the
// town's homes yield it, and its fields are sown about it. Pure; read from the plan.
import { HOLD_FOOT, holdSpot, type HoldForm, type HoldSpot, type ShowForm } from "./strongholds.ts";
import { wallAt } from "./wall.ts";
import { BLOCK_LOTS, footprint, type TownLots, type TownPlan } from "./town.ts";
import type { TownHold } from "./rank.ts";

/** One thing standing at a stronghold's place: the stronghold itself, or the seat of display raised since. */
export type HoldPlace = HoldSpot & {
  readonly hold: TownHold;
  readonly what: HoldForm | ShowForm;
  /** Whether it is the seat of display (else the stronghold). */
  readonly show: boolean;
};

/** How far out from its square a realm's stronghold is sought, and a house's (metres; a house's each further out). */
export const HOLD_OUT = { realm: 150, house: 330, houseStep: 90 } as const;
/** The breadth more a hamlet of tenants takes about its house's ground (metres). */
export const HAMLET_RING = 30;

/** How much ground one place takes (metres from its middle): its own, and its tenants' hamlet about it. */
export function holdReach(what: HoldForm | ShowForm, hamlet: boolean): number {
  return HOLD_FOOT[what] + (hamlet ? HAMLET_RING : 0);
}

/** How many of a town's lots its strongholds' places are laid about: the same on every device and view, whatever each draws. */
export const HOLD_LOTS = 8000;

/** Where one of a holder's things stands (TownHold.places): its spot, what it is, and whether it is the seat of display. */
export type HoldSpotOf = HoldSpot & { readonly what: HoldForm | ShowForm; readonly show: boolean };

/**
 * Where each of a town's strongholds and seats stands (none where no dry ground is free): read by the host once for every view
 * (host/town.ts), off its first HOLD_LOTS lots (`lots`) and the buildings among them (`civics`), so that its own view on any
 * device, its land's map and its fields all read one place. Off its buildings, its market place, its main streets, its walls'
 * line, and each other.
 */
export function holdLay(
  plan: Pick<TownPlan, "site" | "water" | "sealed">,
  holds: readonly TownHold[],
  lots: TownLots,
  civics: readonly { readonly at: number; readonly lots: number }[],
): TownHold[] {
  if (plan.sealed) return [...holds];
  const n = lots.x.length,
    feet = civics.filter((c) => c.at + c.lots <= n).map((c) => footprint(lots, c.at, c.lots)),
    place = lots.blocks.place,
    mains = lots.blocks.mains ?? [],
    line = lots.blocks.wall?.line ?? null,
    taken: HoldSpot[] = [];
  const free = (x: number, z: number, r: number) => {
    for (const f of feet)
      if (Math.hypot(f.x - x, f.z - z) < r + Math.hypot(f.w, f.d) / 2 + 4) return false;
    if (place && Math.hypot(place.x - x, place.z - z) < r + Math.hypot(place.w, place.d) / 2)
      return false;
    for (const m of mains)
      for (let i = 0; i < m.x.length; i++)
        if (
          m.since[i]! < Math.ceil(n / BLOCK_LOTS) &&
          Math.hypot(m.x[i]! - x, m.z[i]! - z) < r + m.len[i]! / 2 + m.half
        )
          return false;
    if (line) {
      const d = Math.hypot(x, z),
        w = wallAt(line, Math.atan2(z, x));
      if (Math.abs(d - w) < r + 8) return false;
    }
    for (const p of taken) if (Math.hypot(p.x - x, p.z - z) < r + p.r + 12) return false;
    return true;
  };
  let houses = 0;
  return holds.map((h) => {
    const base =
        h.holder === "realm" ? HOLD_OUT.realm : HOLD_OUT.house + HOLD_OUT.houseStep * houses++,
      things: { what: HoldForm | ShowForm; show: boolean }[] = [];
    if (h.hold.form) things.push({ what: h.hold.form, show: false });
    if (h.hold.show) things.push({ what: h.hold.show, show: true });
    const places: HoldSpotOf[] = [];
    for (const t of things) {
      const r = holdReach(t.what, !!h.hamlet && t === things[things.length - 1]),
        spot = holdSpot(plan.site, plan.water, base + r, r, free);
      if (!spot) continue;
      taken.push(spot);
      places.push({ ...spot, what: t.what, show: t.show });
    }
    return { ...h, places };
  });
}

const KEPT = new WeakMap<TownPlan, HoldPlace[]>();

/** A town's strongholds and seats, where each stands, as its plan carries them (holdLay). `lots`: unused, as of old. */
export function holdPlaces(plan: TownPlan, lots?: TownLots): readonly HoldPlace[] {
  void lots;
  const holds = plan.rank?.holds;
  if (!holds?.length || plan.sealed) return [];
  let out = KEPT.get(plan);
  if (!out) {
    out = holds.flatMap((h) => (h.places ?? []).map((p) => ({ ...p, hold: h })));
    KEPT.set(plan, out);
  }
  return out;
}

/** Whether a point lies on ground a town's strongholds and seats hold (`pad` metres more about them). */
export function onHeld(places: readonly HoldPlace[], x: number, z: number, pad = 0): boolean {
  for (const p of places) if (Math.hypot(p.x - x, p.z - z) < p.r + pad) return true;
  return false;
}
