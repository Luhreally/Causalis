// Knowledge that can be lost (K1), as a person reads it: a craft lost and who was last to know it, why, and who has it now;
// a land's losses and what it still keeps; a ruin's archive, whose it was and who has come to it since; what's shut in a
// town for want of a craft. All read from what the world keeps.
import type { World } from "../../kernel/index.ts";
import {
  OCC,
  PRINCIPLES,
  PRINCIPLE_INDEX,
  RESTS_ON,
  civic,
  type CivicKind,
} from "../../rules/index.ts";
import {
  KEEP_YEARS,
  handsHolding,
  isHive,
  loreOf,
  lostOf,
  needOfHands,
  populationContext,
  type Archive,
  type KeepForm,
  type LostCraft,
} from "../../sim/index.ts";
import { FELL_WORDS, keptWords, principleName } from "../../causal/index.ts";
import type {
  Block,
  Item,
  Line,
  Memorial,
  MemorialForm,
  PageModel,
  Span,
} from "../../bridge/index.ts";
import { folkOf } from "./justice.ts";
import { landLink, townLink } from "./names.ts";
import { count, item, link, stat, yearNow } from "./words.ts";

export const lostRef = (id: string): string => `lost:${id}`;
export const archiveRef = (a: { readonly n: number }): string => `archive:${a.n}`;
const prinRef = (id: string) => `prin:${id}`;
const cap = (s: string): string => `${s[0]!.toUpperCase()}${s.slice(1)}`;

/** A number as words a person reads aloud: about how many. */
function about(n: number): string {
  if (n < 1000) return count(n);
  const k = n >= 100_000 ? Math.round(n / 10_000) * 10_000 : Math.round(n / 100) * 100;
  return count(k);
}

/** What a people's keeping does, in one sentence: read off what they are. */
export function keepingWords(form: KeepForm): string {
  switch (form) {
    case "brood":
      return "A hive doesn't write and doesn't forget as others do: what one of them knew, all did, and the brood is reared into it. What is laid down in the comb stays in the comb, and any brood reared there comes up knowing it.";
    case "reef":
      return "A people of the water grow what they know into the reef, year on year, and whoever can read a reef's growth can read it long after the last of them.";
    case "reciters":
      return "Those who choose their own hold what matters by heart. It lasts as long as someone is left to say it.";
    case "songs":
      return "They have no letters. What they know goes into songs, which drift, and stop with the last who sang them.";
    default:
      return "It was written down, and what is written stays when the writers go, for anyone who comes and can read it.";
  }
}

/** A town's name for an archive, its first word big. */
export function archiveName(world: World, a: Archive): string {
  return keptWords(world, a.form, a.civic, a.name);
}

/** The person who was last, in a town of the land, if a town holds anyone to name. */
function lastOf(world: World, l: LostCraft): Span[] {
  const ctx = populationContext(world),
    towns = ctx.settlements
      .inProvince(l.cell)
      .filter((s) => s.population > 0)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1));
  const s = towns[0];
  if (!s) return [];
  const folk = folkOf(world, s, l.year),
    who = folk.pick(`lost ${l.cell} ${l.id}`.length * 31 + l.year, l.id.length, new Set());
  if (!who) return [];
  return [
    "The last of them there we can name: ",
    link(who.name, who.ref),
    `, ${who.work}, of `,
    townLink(world, s.ref),
    ".",
  ];
}

/** What came of a land's loss, in a line. */
function lossLine(world: World, l: LostCraft): Line {
  const why = FELL_WORDS[l.why],
    line: Span[] = [
      landLink(world, l.cell, true),
      `, year ${l.year}: `,
      ...(l.cause ? [link(why, l.cause)] : [why]),
      ". ",
    ];
  if (l.left > 0)
    line.push(
      `It had ${about(l.then)} people and ${about(l.left)} were left, and it wanted about ${about(l.need)} hands where it had ${about(l.hands)}. `,
    );
  else if (l.then > 0) line.push(`It had ${about(l.then)} people, and then no one. `);
  if (l.back) {
    const y = l.back.year - l.year;
    line.push(
      l.back.how === "kept"
        ? `They found it again ${y} years on, in what was kept.`
        : l.back.how === "brought"
          ? `Those who came brought it back ${y} years on.`
          : l.back.how === "found"
            ? `They came upon it again ${y} years on, from nothing.`
            : `They were taught it again ${y} years on.`,
    );
  } else line.push("They have not had it since.");
  return line;
}

