// ================================================================
// 42C. EMBODIED INJURY, PRIMITIVE EQUIPMENT, FIRE RESPONSE, AND MOBILITY
// ================================================================
// Limbs, carried solvent, tools, boats, and military movement all remain part
// of the same conserved world state and causal event graph.

const PERSON_ANATOMY = Object.freeze([
    ["head", "core", 34],
    ["neck", "core", 22],
    ["torso", "core", 72],
    ["left arm", "manipulator", 38],
    ["right arm", "manipulator", 38],
    ["left hand", "manipulator", 22],
    ["right hand", "manipulator", 22],
    ["left leg", "locomotor", 46],
    ["right leg", "locomotor", 46],
  ]),
  EQUIPMENT_PURPOSES = new Set(["carry_liquid", "armor", "shield", "watercraft"]);

function ensureEmbodiedAnatomy(id, suppliedModel = null) {
  const life = W?.components.life?.[id];
  if (!life) return null;
  if (life.anatomy?.parts) return life.anatomy;
  const model = suppliedModel || creatureModel(id),
    definitions =
      W.kind[id] === KINDS.PERSON
        ? PERSON_ANATOMY
        : [
            ["head", "core", 30],
            ["torso", "core", 62],
            ...Array.from({ length: Math.max(2, model?.appendages || 2) }, (_, n) => [
              `appendage ${n + 1}`,
              n % 2 || model?.topology === "floater" ? "manipulator" : "locomotor",
              30 + (n % 3) * 6,
            ]),
          ],
    parts = {};
  for (const [name, role, maximum] of definitions)
    parts[name] = {
      name,
      role,
      integrity: maximum,
      maxIntegrity: maximum,
      disabled: false,
      severed: false,
      lostTick: 0,
      causeEvent: 0,
      attackerId: 0,
    };
  life.anatomy = {
    topology: model?.topology || "bilateral",
    originalAppendages: Math.max(2, model?.appendages || 2),
    parts,
    lostParts: [],
  };
  return life.anatomy;
}

function anatomyPartCandidates(id, genericPart) {
  const anatomy = ensureEmbodiedAnatomy(id),
    available = Object.values(anatomy?.parts || {}).filter((part) => !part.severed),
    generic = String(genericPart || "torso").toLowerCase();
  if (generic.includes("arm")) return available.filter((part) => part.name.includes("arm"));
  if (generic.includes("hand")) return available.filter((part) => part.name.includes("hand"));
  if (generic.includes("leg")) return available.filter((part) => part.name.includes("leg"));
  if (generic.includes("neck"))
    return available.filter((part) => part.name === "neck" || part.name === "head");
  if (generic.includes("head")) return available.filter((part) => part.name === "head");
  if (generic.includes("torso")) return available.filter((part) => part.name === "torso");
  if (generic.includes("appendage") || generic.includes("limb"))
    return available.filter((part) => part.role !== "core");
  return available.filter((part) => part.name === generic || part.role === "core");
}

function selectEmbodiedBodyPart(id, genericPart, serial = 0, attackerId = 0) {
  const candidates = anatomyPartCandidates(id, genericPart);
  if (!candidates.length) return genericPart || "torso";
  const index =
    hashParts(W.seedHash, "specific-body-part", serial, id, attackerId) % candidates.length;
  return candidates[index].name;
}

function embodiedCapability(id) {
  const anatomy = ensureEmbodiedAnatomy(id),
    parts = Object.values(anatomy?.parts || {}),
    ratio = (role) => {
      const selected = parts.filter((part) => part.role === role);
      if (!selected.length) return 1;
      return mean(
        selected.map((part) =>
          part.severed
            ? 0
            : part.disabled
              ? 0.18
              : clamp(part.integrity / part.maxIntegrity, 0.2, 1),
        ),
      );
    },
    manipulation = ratio("manipulator"),
    locomotion = ratio("locomotor"),
    head = anatomy?.parts.head,
    core = parts.filter((part) => part.role === "core");
  return {
    manipulation,
    locomotion,
    perception: head?.severed ? 0 : head?.disabled ? 0.2 : 1,
    core: core.length
      ? mean(
          core.map((part) => (part.severed ? 0 : clamp(part.integrity / part.maxIntegrity, 0, 1))),
        )
      : 1,
    lost: parts.filter((part) => part.severed).map((part) => part.name),
    disabled: parts.filter((part) => part.disabled && !part.severed).map((part) => part.name),
  };
}

function transferSeveredMatter(id, tile, severity) {
  const q = W.components.chemistry[id]?.q,
    composition = {};
  if (!q || tile < 0) return composition;
  const requested = [
    [C.ORGANIC, 2 + Math.ceil(severity * 3)],
    [C.FIBER, 1 + Math.floor(severity * 2)],
    [C.BONE, 1 + Math.floor(severity * 2)],
    [C.MEMBRANE, 1],
    [C.BLOOD, 1 + Math.floor(severity * 3)],
  ];
  for (const [species, amount] of requested) {
    const moved = Math.min(q[species] || 0, amount);
    if (!moved) continue;
    q[species] -= moved;
    setTileMatterAmount(tile, species, tileMatterAmount(tile, species) + moved);
    composition[species] = moved;
  }
  return composition;
}

