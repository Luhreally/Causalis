// A road's own page, and a bus's (R1): who built it and when, what it is laid with, what goes along it now and how much, what it joins; the gang on it, who
// pays them, who they are, how far they have got and what stopped them; what cut it. Read, every word of it, from what the world keeps (host/roads.ts).
import { YEAR, hashString, type World } from "../../kernel/index.ts";
import { politiesOf, populationContext, realmName } from "../../sim/index.ts";
import type { Block, LandRoad, Line, PageModel, RoadLay, Span } from "../../bridge/index.ts";
import { CARRIER_WORDS, worksShareOf } from "../roadwords.ts";
import { landEra } from "../village.ts";
import { landPlan } from "../land.ts";
import { getAbout, roadKm, roadStuff, whoPays } from "../roads.ts";
import { linesOf, townRoster } from "../roster.ts";
import { landLink, realmLink, townLink } from "./names.ts";
import { count, item, link, stat, yearNow } from "./words.ts";

const LAY_WORDS: Readonly<Record<RoadLay, string>> = {
  track: "trodden out",
  paved: "paved",
  rails: "railed",
};
const LOOK_WORDS: Readonly<Record<RoadLay, string>> = {
  track: "a track",
  paved: "a paved road",
  rails: "a railway beside a paved road",
};
/** Their ways, for a people of the water: along the sea's floor. */
const LAY_UNDERSEA: Readonly<Record<RoadLay, string>> = {
  track: "cleared",
  paved: "set with blocks",
  rails: "cabled",
};
const LOOK_UNDERSEA: Readonly<Record<RoadLay, string>> = {
  track: "a way cleared along the sea's floor",
  paved: "a way of set blocks along the sea's floor",
  rails: "a guide cable along the sea's floor",
};

/** The road a page is of, on its land as read now (null: gone). */
export function roadOf(
  world: World,
  ref: string,
): { cell: number; road: LandRoad; size: number } | null {
  const m = /^road:(\d+):(\d+):(\d+)$/.exec(ref);
  if (!m) return null;
  const cell = Number(m[1]),
    plan = landPlan(world, cell, 60),
    road = plan.roads.find((r) => r.ref === ref);
  return road ? { cell, road, size: 128 } : null;
}

/** What it joins, in words with links. */
function joins(world: World, road: LandRoad): Span[] {
  const b = road.b
    ? [townLink(world, road.b)]
    : road.toward
      ? [road.toward]
      : ["the land next door"];
  return [townLink(world, road.a), road.b ? " and " : " toward ", ...b];
}

/** Those who work on it now, named: the town's own, by its lines. */
function handsNamed(world: World, town: string, n: number, key: number): Span[] {
  const s = populationContext(world).settlements.get(town as never);
  if (!s) return [];
  const roster = townRoster(world, s.ref),
    lines = linesOf(s.population),
    out: Span[] = [];
  let found = 0;
  for (let k = 0; k < lines && found < n; k++) {
    const h = roster.holder((key + k * 37) % lines);
    if (!h) continue;
    if (found) out.push(found === n - 1 ? " and " : ", ");
    out.push(link(roster.nameOf(h), h.ref));
    found++;
  }
  return out;
}

