// A far people's life in a few numbers (round F, "the galaxy alive"; asked 2026-11-16: "every system a galaxy sim could have",
// where a far people's history was a clock: its steps came at years 0/130/300/500/720 of its climb times one drawn pace, its
// fall by tabled odds, its strength by its years among the stars). Now a far people is a handful of numbers stepped by the near
// world's own rules, coarse:
//   its people grow as the children rule has it (rules/children.ts: as many as replace it, and more the less a child costs to
//     raise), and no further than its ground feeds them: what a km² of its ground gives as its people know how, at its warmth and
//     light, worn by its fields as round A's ground is (a scarcest nutrient that heals under rest), against what a body of its size
//     eats (Kleiber's three-quarter power);
//   what each of them turns is its own muscle, its beasts, its woods' heat, the fuel buried under it (spent as it is burned, and
//     warming its air), its rivers' fall, its wind, its hot ground, the atom where its star is young enough, and for a people of
//     the sea its vents, its tides and the current of its own living things: each from its world's facts, at a share its
//     knowledge taps, no more than its way of life asks;
//   who reads follows the letters rule (rules/letters.ts), its script coming with its towns;
//   what it knows grows as lore's does (sim/lore: many hands, each tenfold more adding as much again, the more found the more of
//     them read), each step dearer than the last, and no step comes that its world does not let it (its matter, its limbs, its
//     food, the power that step asks);
//   how well it holds together relaxes, a generation at a time, toward what its body's sociality, its readers and its reach of
//     word hold together, less its hunger, its war weariness, its sickness and the strain of more people than its word reaches,
//     and more where it fears another (it rallies, until it panics);
//   a people whose numbers break, its ground worn out under it or its holding together gone, falls: to ruins, where it had towns.
// The same rules step one year or a hundred at once (a deep-time path: rates closed over the step), so a far world costs a few
// dozen operations a decade. Pure tables and functions; the figures are estimates, and the pages say so.
import { dmath } from "../kernel/index.ts";
import { childCost, childrenWanted, CHILDREN } from "./children.ts";
import { readersAfter, readersTarget } from "./letters.ts";

/** The steps of a far people's climb, as rungs: camps 0 … stars 7. */
export const FAR_RUNGS = [
  "camps",
  "villages",
  "towns",
  "cities",
  "works",
  "signals",
  "orbit",
  "stars",
] as const;
export type FarRung = (typeof FAR_RUNGS)[number];
export const STARS_RUNG = 7;

/** What a far people's world and body are, as its life reads them: read once. */
export type FarFacts = {
  /** The key its own draws are read by. */
  readonly key: string;
  /** It lives in the water (a people of the sea), on the shore, or in the open air. */
  readonly sea: boolean;
  /** The ground (for a people of the sea, the shelf and vent fields) its people can work, km². */
  readonly areaKm2: number;
  /** Its world's mean warmth (°C), pull (g) and air (bar), and whether free oxygen lies in it. */
  readonly warmth: number;
  readonly gravity: number;
  readonly pressure: number;
  readonly oxygen: boolean;
  /** Its star's light on it, against Earth's (1). */
  readonly light: number;
  /** Its body: weight (kg), the longest life (years), how closely its kind lives together (0 … 1), whether it eats only flesh. */
  readonly bodyKg: number;
  readonly span: number;
  readonly social: number;
  readonly flesh: boolean;
  /** Its limbs strike and tend a fire, and grip a tool. */
  readonly fire: boolean;
  readonly grips: boolean;
  /** Something of its world can be sown or led (else it lives by what it hunts and gathers). */
  readonly sows: boolean;
  /** A store can be made (a fired jar; for a sea people, shell and woven weed). */
  readonly stores: boolean;
  /** Its hottest means reach (°C); a metal comes free of its ore by them; its crust gathers what hardens it. */
  readonly heat: number;
  readonly metals: boolean;
  /** Fuel buried under each km² of its ground (MJ): old life laid down since its bodies came ashore. */
  readonly fuelMJ: number;
  /** What its world's flows give a km², harvested as a people can (W): rivers' fall, wind, hot ground, vents, tides. */
  readonly river: number;
  readonly wind: number;
  readonly hot: number;
  readonly vents: number;
  readonly tides: number;
  /** Its living things carry a current a people can lead (a sea people's road to the electron without a dynamo's fire). */
  readonly bioCurrent: boolean;
  /** The fissile share of its uranium, against Earth's now (its star's age decays it). */
  readonly fissile: number;
  /** What reaching orbit asks from its ground (km/s). */
  readonly orbitKms: number;
  /** The highest rung its world lets it come to, by what the far reading found shut (natives.ts' ceiling), else the stars. */
  readonly ceiling: number;
};

