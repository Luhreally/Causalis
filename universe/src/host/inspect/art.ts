// What a page's own drawings are made of (asked 2026-11-13: "lowkey add more graphics and like icons and like stuff for the tabs ...
// make it generative and like derived from first principles ... but it shouldt make the game slower"): the world a page is of, for its
// tabs' glyphs to be drawn in its colours — its kind's seas and ground, its life's pigment, its star's light — and, for a land, a town, a
// realm, a war, a far world or a people, what its banner shows. Pure reads of what the world holds, once a page is read; nothing kept,
// nothing per tick. The interface draws it (ui/page-art.ts) once as the page opens.
import { worldKindOf } from "../../gen/index.ts";
import { hashString, type Ref, type World } from "../../kernel/index.ts";
import type { BannerFigure, PageArt, PageBanner, PageModel, Portrait } from "../../bridge/index.ts";
import { HOME_LEVELS, HOME_STOREYS, OCC } from "../../rules/index.ts";
import {
  designsOf,
  homePlanet,
  politiesOf,
  populationContext,
  townsOf,
  warsOf,
  woodsRead,
} from "../../sim/index.ts";
import { realmArms } from "../arms.ts";
import { lifeLook } from "../biochem.ts";
import { starByRef } from "../galaxy.ts";
import { landEra, landHouse, peopleBody } from "../village.ts";
import { realmArmLook } from "./ware-looks.ts";

/** How many stretches a land's run of ground is told in, west to east. */
const RUN = 17;
/** How many rings of neighbours out the run reaches on each side. */
const REACH = 4;
/** The most of a realm's lands its silhouette is drawn of (a great realm, every other land). */
const LANDS = 400;

/** A page with its art, where it is of a world with a home planet (a toy world's pages stay plain). */
export function withArt(world: World, page: PageModel): PageModel {
  if (!world.storeNames().includes("planet.home") || page.kind === "unknown") return page;
  let banner: PageBanner | null = null;
  try {
    banner = bannerOf(world, page);
  } catch {
    banner = null;
  }
  const art: PageArt = { world: worldArt(world), ...(banner ? { banner } : {}) };
  return { ...page, art };
}

/** A world's kind, its life's colours and its star's warmth. */
function worldArt(world: World): PageArt["world"] {
  const g = homePlanet(world).generated,
    look = lifeLook(g);
  return { kind: worldKindOf(g), ...(look ? { look } : {}), star: g.star.temperature };
}

function bannerOf(world: World, page: PageModel): PageBanner | null {
  switch (page.kind) {
    case "land":
      return page.ref.startsWith("cell:0:") ? landBanner(world, Number(page.ref.slice(7))) : null;
    case "town":
      return townBanner(world, page.ref);
    case "realm":
      return realmBanner(world, page.ref);
    case "war":
      return warBanner(world, page.ref);
    case "world": {
      // (Another star's world, by its star; the home world's own pages draw its globe already.)
      const slash = page.ref.lastIndexOf("/");
      return slash > 0 && page.portrait?.kind === "world"
        ? { kind: "world", star: starByRef(world, page.ref.slice(0, slash)).temperature }
        : null;
    }
    case "civilization": {
      // (A people of another world: the ground and light they rose under, as their look was made of.)
      const p = page.portrait,
        folk = p?.kind === "person" ? p.body?.folk : null;
      return folk ? { kind: "people", star: folk.star, biome: folk.biome } : null;
    }
    default:
      return null;
  }
}

/** A cell's place on the unit sphere. */
function at(world: World, c: number): [number, number, number] {
  const P = homePlanet(world).generated.grid.positions;
  return [P[c * 3]!, P[c * 3 + 1]!, P[c * 3 + 2]!];
}

/**
 * A land's banner: its ground west to east through it, a band a land wide and REACH lands out each way (the mean height of each stretch,
 * its biome the one nearest the line), its woods now, a home of its design and three of its people at their work.
 */
