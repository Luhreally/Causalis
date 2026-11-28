// The town mode's own inspector, the host's part (asked 2026-11-25: "the ui and ux could be better ... there should be
// more detail"): one of a place's people, or one of its lots, read into the shape the mode's inspector lays out
// (bridge/placeinspect.ts): who and what first, in numbers with units, and the long sentences kept apart for whoever
// asks. Read of the place as kept, through the readers its pages use (host/inspect/place.ts, host/placeplan.ts): asking
// moves nothing, and nothing here is reckoned that the place does not reckon already.
import { DAY, type World } from "../kernel/index.ts";
import {
  CIVICS,
  FESTER_MOST,
  FOODS,
  GOODS,
  INTOX_KINDS,
  INTOX_WORDS,
  MEMBERS,
  OCC,
  TISSUE_WORDS,
  gradeOf,
  type Tissue,
} from "../rules/index.ts";
/** What the tissue a wound reached means for its mending. */
const TISSUE_WHY: Readonly<Record<Tissue, string>> = {
  skin: "it mends soonest, and the limb works through it",
  flesh: "the muscle that moves it torn; the limb weak while it mends",
  bone: "set and splinted; the limb of no use till the bone knits",
  vessel: "it bled hard; weak while it mends",
  organ: "it hurts deep, and mends slowly",
};
import {
  CIVIC_LOTS,
  lifeOf,
  managedOf,
  mixOf,
  homePlanet,
  kindBody,
  sitedProblem,
  townsOf,
} from "../sim/index.ts";
import { townOffers } from "./inspect/asks.ts";
import {
  PLACE_AT,
  placeItemRef,
  placeLotRef,
  placeWorkRef,
  placeFamilyRef,
  placeCharacterRef,
  placeBodyRef,
  placeWhyRef,
  placePersonRef,
  placedId,
  type MemberState,
  type WoundMember,
  type PlaceInspect,
  type PlaceInspectItem,
  type PlaceInspectLot,
  type PlaceInspectPerson,
  type PlaceNamed,
  type PlaceThought,
  type Portrait,
} from "../bridge/index.ts";
import type { QueryHandler } from "./host.ts";
import { figureBody } from "./folk.ts";
import { skillLine, temperWords } from "./inspect/place.ts";
import { groundReading } from "./inspect/ground.ts";
import { placeFields, placeInside } from "./placeinside.ts";
import { placeBelow } from "./placebelow.ts";
import { placeLegends, placeWork, workName } from "./placelegends.ts";
import { placeGate } from "./placevisitors.ts";
import { placeDead, placeFamily, placeKin } from "./placefamily.ts";
import { placeCharacter } from "./placecharacter.ts";
import { placeBody } from "./placebody.ts";
import { placeMaking } from "./placemaking.ts";
import { placeCivic } from "./placecivic.ts";
import { placeWhy } from "./placewhy.ts";
import { placeLevels } from "./placelevels.ts";
import { placeBeasts } from "./placebeasts.ts";
import { placeHelp } from "./placehelp.ts";
import { placeWhatNow } from "./placewhatnow.ts";
import { placeInventory } from "./placeinventory.ts";
import { bondWords, placeBound } from "./placebound.ts";
import { placeFaith } from "./placefaith.ts";
import {
  ACT,
  AT,
  BOUND_ARMS,
  BOUND_SITE,
  cryReach,
  streetLength,
  HAP,
  IDLE_WORTH,
  MOOD,
  MOOD_BASE,
  MOOD_UNHEEDING,
  NEED_WORDS,
  THOUGHT,
  enterPlace,
  hapTold,
  ordersOf,
  placeIndexOf,
  placeKind,
  placeLot,
  placeMate,
  placeMoodTerms,
  placePerson,
  placeSites,
  placeSkill,
  placeZone,
  placeMeetFor,
  ZONE,
  placeSkills,
  placeMember,
  hurtOf,
  woundTakes,
  gaitOf,
  tendedOf,
  placeTemper,
  tradeKind,
  pressOf,
  siteStage,
  workWorth,
  type Place,
  actWords,
  placeDayStrip,
  placeTies,
  placeOpinion,
  placeRepute,
  REASON,
  REASON_WORDS,
  TIES,
  regardWords,
  FRIEND_AT,
  RIVAL_AT,
  placeWound,
  placeHealer,
  placeStores,
  placeWorks,
  hapWords,
  WORK_QUALITY,
  placeTier,
  COND,
  lotOfSrc,
  placeFacets,
  placeValues,
  valueClash,
  placeGear,
  placeGearReading,
  placeNeedsMore,
  GEAR,
  type Item,
  dressWarmth,
  fareMost,
  placeDrink,
  placeRoomLets,
  placeTakes,
} from "./place.ts";
import {
  ailWords,
  billRows,
  storeTakes,
  festerWords,
  painWords,
  healthWords,
  TENDED_WORDS,
  lotWords,
  markWords,
  careWords,
  placeDay,
  placeNamed,
  placeNames,
  placeWho,
  tradeWords,
  whyWords,
  OCCUPATION_WORK,
  SKILL_NAMES,
  placeDayRows,
} from "./placeplan.ts";
import { landEra, peopleBody } from "./village.ts";
import { landCloth } from "./chain.ts";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const amount = (x: number) =>
  x >= 100 ? `${Math.round(x)}` : x >= 10 ? x.toFixed(1) : x.toFixed(2);

