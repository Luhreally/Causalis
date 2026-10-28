// A beast possessed, the view's part (Phase 61): the taking laid out from the beasts drawn about a
// town (view/fauna.ts) — it and the nearest beasts about it, each of its kind and its herd (the
// town's flock, a herd of the wild, a hunting band), where they stand; each herd's middle; the water
// near and the flock's pasture — and the beasts drawn from its small world: those in it where the host
// steps them, grazing, running, lying where they were brought down. Pure.
import type { BeastTakeArgs, HeldBody, VillagePlan } from "../bridge/index.ts";
import { WILD_MOST } from "../rules/index.ts";
import type { BeastNow, Fauna } from "./fauna.ts";

/** How far about the one taken the small world gathers beasts (metres of the town's ground). */
export const WILD_GATHER = 140;
/** How wide the water drinks from is (m about the plan's water's spot). */
const WATER_R = 14;

const an = (w: string) => `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`;

/**
 * The taking of one of the beasts drawn about a town (`index` in `beasts`, as view/fauna.ts beastsAt
 * laid them, `n` of them; null: none such, or one of the road's): what it is called, its kinds, its
 * bodies, their herds and the flock's members.
 */
export function beastTakeOf(
  plan: VillagePlan,
  fauna: Fauna,
  beasts: readonly BeastNow[],
  n: number,
  index: number,
): BeastTakeArgs | null {
  const me = beasts[index];
  if (!me || index >= n || me.dead || me.id >= 950000) return null;
  const near = beasts
      .slice(0, n)
      .filter(
        (b) =>
          b !== me && !b.dead && b.id < 950000 && Math.hypot(b.x - me.x, b.z - me.z) <= WILD_GATHER,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z) || a.id - b.id,
      )
      .slice(0, WILD_MOST - 1),
    all = [me, ...near],
    kinds: string[] = [],
    kindOf = (b: BeastNow) => {
      const ref = fauna.species[b.species]!.ref;
      let k = kinds.indexOf(ref);
      if (k < 0) k = kinds.push(ref) - 1;
      return k;
    },
    herdIndex: number[] = [],
    herdOf = (b: BeastNow) => {
      if (b.herd < 0 || b.id >= 900000) return -1;
      let k = herdIndex.indexOf(b.herd);
      if (k < 0) k = herdIndex.push(b.herd) - 1;
      return k;
    },
    bodies: number[] = [],
    members: number[] = [];
  for (const b of all) {
    const flock = b.herd >= 0 && b.id < 900000 && !!fauna.herds[b.herd]?.flock;
    bodies.push(b.id, kindOf(b), herdOf(b), b.x, b.z, b.yaw);
    members.push(flock ? b.id % 1000 : -1);
  }
  if (kinds.length > 8) return null;
  // Each herd's middle: its beasts drawn now (else where it was laid).
  const herds: number[] = [];
  for (const h of herdIndex) {
    let x = 0,
      z = 0,
      k = 0;
    for (let i = 0; i < n; i++) {
      const b = beasts[i]!;
      if (b.herd !== h || b.dead || b.id >= 900000) continue;
      x += b.x;
      z += b.z;
      k++;
    }
    const home = fauna.herds[h]!.home;
    herds.push(k ? x / k : home.x, k ? z / k : home.z, fauna.herds[h]!.flock ? 1 : 0);
  }
  const sp = fauna.species[me.species]!,
    flock = members[0]! >= 0;
  return {
    village: plan.ref,
    name: flock ? `${an(sp.name)} of ${plan.name}'s flock` : an(sp.name),
    kinds,
    bodies,
    members,
    herds,
    water: plan.water ? [plan.water.x, plan.water.z, WATER_R] : [],
    pasture: flock ? [plan.pasture.x, plan.pasture.z, plan.pasture.r] : [],
  };
}

/**
 * The beasts drawn about the town with those of a held one's small world where it has them (`out`,
 * `n` of them, as view/fauna.ts beastsAt laid them; `bodies` the small world's now): where they stand,
 * which way, at a walk or a run, head down grazing, lying where they were brought down. Those the
 * small world holds that the layout has not drawn now (a flock's beast folded away) are not drawn.
 */
export function heldBeastsOver(out: BeastNow[], n: number, bodies: readonly HeldBody[]): void {
  if (!bodies.length) return;
  const by = new Map<number, HeldBody>();
  for (const b of bodies) by.set(b.id, b);
  for (let i = 0; i < n; i++) {
    const o = out[i]!,
      b = by.get(o.id);
    if (!b) continue;
    const speed = Math.hypot(b.vx, b.vz);
    o.x = b.x;
    o.z = b.z;
    o.yaw = b.yaw;
    o.dead = b.doing === "dead";
    o.pose.gait = o.dead ? 0 : speed > 3.2 ? 2 : speed > 0.2 ? 1 : 0;
    o.pose.head =
      b.doing === "graze" || b.doing === "eat" || b.doing === "drink"
        ? 1
        : b.doing === "flee" || b.doing === "hunt"
          ? 0
          : 0.3;
    o.pose.crouch = o.dead || b.doing === "hunt" ? 1 : 0;
  }
}
