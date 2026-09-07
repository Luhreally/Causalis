// ═══════════════════════════════════════════════════════════════════════════
// 88. ROADS AND WHEELS — paved roads, iron rails, carts, and engines on them
// ═══════════════════════════════════════════════════════════════════════════
// Feet wore paths and paths sped travel, but no polity ever built a road, and
// nothing rolled. Here a polity that knows Paved Roads lays a graded bed of
// stone between its towns, a few tiles a season along the corridor its
// caravans already find, paying mineral from the town stores into a road
// ledger that the conservation audit counts; a polity that knows Railways lays
// iron rails between its two largest towns the same way, paying metal. A road
// is easier going for everyone on foot (one tick less between steps), and the
// crafts put vehicles on it: with the Wheel a caravan's carts roll one tile
// further each tick on a road, with Combustion Engines its trucks roll two,
// and on rails a train carries anyone three. Carts also let barter carry more.
// Roads are drawn as pale stone bands joining road tiles, rails as dark lines
// with ties, vehicles as carts and trucks under their travellers with turning
// wheels, and trains run the rails in the eye alone: rendering only reads.
const ROAD_NONE = 0,
  ROAD_PAVED = 1,
  ROAD_RAIL = 2,
  ROAD_PASS_CADENCE = 128,
  ROAD_PASS_OFFSET = 72,
  ROAD_TILES_PER_PASS = 6,
  ROAD_LINK_REACH = 64,
  RAIL_LINK_REACH = 90,
  ROAD_COST = 2,
  RAIL_COST = 2,
  CART_STEPS = 1,
  MOTOR_STEPS = 2,
  RAIL_STEPS = 3,
  VEHICLE_ORDERS = new Set([
    "caravan",
    "envoy",
    "migrate",
    "settle",
    "journey",
    "wedding",
    "prospect",
    "colonists",
    "relief",
  ]);
function ensureRoads(world = W) {
  if (!world?.tiles) return null;
  if (!world.tiles.road || world.tiles.road.length !== world.tileCount)
    world.tiles.road = new Uint8Array(world.tileCount);
  world.roads = world.roads || { version: 1, matter: new Uint32Array(SPECIES_COUNT), links: [], nextId: 1 };
  if (!(world.roads.matter instanceof Uint32Array) || world.roads.matter.length !== SPECIES_COUNT) {
    const m = new Uint32Array(SPECIES_COUNT),
      old = world.roads.matter || [];
    for (let i = 0; i < Math.min(SPECIES_COUNT, old.length); i++) m[i] = old[i] || 0;
    world.roads.matter = m;
  }
  world.roads.links = world.roads.links || [];
  world.roads.nextId = world.roads.nextId || 1;
  return world.roads;
}
const restoreWorldDefaultsRoadsBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldDefaultsRoadsBase();
  ensureRoads(W);
};
// The road bed is matter the world still holds.
const totalMatterRoadsBase = totalMatter,
  totalChemicalEnergyRoadsBase = totalChemicalEnergy;
