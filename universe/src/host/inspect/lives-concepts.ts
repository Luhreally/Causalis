// The book of concepts on the wealth of realms and who holds power (Lives L1 and L2): what each measures, what drives it, and where it is to be seen.
import type { Concept } from "./concepts.ts";

export const LIVES_CONCEPTS: Readonly<Record<string, Concept>> = {
  wealth: {
    icon: "💎",
    title: "The wealth of realms",
    what: [
      "What a realm holds is everything in its lands' stores, each good at its usual worth, less what its lands owe the houses of lending. Shared among its people, that is its wealth a head. Beside it stands what its lands made last year, at the same worth.",
      "The two tell different stories. Tools never wear out in the record, so old lands pile them up for centuries, and a people shrunk by war or sickness keeps the heaps its dead left: rich in store, and making little. What a land made last year says how well its people live now. A realm with many people may hold the most in all and little a head.",
      "History keeps each market's stores and its last five years of books, so wealth can be told as it stands now, not through the ages. Homes, roads and works are not counted.",
    ],
    drives: ["Tools and goods made and kept, year on year; how many share them; what is owed."],
    leads: [
      "Nothing yet: this is a reading of what history holds, and nothing in history reads it.",
    ],
    see: [{ text: "Every realm ranked", ref: "world:ledger#wealth" }],
    related: ["markets", "debt"],
  },
  leaders: {
    icon: "👑",
    title: "Who holds power",
    what: [
      "History names a realm's ruler: when they came to rule, how old they are, and what happened in their reign. It names the generals who reached for its seat, and the houses that lend in its lands. It names no heirs, councils or governors, and in time it forgets who founded a realm.",
      "It does not keep where anyone lives. A ruler's home is chosen from their name among the homes nearest their seat town's square: the same one each time, and the choice changes nothing. A house of lending's head is named as a town's makers are: history keeps the house, and the name is given by the same rule each time.",
      "Possessing one of them lays the god's hand on their town, so that they are among its people one by one. What you do in their body is history's. Of a great town your hand holds a ward of 50,000 one by one, and the rest of the town goes on about it, counted as a land's people are.",
    ],
    drives: [
      "Rule passing at a death, a coup, a revolution; a house rising where lending is known.",
    ],
    leads: ["A body to walk in, and a realm to rule: 👑 Rule as them."],
    see: [{ text: "Every coup and restoration", ref: "world:ledger#strife" }],
    related: ["credit", "reign"],
  },
  reign: {
    icon: "📜",
    title: "Ruling as someone",
    what: [
      "Taking a ruler records nothing: a world under a ruler who does nothing goes on exactly as it would have. Each thing done is your act, told in history with whose word it was. The months go by, and the clock is held while a choice is open.",
      "What they can do comes from what they hold. A ruler by birth who rules alone is answered at once. One who holds the seat by others' leave, or shares rule with a council or an assembly, must carry a share of the realm's voices: its groups by their sway, for what each wants. Where nothing is written, custom is the law and no word changes it; under the sacred, the temple can stand in the way. When few hold the rule rightful, the word stops at the seat's door. Lands past the seat's reach chafe at a word they did not want.",
      "A law moves a step at a time and a tithe two parts in a hundred, and the realm weighs them again in its turn. A war goes through the same door as any war, for a land on its frontier. A foe who is winning may hold out against peace. A marriage of state ties two houses: it moves what the two realms think of each other, fading as memories fade, which is what wars and pacts read. Peoples who count kin little keep no houses to join, and a seat not held by birth binds less.",
    ],
    drives: ["What a realm's order, laws, voices and neighbours are now."],
    leads: [
      "Its standing and its lands' grievance, its laws and tithe, its wars, and what it thinks of its neighbours.",
    ],
    see: [],
    related: ["leaders", "wealth"],
  },
};

export const LIVES_CONCEPT_OF: Readonly<Record<string, string>> = {
  Wealth: "wealth",
  "Ruled by": "leaders",
};
