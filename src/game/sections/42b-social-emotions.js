// ================================================================
// 42B. CAUSAL EMOTIONS, RELATIONSHIPS, BETRAYAL, AND REVENGE
// ================================================================
// Emoji are a compact lens over measured state, never a random decoration.
// Every displayed emotion is backed by needs, a relationship, or an event.

const EMOTION_SEMANTICS = Object.freeze({
    critical: { emoji: "😵", label: "critical bodily distress and failing regulation" },
    agony: { emoji: "😖", label: "acute pain, blood loss, or disabling injury" },
    love: { emoji: "❤️", label: "bonded affection" },
    affection: { emoji: "💞", label: "growing affection" },
    heartbreak: { emoji: "💔", label: "betrayal or separation" },
    anger: { emoji: "😡", label: "anger from remembered harm" },
    grief: { emoji: "😢", label: "grief for a lost bond" },
    fear: { emoji: "😨", label: "fear from danger or trauma" },
    jealousy: { emoji: "😠", label: "jealousy from a threatened bond" },
    revenge: { emoji: "😤", label: "resolved retaliation" },
    contentment: { emoji: "😌", label: "needs met and socially secure" },
  }),
  FUNCTION_EMOJI = Object.freeze({
    firefight: "🪣",
    fill_bucket: "💧",
    sail: "⛵",
    muster: "📯",
    form: "🫡",
    march: "🥾",
    fight: "⚔️",
    guard: "🛡️",
    withdraw: "↩️",
    craft: "🛠️",
    build: "🔨",
    gather: "🧺",
    haul: "📦",
    heal: "🩹",
    sow: "🌱",
    tend: "🌾",
    harvest: "🧺",
    herd: "🐑",
    predator_defense: "🛡️",
  });

function defaultEmotionState() {
  return {
    schema: 1,
    affection: 0,
    anger: 0,
    sadness: 0,
    fear: 0,
    jealousy: 0,
    resolve: 0,
    contentment: 0.5,
    dominant: "contentment",
    emoji: EMOTION_SEMANTICS.contentment.emoji,
    causeEvent: 0,
    updatedTick: W?.tick || 0,
  };
}

function ensureSocialEmotion(id) {
  const social = W?.components.social?.[id];
  if (!social) return null;
  social.relationships = social.relationships || {};
  social.affairs = Array.isArray(social.affairs) ? social.affairs : [];
  social.betrayedBy = Array.isArray(social.betrayedBy) ? social.betrayedBy : [];
  social.revengeTargetId ||= 0;
  social.revengeCauseEvent ||= 0;
  if (social.emotion?.schema !== 1)
    social.emotion = { ...defaultEmotionState(), ...(social.emotion || {}), schema: 1 };
  return social;
}

function relationshipState(id, otherId) {
  const social = ensureSocialEmotion(id),
    other = ensureSocialEmotion(otherId);
  if (!social || !other || id === otherId) return null;
  const knownTrust = Number(social.trust?.[otherId]),
    sharedKin = social.kinGroupId && social.kinGroupId === other.kinGroupId,
    sharedFaction = social.factionId && social.factionId === other.factionId,
    seedTrust = Number.isFinite(knownTrust)
      ? clamp(knownTrust, 0, 1)
      : clamp(0.18 + (sharedKin ? 0.3 : 0) + (sharedFaction ? 0.12 : 0), 0, 0.72);
  return (
    social.relationships[otherId] ||
    (social.relationships[otherId] = {
      familiarity: sharedKin ? 0.64 : sharedFaction ? 0.24 : 0.08,
      trust: seedTrust,
      affection: sharedKin ? 0.48 : 0.08,
      attraction: 0,
      commitment: 0,
      grievance: 0,
      jealousy: 0,
      betrayal: 0,
      lastInteractionTick: -1,
      lastEventId: 0,
      bonded: false,
      affair: false,
      knownAffair: false,
    })
  );
}

function socialChemistry(id, otherId) {
  const a = W.components.reproduction[id],
    b = W.components.reproduction[otherId],
    preferenceFit = 1 - Math.abs((a?.matePreference ?? 0.5) - (b?.matePreference ?? 0.5)),
    stableVariation =
      (hashParts(W.seedHash, "social-chemistry", Math.min(id, otherId), Math.max(id, otherId)) >>>
        0) /
      4294967295;
  return clamp(preferenceFit * 0.58 + stableVariation * 0.42, 0, 1);
}

function setEmotionImpulse(id, values, causeEvent = 0, glyph = "") {
  const social = ensureSocialEmotion(id);
  if (!social) return;
  const emotion = social.emotion;
  for (const [key, delta] of Object.entries(values))
    if (Number.isFinite(emotion[key])) emotion[key] = clamp(emotion[key] + delta, 0, 1);
  if (causeEvent) emotion.causeEvent = causeEvent;
  emotion.updatedTick = W.tick;
  const meaning = emotionMeaning(id);
  emotion.dominant = meaning.key;
  emotion.emoji = meaning.emoji;
  if (glyph)
    UI.emotionVisuals = (UI.emotionVisuals || [])
      .filter((item) => item.world === W && W.tick - item.tick < 96)
      .concat({ world: W, id, glyph, tick: W.tick, causeEvent });
}

