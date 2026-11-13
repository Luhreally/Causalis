// What is sold under each of a market's goods (asked 2026-11-12: "be specific what they sell like guns or cars etc cause those fall under
// machines and tools, or what type of food or plants they export ... but it also shouldnt just be a ton of bloated details"). The simulation
// trades fourteen broad goods; a person at a market meets named things: a land's own sown grain, the meat of its own flocks, its smiths'
// iron ploughshares and its realm's rifles, the motor cars and phones its works turn out. Each good here is split into the few things it is
// made of in this land this year, with a share each, read from what the world already keeps: its living kinds, what it knows, its books for
// five years, its works, its realm's host and design, and the year's trade for what came down the road (named as the land it came from
// makes it). Nothing here is kept, and history moves no differently for anyone reading it. A thing no land of this world could make never
// appears: each is asked of a principle a land knows, or of a kind that lives in it.
import { livingIn, offworldSite, type Species, worldChemistry } from "../../gen/index.ts";
import { hashString, type Ref, type World } from "../../kernel/index.ts";
import type { Block, Line, Span } from "../../bridge/index.ts";
import {
  ARMS_WEAR,
  designsOf,
  fieldedOf,
  homePlanet,
  kitKg,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  realmName,
  tameNow,
  townsOf,
  wildsOf,
  type Market,
  type ToolMetal,
} from "../../sim/index.ts";
import {
  G,
  GOOD_MATTER,
  GOODS,
  OCC,
  FORAGER_HIDES,
  HERD_GOODS,
  metalOf,
  roleWord,
  type Part,
} from "../../rules/index.ts";
import {
  flockOf,
  hostPartWords,
  landClay,
  landCloth,
  landStone,
  makingTown,
  metalFrom,
  workshopOf,
} from "../chain.ts";
import { landLink, landTitle } from "./names.ts";
import { link, sentence, yearNow } from "./words.ts";

/** One thing sold under a good: its name, its share of the good here, where it is made or comes from. */
export type Ware = {
  /** What it is, by kind: "grass:12", "metal:iron", "machine:engines", "from:340". */
  readonly key: string;
  readonly name: string;
  /** Its page (a kind, a design, a land), if it has one. */
  readonly ref: string | null;
  readonly share: number;
  /** Where it is made or comes from, as a line: "from the fields of Ur's land", "brought from Kish's land". */
  readonly from: Line;
  /** Made in this land (else brought in). */
  readonly made: boolean;
  /** The land it was brought from. */
  readonly land?: number;
};

/** At most this many things named under a good; the rest are "and others". */
export const WARES_SHOWN = 4;
/** A thing under this share is left among the others. */
const LEAST = 0.02;

type Raw = {
  readonly key: string;
  readonly name: string;
  readonly ref: string | null;
  readonly w: number;
  readonly from: Line;
};

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Whether a land knows a principle. */
const knows = (world: World, cell: number, id: string) => !!loreOf(world).get(cell, id);

/** A sown grass named as its grain: "brindled water grass" → "brindled water grain"; a millet stays a millet. */
export function grainName(s: Pick<Species, "name">): string {
  return /\bgrass$/.test(s.name) ? s.name.replace(/grass$/, "grain") : s.name;
}

/** A beast named without its coat's word of wool: "dun woolly sheep" → "dun sheep". */
const beastName = (s: Pick<Species, "name">) => s.name.replace(/\bwoolly /, "");

/** The town a land is named by in a short line: its market town, else its land's words. */
export function placeName(world: World, cell: number): string {
  return makingTown(world, cell)?.name ?? landTitle(world, cell, true);
}

/** A land by the town it is named by, a link to its page: "Ur". */
const placeLink = (world: World, cell: number): Span =>
  link(placeName(world, cell), `cell:0:${cell}`);

/** The books a land keeps for a good: what it made, brought in and holds. */
function booked(m: Market, good: number): { made: number; into: number; stock: number } {
  return { made: m.book("made", good), into: m.book("in", good), stock: m.stock[good]! };
}

// —— What a land makes of each good itself ——————————————————————————————————————————————————————

