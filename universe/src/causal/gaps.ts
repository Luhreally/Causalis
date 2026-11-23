// The gaps of 2026-11-22 in words: a faith's head and the faith against a ruler (sim/belief/heads.ts), and a commander taken in
// battle and what became of them (sim/war/held.ts). What, who, cost and effect: never how.
import { yearOfMoment } from "../kernel/index.ts";
import { FAITH_HEAD_EVENTS, HELD_EVENTS } from "../sim/index.ts";
import { count } from "./words.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

type Data = Readonly<Record<string, unknown>> | null;
const text = (d: unknown, k: string, or = ""): string => {
  const v = (d as Data)?.[k];
  return typeof v === "string" && v ? v : or;
};
const num = (d: unknown, k: string): number => {
  const v = (d as Data)?.[k];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const year = (t: number) => `year ${yearOfMoment(t)}`;

/** How a faith finds its head, as a page or a line says it. */
export const FAITH_FORM_WORDS: Readonly<Record<string, string>> = {
  line: "by its line: the head's heir after them",
  chosen: "by its clergy, who raise the one of them who stands highest in the faith",
  council: "by its council of elders, the eldest of them speaking for it",
  learned: "by its learning: the most learned of its faithful",
};
/** What a ruler presses a faith for. */
export const CLASH_WHAT_WORDS: Readonly<Record<string, string>> = {
  offices: "who names its priests in their lands",
  tithes: "what their people give it",
  word: "whose word their people keep",
};

registerEventWords(FAITH_HEAD_EVENTS.head.type, (_, e) => {
  const form = text(e.data, "form"),
    how =
      form === "line"
        ? "heir of its line"
        : form === "chosen"
          ? "raised by its clergy"
          : form === "council"
            ? "eldest of its council"
            : form === "learned"
              ? "the most learned of its faithful"
              : "its new head",
    was = text(e.data, "was");
  return `${cap(text(e.data, "name", "One of its faithful"))} came to head ${text(e.data, "faith", "a faith")}, ${how}${was ? `, after ${was}` : ""}, ${year(e.t)}`;
});

registerEventWords(FAITH_HEAD_EVENTS.clash.type, (_, e) => {
  const what = CLASH_WHAT_WORDS[text(e.data, "what")] ?? "what it holds in his lands";
  return `The ruler of ${text(e.data, "realm", "a realm")} pressed ${text(e.data, "head", "the head")} of ${text(e.data, "faith", "a faith")} over ${what}, ${year(e.t)}`;
});

registerEventWords(
  FAITH_HEAD_EVENTS.invested.type,
  (_, e) =>
    `${cap(text(e.data, "realm", "A realm"))}'s seat took from ${text(e.data, "head", "the head")} of ${text(e.data, "faith", "a faith")} the naming of its priests in its lands, ${year(e.t)}`,
);

registerEventWords(
  FAITH_HEAD_EVENTS.cast.type,
  (_, e) =>
    `${cap(text(e.data, "head", "The head"))} of ${text(e.data, "faith", "a faith")} cast the ruler of ${text(e.data, "realm", "a realm")} out of the faith, ${year(e.t)}`,
);

registerEventWords(FAITH_HEAD_EVENTS.settled.type, (_, e) => {
  const how = text(e.data, "how"),
    realm = text(e.data, "realm", "a realm"),
    faith = text(e.data, "faith", "a faith"),
    years = num(e.data, "years");
  const said =
    how === "yielded"
      ? `The ruler of ${realm} yielded to the head of ${faith} and was taken back into it`
      : how === "a new ruler"
        ? `A new ruler of ${realm} was at one again with the head of ${faith}`
        : how === "returned"
          ? `${cap(faith)} names its own priests in ${realm} again`
          : how === "its own"
            ? `${cap(realm)} and the head of ${faith} have nothing between them any more`
            : `The ruler of ${realm} and the head of ${faith} came to a concord`;
  return `${said}${years > 0 ? `, after ${count(years)} years` : ""}, ${year(e.t)}`;
});

registerEventWords(HELD_EVENTS.chief.type, (_, e) => {
  const name = text(e.data, "name", "A commander"),
    a = text(e.data, "a", "the realm that held them"),
    b = text(e.data, "b", "their realm"),
    how = text(e.data, "how");
  switch (how) {
    case "exchanged":
      return `${cap(name)}, taken in battle by ${a}, was exchanged${text(e.data, "with") ? ` for ${text(e.data, "with")}` : ""} at the peace and went home to ${b}, ${year(e.t)}`;
    case "given up":
      return `${cap(name)}, taken in battle, was given up by ${a} at the peace and went home to ${b}, ${year(e.t)}`;
    case "ransomed":
      return `${cap(name)}, taken in battle, was bought back from ${a} by ${b}${num(e.data, "grain") ? ` for ${count(num(e.data, "grain"))} of grain` : ""}, ${year(e.t)}`;
    case "kept":
      return `${cap(name)}, taken in battle, is kept by ${a} past the peace: ${b} could not pay for them, ${year(e.t)}`;
    default:
      return `${cap(name)}, taken in battle, was let go by ${a}, ${year(e.t)}`;
  }
});

registerDecisionWords(
  "faith.clash",
  () => "A ruler weighed pressing the head of a faith held in their realm",
);
