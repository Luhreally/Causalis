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

let timer: ReturnType<typeof setTimeout> | null = null;
function wake(): void {
  if (timer !== null) return;
  timer = setTimeout(loop, 0);
}
async function loop(): Promise<void> {
  timer = null;
  await host.pump();
  timer = setTimeout(loop, host.idle ? 50 : 4);
}
wake();