/** A land's own sown grains (and vats, where they feed it): the best seed it sows first. */
function ownGrain(world: World, cell: number): Raw[] {
  const g = homePlanet(world).generated,
    sown = g.life.seedGrass[cell] ?? -1,
    grasses = livingIn(g.life, cell)
      .filter((s) => s.niche === "seed grass" && tameNow(world, s))
      .sort((a, b) => b.seed - a.seed || a.index - b.index),
    out: Raw[] = [],
    fields: Line = ["from the fields of ", landLink(world, cell, true)],
    rest = grasses.filter((s) => s.index !== sown).slice(0, 3),
    restSeed = rest.reduce((n, s) => n + s.seed, 0);
  const first = sown >= 0 ? g.life.species[sown] : undefined;
  if (first)
    out.push({
      key: `grass:${first.index}`,
      name: grainName(first),
      ref: first.ref,
      w: 1,
      from: fields,
    });
  for (const s of rest)
    out.push({
      key: `grass:${s.index}`,
      name: grainName(s),
      ref: s.ref,
      // (Its others sown beside it, by how heavy their seed is against its own.)
      w: first ? (0.3 * s.seed) / Math.max(1e-9, first.seed) : s.seed / Math.max(1e-9, restSeed),
      from: fields,
    });
  // (Where no grass with seed grows, what its people tend: beds of weed and shell under water, roots and fruit in gardens on land, as the
  // simulation found cultivation there; beyond its world, what it grows under cover.)
  if (!out.length) {
    const off = offworldSite(g, cell),
      water = populationContext(world).medium !== "land" && g.tectonics.elevation[cell]! <= 0;
    out.push(
      off
        ? {
            key: "domes",
            name: "food grown under cover",
            ref: null,
            w: 1,
            from: ["grown in the halls of ", landLink(world, cell, true)],
          }
        : water
          ? {
              key: "beds",
              name: "weed and shell from tended beds",
              ref: null,
              w: 1,
              from: ["from the beds of ", landLink(world, cell, true)],
            }
          : {
              key: "gardens",
              name: "garden roots and tubers",
              ref: null,
              w: 1,
              from: ["from the gardens of ", landLink(world, cell, true)],
            },
    );
  }
  if (knows(world, cell, "vat-food"))
    out.push({
      key: "vats",
      name: "vat-grown food",
      ref: null,
      w: 0.35,
      from: ["grown in the vats of ", landLink(world, cell, true)],
    });
  return out;
}

/** A land's herds' meat, and their milk where it knows dairying. */
function ownMeat(world: World, cell: number): Raw[] {
  const beast = flockOf(world, cell),
    from: Line = ["from the herds of ", landLink(world, cell, true)];
  if (!beast) return [{ key: "meat", name: "meat", ref: null, w: 1, from }];
  const name = beastName(beast),
    out: Raw[] = [{ key: `meat:${beast.index}`, name: `${name} meat`, ref: beast.ref, w: 1, from }];
  if (knows(world, cell, "dairying"))
    out.push({
      key: `milk:${beast.index}`,
      name: `${name} milk and cheese`,
      ref: beast.ref,
      // (Milked the more as the beast is tame.)
      w: 0.25 + 0.5 * beast.docility,
      from,
    });
  if (knows(world, cell, "salting"))
    out.push({ key: "salted", name: `salted ${name}`, ref: beast.ref, w: 0.2, from });
  return out;
}

/** What a land's foragers, hunters and fishers bring in: its own fish, game and gathering. */
function ownWild(world: World, cell: number): Raw[] {
  const living = livingIn(homePlanet(world).generated.life, cell),
    land = landLink(world, cell, true),
    out: Raw[] = [],
    fish = living.filter((s) => s.niche === "swimmer").sort((a, b) => b.size - a.size)[0],
    game = living
      .filter((s) => (s.niche === "grazer" || s.niche === "browser") && !tameNow(world, s))
      .sort((a, b) => b.size - a.size)[0],
    wildSeed = living.filter((s) => s.niche === "seed grass").sort((a, b) => b.seed - a.seed)[0],
    // (Each by how much of it its land has left, against what it had untouched: its waters' life, its game, its woods and soil.)
    wilds = wildsOf(populationContext(world), cell);
  if (fish && (knows(world, cell, "fishing") || populationContext(world).medium === "water"))
    out.push({
      key: `fish:${fish.index}`,
      name: fish.name,
      ref: fish.ref,
      w: 0.45 * Math.max(0.05, wilds.fish),
      from: ["caught in the waters of ", land],
    });
  if (game)
    out.push({
      key: `game:${game.index}`,
      name: `${game.name} game`,
      ref: game.ref,
      w: 0.35 * Math.max(0.05, wilds.wild),
      from: ["hunted in ", land],
    });
  out.push({
    key: "gathered",
    name: wildSeed
      ? `${/\bwild\b/.test(wildSeed.name) ? "" : "wild "}${grainName(wildSeed)}, roots and fruit`
      : "roots, seeds and fruit",
    ref: wildSeed?.ref ?? null,
    w: 0.3 * Math.max(0.1, (wilds.forest + wilds.soil) / 2),
    from: ["gathered in ", land],
  });
  return out;
}

/** The fibre a land's flocks give. */
function ownWool(world: World, cell: number): Raw[] {
  const beast = flockOf(world, cell),
    from: Line = ["shorn from the flocks of ", landLink(world, cell, true)];
  if (!beast) return [{ key: "wool", name: "wool", ref: null, w: 1, from }];
  // (A coat of scales, shell, plates or a slick skin gives no wool: what is combed from it is its fibre, as the market sells it.)
  const covering = beast.wool ? "wool" : (beast.body?.covering ?? "wool"),
    fibre =
      covering === "wool"
        ? "wool"
        : covering === "fur"
          ? "hair"
          : covering === "feathers"
            ? "down"
            : "fibre";
  return [
    {
      key: `wool:${beast.index}`,
      name: `${beastName(beast)} ${fibre}`,
      ref: beast.ref,
      w: 1,
      from:
        fibre === "wool"
          ? from
          : [
              `${fibre === "hair" ? "combed" : "plucked"} from the flocks of `,
              landLink(world, cell, true),
            ],
    },
  ];
}

