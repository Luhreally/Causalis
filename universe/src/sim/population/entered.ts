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
import { farRoads, farShut, type FarShut } from "../../gen/index.ts";
import { PRINCIPLES, PRINCIPLE_INDEX, type FarMade } from "../../rules/index.ts";
import { giveLore, loreOf, openTo } from "../lore/lore.ts";
import type { PopulationContext } from "./systems.ts";

/**
 * The first road to the age a people was read at that their cradle does not hold, and why (null: it holds them all, and
 * what flies can be built): gen/far.ts's reading, of what their cradle's lore holds now. No rule here gives a people
 * what its limbs cannot work or its ground cannot fuel.
 */
export function shutAge(ctx: PopulationContext, cell: number, far: FarMade): FarShut | null {
  const lore = loreOf(ctx.world),
    prov = ctx.provinces.get(cell),
    has = (id: string) => (id === "cultivation" ? !!prov?.knowsCultivation : !!lore.get(cell, id));
  return farShut(ctx.generated, far, has);
}

/** The most crafts a land is given: the tree's whole length and to spare. */
const MOST = 400;

/**
 * The crafts a people read at a stage is known to have, on this world: from nothing, the next the tree opens to them,
 * again and again, until every road of every age up to theirs is met by one of its crafts (or the tree opens nothing
 * more: a world whose matter shuts a road keeps it shut). The tree's order; "cultivation" among them.
 */
export function knownAt(ctx: PopulationContext, cell: number, far: FarMade): string[] {
  const roads = farRoads(far.stage).map((r) => r.road);
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
