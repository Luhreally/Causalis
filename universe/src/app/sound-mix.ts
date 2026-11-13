// What is heard, as numbers (Sound, first slice; Classic's section 35): a place and what is about it
// go in, the level of every layer of the ambience and how often each small sound comes out. Pure, and
// knows nothing of WebAudio or of the world: whoever knows the place tells it (app/main.ts, four times
// a second), and app/sound.ts plays what this says. Nothing here is read back by anything. Arms and blasts
// (asked 2026-11-12) are cues made from their own physics' numbers (view/heard.ts), heard from where they are.
import type { HeardKind, Voicing } from "../view/index.ts";

/** Where a person is, as they would say it with their eyes shut. */
export type Place =
  "title" | "town" | "land" | "shore" | "halls" | "globe" | "stars" | "galaxy" | "battle";

/** What is about them, as they see it now. */
export type Air = {
  place: Place;
  /** How far into the night: 0 by day, 0.5 at dawn and dusk, 1 at night. */
  night: number;
  /** How hard it rains (0 … 1). */
  rain: number;
  market: boolean;
  feast: boolean;
  /** A war in the streets, or before the walls. */
  war: boolean;
  /** Under water: all of it through the water. */
  under: boolean;
  /** Whether anything lives here to sing. */
  alive: boolean;
  /** How thin the air is: 0 a world's full air, 1 next to none. */
  thin: number;
  /** How hard this world's wind blows (0 … 1). */
  wind: number;
  /** What the greatest fire leaves: 0 nothing, 1 all gone quiet. */
  hush: number;
  /** The viewer has paused the world: nothing new happens, and the air drops back. */
  held: boolean;
  /** How much of a fight is hand to hand (0 … 1): a battle's or a town war's clash of iron is as much as there is of it. */
  melee: number;
  /** What its blades ring at (Hz), where told by their metal (0: not told). */
  ring: number;
  /** Machines' engines overhead, as loud as they are near and many (0 … 1), and whether they are jets. */
  engines: number;
  jet: boolean;
};

/** A place with nothing about it. */
export function airOf(place: Place): Air {
  return {
    place,
    night: 0,
    rain: 0,
    market: false,
    feast: false,
    war: false,
    under: false,
    alive: true,
    thin: 0,
    wind: 0,
    hush: 0,
    held: false,
    melee: 1,
    ring: 0,
    engines: 0,
    jet: false,
  };
}

/** The layers' levels and filters, and the small sounds' rates (how many a second, on the average). */
export type Mix = {
  level: number;
  wind: number;
  windHz: number;
  high: number;
  surf: number;
  rain: number;
  crowd: number;
  crowdHz: number;
  crowdRate: number;
  crickets: number;
  pad: number;
  padRoot: number;
  /** The two upper notes of the drone, against its root. */
  padUp: number;
  padUp2: number;
  padHz: number;
  shimmer: number;
  shimmerHz: number;
  rumble: number;
  rumbleHz: number;
  /** The lowpass over everything but what is made in the water: wide open but under water. */
  waterHz: number;
  birds: number;
  gulls: number;
  owls: number;
  tinks: number;
  hawkers: number;
  bells: number;
  drums: number;
  clashes: number;
  shots: number;
  bubbles: number;
  moans: number;
  plucks: number;
  /** A feast's hand drums and its dancers' clapping. */
  dance: number;
  /** What the clashes ring at (Hz; 0: each its own). */
  ringHz: number;
  /** Engines overhead: how loud, and their edge (Hz); a jet's roar (1), not a propeller's beat (0). */
  engines: number;
  enginesHz: number;
  jet: number;
};

const OPEN = 16000;

