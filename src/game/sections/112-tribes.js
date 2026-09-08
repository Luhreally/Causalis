// ═══════════════════════════════════════════════════════════════════════════
// 112. TRIBES — tents, roundhouses, fire pits, and spirit posts before the civic age
// ═══════════════════════════════════════════════════════════════════════════
// A camp of hunters and a village that had only just learned fire were drawn
// with the same brick cottages, slate roofs, and glass windows as a town of
// letters, and had nothing of their own to raise. Now, on Earth-like worlds,
// every place that knows neither masonry nor letters nor governance wears the
// tribal age: a shelter is a hide tent on crossed poles (a thatched roundhouse
// of wattle once the people farm), a hearth is a fire pit ringed with stones
// under a spit, a stockpile is a storage pit under a hide cover with baskets
// beside it and a drying rack of meat once the people know drying, a workshop
// is an open work ground with a flat stone, a spear rack, and a hide stretched
// on a frame, a kiln is a pit kiln mound, and a wall is a palisade of
// sharpened stakes. Camps keep a midden and a dugout canoe where water is
// near. And the tribes raise something of their own: a Spirit post, a carved
// and painted totem in the polity's colours that a camp or village of six
// that keeps a fire plans in its square; it calms a settlement a little and
// stands on into every later age. A Voice of the stone age wears feathers.
// Rendering only reads.
const TRIBAL_CIVIC_TECHS = Object.freeze(["masonry", "writing", "governance"]),
  TRIBAL_TOTEM_PEOPLE = 6,
  TRIBAL_TOTEM_CALM = 0.02,
  TRIBAL_ACTIVE_CAP = 4,
  TRIBES = { tents: 0, roundhouses: 0, firepits: 0, pits: 0, racks: 0, workgrounds: 0, palisades: 0, kilns: 0, totems: 0, props: 0, feathers: 0, firstWorld: null };