/** A road's own page. */
export function roadPage(world: World, ref: string): PageModel {
  const found = roadOf(world, ref);
  if (!found) throw new Error(`no road ${ref}`);
  const { cell, road } = found,
    y = world.now / YEAR,
    year = yearNow(world),
    km = roadKm(128, 2.4, road.from, road.to),
    stages = road.stages ?? [],
    first = stages[0],
    laid = stages.filter((s) => y >= s.until),
    last = laid.at(-1) ?? first,
    w = road.works && y >= road.works.from && y < road.works.until ? road.works : null,
    lookNow = (w && !w.again ? laid.at(-1)?.what : last?.what) ?? null,
    stuff = roadStuff(world, cell, last?.what ?? "track"),
    era = landEra(world, cell),
    about = getAbout(world, cell, era),
    go = CARRIER_WORDS(era, about, lookNow === "rails"),
    blocks: Block[] = [],
    tell: Line[] = [],
    realm = politiesOf(world).of(cell),
    key = hashString(ref),
    undersea = populationContext(world).medium === "water",
    layWords = undersea ? LAY_UNDERSEA : LAY_WORDS,
    lookWords = undersea ? LOOK_UNDERSEA : LOOK_WORDS;
  tell.push([
    `${lookNow ? lookWords[lookNow][0]!.toUpperCase() + lookWords[lookNow].slice(1) : undersea ? "A way being cleared" : "A road being laid"}, about ${count(Math.round(km))} km, between `,
    ...joins(world, road),
    ", on ",
    landLink(world, cell),
    ".",
  ]);
  for (const s of stages) {
    if (y < s.from) continue;
    const done = y >= s.until;
    tell.push([
      done
        ? `${layWords[s.what][0]!.toUpperCase()}${layWords[s.what].slice(1)} between year ${count(Math.floor(s.from))} and year ${count(Math.floor(s.until))}, with ${roadStuff(world, cell, s.what).words}.`
        : `Being ${layWords[s.what]} since year ${count(Math.floor(s.from))}, with ${roadStuff(world, cell, s.what).words}.`,
    ]);
  }
  if (lookNow)
    tell.push([
      road.traffic > 1
        ? `What goes along it: ${go}, ${count(road.traffic)} at a time at the busiest.`
        : `What goes along it: ${go}, one at a time.`,
    ]);
  else tell.push(["Nothing goes along it yet: it isn't joined up."]);
  blocks.push({ type: "text", title: "The road", lines: tell });
  // The gang on it.
  if (w) {
    const pay = whoPays(world, cell),
      done = worksShareOf(w, y),
      kmDone = done * km,
      hands: Line[] = [],
      tons = roadStuff(world, cell, w.what).tonnes * km;
    hands.push(
      pay === "hive"
        ? ["No one pays: the hive sends its own where the way is wanted."]
        : pay === "realm" && realm
          ? ["Paid for by ", realmLink(world, realm.ref), " out of its dues."]
          : ["Paid for by the households of its towns, a day's labour in ten."],
    );
    const named = handsNamed(world, road.a, Math.min(4, w.hands), key >>> 0);
    hands.push(
      named.length
        ? [
            `${count(w.hands)} workers of ${pay === "hive" ? "the hive" : "the town"}${w.machines ? ", with their machines" : ""}, among them `,
            ...named,
            ".",
          ]
        : [
            `${count(w.hands)} workers from about the land${w.machines ? ", with their machines" : ""}.`,
          ],
    );
    hands.push([
      `${w.again ? (undersea ? "Clearing it again" : "Laying it afresh") : "Laying it"}: ${kmDone < 1 ? "under a kilometre" : `${count(Math.round(kmDone))} km`} of about ${count(Math.round(km))} done, ${Math.round(done * 100)} in a hundred.`,
    ]);
    if (tons > 0)
      hands.push([
        `It wants about ${count(Math.round(tons / 100) * 100)} tonnes of ${roadStuff(world, cell, w.what).short} in all.`,
      ]);
    const stop = w.stops.at(-1),
      idle = w.stops.reduce((n, s) => n + s.to - s.from, 0);
    if (stop) {
      const isNow = y >= stop.from && y < stop.to,
        why =
          stop.why === "war"
            ? stop.ref
              ? link(isNow ? "the fighting on this land" : "the fighting on this land", stop.ref)
              : "the fighting on this land"
            : stop.ref
              ? link("the ground's shaking", stop.ref)
              : "the ground's shaking";
      hands.push(
        isNow
          ? ["Stopped: they stand idle for ", why, "."]
          : [
              `Stopped for about ${count(Math.max(1, Math.round(idle)))} years in all, last for `,
              why,
              ".",
            ],
      );
    } else hands.push(["Nothing has stopped them yet."]);
    blocks.push({ type: "text", title: "🚧 The gang on it", lines: hands });
  } else if (last && y >= last.until) {
    blocks.push({
      type: "text",
      title: "Its upkeep",
      lines: [
        [
          `No gang is on it this year.${undersea ? " The weed grows back, and it is cleared again every generation or so." : last.what === "track" ? " A track keeps itself, by being walked." : " Its stones are laid again every generation or so."}`,
        ],
      ],
    });
  }
  // A cut.
  const cut = road.cut && y >= road.cut.from && y < road.cut.until ? road.cut : null;
  if (cut)
    blocks.push({
      type: "text",
      title: "⚠ Cut",
      lines: [
        [
          "It lies open about ",
          `${Math.round(cut.at * 100)} in a hundred of the way along, cut by `,
          cut.ref
            ? link(
                cut.why === "war"
                  ? "the fighting in year " + count(cut.from)
                  : "the shaking in year " + count(cut.from),
                cut.ref,
              )
            : cut.why === "war"
              ? `the fighting in year ${count(cut.from)}`
              : `the shaking in year ${count(cut.from)}`,
          `. Nothing goes through until it is mended, about year ${count(Math.ceil(cut.until))}.`,
        ],
      ],
    });
  return {
    ref,
    kind: "road",
    icon: w ? "🚧" : "🛣️",
    title: w
      ? `Works on the road from ${nameOfTown(world, road.a)}`
      : `The road from ${nameOfTown(world, road.a)}`,
    subtitle: [
      road.b
        ? `To ${nameOfTown(world, road.b)}`
        : road.toward
          ? `Toward ${road.toward}`
          : "Out of the land",
    ],
    color: null,
    place: { scale: "region", cell, rider: ref },
    stats: [
      stat("Joins", joins(world, road)),
      stat("Laid with", stuff.short),
      stat("Long", `about ${count(Math.round(km))} km`),
      stat("Since", first ? `year ${count(Math.floor(first.from))}` : `year ${count(road.since)}`),
      stat("Goes along it", lookNow ? go : "nothing yet"),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

const nameOfTown = (world: World, ref: string): string =>
  populationContext(world).settlements.get(ref as never)?.name ?? "a town now gone";

/** A land's roads, for its page: each one's words, the new ones first; and what cut any. */
export function landRoadsBlock(world: World, cell: number): Block | null {
  const roads = landPlan(world, cell, 60).roads,
    y = world.now / YEAR,
    layWords = populationContext(world).medium === "water" ? LAY_UNDERSEA : LAY_WORDS;
  if (!roads.length) return null;
  const rank = (r: LandRoad) => {
      const w = r.works && y >= r.works.from && y < r.works.until ? 2 : 0,
        c = r.cut && y >= r.cut.from && y < r.cut.until ? 3 : 0;
      return w + c;
    },
    list = [...roads]
      .sort((a, b) => rank(b) - rank(a) || b.since - a.since)
      .slice(0, 8)
      .map((r) => {
        const cut = r.cut && y >= r.cut.from && y < r.cut.until,
          w = r.works && y >= r.works.from && y < r.works.until ? r.works : null,
          opened = (r.stages ?? []).filter((s) => y >= s.until).at(-1),
          name = `${nameOfTown(world, r.a)} ${r.b ? `to ${nameOfTown(world, r.b)}` : r.toward ? `toward ${r.toward}` : "out of the land"}`;
        return {
          text: cut
            ? `⚠ ${name}: cut, in year ${count(r.cut!.from)}`
            : w
              ? `🚧 ${name}: being ${layWords[w.what]}${w.again ? " afresh" : ""}, ${Math.round(worksShareOf(w, y) * 100)} in a hundred done`
              : opened
                ? `🛣️ ${name}: ${layWords[opened.what]} by year ${count(Math.floor(opened.until))}`
                : `🛣️ ${name}`,
          ref: r.ref ?? null,
        };
      });
  return {
    type: "list",
    title: "Its roads",
    items: list.map((l) => item([l.text], l.ref)),
  };
}

/** A bus's page, or whatever goes a line in a town: who rides it, the town's own. */
export function busPage(world: World, ref: string): PageModel {
  const m = /^bus:(.+):(\d+)$/.exec(ref);
  if (!m) throw new Error(`no bus ${ref}`);
  const town = m[1]!,
    s = populationContext(world).settlements.get(town as never);
  if (!s) throw new Error(`no town ${town}`);
  const about = getAbout(world, s.cell, landEra(world, s.cell)),
    roster = townRoster(world, s.ref),
    lines = linesOf(s.population),
    word = about.line ?? "line",
    riders: Span[][] = [];
  for (let k = 0; k < lines && riders.length < 10; k++) {
    const h = roster.holder(k);
    if (!h || (hashString(h.ref) >>> 0) % 100 >= RIDES_IN_100) continue;
    riders.push([link(roster.nameOf(h), h.ref)]);
  }
  const realm = politiesOf(world).of(s.cell),
    lineNo = Number(m[2]) + 1;
  return {
    ref,
    kind: "road",
    icon: "🚌",
    title: `The ${word} of ${s.name}, line ${count(lineNo)}`,
    subtitle: [`Through ${s.name}, by way of its square`],
    color: null,
    place: { scale: "village", town: s.ref },
    stats: [
      stat("Town", [townLink(world, s.ref)]),
      stat("Runs", about.drive ?? "as it can"),
      ...(realm ? [stat("Under", realmName(realm))] : []),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "text",
            title: "What it is",
            lines: [
              [
                `It goes from the town's edge in through the square and out the far side and back, from before light until late, ${about.drive ?? "as it can"}. Those who live too far from their work to walk it and keep nothing of their own to go in ride it.`,
              ],
            ],
          },
          {
            type: "list",
            title: "Some who ride it",
            items: riders.map((r) => item(r, (r[0] as { ref?: string }).ref ?? null)),
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** Of a hundred grown who keep nothing of their own, how many ride (as view/rides.ts reads them). */
export const RIDES_IN_100 = 60;

