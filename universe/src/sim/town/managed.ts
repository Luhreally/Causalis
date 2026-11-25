// A town managed (town mode, second slice): what one who has entered a town orders of it, and what the town then did
// that its land's own reckoning would not have. Orders are commands: how many of its hands are put to its fields, its
// crafts and its hauling; how many months of food its granary holds back; which goods its market will not sell. The town
// kept in detail beside the world (host/place.ts) reads its orders here and lives by them, and what comes of that is
// told back in a command of its own (`place.settle`, its numbers told by the host as the deed is taken: Universe.told):
// those who changed trade, and those who died of want. They are written to its land's counts, never more than the land
// has of a kind, so nothing is made from nothing and every hand is one of the land's own. What more or less the town
// then makes is the land's own reckoning of its trades, next it reckons: the made and the used are counted once, there.
// Nothing is kept for a town never given an order, and a world where no one orders anything runs exactly as it did.
import {
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { BANDS, GOODS, OCC, OCCUPATIONS, SEXES } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";

const ROWS = SEXES * BANDS,
  OCCS = OCCUPATIONS.length;

/** The trades hands can be put to by an order: its fields (farmers), its herds, its crafts, its hauling (traders). */
export const MANAGED_TRADES = [OCC.farmer, OCC.herder, OCC.crafter, OCC.trader] as const;

export type Managed = {
  readonly town: Ref;
  readonly cell: number;
  /** When it was first given an order. */
  readonly since: number;
  /**
   * Of its hands at the trades an order can move (MANAGED_TRADES' order), the thousandths put to each (null: as its land
   * has them).
   */
  work: number[] | null;
  /** Months of its people's food its granary holds back from its households (0: none). */
  hold: number;
  /** The goods its market will not let go (their places in GOODS). */
  forbidden: number[];
  /**
   * What it has moved of its land's counts so far, kind by kind (sex and band by trade): hands changed from one trade to
   * another (each row adding up to nothing), as they were written to its land.
   */
  own: number[];
  /** Those of it who died of want, by the year: [year, count], oldest first. */
  dead: [number, number][];
};

/** A change of trade told back: so many of a sex and band, from one trade to another. */
export type SettleMove = readonly [row: number, from: number, to: number, n: number];
/** Deaths told back: so many of a sex and band and trade. */
export type SettleDead = readonly [row: number, occ: number, n: number];
export type SettleArgs = {
  town: Ref;
  moves?: readonly SettleMove[];
  dead?: readonly SettleDead[];
};

export class ManagedStore implements StateStore {
  readonly name = "town.managed";
  private list: Managed[] = [];
  private readonly byTown = new Map<string, Managed>();

  dormant(): boolean {
    return !this.list.length;
  }
  hashInto(h: Hasher): void {
    h.value(this.list);
  }
  save(): unknown {
    return this.list.length ? { list: this.list } : {};
  }
  load(state: unknown): void {
    this.list = [];
    this.byTown.clear();
    for (const m of (state as { list?: Managed[] }).list ?? [])
      this.add({
        ...m,
        work: m.work ? [...m.work] : null,
        forbidden: [...m.forbidden],
        own: [...m.own],
        dead: m.dead.map((d) => [d[0], d[1]]),
      });
  }
  private add(m: Managed): Managed {
    this.list.push(m);
    this.byTown.set(m.town, m);
    return m;
  }
  get(town: string): Managed | undefined {
    return this.byTown.get(town);
  }
  all(): readonly Managed[] {
    return this.list;
  }
  /** A town's orders, begun where it has none. */
  of(town: Ref, cell: number, t: number): Managed {
    return (
      this.byTown.get(town) ??
      this.add({
        town,
        cell,
        since: t,
        work: null,
        hold: 0,
        forbidden: [],
        own: new Array<number>(ROWS * OCCS).fill(0),
        dead: [],
      })
    );
  }
}

/** A world's managed towns (null: it keeps none, a world of no towns). */
export function managedOf(world: World): ManagedStore | null {
  return world.peek<ManagedStore>("town.managed") ?? null;
}

/** Those of a managed town who died of want in a year. */
export function managedDead(m: Managed | undefined, year: number): number {
  let n = 0;
  if (m) for (const [y, count] of m.dead) if (y === year) n += count;
  return n;
}

const whole = (x: unknown, least: number, most: number): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= least && x <= most;

export function installManaged(world: World, ctx: () => PopulationContext): ManagedStore {
  const store = world.register(new ManagedStore()),
    townOf = (args: unknown) => {
      const town = (args as { town?: unknown } | null)?.town;
      return typeof town === "string" ? ctx().settlements.get(town as Ref) : undefined;
    },
    held = (args: unknown): string | null => {
      const s = townOf(args);
      if (!s) return "town must be a town's ref";
      return s.population > 0 ? null : "no one lives there";
    };
  // How many of its hands are put to its fields, its herds, its crafts and its hauling.
  world.defineCommand({
    type: "place.work",
    validate: (args) => {
      const bad = held(args);
      if (bad) return bad;
      const shares = (args as { shares?: unknown }).shares;
      if (shares === null) return null;
      if (!Array.isArray(shares) || shares.length !== MANAGED_TRADES.length)
        return "shares must be a number for each of fields, herds, crafts and hauling, or null";
      if (!shares.every((x) => whole(x, 0, 1000))) return "each share is 0 to 1000";
      return shares.reduce((a: number, b: number) => a + b, 0) === 1000
        ? null
        : "the shares must add up to 1000";
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; shares: number[] | null },
        s = ctx().settlements.get(a.town);
      if (s) store.of(s.ref, s.cell, t).work = a.shares ? [...a.shares] : null;
    },
  });
  // How many months of its people's food its granary holds back.
  world.defineCommand({
    type: "place.hold",
    validate: (args) =>
      held(args) ??
      (whole((args as { months?: unknown }).months, 0, 24) ? null : "months is 0 to 24"),
    apply: (command, t) => {
      const a = command.args as { town: Ref; months: number },
        s = ctx().settlements.get(a.town);
      if (s) store.of(s.ref, s.cell, t).hold = a.months;
    },
  });
  // A good its market will not let go, or will again.
  world.defineCommand({
    type: "place.forbid",
    validate: (args) => {
      const a = args as { good?: unknown; on?: unknown };
      return (
        held(args) ??
        (!whole(a.good, 0, GOODS.length - 1)
          ? "good must be a good's place"
          : typeof a.on === "boolean"
            ? null
            : "on must be true or false")
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; good: number; on: boolean },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t),
        at = m.forbidden.indexOf(a.good);
      if (a.on && at < 0) m.forbidden = [...m.forbidden, a.good].sort((x, y) => x - y);
      if (!a.on && at >= 0) m.forbidden = m.forbidden.filter((g) => g !== a.good);
    },
  });
  // What a managed town did that its land's reckoning would not have: written to its land's counts.
  world.defineCommand({
    type: "place.settle",
    validate: (args) => {
      const bad = held(args);
      if (bad) return bad;
      const a = args as Partial<SettleArgs>;
      if (!store.get(a.town!)) return "the town has been given no order";
      const cell = (x: unknown, n: number) =>
        Array.isArray(x) && x.length === n && x.every((v) => whole(v, 0, 1e9));
      for (const m of a.moves ?? [])
        if (!cell(m, 4) || m[0] >= ROWS || m[1] >= OCCS || m[2] >= OCCS)
          return "a move is [row, from, to, count]";
      for (const d of a.dead ?? [])
        if (!cell(d, 3) || d[0] >= ROWS || d[1] >= OCCS) return "a death is [row, trade, count]";
      return null;
    },
    apply: (command, t) => applySettle(ctx(), store, command.args as SettleArgs, t),
  });
  return store;
}

