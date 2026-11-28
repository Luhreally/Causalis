// The worker the simulation's own worker starts for old blocks of history (history-offload.ts).
import { Rewriter, type ToRewriter } from "./history-rewrite.ts";

type Scope = {
  postMessage(message: unknown): void;
  onmessage: ((e: MessageEvent<ToRewriter>) => void) | null;
};
const scope = globalThis as unknown as Scope,
  rewriter = new Rewriter();

scope.onmessage = (e) => scope.postMessage(rewriter.handle(e.data));
