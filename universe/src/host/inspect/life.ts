// The pages of the living world and the ground (Phase 10 M91): a lineage — its body, its
// place in the web of eating, where it lives and what it is to the people — a deposit, a
// plate, and an age of the deep past.
import { AGES, BIOME_NAMES, ageRef, cellRef, isProvinceWorld, lives } from "../../gen/index.ts";
import { homePlanet, lineageNature, populationContext, wildsOf } from "../../sim/index.ts";
import { why } from "../../causal/index.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, Item, PageModel, Place, Row, Stat } from "../../bridge/index.ts";
import { depositPage, platePage, speciesPage } from "../pages.ts";
import { region } from "../planet.ts";
import { count, eventsAbout, item, link, share, stat, yearNow } from "./words.ts";
import { ORE_GRADE, REACTIONS, SUBSTANCE, SUBSTANCES, TONNES_A_UNIT } from "../../rules/index.ts";
import { DEPOSIT_MINERALS, rxnRef, substRef, weight } from "./matter.ts";
import { landLink, landTitle, landsOf, lineageIcon, spotOfLand } from "./names.ts";

const LEVEL_WORDS = [
  "",
  "the first level: what grows",
  "the second level: plant-eaters",
  "the third level: hunters",
  "the fourth level: hunters of hunters",
];

/** Where a lineage is best seen: about the town of the most peopled land it lives in, or its first land. */
function lineagePlace(world: World, index: number, origin: number): Place | null {
  const g = homePlanet(world).generated,
    ctx = populationContext(world),
    n = landsOf(world);
  let best = -1,
    most = 0;
  for (let c = 0; c < n; c++) {
    if (!lives(g.life, c, index)) continue;
    const p = ctx.provinces.get(c);
    if (!p || !ctx.settlements.inProvince(c).length) continue;
    if (wildsOf(ctx, c).lost.includes(index)) continue;
    const people = p.total();
    if (people > most) {
      most = people;
      best = c;
    }
  }
  if (best >= 0) return { scale: "village", town: ctx.settlements.inProvince(best)[0]!.ref };
  return origin >= 0 && origin < n ? { scale: "region", cell: origin } : null;
}

