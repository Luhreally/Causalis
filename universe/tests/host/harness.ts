// Drive a host in-thread: a client and a host joined by an in-thread pair, a fake
// clock, and a helper that pumps the host until a request settles.
import { HostClient, inlinePair } from "../../src/bridge/index.ts";
import { MemoryByteStore, SimHost, UNIVERSES, type ByteStore } from "../../src/host/index.ts";

export type Rig = {
  readonly client: HostClient;
  readonly host: SimHost;
  readonly clock: { now: number };
  /** Pump until the promise settles; returns its value. */
  settle<T>(p: Promise<T>): Promise<T>;
  /** Advance the fake clock by ms and pump once. */
  tick(ms: number): Promise<void>;
};

const turn = () => new Promise<void>((r) => setImmediate(r));

export function rig(storage: ByteStore = new MemoryByteStore()): Rig {
  const [page, hostEnd] = inlinePair(),
    clock = { now: 0 },
    host = new SimHost(hostEnd, UNIVERSES, { clock: () => clock.now, storage, budgetMs: 1e9 }),
    client = new HostClient(page);
  return {
    client,
    host,
    clock,
    async settle<T>(p: Promise<T>): Promise<T> {
      let done = false,
        value: T | undefined,
        error: unknown;
      p.then(
        (v) => {
          done = true;
          value = v;
        },
        (e) => {
          done = true;
          error = e;
        },
      );
      for (let i = 0; i < 1000 && !done; i++) {
        await turn();
        await host.pump();
        await turn();
      }
      if (!done) throw new Error("the host never answered");
      if (error) throw error;
      return value as T;
    },
    async tick(ms: number) {
      clock.now += ms;
      await turn();
      await host.pump();
      await turn();
    },
  };
}