function emotionMeaning(id) {
  const social = W.components.social[id],
    life = W.components.life[id];
  if (!social?.emotion || !life)
    return { key: "contentment", ...EMOTION_SEMANTICS.contentment, value: 0.5 };
  const structuralHealth = clamp(
      Math.min(Number.isFinite(life.health) ? life.health : 100, life.integrity / 10),
      0,
      100,
    ),
    openWounds = (life.wounds || []).filter((wound) => !wound.healedTick),
    bleeding = sum(openWounds.map((wound) => wound.bleed || 0)),
    amputationPain = life.anatomy?.parts
      ? Math.max(
          0,
          ...Object.values(life.anatomy.parts)
            .filter((part) => part.severed && Number.isFinite(part.lostTick))
            .map((part) => clamp(1 - (W.tick - part.lostTick) / 768, 0, 1) * 0.74),
        )
      : 0,
    criticalDistress = clamp(
      Math.max(
        (32 - structuralHealth) / 28,
        (320 - life.integrity) / 300,
        (240 - life.regulation) / 220,
        bleeding / 18,
      ),
      0,
      1.5,
    ),
    acutePain = clamp(Math.max((life.pain || 0) / 72, bleeding / 12, amputationPain), 0, 1.25);
  if (criticalDistress >= 0.42)
    return {
      key: "critical",
      ...EMOTION_SEMANTICS.critical,
      value: clamp(0.58 + criticalDistress * 0.36, 0, 1),
    };
  if (acutePain >= 0.52)
    return {
      key: "agony",
      ...EMOTION_SEMANTICS.agony,
      value: clamp(0.46 + acutePain * 0.42, 0, 1),
    };
  const emotion = social.emotion,
    partner = social.partnerId ? relationshipState(id, social.partnerId) : null,
    candidates = [
      ["heartbreak", Math.max(emotion.jealousy, partner?.betrayal || 0) * (emotion.sadness + 0.35)],
      ["revenge", emotion.resolve * emotion.anger],
      ["anger", emotion.anger],
      ["grief", emotion.sadness],
      ["fear", emotion.fear],
      ["jealousy", emotion.jealousy],
      ["love", partner?.bonded ? partner.affection * partner.commitment : 0],
      ["affection", partner?.affection || emotion.affection],
      ["contentment", emotion.contentment],
    ].sort((left, right) => right[1] - left[1]);
  const [key, value] = candidates[0];
  if (value < 0.05)
    return {
      key: "contentment",
      ...EMOTION_SEMANTICS.contentment,
      value: clamp(emotion.contentment || 0, 0, 1),
    };
  return { key, ...EMOTION_SEMANTICS[key], value };
}

function updateMeasuredEmotion(id) {
  const social = ensureSocialEmotion(id),
    life = W.components.life[id],
    position = W.components.position[id];
  if (!social || !life || !position) return;
  const state = social.emotion,
    tile = idx(position.x, position.y),
    partner = social.partnerId ? relationshipState(id, social.partnerId) : null,
    needs = derivedLife(id),
    activeBleeding = sum(
      (life.wounds || []).filter((wound) => !wound.healedTick).map((wound) => wound.bleed || 0),
    ),
    physicalDistress = clamp(
      ((needs.hunger || 0) + (needs.thirst || 0) + (needs.fatigue || 0) + (life.pain || 0)) / 360,
      0,
      1,
    ),
    danger = clamp(W.tiles.danger[tile] / 1100 + W.tiles.fire[tile] / 900, 0, 1),
    secureBond = partner ? partner.trust * partner.commitment : 0;
  state.anger = clamp(
    state.anger * 0.992 + Math.max(0, (social.resentment || 0) - 0.55) * 0.006,
    0,
    1,
  );
  state.sadness = clamp(state.sadness * 0.996, 0, 1);
  state.jealousy = clamp(state.jealousy * 0.991 + (partner?.jealousy || 0) * 0.004, 0, 1);
  state.resolve = clamp(state.resolve * (social.revengeTargetId ? 0.999 : 0.984), 0, 1);
  state.fear = clamp(state.fear * 0.985 + danger * 0.035 + (life.trauma || 0) / 8000, 0, 1);
  state.affection = clamp(state.affection * 0.995 + (partner?.affection || 0) * 0.005, 0, 1);
  state.contentment = clamp(
    0.72 - physicalDistress * 0.62 - state.sadness * 0.34 - state.anger * 0.24 + secureBond * 0.34,
    0,
    1,
  );
  if (needs.health < 34 || life.integrity < 340 || activeBleeding > 7) state.contentment = 0;
  const meaning = emotionMeaning(id);
  state.dominant = meaning.key;
  state.emoji = meaning.emoji;
  state.updatedTick = W.tick;
}

function relationshipEvidence(id, otherId, relationship) {
  const a = ensureSocialEmotion(id),
    b = ensureSocialEmotion(otherId);
  return [
    `familiarity ${relationship.familiarity.toFixed(2)}, trust ${relationship.trust.toFixed(2)}, affection ${relationship.affection.toFixed(2)}`,
    a.kinGroupId === b.kinGroupId
      ? "shared kinship supplied an existing attachment"
      : a.factionId && a.factionId === b.factionId
        ? "repeated life in one community supplied familiarity"
        : "repeated proximity supplied familiarity across social boundaries",
  ];
}

function formLoveBond(id, otherId) {
  const a = ensureSocialEmotion(id),
    b = ensureSocialEmotion(otherId),
    ar = relationshipState(id, otherId),
    br = relationshipState(otherId, id);
  if (!a || !b || !ar || !br || a.partnerId || b.partnerId) return null;
  a.partnerId = otherId;
  b.partnerId = id;
  ar.bonded = br.bonded = true;
  ar.commitment = br.commitment = clamp(
    (ar.trust + br.trust + ar.affection + br.affection) / 4,
    0.45,
    0.95,
  );
  addRelation(id, otherId, "partner_of", 1);
  addRelation(otherId, id, "partner_of", 1);
  const p = W.components.position[id],
    ev = emitEvent("LoveBondEvent", {
      subjects: [id, otherId],
      location: idx(p.x, p.y),
      causes: [ar.lastEventId, br.lastEventId],
      evidence: relationshipEvidence(id, otherId, ar).concat(
        `mutual attraction ${Math.min(ar.attraction, br.attraction).toFixed(2)} crossed the durable-bond threshold`,
      ),
      importance: 2,
      data: { affection: (ar.affection + br.affection) / 2, trust: (ar.trust + br.trust) / 2 },
    });
  ar.lastEventId = br.lastEventId = ev.id;
  remember(id, ev.id, "love");
  remember(otherId, ev.id, "love");
  setEmotionImpulse(id, { affection: 0.38, contentment: 0.25 }, ev.id, "💞");
  setEmotionImpulse(otherId, { affection: 0.38, contentment: 0.25 }, ev.id, "💞");
  return ev;
}

