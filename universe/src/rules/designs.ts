// The design grammar (docs/architecture §22): everything built is one kernel. A
// Design is a set of components by role, each a *realization* — something a people
// know how to make, made of what their land gives. Its performance comes from its
// components by simple laws (a blade's shock grows with its metal's edge; a wall's
// warmth with its mass), and a doctrine — weights over the performance axes, drawn
// from the people's land and ways — picks each role's component greedily, with no
// search. v1 builds two kinds: the house a land's people live in, and the host a
// realm goes to war with; Phase 3 adds a third, the works a land's crafts are done in
// and what drives them.

import { affordancesOf, type BodyPlan } from "./bodies.ts";

export const MATERIALS = [
  "wood",
  "reed",
  "hide",
  "earth",
  "mud",
  "sod",
  "stone",
  "fired clay",
  "copper",
  "bronze",
  "iron",
  "steel",
  /** Fuels, at hand where a land digs or draws them, or has them in store. */
  "coal",
  "oil",
  /** The sea's (Phase 4 M40): coral of warm reefs, shell, kelp of cooler shelves. */
  "coral",
  "shell",
  "kelp",
  /** A body's own: its claws, its shell (Phase 4 M41). */
  "body",
] as const;
export type Material = (typeof MATERIALS)[number];

/** A material's worth in a blade or point (edge), in armour (guard), in a wall (mass), its lasting, and its cost. */
export const MATERIAL: Readonly<
  Record<Material, { edge: number; guard: number; mass: number; lasting: number; cost: number }>
> = {
  wood: { edge: 0.15, guard: 0.1, mass: 0.35, lasting: 0.35, cost: 0.1 },
  reed: { edge: 0.05, guard: 0.08, mass: 0.15, lasting: 0.2, cost: 0.05 },
  hide: { edge: 0, guard: 0.15, mass: 0.1, lasting: 0.15, cost: 0.1 },
  earth: { edge: 0, guard: 0, mass: 0.7, lasting: 0.4, cost: 0.1 },
  /** Earth that sun-dries into brick: where it is warm and not too wet. */
  mud: { edge: 0, guard: 0, mass: 0.75, lasting: 0.5, cost: 0.1 },
  /** Turf: where grass grows thick in the cool and wet. */
  sod: { edge: 0, guard: 0, mass: 0.6, lasting: 0.45, cost: 0.08 },
  stone: { edge: 0.4, guard: 0, mass: 0.9, lasting: 0.95, cost: 0.5 },
  "fired clay": { edge: 0, guard: 0, mass: 0.75, lasting: 0.75, cost: 0.35 },
  copper: { edge: 0.5, guard: 0.3, mass: 0, lasting: 0.5, cost: 0.6 },
  bronze: { edge: 0.7, guard: 0.5, mass: 0, lasting: 0.7, cost: 0.8 },
  iron: { edge: 0.8, guard: 0.6, mass: 0, lasting: 0.75, cost: 0.5 },
  steel: { edge: 1, guard: 0.8, mass: 0, lasting: 0.9, cost: 0.7 },
  coal: { edge: 0, guard: 0, mass: 0, lasting: 0, cost: 0.2 },
  oil: { edge: 0, guard: 0, mass: 0, lasting: 0, cost: 0.3 },
  coral: { edge: 0.2, guard: 0.3, mass: 0.8, lasting: 0.9, cost: 0.2 },
  shell: { edge: 0.35, guard: 0.45, mass: 0.5, lasting: 0.7, cost: 0.1 },
  kelp: { edge: 0, guard: 0.05, mass: 0.2, lasting: 0.2, cost: 0.03 },
  body: { edge: 0, guard: 0, mass: 0, lasting: 1, cost: 0 },
};

export const HOST_AXES = ["shock", "reach", "range", "protection", "mobility", "cost"] as const;
export const HOUSE_AXES = [
  "warmth",
  "cool",
  "shedding",
  "lasting",
  "room",
  "mobile",
  /** Living many together; living up off the ground (Phase 4 M40). */
  "together",
  "high",
  "cost",
] as const;
export const WORKS_AXES = ["output", "lasting", "cost"] as const;
export type Axis =
  (typeof HOST_AXES)[number] | (typeof HOUSE_AXES)[number] | (typeof WORKS_AXES)[number];
export type Performance = Partial<Record<Axis, number>>;