/** What each of MOOD's bits is, said short, with its sign. */
const THOUGHT_WORDS: Readonly<Record<number, readonly [string, string]>> = {
  [MOOD.want]: ["🥣", "Gone hungry, cold or without rest"],
  [MOOD.ailing]: ["🤕", "Hurt or sick"],
  [MOOD.bereaved]: ["🕯️", "A death in the household"],
  [MOOD.pantry]: ["🫙", "A pantry with a week's food in it"],
  [MOOD.friend]: ["🤝", "A friend made in company"],
  [MOOD.home]: ["🏠", "A new home"],
  [MOOD.ordered]: ["📋", "Held to a trade by an order"],
  [MOOD.homeless]: ["🏚️", "Their home lost"],
};
/** What each kind of memory is, said short, with its sign (host/place.ts THOUGHT). */
export const MEMORY_WORDS: Readonly<Record<number, readonly [string, string]>> = {
  [THOUGHT.born]: ["👶", "A child born to the household"],
  [THOUGHT.paired]: ["💞", "Paired"],
  [THOUGHT.friendDied]: ["🕯️", "Their friend died"],
  [THOUGHT.ofAge]: ["🎉", "Came of age, and took up work"],
  [THOUGHT.fire]: ["🔥", "Fought a fire"],
  [THOUGHT.games]: ["🎲", "Played at the games in the square"],
  [THOUGHT.feast]: ["🍖", "Feasted with the town"],
  [THOUGHT.quarrel]: ["💢", "Quarrelled with one they cannot abide"],
  [THOUGHT.brawl]: ["👊", "Came to blows"],
  [THOUGHT.catharsis]: ["😮‍💨", "Let it all out, and feels the lighter"],
  [THOUGHT.heldBy]: ["⛓️", "Held by the town's justice"],
  [THOUGHT.righted]: ["⚖️", "A wrong done them judged"],
  [THOUGHT.admired]: ["🖼️", "Saw a fine work"],
};
/** What each way one lives that bears on a mood is, said short, with its sign (host/place.ts COND). */
const COND_WORDS: Readonly<Record<number, readonly [string, string]>> = {
  [COND.cook]: ["🍲", "Meals cooked at home"],
  [COND.passion]: ["⭐", "At the work their household taught them"],
  [COND.kept]: ["🪢", "Kept from the work their household taught them"],
  [COND.crowded]: ["🧱", "Works in a crowd at the yard and the door, no bench of their own"],
  [COND.craving]: ["🍶", "Needs what they take"],
  [COND.fare]: ["🥖", "Their household's table: the foods its pantry holds"],
  [COND.bound]: ["⛓️", "Held in bondage"],
  [COND.rite]: ["⛩️", "A shrine to keep their faith's rites at"],
  [COND.rank]: ["🏛️", "A hall befitting their rank"],
  [COND.kinAbed]: ["🛏️", "One of their household abed"],
  [COND.friendAbed]: ["🛏️", "Their friend abed"],
  [COND.tool]: ["🛠️", "The tool of their trade"],
  [COND.garment]: ["🧥", "What they wear"],
  [COND.pot]: ["🍯", "Their household's pot"],
  [COND.room]: ["🛏️", "Their home's room"],
  [COND.beauty]: ["🗿", "A fine work in sight of their door"],
};
/** Their household's table and what they take (P4): the foods its pantry holds; what their land takes, where they need it. */
function tableOf(
  world: World,
  place: Place,
  i: number,
  child: boolean,
): { table: string; takes: string | null } {
  const h = place.people.house[i]!,
    held: string[] = [];
  for (let k = 0; k < FOODS.length; k++)
    if (place.houses.pantry[h * FOODS.length + k]! > 0)
      held.push(GOODS[FOODS[k]!]!.name.toLowerCase());
  const most = fareMost(place, Math.floor(place.t / DAY)),
    table = !held.length
      ? "Their household's pantry is bare: they eat what they can get"
      : held.length === 1
        ? `Their household eats ${held[0]} alone${most >= 2 ? ": a meagre fare, where others of the town eat of more" : ", as the whole town does"}`
        : `Their household eats ${held.slice(0, -1).join(", ")} and ${held.at(-1)}: a varied table`;
  const d = placeDrink(world, place);
  if (child || !placeTakes(place, place.people.id[i]!, d.share)) return { table, takes: null };
  const k = INTOX_KINDS[d.kind]!,
    lost = Math.round((1 - d.worth) * 100);
  return {
    table,
    takes: `Needs ${INTOX_WORDS[k].name}, as ${Math.round(d.share * 100)} in a hundred of their land do: it ${INTOX_WORDS[k].does}${lost > 0 ? `; their work is ${lost}% the less for it` : lost < 0 ? `; it keeps them ${-lost}% the longer at their work` : ""}`,
  };
}
/** Comfort and beauty as their needs read: wanting the more, the fewer beds for those under their home and the less fine a work in sight. */
function needsMore(
  world: World,
  place: Place,
  i: number,
): { name: string; level: number; press: number; words?: string }[] {
  const x = placeNeedsMore(world, place, i),
    // (Wanting nothing at a bed each; the more, the fewer beds there are for those under their roof.)
    crowd = Math.max(0, Math.min(1, 1 - x.room)),
    out: { name: string; level: number; press: number; words?: string }[] = [
      {
        name: "Comfort",
        level: crowd,
        press: pressOf(crowd),
        words: `${x.under} under their roof, ${x.beds} ${x.beds === 1 ? "bed" : "beds"}`,
      },
    ];
  // (Beauty where the town has works to see.)
  if (place.works?.length) {
    const want = x.fine < 0 ? 1 : Math.max(0, 1 - (x.fine + 1) / WORK_QUALITY.length);
    out.push({
      name: "Beauty",
      level: want,
      press: pressOf(want),
      words:
        x.fine < 0
          ? "No work of the town's in sight of their door"
          : `A ${WORK_QUALITY[x.fine]} work at ${lotWords(place, x.seen)} in sight of their door`,
    });
  }
  return out;
}
/** A thing in words: what it is, of what (a farmer's hoe and sickle, a herder's crook and shears, a crafter's tools). */
function gearName(x: Item, occ: number): string {
  if (x.k === GEAR.garment) return `${cap(x.stuff)} garment`;
  if (x.k === GEAR.pot) return `A cooking pot of ${x.stuff}`;
  const tool =
    occ === OCC.farmer
      ? "hoe and sickle"
      : occ === OCC.herder
        ? "crook and shears"
        : "set of tools";
  return `A ${tool} of ${x.stuff}`;
}
/** A thing's quality and wear, and who made it and when. */
function gearWords(x: Item, by: string | null): string {
  const worn = Math.round(x.wear / 10);
  return `${cap(gradeOf(x.q))} (${x.q} of 100) · ${by ? `made by ${by}` : "bought in"}, ${placeDay(x.made * DAY)} · ${x.wear >= 1000 ? "worn out" : `${worn}% worn`}`;
}
/** Each kind of thing's sign (GEAR). */
const GEAR_ICON: Readonly<Record<number, string>> = {
  [GEAR.tool]: "🛠️",
  [GEAR.garment]: "👕",
  [GEAR.pot]: "🍲",
};
/**
 * A thing one holds, on its own page (O5): read off what they hold now (placeGear), against what the town's middling
 * hands make of its kind, its maker named living or gone (a tap to them while they are of the town), its holder a tap.
 */