/** A land's hides: its herds' (by its meat, as the year's herds give them) and its hunters' (by its foragers). */
function ownHides(world: World, cell: number, m: Market): Raw[] {
  const p = populationContext(world).provinces.get(cell),
    beast = flockOf(world, cell),
    herd = m.book("made", G.meat) * HERD_GOODS.hidesPerMeat,
    hunted = (p?.occupation(OCC.forager) ?? 0) * FORAGER_HIDES,
    game = livingIn(homePlanet(world).generated.life, cell)
      .filter((s) => (s.niche === "grazer" || s.niche === "browser") && !tameNow(world, s))
      .sort((a, b) => b.size - a.size)[0],
    out: Raw[] = [];
  if (herd > 0)
    out.push({
      key: `hide:${beast?.index ?? "herd"}`,
      name: beast ? `${beastName(beast)} hides` : "hides of its herds",
      ref: beast?.ref ?? null,
      w: herd,
      from: ["from the herds of ", landLink(world, cell, true)],
    });
  if (hunted > 0 || !out.length)
    out.push({
      key: `skin:${game?.index ?? "game"}`,
      name: game ? `${game.name} skins` : "skins of the hunt",
      ref: game?.ref ?? null,
      w: Math.max(hunted, 1e-6),
      from: ["brought in by the hunters of ", landLink(world, cell, true)],
    });
  return out;
}

/** A metal a land smelts: named by its ore and how it lies. */
function ownMetal(world: World, cell: number, kind: "copper" | "tin" | "iron"): Raw[] {
  const chem = worldChemistry(homePlanet(world).generated),
    name = roleWord(chem, kind),
    from = metalFrom(world, cell, kind);
  return [
    {
      key: `metal:${kind}`,
      name: kind === "iron" && /^bog /.test(from) ? "bog iron" : name,
      ref: null,
      w: 1,
      from: [sentence(from).replace(/^./, (c) => c.toLowerCase())],
    },
  ];
}

/** A fuel dug or drawn from under a land: called by its land's town, as markets call a coal by where it is dug. */
function ownFuel(world: World, cell: number, good: number): Raw[] {
  const coal = good === G.coal;
  return [
    {
      key: coal ? "coal" : "oil",
      name: makingTown(world, cell)
        ? `${placeName(world, cell)} ${coal ? "coal" : "crude"}`
        : coal
          ? "seam coal"
          : "crude oil",
      ref: null,
      w: 1,
      from: [
        coal ? "dug from the seam under " : "drawn from the field under ",
        landLink(world, cell, true),
      ],
    },
  ];
}

/** A land's potters' ware, of its own clay, and its glass where it knows glass. */
function ownPottery(world: World, cell: number): Raw[] {
  const clay = landClay(world, cell),
    town = makingTown(world, cell),
    kiln = workshopOf(world, town?.ref ?? null, ["kiln"], yearNow(world)),
    at: Line = kiln
      ? ["fired at ", link(kiln.name, kiln.ref)]
      : ["fired in ", landLink(world, cell, true)],
    // (A ware is sold by its name: "red earthenware", "grey ware"; a terracotta, as its pots.)
    out: Raw[] = [
      {
        key: `ware:${clay.ware}`,
        name: /ware$/.test(clay.ware) ? clay.ware : `${clay.ware} pots`,
        ref: null,
        w: 1,
        from: at,
      },
    ];
  if (knows(world, cell, "glass"))
    out.push({ key: "glass", name: "glass bottles and jars", ref: null, w: 0.3, from: at });
  return out;
}

/** A land's clothes: woven of its own fibre and sewn of leather, by what its books say its weavers and tanners used. */
function ownClothing(world: World, cell: number, m: Market): Raw[] {
  const cloth = landCloth(world, cell),
    woven = (m.book("used", G.wool) / 6) * 5,
    leather = (m.book("used", G.hides) / 4) * 3,
    dyed = knows(world, cell, "dyeing"),
    mill = !!m.works && knows(world, cell, "factories"),
    out: Raw[] = [];
  if (woven > 0 || leather <= 0)
    out.push({
      key: `cloth:${cloth.kind}`,
      name: `${dyed ? "dyed " : ""}${cloth.kind} clothes`,
      ref: null,
      w: Math.max(woven, 1e-6),
      from: [mill ? "woven in the mills of " : "woven in ", landLink(world, cell, true)],
    });
  if (leather > 0)
    out.push({
      key: "leather",
      name: "leather coats and boots",
      ref: null,
      w: leather,
      from: ["sewn by the tanners of ", landLink(world, cell, true)],
    });
  return out;
}

/** What a tool of each metal is, at a market: the things a smith would hang on the rack. */
const TOOL_KINDS: Readonly<Record<ToolMetal, string>> = {
  stone: "blades and scrapers",
  copper: "axes and awls",
  bronze: "axes and sickles",
  iron: "ploughshares, axes and sickles",
  steel: "saws, axes and ploughshares",
};

