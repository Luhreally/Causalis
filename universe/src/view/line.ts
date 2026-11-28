// A line lived (Live a Line, asked 2026-11-27): one cell of a world's first seas played by hand, and its line after it.
// What it can do is read off the world it lives in, never a stat of its own: it swims through its world's liquid as a cell
// does there (a body a few micrometres long meets its liquid's viscosity, not its weight: the Reynolds number tells how),
// lives by light only where its world's life has a pigment that the light reaching its seas can drive, takes in other
// cells only once a nucleus and a skeleton within have arisen on its world, and stays together as many cells only once its
// world's cells first did. It divides when what it has gathered is twice what it is worth (its size to the 1.5, as every
// cell of the drop: view/drop.ts worth), and the player chooses which of its two or three daughters to live on in: each a
// draw keyed on the world, the saga, the generation and the child, so the same choices give the same line. The deep clock
// is driven by what the line gathers, and a step of the dawn opens to it no earlier than the world's own date for it.
//
// Pure and no part of history: nothing here is read by the world, and the saga it makes is kept beside it, never hashed
// (host/saga.ts). Its page's part is app/line.ts, fetched only when the mode is entered.
import { finish, hashString, mix } from "../kernel/index.ts";
import { reynolds } from "../rules/index.ts";
import { DRIFT, SPEED, worth } from "./drop.ts";

export type CellWay = "eater" | "light" | "hunter" | "colony" | "rock";

/** What the host tells of a world for its line to be lived (host/saga.ts lineFactsOf). */
export type LineFacts = {
  readonly digest: string;
  /** Its world's kind ("rocky", "methane"…) and its life's family (water, ammonia, oil, methane). */
  readonly kind: string;
  readonly family: string;
  /** Its seas' liquid: its substance (rules/matter.ts) and its name. */
  readonly liquid: string;
  readonly liquidName: string;
  /** What its life catches light with, and what the skins of its cells are (rules/biochem.ts). */
  readonly pigment: string;
  readonly membrane: string;
  /** Its pull, Earth's 1. */
  readonly gravity: number;
  /** The line asked to be lived (a tree-of-life node), and the steps of the dawn its forebears went through. */
  readonly line: {
    readonly ref: string;
    readonly name: string;
    readonly light: boolean;
    readonly nucleus: boolean;
    readonly together: boolean;
  } | null;
};

/** A step of the dawn (the genesis plan's): when it came, millions of years ago. */
export type LineRung = {
  readonly id: string;
  readonly name: string;
  readonly at: number;
  readonly words: string;
};

/** A cell of the line: its size across (µm), its drive (µm a second in water), and the ways it has taken up. */
export type Traits = {
  readonly size: number;
  readonly speed: number;
  /** What its line first lived by: what floats ("eater"), or the chemistry of a rock grain ("rock"). */
  readonly base: "eater" | "rock";
  readonly nucleus: boolean;
  readonly light: boolean;
  readonly together: boolean;
  /** The parts it has grown (absent: none). */
  readonly parts?: Parts;
};

/** The way a cell of these traits lives in the drop (and is drawn as): the last way it took up. */
export function wayOf(t: Traits): CellWay {
  return t.together ? "colony" : t.nucleus ? "hunter" : t.light ? "light" : t.base;
}

// —— Its liquid ————————————————————————————————————————————————————————————————————————————————————————————————————

/**
 * How thick each world's liquid is to a cell (viscosity, Pa·s) and how dense (kg/m³), near where its seas lie liquid:
 * water at 20 °C 1.0 mPa·s; dilute sulfuric acid some 2.5; ammonia water near its freezing some 0.4 (pure liquid ammonia
 * 0.27 at −33 °C); a light crude oil some 8; liquid methane and ethane near 95 K some 0.16 (handbook figures).
 */
