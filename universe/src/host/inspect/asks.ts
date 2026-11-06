// A town asked (H1), as a person reads it: what it can be asked for and why not the rest, who answered and why, what is going up and how far it has got, who is
// at it, what it has taken, what stopped it, and what came of it all. Read, every word of it, from what the world keeps.
import { MONTH, YEAR, hashString, yearOfMoment, type World } from "../../kernel/index.ts";
import { CIVIC_ICON, CIVIC_FOR, CIVICS, G, type CivicKind } from "../../rules/index.ts";
import { meansOfWorld } from "../../gen/index.ts";
import {
  CIVIC_LOTS,
  ASK_FIRSTS,
  ASK_PULL,
  askFormOf,
  askShut,
  asksOf,
  designsOf,
  houseFor,
  effortOf,
  firstProblem,
  handsFor,
  marketsOf,
  politiesOf,
  populationContext,
  raiseProblem,
  townsOf,
  warsOf,
  type Ask,
  type AskAnswer,
  type AskFirst,
  type AskForm,
  type AskRaise,
  type AskWhyCode,
} from "../../sim/index.ts";
import { ANSWER_WORD, firstWords, raiseName, raiseThe } from "../../causal/index.ts";
import type {
  AskOffer,
  Block,
  Line,
  PageModel,
  Span,
  TownAsked,
  TownFirst,
  TownOffers,
} from "../../bridge/index.ts";
import { roadStuff } from "../roads.ts";
import { boardRef, goodName } from "./board.ts";
import { folkOf, type Party } from "./justice.ts";
import { landLink, realmLink, townLink } from "./names.ts";
import { count, item, link, stat, yearNow } from "./words.ts";

export const askRef = (a: Ask): string => `ask:${a.town}:${a.n}`;

const MONTHS_WORD = (n: number): string => {
  const m = Math.round(n);
  if (m < 2) return "about a month";
  if (m < 18) return `about ${count(m)} months`;
  return `about ${count(Math.round(m / 12))} years`;
};

const FIRST_ICON: Readonly<Record<AskFirst, string>> = {
  food: "🌾",
  stores: "🧺",
  homes: "🏠",
  walls: "🧱",
  arms: "⚔️",
  trade: "🏷️",
  faith: "🕯️",
  learning: "📜",
};

/** Where a people's food comes from, in a word. */
const fieldsOf = (world: World): string =>
  populationContext(world).medium === "water" ? "the pens" : "the fields";

/** What a priority takes and gives, said before it is asked. */
function firstNote(world: World, what: AskFirst, share: number): string {
  const hands = "about one in seven",
    fields = fieldsOf(world),
    felt =
      share >= 0.5
        ? "Its whole land will feel it."
        : share < 0.03
          ? "It is so little of its land that the land will hardly feel it."
          : "Its land will feel it.";
  switch (what) {
    case "food":
      return `${hands} out at ${fields}, for six years. ${felt}`;
    case "stores":
      return `${hands} from ${fields}, to keep more against lean years. ${felt}`;
    case "homes":
      return `${hands} from ${fields}, to house those with nowhere to sleep. ${felt}`;
    case "walls":
      return `${hands} from ${fields}, to see to its walls. It holds better in a fight.`;
    case "arms":
      return `${hands} from ${fields}, to the making of its arms. It fights better.`;
    case "trade":
      return `${hands} from ${fields}, to the market. ${felt}`;
    case "faith":
      return `${hands} from ${fields}, to prayer. ${felt}`;
    case "learning":
      return `${hands} from ${fields}, to teaching and being taught. ${felt}`;
  }
}