/** A far people's numbers in a year (all floats while stepped; kept whole by the store). */
export type FarState = {
  /** How many of them there are, and the most they have ever been. */
  readonly people: number;
  readonly peak: number;
  /** What their fields and hunting give against what they eat (1: fed, below: hungry). */
  readonly fed: number;
  /** What each of them turns, all told (W), and of it what is not their own muscle. */
  readonly wph: number;
  readonly made: number;
  /** The share of them who read; of their workers, the share not needed at the food. */
  readonly letters: number;
  readonly spare: number;
  /** How well they hold together (0 … 1), and how much they fear the other they fear most (0 … 1). */
  readonly cohesion: number;
  readonly fear: number;
  /** What they know, in rungs (3.5: half way from cities to works). */
  readonly know: number;
  /** How worn their ground is (0 as it first was … 1 spent), the share of their fuel left, and how much their air has warmed (°C). */
  readonly worn: number;
  readonly fuel: number;
  readonly warmed: number;
  /** War's weariness on them, and what sickness has lately taken (each 0 … 1, faded). */
  readonly war: number;
  readonly sick: number;
  /** Their holding together has broken (strife: their works idle, their learning stops). */
  readonly broken: boolean;
  /** The rung they stand on now, and the highest they ever stood on. */
  readonly rung: number;
  readonly top: number;
  /** They fell: the year (null: they stand). */
  readonly fell: number | null;
};

export const FAR_LIFE = {
  /** Years a far people's life steps at once, history's and a page's reading alike. */
  step: 10,
  /** A band's worth to begin with: a people come out of its camps. */
  first: 2000,
  /**
   * People a km² of their ground feeds at each rung, at Earth's light, an ideal warmth and fresh ground, for a body of 60 kg (est.:
   * foragers 0.25, the hoe 3, the plough and the store 8, the canal and the rotation 15, the engine and made fertiliser 40, and
   * after; Earth's own: some 2.5 at year one, 10 in 1800, 80 now on its habitable land).
   */
  density: [0.25, 3, 8, 15, 40, 60, 70, 80] as readonly number[],
  /** The same for a people of the sea on its shelf and vent fields (est.: what reef and vent gardens give). */
  seaDensity: [0.4, 2.5, 6, 11, 25, 40, 50, 60] as readonly number[],
  /** Of its workers, those needed at the food at each rung (est.). */
  farmers: [1, 0.92, 0.86, 0.8, 0.5, 0.15, 0.06, 0.03] as readonly number[],
  /**
   * What a head turns at each rung, all told, as its way of life asks (W, est.: a forager 100 to 200, a farmer with beasts and a
   * hearth 500 to 1,500, the first works 2 to 3 thousand, the first rockets 4 thousand, a people among the stars ten).
   */
  asks: [150, 400, 700, 1100, 2200, 3500, 5000, 10000] as readonly number[],
  /** What its own body turns, a 60 kg body (W, a working day's mean). */
  muscle: 90,
  /**
   * Lore's pace, coarse: a rung's cost in years of a people of a few thousand who do not read, holding together as most do; each
   * rung dearer by `dearer` (fitted so an Earth-like people of a world like home's comes to villages in 160 years, its first
   * machines in 630, the current in 800, orbit in 990 and the stars in 1,330: the home world's chronicle has 130, 720, 860,
   * 1,045 and 1,400).
   */
  cost: 125,
  dearer: 1.85,
  /** Many hands (sim/lore MANY_HANDS): each tenfold more of them past this adds as much again. */
  hands: 10_000,
  /** How much the ground wears under fields pressing on it, a year, and how much it heals under rest (est.: a century to spend, three to heal). */
  wears: 0.006,
  heals: 0.0035,
  /** How far worn ground cuts what it gives (Mitscherlich's scarcest nutrient, coarse). */
  wornCut: 0.65,
  /** Of the fuel under a km², what a people can win (est.), and the air's warming when all of it is burned (°C, est.). */
  winnable: 0.5,
  warming: 6,
  /** The share of a world's flows a people's engines tap at each rung past works (est.); a people of the sea's from its cities. */
  tapped: [0, 0, 0, 0, 0.05, 0.25, 0.45, 0.6] as readonly number[],
  seaTapped: [0, 0, 0, 0.03, 0.08, 0.25, 0.45, 0.6] as readonly number[],
  /** What a body the water bears asks of all it turns, against one in the air (est.: none of it to keep warm, little to move it). */
  seaAsks: 0.5,
  /** Sunlight a km² gives its collectors once a people makes them (orbit's rung on; W, est.: a two-hundredth of its ground at 15%). */
  sun: 1.5e5,
  /** The fissile share below which no pile goes critical without enriching what the ground gives (against Earth's). */
  fissileLeast: 0.25,
  /** Power a head the step asks before it is open: works (other than muscle), signals (current), orbit, the stars (W, est.). */
  worksMade: 450,
  current: 80,
  orbitMade: 1500,
  starsMade: 4000,
  /** The share of its workers spared from the food a step asks: towns, cities. */
  townsSpare: 0.06,
  citiesSpare: 0.12,
  /** Holding together: below this it breaks; mended above that. */
  breaks: 0.2,
  mends: 0.32,
  /** Fallen: its people down to this share of the most it ever was, where it once had towns. */
  falls: 0.15,
  /** Fewer than this of them left is no people at all: a band's worth cannot keep its young (est.). */
  band: 50,
  /** A generation of a 70-year body (years). */
  generation: 25,
} as const;

const clamp01 = (x: number) => dmath.clamp(x, 0, 1);

