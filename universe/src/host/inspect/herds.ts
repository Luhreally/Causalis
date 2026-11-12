// A land's creatures, as a person reads them and its map draws them (Z1): which of the world's own kinds goes through here, what it eats and what eats it, where it
// lives, when it comes and where it goes; what has become of them; the beast a town came to know, with its name, its deeds and its end; the tree of life going on.
// Pure reads of what the world keeps: looking moves nothing.
import { landPast } from "../past.ts";
import { REGION_SIZE, PROVINCE_TILE_KM } from "../../sim/index.ts";
import { beastPlanOf, isProvinceWorld, lives, regionPoint, type Species } from "../../gen/index.ts";
import {
  HERD,
  HERD_RAID,
  dwellingOf,
  herdDrawn,
  herdWhyWords,
  passWindows,
  seasonWords,
  youngWords,
} from "../../rules/index.ts";
import {
  ecologyOf,
  herdIndex,
  herdStock,
  herdsOf,
  homePlanet,
  populationContext,
  wildsOf,
  woodsRead,
  type KnownBeast,
} from "../../sim/index.ts";
import { hashString, type World } from "../../kernel/index.ts";
import type { Block, HerdPass, LandHerds, Line, PageModel, Stat, Tab } from "../../bridge/index.ts";
import { landLink, landTitle, townLink } from "./names.ts";
import { item, link, stat, yearNow } from "./words.ts";
import { memoryOf, songRef } from "./memory.ts";

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const thePlain = (s: string): string => (/^(a|an|the) /.test(s) ? s : `the ${s}`);

/** A kind new on this land, if one is: it goes by its own name here. */
function ownKind(world: World, cell: number) {
  return herdsOf(world)?.kinds.find((k) => k.cell === cell);
}

/** The kinds that go in numbers on a land: its first, and one more of another kind if it has one. */
function kindsOn(world: World, cell: number): Species[] {
  const ctx = populationContext(world),
    g = ctx.generated,
    idx = herdIndex(ctx);
  if (!idx || cell >= idx.lands) return [];
  const gone = new Set(herdsOf(world)?.gone.map((k) => k.species) ?? []),
    lost = new Set(ecologyOf(world).get(cell)?.lost ?? []),
    out: Species[] = [],
    first = idx.kind[cell]!;
  if (first < 0) return [];
  if (!gone.has(first) && !lost.has(first)) out.push(g.life.species[first]!);
  // (A second, of another way of life, if this land has one: a land's grazers and its browsers come and go apart.)
  const niche = g.life.species[first]!.niche;
  for (const s of g.life.species) {
    if (out.length >= 2) break;
    if (s.died !== null || !s.body || s.niche === niche) continue;
    if (s.niche !== "grazer" && s.niche !== "browser" && s.niche !== "great beast") continue;
    if (ctx.medium === "water" || gone.has(s.index) || lost.has(s.index)) continue;
    if (lives(g.life, cell, s.index)) out.push(s);
  }
  return out;
}

/** The way a kind goes through a land: the lands either side of it, warmest and coolest (or driest and wettest, where a year has no winter). */
function routeOf(world: World, cell: number) {
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    n = g.offworld.base,
    swing = g.climate.seasonality[cell] ?? 8,
    byRain = swing < HERD.byRain,
    score = (c: number): number =>
      byRain ? g.climate.precipitation[c]! : -g.climate.temperature[c]!,
    walk = (sign: 1 | -1): number[] => {
      const path: number[] = [];
      let at = cell;
      for (let step = 0; step < HERD.steps; step++) {
        let best = -1,
          most = score(at) * sign;
        for (let k = g.grid.offsets[at]!; k < g.grid.offsets[at + 1]!; k++) {
          const m = g.grid.neighbours[k]!;
          if (m >= n || path.includes(m) || m === cell) continue;
          if (herdStock(ctx, m) < HERD.least) continue;
          const v = score(m) * sign;
          if (v > most) {
            most = v;
            best = m;
          }
        }
        if (best < 0) break;
        path.push(best);
        at = best;
      }
      return path;
    };
  return { warm: walk(-1), cool: walk(1), byRain, still: swing < HERD.still };
}

