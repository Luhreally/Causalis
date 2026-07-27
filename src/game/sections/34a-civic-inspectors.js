// 34A. COGNITION, CONSTRUCTION, AND CITY-MANAGEMENT INSPECTORS
const BUILD_STAGE_LABELS = Object.freeze([
  "Blueprint",
  "Materials staged",
  "Foundation",
  "Frame",
  "Walls",
  "Roof",
  "Complete",
]);
const CITY_POLICY_PRESETS = Object.freeze({
  balanced: {
    priorities: {
      food: 4,
      water: 4,
      shelter: 5,
      materials: 3,
      tools: 3,
      knowledge: 2,
      health: 2,
      defense: 2,
      governance: 2,
    },
    reserve: 20,
    expansion: true,
  },
  growth: {
    priorities: {
      food: 5,
      water: 4,
      shelter: 5,
      materials: 4,
      tools: 3,
      knowledge: 2,
      health: 3,
      defense: 1,
      governance: 2,
    },
    reserve: 12,
    expansion: true,
  },
  conservation: {
    priorities: {
      food: 4,
      water: 5,
      shelter: 3,
      materials: 2,
      tools: 2,
      knowledge: 3,
      health: 4,
      defense: 2,
      governance: 3,
    },
    reserve: 42,
    expansion: false,
  },
  fortified: {
    priorities: {
      food: 4,
      water: 4,
      shelter: 4,
      materials: 4,
      tools: 4,
      knowledge: 2,
      health: 2,
      defense: 5,
      governance: 3,
    },
    reserve: 28,
    expansion: true,
  },
  knowledge: {
    priorities: {
      food: 3,
      water: 4,
      shelter: 3,
      materials: 4,
      tools: 4,
      knowledge: 5,
      health: 3,
      defense: 1,
      governance: 4,
    },
    reserve: 24,
    expansion: true,
  },
});
function placeKindKey(place) {
  return place?.knownProcesses ? "settlement" : "camp";
}
function managedPlace(kind, id) {
  const place = placeByRef(kind, Number(id));
  if (!place) return null;
  if (kind === "camp" && !place.active) return null;
  if (kind === "settlement" && place.ruined) return null;
  return place;
}
function placePopulation(place) {
  return place.knownProcesses
    ? settlementPopulation(place)
    : entityAtRadius(idx(place.x, place.y), 6, KINDS.PERSON).filter(classifyAlive).length;
}
function localPlaceWorkers(place) {
  const kind = placeKindKey(place),
    physical = entityAtRadius(
      idx(place.x, place.y),
      place.knownProcesses ? 9 : 7,
      KINDS.PERSON,
    ).filter(classifyAlive),
    assigned = W.activeIds.filter((id) => {
      if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) return false;
      const social = W.components.social[id],
        position = W.components.position[id];
      return (
        position &&
        social?.homePlaceKind === kind &&
        social.homePlaceId === place.id &&
        dist2(position.x, position.y, place.x, place.y) <= 28 * 28
      );
    });
  return Array.from(new Set([...physical, ...assigned])).sort((a, b) => a - b);
}
function availableBuildingTypes(place) {
  const out = ["shelter", "hearth", "workshop"];
  if (place.knownProcesses) {
    out.push("farm", "wall");
    if (place.knownProcesses.includes("controlled_fire")) out.push("kiln");
    if (place.knownProcesses.includes("metalworking")) out.push("forge");
    if (place.knownProcesses.includes("medicine")) out.push("clinic");
    if (place.knownProcesses.includes("writing")) out.push("archive");
    if (place.knownProcesses.includes("governance")) out.push("hall");
    if (place.knownProcesses.includes("waterworks")) out.push("waterworks");
  }
  return out;
}
function placeProjectRow(b) {
  const workers = W.activeIds.filter(
      (id) =>
        W.components.work?.[id]?.buildingId === b.id &&
        W.tick - W.components.work[id].handledTick <= 8 &&
        peekAlive(id),
    ).length,
    requirements = b.requirements
      .map(
        ([sp, needed]) => `${W.definitions.species[sp].name} ${b.composition[sp] || 0}/${needed}`,
      )
      .join(" · ");
  return `<div class="card" style="margin:6px 0"><div class="row between"><b>${esc(b.name)}</b><span class="tag ${b.complete ? "good" : "gold"}">${esc(BUILD_STAGE_LABELS[b.stage] || "Working")}</span></div><div class="bar" style="margin:7px 0"><i style="width:${clamp(b.progress * 100, 0, 100)}%;background:var(--gold)"></i></div><small class="muted">${Math.round(b.progress * 100)}% · ${b.workDone}/${b.workRequired} labor · ${workers} worker${workers === 1 ? "" : "s"}<br>${esc(requirements || "legacy completed structure")}</small></div>`;
}
function placeDevelopmentCard(place, interactive = true) {
  if (!place) return "";
  const kind = placeKindKey(place),
    architecture = makeArchitectureGenome(place),
    buildings = W.buildings.filter(
      (b) => !b.ruined && b.placeKind === kind && b.placeId === place.id,
    ),
    complete = buildings.filter((b) => b.complete),
    projects = buildings
      .filter((b) => !b.complete)
      .sort((a, b) => b.progress - a.progress || a.id - b.id),
    workers = localPlaceWorkers(place),
    tasks = { idle: 0, gather: 0, mine: 0, cut: 0, haul: 0, craft: 0, build: 0 };
  for (const id of workers) {
    const task = W.components.work?.[id]?.task || "idle";
    tasks[task] = (tasks[task] || 0) + 1;
  }
  const workerLine =
      Object.entries(tasks)
        .filter(([, n]) => n)
        .map(([task, n]) => `${titleCase(task)} ${n}`)
        .join(" · ") || "No detailed workers in range",
    workerSet = new Set(workers),
    tools = W.artifacts.filter((a) => isFunctionalTool(a) && workerSet.has(a.ownerId)),
    research = Object.entries(place.researchProgress || {})
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    pop = placePopulation(place),
    priorities = place.management?.priorities || defaultCityManagement().priorities,
    controls =
      interactive && ((kind === "camp" && place.active) || (kind === "settlement" && !place.ruined))
        ? `<details><summary>Management settings</summary><div><div class="muted" style="margin:6px 0">Policy changes shift real job priority, reserves, expansion, research, and construction choices.</div><div class="row wrap">${Object.keys(
            CITY_POLICY_PRESETS,
          )
            .map(
              (policy) =>
                `<button class="small ${place.management.policy === policy ? "primary" : ""}" data-city-policy="${policy}" data-city-kind="${kind}" data-city-id="${place.id}">${titleCase(policy)}</button>`,
            )
            .join("")}</div><div class="stack" style="margin-top:9px">${Object.keys(priorities)
            .map(
              (key) =>
                `<label class="field"><span>${titleCase(key)} <b class="range-value" data-priority-value="${key}">${priorities[key]}</b></span><input type="range" min="1" max="5" step="1" value="${priorities[key]}" data-city-priority="${key}" data-city-kind="${kind}" data-city-id="${place.id}"></label>`,
            )
            .join(
              "",
            )}</div><div class="subhead">Issue a construction directive</div><div class="row wrap">${availableBuildingTypes(
            place,
          )
            .map(
              (type) =>
                `<button class="small" data-city-plan="${type}" data-city-kind="${kind}" data-city-id="${place.id}">+ ${esc(BUILDING_DEFS[type].name)}</button>`,
            )
            .join("")}</div></div></details>`
        : "";
  return `<div class="subhead">Built place simulation</div><div class="card"><div class="row between"><b>${esc(titleCase(place.stage || kind))}</b><span class="tag">${complete.length} built · ${projects.length} active</span></div><div class="kv" style="margin-top:8px"><span>Architecture</span><b>${esc(`${architecture.layout} · ${architecture.wallForm} · ${architecture.roofForm}`)}</b><span>Rigid structure</span><b>${esc(W.definitions.species[architecture.rigid].name)}</b><span>Flexible structure</span><b>${esc(W.definitions.species[architecture.flexible].name)}</b><span>Housing / population</span><b>${place.housing || 0} / ${pop}</b><span>Material storage</span><b>${placeStorageUsed(place)} / ${place.storageCapacity || 150}</b><span>Built defense</span><b>${(place.defense || 0).toFixed?.(1) || place.defense || 0}</b><span>Functional tools</span><b>${tools.length}${
    tools.length
      ? ` · ${tools
          .slice(0, 3)
          .map((t) => esc(t.name))
          .join(" · ")}`
      : ""
  }</b><span>Workforce</span><b>${esc(workerLine)}</b></div></div><details open><summary>Construction projects · ${projects.length}</summary>${projects.length ? projects.map(placeProjectRow).join("") : `<div class="empty">No unfinished structure. New construction begins only from a blueprint and gathered matter.</div>`}</details><details><summary>Completed structures · ${complete.length}</summary>${complete.length ? complete.map(placeProjectRow).join("") : `<div class="empty">Nothing has been completed yet.</div>`}</details>${
    research.length
      ? `<details><summary>Research in progress</summary>${research
          .map(([id, value]) => {
            const tech = technologyDefinition(id),
              threshold = tech?.threshold || 24 + (tech?.prior?.length || 0) * 14;
            return `<div class="row between"><span>${esc(tech?.name || titleCase(id))}</span><b>${value.toFixed(1)} / ${threshold}</b></div>`;
          })
          .join("")}</details>`
      : ""
  }${controls}`;
}

