// The book of concepts on a realm's money and its fears (sim/finance, rules/finance.ts): the debt a realm sells and what it pays
// for it, what one people holds of another's, how a realm's wealth is owned, the fear of another's way, and the camps. Each says how
// the world works it, as it does; every number is the rule's own.
import { FINANCE } from "../../rules/index.ts";
import type { Concept } from "./concepts.ts";

const MONEY = { text: "Every realm's money, and who holds whom", ref: "world:ledger#money" },
  CAMPS = { text: "The camps, and the greatest fears", ref: "world:ledger#camps" },
  pc = (x: number) => `${Math.round(x * 100)}`;

export const FINANCE_CONCEPTS: Readonly<Record<string, Concept>> = {
  "sold-debt": {
    icon: "📜",
    title: "Debt a realm sells",
    what: [
      `A realm whose seat knows banking sells its debt: for a war, to pay its host as a war chest does; for a hungry seat; to arm against a realm whose way it fears. Its own people take a share (the more as its wealth is widely held and its people thrifty), and the peoples of realms it meets take the rest, each from its own seat's spare grain: only of a realm they think no ill of, are at peace with, do not fear, and were not cost by before. What they buy is carried to its seat in grain.`,
      `What it pays is a sum, each part shown on its page: ${pc(FINANCE.base)} in a hundred a year that any realm pays; ${pc(FINANCE.record)} more for each debt it refused, fading by half in ${FINANCE.recordHalf} years; ${pc(FINANCE.burden)} for each year's takings it owes; ${pc(FINANCE.war)} at war; up to ${pc(FINANCE.alone)} where one decides alone and could refuse it at a word, up to ${pc(FINANCE.wary)} where it binds itself to no one, less where word of its books moves freely; up to ${pc(FINANCE.lean)} where its lands hold under ${FINANCE.leanMonths} months of food, for lenders see what there is to pay from. Above ${pc(FINANCE.shut)} no one buys; and no one buys of a realm owing ${FINANCE.full} years of what it takes in.`,
      `Each year it pays its holders abroad their interest and one part in ${FINANCE.term} of the debt, in food from its lands' stores, never more than half of what each land holds above three months' eating. Each year it pays less than half its interest, new debt costs it ${pc(FINANCE.arrears)} in a hundred more. Having done so ${FINANCE.missed} years running, or ${FINANCE.late} while it owes ${FINANCE.crushed} years of what it takes in, or beaten in a war with a year's takings owed and unpaid, it refuses the debt: every holder loses, its own savers hold a grievance, no one lends it for twenty years, and each people that held it will not buy of it for ${FINANCE.burnt}, and binds itself the less to anyone.`,
    ],
    drives: [
      "Banking at its seat; a war, a hungry seat, a way it fears.",
      "Its record, its debt against its takings, how it is held.",
    ],
    leads: [
      "A host that fights the harder; grain carried in, and carried home again with interest.",
      "A debt refused: holders' losses remembered, lending dear for a generation.",
    ],
    see: [MONEY],
    related: ["war-chest", "repudiation", "holdings-abroad", "legitimacy"],
  },
  "holdings-abroad": {
    icon: "🌐",
    title: "What one people holds of another's",
    what: [
      `Where a realm's seat knows banking, the works of its lands are listed, and the people of other realms that know banking come to hold shares of them: at most ${pc(FINANCE.stake)} in a hundred of its listed worth to one people, ${pc(FINANCE.abroad)} to all abroad, each holding moving a fifth of the way each year toward what is wanted of it. What is wanted follows how open both realms are (how far each binds itself, its law on strangers, how little it holds in common), how well they think of each other, how the works' worth has gone, how great the holder's wealth is beside the realm's, and falls with any fear between them.`,
      `What its works pay comes home to their holders each year, ${pc(FINANCE.payout)} in a hundred of their worth. Holdings are a reason for two realms to keep the peace, and they bring a people nearer the other's way. A war between the two takes them, and so does a realm that closes itself; what was taken is remembered: its holders will not buy there for ${FINANCE.burnt} years, and their realm binds itself the less.`,
    ],
    drives: ["Banking in both; openness, regard, peace; what the works return."],
    leads: [
      "Better regard between the two; a people more exposed to the other's way.",
      "Losses in a war or a closing, and wariness after.",
    ],
    see: [MONEY],
    related: ["sold-debt", "markets", "diplomacy", "fear-of-a-way"],
  },
  ownership: {
    icon: "🏛️",
    title: "How a realm's wealth is owned",
    what: [
      "Two numbers, each from 0 to 1, and no name kept: among how many its wealth lies (a few great houses, its propertied, every household), and how much of it the realm itself holds for all. They are first read off its law on land, its people's ways and their body: those who live as one keep one store.",
      "Every ten years each moves partway toward what is asked of it: by that law, those ways and that body; by how widely its choices are carried (where many decide, many come to hold; where works are listed and a few decide, wealth gathers to them); by a way seen to work better next door, toward which its people are drawn; by those who would lose by that way, who pull against it; by rulers overthrown, whose wealth is shared out, and where it lay with a few, taken for all, a lean that fades over generations; by savers ruined when a debt is refused.",
    ],
    drives: [
      "The land law, the people's ways and body; who decides; what befalls it and what it sees.",
    ],
    leads: [
      "Who buys its debt at home; how open it is to strangers' holdings.",
      "Who has what to lose by another's way.",
    ],
    see: [MONEY],
    related: ["laws", "fear-of-a-way", "revolution"],
  },
  "fear-of-a-way": {
    icon: "🧭",
    title: "The fear of another's way",
    what: [
      `Each realm reckons, of each realm it meets, how much it fears that realm's way, as four numbers multiplied (and by ${FINANCE.fear}, to at most 1): how unlike the two are in who bears arms, who decides, how word moves and how wealth is owned; how well the other's way is seen to work (how its people eat, how quiet they are, what they hold a head, how great it is beside one's own); how far one's own people are exposed to it (the border between them, their trade, how alike their speech, what each holds of the other's, and how freely word moves at home); and what those who hold the realm as it is would lose were it held and owned as the other is. Who that is is read off both: the few who decide, by a shared say; a people with a say, by one's rule; the few who own, by a common store; households, by having theirs taken or gathered; those who keep a common store, by its sharing out. A fear grows and fades over years: each year's is half the last year's and half the year's own reckoning.`,
      `A fear of ${FINANCE.feared} or more is told. It takes from the two realms' regard, and draws together two alike who fear the same realm, so pacts form among the like-held. Where those who rule would lose, they watch word the closer and keep arms closer to their host, which lowers their people's exposure; where a people would lose, it guards itself more gently. Against that, a people who see the other's way working better are drawn toward it in who decides, how word moves and how wealth is owned. A realm that fears fields more of its men and sells debt to arm; less passes between the two realms' lands; neither's people buy the other's debt or works; and each buys the readier the war debt of whoever fights the one it fears.`,
    ],
    drives: [
      "Two ways unlike; the other seen to fare better; nearness, trade, a shared tongue, holdings; much to lose.",
    ],
    leads: [
      "Word watched and arms kept close, or a people drawn the other's way.",
      "Pacts among the like-held, hosts grown, trade thinned, others' wars paid for; where two great realms fear each other, camps.",
    ],
    see: [CAMPS],
    related: ["ownership", "camps", "diplomacy", "laws"],
  },
  camps: {
    icon: "⚔️",
    title: "Camps",
    what: [
      `Camps are read, never kept: where two realms, each among the world's ${FINANCE.campGreat} most peopled or with ${pc(FINANCE.campShare)} in a hundred of its people, fear each other's way ${FINANCE.campFear} between them, they are two poles. Another realm stands with a pole when it is nearer that pole in its way and is bound to its side: by a fear of the other pole, or by an oath to one who stands with this one. The rest stand apart.`,
      "No rule knows of camps. What a player sees of one (pacts among the like-held, hosts grown on both sides, trade thinned between them, a third realm's war paid for by one side against the other's way) comes of each realm's own fear, one realm at a time; and where no two great realms sit far apart in how they are held and owned, no camps come.",
    ],
    drives: ["Two great realms unlike, each seen to work, each exposed to the other."],
    leads: ["A world drawn in two; wars paid for from afar."],
    see: [CAMPS],
    related: ["fear-of-a-way", "diplomacy", "war"],
  },
};

/** The labels on pages that are measures of these concepts. */
export const FINANCE_CONCEPT_OF: Readonly<Record<string, string>> = {
  "New debt would cost it": "sold-debt",
  "It has sold": "sold-debt",
  "Interest unpaid": "sold-debt",
  "Came home to its people from abroad": "holdings-abroad",
  "Who decides, whose the wealth": "fear-of-a-way",
  "Its wealth": "ownership",
};
