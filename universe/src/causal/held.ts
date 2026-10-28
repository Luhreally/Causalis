// The god's hand in a soldier and in a beast, in words (Phase 61): the god fought as one of the men
// of a battle fought before a town, and what came of the day; ran as one of a town's flock or of the
// wild about it, and what it killed or where it strayed — the chronicle's lines and their pages'.
import { yearOfMoment } from "../kernel/index.ts";
import { FIGHT_EVENTS, WILD_EVENTS } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { registerCommandWords, registerEventWords } from "./why.ts";

/** A name without its town ("Ardo of Kesh": "Ardo"). */
const first = (name: unknown): string =>
  typeof name === "string" && name ? name.replace(/ of .*$/, "") : "one of the host";
const year = (t: number) => `year ${yearOfMoment(t)}`;

registerEventWords(FIGHT_EVENTS.soldier.type, (world, e) => {
  const d = e.data as { name?: string; town?: string } | null;
  return `By your hand: the god took the body of ${first(d?.name)}${d?.town ? ` of ${d.town}` : ""} on the field in ${landWords(world, e.place)}, as the battle was fought, ${year(e.t)}`;
});

registerEventWords(FIGHT_EVENTS.fought.type, (world, e) => {
  const d = e.data as {
      name?: string;
      town?: string;
      realm?: string;
      foe?: string;
      won?: boolean;
      turned?: boolean;
      felled?: number;
      wounded?: number;
      fate?: string;
      after?: string;
      fallen?: readonly number[];
    } | null,
    did = [
      d?.felled ? `felled ${count(d.felled)}` : "",
      d?.wounded ? `wounded ${count(d.wounded)}` : "",
    ].filter(Boolean),
    fate = d?.fate === "fell" ? "fell" : d?.fate === "wounded" ? "was struck down" : "",
    after =
      d?.after === "fell"
        ? "; let go, he fought on and fell"
        : d?.after === "wounded"
          ? "; let go, he fought on and was struck down"
          : "",
    held = did.length ? `${did.join(" and ")}${fate ? `, and ${fate}` : ""}` : fate,
    deeds = held ? `${held}${after}` : after ? `struck none down${after}` : "",
    day = d?.won ? `${d?.realm ?? "his side"} won the day` : `${d?.foe ?? "the foe"} won the day`,
    fallen = (d?.fallen ?? []).reduce((n, x) => n + x, 0);
  return `By your hand: the god fought as ${first(d?.name)}${d?.town ? ` of ${d.town}` : ""} for ${d?.realm ?? "his side"} in ${landWords(world, e.place)}, ${year(e.t)}${deeds ? `: he ${deeds}` : ""}; ${day}${d?.turned ? ", turned from what history had" : ""}, ${count(fallen)} fallen`;
});

registerEventWords(WILD_EVENTS.beast.type, (_, e) => {
  const d = e.data as { name?: string; kind?: string; town?: string } | null;
  return `By your hand: the god ran as ${d?.name ?? "a beast"}${d?.kind ? ` (${d.kind})` : ""} about ${d?.town ?? "a town"}, ${year(e.t)}`;
});

registerEventWords(WILD_EVENTS.ran.type, (_, e) => {
  const d = e.data as {
      name?: string;
      town?: string;
      killed?: number;
      flock?: number;
      strayed?: boolean;
      seconds?: number;
    } | null,
    done = [
      d?.killed
        ? `killed ${count(d.killed)}${d.flock ? `, ${count(d.flock)} of the flock` : ""}`
        : "",
      d?.strayed ? "strayed from its herd and was lost to it" : "",
    ].filter(Boolean);
  return `You let go of ${d?.name ?? "the beast"} about ${d?.town ?? "a town"}${done.length ? `: it ${done.join(", and ")}` : ""}, ${year(e.t)}`;
});

registerCommandWords(
  "possess.soldier",
  (_, c) =>
    `Your act: you took the body of ${first((c.args as { name?: string }).name)} in the battle, ${year(c.t)}`,
);
registerCommandWords(
  "possess.beast",
  (_, c) =>
    `Your act: you took the body of ${(c.args as { name?: string }).name ?? "a beast"}, ${year(c.t)}`,
);
registerCommandWords(
  "possess.held",
  (_, c) => `Your hand moved the body it held a second on, ${year(c.t)}`,
);
registerCommandWords(
  "possess.leave",
  (_, c) => `Your act: you let go of the body you held, ${year(c.t)}`,
);
