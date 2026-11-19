// What each of a realm's groups wants of how it is held (rules/holds.ts: force, voice, word, trust), learned from how the
// group has fared under it and never written down (round E, order). A group's wants are first what the realm is when it is
// first weighed: those who live alike there want it held as it is. Then at each weighing of its holds (every LAW_EVERY years,
// in the realm's turn) each group looks at how it fared since the last: its share of the realm's people, what a year of its
// work is worth, its share of the realm's sway. Where it fared well, it comes to want the realm held more as it was held; where
// ill, toward its opposite. So the army comes to want force where force kept it fed and heard, traders word where free word
// paid, and a people of another body or another world comes to want what its own history taught it. A few numbers a group a
// realm, kept as whole hundredths; a realm's own let go when it ends.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";
import { dmath } from "../../kernel/index.ts";
import { OCC } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { GROUPS, type Group, type Interest } from "../polity/interests.ts";
import type { Polity } from "../polity/polity.ts";

/** How far a decade's fortune moves a group's wants toward (or from) the realm as it was held, at the most. */
export const WANTS_LEARN = 0.5;

/** A group's wants and what it had at its last weighing. */
export type GroupWants = {
  /** Of force, voice, word and trust: whole hundredths. */
  want: number[];
  /** At its last weighing: its share of the realm's people, a year of its work, its share of the realm's sway. */
  share: number;
  wage: number;
  sway: number;
  /** The realm's numbers it was held by then (whole hundredths). */
  held: number[];
  /** The year it last learned, and how it fared then (−1 … 1; 0: not yet). */
  year: number;
  fared: number;
};

export class WantsStore implements StateStore {
  readonly name = "order.wants";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly realms = new Map<Ref, Map<Group, GroupWants>>();
  dormant(): boolean {
    return this.realms.size === 0;
  }
  of(realm: Ref): ReadonlyMap<Group, GroupWants> | undefined {
    return this.realms.get(realm);
  }
  /** What a group of a realm wants of each number (0 … 1), or null where it has not yet been weighed. */
  wantOf(realm: Ref, group: string): readonly number[] | null {
    const w = this.realms.get(realm)?.get(group as Group);
    return w ? w.want.map((x) => x / 100) : null;
  }
  ensure(realm: Ref): Map<Group, GroupWants> {
    let m = this.realms.get(realm);
    if (!m) this.realms.set(realm, (m = new Map()));
    return m;
  }
  forget(realm: Ref): void {
    this.realms.delete(realm);
  }
  realmsKept(): Ref[] {
    return [...this.realms.keys()];
  }
  hashInto(h: Hasher): void {
    const realms = [...this.realms.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    h.int(realms.length);
    for (const r of realms) {
      h.string(r);
      const m = this.realms.get(r)!;
      for (const g of GROUPS) {
        const w = m.get(g);
        if (!w) {
          h.int(-1);
          continue;
        }
        for (const x of w.want) h.int(x);
        h.float(w.share).float(w.wage).float(w.sway).int(w.year).float(w.fared);
        for (const x of w.held) h.int(x);
      }
    }
  }
  save(): unknown {
    return [...this.realms]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([r, m]) => [r, GROUPS.filter((g) => m.has(g)).map((g) => [g, m.get(g)!])]);
  }
  load(state: unknown): void {
    this.realms.clear();
    for (const [r, groups] of (state as [Ref, [Group, GroupWants][]][]) ?? [])
      this.realms.set(r, new Map(groups));
  }
}

export function wantsOf(world: World): WantsStore | null {
  return world.hasStore("order.wants") ? world.store<WantsStore>("order.wants") : null;
}

/** The occupation each group of the many works at (the court, the temple and the army are paid otherwise). */
const WORKS_AT: Partial<Record<Group, number>> = {
  farmers: OCC.farmer,
  herders: OCC.herder,
  crafters: OCC.crafter,
  traders: OCC.trader,
};

/**
 * Each group of a realm learns from how it fared since its last weighing (its share of the people, a year of its work, its
 * share of the sway), and its wants move toward the numbers the realm was held by then where it fared well, away where ill.
 * At a group's first weighing it wants the realm held as it is. `held`: the realm's numbers now (0 … 1).
 */
export function learnWants(
  ctx: PopulationContext,
  store: WantsStore,
  p: Polity,
  interests: readonly Interest[],
  held: readonly number[],
  year: number,
): void {
  const markets = ctx.world.store<MarketStore>("economy.markets"),
    m = store.ensure(p.ref);
  let all = 0;
  const heads = new Map<Group, number>(),
    paid = new Map<Group, number>();
  for (const i of interests) {
    heads.set(i.group, i.people);
    all += i.people;
  }
  for (const c of p.members) {
    const w = markets.wagesOf(c),
      prov = ctx.provinces.get(c);
    if (!w || !prov) continue;
    for (const [g, occ] of Object.entries(WORKS_AT) as [Group, number][])
      paid.set(g, (paid.get(g) ?? 0) + prov.occupation(occ) * (w[occ] ?? 0));
  }
  const now = held.map((x) => Math.round(x * 100));
  for (const i of interests) {
    const people = heads.get(i.group) ?? 0,
      share = all > 0 ? people / all : 0,
      wage = people > 0 ? (paid.get(i.group) ?? 0) / people : 0,
      was = m.get(i.group);
    if (!was) {
      m.set(i.group, {
        want: [...now],
        share,
        wage,
        sway: i.sway,
        held: [...now],
        year: 0,
        fared: 0,
      });
      continue;
    }
    // (How it fared: each of what it had, against what it had, as a ratio's logarithm; what it never had is not weighed.)
    const ratio = (a: number, b: number) => (a > 0 && b > 0 ? dmath.log(a / b) : 0),
      fared = dmath.tanh(
        3 * (ratio(share, was.share) + ratio(wage, was.wage) + ratio(i.sway, was.sway)),
      ),
      by = WANTS_LEARN * Math.abs(fared);
    // (Toward how the realm was held where it fared well; where ill, toward its opposite, as far.)
    was.want = was.want.map((x, k) => {
      const to = fared >= 0 ? was.held[k]! : 100 - was.held[k]!;
      return Math.round(dmath.clamp(x + by * (to - x), 0, 100));
    });
    was.share = share;
    was.wage = wage;
    was.sway = i.sway;
    was.held = [...now];
    was.year = year;
    was.fared = Math.round(fared * 100) / 100;
  }
}
