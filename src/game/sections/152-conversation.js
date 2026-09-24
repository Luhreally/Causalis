// ═══════════════════════════════════════════════════════════════════════════
// 152. CONVERSATION — mood, company, and what people say to each other
// ═══════════════════════════════════════════════════════════════════════════
// Asked for: a richer social and emotional life, and emoji that are a real
// exchange between people. The emotions of 42b are measured from the body,
// the partner and the remembered harm, and every sixteen ticks up to three
// hundred and twenty pairs who stand within three tiles are weighed against
// each other; but nobody spoke. Fear, sadness and contentment drove no
// choice, contentment was worked out afresh each pass so a festival's lift or
// a friend's comfort was gone sixteen ticks later, no mood passed from one to
// another, and the bubble over a head showed the same glyph on both of a pair.
//
// Now every person also carries a mood (a slow valence from despair to
// cheer), stress (need, danger, debt, a town's unrest), loneliness (time since
// they last spoke with someone) and standing (how the people they know think
// of them); a contentment lift from an event decays over a year instead of
// vanishing (the uplift). And of the pairs weighed every sixteen ticks, some
// talk. The speaker is the one with more to say; the topic is what weighs on
// them most: hunger, grief, love, family, work, news they remember, a third person
// they think well or ill of, the rent, their god, the town's unrest, fear, or
// the weather; each is an emoji sentence of two or three glyphs, and the
// listener answers from how they stand with the speaker and how they are:
// agreeing, comforting, sharing, laughing, arguing or brushing it off.
//
// What is said does something. Company eases loneliness; comfort eases grief;
// a hungry speaker is given food by a listener who has it and cares (a
// conserved packet from one gut to the other); news is remembered by the
// listener; talk of a third person moves the listener's opinion of them
// toward the speaker's, by the trust between the two (gossip, which is how a
// town comes to know its thieves, 154); an argument between rivals can come
// to the quarrel of 53; and moods pass between people who care for each
// other. Nothing is said in sleep, in a fight, or in agony.
const TALK = {
  pairs: 0,
  talks: 0,
  topics: {},
  replies: {},
  shared: 0,
  comforted: 0,
  gossip: 0,
  news: 0,
  quarrels: 0,
};
const TALK_CHANCE = 0.35,
  TALK_LONELY_AFTER = 96,
  TALK_SPEECH_TICKS = 40,
  TALK_REPLY_DELAY = 10,
  UPLIFT_DECAY = 0.94,
  TALK_RETELL = 64,
  TALK_QUARREL_RIVALRY = 1.5,
  MOOD_RATE = 0.12;
