// A battle's dead (Phase 55 M224b, D5): they come from the men who close with the foe, struck down by
// the foe's arms against their own guard, and of the struck the share the blow and the care kill
// (rules/wounds.ts: the same rule that gives the wounded). Only the front fights (Lanchester, 1916),
// so no more of a host closes than ENGAGE times the foe. The beaten lose most in the rout (Gabriel
// and Metz, From Sumer to Rome, 1991). The farther the arms reach, the more a host spreads out and
// the fewer each man exposed loses (Dupuy, The Evolution of Weapons and Warfare, 1980): hence the
// `open` term past the bow's reach, beside the thinning under fire (war.ts FIRE.disperse). Pure.
import { dmath } from "../../kernel/index.ts";
import { fallenShare } from "../../rules/index.ts";
import type { HostTerms } from "./fell.ts";

/**
 * The constants of the dead. Of the engaged, `hit` are struck down (a winner's share: the beaten
 * lose `rout` times as many); no more of a host closes than `engage` times the foe; the reach of
 * fire past the bow's (`bow`, the range axis) opens the ranks by `open` for each unit; a foe's fire
 * punches through by `fire` for each unit of log(1 + fire); a host's guard turns a blow by `guard`
 * for each unit of protection; at most `most` of the engaged are struck.
 */
export const LOSSES = {
  hit: 0.75,
  rout: 2.25,
  engage: 3,
  open: 0.75,
  bow: 0.6,
  fire: 3,
  guard: 2,
  most: 0.9,
} as const;

/** A host as its losses read it: the men it brought, what it fought with. */
export type HostInBattle = { readonly fielded: number; readonly terms: HostTerms };

/** Of a host's men, those who close with the foe: no more than the foe's front can meet. */
function engagedOf(own: HostInBattle, foe: HostInBattle): number {
  return Math.min(own.fielded, LOSSES.engage * foe.fielded);
}

/**
 * The share of a host's engaged men struck down (killed or wounded): by the foe's punch against its
 * guard, more when beaten, more when the foe engages more, fewer under fire (`disperse`) and the
 * farther the arms reach (`reach`, the longer range of the two hosts).
 */
export function struckShare(
  own: HostInBattle,
  foe: HostInBattle,
  lost: boolean,
  disperse: number,
  reach: number,
): number {
  const punch = foe.terms.shock + LOSSES.fire * dmath.log1p(Math.max(0, foe.terms.fire)),
    through = punch / Math.max(1e-9, punch + LOSSES.guard * Math.max(0, own.terms.protection)),
    ratio = dmath.clamp(engagedOf(foe, own) / Math.max(1, engagedOf(own, foe)), 0.5, 2),
    open = 1 / (1 + LOSSES.open * Math.max(0, reach - LOSSES.bow));
  return Math.min(
    LOSSES.most,
    LOSSES.hit * (lost ? LOSSES.rout : 1) * through * ratio * disperse * open,
  );
}

/**
 * Each side's dead [attacker, defender]: of its engaged men those struck, and of the struck those
 * the foe's blow kills (rules/wounds.ts fallenShare, by its own guard, care and body of `size` kg).
 * At most 0.41 of the engaged, so never above the field.
 */
export function battleDead(
  a: HostInBattle,
  b: HostInBattle,
  won: boolean,
  disperse: number,
  size: number,
): readonly [number, number] {
  const reach = Math.max(a.terms.range, b.terms.range),
    dead = (own: HostInBattle, foe: HostInBattle, lost: boolean): number => {
      const engaged = engagedOf(own, foe),
        struck = Math.round(engaged * struckShare(own, foe, lost, disperse, reach));
      return Math.round(
        struck *
          fallenShare({
            blow: foe.terms.blow,
            shock: foe.terms.shock,
            protection: own.terms.protection,
            care: own.terms.care,
            size,
          }),
      );
    };
  return [dead(a, b, !won), dead(b, a, won)];
}
