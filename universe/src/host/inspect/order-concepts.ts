// The book of concepts on bonds and freedoms (Phase 19 M138): what the numbers of a realm's
// order are measures of — bondage and its kinds, the labour a realm levies, its standing, its
// reach, what is skimmed, its rank — and what comes of them: risings, movements, the law that
// frees the bound, and what a realm remembers. Each says how the world works it, as it does.
import type { Concept } from "./concepts.ts";

const LEDGER = { text: "Each realm's order and its bound", ref: "world:ledger#bonds" };

export const ORDER_CONCEPTS: Readonly<Record<string, Concept>> = {
  bondage: {
    icon: "⛓️",
    title: "Bondage",
    what: [
      "Some of a land's people may be held in bondage: owned as chattel, bound by debt, bound to the land as serfs, indentured for their passage, or condemned to labour. Each land keeps the share of its people held in each, and what bound the most of them.",
      "No realm is made to hold the bound: each kind comes of what happened and of what a people are.",
    ],
    drives: [
      "War won by a people who keep to rank and are closed to strangers (captives).",
      "Hunger where the few hold the grain and kin do not feed kin (debt).",
      "Steep rank, thin trade and war near (serfdom); the hungry come from afar (indenture); a seat that rules by decree (the condemned).",
    ],
    leads: [
      "Grievance in the land, flight to free lands, and risings.",
      "A realm's standing the less among a people open to strangers; its rank the harder.",
      "Movements to free the bound, and laws that do.",
    ],
    see: [LEDGER],
    related: ["chattel", "debt-bondage", "serfdom", "indenture", "convict-labour", "rising"],
  },
  chattel: {
    icon: "⛓️",
    title: "Chattel",
    what: [
      "Chattel are people owned outright: bought, sold and inherited, their children born to it.",
      "In the world they are captives. When a realm takes a land in war, and its people keep to rank, are closed to strangers, and the taken speak another tongue or keep another faith, it may carry off some of the land's people to its seat.",
    ],
    drives: [
      "Victory in war; the victors' rank and daring; how strange the taken are to them, in tongue and faith.",
    ],
    leads: [
      "A land that remembers its people carried off.",
      "A seat whose wealth rests on the bound, which makes a law to free them the harder to pass.",
      "Grievance, flight and risings.",
    ],
    see: [LEDGER],
    related: ["bondage", "war", "rising", "abolition", "memory"],
  },
  "debt-bondage": {
    icon: "📜",
    title: "Debt bondage",
    what: [
      "In a hungry year, where the few hold the grain and kin do not feed kin, the hungry sell themselves for it, bound to work until the debt is paid. Where a land owes the houses of lending more than half a year's food, its poor sell themselves to pay it, famine or none.",
      "In fed years they work it off, some in a dozen each year; in lean years few go free.",
    ],
    drives: [
      "Famine, or a crushing debt; steep rank; weak bonds of kin; a people closed to strangers.",
    ],
    leads: ["Grievance; the movement to free the bound; a realm's standing the less."],
    see: [LEDGER],
    related: ["bondage", "food", "grievance", "debt"],
  },
  serfdom: {
    icon: "🌾",
    title: "Serfdom",
    what: [
      "Serfs are farmers bound to the land they till, owing its lord their days. A realm binds its farmers where most of a land's people work the fields, its people keep to rank, trade is thin and war near; once bound, a land's serfs grow by a few in a hundred a year toward the realm's measure.",
      "A great dying, making hands scarce, loosens them: a land that loses a tenth of its people in a year frees nearly a third of its serfs.",
    ],
    drives: ["Rank; thin trade; war near; a people closed to strangers; farming."],
    leads: ["The movement to give the land to those who till it; grievance; a harder rank."],
    see: [LEDGER],
    related: ["bondage", "caste", "movement"],
  },
  indenture: {
    icon: "⏳",
    title: "Indenture",
    what: [
      "Those who come hungry to a land from afar may be bound for their passage: seven years of labour, a seventh of them free each year.",
    ],
    drives: ["The hungry moving to a land where rank is steep."],
    leads: ["Hands for a growing land; grievance until their term is served."],
    see: [LEDGER],
    related: ["bondage", "growth"],
  },
  "convict-labour": {
    icon: "⚒️",
    title: "Convict labour",
    what: [
      "A seat that rules by decree, with written law, sets its condemned to labour — the more where its lands are restless.",
      "The labour of the condemned outlives a law that frees the bound; they chafe less than the rest, and a rising counts them half.",
    ],
    drives: ["Rule by decree; writing; unrest."],
    leads: ["Labour for the realm's works; a little grievance."],
    see: [LEDGER],
    related: ["bondage", "abolition", "grievance"],
  },
  corvee: {
    icon: "🧱",
    title: "Corvée",
    what: [
      "Corvée is labour the free owe the realm's works: so many days in a hundred. A seat that builds or fights calls for more; a realm that rules by consent calls for less.",
    ],
    drives: ["Rank; a growing seat; war; rule by consent (less)."],
    leads: ["Grievance in every land, the more the more is owed."],
    see: [LEDGER],
    related: ["grievance", "legitimacy", "caste"],
  },
  legitimacy: {
    icon: "⚖️",
    title: "Standing",
    what: [
      "A realm's standing is how far its people hold its rule rightful, in a hundred parts. Each year it moves a fifth of the way toward where its factors pull it, from a middle of 55.",
      "Under 30 its rule is held wrongful: a crisis of standing is told, and its lands' grievance grows each year until its standing rises over 45 again.",
    ],
    drives: [
      "For it: an old rule kept by custom, a faith shared with the seat, a seat that reaches its lands, battles won.",
      "Against it: grain taken in hungry years, what is skimmed, battles lost, its lands' grievance, massacres remembered, the bound held among a people open to strangers.",
      "A sign from the heavens, for or against its rule, fading over forty years.",
    ],
    leads: [
      "Grievance where its rule is held wrongful; risings the likelier; a court weakened by freeing the bound.",
    ],
    see: [LEDGER],
    related: ["capacity", "corruption", "grievance", "rising", "memory", "realms"],
  },
  capacity: {
    icon: "🏛️",
    title: "Reach",
    what: [
      "A realm's reach is how far its seat makes its will felt across its lands: writing at its seat, roads and clerks, few lands to hold, an old seat.",
    ],
    drives: ["Writing; what its seat knows of roads; its size; its age."],
    leads: [
      "Less skimmed where the seat reaches; a stronger hand against risings; a standing the more for it.",
    ],
    see: [LEDGER],
    related: ["legitimacy", "corruption", "lore"],
  },
  corruption: {
    icon: "🪙",
    title: "What is skimmed",
    what: [
      "What is skimmed between the lands and the seat. It grows where the seat's reach is thin across many lands and a ruler has held power long, and shrinks under rule by consent and written decree.",
      "Each year some of the seat's grain goes with it.",
    ],
    drives: ["Thin reach; many lands; a long reign."],
    leads: ["Less grain at the seat; a standing the less for it."],
    see: [LEDGER],
    related: ["capacity", "legitimacy", "tithe"],
  },
  caste: {
    icon: "🪜",
    title: "Rank",
    what: [
      "Rank is how hard a realm's order has set: whether its people are born to a station and kept in it. It moves toward its people's love of rank and of old ways, law held sacred and the bound among them; a realm that outlaws bondage loosens it.",
    ],
    drives: ["A people's rank and tradition; law held sacred; the bound."],
    leads: [
      "A hardened order holds its bound the harder: they rise the less, and chafe the slower.",
    ],
    see: [LEDGER],
    related: ["bondage", "rising", "legitimacy"],
  },
  abolition: {
    icon: "🕊️",
    title: "Freeing the bound",
    what: [
      "Every five years, a realm with written law whose people have a movement to free the bound weighs a law freeing them: the movement, the fear of risings remembered, an open people, a seat that reaches and realms that freed theirs, against its court and the wealth that rests on the bound, old ways and rank.",
      "If the law passes, all its bound go free but the condemned, its people grow more open, and its court does not forgive it at once. A rising that overthrows a seat frees every bound of its realm the same.",
    ],
    drives: ["The movement to free the bound; risings remembered; free realms near; writing."],
    leads: ["Freedom; an open people; a court's grudge; a looser rank."],
    see: [LEDGER, { text: "When it first came", ref: "world:chronicle#firsts" }],
    related: ["movement", "rising", "legitimacy", "bondage"],
  },
  rising: {
    icon: "✊",
    title: "Risings",
    what: [
      "Where an eighth of a land's people are held, the bound may rise: the more of them, their grievance, a realm at war and of thin reach, risings remembered and their daring, against the rank that holds them and the realm's standing.",
      "Their numbers are set against what the realm can bring. A rising won frees the land, which breaks away as a realm of its own — or, at the seat, overthrows the court and frees every bound. A rising crushed kills many, and the land is cowed for twenty-five years. The bound flee to free lands, too, a band at a time.",
    ],
    drives: ["The bound; grievance; war; thin reach; memory; daring."],
    leads: ["New realms of the freed; massacres remembered; movements to free the bound."],
    see: [LEDGER],
    related: ["bondage", "memory", "legitimacy", "caste"],
  },
  movement: {
    icon: "📣",
    title: "Movements",
    what: [
      "Movements rise among a realm's people when what moves them is strong enough: to free the bound (an open people, risings remembered, free realms near, the sway of traders), to give the land to those who till it (serfs, hunger), or to give the many a voice (the sway of makers, open ways, a realm not ruled by one).",
      "Each grows slowly toward what moves it, and pushes its people's ways while it stands.",
    ],
    drives: ["A people's ways; the bound; hunger; who holds sway; what is remembered."],
    leads: ["Laws that free the bound; ways more open, rank less steep."],
    see: [LEDGER],
    related: ["abolition", "rising", "memory"],
  },
  laws: {
    icon: "🏛️",
    title: "Laws",
    what: [
      "A realm keeps four laws: its land (the lord's, leased, or the tiller's own), strangers (subjects, the faithful, or citizens), other faiths (one faith, others tolerated, or free conscience) and justice (custom and vengeance, the ruler's courts, or one law for all).",
      "Its first laws come of its people's ways and its rule. Every ten years it weighs each law against what its interest groups want, by their sway — the court's the less as its rule is doubted — what its movements and its people's ways push for, and how hard old ways hold. A law moves a step at a time; one law for all, and free conscience, are written laws.",
    ],
    drives: [
      "Who holds sway: farmers, herders, crafters, traders, the court, the temple.",
      "The movements for the land and for a voice; a people's openness, rank and piety; a rule doubted.",
    ],
    leads: [
      "Serfs bound under the lord's land, and freed under the tiller's own.",
      "Grievance in lands of another tongue held as subjects, and of another faith where one faith is the law.",
      "Captives seldom carried off where strangers are citizens; less skimmed under courts; a standing the firmer where the laws are what the powerful want, and where one law holds for all.",
    ],
    see: [{ text: "Each realm's laws", ref: "world:ledger#bonds" }],
    related: ["serfdom", "legitimacy", "movement", "corruption", "chattel"],
  },
  memory: {
    icon: "🕯️",
    title: "What a realm remembers",
    what: [
      "A realm remembers what it suffered and won: risings, massacres, its people carried off, freedoms won, the law that freed its bound. Each memory weighs a little less every year, and the eight weightiest are kept.",
      "Risings and massacres remembered stir new risings and the movement to free the bound; massacres remembered weigh on its standing.",
    ],
    drives: ["Risings, massacres, captivity, freedom."],
    leads: ["Risings, movements, a standing the less."],
    see: [LEDGER],
    related: ["rising", "legitimacy", "movement"],
  },
};

/** Which of these a number is a measure of, by its label on the pages. */
export const ORDER_CONCEPT_OF: Readonly<Record<string, string>> = {
  Standing: "legitimacy",
  "Its realm's standing": "legitimacy",
  Reach: "capacity",
  Skimmed: "corruption",
  Rank: "caste",
  Corvée: "corvee",
  "Held in bondage": "bondage",
  "Law of bondage": "abolition",
  "Its realm's law": "abolition",
  Cowed: "rising",
};
