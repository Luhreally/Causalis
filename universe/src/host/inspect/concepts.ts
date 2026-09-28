// The book of concepts (Phase 10 M97): what the numbers on the pages are measures of — being
// fed, a land's grievance, a realm's tithe, a war, a faith, the web of eating — each a page
// of its own: what it is, what drives it, what it leads to, and where it is to be seen.
// A page's numbers link here (the ⓘ beside a label), and the book's index lists them all.
import type { World } from "../../kernel/index.ts";
import type { Block, Line, PageModel, Stat } from "../../bridge/index.ts";
import { link, yearNow } from "./words.ts";

/** A concept: its icon and name, and what the book says of it. */
export type Concept = {
  readonly icon: string;
  readonly title: string;
  /** What it is, in a few sentences. */
  readonly what: readonly string[];
  /** What drives it. */
  readonly drives: readonly string[];
  /** What it leads to. */
  readonly leads: readonly string[];
  /** Where it is to be seen: a lens, a tab of the ledger, a page. */
  readonly see: readonly { readonly text: string; readonly ref: string }[];
  /** The concepts it is bound up with. */
  readonly related: readonly string[];
};

/** Every concept, by its id (its page is `concept:<id>`). */
export const CONCEPTS: Readonly<Record<string, Concept>> = {
  food: {
    icon: "🍞",
    title: "Being fed",
    what: [
      "Each month a land's harvest goes into its market's stores — wild food, meat and milk, grain — and its people eat what they need, the food that spoils soonest first.",
      "“Fed” is how much of their need they ate, in a hundred parts: a hundred is enough. A month under seventy is a famine.",
      "“Food put by” is what lies in store, told in months of eating. Stores spoil — grain slowly, meat fast — and pottery, granaries and keeping make them last.",
    ],
    drives: [
      "The rain against the usual, the soil, the wild game and the fish.",
      "How many work the fields, the herds and the hunt, and their tools and machines.",
      "What the land has learned (yields, storage); grain eaten by small game; flocks taken by hunters; a warming climate.",
      "Trade: food goes to dearer neighbours, each keeping three months for itself.",
    ],
    leads: [
      "Famine: fewer births, more deaths, people leaving, grievance, prayers to a hungry god.",
      "A push to find new ways, and a realm's hunger for its neighbour's stores — a cause of war.",
      "Relief, when food comes in by trade within a year of a famine.",
    ],
    see: [
      { text: "The hungriest land (the chronicle's records)", ref: "world:chronicle#records" },
      { text: "Famines, century by century", ref: "world:chronicle#centuries" },
    ],
    related: ["growth", "markets", "climate", "web", "grievance"],
  },
  growth: {
    icon: "👥",
    title: "The growth of peoples",
    what: [
      "A land's people are counted by sex, by age and by their work. Children are born to women by their age, and the better fed the more; the old and the hungry die the more.",
      "As a people comes to wield more power (engines, electricity) it has fewer children, as peoples do.",
      "Each year some move: from hungry or crowded lands to better ones nearby, foragers into empty land.",
    ],
    drives: [
      "Being fed (births fall with the square of hunger).",
      "Plague and healing, cold without clothing, herb-lore and medicine, the smoke of burning.",
      "How much the land can feed, against how many it must.",
    ],
    leads: [
      "Lands peopled and emptied; the world's people rising some three in a thousand a year at plenty.",
      "Migrants carry what they know: sowing, herding, smelting, and their share of the goods.",
    ],
    see: [
      { text: "People on the world, year by year", ref: "world:chronicle#story" },
      { text: "The centuries compared", ref: "world:chronicle#centuries" },
    ],
    related: ["food", "towns", "climate"],
  },
  grievance: {
    icon: "😠",
    title: "Grievance",
    what: [
      "A land's grievance is its anger at the realm it belongs to, and the thing that caused most of it. The seat has none.",
      "Each year a quarter of it fades, and each year's troubles add to it — so it settles where the troubles hold it.",
      "A land taken in war begins full of it; a land whose realm fell, half full.",
    ],
    drives: [
      "A famine in the last year (worse under a priest-king of its own faith).",
      "The tithe sent to the seat.",
      "How far it lies from the seat, and beyond the seat's reach; the sea between.",
      "How unlike the seat's its speech is.",
    ],
    leads: [
      "Secession: a land nearly full of grievance may break away (polity.seceded).",
      "Rebellion: a land taken in war may rise to return to the realm it was taken from.",
      "Refusing to join a realm, and a realm split when its ruler dies.",
    ],
    see: [{ text: "The realms side by side", ref: "world:ledger#realms" }],
    related: ["tithe", "realms", "tongues", "food", "war"],
  },
  tithe: {
    icon: "🌾",
    title: "The tithe",
    what: [
      "Each year every land of a realm but its seat sends a share of its grain to the seat — the tithe, a twentieth at first.",
      "Every five years the seat weighs who wants more and who wants less, each heard as much as its sway, and sets it again, between two and fifteen in a hundred.",
    ],
    drives: [
      "For more: the court (the more at war) and the temple (under sacred law).",
      "For less: the farmers and herders, the more after a famine.",
      "Who leads decides who is heard: an assembly hears the farmers, a priest-king the temple.",
    ],
    leads: ["Grain gathered at the seat; grievance in the lands that send it."],
    see: [{ text: "The realms side by side", ref: "world:ledger#realms" }],
    related: ["grievance", "realms", "food"],
  },
  realms: {
    icon: "👑",
    title: "Realms and rule",
    what: [
      "A land with a market town may found a realm, the more readily where its people hold to rank and it has leaders enough. The realm is named for its seat's town.",
      "Its people's ways decide its rule: a priest-king where they are pious and ranked (a holy seat), a chief (a chiefdom), a council of elders where kinship matters (a league), else an assembly (a commonwealth); rule passing by birth, by choice or by acclaim; law of custom, decree or the sacred.",
      "Neighbours join it the more readily the more alike, the nearer by road, the stronger it is. A ruler rules until death; a crisis at a death may split off its farthest lands.",
    ],
    drives: [
      "Its people's ways (rank, kinship, piety, openness, tradition), which may change its rule: a realm reformed.",
      "Strength, roads and likeness for growing; grievance for splitting.",
    ],
    leads: [
      "The tithe, wars, pacts and rivalries, the faith of a holy seat.",
      "Its end when its seat is lost or emptied; its lands cut off from the seat go their own way.",
    ],
    see: [
      { text: "The realms side by side", ref: "world:ledger#realms" },
      { text: "The realms through the years", ref: "world:chronicle#lives" },
    ],
    related: ["tithe", "grievance", "war", "diplomacy", "towns"],
  },
  war: {
    icon: "⚔️",
    title: "War",
    what: [
      "A realm goes to war with a rival it has met, or for a hungry neighbour's stores — the hungry one attacks, else the stronger. It must be rested: a peace is thirty years forgotten.",
      "What it fights for is the enemy's border land with the fullest stores; its seat last. A battle is fought each year for it; the stronger host at the less distance wins the more often, and the defenders are the stronger at home, on hills, behind rivers and walls.",
      "A won battle takes the land (a seat, two). Peace comes with the prize, a lost battle, weariness, or after some years.",
    ],
    drives: [
      "Rivalry and hunger; valour; the strength of the hosts: grown men, how they are armed, a standing army.",
      "Traders wanting peace, a temple wanting war on unbelievers.",
    ],
    leads: [
      "The fallen, counted as deaths; lands taken, and the grievance of the taken; realms ended.",
      "An embargo on trade between the two while it lasts; the memory of the war between them.",
    ],
    see: [
      { text: "Every war, and the bloodiest", ref: "world:ledger#wars" },
      { text: "The wars through the years", ref: "world:chronicle#lives" },
    ],
    related: ["realms", "diplomacy", "grievance", "food"],
  },
  diplomacy: {
    icon: "🤝",
    title: "Regard between realms",
    what: [
      "Realms that share a border or trade meet, and each year their regard is summed: a shared faith, like speech and trade warm it; rival faiths, long borders and coveted stores cool it.",
      "They remember: a land taken, a war between them, a broken pact — each memory halving every thirty years.",
      "Regard high enough makes a pact of sworn friends; below nothing, a pact breaks. Low enough, they are rivals.",
    ],
    drives: ["Faith, speech, trade, borders, hunger, valour and memory."],
    leads: ["Pacts and their breaking; rivalry, and so war."],
    see: [{ text: "The realms side by side", ref: "world:ledger#realms" }],
    related: ["war", "faith", "tongues", "markets"],
  },
  faith: {
    icon: "✨",
    title: "Faith",
    what: [
      "A faith is founded on omens: what befell a land in a year — the god's own acts, a famine, a drought, a first sowing — each speaking of a god, the more readily the more pious its people.",
      "It spreads to neighbours alike in speech, by roads, the faster from a holy seat, the slower to a land already holding a faith.",
      "Where three or more of its lands no longer speak like its home, they may break away: a schism, a faith of their own.",
    ],
    drives: ["Omens and piety; speech and roads for its spread."],
    leads: [
      "Piety growing; the temple's say in the tithe and in holy war; warmth between realms of one faith.",
    ],
    see: [
      { text: "The faiths by their faithful", ref: "world:ledger#faiths" },
      { text: "The faiths through the years", ref: "world:chronicle#lives" },
    ],
    related: ["tongues", "diplomacy", "hand", "realms"],
  },
  tongues: {
    icon: "🗣️",
    title: "Tongues",
    what: [
      "Each land's speech drifts: a sound lost or gained now and then, a sound borrowed from its best-linked neighbour.",
      "A land whose speech has drifted far from its language's standard becomes a new language of the same family; a land more like its neighbours' language goes over to it.",
      "A land ruled from a seat of another speech slowly takes up its rulers' tongue, the faster with roads and writing.",
    ],
    drives: ["Drift, roads, rule from afar, writing."],
    leads: [
      "How alike two lands' speech is weighs on nearly everything: joining a realm, grievance, the spread of faith and of learning, regard between realms.",
    ],
    see: [{ text: "The tongues by their speakers", ref: "world:ledger#tongues" }],
    related: ["faith", "lore", "grievance", "diplomacy"],
  },
  lore: {
    icon: "💡",
    title: "What is known",
    what: [
      "Knowledge is a tree of principles, each needing others before it (the plough needs beasts that pull) and some a land's own ground: a river, a coast, hills, an ore near.",
      "Each year a land may find a principle for itself — slowly, the more readily with craftsmen, farmers, traders and leaders, a market town, or a hunger to spur it — or learn one a neighbour knows, the more readily the more alike they speak, by roads, within one realm, with writing.",
      "Each principle known changes the land: its yields, its stores, its crafts, its health, its reach, its arms.",
    ],
    drives: ["Its people's work, its ground, its neighbours, hunger."],
    leads: [
      "The ages: sowing, metal, engines, electricity, flight.",
      "Everything the principles change, from harvests to hosts.",
    ],
    see: [
      { text: "What emerged, where first, how far it spread", ref: "world:chronicle#firsts" },
      { text: "What each realm knows", ref: "world:ledger#might" },
    ],
    related: ["ages", "herding", "markets", "tongues"],
  },
  markets: {
    icon: "⚖️",
    title: "Markets and prices",
    what: [
      "Each peopled land has a market of twelve goods, each priced in grain — there is no money. Each year its people make what is worth most, and goods wear out.",
      "Goods go by road to neighbours, and by sea to coasts within its ships' reach, when the price between beats the cost of carrying them.",
      "Each year a price moves a third of the way toward its usual worth, raised by scarcity, lowered by plenty.",
    ],
    drives: ["What is made and wanted; the cost of carrying (hills, rivers, ships); carriers."],
    leads: [
      "Wages that move people between trades; trade that carries faith, learning and speech; relief in famine.",
      "The first goods down a road: a trade road opened, a sea route.",
    ],
    see: [{ text: "The first roads and routes", ref: "world:chronicle#firsts" }],
    related: ["food", "towns", "diplomacy", "matter"],
  },
  matter: {
    icon: "🧪",
    title: "Matter",
    what: [
      "Every good is made of something: grain of starch, protein and water; a tool of flint, copper, bronze, iron or steel on a wooden haft; pottery of fired clay. Each is made of substances, and each substance of elements, in shares that add up to the whole.",
      "Reactions turn one substance into another, and they balance, atom for atom: malachite and charcoal to copper and carbon dioxide; copper with a tenth of tin to bronze; red ore and charcoal to iron; sand, soda and lime to glass.",
      "A reaction wants its heat and its fuel, and a principle to teach it. A land makes what it knows how to, where the ore, the seam or the clay is within reach — and a good's page in a market says which ways are open there, and why the others are not.",
    ],
    drives: [
      "What lies in the ground (the deposits, laid down by the plates and the deep past).",
      "What the land's people have come to know (its lore), and what it can reach by road.",
    ],
    leads: [
      "What a land's tools, clothes, pots and machines are made of — and so how long they last and what they help.",
      "The fire that smelts and the fuel it burns: carbon dioxide into the air.",
    ],
    see: [
      { text: "Tools, the world over", ref: "good:tools" },
      { text: "Malachite, copper's green ore", ref: "subst:malachite" },
      { text: "The bloomery", ref: "rxn:bloomery" },
    ],
    related: ["markets", "lore", "climate"],
  },
  web: {
    icon: "🐾",
    title: "The web of eating",
    what: [
      "Life eats in levels: seed grass; the plant-eaters (grazers, browsers, great beasts, seed-eaters, swimmers); the small hunters and scavengers; the hunters.",
      "Each peopled land keeps its wilds against their untouched state: game, forest, soil, hunters, small game and fish. The wild regrows, and thins where foragers take too much; forest falls to fields; soil wears unless fields rest.",
      "Great beasts may be hunted out; hunters driven off when their game goes; with the hunters gone, game multiplies.",
    ],
    drives: ["Foraging, farming and fishing; herds guarded against hunters."],
    leads: [
      "What a land can feed, its harvests and famines; flocks taken by hunters; grain eaten by small game; the carbon of cleared forest.",
    ],
    see: [{ text: "Every lineage by its reach", ref: "world:ledger#life" }],
    related: ["food", "herding", "climate"],
  },
  herding: {
    icon: "🐄",
    title: "Herding",
    what: [
      "A farming land may tame a beast that lives about it — a docile, fast-growing grazer that goes in herds — or learn to herd from neighbours who do.",
      "Its herders keep flocks on the pasture, which give meat and milk, wool and hides.",
    ],
    drives: ["A tamable beast near; neighbours who herd; migrants and settlers carry it."],
    leads: [
      "More food and goods; herders against hunters (who take flocks until driven off); milk and cheese, and the principles after them.",
    ],
    see: [
      { text: "When herds first came, and how far they spread", ref: "world:chronicle#firsts" },
    ],
    related: ["web", "food", "lore"],
  },
  towns: {
    icon: "🏘️",
    title: "Towns and cities",
    what: [
      "Farming lands found villages, about one for every two hundred and fifty people settled, on the best land and water, apart from one another.",
      "Once a land has villages enough and craftsmen, traders and leaders enough, its best-placed village becomes its market town, where they live — and it outgrows the rest.",
      "A market town of a thousand becomes a city: blocks about a temple, markets and workshops along a road toward its trading partner, crowded houses as it swells.",
    ],
    drives: ["Farming, numbers, trades."],
    leads: [
      "Realms founded about market towns; the finding of new ways; cities reshaped by paved roads.",
    ],
    see: [{ text: "The towns, the largest first", ref: "world:ledger#towns" }],
    related: ["growth", "markets", "realms"],
  },
  climate: {
    icon: "🌦️",
    title: "Weather and climate",
    what: [
      "Each year a land's rain falls about its usual, more or less; far below it is a drought. The rain decides the wild food and the grain, and the flocks in part.",
      "The air holds the carbon of coal and oil burned and forest cleared; the land and sea take a little back each year. The world warms toward three degrees for each doubling, slowly.",
      "Warming moves the rain: dry lands drier, wet and cold lands wetter; hot lands yield less, cold lands more. The smoke of burning shortens lives.",
    ],
    drives: ["Chance, for the rain; engines and clearing, for the air."],
    leads: ["Droughts and harvests; lands drier or wetter as the world warms; famine."],
    see: [{ text: "The world's people, year by year", ref: "world:chronicle#story" }],
    related: ["food", "web", "hand"],
  },
  hand: {
    icon: "🖐️",
    title: "Watching, and the god's hand",
    what: [
      "Looking changes nothing: meeting a family, following a life or a land, watching a village — all of it is kept apart from history, which never reads it. The people met are drawn from the counts, and must fit them.",
      "The god's acts are another thing: rain or drought, a blessed or blighted harvest, plague or healing, a people taught, a shrine, a fire, a spring, a warmer or colder world. Each is recorded as an act, and all that follows from it cites it.",
      "The hand laid on a village makes its people each a life of their own, their births and deaths decided one by one.",
    ],
    drives: ["The viewer's own choices."],
    leads: ["Every act is an omen too: faiths founded, piety raised."],
    see: [],
    related: ["faith", "climate", "food"],
  },
  flight: {
    icon: "🚀",
    title: "Flight and colonies",
    what: [
      "A realm whose seat knows flight to orbit, and can build a rocket for its world, goes for three firsts in turn: a satellite, a crew, a station — each spurred on when another realm got there first.",
      "With a station, halls and flight between worlds, it may found a colony: five hundred settlers carrying its knowledge, farming under roofs, their land a land of the realm.",
      "With a star drive, a ship may sail for a livable world of another star — a land itself on the way — and become halls on arrival.",
    ],
    drives: ["Knowledge, machines, rivalry, hunger at home."],
    leads: [
      "The sky's firsts; colonies; ships to the stars; word from other peoples; wars between the stars.",
    ],
    see: [{ text: "The race to the sky", ref: "world:ledger#sky" }],
    related: ["lore", "realms", "ages"],
  },
  ages: {
    icon: "📜",
    title: "The ages",
    what: [
      "The chronicle tells history by age: foragers, farming, metal, industry, the modern age, flight to orbit, other worlds, the stars.",
      "A land comes into an age once it has come into the one before (it farms, then smelts too, then builds engines…), and the world's age is the first land's to reach it — so two reached in one year are one age.",
    ],
    drives: ["What is found, and where."],
    leads: ["Each age's towns, realms, wars and findings, compared."],
    see: [
      { text: "The ages compared", ref: "world:chronicle#ages" },
      { text: "The story, age by age", ref: "world:chronicle#story" },
    ],
    related: ["lore", "flight"],
  },
};

