// What each of the town mode's sheets, tabs and pages is, in plain words (G2): what it is, what its numbers mean, and
// what you can do there. A "?" on every sheet and on the inspector opens the one for what is shown, as a page of the
// inspector's own, so Back comes to where you were. The same for every town: words only. And the game's words (U6), a
// glossary of what a player meets, each in one plain line: from ≡ and from the foot of every help page, which names a
// few of the words it uses.
import {
  placeBeastsRef,
  placeBelowRef,
  placeBoundRef,
  placeCivicRef,
  placeFaithRef,
  placeGateRef,
  placeHelpRef,
  placeLegendsRef,
  placeLevelsRef,
  placeMakingRef,
  placeTownRef,
  type PlaceInspectHelp,
  type PlaceInspectTown,
} from "../bridge/index.ts";

type Help = {
  readonly title: string;
  readonly what: string;
  readonly numbers: readonly (readonly [string, string])[];
  readonly can: readonly string[];
};

/** Every topic, by its key: a sheet (`sheet:`), a person's tab (`tab:`), a page (`page:`), and the town itself. */
export const HELP: Readonly<Record<string, Help>> = {
  town: {
    title: "Town mode",
    what: "You are inside one town of the world, watching its people live their day hour by hour. Whatever you do here stays in this town until you leave it.",
    numbers: [
      ["The clock", "The time of day in the town. ⏸ stops it; the other keys run it faster."],
      ["The signs on the right", "Alerts: what needs you now. Red is the worst."],
    ],
    can: [
      "Tap anyone or any building to open its page.",
      "Use the tabs at the foot for the town as a whole.",
      "🏘️ Town at the foot lists the town's own pages: below ground, its legends, its gate and more.",
      "≡ holds the lessons, how the town is run, the game's words, and leaving it.",
      "Hold a finger on any key a moment to read what it does; on a desk, rest the pointer on it.",
    ],
  },
  glossary: {
    title: "The game's words",
    what: "The words the town's pages use, each in one plain line, A to Z.",
    numbers: [],
    can: [
      "‹ Back goes to the page you came from.",
      "Hold a finger on any key a moment to read what it does.",
    ],
  },
  "page:townpages": {
    title: "The town's own pages",
    what: "Everything told of the town as a whole, each a tap away: what lies below it, its legends, who comes to its gate, its bound, its faith, what it lives on, its works and orders, its beasts.",
    numbers: [],
    can: [
      "Tap a row to open that page; ‹ Back comes here again.",
      "🏘️ Town at the foot, or Town in ≡, brings this list back.",
    ],
  },
  "sheet:people": {
    title: "People",
    what: "Everyone who lives in the town, with what each is doing now.",
    numbers: [
      [
        "Mood",
        "From −100 to +100. Below the red tick on a person's page, they stop doing as they are told.",
      ],
      ["The bars", "How hungry, tired, cold and lonely each is: the fuller, the more it presses."],
      [
        "Urgent",
        "What most wants you in each: in want, abed, too unhappy to follow orders, a need near full.",
      ],
      ["41–60 of 212", "Which of all those shown this page holds. A page holds sixty."],
      ["▲ and ▼", "The way the list is ordered: ▲ smallest first (A to Z), ▼ largest first."],
    ],
    can: [
      "Tap a name to open their page.",
      "Pick a trade to see only those who work at it.",
      "Type in Find by name to see only those whose name has it.",
      "Tap Name, Urgent, Trade, Mood or Age over the list to order it by that; tap it again for the other way.",
      "Group puts them under a head each by household, street, trade or skill, with how many are in it.",
      "Idle, Sick or hurt, Unhappy, No home and Under arms show only those; tap again to see everyone.",
      "Pick many, tap rows to pick them (or Pick all on this page), then give one order to all of them: a trade, a draft, stand down, pin. It says how many took it, and why any did not.",
    ],
  },
  "sheet:stocks": {
    title: "Stocks",
    what: "What the town holds in its stores and its granary, and how long each thing will last.",
    numbers: [
      [
        "Lasts",
        "How many days each thing would last at the rate the town uses it today. Red is under a month.",
      ],
      [
        "Held",
        "How much there is: food in months' food (what one person eats in a month), everything else in units.",
      ],
      ["Today", "What came in and went out today."],
    ],
    can: [
      "Hold food back in the granary.",
      "Stop the market from selling something.",
      "Set bills: how much of a thing to keep made.",
    ],
  },
  "sheet:work": {
    title: "Work",
    what: "Who works at what: the fields, the herds, the crafts, hauling, building.",
    numbers: [
      ["Hands", "How many work at each."],
      ["Your aim", "The share of the town's grown people you want at each."],
      [
        "The grid",
        "The big number is a priority: 1 first, 3 last, – never. The small one is skill: 0 new to it, 4 a master.",
      ],
    ],
    can: [
      "Move the shares to put more hands where they are needed.",
      "Open the grid to set each person's priorities.",
      "Find someone in the grid by name, and page through it with Prev and Next.",
    ],
  },
  "sheet:build": {
    title: "Build",
    what: "What the town could put up now, what each would take, and what is going up already.",
    numbers: [["What it takes", "The people and the stuff a building needs before it stands."]],
    can: [
      "Ask for a building: its people start on it.",
      "Tap a building going up to see how far it has got.",
    ],
  },
  "sheet:dangers": {
    title: "Dangers",
    what: "What threatens the town now (fire, sickness, war, hunger) and who has been hurt.",
    numbers: [["The hurt", "Those lying abed now, and with what."]],
    can: ["Hold the town to an answer: firebreaks, keeping the sick apart, mustering its people."],
  },
  "sheet:log": {
    title: "Log",
    what: "What has happened in the town since you came in, newest first.",
    numbers: [["The hour", "When on that day it happened."]],
    can: ["Tap a name to open their page, even if they have died or left."],
  },
  "tab:now": {
    title: "Now",
    what: "What this person is doing at this moment and why, how they feel, and what they need.",
    numbers: [
      ["Mood", "From −100 to +100. Below the red tick they stop heeding orders."],
      [
        "The need bars",
        "Hunger, tiredness, cold, want of company and comfort: 0% wants nothing, 100% can bear no more. Past its white tick a need comes before their work.",
      ],
    ],
    can: [
      "Why? ▸ shows every step behind what they do.",
      "Give them orders (Orders ▾).",
      "🎯 Follow keeps the view on them and has their day worked out in full; tap it again to let them go.",
    ],
  },
  "tab:mood": {
    title: "Mood",
    what: "Everything that cheers this person or weighs on them right now, and their mood as it all adds up.",
    numbers: [
      ["The bar", "Their mood, from −100 to +100. Below the red tick they stop heeding orders."],
      ["+ and −", "How much each thing lifts or lowers their mood."],
      ["Days", "How much longer it will last."],
    ],
    can: ["Tap who or what a feeling came from to open them."],
  },
  "tab:health": {
    title: "Health",
    what: "Their wounds and sickness, how each part of them is, and their body: what it is made of, how it lives, what it is written in.",
    numbers: [
      ["Each part", "Whole, hurt, or lost."],
      ["%", "Rough shares of their weight, by what their body is made of."],
    ],
    can: ["See who is tending them, and what they have taken."],
  },
  "tab:skills": {
    title: "Skills",
    what: "What this person is good at and how many hours they have put into each; then their character: traits, wants and mind.",
    numbers: [
      [
        "Hours",
        "Time spent at it: a hand at 200 hours, able at 800, skilled at 2,000, a master at 8,000.",
      ],
      ["★", "Taught at home as they grew: they took to it early."],
      ["Leanings", "Each against most of their people: 100 is as most are."],
    ],
    can: ["Put them to the work they are best at, from Orders."],
  },
  "tab:social": {
    title: "Social",
    what: "Their family, kin and household, then everyone else they know and what they think of each: friends, rivals.",
    numbers: [["Regard", "From hatred to love: how they feel about that person."]],
    can: ["Tap anyone to open them."],
  },
  "tab:gear": {
    title: "Gear",
    what: "What they hold and wear, and what it is made of.",
    numbers: [
      ["Worn", "How used up each thing is: 0% new; at 100% it is worn out and stops working."],
      ["kg", "How heavy all they hold is, by what it is made of."],
    ],
    can: ["Tap a thing to open its page."],
  },
  "tab:life": {
    title: "Life",
    what: "Their story: what has happened to them since you came in, newest first.",
    numbers: [],
    can: ["Their family is on Social, their character on Skills, their body on Health."],
  },
  "tab:work": {
    title: "Work",
    what: "Their trade, where they work and live, their hand at it, and their day: when they work, play and rest.",
    numbers: [
      ["Their hand at it", "How skilled they are at their own work."],
      ["Their day", "Each hour of today: at work, at play, or at home."],
    ],
    can: ["Open their home or their workplace."],
  },
  "page:person": {
    title: "A person",
    what: "One of the town's people.",
    numbers: [],
    can: [
      "Use the tabs to read about them; Orders to direct them.",
      "🎯 Follow keeps the view on them and has their day worked out in full.",
    ],
  },
  "page:lot": {
    title: "A building or a lot",
    what: "What stands here, who lives or works in it, and what it holds.",
    numbers: [["Units", "How much of each thing it holds."]],
    can: [
      "Look inside.",
      "Make it a meeting place or keep it clear.",
      "Stop its work, or post the guard here.",
    ],
  },
  "page:inside": {
    title: "Inside",
    what: "The rooms of a building, laid out from above, and who is in them.",
    numbers: [],
    can: ["Tap someone inside to open them."],
  },
  "page:item": {
    title: "A thing",
    what: "One thing someone holds: what it is made of, who made it, how worn it is.",
    numbers: [["Worn", "At 100% it stops working."]],
    can: [],
  },
  "page:fields": {
    title: "The fields",
    what: "The town's fields and flock, and who is out working them.",
    numbers: [],
    can: ["Tap someone in the fields to open them."],
  },
  "page:below": {
    title: "Below the town",
    what: "The ground under the town, what has been dug from it, and where its water comes from.",
    numbers: [["mm of rain", "How much rain falls on its land in a year."]],
    can: [],
  },
  "page:work": {
    title: "A work",
    what: "Something fine the town made and keeps: who made it, and what it shows.",
    numbers: [],
    can: ["Open its maker."],
  },
  "page:legends": {
    title: "Its works and legends",
    what: "The fine things the town keeps, and the stories they tell.",
    numbers: [],
    can: ["Open each work."],
  },
  "page:gate": {
    title: "The gate",
    what: "Who comes to the town: traders, envoys, newcomers, raiders.",
    numbers: [],
    can: ["Shut the gate to newcomers, or open it."],
  },
  "page:family": {
    title: "Family",
    what: "A person's family: parents, partner, children, and the dead among them. Their Social tab shows it too.",
    numbers: [],
    can: ["Tap anyone to open them."],
  },
  "page:bound": {
    title: "The bound",
    what: "Captives and those held by the town's justice.",
    numbers: [],
    can: ["Free someone by your word."],
  },
  "page:faith": {
    title: "Faith and rank",
    what: "The town's faith, its holy places, and those of rank.",
    numbers: [],
    can: [],
  },
  "page:dead": {
    title: "One of the dead",
    what: "Someone who died here, as the town remembers them.",
    numbers: [],
    can: ["Open their family and friends."],
  },
  "page:character": {
    title: "Character",
    what: "A person's traits, best skills, what they want, and how their mind works. Their Skills tab shows it too.",
    numbers: [["The bars", "How they lean, against most of their people: 100 is as most are."]],
    can: [],
  },
  "page:body": {
    title: "Body",
    what: "What a person's body is made of and how it lives, as their world made it. Their Health tab shows it too.",
    numbers: [["%", "Rough shares of their weight, by what their body is made of."]],
    can: [],
  },
  "page:making": {
    title: "What it lives on",
    what: "What the town holds, makes, drinks and burns, and what it is short of.",
    numbers: [["kg", "How much it holds, by what it is made of."]],
    can: [],
  },
  "page:civic": {
    title: "Its works and orders",
    what: "What is being built, what the town may learn next, and every order you have given it.",
    numbers: [["%", "How far each building has got."]],
    can: ["Open a building going up."],
  },
  "page:whatnow": {
    title: "What now?",
    what: "The few things most worth doing next in this town, the most pressing first, read off the town as it stands now.",
    numbers: [],
    can: [
      "🎯 Go to: send the eye to where it is.",
      "Open ▸: open its page.",
      "A sheet's key: open the sheet where it is done.",
    ],
  },
  "page:why": {
    title: "Why?",
    what: "Why this person is doing what they do now, step by step: the reason, with the numbers that decided it, and what lies behind it in the town.",
    numbers: [
      [
        "The numbers",
        "What weighed most when they chose: the higher, the more it pressed on them.",
      ],
    ],
    can: ["Tap a step to open its page.", "🎯 or 📍: send the eye to the person or the place."],
  },
  "page:levels": {
    title: "The ground, level by level",
    what: "The ground under the town from the soil down: its graves and wells, the water, then each depth its mines are dug to.",
    numbers: [["Shaded", "A level deeper than this land can dig yet."]],
    can: ["▲ and ▼: go up or down a level.", "📍: send the eye to where something is dug."],
  },
  "page:beasts": {
    title: "Beasts and power",
    what: "The town's herds and the wild beasts it could keep, who keeps them and how well, what pulls and carries for it, and what drives its work.",
    numbers: [["Trained", "How well a keeper knows the herds, from their hours with them."]],
    can: [
      "Open a keeper's page.",
      "See which kinds of power this land knows, and which it does not yet.",
    ],
  },
};

