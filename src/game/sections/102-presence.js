// ═══════════════════════════════════════════════════════════════════════════
// 102. PRESENCE — people you can see: taller figures, tools in hand, hair, torches
// ═══════════════════════════════════════════════════════════════════════════
// A person was drawn a tenth of a tile tall, so the poses and dress of 94 were
// three pixels of difference at the zooms a player watches a town from, and a
// herd was a scatter of grains. Walkers are now drawn a third again as tall
// (herds and hunters a quarter again), with structures enlarged beside them
// by 103, so a person is legible and still shorter than a cottage; the dot
// rule still takes over far out. A figure carries its work: an axe to the
// cut, a pick to the mine, a hoe or sickle to the field, a hammer to the site,
// a bundle on the back when hauling or gathering, a spear and shield to the
// fight, a bow to the hunt. Heads have hair, dark or fair by birth and grey
// with age, under no hat. A walker leans into a stride and its head bobs
// with the step; a standing one breathes. And at night a person out of doors
// in a town that knows fire carries a torch, in an electric town a lantern,
// so the streets read at night. Rendering only reads; everything is per
// visible figure and skipped at Lean quality or far zoom.
const PRESENCE_SCALE = Object.freeze({ person: 1.35, herbivore: 1.25, predator: 1.3 }),
  PRESENCE_DOT = 3.4,
  PRESENCE_TOOL_TASKS = new Set(["cut", "mine", "build", "craft", "sow", "tend", "harvest", "haul", "gather", "raze", "hunt", "operate", "firefight"]),
  PRESENCE = { scaled: 0, tools: 0, hair: 0, torches: 0 };
