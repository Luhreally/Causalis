// What can be done here (F5, docs/architecture/first-principles-plan.md): a world's page of functions, each with
// its means here, its figure, what its people have come to and what shuts the rest; and two worlds set side by
// side. Read, every word, from rules/can.ts: a why here is the same reading that says whether, and asking moves
// nothing. Another world's column needs only what that world is made of, so any seed can be typed.
import { seedFromText, type World } from "../../kernel/index.ts";
import {
  generateHomeWorld,
  meansNumbers,
  provinceWorld,
  worldKindOf,
  type HomeWorld,
  type ProvinceWorld,
} from "../../gen/index.ts";
import {
  EARTHLIKE,
  KINDS,
  OPEN,
  PRINCIPLES,
  asLandsStand,
  causesOf,
  laneLaw,
  oddNumbers,
  openSteps,
  ownRoadOf,
  readCan,
  stepName,
  type CanWorld,
  type FunctionHere,
  type RungHere,
} from "../../rules/index.ts";
import {
  knows as landKnows,
  laneLawOf,
  loreOf,
  populationContext,
  spreadOf,
} from "../../sim/index.ts";
import type { Block, Item, Line, PageModel, Row, SideCell, Span } from "../../bridge/index.ts";
import { canWorldOf } from "../can.ts";
import { landsOf } from "../../rules/index.ts";
import { celsius, lifelessWhy } from "../kinds.ts";
import { functionBlocks } from "./means.ts";
import { knownStat } from "./signals.ts";
import { landLink } from "./names.ts";
import { count, link, stat, yearNow } from "./words.ts";

const prinRef = (id: string) => `prin:${id}`;
const cap = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;
const low = (s: string) => `${s[0]!.toLowerCase()}${s.slice(1)}`;

/** A rung's name as a link to the thing it is. */
function rungName(r: RungHere, capital = false): Span {
  const text = capital ? cap(r.name) : r.name;
  return r.by ? link(text, prinRef(r.by)) : r.subst ? link(text, `subst:${r.subst}`) : text;
}

/** Names as words, the last with "and": "a, b and c". */
function andList(spans: readonly Span[]): Span[] {
  return spans.flatMap((s, i) => [...(i ? [i === spans.length - 1 ? " and " : ", "] : []), s]);
}

/** What a land's knowledge has come to: each step's first year, and whether any peopled land holds it now. */
type Knowledge = ReadonlyMap<string, { year: number; cell: number; now: boolean }>;