/** A land's direction to another, on its own map (a unit in x and z). */
function wayTo(world: World, cell: number, to: number): readonly [number, number] | null {
  const g = homePlanet(world).generated;
  if (!isProvinceWorld(g)) return null;
  const centre = g.centre[cell];
  if (centre === undefined || centre < 0) return null;
  const mid = Math.floor(REGION_SIZE / 2),
    t0 = mid * REGION_SIZE + mid,
    p0 = regionPoint(g.fine, centre, REGION_SIZE, PROVINCE_TILE_KM, t0),
    px = regionPoint(g.fine, centre, REGION_SIZE, PROVINCE_TILE_KM, t0 + 1),
    pz = regionPoint(g.fine, centre, REGION_SIZE, PROVINCE_TILE_KM, t0 + REGION_SIZE),
    P = g.grid.positions,
    d = [P[3 * to]! - p0[0], P[3 * to + 1]! - p0[1], P[3 * to + 2]! - p0[2]],
    ex = [px[0] - p0[0], px[1] - p0[1], px[2] - p0[2]],
    ez = [pz[0] - p0[0], pz[1] - p0[1], pz[2] - p0[2]],
    x = d[0]! * ex[0]! + d[1]! * ex[1]! + d[2]! * ex[2]!,
    z = d[0]! * ez[0]! + d[1]! * ez[1]! + d[2]! * ez[2]!,
    l = Math.sqrt(x * x + z * z);
  return l > 0 ? [x / l, z / l] : null;
}

/** How far a land's creatures go through a year, from their warm end to their cool, over the ground (km). */
export function herdWayKm(world: World, cell: number): number {
  const r = routeOf(world, cell),
    g = homePlanet(world).generated,
    a = r.warm[r.warm.length - 1] ?? cell,
    b = r.cool[r.cool.length - 1] ?? cell,
    P = g.grid.positions,
    d = P[3 * a]! * P[3 * b]! + P[3 * a + 1]! * P[3 * b + 1]! + P[3 * a + 2]! * P[3 * b + 2]!;
  return Math.acos(Math.min(1, d)) * 6371 * g.planet.radius;
}

/** The way a land's creatures go across it through the year. */
export function herdPass(world: World, cell: number): HerdPass {
  const r = routeOf(world, cell),
    steps = r.warm.length + r.cool.length,
    toCool = r.cool[0] !== undefined ? wayTo(world, cell, r.cool[0]) : null,
    toWarm = r.warm[0] !== undefined ? wayTo(world, cell, r.warm[0]) : null,
    k = (hashString(`herd way ${cell}`) >>> 0) / 4294967296,
    fall: readonly [number, number] = [Math.cos(k * 6.283), Math.sin(k * 6.283)],
    ux = (toCool?.[0] ?? 0) - (toWarm?.[0] ?? 0),
    uz = (toCool?.[1] ?? 0) - (toWarm?.[1] ?? 0),
    l = Math.sqrt(ux * ux + uz * uz),
    way: readonly [number, number] = l > 1e-6 ? [ux / l, uz / l] : fall;
  if (!steps || r.still) return { rank: 0, width: 1, still: true, way };
  return {
    rank: r.warm.length / steps,
    width: Math.max(HERD.width, 0.55 / (steps + 1)),
    way,
  };
}

