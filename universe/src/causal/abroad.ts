// Peoples abroad in words (sim/culture/abroad.ts): those of one people come to be a tenth of another's land.
import { yearOfMoment } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { ABROAD_EVENTS } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerEventWords } from "./why.ts";

registerEventWords(ABROAD_EVENTS.settled.type, (world, e) => {
  const d = e.data as { people?: string; share?: number; from?: number } | null,
    share = typeof d?.share === "number" ? Math.round(d.share / 10) : 0,
    from = typeof d?.from === "number" ? landWords(world, cellRef(0, d.from)) : null;
  return `Those who speak ${d?.people ?? "another tongue"}${from ? `, come from ${from},` : ""} came to be ${share ? `${share} in a hundred` : "many"} of the people of ${landWords(world, e.place)}, year ${yearOfMoment(e.t)}`;
});
