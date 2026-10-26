// A war's course, to be watched unfolding on the globe (Phase 38 M193): its sides, where its
// host set out from and what it marched for, and each of its battles in turn with what came of
// it — from the war's record, whatever became of its realms since. And the wars of an age, to be
// watched unfolding together (M194).
import { YEAR, type Ref, type World } from "../kernel/index.ts";
import {
  fieldedOf,
  homePlanet,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
  type War,
} from "../sim/index.ts";
import type { Campaign, WarAge, WarSide } from "../bridge/index.ts";
import { hostKinds, realmArms } from "./arms.ts";
import { battleOutcome } from "./battle.ts";
import { realmColor } from "./colors.ts";
import { CIVIL_SHORT } from "./inspect/strife.ts";
import { landTitle } from "./inspect/names.ts";

/** What every war's course is read against: the globe's grid, the realms, their peoples. */
type Read = {
  readonly world: World;
  readonly pw: ReturnType<typeof homePlanet>["generated"];
  readonly realms: ReturnType<typeof politiesOf>;
  readonly ctx: ReturnType<typeof populationContext>;
};

const readOf = (world: World): Read => ({
  world,
  pw: homePlanet(world).generated,
  realms: politiesOf(world),
  ctx: populationContext(world),
});

/** A war's course, by its ref or the event that began or ended it (null: no such war). */
export function campaignOf(world: World, ref: string): Campaign | null {
  const wars = warsOf(world),
    w = wars.get(ref as Ref) ?? wars.all().find((x) => x.event === ref || x.peace === ref);
  return w ? courseOf(readOf(world), w) : null;
}

/**
 * The wars fought over years `from` to `to` (the last hundred, if not said), to be watched
 * unfolding together (M194): the bloodiest `most` of them, in the order they were declared.
 */
export function warsOfAge(
  world: World,
  args: { from?: number; to?: number; most?: number } = {},
): WarAge {
  const now = Math.floor(world.now / YEAR),
    to = Math.min(now, Math.floor(args.to ?? now)),
    from = Math.max(0, Math.min(to, Math.floor(args.from ?? to - 100))),
    fell = (w: War) => w.fallen[0] + w.fallen[1],
    read = readOf(world),
    wars = warsOf(world)
      .all()
      .filter((w) => w.declared <= to && (w.ended ?? now) >= from)
      .sort((a, b) => fell(b) - fell(a) || (a.ref < b.ref ? -1 : 1))
      .slice(0, Math.max(1, Math.min(40, args.most ?? 24)))
      .sort((a, b) => a.declared - b.declared || (a.ref < b.ref ? -1 : 1));
  return {
    from,
    to,
    now,
    wars: wars.flatMap((w) => {
      const c = courseOf(read, w);
      return c ? [c] : [];
    }),
  };
}

function courseOf(read: Read, w: War): Campaign | null {
  const { world, pw, realms, ctx } = read,
    grid = pw.fine.grid,
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
        // (Armed as it set out: by its first battle's design, else its design of that year.)
        host: hostKinds(
          world,
          realm,
          w.ended === null
            ? undefined
            : {
                year: w.declared,
                design: w.battles[0]?.designs?.[realm === w.attacker ? 0 : 1],
              },
        ),
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
    now: Math.floor(world.now / YEAR),
    battles: w.battles.map((b) => ({
      event: b.event,
      year: b.year,
      cell: b.land,
      spot: spot(b.land),
      land: landTitle(world, b.land, true),
      won: b.won,
      fallen: [b.fallen[0], b.fallen[1]] as const,
      ...(b.wounded ? { wounded: [b.wounded[0], b.wounded[1]] as const } : {}),
      outcome: battleOutcome(world, b),
      ...(b.tip ? { tip: true } : {}),
    })),
    civil: w.civil ? CIVIL_SHORT[w.civil] : null,
  };
}
