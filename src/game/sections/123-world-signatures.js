// 123. WORLD SIGNATURES — climate, culture, lineage and individual shape the view.
// Separate random streams keep these drawings out of the world's chemistry.
let signatureWorldCache = { world: null, value: null };
function worldDesignSignature() {
  if (signatureWorldCache.world === W) return signatureWorldCache.value;
  const r = makeRng(W.seed, "world-design-signature-v1"), earth = canonicalPlanetSeed(W.seed),
    t = W.terrainGenome || {}, wet = clamp(((t.wetBias || 0) + 115) / 270, 0, 1);
  const value = Object.freeze({
    earth, wet, carProfile: r.int(5), wheelbase: r.range(0.85, 1.2),
    clearance: 0.18 + (t.ridgeWeight || 0.15) * 0.55,
    canopyWidth: earth ? 1 : r.range(0.65, 1.5), canopyHeight: earth ? 1 : r.range(0.65, 1.65),
    canopyLean: earth ? 0.08 : r.range(-0.3, 0.3),
    mountain: earth ? "ridge" : ["mesa", "needle", "dome", "ridge"][r.int(4)],
    mountainAspect: earth ? 1 : r.range(0.65, 1.6),
    // A family is not a shape. Two worlds that both raise mesas were drawing
    // the same silhouette with only the height between them, and with four
    // families one world in four repeated the last. The crown, the lean of the
    // ridgeline, where the shoulder breaks and how many strata show are all
    // continuous now, so a mesa on one world is not a mesa on another.
    cragCrown: r.range(0.04, 0.62),
    cragLean: r.range(-0.34, 0.34),
    cragShoulder: r.range(0.16, 0.62),
    cragTiers: 3 + r.int(5),
    cragBite: r.range(0, 0.3),
    buildWidth: r.range(0.8, 1.2), facade: r.int(4),
    bodyWidth: earth ? 1 : r.range(0.7, 1.4), limbLength: earth ? 1 : r.range(0.7, 1.5),
    canopyGrammar: r.int(4), branches: 3 + r.int(4),
    // Four grammars meant every fourth world grew the same leaf. The spread,
    // the rise, the tilt and how far a bough droops are the world's own, so two
    // worlds that both grow blades do not grow the same blade.
    leafSpread: r.range(0.2, 0.62),
    leafRise: r.range(0.22, 0.85),
    leafTilt: r.range(-0.6, 0.6),
    boughDroop: r.range(-0.05, 0.28),
    canopyLift: r.range(0.12, 0.42),
    vehicleGrammar: earth ? "classic" : wet > 0.65 ? "pod" : (t.ridgeWeight || 0) > 0.24 ? "crawler" : r.next() < 0.5 ? "wedge" : "tandem",
    // A machine is built for the ground it crosses. Broken country wants
    // clearance and a short wheelbase; open plains want length; a wet world
    // wants a sealed cabin and a cold one wants small glass. These come from
    // the terrain the world was actually generated with, not from the die, so
    // the cars of a ridged world look like each other and unlike a plain's.
    roughness: clamp((t.ridgeWeight || 0.15) / 0.35, 0, 1.4),
    openness: clamp((t.continentScale || 30) / 46, 0.25, 1.4),
    chill: clamp(1 - ((t.baseTemperature || 14) + 12) / 52, 0, 1),
    terracing: clamp((t.terraceLevels || 0) / 6, 0, 1),
  });
  signatureWorldCache = { world: W, value };
  return value;
}
function signatureCarModel(id = 0, hue = 30, truck = false) {
  const world = worldDesignSignature(), soc = W.components.social[id],
    culture = soc?.cultureId || soc?.factionId || 0,
    r = makeRng(hashParts(W.seedHash, "motor-design", culture, id || Math.round(hue)), "bodywork"),
    profile = truck ? 4 : (world.carProfile + r.int(3)) % 4;
  return {
    profile: ["saloon", "fastback", "compact", "estate", "utility"][profile],
    // Long on open ground, short and high over broken country.
    length:
      (profile === 2 ? 1.45 : profile === 4 ? 2.2 : 1.8) *
      world.wheelbase *
      (1.12 - world.roughness * 0.28) *
      (0.86 + world.openness * 0.22) *
      r.range(0.93, 1.07),
    height: (profile === 1 ? 0.42 : profile === 3 ? 0.63 : 0.53) * (0.92 + world.roughness * 0.2) * r.range(0.9, 1.13),
    wheel: world.clearance * (0.85 + world.roughness * 0.45) * r.range(0.9, 1.2),
    roof: r.range(0.45, 0.75),
    nose: r.range(0.12, 0.3) * (1.25 - world.roughness * 0.35),
    hue: wrapHue(hue + r.range(-16, 16)),
    rack: truck || (world.wet < 0.4 && r.next() < 0.5) || world.terracing > 0.6,
    twoTone: r.next() < 0.45,
    // Small glass on a cold world, a sealed cabin on a wet one.
    windows: profile === 3 || truck ? 3 : world.chill > 0.62 ? 1 : 2,
    sealed: world.wet > 0.6 || world.chill > 0.7,
    layout: world.vehicleGrammar,
  };
}
const buildingPaletteSignatureBase = buildingPalette;
buildingPalette = function (b) {
  const p = buildingPaletteSignatureBase(b);
  if (!canonicalPlanetSeed(W.seed)) return p;
  const wood = p.sp === C.FIBER || p.sp === C.ORGANIC, hue = wood ? 29 : p.sp === C.METAL ? 205 : 38;
  return { ...p, base: hsl(hue, wood ? 30 : 12, wood ? 46 : 57),
    light: hsl(hue + 4, wood ? 27 : 13, 73), dark: hsl(hue - 5, 20, 25), accent: "#c4a16b" };
};
drawMotorCar = function (g, r, hue, now, still, truck, lit) {
  const m = signatureCarModel(ACTIVE_VEHICLE_ID || 0, hue, truck), L = r * m.length,
    h = r * m.height, wheel = Math.max(1.1, r * m.wheel), rear = -L * 0.5,
    roofY = -h * (truck ? 2 : 1.8), frontRoof = L * (m.profile === "compact" ? 0.24 : 0.13);
  g.save();
  g.translate(0, still ? 0 : Math.sin(now * 0.018) * r * 0.018);
  g.fillStyle = "rgba(10,14,18,.3)"; g.beginPath(); g.ellipse(0, wheel * 0.75, L * 0.58, wheel * 0.5, 0, 0, Math.PI * 2); g.fill();
  g.lineJoin = "round"; g.lineWidth = Math.max(0.6, r * 0.04); g.strokeStyle = hsl(m.hue, 25, 22);
  g.fillStyle = hsl(m.hue, 48, 47);
  g.beginPath();
  if (m.layout === "pod") g.ellipse(0, -h * 0.85, L * 0.54, h * 1.04, 0, 0, Math.PI * 2);
  else {
    g.moveTo(rear, 0); g.lineTo(rear, -h * 0.8);
    g.lineTo(rear + L * 0.08, -h);
    g.lineTo(-L * (m.layout === "wedge" ? 0.4 : 0.3), roofY);
    g.lineTo(m.layout === "tandem" ? L * 0.35 : frontRoof, roofY);
    g.lineTo(L * (0.5 - m.nose), -h);
    g.quadraticCurveTo(L * 0.48, -h, L * 0.5, -h * 0.55);
    g.lineTo(L * 0.5, 0); g.closePath();
  }
  g.fill(); g.stroke();
  if (truck) { g.fillStyle = hsl(m.hue + 25, 22, 42); g.fillRect(rear, -h * 1.7, L * 0.53, h * 1.2); }
  else {
    g.fillStyle = m.twoTone ? "#dfd9c8" : hsl(m.hue, 45, 63);
    g.fillRect(-L * 0.28, roofY - r * 0.035, L * m.roof * 0.7, r * 0.055);
  }
  g.fillStyle = lit ? "#344854" : "#a1cbd6";
  for (let n = 0; n < m.windows; n++) {
    const x = -L * 0.25 + n * L * 0.42 / m.windows;
    g.fillRect(x, roofY + h * 0.18, L * 0.34 / m.windows, h * 0.55);
  }
  g.strokeStyle = hsl(m.hue, 26, 29); g.lineWidth = Math.max(0.6, r * 0.025);
  for (const x of [-L * 0.06, L * 0.17]) {
    g.beginPath(); g.moveTo(x, -h); g.lineTo(x, -h * 0.18); g.stroke();
    g.fillStyle = "#dad7cc"; g.fillRect(x - L * 0.06, -h * 0.83, L * 0.04, h * 0.07);
  }
  if (m.rack) { g.strokeStyle = "#686d6b"; g.strokeRect(-L * 0.27, roofY - h * 0.24, L * 0.36, h * 0.2); }
  g.fillStyle = "#b8b7ad"; g.fillRect(rear - r * 0.03, -h * 0.2, L + r * 0.06, h * 0.12);
  for (const x of m.layout === "crawler" ? [-L * 0.35, 0, L * 0.35] : [-L * 0.3, L * 0.3]) {
    g.fillStyle = "#1c2429"; g.beginPath(); g.arc(x, 0, wheel, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#c6c8c5"; g.beginPath(); g.arc(x, 0, wheel * 0.58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#565f63"; g.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = (still ? 0 : now * 0.014) + k * Math.PI / 3;
      g.moveTo(x - Math.cos(a) * wheel * 0.5, -Math.sin(a) * wheel * 0.5);
      g.lineTo(x + Math.cos(a) * wheel * 0.5, Math.sin(a) * wheel * 0.5);
    }
    g.stroke();
  }
  g.fillStyle = lit ? "#fff4bd" : "#e8e5d2"; g.fillRect(L * 0.44, -h * 0.75, L * 0.07, h * 0.22);
  g.fillStyle = "#d95042"; g.fillRect(rear, -h * 0.75, L * 0.04, h * 0.22);
  g.restore();
};

