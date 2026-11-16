// The book of concepts on one person (round G, the individual): what someone the game names wants, is like, does over a life, owns
// and owes, how their kind pairs, and what could lead them wrong. Each is read from their land and a key of their own (rules/self.ts).
import type { Concept } from "./concepts.ts";

export const SELF_CONCEPTS: Readonly<Record<string, Concept>> = {
  "self-wants": {
    icon: "🍞",
    title: "What a person wants",
    what: [
      "Six wants, as any living thing has them: enough to eat, to be safe, standing among their own, their kin about them, what they hold sacred, and to know. Each is weighed by who they are (the bold need safety less, the driven standing more, the warm their kin, the devout their faith) and met by what their land, their home and their law give them.",
      "Food is met by what their land ate at its leanest last year, and the poor go shortest: a household low in its land feels a lean year half again as hard as the middle, and one whose day leaves nothing feels it harder still. Safety is met by how much war, raiding and fire their land saw lately and how far its rule holds. Standing by their household's place, or their seat.",
      "What presses is a want that matters to them and is not met. History keeps none of it: it is read off what history keeps of their land.",
    ],
    drives: [
      "Their land's food, wars and law; their household's place and day; their kin; their ways.",
    ],
    leads: ["What could lead them wrong (a hungry poor home's want is the first of it)."],
    see: [],
    related: ["self-character", "self-crime", "food"],
  },
  "self-character": {
    icon: "🤝",
    title: "What a person is like",
    what: [
      "Six traits: boldness, warmth, temper, conscience, curiosity and drive. Each starts at the middle of their people and is moved by their kind's body, by the ways of the people that raised them, by what befell their land while they were young, and by a draw of their own.",
      "A people that lives close is warmer and keeps its temper; a long-lived kind is slow to anger; a body big among its world's beasts goes boldly. A people of valour raises the bold and the quick-tempered, a pious and traditional one the upright, an open one the curious, a people that keeps to rank and trade the driven. A hungry youth makes the driven and the hard; a youth of war, the bold and the cold.",
      "A hive's are much alike; any other people's differ one from the next by about a third of the whole range.",
    ],
    drives: ["Their body, their people's ways, their young years, their own draw."],
    leads: ["What they want, the work they change to, and what could lead them wrong."],
    see: [],
    related: ["self-wants", "self-career", "self-crime"],
  },
  "self-career": {
    icon: "⚒️",
    title: "A person's work over a life",
    what: [
      "History keeps how many of a land do each work, not who. A person's work is read back from the work they do now: in each decade of their working years they may have changed, the more readily the more open and the less traditional their people, the more curious and bold they are, and the harder the times. The work before is one their land does, the dearer the higher their household stands.",
      "Why they changed is read off the two works' pay and who they are: to a poorer work when the old no longer fed them, to a better one through those they knew where their household stood high, or on the strength of their hands where they are driven. A seat, a reign or a trade's place is the last change, in the year history says.",
      "At a work they come to be a hand in two years, able in six, skilled in twelve and a master in twenty (as long-lived as an upright ape), and some of a mastery carries to the next work.",
    ],
    drives: ["Their land's work, their ways and traits, their place, the hungry years."],
    leads: ["What their day brings in."],
    see: [],
    related: ["self-character", "self-wealth"],
  },
  "self-wealth": {
    icon: "💰",
    title: "What a person owns and owes",
    what: [
      "A household holds its share of what its land holds: every good of the land's stores at its usual worth, less what the realm keeps in common. How the rest lies among households is a Pareto's tail, as wealth lies wherever it is free to gather: the fewer the realm's wealth lies among, and the higher its people's rank, the fatter the tail and the more its richest tenth holds. A household's place in it is its home's standing in the town drawn, or its own draw.",
      "Its roof is its own where the land's law makes it the tiller's, and for the richest anywhere. It owes its part of what its land owes the houses of lending, and, where its day leaves less than nothing, what a lean season runs up.",
      "A coin is a person's food for a day at usual prices.",
    ],
    drives: [
      "Their land's stores and debts, how its realm owns its wealth, their household's place, their day.",
    ],
    leads: ["Want, and what a fall would cost them."],
    see: [{ text: "The wealth of realms", ref: "concept:wealth" }],
    related: ["wealth", "self-wants"],
  },
  "self-crime": {
    icon: "⚖️",
    title: "What could lead a person wrong",
    what: [
      "Four ways a person goes against others or the law: to take what isn't theirs, to cheat on what they owe, to come to blows, to defy the rule. Each is read against one of their town whose every number is the middle.",
      "Want leads to taking and cheating: a hungry land's poor first, and a home whose day leaves nothing. What lies to hand leads to taking: a rich town, goods on the road, homes left open after war or fire. The law's reach holds them back, the further the more it is written and the rule held rightful, the less where it is corrupt; so do their conscience, and what a fall would cost them. A quick temper and a cold heart lead to blows; boldness, grievance and a forbidden faith to defiance.",
      "Who is brought before a town's court is read by the same lean: a case's cause and what was done come of the town's year, and of its people the one brought is drawn the likelier the more they lean to it.",
    ],
    drives: ["Want, opportunity, the law's reach, what they are like, what they would lose."],
    leads: ["Their cases before the town's court, and what came of them."],
    see: [],
    related: ["self-wants", "self-character", "self-wealth"],
  },
  "self-pairing": {
    icon: "👪",
    title: "How a kind pairs",
    what: [
      "How a people pairs comes of its body and how much its young need: young that need years of care from two (carried a year and nursed two, grown at fifteen) are raised by a pair that stays together; young one parent can raise, of a big body living loosely, let the strongest keep several partners and most none; a clutch brooded a quarter-year keeps a pair a season; a hive's young are borne by one and raised by all; young spawned to the water are raised by no one.",
      "It shapes a town's homes (four lines to a home and a family's name, as upright apes live; a hive's cell of twelve; one where none pairs), who has a partner, who raises young of their own, who is heir, and which of a town are sent to war: those who bear are levied as far as their young leave them free.",
    ],
    drives: [
      "Their body: how its young are borne, how many at a birth, its span, how closely it lives.",
    ],
    leads: ["Homes, partners, heirs and the levy."],
    see: [],
    related: ["self-wants"],
  },
};
