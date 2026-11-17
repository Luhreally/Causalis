// What crosses a realm's borders unseen, ware by ware (the rule is rules/contraband.ts; what is kept, ./kept.ts CONTRA). Asked
// 2026-11-16: "why is it only what calms that I see smuggled, everything else is always zero". Reckoned in 188.money.trade with the
// realm's tariff, in its turn (LAWS_EVERY), from what that pass already read: the year's trade between realms by good (one walk of
// the flows), its border lands (one walk of their neighbours), and rows other systems keep. Each ware's wedge:
//   tariff    its tariff on goods from abroad, on every good it buys abroad;
//   sanction  its sanctions, and those laid on it, on the goods of the realm shut out (the trade that passes, and leaks);
//   war       every good the enemy's side of a border holds cheaper beyond carrying it: trade with the enemy forbidden;
//   licence   a house's licence over the trade (sim/order/houses.ts grants): its holder's markup;
//   law       its law on each kind of what calms, wakes, brings visions and eases pain (KIND_ROW), or its excise on it;
//   harm      arms, where it bars them to its people: what its underworld's groups buy of them.
// The share of each that crosses unseen is the black market's rule with the ware's bulk for its worth (rules/money.ts smuggled,
// rules/contraband.ts carryCost). The greatest few by their rent (wedge times what crossed) are kept, and a ware gone underground
// is told once. Nothing here moves a good: what crossed unseen is a reading of what the year's trade and laws make worth carrying.
import { dmath } from "../../kernel/index.ts";
import {
  CONTRA_CAUSES,
  GOODS,
  INTOX_KINDS,
  UNDERGROUND,
  WARE_ARMS,
  WARE_INTOX,
  armsBarred,
  carryCost,
  licenceRent,
  smuggled,
  wareDensity,
  wareName,
  wouldCross,
  type ContraCause,
} from "../../rules/index.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import type { Market } from "../economy/market.ts";
import type { Province } from "../population/model.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { housesOf } from "../order/houses.ts";
import { underworldOf } from "../order/underworld-kept.ts";
import {
  BAR,
  BAR_STORE,
  CONTRA,
  CONTRA_SLOTS,
  CONTRA_STORE,
  INTOX,
  INTOX_STORE,
  KINDS_STORE,
  KIND_ROW,
  kindBarred,
  moneyStore,
} from "./kept.ts";

/** What carrying a good a hundred kilometres costs, a unit of its bulk (sim/economy/systems.ts HAUL_PER_100KM, before roads). */
const HAUL = 0.08;
/** The share of a good's stock an enemy's land could spare across the border in a year. */
const SPARE = 0.5;

/** What 188.money.trade hands the reckoning of one realm. */
export type ContraRead = {
  readonly ctx: PopulationContext;
  readonly p: Polity;
  readonly lands: readonly { readonly prov: Province; readonly m: Market }[];
  /** Its imports from other realms this year by good (grain's worth), and of those the worth weighed by how far each source is shut. */
  readonly inBy: Float64Array | undefined;
  readonly shutBy: Float64Array | undefined;
  /** Its tariff (0 … 1), what its markets dealt this year (grain's worth), and its hold on its border (rules/money.ts smuggled). */
  readonly rate: number;
  readonly dealt: number;
  readonly hold: { force: number; capacity: number; corruption: number };
  readonly border: number;
  /** How far it is held by force, heard and word moves (HOLD). */
  readonly force: number;
  readonly voice: number;
  readonly word: number;
  /** The realms it is at war with now. */
  readonly foes: ReadonlySet<string>;
  /** Tell a ware gone underground (money.ts tell). */
  readonly tell: (data: Record<string, unknown>) => void;
};

type Ware = { ware: number; share: number; cause: ContraCause; worth: number; wedge: number };

const causeOf = (c: ContraCause) => CONTRA_CAUSES.indexOf(c) + 1;
/** The told bit for a realm's first ware gone underground (beside each ware's own, by its place). */
const UNDERGROUND_TOLD = 1 << 30;

