// A creed's taboo, faith by faith (rules/taboo.ts): what the sicknesses that rose in herds did among its believers, remembered;
// each year, whether keeping off the herd is worth what it gives them, and so the creed forbids it, or lets it go. Its believers
// keep off the herd as far as they are devout (`herdKept`): they forgo its yield (sim/population/systems.ts), and are spared a
// sickness's crossing from it (sim/health/health.ts riseHazards), its coming back from the herds (strains.ts) and the more a
// herd's sickness takes of those who keep it close (health.ts tollOf). One row a faith its herds' sicknesses have reached.
import {
  YEAR,
  defineEventType,
  dmath,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  FOODS,
  G,
  GOODS,
  TABOO,
  addToll,
  fadeToll,
  freshToll,
  herdDeaths,
  tabooWorth,
  type HerdToll,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "./belief.ts";

export const TABOO_EVENTS = {
  /** A creed comes to forbid its believers a herd (or, `lifted`, lets the ban go). */
  taboo: defineEventType("belief.taboo", 4),
};

/** What a faith remembers of its herds' sicknesses, the worst coming among its believers, and the herd it forbids, if any. */
export type FaithTaboo = {
  toll: HerdToll;
  /** The year the toll was last faded to. */
  at: number;
  worst: { event: Ref; sickness: Ref; share: number } | null;
  /** The herd it forbids, since when, the event, and the dead it was taught by (a share of its believers then). */
  forbids: { beast: string; since: number; event: Ref; dead: number } | null;
};

export class TabooStore implements StateStore {
  readonly name = "belief.taboos";
  private readonly byFaith = new Map<Ref, FaithTaboo>();
  /** How many faiths forbid a herd now: a land's keeping is read only where one does. */
  forbidding = 0;
  dormant(): boolean {
    return this.byFaith.size === 0;
  }
  of(faith: Ref): FaithTaboo | undefined {
    return this.byFaith.get(faith);
  }
  ensure(faith: Ref, year: number): FaithTaboo {
    let f = this.byFaith.get(faith);
    if (!f)
      this.byFaith.set(faith, (f = { toll: freshToll(), at: year, worst: null, forbids: null }));
    return f;
  }
  faiths(): Ref[] {
    return [...this.byFaith.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  drop(faith: Ref): void {
    if (this.byFaith.get(faith)?.forbids) this.forbidding--;
    this.byFaith.delete(faith);
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const f of this.byFaith.values()) {
      if (f.worst) out.push(f.worst.event, f.worst.sickness);
      if (f.forbids) out.push(f.forbids.event);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    for (const k of this.faiths()) h.string(k).value(this.byFaith.get(k)!);
  }
  save(): unknown {
    return this.faiths().map((k) => [k, this.byFaith.get(k)!]);
  }
  load(s: unknown): void {
    this.byFaith.clear();
    this.forbidding = 0;
    for (const [k, f] of (s as [Ref, FaithTaboo][]) ?? []) {
      this.byFaith.set(k, f);
      if (f.forbids) this.forbidding++;
    }
  }
}

export function taboosOf(world: World): TabooStore | null {
  return world.hasStore("belief.taboos") ? world.store<TabooStore>("belief.taboos") : null;
}

/** The herd's share of what a land makes of food, by worth (its market's latest year; 0 where it has none). */
export function herdFoodOf(world: World, cell: number): number {
  const m = world.store<MarketStore>("economy.markets").get(cell);
  if (!m) return 0;
  let food = 0,
    meat = 0;
  for (const k of FOODS) {
    const made = m.book("made", k) * GOODS[k]!.value;
    food += made;
    if (k === G.meat) meat = made;
  }
  return food > 0 ? meat / food : 0;
}

/**
 * How far a land's people keep off the herd their creed forbids (0 … 1): as devout as their ways are, where their faith forbids
 * one. Exactly 0 where none does.
 */
export function herdKept(world: World, cell: number): number {
  const store = taboosOf(world);
  if (!store || store.forbidding === 0) return 0;
  const faith = beliefOf(world).of(cell).faith,
    f = faith ? store.of(faith) : undefined;
  if (!f?.forbids) return 0;
  return Math.max(0, Math.min(1, cultureOf(world).get(cell)?.traits[WAY.piety] ?? 0.5));
}

/** A herd's sickness came to a land (sim/health/health.ts strike): remembered by its faith, with what it cost them. */
export function noteHerdOutbreak(
  ctx: PopulationContext,
  cell: number,
  sickness: Ref,
  /** The land the sickness rose in. */
  rose: number,
  people: number,
  share: number,
  event: Ref,
  year: number,
): void {
  const store = taboosOf(ctx.world),
    faith = beliefOf(ctx.world).of(cell).faith;
  if (!store || !faith || people <= 0) return;
  const f = store.ensure(faith, year);
  fadeToll(f.toll, year - f.at);
  f.at = year;
  addToll(
    f.toll,
    people,
    herdFoodOf(ctx.world, cell),
    share,
    beliefOf(ctx.world).of(rose).faith === faith,
  );
  if (!f.worst || share > f.worst.share) f.worst = { event, sickness, share };
}

/** Each year, each faith its herds' sicknesses reached weighs keeping off the herd. */
export function tabooYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = taboosOf(world);
  if (!store || store.dormant()) return;
  const year = yearOfMoment(t),
    belief = beliefOf(world),
    culture = cultureOf(world),
    markets = world.store<MarketStore>("economy.markets");
  // (Its believers, how devout, what their herds give of their food, and its herd beast where most of them keep one.)
  type Read = {
    people: number;
    pious: number;
    meat: number;
    food: number;
    beast: Map<number, number>;
  };
  const reads = new Map<Ref, Read>();
  for (const p of ctx.provinces.all()) {
    const n = p.total(),
      faith = n > 0 ? belief.of(p.cell).faith : null;
    if (!faith || !store.of(faith)) continue;
    let r = reads.get(faith);
    if (!r) reads.set(faith, (r = { people: 0, pious: 0, meat: 0, food: 0, beast: new Map() }));
    r.people += n;
    r.pious += n * (culture.get(p.cell)?.traits[WAY.piety] ?? 0.5);
    const m = markets.get(p.cell);
    if (m)
      for (const k of FOODS) {
        const made = m.book("made", k) * GOODS[k]!.value;
        r.food += made;
        if (k === G.meat) r.meat += made;
      }
    const b = g.life.herdBeast[p.cell] ?? -1;
    if (b >= 0 && p.herding) r.beast.set(b, (r.beast.get(b) ?? 0) + n);
  }
  for (const faith of store.faiths()) {
    const f = store.of(faith)!,
      r = reads.get(faith),
      fth = belief.get(faith);
    if (!r || !fth) {
      // (A faith with no believers left forgets.)
      store.drop(faith);
      continue;
    }
    fadeToll(f.toll, year - f.at);
    f.at = year;
    const deaths = Math.max(
        herdDeaths(f.toll, r.people, !!f.forbids),
        // (While it forbids the herd, the dead it was taught by are remembered, fading, whatever the slope among those who now
        // keep off it shows: the ban spares them.)
        f.forbids ? f.forbids.dead * dmath.pow(0.5, (year - f.forbids.since) / TABOO.fade) : 0,
      ),
      // (While it forbids the herd, its believers make less of it: what it would give them is read back by what they keep off.)
      kept = f.forbids ? Math.min(0.8, r.pious / r.people) : 0,
      meat = r.meat / (1 - kept),
      foodShare = r.food > 0 ? meat / (r.food - r.meat + meat) : 0,
      piety = r.pious / r.people,
      w = tabooWorth(deaths, foodShare);
    if (!f.forbids && w.worth > TABOO.line && f.worst) {
      let beast = -1,
        most = 0;
      for (const [b, n] of [...r.beast].sort((a, z) => a[0] - z[0]))
        if (n > most) {
          beast = b;
          most = n;
        }
      // (Herds they learned of others, of no beast of their own lands: the beast most lands keep, as health.ts's kin reads it.)
      if (beast < 0) beast = commonHerd(g.life.herdBeast);
      const name = beast >= 0 ? (g.life.species[beast]?.name ?? "herd beast") : "herd beast",
        event = decide(ctx, faith, fth.name, name, w, deaths, foodShare, piety, f, t, false);
      f.forbids = { beast: name, since: year, event, dead: deaths };
      store.forbidding++;
    } else if (f.forbids && w.worth < -TABOO.line) {
      decide(ctx, faith, fth.name, f.forbids.beast, w, deaths, foodShare, piety, f, t, true);
      f.forbids = null;
      store.forbidding--;
    }
    // (Nothing forbidden, and its comings all but forgotten, some four lifetimes' telling on: the row goes.)
    if (!f.forbids && f.toll.n < 0.05) store.drop(faith);
  }
}

/** The herd beast most lands of a world have (-1: none). */
function commonHerd(herdBeast: ArrayLike<number>): number {
  const n = new Map<number, number>();
  for (let c = 0; c < herdBeast.length; c++) {
    const b = herdBeast[c]!;
    if (b >= 0) n.set(b, (n.get(b) ?? 0) + 1);
  }
  let best = -1,
    most = 0;
  for (const [b, m] of n) if (m > most || (m === most && b < best)) [best, most] = [b, m];
  return best;
}

function decide(
  ctx: PopulationContext,
  faith: Ref,
  faithName: string,
  beast: string,
  w: ReturnType<typeof tabooWorth>,
  deaths: number,
  foodShare: number,
  piety: number,
  f: FaithTaboo,
  t: SimTime,
  lifted: boolean,
): Ref {
  const { world } = ctx,
    worst: CauseRef[] = f.worst
      ? [
          { ref: f.worst.event, role: "pressure", weight: 1 },
          { ref: f.worst.sickness, role: "enabler", weight: 0.5 },
        ]
      : [],
    factors: Factor[] = [
      {
        name: "the dead of the herds' sicknesses among those who keep them",
        value: Math.round(deaths * 10000) / 10000,
        contribution: w.lives,
        source: worst[0] ?? null,
      },
      {
        name: "what the herd gives them",
        value: Math.round(foodShare * 100) / 100,
        contribution: -w.food,
        source: null,
      },
      // (How devout they are weighs both alike: they keep the ban, and give up the herd, as far as they hold to the creed.)
      {
        name: "how far they keep to their creed",
        value: Math.round(piety * 100) / 100,
        contribution: 0,
        source: null,
      },
    ],
    decision = world.decisions.record({
      rule: "belief.taboo",
      subject: faith,
      outcome: { beast, lifted },
      score: lifted ? -w.worth : w.worth,
      threshold: TABOO.line,
      factors,
    }),
    seat = beliefOf(world).get(faith)?.seat;
  return world.events.emit({
    type: TABOO_EVENTS.taboo.type,
    subjects: [faith],
    place: seat !== undefined ? (ctx.provinces.get(seat)?.ref ?? null) : null,
    causes: [{ ref: decision, role: "trigger", weight: 1 }, ...(lifted ? [] : worst)],
    data: {
      faith: faithName,
      beast,
      dead: Math.round(deaths * 1000),
      food: Math.round(foodShare * 100),
      ...(lifted ? { lifted: true } : {}),
    },
  });
}

export function installTaboos(world: World, ctx: () => PopulationContext): TabooStore {
  const store = world.register(new TabooStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "188.health.year.taboo", every: YEAR, run: (t) => tabooYear(ctx(), t) });
  return store;
}
