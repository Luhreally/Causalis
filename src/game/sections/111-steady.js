// ═══════════════════════════════════════════════════════════════════════════
// 111. STEADY FEET AND USEFUL CARS — walkers that do not jitter, and trucks that carry
// ═══════════════════════════════════════════════════════════════════════════
// Walkers jittered: a heading turned all the way round in a tenth of a second,
// so a person weighing two directions flipped left and right every few frames;
// a crowd on one tile was spread by rank, so when anyone stepped on or off,
// everyone else jumped to a new place; and the walk pose flickered on and off
// at the speed threshold. Now the crowd offset eases toward its place, a
// heading turns at half the rate, a figure faces the other way only after it
// has meant to for a quarter of a second, and a walker keeps walking until it
// has clearly stopped. Cars were a box under a traveller with no work to do.
// Now a motor polity's caravans carry more, its trucks run freight along its
// paved roads every year (a share of each town's surplus to the other town,
// burning fuel by the world's own combustion; no fuel, no trucks), motor cars
// and trucks are drawn as cars and trucks (hood, cabin, glass, rims, lights at
// night; a tarped box on a truck), and a motor town keeps a few cars parked by
// its hall and market. Rendering only reads.
const STEADY_OFFSET_RATE = 0.006,
  STEADY_TURN_SHARE = 0.45,
  STEADY_FLIP_MS = 240,
  STEADY_MOVE_ON = 0.7,
  STEADY_MOVE_OFF = 0.3,
  ROAD_FREIGHT_TICK = 136,
  ROAD_FREIGHT_TRANSFERS = 2,
  ROAD_FREIGHT_FACTOR = 1.5,
  ROAD_FREIGHT_FUEL = 2,
  ENGINE_TEMPERATURE = 600,
  MOTOR_BARTER = 1.3,
  TRUCK_ORDERS = new Set(["caravan", "relief", "colonists", "settle", "migrate", "prospect"]),
  STEADY = { flips: 0, cars: 0, trucks: 0, parked: 0 };
let STEADY_MOTION = new Map(),
  STEADY_OFFSETS = new Map(),
  STEADY_WORLD = null,
  ACTIVE_VEHICLE_ID = 0;
