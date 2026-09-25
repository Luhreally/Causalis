// The sandbox universe (Phase 0): the toy world, its one view and its questions.
// The frame is designed for what the view shows — a ring of sixteen cells with
// their people by class, their prices and how long since each last flooded —
// not a copy of the world.
import { DAY, type Ref, type World } from "../kernel/index.ts";
import {
  CELLS,
  CLASSES,
  FLOOD_EVENT,
  cellRef,
  makeToyWorld,
  type ToyMarket,
  type ToyMemory,
  type ToyPopulation,
} from "../sim/index.ts";
import type { Universe } from "./host.ts";

function stores(world: World) {
  return {
    pop: world.store<ToyPopulation>("toy.population"),
    market: world.store<ToyMarket>("market.prices"),
    memory: world.store<ToyMemory>("toy.memory"),
  };
}

export const SANDBOX: Universe = {
  name: "sandbox",
  version: "sandbox-1",
  defaultView: "ring",
  build: (seed) => makeToyWorld(seed.text),
  frames: {
    ring: (world) => {
      const { pop, market, memory } = stores(world);
      const people = new Float32Array(CELLS * CLASSES),
        prices = new Float32Array(CELLS),
        floodAge = new Float32Array(CELLS);
      for (let c = 0; c < CELLS; c++) {
        for (let k = 0; k < CLASSES; k++) people[c * CLASSES + k] = pop.counts.get(c, k);
        prices[c] = market.prices.get(c, 0);
        const flood = memory.lastFlood[c],
          e = flood ? world.events.get(flood) : undefined;
        floodAge[c] = e ? (world.now - e.t) / DAY : -1;
      }
      return { meta: { cells: CELLS, classes: CLASSES }, arrays: { people, prices, floodAge } };
    },
  },
  queries: {
    summary: (world) => {
      const { pop } = stores(world);
      return {
        t: world.now,
        people: pop.counts.total(),
        events: world.events.all().length,
        floods: world.events.all().filter((e) => e.type === FLOOD_EVENT.type).length,
        commands: world.commands.all().length,
      };
    },
    cell: (world, args) => {
      const cell = (args as { cell: number }).cell;
      if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) throw new Error(`no cell ${cell}`);
      const { pop, market, memory } = stores(world),
        place: Ref = cellRef(cell);
      return {
        cell,
        ref: place,
        people: pop.counts.row(cell),
        price: market.prices.get(cell, 0),
        lastFlood: memory.lastFlood[cell],
        recent: world.events
          .all()
          .filter((e) => e.place === place)
          .slice(-8)
          .map((e) => ({ id: e.id, t: e.t, type: e.type })),
      };
    },
  },
};
