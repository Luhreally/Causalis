// Peoples abroad in words (sim/culture/abroad.ts): those of one people come to be a tenth of another's land.
import { yearOfMoment } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { ABROAD_EVENTS } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";
import { count } from "./words.ts";

registerEventWords(ABROAD_EVENTS.settled.type, (world, e) => {
  const d = e.data as { people?: string; share?: number; from?: number } | null,
    share = typeof d?.share === "number" ? Math.round(d.share / 10) : 0,
    from = typeof d?.from === "number" ? landWords(world, cellRef(0, d.from)) : null;
  return `Those who speak ${d?.people ?? "another tongue"}${from ? `, come from ${from},` : ""} came to be ${share ? `${share} in a hundred` : "many"} of the people of ${landWords(world, e.place)}, year ${yearOfMoment(e.t)}`;
});

// Guests' pay sent home, where it is two in a thousand and more of what their land eats (sim/culture/abroad.ts sendHome; rules/remit.ts).
registerEventWords(ABROAD_EVENTS.remitted.type, (world, e) => {
  const d = e.data as {
      host?: number;
      guests?: number;
      grain?: number;
      share?: number;
      there?: number;
      home?: number;
    } | null,
    host = typeof d?.host === "number" ? landWords(world, cellRef(0, d.host)) : "another land";
  return `The ${count(d?.guests ?? 0)} of ${landWords(world, e.place)} who work as guests in ${host} send home ${count(d?.grain ?? 0)} of grain a year, ${d?.share ?? "some"} in a thousand of what their own land eats: a year's work is worth ${d?.there ?? "more"} there against ${d?.home ?? "less"} at home, year ${yearOfMoment(e.t)}`;
});
registerDecisionWords(
  "culture.remit",
  (world, d) => `What the guests in ${landWords(world, d.subject)} send to the land they came from`,
);
