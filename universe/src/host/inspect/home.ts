// A home's own page, and a thing in it (Lives L6; Classic's address, its inspectable detail: whose it is, who lives there, what they pay
// and to whom, its size against the town's, how old it is, what it was before; and of each thing in it, what it is, what it is made of,
// from where and by whom as far as the world knows, what it is worth in the real market). Read off what is true, nothing kept; what
// history does not hold is said not to be known.
import type { World } from "../../kernel/index.ts";
import {
  COIN_A_UNIT,
  GOODS,
  G,
  HOLDS,
  HOME_LEVELS,
  HOME_LIFE,
  HOME_STOREYS,
  furnish,
  standingWords,
  usualPrice,
  type DwellingStuff,
  type DwellingThing,
} from "../../rules/index.ts";
import { LOT, lotStates, parseTownsfolkRef, type Block, type Item, type Line, type PageModel } from "../../bridge/index.ts";
import { marketsOf, populationContext } from "../../sim/index.ts";
import {
  clothMade,
  landCloth,
  landClay,
  landWood,
  makerOf,
  makerWords,
  makingTown,
  potMade,
  toolMade,
  type Made,
} from "../chain.ts";
import { townRoster } from "../roster.ts";
import { armsBlock } from "./arm.ts";
import { battleWords } from "../burials.ts";
import { count, item, link, many, sentence, stat, yearNow } from "./words.ts";
import { landLink, realmLink, townLink } from "./names.ts";
import { lotRef } from "./fabric.ts";
import {
  RING_HOME,
  dwellOf,
  dwellRef,
  dweltRef,
  homeFacts,
  homeLine,
  homeRead,
  homeTitle,
  rentOf,
  type HomeRead,
} from "../home.ts";

/** What a thing's stuff is said to be, as its land has it. */
function stuffWords(world: World, r: HomeRead, stuff: DwellingStuff): string {
  const cell = r.cell,
    real = populationContext(world).provinces.get(cell);
  switch (stuff) {
    case "wood":
      return real ? `${landWood(world, cell)} wood` : "their land's wood";
    case "cloth":
      return real ? landCloth(world, cell).name : "their land's cloth";
    case "clay":
      return real ? landClay(world, cell).ware : "fired earth";
    case "metal":
      return "metal";
    case "reed":
      return "grass and reed";
    case "hide":
      return "hide";
    case "stone":
      return "stone";
    case "earth":
      return "brick and fired earth";
    case "shell":
      return "shell";
    case "kelp":
      return "kelp cord";
    case "glass":
      return "glass";
    case "works":
      return "what the works make: metal, glass and wire";
    case "wax":
      return "wax";
    default:
      return "nothing made";
  }
}

/** The chain of a thing, where the world tells it (null: it does not). */
function madeOf(world: World, r: HomeRead, t: DwellingThing): { made: Made | null; lines: Line[] } {
  const cell = r.cell,
    real = populationContext(world).provinces.get(cell);
  if (!real) return { made: null, lines: [["Who made it is not known: its people's makers are not kept."]] };
  const key = `${r.plan.ref}:${r.n}:${t.n}`,
    now = yearNow(world),
    built = r.run ? (r.run[3] ?? now) : now,
    // (Made some time in the years the home has stood, as keyed: never before it.)
    year = Math.max(built, now - (Math.abs(hash(key)) % 25)),
    town = r.plan.ref;
  try {
    if (t.stuff === "clay") return { made: potMade(world, cell, key, year, false, town), lines: [] };
    if (t.stuff === "cloth") return { made: clothMade(world, cell, key, year, false, false, town), lines: [] };
    if (t.stuff === "metal") return { made: toolMade(world, cell, key, year, false, town), lines: [] };
  } catch {
    return { made: null, lines: [["Who made it is not known."]] };
  }
  if (t.stuff === "wood") {
    const maker = makerOf(world, cell, makingTown(world, cell), "joiner", key, year);
    return {
      made: null,
      lines: [
        [`Of ${landWood(world, cell)} from the woods of `, landLink(world, cell), "."],
        ["By ", ...makerWords(world, maker, "bench"), `, in year ${year}.`],
      ],
    };
  }
  if (t.stuff === "works")
    return { made: null, lines: [["Made at its land's works: who made it is not told."]] };
  return { made: null, lines: [["Made at home, of what lay to hand."]] };
}

const hash = (s: string): number => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
};

/** What a thing is worth at the market now, said; whether any is to be had. */
function worthLine(world: World, r: HomeRead, t: DwellingThing): Line {
  const m = marketsOf(world).get(r.cell),
    goods = Object.keys(t.cost) as (keyof typeof G)[];
  if (!goods.length) return ["Nothing at the market: made at home, or free for the taking."];
  if (!m) return ["Its worth is not known: no market of theirs is kept."];
  const short = goods.filter((g) => (m.stock[G[g]] ?? 0) <= 0).map((g) => GOODS[G[g]]!.name),
    usual = goods.reduce((sum, g) => sum + (t.cost[g] ?? 0) * usualPrice(G[g]) * COIN_A_UNIT, 0),
    against = t.coin > usual * 1.05 ? "dearer than usual" : t.coin < usual * 0.95 ? "cheaper than usual" : "about its usual";
  return [
    `${count(Math.max(1, Math.round(t.coin)))} coin at the market of `,
    landLink(world, r.cell),
    ` now, ${against}. A coin is a person's bread for a day.`,
    ...(short.length ? [` No ${short.join(" or ")} is to be had there now.`] : []),
  ];
}

