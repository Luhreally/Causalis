// One's character and mind in the town (town mode, R2), as Classic's character card and mind card (51-character,
// 62-liquid-mind) had them, read off what the place already keeps of them: their temper, nature and values as tags,
// each with what it does in the town's own reckoning; their best skills; what they want most now and since when they
// have been in want; what they have come to (the town's log); what drives them (the facet of their nature furthest from
// the middle); their five leanings against most; how they learn (what their household taught them, the trade they are
// fit for); and the senses their people's body has. Read only.
import { DAY, type World } from "../kernel/index.ts";
import { CLADES, type Sense } from "../rules/index.ts";
import { populationContext } from "../sim/index.ts";
import { placeCharacterRef, placePersonRef, type PlaceInspectCharacter } from "../bridge/index.ts";
import {
  HAP,
  leans,
  placeFacets,
  placeIndexOf,
  placeTemper,
  placeValues,
  type Place,
} from "./place.ts";
import { placeDay } from "./placeplan.ts";
import { FACET_WORDS, VALUE_WORDS, inspectPerson } from "./placeinspect.ts";

/** What each leaning of a temper does in the town, high and low (host/place.ts placeTemper: the mood's terms it weighs). */
const TEMPER_TAGS: readonly (readonly [string, string, string, string, string])[] = [
  [
    "kin",
    "close to kin",
    "a death at home grieves them the more",
    "their own person",
    "a death at home weighs on them less",
  ],
  [
    "bidden",
    "biddable",
    "an order to change their work sits lightly on them",
    "wilful",
    "an order not of their choosing sours them",
  ],
  [
    "sociable",
    "fond of company",
    "a friend made lifts them, and they want company the sooner",
    "solitary",
    "company matters little to them",
  ],
  [
    "thrifty",
    "thrifty",
    "a pantry with a week's food in it gladdens them",
    "open-handed",
    "food laid by matters little to them",
  ],
  [
    "bold",
    "bold",
    "want and a home lost weigh on them less",
    "timid",
    "want and a home lost weigh on them the more",
  ],
];
/** What each facet of a nature does, high and low (host/place.ts FACETS: the own half of a leaning, and wonder). */
const FACET_MEANS: readonly (readonly [string, string])[] = [
  ["those near them are held close", "they keep others at arm's length"],
  ["they take their betters' word", "they go their own way, whoever bids"],
  ["they seek company and draw others to them", "they keep to themselves"],
  ["they lay by against a lean day", "they live for the day"],
  ["hardship does not shake them", "hardship shakes them"],
  [
    "they take to those unlike them and to new ways, and may be seized by a strange mood at their craft",
    "they keep to what they know",
  ],
];
/** What a facet of their nature drives them to, at its high end and its low (the drive: the furthest from the middle). */
const DRIVES: readonly (readonly [string, string])[] = [
  ["their kin and those near them", "being let be"],
  ["doing as they are bidden, and well", "having their own way"],
  ["company and talk", "quiet and their own hearth"],
  ["food laid by and a full pantry", "the day's pleasures"],
  ["daring and the bold thing", "safety"],
  ["the new and the strange, and making what no one has", "the old ways kept"],
];
const SENSE_WORDS: Readonly<Record<Sense, string>> = {
  sight: "they see by light, as most of the world's beasts do",
  hearing: "they hear the air's sound",
  smell: "they know their way and one another by smell",
  echo: "they find their way by the echo of their own calls",
  electric: "they feel the field of the living about them",
};
/** The happenings a person comes to that are glad ones: what they have come to. */
const FULFILLED: ReadonlyMap<number, string> = new Map([
  [HAP.paired, "Paired"],
  [HAP.ofAge, "Came of age"],
  [HAP.madeWork, "Made a work of their craft that the town keeps"],
  [HAP.inspired, "Made a masterwork in a strange mood"],
  [HAP.well, "Well again"],
]);

