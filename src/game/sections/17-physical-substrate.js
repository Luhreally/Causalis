// ═══════════════════════════════════════════════════════════════════════════
// 17. PHYSICAL SUBSTRATE SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════
function setWeather(name, intensity = 1, causeEvent = 0) {
  if (!WEATHER.includes(name)) return;
  W.weather = { name, started: W.tick, intensity, cycleCause: causeEvent };
  const type =
    name.includes("Rain") || name === "Storm"
      ? "RainEvent"
      : name === "Drought"
        ? "DroughtEvent"
        : null;
  if (type) {
    const ev = emitEvent(type, {
      causes: [causeEvent],
      evidence: ["deterministic climate cycle affected every tile column"],
      magnitude: intensity,
      importance: name === "Drought" ? 2 : 1,
      data: { global: true, weather: name },
    });
    W.weather.cycleCause = ev.id;
  }
}
function livingNearTile(i, radius = 3) {
  const [cx, cy] = xy(i);
  let count = 0;
  for (let y = Math.max(0, cy - radius); y <= Math.min(W.height - 1, cy + radius); y++)
    for (let x = Math.max(0, cx - radius); x <= Math.min(W.width - 1, cx + radius); x++)
      for (const id of W.spatialBins[idx(x, y)] || []) if (classifyAlive(id)) count++;
  return count;
}
function lightningIgnitionTile() {
  let best = -1,
    bestScore = -Infinity;
  const cycle = Math.floor(W.tick / 256);
  for (let i = 0; i < W.tileCount; i++) {
    const fuel = W.tiles.chem[C.FUEL][i] + W.tiles.chem[C.ORGANIC][i],
      moisture = tileMoisture(i);
    if (
      fuel < 190 ||
      moisture > 52 ||
      W.tiles.liquid[i] > 420 ||
      W.tiles.fire[i] ||
      livingNearTile(i, 4) ||
      settlementNear(i, 7) ||
      campNear(i, 7)
    )
      continue;
    const exposure =
      W.tiles.elevation[i] * 0.12 +
      (100 - moisture) * 2.2 +
      Math.min(180, fuel / 8) +
      counterRand("lightning-site", cycle, i) * 18;
    if (exposure > bestScore) {
      bestScore = exposure;
      best = i;
    }
  }
  return bestScore > 205 ? best : -1;
}
function updateWeatherCycle() {
  if (W.tick % 256 === 1) {
    const cycle = Math.sin(W.tick / 390),
      r = counterRand("climate", Math.floor(W.tick / 256), 0, 0),
      vol = W.laws.climateVolatility * (W.config.disasterFrequency || 1);
    let name = "Clear";
    if (r < 0.13 * vol) name = "Storm";
    else if (r < 0.28 * vol) name = "Rain";
    else if (r < 0.36 * vol) name = "Heavy Rain";
    else if (r > 0.88 / Math.max(0.6, vol)) name = "Drought";
    else if (cycle > 0.72) name = "Heat Wave";
    setWeather(name, 0.7 + counterRand("weather-intensity", W.tick) * 0.8);
  }
  const naturalFireInterval = Math.round(2048 / Math.max(0.5, W.config.disasterFrequency || 1));
  if (
    W.weather.name === "Storm" &&
    W.weather.intensity >= 0.9 &&
    W.tick % 181 === 0 &&
    W.tick - (W.lastNaturalFireTick ?? -4096) > naturalFireInterval
  ) {
    const i = lightningIgnitionTile();
    if (i >= 0) {
      const ev = emitEvent("LightningEvent", {
        location: i,
        causes: W.weather.cycleCause ? [W.weather.cycleCause] : [],
        evidence: [
          "storm charge discharged into an exposed dry fuel bed away from inhabited habitat",
        ],
        magnitude: W.weather.intensity,
        importance: 2,
        data: { visualUntil: W.tick + 18 },
      });
      W.lightningFlash = { tile: i, started: W.tick, until: W.tick + 18, eventId: ev.id };
      UI.lightningVisual = {
        tile: i,
        startedAt: performance.now(),
        until: performance.now() + 900,
        eventId: ev.id,
      };
      queueEffect("IgniteTile", {
        tile: i,
        intensity: 300,
        causeEvent: ev.id,
        origin: "lightning",
      });
      W.lastNaturalFireTick = W.tick;
    }
  }
  // The rest of the calendar: seasons, belief, diplomacy, festivals, eras...,
  // each registered by its section with calendarSystem() (16).
  runTickSystems(TICK_SYSTEMS.calendar, 0, TICK_SYSTEMS.calendar.length);
}
function igniteTile(i, intensity = 300, cause = 0, origin = "combustion") {
  if (i < 0 || i >= W.tileCount) return false;
  const causeType = cause ? eventById(cause)?.type : "";
  if (origin === "combustion") {
    if (causeType === "LightningEvent") origin = "lightning";
    else if (causeType === "FireStartedEvent") origin = "spread";
    else if (causeType === "InterventionEvent") origin = "intervention";
    else if (causeType === "RainEvent" || causeType === "DroughtEvent") origin = "temperature";
  }
  if (origin === "intervention" && intensity >= 500)
    UI.lightningVisual = {
      tile: i,
      startedAt: performance.now(),
      until: performance.now() + 900,
      eventId: cause,
    };
  if (W.tiles.liquid[i] > 900) return false;
  const fuel = W.tiles.chem[C.FUEL][i] + W.tiles.chem[C.ORGANIC][i],
    oxid = W.tiles.chem[C.OXIDANT][i];
  if (fuel < 30 || oxid < 20) return false;
  if (W.tiles.fire[i] === 0) {
    const evidence = {
      lightning: "storm electricity supplied activation energy to a dry fuel bed",
      spread: "radiant heat crossed into an adjacent dry fuel bed",
      temperature: "measured temperature exceeded this world's combustion threshold",
      intervention: "an external heat intervention supplied activation energy",
      combustion: "stored chemical energy met oxidant above ignition conditions",
    };
    const ev = emitEvent("FireStartedEvent", {
      location: i,
      causes: cause ? [cause] : [],
      evidence: [evidence[origin] || evidence.combustion],
      magnitude: intensity,
      importance: 1,
      data: { origin, fuel, oxidant: oxid, moisture: +tileMoisture(i).toFixed(1) },
    });
    cause = ev.id;
  }
  const ignitionTemperature = (reactionById("combustion")?.minimumTemperature ?? 28) + 2,
    targetTemperature = Math.ceil(ignitionTemperature * 10),
    heat = Math.max(0, targetTemperature - W.tiles.temperature[i]) / 10;
  W.tiles.temperature[i] = i16(Math.max(W.tiles.temperature[i], targetTemperature));
  W.conservation.radiantInput += heat;
  W.conservation.thermalEnergy = (W.conservation.thermalEnergy || 0) + heat;
  W.tiles.fire[i] = u16(Math.max(W.tiles.fire[i], intensity));
  W.tiles.danger[i] = u16(W.tiles.danger[i] + intensity * 0.5);
  return true;
}
function updateSurfaceHydrology(i, weather) {
  const t = W.tiles,
    base = t.hydrologyBase[i] || 0;
  let excess = Math.max(0, t.liquid[i] - base);
  if (!excess) return;
  const raining = weather === "Rain" || weather === "Heavy Rain" || weather === "Storm",
    head = t.elevation[i] + Math.min(360, excess * 0.18);
  let target = -1,
    best = head;
  for (const n of neighbors4(i)) {
    const nBase = t.hydrologyBase[n] || 0,
      nHead = t.elevation[n] + Math.min(360, Math.max(0, t.liquid[n] - nBase) * 0.18);
    if (nHead + 2 < best || (nHead === best && n < target)) {
      target = n;
      best = nHead;
    }
  }
  if (target >= 0) {
    const drop = head - best,
      room = 65535 - t.liquid[target],
      flow = Math.min(
        excess,
        room,
        Math.max(1, Math.floor(excess * (raining ? 0.06 : 0.1) + drop * 0.025)),
      );
    t.liquid[i] -= flow;
    t.liquid[target] += flow;
  }
  excess = Math.max(0, t.liquid[i] - base);
  if (excess) {
    const rate = raining ? 0.18 : 0.32,
      infiltration = Math.min(
        excess,
        Math.max(1, Math.ceil(excess * rate) + Math.floor(t.soilOrder[i] / 650)),
      );
    t.liquid[i] -= infiltration;
  }
  excess = Math.max(0, t.liquid[i] - base);
  if (excess && !raining) {
    const intensity = Math.max(0.5, W.weather.intensity || 0.5),
      evapDepth = Math.min(
        excess,
        weather === "Drought"
          ? Math.max(2, Math.ceil(intensity * 4))
          : weather === "Heat Wave"
            ? Math.max(1, Math.ceil(intensity * 2))
            : 1,
      ),
      evapMass = Math.min(t.chem[C.SOLVENT][i], evapDepth * 2);
    t.liquid[i] -= evapDepth;
    t.chem[C.SOLVENT][i] -= evapMass;
    W.reservoirs.atmosphericSolvent += evapMass;
  }
}
// ── The sky breathes ─────────────────────────────────────────────────────────
// Rain fell from what the air held, and only a drought filled the air: the
// evaporation above takes depth and matter from a tile only while it stands
// above its natural waterline, so a lake at its level gave the sky nothing,
// and neither did wet ground. The hydrology probe on battery causal-origin
// read the air at 953 thousand at the start, 12 thousand by year six after
// three wet years had laid it on the ground, and near nothing for a hundred
// years after, filled by droughts alone; on battery ship-c the air read zero
// from year ten, and each rain year of the century after carried nothing.
// Meanwhile the plants drank the land (02): ship-c's land water fell from
// 1,241 thousand to 447 by year 110, its mean moisture from 56 to 20, three
// land tiles in five under the 16 photosynthesis needs, with the lake beside
// it holding 726 thousand nobody could reach. Now standing water breathes: in
// weather that is not rain or drought, a lake or sea tile above freezing gives
// the air a hundredth of the matter above what its depth accounts for each
// pass (the floor irrigation respects, so a lake keeps its level), twice that
// in a heat wave; and wet ground above fifty moisture gives back one a pass
// and one more for every ten above, so the land cannot flood without end. The rain then
// has something to carry, and what it lays on the land came from the lakes
// and goes back to them. Matter moves; none is made.
const BREATH_LAKE_RATE = 0.01,
  BREATH_LAND_FLOOR = 50,
  BREATH_LAND_STEP = 10;
