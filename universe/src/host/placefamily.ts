// One's family in the town (town mode, P3): their parents and theirs, their brothers and sisters, the one they are paired
// with or promised to, their children and their children's children. Read off the place's own people: each born in the
// town is born to one who bears and the one she is paired with (host/place.ts mother, father), so the tree is the place's
// own, as deep as the town has kept them. Those of it a tap away; those gone named where its log still names them. Read only.
import { DAY, type World } from "../kernel/index.ts";
import { FEMALE } from "../rules/index.ts";
import { placeFamilyRef, placePersonRef, type PlaceInspectFamily } from "../bridge/index.ts";
import { placeIndexOf, type Place } from "./place.ts";
import { placeNamed, placeWho } from "./placeplan.ts";

/** The pairing set for a day to come (host/place.ts PROMISED). */
const PROMISED = 0xffffffff;
/** The most of any one kind of kin told (the rest counted). */
const KIN_MOST = 16;
type Kin = PlaceInspectFamily["parents"][number];

/** One's family (P3; null: no one of the town by that number now). */
export function placeFamily(world: World, place: Place, id: number): PlaceInspectFamily | null {
  const p = place.people,
    i = placeIndexOf(place, id);
  if (i < 0) return null;
  const who = placeWho(world, place),
    named = placeNamed(world, place),
    day = Math.floor(place.t / DAY),
    female = (j: number) => p.sexOcc[j]! >> 4 === FEMALE,
    kin = (n: number, as: (j: number) => string): Kin => {
      if (!n)
        return {
          name: "Not known",
          ref: null,
          words: "came to the town grown, or before it kept its families",
        };
      const j = placeIndexOf(place, n);
      if (j < 0)
        return {
          name: named(n) ?? "One gone from the town",
          ref: null,
          words: "gone from the town",
        };
      return {
        name: who(j).name,
        ref: placePersonRef(place.town, n),
        words: `${as(j)}, ${Math.floor((day - p.born[j]!) / 365)}`,
      };
    },
    of = (pred: (j: number) => boolean, as: (j: number) => string): Kin[] => {
      // (The eldest first.)
      const at: number[] = [];
      for (let j = 0; j < p.n; j++) if (j !== i && pred(j)) at.push(j);
      return at.sort((a, b) => p.born[a]! - p.born[b]! || a - b).map((j) => kin(p.id[j]!, as));
    },
    mother = p.mother[i]!,
    father = p.father[i]!,
    mi = placeIndexOf(place, mother),
    fi = placeIndexOf(place, father),
    grand = [mi, fi].flatMap((j) =>
      j < 0
        ? []
        : [p.mother[j]!, p.father[j]!]
            .filter((n) => n)
            .map((n) => kin(n, (g) => (female(g) ? "grandmother" : "grandfather"))),
    ),
    siblings = of(
      (j) => (!!mother && p.mother[j] === mother) || (!!father && p.father[j] === father),
      (j) =>
        (p.mother[j] === mother || !mother) && (p.father[j] === father || !father)
          ? female(j)
            ? "sister"
            : "brother"
          : female(j)
            ? "half-sister"
            : "half-brother",
    ),
    children = of(
      (j) => p.mother[j] === id || p.father[j] === id,
      (j) => (female(j) ? "daughter" : "son"),
    ),
    kids = new Set(children.map((c) => c.ref).filter((r): r is string => !!r)),
    grandchildren = of(
      (j) =>
        kids.has(placePersonRef(place.town, p.mother[j]!)) ||
        kids.has(placePersonRef(place.town, p.father[j]!)),
      (j) => (female(j) ? "granddaughter" : "grandson"),
    ),
    mate = p.mate[i]!,
    promised = mate === PROMISED,
    paired: Kin | null = !mate
      ? null
      : kin(promised ? p.friend[i]! : mate, () => (promised ? "promised" : "paired")),
    all =
      grand.length + siblings.length + children.length + grandchildren.length + (paired ? 1 : 0);
  return {
    kind: "family",
    ref: placeFamilyRef(place.town, id),
    personRef: placePersonRef(place.town, id),
    name: `${who(i).name}'s family`,
    icon: "🌳",
    parents: [kin(mother, () => "mother"), kin(father, () => "father")],
    grandparents: grand,
    mate: paired,
    promised,
    siblings: siblings.slice(0, KIN_MOST),
    children: children.slice(0, KIN_MOST),
    grandchildren: grandchildren.slice(0, KIN_MOST),
    words: all
      ? `${all} of their kin in the town, as it has kept them: those born in it are born to their mother and the one she is paired with.`
      : "None of their kin is in the town, as it has kept them: those born in it are born to their mother and the one she is paired with.",
  };
}