export const MEDIUM: Readonly<Record<string, { readonly mu: number; readonly rho: number }>> = {
  water: { mu: 1.0e-3, rho: 1000 },
  "acid-water": { mu: 2.5e-3, rho: 1300 },
  "ammonia-water": { mu: 4.0e-4, rho: 750 },
  crude: { mu: 8.0e-3, rho: 860 },
  methane: { mu: 1.6e-4, rho: 450 },
};
const WATER = MEDIUM.water!;

export function mediumOf(f: Pick<LineFacts, "liquid">): { mu: number; rho: number } {
  return MEDIUM[f.liquid] ?? WATER;
}

/**
 * How fast a cell goes in its world's liquid (µm a second). A swimmer this small meets only viscous drag (Stokes: 6πμrv),
 * so the power it can spend on swimming, v times that, gives v as one over the root of the viscosity: twice as fast in a
 * liquid a quarter as thick.
 */
export function swimSpeed(t: Traits, f: Pick<LineFacts, "liquid">): number {
  const k = Math.sqrt(WATER.mu / mediumOf(f).mu);
  return t.speed * Math.min(2.5, Math.max(0.3, k)) * partEffects(t).speed;
}

/** The Reynolds number of a cell going at its speed: under one, inertia is nothing to it (it stops when it stops pushing). */
export function reynoldsOf(t: Traits, f: Pick<LineFacts, "liquid">): number {
  const m = mediumOf(f);
  return reynolds(m.rho, swimSpeed(t, f) * 1e-6, t.size * 1e-6, m.mu);
}

/** A small number in words, as a page gives it ("0.00003"). */
export function smallWords(x: number): string {
  if (x >= 0.01) return x.toFixed(2);
  const digits = Math.max(1, -Math.floor(Math.log10(x)));
  return x.toFixed(Math.min(12, digits));
}

// —— What the world allows ————————————————————————————————————————————————————————————————————————————————————————

export type Gate = {
  readonly allowed: boolean;
  readonly open: boolean;
  readonly at: number | null;
  readonly why: string;
};
export type Gates = {
  readonly light: Gate;
  readonly nucleus: Gate;
  readonly together: Gate;
  readonly bodies: Gate;
};

const rungOf = (rungs: readonly LineRung[], id: string) => rungs.find((r) => r.id === id) ?? null;

/** When, in words: "3.41 billion years ago". */
export function myWords(my: number): string {
  if (my <= 0) return "the first year";
  if (my >= 1000) return `${(my / 1000).toFixed(2)} billion years ago`;
  if (my >= 10) return `${Math.round(my)} million years ago`;
  return `${my.toFixed(1)} million years ago`;
}

/**
 * What the world lets a line of it take up, and whether its clock has come to it: light where its life has a pigment the
 * light reaching its seas drives (methane life's lives where too little reaches: none), a nucleus, cells together, bodies,
 * each only where its own dawn came to it and no earlier than the date it did.
 */
export function cellGates(
  f: Pick<LineFacts, "pigment" | "liquidName">,
  rungs: readonly LineRung[],
  my: number,
  light: number,
): Gates {
  const gate = (id: string, allowed: boolean, never: string, what: string): Gate => {
    const r = rungOf(rungs, id);
    if (!r || !allowed)
      return { allowed: false, open: false, at: r?.at ?? null, why: !r ? never : what };
    const open = my <= r.at;
    return {
      allowed: true,
      open,
      at: r.at,
      why: open ? "" : `no cell of this world has it yet: it comes ${myWords(r.at)}`,
    };
  };
  const pigment = f.pigment !== "polyimine" && light >= 0.08;
  return {
    light: gate(
      "light",
      pigment,
      "life on this world never learned to live by light",
      f.pigment === "polyimine"
        ? `too little light reaches seas of ${f.liquidName} for a pigment to live by`
        : "too little light reaches these waters to live by",
    ),
    nucleus: gate("nucleus", true, "no cell of this world ever grew a nucleus", ""),
    together: gate("together", true, "the cells of this world never stayed together", ""),
    bodies: gate("bodies", true, "no body ever grew of this world's cells", ""),
  };
}

