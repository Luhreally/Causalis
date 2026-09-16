// ═══════════════════════════════════════════════════════════════════════════
// 19. PLANT AND ECOLOGICAL SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════
// ── Litter rots ──────────────────────────────────────────────────────────────
// Decomposition ran on the dead of a drought and on corpses and nowhere else,
// so what fell to the ground lay there: once the water, the heat and the
// nutrient were mended (02, 17, 21) the world greened and locked its carbon.
// The hydrology probe read battery causal-origin's tile organic climbing from
// 1,215 thousand to 2,125 thousand by year 100 and its gas falling from 1,681
// thousand to 377; ship-c's gas from 1,600 thousand to 124 by year 110.
// Photosynthesis takes two gas a unit and would have stopped within a decade
// or two more, and the plants with it. Now the litter above a floor rots, a
// unit for every five hundred above it at each pass of the plant update, by
// the balanced decomposition of 02 (two organic and an oxidant to a nutrient,
// a solvent and a gas), so the ground gives back what the plants took as fast
// as it piles up and no faster. The rot does not eat a tile's structure and its
// heat is booked as dissipated, not laid on the ground. Matter moves; none is
// made.
const LITTER_FLOOR = 600,
  LITTER_PER_UNIT = 500;
let litterHeat = 0;
function rotLitter(i) {
  const t = W.tiles,
    excess = t.chem[C.ORGANIC][i] - LITTER_FLOOR;
  if (excess <= 0) return 0;
  if (!litterHeat) litterHeat = Math.max(0, -(reactionById("decomposition")?.chemicalEnergyDelta || 0));
  const quiet = { ...invTile(i), structure: () => {} };
  return executeProcess("decomposition", quiet, Math.ceil(excess / LITTER_PER_UNIT), {
    dissipate: litterHeat,
    location: i,
  });
}
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
      rotLitter(i);
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
