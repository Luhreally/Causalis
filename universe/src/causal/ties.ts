// What binds realms, in words (D1): who was called and how they answered, a league gathered and let go, a marriage and what a people has for one, a claim and
// what came of it, an envoy's errand, an embassy kept. Only ever what happened, who and why.
import { yearOfMoment } from "../kernel/index.ts";
import { TIE_EVENTS } from "../sim/index.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

type Data = Readonly<Record<string, unknown>> | null;
const text = (d: unknown, k: string, or = "a realm") => {
  const v = (d as Data)?.[k];
  return typeof v === "string" && v ? v : or;
};
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const year = (t: number) => `year ${yearOfMoment(t)}`;

/** What the bond was, after "bound by". */
export const BOND_WORDS: Readonly<Record<string, string>> = {
  overlord: "the oath its vassal swore it",
  vassal: "the oath it swore",
  league: "the compact they swore",
  pact: "their pact",
  kin: "the marriage between their houses",
};

/** Why one called did as it did, after their name. */
export const CALL_WHY: Readonly<Record<string, string>> = {
  bound: "came, as it was bound to",
  afraid: "would not come: the foe is too strong for it",
  spent: "would not come: it has a war of its own to fight",
  weary: "would not come: its people are still mourning its last war",
  cold: "would not come: it thinks too little of the one who called",
  court: "would not come: its court would not send them",
  truce: "could not come: a term of peace holds it from the foe",
  sworn: "could not come: it has sworn to another, and makes no war of its own",
  both: "stood aside: it is sworn to both of them",
  noway: "could not come: no land or sea road brings a host there",
};

registerEventWords(TIE_EVENTS.answered.type, (_, e) => {
  const d = e.data as { bond?: string; why?: string } | null,
    a = text(e.data, "a");
  return `Called by ${text(e.data, "b")} against ${text(e.data, "foe")}, by ${BOND_WORDS[d?.bond ?? ""] ?? "what was between them"}, ${a} ${CALL_WHY[d?.why ?? ""] ?? "gave no answer"}, ${year(e.t)}`;
});

/** A league's name, by what those who gathered are. */
export function leagueWords(town: string, form: string): string {
  switch (form) {
    case "brood":
      return `the Cluster of ${town}`;
    case "graft":
      return `the Shoal of ${town}`;
    case "foster":
      return `the Moot of ${town}`;
    default:
      return `the Compact of ${town}`;
  }
}

registerEventWords(TIE_EVENTS.league.type, (_, e) => {
  const d = e.data as { members?: readonly string[]; form?: string } | null,
    n = d?.members?.length ?? 0;
  return `${cap(leagueWords(text(e.data, "town", "many"), d?.form ?? "wed"))} was sworn against ${text(e.data, "against")}: ${n} realms who fear it stand together, ${year(e.t)}`;
});
registerEventWords(TIE_EVENTS.leagueEnded.type, (_, e) => {
  const d = e.data as { why?: string; years?: number; form?: string } | null,
    name = cap(leagueWords(text(e.data, "town", "many"), d?.form ?? "wed")),
    against = text(e.data, "against");
  const how =
    d?.why === "fell"
      ? `${against} is no more, and there is nothing left to fear`
      : d?.why === "faded"
        ? `${against} is not what it was, and the fear has gone`
        : d?.why === "old"
          ? "those who swore it are gone, and their heirs do not hold to it"
          : "too few are left to call it one";
  return `${name} let go after ${d?.years ?? "some"} years: ${how}, ${year(e.t)}`;
});

const FORM_WED: Readonly<Record<string, (w: string, t: string, a: string, b: string) => string>> = {
  wed: (w, t, a, b) => `${w} of ${a} was wed to ${t} of ${b}: a marriage between their houses`,
  foster: (w, t, a, b) =>
    `${a} and ${b} took in each other's young: ${w} went to be fostered, and ${t} came`,
  brood: (w, t, a, b) =>
    `The hive of ${a} gave of its brood to the hive of ${b}: ${w} went, and ${t} came`,
  graft: (w, t, a, b) =>
    `${a} and ${b} grafted reef to reef: ${w} and ${t} keep what grows between them`,
};
registerEventWords(TIE_EVENTS.match.type, (_, e) => {
  const d = e.data as { form?: string } | null,
    say = FORM_WED[d?.form ?? "wed"] ?? FORM_WED.wed!;
  return `${cap(say(text(e.data, "who", "one of them"), text(e.data, "to", "another"), text(e.data, "realm"), text(e.data, "other")))}, ${year(e.t)}`;
});

registerEventWords(TIE_EVENTS.claim.type, (_, e) => {
  const d = e.data as { end?: string; tie?: string; form?: string; wedYear?: number } | null,
    who = text(e.data, "who", "someone"),
    realm = text(e.data, "realm"),
    other = text(e.data, "other"),
    wed = text(e.data, "wed", "one of its house"),
    to = text(e.data, "to", "one of theirs"),
    whose =
      d?.form && d.form !== "wed"
        ? d.tie === "child"
          ? `of those ${wed} and ${to} raised between ${realm} and ${other}`
          : d.tie === "widowed"
            ? `who came from ${other} for ${wed}`
            : `who went from ${realm} to ${other}`
        : d?.tie === "child"
          ? `child of ${wed} and ${to}`
          : d?.tie === "widowed"
            ? `who had been wed to ${wed}, and is of ${other}`
            : `wed to ${to} of ${other}`,
    head = `${text(e.data, "old", "Its ruler")} died with no one left of the house, and ${who}, ${whose}, came forward for the seat of ${text(e.data, "town", "their fathers")}`;
  switch (d?.end) {
    case "passes":
      return `${head}. ${cap(realm)} passed to ${other}, and is its own no more, ${year(e.t)}`;
    case "seated":
      return `${head}. ${cap(realm)} took them, ${year(e.t)}`;
    case "war":
      return `${head}. ${cap(realm)} would not have them, and ${other} went to war for it, ${year(e.t)}`;
    default:
      return `${head}. ${cap(realm)} passed them by, ${year(e.t)}`;
  }
});

/** What an envoy carries, after "carrying". */
export const ERRAND_WORDS: Readonly<Record<string, string>> = {
  call: "a call to come to war",
  league: "word of a league against one all of them fear",
  match: "the terms of a bond between two houses",
  embassy: "the asking of a house to keep at the other's seat",
  claim: "a claim on an empty seat",
  pact: "the asking of a pact",
  gift: "a gift of grain",
};
registerEventWords(TIE_EVENTS.envoy.type, (_, e) => {
  const d = e.data as { errand?: string; answer?: string; by?: string } | null;
  return `${d?.by ? `By your hand, at the word of ${d.by}, ` : ""}${text(e.data, "who", "An envoy")} went from ${text(e.data, "fromTown", "one seat")} to ${text(e.data, "toTown", "another")}, carrying ${ERRAND_WORDS[d?.errand ?? ""] ?? "word"}, and was told ${d?.answer === "no" ? "no" : "yes"}, ${year(e.t)}`;
});
registerEventWords(TIE_EVENTS.embassy.type, (_, e) => {
  const d = e.data as { recalled?: boolean } | null;
  return d?.recalled
    ? `${cap(text(e.data, "a"))} and ${text(e.data, "b")} called their people home from each other's seats: there is war between them, ${year(e.t)}`
    : `${cap(text(e.data, "a"))} and ${text(e.data, "b")} keep their people at each other's seats now, and each knows the other's host the truer, ${year(e.t)}`;
});
registerDecisionWords("ties.call", () => "A call weighed");
registerDecisionWords("ties.league", () => "Those who feared it weighed it");