/** A function's own lines. */
function functionItems(f: FunctionHere, w: CanWorld, known: Knowledge | null): Item[] {
  const items: Item[] = [],
    when = (r: RungHere): string => {
      const k = r.by ? known?.get(r.by) : undefined;
      return k ? `, since year ${count(k.year)}` : "";
    };
  if (f.now)
    items.push({
      tone: "have",
      line: [f.says.before, rungName(f.now, !f.says.before), `${f.says.after}${when(f.now)}.`],
      ...(f.now.by ? { ref: prinRef(f.now.by) } : {}),
    });
  else if (f.top && !(known && f.next))
    items.push({
      tone: "open",
      line: [
        known ? "Not yet. At best: " : "At best: ",
        rungName(f.top),
        f.top.figure ? `, ${f.top.figure}.` : ".",
      ],
      ...(f.top.by ? { ref: prinRef(f.top.by) } : {}),
    });
  // The way it came, where it came by more than two rungs: each with its first year (signals: a word's way from a runner to a web).
  const before =
    f.now && known
      ? f.rungs.slice(0, f.rungs.indexOf(f.now)).filter((r) => r.state === "have" && r.by)
      : [];
  if (before.length >= 2)
    items.push({
      tone: "have",
      line: [
        "Came by ",
        ...andList(
          before.map((r) => {
            const k = known?.get(r.by!);
            return link(k ? `${r.name} (${count(k.year)})` : r.name, prinRef(r.by!));
          }),
        ),
        ".",
      ],
    });
  // Not reached: what it wants first.
  const next = known ? f.next : null;
  if (next) {
    const k = next.by ? known?.get(next.by) : undefined,
      wants = next.missing.filter((id) => id !== next.by);
    items.push({
      tone: "open",
      line: [
        f.now ? "Next: " : "Not yet. Next: ",
        rungName(next),
        next.figure ? `, ${next.figure}. ` : ". ",
        ...(k
          ? [`Known once, from year ${count(k.year)}: no land that knew it still has people.`]
          : wants.length
            ? [
                "First: ",
                ...andList(wants.slice(0, 3).map((id) => link(stepName(id, w), prinRef(id)))),
                wants.length > 3 ? ` and ${count(wants.length - 3)} more.` : ".",
              ]
            : ["Its people could set about it now."]),
      ],
      ...(next.by ? { ref: prinRef(next.by) } : {}),
    });
    if (f.top && f.top !== next)
      items.push({
        tone: "open",
        line: ["At best: ", rungName(f.top), f.top.figure ? `, ${f.top.figure}.` : "."],
        ...(f.top.by ? { ref: prinRef(f.top.by) } : {}),
      });
  }
  // What this world shuts: rungs of Earth's own road, gathered by what shuts them.
  const shut = new Map<string, RungHere[]>();
  for (const r of f.rungs)
    if (r.state === "shut" && r.why) shut.set(r.why, [...(shut.get(r.why) ?? []), r]);
  for (const [why, rungs] of [...shut].slice(0, 3))
    items.push({
      tone: "shut",
      line: [
        // (What its world's making shuts, never; what its lands lack, as they stand: they may yet spread.)
        asLandsStand(rungs[0]!.cause ?? "") ? "Not as its lands stand: " : "Never ",
        ...andList(rungs.map((r) => rungName(r))),
        rungs.length === 1 && rungs[0]!.figure ? ` (${rungs[0]!.figure})` : "",
        `: ${low(why)}`,
      ],
    });
  if (!items.length) items.push({ tone: "shut", line: [f.words] });
  return items;
}

/** A function as a block of the page. */
const functionBlock = (f: FunctionHere, w: CanWorld, known: Knowledge | null): Block => ({
  type: "list",
  title: `${f.icon} ${f.name}`,
  items: functionItems(f, w, known),
});

/** What is odd about a world: what shuts most of Earth's road, its numbers far from Earth's, and its own way. */
function oddItems(w: CanWorld, open: ReadonlySet<string>): Item[] {
  const all = causesOf(w, open),
    causes = all.slice(0, 3),
    numbers = oddNumbers(w, new Set(all.map((c) => c.key))),
    items: Item[] = causes.map((c) => ({
      tone: "shut",
      line: [
        `${c.words} That shuts `,
        ...andList(c.steps.slice(0, 3).map((id) => link(stepName(id, w), prinRef(id)))),
        c.steps.length > 3
          ? ` and ${count(c.steps.length - 3)} more ${c.steps.length === 4 ? "step" : "steps"}.`
          : ".",
      ],
    }));
  for (const n of numbers.slice(0, Math.max(1, 4 - items.length)))
    items.push({ tone: "open", line: [`${n.icon} ${n.words}`] });
  const own = ownRoadOf(open);
  if (own.length)
    items.push({
      tone: "have",
      line: [
        "Its own road, which Earth's never walks: ",
        ...andList(own.slice(0, 3).map((id) => link(stepName(id, w), prinRef(id)))),
        own.length > 3 ? ` and ${count(own.length - 3)} more.` : ".",
      ],
    });
  if (!items.length)
    items.push({
      tone: "have",
      line: [
        w.numbers.firstRoad
          ? "Nothing about it is odd: it is the world every other world's numbers are read against."
          : "Every step of Earth's own road stands open to it.",
      ],
    });
  return items;
}