/** How many of a land's creatures can be seen, by kind, and where they live: a land's map asks this, and it moves nothing. */
export function landHerds(world: World, cell: number): LandHerds {
  const ctx = populationContext(world),
    g = ctx.generated,
    water = ctx.medium === "water",
    stock = herdStock(ctx, cell),
    kinds = kindsOn(world, cell),
    // (A land built over has none of them to see: the map's own rule for it.)
    pass = kinds.length && !landPast(world, cell)?.covered ? herdPass(world, cell) : null,
    own = ownKind(world, cell),
    store = herdsOf(world),
    known = store?.beastOn(cell),
    wilds = wildsOf(ctx, cell),
    hunter =
      wilds.hunter >= 0 && !wilds.lost.includes(wilds.hunter) && wilds.hunters > 0.05
        ? g.life.species[wilds.hunter]!
        : null,
    herds = pass
      ? kinds.flatMap((s, i) => {
          const n = herdDrawn(s.niche, i === 0 ? stock : Math.round(stock * 0.5));
          if (!n) return [];
          return [
            {
              ...pass,
              // (A second kind keeps a little apart, and comes a little after.)
              rank: pass.still ? pass.rank : Math.min(1, pass.rank + 0.12 * i),
              ref: `herd:${cell}:${s.index}`,
              name: i === 0 && own ? own.name : s.name,
              niche: water ? "swimmer" : s.niche,
              size: i === 0 && own ? own.size : s.size,
              wool: s.wool,
              body: beastPlanOf(g, s),
              n,
            },
          ];
        })
      : [],
    dens = [
      ...kinds
        .slice(0, 1)
        .filter(() => pass && stock >= HERD.least)
        .map((s) => ({ s, ref: `herd:${cell}:${s.index}` })),
      ...(hunter && pass ? [{ s: hunter, ref: `herd:${cell}:${hunter.index}` }] : []),
    ].map(({ s, ref }) => ({
      ref,
      kind: dwellingOf(s.niche, s.body, s.size, water),
      key: hashString(`den ${cell} ${s.index}`) >>> 0,
      name: s.name,
    })),
    beastTown = known?.town ? ctx.settlements.get(known.town) : undefined,
    beast = known
      ? {
          ref: `beast:${known.id}`,
          name: fullName(known),
          kind: g.life.species[known.species]!.name,
          size: g.life.species[known.species]!.size,
          wool: g.life.species[known.species]!.wool,
          body: beastPlanOf(g, g.life.species[known.species]!),
          tile: beastTown?.tile ?? Math.floor((REGION_SIZE * REGION_SIZE) / 2),
        }
      : null;
  return {
    cell,
    key: [stock, herds.map((h) => `${h.ref}${h.n}`).join(), dens.length, beast?.ref ?? ""].join(
      "|",
    ),
    herds,
    dens,
    beast,
    undersea: water,
  };
}

/** A beast as it is known. */
export function fullName(b: KnownBeast): string {
  return `${b.given}, ${b.by}`;
}

const EATS: Readonly<Record<string, string>> = {
  grass: "It grazes the open ground",
  leaves: "It browses leaves and shoots where the woods give it them",
  seeds: "It lives on seed and whatever falls from the fields",
  flesh: "It hunts",
  carrion: "It lives on what others have killed",
  plankton: "It takes what drifts in the water",
};

/** What a kind eats, in a sentence: read off its body and the plants of this land. */
function eatsLine(world: World, s: Species, cell: number): Line {
  const g = homePlanet(world).generated,
    water = populationContext(world).medium === "water",
    grass = g.life.seedGrass[cell],
    plant = grass !== undefined && grass >= 0 ? g.life.species[grass] : undefined,
    eats = s.body?.eats ?? (s.niche === "hunter" ? "flesh" : "grass"),
    base = EATS[eats] ?? "It eats what this land gives";
  if (water) return [`${base}, on the shelf and in the weed beds.`];
  if (eats === "grass" && plant)
    return [`${base}, and `, link(plant.name, plant.ref), " most of all where it stands."];
  return [`${base}.`];
}

/** What eats a kind on this land, in a sentence with its link. */
function eatenLine(world: World, s: Species, cell: number): Line {
  const ctx = populationContext(world),
    g = ctx.generated,
    w = wildsOf(ctx, cell),
    p = ctx.provinces.get(cell);
  if (s.niche === "hunter") return ["Nothing hunts it here but the people who keep flocks."];
  const hunters = g.life.species.filter(
    (h) =>
      h.niche === "hunter" &&
      h.died === null &&
      lives(g.life, cell, h.index) &&
      !w.lost.includes(h.index),
  );
  const people = (p?.total() ?? 0) > 0,
    tail = people ? ", and the people here hunt it." : ".";
  if (hunters.length)
    return [
      "It is hunted by ",
      ...hunters
        .slice(0, 2)
        .flatMap((h, i): Line => [...(i ? [" and "] : []), link(h.name, h.ref)]),
      tail,
    ];
  return [people ? "Nothing hunts it here now but the people." : "Nothing hunts it here now."];
}

