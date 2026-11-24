// Who of a land's grown does which work, by sex (the society sweep, asked 2026-11-16: "occupations split by sex in workYear, from
// the roles norm"). The population's year of work (systems.ts workYear) set a land's work in its shares and drew who moved from its
// grown of either sex alike. Where its roles are kept (society/roles.ts), the land's shares are split between those who bear and
// those who do not (rules/roles.ts splitBySex): the fields, flocks and hunt as far as they ask a strength the bearers' bodies lack,
// the crafts of the villages' homes by all, the towns' shops and works, trade and rule as far as the bearers' norm takes them beyond
// the home; and each sex moves toward its own shares, a tenth of its grown a year at most, as the whole land did. The land's work
// in all is what it was: only who does it changes, and so who of it a levy takes and who of it the god's hand finds at each work.
// Its draws are its own stream's: the population's stream of work does not move.
import {
  CountDeltas,
  apportion,
  defineStream,
  drawWithoutReplacement,
  type SimTime,
} from "../../kernel/index.ts";
import { BANDS, FEMALE, MALE, bearerWork, splitBySex } from "../../rules/index.ts";
import { COLS, row, type Province } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import { ROLES_STORE, ROLE_ROW, societyStore } from "./kept.ts";

const WORK_BY_SEX = defineStream("society.work");

/**
 * Move a land's grown toward its work's shares, each sex toward its own (true), where its roles are kept; false where none are, and
 * the population's year moves them as one, as before.
 */
export function workBySex(
  ctx: PopulationContext,
  p: Province,
  targets: readonly number[],
  windowed: readonly number[] | null | undefined,
  key: number,
  t: SimTime,
): boolean {
  const roles = societyStore(ctx.world, ROLES_STORE)?.get(p.cell);
  if (!roles) return false;
  const { world, life } = ctx,
    rest = (r: number, o: number) => p.counts.get(r, o) - (windowed ? windowed[r * COLS + o]! : 0),
    rowsOf = (s: number) => {
      const out: number[] = [];
      for (let b = 0; b < BANDS; b++) if (life.bands[b]! >= life.adulthood) out.push(row(s, b));
      return out;
    },
    grownOf = (rows: readonly number[]) => {
      let n = 0;
      for (const r of rows) for (let o = 0; o < COLS; o++) n += rest(r, o);
      return Math.max(0, n);
    },
    rows = [rowsOf(FEMALE), rowsOf(MALE)] as const,
    grown = [grownOf(rows[0]), grownOf(rows[1])] as const,
    w = bearerWork(
      roles[ROLE_ROW.norm]! / 1000,
      roles[ROLE_ROW.dimorphism]! / 1000,
      roles[ROLE_ROW.strength]! / 1000,
      roles[ROLE_ROW.towns]! / 1000,
    ),
    shares = splitBySex(targets, grown[0], grown[1], w),
    d = new CountDeltas(p.counts);
  for (const s of [FEMALE, MALE]) {
    const adultRows = rows[s === FEMALE ? 0 : 1],
      n = grown[s === FEMALE ? 0 : 1],
      base = 1000 * (s + 1);
    if (!n) continue;
    const desired = apportion(n, shares[s === FEMALE ? 0 : 1], (k) =>
        world.rng.u32(WORK_BY_SEX, key, t, base, k),
      ),
      current = new Array<number>(COLS).fill(0);
    // (Its unable are moved among those it keeps and back only where any are reckoned: population/systems.ts withUnable.)
    const first = targets[0]! > 0 ? 0 : 1;
    for (const r of adultRows)
      for (let o = first; o < COLS; o++) current[o] = current[o]! + rest(r, o);
    const surplus = current.map((c, o) => (o < first ? 0 : Math.max(0, c - desired[o]!))),
      deficit = current.map((c, o) => (o < first ? 0 : Math.max(0, desired[o]! - c))),
      totalSurplus = surplus.reduce((a, b) => a + b, 0),
      totalDeficit = deficit.reduce((a, b) => a + b, 0),
      moving = Math.min(totalSurplus, totalDeficit, Math.ceil(n * 0.1));
    if (moving <= 0) continue;
    const out = apportion(moving, surplus, (o) => world.rng.u32(WORK_BY_SEX, key, t, base + 1, o)),
      into = apportion(moving, deficit, (o) => world.rng.u32(WORK_BY_SEX, key, t, base + 2, o));
    // Take each work's leavers from its rows, then hand them to the others in proportion to the need, row by row.
    const leavers = new Array<number>(adultRows.length).fill(0);
    out.forEach((k, o) => {
      if (!k) return;
      const byRow = drawWithoutReplacement(
        k,
        adultRows.map((r) => rest(r, o)),
        (i) => world.rng.real(WORK_BY_SEX, key, t, base + 10 + o, i),
      );
      byRow.forEach((m, i) => {
        d.add(adultRows[i]!, o, -m);
        leavers[i] = leavers[i]! + m;
      });
    });
    const intoRemaining = [...into];
    leavers.forEach((k, i) => {
      if (!k) return;
      const share = apportion(k, intoRemaining, (o) =>
        world.rng.u32(WORK_BY_SEX, key, t, base + 20, i * 16 + o),
      );
      share.forEach((m, o) => {
        d.add(adultRows[i]!, o, m);
        intoRemaining[o] = Math.max(0, intoRemaining[o]! - m);
      });
    });
  }
  d.commit(p.counts);
  return true;
}