let ACTIVE_PRESENCE = null;
function presenceKind(id) {
  const k = W.kind[id];
  return k === KINDS.PERSON ? "person" : k === KINDS.HERBIVORE ? "herbivore" : k === KINDS.PREDATOR ? "predator" : "";
}
function presenceRadius(id, kind, motion) {
  const ph = peekPhenotype(id),
    m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    crowd = motion?.crowd > 1 ? 1 / (1 + 0.1 * Math.min(motion.crowd - 1, 4)) : 1;
  return Math.max(2.2, m.tw * (0.05 + 0.042 * clamp(ph.size, 0.35, 1.8))) * crowd * PRESENCE_SCALE[kind];
}
function presenceTask(id) {
  const w = W.components.work?.[id];
  if (!w || w.task === "idle") return "";
  const handled = Number.isFinite(w.handledTick) ? w.handledTick : -1e9;
  if (W.tick - handled > 12) return "";
  return PRESENCE_TOOL_TASKS.has(w.task) ? w.task : "";
}
// A torch for the awake out of doors at night, where fire is known.
function presenceTorch(id) {
  if (typeof nightAt !== "function" || UI.camera.zoom < 1.6 || UI.quality === "low") return "";
  const life = W.components.life[id],
    p = W.components.position[id];
  if (!life || !p || life.insideBuildingId || !nightAt(p.x, p.y)) return "";
  const place = typeof nearestSettlement === "function" ? nearestSettlement(idx(p.x, p.y), 12) : null,
    known = place?.knownProcesses || [];
  if (known.includes("electricity")) return "lantern";
  if (known.includes("controlled_fire")) return "torch";
  return "";
}
const drawCreatureGlyphPresenceBase = drawCreatureGlyph;
drawCreatureGlyph = function (g, id, s, now, fac = null, scaleOverride = 0, portrait = false, motion = null) {
  const kind = presenceKind(id);
  if (!kind || portrait || scaleOverride || W.kind[id] === KINDS.CORPSE || !classifyAlive(id))
    return drawCreatureGlyphPresenceBase(g, id, s, now, fac, scaleOverride, portrait, motion);
  const r = presenceRadius(id, kind, motion);
  if (r >= PRESENCE_DOT) {
    scaleOverride = r;
    PRESENCE.scaled++;
  }
  ACTIVE_PRESENCE =
    kind === "person" && scaleOverride
      ? { id, task: presenceTask(id), torch: presenceTorch(id), campaign: !!W.components.campaign?.[id], now }
      : null;
  try {
    const out = drawCreatureGlyphPresenceBase(g, id, s, now, fac, scaleOverride, portrait, motion);
    if (ACTIVE_PRESENCE?.torch && scaleOverride) drawTorchGlow(g, s, scaleOverride, ACTIVE_PRESENCE.torch, now);
    return out;
  } finally {
    ACTIVE_PRESENCE = null;
  }
};
function drawTorchGlow(g, s, r, kind, now) {
  const flicker = ACTIVE_REDUCED_MOTION ? 1 : kind === "torch" ? 0.75 + 0.25 * Math.sin(now * 0.017 + s.x) : 0.95,
    x = s.x + r * 0.7,
    y = s.y - r * 0.9,
    glow = g.createRadialGradient(x, y, 0, x, y, r * 1.6);
  glow.addColorStop(0, kind === "torch" ? `rgba(255,170,70,${0.55 * flicker})` : `rgba(255,230,160,${0.5 * flicker})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.save();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = glow;
  g.fillRect(x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
  g.restore();
  PRESENCE.torches++;
}
// ── Tools, hair, and gait on the upright figure ───────────────────────────────
function hairTone(id, life, body) {
  const old = life && body && life.age > (body.maxAge || 19200) * 0.7,
    n = hashParts(W.seedHash, "hair", id) % 5;
  if (old) return hsl(40, 8, 78);
  return [hsl(24, 30, 16), hsl(30, 45, 30), hsl(16, 60, 34), hsl(42, 55, 62), hsl(0, 0, 10)][n];
}
function drawHeldTool(g, task, hue, campaign) {
  g.lineCap = "round";
  g.strokeStyle = hsl(30, 35, 30);
  g.lineWidth = 0.09;
  if (task === "cut" || task === "mine" || task === "build" || task === "craft" || task === "operate") {
    // A handle rising from the raised hand, with a head that names the tool.
    g.beginPath();
    g.moveTo(0.5, 0.35);
    g.lineTo(0.72, task === "build" || task === "craft" ? -0.35 : -0.6);
    g.stroke();
    g.fillStyle = hsl(210, 10, 60);
    if (task === "cut") {
      g.beginPath();
      g.moveTo(0.72, -0.62);
      g.lineTo(1.02, -0.5);
      g.lineTo(0.9, -0.2);
      g.closePath();
      g.fill();
    } else if (task === "mine") {
      g.fillRect(0.52, -0.66, 0.42, 0.1);
    } else {
      g.fillRect(0.6, -0.46, 0.26, 0.16);
    }
  } else if (task === "sow" || task === "tend" || task === "harvest") {
    g.beginPath();
    g.moveTo(0.45, 0.1);
    g.lineTo(0.85, 1.15);
    g.stroke();
    g.strokeStyle = hsl(210, 10, 60);
    g.lineWidth = 0.1;
    g.beginPath();
    if (task === "harvest") g.arc(0.85, 1.2, 0.22, Math.PI * 0.9, Math.PI * 1.9);
    else {
      g.moveTo(0.7, 1.22);
      g.lineTo(1.05, 1.14);
    }
    g.stroke();
  } else if (task === "haul" || task === "gather") {
    // A bundle on the back, strapped over the shoulder.
    g.fillStyle = hsl(hue, 35, 40);
    g.strokeStyle = hsl(hue, 30, 22);
    g.lineWidth = 0.08;
    g.beginPath();
    g.ellipse(-0.42, 0.1, 0.3, 0.42, 0.15, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-0.2, -0.35);
    g.lineTo(0.28, 0.35);
    g.stroke();
  } else if (task === "raze" || campaign) {
    // Spear and shield.
    g.beginPath();
    g.moveTo(0.55, 0.9);
    g.lineTo(0.8, -1.15);
    g.stroke();
    g.fillStyle = hsl(210, 12, 70);
    g.beginPath();
    g.moveTo(0.8, -1.2);
    g.lineTo(0.72, -1.42);
    g.lineTo(0.88, -1.42);
    g.closePath();
    g.fill();
    g.fillStyle = hsl(hue, 45, 42);
    g.strokeStyle = hsl(hue, 40, 20);
    g.beginPath();
    g.arc(-0.55, 0.15, 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (task === "hunt") {
    g.beginPath();
    g.arc(0.72, 0.05, 0.62, -Math.PI * 0.45, Math.PI * 0.45);
    g.stroke();
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(0.72 + Math.cos(-Math.PI * 0.45) * 0.62, 0.05 + Math.sin(-Math.PI * 0.45) * 0.62);
    g.lineTo(0.72 + Math.cos(Math.PI * 0.45) * 0.62, 0.05 + Math.sin(Math.PI * 0.45) * 0.62);
    g.stroke();
  } else if (task === "firefight") {
    g.fillStyle = hsl(200, 50, 45);
    g.beginPath();
    g.ellipse(0.62, 0.55, 0.22, 0.28, 0, 0, Math.PI * 2);
    g.fill();
  }
  PRESENCE.tools++;
}
const drawUprightPersonPresenceBase = drawUprightPerson;
drawUprightPerson = function (g, m, phase, detail, colors) {
  const fig = typeof ACTIVE_FIGURE !== "undefined" ? ACTIVE_FIGURE : null,
    pres = ACTIVE_PRESENCE,
    form = m.personForm || "biped";
  if (!fig || !pres || detail === 0 || form === "quadruped") return drawUprightPersonPresenceBase(g, m, phase, detail, colors);
  const pose = fig.pose,
    walking = pose === "walk",
    standing = pose === "stand",
    bob = walking ? -Math.abs(Math.sin(phase)) * 0.05 : 0,
    breath = standing ? 1 + Math.sin(phase * 7) * 0.012 : 1;
  g.save();
  if (walking) {
    g.translate(0, bob);
    g.rotate(0.06);
  } else if (standing) g.scale(1, breath);
  const head = drawUprightPersonPresenceBase(g, m, phase, detail, colors);
  // The same frame 94 drew in: children small, the posed figure dropped.
  const drop = pose === "kneel" ? 0.32 : pose === "sit" ? 0.38 : pose === "sleep" ? 0.52 : 0;
  g.save();
  if (fig.child) g.scale(0.72, 0.72);
  if (drop) g.translate(0, drop);
  // Hair under no hat, on a plain round head.
  const headStyle = m.personHead || "round",
    hatted = fig.standing === "prosperous" || fig.standing === "rich";
  if (detail > 0 && headStyle === "round" && !hatted && pose !== "sleep") {
    const hy = -0.65 - (form === "tall" ? 0.12 : 0),
      life = W.components.life[pres.id],
      body = W.components.body[pres.id];
    g.fillStyle = hairTone(pres.id, life, body);
    g.beginPath();
    g.arc(0, hy - 0.02, 0.4, Math.PI * 1.02, Math.PI * 1.98);
    g.lineTo(0.34, hy - 0.06);
    g.lineTo(-0.34, hy - 0.06);
    g.closePath();
    g.fill();
    PRESENCE.hair++;
  }
  if (detail > 0 && pres.task && pose !== "sleep" && pose !== "sit")
    drawHeldTool(g, pres.task, colors.dress?.hue ?? m.secondaryHue, pres.campaign);
  else if (detail > 0 && pres.campaign && pose === "fight") drawHeldTool(g, "raze", colors.dress?.hue ?? m.secondaryHue, true);
  g.restore();
  g.restore();
  return head;
};
window.ALIFE_PRESENCE_DEBUG = Object.freeze({
  scale: (kind) => PRESENCE_SCALE[kind] || 1,
  radius: (id) => presenceRadius(id, presenceKind(id) || "person", VISUAL_MOTION.get(id) || null),
  task: (id) => presenceTask(id),
  torch: (id) => presenceTorch(id),
  counts: () => ({ ...PRESENCE }),
  reset: () => {
    PRESENCE.scaled = 0;
    PRESENCE.tools = 0;
    PRESENCE.hair = 0;
    PRESENCE.torches = 0;
  },
});