/** A metal's name as its world makes it: "arsenical copper", "carbide iron". */
function metalWord(world: World, metal: ToolMetal, cell: number): string {
  if (metal === "stone") return landStone(world, cell).stone.name;
  const chem = worldChemistry(homePlanet(world).generated);
  return chem.solar ? metal : metalOf(chem, metal).name;
}

/**
 * A land's tools by metal: each of its last five years' tools as headed with the metal its tools were headed with that year (the books
 * say so: sim/economy/market.ts toolMetals), and a better metal its smiths forge this year at a share of what heads a fair share of them.
 */
function ownTools(world: World, cell: number, m: Market): Raw[] {
  const by = new Map<ToolMetal, number>();
  for (const y of m.years) {
    const metal = m.toolMetalIn(y.year) ?? "stone";
    by.set(metal, (by.get(metal) ?? 0) + (y.ledger[0]?.[G.tools] ?? 0));
  }
  const head = m.toolMetalIn() ?? "stone",
    forged = m.forgedIn() ?? head,
    total = [...by.values()].reduce((a, b) => a + b, 0);
  if (!total) by.set(head, 1);
  if (forged !== head && METALS_RANK.indexOf(forged) > METALS_RANK.indexOf(head))
    by.set(forged, (by.get(forged) ?? 0) + Math.max(1, total) * 0.12);
  const town = makingTown(world, cell),
    year = yearNow(world),
    smithy =
      workshopOf(world, town?.ref ?? null, ["factory"], year) ??
      workshopOf(world, town?.ref ?? null, ["smithy", "workshop"], year);
  return [...by].map(([metal, n]) => ({
    key: `tools:${metal}`,
    name: `${metalWord(world, metal, cell)} ${TOOL_KINDS[metal]}`,
    ref: null,
    w: n,
    from:
      metal === "stone"
        ? ["knapped in ", landLink(world, cell, true)]
        : smithy
          ? ["made at ", link(smithy.name, smithy.ref)]
          : ["made by the smiths of ", landLink(world, cell, true)],
  }));
}
const METALS_RANK: readonly ToolMetal[] = ["stone", "copper", "bronze", "iron", "steel"];

/** A machine a land's works can turn out: the principle it asks, its weight among them, what makes it fall away. */
type MachineKind = {
  readonly id: string;
  readonly asks: readonly string[];
  readonly name: string;
  /** Its name where they live in water (else the same). */
  readonly water?: string;
  /** Its name off Earth, where a world's own word is plainer (else the same). */
  readonly alien?: string;
  /** What a company making it is called after the town's name. */
  readonly works: string;
  readonly w: number;
  /** Once any of these is known, it is made the less (a fifth). */
  readonly fades?: readonly string[];
};

export const MACHINE_KINDS: readonly MachineKind[] = [
  {
    id: "clocks",
    asks: ["clockwork"],
    name: "clocks",
    works: "Clock Works",
    w: 0.25,
    fades: ["electronics"],
  },
  {
    id: "looms",
    asks: ["factories", "loom"],
    name: "power looms",
    works: "Loom Works",
    w: 0.6,
    fades: ["electricity"],
  },
  {
    id: "steam",
    asks: ["steam-engine", "factories"],
    name: "steam engines",
    works: "Engine Works",
    w: 1,
    fades: ["engines", "electricity"],
  },
  {
    id: "rails",
    asks: ["railways"],
    name: "locomotives and wagons",
    works: "Locomotive Works",
    w: 1.1,
    fades: ["powered-wings"],
  },
  {
    id: "ships",
    asks: ["steamships"],
    name: "ships' engines",
    works: "Marine Engine Company",
    w: 0.5,
  },
  {
    id: "currents",
    asks: ["current-mills"],
    name: "current mills",
    works: "Current Mills",
    w: 0.9,
    fades: ["sea-electricity"],
  },
  { id: "sun", asks: ["sun-engines"], name: "sun engines", works: "Sun Engine Works", w: 0.9 },
  { id: "heat", asks: ["heat-engines"], name: "heat engines", works: "Heat Engine Works", w: 0.9 },
  {
    id: "dynamos",
    asks: ["electricity"],
    name: "dynamos and motors",
    works: "Electric Company",
    w: 1,
    fades: ["solid-state"],
  },
  {
    id: "sea-dynamos",
    asks: ["sea-electricity"],
    name: "current dynamos",
    works: "Electric Company",
    w: 1,
  },
  {
    id: "ground-dynamos",
    asks: ["ground-dynamos"],
    name: "ground dynamos",
    works: "Electric Company",
    w: 1,
  },
  {
    id: "cars",
    asks: ["engines"],
    name: "motor cars and lorries",
    alien: "motor carriages",
    works: "Motor Works",
    w: 1.7,
  },
  {
    id: "wings",
    asks: ["powered-wings"],
    name: "aeroplanes",
    alien: "flying machines",
    works: "Aircraft Works",
    w: 0.8,
  },
  {
    id: "telegraph",
    asks: ["telegraph"],
    name: "telegraph sets",
    works: "Telegraph Works",
    w: 0.5,
    fades: ["telephone", "radio"],
  },
  {
    id: "telephone",
    asks: ["telephone"],
    name: "telephones",
    works: "Telephone Company",
    w: 0.8,
    fades: ["pocket-machines"],
  },
  {
    id: "radio",
    asks: ["radio"],
    name: "radio sets",
    works: "Radio Company",
    w: 0.8,
    fades: ["networks"],
  },
  {
    id: "sea-sound",
    asks: ["sea-sound"],
    name: "sound sets for the deep",
    works: "Sound Company",
    w: 0.8,
  },
  {
    id: "computers",
    asks: ["computing"],
    name: "computers",
    alien: "reckoning machines",
    works: "Computing Company",
    w: 1.3,
  },
  {
    id: "phones",
    asks: ["pocket-machines"],
    name: "phones",
    alien: "pocket machines",
    works: "Pocket Machines",
    w: 1.8,
  },
  { id: "minds", asks: ["machine-minds"], name: "thinking machines", works: "Mind Works", w: 1.1 },
  { id: "bodies", asks: ["made-bodies"], name: "made bodies", works: "Body Works", w: 0.7 },
];

