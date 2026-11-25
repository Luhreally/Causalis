// Those who fight their holder in a land held by force, fighting (2026-11-19). One representation: the land's resistance
// (sim/war/occupation.ts) is how far its people stand with those who fight; where a group of its people has formed to throw
// the holder off (sim/order/groups: a resistance, insurgents), that group is those who fight, under its leader's name; where
// none has, they are the land's own, unnamed. While a land is risen they fall on the soldiers posted there once a year: as
// many as its resistance draws of its fighting people, as its ground hides them, against the host its holder keeps in it.
// Both sides' dead are real (drawn from the land, and from the holder's seat that sent its host) and written. A raid that
// costs the posted more than the raiders hardens the land; one beaten off cows it. No draw decides it. Each side fights with
// the arms of its age: those who fight with what their holder's arms law left them, taken from the posted or bought, or with
// what the realm they were taken from sends; where those arms are fire, a few strike from cover before the posted can answer,
// and are gone before the rest come up (2026-11-22: as if the posted and their foes bore the same spears, no raid on first
// light from 1000 on cost the posted more than the raiders, and none on tide ever did). Level: an event a
// risen land a year, with a group and a named leader where one exists. Told, and watched in the town's streets
// (host/inspect/streetfight.ts).
import { defineEventType, yearOfMoment, type Ref, type SimTime } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { ORG_KINDS } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { realmName, type Polity } from "../polity/polity.ts";
import { orgsOf } from "../order/groups-kept.ts";
import { killOf } from "./held.ts";
import { poolOf } from "./levy.ts";

export const RAID_EVENTS = {
  /** Those who fight their holder fell on the soldiers posted in their land. */
  raid: defineEventType("war.raid", 3),
};

export const RAID = {
  /** Of a land's fighting people, the share who go out at a full resistance. */
  out: 0.04,
  /** Of the fewer side as it meets the other, the share each loses at even odds. */
  bite: 0.12,
  /** What a raid won adds to the land's resistance, and one beaten off takes. */
  hardens: 0.05,
  cows: 0.08,
  /** No raid of fewer than this. */
  least: 15,
  /** How far fire in their hands, at its fullest, multiplies what those who choose their hour do to the posted. */
  fire: 2,
} as const;

/**
 * What those who fight bear against the posted: their kit's power against the posted's (`ratio`, 0 … 1.5), and how far the
 * arms in their hands are fire (`fire`, 0 … 1: none on a world of spears).
 */
export type RaidArms = { readonly ratio: number; readonly fire: number };

/** The group of a realm's that fights its holder in a land (null: the land's own, unnamed). */
export function fightersOf(
  ctx: PopulationContext,
  holder: Polity,
  cell: number,
): { name: string; kind: string; leader: string; id: number; event: Ref; members: number } | null {
  const orgs = orgsOf(ctx.world)?.of(holder.ref)?.orgs;
  if (!orgs) return null;
  let best: (typeof orgs)[number] | null = null;
  for (const g of orgs) {
    const kind = ORG_KINDS[g.kind];
    if ((kind !== "resistance" && kind !== "insurgents") || !g.lands.includes(cell)) continue;
    if (!best || g.members > best.members || (g.members === best.members && g.id < best.id))
      best = g;
  }
  return best
    ? {
        name: best.name,
        kind: ORG_KINDS[best.kind]!,
        leader: best.leader.name,
        id: best.id,
        event: best.event,
        members: best.members,
      }
    : null;
}

/**
 * A risen land's raid on those posted in it: returns what its resistance gains or loses by it, and the event (null: none
 * this year). `posted`: the holder's host a land; `ground`: how well the land hides those who fight (0 … 1).
 */
export function raidIn(
  ctx: PopulationContext,
  holder: Polity,
  from: Ref,
  fromName: string,
  cell: number,
  resistance: number,
  ground: number,
  posted: number,
  arms: RaidArms,
  cause: Ref | null,
  t: SimTime,
): { by: number; event: Ref } | null {
  const year = yearOfMoment(t),
    pool = poolOf(ctx, cell, year),
    group = fightersOf(ctx, holder, cell),
    // (A group's own men at the least: they are those who fight.)
    out = Math.min(
      pool.men,
      Math.max(Math.round(pool.men * RAID.out * resistance), group?.members ?? 0),
    ),
    garrison = Math.round(posted);
  if (out < RAID.least || garrison < 1) return null;
  // (Hidden by their ground they choose their hour: they count for more than their number, as their arms are against the
  // posted's, the more where they strike first with fire from cover; the posted count for their own.)
  const weight = out * (0.5 + ground) * arms.ratio * (1 + RAID.fire * arms.fire),
    met = Math.min(weight, garrison),
    lostPosted = Math.min(garrison, Math.round(RAID.bite * met * Math.min(2, weight / garrison))),
    // (Those who choose their hour and their ground, or strike from afar and are gone, lose the fewer for it.)
    hide = Math.max(ground, 0.5 * arms.fire),
    // (How many of the posted they come under is their number and their ground, not their arms: better arms take more of the
    // posted and bring no more of them to bear on those who carry them. Reckoned from `met`, raiders who were outweighed more
    // than two to one lost the more the better they were armed: 28 of 191 with spears against 36 of 190 with fire, on juniper.)
    faced = Math.min(out * (0.5 + ground), garrison),
    lostRaiders = Math.min(
      out,
      Math.round(RAID.bite * faced * Math.min(2, garrison / weight) * (1 - 0.6 * hide)),
    ),
    key = cell * 2,
    deadRaiders = killOf(ctx, cell, pool.rows, lostRaiders, t, key, 20),
    deadPosted =
      holder.seat === cell
        ? 0
        : killOf(ctx, holder.seat, poolOf(ctx, holder.seat, year).rows, lostPosted, t, key + 1, 21),
    won = deadPosted > deadRaiders,
    all = deadPosted + deadRaiders,
    event = ctx.world.events.emit({
      type: RAID_EVENTS.raid.type,
      importance: all >= 1000 ? 4 : all >= 100 ? 3 : 2,
      subjects: [holder.ref, from],
      place: cellRef(0, cell),
      causes: [
        ...(cause ? [{ ref: cause, role: "trigger" as const, weight: 1 }] : []),
        ...(group ? [{ ref: group.event, role: "agent" as const, weight: 0.5 }] : []),
      ],
      data: {
        a: realmName(holder),
        b: fromName,
        out,
        posted: garrison,
        dead: [deadPosted, deadRaiders],
        won,
        ...(arms.fire > 0.05 ? { fire: Math.round(arms.fire * 100) } : {}),
        ...(group
          ? { group: group.name, kind: group.kind, leader: group.leader, gid: group.id }
          : {}),
      },
    });
  return { by: won ? RAID.hardens : -RAID.cows * Math.min(1, garrison / weight), event };
}