/** Where a kind lives on a land, read off what it is and what the land is. */
function livesLine(world: World, s: Species, cell: number): string {
  const ctx = populationContext(world),
    g = ctx.generated,
    water = ctx.medium === "water",
    d = dwellingOf(s.niche, s.body, s.size, water),
    woods = woodsRead(ctx, cell).now,
    steep = g.tectonics.elevation[cell]! > 1200,
    where = water
      ? "on the shelf"
      : d === "roost"
        ? steep
          ? "on the high rocks"
          : "in the tallest stands it can find"
        : woods > 0.4
          ? "under the woods"
          : steep
            ? "among the rocks of the high ground"
            : "on the open ground";
  return `It keeps ${where} of this land. ${youngWords(d, s.body, s.niche, water)}`;
}

/** When a kind comes, and where it goes, in sentences. */
function comesLines(world: World, s: Species, cell: number): Line[] {
  const ctx = populationContext(world),
    stock = herdStock(ctx, cell);
  if (stock < HERD.least) return [["None of them come through here now."]];
  const pass = herdPass(world, cell),
    r = routeOf(world, cell);
  if (pass.still)
    return [
      ["It keeps to this land the whole year round: there is no season here to send it anywhere."],
    ];
  const windows = passWindows(pass),
    seasons = [...new Set(windows.map(([a, b]) => seasonWords((a + b) / 2, r.byRain)))],
    lastWarm = r.warm[r.warm.length - 1],
    lastCool = r.cool[r.cool.length - 1],
    out: Line[] = [];
  out.push([
    seasons.length > 1
      ? `It comes through here in ${seasons.join(" and again in ")}, and is gone the rest of the year.`
      : `It is here in ${seasons[0] ?? "its season"}, and gone the rest of the year.`,
  ]);
  const end = r.byRain
    ? ["the dry months", "the wet months"]
    : ["the cold of the year", "the warm"];
  if (lastWarm !== undefined)
    out.push([`It goes for ${end[0]} to `, landLink(world, lastWarm, true), "."]);
  if (lastCool !== undefined)
    out.push([`It goes for ${end[1]} to `, landLink(world, lastCool, true), "."]);
  const km = herdWayKm(world, cell);
  if (km >= 100) out.push([`From end to end its way is some ${Math.round(km / 10) * 10} km.`]);
  return out;
}

/** How many a land holds now, against what it has held. */
function holdsWords(world: World, cell: number): string {
  const ctx = populationContext(world),
    store = herdsOf(world),
    now = herdStock(ctx, cell),
    most = Math.max(now, store?.most[cell] ?? now);
  if (now < HERD.least) return "None to speak of";
  const share = most > 0 ? now / most : 1;
  return share >= 0.85
    ? "As many as this land has ever held"
    : share >= 0.5
      ? "More than half what this land once held"
      : share >= 0.25
        ? "Fewer than half what this land once held"
        : "A few, of the many this land once held";
}

/** What has become of a land's creatures: its turns, the herds war took, the beast. */
function fateItems(world: World, cell: number) {
  const ctx = populationContext(world),
    water = ctx.medium === "water",
    store = herdsOf(world);
  if (!store) return [];
  const out = [],
    gone = store.emptied.get(cell),
    grazed = store.grazed.get(cell),
    driven = store.driven.get(cell),
    title = landTitle(world, cell);
  if (gone)
    out.push(
      item(
        [
          `The creatures of ${title} have been gone since about year ${gone.year}: ${herdWhyWords(gone.why, water)}.`,
        ],
        gone.ref,
        gone.year,
      ),
    );
  if (grazed)
    out.push(
      item(
        [`The flocks of ${title} have grazed its pasture down since about year ${grazed.year}.`],
        grazed.ref,
        grazed.year,
      ),
    );
  if (driven) {
    const left = Math.max(0, 1 - (yearNow(world) - driven.year) / HERD_RAID.heal),
      now = Math.round(driven.share * left);
    out.push(
      item(
        [
          `${driven.by} drove off ${driven.share} in a hundred of its ${water ? "pens' shoals" : "herds"} in year ${driven.year}${now > 0 ? `; it is ${now} in a hundred short of them still` : ""}.`,
        ],
        driven.event,
        driven.year,
      ),
    );
  }
  for (const b of store.known)
    if (b.cell === cell)
      out.push(
        item(
          [link(fullName(b), `beast:${b.id}`), ...beastSummary(b)],
          `beast:${b.id}`,
          b.ended ?? b.born,
        ),
      );
  return out;
}

