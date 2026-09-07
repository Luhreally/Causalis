// ═══════════════════════════════════════════════════════════════════════════
// 93. DAY AND NIGHT — the year is the day: a long noon, a long night, and sleep
// ═══════════════════════════════════════════════════════════════════════════
// A tick of this world is longer than a day, so a day of sixty-four ticks was
// a fiction laid over the clock: the sky flipped every few seconds at 1x,
// four times a year, and nobody in the world answered it. The day is now the
// world's own slow turn: one day to the year, noon at High sun and midnight
// at Deep cold, read from the same phase that names the season in the Time
// panel and flipped with the hemisphere under the camera, so the south has
// its night when the north has its noon. The sky deepens through dusk into a
// long night and clears through dawn, and the Time panel names the hour.
// And the night is real: at nightfall people who are neither hungry, thirsty,
// marching, nor on a journey walk home and sleep, labour stops unless a fire
// wants hands, herds bed down while hunters keep hunting, and a sleeper
// recovers twice as fast. Towns answer the dark as before: hearths, kilns,
// and forges glow, electric towns light windows and street lamps. The tint
// fades as the clock is run faster so it never strobes, holds a steady
// afternoon under reduced motion, and can be turned off in Settings; the
// sleep is the simulation's own and is deterministic.
const DAY_TICKS = TICKS_PER_YEAR,
  NIGHT_ALPHA_MAX = 0.42,
  DUSK_ALPHA_MAX = 0.14,
  NIGHT_LIGHT = 0.15, // below this light the world's walkers sleep
  WAKE_HUNGER = 66,
  WAKE_THIRST = 66,
  NIGHT_REST_SCORE = 120,
  NIGHT_RETURN_SCORE = 130,
  SLEEP_RECOVERY = 2,
  DAYLIGHT = { phase: 0.5, world: null, lightsDrawn: 0 };
// Where the year stands, as a phase: 1/4 at High sun, 3/4 at Deep cold.
// Untilted worlds keep the same turn without a season to name it.
function dayPhase(tick = W.tick, hemisphere = 1) {
  const s = typeof seasonGenome === "function" ? seasonGenome() : null;
  let phase = s && s.amplitude ? seasonPhase(tick) : (((tick / DAY_TICKS) % 1) + 1) % 1;
  if (hemisphere < 0) phase = (phase + 0.5) % 1;
  return phase;
}
// 1 at noon, 0 through the long night, with dusk and dawn between.
function daylightAt(tick = W.tick, hemisphere = 1) {
  const raw = 0.5 + 0.5 * Math.sin(dayPhase(tick, hemisphere) * Math.PI * 2);
  return clamp((raw - 0.1) / 0.7, 0, 1);
}
function hemisphereAt(x, y) {
  if (typeof seasonHemisphere !== "function" || !W) return 1;
  return seasonHemisphere(clamp(Math.round(x), 0, W.width - 1), clamp(Math.round(y), 0, W.height - 1));
}
function cameraHemisphere() {
  return W ? hemisphereAt(UI.camera.x, UI.camera.y) : 1;
}
function dayWord(tick = W.tick, hemisphere = cameraHemisphere()) {
  const phase = dayPhase(tick, hemisphere),
    light = daylightAt(tick, hemisphere),
    falling = phase > 0.25 && phase < 0.75;
  if (light <= NIGHT_LIGHT) return "Night";
  if (light >= 0.85) return "Noon";
  if (light >= 0.45) return falling ? "Afternoon" : "Morning";
  return falling ? "Dusk" : "Dawn";
}
function dayNightEnabled() {
  return UI.dayNight !== false;
}
// How strongly the night is shown: full at 1x, fading as the clock runs fast,
// and softer toward the equator where the year swings less.
function daylightAmplitude() {
  if (!dayNightEnabled() || ACTIVE_REDUCED_MOTION) return 0;
  const speed = Math.max(0.25, UI.speed || 1),
    h = Math.abs(cameraHemisphere());
  return (speed <= 1 ? 1 : clamp(2 / speed, 0.12, 1)) * (0.7 + 0.3 * Math.min(1, h));
}
function currentDaylight() {
  if (!W) return 1;
  const target = daylightAt(W.tick, cameraHemisphere() < 0 ? -1 : 1);
  if (DAYLIGHT.world !== W) {
    DAYLIGHT.world = W;
    DAYLIGHT.phase = target;
  } else DAYLIGHT.phase = lerp(DAYLIGHT.phase, target, ACTIVE_REDUCED_MOTION ? 1 : 0.12);
  return DAYLIGHT.phase;
}
function nightStrength(light = currentDaylight()) {
  return (1 - light) * daylightAmplitude();
}
// ── The night in the simulation ───────────────────────────────────────────────
const NIGHT_CACHE = { world: null, tick: -1, north: false, south: false };
function nightAt(x, y) {
  if (NIGHT_CACHE.world !== W || NIGHT_CACHE.tick !== W.tick) {
    NIGHT_CACHE.world = W;
    NIGHT_CACHE.tick = W.tick;
    NIGHT_CACHE.north = daylightAt(W.tick, 1) <= NIGHT_LIGHT;
    NIGHT_CACHE.south = daylightAt(W.tick, -1) <= NIGHT_LIGHT;
  }
  return hemisphereAt(x, y) < 0 ? NIGHT_CACHE.south : NIGHT_CACHE.north;
}
// Whether a walker would sleep now: at night, unless hungry, thirsty, marching,
// or on a journey. Herds sleep where they stand; people sleep at home.
function wouldSleep(id, k = W.kind[id], l = W.components.life[id], p = W.components.position[id]) {
  if ((k !== KINDS.PERSON && k !== KINDS.HERBIVORE) || !l || !p) return false;
  if (!nightAt(p.x, p.y)) return false;
  if (l.hunger > WAKE_HUNGER || l.thirst > WAKE_THIRST) return false;
  if (k === KINDS.PERSON) {
    if (W.components.campaign?.[id]) return false;
    if (W.civilOrders?.some((o) => o.id === id)) return false;
  }
  return true;
}
// The behaviour scores of section 21 ask here at night: "rest" for a sleeper
// who is home or has no home, "return" for one who has a home to walk to.
function sleepScore(id, k, p, l, which, place = null) {
  if (!wouldSleep(id, k, l, p)) return 0;
  if (k === KINDS.HERBIVORE) return which === "rest" ? NIGHT_REST_SCORE * 0.9 : 0;
  const inside = !!l.insideBuildingId,
    home = place || (W.components.social[id]?.homePlaceKind ? true : null);
  if (which === "rest") return inside || !home ? NIGHT_REST_SCORE : 0;
  if (which === "return") return !inside && home ? NIGHT_RETURN_SCORE : 0;
  return 0;
}
function sleepRecoveryFactor(id) {
  const p = W.components.position[id],
    k = W.kind[id];
  return (k === KINDS.PERSON || k === KINDS.HERBIVORE) && p && nightAt(p.x, p.y) ? SLEEP_RECOVERY : 1;
}
// Fire near a sleeper is the one thing that keeps hands up at night.
function nightShiftAllowed(id) {
  const p = W.components.position[id];
  if (!p) return false;
  const fire = W.tiles.fire;
  for (let dy = -6; dy <= 6; dy++)
    for (let dx = -6; dx <= 6; dx++) {
      const x = p.x + dx,
        y = p.y + dy;
      if (inside(x, y) && fire[idx(x, y)] > 25) return true;
    }
  return false;
}
const workerReadyForLaborDaylightBase = workerReadyForLabor;
workerReadyForLabor = function (id) {
  if (!workerReadyForLaborDaylightBase(id)) return false;
  if (!wouldSleep(id)) return true;
  return nightShiftAllowed(id);
};
// ── Night lights ──────────────────────────────────────────────────────────────
const LIT_TYPES = new Set(["hall", "archive", "shelter", "clinic", "workshop", "market", "forge", "kiln", "hearth"]),
  WARM_TYPES = new Set(["hearth", "kiln", "forge"]);
