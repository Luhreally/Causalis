// ═══════════════════════════════════════════════════════════════════════════
// 29. HISTORICAL SIGNIFICANCE AND CHRONICLES
// ═══════════════════════════════════════════════════════════════════════════
function speciesLabel(kind, lineage) {
  const n = hashParts(W.seedHash, lineage),
    a = NAME_B[n % NAME_B.length],
    b =
      kind === KINDS.PREDATOR
        ? ["Stalker", "Fang", "Hunter"][n % 3]
        : kind === KINDS.HERBIVORE
          ? ["Grazer", "Browser", "Drifter"][n % 3]
          : ["Kin", "Folk", "People"][n % 3];
  return `${a} ${b}`;
}
function cohortTraitSummary(c) {
  const count = Math.max(1, c.count),
    ex = (i) => (c.geneSums[i] || 0) / count,
    bodyTotals = c.bodyChemistryTotals || c.chemistryTotals,
    per = (sp) => (bodyTotals[sp] || 0) / count,
    mass = Math.max(20, sum(bodyTotals) / count),
    energy = per(C.ENERGY),
    actuator = ex(8) + 0.2;
  return {
    speed: clamp((actuator * (0.8 + energy / 900)) / (mass / 500 + 1), 0.25, 2.5),
    size: clamp(Math.sqrt(mass) / 14, 0.45, 2.2),
    heatTolerance: 15 + ex(11) * 38,
    diseaseResistance: clamp((ex(10) + ex(1) + 18 / 130) * 0.45, 0, 1),
  };
}
function averagedSpeciesTraits(g, fallback = {}) {
  const totals = { speed: 0, size: 0, heat: 0, resist: 0 };
  let weight = 0;
  const add = (p, n) => {
    if (!p || !n) return;
    totals.speed += (p.speed || 0) * n;
    totals.size += (p.size || 0) * n;
    totals.heat += (p.heatTolerance ?? p.heat ?? 0) * n;
    totals.resist += (p.diseaseResistance ?? p.resist ?? 0) * n;
    weight += n;
  };
  for (const p of g.traits) add(p, 1);
  for (const entry of g.cohortTraits) add(entry.traits, entry.count);
  return weight
    ? {
        speed: totals.speed / weight,
        size: totals.size / weight,
        heat: totals.heat / weight,
        resist: totals.resist / weight,
      }
    : { ...fallback };
}
function classifySpecies() {
  const groups = {},
    newGroup = (kind, lineage) => ({
      kind,
      lineage,
      ids: [],
      traits: [],
      cohortTraits: [],
      cohortRegions: [],
      cohort: 0,
    });
  for (const id of W.activeIds) {
    if (![KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON].includes(W.kind[id])) continue;
    const genome = W.components.genome[id],
      key = `${W.kind[id]}:${genome.lineageId}`,
      group = groups[key] || (groups[key] = newGroup(W.kind[id], genome.lineageId));
    group.ids.push(id);
    group.traits.push(phenotype(id));
  }
  for (const c of W.cohorts) {
    if (!c.count || ![KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON].includes(c.kind)) continue;
    const key = `${c.kind}:${c.lineageId}`,
      group = groups[key] || (groups[key] = newGroup(c.kind, c.lineageId));
    group.cohort += c.count;
    group.cohortTraits.push({ traits: cohortTraitSummary(c), count: c.count });
    group.cohortRegions.push(c.regionId);
  }
  for (const [key, g] of Object.entries(groups)) {
    const prev = W.speciesRegistry[key],
      avg = averagedSpeciesTraits(g, prev?.avg || {});
    if (!prev) {
      W.speciesRegistry[key] = {
        key,
        name: speciesLabel(g.kind, g.lineage),
        kind: g.kind,
        lineage: g.lineage,
        firstTick: W.tick,
        lastSeen: W.tick,
        count: g.ids.length + g.cohort,
        avg,
        adaptationBaseline: { ...avg },
        adaptationStreak: 0,
        lastAdaptationTick: -1024,
        extinct: false,
      };
      continue;
    }
    prev.lastSeen = W.tick;
    prev.count = g.ids.length + g.cohort;
    prev.extinct = false;
    const prior = prev.avg || avg;
    if (!prev.adaptationBaseline) {
      prev.adaptationBaseline = { ...prior };
      prev.adaptationStreak = 0;
      prev.lastAdaptationTick = prev.lastAdaptationTick ?? -1024;
    }
    const baseline = prev.adaptationBaseline,
      parts = {
        speed: Math.abs((avg.speed || 0) - (baseline.speed || 0)),
        size: Math.abs((avg.size || 0) - (baseline.size || 0)),
        heatTolerance: Math.abs((avg.heat || 0) - (baseline.heat || 0)) / 30,
        diseaseResistance: Math.abs((avg.resist || 0) - (baseline.resist || 0)),
      },
      shift = sum(Object.values(parts)),
      moderate = shift >= 0.1 && shift <= 0.45;
    prev.adaptationStreak = moderate ? (prev.adaptationStreak || 0) + 1 : 0;
    let location = -1;
    if (g.ids[0])
      location = idx(W.components.position[g.ids[0]].x, W.components.position[g.ids[0]].y);
    else if (g.cohortRegions.length) {
      const [x, y] = regionCenter(g.cohortRegions[0]);
      location = idx(x, y);
    }
    if (
      prev.adaptationStreak >= 3 &&
      W.tick - prev.firstTick >= 384 &&
      W.tick - (prev.lastAdaptationTick ?? -1024) >= 768
    ) {
      const trait = Object.entries(parts).sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0][0],
        environment = location >= 0 ? biomeAt(location) : "regional chemical conditions",
        ev = emitEvent("AdaptationEvent", {
          subjects: g.ids.slice(0, 2),
          location,
          causes: [
            W.lastEventByType.MutationEvent,
            location >= 0 ? W.causalIndex.tile[location] : 0,
          ],
          evidence: [`sustained ${trait} shift across three classifications`, environment],
          magnitude: shift,
          importance: 3,
          data: { species: prev.name, trait, shift: +shift.toFixed(3) },
        });
      prev.lastAdaptationEventId = ev.id;
      prev.lastAdaptationTick = W.tick;
      prev.adaptationBaseline = { ...avg };
      prev.adaptationStreak = 0;
    }
    const stepDelta =
      Math.abs((avg.speed || 0) - (prior.speed || 0)) +
      Math.abs((avg.heat || 0) - (prior.heat || 0)) / 30;
    if (stepDelta > 0.35 && W.tick - prev.firstTick > 512 && !prev.diverged) {
      prev.diverged = true;
      emitEvent("SpeciesDivergenceEvent", {
        subjects: g.ids.slice(0, 2),
        location,
        causes: [
          W.lastEventByType.MutationEvent,
          W.lastEventByType.FireDisasterEvent,
          prev.lastAdaptationEventId || 0,
        ],
        evidence: ["sustained genetic separation", "distinct environmental pressure"],
        importance: 4,
        data: { species: prev.name },
      });
    }
    prev.avg = avg;
  }
  for (const s of Object.values(W.speciesRegistry))
    if (!groups[s.key] && !s.extinct) {
      s.extinct = true;
      W.statistics.extinctions++;
      emitEvent("ExtinctionEvent", {
        causes: [W.lastEventByType.DeathEvent],
        evidence: ["no living entities or cohorts retained the lineage"],
        importance: 4,
        data: { species: s.name },
      });
    }
}
function updateHistoricalSignificance() {
  for (const id of W.activeIds) {
    const ident = W.components.identity[id],
      life = W.components.life[id];
    if (!ident || !life || W.kind[id] === KINDS.CORPSE) continue;
    const old = ident.significance;
    ident.significance = Math.max(
      ident.significance,
      ident.kills * 2 +
        ident.children.length +
        ident.settlementsFounded.length * 8 +
        ident.artifacts.length * 6 +
        (life.age / W.components.body[id].maxAge) * 5 +
        ident.battles * 2,
    );
    if (!ident.notable && ident.significance >= 8) {
      ident.notable = true;
      const title = ident.settlementsFounded.length
        ? "the Founder"
        : ident.artifacts.length
          ? "the Maker"
          : ident.kills > 2
            ? "the Defender"
            : life.age > W.components.body[id].maxAge * 0.75
              ? "the Long-Lived"
              : "the Remembered";
      ident.titles.push(title);
      emitEvent("NotableFigureEvent", {
        subjects: [id],
        location: idx(W.components.position[id].x, W.components.position[id].y),
        causes: [W.causalIndex.entity[id] || 0],
        evidence: [`historical significance reached ${ident.significance.toFixed(1)}`],
        importance: 3,
        data: { title },
      });
    }
    if (ident.notable && ident.significance >= 22 && !ident.legendary) {
      ident.legendary = true;
      ident.titles.push("Living Legend");
    }
  }
}
function recordStatistics() {
  const p = populationSummary(),
    foodSample = sampleField((i) => tileFood(i, "omnivore")),
    diseaseSample = sampleField(tileDisease),
    fireSample = sampleField((i) => W.tiles.fire[i] / 10),
    tech = W.technologies.length;
  W.statistics.history.push({
    tick: W.tick,
    population: p.herbivore + p.predator + p.person,
    herbivore: p.herbivore,
    predator: p.predator,
    person: p.person,
    food: foodSample,
    disease: diseaseSample,
    fire: fireSample,
    settlements: W.settlements.filter((s) => !s.ruined).length,
    technology: tech,
    factions: W.factions.filter((f) => f.stability > 0).length,
  });
  if (W.statistics.history.length > 320) W.statistics.history.shift();
}
function sampleField(fn) {
  let n = 0,
    total = 0;
  for (let i = 0; i < W.tileCount; i += 37) {
    total += fn(i);
    n++;
  }
  return total / n;
}
