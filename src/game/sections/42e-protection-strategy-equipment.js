// ================================================================
// 42E. SEALED REFUGES, CAMPAIGN PLANS, AND DEEP PRIMITIVE GEAR
// ================================================================
// Buildings and livestock enclosures are physical attack barriers. Campaigns
// expose their real launch gates, and primitive artifacts carry functional
// profiles rather than collapsing into one generic weapon or armor form.

const PROTECTIVE_BUILDING_TYPES = new Set([
  "stockpile",
  "shelter",
  "workshop",
  "kiln",
  "forge",
  "clinic",
  "archive",
  "hall",
  "hearth",
  "waterworks",
]);

function farmTiles(building) {
  return farmFootprintTiles(building);
}

const buildingAtTileFootprintBase = buildingAtTile;
buildingAtTile = function (tile) {
  const [x, y] = xy(tile),
    farm = (W.buildings || []).find(
      (building) =>
        building.type === "farm" &&
        (!building.ruined || sum(Array.from(building.composition || [])) > 0) &&
        Math.abs(x - building.x) <= 1 &&
        Math.abs(y - building.y) <= 1,
    );
  return farm || buildingAtTileFootprintBase(tile);
};

const buildingScreenSizeFarmBase = buildingScreenSize;
buildingScreenSize = function (building, metrics) {
  if (building?.type === "farm") return Math.max(5, metrics.tw * 1.38);
  return buildingScreenSizeFarmBase(building, metrics);
};

function cultivatedCropVisual(field, building) {
  const chemistry = field?.cropChemistry || fieldChemistrySignature(field),
    values = [
      chemistry?.[C.ORGANIC] || 0,
      chemistry?.[C.NUTRIENT] || 0,
      chemistry?.[C.SOLVENT] || 0,
      chemistry?.[C.PIGMENT] || 0,
      chemistry?.[C.CATALYST] || 0,
      chemistry?.[C.MINERAL] || 0,
    ],
    seed = hashParts(
      W.seedHash,
      "cultivated-crop-visual",
      building.styleSeed || building.id,
      ...values.map((value) => value >> 3),
    ),
    forms = ["stalk", "rosette", "reed", "fruiting-vine", "fanleaf", "bulb"],
    fruitForms = ["berry", "pod", "cone", "cluster"],
    pigmentHue = W.definitions.species[C.PIGMENT]?.colorHue ?? W.terrainGenome?.floraHue ?? 110,
    nutrientBias = (values[1] % 61) - 30,
    catalystBias = (values[4] % 47) - 23,
    mineralBias = (values[5] % 43) - 21;
  return {
    seed,
    form: forms[seed % forms.length],
    fruitForm: fruitForms[(seed >>> 5) % fruitForms.length],
    stemHue: wrapHue(pigmentHue + nutrientBias + (seed % 37) - 18),
    bloomHue: wrapHue(pigmentHue + 95 + catalystBias + ((seed >>> 8) % 53)),
    leafHue: wrapHue(pigmentHue + nutrientBias * 0.4 + ((seed >>> 4) % 29) - 14),
    soilHue: wrapHue((W.terrainGenome?.baseHue || 35) + mineralBias * 0.35),
    height: 0.78 + ((seed >>> 12) % 45) / 100,
    leafWidth: 0.72 + ((seed >>> 18) % 55) / 100,
    density: 0.88 + ((seed >>> 22) % 33) / 100,
  };
}

function cropQuadPoint(points, u, v) {
  const topX = lerp(points[0][0], points[1][0], u),
    topY = lerp(points[0][1], points[1][1], u),
    bottomX = lerp(points[3][0], points[2][0], u),
    bottomY = lerp(points[3][1], points[2][1], u);
  return [lerp(topX, bottomX, v), lerp(topY, bottomY, v)];
}

