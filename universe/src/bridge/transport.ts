// Transports for the protocol. A worker port on the page side, and an in-thread
// pair for debugging, tests and devices without module workers. The in-thread
// pair clones every message with the same transfer semantics as postMessage, so
// code that works in-thread cannot quietly depend on sharing objects.
import type { Port, ToHost, ToMain } from "./protocol.ts";

/** The page's end of a worker running the host. */
export function workerPort(worker: Worker): Port<ToMain, ToHost> {
  return {
    post: (message, transfer) => worker.postMessage(message, transfer ?? []),
    onMessage: (handler) => {
      worker.onmessage = (e: MessageEvent<ToMain>) => handler(e.data);
    },
    close: () => worker.terminate(),
  };
}

type Queue<T> = { handler: ((m: T) => void) | null; pending: T[] };

function end<In, Out>(
  inbox: Queue<In>,
  outbox: Queue<Out>,
  closed: { value: boolean },
): Port<In, Out> {
  return {
    post: (message, transfer) => {
      if (closed.value) return;
      const copy = structuredClone(message, { transfer: transfer ?? [] });
      queueMicrotask(() => {
        if (closed.value) return;
        if (outbox.handler) outbox.handler(copy);
        else outbox.pending.push(copy);
      });
    },
    onMessage: (handler) => {
      inbox.handler = handler;
      for (const m of inbox.pending.splice(0)) queueMicrotask(() => handler(m));
    },
    close: () => {
      closed.value = true;
    },
  };
}

/** Two connected ends in one thread: [the page's end, the host's end]. */
export function inlinePair(): [Port<ToMain, ToHost>, Port<ToHost, ToMain>] {
  const toMain: Queue<ToMain> = { handler: null, pending: [] },
    toHost: Queue<ToHost> = { handler: null, pending: [] },
    closed = { value: false };
  return [end(toMain, toHost, closed), end(toHost, toMain, closed)];
}