export function inspectItem(
  world: World,
  place: Place,
  id: number,
  k: number,
): PlaceInspectItem | null {
  const i = placeIndexOf(place, id);
  if (i < 0) return null;
  const x = placeGear(world, place, i).find((g) => g.k === k);
  if (!x) return null;
  const p = place.people,
    occ = p.sexOcc[i]! & 15,
    who = placeWho(world, place)(i),
    names = placeNames(world, place),
    g = placeGearReading(world, place, x),
    mj = x.maker ? placeIndexOf(place, x.maker) : -1,
    left = Math.max(0, Math.round(((1000 - x.wear) / 1000) * g.life)),
    today = Math.floor(place.t / DAY),
    years = Math.floor((today - x.made) / 365),
    home = place.houses.home[p.house[i]!]!,
    at = p.at[i]!;
  return {
    kind: "item",
    ref: placeItemRef(place.town, id, k),
    name: gearName(x, occ),
    icon: GEAR_ICON[k] ?? "📦",
    holder: { name: who.name, ref: placePersonRef(place.town, id) },
    maker: x.maker
      ? {
          name: `${names(x.maker, x.ms, x.mk)}${mj >= 0 ? "" : ", no longer of the town"}`,
          ref: mj >= 0 ? placePersonRef(place.town, x.maker) : null,
        }
      : null,
    stuff: x.stuff,
    q: x.q,
    grade: gradeOf(x.q),
    mid: g.mid,
    wear: x.wear,
    daysLeft: x.wear >= 1000 ? 0 : left,
    made: `${cap(placeDay(x.made * DAY))}${years > 0 ? `, ${years} ${years === 1 ? "year" : "years"} ago` : ""}`,
    use:
      k === GEAR.tool
        ? `For their work as ${tradeWords(occ, false)}: worn by the work done with it`
        : k === GEAR.garment
          ? `Worn day by day, against the weather: the town's ${stuffsWord(world, place)} keeps off ${Math.round(dressWarmth(world, place) * 100)}% of the cold out of doors`
          : "Their household's cooking, at its hearth: they are its cook",
    where:
      k === GEAR.garment
        ? "On them"
        : k === GEAR.pot
          ? `At the hearth of their home, ${lotWords(place, home)}`
          : at === home
            ? `In the chest at home, ${lotWords(place, home)}, while they are there`
            : `With them, at ${lotWords(place, at)}`,
    mood: g.term,
  };
}
/** The town's cloth, in a word or two (its clothes). */
const stuffsWord = (world: World, place: Place): string => landCloth(world, place.cell).name;
/** A cook's skill at it, said of their meals. */
const COOK_WORDS = ["poor", "plain", "good", "fine", "a master's"] as const;
/** Each facet of one's nature at its two ends (host/place.ts FACETS). */
export const FACET_WORDS: readonly (readonly [string, string])[] = [
  ["warm", "cool"],
  ["deferent", "headstrong"],
  ["lively", "quiet"],
  ["prudent", "carefree"],
  ["steady", "nervous"],
  ["curious", "set in their ways"],
];
/** What each of the eight values is of (rules/ways.ts WAY_TRAITS' order). */
export const VALUE_WORDS = [
  "kin",
  "rank",
  "the gods",
  "valour",
  "trade",
  "strangers",
  "custom",
  "thrift",
] as const;
/** A mood in a word. */
export const moodWord = (m: number): string =>
  m >= 25 ? "Glad" : m >= -15 ? "Even" : m >= MOOD_UNHEEDING ? "Low" : "Too low to heed an order";

/** A building's sign, by its kind. */
const LOT_ICONS: Readonly<Record<string, string>> = {
  granary: "🌾",
  market: "🏪",
  smithy: "⚒️",
  kiln: "🏺",
  workshop: "🔨",
  factory: "🏭",
  temple: "⛪",
  shrine: "⛩️",
  hall: "🏛️",
  hospital: "⚕️",
  docks: "⚓",
  station: "🚉",
  offices: "🏢",
  academy: "🎓",
  walls: "🧱",
};