const BASE: Mix = {
  level: 1,
  wind: 0,
  windHz: 500,
  high: 0,
  surf: 0,
  rain: 0,
  crowd: 0,
  crowdHz: 900,
  crowdRate: 1,
  crickets: 0,
  pad: 0,
  padRoot: 55,
  padUp: 1.5,
  padUp2: 2,
  padHz: 400,
  shimmer: 0,
  shimmerHz: 1760,
  rumble: 0,
  rumbleHz: 40,
  waterHz: OPEN,
  birds: 0,
  gulls: 0,
  owls: 0,
  tinks: 0,
  hawkers: 0,
  bells: 0,
  drums: 0,
  clashes: 0,
  shots: 0,
  bubbles: 0,
  moans: 0,
  plucks: 0,
  dance: 0,
  ringHz: 0,
  engines: 0,
  enginesHz: 760,
  jet: 0,
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** What a place and what is about it sound like. The same air gives the same mix. */
export function mixOf(a: Air): Mix {
  const m: Mix = { ...BASE },
    night = clamp01(a.night),
    day = 1 - night;
  // (Levels set by ear's stand-in, the gate's numbers: each place near -24 dBFS, and each with enough
  // of itself over 320 Hz for a phone's speaker, which gives nothing much under that.)
  switch (a.place) {
    case "title":
      m.pad = 0.085;
      m.padRoot = 130.81;
      m.padUp = 1.5;
      m.padUp2 = 2;
      m.padHz = 1500;
      m.shimmer = 0.02;
      m.shimmerHz = 1975;
      m.plucks = 0.5;
      break;
    case "town":
      m.crowd = 0.62 * day + 0.05 * night;
      m.crowdHz = 900;
      m.wind = 0.06 + 0.06 * night;
      m.windHz = 800;
      m.high = 0.012 + 0.012 * night;
      m.tinks = 0.45 * day;
      m.birds = 0.32 * day;
      m.crickets = 0.2 * night;
      m.owls = 0.06 * night;
      if (a.market && day > 0.3) {
        m.crowd = 1;
        m.crowdHz = 1800;
        m.crowdRate = 1.22;
        m.hawkers = 1.1;
        m.bells = 0.05;
        m.tinks = 0.15;
      }
      if (a.feast) {
        m.crowd = Math.max(m.crowd, 0.8);
        m.crowdHz = 1250;
        m.crowdRate = 1.1;
        m.dance = 1;
      }
      if (a.war) {
        m.crowd = 0.75;
        m.crowdHz = 520;
        m.crowdRate = 0.72;
        m.rumble = 0.05;
        m.rumbleHz = 46;
        m.drums = 0.8;
        m.bells = 0.42;
        // (Iron on iron as much as there is fighting by the hand; each shot is its own, heard where it is fired.)
        m.clashes = 0.5 * clamp01(a.melee);
        m.birds = m.tinks = m.hawkers = m.dance = m.crickets = m.owls = 0;
      }
      break;
    case "land":
      m.wind = 0.72;
      m.windHz = 1100;
      m.high = 0.03;
      m.birds = 0.5 * day;
      m.crickets = 0.55 * night;
      m.owls = 0.08 * night;
      break;
    case "shore":
      m.surf = 0.9;
      m.wind = 0.08;
      m.windHz = 1000;
      m.high = 0.02;
      m.gulls = 0.2 * day;
      m.birds = 0.05 * day;
      m.crickets = 0.05 * night;
      break;
    case "halls":
      m.pad = 0.03;
      m.padRoot = 120;
      m.padUp = 2;
      m.padUp2 = 3;
      m.padHz = 700;
      m.rumble = 0.03;
      m.rumbleHz = 60;
      m.high = 0.012;
      m.tinks = 0.12;
      break;
    case "globe":
      m.high = 0.13;
      m.wind = 0.03;
      m.windHz = 420;
      m.pad = 0.009;
      m.padRoot = 98;
      m.padUp = 1.498;
      m.padUp2 = 2.003;
      m.padHz = 500;
      m.rumble = 0.012;
      m.rumbleHz = 36;
      break;
    case "stars":
      m.pad = 0.085;
      m.padRoot = 55;
      m.padUp = 2.67;
      m.padUp2 = 4.02;
      m.padHz = 720;
      m.shimmer = 0.035;
      m.shimmerHz = 2093;
      break;
    case "galaxy":
      m.pad = 0.07;
      m.padRoot = 36.71;
      m.padUp = 3.56;
      m.padUp2 = 5.34;
      m.padHz = 1000;
      m.shimmer = 0.1;
      m.shimmerHz = 3136;
      m.rumble = 0.012;
      m.rumbleHz = 30;
      break;
    case "battle":
      m.crowd = 0.95;
      m.crowdHz = 1250;
      m.crowdRate = 1.3;
      m.rumble = 0.03;
      m.rumbleHz = 52;
      m.wind = 0.04;
      m.drums = 1.5;
      // (The clash of iron where the lines have met, by how many of them are at it; their shots are their own cues.)
      m.clashes = 4 * clamp01(3 * a.melee);
      break;
  }
  m.ringHz = a.ring > 0 ? a.ring : 0;
  // Machines' engines overhead, where there is air to carry them.
  const engines = clamp01(a.engines);
  if (engines > 0 && a.place !== "stars" && a.place !== "galaxy") {
    m.engines = 0.16 * engines;
    m.jet = a.jet ? 1 : 0;
    m.enginesHz = a.jet ? 2400 : 760;
  }
  // The world's own air and wind, where there is air to hear them in.
  const open = a.place === "land" || a.place === "shore" || a.place === "town",
    thin = clamp01(a.thin);
  if (open) {
    const hard = clamp01(a.wind);
    m.wind *= 1 + 1.6 * hard;
    m.windHz *= 1 + 0.7 * hard;
    m.high += 0.06 * hard;
    // (Thin air carries little: all of it fainter, and the highs first.)
    const carries = 1 - 0.5 * thin;
    m.wind *= carries;
    m.windHz *= 1 - 0.55 * thin;
    m.high *= carries;
    m.surf *= carries;
    m.crowd *= carries;
    m.crickets *= carries * carries;
    m.birds *= carries * carries;
  }
  if (a.place === "globe") m.high *= 1 - 0.7 * thin;
  // Rain, on the ground: it covers what is under it, and the birds go in.
  const rain = open ? clamp01(a.rain) : 0;
  if (rain > 0) {
    m.rain = 0.06 + 0.58 * rain;
    m.crowd *= 1 - 0.7 * rain;
    m.tinks *= 1 - 0.8 * rain;
    m.hawkers *= 1 - 0.8 * rain;
    m.crickets *= 1 - 0.9 * rain;
    m.wind *= 1 + 0.5 * rain;
    const dry = (1 - rain) * (1 - rain);
    m.birds *= dry;
    m.gulls *= dry;
    m.owls *= dry;
    m.dance *= dry;
  }
  // Under water: the air's own sounds gone, the rest through the water, and what is made in it.
  if (a.under && (a.place === "town" || a.place === "land" || a.place === "shore")) {
    m.waterHz = 640;
    m.wind = m.high = m.rain = m.crickets = 0;
    m.birds = m.gulls = m.owls = m.hawkers = 0;
    m.crowd *= 1.2;
    m.tinks *= 0.5;
    m.surf = 0.6;
    m.rumble = Math.max(m.rumble, 0.03);
    m.rumbleHz = 33;
    m.bubbles = 1.3;
    m.moans = a.alive ? 0.09 : 0;
  }
  // Where nothing lives, nothing sings.
  if (!a.alive) {
    m.birds = m.gulls = m.owls = m.crickets = m.moans = 0;
  }
  // What the greatest fire leaves: everything gone but the wind, and that low.
  const hush = clamp01(a.hush);
  if (hush > 0) {
    const left = 1 - hush;
    m.level *= 1 - 0.55 * hush;
    m.crowd *= left * left;
    m.birds *= left * left * left;
    m.gulls *= left * left * left;
    m.owls *= left;
    m.crickets *= left * left;
    m.tinks *= left * left;
    m.hawkers *= left * left;
    m.dance *= left * left;
    m.drums *= left;
    m.bells *= left;
    m.clashes *= left;
    m.shots *= left;
    // (A little wind stays: all but silent, and never as if the sound had broken.)
    m.wind = Math.max(m.wind, 0.2 * hush);
    m.windHz *= 1 - 0.35 * hush;
  }
  // Paused: the air stays, a little back, and nothing happens in it.
  if (a.held) {
    m.level *= 0.62;
    m.birds = m.gulls = m.owls = m.tinks = m.hawkers = m.bells = 0;
    m.drums = m.clashes = m.shots = m.bubbles = m.moans = m.dance = 0;
    m.engines = 0;
  }
  if (a.under) m.engines *= 0.3;
  return m;
}

/**
 * A world's air, as what moves its sound: how thin (from its pressure, in bars) and how hard its wind
 * (thick air and a weak pull move most; a game's reading, the world's own climate has no wind to ask).
 */
export function airOfWorld(pressure: number, gravity: number): { thin: number; wind: number } {
  const p = Math.max(0, pressure),
    thin = p >= 0.8 ? 0 : clamp01(1 - p / 0.8),
    wind = clamp01(0.45 * Math.log2(Math.max(1, p)) + 0.6 * Math.max(0, 1 - gravity));
  return { thin, wind };
}

/**
 * How long a short sound must wait after the last of its own kind (ms), and how many it may have
 * sounding at once: the guard that fifty ships firing read as a fight and not a wall.
 */
export const CUE_RULES = {
  press: { wait: 40, most: 2, level: 0.2 },
  page: { wait: 120, most: 1, level: 0.2 },
  event: { wait: 1500, most: 1, level: 0.5 },
  first: { wait: 1500, most: 1, level: 0.42 },
  beam: { wait: 85, most: 4, level: 0.16 },
  missile: { wait: 170, most: 3, level: 0.17 },
  break: { wait: 240, most: 3, level: 0.5 },
  jump: { wait: 1500, most: 1, level: 0.42 },
  out: { wait: 1500, most: 1, level: 0.42 },
  landing: { wait: 2500, most: 1, level: 0.42 },
  thunder: { wait: 2500, most: 1, level: 0.4 },
  fire: { wait: 8000, most: 1, level: 1 },
  // Arms and blasts (asked 2026-11-12), each by its own physics (view/heard.ts): at the level a near one is heard at.
  gun: { wait: 45, most: 4, level: 0.3 },
  cannon: { wait: 260, most: 2, level: 0.36 },
  bow: { wait: 55, most: 3, level: 0.3 },
  dart: { wait: 55, most: 3, level: 0.26 },
  clash: { wait: 70, most: 3, level: 0.26 },
  thud: { wait: 70, most: 3, level: 0.3 },
  zap: { wait: 60, most: 3, level: 0.18 },
  rocket: { wait: 300, most: 2, level: 0.3 },
  whistle: { wait: 220, most: 2, level: 0.2 },
  blast: { wait: 160, most: 3, level: 0.4 },
  /** Fire too thick to hear shot by shot: the crackle of a whole line's (or a whole flight's) at once. */
  volley: { wait: 180, most: 2, level: 0.3 },
} as const;
export type Cue = keyof typeof CUE_RULES;
/** The cues, each once (the gate and the listening files walk them). */
export const CUES = Object.keys(CUE_RULES) as Cue[];

/** Whether a cue may sound now: long enough after the last of its kind, and few enough of them. */
export function cueAllowed(cue: Cue, sinceLast: number, sounding: number): boolean {
  const rule = CUE_RULES[cue];
  return sinceLast >= rule.wait && sounding < rule.most;
}

/** How long a cue is heard (s). */
export const CUE_LASTS: Record<Cue, number> = {
  press: 0.06,
  page: 0.2,
  event: 2.7,
  first: 1.6,
  beam: 0.15,
  missile: 0.75,
  break: 1.55,
  jump: 2.5,
  out: 1.25,
  landing: 3.9,
  thunder: 3.6,
  fire: 16,
  gun: 0.75,
  cannon: 3.2,
  bow: 0.5,
  dart: 0.3,
  clash: 1.1,
  thud: 0.45,
  zap: 0.2,
  rocket: 2.3,
  whistle: 1.9,
  blast: 3.3,
  volley: 1.3,
};

/** The cues of arms and blasts: what the effects switch silences, the air and the world's news left as they are. */
export const ARMS_CUES: readonly Cue[] = [
  "beam",
  "missile",
  "break",
  "fire",
  "gun",
  "cannon",
  "bow",
  "dart",
  "clash",
  "thud",
  "zap",
  "rocket",
  "whistle",
  "blast",
  "volley",
];

/** What a cue is made from when nothing says (the gate's renders, and a cue given no numbers): the commonest of its kind. */
export const VOICED: Partial<Record<Cue, Voicing & { n?: number }>> = {
  // (A musket's ball: 31 g at 400 m/s, 17.5 mm, black powder: rules/means.ts ballOf.)
  gun: { joules: 2480, speed: 400, bore: 17.5, black: true },
  cannon: { joules: 261000, speed: 440, bore: 93, black: true },
  bow: { speed: 45, joules: 40 },
  dart: { speed: 60, joules: 30 },
  // (Steel struck: view/heard.ts ringOf.)
  clash: { ring: 3170, decay: 0.25 },
  thud: { ring: 4400, decay: 0.03 },
  zap: { hz: 1800 },
  rocket: { coming: 2, speed: 700 },
  whistle: { coming: 1.7 },
  blast: { mj: 210 },
  volley: { joules: 2480, speed: 400, black: true, n: 40 },
};

/** The cue each kind of arm's sound is played by. */
export const KIND_CUE: Readonly<Record<HeardKind, Cue>> = {
  gun: "gun",
  cannon: "cannon",
  bow: "bow",
  dart: "dart",
  clash: "clash",
  thud: "thud",
  zap: "zap",
  rocket: "rocket",
  whistle: "whistle",
  blast: "blast",
};

/** The cube root, the way a blast scales (Hopkinson 1915): its loudness grows slowly, its body deepens and lengthens. */
const cbrt = (x: number) => Math.cbrt(Math.max(1e-9, x));
/** How much bigger than a musket's a firing is: its time and its depth go with the cube root of its energy. */
export const gunScale = (joules: number): number => cbrt(joules / 2480);
/** How much bigger than a dropped load's a blast is (210 MJ: rules/reach.ts DROP_KG of gun cotton). */
export const blastScale = (mj: number): number => cbrt(mj / 210);

/** How long a cue sounds, given its numbers (s): what is waited on for it to be over. */
export function cueLength(cue: Cue, v?: Voicing): number {
  const n: Voicing = { ...VOICED[cue], ...v };
  switch (cue) {
    case "gun": {
      const s = gunScale(n.joules ?? 2480),
        rounds = Math.max(1, n.rounds ?? 1);
      return 0.42 + 0.3 * Math.pow(s, 0.9) + (rounds - 1) * (n.apart ?? 0.09);
    }
    case "cannon":
      return 0.15 + 1.4 * Math.sqrt(gunScale(n.joules ?? 261000));
    case "clash":
      return Math.min(2, 0.05 + 4 * (n.decay ?? 0.25));
    case "thud":
      return n.mail ? 0.4 : Math.min(1, 0.22 + 4 * (n.decay ?? 0.03));
    case "rocket":
      return Math.min(6, (n.coming ?? 2) + 0.3);
    case "whistle":
      return Math.min(6, (n.coming ?? 1.7) + 0.2);
    case "blast":
      return Math.min(9, 0.3 + 2.9 * Math.pow(blastScale(n.mj ?? 210), 0.6));
    default:
      return CUE_LASTS[cue];
  }
}

/**
 * How a sound comes across the ground to the ear: fainter (half as loud at 80 m, a quarter at 200), and duller, the air taking
 * its highs first (8 kHz left at 90 m, some 1.3 kHz at a kilometre). Near, as loud as it is.
 */
export function farOf(metres: number): { level: number; hz: number } {
  const m = Math.max(0, metres);
  return { level: 1 / (1 + Math.max(0, m - 20) / 60), hz: 16000 / (1 + m / 90) };
}

/** A line's fire, too thick to hear shot by shot: as loud as so many at once would be, but never a wall. */
export function massOf(n: number): number {
  return Math.min(1.2, 0.3 * Math.sqrt(Math.max(1, n)));
}

/** The most nodes of the graph at any moment: its standing layers (and the far ways a cue comes by) and what plays over them. */
export const NODE_BOUND = 180;
