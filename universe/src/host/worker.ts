// The worker's entry: the simulation host in its own thread, stepping as fast as
// its budget allows and sleeping when idle. The page talks to it only through
// the protocol (bridge/protocol.ts).
import type { Port, ToHost, ToMain } from "../bridge/index.ts";
import { SimHost } from "./host.ts";
import { IndexedDbByteStore } from "./storage.ts";
import { UNIVERSES } from "./universes.ts";

type WorkerScope = {
  postMessage(message: unknown, transfer: Transferable[]): void;
  onmessage: ((e: MessageEvent) => void) | null;
  close(): void;
};
const scope = globalThis as unknown as WorkerScope;

const port: Port<ToHost, ToMain> = {
  post: (message, transfer) => scope.postMessage(message, transfer ?? []),
  onMessage: (handler) => {
    scope.onmessage = (e: MessageEvent<ToHost>) => {
      handler(e.data);
      wake();
    };
  },
  close: () => scope.close(),
};

let storage: IndexedDbByteStore | undefined;
try {
  storage = new IndexedDbByteStore();
} catch {
  storage = undefined;
}

const host = new SimHost(port, UNIVERSES, {
  clock: () => performance.now(),
  ...(storage ? { storage } : {}),
});

// One loop at a time: a message during a pump waits for it (the pump reads the inbox
// again next turn); a message during the loop's sleep wakes it at once.
let timer: ReturnType<typeof setTimeout> | null = null,
  running = false;
function wake(): void {
  if (running) return;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(loop, 0);
}
async function loop(): Promise<void> {
  timer = null;
  running = true;
  try {
    await host.pump();
  } finally {
    running = false;
  }
  timer = setTimeout(loop, host.idle ? 50 : 4);
}
wake();