if (typeof FAMILY_SPECIAL !== "undefined") FAMILY_SPECIAL.add("totem");
if (typeof CIVIC_TYPES !== "undefined") CIVIC_TYPES.add("totem");
function tribalEra(place) {
  if (!place) return false;
  if (!place.knownProcesses) return true;
  return !TRIBAL_CIVIC_TECHS.some((t) => place.knownProcesses.includes(t));
}
function placeKnows(place, tech) {
  return !!place?.knownProcesses?.includes(tech);
}
function earthlikeWorld() {
  return !!(ACTIVE_PLANET_VISUAL || makePlanetVisualGenome()).earthlike || (typeof canonicalPlanetSeed === "function" && !!canonicalPlanetSeed(W.seed));
}
function tribalBuilding(b) {
  const place = buildingPlace(b);
  if (!place || !tribalEra(place)) return false;
  if (b.placeKind === "camp") return earthlikeWorld();
  return typeof buildingFamily !== "function" || buildingFamily(b) === "earthen";
}
// ── The forms ────────────────────────────────────────────────────────────────
function tribalTone(b, c) {
  return b.abandoned && typeof deadColor === "function" ? deadColor(c) : c;
}
function drawTent(g, b, s, r, now, detail) {
  const { hw, h, baseY, topY } = facadeGeometry(s, r, 1.1, 0.95),
    apex = topY - h * 0.1,
    hide = tribalTone(b, hsl(26, 38, 54)),
    hideDark = tribalTone(b, hsl(24, 36, 38)),
    pole = tribalTone(b, hsl(30, 30, 24));
  g.save();
  g.lineCap = "round";
  // Poles crossing above the apex.
  g.strokeStyle = pole;
  g.lineWidth = Math.max(1, r * 0.05);
  g.beginPath();
  g.moveTo(s.x - hw * 0.8, baseY);
  g.lineTo(s.x + hw * 0.18, apex - h * 0.28);
  g.moveTo(s.x + hw * 0.8, baseY);
  g.lineTo(s.x - hw * 0.18, apex - h * 0.28);
  g.moveTo(s.x, baseY);
  g.lineTo(s.x + hw * 0.04, apex - h * 0.32);
  g.stroke();
  // The hide cone.
  g.fillStyle = hide;
  g.strokeStyle = hideDark;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(s.x - hw * 0.95, baseY);
  g.lineTo(s.x, apex);
  g.lineTo(s.x + hw * 0.95, baseY);
  g.closePath();
  g.fill();
  g.stroke();
  if (detail) {
    // Seams, a smoke stain at the apex, and the door flap.
    g.strokeStyle = hideDark;
    g.globalAlpha = 0.6;
    g.beginPath();
    g.moveTo(s.x - hw * 0.45, baseY);
    g.lineTo(s.x, apex);
    g.moveTo(s.x + hw * 0.45, baseY);
    g.lineTo(s.x, apex);
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = tribalTone(b, hsl(20, 20, 20, 0.45));
    g.beginPath();
    g.moveTo(s.x - hw * 0.16, apex + h * 0.22);
    g.lineTo(s.x, apex);
    g.lineTo(s.x + hw * 0.16, apex + h * 0.22);
    g.closePath();
    g.fill();
    g.fillStyle = tribalTone(b, hsl(22, 30, 16));
    g.beginPath();
    g.moveTo(s.x + hw * 0.05, baseY);
    g.lineTo(s.x + hw * 0.2, baseY - h * 0.42);
    g.lineTo(s.x + hw * 0.4, baseY);
    g.closePath();
    g.fill();
  }
  g.restore();
  TRIBES.tents++;
}
function drawRoundhouse(g, b, s, r, now, detail) {
  const { hw, h, baseY, topY } = facadeGeometry(s, r, 1.05, 1),
    wallTop = baseY - h * 0.42,
    wattle = tribalTone(b, hsl(32, 30, 46)),
    wattleDark = tribalTone(b, hsl(30, 30, 30)),
    thatch = tribalTone(b, hsl(42, 48, 56)),
    thatchDark = tribalTone(b, hsl(38, 42, 36));
  g.save();
  // Wattle wall.
  g.fillStyle = wattle;
  g.strokeStyle = wattleDark;
  g.lineWidth = 1;
  g.beginPath();
  g.rect(s.x - hw * 0.85, wallTop, hw * 1.7, baseY - wallTop);
  g.fill();
  g.stroke();
  if (detail) {
    g.strokeStyle = wattleDark;
    g.globalAlpha = 0.45;
    g.beginPath();
    for (let n = 1; n < 4; n++) {
      const y = wallTop + ((baseY - wallTop) * n) / 4;
      g.moveTo(s.x - hw * 0.85, y);
      g.lineTo(s.x + hw * 0.85, y);
    }
    g.stroke();
    g.globalAlpha = 1;
  }
  // Conical thatch.
  g.fillStyle = thatch;
  g.strokeStyle = thatchDark;
  g.beginPath();
  g.moveTo(s.x - hw * 1.05, wallTop + h * 0.04);
  g.lineTo(s.x, topY - h * 0.08);
  g.lineTo(s.x + hw * 1.05, wallTop + h * 0.04);
  g.closePath();
  g.fill();
  g.stroke();
  if (detail) {
    g.strokeStyle = thatchDark;
    g.globalAlpha = 0.5;
    g.beginPath();
    for (let n = -2; n <= 2; n++) {
      g.moveTo(s.x + hw * 0.4 * n, wallTop + h * 0.04);
      g.lineTo(s.x + hw * 0.08 * n, topY);
    }
    g.stroke();
    g.globalAlpha = 1;
    // A low door.
    g.fillStyle = tribalTone(b, hsl(28, 28, 14));
    g.fillRect(s.x - hw * 0.14, baseY - h * 0.3, hw * 0.28, h * 0.3);
  }
  g.restore();
  TRIBES.roundhouses++;
}
function drawFirePit(g, b, s, r, now, detail) {
  const { hw, h, baseY } = facadeGeometry(s, r, 0.6, 0.8),
    cy = baseY - h * 0.15,
    still = ACTIVE_REDUCED_MOTION,
    stone = tribalTone(b, hsl(30, 8, 46)),
    stoneDark = tribalTone(b, hsl(30, 8, 30));
  g.save();
  // Ash bed and a ring of stones.
  g.fillStyle = tribalTone(b, hsl(20, 10, 22));
  g.beginPath();
  g.ellipse(s.x, cy, hw * 0.62, hw * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  for (let n = 0; n < 9; n++) {
    const a = (n / 9) * Math.PI * 2,
      sx = s.x + Math.cos(a) * hw * 0.68,
      sy = cy + Math.sin(a) * hw * 0.34;
    g.fillStyle = n % 2 ? stone : stoneDark;
    g.beginPath();
    g.ellipse(sx, sy, r * 0.09, r * 0.06, a, 0, Math.PI * 2);
    g.fill();
  }
  // Logs.
  g.strokeStyle = tribalTone(b, hsl(25, 35, 26));
  g.lineWidth = Math.max(1, r * 0.06);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(s.x - hw * 0.35, cy + hw * 0.08);
  g.lineTo(s.x + hw * 0.3, cy - hw * 0.1);
  g.moveTo(s.x - hw * 0.3, cy - hw * 0.1);
  g.lineTo(s.x + hw * 0.35, cy + hw * 0.06);
  g.stroke();
  // Flame tongues over an additive glow, unless the place is dead.
  if (!b.abandoned) {
    const flick = still ? 0 : Math.sin(now * 0.02 + b.id) * 0.15;
    g.globalCompositeOperation = "lighter";
    const glow = g.createRadialGradient(s.x, cy - h * 0.1, 0, s.x, cy - h * 0.1, r * 0.8);
    glow.addColorStop(0, "rgba(255,150,60,0.35)");
    glow.addColorStop(1, "rgba(255,150,60,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(s.x, cy - h * 0.1, r * 0.8, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
    for (const [dx, scale, col] of [
      [0, 1 + flick, "#ffb347"],
      [-0.12, 0.7 - flick * 0.5, "#ff7a2f"],
      [0.12, 0.6 + flick * 0.5, "#ffd27a"],
    ]) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(s.x + hw * (dx - 0.14), cy);
      g.quadraticCurveTo(s.x + hw * (dx - 0.2), cy - h * 0.35 * scale, s.x + hw * dx, cy - h * 0.62 * scale);
      g.quadraticCurveTo(s.x + hw * (dx + 0.2), cy - h * 0.35 * scale, s.x + hw * (dx + 0.14), cy);
      g.closePath();
      g.fill();
    }
  }
  if (detail) {
    // A spit on forked sticks, with something roasting.
    g.strokeStyle = tribalTone(b, hsl(28, 30, 22));
    g.lineWidth = Math.max(1, r * 0.04);
    g.beginPath();
    g.moveTo(s.x - hw * 0.55, cy + hw * 0.05);
    g.lineTo(s.x - hw * 0.55, cy - h * 0.7);
    g.moveTo(s.x + hw * 0.55, cy + hw * 0.05);
    g.lineTo(s.x + hw * 0.55, cy - h * 0.7);
    g.moveTo(s.x - hw * 0.6, cy - h * 0.66);
    g.lineTo(s.x + hw * 0.6, cy - h * 0.66);
    g.stroke();
    g.fillStyle = tribalTone(b, hsl(10, 45, 34));
    g.beginPath();
    g.ellipse(s.x + hw * 0.05, cy - h * 0.66, hw * 0.18, h * 0.09, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  TRIBES.firepits++;
}
function drawDryingRack(g, b, x, baseY, r, detail) {
  g.strokeStyle = tribalTone(b, hsl(28, 30, 24));
  g.lineWidth = Math.max(1, r * 0.04);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x - r * 0.35, baseY);
  g.lineTo(x - r * 0.35, baseY - r * 0.75);
  g.moveTo(x + r * 0.35, baseY);
  g.lineTo(x + r * 0.35, baseY - r * 0.75);
  g.moveTo(x - r * 0.42, baseY - r * 0.7);
  g.lineTo(x + r * 0.42, baseY - r * 0.7);
  g.stroke();
  if (detail) {
    g.fillStyle = tribalTone(b, hsl(8, 50, 36));
    for (let n = -1; n <= 1; n++) g.fillRect(x + n * r * 0.22 - r * 0.05, baseY - r * 0.68, r * 0.1, r * 0.28);
  }
  TRIBES.racks++;
}
function drawStoragePit(g, b, s, r, now, detail, drying) {
  const { hw, h, baseY } = facadeGeometry(s, r, 0.7, 0.9),
    cy = baseY - h * 0.1;
  g.save();
  // The pit and its hide cover.
  g.fillStyle = tribalTone(b, hsl(25, 20, 18));
  g.beginPath();
  g.ellipse(s.x - hw * 0.15, cy, hw * 0.55, hw * 0.26, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = tribalTone(b, hsl(30, 35, 52));
  g.strokeStyle = tribalTone(b, hsl(28, 32, 34));
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(s.x - hw * 0.25, cy - h * 0.06, hw * 0.45, hw * 0.22, -0.2, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (detail) {
    // Baskets and a gourd.
    g.fillStyle = tribalTone(b, hsl(36, 40, 50));
    g.strokeStyle = tribalTone(b, hsl(34, 36, 32));
    for (const [dx, k] of [
      [0.55, 1],
      [0.8, 0.8],
    ]) {
      g.beginPath();
      g.ellipse(s.x + hw * dx, cy - h * 0.12 * k, hw * 0.16 * k, h * 0.17 * k, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(s.x + hw * (dx - 0.16 * k), cy - h * 0.12 * k);
      g.lineTo(s.x + hw * (dx + 0.16 * k), cy - h * 0.12 * k);
      g.stroke();
    }
    g.fillStyle = tribalTone(b, hsl(70, 35, 42));
    g.beginPath();
    g.ellipse(s.x + hw * 0.32, cy + h * 0.04, hw * 0.08, h * 0.1, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (drying) drawDryingRack(g, b, s.x - hw * 0.95, baseY - h * 0.05, r, detail);
  g.restore();
  TRIBES.pits++;
}
function drawWorkGround(g, b, s, r, now, detail) {
  const { hw, h, baseY } = facadeGeometry(s, r, 0.8, 1),
    cy = baseY - h * 0.1,
    wood = tribalTone(b, hsl(28, 30, 24));
  g.save();
  // A flat working stone.
  g.fillStyle = tribalTone(b, hsl(30, 8, 50));
  g.strokeStyle = tribalTone(b, hsl(30, 8, 30));
  g.beginPath();
  g.ellipse(s.x - hw * 0.4, cy, hw * 0.34, hw * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // A rack of spears.
  g.strokeStyle = wood;
  g.lineWidth = Math.max(1, r * 0.04);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(s.x + hw * 0.15, cy + hw * 0.05);
  g.lineTo(s.x + hw * 0.15, cy - h * 0.7);
  g.moveTo(s.x + hw * 0.75, cy + hw * 0.05);
  g.lineTo(s.x + hw * 0.75, cy - h * 0.7);
  g.moveTo(s.x + hw * 0.1, cy - h * 0.62);
  g.lineTo(s.x + hw * 0.8, cy - h * 0.62);
  g.stroke();
  if (detail) {
    g.lineWidth = Math.max(0.8, r * 0.025);
    g.beginPath();
    for (let n = 0; n < 3; n++) {
      const x = s.x + hw * (0.28 + n * 0.17);
      g.moveTo(x, cy + hw * 0.02);
      g.lineTo(x + hw * 0.06, cy - h * 0.95);
    }
    g.stroke();
    g.fillStyle = tribalTone(b, hsl(30, 8, 62));
    for (let n = 0; n < 3; n++) {
      const x = s.x + hw * (0.28 + n * 0.17) + hw * 0.06;
      g.beginPath();
      g.moveTo(x - hw * 0.03, cy - h * 0.93);
      g.lineTo(x, cy - h * 1.08);
      g.lineTo(x + hw * 0.03, cy - h * 0.93);
      g.closePath();
      g.fill();
    }
    // A hide stretched on a frame.
    g.strokeStyle = wood;
    g.lineWidth = Math.max(1, r * 0.035);
    g.strokeRect(s.x - hw * 0.95, cy - h * 0.85, hw * 0.5, h * 0.62);
    g.fillStyle = tribalTone(b, hsl(28, 40, 58));
    g.fillRect(s.x - hw * 0.89, cy - h * 0.79, hw * 0.38, h * 0.5);
  }
  g.restore();
  TRIBES.workgrounds++;
}
function drawPalisade(g, b, s, r, now, detail) {
  const { hw, h, baseY } = facadeGeometry(s, r, 0.9, 1),
    stake = tribalTone(b, hsl(30, 32, 34)),
    stakeLight = tribalTone(b, hsl(32, 30, 48)),
    n = detail > 1 ? 7 : 5;
  g.save();
  for (let k = 0; k < n; k++) {
    const x = s.x - hw * 0.9 + (hw * 1.8 * k) / (n - 1),
      w = hw * 0.16,
      top = baseY - h * (0.72 + 0.08 * (k % 2));
    g.fillStyle = k % 2 ? stake : stakeLight;
    g.fillRect(x - w / 2, top, w, baseY - top);
    g.beginPath();
    g.moveTo(x - w / 2, top);
    g.lineTo(x, top - h * 0.14);
    g.lineTo(x + w / 2, top);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = tribalTone(b, hsl(28, 30, 22));
  g.lineWidth = Math.max(1, r * 0.04);
  g.beginPath();
  g.moveTo(s.x - hw * 0.95, baseY - h * 0.4);
  g.lineTo(s.x + hw * 0.95, baseY - h * 0.4);
  g.stroke();
  g.restore();
  TRIBES.palisades++;
}
function drawPitKiln(g, b, s, r, now, detail) {
  const { hw, h, baseY } = facadeGeometry(s, r, 0.8, 0.9);
  g.save();
  g.fillStyle = tribalTone(b, hsl(24, 30, 40));
  g.strokeStyle = tribalTone(b, hsl(22, 28, 26));
  g.beginPath();
  g.moveTo(s.x - hw * 0.85, baseY);
  g.quadraticCurveTo(s.x, baseY - h * 1.3, s.x + hw * 0.85, baseY);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = tribalTone(b, hsl(20, 20, 14));
  g.beginPath();
  g.ellipse(s.x, baseY - h * 0.62, hw * 0.12, h * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  if (detail && !b.abandoned && !ACTIVE_REDUCED_MOTION) {
    g.fillStyle = "rgba(200,200,210,0.35)";
    for (let k = 0; k < 3; k++) {
      const t = ((now * 0.0006 + k * 0.33 + b.id * 0.1) % 1 + 1) % 1;
      g.beginPath();
      g.arc(s.x + Math.sin(t * 6 + k) * hw * 0.12, baseY - h * (0.7 + t * 0.7), r * (0.06 + t * 0.1), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  TRIBES.kilns++;
}
function drawSpiritPost(g, b, s, r, p, now, detail) {
  const { hw, h, baseY } = facadeGeometry(s, r, 1.6, 0.5),
    place = buildingPlace(b),
    faction = place?.factionId ? W.factions.find((f) => f.id === place.factionId) : null,
    hueMatch = String(faction?.color || "").match(/hsl\(\s*(-?[\d.]+)/i),
    hue = hueMatch ? Number(hueMatch[1]) : 18,
    wood = tribalTone(b, p.dark || hsl(28, 32, 32)),
    woodLight = tribalTone(b, p.base || hsl(30, 30, 46)),
    paint = tribalTone(b, hsl(hue, 60, 50)),
    ochre = tribalTone(b, hsl(22, 70, 44)),
    w = hw * 0.7,
    top = baseY - h;
  g.save();
  // Stones at the foot, then the post.
  g.fillStyle = tribalTone(b, hsl(30, 8, 46));
  for (let k = -1; k <= 1; k++) {
    g.beginPath();
    g.ellipse(s.x + k * w * 0.9, baseY - r * 0.02, r * 0.09, r * 0.05, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = woodLight;
  g.strokeStyle = wood;
  g.lineWidth = 1;
  g.fillRect(s.x - w / 2, top, w, h);
  g.strokeRect(s.x - w / 2, top, w, h);
  // Three carved faces, each with painted bands between.
  const bands = 3,
    bh = h / bands;
  for (let k = 0; k < bands; k++) {
    const y = top + bh * k;
    g.fillStyle = k % 2 ? paint : ochre;
    g.fillRect(s.x - w / 2, y, w, bh * 0.18);
    if (detail) {
      g.fillStyle = wood;
      g.fillRect(s.x - w * 0.34, y + bh * 0.32, w * 0.22, bh * 0.16);
      g.fillRect(s.x + w * 0.12, y + bh * 0.32, w * 0.22, bh * 0.16);
      g.fillRect(s.x - w * 0.25, y + bh * 0.68, w * 0.5, bh * 0.12);
    }
  }
  // Wings or feathers at the crown, in the polity's colour.
  g.fillStyle = paint;
  g.beginPath();
  g.moveTo(s.x - w * 0.5, top);
  g.lineTo(s.x - w * 1.6, top - h * 0.16);
  g.lineTo(s.x - w * 0.5, top - h * 0.1);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(s.x + w * 0.5, top);
  g.lineTo(s.x + w * 1.6, top - h * 0.16);
  g.lineTo(s.x + w * 0.5, top - h * 0.1);
  g.closePath();
  g.fill();
  g.fillStyle = ochre;
  g.beginPath();
  g.moveTo(s.x - w * 0.5, top - h * 0.08);
  g.lineTo(s.x, top - h * 0.28);
  g.lineTo(s.x + w * 0.5, top - h * 0.08);
  g.closePath();
  g.fill();
  g.restore();
  TRIBES.totems++;
}
const drawCompletedBuildingTribesBase = drawCompletedBuilding;
drawCompletedBuilding = function (g, b, s, r, p, now, m) {
  const detail = buildingDetailLevel();
  if (b.type === "totem") return drawSpiritPost(g, b, s, r, p, now, detail);
  if (!tribalBuilding(b)) return drawCompletedBuildingTribesBase(g, b, s, r, p, now, m);
  const place = buildingPlace(b);
  switch (b.type) {
    case "shelter":
      return placeKnows(place, "agriculture") ? drawRoundhouse(g, b, s, r, now, detail) : drawTent(g, b, s, r, now, detail);
    case "hearth":
      return drawFirePit(g, b, s, r, now, detail);
    case "stockpile":
      return drawStoragePit(g, b, s, r, now, detail, placeKnows(place, "drying"));
    case "workshop":
      return drawWorkGround(g, b, s, r, now, detail);
    case "wall":
      return drawPalisade(g, b, s, r, now, detail);
    case "kiln":
      return drawPitKiln(g, b, s, r, now, detail);
    default:
      return drawCompletedBuildingTribesBase(g, b, s, r, p, now, m);
  }
};
// ── Camp props: a midden by the fire, a dugout where water is near ───────────
function waterTileNear(x, y, reach = 2) {
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) {
      const tx = x + dx,
        ty = y + dy;
      if (inside(tx, ty) && W.tiles.liquid[idx(tx, ty)] > WATER_DEPTH.SURFACE) return [tx, ty];
    }
  return null;
}
const drawBuildingExteriorDetailsTribesBase = drawBuildingExteriorDetails;
drawBuildingExteriorDetails = function (g, b, now, m) {
  drawBuildingExteriorDetailsTribesBase(g, b, now, m);
  if (b.type !== "hearth" || !b.complete || b.ruined || b.abandoned || UI.quality === "low" || UI.camera.zoom < 1.6) return;
  if (!tribalBuilding(b)) return;
  const r = buildingScreenSize(b, m),
    side = visualHash01(b.id, 0x6a3) < 0.5 ? -1 : 1,
    midden = proceduralProjectTile(b.x + 0.5 + side * 1.1, b.y + 0.5 + 0.6, m);
  g.save();
  // The midden: a low grey-brown mound with a bone or two.
  g.fillStyle = hsl(30, 14, 34, 0.9);
  g.beginPath();
  g.ellipse(midden.x, midden.y, r * 0.42, r * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#e8e0cc";
  g.lineWidth = Math.max(0.8, r * 0.03);
  g.beginPath();
  g.moveTo(midden.x - r * 0.18, midden.y - r * 0.02);
  g.lineTo(midden.x + r * 0.05, midden.y - r * 0.12);
  g.stroke();
  TRIBES.props++;
  const water = waterTileNear(b.x, b.y, 2);
  if (water) {
    // A dugout canoe drawn up on the bank.
    const c = proceduralProjectTile(water[0] + 0.5, water[1] + 0.5, m);
    g.fillStyle = hsl(26, 32, 26);
    g.beginPath();
    g.ellipse(c.x, c.y, r * 0.6, r * 0.14, 0.15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hsl(28, 30, 40);
    g.beginPath();
    g.ellipse(c.x, c.y - r * 0.02, r * 0.42, r * 0.06, 0.15, 0, Math.PI * 2);
    g.fill();
    TRIBES.props++;
  }
  g.restore();
};
// ── A Voice of the stone age wears feathers ──────────────────────────────────
const drawUprightPersonTribesBase = drawUprightPerson;
drawUprightPerson = function (g, m, phase, detail, colors) {
  const head = drawUprightPersonTribesBase(g, m, phase, detail, colors);
  const fig = typeof ACTIVE_FIGURE !== "undefined" ? ACTIVE_FIGURE : null;
  if (!fig || fig.era !== "stone" || !head || m.personForm === "quadruped") return head;
  if (!W.factions.some((f) => f.leaderId === fig.id)) return head;
  const r = head.r || 0.3;
  g.save();
  g.fillStyle = colors.accent || "#f0d070";
  for (const [dx, tilt] of [
    [-0.55, -0.35],
    [0, 0],
    [0.55, 0.35],
  ]) {
    g.beginPath();
    g.moveTo(head.x + dx * r, head.y - r * 0.8);
    g.lineTo(head.x + dx * r + tilt * r * 0.9, head.y - r * 2.4);
    g.lineTo(head.x + dx * r + r * 0.22, head.y - r * 0.9);
    g.closePath();
    g.fill();
  }
  g.restore();
  TRIBES.feathers++;
  return head;
};
// ── The Spirit post: planned by the tribes, calming the settlement ───────────
function tribalPeople(place) {
  return place.knownProcesses ? settlementPopulation(place) : entityAtRadius(idx(place.x, place.y), 6, KINDS.PERSON).filter(classifyAlive).length;
}
function wantsTotem(place) {
  if (!place || place.ruined || place.active === false || !tribalEra(place)) return false;
  const fire = place.knownProcesses ? place.knownProcesses.includes("controlled_fire") : completedBuildings(place, "hearth").length > 0;
  if (!fire || tribalPeople(place) < TRIBAL_TOTEM_PEOPLE) return false;
  const kind = place.knownProcesses ? "settlement" : "camp";
  return !W.buildings.some((b) => !b.ruined && b.placeKind === kind && b.placeId === place.id && b.type === "totem");
}
const ensurePlacePlansTribesBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansTribesBase(place);
  if (!place || place.ruined || place.active === false) return;
  if (wantsTotem(place) && activeBuildings(place).length < TRIBAL_ACTIVE_CAP)
    planBuilding(place, "totem", Math.max(2, place.management?.priorities?.governance || 2));
  if (TRIBES.firstWorld !== W && typeof recordMilestone === "function" && completedBuildings(place, "totem").length) {
    TRIBES.firstWorld = W;
    recordMilestone("first-totem", "the first spirit post", place, { evidence: `${tribalPeople(place)} people gathered round the fire of ${place.name}` });
  }
};
const unrestOfTribesBase = unrestOf;
unrestOf = function (place) {
  const base = unrestOfTribesBase(place);
  return place?.knownProcesses && completedBuildings(place, "totem").length ? Math.max(0, base - TRIBAL_TOTEM_CALM) : base;
};
window.ALIFE_TRIBES_DEBUG = Object.freeze({
  era: (placeId, camp = false) => tribalEra((camp ? W.camps : W.settlements).find((x) => x.id === placeId)),
  tribal: (buildingId) => tribalBuilding(W.buildings.find((b) => b.id === buildingId) || {}),
  wantsTotem: (placeId, camp = false) => wantsTotem((camp ? W.camps : W.settlements).find((x) => x.id === placeId)),
  counts: () => ({ ...TRIBES, firstWorld: undefined }),
  reset: () => {
    for (const k of Object.keys(TRIBES)) if (k !== "firstWorld") TRIBES[k] = 0;
  },
});