function affairBetween(id, otherId) {
  return ensureSocialEmotion(id)?.affairs.find(
    (affair) => affair.otherId === otherId && !affair.endedTick,
  );
}

function endAffairPair(id, affair) {
  if (!affair || affair.endedTick) return;
  affair.endedTick = W.tick || 1;
  const other = ensureSocialEmotion(affair.otherId),
    reciprocal = other?.affairs.find(
      (candidate) => candidate.otherId === id && !candidate.endedTick,
    );
  if (reciprocal) reciprocal.endedTick = affair.endedTick;
  const relationship = ensureSocialEmotion(id)?.relationships?.[affair.otherId],
    otherRelationship = other?.relationships?.[id];
  if (relationship) relationship.affair = false;
  if (otherRelationship) otherRelationship.affair = false;
}

function startAffair(id, otherId) {
  const a = ensureSocialEmotion(id),
    b = ensureSocialEmotion(otherId),
    ar = relationshipState(id, otherId),
    br = relationshipState(otherId, id);
  if (!a || !b || !a.partnerId || a.partnerId === otherId || affairBetween(id, otherId))
    return null;
  const affair = { otherId, startedTick: W.tick, discovered: false, endedTick: 0, eventId: 0 },
    reciprocal = { otherId: id, startedTick: W.tick, discovered: false, endedTick: 0, eventId: 0 },
    p = W.components.position[id],
    ev = emitEvent("BetrayalEvent", {
      subjects: [id, otherId, a.partnerId],
      location: idx(p.x, p.y),
      causes: [ar.lastEventId, relationshipState(id, a.partnerId)?.lastEventId],
      evidence: relationshipEvidence(id, otherId, ar).concat(
        `existing commitment was ${relationshipState(id, a.partnerId)?.commitment.toFixed(2) || "0.00"}`,
        "the betrayal exists before discovery; knowledge spreads only through observation",
      ),
      importance: 2,
      data: { discovered: false, attraction: (ar.attraction + br.attraction) / 2 },
    });
  affair.eventId = reciprocal.eventId = ev.id;
  a.affairs.push(affair);
  b.affairs.push(reciprocal);
  ar.affair = br.affair = true;
  ar.lastEventId = br.lastEventId = ev.id;
  setEmotionImpulse(id, { affection: 0.16, fear: 0.08 }, ev.id, "💞");
  setEmotionImpulse(otherId, { affection: 0.16, fear: 0.05 }, ev.id, "💞");
  return ev;
}

function endPartnership(id, partnerId, causeEvent, reason) {
  const a = ensureSocialEmotion(id),
    b = ensureSocialEmotion(partnerId);
  if (!a || !b || a.partnerId !== partnerId) return null;
  a.partnerId = 0;
  if (b.partnerId === id) b.partnerId = 0;
  const ar = relationshipState(id, partnerId),
    br = relationshipState(partnerId, id);
  ar.bonded = br.bonded = false;
  ar.commitment *= 0.22;
  br.commitment *= 0.22;
  removeRelation(id, partnerId, "partner_of");
  removeRelation(partnerId, id, "partner_of");
  const p = W.components.position[id],
    ev = emitEvent("RelationshipBrokenEvent", {
      subjects: [id, partnerId],
      location: p ? idx(p.x, p.y) : -1,
      causes: [causeEvent],
      evidence: [reason, "the prior reciprocal partner relation was removed from world state"],
      importance: 2,
      data: { reason },
    });
  setEmotionImpulse(id, { sadness: 0.34, anger: 0.12 }, ev.id, "💔");
  setEmotionImpulse(partnerId, { sadness: 0.28 }, ev.id, "💔");
  return ev;
}

function discoverAffair(id, affair) {
  const social = ensureSocialEmotion(id),
    partnerId = social?.partnerId,
    partner = ensureSocialEmotion(partnerId),
    loverId = affair.otherId,
    lover = ensureSocialEmotion(loverId);
  if (!social || !partner || !lover || affair.discovered) return null;
  const reciprocal = lover.affairs.find(
    (candidate) => candidate.otherId === id && !candidate.endedTick,
  );
  affair.discovered = true;
  const p = W.components.position[partnerId],
    relationship = relationshipState(partnerId, id),
    ev = emitEvent("CheatingDiscoveredEvent", {
      subjects: [partnerId, id, loverId],
      location: p ? idx(p.x, p.y) : -1,
      causes: [affair.eventId],
      evidence: [
        `${entityName(partnerId)} was close enough to observe the concealed bond`,
        `commitment ${relationship.commitment.toFixed(2)} made the observation consequential`,
        "anger, jealousy, and future retaliation now cite this discovery event",
      ],
      importance: 3,
      data: { betrayalEventId: affair.eventId },
    });
  if (!partner.betrayedBy.includes(id)) partner.betrayedBy.push(id);
  relationship.betrayal = clamp(relationship.betrayal + 0.72, 0, 1);
  relationship.grievance = clamp(relationship.grievance + 0.66, 0, 1);
  relationship.jealousy = clamp(relationship.jealousy + 0.8, 0, 1);
  relationship.lastEventId = ev.id;
  remember(partnerId, ev.id, "betrayal");
  setEmotionImpulse(
    partnerId,
    { jealousy: 0.72, anger: 0.58, sadness: 0.48, contentment: -0.55 },
    ev.id,
    "💔",
  );
  setEmotionImpulse(id, { fear: 0.32, sadness: 0.12 }, ev.id, "😨");
  if (relationship.commitment > 0.52 || relationship.betrayal > 0.7)
    endPartnership(partnerId, id, ev.id, "observed betrayal broke reciprocal commitment");
  const loverHasPartner = !!lover.partnerId && classifyAlive(lover.partnerId);
  if (!loverHasPartner || reciprocal?.discovered) endAffairPair(id, affair);
  return ev;
}