/** Which concept a number is a measure of, by its label on the pages. */
export const CONCEPT_OF: Readonly<Record<string, string>> = {
  Fed: "food",
  "Food put by": "food",
  "Brought in": "markets",
  Price: "markets",
  Market: "markets",
  "Market town": "towns",
  "A city since": "towns",
  Towns: "towns",
  People: "growth",
  Grievance: "grievance",
  Tithe: "tithe",
  Realm: "realms",
  Rule: "realms",
  Ruler: "realms",
  Seat: "realms",
  Regard: "diplomacy",
  Pact: "diplomacy",
  Embargo: "diplomacy",
  "At war": "war",
  Declared: "war",
  Battles: "war",
  Fallen: "war",
  Won: "war",
  "Won by": "war",
  "Wars fought": "war",
  "Its host": "war",
  "Armed with": "war",
  Faith: "faith",
  God: "faith",
  Believers: "faith",
  "Split from": "faith",
  Tongue: "tongues",
  Speakers: "tongues",
  Drift: "tongues",
  Family: "tongues",
  "Grew from": "tongues",
  "Last spoken": "tongues",
  Found: "lore",
  Herding: "herding",
  "Herded by the people": "herding",
  "In the web": "web",
  Level: "web",
  Hunters: "web",
  "Small hunters": "web",
  "Wild game": "web",
  "Small game": "web",
  "Grain eaten by small game": "web",
  "Raids the flocks of": "web",
  "Driven out of": "web",
  Rain: "climate",
  Warmth: "climate",
  Halls: "flight",
  "Sent out": "flight",
  Sailed: "flight",
  Fleet: "flight",
  Blessed: "hand",
  Shrine: "hand",
  Spring: "hand",
};