/** A machine kind's name on this world, for this people. */
export function machineName(world: World, k: MachineKind): string {
  if (populationContext(world).medium === "water" && k.water) return k.water;
  return homePlanet(world).generated.prior === "earthlike" || !k.alien ? k.name : k.alien;
}

/** The machines a land's works turn out, by what it knows: the newer the more, the older fading. */
function ownMachines(world: World, cell: number, m: Market): Raw[] {
  const town = makingTown(world, cell),
    works = workshopOf(world, town?.ref ?? null, ["factory"], yearNow(world)),
    from: Line = works
      ? ["made at ", link(works.name, works.ref)]
      : ["made in the works of ", landLink(world, cell, true)];
  const out: Raw[] = [],
    lean = leanOf(world, cell, m);
  for (const k of MACHINE_KINDS) {
    if (!k.asks.every((id) => knows(world, cell, id))) continue;
    const faded = (k.fades ?? []).some((id) => knows(world, cell, id));
    out.push({
      key: `machine:${k.id}`,
      name: machineName(world, k),
      ref: null,
      w: k.w * (faded ? 0.2 : 1) * lean(k.id),
      from,
    });
  }
  if (!out.length) out.push({ key: "machine", name: "machines", ref: null, w: 1, from });
  return out;
}

/**
 * What a land's works lean to, a kind of machine at a time: its railway yards to locomotives, its docks to ships' engines, its own oil to
 * motor cars, how much of its dealings is on the line to what carries a word; and each works' own bent, kept by the land (a keyed share,
 * the same every reading), so that two lands that know the same do not make the same.
 */
function leanOf(world: World, cell: number, m: Market): (id: string) => number {
  const ctx = populationContext(world),
    year = yearNow(world),
    civic = (kind: string) =>
      ctx.settlements
        .seenIn(cell)
        .some((s) =>
          (townsOf(world).get(s.ref as Ref)?.civics ?? []).some(
            (c) => c.kind === kind && c.end <= year && c.fell === null,
          ),
        ),
    line = Math.min(1, loreOf(world).effect(cell, "signal")),
    rails = civic("station"),
    docks = civic("docks"),
    oil = m.book("made", G.oil) > 0;
  return (id) => {
    const bent = 0.55 + 0.9 * ((hashString(`${cell}:${id}`, 0x6d61) >>> 0) / 4294967296);
    switch (id) {
      case "rails":
        return bent * (rails ? 1.6 : 0.6);
      case "ships":
        return bent * (docks ? 1.8 : 0.3);
      case "cars":
        return bent * (oil ? 1.5 : 0.9);
      case "telephone":
      case "radio":
      case "computers":
      case "phones":
        return bent * (0.4 + line);
      default:
        return bent;
    }
  };
}

// —— Arms: a part of tools where smiths forge them, of machines where works turn them out —————————————

/** What a realm's host's kit is worked from, by the good it is sold under (tools: a smith's metal; machines: a works'). */
const ARMS_GOOD: Readonly<Record<string, number>> = {
  copper: G.tools,
  bronze: G.tools,
  iron: G.tools,
  steel: G.tools,
  machined: G.machines,
  "wound works": G.machines,
  crystal: G.machines,
};

/**
 * The arms a land makes for its realm's host this year, under a good: each worked part of its design (its arm, its guard, its mount where
 * it is made at works), and how much of it, as so many of the good's units by weight — the kit's weight a man (rules/matter.ts ROLE_KG),
 * worn out and made good at ARMS_WEAR a year, for the men it fields, this land's share by its people.
 */