totalMatter = function () {
  let total = totalMatterRoadsBase();
  if (W?.roads?.matter) for (const v of W.roads.matter) total += v;
  return total;
};
totalChemicalEnergy = function () {
  let total = totalChemicalEnergyRoadsBase();
  if (W?.roads?.matter) {
    const energy = W.definitions.species.map((s) => s.freeEnergy);
    for (let sp = 0; sp < SPECIES_COUNT; sp++) total += (W.roads.matter[sp] || 0) * (energy[sp] || 0);
  }
  return total;
};
function roadLevel(tile) {
  return W?.tiles?.road ? W.tiles.road[tile] : ROAD_NONE;
}
function roadLinkBetween(aId, bId, kind) {
  return (
    (W.roads?.links || []).find(
      (l) => l.kind === kind && ((l.a === aId && l.b === bId) || (l.a === bId && l.b === aId)),
    ) || null
  );
}
function tradeTripsBetween(a, b) {
  const lo = Math.min(a.id, b.id),
    hi = Math.max(a.id, b.id);
  return (W.tradeRoutes || []).filter((r) => r.a === lo && r.b === hi).reduce((n, r) => n + r.trips, 0);
}
// ── Laying the road ───────────────────────────────────────────────────────────
// The pair a polity joins next: the most travelled unlinked pair within reach,
// nearest first when no caravan has gone between any of them.
function chooseRoadPair(towns, kind, reach) {
  let best = null,
    score = -Infinity;
  for (let i = 0; i < towns.length; i++)
    for (let j = i + 1; j < towns.length; j++) {
      const a = towns[i],
        b = towns[j],
        d = Math.sqrt(dist2(a.x, a.y, b.x, b.y));
      if (d > reach || d < 4 || roadLinkBetween(a.id, b.id, kind)) continue;
      const s = tradeTripsBetween(a, b) * 10 - d;
      if (s > score) {
        score = s;
        best = [a, b];
      }
    }
  return best;
}
function startRoadLink(faction, a, b, kind) {
  const path = civilPathFind(idx(a.x, a.y), b, faction.id, "land");
  if (path.length < 2) return null;
  const link = {
    id: W.roads.nextId++,
    kind,
    a: a.id,
    b: b.id,
    factionId: faction.id,
    path,
    paved: 0,
    complete: false,
    abandoned: false,
    startedTick: W.tick,
    completedTick: 0,
  };
  W.roads.links.push(link);
  return link;
}
function roadEventFor(link, a, b) {
  const rail = link.kind === "rail",
    faction = W.factions.find((f) => f.id === link.factionId),
    ev = emitEvent(rail ? "RailEvent" : "RoadEvent", {
      subjects: [a.entityId, b.entityId],
      location: link.path[Math.floor(link.path.length / 2)],
      factions: faction ? [faction.id] : [],
      causes: [W.lastEventByType.TechAdvanceEvent, W.lastEventByType.CaravanEvent].filter(Boolean),
      evidence: [
        `${link.path.length} tiles of ${rail ? "iron rail" : "graded stone"} laid from the town stores`,
        `${Math.round((W.tick - link.startedTick) / TICKS_PER_YEAR)} years in the laying`,
      ],
      importance: 3,
      data: { a: a.name, b: b.name, tiles: link.path.length, kind: link.kind, polity: faction?.name || "" },
    });
  if (typeof recordMilestone === "function")
    recordMilestone(
      rail ? "first-rail" : "first-road",
      rail ? `The first railway ran between ${a.name} and ${b.name}` : `The first paved road joined ${a.name} and ${b.name}`,
      a,
      { evidence: `${link.path.length} tiles` },
    );
  return ev;
}
// A few tiles a season, paid for by whichever end still has the material.
function paveLink(link) {
  const a = W.settlements.find((s) => s.id === link.a),
    b = W.settlements.find((s) => s.id === link.b);
  if (!a || !b || a.ruined || b.ruined) {
    link.abandoned = true;
    return 0;
  }
  const rail = link.kind === "rail",
    level = rail ? ROAD_RAIL : ROAD_PAVED,
    sp = rail ? C.METAL : C.MINERAL,
    cost = rail ? RAIL_COST : ROAD_COST;
  // Wadeable water is bridged with a causeway at twice the cost; deep water,
  // which no land corridor crosses anyway, is left to the boats.
  const deep = (tile) => W.tiles.liquid[tile] > WATER_DEPTH.WADE_LIMIT,
    tileCost = (tile) => (W.tiles.liquid[tile] > 140 ? cost * 2 : cost);
  let laid = 0;
  for (const tile of link.path) {
    if (laid >= ROAD_TILES_PER_PASS) break;
    if (W.tiles.road[tile] >= level || deep(tile)) continue;
    const need = tileCost(tile),
      payer = [a, b].find((t) => (t.inventory[sp] || 0) >= need);
    if (!payer) break;
    payer.inventory[sp] -= need;
    W.roads.matter[sp] += need;
    W.tiles.road[tile] = level;
    laid++;
  }
  link.paved = link.path.filter((t) => W.tiles.road[t] >= level || deep(t)).length;
  if (link.paved >= link.path.length && !link.complete) {
    link.complete = true;
    link.completedTick = W.tick;
    link.eventId = roadEventFor(link, a, b).id;
  }
  return laid;
}
function roadPassFor(faction, force = false, only = null) {
  const towns = W.settlements.filter((s) => !s.ruined && s.factionId === faction.id);
  if (towns.length < 2) return { road: 0, rail: 0 };
  const out = { road: 0, rail: 0 };
  if ((force || factionHasTech(faction.id, "road_building")) && only !== "rail") {
    let link = W.roads.links.find((l) => l.factionId === faction.id && l.kind === "road" && !l.complete && !l.abandoned);
    if (!link) {
      const pair = chooseRoadPair(towns, "road", ROAD_LINK_REACH);
      if (pair) link = startRoadLink(faction, pair[0], pair[1], "road");
    }
    if (link) out.road = paveLink(link);
  }
  if ((force || factionHasTech(faction.id, "railways")) && only !== "road") {
    let link = W.roads.links.find((l) => l.factionId === faction.id && l.kind === "rail" && !l.complete && !l.abandoned);
    if (!link) {
      const largest = towns.slice().sort((p, q) => settlementPopulation(q) - settlementPopulation(p)).slice(0, 4),
        pair = chooseRoadPair(largest, "rail", RAIL_LINK_REACH);
      if (pair) link = startRoadLink(faction, pair[0], pair[1], "rail");
    }
    if (link) out.rail = paveLink(link);
  }
  return out;
}
function updateRoads() {
  if (W.tick % ROAD_PASS_CADENCE !== ROAD_PASS_OFFSET) return;
  ensureRoads();
  for (const f of W.factions) if (f.stability > 0) roadPassFor(f);
}
// ── Wheels ────────────────────────────────────────────────────────────────────
const vehicleCache = { world: null, tick: -1, byFaction: new Map() };
function vehicleFor(id) {
  const fid = W.components.social?.[id]?.factionId;
  if (!fid) return null;
  if (vehicleCache.world !== W || vehicleCache.tick !== W.tick) {
    vehicleCache.world = W;
    vehicleCache.tick = W.tick;
    vehicleCache.byFaction.clear();
  }
  let v = vehicleCache.byFaction.get(fid);
  if (v === undefined) {
    v = factionHasTech(fid, "combustion") ? "motor" : factionHasTech(fid, "wheel") ? "cart" : null;
    vehicleCache.byFaction.set(fid, v);
  }
  return v;
}
// After the ordinary tick has moved everyone, vehicles on a road roll on along
// the road itself, greedily toward the order's goal: a cart one more tile, a
// truck two, a train three. The road, not the walker's cached corridor, is
// followed, so a traveller who has found the road keeps to it.
function roadStepToward(id, x, y, gx, gy, avoid) {
  const here = Math.max(Math.abs(x - gx), Math.abs(y - gy));
  let best = null,
    bestD = here;
  for (const [dx, dy] of DIRS.slice(0, 8)) {
    const nx = x + dx,
      ny = y + dy;
    if (!inside(nx, ny)) continue;
    const tile = idx(nx, ny);
    if (tile === avoid || !roadLevel(tile) || W.tiles.fire[tile] >= 400) continue;
    if (typeof movementTileBlocked === "function" && movementTileBlocked(id, nx, ny)) continue;
    const d = Math.max(Math.abs(nx - gx), Math.abs(ny - gy));
    if (d < bestD || (d === bestD && best && tile < best)) {
      bestD = d;
      best = tile;
    }
  }
  return best;
}
// Which laid road a tile belongs to, and where along it; indexed once per path.
const roadPathIndexes = new WeakMap();
function roadPathIndex(link) {
  let index = roadPathIndexes.get(link.path);
  if (!index) {
    index = new Map();
    link.path.forEach((tile, i) => index.set(tile, i));
    roadPathIndexes.set(link.path, index);
  }
  return index;
}
function roadLinkAt(tile) {
  for (const link of W.roads?.links || []) {
    if (!link.paved) continue;
    const i = roadPathIndex(link).get(tile);
    if (i !== undefined) return { link, i };
  }
  return null;
}
// Along the road toward whichever end lies nearer the goal; off any known
// road, greedily to a neighbouring road tile that closes the distance.
function roadAdvance(id, order, x, y, steps) {
  const found = roadLinkAt(idx(x, y));
  if (!found) {
    let nx = x,
      ny = y,
      avoid = idx(x, y);
    for (let k = 0; k < steps; k++) {
      const next = roadStepToward(id, nx, ny, order.x, order.y, avoid);
      if (next === null) break;
      avoid = idx(nx, ny);
      [nx, ny] = xy(next);
    }
    return [nx, ny];
  }
  const path = found.link.path,
    n = path.length,
    [ax, ay] = xy(path[0]),
    [bx, by] = xy(path[n - 1]),
    toA = Math.max(Math.abs(ax - order.x), Math.abs(ay - order.y)),
    toB = Math.max(Math.abs(bx - order.x), Math.abs(by - order.y)),
    sign = toB <= toA ? 1 : -1;
  let at = found.i;
  for (let k = 0; k < steps; k++) {
    const j = at + sign;
    if (j < 0 || j >= n) break;
    const tile = path[j],
      [qx, qy] = xy(tile);
    if (!roadLevel(tile) || W.tiles.fire[tile] >= 400) break;
    if (typeof movementTileBlocked === "function" && movementTileBlocked(id, qx, qy)) break;
    at = j;
  }
  return xy(path[at]);
}
function driveCivilOrders() {
  if (!W.tiles?.road) return;
  let moved = false;
  for (const order of W.civilOrders || []) {
    if (order.sea || !VEHICLE_ORDERS.has(order.kind)) continue;
    const id = order.id,
      p = W.components.position[id];
    if (!p || !classifyAlive(id) || W.components.life[id]?.insideBuildingId) continue;
    const level = roadLevel(idx(p.x, p.y));
    if (!level) continue;
    const vehicle = vehicleFor(id);
    if (!vehicle) continue;
    if (Math.max(Math.abs(p.x - order.x), Math.abs(p.y - order.y)) <= 1) continue;
    const steps = level === ROAD_RAIL ? RAIL_STEPS : vehicle === "motor" ? MOTOR_STEPS : CART_STEPS;
    const [nx, ny] = roadAdvance(id, order, p.x, p.y, steps);
    if (nx === p.x && ny === p.y) continue;
    p.x = nx;
    p.y = ny;
    p.regionId = regionId(nx, ny);
    const life = W.components.life[id];
    if (life) life.lastEmbodiedMoveTick = W.tick;
    if (W.tiles.traffic) {
      const t = idx(nx, ny);
      W.tiles.traffic[t] = Math.min(65535, W.tiles.traffic[t] + 24);
    }
    order.vehicle = vehicle;
    moved = true;
  }
  if (moved) rebuildSpatialBins();
}
const simTickRoadsBase = simTick;
simTick = function () {
  simTickRoadsBase();
  if (W?.settlements) {
    updateRoads();
    if (W.civilOrders?.length) driveCivilOrders();
  }
};
// Carts carry more than backs: barter widens between polities that both roll.
const bestBarterRoadsBase = bestBarter;
bestBarter = function (a, b) {
  const offer = bestBarterRoadsBase(a, b);
  if (!offer) return offer;
  if (factionHasTech(a.factionId, "wheel") && factionHasTech(b.factionId, "wheel")) {
    offer.amountA = Math.round(offer.amountA * 1.25);
    offer.amountB = Math.round(offer.amountB * 1.25);
    offer.carted = true;
  }
  return offer;
};
// ── Chronicle and pages ───────────────────────────────────────────────────────
const eventSentenceRoadsBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "RoadEvent") return `A paved road now joins ${d.a} and ${d.b}, ${d.tiles} tiles of graded stone.`;
  if (e.type === "RailEvent") return `Iron rails now run between ${d.a} and ${d.b}, ${d.tiles} tiles of track.`;
  return eventSentenceRoadsBase(e);
};
const alertWorthyRoadsBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyRoadsBase(a) || a.type === "RoadEvent" || a.type === "RailEvent";
};
function roadSummaryFor(filter) {
  const links = (W.roads?.links || []).filter((l) => l.complete && filter(l)),
    name = (id) => W.settlements.find((s) => s.id === id)?.name || "a lost town";
  return links.map((l) => `${name(l.a)} – ${name(l.b)}${l.kind === "rail" ? " (rail)" : ""}`);
}
const renderFactionPageRoadsBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageRoadsBase(id);
  const roads = roadSummaryFor((l) => l.factionId === id);
  if (!roads.length) return html;
  const row = `<div class="kv"><span>Roads</span><b>${roads.map(esc).join(", ")}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
const renderPlacePageRoadsBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageRoadsBase(id);
  const roads = roadSummaryFor((l) => l.a === id || l.b === id);
  if (!roads.length) return html;
  const row = `<div class="kv"><span>Roads</span><b>${roads.map(esc).join(", ")}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
