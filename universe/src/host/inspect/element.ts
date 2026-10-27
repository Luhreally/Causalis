// An element's page (Phase 54 M223, `elem:<symbol>`): what it is as it stands pure — its atomic mass,
// its state at 15 °C, its sort, one plain sentence of its nature — and what on this world holds it:
// every substance whose formula has it, the largest share of its weight first. Pure reads of the
// world's chemistry, as the matter pages are; its picture is drawn from its nature (host/looks.ts).
import { elementShares, findElement } from "../../rules/index.ts";
import { worldChemistry } from "../../gen/index.ts";
import { homePlanet } from "../../sim/index.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, Item, PageModel } from "../../bridge/index.ts";
import { elementNature, elementPortrait, matterPortrait, type ElementNature } from "../looks.ts";
import { item, link, stat, yearNow } from "./words.ts";
import { substRef, substancesOn } from "./matter.ts";
import { withLifeSubstances } from "../biochem.ts";

/** How many of the substances that hold it are listed; the rest are counted. */
const MOST_HELD = 40;

const STATE_WORDS: Readonly<Record<ElementNature["state"], string>> = {
  solid: "a solid",
  liquid: "a liquid",
  gas: "a gas",
};
const SORT_WORDS: Readonly<Record<ElementNature["sort"], string>> = {
  metal: "a metal",
  metalloid: "a metalloid",
  nonmetal: "not a metal",
  noble: "a noble gas, that joins with nothing",
};

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** What an element is, in one plain sentence, from its nature. */
function natureSentence(n: ElementNature): string {
  if (n.sort === "noble")
    return n.state === "gas"
      ? "A gas that glows when lightning passes through it."
      : "A noble element, that joins with nothing.";
  if (n.kept)
    return n.sort === "metal"
      ? "A metal, kept under oil: it burns in the air."
      : "A solid that is not a metal, kept under water: it burns in the air.";
  if (n.sort === "metal") return "A metal, that carries heat and the current well.";
  if (n.sort === "metalloid")
    return "A metalloid, between metal and not: it carries the current only some of the time.";
  return n.state === "gas" ? "A gas that is not a metal." : "A solid that is not a metal.";
}

/** An element's page (`elem:<symbol>`). */
export function elementPage(world: World, ref: string): PageModel {
  const symbol = ref.slice(ref.indexOf(":") + 1),
    el = findElement(symbol);
  if (!el) throw new Error(`no element ${ref}`);
  const nature = elementNature(symbol),
    chem = worldChemistry(homePlanet(world).generated),
    // Every substance of this world whose formula has the element, its share of the weight first.
    holds = withLifeSubstances(world, substancesOn(chem))
      .filter((s) => s.formula[symbol] !== undefined)
      .map((s) => ({ s, share: elementShares(s).find(([e]) => e === symbol)?.[1] ?? 0 }))
      .sort((a, b) => b.share - a.share || (a.s.id < b.s.id ? -1 : 1));
  const items: Item[] = holds.slice(0, MOST_HELD).map(({ s }) => ({
    ...item([link(cap(s.name), substRef(s.id)), ` — ${s.written}`], substRef(s.id)),
    thumb: matterPortrait(s),
  }));
  const blocks: Block[] = [
    { type: "text", lines: [[natureSentence(nature)]] },
    {
      type: "list",
      title: "What holds it",
      items,
      ...(holds.length > MOST_HELD ? { more: holds.length - MOST_HELD } : {}),
    },
  ];
  const portrait = elementPortrait(symbol);
  return {
    ref,
    kind: "element",
    icon: "⚛️",
    title: `${cap(el.name)} (${el.symbol})`,
    subtitle: ["An element: its atoms all of one kind"],
    color: null,
    ...(portrait ? { portrait } : {}),
    place: null,
    stats: [
      stat("A mole weighs", `${el.mass} g`),
      stat("At 15 °C", STATE_WORDS[nature.state]),
      stat("It is", SORT_WORDS[nature.sort]),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: yearNow(world),
  };
}
