// Money and the state in words (Round B, sim/money): a new money, a coin debased, prices rising; a tax laid, a tariff, a realm's
// trade with another shut by its word, goods slipping past its borders; crafters' guilds and workers' unions; underwriters at sea and
// harvests pooled. Every number is the event's own.
import { yearOfMoment } from "../kernel/index.ts";
import { MONEY_EVENTS, politiesOf, realmName } from "../sim/index.ts";
import { MONEY_WORDS, TAX_WORDS, type MoneyForm, type TaxBase } from "../rules/index.ts";
import { count } from "./words.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  year = (t: number) => `year ${yearOfMoment(t)}`,
  realm = (d: { realm?: string } | null) => cap(d?.realm ?? "a realm");

registerEventWords(MONEY_EVENTS.coin.type, (_w, e) => {
  const d = e.data as { realm?: string; form?: MoneyForm; good?: string | null } | null,
    form = d?.form ?? "metal";
  return `${realm(d)} came to pay in ${form === "metal" && d?.good ? `coin struck of ${d.good}` : MONEY_WORDS[form]}, ${year(e.t)}`;
});
registerEventWords(MONEY_EVENTS.debased.type, (_w, e) => {
  const d = e.data as {
    realm?: string;
    fine?: number;
    good?: string | null;
    unmet?: number;
  } | null;
  return `${realm(d)} debased its coin to ${d?.fine ?? 0} parts in a hundred of the ${d?.good ?? "metal"} it first held, its treasury ${count(d?.unmet ?? 0)} grain's worth short, ${year(e.t)}`;
});
registerEventWords(MONEY_EVENTS.dearer.type, (_w, e) => {
  const d = e.data as { realm?: string; rise?: number } | null;
  return `Prices in ${d?.realm ?? "a realm"} rose ${d?.rise ?? 0} in a hundred in a year, ${year(e.t)}`;
});
registerEventWords(MONEY_EVENTS.taxed.type, (_w, e) => {
  const d = e.data as { realm?: string; base?: TaxBase; rate?: number } | null;
  return `${realm(d)} first taxed ${TAX_WORDS[d?.base ?? "trade"]}, at ${d?.rate ?? 0} in a hundred, ${year(e.t)}`;
});
registerEventWords(MONEY_EVENTS.tariff.type, (_w, e) => {
  const d = e.data as { realm?: string; rate?: number } | null;
  return `${realm(d)} laid ${d?.rate ?? 0} in a hundred on goods from abroad, ${year(e.t)}`;
});
registerEventWords(MONEY_EVENTS.sanction.type, (_w, e) => {
  const d = e.data as { realm?: string; of?: string; shut?: number } | null;
  return `${realm(d)} shut ${d?.shut ?? 0} in a hundred of its trade with ${d?.of ?? "a realm"} it feared, ${year(e.t)}`;
});
registerEventWords(MONEY_EVENTS.smuggling.type, (_w, e) => {
  const d = e.data as { realm?: string; share?: number } | null;
  return `Goods slipped past ${d?.realm ?? "a realm"}'s borders, ${d?.share ?? 0} in a hundred of what it barred or taxed, ${year(e.t)}`;
});
registerEventWords(MONEY_EVENTS.guild.type, (_w, e) => {
  const d = e.data as { realm?: string; crafters?: number } | null;
  return `The ${count(d?.crafters ?? 0)} crafters of a land of ${d?.realm ?? "a realm"} bound themselves in a guild, ${year(e.t)}`;
});
registerEventWords(MONEY_EVENTS.union.type, (_w, e) => {
  const d = e.data as { realm?: string; crafters?: number } | null;
  return `The ${count(d?.crafters ?? 0)} who work the works of a land of ${d?.realm ?? "a realm"} bound themselves in a union, ${year(e.t)}`;
});
registerEventWords(MONEY_EVENTS.underwriters.type, (_w, e) => {
  const d = e.data as { realm?: string; loss?: number } | null;
  return `Underwriters in ${d?.realm ?? "a realm"} began to cover cargoes at sea against a loss of ${d?.loss ?? 0} in a hundred, ${year(e.t)}`;
});
registerEventWords(MONEY_EVENTS.pool.type, (_w, e) => {
  const d = e.data as { realm?: string; lands?: number } | null;
  return `The ${d?.lands ?? 0} lands of ${d?.realm ?? "a realm"} began to pool their harvests against a bad year, ${year(e.t)}`;
});

const subject = (world: Parameters<typeof politiesOf>[0], ref: string) => {
  const p = politiesOf(world).get(ref as never);
  return cap(p ? realmName(p) : "a realm");
};
registerDecisionWords(
  MONEY_EVENTS.debased.type,
  (w, d) => `${subject(w, d.subject)} debased its coin`,
);
registerDecisionWords(MONEY_EVENTS.taxed.type, (w, d) => `${subject(w, d.subject)} laid a new tax`);
registerDecisionWords(MONEY_EVENTS.tariff.type, (w, d) => `${subject(w, d.subject)} laid a tariff`);
registerDecisionWords(
  MONEY_EVENTS.sanction.type,
  (w, d) => `${subject(w, d.subject)} shut its trade with a realm it feared`,
);
