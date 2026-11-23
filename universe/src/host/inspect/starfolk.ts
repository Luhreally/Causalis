// A people of another star (Phase 6 M61; Phase 18 M135): what it calls itself and what it
// is, drawn in its own body; when it came to signals, to orbit and to the stars; its nature;
// the stars it holds and how it came by each; its ships under way; whom it met, how each met
// the other and how they stand now; what has passed between them; its wars.
import { farHouseOf, farReignsOf, farRulerOf, peopleTemper } from "../../sim/index.ts";
import { civBody } from "../../gen/index.ts";
import {
  civilizationsEver,
  civilizationsNear,
  farOf,
  folkByRef,
  homePlanet,
  peopleNature,
  peoplesOf,
  peopleWords,
  type Meeting,
} from "../../sim/index.ts";
import type { Civilization } from "../../gen/index.ts";
import { yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import type { Item, PageModel, Stat } from "../../bridge/index.ts";
import { PEOPLE_COLORS, metName } from "../peoples.ts";
import { figureBody, starFolk } from "../folk.ts";
import { claimOf, count, item, link, many, stat, yearNow } from "./words.ts";
import { folkBlocks, nativePage } from "./natives.ts";
import { starSicknessBlocks } from "./sickness.ts";
import { starLifeBlock } from "../biochem.ts";
import { farLifeTab } from "./farlife.ts";

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
  // (Those whose world is gone are still who they were, in every line that names them.)
  const c = civilizationsEver(world).find((x) => x.ref === ref);
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

/** A people whose world was unmade (W6): who they were, what became of them and whose hand it was. */
function unmadePage(world: World, c: Civilization): PageModel {
  const words = peopleWords(world, c),
    fall = farOf(world)?.falls.find(
      (f) => f.rung === "world" && f.star === c.star && f.planet === c.planet,
    );
  return {
    ref: c.ref,
    kind: "civilization",
    icon: "🌑",
    title: `The ${words.name}`,
    subtitle: [
      `${words.kind}, once, of `,
      link(`a world now gone`, `${c.star}/${c.planet}`),
      `, ${c.distance.toFixed(1)} light-years out`,
    ],
    color: null,
    place: { scale: "world", star: c.star, index: c.planet },
    stats: fall
      ? [
          stat("Unmade", `Year ${fall.year}`, { why: fall.event }),
          stat("By", fall.by ? [link(fall.name, fall.by)] : "the god's hand"),
        ]
      : [],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "text",
            lines: [
              [
                `The ${words.name} are gone. ${fall ? `Their world was unmade in year ${fall.year}, by ${fall.by ? fall.name : "the god's hand"}, ` : "Their world was unmade, "}and all of them who were on it with it. Rubble goes round their star where it was.`,
              ],
              ...(fall ? [[claimOf(world, fall.event)]] : []),
            ],
          },
          ...(fall
            ? [
                {
                  type: "tool" as const,
                  tool: "watch.far",
                  args: { id: fall.event, label: "🌑 Watch it unmade" },
                },
              ]
            : []),
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

export function civilizationPage(world: World, ref: string): PageModel {
  const civs = civilizationsNear(world),
    i = civs.findIndex((x) => x.ref === ref),
    c = civs[i];
  if (!c) {
    // (A people history does not follow, risen on its own world: Phase 69.)
    const risen = folkByRef(world, ref);
    if (risen) return nativePage(world, risen);
    const lost = civilizationsEver(world).find((x) => x.ref === ref);
    if (lost) return unmadePage(world, lost);
    throw new Error(`no people ${ref}`);
  }
  const clade = civBody(c),
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
    // (A year never to come: their own world shuts the road to it, sim/space/far-read.ts. Said as that.)
    never = (y: number) => !Number.isFinite(y),
    held = folkByRef(world, c.ref)?.shut ?? null,
    stage =
      year < c.electronics
        ? never(c.electronics)
          ? "will not come to electronics on their own world"
          : "have yet to come to electronics"
        : year < c.orbit
          ? never(c.orbit)
            ? "speak across the dark, and will not reach orbit from their own world"
            : "speak across the dark, but have not yet reached orbit"
          : year < c.stars
            ? never(c.stars)
              ? "have reached orbit, and will not reach the stars from their own world"
              : "have reached orbit, but not yet the stars"
            : `have been at the stars ${many(year - c.stars, "year", "years")}`,
    yearOr = (y: number) => (never(y) ? "never, on their own world" : `year ${y}`);
  // (Who leads them, and the house that holds their seat: read off them and the year, sim/space/far-rulers.ts.)
  const ruler = farRulerOf(world, c, year),
    house = farHouseOf(world, c, year),
    own = peopleTemper(world, c),
    bentWords = (b: number, more: string, less: string) =>
      Math.abs(b) < 0.03 ? null : b > 0 ? more : less,
    bents = ruler
      ? [
          bentWords(ruler.bent[0], "more curious", "less curious"),
          bentWords(ruler.bent[1], "warier of strangers", "less wary of strangers"),
          bentWords(ruler.bent[2], "bolder", "less bold"),
          bentWords(ruler.bent[3], "more given to trade", "less given to trade"),
        ].filter((x): x is string => x !== null)
      : [],
    under = (now: number, was: number) =>
      ruler && Math.round(now * 100) !== Math.round(was * 100)
        ? {
            parts: [
              { label: ["their own"], value: `${Math.round(was * 100)}%` },
              {
                label: [`under ${ruler.name}`],
                value: `${now >= was ? "+" : ""}${Math.round((now - was) * 100)}`,
              },
            ],
          }
        : {};
  const natureRows: Stat[] = [
    stat("Curious", `${Math.round(n.curious * 100)}%`, under(n.curious, own.curious)),
    stat("Wary of strangers", `${Math.round(n.wary * 100)}%`, under(n.wary, own.wary)),
    stat("Bold", `${Math.round(n.bold * 100)}%`, under(n.bold, own.bold)),
    stat("Given to trade", `${Math.round(n.trading * 100)}%`, under(n.trading, own.trading)),
  ];
  const heardOf = farReignsOf(world)?.of(c.ref);
  const leadRows: Stat[] = ruler
    ? [
        stat(
          ruler.many ? "The line that leads them" : "Who leads them",
          `${ruler.name}${house && house.name !== ruler.name ? ` of the house of ${house.name}` : ""}`,
        ),
        stat("Since", `year ${count(ruler.since)}, the ${ordinal(ruler.reign + 1)} to lead them`),
        ...(house
          ? [
              stat(
                "The house that holds their seat",
                house.old
                  ? `${house.name}, for longer than is reckoned`
                  : `${house.name}, since year ${count(house.since)}: ${many(house.reigns, "reign", "reigns")}`,
              ),
            ]
          : []),
        stat("Against their people", bents.length ? bents.join(", ") : "much as their people are"),
        // (What their signals last told of their seat: sim/space/far-reigns.ts.)
        ...(heardOf?.event
          ? [
              stat("Last heard of their seat", lastHeard(world, heardOf.event, heardOf), {
                why: heardOf.event,
              }),
            ]
          : []),
      ]
    : [];
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
              stat("Electronics", yearOr(c.electronics)),
              stat("Orbit", yearOr(c.orbit)),
              stat("The stars", yearOr(c.stars)),
              ...(held ? [stat("What holds them", held)] : []),
              stat("Their star", [link("their star", c.star)]),
            ],
          },
          ...(() => {
            const f = folkByRef(world, c.ref);
            return f ? folkBlocks(world, f) : [];
          })(),
          ...(leadRows.length
            ? [{ type: "facts" as const, title: "Who leads them", rows: leadRows }]
            : []),
          { type: "facts", title: "Their nature", rows: natureRows },
          starLifeBlock(world, c),
          { type: "list", title: "On the home world", items: told(landings) },
          ...starSicknessBlocks(world, c.ref),
          { type: "text", lines: [[claimOf(world, ref)]] },
          { type: "why", ref },
        ],
      },
      // (Their life by their own numbers: round F.)
      ...(() => {
        const life = farLifeTab(world, c.ref, color);
        return life ? [life] : [];
      })(),
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

/**
 * What the home world last heard of a far people's seat, as its light brought it: who held it and of what house, the reign,
 * and the year it was so and the year its light came (sim/space/far-reigns.ts).
 */
function lastHeard(
  world: World,
  event: Ref,
  r: { readonly house: string; readonly reign: number },
): string {
  const e = world.events.get(event),
    d = e?.data as { ruler?: string; then?: number } | null | undefined,
    who =
      d?.ruler && d.ruler !== r.house
        ? `${d.ruler}, of the house of ${r.house}`
        : `the house of ${r.house}`,
    when =
      typeof d?.then === "number" && e
        ? `: as it stood in year ${count(d.then)}, its light come in year ${count(yearOfMoment(e.t))}`
        : "";
  return `${who}, the ${ordinal(r.reign + 1)} reign${when}`;
}
