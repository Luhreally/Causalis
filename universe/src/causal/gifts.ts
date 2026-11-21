// The god's gifts through a body held, in words (2026-11-21: rules/gifts.ts): one healed by a touch, a stroke called down at
// a place, a wonder seen — told as the god's hand is told, through the one it was done in.
import { yearOfMoment } from "../kernel/index.ts";
import { POSSESS_EVENTS } from "../sim/index.ts";
import { registerEventWords } from "./why.ts";

/** A name without its town ("Teadryn of Sairis": "Teadryn"). */
const first = (name: unknown): string =>
  typeof name === "string" && name ? name.replace(/ of .*$/, "") : "one of their people";
/** A count with its thousands marked (the same on every device). */
const count = (n: number): string => `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const saw = (n: unknown): string =>
  typeof n === "number" && n > 0 ? `, seen by ${count(n)}` : ", unseen";

registerEventWords(POSSESS_EVENTS.healed.type, (_, e) => {
  const d = e.data as {
    name?: string;
    hand?: string;
    own?: boolean;
    was?: string;
    wounds?: number;
    seen?: number;
  } | null;
  const how =
    d?.was === "down"
      ? "raised up whole where they lay struck down"
      : d?.was === "hurt"
        ? "made whole of their hurts"
        : d?.wounds
          ? `healed of ${d.wounds === 1 ? "an old wound" : `${d.wounds} old wounds`}`
          : "touched and blessed";
  return d?.own
    ? `By your hand, through ${first(d?.hand)}: the god's touch made them whole${saw(d?.seen)}, year ${yearOfMoment(e.t)}`
    : `By your hand, through ${first(d?.hand)}: ${d?.name ?? "one of their people"} was ${how} at a touch${saw(d?.seen)}, year ${yearOfMoment(e.t)}`;
});

const STROKE: Readonly<Record<string, string>> = {
  lightning: "a bolt fell from a clear sky",
  fire: "fire fell from the sky",
  quake: "the ground shook under their feet",
  rain: "rain fell at a word",
};
registerEventWords(POSSESS_EVENTS.smote.type, (_, e) => {
  const d = e.data as {
    hand?: string;
    town?: string;
    smite?: string;
    struck?: number;
    seen?: number;
    field?: boolean;
  } | null;
  const where = d?.field ? " on the field" : d?.town ? ` in ${d.town}` : "",
    struck = d?.struck ? `, and struck down ${d.struck === 1 ? "one" : d.struck}` : "";
  return `By your hand, through ${first(d?.hand)}: ${STROKE[d?.smite ?? ""] ?? "the god's hand fell"}${where}${struck}${saw(d?.seen)}, year ${yearOfMoment(e.t)}`;
});

const SHOWN: Readonly<Record<string, string>> = {
  healed: "the struck made whole at a touch",
  lightning: "a bolt called down",
  fire: "fire called down",
  rain: "rain called down",
  quake: "the ground shaken",
  warded: "blows that did no harm",
  felled: "foes felled at a touch",
  flew: "one of their own rise into the air",
};
registerEventWords(POSSESS_EVENTS.wonder.type, (_, e) => {
  const d = e.data as { what?: string[]; seen?: number; hand?: string; town?: string } | null,
    what = (d?.what ?? []).map((w) => SHOWN[w] ?? w),
    list =
      what.length > 1
        ? `${what.slice(0, -1).join(", ")} and ${what.at(-1)}`
        : (what[0] ?? "a wonder");
  return `By your hand, through ${first(d?.hand)}: ${count(d?.seen ?? 0)} saw ${list}${d?.town ? ` at ${d.town}` : ""}, a sign of the god among them, year ${yearOfMoment(e.t)}`;
});
