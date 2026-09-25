// The sandbox: a toy world that exercises the kernel the way real domains will: integer
// populations moved by compute-then-commit flows, a float market updated daily
// with deterministic math, and floods on the agenda that reschedule themselves.
// It knows no planets or people; it exists so the scheduler, the tables, the hash
// chain, saves, replay, the worker boundary and the renderer can be proven before
// any content depends on them (Phase 0). Phase 1's planet replaces it in the app.
import {
  CountDeltas,
  CountTable,
  DAY,
  FieldTable,
  MONTH,
  World,
  apportion,
  defineEventType,
  defineKind,
  defineStream,
  makeRef,
  structuralRef,
  dmath,
  poisson,
  seedFromText,
  type CauseRef,
  type Hasher,
  type Ref,
  type StateStore,
  type SystemSpec,
  type TableState,
} from "../../kernel/index.ts";

export const CELLS = 16;
export const CLASSES = 3;

const BIRTH = defineStream("toy.births");
const DEATH = defineStream("toy.deaths");
const MOVE = defineStream("toy.moves");
const FLOOD = defineStream("toy.floods");
const PRICE = defineStream("toy.prices");

export const FLOODPLAIN = defineKind("tfld", "toy floodplain", "structural");
export const CELL = defineKind("tcell", "toy cell", "structural");
export const FLOOD_EVENT = defineEventType("toy.flood", 3);
export const EXODUS_EVENT = defineEventType("toy.exodus", 2);
export const BLESSING_EVENT = defineEventType("toy.blessing", 4);

export function cellRef(cell: number): Ref {
  return makeRef(CELL, 0, cell);
}
export function floodplainRef(cell: number): Ref {
  return structuralRef(FLOODPLAIN, null, cell);
}

export class ToyPopulation implements StateStore {
  readonly name = "toy.population";
  readonly counts = new CountTable(CELLS, CLASSES);
  hashInto(h: Hasher): void {
    this.counts.hashInto(h);
  }
  save(): unknown {
    return this.counts.save();
  }
  load(state: unknown): void {
    this.counts.load(state as TableState);
  }
}

/** What each cell remembers: its last flood (so a decision to leave can cite it). */
export class ToyMemory implements StateStore {
  readonly name = "toy.memory";
  readonly lastFlood: (Ref | null)[] = new Array<Ref | null>(CELLS).fill(null);
  hashInto(h: Hasher): void {
    for (const r of this.lastFlood) h.string(r ?? "");
  }
  save(): unknown {
    return { lastFlood: this.lastFlood };
  }
  load(state: unknown): void {
    (state as { lastFlood: (Ref | null)[] }).lastFlood.forEach((r, i) => (this.lastFlood[i] = r));
  }
}

export class ToyMarket implements StateStore {
  readonly name = "market.prices";
  readonly prices = new FieldTable(CELLS, 1);
  hashInto(h: Hasher): void {
    this.prices.hashInto(h);
  }
  save(): unknown {
    return this.prices.save();
  }
  load(state: unknown): void {
    this.prices.load(state as TableState);
  }
}

function neighbours(c: number): number[] {
  return [(c + CELLS - 1) % CELLS, (c + 1) % CELLS];
}

export type ToyOptions = { reverseRegistration?: boolean; floodOrder?: "ab" | "ba" };