function applyEmbodiedInjury(
  victimId,
  partName,
  woundType,
  damage,
  severity,
  critical,
  attackerId,
  causeEvent,
  options = {},
) {
  const anatomy = ensureEmbodiedAnatomy(victimId),
    part = anatomy?.parts?.[partName] || anatomy?.parts?.torso;
  if (!part || part.severed) return { part: partName, severed: false, disabled: true, eventId: 0 };
  const trauma = Math.max(1, damage * (critical ? 1.25 : 0.82));
  part.integrity = Math.max(0, part.integrity - trauma);
  part.disabled = part.integrity / part.maxIntegrity < 0.34;
  const severingWound = /laceration|slash|tearing|puncture|projectile|ballistic|bite|impale/i.test(
      woundType,
    ),
    severable = part.role !== "core" || part.name === "head",
    threshold = part.role === "manipulator" ? 0.62 : part.role === "locomotor" ? 0.7 : 0.86,
    severed =
      severable &&
      (options.forceDismember ||
        (severingWound &&
          severity >= threshold &&
          (part.integrity <= 0 || critical) &&
          counterRand("dismemberment", causeEvent || W.tick, victimId, attackerId) <
            clamp(0.16 + severity * 0.58 + (critical ? 0.18 : 0), 0, 0.88)));
  if (!severed) return { part: part.name, severed: false, disabled: part.disabled, eventId: 0 };
  part.severed = true;
  part.disabled = true;
  part.integrity = 0;
  part.lostTick = W.tick;
  part.causeEvent = causeEvent;
  part.attackerId = attackerId;
  anatomy.lostParts.push(part.name);
  const position = W.components.position[victimId],
    tile = position ? idx(position.x, position.y) : -1,
    composition = transferSeveredMatter(victimId, tile, severity),
    ev = emitEvent("LimbLostEvent", {
      subjects: [victimId, attackerId].filter(Boolean),
      location: tile,
      factions: attackerId ? combatFactions(attackerId, victimId) : [],
      causes: [causeEvent],
      evidence: [
        `${woundType} reduced ${part.name} integrity to zero after ${damage} body damage`,
        `${Object.values(composition).reduce((total, amount) => total + amount, 0)} conserved tissue mass entered the local substrate`,
        `${part.role} capability now reflects the missing body part`,
      ],
      magnitude: damage,
      importance: part.name === "head" ? 5 : 3,
      data: {
        part: part.name,
        role: part.role,
        wound: woundType,
        composition,
        critical: !!critical,
      },
    });
  part.causeEvent = ev.id;
  W.severedParts = (W.severedParts || []).concat({
    id: `${victimId}:${part.name}:${ev.id}`,
    victimId,
    attackerId,
    part: part.name,
    role: part.role,
    tile,
    tick: W.tick,
    eventId: ev.id,
    composition,
    hue: bloodVisualHue(victimId),
  });
  if (W.severedParts.length > 180) W.severedParts.splice(0, W.severedParts.length - 180);
  const life = W.components.life[victimId];
  life.pain = clamp((life.pain || 0) + 24 + severity * 35, 0, 100);
  life.trauma = clamp((life.trauma || 0) + 18 + severity * 28, 0, 100);
  life.wounded = true;
  if (part.name === "head") {
    life.integrity = 0;
    W.components.body[victimId].integrity = 0;
  }
  setEmotionImpulse(
    victimId,
    { fear: 0.5, sadness: 0.35, anger: attackerId ? 0.24 : 0 },
    ev.id,
    "🩸",
  );
  return { part: part.name, severed: true, disabled: true, eventId: ev.id, composition };
}

function embodiedVisualModel(id, model) {
  const life = W?.components.life?.[id];
  if (!life || !model) return model;
  const anatomy = ensureEmbodiedAnatomy(id, model),
    lost = Object.values(anatomy.parts).filter(
      (part) => part.severed && part.role !== "core",
    ).length;
  if (!lost) return model;
  return { ...model, appendages: Math.max(0, model.appendages - lost), lostAppendages: lost };
}

