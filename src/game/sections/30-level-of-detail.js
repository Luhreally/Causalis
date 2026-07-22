// ═══════════════════════════════════════════════════════════════════════════
// 30. DYNAMIC LEVEL-OF-DETAIL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
function updateMigration() {
  for (const id of W.activeIds) {
    if (![KINDS.HERBIVORE, KINDS.PERSON].includes(W.kind[id]) || !classifyAlive(id)) continue;
    const p = W.components.position[id],
      ti = idx(p.x, p.y),
      pressure =
        W.tiles.danger[ti] / 1000 +
        (tileFood(ti, "omnivore") < 4 ? 0.5 : 0) +
        (tileMoisture(ti) < 8 ? 0.5 : 0);
    if (pressure > 1 && counterRand("migration", W.tick, id) < 0.08) {
      const d = bestDirection(id, "migrate"),
        from = ti,
        nav = factionHasTech(W.components.social[id]?.factionId || 0, "navigation"),
        stride = nav ? 3 : 2,
        nx = clamp(p.x + d[0] * stride, 0, W.width - 1),
        ny = clamp(p.y + d[1] * stride, 0, W.height - 1);
      executeProcess("motion_dissipation", invEntity(id), nav ? 1 : 2, { dissipate: 1 });
      queueEffect("MoveEntity", { entityId: id, x: nx, y: ny }, id);
      W.components.identity[id].migrations++;
      const ev = emitEvent("MigrationEvent", {
        subjects: [id],
        location: idx(nx, ny),
        causes: [W.causalIndex.tile[from] || 0],
        evidence: [
          W.tiles.danger[from] > 500 ? "danger pressure" : "chemical food and solvent scarcity",
          nav ? "reproducible gradient navigation" : "local sensory gradients",
        ],
        importance: 1,
      });
      remember(id, ev.id, "departure");
    }
  }
  for (const c of W.cohorts)
    if (c.migrationPressure > 0.7 && c.count) {
      const [x, y] = regionCenter(c.regionId),
        nav = factionHasTech(c.factionId, "navigation"),
        stride = nav ? 24 : 18;
      let dir = Math.floor(counterRand("cohort-migration", W.tick, c.id) * 4);
      if (nav) {
        const choices = [];
        for (let d = 0; d < 4; d++) {
          const nx = clamp(x + DIRS[d * 2][0] * stride, 0, W.width - 1),
            ny = clamp(y + DIRS[d * 2][1] * stride, 0, W.height - 1),
            ti = idx(nx, ny),
            score = tileFood(ti, "omnivore") + tileMoisture(ti) - W.tiles.danger[ti] / 20;
          choices.push({ d, score });
        }
        choices.sort((a, b) => b.score - a.score || a.d - b.d);
        dir = choices[0].d;
      }
      const nx = clamp(x + DIRS[dir * 2][0] * stride, 0, W.width - 1),
        ny = clamp(y + DIRS[dir * 2][1] * stride, 0, W.height - 1),
        old = c.regionId;
      executeAggregateProcess(
        c.chemistryTotals,
        "motion_dissipation",
        Math.max(1, Math.ceil(c.count * (nav ? 0.01 : 0.02))),
        { dissipate: 1 },
      );
      c.regionId = regionId(nx, ny);
      emitEvent("MigrationEvent", {
        location: idx(nx, ny),
        causes: [W.causalIndex.domain.disasters || 0],
        evidence: [
          "cohort-scale scarcity pressure",
          nav ? "charted chemical gradients" : "unmapped migration",
        ],
        magnitude: c.count,
        importance: 2,
        data: { fromRegion: old },
      });
    }
}
function commitDerivedCaches() {
  for (const id of W.activeIds)
    if (W.components.genome[id] && W.components.life[id]) {
      if (W.components.genome[id].dirty) compilePhenotype(id);
      derivedLife(id);
    }
}
function rebuildDerivedCaches() {
  rebuildSpatialBins();
  worldHash();
}