// —— The deep clock, driven by what the line gathers —————————————————————————————————————————————————————————————

/** About how many divisions the cell's stage takes, its first cells to its first bodies (some 10 to 20 minutes' play). */
export const GENERATIONS = 30;

/** The cell's stage: from the world's first cells to its first bodies (millions of years ago). */
export function cellSpan(rungs: readonly LineRung[]): { from: number; to: number } {
  const from = rungOf(rungs, "cells")?.at ?? rungs[0]?.at ?? 3800,
    to = rungOf(rungs, "bodies")?.at ?? rungOf(rungs, "together")?.at ?? 0;
  return { from, to: Math.min(from, to) };
}

/**
 * The clock on for what was gathered (`gain`, in a cell's worth: a whole division's is twice its worth), held short of the
 * first bodies until the line has stayed together (no body grows of a cell alone).
 */
export function clockOn(
  my: number,
  gain: number,
  w: number,
  rungs: readonly LineRung[],
  t: Traits,
): number {
  const span = cellSpan(rungs),
    step = ((span.from - span.to) / GENERATIONS) * (Math.max(0, gain) / Math.max(1e-9, 2 * w)),
    floor = t.together ? span.to : span.to + Math.max(1, (span.from - span.to) * 0.004);
  return Math.max(floor, my - step);
}

/** Whether the cell's stage is done: the line together, and its clock come to the first bodies. */
export function cellDone(my: number, rungs: readonly LineRung[], t: Traits): boolean {
  return t.together && my <= cellSpan(rungs).to;
}

// —— Daughters ——————————————————————————————————————————————————————————————————————————————————————————————————

/** A keyed draw in [0, 1): of the world, the saga, the generation, the child and the draw's own slot. */
export function lineDraw(
  digest: string,
  saga: number,
  gen: number,
  child: number,
  k: number,
): number {
  let h = hashString(`line ${digest}`);
  h = mix(h, saga);
  h = mix(h, gen);
  h = mix(h, child);
  h = mix(h, k);
  return finish(h, 5) / 4294967296;
}
const normalOf = (u: (k: number) => number, k: number) => (u(k) + u(k + 1) + u(k + 2) - 1.5) * 2;

// —— Its parts ——————————————————————————————————————————————————————————————————————————————————————————————————————
// (2026-11-28, the owner's "fun pizaz": a daughter's change shown as a part one can see.) Each part's worth and its cost
// come from what a cell is at its size in its liquid: at a Reynolds number far under one a swimmer's speed is its thrust
// against its drag (Stokes: drag = 6πμrv), so a longer whip of a flagellum pushes harder and a spike or a thick wall
// drags; every part is made and kept of what the cell gathers, so each costs to keep. A part a world's chemistry cannot
// make never comes: an eyespot needs a pigment its light can drive; a spike of mineral, or a poison that dissolves, needs
// a liquid that carries them (water, or water with acid or ammonia in it, not oil or liquid methane).

export type PartId =
  "flagellum" | "cilia" | "spike" | "wall" | "toxin" | "eyespot" | "mouth" | "filter";
/** A cell's parts, each at a level (1 or 2; absent: none). */
export type Parts = Readonly<Partial<Record<PartId, number>>>;

/** Each part: its name, what it does for a level of it (speed and upkeep as factors), and its words. */
export const PARTS: Readonly<
  Record<
    PartId,
    {
      readonly name: string;
      readonly speed: number;
      readonly upkeep: number;
      readonly does: string;
    }
  >
