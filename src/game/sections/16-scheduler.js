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
  if (W.tick % 100 === 0) worldHash();
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