/**
 * The game's words (U6), each in one plain line: what a player meets on the town's pages and keys, said once here so no
 * page need say it again. Each with its key (the glossary opened at it), and where a help page uses the word, what finds
 * it there (`finds`: only the words a player would stop at; mood, say, is on every page and is linked from none).
 */
export const GLOSSARY: readonly {
  readonly key: string;
  readonly word: string;
  readonly line: string;
  readonly finds?: RegExp;
}[] = [
  {
    key: "abed",
    word: "Abed",
    line: "Lying in bed hurt or sick: they do no work until they are well.",
    finds: /\babed\b/i,
  },
  {
    key: "alert",
    word: "Alert",
    line: "A sign down the right: something wants you. Red is danger, amber is to see to, grey is worth knowing.",
  },
  {
    key: "answers",
    word: "Answers",
    line: "Standing orders the town is held to against a danger: a fire watch, the sick kept apart, grain put by, a call to arms.",
    finds: /an answer|firebreaks|keeping the sick apart/i,
  },
  {
    key: "bills",
    word: "Bills",
    line: "How much of a good the town keeps made: its makers stop at that, and turn to the next good billed.",
    finds: /\bbills?\b/i,
  },
  {
    key: "bleeding",
    word: "Bleeding",
    line: "A wound not yet dressed loses blood every ten minutes, until a healer or one of their own dresses it.",
  },
  {
    key: "bound",
    word: "Bound",
    line: "Held by the town: a captive, or one its justice holds. Your word can free one.",
    finds: /\bbound\b|captives/i,
  },
  {
    key: "broken",
    word: "Broken down",
    line: "One whose mood fell past bearing: for a while they lash out, eat all in sight, pray or wander.",
  },
  {
    key: "drafted",
    word: "Drafted",
    line: "Put under arms by name: they stand where you told them, whatever the rest do, until stood down.",
    finds: /\bdraft/i,
  },
  {
    key: "festering",
    word: "Festering",
    line: "A wound gone bad: it worsens without a healer's remedies, and can kill.",
  },
  {
    key: "follow",
    word: "Follow (🎯)",
    line: "Keeps the eye with one person as they go, and has their day worked out in full detail.",
  },
  {
    key: "full",
    word: "Worked out in full detail",
    line: "A day the town works out ten minutes at a time, for those you look at, follow or pin; the rest hour by hour or every three hours. Nothing they do is lost.",
    finds: /in full/i,
  },
  {
    key: "gate",
    word: "The gate",
    line: "Where traders, envoys, newcomers and raiders come to the town. It can be shut to newcomers.",
  },
  {
    key: "granary",
    word: "Granary",
    line: "The town's store of grain: food held back there is kept for leaner days.",
    finds: /granary/i,
  },
  {
    key: "head",
    word: "The head",
    line: "One of the town's own people, who runs it when you choose 🏛: they give the orders a player would, each in the Log with why.",
    finds: /its head|the head/i,
  },
  {
    key: "household",
    word: "Household",
    line: "Those who live under one roof and eat from one pantry.",
  },
  {
    key: "hours",
    word: "Hours at a skill",
    line: "Time spent at a work: a hand at 200 hours, able at 800, skilled at 2,000, a master at 8,000.",
  },
  {
    key: "leanings",
    word: "Leanings",
    line: "How a person leans, against most of their people: 100 is as most are.",
  },
  {
    key: "lot",
    word: "Lot",
    line: "A plot of the town's ground with a number: a home, a workshop, a field's edge, or bare.",
    finds: /\blots?\b/i,
  },
  {
    key: "months",
    word: "Months' food",
    line: "What one person eats in a month: how the town's food is counted.",
    finds: /months' food/i,
  },
  {
    key: "mood",
    word: "Mood",
    line: "How someone feels, from −100 to +100: what cheers them and what weighs on them, added up. Their Mood tab lists each reason, its size and how long it lasts.",
  },
  {
    key: "needs",
    word: "Needs",
    line: "Hunger, tiredness, cold, want of company and comfort: 0% wants nothing, 100% can bear no more. Past a bar's white tick, the need comes before their work.",
  },
  {
    key: "unheeding",
    word: "Not heeding orders",
    line: "Below the red tick on the mood bar a person no longer does as they are told, till their mood comes up.",
    finds: /heeding orders|heed orders|follow orders|doing as they are told/i,
  },
  {
    key: "overlay",
    word: "Overlay (🗺)",
    line: "A colour laid on the town's lots for one thing (needs, mood, room, work, age, danger), to see where it is worst.",
  },
  {
    key: "pace",
    word: "Pace",
    line: "How fast the town's clock runs: ⏸ stops it; 1 min/s is a minute of its day each second.",
  },
  {
    key: "pin",
    word: "Pin (📌)",
    line: "Keeps someone on the people bar, their day worked out in full, until you let them go.",
    finds: /\bpin\b|pinned/i,
  },
  {
    key: "priorities",
    word: "Priorities",
    line: "What each person turns to first when they are free to choose: 1 first, 3 last, – never. Set on the Work sheet's grid.",
    finds: /priorit/i,
  },
  {
    key: "regard",
    word: "Regard",
    line: "How one feels about another, from hatred to love.",
  },
  {
    key: "shares",
    word: "Shares",
    line: "The part of the town's grown people you want at each trade: the fields, the herds, the crafts, hauling.",
    finds: /\bshares\b/i,
  },
  {
    key: "sheet",
    word: "Sheet",
    line: "A list at the foot of the screen: People, Stocks, Work, Build, Dangers, Log.",
  },
  {
    key: "site",
    word: "Site",
    line: "A lot where a building is going up: how far it has got is on its page.",
  },
  {
    key: "take",
    word: "Taking over",
    line: "An order of yours on a matter the head had set: from then on the head leaves that matter to you, and says so in the Log.",
  },
  {
    key: "townpages",
    word: "The town's own pages",
    line: "Pages of the town as a whole: below ground, its legends, its gate, the bound, faith, what it lives on, its works and orders, its beasts.",
  },
  {
    key: "arms",
    word: "Under arms",
    line: "Called to arms against a siege or a raid: its grown leave their work to stand with the guard.",
    finds: /under arms|mustering|to arms/i,
  },
  {
    key: "watch",
    word: "Watching",
    line: "A way to play with no orders: the eye is led to what happens, and the line at the foot says who it is with and why.",
  },
  {
    key: "zone",
    word: "Zone",
    line: "A building made a meeting place for those near, or kept clear so that no one goes there but to a fire.",
    finds: /meeting place|kept? clear/i,
  },
];
/** How many of the game's words a help page links at most (U6: kept light). */
const GLOSSED_MOST = 3;