/** A lineage's page. */
export function lineagePage(world: World, ref: string): PageModel {
  const s = speciesPage(world, ref),
    g = homePlanet(world).generated,
    sp = g.life.species.find((x) => x.ref === ref)!,
    flies = !!sp.body && sp.body.wings > 0 && sp.body.moves === "fly";
  const stats: Stat[] = [
    stat("Lands", count(s.lands), { why: ref }),
    stat("Level", `${s.level}`, { why: ref }),
    stat(
      "Arose",
      s.arose.to
        ? `${s.arose.from.toFixed(0)}–${s.arose.to.toFixed(0)} million years ago`
        : "in the deep past",
      { why: s.arose.ref },
    ),
    stat("Living", s.died === null ? "yes" : "died out"),
  ];
  const facts: Stat[] = [
    stat("What it is", s.what),
    ...(s.body ? [stat("Its body", s.body.words)] : []),
    stat("In the web", LEVEL_WORDS[s.level] ?? `level ${s.level}`),
    ...(s.size !== null
      ? [stat("Weight", `${s.size < 1 ? s.size.toFixed(2) : count(s.size)} kg`)]
      : []),
    stat("First lived", [landLink(world, s.origin.cell), ` (${s.origin.biome})`]),
    stat(
      "Arose in",
      [
        link(
          `an age ${s.arose.from.toFixed(0)}–${s.arose.to.toFixed(0)} million years ago`,
          s.arose.ref,
        ),
      ],
      { why: s.arose.ref },
    ),
    ...(s.tame ? [stat("Tame", "it can be tamed and herded")] : []),
    ...(s.wool ? [stat("Wool", "its coat can be spun")] : []),
    ...(s.seed !== null ? [stat("Seed", "a grass whose seed can be sown")] : []),
    stat(
      "Warmth it lives in",
      `${s.tolerance ? `within ${s.tolerance} °C of what it came from` : "any"}`,
    ),
    stat("Rain it lives in", `${Math.round(s.rain[0])}–${Math.round(s.rain[1])} mm a year`),
  ];
  const people: Stat[] = [
    stat("Lands it lives in", count(s.lands)),
    stat("Of them peopled", count(s.peopled)),
    ...(s.sown ? [stat("Sown by the people", `${count(s.sown)} lands`)] : []),
    ...(s.herded ? [stat("Herded by the people", `${count(s.herded)} lands`)] : []),
    ...(s.lost ? [stat("Driven out of", `${count(s.lost)} lands`)] : []),
    ...(s.raids ? [stat("Raids the flocks of", `${count(s.raids)} lands`)] : []),
  ];
  const web: Block[] = [];
  if (s.hunts.length)
    web.push({
      type: "list",
      title: "What it hunts",
      items: s.hunts.map((k) =>
        item([link(k.name, k.ref), ` — shares ${count(k.lands)} lands`], k.ref),
      ),
    });
  if (s.huntedBy.length)
    web.push({
      type: "list",
      title: "What hunts it",
      items: s.huntedBy.map((k) =>
        item([link(k.name, k.ref), ` — shares ${count(k.lands)} lands`], k.ref),
      ),
    });
  // The lands it lives in, most peopled first (at most 40).
  const ctx = populationContext(world),
    n = landsOf(world),
    lands: number[] = [];
  for (let c = 0; c < n; c++) if (sp.died === null && lives(g.life, c, sp.index)) lands.push(c);
  const peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0;
  lands.sort((a, b) => peopleOf(b) - peopleOf(a) || a - b);
  const rows: Row[] = lands.slice(0, 40).map((c) => {
    const lost = ctx.provinces.get(c) ? wildsOf(ctx, c).lost.includes(sp.index) : false;
    return {
      ref: cellRef(0, c),
      cells: [[landLink(world, c)], [count(peopleOf(c))], [lost ? "driven out" : "lives there"]],
      keys: [landTitle(world, c), peopleOf(c), lost ? 1 : 0],
    };
  });
  return {
    ref,
    kind: "lineage",
    icon: lineageIcon(s.niche, flies),
    title: s.name[0]!.toUpperCase() + s.name.slice(1),
    subtitle: [s.what],
    color: null,
    ...(sp.body
      ? { portrait: { kind: "creature" as const, body: sp.body, name: s.name, wool: s.wool } }
      : {}),
    place: lineagePlace(world, sp.index, s.origin.cell),
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          ...(sp.body ? [{ type: "anatomy" as const, title: "Its body" }] : []),
          { type: "facts", rows: facts },
          // Its nature, as the god has left it: how tame, how fast it breeds (Phase 16).
          ...(sp.died === null && sp.niche !== "seed grass" && sp.niche !== "upright ape"
            ? (() => {
                const n = lineageNature(world, sp);
                return [
                  {
                    type: "tool" as const,
                    tool: "acts.lineage",
                    args: {
                      ref,
                      name: sp.name,
                      docility: n.docility,
                      growth: n.growth,
                      tame: sp.tame || n.docility >= 0.6,
                    },
                  },
                ];
              })()
            : []),
          { type: "why", ref },
        ],
      },
      {
        id: "web",
        name: "Web of eating",
        blocks: web.length
          ? web
          : [{ type: "text", lines: [["It hunts nothing and nothing hunts it."]] }],
      },
      {
        id: "lands",
        name: "Lands",
        blocks: [
          { type: "facts", rows: people },
          { type: "table", columns: ["Land", "People", ""], rows, ...{} },
        ],
      },
      ...(() => {
        const history = eventsAbout(world, [ref], 24);
        return history.length
          ? [
              {
                id: "history",
                name: "History",
                blocks: [{ type: "list" as const, items: history }],
              },
            ]
          : [];
      })(),
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** A deposit: what it is, how rich, what laid it down, its plate and its land. */
/**
 * A deposit's richness in words: the thirds of what the ground holds of it (200 to 2,000 units,
 * gen/deposits.ts) — thin, fair or rich.
 */
export function richWords(units: number): "thin" | "fair" | "rich" {
  return units < 800 ? "thin" : units < 1400 ? "fair" : "rich";
}

