// What each of the town mode's sheets, tabs and pages is, in plain words (G2): what it is, what its numbers mean, and
// what you can do there. A "?" on every sheet and on the inspector opens the one for what is shown, as a page of the
// inspector's own, so Back comes to where you were. The same for every town: words only.
import { placeHelpRef, type PlaceInspectHelp } from "../bridge/index.ts";

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
      "≡ holds the lessons, how the town is run, and leaving it.",
    ],
  },
  "sheet:people": {
    title: "People",
    what: "Everyone who lives in the town, with what each is doing now.",
    numbers: [
      [
        "Mood",
        "From -100 to 100. Below the line on a person's page, they stop doing as they are told.",
      ],
      ["The bars", "How hungry, tired, cold and lonely each is: the fuller, the more it presses."],
    ],
    can: ["Tap a name to open their page.", "Pick a trade to see only those who work at it."],
  },
  "sheet:stocks": {
    title: "Stocks",
    what: "What the town holds in its stores and its granary, and how long its food will last.",
    numbers: [
      [
        "Days",
        "How many days each thing would last at the rate the town uses it. Red is under a month.",
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
      ["%", "The share of the town's grown people you want at each."],
    ],
    can: [
      "Move the shares to put more hands where they are needed.",
      "Open the grid to set each person's priorities.",
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
    what: "What this person is doing at this moment, and why.",
    numbers: [
      [
        "The four bars",
        "Hunger, tiredness, cold and loneliness. When one passes its mark, it beats their work.",
      ],
      ["Mood", "From -100 to 100, with the line below which they stop heeding orders."],
    ],
    can: ["Give them orders (Orders ▾).", "🎯 keeps the view on them."],
  },
  "tab:mood": {
    title: "Mood",
    what: "Everything that cheers this person or weighs on them right now.",
    numbers: [
      ["+ and -", "How much each thing lifts or lowers their mood."],
      ["Days", "How much longer it will last."],
    ],
    can: ["Tap who or what a feeling came from to open them."],
  },
  "tab:health": {
    title: "Health",
    what: "Their body: wounds, sickness, and how each part of them is.",
    numbers: [["Each part", "Whole, hurt, or lost."]],
    can: ["See who is tending them, and what they have taken."],
  },
  "tab:skills": {
    title: "Skills",
    what: "What this person is good at, and how many hours they have put into each.",
    numbers: [
      ["Hours", "Time spent at it. More hours, more skill."],
      ["A passion", "They learn it faster, and like doing it."],
    ],
    can: ["Put them to the work they are best at, from Orders."],
  },
  "tab:social": {
    title: "Social",
    what: "Who they know, and what they think of each: friends, rivals, family.",
    numbers: [["Regard", "From hatred to love: how they feel about that person."]],
    can: ["Tap anyone to open them."],
  },
  "tab:gear": {
    title: "Gear",
    what: "What they hold and wear, and what it is made of.",
    numbers: [
      ["Worn", "How used up each thing is. At 100% it stops working."],
      ["kg", "How heavy all they hold is, by what it is made of."],
    ],
    can: ["Tap a thing to open its page."],
  },
  "tab:life": {
    title: "Life",
    what: "Their story: family, home, and what has happened to them since you came in.",
    numbers: [],
    can: ["Open their family, their character or their body from their page."],
  },
  "tab:work": {
    title: "Work",
    what: "Their trade, where they work and live, and their temper and nature.",
    numbers: [["Their hand at it", "How skilled they are at their own work."]],
    can: ["Open their home or their workplace."],
  },
  "page:person": {
    title: "A person",
    what: "One of the town's people.",
    numbers: [],
    can: ["Use the tabs to read about them; Orders to direct them."],
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
    what: "A person's family: parents, partner, children, and the dead among them.",
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
    what: "A person's traits, best skills, what they want, and how their mind works.",
    numbers: [["The bars", "How they lean, against most of their people."]],
    can: [],
  },
  "page:body": {
    title: "Body",
    what: "What a person's body is made of and how it lives, as their world made it.",
    numbers: [["%", "Rough shares of what their body is made of."]],
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
};

/** The topic for what a sheet, a tab or a page is (G2): its own, else the town's. */
export function helpTopic(of: string): string {
  return HELP[of] ? of : "town";
}

/** A help page (G2), for its topic. */
export function placeHelp(town: string, topic: string): PlaceInspectHelp {
  const key = helpTopic(topic),
    h = HELP[key]!;
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
  };
}
