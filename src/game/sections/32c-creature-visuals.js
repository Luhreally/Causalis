// ═══════════════════════════════════════════════════════════════════════════
// 32C. PROCEDURAL CREATURE MODEL GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
function creatureSourceKind(id) {
  const k = W.kind[id];
  if (k !== KINDS.CORPSE) return k;
  const diet = W.components.body[id]?.diet;
  return diet === "tissue-compatible"
    ? KINDS.PREDATOR
    : diet === "producer-compatible"
      ? KINDS.HERBIVORE
      : KINDS.PERSON;
}
function creatureGene(g, n) {
  const q = g?.instructions?.[n];
  return q?.active ? clamp(q.expression * q.copies, 0, 1.8) : 0;
}
function creatureMorphSignature(g) {
  return [4, 6, 7, 8, 10, 11, 12].map((n) => Math.round(creatureGene(g, n) * 4)).join("");
}
function creatureModel(id) {
  const g = W.components.genome[id],
    role = creatureSourceKind(id),
    v = makePlanetVisualGenome(),
    signature = creatureMorphSignature(g),
    key = `${v.key}:${role}:${g?.lineageId || id}:${signature}:${id}`;
  if (CREATURE_VISUAL_CACHE.has(key)) return CREATURE_VISUAL_CACHE.get(key);
  const seed = hashParts(
      W.seedHash,
      "creature-model-v3",
      role,
      g?.lineageId || id,
      g?.ancestorSignature || 0,
      signature,
    ),
    r = makeRng(seed, "morphology"),
    growth = creatureGene(g, 6),
    receptor = creatureGene(g, 7),
    actuator = creatureGene(g, 8),
    support = creatureGene(g, 4),
    thermal = creatureGene(g, 11),
    signal = creatureGene(g, 12),
    detox = creatureGene(g, 10),
    transport = creatureGene(g, 2),
    fauna = v.fauna || null,
    topology = v.earthlike
      ? role === KINDS.PERSON
        ? "upright"
        : "bilateral"
      : role === KINDS.PERSON && fauna && r.next() < fauna.people.uprightShare
        ? "upright"
        : weightedFaunaPlan(fauna, r),
    segments = clamp(1 + Math.floor(growth * 4) + r.int(3), 1, 8),
    appendages =
      topology === "radial"
        ? clamp(3 + Math.floor(actuator * 4) + r.int(3), 3, 10)
        : topology === "tripod"
          ? 3
          : clamp(2 + Math.floor(actuator * 3) * 2, 2, 10),
    eyes = clamp(Math.floor(receptor * 3) + r.int(3), 0, 7),
    armor = clamp(support * 0.65 + (W.components.body[id]?.armor || 0) * 0.4, 0, 1.4),
    shell = topology === "shelled" || armor > 0.83 || r.next() < support * 0.16,
    frill = thermal > 0.72 || signal > 0.82 || r.next() < 0.12,
    spines = clamp(Math.floor((support + (peekPhenotype(id)?.aggression || 0)) * 2.2), 0, 5),
    glow = signal > 0.55 || detox > 0.9 || r.next() < v.alienness * 0.2,
    patterns = fauna ? fauna.patterns : ["spots", "bands", "veins", "plates", "rings", "plain"],
    pattern = patterns[r.int(patterns.length)],
    aspect = clamp(
      0.72 + transport * 0.3 + (peekPhenotype(id)?.speed || 1) * 0.16 + r.range(-0.12, 0.16),
      0.65,
      1.55,
    ),
    pigment = chemistryHue(C.PIGMENT, v.creatureHue),
    roleShift = role === KINDS.PREDATOR ? 24 : role === KINDS.PERSON ? -18 : 0,
    primaryHue = wrapHue(mixHue(v.creatureHue, pigment, 0.42) + roleShift + r.range(-14, 14)),
    secondaryHue = wrapHue(primaryHue + (v.earthlike ? r.range(18, 55) : r.range(72, 168))),
    accentHue = wrapHue(mixHue(v.accentHue, primaryHue + 160, 0.3)),
    sat = r.range(49, 71),
    light = r.range(42, 58),
    individualVariation = r.range(0.03, 0.1),
    // World-level morphospace, drawn after the hue stream so palettes hold.
    limbStyle = fauna ? fauna.limbStyle : "jointed",
    headStyle = fauna ? fauna.headStyle : "bulb",
    tail = fauna ? fauna.tail : "none",
    skin = fauna ? fauna.skin : "matte",
    eyeStyle = fauna ? fauna.eyeStyle : "dot",
    ornament = fauna && r.next() < fauna.ornamentChance ? fauna.ornament : "none",
    bulk = fauna ? +(fauna.silhouette.bulk * r.range(0.92, 1.08)).toFixed(3) : 1,
    limbLength = fauna ? +(fauna.silhouette.limb * r.range(0.9, 1.1)).toFixed(3) : 1,
    neck = fauna ? fauna.silhouette.neck : 0,
    personForm =
      topology === "upright" ? (v.earthlike ? "biped" : fauna?.people.form || "biped") : null,
    personHead =
      topology === "upright" ? (v.earthlike ? "round" : fauna?.people.head || "round") : null;
  const model = {
    limbStyle,
    headStyle,
    tail,
    skin,
    eyeStyle,
    ornament,
    bulk,
    limbLength,
    neck,
    personForm,
    personHead,
    key,
    role,
    topology,
    segments,
    appendages,
    eyes,
    armor,
    shell,
    frill,
    spines,
    glow,
    pattern,
    aspect,
    primaryHue,
    secondaryHue,
    accentHue,
    sat,
    light,
    individualVariation,
    label:
      `${titleCase(topology)} ${shell ? "armored " : ""}${pattern === "plain" ? "" : pattern + " "}form${
        topology === "upright"
          ? personForm && personForm !== "biped"
            ? ` · ${personForm} build`
            : ""
          : `${headStyle !== "none" && headStyle !== "bulb" ? ` · ${headStyle} head` : ""}${
              limbStyle !== "jointed" ? ` · ${limbStyle} limbs` : ""
            }${skin !== "matte" ? ` · ${skin} skin` : ""}`
      }`
        .replace(/\s+/g, " ")
        .trim(),
  };
  CREATURE_VISUAL_CACHE.set(key, model);
  return model;
}
function weightedFaunaPlan(fauna, r) {
  if (!fauna) return FAUNA_PLANS[r.int(FAUNA_PLANS.length)];
  const total = fauna.planWeights.reduce((a, b) => a + b, 0) || 1;
  let roll = r.next() * total;
  for (let n = 0; n < FAUNA_PLANS.length; n++) {
    roll -= fauna.planWeights[n];
    if (roll <= 0) return FAUNA_PLANS[n];
  }
  return FAUNA_PLANS[FAUNA_PLANS.length - 1];
}
function creatureLimb(g, x, y, ex, ey, bend, phase) {
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(
    (x + ex) / 2 + Math.cos(phase) * bend,
    (y + ey) / 2 + Math.sin(phase) * bend,
    ex,
    ey,
  );
  g.stroke();
}
function creatureAppendageVisible(model, index) {
  return !(model.missingAppendageIndices || []).includes(index);
}
// A limb in the world's limb style. Endpoints scale with the model's limb
// length; the tip shape says how this world's animals meet the ground.
function creatureLimbStyled(g, m, x, y, ex, ey, bend, phase) {
  const len = m.limbLength || 1,
    tx = x + (ex - x) * len,
    ty = y + (ey - y) * len,
    style = m.limbStyle || "jointed",
    width = g.lineWidth;
  g.beginPath();
  if (style === "stilt") {
    g.moveTo(x, y);
    g.lineTo(tx, ty);
    g.stroke();
    g.beginPath();
    g.arc(tx, ty, 0.05, 0, Math.PI * 2);
    g.fill();
    return;
  }
  if (style === "tentacle") {
    const mx = (x + tx) / 2,
      my = (y + ty) / 2,
      wob = Math.sin(phase * 1.7) * bend * 1.6;
    g.lineWidth = width * 0.75;
    g.moveTo(x, y);
    g.bezierCurveTo(
      mx + Math.cos(phase) * bend * 2,
      my + Math.sin(phase) * bend * 2,
      tx - wob,
      ty + wob,
      tx + Math.cos(phase + 1) * 0.08,
      ty + Math.sin(phase + 1) * 0.08,
    );
    g.stroke();
    g.lineWidth = width;
    return;
  }
  g.moveTo(x, y);
  g.quadraticCurveTo(
    (x + tx) / 2 + Math.cos(phase) * bend,
    (y + ty) / 2 + Math.sin(phase) * bend,
    tx,
    ty,
  );
  g.stroke();
  if (style === "paddle") {
    g.beginPath();
    g.ellipse(tx, ty, 0.14, 0.08, Math.atan2(ty - y, tx - x), 0, Math.PI * 2);
    g.fill();
  } else if (style === "hooked") {
    const a = Math.atan2(ty - y, tx - x);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + Math.cos(a + 2.4) * 0.12, ty + Math.sin(a + 2.4) * 0.12);
    g.stroke();
  }
}
function drawCreaturePattern(g, m, primary, secondary, accent, detail) {
  if (detail < 1 || m.pattern === "plain") return;
  g.lineWidth = 0.08;
  g.strokeStyle = secondary;
  g.fillStyle = m.glow ? accent : secondary;
  const rx = m.aspect || 0.8;
  if (m.pattern === "spots") {
    for (let n = 0; n < Math.min(5, m.segments + 2); n++) {
      const x = -0.52 + n * 0.27,
        y = n % 2 ? -0.18 : 0.2;
      g.beginPath();
      g.arc(x, y, 0.09 + (n % 3) * 0.018, 0, Math.PI * 2);
      g.fill();
    }
  } else if (m.pattern === "bands") {
    g.beginPath();
    for (let n = -2; n <= 2; n++) {
      g.moveTo(n * 0.27, -0.5);
      g.lineTo(n * 0.18, 0.5);
    }
    g.stroke();
  } else if (m.pattern === "veins") {
    g.beginPath();
    g.moveTo(-0.72, 0);
    g.quadraticCurveTo(0, -0.22, 0.72, 0.04);
    g.moveTo(-0.1, -0.08);
    g.lineTo(0.2, -0.42);
    g.moveTo(0.18, 0.02);
    g.lineTo(0.44, 0.38);
    g.stroke();
  } else if (m.pattern === "rings") {
    g.beginPath();
    g.ellipse(0, 0, 0.58, 0.31, 0, 0, Math.PI * 2);
    g.stroke();
  } else if (m.pattern === "speckle") {
    for (let n = 0; n < (detail > 1 ? 14 : 7); n++) {
      const a = n * 2.399,
        rr = 0.12 + (((n * 37) % 100) / 100) * 0.4;
      g.beginPath();
      g.arc(Math.cos(a) * rr * rx, Math.sin(a) * rr * 0.55, 0.035, 0, Math.PI * 2);
      g.fill();
    }
  } else if (m.pattern === "mosaic") {
    g.lineWidth = 0.045;
    for (let n = 0; n < 6; n++) {
      const x = -0.5 + n * 0.2,
        y = n % 2 ? -0.16 : 0.14;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        if (k) g.lineTo(x + Math.cos(a) * 0.11, y + Math.sin(a) * 0.11);
        else g.moveTo(x + Math.cos(a) * 0.11, y + Math.sin(a) * 0.11);
      }
      g.closePath();
      g.stroke();
    }
  } else if (m.pattern === "gradient") {
    g.globalAlpha = 0.5;
    g.beginPath();
    g.ellipse(-rx * 0.35, 0, rx * 0.55, 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  } else if (m.pattern === "stripes") {
    g.beginPath();
    for (let n = -3; n <= 3; n++) {
      g.moveTo(n * 0.2 - 0.18, -0.48);
      g.lineTo(n * 0.2 + 0.18, 0.48);
    }
    g.stroke();
  } else {
    for (let n = -2; n <= 2; n++) {
      g.fillStyle = n % 2 ? secondary : accent;
      g.beginPath();
      g.moveTo(n * 0.24 - 0.13, -0.42);
      g.lineTo(n * 0.24 + 0.13, -0.42);
      g.lineTo(n * 0.24 + 0.08, 0.42);
      g.lineTo(n * 0.24 - 0.08, 0.42);
      g.closePath();
      g.fill();
    }
  }
}
// Heads sit at the front (+x) of a crawling body. Returns where the eyes go.
function drawCreatureHead(g, m, phase, detail, colors, frontX) {
  if (!m.headStyle || m.headStyle === "none" || detail < 1) return { x: frontX, y: 0, r: 0 };
  const { primary, secondary, accent, outline } = colors,
    bulk = m.bulk || 1,
    neck = (m.neck || 0) * 0.28,
    hr = 0.26 * bulk,
    hx = frontX + neck + hr * 0.7,
    hy = Math.sin(phase * 0.5) * 0.03;
  if (neck > 0.05) {
    g.strokeStyle = primary;
    g.lineWidth = 0.22 * bulk;
    g.beginPath();
    g.moveTo(frontX - 0.1, 0);
    g.lineTo(hx - hr * 0.5, hy);
    g.stroke();
  }
  g.fillStyle = primary;
  g.strokeStyle = outline;
  g.lineWidth = 0.09;
  g.beginPath();
  if (m.headStyle === "hood") g.ellipse(hx, hy, hr * 1.35, hr * 0.7, 0, 0, Math.PI * 2);
  else if (m.headStyle === "stalks") g.arc(hx, hy, hr * 0.8, 0, Math.PI * 2);
  else g.arc(hx, hy, hr, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (m.headStyle === "beak") {
    g.fillStyle = accent;
    g.beginPath();
    g.moveTo(hx + hr * 0.8, hy - hr * 0.35);
    g.lineTo(hx + hr * 1.7, hy);
    g.lineTo(hx + hr * 0.8, hy + hr * 0.35);
    g.closePath();
    g.fill();
  } else if (m.headStyle === "crest") {
    g.fillStyle = accent;
    g.beginPath();
    for (let n = 0; n < 3; n++) {
      const a = -Math.PI / 2 - 0.5 + n * 0.5;
      g.moveTo(hx, hy);
      g.lineTo(hx + Math.cos(a) * hr * 1.9, hy + Math.sin(a) * hr * 1.9);
      g.lineTo(hx + Math.cos(a + 0.25) * hr * 1.1, hy + Math.sin(a + 0.25) * hr * 1.1);
    }
    g.closePath();
    g.fill();
  } else if (m.headStyle === "stalks") {
    g.strokeStyle = secondary;
    g.lineWidth = 0.07;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(hx, hy + s * hr * 0.3);
      g.quadraticCurveTo(hx + hr * 0.9, hy + s * hr * 1.1, hx + hr * 1.3, hy + s * hr * 1.5);
      g.stroke();
    }
    return { x: hx + hr * 1.3, y: hy, r: hr, stalks: true };
  }
  return { x: hx, y: hy, r: hr };
}
function drawCreatureTail(g, m, phase, detail, colors) {
  if (!m.tail || m.tail === "none" || detail < 1) return;
  const { secondary, accent } = colors,
    bx = -(m.aspect || 0.8) * 0.9,
    sw = Math.sin(phase) * 0.22;
  g.strokeStyle = secondary;
  g.fillStyle = secondary;
  g.lineCap = "round";
  if (m.tail === "whip" || m.tail === "twin") {
    g.lineWidth = 0.11;
    for (const s of m.tail === "twin" ? [-1, 1] : [0]) {
      g.beginPath();
      g.moveTo(bx + 0.1, s * 0.12);
      g.quadraticCurveTo(bx - 0.45, s * 0.25 + sw, bx - 0.85, s * 0.3 - sw * 0.6);
      g.stroke();
    }
  } else if (m.tail === "fan") {
    g.beginPath();
    g.moveTo(bx + 0.05, 0);
    g.lineTo(bx - 0.55, -0.42 + sw * 0.3);
    g.lineTo(bx - 0.7, 0);
    g.lineTo(bx - 0.55, 0.42 + sw * 0.3);
    g.closePath();
    g.fill();
  } else if (m.tail === "club") {
    g.lineWidth = 0.13;
    g.beginPath();
    g.moveTo(bx + 0.1, 0);
    g.lineTo(bx - 0.5, sw);
    g.stroke();
    g.fillStyle = accent;
    g.beginPath();
    g.arc(bx - 0.58, sw, 0.17, 0, Math.PI * 2);
    g.fill();
  }
}
// Skin finish over a filled body of half-axes rx, ry.
function drawCreatureSkin(g, m, detail, colors, rx, ry) {
  if (detail < 1 || !m.skin || m.skin === "matte") return;
  if (m.skin === "glossy" || m.skin === "iridescent") {
    g.fillStyle = "rgba(255,255,255,0.28)";
    g.beginPath();
    g.ellipse(-rx * 0.25, -ry * 0.4, rx * 0.45, ry * 0.22, -0.3, 0, Math.PI * 2);
    g.fill();
    if (m.skin === "iridescent") {
      g.strokeStyle = colors.accent;
      g.lineWidth = 0.06;
      g.globalAlpha = 0.55;
      g.beginPath();
      g.ellipse(0, 0, rx * 0.8, ry * 0.75, 0, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
  } else if (m.skin === "translucent") {
    g.fillStyle = hsl(m.secondaryHue, 40, 25, 0.45);
    g.beginPath();
    g.ellipse(-rx * 0.1, 0, rx * 0.42, ry * 0.5, 0, 0, Math.PI * 2);
    g.fill();
  } else if (m.skin === "furred" && detail > 1) {
    g.strokeStyle = colors.secondary;
    g.lineWidth = 0.05;
    g.beginPath();
    for (let n = 0; n < 9; n++) {
      const a = Math.PI * 0.55 + (n / 8) * Math.PI * 0.9,
        x = Math.cos(a) * rx,
        y = Math.sin(a) * ry;
      g.moveTo(x, y);
      g.lineTo(x * 1.16, y * 1.2);
    }
    g.stroke();
  }
}
function drawCreatureOrnament(g, m, phase, detail, colors, head) {
  if (!m.ornament || m.ornament === "none" || detail < 1) return;
  const { secondary, accent } = colors,
    rx = m.aspect || 0.8,
    hx = head?.r ? head.x : rx * 0.6,
    hy = head?.y || 0;
  g.strokeStyle = secondary;
  g.fillStyle = accent;
  g.lineWidth = 0.07;
  g.lineCap = "round";
  if (m.ornament === "antlers") {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(hx - 0.05, hy + s * 0.12);
      g.lineTo(hx - 0.15, hy + s * 0.5);
      g.lineTo(hx + 0.05, hy + s * 0.75);
      g.moveTo(hx - 0.15, hy + s * 0.5);
      g.lineTo(hx - 0.35, hy + s * 0.68);
      g.stroke();
    }
  } else if (m.ornament === "fins") {
    g.beginPath();
    for (let n = 0; n < 3; n++) {
      const x = -rx * 0.5 + n * rx * 0.5;
      g.moveTo(x - 0.15, -0.3);
      g.lineTo(x, -0.72 - Math.sin(phase + n) * 0.05);
      g.lineTo(x + 0.15, -0.3);
    }
    g.closePath();
    g.fill();
  } else if (m.ornament === "tendrils") {
    g.lineWidth = 0.05;
    for (let n = 0; n < 3; n++) {
      const y = (n - 1) * 0.22,
        sw = Math.sin(phase * 1.3 + n) * 0.15;
      g.beginPath();
      g.moveTo(-rx * 0.8, y);
      g.quadraticCurveTo(-rx * 1.2, y + sw, -rx * 1.55, y - sw);
      g.stroke();
    }
  } else if (m.ornament === "lanterns") {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(hx, hy + s * 0.1);
      g.quadraticCurveTo(hx + 0.25, hy + s * 0.45, hx + 0.5, hy + s * 0.5);
      g.stroke();
      g.globalAlpha = 0.35;
      g.beginPath();
      g.arc(hx + 0.5, hy + s * 0.5, 0.16, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(hx + 0.5, hy + s * 0.5, 0.07, 0, Math.PI * 2);
      g.fill();
    }
  } else if (m.ornament === "plates") {
    g.fillStyle = secondary;
    g.globalAlpha = 0.6;
    for (let n = 0; n < 4; n++) {
      g.beginPath();
      g.ellipse(-rx * 0.6 + n * rx * 0.4, -0.12, 0.2, 0.3, 0, Math.PI, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}
function drawCreatureEyes(g, m, detail, colors, head) {
  if (!m.eyes) return;
  const count = Math.min(m.eyes, detail > 1 ? 7 : 3),
    style = m.eyeStyle || "dot",
    er = 0.075,
    upright = m.topology === "upright" || m.topology === "floater";
  for (let n = 0; n < count; n++) {
    let x = 0.7,
      y = (n - (count - 1) / 2) * 0.17;
    if (upright) {
      x = (n - (count - 1) / 2) * 0.16;
      y = head?.r && m.topology === "upright" ? head.y - 0.03 : -0.68;
    } else if (m.topology === "radial") {
      const a = (n * Math.PI * 2) / count;
      x = Math.cos(a) * 0.48;
      y = Math.sin(a) * 0.48;
    } else if (head?.r) {
      if (head.stalks) {
        x = head.x;
        y = head.y + (n % 2 ? 1 : -1) * head.r * 1.5 * (1 + Math.floor(n / 2) * 0.3);
      } else {
        x = head.x + head.r * 0.3;
        y = head.y + (n - (count - 1) / 2) * head.r * 0.55;
      }
    }
    const tone = m.glow || style === "glow" ? colors.accent : hsl(m.accentHue, 65, 82);
    g.fillStyle = tone;
    if (style === "glow") {
      g.globalAlpha = 0.3;
      g.beginPath();
      g.arc(x, y, er * 2.4, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    if (style === "ring") {
      g.strokeStyle = tone;
      g.lineWidth = 0.035;
      g.beginPath();
      g.arc(x, y, er * 1.1, 0, Math.PI * 2);
      g.stroke();
      continue;
    }
    if (style === "compound") {
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x + (k - 1) * er * 0.9, y + (k % 2) * er * 0.8, er * 0.55, 0, Math.PI * 2);
        g.fill();
      }
      continue;
    }
    g.beginPath();
    if (style === "slit") g.ellipse(x, y, er * 0.55, er * 1.5, 0, 0, Math.PI * 2);
    else g.arc(x, y, er, 0, Math.PI * 2);
    g.fill();
    if (detail > 1 && style !== "glow") {
      g.fillStyle = "rgba(10,8,14,0.85)";
      g.beginPath();
      g.arc(x + er * 0.2, y, er * 0.35, 0, Math.PI * 2);
      g.fill();
    }
  }
}
// People: an upright form for the world's sapients, dressed by culture and
// marked by faction. Returns the head placement for the eyes.
function drawUprightPerson(g, m, phase, detail, colors) {
  const { primary, secondary, accent, outline, dress } = colors,
    wave = Math.sin(phase) * 0.12,
    form = m.personForm || "biped",
    torsoW = form === "broad" ? 0.56 : form === "tall" ? 0.38 : 0.46,
    torsoH = form === "tall" ? 0.86 : form === "broad" ? 0.64 : 0.73,
    legLen = form === "tall" ? 1.3 : form === "broad" ? 1.05 : 1.18,
    dressed = dress && dress.style !== "none" && detail > 0;
  if (dressed && dress.style === "cloak") {
    g.fillStyle = hsl(dress.hue, 45, 32, 0.85);
    g.beginPath();
    g.ellipse(0, 0.32, torsoW * 1.35, torsoH * 1.05, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = secondary;
  g.fillStyle = secondary;
  if (form === "quadruped") {
    g.fillStyle = primary;
    g.beginPath();
    g.ellipse(-0.25, 0.75, 0.62, 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = outline;
    g.stroke();
    g.strokeStyle = secondary;
    g.fillStyle = secondary;
    for (let n = 0; n < 4; n++)
      if (creatureAppendageVisible(m, n))
        creatureLimbStyled(
          g,
          m,
          -0.65 + (n % 2) * 0.8,
          0.85,
          -0.7 + (n % 2) * 0.9 + (n < 2 ? -0.1 : 0.1),
          1.25 + (n % 2 ? wave : -wave) * 0.4,
          0.08,
          phase + n,
        );
  } else {
    if (creatureAppendageVisible(m, 0))
      creatureLimbStyled(g, m, -torsoW * 0.4, -0.05, -0.68, 0.5 + wave, 0.12, phase);
    if (creatureAppendageVisible(m, 1))
      creatureLimbStyled(g, m, torsoW * 0.4, -0.05, 0.68, 0.5 - wave, 0.12, phase + 2);
    if (creatureAppendageVisible(m, 2))
      creatureLimbStyled(g, m, -0.2, 0.55, -0.48, legLen, 0.1, phase + 1);
    if (creatureAppendageVisible(m, 3))
      creatureLimbStyled(g, m, 0.2, 0.55, 0.48, legLen, 0.1, phase + 3);
    if (form === "tripod") creatureLimbStyled(g, m, 0, 0.6, 0, legLen + 0.05, 0.06, phase + 2);
  }
  g.fillStyle = primary;
  g.beginPath();
  g.ellipse(0, 0.18, torsoW, torsoH, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = outline;
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
  return { x: 0, y: hy, r: 0.38 };
}
function drawCreatureModelShape(g, m, phase, detail, colors) {
  const { primary, secondary, accent, outline } = colors,
    wave = Math.sin(phase) * 0.12,
    bulk = m.bulk || 1;
  g.strokeStyle = secondary;
  g.fillStyle = primary;
  g.lineWidth = 0.13;
  g.lineJoin = "round";
  g.lineCap = "round";
  if (m.frill) {
    g.fillStyle = accent;
    g.globalAlpha = 0.48;
    g.beginPath();
    g.moveTo(0.15, -0.12);
    for (let n = 0; n < 6; n++) {
      const a = -1.2 + n * 0.48;
      g.lineTo(0.35 + Math.cos(a) * 0.82, 0.02 + Math.sin(a) * 0.82);
    }
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = primary;
  }
  let head = null;
  if (m.topology === "upright") head = drawUprightPerson(g, m, phase, detail, colors);
  else if (m.topology === "radial") {
    g.fillStyle = secondary;
    for (let n = 0; n < m.appendages; n++) {
      if (!creatureAppendageVisible(m, n)) continue;
      const a = (n * Math.PI * 2) / m.appendages + wave * 0.25,
        ca = Math.cos(a),
        sa = Math.sin(a);
      creatureLimbStyled(
        g,
        m,
        ca * 0.3,
        sa * 0.3,
        ca * (1.05 + detail * 0.13),
        sa * (1.05 + detail * 0.13),
        0.16,
        phase + n,
      );
    }
    g.fillStyle = primary;
    g.beginPath();
    for (let n = 0; n < m.segments + 3; n++) {
      const a = (n * Math.PI * 2) / (m.segments + 3),
        rr = (n % 2 ? 0.64 : 0.78) * bulk;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = outline;
    g.stroke();
    drawCreatureSkin(g, m, detail, colors, 0.7 * bulk, 0.7 * bulk);
  } else if (m.topology === "serpentine") {
    drawCreatureTail(g, m, phase, detail, colors);
    g.fillStyle = secondary;
    if (m.appendages > 2)
      for (let n = 0; n < Math.min(5, m.appendages / 2); n++) {
        if (!creatureAppendageVisible(m, n)) continue;
        const x = -0.72 + n * 0.36,
          y = Math.sin(phase + n) * 0.12;
        creatureLimbStyled(g, m, x, y, x - 0.05, y + (n % 2 ? -0.62 : 0.62), 0.1, phase + n);
      }
    for (let n = m.segments - 1; n >= 0; n--) {
      const x = (n - (m.segments - 1) / 2) * 0.29,
        y = Math.sin(phase + n * 0.75) * 0.18,
        rr = 0.28 * bulk * (1 - n / (m.segments + 4));
      g.fillStyle = n % 2 ? primary : secondary;
      g.beginPath();
      g.ellipse(x, y, rr * 1.25, rr, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = outline;
    g.beginPath();
    g.moveTo(-0.85, Math.sin(phase) * 0.13);
    for (let n = 0; n < m.segments; n++) {
      const x = (n - (m.segments - 1) / 2) * 0.29,
        y = Math.sin(phase + n * 0.75) * 0.18;
      g.lineTo(x, y);
    }
    g.stroke();
    head = drawCreatureHead(g, m, phase, detail, colors, ((m.segments - 1) / 2) * 0.29 + 0.18);
  } else if (m.topology === "floater") {
    g.fillStyle = secondary;
    for (let n = 0; n < m.appendages; n++) {
      if (!creatureAppendageVisible(m, n)) continue;
      const x = (n / Math.max(1, m.appendages - 1) - 0.5) * 1.15;
      creatureLimbStyled(
        g,
        m,
        x,
        0.22,
        x + Math.sin(phase + n) * 0.18,
        1.1 + Math.cos(phase + n) * 0.13,
        0.13,
        phase + n,
      );
    }
    g.fillStyle = primary;
    g.beginPath();
    g.moveTo(-0.86 * bulk, 0.18);
    g.quadraticCurveTo(-0.7 * bulk, -0.8, 0, -0.88);
    g.quadraticCurveTo(0.72 * bulk, -0.8, 0.86 * bulk, 0.18);
    g.quadraticCurveTo(0, 0.55, -0.86 * bulk, 0.18);
    g.fill();
    g.strokeStyle = outline;
    g.stroke();
    drawCreatureSkin(g, m, detail, colors, 0.8 * bulk, 0.5);
  } else if (m.topology === "colonial") {
    g.fillStyle = secondary;
    for (let n = 0; n < m.appendages; n++) {
      if (!creatureAppendageVisible(m, n)) continue;
      const a = (n * Math.PI * 2) / m.appendages;
      creatureLimbStyled(
        g,
        m,
        Math.cos(a) * 0.3,
        Math.sin(a) * 0.3,
        Math.cos(a) * 1.05,
        Math.sin(a) * 0.9,
        0.17,
        phase + n,
      );
    }
    for (let n = 0; n < m.segments + 2; n++) {
      const a = n * 2.399 + phase * 0.02,
        rr = 0.23 + n * 0.08;
      g.fillStyle = n % 2 ? primary : secondary;
      g.beginPath();
      g.ellipse(
        Math.cos(a) * rr,
        Math.sin(a) * rr * 0.8,
        0.34 * bulk,
        0.28 * bulk,
        a,
        0,
        Math.PI * 2,
      );
      g.fill();
      g.strokeStyle = outline;
      g.stroke();
    }
  } else {
    drawCreatureTail(g, m, phase, detail, colors);
    g.fillStyle = secondary;
    if (m.topology === "tripod") {
      for (let n = 0; n < 3; n++) {
        if (!creatureAppendageVisible(m, n)) continue;
        const a = (n * Math.PI * 2) / 3;
        creatureLimbStyled(
          g,
          m,
          Math.cos(a) * 0.25,
          Math.sin(a) * 0.25,
          Math.cos(a) * 1.03,
          Math.sin(a) * 1.03,
          0.11,
          phase + n,
        );
      }
    } else {
      const pairs = Math.max(1, Math.floor(m.appendages / 2));
      for (let n = 0; n < pairs; n++) {
        const x = pairs === 1 ? 0 : -0.55 + (n * 1.1) / (pairs - 1),
          stride = Math.sin(phase + n * Math.PI) * 0.16;
        if (creatureAppendageVisible(m, n * 2))
          creatureLimbStyled(g, m, x, -0.28, x - 0.15 + stride, -0.92, 0.11, phase + n);
        if (creatureAppendageVisible(m, n * 2 + 1))
          creatureLimbStyled(g, m, x, 0.28, x + 0.15 - stride, 0.92, 0.11, phase + n + 2);
      }
    }
    const ry = (m.shell ? 0.68 : 0.54) * bulk;
    g.fillStyle = primary;
    if (m.skin === "translucent") g.globalAlpha = 0.82;
    g.beginPath();
    g.ellipse(0, 0, m.aspect, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = outline;
    g.stroke();
    if (m.shell) {
      g.fillStyle = secondary;
      g.globalAlpha = 0.58;
      g.beginPath();
      g.ellipse(-0.05, -0.04, m.aspect * 0.78, 0.49 * bulk, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = accent;
      g.lineWidth = 0.075;
      g.beginPath();
      g.moveTo(-m.aspect * 0.55, -0.32);
      g.quadraticCurveTo(0, 0.1, m.aspect * 0.55, 0.31);
      g.stroke();
    }
    drawCreatureSkin(g, m, detail, colors, m.aspect, ry);
    head = drawCreatureHead(g, m, phase, detail, colors, m.aspect * 0.82);
  }
  drawCreaturePattern(g, m, primary, secondary, accent, detail);
  if (m.topology !== "upright") drawCreatureOrnament(g, m, phase, detail, colors, head);
  if (m.spines && detail) {
    g.fillStyle = accent;
    for (let n = 0; n < m.spines; n++) {
      const x = (n / Math.max(1, m.spines - 1) - 0.5) * 1.15;
      g.beginPath();
      g.moveTo(x - 0.1, -0.42);
      g.lineTo(x, -0.82 - (n % 2) * 0.14);
      g.lineTo(x + 0.1, -0.42);
      g.closePath();
      g.fill();
    }
  }
  drawCreatureEyes(g, m, detail, colors, head);
}
