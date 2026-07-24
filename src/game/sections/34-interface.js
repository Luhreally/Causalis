// ═══════════════════════════════════════════════════════════════════════════
// 34. INTERFACE AND INSPECTOR
// ═══════════════════════════════════════════════════════════════════════════
function selectTile(tile) {
  UI.selectedTile = tile;
  UI.selectedEntity = 0;
  UI.selectedEvent = 0;
  refreshInspector();
  refreshTabs("inspect");
}
function selectEntity(id) {
  if (!W.kind[id] && !W.historicalIdentities[id]) return;
  UI.selectedEntity = id;
  const p = W.components.position[id];
  if (p) UI.selectedTile = idx(p.x, p.y);
  refreshInspector();
  refreshTabs("inspect");
}
function refreshTabs(tab) {
  UI.activeTab = tab;
  $$(`.tab`).forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$(`.tabpane`).forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
  if (tab === "chronicle") refreshChronicle();
  if (tab === "warfare") refreshWarfare();
  if (tab === "worldinfo") refreshWorldInfo();
  if (tab === "stats") refreshStats();
}
function chemistryRows(q, limit = 10) {
  const rows = [];
  for (let i = 0; i < q.length; i++) if (q[i] > 0) rows.push([i, q[i]]);
  rows.sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] || 1;
  return (
    rows
      .slice(0, limit)
      .map(
        ([i, v]) =>
          `<div class="chem-row"><span title="${esc(W.definitions.species[i].role)}">${esc(W.definitions.species[i].name)}</span><span class="chem-bar"><i style="width:${(v / max) * 100}%;background:${hsl(W.definitions.species[i].colorHue, 65, 55)}"></i></span><b class="mono">${fmt(v)}</b></div>`,
      )
      .join("") || `<div class="empty">No measurable inventory</div>`
  );
}
function tileChemVector(i) {
  const q = new Uint16Array(SPECIES_COUNT);
  for (let s = 0; s < COMMON_CHEM; s++) q[s] = W.tiles.chem[s][i];
  for (const [key, v] of Object.entries(W.tiles.rareChem)) {
    const [ti, sp] = key.split(":").map(Number);
    if (ti === i) q[sp] = v;
  }
  return q;
}
function tileInspector(i) {
  const [x, y] = xy(i),
    mat = tileMaterial(i),
    ph = phasesAt(i),
    q = tileChemVector(i),
    waterline = W.tiles.hydrologyBase?.[i] || 0,
    runoff = Math.max(0, W.tiles.liquid[i] - waterline),
    owner = W.factions.find((f) => f.id === W.tiles.owner[i]),
    culture = W.cultures.find((c) => c.id === W.tiles.cultureOwner[i]),
    near = entityAtRadius(i, 2).slice(0, 18),
    settlement = nearestSettlement(i, 2);
  return `<div class="eyebrow">Tile ${x}, ${y}</div><h3 style="margin:5px 0 2px">${biomeAt(i)}</h3><div class="muted">${esc(mat.name)} · ${W.tiles.elevation[i]} elevation units</div><div class="subhead">Derived environment</div><div class="kv"><span>Temperature</span><b>${(W.tiles.temperature[i] / 10).toFixed(1)}°</b><span>Liquid depth</span><b>${W.tiles.liquid[i]}</b><span>Natural waterline</span><b>${waterline}</b><span>Transient runoff</span><b>${runoff}</b><span>Moisture</span><b>${tileMoisture(i).toFixed(1)}%</b><span>Fertility</span><b>${tileFertility(i).toFixed(1)}%</b><span>Food abundance</span><b>${tileFood(i, "omnivore").toFixed(1)}</b><span>Fire / smoke</span><b>${Math.round(W.tiles.fire[i] / 10)} / ${tileSmoke(i).toFixed(1)}</b><span>Blood / fear signal</span><b>${tileBlood(i).toFixed(1)} / ${tileFear(i).toFixed(1)}</b><span>Pathogen pressure</span><b>${tileDisease(i).toFixed(1)}</b><span>Danger</span><b>${Math.round(W.tiles.danger[i] / 10)}</b><span>Territory</span><b>${owner ? esc(owner.name) : "Unclaimed"} (${Math.round(W.tiles.territory[i] / 10)})</b><span>Culture</span><b>${culture ? esc(culture.name) : "Diffuse"} (${Math.round(W.tiles.culture[i] / 10)})</b></div><details open><summary>Chemical substrate · ${fmt(sum(Array.from(q)))} mass</summary><div>${chemistryRows(q)}<div class="divider"></div><div class="kv"><span>Solid phase</span><b>${ph.solid.toFixed(0)}%</b><span>Liquid phase</span><b>${ph.liquid.toFixed(0)}%</b><span>Gas phase</span><b>${ph.gas.toFixed(0)}%</b><span>Stored free energy</span><b>${fmt(q[C.ENERGY] * W.definitions.species[C.ENERGY].freeEnergy)}</b><span>Nutrients</span><b>${q[C.NUTRIENT]}</b><span>Toxins</span><b>${q[C.TOXIN]}</b><span>Catalysts</span><b>${q[C.CATALYST]}</b><span>Organic matter</span><b>${q[C.ORGANIC]}</b><span>Active reactions</span><b>${activeReactionsAt(i).join(", ") || "kinetically quiet"}</b></div></div></details><details><summary>Material structure · ${esc(mat.category)}</summary><div class="kv"><span>Composition</span><b>${esc(W.definitions.species[mat.speciesId].name)}</b><span>Structure</span><b>${esc(STRUCTURE_PATTERNS[mat.structurePattern])}</b><span>Hardness</span><b>${mat.hardness}</b><span>Brittleness</span><b>${mat.brittleness}</b><span>Conductivity</span><b>${mat.conductivity}</b><span>Ignition</span><b>${Math.round((1 - mat.flammability) * 700 + 180)}°</b><span>Biological effect</span><b>${mat.toxicity > 0.4 ? "toxic" : mat.biocompatibility > 0.6 ? "compatible" : "mostly inert"}</b><span>Known processing</span><b>${knownUsesForMaterial(mat.speciesId).join(", ") || "none recorded"}</b></div></details>${settlement ? settlementCard(settlement) : ""}<div class="subhead">Nearby identities · ${near.length}</div>${near.length ? near.map(entityRow).join("") : `<div class="empty">No detailed entities nearby</div>`}`;
}
function knownUsesForMaterial(sp) {
  const uses = [];
  for (const s of W.settlements)
    for (const t of TECH_BASE)
      if (s.knownProcesses.includes(t.id) && t.materials.includes(sp)) uses.push(t.name);
  return Array.from(new Set(uses)).slice(0, 4);
}
function entityRow(id) {
  const ident = W.components.identity[id],
    l = W.components.life[id],
    k = W.kind[id];
  return `<div class="entity-row" data-entity="${id}"><div class="title"><b>${esc(ident?.generatedName || titleCase(k))}</b><span class="tag">#${id} ${titleCase(k)}</span></div><small>${l ? `Age ${l.age} · ${l.health?.toFixed?.(0) || 0}% health · ${esc(l.behavior || "still")}` : ident?.titles?.join(", ") || "persistent identity"}${ident?.notable ? " · Notable" : ""}</small></div>`;
}
function personInventoryPanel(id) {
  const inv = W.components.inventory[id];
  if (!inv) return "";
  const mats = [];
  if (inv.materials)
    for (let sp = 0; sp < inv.materials.length; sp++)
      if (inv.materials[sp] > 0) mats.push([sp, inv.materials[sp]]);
  mats.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const slotCss =
    "width:46px;height:46px;border-radius:6px;position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box";
  const matSlots = mats
    .slice(0, 24)
    .map(([sp, n]) => {
      const d = W.definitions.species[sp];
      return `<div title="${esc(d.name)} · ${n} units — ${esc(d.role || "material")}" style="${slotCss};background:${hsl(d.colorHue, 45, 20)};border:1px solid ${hsl(d.colorHue, 55, 42)}"><span style="font-size:9px;color:${hsl(d.colorHue, 70, 80)};text-align:center;line-height:1.05;overflow:hidden;max-height:30px;padding:0 2px">${esc(d.name.split(" ")[0].slice(0, 8))}</span><b style="position:absolute;right:3px;bottom:1px;font-size:10px;color:#ffe9b0">${n > 999 ? "999+" : n}</b></div>`;
    })
    .join("");
  const artifacts = (inv.artifactIds || [])
    .map((eid) => W.artifacts.find((a) => a.entityId === eid))
    .filter(Boolean)
    .sort((left, right) => {
      const lc = equipmentDisplayCategory(left),
        rc = equipmentDisplayCategory(right);
      return (
        lc.localeCompare(rc) ||
        (left.name || "").localeCompare(right.name || "") ||
        left.entityId - right.entityId
      );
    });
  const arts = artifacts
    .map((a) => {
      const capabilities = a.tool?.capabilities || [],
        wear = a.tool ? 1 - a.tool.wear / Math.max(1, a.tool.durability) : 1,
        functional = !a.tool || a.tool.wear < a.tool.durability,
        category = equipmentDisplayCategory(a),
        war = capabilities.includes("war"),
        hue = W.definitions.species[a.materialId]?.colorHue ?? 40,
        glyph =
          capabilities.includes("gun") || capabilities.includes("firearm")
            ? "✸"
            : capabilities.includes("bow") || capabilities.includes("crossbow")
              ? "➶"
              : capabilities.includes("shield")
                ? "◈"
                : capabilities.includes("armor") || capabilities.includes("helmet")
                  ? "⬡"
                  : war
                    ? "⚔"
                    : capabilities.includes("mine")
                      ? "⛏"
                      : capabilities.includes("cut")
                        ? "🪓"
                        : capabilities.includes("gather")
                          ? "✤"
                          : "🔨",
        form = a.tool?.form || "carried artifact",
        functions = capabilities.length ? capabilities.join(" / ") : "material artifact";
      return `<div data-world-target="${a.entityId}" style="cursor:pointer;display:grid;grid-template-columns:46px minmax(0,1fr);gap:8px;padding:7px;margin:5px 0;border-radius:7px;background:${hsl(hue, 32, 14)};border:1px solid ${war ? "#e0645c" : hsl(hue, 45, 38)}"><div title="${esc(category)}" style="${slotCss};background:${hsl(hue, 40, 18)};border:1px solid ${hsl(hue, 55, 42)}"><span style="font-size:18px">${glyph}</span><i style="position:absolute;left:3px;right:3px;bottom:2px;height:3px;background:#0009;border-radius:2px"><i style="display:block;height:3px;border-radius:2px;width:${Math.round(clamp(wear, 0, 1) * 100)}%;background:${functional && wear > 0.5 ? "#8fc07a" : "#e0645c"}"></i></i></div><div style="min-width:0"><div class="row between"><b>${esc(a.name || form)}</b><span class="tag ${functional ? "" : "red"}">${functional ? "ready" : "broken"}</span></div><small class="gold">${esc(category)} · quality ${a.quality ?? 0} · ${Math.round(clamp(wear, 0, 1) * 100)}% condition</small><div class="muted" style="font-size:11px;margin-top:2px">${esc(form)} · ${esc(functions)}</div></div></div>`;
    })
    .join("");
  return `<details open><summary>Character inventory · ${artifacts.length} equipment item${artifacts.length === 1 ? "" : "s"}</summary><div><div class="subhead">All tools, weapons and armor</div><div class="muted" style="font-size:11px;margin-bottom:4px">Every intact carried item is automatically available to this character in work or combat.</div>${arts || `<span class="muted">bare-handed — no crafted equipment</span>`}<div class="subhead">Carried materials · ${fmt(sum(Array.from(inv.materials || [])))} mass</div><div class="row wrap" style="gap:5px">${matSlots || `<span class="muted">nothing carried</span>`}</div></div></details>`;
}

