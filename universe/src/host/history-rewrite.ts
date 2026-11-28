// What a worker beside the simulation's does with old blocks of history (kernel/cold.ts: HistoryOffload): writes a run of
// them again as tidy would have here, with words of its own kept in step with the world's. Shared by the page's worker
// (history-worker.ts) and Node's (tools/history-worker-node.ts).
import { ColdEvents, Words, type EventParts, type EventRewrite } from "../kernel/index.ts";

export type ToRewriter = {
  readonly id: number;
  /** All the words, to a worker that has none of these yet; or those added since the last it was sent. */
  readonly words?: readonly string[];
  readonly add?: readonly string[];
  readonly job: EventRewrite;
};

/** The block written, or null if it named a word the world's words lack (it is then written in the sim's thread). */
export type FromRewriter = { readonly id: number; readonly parts: EventParts | null };

export class Rewriter {
  private words = new Words();

  handle(m: ToRewriter): FromRewriter {
    if (m.words) this.words = new Words(m.words);
    else for (const w of m.add ?? []) this.words.idOf(w);
    const had = this.words.list.length;
    try {
      const parts = ColdEvents.rewrite(this.words, m.job);
      if (this.words.list.length === had) return { id: m.id, parts };
    } catch {
      // (Written in the sim's thread instead, where whatever it was is met as it would have been.)
    }
    // (A word the world gave none: the world gives it when it writes the block itself.)
    this.words = new Words(this.words.list.slice(0, had));
    return { id: m.id, parts: null };
  }
}

/** The words a rewrite carries: all of them the first time a worker meets them, then only those added since. */
export class WordsSent {
  private words: Words | null = null;
  private sent = 0;

  message(id: number, words: Words, job: EventRewrite): ToRewriter {
    const fresh = words !== this.words || words.list.length < this.sent,
      m: ToRewriter = fresh
        ? { id, words: words.list.slice(), job }
        : { id, add: words.list.slice(this.sent), job };
    this.words = words;
    this.sent = words.list.length;
    return m;
  }
}
