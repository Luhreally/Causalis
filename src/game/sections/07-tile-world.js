// ═══════════════════════════════════════════════════════════════════════════
// 7. TILE-COLUMN WORLD
// ═══════════════════════════════════════════════════════════════════════════
function tileMoisture(i) {
  return clamp((W.tiles.chem[C.SOLVENT][i] - W.tiles.liquid[i] * 0.55) / 9, 0, 100);
}
function featureSpecAt(i) {
  const type = W.tiles.featureType?.[i] || 0;
  return type ? W.terrainGenome?.structureGenome?.categories?.[type] || null : null;
}
function featureNameAt(i) {
  return featureSpecAt(i)?.name || "";
}
function ecologicalNicheAt(i) {
  const type = W.tiles.featureType?.[i] || 0,
    sub = W.tiles.subsurfaceType?.[i] || 0,
    strength = (W.tiles.featureStrength?.[i] || 0) / 1000,
    e = {
      food: 0,
      resource: 0,
      shelter: sub === 1 ? 0.42 : sub === 2 ? 0.16 : 0.04,
      thermalBuffer: sub === 1 ? 0.58 : sub === 2 ? 0.18 : 0,
      hydrationBuffer: sub === 1 ? 0.28 : 0,
      energyGradient: 0,
      hazard: 0,
      herbivore: 0,
      predator: 0,
      person: 0,
    };
  if (type === TERRAIN_FEATURE.CANOPY) {
    e.food = 18 * strength;
    e.shelter += 0.28 * strength;
    e.thermalBuffer += 0.22 * strength;
    e.hydrationBuffer += 0.18 * strength;
    e.herbivore = 18 * strength;
    e.predator = 9 * strength;
  } else if (type === TERRAIN_FEATURE.HIGHLAND) {
    e.shelter += 0.1 * strength;
    e.predator = 8 * strength;
    e.person = 3 * strength;
  } else if (type === TERRAIN_FEATURE.CAVERN) {
    e.shelter += 0.5 * strength;
    e.thermalBuffer += 0.68 * strength;
    e.hydrationBuffer += 0.32 * strength;
    e.predator = 10 * strength;
    e.person = 9 * strength;
  } else if (type === TERRAIN_FEATURE.GEOTHERMAL) {
    e.energyGradient = 24 * strength;
    e.food = 6 * strength;
    e.hazard = 4 * strength;
    e.herbivore = 5 * strength;
  } else if (type === TERRAIN_FEATURE.AQUATIC) {
    e.food = 24 * strength;
    e.shelter += 0.22 * strength;
    e.herbivore = 11 * strength;
    e.predator = 7 * strength;
  } else if (type === TERRAIN_FEATURE.DEPOSIT) {
    e.resource = 28 * strength;
    e.person = 15 * strength;
    e.shelter += 0.08 * strength;
  }
  return e;
}
function nicheDescriptionAt(i) {
  const e = ecologicalNicheAt(i),
    parts = [];
  if (e.food > 2) parts.push("concentrated food web");
  if (e.resource > 2) parts.push("mineral/catalyst access");
  if (e.shelter > 0.2) parts.push("physical refuge");
  if (e.thermalBuffer > 0.2) parts.push("buffered microclimate");
  if (e.energyGradient > 2) parts.push("chemosynthetic energy gradient");
  return parts.join(", ") || "exposed general habitat";
}
function tileFertility(i) {
  const q = W.tiles.chem,
    n = ecologicalNicheAt(i);
  return clamp(
    (q[C.NUTRIENT][i] * 0.48 +
      q[C.WASTE][i] * 0.18 +
      q[C.ASH][i] * 0.1 +
      q[C.SOLVENT][i] * 0.035 -
      q[C.TOXIN][i] * 0.65) /
      10 +
      n.energyGradient * 0.18,
    0,
    100,
  );
}
function tileFood(i, metabolism = "grazer") {
  const q = W.tiles.chem;
  if (metabolism === "predator") {
    const [cx, cy] = xy(i);
    let prey = 0,
      carrion = 0;
    for (let y = Math.max(0, cy - 2); y <= Math.min(W.height - 1, cy + 2); y++)
      for (let x = Math.max(0, cx - 2); x <= Math.min(W.width - 1, cx + 2); x++) {
        if (dist2(cx, cy, x, y) > 4) continue;
        for (const id of W.spatialBins[idx(x, y)] || []) {
          const kind = W.kind[id],
            life = W.components.life[id];
          if (
            (kind === KINDS.HERBIVORE || kind === KINDS.PERSON) &&
            life?.regulation > 0 &&
            life.integrity > 0
          )
            prey++;
          else if (kind === KINDS.CORPSE) carrion++;
        }
      }
    const region = regionId(cx, cy),
      regionalPrey = sum(
        (W.cohorts || [])
          .filter(
            (cohort) =>
              cohort.regionId === region &&
              (cohort.kind === KINDS.HERBIVORE || cohort.kind === KINDS.PERSON),
          )
          .map((cohort) => cohort.count || 0),
      ),
      regionalPredators = sum(
        (W.cohorts || [])
          .filter((cohort) => cohort.regionId === region && cohort.kind === KINDS.PREDATOR)
          .map((cohort) => cohort.count || 0),
      ),
      regionalAccess = (regionalPrey / Math.max(1, regionalPredators * 3 + 1)) * 70;
    return clamp(prey * 24 + carrion * 12 + regionalAccess + tileBlood(i) * 0.45, 0, 100);
  }
  const compat = metabolism === "grazer" ? 1 : metabolism === "omnivore" ? 0.72 : 0.2,
    n = ecologicalNicheAt(i);
  return clamp(
    ((Math.min(q[C.ORGANIC][i], q[C.ENERGY][i] * 1.4) * W.tiles.plantOrder[i]) / 9000 + n.food) *
      compat,
    0,
    100,
  );
}
function tileSmoke(i) {
  return clamp((W.tiles.chem[C.GAS][i] - 500) / 12 + W.tiles.fire[i] / 18, 0, 100);
}
function tileDisease(i) {
  return clamp(W.tiles.chem[C.PATHOGEN][i] / 12, 0, 100);
}
function tileBlood(i) {
  return clamp(W.tiles.chem[C.BLOOD][i] / 10, 0, 100);
}
function tileFear(i) {
  return clamp(W.tiles.chem[C.FEAR][i] / 10, 0, 100);
}
function tileResource(i) {
  const q = W.tiles.chem;
  return clamp(
    (q[C.ORE][i] * 0.55 + q[C.CATALYST][i] * 1.2 + q[C.MINERAL][i] * 0.08) / 18 +
      ecologicalNicheAt(i).resource,
    0,
    100,
  );
}
function tileMaterial(i) {
  const t = W.tiles,
    q = t.chem;
  if (t.liquid[i] > 800) return W.definitions.materials[0];
  if (t.fire[i] > 450 || q[C.ASH][i] > q[C.ORGANIC][i]) return W.definitions.materials[11];
  if (t.elevation[i] > 825) return W.definitions.materials[q[C.ORE][i] > 650 ? 9 : 8];
  if (tileMoisture(i) > 72 && t.plantOrder[i] > 350) return W.definitions.materials[1];
  if (t.plantOrder[i] > 680) return W.definitions.materials[4];
  if (t.soilOrder[i] > 620) return W.definitions.materials[3];
  return W.definitions.materials[2];
}
function biomeAt(i) {
  const t = W.tiles,
    e = t.elevation[i],
    m = tileMoisture(i),
    f = tileFertility(i),
    p = t.plantOrder[i],
    temp = t.temperature[i] / 10;
  if (t.liquid[i] > 1200) return "Deep Water";
  if (t.liquid[i] > 160) return "Shallow Water";
  if (e > 860) return "Mountain";
  if (t.chem[C.ASH][i] > 650 && p < 150) return "Ash Waste";
  if (t.fire[i] || t.structureOrder[i] < 180) return "Burned Ground";
  if (temp > 29 && m < 28) return p > 160 ? "Dry Scrub" : "Desert";
  if (m > 74 && e < 610) return "Swamp";
  if (p > 650) return "Forest";
  if (f > 66) return "Fertile Basin";
  if (p > 240) return "Grassland";
  if (e > 760) return "Stone Upland";
  return "Sand Plain";
}
function phasesAt(i) {
  const liquid = clamp(W.tiles.liquid[i] / 18, 0, 80),
    gas = clamp(W.tiles.chem[C.GAS][i] / 35 + tileSmoke(i) * 0.2, 8, 45),
    solid = clamp(100 - liquid - gas, 5, 90),
    total = liquid + gas + solid;
  return { solid: (solid / total) * 100, liquid: (liquid / total) * 100, gas: (gas / total) * 100 };
}
function activeReactionsAt(i) {
  const a = [];
  if (W.tiles.fire[i] > 0) a.push("combustion");
  if (W.tiles.plantOrder[i] > 80 && tileMoisture(i) > 25) a.push("photosynthesis");
  if (
    (W.tiles.featureType?.[i] === TERRAIN_FEATURE.GEOTHERMAL ||
      W.tiles.subsurfaceType?.[i] === 2) &&
    W.tiles.chem[C.CATALYST][i] > 20
  )
    a.push("chemosynthesis");
  if (W.tiles.chem[C.WASTE][i] > 100 || W.tiles.chem[C.ORGANIC][i] > 700) a.push("decomposition");
  if (W.tiles.chem[C.PATHOGEN][i] > 40) a.push("pathogen replication");
  if (W.tiles.liquid[i] > 50 && W.tiles.chem[C.MINERAL][i] > 500) a.push("dissolution");
  return a;
}
function tilePopulation(i) {
  return W.spatialBins[i]?.length || 0;
}
function cohortPopulationAt(i) {
  const [x, y] = xy(i),
    r = regionId(x, y);
  let n = 0;
  for (const c of W.cohorts) if (c.regionId === r) n += c.count;
  return n / 324;
}
