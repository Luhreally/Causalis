// The ledger's Treasury tab (asked 2026-11-16: "whatever else is relevant to be on ledger"): Round B's money and the state, realm
// beside realm. What serves each as money and how its prices went last year, what its treasury took in and spent (on arms, on
// relief), what it kept and went short, its taxes' burden, its tariff and whom it shuts out; and of its lands, people-weighted, how
// unequal their income, how many of their people bound, and the lands whose crafters keep a guild or whose hands a union. Every
// number is a store's (sim/money/kept.ts), read in one pass a store, never reckoned anew; a realm's Treasury and Labour tabs tell
// each whole (host/inspect/money.ts).
import type { World } from "../../kernel/index.ts";
import type { Block, Row } from "../../bridge/index.ts";
import { GOODS, MONEY_FORMS, type MoneyForm } from "../../rules/index.ts";
import {
  BIND,
  BIND_STORE,
  COIN,
  COIN_STORE,
  DUTY,
  FISC,
  GUILD,
  LABOUR_STORE,
  SHARE,
  SHARES_STORE,
  TARIFF_STORE,
  TREASURY_STORE,
  moneyStore,
} from "../../sim/index.ts";
import { grainSum } from "../../causal/index.ts";
import { count, link } from "./words.ts";
import {
  allTold,
  honest,
  mostLeast,
  mostLeastBlock,
  pct,
  per,
  realmMean,
  type LedgerCtx,
} from "./ledger-kit.ts";

/** What serves a realm as money, in a word or two. */
function moneyWord(form: MoneyForm, good: number): string {
  if (form === "metal") return GOODS[good] ? `${GOODS[good]!.name} coin` : "coin";
  return form === "barter" ? "barter" : form === "paper" ? "notes" : "credit";
}

const grain = (n: number) => grainSum(Math.max(0, Math.round(n)));