/** What a town can be asked for now, what it cannot and why (town.offers). */
export function townOffers(world: World, ref: string): TownOffers | null {
  const ctx = populationContext(world),
    s = ctx.settlements.get(ref as never);
  if (!s) return null;
  const shut = askShut(ctx, s.ref),
    who = WHO_ANSWERS[askFormOf(ctx, s.cell)],
    total = ctx.provinces.get(s.cell)?.total() ?? 0,
    share = total > 0 ? Math.min(1, s.population / total) : 1,
    firsts: AskOffer[] = [],
    raises: AskOffer[] = [],
    no: { readonly name: string; readonly why: string }[] = [];
  const f = townsOf(world).get(s.ref);
  if (!shut) {
    for (const what of ASK_FIRSTS) {
      const bad = firstProblem(ctx, s, what);
      if (bad) continue;
      firsts.push({
        kind: "first",
        what,
        icon: FIRST_ICON[what],
        name: sentenceCase(firstWords(world, what).replace(/^its /, "")),
        note: firstNote(world, what, share),
      });
    }
    const all: AskRaise[] = ["walls", ...CIVICS.map((c) => c.kind)];
    for (const what of all) {
      const bad = raiseProblem(ctx, s, what);
      if (bad) {
        // (What a person might have looked for, and why not: not everything no town here could yet dream of.)
        if (
          (what === "walls" ||
            what === "granary" ||
            what === "market" ||
            what === "shrine" ||
            what === "well") &&
          !/has one|has its walls|don't yet know|know nothing/.test(bad)
        )
          no.push({ name: sentenceCase(raiseName(world, what)), why: bad });
        continue;
      }
      const lots = what === "walls" ? 0 : CIVIC_LOTS[what as CivicKind],
        hands = handsFor(s.population, what, lots, f?.next ?? 0, "glad"),
        months = effortOf(ctx, s, what) / hands;
      raises.push({
        kind: "raise",
        what,
        icon: what === "walls" ? "🧱" : CIVIC_ICON[what as CivicKind],
        name: sentenceCase(raiseName(world, what)),
        note: `${MONTHS_WORD(months)}, with ${count(hands)} at it, if they take it up gladly`,
      });
    }
    // (The likeliest wanted first; none hidden.)
    raises.sort((a, b) => ORDER.indexOf(a.what) - ORDER.indexOf(b.what));
  }
  const now = asksOf(world).firstOf(s.ref, world.now);
  return {
    town: s.ref,
    name: s.name,
    people: s.population,
    shut,
    who,
    firstNow: now
      ? `It has ${firstWords(world, now.what)} first now, to year ${count(yearOfMoment(now.until!))}.`
      : null,
    firsts,
    raises,
    no,
    asked: asksOf(world)
      .ofTown(s.ref)
      .slice(-4)
      .reverse()
      .map((a) => ({ ref: askRef(a), words: askShort(world, a) })),
  };
}

const ORDER = [
  "well",
  "granary",
  "walls",
  "shrine",
  "market",
  "school",
  "smithy",
  "kiln",
  "mill",
  "hall",
  "temple",
];

const sentenceCase = (t: string) => t[0]!.toUpperCase() + t.slice(1);

/** A line for a list: "A granary: taken up gladly, 40 in a hundred done". */
function askShort(world: World, a: Ask): string {
  const thing =
      a.kind === "first"
        ? `${sentenceCase(firstWords(world, a.what))} first`
        : sentenceCase(raiseName(world, a.what)),
    w = a.work;
  return `${thing}, year ${count(yearOfMoment(a.t))}: ${ANSWER_WORD[a.answer]}${w ? (w.done !== null ? ", and raised" : w.left ? ", and given up" : `, ${Math.round((w.worked / w.effort) * 100)} in a hundred done`) : ""}`;
}

const WHO_ANSWERS: Readonly<Record<AskForm, string>> = {
  hive: "The hive answers as one, in what it does.",
  reef: "One speaks for the reef, once the shoals have been told.",
  elders: "Its elders answer, by whoever of them will speak.",
  moot: "A moot of its households answers, and argues first.",
  head: "Its head answers, for the realm.",
  council: "Its council answers, by one of them.",
};

// —— Who answered ————————————————————————————————————————————————————————————————————