export const HOST_ROLES = ["arm", "guard", "mount"] as const;
export const HOUSE_ROLES = ["walls", "roof", "form"] as const;
export const WORKS_ROLES = ["hall", "drive"] as const;
export type Role =
  (typeof HOST_ROLES)[number] | (typeof HOUSE_ROLES)[number] | (typeof WORKS_ROLES)[number];

export type Realization = {
  readonly id: string;
  readonly role: Role;
  /** Principles all of which must be known. */
  readonly needs: readonly string[];
  /** The bodies it is for alone (diggers burrow, the feathered nest; absent: any). */
  readonly fits?: (b: BodyPlan) => boolean;
  /** What it asks of any body that would use it (a grip for a spear; to be small enough to ride). */
  readonly asks?: (b: BodyPlan) => boolean;
  /** What it may be made of (the doctrine's best of those at hand is used). */
  readonly materials: readonly Material[];
  /** Its words, made of a material: "bronze swords". */
  readonly words: (m: Material) => string;
  /** What it does, made of a material. */
  readonly does: (m: Material) => Performance;
};

const R = (
  id: string,
  role: Role,
  needs: string[],
  materials: Material[],
  words: (m: Material) => string,
  does: (m: Material) => Performance,
  fits?: (b: BodyPlan) => boolean,
  asks?: (b: BodyPlan) => boolean,
): Realization => ({
  id,
  role,
  needs,
  materials,
  words,
  does,
  ...(fits ? { fits } : {}),
  ...(asks ? { asks } : {}),
});

/** Bodies that dig; that live as a hive; the feathered; four-handed climbers; giants; the sea's. */
const digs = (b: BodyPlan) =>
    b.medium !== "water" && (b.manipulators === "claws" || b.manipulators === "mandibles"),
  hive = (b: BodyPlan) => b.social >= 0.9 && b.size < 100 && b.medium !== "water",
  feathered = (b: BodyPlan) => b.skin === "feathers",
  climbs = (b: BodyPlan) => b.manipulators === "hands" && b.limbs >= 4 && b.medium === "land",
  giant = (b: BodyPlan) => b.size >= 300,
  sea = (b: BodyPlan) => b.medium === "water",
  seaOrShore = (b: BodyPlan) => b.medium !== "land",
  // Axes and swords want hands (or arms) deft enough to wield them; a spear, a grip.
  wields = (b: BodyPlan) => affordancesOf(b).dexterity >= 0.6,
  grips = (b: BodyPlan) => affordancesOf(b).dexterity >= 0.5;

