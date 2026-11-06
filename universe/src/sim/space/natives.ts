// Peoples who really arose (Phase 69, first slice; asked for 2026-11-03: "i wanna see the star wars and
// landing in planets and colonization and all that stuff"; and, for what comes after: "wars of like the
// people going to other planets and fighting the primitive aliens there with machines"). A world whose
// bodies came ashore may have a people of its own, whether or not history follows them. How far they
// have come is read, purely, off that world: how long its bodies have had, how fast its pull, its warmth
// and their own bodies let them climb, what its matter lets them make (rules/means.ts, F1's reading), and
// a draw keyed to the world. So when another people come, they may find camps, villages, towns or cities,
// or only what is left of them. Nothing here enters history: no store, no stream, no event; a people of
// the cluster's followed few (gen/civilizations.ts) is read off the years history already holds of it.
// The figures for how long a people takes, and for when they fall, are estimates, and pages say so.
import { Rng, dmath, hashString, makeRef, type Ref, type World } from "../../kernel/index.ts";
import {
  CIVILIZATION,
  civName,
  foreignPlanets,
  handDraw,
  lifeElsewhere,
  type Civilization,
  type ForeignPlanet,
  type GalaxyStar,
  type LifeLevel,
  type Sketched,
} from "../../gen/index.ts";
import {
  CLADES,
  GRIP,
  affordancesOf,
  bodyOf,
  chemistryOf,
  eats,
  hottest,
  keenestIn,
  lifeChemistryOf,
  meansOf,
  meansWorldOf,
  stonesFor,
  worldRocks,
  type BodyPlan,
  type Chemistry,
  type LifeChemistry,
  type Means,
  type Stone,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { civilizationsNear } from "./contact.ts";
import { holdWorld, peoplesOf } from "./peoples.ts";
import { lanesOf, lawlessSeed } from "./lanes.ts";
import { starSitesOf } from "./stars.ts";
import { clusterOf } from "./voyages.ts";

/** How far a people has come: its steps, then gone. */
export type FolkStage =
  "camps" | "villages" | "towns" | "cities" | "works" | "signals" | "orbit" | "stars" | "ruins";
const LADDER: readonly FolkStage[] = ["camps", "villages", "towns", "cities", "works"];
/** The years of climbing, at home's pace, each step of the ladder comes at (est.; signals: HOME_PACE's 860). */
const CLIMB: Readonly<Record<string, number>> = {
  camps: 0,
  villages: 130,
  towns: 300,
  cities: 500,
  works: 720,
};

export const STAGE_WORDS: Readonly<Record<FolkStage, string>> = {
  camps: "in camps",
  villages: "in villages",
  towns: "in towns",
  cities: "in cities",
  works: "at their first machines",
  signals: "speaking across the dark",
  orbit: "in orbit",
  stars: "among the stars",
  ruins: "gone, leaving ruins",
};

/** A people of a world: risen there, as far as its numbers let them. */
export type Folk = {
  /** Its ref, as a followed people's would be; and whether history follows it. */
  readonly ref: Ref;
  readonly star: Ref;
  readonly planet: number;
  readonly followed: Civilization | null;
  readonly name: string;
  readonly body: BodyPlan;
  /** Its world's numbers. */
  readonly gravity: number;
  readonly warmth: number;
  readonly pressure: number;
  readonly air: string;
  /** Whether free oxygen lies in its air: its light-eaters made it (none came, none lies). */
  readonly oxygen: boolean;
  readonly chem: Chemistry;
  readonly means: Means;
  /** The hardest edge its ground gives a hand: what a spear of theirs is tipped with. */
  readonly stone: Stone;
  readonly life: LifeChemistry;
  readonly level: LifeLevel;
  /** A line of its life that walked, as near their forebears as is known of a far world. */
  readonly forebear: Sketched | null;
  /** All its bodies, sketched (what is about their camp). */
  readonly beasts: readonly Sketched[];
  /** Thousands of millions of years since its bodies began, and since a mind could have risen among them. */
  readonly bodiesAgo: number;
  readonly mindsAgo: number;
  /** The year their climb out of camps begins (our chronicle), and how slow it goes (1: home's pace). */
  readonly arose: number;
  readonly pace: number;
  /** The furthest its numbers let them come, and what shuts the next step (null: nothing does). */
  readonly ceiling: FolkStage;
  readonly shut: string | null;
  /** The year they fell, and why, as far as what is left tells (null: they stand). */
  readonly fell: number | null;
  readonly fellWhy: string | null;
};

const round = (x: number) => Math.round(x);
const DARK: readonly FolkStage[] = ["signals", "orbit", "stars"];

function drawOf(world: World, s: GalaxyStar, index: number): (n: number) => number {
  const key = `${lawlessSeed(world.seed.text)} natives ${s.sector}:${s.k}/${index}`;
  return (n) => (hashString(`${key} ${n}`) >>> 0) / 4294967296;
}

/** The world's chemistry, drawn as a home world's is, from its star, its orbit in the star's zone, its ground. */
function chemistryHere(s: GalaxyStar, p: ForeignPlanet, u: (n: number) => number): Chemistry {
  const inner = Math.sqrt(s.luminosity / 1.1),
    outer = Math.sqrt(s.luminosity / 0.53),
    zone = Math.min(1, Math.max(0, (p.a - inner) / Math.max(1e-6, outer - inner)));
  return chemistryOf({
    temperature: s.temperature,
    ageGyr: s.ageGyr,
    zone,
    u: [u(11) * 2 - 1, u(12) * 2 - 1, u(13) * 2 - 1],
  });
}

/** Which body rose: of those that can live out of the water, the world's numbers weighing each. */
function bodyHere(
  p: ForeignPlanet,
  u: (n: number) => number,
  followed: Civilization | null,
): BodyPlan {
  const c = { warmth: p.temperature, rain: 1000, gravity: p.gravity, ocean: 0.55 },
    clades = followed
      ? CLADES.filter((x) => x.id === followed.clade)
      : CLADES.filter((x) => x.body.medium !== "water"),
    weights = clades.map((x) => 0.05 + Math.max(0, x.fit(c)));
  let pick = u(1) * weights.reduce((a, b) => a + b, 0),
    at = 0;
  for (; at < clades.length - 1; at++) {
    pick -= weights[at]!;
    if (pick < 0) break;
  }
  return bodyOf(clades[at]!, c, [u(2), u(3), u(4), u(5)]);
}

/** The furthest a people can come here, and what shuts the next step, by its numbers alone. */
function ceilingOf(
  p: ForeignPlanet,
  body: BodyPlan,
  m: Means,
  bodiesAgo: number,
  u: (n: number) => number,
): { readonly ceiling: FolkStage; readonly shut: string | null } {
  const a = affordancesOf(body);
  if (!a.fire)
    return {
      ceiling: "camps",
      shut: "Their limbs cannot strike and tend a fire, so nothing is ever fired, smelted or worked hot.",
    };
  if (p.temperature < 3)
    return {
      ceiling: "camps",
      shut: `At ${round(p.temperature)} °C no growing season is long enough to sow: they live by what can be hunted and gathered.`,
    };
  if (p.temperature > 42)
    return {
      ceiling: "camps",
      shut: `At ${round(p.temperature)} °C nothing they could sow stands through the hot months: they live by what can be hunted and gathered.`,
    };
  if (body.social < 0.3)
    return {
      ceiling: "camps",
      shut: "They live too far apart ever to gather: a body like theirs keeps to itself.",
    };
  // (Whether anything there can be sown or led is a matter of what its life happened to grow: est.)
  if (u(21) < 0.22)
    return {
      ceiling: "camps",
      shut: "None of its plants bears a seed worth sowing, and none of its beasts will be led.",
    };
  if (body.diet === "flesh")
    return {
      ceiling: "villages",
      shut: "They eat only flesh, and herds alone have never fed a town.",
    };
  if (body.social < 0.45)
    return {
      ceiling: "villages",
      shut: "A body like theirs bears only so many of its own close by: no town of them holds together.",
    };
  if (!m.vessel || hottest(m).heat < m.vessel.heat)
    return {
      ceiling: "villages",
      shut: "Nothing they can make here fires a jar, and a people with no jars keeps no store past a season.",
    };
  if (hottest(m).heat < 1000)
    return {
      ceiling: "towns",
      shut: `The hottest they can get here is ${round(hottest(m).heat)} °C: no metal comes free of its ore.`,
    };
  if (!m.hardens)
    return {
      ceiling: "towns",
      shut: `Its star holds few metals, and the veins in its crust are too thin to work.`,
    };
  // (How heavy a load a people lifts: past this pull an engine scarcely lifts its own fuel; est.)
  if (p.gravity > 2.2)
    return {
      ceiling: "cities",
      shut: `Under ${p.gravity.toFixed(1)} g no engine of theirs lifts much more than itself.`,
    };
  // (Coal and oil are old life buried: Earth's first took some 0.1 thousand million years of forests.)
  if (bodiesAgo < 0.75)
    return {
      ceiling: "cities",
      shut: `Bodies have lived there only ${bodiesAgo.toFixed(2)} thousand million years: too little life has lain buried to make the coal or oil an engine wants.`,
    };
  return { ceiling: "works", shut: null };
}

/** How slow they climb: their world's pull and warmth, their own bodies; and its own draw. Est. */
function paceOf(p: ForeignPlanet, body: BodyPlan, m: Means, u: (n: number) => number): number {
  const pull = 1 + Math.max(0, p.gravity - 1.2) * 0.8,
    warmth = 1 + Math.abs(p.temperature - 16) / 40,
    together = 1.3 - 0.6 * body.social,
    life = body.span < 40 ? 1.25 : 1,
    metals = m.hardens ? 1 : 1.2;
  return pull * warmth * together * life * metals * (0.8 + 0.7 * u(6));
}

/** Why a people came to nothing, read off what most pressed on it. */
function fallWords(s: GalaxyStar, p: ForeignPlanet, u: number): string {
  if (s.spectral.startsWith("M")) return "A flare of their red star, far greater than any before.";
  if (p.temperature > 30) return "Their fields baked and blew away as their works warmed the air.";
  if (p.temperature < 9) return "The cold came down and stayed, and their stores ran out first.";
  return u < 0.34
    ? "A sickness born in their crowded cities, with no one left unhurt to tend the rest."
    : u < 0.67
      ? "Their wars burned what their towns lived on, and the towns went after."
      : "Their fields gave out under them, faster than they could learn why.";
}

/** A people's reading, made once for a world: null where no people rose. */
function readFolk(world: World, s: GalaxyStar, p: ForeignPlanet): Folk | null {
  const followed =
      civilizationsNear(world).find(
        (c) => c.planet === p.index && c.star.endsWith(`:${s.sector}:${s.k}`),
      ) ?? null,
    rng = new Rng(world.seed),
    life = lifeElsewhere(rng, s, p, !!followed);
  if (!followed) {
    if (life.level !== "bodies") return null;
    // (Bodies must have come ashore: a people of the water is left to a later step.)
    if (!(p.pressure > 0.3 && p.temperature > -5 && p.temperature < 50)) return null;
  }
  const u = drawOf(world, s, p.index),
    bodiesAgo = life.bodiesAgo ?? 0,
    // (From the first bodies to a mind took some 0.54 thousand million years here: est. for the rest.)
    needed = 0.3 + 1.2 * u(7),
    mindsAgo = bodiesAgo - needed;
  if (!followed && mindsAgo <= 0) return null;
  const body = bodyHere(p, u, followed),
    chem = chemistryHere(s, p, u),
    oxygen = life.small.includes("light"),
    a = affordancesOf(body),
    numbers = {
      ...meansWorldOf({
        chem,
        kind: "rocky",
        celsius: p.temperature,
        gravity: p.gravity,
        radius: p.radius,
        medium: body.medium,
        bodyFire: a.fire,
        insolation: s.luminosity / (p.a * p.a),
        grips: a.dexterity >= GRIP,
        bodyKg: body.size,
        beast: null,
      }),
      freeOxygen: oxygen,
      airBar: Math.max(0.01, p.pressure),
    },
    m = meansOf(numbers),
    stones = stonesFor(chem),
    rock = keenestIn(
      stones,
      worldRocks(chem).map((r) => r.id),
    ),
    ref = followed?.ref ?? makeRef(CIVILIZATION, s.sector, s.k * 16 + p.index);
  // The climb: a world whose minds have had longest began earliest, within a span its draw decides.
  const head = 0.6 + 0.4 * Math.min(1, mindsAgo / 0.8),
    arose = followed ? followed.offset : round(6400 - 7600 * dmath.pow(u(8), 1.15) * head),
    pace = followed ? followed.pace : paceOf(p, body, m, u),
    { ceiling, shut } = followed
      ? { ceiling: "stars" as FolkStage, shut: null }
      : ceilingOf(p, body, m, bodiesAgo, u);
  // A people that comes as far as its numbers let it, and past towns, may fall; one that came to the
  // first machines and was not heard fell before it could be: history hears all who speak (contact.ts).
  let fell: number | null = null;
  if (!followed) {
    const top = LADDER.indexOf(ceiling);
    if (top === LADDER.indexOf("works"))
      fell = round(arose + pace * (CLIMB.cities! + 40 + 300 * u(9)));
    else if (top >= LADDER.indexOf("towns") && u(10) < (ceiling === "cities" ? 0.45 : 0.28))
      fell = round(arose + pace * (CLIMB[ceiling]! + 120 + 1400 * u(9)));
  }
  const walkers = life.bodies.filter((b) => b.genome),
    forebear = walkers[walkers.length - 1] ?? null;
  return {
    ref,
    star: `star:${s.sector}:${s.k}` as Ref,
    planet: p.index,
    followed,
    name: civName(rng, { ref }),
    body,
    gravity: p.gravity,
    warmth: p.temperature,
    pressure: p.pressure,
    air: p.air,
    oxygen,
    chem,
    means: m,
    stone: stones[rock] ?? stones.limestone!,
    life: lifeChemistryOf({
      kind: "rocky",
      carbon: chem.carbon,
      metals: chem.metals,
      silica: chem.silica,
      star: s.temperature,
      mean: p.temperature,
      hand: handDraw(ref),
    }),
    level: life.level,
    forebear,
    beasts: life.bodies,
    bodiesAgo,
    mindsAgo: Math.max(0, mindsAgo),
    arose,
    pace,
    ceiling,
    shut,
    fell,
    fellWhy: fell === null ? null : fallWords(s, p, u(14)),
  };
}

const FOLKS = new Map<string, Folk | null>();

/** The people of a world of a star, by its place outward (null: none rose there). */
export function folkOf(world: World, s: GalaxyStar, index: number): Folk | null {
  const key = `${lawlessSeed(world.seed.text)} ${s.sector}:${s.k}/${index}`,
    known = FOLKS.get(key);
  if (known !== undefined) return known;
  const p = foreignPlanets(new Rng(world.seed), s)[index],
    made = p && !s.remnant ? readFolk(world, s, p) : null;
  if (FOLKS.size >= 512) FOLKS.delete(FOLKS.keys().next().value!);
  FOLKS.set(key, made);
  return made;
}

/** Every people about the stars within reach, the nearest first. */
export function folksNear(world: World): readonly Folk[] {
  const out: Folk[] = [];
  for (const s of clusterOf(world))
    for (const p of foreignPlanets(new Rng(world.seed), s)) {
      const f = folkOf(world, s, p.index);
      if (f) out.push(f);
    }
  return out;
}

/** A people by its ref (null: none rose there). */
export function folkByRef(world: World, ref: string): Folk | null {
  const parts = ref.split(":");
  if (parts[0] !== "civ") return null;
  const sector = Number(parts[1]),
    b = Number(parts[2]),
    k = Math.floor(b / 16),
    s = clusterOf(world).find((x) => x.sector === sector && x.k === k);
  return s ? folkOf(world, s, b % 16) : null;
}

/** How far a people has come by a year. */
export function folkStage(f: Folk, year: number): FolkStage {
  if (f.followed) {
    const c = f.followed;
    if (year >= c.stars) return "stars";
    if (year >= c.orbit) return "orbit";
    if (year >= c.electronics) return "signals";
  }
  if (f.fell !== null && year >= f.fell) return "ruins";
  const climb = (year - f.arose) / f.pace,
    top = f.followed ? LADDER.length - 1 : LADDER.indexOf(f.ceiling);
  let at = 0;
  for (let i = 1; i <= top; i++) if (climb >= CLIMB[LADDER[i]!]!) at = i;
  return LADDER[at]!;
}

/** Whether a stage has towns to go down to (else its camps; ruins are what stood). */
export const hasTown = (stage: FolkStage) => stage !== "camps";
/** Whether a stage is past the ladder a far world is read by: their signals are heard, their ships fly. */
export const pastLadder = (stage: FolkStage) => DARK.includes(stage);

/** The stage at which they stood highest, before they fell (the ruins' size, and what those ruins were). */
export function folkPeak(f: Folk, year: number): FolkStage {
  const stage = folkStage(f, year);
  if (stage !== "ruins") return stage;
  return folkStage({ ...f, fell: null }, f.fell! - 1);
}

/** How many of them there are now, all told (est.; a followed people's is not told by history). */
export function folkPeople(f: Folk, year: number): number {
  const stage = folkStage(f, year),
    k = (hashString(`${f.ref} people`) >>> 0) / 4294967296,
    between = (lo: number, hi: number) => round(lo * dmath.pow(hi / lo, k));
  switch (stage) {
    case "ruins":
      return 0;
    case "camps":
      return between(600, 8000);
    case "villages":
      return between(8000, 60_000);
    case "towns":
      return between(60_000, 500_000);
    case "cities":
      return between(400_000, 4_000_000);
    case "works":
      return between(4_000_000, 40_000_000);
    default:
      return between(40_000_000, 4_000_000_000);
  }
}

/** The people of the one place an eye goes down to: a band's worth, or as many as its town holds. */
export function folkPlacePeople(f: Folk, stage: FolkStage): number {
  const k = (hashString(`${f.ref} place`) >>> 0) / 4294967296,
    between = (lo: number, hi: number) => round(lo * dmath.pow(hi / lo, k));
  switch (stage) {
    case "camps":
      return between(10, 24);
    case "villages":
      return between(120, 600);
    case "towns":
      return between(1300, 4400);
    case "cities":
      return between(5200, 18_000);
    default:
      return between(9000, 30_000);
  }
}

/**
 * What a people's hands carry at a stage, each from what its world holds: its stone's edge on a shaft
 * in camps; a blade of a stuff its world's matter gives, in cities; a charge its air allows, at works.
 * Phase 70 asks this for what natives fight with.
 */
export function folkArms(f: Folk, stage: FolkStage): readonly string[] {
  const armed = affordancesOf(f.body).dexterity >= GRIP,
    natural =
      f.body.manipulators === "claws"
        ? "their claws"
        : f.body.manipulators === "mandibles"
          ? "their mandibles"
          : f.body.manipulators === "trunk"
            ? "a swung trunk"
            : "their bare limbs";
  if (stage === "ruins") return [];
  const spear = armed ? `a spear tipped with ${f.stone.name}` : `${natural}, and thrown stones`,
    out = [spear];
  if (stage === "villages" || stage === "towns") out.push("a sling and thrown stones");
  const blade = f.means.edge ? `a long blade of ${f.means.edge.name}` : null;
  if (stage === "cities" && blade) out.push(blade);
  if (stage === "works" && blade) out.push(blade);
  if ((stage === "works" || pastLadder(stage)) && f.means.handCharge)
    out.push(`a gun charged with ${f.means.handCharge.name}`);
  return out;
}

// —— Who came ————————————————————————————————————————————————————————————————————————————

/** Who came to them first, and when: a ship of the home world's, or a people of the stars' settling. */
export type Arrival = {
  readonly kind: "home" | "people";
  readonly year: number;
  /** The event of their arrival (null: told only by a hold from before the chronicle). */
  readonly event: Ref | null;
  /** A home ship's colony (its land); a people's ref. */
  readonly cell: number | null;
  readonly civ: Ref | null;
  /** The stage they were found at. */
  readonly found: FolkStage;
  /** A ship sent through the lanes to look (Phase 68): its place among those sent. */
  readonly visit?: number;
};

/** Everyone who has come down on a people's world, the first first: read off what history holds. */
export function arrivalsAt(world: World, f: Folk): readonly Arrival[] {
  const out: Arrival[] = [],
    sites = starSitesOf(world);
  if (sites)
    for (const [cell, site] of sites.all())
      if (site.star === f.star && site.planet === f.planet && site.arrived)
        out.push({
          kind: "home",
          year: site.arrives,
          event: site.arrived,
          cell,
          civ: null,
          found: folkStage(f, site.arrives),
        });
  lanesOf(world)?.visits.forEach((v, visit) => {
    if (v.folk === f.ref && v.arrived)
      out.push({
        kind: "home",
        year: v.arrives,
        event: v.arrived,
        cell: null,
        civ: null,
        found: folkStage(f, v.arrives),
        visit,
      });
  });
  const store = peoplesOf(world);
  if (store)
    for (const c of civilizationsNear(world)) {
      if (c.ref === f.ref) continue;
      for (const h of store.holdsOf(c.ref))
        if (h.star === f.star && holdWorld(world, c, h.star) === f.planet)
          out.push({
            kind: "people",
            year: h.year,
            event: h.event,
            cell: null,
            civ: c.ref,
            found: folkStage(f, h.year),
          });
    }
  return out
    .filter((a) => a.year <= Math.floor(world.now / (365 * 86400)))
    .sort(
      (a, b) =>
        a.year - b.year ||
        (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : (a.cell ?? 0) - (b.cell ?? 0)),
    );
}

// —— Two peoples, by their numbers ————————————————————————————————————————————————————————

/** What the reading of a meeting needs of a people. */
export type Party = {
  readonly name: string;
  readonly body: BodyPlan;
  readonly air: string;
  readonly pressure: number;
  readonly oxygen: boolean;
  readonly gravity: number;
  readonly warmth: number;
  readonly life: LifeChemistry;
};

export const partyOf = (f: Folk): Party => ({
  name: `the ${f.name}`,
  body: f.body,
  air: f.air,
  pressure: f.pressure,
  oxygen: f.oxygen,
  gravity: f.gravity,
  warmth: f.warmth,
  life: f.life,
});

/** The pressures a body raised at a pressure can draw breath in (a factor each way; est.). */
const BREATH_RANGE = 2.6;

/** Whether a people's lungs could live in another's air, and why not. */
function breathes(guest: Party, host: Party): { readonly can: boolean; readonly why: string } {
  if (guest.body.medium === "water")
    return { can: false, why: `${guest.name} live in water, and drown in any air` };
  if (host.pressure < 0.05)
    return { can: false, why: `the air of ${host.name} is next to nothing` };
  if (!host.oxygen) return { can: false, why: `the air of ${host.name} holds no free oxygen` };
  if (guest.life.family !== host.life.family)
    return {
      can: false,
      why: `the air of ${host.name} feeds a life of ${host.life.family}, not of ${guest.life.family}`,
    };
  const ratio = host.pressure / Math.max(0.05, guest.pressure);
  if (ratio > BREATH_RANGE)
    return {
      can: false,
      why: `the air of ${host.name} presses ${ratio.toFixed(1)} times harder than ${guest.name} are made for`,
    };
  if (ratio < 1 / BREATH_RANGE)
    return {
      can: false,
      why: `the air of ${host.name} is ${(1 / ratio).toFixed(1)} times thinner than ${guest.name} are made for`,
    };
  return {
    can: true,
    why: `the air of ${host.name} holds oxygen at a pressure ${guest.name} can draw`,
  };
}

/** How a body can say something: by its hearing and a voice, where there is air to carry one; or by signs. */
function saying(a: Party, b: Party): { readonly can: boolean; readonly how: string } {
  const hears = (p: Party) => p.body.senses.includes("hearing") || p.body.senses.includes("echo"),
    sees = (p: Party) => p.body.senses.includes("sight"),
    hands = (p: Party) => affordancesOf(p.body).dexterity >= GRIP;
  if (hears(a) && hears(b))
    return {
      can: true,
      how: "both hear, and air carries a voice: each can in time learn the other's sounds, as far as its throat will make them",
    };
  if (sees(a) && sees(b) && hands(a) && hands(b))
    return {
      can: true,
      how: "one of them does not hear the other, but both see and both have limbs to sign with: they can speak by signs",
    };
  if (sees(a) && sees(b))
    return {
      can: true,
      how: "they share no sound, but both see: they can point, draw and be understood in part",
    };
  return {
    can: false,
    how: "they share no sense to say anything by: neither has any way to tell the other a thing",
  };
}

/** A meeting, by numbers: what each can do of the other's, the same whichever is named first. */
export type ContactReading = {
  readonly speak: { readonly can: boolean; readonly words: string };
  /** Whether each can draw the other's air, and stand on the other's ground. */
  readonly airThere: { readonly can: boolean; readonly words: string };
  readonly airHome: { readonly can: boolean; readonly words: string };
  /** Whether each could live on the other's food. */
  readonly foodThere: { readonly can: boolean; readonly words: string };
  readonly foodHome: { readonly can: boolean; readonly words: string };
  /** Whether a sickness could pass between them: both ways or neither. */
  readonly sickness: { readonly can: boolean; readonly words: string };
};

const FOOD = (eater: Party, food: Party): { can: boolean; words: string } => {
  const can = eats(eater.life, food.life);
  return {
    can,
    words: can
      ? eater.life.hand === food.life.hand
        ? `${eater.name} could live on what ${food.name} eat: its sugars and proteins turn as theirs do`
        : `${eater.name} could live on the stores of what ${food.name} eat, which turn neither way, but not on its flesh`
      : eater.life.family !== food.life.family
        ? `nothing of what ${food.name} eat could feed ${eater.name}: it is dissolved in ${food.life.family}, they in ${eater.life.family}`
        : `nothing of what ${food.name} eat could feed ${eater.name}: its sugars turn the other way`,
  };
};

/**
 * Two peoples, read: `home` come down on the world of `there`. A pure reading of their numbers; and a
 * sickness passes as a star's sickness does (health.ts: sharesStarSickness), by a life of the same liquid.
 */
export function contactBetween(home: Party, there: Party): ContactReading {
  const say = saying(home, there),
    guestAir = breathes(home, there),
    hostAir = breathes(there, home),
    same = home.life.family === there.life.family;
  return {
    speak: { can: say.can, words: say.how },
    airThere: {
      can: guestAir.can,
      words: `${home.name} ${guestAir.can ? "can" : "cannot"} breathe there: ${guestAir.why}`,
    },
    airHome: {
      can: hostAir.can,
      words: `${there.name} ${hostAir.can ? "could" : "could not"} breathe the air of ${home.name}: ${hostAir.why}`,
    },
    foodThere: FOOD(home, there),
    foodHome: FOOD(there, home),
    sickness: same
      ? {
          can: true,
          words: `a sickness of either could live in the other: both are lives of ${there.life.family}`,
        }
      : {
          can: false,
          words: `no sickness of either could live in the other: one is a life of ${home.life.family}, the other of ${there.life.family}`,
        },
  };
}

/** The home world's people, as a meeting reads them. */
export function homeParty(world: World, life: LifeChemistry): Party {
  const g = homePlanet(world).generated,
    home = g.system.bodies[0]!,
    b = g.life.people?.body;
  return {
    name: g.life.people
      ? `the ${g.life.species[g.life.people.species]!.name}`
      : "the home world's people",
    body: b ?? (CLADES.find((c) => c.id === "ape")!.body as unknown as BodyPlan),
    air: home.air,
    pressure: home.pressure,
    oxygen: home.air === "breathable",
    gravity: home.gravity,
    warmth: g.planet.meanTemperature,
    life,
  };
}
