// A world of another star entered, seated as its people were read (rules/far.ts; docs/architecture §7: prehistory is
// generated, not ticked). A people read from afar in its towns, at its engines or in orbit did not open its chronicle
// as bands with nothing in their hands: what they are known to have is part of what was read. So the chronicle of a
// world entered opens with its lands knowing the crafts that bring the age they were read at, by the road its own
// matter and their own bodies allow (rules/ages.ts AGE_LADDER, the tree's order), each as learning it would have left
// it; what they build with them from there is the rules' own, year by year. A people read in its camps opens as bands
// with nothing more, and as many as were read: the lands nearest their cradle, until that many live there.
//
// Part of the world's making, keyed to nothing but its seed's text: no command, no draw, and no world of its own seed
// is touched.
import type { Ref } from "../../kernel/index.ts";
import { surfaceOre } from "../../gen/index.ts";
import {
  AGE_LADDER,
  FAR_STAGE_AGE,
  PRINCIPLES,
  PRINCIPLE_INDEX,
  type FarMade,
} from "../../rules/index.ts";
import { giveLore, loreOf, openTo } from "../lore/lore.ts";
import type { PopulationContext } from "./systems.ts";

/** The roads of every age up to the one a people was read at: each a list of crafts, any one of which brings it. */
function roadsTo(far: FarMade): { readonly age: string; readonly road: readonly string[] }[] {
  const top = AGE_LADDER.findIndex((a) => a.id === FAR_STAGE_AGE[far.stage]);
  return AGE_LADDER.slice(1, Math.max(1, top + 1)).flatMap((a) =>
    a.asks.flatMap((x) => (x.road ? [{ age: a.id, road: x.road }] : [])),
  );
}

/**
 * The first age on the way to the one a people was read at whose road their cradle does not hold (its id; null: it
 * holds them all). Where the tree opened no craft of a road to them at their seating, their own bodies or their
 * world's matter shut it: a people whose limbs cannot tend a fire was read among the stars by a sight that does not
 * read limbs, and no rule here gives them what their bodies cannot do.
 */
export function shutAge(ctx: PopulationContext, cell: number, far: FarMade): string | null {
  const lore = loreOf(ctx.world),
    prov = ctx.provinces.get(cell),
    has = (id: string) => (id === "cultivation" ? !!prov?.knowsCultivation : !!lore.get(cell, id));
  const road = roadsTo(far).find((r) => !r.road.some(has))?.age ?? null;
  if (road !== null) return road;
  // Past its engines an age is flown, and what flies is built of machines (sim/space/space.ts). A world makes them in
  // works that burn coal, in works its currents or its own engines drive where nothing burns, or by minds of crystal
  // (rules/goods.ts): where its people's fire wants coal and no land of theirs holds a seam (too little life has lain
  // buried there), they hold the craft and can never work it. The far sight's own reading of peoples it does not
  // follow says the same of such a world (sim/space/natives.ts, its ceiling).
  if (FLOWN.includes(far.stage) && !machinesCan(ctx, has)) return "orbit";
  return null;
}

/** The stages read of a people that has flown: what machines alone build. */
const FLOWN: readonly FarMade["stage"][] = ["orbit", "stars"];

/** Whether any land of a people can make machines, by what they know and what their lands hold. */
function machinesCan(ctx: PopulationContext, has: (id: string) => boolean): boolean {
  if (has("sea-works") || has("machine-minds")) return true;
  if (!has("factories")) return false;
  if (!ctx.affords.fire) return true;
  const g = ctx.generated;
  return ctx.provinces.all().some((p) => p.total() > 0 && surfaceOre(g, p.cell, "coal"));
}

/** The most crafts a land is given: the tree's whole length and to spare. */
const MOST = 400;

/**
 * The crafts a people read at a stage is known to have, on this world: from nothing, the next the tree opens to them,
 * again and again, until every road of every age up to theirs is met by one of its crafts (or the tree opens nothing
 * more: a world whose matter shuts a road keeps it shut). The tree's order; "cultivation" among them.
 */
export function knownAt(ctx: PopulationContext, cell: number, far: FarMade): string[] {
  const roads = roadsTo(far).map((r) => r.road);
  if (!roads.length) return [];
  const known = new Set<string>(),
    met = () => roads.every((r) => r.some((id) => known.has(id))),
    out: string[] = [];
  while (!met() && out.length < MOST) {
    const next = openTo(ctx, cell, (id) => known.has(id))[0];
    if (!next) break;
    known.add(next.id);
    out.push(next.id);
  }
  return out;
}

/** Each peopled land given what its people are known to have, as of the chronicle's opening. */
export function seatKnown(ctx: PopulationContext, home: number, far: FarMade, event: Ref): number {
  const ids = knownAt(ctx, home, far);
  if (!ids.length) return 0;
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    for (const id of ids) {
      if (id === "cultivation") {
        if (!p.knowsCultivation) {
          p.knowsCultivation = true;
          p.cultivation = event;
        }
        continue;
      }
      // (Every land opens knowing nothing, so what the tree opened to their cradle it opens to each.)
      giveLore(ctx, p.cell, PRINCIPLES[PRINCIPLE_INDEX.get(id)!]!, event);
    }
  }
  return ids.length;
}