export function depositPageModel(world: World, ref: string): PageModel {
  const d = depositPage(world, ref);
  let tile: number | undefined;
  try {
    const r = region(world, d.land),
      g = homePlanet(world).generated,
      fine = isProvinceWorld(g) ? g.fine : g,
      index = fine.deposits.findIndex((x) => x.ref === ref),
      at = r.deposits.find((x) => x.deposit === index);
    tile = at?.tile;
  } catch {
    tile = undefined;
  }
  const rich = richWords(d.richness);
  return {
    ref,
    kind: "deposit",
    icon: "⛏️",
    title: `${d.kind[0]!.toUpperCase()}${d.kind.slice(1)}, ${rich}`,
    subtitle: ["In ", landLink(world, d.land)],
    color: null,
    place:
      d.land < landsOf(world)
        ? { scale: "region", cell: d.land, ...(tile !== undefined ? { tile } : {}) }
        : null,
    stats: [
      stat("Richness", `${count(d.richness)} units`),
      // (A unit of richness is a thousand tonnes of ore: Phase 15 M124.)
      stat("Ore", weight(d.richness * TONNES_A_UNIT * 1000)),
      ...(ORE_GRADE[d.kind]
        ? [
            stat(
              "Holding",
              `${weight(d.richness * TONNES_A_UNIT * 1000 * ORE_GRADE[d.kind]!.share)} of ${SUBSTANCES[SUBSTANCE[ORE_GRADE[d.kind]!.of]!]!.name}`,
            ),
          ]
        : []),
      stat("Laid down by", d.process),
      stat("People over it", count(d.people)),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Land", [landLink(world, d.land)]),
              // What it is, as matter (Phase 15 M122): its ore, and what turns that to metal.
              ...(DEPOSIT_MINERALS[d.kind]
                ? [
                    stat(
                      "Its ore",
                      DEPOSIT_MINERALS[d.kind]!.flatMap((m, i) => [
                        ...(i ? [", "] : []),
                        link(SUBSTANCES[SUBSTANCE[m]!]!.name, substRef(m)),
                      ]),
                    ),
                  ]
                : []),
              ...(() => {
                const turns = REACTIONS.filter((r) =>
                  r.inputs.some(([x]) => DEPOSIT_MINERALS[d.kind]?.includes(x)),
                );
                return turns.length
                  ? [
                      stat(
                        "Worked by",
                        turns.flatMap((r, i) => [...(i ? [", "] : []), link(r.name, rxnRef(r.id))]),
                      ),
                    ]
                  : [];
              })(),
              ...(d.plate
                ? [
                    stat("Plate", [
                      link(
                        d.plate.continental ? "a continental plate" : "an ocean plate",
                        d.plate.ref,
                      ),
                    ]),
                  ]
                : []),
              ...(d.across
                ? [
                    stat("Where it meets", [
                      link(
                        d.across.continental ? "a continental plate" : "an ocean plate",
                        d.across.ref,
                      ),
                    ]),
                  ]
                : []),
              ...(d.age
                ? [
                    stat("Laid down in", [link("an age of the deep past", d.age.ref)], {
                      why: d.age.ref,
                    }),
                  ]
                : []),
            ],
          },
          { type: "why", title: "How it came to be there", ref },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** A plate: its crust and drift, its neighbours and what lies on it. */
export function platePageModel(world: World, ref: string): PageModel {
  const p = platePage(world, ref),
    g = homePlanet(world).generated,
    fine = isProvinceWorld(g) ? g.fine : g,
    index = fine.tectonics.plates.findIndex((x) => x.ref === ref);
  let spot = -1;
  for (let c = 0; c < fine.grid.count && spot < 0; c++)
    if (fine.tectonics.plate[c] === index) spot = c;
  return {
    ref,
    kind: "plate",
    icon: "🌋",
    title: p.continental ? "A continental plate" : "An ocean plate",
    subtitle: [`${share(p.share)} of the world's face`],
    color: null,
    place: spot >= 0 ? { scale: "globe", spot } : null,
    stats: [
      stat("Share of the world", share(p.share)),
      stat("Dry land on it", share(p.dry)),
      stat("People on it", count(p.people)),
      stat("Drift", `${p.speed.toFixed(1)} cm a year`),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "list",
            title: "The plates it meets",
            items: p.neighbours.map((n) =>
              item(
                [
                  link("a plate", n.ref),
                  ` — ${["", "converging", "spreading", "sliding"][n.boundary] ?? "meeting"}`,
                ],
                n.ref,
              ),
            ),
          },
          {
            type: "list",
            title: "What lies in it",
            items: p.deposits.map((d) => item(`${d.kind}: ${count(d.count)}`)),
          },
          { type: "why", ref },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** An age of the deep past: what it was, and the lineages that arose and died in it. */
export function agePage(world: World, ref: string): PageModel {
  const g = homePlanet(world).generated,
    index = Number(ref.split(":")[2]);
  if (!(index >= 0 && index < AGES)) throw new Error(`no age ${ref}`);
  const a = g.deep.ages[index]!,
    arose: Item[] = g.life.species
      .filter((s) => s.arose === index)
      .map((s) => item([link(s.name, s.ref), ` — ${s.niche}`], s.ref)),
    died: Item[] = g.life.species
      .filter((s) => s.died === index)
      .map((s) => item([link(s.name, s.ref), ` — ${s.niche}`], s.ref));
  return {
    ref,
    kind: "age",
    icon: "⏳",
    title: `An age ${a.from.toFixed(0)}–${a.to.toFixed(0)} million years ago`,
    subtitle: [why(world, ref as never).claim],
    color: null,
    place: null,
    stats: [
      stat("Its kind", a.kind),
      stat("Sea level", `${Math.round(a.seaLevel)} m`),
      stat("Warmth", `${a.warmth >= 0 ? "+" : ""}${a.warmth.toFixed(1)} °C`),
      stat("Forests", a.forests ? "yes" : "none yet"),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "list", title: "Arose in it", items: arose },
          { type: "list", title: "Died out in it", items: died },
          {
            type: "list",
            title: "The ages",
            items: Array.from({ length: AGES }, (_, i) =>
              item(
                [
                  link(
                    `${g.deep.ages[i]!.from.toFixed(0)}–${g.deep.ages[i]!.to.toFixed(0)} million years ago: ${g.deep.ages[i]!.kind}`,
                    ageRef(0, i),
                  ),
                ],
                ageRef(0, i),
              ),
            ),
          },
          { type: "why", ref },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

export { BIOME_NAMES, spotOfLand };