function maybeStartAffair(initiatorId, otherId, sharedKin) {
  const initiator = ensureSocialEmotion(initiatorId),
    relationship = relationshipState(initiatorId, otherId),
    reciprocal = relationshipState(otherId, initiatorId);
  if (
    !initiator?.partnerId ||
    initiator.partnerId === otherId ||
    sharedKin ||
    affairBetween(initiatorId, otherId) ||
    Math.min(relationship.attraction, reciprocal.attraction) <= 0.72 ||
    Math.min(relationship.affection, reciprocal.affection) <= 0.56
  )
    return;
  const bond = initiator.relationships?.[initiator.partnerId];
  if (!bond) {
    initiator.partnerId = 0;
    return;
  }
  const opportunity = clamp(
      (1 - bond.commitment) * 0.52 + relationship.attraction * 0.28 + initiator.aggression * 0.12,
      0,
      0.72,
    ),
    cycle = Math.floor(W.tick / 64);
  if (counterRand("affair-opportunity", cycle, initiatorId, otherId) < opportunity * 0.018)
    startAffair(initiatorId, otherId);
}

function updateRelationshipPair(id, otherId) {
  const a = ensureSocialEmotion(id),
    b = ensureSocialEmotion(otherId),
    ar = relationshipState(id, otherId),
    br = relationshipState(otherId, id);
  if (!a || !b || !ar || !br) return;
  const sharedFaction = a.factionId && a.factionId === b.factionId,
    sharedKin = a.kinGroupId && a.kinGroupId === b.kinGroupId,
    cooperation = (a.cooperation + b.cooperation) / 2,
    chemistry = socialChemistry(id, otherId),
    xenophobicFriction =
      a.factionId !== b.factionId ? (personXenophobia(id) + personXenophobia(otherId)) * 0.08 : 0,
    familiarityGain = 0.006 + cooperation * 0.004;
  ar.familiarity = clamp(ar.familiarity + familiarityGain, 0, 1);
  br.familiarity = clamp(br.familiarity + familiarityGain, 0, 1);
  ar.attraction = clamp(ar.attraction * 0.985 + chemistry * 0.015, 0, 1);
  br.attraction = clamp(br.attraction * 0.985 + chemistry * 0.015, 0, 1);
  const trustTarget = clamp(
    0.16 +
      cooperation * 0.42 +
      (sharedFaction ? 0.18 : 0) +
      (sharedKin ? 0.18 : 0) -
      xenophobicFriction,
    0,
    1,
  );
  ar.trust = clamp(ar.trust * 0.992 + trustTarget * 0.008 - ar.grievance * 0.003, 0, 1);
  br.trust = clamp(br.trust * 0.992 + trustTarget * 0.008 - br.grievance * 0.003, 0, 1);
  const affectionTarget = clamp(
    ar.trust * 0.42 + ar.attraction * 0.38 + ar.familiarity * 0.2,
    0,
    1,
  );
  ar.affection = clamp(ar.affection * 0.994 + affectionTarget * 0.006, 0, 1);
  br.affection = clamp(br.affection * 0.994 + affectionTarget * 0.006, 0, 1);
  if (ar.bonded && br.bonded) {
    const commitmentTarget = clamp((ar.trust + br.trust + ar.affection + br.affection) / 4, 0, 1);
    ar.commitment = clamp(
      ar.commitment * 0.994 + commitmentTarget * 0.006 - ar.betrayal * 0.002,
      0,
      1,
    );
    br.commitment = clamp(
      br.commitment * 0.994 + commitmentTarget * 0.006 - br.betrayal * 0.002,
      0,
      1,
    );
  }
  ar.lastInteractionTick = br.lastInteractionTick = W.tick;
  a.trust[otherId] = ar.trust;
  b.trust[id] = br.trust;
  if (
    !a.partnerId &&
    !b.partnerId &&
    !sharedKin &&
    Math.min(ar.trust, br.trust) > 0.57 &&
    Math.min(ar.affection, br.affection) > 0.6 &&
    Math.min(ar.attraction, br.attraction) > 0.58
  )
    formLoveBond(id, otherId);
  maybeStartAffair(id, otherId, sharedKin);
  maybeStartAffair(otherId, id, sharedKin);
}

function updateAffairKnowledge(id) {
  const social = ensureSocialEmotion(id);
  if (!social) return;
  const ownPosition = W.components.position[id];
  for (const affair of social.affairs) {
    if (affair.endedTick) continue;
    const loverPosition = W.components.position[affair.otherId];
    if (!classifyAlive(affair.otherId) || !loverPosition || !ownPosition) {
      endAffairPair(id, affair);
      continue;
    }
    if (dist2(loverPosition.x, loverPosition.y, ownPosition.x, ownPosition.y) <= 25)
      affair.lastCloseTick = W.tick;
    else if (W.tick - (affair.lastCloseTick ?? affair.startedTick) > 512) endAffairPair(id, affair);
  }
  if (!social.partnerId || !classifyAlive(social.partnerId)) return;
  const partnerPosition = W.components.position[social.partnerId];
  if (!partnerPosition) return;
  for (const affair of social.affairs) {
    if (affair.endedTick || affair.discovered) continue;
    const loverPosition = W.components.position[affair.otherId],
      ownPosition = W.components.position[id];
    if (!loverPosition || !ownPosition) continue;
    const witnessDistance = Math.max(
      dist2(partnerPosition.x, partnerPosition.y, ownPosition.x, ownPosition.y),
      dist2(partnerPosition.x, partnerPosition.y, loverPosition.x, loverPosition.y),
    );
    if (witnessDistance <= 25) discoverAffair(id, affair);
  }
}