const organismInspectorSocietyBase = organismInspector;
organismInspector = function (id) {
  let html = organismInspectorSocietyBase(id);
  const c = W.components.cognition?.[id],
    ctrl = W.components.genome?.[id]?.controller,
    w = W.components.work?.[id];
  if (!c || !ctrl) return html;
  const labels = ["Forage", "Recovery", "Alarm", "Bond / home", "Labor / shelter"],
    tools = (W.components.inventory[id]?.artifactIds || [])
      .map((eid) => W.artifacts.find((a) => a.entityId === eid))
      .filter((a) => isFunctionalTool(a)),
    target = w?.targetTile >= 0 ? xy(w.targetTile).join(", ") : "none",
    equipped = W.artifacts.find((a) => a.entityId === w?.toolId),
    states = labels
      .map((label, n) => {
        const value = c.state[n] || 0;
        return `<div><div class="row between"><span>${label}</span><b>${(value / LTC_Q).toFixed(2)}</b></div><div class="bar"><i style="width:${clamp(((value + LTC_Q) / (LTC_Q * 2)) * 100, 0, 100)}%;background:${n === 2 ? "#e9825d" : n === 4 ? "var(--gold)" : "var(--cyan)"}"></i></div></div>`;
      })
      .join("");
  html += `<div class="subhead">Liquid-time-constant cognition</div><div class="card"><div class="row between"><b>Dominant drive: ${esc(titleCase(c.dominant || "wander"))}</b><span class="tag good">${Math.round((c.confidence / LTC_Q) * 100)}% confidence</span></div><div class="stack" style="margin-top:9px">${states}</div><div class="kv" style="margin-top:9px"><span>Inherited memory horizons</span><b>${Array.from(
    ctrl.tau,
  )
    .map((v) => (v / LTC_Q).toFixed(1) + "t")
    .join(
      " · ",
    )}</b><span>Learning rate</span><b>${ctrl.plasticity}/${LTC_Q}</b><span>Last reward</span><b>${(c.lastReward / LTC_Q).toFixed(3)}</b><span>Network updates / influences</span><b>${c.updates} / ${c.influenceCount}</b><span>Current work</span><b>${esc(w?.phase || w?.task || "none")}</b><span>Target tile</span><b>${target}</b><span>Equipped tool</span><b>${esc(equipped?.name || "hands / body")}</b></div></div>${tools.length ? `<details><summary>Functional tools · ${tools.length}</summary>${tools.map((tool) => `<div class="card" style="margin:6px 0"><div class="row between"><b>${esc(tool.name)}</b><span class="tag">Q${tool.quality}</span></div><small class="muted">${esc(tool.tool.capabilities.join(" · "))} · wear ${tool.tool.wear}/${tool.tool.durability} · actual matter: ${esc(chemistryRowsInline(tool.composition))}</small></div>`).join("")}</details>` : ""}`;
  return html;
};

