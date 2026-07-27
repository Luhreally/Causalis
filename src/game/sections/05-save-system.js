// ═══════════════════════════════════════════════════════════════════════════
// 5. SAVE SERIALIZATION AND MIGRATION
// ═══════════════════════════════════════════════════════════════════════════
const SAVE_TYPED_ARRAY_TYPES = Object.freeze({
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int16Array,
    Int32Array,
    Float32Array,
  }),
  MAX_SAVE_TYPED_ARRAY_LENGTH = 4194304;
function bytesToBase64(bytes) {
  let s = "",
    step = 0x8000;
  for (let i = 0; i < bytes.length; i += step)
    s += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + step)));
  return btoa(s);
}
function base64ToBytes(s) {
  if (
    typeof s !== "string" ||
    s.length % 4 ||
    s.length > Math.ceil((MAX_SAVE_TYPED_ARRAY_LENGTH * 5) / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)
  )
    throw new Error("Invalid typed-array data");
  let b;
  try {
    b = atob(s);
  } catch {
    throw new Error("Invalid typed-array data");
  }
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}
function deltaEncode(a) {
  const out = [];
  let prev = 0;
  for (let i = 0; i < a.length; i++) {
    const value = Number(a[i]) | 0,
      delta = (value - prev) | 0;
    prev = value;
    let z = ((delta << 1) ^ (delta >> 31)) >>> 0;
    while (z > 127) {
      out.push((z & 127) | 128);
      z >>>= 7;
    }
    out.push(z);
  }
  return new Uint8Array(out);
}
function deltaDecode(bytes, T, length) {
  const out = new T(length);
  let pos = 0,
    prev = 0;
  for (let i = 0; i < length; i++) {
    let z = 0,
      multiplier = 1,
      count = 0,
      b = 0;
    do {
      if (pos >= bytes.length || count >= 5) throw new Error("Invalid delta-varint data");
      b = bytes[pos++];
      const chunk = b & 127;
      if (count === 4 && chunk > 15) throw new Error("Invalid delta-varint data");
      z += chunk * multiplier;
      multiplier *= 128;
      count++;
    } while (b & 128);
    z >>>= 0;
    const delta = (z >>> 1) ^ -(z & 1),
      value = (prev + delta) | 0,
      stored = T === Uint32Array ? value >>> 0 : value;
    if (
      (T === Uint8Array && (stored < 0 || stored > 255)) ||
      (T === Uint16Array && (stored < 0 || stored > 65535)) ||
      (T === Int16Array && (stored < -32768 || stored > 32767))
    )
      throw new Error("Typed-array value is out of range");
    out[i] = stored;
    prev = value;
  }
  if (pos !== bytes.length) throw new Error("Invalid delta-varint length");
  return out;
}
function saveReplacer(k, v) {
  if (typeof v === "number" && !Number.isFinite(v))
    throw new Error(`Archive contains a non-finite number at ${k || "root"}`);
  if (ArrayBuffer.isView(v)) {
    const name = v.constructor?.name,
      T = SAVE_TYPED_ARRAY_TYPES[name];
    if (!T || !(v instanceof T)) throw new Error(`Unsupported typed array ${name || "view"}`);
    const integer = T !== Float32Array;
    if (integer)
      return {
        $typed: name,
        $codec: "delta-varint",
        $length: v.length,
        $data: bytesToBase64(deltaEncode(v)),
      };
    return {
      $typed: name,
      $codec: "raw",
      $length: v.length,
      $data: bytesToBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)),
    };
  }
  return v;
}
function saveReviver(k, v) {
  if (v && Object.prototype.hasOwnProperty.call(v, "$typed")) {
    if (
      typeof v.$typed !== "string" ||
      !Object.prototype.hasOwnProperty.call(SAVE_TYPED_ARRAY_TYPES, v.$typed)
    )
      throw new Error("Unsupported typed-array type");
    if (
      !Number.isSafeInteger(v.$length) ||
      v.$length < 0 ||
      v.$length > MAX_SAVE_TYPED_ARRAY_LENGTH
    )
      throw new Error("Invalid typed-array length");
    if (v.$codec !== "delta-varint" && v.$codec !== "raw")
      throw new Error("Unsupported typed-array codec");
    const T = SAVE_TYPED_ARRAY_TYPES[v.$typed],
      integer = T !== Float32Array;
    if (v.$codec === "delta-varint" && !integer)
      throw new Error("Invalid typed-array codec for type");
    const b = base64ToBytes(v.$data);
    if (v.$codec === "delta-varint") return deltaDecode(b, T, v.$length);
    if (b.byteLength !== v.$length * T.BYTES_PER_ELEMENT)
      throw new Error("Typed-array byte length mismatch");
    const copy = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    return new T(copy);
  }
  return v;
}
const SAVE_DB_NAME = "causalis.archives",
  SAVE_DB_STORE = "worlds";
