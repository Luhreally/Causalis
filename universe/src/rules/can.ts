// The tree of what can be done (F5, docs/architecture/first-principles-plan.md): what a world's numbers and its
// people's lands open, step by step, and for a step they shut, what shuts it. One reading answers both: a step is
// open where nothing stops it (`stepStop`), and its why is that same stop, walked back through what it needs
// (`whyShut`), so the two cannot disagree. A function a people wants done is a ladder of such steps, each with its
// figure on this world. Pure tables and functions; nothing here says how a thing is made, only what it does.
import { dmath } from "../kernel/index.ts";
import type { Medium } from "./bodies.ts";
import { AIR_OFFSET, DRIVEN_BLAST, FURNACES, principleNameOn } from "./chem-ores.ts";
import type { Chemistry } from "./chemistry.ts";
import { FIREARMS, firearm } from "./firearms.ts";
import { launcherFor } from "./launch.ts";
import {
  CARRIES,
  VEIN_SHARE,
  airWeight,
  edgeFigure,
  flightPower,
  gunHere,
  meansName,
  reachIn,
  waterRange,
  type Means,
  type MeansWorld,
} from "./means.ts";
import { METAL_ROOTS, PRINCIPLES, bodyStop, needsMet, type Principle } from "./principles.ts";
import { matterShuts, type FunctionReading } from "./properties.ts";
import { aroundKm, flyerOn, liftingEngine, rocketOn, stagesKnown } from "./reach.ts";
import { fireName } from "./greatfire.ts";
import {
  ROCKET_HEIGHT_KM,
  SIGHT_STEPS,
  SIGHT_WAYS,
  WORD_WAYS,
  delayWords,
  rocketSightKm,
} from "./signals.ts";

const EARTH_KM = 6371;
/** How long a word takes over 1,000 km by a way (rules/signals.ts). */
const paceBy =
  (id: string) =>
  (_w?: unknown): string => {
    const w = WORD_WAYS.find((x) => x.id === id)!;
    return `1,000 km in ${delayWords(1000 / w.kmADay)}`;
  };
const withStuff = (pace: string, stuff: string | null) => (stuff ? `${pace}, on ${stuff}` : pace);

export type Knows = (id: string) => boolean;

/** What a people's own lands say of a step, where they stop it (host/can.ts reads the ground). */
export type LandStop =
  | { readonly on: "ore"; readonly ore: string; readonly lies: boolean }
  | { readonly on: "river" | "coast" | "hills" }
  | { readonly on: "aside"; readonly lacks: "metal" | "coal" };

/** What stops a step on a world. */
export type Stop =
  | { readonly on: "no-one" }
  | { readonly on: "medium"; readonly wants: readonly Medium[] }
  | { readonly on: "burns" }
  | { readonly on: "heat"; readonly want: number; readonly top: number; readonly by: string }
  | { readonly on: "matter"; readonly f: FunctionReading }
  | { readonly on: "law" }
  | { readonly on: "lift"; readonly engine: string | null }
  | { readonly on: "land"; readonly land: LandStop }
  | { readonly on: "unsown" }
  | { readonly on: "needs"; readonly need: string; readonly under: Stop };

/** A world as the tree reads it: what it is made of, and who stands on it. */
export type CanWorld = {
  readonly numbers: MeansWorld;
  readonly means: Means;
  readonly chem: Chemistry;
  readonly functions: readonly FunctionReading[];
  readonly medium: Medium;
  /** Whether its people keep a fire in its air. */
  readonly fire: boolean;
  /** Whether this universe's law opens the lanes. */
  readonly lanes: boolean;
  readonly peopled: boolean;
  /** Whether any of its people's lands can be sown. */
  readonly sows: boolean;
  /** What reaching orbit asks from its ground (km/s). */
  readonly orbitKms: number;
  /** Why its people's bodies cannot bear arms of light, where they cannot. */
  readonly noGrip?: string;
  readonly land: (p: Principle, knows: Knows) => LandStop | null;
  /** What keeps its people's lands from working copper (null: nothing does). */
  readonly copper: (knows: Knows) => LandStop | null;
};

/** The hottest means a people's knowledge brings here, whatever it is, and its name. */
function topHeat(w: CanWorld, knows: Knows): { heat: number; name: string } | null {
  let best: { heat: number; name: string } | null = null;
  for (const h of w.means.heats)
    if (h.heat > (best?.heat ?? 0) && h.by.every((any) => any.some(knows))) best = h;
  return best;
}

/** What stops a step here, all it needs being known; null: nothing does. The reading the tree goes by. */
export function stepStop(p: Principle, w: CanWorld, knows: Knows): Stop | null {
  const body = bodyStop(p, w.medium, reachIn(w.means, knows), w.means.wants);
  if (body === "medium") return { on: "medium", wants: p.body!.media! };
  if (body === "burns") return { on: "burns" };
  if (body === "heat") {
    const top = topHeat(w, knows);
    return {
      on: "heat",
      want: w.means.wants[p.id] ?? p.body!.heat!,
      top: top?.heat ?? 0,
      by: top?.name ?? "nothing it knows",
    };
  }
  const f = matterShuts(p, w.functions);
  if (f) return { on: "matter", f };
  if (p.law === "lanes" && !w.lanes) return { on: "law" };
  if (p.body?.lifts) {
    const e = liftingEngine(w.numbers);
    if (!e || !knows(e.id)) return { on: "lift", engine: e?.name ?? null };
  }
  const land = w.land(p, knows);
  return land ? { on: "land", land } : null;
}

