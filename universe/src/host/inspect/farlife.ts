// A far people's life on its page (round F; sim/space/farlife.ts): how many they are, how well fed, what each turns and from what,
// who reads, how well they hold together, what they know and what holds them from the next step, what they fear most and how
// much, what they can spare and how dear; their numbers through the years; and what was done to them. Pure reads: history's
// numbers where it holds them, else what is read of their world. Estimates, and the page says so.
import {
  FAR_LIFE,
  FAR_RUNGS,
  GATE_WORDS,
  STARS_RUNG,
  farDearness,
  farStrength,
  flowsAt,
  gateOf,
  type FarFacts,
  type FarState,
} from "../../rules/index.ts";
import {
  civilizationsEver,
  civilizationsMade,
  civilizationsNear,
  councilsOf,
  farNow,
  farReadAt,
  folkByRef,
  folksNear,
  lifeReadingOf,
  peopleWords,
  politiesOf,
  realmName,
  ringOf,
  type FarRow,
  type FarSample,
} from "../../sim/index.ts";
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Item, Row, Stat, Tab } from "../../bridge/index.ts";
import { claimOf, count, item, link, stat, yearNow } from "./words.ts";

type Rgb = readonly [number, number, number];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The steps of a far people's climb in words, as their pages say them. */
export const RUNG_WORDS: readonly string[] = [
  "camps",
  "villages",
  "towns",
  "cities",
  "their first machines",
  "the current, and signals across the dark",
  "orbit",
  "the stars",
];

/** A far people, a realm or a land, by name. */
export function farName(world: World, ref: string | null): string {
  if (!ref) return "no one";
  const c = civilizationsEver(world).find((x) => x.ref === ref);
  if (c) return `the ${peopleWords(world, c).name}`;
  const f = folkByRef(world, ref);
  if (f) return `the ${f.name}`;
  const realm = politiesOf(world).get(ref as never);
  return realm ? realmName(realm) : "a land of the home world";
}

/** How far along they are toward the next step, in words. */
function knowWords(s: FarState, facts: FarFacts): string {
  const r = Math.min(STARS_RUNG, Math.floor(s.know)),
    part = s.know - r;
  if (r >= STARS_RUNG)
    return `the stars, and ${pct(Math.min(1, part))} of the way to the drives that follow`;
  if (s.rung < r)
    return `${RUNG_WORDS[r]} in what they know, though they stand at ${RUNG_WORDS[s.rung]}`;
  const next = r + 1 > facts.ceiling ? null : RUNG_WORDS[r + 1];
  return next ? `${RUNG_WORDS[r]}, ${pct(part)} of the way to ${next}` : RUNG_WORDS[r]!;
}

/** What drives what they turn, by source, in words. */
function powerWords(s: FarState, f: FarFacts): string {
  const fl = flowsAt(f, s.rung, Math.max(1, s.people)),
    parts: string[] = [];
  if (f.sea) {
    if (fl.sea > 1)
      parts.push(
        `their vents and tides${f.bioCurrent ? " and the current of their own living things" : ""}`,
      );
  } else {
    if (f.fire)
      parts.push(
        s.rung >= 4 && f.fuelMJ > 0 && s.fuel > 0.02
          ? "fuel and their woods' heat"
          : "their woods' heat",
      );
    if (fl.river + fl.wind > 1) parts.push("their rivers and wind");
  }
  if (fl.hot > 1) parts.push(s.rung >= 6 ? "hot ground and sunlight" : "hot ground");
  if (fl.atom > 1) parts.push("the atom");
  if (f.sows && s.rung >= 1) parts.push("their beasts");
  return parts.length ? parts.join(", ") : "their own muscle alone";
}

/** Their numbers through the years: what is read of their world before history took them up, history's after. */
function samplesOf(world: World, ref: string, year: number, row: FarRow | null): FarSample[] {
  const r = lifeReadingOf(world, ref);
  if (r) farReadAt(r, Math.min(year, row ? row.since : year));
  const read = (r?.samples ?? []).filter((x) => x.year <= year && (!row || x.year < row.since)),
    held = row ? ringOf(row).filter((x) => x.year <= year) : [],
    all = [...read, ...held];
  // (At most some sixty points: the oldest thinned.)
  const step = Math.max(1, Math.ceil(all.length / 60));
  return all.filter((_, i) => i % step === 0 || i === all.length - 1);
}

