// A band's camp on its land (Phase 28 M159, asked for 2026-10-24: "i should be able to be in my
// game and see the cell stage and every stage like spore i would just watch it emerge"): who
// camp there and how many bands they are, how they live — the game they hunt, the flocks they
// keep — how far they range and when they move on, and whether their land has come to farm. Pure
// reads of the land as it stands.
import { YEAR, type World } from "../../kernel/index.ts";
import { populationContext, regionOf } from "../../sim/index.ts";
import type { CampCraft, Item, LandCamp, Line, PageModel, Span, Stat } from "../../bridge/index.ts";
import { campCraft } from "../camp.ts";
import { CAMP_RANGE, landCamps } from "../land.ts";
import { province } from "../planet.ts";
import { count, item, link, many, share, stat, yearNow } from "./words.ts";
import { faithLink, landLink, languageLink } from "./names.ts";

/** The game a band hunts: the land's beasts that graze and browse, and its great beasts. */
const GAME = new Set(["grazer", "browser", "great beast"]);

/** The page of a camp of a land's bands. */
export function campRef(cell: number, id: number): string {
  return `camp:${cell}:${id}`;
}

/** A camp's name: "a band of foragers", "3 bands of herders". */
function campName(c: LandCamp): string {
  return `${c.bands > 1 ? `${c.bands} bands` : "a band"} of ${c.herds ? "herders" : "foragers"}`;
}

/** A band's stone in a few words: its name, and how it takes an edge and bears a blow. */
function stoneWords(s: CampCraft["stone"]): string {
  const edge =
      s.keen >= 0.95 ? "the keenest edge" : s.keen >= 0.75 ? "a keen edge" : "a rough edge",
    blow = s.tough >= 0.8 ? ", tough" : s.tough < 0.35 ? ", but brittle" : "";
  return `${s.name}: ${edge}${blow}`;
}

/** Words joined as a list: "a", "a and b", "a, b and c". */
function listed(spans: readonly Span[]): Line {
  return spans.flatMap((s, i) => [
    ...(i === 0 ? [] : i === spans.length - 1 ? [" and "] : [", "]),
    s,
  ]);
}