/**
 * Every step a people of this world could come to, given time, from what it knows already. Those known are
 * open whatever the reading says: history is the last word on what it has done.
 */
export function openSteps(w: CanWorld, known: Iterable<string> = []): Set<string> {
  const open = new Set<string>(known),
    knows: Knows = (id) => open.has(id);
  if (!w.peopled) return open;
  if (w.sows) open.add("cultivation");
  for (let changed = true; changed;) {
    changed = false;
    if (!open.has("metalworking") && w.fire && !w.copper(knows)) {
      open.add("metalworking");
      changed = true;
    }
    for (const p of PRINCIPLES) {
      if (open.has(p.id) || p.rate <= 0) continue;
      if (!needsMet(p, knows) || stepStop(p, w, knows)) continue;
      open.add(p.id);
      changed = true;
      if (METAL_ROOTS.includes(p.id)) open.add("metalworking");
    }
  }
  return open;
}

const byId: ReadonlyMap<string, Principle> = new Map(PRINCIPLES.map((p) => [p.id, p]));

/** Why a step is not open here, walked back through what it needs (null: it is open). */
export function whyShut(
  id: string,
  w: CanWorld,
  open: ReadonlySet<string>,
  seen: Set<string> = new Set(),
): Stop | null {
  if (open.has(id)) return null;
  if (!w.peopled) return { on: "no-one" };
  seen.add(id);
  const knows: Knows = (x) => open.has(x);
  if (id === "cultivation") return { on: "unsown" };
  if (id === "metalworking") {
    const fired = w.copper(knows);
    return !w.fire
      ? { on: "burns" }
      : { on: "land", land: fired ?? { on: "ore", ore: "copper", lies: false } };
  }
  const p = byId.get(id);
  if (!p) return null;
  const direct = stepStop(p, w, knows);
  if (direct) return direct;
  for (const need of p.needs) {
    const options = need.split("|");
    if (options.some(knows)) continue;
    for (const o of options)
      if (!seen.has(o)) {
        const under = whyShut(o, w, open, seen);
        if (under) return { on: "needs", need: o, under };
      }
    return { on: "needs", need: options[0]!, under: { on: "no-one" } };
  }
  // (All it needs is open, and nothing stops it: only its order in the search is left.)
  return { on: "needs", need: p.needs[0] ?? id, under: { on: "no-one" } };
}

/** The stop behind a stop: what in the world it comes to, whatever lay between. */
export function rootStop(s: Stop): Stop {
  return s.on === "needs" ? rootStop(s.under) : s;
}

const thousands = (n: number) => `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** A figure in words with a true minus sign. */
const degrees = (c: number) => `${c < 0 ? "−" : ""}${thousands(Math.abs(c))} °C`;

/** A stop as a sentence, a fact about this world. */
export function stopWords(stop: Stop, w: CanWorld): string {
  const s = rootStop(stop),
    n = w.numbers;
  switch (s.on) {
    case "no-one":
      return "No people stand on this world to do it.";
    case "unsown":
      return "None of its people's lands can be sown.";
    case "burns":
      return !n.freeOxygen
        ? "Its air holds no free oxygen: nothing burns."
        : n.medium === "water"
          ? "Its people live under water: no fire can be kept there."
          : "Its people's bodies can keep no fire.";
    case "medium":
      return s.wants.includes("water")
        ? "That is a road for a people of the water, and its people walk on land."
        : "Its people live under water, and that is for those on land or shore.";
    case "heat":
      return `It wants ${degrees(s.want)}, and the hottest its people can reach here is ${degrees(s.top)}, by ${s.by}.`;
    case "matter":
      return s.f.why.replace(/(^|\s)-(\d)/g, "$1−$2");
    case "law":
      return "The laws of this universe open no lanes between the stars.";
    case "lift":
      return s.engine
        ? `Only ${s.engine} lifts a machine here, and its people have no road to it.`
        : "No engine its people can carry lifts a machine here.";
    case "land": {
      const l = s.land;
      if (l.on === "ore")
        return l.lies
          ? `Its furnaces cannot work the ${l.ore} within reach of its people's lands.`
          : `No ${l.ore} lies within reach of its people's lands.`;
      if (l.on === "aside")
        return l.lacks === "coal"
          ? "Every one of its people's lands has coal within reach, so none turns to this."
          : "Every one of its people's lands has copper to harden, so none turns to this.";
      return l.on === "river"
        ? "Its people's lands have no river."
        : l.on === "coast"
          ? "Its people's lands have no coast."
          : "Its people's lands have no high ground.";
    }
    case "needs":
      return "";
  }
}

