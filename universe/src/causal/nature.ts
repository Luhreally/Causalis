// The ground, the crops and the sky in words: a land's soil fouled, salted, washed thin or its wells drawn down; a crop
// tamed, or carried from another land with its weeds and pests; a herd beast carried likewise; flocks heavy with
// parasites; a people fed and yet short; an eruption and the veil after it; the ice, the seas and the shore moved; the
// home star swelling, a star of the cluster ending, the home world dying. Each of these was a line of the Years that
// read as its raw kind, place and moment ("Lore.material-found at cell:0:3802 (t=9113904000)") until it had words.
// A record whose facts history has forgotten still says what happened and where.
import { yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import {
  CROP_EVENTS,
  DIET_EVENTS,
  ERUPTION_EVENTS,
  EXCHANGE_EVENTS,
  FARLIFE_EVENTS,
  GROUND_EVENTS,
  LINEAGE_EVENTS,
  MOTION_EVENTS,
} from "../sim/index.ts";
import { landWords, starKind } from "./generated.ts";
import { registerEventWords } from "./why.ts";
import { count } from "./words.ts";

type Facts = Readonly<Record<string, unknown>> | null;
const num = (data: unknown, key: string) => {
  const v = (data as Facts)?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const word = (data: unknown, key: string) => {
  const v = (data as Facts)?.[key];
  return typeof v === "string" && v ? v : null;
};
const year = (t: number) => `year ${yearOfMoment(t)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The land a number names (the land a crop or a beast came from). */
const landOf = (world: World, data: unknown, key: string) => {
  const c = num(data, key);
  return c === null || c < 0 ? null : landWords(world, cellRef(0, c) as Ref);
};
const inHundred = (n: number | null, of: string) =>
  n === null ? "" : `: ${n} in a hundred of ${of}`;

// —— The ground ———————————————————————————————————————————————————————————————————————————————
registerEventWords(
  GROUND_EVENTS.fouled.type,
  (world, e) =>
    `The ground of ${landWords(world, e.place)} was fouled by what its mines and works let run into it, and its fields bore less, ${year(e.t)}`,
);
registerEventWords(
  GROUND_EVENTS.salted.type,
  (world, e) =>
    `The watered fields of ${landWords(world, e.place)} grew salt, and bore less, ${year(e.t)}`,
);
registerEventWords(
  GROUND_EVENTS.washed.type,
  (world, e) =>
    `The topsoil of ${landWords(world, e.place)} had washed thin${inHundred(num(e.data, "top"), "it was left")}, ${year(e.t)}`,
);
registerEventWords(
  GROUND_EVENTS.drawnDown.type,
  (world, e) =>
    `The wells of ${landWords(world, e.place)} were drawn down faster than the rain filled them${inHundred(num(e.data, "water"), "its ground water was left")}, ${year(e.t)}`,
);

// —— Crops and beasts ——————————————————————————————————————————————————————————————————————————
registerEventWords(CROP_EVENTS.tamed.type, (world, e) => {
  const crop = word(e.data, "crop"),
    years = num(e.data, "years");
  return `In ${landWords(world, e.place)} people tamed ${crop ?? "a wild plant"} into a crop of their own${years !== null && years > 0 ? `, after ${count(years)} year${years === 1 ? "" : "s"} of sowing it` : ""}, ${year(e.t)}`;
});
registerEventWords(CROP_EVENTS.carried.type, (world, e) => {
  const crop = word(e.data, "crop"),
    had = word(e.data, "had"),
    from = landOf(world, e.data, "from");
  return `${cap(landWords(world, e.place))} took up ${crop ?? "a new crop"}${from ? ` from ${from}` : " from another land"}${had && had !== crop ? `, in place of ${had}` : ""}, ${year(e.t)}`;
});
registerEventWords(EXCHANGE_EVENTS.pests.type, (world, e) => {
  const crop = word(e.data, "crop"),
    from = landOf(world, e.data, "from");
  return `Weeds and pests came into ${landWords(world, e.place)} with ${crop ?? "a crop"}${from ? ` from ${from}` : " from another land"}, and its fields bore less for them, ${year(e.t)}`;
});
registerEventWords(EXCHANGE_EVENTS.beast.type, (world, e) => {
  const beast = word(e.data, "beast"),
    had = word(e.data, "had"),
    from = landOf(world, e.data, "from");
  return `${cap(landWords(world, e.place))} took up the keeping of ${beast ? `the ${beast}` : "a new herd beast"}${from ? ` from ${from}` : " from another land"}${had && had !== beast ? `, in place of the ${had}` : ""}, ${year(e.t)}`;
});
registerEventWords(
  LINEAGE_EVENTS.parasites.type,
  (world, e) =>
    `The flocks of ${landWords(world, e.place)}, kept close, grew heavy with parasites${inHundred(num(e.data, "toll"), "what they gave was lost")}, ${year(e.t)}`,
);
registerEventWords(
  DIET_EVENTS.poor.type,
  (world, e) =>
    `The people of ${landWords(world, e.place)} were fed, and yet went short of what their bodies build from, ${year(e.t)}`,
);

// —— The world's fires —————————————————————————————————————————————————————————————————————————
registerEventWords(ERUPTION_EVENTS.eruption.type, (world, e) => {
  const vei = num(e.data, "vei"),
    dead = num(e.data, "dead") ?? 0,
    lands = num(e.data, "lands") ?? 0,
    told = [
      ...(dead > 0 ? [`${count(dead)} died`] : []),
      ...(lands > 1 ? [`its ash fell on ${count(lands)} lands`] : []),
    ];
  return `A volcano erupted in ${landWords(world, e.place)}${vei === null ? "" : `, an eruption of ${vei} on the scale that ends at eight`}${told.length ? `: ${told.join(", and ")}` : ""}, ${year(e.t)}`;
});
registerEventWords(ERUPTION_EVENTS.veil.type, (_world, e) => {
  const k = num(e.data, "kelvin");
  return `A veil from a great eruption dimmed the sun over the whole world${k === null ? ", and it grew colder for a time" : `, and it grew ${k} °C colder for a time`}, ${year(e.t)}`;
});

// —— The ice, the seas, the shore ——————————————————————————————————————————————————————————————
const km2 = (data: unknown) => {
  const n = num(data, "km2");
  return n === null || n <= 0 ? "" : `: ${count(n)} km²`;
};
registerEventWords(
  MOTION_EVENTS.thawed.type,
  (world, e) =>
    `The ice over ${landWords(world, e.place)} melted away${km2(e.data)}${km2(e.data) ? " of it gone" : ""}, ${year(e.t)}`,
);
registerEventWords(
  MOTION_EVENTS.iced.type,
  (world, e) =>
    `Ice grew over ${landWords(world, e.place)}${km2(e.data)}${km2(e.data) ? " of it under the sheet" : ""}, ${year(e.t)}`,
);
registerEventWords(MOTION_EVENTS.seas.type, (_world, e) => {
  const m = num(e.data, "metres");
  if (m === null) return `The seas rose or fell another metre, ${year(e.t)}`;
  if (m === 0)
    return `The seas came back to where they stood when the world was made, ${year(e.t)}`;
  const n = Math.abs(m);
  return `The seas stood ${count(n)} metre${n === 1 ? "" : "s"} ${m > 0 ? "higher" : "lower"} than when the world was made, ${year(e.t)}`;
});
registerEventWords(MOTION_EVENTS.drowned.type, (world, e) => {
  const share = num(e.data, "share");
  return `The risen sea drowned ${share === null ? "part" : `${share} in a hundred`} of ${landWords(world, e.place)}, ${year(e.t)}`;
});
registerEventWords(MOTION_EVENTS.bared.type, (world, e) => {
  const share = num(e.data, "share");
  return `The fallen sea bared new shore along ${landWords(world, e.place)}${share === null ? "" : `, ${share} in a hundred more land than it had`}, ${year(e.t)}`;
});
registerEventWords(MOTION_EVENTS.overturn.type, (_world, e) => {
  const weak = (e.data as { weak?: boolean } | null)?.weak ?? true,
    left = num(e.data, "overturn");
  return weak
    ? `The seas' great overturning, which carries warmth toward the poles, weakened${left === null ? "" : ` to ${left} in a hundred of its strength`}, ${year(e.t)}`
    : `The seas' great overturning came back to more than half its strength, ${year(e.t)}`;
});
registerEventWords(
  MOTION_EVENTS.dying.type,
  (_world, e) =>
    `The home world was dying: over half the land its people could live on when it was made was gone, ${year(e.t)}`,
);

// —— The stars —————————————————————————————————————————————————————————————————————————————————
const ending = (how: string | null) =>
  how === "supernova" ? " in a supernova" : how === "white dwarf" ? ", and left a white dwarf" : "";
registerEventWords(MOTION_EVENTS.swelling.type, (_world, e) => {
  const risen = num(e.data, "risen");
  return `The home star began to swell at the end of its life${risen !== null && risen > 0 ? `, and shone ${count(risen)} in a hundred brighter than it had` : ""}, ${year(e.t)}`;
});
registerEventWords(MOTION_EVENTS.ended.type, (_world, e) => {
  const spectral = word(e.data, "spectral"),
    distance = num(e.data, "distance");
  return `${cap(spectral ? starKind({ spectral, remnant: false }) : "a star")}${distance === null ? " of the cluster" : ` ${distance} light-years away`} came to the end of its life${ending(word(e.data, "how"))}, ${year(e.t)}`;
});
registerEventWords(
  FARLIFE_EVENTS.starEnded.type,
  (_world, e) =>
    `The star of the ${word(e.data, "name") ?? "far people"} came to the end of its life${ending(word(e.data, "how"))}, ${year(e.t)}`,
);
