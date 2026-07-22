// ═══════════════════════════════════════════════════════════════════════════
// 9. ENTITY ALLOCATOR
// ═══════════════════════════════════════════════════════════════════════════
function allocEntity(kind) {
  const id = W.nextEntityId++;
  W.activeIds.push(id);
  W.kind[id] = kind;
  return id;
}
function removeEntity(id) {
  const p = W.activeIds.indexOf(id);
  if (p >= 0) W.activeIds.splice(p, 1);
  delete W.kind[id];
  for (const store of Object.values(W.components)) delete store[id];
  if (UI.followId === id) UI.followId = 0;
  if (UI.selectedEntity === id) UI.selectedEntity = 0;
}
function entitiesOf(kind, aliveOnly = false) {
  const r = [];
  for (const id of W.activeIds)
    if (W.kind[id] === kind && (!aliveOnly || classifyAlive(id))) r.push(id);
  return r;
}
function entityAtTile(i, kinds = null) {
  const [x, y] = xy(i),
    r = [];
  for (const id of W.spatialBins[i] || []) {
    if (!kinds || kinds.includes(W.kind[id])) r.push(id);
  }
  return r;
}
