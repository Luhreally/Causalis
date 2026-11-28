// One's family in the town (town mode, P3): their parents and theirs, their brothers and sisters, the one they are paired
// with or promised to, their children and their children's children. Read off the place's own people: each born in the
// town is born to one who bears and the one she is paired with (host/place.ts mother, father), so the tree is the place's
// own, as deep as the town has kept them. Those of it a tap away; those gone named where its log still names them. Read only.
import { DAY, type World } from "../kernel/index.ts";
import { FEMALE } from "../rules/index.ts";
import {
  placeFamilyRef,
  placePersonRef,
  type PlaceInspectDead,
  type PlaceInspectFamily,
} from "../bridge/index.ts";
import {
  hapTold,
  placeIndexOf,
  placeMourned,
  placeMournedIds,
  regardWords,
  type Mourned,
  type Place,
} from "./place.ts";
import { placeDay, placeNamed, placeNames, placeWho, tradeWords } from "./placeplan.ts";
import { MEMORY_WORDS } from "./placeinspect.ts";

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
    // (One of its dead kept for their page is asked by -1 - their sex: mournedAs.)
    female = (j: number) => (j < 0 ? -1 - j === FEMALE : p.sexOcc[j]! >> 4 === FEMALE),
    kin = (n: number, as: (j: number) => string): Kin => {
      if (!n)
        return {
          name: "Not known",
          ref: null,
          words: "came to the town grown, or before it kept its families",
        };
      const j = placeIndexOf(place, n);
      if (j < 0) {
        // (One of its dead kept for their page (R1): a tap to it.)
        const m = placeMourned(place, n);
        if (m) return mournedKin(world, place, m, as);
        return {
          name: named(n) ?? "One gone from the town",
          ref: null,
          words: "gone from the town",
        };
      }
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
    children = [
      ...of(
        (j) => p.mother[j] === id || p.father[j] === id,
        (j) => (female(j) ? "daughter" : "son"),
      ),
      // (And those of them dead, kept for their pages: R1.)
      ...mournedChildren(world, place, id, (g) => (female(g) ? "daughter" : "son")),
    ],
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

/** One of a place's dead kept for their page, as kin or one known: named as they were, a tap to their page (R1). */
function mournedKin(
  world: World,
  place: Place,
  m: Mourned,
  as: (j: number) => string,
  names = placeNames(world, place),
): Kin {
  return {
    name: names(m.id, m.sexOcc >> 4, m.key),
    ref: placePersonRef(place.town, m.id),
    // (Their kinship read as the living's is: by sex alone, so `as` is asked of no one of the town.)
    words: `${mournedAs(as, m)}, died ${placeDay(m.t)}`,
  };
}
/** The kin word `as` gives, for one gone: asked with their sex in place of one of the town's (-1 - sex). */
const mournedAs = (as: (j: number) => string, m: Mourned): string => as(-1 - (m.sexOcc >> 4));

/** One's nearest kin, a tap away from their page (R1): mother, father, the one they are paired with, their children. */
export function placeKin(world: World, place: Place, i: number): Kin[] {
  const p = place.people,
    id = p.id[i]!,
    who = placeWho(world, place),
    names = placeNames(world, place),
    day = Math.floor(place.t / DAY),
    out: Kin[] = [],
    one = (n: number, as: string): void => {
      if (!n) return;
      const j = placeIndexOf(place, n);
      if (j >= 0) {
        out.push({
          name: who(j).name,
          ref: who(j).ref,
          words: `${as}, ${Math.floor((day - p.born[j]!) / 365)}`,
        });
        return;
      }
      const m = placeMourned(place, n);
      if (m) out.push(mournedKin(world, place, m, () => as, names));
    };
  one(p.mother[i]!, "mother");
  one(p.father[i]!, "father");
  if (p.mate[i] && p.mate[i] !== PROMISED) one(p.mate[i]!, "paired");
  const kids: number[] = [];
  for (let j = 0; j < p.n; j++) if (p.mother[j] === id || p.father[j] === id) kids.push(j);
  kids.sort((a, b) => p.born[a]! - p.born[b]! || a - b);
  for (const j of kids.slice(0, KIN_NEAR))
    one(p.id[j]!, p.sexOcc[j]! >> 4 === FEMALE ? "daughter" : "son");
  out.push(
    ...mournedChildren(world, place, id, (g) => (-1 - g === FEMALE ? "daughter" : "son")).slice(
      0,
      Math.max(0, KIN_NEAR - kids.length),
    ),
  );
  return out;
}
/** One's children among the town's dead kept for their pages, the latest dead first (R1). */
function mournedChildren(world: World, place: Place, id: number, as: (j: number) => string): Kin[] {
  const names = placeNames(world, place),
    out: Kin[] = [];
  for (const n of placeMournedIds(place)) {
    const m = placeMourned(place, n)!;
    if (m.mother === id || m.father === id) out.push(mournedKin(world, place, m, as, names));
  }
  return out;
}
/** The most children told among one's nearest kin (the rest on their family's page). */
const KIN_NEAR = 6;

/** One of a place's dead on a page that outlives them (R1; null: none kept by that number). */
export function placeDead(world: World, place: Place, id: number): PlaceInspectDead | null {
  const m = placeMourned(place, id);
  if (!m) return null;
  const p = place.people,
    names = placeNames(world, place),
    named = placeNamed(world, place),
    who = placeWho(world, place),
    sex = m.sexOcc >> 4,
    name = names(id, sex, m.key),
    died = Math.floor(m.t / DAY),
    age = Math.max(0, Math.floor((died - m.born) / 365)),
    told = hapTold(place, { t: m.t, what: m.what, id, a: m.a, b: 0 }, named),
    // (Any of the town or of its dead, by their number: a tap to them.)
    person = (n: number, words: string): Kin | null => {
      const j = placeIndexOf(place, n);
      if (j >= 0) return { name: who(j).name, ref: who(j).ref, words };
      const d = placeMourned(place, n);
      return d
        ? {
            name: names(n, d.sexOcc >> 4, d.key),
            ref: placePersonRef(place.town, n),
            words: `${words}; died ${placeDay(d.t)}`,
          }
        : null;
    },
    kin: Kin[] = [];
  const add = (k: Kin | null) => {
    if (k && !kin.some((x) => x.ref === k.ref)) kin.push(k);
  };
  add(person(m.mother, "their mother"));
  add(person(m.father, "their father"));
  add(person(m.mate, "the one they were paired with"));
  // (Their children: the living whose mother or father they were, and those of the dead kept so.)
  const kids: Kin[] = [];
  for (let j = 0; j < p.n; j++)
    if (p.mother[j] === id || p.father[j] === id)
      kids.push({
        name: who(j).name,
        ref: who(j).ref,
        words: p.sexOcc[j]! >> 4 === FEMALE ? "their daughter" : "their son",
      });
  for (const n of placeMournedIds(place)) {
    const d = placeMourned(place, n)!;
    if (d.mother === id || d.father === id)
      kids.push({
        name: names(n, d.sexOcc >> 4, d.key),
        ref: placePersonRef(place.town, n),
        words: `${d.sexOcc >> 4 === FEMALE ? "their daughter" : "their son"}; died ${placeDay(d.t)}`,
      });
  }
  for (const k of kids.slice(0, KIN_MOST)) add(k);
  const knew: Kin[] = [];
  const met = (k: Kin | null) => {
    if (k && !kin.some((x) => x.ref === k.ref) && !knew.some((x) => x.ref === k.ref)) knew.push(k);
  };
  met(person(m.friend, "their friend"));
  for (const t of m.ties)
    met(
      person(t.id, `${regardWords(t.opinion)} to them (${t.opinion > 0 ? "+" : ""}${t.opinion})`),
    );
  const life = [
    m.mother || m.father
      ? `Born in the town, ${placeDay(m.born * DAY)}`
      : `Born ${placeDay(m.born * DAY)}; came to the town grown, or before it kept its families`,
    `${cap(tradeWords(m.sexOcc & 15, age < 16))} at the end`,
    ...(m.home >= 0 ? [`Of the household whose home was on lot ${m.home}`] : []),
  ];
  return {
    kind: "dead",
    ref: placePersonRef(place.town, id),
    name,
    icon: "🕯️",
    sub: `Died ${placeDay(m.t)}, aged ${age}`,
    death: `${name} ${told}, ${placeDay(m.t)}.`,
    life,
    kin,
    knew,
    memories: m.memories.map((x) => {
      const w = MEMORY_WORDS[x.thought];
      return { icon: w?.[0] ?? "💭", words: w?.[1] ?? "A memory", size: x.size };
    }),
  };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
