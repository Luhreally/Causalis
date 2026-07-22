const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { composeRuntime } = require("../scripts/compose-runtime.cjs");

class ClassList {
  constructor(...values) {
    this.values = new Set(values);
  }
  add(...values) {
    values.forEach((value) => this.values.add(value));
  }
  remove(...values) {
    values.forEach((value) => this.values.delete(value));
  }
  contains(value) {
    return this.values.has(value);
  }
  toggle(value, force) {
    const next = force == null ? !this.values.has(value) : !!force;
    next ? this.values.add(value) : this.values.delete(value);
    return next;
  }
}

class StyleDeclaration {
  constructor() {
    this.values = new Map();
  }
  setProperty(name, value) {
    this.values.set(name, String(value));
  }
  getPropertyValue(name) {
    return this.values.get(name) || "";
  }
}

const drawOps = { count: 0 };
const gradient = {
  addColorStop() {
    drawOps.count++;
  },
};
const canvasContext = new Proxy(
  {
    createRadialGradient() {
      return gradient;
    },
    createLinearGradient() {
      return gradient;
    },
    measureText(text) {
      return { width: String(text).length * 6 };
    },
  },
  {
    get(target, prop) {
      if (prop in target || typeof prop === "symbol") return target[prop];
      target[prop] = () => {
        drawOps.count++;
      };
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  },
);

let documentObject;
class Element {
  constructor(id = "") {
    this.id = id;
    this.classList = new ClassList();
    this.style = new StyleDeclaration();
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.parts = new Map();
    this.clientWidth = id === "world" ? 430 : 300;
    this.clientHeight = id === "world" ? 816 : 120;
    this.width = this.clientWidth;
    this.height = this.clientHeight;
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.inert = false;
    this.innerHTML = "";
    this.textContent = "";
  }
  getContext() {
    return canvasContext;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }
  setRect(width, height) {
    this.clientWidth = width;
    this.clientHeight = height;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, event = {}) {
    event.target ||= this;
    event.currentTarget = this;
    event.preventDefault ||= () => {
      event.defaultPrevented = true;
    };
    for (const listener of this.listeners.get(type) || []) listener.call(this, event);
    return event;
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  remove() {}
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  matches() {
    return false;
  }
  querySelector(selector) {
    if (!this.parts.has(selector)) this.parts.set(selector, new Element(`${this.id}:${selector}`));
    return this.parts.get(selector);
  }
  querySelectorAll() {
    return [];
  }
  closest() {
    return null;
  }
  after() {}
  select() {}
  insertAdjacentHTML(_position, html) {
    this.innerHTML += html;
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {
    if (documentObject) documentObject.activeElement = this;
  }
}

const elements = new Map();
const element = (id) => {
  if (!elements.has(id)) elements.set(id, new Element(id));
  return elements.get(id);
};
const collapseLeft = new Element("collapseLeft");
collapseLeft.dataset.collapse = "left";
const collapseRight = new Element("collapseRight");
collapseRight.dataset.collapse = "right";
documentObject = {
  body: new Element("body"),
  documentElement: new Element("html"),
  activeElement: null,
  getElementById: element,
  querySelector(selector) {
    return selector.startsWith("#") ? element(selector.slice(1)) : new Element(selector);
  },
  querySelectorAll(selector) {
    return selector === "[data-collapse]" ? [collapseLeft, collapseRight] : [];
  },
  createElement(tag) {
    return new Element(tag);
  },
  execCommand() {
    return true;
  },
};
documentObject.documentElement.clientWidth = 430;
documentObject.documentElement.clientHeight = 932;

const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};

let coarsePointer = true;
const windowListeners = new Map();
const viewportListeners = new Map();
const addListener = (registry, type, listener) => {
  if (!registry.has(type)) registry.set(type, []);
  registry.get(type).push(listener);
};
const dispatchListeners = (registry, type, event = {}) => {
  event.preventDefault ||= () => {
    event.defaultPrevented = true;
  };
  event.target ||= new Element("eventTarget");
  for (const listener of registry.get(type) || []) listener(event);
  return event;
};
const windowObject = {
  innerWidth: 430,
  innerHeight: 932,
  devicePixelRatio: 3,
  AudioContext: null,
  webkitAudioContext: null,
  matchMedia() {
    return { matches: coarsePointer, addEventListener() {}, removeEventListener() {} };
  },
  addEventListener(type, listener) {
    addListener(windowListeners, type, listener);
  },
  dispatch(type, event) {
    return dispatchListeners(windowListeners, type, event);
  },
  visualViewport: {
    addEventListener(type, listener) {
      addListener(viewportListeners, type, listener);
    },
    dispatch(type, event) {
      return dispatchListeners(viewportListeners, type, event);
    },
  },
};

const sandbox = {
  console,
  document: documentObject,
  localStorage,
  crypto: webcrypto,
  navigator: { maxTouchPoints: 5 },
  window: windowObject,
  requestAnimationFrame() {
    return 1;
  },
  cancelAnimationFrame() {},
  setTimeout,
  clearTimeout,
  performance,
  devicePixelRatio: 3,
  innerWidth: 430,
  innerHeight: 932,
  Blob,
  URL,
  TextEncoder,
  TextDecoder,
  btoa(value) {
    return Buffer.from(value, "binary").toString("base64");
  },
  atob(value) {
    return Buffer.from(value, "base64").toString("binary");
  },
};
Object.assign(windowObject, sandbox, {
  innerWidth: 430,
  innerHeight: 932,
  devicePixelRatio: 3,
  matchMedia: windowObject.matchMedia,
  addEventListener: windowObject.addEventListener,
  dispatch: windowObject.dispatch,
  visualViewport: windowObject.visualViewport,
});

vm.createContext(sandbox);
vm.runInContext(composeRuntime({ format: "script" }), sandbox, { filename: "causalis.mobile.js" });

const game = windowObject.ALIFE_DEBUG;
const mobile = windowObject.ALIFE_MOBILE_DEBUG;
assert.ok(game && mobile, "mobile and game debug surfaces initialize");
const snapshot = (value) => JSON.parse(JSON.stringify(value));

const report = { portrait: {}, gestures: {}, landscape: {}, desktop: {}, static: {} };
const htmlRoot = documentObject.documentElement;
const canvas = element("world");
const leftPanel = element("leftPanel");
const rightPanel = element("rightPanel");

// iPhone 15 Plus portrait: automatic touch mode, phone defaults, safe DPR.
assert.equal(mobile.mode().active, true);
assert.deepEqual(snapshot(mobile.mode().viewport), [430, 932]);
assert.equal(htmlRoot.classList.contains("mobile-mode"), true);
assert.deepEqual(snapshot(mobile.sizes().battery), [72, 44]);
assert.deepEqual(snapshot(mobile.sizes().phone), [96, 58]);
assert.deepEqual(snapshot(mobile.defaults()), {
  size: "phone",
  complexity: "lean",
  quality: "low",
  labels: false,
});
assert.equal(leftPanel.getAttribute("aria-hidden"), "true");
assert.equal(rightPanel.getAttribute("aria-hidden"), "true");
assert.equal(leftPanel.inert, true);
assert.equal(element("edgeScrollToggle").disabled, true);

element("renderQuality").value = "low";
element("renderQuality").onchange({ target: element("renderQuality") });
assert.deepEqual(snapshot(mobile.canvas()), { width: 645, height: 1224, dpr: 1.5 });
report.portrait = {
  mode: mobile.mode(),
  defaults: mobile.defaults(),
  canvas: mobile.canvas(),
  sizes: mobile.sizes(),
};

// Drawers are exclusive, synchronize ARIA/inert/scrim, and retain desktop collapse.
element("dockToolsBtn").onclick();
assert.deepEqual(snapshot(mobile.panels()), { left: true, right: false });
assert.equal(element("dockToolsBtn").getAttribute("aria-expanded"), "true");
assert.equal(leftPanel.getAttribute("aria-hidden"), "false");
assert.equal(leftPanel.inert, false);
assert.equal(element("panelScrim").classList.contains("open"), true);
element("dockInspectBtn").onclick();
assert.deepEqual(snapshot(mobile.panels()), { left: false, right: true });
assert.equal(element("dockToolsBtn").getAttribute("aria-expanded"), "false");
assert.equal(element("dockInspectBtn").getAttribute("aria-expanded"), "true");
assert.equal(leftPanel.inert, true);
assert.equal(rightPanel.inert, false);
element("panelScrim").onclick();
assert.deepEqual(snapshot(mobile.panels()), { left: false, right: false });
assert.equal(documentObject.activeElement, element("dockInspectBtn"));

element("dockToolsBtn").onclick();
collapseLeft.onclick({ preventDefault() {} });
assert.deepEqual(snapshot(mobile.panels()), { left: false, right: false });
assert.equal(leftPanel.classList.contains("collapsed"), false);

element("dockInspectBtn").onclick();
windowObject.dispatch("keydown", { key: "Escape", target: new Element("keyTarget") });
assert.deepEqual(snapshot(mobile.panels()), { left: false, right: false });

// A drawer-dismissal pointer cannot leak through into a world tap.
game.createTestWorld({
  seed: "mobile-input-probe",
  size: "phone",
  lifeDensity: 0.7,
  harshness: 0.5,
  variability: 0.5,
});
element("centerCameraBtn").onclick();
const pointer = (type, pointerId, clientX, clientY) =>
  canvas.dispatch(type, {
    pointerId,
    pointerType: "touch",
    clientX,
    clientY,
    button: 0,
    buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
  });
const beforeDismiss = snapshot(mobile.selection());
element("dockToolsBtn").onclick();
pointer("pointerdown", 1, 215, 320);
pointer("pointerup", 1, 215, 320);
assert.deepEqual(snapshot(mobile.selection()), beforeDismiss);
assert.deepEqual(snapshot(mobile.panels()), { left: false, right: false });

// Sub-10px finger drift is a tap; a deliberate drag pans without applying again.
pointer("pointerdown", 2, 215, 320);
pointer("pointermove", 2, 221, 324);
pointer("pointerup", 2, 221, 324);
assert.ok(
  mobile.selection().tile >= 0 || mobile.selection().entity > 0,
  "a tap with normal finger drift selects the world",
);
const tappedSelection = snapshot(mobile.selection());
const beforePan = mobile.camera();
pointer("pointerdown", 3, 215, 320);
pointer("pointermove", 3, 255, 320);
pointer("pointerup", 3, 255, 320);
const afterPan = mobile.camera();
assert.notEqual(afterPan.x, beforePan.x);
assert.deepEqual(snapshot(mobile.selection()), tappedSelection);

// Two fingers combine anchored pinch zoom with free-roam orbit and tilt. Cancelling
// one finger re-baselines the survivor without a camera jump.
element("centerCameraBtn").onclick();
pointer("pointerdown", 11, 160, 320);
pointer("pointerdown", 12, 260, 320);
pointer("pointermove", 11, 120, 320);
assert.equal(mobile.touches().pinch, true);
pointer("pointercancel", 12, 260, 320);
assert.deepEqual(snapshot(mobile.touches()), { count: 1, pinch: false });
const beforeResume = mobile.camera();
pointer("pointermove", 11, 121, 320);
const afterResume = mobile.camera();
assert.ok(
  Math.abs(afterResume.x - beforeResume.x) < 1,
  "remaining finger resumes without a stale-coordinate pan jump",
);
pointer("pointerup", 11, 121, 320);
assert.deepEqual(snapshot(mobile.touches()), { count: 0, pinch: false });

const beforePinch = mobile.camera();
pointer("pointerdown", 21, 150, 320);
pointer("pointerdown", 22, 250, 320);
pointer("pointermove", 22, 320, 320);
const afterPinch = mobile.camera();
assert.ok(afterPinch.zoom > beforePinch.zoom);
assert.equal(
  afterPinch.angle,
  beforePinch.angle,
  "one-sided pinch motion does not accidentally orbit",
);
pointer("pointerup", 22, 320, 320);
pointer("pointerup", 21, 150, 320);
assert.deepEqual(snapshot(mobile.touches()), { count: 0, pinch: false });

const beforeOrbit = mobile.camera();
pointer("pointerdown", 31, 150, 300);
pointer("pointerdown", 32, 250, 300);
pointer("pointermove", 31, 190, 330);
pointer("pointermove", 32, 290, 330);
const afterOrbit = mobile.camera();
assert.notEqual(afterOrbit.angle, beforeOrbit.angle, "two-finger translation orbits the camera");
assert.notEqual(
  afterOrbit.tilt,
  beforeOrbit.tilt,
  "vertical two-finger translation tilts the camera",
);
assert.equal(afterOrbit.view, "oblique", "free-roam gesture enters the oblique camera");
pointer("pointerup", 32, 290, 330);
pointer("pointerup", 31, 190, 330);
report.gestures = {
  tappedSelection,
  panDelta: +(afterPan.x - beforePan.x).toFixed(4),
  pinchZoom: [beforePinch.zoom, afterPinch.zoom],
  orbitAngle: [beforeOrbit.angle, afterOrbit.angle],
  orbitTilt: [beforeOrbit.tilt, afterOrbit.tilt],
  resumedPanDelta: +(afterResume.x - beforeResume.x).toFixed(4),
};

// iPhone 15 Plus landscape remains in touch mode and keeps the 1.5x Low cap.
windowObject.innerWidth = 932;
windowObject.innerHeight = 430;
documentObject.documentElement.clientWidth = 932;
documentObject.documentElement.clientHeight = 430;
canvas.setRect(932, 328);
windowObject.dispatch("orientationchange");
assert.equal(mobile.mode().active, true);
assert.deepEqual(snapshot(mobile.mode().viewport), [932, 430]);
assert.deepEqual(snapshot(mobile.canvas()), { width: 1398, height: 492, dpr: 1.5 });
report.landscape = { mode: mobile.mode(), canvas: mobile.canvas() };

// Explicit desktop restores the original collapse controls and edge scrolling.
mobile.apply("desktop");
assert.equal(mobile.mode().active, false);
assert.equal(htmlRoot.classList.contains("desktop-mode"), true);
assert.equal(leftPanel.getAttribute("aria-hidden"), null);
assert.equal(leftPanel.inert, false);
assert.equal(element("edgeScrollToggle").disabled, false);
collapseLeft.onclick({ preventDefault() {} });
assert.equal(leftPanel.classList.contains("collapsed"), true);
assert.equal(htmlRoot.style.getPropertyValue("--left"), "32px");
collapseLeft.onclick({ preventDefault() {} });
assert.equal(leftPanel.classList.contains("collapsed"), false);

// Auto mode can still choose desktop on a non-touch, desktop-sized viewport.
coarsePointer = false;
windowObject.innerWidth = 1280;
windowObject.innerHeight = 800;
mobile.apply("auto");
assert.equal(mobile.mode().active, false);
mobile.apply("mobile");
assert.equal(mobile.mode().active, true);
report.desktop = {
  explicit: "desktop collapse retained",
  automaticLargeViewport: "desktop",
  explicitTouchOverride: "mobile",
};

// Static contract checks cover the CSS-only safe-area and landscape behavior.
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src/styles/07-mobile.css"), "utf8");
assert.match(html, /viewport-fit=cover/);
assert.equal(
  (html.match(/id="dock(?:Tools|ZoomOut|Pause|ZoomIn|Speed|Inspect)Btn"/g) || []).length,
  6,
);
assert.match(css, /safe-area-inset-(?:top|right|bottom|left)/);
assert.match(css, /100dvh/);
assert.match(css, /touch-action:\s*none/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /orientation:\s*landscape/);
report.static = {
  viewportFit: true,
  safeAreas: true,
  dynamicViewport: true,
  touchTargets: true,
  landscapeSheet: true,
};

console.log(JSON.stringify({ ok: true, report }, null, 2));
