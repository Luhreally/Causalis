// What a world can do (Phase 65): why it stands at the age it does, what it lacks for the next, each of
// the six measures with what it is read from, and what the world's matter can and cannot later do.
// Read, every word of it, from the world as it stands now (host/reading.ts).
import type { World } from "../../kernel/index.ts";
import {
  AGE_LADDER,
  COVER_PEOPLE_KM2,
  MEASURES,
  MEASURE_IDS,
  MIRROR_DOUBLING,
  VAT_PEOPLE_KM2,
  energyOf,
  fitOf,
  hasWords,
  lifeOf,
  LIFE_STEPS,
  measureSteps,
  mirrorKw,
  mostMirrorsKm2,
  readFunctions,
  remadeGround,
  stuffOf,
  sumsOf,
  worldDiscKm2,
  type Ask,
  type Figures,
  type FunctionReading,
  type LandFacts,
  type MeasureId,
} from "../../rules/index.ts";
import { coverOf, lateOf, populationContext, remakeGround, rockEarths } from "../../sim/index.ts";
import type { Block, Item, Line, PageModel, Row, Stat } from "../../bridge/index.ts";
import { ageWorldOf, lacksNow, matterWorldOf, worldReadingOf } from "../reading.ts";
import { principleName } from "../../causal/index.ts";
import { landLink, realmLink } from "./names.ts";
import { stageOf } from "./stage.ts";
import { count, item, link, stat, yearNow } from "./words.ts";

const measureRef = (id: MeasureId) => `means:${id}`;
const prinRef = (id: string) => `prin:${id}`;

/** A principle's name as a link to its page. */
function prinLink(world: World, id: string) {
  return link(principleName(id, world), prinRef(id));
}

/** An age's ask, met: "✓ 0.4 kW behind each person: it has 8 kW a head". */
function askRow(ask: Ask, figures: Figures): Item {
  return item(`✓ ${ask.words}: it has ${hasWords(ask.on, figures)}`);
}

/** A function of the world's matter, as an entry that opens its stuff's page. */
function functionItem(f: FunctionReading): Item {
  return item(
    [`${f.met ? "✓" : "✗"} ${f.icon} ${f.name}: `, f.why],
    f.subst ? `subst:${f.subst}` : null,
  );
}

/**
 * A world's great works past our ages (Phase 66), as they stand: its mirrors, its worlds being remade, how
 * far its lands are built on. Each with what it asks, and what it is made of on this world.
 */
function greatWorks(world: World): Block[] {
  const ctx = populationContext(world),
    g = ctx.generated,
    late = lateOf(world),
    { built, lands } = coverOf(ctx),
    disc = worldDiscKm2(g.planet.radius),
    most = mostMirrorsKm2(rockEarths(g), g.system.bodies[0]!.orbit.a),
    blocks: Block[] = [];
  const m = late?.mirrors;
  blocks.push({
    type: "text",
    title: "🪞 Mirrors about its star",
    lines: m
      ? [
          [
            `Begun in year ${count(m.year)}, by `,
            realmLink(world, m.realm),
            `. They stand at ${count(Math.round(m.km2))} km², doubling every ${MIRROR_DOUBLING} years while a realm with a station tends them: `,
            m.km2 >= disc
              ? `more than falls on its whole world, whose disc is ${count(Math.round(disc))} km². `
              : `its whole world's disc is ${count(Math.round(disc))} km². `,
          ],
          [
            `They gather ${kwWords(mirrorKw(m.km2, g.star.luminosity, g.system.bodies[0]!.orbit.a))} of its star's light. A kilogram of foil to the square metre, out of the ${Math.round(rockEarths(g) * 1000) / 1000} home-world masses of rock in its system's small bodies, is ${count(Math.round(most))} km² at most.${m.km2 >= disc ? " It is spent out there among them, where the cold can carry its heat away: brought down, that much would boil its seas." : ""}`,
          ],
        ]
      : [
          [
            `None yet. A works of mirrors asks a realm with a station that knows `,
            prinLink(world, "star-mirrors"),
            ", and machines to build the first of them. Each then builds the next, out of its system's small bodies.",
          ],
        ],
  });
  const all = late?.all() ?? [];
  blocks.push(
    all.length
      ? {
          type: "table",
          title: "🌍 Worlds being remade",
          columns: ["World", "Begun", "So far"],
          rows: all.map((r): Row => {
            const ground = remakeGround(world, g, r.cell),
              now = ground ? remadeGround(ground, r.share) : null;
            return {
              ref: `cell:0:${r.cell}`,
              cells: [
                [landLink(world, r.cell, true)],
                [`year ${count(r.year)}`],
                [
                  r.done
                    ? `remade: walked on under its own sky`
                    : `${Math.round(r.share * 100)} in a hundred${now ? `: ${Math.round(now.pressure * 100) / 100} bar, ${Math.round(now.temperature)} °C` : ""}`,
                ],
              ],
            };
          }),
        }
      : {
          type: "text",
          title: "🌍 Worlds being remade",
          lines: [
            [
              "None yet. A remaking asks a realm with a station and halls on a body whose pull can hold an air, and that knows ",
              prinLink(world, "world-making"),
              ".",
            ],
          ],
        },
  );
  blocks.push({
    type: "text",
    title: "🌃 Its lands built on",
    lines: [
      [
        `${count(built)} of its ${count(lands)} peopled lands hold ${COVER_PEOPLE_KM2} people or more to the square kilometre: more towers than fields. Half of them is a world covered, and that asks `,
        prinLink(world, "world-city"),
        `, as no field feeds so many, and only vats do: ${VAT_PEOPLE_KM2} people to the square kilometre at most.`,
      ],
    ],
  });
  return blocks;
}