// Height follows the accommodation actually built, rather than swelling and
// shrinking with today's population. Each site has its own facade and roof.
blockStoreys = function (b) {
  const r = visualHash01(b.id, 0xb10c);
  if (b.type === "office") return 9 + Math.floor(r * 12);
  return Math.max(2, Math.ceil((b.housing || BUILDING_DEFS[b.type]?.housing || 6) / (b.type === "tower" ? 4 : 6)));
};
function signatureBuildingModel(b) {
  const world = worldDesignSignature(), r = makeRng(hashParts(W.seedHash, "facade", b.placeId, b.id), "building");
  return { width: world.buildWidth * r.range(0.85, 1.15), tiers: r.int(3),
    facade: (world.facade + r.int(3)) % 4, hue: world.earth ? r.range(25, 55) : r.range(0, 360),
    crown: r.int(3), storeys: blockStoreys(b) };
}
drawTowerBlock = function (g, b, s, r, p, now, detail) {
  const design = signatureBuildingModel(b), n = design.storeys, office = b.type === "office",
    w = r * 0.7 * design.width, sh = r * 0.34, base = s.y + r * 0.35,
    night = typeof nightStrength === "function" ? nightStrength() : 0,
    hue = office ? mixHue(205, design.hue, 0.2) : design.hue,
    residents = b.tenancy?.residents.length || 0, occupancy = office ? 0.55 : residents / Math.max(1, habitationBeds(b));
  g.save(); g.lineWidth = Math.max(0.7, r * 0.025);
  for (let floor = 0; floor < n; floor++) {
    const setback = design.tiers ? 1 - Math.floor(floor / Math.ceil(n / (design.tiers + 1))) * 0.12 : 1,
      fw = w * setback, y = base - (floor + 1) * sh;
    g.fillStyle = hsl(hue, office ? 20 : 16, 58); g.fillRect(s.x - fw, y, fw * 1.65, sh);
    g.fillStyle = hsl(hue, 18, 34); g.fillRect(s.x + fw * 0.65, y, fw * 0.35, sh);
    g.strokeStyle = hsl(hue, 15, 38); g.strokeRect(s.x - fw, y, fw * 2, sh);
    if (detail) {
      const cols = design.facade === 1 ? 5 : 3;
      for (let c = 0; c < cols; c++) {
        const lit = night > 0.3 && visualHash01(b.id * 173 + floor * 11 + c, 0x119) < occupancy * 0.85;
        g.fillStyle = lit ? "#f4dba0" : office ? "#87b2c1" : "#596d78";
        g.fillRect(s.x - fw * 0.87 + c * fw * 1.48 / cols, y + sh * 0.2, fw * 1.02 / cols, sh * 0.54);
        if (lit) SKYLINE.litWindows++;
      }
      if (!office && design.facade >= 2 && floor > 0) {
        g.fillStyle = "#c4b8a4"; g.fillRect(s.x - fw * 0.8, y + sh * 0.83, fw * 1.3, sh * 0.11);
        if (design.facade === 3) { g.fillStyle = "#547356"; g.fillRect(s.x - fw * 0.55, y + sh * 0.58, fw * 0.2, sh * 0.25); }
      }
    }
  }
  const top = base - n * sh;
  g.fillStyle = hsl(hue, 16, 32);
  if (design.crown === 0) g.fillRect(s.x - w * 0.35, top - r * 0.18, w * 0.7, r * 0.18);
  else if (design.crown === 1) {
    g.beginPath(); g.moveTo(s.x - w * 0.55, top); g.lineTo(s.x, top - r * 0.32); g.lineTo(s.x + w * 0.55, top); g.closePath(); g.fill();
  } else { g.strokeStyle = "#92acbc"; g.beginPath(); g.moveTo(s.x, top); g.lineTo(s.x, top - r * 0.65); g.stroke(); }
  g.fillStyle = "#2c414a"; g.fillRect(s.x - r * 0.12, base - sh * 0.85, r * 0.24, sh * 0.85);
  if (detail) drawBuildingFunctionMarks(g, b, s, r, p, now, detail, { hw: w, h: n * sh, baseY: base, topY: top });
  g.restore(); SKYLINE.blocksDrawn++; if (b.type === "tenement") CITIES.tenementsDrawn++;
};