// ── Rendering: stone bands, rails, carts, trucks, trains ─────────────────────
const drawWornPathRoadsBase = drawWornPath;
drawWornPath = function (x, y, i, p, m, v) {
  const level = W.tiles.road?.[i] || 0;
  if (!level) return drawWornPathRoadsBase(x, y, i, p, m, v);
  const rail = level === ROAD_RAIL,
    zoom = UI.camera.zoom,
    width = Math.max(1.2, m.tw * (rail ? 0.16 : 0.3));
  ctx.lineCap = "round";
  const segments = [];
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
  ]) {
    const nx = x + dx,
      ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W.width || ny >= W.height) continue;
    const j = ny * W.width + nx;
    if (!W.tiles.road[j]) continue;
    segments.push(proceduralProjectTile(nx + 0.5, ny + 0.5, m));
  }
  const strokePaths = (style, w) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.beginPath();
    if (segments.length)
      for (const q of segments) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
    else {
      ctx.moveTo(p.x - m.tw * 0.3, p.y);
      ctx.lineTo(p.x + m.tw * 0.3, p.y);
    }
    ctx.stroke();
  };
  if (rail) {
    strokePaths(hsl(30, 12, 22, 0.9), width);
    if (zoom > 2 && segments.length) {
      // Ties across the track.
      ctx.strokeStyle = hsl(28, 30, 32, 0.9);
      ctx.lineWidth = Math.max(1, m.tw * 0.06);
      ctx.beginPath();
      for (const q of segments) {
        const ax = q.x - p.x,
          ay = q.y - p.y,
          len = Math.hypot(ax, ay) || 1,
          tx = (-ay / len) * m.tw * 0.14,
          ty = (ax / len) * m.tw * 0.14;
        for (const f of [0.25, 0.5, 0.75]) {
          const cx = p.x + ax * f,
            cy = p.y + ay * f;
          ctx.moveTo(cx - tx, cy - ty);
          ctx.lineTo(cx + tx, cy + ty);
        }
      }
      ctx.stroke();
    }
  } else {
    strokePaths(hsl(36, 14, 34, 0.85), width * 1.35);
    strokePaths(hsl(40, 18, 66, 0.92), width);
  }
};
function roadFactionHue(f) {
  if (!f) return 30;
  if (Number.isFinite(f.hue)) return f.hue;
  if (Number.isFinite(f.colorHue)) return f.colorHue;
  return ((f.id || 0) * 47 + 20) % 360;
}
function drawVehicle(s, r, kind, hue, now, still, facing) {
  const dir = facing >= 0 ? 1 : -1,
    bodyW = r * (kind === "motor" ? 1.7 : 1.3),
    bodyH = r * (kind === "motor" ? 0.62 : 0.5),
    baseY = s.y + r * 0.55,
    wheelR = Math.max(1.4, r * 0.26),
    spin = still ? 0 : now * 0.012;
  ctx.save();
  ctx.translate(s.x, baseY);
  ctx.scale(dir, 1);
  // Body.
  ctx.fillStyle = hsl(hue, 45, 42);
  ctx.strokeStyle = hsl(hue, 40, 18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(-bodyW / 2, -bodyH, bodyW, bodyH);
  ctx.fill();
  ctx.stroke();
  if (kind === "motor") {
    // Cab and a window.
    ctx.fillStyle = hsl(hue, 30, 30);
    ctx.fillRect(bodyW * 0.15, -bodyH * 1.75, bodyW * 0.32, bodyH * 0.8);
    ctx.fillStyle = hsl(200, 40, 80, 0.9);
    ctx.fillRect(bodyW * 0.2, -bodyH * 1.65, bodyW * 0.2, bodyH * 0.4);
  } else {
    // A cart's load.
    ctx.fillStyle = hsl(hue + 30, 40, 62);
    ctx.beginPath();
    ctx.ellipse(0, -bodyH * 1.05, bodyW * 0.36, bodyH * 0.45, 0, Math.PI, 0);
    ctx.fill();
  }
  // Wheels with turning spokes.
  for (const wx of [-bodyW * 0.32, bodyW * 0.32]) {
    ctx.fillStyle = "#2b2622";
    ctx.beginPath();
    ctx.arc(wx, 0, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d9cdb4";
    ctx.lineWidth = Math.max(0.8, wheelR * 0.18);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = spin + (k * Math.PI) / 4;
      ctx.moveTo(wx - Math.cos(a) * wheelR * 0.85, -Math.sin(a) * wheelR * 0.85);
      ctx.lineTo(wx + Math.cos(a) * wheelR * 0.85, Math.sin(a) * wheelR * 0.85);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function drawTrain(link, now, m, bounds, still) {
  const path = link.path,
    n = path.length;
  if (n < 4) return;
  const t = still ? 0.5 : ((now * 0.00003 + link.id * 0.37) % 1 + 1) % 1,
    head = Math.max(2, Math.floor(t * (n - 1)));
  const [hx, hy] = xy(path[head]);
  if (hx < bounds.x0 - 2 || hx > bounds.x1 + 2 || hy < bounds.y0 - 2 || hy > bounds.y1 + 2) return;
  const faction = W.factions.find((f) => f.id === link.factionId),
    hue = roadFactionHue(faction),
    r = clamp(m.tw * 0.28, 2, 40);
  for (let k = 0; k < 3; k++) {
    const at = head - k;
    if (at < 0) break;
    const [px, py] = xy(path[at]),
      s = proceduralProjectTile(px + 0.5, py + 0.5, m),
      isEngine = k === 0;
    ctx.fillStyle = isEngine ? hsl(hue, 40, 34) : hsl(hue, 30, 48);
    ctx.strokeStyle = "#1e1a17";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(s.x - r * 0.75, s.y - r * (isEngine ? 0.95 : 0.7), r * 1.5, r * (isEngine ? 0.75 : 0.5));
    ctx.fill();
    ctx.stroke();
    if (isEngine) {
      ctx.fillStyle = "#3a3330";
      ctx.fillRect(s.x + r * 0.25, s.y - r * 1.35, r * 0.25, r * 0.45);
      if (!still && UI.quality === "high") {
        ctx.fillStyle = hsl(0, 0, 85, 0.35);
        for (let q = 0; q < 3; q++) {
          const life = ((now * 0.002 + q * 0.33 + link.id) % 1 + 1) % 1;
          ctx.beginPath();
          ctx.arc(s.x + r * 0.37 + life * r * 0.6, s.y - r * 1.4 - life * r * 0.9, r * (0.12 + life * 0.22), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}
const drawWorkerActivityRoadsBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivityRoadsBase(now, bounds);
  if (UI.quality === "low" || !W.roads) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    still = ACTIVE_REDUCED_MOTION,
    zoom = UI.camera.zoom;
  if (zoom >= 1.2) {
    for (const order of W.civilOrders || []) {
      if (order.sea || !VEHICLE_ORDERS.has(order.kind)) continue;
      const p = W.components.position[order.id];
      if (!p || p.x < bounds.x0 - 1 || p.x > bounds.x1 + 1 || p.y < bounds.y0 - 1 || p.y > bounds.y1 + 1) continue;
      if (W.components.life[order.id]?.insideBuildingId) continue;
      const kind = vehicleFor(order.id);
      if (!kind) continue;
      const s = visualAnchor(order.id, p, m, now).s,
        r = clamp(m.tw * 0.3, 3, 40),
        faction = W.factions.find((f) => f.id === W.components.social[order.id]?.factionId);
      drawVehicle(s, r, kind, roadFactionHue(faction), now, still, order.x - p.x);
    }
  }
  if (zoom >= 0.9) {
    let drawn = 0;
    for (const link of W.roads.links) {
      if (!link.complete || link.kind !== "rail") continue;
      drawTrain(link, now, m, bounds, still);
      if (++drawn >= 6) break;
    }
  }
};
window.ALIFE_ROADS_DEBUG = Object.freeze({
  tiles: () => {
    ensureRoads();
    let paved = 0,
      rail = 0;
    for (const v of W.tiles.road) {
      if (v === ROAD_PAVED) paved++;
      else if (v === ROAD_RAIL) rail++;
    }
    return { paved, rail };
  },
  links: () => {
    ensureRoads();
    return W.roads.links.map((l) => ({ ...l, path: l.path.length }));
  },
  pave: (factionId, only = null) => {
    ensureRoads();
    const f = W.factions.find((x) => x.id === factionId);
    return f ? roadPassFor(f, true, only) : null;
  },
  level: (x, y) => roadLevel(idx(x, y)),
  matter: () => {
    ensureRoads();
    let n = 0;
    for (const v of W.roads.matter) n += v;
    return n;
  },
  vehicle: (id) => vehicleFor(id),
  // The vehicle cache is per tick; a debug run that grants crafts mid-tick resets it.
  forget: () => {
    vehicleCache.tick = -1;
  },
  drive: () => driveCivilOrders(),
  trace: (id) => {
    const order = (W.civilOrders || []).find((o) => o.id === id),
      p = W.components.position[id];
    if (!order || !p) return { order: !!order, position: !!p };
    const here = idx(p.x, p.y);
    return {
      kind: order.kind,
      sea: !!order.sea,
      alive: classifyAlive(id),
      inside: W.components.life[id]?.insideBuildingId || 0,
      level: roadLevel(here),
      vehicle: vehicleFor(id),
      goal: [order.x, order.y],
      near: Math.max(Math.abs(p.x - order.x), Math.abs(p.y - order.y)),
      step: roadAdvance(id, order, p.x, p.y, 1),
      onLink: !!roadLinkAt(here),
      link: (() => {
        const f = roadLinkAt(here);
        if (!f) return null;
        const n = f.link.path.length,
          [ax, ay] = xy(f.link.path[0]),
          [bx, by] = xy(f.link.path[n - 1]),
          toA = Math.max(Math.abs(ax - order.x), Math.abs(ay - order.y)),
          toB = Math.max(Math.abs(bx - order.x), Math.abs(by - order.y)),
          sign = toB <= toA ? 1 : -1,
          j = f.i + sign,
          next = f.link.path[j];
        return { i: f.i, n, sign, toA, toB, nextLevel: next === undefined ? null : roadLevel(next), nextFire: next === undefined ? null : W.tiles.fire[next], nextBlocked: next === undefined ? null : movementTileBlocked(id, ...xy(next)), nextLiquid: next === undefined ? null : W.tiles.liquid[next] };
      })(),
      neighbours: DIRS.slice(0, 8).map(([dx, dy]) => (inside(p.x + dx, p.y + dy) ? roadLevel(idx(p.x + dx, p.y + dy)) : -1)),
    };
  },
  steps: { cart: CART_STEPS, motor: MOTOR_STEPS, rail: RAIL_STEPS },
});
