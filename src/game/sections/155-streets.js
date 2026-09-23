// ═══════════════════════════════════════════════════════════════════════════
// 155. STREETS — cars owned and driven, streets worn into being, crowds seen
// ═══════════════════════════════════════════════════════════════════════════
// Asked for: better car use, roads and streets, for a small city builder
// that runs itself. There were no cars (88's vehicleFor only told a
// traveller under a civil order how fast to go once on a road), so the daily
// trip to work, which is most trips, was always on foot; a street was paved
// only where two finished buildings flanked it (92), however many feet wore
// the ground elsewhere; the bus of a ferried link stalled for ever at the
// water it could not pave (122), and while anyone rode, the spatial bins were
// rebuilt every tick whether the bus had moved or not.
//
// Now:
//   a household of a town whose polity knows combustion buys a car once a
//   year if it can (twenty-four coin to the treasury under coin, or six of
//   the town's metal where there is no coin, kept with the roads' matter);
//   a worker whose household has a car and whose work is eight tiles off or
//   more drives: after the tick's step, two more tiles along the road toward
//   the work (88's road step), one where the road is crowded, and the town
//   burns a fuel for every eight tiles its people drive (111's engine);
//   a lane or square of the town's plan (92) worn by many feet and wheels (the
//   traffic of 14 and 46) is paved though no two buildings flank it yet, six
//   tiles a town a pass, a mineral each, where the town knows road-building,
//   and only from stone beyond what its unfinished buildings still want and a
//   reserve of twenty-four (a first cut paved on masonry from any stone, so a
//   street could take the stone a home was waiting for);
//   a bus crosses a ferried link's water on the ferry, and the bins are
//   rebuilt only when someone aboard has moved;
//   and the town's crowd (150) is seen: its people walking the paved streets
//   and, where it drives, its cars, drawn from its count and never stored.
const STREETS = { carsBought: 0, drives: 0, tilesDriven: 0, fuelBurned: 0, jams: 0, paved: 0, ferried: 0 };
const CAR_PRICE = 24,
  CAR_METAL = 6,
  CAR_SHARE = 0.6,
  DRIVE_MIN = 8,
  DRIVE_STEPS = 2,
  DRIVE_JAM = 2400,
  DRIVE_FUEL_TILES = 8,
  WORN_TRAFFIC = 1500,
  WORN_PAVE = 6,
  WORN_STONE_RESERVE = 24;
