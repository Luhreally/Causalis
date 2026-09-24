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
