// Where someone lives and what their day comes to (Lives L6, Classic's Address and Wages): a block on anyone's page, a named townsperson's, one
// under the hand's, a ruler's, a courtier's. Its numbers are the one reckoning their home's furniture was bought with (host/home.ts); nothing here
// is kept, and history does not pay these wages yet: it is what the market and the land's making say a day's work there comes to.
import { resolvePerson } from "../../causal/index.ts";
import type { Block, Line, PageModel, Stat } from "../../bridge/index.ts";
import type { World } from "../../kernel/index.ts";
import { OCC } from "../../rules/index.ts";
import { politiesOf, populationContext } from "../../sim/index.ts";
import {
  dwellRef,
  foodWord,
  homeFacts,
  homeTitle,
  personLiving,
  rentOf,
  townWage,
  type PersonLiving,
} from "../home.ts";
import { count, link, stat } from "./words.ts";
import { realmLink, townLink } from "./names.ts";
import { boardRef, wayRow } from "./board.ts";

const OCC_WORD: Readonly<Record<number, string>> = {
  [OCC.forager]: "a forager",
  [OCC.farmer]: "a farmer",
  [OCC.herder]: "a herder",
  [OCC.crafter]: "a crafter",
  [OCC.trader]: "a trader",
  [OCC.leader]: "a leader",
};
const AN = /^[aeiou]/i;

/** So many coin, as a purse counts it: a small sum to a tenth. */
export function coinWords(x: number): string {
  const v = Math.abs(x);
  return v >= 10 ? count(Math.round(v)) : `${Math.max(0.1, Math.round(v * 10) / 10)}`;
}

/** What so many coin buys, in days of a person's bread at this market. */
function buysWords(coin: number, bread: number, food: string): string {
  const days = coin / bread;
  return days < 0.95
    ? `not a day's ${food}`
    : days < 1.5
      ? `a day's ${food}`
      : `${count(Math.round(days))} days' ${food}`;
}

/** What they do for it, in a few words. */
function asWhat(l: PersonLiving): string {
  const { who } = l;
  if (who.figure && who.role) return who.role.replace(/^./, (c) => c.toLowerCase());
  const trade = who.trade?.kind;
  if (trade) return `${AN.test(trade) ? "an" : "a"} ${trade}`;
  return OCC_WORD[who.occupation] ?? "their work";
}

/** What they pay to live there, as the home's own page says it. */
export function paysLine(
  world: World,
  l: { readonly day: { readonly seated: boolean }; readonly r: PersonLiving["r"] },
  noHouses: boolean,
): Line {
  const { r, day } = l;
  if (noHouses) return ["Nothing: its people do not count kin, and no family holds it."];
  if (r.state !== "stands") return ["No one pays: no one lives here."];
  if (r.plan.native) return ["No rent is known: no law of land is kept here."];
  const rent = rentOf(world, r.cell, r.level);
  if (day.seated && rent?.to)
    return ["Nothing: it goes with the seat of ", realmLink(world, rent.to), "."];
  return rent
    ? [rent.words, ...(rent.to ? [realmLink(world, rent.to)] : []), "."]
    : ["No rent is known: no law of land is kept here."];
}

function livedRows(world: World, l: PersonLiving): Stat[] {
  const { r, who, day, wage } = l,
    f = homeFacts(world, r),
    food = foodWord(r.plan),
    title = homeTitle(r, f),
    eats =
      day.mouths === 1
        ? `One eats, at ${coinWords(day.bread)} coin of ${food} a day`
        : `${count(Math.round(day.mouths))} eat, at ${coinWords(day.bread)} coin of ${food} a day each: ${coinWords(day.fed)}`,
    rentWords = day.rent > 0 ? `, and ${coinWords(day.rent)} of rent` : "",
    leaves =
      day.left >= 0.05
        ? `That leaves ${coinWords(day.left)} coin.`
        : day.left <= -0.05
          ? `That is ${coinWords(day.left)} coin more than comes in: they go without, or eat what they grow.`
          : "That leaves nothing.",
    work: Line = who.child
      ? ["None: a child, who eats of what their home brings in."]
      : wage <= 0
        ? ["None: they keep no trade, and bring in nothing of their own."]
        : [
            `${coinWords(wage)} coin a day, as ${asWhat(l)}: ${buysWords(wage, day.bread, food)} at this market.`,
          ],
    from =
      day.earned < 0.05
        ? "Their home brings in nothing."
        : day.unnamed
          ? `Their home is reckoned to bring in ${coinWords(day.earned)} coin a day: the roll does not name who earns there.`
          : `Their home brings in ${coinWords(day.earned)} coin a day.`;
  return [
    stat("Their home", [
      link(title, dwellRef(r.plan.ref, r.n)),
      // (A home whose name says its town needs it said once.)
      ...(title.includes(r.plan.name) || r.plan.native
        ? r.plan.native && !title.includes(r.plan.name)
          ? [`, ${r.plan.name}`]
          : []
        : [", ", townLink(world, r.plan.ref)]),
    ]),
    stat("A day's work", work),
    stat(
      "To live there",
      l.purse === null
        ? paysLine(world, l, f.noHouses)
        : day.rent > 0
          ? `${coinWords(day.rent)} coin a day, out of their purse.`
          : "Nothing: the home is their own.",
    ),
    stat("What is left", [`${from} ${eats}${rentWords}. ${leaves}`]),
    ...(l.purse !== null ? [stat("In the purse", `${count(l.purse)} coin`)] : []),
  ];
}

