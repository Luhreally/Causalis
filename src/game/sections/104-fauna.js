// ═══════════════════════════════════════════════════════════════════════════
// 104. FAUNA — beasts drawn as beasts: side-view quadrupeds with gait and face
// ═══════════════════════════════════════════════════════════════════════════
// Herds and hunters were drawn as bilateral blobs seen from above, legs
// splayed to both sides and the whole glyph spun to face its heading, so on
// the Earth-like seed a deer was an insect. A herbivore or predator with a
// bilateral body and four limbs or fewer is now drawn side-on like a person:
// a body slung between four legs that stride in diagonal pairs and stretch to
// a run when it flees or hunts, a neck and head with ears and an eye, a tail
// that swings, horns or antlers on a grazer that carries an ornament, a low
// long body and a pointed muzzle on a hunter; the young are drawn small, and
// spots or bands follow the lineage's pattern. It faces the way it walks by
// mirroring instead of spinning, dips its head to graze as before, and keeps
// its lineage's hues, so alien worlds keep alien beasts in the same posture.
// Many-legged alien forms keep their old drawing; on the Earth-like world every
// beast is a quadruped. Rendering only reads.
const FAUNA_MAX_LEGS = 4,
  FAUNA = { drawn: 0, herbivores: 0, predators: 0 },
  FAUNA_MODELS = new WeakMap();