const litTownCache = { world: null, tick: -1, byPlace: new Map() };
function townLighting(b) {
  if (litTownCache.world !== W || litTownCache.tick !== W.tick) {
    litTownCache.world = W;
    litTownCache.tick = W.tick;
    litTownCache.byPlace.clear();
  }
  const key = `${b.placeKind}:${b.placeId}`;
  let lit = litTownCache.byPlace.get(key);
  if (lit === undefined) {
    const place = b.placeKind === "settlement" ? W.settlements.find((s) => s.id === b.placeId) : null,
      k = place?.knownProcesses || [];
    lit = k.includes("electricity") ? "electric" : k.includes("controlled_fire") ? "fire" : "dark";
    litTownCache.byPlace.set(key, lit);
  }
  return lit;
}
function drawNightLights(now, m, bounds, night) {
  let drawn = 0;
  const still = ACTIVE_REDUCED_MOTION,
    r = clamp(m.tw * 0.55, 3, 40);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of W.buildings) {
    if (!b.complete || b.ruined || b.x < bounds.x0 - 1 || b.x > bounds.x1 + 1 || b.y < bounds.y0 - 1 || b.y > bounds.y1 + 1) continue;
    const lit = townLighting(b),
      warm = WARM_TYPES.has(b.type);
    if (lit === "dark" || (lit === "fire" && !warm) || (lit === "electric" && !LIT_TYPES.has(b.type))) continue;
    const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
      flicker = still ? 1 : warm ? 0.8 + 0.2 * Math.sin(now * 0.011 + b.id) : 0.94 + 0.06 * Math.sin(now * 0.004 + b.id),
      glow = ctx.createRadialGradient(s.x, s.y - r * 0.3, 0, s.x, s.y - r * 0.3, r * (warm ? 1.4 : 1.1));
    glow.addColorStop(0, warm ? `rgba(255,150,60,${0.42 * night * flicker})` : `rgba(255,214,140,${0.36 * night * flicker})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(s.x - r * 1.4, s.y - r * 1.7, r * 2.8, r * 2.8);
    if (++drawn >= 220) break;
  }
  // Street lamps along paved streets of electric towns.
  if (W.tiles?.road && UI.camera.zoom >= 1.6 && drawn < 220) {
    const lamps = new Set();
    for (const b of W.buildings) {
      if (!b.complete || b.ruined || townLighting(b) !== "electric") continue;
      if (b.x < bounds.x0 - 2 || b.x > bounds.x1 + 2 || b.y < bounds.y0 - 2 || b.y > bounds.y1 + 2) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = b.x + dx,
          y = b.y + dy;
        if (!inside(x, y)) continue;
        const t = idx(x, y);
        if (W.tiles.road[t] === 1 && (x + y) % 2 === 0) lamps.add(t);
      }
    }
    ctx.fillStyle = `rgba(255,236,190,${0.9 * night})`;
    for (const t of lamps) {
      const [x, y] = xy(t),
        s = proceduralProjectTile(x + 0.5, y + 0.5, m),
        lr = Math.max(1, m.tw * 0.08);
      ctx.beginPath();
      ctx.arc(s.x, s.y - m.tw * 0.35, lr, 0, Math.PI * 2);
      ctx.fill();
      const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, m.tw * 0.8);
      halo.addColorStop(0, `rgba(255,220,150,${0.22 * night})`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(s.x - m.tw, s.y - m.tw, m.tw * 2, m.tw * 2);
      ctx.fillStyle = `rgba(255,236,190,${0.9 * night})`;
      if (++drawn >= 260) break;
    }
  }
  ctx.restore();
  DAYLIGHT.lightsDrawn = drawn;
}
const drawProceduralAtmosphereDaylightBase = drawProceduralAtmosphere;
drawProceduralAtmosphere = function (now, m, v) {
  drawProceduralAtmosphereDaylightBase(now, m, v);
  if (!W) return;
  const light = currentDaylight(),
    night = nightStrength(light);
  DAYLIGHT.lightsDrawn = 0;
  if (night <= 0.01) return;
  // Dusk and dawn warm the world before the dark settles.
  const dusk = clamp(1 - Math.abs(light - 0.3) / 0.22, 0, 1) * daylightAmplitude();
  if (dusk > 0.01) {
    ctx.fillStyle = `rgba(255,140,70,${DUSK_ALPHA_MAX * dusk})`;
    ctx.fillRect(0, 0, m.w, m.h);
  }
  ctx.fillStyle = `rgba(8,14,40,${NIGHT_ALPHA_MAX * night})`;
  ctx.fillRect(0, 0, m.w, m.h);
  if (UI.quality !== "low" && UI.camera.zoom >= 0.9 && night > 0.15) drawNightLights(now, m, visibleBounds(), night);
};
// The Time panel names the hour beside the season.
const seasonLabelDaylightBase = seasonLabel;
seasonLabel = function () {
  const base = seasonLabelDaylightBase();
  if (!W || !dayNightEnabled()) return base;
  return `${base} · ${dayWord()}`;
};
// ── Settings ──────────────────────────────────────────────────────────────────
function applyDayNightSetting(on = loadSettings().dayNight !== false) {
  UI.dayNight = !!on;
}
const bootDaylightBase = boot;
boot = function (...args) {
  const out = bootDaylightBase(...args);
  applyDayNightSetting();
  return out;
};
const showSettingsDaylightBase = showSettings;
showSettings = function () {
  showSettingsDaylightBase();
  const stack = DOM.modalBody?.querySelector(".stack");
  if (!stack || stack.querySelector("#settingDayNight")) return;
  stack.insertAdjacentHTML(
    "beforeend",
    '<label class="check"><input id="settingDayNight" type="checkbox"' +
      (loadSettings().dayNight !== false ? " checked" : "") +
      "> Day and night · the sky turns with the year and towns light their windows</label>",
  );
  const save = $("#saveSettings"),
    original = save.onclick;
  save.onclick = () => {
    const on = !!$("#settingDayNight")?.checked;
    original?.();
    persistSettings({ ...loadSettings(), dayNight: on });
    applyDayNightSetting(on);
  };
};
window.ALIFE_DAYLIGHT_DEBUG = Object.freeze({
  dayTicks: DAY_TICKS,
  nightLight: NIGHT_LIGHT,
  phase: (tick, hemisphere = 1) => dayPhase(tick, hemisphere),
  lightAt: (tick, hemisphere = 1) => daylightAt(tick, hemisphere),
  light: () => currentDaylight(),
  night: () => nightStrength(),
  amplitude: () => daylightAmplitude(),
  lightsDrawn: () => DAYLIGHT.lightsDrawn,
  enabled: () => dayNightEnabled(),
  set: (on) => applyDayNightSetting(on),
  word: (tick, hemisphere) => dayWord(tick, hemisphere),
  hemisphereAt: (x, y) => hemisphereAt(x, y),
  nightAt: (x, y) => nightAt(x, y),
  asleep: (id) => wouldSleep(id),
  ready: (id) => workerReadyForLabor(id),
  recovery: (id) => sleepRecoveryFactor(id),
});