/** A world's facts in a few words. */
function worldWords(g: HomeWorld, w: CanWorld): string {
  const k = KINDS[worldKindOf(g)],
    n = meansNumbers(g),
    who = !g.life.people
      ? g.life.species.length
        ? "life, and no people"
        : "no life"
      : n.medium === "water"
        ? "a people of the water"
        : n.grips
          ? "a people who grip"
          : "a people who cannot grip";
  return `${k.icon} ${cap(k.name)}, ${Math.round(n.pull * 100) / 100} g, ${celsius(n.kelvin - 273.15)}: ${who}.${w.means.burns ? " Fire burns here." : ""}`;
}

/** A world not this one, as its making leaves it: kept, for its page is read again and again. */
type Other = {
  readonly universe: string;
  readonly seed: string;
  readonly g: ProvinceWorld;
  readonly w: CanWorld;
  readonly open: ReadonlySet<string>;
  readonly read: readonly FunctionHere[];
};
const OTHERS = new Map<string, Other>();
function otherWorld(universe: string, seed: string): Other {
  const key = `${universe}|${seed}`,
    kept = OTHERS.get(key);
  if (kept) return kept;
  const earth = universe === "earth",
    fine = generateHomeWorld(seedFromText(seed), earth ? EARTHLIKE : OPEN),
    g = provinceWorld(fine, landsOf(seed)),
    cells = fine.life.people ? spreadOf(g, seed).lands.map(([c]) => c) : [],
    w = canWorldOf(g, cells, laneLaw(seed, earth).open),
    open = openSteps(w),
    other = { universe, seed, g, w, open, read: readCan(w, open, () => false) };
  if (OTHERS.size >= 6) OTHERS.delete(OTHERS.keys().next().value!);
  OTHERS.set(key, other);
  return other;
}

/** The world the eye is on: what it knows now, and what that opens. */
export function hereOf(world: World) {
  const ctx = populationContext(world),
    g = ctx.generated as ProvinceWorld,
    lore = loreOf(world),
    known = new Map<string, { year: number; cell: number; now: boolean }>(),
    peopled: number[] = [];
  for (const prov of ctx.provinces.all()) {
    const now = prov.total() > 0;
    if (now) peopled.push(prov.cell);
    for (const [id, k] of lore.of(prov.cell)) {
      const had = known.get(id);
      if (!had) known.set(id, { year: k.year, cell: prov.cell, now });
      else {
        if (now) had.now = true;
        if (k.year < had.year) {
          had.year = k.year;
          had.cell = prov.cell;
        }
      }
    }
    if (now)
      for (const root of ["cultivation", "metalworking"])
        if (!known.get(root)?.now && landKnows(ctx, prov.cell, root))
          known.set(root, { year: known.get(root)?.year ?? 0, cell: prov.cell, now: true });
  }
  const text = world.seed.text,
    first = g.life.people ? spreadOf(g, text).lands.map(([c]) => c) : [],
    cells = [...new Set([...first, ...peopled])],
    w = canWorldOf(g, cells, laneLawOf(world).open),
    open = openSteps(w, known.keys()),
    now = (id: string) => !!known.get(id)?.now,
    read = readCan(w, open, now);
  return { g, w, open, known, read, peopled };
}

/** A side's cell for a function. */
function sideCell(f: FunctionHere): SideCell {
  const r = f.top,
    shut = f.rungs.find((x) => x.state === "shut" && x.why);
  return r
    ? {
        tone: shut ? "open" : "have",
        line: [rungName(r, true), r.figure ? `: ${r.figure}` : ""],
        ...(shut
          ? {
              why: [
                `${asLandsStand(shut.cause ?? "") ? "Not as its lands stand" : "Never"} ${shut.name}: ${low(shut.why!)}`,
              ],
            }
          : {}),
      }
    : {
        tone: "shut",
        line: ["Shut"],
        ...(shut ? { why: [shut.why!] } : {}),
      };
}

