// ═══════════════════════════════════════════════════════════════════════════
// 4. DETERMINISTIC HASHING AND RANDOM STREAMS
// ═══════════════════════════════════════════════════════════════════════════
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(s).length; i++) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mix32(x) {
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d);
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
function hashParts(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    h ^= typeof p === "number" ? p >>> 0 : hashString(p);
    h = Math.imul(h, 16777619);
  }
  return mix32(h);
}
function counterRand(tag, tick = 0, id = 0, purpose = 0, attempt = 0) {
  return hashParts(W ? W.seedHash : 0, tag, tick, id, purpose, attempt) / 4294967296;
}
function makeRng(seed, tag) {
  let state = hashParts(seed, tag) || 0x9e3779b9;
  return {
    next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 4294967296;
    },
    int(n) {
      return Math.floor(this.next() * n);
    },
    range(a, b) {
      return a + (b - a) * this.next();
    },
    get state() {
      return state >>> 0;
    },
    set state(v) {
      state = v >>> 0;
    },
  };
}
function streamRand(name) {
  let x = W.streams[name] >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  W.streams[name] = x;
  return x / 4294967296;
}
function noise2(seed, x, y) {
  let xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi;
  const sm = (t) => t * t * (3 - 2 * t),
    v = (a, b) => hashParts(seed, a, b) / 4294967296;
  const a = v(xi, yi),
    b = v(xi + 1, yi),
    c = v(xi, yi + 1),
    d = v(xi + 1, yi + 1);
  return lerp(lerp(a, b, sm(xf)), lerp(c, d, sm(xf)), sm(yf));
}
function fbm(seed, x, y) {
  let v = 0,
    a = 0.55,
    f = 1,
    n = 0;
  for (let o = 0; o < 5; o++) {
    v += noise2(seed + o * 991, x * f, y * f) * a;
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return v / n;
}
function worldHash() {
  if (!W) return "00000000";
  commitDerivedCaches();
  let h = 2166136261 >>> 0;
  const feed = (n) => {
      h ^= n >>> 0;
      h = Math.imul(h, 16777619) >>> 0;
    },
    skip = new Set(["hash", "spatialBins", "tempDelta", "chemDelta", "saveMetadata"]);
  function walk(v, key = "") {
    if (skip.has(key)) return;
    if (v == null) {
      feed(0x9e3779b9);
      return;
    }
    const t = typeof v;
    if (t === "number") {
      feed(hashString(Number.isFinite(v) ? String(v) : "0"));
      return;
    }
    if (t === "string") {
      feed(hashString(v));
      return;
    }
    if (t === "boolean") {
      feed(v ? 1 : 0);
      return;
    }
    if (ArrayBuffer.isView(v)) {
      feed(v.length);
      for (let i = 0; i < v.length; i++) feed(v[i]);
      return;
    }
    if (Array.isArray(v)) {
      feed(v.length);
      for (let i = 0; i < v.length; i++) walk(v[i], String(i));
      return;
    }
    if (t === "object") {
      const keys = Object.keys(v)
        .filter((k) => !skip.has(k))
        .sort();
      feed(keys.length);
      for (const k of keys) {
        feed(hashString(k));
        walk(v[k], k);
      }
    }
  }
  walk(W);
  W.hash = (h >>> 0).toString(16).padStart(8, "0");
  return W.hash;
}