let ACTIVE_FAUNA = null;
function faunaRoleOf(id) {
  const k = W.kind[id];
  return k === KINDS.HERBIVORE || k === KINDS.PREDATOR ? k : null;
}
const creatureModelFaunaBase = creatureModel;
creatureModel = function (id) {
  const m = creatureModelFaunaBase(id);
  if (!m || m.topology !== "bilateral") return m;
  const role = faunaRoleOf(id);
  if (!role) return m;
  // On an Earth-like world every beast is a quadruped whatever its genome's limb
  // count says; elsewhere only the four-limbed and fewer take the side view.
  const earthlike = !!(ACTIVE_PLANET_VISUAL || makePlanetVisualGenome()).earthlike;
  if (!earthlike && (m.appendages || 0) > FAUNA_MAX_LEGS) return m;
  let side = FAUNA_MODELS.get(m);
  if (!side) {
    side = {
      ...m,
      topology: "upright",
      personForm: "quadruped",
      faunaRole: role,
      sideView: true,
      // The side view draws its own eye, markings, and crest.
      eyes: 0,
      pattern: "plain",
      frill: false,
      spines: 0,
      faunaPattern: m.pattern,
      faunaOrnament: m.ornament,
      label: `${role === KINDS.PREDATOR ? "Hunter" : "Grazer"} ${m.pattern === "plain" ? "" : m.pattern + " "}form${m.ornament && m.ornament !== "none" ? ` · ${m.ornament}` : ""}`,
    };
    FAUNA_MODELS.set(m, side);
  }
  return side;
};
const drawCreatureGlyphFaunaBase = drawCreatureGlyph;
drawCreatureGlyph = function (g, id, s, now, fac = null, scaleOverride = 0, portrait = false, motion = null) {
  const role = faunaRoleOf(id);
  if (!role) return drawCreatureGlyphFaunaBase(g, id, s, now, fac, scaleOverride, portrait, motion);
  const life = W.components.life[id],
    body = W.components.body[id];
  ACTIVE_FAUNA = {
    moving: !!motion?.moving,
    young: !!(life && body && life.age < (body.maturityAge ?? 1200)),
    hunting: role === KINDS.PREDATOR && !!life?.preyTargetId,
    fleeing: life?.behavior === "flee",
    now,
  };
  try {
    return drawCreatureGlyphFaunaBase(g, id, s, now, fac, scaleOverride, portrait, motion);
  } finally {
    ACTIVE_FAUNA = null;
  }
};
function drawFauna(g, m, phase, detail, colors) {
  const { primary, secondary, accent, outline } = colors,
    a = ACTIVE_FAUNA || {},
    pred = m.faunaRole === KINDS.PREDATOR,
    bulk = clamp(m.bulk || 1, 0.7, 1.4),
    aspect = clamp(m.aspect || 1, 0.65, 1.55),
    run = a.moving ? (a.fleeing || a.hunting ? 1.7 : 1) : 0,
    stride = Math.sin(phase) * 0.22 * run,
    bodyY = pred ? 0.78 : 0.55,
    rx = (pred ? 1.0 : 0.85) * aspect,
    ry = (pred ? 0.34 : 0.42) * bulk,
    ground = 1.7,
    legTop = bodyY + ry * 0.55,
    young = a.young ? 0.68 : 1;
  g.save();
  if (young < 1) {
    g.translate(0, ground);
    g.scale(young, young);
    g.translate(0, -ground);
  }
  g.lineCap = "round";
  // Legs: the far pair darker and first, diagonal pairs in step.
  const legs = [
    { x: -rx * 0.62, far: true, sign: 1 },
    { x: rx * 0.55, far: true, sign: -1 },
    { x: -rx * 0.55, far: false, sign: -1 },
    { x: rx * 0.62, far: false, sign: 1 },
  ];
  legs.forEach((leg, n) => {
    if (!creatureAppendageVisible(m, n)) return;
    g.strokeStyle = leg.far ? hsl(m.primaryHue, m.sat, Math.max(20, m.light - 18)) : secondary;
    g.fillStyle = g.strokeStyle;
    creatureLimbStyled(g, m, leg.x, legTop, leg.x + stride * leg.sign, ground - (a.moving ? Math.abs(stride) * 0.25 : 0), pred ? 0.14 : 0.1, phase + n);
  });
  // Tail.
  g.strokeStyle = primary;
  g.lineWidth = pred ? 0.14 : 0.1;
  g.beginPath();
  g.moveTo(-rx * 0.95, bodyY - ry * 0.3);
  if (pred) g.quadraticCurveTo(-rx * 1.35, bodyY - ry * 0.9 + Math.sin(phase * 0.5) * 0.12, -rx * 1.6, bodyY - 0.4 + Math.sin(phase * 0.5) * 0.15);
  else g.lineTo(-rx * 1.12, bodyY - ry * 0.05 + Math.sin(phase * 0.7) * 0.08);
  g.stroke();
  // Body and belly.
  g.fillStyle = primary;
  g.strokeStyle = outline;
  g.lineWidth = 0.12;
  g.beginPath();
  g.ellipse(0, bodyY, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = hsl(m.secondaryHue, Math.max(20, m.sat - 15), Math.min(80, m.light + 22), 0.55);
  g.beginPath();
  g.ellipse(0, bodyY + ry * 0.4, rx * 0.8, ry * 0.42, 0, 0, Math.PI);
  g.fill();
  // Markings by lineage.
  if (detail) {
    const pattern = m.faunaPattern || "plain";
    if (pattern === "spots" || pattern === "rings") {
      g.fillStyle = hsl(m.secondaryHue, m.sat, Math.max(18, m.light - 22), 0.7);
      for (let n = 0; n < 5; n++) {
        const t = (n + 0.5) / 5;
        g.beginPath();
        g.arc(-rx * 0.75 + rx * 1.5 * t, bodyY - ry * 0.35 + (n % 2) * ry * 0.4, ry * (pattern === "rings" ? 0.16 : 0.12), 0, Math.PI * 2);
        g.fill();
      }
    } else if (pattern === "bands" || pattern === "veins") {
      g.strokeStyle = hsl(m.secondaryHue, m.sat, Math.max(14, m.light - 26), 0.65);
      g.lineWidth = ry * 0.22;
      g.beginPath();
      for (let n = 0; n < 4; n++) {
        const x = -rx * 0.55 + rx * 0.37 * n;
        g.moveTo(x, bodyY - ry * 0.85);
        g.lineTo(x + rx * 0.08, bodyY + ry * 0.35);
      }
      g.stroke();
    }
  }
  // Neck and head.
  const hx = pred ? rx * 1.08 : rx * 1.18,
    hy = pred ? bodyY - ry * 0.75 : bodyY - 0.92,
    hr = pred ? 0.3 * bulk : 0.26 * bulk;
  g.strokeStyle = primary;
  g.lineWidth = pred ? 0.34 * bulk : 0.24 * bulk;
  g.beginPath();
  g.moveTo(rx * 0.8, bodyY - ry * 0.35);
  g.lineTo(hx - hr * 0.5, hy + hr * 0.4);
  g.stroke();
  g.fillStyle = primary;
  g.strokeStyle = outline;
  g.lineWidth = 0.1;
  g.beginPath();
  g.ellipse(hx, hy, hr * 1.15, hr * 0.8, pred ? 0.1 : -0.2, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // Muzzle, ears, and a grazer's horns.
  g.fillStyle = primary;
  g.beginPath();
  if (pred) {
    g.moveTo(hx + hr * 0.9, hy - hr * 0.25);
    g.lineTo(hx + hr * 1.75, hy + hr * 0.15);
    g.lineTo(hx + hr * 0.9, hy + hr * 0.45);
  } else {
    g.moveTo(hx + hr * 0.9, hy - hr * 0.1);
    g.lineTo(hx + hr * 1.45, hy + hr * 0.3);
    g.lineTo(hx + hr * 0.8, hy + hr * 0.55);
  }
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = secondary;
  for (const side of [-0.45, 0.15]) {
    g.beginPath();
    g.moveTo(hx + hr * side, hy - hr * 0.55);
    g.lineTo(hx + hr * (side + (pred ? 0.12 : 0.05)), hy - hr * (pred ? 1.45 : 1.25));
    g.lineTo(hx + hr * (side + 0.4), hy - hr * 0.6);
    g.closePath();
    g.fill();
  }
  if (!pred && detail && m.faunaOrnament && m.faunaOrnament !== "none") {
    g.strokeStyle = accent;
    g.lineWidth = 0.07;
    g.beginPath();
    for (const side of [-0.25, 0.25]) {
      g.moveTo(hx + hr * side, hy - hr * 0.7);
      g.lineTo(hx + hr * side * 2.2, hy - hr * 1.9);
      g.moveTo(hx + hr * side * 1.4, hy - hr * 1.25);
      g.lineTo(hx + hr * side * 2.6, hy - hr * 1.55);
    }
    g.stroke();
  }
  // One eye, side on; a hunter's glows when it has a quarry.
  const eyeX = hx + hr * 0.45,
    eyeY = hy - hr * 0.1;
  g.fillStyle = pred && a.hunting ? accent : hsl(m.accentHue, 65, 82);
  g.beginPath();
  g.arc(eyeX, eyeY, hr * 0.22, 0, Math.PI * 2);
  g.fill();
  if (detail > 1) {
    g.fillStyle = "rgba(10,8,14,0.9)";
    g.beginPath();
    g.arc(eyeX + hr * 0.06, eyeY, hr * 0.1, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  FAUNA.drawn++;
  if (pred) FAUNA.predators++;
  else FAUNA.herbivores++;
  return { x: hx, y: hy, r: 0 };
}
const drawUprightPersonFaunaBase = drawUprightPerson;
drawUprightPerson = function (g, m, phase, detail, colors) {
  if (m.faunaRole && m.personForm === "quadruped") return drawFauna(g, m, phase, detail, colors);
  return drawUprightPersonFaunaBase(g, m, phase, detail, colors);
};
window.ALIFE_FAUNA_DEBUG = Object.freeze({
  model: (id) => {
    const m = creatureModel(id);
    return m ? { topology: m.topology, personForm: m.personForm, sideView: !!m.sideView, role: m.faunaRole || null, appendages: m.appendages, pattern: m.faunaPattern || m.pattern, label: m.label } : null;
  },
  counts: () => ({ ...FAUNA }),
  reset: () => {
    FAUNA.drawn = 0;
    FAUNA.herbivores = 0;
    FAUNA.predators = 0;
  },
});