/** Those who speak for a town in the year it was asked: drawn once, by the asking, from its first lines. */
function voices(world: World, a: Ask, n: number): Party[] {
  const s = populationContext(world).settlements.get(a.town);
  if (!s) return [];
  // (A town since fallen empty still had those who answered it.)
  const folk = folkOf(
      world,
      s.population > 0 ? s : { ...s, population: a.people },
      yearOfMoment(a.t),
    ),
    key = hashString(a.event),
    out: Party[] = [],
    not = new Set<string>();
  for (let k = 0; k < n * 3 && out.length < n; k++) {
    const p = folk.pick(key, k * 7, not);
    if (!p) break;
    not.add(p.ref);
    out.push(p);
  }
  // (The one who speaks first is the eldest of them: it's who a town sends.)
  return out.sort((x, y) => y.age - x.age);
}

/** Who answered, and how, as a person would read it aloud. */
function answerLines(world: World, a: Ask): Line[] {
  const [one, two] = voices(world, a, 2),
    who = (p: Party | undefined): Span => (p ? link(p.name, p.ref) : "one of them"),
    to = a.by ? a.by.ruler : "you",
    thing =
      a.kind === "first"
        ? `to put ${firstWords(world, a.what)} first`
        : `for ${raiseName(world, a.what)}`;
  const said: Record<AskAnswer, string> = {
    glad: "gladly",
    grudged: "because it was asked, and they want it known what it costs",
    half: "by half, and no further",
    refused: "not at all",
  };
  switch (a.form) {
    case "hive":
      return a.answer === "refused"
        ? [
            [
              `The hive was asked ${thing}. There is no one to refuse, and no one comes: its workers are all at what keeps it alive.`,
            ],
          ]
        : a.answer === "half"
          ? [
              [
                `The hive was asked ${thing}. No one says yes. Some of its workers come, among them `,
                who(one),
                ", and the rest stay at the brood.",
              ],
            ]
          : [
              [
                `The hive was asked ${thing}. No one says yes. The workers simply come, the first of them `,
                who(one),
                ".",
              ],
            ];
    case "reef":
      return [
        ["", who(one), `, who speaks for the reef, told ${to} it would be done ${said[a.answer]}.`],
      ];
    case "elders":
      return [
        [
          "",
          who(one),
          `, the eldest who would speak, answered for the elders: it will be done ${said[a.answer]}.`,
        ],
      ];
    case "moot":
      return [
        [
          `The moot sat on it. `,
          who(one),
          " spoke for it and ",
          who(two),
          ` against, and it came out so: it will be done ${said[a.answer]}.`,
        ],
      ];
    case "head":
      return [
        [
          "",
          who(one),
          `, who keeps the town for its realm, answered ${to}: it will be done ${said[a.answer]}.`,
        ],
      ];
    default:
      return [
        ["", who(one), `, for the council, answered ${to}: it will be done ${said[a.answer]}.`],
      ];
  }
}