/** One's character and mind (R2; null: none of the town by that number). */
export function placeCharacter(
  world: World,
  place: Place,
  id: number,
): PlaceInspectCharacter | null {
  const i = placeIndexOf(place, id),
    person = i >= 0 ? inspectPerson(world, place, id) : null;
  if (i < 0 || !person) return null;
  const p = place.people,
    temper = placeTemper(place, i),
    facets = placeFacets(place, i),
    values = placeValues(place, i),
    ways = place.matched.ways,
    traits: PlaceInspectCharacter["traits"][number][] = [];
  for (const [k, hi, hiMeans, lo, loMeans] of TEMPER_TAGS) {
    const x = temper[k as keyof typeof temper];
    if (x >= 0.62) traits.push({ tag: hi, meaning: cap(hiMeans), of: "temper" });
    else if (x <= 0.38) traits.push({ tag: lo, meaning: cap(loMeans), of: "temper" });
  }
  facets.forEach((x, k) => {
    if (x >= 0.75)
      traits.push({ tag: FACET_WORDS[k]![0], meaning: cap(FACET_MEANS[k]![0]), of: "nature" });
    else if (x <= 0.25)
      traits.push({ tag: FACET_WORDS[k]![1], meaning: cap(FACET_MEANS[k]![1]), of: "nature" });
  });
  values.forEach((v, k) => {
    const m = 0.5 * (ways?.[k] ?? 0.5) + 0.25;
    if (v - m >= 0.15)
      traits.push({
        tag: `holds ${VALUE_WORDS[k]} dear`,
        meaning: `They take to those who hold ${VALUE_WORDS[k]} dear too, and come to words with those who scorn it`,
        of: "values",
      });
    else if (m - v >= 0.15)
      traits.push({
        tag: `sets little by ${VALUE_WORDS[k]}`,
        meaning: `They come to words with those who hold ${VALUE_WORDS[k]} dear`,
        of: "values",
      });
  });
  // (Their best: the most hours given, the three first.)
  const skills = person.skills
    .filter((x) => x.hours > 0)
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((x) => ({ name: x.name, words: x.words, hours: x.hours, passion: x.passion }));
  // (What they want most now: the need standing highest; and how long they have gone in want.)
  const top = [...person.needs].sort((a, b) => b.level - a.level)[0],
    day = Math.floor(place.t / DAY),
    want =
      top && top.level >= 0.3
        ? `${top.name}, most of all (${Math.round(top.level * 100)}%)`
        : "Nothing pressing",
    since =
      person.lack > 0
        ? `In want these ${person.lack} days, since ${placeDay((day - person.lack) * DAY)}`
        : null;
  // (What they have come to, as its log tells it: the latest first, a dozen at the most.)
  const fulfilled: string[] = [];
  for (let k = place.log.length - 1; k >= 0 && fulfilled.length < 12; k--) {
    const x = place.log[k]!;
    const said = x.id === id ? FULFILLED.get(x.what) : null;
    if (said) fulfilled.push(`${said}, ${placeDay(x.t)}`);
    else if (x.what === HAP.born && (x.a === id || p.father[placeIndexOf(place, x.id)] === id))
      fulfilled.push(`A child born to them, ${placeDay(x.t)}`);
  }
  // (What drives them: the facet of their nature furthest from the middle.)
  let far = 0;
  facets.forEach((x, k) => {
    if (Math.abs(x - 0.5) > Math.abs(facets[far]! - 0.5)) far = k;
  });
  const drive = `${cap(DRIVES[far]![facets[far]! >= 0.5 ? 0 : 1])}: ${FACET_MEANS[far]![facets[far]! >= 0.5 ? 0 : 1]}`;
  const leanings = TEMPER_TAGS.map(([k, hi, , lo]) => {
    const x = temper[k as keyof typeof temper];
    return {
      name: `${cap(hi)} / ${lo}`,
      value: Math.round(leans(x) * 100),
      words: x >= 0.62 ? hi : x <= 0.38 ? lo : "as most are",
    };
  });
  const own = person.skills.find((x) => x.own),
    learning = [
      ...(person.taught ? [`Taught as they grew: ${person.taught}`] : []),
      ...person.skills
        .filter((x) => x.passion && !person.taught)
        .map((x) => `A passion for ${x.name.toLowerCase()}: they learn it the quicker`),
      ...(own && own.fit < 1
        ? [
            `At ${Math.round(own.fit * 100)}% of their hand at ${own.name.toLowerCase()} now, by their health`,
          ]
        : []),
      ...(own
        ? [
            `Learns ${own.name.toLowerCase()} by the hours they give it: ${own.hours.toLocaleString("en-US")} so far`,
          ]
        : []),
    ];
  const body = populationContext(world).generated.life.people?.body,
    senses = (
      body?.senses ??
      CLADES.find((c) => c.id === "ape")?.body.senses ?? ["sight", "hearing"]
    ).map((s) => ({ name: cap(s), words: cap(SENSE_WORDS[s as Sense] ?? s) }));
  return {
    kind: "character",
    ref: placeCharacterRef(place.town, id),
    personRef: placePersonRef(place.town, id),
    name: `${person.name}: character and mind`,
    icon: "🧠",
    traits,
    skills,
    want,
    since,
    fulfilled,
    drive,
    leanings,
    learning,
    senses,
  };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