export const REALIZATIONS: readonly Realization[] = [
  // The host: what it strikes with, what guards it, what carries it.
  R(
    "club",
    "arm",
    [],
    ["wood"],
    () => "clubs",
    () => ({ shock: 0.3, reach: 0.2, cost: 0.05 }),
  ),
  R(
    "spear",
    "arm",
    [],
    ["stone", "copper", "bronze", "iron", "steel"],
    (m) => (m === "stone" ? "stone-tipped spears" : `${m}-tipped spears`),
    (m) => ({
      shock: 0.3 + 0.35 * MATERIAL[m].edge,
      reach: 0.6,
      cost: 0.05 + 0.2 * MATERIAL[m].cost,
    }),
    undefined,
    grips,
  ),
  R(
    "axe",
    "arm",
    ["metalworking"],
    ["copper", "bronze", "iron", "steel"],
    (m) => `${m} axes`,
    (m) => ({
      shock: 0.35 + 0.5 * MATERIAL[m].edge,
      reach: 0.3,
      cost: 0.1 + 0.3 * MATERIAL[m].cost,
    }),
    undefined,
    wields,
  ),
  R(
    "sword",
    "arm",
    ["bronze"],
    ["bronze", "iron", "steel"],
    (m) => `${m} swords`,
    (m) => ({
      shock: 0.4 + 0.6 * MATERIAL[m].edge,
      reach: 0.35,
      cost: 0.2 + 0.4 * MATERIAL[m].cost,
    }),
    undefined,
    wields,
  ),
  R(
    "bow",
    "arm",
    ["archery"],
    ["wood"],
    () => "bows",
    () => ({ shock: 0.15, range: 0.6, cost: 0.1 }),
  ),
  R(
    "horn-bow",
    "arm",
    ["archery", "tanning", "dairying"],
    ["hide"],
    () => "bows of horn and sinew",
    () => ({ shock: 0.2, range: 0.8, cost: 0.2 }),
  ),
  // A body's own weapons and guard, and the host of a people of the water.
  R(
    "claws",
    "arm",
    [],
    ["body"],
    () => "claws",
    () => ({ shock: 0.55, reach: 0.1, cost: 0 }),
    (b) => b.manipulators === "claws",
  ),
  R(
    "mandibles",
    "arm",
    [],
    ["body"],
    () => "mandibles",
    () => ({ shock: 0.55, reach: 0.05, cost: 0 }),
    (b) => b.manipulators === "mandibles",
  ),
  R(
    "tusks",
    "arm",
    [],
    ["body"],
    () => "tusks and trunks",
    () => ({ shock: 0.7, reach: 0.25, cost: 0 }),
    (b) => b.manipulators === "trunk",
  ),
  R(
    "grapple",
    "arm",
    [],
    ["body"],
    () => "grasping arms",
    () => ({ shock: 0.45, reach: 0.35, cost: 0 }),
    (b) => b.manipulators === "tentacles",
  ),
  R(
    "shell-darts",
    "arm",
    ["shell-craft"],
    ["shell"],
    () => "darts of shell",
    () => ({ shock: 0.15, range: 0.45, cost: 0.05 }),
    (b) => b.medium === "water",
  ),
  R(
    "own-shell",
    "guard",
    [],
    ["body"],
    () => "their own shells",
    () => ({ protection: 0.6, cost: 0 }),
    (b) => b.skin === "shell",
  ),
  R(
    "own-scales",
    "guard",
    [],
    ["body"],
    () => "their own scales",
    () => ({ protection: 0.35, cost: 0 }),
    (b) => b.skin === "scales",
  ),
  R(
    "shell-plates",
    "guard",
    ["shell-craft"],
    ["shell"],
    () => "plates of shell",
    () => ({ protection: 0.45, cost: 0.1 }),
    (b) => b.medium !== "land",
  ),
  R(
    "swimming",
    "mount",
    [],
    ["body"],
    () => "swimming",
    () => ({ mobility: 0.6 }),
    (b) => b.medium === "water",
  ),
  R(
    "bare",
    "guard",
    [],
    ["hide"],
    () => "no armour",
    () => ({}),
  ),
  R(
    "shield",
    "guard",
    [],
    ["hide", "reed", "wood"],
    (m) => (m === "reed" ? "wicker shields" : `${m} shields`),
    (m) => ({ protection: 0.05 + MATERIAL[m].guard, cost: 0.03 }),
  ),
  R(
    "leather",
    "guard",
    ["tanning"],
    ["hide"],
    () => "leather armour",
    () => ({ protection: 0.3, cost: 0.1 }),
  ),
  R(
    "scale",
    "guard",
    ["bronze"],
    ["bronze", "iron"],
    (m) => `${m} scale`,
    (m) => ({ protection: 0.1 + 0.6 * MATERIAL[m].guard, cost: 0.2 + 0.3 * MATERIAL[m].cost }),
  ),
  R(
    "mail",
    "guard",
    ["iron"],
    ["iron", "steel"],
    (m) => `${m} mail`,
    (m) => ({ protection: 0.2 + 0.6 * MATERIAL[m].guard, cost: 0.3 + 0.3 * MATERIAL[m].cost }),
  ),
  R(
    "plate",
    "guard",
    ["steel"],
    ["steel"],
    () => "steel plate",
    () => ({ protection: 0.85, mobility: -0.1, cost: 0.6 }),
  ),
  R(
    "foot",
    "mount",
    [],
    ["hide"],
    () => "on foot",
    () => ({ mobility: 0.2 }),
    undefined,
    (b) => b.medium !== "water",
  ),
  R(
    "chariot",
    "mount",
    ["chariots"],
    ["wood"],
    () => "in chariots",
    () => ({ mobility: 0.55, shock: 0.15, cost: 0.35 }),
    undefined,
    (b) => b.size < 300,
  ),
  R(
    "horse",
    "mount",
    ["riding"],
    ["hide"],
    () => "on horseback",
    () => ({ mobility: 0.75, shock: 0.08, cost: 0.3 }),
    undefined,
    (b) => b.size < 300,
  ),
  R(
    "cavalry",
    "mount",
    ["cavalry"],
    ["hide"],
    () => "as horsemen in ranks",
    () => ({ mobility: 0.8, shock: 0.2, cost: 0.35 }),
    undefined,
    (b) => b.size < 300,
  ),

  // The house: its walls, its roof, its shape.
  R(
    "tent",
    "walls",
    [],
    ["hide"],
    () => "tents of hide",
    () => ({ warmth: 0.3, cool: 0.2, lasting: 0.1, room: 0.3, mobile: 1, cost: 0.08 }),
  ),
  R(
    "wattle",
    "walls",
    ["cultivation"],
    ["wood"],
    () => "wattle and daub",
    () => ({ warmth: 0.5, cool: 0.4, lasting: 0.4, room: 0.5, cost: 0.12 }),
  ),
  R(
    "timber",
    "walls",
    ["carpentry"],
    ["wood"],
    () => "timber",
    () => ({ warmth: 0.65, cool: 0.3, lasting: 0.6, room: 0.7, cost: 0.3 }),
  ),
  R(
    "mudbrick",
    "walls",
    ["cultivation"],
    ["mud"],
    () => "mud brick",
    () => ({ warmth: 0.5, cool: 0.85, lasting: 0.5, room: 0.6, cost: 0.12 }),
  ),
  R(
    "brick",
    "walls",
    ["pottery-wheel"],
    ["fired clay"],
    () => "fired brick",
    () => ({ warmth: 0.6, cool: 0.75, lasting: 0.8, room: 0.7, cost: 0.35 }),
  ),
  R(
    "stone",
    "walls",
    ["masonry"],
    ["stone"],
    () => "stone",
    () => ({ warmth: 0.7, cool: 0.8, lasting: 0.95, room: 0.7, cost: 0.5 }),
  ),
  R(
    "reef-walls",
    "walls",
    ["reef-building"],
    ["coral"],
    () => "reefs grown into walls",
    () => ({ warmth: 0.3, cool: 0.5, lasting: 0.95, room: 0.7, cost: 0.15 }),
    sea,
  ),
  R(
    "shell-walls",
    "walls",
    [],
    ["shell"],
    () => "walls of stacked shell",
    () => ({ warmth: 0.4, cool: 0.5, lasting: 0.6, room: 0.5, cost: 0.08 }),
    seaOrShore,
  ),
  R(
    "burrow",
    "walls",
    [],
    ["earth"],
    () => "burrows dug in the earth",
    () => ({ warmth: 0.7, cool: 0.8, lasting: 0.6, room: 0.4, cost: 0.03 }),
    digs,
  ),
  R(
    "thatch",
    "roof",
    [],
    ["reed"],
    () => "thatched roofs",
    () => ({ shedding: 0.75, warmth: 0.45, lasting: 0.3, cost: 0.08 }),
  ),
  R(
    "turf",
    "roof",
    [],
    ["sod"],
    () => "roofs of turf",
    () => ({ warmth: 0.85, shedding: 0.5, lasting: 0.45, cost: 0.08 }),
  ),
  R(
    "flat",
    "roof",
    ["cultivation"],
    ["mud"],
    () => "flat roofs of packed earth",
    // It keeps the heat out, and the rain in: where rain must be shed it is a poor roof.
    () => ({ cool: 0.7, shedding: -0.3, lasting: 0.4, room: 0.3, cost: 0.08 }),
  ),
  R(
    "tile",
    "roof",
    ["pottery-wheel"],
    ["fired clay"],
    () => "tiled roofs",
    () => ({ shedding: 0.9, lasting: 0.8, warmth: 0.4, cost: 0.3 }),
  ),
  R(
    "vault",
    "roof",
    ["arches"],
    ["stone", "fired clay"],
    () => "vaulted roofs",
    () => ({ lasting: 0.95, cool: 0.6, shedding: 0.5, room: 0.3, cost: 0.45 }),
  ),
  R(
    "kelp-canopy",
    "roof",
    [],
    ["kelp"],
    () => "canopies of woven kelp",
    () => ({ warmth: 0.15, lasting: 0.2, cost: 0.03 }),
    sea,
  ),
  R(
    "open",
    "roof",
    [],
    ["coral", "shell", "earth"],
    () => "open to the water above",
    () => ({ room: 0.1, cost: 0 }),
    sea,
  ),
  R(
    "mound",
    "roof",
    [],
    ["earth"],
    () => "mounds of earth over them",
    () => ({ shedding: 0.7, warmth: 0.6, lasting: 0.6, cost: 0.03 }),
    digs,
  ),
  R(
    "round",
    "form",
    [],
    ["earth"],
    () => "round",
    () => ({ room: 0.35, warmth: 0.15, cost: 0.05 }),
  ),
  R(
    "long",
    "form",
    ["cultivation"],
    ["wood"],
    () => "long",
    () => ({ room: 0.65, warmth: 0.25, cost: 0.15 }),
  ),
  R(
    "court",
    "form",
    ["cultivation"],
    ["mud", "fired clay", "stone"],
    () => "built around courtyards",
    () => ({ room: 0.6, cool: 0.5, cost: 0.3 }),
  ),
  R(
    "warren",
    "form",
    [],
    ["coral", "shell", "earth"],
    () => "warrens of many chambers",
    () => ({ room: 0.5, together: 0.9, warmth: 0.2, cost: 0.05 }),
    (b) => sea(b) || digs(b),
  ),
  R(
    "shell-tower",
    "form",
    ["reef-building"],
    ["coral", "shell"],
    () => "towers rising toward the light",
    () => ({ room: 0.7, high: 0.8, together: 0.5, cost: 0.3 }),
    sea,
  ),
  R(
    "hive",
    "form",
    ["cultivation"],
    ["earth", "mud"],
    () => "great hives of a thousand cells",
    () => ({ room: 0.6, together: 1, warmth: 0.4, cost: 0.15 }),
    hive,
  ),
  R(
    "nest",
    "form",
    [],
    ["reed", "wood"],
    () => "raised nests",
    () => ({ room: 0.35, high: 0.6, warmth: 0.3, cost: 0.05 }),
    feathered,
  ),
  R(
    "tree-house",
    "form",
    [],
    ["wood"],
    () => "on platforms in the trees",
    () => ({ room: 0.4, high: 1, cool: 0.3, cost: 0.06 }),
    climbs,
  ),
  R(
    "great-hall",
    "form",
    ["cultivation"],
    ["wood", "stone", "mud", "fired clay"],
    () => "great halls with high doors",
    () => ({ room: 1, together: 0.5, cost: 0.35 }),
    giant,
  ),
  // The works: the hall the crafts are done in, and what drives them.
  R(
    "workshop",
    "hall",
    [],
    ["wood", "mud", "fired clay", "stone", "coral", "shell"],
    (m) => `workshops of ${m === "fired clay" ? "brick" : m}`,
    (m) => ({
      output: 0.1,
      lasting: MATERIAL[m].lasting * 0.5,
      cost: 0.05 + 0.1 * MATERIAL[m].cost,
    }),
  ),
  R(
    "mill-house",
    "hall",
    ["mills"],
    ["wood", "stone"],
    (m) => `mill-houses of ${m}`,
    (m) => ({
      output: 0.25,
      lasting: MATERIAL[m].lasting * 0.6,
      cost: 0.1 + 0.15 * MATERIAL[m].cost,
    }),
  ),
  R(
    "factory",
    "hall",
    ["factories"],
    ["fired clay", "stone", "iron"],
    (m) => `${m === "fired clay" ? "brick" : m} factories with tall chimneys`,
    (m) => ({
      output: 0.5,
      lasting: MATERIAL[m].lasting * 0.8,
      cost: 0.2 + 0.2 * MATERIAL[m].cost,
    }),
  ),
  R(
    "steel-hall",
    "hall",
    ["electricity", "steel"],
    ["steel"],
    () => "steel-framed works halls",
    () => ({ output: 0.7, lasting: 0.8, cost: 0.35 }),
  ),
  R(
    "hands",
    "drive",
    [],
    ["wood"],
    () => "worked by hand",
    () => ({ output: 0.1, cost: 0 }),
  ),
  R(
    "wheel-and-sail",
    "drive",
    ["mills"],
    ["wood"],
    () => "driven by wind and water",
    () => ({ output: 0.3, cost: 0.1 }),
  ),
  R(
    "steam",
    "drive",
    ["steam-engine"],
    ["coal"],
    () => "driven by steam engines fired with coal",
    (m) => ({ output: 0.7, cost: 0.15 + MATERIAL[m].cost }),
  ),
  R(
    "electric",
    "drive",
    ["electricity"],
    ["coal", "oil"],
    (m) => `run by electric motors, their power raised with ${m}`,
    (m) => ({ output: 0.9, cost: 0.2 + MATERIAL[m].cost }),
  ),
  R(
    "current-turbines",
    "drive",
    ["current-mills"],
    ["steel", "iron", "stone", "earth"],
    () => "turned by turbines the tides drive",
    () => ({ output: 0.8, cost: 0.2 }),
  ),
  R(
    "vent-engines",
    "drive",
    ["vent-heat"],
    ["steel", "iron", "stone", "earth"],
    () => "driven by the heat of the vents",
    () => ({ output: 0.85, cost: 0.2 }),
  ),
  R(
    "oil-engine",
    "drive",
    ["engines"],
    ["oil"],
    () => "driven by engines that burn oil",
    (m) => ({ output: 0.8, cost: 0.15 + MATERIAL[m].cost }),
  ),
];