/** The two worlds' own numbers, side by side. */
function factRows(a: { g: HomeWorld; w: CanWorld }, b: { g: HomeWorld; w: CanWorld }) {
  const row = (label: string, say: (x: { g: HomeWorld; w: CanWorld }) => SideCell) => {
    const cells = [say(a), say(b)] as const;
    return {
      label,
      parts: JSON.stringify(cells[0].line) !== JSON.stringify(cells[1].line),
      cells,
    };
  };
  return [
    row("🔥 Its air", ({ w }) =>
      w.numbers.freeOxygen
        ? { tone: "have", line: ["Free oxygen: a fuel burns"] }
        : { tone: "shut", line: ["No free oxygen: nothing burns"] },
    ),
    row("⚖️ Its pull", ({ w }) => ({
      tone: Math.abs(w.numbers.pull - 1) < 0.2 ? "have" : "open",
      line: [`${Math.round(w.numbers.pull * 100) / 100} g`],
    })),
    row("🌡️ Its warmth", ({ w }) => ({
      tone: Math.abs(w.numbers.kelvin - 288) < 60 ? "have" : "open",
      line: [celsius(w.numbers.kelvin - 273.15)],
    })),
    row("🪨 Its ground", ({ w }) =>
      w.numbers.rock
        ? { tone: "have", line: ["Rock underfoot"] }
        : { tone: "shut", line: ["Rock under its ice"] },
    ),
    row("🧍 Its people", ({ g, w }) =>
      !g.life.people
        ? {
            tone: "shut",
            line: ["None: ", g.life.species.length ? "no people rose" : lifelessWhy(g)],
          }
        : w.numbers.medium === "water"
          ? { tone: "open", line: ["Live under water"] }
          : w.numbers.grips
            ? { tone: "have", line: ["Walk, and grip a haft"] }
            : { tone: "open", line: ["Walk, and cannot grip"] },
    ),
    row("✨ Its star's metals", ({ w }) => ({
      tone: w.numbers.metalShare >= 0.3 ? "have" : "shut",
      line: [`${Math.round(w.numbers.metalShare * 100)}% of the Sun's`],
    })),
  ];
}

/** Two worlds' columns: where they part, and why. */
function besideBlocks(
  here: ReturnType<typeof hereOf>,
  hereName: string,
  universe: string,
  other: Other | null,
  self: boolean,
  seedAsked: string | null,
): Block[] {
  const pick: Block = {
    type: "tool",
    tool: "can.pick",
    args: { universe, seed: self ? null : seedAsked },
  };
  if (self)
    return [
      pick,
      {
        type: "text",
        lines: [
          [`That is this world, ${hereName}. Nothing parts a world from itself: pick another.`],
        ],
      },
    ];
  if (!other)
    return [
      pick,
      {
        type: "text",
        lines: [
          [
            "Pick any world, or type any seed. Its column is read from what it is made of: nothing has to run.",
          ],
        ],
      },
    ];
  const names = [[`${hereName} `, "(here)"] as Line, [other.seed] as Line] as const,
    a = { g: here.g, w: here.w },
    b = { g: other.g, w: other.w },
    rows = here.read.map((f, i) => {
      const o = other.read[i]!,
        cells = [sideCell(f), sideCell(o)] as const,
        plain = (c: SideCell) =>
          JSON.stringify([c.tone, c.line.map((s) => (typeof s === "string" ? s : s.text))]);
      return { label: `${f.icon} ${f.name}`, parts: plain(cells[0]) !== plain(cells[1]), cells };
    }),
    part = rows.filter((r) => r.parts),
    same = rows.filter((r) => !r.parts),
    causeA = causesOf(a.w, here.open)[0],
    causeB = causesOf(b.w, other.open)[0],
    lead = (name: string, peopled: boolean, c: typeof causeA, why: string): Line =>
      !peopled
        ? [`${name} has no people: ${why}.`]
        : c
          ? [
              `${name}: ${low(c.words)} That shuts ${count(c.steps.length)} ${c.steps.length === 1 ? "step" : "steps"} of Earth's road.`,
            ]
          : [`${name}: nothing shuts any step of Earth's road.`];
  return [
    pick,
    {
      type: "text",
      title: "Why they part",
      lines: [
        lead(
          hereName,
          here.w.peopled,
          causeA,
          here.g.life.species.length ? "none rose" : lifelessWhy(here.g),
        ),
        lead(
          other.seed,
          other.w.peopled,
          causeB,
          other.g.life.species.length ? "none rose" : lifelessWhy(other.g),
        ),
      ],
    },
    { type: "sides", title: "What they are made of", names, rows: factRows(a, b) },
    {
      type: "sides",
      title: part.length ? "Where they part: the best each could ever do" : "Nowhere do they part",
      names,
      rows: part,
    },
    ...(same.length
      ? [
          {
            type: "text" as const,
            title: "Where they agree",
            lines: [[same.map((r) => r.label).join(", ")]],
          },
        ]
      : []),
    {
      type: "text",
      lines: [
        [
          `${other.seed} is read from what it is made of, as if its first people had just risen: what it has come to in any run is not told here.`,
        ],
      ],
    },
  ];
}