function seriesOf(
  title: string,
  units: string,
  unit: "count" | "share" | "kw",
  points: { x: number; y: number }[],
  latest: string,
  note: string,
  color: Rgb | undefined,
): Block[] {
  if (points.length < 2) return [];
  return [
    {
      type: "series",
      title,
      units,
      unit,
      points,
      latest,
      note,
      ...(color ? { color } : {}),
    },
  ];
}

/** Things done to them, newest first. */
function toldItems(world: World, row: FarRow): Item[] {
  return [...row.told]
    .reverse()
    .map((t) =>
      t.event
        ? item([`Year ${t.year}: `, claimOf(world, t.event)], t.event)
        : item(
            `Year ${t.year}: ${t.what === "mended" ? "what held them together held again" : t.what}`,
          ),
    );
}

const yearWords = (y: number) => (Number.isFinite(y) ? `in year ${Math.round(y)}` : "never");

/** A far people's life: its numbers now, through the years, and what was done to it. */
export function farLifeBlocks(world: World, ref: string, color?: Rgb): Block[] {
  const year = yearNow(world),
    now = farNow(world, ref, year);
  if (!now) return [];
  const { state: s, facts: f, row } = now,
    held = !!row && year >= row.since,
    dear = farDearness(s),
    next = s.rung < STARS_RUNG ? gateOf(f, s.rung + 1, s) : "open",
    rows: Stat[] = [
      stat(
        "How many, all told",
        s.fell !== null ? "None: they are gone" : `Some ${count(s.people)}`,
      ),
      stat(
        "Fed",
        s.fed >= 1 ? "Fed, with some to spare" : `On ${pct(s.fed)} of what they eat: hungry`,
      ),
      stat(
        "What each turns",
        `${count(s.wph)} W a head, ${count(s.made)} of it not their own muscle: from ${powerWords(s, f)}`,
      ),
      stat("Who reads", pct(s.letters)),
      stat(
        "How well they hold together",
        `${pct(s.cohesion)}${s.broken ? ": broken, in strife, their works idle and their learning stopped" : ""}`,
        { why: row?.broke ?? null },
      ),
      stat("What they know", cap(knowWords(s, f))),
      ...(next !== "open" && s.fell === null
        ? [stat("What holds them", cap(GATE_WORDS[next]))]
        : []),
      ...(s.rung >= 1
        ? [
            stat(
              "Their ground",
              s.worn < 0.05 ? "As it first was" : `${pct(s.worn)} worn by their fields`,
            ),
          ]
        : []),
      ...(f.fuelMJ > 0 && s.top >= 4 ? [stat("Their fuel", `${pct(s.fuel)} of it left`)] : []),
      ...(s.warmed >= 0.1
        ? [stat("Their air", `${s.warmed.toFixed(1)} °C warmer for what they burned`)]
        : []),
      ...(s.war >= 0.02 ? [stat("War's weariness", pct(s.war))] : []),
      ...(s.sick >= 0.02 ? [stat("What sickness has lately taken", pct(s.sick))] : []),
      ...(row?.fearOf || s.fear >= 0.02
        ? [
            stat(
              "What they fear most",
              row?.fearOf
                ? [link(cap(farName(world, row.fearOf)), row.fearOf), `, ${pct(s.fear)}`]
                : `${pct(s.fear)}`,
            ),
          ]
        : []),
      ...(s.rung >= 5
        ? [stat("Strength among the stars", `${farStrength(s).toFixed(1)} of 5`)]
        : []),
      // (A followed people's years are its own numbers': once a clock, its drawn pace times the home world's.)
      ...((civ, made) =>
        civ && made
          ? [
              stat(
                "Their years",
                `By their own numbers: their signals ${yearWords(civ.electronics)}, orbit ${yearWords(civ.orbit)}, the stars ${yearWords(civ.stars)}${civ.fell != null ? `; they fell in year ${civ.fell} before they came further` : ""}. The clock of before had them ${yearWords(made.electronics)}, ${yearWords(made.orbit)} and ${yearWords(made.stars)}.`,
              ),
            ]
          : [])(
        civilizationsNear(world).find((c) => c.ref === ref),
        civilizationsMade(world).find((c) => c.ref === ref),
      ),
      // (A concord of worlds they sit in: sim/diplomacy/councils.ts.)
      ...((c) =>
        c
          ? [
              stat(
                "Sits in",
                `${cap(c.name)}, with ${c.members.length - 1} other${c.members.length === 2 ? "" : "s"}, since year ${c.founded}`,
                { why: c.event },
              ),
            ]
          : [])(councilsOf(world)?.councilOf(ref as Ref) ?? null),
      ...(s.rung >= 4
        ? [
            stat(
              "What they make, to others",
              `${dear.dear.toFixed(1)} times the floor of its usual worth; ${pct(dear.spare)} of a hold's worth to spare`,
            ),
          ]
        : []),
    ],
    samples = samplesOf(world, ref, year, row),
    blocks: Block[] = [
      {
        type: "text",
        lines: [
          [
            held
              ? `History has held their numbers since year ${row!.since}${row!.followed ? ", when their signals first left their world" : ", when the first landing came down on them"}: each decade they step on by the same rules as the home world's, in coarse form. Before that, what is read of their world.`
              : "Their numbers, read off their world by the same rules as the home world's, in coarse form: how many its ground feeds, what they turn, who reads, what they know.",
            " These figures are estimates.",
          ],
        ],
      },
      { type: "facts", title: "Their life", rows },
      ...seriesOf(
        "How many",
        "people",
        "count",
        samples.map((x) => ({ x: x.year, y: x.people })),
        count(s.people),
        "All of them on their world, as many as its ground feeds at what they know.",
        color,
      ),
      ...seriesOf(
        "What each turns, beyond their muscle",
        "W a head",
        "kw",
        samples.map((x) => ({ x: x.year, y: x.made })),
        `${count(s.made)} W a head`,
        "Their beasts, woods, fuel, rivers, wind, hot ground and the atom; for a people of the sea its vents, tides and living current.",
        color,
      ),
      ...seriesOf(
        "How well they hold together",
        "of 1",
        "share",
        samples.map((x) => ({ x: x.year, y: x.cohesion })),
        pct(s.cohesion),
        `Below ${pct(FAR_LIFE.breaks)} they break into strife; above ${pct(FAR_LIFE.mends)} they mend.`,
        color,
      ),
      ...seriesOf(
        "Who reads",
        "of them",
        "share",
        samples.map((x) => ({ x: x.year, y: x.letters })),
        pct(s.letters),
        "A script with their towns, a school with their cities.",
        color,
      ),
      ...(samples.some((x) => x.fear > 0)
        ? seriesOf(
            "Their greatest fear",
            "of 1",
            "share",
            samples.map((x) => ({ x: x.year, y: x.fear })),
            pct(s.fear),
            "How much they fear the people they fear most: how much stronger × how well seen × how exposed × what they would lose.",
            color,
          )
        : []),
      ...(row?.told.length
        ? [{ type: "list" as const, title: "What was done to them", items: toldItems(world, row) }]
        : []),
    ];
  return blocks;
}

