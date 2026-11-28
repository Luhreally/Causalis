// Node's worker for old blocks of history (history-offload-node.ts).
import { workerData, type MessagePort } from "node:worker_threads";
import { Rewriter, type ToRewriter } from "../src/host/history-rewrite.ts";

const { port, replies } = workerData as { port: MessagePort; replies: Int32Array },
  rewriter = new Rewriter();

port.on("message", (m: ToRewriter) => {
  port.postMessage(rewriter.handle(m));
  Atomics.add(replies, 0, 1);
  Atomics.notify(replies, 0);
});
