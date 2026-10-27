// What a people's look is made of (Phase 34 M176, asked for 2026-10-24: "the people or like humans
// of the aliens worlds all look the same the people dont like procedurally made of the world etc
// or have an alien look"): gathered from the world as it was made — a key of their own (its
// digest's), its pull and its star's warmth, the warmth, rain and ground of the land they rose in,
// and what their forebears grew, as the tree of life has them — for the view to make their look
// of. Earth's people are its upright apes, as ever: none. Their body as the figures are drawn from
// it, the one copy every plan carries (a town's, a camp's, the genesis's, a person's page).
import { hashString } from "../kernel/index.ts";
import { treeOfLife, type HomeWorld } from "../gen/index.ts";
import type { BodyPlan } from "../rules/index.ts";
import type { FolkFacts, VillagePlan } from "../bridge/index.ts";
import { folkLife } from "./biochem.ts";

/** What has been gathered, by world (a few worlds at most are open at once). */
const GATHERED = new Map<string, FolkFacts | null>();

/** What the people of a world's look is made of (null: Earth's, or a world no people rose on). */
export function folkFacts(g: HomeWorld): FolkFacts | null {
  const known = GATHERED.get(g.digest);
  if (known !== undefined) return known;
  const people = g.life.people;
  let facts: FolkFacts | null = null;
  if (people && g.prior !== "earthlike") {
    // (Their forebears: the line the tree of life has them come of.)
    const tree = treeOfLife(g),
      them = tree.nodes.find((n) => n.kind === "people"),
      fore = them && them.parent >= 0 ? tree.nodes[them.parent]?.genome : null,
      cell = people.cell;
    facts = {
      key: hashString(`${g.digest} folk`) >>> 0,
      gravity: g.planet.gravity,
      star: g.star.temperature,
      warmth: g.climate.temperature[cell] ?? 15,
      rain: g.climate.precipitation[cell] ?? 800,
      biome: g.climate.biome[cell] ?? 0,
      forebears: fore
        ? {
            neck: fore.neck,
            tail: fore.tail,
            grows: [...fore.grows],
            eyes: fore.eyes,
            feelers: fore.feelers,
            pattern: fore.pattern,
            covering: fore.skin,
            legs: fore.legs,
          }
        : null,
      // (Their blood, and their world's life's colours: Phase 57.)
      ...folkLife(g),
    };
  }
  if (GATHERED.size >= 8) GATHERED.delete(GATHERED.keys().next().value!);
  GATHERED.set(g.digest, facts);
  return facts;
}

/** A body as the figures are drawn from it, and what its look is made of. */
export function figureBody(b: BodyPlan, folk: FolkFacts | null): NonNullable<VillagePlan["body"]> {
  return {
    clade: b.clade,
    medium: b.medium,
    symmetry: b.symmetry,
    manipulators: b.manipulators,
    limbs: b.limbs,
    skin: b.skin,
    size: b.size,
    span: b.span,
    folk,
  };
}

/** A world's people's body as their figures are drawn from it (null: no people rose there). */
export function peopleFigure(g: HomeWorld): VillagePlan["body"] {
  const b = g.life.people?.body;
  return b ? figureBody(b, folkFacts(g)) : null;
}

/**
 * What the look of a people of another star is made of: their world's pull as it was made, and
 * the rest by a draw of their own (their star's warmth, the land they rose in), so each of them
 * is its own as the world's own people are. No tree of life is known of theirs.
 */
export function starFolk(civ: { readonly ref: string; readonly gravity: number }): FolkFacts {
  const key = hashString(`${civ.ref} folk`) >>> 0,
    draw = (n: number) => ((hashString(`${civ.ref} folk ${n}`) >>> 0) % 10_000) / 10_000;
  return {
    key,
    gravity: civ.gravity,
    star: 3200 + 4200 * draw(1),
    warmth: -10 + 40 * draw(2),
    rain: 200 + 2400 * draw(3),
    biome: Math.floor(16 * draw(4)),
    forebears: null,
  };
}