/** A far people's Life tab. */
export function farLifeTab(world: World, ref: string, color?: Rgb): Tab | null {
  const blocks = farLifeBlocks(world, ref, color);
  return blocks.length ? { id: "life", name: "Life", blocks } : null;
}

/** Every people about the stars, how each fares by its own numbers (the peoples' page, and the galaxy's). */
export function peoplesFareBlocks(world: World): Block[] {
  const year = yearNow(world),
    civs = civilizationsNear(world),
    seen = new Set<string>(),
    rows: Row[] = [],
    bars: { label: string; ref: string; value: number }[] = [];
  const add = (ref: string, name: string) => {
    if (seen.has(ref)) return;
    seen.add(ref);
    const now = farNow(world, ref, year);
    if (!now) return;
    const s = now.state;
    rows.push({
      ref,
      cells: [
        [link(cap(name), ref)],
        [s.fell !== null ? "gone" : RUNG_WORDS[s.rung]!],
        [s.fell !== null ? "0" : count(s.people)],
        [count(s.made)],
        [`${pct(s.cohesion)}${s.broken ? ", broken" : ""}`],
        [
          now.row?.fearOf
            ? `${pct(s.fear)}: ${farName(world, now.row.fearOf)}`
            : s.fear > 0.02
              ? pct(s.fear)
              : "—",
        ],
      ],
      keys: [name, s.rung, s.people, s.made, s.cohesion, s.fear],
    });
    if (s.rung >= 5) bars.push({ label: cap(name), ref, value: farStrength(s) });
  };
  for (const c of civs) add(c.ref, `the ${peopleWords(world, c).name}`);
  for (const f of folksNear(world)) add(f.ref, `the ${f.name}`);
  if (!rows.length) return [];
  return [
    {
      type: "table",
      title: "How they fare, by their own numbers",
      columns: ["People", "Now", "How many", "W a head", "Holding together", "Fears most"],
      rows,
      fit: true,
      few: 20,
    },
    ...(bars.length
      ? [
          {
            type: "bars" as const,
            title: "Strength among the stars (of 5)",
            bars: bars
              .sort((a, b) => b.value - a.value)
              .map((b) => ({
                label: [link(b.label, b.ref)],
                ref: b.ref,
                value: Math.round(b.value * 10) / 10,
              })),
            unit: "count" as const,
            wrap: true,
          },
        ]
      : []),
    {
      type: "text",
      lines: [
        [
          "Each people's numbers step on a decade at a time by the home world's own rules in coarse form: its ground, its children, what it turns, who reads, what it knows, how it holds together. These figures are estimates.",
        ],
      ],
    },
  ];
}