/** Why they answered so, each reason a sentence. */
function whyLines(world: World, a: Ask): Line[] {
  const ctx = populationContext(world),
    year = yearOfMoment(a.t),
    rec = ctx.history.yearsOf(a.cell).findLast((y) => y.year <= year - 1),
    fed = rec ? Math.round(rec.fed / 10) : 100,
    lines: Line[] = [],
    land = landLink(world, a.cell, true),
    /** A crowd's reason, or the same in a hive, which has no one to say it. */
    in_ = (crowd: string, hive: string) => (a.form === "hive" ? hive : crowd),
    words: Readonly<Record<AskWhyCode, (by: number) => Line | null>> = {
      lean: () => [
        in_("They were lean: ", "It was lean: "),
        land,
        ` ate ${count(fed)} in a hundred of what it needed the year before, and there were no hands to spare.`,
      ],
      hungry: () => [
        in_("They were hungry: ", "It was hungry: "),
        land,
        ` ate ${count(fed)} in a hundred of what it needed the year before.`,
      ],
      wants: () => [
        in_("It is what they were short of: ", "It is what it was short of: "),
        land,
        ` ate ${count(fed)} in a hundred of what it needed the year before.`,
      ],
      war: (by) =>
        by > 0
          ? [
              in_(
                "War has been on their land these three years: they could see what it was for.",
                "War has been on its land these three years, and its workers went where they were wanted.",
              ),
            ]
          : [
              in_(
                "War has been on their land these three years, and every hand is wanted for that.",
                "War has been on its land these three years, and every worker is wanted for that.",
              ),
            ],
      threat: () => [
        in_(
          "Their realm is at war, though not yet here, and they know which way the road runs.",
          "Its realm is at war, though not yet here, and it has drawn its workers in close.",
        ),
      ],
      peace: () => [
        in_(
          "They have seen no war lately, and asked what the hurry was.",
          "It has seen no war lately, and its workers stay at what they were doing.",
        ),
      ],
      few: () => [
        in_("There are few of them for such a thing.", "It has few workers for such a thing."),
      ],
      long: () => [
        in_(
          "It would be years of their lives, and they said so.",
          "It would be years of its workers' lives.",
        ),
      ],
      asked: (by) => [
        in_(
          `They have been asked a lot lately, and it tells: ${by <= -60 ? "more than they think is fair" : "they remember the last time"}.`,
          "It has been asked a lot lately, and fewer workers come each time.",
        ),
      ],
      refusedLately: () => [
        in_(
          "They said no not long ago, and it has not been forgotten on either side.",
          "No workers came the last time, and nothing has changed since.",
        ),
      ],
      feared: () => [
        in_(
          "What fell on them not long ago is remembered, and they are afraid of who is asking.",
          "What fell on it not long ago has left it drawn in and wary.",
        ),
      ],
      blessed: () => [
        in_(
          "They remember what was given them, not long ago, and who gave it.",
          "It was given something not long ago, and more of its workers come for that.",
        ),
      ],
      devout: () => [in_("They are a devout people.", "It keeps its rites as one.")],
      faithless: () => [in_("They hold little to such things.", "It keeps no rites.")],
      crown: () => [
        in_(
          "It is their ruler's word, and it counts for something.",
          "The word is its ruler's, and that counts for something.",
        ),
      ],
      unrest: () => [
        in_(
          "Their realm has wars enough, and they have no more to give it.",
          "Its realm has wars enough, and it has no more workers to give.",
        ),
      ],
      little: () => [`It is a small thing in so great a place.`],
    };
  const said = new Set<AskWhyCode>();
  for (const [code, by] of a.why) {
    if (said.has(code)) continue;
    said.add(code);
    const l = words[code](by);
    if (l) lines.push(l);
  }
  if (!lines.length) lines.push(["Nothing moved them either way: it was an ordinary year."]);
  return lines;
}

/** What someone of the town says of it. */
function saidLine(world: World, a: Ask, p: Party | undefined): Line | null {
  if (!p) return null;
  const k = (hashString(a.event) >>> 0) % 3,
    hungry = foodAfter(world, a),
    thing = a.kind === "first" ? firstWords(world, a.what) : raiseThe(world, a.what),
    glad = [
      `"We wanted this before anyone asked. Now no one can say we shouldn't."`,
      `"It's good work, and it will be here after us."`,
      `"My children will see the use of it."`,
    ],
    grudged = [
      `"They ask, we do. No one asked what else wanted doing."`,
      `"It'll be done. ${sentenceCase(fieldsOf(world))} won't thank anyone."`,
      `"I've carried enough for ${thing.replace(/^its /, "the ")}. I'd like to see who asked come and carry some."`,
    ],
    half = [
      `"Some of us will. Some of us have children to feed."`,
      `"You can have what we can spare, and it isn't much."`,
      `"Half is what it gets. Let them ask the other half of someone else."`,
    ],
    no = [
      `"No. Not this year. Not with what we have."`,
      `"Let them ask again when we've eaten."`,
      `"We heard. We have other things to do."`,
    ],
    pick =
      a.answer === "glad"
        ? glad
        : a.answer === "grudged"
          ? grudged
          : a.answer === "half"
            ? half
            : no;
  if (a.form === "hive") return null;
  const said =
    hungry && hungry.after < hungry.before - 2 && a.what !== "food"
      ? `"We're short, and everyone knows why. It was ${a.kind === "first" ? `${thing.replace(/^its /, "the ")} before our bellies` : thing}."`
      : pick[k]!;
  return [link(p.name, p.ref), `, ${count(p.age)}, ${p.work}: ${said}`];
}