/** Whether a page is of someone no longer among the living, or long gone from where it was. */
function gone(world: World, ref: string, page: PageModel): boolean {
  if (page.icon === "🪦" || page.icon === "🕯️") return true;
  if (ref.startsWith("prsn:")) return !resolvePerson(world, ref as never, 4).alive;
  if (ref.startsWith("rule:"))
    return (politiesOf(world).get(ref.slice("rule:".length) as never)?.ended ?? null) !== null;
  return ref.startsWith("folk:town:") && page.place?.scale !== "village";
}

/** The block a person's page wears (none: they are not among the living). */
function livingBlocks(world: World, ref: string, page: PageModel): Block[] {
  if (gone(world, ref, page)) return [];
  const town = page.place?.scale === "village" ? page.place.town : null,
    title = "Where they live, and what it comes to",
    l = personLiving(world, ref, town);
  if (l)
    return [
      { type: "tool", tool: "home.look", args: { town: l.r.plan.ref, n: l.r.n } },
      { type: "facts", title, rows: livedRows(world, l) },
      ...(l.r.plan.native
        ? []
        : [wayRow("🏷️", "Its market board", boardRef(l.r.plan.ref), "What things cost here")]),
      {
        type: "text",
        lines: [
          [
            `A coin is a person's ${foodWord(l.r.plan)} for a day at usual prices. History keeps a land's market, not a family's purse: this is what their work, their land's making and their standing come to, the same reckoning their home's things were bought with.`,
          ],
        ],
      },
    ];
  // In a town, but not among those it draws; or in none that is drawn.
  const name = town ? populationContext(world).settlements.get(town as never)?.name : undefined,
    portrait = page.portrait?.kind === "person" ? page.portrait : null,
    earns =
      town && portrait && !portrait.child && portrait.occupation
        ? townWage(world, town, portrait.occupation)
        : null;
  return [
    {
      type: "facts",
      title,
      rows: [
        stat(
          "Their home",
          name
            ? `Not to be seen: they are one of the many of ${name}, and their home is not among those the town draws.`
            : "Not to be seen: they are not in any town that is drawn.",
        ),
        ...(earns && earns.wage > 0
          ? [
              stat(
                "A day's work",
                `About ${coinWords(earns.wage)} coin a day in ${name}, at its middling standing: ${buysWords(earns.wage, earns.bread, "bread")} at its market.`,
              ),
            ]
          : []),
      ],
    },
  ];
}

/** The numbers at the head of their page: which home, and what a day's work brings. */
function livingStats(world: World, ref: string, page: PageModel): Stat[] {
  if (gone(world, ref, page)) return page.stats as Stat[];
  const l = personLiving(world, ref, page.place?.scale === "village" ? page.place.town : null);
  if (!l) return page.stats as Stat[];
  return [
    ...page.stats.filter((s) => s.label !== "Home"),
    stat("Home", [link(homeTitle(l.r, homeFacts(world, l.r)), dwellRef(l.r.plan.ref, l.r.n))]),
    stat("A day's work", l.wage > 0 ? `${coinWords(l.wage)} coin` : "none"),
  ];
}

/** A person's page, told where they live and what their day comes to, under what is first said of them. */
export function withLiving(world: World, ref: string, page: PageModel): PageModel {
  if (page.kind !== "person" && page.kind !== "agent") return page;
  const blocks = livingBlocks(world, ref, page);
  if (!blocks.length) return page;
  return {
    ...page,
    stats: livingStats(world, ref, page),
    tabs: page.tabs.map((t, i) => {
      if (i !== 0) return t;
      const at = t.blocks.findIndex((b) => b.type === "facts") + 1;
      return { ...t, blocks: [...t.blocks.slice(0, at), ...blocks, ...t.blocks.slice(at)] };
    }),
  };
}