const organismInspectorExpandedCognitionBase = organismInspector;
organismInspector = function (id) {
  let html = organismInspectorExpandedCognitionBase(id);
  const c = W.components.cognition?.[id];
  if (!c || c.state.length < 8) return html;
  const labels = ["Prey prediction", "Escape planning", "Memory / novelty"],
    states = labels
      .map((label, n) => {
        const value = c.state[n + 5] || 0;
        return `<div><div class="row between"><span>${label}</span><b>${(value / LTC_Q).toFixed(2)}</b></div><div class="bar"><i style="width:${clamp(((value + LTC_Q) / (LTC_Q * 2)) * 100, 0, 100)}%;background:${n === 1 ? "#e9825d" : "var(--cyan)"}"></i></div></div>`;
      })
      .join(""),
    senses = Array.from(c.inputs || [])
      .map((value, n) => ({ label: LTC_SENSE_LABELS[n], value }))
      .filter((x) => x.label && x.value > 0)
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 10),
    drives = LTC_ACTIONS.map((label, n) => ({ label, value: c.output[n] || 0 }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 7),
    senseRows = senses
      .map(
        (x) =>
          `<div class="row between"><span>${esc(x.label)}</span><b>${Math.round((x.value / LTC_Q) * 100)}%</b></div><div class="bar"><i style="width:${clamp((x.value / LTC_Q) * 100, 0, 100)}%;background:var(--cyan)"></i></div>`,
      )
      .join(""),
    driveRows = drives
      .map(
        (x) =>
          `<div class="row between"><span>${esc(titleCase(x.label))}</span><b>${x.value >= 0 ? "+" : ""}${Math.round((x.value / LTC_Q) * 100)}%</b></div><div class="bar"><i style="width:${clamp(((x.value + LTC_Q) / (LTC_Q * 2)) * 100, 0, 100)}%;background:${x.label === c.dominant ? "var(--gold)" : "#8298a3"}"></i></div>`,
      )
      .join("");
  return (
    html +
    `<details open><summary>Extended sensory controller</summary><div class="stack">${states}</div><div class="kv" style="margin-top:9px"><span>Network topology</span><b>${LTC_SENSE_LABELS.length} senses → ${LTC_HIDDEN} liquid states → ${LTC_ACTIONS.length} drives</b><span>Connections</span><b>${LTC_INPUT_BASE.length} sensory · ${LTC_REC_BASE.length} recurrent · ${LTC_OUT_BASE.length} action</b><span>Tracked threat / prey</span><b>${W.components.life[id].threatId || "none"} / ${W.components.life[id].preyTargetId || "none"}</b></div><div class="divider"></div><b>Strongest live inputs</b><div class="stack" style="margin-top:7px">${senseRows || `<small class="muted">Controller is waiting for its next sensory update.</small>`}</div><div class="divider"></div><b>Leading action drives</b><div class="stack" style="margin-top:7px">${driveRows}</div></details>`
  );
};