const TALK_TOPICS = Object.freeze({
  hunger: { glyphs: ["🍞", "😣"], label: "hunger" },
  grief: { glyphs: ["🕯️", "😢"], label: "a death they mourn" },
  love: { glyphs: ["😊", "💞"], label: "affection" },
  family: { glyphs: ["👪", "😊"], label: "their family" },
  work: { glyphs: ["🔨", "💪"], label: "the day's work" },
  tired: { glyphs: ["😩", "💤"], label: "weariness" },
  news: { glyphs: ["📣", "❗"], label: "news" },
  praise: { glyphs: ["🗣️", "👤", "👏"], label: "someone they admire" },
  gossip: { glyphs: ["🗣️", "👤", "😠"], label: "someone they distrust" },
  crime: { glyphs: ["🗣️", "🦹", "⚖️"], label: "a crime they know of" },
  rent: { glyphs: ["🏠", "💸", "😟"], label: "the rent" },
  faith: { glyphs: ["🙏", "✨"], label: "their faith" },
  unrest: { glyphs: ["✊", "😤"], label: "the town's grievances" },
  fear: { glyphs: ["😨", "⚠️"], label: "danger" },
  joy: { glyphs: ["🎶", "😄"], label: "good cheer" },
  weather: { glyphs: ["🌦️", "🙂"], label: "the weather" },
});
const TALK_REPLIES = Object.freeze({
  agree: "👍",
  comfort: "🤗",
  share: "🤲",
  laugh: "😂",
  argue: "😤",
  dismiss: "🙄",
  worry: "😟",
  pray: "🙏",
  solidarity: "✊",
  reassure: "🛡️",
  surprise: "😮",
  shy: "😳",
});
function talkState(id) {
  const social = ensureSocialEmotion(id);
  if (!social) return null;
  const e = social.emotion;
  if (!Number.isFinite(e.mood)) e.mood = 0;
  if (!Number.isFinite(e.stress)) e.stress = 0;
  if (!Number.isFinite(e.loneliness)) e.loneliness = 0;
  if (!Number.isFinite(e.standing)) e.standing = 0.5;
  if (!Number.isFinite(e.uplift)) e.uplift = 0;
  if (!Number.isFinite(e.lastTalkTick)) e.lastTalkTick = -1e9;
  return e;
}
function moodWord(mood) {
  return mood > 0.45
    ? "cheerful"
    : mood > 0.15
      ? "content"
      : mood > -0.15
        ? "steady"
        : mood > -0.45
          ? "low"
          : "despairing";
}
// ── The slow state, read with the measured emotion every sixteen ticks ───────
const setEmotionImpulseTalkBase = setEmotionImpulse;
setEmotionImpulse = function (id, values, causeEvent = 0, glyph = "") {
  const e = talkState(id);
  if (e && Number.isFinite(values?.contentment) && values.contentment > 0)
    e.uplift = clamp(e.uplift + values.contentment, 0, 0.6);
  return setEmotionImpulseTalkBase(id, values, causeEvent, glyph);
};
function talkStress(id, e) {
  const life = W.components.life[id],
    p = W.components.position[id],
    soc = W.components.social[id];
  if (!life || !p) return e.stress;
  const tile = idx(p.x, p.y),
    needs = clamp(((life.hunger || 0) + (life.thirst || 0) + (life.fatigue || 0)) / 300, 0, 1),
    danger = clamp(W.tiles.danger[tile] / 1100 + W.tiles.fire[tile] / 900, 0, 1),
    home =
      soc?.homePlaceKind === "settlement"
        ? W.settlements.find((s) => s.id === soc.homePlaceId && !s.ruined)
        : null,
    head = soc?.householdId || id,
    roof = home ? habitationHome(id) : null,
    owed = roof?.tenancy?.arrears?.[head] || 0,
    debt = owed ? clamp(owed / Math.max(1, habitationRentOf(roof.tenancy, head) * 4), 0, 1) : 0,
    unrest = clamp(home?.unrest || 0, 0, 1),
    rough = home && !roof && isAdultPerson(id) ? 0.25 : 0;
  return clamp(needs * 0.45 + danger * 0.3 + debt * 0.25 + unrest * 0.15 + rough, 0, 1);
}
const updateMeasuredEmotionTalkBase = updateMeasuredEmotion;
updateMeasuredEmotion = function (id) {
  updateMeasuredEmotionTalkBase(id);
  const e = talkState(id);
  if (!e) return;
  e.uplift = +(e.uplift * UPLIFT_DECAY).toFixed(4);
  e.standing = +(e.standing + (0.5 - e.standing) * 0.01).toFixed(4);
  e.contentment = clamp(e.contentment + e.uplift, 0, 1);
  e.stress = +(e.stress * 0.8 + talkStress(id, e) * 0.2).toFixed(4);
  e.loneliness = +clamp(
    e.loneliness + (W.tick - e.lastTalkTick > TALK_LONELY_AFTER ? 0.025 : -0.01),
    0,
    1,
  ).toFixed(4);
  const target = clamp(
    (e.contentment - 0.5) * 1.6 -
      e.stress * 0.5 -
      e.loneliness * 0.35 -
      e.sadness * 0.4 +
      (e.standing - 0.5) * 0.3,
    -1,
    1,
  );
  e.mood = +(e.mood + (target - e.mood) * MOOD_RATE).toFixed(4);
};
// ── Who talks, and of what ───────────────────────────────────────────────────
function canTalk(id) {
  const life = W.components.life[id];
  if (!life || !classifyAlive(id) || W.kind[id] !== KINDS.PERSON) return false;
  if (typeof wouldSleep === "function" && wouldSleep(id)) return false;
  const task = W.components.work?.[id]?.task;
  if (task === "fight" || task === "firefight" || task === "rescue") return false;
  const meaning = emotionMeaning(id);
  return meaning.key !== "critical" && meaning.key !== "agony";
}
// The third person the speaker thinks most of, well or ill, and knows well.
function talkSubject(id, listener) {
  const rels = W.components.social[id]?.relationships || {};
  let best = null;
  for (const [k, r] of Object.entries(rels)) {
    const other = +k;
    if (other === listener || !r || (r.familiarity || 0) < 0.25 || !peekAlive(other)) continue;
    // A crime is worth telling only to one who has not heard as much of it.
    const theirs = W.components.social[listener]?.relationships?.[other]?.heardCrimes || 0,
      crime =
        (W.components.identity[other]?.crimes || 0) > 0 &&
        (r.heardCrimes || 0) > theirs &&
        W.tick - (r.crimeToldTick ?? -1e9) >= TALK_RETELL,
      opinion =
        (r.trust || 0) +
        (r.affection || 0) * 0.5 -
        (r.grievance || 0) * 1.4 -
        (r.rivalry || 0) * 0.6 -
        (crime ? 0.6 : 0),
      weight =
        W.tick - (r.gossipToldTick ?? -1e9) < TALK_RETELL
          ? 0
          : Math.max(0, Math.abs(opinion - 0.4) - 0.3) + (crime ? 0.4 : 0);
    if (!best || weight > best.weight || (weight === best.weight && other < best.id))
      best = { id: other, opinion, crime, weight };
  }
  return best && best.weight > 0.2 ? best : null;
}
function talkNews(id, listener) {
  const ring = W.components.memory[id]?.ring || [],
    heard = new Set(W.components.memory[listener]?.rememberedEvents || []);
  for (let i = ring.length - 1; i >= 0; i--) {
    const entry = ring[i];
    if (W.tick - entry.tick > 512) break;
    const ev = eventById(entry.eventId);
    if (!ev || heard.has(ev.id) || (ev.importance || 0) < 2 || W.tick - entry.tick > 512) continue;
    return ev;
  }
  return null;
}
function talkTopic(id, listener) {
  const e = talkState(id),
    life = W.components.life[id],
    soc = W.components.social[id],
    work = W.components.work?.[id],
    rel = relationshipState(id, listener),
    candidates = [];
  const add = (key, weight, extra = {}) => {
    if (weight > 0)
      candidates.push({
        key,
        weight: weight + (hashParts(W.seedHash, "talk-topic", W.tick, id, key) % 100) / 1000,
        ...extra,
      });
  };
  add("hunger", (life.hunger || 0) > 62 ? ((life.hunger - 55) / 45) * 1.2 : 0);
  add("grief", e.sadness > 0.3 ? e.sadness * 1.3 : 0);
  add(
    "love",
    soc.partnerId === listener || (rel?.attraction || 0) > 0.5
      ? 0.35 + (rel?.affection || 0) * 0.6
      : 0,
  );
  add("tired", (life.fatigue || 0) > 70 ? (life.fatigue - 60) / 50 : 0);
  if (work?.task && work.task !== "idle")
    add("work", 0.34, { glyph: FUNCTION_EMOJI[work.task] || "🔨" });
  const news = talkNews(id, listener);
  if (news)
    add("news", 0.45 + (news.importance || 0) * 0.08, {
      eventId: news.id,
      glyph:
        news.category === "war"
          ? "⚔️"
          : news.category === "disasters"
            ? "🔥"
            : news.category === "technology"
              ? "💡"
              : "📣",
    });
  const subject = talkSubject(id, listener);
  if (subject)
    add(
      subject.crime ? "crime" : subject.opinion > 0.4 ? "praise" : "gossip",
      0.15 + subject.weight * 0.4,
      { subject: subject.id, opinion: subject.opinion },
    );
  const kin =
    (W.components.identity[id]?.children || []).filter((c) => peekAlive(c)).length +
    (soc.partnerId && soc.partnerId !== listener && peekAlive(soc.partnerId) ? 1 : 0);
  add("family", kin ? 0.22 + Math.min(0.15, kin * 0.04) : 0);
  const home =
      soc?.homePlaceKind === "settlement"
        ? W.settlements.find((s) => s.id === soc.homePlaceId && !s.ruined)
        : null,
    roof = home ? habitationHome(id) : null,
    owed = roof?.tenancy?.arrears?.[soc.householdId || id] || 0;
  add("rent", owed > 0 ? 0.5 + Math.min(0.5, owed / 20) : 0);
  const faith = personFaithKey(id);
  add(
    "faith",
    faith && (W.components.identity[id]?.traits || []).includes("devout") ? 0.4 : faith ? 0.12 : 0,
    { faith },
  );
  add("unrest", (home?.unrest || 0) > 0.3 ? home.unrest : 0);
  add("fear", e.fear > 0.35 ? e.fear : 0);
  add("joy", e.mood > 0.35 || e.uplift > 0.15 ? 0.3 + e.mood * 0.4 : 0);
  add("weather", 0.2);
  candidates.sort((a, b) => b.weight - a.weight || (a.key < b.key ? -1 : 1));
  return candidates[0] || { key: "weather", weight: 0.15 };
}
// ── The answer, from the listener's side ─────────────────────────────────────
function talkReply(speaker, listener, topic) {
  const r = relationshipState(listener, speaker),
    le = talkState(listener),
    warm =
      (r?.trust || 0) * 0.6 +
      (r?.affection || 0) * 0.8 -
      (r?.grievance || 0) -
      (r?.rivalry || 0) * 0.7,
    kind = W.components.genome[listener] ? phenotype(listener).cooperation || 0.5 : 0.5;
  switch (topic.key) {
    case "hunger": {
      const food = listenerFood(listener);
      return food >= 6 && warm + kind > 0.7 ? "share" : warm > 0.2 ? "worry" : "dismiss";
    }
    case "grief":
      return warm + kind > 0.45 ? "comfort" : "dismiss";
    case "love":
      return warm > 0.35 ? "shy" : "dismiss";
    case "tired":
    case "rent":
      return warm > 0.15 ? "worry" : "dismiss";
    case "news":
      return "surprise";
    case "praise":
    case "gossip":
    case "crime": {
      const own = W.components.social[listener]?.relationships?.[topic.subject],
        mine = own ? (own.trust || 0) - (own.grievance || 0) * 1.4 : 0.4,
        agree = Math.sign(mine - 0.4) === Math.sign(topic.opinion - 0.4) || !own;
      return agree || warm > 0.5 ? "agree" : "argue";
    }
    case "faith":
      return topic.faith && topic.faith === personFaithKey(listener)
        ? "pray"
        : warm > 0.4
          ? "agree"
          : "dismiss";
    case "unrest":
      return (le.stress || 0) > 0.3 || warm > 0.4 ? "solidarity" : "dismiss";
    case "fear":
      return warm > 0.2 ? "reassure" : "worry";
    case "joy":
      return le.mood > -0.2 ? "laugh" : "dismiss";
    case "family":
      return warm > 0.1 ? "agree" : "dismiss";
    case "work":
      return (W.components.life[listener]?.fatigue || 0) > 70 ? "worry" : "agree";
    default:
      return warm < -0.3 ? "dismiss" : "agree";
  }
}
function listenerFood(id) {
  const d = W.components.inventory[id]?.digestive,
    m = W.components.inventory[id]?.materials;
  return (d?.[C.ORGANIC] || 0) + (m?.[C.ORGANIC] || 0);
}
// ── What talk does ───────────────────────────────────────────────────────────
function shareFood(giver, taker) {
  const inv = W.components.inventory[giver],
    gut = W.components.inventory[taker]?.digestive;
  if (!inv || !gut) return 0;
  let moved = 0;
  for (const store of [inv.materials, inv.digestive]) {
    const amount = Math.min(
      8 - moved,
      Math.max(0, (store[C.ORGANIC] || 0) - (store === inv.digestive ? 6 : 0)),
      65535 - gut[C.ORGANIC],
    );
    if (amount > 0) {
      store[C.ORGANIC] -= amount;
      gut[C.ORGANIC] += amount;
      moved += amount;
    }
    if (moved >= 8) break;
  }
  return moved;
}
function nudgeRel(from, to, changes) {
  const r = relationshipState(from, to);
  if (!r) return;
  for (const [k, d] of Object.entries(changes)) r[k] = clamp((r[k] || 0) + d, 0, 1);
  r.lastInteractionTick = W.tick;
}
function converse(speaker, listener) {
  const topic = talkTopic(speaker, listener),
    reply = talkReply(speaker, listener, topic),
    se = talkState(speaker),
    le = talkState(listener);
  TALK.talks++;
  TALK.topics[topic.key] = (TALK.topics[topic.key] || 0) + 1;
  TALK.replies[reply] = (TALK.replies[reply] || 0) + 1;
  se.lastTalkTick = le.lastTalkTick = W.tick;
  se.loneliness = clamp(se.loneliness - 0.2, 0, 1);
  le.loneliness = clamp(le.loneliness - 0.15, 0, 1);
  nudgeRel(speaker, listener, { familiarity: 0.02 });
  nudgeRel(listener, speaker, { familiarity: 0.02 });
  const warmReply = [
    "agree",
    "comfort",
    "share",
    "laugh",
    "pray",
    "solidarity",
    "reassure",
    "shy",
    "surprise",
  ].includes(reply);
  if (warmReply) {
    nudgeRel(speaker, listener, { trust: 0.02, affection: 0.01 });
    nudgeRel(listener, speaker, { trust: 0.01 });
  } else if (reply === "argue" || reply === "dismiss") {
    nudgeRel(speaker, listener, { trust: -0.02, grievance: reply === "argue" ? 0.03 : 0.01 });
  }
  let outcome = "";
  if (reply === "share") {
    const moved = shareFood(listener, speaker);
    if (moved) {
      TALK.shared++;
      outcome = `${moved} food given`;
      se.uplift = clamp(se.uplift + 0.08, 0, 0.6);
      nudgeRel(speaker, listener, { trust: 0.05, affection: 0.03 });
    }
  } else if (reply === "comfort") {
    se.sadness = clamp(se.sadness - 0.08, 0, 1);
    se.uplift = clamp(se.uplift + 0.05, 0, 0.6);
    TALK.comforted++;
    outcome = "comforted";
    if (W.tick - (se.lastComfortEventTick ?? -1e9) >= 256) {
      se.lastComfortEventTick = W.tick;
      const p = W.components.position[speaker];
      emitEvent("ComfortEvent", {
        subjects: [listener, speaker],
        location: p ? idx(p.x, p.y) : -1,
        importance: 1,
        evidence: [
          `${entityName(listener)} sat with ${entityName(speaker)} in their grief`,
          `sadness ${se.sadness.toFixed(2)}`,
        ],
        data: { a: entityName(listener), b: entityName(speaker) },
      });
    }
  } else if (topic.key === "news" && topic.eventId) {
    remember(listener, topic.eventId, "heard");
    TALK.news++;
    outcome = "news passed on";
  } else if (
    ["praise", "gossip", "crime"].includes(topic.key) &&
    topic.subject &&
    reply === "agree"
  ) {
    const trust = relationshipState(listener, speaker)?.trust || 0.3,
      toward = topic.opinion > 0.4 ? 1 : -1,
      weight = 0.05 + trust * 0.1;
    nudgeRel(
      listener,
      topic.subject,
      toward > 0
        ? { trust: weight, familiarity: 0.02 }
        : { trust: -weight, grievance: weight * 0.6, familiarity: 0.02 },
    );
    if (topic.key === "crime") {
      const r = relationshipState(listener, topic.subject),
        mine = relationshipState(speaker, topic.subject);
      if (r) r.heardCrimes = Math.max(r.heardCrimes || 0, mine?.heardCrimes || 1);
      if (mine) mine.crimeToldTick = W.tick;
    }
    const told = relationshipState(speaker, topic.subject);
    if (told) told.gossipToldTick = W.tick;
    // What is said of a person is their standing: a word of praise lifts it, an ill word lowers it.
    const subjectState = talkState(topic.subject);
    if (subjectState)
      subjectState.standing = +clamp(subjectState.standing + toward * 0.02, 0, 1).toFixed(4);
    TALK.gossip++;
    outcome = toward > 0 ? "praise spread" : "ill word spread";
  } else if (reply === "argue") {
    const ar = relationshipState(speaker, listener),
      br = relationshipState(listener, speaker);
    if (
      (ar?.rivalry || 0) + (br?.rivalry || 0) > TALK_QUARREL_RIVALRY &&
      typeof quarrel === "function" &&
      W.tick - (ar.quarrelTick || -1e9) > 256
    ) {
      quarrel(speaker, listener, ar, br);
      TALK.quarrels++;
      outcome = "quarrel";
    }
  } else if (reply === "laugh" || reply === "solidarity" || reply === "pray") {
    le.uplift = clamp(le.uplift + 0.03, 0, 0.6);
    se.uplift = clamp(se.uplift + 0.03, 0, 0.6);
  }
  // Moods pass between people who care for one another.
  const care =
    clamp(
      (relationshipState(listener, speaker)?.affection || 0) +
        (relationshipState(listener, speaker)?.trust || 0) * 0.5,
      0,
      1,
    ) * 0.08;
  if (care > 0) {
    const pull = (se.mood - le.mood) * care;
    le.mood = +clamp(le.mood + pull, -1, 1).toFixed(4);
    se.mood = +clamp(se.mood - pull * 0.5, -1, 1).toFixed(4);
  }
  const glyphs =
    topic.key === "work"
      ? [topic.glyph || "🔨", "💪"]
      : topic.key === "news"
        ? [topic.glyph || "📣", "❗"]
        : TALK_TOPICS[topic.key].glyphs;
  const said = {
    world: W,
    tick: W.tick,
    speaker,
    listener,
    topic: topic.key,
    say: glyphs.join(""),
    reply: TALK_REPLIES[reply],
    replyKey: reply,
    outcome,
  };
  W.components.social[speaker].lastTalk = {
    tick: W.tick,
    with: listener,
    topic: topic.key,
    say: said.say,
    reply: said.reply,
    outcome,
  };
  W.components.social[listener].lastTalk = {
    tick: W.tick,
    with: speaker,
    topic: topic.key,
    heard: said.say,
    reply: said.reply,
    outcome,
  };
  UI.speech = (UI.speech || [])
    .filter((s) => s.world === W && W.tick - s.tick < TALK_SPEECH_TICKS + TALK_REPLY_DELAY)
    .concat(said);
  UI.speechIndex = null;
  return said;
}
// Some of the pairs weighed each pass talk; the one with more to say speaks.
const updateRelationshipPairTalkBase = updateRelationshipPair;
updateRelationshipPair = function (id, otherId) {
  const out = updateRelationshipPairTalkBase(id, otherId);
  TALK.pairs++;
  if (hashParts(W.seedHash, "talk", W.tick, id, otherId) % 1000 >= TALK_CHANCE * 1000) return out;
  if (!canTalk(id) || !canTalk(otherId)) return out;
  const urge = (x) => {
      const e = talkState(x);
      return (
        e.loneliness +
        e.sadness * 0.5 +
        e.stress * 0.3 +
        (W.components.genome[x] ? phenotype(x).social || 0 : 0) * 0.5
      );
    },
    speaker = urge(id) >= urge(otherId) ? id : otherId;
  converse(speaker, speaker === id ? otherId : id);
  return out;
};
// ── The bubble ───────────────────────────────────────────────────────────────
// The zoom is asked first: the status bubble was worked out (a wound filter, a
// candidate sort, a search of the bursts) for every figure drawn, zoomed in or
// not, and then thrown away under a zoom of one and a half.
function speechFor(id) {
  if (!UI.speech?.length) return null;
  if (!UI.speechIndex || UI.speechIndex.world !== W || UI.speechIndex.tick !== W.tick) {
    const map = new Map();
    for (const s of UI.speech) {
      if (s.world !== W) continue;
      const age = W.tick - s.tick;
      if (age < 0 || age > TALK_SPEECH_TICKS + TALK_REPLY_DELAY) continue;
      if (age <= TALK_SPEECH_TICKS)
        map.set(s.speaker, { text: s.say, other: s.listener, role: "say", age });
      if (age >= TALK_REPLY_DELAY)
        map.set(s.listener, {
          text: s.reply,
          other: s.speaker,
          role: "reply",
          age: age - TALK_REPLY_DELAY,
        });
    }
    UI.speechIndex = { world: W, tick: W.tick, map };
  }
  return UI.speechIndex.map.get(id) || null;
}
const drawEmotionGlyphTalkBase = drawEmotionGlyph;
drawEmotionGlyph = function (g, id, screen, radius, now, portrait = false) {
  if (portrait || W.kind[id] !== KINDS.PERSON) return;
  const speech = UI.camera.zoom >= 1.5 ? speechFor(id) : null;
  if (!speech) {
    if (UI.camera.zoom < 1.5) {
      const task = W.components.work?.[id]?.task,
        burst = (UI.emotionVisuals || []).some(
          (item) => item.world === W && item.id === id && W.tick - item.tick < 80,
        );
      if (!burst && !["fight", "firefight", "fill_bucket"].includes(task)) return;
    }
    return drawEmotionGlyphTalkBase(g, id, screen, radius, now, portrait);
  }
  const other = W.components.position[speech.other],
    me = W.components.position[id],
    fontSize = clamp(Math.round(radius * 0.46), 11, 20),
    x = screen.x,
    y = screen.y - radius * 1.35 + Math.sin((now + id * 23) * 0.006) * 1.5;
  g.save();
  g.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const width = Math.max(fontSize + 8, g.measureText(speech.text).width + 12),
    h = fontSize * 1.5,
    fade = clamp(1 - speech.age / TALK_SPEECH_TICKS, 0.35, 1),
    lean = other && me ? clamp(Math.sign(other.x - me.x + (other.y - me.y) * 0.3), -1, 1) : 0;
  g.globalAlpha = fade;
  g.fillStyle = speech.role === "say" ? "rgba(250,248,240,.94)" : "rgba(214,238,250,.94)";
  g.strokeStyle = "rgba(20,30,40,.55)";
  g.lineWidth = 1;
  g.beginPath();
  if (g.roundRect) g.roundRect(x - width / 2, y - h / 2, width, h, h / 2);
  else g.rect(x - width / 2, y - h / 2, width, h);
  g.moveTo(x + lean * width * 0.18 - 4, y + h / 2 - 1);
  g.lineTo(x + lean * width * 0.32, y + h / 2 + 6);
  g.lineTo(x + lean * width * 0.18 + 4, y + h / 2 - 1);
  g.fill();
  g.stroke();
  g.fillStyle = "#111";
  g.fillText(speech.text, x, y + 0.5);
  g.restore();
};
// ── What the inspector says ─────────────────────────────────────────────────
const organismInspectorTalkBase = organismInspector;
organismInspector = function (id) {
  const html = organismInspectorTalkBase(id);
  if (!W?.components?.life?.[id] || W.kind[id] !== KINDS.PERSON) return html;
  const e = W.components.social[id]?.emotion,
    last = W.components.social[id]?.lastTalk;
  if (!e || !Number.isFinite(e.mood)) return html;
  const talk = last
    ? last.say
      ? `said ${last.say} to ${entityLink(last.with) || "someone"}, who answered ${last.reply}${last.outcome ? ` (${esc(last.outcome)})` : ""}`
      : `heard ${last.heard} from ${entityLink(last.with) || "someone"} and answered ${last.reply}${last.outcome ? ` (${esc(last.outcome)})` : ""}`
    : "has not spoken with anyone yet";
  const block = `<div class="subhead">Mood and company</div><div class="kv" data-talk="${esc(moodWord(e.mood))}"><span>Mood</span><b>${moodWord(e.mood)} (${e.mood.toFixed(2)}) · stress ${Math.round(e.stress * 100)}% · ${e.loneliness > 0.5 ? "lonely" : e.loneliness > 0.2 ? "a little alone" : "in company"}</b><span>Last words</span><b>${talk}${last ? ` · ${Math.max(0, Math.round((W.tick - last.tick) / (TICKS_PER_YEAR / 12)))} months ago` : ""}</b></div>`,
    at = html.indexOf("<details");
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
eventText(["ComfortEvent"], function (e, next) {
  if (e.type === "ComfortEvent")
    return `🤗 ${e.data?.a || "Someone"} sat with ${e.data?.b || "a mourner"} in their grief.`;
  return next(e);
});
window.ALIFE_TALK_DEBUG = Object.freeze({
  counts: () => JSON.parse(JSON.stringify(TALK)),
  state: (id) => ({ ...(talkState(id) || {}) }),
  topic: (a, b) => talkTopic(a, b),
  reply: (a, b, topic) => talkReply(a, b, topic),
  converse: (a, b) => {
    const s = converse(a, b);
    return { ...s, world: undefined };
  },
  speech: (id) => speechFor(id),
  canTalk: (id) => canTalk(id),
  mood: (id) => moodWord(talkState(id)?.mood || 0),
});
