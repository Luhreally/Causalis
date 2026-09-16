// ═══════════════════════════════════════════════════════════════════════════
// 19. PLANT AND ECOLOGICAL SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════
function updatePlants() {
  const t = W.tiles,
    batch = 5,
    base = (Math.floor(W.tick / 8) * batch) % W.height;
  for (let oy = 0; oy < batch; oy++) {
    const y = (base + oy) % W.height;
    for (let x = 0; x < W.width; x++) {
      const i = y * W.width + x,
        temp = t.temperature[i] / 10,
        moist = tileMoisture(i),
        fert = tileFertility(i);
      if (t.fire[i] > 0 || (W.weather.name === "Drought" && moist < 15)) {
        if (t.plantOrder[i] > 0) {
          const loss = Math.min(t.plantOrder[i], Math.max(1, 3 + Math.floor((20 - moist) * 0.2)));
          t.plantOrder[i] -= loss;
          executeProcess("decomposition", invTile(i), Math.max(1, loss >> 3));
        }
        continue;
      }
      if (temp > -8 && temp < 48 && moist > 16 && fert > 10 && t.liquid[i] < 1600) {
        const photosynthesis = reactionById("photosynthesis"),
          possible = Math.max(1, Math.floor(((moist + fert) * W.laws.plantEfficiency) / 80)),
          made = executeProcess("photosynthesis", invTile(i), possible, {
            externalEnergy: photosynthesis?.externalEnergyRequirement || 0,
            externalFlux: W.laws.solarFlux,
            location: i,
          });
        if (made) t.plantOrder[i] = u16(t.plantOrder[i] + made * 2);
      }
      if (t.plantOrder[i] > 700 && counterRand("plant-spread", W.tick, i) < 0.045) {
        const ns = neighbors4(i),
          n = ns[Math.floor(counterRand("plant-neighbor", W.tick, i) * ns.length)];
        if (n != null && t.plantOrder[n] < t.plantOrder[i] * 0.45 && tileMoisture(n) > 18) {
          const move = Math.min(3, t.chem[C.ORGANIC][i], 65535 - t.chem[C.ORGANIC][n]);
          t.chem[C.ORGANIC][i] -= move;
          t.chem[C.ORGANIC][n] += move;
          t.plantOrder[n] = u16(t.plantOrder[n] + move);
        }
      }
    }
  }
}
function updateNichePrimaryProduction() {
  const centers = W.ecologicalStructures?.centers || [];
  for (const f of centers)
    if (f.type === TERRAIN_FEATURE.GEOTHERMAL) {
      const i = f.tile,
        flux = W.tiles.geothermal[i] || 0;
      if (flux < 120 || W.tiles.fire[i]) continue;
      const chemosynthesis = reactionById("chemosynthesis");
      const made = executeProcess("chemosynthesis", invTile(i), 1 + Math.floor(f.strength / 420), {
        externalEnergy: chemosynthesis?.externalEnergyRequirement || 0,
        externalFlux: Math.max(0.1, flux / 360),
        location: i,
      });
      if (made) W.tiles.plantOrder[i] = u16(W.tiles.plantOrder[i] + made * 2);
    }
}