/**
 * The peoples about a realm's worlds among the stars (a star nation's page): each followed people within its settlers' reach of any
 * of them, how far it has come, how strong it is, and whether it fears this realm most and how much (round F).
 */
export function neighbourBlocks(
  world: World,
  realm: string,
  stars: readonly string[],
  point: (star: string) => { x: number; y: number; z: number },
): Block[] {
  const year = yearNow(world),
    rows: Row[] = [];
  for (const c of civilizationsNear(world)) {
    const at = point(c.star);
    let near = Infinity;
    for (const st of stars) {
      const p = point(st),
        d = Math.sqrt((p.x - at.x) ** 2 + (p.y - at.y) ** 2 + (p.z - at.z) ** 2);
      if (d < near) near = d;
    }
    if (near > 30) continue;
    const now = farNow(world, c.ref, year);
    if (!now) continue;
    const s = now.state,
      fears = now.row?.fearOf === realm;
    rows.push({
      ref: c.ref,
      cells: [
        [link(cap(`the ${peopleWords(world, c).name}`), c.ref)],
        [RUNG_WORDS[s.rung]!],
        [s.rung >= 5 ? farStrength(s).toFixed(1) : "—"],
        [`${near.toFixed(0)} ly`],
        [
          fears
            ? `most of all, ${pct(s.fear)}`
            : now.row?.fearOf
              ? `less than ${farName(world, now.row.fearOf)}`
              : "no",
        ],
      ],
      keys: [c.ref, s.rung, farStrength(s), near, fears ? s.fear : -1],
    });
  }
  return rows.length
    ? [
        {
          type: "table",
          title: "The peoples about its worlds",
          columns: ["People", "Now", "Strength (of 5)", "Nearest", "Fears it"],
          rows,
          fit: true,
        },
        {
          type: "text",
          lines: [
            [
              "Each by its own numbers: how strong it is among the stars is what all of it turns, as far as it holds together; how much it fears another, how much stronger that one is, how well seen, how near, and what it has to lose. Estimates.",
            ],
          ],
        },
      ]
    : [];
}
