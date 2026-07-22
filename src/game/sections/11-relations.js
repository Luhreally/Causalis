// ═══════════════════════════════════════════════════════════════════════════
// 11. RELATIONS GRAPH
// ═══════════════════════════════════════════════════════════════════════════
function addRelation(from, to, type, weight = 1, eventId = 0) {
  if (!from || !to || (from === to && type !== "owns")) return null;
  const exists = (W.relations.byEntity[from] || []).some((i) => {
    const e = W.relations.edges[i];
    return e && e.from === from && e.to === to && e.type === type;
  });
  if (exists) return null;
  const edge = {
      id: W.relations.edges.length + 1,
      from,
      to,
      type,
      weight: +weight.toFixed(3),
      createdTick: W.tick,
      eventId,
    },
    index = W.relations.edges.length;
  W.relations.edges.push(edge);
  (W.relations.byEntity[from] || (W.relations.byEntity[from] = [])).push(index);
  (W.relations.byEntity[to] || (W.relations.byEntity[to] = [])).push(index);
  return edge;
}
function removeRelation(from, to, type) {
  for (const i of W.relations.byEntity[from] || []) {
    const e = W.relations.edges[i];
    if (e && e.from === from && e.to === to && e.type === type) {
      W.relations.edges[i] = null;
      return true;
    }
  }
  return false;
}
function relationsOf(id, type = null) {
  const r = [];
  for (const i of W.relations.byEntity[id] || []) {
    const e = W.relations.edges[i];
    if (e && (!type || e.type === type)) r.push(e);
  }
  return r;
}
function linkKin(parent, child, eventId) {
  addRelation(parent, child, "parent_of", 1, eventId);
  addRelation(child, parent, "child_of", 1, eventId);
  addRelation(child, parent, "descends_from", 1, eventId);
  for (const sibling of W.components.identity[parent]?.children || [])
    if (sibling !== child) {
      addRelation(child, sibling, "kin_of", 0.8, eventId);
      addRelation(sibling, child, "kin_of", 0.8, eventId);
    }
}