> = {
  flagellum: {
    name: "a flagellum",
    speed: 0.3,
    upkeep: 0.15,
    does: "a whip it beats to push itself on: faster",
  },
  cilia: {
    name: "cilia",
    speed: 0.05,
    upkeep: 0.08,
    does: "a fringe of tiny oars: its darts last longer",
  },
  spike: {
    name: "spikes",
    speed: -0.08,
    upkeep: 0.06,
    does: "spines of mineral: a hunter takes longer to swallow it",
  },
  wall: {
    name: "a tougher wall",
    speed: -0.06,
    upkeep: 0.12,
    does: "a thicker skin: harder to wrap and swallow",
  },
  toxin: {
    name: "a toxin",
    speed: 0,
    upkeep: 0.2,
    does: "a poison in its skin: a hunter that grips it lets go",
  },
  eyespot: {
    name: "an eyespot",
    speed: 0,
    upkeep: 0.05,
    does: "a patch of pigment that feels the light: it sees further",
  },
  mouth: {
    name: "a bigger mouth",
    speed: -0.03,
    upkeep: 0.05,
    does: "it takes in food from further off, and larger cells",
  },
  filter: {
    name: "a filter",
    speed: -0.12,
    upkeep: 0.1,
    does: "a sieve: it catches specks from about it as it goes",
  },
};
const PART_IDS = Object.keys(PARTS) as PartId[];
const POLAR = new Set(["water", "acid-water", "ammonia-water"]);

/** The parts a world's chemistry can make, for a cell (a mouth that takes in cells only once it has a nucleus). */
export function partsAllowed(f: Pick<LineFacts, "liquid" | "pigment">, _t?: Traits): PartId[] {
  return PART_IDS.filter((p) => {
    if (p === "eyespot") return !!f.pigment && f.pigment !== "polyimine";
    if (p === "spike" || p === "toxin") return POLAR.has(f.liquid);
    return true;
  });
}

/** What a cell's parts come to: its speed and upkeep as factors, how long it takes to swallow, its reach and sight. */
export function partEffects(t: Pick<Traits, "parts">): {
  speed: number;
  upkeep: number;
  engulf: number;
  reach: number;
  sight: number;
  dart: number;
  toxin: boolean;
  prey: number;
} {
  const p = t.parts ?? {},
    n = (id: PartId) => p[id] ?? 0;
  let speed = 1,
    upkeep = 1;
  for (const id of PART_IDS) {
    speed *= 1 + PARTS[id].speed * n(id);
    upkeep += PARTS[id].upkeep * n(id);
  }
  return {
    speed: Math.max(0.3, speed),
    upkeep,
    engulf: 1 + 0.5 * n("wall") + 0.35 * n("spike"),
    reach: 1.2 * n("mouth") + 1.5 * n("filter"),
    sight: 1 + 0.25 * n("eyespot"),
    dart: 1 + 0.5 * n("cilia"),
    toxin: n("toxin") > 0,
    prey: 0.5 + 0.1 * n("mouth"),
  };
}

/** A part gained or lost by a daughter, in words with what it does and costs. */
function partWords(id: PartId, level: number, gained: boolean): string {
  const d = PARTS[id],
    sp = Math.round(d.speed * 100),
    up = Math.round(d.upkeep * 100);
  if (!gained)
    return `It lost ${d.name}: ${up}% cheaper to keep${sp ? `, ${sp > 0 ? `${sp}% slower` : `${-sp}% faster`}` : ""}`;
  return `${level > 1 ? "Its" : "It grew"} ${level > 1 ? `${d.name.replace(/^an? /, "")} grew larger` : d.name}: ${d.does}${sp ? `; ${sp > 0 ? `${sp}% faster` : `${-sp}% slower`} through its liquid's drag` : ""}; ${up}% more to keep`;
}

export type Daughter = {
  readonly traits: Traits;
  /** The part it gained or lost against its mother (null: none). */
  readonly part: { readonly id: PartId; readonly gained: boolean } | null;
  /** Whether it carries a part of its mother's mate (a cell with a nucleus may mate before it divides). */
  readonly mate?: boolean;
  /** What it took up that its mother had not (null: none). */
  readonly took: "light" | "nucleus" | "together" | null;
  /** How it differs, each with what it does: from what the drop and the world are. */
  readonly reasons: readonly string[];
};