function drawCultivatedCrop(g, x, y, size, profile, stage, variant) {
  const mature = stage === "ripe",
    young = stage === "sown",
    height = size * profile.height * (young ? 0.45 : mature ? 1.15 : 0.82),
    width = size * profile.leafWidth,
    sway = ((variant % 5) - 2) * size * 0.07;
  g.save();
  g.translate(x, y);
  g.lineCap = "round";
  g.fillStyle = "rgba(0,0,0,.2)";
  g.beginPath();
  g.ellipse(0, size * 0.05, width * 0.34, size * 0.13, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = hsl(profile.stemHue, 55, mature ? 38 : 46, 0.96);
  g.fillStyle = hsl(profile.leafHue, 62, young ? 55 : 43, 0.96);
  g.lineWidth = Math.max(1, size * 0.13);
  if (profile.form === "rosette") {
    for (let leaf = 0; leaf < (young ? 4 : 7); leaf++) {
      g.save();
      g.rotate((Math.PI * 2 * leaf) / (young ? 4 : 7) + variant * 0.17);
      g.beginPath();
      g.ellipse(0, -width * 0.42, width * 0.22, width * 0.58, 0, 0, Math.PI * 2);
      g.fill();
      if (!young) {
        g.strokeStyle = hsl(profile.leafHue + 18, 42, 68, 0.58);
        g.lineWidth = Math.max(0.65, size * 0.045);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(0, -width * 0.8);
        g.stroke();
      }
      g.restore();
    }
  } else if (profile.form === "reed") {
    for (const offset of [-0.28, 0, 0.28]) {
      g.beginPath();
      g.moveTo(offset * width, 0);
      g.lineTo(offset * width + sway, -height * (1 - Math.abs(offset) * 0.22));
      g.stroke();
      if (!young) {
        g.fillStyle = hsl(profile.bloomHue, 64, mature ? 62 : 49, 0.96);
        g.beginPath();
        g.ellipse(
          offset * width + sway,
          -height * (1 - Math.abs(offset) * 0.22),
          width * 0.13,
          height * 0.18,
          0,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
    }
  } else {
    g.beginPath();
    g.moveTo(0, 0);
    if (profile.form === "fruiting-vine")
      g.quadraticCurveTo(width * 0.7, -height * 0.45, sway, -height);
    else g.lineTo(sway, -height);
    g.stroke();
    for (const side of [-1, 1]) {
      g.save();
      g.translate(sway * 0.45, -height * (side < 0 ? 0.42 : 0.68));
      g.rotate(side * (profile.form === "fanleaf" ? 0.95 : 0.62));
      g.beginPath();
      g.ellipse(0, -width * 0.25, width * 0.2, width * 0.52, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = hsl(profile.leafHue + 20, 38, 68, 0.64);
      g.lineWidth = Math.max(0.6, size * 0.045);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -width * 0.62);
      g.stroke();
      g.restore();
    }
    if (profile.form === "fanleaf" && !young)
      for (const fan of [-1, 0, 1]) {
        g.beginPath();
        g.moveTo(sway, -height * 0.8);
        g.lineTo(sway + fan * width * 0.55, -height * 1.18);
        g.stroke();
      }
    if (mature || profile.form === "bulb") {
      g.fillStyle = hsl(profile.bloomHue, 72, mature ? 58 : 48, 0.98);
      const fruitY = profile.form === "bulb" ? -height * 0.25 : -height;
      const fruitRadius = Math.max(1.2, width * (profile.form === "bulb" ? 0.34 : 0.2));
      for (let fruit = 0; fruit < (mature && profile.fruitForm === "cluster" ? 3 : 1); fruit++) {
        const angle = (fruit / 3) * Math.PI * 2 + variant * 0.31,
          fx = sway + (fruit ? Math.cos(angle) * fruitRadius * 0.72 : 0),
          fy = fruitY + (fruit ? Math.sin(angle) * fruitRadius * 0.52 : 0);
        g.beginPath();
        if (profile.fruitForm === "pod")
          g.ellipse(fx, fy, fruitRadius * 0.58, fruitRadius * 1.25, angle, 0, Math.PI * 2);
        else if (profile.fruitForm === "cone") {
          g.moveTo(fx, fy - fruitRadius);
          g.lineTo(fx + fruitRadius * 0.75, fy + fruitRadius);
          g.lineTo(fx - fruitRadius * 0.75, fy + fruitRadius);
          g.closePath();
        } else g.arc(fx, fy, fruitRadius, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.restore();
}

const drawBuildingSiteFarmBase = drawBuildingSite;
drawBuildingSite = function (g, building, now, metrics) {
  if (building?.type !== "farm" || building.ruined)
    return drawBuildingSiteFarmBase(g, building, now, metrics);
  const screen = proceduralProjectTile(building.x + 0.5, building.y + 0.5, metrics),
    radius = buildingScreenSize(building, metrics),
    palette = buildingPalette(building),
    field = W.fields?.find((candidate) => candidate.buildingId === building.id),
    stage = field?.stage || (building.complete ? "fallow" : "construction"),
    progress = building.complete ? 1 : clamp(building.progress || 0, 0, 1),
    points = buildingTileFootprintPoints(building, metrics, 3),
    profile = field ? cultivatedCropVisual(field, building) : null,
    cropHue =
      stage === "ripe"
        ? 52
        : stage === "growing"
          ? 112
          : stage === "sown"
            ? 88
            : W.terrainGenome?.baseHue || 35;
  g.save();
  const soilDark = hsl(profile?.soilHue ?? cropHue, 34, 15, 0.96),
    soilLight = hsl(profile?.soilHue ?? cropHue, 42, 25, 0.96);
  drawBuildingFootprint(
    g,
    screen,
    radius,
    UI.view,
    building.complete ? soilDark : hsl(cropHue, 30, 18, 0.92),
    building.complete ? palette.light : palette.accent,
    !building.complete,
    points,
  );
  g.strokeStyle = soilLight;
  g.lineWidth = Math.max(1, radius * 0.025);
  const line = (a, b, t) => [
    lerp(points[a][0], points[b][0], t),
    lerp(points[a][1], points[b][1], t),
  ];
  for (const t of [0.08, 0.17, 0.29, 0.38, 0.5, 0.59, 0.71, 0.8, 0.92]) {
    const top = line(0, 1, t),
      bottom = line(3, 2, t);
    g.beginPath();
    g.moveTo(top[0], top[1]);
    g.lineTo(bottom[0], bottom[1]);
    g.stroke();
  }
  if (building.complete) {
    g.fillStyle = hsl(profile?.soilHue ?? cropHue, 25, 40, 0.42);
    for (let speck = 0; speck < 42; speck++) {
      const u = 0.04 + visualHash01(building.styleSeed + speck, 0x51af) * 0.92,
        v = 0.04 + visualHash01(building.styleSeed + speck, 0xa719) * 0.92,
        [x, y] = cropQuadPoint(points, u, v);
      g.beginPath();
      g.arc(x, y, Math.max(0.5, radius * 0.008), 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = hsl(W.terrainGenome?.liquidHue || 195, 52, 52, 0.55);
    g.lineWidth = Math.max(1, radius * 0.032);
    for (const u of [1 / 3, 2 / 3]) {
      const top = cropQuadPoint(points, u, 0.03),
        bottom = cropQuadPoint(points, u, 0.97);
      g.beginPath();
      g.moveTo(top[0], top[1]);
      g.lineTo(bottom[0], bottom[1]);
      g.stroke();
    }
  }
  if (building.complete && field && ["sown", "growing", "ripe"].includes(stage)) {
    const plantsPerTile = stage === "sown" ? 3 : stage === "growing" ? 5 : 7,
      cropSize = Math.max(1.8, radius * 0.074 * profile.density);
    for (let tileRow = 0; tileRow < 3; tileRow++)
      for (let tileColumn = 0; tileColumn < 3; tileColumn++)
        for (let plant = 0; plant < plantsPerTile; plant++) {
          const variant = tileRow * 17 + tileColumn * 5 + plant + profile.seed,
            plantRow = plantsPerTile <= 3 ? 0 : Math.floor(plant / 3),
            plantsInRow = Math.min(3, plantsPerTile - plantRow * 3),
            plantColumn = plant % 3,
            u =
              (tileColumn +
                (plantsInRow === 1
                  ? 0.5
                  : plantsInRow === 2
                    ? 0.3 + plantColumn * 0.4
                    : 0.16 + plantColumn * 0.34)) /
              3,
            v =
              (tileRow +
                (plantsPerTile <= 3 ? 0.52 : [0.26, 0.56, 0.79][plantRow]) +
                (visualHash01(profile.seed, variant) - 0.5) * 0.1) /
              3,
            [x, y] = cropQuadPoint(points, u, v);
          drawCultivatedCrop(g, x, y, cropSize, profile, stage, variant);
        }
  }
  if (!building.complete) {
    g.fillStyle = palette.accent;
    g.fillRect(
      screen.x - radius * 0.52,
      screen.y + radius * 0.48,
      radius * 1.04 * progress,
      Math.max(2, radius * 0.07),
    );
  }
  g.restore();
};

function normalizeHerdEnclosure(herd, enclosure) {
  if (!herd || !enclosure || enclosure.type !== "corral") return enclosure;
  const targetMaximum = 1500 + Math.min(24, herd.animalIds?.length || 0) * 35;
  if (!enclosure.sealedPerimeterVersion || enclosure.maxIntegrity < targetMaximum) {
    const priorMaximum = Math.max(1, enclosure.maxIntegrity || targetMaximum),
      condition = enclosure.complete
        ? clamp((enclosure.integrity || priorMaximum) / priorMaximum, 0, 1)
        : 0;
    enclosure.maxIntegrity = Math.max(priorMaximum, targetMaximum);
    if (enclosure.complete)
      enclosure.integrity = Math.max(1, Math.round(enclosure.maxIntegrity * condition));
    enclosure.defense = Math.max(enclosure.defense || 0, 18);
    enclosure.sealedPerimeterVersion = 2;
  }
  return enclosure;
}

const ensureHerdEnclosureSealedBase = ensureHerdEnclosure;
ensureHerdEnclosure = function (herd, place) {
  return normalizeHerdEnclosure(herd, ensureHerdEnclosureSealedBase(herd, place));
};

const enclosureBlocksPredatorSealedBase = enclosureBlocksPredator;
enclosureBlocksPredator = function (predatorId, animalId) {
  const herd = herdForAnimal(animalId),
    enclosure = normalizeHerdEnclosure(herd, herdEnclosure(herd));
  if (
    !herd ||
    !enclosure?.complete ||
    enclosure.ruined ||
    !animalInsideEnclosure(animalId, herd, enclosure) ||
    enclosure.integrity <= 0
  )
    return false;
  const life = W.components.life[predatorId],
    previous = life?.lastEnclosureAttackTick ?? -999;
  if (life && W.tick - previous >= 8) {
    life.lastEnclosureAttackTick = W.tick;
    const event = emitEvent("EnclosureAttackedEvent", {
        subjects: [predatorId, animalId, herd.herderId].filter(Boolean),
        location: idx(enclosure.x, enclosure.y),
        causes: [herd.causeEvent],
        evidence: [
          `${entityName(predatorId)} was stopped at the sealed perimeter regardless of its attempted movement coordinate`,
          `${enclosure.integrity}/${enclosure.maxIntegrity} structural integrity remained before the strike`,
        ],
        magnitude: 1,
        importance: 1,
        data: { herdId: herd.id, buildingId: enclosure.id, protectedId: animalId },
      }),
      hardness = materialTrait(enclosure.architecture?.rigid ?? C.MINERAL).hardness,
      force =
        (5 + phenotype(predatorId).size * 7 + phenotype(predatorId).aggression * 5) /
        (1 + hardness * 0.8),
      damage = damageBuildingDirect(
        enclosure,
        force,
        `${entityName(predatorId)} tore at one segment of the sealed livestock perimeter`,
        event.id,
      );
    enclosure.lastDamage = { tick: W.tick, damage, causeEvent: event.id, attackerId: predatorId };
    event.magnitude = damage;
    event.data.damage = damage;
    event.data.remainingIntegrity = enclosure.integrity;
    if (enclosure.ruined) markEnclosureBreach(herd, enclosure, predatorId, event.id);
    else herd.state = "predator stopped outside sealed enclosure";
  }
  return true;
};

function pushPredatorsOutsideEnclosures() {
  let moved = false;
  for (const herd of W.herds?.filter((candidate) => candidate.active) || []) {
    const enclosure = normalizeHerdEnclosure(herd, herdEnclosure(herd));
    if (!enclosure?.complete || enclosure.ruined || enclosure.integrity <= 0) continue;
    const radius = herdEnclosureRadius(herd),
      predators = entityAtRadius(idx(enclosure.x, enclosure.y), radius + 1, KINDS.PREDATOR)
        .filter(classifyAlive)
        .sort((left, right) => left - right);
    for (const predatorId of predators) {
      const position = W.components.position[predatorId],
        dx = position.x - enclosure.x,
        dy = position.y - enclosure.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue;
      const axisX = Math.abs(dx) >= Math.abs(dy),
        sign = (axisX ? dx : dy) < 0 ? -1 : 1,
        x = clamp(enclosure.x + (axisX ? sign * (radius + 1) : dx), 0, W.width - 1),
        y = clamp(enclosure.y + (axisX ? dy : sign * (radius + 1)), 0, W.height - 1);
      queueEffect("MoveEntity", { entityId: predatorId, x, y }, enclosure.id);
      W.components.life[predatorId].preyTargetId = 0;
      moved = true;
    }
  }
  if (moved) resolveEffects();
}

const updateLivingHerdsSealedBase = updateLivingHerds;
updateLivingHerds = function () {
  const result = updateLivingHerdsSealedBase();
  pushPredatorsOutsideEnclosures();
  return result;
};

function buildingOccupancyCandidate(id) {
  if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) return null;
  const position = W.components.position[id],
    life = W.components.life[id];
  if (!position || !life) return null;
  const building = W.buildings.find(
    (candidate) =>
      candidate.id === life.insideBuildingId &&
      candidate.complete &&
      !candidate.ruined &&
      PROTECTIVE_BUILDING_TYPES.has(candidate.type),
  );
  if (!building || position.x !== building.x || position.y !== building.y) return null;
  return building;
}

function protectedBuildingForPerson(id) {
  const building = buildingOccupancyCandidate(id);
  if (!building && W.components.life[id]) W.components.life[id].insideBuildingId = 0;
  return building;
}

let DEVELOPMENT_MOVEMENT_CACHE = {
  world: null,
  tick: -1,
  buildingCount: -1,
  tiles: new Map(),
};

function invalidateDevelopmentMovementCache() {
  DEVELOPMENT_MOVEMENT_CACHE.tick = -1;
}

function rebuildDevelopmentMovementCache() {
  const tiles = new Map();
  for (const building of W.buildings || []) {
    if (!building.complete || building.ruined || building.integrity <= 0) continue;
    const radius = building.type === "farm" || building.type === "corral" ? 1 : 0;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const x = building.x + dx,
          y = building.y + dy;
        if (!inside(x, y)) continue;
        const tile = idx(x, y),
          prior = tiles.get(tile);
        if (!prior || building.id < prior.id) tiles.set(tile, building);
      }
  }
  DEVELOPMENT_MOVEMENT_CACHE = {
    world: W,
    tick: W.tick,
    buildingCount: W.buildings?.length || 0,
    tiles,
  };
}

function standingBuildingAtMovementTile(x, y) {
  if (
    DEVELOPMENT_MOVEMENT_CACHE.world !== W ||
    DEVELOPMENT_MOVEMENT_CACHE.tick !== W.tick ||
    DEVELOPMENT_MOVEMENT_CACHE.buildingCount !== (W.buildings?.length || 0)
  )
    rebuildDevelopmentMovementCache();
  return DEVELOPMENT_MOVEMENT_CACHE.tiles.get(idx(x, y)) || null;
}

function personMayEnterBuilding(id, building) {
  if (
    W.kind[id] !== KINDS.PERSON ||
    !building ||
    ["farm", "corral", "wall"].includes(building.type)
  )
    return false;
  const life = W.components.life[id],
    work = W.components.work?.[id],
    activeWork =
      work?.buildingId === building.id &&
      work.task !== "idle" &&
      W.tick - (work.handledTick ?? -999) <= 16;
  if (activeWork) return true;
  if (life?.wounded || life?.infected)
    return building.type === "clinic" || building.type === "shelter";
  if (life?.behavior === "rest") return ["shelter", "hearth", "clinic"].includes(building.type);
  if (life?.behavior === "return")
    return ["shelter", "hall", "clinic", "hearth"].includes(building.type);
  if (life?.behavior === "socialize") return ["hall", "hearth", "shelter"].includes(building.type);
  return false;
}

function preferredReturnBuilding(id) {
  if (W.kind[id] !== KINDS.PERSON) return nearestFriendlyPlace(id);
  const place = nearestFriendlyPlace(id),
    position = W.components.position[id];
  if (!place || !position) return place;
  const priorities = { shelter: 0, clinic: 1, hall: 2, hearth: 3 };
  return (
    completedBuildings(place)
      .filter((building) => Object.hasOwn(priorities, building.type))
      .sort(
        (left, right) =>
          priorities[left.type] - priorities[right.type] ||
          dist2(position.x, position.y, left.x, left.y) -
            dist2(position.x, position.y, right.x, right.y) ||
          left.id - right.id,
      )[0] || place
  );
}

function herdOwnsCorralTile(id, building) {
  if (W.kind[id] !== KINDS.HERBIVORE || building?.type !== "corral") return false;
  const herd = herdForAnimal(id);
  return !!herd && herd.enclosureBuildingId === building.id;
}

function movementTileBlocked(id, x, y) {
  const building = standingBuildingAtMovementTile(x, y);
  if (!building) return false;
  if (herdOwnsCorralTile(id, building)) return false;
  const life = W.components.life[id];
  if (life?.insideBuildingId === building.id && x === building.x && y === building.y) return false;
  return !(x === building.x && y === building.y && personMayEnterBuilding(id, building));
}

function constrainDevelopedMovement(id, proposedX, proposedY) {
  const position = W.components.position[id],
    life = W.components.life[id];
  if (!position) return { x: proposedX, y: proposedY };
  const occupied = life?.insideBuildingId
    ? W.buildings.find(
        (building) =>
          building.id === life.insideBuildingId &&
          building.complete &&
          !building.ruined &&
          building.integrity > 0,
      )
    : null;
  if (occupied && (proposedX !== occupied.x || proposedY !== occupied.y)) {
    life.insideBuildingId = 0;
  }
  const building = standingBuildingAtMovementTile(proposedX, proposedY);
  if (!building) return { x: proposedX, y: proposedY };
  if (herdOwnsCorralTile(id, building)) return { x: proposedX, y: proposedY };
  if (
    proposedX === building.x &&
    proposedY === building.y &&
    personMayEnterBuilding(id, building)
  ) {
    life.insideBuildingId = building.id;
    return { x: proposedX, y: proposedY };
  }
  if (
    life?.insideBuildingId === building.id &&
    proposedX === building.x &&
    proposedY === building.y
  )
    return { x: proposedX, y: proposedY };
  return { x: position.x, y: position.y };
}

function nearestOpenDevelopmentTile(id, originX, originY) {
  const options = [];
  for (let radius = 1; radius <= 4; radius++) {
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = originX + dx,
          y = originY + dy;
        if (!inside(x, y) || movementTileBlocked(id, x, y)) continue;
        options.push({
          x,
          y,
          score:
            radius * 1000 +
            organismHabitatStress(id, idx(x, y)) * 10 +
            (hashParts(W.seedHash, "building-exit", id, x, y) % 101),
        });
      }
    if (options.length) break;
  }
  options.sort((left, right) => left.score - right.score || left.y - right.y || left.x - right.x);
  return options[0] || null;
}

function reconcileBuildingOccupancy() {
  for (const id of W.activeIds) {
    if (![KINDS.PERSON, KINDS.PREDATOR, KINDS.HERBIVORE].includes(W.kind[id])) continue;
    const position = W.components.position[id],
      life = W.components.life[id];
    if (!position || !life || !classifyAlive(id)) continue;
    const building = standingBuildingAtMovementTile(position.x, position.y);
    if (!building) {
      life.insideBuildingId = 0;
      continue;
    }
    if (herdOwnsCorralTile(id, building)) {
      life.insideBuildingId = 0;
      continue;
    }
    if (
      position.x === building.x &&
      position.y === building.y &&
      personMayEnterBuilding(id, building)
    ) {
      life.insideBuildingId = building.id;
      continue;
    }
    life.insideBuildingId = 0;
    const exit = nearestOpenDevelopmentTile(id, building.x, building.y);
    if (exit) {
      position.x = exit.x;
      position.y = exit.y;
      position.regionId = regionId(exit.x, exit.y);
    }
  }
}

function attackerOutsideBuilding(attackerId, building) {
  const position = W.components.position[attackerId];
  if (!position || !building) return true;
  return Math.max(Math.abs(position.x - building.x), Math.abs(position.y - building.y)) > 0;
}

function combatReach(id) {
  const weapon = (W.components.inventory[id]?.artifactIds || [])
    .map((entityId) => W.artifacts.find((artifact) => artifact.entityId === entityId))
    .filter((artifact) => isFunctionalTool(artifact, "war"))
    .sort((left, right) => right.quality - left.quality || left.id - right.id)[0];
  if (!weapon) return 1;
  if (Number.isFinite(weapon.tool.profile?.reach)) return weapon.tool.profile.reach;
  const capabilities = weapon.tool.capabilities || [];
  return capabilities.includes("firearm")
    ? 8
    : capabilities.includes("ranged")
      ? 6
      : capabilities.includes("reach")
        ? 2.4
        : 1;
}

function applyCombatWear(artifact, amount = 1) {
  if (!artifact?.tool || !isFunctionalTool(artifact)) return;
  artifact.tool.wear = Math.min(artifact.tool.durability, artifact.tool.wear + Math.max(1, amount));
  artifact.damage = Math.floor(
    (artifact.tool.wear / Math.max(1, artifact.tool.durability)) *
      (artifact.structure?.integrity || 100),
  );
}

function attackOccupiedBuilding(attackerId, victimId, building, context = {}) {
  const attackerLife = W.components.life[attackerId],
    cooldown = W.kind[attackerId] === KINDS.PREDATOR ? 8 : 6,
    previous = attackerLife?.lastOccupiedBuildingAttackTick ?? -999;
  if (!attackerLife || W.tick - previous < cooldown) return true;
  attackerLife.lastOccupiedBuildingAttackTick = W.tick;
  const predator = W.kind[attackerId] === KINDS.PREDATOR,
    force = predator
      ? 4 + phenotype(attackerId).size * 7 + phenotype(attackerId).aggression * 5
      : 7 + combatEquipmentQuality(attackerId) * 0.15 + (context.training || 0) * 0.8,
    event = emitEvent("BuildingDamagedEvent", {
      subjects: [attackerId, victimId].filter(Boolean),
      location: idx(building.x, building.y),
      factions: combatFactions(attackerId, victimId),
      causes: [context.causeEvent, context.war?.lastEventId, context.war?.startEventId].filter(
        Boolean,
      ),
      evidence: [
        `${entityName(victimId)} was inside ${building.name}, so the body could not be targeted`,
        `${entityName(attackerId)} struck one structural segment instead`,
        "the occupant becomes exposed only after the enclosing building physically collapses",
      ],
      magnitude: force,
      importance: context.military ? 2 : 1,
      data: {
        buildingId: building.id,
        protectedId: victimId,
        attackerId,
        military: !!context.military,
      },
    }),
    damage = damageBuildingDirect(
      building,
      force,
      `${entityName(attackerId)} attacked the occupied ${building.name} piece by piece`,
      event.id,
    );
  building.lastDamage = { tick: W.tick, damage, causeEvent: event.id, attackerId };
  event.magnitude = damage;
  event.data.damage = damage;
  event.data.remainingIntegrity = building.integrity;
  if (damage) applyCombatWear(carriedToolForPurpose(attackerId, "war"), 2);
  if (context.military)
    setWorkAction(
      attackerId,
      "raze",
      `breaching ${building.name} before attacking its occupants`,
      idx(building.x, building.y),
      -1,
      building.id,
    );
  return true;
}

const performHuntBuildingProtectionBase = performHunt;
performHunt = function (predatorId, prey) {
  const accessible = [];
  for (const targetId of prey) {
    const building =
      W.kind[targetId] === KINDS.PERSON ? protectedBuildingForPerson(targetId) : null;
    if (building) {
      const predator = W.components.position[predatorId],
        reach = buildingSpatialRadius(building.type) + 1;
      if (
        predator &&
        Math.max(Math.abs(predator.x - building.x), Math.abs(predator.y - building.y)) <= reach
      )
        attackOccupiedBuilding(predatorId, targetId, building);
    } else accessible.push(targetId);
  }
  return accessible.length ? performHuntBuildingProtectionBase(predatorId, accessible) : false;
};

const detailedCombatExchangeBuildingProtectionBase = detailedCombatExchange;
detailedCombatExchange = function (attackerId, victimId, context = {}) {
  const attackerPosition = W.components.position[attackerId],
    victimPosition = W.components.position[victimId],
    reach = combatReach(attackerId);
  if (
    !attackerPosition ||
    !victimPosition ||
    (!context.force &&
      dist2(attackerPosition.x, attackerPosition.y, victimPosition.x, victimPosition.y) >
        reach * reach)
  )
    return 0;
  const building = W.kind[victimId] === KINDS.PERSON ? protectedBuildingForPerson(victimId) : null;
  if (building && attackerOutsideBuilding(attackerId, building)) {
    if (context.military || W.kind[attackerId] === KINDS.PREDATOR)
      attackOccupiedBuilding(attackerId, victimId, building, context);
    return 0;
  }
  const beforeAttackTick = W.components.life[attackerId]?.lastMilitaryAttackTick,
    result = detailedCombatExchangeBuildingProtectionBase(attackerId, victimId, context),
    attempted =
      W.components.life[attackerId]?.lastMilitaryAttackTick === W.tick &&
      beforeAttackTick !== W.tick;
  if (attempted) applyCombatWear(carriedToolForPurpose(attackerId, "war"), result ? 2 : 1);
  if (result)
    for (const entityId of W.components.inventory[victimId]?.artifactIds || []) {
      const artifact = W.artifacts.find((candidate) => candidate.entityId === entityId);
      if (
        isFunctionalTool(artifact) &&
        (artifact.tool.profile?.coverage ||
          artifact.tool.capabilities.some((capability) =>
            ["armor", "shield", "helmet", "limb_armor"].includes(capability),
          ))
      )
        applyCombatWear(artifact, result === 2 ? 2 : 1);
    }
  return result;
};

function campaignFactions(war) {
  return {
    a: W.factions.find((faction) => faction.id === war.a),
    b: W.factions.find((faction) => faction.id === war.b),
  };
}

function campaignTarget(war, attackerId) {
  const defenderId = attackerId === war.a ? war.b : war.a;
  return W.settlements
    .filter((settlement) => !settlement.ruined && settlement.factionId === defenderId)
    .sort(
      (left, right) =>
        settlementDefense(left) - settlementDefense(right) ||
        sum(Array.from(right.inventory || [])) - sum(Array.from(left.inventory || [])) ||
        left.id - right.id,
    )[0];
}

function campaignMotive(war, attacker, defender, target) {
  const relation = attacker?.relations?.[defender?.id] || {},
    stores = sum(Array.from(target?.inventory || [])),
    reasons = [];
  if ((relation.grievance || 0) > 4)
    reasons.push(`answer ${Math.round(relation.grievance)} grievance`);
  if ((relation.pressure || 0) > 80) reasons.push("break escalating territorial pressure");
  if (target && settlementFood(target) > 14) reasons.push("seize a food-secure objective");
  if (stores > 160) reasons.push("capture concentrated material stores");
  if (!reasons.length) reasons.push("force a favorable political settlement");
  return reasons.slice(0, 2).join(" and ");
}

function campaignApproach(war, attackerId, target, units) {
  const members = units.flatMap((unit) => unit.memberIds).filter(classifyAlive),
    ranged = members.filter((id) => attackerRangedTier(id) > 0).length,
    shields = members.filter((id) => equipmentProtection(id) > 8).length,
    walls = target ? completedBuildings(target, "wall").length : 0;
  if (walls)
    return ranged >= Math.ceil(members.length / 2)
      ? "screen with ranged volleys, concentrate tools on one wall segment, then occupy intact buildings"
      : "form under shields, breach the weakest wall segment, and assault the local strongpoint";
  if (ranged >= Math.ceil(members.length / 2))
    return "advance in a supplied formation, suppress defenders at range, then establish physical control";
  if (shields >= Math.ceil(members.length / 2))
    return "close behind layered shields, flank the defender formation, and preserve useful structures";
  return "muster a compact column, approach the least-defended route, and force close contact";
}

function carriedToolForPurpose(id, purpose) {
  return (
    (W.components.inventory[id]?.artifactIds || [])
      .map((entityId) => W.artifacts.find((artifact) => artifact.entityId === entityId))
      .filter((artifact) => isFunctionalTool(artifact, purpose))
      .sort((left, right) => right.quality - left.quality || left.id - right.id)[0] || null
  );
}

function campaignReadiness(war, plan) {
  const units = W.militaryUnits.filter((unit) => unit.active && unit.factionId === plan.attackerId),
    members = units.flatMap((unit) => unit.memberIds).filter(classifyAlive),
    target = W.settlements.find(
      (settlement) => settlement.id === plan.targetSettlementId && !settlement.ruined,
    ),
    averageSupply = units.length ? mean(units.map((unit) => unit.supply || 0)) : 0,
    averageTraining = units.length ? mean(units.map((unit) => unit.training || 0)) : 0,
    armed = members.filter((id) => !!carriedToolForPurpose(id, "war")).length,
    protectedCount = members.filter((id) => equipmentProtection(id) >= 8).length,
    healthy = members.filter((id) => peekDerivedLife(id).health >= 55).length,
    requirements = [
      {
        key: "fighters",
        label: "Fighters assembled",
        current: members.length,
        target: plan.minimumFighters,
        ready: members.length >= plan.minimumFighters,
      },
      {
        key: "supply",
        label: "Food, water, and energy supply",
        current: Math.round(averageSupply * 100),
        target: 58,
        unit: "%",
        ready: averageSupply >= 0.58,
      },
      {
        key: "training",
        label: "Formation training",
        current: +averageTraining.toFixed(2),
        target: 0.08,
        ready: averageTraining >= 0.08,
      },
      {
        key: "weapons",
        label: "Members with weapons",
        current: members.length ? Math.round((armed / members.length) * 100) : 0,
        target: 55,
        unit: "%",
        ready: !!members.length && armed / members.length >= 0.55,
      },
      {
        key: "protection",
        label: "Members with armor or shields",
        current: members.length ? Math.round((protectedCount / members.length) * 100) : 0,
        target: 35,
        unit: "%",
        ready: !!members.length && protectedCount / members.length >= 0.35,
      },
      {
        key: "health",
        label: "Healthy enough to march",
        current: members.length ? Math.round((healthy / members.length) * 100) : 0,
        target: 70,
        unit: "%",
        ready: !!members.length && healthy / members.length >= 0.7,
      },
      {
        key: "route",
        label: "Reachable enemy objective",
        current: target ? 1 : 0,
        target: 1,
        ready: !!target,
      },
    ],
    readyCount = requirements.filter((requirement) => requirement.ready).length;
  return {
    units,
    members,
    target,
    requirements,
    readyCount,
    readiness: readyCount / requirements.length,
    blockers: requirements.filter((requirement) => !requirement.ready),
  };
}

function ensureAttackPlan(war, create = false) {
  if (!war || war.ended) return war?.attackPlan || null;
  if (!war.attackPlan && !create) return null;
  const { a, b } = campaignFactions(war);
  if (!war.attackerId)
    war.attackerId = (a?.militaryStrength || 0) >= (b?.militaryStrength || 0) ? war.a : war.b;
  const attacker = war.attackerId === war.a ? a : b,
    defender = attacker === a ? b : a,
    target = campaignTarget(war, attacker?.id),
    units = W.militaryUnits.filter((unit) => unit.active && unit.factionId === attacker?.id);
  if (!war.attackPlan) {
    const homes = W.settlements.filter(
        (settlement) => !settlement.ruined && settlement.factionId === attacker?.id,
      ),
      distance =
        target && homes.length
          ? Math.min(...homes.map((home) => Math.sqrt(dist2(home.x, home.y, target.x, target.y))))
          : 0,
      preparation =
        80 + Math.round(distance * 3) + (hashParts(W.seedHash, "attack-plan", war.id) % 65);
    war.attackPlan = {
      createdTick: war.started,
      attackerId: attacker?.id || war.attackerId,
      defenderId: defender?.id || (war.attackerId === war.a ? war.b : war.a),
      targetSettlementId: target?.id || 0,
      plannedLaunchTick: war.started + preparation,
      latestLaunchTick: war.started + preparation + 384,
      minimumFighters: Math.max(
        2,
        Math.min(8, Math.ceil((target ? settlementDefense(target) : 8) / 12)),
      ),
      motive: campaignMotive(war, attacker, defender, target),
      approach: campaignApproach(war, attacker?.id, target, units),
      launchedTick: 0,
      launchEventId: 0,
    };
  } else if (create) {
    const currentTarget = W.settlements.find(
      (settlement) =>
        settlement.id === war.attackPlan.targetSettlementId &&
        !settlement.ruined &&
        settlement.factionId === war.attackPlan.defenderId,
    );
    if (!currentTarget) {
      war.attackPlan.targetSettlementId = target?.id || 0;
      war.attackPlan.motive = campaignMotive(war, attacker, defender, target);
      war.attackPlan.approach = campaignApproach(war, attacker?.id, target, units);
      war.attackPlan.minimumFighters = Math.max(
        2,
        Math.min(8, Math.ceil((target ? settlementDefense(target) : 8) / 12)),
      );
    }
  }
  return war.attackPlan;
}

function updateAttackPlan(war) {
  const plan = ensureAttackPlan(war, true);
  if (!plan || plan.launchedTick) return plan;
  const readiness = campaignReadiness(war, plan),
    earliestReached = W.tick >= plan.plannedLaunchTick,
    forcedWindow =
      W.tick >= plan.latestLaunchTick &&
      readiness.members.length >= 2 &&
      readiness.requirements.find((requirement) => requirement.key === "supply")?.current >= 42;
  plan.lastReadiness = readiness.readiness;
  plan.lastBlockers = readiness.blockers.map((requirement) => requirement.key);
  if (!earliestReached || (readiness.blockers.length && !forcedWindow)) return plan;
  plan.launchedTick = W.tick || 1;
  const attacker = W.factions.find((faction) => faction.id === plan.attackerId),
    defender = W.factions.find((faction) => faction.id === plan.defenderId),
    target = readiness.target,
    event = emitEvent("MilitaryPhaseEvent", {
      subjects: readiness.units
        .map(
          (unit) =>
            W.settlements.find((settlement) => settlement.id === unit.homeSettlementId)?.entityId,
        )
        .filter(Boolean),
      location: target ? idx(target.x, target.y) : -1,
      factions: [plan.attackerId, plan.defenderId],
      causes: [war.startEventId],
      evidence: [
        `${readiness.members.length} fighters launched at ${Math.round(readiness.readiness * 100)}% plan readiness`,
        `objective: ${target?.name || "remaining enemy territory"}`,
        `method: ${plan.approach}`,
        forcedWindow
          ? "the latest acceptable launch window forced a riskier departure"
          : "all required launch gates were satisfied",
      ],
      magnitude: readiness.members.length,
      importance: 3,
      data: {
        warId: war.id,
        phase: "campaign launched",
        attacker: attacker?.name,
        defender: defender?.name,
        target: target?.name,
        readiness: readiness.readiness,
      },
    });
  plan.launchEventId = event.id;
  war.lastEventId = event.id;
  return plan;
}

function levyCampaignForce(war, plan, attacker, home) {
  const fieldable = [];
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    if ((W.components.social[id]?.factionId || 0) !== attacker.id) continue;
    const locomotion =
      typeof embodiedCapability === "function" ? embodiedCapability(id).locomotion : 1;
    if (locomotion >= 0.42) fieldable.push(id);
  }
  if (fieldable.length < 2) return false;
  fieldable.sort((x, y) => x - y);
  let unit = W.militaryUnits
    .filter((u) => u.active && u.factionId === attacker.id)
    .sort((x, y) => y.memberIds.length - x.memberIds.length || x.id - y.id)[0];
  if (!unit) {
    unit = {
      id: Math.max(0, ...W.militaryUnits.map((u) => u.id || 0)) + 1,
      factionId: attacker.id,
      homeSettlementId: home?.id || 0,
      memberIds: [],
      training: 0.2,
      supply: 0.6,
      morale: 0.6,
      objectiveSettlementId: plan.targetSettlementId || 0,
      formedTick: W.tick,
      lastBattleTick: 0,
      phase: "mustering",
      phaseDetail: "an emergency levy answered the horns",
      phaseTick: W.tick,
      lastProgressTick: W.tick,
      stalledTicks: 0,
      active: true,
    };
    W.militaryUnits.push(unit);
  }
  for (const id of fieldable) {
    if (unit.memberIds.length >= Math.max(plan.minimumFighters || 2, 4)) break;
    if (!unit.memberIds.includes(id)) unit.memberIds.push(id);
  }
  if (unit.memberIds.filter(classifyAlive).length < 2) return false;
  plan.launchedTick = W.tick || 1;
  const anchor = home || { x: W.components.position[unit.memberIds[0]]?.x || 0, y: 0 },
    event = emitEvent("MilitaryPhaseEvent", {
      subjects: unit.memberIds.slice(0, 4),
      location: idx(anchor.x || 0, anchor.y || 0),
      factions: [attacker.id],
      causes: [war.startEventId].filter(Boolean),
      evidence: [
        "the launch window closed with the standing muster short",
        `an emergency levy conscripted ${unit.memberIds.length} fieldable adults to carry the campaign`,
      ],
      importance: 3,
      data: { phase: "levy", warId: war.id },
    });
  war.lastEventId = event.id || war.lastEventId;
  return true;
}
const resolveWarTurnPlannedBase = resolveWarTurn;
resolveWarTurn = function (war, a, b) {
  if (!war || war.ended) return;
  const settlementsA = W.settlements.filter(
      (settlement) => !settlement.ruined && settlement.factionId === a?.id,
    ),
    settlementsB = W.settlements.filter(
      (settlement) => !settlement.ruined && settlement.factionId === b?.id,
    );
  if (!a || !b || !settlementsA.length || !settlementsB.length)
    return endWar(war, a, b, "political collapse before mobilization");
  const plan = updateAttackPlan(war);
  if (plan && !plan.launchedTick) {
    if (W.tick >= plan.latestLaunchTick && typeof factionFieldableFighters === "function") {
      const attacker = W.factions.find((faction) => faction.id === plan.attackerId) || a,
        home = (attacker.id === a.id ? settlementsA : settlementsB)[0];
      if (factionFieldableFighters(attacker) >= 2)
        levyCampaignForce(war, plan, attacker, home);
    }
    if (plan.launchedTick) return resolveWarTurnPlannedBase(war, a, b);
    if (W.tick > plan.latestLaunchTick + 512)
      return endWar(war, a, b, "mobilization failed to meet a viable launch window");
    return;
  }
  return resolveWarTurnPlannedBase(war, a, b);
};

const militaryObjectivePlannedBase = militaryObjective;
militaryObjective = function (unit) {
  const objective = militaryObjectivePlannedBase(unit);
  if (!objective.war) return objective;
  const plan = ensureAttackPlan(objective.war, true);
  if (plan && !plan.launchedTick) {
    unit.objectiveSettlementId = 0;
    return { war: null, target: objective.home, home: objective.home, planningWar: objective.war };
  }
  return objective;
};

function requirementRow(requirement) {
  const current = `${requirement.current}${requirement.unit || ""}`,
    target = `${requirement.target}${requirement.unit || ""}`,
    width = clamp(
      (Number(requirement.current) / Math.max(0.001, Number(requirement.target))) * 100,
      0,
      100,
    );
  return `<div class="campaign-requirement"><div class="row between"><span>${esc(requirement.label)}</span><b class="${requirement.ready ? "good-text" : "gold"}">${requirement.ready ? "Ready" : `${current} / ${target}`}</b></div><div class="bar"><i style="width:${width}%;background:${requirement.ready ? "#79c989" : "#d9b56d"}"></i></div></div>`;
}

function campaignCard(war) {
  const plan = war.attackPlan;
  if (!plan)
    return `<article class="card campaign-card"><div class="eyebrow">War #${war.id}</div><p class="muted">The simulation has not yet created an operational plan for this legacy war.</p></article>`;
  const readiness = campaignReadiness(war, plan),
    attacker = W.factions.find((faction) => faction.id === plan.attackerId),
    defender = W.factions.find((faction) => faction.id === plan.defenderId),
    target = readiness.target,
    launched = !!plan.launchedTick,
    until = Math.max(0, plan.plannedLaunchTick - W.tick),
    timing = launched
      ? `Launched at tick ${plan.launchedTick.toLocaleString()}`
      : W.tick < plan.plannedLaunchTick
        ? `Earliest launch in ${until.toLocaleString()} ticks`
        : readiness.blockers.length
          ? `Launch delayed by ${readiness.blockers.length} unmet gate${readiness.blockers.length === 1 ? "" : "s"}`
          : "Launch order is being issued";
  return `<article class="card campaign-card"><div class="row between"><div><div class="eyebrow">War #${war.id} · ${launched ? "active campaign" : "attack preparation"}</div><h3 style="margin:4px 0">${esc(attacker?.name || "Unknown attacker")} → ${esc(target?.name || defender?.name || "enemy territory")}</h3></div><span class="tag ${launched ? "red" : "gold"}">${Math.round(readiness.readiness * 100)}% ready</span></div><div class="campaign-timing">${esc(timing)}</div><div class="kv" style="margin-top:9px"><span>Defender</span><b>${esc(defender?.name || "unknown")}</b><span>Target</span><b>${esc(target?.name || "selecting a surviving objective")}</b><span>Why this war</span><b>${esc(plan.motive)}</b><span>How they plan to attack</span><b>${esc(plan.approach)}</b><span>Planned launch tick</span><b>${plan.plannedLaunchTick.toLocaleString()}</b><span>Latest acceptable window</span><b>${plan.latestLaunchTick.toLocaleString()}</b><span>Fielded units / fighters</span><b>${readiness.units.length} / ${readiness.members.length}</b><span>Casualties so far</span><b>${war.casualties || 0}</b></div><div class="subhead">Launch gates</div><div class="stack">${readiness.requirements.map(requirementRow).join("")}</div>${readiness.blockers.length ? `<div class="campaign-blockers"><b>Still needed:</b> ${esc(readiness.blockers.map((requirement) => requirement.label).join(" · "))}</div>` : `<div class="campaign-blockers ready"><b>All launch gates satisfied.</b> The force will depart when its planned window opens.</div>`}</article>`;
}

function refreshWarfare() {
  if (!W || !DOM.warfarePane) return;
  const active = W.activeWars.filter((war) => !war.ended),
    ended = W.activeWars
      .filter((war) => war.ended)
      .slice(-6)
      .reverse(),
    tensions = W.factions
      .flatMap((faction) =>
        Object.entries(faction.relations || {})
          .filter(
            ([otherId, relation]) => faction.id < Number(otherId) && relation.status === "hostile",
          )
          .map(([otherId, relation]) => ({
            faction,
            other: W.factions.find((candidate) => candidate.id === Number(otherId)),
            pressure: relation.pressure || 0,
          })),
      )
      .sort((left, right) => right.pressure - left.pressure)
      .slice(0, 5);
  DOM.warfarePane.innerHTML = `<div class="eyebrow">Operational intelligence</div><h3 style="margin:5px 0">Army attack plans</h3><p class="muted">Launch dates are real simulation gates. Armies wait for people, supplies, training, equipment, health, and a reachable objective; after launch, their tactics respond to contact and structures.</p>${active.length ? active.map(campaignCard).join("") : `<div class="empty">No army is preparing an attack. Hostile pressure and defensive musters still appear below.</div>`}${tensions.length ? `<div class="subhead">Hostile pressure before war</div>${tensions.map((entry) => `<div class="faction-row"><div class="row between"><b>${esc(entry.faction.name)} ↔ ${esc(entry.other?.name || "unknown")}</b><span class="tag gold">${Math.round(entry.pressure)} pressure</span></div><small class="muted">War begins only if pressure exceeds the political threshold and both sides can field material military strength.</small></div>`).join("")}` : ""}${ended.length ? `<details><summary>Recently ended wars · ${ended.length}</summary>${ended.map((war) => `<div class="faction-row"><b>War #${war.id}</b><small class="muted">Ended tick ${war.ended.toLocaleString()} · ${war.wounded == null ? `${war.casualties || 0} dead · fought before the casualty reform` : `${war.casualties || 0} dead · ${war.wounded} wounded`} · ${war.contactTurns || 0} contact turns${war.endReason ? ` · ${esc(war.endReason)}` : ""}</small></div>`).join("")}</details>` : ""}`;
}

EQUIPMENT_PURPOSES.add("helmet");
EQUIPMENT_PURPOSES.add("limb_armor");
EQUIPMENT_PURPOSES.add("utility");

const primitiveWarFormDeepBase = primitiveWarForm;
primitiveWarForm = function (id, recipe) {
  const material = materialTrait(recipe.head),
    tier = warToolTier(id),
    variants =
      tier >= 3
        ? [
            {
              form: "spark-lock gun analogue",
              capabilities: ["war", "ranged", "firearm", "gun", "powder", "pierce"],
            },
            {
              form: "hand-cannon analogue",
              capabilities: ["war", "ranged", "firearm", "gun", "powder", "crush"],
            },
            {
              form: "rotary ember gun analogue",
              capabilities: ["war", "ranged", "firearm", "gun", "powder", "suppress"],
            },
          ]
        : tier >= 2
          ? [
              {
                form: "sinew-backed bow analogue",
                capabilities: ["war", "ranged", "bow", "pierce"],
              },
              {
                form: "torsion sling analogue",
                capabilities: ["war", "ranged", "sling", "crush"],
              },
              {
                form: "lever-drawn crossbow analogue",
                capabilities: ["war", "ranged", "crossbow", "pierce", "shield_break"],
              },
            ]
          : recipe.head === C.BONE
            ? [
                {
                  form: "barbed bone reach-spear",
                  capabilities: ["war", "cut", "pierce", "reach"],
                },
                { form: "jaw-tooth sickle club", capabilities: ["war", "cut", "hook"] },
                { form: "antler fork staff", capabilities: ["war", "reach", "disarm"] },
              ]
            : material.density > 0.72
              ? [
                  { form: "gravity-knot maul", capabilities: ["war", "crush", "shield_break"] },
                  { form: "counterweighted stone axe", capabilities: ["war", "cut", "crush"] },
                  { form: "socketed impact beak", capabilities: ["war", "pierce", "crush"] },
                ]
              : [
                  { form: "flaked crescent edge", capabilities: ["war", "cut", "pierce"] },
                  { form: "hooked thrusting staff", capabilities: ["war", "cut", "reach"] },
                  { form: "weighted cord sling", capabilities: ["war", "ranged", "crush"] },
                  { form: "obsidian-tooth paddle", capabilities: ["war", "cut", "shield_break"] },
                ],
    choice =
      hashParts(W.seedHash, "primitive-war-form", id, recipe.head, recipe.binding) %
      variants.length;
  return variants[choice] || primitiveWarFormDeepBase(id, recipe);
};

const equipmentBlueprintDeepBase = equipmentBlueprint;
equipmentBlueprint = function (id, recipe) {
  const head = materialTrait(recipe.head),
    headName = W.definitions.species[recipe.head].name,
    bindingName = W.definitions.species[recipe.binding].name,
    serial = hashParts(W.seedHash, "equipment-blueprint", id, recipe.purpose, recipe.head),
    choose = (items) => items[serial % items.length];
  if (recipe.purpose === "armor")
    return choose(
      head.density > 0.66
        ? [
            {
              form: "overlapping lamellar mantle",
              name: `${headName} scale mantle`,
              capabilities: ["armor", "torso_guard"],
            },
            {
              form: "corded plate carapace",
              name: `${headName} corded carapace`,
              capabilities: ["armor", "torso_guard", "shoulder_guard"],
            },
            {
              form: "articulated shell coat",
              name: `${headName} shell coat`,
              capabilities: ["armor", "torso_guard", "cut_resist"],
            },
          ]
        : [
            {
              form: "woven impact mantle",
              name: `${bindingName} impact mantle`,
              capabilities: ["armor", "torso_guard"],
            },
            {
              form: "quilted fiber jack",
              name: `${bindingName} layered jack`,
              capabilities: ["armor", "blunt_resist"],
            },
            {
              form: "resin-bound scale vest",
              name: `${headName} resin scale vest`,
              capabilities: ["armor", "cut_resist"],
            },
          ],
    );
  if (recipe.purpose === "shield")
    return choose([
      {
        form: "layered deflection disk",
        name: `${headName} round shield`,
        capabilities: ["shield", "armor", "war", "deflect"],
      },
      {
        form: "tall woven body screen",
        name: `${bindingName} tower screen`,
        capabilities: ["shield", "armor", "war", "formation"],
      },
      {
        form: "hide-faced rib shield",
        name: `${headName} rib shield`,
        capabilities: ["shield", "armor", "war", "brace"],
      },
      {
        form: "sacrificial shard buckler",
        name: `${headName} shard buckler`,
        capabilities: ["shield", "war", "parry"],
      },
    ]);
  if (recipe.purpose === "helmet")
    return choose([
      {
        form: "ridged skull cap",
        name: `${headName} ridge helm`,
        capabilities: ["helmet", "armor", "head_guard"],
      },
      {
        form: "cheek-plated war mask",
        name: `${headName} war mask`,
        capabilities: ["helmet", "armor", "face_guard"],
      },
      {
        form: "woven shock hood",
        name: `${bindingName} shock hood`,
        capabilities: ["helmet", "armor", "blunt_resist"],
      },
    ]);
  if (recipe.purpose === "limb_armor")
    return choose([
      {
        form: "splinted arm and shin guards",
        name: `${headName} limb splints`,
        capabilities: ["limb_armor", "armor", "limb_guard"],
      },
      {
        form: "corded joint scales",
        name: `${headName} joint scales`,
        capabilities: ["limb_armor", "armor", "joint_guard"],
      },
      {
        form: "woven bracers and gaiters",
        name: `${bindingName} limb wraps`,
        capabilities: ["limb_armor", "armor", "cut_resist"],
      },
    ]);
  if (recipe.purpose === "carry_liquid")
    return choose([
      {
        form: "sealed flex-vessel bucket",
        name: `${headName} seal-bucket`,
        capabilities: ["carry_liquid", "firefighting", "gather"],
      },
      {
        form: "shouldered skin amphora",
        name: `${bindingName} carry-vessel`,
        capabilities: ["carry_liquid", "transport", "gather"],
      },
      {
        form: "fired shell dipper",
        name: `${headName} shell dipper`,
        capabilities: ["carry_liquid", "firefighting", "measure"],
      },
    ]);
  if (recipe.purpose === "utility")
    return choose([
      {
        form: "bow-drill fire kit",
        name: `${headName} bow-drill`,
        capabilities: ["utility", "firemaking", "craft"],
      },
      {
        form: "bone awl and fiber gauge",
        name: `${headName} stitch kit`,
        capabilities: ["utility", "sew", "repair"],
      },
      {
        form: "weighted plumb cord",
        name: `${headName} builder's plumb`,
        capabilities: ["utility", "measure", "build"],
      },
      {
        form: "resin scraper and burnisher",
        name: `${headName} finishing kit`,
        capabilities: ["utility", "craft", "repair"],
      },
    ]);
  return equipmentBlueprintDeepBase(id, recipe);
};

function ordinaryToolBlueprint(id, recipe) {
  const material = materialTrait(recipe.head),
    headName = W.definitions.species[recipe.head].name,
    bindingName = W.definitions.species[recipe.binding].name,
    choose = (items) =>
      items[hashParts(W.seedHash, "ordinary-tool", id, recipe.purpose, recipe.head) % items.length];
  if (recipe.purpose === "cut")
    return choose([
      {
        form: "serrated harvest sickle",
        name: `${headName} tooth sickle`,
        capabilities: ["cut", "harvest"],
      },
      {
        form: "drawknife and bark peeler",
        name: `${headName} drawknife`,
        capabilities: ["cut", "shape"],
      },
      { form: "backed flake saw", name: `${headName} flake saw`, capabilities: ["cut", "saw"] },
      { form: "adze-hook cutter", name: `${headName} hooked adze`, capabilities: ["cut", "build"] },
    ]);
  if (recipe.purpose === "mine")
    return choose([
      {
        form: "socketed stone pick",
        name: `${headName} socket pick`,
        capabilities: ["mine", "pierce", "build"],
      },
      {
        form: "wedge and striker set",
        name: `${headName} splitting set`,
        capabilities: ["mine", "split"],
      },
      {
        form: "antler pressure pick",
        name: `${headName} pressure pick`,
        capabilities: ["mine", "gather"],
      },
      {
        form: "two-faced quarry hammer",
        name: `${headName} quarry hammer`,
        capabilities: ["mine", "crush", "build"],
      },
    ]);
  if (recipe.purpose === "build")
    return choose([
      {
        form: "corded assembly maul",
        name: `${headName} assembly maul`,
        capabilities: ["build", "crush"],
      },
      {
        form: "notching chisel",
        name: `${headName} notch chisel`,
        capabilities: ["build", "cut", "shape"],
      },
      {
        form: "lever and tamping bar",
        name: `${headName} setting bar`,
        capabilities: ["build", "lever"],
      },
    ]);
  if (recipe.purpose === "gather")
    return choose([
      {
        form: "woven collection rake",
        name: `${bindingName} gathering rake`,
        capabilities: ["gather", "harvest"],
      },
      {
        form: "shell scoop and sieve",
        name: `${headName} sorting scoop`,
        capabilities: ["gather", "sort"],
      },
    ]);
  return null;
}

function artifactFunctionalProfile(artifact, recipe) {
  const material = materialTrait(recipe.head),
    capabilities = artifact.tool.capabilities,
    slot = capabilities.includes("helmet")
      ? "head"
      : capabilities.includes("limb_armor")
        ? "limbs"
        : capabilities.includes("shield")
          ? "off-hand"
          : capabilities.includes("armor")
            ? "torso"
            : capabilities.includes("war")
              ? "main hand"
              : "tool hand",
    damageType = capabilities.includes("firearm")
      ? "ballistic"
      : capabilities.includes("pierce")
        ? "piercing"
        : capabilities.includes("cut")
          ? "cutting"
          : capabilities.includes("crush")
            ? "blunt"
            : "utility";
  return {
    slot,
    damageType,
    reach: capabilities.includes("firearm")
      ? 8
      : capabilities.includes("crossbow")
        ? 7
        : capabilities.includes("bow")
          ? 7
          : capabilities.includes("ranged")
            ? 6
            : capabilities.includes("reach")
              ? 2.4
              : 1,
    coverage: capabilities.includes("helmet")
      ? 0.18
      : capabilities.includes("limb_armor")
        ? 0.34
        : capabilities.includes("armor")
          ? 0.55
          : capabilities.includes("shield")
            ? 0.42
            : 0,
    absorption: +(material.hardness * (1 - material.brittleness * 0.45)).toFixed(3),
    handling: +clamp(1.25 - material.density * 0.55, 0.45, 1.15).toFixed(3),
    novelty: `${artifact.tool.form}; ${capabilities.join(", ")}`,
  };
}

const createPersonalToolDeepBase = createPersonalTool;
createPersonalTool = function (id, recipe) {
  const artifact = createPersonalToolDeepBase(id, recipe);
  if (!artifact) return artifact;
  const ordinary = ordinaryToolBlueprint(id, recipe);
  if (ordinary && !EQUIPMENT_PURPOSES.has(recipe.purpose) && recipe.purpose !== "war") {
    artifact.tool.form = ordinary.form;
    artifact.tool.capabilities = ordinary.capabilities;
    artifact.name = ordinary.name;
    W.components.identity[artifact.entityId].generatedName = artifact.name;
    W.components.identity[artifact.entityId].titles = [titleCase(ordinary.form)];
  }
  artifact.tool.profile = artifactFunctionalProfile(artifact, recipe);
  artifact.tool.generation = "primitive functional morphology";
  return artifact;
};

equipmentProtection = function (id) {
  let protection = 0;
  for (const entityId of W.components.inventory[id]?.artifactIds || []) {
    const artifact = W.artifacts.find((candidate) => candidate.entityId === entityId);
    if (!isFunctionalTool(artifact)) continue;
    const capabilities = artifact.tool.capabilities || [],
      wear = 1 - artifact.tool.wear / Math.max(1, artifact.tool.durability),
      legacyWeight = capabilities.includes("helmet")
        ? 0.13
        : capabilities.includes("limb_armor")
          ? 0.2
          : capabilities.includes("armor")
            ? 0.34
            : capabilities.includes("shield")
              ? 0.23
              : 0,
      profile = artifact.tool.profile,
      profileWeight = profile?.coverage ? profile.coverage * profile.absorption * 0.44 : 0;
    protection += artifact.quality * wear * Math.max(legacyWeight, profileWeight);
  }
  return protection;
};

const ensurePrimitiveEquipmentDeepBase = ensurePrimitiveEquipment;
ensurePrimitiveEquipment = function () {
  ensurePrimitiveEquipmentDeepBase();
  if (W.tick % 64) return;
  for (const unit of W.militaryUnits || []) {
    if (!unit.active) continue;
    for (const id of unit.memberIds.filter(classifyAlive).slice(0, 6)) {
      const work = workState(id);
      if (work.task === "craft") continue;
      const missing = ["helmet", "limb_armor"].find((purpose) => !toolForPurpose(id, purpose));
      if (!missing) continue;
      const recipe = toolRecipeFromInventory(id, missing) || supplyEquipmentMaterials(id, missing);
      if (recipe) beginOrAdvanceCraft(id, missing);
    }
  }
  const artisan = W.activeIds
    .filter((id) => {
      if (
        W.kind[id] !== KINDS.PERSON ||
        !classifyAlive(id) ||
        toolForPurpose(id, "utility") ||
        !["builder", "artisan", "researcher"].includes(workSpecialization(id))
      )
        return false;
      const place = nearestFriendlyPlace(id);
      return !!place && completedBuildings(place, "workshop").length > 0;
    })
    .sort((left, right) => left - right)[0];
  if (artisan) {
    const recipe =
      toolRecipeFromInventory(artisan, "utility") || supplyEquipmentMaterials(artisan, "utility");
    if (recipe) beginOrAdvanceCraft(artisan, "utility");
  }
};

const organismInspectorDeepEquipmentBase = organismInspector;
organismInspector = function (id) {
  let html = organismInspectorDeepEquipmentBase(id);
  if (W.kind[id] !== KINDS.PERSON) return html;
  const gear = (W.components.inventory[id]?.artifactIds || [])
    .map((entityId) => W.artifacts.find((artifact) => artifact.entityId === entityId))
    .filter((artifact) => isFunctionalTool(artifact) && artifact.tool.profile);
  if (!gear.length) return html;
  html += `<details><summary>Primitive loadout engineering · ${gear.length}</summary>${gear
    .map((artifact) => {
      const profile = artifact.tool.profile,
        condition = Math.round(
          (1 - artifact.tool.wear / Math.max(1, artifact.tool.durability)) * 100,
        );
      return `<div class="card" style="margin:6px 0"><div class="row between"><b>${esc(artifact.name)}</b><span class="tag">${esc(profile.slot)} · ${condition}%</span></div><div class="kv" style="margin-top:6px"><span>Form</span><b>${esc(artifact.tool.form)}</b><span>Functions</span><b>${esc(artifact.tool.capabilities.join(" · "))}</b><span>Damage / work mode</span><b>${esc(profile.damageType)}</b><span>Reach</span><b>${profile.reach} tiles</b><span>Coverage / absorption</span><b>${Math.round(profile.coverage * 100)}% / ${Math.round(profile.absorption * 100)}%</b><span>Handling</span><b>${Math.round(profile.handling * 100)}%</b></div></div>`;
    })
    .join("")}</details>`;
  return html;
};

const simTickPhysicalBuildingsBase = simTick;
simTick = function () {
  simTickPhysicalBuildingsBase();
  if (!W) return;
  if (W.tick % 64 === 0) {
    reconcileBuildingOccupancy();
    rebuildSpatialBins();
  }
};

const nonLifeInspectorDeepEquipmentBase = nonLifeInspector;
nonLifeInspector = function (id) {
  const html = nonLifeInspectorDeepEquipmentBase(id),
    artifact = W.artifacts.find((candidate) => candidate.entityId === id),
    profile = artifact?.tool?.profile;
  if (!profile) return html;
  return (
    html +
    `<div class="subhead">Primitive engineering profile</div><div class="card"><div class="kv"><span>Equipment slot</span><b>${esc(profile.slot)}</b><span>Functional morphology</span><b>${esc(artifact.tool.form)}</b><span>Work / damage mode</span><b>${esc(profile.damageType)}</b><span>Reach</span><b>${profile.reach} tiles</b><span>Coverage</span><b>${Math.round(profile.coverage * 100)}%</b><span>Material absorption</span><b>${Math.round(profile.absorption * 100)}%</b><span>Handling</span><b>${Math.round(profile.handling * 100)}%</b></div></div>`
  );
};

window.ALIFE_PROTECTION_STRATEGY_DEBUG = Object.freeze({
  protectedBuilding: protectedBuildingForPerson,
  enclosureBlocks: enclosureBlocksPredator,
  attackPlan: (warId) => {
    const war = W.activeWars.find((candidate) => candidate.id === warId);
    if (!war) return null;
    const plan = ensureAttackPlan(war);
    return plan ? { ...plan, readiness: campaignReadiness(war, plan) } : null;
  },
  warfareHtml: () => {
    refreshWarfare();
    return DOM.warfarePane?.innerHTML || "";
  },
  farmTiles: (buildingId) => {
    const building = W.buildings.find((candidate) => candidate.id === buildingId);
    return building?.type === "farm" ? farmTiles(building) : [];
  },
});

const eventSentenceCollapseBase = eventSentence;
eventSentence = function (e) {
  if (e.type === "BurialEvent") {
    const names = e.subjects.map(entityName);
    return `${names[0] || "A villager"} laid ${names[1] || "one of the dead"} to rest in the grave field.`;
  }
  if (e.type === "SettlementDestroyedEvent" && e.data?.yearsStood != null)
    return `${e.data.name} fell after ${e.data.yearsStood} year${e.data.yearsStood === 1 ? "" : "s"} — ${e.evidence[0]}; ${e.data.crafts ? `${e.data.crafts} craft${e.data.crafts === 1 ? "" : "s"} pass into ruin and memory` : "no lasting craft survived it"}.`;
  if (e.type === "FactionCollapsedEvent")
    return `The ${e.data?.name || "fallen"} civilization passed into history with the fall of ${e.data?.lastSettlement || "its last settlement"}.`;
  return eventSentenceCollapseBase(e);
};