/** Functions whose want comes down to fire, its seas or its ice, whatever each says of itself. */
const SAYS_SEAS: ReadonlySet<string> = new Set([
  "heat-from-ground",
  "heat-by-mirror",
  "engine-by-mirror",
  "engine-from-ground",
  "draw-polymer",
  "wind-dynamo",
  "fly-under-power",
  "throw-far",
  "densest-store",
]);
const SAYS_ICE: ReadonlySet<string> = new Set([
  "heat-from-ground",
  "bloom-an-iron",
  "densest-store",
]);

/** What a stop comes down to, to gather the steps it shuts together. */
export function causeOf(stop: Stop, w: CanWorld): string {
  const s = rootStop(stop),
    n = w.numbers;
  if (s.on === "medium" && !s.wants.includes("water")) return "sea";
  if (s.on === "burns") return n.freeOxygen && n.medium === "water" ? "sea" : "burns";
  if (s.on === "matter") {
    if (n.medium === "water" && SAYS_SEAS.has(s.f.id)) return "sea";
    if (!n.rock && SAYS_ICE.has(s.f.id)) return "ice";
    if (!n.freeOxygen && s.f.id === "fly-under-power") return "burns";
    return `matter:${s.f.id}`;
  }
  if (s.on === "land") return s.land.on === "ore" ? `ore:${s.land.ore}` : s.land.on;
  return s.on;
}

/** Whether what a cause says holds only as its people's lands stand: they may yet spread to what they lack. */
export const asLandsStand = (cause: string): boolean =>
  cause.startsWith("ore:") || ["river", "coast", "hills", "aside"].includes(cause);

/** A cause's sentence: the fact it comes down to, where several functions say it each their own way. */
function causeWords(key: string, stop: Stop, w: CanWorld): string {
  if (key === "sea")
    return "Its people live under water: no fire, no hearth and no machine rises from there.";
  if (key === "ice")
    return "Its rock lies under its ice, out of any mine's reach: of metal, only what falls from its sky can be had.";
  if (key === "burns" && !w.numbers.freeOxygen)
    return "Its air holds no free oxygen: nothing burns.";
  const s = rootStop(stop);
  if (s.on === "matter") {
    const why = stopWords(s, w);
    return `To ${s.f.name}: ${why[0]!.toLowerCase()}${why.slice(1)}`;
  }
  return stopWords(stop, w);
}

/** The steps that are no part of Earth's own road: a world comes to these only where its numbers ask. */
const OWN_ROAD: ReadonlySet<string> = new Set([
  "diamond-grit",
  "pitch-ware",
  "cold-hammering",
  "carbide-blades",
  "sun-engines",
  "graphite-dynamos",
  "made-oxygen",
  "acid-leaching",
  "sulfur-concrete",
  "ice-ware",
  "ice-working",
  "heat-engines",
  "ground-dynamos",
  "cold-chemistry",
  "polymer-wire",
  "star-iron",
  "set-edges",
  "bound-plates",
  "ground-furnace",
  "sun-furnace",
  "joined-hearth",
  "forged-star-iron",
  "wings",
  "tall-frames",
  "lane-sounding",
]);
/** Whether a step is one Earth's own road walks. */
export const onFirstRoad = (p: Principle): boolean =>
  !OWN_ROAD.has(p.id) && (!p.body?.media || p.body.media.includes("land"));

/** A step's name on this world: as its means do it, else its own. */
export const stepName = (id: string, w: Pick<CanWorld, "means" | "chem">): string =>
  meansName(id, w.means) ?? principleNameOn(w.chem, id);

/** What shuts most of Earth's road here: each cause, its sentence, and the steps it shuts, the earliest first. */
export type Cause = {
  readonly key: string;
  readonly words: string;
  readonly steps: readonly string[];
};
export function causesOf(w: CanWorld, open: ReadonlySet<string>): readonly Cause[] {
  const out = new Map<string, { words: string; steps: string[] }>();
  for (const p of PRINCIPLES) {
    if (open.has(p.id) || !onFirstRoad(p)) continue;
    const why = whyShut(p.id, w, open);
    if (!why) continue;
    const key = causeOf(why, w);
    const had = out.get(key);
    if (had) had.steps.push(p.id);
    else out.set(key, { words: causeWords(key, why, w), steps: [p.id] });
  }
  return [...out]
    .map(([key, c]) => ({ key, ...c }))
    .sort((a, b) => b.steps.length - a.steps.length || (a.key < b.key ? -1 : 1));
}

/** Steps open here that Earth's road never walks: this world's own way. */
export function ownRoadOf(open: ReadonlySet<string>): readonly string[] {
  return PRINCIPLES.filter(
    (p) => open.has(p.id) && p.rate > 0 && !onFirstRoad(p) && !p.body?.media && !p.law,
  ).map((p) => p.id);
}