function drawLostLimbStumps(g, id, model, detail, colors) {
  const lost = embodiedCapability(id).lost;
  if (!lost.length || detail < 1) return;
  g.save();
  g.fillStyle = hsl(bloodVisualHue(id), 82, 30, 0.94);
  g.strokeStyle = colors.outline;
  g.lineWidth = 0.055;
  for (let n = 0; n < Math.min(4, lost.length); n++) {
    const side = n % 2 ? 1 : -1,
      y = n < 2 ? 0.31 * side : 0.18 * side,
      x = n < 2 ? 0.12 : -0.38;
    g.beginPath();
    g.arc(x, y, 0.105, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
}

function drawSeveredBodyParts(g, now, bounds, metrics) {
  for (const part of W.severedParts || []) {
    if (part.tile < 0 || W.tick - part.tick > 2048) continue;
    const [x, y] = xy(part.tile);
    if (x < bounds.x0 - 2 || x > bounds.x1 + 2 || y < bounds.y0 - 2 || y > bounds.y1 + 2) continue;
    const screen = proceduralProjectTile(x + 0.5, y + 0.5, metrics),
      size = clamp(metrics.tw * 0.11, 2.5, 14),
      rotation = visualHash01(part.eventId, 0x51) * Math.PI * 2;
    g.save();
    g.translate(screen.x + (visualHash01(part.eventId, 3) - 0.5) * size, screen.y + size * 0.28);
    g.rotate(rotation);
    g.fillStyle = hsl(part.hue, 72, 28, 0.82);
    g.strokeStyle = hsl(part.hue, 84, 52, 0.72);
    g.lineWidth = Math.max(1, size * 0.12);
    g.beginPath();
    if (g.roundRect) g.roundRect(-size * 0.65, -size * 0.24, size * 1.3, size * 0.48, size * 0.2);
    else g.rect(-size * 0.65, -size * 0.24, size * 1.3, size * 0.48);
    g.fill();
    g.stroke();
    g.fillStyle = "#ded6bd";
    g.fillRect(size * 0.42, -size * 0.08, size * 0.32, size * 0.16);
    g.restore();
    if (UI.camera.zoom > 7 && UI.labels) {
      g.fillStyle = "#ffd8d2";
      g.font = "800 9px system-ui";
      g.textAlign = "center";
      g.fillText(part.part, screen.x, screen.y - size * 0.8);
    }
  }
}

const performHuntAnatomyBase = performHunt;
performHunt = function (id, prey) {
  const eligible = prey
      .filter((target) => W.components.position[target] && classifyAlive(target))
      .sort(
        (left, right) => huntTargetScore(id, left) - huntTargetScore(id, right) || left - right,
      ),
    target = eligible[0],
    beforeIntegrity = target ? W.components.life[target]?.integrity || 0 : 0,
    result = performHuntAnatomyBase(id, prey);
  if (!result || !target || !W.components.life[target]) return result;
  const damage = Math.max(0, beforeIntegrity - (W.components.life[target].integrity || 0)),
    event = W.events.findLast(
      (candidate) =>
        candidate.type === "PredationEvent" &&
        candidate.subjects[0] === id &&
        candidate.subjects[1] === target,
    );
  if (!damage || !event) return result;
  const generic = ["limb", "torso", "limb", "neck"][
      hashParts(W.seedHash, "predation-part", event.id, id, target) % 4
    ],
    part = selectEmbodiedBodyPart(target, generic, event.id, id),
    lethal = W.kind[target] === KINDS.CORPSE,
    trauma = applyEmbodiedInjury(
      target,
      part,
      event.data?.learnedBottleneckResponse ? "grappling bite" : "bite and tearing trauma",
      damage,
      clamp(damage / 52 + (lethal ? 0.35 : 0), 0.08, 1),
      lethal || damage > 42,
      id,
      event.id,
      { forceDismember: lethal && counterRand("predation-dismember", event.id, id, target) < 0.42 },
    );
  event.data.bodyPart = part;
  event.data.limbLostEventId = trauma.eventId;
  const visual = UI.combatVisuals?.at(-1);
  if (visual?.eventId === event.id) {
    visual.bodyPart = part;
    visual.severedPart = trauma.severed ? part : "";
    visual.bloodAmount = (visual.bloodAmount || 0) + (trauma.severed ? 10 : 2);
  }
  return result;
};

function hasNavigableWatercraft(id) {
  if (W?.kind[id] !== KINDS.PERSON) return false;
  const carried = (W.components.inventory[id]?.artifactIds || [])
    .map((entityId) => W.artifacts.find((artifact) => artifact.entityId === entityId))
    .some((artifact) => isFunctionalTool(artifact, "watercraft"));
  if (carried) return true;
  const factionId = W.components.social[id]?.factionId || 0;
  return !!(factionId && factionHasTech(factionId, "navigation"));
}

const organismHabitatStressWatercraftBase = organismHabitatStress;
organismHabitatStress = function (id, tile) {
  const base = organismHabitatStressWatercraftBase(id, tile);
  if (!hasNavigableWatercraft(id) || W.tiles.liquid[tile] <= 420) return base;
  const floodPenalty = Math.max(0, W.tiles.liquid[tile] - 780) / 18;
  return Math.max(0, base - floodPenalty) + Math.min(2.5, W.tiles.fire[tile] / 300);
};

const moveWorkerTowardAnatomyBase = moveWorkerToward;
moveWorkerToward = function (id, tile, task, phase, material = -1, buildingId = 0, toolId = 0) {
  const capability = embodiedCapability(id);
  if (capability.locomotion < 0.12) {
    setWorkAction(
      id,
      task,
      `unable to move: locomotor anatomy is disabled`,
      tile,
      material,
      buildingId,
      toolId,
    );
    return false;
  }
  const delay = capability.locomotion < 0.42 ? 3 : capability.locomotion < 0.72 ? 2 : 1;
  if ((W.tick + id) % delay) {
    setWorkAction(
      id,
      task,
      `moving slowly with ${Math.round(capability.locomotion * 100)}% locomotor capacity · ${phase}`,
      tile,
      material,
      buildingId,
      toolId,
    );
    return true;
  }
  const result = moveWorkerTowardAnatomyBase(id, tile, task, phase, material, buildingId, toolId);
  const p = W.components.position[id];
  if (result && p && W.tiles.liquid[idx(p.x, p.y)] > 420 && hasNavigableWatercraft(id))
    setWorkAction(
      id,
      "sail",
      `navigating deep water toward ${locationName(tile)}`,
      tile,
      material,
      buildingId,
      toolId,
    );
  return result;
};

function equipmentProtection(id) {
  let protection = 0;
  for (const entityId of W.components.inventory[id]?.artifactIds || []) {
    const artifact = W.artifacts.find((candidate) => candidate.entityId === entityId);
    if (!isFunctionalTool(artifact)) continue;
    const capabilities = artifact.tool.capabilities,
      wear = 1 - artifact.tool.wear / Math.max(1, artifact.tool.durability);
    if (capabilities.includes("armor")) protection += artifact.quality * wear * 0.34;
    if (capabilities.includes("shield")) protection += artifact.quality * wear * 0.23;
    if (capabilities.includes("helmet")) protection += artifact.quality * wear * 0.13;
  }
  return protection;
}

function primitiveWarForm(id, recipe) {
  const material = materialTrait(recipe.head),
    factionId = W.components.social[id]?.factionId || 0,
    tier = warToolTier(id);
  if (tier >= 3)
    return { form: "thunder-seed projector", capabilities: ["war", "ranged", "powder", "pierce"] };
  if (tier >= 2)
    return material.brittleness < 0.62
      ? { form: "sinew tension caster", capabilities: ["war", "ranged", "pierce"] }
      : { form: "torsion shard sling", capabilities: ["war", "ranged", "crush"] };
  if (recipe.head === C.BONE)
    return { form: "barbed bone reach-spear", capabilities: ["war", "cut", "pierce", "reach"] };
  if (material.density > 0.82)
    return { form: "gravity-knot maul", capabilities: ["war", "crush", "shield_break"] };
  if (material.hardness > 0.82 && material.brittleness > 0.58)
    return { form: "flaked crescent edge", capabilities: ["war", "cut", "pierce"] };
  if (factionId && factionHasTech(factionId, "navigation"))
    return { form: "weighted cord sling", capabilities: ["war", "ranged", "crush"] };
  return { form: "hooked thrusting staff", capabilities: ["war", "cut", "reach"] };
}

function equipmentBlueprint(id, recipe) {
  const head = materialTrait(recipe.head),
    headName = W.definitions.species[recipe.head].name,
    bindingName = W.definitions.species[recipe.binding].name;
  if (recipe.purpose === "carry_liquid")
    return {
      form: head.brittleness < 0.5 ? "sealed flex-vessel bucket" : "fired shell bucket",
      name: `${headName} and ${bindingName} seal-bucket`,
      capabilities: ["carry_liquid", "firefighting", "gather"],
    };
  if (recipe.purpose === "armor")
    return head.density > 0.7
      ? {
          form: "overlapping gravity scales",
          name: `${headName} lamellar mantle`,
          capabilities: ["armor", "helmet"],
        }
      : {
          form: "woven impact mantle",
          name: `${bindingName} impact mantle`,
          capabilities: ["armor"],
        };
  if (recipe.purpose === "shield")
    return {
      form: head.brittleness > 0.7 ? "sacrificial shard screen" : "layered deflection disk",
      name: `${headName} deflection shield`,
      capabilities: ["shield", "armor", "war"],
    };
  if (recipe.purpose === "watercraft")
    return {
      form: "buoyant rib-and-skin vessel",
      name: `${headName} ribbed deep-water craft`,
      capabilities: ["watercraft", "carry_liquid", "transport"],
    };
  return primitiveWarForm(id, recipe);
}

const createPersonalToolEquipmentBase = createPersonalTool;
createPersonalTool = function (id, recipe) {
  const extra =
      recipe.purpose === "watercraft"
        ? 6
        : recipe.purpose === "armor"
          ? 2
          : recipe.purpose === "shield"
            ? 1
            : 0,
    inventory = W.components.inventory[id]?.materials;
  if (!inventory || inventory[recipe.head] < 2 + extra || inventory[recipe.binding] < 2 + extra)
    return null;
  const artifact = EQUIPMENT_PURPOSES.has(recipe.purpose)
    ? createPersonalToolUniqueBase(id, recipe)
    : createPersonalToolEquipmentBase(id, recipe);
  if (!artifact || (recipe.purpose !== "war" && !EQUIPMENT_PURPOSES.has(recipe.purpose)))
    return artifact;
  if (extra) {
    inventory[recipe.head] -= extra;
    inventory[recipe.binding] -= extra;
    artifact.composition[recipe.head] += extra;
    artifact.composition[recipe.binding] += extra;
  }
  const blueprint = equipmentBlueprint(id, recipe),
    originalEvent = artifact.eventIds.at(-1);
  artifact.tool.form = blueprint.form;
  artifact.tool.purpose = recipe.purpose;
  artifact.tool.capabilities = blueprint.capabilities;
  artifact.name = blueprint.name || `${W.definitions.species[recipe.head].name} ${blueprint.form}`;
  W.components.identity[artifact.entityId].generatedName = artifact.name;
  W.components.identity[artifact.entityId].titles = [titleCase(blueprint.form)];
  if (EQUIPMENT_PURPOSES.has(recipe.purpose)) {
    const eventType =
        recipe.purpose === "watercraft" ? "WatercraftLaunchedEvent" : "EquipmentCraftedEvent",
      p = W.components.position[id],
      ev = emitEvent(eventType, {
        subjects: [id, artifact.entityId],
        location: p ? idx(p.x, p.y) : artifact.lastTile,
        causes: [originalEvent],
        evidence: [
          `${artifact.name} contains ${chemistryRowsInline(artifact.composition)}`,
          `its real-world analogue is ${recipe.purpose === "carry_liquid" ? "a bucket or skin vessel" : recipe.purpose === "watercraft" ? "a raft or boat" : recipe.purpose === "shield" ? "a shield" : "body armor"}`,
          `functional capabilities: ${blueprint.capabilities.join(", ")}`,
        ],
        importance: recipe.purpose === "watercraft" ? 3 : 2,
        data: {
          name: artifact.name,
          purpose: recipe.purpose,
          capabilities: blueprint.capabilities,
        },
      });
    artifact.eventIds.push(ev.id);
  }
  return artifact;
};

const combatEquipmentQualityAnatomyBase = combatEquipmentQuality;
combatEquipmentQuality = function (id) {
  const base = combatEquipmentQualityAnatomyBase(id),
    capability = embodiedCapability(id),
    protection = equipmentProtection(id);
  return base * clamp(0.18 + capability.manipulation * 0.82, 0.12, 1) + protection * 0.42;
};

function supplyEquipmentMaterials(id, purpose) {
  const inventory = W.components.inventory[id]?.materials,
    place = nearestFriendlyPlace(id);
  if (!inventory || !place) return null;
  const rigid = [C.CERAMIC, C.METAL, C.CRYSTAL, C.MINERAL, C.ORE, C.BONE]
      .filter((species) => (place.inventory[species] || 0) >= 2)
      .sort(
        (left, right) =>
          materialTrait(right).hardness - materialTrait(left).hardness || left - right,
      )[0],
    flexible = [C.FIBER, C.MEMBRANE, C.ORGANIC]
      .filter((species) => (place.inventory[species] || 0) >= 2)
      .sort(
        (left, right) =>
          (place.inventory[right] || 0) - (place.inventory[left] || 0) || left - right,
      )[0];
  if (rigid === undefined || flexible === undefined) return null;
  const extra =
      purpose === "watercraft" ? 6 : purpose === "armor" ? 2 : purpose === "shield" ? 1 : 0,
    amount = 2 + extra;
  if (
    place.inventory[rigid] < amount ||
    place.inventory[flexible] < amount ||
    inventory[rigid] > 65535 - amount ||
    inventory[flexible] > 65535 - amount
  )
    return null;
  place.inventory[rigid] -= amount;
  place.inventory[flexible] -= amount;
  inventory[rigid] += amount;
  inventory[flexible] += amount;
  return { head: rigid, binding: flexible, purpose };
}

function bucketForPerson(id) {
  return toolForPurpose(id, "carry_liquid") || toolForPurpose(id, "firefighting");
}

function nearestProtectedFire(id, radius = 14) {
  const p = W.components.position[id];
  if (!p) return -1;
  const candidates = [];
  for (let y = Math.max(0, p.y - radius); y <= Math.min(W.height - 1, p.y + radius); y++)
    for (let x = Math.max(0, p.x - radius); x <= Math.min(W.width - 1, p.x + radius); x++) {
      const tile = idx(x, y),
        fire = W.tiles.fire[tile];
      if (fire < 55) continue;
      const protectedPlace = settlementNear(tile, 7) || campNear(tile, 7),
        structure = W.tiles.structureOrder[tile] + W.tiles.habitation[tile];
      if (!protectedPlace && structure < 100) continue;
      candidates.push({
        tile,
        score: fire * 2 + structure * 0.15 - Math.sqrt(dist2(p.x, p.y, x, y)) * 18,
      });
    }
  return (
    candidates.sort((left, right) => right.score - left.score || left.tile - right.tile)[0]?.tile ??
    -1
  );
}

function nearestSolventSource(id, radius = 10) {
  const p = W.components.position[id],
    candidates = [];
  for (let y = Math.max(0, p.y - radius); y <= Math.min(W.height - 1, p.y + radius); y++)
    for (let x = Math.max(0, p.x - radius); x <= Math.min(W.width - 1, p.x + radius); x++) {
      const tile = idx(x, y),
        solvent = tileMatterAmount(tile, C.SOLVENT);
      if (solvent < 12) continue;
      candidates.push({ tile, score: solvent - Math.sqrt(dist2(p.x, p.y, x, y)) * 8 });
    }
  return (
    candidates.sort((left, right) => right.score - left.score || left.tile - right.tile)[0]?.tile ??
    -1
  );
}

function fillFireBucket(id, bucket, fireTile) {
  const p = W.components.position[id],
    inventory = W.components.inventory[id].materials,
    place = nearestFriendlyPlace(id),
    capacity = Math.max(8, Math.floor(bucket.quality / 5));
  if (inventory[C.SOLVENT] >= capacity) return true;
  if (place && place.inventory[C.SOLVENT] >= 6) {
    if (dist2(p.x, p.y, place.x, place.y) > 2)
      return moveWorkerToward(
        id,
        idx(place.x, place.y),
        "fill_bucket",
        `🪣 moving to ${place.name}'s conserved water store`,
        C.SOLVENT,
        0,
        bucket.entityId,
      );
    const moved = Math.min(capacity - inventory[C.SOLVENT], place.inventory[C.SOLVENT]);
    place.inventory[C.SOLVENT] -= moved;
    inventory[C.SOLVENT] += moved;
    setWorkAction(
      id,
      "fill_bucket",
      `💧 filled ${bucket.name} with ${moved} solvent mass`,
      fireTile,
      C.SOLVENT,
      0,
      bucket.entityId,
    );
    return moved > 0;
  }
  const source = nearestSolventSource(id);
  if (source < 0) return false;
  if (idx(p.x, p.y) !== source)
    return moveWorkerToward(
      id,
      source,
      "fill_bucket",
      `🪣 moving to a physical solvent source`,
      C.SOLVENT,
      0,
      bucket.entityId,
    );
  const available = tileMatterAmount(source, C.SOLVENT),
    moved = Math.min(capacity - inventory[C.SOLVENT], available);
  setTileMatterAmount(source, C.SOLVENT, available - moved);
  inventory[C.SOLVENT] += moved;
  setWorkAction(
    id,
    "fill_bucket",
    `💧 filled ${bucket.name} from ${locationName(source)}`,
    fireTile,
    C.SOLVENT,
    0,
    bucket.entityId,
  );
  return moved > 0;
}

function suppressFireWithBucket(id, fireTile, bucket) {
  const p = W.components.position[id],
    inventory = W.components.inventory[id].materials;
  if (dist2(p.x, p.y, ...xy(fireTile)) > 2)
    return moveWorkerToward(
      id,
      fireTile,
      "firefight",
      `🪣 carrying solvent toward the active fire`,
      C.SOLVENT,
      0,
      bucket.entityId,
    );
  const water = Math.min(
    inventory[C.SOLVENT],
    Math.max(4, Math.ceil(W.tiles.fire[fireTile] / 55)),
    65535 - tileMatterAmount(fireTile, C.SOLVENT),
  );
  if (!water) return false;
  const before = W.tiles.fire[fireTile],
    quenched = Math.min(before, water * (16 + Math.floor(bucket.quality / 18)));
  inventory[C.SOLVENT] -= water;
  setTileMatterAmount(fireTile, C.SOLVENT, tileMatterAmount(fireTile, C.SOLVENT) + water);
  W.tiles.fire[fireTile] = u16(before - quenched);
  W.tiles.temperature[fireTile] = i16(W.tiles.temperature[fireTile] - Math.min(80, water * 3));
  W.conservation.dissipatedEnergy += quenched;
  W.conservation.thermalEnergy = Math.max(0, (W.conservation.thermalEnergy || 0) - quenched);
  bucket.tool.wear = Math.min(bucket.tool.durability, bucket.tool.wear + 1);
  const ignition = W.events.findLast(
      (event) => event.type === "FireStartedEvent" && event.location === fireTile,
    ),
    ev = emitEvent("FireSuppressedEvent", {
      subjects: [id, bucket.entityId],
      location: fireTile,
      causes: [ignition?.id, bucket.eventIds.at(-1)],
      evidence: [
        `${entityName(id)} carried ${water} conserved solvent mass in ${bucket.name}`,
        `fire intensity fell from ${before} to ${W.tiles.fire[fireTile]} and ${quenched} thermal energy dissipated`,
        "the solvent now remains on the affected tile rather than disappearing",
      ],
      magnitude: quenched,
      importance: before > 260 ? 3 : 2,
      data: { water, before, after: W.tiles.fire[fireTile], bucket: bucket.name },
    });
  setWorkAction(
    id,
    "firefight",
    `🪣 threw ${water} solvent mass onto the fire`,
    fireTile,
    C.SOLVENT,
    0,
    bucket.entityId,
  );
  setEmotionImpulse(id, { fear: -0.08, contentment: 0.08, resolve: 0.05 }, ev.id, "🪣");
  return true;
}

function performFirefighting(id, fireTile) {
  const life = derivedLife(id),
    capability = embodiedCapability(id);
  if (life.health < 42 || life.thirst > 78 || capability.manipulation < 0.28) return false;
  let bucket = bucketForPerson(id);
  if (!bucket) {
    let recipe =
      toolRecipeFromInventory(id, "carry_liquid") || supplyEquipmentMaterials(id, "carry_liquid");
    if (!recipe) {
      setWorkAction(id, "firefight", "seeking rigid and flexible matter for a bucket", fireTile);
      return false;
    }
    const work = workState(id);
    work.recipe = recipe;
    if (!beginOrAdvanceCraft(id, "carry_liquid")) return false;
    bucket = bucketForPerson(id);
    if (!bucket) return true;
  }
  if (!W.components.inventory[id].materials[C.SOLVENT]) return fillFireBucket(id, bucket, fireTile);
  return suppressFireWithBucket(id, fireTile, bucket);
}

function updateFirefighting() {
  if (W.tick % 4) return;
  const candidates = W.activeIds
      .filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id))
      .map((id) => ({ id, fire: nearestProtectedFire(id) }))
      .filter((entry) => entry.fire >= 0)
      .sort(
        (left, right) => W.tiles.fire[right.fire] - W.tiles.fire[left.fire] || left.id - right.id,
      ),
    assignedByFire = new Map();
  for (const { id, fire } of candidates) {
    const assigned = assignedByFire.get(fire) || 0;
    if (assigned >= 3) continue;
    if (performFirefighting(id, fire)) assignedByFire.set(fire, assigned + 1);
  }
}

