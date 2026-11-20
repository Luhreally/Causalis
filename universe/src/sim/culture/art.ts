// What each land makes for its own sake (rules/art.ts): once in ten years in the land's own year (as its ways are weighed), the
// works its makers, its rulers' and its faith's clergy's makers made through those years, what wore away of what it had, and
// its renown against its people. Read where a land's ways are drawn (a canon kept: culture.ts drawsWays) and where a realm's
// standing is weighed (works raised at its seat: order.ts addsStanding). One row a land; nothing that grows with history.
import { notableRenown } from "../notable/kept.ts";
import { worksRenown } from "../ideas/works-kept.ts";
import { YEAR, yearOfMoment, type Factor, type SimTime, type World } from "../../kernel/index.ts";
import {
  ART,
  ART_STUFF,
  GOODS,
  OCC,
  SENSE_ARTS,
  WAY_TRAITS,
  artLeans,
  artStanding,
  renownOf,
  worksAfter,
  worksMade,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Province } from "../population/model.ts";
import type { MarketStore } from "../economy/market.ts";
import type { Polity } from "../polity/polity.ts";
import { beliefOf } from "../belief/belief.ts";
import { templeOf } from "../belief/temple.ts";
import { addsStanding } from "../order/order.ts";
import { homePlanet } from "../planet/store.ts";
import { WAY, drawsWays } from "./culture.ts";
import { ART_ROW, ART_STORE, cultureRows } from "./rows.ts";

/** A land weighs its works once in so many years, each land in its own year. */
export const ART_EVERY = 10;

/** What a land's makers make works of: what they make most of, by its worth, among the goods works are made in (null: what the land gives). */
function stuffOf(world: World, cell: number): number | null {
  const m = world.store<MarketStore>("economy.markets").get(cell),
    made = m?.years.at(-1)?.ledger[0];
  if (!made) return null;
  let best = -1,
    worth = 0;
  for (let g = 0; g < GOODS.length; g++) {
    if (!ART_STUFF[GOODS[g]!.id]) continue;
    const w = (made[g] ?? 0) * GOODS[g]!.value;
    if (w > worth) {
      worth = w;
      best = g;
    }
  }
  return best < 0 ? null : best;
}

/** Who in a land makes works and how much, this year: its makers' spare share, its rulers, its faith's clergy there. Only reads. */
export function artMakers(
  ctx: PopulationContext,
  p: Province,
): { made: number; makers: number; spare: number; rulers: number; clergy: number } {
  const { world } = ctx,
    total = p.total(),
    working = total - p.occupation(OCC.dependent),
    food = p.occupation(OCC.forager) + p.occupation(OCC.farmer) + p.occupation(OCC.herder),
    spare = working > 0 ? Math.max(0, working - food) / working : 0,
    makers = p.occupation(OCC.crafter),
    rulers = p.occupation(OCC.leader),
    faith = world.hasStore("belief.faiths") ? beliefOf(world).of(p.cell).faith : null,
    f = faith ? beliefOf(world).get(faith) : undefined,
    temple = f ? templeOf(world, f) : null,
    clergy = temple && temple.faithful > 0 ? (temple.clergy * total) / temple.faithful : 0;
  return { made: worksMade(makers, spare, rulers, clergy), makers, spare, rulers, clergy };
}

/** A land's works as last weighed, or null. */
export function artOf(
  world: World,
  cell: number,
): {
  works: number;
  made: number;
  renown: number;
  court: number;
  clergy: number;
  stuff: string;
  form: string;
  at: number;
} | null {
  const row = cultureRows(world, ART_STORE)?.get(cell);
  if (!row) return null;
  const stuff = row[ART_ROW.stuff]! - 1,
    senses = homePlanet(world).generated.life.people?.body.senses ?? ["sight"];
  return {
    works: row[ART_ROW.works]! / 10,
    made: row[ART_ROW.made]! / 10,
    renown: row[ART_ROW.renown]! / 1000,
    court: row[ART_ROW.court]! / 1000,
    clergy: row[ART_ROW.clergy]! / 1000,
    stuff:
      stuff >= 0 ? (ART_STUFF[GOODS[stuff]!.id] ?? "what the land gives") : "what the land gives",
    form: SENSE_ARTS[senses[0] ?? "sight"],
    at: row[ART_ROW.at]!,
  };
}

/** The year's works: each peopled land in its year of ten adds what its makers made those years, less what wore away. */
export function artYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    rows = cultureRows(world, ART_STORE);
  if (!rows) return;
  const year = yearOfMoment(t);
  for (const p of ctx.provinces.all()) {
    if ((year + p.cell) % ART_EVERY !== 0) continue;
    const row = rows.get(p.cell),
      people = p.total();
    if (!people) {
      if (row) rows.drop(p.cell);
      continue;
    }
    const m = artMakers(ctx, p),
      years = row ? Math.min(5 * ART_EVERY, Math.max(1, year - row[ART_ROW.at]!)) : ART_EVERY,
      works = worksAfter(row ? row[ART_ROW.works]! / 10 : 0, m.made, years);
    if (!row && works <= 0) continue;
    const stuff = stuffOf(world, p.cell);
    rows.set(p.cell, [
      Math.round(works * 10),
      Math.round(m.made * 10),
      // (More for its makers of name: sim/notable. Exactly as before where no one is kept.)
      // (And for the works of name kept there: sim/ideas. Exactly as before where none is.)
      Math.round(
        renownOf(works, people) *
          notableRenown(world, p.cell) *
          worksRenown(world, p.cell, year) *
          1000,
      ),
      m.made > 0 ? Math.round(((ART.court * m.rulers) / m.made) * 1000) : 0,
      m.made > 0 ? Math.round(((ART.clergy * m.clergy) / m.made) * 1000) : 0,
      stuff === null ? 0 : stuff + 1,
      year,
    ]);
  }
}

/** What a land's works draw of its ways: its canon keeps its custom, and where its faith keeps its makers, its piety. */
function artLean(world: World, cell: number): readonly number[] | null {
  const a = artOf(world, cell);
  if (!a || a.renown <= 0) return null;
  const l = artLeans(a.renown, a.clergy);
  return WAY_TRAITS.map((_, i) =>
    i === WAY.tradition ? l.tradition : i === WAY.piety ? l.piety : 0,
  );
}

/** What the works raised at a realm's seat give its standing. */
function artFactors(ctx: PopulationContext, realm: Polity): Factor[] {
  const a = artOf(ctx.world, realm.seat);
  if (!a) return [];
  const contribution = artStanding(a.renown, a.court);
  return contribution > 0.0005
    ? [{ name: "works raised at its seat", value: a.renown, contribution, source: null }]
    : [];
}

/** Teach a peopled world its works. */
export function installArt(world: World, ctx: () => PopulationContext): void {
  world.system({ key: "178.culture.art", every: YEAR, run: (t) => artYear(ctx(), t) });
  drawsWays(artLean);
  addsStanding(artFactors);
}
