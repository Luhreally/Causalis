// A world's founding stocks (B1 of the life plan, docs/architecture/asks-2026-11-12-plan.md Part B): its first
// bodies' deep plans, from which every beast of it descends, so one world's beasts look like kin and unlike
// another's. A deep plan is what a lineage's facts (its legs, fins and wings, its covering, its weight, how it
// moves, its neck and tail, what it grows: rules/creatures.ts) leave open: the shape of its body's segments, how
// its limbs attach and joint, its head and the eyes on it, its mouthparts, the kind of tail it has, and what
// else it bears that it does not walk on (feelers, graspers, a sail, a frill, a row of scutes, plumes, a fringe,
// spurs). Each is drawn under the world's own numbers, never its kind's name: a heavy pull splays limbs wide and
// thickens them, a light one stands them tall; a dim red star's light, mostly past what an Earth eye sees, makes
// eyes large and many; heat to shed favours sails and frills, cold favours round, close bodies; a liquid that
// carries a current gives fringes to feel it by, one that carries none does not.
//
// A lineage's own look is its stock's plan, perhaps one deep trait changed in its own kind's line (a deep trait
// changes far more rarely than a shallow one), and the shallow ones its own: its proportions within its facts,
// its colours from the pigments its chemistry has and the light it lives in. Every fact its words tell stays
// true in it: a four-legged furred beast is drawn four-legged and furred.
//
// Pure, and a reading: a draw `u(k)` in [0, 1) keyed by the caller on the world's digest, never the seed's
// stream; nothing here is stored or hashed, and no world's history moves (gen/stocks.ts reads it).
import { dmath } from "../kernel/index.ts";
import type { CreatureBody } from "./creatures.ts";
import { sensesOf } from "./physiology.ts";

/** The shape of a body's segments. */
export type SegShape = "box" | "taper" | "dome" | "bag" | "disc";
/** How the limbs attach: straight under the body; out to the side and down, the elbows wide; up from the side to a high knee; under, the knee bent back. */
export type LimbSet = "under" | "sprawl" | "arch" | "rake";
export type LimbShape = "box" | "tube" | "taper";
export type HeadShape = "box" | "wedge" | "dome" | "disc" | "bag" | "hammer";
/** How its eyes sit: a pair; a row along the brow; on stalks; a cluster on the crown; one band across the face. */
export type EyeSet = "pair" | "row" | "stalks" | "cluster" | "band";
export type Mouth = "jaw" | "mandibles" | "proboscis" | "tendrils" | "sucker";
export type TailKind = "taper" | "whip" | "club" | "fan" | "fork" | "chain";
/** What else it bears that it does not walk on. */
export type Extra =
  "feelers" | "graspers" | "sail" | "frill" | "scutes" | "plumes" | "fringe" | "spurs";
type Rgb = readonly [number, number, number];

/** A world's numbers as its first bodies were shaped by them. */
export type StockWorld = {
  /** Its pull (Earth's 1), its mean warmth (°C), its star's warmth (K), the starlight it gets (Earth's 1), its sea's share. */
  readonly gravity: number;
  readonly warmth: number;
  readonly star: number;
  readonly insolation: number;
  readonly ocean: number;
  /** What its life is dissolved in, its pigment, what hardens its bones and shells, what its blood carries breath on. */
  readonly liquid: string;
  readonly pigment: string;
  readonly bone: string;
  readonly shell: string;
  readonly blood: string;
};

/** A deep plan: what a stock's every descendant inherits. */
export type StockPlan = {
  readonly seg: SegShape;
  readonly limbs: LimbSet;
  readonly limbShape: LimbShape;
  /** Joints in a leg: two (a thigh and a shank) or three (a foot besides). */
  readonly joints: 2 | 3;
  readonly head: HeadShape;
  readonly eyes: EyeSet;
  readonly mouth: Mouth;
  readonly tail: TailKind;
  readonly extras: readonly Extra[];
  /** How wide its legs splay (0 … 1), how stout its limbs (1 Earth's), how large its eyes (1 Earth's): from the world. */
  readonly splay: number;
  readonly stout: number;
  readonly eyeSize: number;
  /** Its colours' turn: a hue the world's pigments pull its coat toward (0 … 1), how far, and its markings' and horn's colours. */
  readonly hue: number;
  readonly pull: number;
  readonly dark: Rgb;
  readonly horn: Rgb;
};

