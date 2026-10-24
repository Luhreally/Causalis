// A town's fabric looked at (Phase 25 M151, asked for 2026-10-24: "i cant see the cities form and
// evolve and get that type of detail i got from the og causalisis"): a lot of a town and what
// stands on it — its home's level and design, when it was raised, rebuilt higher, let fall or
// burnt, or cleared for a building — and its block; one of its other buildings — what it is for,
// when begun and done, the learning it waited on, what it took the place of, when it fell; its
// walls — when raised, round how much of the town, whether it has grown over them since; and, on
// the town's own page, all of them together. Pure reads of the fabric as it stands.
import { isRef, type Ref, type World } from "../../kernel/index.ts";
import {
  CIVIC_FOR,
  CIVIC_ICON,
  HOLDS,
  HOME_LEVELS,
  HOME_LIFE,
  HOME_STOREYS,
  civic,
  type CivicKind,
} from "../../rules/index.ts";
import {
  TOWN_EVENTS,
  causeOf,
  designsOf,
  homesOf,
  housingOf,
  populationContext,
  townsOf,
  type Civic,
  type Fabric,
} from "../../sim/index.ts";
import {
  BLOCK_LOTS,
  blocksHeld,
  lotStates,
  townLots,
  wallRing,
  type Block,
  type Item,
  type Line,
  type PageModel,
  type Stat,
  type Tab,
} from "../../bridge/index.ts";
import { townPlan } from "../town.ts";
import { townSite } from "../village.ts";
import { count, eventsAbout, item, link, many, sentence, stat, yearNow } from "./words.ts";
import { landLink, townLink } from "./names.ts";

/** What a run of lots says happened to them (the fabric's CHANGE): built, raised, fell, razed, cleared. */
const BUILT = 0,
  RAISED = 1,
  FELL = 2,
  RAZED = 3,
  CLEARED = 4;

/** A building's name without its article: "a hall of law" → "hall of law". */
function bare(kind: CivicKind): string {
  return civic(kind).name.replace(/^(a|an) /, "");
}

/** A town's ref and the numbers after it, from a page name about one of its parts ("lot:town:0:7:120"). */
export function townPartOf(ref: string): { town: Ref; rest: number[] } | null {
  const parts = ref.slice(ref.indexOf(":") + 1).split(":"),
    town = parts.slice(0, 3).join(":"),
    rest = parts.slice(3).map(Number);
  return isRef(town) && rest.every((n) => Number.isInteger(n) && n >= 0) ? { town, rest } : null;
}

/** The page of a lot of a town. */
export function lotRef(town: string, lot: number): string {
  return `lot:${town}:${lot}`;
}
/** The page of one of a town's buildings (by its first lot and the year it was begun). */
export function buildingRef(town: string, c: { at: number; start: number }): string {
  return `bldg:${town}:${c.at}:${c.start}`;
}
/** The page of a town's walls. */
export function wallsRef(town: string): string {
  return `walls:${town}`;
}

/** The years a change took, said: "year 212", "years 212–215". */
function years(start: number, end: number): string {
  return end > start ? `years ${start}–${end}` : `year ${start}`;
}

/** The design its land housed itself in from a year, as a link (or plain words). */
function designLink(world: World, cell: number, since: number): Line {
  if (since < 0) return ["the land's own way of building"];
  const land = populationContext(world).provinces.get(cell),
    d = land
      ? designsOf(world)
          .list()
          .find((x) => x.kind === "house" && x.owner === land.ref && x.since === since)
      : undefined;
  return [link(`the design of year ${since}`, d?.ref ?? null)];
}

/** Whether a town's walls still stand, or it has grown over a third of their line and pulled them down. */
function wallsStanding(world: World, town: Ref, f: Fabric): boolean {
  const site = townSite(world, town),
    plan = site ? townPlan(world, town, site.axis, f.next, site.water) : null;
  if (!plan) return !!f.walls;
  const lots = townLots(plan.family, plan.seed, plan.axis, plan.lots, plan.water),
    ring = wallRing(plan, lots, blocksHeld(plan, lotStates(plan)));
  return !!ring && ring.lengths.length > 0;
}

/** The events naming a town in the given years (what burnt, shook or sacked it). */
function townEventsIn(world: World, town: string, from: number, to: number): Item[] {
  return eventsAbout(world, [town], 200).filter(
    (e) => e.year !== undefined && e.year >= from && e.year <= to,
  );
}

