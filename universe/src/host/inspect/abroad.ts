// Peoples abroad as a page's section (sim/culture/abroad.ts): who of another people lives in a land, how many, come from where,
// and what that does; and where a land's own people live abroad. A number a land by people of origin: no one is kept by name.
import type { World } from "../../kernel/index.ts";
import type { Block, Row } from "../../bridge/index.ts";
import { ABROAD } from "../../rules/index.ts";
import { abroadOf, languagesOf, populationContext } from "../../sim/index.ts";
import { count, link, share } from "./words.ts";
import { landLink, landTitle } from "./names.ts";

/** A land's peoples abroad in it, and its own people abroad elsewhere (none of either: nothing). */
export function abroadBlocks(world: World, cell: number): Block[] {
  const store = abroadOf(world);
  if (!store || !store.size || !world.hasStore("culture.languages")) return [];
  const languages = languagesOf(world),
    ctx = populationContext(world),
    people = ctx.provinces.get(cell)?.total() ?? 0,
    out: Block[] = [],
    here = store.of(cell);
  if (here?.length) {
    const rows: Row[] = here.map((e) => {
      const l = languages.at(e[0]);
      return {
        cells: [
          [l ? link(`${l.name}-speakers`, l.ref) : "another people"],
          [share(e[1] / 1000)],
          [count((people * e[1]) / 1000)],
          [landLink(world, e[2])],
          [`year ${count(e[3])}`],
        ],
        keys: [l?.name ?? "", e[1], (people * e[1]) / 1000, landTitle(world, e[2]), e[3]],
      };
    });
    out.push({
      type: "table",
      title: "Peoples from elsewhere who live here",
      columns: ["People", "Of its people", "About", "Most came from", "Since"],
      rows,
    });
    out.push({
      type: "text",
      lines: [
        [
          `Those who came into a land that speaks another tongue are counted so until their young take the speech around them (half in ${ABROAD.halves === 1 ? "a generation" : `${ABROAD.halves} generations`}, sooner the nearer the two tongues and where its people read). While they are, more passes down the road to the land they came from, this land counts its seat's people the less its own, and its town's quarters are set the more apart.`,
        ],
      ],
    });
  }
  // Its own people elsewhere: the lands that keep people come from here.
  const away: Row[] = [];
  for (const c of store.lands()) {
    if (c === cell) continue;
    for (const e of store.of(c)!) {
      if (e[2] !== cell) continue;
      const n = ((ctx.provinces.get(c)?.total() ?? 0) * e[1]) / 1000;
      away.push({
        cells: [[landLink(world, c)], [share(e[1] / 1000)], [count(n)], [`year ${count(e[3])}`]],
        keys: [landTitle(world, c), e[1], n, e[3]],
      });
    }
  }
  if (away.length)
    out.push({
      type: "table",
      title: "Its people who live elsewhere",
      columns: ["In", "Of that land's people", "About", "Since"],
      rows: away.sort((a, b) => (b.keys![2] as number) - (a.keys![2] as number)).slice(0, 8),
    });
  return out;
}
