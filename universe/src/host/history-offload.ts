// Old blocks of history written again in a worker of the simulation's own (kernel/cold.ts: HistoryOffload), so that a
// year's housekeeping (some 9 ms of every year of a world at 1,300 to 1,500) and an age's reckoning (0.7 s at once at 1,500)
// leave the simulation's thread. What comes back is applied between slices; one not back when it is needed is written in
// the simulation's thread, as it would have been: nothing the world does or saves depends on which.
import type {
  EventParts,
  EventRewrite,
  HistoryOffload,
  HistoryTicket,
  Words,
} from "../kernel/index.ts";
import { WordsSent, type FromRewriter } from "./history-rewrite.ts";

export class WorkerOffload implements HistoryOffload {
  private worker: Worker | null = null;
  /** No worker can be had (none in this place, or it failed): every rewrite is written in the simulation's thread. */
  private broken = false;
  private next = 1;
  private readonly sent = new WordsSent();
  /** Rewrites sent and not yet taken: what came back (null if it was not written there), or undefined while away. */
  private readonly back = new Map<number, EventParts | null | undefined>();

  start(words: Words, job: EventRewrite): HistoryTicket | null {
    const worker = this.ready();
    if (!worker) return null;
    const id = this.next++;
    try {
      worker.postMessage(this.sent.message(id, words, job));
    } catch {
      this.fail();
      return null;
    }
    this.back.set(id, undefined);
    return {
      take: () => {
        const parts = this.back.get(id);
        this.back.delete(id);
        return parts ?? null;
      },
    };
  }

  private ready(): Worker | null {
    if (this.worker || this.broken) return this.worker;
    if (typeof Worker === "undefined") {
      this.broken = true;
      return null;
    }
    try {
      const worker = new Worker(new URL("./history-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e: MessageEvent<FromRewriter>) => {
        // (One taken before it came back was written in the simulation's thread: let go.)
        if (this.back.has(e.data.id)) this.back.set(e.data.id, e.data.parts);
      };
      worker.onerror = () => this.fail();
      worker.onmessageerror = () => this.fail();
      this.worker = worker;
    } catch {
      this.broken = true;
    }
    return this.worker;
  }

  private fail(): void {
    this.broken = true;
    this.worker?.terminate();
    this.worker = null;
    for (const id of this.back.keys()) this.back.set(id, null);
  }
}
