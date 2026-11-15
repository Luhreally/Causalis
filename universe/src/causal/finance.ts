// A realm's money and its fears in words (sim/finance): debt sold, to whom and for what; debt refused, and who lost by it; what one
// people held in another realm, taken; how a realm's wealth came to be owned; a realm come to fear how another is held. Every name
// is read off the numbers and the people's body (rules/finance.ts ownWords, wayWords): none is kept.
import { yearOfMoment } from "../kernel/index.ts";
import { FINANCE_EVENTS, homePlanet, politiesOf, realmName } from "../sim/index.ts";
import { LOSERS, ownWords, wayWords, type Way } from "../rules/index.ts";
import { count } from "./words.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  year = (t: number) => `year ${yearOfMoment(t)}`,
  list = (names: readonly string[]) =>
    names.length <= 1
      ? (names[0] ?? "")
      : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

type Sold = {
  realm?: string;
  grain?: number;
  home?: number;
  rate?: number;
  why?: "war" | "hunger" | "arms";
  abroad?: string[];
  foe?: string;
  feared?: string;
  backer?: string;
} | null;

registerEventWords(FINANCE_EVENTS.sold.type, (_world, e) => {
  const d = e.data as Sold,
    why =
      d?.why === "war"
        ? `to pay its host in its war${d.foe ? ` with ${d.foe}` : ""}`
        : d?.why === "hunger"
          ? "to feed its hungry seat"
          : `to arm against ${d?.feared ?? "a realm"}, whose way it fears`,
    abroad = d?.abroad?.length ? `the people of ${list(d.abroad)}` : "",
    home = (d?.home ?? 0) > 0 ? "its own people" : "",
    who = [home, abroad].filter(Boolean).join(" and ") || "its own people",
    backed = d?.backer && d.foe ? `; the people of ${d.backer} lent the readier for fearing ${d.foe}'s way` : "";
  return `${cap(d?.realm ?? "a realm")} sold ${count(d?.grain ?? 0)} grain's worth of its debt to ${who}, at ${d?.rate ?? "?"} in a hundred a year, ${why}${backed}, ${year(e.t)}`;
});

registerEventWords(FINANCE_EVENTS.refused.type, (_world, e) => {
  const d = e.data as {
      realm?: string;
      owed?: number;
      home?: number;
      abroad?: string[];
      beaten?: boolean;
      missed?: number;
    } | null,
    why = d?.beaten
      ? "beaten in war and crushed by what it owed"
      : (d?.missed ?? 0) > 0
        ? `its interest unpaid ${d!.missed === 1 ? "a year" : `${d!.missed} years`}`
        : "crushed by what it owed",
    abroad = d?.abroad?.length ? `the people of ${list(d.abroad)}` : "",
    home = (d?.home ?? 0) > 0 ? "its own savers" : "",
    who = [home, abroad].filter(Boolean).join(" and ");
  return `${cap(d?.realm ?? "a realm")}, ${why}, refused the ${count(d?.owed ?? 0)} grain's worth of debt it had sold${who ? `: ${who} lost what they held` : ""}, and none will lend it for twenty years, ${year(e.t)}`;
});

registerEventWords(FINANCE_EVENTS.lost.type, (_world, e) => {
  const d = e.data as { realm?: string; of?: string; owed?: number; fallen?: boolean } | null;
  return `The people of ${d?.realm ?? "a realm"} lost the ${count(d?.owed ?? 0)} grain's worth of ${d?.of ?? "another realm"}'s debt they held${d?.fallen ? ", that realm fallen" : ", refused"}, ${year(e.t)}`;
});

registerEventWords(FINANCE_EVENTS.taken.type, (_world, e) => {
  const d = e.data as {
      realm?: string;
      of?: string;
      share?: number;
      owed?: number;
      war?: boolean;
    } | null,
    what = [
      (d?.share ?? 0) > 0 ? `${d!.share} in a hundred of its listed works` : "",
      (d?.owed ?? 0) > 0 ? `${count(d!.owed!)} grain's worth of its debt` : "",
    ]
      .filter(Boolean)
      .join(" and ");
  return `${cap(d?.realm ?? "a realm")} took what the people of ${d?.of ?? "another realm"} held there (${what || "their holdings"}), ${d?.war ? "the two at war" : "closing itself to strangers' holdings"}, ${year(e.t)}`;
});

registerEventWords(FINANCE_EVENTS.owned.type, (world, e) => {
  const d = e.data as { realm?: string; own?: string; from?: number; to?: number; now?: number[] } | null,
    body = homePlanet(world).generated.life.people?.body,
    now = (d?.now ?? [50, 20]).map((x) => x / 100),
    was = [...now];
  was[d?.own === "common" ? 1 : 0] = (d?.from ?? 50) / 100;
  return `${cap(d?.realm ?? "a realm")}'s wealth came to be ${ownWords(now, body)}, where it was ${ownWords(was, body)}, ${year(e.t)}`;
});

registerEventWords(FINANCE_EVENTS.feared.type, (_world, e) => {
  const d = e.data as {
      realm?: string;
      of?: string;
      who?: number;
      mine?: number[];
      theirs?: number[];
    } | null,
    way = (v: number[] | undefined) =>
      v && v.length === 5 ? wayWords(v.map((x) => x / 100) as unknown as Way) : "";
  return `${cap(d?.realm ?? "a realm")} came to fear how ${d?.of ?? "another realm"} is held${way(d?.theirs) ? ` (there ${way(d?.theirs)}; at home ${way(d?.mine)})` : ""}: ${LOSERS[d?.who ?? 0]} would lose by it, ${year(e.t)}`;
});

const subject = (world: Parameters<typeof politiesOf>[0], ref: string) => {
  const p = politiesOf(world).get(ref as never);
  return cap(p ? realmName(p) : "a realm");
};
registerDecisionWords("finance.sell", (world, d) => `${subject(world, d.subject)} sold its debt`);
registerDecisionWords(
  "finance.fear",
  (world, d) => `${subject(world, d.subject)} came to fear another's way`,
);
registerDecisionWords(
  "finance.owned",
  (world, d) => `${subject(world, d.subject)}'s wealth changed hands`,
);
