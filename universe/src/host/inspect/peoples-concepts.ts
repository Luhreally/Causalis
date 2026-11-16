// The book of concepts on a people's mind (round "peoples", 2026-11-15): its ways and what makes them, who reads among it, and
// how it comes to know what lies deep. Each says how the world works it, as it does.
import type { Concept } from "./concepts.ts";

export const PEOPLES_CONCEPTS: Readonly<Record<string, Concept>> = {
  ways: {
    icon: "🧭",
    title: "A people's ways",
    what: [
      "A people's ways are eight leanings, each between two ends: kinship, rank, piety, valour, trade, openness, custom and thrift. None begins in the middle: a people's first ways come of its body and its land.",
      "Of its body: how fast it lives (many young and a short life lean to daring and away from thrift), how many of its kind it lives among (rank and kinship), whether its young are carried, laid or spawned (care), what it eats (hunters lean to valour), whether it lives in the water, and how it knows its own (by scent, kin are close and strangers far).",
      "Of its land: how hard its seasons turn (thrift and custom), how much the land gives (plenty makes it less thrifty and less bound to kin), how sure its rain is (piety), how sickly it is, how rugged (valour; rank is hard to hold in the hills), and whether it lies on a shore or a river (trade, openness).",
      "Then a people changes them by what it sees fare well: each decade it weighs, its own and its nearest neighbours', whether those who held a way the more grew and were fed the better. A belief held firmly draws its ways toward it; a belief half-held barely moves them. Hunger presses thrift, the god's hand presses piety, and what it comes to know presses custom.",
    ],
    drives: [
      "Body, land, what fared well among it and its neighbours, hunger, the god's hand, its faith.",
    ],
    leads: [
      "How its realms are held (the four numbers of a realm begin from its ways).",
      "What it finds and learns, what it trades, how it fights, whom it marries and makes war on, how it treats the bound.",
    ],
    see: [{ text: "The peoples of the world", ref: "world:peoples" }],
    related: ["faith", "lore", "letters", "realms"],
  },
  letters: {
    icon: "📖",
    title: "Reading and writing",
    what: [
      "Once a land has a script, those whose work wants letters read: all who rule, half its traders, a tenth of its makers.",
      "Of those its fields can spare, as many as are taught: where a school or a house of higher learning stands, all of them; where none does, a tenth. The more where word moves freely in its realm, and where its faith holds its teaching written.",
      "No land reads at once: a generation brings it most of the way to what its teaching reaches, as the old who read die and the young are taught. A land that loses its script loses its readers as they die.",
    ],
    drives: ["A script; rulers, traders and makers; surplus; schools; free word; a written faith."],
    leads: ["Inquiry: what lies deep in the tree is found by readers more than by hands."],
    see: [{ text: "What each realm knows", ref: "world:ledger#might" }],
    related: ["inquiry", "lore", "ways"],
  },
  inquiry: {
    icon: "🔭",
    title: "Inquiry",
    what: [
      "What lies shallow in the tree of knowledge is found by the hands at its trade: the more hands, the more readily (each tenfold as much again).",
      "The deeper a thing lies, the more of it is found by inquiry: by those who read, each tenfold more of them as much again; the more with the means to measure (a calendar, reckoning, the stars' courses, lenses, clockwork, the current and what reckons with it); the more where word joins them to the readers of the rest of their realm; the more as their ways look to the new rather than to custom.",
      "A page of a thing found says how much of the finding was readers at their measures, and how much many hands.",
    ],
    drives: [
      "Readers, measures, word between learners, openness against custom, surplus to spare.",
    ],
    leads: ["The later ages, sooner where readers are many and joined."],
    see: [{ text: "What emerged, where first, how far it spread", ref: "world:chronicle#firsts" }],
    related: ["letters", "lore", "ages"],
  },
};

/** Which of these a number is a measure of, by its label on the pages. */
export const PEOPLES_CONCEPT_OF: Readonly<Record<string, string>> = {
  "Who read": "letters",
  "A generation on": "letters",
  "Their script": "letters",
  "Whose work wants letters": "letters",
  "Spared from the food": "letters",
  "A school": "letters",
};