const beastSummary = (b: KnownBeast): Line =>
  b.ended === null
    ? [`, known since year ${b.born}, is still at large.`]
    : b.how === "hunted"
      ? [
          `, known from year ${b.born}, was brought down by ${b.endedBy ?? "those who went after it"} in year ${b.ended}.`,
        ]
      : b.how === "old"
        ? [`, known from year ${b.born}, was found dead of its years in year ${b.ended}.`]
        : b.how === "town"
          ? [
              `, known from year ${b.born}, went untold once there was no one left in ${b.townName} to tell it.`,
            ]
          : [`, known from year ${b.born}, was not seen again after year ${b.ended}.`];

/** A land's page's block of its creatures. */
export function herdBlock(world: World, cell: number): Block | null {
  const g = homePlanet(world).generated;
  if (cell >= g.offworld.base) return null;
  const kinds = kindsOn(world, cell),
    fate = fateItems(world, cell);
  if (!kinds.length && !fate.length) return null;
  const items = [
    ...kinds.map((s) =>
      item(
        [
          link(ownKind(world, cell)?.name ?? s.name, `herd:${cell}:${s.index}`),
          `: ${holdsWords(world, cell).toLowerCase()}.`,
        ],
        `herd:${cell}:${s.index}`,
      ),
    ),
    ...fate,
  ];
  return { type: "list", title: "What goes on this land", items };
}

/** A land's creatures: a kind's page, as it goes on this land. */
export function herdPage(world: World, ref: string): PageModel {
  const g = homePlanet(world).generated,
    year = yearNow(world),
    [, a, b] = ref.split(":"),
    cell = Number(a),
    s = g.life.species[Number(b)];
  if (!s || !Number.isInteger(cell) || cell < 0 || cell >= g.offworld.base)
    return {
      ref,
      kind: "lineage",
      icon: "🐾",
      title: "A creature",
      subtitle: ["Not one anyone can find"],
      color: null,
      place: null,
      stats: [],
      tabs: [
        {
          id: "overview",
          name: "Overview",
          blocks: [{ type: "text", lines: [["No one can say which creature this was."]] }],
        },
      ],
      followable: false,
      year,
    };
  const own = ownKind(world, cell),
    named = own && own.parent === s.index ? own.name : s.name,
    stats: Stat[] = [stat("How many", holdsWords(world, cell))],
    facts: Stat[] = [
      stat("What it is", [
        "Of this world's own tree: ",
        link(s.name, s.ref),
        own && own.parent === s.index
          ? `, grown ${own.how} here, cut off, by year ${own.year}.`
          : ".",
      ]),
      stat("What it eats", eatsLine(world, s, cell)),
      stat("What eats it", eatenLine(world, s, cell)),
      stat("Where it lives", livesLine(world, s, cell)),
    ],
    fate = fateItems(world, cell),
    tabs: Tab[] = [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "facts", title: "This creature", rows: facts },
          { type: "text", title: "When it comes", lines: comesLines(world, s, cell) },
          ...(fate.length
            ? [{ type: "list" as const, title: "What has become of them", items: fate }]
            : []),
        ],
      },
    ];
  return {
    ref,
    kind: "lineage",
    icon: "🐾",
    title: cap(named),
    subtitle: ["On ", landLink(world, cell, true)],
    color: null,
    place: { scale: "region", cell },
    stats,
    tabs,
    followable: false,
    year,
  };
}