/** Its size against the town's: its level's holding against every home that stands. */
function sizeLine(r: HomeRead): Line {
  const t = r.plan.town;
  if (!t) return ["A home of its village's ring: its measure against the rest is not kept."];
  const states = lotStates(t);
  let all = 0,
    smaller = 0,
    alike = 0;
  for (let p = 0; p < t.lots; p++) {
    if (states.what[p] !== LOT.home) continue;
    all++;
    if (states.level[p]! < r.level) smaller++;
    if (states.level[p]! === r.level) alike++;
  }
  if (all === 0) return ["No other home stands to set it against."];
  const name = HOME_LEVELS[r.level] ?? "home";
  if (alike === all)
    return [all === 1 ? "The only home standing of those drawn." : `Every one of the ${count(all)} homes drawn is a ${name}.`];
  return [
    `Larger than ${many(smaller, "home", "homes")} of the ${count(all)} drawn; `,
    alike === 1 ? `the only ${name}.` : `one of ${count(alike)} ${name}s.`,
  ];
}

/** How old it is, and what it was before, as its run keeps it. */
function ageLines(r: HomeRead, year: number): { age: Line; before: Line } {
  const run = r.run;
  if (!run) return { age: ["When it was raised is not known."], before: ["What stood here before is not known."] };
  const [kind, , , start] = run as [number, number, number, number],
    old = Math.max(0, year - start),
    name = HOME_LEVELS[r.level] ?? "home",
    life = HOME_LIFE[r.level] ?? 50;
  return {
    age: [
      old === 0 ? `Raised this year, year ${start}.` : `Raised in year ${start}: ${many(old, "year", "years")} old. `,
      old > 0 ? `A ${name} stands some ${life} years before it is rebuilt.` : "",
    ],
    before:
      kind === 1
        ? [`A lower home stood here; the record keeps no more of it.`]
        : ["Open ground, or a home long gone: the record does not say which."],
  };
}

const unknownPage = (ref: string, title: string, world: World): PageModel => ({
  ref,
  kind: "unknown",
  icon: "❔",
  title,
  subtitle: ["Nothing stands there that is known."],
  color: null,
  place: null,
  stats: [],
  tabs: [{ id: "overview", name: "Overview", blocks: [{ type: "text", lines: [["Nothing stands there that is known."]] }] }],
  followable: false,
  year: yearNow(world),
});

