// Map a line of the composed runtime back to its section and line.
//
// The smoke tests run the composite as `index.inline.js`; a stack frame such as
// `index.inline.js:75379` is a line in seventy-five thousand. This says which
// section it is, and which line of that section. Paste a whole stack trace on
// stdin to have every frame rewritten.
//
// node scripts/linemap.cjs 75379 [more lines...]
// node some-test.cjs 2>&1 | node scripts/linemap.cjs
const { composeRuntime, compositeLineMap, mapCompositeLine, sectionFrames } = require("./compose-runtime.cjs");

const runtime = composeRuntime({ format: "script" }),
  map = compositeLineMap(runtime),
  args = process.argv.slice(2);
if (args.length) {
  for (const arg of args) {
    const line = Number(arg),
      at = mapCompositeLine(line, map);
    console.log(`${arg}  ->  ${at ? `${at.name}:${at.line}` : "outside every section (wrapper or injected fixture)"}`);
  }
} else {
  let text = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (text += chunk));
  process.stdin.on("end", () => process.stdout.write(sectionFrames(text, runtime)));
}
