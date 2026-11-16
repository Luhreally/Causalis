// Life's kinds in play, on the pages (Round D; sim/ecology/lineage.ts): what lives off a land's flocks and wild beasts
// and what keeps it down, and on the tree's page the stocks cut off going apart from their kinds. Pure reads.
import type { World } from "../../kernel/index.ts";
import { generationYears } from "../../rules/index.ts";
import { herdIndex, herdsOf, kindsInPlayOf, populationContext } from "../../sim/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import { landLink } from "./names.ts";
import { item, link, stat } from "./words.ts";

const hundred = (thousandths: number) => `${Math.round(thousandths / 10)} in a hundred`;

/** What lives with and off a land's beasts and flocks. */
export function partnersBlock(world: World, cell: number): Block | null {
  const l = kindsInPlayOf(world)?.lands.get(cell);
  if (!l) return null;
  const rows: Stat[] = [
    stat(
      "Off its flocks",
      l.flocks > 0
        ? `worms, ticks and flukes, ${hundred(l.flocks)} of the load their crowding holds: they take ${hundred(l.toll)} of what the flocks give`
        : "too few beasts to a field for what lives off them to pass from one to the next",
    ),
    stat(
      "Off its wild beasts",
      l.wild > 0 ? `${hundred(l.wild)} of the load` : "too few to carry any",
    ),
    stat(
      "What keeps it down",
      l.cleaned > 0
        ? `the eaters of the dead and the small hunters that pick a beast clean: they take ${hundred(l.cleaned)} of its passing`
        : "nothing: no eaters of the dead nor small hunters are left to it",
    ),
    stat(
      "Seed carriers",
      l.carried > 0
        ? `seed eaters and browsers carry what the wild gives to where it grows again (${hundred(l.carried)} of their full)`
        : "none",
    ),
  ];
  return { type: "facts", title: "Partners and parasites", rows };
}

/** The tree's page: the stocks cut off now going apart from their kinds, and how far. */
export function apartBlock(world: World): Block | null {
  const store = kindsInPlayOf(world),
    herds = herdsOf(world);
  if (!store?.apart.size || !herds) return null;
  const ctx = populationContext(world),
    idx = herdIndex(ctx),
    g = ctx.generated;
  if (!idx) return null;
  const items = [...store.apart.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 12)
    .flatMap(([cell, apart]) => {
      const s = g.life.species[idx.kind[cell]!];
      if (!s) return [];
      return [
        item([
          "The ",
          link(s.name, s.ref),
          " of ",
          landLink(world, cell, true),
          `, cut off: ${Math.round(apart / 10)} in a hundred of the way to a kind of its own (a generation every ${generationYears(s.size).toFixed(1)} years)`,
        ]),
      ];
    });
  return items.length
    ? {
        type: "list",
        title: "Going apart",
        items,
      }
    : null;
}
