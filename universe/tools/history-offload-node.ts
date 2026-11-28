// Node's worker for old blocks of history (src/host/history-offload.ts is the page's): for tools and tests that run a world
// in Node with its housekeeping off the thread, as the game's is. A rewrite asked for before it is back is waited for
// (Node can: Atomics.wait), so every one is written in the worker.
import {
  MessageChannel,
  Worker,
  receiveMessageOnPort,
  type MessagePort,
} from "node:worker_threads";
import type {
  EventParts,
  EventRewrite,
  HistoryOffload,
  HistoryTicket,
  Words,
} from "../src/kernel/index.ts";
import { WordsSent, type FromRewriter } from "../src/host/history-rewrite.ts";

export class NodeOffload implements HistoryOffload {
  private readonly worker: Worker;
  private readonly port: MessagePort;
  /** Bumped by the worker at each reply. */
  private readonly replies = new Int32Array(new SharedArrayBuffer(4));
  private next = 1;
  private readonly sent = new WordsSent();
  private readonly back = new Map<number, EventParts | null>();
  /** How long the thread waited in all, in ms, and how many it waited for. */
  waited = 0;
  waits = 0;
  /** How many rewrites were sent, and how many came back unwritten (written in the world's thread). */
  rewrites = 0;
  unwritten = 0;

  constructor() {
    const { port1, port2 } = new MessageChannel();
    this.port = port1;
    this.worker = new Worker(new URL("./history-worker-node.ts", import.meta.url), {
      workerData: { port: port2, replies: this.replies },
      transferList: [port2],
    });
    this.worker.unref();
  }

  start(words: Words, job: EventRewrite): HistoryTicket {
    const id = this.next++;
    this.rewrites++;
    this.port.postMessage(this.sent.message(id, words, job));
    return { take: () => this.take(id) };
  }

  private take(id: number): EventParts | null {
    let at = 0;
    for (;;) {
      const seen = Atomics.load(this.replies, 0);
      for (let m = receiveMessageOnPort(this.port); m; m = receiveMessageOnPort(this.port)) {
        const r = m.message as FromRewriter;
        this.back.set(r.id, r.parts);
      }
      if (this.back.has(id)) {
        const parts = this.back.get(id)!;
        this.back.delete(id);
        if (at) this.waited += performance.now() - at;
        if (!parts) this.unwritten++;
        return parts;
      }
      if (!at) {
        at = performance.now();
        this.waits++;
      }
      if (Atomics.wait(this.replies, 0, seen, 120_000) === "timed-out")
        throw new Error("the history worker gave no reply in two minutes");
    }
  }

  close(): Promise<number> {
    return this.worker.terminate();
  }
}
