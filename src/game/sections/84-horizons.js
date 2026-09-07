// ═══════════════════════════════════════════════════════════════════════════
// 84. HORIZONS — the gates of history fit the size of the world
// ═══════════════════════════════════════════════════════════════════════════
// The urban stage asked every world for a town of twenty-four or a polity of
// thirty-two, and a Civic hall cost the same on a battery-saver map as on a
// grand one. A world of seventy-two by forty-four tiles holds thirty to fifty
// people in all; its towns are five and ten strong, so the hall took a century
// and the urban stage never came. The thresholds of history now scale with
// the map, as the caps already do in the other direction: on the smallest
// worlds a town of ten or a polity of thirteen is metropolitan, the civic
// buildings ask for proportionally less common material and labour (their
// rare inputs unchanged), prospectors leave from smaller towns, and the
// buildings that gate a stage are worked with priority. Standard and larger
// worlds keep their original numbers.
const HORIZON_MIN_SCALE = 0.35,
  HORIZON_CIVIC_TYPES = new Set([
    "hall",
    "archive",
    "clinic",
    "observatory",
    "launch_tower",
    "waterworks",
    "forge",
  ]),
  HORIZON_RARE = () => new Set([C.INFO, C.PIGMENT, C.CRYSTAL, C.CATALYST]);
function worldScale(world = W) {
  if (!world?.width || !world?.height) return 1;
  return clamp(Math.sqrt((world.width * world.height) / (180 * 110)), HORIZON_MIN_SCALE, 2.2);
}
function smallWorldFactor(world = W) {
  return Math.min(1, worldScale(world));
}
// The population that makes a town metropolitan, scaled to the world.
function urbanGate(world = W) {
  const k = smallWorldFactor(world);
  return { local: Math.max(8, Math.round(24 * k)), network: Math.max(12, Math.round(32 * k)) };
}
function metropolitan(s, buildings = completedBuildings(s)) {
  const gate = urbanGate(),
    pop = settlementPopulation(s);
  return (
    pop >= gate.local ||
    (!!s.factionId && factionNetworkPopulation(s) >= gate.network && buildings.length >= 8)
  );
}
settlementDevelopmentStage = function (s) {
  const buildings = completedBuildings(s),
    types = new Set(buildings.map((b) => b.type)),
    tech = new Set(s.knownProcesses);
  if (tech.has("planetary_stewardship") && tech.has("mechanization") && types.has("waterworks"))
    return "complex terrestrial";
  if (
    metropolitan(s, buildings) &&
    types.has("hall") &&
    types.has("clinic") &&
    buildings.length >= 8
  )
    return "urban";
  if (s.factionId && types.has("hall") && (tech.has("governance") || tech.has("writing")))
    return "civic";
  return "village";
};
const settlementStageShortfallHorizonBase = settlementStageShortfall;
settlementStageShortfall = function (s, target) {
  const missing = settlementStageShortfallHorizonBase(s, target).filter(
    (m) => !/^local population/.test(m),
  );
  if (target === "urban" && !metropolitan(s)) {
    const gate = urbanGate();
    missing.push(
      `local population ${settlementPopulation(s)}/${gate.local} or faction network ${factionNetworkPopulation(s)}/${gate.network}`,
    );
  }
  return missing;
};
const civilizationGateStatusHorizonBase = civilizationGateStatus;
civilizationGateStatus = function () {
  const status = civilizationGateStatusHorizonBase();
  if (status?.requirement && status.next === "urban") {
    const gate = urbanGate();
    status.requirement = status.requirement.replace(
      "24 local or 32 faction-network people",
      `${gate.local} local or ${gate.network} faction-network people`,
    );
  }
  return status;
};
const causalSkipMicroStagesHorizonBase = causalSkipMicroStages;
causalSkipMicroStages = function () {
  return causalSkipMicroStagesHorizonBase().map((stage) => {
    if (stage.key !== "metro") return stage;
    const gate = urbanGate();
    return {
      ...stage,
      label: `a metropolitan population (${gate.local} local or ${gate.network} across the polity)`,
      done: () => W.settlements.some((s) => !s.ruined && metropolitan(s)),
    };
  });
};
// Civic buildings cost proportionally less common material on small worlds;
// their rare inputs are unchanged.
const buildingRequirementsHorizonBase = buildingRequirements;
buildingRequirements = function (place, type) {
  const raw = buildingRequirementsHorizonBase(place, type),
    k = smallWorldFactor();
  if (k >= 1 || !HORIZON_CIVIC_TYPES.has(type)) return raw;
  const rare = HORIZON_RARE(),
    factor = Math.max(0.55, k);
  return raw.map(([sp, n]) => [sp, rare.has(sp) ? n : Math.max(4, Math.ceil(n * factor))]);
};
// Prospectors leave from smaller towns on smaller worlds. (Settlers keep the
// standard minimum of twelve: on a tiny map, splitting a town of six only
// dilutes the labour a hall needs.)
function settlerMinimum() {
  return 12;
}
considerProspecting = function () {
  if (typeof eligibleResearchMaterialNeeds !== "function") return;
  const far = PROSPECT_MATERIALS(),
    minimum = Math.max(3, Math.round(6 * smallWorldFactor()));
  for (const place of W.settlements) {
    if (place.ruined || !place.knownProcesses || settlementPopulation(place) < minimum) continue;
    let sent = false;
    for (const need of eligibleResearchMaterialNeeds(place))
      if (launchProspector(place, need.sp)) {
        sent = true;
        break;
      }
    if (sent) continue;
    for (const [sp, short] of buildingMaterialWants(place))
      if (far.includes(sp) && (place.inventory?.[sp] || 0) < short && launchProspector(place, sp))
        break;
  }
};
// The buildings that gate a stage are worked with priority.
const ensurePlacePlansHorizonBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansHorizonBase(place);
  if (!place?.knownProcesses || place.ruined) return;
  const k = smallWorldFactor();
  for (const b of activeBuildings(place)) {
    if (!HORIZON_CIVIC_TYPES.has(b.type)) continue;
    if ((b.priority || 0) < 4) b.priority = 4;
    // Less labour too, on small worlds: a town of six cannot raise a hall
    // sized for a town of sixty.
    if (k < 1 && !b.horizonScaled && b.workRequired > 0) {
      b.workRequired = Math.max(24, Math.ceil(b.workRequired * Math.max(0.55, k)));
      b.horizonScaled = true;
    }
  }
};
window.ALIFE_HORIZON_DEBUG = Object.freeze({
  scale: () => worldScale(),
  gate: () => urbanGate(),
  metropolitan: (settlementId) => metropolitan(W.settlements.find((s) => s.id === settlementId)),
  settlerMinimum: () => settlerMinimum(),
  requirements: (placeId, type) =>
    buildingRequirements(
      W.settlements.find((s) => s.id === placeId) || W.camps.find((c) => c.id === placeId),
      type,
    ).map(([sp, n]) => [W.definitions.species[sp].name, n]),
});
