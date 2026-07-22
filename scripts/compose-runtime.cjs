const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const gameRoot = path.join(projectRoot, "src", "game");

function readSections() {
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

module.exports = { composeRuntime, readSections };