/** How well a warmth lets a people's food grow (1 between 10 and 25 °C; nothing below −2 or above 42; est.). */
export function warmthFit(celsius: number, sea: boolean): number {
  // (The sea holds its warmth: its gardens bear over a wider span of the air's.)
  const lo = sea ? -20 : -2,
    hi = sea ? 60 : 42;
  if (celsius <= lo || celsius >= hi) return 0;
  if (celsius < 10) return (celsius - lo) / (10 - lo);
  if (celsius > 25) return (hi - celsius) / (hi - 25);
  return 1;
}

/** How much warmer a world's tropics are than its poles (°C: Earth's some 40, as gen/carriers.ts reads a world's own). */
export const WARMTH_CONTRAST = 40;
/** Earth's mean warmth (°C), at which a world's lands read as one at an ideal warmth. */
export const EARTH_WARMTH = 15;
/** Five bands of equal area, by the sine of their latitude: a band's warmth is the mean's and contrast·(1/3 − sin²), whose mean is the mean. */
const BANDS = [0.1, 0.3, 0.5, 0.7, 0.9];
const bandFit = (celsius: number, sea: boolean): number =>
  BANDS.reduce((s, x) => s + warmthFit(celsius + WARMTH_CONTRAST * (1 / 3 - x * x), sea), 0) /
  BANDS.length;
const EARTH_BANDS = { land: bandFit(EARTH_WARMTH, false), sea: bandFit(EARTH_WARMTH, true) };

/**
 * How well a world's lands let a people's food grow, from its mean warmth: its tropics warmer and its poles colder than the mean, band
 * by band, against a world at Earth's mean (exactly 1 there, and no more anywhere). A world's mean is not its warmth everywhere: one
 * at 43 °C, past the most any garden bears, still has poles at 24 that feed a people (a third of an ideal world's, where its mean
 * alone gave nothing and a people at the stars was read as four hundred), and one at −5 has tropics that do.
 */
export function landsFit(celsius: number, sea: boolean): number {
  return Math.min(1, bandFit(celsius, sea) / (sea ? EARTH_BANDS.sea : EARTH_BANDS.land));
}

/** What a body eats, against a 60 kg body's (Kleiber's three-quarter power). */
export const eatsAs = (kg: number): number => dmath.pow(Math.max(1, kg) / 60, 0.75);

/** How many of them their ground feeds at a rung, as worn and warmed as it is. */
export function feedsAt(f: FarFacts, rung: number, worn: number, warmed: number): number {
  const table = f.sea ? FAR_LIFE.seaDensity : FAR_LIFE.density,
    r = Math.max(0, Math.min(STARS_RUNG, Math.floor(rung))),
    // (A people that only hunts eats one step down the chain: a tenth of what its prey ate.)
    sown = r === 0 || f.sows ? table[r]! : table[0]!,
    meat = f.flesh ? 0.35 : 1,
    // (Light feeds what grows; a sea people's vents feed it in the dark.)
    light = f.sea
      ? Math.max(dmath.sqrt(Math.max(0, f.light)), Math.min(1, f.vents / 400))
      : dmath.sqrt(Math.max(0, f.light)),
    warm = landsFit(f.warmth + warmed, f.sea),
    ground = 1 - FAR_LIFE.wornCut * clamp01(worn);
  return (f.areaKm2 * sown * meat * light * warm * ground) / eatsAs(f.bodyKg);
}

/** What the world's flows give a head at a rung (W, beyond muscle), each tapped as its people know how: and what each was. */
export function flowsAt(
  f: FarFacts,
  rung: number,
  people: number,
): {
  readonly river: number;
  readonly wind: number;
  readonly hot: number;
  readonly sea: number;
  readonly atom: number;
} {
  const r = Math.max(0, Math.min(STARS_RUNG, Math.floor(rung))),
    tap = (f.sea ? FAR_LIFE.seaTapped : FAR_LIFE.tapped)[r]!,
    per = (wKm2: number) => (people > 0 ? (wKm2 * f.areaKm2 * tap) / people : 0),
    // (The atom is burned once the current is known, where the world's uranium is young enough to go critical: est. 3 kW a head.)
    atom = r >= 5 && f.fissile >= FAR_LIFE.fissileLeast ? 3000 * Math.min(1, f.fissile) : 0,
    // (Sunlight on its collectors, from orbit's rung: on the water's face, for a people of the sea, a third as much.)
    sun = r >= 6 ? per(FAR_LIFE.sun * Math.max(0, f.light) * (f.sea ? 0.33 : 1)) : 0;
  return {
    river: f.sea ? 0 : per(f.river),
    wind: f.sea ? 0 : per(f.wind * dmath.sqrt(Math.max(0.01, f.pressure))),
    hot: per(f.hot) + sun,
    sea: f.sea ? per(f.vents + f.tides) + (f.bioCurrent && r >= 3 ? 150 : 0) : per(f.tides),
    atom,
  };
}

/** What a head of them turns at a rung, all told, as its way of life asks (W). */
export const asksAt = (f: Pick<FarFacts, "sea">, rung: number): number =>
  FAR_LIFE.asks[Math.max(0, Math.min(STARS_RUNG, Math.floor(rung)))]! *
  (f.sea ? FAR_LIFE.seaAsks : 1);

