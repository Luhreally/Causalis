// The book of concepts on credit (Phase 21 M143): what a house of lending is, what a debt does
// to the land that owes it, and what follows when a house fails. Each says how the world works
// it, as it does.
import type { Concept } from "./concepts.ts";

const LEDGER = { text: "Every house of lending, side by side", ref: "world:ledger#credit" };

export const CREDIT_CONCEPTS: Readonly<Record<string, Concept>> = {
  credit: {
    icon: "🏦",
    title: "Credit and its houses",
    what: [
      "Credit is a promise to pay later, made good by writing and reckoning, and by trust. Where a market town knows lending — coin and reckoning first — and has traders enough, a house of lending may rise, named for the family that keeps it.",
      "A house starts with a stake from its land's spare grain and lends up to three times what it holds, so long as its own land keeps half a year's food. In a famine a land of its realm borrows from the house with the most to lend — or, failing one, from a house of a realm that knows its own and is not at war with it, four in a hundred dearer, and remembered kindly for it; a land of no realm, from a house of a realm on its border, eight in a hundred dearer, for there is no realm to answer for it: grain carried from the house's town to the hungry, at interest — eight in a hundred a year, dearer to a land that cost its lenders before, and dearer still for ten years after a house fails.",
    ],
    drives: [
      "Lending known, coin, a market town with traders; grain to spare.",
      "Famine in a land of its realm, of a realm at peace with it, or of no realm on its border.",
    ],
    leads: [
      "Fewer dead of famine where a house is near.",
      "Debts that a land pays from its harvests for years after — and that bind its poor when it cannot.",
    ],
    see: [LEDGER],
    related: ["debt", "house-failure", "markets"],
  },
  debt: {
    icon: "💸",
    title: "Debt",
    what: [
      "A land that borrowed pays its lenders each year what it can, in food of any kind: at most twelve in a hundred of the food it made, never so much as to leave it under three months of food. Interest runs on what is still owed.",
      "A debt above half a year's food is crushing: no house lends the land more, and its poor sell themselves into bondage to pay it, famine or none. A debt unpaid for thirty years is written off at last, and its house bears the loss.",
    ],
    drives: ["Famine, and the grain borrowed against it; the interest asked."],
    leads: [
      "Food carried back to the lenders' towns, year after year.",
      "Debt bondage where it is crushing; losses to the houses where it is never paid.",
    ],
    see: [LEDGER],
    related: ["credit", "house-failure", "debt-bondage"],
  },
  "house-failure": {
    icon: "💥",
    title: "A house fails",
    what: [
      "A house that loses more than it holds — debts written off, never paid — fails. What it was owed is forgiven, for there is no one left to pay; its town's savers are ruined, and their land holds a grievance against its realm, and keeps its grain closer ever after.",
      "For ten years after, every house lends dearer, fearing the same.",
    ],
    drives: ["Debts never paid; lending too much against too little."],
    leads: ["Debts forgiven; grievance in its land; credit dear for a decade."],
    see: [LEDGER],
    related: ["credit", "debt"],
  },
};

/** The labels on pages that are measures of these concepts. */
export const CREDIT_CONCEPT_OF: Readonly<Record<string, string>> = {
  "It holds": "credit",
  "Owed it now": "debt",
  "It owes": "debt",
  "Against its harvest": "debt",
  "Borrowed, ever": "credit",
  "It failed": "house-failure",
};
