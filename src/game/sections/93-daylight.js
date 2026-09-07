// ═══════════════════════════════════════════════════════════════════════════
// 93. DAY AND NIGHT — the sky turns, and the towns light their windows
// ═══════════════════════════════════════════════════════════════════════════
// The world was lit at one unchanging hour. Here the clock of the world is
// read as a day of sixty-four ticks, four to a year: the sky deepens to
// night, warms at dusk and dawn, and clears at noon. At night the towns
// answer: hearths, kilns, and forges glow warm, towns that know Electricity
// light their windows and hang lamps along their paved streets, and ships and
// fires burn brighter against the dark. The tint fades as the clock is run
// faster so it never strobes, drops to a steady afternoon under reduced
// motion, and can be turned off in Settings. Rendering only reads; the day is
// a way of seeing the tick, never a change to it.
const DAY_TICKS = 64,
  NIGHT_ALPHA_MAX = 0.42,
  DUSK_ALPHA_MAX = 0.14,
  DAYLIGHT = { phase: 0.5, world: null, lightsDrawn: 0 };
function daylightAt(tick) {
  // 0 at midnight, 1 at noon, on a smooth curve.
  const phase = ((tick % DAY_TICKS) + DAY_TICKS) % DAY_TICKS / DAY_TICKS;
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}
function dayNightEnabled() {
  return UI.dayNight !== false;
}
// How strongly the night is shown: full at 1x, fading as the clock runs fast.
function daylightAmplitude() {
  if (!dayNightEnabled() || ACTIVE_REDUCED_MOTION) return 0;
  const speed = Math.max(0.25, UI.speed || 1);
  return speed <= 4 ? 1 : clamp(4 / speed, 0.15, 1);
}
function currentDaylight() {
  if (!W) return 1;
  const target = daylightAt(W.tick);
  if (DAYLIGHT.world !== W) {
    DAYLIGHT.world = W;
    DAYLIGHT.phase = target;
  } else DAYLIGHT.phase = lerp(DAYLIGHT.phase, target, ACTIVE_REDUCED_MOTION ? 1 : 0.12);
  return DAYLIGHT.phase;
}
function nightStrength(light = currentDaylight()) {
  return (1 - light) * daylightAmplitude();
}
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
      "> Day and night · the sky turns and towns light their windows</label>",
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
  lightAt: (tick) => daylightAt(tick),
  light: () => currentDaylight(),
  night: () => nightStrength(),
  amplitude: () => daylightAmplitude(),
  lightsDrawn: () => DAYLIGHT.lightsDrawn,
  enabled: () => dayNightEnabled(),
  set: (on) => applyDayNightSetting(on),
});