function placeResearchLedger(place) {
  const samples = Array.from(place.researchInventory || [])
      .map((amount, sp) => ({ amount, sp }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount || a.sp - b.sp),
    known = (place.knownProcesses || []).map(technologyDefinition).filter(Boolean),
    needs = eligibleResearchMaterialNeeds(place),
    frontier = (W.settlements.includes(place) ? [...TECH_BASE, ...ADVANCED_TECH_BASE] : [])
      .filter(
        (t) =>
          !(place.knownProcesses || []).includes(t.id) &&
          (t.prior || []).every((id) => (place.knownProcesses || []).includes(id)),
      )
      .slice(0, 3)
      .map((tech) => ({ tech, blockers: technologyBlockers(place, tech) }));
  if (!samples.length && !known.length && !needs.length && !frontier.length) return "";
  return `<details><summary>Knowledge and physical samples</summary><div class="kv"><span>Reproducible processes</span><b>${known.map((t) => esc(t.name)).join(" / ") || "oral experimentation"}</b><span>Archived samples</span><b>${samples.map((x) => `${esc(W.definitions.species[x.sp].name)} ${x.amount}`).join(" / ") || "none yet"}</b><span>Needed samples</span><b>${needs.map((x) => `${esc(W.definitions.species[x.sp].name)} for ${esc(technologyDefinition(x.techId)?.name || titleCase(x.techId))}`).join(" / ") || "current prerequisites supplied"}</b>${frontier.map(({ tech, blockers }) => `<span>${esc(tech.name)}</span><b>${blockers.length ? `blocked: ${esc(blockers.join(" · "))}` : `research underway ${(place.researchProgress?.[tech.id] || 0).toFixed(1)} / ${tech.threshold || 24 + (tech.prior?.length || 0) * 14}`}</b>`).join("")}</div></details>`;
}
const settlementCardSocietyBase = settlementCard;
settlementCard = function (s) {
  return settlementCardSocietyBase(s) + placeDevelopmentCard(s, true) + placeResearchLedger(s);
};
const nonLifeInspectorSocietyBase = nonLifeInspector;
nonLifeInspector = function (id) {
  const html = nonLifeInspectorSocietyBase(id),
    camp = W.camps.find((c) => c.entityId === id),
    artifact = W.artifacts.find((a) => a.entityId === id);
  if (camp) return html + placeDevelopmentCard(camp, true) + placeResearchLedger(camp);
  if (artifact?.tool)
    return (
      html +
      `<div class="subhead">Functional tool</div><div class="card"><div class="kv"><span>Purpose</span><b>${esc(artifact.tool.purpose)}</b><span>Capabilities</span><b>${esc(artifact.tool.capabilities.join(" · "))}</b><span>Edge hardness</span><b>${artifact.tool.edgeHardness}</b><span>Impact transfer</span><b>${artifact.tool.impact}</b><span>Wear</span><b>${artifact.tool.wear} / ${artifact.tool.durability}</b></div></div>`
    );
  return html;
};

const refreshInspectorSocietyBase = refreshInspector;
refreshInspector = function () {
  if (document.activeElement?.matches?.("[data-city-priority]")) return;
  return refreshInspectorSocietyBase();
};
const refreshWorldInfoSocietyBase = refreshWorldInfo;
refreshWorldInfo = function () {
  refreshWorldInfoSocietyBase();
  const c = civilizationSummary(),
    fullStages = ["cellular", "colonial", ...CIV_STAGE_ORDER],
    current = 2 + c.stageIndex,
    next = CIV_STAGE_ORDER[c.stageIndex + 1],
    gate = civilizationGateStatus(),
    card = `<div class="subhead">Cell-to-civilization progression</div><div class="card"><div class="row between"><b>${esc(titleCase(c.stage))}</b><span class="tag gold">terrestrial endpoint: ${esc(c.endpoint)}</span></div><div class="row wrap" style="margin-top:9px">${fullStages.map((stage, n) => `<span class="tag ${n <= current ? "good" : ""}">${n <= current ? "✓ " : ""}${esc(titleCase(stage))}</span>`).join("")}</div><div class="kv" style="margin-top:9px"><span>Next gated transition</span><b>${esc(next ? titleCase(next) : "Endpoint achieved")}</b>${gate ? `<span>Gate requirement</span><b>${esc(gate.requirement)}</b><span>Closest candidate</span><b>${gate.leader ? `${esc(gate.leader)}${gate.missing.length ? ` — still needs: ${esc(gate.missing.join(" · "))}` : " — requirements met"}` : esc(gate.missing.join(" · ") || "requirements met")}</b>` : ""}<span>World buildings (all places)</span><b>${c.buildings.complete} complete / ${c.buildings.planned} active</b><span>Functional tools</span><b>${c.tools.count}</b><span>LTC decisions influenced</span><b>${fmt(c.cognition.influences)}</b><span>Milestones recorded</span><b>${c.milestones.length}</b></div><div class="divider"></div><small class="muted">Cellular and multicellular emergence remain evolutionary. Tribal, village, civic, urban, and complex terrestrial stages require real tools, structures, population, institutions, and research; spaceflight is intentionally excluded.</small></div>`;
  DOM.worldPane.innerHTML = DOM.worldPane.innerHTML.replace(
    `<div class="subhead">Chemistry viability`,
    `${card}<div class="subhead">Chemistry viability`,
  );
};
const refreshStatsSocietyBase = refreshStats;
refreshStats = function () {
  refreshStatsSocietyBase();
  const c = civilizationSummary(),
    workers =
      Object.entries(c.workers)
        .filter(([, n]) => n)
        .map(([k, n]) => `${titleCase(k)} ${n}`)
        .join(" · ") || "idle";
  DOM.statsBody.insertAdjacentHTML(
    "afterbegin",
    `<div class="subhead">Civilization simulation</div><div class="card"><div class="row between"><b>${esc(titleCase(c.stage))}</b><span class="tag">${c.buildings.complete} structures · ${c.tools.count} tools</span></div><div class="kv" style="margin-top:8px"><span>Active construction</span><b>${c.buildings.planned}</b><span>Workforce</span><b>${esc(workers)}</b><span>Gathered / delivered matter</span><b>${fmt(c.metrics.gathered)} / ${fmt(c.metrics.delivered)}</b><span>Construction labor</span><b>${fmt(c.metrics.constructionWork)}</b><span>LTC agents</span><b>${c.cognition.agents}</b><span>Network updates / influences</span><b>${fmt(c.cognition.updates)} / ${fmt(c.cognition.influences)}</b><span>Mean confidence</span><b>${pct(c.cognition.confidence * 100)}</b></div></div>`,
  );
};
const refreshCountsSocietyBase = refreshCounts;
refreshCounts = function () {
  refreshCountsSocietyBase();
  DOM.populationCounts.innerHTML =
    DOM.populationCounts.innerHTML.replace(
      "Proto-people",
      W.civilization.stageIndex > 0 ? "People" : "Proto-people",
    ) +
    [
      ["Buildings", W.buildings.filter((b) => b.complete && !b.ruined).length],
      ["Active projects", W.buildings.filter((b) => !b.complete && !b.ruined).length],
      ["Functional tools", W.artifacts.filter((a) => isFunctionalTool(a)).length],
    ]
      .map(([k, v]) => `<span>${k}</span><b class="mono">${fmt(v)}</b>`)
      .join("");
};

function recordCityDirective(place, kind, label, data = {}) {
  const tile = idx(place.x, place.y),
    entry = {
      id: W.interventions.length + 1,
      tick: W.tick,
      tool: "city-management",
      label,
      tile,
      brush: 0,
      sequence: W.interventions.length,
      data: { kind, id: place.id, ...data },
    };
  W.interventions.push(entry);
  W.civicMetrics.policyChanges++;
  const ev = emitEvent("PolicyChangedEvent", {
    subjects: [place.entityId].filter(Boolean),
    location: tile,
    causes: [place.importantEvents?.at(-1) || W.causalIndex.entity[place.entityId] || 0],
    evidence: [
      label,
      "the directive changes priorities but creates no matter",
      "workers retain survival overrides and individual cognition",
    ],
    importance: 2,
    data: { name: label, place: place.name, ...data },
  });
  entry.eventId = ev.id;
  if (place.importantEvents) place.importantEvents.push(ev.id);
  worldHash();
  return ev;
}
function setCityPriority(kind, id, key, value, announce = true) {
  const place = managedPlace(kind, id),
    valid = Object.keys(defaultCityManagement().priorities);
  if (!place || !valid.includes(key)) return false;
  const next = clamp(Math.round(Number(value) || 1), 1, 5),
    prior = place.management.priorities[key];
  if (prior === next) return true;
  place.management.priorities[key] = next;
  if (announce)
    recordCityDirective(
      place,
      kind,
      `${titleCase(key)} priority changed from ${prior} to ${next}`,
      { priority: key, value: next },
    );
  return true;
}
function setCityPolicy(kind, id, policy, announce = true) {
  const place = managedPlace(kind, id),
    preset = CITY_POLICY_PRESETS[policy];
  if (!place || !preset) return false;
  place.management = {
    policy,
    priorities: { ...preset.priorities },
    reserve: preset.reserve,
    expansion: preset.expansion,
  };
  if (announce)
    recordCityDirective(place, kind, `${titleCase(policy)} management policy adopted`, { policy });
  ensurePlacePlans(place);
  return true;
}
function requestCityBuilding(kind, id, type, announce = true) {
  const place = managedPlace(kind, id),
    allowed = availableBuildingTypes(place || {});
  if (!place || !allowed.includes(type) || activeBuildings(place).length >= 6) return null;
  const existing = W.buildings.filter(
    (b) => !b.ruined && b.placeKind === kind && b.placeId === place.id && b.type === type,
  );
  if (existing.length && !["shelter", "wall"].includes(type)) return null;
  const b = planBuilding(
    place,
    type,
    place.management.priorities[BUILDING_DEFS[type].priority] || 3,
  );
  if (b && announce)
    recordCityDirective(place, kind, `${b.name} construction was prioritized`, {
      buildingId: b.id,
      type,
    });
  return b;
}