/** "What can be done here": `world:can`; beside another world, `can:<universe>|<seed>`. */
export function canPage(world: World, tab?: string, beside?: string): PageModel {
  const here = hereOf(world),
    { g, w, open, known, read, peopled } = here,
    universe = g.prior === EARTHLIKE.name ? "earth" : "alien",
    hereName = world.seed.text,
    [otherUniverse, seedWord] = (beside ?? "").split("|") as [string, string | undefined],
    seedAsked = seedWord === undefined ? null : decodeURIComponent(seedWord).trim(),
    self = seedAsked === hereName && otherUniverse === universe,
    other = seedAsked && !self ? otherWorld(otherUniverse, seedAsked) : null,
    nowKnown = [...known.values()].filter((k) => k.now).length,
    openCount = PRINCIPLES.filter((p) => open.has(p.id)).length,
    shutCount = PRINCIPLES.length - openCount,
    head: Block = {
      type: "text",
      lines: [
        [worldWords(g, w)],
        ...(!g.life.people
          ? [
              [
                `No people stand on it: ${g.life.species.length ? "life arose, and no people rose from it" : lifelessWhy(g)}. What its matter would allow them is under "Its matter".`,
              ] as Line,
            ]
          : !peopled.length
            ? [["No one is left on it."] as Line]
            : []),
      ],
    },
    odd: Block = { type: "list", title: "What's odd about it", items: oddItems(w, open) },
    main: Block[] = g.life.people
      ? read.filter((f) => f.main).map((f) => functionBlock(f, w, known))
      : [],
    rest: Block[] = g.life.people
      ? [
          ...read.filter((f) => !f.main).map((f) => functionBlock(f, w, known)),
          {
            type: "table",
            title: "Each step that lands have come to, the latest first",
            columns: ["Step", "Year", "First in"],
            rows: [...known]
              .filter(([id]) => id !== "cultivation" && id !== "metalworking")
              .sort((x, y) => y[1].year - x[1].year || (x[0] < y[0] ? -1 : 1))
              .slice(0, 12)
              .map(([id, k]): Row => ({
                ref: prinRef(id),
                cells: [
                  [link(stepName(id, w), prinRef(id))],
                  [count(k.year)],
                  [landLink(world, k.cell, true)],
                ],
              })),
          },
        ]
      : functionBlocks(world);
  return {
    ref: beside ? `can:${beside}` : "world:can",
    kind: "can",
    icon: "🪜",
    title: "What can be done here",
    subtitle: [link("What this world stands at", "world:means")],
    color: null,
    place: null,
    stats: [
      stat("Known now", count(nowKnown)),
      stat("Could come to", `${count(openCount)} of ${count(PRINCIPLES.length)}`),
      stat("Shut here", count(shutCount)),
      ...(g.life.people ? [knownStat(world)] : []),
    ],
    tabs: [
      { id: "here", name: "Here", blocks: [head, odd, ...main] },
      { id: "rest", name: g.life.people ? "The rest" : "Its matter", blocks: rest },
      {
        id: "beside",
        name: "Beside another",
        blocks: besideBlocks(here, hereName, universe, other, self, seedAsked),
      },
    ],
    tab: beside ? "beside" : (tab ?? "here"),
    followable: false,
    year: yearNow(world),
    every: 15000,
  };
}
