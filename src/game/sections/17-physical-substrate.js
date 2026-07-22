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
  const heat = Math.max(0, 300 - W.tiles.temperature[i]) / 14;
  W.tiles.temperature[i] = i16(W.tiles.temperature[i] + heat * 10);
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
function updatePhysicalSubstrate() {
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
