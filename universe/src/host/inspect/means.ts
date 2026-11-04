// What a world can do (Phase 65): why it stands at the age it does, what it lacks for the next, each of
// the six measures with what it is read from, and what the world's matter can and cannot later do.
// Read, every word of it, from the world as it stands now (host/reading.ts).
import type { World } from "../../kernel/index.ts";
import {
  AGE_LADDER,
  MEASURES,
  MEASURE_IDS,
  energyOf,
  fitOf,
  hasWords,
  lifeOf,
  LIFE_STEPS,
  measureSteps,
  readFunctions,
  stuffOf,
  sumsOf,
  type Ask,
  type Figures,
  type FunctionReading,
  type LandFacts,
  type MeasureId,
} from "../../rules/index.ts";
import { populationContext } from "../../sim/index.ts";
import type { Block, Item, Line, PageModel, Row, Stat } from "../../bridge/index.ts";
import { ageWorldOf, lacksNow, matterWorldOf, worldReadingOf } from "../reading.ts";
import { principleName } from "../../causal/index.ts";
import { landLink } from "./names.ts";
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

/** The world's matter, as a page's blocks: what it can do now, and what ages past ours would ask. */
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
      title: "What ages past ours would ask of it",
      items: all.filter((f) => f.later).map(functionItem),
    },
    {
      type: "text",
      lines: [
        [
          "No people has come to those last yet. They are told here so a world's matter can be read for what it would and would not allow.",
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
          "It has come as far as the ages yet told go. What lies past them, its matter may or may not allow: see Its matter.",
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