/**
 * The town's own pages listed (U3): before, only a tap on its square's open ground led to them. Words and refs alone, the
 * same for every town: nothing of the world is read, and no place is made by asking.
 */
export function placeTownPages(town: string): PlaceInspectTown {
  return {
    kind: "townpages",
    ref: placeTownRef(town),
    name: "The town's own pages",
    icon: "🏘️",
    sub: "Each a tap away; ‹ Back comes here again",
    pages: [
      {
        icon: "⛏️",
        name: "Below ground",
        words: "What lies under the town, what is dug, and the water it draws",
        ref: placeBelowRef(town),
      },
      {
        icon: "🪜",
        name: "Its ground, level by level",
        words: "Each depth of its ground, and what is dug at each",
        ref: placeLevelsRef(town),
      },
      {
        icon: "📜",
        name: "Its legends",
        words: "Its works, its battles, the seldomest of what befell it",
        ref: placeLegendsRef(town),
      },
      {
        icon: "🚪",
        name: "At the gate",
        words: "Who has come to the town, and who comes",
        ref: placeGateRef(town),
      },
      {
        icon: "⛓️",
        name: "The bound",
        words: "Its captives, and those its justice holds",
        ref: placeBoundRef(town),
      },
      {
        icon: "⛩️",
        name: "Faith and rank",
        words: "Its faith, its shrines, and those of rank",
        ref: placeFaithRef(town),
      },
      {
        icon: "⚗️",
        name: "What it lives on",
        words: "What it holds, makes, drinks and burns, and what it is short of",
        ref: placeMakingRef(town),
      },
      {
        icon: "🏛️",
        name: "Its works and orders",
        words: "What it is raising, what it may find next, your standing orders",
        ref: placeCivicRef(town),
      },
      {
        icon: "🐂",
        name: "Beasts and power",
        words: "Who keeps its flock, what pulls for it, what drives its works",
        ref: placeBeastsRef(town),
      },
    ],
  };
}