/** One realm's wares smuggled, reckoned and kept. */
export function reckonContraband(r: ContraRead): void {
  const { ctx, p } = r,
    world = ctx.world,
    store = moneyStore(world, CONTRA_STORE);
  if (!store) return;
  const g = ctx.generated,
    wares: Ware[] = [],
    share = (wedge: number, ware: number) =>
      smuggled(wedge, r.hold, r.border, carryCost(wareDensity(ware)));
  // 1. The goods it buys abroad: its tariff, its sanctions, a house's licence over the trade.
  const grants = housesOf(world)
      ?.of(p.ref)
      ?.houses.reduce((s, h) => s + h.grants, 0),
    licence = dmath.clamp((grants ?? 0) / 1000, 0, 1),
    bought = r.inBy ? r.inBy.reduce((a, b) => a + b, 0) : 0,
    licenceWedge = licence * licenceRent(dmath.clamp(bought / Math.max(1, r.dealt), 0, 1));
  for (let gd = 0; gd < GOODS.length && r.inBy; gd++) {
    const seen = r.inBy[gd]!;
    if (seen <= 0) continue;
    const shut = (r.shutBy?.[gd] ?? 0) / seen,
      [cause, wedge] = (
        [
          ["tariff", r.rate],
          ["sanction", shut],
          ["licence", licenceWedge],
        ] as [ContraCause, number][]
      ).sort((a, b) => b[1] - a[1])[0]!;
    if (wedge <= 0) continue;
    const s = share(wedge, gd);
    // (What crossed unseen beside what was seen: a share s of all that crossed.)
    if (s > 0) wares.push({ ware: gd, share: s, cause, worth: (seen * s) / (1 - s), wedge });
  }
  // 2. Across a border at war: what the enemy's side holds cheaper, beyond carrying it, had war not forbidden the trade. Its wedge
  // is that gap, a share of the price: forbidden outright, the trade pays its outlaws the margin, and no more.
  if (r.foes.size) {
    const pos = g.grid.positions,
      radiusKm = 6371 * g.planet.radius,
      war = new Float64Array(GOODS.length),
      gaps = new Float64Array(GOODS.length),
      markets = marketsOf(world),
      realms = politiesOf(world);
    for (const { prov, m } of r.lands) {
      const a = prov.cell;
      for (let k = g.grid.offsets[a]!; k < g.grid.offsets[a + 1]!; k++) {
        const b = g.grid.neighbours[k]!,
          q = realms.of(b)?.ref;
        if (!q || !r.foes.has(q)) continue;
        const there = markets.get(b);
        if (!there) continue;
        const dx = pos[3 * a]! - pos[3 * b]!,
          dy = pos[3 * a + 1]! - pos[3 * b + 1]!,
          dz = pos[3 * a + 2]! - pos[3 * b + 2]!,
          haul = HAUL * ((dmath.sqrt(dx * dx + dy * dy + dz * dz) * radiusKm) / 100);
        for (let gd = 0; gd < GOODS.length; gd++) {
          const here = m.price[gd]!,
            gap = here - there.price[gd]! - haul * GOODS[gd]!.bulk;
          const would = wouldCross(SPARE * there.stock[gd]!, gap, here) * here;
          war[gd]! += would;
          gaps[gd]! += would * Math.min(1, gap / here);
        }
      }
    }
    for (let gd = 0; gd < GOODS.length; gd++) {
      if (war[gd]! <= 0) continue;
      const wedge = gaps[gd]! / war[gd]!,
        s = share(wedge, gd),
        worth = war[gd]! * s,
        had = wares.find((w) => w.ware === gd);
      if (s <= 0) continue;
      if (!had) wares.push({ ware: gd, share: s, cause: "war", worth, wedge });
      else if (worth * wedge > had.worth * had.wedge)
        Object.assign(had, { share: s, cause: "war", worth, wedge });
    }
  }
  // 3. What calms, wakes, brings visions and eases pain: its law on each kind, or its excise.
  const bar = moneyStore(world, BAR_STORE)?.get(p.ref),
    lands = moneyStore(world, INTOX_STORE);
  if (bar && lands) {
    const excise = bar[BAR.excise]! / 1000,
      price = bar[BAR.price]! / 1000,
      used = new Array<number>(INTOX_KINDS.length).fill(0),
      kindRow = moneyStore(world, KINDS_STORE)?.get(p.ref);
    for (const { prov } of r.lands) {
      const row = lands.get(prov.cell);
      if (!row) continue;
      for (let k = 0; k < INTOX_KINDS.length; k++)
        used[k]! += (prov.total() * row[INTOX.use + k]!) / 1000;
    }
    for (let k = 0; k < INTOX_KINDS.length; k++) {
      if (used[k]! <= 0) continue;
      const barred = kindBarred(world, p.ref, k),
        taxed = excise * (1 - barred),
        [cause, wedge] =
          barred >= taxed ? (["law", barred] as const) : (["excise", taxed] as const);
      if (wedge <= 0.01) continue;
      // (Forbidden, all of it is a black market's, grown or brought; taxed, only what comes from abroad can cross the border unseen.)
      const abroad = (kindRow?.[KIND_ROW.width * k + KIND_ROW.reach] ?? 0) / 1000,
        base = cause === "law" ? used[k]! : used[k]! * abroad,
        s = share(wedge, WARE_INTOX + k);
      if (s > 0 && base > 0)
        wares.push({ ware: WARE_INTOX + k, share: s, cause, worth: base * price * s, wedge });
    }
  }
  // 4. Arms, where it bars them to its people: what its underworld's groups buy of them crosses its borders unseen.
  const armsBar = armsBarred(r.force, r.voice, r.word);
  if (armsBar > 0.05) {
    let spent = 0;
    for (const grp of underworldOf(world)?.of(p.ref)?.groups ?? []) {
      const m = grp.means;
      if (!m || m.arms <= 0) continue;
      spent += (m.cost * m.arms) / Math.max(1, m.arms + m.armour + m.hidden + m.word);
    }
    const s = share(armsBar, WARE_ARMS);
    if (spent > 0 && s > 0)
      wares.push({ ware: WARE_ARMS, share: s, cause: "harm", worth: spent * s, wedge: armsBar });
  }
  // The greatest few by their rent; and the first ware a law, a war, a sanction or a licence drove underground, told once a realm
  // (what slips past a tariff is told as smuggling, money.smuggling).
  const kept = wares
    .filter((w) => w.share >= 0.01 && w.worth >= 1)
    .sort((a, b) => b.worth * b.wedge - a.worth * a.wedge || a.ware - b.ware)
    .slice(0, CONTRA_SLOTS);
  let told = store.at(p.ref, CONTRA.told);
  for (const w of kept) {
    const bit = 1 << w.ware;
    if (
      !(told & UNDERGROUND_TOLD) &&
      UNDERGROUND.causes.includes(w.cause) &&
      w.share >= UNDERGROUND.share &&
      w.worth >= UNDERGROUND.worth * r.dealt
    ) {
      told |= bit | UNDERGROUND_TOLD;
      r.tell({
        ware: wareName(w.ware),
        share: Math.round(w.share * 100),
        why: w.cause,
      });
    }
  }
  const row: number[] = [];
  for (let k = 0; k < CONTRA_SLOTS; k++) {
    const w = kept[k];
    row.push(
      w ? w.ware + 1 : 0,
      w ? w.share * 1000 : 0,
      w ? causeOf(w.cause) : 0,
      w ? w.worth : 0,
      w ? w.wedge * 1000 : 0,
    );
  }
  row.push(told);
  if (kept.length || store.get(p.ref)) store.set(p.ref, row);
}