/** A world's own numbers where they part far from Earth's, each with what it means. */
export type OddNumber = { readonly key: string; readonly icon: string; readonly words: string };
export function oddNumbers(
  w: CanWorld,
  said: ReadonlySet<string> = new Set(),
): readonly OddNumber[] {
  const n = w.numbers,
    out: OddNumber[] = [],
    pull = Math.round(n.pull * 100) / 100,
    air = airWeight(n);
  if (w.peopled && !n.grips && n.medium !== "water")
    out.push({
      key: "grip",
      icon: "🤲",
      words: `Its people's limbs cannot grip a haft: what they bear is strapped along the limb.${w.noGrip ? ` ${w.noGrip}` : ""}`,
    });
  if (w.peopled && n.medium === "water" && !said.has("sea"))
    out.push({
      key: "water",
      icon: "🌊",
      words: `Its people live under water, in a liquid of ${thousands(n.seaKgM3)} kg a cubic metre: a ball stops within metres, and no hearth stands there.`,
    });
  if (Math.abs(n.pull - 1) >= 0.2)
    out.push({
      key: "pull",
      icon: n.pull > 1 ? "🪨" : "🪶",
      words: `Its pull is ${pull} g: a wall weighs ${Math.round(n.pull * 100)}% of what it would on Earth, flying asks ${Math.round(flightPower(n) * 100)}% of Earth's power, and orbit ${Math.round(w.orbitKms * 10) / 10} km/s.`,
    });
  if (!n.rock && !said.has("ice"))
    out.push({
      key: "ice",
      icon: "🧊",
      words:
        "Its rock lies under its ice, out of any mine's reach: only what falls from its sky can be had of metal.",
    });
  if (air >= 1.6 || air <= 0.5)
    out.push({
      key: "air",
      icon: "🌫️",
      words: `Its air weighs ${Math.round(air * 10) / 10} times Earth's: a ball slows ${air > 1 ? "sooner" : "later"}, and a wing bites ${air > 1 ? "harder" : "less"}.`,
    });
  if (n.metalShare < VEIN_SHARE)
    out.push({
      key: "metals",
      icon: "✨",
      words: `Its star has ${Math.round(n.metalShare * 100)}% of the Sun's metals: too little for a vein to gather a hardener (an estimate).`,
    });
  if (w.peopled && !n.firstRoad && (!n.beast || n.beast.kg < CARRIES * n.bodyKg))
    out.push({
      key: "beast",
      icon: "🐾",
      words: n.beast
        ? `Its biggest tame beast, the ${n.beast.name}, is ${thousands(n.beast.kg)} kg, and a rider of ${thousands(n.bodyKg)} kg wants ${thousands(CARRIES * n.bodyKg)} kg under them: its people go on foot.`
        : "No beast of this world can be tamed: its people go on foot.",
    });
  return out;
}

// —— What a people wants done, each a ladder ——————————————————————————————————————————————————————————

/** A rung: the steps that bring it (each list wants one of its ids), and what it comes to here. */
type Rung = {
  readonly by: readonly (readonly string[])[];
  /** Its name here (null: no such rung on this world); left out, its step's. */
  readonly name?: (w: CanWorld) => string | null;
  readonly figure?: (w: CanWorld, knows: Knows) => string | null;
  /** Listed even when shut: a step of Earth's own road, whose absence says something. */
  readonly first?: boolean;
  /** Its stuff's page, where its step has none better. */
  readonly subst?: (w: CanWorld) => string | null;
  /** What keeps the rung from being had here though its step can be known (null: nothing). */
  readonly bar?: (w: CanWorld, open: ReadonlySet<string>) => string | null;
};
const at = (...ids: readonly string[]): readonly (readonly string[])[] => ids.map((x) => [x]);

/** Share of steel's edge, by the law that gives bronze 0.7, iron 0.79, steel 1. */
const share = (x: number) => `${Math.round(x * 100)}% of steel's edge`;
/** Metres a thing thrown carries, by the design grammar's range: the musket 0.85 at 100 m, doubling each 0.15. */
const metres = (axis: number) => Math.round(100 * dmath.pow(2, (axis - 0.85) / 0.15));
const fn = (w: CanWorld, id: string) => w.functions.find((f) => f.id === id);
const fnBy = (id: string) => (w: CanWorld) => fn(w, id)?.by ?? null;
/** A gun's reach here, for its step. */
const gunReach = (id: string) => (w: CanWorld) => {
  const f = firearm(id),
    g = f ? gunHere(f, w.numbers) : null;
  return g ? `carries ${thousands(g.range)} m on ${g.charge.name}` : null;
};
const LAND = (w: CanWorld) => w.medium !== "water";
const SEA = (w: CanWorld) => w.medium === "water";

/** A function a people wants done: `main` on the page's first face, the rest a tap away. */
export type CanFunction = {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly main: boolean;
  /** How its best rung reads, where it has come to one: "Gets to 1,500 °C". */
  readonly says?: (figure: string, stops: boolean) => string;
  readonly rungs: (w: CanWorld) => readonly Rung[];
};