/** One of a place's people, read for the mode's inspector (null: no one of it by that number). */
export function inspectPerson(world: World, place: Place, id: number): PlaceInspectPerson | null {
  const i = placeIndexOf(place, id),
    r = i >= 0 ? placePerson(world, place, id) : null;
  if (!r) return null;
  const p = place.people,
    life = lifeOf(world),
    child = r.age < life.adulthood,
    who = placeWho(world, place),
    me = who(i),
    named = placeNamed(world, place),
    nameOf = (j: number, words: string): PlaceNamed => ({
      id: p.id[j]!,
      ref: who(j).ref,
      name: who(j).name,
      words,
    }),
    age = (j: number) => Math.floor((place.t / DAY - p.born[j]!) / 365),
    worth = workWorth(world, place, i),
    serves = Math.cbrt(Math.max(worth, IDLE_WORTH)),
    doing =
      r.act === ACT.abed && r.eta > 0
        ? `Being brought home to lie abed, at ${lotWords(place, r.to)}`
        : `${cap(actWords(place.people, i))}${r.eta > 0 ? `, walking to ${lotWords(place, r.to)}` : r.act === ACT.sleep || r.act === ACT.eat ? "" : ` at ${lotWords(place, r.at)}`}`;
  // Their mood's reasons: what bears on it now, each by how much and for how long (host/place.ts moodTerms).
  const terms = placeMoodTerms(world, place, i),
    // (Whom or what each came of: one of the town's people by name, living or gone; one of its lots by what stands on it.)
    namedOf = placeNamed(world, place),
    fromOf = (src: number | undefined): PlaceThought["from"] => {
      if (!src) return null;
      if (src > 0) {
        const name = namedOf(src);
        return name
          ? {
              ref: placeIndexOf(place, src) >= 0 ? placePersonRef(place.town, src) : null,
              name,
            }
          : null;
      }
      const lot = lotOfSrc(src);
      return {
        ref: lot >= 0 ? placeLotRef(place.town, lot) : null,
        name: cap(lotWords(place, lot)),
      };
    },
    // (Words or blows with one: over what the two hold dear at its two ends, where they do.)
    overWords = (base: string, other: number): string => {
      const j = placeIndexOf(place, other);
      if (j < 0) return base;
      const at = { k: -1 },
        clash = valueClash(placeValues(place, i), placeValues(place, j), place.matched.ways, at);
      return clash >= 0.25 && at.k >= 0 ? `${base}, over ${VALUE_WORDS[at.k]}` : base;
    },
    hd = (x: (typeof terms)[number]) =>
      x.cond ? COND_WORDS[x.cond] : x.thought ? MEMORY_WORDS[x.thought] : THOUGHT_WORDS[x.bit],
    thoughts: PlaceThought[] = [
      ...terms.map((x) => {
        const from = fromOf(x.src),
          base = hd(x)?.[1] ?? "";
        // (A household's meals said by its cook's skill at them; their own where they are its cook.)
        const words =
          x.cond === COND.cook
            ? x.src === id
              ? `Their own cooking, ${COOK_WORDS[Math.max(0, Math.min(4, (x.size + 2) / 2))] ?? "plain"}`
              : `Meals cooked at home, ${COOK_WORDS[Math.max(0, Math.min(4, (x.size + 2) / 2))] ?? "plain"}`
            : (x.thought === THOUGHT.quarrel || x.thought === THOUGHT.brawl) && x.src && x.src > 0
              ? overWords(base, x.src)
              : x.cond === COND.rite && x.size < 0
                ? "No shrine where their faith keeps its rites"
                : x.cond === COND.rank && x.size < 0
                  ? "No hall befitting their rank"
                  : base;
        return {
          icon: hd(x)?.[0] ?? "•",
          words,
          size: Math.round(x.size),
          days: x.days,
          from: x.cond === COND.cook && x.src === id ? null : from,
        };
      }),
      { icon: "🙂", words: "At ease, as most are", size: MOOD_BASE, days: null },
    ].sort((a, b) => Math.abs(b.size) - Math.abs(a.size)),
    to = MOOD_BASE + terms.reduce((n, x) => n + x.size, 0);
  // (Their portrait: their own people's figure, in their land's clothes, as their town draws them.)
  const kind = placeKind(world, place, i)?.kind ?? 0,
    mix = kind > 0 ? mixOf(world) : null,
    body = mix
      ? figureBody(kindBody(homePlanet(world).generated, mix, kind), null)
      : peopleBody(world);
  const temper = placeTemper(place, i),
    marks: string[] = [],
    mark = (x: number, high: string, low: string) => {
      if (x >= 0.62) marks.push(high);
      else if (x <= 0.38) marks.push(low);
    };
  mark(temper.kin, "close to kin", "their own person");
  mark(temper.bidden, "biddable", "wilful");
  mark(temper.sociable, "fond of company", "solitary");
  mark(temper.thrifty, "thrifty", "open-handed");
  mark(temper.bold, "bold", "timid");
  // (Their nature, the facets far from the middle; what they hold dear and set little store by, against their land.)
  const facets = placeFacets(place, i),
    nature = facets
      .map((x, k) => (x >= 0.75 ? FACET_WORDS[k]![0] : x <= 0.25 ? FACET_WORDS[k]![1] : null))
      .filter((x): x is string => !!x),
    values = placeValues(place, i),
    ways = place.matched.ways,
    dear: string[] = [],
    little: string[] = [];
  values.forEach((v, k) => {
    const m = 0.5 * (ways?.[k] ?? 0.5) + 0.25;
    if (v - m >= 0.15) dear.push(VALUE_WORDS[k]!);
    else if (m - v >= 0.15) little.push(VALUE_WORDS[k]!);
  });
  const skill = r.occupation === OCC.dependent ? null : placeSkill(place, i),
    mate = placeMate(place, i),
    mi = mate ? placeIndexOf(place, mate.id) : -1,
    fi = p.friend[i] ? placeIndexOf(place, p.friend[i]!) : -1,
    pantry = r.pantry.reduce((a, b) => a + b, 0),
    members = r.household.length + 1;
  const lived = place.log
    .filter((x) => x.id === id || ((x.what === HAP.born || x.what === HAP.paired) && x.a === id))
    .slice(-8)
    .reverse()
    .map(
      (x) =>
        `${cap(placeDay(x.t))}: ${
          x.id === id
            ? hapTold(place, x, named)
            : x.what === HAP.born
              ? `${named(x.id) ?? "a child"} was born to them`
              : `paired with ${named(x.id) ?? "another"}`
        }`,
    );
  return {
    kind: "person",
    id,
    ref: placePersonRef(place.town, id),
    page: me.ref,
    familyRef: placeFamilyRef(place.town, id),
    characterRef: placeCharacterRef(place.town, id),
    bodyRef: placeBodyRef(place.town, id),
    whyRef: placeWhyRef(place.town, id),
    kin: placeKin(world, place, i),
    name: me.name,
    portrait: {
      kind: "person",
      ref: me.ref,
      age: r.age,
      span: body?.span ?? 70,
      occupation: r.occupation,
      child,
      era: landEra(world, place.cell),
      body,
    },
    age: Math.floor(r.age),
    trade: tradeWords(r.occupation, child).replace(/^an? /, ""),
    bound:
      p.bound[i] === BOUND_ARMS
        ? "under arms"
        : p.bound[i] === BOUND_SITE
          ? "a site's crew"
          : p.bound[i] === 255
            ? `put at ${lotWords(place, r.work)}`
            : p.bound[i]
              ? tradeWords(p.bound[i]! - 1, false).replace(/^an? /, "")
              : null,
    drafted: (() => {
      const d = ordersOf(world, place.town)?.drafted;
      if (d) for (let k = 0; k + 1 < d.length; k += 2) if (d[k] === id) return d[k + 1]!;
      return null;
    })(),
    now: doing,
    why: whyWords(world, place, i),
    at: r.at,
    to: r.to,
    mood: p.mood[i]!,
    moodWord: moodWord(p.mood[i]!),
    breakAt: MOOD_UNHEEDING,
    thoughts,
    needs: [
      ...NEED_WORDS.map((w, q) => ({
        name: cap(w),
        level: r.needs[q]!,
        press: pressOf(r.needs[q]!),
      })),
      // (Comfort and beauty, by the day: a bed each under their home, and a fine work in sight of its door.)
      ...needsMore(world, place, i),
    ],
    serves,
    health: p.health[i]!,
    healthWords: p.health[i] ? (healthWords(world, place, i) ?? ailWords(place, i)) : null,
    mark: markWords(world, place, i),
    ...tableOf(world, place, i, child),
    ...((): { bond: string | null; freeable: boolean } => {
      const b = bondWords(world, place, id);
      return { bond: b?.words ?? null, freeable: !!b?.freeable };
    })(),
    lack: Math.floor(p.lack[i]! / 144),
    skill: skill
      ? `${cap(skill.words)} at ${OCCUPATION_WORK[r.occupation] ?? "their work"} · ${skill.hours.toLocaleString("en-US")} h`
      : null,
    skillWords: skillLine(world, place, i),
    skills: child
      ? []
      : placeSkills(world, place, i).map((x, k) => ({
          name: SKILL_NAMES[k]!,
          hours: x.hours,
          level: x.level,
          words: x.words,
          fit: x.fit,
          passion: x.passion,
          own: k === tradeKind(r.occupation),
        })),
    ...healthGear(world, place, i, r),
    day: placeDayStrip(world, place, i),
    dayRows: placeDayRows(world, place),
    taught: p.taught[i]
      ? `${SKILL_NAMES[p.taught[i]! - 1]}: what their household taught them as they grew (two hundred hours of it when they came of age)`
      : null,
    temper: marks.length ? cap(marks.join(", ")) : "Much as most of their people",
    nature: nature.length ? cap(nature.join(", ")) : "Even in every way",
    values: `${dear.length ? `Holds dear ${dear.join(", ")}` : "Holds nothing dearer than their people do"}${little.length ? `; sets little store by ${little.join(", ")}` : ""}`,
    temperWords: temperWords(place, i),
    home: {
      lot: r.home,
      words: cap(lotWords(place, r.home)),
      ref: placeLotRef(place.town, r.home),
    },
    work:
      r.occupation === OCC.dependent
        ? null
        : {
            lot: r.work,
            words: `${cap(lotWords(place, r.work))}${r.craft ? `, ${r.craft}` : ""}`,
            ref: placeLotRef(place.town, r.work),
          },
    holds: r.carry ? `${amount(r.carry.amount)} of ${GOODS[r.carry.good]!.name}` : null,
    pantry:
      pantry > 0 ? `${Math.round((pantry * 30) / members)} days' food for its ${members}` : "Bare",
    household: r.household
      .map((k) => placeIndexOf(place, k))
      .filter((j) => j >= 0)
      .map((j) =>
        nameOf(
          j,
          `${age(j)}, ${tradeWords(p.sexOcc[j]! & 15, age(j) < life.adulthood).replace(/^an? /, "")}`,
        ),
      ),
    mate: mi >= 0 ? nameOf(mi, mate!.promised ? "promised" : "paired") : null,
    friend: fi >= 0 ? nameOf(fi, "friend") : null,
    ...tiesOf(world, place, i, nameOf, named),
    life: lived,
    prose: [
      `Mood ${p.mood[i]! > 0 ? "+" : ""}${p.mood[i]}, going a quarter of the way each day to ${Math.round(to)}, where what bears on it now puts it. It moves what their work is worth to them by ${Math.round(p.mood[i]! / 4)} in a hundred; below ${MOOD_UNHEEDING} they heed no order to change their work.`,
      worth > 0
        ? `Each need presses as its fullness cubed. A need is served when it presses harder than the next hour's work is worth to them (${Math.round(worth * 100)}% by day; less in the dark) and than rest is worth (${Math.round(IDLE_WORTH * 100)}%): the mark on each bar.`
        : `Each need presses as its fullness cubed. They keep no trade, so a need is served when it presses harder than rest is worth (${Math.round(IDLE_WORTH * 100)}%): the mark on each bar.`,
      ...(p.health[i] ? [careWords(place)] : []),
      `Of a town's people, those that matter where the eye and the story are are followed in full, ten minutes at a time: those you follow, its healer and those who lead it and their households, and any caught up in a happening. Their households and friends are followed at the hour, the rest among the folk every three hours; each keeps all that they are, and is followed closer from their next turn.`,
    ],
    tier: (() => {
      const t = placeTier(place, i);
      return {
        tier: t.tier,
        words: t.words,
        pinned: t.pinned !== null,
        soft: t.pinned !== null && t.pinned >= 0,
      };
    })(),
  };
}