/** The first cell of a line: the first small cells of its world's drop (on their grain where the rock fed them). */
export function firstTraits(
  kind: { readonly size: number; readonly way: string },
  pace = 1,
): Traits {
  const base = kind.way === "rock" ? "rock" : "eater";
  return {
    size: kind.size,
    speed: SPEED[base] * pace,
    base,
    nucleus: false,
    light: false,
    together: false,
  };
}

/**
 * A cell's daughters as it divides: two, a little unlike it (each its size and drive drawn about its mother's by its way's
 * own drift), and a third where the clock has opened a way its world allows that the line has not yet taken up: a nucleus
 * first (the cells that took in others), then light (a light-eater taken in and kept), then staying together.
 */
export function daughtersOf(
  mother: Traits,
  digest: string,
  saga: number,
  gen: number,
  gates: Gates,
  liquid: Pick<LineFacts, "liquid" | "pigment">,
  mated = false,
): Daughter[] {
  const way = wayOf(mother),
    out: Daughter[] = [];
  const took: Daughter["took"] =
    gates.nucleus.open && !mother.nucleus
      ? "nucleus"
      : gates.light.open && !mother.light
        ? "light"
        : gates.together.open && !mother.together && mother.nucleus
          ? "together"
          : null;
  const many = took ? 3 : 2;
  for (let child = 0; child < many; child++) {
    const u = (k: number) => lineDraw(digest, saga, gen, child, k),
      drift = DRIFT[way],
      // (The two plain daughters lean apart, one larger and one smaller, as two draws seldom fall the same way.)
      lean = child === 0 ? 0.6 : child === 1 ? -0.6 : 0,
      size0 = mother.size * Math.exp(drift * (normalOf(u, 0) + lean)),
      speed0 = mother.speed * Math.exp(0.08 * normalOf(u, 3) - lean * 0.04);
    let t: Traits = {
      ...mother,
      size: Math.round(Math.min(120, Math.max(1, size0)) * 100) / 100,
      speed: Math.round(Math.min(40, Math.max(0.5, speed0)) * 100) / 100,
    };
    const got = child === 2 ? took : null;
    // (Each plain daughter changes one part, gained or lost, by its own draws: the two seldom the same.)
    let part: Daughter["part"] = null;
    if (child < 2) {
      const allowed = partsAllowed(liquid, t).filter((p) => (t.parts?.[p] ?? 0) < 2),
        have = PART_IDS.filter((p) => (t.parts?.[p] ?? 0) > 0),
        lose = have.length > 0 && (u(8) < 0.2 || !allowed.length);
      if (lose) {
        const id = have[Math.floor(u(9) * have.length)]!,
          level = (t.parts?.[id] ?? 1) - 1,
          next = { ...t.parts };
        if (level > 0) next[id] = level;
        else delete next[id];
        t = { ...t, parts: next };
        part = { id, gained: false };
      } else if (allowed.length) {
        const id = allowed[(Math.floor(u(9) * allowed.length) + child * 3) % allowed.length]!;
        t = { ...t, parts: { ...t.parts, [id]: (t.parts?.[id] ?? 0) + 1 } };
        part = { id, gained: true };
      }
    }
    // (What it took up changes what it is: a cell with a nucleus is some ten times as wide as one without; one that kept a
    // light-eater half again; cells together several times the one.)
    if (got === "nucleus")
      t = {
        ...t,
        nucleus: true,
        size: Math.round(t.size * (3 + 2 * u(6)) * 100) / 100,
        speed: t.speed * 0.6,
      };
    else if (got === "light")
      t = { ...t, light: true, size: Math.round(t.size * (1.3 + 0.4 * u(6)) * 100) / 100 };
    else if (got === "together")
      t = {
        ...t,
        together: true,
        size: Math.round(t.size * (2.5 + 1.5 * u(6)) * 100) / 100,
        speed: t.speed * 0.7,
      };
    const why = reasonsOf(mother, { ...t, parts: mother.parts }, got, liquid);
    out.push({
      traits: t,
      took: got,
      part,
      reasons: part
        ? [
            partWords(part.id, t.parts?.[part.id] ?? 0, part.gained),
            ...why.filter((w) => w !== "Much as its mother was"),
          ]
        : why,
    });
  }
  if (mated) {
    // (Her mother's mate's own part, mixed into her: one of those its world allows that her mother has not, by its draws.)
    const u = (k: number) => lineDraw(digest, saga, gen, 3, k),
      allowed = partsAllowed(liquid).filter((p) => (mother.parts?.[p] ?? 0) < 2),
      id = allowed[Math.floor(u(9) * allowed.length)];
    if (id) {
      const t: Traits = {
        ...mother,
        size: Math.round(mother.size * Math.exp(DRIFT[way] * normalOf(u, 0)) * 100) / 100,
        parts: { ...mother.parts, [id]: (mother.parts?.[id] ?? 0) + 1 },
      };
      out.push({
        traits: t,
        took: null,
        part: { id, gained: true },
        mate: true,
        reasons: [
          `From her mother's mate: ${partWords(id, t.parts?.[id] ?? 1, true).replace(/^It grew |^Its /, "")}`,
          ...reasonsOf(mother, { ...t, parts: mother.parts }, null, liquid).filter(
            (w) => w !== "Much as its mother was",
          ),
        ],
      });
    }
  }
  return out;
}

