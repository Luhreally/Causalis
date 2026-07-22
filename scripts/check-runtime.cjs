const vm = require("node:vm");
const { composeRuntime, readSections } = require("./compose-runtime.cjs");

const sections = readSections();
const runtime = composeRuntime({ format: "script" });
new vm.Script(runtime, { filename: "causalis.runtime.js" });

// The legacy single-file build ran as a sloppy classic script. The modular runtime
// runs as an ES module, where assigning to an undeclared function name aborts all
// initialization before controls can bind. Catch that exact regression statically.
const functionDeclarations = new Set(
    [...runtime.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((match) => match[1]),
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

console.log(
  `Runtime syntax and strict-module override bindings are valid across ${sections.length} ordered sections.`,
);
