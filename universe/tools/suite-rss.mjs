// Preloaded into each test process by tools/suite.ts: on the way out, say how much memory
// the process held at its most (kilobytes), on a line the runner reads off stderr.
import { writeSync } from "node:fs";
import { isMainThread } from "node:worker_threads";

if (isMainThread)
  process.on("exit", () => {
    try {
      writeSync(2, `\n#suite-rss ${process.resourceUsage().maxRSS}\n`);
    } catch {
      // A closed stderr: the runner goes without this file's memory.
    }
  });