function equipmentDisplayCategory(artifact) {
  const capabilities = artifact?.tool?.capabilities || [];
  if (capabilities.includes("firearm") || capabilities.includes("gun")) return "Firearm analogue";
  if (capabilities.includes("crossbow")) return "Crossbow analogue";
  if (capabilities.includes("bow")) return "Bow analogue";
  if (capabilities.includes("sling")) return "Sling weapon";
  if (capabilities.includes("shield")) return "Shield";
  if (capabilities.includes("helmet")) return "Helmet";
  if (capabilities.includes("limb_armor")) return "Limb armor";
  if (capabilities.includes("armor")) return "Body armor";
  if (capabilities.includes("war"))
    return capabilities.includes("ranged") ? "Ranged weapon" : "Melee weapon";
  if (artifact?.tool) return `${titleCase(artifact.tool.purpose || "utility")} tool`;
  return "Carried artifact";
}
function organismInspector(id) {
  const k = W.kind[id],
    ident = W.components.identity[id] || W.historicalIdentities[id],
    l = W.components.life[id];
  if (!l)
    return `<div class="eyebrow">Historical identity</div><h3>${esc(ident?.name || ident?.generatedName || `Entity ${id}`)}</h3><div class="empty">Its matter has returned to the environment; its event record remains.</div>`;
  const p = W.components.position[id],
    ph = phenotype(id),
    g = W.components.genome[id],
    ch = W.components.chemistry[id],
    b = W.components.body[id],
    soc = W.components.social[id],
    mem = W.components.memory[id],
    fac = W.factions.find((f) => f.id === soc?.factionId),
    species = W.speciesRegistry[`${k}:${g.lineageId}`],
    parents = ident.parents.map(entityLink),
    children = ident.children.map(entityLink),
    rels = relationsOf(id);
  return `<div class="row between"><div><div class="eyebrow">${titleCase(k)} · #${id}</div><h3 style="margin:4px 0">${esc(ident.generatedName)}</h3><div class="muted">${esc(species?.name || speciesLabel(k, g.lineageId))}${fac ? ` · ${esc(fac.name)}` : ""}</div></div>${classifyAlive(id) ? `<button class="small ${UI.followId === id ? "primary" : ""}" data-follow="${id}">${UI.followId === id ? "Following" : "Follow"}</button>` : ""}</div>${ident.titles.length ? `<div class="row wrap" style="margin-top:8px">${ident.titles.map((t) => `<span class="tag gold">${esc(t)}</span>`).join("")}</div>` : ""}<div class="subhead">Life and causality</div><div class="kv"><span>Age</span><b>${l.age} / ${b.maxAge}</b><span>Health</span><b>${l.health.toFixed(1)}% (structure-derived)</b><span>Energy</span><b>${l.energy.toFixed(1)}% (${ch.q[C.ENERGY]} carrier mass)</b><span>Hunger / thirst</span><b>${l.hunger.toFixed(0)} / ${l.thirst.toFixed(0)}</b><span>Behavior</span><b>${esc(l.behavior || "none")}</b><span>Why?</span><b>${esc(l.behaviorReason || "no active need")}</b><span>Injury / pathogen</span><b>${l.wounded ? "wounded" : "intact"} / ${ch.q[C.PATHOGEN]}</b><span>Cause of death</span><b>${esc(l.causeOfDeath || "—")}</b><span>Significance</span><b>${ident.significance.toFixed(1)}${ident.notable ? " · notable" : ""}</b></div>${k === KINDS.PERSON ? personInventoryPanel(id) : ""}<details open><summary>Body composition and metabolism</summary><div>${chemistryRows(ch.q, 12)}<div class="divider"></div><div class="kv"><span>Stored energy compound</span><b>${esc(W.definitions.species[C.ENERGY].name)} · ${ch.q[C.ENERGY]}</b><span>Pathways</span><b>respiration, digestion, repair, information copying</b><span>Compatible foods</span><b>${esc(b.diet)}</b><span>Waste products</span><b>${esc(W.definitions.species[C.WASTE].name)} · ${ch.q[C.WASTE]}</b><span>Toxins</span><b>${ch.q[C.TOXIN]}</b><span>Boundary integrity</span><b>${l.integrity}/1000</b><span>Tissue allocation</span><b>${Object.entries(
    b.tissues,
  )
    .map(([k, v]) => `${k} ${v}`)
    .join(
      " · ",
    )}</b></div></div></details><details><summary>Information polymer and phenotype</summary><div><div class="mono muted" style="word-break:break-all">${esc(g.polymer)}</div><div class="divider"></div><div class="kv"><span>Lineage</span><b class="mono">${g.lineageId}</b><span>Speed</span><b>${ph.speed.toFixed(2)}</b><span>Size</span><b>${ph.size.toFixed(2)}</b><span>Senses</span><b>${ph.sense.toFixed(2)}</b><span>Heat tolerance</span><b>${ph.heatTolerance.toFixed(1)}°</b><span>Disease resistance</span><b>${pct(ph.diseaseResistance * 100)}</b><span>Aggression</span><b>${pct(ph.aggression * 100)}</b><span>Social / cooperation</span><b>${pct(ph.social * 100)} / ${pct(ph.cooperation * 100)}</b><span>Gene functions</span><b>${g.instructions
    .filter((x) => x.active)
    .map((x) => x.function)
    .join(
      ", ",
    )}</b></div></div></details><details><summary>Kin, memory, and relations</summary><div class="kv"><span>Parents</span><b>${parents.filter(Boolean).join(", ") || "founder network"}</b><span>Children</span><b>${children.filter(Boolean).join(", ") || "none"}</b><span>Partner</span><b>${soc.partnerId ? entityLink(soc.partnerId) || "none" : "none"}</b><span>Kills</span><b>${ident.kills}</b><span>Migrations</span><b>${ident.migrations}</b><span>Remembered events</span><b>${mem.rememberedEvents.slice(-8).join(", ") || "none"}</b><span>Relations</span><b>${
    rels
      .slice(0, 10)
      .map((r) => `${esc(r.type)} ${entityLink(r.from === id ? r.to : r.from) || "lost"}`)
      .join(" · ") || "none"
  }</b></div></details>`;
}
function settlementCard(s) {
  const f = W.factions.find((x) => x.id === s.factionId),
    food = settlementFood(s),
    water = settlementWater(s),
    pop = settlementPopulation(s);
  return `<div class="card" style="margin-top:10px"><div class="row between"><h4>${esc(s.name)}</h4><button class="small" data-settlement-entity="${s.entityId}">${s.ruined ? "Inspect ruin" : "Open record"}</button></div><div class="kv"><span>Founder</span><b>${entityLink(s.founderId) || "unknown"}</b><span>Faction</span><b>${esc(f?.name || "Independent")}</b><span>Population</span><b>${pop}</b><span>Food chemistry</span><b>${food.toFixed(1)}</b><span>Potable solvent</span><b>${water.toFixed(1)}</b><span>Housing</span><b>${s.housing.toFixed(0)}</b><span>Storage</span><b>${s.storageCapacity}</b><span>Defense</span><b>${settlementDefense(s).toFixed(1)}</b><span>Stability</span><b>${pct(s.stability * 100)}</b><span>Culture</span><b>${esc(W.cultures.find((c) => c.id === s.cultureId)?.name || "emergent")}</b><span>Technologies</span><b>${
    s.knownProcesses
      .map((id) => technologyDefinition(id)?.name)
      .filter(Boolean)
      .join(", ") || "oral practice"
  }</b></div><details><summary>Settlement chemistry and production</summary><div>${chemistryRows(s.inventory, 10)}<div class="kv"><span>Material inputs</span><b>${[C.MINERAL, C.FIBER, C.ORE].map((i) => `${W.definitions.species[i].name} ${s.inventory[i]}`).join(" · ")}</b><span>Fuel</span><b>${s.inventory[C.FUEL]}</b><span>Waste / toxins</span><b>${s.inventory[C.WASTE]} / ${s.inventory[C.TOXIN]}</b><span>Construction materials</span><b>${chemistryRowsInline(s.structure.composition)}</b><span>Production</span><b>${
    s.knownProcesses
      .map((id) => technologyDefinition(id)?.process)
      .filter(Boolean)
      .join(", ") || "manual gathering"
  }</b><span>Vulnerabilities</span><b>${food < 10 ? "food chemistry; " : ""}${water < 10 ? "solvent shortage; " : ""}${settlementDisease(s) > 30 ? "pathogen load; " : ""}${s.structure.integrity < 300 ? "structural failure" : "none acute"}</b></div></div></details></div>`;
}
function linkedEventSentence(e) {
  if (!W) return esc(eventSentence(e));
  let html = esc(eventSentence(e));
  const targets = [],
    seen = new Set();
  for (const id of (e.subjects || []).slice(0, 6))
    if (id && !seen.has(id) && (W.kind[id] || W.historicalIdentities[id])) {
      seen.add(id);
      const nm = entityName(id);
      if (nm)
        targets.push({
          name: nm,
          attr: `data-world-target="${id}" data-world-tile="${e.location ?? -1}"`,
        });
    }
  for (const fid of e.factions || e.data?.factions || []) {
    const f = W.factions.find((x) => x.id === fid);
    if (f && !seen.has(f.entityId)) {
      seen.add(f.entityId);
      targets.push({
        name: f.name,
        attr: `data-world-target="${f.entityId}" data-world-tile="${e.location ?? -1}"`,
      });
    }
  }
  if (e.location >= 0 && e.location < W.tileCount) {
    const [x, y] = xy(e.location);
    targets.push({ name: `${x},${y}`, attr: `data-world-goto="${e.location}"` });
  }
  targets.sort((a, b) => b.name.length - a.name.length);
  for (const t of targets) {
    const nm = esc(t.name);
    if (html.includes(nm))
      html = html.replace(
        nm,
        `<span class="gold" ${t.attr} style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px" title="Go to ${nm} in the world">${nm}</span>`,
      );
  }
  return html;
}
function eventTargetChips(e) {
  if (!W) return "";
  const chips = [],
    seen = new Set(),
    tile = e.location ?? -1;
  const add = (id, label, cls = "") => {
    if (!id || seen.has(id) || chips.length >= 5) return;
    seen.add(id);
    chips.push(
      `<span class="tag ${cls}" data-world-target="${id}" data-world-tile="${tile}" style="cursor:pointer" title="Go to ${esc(label)} in the world">${esc(label)}</span>`,
    );
  };
  for (const id of (e.subjects || []).slice(0, 5))
    if (id && (W.kind[id] || W.historicalIdentities[id])) {
      const nm = entityName(id);
      if (nm) add(id, nm);
    }
  for (const fid of e.factions || e.data?.factions || []) {
    const f = W.factions.find((x) => x.id === fid);
    if (f) add(f.entityId, f.name, "gold");
  }
  if (tile >= 0 && tile < W.tileCount) {
    const [x, y] = xy(tile);
    chips.push(
      `<span class="tag" data-world-goto="${tile}" style="cursor:pointer" title="Go to this place">⌖ ${x},${y}</span>`,
    );
  }
  return chips.length
    ? `<div class="row wrap" style="margin-top:4px;gap:4px">${chips.join("")}</div>`
    : "";
}
function entityLink(id) {
  if (!id) return "";
  const nm = entityName(id);
  if (!nm) return "";
  if (!W.kind[id] && !W.historicalIdentities[id]) return esc(nm);
  return `<span class="gold" data-world-target="${id}" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px" title="Go to ${esc(nm)}">${esc(nm)}</span>`;
}
function eventRow(e) {
  if (!e) return "";
  return `<div class="event-row ${e.importance >= 4 ? "major" : ""} ${e.category === "disasters" ? "disaster" : e.category === "technology" ? "tech" : ""}" data-event="${e.id}"><div class="title"><b>Year ${e.year}</b><span class="tag">${titleCase(e.category)}</span></div><small>${linkedEventSentence(e)}</small></div>`;
}
function nonLifeInspector(id) {
  const kind = W.kind[id],
    ident = W.components.identity[id] || W.historicalIdentities[id],
    artifact = W.artifacts.find((a) => a.entityId === id),
    settlement = W.settlements.find((s) => s.entityId === id),
    camp = W.camps.find((c) => c.entityId === id),
    faction = W.factions.find((f) => f.entityId === id),
    culture = W.cultures.find((c) => c.entityId === id);
  if (settlement)
    return `<div class="eyebrow">${settlement.ruined ? "Ruin" : "Persistent settlement"} · #${id}</div>${settlementCard(settlement)}<div class="subhead">Important events</div>${
      settlement.importantEvents.length
        ? settlement.importantEvents
            .slice(-10)
            .map((e) => eventRow(W.events.find((x) => x.id === e)))
            .join("")
        : `<div class="empty">No major event recorded</div>`
    }`;
  if (camp)
    return `<div class="eyebrow">${camp.active ? "Camp" : "Abandoned camp"} · #${id}</div><h3>${esc(camp.name)}</h3><div class="kv"><span>Founder</span><b>${entityLink(camp.founderId) || "unknown"}</b><span>Founded</span><b>Year ${formatYear(camp.foundedTick)}</b><span>Integrity</span><b>${camp.structure.integrity}</b><span>Persistent occupancy</span><b>${camp.stableTicks} ticks</b><span>Stored matter</span><b>${fmt(sum(Array.from(camp.inventory)))}</b></div><details open><summary>Camp inventory</summary>${chemistryRows(camp.inventory, 12)}</details>`;
  if (artifact)
    return `<div class="eyebrow">Artifact · #${id}</div><h3>${esc(artifact.name)}</h3><div class="kv"><span>Creator</span><b>${entityLink(artifact.creatorId) || "unknown"}</b><span>Owner</span><b>${entityLink(artifact.ownerId) || "none"}</b><span>Origin</span><b>${esc(W.settlements.find((s) => s.id === artifact.settlementId)?.name || "unknown")}</b><span>Material</span><b>${esc(W.definitions.species[artifact.materialId].name)}</b><span>Quality</span><b>${artifact.quality}</b><span>Integrity</span><b>${artifact.structure.integrity - artifact.damage}</b><span>Structure</span><b>${esc(STRUCTURE_PATTERNS[artifact.structure.patternId])}</b><span>Creation event</span><b>${artifact.eventIds.join(", ")}</b></div><details open><summary>Conserved composition</summary>${chemistryRows(artifact.composition, 8)}</details>`;
  if (faction)
    return `<div class="eyebrow">Faction · #${id}</div><h3 style="color:${faction.color}">${esc(faction.name)}</h3><div class="kv"><span>Population</span><b>${faction.population}</b><span>Territory</span><b>${faction.territorySize} tiles</b><span>Settlements</span><b>${faction.settlementIds.length}</b><span>Cohesion / stability</span><b>${pct(faction.cohesion * 100)} / ${pct(faction.stability * 100)}</b><span>Technology</span><b>${faction.technologyLevel}</b><span>Military strength</span><b>${faction.militaryStrength.toFixed(1)}</b><span>War pressure</span><b>${faction.warPressure.toFixed(1)}</b></div><button class="small" data-faction="${faction.id}">Open political record</button>`;
  if (culture)
    return `<div class="eyebrow">Culture · #${id}</div><h3>${esc(culture.name)}</h3><div class="kv"><span>Origin</span><b>${esc(W.settlements.find((s) => s.id === culture.originSettlementId)?.name || "lost")}</b><span>Valued substance</span><b>${esc(W.definitions.species[culture.values.substance]?.name || "unknown")}</b><span>Environmental root</span><b>${esc(culture.values.environment)}</b><span>Communal tendency</span><b>${pct(culture.values.communal * 100)}</b><span>Historical drift</span><b>${pct(culture.drift * 100)}</b></div>`;
  const life = W.historicalIdentities[id]?.lifeSummary;
  return `<div class="eyebrow">Historical identity</div><h3>${esc(ident?.name || ident?.generatedName || `Entity ${id}`)}</h3><div class="kv"><span>Last known kind</span><b>${esc(ident?.kind || kind || "unknown")}</b><span>Age</span><b>${life?.age ?? "unknown"}</b><span>Cause of death</span><b>${esc(life?.causeOfDeath || "cohort aggregation or material return")}</b><span>Event record</span><b>${ident?.deathEventId || life?.deathEventId || "causal archive only"}</b></div>`;
}
function chemistryRowsInline(q) {
  return (
    Array.from(q)
      .map((v, i) => (v ? [W.definitions.species[i].name, v] : null))
      .filter(Boolean)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map((x) => `${x[0]} ${x[1]}`)
      .join(" · ") || "none"
  );
}
function refreshInspector() {
  if (!W) return;
  if (UI.selectedEntity) {
    const id = UI.selectedEntity;
    DOM.inspectPane.innerHTML = W.components.life[id]
      ? organismInspector(id)
      : nonLifeInspector(id);
    return;
  }
  if (UI.selectedTile >= 0) {
    DOM.inspectPane.innerHTML = tileInspector(UI.selectedTile);
    return;
  }
  DOM.inspectPane.innerHTML = `<div class="empty"><div style="font-size:24px;color:var(--gold);margin:16px">⌖</div>Choose a tile to inspect the common chemical substrate, nearby lives, materials, and causes.</div>`;
}
const tileInspectorCanonical = tileInspector;
tileInspector = function (i) {
  const canonical = biomeAt(i),
    biome = biomeDisplayName(i),
    spec = featureSpecAt(i),
    sub = W.tiles.subsurfaceType?.[i] || 0,
    subName = W.terrainGenome?.structureGenome?.subsurface?.[sub] || "none",
    n = ecologicalNicheAt(i),
    display = spec?.name || biome;
  let html = tileInspectorCanonical(i).replace(`>${canonical}</h3>`, `>${esc(display)}</h3>`);
  if (spec || sub) {
    const formation = spec
        ? spec.category === "canopy"
          ? "producer growth assembled a persistent vertical habitat"
          : spec.category === "highland"
            ? "tectonic relief and erosion exposed resistant structure"
            : spec.category === "cavern"
              ? "dissolution and fracture opened a connected subsurface void"
              : spec.category === "geothermal"
                ? "interior heat drives a chemical gradient through fractured substrate"
                : spec.category === "aquatic"
                  ? "sessile producers built a three-dimensional aquatic habitat"
                  : "crystallization concentrated ore and catalytic matter"
        : "subsurface continuity extends beneath this tile",
      card = `<div class="subhead">Ecological structure</div><div class="card"><div class="row between"><b>${esc(spec?.name || titleCase(subName))}</b><span class="tag good">${Math.round((W.tiles.featureStrength?.[i] || 450) / 10)}%</span></div><div class="muted" style="margin-top:5px">${esc(biome)} · ${esc(formation)}</div><div class="kv" style="margin-top:8px"><span>Subsurface</span><b>${esc(titleCase(subName))}</b><span>Niche function</span><b>${esc(nicheDescriptionAt(i))}</b><span>Thermal buffering</span><b>${pct(n.thermalBuffer * 100)}</b><span>Shelter complexity</span><b>${pct(n.shelter * 100)}</b><span>Geothermal flux</span><b>${W.tiles.geothermal?.[i] || 0}</b><span>Local relief</span><b>${W.tiles.slope?.[i] || 0}</b></div></div>`;
    html = html.replace(
      `<div class="subhead">Derived environment</div>`,
      `${card}<div class="subhead">Derived environment</div>`,
    );
  }
  return html;
};
function mountCreaturePortrait(id) {
  if (!W.components.genome[id] || !DOM.inspectPane) return;
  const model = creatureModel(id),
    v = makePlanetVisualGenome(),
    host = document.createElement("div");
  host.className = "card";
  host.style.cssText = `margin:10px 0 2px;padding:0;overflow:hidden;background:linear-gradient(145deg,${hsl(v.voidHue, 43, 11)},${hsl(v.atmosphereHue, 42, 7)})`;
  host.innerHTML = `<canvas aria-label="Procedural specimen model"></canvas><div class="row between" style="padding:7px 10px;border-top:1px solid var(--line)"><span class="eyebrow">Seeded anatomy</span><span class="muted">${esc(model.label)} · ${model.appendages} appendages · ${model.eyes} sensors</span></div>`;
  const header = DOM.inspectPane.firstElementChild;
  header?.after(host);
  const canvas = host.querySelector("canvas"),
    width = Math.max(240, Math.floor(host.clientWidth || 280)),
    height = 116,
    dpr = Math.min(2, devicePixelRatio || 1);
  canvas.style.cssText = `display:block;width:100%;height:${height}px`;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = g.createRadialGradient(
    width * 0.52,
    height * 0.44,
    2,
    width * 0.5,
    height * 0.5,
    width * 0.62,
  );
  bg.addColorStop(0, hsl(v.atmosphereHue, 38, 18));
  bg.addColorStop(1, hsl(v.voidHue, 48, 5));
  g.fillStyle = bg;
  g.fillRect(0, 0, width, height);
  g.strokeStyle = hsl(v.accentHue, 52, 67, 0.12);
  for (let n = 0; n < 7; n++) {
    const y = 16 + n * 15;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(width, y - 9);
    g.stroke();
  }
  drawCreatureGlyph(g, id, { x: width * 0.5, y: height * 0.49 }, W.tick * 12, null, 34, true);
}
const refreshInspectorCanonical = refreshInspector;
refreshInspector = function () {
  refreshInspectorCanonical();
  if (UI.selectedEntity && W.components.life[UI.selectedEntity])
    mountCreaturePortrait(UI.selectedEntity);
};