const onLand = (r: Rung): Rung => ({
  ...r,
  name: (w) => (LAND(w) ? (r.name ? r.name(w) : stepName(r.by[0]![0]!, w)) : null),
});
const onSea = (r: Rung): Rung => ({
  ...r,
  name: (w) => (SEA(w) ? (r.name ? r.name(w) : stepName(r.by[0]![0]!, w)) : null),
});

/** Those of a principle's rungs its name is told for here only where it is open (`first` always). */
export const CAN_FUNCTIONS: readonly CanFunction[] = [
  {
    id: "edge",
    icon: "🗡️",
    name: "Holding an edge",
    main: true,
    rungs: () => [
      { by: [], name: () => "knapped stone", figure: () => share(0.4) },
      { by: at("ice-working"), figure: () => share(0.3) },
      { by: at("cold-hammering"), figure: () => share(0.5) },
      {
        by: at("set-edges"),
        figure: (w) => {
          const e = w.means.edge;
          return e ? share(edgeFigure(e.mohs(w.numbers.kelvin), e.k1c)) : null;
        },
        subst: (w) => w.means.edge?.subst ?? null,
      },
      { by: at("bronze"), figure: () => share(0.7), first: true },
      { by: at("electrochemistry"), figure: () => share(0.75) },
      { by: at("iron"), figure: () => share(0.8), first: true },
      { by: at("carbide-blades"), figure: () => share(0.8) },
      { by: at("refined-metals"), figure: () => share(0.9) },
      { by: at("steel"), figure: () => share(1), first: true },
      { by: at("made-oxygen"), name: () => "steel of made oxygen", figure: () => share(1) },
    ],
  },
  {
    id: "heat",
    icon: "🔥",
    name: "Heat, and how high it goes",
    main: true,
    says: (figure, stops) => `${stops ? "Stops at" : "Gets to"} ${figure}`,
    rungs: (w) => {
      if (w.means.burns) {
        const off = AIR_OFFSET[w.chem.air];
        return FURNACES.map((f): Rung => ({
          by: f.by ? at(f.by) : [],
          name: () => (f.id === "arc" ? `${f.name}, on current` : `burning a fuel in ${f.name}`),
          figure: (_, knows) => degrees(f.heat + (off < 0 && knows(DRIVEN_BLAST) ? 0 : off)),
        }));
      }
      return [
        {
          by: at("__burning"),
          name: () => "burning a fuel",
          figure: () => null,
          first: true,
        },
        ...[...w.means.heats]
          .filter((h) => h.heat > 0)
          .sort((a, b) => a.heat - b.heat)
          .map((h): Rung => ({
            by: h.by,
            name: () => h.name,
            figure: () => degrees(h.heat),
            first: h.id === "mirror" || h.id === "great-mirror" || h.heat >= 700,
          })),
      ];
    },
  },
  {
    id: "charge",
    icon: "💥",
    name: "A charge",
    main: true,
    rungs: () => [
      onLand({
        by: at("gunpowder"),
        name: (w) =>
          w.means.handCharge?.name ?? w.means.worksCharge?.name ?? stepName("gunpowder", w),
        figure: (w) => {
          const c = w.means.handCharge ?? w.means.worksCharge;
          return c ? `${c.mj} MJ/kg` : null;
        },
        first: true,
      }),
      onSea({
        by: at("gas-darts"),
        name: (w) => w.means.worksCharge?.name ?? stepName("gas-darts", w),
        figure: (w) => (w.means.worksCharge ? `${w.means.worksCharge.mj} MJ/kg` : null),
        first: true,
      }),
      onLand({
        by: at("self-loading"),
        name: (w) => w.means.worksCharge?.name ?? stepName("self-loading", w),
        figure: (w) =>
          w.means.worksCharge ? `${w.means.worksCharge.mj} MJ/kg, made at works` : null,
        first: true,
      }),
    ],
  },
  {
    id: "far",
    icon: "🏹",
    name: "Throwing things far",
    main: true,
    rungs: () => [
      onSea({
        by: at("shell-craft"),
        name: () => "darts of shell",
        figure: () => `carries ${metres(0.45)} m`,
      }),
      onLand({ by: at("archery"), figure: () => `carries ${metres(0.6)} m` }),
      onSea({
        by: at("gas-darts"),
        figure: (w) => `carries ${thousands(waterRange("gas-dart", w.numbers))} m in its seas`,
        first: true,
      }),
      onSea({
        by: at("sound-lances"),
        figure: (w) => `carries ${thousands(waterRange("sound-lance", w.numbers))} m in its seas`,
        first: true,
      }),
      ...FIREARMS.map((f) =>
        onLand({
          by: at(f.principle),
          figure: gunReach(f.id),
          first: f.id === "musket" || f.id === "rifle",
        }),
      ),
      onLand({
        by: at("thrown-loads"),
        name: () => "a load carried by rocket",
        figure: (w, knows) => {
          const c = w.means.worksCharge;
          if (!c) return null;
          const r = rocketOn(w.numbers, c.mj, stagesKnown(knows));
          return r.around
            ? `lands anywhere on its world, ${thousands(aroundKm(w.numbers))} km`
            : `lands ${thousands(r.reachKm)} km away`;
        },
        first: true,
      }),
    ],
  },
  {
    id: "engine",
    icon: "⚙️",
    name: "Moving under its own power",
    main: true,
    rungs: () => [
      { by: [], name: () => "their own strength", figure: () => "0.1 kW a head" },
      onLand({ by: at("draught"), figure: () => "beasts that pull" }),
      onLand({
        by: at("steam-engine"),
        figure: () => "150 W to the kilogram, on coal",
        first: true,
      }),
      onSea({ by: at("current-mills") }),
      onSea({ by: at("vent-heat") }),
      {
        by: at("sun-engines"),
        figure: (w) => `mirrors at ${fnBy("engine-by-mirror")(w) ?? "too little"}`,
      },
      {
        by: at("heat-engines"),
        figure: (w) =>
          `${fnBy("engine-from-ground")(w) ?? "too few degrees"} between ground and air`,
      },
      { by: at("cold-chemistry"), figure: (w) => fnBy("join-gases")(w) },
      onLand({ by: at("engines"), figure: () => "490 W to the kilogram, on oil", first: true }),
    ],
  },
  {
    id: "flight",
    icon: "🛩️",
    name: "Flight",
    main: true,
    rungs: () => [
      onLand({
        by: at("wings"),
        figure: (w) => `${Math.round(flightPower(w.numbers) * 100)}% of the power Earth asks`,
      }),
      onLand({
        by: at("powered-wings"),
        figure: (w) => {
          const e = liftingEngine(w.numbers);
          if (!e) return null;
          const m = flyerOn(e, w.numbers);
          return `${thousands(m.speed * 3.6)} km/h, ${thousands(m.reachKm)} km out and back`;
        },
        first: true,
      }),
      {
        by: at("orbital-flight"),
        figure: (w) => `asks ${Math.round(w.orbitKms * 10) / 10} km/s`,
        first: true,
        bar: (w, open) =>
          open.has("orbital-flight") && !launcherFor((x) => open.has(x), w.orbitKms)
            ? `Its pull of ${Math.round(w.numbers.pull * 100) / 100} g asks ${Math.round(w.orbitKms * 10) / 10} km/s to reach orbit, past any engine its people could build.`
            : null,
      },
    ],
  },
  {
    id: "word",
    icon: "📡",
    name: "Talking at a distance",
    main: true,
    rungs: () => [
      {
        by: [],
        name: (w) => `a word carried by ${w.medium === "water" ? "a swimmer" : "a runner"}`,
        figure: paceBy("foot"),
      },
      { by: at("writing"), name: () => "a letter", figure: () => null },
      onLand({ by: at("riding"), name: () => "a rider", figure: paceBy("rider") }),
      onSea({
        by: at("current-reading"),
        name: () => "a messenger riding the currents",
        figure: paceBy("current"),
      }),
      onLand({
        by: at("riding", "roads"),
        name: () => "riders in relays on the post roads",
        figure: paceBy("post"),
      }),
      onLand({ by: at("railways"), name: () => "the mail train", figure: paceBy("rail") }),
      {
        by: at("telegraph"),
        name: () => "a word down a wire",
        figure: (w) => withStuff(paceBy("wire")(w), fnBy("carry-current")(w)),
        first: true,
      },
      { by: at("telephone"), figure: paceBy("voice"), first: true },
      onLand({ by: at("radio"), figure: paceBy("air"), first: true }),
      onSea({ by: at("sea-sound"), figure: paceBy("sound"), first: true }),
      { by: at("hand-sets"), figure: () => "a set carried by hand, on valves", first: true },
      {
        by: at("orbital-flight"),
        name: () => "a word from orbit",
        figure: (w) => `the whole world, ${thousands(aroundKm(w.numbers) * 2)} km round`,
        first: true,
      },
      {
        by: at("networks"),
        figure: (w) => withStuff(paceBy("web")(w), fnBy("switch-in-crystal")(w)),
        first: true,
      },
      { by: at("pocket-machines"), figure: () => "a machine in every pocket", first: true },
    ],
  },
  {
    id: "vessel",
    icon: "🏺",
    name: "A vessel that keeps",
    main: false,
    rungs: () => [
      { by: at("shell-craft") },
      { by: at("ice-ware") },
      { by: at("pitch-ware") },
      {
        by: at("pottery-wheel"),
        first: true,
        figure: (w) => (w.means.vessel ? `fired at ${degrees(w.means.vessel.heat)}` : null),
        subst: (w) => w.means.vessel?.subst ?? null,
      },
    ],
  },
  {
    id: "glass",
    icon: "🔍",
    name: "Glass",
    main: false,
    rungs: () => [
      {
        by: at("glass"),
        first: true,
        figure: (w) => (w.means.glass ? `melts at ${degrees(w.means.glass.heat)}` : null),
      },
    ],
  },
  {
    id: "beast",
    icon: "🐎",
    name: "Riding",
    main: false,
    rungs: () => [
      onLand({ by: at("draught") }),
      onLand({
        by: at("riding"),
        first: true,
        figure: (w) =>
          w.numbers.beast
            ? `the ${w.numbers.beast.name}, ${thousands(w.numbers.beast.kg)} kg`
            : null,
      }),
      onLand({ by: at("cavalry") }),
    ],
  },
  {
    id: "current",
    icon: "🔌",
    name: "A current",
    main: false,
    rungs: () => [
      onSea({ by: at("sea-electricity"), first: true, figure: fnBy("carry-current") }),
      { by: at("graphite-dynamos"), figure: fnBy("wind-dynamo") },
      { by: at("ground-dynamos"), figure: fnBy("engine-from-ground") },
      { by: at("polymer-wire"), figure: fnBy("draw-polymer") },
      onLand({ by: at("electricity"), first: true, figure: fnBy("carry-current") }),
    ],
  },
  {
    id: "high",
    icon: "🏗️",
    name: "Building high",
    main: false,
    rungs: () => [
      { by: at("masonry") },
      { by: at("arches") },
      {
        by: at("tall-frames"),
        figure: (w) => `a wall weighs ${Math.round(w.numbers.pull * 100)}% of Earth's`,
      },
      { by: at("world-city"), first: true, figure: fnBy("roof-a-world") },
    ],
  },
  {
    id: "mind",
    icon: "🧠",
    name: "Reckoning",
    main: false,
    rungs: () => [
      { by: at("mathematics") },
      { by: at("electronics"), first: true, figure: fnBy("switch-current") },
      { by: at("computing"), first: true, figure: () => "relays and valves" },
      { by: at("solid-state"), first: true, figure: fnBy("switch-in-crystal") },
      { by: at("machine-minds"), first: true, figure: fnBy("think-in-crystal") },
    ],
  },
  {
    id: "sight",
    icon: "🔭",
    name: "Seeing its world whole",
    main: false,
    rungs: () => [
      {
        by: [],
        name: () => SIGHT_WAYS[0]!.name,
        figure: () => `${SIGHT_STEPS.feet} lands round each`,
      },
      onLand({
        by: at("sailing"),
        name: () => SIGHT_WAYS[1]!.name,
        figure: () => `and ${SIGHT_STEPS.inland} lands in`,
      }),
      onSea({ by: at("current-reading"), name: () => SIGHT_WAYS[1]!.name }),
      onLand({
        by: at("powered-wings"),
        name: () => SIGHT_WAYS[2]!.name,
        figure: (w) => {
          const e = liftingEngine(w.numbers);
          return e ? `${thousands(flyerOn(e, w.numbers).reachKm)} km out and back` : null;
        },
        first: true,
      }),
      {
        by: at("rocketry"),
        name: () => SIGHT_WAYS[3]!.name,
        figure: (w) =>
          `${thousands(rocketSightKm(EARTH_KM * w.numbers.radius))} km round, from ${ROCKET_HEIGHT_KM} km up`,
        first: true,
      },
      {
        by: at("orbital-flight"),
        name: () => SIGHT_WAYS[4]!.name,
        figure: () => "every coast, sea and land",
        first: true,
      },
    ],
  },
  {
    id: "out",
    icon: "🚀",
    name: "Out among the worlds",
    main: false,
    rungs: () => [
      { by: at("stations"), first: true },
      { by: at("habitats"), first: true },
      { by: at("fusion-drive"), first: true },
      { by: at("world-making"), first: true, figure: fnBy("remake-a-world") },
      { by: at("star-mirrors"), first: true, figure: fnBy("gather-a-star") },
    ],
  },
  {
    id: "flame",
    icon: "☀️",
    name: "A flame held",
    main: false,
    rungs: () => [
      { by: at("fusion-power"), first: true, figure: fnBy("wall-a-flame") },
      {
        by: at("beam-arms"),
        first: true,
        figure: fnBy("beam-a-light"),
        bar: (w) => w.noGrip ?? null,
      },
    ],
  },
  {
    id: "store",
    icon: "☢️",
    name: "The densest store of energy",
    main: false,
    rungs: () => [
      onLand({
        by: at("greatest-fire"),
        name: (w) => fireName(w.numbers),
        first: true,
        figure: (w) => `its star's metals ${Math.round(w.numbers.metalShare * 100)}% of the Sun's`,
      }),
    ],
  },
];

