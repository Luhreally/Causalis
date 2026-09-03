// ═══════════════════════════════════════════════════════════════════════════
// 4. DETERMINISTIC HASHING AND RANDOM STREAMS
// ═══════════════════════════════════════════════════════════════════════════
function hashString(s) {
  const text = String(s);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
// Random-stream tags are short literals hashed thousands of times per tick; memoize them.
const HASH_PART_CACHE = new Map();
function hashPart(part) {
  if (typeof part === "number") return part >>> 0;
  let value = HASH_PART_CACHE.get(part);
  if (value === undefined) {
    if (HASH_PART_CACHE.size > 8192) HASH_PART_CACHE.clear();
    value = hashString(part);
    HASH_PART_CACHE.set(part, value);
  }
  return value;
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
    h ^= hashPart(p);
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
// The world hash is the run-to-run determinism fingerprint and the save-integrity check.
// It walks the entire authoritative state, so it must stay cheap: numbers are fed by their
// IEEE-754 bit pattern instead of being stringified, and object-key hashes are memoized.
const WORLD_HASH_SKIP = new Set(["hash", "spatialBins", "tempDelta", "chemDelta", "saveMetadata"]),
  WORLD_HASH_KEY_CACHE = new Map(),
  WORLD_HASH_F64 = new Float64Array(1),
  WORLD_HASH_U32 = new Uint32Array(WORLD_HASH_F64.buffer);
function worldHashKey(key) {
  let value = WORLD_HASH_KEY_CACHE.get(key);
  if (value === undefined) {
    value = hashString(key);
    WORLD_HASH_KEY_CACHE.set(key, value);
  }
  return value;
}
function hashable(value) {
  const t = typeof value;
  return t !== "undefined" && t !== "function" && t !== "symbol";
}
function worldHash() {
  if (!W) return "00000000";
  let h = 2166136261 >>> 0;
  const feed = (n) => {
    h ^= n >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  };
  function walk(v) {
    if (v == null) {
      feed(0x9e3779b9);
      return;
    }
    const t = typeof v;
    if (t === "number") {
      if ((v | 0) === v) {
        feed(0x51);
        feed(v);
        return;
      }
      if (Number.isNaN(v)) {
        feed(0x52);
        return;
      }
      WORLD_HASH_F64[0] = v;
      feed(0x53);
      feed(WORLD_HASH_U32[0]);
      feed(WORLD_HASH_U32[1]);
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
      // A byte view keeps this loop monomorphic across every typed-array flavor in the world.
      const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength),
        words = bytes.length >>> 2;
      feed(v.length);
      feed(bytes.length);
      for (let i = 0; i < words; i++) {
        const o = i << 2;
        feed(bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24));
      }
      for (let o = words << 2; o < bytes.length; o++) feed(bytes[o]);
      return;
    }
    if (Array.isArray(v)) {
      feed(v.length);
      for (let i = 0; i < v.length; i++) walk(v[i]);
      return;
    }
    if (t === "object") {
      // Keys holding undefined (or functions) vanish in JSON, so they are invisible here too;
      // otherwise a saved world could never match its own archive hash after reloading.
      const keys = Object.keys(v).sort();
      let counted = 0;
      for (const k of keys) if (!WORLD_HASH_SKIP.has(k) && hashable(v[k])) counted++;
      feed(counted);
      for (const k of keys) {
        if (WORLD_HASH_SKIP.has(k) || !hashable(v[k])) continue;
        feed(worldHashKey(k));
        walk(v[k]);
      }
    }
  }
  walk(W);
  W.hash = (h >>> 0).toString(16).padStart(8, "0");
  return W.hash;
}