let saveDbPromise = null,
  autosaveWriteBlocked = false,
  autosaveWarningShown = false,
  autosaveInFlight = false;
let autosaveScheduled = false;
function autosaveCadence() {
  return UI.speed >= 64 ? 4096 : UI.speed >= 16 ? 2048 : 1024;
}
function queueAutosave() {
  if (!W || !UI.running || autosaveScheduled || autosaveInFlight || autosaveWriteBlocked)
    return false;
  const scheduledWorld = W;
  autosaveScheduled = true;
  setTimeout(() => {
    autosaveScheduled = false;
    if (!W || W !== scheduledWorld || !UI.running) return;
    saveWorld("auto", "Autosave", true);
    lastAutosaveTick = W.tick;
  }, 0);
  return true;
}
function openSaveDatabase() {
  if (saveDbPromise) return saveDbPromise;
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  saveDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(SAVE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SAVE_DB_STORE)) db.createObjectStore(SAVE_DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Archive database unavailable"));
    request.onblocked = () => reject(new Error("Archive database blocked by another tab"));
  });
  return saveDbPromise;
}
async function databaseSave(slot, data) {
  const db = await openSaveDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVE_DB_STORE, "readwrite");
    tx.objectStore(SAVE_DB_STORE).put(data, slot);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("Archive database write failed"));
    tx.onabort = () => reject(tx.error || new Error("Archive database write aborted"));
  });
}
async function databaseLoad(slot) {
  const db = await openSaveDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(SAVE_DB_STORE, "readonly").objectStore(SAVE_DB_STORE).get(slot);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Archive database read failed"));
  });
}
async function databaseDelete(slot) {
  const db = await openSaveDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVE_DB_STORE, "readwrite");
    tx.objectStore(SAVE_DB_STORE).delete(slot);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("Archive database delete failed"));
    tx.onabort = () => reject(tx.error || new Error("Archive database delete aborted"));
  });
}
async function storeSaveData(slot, data) {
  try {
    await databaseSave(slot, data);
    localStorage.removeItem(SAVE_PREFIX + slot);
    return "database";
  } catch (databaseError) {
    const key = SAVE_PREFIX + slot;
    try {
      localStorage.setItem(key, data);
      return "local";
    } catch (storageError) {
      if (slot !== "auto") throw storageError;
      const previous = localStorage.getItem(key);
      localStorage.removeItem(key);
      try {
        localStorage.setItem(key, data);
        return "local-reclaimed";
      } catch (retryError) {
        if (previous)
          try {
            localStorage.setItem(key, previous);
          } catch {}
        throw retryError;
      }
    }
  }
}
async function readSaveData(slot) {
  try {
    const data = await databaseLoad(slot);
    if (data) return data;
  } catch {}
  return localStorage.getItem(SAVE_PREFIX + slot);
}
function saveList() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_INDEX) || "[]");
  } catch {
    return [];
  }
}
function writeSaveList(list) {
  localStorage.setItem(SAVE_INDEX, JSON.stringify(list.slice(0, 4)));
}
function populationSummary() {
  if (!W) return {};
  const s = { herbivore: 0, predator: 0, person: 0, corpse: 0 };
  for (const id of W.activeIds) {
    const k = W.kind[id];
    if (k in s) s[k]++;
  }
  for (const c of W.cohorts) if (c.kind in s) s[c.kind] += c.count;
  return s;
}
function snapshot() {
  worldHash();
  const tiles = { ...W.tiles };
  delete tiles.tempDelta;
  delete tiles.chemDelta;
  const world = { ...W, tiles, spatialBins: [], effects: [] };
  return {
    version: VERSION,
    world,
    ui: {
      camera: { ...UI.camera },
      view: UI.view,
      overlay: UI.overlay,
      quality: UI.quality,
      labels: UI.labels,
    },
    savedHash: W.hash,
  };
}
async function saveWorld(slot = "auto", name = "Autosave", quiet = false) {
  if (!W || (quiet && autosaveWriteBlocked) || (quiet && autosaveInFlight)) return false;
  if (quiet) autosaveInFlight = true;
  const saveTarget = W;
  try {
    const archive = snapshot(),
      data = JSON.stringify(archive, saveReplacer),
      savedAt = Date.now(),
      record = {
        slot,
        name: name || "World",
        date: new Date(savedAt).toISOString(),
        seed: saveTarget.seed,
        year: Math.floor(saveTarget.tick / TICKS_PER_YEAR),
        population: populationSummary(),
        hash: archive.savedHash,
        bytes: data.length,
        version: VERSION,
      },
      backend = await storeSaveData(slot, data);
    let list = saveList().filter((x) => x.slot !== slot);
    list.unshift({ ...record, backend });
    writeSaveList(list);
    saveTarget.saveMetadata = { slot, name, date: savedAt, backend };
    autosaveWriteBlocked = false;
    autosaveWarningShown = false;
    if (!quiet) toast(`Saved “${name}”`);
    refreshContinueButton();
    return true;
  } catch (err) {
    if (quiet) {
      autosaveWriteBlocked = true;
      if (!autosaveWarningShown) {
        autosaveWarningShown = true;
        toast("Autosave paused: browser storage is unavailable. Manual saves will retry.", "bad");
      }
    } else toast(`Could not save: ${err?.message || "browser storage is unavailable"}`, "bad");
    return false;
  } finally {
    if (quiet) autosaveInFlight = false;
  }
}
function migrateSave(s) {
  if (
    !s ||
    typeof s !== "object" ||
    Array.isArray(s) ||
    !s.world ||
    typeof s.world !== "object" ||
    Array.isArray(s.world)
  )
    throw new Error("Invalid save");
  const declared = s.version ?? 1;
  if (!Number.isSafeInteger(declared) || declared < 1) throw new Error("Invalid save version");
  if (declared > VERSION) throw new Error("This save was created by a newer version");
  if (declared < VERSION) {
    s.savedHash = null;
    s.migratedFrom = declared;
  }
  s.version = VERSION;
  s.world.version = VERSION;
  return s;
}
function validateSaveCandidate(s) {
  const w = s.world,
    width = w.width,
    height = w.height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 1024 ||
    height > 1024 ||
    width * height > 1048576
  )
    throw new Error("Invalid world dimensions");
  if (typeof w.seed !== "string" || !w.seed.length || w.seed.length > 512)
    throw new Error("Invalid world seed");
  if (!Number.isSafeInteger(w.tick) || w.tick < 0) throw new Error("Invalid world clock");
  if (
    !w.tiles ||
    typeof w.tiles !== "object" ||
    Array.isArray(w.tiles) ||
    !w.components ||
    typeof w.components !== "object" ||
    Array.isArray(w.components) ||
    !Array.isArray(w.activeIds) ||
    !Array.isArray(w.events)
  )
    throw new Error("Invalid world structure");
  if (
    s.savedHash != null &&
    (typeof s.savedHash !== "string" || !/^[0-9a-f]{8}$/i.test(s.savedHash))
  )
    throw new Error("Invalid archive hash");
  return s;
}
function loadedUiPatch(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid saved interface state");
  const out = {};
  if (value.camera != null) {
    if (typeof value.camera !== "object" || Array.isArray(value.camera))
      throw new Error("Invalid saved camera");
    out.camera = { ...UI.camera };
    for (const [key, item] of Object.entries(value.camera)) {
      if (!Object.prototype.hasOwnProperty.call(UI.camera, key)) continue;
      const expected = UI.camera[key];
      if (typeof expected === "number") {
        if (
          typeof item !== "number" ||
          !Number.isFinite(item) ||
          Math.abs(item) > 1e7 ||
          (key === "zoom" && item <= 0)
        )
          throw new Error("Invalid saved camera");
      } else if (typeof expected === "boolean" && typeof item !== "boolean")
        throw new Error("Invalid saved camera");
      else if (typeof expected !== typeof item) continue;
      out.camera[key] = item;
    }
  }
  if (value.view != null) {
    if (!["top", "iso", "oblique"].includes(value.view)) throw new Error("Invalid saved view");
    out.view = value.view;
  }
  if (value.overlay !== undefined) {
    if (value.overlay !== null && (typeof value.overlay !== "string" || value.overlay.length > 64))
      throw new Error("Invalid saved overlay");
    out.overlay = value.overlay;
  }
  if (value.quality != null) {
    if (!["low", "standard", "high"].includes(value.quality))
      throw new Error("Invalid saved quality");
    out.quality = value.quality;
  }
  if (value.labels != null) {
    if (typeof value.labels !== "boolean") throw new Error("Invalid saved labels");
    out.labels = value.labels;
  }
  return out;
}
function captureUiState() {
  const state = {};
  for (const [key, value] of Object.entries(UI))
    state[key] =
      value instanceof Set
        ? new Set(value)
        : Array.isArray(value)
          ? value.slice()
          : value && Object.getPrototypeOf(value) === Object.prototype
            ? { ...value }
            : value;
  return state;
}
function restoreUiState(state) {
  for (const key of Object.keys(UI))
    if (!Object.prototype.hasOwnProperty.call(state, key)) delete UI[key];
  for (const [key, value] of Object.entries(state)) UI[key] = value;
}
async function loadWorld(slot) {
  let priorWorld = W,
    priorUi = captureUiState(),
    staged = false;
  UI.running = false;
  accumulator = 0;
  if (DOM.pauseBtn) DOM.pauseBtn.textContent = "▶";
  refreshTopbar();
  try {
    const raw = await readSaveData(slot);
    if (typeof raw !== "string" || !raw) throw new Error("Save slot is empty");
    const snap = validateSaveCandidate(migrateSave(JSON.parse(raw, saveReviver))),
      uiPatch = loadedUiPatch(snap.ui);
    W = snap.world;
    staged = true;
    const actual = worldHash();
    if (snap.savedHash && actual !== snap.savedHash)
      throw new Error(`archive integrity check failed (${actual} != ${snap.savedHash})`);
    restoreWorldDefaults();
    worldHash();
    if (snap.migratedFrom != null) {
      ensureSentientContinuity();
      worldHash();
    }
    Object.assign(UI, uiPatch);
    UI.selectedTile = -1;
    UI.selectedEntity = 0;
    UI.selectedEvent = 0;
    UI.followId = 0;
    UI.running = false;
    UI.clockInterrupted = false;
    UI.followDeathWasRunning = false;
    UI.combatVisuals = [];
    UI.keys.clear();
    enterGame();
    toast(`Loaded ${W.seed}`);
    return true;
  } catch (err) {
    if (staged) W = priorWorld;
    restoreUiState(priorUi);
    accumulator = 0;
    if (DOM.pauseBtn) DOM.pauseBtn.textContent = UI.running ? "Ⅱ" : "▶";
    refreshTopbar();
    toast(`Could not load: ${err?.message || "invalid archive"}`, "bad");
    return false;
  }
}
function debugSaveCodecProbe() {
  const samples = [
      new Uint8Array([0, 1, 255, 2]),
      new Uint16Array([0, 65535, 4, 4096]),
      new Uint32Array([0, 4294967295, 2147483648, 7]),
      new Int16Array([-32768, 0, 32767, -4]),
      new Int32Array([-2147483648, 0, 2147483647, -9]),
      new Float32Array([0, -1.5, Math.PI]),
    ],
    roundTrips = samples.map((source) => {
      const decoded = JSON.parse(JSON.stringify({ source }, saveReplacer), saveReviver).source;
      return (
        decoded.constructor === source.constructor &&
        decoded.length === source.length &&
        Array.from(decoded).every((value, index) => Object.is(value, source[index]))
      );
    }),
    bad = [
      { $typed: "NopeArray", $codec: "raw", $length: 0, $data: "" },
      { $typed: "Uint16Array", $codec: "raw", $length: -1, $data: "" },
      { $typed: "Uint16Array", $codec: "raw", $length: 1, $data: "AA==" },
      { $typed: "Uint16Array", $codec: "raw", $length: 1, $data: "%%%=" },
      { $typed: "Uint16Array", $codec: "delta-varint", $length: 1, $data: "gA==" },
      { $typed: "Uint16Array", $codec: "delta-varint", $length: 0, $data: "AA==" },
      { $typed: "Float32Array", $codec: "delta-varint", $length: 0, $data: "" },
    ],
    rejected = bad.map((value) => {
      try {
        saveReviver("", value);
        return false;
      } catch {
        return true;
      }
    });
  return { ok: roundTrips.every(Boolean) && rejected.every(Boolean), roundTrips, rejected };
}
function uiStateDigest() {
  return JSON.stringify({
    running: UI.running,
    speed: UI.speed,
    view: UI.view,
    overlay: UI.overlay,
    tool: UI.tool,
    quality: UI.quality,
    labels: UI.labels,
    selectedTile: UI.selectedTile,
    selectedEntity: UI.selectedEntity,
    selectedEvent: UI.selectedEvent,
    followId: UI.followId,
    clockInterrupted: !!UI.clockInterrupted,
    camera: UI.camera,
    keys: Array.from(UI.keys),
  });
}
async function debugLoadRollbackProbe() {
  if (!W) return { ok: false, reason: "no active world" };
  const beforeWorld = W,
    beforeUi = uiStateDigest(),
    raw = JSON.stringify(snapshot(), saveReplacer),
    plain = JSON.parse(raw),
    originalRead = readSaveData,
    originalEnter = enterGame,
    originalEnsure = ensureSentientContinuity;
  let ensureCalls = 0;
  plain.ui = {
    ...plain.ui,
    view: plain.ui.view === "top" ? "iso" : "top",
    camera: { ...plain.ui.camera, x: (plain.ui.camera.x || 0) + 11 },
  };
  readSaveData = async () => JSON.stringify(plain);
  enterGame = () => {
    throw new Error("debug commit failure");
  };
  ensureSentientContinuity = (...args) => {
    ensureCalls++;
    return originalEnsure(...args);
  };
  let loaded = false;
  try {
    loaded = await loadWorld("__debug-rollback");
  } finally {
    readSaveData = originalRead;
    enterGame = originalEnter;
    ensureSentientContinuity = originalEnsure;
  }
  return {
    ok: !loaded && W === beforeWorld && uiStateDigest() === beforeUi && ensureCalls === 0,
    loaded,
    sameWorld: W === beforeWorld,
    sameUi: uiStateDigest() === beforeUi,
    ensureCallsBeforeCurrentHash: ensureCalls,
  };
}
async function debugSaveSwitchProbe() {
  if (!W) return { ok: false, reason: "no active world" };
  const savedWorld = W,
    priorMetadata = savedWorld.saveMetadata,
    switchedWorld = { seed: "debug-switched-world", saveMetadata: { marker: "untouched" } },
    priorIndex = localStorage.getItem(SAVE_INDEX),
    priorFlags = { autosaveWriteBlocked, autosaveWarningShown, autosaveInFlight },
    originalStore = storeSaveData;
  let release = null;
  storeSaveData = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  autosaveWriteBlocked = false;
  autosaveWarningShown = false;
  autosaveInFlight = false;
  const saving = saveWorld("__debug-switch", "Snapshot race", true);
  W = switchedWorld;
  if (release) release("debug");
  const saved = await saving,
    record = saveList().find((item) => item.slot === "__debug-switch"),
    result = {
      ok:
        saved &&
        record?.seed === savedWorld.seed &&
        savedWorld.saveMetadata?.slot === "__debug-switch" &&
        switchedWorld.saveMetadata?.marker === "untouched",
      saved,
      recordSeed: record?.seed,
      targetSeed: savedWorld.seed,
      targetAnnotated: savedWorld.saveMetadata?.slot === "__debug-switch",
      switchedUntouched: switchedWorld.saveMetadata?.marker === "untouched",
    };
  storeSaveData = originalStore;
  W = savedWorld;
  savedWorld.saveMetadata = priorMetadata;
  autosaveWriteBlocked = priorFlags.autosaveWriteBlocked;
  autosaveWarningShown = priorFlags.autosaveWarningShown;
  autosaveInFlight = priorFlags.autosaveInFlight;
  if (priorIndex == null) localStorage.removeItem(SAVE_INDEX);
  else localStorage.setItem(SAVE_INDEX, priorIndex);
  return result;
}
async function deleteSave(slot) {
  localStorage.removeItem(SAVE_PREFIX + slot);
  try {
    await databaseDelete(slot);
  } catch {}
  writeSaveList(saveList().filter((x) => x.slot !== slot));
  autosaveWriteBlocked = false;
  autosaveWarningShown = false;
  renderSaveModal(true);
}
function loadSettings() {
  try {
    return Object.assign(
      { audio: false, volume: 0.12, quality: "standard", labels: true },
      JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"),
    );
  } catch {
    return { audio: false, volume: 0.12, quality: "standard", labels: true };
  }
}
function persistSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