function townDrives(town) {
  return !!town && !town.ruined && !!polityOf(town) && factionHasTech(polityOf(town).id, "combustion");
}
function householdCar(id) {
  const head = W.components.social[id]?.householdId || id;
  return !!W.components.identity[head]?.car;
}
// ── Buying a car ────────────────────────────────────────────────────────────
function buyCars(town) {
  if (!townDrives(town)) return 0;
  const f = polityOf(town),
    coin = polityCoins(f),
    heads = new Set();
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id) || !isAdultPerson(id)) continue;
    const soc = W.components.social[id];
    if (soc?.homePlaceKind !== "settlement" || soc.homePlaceId !== town.id) continue;
    const head = soc.householdId || id;
    if (classifyAlive(head)) heads.add(head);
  }
  const all = [...heads].sort((a, b) => a - b),
    owned = all.filter((h) => W.components.identity[h]?.car).length;
  let bought = 0;
  for (const head of all) {
    if (owned + bought >= Math.floor(all.length * CAR_SHARE)) break;
    const ident = W.components.identity[head];
    if (!ident || ident.car) continue;
    if (coin) {
      if ((ident.civicCoins || 0) < CAR_PRICE) continue;
      ident.civicCoins -= CAR_PRICE;
      f.treasury = (f.treasury || 0) + CAR_PRICE;
    } else {
      if ((town.inventory[C.METAL] || 0) < CAR_METAL) break;
      town.inventory[C.METAL] -= CAR_METAL;
      W.roads.matter[C.METAL] = (W.roads.matter[C.METAL] || 0) + CAR_METAL;
    }
    ident.car = W.tick;
    bought++;
  }
  STREETS.carsBought += bought;
  return bought;
}
// ── Driving to work ─────────────────────────────────────────────────────────
const moveWorkerTowardStreetsBase = moveWorkerToward;
moveWorkerToward = function (id, tile, task, phase, ...rest) {
  const out = moveWorkerTowardStreetsBase(id, tile, task, phase, ...rest),
    life = W.components.life[id],
    p = W.components.position[id];
  if (life && p && tile >= 0 && householdCar(id)) {
    const [tx, ty] = xy(tile);
    if (Math.max(Math.abs(tx - p.x), Math.abs(ty - p.y)) >= DRIVE_MIN && townDrives(homeTownOf(id))) life.drive = { x: tx, y: ty, tick: W.tick };
    else if (life.drive) delete life.drive;
  }
  return out;
};
const DRIVEN = new Map();
function driveToWork() {
  let moved = false;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON) continue;
    const life = W.components.life[id];
    if (!life?.drive || life.drive.tick !== W.tick || life.insideBuildingId || !classifyAlive(id)) continue;
    const p = W.components.position[id];
    if (!p || !roadLevel(idx(p.x, p.y))) continue;
    const town = homeTownOf(id);
    if (!town || (town.inventory[C.FUEL] || 0) < 1) continue;
    const jam = (W.tiles.traffic?.[idx(p.x, p.y)] || 0) > DRIVE_JAM;
    if (jam) STREETS.jams++;
    let steps = jam ? 1 : DRIVE_STEPS,
      prev = -1,
      driven = 0;
    while (steps-- > 0) {
      if (Math.max(Math.abs(p.x - life.drive.x), Math.abs(p.y - life.drive.y)) <= 1) break;
      const next = roadStepToward(id, p.x, p.y, life.drive.x, life.drive.y, prev);
      if (next == null) break;
      prev = idx(p.x, p.y);
      [p.x, p.y] = xy(next);
      if (W.tiles.traffic) W.tiles.traffic[next] = Math.min(65535, W.tiles.traffic[next] + 24);
      driven++;
    }
    if (!driven) continue;
    p.regionId = regionId(p.x, p.y);
    life.lastEmbodiedMoveTick = W.tick;
    life.driving = W.tick;
    moved = true;
    STREETS.drives++;
    STREETS.tilesDriven += driven;
    const tally = (DRIVEN.get(town) || 0) + driven;
    if (tally >= DRIVE_FUEL_TILES && burnTruckFuel(town, 1)) {
      STREETS.fuelBurned++;
      DRIVEN.set(town, tally - DRIVE_FUEL_TILES);
    } else DRIVEN.set(town, Math.min(tally, DRIVE_FUEL_TILES));
  }
  if (moved) rebuildSpatialBins();
}
// ── Streets worn into being ─────────────────────────────────────────────────
// Stone the town's unfinished buildings still want is not for streets.
function spareMineral(town) {
  let wanted = WORN_STONE_RESERVE;
  for (const b of activeBuildings(town))
    for (const [sp, n] of b.requirements || []) if (sp === C.MINERAL) wanted += Math.max(0, n - (b.composition?.[sp] || 0));
  return Math.max(0, (town.inventory[C.MINERAL] || 0) - wanted);
}
function paveWornGround(town) {
  const known = town.knownProcesses || [];
  if (!known.includes("road_building")) return 0;
  let spare = spareMineral(town);
  if (spare < 1) return 0;
  const reach = (typeof townOuterRing === "function" ? townOuterRing(town) : 4) + 2,
    plan = townPlan(town),
    worn = [];
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) {
      const x = town.x + dx,
        y = town.y + dy;
      if (!inside(x, y)) continue;
      const i = idx(x, y);
      if (W.tiles.road[i] || (W.tiles.traffic?.[i] || 0) < WORN_TRAFFIC || W.tiles.liquid[i] > WATER_DEPTH.WADE_LIMIT) continue;
      // Only the town's own lanes and squares (92's plan), which nothing is ever built on.
      if (!isLaneTile(town, plan, x, y) && !isPlazaTile(town, plan, x, y)) continue;
      if (typeof developmentFootprintClear === "function" && !developmentFootprintClear(x, y, 0)) continue;
      worn.push(i);
    }
  worn.sort((a, b) => W.tiles.traffic[b] - W.tiles.traffic[a] || a - b);
  let paved = 0;
  for (const i of worn.slice(0, WORN_PAVE)) {
    if (spare < 1) break;
    spare--;
    town.inventory[C.MINERAL] -= 1;
    W.roads.matter[C.MINERAL] = (W.roads.matter[C.MINERAL] || 0) + 1;
    W.tiles.road[i] = ROAD_PAVED;
    paved++;
  }
  STREETS.paved += paved;
  return paved;
}
// ── The bus: across the ferry, and the bins only when someone has moved ─────
publicTransportPass = function () {
  W.publicTransport ||= { routes: [], journeys: 0 };
  const transport = W.publicTransport;
  if (W.tick % 256 === 112) {
    for (const link of W.roads?.links || []) {
      if (!link.complete || link.path.length < 3 || transport.routes.some((r) => r.linkId === link.id)) continue;
      const a = W.settlements.find((s) => s.id === link.a && !s.ruined),
        b = W.settlements.find((s) => s.id === link.b && !s.ruined);
      if (!a || !b || !cityStage(a) || !cityStage(b) || !atPeaceForRelief(polityOfPlace(a), polityOfPlace(b))) continue;
      const rail = link.kind === "rail",
        needed = rail ? "railways" : "combustion";
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
      route.passengers = [];
      route.suspended = true;
      continue;
    }
    route.suspended = false;
    route.passengers = route.passengers.filter((id) => classifyAlive(id));
    if (W.tick % 4 === 0) {
      if (route.wait > 0) {
        route.wait--;
        const [sx, sy] = xy(link.path[route.at]),
          destination = route.direction > 0 ? b : a;
        for (const order of W.civilOrders || []) {
          const id = order.id,
            p = W.components.position[id],
            life = W.components.life[id];
          if (route.passengers.length >= 8) break;
          if (
            !p ||
            !life ||
            !classifyAlive(id) ||
            life.insideBuildingId ||
            life.transitLinkId ||
            order.sea ||
            !VEHICLE_ORDERS.has(order.kind) ||
            dist2(p.x, p.y, sx, sy) > 4 ||
            dist2(order.x, order.y, destination.x, destination.y) >= dist2(order.x, order.y, sx, sy)
          )
            continue;
          route.passengers.push(id);
          life.transitLinkId = route.linkId;
        }
      } else {
        const next = clamp(route.at + route.direction, 0, link.path.length - 1),
          tile = link.path[next],
          ferry = !!link.ferried && W.tiles.liquid[tile] > WATER_DEPTH.WADE_LIMIT;
        if ((roadLevel(tile) || ferry) && W.tiles.fire[tile] < 400) {
          route.at = next;
          if (ferry) STREETS.ferried++;
        } else route.wait = 4;
        if (route.at === 0 || route.at === link.path.length - 1) {
          const [x, y] = xy(link.path[route.at]);
          for (const id of route.passengers) {
            const p = W.components.position[id];
            p.x = x;
            p.y = y;
            p.regionId = regionId(x, y);
            W.components.life[id].transitLinkId = 0;
          }
          transport.journeys += route.passengers.length;
          route.passengers = [];
          route.direction *= -1;
          route.wait = 8;
          route.trips++;
          moved = true;
        }
      }
    }
    const [x, y] = xy(link.path[route.at]);
    for (const id of route.passengers) {
      const p = W.components.position[id];
      if (p.x !== x || p.y !== y) moved = true;
      p.x = x;
      p.y = y;
      p.regionId = regionId(x, y);
      W.components.life[id].lastEmbodiedMoveTick = W.tick;
    }
  }
  if (moved) rebuildSpatialBins();
};
const simTickStreetsBase = simTick;
simTick = function () {
  simTickStreetsBase();
  if (!W?.settlements || !W.tiles?.road) return;
  driveToWork();
  for (const town of W.settlements) {
    if (town.ruined) continue;
    if (W.tick % 128 === (town.id * 13) % 128) paveWornGround(town);
    if (W.tick % 256 === (town.id * 29 + 64) % 256) buyCars(town);
  }
};
// ── The crowd seen ──────────────────────────────────────────────────────────
// Drawn from the town's ledger count, never stored: a walker for every six of
// the crowd, a car for every five of its households where the town drives,
// each going from one paved tile to the next as the clock turns.
const CROWD_STREETS = { tick: -1, world: null, byTown: new Map() };
function crowdStreets(town) {
  if (CROWD_STREETS.world !== W || CROWD_STREETS.tick !== W.tick) {
    CROWD_STREETS.world = W;
    CROWD_STREETS.tick = W.tick;
    CROWD_STREETS.byTown = new Map();
  }
  // The crowd is painted over the town, so in the angled lenses it keeps to
  // the streets no building stands in front of (a car on a street behind a
  // house was drawn on its roof).
  const key = `${town.id}:${UI.view === "top" ? "top" : "angled"}`;
  let tiles = CROWD_STREETS.byTown.get(key);
  if (!tiles) {
    tiles = [];
    const reach = 9,
      angled = UI.view !== "top",
      built = (x, y) => inside(x, y) && typeof standingBuildingAtMovementTile === "function" && !!standingBuildingAtMovementTile(x, y);
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const x = town.x + dx,
          y = town.y + dy;
        if (!inside(x, y) || W.tiles.road[idx(x, y)] !== ROAD_PAVED) continue;
        if (angled && (built(x + 1, y) || built(x, y + 1) || built(x + 1, y + 1))) continue;
        tiles.push(idx(x, y));
      }
    CROWD_STREETS.byTown.set(key, tiles);
  }
  return tiles;
}
function crowdStep(tiles, seed, now, period) {
  const n = tiles.length,
    phase = now / period + (seed % 997) / 997,
    k = Math.floor(phase),
    t = phase - k,
    from = tiles[(seed + k * 7919) % n],
    [fx, fy] = xy(from);
  let to = from;
  for (let j = 1; j < 9; j++) {
    const cand = tiles[(seed + k * 7919 + j * 31) % n],
      [cx, cy] = xy(cand);
    if (Math.max(Math.abs(cx - fx), Math.abs(cy - fy)) === 1) {
      to = cand;
      break;
    }
  }
  const [tx, ty] = xy(to);
  return { x: fx + (tx - fx) * t + 0.5, y: fy + (ty - fy) * t + 0.5, dir: tx - fx };
}
const drawWorkerActivityStreetsBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivityStreetsBase(now, bounds);
  if (!W?.townsfolk || UI.camera.zoom < 1.2) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    still = ACTIVE_REDUCED_MOTION,
    lean = UI.quality === "low",
    capWalk = lean ? 18 : 60,
    capCars = lean ? 6 : 24,
    r = clamp(m.tw * 0.18, 2, 18);
  for (const town of W.settlements) {
    if (town.ruined || town.x < bounds.x0 - 10 || town.x > bounds.x1 + 10 || town.y < bounds.y0 - 10 || town.y > bounds.y1 + 10) continue;
    const count = folkCount(town);
    if (count < 6) continue;
    const tiles = crowdStreets(town);
    if (tiles.length < 4) continue;
    const walkers = Math.min(capWalk, Math.floor(count / 6)),
      cars = townDrives(town) ? Math.min(capCars, Math.floor(count / 25)) : 0,
      period = still ? 1e12 : 1400;
    ctx.save();
    for (let n = 0; n < walkers; n++) {
      const seed = hashParts(town.id, "walker", n),
        at = crowdStep(tiles, seed, now, period + (seed % 600)),
        s = proceduralProjectTile(at.x, at.y, m),
        hue = seed % 360,
        bob = still ? 0 : Math.sin(now * 0.012 + seed) * r * 0.08;
      ctx.fillStyle = hsl(hue, 38, 44, 0.92);
      ctx.fillRect(s.x - r * 0.18, s.y - r * 0.95 + bob, r * 0.36, r * 0.7);
      ctx.fillStyle = hsl(28 + (seed % 20), 40, 70, 0.95);
      ctx.beginPath();
      ctx.arc(s.x, s.y - r * 1.15 + bob, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    for (let n = 0; n < cars; n++) {
      const seed = hashParts(town.id, "car", n),
        at = crowdStep(tiles, seed, now, (period + (seed % 400)) * 0.45),
        s = proceduralProjectTile(at.x, at.y, m);
      drawVehicle(s, clamp(m.tw * 0.26, 3, 34), "motor", seed % 360, now, still, at.dir || 1);
    }
  }
};
window.ALIFE_STREETS_DEBUG = Object.freeze({
  counts: () => ({ ...STREETS }),
  buy: (townId) => buyCars(W.settlements.find((s) => s.id === townId)),
  drives: (townId) => townDrives(W.settlements.find((s) => s.id === townId)),
  hasCar: (id) => householdCar(id),
  drive: () => driveToWork(),
  pave: (townId) => paveWornGround(W.settlements.find((s) => s.id === townId)),
  crowdTiles: (townId) => crowdStreets(W.settlements.find((s) => s.id === townId)).length,
});
