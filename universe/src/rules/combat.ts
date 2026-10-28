// Campaign combat: simultaneous exchanges, depleted fighting strength and cohesion.
// The transcript is also the field viewer's casualty/morale clock. No winner is drawn.
import { dmath } from "../kernel/index.ts";
import { fallenShare, type Blow } from "./wounds.ts";

export type CombatSide = {
  readonly fielded: number;
  readonly power: number;
  readonly shock: number;
  readonly protection: number;
  readonly fire: number;
  readonly range: number;
  readonly care: number;
  readonly blow: Blow;
};
export type CombatFrame = {
  readonly at: number;
  readonly dead: readonly [number, number];
  readonly morale: readonly [number, number];
  readonly pressure: number;
};
export type CombatRecord = {
  readonly model: 2;
  readonly broken: -1 | 0 | 1;
  readonly reason: "morale" | "overrun" | "stalemate";
  readonly rout: number | null;
  readonly power: readonly [number, number];
  readonly frames: readonly CombatFrame[];
};
export type CombatResult = { won: boolean; dead: readonly [number, number]; combat: CombatRecord };

/** Bounded aggregate exchanges, independent of graphics quality and the number of drawn figures. */
export function resolveCombat(
  sides: readonly [CombatSide, CombatSide],
  size: number,
  draw: (round: number, side: number) => number,
): CombatResult {
  const men = sides.map((s) => Math.max(0, Math.round(s.fielded))),
    strength = sides.map((s) => Math.max(0, s.power)),
    kills = sides.map((own, k) =>
      fallenShare({
        blow: sides[1 - k]!.blow,
        shock: sides[1 - k]!.shock,
        protection: own.protection,
        care: own.care,
        size,
      }),
    ),
    hurt = [0, 0],
    dead = [0, 0],
    morale = [1, 1],
    frames: CombatFrame[] = [];
  let broken: -1 | 0 | 1 = -1,
    rout: number | null = null,
    reason: CombatRecord["reason"] = "stalemate",
    at = 48;
  const frame = (time: number) => {
    const live = men.map((n, k) => Math.max(0, n - hurt[k]!)),
      force = strength.map((n, k) => (n * live[k]!) / Math.max(1, men[k]!));
    frames.push({
      at: time,
      dead: [dead[0]!, dead[1]!],
      morale: [Math.round(morale[0]! * 1000) / 1000, Math.round(morale[1]! * 1000) / 1000],
      pressure:
        Math.round(
          dmath.clamp((force[0]! - force[1]!) / Math.max(1, force[0]! + force[1]!), -1, 1) * 1000,
        ) / 1000 || 0,
    });
  };
  frame(16);
  if (!men[0] || !strength[0]) broken = 0;
  else if (!men[1] || !strength[1]) broken = 1;
  for (let round = 0; round < 64 && broken < 0; round++) {
    at = round < 12 ? 18 + round * 2.5 : 48 + (round - 12) * 1.5;
    const live = men.map((n, k) => Math.max(0, n - hurt[k]!)),
      force = strength.map((n, k) => (n * live[k]!) / Math.max(1, men[k]!)),
      total = Math.max(1, force[0]! + force[1]!),
      blows = sides.map((own, k) => {
        const foe = 1 - k,
          enemy = sides[foe]!,
          engaged = Math.min(live[k]!, live[foe]! * 3),
          per = strength[k]! / Math.max(1, men[k]!),
          enemyPer = strength[foe]! / Math.max(1, men[foe]!),
          // Numbers already determine the fighting front. Apply equipment/ground per fighter once.
          advantage = dmath.clamp((2 * per) / Math.max(0.0001, per + enemyPer), 0.1, 1.9),
          through =
            (0.4 + own.shock + Math.min(2, own.fire) * 0.15) /
            (0.8 + own.shock + enemy.protection * 1.5),
          spread = 1 / (1 + 0.5 * Math.max(0, Math.max(own.range, enemy.range) - 0.6)),
          variation = 0.92 + 0.16 * dmath.clamp(draw(round, k), 0, 1);
        const contact = at < 48 ? (own.range >= 0.45 || own.fire > 0 ? 0.45 : 0) : 1;
        return engaged * 0.022 * advantage * through * spread * variation * contact;
      });
    for (const k of [0, 1] as const) {
      hurt[k] = Math.min(men[k]!, hurt[k]! + blows[1 - k]!);
      dead[k] = Math.min(men[k]!, Math.round(hurt[k]! * kills[k]!));
      const loss = hurt[k]! / Math.max(1, men[k]!),
        pressure = Math.max(0, (force[1 - k]! - force[k]!) / total),
        shock = blows[1 - k]! / Math.max(1, men[k]!);
      morale[k] = dmath.clamp(1 - loss * 1.7 - shock * 4 - pressure * 0.18 - round * 0.001, 0, 1);
    }
    if (round % 2 === 1) frame(at);
    const fail = [0, 1].map(
      (k) =>
        hurt[k]! / Math.max(1, men[k]!) > 0.7 ||
        (round >= 3 && morale[k]! < 0.34 && hurt[k]! / Math.max(1, men[k]!) > 0.03),
    );
    if (fail[0] || fail[1]) {
      // Equal collapse is an inconclusive engagement, never an arbitrary attacker defeat.
      if (fail[0] && fail[1] && Math.abs(morale[0]! - morale[1]!) < 0.015) break;
      broken = fail[0] && (!fail[1] || morale[0]! < morale[1]!) ? 0 : 1;
      reason = hurt[broken]! / Math.max(1, men[broken]!) > 0.7 ? "overrun" : "morale";
      rout = at;
    }
  }
  if (broken >= 0) {
    rout ??= at;
    frame(rout);
    // Pursuit costs the routed side men, after it breaks, rather than deciding who broke.
    const loser = broken,
      winner = 1 - loser;
    for (let n = 1; n <= 4; n++) {
      const remaining = Math.max(0, men[loser]! - hurt[loser]!),
        pursuers = Math.max(0, men[winner]! - hurt[winner]!);
      hurt[loser] = Math.min(men[loser]!, hurt[loser]! + Math.min(remaining, pursuers) * 0.018);
      dead[loser] = Math.min(men[loser]!, Math.round(hurt[loser]! * kills[loser]!));
      frame(Math.min(145, rout + n * 3));
    }
  } else frame(at);
  return {
    won: broken === 1,
    dead: [dead[0]!, dead[1]!],
    combat: { model: 2, broken, reason, rout, power: [strength[0]!, strength[1]!], frames },
  };
}