function knownKillerFromCause(victimId, causeEvent) {
  const event = causeEvent ? eventById(causeEvent) : null;
  if (!event) return 0;
  const explicit = event.data?.attackerId || event.data?.killerId || 0;
  if (explicit && explicit !== victimId && classifyAlive(explicit)) return explicit;
  const candidate =
    event.type.includes("Combat") || event.type.includes("Predation")
      ? event.subjects[0]
      : event.type.includes("Injury")
        ? event.subjects.find((id) => id !== victimId)
        : 0;
  return candidate && candidate !== victimId && classifyAlive(candidate) ? candidate : 0;
}

function notifySocialDeath(victimId, causeEvent) {
  const victimSocial = ensureSocialEmotion(victimId),
    victimIdentity = W.components.identity[victimId];
  if (!victimSocial || !victimIdentity) return;
  const killerId = knownKillerFromCause(victimId, causeEvent),
    mourners = W.activeIds
      .filter((id) => {
        if (id === victimId || W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) return false;
        const social = ensureSocialEmotion(id),
          identity = W.components.identity[id],
          relationship = social.relationships?.[victimId];
        return (
          social.partnerId === victimId ||
          social.kinGroupId === victimSocial.kinGroupId ||
          identity?.parents?.includes(victimId) ||
          victimIdentity.parents?.includes(id) ||
          relationship?.affection > 0.52
        );
      })
      .sort(
        (left, right) =>
          (ensureSocialEmotion(right)?.relationships?.[victimId]?.affection || 0) -
            (ensureSocialEmotion(left)?.relationships?.[victimId]?.affection || 0) || left - right,
      )
      .slice(0, 18);
  if (!mourners.length) return;
  const p = W.components.position[victimId],
    deathEvent = W.components.identity[victimId]?.deathEventId || causeEvent,
    grief = emitEvent("GriefEvent", {
      subjects: [victimId, ...mourners.slice(0, 6)],
      location: p ? idx(p.x, p.y) : -1,
      causes: [deathEvent, causeEvent],
      evidence: [
        `${mourners.length} living bond${mourners.length === 1 ? "" : "s"} connected the dead individual to survivors`,
        killerId
          ? `${entityName(killerId)} was identified from the causal injury record`
          : "no living killer was identifiable from the causal record",
      ],
      magnitude: mourners.length,
      importance: victimSocial.partnerId ? 4 : 3,
      data: { killerId, mourners: mourners.length },
    });
  for (const id of mourners) {
    const social = ensureSocialEmotion(id),
      relationship = social.relationships?.[victimId],
      bond = clamp(
        relationship?.affection || (social.kinGroupId === victimSocial.kinGroupId ? 0.55 : 0.25),
        0.2,
        1,
      );
    W.components.memory[id].kinDeaths.push({ id: victimId, eventId: grief.id, tick: W.tick });
    if (W.components.memory[id].kinDeaths.length > 16) W.components.memory[id].kinDeaths.shift();
    remember(id, grief.id, "grief");
    setEmotionImpulse(
      id,
      { sadness: 0.34 + bond * 0.42, anger: killerId ? bond * 0.22 : 0, contentment: -0.42 },
      grief.id,
      "😢",
    );
  }
  if (killerId) {
    const avenger = mourners.find((id) => {
      const social = ensureSocialEmotion(id),
        bond = relationshipState(id, victimId)?.affection || 0;
      return bond > 0.52 && social.aggression + social.dominance > 0.88;
    });
    if (avenger) {
      const social = ensureSocialEmotion(avenger),
        vow = emitEvent("RevengeVowEvent", {
          subjects: [avenger, killerId, victimId],
          location: p ? idx(p.x, p.y) : -1,
          causes: [grief.id, causeEvent],
          evidence: [
            `affection for ${entityName(victimId)} and identified responsibility joined in memory`,
            `aggression ${social.aggression.toFixed(2)} and dominance ${social.dominance.toFixed(2)} sustained retaliatory resolve`,
          ],
          importance: 3,
        });
      social.revengeTargetId = killerId;
      social.revengeCauseEvent = vow.id;
      social.revengeVowTick = W.tick;
      setEmotionImpulse(avenger, { resolve: 0.78, anger: 0.46, sadness: 0.2 }, vow.id, "😤");
      remember(avenger, vow.id, "revenge");
    }
  }
}

const killEntitySocialBase = killEntity;
killEntity = function (id, cause = "regulatory collapse", causeEvent = 0, erase = false) {
  const wasLivingPerson = W?.kind[id] === KINDS.PERSON && classifyAlive(id),
    social = wasLivingPerson ? ensureSocialEmotion(id) : null,
    partnerId = social?.partnerId || 0,
    result = killEntitySocialBase(id, cause, causeEvent, false);
  if (wasLivingPerson && W.kind[id] === KINDS.CORPSE) {
    notifySocialDeath(id, causeEvent);
    if (partnerId) {
      const survivor = ensureSocialEmotion(partnerId),
        deadRelationship = social?.relationships?.[partnerId],
        survivorRelationship = survivor?.relationships?.[id];
      if (survivor?.partnerId === id) survivor.partnerId = 0;
      if (social) social.partnerId = 0;
      if (deadRelationship) {
        deadRelationship.bonded = false;
        deadRelationship.commitment = 0;
      }
      if (survivorRelationship) {
        survivorRelationship.bonded = false;
        survivorRelationship.commitment = 0;
      }
      removeRelation(id, partnerId, "partner_of");
      removeRelation(partnerId, id, "partner_of");
    }
    for (const survivorId of W.activeIds) {
      if (survivorId === id || W.kind[survivorId] !== KINDS.PERSON) continue;
      const survivor = W.components.social[survivorId];
      if (survivor?.relationships) delete survivor.relationships[id];
      if (survivor?.trust) delete survivor.trust[id];
    }
    removeAllRelationsForEntity(id);
    if (erase && W.kind[id] === KINDS.CORPSE) finalizeCorpse(id);
  } else if (W.kind[id] === KINDS.CORPSE) {
    removeAllRelationsForEntity(id);
    if (erase) finalizeCorpse(id);
  }
  return result;
};

