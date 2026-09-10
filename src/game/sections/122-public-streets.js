// 122. PUBLIC STREETS — a shared vehicle carries actual travellers on a built link.
function publicRoutes() { return W.publicTransport?.routes || []; }
function publicTransportPass() {
  W.publicTransport ||= { routes: [], journeys: 0 };
  const transport = W.publicTransport;
  if (W.tick % 256 === 112) {
    for (const link of W.roads?.links || []) {
      if (!link.complete || link.path.length < 3 || transport.routes.some((r) => r.linkId === link.id)) continue;
      const a = W.settlements.find((s) => s.id === link.a && !s.ruined),
        b = W.settlements.find((s) => s.id === link.b && !s.ruined);
      if (!a || !b || !cityStage(a) || !cityStage(b) || !atPeaceForRelief(polityOfPlace(a), polityOfPlace(b))) continue;
      const rail = link.kind === "rail", needed = rail ? "railways" : "combustion";
      if (!knowsTech(a, needed) || (a.inventory[C.METAL] || 0) < 16) continue;
      a.inventory[C.METAL] -= 16;
      W.roads.matter[C.METAL] += 16;
      transport.routes.push({ linkId: link.id, at: 0, direction: 1, wait: 8, passengers: [], trips: 0, kind: rail ? "tram" : "bus" });
    }
  }
  let moved = false;
  for (const route of transport.routes) {
    const link = W.roads?.links.find((l) => l.id === route.linkId),
      a = W.settlements.find((s) => s.id === link?.a && !s.ruined),
      b = W.settlements.find((s) => s.id === link?.b && !s.ruined);
    if (!link?.complete || !a || !b || !atPeaceForRelief(polityOfPlace(a), polityOfPlace(b))) {
      for (const id of route.passengers) if (W.components.life[id]) W.components.life[id].transitLinkId = 0;
      route.passengers = []; route.suspended = true; continue;
    }
    route.suspended = false;
    route.passengers = route.passengers.filter((id) => classifyAlive(id));
    if (W.tick % 4 === 0) {
      if (route.wait > 0) {
        route.wait--;
        const [sx, sy] = xy(link.path[route.at]), destination = route.direction > 0 ? b : a;
        for (const order of W.civilOrders || []) {
          const id = order.id, p = W.components.position[id], life = W.components.life[id];
          if (route.passengers.length >= 8) break;
          if (!p || !life || !classifyAlive(id) || life.insideBuildingId || life.transitLinkId || order.sea ||
            !VEHICLE_ORDERS.has(order.kind) || dist2(p.x, p.y, sx, sy) > 4 ||
            dist2(order.x, order.y, destination.x, destination.y) >= dist2(order.x, order.y, sx, sy)) continue;
          route.passengers.push(id); life.transitLinkId = route.linkId;
        }
      } else {
        const next = clamp(route.at + route.direction, 0, link.path.length - 1), tile = link.path[next];
        if (roadLevel(tile) && W.tiles.fire[tile] < 400) route.at = next;
        else route.wait = 4;
        if (route.at === 0 || route.at === link.path.length - 1) {
          const [x, y] = xy(link.path[route.at]);
          for (const id of route.passengers) {
            const p = W.components.position[id];
            p.x = x; p.y = y; p.regionId = regionId(x, y);
            W.components.life[id].transitLinkId = 0;
          }
          transport.journeys += route.passengers.length;
          route.passengers = []; route.direction *= -1; route.wait = 8; route.trips++;
          moved = true;
        }
      }
    }
    const [x, y] = xy(link.path[route.at]);
    for (const id of route.passengers) {
      const p = W.components.position[id];
      p.x = x; p.y = y; p.regionId = regionId(x, y);
      W.components.life[id].lastEmbodiedMoveTick = W.tick;
      moved = true;
    }
  }
  if (moved) rebuildSpatialBins();
}
const simTickPublicBase = simTick;
simTick = function () { simTickPublicBase(); publicTransportPass(); };
const sceneEntityVisiblePublicBase = sceneEntityVisible;
sceneEntityVisible = function (id, ...args) {
  if (W.components.life[id]?.transitLinkId) return false;
  return sceneEntityVisiblePublicBase(id, ...args);
};
// How hard a street is used, from the tread already written to the tile. A
// pavement the whole town crosses is polished pale and worn wide; a lane the
// carts take is darkened by them. Read at draw time only, so nothing here
// writes the world.
function streetWear(i) {
  return Math.min(1, (W.tiles.traffic?.[i] || 0) / 2600);
}
const drawWornPathPublicBase = drawWornPath;
drawWornPath = function (x, y, i, p, m, v) {
  if (roadLevel(i) !== ROAD_PAVED) return drawWornPathPublicBase(x, y, i, p, m, v);
  const town = nearestSettlement(i, 7), urban = town && cityStage(town), motor = urban && knowsTech(town, "combustion");
  if (!urban) return drawWornPathPublicBase(x, y, i, p, m, v);
  const segments = [];
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
    const nx = x + dx, ny = y + dy;
    if (inside(nx, ny) && roadLevel(idx(nx, ny)) === ROAD_PAVED) segments.push(proceduralProjectTile(nx + 0.5, ny + 0.5, m));
  }
  ctx.save(); ctx.lineCap = "round";
  const stroke = (color, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    for (const q of segments) { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }
    ctx.stroke();
  };
  // Curbs and pedestrian verges share the existing paved tile footprint, and
  // both carry their wear: a busy verge is walked pale and broad, a busy lane
  // is darkened and widened by what runs on it.
  const wear = streetWear(i);
  stroke("#b7afa0", m.tw * (0.46 + wear * 0.05));
  stroke(hsl(40, 22 - wear * 10, 83 + wear * 7), m.tw * (0.41 + wear * 0.05));
  stroke(motor ? hsl(205, 9, 28 - wear * 10) : hsl(35, 11, 47 - wear * 9), m.tw * (0.28 + wear * 0.04));
  if (motor && UI.camera.zoom > 1.5) {
    ctx.setLineDash([Math.max(1, m.tw * 0.13), Math.max(1, m.tw * 0.12)]);
    stroke("#e8d9a2", Math.max(0.65, m.tw * 0.015)); ctx.setLineDash([]);
    if (segments.length >= 3) {
      ctx.strokeStyle = hsl(44, 22, 88 + wear * 6); ctx.lineWidth = Math.max(0.65, m.tw * (0.025 + wear * 0.012));
      for (let n = -2; n <= 2; n++) {
        ctx.beginPath(); ctx.moveTo(p.x + n * m.tw * 0.04, p.y - m.th * 0.1);
        ctx.lineTo(p.x + n * m.tw * 0.04, p.y + m.th * 0.1); ctx.stroke();
      }
    }
  }
  ctx.restore();
};
const drawWorkerActivityPublicBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivityPublicBase(now, bounds);
  const m = ACTIVE_RENDER_METRICS;
  if (!m || UI.camera.zoom < 0.7) return;
  for (const route of publicRoutes()) {
    const link = W.roads?.links.find((l) => l.id === route.linkId);
    if (!link || route.suspended) continue;
    const [x, y] = xy(link.path[route.at]);
    if (x < bounds.x0 - 2 || x > bounds.x1 + 2 || y < bounds.y0 - 2 || y > bounds.y1 + 2) continue;
    const p = proceduralProjectTile(x + 0.5, y + 0.5, m), r = Math.max(2, m.tw * 0.17);
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(route.direction, 1);
    const hue = visualHash01(link.id, 0xb051) * 360;
    ctx.fillStyle = hsl(hue, 40, 48); ctx.fillRect(-r * 1.8, -r * 1.1, r * 3.6, r);
    ctx.fillStyle = "#a9d8df";
    for (let n = 0; n < 5; n++) ctx.fillRect(-r * 1.55 + n * r * 0.62, -r * 0.95, r * 0.45, r * 0.38);
    ctx.fillStyle = "#22272a";
    for (const dx of [-1.1, 1.1]) { ctx.beginPath(); ctx.arc(dx * r, -r * 0.05, r * 0.23, 0, Math.PI * 2); ctx.fill(); }
    if (route.kind === "tram") { ctx.strokeStyle = "#c3c8c9"; ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 0.5, -r * 1.6); ctx.lineTo(0, -r * 1.8); ctx.stroke(); }
    ctx.restore();
    for (const at of [0, link.path.length - 1]) {
      const [sx, sy] = xy(link.path[at]), stop = proceduralProjectTile(sx + 0.65, sy + 0.65, m);
      ctx.fillStyle = "#364957"; ctx.fillRect(stop.x, stop.y - r * 0.9, Math.max(1, r * 0.1), r * 0.9);
      ctx.fillStyle = "#e9d9a6"; ctx.fillRect(stop.x - r * 0.2, stop.y - r * 1.15, r * 0.5, r * 0.4);
    }
  }
};
const renderPlacePagePublicBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePagePublicBase(id), routes = publicRoutes().filter((r) => W.roads?.links.some((l) => l.id === r.linkId && (l.a === id || l.b === id)));
  return html + (routes.length ? `<div class="subhead">Public transport</div>${routes.map((r) => `<div class="kv"><span>${r.kind === "tram" ? "Tram" : "Bus"} · route ${r.linkId}</span><b>${r.suspended ? "service suspended" : `${r.passengers.length}/8 aboard · ${r.trips} trips`}</b></div>`).join("")}` : "");
};
window.ALIFE_PUBLIC_DEBUG = Object.freeze({ routes: () => publicRoutes().map((r) => ({ ...r, passengers: r.passengers.slice() })), update: publicTransportPass });