export function makeToyWorld(seedText: string, options: ToyOptions = {}): World {
  const world = new World(seedFromText(seedText));
  const pop = world.register(new ToyPopulation());
  const market = world.register(new ToyMarket());
  const memory = world.register(new ToyMemory());
  const rng = world.rng;
  for (let c = 0; c < CELLS; c++) {
    for (let k = 0; k < CLASSES; k++) pop.counts.set(c, k, 50 + rng.index(100, BIRTH, c, 0, 0, k));
    market.prices.set(c, 0, 1 + rng.real(PRICE, c));
  }

  const systems: SystemSpec[] = [
    {
      key: "040.toy.births",
      every: MONTH,
      run: (t) => {
        const d = new CountDeltas(pop.counts);
        for (let c = 0; c < CELLS; c++)
          for (let k = 0; k < CLASSES; k++) {
            const n = pop.counts.get(c, k),
              price = market.prices.get(c, 0),
              births = poisson((n * 0.004) / price, (i) => rng.real(BIRTH, c, t, k, i)),
              deaths = Math.min(
                n,
                poisson(n * 0.0035, (i) => rng.real(DEATH, c, t, k, i)),
              );
            d.add(c, k, births - deaths);
          }
        d.commit(pop.counts);
      },
    },
    {
      key: "041.toy.migration",
      every: MONTH,
      offset: DAY,
      run: (t) => {
        const d = new CountDeltas(pop.counts);
        for (let c = 0; c < CELLS; c++) {
          const near = neighbours(c),
            weights = near.map((n) => dmath.exp(market.prices.get(c, 0) - market.prices.get(n, 0)));
          const leaving = Math.floor(pop.counts.rowSum(c) * 0.01);
          if (leaving >= 3) {
            const here = market.prices.get(c, 0),
              there = (market.prices.get(near[0]!, 0) + market.prices.get(near[1]!, 0)) / 2,
              flood = memory.lastFlood[c] ?? null;
            const decision = world.decisions.record({
              rule: "toy.leave",
              subject: cellRef(c),
              outcome: leaving,
              score: here - there + (flood ? 0.2 : 0),
              threshold: 0,
              factors: [
                { name: "price here", value: here, contribution: here, source: null },
                { name: "price nearby", value: there, contribution: -there, source: null },
                {
                  name: "last flood",
                  value: flood ? 1 : 0,
                  contribution: flood ? 0.2 : 0,
                  source: flood ? { ref: flood, role: "pressure", weight: 1 } : null,
                },
              ],
            });
            world.events.emit({
              type: EXODUS_EVENT.type,
              place: cellRef(c),
              causes: [{ ref: decision, role: "trigger", weight: 1 }],
              data: { leaving },
            });
          }
          for (let k = 0; k < CLASSES; k++) {
            const movers = Math.floor(pop.counts.get(c, k) * 0.01),
              split = apportion(
                movers,
                weights,
                near.map((n) => rng.u32(MOVE, c, t, k, n)),
              );
            near.forEach((n, i) => d.move(c, k, n, k, split[i]!));
          }
        }
        d.commit(pop.counts);
      },
    },
    {
      key: "060.toy.market",
      every: DAY,
      run: (t) => {
        const next: number[] = [];
        for (let c = 0; c < CELLS; c++) {
          const n = pop.counts.rowSum(c),
            season = dmath.sin((dmath.TAU * (t % (365 * DAY))) / (365 * DAY) + c),
            p =
              market.prices.get(c, 0) * (1 + 0.002 * (n / 450 - 1) + 0.001 * season) +
              0.0005 * (rng.real(PRICE, c, t) - 0.5);
          next.push(dmath.clamp(p, 0.2, 5));
        }
        next.forEach((p, c) => market.prices.set(c, 0, p));
      },
    },
  ];
  for (const s of options.reverseRegistration ? [...systems].reverse() : systems) world.system(s);

  world.handler({
    type: "toy.flood",
    key: "070.toy.flood",
    run: (item, t) => {
      const { cell, cause } = item.payload as { cell: number; cause: Ref | null };
      let drowned = 0;
      for (let k = 0; k < CLASSES; k++) {
        const n = pop.counts.get(cell, k),
          lost = Math.floor(n * 0.1);
        drowned += lost;
        pop.counts.set(cell, k, n - lost);
      }
      const trigger: CauseRef = { ref: cause ?? floodplainRef(cell), role: "trigger", weight: 1 };
      const flood = world.events.emit({
        type: FLOOD_EVENT.type,
        place: cellRef(cell),
        causes: [trigger],
        data: { drowned },
      });
      memory.lastFlood[cell] = flood;
      const wait = (30 + rng.index(300, FLOOD, cell, t)) * DAY,
        next = rng.index(CELLS, FLOOD, cell, t, 1);
      world.scheduler.schedule(t + wait, "toy.flood", `cell:${next}`, { cell: next, cause: flood });
    },
  });
  const floods: [string, number][] = [
    ["cell:3", 3],
    ["cell:11", 11],
  ];
  for (const [subject, cell] of options.floodOrder === "ba" ? [...floods].reverse() : floods)
    world.scheduler.schedule(40 * DAY, "toy.flood", subject, { cell, cause: null });

  world.defineCommand({
    type: "toy.bless",
    validate: (args) => {
      const a = args as { cell?: unknown; people?: unknown } | null;
      if (!a || !Number.isInteger(a.cell) || (a.cell as number) < 0 || (a.cell as number) >= CELLS)
        return "cell must be an integer cell index";
      if (!Number.isInteger(a.people) || (a.people as number) < 1 || (a.people as number) > 1000)
        return "people must be an integer from 1 to 1000";
      return null;
    },
    apply: (command) => {
      const { cell, people } = command.args as { cell: number; people: number };
      pop.counts.add(cell, 0, people);
      world.events.emit({
        type: BLESSING_EVENT.type,
        place: cellRef(cell),
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: { people },
      });
    },
  });
  return world;
}