function ensurePrimitiveEquipment() {
  if (W.tick % 64) return;
  for (const unit of W.militaryUnits || []) {
    if (!unit.active) continue;
    for (const id of unit.memberIds.filter(classifyAlive).slice(0, 8)) {
      const purposes = ["war", "shield", "armor"],
        missing = purposes.find((purpose) => !toolForPurpose(id, purpose));
      if (!missing) continue;
      const recipe = toolRecipeFromInventory(id, missing) || supplyEquipmentMaterials(id, missing);
      if (recipe) beginOrAdvanceCraft(id, missing);
    }
  }
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const p = W.components.position[id],
      factionId = W.components.social[id]?.factionId || 0;
    if (
      !p ||
      !factionId ||
      !factionHasTech(factionId, "navigation") ||
      toolForPurpose(id, "watercraft")
    )
      continue;
    const nearDeepWater = neighbors4(idx(p.x, p.y)).some((tile) => W.tiles.liquid[tile] > 420);
    if (!nearDeepWater) continue;
    const recipe =
      toolRecipeFromInventory(id, "watercraft") || supplyEquipmentMaterials(id, "watercraft");
    if (recipe) beginOrAdvanceCraft(id, "watercraft");
    break;
  }
}

function militaryObjective(unit) {
  const war = W.activeWars.find(
      (candidate) =>
        !candidate.ended && (candidate.a === unit.factionId || candidate.b === unit.factionId),
    ),
    home = W.settlements.find(
      (settlement) => settlement.id === unit.homeSettlementId && !settlement.ruined,
    );
  if (!war) return { war: null, target: home, home };
  if (!war.attackerId) {
    const a = W.factions.find((faction) => faction.id === war.a),
      b = W.factions.find((faction) => faction.id === war.b);
    war.attackerId = (a?.militaryStrength || 0) >= (b?.militaryStrength || 0) ? war.a : war.b;
  }
  const defenderId = war.attackerId === war.a ? war.b : war.a,
    targets = W.settlements
      .filter((settlement) => !settlement.ruined && settlement.factionId === defenderId)
      .sort((left, right) => left.defense - right.defense || left.id - right.id),
    target = targets[0] || home;
  unit.objectiveSettlementId = target?.id || 0;
  return { war, target, home };
}

