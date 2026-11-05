// A people of a world, on the pages (Phase 69): how far they have come and why, what their hands carry and
// from what, who came to them, and what a meeting of the two can be, in words true both ways. Pure reads.
import { CLADES, bodyWords, type BodyPlan } from "../../rules/index.ts";
import {
  STAGE_WORDS,
  arrivalsAt,
  folkArms,
  folkByRef,
  folkPeak,
  folkPeople,
  folkStage,
  type Folk,
} from "../../sim/index.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, FolkList, PageModel, Stat } from "../../bridge/index.ts";
import { clusterOf } from "../../sim/index.ts";
import { figureBody } from "../folk.ts";
import { LANDFALL_NOTE, landfallBlocks, landfallPlans } from "../landfall.ts";
import { folkContact, folkFactsOf, folkList, folkOneRef } from "../natives.ts";
import { item, link, many, sentence, stat, yearNow } from "./words.ts";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Their body, whichever way it is kept. */
const bodyOfFolk = (f: Folk): BodyPlan =>
  f.followed
    ? (CLADES.find((c) => c.id === f.followed!.clade)!.body as unknown as BodyPlan)
    : f.body;

/** Where a people stands now, in a block or two, and the ways down to them (for its page and its world's). */
export function folkBlocks(world: World, f: Folk): Block[] {
  const year = yearNow(world),
    stage = folkStage(f, year),
    peak = folkPeak(f, year),
    arms = folkArms(f, stage),
    came = arrivalsAt(world, f),
    rows: Stat[] = [
      stat("How far they have come", cap(STAGE_WORDS[stage])),
      ...(stage === "ruins" && f.fell !== null
        ? [
            stat("They fell", `In year ${f.fell}, ${STAGE_WORDS[peak]}`),
            stat("As far as what is left tells", f.fellWhy ?? "No one can say"),
          ]
        : [stat("How many", `Some ${folkPeople(f, year).toLocaleString("en")} (an estimate)`)]),
      ...(arms.length ? [stat("What they carry", sentence(arms.join("; ")))] : []),
      ...(f.shut && stage !== "ruins" ? [stat("What holds them", f.shut)] : []),
      stat("Their ground gives", `${cap(f.stone.name)}, ${f.stone.from}`),
    ];
  return [
    { type: "facts", title: "On their own ground", rows },
    {
      type: "tool",
      tool: "watch.folk",
      args: {
        star: f.star,
        index: f.planet,
        label: stage === "ruins" ? "⬇ Go down to what is left" : "⬇ Go down to them",
      },
    },
    ...(came.length
      ? [
          {
            type: "tool" as const,
            tool: "watch.meeting",
            args: { star: f.star, index: f.planet },
          },
        ]
      : []),
    ...watchLandfall(world, f),
  ];
}

/** The way to watch a landing on them, where one happened (its words are on the Met tab). */
function watchLandfall(world: World, f: Folk): Block[] {
  const p = landfallPlans(world, f)[0];
  return p
    ? [
        {
          type: "text",
          lines: [[`In year ${p.year}, ${p.who} came down on them. ${p.holdsWords}`]],
        },
        {
          type: "tool",
          tool: "watch.landfall",
          args: { star: p.star, index: p.index, n: p.n, label: "⚔ Watch them come" },
        },
      ]
    : [];
}

/** What a meeting of the first who came and a people can be. */
function meetingBlocks(world: World, f: Folk): Block[] {
  const c = folkContact(world, f);
  if (!c)
    return [
      {
        type: "text",
        lines: [
          [
            "No ship has come to them. History follows no meeting of them, so what would pass is not told here.",
          ],
        ],
      },
    ];
  const yes = (b: boolean) => (b ? "Yes" : "No"),
    r = c.reading;
  return [
    {
      type: "text",
      lines: [
        [
          `${cap(c.who)} came first, in year ${c.year}${c.sentBy ? `, sent by ${c.sentBy}` : ""}, and found the ${f.name} ${c.found}. History holds their coming and no more of their meeting.`,
        ],
      ],
    },
    {
      type: "facts",
      title: "What a meeting can be",
      rows: [
        stat(`Speak: ${yes(r.speak.can)}`, sentence(r.speak.words)),
        stat(`Breathe there: ${yes(r.airThere.can)}`, sentence(r.airThere.words)),
        stat(`Breathe the other's: ${yes(r.airHome.can)}`, sentence(r.airHome.words)),
        stat(`Eat there: ${yes(r.foodThere.can)}`, sentence(r.foodThere.words)),
        stat(`Eat the other's: ${yes(r.foodHome.can)}`, sentence(r.foodHome.words)),
        stat(`Catch: ${yes(r.sickness.can)}`, sentence(r.sickness.words)),
      ],
    },
    ...landfallBlocks(world, f),
    ...(landfallPlans(world, f).length
      ? [{ type: "text" as const, lines: [[LANDFALL_NOTE]] }]
      : []),
  ];
}

