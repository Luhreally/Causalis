// A people of another star (Phase 6 M61; Phase 18 M135): what it calls itself and what it
// is, drawn in its own body; when it came to signals, to orbit and to the stars; its nature;
// the stars it holds and how it came by each; its ships under way; whom it met, how each met
// the other and how they stand now; what has passed between them; its wars.
import { CLADES } from "../../rules/index.ts";
import {
  civilizationsNear,
  homePlanet,
  peopleNature,
  peoplesOf,
  peopleWords,
  type Meeting,
} from "../../sim/index.ts";
import type { World } from "../../kernel/index.ts";
import type { Item, PageModel, Stat } from "../../bridge/index.ts";
import { PEOPLE_COLORS, metName } from "../peoples.ts";
import { figureBody, starFolk } from "../folk.ts";
import { claimOf, item, link, many, stat, yearNow } from "./words.ts";
import { starSicknessBlocks } from "./sickness.ts";

const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** How a people met another, in words. */
export const REACTION_WORDS: Readonly<Record<string, string>> = {
  wonder: "in wonder",
  fear: "in fear",
  trade: "to trade",
  war: "for war",
};

/** How two peoples stand, in a word or two. */
export function regardWords(regard: number, talking: boolean): string {
  if (!talking) return "seen, but not yet spoken with";
  return regard > 0.5
    ? "close friends"
    : regard > 0.15
      ? "on good terms"
      : regard > -0.1
        ? "wary of each other"
        : regard > -0.25
          ? "cold"
          : "at war";
}

function peopleName(world: World, ref: string): string {
  const c = civilizationsNear(world).find((x) => x.ref === ref);
  return c ? `the ${peopleWords(world, c).name}` : "another people";
}

function meetingLine(world: World, m: Meeting, civRef: string) {
  const ours = m.civ === civRef,
    other = ours ? metName(world, m) : peopleName(world, m.civ);
  return [
    link(`${other[0]!.toUpperCase()}${other.slice(1)}`, ours ? m.other : m.civ),
    `, year ${m.year}: ${ours ? "they came" : "these came"} ${REACTION_WORDS[ours ? m.theirs : m.ours] ?? "?"}, and were met ${REACTION_WORDS[ours ? m.ours : m.theirs] ?? "?"} — now ${regardWords(m.regard, m.talking)}${m.exchanges ? `, ${many(m.exchanges, "exchange", "exchanges")}` : ""}${m.raids ? `, ${many(m.raids, "raid", "raids")}` : ""}`,
  ];
}