const TIE_HOW = {
  household: "of their household",
  work: "works beside them",
  street: "of their street",
} as const;
/** One of a place's people's portrait (their own people's figure, in their land's clothes), its body read once a kind. */
function portraitOf(
  world: World,
  place: Place,
  j: number,
  bodies: Map<number, ReturnType<typeof peopleBody>>,
): Portrait {
  const p = place.people,
    kind = placeKind(world, place, j)?.kind ?? 0;
  let body = bodies.get(kind);
  if (body === undefined) {
    const mix = kind > 0 ? mixOf(world) : null;
    body = mix
      ? figureBody(kindBody(homePlanet(world).generated, mix, kind), null)
      : peopleBody(world);
    bodies.set(kind, body);
  }
  const age = (place.t / DAY - p.born[j]!) / 365;
  return {
    kind: "person",
    ref: placePersonRef(place.town, p.id[j]!),
    age,
    span: body?.span ?? 70,
    occupation: p.sexOcc[j]! & 15,
    child: age < lifeOf(world).adulthood,
    era: landEra(world, place.cell),
    body,
  };
}
/**
 * Whom one of a place's people knows (N8, and Q2's reasons: host/place.ts placeTies, placeOpinion), named, each with what
 * they think of them all told and why, the strongest reasons first; their portraits and what those think of each other
 * (the web); and how the town thinks of them.
 */
function tiesOf(
  world: World,
  place: Place,
  i: number,
  nameOf: (j: number, words: string) => PlaceNamed,
  named: (id: number) => string | null,
): Pick<PlaceInspectPerson, "ties" | "tiesWords" | "web" | "repute"> {
  const p = place.people,
    ties = placeTies(place, i),
    friends = ties.filter((t) => t.opinion >= FRIEND_AT).length,
    rivals = ties.filter((t) => t.opinion <= RIVAL_AT).length,
    bodies = new Map<number, ReturnType<typeof peopleBody>>(),
    signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
  const why = (j: number): string => {
    const o = placeOpinion(place, i, j),
      parts = o.reasons.slice(0, 3).map((x) => {
        const of =
          x.kind === REASON.told && x.from
            ? `heard ${x.size > 0 ? "well" : "ill"} of them from ${named(x.from) ?? "another"}`
            : REASON_WORDS[x.kind]!;
        return `${of} ${signed(x.size)}${x.days ? `, ${x.days} ${x.days === 1 ? "day" : "days"} ago` : ", today"}`;
      });
    if (o.kin)
      parts.push(
        o.kin > 0 ? `keeps them, as kin ${signed(o.kin)}` : `lets them go wanting ${signed(o.kin)}`,
      );
    if (o.regard) parts.push(`their meetings ${signed(o.regard)}`);
    return parts.join("; ");
  };
  const at = new Map(ties.map((t, k) => [p.id[t.j]!, k] as const)),
    web: { a: number; b: number; regard: number }[] = [];
  ties.forEach((t, a) => {
    for (let k = 0; k < TIES; k++) {
      const b = at.get(p.tie[t.j * TIES + k]!),
        r = p.regard[t.j * TIES + k]!;
      if (b !== undefined && b !== a && Math.abs(r) >= 5) web.push({ a, b, regard: r });
    }
  });
  const rep = placeRepute(place, i);
  return {
    ties: ties.map((t) => ({
      ...nameOf(t.j, `${regardWords(t.opinion)}, ${TIE_HOW[t.how]} (${signed(t.opinion)})`),
      regard: t.opinion,
      why: why(t.j),
      portrait: portraitOf(world, place, t.j, bodies),
    })),
    tiesWords: ties.length
      ? `They know ${ties.length} well: ${friends === 1 ? "1 friend" : `${friends} friends`}, ${rivals === 1 ? "1 rival" : `${rivals} rivals`}. Each met at home, at work or about their street, thought the better of as they are alike of temper and hold the same dear, and the better or worse for what has passed between them, each reason fading.`
      : "They know no one well yet.",
    web,
    repute: rep.known
      ? `Known well to ${rep.known} of the town: ${rep.well} think well of them, ${rep.ill} ill (on the whole ${signed(Math.round(rep.mean))}).`
      : "Known well to no one of the town yet.",
  };
}

/** The fifths of a land's incomes a household's is of, said (0: the poorest). */
const FIFTH_WORDS = [
  "the poorest fifth",
  "the second fifth",
  "the middle fifth",
  "the fourth fifth",
  "the richest fifth",
];