/** What their land ate before it was asked and since: hundredths of what it needed. */
function foodAfter(world: World, a: Ask): { before: number; after: number; year: number } | null {
  const ledger = populationContext(world).history.yearsOf(a.cell),
    y = yearOfMoment(a.t),
    before = ledger.findLast((r) => r.year <= y - 1),
    after = ledger.findLast((r) => r.year > y);
  return before && after
    ? { before: Math.round(before.fed / 10), after: Math.round(after.fed / 10), year: after.year }
    : null;
}

/** Those at work on it now: the same ones its site draws and anyone can press. */
export function crewOf(world: World, a: Ask): Party[] {
  const w = a.work;
  if (!w || w.done !== null || w.left) return [];
  return voices(world, { ...a, event: `${a.event}|crew` as never }, Math.min(8, w.hands));
}

/** The stuff of a way of walling, where its name isn't one. */
const WALL_STUFF: Readonly<Record<string, string>> = {
  burrow: "earth",
  "reef-walls": "coral",
  "shell-walls": "shell",
};

/** What a land's people build in, in a word: the walls of the homes they raise now. */
function builtOf(world: World, cell: number): string {
  const ctx = populationContext(world),
    land = ctx.provinces.get(cell),
    design = land
      ? designsOf(world)
          .list()
          .filter((d) => d.kind === "house" && d.owner === land.ref)
          .at(-1)
      : undefined,
    parts = design?.parts ?? (land ? houseFor(ctx, cell) : []),
    walls = parts.find((p) => p.role === "walls")?.id;
  return walls && walls !== "tent"
    ? (WALL_STUFF[walls] ?? walls.replace(/-/g, " "))
    : roadStuff(world, cell, "paved").short;
}

/** A site's words: who works, how far it has got, what it has taken, what stopped it. */
function siteBlocks(world: World, a: Ask): Block[] {
  const w = a.work;
  if (!w) return [];
  const ctx = populationContext(world),
    share = Math.min(1, w.worked / w.effort),
    now = world.now,
    stuff = builtOf(world, a.cell),
    tonnes = Math.round(w.effort * 1.5),
    lines: Line[] = [],
    grips = meansOfWorld(ctx.generated).grips,
    stoppedNow = w.stops.at(-1)?.to === null ? w.stops.at(-1)! : null;
  if (w.left) {
    lines.push([
      w.left.why === "empty"
        ? "No one is left to work on it. It was given up"
        : w.left.why === "taken"
          ? "The town went to another realm, and what was begun was given up"
          : "What stood of it came down, and it was given up",
      `, ${Math.round(share * 100)} in a hundred done, in year ${count(yearOfMoment(w.left.t))}.`,
    ]);
    return [{ type: "text", title: "🏚️ Given up", lines }];
  }
  if (w.done === null) {
    const crew = crewOf(world, a);
    const named: Span[] = [];
    crew.slice(0, 5).forEach((p, i) => {
      if (i) named.push(i === Math.min(crew.length, 5) - 1 ? " and " : ", ");
      named.push(link(p.name, p.ref));
    });
    lines.push([
      `${count(w.hands)} at work on it${crew.length ? ", among them " : ""}`,
      ...named,
      `${grips ? "" : ". They have no hands to grip with: it goes up by mouth and shoulder, half as slow again"}.`,
    ]);
    const left = (w.effort - w.worked) / w.hands;
    lines.push([
      `${Math.round(share * 100)} in a hundred done. ${stoppedNow ? "It will wait as long as this does." : `At this rate, ${MONTHS_WORD(left)} more.`}`,
    ]);
  } else {
    lines.push([
      `It took ${MONTHS_WORD((w.done - a.t) / MONTH)}, with ${count(w.hands)} at it, and was done in year ${count(yearOfMoment(w.done))}.`,
    ]);
  }
  lines.push([
    `${w.done === null ? "It wants" : "It wanted"} about ${count(tonnes)} tonnes of ${stuff}, ${grips ? "brought by hand" : "carried up"} from its yard. ${w.done === null ? "So far it has eaten" : "It ate"} ${count(w.food)} ${w.food === 1 ? "measure" : "measures"} of food out of what its land brought in, over what those hands would have eaten at home, and wore out ${count(w.tools)} ${w.tools === 1 ? "measure" : "measures"} of ${goodName(world, G.tools)}.`,
  ]);
  const stops = w.stops.filter((s) => s.to !== null || s.from < now);
  if (stoppedNow)
    lines.push([
      "Stopped: ",
      stoppedNow.why === "war"
        ? link("the fighting on this land", stoppedNow.ref)
        : stoppedNow.why === "quake"
          ? link("the ground's shaking", stoppedNow.ref)
          : "nothing left in store to feed those at it",
      " has them standing idle.",
    ]);
  else if (stops.length) {
    const lost = stops.reduce((n, s) => n + ((s.to ?? now) - s.from) / MONTH, 0);
    lines.push([
      `It has stood idle ${MONTHS_WORD(lost)} in all, last for ${STOP_WORD[stops.at(-1)!.why]}.`,
    ]);
  } else if (w.done === null) lines.push(["Nothing has stopped them yet."]);
  return [
    { type: "text", title: w.done === null ? "🏗️ The site" : "How it went up", lines },
    ...(a.what === "walls" ? wallWar(world, a) : []),
  ];
}