/** The page of a people history does not follow. */
export function nativePage(world: World, f: Folk): PageModel {
  const year = yearNow(world),
    stage = folkStage(f, year),
    star = clusterOf(world).find((s) => s.ref === f.star),
    body = bodyOfFolk(f),
    since = Math.round(f.mindsAgo * 1000);
  return {
    ref: f.ref,
    kind: "civilization",
    icon: stage === "ruins" ? "🏚️" : stage === "camps" ? "🏕️" : "🏘️",
    portrait: {
      kind: "person",
      ref: f.ref,
      age: 30,
      span: body.span,
      occupation: 1,
      child: false,
      era: stage === "camps" || stage === "ruins" ? "forage" : "farm",
      body: star ? figureBody(body, folkFactsOf(f, star)) : null,
    },
    title: `The ${f.name}`,
    subtitle: [`${body.name} of another star — `, link("their world", `${f.star}/${f.planet}`)],
    color: null,
    place: { scale: "world", star: f.star, index: f.planet },
    stats: [
      stat("Now", cap(STAGE_WORDS[stage])),
      stat("Pull", `${f.gravity.toFixed(2)} g`),
      stat("Warmth", `${Math.round(f.warmth)} °C`),
      stat("Met", String(arrivalsAt(world, f).length)),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "text",
            lines: [
              [
                `The ${f.name}, ${body.name}, rose on their world by its own numbers. Bodies have lived there ${f.bodiesAgo.toFixed(2)} thousand million years, and for some ${many(since, "million years", "million years")} of that a mind could have risen among them. ${f.ceiling === "camps" ? "Their world gives them no way out of camps." : f.arose <= year ? `Their climb out of camps began in year ${f.arose}, at ${f.pace.toFixed(1)} times the time home took.` : `Their climb out of camps has not begun: by what is known of their world it would begin about year ${f.arose}.`} These figures are estimates.`,
              ],
            ],
          },
          ...folkBlocks(world, f),
          {
            type: "facts",
            title: "Their bodies",
            rows: [stat("Built", sentence(bodyWords(body)))],
          },
        ],
      },
      { id: "met", name: "Met", blocks: meetingBlocks(world, f) },
    ],
    followable: false,
    year,
  };
}

/** Every people about these stars, those a ship has come to first, then by how far each has come. */
export function peoplesPage(world: World): PageModel {
  const year = yearNow(world),
    all = folkList(world),
    line = (f: FolkList[number]) =>
      item(
        `The ${f.name}: ${STAGE_WORDS[f.stage as keyof typeof STAGE_WORDS]}${f.came !== null ? `; a ship first came in year ${f.came}` : ""}`,
        f.ref,
      ),
    met = all.filter((f) => f.came !== null).sort((a, b) => a.came! - b.came!),
    order = Object.keys(STAGE_WORDS);
  return {
    ref: "world:peoples",
    kind: "world",
    icon: "👥",
    title: "The peoples about the stars",
    subtitle: [
      `${many(all.length, "people", "peoples")} on worlds near enough to know of, in year ${year}. These figures are estimates.`,
    ],
    color: null,
    place: null,
    stats: order.flatMap((s) => {
      const n = all.filter((f) => f.stage === s).length;
      return n ? [stat(cap(STAGE_WORDS[s as keyof typeof STAGE_WORDS]), String(n))] : [];
    }),
    tabs: [
      {
        id: "all",
        name: "All of them",
        blocks: [
          ...(met.length
            ? [{ type: "list" as const, title: "A ship has come to them", items: met.map(line) }]
            : []),
          ...met.flatMap((m): Block[] => {
            const f = folkByRef(world, m.ref),
              p = f ? landfallPlans(world, f)[0] : undefined;
            return p
              ? [
                  {
                    type: "tool",
                    tool: "watch.landfall",
                    args: {
                      star: p.star,
                      index: p.index,
                      n: p.n,
                      label: `⚔ Watch them come: the ${p.natives}, year ${p.year}`,
                    },
                  },
                ]
              : [];
          }),
          ...order.flatMap((s) => {
            const here = all.filter((f) => f.stage === s && f.came === null);
            return here.length
              ? [
                  {
                    type: "list" as const,
                    title: cap(STAGE_WORDS[s as keyof typeof STAGE_WORDS]),
                    items: here.map(line),
                  },
                ]
              : [];
          }),
        ],
      },
    ],
    followable: false,
    year,
  };
}

/** One of a people's town: who they are, what they carry. */
export function folkOnePage(world: World, ref: string): PageModel {
  const rest = ref.slice("folkone:".length),
    last = rest.lastIndexOf(":"),
    f = folkByRef(world, rest.slice(0, last)),
    i = Number(rest.slice(last + 1));
  if (!f) throw new Error(`no people ${ref}`);
  const year = yearNow(world),
    stage = folkStage(f, year),
    arms = folkArms(f, stage);
  return {
    ref: folkOneRef(f, i),
    kind: "person",
    icon: "🧍",
    portrait: { kind: "flag", flags: [{ color: [0.6, 0.6, 0.6], key: i }] },
    title: `One of the ${f.name}`,
    subtitle: [link(`The ${f.name}`, f.ref)],
    color: null,
    place: { scale: "world", star: f.star, index: f.planet },
    stats: [stat("Now", cap(STAGE_WORDS[stage]))],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "list",
            title: "What their hands carry",
            items: arms.map((a) => item(cap(a))),
          },
        ],
      },
    ],
    followable: false,
    year,
  };
}