function unitGeometry(unit, target) {
  const members = unit.memberIds.filter((id) => classifyAlive(id) && W.components.position[id]),
    x = members.length ? mean(members.map((id) => W.components.position[id].x)) : target?.x || 0,
    y = members.length ? mean(members.map((id) => W.components.position[id].y)) : target?.y || 0,
    spread = members.length
      ? Math.max(
          ...members.map((id) =>
            Math.sqrt(dist2(W.components.position[id].x, W.components.position[id].y, x, y)),
          ),
        )
      : 0,
    distance = target ? Math.sqrt(dist2(x, y, target.x, target.y)) : 0;
  return { members, x, y, spread, distance };
}

function setMilitaryPhase(unit, phase, detail, target, war) {
  const previous = unit.phase;
  unit.phase = phase;
  unit.phaseDetail = detail;
  unit.phaseTick = previous === phase ? unit.phaseTick || W.tick : W.tick;
  if (previous === phase || W.tick - (unit.lastPhaseEventTick ?? -999) < 24) return;
  unit.lastPhaseEventTick = W.tick;
  const home = W.settlements.find((settlement) => settlement.id === unit.homeSettlementId),
    event = emitEvent("MilitaryPhaseEvent", {
      subjects: [home?.entityId, ...unit.memberIds.slice(0, 4)].filter(Boolean),
      location: target ? idx(target.x, target.y) : home ? idx(home.x, home.y) : -1,
      factions: [unit.factionId],
      causes: [war?.lastEventId, war?.startEventId],
      evidence: [detail, `the unit phase changed from ${previous || "unformed"} to ${phase}`],
      importance: ["engaged", "withdrawing", "rerouting"].includes(phase) ? 2 : 1,
      data: { unitId: unit.id, phase, previous: previous || "", detail },
    });
  unit.lastPhaseEventId = event.id;
}

