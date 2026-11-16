// Peoples of the sea about other stars (round F; the audit's "water peoples far away: absent", natives.ts having left "a people
// of the water to a later step"). A world whose bodies never came ashore, or whose shore no body could stand on (its air too thin
// or its face frozen or scalding), may yet have a people in its seas: risen among its living things as any people rises, read off
// its own numbers as natives.ts reads a people of the land, on its own draws. Its road is not the fire's: it lives by its vents,
// its tides and the current its own living things carry (rules/farlife.ts), and where that road ends is what its own numbers say
// (farlife-read.ts). Nothing here enters history: a reading, the same every time.
import { Rng, dmath, hashString, makeRef, type World } from "../../kernel/index.ts";
import {
  CIVILIZATION,
  civName,
  farQuickening,
  handDraw,
  lifeElsewhere,
  type ForeignPlanet,
  type GalaxyStar,
} from "../../gen/index.ts";
import {
  CLADES,
  GRIP,
  affordancesOf,
  bodyOf,
  chemistryOf,
  keenestIn,
  lifeChemistryOf,
  meansOf,
  meansWorldOf,
  stonesFor,
  worldRocks,
} from "../../rules/index.ts";
import type { Folk } from "./natives.ts";
import { lawlessSeed } from "./lanes.ts";
import { farBodies } from "./contact.ts";

/** Whether a body could stand on a world's shore at all (natives.ts' own test of a people of the land). */
const ashore = (p: ForeignPlanet) => p.pressure > 0.3 && p.temperature > -5 && p.temperature < 50;

/** Whether a world's seas lie liquid somewhere a body could live: under their ice, below their boiling (est.). */
const liquidSeas = (p: ForeignPlanet) =>
  p.water === "seas" && p.temperature > -40 && p.temperature < 90 && p.pressure > 0.01;

/**
 * The people of a world's seas, read where no people of its land rose (null: none rose there). `landless`: natives.ts found none of
 * its land. A people of the sea of a world whose shore bodies could stand on is the land's own reading's to find (B4's risers).
 */
export function seaFolkOf(world: World, s: GalaxyStar, p: ForeignPlanet): Folk | null {
  if (s.remnant || p.kind !== "rocky" || ashore(p) || !liquidSeas(p)) return null;
  const rng = new Rng(world.seed),
    reads = farBodies(world),
    life = lifeElsewhere(rng, s, p, false, reads === null ? null : farQuickening(s, p));
  if (life.level !== "bodies") return null;
  const key = `${lawlessSeed(world.seed.text)} seafolk ${s.sector}:${s.k}/${p.index}`,
    u = (n: number) => (hashString(`${key} ${n}`) >>> 0) / 4294967296,
    bodiesAgo = life.bodiesAgo ?? 0,
    // (A mind takes as long to rise in the sea as on land, est.: from the first bodies, 0.3 to 1.5 thousand million years.)
    mindsAgo = bodiesAgo - (0.3 + 1.2 * u(7));
  if (mindsAgo <= 0) return null;
  // (Of the kinds of the water, which rose: each weighed by how its world suits it.)
  const c = { warmth: p.temperature, rain: 1000, gravity: p.gravity, ocean: 0.9 },
    clades = CLADES.filter((x) => x.body.medium === "water");
  if (!clades.length) return null;
  const weights = clades.map((x) => 0.05 + Math.max(0, x.fit(c)));
  let pick = u(1) * weights.reduce((a, b) => a + b, 0),
    at = 0;
  for (; at < clades.length - 1; at++) {
    pick -= weights[at]!;
    if (pick < 0) break;
  }
  const body = bodyOf(clades[at]!, c, [u(2), u(3), u(4), u(5)]),
    inner = Math.sqrt(s.luminosity / 1.1),
    outer = Math.sqrt(s.luminosity / 0.53),
    zone = Math.min(1, Math.max(0, (p.a - inner) / Math.max(1e-6, outer - inner))),
    chem = chemistryOf({
      temperature: s.temperature,
      ageGyr: s.ageGyr,
      zone,
      u: [u(11) * 2 - 1, u(12) * 2 - 1, u(13) * 2 - 1],
    }),
    oxygen = life.small.includes("light"),
    a = affordancesOf(body),
    m = meansOf({
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
    }),
    stones = stonesFor(chem),
    rock = keenestIn(
      stones,
      worldRocks(chem).map((r) => r.id),
    ),
    ref = makeRef(CIVILIZATION, s.sector, s.k * 16 + p.index),
    head = 0.6 + 0.4 * Math.min(1, mindsAgo / 0.8),
    walkers = life.bodies.filter((b) => b.genome);
  return {
    ref,
    star: `star:${s.sector}:${s.k}` as Folk["star"],
    planet: p.index,
    followed: null,
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
    forebear: walkers[walkers.length - 1] ?? null,
    beasts: life.bodies,
    bodiesAgo,
    mindsAgo,
    arose: Math.round(6400 - 7600 * dmath.pow(u(8), 1.15) * head),
    // (How slow their climb goes is their own numbers' to say: farlife-read.ts. This is only the reading's first guess, for pages.)
    pace: 1 + Math.abs(p.temperature - 12) / 60,
    ceiling: "works",
    shut: null,
    holds: null,
    drives: null,
    fell: null,
    fellWhy: null,
  };
}
