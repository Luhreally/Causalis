// Every free identifier in the composed runtime that nothing declares.
//
// The runtime is one closure with one namespace and no imports, so a
// misspelled name is not a load error: it is a rule that quietly never runs,
// and behind a `typeof x === "function"` guard it is a feature that is silently
// off. `check-runtime.cjs` catches an assignment to an undeclared name; it
// cannot catch a read of one. This parses the composite, resolves every
// reference against every declaration in scope the way the engine does, and
// prints what is left over: the browser and language globals the runtime is
// entitled to, which are allowed by name below, and everything else, which is
// a bug. References made under `typeof` are reported too — that is the whole
// point — and marked.
//
// node scripts/lint-undefined.cjs            report and exit 1 on any finding
// node scripts/lint-undefined.cjs --all      list the allowed globals seen as well
const acorn = require("acorn");
const { analyze } = require("eslint-scope");
const { composeRuntime, compositeLineMap, mapCompositeLine } = require("./compose-runtime.cjs");

// What a browser gives a script, and what the language does. Anything the
// runtime reads that is not here and not declared in a section is reported.
const ALLOWED = new Set(
  (
    "globalThis window self document navigator location history screen performance console " +
    "localStorage sessionStorage indexedDB IDBKeyRange crypto fetch Request Response Headers AbortController " +
    "setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame requestIdleCallback cancelIdleCallback queueMicrotask structuredClone " +
    "devicePixelRatio innerWidth innerHeight outerWidth outerHeight visualViewport matchMedia getComputedStyle scrollTo scrollBy open close alert confirm prompt print focus blur " +
    "Blob File FileReader URL URLSearchParams TextEncoder TextDecoder btoa atob Image ImageData ImageBitmap createImageBitmap OffscreenCanvas Path2D DOMMatrix DOMPoint DOMRect " +
    "HTMLElement HTMLCanvasElement HTMLInputElement HTMLSelectElement HTMLTextAreaElement Element Node NodeList Document DocumentFragment Window Event CustomEvent EventTarget " +
    "KeyboardEvent MouseEvent PointerEvent TouchEvent WheelEvent InputEvent FocusEvent DragEvent ClipboardEvent " +
    "AudioContext webkitAudioContext OscillatorNode GainNode AudioBuffer speechSynthesis SpeechSynthesisUtterance Notification " +
    "Worker SharedWorker MessageChannel MessagePort BroadcastChannel WebSocket XMLHttpRequest DOMParser XMLSerializer " +
    "ResizeObserver IntersectionObserver MutationObserver PerformanceObserver " +
    "CanvasRenderingContext2D CanvasGradient CanvasPattern WebGLRenderingContext WebGL2RenderingContext " +
    "Object Function Array Number Boolean String Symbol BigInt Math JSON Date RegExp Error TypeError RangeError SyntaxError ReferenceError EvalError URIError AggregateError " +
    "Map Set WeakMap WeakSet WeakRef FinalizationRegistry Promise Proxy Reflect Intl " +
    "ArrayBuffer SharedArrayBuffer DataView Atomics Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array BigInt64Array BigUint64Array " +
    "parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI escape unescape " +
    "Infinity NaN undefined eval arguments WebAssembly"
  ).split(/\s+/),
);

function lintUndefined(runtime = composeRuntime({ format: "script" })) {
  const ast = acorn.parse(runtime, { ecmaVersion: "latest", sourceType: "script", locations: true, ranges: true });
  // The identifiers that stand under a `typeof`: a `typeof x` never throws, so a
  // misspelling there is silent in a way a plain read is not.
  const underTypeof = new Set();
  (function walk(node) {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "UnaryExpression" && node.operator === "typeof" && node.argument?.type === "Identifier") underTypeof.add(node.argument.start);
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "range" || key === "start" || key === "end") continue;
      const child = node[key];
      if (Array.isArray(child)) for (const c of child) walk(c);
      else if (child && typeof child.type === "string") walk(child);
    }
  })(ast);
  const manager = analyze(ast, { ecmaVersion: 2022, sourceType: "script", fallback: "iteration" }),
    map = compositeLineMap(runtime),
    seen = new Map();
  for (const reference of manager.globalScope.through) {
    const id = reference.identifier,
      name = id.name,
      at = mapCompositeLine(id.loc.start.line, map),
      where = at ? `${at.name}:${at.line}` : `composite:${id.loc.start.line}`,
      entry = seen.get(name) || { name, count: 0, typeofCount: 0, where: [] };
    entry.count++;
    if (underTypeof.has(id.start)) entry.typeofCount++;
    if (entry.where.length < 4) entry.where.push(where + (underTypeof.has(id.start) ? " (typeof)" : ""));
    seen.set(name, entry);
  }
  const findings = [...seen.values()].filter((e) => !ALLOWED.has(e.name)).sort((a, b) => a.name.localeCompare(b.name)),
    allowed = [...seen.values()].filter((e) => ALLOWED.has(e.name)).sort((a, b) => b.count - a.count);
  return { findings, allowed, references: manager.globalScope.through.length };
}

if (require.main === module) {
  const { findings, allowed, references } = lintUndefined(),
    all = process.argv.includes("--all");
  if (all) {
    console.log(`allowed globals read by the runtime (${allowed.length}):`);
    for (const e of allowed) console.log(`  ${String(e.count).padStart(5)}  ${e.name}`);
  }
  if (findings.length) {
    console.log(`${findings.length} undeclared name${findings.length === 1 ? "" : "s"} read by the runtime:`);
    for (const e of findings)
      console.log(`  ${e.name}  x${e.count}${e.typeofCount ? ` (${e.typeofCount} under typeof)` : ""}  at ${e.where.join(", ")}${e.count > e.where.length ? ", ..." : ""}`);
    process.exitCode = 1;
  } else console.log(`Every one of ${references} free references in the composed runtime resolves to a declaration or an allowed global.`);
}

module.exports = { lintUndefined, ALLOWED };