/** Weights over the performance axes: what a people want of what they build. */
export type Doctrine = Partial<Record<Axis, number>>;

export type Part = { readonly role: Role; readonly id: string; readonly material: Material };

/** The value of a performance under a doctrine (cost counts against). */
export function worth(does: Performance, doctrine: Doctrine): number {
  let v = 0;
  for (const [axis, x] of Object.entries(does) as [Axis, number][])
    v += (axis === "cost" ? -1 : 1) * (doctrine[axis] ?? 0) * x;
  return v;
}

/**
 * Build a design: for each role, of the realizations whose principles are known and one
 * of whose materials is at hand, the one the doctrine values most (ties: the order of
 * the grammar, then of its materials). Greedy, role by role, no search.
 */
export function compose(
  roles: readonly Role[],
  knows: (principle: string) => boolean,
  has: (m: Material) => boolean,
  doctrine: Doctrine,
  body?: BodyPlan,
): Part[] {
  const parts: Part[] = [];
  for (const role of roles) {
    let best: { part: Part; value: number } | null = null;
    for (const r of REALIZATIONS) {
      if (r.role !== role || !r.needs.every(knows)) continue;
      // A realization for particular bodies is for those alone; one that asks something
      // of a body is for the bodies that can.
      if (r.fits && !(body && r.fits(body))) continue;
      if (r.asks && body && !r.asks(body)) continue;
      for (const m of r.materials) {
        if (!has(m)) continue;
        const value = worth(r.does(m), doctrine);
        if (!best || value > best.value + 1e-12)
          best = { part: { role, id: r.id, material: m }, value };
      }
    }
    if (best) parts.push(best.part);
  }
  return parts;
}