function updateMilitaryMovement() {
  if (W.tick % 4) return;
  for (const unit of W.militaryUnits.filter((candidate) => candidate.active)) {
    const { war, target: objective, home } = militaryObjective(unit);
    if (!objective) {
      setMilitaryPhase(unit, "inactive", "no intact home or objective remains", null, war);
      continue;
    }
    let target = objective,
      geometry = unitGeometry(unit, target),
      progress = Number.isFinite(unit.lastObjectiveDistance)
        ? unit.lastObjectiveDistance - geometry.distance
        : 0;
    if (progress > 0.12) {
      unit.lastProgressTick = W.tick;
      unit.stalledTicks = 0;
    } else if (war && geometry.distance > 3) unit.stalledTicks = (unit.stalledTicks || 0) + 4;
    else unit.stalledTicks = 0;
    unit.lastObjectiveDistance = geometry.distance;
    unit.lastCentroid = { x: geometry.x, y: geometry.y, tick: W.tick };
    let phase;
    if (!war) phase = geometry.distance > 4 ? "returning" : "guarding";
    else if (W.tick - unit.formedTick < 28 || geometry.members.length < 2) phase = "mustering";
    else if (geometry.spread > 5.5) phase = "forming";
    else if (geometry.distance <= 2.4) phase = "engaged";
    else if ((unit.stalledTicks || 0) >= 160) phase = "withdrawing";
    else if ((unit.stalledTicks || 0) >= 48) phase = "rerouting";
    else phase = "marching";
    if (phase === "withdrawing" && home) {
      target = home;
      geometry = unitGeometry(unit, target);
      if (geometry.distance <= 3) {
        unit.stalledTicks = 0;
        phase = "recovering";
      }
    }
    const detail =
      phase === "mustering"
        ? `${geometry.members.length} members are gathering and drawing supplies at ${home?.name || "home"}`
        : phase === "forming"
          ? `the unit is closing a ${geometry.spread.toFixed(1)}-tile formation spread before advance`
          : phase === "marching"
            ? `the centroid is ${geometry.distance.toFixed(1)} tiles from ${target.name} and made ${Math.max(0, progress).toFixed(1)} tiles of measured progress`
            : phase === "engaged"
              ? `the formation has reached the ${target.name} contact zone`
              : phase === "rerouting"
                ? `no measurable advance for ${unit.stalledTicks} ticks; members are testing alternate terrain steps`
                : phase === "withdrawing"
                  ? `no viable route produced progress for ${unit.stalledTicks} ticks; the unit is returning to ${home?.name || "home"}`
                  : phase === "returning"
                    ? `the unit is returning to ${home?.name || target.name} without an active war objective`
                    : phase === "recovering"
                      ? `the withdrawn unit is resupplying at ${home?.name || target.name}`
                      : `the unit is guarding ${target.name}`;
    setMilitaryPhase(unit, phase, detail, target, war);
    for (const id of geometry.members) {
      const p = W.components.position[id];
      if (militiaSurvivalCrisis(id)) {
        clearStaleWork(id);
        continue;
      }
      if (phase === "mustering") {
        if (home && dist2(p.x, p.y, home.x, home.y) > 9)
          moveWorkerToward(
            id,
            idx(home.x, home.y),
            "muster",
            `📯 gathering at ${home.name}; not yet marching`,
          );
        else
          setWorkAction(
            id,
            "muster",
            `📯 drawing supplies and waiting for the unit to assemble`,
            idx(p.x, p.y),
          );
      } else if (phase === "forming" || phase === "rerouting") {
        const centroidTile = idx(
          clamp(Math.round(geometry.x), 0, W.width - 1),
          clamp(Math.round(geometry.y), 0, W.height - 1),
        );
        if (dist2(p.x, p.y, geometry.x, geometry.y) > 4)
          moveWorkerToward(id, centroidTile, "form", `🫡 closing formation before movement`);
        else
          moveWorkerToward(
            id,
            idx(target.x, target.y),
            "form",
            phase === "rerouting"
              ? `🫡 probing an alternate route toward ${target.name}`
              : `🫡 holding the formed line`,
          );
      } else if (phase === "marching")
        moveWorkerToward(
          id,
          idx(target.x, target.y),
          "march",
          `🥾 actively marching toward ${target.name}`,
        );
      else if (phase === "withdrawing" || phase === "returning")
        moveWorkerToward(
          id,
          idx(target.x, target.y),
          "withdraw",
          `↩️ returning toward ${target.name}`,
        );
      else if (phase === "engaged")
        setWorkAction(
          id,
          "fight",
          `⚔️ holding combat formation at the ${target.name} front`,
          idx(target.x, target.y),
        );
      else setWorkAction(id, "guard", `🛡️ ${detail}`, idx(target.x, target.y));
    }
  }
}

