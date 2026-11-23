// Who may use what is found, in words (breadth round, 2026-11-23): a realm's grants of sole use begun and let lapse, and a craft a
// spy carried home. Only what happened, who and why.
import { yearOfMoment } from "../kernel/index.ts";
import { RIGHTS_EVENTS } from "../sim/index.ts";
import { principleName } from "./lore.ts";
import { registerEventWords } from "./why.ts";

type Data = Readonly<Record<string, unknown>> | null;
const text = (d: unknown, k: string, or = "a realm") => {
  const v = (d as Data)?.[k];
  return typeof v === "string" && v ? v : or;
};
const num = (d: unknown, k: string) => {
  const v = (d as Data)?.[k];
  return typeof v === "number" ? v : null;
};
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

registerEventWords(RIGHTS_EVENTS.granted.type, (_, e) => {
  const term = num(e.data, "term");
  return `${cap(text(e.data, "realm"))} began to grant its finders sole use of what they find${term ? ` for ${term} years` : ""}, year ${yearOfMoment(e.t)}: its lands found more than they learned of each other.`;
});

registerEventWords(RIGHTS_EVENTS.lapsed.type, (_, e) => {
  const years = num(e.data, "years");
  return `${cap(text(e.data, "realm"))} let its grants of sole use lapse${years !== null ? ` after ${years} years` : ""}, year ${yearOfMoment(e.t)}: its lands learned of each other more than they found.`;
});

registerEventWords(RIGHTS_EVENTS.stolen.type, (world, e) => {
  const id = (e.data as { principle?: string } | null)?.principle ?? null,
    granted = (e.data as { granted?: boolean } | null)?.granted;
  return `A spy of ${text(e.data, "a")} brought ${principleName(id, world)} home from ${text(e.data, "b")}${granted ? ", where it was under a grant" : ""}, year ${yearOfMoment(e.t)}.`;
});