/** A page that knows nothing of what was asked (the town gone, the lot never laid). */
function gone(world: World, ref: string, title: string, town: string | null): PageModel {
  return {
    ref,
    kind: "unknown",
    icon: "❔",
    title,
    subtitle: town ? ["Of ", townLink(world, town)] : ["Of a town now gone"],
    color: null,
    place: null,
    stats: [],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [{ type: "text", lines: [["Nothing stands there that is known."]] }],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** A lot of a town: what stands on it and what happened to it, its block. */
export function lotPage(world: World, ref: string): PageModel {
  const at = townPartOf(ref),
    f = at ? townsOf(world).get(at.town) : undefined,
    s = at ? populationContext(world).settlements.get(at.town) : undefined,
    p = at?.rest[0] ?? -1;
  if (!at || !f || !s || p < 0) return gone(world, ref, "A lot", at?.town ?? null);
  const year = yearNow(world),
    run = f.changes.find((c) => c[1] <= p && p < c[2]),
    standing = f.civics.find((c) => c.fell === null && c.at <= p && p < c.at + c.lots),
    fallen = f.civics.find((c) => c.fell !== null && c.at <= p && p < c.at + c.lots),
    block = Math.floor(p / BLOCK_LOTS),
    stats: Stat[] = [],
    lines: Line[] = [];
  let title = `A lot of ${s.name}`,
    icon = "🟫";
  if (standing) {
    title = `Part of the ${bare(standing.kind)} of ${s.name}`;
    icon = CIVIC_ICON[standing.kind];
    stats.push(
      stat("Stands", [link(sentence(civic(standing.kind).name), buildingRef(s.ref, standing))]),
    );
    lines.push([
      "Its lot is one of the ",
      many(standing.lots, "lot", "lots"),
      ` of the town's ${bare(standing.kind)}, ${CIVIC_FOR[standing.kind]}.`,
    ]);
  } else if (run && (run[0] === BUILT || run[0] === RAISED)) {
    const level = run[5],
      name = HOME_LEVELS[level] ?? "home";
    title = `A ${name} of ${s.name}`;
    icon = level >= 3 ? "🏢" : "🏠";
    stats.push(
      stat("Stands", sentence(`a ${name}`)),
      stat("Holds", many(HOLDS[level] ?? 5, "person", "people")),
      stat(run[0] === RAISED ? "Rebuilt higher" : "Raised", years(run[3], run[4])),
    );
    lines.push(
      [
        `A ${name} of ${many(HOME_STOREYS[level] ?? 1, "storey", "storeys")}, `,
        run[0] === RAISED
          ? `rebuilt higher in ${years(run[3], run[4])} where a lower home stood, `
          : `raised in ${years(run[3], run[4])}, `,
        "in ",
        ...designLink(world, s.cell, run[6]),
        ".",
      ],
      [
        `A home of its kind stands some ${HOME_LIFE[level] ?? 50} years before it is worn and rebuilt in its place, in its land's way of building of the day.`,
      ],
    );
    if (run[2] - run[1] > 1)
      lines.push([
        `One of a row of ${many(run[2] - run[1], "lot", "lots")} built alike, lot by lot.`,
      ]);
  } else if (run && (run[0] === FELL || run[0] === RAZED)) {
    const burnt = run[0] === RAZED;
    title = `A ruin of ${s.name}`;
    icon = burnt ? "🔥" : "🏚️";
    stats.push(
      stat("Stands", burnt ? "black stubs" : "an empty ruin"),
      stat(burnt ? "Burnt" : "Fell", years(run[3], run[4])),
    );
    lines.push([
      burnt
        ? `Its home was burnt, shaken down or sacked in ${years(run[3], run[4])}; its stubs stand black, sinking year by year.`
        : `Its home was let fall in ${years(run[3], run[4])}, its people gone: it stands empty and roofless, crumbling year by year.`,
    ]);
    const why = townEventsIn(world, s.ref, run[3], run[4] + 1);
    if (why.length) lines.push(["What befell the town then:"], ...why.map((e) => e.line));
  } else if (run && run[0] === CLEARED) {
    const cleared = f.civics.find((c) => c.at <= p && p < c.at + c.lots && c.start >= run[3]);
    title = `A lot of ${s.name}, cleared`;
    stats.push(stat("Cleared", `year ${run[3]}`));
    lines.push([
      `Its home was pulled down in year ${run[3]}`,
      ...(cleared
        ? [" to make room for the town's ", link(bare(cleared.kind), buildingRef(s.ref, cleared))]
        : []),
      ".",
    ]);
  } else if (fallen) {
    title = `The ruin of the ${bare(fallen.kind)} of ${s.name}`;
    icon = "🏚️";
    stats.push(
      stat("Stands", [link(`the ruin of its ${bare(fallen.kind)}`, buildingRef(s.ref, fallen))]),
    );
    lines.push([
      `Part of the ruin of the town's ${bare(fallen.kind)}, fallen in year ${fallen.fell}.`,
    ]);
  } else {
    title = `Open ground in ${s.name}`;
    lines.push([
      p < f.next
        ? "Open ground: built on once, and open again."
        : "Open ground the town has not yet come to.",
    ]);
  }
  // Its block: the eight lots about it, back to back on two streets.
  const homes: number[] = HOME_LEVELS.map(() => 0);
  let others = 0;
  for (let q = block * BLOCK_LOTS; q < (block + 1) * BLOCK_LOTS; q++) {
    const r = f.changes.find((c) => c[1] <= q && q < c[2]),
      c = f.civics.find((x) => x.fell === null && x.at <= q && q < x.at + x.lots);
    if (c) others++;
    else if (r && (r[0] === BUILT || r[0] === RAISED)) homes[r[5]]!++;
  }
  const said = homes.flatMap((n, level) =>
    n ? [many(n, HOME_LEVELS[level]!, `${HOME_LEVELS[level]!}s`)] : [],
  );
  if (others) said.push(many(others, "lot of a building", "lots of a building"));
  const blocks: Block[] = [
    {
      type: "facts",
      rows: [
        ...stats,
        stat("Town", [townLink(world, s.ref)]),
        stat("Land", [landLink(world, s.cell)]),
      ],
    },
    { type: "text", lines },
    {
      type: "text",
      title: "Its block",
      lines: [
        [
          `Lot ${count(p + 1)} of the town's plan, in its block ${count(block + 1)}: `,
          said.length ? said.join(", ") : "open ground",
          ".",
        ],
      ],
    },
  ];
  return {
    ref,
    kind: "lot",
    icon,
    title,
    subtitle: ["In ", townLink(world, s.ref)],
    color: null,
    place: { scale: "village", town: s.ref },
    stats,
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

/** The building of a town begun on a lot in a year. */
function civicOf(f: Fabric, at: number, start: number): Civic | undefined {
  return f.civics.find((c) => c.at === at && c.start === start);
}

/** One of a town's other buildings: what it is for, when begun, done and fallen, what it waited on. */
export function buildingPage(world: World, ref: string): PageModel {
  const at = townPartOf(ref),
    f = at ? townsOf(world).get(at.town) : undefined,
    s = at ? populationContext(world).settlements.get(at.town) : undefined,
    c = f && at ? civicOf(f, at.rest[0] ?? -1, at.rest[1] ?? -1) : undefined;
  if (!at || !f || !s || !c) return gone(world, ref, "A building", at?.town ?? null);
  const year = yearNow(world),
    def = civic(c.kind),
    waited = causeOf(populationContext(world), s.cell, c.kind),
    rising = c.fell === null && c.end > year,
    stats: Stat[] = [
      stat("Begun", `year ${c.start}`),
      c.fell !== null
        ? stat("Fell", `year ${c.fell}`)
        : rising
          ? stat("Rising", `to be done in year ${c.end}`)
          : stat("Done", `year ${c.end}`),
      stat("Lots", many(c.lots, "lot", "lots")),
    ];
  const lines: Line[] = [
    [`${sentence(def.name)}: ${CIVIC_FOR[c.kind]}.`],
    [
      def.place === "core"
        ? "It stands at the heart of the town, about its square."
        : "It was raised at the edge of the town as it stood then.",
    ],
  ];
  if (waited)
    lines.push(["It waited on its land's learning: ", link("what it was built for", waited), "."]);
  if (def.replaces) {
    const old = f.civics.find((x) => x.kind === def.replaces && x !== c);
    lines.push([
      `It took the place of the town's ${bare(def.replaces)}`,
      ...(old ? [" (", link(`begun in year ${old.start}`, buildingRef(s.ref, old)), ")"] : []),
      ".",
    ]);
  }
  if (c.fell !== null)
    lines.push([
      `It fell in year ${c.fell}; its ruin stands till homes are raised on its lots, or the years wear it away.`,
    ]);
  const why = c.fell !== null ? townEventsIn(world, s.ref, c.fell - 1, c.fell + 1) : [];
  const blocks: Block[] = [
    { type: "facts", rows: [...stats, stat("Town", [townLink(world, s.ref)])] },
    { type: "text", lines },
  ];
  if (why.length) blocks.push({ type: "list", title: "What befell the town then", items: why });
  return {
    ref,
    kind: "building",
    icon: CIVIC_ICON[c.kind],
    title: `The ${bare(c.kind)} of ${s.name}`,
    subtitle: [
      c.fell !== null ? "The ruin of a building of " : "A building of ",
      townLink(world, s.ref),
    ],
    color: null,
    place: { scale: "village", town: s.ref },
    stats,
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

/** A town's walls: when raised, round how much of it, whether it has grown over them since. */
export function wallsPage(world: World, ref: string): PageModel {
  const at = townPartOf(ref),
    f = at ? townsOf(world).get(at.town) : undefined,
    s = at ? populationContext(world).settlements.get(at.town) : undefined;
  if (!at || !f || !s || !f.walls) return gone(world, ref, "Walls", at?.town ?? null);
  const year = yearNow(world),
    w = f.walls,
    standing = wallsStanding(world, at.town, f),
    // (The tidings of their raising, while history keeps them: they are not held on to.)
    raised = world.events
      .all()
      .find((e) => e.type === TOWN_EVENTS.walled.type && e.subjects.includes(at.town)),
    walled = raised
      ? eventsAbout(world, [s.ref], 400).find((e) =>
          e.line.some((x) => typeof x !== "string" && x.ref === raised.id),
        )
      : undefined,
    stats: Stat[] = [
      stat("Begun", `year ${w.start}`, { why: raised?.id ?? null }),
      w.end > year ? stat("Rising", `to be done in year ${w.end}`) : stat("Done", `year ${w.end}`),
      stat("Ringing", many(w.reach, "lot", "lots")),
      stat("Now", standing ? "standing" : "pulled down"),
    ];
  const lines: Line[] = [
    [
      `Raised in ${years(w.start, w.end)} about the town as it stood then — ${many(w.reach, "lot", "lots")} of it — a tower at every few lengths, a gate where its road runs out.`,
    ],
    [
      standing
        ? "They stand: the town has not yet grown far over their line."
        : "The town has grown over their line, and they have been pulled down: a ring road runs where they stood.",
    ],
  ];
  return {
    ref,
    kind: "walls",
    icon: "🧱",
    title: `The walls of ${s.name}`,
    subtitle: ["About ", townLink(world, s.ref)],
    color: null,
    place: { scale: "village", town: s.ref },
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "facts", rows: [...stats, stat("Town", [townLink(world, s.ref)])] },
          { type: "text", lines },
          ...(walled ? [{ type: "list" as const, title: "Why", items: [walled] }] : []),
        ],
      },
    ],
    followable: false,
    year,
  };
}

/** A town's buildings, for its page: its homes by level, its other buildings, its walls (null: no fabric yet). */
export function buildingsTab(world: World, town: Ref): Tab | null {
  const f = townsOf(world).get(town);
  if (!f) return null;
  const year = yearNow(world),
    levels = HOME_LEVELS.map((name, level) => ({ name, n: f.homes[level] ?? 0 })).filter(
      (l) => l.n,
    ),
    ruins = f.changes
      .filter((c) => c[0] === FELL || c[0] === RAZED)
      .reduce((n, c) => n + (c[2] - c[1]), 0),
    rows: Stat[] = [
      stat("Homes", count(homesOf(f)), {
        parts: levels.map((l) => ({ label: [sentence(`${l.name}s`)], value: count(l.n) })),
      }),
      stat("Room for", many(housingOf(f), "person", "people")),
      stat("Lots built on", count(f.next)),
      ...(ruins ? [stat("Ruins", many(ruins, "lot", "lots"))] : []),
    ];
  const items: Item[] = [...f.civics]
    .sort((a, b) => b.start - a.start || a.at - b.at)
    .map((c) =>
      item(
        [
          `${CIVIC_ICON[c.kind]} `,
          link(sentence(bare(c.kind)), buildingRef(town, c)),
          c.fell !== null
            ? ` — fell in year ${c.fell}`
            : c.end > year
              ? ` — rising, begun in year ${c.start}`
              : ` — since year ${c.end}`,
        ],
        buildingRef(town, c),
        c.start,
      ),
    );
  if (f.walls)
    items.unshift(
      item(
        [
          "🧱 ",
          link("Its walls", wallsRef(town)),
          ` — raised in ${years(f.walls.start, f.walls.end)}`,
        ],
        wallsRef(town),
        f.walls.start,
      ),
    );
  const blocks: Block[] = [{ type: "facts", title: "Its fabric", rows }];
  blocks.push(
    items.length
      ? { type: "list", title: "Its buildings", items }
      : { type: "text", lines: [["It has raised no buildings but its homes."]] },
  );
  return { id: "buildings", name: "Buildings", blocks };
}