/** The rung their fields stand at: theirs, down to the highest whose engines and made fertiliser what they turn still drives. */
export function foodRung(f: FarFacts, rung: number, made: number): number {
  let r = Math.max(0, Math.min(STARS_RUNG, Math.floor(rung)));
  while (r >= 4 && made < 0.6 * (asksAt(f, r) - FAR_LIFE.muscle * eatsAs(f.bodyKg))) r--;
  return r;
}

/** What a head turns, beyond muscle, at a rung, from each source: beasts, woods, fuel, flows. Capped at what its way asks. */
export function madeAt(
  f: FarFacts,
  rung: number,
  people: number,
  fuel: number,
  broken: boolean,
): { readonly made: number; readonly fuelW: number; readonly flows: number } {
  const r = Math.max(0, Math.min(STARS_RUNG, Math.floor(rung))),
    ask = asksAt(f, r) - FAR_LIFE.muscle * eatsAs(f.bodyKg),
    beasts = f.sows && r >= 1 ? (f.sea ? 80 : 120) : 0,
    // (A hearth's wood: what the woods of a km² give in heat, shared among the people on it; est. 10 kW a km² at a fit warmth.)
    wood =
      f.fire && people > 0
        ? Math.min(1200, (10_000 * landsFit(f.warmth, false) * f.areaKm2) / people)
        : 0,
    // (Fuel: won once there are works, as fast as its way asks, while it lasts.)
    fuelW =
      f.fire && f.oxygen && r >= 4 && f.fuelMJ > 0 ? Math.max(0, ask) * Math.min(1, fuel * 3) : 0,
    fl = flowsAt(f, r, people),
    flows = fl.river + fl.wind + fl.hot + fl.sea + fl.atom,
    // (Broken, a people's works stand idle: what it turns falls to its hearths and beasts.)
    all = broken ? beasts + wood * 0.6 : beasts + wood + fuelW + flows;
  return { made: Math.max(0, Math.min(Math.max(0, ask), all)), fuelW: broken ? 0 : fuelW, flows };
}

/** Whether a step is open to them now: its matter, its limbs, its food and the power it asks. And why not, in a word. */
export function gateOf(
  f: FarFacts,
  rung: number,
  s: Pick<FarState, "spare" | "made" | "people">,
):
  | "open"
  | "ceiling"
  | "unsown"
  | "flesh"
  | "stores"
  | "spare"
  | "metals"
  | "power"
  | "current"
  | "lift" {
  if (rung > f.ceiling) return "ceiling";
  // (A body the water bears asks less of what it turns: so do its steps.)
  const k = f.sea ? FAR_LIFE.seaAsks : 1;
  switch (rung) {
    case 1:
      return f.sows ? "open" : "unsown";
    case 2:
      if (f.flesh) return "flesh";
      if (!f.stores) return "stores";
      return s.spare >= FAR_LIFE.townsSpare ? "open" : "spare";
    case 3:
      if (!f.sea && !f.metals) return "metals";
      return s.spare >= FAR_LIFE.citiesSpare ? "open" : "spare";
    case 4:
      return s.made >= FAR_LIFE.worksMade * k ? "open" : "power";
    case 5: {
      // (The electron wants a current: a dynamo turned by fuel or a flow, or a sea people's own living current; and wire.)
      const turns = f.fire || f.bioCurrent || f.river + f.wind + f.vents + f.tides > 0;
      if (!turns) return "current";
      if (!f.metals && !(f.sea && f.vents > 0)) return "metals";
      return s.made >= (FAR_LIFE.current + FAR_LIFE.worksMade) * k ? "open" : "power";
    }
    case 6:
      // (A people of the sea lifts its own water with it: its craft must be the heavier.)
      if (f.gravity > (f.sea ? 1.6 : 2.2)) return "lift";
      return s.made >= FAR_LIFE.orbitMade * k * (f.orbitKms / 9.5) ? "open" : "power";
    case 7:
      return s.made >= FAR_LIFE.starsMade * k ? "open" : "power";
    default:
      return "open";
  }
}

/** What a gate in its way means, in words. */
export const GATE_WORDS: Readonly<Record<ReturnType<typeof gateOf>, string>> = {
  open: "nothing holds them",
  ceiling: "their world shuts the next step to them",
  unsown: "nothing of their world can be sown or led",
  flesh: "they eat only flesh, and herds alone feed no town",
  stores: "nothing they make keeps a store past a season",
  spare: "their fields spare too few hands from the food",
  metals: "no metal comes free of its ore by anything they can do",
  power: "they turn too little power a head for the next step",
  current: "nothing of theirs turns a current",
  lift: "their world's pull is too heavy for any engine of theirs to lift itself",
};

/** The rung a people stands on: the highest whose every step it knows and its world lets it take. */
export function rungOf(
  f: FarFacts,
  s: Pick<FarState, "know" | "spare" | "made" | "people">,
): number {
  let r = 0;
  const known = Math.floor(Math.max(0, s.know));
  while (r < Math.min(known, STARS_RUNG) && gateOf(f, r + 1, s) === "open") r++;
  return r;
}

/** How fast they learn, rungs a year: many hands, the more of them read, the better they hold together; each rung dearer. */
export function learnRate(people: number, letters: number, cohesion: number, rung: number): number {
  const many = 1 + dmath.log10(1 + Math.max(0, people) / FAR_LIFE.hands),
    read = 0.5 + 1.5 * clamp01(letters),
    held = 0.6 + 0.8 * clamp01(cohesion);
  return (many * read * held) / (FAR_LIFE.cost * dmath.pow(FAR_LIFE.dearer, Math.max(0, rung)));
}

