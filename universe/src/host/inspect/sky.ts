// The pages of the sky (Phase 10 M91): the home star and its worlds and moons, a star of the
// cluster or of the galaxy far out, another star's world, and the people that rose on one.
import { CLADES } from "../../rules/index.ts";
import {
  civilizationsNear,
  homePlanet,
  populationContext,
  starSitesOf,
  starWarsOf,
} from "../../sim/index.ts";
import { offworldSite, cellRef } from "../../gen/index.ts";
import { Rng, type World } from "../../kernel/index.ts";
import type { Item, PageModel, Place, Stat } from "../../bridge/index.ts";
import { starByRef, starFacts, foreignGlobe } from "../galaxy.ts";
import { foreignPlanets } from "../../gen/index.ts";
import { claimOf, count, item, link, many, stat, yearNow } from "./words.ts";
import { landLink, realmLink, spotOfLand } from "./names.ts";

/** A star in plain words, by its light. */
function starWords(s: { spectral: string; remnant?: boolean }): string {
  if (s.remnant) return "A white dwarf";
  switch (s.spectral[0]) {
    case "O":
    case "B":
      return "A blue giant";
    case "A":
      return "A white star";
    case "F":
      return "A yellow-white star";
    case "G":
      return "A yellow star";
    case "K":
      return "An orange star";
    default:
      return "A red dwarf";
  }
}

/** The most peopled land's middle: where the home world is turned to. */
function homeSpot(world: World): number {
  const ctx = populationContext(world);
  let best = -1,
    most = -1;
  for (const p of ctx.provinces.all())
    if (p.total() > most && !offworldSite(homePlanet(world).generated, p.cell)) {
      most = p.total();
      best = p.cell;
    }
  return (best >= 0 ? spotOfLand(world, best) : 0) ?? 0;
}

/** A star's page: the home star's system, or a star of the cluster or the galaxy. */
export function starPageModel(world: World, ref: string): PageModel {
  const g = homePlanet(world).generated,
    year = yearNow(world);
  if (ref === g.star.ref) {
    const bodies = g.system.bodies.filter((b) => b.orbit.around === g.star.ref);
    return {
      ref,
      kind: "star",
      icon: "☀️",
      title: "The home star",
      subtitle: [`${starWords(g.star)}, ${g.star.ageGyr.toFixed(1)} billion years old`],
      color: null,
      place: { scale: "system" },
      stats: [
        stat("Kind", g.star.spectral),
        stat("Mass", `${g.star.mass.toFixed(2)} suns`),
        stat("Light", `${g.star.luminosity.toFixed(2)} suns`),
        stat("Worlds", count(bodies.length)),
      ],
      tabs: [
        {
          id: "overview",
          name: "Overview",
          blocks: [
            {
              type: "list",
              title: "Its worlds, outward",
              items: bodies.map((b) =>
                item(
                  [link(b.designation, b.ref), ` — ${b.kind}, ${b.orbit.a.toFixed(2)} AU`],
                  b.ref,
                ),
              ),
            },
            { type: "why", ref },
          ],
        },
      ],
      followable: false,
      year,
    };
  }
  const s = starByRef(world, ref),
    rng = new Rng(world.seed),
    f = starFacts(s, rng),
    worlds = foreignPlanets(rng, s),
    far = ref.startsWith("gstar:"),
    civs = civilizationsNear(world).filter((c) => c.star === ref),
    ships = (starSitesOf(world)?.all() ?? []).filter(([, site]) => site.star === ref),
    wars = starWarsOf(world)
      .all()
      .filter((w) => civs.some((c) => c.ref === w.enemy));
  const stats: Stat[] = [
    stat("Distance", `${f.distance.toFixed(1)} light-years`),
    stat("Kind", f.spectral),
    stat("Worlds", count(f.planets), {
      parts: f.seas ? [{ label: ["with seas"], value: count(f.seas) }] : [],
    }),
    stat("Age", `${f.ageGyr.toFixed(1)} billion years`),
  ];
  const peopleItems: Item[] = civs.map((c) =>
    item([link("A people of this star", c.ref), ` — on its ${ordinal(c.planet + 1)} world`], c.ref),
  );
  const shipItems: Item[] = ships.map(([cell, site]) =>
    item(
      [
        landLink(world, cell),
        site.arrived !== null ? " — arrived" : ` — arrives in year ${site.arrives}`,
      ],
      cellRef(0, cell),
    ),
  );
  const warItems: Item[] = wars.map((w) =>
    item([link("A war among the stars", w.ref), " of ", realmLink(world, w.realm)], w.ref),
  );
  const place: Place = far ? { scale: "galaxy", star: ref } : { scale: "cluster", star: ref };
  return {
    ref,
    kind: "star",
    icon: "⭐",
    title: `${starWords(f)} ${f.distance.toFixed(1)} light-years out`,
    subtitle: [`${f.spectral}, ${f.ageGyr.toFixed(1)} billion years old`],
    color: null,
    place,
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "list",
            title: "Its worlds, outward",
            items: worlds.map((w, i) =>
              item(
                [
                  link(`Its ${ordinal(i + 1)} world`, `${ref}/${i}`),
                  ` — ${w.kind}, ${w.a.toFixed(2)} AU, ${w.water === "seas" ? "with seas" : w.water}`,
                ],
                `${ref}/${i}`,
              ),
            ),
          },
          ...(peopleItems.length
            ? [{ type: "list" as const, title: "Peoples", items: peopleItems }]
            : []),
          ...(shipItems.length
            ? [{ type: "list" as const, title: "Ships and halls from home", items: shipItems }]
            : []),
          ...(warItems.length ? [{ type: "list" as const, title: "Wars", items: warItems }] : []),
        ],
      },
    ],
    followable: false,
    year,
  };
}