/** The topic for what a sheet, a tab or a page is (G2): its own, else the town's. */
export function helpTopic(of: string): string {
  return HELP[of] ? of : "town";
}

/**
 * A help page (G2), for its topic; the glossary's (U6) opened at one of its words where the topic says which
 * ("glossary#bills"). Each page but the glossary names a few of the game's words it uses, each a tap from its line.
 */
export function placeHelp(town: string, topic: string): PlaceInspectHelp {
  const [asked = "", at] = topic.split("#"),
    key = helpTopic(asked),
    h = HELP[key]!;
  if (key === "glossary") {
    const lit = at && GLOSSARY.some((g) => g.key === at) ? at : null;
    return {
      kind: "help",
      ref: placeHelpRef(town, lit ? `${key}#${lit}` : key),
      topic: key,
      name: h.title,
      icon: "📖",
      sub: `${GLOSSARY.length} words, each in a line`,
      what: h.what,
      numbers: [],
      can: h.can,
      words: [...GLOSSARY]
        .sort((a, b) => a.word.localeCompare(b.word))
        .map(({ key, word, line }) => ({ key, word, line })),
      lit,
    };
  }
  const said = [h.what, ...h.numbers.flat(), ...h.can].join(" ");
  return {
    kind: "help",
    ref: placeHelpRef(town, key),
    topic: key,
    name: `What is this? ${h.title}`,
    icon: "❔",
    sub: "In plain words",
    what: h.what,
    numbers: h.numbers,
    can: h.can,
    glossed: GLOSSARY.filter((g) => g.finds?.test(said))
      .slice(0, GLOSSED_MOST)
      .map(({ key, word }) => ({ key, word })),
  };
}