/** How many a people's word holds together at a rung (est.: a band's voice, a village's elders, a realm's roads, the wire). */
export const wordHolds = (rung: number): number => 3000 * dmath.pow(10, 0.85 * Math.max(0, rung));

/** What their holding together relaxes toward. */
export function cohesionTarget(f: FarFacts, s: FarState, rung: number): number {
  const reach = wordHolds(rung),
    // (Past what one word holds they are many realms, quarrelling among themselves the more of them there are.)
    strain = 0.04 * Math.max(0, dmath.log10(Math.max(1, s.people / reach))),
    hunger = 0.6 * Math.max(0, 1 - s.fed),
    // (A people that fears another holds closer, up to a point; past it, it panics.)
    rally = s.fear < 0.7 ? 0.2 * s.fear : 0.14 - 0.5 * (s.fear - 0.7),
    // (What it turns against what its way asks: a people whose works run short goes cold and hungry.)
    short =
      rung >= 4 ? 0.25 * Math.max(0, 1 - (s.made + 1) / Math.max(1, asksAt(f, rung) * 0.6)) : 0;
  return clamp01(
    0.3 +
      0.35 * clamp01(f.social) +
      0.2 * clamp01(s.letters) -
      strain -
      hunger -
      0.35 * s.war -
      0.4 * s.sick -
      short +
      rally,
  );
}

/** A people's numbers as they come out of their camps. */
export function farBegins(f: FarFacts, people: number = FAR_LIFE.first): FarState {
  return {
    people,
    peak: people,
    fed: 1,
    wph: FAR_LIFE.muscle * eatsAs(f.bodyKg),
    made: 0,
    letters: 0,
    spare: 0,
    cohesion: 0.3 + 0.35 * clamp01(f.social),
    fear: 0,
    know: 0,
    worn: 0,
    fuel: 1,
    warmed: 0,
    war: 0,
    sick: 0,
    broken: false,
    rung: 0,
    top: 0,
    fell: null,
  };
}

/**
 * A far people's numbers `years` on (the near world's rules, coarse). `shock` is the step's own draw (0 … 1): its harvests and its
 * sicknesses, good and ill; `year` is the year the step ends in. A fallen people stays fallen.
 */
export function farStep(
  f: FarFacts,
  s: FarState,
  years: number,
  shock: number,
  year: number,
): FarState {
  if (s.fell !== null || years <= 0) return s;
  const rung = s.rung,
    body = eatsAs(f.bodyKg),
    // —— Food: what their ground feeds at the rung the power they turn holds up (a works' fields want its engines and its made
    // fertiliser), as worn and warmed as it is, and this step's harvests.
    fields = foodRung(f, rung, s.made),
    harvest = 0.85 + 0.3 * shock,
    feeds = Math.max(1, feedsAt(f, fields, s.worn, s.warmed) * harvest),
    pressure = s.people / feeds,
    // —— Children: as many as replace them, and more the less each costs to raise (its schooling, its work not wanted).
    machines = clamp01(s.made / Math.max(1, FAR_LIFE.asks[STARS_RUNG]!)),
    wanted = childrenWanted(childCost(s.letters, machines * 2)),
    // (Hunger keeps fewer of the young: what is wanted is what can be fed.)
    living = wanted * Math.min(1, dmath.pow(Math.min(1, 1 / Math.max(0.2, pressure)), 1.5)),
    generation = (FAR_LIFE.generation * Math.max(5, f.span)) / 70,
    grows = dmath.log(Math.max(0.05, living) / CHILDREN.replace) / generation,
    // (Strife and sickness take their own.)
    lost = (s.broken ? 0.006 : 0) + (s.sick > 0.05 ? 0.002 : 0),
    rate = Math.max(-0.4, Math.min(0.03, grows - lost)),
    born = Math.max(0, s.people * dmath.exp(rate * years)),
    // (Past what their ground feeds, they starve back toward it within a few years.)
    grown = born > feeds ? feeds + (born - feeds) * dmath.exp(-years / 4) : born;
  // —— Sickness: crowded cities breed their own, a few years in ten (est.).
  const plague = rung >= 3 && shock < 0.08 ? 0.1 + 0.8 * (0.08 - shock) * 3 : 0,
    people = grown * (1 - plague),
    fed = Math.min(1.3, feeds / Math.max(1, people)),
    // —— Ground: worn by fields pressed past what rest keeps (seven in ten of what it feeds), healed as it is worn; made
    // fertiliser and rock hauled by engines heal it threefold at works. Closed over the step: it comes to where the two meet.
    press = rung >= 1 ? Math.max(0, Math.min(1.5, pressure) - 0.7) : 0,
    wear = FAR_LIFE.wears * press * press,
    mend = FAR_LIFE.heals * (fields >= 4 ? 3 : 1),
    settles = wear / (wear + mend),
    worn = clamp01(settles + (s.worn - settles) * dmath.exp(-(wear + mend) * years)),
    // —— What they turn: muscle, beasts, woods, fuel while it lasts, the world's flows.
    m = madeAt(f, rung, people, s.fuel, s.broken),
    burnedJ = m.fuelW * people * 3.156e7 * years,
    stockJ = f.fuelMJ * FAR_LIFE.winnable * f.areaKm2 * 1e6,
    fuel = stockJ > 0 ? clamp01(s.fuel - burnedJ / stockJ) : 0,
    warmed = FAR_LIFE.warming * (1 - fuel) * (f.fuelMJ > 0 ? 1 : 0),
    // (A hungry people sends more of its hands to the fields.)
    spare = clamp01(1 - FAR_LIFE.farmers[rung]! * (fed < 0.8 ? 1.15 : 1)),
    // —— Who reads: a script with their towns, a school with their cities, word as freely as they hold together.
    letters = readersAfter(
      s.letters,
      readersTarget({
        script: rung >= 2,
        scribes: rung >= 3 ? 0.04 : rung >= 2 ? 0.02 : 0,
        spare,
        school: rung >= 3,
        word: s.cohesion,
        scripture: 0.2,
      }),
      years,
      f.span,
    ),
    // —— Fear and weariness fade: half in a generation, half in fifteen years.
    fear = s.fear * dmath.pow(0.5, years / 25),
    war = s.war * dmath.pow(0.5, years / 15),
    sick = Math.max(plague, s.sick * dmath.pow(0.5, years / 10)),
    mid: FarState = {
      ...s,
      people,
      fed,
      wph: FAR_LIFE.muscle * body + m.made,
      made: m.made,
      letters,
      spare,
      fear,
      war,
      sick,
      worn,
      fuel,
      warmed,
    },
    // —— Holding together: a generation's way toward what holds them.
    target = cohesionTarget(f, mid, rung),
    cohesion = target + (s.cohesion - target) * dmath.pow(0.5, years / generation),
    broken = s.broken ? cohesion < FAR_LIFE.mends : cohesion < FAR_LIFE.breaks,
    // —— What they know: lore's pace, no further than the step their world shuts; none learned in strife.
    know = broken
      ? s.know
      : Math.min(
          f.ceiling + 0.999,
          s.know + years * learnRate(people, letters, cohesion, Math.floor(s.know)),
        ),
    peak = Math.max(s.peak, people),
    now = { ...mid, cohesion, broken, know, peak },
    r = rungOf(f, now),
    top = Math.max(s.top, r),
    // —— Fallen: down to a few of the most they were, where they once had towns; or, where they once had villages, to fewer than a
    // band's worth (until 2026-11-23 a people of villages could dwindle to one and stand). A people of camps leaves no ruins.
    fell =
      (s.top >= 2 && people < FAR_LIFE.falls * peak) || (s.top >= 1 && people < FAR_LIFE.band)
        ? year
        : null;
  return { ...now, rung: fell === null ? r : 0, top, fell, people: fell === null ? people : 0 };
}

