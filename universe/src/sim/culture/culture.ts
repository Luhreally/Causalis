// Culture and language (docs/architecture §19): each peopled land has its ways — a
// handful of traits between two poles — and its tongue. Ways drift a little each
// year, are drawn toward the lands they have contact with (neighbours, roads,
// trade), and are pushed by what happens there: famine teaches thrift and piety,
// food from neighbours openness, roads trade, new crafts loosen old ways, the god's
// acts deepen devotion. Each land keeps the strongest of those pushes, so the
// explainer can say why a people are as they are. Tongues lose and gain sounds and
// borrow from their neighbours', so names near each other sound alike and names
// far apart drift apart. A newly peopled land takes the ways of those who came.
import {
  YEAR,
  defineStream,
  dmath,
  gaussian,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { borrowSound, cradleTongue, shiftTongue, type Tongue } from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";

export const WAY_TRAITS = [
  "kinship",
  "hierarchy",
  "piety",
  "valour",
  "trade",
  "openness",
  "tradition",
  "thrift",
] as const;
export type WayTrait = (typeof WAY_TRAITS)[number];
export const WAY: Readonly<Record<WayTrait, number>> = Object.fromEntries(
  WAY_TRAITS.map((t, i) => [t, i]),
) as Record<WayTrait, number>;

/** One push on a people's ways, and the event that gave it. */
export type Nudge = {
  readonly event: Ref;
  readonly year: number;
  readonly trait: number;
  readonly amount: number;
};

export type Ways = {
  readonly cell: number;
  traits: number[];
  /**
   * The ways a people return to when nothing pushes them: what they had when the
   * chronicle opened, or brought when they came. Lasting changes (a faith) move it.
   */
  base: number[];
  tongue: Tongue;
  /** The strongest pushes, strongest first. */
  nudges: Nudge[];
  /** Where these ways came from: the event that brought the first of these people. */
  readonly from: Ref | null;
};

/** How many pushes a people remember. */
const KEPT_NUDGES = 6;

/** What pushes a people's ways, by the type of event that happened among them. */
export const PUSHES: Readonly<Record<string, readonly (readonly [WayTrait, number])[]>> = {
  "people.famine": [
    ["thrift", 0.04],
    ["piety", 0.015],
    ["openness", -0.01],
  ],
  "trade.relief": [
    ["openness", 0.04],
    ["trade", 0.02],
  ],
  "trade.route-opened": [
    ["trade", 0.03],
    ["openness", 0.01],
  ],
  "settlement.market": [
    ["hierarchy", 0.03],
    ["trade", 0.03],
  ],
  "knowledge.cultivation": [
    ["tradition", -0.04],
    ["hierarchy", 0.02],
  ],
  "knowledge.cultivation-spread": [["tradition", -0.02]],
  "knowledge.metalworking": [["tradition", -0.03]],
  "knowledge.metalworking-spread": [["tradition", -0.01]],
  "province.peopled": [["openness", 0.02]],
  "weather.drought": [["piety", 0.005]],
  "act.rain": [["piety", 0.06]],
  "act.harvest": [["piety", 0.06]],
  "act.plague": [["piety", 0.08]],
  "act.inspire": [["piety", 0.05]],
  "hand.laid": [["piety", 0.1]],
};

const DRIFT = defineStream("culture.drift");
const SPEECH = defineStream("culture.speech");

export class CultureStore implements StateStore {
  readonly name = "culture.ways";
  private readonly map = new Map<number, Ways>();

  get(cell: number): Ways | undefined {
    return this.map.get(cell);
  }

  set(w: Ways): void {
    this.map.set(w.cell, w);
  }

  all(): Ways[] {
    return [...this.map.values()].sort((a, b) => a.cell - b.cell);
  }

  /** The events a people's ways answer to must stay in history. */
  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const w of this.map.values()) {
      for (const n of w.nudges) refs.push(n.event);
      if (w.from) refs.push(w.from);
    }
    return refs;
  }

  hashInto(h: Hasher): void {
    h.value(this.all());
  }

  save(): unknown {
    return { ways: this.all() };
  }

  load(state: unknown): void {
    this.map.clear();
    for (const w of (state as { ways: Ways[] }).ways)
      this.map.set(w.cell, {
        ...w,
        traits: [...w.traits],
        base: [...w.base],
        nudges: [...w.nudges],
      });
  }
}

export function cultureOf(world: World): CultureStore {
  return world.store<CultureStore>("culture.ways");
}

/** The first people's ways: every trait at its middle, the cradle's tongue. */
export function cradleWays(cell: number, culture: number, from: Ref | null): Ways {
  return {
    cell,
    traits: WAY_TRAITS.map(() => 0.5),
    base: WAY_TRAITS.map(() => 0.5),
    tongue: cradleTongue(culture),
    nudges: [],
    from,
  };
}