/** A design's performance: the sum of its parts'. */
export function performanceOf(parts: readonly Part[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of parts)
    for (const [axis, x] of Object.entries(realization(p.id).does(p.material)))
      out[axis] = (out[axis] ?? 0) + x;
  return out;
}

export function realization(id: string): Realization {
  const r = REALIZATIONS.find((x) => x.id === id);
  if (!r) throw new Error(`no realization ${id}`);
  return r;
}

/** How much stronger a host fights than one with clubs, bare and on foot. */
export function hostPower(parts: readonly Part[]): number {
  const p = performanceOf(parts);
  return (
    1 +
    1.0 * ((p.shock ?? 0) - 0.3) +
    0.6 * (p.range ?? 0) +
    0.9 * (p.protection ?? 0) +
    0.5 * ((p.mobility ?? 0) - 0.2)
  );
}

/** A design in words: "bronze swords and leather armour, on foot"; "mud brick, flat roofs of packed earth, built around courtyards". */
export function designWords(parts: readonly Part[]): string {
  const say = (role: Role) => {
    const p = parts.find((x) => x.role === role);
    return p ? realization(p.id).words(p.material) : "";
  };
  if (parts.some((p) => p.role === "arm")) {
    const guard = parts.find((p) => p.role === "guard");
    return `${say("arm")}${guard && guard.id !== "bare" ? ` and ${say("guard")}` : ""}, ${say("mount")}`;
  }
  if (parts.some((p) => p.role === "hall")) return `${say("hall")}, ${say("drive")}`;
  if (parts.some((p) => p.id === "tent")) return "tents of hide";
  const form = say("form"),
    roof = parts.find((x) => x.role === "roof");
  return `houses of ${say("walls")}${roof?.id === "open" ? ", open to the water above" : roof ? ` with ${say("roof")}` : ""}${form === "round" ? ", round" : form === "long" ? ", long" : form ? `, ${form}` : ""}`;
}

/** How steep a roof is, in degrees, by its kind and the rain it sheds. */
export function roofPitch(roof: string, rain: number): number {
  if (roof === "flat") return 3;
  if (roof === "vault") return 12;
  if (roof === "turf") return 30;
  if (roof === "tile") return Math.min(45, 25 + rain / 100);
  return Math.min(55, 35 + rain / 120);
}
