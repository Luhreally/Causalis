// node tools/history-moved.mjs <base commit>: prints "true" if history's code has moved since that commit,
// "false" if it has not. The checks that only run history say again what they said then where it has not, so CI
// passes them over. Plain JavaScript and git alone: it runs before anything is installed.
//
// src/host/planet.ts builds the world, and also lists what pages may ask of it; a new page adds a line there
// and history is none the wiser. So that file is compared without its imports and without its `queries` block.
import { execFileSync } from "node:child_process";

const base = process.argv[2];
if (!base) throw new Error("usage: node tools/history-moved.mjs <base commit>");

const PLANET = "universe/src/host/planet.ts";
const WHOLE = [
  "universe/src/sim",
  "universe/src/rules",
  "universe/src/kernel",
  "universe/src/gen",
  "universe/src/host/kinds.ts",
  "universe/package-lock.json",
  "universe/tools/sky-survey.ts",
  "universe/tools/engines.ts",
  "universe/tools/phase2-gate.ts",
  "universe/tools/phase3-gate.ts",
  "universe/tools/phase4-gate.ts",
  "universe/tools/phase5-gate.ts",
  "universe/tools/phase6-gate.ts",
];

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });

/** What a file of the world's building says, without its imports and the block of what pages may ask. */
export function worldPart(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n"),
    kept = [];
  let inImport = false;
  let queries = -1;
  for (const line of lines) {
    if (queries >= 0) {
      // (The block ends at the closing brace at its own indent.)
      if (line.startsWith(" ".repeat(queries) + "}")) queries = -1;
      continue;
    }
    if (inImport) {
      if (/from\s+"[^"]+";\s*$/.test(line)) inImport = false;
      continue;
    }
    if (/^import\s/.test(line)) {
      if (!/;\s*$/.test(line)) inImport = true;
      continue;
    }
    const opens = /^(\s*)queries: \{\s*$/.exec(line);
    if (opens) {
      queries = opens[1].length;
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n");
}

function moved() {
  try {
    git("cat-file", "-e", `${base}^{commit}`);
  } catch {
    return true;
  }
  if (git("diff", "--name-only", base, "HEAD", "--", ...WHOLE).trim()) return true;
  return worldPart(git("show", `${base}:${PLANET}`)) !== worldPart(git("show", `HEAD:${PLANET}`));
}

console.log(moved() ? "true" : "false");