export function campPage(world: World, ref: string): PageModel {
  const [cell, id] = ref
      .slice(ref.indexOf(":") + 1)
      .split(":")
      .map(Number) as [number, number],
    known = Number.isInteger(cell) && Number.isInteger(id) && cell >= 0,
    p = known ? province(world, cell) : null,
    camps = p ? landCamps(world, cell) : [],
    camp = camps.find((c) => c.id === id),
    year = yearNow(world);
  if (!camp || !p)
    return {
      ref,
      kind: "camp",
      icon: "⛺",
      title: "A camp",
      subtitle: known ? ["Of ", landLink(world, cell, true)] : ["Of a land"],
      color: null,
      place: null,
      stats: [],
      tabs: [
        {
          id: "overview",
          name: "Overview",
          blocks: [
            {
              type: "text",
              lines: [
                [
                  "No band camps here now: they have settled in a village, gone with another band, or their people have grown fewer.",
                ],
              ],
            },
          ],
        },
      ],
      followable: false,
      year,
    };
  const r = regionOf(populationContext(world), cell),
    across = Math.round((2 * CAMP_RANGE + 1) * r.tileKm),
    // (They move camp as the seasons turn: four times a year.)
    into = (world.now % (YEAR / 4)) / (YEAR / 4),
    here = Math.floor(into * 3),
    left = Math.max(1, Math.round((1 - into) * 3)),
    game = p.wild.filter((s) => GAME.has(s.niche) && !s.tame),
    flocks = p.wild.filter((s) => GAME.has(s.niche) && s.tame),
    // Their crafts (Phase 49 M211): of the ground their camp stands on.
    c = campCraft(world, cell, camp.tile),
    stats: Stat[] = [
      stat("People", count(camp.people), { why: p.folk }),
      ...(camp.bands > 1 ? [stat("Bands", count(camp.bands))] : []),
      stat(
        "Living by",
        camp.herds ? "their flocks, and what they gather and hunt" : "what they gather and hunt",
        { why: camp.herds ? p.herding : p.folk },
      ),
      stat("Ranging", `about ${across} km across`),
      stat("Camped here", here ? `${many(here, "month", "months")} ago` : "this month"),
      stat("Moving on", `in about ${many(left, "month", "months")}`),
      stat("Their land fed", share(p.fed / 1000), { why: p.folk }),
      stat("Farming", p.farming ? "known in their land" : "not yet known in their land", {
        why: p.cultivation,
      }),
      stat("Their stone", stoneWords(c.stone)),
    ];
  const who: Line = [
      `They are of the people of `,
      landLink(world, cell, true),
      ...(p.ways?.language ? [", speaking ", languageLink(world, p.ways.language.ref)] : []),
      ...(p.faith ? [", keeping ", faithLink(world, p.faith.ref)] : []),
      ".",
    ],
    how: Line = [
      `They camp a season at a time about a range of theirs some ${across} km across — tents in a ring about the fire${camp.herds ? ", their flocks grazing about the camp" : ""} — and move on as the seasons turn, four times a year, coming back about the same grounds.`,
    ],
    hunt: Line = game.length
      ? [
          "They hunt ",
          ...listed(game.slice(0, 4).map((s) => link(`the ${s.name}`, s.ref))),
          p.ecology.wild < 0.95
            ? ` — the game of their land at ${share(p.ecology.wild)} of what it was before anyone hunted it.`
            : ".",
        ]
      : ["There is little game in their land: they live by what they gather."],
    herd: Line | null =
      camp.herds && flocks.length
        ? ["Their flocks are ", ...listed(flocks.slice(0, 3).map((s) => link(s.name, s.ref))), "."]
        : null,
    stone: Span = c.stone.ref ? link(c.stone.name, c.stone.ref) : c.stone.name,
    crafts: Line = [
      "They knap ",
      stone,
      ` — ${c.stone.from} — into blades, scrapers and spear points; twist ${c.fibre} into cord; bind their points to shafts of ${c.wood} with ${c.binding}; scrape the hides of what they kill on frames, and sew them into cloaks with bone awls; grind ${c.pigment?.name ?? "colour"}; and ${c.fire === "none" ? "make no fire: nothing burns in their air" : `make fire ${c.fire === "strike-a-light" ? `by striking ${c.stone.name} on pyrite` : `with a ${c.fire}`}`}.`,
    ],
    next: Line = p.farming
      ? [
          "Their land has learned to farm: those who take to it leave the camps for villages, and fewer bands are left to roam.",
        ]
      : [
          "Their land has not learned to farm: they will keep to their camps until it does — of itself, or taught by a land near it that has.",
        ];
  const others: Item[] = camps
    .filter((c) => c.id !== camp.id)
    .map((c) =>
      item(`${c.herds ? "🐑" : "⛺"} ${campName(c)} · ${count(c.people)}`, campRef(cell, c.id)),
    );
  return {
    ref,
    kind: "camp",
    icon: camp.herds ? "🐑" : "⛺",
    title: campName(camp).replace(/^a/, "A"),
    subtitle: ["Camped in ", landLink(world, cell, true)],
    color: null,
    place: { scale: "region", cell, tile: camp.tile },
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "facts", rows: stats },
          // (Down among one of its bands, Phase 29 M160.)
          { type: "tool", tool: "watch.camp", args: { cell, camp: camp.id } },
          { type: "text", lines: [who, how, hunt, ...(herd ? [herd] : []), crafts, next] },
          ...(others.length
            ? [{ type: "list" as const, title: "The land's other camps", items: others }]
            : []),
        ],
      },
    ],
    followable: false,
    year,
  };
}