/** A craft lost: who knew it, who was last, when, why, who has it now (`lost:<id>`). */
export function lostPage(world: World, ref: string): PageModel {
  const id = ref.slice(ref.indexOf(":") + 1),
    p = PRINCIPLES.find((x) => x.id === id);
  if (!p) throw new Error(`no craft ${ref}`);
  const store = lostOf(world),
    lore = loreOf(world),
    name = principleName(id, world),
    gone = store.worldLoss(id),
    again = store.foundAgain.filter((w) => w.id === id).at(-1),
    list = store.losses(id),
    last = gone ? (list.find((l) => l.cell === gone.last) ?? list[0]) : list[0],
    knowers = lore.knowers(id).sort((a, b) => lore.get(a, id)!.year - lore.get(b, id)!.year),
    kept = store.archives.filter((a) => a.faded === null && a.crafts.includes(id)),
    blocks: Block[] = [];
  if (last) {
    const lastBlock: Line[] = [lossLine(world, last)],
      named = lastOf(world, last);
    if (named.length) lastBlock.push(named);
    blocks.push({
      type: "list",
      title: gone ? "Who was last" : "The latest to lose it",
      items: lastBlock.map((line) => item(line, null)),
    });
  }
  const now: Line = gone
    ? [`No one living knows how. Those who did last had it until year ${gone.year}.`]
    : knowers.length
      ? [
          `${cap(many(knowers.length, "land has", "lands have"))} it now, the longest held in `,
          landLink(world, knowers[0]!),
          `, since year ${lore.get(knowers[0]!, id)!.year}.`,
        ]
      : ["No one has it now."];
  blocks.push({
    type: "list",
    title: "Who has it now",
    items: [
      item(now, null),
      ...knowers
        .slice(0, 5)
        .map((c) =>
          item([landLink(world, c, true), `, since year ${lore.get(c, id)!.year}`], null),
        ),
    ],
  });
  if (kept.length)
    blocks.push({
      type: "list",
      title: "Where it is kept",
      items: kept
        .slice(0, 6)
        .map((a) =>
          item(
            [link(cap(archiveName(world, a)), archiveRef(a)), `, since year ${a.year}`],
            archiveRef(a),
          ),
        ),
    });
  if (list.length > 1)
    blocks.push({
      type: "list",
      title: "Those who lost it",
      items: list.slice(0, 12).map((l) => item(lossLine(world, l), null, l.year)),
    });
  return {
    ref,
    kind: "event",
    icon: "🕯️",
    title: `${cap(name)}, lost`,
    subtitle: gone
      ? [`Lost to the world in year ${gone.year}`]
      : again
        ? [`Lost to the world in year ${again.year}, found again in year ${again.found!.year}`]
        : [`Lost in ${many(list.length, "land", "lands")} and known in others`],
    color: null,
    place: last ? { scale: "region", cell: last.cell } : null,
    stats: [
      stat("Lands that have it", count(knowers.length)),
      stat("Lands that lost it", count(list.length), { why: prinRef(id) }),
      ...(gone ? [stat("Lost to the world", `year ${gone.year}`, { why: gone.event })] : []),
      ...(kept.length ? [stat("Kept in", many(kept.length, "place", "places"))] : []),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: yearNow(world),
  };
}

const many = (n: number, one: string, more: string): string =>
  `${count(n)} ${n === 1 ? one : more}`;

/** A ruin's archive: what it holds, whose it was, who has come to it (`archive:<n>`). */
export function archivePage(world: World, ref: string): PageModel {
  const n = Number(ref.slice(ref.indexOf(":") + 1)),
    a = lostOf(world).archive(n);
  if (!a) throw new Error(`no archive ${ref}`);
  const ctx = populationContext(world),
    lore = loreOf(world),
    s = ctx.settlements.get(a.town),
    people = ctx.provinces.get(a.cell)?.total() ?? 0,
    name = archiveName(world, a),
    held = a.crafts.filter((id) => !lore.get(a.cell, id)),
    blocks: Block[] = [
      {
        type: "list",
        title: "What it is",
        items: [
          item([keepingWords(a.form)], null),
          item(
            [
              `It holds what `,
              landLink(world, a.cell, true),
              ` was losing from year ${a.year}: `,
              link("how it began", a.event),
              ".",
            ],
            null,
          ),
          item(
            [
              a.faded !== null
                ? `No one could read it after year ${a.faded}.`
                : people
                  ? "People live there now, and may yet find what's in it."
                  : "No one lives there now. It's there for whoever comes.",
            ],
            null,
          ),
        ],
      },
      {
        type: "list",
        title: "What it holds",
        items: a.crafts.map((id): Item =>
          item(
            [
              link(cap(principleName(id, world)), lostRef(id)),
              lore.get(a.cell, id)
                ? ", known there again"
                : lore.landsKnowing(id)
                  ? ", not known there now"
                  : ", and no one living knows it",
            ],
            lostRef(id),
          ),
        ),
      },
    ];
  if (a.read.length)
    blocks.push({
      type: "list",
      title: "Who found it here",
      items: a.read
        .slice(-10)
        .map((r) =>
          item(
            [
              landLink(world, r.cell, true),
              ` found `,
              link(principleName(r.id, world), prinRef(r.id)),
              ` in it, year ${r.year}.`,
            ],
            r.event,
            r.year,
          ),
        ),
    });
  return {
    ref,
    kind: "event",
    icon: FORM_ICON[a.form],
    title: cap(name),
    subtitle: [`Kept since year ${a.year}`],
    color: null,
    place: s ? { scale: "village", town: s.ref, stone: ref } : { scale: "region", cell: a.cell },
    stats: [
      stat("Holds", many(a.crafts.length, "craft", "crafts")),
      stat("Lost to its land still", many(held.length, "craft", "crafts")),
      stat("Found in it", a.read.length ? many(a.read.length, "time", "times") : "not yet"),
      ...(s ? [stat("Where", [townLink(world, s.ref)])] : []),
      stat(
        "Lasts",
        a.faded !== null
          ? `read last in year ${a.faded}`
          : `about ${count(KEEP_YEARS[a.form])} years, as this kind goes`,
      ),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: yearNow(world),
  };
}

const FORM_ICON: Readonly<Record<KeepForm, string>> = {
  brood: "🐝",
  reef: "🪸",
  written: "📜",
  reciters: "🗣️",
  songs: "🎶",
};

const FORM_STONE: Readonly<Record<KeepForm, MemorialForm>> = {
  brood: "dome",
  reef: "reef",
  written: "archive",
  reciters: "ring",
  songs: "cairn",
};

/** What a land has lost and what it still keeps, for its page (none: nothing). */
export function landLostBlocks(world: World, cell: number): Block[] {
  const store = lostOf(world),
    lost = store.ofLand(cell),
    kept = store.archivesIn(cell),
    lore = loreOf(world),
    blocks: Block[] = [];
  if (lost?.size) {
    const list = [...lost.values()].sort((a, b) => b.year - a.year || (a.id < b.id ? -1 : 1));
    blocks.push({
      type: "list",
      title: "What it has lost",
      items: [
        item([forgetWords(world)], null),
        ...list.slice(0, 16).map((l) => {
          const teachers = lore.landsKnowing(l.id),
            line: Span[] = [
              link(cap(principleName(l.id, world)), lostRef(l.id)),
              `, year ${l.year}: `,
              ...(l.cause ? [link(FELL_WORDS[l.why], l.cause)] : [FELL_WORDS[l.why]]),
              teachers
                ? `. ${many(teachers, "land has", "lands have")} it still.`
                : ". No one has it now.",
            ];
          return item(line, lostRef(l.id), l.year);
        }),
      ],
    });
  }
  const back = store.closed.filter((l) => l.cell === cell).slice(-12);
  if (back.length)
    blocks.push({
      type: "list",
      title: "What it came back to",
      items: back
        .reverse()
        .map((l) =>
          item(
            [
              link(cap(principleName(l.id, world)), lostRef(l.id)),
              `, lost year ${l.year}: `,
              ...(l.back!.how === "kept"
                ? ["found again in what was kept"]
                : l.back!.how === "brought"
                  ? ["those who came brought it"]
                  : l.back!.how === "found"
                    ? ["come upon again, from nothing"]
                    : ["taught again"]),
              `, ${many(l.back!.year - l.year, "year", "years")} on.`,
            ],
            lostRef(l.id),
            l.back!.year,
          ),
        ),
    });
  if (kept.length)
    blocks.push({
      type: "list",
      title: "What it still keeps",
      items: kept.map((a) =>
        item(
          [
            link(cap(archiveName(world, a)), archiveRef(a)),
            `: ${many(a.crafts.length, "craft", "crafts")}, since year ${a.year}`,
          ],
          archiveRef(a),
        ),
      ),
    });
  return blocks;
}

/**
 * A town's archive as a thing that stands in it, for its plan to carry: of the stuff its land's stones are, dressed pale, so it reads among
 * what's about it (`stoneOf`: that stuff, of a land; a people of the water grow theirs).
 */
export function archiveMemorials(
  world: World,
  town: string,
  stoneOf: (cell: number) => readonly [number, number, number],
): readonly Memorial[] {
  const a = lostOf(world).archiveOfTown(town);
  if (!a || !a.crafts.length) return [];
  const body = populationContext(world).generated.life.people?.body,
    water = body?.medium === "water",
    stone = stoneOf(a.cell),
    colour: [number, number, number] = water
      ? [0.62, 0.5, 0.56]
      : [stone[0] * 0.3 + 0.62, stone[1] * 0.3 + 0.6, stone[2] * 0.3 + 0.52];
  return [
    {
      ref: archiveRef(a),
      form: FORM_STONE[a.form],
      title: cap(archiveName(world, a)),
      year: a.year,
      age: Math.max(0, yearNow(world) - a.year),
      size: Math.min(1.15, 0.85 + a.crafts.length / 60),
      colour,
      dark: [colour[0] * 0.5, colour[1] * 0.46, colour[2] * 0.4],
    },
  ];
}

/** The craft a building is shut for want of, if any: what it needs that its land has lost (a smithy gone cold, a school shut). */
export function shutFor(world: World, cell: number, kind: CivicKind): string | null {
  const lost = lostOf(world).ofLand(cell);
  if (!lost) return null;
  const ctx = populationContext(world),
    lore = loreOf(world),
    knows = (id: string) =>
      id === "cultivation"
        ? !!ctx.provinces.get(cell)?.knowsCultivation
        : id === "metalworking"
          ? true
          : !!lore.get(cell, id);
  for (const need of civic(kind).needs)
    for (const way of [need]) {
      const ids = way.split("|");
      if (ids.some(knows)) continue;
      const it = ids.find((x) => lost.has(x));
      if (it) return it;
    }
  return null;
}

/** What is at risk in a land just now: the craft it holds with the fewest hands to spare, that nothing still stands on (null: nothing). */
export function lastHandsOf(world: World, cell: number, occ: number): string | null {
  const ctx = populationContext(world),
    prov = ctx.provinces.get(cell);
  if (!prov?.total()) return null;
  const lore = loreOf(world);
  // (Only where the land has begun to lose things: a small land that never fell holds what it holds.)
  if (!lostOf(world).ofLand(cell)?.size) return null;
  let best: { id: string; short: number } | null = null;
  for (const [id] of lore.of(cell)) {
    const p = PRINCIPLES[PRINCIPLE_INDEX.get(id)!]!,
      d = p.drivers,
      theirs =
        occ === OCC.crafter
          ? d.crafters
          : occ === OCC.farmer
            ? d.farmers
            : occ === OCC.herder
              ? d.herders
              : occ === OCC.trader
                ? d.traders
                : occ === OCC.leader
                  ? d.leaders
                  : 0;
    if (!theirs) continue;
    const need = needOfHands(p),
      hands = handsHolding(ctx, prov, p);
    if (hands >= need) continue;
    if (RESTS_ON.get(id)?.some((q) => !!lore.get(cell, q.id))) continue;
    const short = hands / need;
    if (!best || short < best.short) best = { id, short };
  }
  return best?.id ?? null;
}

/** Whether a people forgets as others do, in a sentence: read off what they are. */
export function forgetWords(world: World): string {
  return isHive(populationContext(world))
    ? "A hive does not lose a craft with its last worker: what one knew, all did. It goes only when the brood goes."
    : "What only many hands hold goes when the hands do.";
}

/** The earliest any land that has lost a craft came to it (null: no one has lost it). */
export function firstOfLost(world: World, id: string): { cell: number; year: number } | null {
  let best: { cell: number; year: number } | null = null;
  for (const l of lostOf(world).losses(id))
    if (!best || l.since < best.year) best = { cell: l.cell, year: l.since };
  return best;
}

/** The tree's words for a principle lost: for F5's pages. */
export function lostOfPrinciple(world: World, id: string): Line | null {
  const store = lostOf(world),
    gone = store.worldLoss(id);
  if (gone)
    return [`Lost to the world in year ${gone.year}. `, link("What became of it", lostRef(id))];
  const list = store.losses(id).filter((l) => !l.back);
  if (!list.length) {
    const again = store.foundAgain.filter((w) => w.id === id).at(-1);
    return again
      ? [
          `Lost to the world in year ${again.year}, found again in year ${again.found!.year}. `,
          link("What became of it", lostRef(id)),
        ]
      : null;
  }
  const l = list[0]!;
  return [
    `Lost in ${many(list.length, "land", "lands")}: `,
    landLink(world, l.cell),
    `, year ${l.year}. `,
    link("What became of it", lostRef(id)),
  ];
}
