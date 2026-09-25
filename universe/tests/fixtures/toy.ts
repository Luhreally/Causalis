// A toy world that exercises the kernel the way real domains will: integer
// populations moved by compute-then-commit flows, a float market updated daily
// with deterministic math, and floods on the agenda that reschedule themselves.
// It knows no planets or people; it exists so the scheduler, the tables, the hash
// chain, saves and replay can be proven before any content depends on them.
import {
  CountDeltas,
  CountTable,
  DAY,
  FieldTable,
  MONTH,
  World,
  apportion,
  defineStream,
  dmath,
  poisson,
  seedFromText,
  type Hasher,
  type StateStore,
  type SystemSpec,
} from "../../src/kernel/index.ts";

export const CELLS = 16;
export const CLASSES = 3;

const BIRTH = defineStream("toy.births");
const DEATH = defineStream("toy.deaths");
const MOVE = defineStream("toy.moves");
const FLOOD = defineStream("toy.floods");
const PRICE = defineStream("toy.prices");

type TableState = { rows: number; cols: number; data: number[] };

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
      const cell = (item.payload as { cell: number }).cell;
      for (let k = 0; k < CLASSES; k++) {
        const n = pop.counts.get(cell, k);
        pop.counts.set(cell, k, n - Math.floor(n * 0.1));
      }
      const wait = (30 + rng.index(300, FLOOD, cell, t)) * DAY,
        next = rng.index(CELLS, FLOOD, cell, t, 1);
      world.scheduler.schedule(t + wait, "toy.flood", `cell:${next}`, { cell: next });
    },
  });
  const floods: [string, number][] = [
    ["cell:3", 3],
    ["cell:11", 11],
  ];
  for (const [subject, cell] of options.floodOrder === "ba" ? [...floods].reverse() : floods)
    world.scheduler.schedule(40 * DAY, "toy.flood", subject, { cell });
  return world;
}
