// What a people learned from what cost them, in words (the lessons, sim/lore/lessons.ts): who took up what, after how much, and from
// whom.
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { LESSON_EVENTS } from "../sim/index.ts";
import { LESSON_CAUSE, LESSON_RESPONSE, doesWords } from "../rules/index.ts";
import { landWords } from "./generated.ts";
import { registerEventWords } from "./why.ts";

type Taken = {
  lesson?: string;
  cause?: string;
  lost?: number;
  dead?: number;
  strikes?: number;
  since?: number;
  year?: number;
  realm?: string;
  from?: string;
  /** What they began to do, as their means were then (absent in older saves: the response's first words). */
  does?: string;
} | null;

const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Who took it up: a land's people, or a realm's hosts. */
function who(world: Parameters<typeof landWords>[0], place: string | null, d: Taken): string {
  if (place) return `The people of ${landWords(world, place as Ref)}`;
  return d?.realm ? `The hosts of ${d.realm}` : "A realm's hosts";
}

for (const type of [LESSON_EVENTS.taken.type, LESSON_EVENTS.copied.type])
  registerEventWords(type, (world, e) => {
    const d = e.data as Taken,
      r = LESSON_RESPONSE.get(d?.lesson ?? ""),
      c = LESSON_CAUSE.get(d?.cause ?? ""),
      year = d?.year ?? yearOfMoment(e.t),
      years = Math.max(1, year - (d?.since ?? year)),
      [unit, ...rest] = (c?.lost ?? "").split(" "),
      lost = d?.lost ?? 0,
      dead = d?.dead ?? 0,
      // ("120 homes and 40 lives lost to quakes", "40 lives lost to quakes": as the page says it.)
      what =
        unit === "homes" && dead > 0
          ? lost > 0
            ? `${thousands(lost)} homes and ${thousands(dead)} lives ${rest.join(" ")}`
            : `${thousands(dead)} ${dead === 1 ? "life" : "lives"} ${rest.join(" ")}`
          : `${thousands(lost)} ${c?.lost ?? ""}`,
      cost = c ? `${what} in ${years === 1 ? "a year" : `${years} years`}` : "what it cost them",
      from = d?.from
        ? d.from.startsWith("cell:")
          ? `, as the people of ${landWords(world, d.from as Ref)} did`
          : ", as their neighbours did"
        : "";
    return `${who(world, e.place, d)} began to ${d?.does ?? (r ? doesWords(r, () => false) : "change their ways")}${from}, after ${cost}, year ${year}`;
  });
