const experimentalFeedBase = modernFeedTheEffort;
modernFeedTheEffort = function (pushes) {
  const fed = experimentalFeedBase(pushes);
  for (const s of worldTowns()) {
    if (!cityStage(s)) continue;
    const outlook = foodOutlook(s);
    if (!outlook?.famine) continue;
    const want = Math.min(65535, seedReserve(s) + Math.ceil(outlook.pop * 12));
    const actual = Math.max(0, want - (s.inventory[C.ORGANIC] || 0));
    if (actual) {
      s.inventory[C.ORGANIC] += actual;
      causalPushInput(actual);
      s.causalReliefUntil = W.tick + 256;
      CONTINUING.relief = (CONTINUING.relief || 0) + actual;
    }
  }
  return fed;
};
const experimentalBirthBase = concertedBirthHaste;
concertedBirthHaste = function (id, life) {
  const pace = experimentalBirthBase(id, life), town = pace > 1 ? homeSettlementOf(id) : null;
  if (town?.causalReliefUntil > W.tick) {
    CONTINUING.reliefPaced = (CONTINUING.reliefPaced || 0) + 1;
    return Math.min(1, pace);
  }
  return pace;
};