/** A rung as it stands on a world. */
export type RungHere = {
  readonly name: string;
  readonly figure: string | null;
  /** have: its people know it; open: they could; shut: this world says no. */
  readonly state: "have" | "open" | "shut";
  /** The step whose page tells it (null: nothing to find: it is had by all). */
  readonly by: string | null;
  readonly subst: string | null;
  readonly first: boolean;
  /** What shuts it, as a sentence, and what that comes down to. */
  readonly why: string | null;
  readonly cause: string | null;
  /** What it wants first, where it is open and not yet come to: steps its people could set about now. */
  readonly missing: readonly string[];
};
export type FunctionHere = {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly main: boolean;
  /** Its rungs that say anything here, lowest first. */
  readonly rungs: readonly RungHere[];
  /** The best its people have now, the next they could come to, the best they ever could. */
  readonly now: RungHere | null;
  readonly next: RungHere | null;
  readonly top: RungHere | null;
  /** Its best rung in the world's own words: "Gets to 1,500 °C: ...", and the words about its name. */
  readonly words: string;
  readonly says: { readonly before: string; readonly after: string };
};

/** What stands first in the way of a step: those its people could set about now, walking back through its needs. */
export function firstWanted(
  id: string,
  w: CanWorld,
  open: ReadonlySet<string>,
  knows: Knows,
  seen: Set<string> = new Set(),
): string[] {
  if (seen.has(id) || knows(id)) return [];
  seen.add(id);
  const p = byId.get(id);
  if (!p || p.rate <= 0) return [id];
  if (needsMet(p, knows)) {
    // (All it needs known, and it wants a heat a means not yet known reaches.)
    const s = stepStop(p, w, knows);
    if (s?.on === "heat") {
      const way = w.means.heats.find(
        (h) => h.heat >= s.want && h.by.every((any) => any.some((x) => open.has(x))),
      );
      const out: string[] = [];
      for (const any of way?.by ?? [])
        if (!any.some(knows)) {
          const o = any.find((x) => open.has(x));
          if (o)
            for (const x of firstWanted(o, w, open, knows, seen)) if (!out.includes(x)) out.push(x);
        }
      if (out.length) return out;
    }
    return [id];
  }
  const out: string[] = [];
  for (const need of p.needs) {
    const options = need.split("|");
    if (options.some(knows)) continue;
    const o = options.find((x) => open.has(x));
    if (o) for (const x of firstWanted(o, w, open, knows, seen)) if (!out.includes(x)) out.push(x);
  }
  return out;
}