/** A world's place outward from its star (first, second…). */
function outward(
  bodies: readonly { ref: string; orbit: { around: string; a: number } }[],
  star: string,
  ref: string,
): number {
  const round = bodies.filter((x) => x.orbit.around === star).sort((x, y) => x.orbit.a - y.orbit.a);
  return round.findIndex((x) => x.ref === ref) + 1;
}

function ordinal(n: number): string {
  const words = [
    "",
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
  ];
  return words[n] ?? `${n}th`;
}

/** A world or moon of the home star's: its ground and air, its moons and the halls on it. */
export function bodyPage(world: World, ref: string): PageModel {
  const g = homePlanet(world).generated,
    index = g.system.bodies.findIndex((b) => b.ref === ref);
  if (index < 0) throw new Error(`no world ${ref}`);
  const b = g.system.bodies[index]!,
    home = b.ref === g.planet.ref,
    moons = g.system.bodies.filter((m) => m.orbit.around === b.ref),
    ctx = populationContext(world),
    halls = ctx.provinces
      .all()
      .filter((p) => offworldSite(g, p.cell)?.body === index && p.total() > 0),
    around = g.system.bodies.find((x) => x.ref === b.orbit.around);
  return {
    ref,
    kind: b.kind === "moon" ? "moon" : "planet",
    icon: home ? "🌍" : b.kind === "moon" ? "🌙" : "🪐",
    title: home
      ? "The home world"
      : b.kind === "moon"
        ? `Moon ${b.designation}${around ? ` of ${around.ref === g.planet.ref ? "the home world" : around.designation}` : ""}`
        : `The ${ordinal(outward(g.system.bodies, g.star.ref, b.ref))} world (${b.designation})`,
    subtitle: [
      `${b.kind}${home ? "" : ""}`,
      ...(around
        ? [" of ", link(around.designation, around.ref)]
        : [" of ", link("the home star", g.star.ref)]),
    ],
    color: null,
    place: home ? { scale: "globe", spot: homeSpot(world) } : { scale: "body", index },
    stats: [
      stat("Gravity", `${b.gravity.toFixed(2)} g`),
      stat("Warmth", `${Math.round(b.temperature - 273)} °C`),
      stat("Air", b.air),
      stat("Water", b.water),
      ...(halls.length ? [stat("Halls", count(halls.length))] : []),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat(
                "Orbit",
                `${b.orbit.a.toFixed(3)} AU, a year of ${Math.round(b.orbit.periodDays)} days`,
              ),
              stat("Mass", `${b.mass.toFixed(3)} Earths`),
              stat("Size", `${b.radius.toFixed(2)} Earths across`),
              stat("Escape", `${b.escape.toFixed(1)} km/s`),
              stat("Air pressure", `${b.pressure.toFixed(2)} bar`),
              stat("Radiation", `${b.radiation}`),
            ],
          },
          { type: "text", title: "Why it is like this", lines: b.because.map((w) => [w]) },
          ...(moons.length
            ? [
                {
                  type: "list" as const,
                  title: "Its moons",
                  items: moons.map((m) => item([link(m.designation, m.ref)], m.ref)),
                },
              ]
            : []),
          ...(halls.length
            ? [
                {
                  type: "list" as const,
                  title: "Halls on it",
                  items: halls.map((p) =>
                    item(
                      [landLink(world, p.cell), ` — ${many(p.total(), "person", "people")}`],
                      cellRef(0, p.cell),
                    ),
                  ),
                },
              ]
            : []),
          { type: "why", ref },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** Another star's world (`<star>/<index>`): its ground, air and water, and its people if one rose there. */
export function foreignWorldPage(world: World, ref: string): PageModel {
  const slash = ref.lastIndexOf("/"),
    star = ref.slice(0, slash),
    index = Number(ref.slice(slash + 1)),
    w = foreignGlobe(world, star, index),
    civ = civilizationsNear(world).find((c) => c.star === star && c.planet === index);
  return {
    ref,
    kind: "world",
    icon: w.living ? "🌏" : "🪐",
    title: `The ${ordinal(index + 1)} world of a star`,
    subtitle: [link("its star", star)],
    color: null,
    place: { scale: "world", star, index },
    stats: [
      stat("Kind", w.kind),
      stat("Air", w.air),
      stat("Water", w.water),
      stat("Living", w.living ? "its lands are green" : "no life on it"),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Star", [link("its star", star)]),
              ...(w.people && civ
                ? [
                    stat("People", [link(w.people.name, civ.ref)]),
                    stat("They came to the stars", `year ${w.people.stars}`),
                  ]
                : []),
            ],
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** Another star's people (`civ:`): who they are, where, and when they came to each stage. */
export function civilizationPage(world: World, ref: string): PageModel {
  const c = civilizationsNear(world).find((x) => x.ref === ref);
  if (!c) throw new Error(`no people ${ref}`);
  const name = CLADES.find((x) => x.id === c.clade)?.body.name ?? c.clade;
  return {
    ref,
    kind: "civilization",
    icon: "👽",
    title: `The ${name} of another star`,
    subtitle: [
      link(`its ${ordinal(c.planet + 1)} world`, `${c.star}/${c.planet}`),
      `, ${c.distance.toFixed(1)} light-years out`,
    ],
    color: null,
    place: { scale: "world", star: c.star, index: c.planet },
    stats: [
      stat("Distance", `${c.distance.toFixed(1)} light-years`),
      stat("They live in", c.medium),
      stat("Their pull", `${c.gravity.toFixed(2)} g`),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Electronics", `year ${c.electronics}`),
              stat("Orbit", `year ${c.orbit}`),
              stat("The stars", `year ${c.stars}`),
              stat("Their star", [link("their star", c.star)]),
            ],
          },
          { type: "text", lines: [[claimOf(world, ref)]] },
          { type: "why", ref },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}
