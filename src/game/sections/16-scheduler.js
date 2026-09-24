// ═══════════════════════════════════════════════════════════════════════════
// 16. SCHEDULER AND FIXED-TICK CLOCK
// ═══════════════════════════════════════════════════════════════════════════
function simTick() {
  if (!W) return;
  W.tick++;
  updateWeatherCycle();
  updateEnvironmentalFields();
  updatePhysicalSubstrate();
  updateArtificialLife();
  resolveEffects();
  if (W.tick % 8 === 0) {
    updatePlants();
    updateNichePrimaryProduction();
    updateReproduction();
    updateDiseaseAndDecay();
    resolveEffects();
  }
  if (W.tick % 16 === 0) updateCampaignOrders();
  if (W.tick % 32 === 0) {
    updateSettlements();
    updateCohorts();
    updateTerritoryCulture();
    updateMigration();
    resolveEffects();
  }
  if (W.tick % 128 === 0) {
    updateBiosphereResilience();
    updateFactions();
    updateDiplomacyAndWar();
    updateTechnology();
    classifySpecies();
    updateHistoricalSignificance();
    recordStatistics();
    resolveEffects();
  }
  commitDerivedCaches();
  if (W.tick % 1024 === 0) updateLongEpoch();
  if (W.tick % autosaveCadence() === 0) queueAutosave();
  // No yearly world hash here: nothing in the world reads it, and walking all
  // of W was the year tick's stall (45-80 ms on a grown world, 38 of it in the
  // social store). Saves, loads and the top bar take their own.
  rebuildSpatialBins();
}
function stepTicks(n) {
  UI.clockInterrupted = false;
  for (let i = 0; i < n; i++) {
    simTick();
    if (UI.clockInterrupted) break;
  }
  refreshUI(true);
}
