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
    key = `${v.key}:${role}:${g?.lineageId || id}:${signature}`;
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
    plans = ["bilateral", "radial", "tripod", "serpentine", "shelled", "floater", "colonial"],
    topology = v.earthlike
      ? role === KINDS.PERSON
        ? "upright"
        : "bilateral"
      : plans[r.int(plans.length)],
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
    spines = clamp(Math.floor((support + (phenotype(id)?.aggression || 0)) * 2.2), 0, 5),
    glow = signal > 0.55 || detox > 0.9 || r.next() < v.alienness * 0.2,
    patterns = ["spots", "bands", "veins", "plates", "rings", "plain"],
    pattern = patterns[r.int(patterns.length)],
    aspect = clamp(
      0.72 + transport * 0.3 + (phenotype(id)?.speed || 1) * 0.16 + r.range(-0.12, 0.16),
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
    individualVariation = r.range(0.03, 0.1);
  const model = {
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
    label:
      `${titleCase(topology)} ${shell ? "armored " : ""}${pattern === "plain" ? "" : pattern + " "}form`
        .replace(/\s+/g, " ")
        .trim(),
  };
  CREATURE_VISUAL_CACHE.set(key, model);
  return model;
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
function drawCreaturePattern(g, m, primary, secondary, accent, detail) {
  if (detail < 1 || m.pattern === "plain") return;
  g.lineWidth = 0.08;
  g.strokeStyle = secondary;
  g.fillStyle = m.glow ? accent : secondary;
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
function drawCreatureModelShape(g, m, phase, detail, colors) {
  const { primary, secondary, accent, outline } = colors,
    wave = Math.sin(phase) * 0.12;
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
  if (m.topology === "radial") {
    for (let n = 0; n < m.appendages; n++) {
      const a = (n * Math.PI * 2) / m.appendages + wave * 0.25,
        ca = Math.cos(a),
        sa = Math.sin(a);
      creatureLimb(
        g,
        ca * 0.3,
        sa * 0.3,
        ca * (1.05 + detail * 0.13),
        sa * (1.05 + detail * 0.13),
        0.16,
        phase + n,
      );
    }
    g.beginPath();
    for (let n = 0; n < m.segments + 3; n++) {
      const a = (n * Math.PI * 2) / (m.segments + 3),
        rr = n % 2 ? 0.64 : 0.78;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = outline;
    g.stroke();
  } else if (m.topology === "serpentine") {
    if (m.appendages > 2)
      for (let n = 0; n < Math.min(5, m.appendages / 2); n++) {
        const x = -0.72 + n * 0.36,
          y = Math.sin(phase + n) * 0.12;
        creatureLimb(g, x, y, x - 0.05, y + (n % 2 ? -0.62 : 0.62), 0.1, phase + n);
      }
    for (let n = m.segments - 1; n >= 0; n--) {
      const x = (n - (m.segments - 1) / 2) * 0.29,
        y = Math.sin(phase + n * 0.75) * 0.18,
        rr = 0.28 * (1 - n / (m.segments + 4));
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
  } else if (m.topology === "floater") {
    for (let n = 0; n < m.appendages; n++) {
      const x = (n / Math.max(1, m.appendages - 1) - 0.5) * 1.15;
      creatureLimb(
        g,
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
    g.moveTo(-0.86, 0.18);
    g.quadraticCurveTo(-0.7, -0.8, 0, -0.88);
    g.quadraticCurveTo(0.72, -0.8, 0.86, 0.18);
    g.quadraticCurveTo(0, 0.55, -0.86, 0.18);
    g.fill();
    g.strokeStyle = outline;
    g.stroke();
  } else if (m.topology === "colonial") {
    for (let n = 0; n < m.appendages; n++) {
      const a = (n * Math.PI * 2) / m.appendages;
      creatureLimb(
        g,
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
      g.ellipse(Math.cos(a) * rr, Math.sin(a) * rr * 0.8, 0.34, 0.28, a, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = outline;
      g.stroke();
    }
  } else if (m.topology === "upright") {
    g.strokeStyle = secondary;
    creatureLimb(g, -0.18, -0.05, -0.68, 0.5 + wave, 0.12, phase);
    creatureLimb(g, 0.18, -0.05, 0.68, 0.5 - wave, 0.12, phase + 2);
    creatureLimb(g, -0.2, 0.55, -0.48, 1.18, 0.1, phase + 1);
    creatureLimb(g, 0.2, 0.55, 0.48, 1.18, 0.1, phase + 3);
    g.fillStyle = primary;
    g.beginPath();
    g.ellipse(0, 0.18, 0.46, 0.73, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = outline;
    g.stroke();
    g.fillStyle = secondary;
    g.beginPath();
    g.arc(0, -0.65, 0.38, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else {
    const pairs = Math.max(1, Math.floor(m.appendages / 2));
    for (let n = 0; n < pairs; n++) {
      const x = pairs === 1 ? 0 : -0.55 + (n * 1.1) / (pairs - 1),
        stride = Math.sin(phase + n * Math.PI) * 0.16;
      creatureLimb(g, x, -0.28, x - 0.15 + stride, -0.92, 0.11, phase + n);
      creatureLimb(g, x, 0.28, x + 0.15 - stride, 0.92, 0.11, phase + n + 2);
    }
    if (m.topology === "tripod")
      for (let n = 0; n < 3; n++) {
        const a = (n * Math.PI * 2) / 3;
        creatureLimb(
          g,
          Math.cos(a) * 0.25,
          Math.sin(a) * 0.25,
          Math.cos(a) * 1.03,
          Math.sin(a) * 1.03,
          0.11,
          phase + n,
        );
      }
    g.fillStyle = primary;
    g.beginPath();
    g.ellipse(0, 0, m.aspect, m.shell ? 0.68 : 0.54, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = outline;
    g.stroke();
    if (m.shell) {
      g.fillStyle = secondary;
      g.globalAlpha = 0.58;
      g.beginPath();
      g.ellipse(-0.05, -0.04, m.aspect * 0.78, 0.49, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = accent;
      g.lineWidth = 0.075;
      g.beginPath();
      g.moveTo(-m.aspect * 0.55, -0.32);
      g.quadraticCurveTo(0, 0.1, m.aspect * 0.55, 0.31);
      g.stroke();
    }
  }
  drawCreaturePattern(g, m, primary, secondary, accent, detail);
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
  if (m.eyes) {
    g.fillStyle = m.glow ? accent : hsl(m.accentHue, 65, 82);
    const count = Math.min(m.eyes, detail > 1 ? 7 : 3);
    for (let n = 0; n < count; n++) {
      let x = 0.7,
        y = (n - (count - 1) / 2) * 0.17;
      if (m.topology === "upright" || m.topology === "floater") {
        x = (n - (count - 1) / 2) * 0.16;
        y = -0.68;
      } else if (m.topology === "radial") {
        const a = (n * Math.PI * 2) / count;
        x = Math.cos(a) * 0.48;
        y = Math.sin(a) * 0.48;
      }
      g.beginPath();
      g.arc(x, y, 0.075, 0, Math.PI * 2);
      g.fill();
    }
  }
}
