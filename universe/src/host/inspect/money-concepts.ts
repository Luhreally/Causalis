// The book of concepts on money and the state (Round B; sim/money, rules/money.ts, rules/labour.ts): a good's worth, money and its
// price level, taxes, borders, market power, the Lorenz curve and bondage. Each says how the world works it; numbers are the rules'.
import {
  BIND_MOST,
  COVER,
  EXCISE_MOST,
  INTOX_HOLD,
  MONEY,
  SHOP,
  TARIFF_MOST,
  TAX_MOST,
} from "../../rules/index.ts";
import type { Concept } from "./concepts.ts";

const pc = (x: number) => `${Math.round(x * 100)}`;

export const MONEY_CONCEPTS: Readonly<Record<string, Concept>> = {
  worth: {
    icon: "⚖️",
    title: "What a good is worth",
    what: [
      "No good has a worth written down for it. In each land its staple (grain, or wild food where none is grown) is what the rest is reckoned in; a food is worth the work a unit of it takes against a unit of the staple; what the land's crafters can make is worth its cheapest recipe's cost, the crafter's year at what he would earn otherwise and its inputs at their worth, over what a year makes. What the land cannot make is worth what it does for whoever uses it (a tool the work it saves, a machine the same, a month's food a month of a worker's year), or, as an input, what the best recipe made of it would leave after its maker's wage; else what it last fetched.",
      `A price moves each year toward that worth, bent by how short the good runs against what is wanted (to three times it and back to a third), and lifted as far as its makers can ask above their cost: one over the number of its shops (a master's ${SHOP.hands} hands, or a works' floor of ${SHOP.works}) times how far buyers can do without it, toward a single maker's where a guild acts as one, held down by goods bought from abroad (Cournot's Lerner index).`,
    ],
    drives: ["The land's wages; what its crafters can make and from what; what each good does."],
    leads: ["What crafters make, what traders carry, what each kind of work earns."],
    see: [],
    related: ["money", "markets", "inequality"],
  },
  money: {
    icon: "🪙",
    title: "Money and prices",
    what: [
      "A people trades goods for goods, reckoned in grain, until it knows coin. Then the metal its markets hold most worth for its weight is struck: a share of what it smelts goes into coin, which wears a hundredth a year. Once its seat writes, keeps clerks' accounts and knows lending, its treasury's written claim passes as money; once a house of lending stands, the lenders' own claims do too, each grain held lent out " +
        `${MONEY.multiplier} times over.`,
      `What a grain's worth costs is Fisher's: money in hand times how often it changes hands (about ${MONEY.velocity} times a year where few live by trade, more as traders are many and word travels fast) over what passes through the markets. Under coin it is held at what a coin's metal is worth, or below where coin is scarce: debase the coin, or find a great lode of its metal, and every price rises. Notes are issued as trade wants them, so prices hold, unless a treasury short of what it spends and unable to borrow prints them (up to ${pc(MONEY.print)} in a hundred of the money a year) or debases its coin (up to ${pc(MONEY.debase)}).`,
    ],
    drives: ["Its metal and smelting; what its seat knows; its trade; its treasury's deficits."],
    leads: ["Prices rising, which lenders charge for and its people resent."],
    see: [],
    related: ["treasury", "worth"],
  },
  treasury: {
    icon: "🏛️",
    title: "A realm's treasury",
    what: [
      `A realm can tax four things: its fields' harvest (the tithe its interests set), what is bought and sold (up to ${pc(TAX_MOST.trade)} in a hundred), each of its people (up to ${pc(TAX_MOST.heads)} of a year's food) and what they earn (up to ${pc(TAX_MOST.income)}). It takes as far as it can measure each: a harvest at the threshing floor and in a written survey, trade at its markets and the more where coin passes, heads as far as its seat reaches and writes them down, incomes only where clerks and lenders keep accounts. And as far as those who would bear it cannot refuse it: a harvest's tax falls on whoever holds the land, a head's on the many, an income's on those who earn most.`,
      "It spends on its men under arms, its clerks and court, relief for its hungry and interest on its debt. What it cannot cover it borrows; what it cannot borrow it debases or prints.",
    ],
    drives: [
      "Its people and what they make; what its seat knows; who has its sway; its wars and debts.",
    ],
    leads: ["Grievance where it takes much; debt sold; money debased; tariffs."],
    see: [],
    related: ["money", "borders"],
  },
  borders: {
    icon: "🛃",
    title: "Tariffs, sanctions and smuggling",
    what: [
      `A realm lays a tariff on goods from abroad (up to ${pc(TARIFF_MOST)} in a hundred of their worth) as far as its crafters are undersold by them and have its ear, against its traders whose living crosses its borders and the many who buy; a treasury going short leans on a border, the easiest thing to tax; and a realm that buys much of the world's goods sees its sellers bear part of it. A realm shuts its trade with one whose way it fears, as far as the fear outweighs what the trade and its people's holdings there are worth.`,
      "What is barred or taxed hard crosses anyway as far as the wedge between the two sides outweighs what being caught costs: how hard the realm holds, how far it reaches, how little its officers skim, how long its borders run.",
    ],
    drives: ["Who gains and loses by trade; fears; its treasury; its hold on its borders."],
    leads: ["Less trade between realms; a treasury's tariffs; smuggling."],
    see: [],
    related: ["treasury", "camps"],
  },
  inequality: {
    icon: "📉",
    title: "How a land's income is shared",
    what: [
      "A land's fields and herds yield more than their workers earn at the margin: the difference is its rent (Ricardo), and it goes to whoever holds the land, from one household in a hundred where wealth lies with few to half of them where with all, or to everyone where the realm holds it in common. What the bound make above their living goes to their holders too.",
      "Sort every kind of household by what each earns (foragers, farmers, herders, crafters, traders, leaders, the bound, the holders) and add up the shares: the Lorenz curve. The Gini is how far it bows from the straight line of everyone alike. Within a kind all are counted alike, so it is the least the inequality can be.",
    ],
    drives: ["Its rent, its wages, whom it binds; how its realm's wealth is owned."],
    leads: ["Who resists which tax; a people's readiness to rise."],
    see: [],
    related: ["worth", "binding"],
  },
  binding: {
    icon: "⛓️",
    title: "Why tillers are bound",
    what: [
      `Where hands are scarce against the land, a tiller earns far more than his living, and whoever holds the land would keep the difference by binding him to it (Domar). He can as far as the realm's arms reach its lands, against the open land the bound could walk off to; and as far as its law on the land allows (the lord's, leased, or the tiller's own). At most ${pc(BIND_MOST)} in a hundred of a land's tillers are bound.`,
      "As its people grow many and a tiller's wage falls toward his living, as its arms weaken, or as its law turns, bondage ends of itself.",
    ],
    drives: ["Its people against its land; how hard its realm is held; its law on the land."],
    leads: ["Serfs; debtors held to their labour; risings."],
    see: [],
    related: ["inequality", "bondage"],
  },
  cover: {
    icon: "🛟",
    title: "Pooled risk",
    what: [
      `Underwriters cover cargoes at sea where records are kept, losses can be reckoned and coin paid, and enough goes by sea to pool: a cargo insured is sent though a trader would shy from bearing its loss himself, at what the underwriter expects to lose and ${pc(COVER.load)} in a hundred more.`,
      `A realm's lands pool their harvests where granaries can hold the pool and writing keeps who paid in, the more as their harvests swing and the more lands there are to spread a bad year over: a land whose harvest falls short of its usual by more than ${pc(COVER.deductible)} in a hundred is paid what it lost below that from its seat's granary, and every land pays in by its usual harvest.`,
    ],
    drives: ["Writing, reckoning, coin, granaries; its sea trade; how its harvests swing."],
    leads: ["More trade by sea; fewer lean years."],
    see: [],
    related: ["treasury"],
  },
  intoxicants: {
    icon: "🍶",
    title: "What calms, wakes and eases",
    what: [
      "A plant makes compounds that keep it from being eaten, and some of them act on the nerves of whatever eats it. A world's own life holds them only for a people of its own chemistry, the same liquid and the same hand: a people come down on another world finds nothing there that acts on it, save what it brews. Some of a world's growing lineages hold one kind each: what calms, what wakes, what brings visions, what eases pain. They grow thicker where much grows and much eats. Where the life makes sugar and a people brews, what calms is within reach anywhere.",
      `A people takes them as far as they are within reach and wanted: what brings visions for its rites, the more as it is devout; what wakes for its toil; what eases pain in its wars and sicknesses; what calms in its hardship. Of those who take it steadily some come to need it (${Math.round(INTOX_HOLD.easing.binds * 100)} in a hundred of what eases pain, ${Math.round(INTOX_HOLD.calming.binds * 100)} of what calms, next to none of what brings visions), and lose part of their work and, a few, their lives; what wakes keeps them at their work.`,
      `A realm forbids them as far as its temple, whose rites do not use them, and its court, whose people's work they take and whose money goes abroad for them, can press it, the harder the more it is held by force; its traders, its treasury and their takers, as far as they are heard, press against it. Allowed, its treasury lays an excise on them (up to ${Math.round(EXCISE_MOST * 100)} in a hundred of their worth) or, held hard and reaching far, keeps their trade to itself. Forbidden, they cost the more for the risk, slip across its borders as far as being caught costs little, and where the profit is great and its reach weak those who carry them organise.`,
    ],
    drives: [
      "Its world's life and its people's chemistry; its ways and faith; its wars and lean years; who holds its realm.",
    ],
    leads: [
      "Rites and pain eased; work lost and lives; a treasury's excise; smuggling and cartels; money drained abroad and resented.",
    ],
    see: [],
    related: ["borders", "treasury", "worth"],
  },
};

/** Which concept a number on the pages measures, by its label. */
export const MONEY_CONCEPT_OF: Readonly<Record<string, string>> = {
  "Its money": "money",
  "A grain's worth costs": "money",
  "Prices last year": "money",
  "Metal in its coin": "money",
  "It took in": "treasury",
  "It spent": "treasury",
  "Went short": "treasury",
  "On goods from abroad": "borders",
  "Shut by its fear": "borders",
  "Slips past its borders": "borders",
  "Cargoes insured at sea": "cover",
  "Harvests pooled": "cover",
  "What its makers ask above their cost": "worth",
  "Its fields' and herds' rent": "inequality",
  "Of its people": "binding",
  "Its law on them": "intoxicants",
  "Who need it": "intoxicants",
  "Its people's use a year": "intoxicants",
};
