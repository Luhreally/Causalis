const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const gameRoot = path.join(projectRoot, "src", "game");

function readSections() {
  // scripts/test.cjs reads the sections once and hands every test the copy, so
  // an edit made while the suite runs reaches none of it.
  if (process.env.CAUSALIS_SECTIONS_SNAPSHOT)
    return JSON.parse(fs.readFileSync(process.env.CAUSALIS_SECTIONS_SNAPSHOT, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(gameRoot, "manifest.json"), "utf8"));
  return manifest.map((name) => ({
    name,
    source: fs.readFileSync(path.join(gameRoot, "sections", name), "utf8").trimEnd(),
  }));
}

function composeRuntime({ format = "module" } = {}) {
  const body = readSections()
    .map(({ name, source }) => `\n// #region ${name}\n${source}\n// #endregion ${name}`)
    .join("\n");
  const exportLine = format === "module" ? "export default Game;" : "Game.boot();";
  return `"use strict";\nconst Game=(()=>{${body}\nreturn {boot};\n})();\n${exportLine}\n`;
}

// Where a line of the composed runtime came from. The smoke tests run the
// composite as `index.inline.js`, so a stack frame names a line in seventy-five
// thousand; this maps it back to `section:line`. Lines outside every section
// (the wrapper, or a fixture a test injected before `return {boot};`) map to
// null.
function compositeLineMap(runtime = composeRuntime({ format: "script" })) {
  const lines = runtime.split("\n"),
    map = [];
  let open = null;
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    if (line.startsWith("// #region ")) open = { name: line.slice("// #region ".length).trim(), start: n + 2, end: -1 };
    else if (line.startsWith("// #endregion ") && open) {
      open.end = n;
      map.push(open);
      open = null;
    }
  }
  return map;
}
function mapCompositeLine(line, map = compositeLineMap()) {
  for (const section of map)
    if (line >= section.start && line <= section.end) return { name: section.name, line: line - section.start + 1 };
  return null;
}
// Rewrite `index.inline.js:LINE:COL` frames in a stack to `section:line`.
function sectionFrames(text, runtime) {
  const map = compositeLineMap(runtime);
  return String(text).replace(/index\.inline\.js:(\d+)(:\d+)?/g, (frame, line, column) => {
    const at = mapCompositeLine(Number(line), map);
    return at ? `${at.name}:${at.line}${column || ""} (${frame})` : frame;
  });
}

module.exports = { composeRuntime, readSections, compositeLineMap, mapCompositeLine, sectionFrames };
