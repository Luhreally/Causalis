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
    this.rectLeft = 0;
    this.rectTop = 0;
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
    return {
      left: this.rectLeft,
      top: this.rectTop,
      width: this.clientWidth,
      height: this.clientHeight,
    };
  }
  setRect(width, height) {
    this.clientWidth = width;
    this.clientHeight = height;
  }
  place(left, top, width, height) {
    this.rectLeft = left;
    this.rectTop = top;
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
let mobileScript = composeRuntime({ format: "script" });
const bridgeMarker = "\nreturn {boot};";
assert.ok(mobileScript.includes(bridgeMarker), "closure bridge marker missing");
mobileScript = mobileScript.replace(
  bridgeMarker,
  "\nglobalThis.__PROBE__={get:(n)=>eval(n)};" + bridgeMarker,
);
vm.runInContext(mobileScript, sandbox, { filename: "causalis.mobile.js" });

const game = windowObject.ALIFE_DEBUG;
const mobile = windowObject.ALIFE_MOBILE_DEBUG;
assert.ok(game && mobile, "mobile and game debug surfaces initialize");
const snapshot = (value) => JSON.parse(JSON.stringify(value));

const report = { portrait: {}, gestures: {}, landscape: {}, desktop: {}, follow: {}, lenses: {}, static: {} };
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

// Following a life holds it in the middle of what the player can see, at any
// screen size (139). The ground under a figure lifts it up the screen and the
// middle of the canvas is that ground at sea level, so the oblique lens used
// to draw a followed life tens of pixels above the middle; a cover over the
// stage moved the middle again, and neither is a constant across devices.
const run = (source) => sandbox.__PROBE__.get(`(${source})`);
const follow = windowObject.ALIFE_FOLLOW_DEBUG;
assert.ok(follow, "the follow surface initializes");
const peopleBar = element("peopleBar");
const followReport = {};

const framesFollowing = (id, frames = 40) =>
  run(`() => {
    UI.followId = ${id};
    let now = 5000;
    for (let f = 0; f < ${frames}; f++) { now += 16; renderWorld(now); }
    const t = VISUAL_MOTION.get(${id});
    return t && t.s ? { x: t.s.x, y: t.s.y } : null;
  }`)();

const walker = run(`() => {
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  if (!people.length) return 0;
  // A person on high ground, where the lens lifts the figure furthest.
  let pick = people[0], best = -1;
  for (const id of people) {
    const p = W.components.position[id], e = W.tiles.elevation[idx(p.x, p.y)];
    if (e > best) { best = e; pick = id; }
  }
  UI.view = "oblique";
  UI.camera.zoom = 2.6;
  return pick;
}`)();
assert.ok(walker, "the probe world holds a person to follow");

// A phone canvas with nothing over it: the figure lands on the middle.
canvas.place(0, 116, 430, 816);
peopleBar.place(0, 0, 0, 0);
leftPanel.place(0, 0, 0, 0);
rightPanel.place(0, 0, 0, 0);
let centre = follow.centre();
let drawn = framesFollowing(walker);
assert.ok(drawn, "the followed life was drawn");
assert.ok(
  Math.hypot(drawn.x - centre.x, drawn.y - centre.y) < 2,
  `a followed life is not centred on a phone: ${JSON.stringify([drawn, centre])}`,
);
followReport.phone = {
  canvas: [430, 816],
  offset: [+(drawn.x - centre.x).toFixed(2), +(drawn.y - centre.y).toFixed(2)],
};

// The people bar covers the foot of the stage, so the middle moves up by half
// of it and the life is still whole above the bar.
peopleBar.place(6, 116 + 816 - 102, 418, 96);
const barCentre = follow.centre();
assert.ok(
  barCentre.y < 816 / 2 - 40,
  `the people bar did not move the middle up: ${JSON.stringify(barCentre)}`,
);
drawn = framesFollowing(walker);
assert.ok(
  Math.hypot(drawn.x - barCentre.x, drawn.y - barCentre.y) < 2,
  `a followed life is not centred above the people bar: ${JSON.stringify([drawn, barCentre])}`,
);
followReport.peopleBar = {
  inset: follow.counts().inset.bottom,
  centre: +barCentre.y.toFixed(1),
  offset: [+(drawn.x - barCentre.x).toFixed(2), +(drawn.y - barCentre.y).toFixed(2)],
};

// A drawer over nearly the whole stage is no aim at all, so it is ignored and
// the press that opened it closes it instead.
rightPanel.place(430 - 396, 116, 396, 816);
const drawerCentre = follow.centre();
assert.ok(
  Math.abs(drawerCentre.x - 430 / 2) < 1,
  `a drawer over the stage was aimed around: ${JSON.stringify(drawerCentre)}`,
);
rightPanel.classList.add("open");
mobile.apply("mobile");
run(`() => focusLife(${walker}, { toggle: false })`)();
assert.equal(
  rightPanel.classList.contains("open"),
  false,
  "following a life left the drawer over it",
);
rightPanel.place(0, 0, 0, 0);
followReport.drawer = { ignoredWhenWide: true, closedOnFocus: true };

// The same life on a desktop canvas: centred there too, and the span of ground
// the press opens is the same on both, which the zoom is not.
const phoneZoom = run(`() => { UI.camera.zoom = 1; return followSpanZoom(); }`)();
canvas.place(320, 64, 1180, 820);
peopleBar.place(332, 64 + 820 - 108, 700, 96);
const deskZoom = run(`() => { UI.camera.zoom = 1; return followSpanZoom(); }`)();
const deskCentre = follow.centre();
drawn = framesFollowing(walker);
assert.ok(
  Math.hypot(drawn.x - deskCentre.x, drawn.y - deskCentre.y) < 2,
  `a followed life is not centred on a desktop: ${JSON.stringify([drawn, deskCentre])}`,
);
assert.ok(
  deskZoom > phoneZoom * 1.2,
  `the follow zoom did not scale with the screen: ${JSON.stringify([phoneZoom, deskZoom])}`,
);
const span = (zoom) =>
  run(`() => { UI.camera.zoom = ${zoom}; const m = projectionMetrics(), r = focusViewportRect(m);
    return Math.min((r.right - r.left) / m.tw, (r.bottom - r.top) / m.th); }`)();
const deskSpan = span(deskZoom);
canvas.place(0, 116, 430, 816);
peopleBar.place(6, 116 + 816 - 102, 418, 96);
const phoneSpan = span(phoneZoom);
assert.ok(
  Math.abs(deskSpan - phoneSpan) < 2,
  `the span of ground differs by device: ${JSON.stringify([phoneSpan, deskSpan])}`,
);
followReport.span = {
  phone: { zoom: +phoneZoom.toFixed(2), tiles: +phoneSpan.toFixed(1) },
  desktop: { zoom: +deskZoom.toFixed(2), tiles: +deskSpan.toFixed(1) },
};

// Every map lens paints, in one palette, with its edges drawn (140).
const lens = windowObject.ALIFE_LENS_DEBUG;
assert.ok(lens, "the lens surface initializes");
const lensReport = {};
const colourShape = /^(transparent|hsla?\([^)]*\)|rgba?\([^)]*\))$/;
const alphaOf = (c) => {
  if (c === "transparent") return 0;
  const m = c.match(/\/\s*([0-9.]+)\s*\)$/) || c.match(/,\s*([0-9.]+)\s*\)$/);
  return m ? parseFloat(m[1]) : 1;
};
const lensIds = run("() => OVERLAY_DEFS.map((d) => d[0])")();
const tileCount = run("() => W.tileCount")();
const sample = [];
for (let i = 0; i < tileCount; i += Math.max(1, Math.floor(tileCount / 240))) sample.push(i);
for (const id of lensIds) {
  let visible = 0;
  for (const i of sample) {
    const c = lens.style(id, i);
    assert.ok(typeof c === "string" && colourShape.test(c), `lens ${id} painted no colour at tile ${i}: ${c}`);
    const a = alphaOf(c);
    assert.ok(a >= 0 && a <= 1, `lens ${id} alpha out of range at tile ${i}: ${c}`);
    if (a > 0.1) visible++;
  }
  lensReport[id] = +((100 * visible) / sample.length).toFixed(0);
}
assert.ok(lensReport.elevation >= 95, "the elevation lens does not paint the whole map: " + lensReport.elevation);
assert.ok(lensReport.temperature >= 95, "the temperature lens does not paint the whole map: " + lensReport.temperature);
assert.ok(lensReport.moisture >= 95, "the moisture lens does not paint the whole map: " + lensReport.moisture);
const bands = new Set(sample.map((i) => lens.band(i)));
assert.ok(bands.size >= 3, "the elevation lens found fewer than three bands: " + [...bands].join(","));
const contours = {};
for (const view of ["top", "iso", "oblique"]) {
  run(`() => { UI.view = "${view}"; UI.camera.zoom = 1.4; UI.camera.x = W.width / 2; UI.camera.y = W.height / 2; }`)();
  contours[view] = lens.edges("elevation");
  assert.ok(contours[view] > 0, `no contour was drawn in the ${view} lens`);
}
const factions = run("() => W.factions.length")();
if (factions) {
  const owned = sample.filter((i) => lens.category("territory", i));
  if (owned.length) {
    assert.ok(alphaOf(lens.style("territory", owned[0])) >= 0.25, "a polity's ground is too faint to see");
    assert.ok(lens.edges("territory") > 0, "a polity has ground and no border");
    assert.ok(lens.legend("territory").length >= 1, "the polity legend is empty");
  }
}
const grid = element("overlayGrid");
assert.ok((grid.innerHTML.match(/overlay-group/g) || []).length >= 5, "the lenses are not grouped");
assert.equal((grid.innerHTML.match(/overlay-btn/g) || []).length, lensIds.length, "not every lens has a button");
lensReport.contours = contours;
report.lenses = lensReport;

// Reading where to aim, or through a lens, never touches the world.
run('() => { UI.overlay = "territory"; }')();
const lensIsolation = windowObject.ALIFE_VISUAL_DEBUG.renderIsolation(9500);
assert.equal(lensIsolation.ok, true, `a lens changed the world: ${JSON.stringify(lensIsolation)}`);
run("() => { UI.overlay = null; }")();
const isolation = windowObject.ALIFE_VISUAL_DEBUG.renderIsolation(9000);
assert.equal(isolation.ok, true, `following changed the world: ${JSON.stringify(isolation)}`);
run("() => { UI.followId = 0; }")();
report.follow = followReport;

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
// The simple controls no longer hide the map lenses (140).
const experienceCss = fs.readFileSync(path.join(root, "src/styles/08-player-experience.css"), "utf8");
assert.ok(!/compact-controls\s+#overlayGrid/.test(experienceCss), "the simple controls still hide map lenses");
report.static = {
  viewportFit: true,
  safeAreas: true,
  dynamicViewport: true,
  touchTargets: true,
  landscapeSheet: true,
};

console.log(JSON.stringify({ ok: true, report }, null, 2));
