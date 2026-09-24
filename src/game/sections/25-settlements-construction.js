// ═══════════════════════════════════════════════════════════════════════════
// 25. CAMPS, SETTLEMENTS, AND CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════
function campNear(tile, r = 5) {
  const [x, y] = xy(tile);
  return W.camps.find((c) => c.active && dist2(x, y, c.x, c.y) <= r * r);
}
function settlementNear(tile, r = 6) {
  const [x, y] = xy(tile);
  return W.settlements.find((s) => !s.ruined && dist2(x, y, s.x, s.y) <= r * r);
}
function nearestSettlement(tile, r = Infinity) {
  const [x, y] = xy(tile);
  let best = null,
    bd = r * r;
  for (const s of W.settlements)
    if (!s.ruined) {
      const d = dist2(x, y, s.x, s.y);
      if (d <= bd) {
        bd = d;
        best = s;
      }
    }
  return best;
}
// How many people a town has. This used to be whoever happened to be standing
// within seven tiles of the middle of it, which is not a population but a
// snapshot of the square: measured on causal-origin small, Willowwatch read
// twenty-two people at one press, twelve at the next and eleven at the one
// after, while the number who actually lived there went 40, 42, 42. Nobody had
// died — they were out in the fields when the town was counted.
//
// Every civic decision rides on this reading: how many fields the granary
// plans, when settlers leave, whether the place is urban, and so whether a ship
// may leave from it. On that noise a city flickered in and out of being a city
// between presses and could never hold its stage long enough to launch.
//
// A town's people are the ones who live there, wherever they are standing, plus
// anyone nearby who lives nowhere else. Someone with a home in the next town is
// a visitor and is not counted twice. Before anyone has a home — camps, a young
// settlement — nobody has a residence to look up and this reads exactly as it
// always did.
function settlementPopulation(s) {
  let n = 0;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON) continue;
    const social = W.components.social[id],
      home = social && social.homePlaceKind === "settlement" ? social.homePlaceId || 0 : 0;
    if (home) {
      if (home === s.id) n++;
      continue;
    }
    const p = W.components.position[id];
    if (p && dist2(p.x, p.y, s.x, s.y) <= 49) n++;
  }
  const localRegion = regionId(s.x, s.y);
  for (const c of W.cohorts)
    if (c.kind === KINDS.PERSON && c.regionId === localRegion) {
      const [x, y] = regionCenter(c.regionId);
      if (dist2(x, y, s.x, s.y) <= 49) n += c.count;
    }
  return n;
}
function settlementFood(s) {
  const stored =
      s.inventory[C.ORGANIC] * 0.35 + s.inventory[C.ENERGY] * 0.8 - s.inventory[C.TOXIN] * 0.5,
    center = idx(s.x, s.y);
  let forage = tileFood(center, "omnivore");
  for (const n of neighbors4(center)) forage += tileFood(n, "omnivore");
  const farms =
    typeof completedBuildings === "function" ? completedBuildings(s, "farm").length * 14 : 0;
  return clamp((stored + forage * 0.6 + farms) / (1 + settlementPopulation(s) * 0.12), 0, 999);
}
function settlementWater(s) {
  return clamp(
    (s.inventory[C.SOLVENT] - s.inventory[C.TOXIN] * 0.3) / (1 + settlementPopulation(s) * 0.08),
    0,
    999,
  );
}
function settlementDefense(s) {
  if (!s?.structure?.composition) return 0;
  const c = s.structure.composition,
    material = c[C.MINERAL] + c[C.FIBER] * 0.7 + c[C.METAL] * 1.8 + c[C.CERAMIC] * 1.3,
    fort = s.knownProcesses?.includes("fortification") ? 1.45 : 1;
  return clamp(((material * s.structure.integrity) / 70000) * fort, 0, 100);
}
function ruinSettlement(s, causes = [], evidence = "structural material failed") {
  if (!s || s.ruined) return null;
  s.ruined = true;
  W.kind[s.entityId] = "ruin";
  const ti = idx(s.x, s.y),
    yearsStood = Math.max(0, Math.round((W.tick - (s.foundedTick || 0)) / TICKS_PER_YEAR)),
    population = settlementPopulation(s),
    crafts = (s.knownProcesses || []).slice(),
    ev = emitEvent("SettlementDestroyedEvent", {
      subjects: [s.entityId],
      location: ti,
      factions: [s.factionId],
      causes: Array.isArray(causes) ? causes : [causes],
      evidence: [
        evidence,
        `${s.name} stood ${yearsStood} year${yearsStood === 1 ? "" : "s"} and held ${population} people at the end`,
        crafts.length
          ? `its people practiced ${crafts.join(", ")}; that knowledge survives in the ruins and in memory`
          : "its people never completed a lasting craft",
      ],
      importance: 4,
      data: { name: s.name, yearsStood, population, crafts: crafts.length },
    });
  s.importantEvents.push(ev.id);
  W.tiles.danger[ti] = u16(W.tiles.danger[ti] + 180);
  const faction = W.factions.find((f) => f.id === s.factionId),
    remaining = W.settlements.filter(
      (x) => !x.ruined && x.factionId === s.factionId && x !== s,
    ).length;
  if (faction && !remaining)
    emitEvent("FactionCollapsedEvent", {
      subjects: [s.entityId],
      location: ti,
      factions: [s.factionId],
      causes: [ev.id],
      evidence: [
        `the fall of ${s.name} ended the last settlement of ${faction.name}`,
        `${(W.civilization?.legacyProcesses || []).length} crafts survive in the world's shared memory for whoever rises next`,
      ],
      importance: 5,
      data: { name: faction.name, lastSettlement: s.name },
    });
  return ev;
}
function entityAtRadius(tile, r, kind) {
  const cx = tile % W.width,
    cy = Math.floor(tile / W.width);
  if (r >= 5) {
    const viaCells = entitiesWithinRadius(cx, cy, r, 0, kind ? (id) => W.kind[id] === kind : null);
    if (viaCells) return viaCells;
  }
  const r2 = r * r,
    bins = W.spatialBins,
    width = W.width,
    out = [];
  for (let y = Math.max(0, cy - r); y <= Math.min(W.height - 1, cy + r); y++) {
    const dy2 = (y - cy) * (y - cy),
      row = y * width;
    for (let x = Math.max(0, cx - r); x <= Math.min(width - 1, cx + r); x++) {
      if ((x - cx) * (x - cx) + dy2 > r2) continue;
      const bin = bins[row + x];
      if (!bin) continue;
      for (const id of bin) if (!kind || W.kind[id] === kind) out.push(id);
    }
  }
  return out.length > 1 ? out.sort((a, b) => a - b) : out;
}