function eventTree(id, depth = 0, seen = new Set()) {
  const e = eventById(id);
  if (!e || seen.has(id) || depth > 5) return "";
  seen.add(id);
  return `<div class="cause-node"><b>Year ${e.year} · ${esc(titleCase(e.type.replace("Event", "")))}</b><div>${esc(eventSentence(e))}</div>${e.evidence.length ? `<small class="muted">Evidence: ${esc(e.evidence.join("; "))}</small>` : ""}${e.causes.map((c) => eventTree(c, depth + 1, seen)).join("")}</div>`;
}
function refreshChronicle() {
  if (!W) return;
  const filters = [
      "all",
      "ecology",
      "people",
      "settlements",
      "factions",
      "technology",
      "war",
      "disasters",
      "species",
    ],
    events = W.events
      .filter((e) => UI.chronicleFilter === "all" || e.category === UI.chronicleFilter)
      .slice(-90)
      .reverse(),
    selected = UI.selectedEvent ? eventById(UI.selectedEvent) : null;
  DOM.chroniclePane.innerHTML = `<div class="filter-pills">${filters.map((f) => `<button class="filter-pill ${UI.chronicleFilter === f ? "active" : ""}" data-filter="${f}">${titleCase(f)}</button>`).join("")}</div>${selected ? `<div class="card"><div class="eyebrow">Causal record #${selected.id}</div><h4 style="margin:5px 0">${linkedEventSentence(selected)}</h4>${eventTargetChips(selected)}<div class="muted">Immediate and root causes</div>${selected.causes.length ? selected.causes.map((c) => eventTree(c)).join("") : `<div class="cause-node">Initial condition or direct intervention</div>`}</div><div class="subhead">Chronicle</div>` : ""}${events.map(eventRow).join("") || `<div class="empty">History is waiting for a change.</div>`}`;
}
function refreshWorldInfo() {
  if (!W) return;
  const laws = Object.entries(W.laws)
      .map(
        ([k, v]) =>
          `<div class="row between"><span class="muted">${titleCase(k)}</span><b class="mono">${typeof v === "number" ? v.toFixed(v > 10 ? 0 : 3) : v}</b></div>`,
      )
      .join(""),
    tests = Object.entries(W.viability.tests)
      .map(
        ([k, v]) =>
          `<span class="tag ${v ? "good" : "red"}"><span class="dot"></span>${titleCase(k)}</span>`,
      )
      .join(""),
    families = W.definitions.families
      .map(
        (f) =>
          `<div class="card"><div class="row between"><b>${esc(f.name)}</b><span class="tag mono">${f.symbol}</span></div><small class="muted">mass ${f.mass} · bonds ${f.bonding} · stability ${f.stability} · catalyst ${f.catalytic}</small></div>`,
      )
      .join("");
  DOM.worldPane.innerHTML = `<div class="eyebrow">Immutable reality</div><h3 style="margin:5px 0">World ${esc(W.seed)}</h3><div class="muted">${W.width} × ${W.height} tile columns · ${W.definitions.families.length} matter families · ${W.definitions.species.length} compounds · ${W.definitions.reactions.length} reactions</div><div class="subhead">Chemistry viability · ${W.viability.passed}/${W.viability.total}</div><div class="row wrap">${tests}</div><div class="subhead">Generated world laws</div><div class="card stack">${laws}</div><details><summary>Fundamental matter families</summary><div class="stack">${families}</div></details><details><summary>Universal process architecture</summary><div class="muted" style="line-height:1.55">The same balanced reaction executor drives combustion, digestion, respiration, decomposition, pathogen replication, healing, photosynthesis, fermentation, corrosion, smelting, ceramic firing, medicine, dissolution, crystallization, and information copying. Higher-level properties are disposable compiled summaries.</div></details><details><summary>Conservation ledger</summary><div class="kv"><span>Current matter</span><b>${fmt(totalMatter())}</b><span>Initial matter</span><b>${fmt(W.conservation.initialMatter)}</b><span>Player matter input</span><b>${fmt(W.conservation.playerInput)}</b><span>Exported matter</span><b>${fmt(W.conservation.exported)}</b><span>Radiant input</span><b>${fmt(W.conservation.radiantInput)}</b><span>Dissipated energy</span><b>${fmt(W.conservation.dissipatedEnergy)}</b><span>Reaction audit</span><b>${auditReactions().ok ? "all mass-balanced" : "imbalance detected"}</b></div></details>`;
}
const refreshWorldInfoCanonical = refreshWorldInfo;
refreshWorldInfo = function () {
  refreshWorldInfoCanonical();
  const v = makePlanetVisualGenome(),
    g = v.terrain,
    card = `<div class="subhead">Procedural planet genome</div><div class="card"><div class="row between"><b>${v.earthlike ? "Earth-adjacent baseline" : `${titleCase(g.topology)} alien world`}</b><span class="tag">${Math.round(v.alienness * 100)}% alien</span></div><div class="kv" style="margin-top:8px"><span>Relief grammar</span><b>${titleCase(g.topology)}</b><span>Climate geometry</span><b>${titleCase(g.climate)}</b><span>Solvent coverage</span><b>${pct(g.targetWater * 100)}</b><span>Producer morphology</span><b>${titleCase(v.floraForm)}</b><span>Geology motif</span><b>${titleCase(v.geologyForm)}</b><span>Solvent surface</span><b>${titleCase(v.waterForm)}</b></div><div class="row" style="margin-top:9px"><span class="dot" style="color:${hsl(v.liquidHue, 65, 52)}"></span><span class="dot" style="color:${hsl(v.floraHue, 62, 52)}"></span><span class="dot" style="color:${hsl(v.mineralHue, 52, 57)}"></span><span class="dot" style="color:${hsl(v.accentHue, 70, 62)}"></span><small class="muted">Palette derived from this world's solvent, pigment, energy, and mineral compounds</small></div></div>`;
  DOM.worldPane.innerHTML = DOM.worldPane.innerHTML.replace(
    `<div class="subhead">Chemistry viability`,
    `${card}<div class="subhead">Chemistry viability`,
  );
};
const refreshWorldInfoPlanet = refreshWorldInfo;
refreshWorldInfo = function () {
  refreshWorldInfoPlanet();
  const b = W.biosphere;
  if (!b) return;
  const available = b.refugia.filter((r) => r.available),
    byKind = (kind) => available.filter((r) => r.kind === kind).length,
    card = `<div class="subhead">Evolutionary emergence</div><div class="card"><div class="row between"><b>${titleCase(b.stage)}</b><span class="tag good"><span class="dot"></span>${available.length} dormant refugia</span></div><div class="kv" style="margin-top:8px"><span>Cellular threshold</span><b>autocatalysis + membrane + heredity</b><span>Colonial transition</span><b>cooperation + chemical division of labor</b><span>Multicellularity</span><b>adhesion + transport + regulation</b><span>Adaptive radiation</span><b>habitat-filtered niche lineages</b><span>Stored propagules</span><b>${byKind(KINDS.HERBIVORE)} grazer · ${byKind(KINDS.PREDATOR)} hunter · ${byKind(KINDS.PERSON)} social</b><span>Dormancy exits</span><b>${b.rescueCount}</b></div><div class="divider"></div><small class="muted">Refugia contain conserved founder matter and hereditary polymers. When a niche approaches extinction, a viable propagule may exit dormancy; its stored chemistry is consumed, not created.</small></div>`;
  DOM.worldPane.innerHTML = DOM.worldPane.innerHTML.replace(
    `<div class="subhead">Chemistry viability`,
    `${card}<div class="subhead">Chemistry viability`,
  );
};
const refreshWorldInfoEcology = refreshWorldInfo;
refreshWorldInfo = function () {
  refreshWorldInfoEcology();
  const grammar = W.terrainGenome?.structureGenome;
  if (!grammar) return;
  const visible = {};
  for (const value of W.tiles.featureType || [])
    if (value) visible[value] = (visible[value] || 0) + 1;
  const rows = Object.values(grammar.categories)
      .map(
        (s) =>
          `<div class="row between"><span>${esc(s.name)}</span><b class="mono">${visible[s.id] || 0} tiles</b></div>`,
      )
      .join(""),
    subsurface = Array.from(W.tiles.subsurfaceType || []).filter(Boolean).length,
    card = `<div class="subhead">Ecological structure genome</div><div class="card"><div class="row between"><b>Six coupled niche systems</b><span class="tag good">${subsurface} subsurface tiles</span></div><div class="stack" style="margin-top:8px">${rows}</div><div class="divider"></div><small class="muted">These are authoritative habitat fields, not cosmetic stamps: they alter food concentration, shelter, thermal buffering, chemosynthetic gradients, resource access, and habitat selection.</small></div>`;
  DOM.worldPane.innerHTML = DOM.worldPane.innerHTML.replace(
    `<div class="subhead">Chemistry viability`,
    `${card}<div class="subhead">Chemistry viability`,
  );
};
function averageTraits(kind) {
  const ids = W.activeIds.filter((id) => W.kind[id] === kind && W.components.genome[id]),
    ps = ids.map(phenotype),
    cohortCount = sum(W.cohorts.filter((c) => c.kind === kind).map((c) => c.count)),
    registry = Object.values(W.speciesRegistry).filter(
      (s) => s.kind === kind && !s.extinct && s.avg,
    ),
    fallback = registry.length
      ? {
          speed: mean(registry.map((s) => s.avg.speed || 1)),
          size: mean(registry.map((s) => s.avg.size || 1)),
          sense: 2,
          resist: mean(registry.map((s) => s.avg.resist || 0)),
          social: kind === KINDS.PERSON ? 0.6 : 0.2,
        }
      : null,
    base = ps.length
      ? {
          speed: mean(ps.map((p) => p.speed)),
          size: mean(ps.map((p) => p.size)),
          sense: mean(ps.map((p) => p.sense)),
          resist: mean(ps.map((p) => p.diseaseResistance)),
          social: mean(ps.map((p) => p.social)),
        }
      : fallback;
  if (!base) return null;
  return { count: ids.length + cohortCount, detailed: ids.length, cohort: cohortCount, ...base };
}
function refreshStats() {
  if (!W) return;
  drawStatsChart();
  const traits = [KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON].map((k) => [k, averageTraits(k)]);
  DOM.statsBody.innerHTML = `<div class="legend" style="margin:7px 0"><span><i style="background:#72d7ca"></i>Population</span><span><i style="background:#79c989"></i>Food</span><span><i style="background:#e06e66"></i>Fire</span><span><i style="background:#a98bd6"></i>Disease</span><span><i style="background:#e4c36a"></i>Settlements</span><span><i style="background:#5fb6db"></i>Technology</span><span><i style="background:#d485bd"></i>Factions</span></div><div class="subhead">Average derived traits</div>${traits.map(([k, t]) => `<div class="card" style="margin-bottom:6px"><h4>${titleCase(k)} · ${t?.count || 0} total${t ? ` · ${t.detailed} detailed · ${t.cohort} cohort` : ""}</h4>${t ? `<div class="kv"><span>Speed</span><b>${t.speed.toFixed(2)}</b><span>Size</span><b>${t.size.toFixed(2)}</b><span>Senses</span><b>${t.sense.toFixed(2)}</b><span>Disease resistance</span><b>${pct(t.resist * 100)}</b><span>Sociality</span><b>${pct(t.social * 100)}</b></div>` : `<div class="muted">No living entities or cohorts</div>`}</div>`).join("")}<div class="subhead">Known species</div>${
    Object.values(W.speciesRegistry)
      .map(
        (s) =>
          `<div class="faction-row"><div class="row between"><b>${esc(s.name)}</b><span class="tag ${s.extinct ? "red" : "good"}">${s.extinct ? "Extinct" : s.count}</span></div><small class="muted">${titleCase(s.kind)} · lineage ${s.lineage}</small></div>`,
      )
      .join("") || `<div class="empty">Classification occurs every 128 ticks.</div>`
  }<div class="subhead">Factions</div>${W.factions.map(factionRow).join("") || `<div class="empty">Settlements have not organized polities yet.</div>`}`;
}
function factionRow(f) {
  return `<div class="faction-row" data-faction="${f.id}"><div class="row between"><b style="color:${f.color}">${esc(f.name)}</b><span class="tag">${f.population} lives</span></div><small class="muted">${f.settlementIds.length} settlements · cohesion ${pct(f.cohesion * 100)} · technology ${f.technologyLevel} · territory ${f.territorySize}</small></div>`;
}
function drawStatsChart() {
  const c = DOM.statsChart,
    g = c.getContext("2d"),
    r = c.getBoundingClientRect(),
    dpr = Math.min(2, devicePixelRatio || 1);
  c.width = Math.max(1, Math.floor(r.width * dpr));
  c.height = Math.max(1, Math.floor(128 * dpr));
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#080e13";
  g.fillRect(0, 0, r.width, 128);
  const h = W.statistics.history;
  if (h.length < 2) return;
  const series = [
    ["population", "#72d7ca"],
    ["food", "#79c989"],
    ["fire", "#e06e66"],
    ["disease", "#a98bd6"],
    ["settlements", "#e4c36a"],
    ["technology", "#5fb6db"],
    ["factions", "#d485bd"],
  ];
  for (const [key, color] of series) {
    const max = Math.max(1, ...h.map((v) => v[key]));
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.beginPath();
    h.forEach((v, i) => {
      const x = 5 + (i / (h.length - 1)) * (r.width - 10),
        y = 121 - (v[key] / max) * 112;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();
  }
  g.strokeStyle = "#253541";
  g.beginPath();
  g.moveTo(4, 121);
  g.lineTo(r.width - 4, 121);
  g.stroke();
}
function refreshTopbar() {
  if (!W) return;
  DOM.topSeed.textContent = W.seed.length > 16 ? W.seed.slice(0, 14) + "…" : W.seed;
  DOM.topTime.textContent = `Tick ${W.tick.toLocaleString()} · Year ${formatYear()}`;
  DOM.topEpoch.textContent = epochName();
  DOM.topWeather.textContent = W.weather.name;
  DOM.topHash.textContent = W.hash;
  DOM.topStatus.innerHTML = `<span class="dot"></span>${UI.running ? "Running" : "Paused"} · ${formatSpeed(UI.speed)}${UI.running && UI.speed >= 64 ? " · fast-forward" : ""}`;
  DOM.topStatus.classList.toggle("paused", !UI.running);
}
function refreshCounts() {
  const p = populationSummary(),
    plants = 0 | (sampleField((i) => (W.tiles.plantOrder[i] > 220 ? 1 : 0)) * W.tileCount),
    items = [
      ["Producer tiles", plants],
      ["Herbivores", p.herbivore],
      ["Predators", p.predator],
      ["Proto-people", p.person],
      ["Corpses", p.corpse],
      ["Camps", W.camps.filter((c) => c.active).length],
      ["Settlements", W.settlements.filter((s) => !s.ruined).length],
      ["Factions", W.factions.filter((f) => f.stability > 0).length],
      ["Active wars", W.activeWars.filter((w) => !w.ended).length],
      ["Known species", Object.values(W.speciesRegistry).filter((s) => !s.extinct).length],
    ];
  DOM.populationCounts.innerHTML = items
    .map(([k, v]) => `<span>${k}</span><b class="mono">${fmt(v)}</b>`)
    .join("");
  DOM.entityCapLabel.textContent = `${W.activeIds.length} detailed · ${W.cohorts.reduce((n, c) => n + c.count, 0)} cohort`;
}
function refreshUI(force = false) {
  if (!W) return;
  if (!force && W.tick === UI.lastUiTick) return;
  const authority = normalizeCivilizationAuthority(),
    stageChanged = UI.lastCivilizationStageIndex !== authority.stageIndex;
  UI.lastUiTick = W.tick;
  UI.lastCivilizationStageIndex = authority.stageIndex;
  refreshTopbar();
  refreshCounts();
  if (UI.activeTab === "inspect") refreshInspector();
  else if (UI.activeTab === "chronicle") refreshChronicle();
  else if (UI.activeTab === "warfare") refreshWarfare();
  else if (UI.activeTab === "worldinfo" && (force || stageChanged || W.tick % 32 === 0))
    refreshWorldInfo();
  else if (UI.activeTab === "stats") refreshStats();
  updateAudioAmbience();
}
