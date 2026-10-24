// Credit in words (Phase 21 M143): a house of lending and its rising; grain lent to a hungry
// land, at what interest; a debt written off; a house failed. (M144: a realm's war chest, its
// debts repudiated, a jubilee; the god's hand forgiving a land its debts, or breaking a house.)
import { yearOfMoment, type CauseRef } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import {
  CREDIT_ACTS,
  CREDIT_EVENTS,
  HOUSE,
  creditOf,
  politiesOf,
  realmName,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import {
  edges,
  registerCommandWords,
  registerDecisionWords,
  registerEventWords,
  registerExplainer,
} from "./why.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  year = (t: number) => `year ${yearOfMoment(t)}`;
type Data = {
  name?: string;
  town?: string;
  stake?: number;
  grain?: number;
  rate?: number;
  owed?: number;
  years?: number;
  lost?: number;
  abroad?: string;
  realm?: string;
  enemy?: string;
  fallen?: boolean;
  freed?: number;
} | null;

registerExplainer(HOUSE.code, (world, ref) => {
  const store = creditOf(world),
    h = store?.house(ref);
  if (!store || !h) return null;
  const claim = `${cap(h.name)}, a house of lending in ${landWords(world, cellRef(0, h.cell))} since year ${h.year}: it holds ${count(Math.round(h.capital))} grain's worth and is owed ${count(Math.round(store.outstanding(h.ref)))}; it has lent ${count(h.lentEver)} in all, earned ${count(Math.round(h.earned))} in interest, lost ${count(Math.round(h.lost))}, and its family drew ${count(Math.round(h.drawn))}${h.failed !== null ? `; it failed in year ${h.failed}` : ""}`;
  const causes: CauseRef[] = [{ ref: h.event, role: "trigger", weight: 1 }];
  if (h.failedEvent) causes.push({ ref: h.failedEvent, role: "trigger", weight: 1 });
  return { ref, claim, basis: "recorded", t: null, causes: edges(world, causes) };
});

registerEventWords(CREDIT_EVENTS.founded.type, (world, e) => {
  const d = e.data as Data;
  return `${cap(d?.name ?? "a house")} began lending in ${d?.town ?? "a market town"}, in ${landWords(world, e.place)}, its stake ${count(d?.stake ?? 0)} grain's worth, ${year(e.t)}`;
});
registerEventWords(CREDIT_EVENTS.lent.type, (world, e) => {
  const d = e.data as Data;
  return `${cap(d?.name ?? "a house")}${d?.abroad ? `, of ${d.abroad},` : ""} lent ${landWords(world, e.place)} ${count(d?.grain ?? 0)} grain against its famine, at ${d?.rate ?? "?"} in a hundred a year, ${year(e.t)}`;
});
registerEventWords(CREDIT_EVENTS.lost.type, (world, e) => {
  const d = e.data as Data;
  return `${cap(d?.name ?? "a house")} wrote off the ${count(d?.owed ?? 0)} grain ${landWords(world, e.place)} owed it, unpaid ${d?.years ?? "many"} years, ${year(e.t)}`;
});
registerEventWords(CREDIT_EVENTS.failed.type, (world, e) => {
  const d = e.data as Data;
  return `${cap(d?.name ?? "a house")}, in ${landWords(world, e.place)}, failed, its losses (${count(d?.lost ?? 0)} grain's worth) more than it held: what it was owed forgiven, its town's savers ruined, every house lending dearer, ${year(e.t)}`;
});

registerEventWords(CREDIT_EVENTS.chest.type, (_world, e) => {
  const d = e.data as Data;
  return `${cap(d?.name ?? "a house")}${d?.abroad ? `, of ${d.abroad},` : ""} lent ${d?.realm ?? "a realm"} ${count(d?.grain ?? 0)} grain to pay its host in its war with ${d?.enemy ?? "its enemy"}, at ${d?.rate ?? "?"} in a hundred a year: a war chest, ${year(e.t)}`;
});
registerEventWords(CREDIT_EVENTS.defaulted.type, (_world, e) => {
  const d = e.data as Data;
  return `${cap(d?.realm ?? "a realm")}${d?.fallen ? ", fallen," : ", beaten and crushed by what it owed,"} repudiated the ${count(d?.owed ?? 0)} grain it owed ${d?.name ?? "a house of lending"} for its war; none will lend it for a war for twenty years, ${year(e.t)}`;
});
registerEventWords(CREDIT_EVENTS.jubilee.type, (_world, e) => {
  const d = e.data as Data;
  const debts = d?.owed
      ? `every debt its lands owed the houses of lending released (${count(d.owed)} grain)`
      : "",
    bound = d?.freed ? `${count(d.freed)} of its debt-bound set free` : "",
    what = [debts, bound].filter(Boolean).join(", and ") || "what was owed released";
  return `${cap(d?.realm ?? "a realm")} proclaimed a jubilee at its new ruler's coming: ${what}, ${year(e.t)}`;
});
registerEventWords(
  CREDIT_ACTS.forgive.type,
  (world, e) =>
    `By the god's hand ${landWords(world, e.place)} was forgiven every debt it owed (${count((e.data as Data)?.owed ?? 0)} grain), and its debt-bound freed, ${year(e.t)}`,
);
registerEventWords(
  CREDIT_ACTS.break.type,
  (world, e) =>
    `By the god's hand ${(e.data as Data)?.name ?? "a house of lending"}, in ${landWords(world, e.place)}, was broken, ${year(e.t)}`,
);
registerCommandWords(
  "act.forgive",
  (world, c) =>
    `Your act: you forgave ${landWords(world, cellRef(0, (c.args as { cell: number }).cell))} its debts, year ${yearOfMoment(c.t)}`,
);
registerCommandWords(
  "act.break",
  (world, c) =>
    `Your act: you broke the house of lending in ${landWords(world, cellRef(0, (c.args as { cell: number }).cell))}, year ${yearOfMoment(c.t)}`,
);

registerDecisionWords("credit.found", (_world, d) => {
  const o = d.outcome as { town?: string } | null;
  return `A house of lending rose in ${o?.town ?? "a market town"}`;
});
registerDecisionWords(
  "credit.lend",
  (world, d) => `${cap(landWords(world, d.subject))} borrowed grain against its famine`,
);
registerDecisionWords("credit.war", (world, d) => {
  const p = politiesOf(world).get(d.subject);
  return `${cap(p ? realmName(p) : "a realm")} borrowed to pay its host`;
});
registerDecisionWords("credit.jubilee", (world, d) => {
  const p = politiesOf(world).get(d.subject);
  return `${cap(p ? realmName(p) : "a realm")} released its lands' debts`;
});
