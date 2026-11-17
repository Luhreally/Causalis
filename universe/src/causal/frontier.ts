// The Frontier in words (the galaxy's hazards and the far future): the home star's storms, the great stones found, turned
// and fallen, the galaxy's fire, the works in the sky, bodies written for a world, and minds past their makers.
import { yearOfMoment } from "../kernel/index.ts";
import {
  GALACTIC_EVENTS,
  IMPACT_EVENTS,
  MINDS_EVENTS,
  ORBITAL_EVENTS,
  WEATHER_EVENTS,
  WRITTEN_EVENTS,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerEventWords } from "./why.ts";
import { count } from "./words.ts";

type D = Record<string, unknown>;
const data = (e: { data?: unknown }) => (e.data ?? {}) as D;
const num = (x: unknown) => (typeof x === "number" ? x : 0);
const realm = (d: D) => (typeof d.realm === "string" ? d.realm : "a people");

registerEventWords(WEATHER_EVENTS.storm.type, (_world, e) => {
  const d = data(e);
  return `A storm from the home star, ${num(d.storm)} times 1859's at the world, burned the grids of ${count(num(d.lands))} land${num(d.lands) === 1 ? "" : "s"}: ${count(num(d.machines))} machines lost and ${count(num(d.dead))} dead in the dark months after, year ${yearOfMoment(e.t)}`;
});
registerEventWords(WEATHER_EVENTS.flare.type, (_world, e) => {
  const d = data(e);
  return `The home star flared ${Math.round(num(d.storm) / Math.max(0.01, num(d.usual)))} times past its usual greatest: ${d.field ? "its lights hung far from the poles" : "its fire came down through the air"}, year ${yearOfMoment(e.t)}`;
});

const CLASS_WORDS: D = {
  regional: "a stone that could lay a country waste",
  great: "a stone that could darken the world",
  dooming: "a stone that could end most of what lives",
};
const stoneWords = (d: D) =>
  `${d.comet ? "a comet" : String(CLASS_WORDS[String(d.cls)] ?? "a great stone")}, ${count(num(d.metres))} m wide`;

registerEventWords(IMPACT_EVENTS.found.type, (_world, e) => {
  const d = data(e);
  return `The realm of ${realm(d)} found ${d.comet ? "a comet" : "a stone"} ${count(num(d.metres))} m wide on its way to the world, to fall in year ${num(d.falls)}: ${num(d.left)} years off, year ${yearOfMoment(e.t)}`;
});
registerEventWords(IMPACT_EVENTS.turned.type, (_world, e) => {
  const d = data(e);
  return `The realm of ${realm(d)} turned ${d.comet ? "a comet" : "a stone"} ${count(num(d.metres))} m wide aside with a craft of ${count(num(d.tonnes))} tonnes, at a cost of ${count(num(d.cost))} machines, year ${yearOfMoment(e.t)}`;
});
registerEventWords(IMPACT_EVENTS.struck.type, (world, e) => {
  const d = data(e);
  return `${stoneWords(d)[0]!.toUpperCase()}${stoneWords(d).slice(1)}, fell ${d.sea ? "into the sea off" : "on"} ${landWords(world, e.place)} with ${count(num(d.mt))} megatons${d.seen ? ", seen coming" : ""}: ${count(num(d.dead))} dead in ${count(num(d.lands))} land${num(d.lands) === 1 ? "" : "s"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(
  IMPACT_EVENTS.dark.type,
  (_world, e) =>
    `The dust and smoke of a fallen stone darkened the whole sky: the fields failed and the rains with them, year ${yearOfMoment(e.t)}`,
);

registerEventWords(GALACTIC_EVENTS.supernova.type, (_world, e) => {
  const d = data(e);
  return `A ${d.kind === "white dwarf" ? "white dwarf blew up" : "great star died"} ${num(d.distance)} light-years away: its light stripped the world's high air, and more died under the sky it let through, year ${yearOfMoment(e.t)}`;
});
registerEventWords(GALACTIC_EVENTS.gamma.type, (_world, e) => {
  const d = data(e);
  return `A burst of gamma rays from ${count(num(d.distance))} light-years away struck the world's high air, year ${yearOfMoment(e.t)}`;
});
registerEventWords(GALACTIC_EVENTS.guest.type, (_world, e) => {
  const d = data(e);
  return `A new star shone in the sky, a great star dying some ${num(d.kly)} thousand light-years away, year ${yearOfMoment(e.t)}`;
});

registerEventWords(ORBITAL_EVENTS.begun.type, (_world, e) => {
  const d = data(e);
  return `The realm of ${realm(d)} set its first works in the sky on the system's small bodies, ${count(num(d.tonnes))} tonnes that build the next of themselves from what they mine, year ${yearOfMoment(e.t)}`;
});
registerEventWords(
  ORBITAL_EVENTS.silent.type,
  (_world, e) => `A works in the sky, left untended, fell silent, year ${yearOfMoment(e.t)}`,
);

registerEventWords(WRITTEN_EVENTS.begun.type, (world, e) => {
  const d = data(e);
  return `The realm of ${realm(d)} began to write its settlers' children for the worlds they live on, ${landWords(world, e.place)} first: what their bodies can be bent to bear, ${num(d.share)} in a hundred of what their halls keep out, year ${yearOfMoment(e.t)}`;
});
registerEventWords(WRITTEN_EVENTS.limbs.type, (_world, e) => {
  const d = data(e);
  return `The realm of ${realm(d)} gave its settlers limbs and senses of machines, bearing more of their worlds' cold and rays, year ${yearOfMoment(e.t)}`;
});

registerEventWords(MINDS_EVENTS.past.type, (_world, e) => {
  const d = data(e);
  return `The made minds of the realm of ${realm(d)} came to think more than all its people together, year ${yearOfMoment(e.t)}`;
});
registerEventWords(MINDS_EVENTS.free.type, (_world, e) => {
  const d = data(e);
  return `The made minds of the realm of ${realm(d)}, thinking ${count(Math.round(num(d.past)))} times as much as their makers, went their own way, and took the works in the sky they tended, year ${yearOfMoment(e.t)}`;
});
registerEventWords(MINDS_EVENTS.goneUp.type, (world, e) => {
  const d = data(e);
  return `Half the people of ${landWords(world, e.place)} have gone up into minds, leaving their bodies: ${count(num(d.up))} of them, year ${yearOfMoment(e.t)}`;
});
registerEventWords(MINDS_EVENTS.worldGone.type, (_world, e) => {
  const d = data(e);
  return `Half the world's people have gone up into minds: ${count(num(d.up))} gone, ${count(num(d.left))} still in their bodies, year ${yearOfMoment(e.t)}`;
});
