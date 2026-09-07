// Reusable headless VM loader for the Causalis runtime (mirrors tests/smoke-test.cjs preamble).
// Used by scripts/regression-200.cjs; CAUSALIS_ROOT may point at another checkout for A/B runs.
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const path = require("node:path");
const PROJECT = process.env.CAUSALIS_ROOT || path.join(__dirname, "..");
const { composeRuntime } = require(path.join(PROJECT, "scripts/compose-runtime.cjs"));

class ClassList {
  constructor() { this.values = new Set(); }
  add(...v) { v.forEach((x) => this.values.add(x)); }
  remove(...v) { v.forEach((x) => this.values.delete(x)); }
  contains(v) { return this.values.has(v); }
  toggle(v, force) { const n = force == null ? !this.values.has(v) : !!force; n ? this.values.add(v) : this.values.delete(v); return n; }
}
function makeSandbox() {
  const drawOps = { count: 0 };
  const gradient = { addColorStop() { drawOps.count++; } };
  const ctx = new Proxy(
    {
      createRadialGradient() { drawOps.count++; return gradient; },
      createLinearGradient() { drawOps.count++; return gradient; },
      measureText(t) { return { width: String(t).length * 6 }; },
      getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
      createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    },
    {
      get(t, p) { if (p in t) return t[p]; if (typeof p === "symbol") return t[p]; t[p] = () => { drawOps.count++; }; return t[p]; },
      set(t, p, v) { t[p] = v; return true; },
    },
  );
  class Element {
    constructor(id = "") {
      this.id = id; this.classList = new ClassList(); this.style = { setProperty() {} }; this.dataset = {}; this.children = [];
      this.clientWidth = id === "world" ? 960 : 300; this.clientHeight = id === "world" ? 720 : 120;
      this.width = this.clientWidth; this.height = this.clientHeight;
      this.value = ""; this.checked = false; this.disabled = false; this.innerHTML = ""; this.textContent = "";
    }
    getContext() { return ctx; }
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
    addEventListener() {} appendChild(c) { this.children.push(c); return c; } remove() {} setAttribute() {} matches() { return false; }
    querySelector() { return new Element(); } querySelectorAll() { return []; } closest() { return null; } after() {} select() {}
    setPointerCapture() {} releasePointerCapture() {} focus() {} blur() {} scrollIntoView() {} insertAdjacentHTML() {}
  }
  const elements = new Map();
  const getElement = (id) => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const document = {
    body: new Element("body"), documentElement: new Element("html"), getElementById: getElement,
    querySelector(s) { return s.startsWith("#") ? getElement(s.slice(1)) : new Element(); },
    querySelectorAll() { return []; }, createElement(t) { return new Element(t); }, execCommand() { return true; },
    addEventListener() {}, hidden: false, visibilityState: "visible",
  };
  const storage = new Map();
  const localStorage = {
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); }, removeItem(k) { storage.delete(k); },
  };
  const windowObject = { addEventListener() {}, AudioContext: null, webkitAudioContext: null, matchMedia() { return { matches: false, addEventListener() {} }; } };
  const sandbox = {
    console, document, localStorage, crypto: webcrypto, navigator: { maxTouchPoints: 0, userAgent: "node" }, window: windowObject,
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {}, setTimeout, clearTimeout, setInterval, clearInterval, performance,
    devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800, Blob, URL, TextEncoder, TextDecoder,
    btoa(v) { return Buffer.from(v, "binary").toString("base64"); }, atob(v) { return Buffer.from(v, "base64").toString("binary"); },
    drawOps,
  };
  Object.assign(windowObject, sandbox);
  vm.createContext(sandbox);
  return { sandbox, getElement, drawOps };
}
// transform: optional (script) => script for splicing hooks.
function loadRuntime({ transform, bridge = true } = {}) {
  let script = composeRuntime({ format: "script" });
  if (bridge) {
    // Closure bridge: eval inside the closure lets probes read any internal binding by name.
    const marker = "\nreturn {boot};";
    if (!script.includes(marker)) throw new Error("bridge marker missing");
    script = script.replace(marker, "\nglobalThis.__PROBE__={get:(n)=>eval(n),set:(n,v)=>{eval(n+'=v');},W:()=>W};" + marker);
  }
  if (transform) script = transform(script);
  const { sandbox, getElement, drawOps } = makeSandbox();
  vm.runInContext(script, sandbox, { filename: "causalis.runtime.js" });
  const probe = sandbox.__PROBE__;
  return { sandbox, getElement, drawOps, probe, get: probe.get, game: sandbox.window.ALIFE_DEBUG };
}
module.exports = { loadRuntime, makeSandbox, PROJECT };