function ownArms(world: World, cell: number, good: number): Raw[] {
  const ctx = populationContext(world),
    realm = politiesOf(world).of(cell),
    d = realm ? designsOf(world).of(realm.ref) : undefined;
  if (!realm || !d) return [];
  const parts = d.parts.filter((p) => ARMS_GOOD[p.material] === good);
  if (!parts.length) return [];
  const pop = [...realm.members].reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    mine = ctx.provinces.get(cell)?.total() ?? 0,
    men = fielded(world, realm.ref) * (pop > 0 ? mine / pop : 0),
    unit = GOOD_MATTER[GOODS[good]!.id]?.unitKg ?? 2,
    year = yearNow(world),
    at = good === G.machines ? ["factory"] : ["smithy", "factory", "workshop"],
    shop = workshopOf(world, makingTown(world, cell)?.ref ?? null, at, year);
  return parts.map((p: Part) => {
    const kg = kitKg([p]),
      perMan = [...kg.values()].reduce((a, b) => a + b, 0);
    return {
      key: `arms:${p.role}:${p.id}`,
      name: hostPartWords(world, realm.ref, p).replace(/^with /, ""),
      ref: d.ref,
      w: Math.max(0, (men * perMan * ARMS_WEAR) / unit),
      from: [
        "for the host of ",
        link(realmName(realm), realm.ref),
        shop ? ", made at " : ", made in ",
        shop ? link(shop.name, shop.ref) : landLink(world, cell, true),
      ],
    };
  });
}

/** The men a realm fields, once a world's moment (the same for every land of it). */
function fielded(world: World, realm: string): number {
  const c = cacheOf(world),
    had = c.fielded.get(realm);
  if (had !== undefined) return had;
  const p = politiesOf(world).get(realm as Ref),
    n = p ? fieldedOf(populationContext(world), p) : 0;
  c.fielded.set(realm, n);
  return n;
}

// —— Shares ——————————————————————————————————————————————————————————————————————————————————

/** What a land makes of a good itself, before shares: each thing and its weight among them. */
function ownRaw(world: World, cell: number, good: number, m: Market): Raw[] {
  switch (good) {
    case G.grain:
      return ownGrain(world, cell);
    case G.meat:
      return ownMeat(world, cell);
    case G.wild:
      return ownWild(world, cell);
    case G.wool:
      return ownWool(world, cell);
    case G.hides:
      return ownHides(world, cell, m);
    case G.copper:
      return ownMetal(world, cell, "copper");
    case G.tin:
      return ownMetal(world, cell, "tin");
    case G.iron:
      return ownMetal(world, cell, "iron");
    case G.coal:
    case G.oil:
      return ownFuel(world, cell, good);
    case G.pottery:
      return ownPottery(world, cell);
    case G.clothing:
      return ownClothing(world, cell, m);
    case G.tools:
      return ownTools(world, cell, m);
    case G.machines:
      return ownMachines(world, cell, m);
    default:
      return [];
  }
}

/** Weights to shares that sum to one. */
function shares(raw: readonly Raw[]): (Raw & { share: number })[] {
  const sum = raw.reduce((n, r) => n + Math.max(0, r.w), 0);
  return raw.map((r) => ({ ...r, share: sum > 0 ? Math.max(0, r.w) / sum : 1 / raw.length }));
}

/** What a land makes of a good itself, as shares (its arms among them), each said once. */
function madeHere(world: World, cell: number, good: number): (Raw & { share: number })[] {
  const c = cacheOf(world),
    key = `${cell}:${good}`,
    had = c.made.get(key);
  if (had) return had;
  const m = marketsOf(world).get(cell);
  if (!m) return [];
  const own = shares(ownRaw(world, cell, good, m)),
    // (What the land's own makers turned out this year; in a year of glut, when they made none, what it used of what it held.)
    made = Math.max(0, m.book("made", good) || m.book("used", good)),
    arms = good === G.tools || good === G.machines ? ownArms(world, cell, good) : [],
    armsW = arms.reduce((n, a) => n + a.w, 0),
    // (The host's kit as a part of what the land makes of the good: at most half of it, its own makers' work the rest.)
    armsShare = made > 0 || armsW > 0 ? Math.min(0.5, armsW / Math.max(1, made + armsW)) : 0,
    out = [
      ...own.map((r) => ({ ...r, share: r.share * (1 - armsShare) })),
      ...shares(arms).map((a) => ({ ...a, share: a.share * armsShare })),
    ]
      .filter((r) => r.share > 0)
      .sort((a, b) => b.share - a.share || (a.key < b.key ? -1 : 1));
  c.made.set(key, out);
  return out;
}

/**
 * Everything sold under a good at a land's market, with its share: what the land makes, and what came down each road, named as the land it
 * came from makes it. The few greatest, then "and others" for the rest (none: no one here has any).
 */