function breatheSurfaceWater(i, weather) {
  if (
    weather === "Rain" ||
    weather === "Heavy Rain" ||
    weather === "Storm" ||
    weather === "Drought"
  )
    return 0;
  const t = W.tiles;
  if (t.temperature[i] < 0) return 0;
  const heat = weather === "Heat Wave" ? 2 : 1;
  let lift = 0;
  if (t.liquid[i] > WATER_DEPTH.SURFACE) {
    const spare = t.chem[C.SOLVENT][i] - t.liquid[i];
    if (spare > 0) lift = Math.min(spare, Math.ceil(spare * BREATH_LAKE_RATE) * heat);
  } else {
    const moisture = tileMoisture(i);
    if (moisture > BREATH_LAND_FLOOR)
      lift = Math.min(
        t.chem[C.SOLVENT][i],
        (1 + Math.floor((moisture - BREATH_LAND_FLOOR) / BREATH_LAND_STEP)) * heat,
      );
  }
  if (lift <= 0) return 0;
  const taken = takeTileMatter(i, C.SOLVENT, lift);
  W.reservoirs.atmosphericSolvent += taken;
  return taken;
}
// ── The land cools to its climate ────────────────────────────────────────────
// A drought warmed every tile by two tenths of a degree a pass and a heat wave
// by one, a fire by six for every packet it burned, and nothing ever cooled
// them: the seasons swing about the mean (46) and the diffusion (08) only
// spreads what is there. The hydrology probe read battery causal-origin's
// mean land temperature at 19 degrees in year one and 24 by year 18 on the
// code before this round, a third of a degree a year; at that pace the
// warm tiles pass the 48 degrees photosynthesis allows within the century,
// and the "thermal destruction" of the late game (22) was this heat. Every
// tile now remembers the climate it was made with, and each pass draws its
// temperature back toward that climate and the season's swing by a twentieth
// of the excess, so a heat-wave year stands about two degrees above the mean
// and a drought four, and a burned tile cools once the fire is out. A world
// saved before this remembers the climate it has when it is next stepped. The
// heat goes to the sky and is booked as dissipated.
const CLIMATE_RELAX = 0.05;
function ensureClimateBaseline(world = W) {
  const t = world?.tiles;
  if (!t || (t.climateBase && t.climateBase.length === world.tileCount)) return;
  t.climateBase = new Int16Array(world.tileCount);
  for (let i = 0; i < world.tileCount; i++)
    t.climateBase[i] = t.temperature[i] - (t.seasonOffset ? t.seasonOffset[i] : 0);
}
function coolTileToClimate(i) {
  const t = W.tiles,
    base = t.climateBase[i] + (t.seasonOffset ? t.seasonOffset[i] : 0),
    excess = t.temperature[i] - base;
  if (!excess) return 0;
  const step = Math.sign(excess) * Math.max(1, Math.round(Math.abs(excess) * CLIMATE_RELAX));
  t.temperature[i] = i16(t.temperature[i] - step);
  W.conservation.dissipatedEnergy += Math.abs(step);
  W.conservation.thermalEnergy = (W.conservation.thermalEnergy || 0) - step;
  return step;
}
function hydrologySummary() {
  if (!W) return null;
  ensureHydrologyBaseline(W);
  let baseline = 0,
    current = 0,
    excess = 0,
    maxExcess = 0,
    floodedLandTiles = 0;
  for (let i = 0; i < W.tileCount; i++) {
    const base = W.tiles.hydrologyBase[i] || 0,
      depth = W.tiles.liquid[i],
      extra = Math.max(0, depth - base);
    baseline += base;
    current += depth;
    excess += extra;
    if (extra > maxExcess) maxExcess = extra;
    if (base < 100 && extra > 120) floodedLandTiles++;
  }
  return {
    baseline,
    current,
    excess,
    maxExcess,
    floodedLandTiles,
    landFloodCoverage: floodedLandTiles / W.tileCount,
  };
}
// ── The sky is deep ───────────────────────────────────────────────────────────
// The air the tiles hold is all the air the world had, and the living loop
// does not return what it breathes: photosynthesis gives one oxidant for the
// two organic and one energy it makes, respiration takes one for the energy
// and the mineralizing of the waste it leaves takes one for two, and nothing
// rots on the ground to give any back. The ledger on battery variety-18 read
// it a year at a time: photosynthesis 7,000 units, respiration 6,000,
// mineralization 5,000, decomposition none, the tiles' oxidant falling from
// 2,335 thousand at year one to 1,415 thousand at 320, and under the press,
// where the world runs fuller, the death probe read "oxidant deprivation" on
// nearly every death from year 372, 21 to 87 a press, until thirteen people
// stood in no town at 726 (HANDOFF section 19). The gas fell the same way,
// 1,763 thousand to 1,120. A planet's air is not the film over its ground: it
// is deep, and the film exchanges with it. Every world now holds an
// atmospheric reservoir of oxidant and of gas, a few thousand a tile beside
// the six or seven hundred the tiles hold, and each tile in the substrate's
// row breathes against the world's own starting air: below it, the tile draws
// a twentieth of the shortfall from the reservoir; well above it, a twentieth
// of the excess returns. The reservoir is matter and the audit counts it; a
// world saved before this is given its sky when it is next stepped, and the
// gift is booked as the world's own. The reservoir outlasts the drain by
// thousands of years, which is the point: worlds that live to the gate should
// not suffocate on the way.
const SKY_DEPTH_OXIDANT = 6000,
  SKY_DEPTH_GAS = 4500,
  SKY_RATE = 0.05,
  SKY_SLACK = 1.25,
  SKY = { drawn: 0, returned: 0 };
