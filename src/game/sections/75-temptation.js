// ═══════════════════════════════════════════════════════════════════════════
// 75. TEMPTATION — courtship that leads somewhere, and affairs that happen
// ═══════════════════════════════════════════════════════════════════════════
// The social layer already had partners, affairs, discovery, jealousy, and
// revenge, but its gates were set where almost no one ever reached them: a
// standard world of a hundred and sixty adults formed one love bond in
// thirty-five years and no affair at all. Here courtship becomes a partnership
// once trust, affection, and attraction are all merely good rather than rare,
// and a partnered person is tempted by someone they are drawn to when their
// own bond is thin, their partner is far away or on campaign, or their nature
// is restless and bold; the devout resist. Everything downstream is unchanged:
// a witnessed affair still wounds, breaks bonds, breeds grudges and revenge,
// and names itself in a rival's story. Rendering only reads the world.
const LOVE_TRUST = 0.4,
  LOVE_AFFECTION = 0.3,
  LOVE_ATTRACTION = 0.4,
  AFFAIR_ATTRACTION = 0.45,
  AFFAIR_AFFECTION = 0.3,
  AFFAIR_CHANCE = 0.02;
function partnerAway(id) {
  const soc = W.components.social[id],
    partner = soc?.partnerId;
  if (!partner) return false;
  const p = W.components.position[id],
    q = W.components.position[partner];
  if (!p || !q) return true;
  if (dist2(p.x, p.y, q.x, q.y) > 144) return true;
  return !!W.components.campaign?.[partner];
}
function bondDissatisfaction(id) {
  const soc = W.components.social[id],
    bond = soc?.partnerId ? soc.relationships?.[soc.partnerId] : null;
  if (!bond) return 0.5;
  return clamp(1 - ((bond.affection || 0) * 0.6 + (bond.commitment || 0) * 0.4), 0, 1);
}
function affairOpportunity(initiatorId, otherId) {
  const initiator = W.components.social[initiatorId],
    relationship = initiator?.relationships?.[otherId],
    bond = initiator?.partnerId ? initiator.relationships?.[initiator.partnerId] : null;
  if (!initiator || !relationship || !bond) return 0;
  const traits = W.components.identity[initiatorId]?.traits || [];
  return clamp(
    (1 - (bond.commitment || 0)) * 0.4 +
      bondDissatisfaction(initiatorId) * 0.35 +
      (relationship.attraction || 0) * 0.25 +
      (partnerAway(initiatorId) ? 0.25 : 0) +
      (traits.includes("restless") ? 0.1 : 0) +
      (traits.includes("bold") ? 0.05 : 0) -
      (traits.includes("devout") ? 0.15 : 0),
    0,
    0.9,
  );
}
maybeStartAffair = function (initiatorId, otherId, sharedKin) {
  const initiator = ensureSocialEmotion(initiatorId),
    relationship = relationshipState(initiatorId, otherId),
    reciprocal = relationshipState(otherId, initiatorId);
  if (
    !initiator?.partnerId ||
    initiator.partnerId === otherId ||
    sharedKin ||
    !relationship ||
    !reciprocal ||
    affairBetween(initiatorId, otherId) ||
    !isAdultPerson(initiatorId) ||
    !isAdultPerson(otherId)
  )
    return;
  if (
    Math.min(relationship.attraction, reciprocal.attraction) <= AFFAIR_ATTRACTION ||
    Math.min(relationship.affection, reciprocal.affection) <= AFFAIR_AFFECTION
  )
    return;
  if (!initiator.relationships?.[initiator.partnerId]) {
    initiator.partnerId = 0;
    return;
  }
  const opportunity = affairOpportunity(initiatorId, otherId),
    cycle = Math.floor(W.tick / 64);
  if (opportunity < 0.35) return;
  if (counterRand("affair-opportunity", cycle, initiatorId, otherId) < opportunity * AFFAIR_CHANCE)
    startAffair(initiatorId, otherId);
};
// Courtship becomes a partnership when the three measures are all good.
const updateRelationshipPairTemptationBase = updateRelationshipPair;
updateRelationshipPair = function (id, otherId) {
  updateRelationshipPairTemptationBase(id, otherId);
  const a = W.components.social[id],
    b = W.components.social[otherId];
  if (!a || !b || a.partnerId || b.partnerId) return;
  if (a.kinGroupId && a.kinGroupId === b.kinGroupId) return;
  if (!isAdultPerson(id) || !isAdultPerson(otherId)) return;
  const ar = a.relationships?.[otherId],
    br = b.relationships?.[id];
  if (!ar || !br) return;
  if (
    Math.min(ar.trust, br.trust) > LOVE_TRUST &&
    Math.min(ar.affection, br.affection) > LOVE_AFFECTION &&
    Math.min(ar.attraction, br.attraction) > LOVE_ATTRACTION
  )
    formLoveBond(id, otherId);
};
// ── Chronicle ──────────────────────────────────────────────────────────────────
const eventSentenceTemptationBase = eventSentence;
eventSentence = function (e) {
  const names = (e.subjects || []).map((id) => entityName(id));
  switch (e.type) {
    case "LoveBondEvent":
      return names.length >= 2
        ? `${names[0]} and ${names[1]} became partners.`
        : eventSentenceTemptationBase(e);
    case "BetrayalEvent":
      return names.length >= 3
        ? `${names[0]} began an affair with ${names[1]} behind ${names[2]}'s back.`
        : eventSentenceTemptationBase(e);
    case "CheatingDiscoveredEvent":
      return names.length >= 3
        ? `${names[2]} caught ${names[0]} with ${names[1]}.`
        : eventSentenceTemptationBase(e);
    case "RelationshipBrokenEvent":
      return names.length >= 2
        ? `${names[0]} and ${names[1]} parted${e.data?.reason ? `: ${e.data.reason}` : ""}.`
        : eventSentenceTemptationBase(e);
    default:
      return eventSentenceTemptationBase(e);
  }
};
window.ALIFE_TEMPTATION_DEBUG = Object.freeze({
  opportunity: (a, b) => affairOpportunity(a, b),
  away: (id) => partnerAway(id),
  dissatisfaction: (id) => bondDissatisfaction(id),
  affair: (a, b) => startAffair(a, b),
  tempt: (a, b) => maybeStartAffair(a, b, false),
  court: (a, b) => updateRelationshipPair(a, b),
  gates: () => ({
    LOVE_TRUST,
    LOVE_AFFECTION,
    LOVE_ATTRACTION,
    AFFAIR_ATTRACTION,
    AFFAIR_AFFECTION,
    AFFAIR_CHANCE,
  }),
});