// —— Their strength, and what they fear of another ————————————————————————————————————————————————

/** What a people of the stars turns in all (W) against which its might is read: Earth's works some years past its first rockets (est.). */
export const MIGHT_W = 2e13;

/**
 * How strong a people is among the stars (0.3 … 5, the scale peoples.ts weighs fleets and meetings by): what all of it turns
 * beyond its muscle, at the rung its reach comes to, as far as it holds together and is not worn by war.
 */
export function farStrength(
  s: Pick<FarState, "people" | "made" | "rung" | "cohesion" | "war" | "broken" | "fell">,
): number {
  if (s.fell !== null) return 0;
  const x = (s.people * s.made) / (s.people * s.made + MIGHT_W),
    held = (0.5 + 0.5 * clamp01(s.cohesion)) * (1 - 0.5 * clamp01(s.war)) * (s.broken ? 0.5 : 1);
  if (s.rung < 5) return 0.3 * (0.5 + held);
  if (s.rung < STARS_RUNG) return 0.6 * (0.5 + held) * (0.6 + 0.8 * x);
  return 1 + 4 * x * held;
}

/** What a meeting's reading of the other is made of. */
export type FarThreat = {
  /** The other's strength against one's own (their share of the two). */
  readonly gap: number;
  /** How well their strength is seen (1: their ships came; a half: heard only). */
  readonly seen: number;
  /** How exposed one is: they could live where one lives, and how near they are. */
  readonly exposed: number;
  /** What one stands to lose: how much of one there is to lose, how far one holds together to answer. */
  readonly loss: number;
  /** All of it: how much one fears them (0 … 1). */
  readonly level: number;
};

/** How much one people fears another, from what it knows of it: unlike, seen to work, exposed, with much to lose (finance.ts' threatOf, among the stars). */
export function farThreat(r: {
  readonly mine: number;
  readonly theirs: number;
  readonly seen: number;
  /** Their bodies could live on one's ground (one's world is a prize to them). */
  readonly livable: boolean;
  /** Light-years between the nearest of each. */
  readonly apart: number;
  /** How many of one's own (a people's, a realm's) stand to be lost, and how well one holds together. */
  readonly people: number;
  readonly cohesion: number;
}): FarThreat {
  const gap = r.theirs / Math.max(0.05, r.theirs + r.mine),
    seen = clamp01(r.seen),
    exposed = clamp01((r.livable ? 1 : 0.45) / (1 + Math.max(0, r.apart) / 25)),
    loss = clamp01(
      (0.4 + 0.1 * dmath.log10(1 + Math.max(0, r.people) / 1e6)) *
        (1.2 - 0.5 * clamp01(r.cohesion)),
    );
  return { gap, seen, exposed, loss, level: clamp01(2.4 * gap * seen * exposed * loss) };
}