/** A stock: its plan, its name, and why it is as it is. */
export type Stock = StockPlan & {
  readonly id: number;
  readonly name: string;
  readonly why: readonly Why[];
};

/** A trait and why: what it is, its cause, and its figure ("its legs splay wide" — "pull 1.8 g"). */
export type Why = { readonly what: string; readonly because: string; readonly figure: string };

/** A lineage's look as the view draws it: its stock's plan (perhaps one deep trait its own), its own proportions and colours. */
export type BeastLook = StockPlan & {
  readonly stock: number;
  readonly stockName: string;
  /** How many other living beasts of its world are of its stock. */
  readonly kin: number;
  /** Its own: body length, depth and width, legs and head against what its facts alone would draw (1 each). */
  readonly long: number;
  readonly deep: number;
  readonly wide: number;
  readonly legLen: number;
  readonly headSize: number;
  /** Its eyes (0: none), whether it has feelers, its markings: from its line's genome where the tree knows them. */
  readonly eyeCount: number;
  readonly marks: "plain" | "spots" | "stripes" | "bands";
  /** Its coat's turn: lightness and strength against the colour it is named for. */
  readonly light: number;
  readonly strength: number;
  readonly why: readonly Why[];
};

/** A weighted choice: `w` the weights, `u` a draw in [0, 1). */
function pick<T extends string>(w: Readonly<Record<T, number>>, u: number): T {
  const keys = Object.keys(w) as T[];
  let all = 0;
  for (const k of keys) all += Math.max(0, w[k]);
  let at = u * all;
  for (const k of keys) {
    at -= Math.max(0, w[k]);
    if (at < 0) return k;
  }
  return keys[keys.length - 1]!;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** A pigment's hue (0 … 1), as the light it catches leaves its life coloured. */
const PIGMENT_HUE: Readonly<Record<string, number>> = {
  chlorophyll: 0.3,
  carotene: 0.09,
  phycocyanin: 0.55,
  bacteriochlorophyll: 0.8,
  polyimine: 0.11,
};
/** What a hard part is made of, and its colour: lime ivory, apatite bone-white, opal milky, iron sulfide black, ice pale blue. */
const HARD_COLOUR: Readonly<Record<string, Rgb>> = {
  calcite: [0.86, 0.82, 0.7],
  apatite: [0.9, 0.86, 0.76],
  opal: [0.78, 0.84, 0.86],
  greigite: [0.16, 0.16, 0.18],
  ice: [0.8, 0.9, 0.96],
};
/** Blood's colour, as it shows through a thin skin and at a body's points. */
const BLOOD_COLOUR: Readonly<Record<string, Rgb>> = {
  iron: [0.42, 0.08, 0.07],
  copper: [0.12, 0.22, 0.46],
  vanadium: [0.22, 0.36, 0.1],
  "iron-sulfur": [0.3, 0.18, 0.08],
};

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** What the world asks of a body, read once: each with its figure. */
function pressuresOf(w: StockWorld) {
  const senses = sensesOf({
      star: w.star,
      pressure: 1,
      liquid:
        w.liquid === "water"
          ? "water"
          : w.liquid === "ammonia"
            ? "ammonia"
            : w.liquid === "methane"
              ? "methane"
              : "oil",
    }),
    heavy = clamp((w.gravity - 0.9) / 1.2, 0, 1),
    light = clamp((1 - w.gravity) / 0.6, 0, 1),
    // (Under a dim red star most of the light is past what an Earth eye sees; a dim world's eyes grow to gather it.)
    dim = clamp((5000 - w.star) / 2200 + (0.6 - Math.min(0.6, w.insolation)) * 0.8, 0, 1),
    hot = clamp((w.warmth - 18) / 20, 0, 1),
    cold = clamp((6 - w.warmth) / 25, 0, 1);
  return { senses, heavy, light, dim, hot, cold };
}

/**
 * A stock's deep plan, drawn under a world's numbers. `u(k)` is a keyed draw for the k-th choice; `id` its place
 * among the world's stocks (for its name to be its own among them).
 */
export function stockOf(w: StockWorld, u: (k: number) => number, id: number): Stock {
  const p = pressuresOf(w),
    why: Why[] = [],
    g = w.gravity;
  const seg = pick<SegShape>(
    {
      box: 1,
      taper: 1 + 0.4 * p.light,
      dome: 0.8 + 1.2 * p.heavy + 0.6 * p.cold,
      bag: 0.6 + 1.2 * p.cold,
      disc: 0.6 + 1.0 * p.heavy,
    },
    u(1),
  );
  const limbs = pick<LimbSet>(
    {
      under: 1.2 - 0.6 * p.heavy,
      sprawl: 0.5 + 2 * p.heavy,
      arch: 0.6 + 0.6 * p.light,
      rake: 0.5 + 1.2 * p.light,
    },
    u(2),
  );
  const limbShape = pick<LimbShape>({ box: 1, tube: 1.1, taper: 0.9 + 0.6 * p.heavy }, u(3)),
    joints: 2 | 3 = u(4) < 0.35 + 0.3 * p.light ? 3 : 2,
    head = pick<HeadShape>(
      {
        box: 1,
        wedge: 1,
        dome: 0.9 + 0.5 * p.cold,
        disc: 0.6,
        bag: 0.6,
        hammer: 0.5 + 0.5 * p.dim,
      },
      u(5),
    ),
    eyes = pick<EyeSet>(
      {
        pair: 1.6 - p.dim,
        row: 0.5 + 1.0 * p.dim,
        stalks: 0.6,
        cluster: 0.4 + 1.2 * p.dim,
        band: 0.4 + 0.6 * p.dim,
      },
      u(6),
    ),
    mouth = pick<Mouth>(
      { jaw: 1.4, mandibles: 1, proboscis: 0.6, tendrils: 0.7, sucker: 0.4 },
      u(7),
    ),
    tail = pick<TailKind>(
      { taper: 1.2, whip: 0.9, club: 0.6 + 0.6 * p.heavy, fan: 0.6, fork: 0.5, chain: 0.6 },
      u(8),
    );
  // What else it bears: one or two, three now and then, each weighed by what the world asks.
  const weights: Record<Extra, number> = {
      feelers: 0.8 + 1.2 * p.dim,
      graspers: 0.7,
      sail: 0.5 + 2.2 * p.hot,
      frill: 0.5 + 1.6 * p.hot,
      scutes: 0.5 + 0.8 * p.heavy,
      plumes: 0.5 + 0.6 * p.cold,
      // (A fringe to feel a current by, only in a liquid that carries one.)
      fringe: p.senses.electric ? 0.8 : 0,
      spurs: 0.5,
    },
    extras: Extra[] = [],
    many = u(9) < 0.25 ? 3 : u(9) < 0.75 ? 2 : 1;
  for (let k = 0; k < many; k++) {
    const left = { ...weights };
    for (const e of extras) left[e] = 0;
    extras.push(pick<Extra>(left, u(10 + k)));
  }
  const splay = clamp(0.25 + 0.6 * p.heavy + 0.3 * (limbs === "sprawl" ? 1 : 0), 0, 1),
    stout = clamp(dmath.pow(Math.max(0.3, g), 0.6), 0.7, 1.7),
    eyeSize = clamp(1 + 1.1 * p.dim - 0.3 * clamp((w.star - 6200) / 2000, 0, 1), 0.7, 2.2);
  // Its colours: its coat pulled toward the hue its world's pigments leave life, its markings of its blood's colour
  // or its pigment's, its horn and plates of what hardens them.
  const hue = PIGMENT_HUE[w.pigment] ?? 0.3,
    pull = 0.25 + 0.35 * u(14),
    blood = BLOOD_COLOUR[w.blood] ?? BLOOD_COLOUR.iron!,
    dark =
      u(15) < 0.5
        ? mixRgb(blood, [0.05, 0.05, 0.06], 0.3)
        : hueRgb(hue + 0.5 + 0.2 * (u(16) - 0.5), 0.5, 0.26),
    horn = HARD_COLOUR[w.shell] ?? HARD_COLOUR[w.bone] ?? HARD_COLOUR.calcite!;
  // Why, in the world's own figures.
  if (limbs === "sprawl" || splay > 0.55)
    why.push({
      what: "its legs splay wide",
      because: "to spread its weight under its world's pull",
      figure: `pull ${g.toFixed(1)} g`,
    });
  else if (limbs === "rake" || limbs === "arch")
    why.push({
      what: limbs === "rake" ? "its knees bend back" : "its knees stand high",
      because:
        g < 1 ? "a light pull lets long limbs carry it" : "its line's first walkers stood so",
      figure: `pull ${g.toFixed(1)} g`,
    });
  if (stout > 1.15)
    why.push({
      what: "its limbs are stout",
      because: "bone thickens as the pull grows",
      figure: `pull ${g.toFixed(1)} g`,
    });
  if (eyeSize > 1.3 || eyes === "cluster" || eyes === "row" || eyes === "band")
    why.push({
      what:
        eyes === "cluster"
          ? "its eyes are many, clustered on its crown"
          : eyes === "row"
            ? "its eyes run in a row along its brow"
            : eyes === "band"
              ? "its eye is one band across its face"
              : "its eyes are large",
      because: "to gather what light there is",
      figure: `its star's light peaks at ${Math.round(p.senses.peakNm)} nm (${p.senses.band})`,
    });
  if (extras.includes("sail") || extras.includes("frill"))
    why.push({
      what: extras.includes("sail")
        ? "a sail stands down its back"
        : "a frill stands behind its head",
      because:
        p.hot > 0.2 ? "to shed its heat" : "for show among its kind, as its first bodies bore it",
      figure: `its world's mean warmth ${Math.round(w.warmth)} °C`,
    });
  if (extras.includes("fringe"))
    why.push({
      what: "a fringe runs along its sides",
      because: "to feel the current of living things",
      figure: `its life's ${w.liquid} carries a current`,
    });
  if (extras.includes("feelers") && p.dim > 0.2)
    why.push({
      what: "it bears long feelers",
      because: "to feel its way where light is poor",
      figure: `${w.insolation.toFixed(2)} of Earth's light`,
    });
  if (seg === "bag" || seg === "dome")
    why.push({
      what: seg === "bag" ? "its body is round" : "its body is domed",
      because: p.cold > 0.2 ? "a round body keeps its warmth" : "its line's first bodies were so",
      figure: `its world's mean warmth ${Math.round(w.warmth)} °C`,
    });
  const plan: StockPlan = {
    seg,
    limbs,
    limbShape,
    joints,
    head,
    eyes,
    mouth,
    tail,
    extras,
    splay,
    stout,
    eyeSize,
    hue,
    pull,
    dark,
    horn,
  };
  return { ...plan, id, name: stockName(plan, id), why };
}

const EXTRA_WORDS: Readonly<Record<Extra, string>> = {
  feelers: "feelered",
  graspers: "grasping",
  sail: "sail-backed",
  frill: "frilled",
  scutes: "scute-backed",
  plumes: "plumed",
  fringe: "fringed",
  spurs: "spurred",
};
const SEG_WORDS: Readonly<Record<SegShape, string>> = {
  box: "square-bodied",
  taper: "tapering",
  dome: "dome-bodied",
  bag: "round-bodied",
  disc: "flat-bodied",
};
const LIMB_WORDS: Readonly<Record<LimbSet, string>> = {
  under: "straight-legged",
  sprawl: "sprawling",
  arch: "high-kneed",
  rake: "back-kneed",
};
const EYE_WORDS: Readonly<Record<EyeSet, string>> = {
  pair: "",
  row: "row-eyed",
  stalks: "stalk-eyed",
  cluster: "many-eyed",
  band: "band-eyed",
};

/** A stock's name from its deepest marks: "the sail-backed, sprawling stock". */
export function stockName(p: StockPlan, id: number): string {
  const first = EXTRA_WORDS[p.extras[0]!] ?? EYE_WORDS[p.eyes] ?? "",
    second =
      id % 3 === 0
        ? SEG_WORDS[p.seg]
        : id % 3 === 1
          ? LIMB_WORDS[p.limbs]
          : EYE_WORDS[p.eyes] || SEG_WORDS[p.seg];
  return `the ${[first, second].filter((x) => x).join(", ")} stock`;
}

/** A colour of a hue (0 … 1), saturation and lightness. */
export function hueRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s,
    hh = (((h % 1) + 1) % 1) * 6,
    x = c * (1 - Math.abs((hh % 2) - 1)),
    m = l - c / 2,
    [r, g, b] =
      hh < 1
        ? [c, x, 0]
        : hh < 2
          ? [x, c, 0]
          : hh < 3
            ? [0, c, x]
            : hh < 4
              ? [0, x, c]
              : hh < 5
                ? [x, 0, c]
                : [c, 0, x];
  return [r + m, g + m, b + m];
}