const simTickAnatomyBase = simTick;
simTick = function () {
  simTickAnatomyBase();
  if (!W) return;
  updateFirefighting();
  ensurePrimitiveEquipment();
  if (W.tick % 128 === 0)
    W.severedParts = (W.severedParts || []).filter((part) => W.tick - part.tick <= 2048);
};

const eventSentenceAnatomyBase = eventSentence;
eventSentence = function (event) {
  const names = event.subjects.map(entityName),
    location = locationName(event.location);
  switch (event.type) {
    case "LimbLostEvent":
      return `🩸 ${names[0]} lost ${event.data.part} to ${event.data.wound} in ${location}; locomotion or manipulation changed permanently.`;
    case "FireSuppressedEvent":
      return `🪣 ${names[0]} used ${event.data.bucket} and ${event.data.water} solvent mass to reduce fire from ${event.data.before} to ${event.data.after} in ${location}.`;
    case "WatercraftLaunchedEvent":
      return `⛵ ${names[0]} completed ${event.data.name}, a material vessel able to traverse deep water.`;
    case "EquipmentCraftedEvent":
      return `🛠️ ${names[0]} made ${event.data.name}, an alien form with the real function of ${event.data.purpose}.`;
    case "MilitaryPhaseEvent":
      return `${event.data.phase === "marching" ? "🥾" : event.data.phase === "mustering" ? "📯" : event.data.phase === "engaged" ? "⚔️" : "🛡️"} Unit ${event.data.unitId} changed from ${event.data.previous || "unformed"} to ${event.data.phase}: ${event.data.detail}.`;
    default:
      return eventSentenceAnatomyBase(event);
  }
};

const organismInspectorAnatomyBase = organismInspector;
organismInspector = function (id) {
  let html = organismInspectorAnatomyBase(id);
  if (!W.components.life[id]) return html;
  const capability = embodiedCapability(id),
    anatomy = ensureEmbodiedAnatomy(id),
    damaged = Object.values(anatomy.parts)
      .filter((part) => part.severed || part.disabled || part.integrity < part.maxIntegrity)
      .map(
        (part) =>
          `${part.severed ? "missing" : part.disabled ? "disabled" : "injured"} ${part.name} (${Math.round((part.integrity / part.maxIntegrity) * 100)}%)`,
      )
      .join("; ");
  return `${html}<div class="subhead">Embodied anatomy</div><div class="card"><div class="kv"><span>Manipulator capacity</span><b>${pct(capability.manipulation * 100)}</b><span>Locomotor capacity</span><b>${pct(capability.locomotion * 100)}</b><span>Perception capacity</span><b>${pct(capability.perception * 100)}</b><span>Missing parts</span><b>${esc(capability.lost.join(", ") || "none")}</b><span>Damage detail</span><b>${esc(damaged || "all modeled parts functional")}</b></div><div class="divider"></div><small class="muted">Missing parts alter travel speed, tool use, combat power, work, and the rendered creature silhouette. Lost tissue is transferred into the local substrate.</small></div>`;
};

const showFactionMilitaryPhaseBase = showFaction;
showFaction = function (id) {
  showFactionMilitaryPhaseBase(id);
  const units = W.militaryUnits.filter((unit) => unit.active && unit.factionId === id);
  if (!units.length) return;
  DOM.modalBody.insertAdjacentHTML(
    "beforeend",
    `<div class="subhead">Active force states</div><div class="stack">${units
      .map(
        (unit) =>
          `<div class="card"><div class="row between"><b>Unit ${unit.id} · ${esc(titleCase(unit.phase || "guarding"))}</b><span class="tag">${unit.memberIds.filter(classifyAlive).length} active</span></div><small class="muted">${esc(unit.phaseDetail || "No current movement report")}</small></div>`,
      )
      .join("")}</div>`,
  );
};

function embodiedSystemsAudit() {
  const failures = [];
  for (const id of W.activeIds) {
    if (!W.components.life[id]) continue;
    const anatomy = ensureEmbodiedAnatomy(id),
      lost = Object.values(anatomy.parts).filter((part) => part.severed);
    for (const part of lost)
      if (!part.causeEvent)
        failures.push(`entity ${id} missing ${part.name} without a cause event`);
  }
  for (const unit of W.militaryUnits.filter((candidate) => candidate.active)) {
    if (!unit.phase) failures.push(`unit ${unit.id} has no explicit phase`);
    if (unit.phase === "marching" && (unit.stalledTicks || 0) >= 48)
      failures.push(`unit ${unit.id} says marching despite ${unit.stalledTicks} stalled ticks`);
  }
  for (const artifact of W.artifacts.filter((candidate) => candidate.tool)) {
    if (
      artifact.tool.capabilities.includes("carry_liquid") &&
      !artifact.composition.some((amount) => amount > 0)
    )
      failures.push(`vessel ${artifact.id} has no conserved composition`);
  }
  return {
    failures,
    missingParts: W.activeIds.reduce(
      (total, id) => total + (W.components.life[id] ? embodiedCapability(id).lost.length : 0),
      0,
    ),
    severedVisuals: (W.severedParts || []).length,
    buckets: W.artifacts.filter((artifact) => artifact.tool?.capabilities.includes("firefighting"))
      .length,
    watercraft: W.artifacts.filter((artifact) => artifact.tool?.capabilities.includes("watercraft"))
      .length,
    phases: Object.fromEntries(
      [...new Set(W.militaryUnits.map((unit) => unit.phase || "unassigned"))].map((phase) => [
        phase,
        W.militaryUnits.filter((unit) => (unit.phase || "unassigned") === phase).length,
      ]),
    ),
    matter: auditMatter(),
  };
}

function debugDeepWaterProbe(id = 0) {
  const person =
    id ||
    W.activeIds.find((candidate) => W.kind[candidate] === KINDS.PERSON && classifyAlive(candidate));
  if (!person) return { ok: false, reason: "no living person" };
  const factionId = W.components.social[person]?.factionId || 0,
    deep = Array.from(W.tiles.liquid)
      .map((depth, tile) => ({ depth, tile }))
      .filter((entry) => entry.depth > 820)
      .sort((left, right) => right.depth - left.depth || left.tile - right.tile)[0];
  return {
    ok: !!deep && hasNavigableWatercraft(person),
    person,
    factionId,
    navigation: !!(factionId && factionHasTech(factionId, "navigation")),
    watercraft: !!toolForPurpose(person, "watercraft"),
    deepTile: deep?.tile ?? -1,
    depth: deep?.depth || 0,
    stress: deep ? organismHabitatStress(person, deep.tile) : null,
  };
}