function updateRevengeBehavior(id) {
  const social = ensureSocialEmotion(id),
    targetId = social?.revengeTargetId;
  if (!targetId) return false;
  if (!classifyAlive(targetId)) {
    social.revengeTargetId = 0;
    social.emotion.resolve *= 0.4;
    return false;
  }
  const p = W.components.position[id],
    target = W.components.position[targetId];
  if (!p || !target) return false;
  const reach = typeof combatReach === "function" ? combatReach(id) : 1.5;
  if (dist2(p.x, p.y, target.x, target.y) > reach * reach) {
    if (W.tick - (social.revengeVowTick ?? W.tick) > 2048 && social.emotion.resolve < 0.35) {
      social.revengeTargetId = 0;
      return false;
    }
    moveWorkerToward(
      id,
      idx(target.x, target.y),
      "revenge",
      `pursuing ${entityName(targetId)} from a remembered revenge vow`,
      -1,
      0,
      toolForPurpose(id, "war")?.entityId || 0,
    );
    return true;
  }
  const life = W.components.life[id];
  if (W.tick - (life.lastRevengeTick ?? -999) < 32 || social.emotion.resolve < 0.34) return false;
  life.lastRevengeTick = W.tick;
  const attempt = emitEvent("RevengeAttemptEvent", {
    subjects: [id, targetId],
    location: idx(target.x, target.y),
    causes: [social.revengeCauseEvent],
    evidence: [
      "the avenger reached the remembered target in physical space",
      `anger ${social.emotion.anger.toFixed(2)} and resolve ${social.emotion.resolve.toFixed(2)} remained above action thresholds`,
    ],
    importance: 3,
  });
  const result = detailedCombatExchange(id, targetId, {
    internal: true,
    causeEvent: attempt.id,
    intensity: 0.72 + social.emotion.resolve * 0.36,
    force: true,
  });
  if (result) {
    setEmotionImpulse(id, { resolve: -0.2, anger: -0.12 }, attempt.id, "⚔️");
    if (!classifyAlive(targetId)) social.revengeTargetId = 0;
  }
  return result > 0;
}

function updateSocialDrama(force = false) {
  if (!W || (!force && W.tick % 16)) return;
  if (W.socialDramaTick === W.tick) return;
  W.socialDramaTick = W.tick;
  const people = W.activeIds
    .filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id))
    .sort((a, b) => a - b);
  for (const id of people) {
    ensureSocialEmotion(id);
    updateMeasuredEmotion(id);
  }
  const cycle = Math.floor(W.tick / 16),
    pairCandidates = [];
  for (const id of people)
    for (const otherId of nearbyIds(
      id,
      3,
      (other) => other > id && W.kind[other] === KINDS.PERSON && classifyAlive(other),
    ))
      pairCandidates.push({ id, otherId });
  pairCandidates.sort(
    (left, right) =>
      hashParts(W.seedHash, "social-pair-rotation", cycle, left.id, left.otherId) -
        hashParts(W.seedHash, "social-pair-rotation", cycle, right.id, right.otherId) ||
      left.id - right.id ||
      left.otherId - right.otherId,
  );
  for (const pair of pairCandidates.slice(0, 320)) updateRelationshipPair(pair.id, pair.otherId);
  for (const id of people) {
    updateAffairKnowledge(id);
    updateRevengeBehavior(id);
  }
}

const assignPartnersSocialBase = assignPartners;
assignPartners = function () {
  if (W.tick % 16 === 0) updateSocialDrama(true);
};

const simTickSocialBase = simTick;
simTick = function () {
  simTickSocialBase();
  if (W) updateSocialDrama();
};

function agentEmojiState(id) {
  const social = W.components.social[id],
    life = W.components.life[id],
    work = W.components.work?.[id],
    meaning = emotionMeaning(id),
    glyphs = [];
  if (meaning.value > 0.43) glyphs.push(meaning.emoji);
  const functionGlyph = FUNCTION_EMOJI[work?.task];
  if (functionGlyph && meaning.key !== "critical") glyphs.push(functionGlyph);
  if ((life?.wounds || []).some((wound) => !wound.healedTick && wound.bleed > 1)) glyphs.push("🩸");
  if (life?.anatomy && Object.values(life.anatomy.parts || {}).some((part) => part.severed))
    glyphs.push("🦿");
  return {
    glyphs: [...new Set(glyphs)].slice(0, 3),
    dominant: meaning.key,
    label: meaning.label,
    value: meaning.value,
    causeEvent: social?.emotion?.causeEvent || 0,
    work: work?.phase || work?.task || "idle",
  };
}

function attachmentCondition(id) {
  const social = W.components.social[id],
    meaning = emotionMeaning(id),
    memory = W.components.memory[id],
    relationships = Object.values(social?.relationships || {}),
    partner = social?.partnerId ? social.relationships?.[social.partnerId] || null : null;
  if (!social) return "no modeled social state";
  if (meaning.key === "critical" || meaning.key === "agony")
    return "care-dependent during bodily crisis";
  if (social.revengeTargetId) return "attachment redirected into a revenge fixation";
  if ((memory?.kinDeaths || []).length && (social.emotion?.sadness || 0) > 0.34)
    return "grieving a lost attachment";
  if (
    social.betrayedBy?.length &&
    ((social.emotion?.jealousy || 0) > 0.22 || (social.emotion?.anger || 0) > 0.3)
  )
    return "betrayed and socially guarded";
  if (partner) {
    if (partner.betrayal > 0.28 || partner.jealousy > 0.45)
      return "committed relationship under trust strain";
    if (social.affairs?.some((affair) => !affair.endedTick))
      return "conflicted commitment across competing attachments";
    if (partner.commitment > 0.68 && partner.trust > 0.62) return "secure reciprocal partnership";
    return "developing reciprocal partnership";
  }
  const supportive = Object.entries(social.relationships || {}).filter(
    ([otherId, relationship]) =>
      peekAlive(Number(otherId)) && (relationship.trust > 0.52 || relationship.affection > 0.48),
  ).length;
  if (supportive >= 3) return "embedded in a supportive social network";
  if (supportive) return "connected by a small number of trusted bonds";
  return relationships.length
    ? "socially familiar but without a secure attachment"
    : "socially isolated";
}