/**
 * A stock's plan as a kind of body of it has it: one deep trait perhaps changed in its kind's own line (`u` keyed
 * on its kind), as deep traits change, rarely.
 */
export function kindPlan(s: Stock, u: (k: number) => number): Stock {
  if (u(0) >= 0.3) return s;
  const which = Math.floor(u(1) * 4);
  if (which === 0)
    return {
      ...s,
      tail: pick<TailKind>({ taper: 1, whip: 1, club: 1, fan: 1, fork: 1, chain: 1 }, u(2)),
    };
  if (which === 1)
    return { ...s, eyes: pick<EyeSet>({ pair: 1, row: 1, stalks: 1, cluster: 1, band: 1 }, u(2)) };
  if (which === 2)
    return {
      ...s,
      mouth: pick<Mouth>({ jaw: 1, mandibles: 1, proboscis: 1, tendrils: 1, sucker: 1 }, u(2)),
    };
  return { ...s, joints: s.joints === 2 ? 3 : 2 };
}

/** What a lineage's genome tells of its look, where the tree of life knows it. */
export type LineFacts = {
  readonly eyes: number;
  readonly feelers: boolean;
  readonly pattern: string;
} | null;

/**
 * A lineage's look: its kind's plan (`plan`), the extras its body can bear (a sail on a back, a fringe on a
 * swimmer's sides, graspers on what walks), its own proportions within its facts and its colours. `u(k)` keyed on
 * the lineage; `kin` how many others of its world share its stock; `line` its genome's eyes, feelers and markings.
 */
