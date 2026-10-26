// A battle's record (Phase 55 M224a): what the day cost besides its dead, and where each side's men
// came from. Of each side, the wounded who lived and of them the maimed, by the foe's blow and shock
// against the side's own guard, care and body (rules/wounds.ts); what each side bore, its arm and
// the stuff it was made of; and each side's men by the lands that sent them and, within each land,
// by its towns and its countryside (rules/apportion.ts): those sent, their fallen, their wounded.
// Read, never drawn: the counts as they were, so keeping the record moves no history but the war's
// own. The hand's village sends no one: its people are the god's to watch (weight 0).
import {
  WOUNDS,
  apportionCapped,
  blowOf,
  packTowns,
  performanceOf,
  sideWounds,
  splitTowns,
  woundCare,
  type Blow,
  type LandFell,
  type Material,
} from "../../rules/index.ts";
import { handOf } from "../hand/hand.ts";
import { loreOf } from "../lore/lore.ts";
import type { Polity } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Arms } from "./arms.ts";
import type { Battle } from "./war.ts";

/** The most of those in the field that fall; the rest are of the land, risen with it (host/battle.ts's rule). */
export const RISEN_KEPT = 0.9;
/** A battle's town tallies are kept this long (years: the roster's fates, M225); its lands' for good. */
export const FELL_TOWN_YEARS = 40;

/** What a side bore: its arm's realization id and material (rules/designs.ts). */
export type Bore = readonly [arm: string, material: Material];
/** One land's part in a side's day: its cell, the men it sent, their dead. */
export type Take = readonly [cell: number, sent: number, dead: number];

/** What a host fought with, as the wounds and (M224b) the losses read it. */
export type HostTerms = {
  /** Its arms' shock: performanceOf(arms.parts).shock, or 0. */
  readonly shock: number;
  /** Its guard: performanceOf(arms.parts).protection, or 0. */
  readonly protection: number;
  /** How far its arms reach: the design grammar's range axis, or 0. */
  readonly range: number;
  /** What its arms loose: arms.fire (armed × firepower). */
  readonly fire: number;
  /** The blow its arm strikes with (blunt where it has none). */
  readonly blow: Blow;
  /** The care its wounded get: woundCare at its seat now (0 … 1). */
  readonly care: number;
  /** Its arm part's id and material (null: no arm part). */
  readonly bore: Bore | null;
};

/** A side of a battle as its record reads it: its terms, those in its field, its fallen, its lands. */
export type SideInBattle = {
  readonly terms: HostTerms;
  readonly field: number;
  readonly fallen: number;
  readonly takes: readonly Take[];
};

/** What a realm's host fights with: its full kit as borne (not scaled by how armed it is), its care. */
export function hostTerms(ctx: PopulationContext, p: Polity, arms: Arms): HostTerms {
  const does = performanceOf(arms.parts),
    arm = arms.parts.find((x) => x.role === "arm"),
    lore = loreOf(ctx.world);
  return {
    shock: does.shock ?? 0,
    protection: does.protection ?? 0,
    range: does.range ?? 0,
    fire: arms.fire,
    blow: blowOf(arm?.id),
    care: woundCare((id) => !!lore.get(p.seat, id)),
    bore: arm ? [arm.id, arm.material] : null,
  };
}

/** The body the world's people fight in (kg): its people's, else WOUNDS.size. */
export function bodySize(ctx: PopulationContext): number {
  return ctx.generated.life.people?.body.size ?? WOUNDS.size;
}

/** Those in the field: its host, and those who rose with it where more fell than that. */
export function fieldOf(fielded: number, fallen: number): number {
  return Math.max(fielded, Math.ceil(fallen / RISEN_KEPT));
}

/** A land's people by town (founding order; the hand's village 0) and in its countryside. */
export function townShares(
  ctx: PopulationContext,
  cell: number,
): { people: number[]; countryside: number } {
  const towns = ctx.settlements.inProvince(cell),
    held = handOf(ctx.world).over(cell)?.village,
    people = towns.map((s) => (s.ref === held ? 0 : Math.max(0, s.population))),
    housed = towns.reduce((n, s) => n + Math.max(0, s.population), 0);
  return {
    people,
    countryside: Math.max(0, (ctx.provinces.get(cell)?.total() ?? 0) - housed),
  };
}

/** A side's lands and towns: its wounded split over its lands by those who came back, then each land over its towns. */
export function fellOf(ctx: PopulationContext, takes: readonly Take[], hurt: number): LandFell[] {
  const backs = takes.map(([, sent, dead]) => Math.max(0, sent - dead)),
    hurts = apportionCapped(hurt, backs, backs);
  return takes.map(([cell, sent, dead], k): LandFell => {
    const { people, countryside } = townShares(ctx, cell),
      hurtHere = hurts[k]!;
    // (Towns are always kept on a new battle: [] where the land has none, or none sent anyone.)
    return [
      cell,
      sent,
      dead,
      hurtHere,
      packTowns(splitTowns([sent, dead, hurtHere], people, countryside).towns),
    ];
  });
}

/** What the day cost besides its dead, and where each side's men came from. No draws. */
export function battleRecord(
  ctx: PopulationContext,
  sides: readonly [SideInBattle, SideInBattle],
): Required<Pick<Battle, "wounded" | "maimed" | "bore" | "fell">> {
  const size = bodySize(ctx),
    // (Each side is struck by its foe's blow and shock, against its own guard, care and body.)
    struck = (own: SideInBattle, foe: SideInBattle) =>
      sideWounds(own.fallen, own.field, {
        blow: foe.terms.blow,
        shock: foe.terms.shock,
        protection: own.terms.protection,
        care: own.terms.care,
        size,
      }),
    [s0, s1] = sides,
    w0 = struck(s0, s1),
    w1 = struck(s1, s0);
  return {
    wounded: [w0.wounded, w1.wounded],
    maimed: [w0.maimed, w1.maimed],
    bore: [s0.terms.bore, s1.terms.bore],
    fell: [fellOf(ctx, s0.takes, w0.wounded), fellOf(ctx, s1.takes, w1.wounded)],
  };
}