/**
 * One of a place's people's body and health (the Health tab) and what they have (the Gear tab): each member not whole and
 * how it is, their wound and its days, who tends them, what a wound left them with, what their land knows of care; what
 * they hold, what they work with, what a wound has them bear, their household's pantry and means. All read of the place.
 */
function healthGear(
  world: World,
  place: Place,
  i: number,
  r: NonNullable<ReturnType<typeof placePerson>>,
): Pick<PlaceInspectPerson, "body" | "healthRows" | "gear" | "inventory"> {
  const p = place.people,
    body: { member: WoundMember; words: string; state: MemberState }[] = [],
    at = (member: string, state: MemberState) => {
      if (body.some((x) => x.member === member)) return;
      body.push({
        member: member as WoundMember,
        words: cap(placeMember(world, place, i, member as never)),
        state,
      });
    };
  // (The wound now first: abed with it, or up with it bound and mending; then what an old one left.)
  const hurt = hurtOf(place, i);
  if (hurt.member && (p.health[i] === 1 || p.health[i] === 3))
    at(hurt.member, p.health[i] === 1 ? "abed" : "healing");
  const mark = p.mark[i]!,
    marked = MEMBERS[(mark & 15) - 1];
  if (mark && marked) at(marked, mark >> 4 === 2 ? "lame" : "scarred");
  const days = Math.ceil(p.ill[i]! / 144),
    takes = woundTakes(world, place, i),
    rows: [string, string][] = [
      ["How", p.health[i] ? (healthWords(world, place, i) ?? ailWords(place, i)) : "Well"],
    ];
  if (p.health[i] === 1 || p.health[i] === 2)
    rows.push(
      ["Abed", `${days} more ${days === 1 ? "day" : "days"}`],
      ["Tended", cap(TENDED_WORDS[tendedOf(place, i)])],
    );
  // (A wound by the hour, N9: its bleeding, the blood lost, its festering, how much it hurts.)
  const x = placeWound(place, i),
    hurtNow = p.health[i] === 1 || p.health[i] === 3;
  if (p.health[i] === 1)
    rows.push([
      "Bleeding",
      x.bleeding > 0
        ? `${Math.round(x.bleeding * 100)}% of their blood in the next ten minutes, the less as it clots; not yet dressed`
        : x.dressed
          ? "Stopped: the wound is dressed"
          : "Stopped of itself; the wound not yet dressed",
    ]);
  if (x.blood > 0)
    rows.push([
      "Blood lost",
      `${Math.round(x.blood * 100)}%${x.faint ? ": too faint to stand" : x.blood >= 0.15 ? ": weak" : ""}; made again a little each day`,
    ]);
  if (p.health[i] === 1)
    rows.push([
      "Festering",
      !x.seen
        ? "Not yet known: a wound festers or not a day or two after it is dealt"
        : x.fester > 0
          ? `${cap(festerWords(x.fester))} (${x.fester} of the ${FESTER_MOST} that kill)${x.tended ? "; the healer has seen to it today" : ""}`
          : "Clean",
    ]);
  // (The tissue it reached: why it bled so, hurts so and takes so much of its member's work while it mends.)
  if (hurtNow && x.tissue)
    rows.push(["Reached", `${cap(TISSUE_WORDS[x.tissue])}: ${TISSUE_WHY[x.tissue]}`]);
  if (hurtNow) rows.push(["Pain", `${cap(painWords(x.pain))} (${Math.round(x.pain * 10)} of 10)`]);
  if (hurtNow || x.blood > 0) {
    const h = placeHealer(place);
    if (h.i >= 0)
      rows.push([
        "Healer",
        `${placeWho(world, place)(h.i).name}, with ${h.doses} ${h.doses === 1 ? "dose" : "doses"} of remedies by them`,
      ]);
  }
  if (p.health[i] === 3) rows.push(["Mending", `${days} more ${days === 1 ? "day" : "days"}`]);
  // (A wound still abed or mending whose mark is already known says what it will leave; an old one's, what it left.)
  const healing =
    (p.health[i] === 1 || p.health[i] === 3) && !!hurt.member && marked === hurt.member;
  rows.push([
    healing ? "Will leave" : "Lasting",
    markWords(world, place, i) ?? "No mark of an old wound",
  ]);
  if (takes.handling > 0 || takes.going > 0)
    rows.push([
      "Body",
      `${takes.handling > 0 ? `${Math.round(takes.handling * 100)}% of their handling taken` : "Hands whole"}; ${takes.going > 0 ? `a walk takes them ${gaitOf(takes.going).toFixed(1)}× as long` : "walks as anyone"}`,
    ]);
  if (p.lack[i]! >= 144) rows.push(["In want", `${Math.floor(p.lack[i]! / 144)} days`]);
  rows.push(["Care", careWords(place)]);
  const pantry = r.pantry.reduce((a, b) => a + b, 0),
    members = r.household.length + 1,
    names = placeNames(world, place),
    gear: [string, string, string | null][] = [
      // (Each thing they hold, its own: of what, how fine, by whom and when, how worn; a tap opens its page, O5.)
      ...placeGear(world, place, i).map((x): [string, string, string | null] => [
        gearName(x, r.occupation),
        gearWords(x, x.maker ? names(x.maker, x.ms, x.mk) : null),
        placeItemRef(place.town, p.id[i]!, x.k),
      ]),
      [
        "In hand",
        r.carry ? `${amount(r.carry.amount)} of ${GOODS[r.carry.good]!.name}` : "Nothing",
        null,
      ],
    ];
  if (r.craft) gear.push(["Makes", cap(r.craft), null]);
  if (r.workKind) gear.push(["Works at", cap(lotWords(place, r.work)), null]);
  if (p.health[i] === 3 && hurt.member)
    gear.push([
      "Bound",
      `${cap(placeMember(world, place, i, hurt.member))}, in linen while it mends`,
      null,
    ]);
  if (mark >> 4 === 2 && marked)
    gear.push([
      "Bears",
      takes.going > 0 ? "A stick to walk with: a leg was left lame" : "A stiff limb, favoured",
      null,
    ]);
  gear.push(
    [
      "Pantry",
      pantry > 0 ? `${Math.round((pantry * 30) / members)} days' food for its ${members}` : "Bare",
      null,
    ],
    [
      "Means",
      `Their household is of ${FIFTH_WORDS[r.fifth] ?? "its land's"} incomes: ${Math.round(r.means)} of grain a year`,
      null,
    ],
  );
  return { body, healthRows: rows, gear, inventory: placeInventory(world, place, i, r.carry) };
}