/** A page's numbers and facts, each linked to the concept it measures (where it has one). */
export function withConcepts(page: PageModel): PageModel {
  const mark = (s: Stat): Stat => {
    const id = CONCEPT_OF[s.label];
    // (Only to a concept the book has a page for.)
    return s.concept || !id || !CONCEPTS[id] ? s : { ...s, concept: id };
  };
  return {
    ...page,
    stats: page.stats.map(mark),
    tabs: page.tabs.map((t) => ({
      ...t,
      blocks: t.blocks.map((b) => (b.type === "facts" ? { ...b, rows: b.rows.map(mark) } : b)),
    })),
  };
}

/** A concept's page (`concept:<id>`), or the book's index (`concept:index`). */
export function conceptPage(world: World, ref: string): PageModel {
  const id = ref.slice("concept:".length),
    c = CONCEPTS[id];
  if (!c) return indexPage(world);
  const lines = (words: readonly string[]): Line[] => words.map((w) => [w]),
    blocks: Block[] = [
      { type: "text", lines: lines(c.what) },
      ...(c.drives.length
        ? [{ type: "text" as const, title: "What drives it", lines: lines(c.drives) }]
        : []),
      ...(c.leads.length
        ? [{ type: "text" as const, title: "What it leads to", lines: lines(c.leads) }]
        : []),
      ...(c.see.length
        ? [
            {
              type: "list" as const,
              title: "Where to see it",
              items: c.see.map((s) => ({ line: [link(s.text, s.ref)], ref: s.ref })),
            },
          ]
        : []),
      ...(c.related.length
        ? [
            {
              type: "list" as const,
              title: "Bound up with",
              items: c.related
                .filter((r) => CONCEPTS[r])
                .map((r) => ({
                  line: [link(`${CONCEPTS[r]!.icon} ${CONCEPTS[r]!.title}`, `concept:${r}`)],
                  ref: `concept:${r}`,
                })),
            },
          ]
        : []),
    ];
  return {
    ref,
    kind: "concept",
    icon: c.icon,
    title: c.title,
    // (Its way up leads to the book: the line under its name says what kind of page it is.)
    subtitle: ["one of the world's workings"],
    color: null,
    place: null,
    stats: [],
    tabs: [{ id: "what", name: "What it is", blocks }],
    followable: false,
    year: yearNow(world),
  };
}

/** The book's index: every concept, each opening its page. */
function indexPage(world: World): PageModel {
  return {
    ref: "concept:index",
    kind: "concept",
    icon: "📖",
    title: "The book of concepts",
    subtitle: ["what the numbers on the pages are measures of, and how the world turns"],
    color: null,
    place: null,
    stats: [],
    tabs: [
      {
        id: "index",
        name: "Concepts",
        blocks: [
          {
            type: "list",
            items: Object.entries(CONCEPTS).map(([id, c]) => ({
              line: [link(`${c.icon} ${c.title}`, `concept:${id}`), ` — ${c.what[0] ?? ""}`],
              ref: `concept:${id}`,
            })),
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}