const kwWords = (kw: number) =>
  kw >= 1e15
    ? `${Math.round(kw / 1e12).toLocaleString("en")} terawatts`
    : `${count(Math.round(kw / 1e6))} gigawatts`;

/** The world's matter, as a page's blocks: what it can do now, and what ages past ours ask of it. */
export function functionBlocks(world: World): Block[] {
  const all = readFunctions(matterWorldOf(world));
  return [
    {
      type: "list",
      title: "What its matter does now",
      items: all.filter((f) => !f.later).map(functionItem),
    },
    {
      type: "list",
      title: "What ages past ours ask of it",
      items: all.filter((f) => f.later).map(functionItem),
    },
    {
      type: "text",
      lines: [
        [
          "Each of those is a way its people may come to or never will: what its world's matter cannot do, no people of it will ever find. Tap one for what meets it here.",
        ],
      ],
    },
  ];
}

/** "What a world can do": why it stands where it stands, its measures, its road and its matter. */
export function meansPage(world: World, tab?: string): PageModel {
  const { reading, lands } = worldReadingOf(world),
    lacks = lacksNow(world),
    stage = stageOf(world),
    at = AGE_LADDER.indexOf(reading.age),
    stats: Stat[] = reading.measures.map((m) =>
      stat(MEASURES[m.id].name, [link(m.words, measureRef(m.id))]),
    );
  const here: Block[] = [
    ...(lands.length
      ? []
      : [
          {
            type: "text" as const,
            lines: [["No people stand on this world, so there is nothing yet to measure."]],
          },
        ]),
    {
      type: "text",
      title: `Why it stands at ${reading.name}`,
      lines: [
        ...(stage.fell
          ? [
              [
                `It came to ${stage.fell.name} in year ${count(stage.fell.year)}, and no longer has what that takes.`,
              ],
            ]
          : []),
        ...(reading.named
          ? [[`${reading.named[0]!.toUpperCase()}${reading.named.slice(1)}.`]]
          : []),
        [
          "A world's age is read from what its peoples can do now, the highest whose asks all stand met. Each of them is below; each measure has a page of its own.",
        ],
      ],
    },
    {
      type: "list",
      title: "What this age asks, and it has",
      items: reading.age.asks.length
        ? reading.age.asks.map((a) => askRow(a, reading.figures))
        : [item("Nothing: people, and the land they walk.")],
    },
  ];
  if (lacks) {
    here.push({
      type: "list",
      title: `What it lacks for ${lacks.age.name}`,
      items: lacks.age.asks.map((a) => {
        const lack = lacks.lacks.find((l) => l.words === a.words);
        if (!lack) return askRow(a, reading.figures);
        const line: Line[number][] = [`✗ ${lack.words}: it has ${lack.has}.`];
        if (lack.known) {
          line.push(" It knows ", prinLink(world, lack.road!), ".");
          if (lack.wanting) line.push(` ${lack.wanting}`);
        } else if (lack.shut) {
          line.push(` Its people never will: ${lack.shut}`);
        } else if (lack.road) {
          const next = lack.next.filter((id) => id !== lack.road);
          line.push(" The way here is ", prinLink(world, lack.road));
          if (next.length) {
            line.push(", and first ");
            next.slice(0, 3).forEach((id, i) => {
              if (i) line.push(i === next.slice(0, 3).length - 1 ? " and " : ", ");
              line.push(prinLink(world, id));
            });
          }
          line.push(".");
        }
        return item(line, lack.road ? prinRef(lack.road) : null);
      }),
    });
  } else
    here.push({
      type: "text",
      lines: [
        [
          "It has come as far as any age yet told. Nothing a people of this universe has done lies past it.",
        ],
      ],
    });
  const measures: Block[] = [
    {
      type: "table",
      title: "What it can do",
      columns: ["Measure", "Now", "By"],
      rows: reading.measures.map((m): Row => ({
        ref: measureRef(m.id),
        cells: [
          [`${MEASURES[m.id].icon} ${MEASURES[m.id].name}`],
          [m.words],
          [
            m.principle ? prinLink(world, m.principle) : m.by,
            ...(m.land !== null ? [" in ", landLink(world, m.land, true)] : []),
          ],
        ],
      })),
    },
    {
      type: "text",
      lines: [
        [
          "Each is read from what the world holds now, its foremost land's figure among those with people enough to count. Nothing here is a list of what a world has been given: lose the fuel, the machines or the halls, and the measure falls with them.",
        ],
      ],
    },
  ];
  const road: Block[] = [
    {
      type: "table",
      title: "The ages",
      columns: ["Age", "Asks", "First reached"],
      rows: AGE_LADDER.map((a, i): Row => {
        const s = stage.stages.find((x) => x.id === a.id);
        return {
          cells: [
            [`${i === at ? "▶ " : ""}${a.icon} ${i === at ? reading.name : (s?.name ?? a.name)}`],
            [
              a.asks.length
                ? a.asks.map((x) => x.words).join("; ")
                : "people, and the land they walk",
            ],
            [s?.year !== null && s?.year !== undefined ? `year ${count(s.year)}` : "not yet"],
          ],
        };
      }),
    },
    {
      type: "text",
      lines: [
        [
          "An age is the highest whose asks all stand met now, so a world can fall back down this road. Its first year is the chronicle's, and stays: ",
          link("the chronicle's firsts", "world:chronicle"),
          ".",
        ],
      ],
    },
  ];
  return {
    ref: "world:means",
    kind: "means",
    icon: reading.icon,
    title: "What it can do",
    subtitle: [`It stands at ${reading.name}`],
    color: null,
    place: null,
    stats,
    tabs: [
      { id: "why", name: "Why here", blocks: here },
      { id: "measures", name: "Measures", blocks: measures },
      { id: "road", name: "The road", blocks: road },
      { id: "matter", name: "Its matter", blocks: functionBlocks(world) },
      { id: "works", name: "Great works", blocks: greatWorks(world) },
    ],
    ...(tab ? { tab } : {}),
    followable: false,
    year: yearNow(world),
    every: 3,
  };
}