function debugConsolidateTileMatter(species, targetTile, requested) {
  let needed = Math.min(requested, 65535 - tileMatterAmount(targetTile, species));
  for (let tile = 0; tile < W.tileCount && needed > 0; tile++) {
    if (tile === targetTile) continue;
    const available = tileMatterAmount(tile, species),
      moved = Math.min(available, needed);
    if (!moved) continue;
    setTileMatterAmount(tile, species, available - moved);
    setTileMatterAmount(targetTile, species, tileMatterAmount(targetTile, species) + moved);
    needed -= moved;
  }
  return requested - needed;
}

function debugSupplyPersonalMatter(id, species, requested) {
  const inventory = W.components.inventory[id]?.materials;
  if (!inventory) return 0;
  let needed = Math.min(requested, 65535 - inventory[species]);
  for (let tile = 0; tile < W.tileCount && needed > 0; tile++) {
    const available = tileMatterAmount(tile, species),
      moved = Math.min(available, needed);
    if (!moved) continue;
    setTileMatterAmount(tile, species, available - moved);
    inventory[species] += moved;
    needed -= moved;
  }
  return requested - needed;
}

function debugEmbodiedSystemsProbe() {
  const people = W.activeIds
    .filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id))
    .sort((left, right) => left - right);
  if (people.length < 2) return { ok: false, reason: "fewer than two living people" };
  const [worker, victim] = people,
    attacker = people[2] || worker,
    beforeMatter = totalMatter(),
    rigid = [C.MINERAL, C.ORE, C.BONE, C.CERAMIC, C.METAL, C.CRYSTAL].find(
      (species) => debugSupplyPersonalMatter(worker, species, 10) === 10,
    ),
    flexible = [C.FIBER, C.ORGANIC, C.MEMBRANE].find(
      (species) => debugSupplyPersonalMatter(worker, species, 10) === 10,
    );
  if (rigid === undefined || flexible === undefined)
    return { ok: false, reason: "world lacks conserved rigid or flexible matter for equipment" };
  const bucket = createPersonalTool(worker, {
      head: rigid,
      binding: flexible,
      purpose: "carry_liquid",
    }),
    watercraft = createPersonalTool(worker, {
      head: rigid,
      binding: flexible,
      purpose: "watercraft",
    });
  const workerPosition = W.components.position[worker],
    sourceTile = idx(workerPosition.x, workerPosition.y),
    fireTile = neighbors4(sourceTile).find(
      (tile) => W.tiles.liquid[tile] < 700 && tileMatterAmount(tile, C.SOLVENT) < 65525,
    );
  let fire = { filled: false, suppressed: false, before: 0, after: 0, eventId: 0 };
  if (bucket && fireTile !== undefined) {
    debugConsolidateTileMatter(C.SOLVENT, sourceTile, 24);
    debugConsolidateTileMatter(C.FUEL, fireTile, 42);
    debugConsolidateTileMatter(C.OXIDANT, fireTile, 32);
    const ignitionCause = emitEvent("InterventionEvent", {
        subjects: [worker],
        location: fireTile,
        causes: [],
        evidence: ["controlled regression probe supplied localized activation energy"],
        importance: 1,
        data: { kind: "firefighting regression probe" },
      }),
      ignited = igniteTile(fireTile, 420, ignitionCause.id, "intervention");
    fire.before = W.tiles.fire[fireTile];
    for (let attempt = 0; ignited && attempt < 40; attempt++) {
      performFirefighting(worker, fireTile);
      resolveEffects();
      fire.filled ||= W.components.inventory[worker].materials[C.SOLVENT] > 0;
      fire.eventId =
        W.events.findLast(
          (event) => event.type === "FireSuppressedEvent" && event.location === fireTile,
        )?.id || 0;
      if (fire.eventId) break;
    }
    fire.suppressed = !!fire.eventId;
    fire.after = W.tiles.fire[fireTile];
  }
  const deep = Array.from(W.tiles.liquid)
      .map((depth, tile) => ({ depth, tile }))
      .filter((entry) => entry.depth > 820)
      .sort((left, right) => right.depth - left.depth || left.tile - right.tile)[0],
    originalTile = idx(workerPosition.x, workerPosition.y);
  if (watercraft && deep) {
    queueEffect(
      "MoveEntity",
      { entityId: worker, x: xy(deep.tile)[0], y: xy(deep.tile)[1] },
      worker,
    );
    resolveEffects();
  }
  const arrivedTile = idx(W.components.position[worker].x, W.components.position[worker].y),
    beforeCapability = embodiedCapability(victim),
    victimPosition = W.components.position[victim],
    attack = emitEvent("CombatExchangeEvent", {
      subjects: [attacker, victim],
      location: idx(victimPosition.x, victimPosition.y),
      causes: [],
      evidence: ["controlled regression strike physically targeted the left arm"],
      importance: 3,
      data: { tactic: "hook-and-sever", defense: "failed deflection" },
    }),
    limb = applyEmbodiedInjury(
      victim,
      "left arm",
      "deep laceration",
      88,
      1,
      true,
      attacker,
      attack.id,
      { forceDismember: true },
    ),
    afterCapability = embodiedCapability(victim),
    matterDelta = totalMatter() - beforeMatter;
  return {
    ok:
      !!bucket &&
      !!watercraft &&
      fire.suppressed &&
      fire.after < fire.before &&
      !!fire.eventId &&
      !!deep &&
      arrivedTile === deep.tile &&
      limb.severed &&
      afterCapability.manipulation < beforeCapability.manipulation &&
      Math.abs(matterDelta) < 1e-8,
    worker,
    originalTile,
    equipment: {
      bucket: bucket?.name || "",
      watercraft: watercraft?.name || "",
      bucketEvent: bucket?.eventIds.at(-1) || 0,
      watercraftEvent: watercraft?.eventIds.at(-1) || 0,
    },
    fire,
    navigation: {
      deepTile: deep?.tile ?? -1,
      depth: deep?.depth || 0,
      arrivedTile,
      exactArrival: !!deep && arrivedTile === deep.tile,
    },
    anatomy: {
      victim,
      part: limb.part,
      severed: limb.severed,
      eventId: limb.eventId,
      manipulationBefore: beforeCapability.manipulation,
      manipulationAfter: afterCapability.manipulation,
    },
    matterDelta,
  };
}

window.ALIFE_EMBODIED_DEBUG = Object.freeze({
  audit: embodiedSystemsAudit,
  probe: debugEmbodiedSystemsProbe,
  anatomy: (id) => ensureEmbodiedAnatomy(id),
  capability: embodiedCapability,
  deepWater: debugDeepWaterProbe,
  firefight: (id, tile) => performFirefighting(id, tile),
  dismember: (victim, attacker, part = "left arm") =>
    applyEmbodiedInjury(victim, part, "controlled severing test", 80, 1, true, attacker, 0, {
      forceDismember: true,
    }),
  military: () => W.militaryUnits.map((unit) => ({ ...unit, memberIds: unit.memberIds.slice() })),
});
