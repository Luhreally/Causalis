// A war's course, to be watched unfolding on the globe (Phase 38 M193): its sides, where its
// host set out from and what it marched for, and each of its battles in turn with what came of
// it — from the war's record, whatever became of its realms since.
import type { Ref, World } from "../kernel/index.ts";
import {
  fieldedOf,
  homePlanet,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
} from "../sim/index.ts";
import type { Campaign, WarSide } from "../bridge/index.ts";
import { hostKinds, realmArms } from "./arms.ts";
import { battleOutcome } from "./battle.ts";
import { realmColor } from "./colors.ts";
import { CIVIL_SHORT } from "./inspect/strife.ts";
import { landTitle } from "./inspect/names.ts";

/** A war's course, by its ref or the event that began or ended it (null: no such war). */
export function campaignOf(world: World, ref: string): Campaign | null {
  const wars = warsOf(world),
    w = wars.get(ref as Ref) ?? wars.all().find((x) => x.event === ref || x.peace === ref);
  if (!w) return null;
  const pw = homePlanet(world).generated,
    grid = pw.fine.grid,
    realms = politiesOf(world),
    ctx = populationContext(world),
    spot = (cell: number) => pw.centre[cell] ?? -1,
    named = world.events.get(w.event)?.data as { a?: string; b?: string } | undefined,
    side = (realm: Ref, said: string | undefined): WarSide => {
      const r = realms.get(realm);
      return {
        ref: realm,
        name: r ? realmName(r) : (said ?? "a fallen realm"),
        color: realmColor(realm),
        fields: r ? Math.round(fieldedOf(ctx, r)) : 0,
        arms: realmArms(world, realm),
        host: hostKinds(world, realm),
      };
    },
    near = (a: number, b: number) => {
      const p = grid.positions;
      return p[a * 3]! * p[b * 3]! + p[a * 3 + 1]! * p[b * 3 + 1]! + p[a * 3 + 2]! * p[b * 3 + 2]!;
    },
    to = spot(w.prize);
  if (to < 0) return null;
  // The host set out from the attacker's land nearest what it wanted (its realm fallen since, from
  // where its first battle was fought).
  let from = -1,
    best = -Infinity;
  for (const m of realms.get(w.attacker)?.members ?? []) {
    const s = spot(m);
    if (s < 0 || m === w.prize) continue;
    const k = near(s, to);
    if (k > best) {
      best = k;
      from = s;
    }
  }
  if (from < 0) from = w.battles.length ? spot(w.battles[0]!.land) : to;
  const attacker = side(w.attacker, named?.a),
    defender = side(w.defender, named?.b);
  return {
    ref: w.ref,
    title: `The war of ${attacker.name} upon ${defender.name}`,
    attacker,
    defender,
    from,
    to,
    prize: landTitle(world, w.prize, true),
    declared: w.declared,
    ended: w.ended,
    now: Math.floor(world.now / (365 * 86_400)),
    battles: w.battles.map((b) => ({
      event: b.event,
      year: b.year,
      cell: b.land,
      spot: spot(b.land),
      land: landTitle(world, b.land, true),
      won: b.won,
      fallen: [b.fallen[0], b.fallen[1]] as const,
      outcome: battleOutcome(world, b),
    })),
    civil: w.civil ? CIVIL_SHORT[w.civil] : null,
  };
}