/** Why a daughter is as it is, against its mother, in plain words, each change with what it does. */
export function reasonsOf(
  mother: Traits,
  t: Traits,
  took: Daughter["took"],
  liquid: Pick<LineFacts, "liquid" | "pigment">,
): string[] {
  const out: string[] = [];
  if (took === "nucleus")
    out.push(
      "It grew a nucleus and a skeleton within: it can take in cells under half its size, and is some ten times as wide",
    );
  if (took === "light")
    out.push(
      `It took in a light-eater and kept it alive inside: it can live by light (${liquid.pigment}) near the surface`,
    );
  if (took === "together")
    out.push("Its daughters stay together: many cells living as one, the way a body begins");
  const dw = t.size / mother.size - 1;
  if (!took && Math.abs(dw) >= 0.01)
    out.push(
      dw > 0
        ? `${Math.round(dw * 100)}% larger: a hunting cell must be over ${Math.round(t.size * 2)} µm to take it in; it costs more to keep, and needs more to divide`
        : `${Math.round(-dw * 100)}% smaller: it divides sooner on less, but more hunting cells can take it in`,
    );
  const ds = t.speed / mother.speed - 1;
  if (Math.abs(ds) >= 0.01)
    out.push(
      ds > 0
        ? `${Math.round(ds * 100)}% faster: it reaches food sooner, but every bit of speed costs as its square against the drag of ${MEDIUM_WORDS[liquid.liquid] ?? "its water"}`
        : `${Math.round(-ds * 100)}% slower: it spends less to keep going`,
    );
  if (!out.length) out.push("Much as its mother was");
  return out;
}

const MEDIUM_WORDS: Readonly<Record<string, string>> = {
  water: "the water",
  "acid-water": "the acid water",
  "ammonia-water": "the ammonia water",
  crude: "the oil",
  methane: "the liquid methane",
};

/**
 * The line as its choices made it: the first cell, then each generation's daughter chosen. The same world, saga and
 * choices give the same line (each generation's gates as the clock stood when it divided).
 */
