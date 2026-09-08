// ═══════════════════════════════════════════════════════════════════════════
// 104. FAUNA — beasts drawn as beasts: side-view quadrupeds with gait, face, and kind
// ═══════════════════════════════════════════════════════════════════════════
// Herds and hunters were drawn as bilateral blobs seen from above, legs
// splayed to both sides and the whole glyph spun to face its heading, so on
// the Earth-like seed a deer was an insect. A herbivore or predator with a
// bilateral body and four limbs or fewer is now drawn side-on like a person:
// a body slung between four legs that stride in diagonal pairs and stretch to
// a run when it flees or hunts, a neck and head with ears and an eye, a tail
// that swings; the young are drawn small, and spots or bands follow the
// lineage's pattern. And every lineage has a kind, chosen from its genome and
// kept by all its members, so a world's herds are not all deer: grazers are
// deer, boar, goats, bison, hares, or horses, and hunters are wolves, cats,
// bears, foxes, or crocodiles, each with the build, ears, horns, tusks, mane,
// hump, or tail that names it. It faces the way it walks by mirroring instead
// of spinning, dips its head to graze as before, and keeps its lineage's
// hues, so alien worlds keep alien beasts in the same posture. Many-legged
// alien forms keep their old drawing; on the Earth-like world every beast is a
// quadruped. Rendering only reads.
const FAUNA_MAX_LEGS = 4,
  FAUNA_HERBIVORE_KINDS = Object.freeze(["deer", "boar", "goat", "bison", "hare", "horse"]),
  FAUNA_PREDATOR_KINDS = Object.freeze(["wolf", "cat", "bear", "fox", "croc"]),
  FAUNA = { drawn: 0, herbivores: 0, predators: 0, kinds: {} },
  FAUNA_MODELS = new WeakMap();