/**
 * A settling applied: each change of trade as far as its land has those to change (never more), each death as far as its
 * land has those to die. What was done is kept with the town; what could not be is let go.
 */
function applySettle(ctx: PopulationContext, store: ManagedStore, a: SettleArgs, t: SimTime): void {
  const m = store.get(a.town),
    p = m ? ctx.provinces.get(m.cell) : undefined;
  if (!m || !p) return;
  const year = yearOfMoment(t);
  for (const [row, from, to, n] of a.moves ?? []) {
    const can = Math.min(n, p.counts.get(row, from));
    if (can <= 0 || from === to) continue;
    p.counts.move(row, from, row, to, can);
    m.own[row * OCCS + from]! -= can;
    m.own[row * OCCS + to]! += can;
  }
  let dead = 0;
  for (const [row, occ, n] of a.dead ?? []) {
    const can = Math.min(n, p.counts.get(row, occ));
    if (can <= 0) continue;
    p.counts.add(row, occ, -can);
    ctx.history.addDeaths(m.cell, year, row % BANDS, can);
    dead += can;
  }
  if (dead) {
    const last = m.dead.at(-1);
    if (last && last[0] === year) last[1] += dead;
    else m.dead.push([year, dead]);
    // (A few years of them are enough: a town's count is reckoned anew each year.)
    if (m.dead.length > 4) m.dead.splice(0, m.dead.length - 4);
  }
}