export function lineAt(
  first: Traits,
  digest: string,
  saga: number,
  gens: readonly { readonly pick: number; readonly my: number; readonly mated?: boolean }[],
  gatesAt: (my: number) => Gates,
  liquid: Pick<LineFacts, "liquid" | "pigment">,
): Traits[] {
  const out = [first];
  gens.forEach((g, i) => {
    const d = daughtersOf(out[i]!, digest, saga, i, gatesAt(g.my), liquid, !!g.mated);
    out.push(d[Math.max(0, Math.min(d.length - 1, g.pick))]!.traits);
  });
  return out;
}

// —— What can be done now ———————————————————————————————————————————————————————————————————————————————————————————

export type CellOffer = {
  readonly act: "divide" | "dart" | "engulf" | "bask";
  readonly icon: string;
  readonly label: string;
  readonly can: boolean;
  /** What it would do, or why it cannot be done. */
  readonly words: string;
};

/** What the cell held can do, in its four places: divide, dart, take in, live by light. */
export function cellOffers(o: {
  readonly t: Traits;
  readonly gates: Gates;
  readonly energy: number;
  /** The cell nearest that it could take in, by name (null: none near enough). */
  readonly prey: string | null;
  readonly basking: boolean;
  readonly light: number;
  /** A mate has been called and is coming. */
  readonly mating?: boolean;
}): CellOffer[] {
  const w = worth(o.t.size),
    full = Math.max(0, Math.min(1, (o.energy - w) / w)),
    { t, gates } = o,
    // (A cell with a nucleus can mate: it calls one of its kind, and its young mix the two.)
    mate = t.nucleus && !o.mating;
  return [
    {
      act: "divide",
      icon: mate ? "💞" : "➗",
      label: mate ? "Mate" : o.mating ? "Waiting" : "Divide",
      can: full >= 1 && !o.mating,
      words: o.mating
        ? "Your mate is coming to you"
        : full >= 1
          ? mate
            ? "Call a mate of your kind: your young will mix the two of you"
            : "You have gathered enough: divide, and choose a daughter"
          : `Eat to grow: ${Math.round(full * 100)}% of the way to ${mate ? "mating" : "dividing"}`,
    },
    {
      act: "dart",
      icon: "💨",
      label: "Dart",
      can: o.energy > w * 0.05,
      words: "A burst of speed for a moment: it costs five times as much",
    },
    {
      act: "engulf",
      icon: "🫧",
      label: "Take in",
      can: t.nucleus && !!o.prey,
      words: t.nucleus
        ? o.prey
          ? `Take in the ${o.prey}`
          : "None near small enough: under half your size"
        : gates.nucleus.allowed
          ? gates.nucleus.open
            ? "Only a cell with a nucleus can take in another: choose a daughter that grew one"
            : `Only a cell with a nucleus can take in another: ${gates.nucleus.why}`
          : `Only a cell with a nucleus can take in another: ${gates.nucleus.why}`,
    },
    {
      act: "bask",
      icon: "☀️",
      label: o.basking ? "Stop" : "Bask",
      can: t.light && o.light > 0.02,
      words: t.light
        ? o.basking
          ? "Stop basking, and swim at your own speed"
          : o.light > 0.02
            ? "Hold still and live by light: brighter toward the surface"
            : "No light reaches here"
        : gates.light.allowed
          ? gates.light.open
            ? "Your line cannot live by light: choose a daughter that took in a light-eater"
            : `Your line cannot live by light: ${gates.light.why}`
          : `Your line cannot live by light: ${gates.light.why}`,
    },
  ];
}

// —— The guide: its lessons, and what to do now —————————————————————————————————————————————————————————————————

export type LessonId = "steer" | "eat" | "divide" | "choose" | "page" | "wake";

