const vm = require("node:vm");
const { composeRuntime, readSections } = require("./compose-runtime.cjs");

const sections = readSections();
new vm.Script(composeRuntime({ format: "script" }), { filename: "causalis.runtime.js" });
console.log(`Runtime syntax is valid across ${sections.length} ordered sections.`);