export function waresOf(world: World, cell: number, good: number): readonly Ware[] {
  const c = cacheOf(world),
    key = `${cell}:${good}`,
    had = c.wares.get(key);
  if (had) return had;
  const m = marketsOf(world).get(cell),
    out: Ware[] = [];
  if (m && (m.book("made", good) > 0 || m.book("in", good) > 0 || m.stock[good]! > 0)) {
    // (What it made this year; else, with nothing brought in, what it holds from years before.)
    const { made, into, stock } = booked(m, good),
      own = made > 0 ? made : into > 0 ? 0 : stock,
      // (Each thing once, by its name: how much of it was made here, how much came down each road.)
      merged = new Map<
        string,
        { w: Omit<Ware, "share" | "from">; here: number; mine: Line; roads: Map<number, number> }
      >();
    const put = (
      w: Omit<Ware, "share" | "from">,
      n: number,
      mine: Line | null,
      road: number | null,
    ) => {
      const x = merged.get(w.name) ?? { w, here: 0, mine: [], roads: new Map<number, number>() };
      merged.set(w.name, x);
      if (mine) {
        x.here += n;
        x.mine = mine;
      }
      if (road !== null) x.roads.set(road, (x.roads.get(road) ?? 0) + n);
    };
    if (own > 0)
      for (const r of madeHere(world, cell, good))
        put({ key: r.key, name: r.name, ref: r.ref, made: true }, own * r.share, r.from, null);
    if (into > 0) {
      const from = new Map<number, number>();
      for (const f of marketsOf(world).flowsOf([cell]))
        if (f.to === cell && f.good === good && f.from !== cell)
          from.set(f.from, (from.get(f.from) ?? 0) + f.count);
      const told = [...from.values()].reduce((a, b) => a + b, 0),
        scale = told > 0 ? into / told : 0;
      // (What came down a road, as the land that made it makes it: its own mix, not its greatest alone.)
      for (const [src, n] of [...from].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
        const mix = madeHere(world, originOf(world, src, good), good);
        if (!mix.length)
          put(
            { key: `from:${src}`, name: GOODS[good]!.name, ref: null, made: false, land: src },
            n * scale,
            null,
            src,
          );
        for (const r of mix)
          put(
            { key: r.key, name: r.name, ref: r.ref, made: false, land: src },
            n * scale * r.share,
            null,
            src,
          );
      }
    }
    const all = [...merged.values()].map((x) => {
        const roads = [...x.roads].sort((a, b) => b[1] - a[1] || a[0] - b[0]),
          brought: Span[] = roads.length
            ? [
                "brought from ",
                placeLink(world, roads[0]![0]),
                ...(roads.length === 2 ? [" and ", placeLink(world, roads[1]![0])] : []),
                ...(roads.length > 2 ? [` and ${roads.length - 1} more`] : []),
              ]
            : [],
          from: Line =
            x.here > 0 && brought.length
              ? [...x.mine, "; and ", ...brought]
              : x.here > 0
                ? x.mine
                : brought;
        return {
          w: { ...x.w, made: x.here > 0, ...(x.here > 0 ? {} : { land: roads[0]?.[0] }), from },
          n: x.here + roads.reduce((s, r) => s + r[1], 0),
        };
      }),
      sum = all.reduce((n, x) => n + x.n, 0);
    const ranked = all
      .map((x) => ({ ...x.w, share: sum > 0 ? x.n / sum : 0 }) as Ware)
      .sort((a, b) => b.share - a.share || (a.key < b.key ? -1 : 1));
    const shown = ranked.filter((w, i) => i < WARES_SHOWN && w.share >= LEAST),
      rest = 1 - shown.reduce((n, w) => n + w.share, 0);
    // (The rest as others where they come to a share worth saying; else the few said share the whole.)
    if (rest >= LEAST && ranked.length > shown.length) {
      out.push(...shown);
      out.push({ key: "others", name: "and others", ref: null, share: rest, from: [], made: true });
    } else {
      const said = shown.reduce((n, w) => n + w.share, 0);
      out.push(...shown.map((w) => ({ ...w, share: said > 0 ? w.share / said : w.share })));
    }
  }
  c.wares.set(key, out);
  return out;
}

/**
 * The greatest thing of a good a land sells on, as it would be called where it is sold: what it makes of it; where it made none and only
 * sells on what came to it, what the land that sent it the most makes (a few roads back at most). Null: none.
 */
export function topOf(world: World, cell: number, good: number): Ware | null {
  const r = madeHere(world, originOf(world, cell, good), good)[0];
  return r
    ? { key: r.key, name: r.name, ref: r.ref, share: r.share, from: r.from, made: true }
    : null;
}

/** The land whose making a land sells on of a good: its own, where it made any; else the one that sent it the most, a few roads back at most. */
function originOf(world: World, cell: number, good: number, hops = 0): number {
  const markets = marketsOf(world),
    m = markets.get(cell);
  if (!m || m.book("made", good) > 0 || hops >= 3) return cell;
  let best = -1,
    most = 0;
  for (const f of markets.flowsOf([cell]))
    if (f.to === cell && f.good === good && f.from !== cell && f.count > most) {
      most = f.count;
      best = f.from;
    }
  return best >= 0 ? originOf(world, best, good, hops + 1) : cell;
}

/** What a land itself makes of a good, each thing with its share of that making (its arms among them), the greatest first. */
export function madeWares(world: World, cell: number, good: number): readonly Ware[] {
  return madeHere(world, cell, good).map((r) => ({
    key: r.key,
    name: r.name,
    ref: r.ref,
    share: r.share,
    from: r.from,
    made: true,
  }));
}

/** The greatest thing a land itself makes of a good (null: none). */
export function topMade(world: World, cell: number, good: number): Ware | null {
  const r = madeHere(world, cell, good)[0];
  return r
    ? { key: r.key, name: r.name, ref: r.ref, share: r.share, from: r.from, made: true }
    : null;
}

