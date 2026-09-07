// ═══════════════════════════════════════════════════════════════════════════
// 94. FIGURES — people who kneel, carry, sit, and fight, dressed by standing
// ═══════════════════════════════════════════════════════════════════════════
// A person was an upright form with a gait phase and a culture's dress, the
// same whether asleep, sowing, or under arms. Here the figure reads what the
// person is doing and shows it: legs swing with the walk and stand still at
// rest, a farmer kneels to sow and reap, a hauler or builder works with arms
// raised, a fighter lifts an arm, and a person who owes a rest sits. Dress
// reads standing and age: the prosperous wear a brim, the rich a hat and a
// jewel (a tall hat once their town knows engines), people of lettered towns
// wear a hemmed cloak, people of electric towns a buttoned coat, and children
// are drawn small. Portraits in the people bar show the same dress. Rendering
// only reads; the figure is a way of seeing the components.
const FIGURE_KNEEL_TASKS = new Set(["sow", "tend", "harvest"]),
  FIGURE_WORK_TASKS = new Set(["haul", "gather", "mine", "cut", "fill_bucket", "craft", "build", "operate", "firefight"]),
  FIGURE_RECENT = 12;
let ACTIVE_FIGURE = null,
  FIGURES_DRAWN = 0,
  FIGURE_CALLS = 0;
const figureEraCache = { world: null, tick: -1, byPlace: new Map() };
function homeEraOf(id) {
  const soc = W.components.social?.[id];
  if (!soc || soc.homePlaceKind !== "settlement" || !soc.homePlaceId) return "stone";
  if (figureEraCache.world !== W || figureEraCache.tick !== W.tick) {
    figureEraCache.world = W;
    figureEraCache.tick = W.tick;
    figureEraCache.byPlace.clear();
  }
  let era = figureEraCache.byPlace.get(soc.homePlaceId);
  if (!era) {
    const k = W.settlements.find((s) => s.id === soc.homePlaceId)?.knownProcesses || [];
    era = k.includes("electricity") ? "electric" : k.includes("mechanization") ? "engines" : k.includes("writing") ? "letters" : "stone";
    figureEraCache.byPlace.set(soc.homePlaceId, era);
  }
  return era;
}
function figurePose(id, motion) {
  const life = W.components.life[id],
    w = W.components.work?.[id],
    task = w && w.task !== "idle" && W.tick - (Number.isFinite(w.handledTick) ? w.handledTick : -1e9) <= FIGURE_RECENT ? w.task : "",
    campaign = W.components.campaign?.[id];
  if (FIGURE_KNEEL_TASKS.has(task)) return "kneel";
  if (task === "raze" || campaign?.role === "attack" || life?.behavior === "defend" || life?.behavior === "hunt") return "fight";
  if (life?.restDebt || life?.behavior === "rest") return "sit";
  if (FIGURE_WORK_TASKS.has(task)) return "work";
  return motion?.moving ? "walk" : "stand";
}
function figureState(id, motion, portrait) {
  const ident = W.components.identity[id];
  return {
    id,
    pose: portrait ? "stand" : figurePose(id, motion),
    moving: !!motion?.moving,
    standing: ident?.standing || "common",
    era: homeEraOf(id),
    child: typeof isAdultPerson === "function" && !isAdultPerson(id),
    portrait: !!portrait,
  };
}
// The glyph pass draws a person as a dot under three and a half pixels; a
// figure is worth drawing a little smaller than that, so from about zoom five
// the computed radius is passed through and the full figure is drawn.
const FIGURE_MIN_RADIUS = 2.6,
  FIGURE_DOT_RADIUS = 3.4;