/** The ladder of a function on a world. */
function readRungs(
  fnc: CanFunction,
  w: CanWorld,
  open: ReadonlySet<string>,
  knows: Knows,
): RungHere[] {
  const out: RungHere[] = [];
  for (const r of fnc.rungs(w)) {
    const first = r.by[0]?.[0] ?? null,
      burning = first === "__burning";
    const name = r.name ? r.name(w) : first ? stepName(first, w) : null;
    if (name === null) continue;
    const bar = r.bar?.(w, open) ?? null,
      have = !bar && !burning && (!r.by.length || r.by.every((any) => any.some(knows))),
      can = !bar && !burning && (!r.by.length || r.by.every((any) => any.some((x) => open.has(x)))),
      shutList = r.by.find((any) => !any.some((x) => open.has(x))),
      stop = burning
        ? ({ on: "burns" } as Stop)
        : !can && shutList
          ? whyShut(shutList[0]!, w, open)
          : null;
    if (!can && !r.first) continue;
    const by = r.by.flat().find(knows) ?? r.by.flat().find((x) => open.has(x)) ?? first,
      wanted =
        can && !have
          ? r.by.flatMap((any) => (any.some(knows) ? [] : [any.find((x) => open.has(x))!]))
          : [],
      missing: string[] = [];
    for (const x of wanted)
      for (const y of firstWanted(x, w, open, knows)) if (!missing.includes(y)) missing.push(y);
    out.push({
      name,
      figure: r.figure?.(w, knows) ?? null,
      state: have ? "have" : can ? "open" : "shut",
      by: burning ? null : (by ?? null),
      subst: r.subst?.(w) ?? null,
      first: !!r.first,
      why: bar ?? (stop ? stopWords(stop, w) : null),
      cause: bar ? "bar" : stop ? causeOf(stop, w) : null,
      missing,
    });
  }
  return out;
}