/** One of a place's lots (its square, its fields, its walls' site too), read for the mode's inspector. */
export function inspectLot(world: World, place: Place, lot: number): PlaceInspectLot {
  const r = placeLot(place, lot),
    p = place.people,
    who = placeWho(world, place),
    site = placeSites(world, place).find((x) => x.lot === lot),
    b = place.bldgs.lot.indexOf(lot),
    kind = lot === AT.walls ? "walls" : (r.kind ?? null),
    shut = b > 0 ? !!ordersOf(world, place.town)?.shut.includes(lot) : null,
    people: PlaceNamed[] = [];
  const add = (ids: readonly number[], words: string, most: number) => {
    for (const id of ids.slice(0, most)) {
      const j = placeIndexOf(place, id);
      if (j < 0 || people.some((x) => x.id === id)) continue;
      people.push({
        id,
        ref: who(j).ref,
        name: who(j).name,
        words: `${words}; ${actWords(p, j)}`,
      });
    }
  };
  add(r.working, "works here", 6);
  add(r.living, "lives here", 6);
  add(r.here, "here now", 4);
  const stock = r.stock
    .map((n, g) => ({ n, g }))
    .filter((x) => x.n > 0)
    .sort((a, c) => c.n - a.n)
    .slice(0, 8)
    .map(({ n, g }) => ({
      name: cap(GOODS[g]!.name),
      n,
      unit: FOODS.includes(g) ? "person-months" : "units",
    }));
  const name = cap(lotWords(place, lot)),
    years = b >= 0 && r.start ? Math.max(0, Math.floor(place.t / (365 * DAY)) - r.start) : null;
  return {
    kind: "lot",
    lot,
    ref: placeLotRef(place.town, lot),
    name,
    icon:
      lot === PLACE_AT.square
        ? "⛲"
        : lot === PLACE_AT.fields
          ? "🌾"
          : kind
            ? (LOT_ICONS[kind] ?? (CIVICS.some((c) => c.kind === kind) ? "🏢" : "🏠"))
            : "🏠",
    years,
    working: r.working.length,
    living: r.living.length,
    here: r.here.length,
    people,
    stock,
    shut,
    bills: lot >= 0 ? billRows(world, place, lot) : [],
    works: placeWorks(world, place, lot)
      .slice(0, 12)
      .map((x) => {
        const m = placeIndexOf(place, x.maker),
          s = x.what >= 0 ? placeIndexOf(place, x.whom) : -1,
          subject =
            x.what < 0
              ? "the town itself"
              : `${s >= 0 ? who(s).name : "one of the town"} who ${hapWords(x.what)}, on day ${(x.day % 365) + 1} of the year ${Math.floor(x.day / 365)}`;
        return {
          id: m >= 0 ? x.maker : null,
          // (Its own page, O9: its maker a tap on from there.)
          ref: placeWorkRef(place.town, lot, x.made, x.maker),
          name: workName(world, place, x),
          words: `showing ${subject}; by ${m >= 0 ? who(m).name : "one gone from the town"}`,
        };
      }),
    takes: (() => {
      const st = placeStores(place);
      return lot === st.market && lot >= 0
        ? storeTakes(world, place, 0)
        : lot === st.granary && lot >= 0
          ? storeTakes(world, place, 1)
          : null;
    })(),
    site: site
      ? {
          share: site.share,
          stage: siteStage(site.share, site.kind),
          hands: site.inHand ? site.crew.length : site.hands,
        }
      : null,
    ...lotZone(world, place, lot),
    ...lotPost(world, place, lot),
    raiseHere: raiseHere(world, place, lot),
    warmth:
      lot < 0
        ? null
        : placeRoomLets(place, lot) > 0
          ? `No fire is kept in it: its walls let in ${Math.round(placeRoomLets(place, lot) * 100)}% of the cold out of doors`
          : "Warm in any cold: a hearth, or a fire kept for its work",
    ground: (() => {
      const g = groundReading(world, place.cell);
      return g ? `${g.stats[0]?.value ?? "Its soil"} over ${g.line.replace(/^Ground: /, "")}` : "";
    })(),
    words:
      (place.fire.length && place.t < place.fire[1]! && place.fire[0] === lot
        ? "🔥 Burning now: those who live within a cry of it, and any keeping the fire watch, turn out to fight it. "
        : "") +
      (lot === PLACE_AT.square
        ? "The town's square: where its people meet in company, and where those with no roof live."
        : lot === PLACE_AT.fields
          ? "Its fields and pastures outside the town, worked by its farmers and herders."
          : r.households.length
            ? `Home of ${r.households.length} ${r.households.length === 1 ? "household" : "households"}.`
            : kind
              ? `${shut ? "Its work is stopped by your order." : "Worked in by the town's own."}`
              : lot >= 0
                ? "No household lives here now."
                : ""),
  };
}