const STOP_WORD: Readonly<Record<string, string>> = {
  war: "the fighting on this land",
  quake: "the ground's shaking",
  food: "want of food to give those at it",
};

/** A wall that has stood in a war: the fights it counted in. */
function wallWar(world: World, a: Ask): Block[] {
  const w = a.work;
  if (!w || w.done === null) return [];
  const realm = politiesOf(world).of(a.cell),
    from = yearOfMoment(w.done),
    fights: Line[] = [];
  if (realm)
    for (const war of warsOf(world).fighting(realm.ref))
      for (const b of war.battles)
        if (b.land === a.cell && b.year >= from && fights.length < 4)
          fights.push([link(`The fight of year ${count(b.year)}`, b.event)]);
  const by = Math.round((a.share / 1000) * 35);
  return [
    {
      type: "text",
      title: "In war",
      lines: [
        [
          `Its land's defenders count for ${by < 1 ? "little more than they did: one town's ring means little to a land so full" : `${count(by)} in a hundred more`} for these walls.`,
        ],
        ...(fights.length ? fights : [["They have not yet been fought before."]]),
      ],
    },
  ];
}

/** What a priority did: more hands at it, food, what the board moved. */
function firstBlocks(world: World, a: Ask): Block[] {
  if (a.kind !== "first" || a.answer === "refused") return [];
  const now = world.now,
    going = a.until !== null && now < a.until,
    lines: Line[] = [],
    pull = ASK_PULL[a.answer],
    ate = foodAfter(world, a),
    m = marketsOf(world).get(a.cell),
    y = yearOfMoment(a.t);
  lines.push([
    going
      ? `${count(Math.round(pull * 100))} in a hundred of them are at ${firstWords(world, a.what)} now, until year ${count(yearOfMoment(a.until!))}.`
      : `It stood until year ${count(yearOfMoment(a.until!))}.`,
  ]);
  if (a.what !== "food")
    lines.push([
      `Those hands aren't in ${fieldsOf(world)}: ${count(Math.max(1, Math.round((pull * a.share) / 10)))} in a thousand of what `,
      landLink(world, a.cell, true),
      " would have brought in isn't.",
    ]);
  else
    lines.push([
      `More of them are in ${fieldsOf(world)}, and `,
      landLink(world, a.cell, true),
      ` brings in ${count(Math.max(1, Math.round((pull * 0.8 * a.share) / 10)))} in a thousand more for it.`,
    ]);
  if (ate)
    lines.push([
      `The year before it was asked, its land ate ${count(ate.before)} in a hundred of what it needed. In year ${count(ate.year)} it ate ${count(ate.after)}.${a.what !== "food" && ate.after < ate.before - 2 ? (a.form === "hive" ? " It is going short." : " They are going short, and they say so.") : ""}`,
    ]);
  const was = m?.years.findLast((r) => r.year <= y - 1),
    board = m?.years.at(-1);
  if (was && board && board.year > y)
    lines.push([
      `On `,
      link("the market board", boardRef(a.town)),
      `, ${goodName(world, G.grain)} stood at ${count(Math.round((board.price[G.grain]! / Math.max(1e-6, was.price[G.grain]!)) * 100))} in a hundred of what it was the year before they were asked.`,
    ]);
  return [{ type: "text", title: "What it has changed", lines }];
}

