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
    leads: ["A body to walk in. What a ruler can decree comes later."],
    see: [{ text: "Every coup and restoration", ref: "world:ledger#strife" }],
    related: ["credit"],
  },
};

export const LIVES_CONCEPT_OF: Readonly<Record<string, string>> = {
  Wealth: "wealth",
  "Ruled by": "leaders",
};