/** The guide's lessons in their order: each ticks itself off as it is done. `show` is what its Show me points at. */
export const LESSONS: readonly {
  readonly id: LessonId;
  readonly title: string;
  readonly words: string;
  readonly show: string;
}[] = [
  {
    id: "steer",
    title: "Steer your cell",
    words:
      "Put a thumb down on the left half of the screen and drag the way to go (on a keyboard: W A S D or the arrows). Your cell goes as far as you push and stops the moment you let go: at its size the water holds it like honey.",
    show: ".line-stick-hint",
  },
  {
    id: "eat",
    title: "Eat what floats",
    words:
      "The pale specks are bits of food. Swim into them to take them in: each one brings you nearer to dividing (the bar under your name).",
    show: ".line-strip",
  },
  {
    id: "divide",
    title: "Divide when you are full",
    words:
      "When the bar is full, press Divide. Your cell splits, and its daughters are each a little unlike it.",
    show: ".line-act-0",
  },
  {
    id: "choose",
    title: "Choose a daughter",
    words:
      "You live on in the daughter you choose. Each card says how it differs and what that does here: larger cells are safer but cost more, faster ones reach food sooner but spend more.",
    show: ".line-pick",
  },
  {
    id: "page",
    title: "Read your cell's page",
    words:
      "Press your cell's name at the top to read what it is: its size, how its world's liquid feels to it, its line so far. Back and Forward walk the pages.",
    show: ".line-name",
  },
  {
    id: "wake",
    title: "Wake to your world",
    words:
      "Press Wake when you are done. Your world comes back exactly as you left it: nothing played here changes it. Your line is kept, to go on with later.",
    show: ".line-wake",
  },
];

/** What the stage holds now, as the guide reads it. */
export type CellNow = {
  readonly moved: boolean;
  readonly ate: number;
  readonly energy: number;
  readonly t: Traits;
  readonly choosing: boolean;
  /** The nearest food: how far (µm) and which way across the screen (-1 left … 1 right; null: none near). */
  readonly food: { readonly d: number; readonly dx: number; readonly dy: number } | null;
  /** A hunting cell near that could take it in (µm away; null: none). */
  readonly threat: number | null;
  readonly gates: Gates;
  readonly my: number;
  readonly rungs: readonly LineRung[];
  readonly basking: boolean;
  readonly light: number;
};

const side = (dx: number, dy: number) =>
  Math.abs(dx) > Math.abs(dy)
    ? dx > 0
      ? "to your right"
      : "to your left"
    : dy > 0
      ? "below you"
      : "above you";

/** What to do next, read from the stage as it stands (it changes nothing). */
export function whatNow(n: CellNow): string {
  if (n.choosing)
    return "Choose the daughter to live on in: read what each card says it would do here, then press it.";
  if (n.threat !== null)
    return `A hunting cell over twice your size is ${Math.round(n.threat)} µm away: swim off, or press Dart to get clear.`;
  const w = worth(n.t.size);
  if (n.energy >= 2 * w) return "You are full: press Divide.";
  if (!n.moved) return "Drag on the left half of the screen to swim (or W A S D).";
  if (n.t.light && !n.basking && n.light > 0.3)
    return "You can live by light here: press Bask and hold still near the surface.";
  const g = n.gates;
  if (g.nucleus.open && !n.t.nucleus)
    return "Cells with a nucleus have arisen: when you next divide, a daughter may grow one, and take in other cells.";
  if (g.light.open && !n.t.light)
    return "Cells that live by light have arisen: when you next divide, a daughter may take one in and keep it.";
  if (g.together.open && !n.t.together && n.t.nucleus)
    return "Cells have begun to stay together: choose such a daughter, the way to a body.";
  if (n.food)
    return `Food ${side(n.food.dx, n.food.dy)}, ${Math.round(n.food.d)} µm off: swim into it. ${Math.round(
      Math.min(1, n.energy / (2 * w)) * 100,
    )}% of the way to dividing.`;
  const next = n.rungs.filter((r) => r.at < n.my).sort((a, b) => b.at - a.at)[0];
  return `No food near: swim to find more.${next ? ` Next in your world's dawn: ${next.name.toLowerCase()}, ${myWords(next.at)}.` : ""}`;
}
