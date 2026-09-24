const vm = require("node:vm");
const { composeRuntime, readSections } = require("./compose-runtime.cjs");

const sections = readSections();
const runtime = composeRuntime({ format: "script" });
new vm.Script(runtime, { filename: "causalis.runtime.js" });

// The legacy single-file build ran as a sloppy classic script. The modular runtime
// runs as an ES module, where assigning to an undeclared function name aborts all
// initialization before controls can bind. Catch that exact regression statically.
const functionDeclarations = new Set(
    [...runtime.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)].map((match) => match[1]),
  ),
  undeclaredOverrides = [
    ...new Set(
      [...runtime.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*=\s*function\b/gm)]
        .map((match) => match[1])
        .filter((name) => !functionDeclarations.has(name)),
    ),
  ];
if (undeclaredOverrides.length)
  throw new Error(
    `Strict-module binding failure: override target(s) lack declarations: ${undeclaredOverrides.join(", ")}`,
  );

// An assignment to an undeclared name is caught above; a *read* of one is not
// a load error in a single closure, it is a rule that never runs — and behind
// a `typeof x === "function"` guard, a feature that is silently off. Two were
// found the day this was added: a robber's kin check that called `isKin`, which
// never existed, and an export line that called `worldAgeName`. Every free
// reference in the composite must resolve to a declaration or an allowed
// browser or language global (scripts/lint-undefined.cjs).
const { lintUndefined } = require("./lint-undefined.cjs"),
  { findings } = lintUndefined(runtime);
if (findings.length)
  throw new Error(
    `Undeclared name(s) read by the runtime: ${findings
      .map((f) => `${f.name} (${f.where.join(", ")})`)
      .join("; ")}`,
  );

console.log(
  `Runtime syntax, strict-module override bindings and every free reference are valid across ${sections.length} ordered sections.`,
);
