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

// An ordinary global object, as in a browser (see smoke-test.cjs).
const context =
  process.env.CAUSALIS_VM_CONTEXTIFY === "1"
    ? vm.createContext(sandbox)
    : Object.assign(vm.createContext(vm.constants.DONT_CONTEXTIFY), sandbox);
let mobileScript = composeRuntime({ format: "script" });
const bridgeMarker = "\nreturn {boot};";
assert.ok(mobileScript.includes(bridgeMarker), "closure bridge marker missing");
mobileScript = mobileScript.replace(
  bridgeMarker,
  "\nglobalThis.__PROBE__={get:(n)=>eval(n)};" + bridgeMarker,
);
vm.runInContext(mobileScript, context, { filename: "causalis.mobile.js" });

const game = windowObject.ALIFE_DEBUG;
const mobile = windowObject.ALIFE_MOBILE_DEBUG;
assert.ok(game && mobile, "mobile and game debug surfaces initialize");
const snapshot = (value) => JSON.parse(JSON.stringify(value));

const report = { portrait: {}, gestures: {}, landscape: {}, desktop: {}, follow: {}, lenses: {}, motion: {}, static: {} };
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
const run = (source) => context.__PROBE__.get(`(${source})`);
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
// The political lenses are a map mode (140): the land no one holds is veiled, a holding is painted
// firmly, the edge pass keeps its segments for the motion pass, and the motion pass runs every frame.
run('() => { UI.view = "top"; UI.overlay = "territory"; UI.camera.zoom = 1.4; UI.camera.x = W.width / 2; UI.camera.y = W.height / 2; }')();
const unheld = sample.find((i) => !lens.category("territory", i));
if (unheld !== undefined) {
  const veil = lens.style("territory", unheld);
  assert.ok(alphaOf(veil) >= 0.1, "the land no one holds is not veiled under the polity lens: " + veil);
}
if (factions) {
  const owned = sample.filter((i) => lens.category("territory", i));
  if (owned.length) {
    assert.ok(alphaOf(lens.style("territory", owned[0])) >= 0.45, "a holding is not painted firmly: " + lens.style("territory", owned[0]));
    lens.edges("territory");
    const list = lens.edgeList();
    assert.ok(list.segments > 0, "the edge pass kept no segments for the motion pass");
    assert.ok(lens.motion(1234) > 0, "the motion pass drew nothing over a polity's borders");
    lensReport.mapMode = { segments: list.segments, fronts: list.fronts, labels: list.labels };
  }
}
// The signal lenses read faint things (140): a whisper shows, a shout is a shout, and calm is a veil.
const sig = lens.signalStyle("fear", 2), loud = lens.signalStyle("fear", 60), calm = lens.style("fear", 0);
assert.ok(sig && sig.alpha >= 0.28, "a whisper of fear does not show: " + JSON.stringify(sig));
assert.ok(loud && loud.alpha > sig.alpha + 0.2, "a shout of fear is not louder than a whisper: " + JSON.stringify([sig, loud]));
assert.ok(typeof calm === "string" && alphaOf(calm) >= 0.1, "the fear lens is not visibly on when calm: " + calm);
for (const id of ["blood", "unrest", "danger", "disease"]) assert.ok(lens.signalStyle(id, 5).alpha >= 0.3, `the ${id} lens is not sensitive`);
lensReport.signals = { whisper: sig.alpha, shout: loud.alpha };
// The war seen (142): a warfare lens in the panel that veils and tints, the tab that reads the war, and
// the marks a column carries.
const warview = windowObject.ALIFE_WARVIEW_DEBUG;
assert.ok(warview, "the war view initializes");
run("() => { UI.overlay = null; }")();
const grid = element("overlayGrid");
assert.ok((grid.innerHTML.match(/overlay-group/g) || []).length >= 6, "the lenses are not grouped");
assert.equal((grid.innerHTML.match(/overlay-btn/g) || []).length, lensIds.length + 2, "not every lens has a button");
assert.ok(grid.innerHTML.includes('data-overlay="warfare"'), "the warfare lens has no button");
for (const i of sample) assert.ok(colourShape.test(lens.style("warfare", i)), "the warfare lens painted no colour at " + i);
const warHtml = warview.html();
assert.ok(/war(s)? · \d+ column/.test(warHtml), "the warfare tab does not read the war: " + warHtml.slice(0, 120));
const marks = run(`() => {
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.position[id]);
  if (people.length < 5) return { skipped: "too few people" };
  const town = W.settlements.find((s) => !s.ruined) || null,
    column = (id, memberIds) => ({ id, factionId: town?.factionId || 1, homeSettlementId: town?.id || 0, memberIds, training: 0, supply: 0.8, morale: 0.6, objectiveSettlementId: 0, formedTick: W.tick, lastBattleTick: -1, phase: "marching", phaseDetail: "", phaseTick: W.tick, lastProgressTick: W.tick, stalledTicks: 0, active: true }),
    // Two columns: one of three with a straggler eighteen tiles off, one of two at the same spot.
    units = [column(910777, people.slice(0, 3)), column(910778, people.slice(3, 5))],
    saved = people.slice(0, 5).map((id) => ({ id, x: W.components.position[id].x, y: W.components.position[id].y })),
    p = W.components.position[people[0]],
    ox = clamp(Math.round(p.x), 20, W.width - 2), oy = clamp(Math.round(p.y), 1, W.height - 2),
    put = (id, x, y) => { W.components.position[id].x = x; W.components.position[id].y = y; };
  put(people[0], ox, oy); put(people[1], ox + 1, oy); put(people[2], ox - 18, oy); put(people[3], ox, oy + 1); put(people[4], ox + 1, oy + 1);
  W.militaryUnits = W.militaryUnits || [];
  W.militaryUnits.push(...units);
  const geometry = window.ALIFE_WARVIEW_DEBUG.geometry(910777);
  UI.view = "top"; UI.overlay = "warfare"; UI.camera.zoom = 2; UI.camera.x = ox + 0.5; UI.camera.y = oy + 0.5;
  const before = window.ALIFE_WARVIEW_DEBUG.counts();
  renderWorld(31000);
  const after = window.ALIFE_WARVIEW_DEBUG.counts();
  W.militaryUnits = W.militaryUnits.filter((u) => !units.includes(u));
  for (const s of saved) put(s.id, s.x, s.y);
  UI.overlay = null;
  return { geometry, outlines: after.outlines - before.outlines, banners: after.banners - before.banners, labels: after.labels - before.labels };
}`)();
if (!marks.skipped) {
  assert.ok(marks.outlines >= 2 && marks.banners >= 2, "a column carries no formation mark under the war lens: " + JSON.stringify(marks));
  const g = marks.geometry;
  assert.ok(g && g.n === 3 && g.coreN === 2 && g.stragglers === 1 && g.spread <= 1, "the formation is not the knot of fighters who stand together: " + JSON.stringify(g));
  assert.strictEqual(marks.labels, 1, "two columns marching at one place print two words, not one with a count: " + JSON.stringify(marks));
}
lensReport.war = marks;
// Homes seen (144): the housing lens in the Peoples group, a ring of tenure on every home, a ring
// round each person with no bed, the count in the legend and at the head of the people bar.
const homes = windowObject.ALIFE_HOMES_DEBUG;
assert.ok(homes, "the homes view initializes");
assert.ok(grid.innerHTML.includes('data-overlay="housing"'), "the housing lens has no button");
assert.ok(grid.innerHTML.indexOf('data-overlay="housing"') > grid.innerHTML.indexOf('data-overlay="unrest"'), "the housing lens is not in the Peoples group after unrest");
for (const i of sample) assert.ok(colourShape.test(lens.style("housing", i)), "the housing lens painted no colour at " + i);
lensReport.contours = contours;
report.lenses = lensReport;