/** A beast people know: its page, its deeds, its end. */
export function beastPage(world: World, ref: string): PageModel {
  const ctx = populationContext(world),
    g = ctx.generated,
    year = yearNow(world),
    store = herdsOf(world),
    id = Number(ref.split(":")[1]),
    b = store?.known.find((x) => x.id === id);
  if (!b) {
    return {
      ref,
      kind: "lineage",
      icon: "🐾",
      title: "A beast",
      subtitle: ["No one here has heard of it"],
      color: null,
      place: null,
      stats: [],
      tabs: [
        {
          id: "overview",
          name: "Overview",
          blocks: [{ type: "text", lines: [["No one here has heard of it."]] }],
        },
      ],
      followable: false,
      year,
    };
  }
  const s = g.life.species[b.species]!,
    town = b.town && ctx.settlements.get(b.town),
    water = ctx.medium === "water",
    townSpan = town ? townLink(world, b.town) : b.townName,
    lines: Line[] = [
      [
        "It was one ",
        link(s.name, s.ref),
        ` among the others of its kind, until the people of `,
        townSpan,
        ` came to know it in year ${b.born} and gave it a name.`,
      ],
    ];
  if (b.flocks > 0)
    lines.push([
      water
        ? `For ${b.flocks === 1 ? "a year" : `${b.flocks} years`} it took from their pens and their shoals, and what they ate was the less for it.`
        : `For ${b.flocks === 1 ? "a year" : `${b.flocks} years`} it took from their flocks and from what they hunted, and what they ate was the less for it.`,
    ]);
  if (b.fallen.length)
    lines.push([
      b.fallen.length === 1
        ? `${b.fallen[0]} went out against it, and did not come home.`
        : `${b.fallen.slice(0, -1).join(", ")} and ${b.fallen[b.fallen.length - 1]} went out against it, and did not come home.`,
    ]);
  if (b.after) lines.push([`${b.after} went after it, and kept after it.`]);
  if (b.how === "hunted")
    lines.push([`In year ${b.ended}, ${b.endedBy ?? "those who went after it"} brought it down.`]);
  else if (b.how === "old") lines.push([`In year ${b.ended} it was found dead of its years.`]);
  else if (b.how === "left") lines.push([`After year ${b.ended} no one saw it again.`]);
  else if (b.how === "town")
    lines.push([
      `In year ${b.ended} there was no one left in ${b.townName} to tell of it. It goes on, as a beast does, and no one knows it now.`,
    ]);
  else lines.push(["It is at large still."]);
  const deed = memoryOf(world).byId.get(b.endEvent ?? ""),
    song = deed ? [songRef(deed)] : [],
    stats: Stat[] = [
      stat("Known from", `year ${b.born}`, { why: b.event }),
      stat(
        b.ended === null ? "At large" : "Its end",
        b.ended === null ? `${year - b.born} years so far` : `year ${b.ended}`,
        { why: b.endEvent ?? b.event },
      ),
      stat("Who it took", b.fallen.length ? `${b.fallen.length}` : "No one"),
    ],
    facts: Stat[] = [
      stat("Its kind", [link(s.name, s.ref)]),
      stat("Its town", [townSpan]),
      stat("Its land", [landLink(world, b.cell)]),
      stat("Where it lived", livesLine(world, s, b.cell)),
      stat("What it ate", eatsLine(world, s, b.cell)),
    ];
  return {
    ref,
    kind: "lineage",
    icon: "🐾",
    title: fullName(b),
    subtitle: [cap(thePlain(s.name)), ", known in ", townSpan],
    color: null,
    place: { scale: "region", cell: b.cell },
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          { type: "text", title: "What happened", lines },
          { type: "facts", title: "This beast", rows: facts },
          ...(song.length
            ? [
                {
                  type: "text" as const,
                  title: "What they sing of it",
                  lines: [[link("The song of it", song[0]!)]] as Line[],
                },
              ]
            : []),
        ],
      },
    ],
    followable: false,
    year,
  };
}

