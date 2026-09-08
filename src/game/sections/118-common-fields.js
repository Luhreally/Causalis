// ═══════════════════════════════════════════════════════════════════════════
// 118. COMMON FIELDS — neighbours reap what would rot and sow what lies bare
// ═══════════════════════════════════════════════════════════════════════════
// A field belonged to one town and only that town's people worked it. The town
// plan laid fields up to thirteen tiles from a sprawling centre, beyond the
// nine tiles its own hands ranged over, and a town of five that had planned
// fields for twenty left them ripe for years while the people of the next
// village, three tiles from the crop, went hungry. The late-game ledgers showed
// twenty ripe fields standing unharvested with a third of the world hungry. Now
// a farm hand whose own town's fields want nothing reaps a ripe field of any
// town not at war with theirs within six tiles and carries the crop home, and
// sows a bare one from their own seed when the stores hold seed to spare; a
// fallen town's standing farms are reaped the same way. Fields are also laid
// no farther than seven tiles from the centre, within the reach of the hands
// that must work them.
const COMMON_FIELD_REACH = 6,
  COMMON_FIELD_SOW_SPARE = 2,
  COMMON_FIELD_REST = 64,
  COMMON_FIELDS = { reaped: 0, sown: 0, walks: 0 };
function commonFieldCandidates(workerId, own) {
  const p = W.components.position[workerId],
    soc = W.components.social[workerId];
  if (!p) return [];
  const out = [],
    seed = own.inventory?.[C.ORGANIC] || 0;
  for (const b of W.buildings) {
    if (b.type !== "farm" || !b.complete || b.ruined || b.placeKind !== "settlement" || b.placeId === own.id) continue;
    const d = Math.max(Math.abs(b.x - p.x), Math.abs(b.y - p.y));
    if (d > COMMON_FIELD_REACH) continue;
    const town = W.settlements.find((s) => s.id === b.placeId);
    if (town && !town.ruined && town.factionId && soc?.factionId && town.factionId !== soc.factionId && typeof personIsHostileVisitor === "function" && personIsHostileVisitor(workerId, town.factionId)) continue;
    const field = cultivatedField(b);
    if (!field) continue;
    // A fallen town's standing farm is reaped, never sown.
    if (b.abandoned && field.stage !== "ripe") continue;
    if (field.stage === "ripe" && W.tick >= (field.harvestBlockedUntil || 0)) out.push({ b, field, rank: 0, d });
    else if (field.stage === "fallow" && W.tick - (field.lastLaborTick || 0) >= COMMON_FIELD_REST && seed >= (field.tiles?.length || 9) * COMMON_FIELD_SOW_SPARE) out.push({ b, field, rank: 1, d });
  }
  return out.sort((a, c) => a.rank - c.rank || a.d - c.d || a.b.id - c.b.id);
}
const performFarmLaborCommonBase = performFarmLabor;
performFarmLabor = function (workerId) {
  if (performFarmLaborCommonBase(workerId)) return true;
  if (W.kind[workerId] !== KINDS.PERSON || !classifyAlive(workerId)) return false;
  const own = nearestFriendlyPlace(workerId);
  if (!own?.knownProcesses) return false;
  const pick = commonFieldCandidates(workerId, own)[0];
  if (!pick) return false;
  const access = farmLaborAccessTile(workerId, pick.b),
    p = W.components.position[workerId];
  if (!access) return false;
  const ripe = pick.field.stage === "ripe";
  if (Math.max(Math.abs(p.x - access.x), Math.abs(p.y - access.y)) > 0) {
    COMMON_FIELDS.walks++;
    return moveWorkerToward(workerId, idx(access.x, access.y), ripe ? "harvest" : "sow", `${ripe ? "🧺 going to reap" : "🌱 going to sow"} a neighbour's ${pick.b.name}`, C.ORGANIC, pick.b.id);
  }
  if (ripe) {
    const ok = harvestCultivatedField(workerId, pick.field, own);
    if (ok) {
      COMMON_FIELDS.reaped++;
      W.components.life[workerId].behaviorReason = `reaped a neighbour's ${pick.b.name} and carried the crop to ${own.name}`;
    }
    return ok;
  }
  const ok = sowCultivatedField(workerId, pick.field, own);
  if (ok) {
    COMMON_FIELDS.sown++;
    W.components.life[workerId].behaviorReason = `sowed a neighbour's ${pick.b.name} from the seed of ${own.name}`;
  }
  return ok;
};
window.ALIFE_COMMON_FIELDS_DEBUG = Object.freeze({
  candidates: (id) => {
    const own = nearestFriendlyPlace(id);
    return own?.knownProcesses ? commonFieldCandidates(id, own).map((c) => ({ building: c.b.id, town: c.b.placeId, stage: c.field.stage, d: c.d })) : [];
  },
  work: (id) => performFarmLabor(id),
  counts: () => ({ ...COMMON_FIELDS }),
  reset: () => {
    for (const k of Object.keys(COMMON_FIELDS)) COMMON_FIELDS[k] = 0;
  },
});