/** What one people stands to gain of another: what it knows that one does not, and goods one lacks that it has. */
export type FarGain = {
  /** Rungs they stand ahead (0 where behind). */
  readonly ahead: number;
  /** How short one is of power a head, and of food, that they have to spare (0 … 1 each). */
  readonly power: number;
  readonly food: number;
  /** All of it (0 … 1). */
  readonly level: number;
};

export function farGain(
  mine: Pick<FarState, "know" | "made" | "rung" | "fed">,
  theirs: Pick<FarState, "know" | "made" | "rung" | "fed">,
): FarGain {
  const ahead = Math.max(0, theirs.know - mine.know),
    want = (rung: number) => Math.max(1, FAR_LIFE.asks[Math.max(0, Math.min(STARS_RUNG, rung))]!),
    power =
      clamp01((theirs.made - mine.made) / want(mine.rung)) *
      clamp01(1 - mine.made / want(mine.rung)),
    food = clamp01(theirs.fed - 1) * clamp01(1 - mine.fed) * 4;
  return {
    ahead,
    power,
    food,
    level: clamp01(0.35 * Math.min(2, ahead) + 0.4 * power + 0.3 * food),
  };
}

/**
 * How one side meets another (peoples.ts' four reactions), weighed from what it fears and stands to gain of the other and its own
 * leanings (0 … 1 each): in wonder as the other stands far above it, in fear as it is threatened, to trade as it stands to gain
 * and can say so, for war as it is threatened and the stronger, or crowded.
 */
export function meetingLeans(r: {
  readonly threat: FarThreat;
  readonly gain: FarGain;
  readonly curious: number;
  readonly wary: number;
  readonly bold: number;
  readonly trading: number;
  readonly speak: boolean;
  /** Pressed for ground: crowded and short of food. */
  readonly pressed: number;
  /** Met before it could speak across the dark (an omen to it). */
  readonly omen: boolean;
}): readonly [wonder: number, fear: number, trade: number, war: number] {
  const t = r.threat.level,
    stronger = r.threat.gap < 0.45;
  return [
    0.2 + r.curious * (0.5 + 0.4 * Math.min(2, r.gain.ahead)) + (r.omen ? 0.3 : 0),
    r.wary * (0.2 + 1.6 * t) * (stronger ? 0.6 : 1.3),
    r.trading * (0.3 + 1.6 * r.gain.level) * (r.speak ? 1 : 0.25) * (r.omen ? 0.4 : 1),
    r.bold * (t * (stronger ? 1.6 : 0.4) + 0.8 * clamp01(r.pressed)) * (r.omen ? 0.5 : 1),
  ];
}

// —— War among the stars: its aim, its will, its end ——————————————————————————————————————————————

export type FarAim = "ground" | "threat" | "plunder" | null;

/** Why a people would send a fleet against another, and how much it wants to (0 … 1): ground it lacks, a threat it would end, goods it lacks. */
export function warAim(r: {
  readonly mine: Pick<FarState, "fed" | "made" | "rung" | "war" | "cohesion" | "broken">;
  readonly crowded: boolean;
  readonly threat: number;
  readonly gain: number;
  readonly theirLivable: boolean;
}): { readonly aim: FarAim; readonly will: number } {
  if (r.mine.broken) return { aim: null, will: 0 };
  const tired = 1 - clamp01(r.mine.war),
    ground = r.crowded && r.theirLivable ? 0.4 + 0.6 * clamp01(1.1 - r.mine.fed) : 0,
    threat = clamp01(r.threat * 1.3),
    plunder = 0.6 * clamp01(r.gain),
    best = Math.max(ground, threat, plunder),
    aim: FarAim =
      best <= 0.05 ? null : best === ground ? "ground" : best === threat ? "threat" : "plunder";
  return { aim, will: clamp01(best * tired * (0.5 + 0.5 * clamp01(r.mine.cohesion))) };
}

/** War's weariness a battle leaves on a side: its losses against its numbers, and more for a beaten one. */
export const battleWearies = (dead: number, people: number, won: boolean): number =>
  clamp01((won ? 0.08 : 0.25) + 3 * (dead / Math.max(1, people)));

/** How far two peoples' weariness pulls their regard toward peace (added to what it leans toward). */
export const wearyPeace = (warA: number, warB: number): number => 0.9 * clamp01((warA + warB) / 2);

// —— What passes between two peoples, by what each lacks ——————————————————————————————————————————

export type FarPass = "knowledge" | "goods" | "ways";

/** What passes from `giver` to `taker`, weighed by what the taker lacks and the giver has: a draw `u` picks among them as they weigh. */
export function farPasses(
  giver: Pick<FarState, "know" | "made" | "rung" | "fed">,
  taker: Pick<FarState, "know" | "made" | "rung" | "fed">,
  u: number,
): FarPass {
  const g = farGain(taker, giver),
    know = 0.8 * Math.min(1.5, g.ahead),
    goods = g.power + g.food,
    ways = 0.25,
    total = know + goods + ways,
    x = u * total;
  return x < know ? "knowledge" : x < know + goods ? "goods" : "ways";
}

