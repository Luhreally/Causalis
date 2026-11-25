// A land's unable (the last gaps, 2026-11-24; rules/disabled.ts): those of its grown a mishap, a settled sickness, foul air or its
// realm's wars have left unable to work, as many as are made so each year by the years they live on, the longer where someone keeps
// them. One row a land, weighed in the land's turn with its care and its old (society/care.ts), whose keepers they share. Their share
// of its grown is the share of its work not done (society/kept.ts daysWorkedOf, read wherever a land's work is reckoned): no one is
// moved, so the population's year costs what it did. (Moved among those a land keeps, as its children are, each land's fourteen more
// kinds of people cost first light some eight milliseconds a year at 1,317.)
import {
  defineEventType,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type SimTime,
} from "../../kernel/index.ts";
import { DISABLED, disabledOf, maimedLiving } from "../../rules/index.ts";
import { adults, type PopulationContext } from "../population/systems.ts";
import { smokeIn, airOf } from "../climate/air.ts";
import { endemicOf } from "../health/health.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { warsOf } from "../war/war.ts";
import { landTurn } from "./care.ts";
import {
  CARE_ROW,
  CARE_STORE,
  OLD_ROW,
  OLD_STORE,
  UNABLE_ROW,
  UNABLE_STORE,
  societyStore,
} from "./kept.ts";

export const UNABLE_EVENTS = {
  /** A land's unable come to a twentieth of its grown: who made them so, and who keeps them. */
  many: defineEventType("society.many-unable", 3),
};

/** A realm's maimed still living for each of its grown, and the war that maimed the most of them (null: none). */
function realmMaimed(
  ctx: PopulationContext,
  p: Polity,
  year: number,
  years: number,
): { each: number; war: Ref | null } {
  let living = 0,
    most = 0,
    war: Ref | null = null;
  for (const w of warsOf(ctx.world).hotOf(p.ref)) {
    const side = w.attacker === p.ref ? 0 : 1,
      left = maimedLiving(w.ended === null ? 0 : year - w.ended, years);
    if (left <= 0) continue;
    let n = 0;
    for (const b of w.battles) n += b.maimed?.[side] ?? 0;
    living += n * left;
    if (n * left > most) {
      most = n * left;
      war = w.event;
    }
  }
  if (living <= 0) return { each: 0, war: null };
  let grown = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (prov) grown += adults(prov, ctx.life);
  }
  return { each: grown > 0 ? living / grown : 0, war };
}

export function unableYear(ctx: PopulationContext, t: SimTime): void {
  const { world, life } = ctx,
    store = societyStore(world, UNABLE_STORE),
    care = societyStore(world, CARE_STORE),
    olds = societyStore(world, OLD_STORE);
  if (!store || !care || !olds) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    maimed = new Map<string, { each: number; war: Ref | null }>();
  // (What kills the grown before age does, and the years one of them has left on the mean: its kind's life table.)
  let hazard = Infinity;
  for (let b = 0; b < life.bands.length; b++)
    if (life.bands[b]! >= life.adulthood) hazard = Math.min(hazard, life.mortality[b]!);
  if (!(hazard < Infinity)) hazard = 0;
  const years = Math.max(1, (life.bands[life.bands.length - 1]! - life.adulthood) / 2);
  for (const p of ctx.provinces.all()) {
    const c = p.cell,
      was = store.get(c);
    if (was && !landTurn(c, year)) continue;
    if (p.total() <= 0) {
      store.drop(c);
      continue;
    }
    const realm = realms.of(c);
    let m = realm ? maimed.get(realm.ref) : undefined;
    if (realm && !m) {
      m = realmMaimed(ctx, realm, year, years);
      maimed.set(realm.ref, m);
    }
    const d = disabledOf({
      hazard,
      endemic: endemicOf(world, c),
      smoke: smokeIn(ctx, c),
      maimed: m?.each ?? 0,
      years,
      spared: (care.get(c)?.[CARE_ROW.spared] ?? 0) / 1000,
      neglected: (olds.get(c)?.[OLD_ROW.neglected] ?? 0) / 1000,
    });
    let told = was?.[UNABLE_ROW.told] ?? 0;
    if (told && d.share < DISABLED.told / 2) told = 0;
    if (!told && d.share >= DISABLED.told) {
      told = 1;
      const parts: [string, number][] = [
          ["maimed in its realm's wars", d.war],
          ["weakened by its settled sicknesses", d.sick],
          ["short of breath in its foul air", d.smoke],
          ["hurt at their work", d.mishap],
        ],
        decision = world.decisions.record({
          rule: UNABLE_EVENTS.many.type,
          subject: p.ref,
          outcome: { share: Math.round(d.share * 1000) / 10 },
          score: d.share,
          threshold: DISABLED.told,
          factors: [
            ...parts.map(([name, v]) => ({
              name,
              value: Math.round(v * 1000) / 1000,
              contribution: v,
              source: null,
            })),
            {
              name: "kept by kin, temple, savings or pension",
              value: Math.round(d.kept * 100) / 100,
              contribution: 0,
              source: null,
            },
          ],
        }),
        causes: CauseRef[] = [{ ref: decision, role: "trigger", weight: 0.6 }],
        smoked = world.hasStore("climate.air") ? airOf(world).smokeOf(c) : null;
      if (m?.war && d.war >= d.share / 4)
        causes.push({ ref: m.war, role: "pressure", weight: 0.2 });
      if (smoked && d.smoke >= d.share / 4)
        causes.push({ ref: smoked, role: "pressure", weight: 0.2 });
      world.events.emit({
        type: UNABLE_EVENTS.many.type,
        place: p.ref,
        causes,
        data: {
          share: Math.round(d.share * 1000) / 10,
          war: Math.round(d.war * 1000) / 10,
          sick: Math.round(d.sick * 1000) / 10,
          smoke: Math.round(d.smoke * 1000) / 10,
          mishap: Math.round(d.mishap * 1000) / 10,
          kept: Math.round(d.kept * 100),
        },
      });
    }
    store.set(c, [
      d.share * 1000,
      d.war * 1000,
      d.sick * 1000,
      d.smoke * 1000,
      d.mishap * 1000,
      d.kept * 1000,
      told,
    ]);
  }
}