/** What a town could be asked to raise, read once a day a place (P1): its Build sheet's own list. */
const OFFERS = new WeakMap<Place, { day: number; o: ReturnType<typeof townOffers> }>();
/** What the town could be asked to raise on a lot (P1): each on the lots it is of, in step with its size, where it fits. */
function raiseHere(world: World, place: Place, lot: number): PlaceInspectLot["raiseHere"] {
  const f = townsOf(world).get(place.town);
  if (lot < 0 || !f) return [];
  const day = Math.floor(place.t / DAY);
  let was = OFFERS.get(place);
  if (!was || was.day !== day) OFFERS.set(place, (was = { day, o: townOffers(world, place.town) }));
  const year = Math.floor(place.t / (365 * DAY)),
    out: PlaceInspectLot["raiseHere"][number][] = [];
  for (const r of was.o?.raises ?? []) {
    const lots = (CIVIC_LOTS as Readonly<Record<string, number>>)[r.what];
    if (lots === undefined || r.kind !== "raise") continue;
    const at = Math.floor(lot / lots) * lots;
    if (sitedProblem(f, r.what, at, year)) continue;
    let clears = 0;
    for (let h = 0; h < place.houses.n; h++) {
      const home = place.houses.home[h]!;
      if (home >= at && home < at + lots && place.houses.members[h]! > 0) clears++;
    }
    out.push({ what: r.what, icon: r.icon, name: r.name, note: r.note, at, lots, clears });
  }
  return out;
}
/** The homes within a cry of a guard's post (O7), counted once a day a post: as the watch at it would hear them. */
const WATCH_COUNT = new WeakMap<Place, { key: string; n: number }>();
/** A lot as the guard's post (O7): whether it is one, whether it may be, and what comes of it, said. */
function lotPost(
  world: World,
  place: Place,
  lot: number,
): { post: boolean; postable: boolean; postWords: string } {
  const m = managedOf(world)?.get(place.town),
    postable = lot >= 0 || lot === PLACE_AT.walls,
    post = m?.post !== undefined && m.post === lot;
  if (!post) return { post, postable, postWords: "" };
  const p = place.people,
    reach = cryReach(world, place),
    key = `${lot}|${Math.floor(place.t / DAY)}|${Math.round(reach)}`;
  let w = WATCH_COUNT.get(place);
  if (!w || w.key !== key) {
    const homes = new Set<number>();
    for (const home of place.houses.home)
      if (home >= 0 && !homes.has(home) && streetLength(place, lot, home) <= reach) homes.add(home);
    WATCH_COUNT.set(place, (w = { key, n: homes.size }));
  }
  let at = 0,
    standing = 0;
  for (let i = 0; i < p.n; i++)
    if (p.bound[i] === BOUND_ARMS) {
      standing++;
      if (p.at[i] === lot && p.act[i] === ACT.guard) at++;
    }
  return {
    post,
    postable,
    postWords: !m?.held.includes("muster")
      ? "The guard's post by your order: but none stand to arms. Order the town to stand to arms (Defence) and they keep it."
      : `The guard's post by your order: ${at} of the ${standing} standing to arms are here now. The ${w.n} ${w.n === 1 ? "home" : "homes"} within a cry of it (${Math.round(reach)} m by its streets) are watched while it is kept: a theft from one is caught in the act, and brought before the town's justice.`,
  };
}
/** A lot's zone (O2): what it is zoned as, whether it may be kept clear, and what comes of it, said. */
function lotZone(
  world: World,
  place: Place,
  lot: number,
): { zone: "meet" | "clear" | null; clearable: boolean; zoneWords: string } {
  const st = placeStores(place),
    clearable = lot >= 0 && lot !== st.market && lot !== st.granary,
    z = lot >= 0 ? placeZone(world, place, lot) : { zone: -1, holds: false };
  if (z.zone === ZONE.meet) {
    const homes = new Set<number>();
    for (const home of place.houses.home)
      if (home >= 0 && placeMeetFor(world, place, home) === lot) homes.add(home);
    return {
      zone: "meet",
      clearable,
      zoneWords: `A meeting place: those of ${homes.size} ${homes.size === 1 ? "home" : "homes"} nearer it than the square come here for company and their games.`,
    };
  }
  if (z.zone === ZONE.clear)
    return {
      zone: "clear",
      clearable,
      zoneWords: z.holds
        ? "Kept clear: none go here but to a fire; those who work here wait at home, and those who live here shelter at the nearest meeting place, else the square."
        : "Zoned to be kept clear, but a store cannot be: the town's households fetch their food from it.",
    };
  return {
    zone: null,
    clearable,
    zoneWords: clearable
      ? ""
      : "A store: it cannot be kept clear, the town's households fetch their food from it.",
  };
}

/** What a ref of the town's names, for its inspector: one of its people (by their page, or their roster's), or a lot. */
export function placeInspect(world: World, town: string, ref: string): PlaceInspect | null {
  // (A page of words, the same for every town: G2.)
  if (ref.startsWith("plch:")) return placeHelp(town, ref.slice(ref.indexOf("|") + 1));
  const place = enterPlace(world, town);
  if (!place) return null;
  if (ref.startsWith("plcb:")) return placeBelow(world, place);
  if (ref.startsWith("plcz:")) return placeLevels(world, place);
  if (ref.startsWith("plcx:")) return placeBeasts(world, place);
  if (ref.startsWith("plcy:")) return placeLegends(world, place);
  if (ref.startsWith("plca:")) return placeGate(world, place);
  if (ref.startsWith("plcd:")) return placeBound(world, place);
  if (ref.startsWith("plcr:")) return placeFaith(world, place);
  if (ref.startsWith("plcs:")) return placeMaking(world, place);
  if (ref.startsWith("plcv:")) return placeCivic(world, place);
  if (ref.startsWith("plcq:")) {
    const id = Number(ref.slice(ref.lastIndexOf(":") + 1)),
      x = Number.isInteger(id) ? inspectPerson(world, place, id) : null;
    return x ? placeWhy(world, place, id, x) : null;
  }
  if (ref.startsWith("plcn:")) return placeWhatNow(world, place);
  if (ref.startsWith("plcm:")) {
    const id = Number(ref.slice(ref.lastIndexOf(":") + 1));
    return Number.isInteger(id) ? placeBody(world, place, id) : null;
  }
  if (ref.startsWith("plcc:")) {
    const id = Number(ref.slice(ref.lastIndexOf(":") + 1));
    return Number.isInteger(id) ? placeCharacter(world, place, id) : null;
  }
  if (ref.startsWith("plcf:")) {
    const id = Number(ref.slice(ref.lastIndexOf(":") + 1));
    return Number.isInteger(id) ? placeFamily(world, place, id) : null;
  }
  if (ref.startsWith("plcw:")) {
    // (plcw:<town>:<lot + 3>:<made>:<maker>: the town's own key has colons of its own.)
    const [lot, made, maker] = ref.split(":").slice(-3).map(Number) as [number, number, number];
    return [lot, made, maker].every(Number.isInteger)
      ? placeWork(world, place, lot - 3, made, maker)
      : null;
  }
  if (ref.startsWith("plcg:")) {
    // (plcg:<town>:<holder>:<kind>: the town's own key has colons of its own.)
    const [id, k] = ref.split(":").slice(-2).map(Number) as [number, number];
    return Number.isInteger(id) && Number.isInteger(k) ? inspectItem(world, place, id, k) : null;
  }
  if (ref.startsWith("plci:")) {
    const n = Number(ref.slice(ref.lastIndexOf(":") + 1));
    if (n - 3 === PLACE_AT.fields) return placeFields(world, place);
    return Number.isInteger(n) ? placeInside(world, place, n - 3) : null;
  }
  if (ref.startsWith("plcl:")) {
    const n = Number(ref.slice(ref.lastIndexOf(":") + 1));
    if (!Number.isInteger(n)) return null;
    return inspectLot(world, place, n === 999_999_999 ? AT.walls : n - 3);
  }
  let id = ref.startsWith("plc:") ? placedId(ref) : null;
  if (id === null) {
    // (One the god game names: found among the place's people by the page they are told by.)
    const who = placeWho(world, place);
    for (let i = 0; i < place.people.n && id === null; i++)
      if (who(i).ref === ref) id = place.people.id[i]!;
  }
  if (id === null) return null;
  // (One of its dead kept for their page (R1): that page, where none of the living is theirs.)
  return inspectPerson(world, place, id) ?? placeDead(world, place, id);
}

/** `place.inspect`: { ref: the town, of: what is inspected (a person's or a lot's ref) }. */
export function placeInspectQueries(): Readonly<Record<string, QueryHandler>> {
  return {
    "place.inspect": (world, args) => {
      const a = args as { ref: string; of: string };
      return typeof a?.ref === "string" && typeof a.of === "string"
        ? placeInspect(world, a.ref, a.of)
        : null;
    },
  };
}