function landBanner(world: World, cell: number): PageBanner | null {
  const g = homePlanet(world).generated,
    grid = g.grid;
  if (!Number.isInteger(cell) || cell < 0 || cell >= grid.count) return null;
  const up = at(world, cell);
  // (East, and north, at the land: on a pole, any way round.)
  let east: [number, number, number] = [up[2], 0, -up[0]];
  const len = Math.hypot(east[0], east[2]);
  east = len > 1e-6 ? [east[0] / len, 0, east[2] / len] : [1, 0, 0];
  const north: [number, number, number] = [
    up[1] * east[2] - up[2] * east[1],
    up[2] * east[0] - up[0] * east[2],
    up[0] * east[1] - up[1] * east[0],
  ];
  // (The lands about it, ring by ring.)
  const seen = new Set([cell]);
  let ring = [cell];
  for (let r = 0; r < REACH; r++) {
    const next: number[] = [];
    for (const c of ring)
      for (let i = grid.offsets[c]!; i < grid.offsets[c + 1]!; i++) {
        const n = grid.neighbours[i]!;
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    ring = next;
  }
  let step = 0;
  for (let i = grid.offsets[cell]!; i < grid.offsets[cell + 1]!; i++) {
    const q = at(world, grid.neighbours[i]!);
    step += Math.hypot(q[0] - up[0], q[1] - up[1], q[2] - up[2]);
  }
  step /= Math.max(1, grid.offsets[cell + 1]! - grid.offsets[cell]!);
  const span = (REACH + 0.5) * step,
    sum = new Float64Array(RUN),
    n = new Float64Array(RUN),
    nearest = new Float64Array(RUN).fill(Infinity),
    biomes = new Array<number>(RUN).fill(-1);
  for (const c of seen) {
    const q = at(world, c),
      d = [q[0] - up[0], q[1] - up[1], q[2] - up[2]],
      u = d[0]! * east[0] + d[1]! * east[1] + d[2]! * east[2],
      v = d[0]! * north[0] + d[1]! * north[1] + d[2]! * north[2];
    if (Math.abs(v) > step * 1.1 || Math.abs(u) > span) continue;
    const b = Math.min(RUN - 1, Math.max(0, Math.floor(((u + span) / (2 * span)) * RUN)));
    sum[b]! += g.tectonics.elevation[c]!;
    n[b]!++;
    if (Math.abs(v) < nearest[b]!) {
      nearest[b] = Math.abs(v);
      biomes[b] = g.climate.biome[c]!;
    }
  }
  const heights: number[] = [];
  for (let b = 0; b < RUN; b++) heights.push(n[b]! ? sum[b]! / n[b]! : NaN);
  // (A stretch no land's middle fell in takes its neighbours' mean.)
  for (let b = 0; b < RUN; b++)
    if (Number.isNaN(heights[b]!)) {
      let l = b - 1,
        r = b + 1;
      while (l >= 0 && Number.isNaN(heights[l]!)) l--;
      while (r < RUN && Number.isNaN(heights[r]!)) r++;
      const a = l >= 0 ? heights[l]! : heights[r]!,
        z = r < RUN ? heights[r]! : a;
      heights[b] = Number.isNaN(a) ? 0 : (a + z) / 2;
      biomes[b] = biomes[l >= 0 ? l : Math.min(RUN - 1, r)] ?? g.climate.biome[cell]!;
    }
  // (The land itself at the middle of its run, as high as it stands.)
  heights[RUN >> 1] = g.tectonics.elevation[cell]!;
  biomes[RUN >> 1] = g.climate.biome[cell]!;
  const ctx = populationContext(world),
    land = ctx.provinces.get(cell),
    people = land ? land.total() : 0,
    folk: BannerFigure[] = [];
  if (land && people > 0) {
    // (Its commonest work, a child and an elder.)
    let best: number = OCC.forager,
      most = -1;
    for (let o = 1; o < 7; o++)
      if (land.occupation(o) > most) {
        most = land.occupation(o);
        best = o;
      }
    folk.push(
      { age: 32, occupation: best, child: false },
      { age: 9, occupation: OCC.dependent, child: true },
      { age: 64, occupation: best, child: false },
    );
  }
  return {
    kind: "land",
    heights: heights.map((h) => Math.round(h)),
    biomes,
    here: 0.5,
    woods: Math.round(woodsRead(ctx, cell).now * 100) / 100,
    house: land && people > 0 ? landHouse(world, cell) : null,
    era: land ? landEra(world, cell) : "forage",
    body: peopleBody(world),
    folk,
    key: hashString(`land:${cell}`) >>> 0,
  };
}

/** A town's banner: its homes as they stand at each level, its other buildings standing, its walls. */
function townBanner(world: World, ref: string): PageBanner | null {
  const s = populationContext(world).settlements.get(ref as Ref),
    f = townsOf(world).get(ref as Ref);
  if (!s) return null;
  const g = homePlanet(world).generated;
  const levels = HOME_LEVELS.map((_, l) => f?.homes[l] ?? 0);
  // (A town no fabric is kept for yet: its people's homes, five to a hut.)
  if (!f) levels[0] = Math.max(3, Math.round(s.population / 5));
  return {
    kind: "town",
    house: landHouse(world, s.cell),
    levels,
    civics: [
      ...new Set((f?.civics ?? []).filter((c) => c.fell === null).map((c) => c.kind as string)),
    ],
    walls: !!f?.walls,
    biome: g.climate.biome[s.cell] ?? 9,
    key: hashString(ref) >>> 0,
  };
}

/** A realm's banner: its arms over the shape of its lands, its seat's first. */
function realmBanner(world: World, ref: string): PageBanner | null {
  const r = politiesOf(world).get(ref as Ref),
    arms = r ? realmArms(world, r.ref) : null;
  if (!r || !arms || !r.members.length) return null;
  const g = homePlanet(world).generated,
    grid = g.grid,
    seat = r.members.includes(r.seat) ? r.seat : r.members[0]!,
    lat0 = grid.lat[seat]!,
    lon0 = grid.lon[seat]!,
    k = Math.cos(lat0),
    cells = [seat, ...r.members.filter((c) => c !== seat && c < grid.count)],
    every = Math.max(1, Math.ceil(cells.length / LANDS)),
    pts: number[] = [];
  for (let i = 0; i < cells.length; i += i === 0 ? 1 : every) {
    const c = cells[i]!;
    let dl = grid.lon[c]! - lon0;
    if (dl > Math.PI) dl -= 2 * Math.PI;
    if (dl < -Math.PI) dl += 2 * Math.PI;
    pts.push(dl * k, -(grid.lat[c]! - lat0));
  }
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]!);
    maxX = Math.max(maxX, pts[i]!);
    minY = Math.min(minY, pts[i + 1]!);
    maxY = Math.max(maxY, pts[i + 1]!);
  }
  // (A land's width on the grid, in radians: its shape's least size, so one land is a dot, not the whole box.)
  const land = Math.sqrt((4 * Math.PI) / grid.count),
    size = Math.max(maxX - minX, maxY - minY, land * 3),
    scale = 1000 / size,
    cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  return {
    kind: "realm",
    arms,
    lands: pts.map((v, i) => Math.round(500 + (v - (i % 2 ? cy : cx)) * scale)),
    step: Math.round(land * every ** 0.5 * scale),
  };
}