/** A home's own page. */
export function homePage(world: World, ref: string): PageModel {
  const at = dwellOf(ref),
    r = at ? homeRead(world, at.town, at.n) : null;
  if (!at || !r) return unknownPage(ref, "A home", world);
  const year = yearNow(world),
    f = homeFacts(world, r),
    d = furnish(f),
    floors = 1 + Math.max(0, ...d.rooms.map((x) => x.floor)),
    people = r.residents.map((i) => r.plan.people[i]!),
    name = HOME_LEVELS[r.level] ?? "home",
    storeys = HOME_STOREYS[r.level] ?? 1,
    { age, before } = ageLines(r, year),
    rent = r.state === "stands" && !r.plan.native ? rentOf(world, r.cell, r.level) : null,
    realm = (to: string) => realmLink(world, to),
    pays: Line = f.noHouses
      ? ["Nothing: its people do not count kin, and no family holds it."]
      : r.state !== "stands"
        ? ["No one pays: no one lives here."]
        : rent
          ? [rent.words, ...(rent.to ? [realm(rent.to)] : []), "."]
          : ["No rent is known: no law of land is kept here."],
    whose: Line = f.noHouses
      ? ["No family's: those of this people who sleep here sleep here."]
      : r.state !== "stands"
        ? ["No one's now."]
        : people.length
          ? people.length === 1
            ? [`Theirs who live here: `, link(people[0]!.name, people[0]!.ref), "."]
            : [`The family who live here.`]
          : ["Not known: none of those the town's roll names lives here."],
    rows = [
      stat("Stands", sentence(`a ${name}${storeys > 1 ? ` of ${many(storeys, "storey", "storeys")}` : ""}`)),
      stat("Whose", whose),
      stat("They pay", pays),
      stat("Size", sizeLine(r)),
      stat("Holds", many(HOLDS[r.level] ?? 5, "person", "people")),
      stat("Age", age),
      stat("Before", before),
      stat("Town", r.plan.native ? r.plan.name : [townLink(world, r.plan.ref)]),
    ];
  const blocks: Block[] = [
    { type: "tool", tool: "home.look", args: { town: r.plan.ref, n: r.n } },
    { type: "facts", rows },
    {
      type: "list",
      title: "Who lives here",
      items: people.length
        ? people.map((p) =>
            item(
              [
                link(p.name.replace(/ of .*$/, ""), p.ref),
                `, ${p.age}${p.child ? ", a child" : p.role ? `, ${p.role}` : ""}`,
              ],
              p.ref,
            ),
          )
        : [item([r.state === "stands" ? "No one the town's roll names." : "No one."])],
    },
  ];
  const things: Item[] = d.things.map((t) =>
    item([link(sentence(t.name), dweltRef(r.plan.ref, r.n, t.n))], dweltRef(r.plan.ref, r.n, t.n)),
  );
  // The same thing many times over is one line.
  const seen = new Set<string>(),
    list: Item[] = [];
  d.things.forEach((t, i) => {
    if (seen.has(t.way)) return;
    seen.add(t.way);
    const n = d.things.filter((x) => x.way === t.way).length;
    list.push(
      item(
        [link(sentence(t.name), dweltRef(r.plan.ref, r.n, t.n)), n > 1 ? `, ${n} of them` : ""],
        things[i]!.ref ?? null,
      ),
    );
  });
  blocks.push({ type: "list", title: "What it holds", items: list });
  if (r.state === "stands")
    blocks.push({
      type: "text",
      title: "What they have",
      lines: [
        [
          `${homeLine(r, d.rooms.length, floors, people.length)}. What it holds comes to ${count(Math.round(d.spent))} coin at the market now. They have had ${standingWords(f.coin)} to spend: their wages and their land's making, less their bread and rent.`,
        ],
      ],
    });
  blocks.push({
    type: "text",
    lines: [
      [
        "History keeps a town's lots and its roll of people, not their furniture. What stands in a home is read from what its people do, what its land and market hold, and what they could pay: the same home, the same things, each time.",
      ],
    ],
  });
  return {
    ref,
    kind: "lot",
    icon: r.state === "stands" ? "🏠" : "🏚️",
    title: homeTitle(r, f),
    subtitle: [
      `${sentence(homeLine(r, d.rooms.length, floors, people.length))}. `,
      ...(r.lot >= 0 && !r.plan.native ? [link("Its lot", lotRef(r.plan.ref, r.lot))] : []),
      ...(!r.plan.native && r.cell >= 0 ? [" in ", landLink(world, r.cell)] : []),
    ],
    color: null,
    place: { scale: "village", town: r.plan.ref },
    stats: [],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

/** The arm one of a home came home from war with: its block, or words where its side is not told. */
function armBlock(world: World, r: HomeRead): Block | null {
  const p = r.residents.map((i) => r.plan.people[i]!).find((x) => x.war);
  if (!p?.war) return null;
  const parsed = parseTownsfolkRef(p.ref);
  if (parsed) {
    const roster = townRoster(world, r.plan.ref as never),
      h = parsed.n === null ? roster.holder(parsed.line) : roster.holderOf(parsed.line, parsed.n),
      fate = h?.fates.find((x) => x.event === p.war!.event);
    if (fate) return armsBlock(world, fate.event, fate.side, p.ref);
  }
  return {
    type: "text",
    lines: [
      [
        `${p.name} came home with it from `,
        link(battleWords(world, r.cell), p.war.event),
        `, year ${p.war.year}. What it was made of is not kept for them.`,
      ],
    ],
  };
}

/** A thing in a home: what it is, what it is made of, from where and by whom, what it is worth. */
export function homeThingPage(world: World, ref: string): PageModel {
  const at = dwellOf(ref),
    r = at ? homeRead(world, at.town, at.n) : null;
  if (!at || !r || at.thing === null) return unknownPage(ref, "A thing in a home", world);
  const f = homeFacts(world, r),
    d = furnish(f),
    t = d.things[at.thing];
  if (!t) return unknownPage(ref, "A thing in a home", world);
  const { made, lines } = madeOf(world, r, t),
    rows = [
      stat("For", t.why),
      stat("Made of", made ? made.stuff : stuffWords(world, r, t.stuff)),
      ...(made ? [stat("How good", sentence(made.grade))] : []),
      ...(made?.maker ? [stat("By", makerWords(world, made.maker, "bench"))] : []),
      ...(made?.workshop.ref ? [stat("Where", [link(made.workshop.name, made.workshop.ref)])] : []),
      stat("Worth", worthLine(world, r, t)),
      stat("In", [link(homeTitle(r, f), dwellRef(r.plan.ref, r.n))]),
    ],
    blocks: Block[] = [{ type: "facts", rows }];
  if (t.shape === "arm") {
    const arm = armBlock(world, r);
    if (arm) blocks.push(arm);
  } else if (made)
    blocks.push({ type: "list", title: "From the ground to here", items: made.chain.map((l) => item(l)) });
  else if (lines.length) blocks.push({ type: "text", title: "Where it came from", lines });
  return {
    ref,
    kind: "lot",
    icon: "🪑",
    title: sentence(t.name),
    subtitle: ["In ", link(homeTitle(r, f), dwellRef(r.plan.ref, r.n))],
    color: null,
    place: { scale: "village", town: r.plan.ref },
    stats: [],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: yearNow(world),
  };
}

/** Whether a lot of a town holds a home to look into: a home standing, or what is left of one. */
export const homeNumber = (lot: number): number => lot;
export { RING_HOME };