/** A land's figure on a measure, as a number to sort by and its words. */
function landFigure(
  id: MeasureId,
  f: LandFacts,
  world: World,
): { value: number; words: string } | null {
  const w = ageWorldOf(populationContext(world).generated);
  switch (id) {
    case "energy": {
      const x = energyOf(f);
      return { value: x, words: `${Math.round(x * 100) / 100} kW` };
    }
    case "materials": {
      const s = stuffOf(f, w.chem);
      return { value: s.strength, words: `${s.name}, ${count(s.strength)} MPa` };
    }
    case "precision": {
      const x = fitOf(f);
      return { value: -x.mm, words: `${x.mm} mm` };
    }
    case "computing": {
      const x = sumsOf(f);
      return { value: x.sums, words: x.sums >= 1 ? `${count(x.sums)} sums a second` : x.words };
    }
    case "life": {
      const x = lifeOf(f);
      return { value: x.level, words: LIFE_STEPS[x.level]!.words };
    }
    case "reach":
      return null;
  }
}

/** A measure's page (`means:<id>`): what it is, what it stands at, what brings each step of it. */
export function measurePage(world: World, ref: string): PageModel {
  const id = ref.slice(ref.indexOf(":") + 1) as MeasureId;
  if (!MEASURE_IDS.includes(id)) throw new Error(`no measure ${ref}`);
  const def = MEASURES[id],
    { reading, lands } = worldReadingOf(world),
    m = reading.measures.find((x) => x.id === id)!,
    w = ageWorldOf(populationContext(world).generated),
    knows = (p: string) => lands.some((f) => f.knows(p)),
    steps = measureSteps(id, knows, w);
  const blocks: Block[] = [
    {
      type: "text",
      lines: [
        [def.what],
        [def.read],
        [
          `It stands at ${m.words}: ${m.by}`,
          ...(m.land !== null ? [", in ", landLink(world, m.land, true)] : []),
          ".",
        ],
      ],
    },
    {
      type: "table",
      title: "What brings it",
      columns: ["Step", "Figure", ""],
      rows: steps
        .filter((s) => s.open)
        .map((s): Row => ({
          ...(s.by ? { ref: prinRef(s.by) } : s.subst ? { ref: `subst:${s.subst}` } : {}),
          cells: [
            [s.by ? link(s.words, prinRef(s.by)) : s.words],
            [s.figure],
            [s.known ? "✓ known" : s.open ? "not yet" : "shut to its people"],
          ],
        })),
    },
  ];
  if (id !== "reach") {
    const best = lands
      .map((f) => ({ f, at: landFigure(id, f, world)! }))
      .sort((a, b) => b.at.value - a.at.value || b.f.people - a.f.people || a.f.cell - b.f.cell)
      .slice(0, 6);
    blocks.push({
      type: "table",
      title: "Its foremost lands",
      columns: ["Land", "Figure", "People"],
      rows: best.map(({ f, at }): Row => ({
        ref: `cell:0:${f.cell}`,
        cells: [[landLink(world, f.cell, true)], [at.words], [count(f.people)]],
        keys: [f.cell, at.value, f.people],
      })),
    });
  }
  return {
    ref,
    kind: "measure",
    icon: def.icon,
    title: def.name,
    subtitle: [`${m.words} — one of what `, link("this world can do", "world:means")],
    color: null,
    place: null,
    stats: [stat("Now", m.words), stat("By", m.by)],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: yearNow(world),
    every: 3,
  };
}
