// ═══════════════════════════════════════════════════════════════════════════
// 3. UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
const $ = (s) => document.querySelector(s),
  $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp = (a, b, t) => a + (b - a) * t;
const u16 = (v) => clamp(Math.round(v), 0, 65535),
  i16 = (v) => clamp(Math.round(v), -32768, 32767);
const idx = (x, y) => y * W.width + x,
  xy = (i) => [i % W.width, (i / W.width) | 0],
  inside = (x, y) => W && x >= 0 && y >= 0 && x < W.width && y < W.height;
const pct = (v) => `${clamp(Math.round(v), 0, 100)}%`,
  fmt = (n) =>
    n >= 1000000
      ? (n / 1000000).toFixed(1) + "m"
      : n >= 1000
        ? (n / 1000).toFixed(1) + "k"
        : String(Math.round(n));
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const titleCase = (s) =>
  String(s)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const sum = (a) => a.reduce((n, v) => n + v, 0),
  mean = (a) => (a.length ? sum(a) / a.length : 0);
function hsl(h, s, l, a = 1) {
  return `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
}
function darken(hex, amt) {
  const n = parseInt(hex.slice(1), 16),
    r = clamp((n >> 16) - amt, 0, 255),
    g = clamp(((n >> 8) & 255) - amt, 0, 255),
    b = clamp((n & 255) - amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
function dist2(ax, ay, bx, by) {
  const x = ax - bx,
    y = ay - by;
  return x * x + y * y;
}
function neighbors4(i) {
  const x = i % W.width,
    y = (i / W.width) | 0,
    r = [];
  if (x) r.push(i - 1);
  if (x < W.width - 1) r.push(i + 1);
  if (y) r.push(i - W.width);
  if (y < W.height - 1) r.push(i + W.width);
  return r;
}
function formatYear(t = W?.tick || 0) {
  return Math.floor(t / TICKS_PER_YEAR);
}
function epochName() {
  if (!W) return "Genesis";
  const y = formatYear();
  return EPOCHS[Math.min(EPOCHS.length - 1, Math.floor(Math.log2(y / 4 + 1)))];
}
function toast(message, type = "") {
  const d = document.createElement("div");
  d.className = `toast ${type}`;
  d.textContent = message;
  DOM.toastStack.appendChild(d);
  setTimeout(() => d.remove(), 3400);
}
function setLoading(progress, title, detail) {
  DOM.loadingScreen.classList.add("open");
  DOM.loadProgress.style.width = `${progress}%`;
  if (title) DOM.loadingTitle.textContent = title;
  if (detail) DOM.loadingDetail.textContent = detail;
}
function hideLoading() {
  DOM.loadingScreen.classList.remove("open");
}
function downloadText(name, text) {
  const b = new Blob([text], { type: "application/json" }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