/** An ask's own page: who asked, who answered and why, what is going up, what came of it. */
export function askPage(world: World, ref: string): PageModel {
  const m = /^ask:(.+):(\d+)$/.exec(ref),
    ctx = populationContext(world),
    s = m ? ctx.settlements.get(m[1] as never) : undefined,
    a = m ? asksOf(world).ofTown(m[1]!)[Number(m[2])] : undefined;
  if (!s || !a) throw new Error(`no asking ${ref}`);
  const year = yearOfMoment(a.t),
    thing =
      a.kind === "first"
        ? `${sentenceCase(firstWords(world, a.what))} first`
        : sentenceCase(raiseName(world, a.what)),
    speakers = voices(world, a, 3),
    said = saidLine(world, a, speakers[2] ?? speakers[0]),
    realm = a.by ? politiesOf(world).get(a.by.realm) : undefined,
    blocks: Block[] = [
      {
        type: "text",
        title: "What was asked",
        lines: [
          [
            a.by ? `${a.by.ruler}${realm ? ` of ` : ""}` : "You asked ",
            ...(a.by && realm ? [realmLink(world, realm.ref)] : []),
            a.by ? " asked " : "",
            townLink(world, s.ref),
            a.kind === "first"
              ? ` to put ${firstWords(world, a.what)} first`
              : ` for ${raiseName(world, a.what)}`,
            `, in year ${count(year)}, when it held ${count(a.people)}.`,
          ],
          ...(a.kind === "raise" && a.what !== "walls"
            ? [[`It is ${CIVIC_FOR[a.what as CivicKind]}.`] as Line]
            : []),
        ],
      },
      {
        type: "text",
        title: `Their answer: ${ANSWER_WORD[a.answer]}`,
        lines: answerLines(world, a),
      },
      { type: "text", title: "Why", lines: whyLines(world, a) },
      ...siteBlocks(world, a),
      ...firstBlocks(world, a),
      ...(said ? [{ type: "text" as const, title: "What they say of it", lines: [said] }] : []),
    ];
  const place = a.work
    ? { scale: "village" as const, town: s.ref, site: ref }
    : { scale: "village" as const, town: s.ref };
  return {
    ref,
    kind: "ask",
    icon: a.answer === "refused" ? "🙅" : a.work ? (a.work.done !== null ? "🏛️" : "🏗️") : "🙏",
    title:
      a.work && a.work.done === null && !a.work.left
        ? `${sentenceCase(raiseThe(world, a.what))} going up in ${s.name}`
        : `What ${s.name} was asked`,
    subtitle: [thing, `, year ${count(year)}, `, ANSWER_WORD[a.answer]],
    color: null,
    place,
    stats: [
      stat("Town", [townLink(world, s.ref)]),
      stat("Asked", `year ${count(year)}`),
      stat("Answer", ANSWER_WORD[a.answer]),
      ...(a.work
        ? [
            stat(
              "Done",
              `${Math.round(Math.min(1, a.work.worked / a.work.effort) * 100)} in a hundred`,
            ),
          ]
        : []),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: yearNow(world),
  };
}

/** A building or walls raised at the asking: its own words on its page. */
export function askedBlocks(
  world: World,
  town: string,
  at: number,
  start: number,
): { blocks: Block[]; ref: string; going: boolean; left: boolean } | null {
  const a = asksOf(world).raised(town, at, start);
  if (!a) return null;
  const lines: Line[] = [
    [
      `${a.work?.done !== null ? "Raised" : "Being raised"} because ${a.by ? `${a.by.ruler} asked` : "you asked"}, in year ${count(yearOfMoment(a.t))}. `,
      link("What was asked, and who answered", askRef(a)),
      ".",
    ],
  ];
  return {
    ref: askRef(a),
    going: a.work?.done === null && !a.work?.left,
    left: !!a.work?.left,
    blocks: [{ type: "text", title: "🙏 Asked for", lines }, ...siteBlocks(world, a)],
  };
}

/** What a town was asked, for its page (none: nothing). */
export function askedTownBlock(world: World, town: string): Block | null {
  const list = asksOf(world).ofTown(town);
  if (!list.length) return null;
  return {
    type: "list",
    title: "What it has been asked",
    items: [...list]
      .reverse()
      .slice(0, 8)
      .map((a) => item([askShort(world, a)], askRef(a), yearOfMoment(a.t))),
  };
}

/** What a town's plan carries of a building it was asked for (none: nothing). */
export function askedOfCivic(
  world: World,
  town: string,
  c: { at: number; start: number; lots: number; kind: string },
): { asked?: TownAsked } {
  const a = asksOf(world).raised(town, c.at, c.start);
  return a ? { asked: readAsked(world, a) } : {};
}

/** What a plan carries of its walls, if they were asked for. */
export function askedOfWalls(world: World, town: string): { asked?: TownAsked } {
  const a = asksOf(world).raised(town, -1, 0);
  return a ? { asked: readAsked(world, a) } : {};
}

const HEAP: readonly [number, number, number] = [0.62, 0.58, 0.5];

function readAsked(world: World, a: Ask): TownAsked {
  const w = a.work!,
    now = world.now,
    share = Math.min(1, w.worked / w.effort),
    stopped = w.stops.at(-1)?.to === null,
    left = !!w.left,
    stuff = roadStuff(world, a.cell, "paved");
  return {
    ref: askRef(a),
    name: raiseThe(world, a.what),
    began: a.t,
    done: w.done ?? now + (((w.effort - w.worked) / w.hands) * MONTH + (stopped ? YEAR : 0)),
    read: now,
    share,
    stopped,
    left,
    hands: w.hands,
    crew: crewOf(world, a).map((p) => p.ref),
    heap: stuff.colour ? [stuff.colour[0], stuff.colour[1], stuff.colour[2]] : HEAP,
  };
}

const DOING: Readonly<Record<AskFirst, string>> = {
  food: "out at the food, as the town was asked",
  stores: "carrying to the stores, as the town was asked",
  homes: "at the homes, as the town was asked",
  walls: "carrying to the walls, as the town was asked",
  arms: "at the making of arms, as the town was asked",
  trade: "at the market, as the town was asked",
  faith: "at prayer, as the town was asked",
  learning: "at their letters, as the town was asked",
};

/** What a town's plan carries of what it was asked to put first (none: nothing). */
export function firstOfPlan(world: World, town: string): { first?: TownFirst } {
  const a = asksOf(world).firstOf(town, world.now);
  if (!a) return {};
  return {
    first: {
      what: a.what,
      pull: ASK_PULL[a.answer],
      until: a.until!,
      doing: DOING[a.what as AskFirst],
      page: askRef(a),
    },
  };
}

/** What about a town's asks has changed that a plan read now would show (town.asked): its plan is read again when it moves. */
export function askedKey(world: World, town: string): string {
  const parts: string[] = [];
  for (const a of asksOf(world).ofTown(town)) {
    const w = a.work,
      stopped = w?.stops.at(-1)?.to === null;
    parts.push(`${a.n}:${w?.done !== null}:${!!w?.left}:${stopped}:${a.until ?? 0}`);
  }
  return parts.join("|");
}