function drawEmotionGlyph(g, id, screen, radius, now, portrait = false) {
  if (portrait || W.kind[id] !== KINDS.PERSON || W.kind[id] === KINDS.CORPSE) return;
  const state = agentEmojiState(id),
    burst = (UI.emotionVisuals || []).findLast(
      (item) => item.world === W && item.id === id && W.tick - item.tick < 80,
    );
  if (!state.glyphs.length && !burst) return;
  if (
    UI.camera.zoom < 1.5 &&
    !burst &&
    !["fight", "firefight", "fill_bucket"].includes(W.components.work?.[id]?.task)
  )
    return;
  const glyphs = burst ? [burst.glyph, ...state.glyphs] : state.glyphs,
    text = [...new Set(glyphs)].slice(0, 3).join(""),
    fontSize = clamp(Math.round(radius * 0.42), 10, 19),
    x = screen.x,
    bob = burst ? Math.sin((now + id * 17) * 0.008) * 2 : 0,
    y = screen.y - radius * 1.25 + bob;
  g.save();
  g.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const width = Math.max(fontSize + 6, g.measureText(text).width + 8);
  g.fillStyle = "rgba(5,12,16,.78)";
  g.strokeStyle = "rgba(226,239,234,.32)";
  g.lineWidth = 1;
  g.beginPath();
  if (g.roundRect) g.roundRect(x - width / 2, y - fontSize * 0.72, width, fontSize * 1.38, 6);
  else g.rect(x - width / 2, y - fontSize * 0.72, width, fontSize * 1.38);
  g.fill();
  g.stroke();
  g.fillStyle = "#fff";
  g.fillText(text, x, y);
  g.restore();
}

const eventSentenceEmotionBase = eventSentence;
eventSentence = function (event) {
  const names = event.subjects.map(entityName),
    location = locationName(event.location);
  switch (event.type) {
    case "LoveBondEvent":
      return `💞 ${names[0]} and ${names[1]} formed a reciprocal bond after repeated trust and affection in ${location}.`;
    case "BetrayalEvent":
      return `💞 ${names[0]} began a concealed bond with ${names[1]} while committed to ${names[2]}; it remained unknown until observed.`;
    case "CheatingDiscoveredEvent":
      return `💔 ${names[0]} discovered ${names[1]}'s betrayal with ${names[2]}, creating remembered anger, jealousy, and grief.`;
    case "RelationshipBrokenEvent":
      return `💔 ${names[0]} and ${names[1]}'s reciprocal partnership ended because ${event.data.reason || "commitment failed"}.`;
    case "GriefEvent":
      return `😢 ${fmt(event.magnitude)} bonded survivor${event.magnitude === 1 ? "" : "s"} grieved ${names[0]} in ${location}.`;
    case "RevengeVowEvent":
      return `😤 ${names[0]} fixed on ${names[1]} as responsible for ${names[2]}'s death.`;
    case "RevengeAttemptEvent":
      return `⚔️ ${names[0]} physically reached ${names[1]} and acted on a remembered vow of revenge.`;
    default:
      return eventSentenceEmotionBase(event);
  }
};

const organismInspectorEmotionBase = organismInspector;
organismInspector = function (id) {
  let html = organismInspectorEmotionBase(id);
  if (W.kind[id] !== KINDS.PERSON || !W.components.life[id]) return html;
  const social = W.components.social[id];
  if (!social) return html;
  const state = agentEmojiState(id),
    emotion = social.emotion || defaultEmotionState(),
    partner = social.partnerId ? entityName(social.partnerId) : "none",
    relationshipCount = Object.keys(social.relationships || {}).length,
    revenge = social.revengeTargetId ? entityName(social.revengeTargetId) : "none",
    attachment = attachmentCondition(id);
  const block = `<div class="subhead">Emotional and social state</div><div class="card"><div class="row between"><b>${esc(state.glyphs.join(" ") || "😌")} ${esc(titleCase(state.dominant))}</b><span class="tag">${pct(state.value * 100)}</span></div><div class="kv"><span>Objective meaning</span><b>${esc(state.label)}</b><span>Attachment condition</span><b>${esc(attachment)}</b><span>Partner</span><b>${esc(partner)}</b><span>Known relationships</span><b>${relationshipCount}</b><span>Revenge target</span><b>${esc(revenge)}</b><span>Current function</span><b>${esc(state.work)}</b></div><div class="divider"></div><small class="muted">Affection ${pct(emotion.affection * 100)} · anger ${pct(emotion.anger * 100)} · sadness ${pct(emotion.sadness * 100)} · fear ${pct(emotion.fear * 100)} · jealousy ${pct(emotion.jealousy * 100)} · resolve ${pct(emotion.resolve * 100)}. Bodily crisis overrides contentment; social labels summarize the whole attachment pattern rather than exposing one special case.</small></div>`;
  return `${html}${block}`;
};

function socialEmotionAudit() {
  const failures = [],
    people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  for (const id of people) {
    const social = ensureSocialEmotion(id);
    if (social.partnerId && ensureSocialEmotion(social.partnerId)?.partnerId !== id)
      failures.push(`person ${id} has a non-reciprocal partner`);
    for (const [otherId, relationship] of Object.entries(social.relationships))
      for (const key of [
        "trust",
        "affection",
        "attraction",
        "commitment",
        "grievance",
        "jealousy",
        "betrayal",
      ])
        if (!Number.isFinite(relationship[key]) || relationship[key] < 0 || relationship[key] > 1)
          failures.push(`person ${id} relationship ${otherId} has invalid ${key}`);
    if (social.revengeTargetId && !social.revengeCauseEvent)
      failures.push(`person ${id} has an uncited revenge target`);
  }
  return {
    failures,
    bonded: people.filter((id) => ensureSocialEmotion(id).partnerId).length / 2,
    affairs: Math.floor(
      sum(people.map((id) => ensureSocialEmotion(id).affairs.filter((a) => !a.endedTick).length)) /
        2,
    ),
    revengeVows: people.filter((id) => ensureSocialEmotion(id).revengeTargetId).length,
    emotions: Object.fromEntries(
      Object.keys(EMOTION_SEMANTICS).map((key) => [
        key,
        people.filter((id) => emotionMeaning(id).key === key).length,
      ]),
    ),
  };
}