function figureRadius(id, motion) {
  const ph = peekPhenotype(id),
    m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    crowd = motion?.crowd > 1 ? 1 / (1 + 0.1 * Math.min(motion.crowd - 1, 4)) : 1;
  return Math.max(2.2, m.tw * (0.05 + 0.042 * clamp(ph.size, 0.35, 1.8))) * crowd;
}
const drawCreatureGlyphFiguresBase = drawCreatureGlyph;
drawCreatureGlyph = function (g, id, s, now, fac = null, scaleOverride = 0, portrait = false, motion = null) {
  ACTIVE_FIGURE = W.kind[id] === KINDS.PERSON && W.components.life[id] ? figureState(id, motion, portrait) : null;
  if (ACTIVE_FIGURE) {
    FIGURE_CALLS++;
    if (!portrait && !scaleOverride && UI.quality !== "low") {
      const r = figureRadius(id, motion);
      if (r >= FIGURE_MIN_RADIUS && r < FIGURE_DOT_RADIUS) scaleOverride = r;
    }
  }
  try {
    return drawCreatureGlyphFiguresBase(g, id, s, now, fac, scaleOverride, portrait, motion);
  } finally {
    ACTIVE_FIGURE = null;
  }
};
const drawUprightPersonFiguresBase = drawUprightPerson;
drawUprightPerson = function (g, m, phase, detail, colors) {
  const fig = ACTIVE_FIGURE,
    form = m.personForm || "biped";
  if (!fig || detail === 0 || form === "quadruped") return drawUprightPersonFiguresBase(g, m, phase, detail, colors);
  FIGURES_DRAWN++;
  const { primary, secondary, accent, outline, dress } = colors,
    pose = fig.pose,
    swing = pose === "walk" ? 0.2 : pose === "stand" || pose === "sit" || pose === "kneel" ? 0.02 : 0.1,
    wave = Math.sin(phase) * swing,
    torsoW = form === "broad" ? 0.56 : form === "tall" ? 0.38 : 0.46,
    torsoH = form === "tall" ? 0.86 : form === "broad" ? 0.64 : 0.73,
    legLen = form === "tall" ? 1.3 : form === "broad" ? 1.05 : 1.18,
    dressed = dress && dress.style !== "none",
    drop = pose === "kneel" ? 0.32 : pose === "sit" ? 0.38 : 0;
  g.save();
  if (fig.child) g.scale(0.72, 0.72);
  if (drop) g.translate(0, drop);
  if (dressed && (dress.style === "cloak" || fig.era === "letters")) {
    g.fillStyle = hsl(dress.hue, 45, 32, 0.85);
    g.beginPath();
    g.ellipse(0, 0.32, torsoW * 1.35, torsoH * (pose === "sit" || pose === "kneel" ? 0.8 : 1.05), 0, 0, Math.PI * 2);
    g.fill();
    if (fig.era === "letters" && detail > 1) {
      g.strokeStyle = hsl(dress.hue, 60, 60, 0.9);
      g.lineWidth = 0.08;
      g.beginPath();
      g.ellipse(0, 0.32 + torsoH * 0.9, torsoW * 1.3, 0.16, 0, 0, Math.PI);
      g.stroke();
    }
  }
  g.strokeStyle = secondary;
  g.fillStyle = secondary;
  g.lineWidth = 0.12;
  // Arms.
  const shoulder = -0.05;
  if (creatureAppendageVisible(m, 0)) {
    if (pose === "kneel") creatureLimbStyled(g, m, -torsoW * 0.4, shoulder, -0.6, 0.62, 0.12, phase);
    else if (pose === "work") creatureLimbStyled(g, m, -torsoW * 0.4, shoulder, -0.5, -0.38, 0.12, phase);
    else if (pose === "fight") creatureLimbStyled(g, m, -torsoW * 0.4, shoulder, -0.72, -0.78, 0.12, phase);
    else if (pose === "sit") creatureLimbStyled(g, m, -torsoW * 0.4, shoulder, -0.55, 0.55, 0.12, phase);
    else creatureLimbStyled(g, m, -torsoW * 0.4, shoulder, -0.68, 0.5 + wave, 0.12, phase);
  }
  if (creatureAppendageVisible(m, 1)) {
    if (pose === "kneel") creatureLimbStyled(g, m, torsoW * 0.4, shoulder, 0.6, 0.62, 0.12, phase + 2);
    else if (pose === "work") creatureLimbStyled(g, m, torsoW * 0.4, shoulder, 0.5, -0.38, 0.12, phase + 2);
    else creatureLimbStyled(g, m, torsoW * 0.4, shoulder, 0.68, 0.5 - wave, 0.12, phase + 2);
  }
  // Legs.
  g.lineWidth = 0.1;
  if (pose === "kneel") {
    if (creatureAppendageVisible(m, 2)) creatureLimbStyled(g, m, -0.2, 0.55, -0.66, 0.9, 0.1, phase + 1);
    if (creatureAppendageVisible(m, 3)) creatureLimbStyled(g, m, 0.2, 0.55, 0.66, 0.9, 0.1, phase + 3);
  } else if (pose === "sit") {
    if (creatureAppendageVisible(m, 2)) creatureLimbStyled(g, m, -0.2, 0.6, -0.9, 0.78, 0.1, phase + 1);
    if (creatureAppendageVisible(m, 3)) creatureLimbStyled(g, m, 0.2, 0.6, 0.9, 0.78, 0.1, phase + 3);
  } else {
    if (creatureAppendageVisible(m, 2)) creatureLimbStyled(g, m, -0.2, 0.55, -0.48 - wave * 1.6, legLen, 0.1, phase + 1);
    if (creatureAppendageVisible(m, 3)) creatureLimbStyled(g, m, 0.2, 0.55, 0.48 + wave * 1.6, legLen, 0.1, phase + 3);
    if (form === "tripod") creatureLimbStyled(g, m, 0, 0.6, 0, legLen + 0.05, 0.06, phase + 2);
  }
  // Torso.
  g.fillStyle = primary;
  g.beginPath();
  g.ellipse(0, 0.18, torsoW, torsoH, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = outline;
  g.lineWidth = 0.13;
  g.stroke();
  if (dressed) {
    const tone = hsl(dress.hue, 62, 52, 0.95);
    if (dress.style === "band") {
      g.fillStyle = tone;
      g.fillRect(-torsoW * 0.95, 0.05, torsoW * 1.9, 0.2);
    } else if (dress.style === "sash") {
      g.strokeStyle = tone;
      g.lineWidth = 0.16;
      g.beginPath();
      g.moveTo(-torsoW * 0.8, -0.35);
      g.lineTo(torsoW * 0.8, 0.7);
      g.stroke();
    } else if (dress.style === "paint") {
      g.fillStyle = tone;
      for (let n = 0; n < 3; n++) {
        g.beginPath();
        g.arc((n - 1) * torsoW * 0.5, 0.05 + (n % 2) * 0.28, 0.08, 0, Math.PI * 2);
        g.fill();
      }
    } else if (dress.style === "collar") {
      g.strokeStyle = tone;
      g.lineWidth = 0.12;
      g.beginPath();
      g.ellipse(0, -0.42, torsoW * 0.75, 0.13, 0, 0, Math.PI * 2);
      g.stroke();
    }
    if (dress.faction) {
      g.fillStyle = dress.faction;
      g.fillRect(-0.16, -0.5, 0.32, 0.1);
    }
  }
  // A coat in electric towns: a darker front with buttons.
  if (fig.era === "electric" && detail > 1) {
    g.fillStyle = hsl((dress?.hue ?? m.secondaryHue) + 180, 25, 22, 0.75);
    g.fillRect(-torsoW * 0.5, -0.3, torsoW, torsoH * 1.05);
    g.fillStyle = hsl(44, 70, 72);
    for (const y of [-0.1, 0.15, 0.4]) {
      g.beginPath();
      g.arc(0, y, 0.05, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Head.
  const headStyle = m.personHead || "round",
    hy = -0.65 - (form === "tall" ? 0.12 : 0);
  g.fillStyle = secondary;
  g.strokeStyle = outline;
  g.lineWidth = 0.13;
  g.beginPath();
  if (headStyle === "tall") g.ellipse(0, hy - 0.05, 0.3, 0.44, 0, 0, Math.PI * 2);
  else if (headStyle === "split") {
    g.arc(-0.2, hy, 0.27, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(0.2, hy, 0.27, 0, Math.PI * 2);
  } else if (headStyle === "hooded") {
    g.fillStyle = hsl(dress?.hue ?? m.secondaryHue, 40, 30);
    g.ellipse(0, hy - 0.05, 0.5, 0.48, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = secondary;
    g.beginPath();
    g.arc(0, hy + 0.02, 0.3, 0, Math.PI * 2);
  } else g.arc(0, hy, 0.38, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (headStyle === "crested") {
    g.fillStyle = accent;
    g.beginPath();
    g.moveTo(-0.3, hy - 0.2);
    g.lineTo(0, hy - 0.85);
    g.lineTo(0.3, hy - 0.2);
    g.closePath();
    g.fill();
  }
  // Standing: a brim for the prosperous, a hat and a jewel for the rich.
  if ((fig.standing === "prosperous" || fig.standing === "rich") && headStyle !== "crested") {
    const hatHue = dress?.hue ?? m.secondaryHue,
      tall = fig.era === "engines" || fig.era === "electric";
    g.fillStyle = hsl(hatHue, 30, 18);
    g.fillRect(-0.48, hy - 0.42, 0.96, 0.08);
    if (fig.standing === "rich") {
      g.fillRect(-0.3, hy - (tall ? 0.95 : 0.7), 0.6, tall ? 0.55 : 0.3);
      g.fillStyle = accent;
      g.beginPath();
      g.arc(0, hy - (tall ? 0.72 : 0.58), 0.07, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  return { x: 0, y: hy + drop, r: 0.38 };
};
window.ALIFE_FIGURES_DEBUG = Object.freeze({
  pose: (id) => figurePose(id, VISUAL_MOTION.get(id) || null),
  state: (id) => figureState(id, VISUAL_MOTION.get(id) || null, false),
  era: (id) => homeEraOf(id),
  drawn: () => FIGURES_DRAWN,
  calls: () => FIGURE_CALLS,
  reset: () => {
    FIGURES_DRAWN = 0;
    FIGURE_CALLS = 0;
  },
});