// A step is a walk over the time the walker waited for it (32d), and the slow
// speeds are on the phone's dock (44).
const motionReport = {};
assert.deepEqual(snapshot(run("() => MOBILE_SPEEDS")()), [0.125, 0.25, 0.5, 1, 4, 16, 64]);
assert.equal(run("() => formatSpeed(0.125)")(), "⅛×");
run("() => setSpeed(0.125)")();
assert.equal(run("() => UI.speed")(), 0.125, "the speed does not go to an eighth");
run("() => setSpeed(1)")();
const stepper = run(`() => {
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.position[id].x < W.width - 3);
  return people.length ? people[0] : 0;
}`)();
if (stepper) {
  // A priming step sets the walker's cadence; the measured step then takes as long as the wait before it.
  const walk = run(`() => {
    const id = ${stepper}, p = W.components.position[id], wasX = p.x;
    UI.followId = 0; UI.view = "top"; UI.camera.zoom = 2; UI.camera.x = p.x + 0.5; UI.camera.y = p.y + 0.5;
    let now = 20000;
    for (let f = 0; f < 30; f++) { now += 16; renderWorld(now); }
    p.x = wasX + 1;
    for (let f = 0; f < 60; f++) { now += 16; renderWorld(now); }
    const e = VISUAL_MOTION.get(id), x0 = e.x;
    p.x = wasX + 2;
    const at = [];
    for (let f = 1; f <= 90; f++) { now += 16; renderWorld(now); if (f === 18 || f === 36 || f === 60 || f === 90) at.push(+(((e.x - x0) / ((e.legTx - x0) || 1))).toFixed(3)); }
    const glide = e.glide;
    p.x = wasX;
    for (let f = 0; f < 400; f++) { now += 16; renderWorld(now); }
    const home = VISUAL_MOTION.get(id);
    return { glide, progress: at, settled: +Math.abs(home.x - (wasX + 0.5)).toFixed(3) };
  }`)();
  motionReport.walk = walk;
  assert.ok(walk.glide >= 900 && walk.glide <= 1100, "the walk does not take the time the walker waited: " + walk.glide);
  assert.ok(walk.progress[0] < 0.45, "the figure darted instead of walking: " + JSON.stringify(walk.progress));
  assert.ok(walk.progress[3] > 0.97, "the figure never arrived: " + JSON.stringify(walk.progress));
  assert.ok(walk.progress[0] <= walk.progress[1] && walk.progress[1] <= walk.progress[2], "the walk went backwards: " + JSON.stringify(walk.progress));
  // Home is the tile, give or take the crowd's shuffle on it (32d, 111).
  assert.ok(walk.settled < 0.45, "the figure did not walk home after the tile was restored: " + walk.settled);
}
// The inspector reads what a life is doing, not the tick (141): the word that held most of the recent
// readings, with the tick's own word beside it when it differs.
const intent = windowObject.ALIFE_INTENT_DEBUG;
assert.ok(intent, "the intent surface initializes");
if (stepper) {
  const settled = run(`() => {
    const id = ${stepper}, l = W.components.life[id], was = { behavior: l.behavior, reason: l.behaviorReason };
    const D = window.ALIFE_INTENT_DEBUG;
    let now = 40000;
    for (let k = 0; k < 8; k++) { l.behavior = "food"; l.behaviorReason = "hunger at 60"; D.note(id, (now += 100)); }
    for (let k = 0; k < 3; k++) { l.behavior = "return"; l.behaviorReason = "the hearth calls"; D.note(id, (now += 100)); }
    const s = D.settled(id);
    UI.selectedEntity = id;
    const card = organismInspector(id), summary = selectionSummaryMarkup();
    l.behavior = was.behavior; l.behaviorReason = was.reason;
    UI.selectedEntity = 0;
    return { word: s.word, current: s.current, reason: s.reason, held: +s.held.toFixed(2), cardSettled: card.includes('<b>food <span class="muted">(now return)</span></b>'), cardReason: card.includes('<b>hunger at 60</b>'), summarySettled: summary.includes('food <span class="muted">(now return)</span>') };
  }`)();
  motionReport.intent = settled;
  assert.equal(settled.word, "food", "the settled intent is not the word that held: " + JSON.stringify(settled));
  assert.equal(settled.current, "return");
  assert.ok(settled.cardSettled && settled.cardReason && settled.summarySettled, "the inspector does not show the settled intent: " + JSON.stringify(settled));
}
report.motion = motionReport;

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
// The homes of a town seen (144), on the civic scenario's town: this is the last world the test
// builds, since the scenario raises a town the blocks above were not written against.
windowObject.ALIFE_CONTROL_DEBUG.createCivicTestScenario();
const tenure = run(`() => {
  let town = W.settlements.find((s) => !s.ruined && s.knownProcesses);
  if (!town) {
    // A camp becomes a town once its shelter, store and hearth stand (30a); they are finished here.
    const camp = W.camps.find((c) => c.active);
    if (camp) {
      for (const type of ["shelter", "stockpile", "hearth"])
        if (!W.buildings.some((b) => b.placeKind === "camp" && b.placeId === camp.id && b.type === type)) planBuilding(camp, type, 9);
      for (const b of W.buildings)
        if (b.placeKind === "camp" && b.placeId === camp.id && !b.complete) {
          b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick;
          for (const [sp, n] of b.requirements || []) b.composition[sp] = n;
        }
      createSettlement(camp.id);
    }
    town = W.settlements.find((s) => !s.ruined && s.knownProcesses);
  }
  // The one without a bed must have no parent under a roof, or it is sheltered as their child; the
  // world's founders have no parents at all.
  const alive = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.position[id]),
    orphan = alive.find((id) => !(W.components.identity[id]?.parents || []).some((p) => classifyAlive(p))),
    rest = alive.filter((id) => id !== orphan),
    people = orphan ? [rest[0], rest[1], orphan, rest[2]].filter(Boolean) : [];
  if (!town || people.length < 4) return { skipped: "no town or too few people: " + (town ? alive.length + " alive" : "no town") };
  // Synthetic homes, dropped again at the end: one owned, one behind on the rent, one empty.
  const home = (id, dx, residents, ownerId, arrears) => ({ id, placeKind: "settlement", placeId: town.id, type: "shelter", name: "Shelter", x: town.x + dx, y: town.y, complete: true, ruined: false, housing: 6,
      tenancy: { ownerId, residents, arrears, decor: [], rent: 2 } }),
    [a, b, c, d] = people,
    kept = [a, b, c, d].map((id) => ({ id, social: { ...W.components.social[id] } })),
    set = (id, buildingId) => Object.assign(W.components.social[id], { homePlaceKind: "settlement", homePlaceId: town.id, homeBuildingId: buildingId, householdId: id }),
    fake = [home(990101, 1, [a], a, {}), home(990102, -1, [b], 0, { [b]: 5 }), home(990103, 2, [], 0, {})],
    keptHab = town.habitation;
  set(a, 990101); set(b, 990102); set(c, 0);
  W.buildings.push(...fake);
  town.habitation = town.habitation || { residents: 0, beds: 0, housed: 0, households: 0 };
  const owned = window.ALIFE_HOMES_DEBUG.tenure(990101), behind = window.ALIFE_HOMES_DEBUG.tenure(990102), empty = window.ALIFE_HOMES_DEBUG.tenure(990103);
  W.tick++;
  const census = window.ALIFE_HOMES_DEBUG.census(), legend = window.ALIFE_HOMES_DEBUG.legend(), chip = window.ALIFE_HOMES_DEBUG.chip();
  UI.view = "top"; UI.overlay = "housing"; UI.camera.zoom = 3; UI.camera.x = town.x + 0.5; UI.camera.y = town.y + 0.5;
  const before = window.ALIFE_HOMES_DEBUG.counts();
  window.ALIFE_HOMES_DEBUG.marks(1000);
  const after = window.ALIFE_HOMES_DEBUG.counts(), page = renderPlacePage(town.id);
  // Where each lives, in the inspector and the selection summary (148).
  const A = window.ALIFE_ADDRESS_DEBUG, keptSelection = UI.selectedEntity;
  UI.selectedEntity = a;
  const address = { a: A.of(a), b: A.of(b), c: A.of(c), inspA: organismInspector(a), inspC: organismInspector(c), summary: selectionSummaryMarkup() };
  UI.selectedEntity = keptSelection;
  W.tick--;
  W.buildings = W.buildings.filter((x) => !fake.includes(x));
  for (const k of kept) Object.assign(W.components.social[k.id], k.social);
  town.habitation = keptHab;
  UI.overlay = null;
  return { owned: owned.kind, behind: [behind.kind, behind.owed], empty: empty.kind, census, legend, chip, rings: after.rings - before.rings, rough: after.rough - before.rough, page: /Tenure/.test(page) && /behind on the rent/.test(page),
    address: { a: [address.a?.state, address.a?.tenure, address.a?.number, address.a?.name], b: [address.b?.state, address.b?.tenure], c: address.c?.state,
      inspA: /data-address="home"/.test(address.inspA) && /Cottage 990101/.test(address.inspA) && /owned by the household/.test(address.inspA),
      inspC: /data-address="rough"/.test(address.inspC) && /Sleeping rough in/.test(address.inspC), summary: /data-address-line="home"/.test(address.summary) } };
}`)();
if (!tenure.skipped) {
  assert.equal(tenure.owned, "owned", "a home its household owns does not read owned");
  assert.ok(tenure.behind[0] === "arrears" && tenure.behind[1] === 2, "five coin owed on a rent of two is not two years behind: " + JSON.stringify(tenure.behind));
  assert.equal(tenure.empty, "empty", "a home with nobody in it does not read empty");
  assert.ok(tenure.census.rough >= 1 && tenure.census.tenure.arrears >= 1, "the census missed the person without a bed or the debt: " + JSON.stringify(tenure.census));
  assert.ok(/behind on rent/.test(tenure.legend) && /without a bed/.test(tenure.legend), "the legend does not count the debt and the people without a bed: " + tenure.legend);
  assert.ok(/data-homes-chip/.test(tenure.chip) && /no bed/.test(tenure.chip) && /⚠/.test(tenure.chip), "the people bar count is missing: " + tenure.chip);
  assert.ok(tenure.rings >= 3 && tenure.rough >= 1, "the lens drew no ring on a home or round the person without a bed: " + JSON.stringify(tenure));
  assert.ok(tenure.page, "the place page does not give the tenure of its homes");
  assert.deepEqual([...tenure.address.a], ["home", "owned", 990101, "Cottage"], "the inspector's address of an owner is wrong: " + JSON.stringify(tenure.address));
  assert.deepEqual([...tenure.address.b], ["home", "municipal"], "a home with no owner is not let by the town: " + JSON.stringify(tenure.address));
  assert.equal(tenure.address.c, "rough", "a townsperson with no bed does not read sleeping rough");
  assert.ok(tenure.address.inspA && tenure.address.inspC && tenure.address.summary, "the inspector or the summary does not say where a person lives: " + JSON.stringify(tenure.address));
}
assert.ok(!tenure.skipped, "the homes fixture found no town: " + tenure.skipped);
report.homes = { owned: tenure.owned, behind: tenure.behind, rings: tenure.rings, rough: tenure.rough };
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