let ACTIVE_FAUNA = null;
function faunaRoleOf(id) {
  const k = W.kind[id];
  return k === KINDS.HERBIVORE || k === KINDS.PREDATOR ? k : null;
}
// The kind of a lineage, from its genome's build, ornament, and pattern, with a
// lineage roll to split the ties; every member of the lineage shares it.
function faunaArchetype(id, m, role) {
  const g = W.components.genome[id],
    roll = (Math.abs(hashParts(W.seedHash, "fauna-kind", g?.lineageId || id)) % 1000) / 1000,
    bulk = m.bulk || 1,
    aspect = m.aspect || 1,
    ornamented = !!m.ornament && m.ornament !== "none",
    marked = ["bands", "spots", "veins", "rings"].includes(m.pattern);
  if (role === KINDS.HERBIVORE) {
    if (bulk < 0.86 && roll < 0.55) return "hare";
    if (bulk > 1.12) return aspect < 0.95 ? "boar" : "bison";
    if (ornamented) return roll < 0.6 ? "deer" : "goat";
    if (aspect > 1.18) return "horse";
    return roll < 0.45 ? "deer" : roll < 0.75 ? "goat" : "horse";
  }
  if (bulk < 0.86 && roll < 0.6) return "fox";
  if (bulk > 1.15) return "bear";
  if (marked) return roll < 0.75 ? "cat" : "wolf";
  if (aspect > 1.3 && roll < 0.45) return "croc";
  return roll < 0.65 ? "wolf" : "cat";
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
    const kind = faunaArchetype(id, m, role);
    side = {
      ...m,
      topology: "upright",
      personForm: "quadruped",
      faunaRole: role,
      faunaKind: kind,
      sideView: true,
      // The side view draws its own eye, markings, and crest.
      eyes: 0,
      pattern: "plain",
      frill: false,
      spines: 0,
      faunaPattern: m.pattern,
      faunaOrnament: m.ornament,
      label: `${kind[0].toUpperCase()}${kind.slice(1)} ${m.pattern === "plain" ? "" : m.pattern + " "}form${m.ornament && m.ornament !== "none" ? ` · ${m.ornament}` : ""}`,
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
// The build of each kind: where the body sits, how long and deep it is, how
// long the legs are, and what tail it swings.
const FAUNA_BUILDS = Object.freeze({
  deer: { bodyY: 0.55, rx: 0.85, ry: 0.4, legs: 1, tail: "tuft", neck: 1, ears: "long" },
  boar: { bodyY: 0.85, rx: 0.9, ry: 0.5, legs: 0.7, tail: "wisp", neck: 0.5, ears: "small" },
  goat: { bodyY: 0.65, rx: 0.8, ry: 0.42, legs: 0.85, tail: "up", neck: 0.85, ears: "small" },
  bison: { bodyY: 0.6, rx: 1.05, ry: 0.55, legs: 0.8, tail: "wisp", neck: 0.4, ears: "small" },
  hare: { bodyY: 1.05, rx: 0.6, ry: 0.36, legs: 0.5, tail: "puff", neck: 0.5, ears: "ears" },
  horse: { bodyY: 0.5, rx: 0.95, ry: 0.42, legs: 1.05, tail: "flow", neck: 1.25, ears: "small" },
  wolf: { bodyY: 0.78, rx: 1.0, ry: 0.32, legs: 0.85, tail: "bushy", neck: 0.75, ears: "point" },
  cat: { bodyY: 0.9, rx: 1.05, ry: 0.3, legs: 0.75, tail: "long", neck: 0.6, ears: "round" },
  bear: { bodyY: 0.62, rx: 1.0, ry: 0.55, legs: 0.8, tail: "stub", neck: 0.45, ears: "round" },
  fox: { bodyY: 0.95, rx: 0.85, ry: 0.28, legs: 0.65, tail: "brush", neck: 0.65, ears: "point" },
  croc: { bodyY: 1.25, rx: 1.5, ry: 0.22, legs: 0.3, tail: "taper", neck: 0.2, ears: "none" },
});
function drawFauna(g, m, phase, detail, colors) {
  const { primary, secondary, accent, outline } = colors,
    a = ACTIVE_FAUNA || {},
    pred = m.faunaRole === KINDS.PREDATOR,
    kind = m.faunaKind || (pred ? "wolf" : "deer"),
    build = FAUNA_BUILDS[kind] || FAUNA_BUILDS.deer,
    bulk = clamp(m.bulk || 1, 0.7, 1.4),
    aspect = clamp(m.aspect || 1, 0.65, 1.55),
    run = a.moving ? (a.fleeing || a.hunting ? 1.7 : 1) : 0,
    hop = kind === "hare" && a.moving ? Math.abs(Math.sin(phase * 1.5)) * 0.35 : 0,
    stride = Math.sin(phase) * 0.22 * run,
    ground = 1.7,
    bodyY = build.bodyY - hop,
    rx = build.rx * aspect,
    ry = build.ry * bulk,
    legTop = bodyY + ry * 0.55,
    legLen = (ground - legTop) * build.legs,
    footY = legTop + legLen,
    young = a.young ? 0.68 : 1,
    dark = hsl(m.primaryHue, m.sat, Math.max(16, m.light - 20)),
    pale = hsl(m.secondaryHue, Math.max(20, m.sat - 15), Math.min(84, m.light + 24), 0.8);
  g.save();
  if (young < 1) {
    g.translate(0, ground);
    g.scale(young, young);
    g.translate(0, -ground);
  }
  g.lineCap = "round";
  // Legs: the far pair darker and first, diagonal pairs in step; a crocodile's splay.
  const legs =
    kind === "croc"
      ? [
          { x: -rx * 0.55, far: true, sign: 1, splay: -0.25 },
          { x: rx * 0.45, far: true, sign: -1, splay: 0.25 },
          { x: -rx * 0.5, far: false, sign: -1, splay: -0.3 },
          { x: rx * 0.5, far: false, sign: 1, splay: 0.3 },
        ]
      : [
          { x: -rx * 0.62, far: true, sign: 1, splay: 0 },
          { x: rx * 0.55, far: true, sign: -1, splay: 0 },
          { x: -rx * 0.55, far: false, sign: -1, splay: 0 },
          { x: rx * 0.62, far: false, sign: 1, splay: 0 },
        ];
  legs.forEach((leg, n) => {
    if (!creatureAppendageVisible(m, n)) return;
    g.strokeStyle = leg.far ? dark : secondary;
    g.fillStyle = g.strokeStyle;
    const width = kind === "bear" || kind === "bison" ? 0.17 : pred ? 0.13 : kind === "hare" ? 0.09 : 0.1,
      kick = kind === "hare" && n >= 2 ? stride * 1.6 : stride;
    creatureLimbStyled(g, m, leg.x, legTop, leg.x + kick * leg.sign + leg.splay, footY - (a.moving ? Math.abs(stride) * 0.25 : 0), width, phase + n);
  });
  // Tail by kind.
  g.strokeStyle = primary;
  g.lineWidth = 0.1;
  g.beginPath();
  const tailX = -rx * 0.95,
    tailY = bodyY - ry * 0.3,
    swing = Math.sin(phase * 0.6) * 0.12;
  if (build.tail === "bushy" || build.tail === "brush") {
    g.lineWidth = build.tail === "brush" ? 0.3 : 0.24;
    g.moveTo(tailX, tailY);
    g.quadraticCurveTo(-rx * 1.3, bodyY - ry * 0.5 + swing, -rx * 1.6, bodyY - ry * 0.9 + swing * 2);
    g.stroke();
    if (build.tail === "brush") {
      g.fillStyle = pale;
      g.beginPath();
      g.arc(-rx * 1.6, bodyY - ry * 0.9 + swing * 2, 0.16, 0, Math.PI * 2);
      g.fill();
    }
  } else if (build.tail === "long") {
    g.lineWidth = 0.1;
    g.moveTo(tailX, tailY);
    g.quadraticCurveTo(-rx * 1.5, bodyY - ry * 0.2, -rx * 1.55, bodyY - ry * 2.2 + swing * 3);
    g.stroke();
  } else if (build.tail === "flow") {
    g.lineWidth = 0.08;
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.moveTo(tailX, tailY);
      g.quadraticCurveTo(-rx * 1.2 + swing, bodyY + ry * 0.4 + k * 0.1, -rx * 1.25 + swing * 2 + k * 0.08, bodyY + ry * 1.6);
      g.stroke();
    }
  } else if (build.tail === "taper") {
    g.fillStyle = primary;
    g.beginPath();
    g.moveTo(tailX, tailY - ry * 0.6);
    g.quadraticCurveTo(-rx * 1.6, tailY + swing, -rx * 2.1, tailY + ry * 0.4 + swing * 2);
    g.lineTo(tailX, tailY + ry * 0.6);
    g.closePath();
    g.fill();
  } else if (build.tail === "puff") {
    g.fillStyle = pale;
    g.beginPath();
    g.arc(tailX - 0.05, tailY, 0.16, 0, Math.PI * 2);
    g.fill();
  } else if (build.tail === "up") {
    g.lineWidth = 0.1;
    g.moveTo(tailX, tailY);
    g.lineTo(tailX - 0.15, tailY - ry * 1.1 + swing);
    g.stroke();
  } else if (build.tail === "stub") {
    g.fillStyle = primary;
    g.beginPath();
    g.arc(tailX, tailY, 0.1, 0, Math.PI * 2);
    g.fill();
  } else {
    g.lineWidth = 0.1;
    g.moveTo(tailX, tailY);
    g.lineTo(-rx * 1.12, bodyY - ry * 0.05 + swing);
    g.stroke();
  }
  // Body and belly; a bison's or bear's hump at the shoulder.
  g.fillStyle = primary;
  g.strokeStyle = outline;
  g.lineWidth = 0.12;
  g.beginPath();
  g.ellipse(0, bodyY, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (kind === "bison" || kind === "bear" || kind === "boar") {
    g.fillStyle = kind === "bison" ? dark : primary;
    g.beginPath();
    g.ellipse(rx * 0.35, bodyY - ry * 0.55, rx * 0.5, ry * 0.7, -0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.fillStyle = pale;
  g.beginPath();
  g.ellipse(0, bodyY + ry * 0.4, rx * 0.8, ry * 0.42, 0, 0, Math.PI);
  g.fill();
  // Markings by lineage; a boar's bristle ridge; a crocodile's scaly back.
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
    if (kind === "boar" || kind === "croc") {
      g.strokeStyle = dark;
      g.lineWidth = 0.06;
      g.beginPath();
      for (let n = -3; n <= 3; n++) {
        const x = n * rx * 0.25;
        g.moveTo(x, bodyY - ry * 0.98);
        g.lineTo(x + 0.02, bodyY - ry * (kind === "croc" ? 1.3 : 1.25));
      }
      g.stroke();
    }
  }
  // Neck and head; a horse's mane, a crocodile's flat snout.
  const neck = build.neck,
    hx = rx * (kind === "croc" ? 1.55 : 1.05 + neck * 0.12),
    hy = kind === "croc" ? bodyY : bodyY - ry * 0.4 - neck * 0.55,
    hr = (pred ? 0.3 : 0.26) * bulk * (kind === "hare" ? 0.85 : 1),
    muzzle = kind === "croc" ? 2.4 : pred ? 1.75 : kind === "horse" ? 1.7 : kind === "boar" ? 1.5 : 1.45;
  g.strokeStyle = primary;
  g.lineWidth = (pred ? 0.34 : 0.24) * bulk * (kind === "horse" ? 0.9 : kind === "bison" ? 1.4 : 1);
  g.beginPath();
  g.moveTo(rx * 0.8, bodyY - ry * 0.35);
  g.lineTo(hx - hr * 0.5, hy + hr * 0.4);
  g.stroke();
  if (kind === "horse" && detail) {
    g.strokeStyle = dark;
    g.lineWidth = 0.07;
    g.beginPath();
    for (let n = 0; n < 4; n++) {
      const t = n / 3,
        x = rx * 0.8 + (hx - hr * 0.5 - rx * 0.8) * t,
        y = bodyY - ry * 0.35 + (hy + hr * 0.4 - bodyY + ry * 0.35) * t;
      g.moveTo(x, y - 0.1);
      g.lineTo(x - 0.16, y - 0.34);
    }
    g.stroke();
  }
  g.fillStyle = primary;
  g.strokeStyle = outline;
  g.lineWidth = 0.1;
  g.beginPath();
  g.ellipse(hx, hy, hr * (kind === "croc" ? 1.4 : 1.15), hr * (kind === "croc" ? 0.55 : 0.8), pred ? 0.1 : -0.2, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // Muzzle or snout.
  g.fillStyle = primary;
  g.beginPath();
  g.moveTo(hx + hr * 0.9, hy - hr * (kind === "croc" ? 0.3 : 0.25));
  g.lineTo(hx + hr * muzzle, hy + hr * (kind === "croc" ? 0.05 : 0.15));
  g.lineTo(hx + hr * 0.8, hy + hr * (kind === "croc" ? 0.4 : 0.5));
  g.closePath();
  g.fill();
  g.stroke();
  if (detail) {
    if (kind === "croc") {
      g.fillStyle = "#f2f0e6";
      for (let n = 0; n < 4; n++) {
        const x = hx + hr * (1.1 + n * 0.3);
        g.beginPath();
        g.moveTo(x, hy + hr * 0.15);
        g.lineTo(x + hr * 0.08, hy + hr * 0.35);
        g.lineTo(x + hr * 0.16, hy + hr * 0.15);
        g.closePath();
        g.fill();
      }
    } else if (kind === "boar") {
      g.strokeStyle = "#f2f0e6";
      g.lineWidth = 0.07;
      g.beginPath();
      g.moveTo(hx + hr * 1.2, hy + hr * 0.3);
      g.quadraticCurveTo(hx + hr * 1.35, hy - hr * 0.05, hx + hr * 1.55, hy - hr * 0.2);
      g.stroke();
    } else if (kind === "goat") {
      g.strokeStyle = pale;
      g.lineWidth = 0.08;
      g.beginPath();
      g.moveTo(hx + hr * 0.7, hy + hr * 0.6);
      g.lineTo(hx + hr * 0.6, hy + hr * 1.15);
      g.stroke();
    }
  }
  // Ears by kind.
  g.fillStyle = secondary;
  if (build.ears !== "none") {
    const long = build.ears === "ears" ? 2.6 : build.ears === "long" ? 1.35 : build.ears === "point" ? 1.3 : 0.95,
      round = build.ears === "round" || build.ears === "small";
    for (const side of [-0.45, 0.15]) {
      g.beginPath();
      if (round) {
        g.arc(hx + hr * (side + 0.2), hy - hr * 0.7, hr * (build.ears === "round" ? 0.32 : 0.22), 0, Math.PI * 2);
      } else {
        g.moveTo(hx + hr * side, hy - hr * 0.55);
        g.lineTo(hx + hr * (side + 0.05), hy - hr * long);
        g.lineTo(hx + hr * (side + 0.4), hy - hr * 0.6);
        g.closePath();
      }
      g.fill();
    }
  }
  // Horns and antlers: a grazer's ornament as antlers, a goat's or bison's curved horns.
  if (!pred && detail) {
    if (kind === "goat" || kind === "bison") {
      g.strokeStyle = pale;
      g.lineWidth = kind === "bison" ? 0.1 : 0.08;
      for (const side of [-0.2, 0.25]) {
        g.beginPath();
        g.moveTo(hx + hr * side, hy - hr * 0.7);
        g.quadraticCurveTo(hx + hr * (side - 0.5), hy - hr * 1.6, hx + hr * (side - 0.9), hy - hr * (kind === "bison" ? 1.2 : 1.9));
        g.stroke();
      }
    } else if (kind === "deer" && m.faunaOrnament && m.faunaOrnament !== "none") {
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
  }
  // One eye, side on; a hunter's glows when it has a quarry.
  const eyeX = hx + hr * (kind === "croc" ? 0.6 : 0.45),
    eyeY = hy - hr * (kind === "croc" ? 0.3 : 0.1);
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
  FAUNA.kinds[kind] = (FAUNA.kinds[kind] || 0) + 1;
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
    return m ? { topology: m.topology, personForm: m.personForm, sideView: !!m.sideView, role: m.faunaRole || null, kind: m.faunaKind || null, appendages: m.appendages, pattern: m.faunaPattern || m.pattern, label: m.label } : null;
  },
  kinds: () => {
    const out = {};
    for (const id of W.activeIds) {
      const role = faunaRoleOf(id);
      if (!role || !classifyAlive(id)) continue;
      const m = creatureModel(id);
      if (m?.faunaKind) out[m.faunaKind] = (out[m.faunaKind] || 0) + 1;
    }
    return out;
  },
  builds: () => Object.keys(FAUNA_BUILDS),
  counts: () => ({ ...FAUNA, kinds: { ...FAUNA.kinds } }),
  reset: () => {
    FAUNA.drawn = 0;
    FAUNA.herbivores = 0;
    FAUNA.predators = 0;
    FAUNA.kinds = {};
  },
});