/** What a lesson taught moves the taker's knowledge by: a share of the gap (est.: a tenth, as a land learns a neighbour's craft). */
export const taught = (gap: number): number => 0.1 * Math.max(0, gap);

/**
 * What a far people's goods ask, against their usual worth's floor (trade.ts FAR_FLOOR): dearer as it turns less power a head than
 * a people at the stars does (what it makes costs it the more), and whether it has any to spare at all (0 … 1: fed and whole).
 */
export function farDearness(s: Pick<FarState, "made" | "fed" | "broken">): {
  readonly dear: number;
  readonly spare: number;
} {
  const dear = dmath.clamp(dmath.sqrt(FAR_LIFE.asks[STARS_RUNG]! / Math.max(500, s.made)), 0.7, 3),
    spare = s.broken ? 0.05 : dmath.clamp((s.fed - 0.85) * 2.5, 0.05, 1);
  return { dear, spare };
}

// —— A landing on them ————————————————————————————————————————————————————————————————————————

/**
 * What a landing does to a people come down on (Phase 70's fight, rules/landfall.ts, read into their numbers): those it killed of
 * the share of them in the field, those a sickness never met took (spreading from the landing ground through all of them as
 * far as they live close: a people in camps loses a band, one in cities its cities), their fear of the comers, how far they hold
 * together after, and what they learn of those who stay.
 */
export function landed(
  s: FarState,
  r: {
    /** Of those who met them in the field, the share who died; the share of all of them who were in the field. */
    readonly fieldDead: number;
    readonly fielded: number;
    /** The share of those who would have met them a sickness took (0 where none crossed). */
    readonly sickShare: number;
    /** The comers won the ground, and stay. */
    readonly won: boolean;
    readonly stay: boolean;
    /** The comers' rung (what is there to learn of them). */
    readonly comersKnow: number;
    readonly comersStrength: number;
    /**
     * The share of their food the weeds, pests and beasts the comers brought took, where the two worlds' lives can eat each
     * other (rules/landfall.ts lifeCarried; absent or 0: none could take hold).
     */
    readonly lifeLost?: number;
  },
): FarState {
  if (s.fell !== null) return s;
  // (A sickness spreads as far as a people lives close: a band's worth in camps, nearly all of them in cities.)
  const reach = [0.08, 0.35, 0.6, 0.8, 0.9, 0.95, 1, 1][Math.max(0, Math.min(STARS_RUNG, s.rung))]!,
    sickLost = clamp01(r.sickShare) * reach,
    fightLost = clamp01(r.fieldDead) * clamp01(r.fielded),
    people = s.people * (1 - sickLost) * (1 - fightLost) * (1 - clamp01(r.lifeLost ?? 0)),
    gap = Math.max(0, r.comersKnow - s.know),
    // (Those who stay among them are learned from, as a land learns what its neighbour knows: a share of the gap.)
    know = r.stay
      ? Math.min(s.know + taught(gap) * 2, Math.max(s.know, r.comersKnow - 0.5))
      : s.know,
    fear = clamp01(Math.max(s.fear, 0.3 + 0.5 * (sickLost + fightLost) + (r.won ? 0.2 : 0))),
    cohesion = clamp01(s.cohesion - 0.6 * sickLost - 0.3 * fightLost - (r.won ? 0.1 : 0)),
    war = clamp01(s.war + battleWearies(s.people - people, s.people, !r.won));
  return {
    ...s,
    people,
    know,
    fear,
    cohesion,
    war,
    sick: clamp01(Math.max(s.sick, sickLost)),
    broken: s.broken || cohesion < FAR_LIFE.breaks,
  };
}

// —— A people of the sea's road ————————————————————————————————————————————————————————————————

/**
 * A world's flows as a people of the sea reads them (W a km² of its working floor, harvested as a people can; est.): its hot vents
 * by its rock's heat (a young and a large world's the more, Earth's 0.09 W a m², a fifth of it at the vent fields), its tides by
 * its star's pull and its own moons', and whether its life leads a current (a draw of its own, est. half of worlds).
 */
export function seaFlows(r: {
  readonly radius: number;
  readonly ageGyr: number;
  readonly starMass: number;
  readonly au: number;
  readonly moon: number;
  readonly lifeDraw: number;
}): { readonly vents: number; readonly tides: number; readonly bioCurrent: boolean } {
  const heatFlow =
      0.09 * dmath.sqrt(Math.max(0.1, r.radius)) * dmath.sqrt(4.6 / Math.max(0.5, r.ageGyr)),
    // (They live by their vent fields, where a fifth of their floor's heat comes up.)
    vents = heatFlow * 1e6 * 0.2,
    // (A star's tide falls as the cube of the way out; Earth's own moon raises twice the sun's: some 10 kW a km² of sea in all.)
    star = r.starMass / Math.max(0.01, r.au * r.au * r.au),
    tides = 3000 * (Math.min(20, star) + 2.4 * clamp01(r.moon));
  return { vents, tides, bioCurrent: r.lifeDraw < 0.5 };
}