/** What a world can do, function by function. */
export function readCan(
  w: CanWorld,
  open: ReadonlySet<string>,
  knows: Knows,
): readonly FunctionHere[] {
  return CAN_FUNCTIONS.map((f) => {
    const rungs = readRungs(f, w, open, knows),
      now = rungs.filter((r) => r.state === "have").at(-1) ?? null,
      after = now ? rungs.indexOf(now) : -1,
      next = rungs.slice(after + 1).find((r) => r.state === "open") ?? null,
      top = rungs.filter((r) => r.state !== "shut").at(-1) ?? null,
      best = now ?? top;
    const figure = best?.figure ?? null,
      says =
        f.says && figure
          ? { before: `${f.says(figure, !next && best === now)}: `, after: "" }
          : { before: "", after: figure ? `: ${figure}` : "" };
    return {
      id: f.id,
      icon: f.icon,
      name: f.name,
      main: f.main,
      rungs,
      now,
      next,
      top,
      says,
      words: !w.peopled
        ? "No one here to do it."
        : !best
          ? !rungs.length && w.medium === "water"
            ? "Its people live under water, and this is for those on land or shore."
            : "Shut on this world."
          : `${says.before}${says.before ? best.name : `${best.name[0]!.toUpperCase()}${best.name.slice(1)}`}${says.after}`,
    };
  });
}