function ensureSky(world = W) {
  if (!world?.tiles || !world.reservoirs) return;
  const n = world.tileCount;
  if (!world.skyBaseline) {
    let ox = 0,
      gas = 0;
    for (let i = 0; i < n; i++) {
      ox += world.tiles.chem[C.OXIDANT][i];
      gas += world.tiles.chem[C.GAS][i];
    }
    world.skyBaseline = {
      oxidant: Math.round(ox / Math.max(1, n)),
      gas: Math.round(gas / Math.max(1, n)),
    };
  }
  if (typeof world.reservoirs.atmosphericOxidant !== "number") {
    world.reservoirs.atmosphericOxidant = n * SKY_DEPTH_OXIDANT;
    world.reservoirs.atmosphericGas = n * SKY_DEPTH_GAS;
    // A world saved before the sky was deep is given its sky: the world's own matter, not the player's.
    if (world.conservation)
      world.conservation.initialMatter += n * (SKY_DEPTH_OXIDANT + SKY_DEPTH_GAS);
  }
}
function breatheSky(i) {
  const t = W.tiles,
    r = W.reservoirs,
    b = W.skyBaseline;
  for (const [sp, key, base] of [
    [C.OXIDANT, "atmosphericOxidant", b.oxidant],
    [C.GAS, "atmosphericGas", b.gas],
  ]) {
    const v = t.chem[sp][i];
    if (v < base) {
      const take = Math.min(r[key], Math.ceil((base - v) * SKY_RATE), 65535 - v);
      if (take > 0) {
        t.chem[sp][i] = u16(v + take);
        r[key] -= take;
        SKY.drawn += take;
      }
    } else if (v > base * SKY_SLACK) {
      const give = Math.ceil((v - base) * SKY_RATE);
      t.chem[sp][i] = u16(v - give);
      r[key] += give;
      SKY.returned += give;
    }
  }
}
function updatePhysicalSubstrate() {
  ensureClimateBaseline(W);
  ensureSky(W);
  const t = W.tiles,
    start = (W.tick % W.height) * W.width,
    end = start + W.width,
    weather = W.weather.name;
  for (let i = start; i < end; i++) {
    if (weather === "Rain" || weather === "Heavy Rain" || weather === "Storm") {
      const requested = Math.ceil(
          (weather === "Heavy Rain" ? 18 : weather === "Storm" ? 13 : 8) * W.weather.intensity,
        ),
        add = Math.min(requested, W.reservoirs.atmosphericSolvent, 65535 - t.chem[C.SOLVENT][i]);
      W.reservoirs.atmosphericSolvent -= add;
      t.chem[C.SOLVENT][i] += add;
      t.liquid[i] = u16(t.liquid[i] + add * 0.2);
      const quenched = Math.min(t.fire[i], add * 3);
      W.conservation.dissipatedEnergy += quenched;
      W.conservation.thermalEnergy = (W.conservation.thermalEnergy || 0) - quenched;
      t.fire[i] = u16(t.fire[i] - add * 3);
    } else if (weather === "Drought") {
      const loss = Math.min(t.chem[C.SOLVENT][i], Math.ceil(7 * W.weather.intensity));
      t.chem[C.SOLVENT][i] -= loss;
      W.reservoirs.atmosphericSolvent += loss;
      t.temperature[i] = i16(t.temperature[i] + 2);
      W.conservation.radiantInput += 2;
      W.conservation.thermalEnergy = (W.conservation.thermalEnergy || 0) + 2;
    } else if (weather === "Heat Wave") {
      t.temperature[i] = i16(t.temperature[i] + 1);
      W.conservation.radiantInput++;
      W.conservation.thermalEnergy = (W.conservation.thermalEnergy || 0) + 1;
    }
    updateSurfaceHydrology(i, weather);
    breatheSurfaceWater(i, weather);
    coolTileToClimate(i);
    breatheSky(i);
    if (t.fire[i] > 0) {
      const moisture = tileMoisture(i),
        requested = Math.max(1, Math.floor(t.fire[i] / 150)),
        burned = executeProcess(
          t.chem[C.FUEL][i] > 2 ? "combustion" : "organic_combustion",
          invTile(i),
          requested,
          { dissipate: 1 },
        ),
        protectedPlace = settlementNear(i, 5) || campNear(i, 5),
        suppression = (protectedPlace ? 44 : 0) + Math.min(14, t.habitation[i] / 60);
      if (burned) {
        t.temperature[i] = i16(t.temperature[i] + burned * 6);
        t.plantOrder[i] = u16(t.plantOrder[i] - burned * 10);
        t.soilOrder[i] = u16(t.soilOrder[i] - burned);
        t.structureOrder[i] = u16(t.structureOrder[i] - burned * 3);
        t.fire[i] = u16(t.fire[i] + burned * 1.5 - moisture * 0.2 - 14 - suppression);
        if (t.fire[i] > 230)
          for (const n of neighbors4(i)) {
            const nf = t.chem[C.FUEL][n] + t.chem[C.ORGANIC][n],
              nm = tileMoisture(n);
            if (
              nf < 130 ||
              nm > 58 ||
              t.liquid[n] > 500 ||
              t.fire[n] ||
              settlementNear(n, 4) ||
              campNear(n, 4) ||
              livingNearTile(n, 2)
            )
              continue;
            const chance = clamp(
              ((t.fire[i] - 180) / 1500) * (nf / 1900) * (1 - nm / 70),
              0,
              0.045,
            );
            if (counterRand("fire-spread", W.tick, n, i) < chance)
              queueEffect("IgniteTile", {
                tile: n,
                intensity: Math.max(110, Math.floor(t.fire[i] * 0.34)),
                causeEvent: W.causalIndex.tile[i] || 0,
                origin: "spread",
              });
          }
      } else t.fire[i] = u16(t.fire[i] - 28 - moisture * 0.08 - suppression);
    }
    if (
      t.temperature[i] > W.laws.combustionThreshold + 35 &&
      t.fire[i] === 0 &&
      tileMoisture(i) < 32 &&
      t.chem[C.FUEL][i] + t.chem[C.ORGANIC][i] > 240 &&
      !livingNearTile(i, 3) &&
      !settlementNear(i, 6) &&
      !campNear(i, 6) &&
      W.tick - (W.lastNaturalFireTick ?? -4096) > 2048
    ) {
      queueEffect("IgniteTile", {
        tile: i,
        intensity: 180,
        causeEvent: W.weather.cycleCause || 0,
        origin: "temperature",
      });
      W.lastNaturalFireTick = W.tick;
    }
  }
  if (W.tick % 64 === 0) {
    let burning = 0;
    for (const v of t.fire) if (v > 100) burning++;
    if (burning > Math.max(7, W.tileCount * 0.0015) && W.lastFireDisasterTick !== W.tick) {
      const causes = [];
      for (let n = W.events.length - 1; n >= 0 && causes.length < 3; n--)
        if (W.events[n].type === "FireStartedEvent") causes.push(W.events[n].id);
      emitEvent("FireDisasterEvent", {
        causes,
        evidence: [
          W.weather.name === "Drought"
            ? "drought concentrated combustible compounds"
            : "connected fuel beds carried combustion",
        ],
        magnitude: burning,
        importance: 3,
      });
      W.lastFireDisasterTick = W.tick;
    }
  }
}
window.ALIFE_SKY_DEBUG = Object.freeze({
  reservoirs: () => ({
    oxidant: W.reservoirs?.atmosphericOxidant,
    gas: W.reservoirs?.atmosphericGas,
    baseline: W.skyBaseline ? { ...W.skyBaseline } : null,
  }),
  flows: () => ({ ...SKY }),
  depth: { oxidant: SKY_DEPTH_OXIDANT, gas: SKY_DEPTH_GAS, rate: SKY_RATE, slack: SKY_SLACK },
});