const signatureCreatureCache = new WeakMap();
const drawCompletedBuildingSignatureBase = drawCompletedBuilding;
drawCompletedBuilding = function (g, b, s, r, p, now, m) {
  if (b.type !== "shelter") return drawCompletedBuildingSignatureBase(g, b, s, r, p, now, m);
  const design = signatureBuildingModel(b);
  g.save(); g.translate(s.x, s.y); g.scale(design.width, 1); g.translate(-s.x, -s.y);
  drawCompletedBuildingSignatureBase(g, b, s, r, p, now, m);
  if (buildingDetailLevel() > 0 && b.tenancy?.residents.length) {
    g.fillStyle = p.dark; g.fillRect(s.x - r * 0.18, s.y + r * 0.32, r * 0.36, r * 0.09);
    if (b.tenancy.decor.length) {
      g.fillStyle = hsl(design.hue, 30, 42); g.fillRect(s.x + r * 0.3, s.y + r * 0.12, r * 0.25, r * 0.12);
      g.fillStyle = "#597b50"; g.beginPath(); g.ellipse(s.x + r * 0.42, s.y + r * 0.08, r * 0.17, r * 0.1, 0, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
};
const creatureModelSignatureBase = creatureModel;
creatureModel = function (id) {
  const base = creatureModelSignatureBase(id);
  if (!base) return base;
  if (signatureCreatureCache.has(base)) return signatureCreatureCache.get(base);
  const world = worldDesignSignature(), r = makeRng(hashParts(W.seedHash, "individual-build", id, W.components.genome[id]?.lineageId || id), "proportions"),
    role = creatureSourceKind(id), model = { ...base,
      bulk: clamp((base.bulk || 1) * world.bodyWidth * r.range(0.86, 1.15), 0.55, 1.75),
      aspect: clamp((base.aspect || 1) * r.range(0.82, 1.18), 0.55, 1.8),
      limbLength: clamp((base.limbLength || 1) * world.limbLength * r.range(0.88, 1.12), 0.5, 1.8),
      neck: clamp((base.neck || 0.2) * r.range(0.65, 1.45), 0.05, 0.9),
    };
  if (role !== KINDS.PERSON && model.faunaKind) model.faunaPattern = ["plain", "spots", "bands", "veins"][r.int(4)];
  if (!world.earth) { model.primaryHue = wrapHue(base.primaryHue + r.range(-20, 20)); model.secondaryHue = wrapHue(base.secondaryHue + r.range(-20, 20)); }
  signatureCreatureCache.set(base, model); return model;
};
const drawTreeSpeciesSignatureBase = drawTreeSpecies;
function signatureNativeCanopy(g, species, p, r, h, v, i, sway, season, detail) {
  const world = worldDesignSignature(), count = world.branches + Math.floor(visualHash01(i, 0xca21) * 3),
    leaves = leafTone(v, species, season, i), tips = [];
  g.strokeStyle = hsl(v.mineralHue, 30, 32); g.lineWidth = Math.max(1.4, r * 0.13); g.lineCap = "round";
  g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x + sway, p.y - h * 0.45, p.x + sway * 0.5, p.y - h); g.stroke();
  for (let n = 0; n < count; n++) {
    const f = (n + 1) / (count + 1), side = n % 2 ? -1 : 1,
      reach = r * (0.6 + visualHash01(i, 0xca30 + n)) * Math.sin(f * Math.PI),
      x = p.x + side * reach + sway * f,
      y = p.y - h * (world.canopyLift + f * 0.65) + reach * world.boughDroop;
    tips.push({ x, y });
    g.lineWidth = Math.max(0.8, r * 0.08 * (1 - f * 0.4)); g.beginPath();
    g.moveTo(p.x + sway * f * 0.5, p.y - h * (f * 0.62 + 0.18));
    g.quadraticCurveTo(x, y + h * 0.1, x, y); g.stroke();
    if (season.bare > 0.65) continue;
    g.fillStyle = hsl(leaves.hue + n * 3, 48, leaves.light + n % 3 * 7); g.beginPath();
    const spread = r * world.leafSpread, rise = r * world.leafRise, tilt = side * world.leafTilt;
    if (world.canopyGrammar === 0) g.ellipse(x, y, spread, rise * 0.55, tilt, 0, Math.PI * 2);
    else if (world.canopyGrammar === 1) { g.moveTo(x - spread, y); g.quadraticCurveTo(x + tilt * r * 0.2, y - rise, x + spread, y); g.lineTo(x, y + rise * 0.2); }
    else if (world.canopyGrammar === 2) { g.moveTo(x - spread * 0.7, y); g.lineTo(x + tilt * r * 0.15, y - rise * 1.2); g.lineTo(x + spread * 0.7, y); g.lineTo(x, y + rise * 0.22); }
    else { g.ellipse(x, y, spread * 0.6, rise, tilt, 0, Math.PI * 2); }
    g.closePath(); g.fill();
    if (detail > 1) { g.strokeStyle = hsl(leaves.hue + 20, 38, leaves.light + 18); g.lineWidth = Math.max(0.6, r * 0.025); g.stroke(); g.strokeStyle = hsl(v.mineralHue, 30, 32); }
  }
  if (detail && FRUIT_SPECIES[species] && !season.bare && fruitAt(i) >= 0.15) {
    g.fillStyle = fruitTone(species);
    for (const tip of tips.filter((_, n) => n % 2 === 0)) { g.beginPath(); g.arc(tip.x, tip.y + r * 0.15, Math.max(0.8, r * 0.08), 0, Math.PI * 2); g.fill(); }
    LIVING_GROVE.fruitDrawn++;
  }
}
drawTreeSpecies = function (g, species, p, r, h, v, i, sway, season, detail) {
  const world = worldDesignSignature(), width = world.canopyWidth * (0.8 + visualHash01(i, 0xc410) * 0.4),
    height = world.canopyHeight * (0.85 + visualHash01(i, 0xc411) * 0.3);
  g.save(); g.translate(p.x, p.y); g.transform(width, 0, world.canopyLean * 0.25, height, 0, 0); g.translate(-p.x, -p.y);
  if (!world.earth && species !== "snag" && species !== "shrub") signatureNativeCanopy(g, species, p, r, h, v, i, sway, season, detail);
  else drawTreeSpeciesSignatureBase(g, species, p, r, h, v, i, sway, season, detail);
  g.restore();
};
const drawCragSignatureBase = drawCrag;
drawCrag = function (x, y, i, p, m, v, spec, inst) {
  const design = worldDesignSignature();
  if (design.mountain === "ridge") return drawCragSignatureBase(x, y, i, p, m, v, spec, inst);
  const at = inst ? { x: p.x + inst.dx, y: p.y + inst.dy } : p,
    r = Math.max(3, m.tw * 0.5 * (spec.scale || 1) * (inst?.s || 1)),
    h = featureVerticalUnit(m) * (1.5 + visualHash01(i, 0xc4a2)) * design.mountainAspect,
    // The family sets the range and the world sets the shape inside it.
    crown = clamp(
      design.cragCrown *
        (design.mountain === "mesa" ? 1.35 : design.mountain === "dome" ? 0.8 : 0.35),
      0.03,
      0.72,
    ),
    lean = r * design.cragLean,
    shoulder = design.cragShoulder;
  ctx.save(); ctx.fillStyle = hsl(v.mineralHue, 26, 45); ctx.strokeStyle = hsl(v.mineralHue, 24, 25);
  ctx.lineWidth = Math.max(0.7, r * 0.03); ctx.beginPath(); ctx.moveTo(at.x - r, at.y);
  if (design.mountain === "dome")
    ctx.bezierCurveTo(at.x - r * 0.8 + lean, at.y - h, at.x + r * 0.8 + lean, at.y - h * (1 - design.cragBite * 0.4), at.x + r, at.y);
  else {
    ctx.lineTo(at.x - r * shoulder + lean * 0.4, at.y - h * (0.42 + design.cragBite));
    ctx.lineTo(at.x - r * crown + lean, at.y - h);
    ctx.lineTo(at.x + r * crown * 0.8 + lean, at.y - h * (0.96 - design.cragBite * 0.25));
    ctx.lineTo(at.x + r * shoulder + lean * 0.4, at.y - h * 0.5);
    ctx.lineTo(at.x + r, at.y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = hsl(v.mineralHue - 10, 24, 31); ctx.beginPath(); ctx.moveTo(at.x, at.y - h * (design.mountain === "dome" ? 0.74 : 0.98));
  ctx.lineTo(at.x + r * crown * 0.8, at.y - h * 0.96); ctx.lineTo(at.x + r, at.y); ctx.lineTo(at.x + r * 0.15, at.y); ctx.closePath(); ctx.fill();
  if (UI.quality !== "low") for (let n = 1; n < design.cragTiers; n++) {
    const f = n / design.cragTiers, half = r * (crown + (1 - crown) * f);
    ctx.strokeStyle = hsl(v.mineralHue + n * 2, 22, 30 + n * 3, 0.6); ctx.beginPath();
    ctx.moveTo(at.x - half * 0.9, at.y - h * (1 - f)); ctx.lineTo(at.x + half * 0.8, at.y - h * (1 - f) + r * 0.06); ctx.stroke();
  }
  ctx.restore(); GROVE.crags++;
};
function signatureAtlas() {
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 780;
  const g = canvas.getContext("2d"); g.fillStyle = "#18252c"; g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#f0e6cd"; g.font = "28px sans-serif"; g.fillText(W.seed, 35, 45);
  g.font = "15px sans-serif"; g.fillStyle = "#a5bac2"; g.fillText("Motor designs · residential and office architecture · native life", 35, 73);
  const previous = ACTIVE_VEHICLE_ID;
  for (let n = 0; n < 6; n++) {
    ACTIVE_VEHICLE_ID = 100 + n;
    g.save(); g.translate(115 + n * 190, 185); drawMotorCar(g, 60, 20 + n * 47, 1000, true, n === 5, false); g.restore();
  }
  ACTIVE_VEHICLE_ID = previous;
  for (let n = 0; n < 5; n++) {
    const b = { id: 100 + n, placeId: W.settlements[0]?.id || 0, placeKind: "settlement", x: 1, y: 1,
      type: n % 2 ? "office" : "tower", housing: n % 2 ? 0 : 36, complete: true, composition: new Uint16Array(SPECIES_COUNT), requirements: [] };
    drawTowerBlock(g, b, { x: 120 + n * 235, y: 545 }, 48, { base: "#b8a78b", dark: "#454f54", light: "#ddd4bb", accent: "#759698" }, 1000, 2);
  }
  const v = makePlanetVisualGenome();
  for (let n = 0; n < 6; n++) drawTreeSpecies(g, ["broadleaf", "conifer", "willow", "baobab", "birch", "palm"][n],
    { x: 100 + n * 195, y: 735 }, 22, 95, v, n * 127 + 18, 0, { fall: 0, bare: 0 }, 2);
  return { png: canvas.toDataURL("image/png"), seed: W.seed, design: worldDesignSignature() };
}
window.ALIFE_DESIGN_DEBUG = Object.freeze({ world: worldDesignSignature, car: signatureCarModel, atlas: signatureAtlas,
  building: (id) => { const b = W.buildings.find((x) => x.id === id); return b ? signatureBuildingModel(b) : null; },
});
