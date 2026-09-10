// 121. THE LIVED-IN CITY — a bed has an address, a home has a household.
// A resident used to choose the nearest shelter on every return, while the
// renderer invented a different home. Keep one tenancy in the world instead.
const HABITATION_TYPES = new Set(["shelter", "tenement", "tower"]);
// How often a grown child left home, and how often there was nowhere to go.
const HABITATION = { leftHome: 0, stayedHome: 0 };
for (const type of ["tenement", "tower", "office"]) INTERIOR_BUILDING_TYPES.add(type);
function habitationBeds(b) {
  return b && b.complete && !b.ruined && !b.abandoned && HABITATION_TYPES.has(b.type)
    ? Math.max(0, b.housing || BUILDING_DEFS[b.type]?.housing || 0) : 0;
}
function habitationHome(id) {
  const social = W.components.social[id], home = social?.homeBuildingId;
  return home && social.homePlaceKind === "settlement" ? W.buildings.find((b) =>
    b.id === home && b.placeId === social.homePlaceId && habitationBeds(b) > 0) || null : null;
}
function habitationResidents(town) {
  return W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) &&
    W.components.social[id]?.homePlaceKind === "settlement" && W.components.social[id]?.homePlaceId === town.id)
    .sort((a, b) => a - b);
}
// A grown child leaves home when there is a home to leave into. In a town of
// masonry and law that is rare, so the household is the whole line under one
// roof; in a city with current and a surplus of beds it is ordinary, and the
// household narrows to a couple and the children who cannot yet keep
// themselves. Nothing forces it either way — the beds decide, and the beds
// come with the city.
function habitationSpareBeds(town) {
  let beds = 0;
  for (const b of W.buildings)
    if (b.placeKind === "settlement" && b.placeId === town.id) beds += habitationBeds(b);
  return beds - habitationResidents(town).length;
}
function habitationFamilies(town, residents) {
  if (!cityKnows(town, "masonry", "governance")) return householdGroups(residents);
  const modern = cityKnows(town, "electricity") || cityKnows(town, "computing");
  // Partners and dependent children stay together; kinship is never erased.
  const ids = new Set(residents), used = new Set(), groups = [];
  let rooms = modern ? Math.max(0, habitationSpareBeds(town)) : 0;
  for (const id of residents) {
    if (used.has(id) || !isAdultPerson(id)) continue;
    const group = [id], partner = W.components.social[id]?.partnerId;
    if (ids.has(partner) && !used.has(partner) && partner !== id) group.push(partner);
    for (const parent of group.slice())
      for (const child of W.components.identity[parent]?.children || []) {
        if (!ids.has(child) || used.has(child) || group.includes(child)) continue;
        if (!isAdultPerson(child)) {
          group.push(child);
          continue;
        }
        // Grown, and the city has a bed spare: a household of their own.
        if (rooms > 0) {
          rooms--;
          HABITATION.leftHome = (HABITATION.leftHome || 0) + 1;
          continue;
        }
        group.push(child);
        HABITATION.stayedHome = (HABITATION.stayedHome || 0) + 1;
      }
    group.forEach((x) => used.add(x));
    groups.push(group);
  }
  for (const id of residents) if (!used.has(id)) groups.push([id]);
  return groups;
}
function updateHabitationTown(town) {
  const residents = habitationResidents(town), living = new Set(residents),
    homes = W.buildings.filter((b) => b.placeKind === "settlement" && b.placeId === town.id && habitationBeds(b) > 0)
      .sort((a, b) => a.id - b.id),
    byId = new Map(homes.map((b) => [b.id, b]));
  for (const b of homes) {
    b.tenancy ||= { ownerId: 0, residents: [], arrears: {}, decor: [], lastAccountsYear: -1 };
    b.tenancy.residents = [];
    if (b.tenancy.ownerId && !classifyAlive(b.tenancy.ownerId)) {
      const heirs = (W.components.identity[b.tenancy.ownerId]?.children || []).filter((id) => living.has(id));
      b.tenancy.ownerId = heirs[0] || 0;
    }
  }
  for (const group of habitationFamilies(town, residents)) {
    const old = byId.get(W.components.social[group[0]]?.homeBuildingId),
      room = (b) => habitationBeds(b) - b.tenancy.residents.length;
    // Keep the address when it fits. Only split a household if no whole home
    // can take it, and never count an imaginary bed in a full building.
    const together = old && room(old) >= group.length ? old : homes.find((b) => room(b) >= group.length);
    for (const id of group) {
      const b = together || homes.find((h) => room(h) > 0), social = W.components.social[id];
      social.homeBuildingId = b?.id || 0;
      social.householdId = group[0];
      if (b) b.tenancy.residents.push(id);
    }
  }
  // A homestead belongs to the household that first occupies it. Apartment
  // blocks remain municipal until a resident purchases one from the treasury.
  for (const b of homes) {
    if (b.type === "shelter" && !b.tenancy.ownerId) b.tenancy.ownerId = b.tenancy.residents[0] || 0;
    for (const id of Object.keys(b.tenancy.arrears)) if (!b.tenancy.residents.includes(+id)) delete b.tenancy.arrears[id];
  }
  town.habitation = { residents: residents.length, beds: homes.reduce((n, b) => n + habitationBeds(b), 0),
    housed: residents.filter((id) => W.components.social[id].homeBuildingId).length,
    households: new Set(residents.map((id) => W.components.social[id].householdId)).size };
  return homes;
}
function habitationAccounts(town, homes) {
  const year = Math.floor(W.tick / TICKS_PER_YEAR), faction = polityOfPlace(town);
  if (town.habitationAccountsYear === year) return;
  town.habitationAccountsYear = year;
  if (faction && polityCoins(faction)) {
    // Wages come from hired work below. A second payment to every adult here
    // emptied the treasury that must buy grain and finish public buildings.
    for (const b of homes) {
      const tenancy = b.tenancy, owner = W.components.identity[tenancy.ownerId],
        heads = [...new Set(tenancy.residents.map((id) => W.components.social[id].householdId))];
      for (const id of heads) {
        if (tenancy.residents.some((x) => x === tenancy.ownerId && W.components.social[x].householdId === id)) continue;
        const identity = W.components.identity[id];
        if (!identity) continue;
        const due = 1 + (tenancy.arrears[id] || 0), paid = Math.min(due, Math.max(0, identity.civicCoins || 0));
        identity.civicCoins = (identity.civicCoins || 0) - paid;
        if (owner) owner.civicCoins = (owner.civicCoins || 0) + paid;
        else faction.treasury += paid;
        tenancy.arrears[id] = Math.min(12, due - paid);
      }
      if (!tenancy.ownerId) {
        const buyer = tenancy.residents.find((id) => (W.components.identity[id]?.civicCoins || 0) >= habitationBeds(b) * 4);
        if (buyer) {
          const price = habitationBeds(b) * 4;
          W.components.identity[buyer].civicCoins -= price;
          faction.treasury += price;
          tenancy.ownerId = buyer;
        }
      }
    }
  }
  for (const b of homes) {
    if (b.tenancy.decor.length >= 12 || !b.tenancy.residents.length) continue;
    const maker = b.tenancy.residents.find((id) => {
      const inv = W.components.inventory[id]?.materials;
      return inv && inv[C.FIBER] >= 1 && inv[C.PIGMENT] >= 1;
    });
    if (!maker || !b.composition) continue;
    const inv = W.components.inventory[maker].materials;
    if (b.composition[C.FIBER] >= 65535 || b.composition[C.PIGMENT] >= 65535) continue;
    inv[C.FIBER]--; inv[C.PIGMENT]--;
    b.composition[C.FIBER]++; b.composition[C.PIGMENT]++;
    const kinds = cityKnows(town, "writing") ? ["woven rug", "wall picture", "bookshelf", "cushions"] : ["woven rug", "wall picture", "cushions"];
    b.tenancy.decor.push({ kind: kinds[hashParts(W.seedHash, maker, b.id, year) % kinds.length], maker, year,
      hue: Math.floor(visualHash01(maker, b.id) * 360) });
  }
}
const hireHandsHabitationBase = hireHands;
hireHands = function (faction) {
  const hired = hireHandsHabitationBase(faction);
  if (!hired || !faction) return hired;
  const workers = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) &&
    isAdultPerson(id) && W.components.social[id]?.factionId === faction.id && homeSettlementOf(id))
    .sort((a, b) => a - b);
  if (!workers.length) return hired;
  // The works ledger already debited these wages. Give them to the crew
  // instead of issuing a second debit or minting an unrelated income stream.
  const offset = hashParts(W.seedHash, "civic-payroll", faction.id, W.tick) % workers.length;
  for (let n = 0; n < hired; n++) {
    const identity = W.components.identity[workers[(offset + n) % workers.length]];
    identity.civicCoins = (identity.civicCoins || 0) + WORKS_HIRE_COST;
  }
  return hired;
};
const simTickHabitationBase = simTick;
simTick = function () {
  simTickHabitationBase();
  if (W.tick % 256 !== 96) return;
  for (const town of W.settlements) if (!town.ruined) habitationAccounts(town, updateHabitationTown(town));
};
const preferredReturnBuildingHabitationBase = preferredReturnBuilding;
preferredReturnBuilding = function (id) {
  return habitationHome(id) || preferredReturnBuildingHabitationBase(id);
};
const personMayEnterBuildingHabitationBase = personMayEnterBuilding;
personMayEnterBuilding = function (id, b) {
  if (b?.tenancy && HABITATION_TYPES.has(b.type) && ["rest", "return"].includes(W.components.life[id]?.behavior))
    return b.tenancy.residents.includes(id) || b.tenancy.residents.length < habitationBeds(b);
  return personMayEnterBuildingHabitationBase(id, b);
};
const makeInteriorStateHabitationBase = makeInteriorState;
makeInteriorState = function (bounds) {
  const state = makeInteriorStateHabitationBase(bounds);
  for (const b of W.buildings) if (b.tenancy) {
    for (const id of state.homes.get(b.id) || []) state.homeByPerson.delete(id);
    const residents = b.tenancy.residents.filter((id) => classifyAlive(id) && W.components.social[id]?.homeBuildingId === b.id);
    state.homes.set(b.id, residents);
    for (const id of residents) state.homeByPerson.set(id, b.id);
  }
  return state;
};
const drawInteriorFurnitureHabitationBase = drawInteriorFurniture;
// A floor of a block is a floor of flats, not an empty plate. Looked at in the
// browser at close zoom, a tenement cutaway was a coloured lozenge with one
// divider line across it: no walls between the homes, no bed you could see, no
// sign that anyone lived there. It is drawn as a plan now — partitions between
// the units on this floor, and in each unit a bed, a table and whatever the
// household has made for itself.
const HABITATION_ROOMS = 4;
function habitationFloorPlan(g, b, s, r, p, homes) {
  const beds = typeof habitationBeds === "function" ? habitationBeds(b) : 0,
    storeys = typeof blockStoreys === "function" ? Math.max(1, blockStoreys(b)) : 1,
    perFloor = Math.max(1, Math.ceil(beds / storeys)),
    units = Math.max(2, Math.min(HABITATION_ROOMS, Math.ceil(perFloor / 2))),
    w = r * 1.5,
    h = r * 0.78,
    left = s.x - w / 2,
    top = s.y - h * 0.3,
    unitW = w / units;
  g.save();
  // The floor itself, so a room reads as a room and not as the block's colour.
  g.fillStyle = hsl((W.terrainGenome?.baseHue || 35) + 22, 12, 26, 0.55);
  g.fillRect(left, top, w, h);
  g.strokeStyle = p.light;
  g.lineWidth = Math.max(1, r * 0.035);
  for (let n = 0; n <= units; n++) {
    const x = left + unitW * n;
    g.beginPath();
    g.moveTo(x, top);
    // A doorway in each partition: a corridor of flats, not sealed cells.
    g.lineTo(x, top + h * 0.42);
    g.moveTo(x, top + h * 0.68);
    g.lineTo(x, top + h);
    g.stroke();
  }
  g.strokeRect(left, top, w, h);
  const held = b.tenancy?.decor || [];
  for (let n = 0; n < units; n++) {
    const x = left + unitW * n,
      lived = n < homes.length;
    // A bed against the back wall, a table in the middle of the room.
    g.fillStyle = lived ? p.light : hsl(0, 0, 62, 0.5);
    g.fillRect(x + unitW * 0.12, top + h * 0.1, unitW * 0.34, h * 0.3);
    g.fillStyle = lived ? p.accent : hsl(0, 0, 48, 0.5);
    g.fillRect(x + unitW * 0.12, top + h * 0.1, unitW * 0.34, h * 0.1);
    g.fillStyle = hsl((W.terrainGenome?.baseHue || 35) + 40, 16, 44);
    g.fillRect(x + unitW * 0.56, top + h * 0.52, unitW * 0.3, h * 0.22);
    // What the household has made. Each unit shows its own share, so a block
    // whose people have been weaving for a century looks like it.
    const item = held[n];
    if (!item) continue;
    g.fillStyle = hsl(item.hue, 46, 56);
    if (item.kind === "woven rug") g.fillRect(x + unitW * 0.2, top + h * 0.74, unitW * 0.6, h * 0.16);
    else if (item.kind === "bookshelf") {
      for (let j = 0; j < 4; j++) {
        g.fillStyle = hsl(item.hue + j * 34, 40, 50);
        g.fillRect(x + unitW * (0.16 + j * 0.09), top + h * 0.76, unitW * 0.06, h * 0.16);
      }
    } else g.fillRect(x + unitW * 0.62, top + h * 0.14, unitW * 0.24, h * 0.18);
  }
  g.restore();
}
drawInteriorFurniture = function (g, b, s, r, p, homes) {
  if (HABITATION_TYPES.has(b.type) && b.type !== "shelter") return habitationFloorPlan(g, b, s, r, p, homes);
  drawInteriorFurnitureHabitationBase(g, HABITATION_TYPES.has(b.type) ? { ...b, type: "shelter" } : b, s, r, p, homes);
  for (const [n, item] of (b.tenancy?.decor || []).slice(-4).entries()) {
    const x = s.x - r * 0.65 + n * r * 0.4, y = s.y - r * 0.65;
    g.fillStyle = hsl(item.hue, 48, 58);
    if (item.kind === "woven rug") {
      g.fillRect(x, s.y + r * 0.22, r * 0.3, r * 0.18);
      g.strokeStyle = p.light; g.strokeRect(x + r * 0.03, s.y + r * 0.25, r * 0.24, r * 0.12);
    } else {
      g.fillRect(x, y, r * 0.26, r * 0.2);
      g.strokeStyle = p.dark; g.strokeRect(x, y, r * 0.26, r * 0.2);
      if (item.kind === "bookshelf") for (let j = 0; j < 4; j++) {
        g.fillStyle = hsl(item.hue + j * 36, 40, 48); g.fillRect(x + r * j * 0.06, y + r * 0.02, r * 0.035, r * 0.15);
      }
    }
  }
};
UI.camera.interiorFloor = 0;
const refreshCameraControlsHabitationBase = refreshCameraControls;
refreshCameraControls = function () {
  refreshCameraControlsHabitationBase();
  if (!DOM.interiorBtn) return;
  if (!DOM.interiorFloorBtn) {
    const button = document.createElement("button");
    button.id = "interiorFloorBtn";
    // Same full width as the interiors toggle it sits under; without the class
    // it rendered at its own natural width and read as a stray control.
    button.className = "camera-cutaway";
    button.title = "Show the next floor of apartment and office cutaways";
    button.onclick = () => {
      const tallest = W ? Math.max(1, ...W.buildings.filter((b) => ["tower", "tenement", "office"].includes(b.type)).map(blockStoreys)) : 1;
      UI.camera.interiorFloor = ((UI.camera.interiorFloor || 0) + 1) % tallest;
      refreshCameraControls();
    };
    DOM.interiorBtn.after(button);
    DOM.interiorFloorBtn = button;
  }
  DOM.interiorFloorBtn.hidden = !UI.camera.cutaway;
  DOM.interiorFloorBtn.textContent = `Floor ${(UI.camera.interiorFloor || 0) + 1} · next`;
};
const drawBuildingInteriorHabitationBase = drawBuildingInterior;
drawBuildingInterior = function (g, b, now, m, state) {
  if (!["tower", "tenement", "office"].includes(b.type)) return drawBuildingInteriorHabitationBase(g, b, now, m, state);
  const floors = blockStoreys(b), floor = Math.min(floors - 1, UI.camera.interiorFloor || 0),
    homes = state.homes.get(b.id) || [], perFloor = Math.max(1, Math.ceil(habitationBeds(b) / floors)),
    onFloor = homes.slice(floor * perFloor, (floor + 1) * perFloor),
    inside = (state.inside.get(b.id) || []).filter((id) => homes.includes(id) ? onFloor.includes(id) : id % floors === floor),
    local = { ...state, homes: new Map(state.homes), inside: new Map(state.inside) };
  local.homes.set(b.id, onFloor); local.inside.set(b.id, inside);
  drawBuildingInteriorHabitationBase(g, b, now, m, local);
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m), r = buildingScreenSize(b, m);
  // The label crowded the map: every block in view wrote its floor across its
  // neighbours. Only a block big enough on screen to be the one you are looking
  // at says which floor it is showing.
  if (r < 26) return;
  g.save(); g.font = `${Math.max(9, Math.min(13, r * 0.28))}px sans-serif`;
  g.textAlign = "center"; g.fillStyle = "#f2e8d4";
  g.fillText(`Floor ${floor + 1}/${floors} · ${onFloor.length} residents`, s.x, s.y - r * 1.03); g.restore();
};
const renderPlacePageHabitationBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageHabitationBase(id), town = W.settlements.find((s) => s.id === id);
  if (!town?.habitation) return html;
  const h = town.habitation, rows = W.buildings.filter((b) => b.placeId === id && habitationBeds(b) && b.tenancy)
    .map((b) => `<div class="kv"><span>${esc(b.name || BUILDING_DEFS[b.type]?.name || b.type)}</span><b>${b.tenancy.residents.length}/${habitationBeds(b)} beds · ${b.tenancy.ownerId ? esc(entityName(b.tenancy.ownerId)) : "municipal"} · ${b.tenancy.decor.length} furnishings</b></div>`).join("");
  return html + `<div class="subhead">Homes and households</div><p>${h.housed} housed; ${h.residents - h.housed} seeking a bed. ${h.households} households. Apartment rent: one coin per household per year when the polity uses currency.</p>${rows}`;
};
const renderLifePageHabitationBase = renderLifePage;
renderLifePage = function (id) {
  const html = renderLifePageHabitationBase(id), b = habitationHome(id), ident = W.components.identity[id];
  return html + (b ? `<div class="kv"><span>Home</span><b>${esc(b.name || b.type)} · ${b.tenancy?.ownerId === id ? "owner" : "resident"}</b></div>` : "") +
    (ident?.civicCoins != null ? `<div class="kv"><span>Household savings</span><b>${ident.civicCoins} coin</b></div>` : "");
};
window.ALIFE_HABITATION_DEBUG = Object.freeze({
  update: () => { for (const s of W.settlements) if (!s.ruined) habitationAccounts(s, updateHabitationTown(s)); },
  home: (id) => habitationHome(id)?.id || 0,
  homes: () => W.buildings.filter((b) => habitationBeds(b)).map((b) => ({ id: b.id, capacity: habitationBeds(b), ...b.tenancy })),
  families: () => ({ ...HABITATION }),
  spare: (placeId) => habitationSpareBeds(W.settlements.find((s) => s.id === placeId)),
});
