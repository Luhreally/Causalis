// What the HUD holds on the screen now, read in the page (the phone audit's and the overlap gate's
// one reading): its windows, what lies over what, and what a finger meets.
//   covered: every control to be seen whose middle a finger would not reach (what lies over it);
//   overlaps: the windows of the HUD that lie over one another, and the controls that do;
//   off: controls partly off the screen (gone: wholly off it);
//   small: controls smaller than a fingertip (44 by 44 px);
//   chrome: how much of the screen the chrome covers.

/** Two windows allowed to lie over one another, by design: the first's selector, the second's ("*" for
 * anything), and why. A window matches a selector when it, or what holds it, does. */
export type Exemption = { readonly a: string; readonly b: string; readonly why: string };

export type HudRead = {
  controls: number;
  labels: number;
  covered: string[];
  overlaps: string[];
  off: string[];
  gone: string[];
  small: string[];
  chrome: number;
  bar: number;
  boxes: string[];
};

/** The reading, as code for the page; `exempt` the pairs let be, `tol` the overlap (px) let pass. */
export const hudRead = (exempt: readonly Exemption[] = [], tol = 4): string => `(() => {
  const EXEMPT = ${JSON.stringify(exempt)}, TOL = ${tol};
  const W = innerWidth, H = innerHeight;
  const hud = document.getElementById("hud");
  const shown = (e) => {
    for (let p = e; p && p.nodeType === 1; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === "none" || s.visibility === "hidden" || s.visibility === "collapse" || Number(s.opacity) < 0.05) return false;
    }
    return true;
  };
  // (As much of a thing as the boxes it scrolls in let be seen; what stands fixed to the screen
  // is clipped by none of those that hold it.)
  const clip = (e) => {
    const r = e.getBoundingClientRect();
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    let fixed = getComputedStyle(e).position === "fixed";
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (fixed && s.transform === "none" && s.filter === "none" && s.contain === "none") continue;
      if (s.position === "fixed") fixed = true;
      const ox = s.overflowX !== "visible", oy = s.overflowY !== "visible";
      if (!ox && !oy) continue;
      const q = p.getBoundingClientRect();
      if (ox) { x0 = Math.max(x0, q.left); x1 = Math.min(x1, q.right); }
      if (oy) { y0 = Math.max(y0, q.top); y1 = Math.min(y1, q.bottom); }
    }
    return { r, x0, y0, x1, y1 };
  };
  const words = (e) => ((e.getAttribute && (e.getAttribute("aria-label") || e.getAttribute("title"))) || e.innerText || e.value || "").trim().replace(/\\s+/g, " ").slice(0, 30);
  const name = (e) => {
    if (!e || e.nodeType !== 1) return "nothing";
    const c = typeof e.className === "string" ? e.className.trim().split(/\\s+/).filter(Boolean).slice(0, 3).join(".") : "";
    const w = words(e);
    return e.tagName.toLowerCase() + (c ? "." + c : "") + (w ? " “" + w + "”" : "");
  };
  /** The window of the HUD a thing is part of (a child of #hud, or one of a panel's own windows). */
  const own = (e) => {
    for (let p = e; p; p = p.parentElement) {
      if (!p.parentElement) return null;
      if (p.parentElement === hud && !(p.classList.contains("panel"))) return p;
      if (p.parentElement.parentElement === hud && p.parentElement.classList.contains("panel")) return p;
      if (p.parentElement === document.body || p.parentElement.id === "app") return p;
    }
    return null;
  };
  const matches = (e, sel) => sel === "*" || !!(e.closest && e.closest(sel));
  const exempt = (a, b) => EXEMPT.find((x) => (matches(a, x.a) && matches(b, x.b)) || (matches(b, x.a) && matches(a, x.b)));
  // (The scene's own words over it: names on the map, labels, what people say, tooltips; and the fade between scales.)
  const LAYERS = /(^|\\s)(labels|label|bubbles|bubble|mapnames|hovertips|hovertip|swap)(\\s|$)/;
  const layer = (e) => { for (let p = e; p && p !== hud; p = p.parentElement) if (typeof p.className === "string" && LAYERS.test(p.className)) return true; return false; };
  const controls = [...document.querySelectorAll("button, a, [role=button], input:not([type=hidden]), select, summary, textarea")];
  const covered = [], off = [], small = [], gone = [], seenControls = [];
  let count = 0, labelsCount = 0;
  for (const e of controls) {
    if (!shown(e)) continue;
    const c = clip(e);
    if (c.r.width < 1 || c.r.height < 1) continue;
    if (c.x1 - c.x0 < 1 || c.y1 - c.y0 < 1) continue;
    if (layer(e)) { labelsCount++; continue; }
    count++;
    if (c.x1 <= 0 || c.x0 >= W || c.y1 <= 0 || c.y0 >= H) { gone.push(name(e)); continue; }
    if (c.x0 < -1 || c.x1 > W + 1 || c.y0 < -1 || c.y1 > H + 1)
      off.push(name(e) + " at " + [c.x0, c.y0, c.x1, c.y1].map(Math.round).join(","));
    let x = (Math.max(c.x0, 0) + Math.min(c.x1, W)) / 2, y = (Math.max(c.y0, 0) + Math.min(c.y1, H)) / 2;
    // (A link that wraps over two lines is touched on its first: its box's middle may be another's.)
    const lines = e.getClientRects();
    // (Its first line still to be seen, as much of it as its scroller lets be: a line scrolled under the window's foot is no target.)
    if (lines.length > 1) for (const f of lines) {
      const y0 = Math.max(f.top, c.y0, 0), y1 = Math.min(f.bottom, c.y1, H), x0 = Math.max(f.left, c.x0, 0), x1 = Math.min(f.right, c.x1, W);
      if (y1 - y0 < 1 || x1 - x0 < 1) continue;
      x = (x0 + x1) / 2; y = (y0 + y1) / 2;
      break;
    }
    const hit = document.elementFromPoint(x, y);
    const mine = hit && (hit === e || e.contains(hit) || (hit.contains(e) && hit !== hud && hit !== document.body && hit !== document.documentElement && hit.id !== "app"));
    if (!mine && !(hit && exempt(e, hit)))
      covered.push(name(e) + " at " + Math.round(x) + "," + Math.round(y) + " under " + (hit ? name(hit) + (own(hit) && own(hit) !== hit ? " in " + name(own(hit)).slice(0, 40) : "") : "nothing"));
    // (A link wrapped over lines is its lines, not the box round them.)
    const parts = lines.length > 1 ? [...lines] : [{ left: c.x0, top: c.y0, right: c.x1, bottom: c.y1 }];
    seenControls.push({ e, parts: parts.map((q) => ({ x0: Math.max(q.left, c.x0, 0), y0: Math.max(q.top, c.y0, 0), x1: Math.min(q.right, c.x1, W), y1: Math.min(q.bottom, c.y1, H) })) });
    if (c.r.width < 43.5 || c.r.height < 43.5) small.push(name(e) + " " + Math.round(c.r.width) + "x" + Math.round(c.r.height));
  }
  // The windows: each child of the HUD to be seen (a panel's own windows in its stead), and what
  // stands in the page beside the HUD (the title's window).
  const boxes = [];
  const add = (e) => {
    if (!shown(e) || layer(e) || e.tagName === "CANVAS") return;
    const s = getComputedStyle(e);
    // (Something that draws nothing of its own, holding others: a panel, a layer the size of the
    // screen, a row or column of buttons. Its children are the windows.)
    const bare = s.backgroundImage === "none" && /rgba\\(0, 0, 0, 0\\)|transparent/.test(s.backgroundColor) && s.borderTopWidth === "0px" && s.borderBottomWidth === "0px" && s.boxShadow === "none";
    const words = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (bare && !words) {
      for (const c of e.children) add(c);
      return;
    }
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    // (As much of it as its scrolling row or column lets be seen.)
    const c = clip(e);
    const x0 = Math.max(0, c.x0), y0 = Math.max(0, c.y0), x1 = Math.min(W, c.x1), y1 = Math.min(H, c.y1);
    if (x1 - x0 < 2 || y1 - y0 < 2) return;
    boxes.push({ e, x0, y0, x1, y1, n: name(e).slice(0, 60), pe: s.pointerEvents, free: s.position === "fixed" });
    // (What stands fixed to the screen from within a window — the map modes on a desk, a sheet a
    // window opens — is a window of its own, read as one.)
    for (const d of e.querySelectorAll("*")) {
      if (getComputedStyle(d).position !== "fixed") continue;
      let inner = false;
      for (let p = d.parentElement; p && p !== e; p = p.parentElement) if (getComputedStyle(p).position === "fixed") inner = true;
      if (!inner) add(d);
    }
  };
  if (hud) for (const c of hud.children) add(c);
  for (const c of document.body.children) if (c.id !== "app") add(c);
  const app = document.getElementById("app");
  if (app) for (const c of app.children) if (c !== hud) add(c);
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if ((a.e.contains(b.e) && !b.free) || (b.e.contains(a.e) && !a.free)) continue;
      const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (w > TOL && h > TOL && !exempt(a.e, b.e)) overlaps.push(a.n + " / " + b.n + " (" + Math.round(w) + "x" + Math.round(h) + ")");
    }
  // (Two controls over one another, in a window or across two: one would take the other's touches.)
  for (let i = 0; i < seenControls.length; i++)
    for (let j = i + 1; j < seenControls.length; j++) {
      const a = seenControls[i], b = seenControls[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      let w = 0, h = 0;
      for (const p of a.parts) for (const q of b.parts) {
        const pw = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0), ph = Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0);
        if (pw > TOL && ph > TOL && pw * ph > w * h) { w = pw; h = ph; }
      }
      if (w > TOL && h > TOL && !exempt(a.e, b.e)) overlaps.push("controls: " + name(a.e).slice(0, 60) + " / " + name(b.e).slice(0, 60) + " (" + Math.round(w) + "x" + Math.round(h) + ")");
    }
  // (The share of the screen under chrome, in cells of 2 px.)
  const G = 2, cols = Math.ceil(W / G), rows = Math.ceil(H / G), grid = new Uint8Array(cols * rows);
  for (const b of boxes)
    for (let y = Math.floor(b.y0 / G); y < Math.ceil(b.y1 / G); y++)
      for (let x = Math.floor(b.x0 / G); x < Math.ceil(b.x1 / G); x++) grid[y * cols + x] = 1;
  let under = 0;
  for (const v of grid) under += v;
  return {
    controls: count, labels: labelsCount, covered, overlaps, off, gone, small,
    chrome: under / grid.length,
    bar: (() => { const b = [...document.querySelectorAll(".panel > header.bar")].find((e) => e.offsetParent !== null); return b ? Math.round(b.getBoundingClientRect().bottom) : 0; })(),
    boxes: boxes.map((b) => b.n + " [" + [b.x0, b.y0, b.x1, b.y1].map(Math.round).join(",") + "]" + (b.pe === "none" ? " (lets touches through)" : "")),
  };
})()`;

/** The HUD as it stands, two levels deep (the corner's tools and the bar to their buttons). */
export const HUD_DUMP = `(() => {
  const out = [];
  const walk = (e, depth) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (s.display === "none") return;
    const c = typeof e.className === "string" ? e.className : "";
    out.push("  ".repeat(depth) + e.tagName.toLowerCase() + (c ? "." + c.trim().split(/\\s+/).join(".") : "") + (e.hidden ? " [hidden]" : "") + " " + [r.left, r.top, r.width, r.height].map(Math.round).join(",") + " pe:" + s.pointerEvents + " z:" + s.zIndex + " pos:" + s.position);
    const deep = !!e.closest("header.bar, .corner-tools, .people-bar");
    if (depth < (deep ? 5 : 2)) for (const k of e.children) walk(k, depth + 1);
  };
  const hud = document.getElementById("hud");
  if (hud) for (const c of hud.children) walk(c, 0);
  return out.join("\\n");
})()`;