/** A lineage's page's block: where it goes on the world in history, what has become of it. */
export function lineageBlock(world: World, index: number): Block | null {
  const ctx = populationContext(world),
    g = ctx.generated,
    s = g.life.species[index],
    store = herdsOf(world);
  if (!s || !store) return null;
  const gone = store.gone.find((k) => k.species === index),
    tame = store.tame.find((k) => k.species === index),
    newOf = store.kinds.filter((k) => k.parent === index),
    known = store.known.filter((b) => b.species === index),
    water = ctx.medium === "water",
    d = s.body ? dwellingOf(s.niche, s.body, s.size, water) : null,
    items = [
      ...(s.body
        ? [
            item([
              `${EATS[s.body.eats] ?? "It eats what its land gives"}${water ? ", on the shelf and in the weed beds" : ""}.`,
            ]),
          ]
        : []),
      ...(d ? [item([youngWords(d, s.body, s.niche, water)])] : []),
      ...(gone
        ? [
            item(
              [
                `It died out in year ${gone.year}, with the last of it on `,
                landLink(world, gone.cell, true),
                gone.why === "hunted"
                  ? ": hunted and driven from every land it had."
                  : ": its ground was gone from every land it had.",
              ],
              gone.event,
              gone.year,
            ),
          ]
        : []),
      ...(tame
        ? [
            item(
              [
                "It was first made tame in year ",
                `${tame.year}`,
                " on ",
                landLink(world, tame.cell, true),
                ".",
              ],
              tame.event,
              tame.year,
            ),
          ]
        : []),
      ...newOf.map((k) =>
        item(
          [
            `The ${k.name} of `,
            landLink(world, k.cell, true),
            ` came of it by year ${k.year}: cut off there, it grew ${k.how}.`,
          ],
          k.event,
          k.year,
        ),
      ),
      ...known.map((b) =>
        item(
          [
            link(fullName(b), `beast:${b.id}`),
            " was of this kind",
            ...beastSummary(b).map((x) => (typeof x === "string" ? x.replace(/^, /, ", and ") : x)),
          ],
          `beast:${b.id}`,
          b.ended ?? b.born,
        ),
      ),
    ];
  return items.length ? { type: "list", title: "In history", items } : null;
}

/** The tree's page's list of what has gone on since the first peoples rose. */
export function treeSinceBlock(world: World): Block | null {
  const ctx = populationContext(world),
    g = ctx.generated,
    store = herdsOf(world);
  if (!store) return null;
  const rows = [
    ...store.kinds.map((k) =>
      item(
        [
          `In year ${k.year} the ${k.name} of `,
          landLink(world, k.cell, true),
          ` stood apart from the `,
          link(g.life.species[k.parent]!.name, g.life.species[k.parent]!.ref),
          `, cut off there, grown ${k.how}.`,
        ],
        k.event,
        k.year,
      ),
    ),
    ...store.gone.map((k) =>
      item(
        [
          `In year ${k.year} the `,
          link(g.life.species[k.species]!.name, g.life.species[k.species]!.ref),
          " died out, on ",
          landLink(world, k.cell, true),
          k.why === "hunted"
            ? ": hunted from the last of its lands."
            : ": the last of its ground gone.",
        ],
        k.event,
        k.year,
      ),
    ),
    ...store.tame.map((k) =>
      item(
        [
          `In year ${k.year} the `,
          link(g.life.species[k.species]!.name, g.life.species[k.species]!.ref),
          " was first made tame, on ",
          landLink(world, k.cell, true),
          ".",
        ],
        k.event,
        k.year,
      ),
    ),
  ].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  return rows.length ? { type: "list", title: "Since the first peoples", items: rows } : null;
}

/** A town's page's line, if a beast is at large on its land or its people have known one. */
export function townBeastStats(world: World, townRef: string): Stat[] {
  const store = herdsOf(world);
  if (!store) return [];
  const mine = store.known.filter((b) => b.town === townRef).slice(-2);
  return mine.map((b) =>
    stat(b.ended === null ? "At large" : "Once known here", [link(fullName(b), `beast:${b.id}`)], {
      why: b.endEvent ?? b.event,
    }),
  );
}

/** What is after a town's flock, and the beast known about it, for its plan. */
export function townWild(
  world: World,
  cell: number,
): { known: KnownBeast | null; hunter: Species | null } {
  const ctx = populationContext(world),
    g = ctx.generated,
    known = herdsOf(world)?.beastOn(cell) ?? null,
    w = wildsOf(ctx, cell),
    hunter = known
      ? g.life.species[known.species]!
      : w.hunter >= 0 && !w.lost.includes(w.hunter) && w.hunters >= 0.1
        ? g.life.species[w.hunter]!
        : null;
  return { known, hunter };
}