/** A war's banner: its two sides, each its arms and the arm its host carries; the ground of the attacker's seat. */
function warBanner(world: World, ref: string): PageBanner | null {
  const w = warsOf(world).get(ref as Ref);
  if (!w) return null;
  const sides = [w.attacker, w.defender].map((realm) => {
    const arms = realmArms(world, realm);
    let arm: Portrait | null = null;
    try {
      arm = realmArmLook(world, realm);
    } catch {
      arm = null;
    }
    return arms ? { arms, arm } : null;
  });
  if (!sides[0] || !sides[1]) return null;
  const seat = politiesOf(world).get(w.attacker)?.seat ?? -1,
    g = homePlanet(world).generated;
  return {
    kind: "war",
    sides: [sides[0], sides[1]],
    biome: seat >= 0 && seat < g.grid.count ? g.climate.biome[seat]! : 9,
  };
}

/**
 * How a land builds, as a picture (asked 2026-11-13: "will i see the photo of like their architectural varying styles across seeds?"):
 * the house its towns raise, read as the town in 3D reads it (landHouse: its design's walls, roof, plan and pitch), as many storeys as
 * its towns' homes stand most often. None: a land no one keeps.
 */
export function homeLook(world: World, cell: number): Portrait | null {
  const ctx = populationContext(world);
  if (!ctx.provinces.get(cell)?.total()) return null;
  const levels = HOME_LEVELS.map(() => 0),
    towns = townsOf(world);
  for (const s of ctx.settlements.seenIn(cell)) {
    const f = towns.get(s.ref);
    if (f) f.homes.forEach((n, l) => (levels[l]! += n));
  }
  const most = levels.indexOf(Math.max(...levels)),
    look = lifeLook(homePlanet(world).generated);
  return {
    kind: "house",
    house: landHouse(world, cell),
    storeys: HOME_STOREYS[Math.max(0, most)] ?? 1,
    key: hashString(`house:${cell}`) >>> 0,
    ...(look ? { lifeLook: look } : {}),
  };
}

/** A land's works as a picture: its works design's hall, of its material, and what drives it (none: a land with no works). */
export function worksLook(world: World, cell: number): Portrait | null {
  const land = populationContext(world).provinces.get(cell),
    d = land ? designsOf(world).worksOf(land.ref) : undefined,
    hall = d?.parts.find((p) => p.role === "hall"),
    drive = d?.parts.find((p) => p.role === "drive");
  return hall
    ? {
        kind: "works",
        hall: hall.id,
        material: hall.material,
        drive: drive?.id ?? "hands",
        key: hashString(`works:${cell}`) >>> 0,
      }
    : null;
}