/**
 * Ways that have drifted for `steps` generations of the prehistory away from the
 * cradle's: traits wander, sounds are lost and gained. Keyed by the land.
 */
export function driftedWays(
  world: World,
  cradle: Ways,
  cell: number,
  steps: number,
  from: Ref | null,
): Ways {
  const traits = cradle.traits.map((v, i) =>
    dmath.clamp(
      v +
        steps *
          0.035 *
          gaussian(world.rng.real(DRIFT, cell, 0, 1, i), world.rng.real(DRIFT, cell, 0, 2, i)),
      0.05,
      0.95,
    ),
  );
  let tongue = cradle.tongue;
  for (let k = 0; k < steps * 2; k++)
    tongue = shiftTongue(tongue, world.rng.real(SPEECH, cell, 0, 1, k));
  return { cell, traits, base: [...traits], tongue, nudges: [], from };
}

function push(w: Ways, nudge: Nudge): void {
  w.traits[nudge.trait] = dmath.clamp(w.traits[nudge.trait]! + nudge.amount, 0.02, 0.98);
  w.nudges.push(nudge);
  w.nudges.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || b.year - a.year);
  if (w.nudges.length > KEPT_NUDGES) w.nudges.length = KEPT_NUDGES;
}

/** The yearly work of culture: new lands take their founders' ways; ways are pushed, drift and draw together; tongues change. */
export function cultureYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = cultureOf(world),
    year = yearOfMoment(t),
    markets = world.store<MarketStore>("economy.markets"),
    provinces = ctx.provinces.all();
  // A land newly peopled takes the ways of those who came (or, failing that, the cradle's).
  for (const p of provinces) {
    if (store.get(p.cell)) continue;
    const flow = ctx.history.flows().find((f) => f.to === p.cell && f.event === p.arrival),
      source = flow ? store.get(flow.from) : undefined,
      base = source ?? store.all()[0]!;
    store.set({
      cell: p.cell,
      traits: [...base.traits],
      base: [...base.traits],
      tongue: base.tongue,
      nudges: [],
      from: p.arrival,
    });
  }
  // This year's events push the ways of the land they happened in.
  const start = Math.max(0, t - YEAR);
  const events = world.events.all();
  for (let i = events.length - 1; i >= 0 && events[i]!.t > start; i--) {
    const e = events[i]!,
      pushes = PUSHES[e.type];
    if (!pushes || !e.place) continue;
    const cell = Number(e.place.split(":")[2]),
      w = store.get(cell);
    if (!w) continue;
    for (const [trait, amount] of pushes) push(w, { event: e.id, year, trait: WAY[trait], amount });
  }
  // Drift and contact, planned from the year's opening ways, then made.
  const plans = new Map<number, { traits: number[]; tongue: Tongue }>();
  for (const p of provinces) {
    const w = store.get(p.cell)!,
      near: { w: Ways; weight: number }[] = [];
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!,
        other = store.get(n);
      if (!other || !ctx.provinces.get(n)?.total()) continue;
      near.push({ w: other, weight: 1 + (markets.route(p.cell, n) ? 1.5 : 0) });
    }
    const total = near.reduce((s, x) => s + x.weight, 0);
    const traits = w.traits.map((v, i) => {
      const pull = total ? near.reduce((s, x) => s + x.w.traits[i]! * x.weight, 0) / total - v : 0,
        wander =
          0.006 *
          gaussian(world.rng.real(DRIFT, p.cell, t, 1, i), world.rng.real(DRIFT, p.cell, t, 2, i));
      // What is not pushed again fades: ways relax slowly back toward the people's own.
      const relax = 0.02 * (w.base[i]! - v);
      return dmath.clamp(v + 0.01 * pull + relax + wander, 0.02, 0.98);
    });
    let tongue = w.tongue;
    if (world.rng.real(SPEECH, p.cell, t, 1) < 1 / 30)
      tongue = shiftTongue(tongue, world.rng.real(SPEECH, p.cell, t, 2));
    if (near.length && world.rng.real(SPEECH, p.cell, t, 3) < Math.min(0.5, total / 60)) {
      const most = [...near].sort((a, b) => b.weight - a.weight || a.w.cell - b.w.cell)[0]!;
      tongue = borrowSound(tongue, most.w.tongue, world.rng.real(SPEECH, p.cell, t, 4));
    }
    plans.set(p.cell, { traits, tongue });
  }
  for (const [cell, plan] of plans) {
    const w = store.get(cell)!;
    w.traits = plan.traits;
    w.tongue = plan.tongue;
  }
}
