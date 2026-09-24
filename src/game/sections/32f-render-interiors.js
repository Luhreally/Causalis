// ═══════════════════════════════════════════════════════════════════════════
// 32f. RENDER — INTERIORS: households, furniture, the cutaway and the roof
// ═══════════════════════════════════════════════════════════════════════════
// Which buildings open, who is inside them and how they are grouped, the
// interior state and furniture, the cutaway interior, exterior details, and the
// roof pass over a site.
// This section was one file of three thousand three hundred lines,
// 32d-spatial-rendering.js, split in six along its own seams on 2026-09-14; the
// composed runtime is unchanged. Everything here reads world state and never
// writes it: visual caches live outside W so the simulation hash and replay
// determinism are untouched by anything drawn.
const INTERIOR_BUILDING_TYPES = new Set([
  "stockpile",
  "shelter",
  "hearth",
  "workshop",
  "kiln",
  "forge",
  "clinic",
  "archive",
  "hall",
  "waterworks",
]);
function householdGroups(residents) {
  const residentSet = new Set(residents),
    parent = new Map(residents.map((id) => [id, id])),
    find = (id) => {
      let p = parent.get(id);
      while (p !== parent.get(p)) p = parent.get(p);
      let q = id;
      while (parent.get(q) !== p) {
        const next = parent.get(q);
        parent.set(q, p);
        q = next;
      }
      return p;
    },
    join = (a, b) => {
      if (!residentSet.has(a) || !residentSet.has(b)) return;
      const ra = find(a),
        rb = find(b);
      if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
    };
  for (const id of residents) {
    const social = W.components.social[id],
      identity = W.components.identity[id];
    if (social?.partnerId) join(id, social.partnerId);
    for (const child of identity?.children || []) join(id, child);
  }
  const groups = new Map();
  for (const id of residents) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }
  return Array.from(groups.values())
    .map((ids) => ids.sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0]);
}
function makeInteriorState(bounds) {
  const state = {
      visible: new Set(),
      inside: new Map(),
      homes: new Map(),
      homeByPerson: new Map(),
      households: new Map(),
    },
    enabled = !!UI.camera.cutaway && UI.camera.zoom >= 2.35;
  if (!enabled) return state;
  const visible = W.buildings.filter(
    (b) =>
      b.complete &&
      !b.ruined &&
      INTERIOR_BUILDING_TYPES.has(b.type) &&
      b.x >= bounds.x0 - 2 &&
      b.x <= bounds.x1 + 2 &&
      b.y >= bounds.y0 - 2 &&
      b.y <= bounds.y1 + 2,
  );
  for (const b of visible) {
    state.visible.add(b.id);
    state.inside.set(b.id, []);
    state.homes.set(b.id, []);
  }
  const places = new Map();
  for (const b of visible) {
    const key = `${b.placeKind}:${b.placeId}`;
    if (!places.has(key)) places.set(key, buildingPlace(b));
  }
  for (const place of places.values()) {
    if (!place) continue;
    const residents = localPlaceWorkers(place),
      shelters = completedBuildings(place)
        .filter((b) => b.housing > 0)
        .sort((a, b) => a.id - b.id);
    for (const group of householdGroups(residents)) {
      state.households.set(group[0], group.slice());
      let cursor = 0;
      for (const id of group) {
        let attempts = 0;
        while (shelters.length && attempts < shelters.length) {
          const home = shelters[cursor % shelters.length],
            assigned = state.homes.get(home.id) || [];
          if (assigned.length < Math.max(1, home.housing)) {
            assigned.push(id);
            state.homes.set(home.id, assigned);
            state.homeByPerson.set(id, home.id);
            break;
          }
          cursor++;
          attempts++;
        }
      }
    }
    const interiors = completedBuildings(place).filter((b) => state.visible.has(b.id));
    for (const id of residents) {
      const explicitBuildingId = W.components.life[id]?.insideBuildingId || 0;
      if (explicitBuildingId) {
        const interior = interiors.find((building) => building.id === explicitBuildingId);
        if (interior) {
          state.inside.get(interior.id).push(id);
          ACTIVE_INTERIOR_IDS.add(id);
        }
        continue;
      }
    }
  }
  return state;
}
function drawInteriorFurniture(g, b, s, r, p, homes) {
  const ink = hsl((W.terrainGenome?.baseHue || 35) + 180, 18, 12, 0.86);
  g.strokeStyle = p.dark;
  g.fillStyle = ink;
  g.lineWidth = Math.max(1, r * 0.045);
  const bed = (x, y) => {
    g.fillStyle = p.light;
    g.fillRect(s.x + x * r - r * 0.16, s.y + y * r - r * 0.08, r * 0.32, r * 0.16);
    g.fillStyle = p.accent;
    g.fillRect(s.x + x * r - r * 0.14, s.y + y * r - r * 0.06, r * 0.09, r * 0.12);
  };
  if (b.type === "shelter" || b.type === "clinic") {
    const count = Math.max(2, Math.min(6, homes.length || b.housing || 2));
    for (let n = 0; n < count; n++) bed(((n % 3) - 0.95) * 0.53, (Math.floor(n / 3) - 0.45) * 0.55);
  }
  if (b.type === "hearth" || b.type === "forge" || b.type === "kiln") {
    g.fillStyle = hsl(25, 94, 54, 0.9);
    g.beginPath();
    g.arc(s.x, s.y - r * 0.02, Math.max(2, r * 0.14), 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.light;
    g.beginPath();
    g.arc(s.x, s.y - r * 0.02, r * 0.23, 0, Math.PI * 2);
    g.stroke();
  }
  if (["workshop", "forge", "archive"].includes(b.type)) {
    g.fillStyle = p.light;
    g.fillRect(s.x - r * 0.65, s.y - r * 0.1, r * 1.3, r * 0.18);
    g.strokeRect(s.x - r * 0.65, s.y - r * 0.1, r * 1.3, r * 0.18);
    for (let n = 0; n < 4; n++) {
      g.strokeStyle = n % 2 ? p.accent : p.dark;
      g.beginPath();
      g.moveTo(s.x - r * 0.48 + n * r * 0.31, s.y - r * 0.1);
      g.lineTo(s.x - r * 0.36 + n * r * 0.31, s.y - r * 0.36);
      g.stroke();
    }
  }
  if (b.type === "stockpile") {
    for (let n = 0; n < 7; n++) {
      g.fillStyle = n % 2 ? p.base : p.light;
      g.fillRect(
        s.x - r * 0.68 + (n % 4) * r * 0.36,
        s.y - r * 0.36 + Math.floor(n / 4) * r * 0.34,
        r * 0.25,
        r * 0.22,
      );
      g.strokeRect(
        s.x - r * 0.68 + (n % 4) * r * 0.36,
        s.y - r * 0.36 + Math.floor(n / 4) * r * 0.34,
        r * 0.25,
        r * 0.22,
      );
    }
  }
  if (b.type === "hall") {
    g.fillStyle = p.light;
    g.fillRect(s.x - r * 0.64, s.y - r * 0.1, r * 1.28, r * 0.2);
    g.strokeRect(s.x - r * 0.64, s.y - r * 0.1, r * 1.28, r * 0.2);
    g.fillStyle = p.accent;
    g.fillRect(s.x - r * 0.06, s.y - r * 0.65, r * 0.12, r * 0.44);
  }
  g.strokeStyle = p.dark;
  g.beginPath();
  g.moveTo(s.x, s.y - r * 0.54);
  g.lineTo(s.x, s.y + r * 0.46);
  g.stroke();
}
function drawBuildingInterior(g, b, now, m, state) {
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
    r = buildingScreenSize(b, m),
    p = buildingPalette(b),
    inside = state.inside.get(b.id) || [],
    homes = state.homes.get(b.id) || [];
  g.save();
  drawBuildingFootprint(g, s, r, UI.view, p.dark, p.light, false);
  drawBuildingFootprint(
    g,
    s,
    r * 0.88,
    UI.view,
    hsl((W.definitions.species[p.sp]?.colorHue || 40) + 9, 28, 32),
    p.base,
    false,
  );
  g.strokeStyle = p.light;
  g.lineWidth = Math.max(2, r * 0.1);
  g.beginPath();
  g.moveTo(s.x - r * 0.82, s.y - r * 0.43);
  g.lineTo(s.x - r * 0.82, s.y - r * 0.86);
  g.lineTo(s.x + r * 0.82, s.y - r * 0.86);
  g.lineTo(s.x + r * 0.82, s.y - r * 0.43);
  g.stroke();
  drawInteriorFurniture(g, b, s, r, p, homes);
  for (let n = 0; n < inside.length; n++) {
    const id = inside[n],
      life = W.components.life[id],
      work = W.components.work?.[id],
      resting = life?.behavior === "rest",
      crafting = work && work.task === "craft" && W.tick - work.handledTick <= 12,
      scale = clamp(r * 0.115, 2.4, 64),
      fac = W.components.social[id]?.factionId
        ? W.factions.find((f) => f.id === W.components.social[id].factionId)
        : null;
    if (resting && ["shelter", "clinic"].includes(b.type)) {
      const bedCount = Math.max(2, Math.min(6, homes.length || b.housing || 2)),
        bed = n % bedCount,
        bx = s.x + ((bed % 3) - 0.95) * r * 0.53,
        by = s.y + (Math.floor(bed / 3) - 0.45) * r * 0.55;
      g.save();
      g.translate(bx, by);
      g.rotate(1.25);
      g.translate(-bx, -by);
      drawCreatureGlyph(g, id, { x: bx, y: by }, now, fac, scale);
      g.restore();
      continue;
    }
    let pos,
      motion2 = null;
    if (crafting) pos = { x: s.x + (n % 2 ? r * 0.32 : -r * 0.32), y: s.y - r * 0.16 };
    else {
      const wp = Math.floor(now / 2400 + visualHash01(id, 0x77) * 9),
        tfx = (visualHash01(id, 0x100 + (wp % 13)) - 0.5) * 1.15,
        tfy = (visualHash01(id, 0x200 + (wp % 13)) - 0.4) * 0.72;
      let e = INTERIOR_MOTION.get(id);
      if (!e || e.fx === undefined) {
        e = { fx: tfx, fy: tfy };
        INTERIOR_MOTION.set(id, e);
      }
      const ddx = tfx - e.fx,
        ddy = tfy - e.fy,
        dd = Math.hypot(ddx, ddy);
      if (dd > 0.045) {
        e.fx += ddx * 0.055;
        e.fy += ddy * 0.055;
        motion2 = {
          gait: now * 0.011 + (id % 17),
          moving: true,
          screenHeading: Math.atan2(ddy, ddx),
        };
      }
      pos = { x: s.x + e.fx * r, y: s.y + e.fy * r };
    }
    drawCreatureGlyph(g, id, pos, now, fac, scale, false, motion2);
    if (crafting) {
      const tap = Math.sin(now * 0.012 + id) * scale * 0.5;
      g.strokeStyle = p.accent;
      g.lineWidth = Math.max(1, scale * 0.2);
      g.beginPath();
      g.moveTo(pos.x + scale * 0.5, pos.y - scale * 0.2 + tap * 0.3);
      g.lineTo(pos.x + scale * 1.1, pos.y + scale * 0.3);
      g.stroke();
    }
    if (UI.camera.zoom > 8 && UI.labels) {
      const name = W.components.identity[id]?.generatedName || `#${id}`;
      g.font = "9px system-ui";
      g.textAlign = "center";
      g.fillStyle = "#eef4e8";
      g.fillText(name, pos.x, pos.y - r * 0.15);
    }
  }
  if (UI.labels && UI.camera.zoom > 8) {
    const household = homes.length
        ? `${homes.length} resident${homes.length === 1 ? "" : "s"}`
        : "shared interior",
      activity = inside.length ? `${inside.length} inside` : "unoccupied";
    g.font = "10px system-ui";
    g.textAlign = "center";
    g.fillStyle = "#071016d9";
    g.fillRect(s.x - r * 0.72, s.y + r * 0.52, r * 1.44, 14);
    g.fillStyle = p.light;
    g.fillText(`${b.name} · ${household} · ${activity}`, s.x, s.y + r * 0.63);
  }
  g.restore();
}
function drawBuildingExteriorDetails(g, b, now, m) {
  if (!b.complete || b.ruined || UI.camera.zoom < 2.1) return;
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
    r = buildingScreenSize(b, m),
    p = buildingPalette(b);
  g.save();
  if (
    UI.quality !== "low" &&
    !ACTIVE_REDUCED_MOTION &&
    (b.type === "hearth" || b.type === "kiln" || b.type === "forge")
  ) {
    // Working hearths and furnaces smoke, and the smoke leans with the wind.
    const v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
      strength = b.type === "hearth" ? 0.55 : 0.9,
      wd = v.surface
        ? worldDirToScreen(Math.cos(v.surface.wind.angle), Math.sin(v.surface.wind.angle), m)
        : { x: 1, y: 0 },
      wl = Math.hypot(wd.x, wd.y) || 1;
    for (let n = 0; n < 3; n++) {
      const t = (((now * 0.00028 * (1 + n * 0.25) + visualHash01(b.id, 0x5a0 + n)) % 1) + 1) % 1,
        sr = r * (0.1 + t * 0.32) * strength;
      g.fillStyle = hsl(v.mineralHue, 12, 62, (1 - t) * 0.26 * strength);
      g.beginPath();
      g.arc(
        s.x + r * 0.32 + Math.sin(t * 5 + n) * r * 0.15 + (wd.x / wl) * t * r * 0.9,
        s.y - r * 0.9 - t * r * 1.5 + (wd.y / wl) * t * r * 0.3,
        sr,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  }
  if (!OPEN_BUILDING_TYPES.has(b.type)) {
    g.fillStyle = p.dark;
    g.fillRect(s.x - r * 0.12, s.y - r * 0.18, r * 0.24, r * 0.48);
    g.fillStyle = hsl(ACTIVE_PLANET_VISUAL?.accentHue || 45, 62, 72, 0.8);
    for (const x of [-0.52, 0.52]) {
      g.fillRect(s.x + x * r - r * 0.09, s.y - r * 0.38, r * 0.18, r * 0.13);
      g.strokeStyle = p.dark;
      g.strokeRect(s.x + x * r - r * 0.09, s.y - r * 0.38, r * 0.18, r * 0.13);
    }
  }
  if (b.integrity < b.maxIntegrity * 0.75) {
    g.fillStyle = "#0b1015bb";
    g.fillRect(s.x - r * 0.6, s.y + r * 0.56, r * 1.2, 4);
    g.fillStyle = b.integrity < b.maxIntegrity * 0.35 ? "#e0645c" : "#d9b56d";
    g.fillRect(
      s.x - r * 0.6,
      s.y + r * 0.56,
      r * 1.2 * clamp(b.integrity / b.maxIntegrity, 0, 1),
      4,
    );
  }
  if (UI.camera.zoom > 7 && UI.labels) {
    g.font = "10px system-ui";
    g.textAlign = "center";
    g.fillStyle = p.light;
    g.fillText(b.name, s.x, s.y - r * 1.18);
  }
  g.restore();
}
const drawBuildingSiteRoofBase = drawBuildingSite;
drawBuildingSite = function (g, b, now, m) {
  const shakeUntil = BASH_SHAKE.get(b.id),
    shaking = shakeUntil && now < shakeUntil;
  if (shakeUntil && !shaking) BASH_SHAKE.delete(b.id);
  if (shaking) {
    const kk = Math.max(1.2, m.tw * 0.028);
    g.save();
    g.translate(Math.sin(now * 0.09 + b.id * 3) * kk, Math.cos(now * 0.11 + b.id) * kk * 0.6);
  }
  if (UI.view !== "top" && !b.ruined && (b.complete || b.stage > 0)) {
    const sh = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m);
    drawGroundShadow(g, sh, buildingScreenSize(b, m) * 1.02, 0.3, 0.24);
  }
  if (ACTIVE_INTERIOR_STATE?.visible.has(b.id))
    drawBuildingInterior(g, b, now, m, ACTIVE_INTERIOR_STATE);
  else {
    drawBuildingSiteRoofBase(g, b, now, m);
    drawBuildingExteriorDetails(g, b, now, m);
  }
  if (shaking) g.restore();
};