function debugSocialDramaProbe() {
  const people = W.activeIds
    .filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id))
    .sort((left, right) => left - right)
    .filter((id) => !ensureSocialEmotion(id).partnerId)
    .slice(0, 5);
  if (people.length < 3) return { ok: false, reason: "fewer than three unbonded living people" };
  const [partner, betrayer, lover, mourner, victim] = people,
    bondA = relationshipState(partner, betrayer),
    bondB = relationshipState(betrayer, partner);
  for (const relationship of [bondA, bondB]) {
    relationship.familiarity = 0.92;
    relationship.trust = 0.88;
    relationship.affection = 0.9;
    relationship.attraction = 0.82;
  }
  const love = formLoveBond(partner, betrayer),
    affairA = relationshipState(betrayer, lover),
    affairB = relationshipState(lover, betrayer);
  affairA.familiarity = affairB.familiarity = 0.86;
  affairA.trust = affairB.trust = 0.67;
  affairA.affection = affairB.affection = 0.76;
  affairA.attraction = affairB.attraction = 0.91;
  const betrayal = startAffair(betrayer, lover),
    concealed = affairBetween(betrayer, lover),
    discovery = concealed ? discoverAffair(betrayer, concealed) : null;
  let grief = null,
    vow = null,
    killed = 0;
  if (mourner && victim) {
    const mournerRelationship = relationshipState(mourner, victim),
      victimRelationship = relationshipState(victim, mourner),
      mournerSocial = ensureSocialEmotion(mourner);
    mournerRelationship.affection = victimRelationship.affection = 0.94;
    mournerRelationship.trust = victimRelationship.trust = 0.9;
    mournerSocial.aggression = Math.max(mournerSocial.aggression, 0.58);
    mournerSocial.dominance = Math.max(mournerSocial.dominance, 0.58);
    const position = W.components.position[victim],
      injury = emitEvent("CombatExchangeEvent", {
        subjects: [lover, victim],
        location: position ? idx(position.x, position.y) : -1,
        causes: [],
        evidence: ["controlled causal social-drama probe identified the living attacker"],
        importance: 3,
        data: { tactic: "targeted strike", defense: "failed retreat" },
      }),
      before = W.events.length;
    killEntity(victim, "controlled combat trauma", injury.id);
    killed = W.kind[victim] === KINDS.CORPSE ? victim : 0;
    grief = W.events.slice(before).find((event) => event.type === "GriefEvent") || null;
    vow = W.events.slice(before).find((event) => event.type === "RevengeVowEvent") || null;
  }
  const eventTypes = [love, betrayal, discovery, grief, vow]
      .filter(Boolean)
      .map((event) => event.type),
    betrayedState = ensureSocialEmotion(partner),
    meaning = emotionMeaning(partner),
    partnerLife = W.components.life[partner],
    savedBodyState = {
      integrity: partnerLife.integrity,
      pain: partnerLife.pain,
      wounds: partnerLife.wounds.slice(),
    };
  partnerLife.integrity = 150;
  partnerLife.pain = 92;
  partnerLife.wounds = partnerLife.wounds.concat({
    id: -1,
    bleed: 14,
    healedTick: 0,
    part: "torso",
    type: "controlled critical-state probe",
  });
  const criticalMeaning = emotionMeaning(partner),
    criticalGlyphs = agentEmojiState(partner).glyphs.slice();
  partnerLife.integrity = savedBodyState.integrity;
  partnerLife.pain = savedBodyState.pain;
  partnerLife.wounds = savedBodyState.wounds;
  derivedLife(partner);
  const attachment = attachmentCondition(partner),
    result = {
      ok:
        !!love &&
        !!betrayal &&
        !!discovery &&
        betrayedState.betrayedBy.includes(betrayer) &&
        betrayedState.emotion.anger > 0.4 &&
        betrayedState.emotion.sadness > 0.3 &&
        criticalMeaning.key === "critical" &&
        criticalGlyphs[0] === EMOTION_SEMANTICS.critical.emoji,
      people: { partner, betrayer, lover, mourner: mourner || 0, victim: killed },
      eventTypes,
      concealedBeforeDiscovery: betrayal?.data?.discovered === false,
      relationshipEnded: !betrayedState.partnerId,
      betrayedBy: betrayedState.betrayedBy.slice(),
      emotion: { ...betrayedState.emotion, dominant: meaning.key, emoji: meaning.emoji },
      criticalPriority: {
        key: criticalMeaning.key,
        emoji: criticalMeaning.emoji,
        glyphs: criticalGlyphs,
      },
      attachmentCondition: attachment,
      revengeTarget: mourner ? ensureSocialEmotion(mourner).revengeTargetId : 0,
    };
  return result;
}

const debugSocialDramaProbeMutating = debugSocialDramaProbe;
debugSocialDramaProbe = function () {
  return runIsolatedWorldProbe(debugSocialDramaProbeMutating);
};

window.ALIFE_SOCIAL_DEBUG = Object.freeze({
  audit: socialEmotionAudit,
  probe: debugSocialDramaProbe,
  state: agentEmojiState,
  relationship: relationshipState,
  attachment: attachmentCondition,
  update: () => updateSocialDrama(true),
  bond: formLoveBond,
  affair: startAffair,
});
