// node tools/lint.ts — the architecture lints over src/ (see tools/lint-rules.ts).
// Every module folder must exist with an index.ts and a README.md contract.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DETERMINISTIC,
  MODULES,
  lintBoundaries,
  lintDeterminism,
  moduleOf,
  type Violation,
} from "./lint-rules.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (path.endsWith(".ts")) out.push(path);
  }
  return out;
}

const violations: Violation[] = [];
for (const module of MODULES) {
  for (const required of ["index.ts", "README.md"]) {
    if (!existsSync(join(root, "src", module, required)))
      violations.push({
        file: `src/${module}/${required}`,
        line: 1,
        column: 1,
        rule: "layout",
        message: `every module has ${required}`,
      });
  }
}
const all = files(join(root, "src"));
for (const path of all) {
  const file = relative(root, path).split(sep).join("/"),
    text = readFileSync(path, "utf8"),
    module = moduleOf(file);
  violations.push(...lintBoundaries(file, text));
  if (module && DETERMINISTIC.has(module)) violations.push(...lintDeterminism(file, text));
}
for (const v of violations) console.log(`${v.file}:${v.line}:${v.column}  ${v.rule}  ${v.message}`);
console.log(
  `lint: ${all.length} files, ${violations.length} problem${violations.length === 1 ? "" : "s"}`,
);
if (violations.length) process.exitCode = 1;
