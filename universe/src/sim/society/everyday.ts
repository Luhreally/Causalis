// A land's everyday life, year by year (the society sweep; the rules are rules/table.ts, dress.ts and leisure.ts).
//   187.society.table, a land every five years in its turn: what its people eat (of its food eaten last year) and how its own air,
//     coast, woods and brewing keep it: its food spoils by the share they spare it less (systems.ts foodMonth).
//   187.society.dress, a land every five years in its turn: the warmth its people need of clothes by their cold months and their own
//     coat, what their clothes are made of, how far clothes show who one is; the clothes it wants, which its crafters make
//     (economy/systems.ts) and which the cold's deaths are counted against.
//   187.society.leisure, a land every five years in its turn: its working day, its holy and feast days, its games; its feasts ease its
//     grievance against its realm (polity.ts).
// Nothing is drawn: each is read off the land's own numbers.
import { dmath, yearOfMoment, type SimTime } from "../../kernel/index.ts";
import { offworldSite, worldLife } from "../../gen/index.ts";
import {
  dimorphismOf,
  G,
  KEEPING_MEANS,
  OCC,
  bodyFunction,
  coatOf,
  displayOf,
  dressStuff,
  dressWanted,
  feastRelief,
  gamesOf,
  keepingMeans,
  keptShare,
  pairingOf,
  restDays,
  warmthNeeded,
  workingHours,
} from "../../rules/index.ts";
import { coastal } from "../population/model.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { loreOf } from "../lore/lore.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { woodsRead } from "../ecology/woods.ts";
import { SHARE, SHARES_STORE, moneyStore } from "../money/kept.ts";
import { DRESS_STORE, LEISURE_STORE, TABLE_STORE, societyStore } from "./kept.ts";
import { landMeans, landTurn } from "./care.ts";

/** A land's climate as its people live it (sealed halls on another world: mild, still and dry within). */
function climateOf(ctx: PopulationContext, cell: number) {
  const c = ctx.generated.climate,
    halls = !!offworldSite(ctx.generated, cell);
  return {
    halls,
    temperature: halls ? 18 : (c.temperature[cell] ?? 15),
    seasonality: halls ? 0 : (c.seasonality[cell] ?? 0),
    rain: halls ? 0 : (c.precipitation[cell] ?? 600),
  };
}

// —— 187.society.table ——————————————————————————————————————————————————————————————————————————————————

export function tableYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, TABLE_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    g = ctx.generated,
    markets = marketsOf(world),
    lore = loreOf(world),
    sugar = worldLife(g).sugar !== null,
    water = ctx.medium === "water";
  for (const p of ctx.provinces.all()) {
    const c = p.cell;
    if (store.get(c) && !landTurn(c, year)) continue;
    const m = markets.get(c);
    if (p.total() <= 0 || !m) {
      store.drop(c);
      continue;
    }
    const grain = m.book("used", G.grain),
      meat = m.book("used", G.meat),
      wild = m.book("used", G.wild),
      eaten = Math.max(1, grain + meat + wild),
      air = climateOf(ctx, c),
      means = keepingMeans({
        temperature: air.temperature,
        seasonality: air.seasonality,
        rain: air.rain,
        coast: !air.halls && coastal(g, c),
        woods: air.halls ? 0 : woodsRead(ctx, c).now,
        brews: sugar && !!lore.get(c, "brewing"),
        growth: air.halls ? 0 : dmath.clamp((g.life.diversity[c] ?? 0) / 8, 0, 1),
        water: water || air.halls,
      });
    store.set(c, [
      (1000 * grain) / eaten,
      (1000 * meat) / eaten,
      (1000 * wild) / eaten,
      ...KEEPING_MEANS.map((k) => means[k] * 1000),
      keptShare(means) * 1000,
    ]);
  }
}

// —— 187.society.dress ——————————————————————————————————————————————————————————————————————————————————

export function dressYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, DRESS_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    body = ctx.generated.life.people?.body,
    coat = coatOf(body?.skin),
    water = ctx.medium === "water",
    markets = marketsOf(world),
    lore = loreOf(world),
    culture = cultureOf(world),
    shares = moneyStore(world, SHARES_STORE);
  for (const p of ctx.provinces.all()) {
    const c = p.cell;
    if (store.get(c) && !landTurn(c, year)) continue;
    const m = markets.get(c),
      means = landMeans(ctx, p, m);
    if (!means || !m) {
      store.drop(c);
      continue;
    }
    const air = climateOf(ctx, c),
      need = air.halls ? 0 : warmthNeeded(air.temperature, air.seasonality, coat, water),
      wool = m.book("made", G.wool),
      hides = m.book("made", G.hides),
      // (Fibre its fields grow, where it weaves: a fiftieth of a unit a farmer a year, against what its flocks and hunters give.)
      fibre = lore.get(c, "loom") && p.knowsCultivation ? 0.02 * p.occupation(OCC.farmer) : 0,
      stuff = dressStuff(wool, hides, fibre),
      top = (shares?.at(c, SHARE.top) ?? 300) / 1000,
      display = displayOf(top, means.towns, culture.get(c)?.traits[WAY.piety] ?? 0.5);
    store.set(c, [
      need * 1000,
      coat * 1000,
      stuff.wool * 1000,
      stuff.hides * 1000,
      stuff.fibre * 1000,
      display * 1000,
      dressWanted(need, display) * 1000,
      lore.get(c, "dyeing") ? 1 : 0,
    ]);
  }
}

// —— 187.society.leisure ———————————————————————————————————————————————————————————————————————————————

export function leisureYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = societyStore(world, LEISURE_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    body = ctx.generated.life.people?.body,
    shape = body ? bodyFunction(body) : null,
    dimorphism = dimorphismOf(body, ctx.life.adulthood),
    water = ctx.medium === "water",
    markets = marketsOf(world),
    lore = loreOf(world),
    culture = cultureOf(world);
  for (const p of ctx.provinces.all()) {
    const c = p.cell;
    if (store.get(c) && !landTurn(c, year)) continue;
    const means = landMeans(ctx, p, markets.get(c));
    if (!means) {
      store.drop(c);
      continue;
    }
    const ways = culture.get(c),
      days = restDays(ways?.traits[WAY.piety] ?? 0.5, means.surplus),
      hardship = dmath.clamp(1 - p.leanest / 1000, 0, 1),
      games = gamesOf({
        hands: shape ? shape.hands || shape.arms > 0 : true,
        legs: shape ? shape.legs : 2,
        wings: shape ? shape.wings : 0,
        water,
        dimorphism,
        riding: !!lore.get(c, "riding"),
        reckoning: !!lore.get(c, "mathematics") || lore.effect(c, "writing") > 0,
        valour: ways?.traits[WAY.valour] ?? 0.5,
      });
    store.set(c, [
      workingHours(means.need) * 10,
      days.holy,
      days.feasts,
      games,
      feastRelief(days.holy + days.feasts, hardship) * 10_000,
      means.need * 1000,
    ]);
  }
}