/** Every realm's money and treasury, side by side; its lands' inequality, bondage and guilds. */
export function treasuryLedger(world: World, lc: LedgerCtx): Block[] {
  const coins = moneyStore(world, COIN_STORE),
    fiscs = moneyStore(world, TREASURY_STORE),
    duties = moneyStore(world, TARIFF_STORE),
    shares = moneyStore(world, SHARES_STORE),
    binds = moneyStore(world, BIND_STORE),
    guilds = moneyStore(world, LABOUR_STORE),
    rows: Row[] = [],
    took: { r: string; took: number; spent: number; burden: number; prices: number }[] = [];
  let allTook = 0,
    allArms = 0,
    allRelief = 0,
    short = 0,
    guildLands = 0,
    unionLands = 0;
  for (const r of lc.standing) {
    const coin = coins?.get(r.ref),
      fisc = fiscs?.get(r.ref),
      duty = duties?.get(r.ref);
    if (!coin && !fisc) continue;
    const form = coin ? ((MONEY_FORMS[coin[COIN.form]!] ?? "barter") as MoneyForm) : "barter",
      prices = coin && form !== "barter" ? coin[COIN.inflation]! / 10_000 : 0,
      income = fisc
        ? fisc[FISC.take]! +
          fisc[FISC.take + 1]! +
          fisc[FISC.take + 2]! +
          fisc[FISC.take + 3]! +
          fisc[FISC.tariffs]! +
          fisc[FISC.seigniorage]! +
          (fisc[FISC.excise] ?? 0)
        : 0,
      spent = fisc
        ? fisc[FISC.arms]! + fisc[FISC.clerks]! + fisc[FISC.relief]! + fisc[FISC.interest]!
        : 0,
      deficit = fisc?.[FISC.deficit] ?? 0,
      burden = fisc?.[FISC.burden] ?? 0,
      tariff = duty?.[DUTY.rate] ?? 0;
    let sanctions = 0;
    for (let k = 0; k < 3 && duty; k++)
      if (duty[DUTY.sanctions + 2 * k]! && duty[DUTY.sanctions + 2 * k + 1]! >= 20) sanctions++;
    const gini = realmMean(lc, r, (c) => {
        const s = shares?.get(c);
        return s ? s[SHARE.gini]! / 1000 : null;
      }),
      bound = realmMean(lc, r, (c) => {
        const b = binds?.get(c);
        return b ? b[BIND.share]! / 1000 : null;
      });
    let guild = 0,
      union = 0;
    for (const c of r.members) {
      const g = guilds?.get(c);
      if (!g) continue;
      if (g[GUILD.guild]! >= 300) guild++;
      if (g[GUILD.union]! >= 300) union++;
    }
    allTook += income;
    allArms += fisc?.[FISC.arms] ?? 0;
    allRelief += fisc?.[FISC.relief] ?? 0;
    if (deficit > 0) short++;
    guildLands += guild;
    unionLands += union;
    took.push({ r: r.ref, took: income, spent, burden, prices });
    rows.push({
      ref: `${r.ref}#treasury`,
      cells: [
        [link(r.town, r.ref)],
        [coin ? moneyWord(form, coin[COIN.good]!) : "—"],
        [
          form === "barter"
            ? "—"
            : prices === 0
              ? "held"
              : `${prices > 0 ? "+" : "−"}${pct(Math.abs(prices))}`,
        ],
        [grain(income)],
        [grain(fisc?.[FISC.arms] ?? 0)],
        [grain(fisc?.[FISC.relief] ?? 0)],
        [deficit > 0 ? `short ${grain(deficit)}` : grain(fisc?.[FISC.reserve] ?? 0)],
        [per(burden)],
        [tariff ? `${per(tariff)}${sanctions ? `, shuts ${count(sanctions)}` : ""}` : "none"],
        [gini === null ? "—" : gini.toFixed(2)],
        [bound === null ? "—" : pct(bound)],
        [guild || union ? `${count(guild)} · ${count(union)}` : "none"],
      ],
      keys: [
        r.town,
        coin ? form : "",
        prices,
        income,
        fisc?.[FISC.arms] ?? 0,
        fisc?.[FISC.relief] ?? 0,
        deficit > 0 ? -deficit : (fisc?.[FISC.reserve] ?? 0),
        burden,
        tariff,
        gini ?? -1,
        bound ?? -1,
        guild + union,
      ],
    });
  }
  if (!rows.length) return honest("No realm keeps a treasury yet: none has taxed its people.");
  // (The greatest takings first.)
  const order = new Map(took.map((t) => [t.r, t.took]));
  rows.sort(
    (a, b) =>
      order.get(b.ref!.split("#")[0]!)! - order.get(a.ref!.split("#")[0]!)! ||
      (a.ref! < b.ref! ? -1 : 1),
  );
  const name = (ref: string) => link(lc.standing.find((r) => r.ref === ref)!.town, ref);
  return [
    allTold([
      { label: "Realms keeping a treasury", value: [count(rows.length)] },
      { label: "Their takings a year", value: [`${grain(allTook)} grain's worth`] },
      { label: "Spent on men under arms", value: [`${grain(allArms)} grain's worth`] },
      { label: "Spent on relief", value: [`${grain(allRelief)} grain's worth`] },
      { label: "Went short last year", value: [count(short)] },
      {
        label: "Lands with a guild · a union",
        value: [`${count(guildLands)} · ${count(unionLands)}`],
      },
    ]),
    {
      type: "table",
      title: "Each realm's money and treasury",
      columns: [
        "Realm",
        "Money",
        "Prices",
        "Took in",
        "Arms",
        "Relief",
        "Kept",
        "Tax burden",
        "Tariff",
        "Gini",
        "Bound",
        "Guilds · unions",
      ],
      rows,
    },
    ...mostLeastBlock([
      mostLeast(
        "Took in most",
        took.map((t) => ({ name: name(t.r), value: t.took, said: grain(t.took) })),
      ),
      mostLeast(
        "Heaviest taxes",
        took.map((t) => ({ name: name(t.r), value: t.burden, said: per(t.burden) })),
      ),
      mostLeast(
        "Prices rose most",
        took
          .filter((t) => t.prices !== 0)
          .map((t) => ({
            name: name(t.r),
            value: t.prices,
            said: `${t.prices > 0 ? "+" : "−"}${pct(Math.abs(t.prices))}`,
          })),
      ),
    ]),
  ];
}