export function civilizationPage(world: World, ref: string): PageModel {
  const civs = civilizationsNear(world),
    i = civs.findIndex((x) => x.ref === ref),
    c = civs[i];
  if (!c) throw new Error(`no people ${ref}`);
  const clade = CLADES.find((x) => x.id === c.clade)?.body,
    words = peopleWords(world, c),
    store = peoplesOf(world),
    year = yearNow(world),
    n = peopleNature(world, c),
    color = PEOPLE_COLORS[i % PEOPLE_COLORS.length]!,
    holds = store?.holdsOf(c.ref) ?? [],
    ships = (store?.ships ?? []).filter((s) => s.civ === c.ref && !s.arrived),
    meetings = (store?.meetings ?? []).filter((m) => m.civ === c.ref || m.other === c.ref),
    exchanges = (store?.exchanges ?? []).filter((x) => x.civ === c.ref || x.other === c.ref),
    raids = (store?.raids ?? []).filter((r) => r.civ === c.ref || r.other === c.ref),
    landings = (store?.landings ?? []).filter((l) => l.civ === c.ref),
    home = homePlanet(world).generated.star.ref,
    stage =
      year < c.electronics
        ? "have yet to come to electronics"
        : year < c.orbit
          ? "speak across the dark, but have not yet reached orbit"
          : year < c.stars
            ? "have reached orbit, but not yet the stars"
            : `have been at the stars ${many(year - c.stars, "year", "years")}`;
  const natureRows: Stat[] = [
    stat("Curious", `${Math.round(n.curious * 100)}%`),
    stat("Wary of strangers", `${Math.round(n.wary * 100)}%`),
    stat("Bold", `${Math.round(n.bold * 100)}%`),
    stat("Given to trade", `${Math.round(n.trading * 100)}%`),
  ];
  const holdItems: Item[] = holds.map((h) =>
      item(
        [
          link(h.star === c.star ? "Their own star" : "A star", h.star),
          ...(h.star === c.star
            ? [" — where they rose"]
            : h.from
              ? [" — taken from ", link(peopleName(world, h.from), h.from), ` in ${h.year}`]
              : h.year < 0
                ? [` — settled in our year ${h.year}, before the chronicle began`]
                : [` — settled in ${h.year}`]),
        ],
        h.event ?? h.star,
      ),
    ),
    shipItems: Item[] = ships.map((s) =>
      item(
        [
          link(
            s.kind === "fleet" ? "A fleet" : s.kind === "envoys" ? "Envoys" : "Settlers",
            s.event,
          ),
          ...(s.to === home
            ? [" bound for the home world"]
            : [" bound for ", link("a star", s.to)]),
          `, sailed ${s.sailed}, arriving ${s.arrives}`,
        ],
        s.event,
      ),
    ),
    meetingItems: Item[] = meetings.map((m) => item(meetingLine(world, m, c.ref), m.event)),
    told = (list: readonly { event: string }[]) =>
      list
        .slice(-30)
        .reverse()
        .map((x) => item([claimOf(world, x.event)], x.event));
  return {
    ref,
    kind: "civilization",
    icon: "👽",
    portrait: clade
      ? {
          kind: "person",
          ref,
          age: 30,
          span: clade.span,
          occupation: 0,
          child: false,
          era: year >= c.electronics ? "modern" : "farm",
          body: figureBody(clade, starFolk(c)),
        }
      : { kind: "flag", flags: [{ color, key: i }] },
    title: `The ${words.name}`,
    subtitle: [
      `${words.kind} of another star — `,
      link(`its ${ordinal(c.planet + 1)} world`, `${c.star}/${c.planet}`),
      `, ${c.distance.toFixed(1)} light-years out`,
    ],
    color,
    place: { scale: "world", star: c.star, index: c.planet },
    stats: [
      stat("Stars held", String(holds.length)),
      stat("Met", String(meetings.length)),
      stat("Ships out", String(ships.length)),
      stat("Distance", `${c.distance.toFixed(1)} ly`),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "text",
            lines: [
              [
                `The ${words.name} — ${words.kind} — ${stage}. They live ${c.medium === "water" ? "in the water" : c.medium === "shore" ? "in the shallows and on the shore" : "in the open air"}, under ${c.gravity.toFixed(2)} g.`,
              ],
            ],
          },
          {
            type: "facts",
            title: "Their way up",
            rows: [
              stat("Electronics", `year ${c.electronics}`),
              stat("Orbit", `year ${c.orbit}`),
              stat("The stars", `year ${c.stars}`),
              stat("Their star", [link("their star", c.star)]),
            ],
          },
          { type: "facts", title: "Their nature", rows: natureRows },
          { type: "list", title: "On the home world", items: told(landings) },
          ...starSicknessBlocks(world, c.ref),
          { type: "text", lines: [[claimOf(world, ref)]] },
          { type: "why", ref },
        ],
      },
      {
        id: "stars",
        name: "Stars",
        blocks: [
          { type: "list", title: "The stars they hold", items: holdItems },
          { type: "list", title: "Their ships under way", items: shipItems },
        ],
      },
      {
        id: "met",
        name: "Met",
        blocks: [
          { type: "list", title: "Whom they met, and how", items: meetingItems },
          { type: "list", title: "What passed between them", items: told(exchanges) },
        ],
      },
      {
        id: "wars",
        name: "Wars",
        blocks: [
          { type: "list", title: "Their fleets, and fleets against them", items: told(raids) },
        ],
      },
    ],
    followable: false,
    year,
  };
}