export function lookOf(
  plan: Stock,
  body: CreatureBody,
  u: (k: number) => number,
  kin: number,
  line: LineFacts,
): BeastLook {
  const flies = body.moves === "fly",
    swims = body.moves === "swim",
    legged = body.legs > 0 && !flies;
  const extras = plan.extras.filter((e) =>
    e === "graspers"
      ? legged && body.legs <= 6
      : e === "spurs"
        ? legged
        : e === "fringe"
          ? !flies
          : e === "sail"
            ? !flies && body.covering !== "wool"
            : true,
  );
  if (line?.feelers && !extras.includes("feelers")) extras.push("feelers");
  const eyeCount = line
      ? line.eyes
      : plan.eyes === "pair" || plan.eyes === "stalks"
        ? 2
        : plan.eyes === "band"
          ? 1
          : plan.eyes === "row"
            ? 4
            : 6,
    marks: BeastLook["marks"] =
      line?.pattern === "spots"
        ? "spots"
        : line?.pattern === "stripes"
          ? "stripes"
          : u(1) < 0.25
            ? "bands"
            : "plain";
  // Its own proportions: a little longer or shorter, deeper or shallower, within what its facts draw.
  const long = 0.85 + 0.35 * u(2),
    deep = (plan.seg === "disc" ? 0.7 : plan.seg === "bag" ? 1.2 : 1) * (0.85 + 0.3 * u(3)),
    wide = (plan.seg === "disc" ? 1.35 : 1) * (0.85 + 0.3 * u(4)),
    legLen = (swims ? 1 : 1 / Math.sqrt(plan.stout)) * (0.85 + 0.35 * u(5)),
    headSize = 0.85 + 0.35 * u(6);
  const why: Why[] = [...plan.why];
  return {
    ...plan,
    extras,
    stock: plan.id,
    stockName: plan.name,
    kin,
    long,
    deep,
    wide,
    legLen,
    headSize,
    eyeCount,
    marks,
    light: 0.85 + 0.3 * u(7),
    strength: 0.8 + 0.5 * u(8),
    why,
  };
}