/** The colours of a good's things, in turn. */
const COLOURS: readonly (readonly [number, number, number])[] = [
  [0.82, 0.6, 0.28],
  [0.44, 0.62, 0.42],
  [0.36, 0.52, 0.74],
  [0.7, 0.4, 0.5],
  [0.6, 0.6, 0.6],
];

/** What is sold under a good here, as its page shows it: the few greatest with their shares and where each is from. */
export function waresBlock(world: World, cell: number, good: number): Block | null {
  const wares = waresOf(world, cell, good);
  if (!wares.length) return null;
  const name =
    GOODS[good]!.id === "tin"
      ? roleWord(worldChemistry(homePlanet(world).generated), "tin")
      : GOODS[good]!.name;
  return {
    type: "composition",
    title: `What is sold as ${name} here`,
    parts: wares.map((w, i) => ({
      name:
        w.key === "others"
          ? [`${cap(w.name)}`]
          : ([w.ref ? link(cap(w.name), w.ref) : cap(w.name), ", ", ...w.from] as Span[]),
      share: w.share,
      color: w.key === "others" ? COLOURS[4]! : COLOURS[i % 4]!,
    })),
    note: "By what its land made and what came down its roads this year: the few greatest, the rest as others.",
  };
}

// —— What a land sends and brings, said specifically ————————————————————————————————————————————

/** A list in words: "a, b and c"; where a thing is itself two ("motor cars and lorries"), "motor cars and lorries, and steel". */
export function andList(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  const last = xs.some((x) => / and /.test(x)) ? ", and " : " and ";
  return `${xs.slice(0, -1).join(", ")}${last}${xs.at(-1)}`;
}

/**
 * What a land sent away last year and what it brought in, specifically, by the land at the road's other end: "brindled water grain and
 * rifles to Ur; woollen clothes to Kish". The greatest few partners by worth, two things each at most; the rest counted.
 */
export function tradeWords(
  world: World,
  cell: number,
  way: "out" | "in",
  most = 3,
): { readonly line: Line; readonly partners: number } | null {
  const flows = marketsOf(world)
    .flowsOf([cell])
    .filter((f) =>
      way === "out" ? f.from === cell && f.to !== cell : f.to === cell && f.from !== cell,
    );
  if (!flows.length) return null;
  const by = new Map<number, Map<string, number>>(),
    worth = new Map<number, number>();
  for (const f of flows) {
    const other = way === "out" ? f.to : f.from,
      maker = way === "out" ? cell : f.from,
      v = f.count * GOODS[f.good]!.value,
      top = topOf(world, maker, f.good),
      name = top && top.key !== "others" ? top.name : GOODS[f.good]!.name,
      m = by.get(other) ?? new Map<string, number>();
    m.set(name, (m.get(name) ?? 0) + v);
    by.set(other, m);
    worth.set(other, (worth.get(other) ?? 0) + v);
  }
  const partners = [...worth].sort((a, b) => b[1] - a[1] || a[0] - b[0]),
    line: Span[] = [];
  partners.slice(0, most).forEach(([other], i) => {
    const things = [...by.get(other)!]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 2)
      .map(([n]) => n);
    if (i) line.push("; ");
    line.push(
      `${andList(things)} ${way === "out" ? "to" : "from"} `,
      link(placeName(world, other), `cell:0:${other}`),
    );
  });
  if (partners.length > most) line.push(`; and ${partners.length - most} more`);
  return { line, partners: partners.length };
}

/** The trade between two lands last year, said specifically each way: "brindled water grain to Ur; rifles from Ur". */
export function betweenWords(world: World, a: number, b: number): Line | null {
  const out: Span[] = [];
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    const sums = new Map<string, number>();
    for (const f of marketsOf(world).flowsOf([from]))
      if (f.from === from && f.to === to) {
        const top = topOf(world, from, f.good),
          name = top?.name ?? GOODS[f.good]!.name;
        sums.set(name, (sums.get(name) ?? 0) + f.count * GOODS[f.good]!.value);
      }
    if (!sums.size) continue;
    const things = [...sums]
      .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
      .slice(0, 3)
      .map(([n]) => n);
    if (out.length) out.push("; ");
    out.push(`${andList(things)} to `, link(placeName(world, to), `cell:0:${to}`));
  }
  return out.length ? out : null;
}

// —— Read once a moment ——————————————————————————————————————————————————————————————————————————

type Cache = {
  now: number;
  readonly made: Map<string, (Raw & { share: number })[]>;
  readonly wares: Map<string, readonly Ware[]>;
  readonly fielded: Map<string, number>;
};
const CACHES = new WeakMap<World, Cache>();

/** This world's readings, for the moment it stands at: anything read in another is let go. */
function cacheOf(world: World): Cache {
  let c = CACHES.get(world);
  if (!c || c.now !== world.now) {
    c = { now: world.now, made: new Map(), wares: new Map(), fielded: new Map() };
    CACHES.set(world, c);
  }
  return c;
}