function steadyReset() {
  if (STEADY_WORLD !== W) {
    STEADY_MOTION = new Map();
    STEADY_OFFSETS = new Map();
    STEADY_WORLD = W;
  }
}
// ── The crowd offset eases to its place ──────────────────────────────────────
const creatureSpreadOffsetSteadyBase = creatureSpreadOffset;
creatureSpreadOffset = function (id, p) {
  steadyReset();
  const target = creatureSpreadOffsetSteadyBase(id, p),
    now = typeof ACTIVE_RENDER_NOW === "number" ? ACTIVE_RENDER_NOW : 0;
  let o = STEADY_OFFSETS.get(id);
  if (!o) {
    o = { x: target.x, y: target.y, last: now };
    STEADY_OFFSETS.set(id, o);
    return { x: o.x, y: o.y, k: target.k };
  }
  const dt = clamp(now - o.last, 0, 240);
  if (dt > 0) {
    const f = 1 - Math.exp(-dt * STEADY_OFFSET_RATE);
    o.x += (target.x - o.x) * f;
    o.y += (target.y - o.y) * f;
    o.last = now;
  }
  return { x: o.x, y: o.y, k: target.k };
};
// ── Headings turn slowly, faces hold, walking holds ──────────────────────────
function steadyFacingWanted(screenHeading) {
  return Math.cos(screenHeading) < -0.25 ? -1 : 1;
}
const visualAnchorSteadyBase = visualAnchor;
visualAnchor = function (id, p, m, now) {
  const e = visualAnchorSteadyBase(id, p, m, now);
  if (!e || !e.s) return e;
  steadyReset();
  const live = VISUAL_MOTION.get(id) || e;
  let st = STEADY_MOTION.get(id);
  if (!st) {
    st = { heading: live.heading, facing: steadyFacingWanted(e.screenHeading), since: now, moving: e.moving, frame: -1 };
    STEADY_MOTION.set(id, st);
  }
  if (st.frame !== now) {
    st.frame = now;
    // Half the turn the base took this frame.
    const turn = ((live.heading - st.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    st.heading += turn * STEADY_TURN_SHARE;
    live.heading = st.heading;
    const dir = worldDirToScreen(Math.cos(st.heading), Math.sin(st.heading), m);
    live.screenHeading = Math.atan2(dir.y, dir.x);
    // A face turns only after it has meant to for a while.
    const want = steadyFacingWanted(live.screenHeading);
    if (want !== st.facing) {
      if (now - st.since >= STEADY_FLIP_MS) {
        st.facing = want;
        st.since = now;
        STEADY.flips++;
      }
    } else st.since = now;
    // Walking holds until the walker has clearly stopped, and starts only when it clearly moves.
    st.moving = st.moving ? live.speed > STEADY_MOVE_OFF : live.speed > STEADY_MOVE_ON;
    live.moving = st.moving;
  }
  const facing = st.facing,
    shown = steadyFacingWanted(live.screenHeading),
    screenHeading = shown === facing ? live.screenHeading : Math.PI - live.screenHeading;
  if (e === live) {
    e.screenHeading = screenHeading;
    return e;
  }
  return { ...e, heading: live.heading, screenHeading, moving: live.moving };
};
// ── Trucks carry: motor caravans, road freight for fuel ──────────────────────
const bestBarterSteadyBase = bestBarter;
bestBarter = function (a, b) {
  const offer = bestBarterSteadyBase(a, b);
  if (!offer) return offer;
  if (factionHasTech(a.factionId, "combustion") && factionHasTech(b.factionId, "combustion")) {
    offer.amountA = Math.round(offer.amountA * MOTOR_BARTER);
    offer.amountB = Math.round(offer.amountB * MOTOR_BARTER);
    offer.motored = true;
  }
  return offer;
};
function completePavedLinks() {
  return (W.roads?.links || []).filter((l) => l.complete && l.kind !== "rail");
}
// An engine burns the town's fuel at engine heat, drawing its oxidant from the
// air over the town tile, by the world's own combustion; ash and gas stay in
// the town's store, so nothing is created or lost.
function truckEngine(place) {
  const inv = invSettlement(place),
    tile = idx(place.x, place.y);
  return {
    ...inv,
    temperature: () => Math.max(inv.temperature(), ENGINE_TEMPERATURE),
    get: (i) => (i === C.OXIDANT ? tileMatterAmount(tile, C.OXIDANT) : inv.get(i)),
    set: (i, v) => (i === C.OXIDANT ? setTileMatterAmount(tile, C.OXIDANT, v) : inv.set(i, v)),
  };
}
// A single packet of combustion is a fractional extent that the executor rolls
// deterministically per tick and context, so an engine tries a few contexts
// before it gives up; each success burns one packet, two measures of fuel.
function burnTruckFuel(place, loads) {
  if ((place.inventory[C.FUEL] || 0) < ROAD_FREIGHT_FUEL * loads) return false;
  const engine = truckEngine(place),
    tile = idx(place.x, place.y);
  let burned = 0;
  for (let n = 0; n < loads; n++) {
    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++)
      ok = executeProcess("combustion", engine, 1, { location: tile, subjects: [place.entityId * 7 + attempt] }) > 0;
    if (!ok) break;
    burned++;
  }
  return burned >= loads;
}
function roadFreight() {
  if (!W.roads) return 0;
  if (typeof initializeImplicitSociety === "function") initializeImplicitSociety(W);
  let moved = 0;
  for (const link of completePavedLinks()) {
    const a = W.settlements.find((s) => s.id === link.a),
      b = W.settlements.find((s) => s.id === link.b);
    if (!a || !b || a.ruined || b.ruined || !a.factionId || a.factionId !== b.factionId) continue;
    if (!factionHasTech(a.factionId, "combustion")) continue;
    let tonnage = 0,
      loads = 0;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      if ((from.inventory[C.FUEL] || 0) < ROAD_FREIGHT_FUEL) continue;
      for (let n = 0; n < ROAD_FREIGHT_TRANSFERS; n++) {
        const offer = bestInternalTransfer(from, to);
        if (!offer) break;
        if (!burnTruckFuel(from, 1)) break;
        const amount = transferSettlementMatter(from, to, offer.sp, Math.min(offer.amount * ROAD_FREIGHT_FACTOR, materialSurplus(from, offer.sp)));
        if (!amount) break;
        recordExchange(from, to, "road", offer.sp, amount);
        tonnage += amount;
        loads++;
      }
    }
    if (tonnage) {
      link.trucked = (link.trucked || 0) + tonnage;
      moved += tonnage;
      if (!link.truckEventId) {
        const faction = W.factions.find((f) => f.id === link.factionId);
        link.truckEventId = emitEvent("RoadFreightEvent", {
          subjects: [a.entityId, b.entityId],
          location: idx(a.x, a.y),
          factions: faction ? [faction.id] : [],
          causes: [link.completedEventId || 0].filter(Boolean),
          evidence: [`${tonnage} measures carried by truck in ${loads} load${loads === 1 ? "" : "s"}`, `${a.name} and ${b.name}`, "fuel burned for every load"],
          importance: 3,
          data: { a: a.name, b: b.name, polity: faction?.name || "", tonnage },
        }).id;
      }
    }
  }
  return moved;
}
const simTickSteadyBase = simTick;
simTick = function () {
  simTickSteadyBase();
  if (W?.roads && W.tick % 256 === ROAD_FREIGHT_TICK) roadFreight();
};
// ── Cars drawn as cars, trucks as trucks, and a few parked by the hall ───────
const vehicleForSteadyBase = vehicleFor;
vehicleFor = function (id) {
  ACTIVE_VEHICLE_ID = id;
  return vehicleForSteadyBase(id);
};
function motorKindFor(id) {
  const order = typeof civilOrderOf === "function" ? civilOrderOf(id) : null;
  return order && TRUCK_ORDERS.has(order.kind) ? "truck" : "car";
}
function drawMotorCar(g, r, hue, now, still, truck, lit) {
  const L = r * (truck ? 2.1 : 1.8),
    bodyH = r * 0.5,
    wheelR = Math.max(1.6, r * 0.27),
    spin = still ? 0 : now * 0.014,
    bounce = still ? 0 : Math.sin(now * 0.02) * r * 0.02,
    body = hsl(hue, 52, 46),
    dark = hsl(hue, 45, 26),
    light = hsl(hue, 50, 62),
    glass = hsl(205, 50, lit ? 32 : 74, 0.92);
  g.save();
  g.translate(0, bounce);
  // Shadow.
  g.fillStyle = "rgba(6,6,10,0.35)";
  g.beginPath();
  g.ellipse(0, wheelR * 0.9, L * 0.55, wheelR * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  if (truck) {
    // Cargo box under a tarp, then the cab in front.
    g.fillStyle = dark;
    g.fillRect(-L * 0.5, -bodyH * 1.9, L * 0.62, bodyH * 1.9);
    g.fillStyle = hsl(hue + 25, 30, 58);
    g.beginPath();
    g.moveTo(-L * 0.5, -bodyH * 1.9);
    g.quadraticCurveTo(-L * 0.19, -bodyH * 2.35, L * 0.12, -bodyH * 1.9);
    g.closePath();
    g.fill();
    g.fillStyle = body;
    g.fillRect(L * 0.12, -bodyH * 1.55, L * 0.36, bodyH * 1.55);
    g.fillStyle = glass;
    g.fillRect(L * 0.17, -bodyH * 1.45, L * 0.2, bodyH * 0.55);
    g.fillStyle = light;
    g.fillRect(L * 0.12, -bodyH * 0.55, L * 0.38, bodyH * 0.55);
  } else {
    // Lower body, rounded hood, cabin with two windows, roof.
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-L * 0.5, 0);
    g.lineTo(-L * 0.5, -bodyH * 0.9);
    g.lineTo(-L * 0.42, -bodyH);
    g.lineTo(L * 0.3, -bodyH);
    g.quadraticCurveTo(L * 0.5, -bodyH * 0.95, L * 0.5, -bodyH * 0.45);
    g.lineTo(L * 0.5, 0);
    g.closePath();
    g.fill();
    g.fillStyle = light;
    g.beginPath();
    g.moveTo(-L * 0.36, -bodyH);
    g.lineTo(-L * 0.28, -bodyH * 1.75);
    g.lineTo(L * 0.14, -bodyH * 1.75);
    g.lineTo(L * 0.28, -bodyH);
    g.closePath();
    g.fill();
    g.fillStyle = glass;
    g.beginPath();
    g.moveTo(-L * 0.3, -bodyH * 1.05);
    g.lineTo(-L * 0.24, -bodyH * 1.62);
    g.lineTo(-L * 0.08, -bodyH * 1.62);
    g.lineTo(-L * 0.08, -bodyH * 1.05);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-L * 0.02, -bodyH * 1.05);
    g.lineTo(-L * 0.02, -bodyH * 1.62);
    g.lineTo(L * 0.11, -bodyH * 1.62);
    g.lineTo(L * 0.24, -bodyH * 1.05);
    g.closePath();
    g.fill();
    g.fillStyle = dark;
    g.fillRect(-L * 0.5, -bodyH * 0.45, L, bodyH * 0.08);
  }
  // Lights: a headlamp forward, a tail lamp aft; they glow at night.
  g.fillStyle = lit ? "#fff1b0" : "#e8e2c8";
  g.fillRect(L * 0.44, -bodyH * 0.8, L * 0.06, bodyH * 0.25);
  g.fillStyle = lit ? "#ff5a4a" : "#b03a30";
  g.fillRect(-L * 0.5, -bodyH * 0.8, L * 0.05, bodyH * 0.22);
  if (lit) {
    g.globalCompositeOperation = "lighter";
    const beam = g.createRadialGradient(L * 0.5, -bodyH * 0.7, 0, L * 0.5, -bodyH * 0.7, r * 1.6);
    beam.addColorStop(0, "rgba(255,240,180,0.35)");
    beam.addColorStop(1, "rgba(255,240,180,0)");
    g.fillStyle = beam;
    g.beginPath();
    g.arc(L * 0.5, -bodyH * 0.7, r * 1.6, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  }
  // Wheels: tyre, rim, hub, and turning spokes.
  for (const wx of truck ? [-L * 0.3, -L * 0.1, L * 0.3] : [-L * 0.28, L * 0.28]) {
    g.fillStyle = "#1e1b1a";
    g.beginPath();
    g.arc(wx, 0, wheelR, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#cfc9bd";
    g.beginPath();
    g.arc(wx, 0, wheelR * 0.55, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#7a746c";
    g.lineWidth = Math.max(0.6, wheelR * 0.12);
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = spin + (k * Math.PI) / 3;
      g.moveTo(wx - Math.cos(a) * wheelR * 0.5, -Math.sin(a) * wheelR * 0.5);
      g.lineTo(wx + Math.cos(a) * wheelR * 0.5, Math.sin(a) * wheelR * 0.5);
    }
    g.stroke();
    g.fillStyle = "#3a3633";
    g.beginPath();
    g.arc(wx, 0, wheelR * 0.16, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
const drawVehicleSteadyBase = drawVehicle;
drawVehicle = function (s, r, kind, hue, now, still, facing) {
  if (kind !== "motor") return drawVehicleSteadyBase(s, r, kind, hue, now, still, facing);
  const truck = motorKindFor(ACTIVE_VEHICLE_ID) === "truck",
    lit = typeof nightStrength === "function" && nightStrength() > 0.3;
  ctx.save();
  ctx.translate(s.x, s.y + r * 0.55);
  ctx.scale(facing >= 0 ? 1 : -1, 1);
  drawMotorCar(ctx, r, hue, now, still, truck, lit);
  ctx.restore();
  if (truck) STEADY.trucks++;
  else STEADY.cars++;
};
// A motor town keeps a few cars parked by its hall and market.
function parkedCarsOf(place) {
  const spots = [];
  for (const type of ["hall", "market", "office"])
    for (const b of completedBuildings(place, type)) {
      const n = 1 + (visualHash01(b.id, 0x7a11) < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const side = visualHash01(b.id * 7 + k, 0x2c9) < 0.5 ? -1 : 1;
        spots.push({ x: b.x + 0.5 + side * 0.85, y: b.y + 1.15 + k * 0.32, hue: visualHash01(b.id * 13 + k, 0x51) * 360, facing: side });
      }
      if (spots.length >= 4) return spots;
    }
  return spots;
}
// A sketch sheet for the eye: cars and trucks at a large size, by day and night.
function drawCarSketch(now) {
  const r = 34;
  let x = 120;
  for (const [truck, lit] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]) {
    ctx.save();
    ctx.fillStyle = lit ? "#0b1020" : "#b9c8a0";
    ctx.fillRect(x - r * 1.6, 130 - r * 2.2, r * 3.2, r * 3.1);
    ctx.translate(x, 130);
    drawMotorCar(ctx, r, 208 + (truck ? 60 : 0), now, false, truck, lit);
    ctx.restore();
    x += r * 3.6;
  }
}
const drawWorkerActivitySteadyBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivitySteadyBase(now, bounds);
  if (typeof window !== "undefined" && window.__SKETCH_CARS) drawCarSketch(now);
  if (UI.quality === "low" || UI.camera.zoom < 1.4) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    still = ACTIVE_REDUCED_MOTION,
    lit = typeof nightStrength === "function" && nightStrength() > 0.3,
    r = clamp(m.tw * 0.26, 3, 34);
  for (const place of W.settlements) {
    if (place.ruined || !place.factionId || !factionHasTech(place.factionId, "combustion")) continue;
    if (place.x < bounds.x0 - 4 || place.x > bounds.x1 + 4 || place.y < bounds.y0 - 4 || place.y > bounds.y1 + 4) continue;
    for (const spot of parkedCarsOf(place)) {
      const s = proceduralProjectTile(spot.x, spot.y, m);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(spot.facing, 1);
      drawMotorCar(ctx, r, spot.hue, now, true, false, lit);
      ctx.restore();
      STEADY.parked++;
    }
  }
};
// ── Chronicle ─────────────────────────────────────────────────────────────────
const eventSentenceSteadyBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "RoadFreightEvent") return `Trucks began to run between ${d.a} and ${d.b}${d.polity ? ` of ${d.polity}` : ""}, ${d.tonnage} measures the first year.`;
  return eventSentenceSteadyBase(e);
};
window.ALIFE_STEADY_DEBUG = Object.freeze({
  facing: (id) => STEADY_MOTION.get(id)?.facing ?? 0,
  heading: (id) => STEADY_MOTION.get(id)?.heading ?? null,
  offset: (id) => ({ ...(STEADY_OFFSETS.get(id) || {}) }),
  motorKind: (id) => motorKindFor(id),
  freight: () => roadFreight(),
  parkedSpots: (placeId) => parkedCarsOf(W.settlements.find((s) => s.id === placeId)).length,
  counts: () => ({ ...STEADY }),
  reset: () => {
    STEADY.flips = 0;
    STEADY.cars = 0;
    STEADY.trucks = 0;
    STEADY.parked = 0;
  },
});
