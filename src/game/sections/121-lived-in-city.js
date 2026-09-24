// 121. THE LIVED-IN CITY — a bed has an address, a home has a household.
// A resident used to choose the nearest shelter on every return, while the
// renderer invented a different home. Keep one tenancy in the world instead.
const HABITATION_TYPES = new Set(["shelter", "tenement", "tower"]),
  HABITATION_FILL = Object.freeze({ tower: 0, tenement: 1, shelter: 2 });
// How often a grown child left home, and how often there was nowhere to go.
const HABITATION = { leftHome: 0, stayedHome: 0, evictions: 0, evicted: 0 };
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
    // The blocks fill first. Homes were taken in the order they were built, so a
    // household without an address went to the oldest cottage with room, and at
    // the ship a world of a hundred and forty people lay in fifty-two homes with
    // every tower holding a handful (HANDOFF section 27, the final sweep: beds
    // slept in seven to eighteen in a hundred). A household keeps its address as
    // before; one that has none, a grown child leaving home, a newcomer, a family
    // bought out of its cottage, takes the tower with room, then the tenement,
    // then the cottage, so the old families hold the cottages and the young rent
    // the blocks, and the cottages the old leave empty are bought out (125).
    homes = W.buildings.filter((b) => b.placeKind === "settlement" && b.placeId === town.id && habitationBeds(b) > 0)
      .sort((a, b) => (HABITATION_FILL[a.type] ?? 3) - (HABITATION_FILL[b.type] ?? 3) || a.id - b.id),
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
    // can take it, and never count an imaginary bed in a full building. A home
    // the household does not already hold must be one it may take (145: a let
    // home wants the first year's rent in hand; a cottage nobody owns is free).
    const mayTake = (b) => b === old || habitationMayTake(town, b, group),
      together = old && room(old) >= group.length ? old : homes.find((b) => room(b) >= group.length && mayTake(b));
    for (const id of group) {
      const b = together || homes.find((h) => room(h) > 0 && mayTake(h)), social = W.components.social[id];
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
// What a flat costs to buy out of municipal hands. Kept as its own reading so a
// later section can price it against the demand for it (125).
function habitationPrice(b) {
  return habitationBeds(b) * 4;
}
// What a household of so many pays a year to live in a home it does not own.
// A coin here; the wages section prices it by the bed against what the town
// earns (145).
function habitationRent(b, town, members = 1) {
  return 1;
}
// The rent a household was last asked, or the home's one-coin rent before.
function habitationRentOf(tenancy, head) {
  return Math.max(1, tenancy?.rents?.[head] || tenancy?.rent || 1);
}
// Whether a household without this address may take it. Any home, here; the
// wages section asks a let home's rent in hand (145).
function habitationMayTake(town, b, group) {
  return true;
}
// Every coin a household holds between its members, the head's first.
function habitationPurse(head, members) {
  const ids = [head, ...members.filter((id) => id !== head)];
  return ids.filter((id) => W.components.identity[id]);
}
// ── The landlord's choice ────────────────────────────────────────────────────
// Rent was owed and never enforced: a household could sit twelve years in
// arrears in a full block while another slept at the hearth with coin in hand.
// Once a year, in a block with no bed to spare, the household deepest in
// arrears at four years and more is put out for a household of the town that
// has no address and a coin to pay with, one such exchange a block a year, and
// only while someone is waiting: nobody is put out into an empty city, and a
// cottage is a homestead, not a tenancy. The homeless this makes are the
// town's own, counted as seeking a bed, sleeping at the hall or the hearth
// until a block has room or their coin returns.
// Years of the home's rent (arrears are kept in coin): four with a household
// waiting to take the flat, six with nobody waiting when the household in it
// holds no coin at all, since a debt that deep is not going to be paid.
const HABITATION_EVICT_ARREARS = 4,
  HABITATION_HOPELESS_ARREARS = 6;
function habitationEvict(town, homes) {
  const social = W.components.social,
    residents = habitationResidents(town),
    seeking = residents.filter((id) => !social[id].homeBuildingId),
    purse = (h) => seeking.filter((id) => social[id].householdId === h).reduce((n, id) => n + Math.max(0, W.components.identity[id]?.civicCoins || 0), 0),
    payers = [...new Set(seeking.map((id) => social[id].householdId))]
      .filter((h) => purse(h) >= 1)
      .sort((a, b) => a - b);
  let evictions = 0;
  for (const b of homes) {
    if (!payers.length) break;
    if (b.type === "shelter" || !b.tenancy || b.tenancy.residents.length < habitationBeds(b)) continue;
    const rent = Math.max(1, habitationRent(b, town, 1));
    // The household let in must be able to pay the rent it is let in for.
    if (!payers.some((h) => purse(h) >= rent)) continue;
    const debtors = Object.entries(b.tenancy.arrears)
      .filter(([h, n]) => n >= HABITATION_EVICT_ARREARS * habitationRentOf(b.tenancy, +h))
      .sort((x, y) => y[1] - x[1] || +x[0] - +y[0]);
    if (!debtors.length) continue;
    const head = +debtors[0][0],
      out = b.tenancy.residents.filter((id) => social[id]?.householdId === head);
    if (!out.length) { delete b.tenancy.arrears[head]; continue; }
    const payer = payers.splice(payers.findIndex((h) => purse(h) >= rent), 1)[0],
      movers = seeking.filter((id) => social[id].householdId === payer);
    for (const id of out) social[id].homeBuildingId = 0;
    b.tenancy.residents = b.tenancy.residents.filter((id) => !out.includes(id));
    delete b.tenancy.arrears[head];
    for (const id of movers) {
      if (b.tenancy.residents.length >= habitationBeds(b)) break;
      social[id].homeBuildingId = b.id;
      b.tenancy.residents.push(id);
    }
    HABITATION.evictions++;
    HABITATION.evicted += out.length;
    evictions++;
  }
  // Nobody waiting, and a household that holds nothing and owes six years: the
  // landlord puts it out all the same, one a home a year, and the bed stands
  // empty for the next household that can pay. A cottage its household owns
  // is never let and never lost.
  for (const b of homes) {
    const t = b.tenancy;
    if (!t || (b.type === "shelter" && (!t.ownerId || t.residents.includes(t.ownerId)))) continue;
    const inside = (h) => t.residents.filter((id) => social[id]?.householdId === h),
      hopeless = Object.entries(t.arrears)
        .filter(([h, n]) => n >= HABITATION_HOPELESS_ARREARS * habitationRentOf(t, +h) && inside(+h).length && !inside(+h).some((id) => (W.components.identity[id]?.civicCoins || 0) > 0))
        .sort((x, y) => y[1] - x[1] || +x[0] - +y[0])[0];
    if (!hopeless) continue;
    const head = +hopeless[0], out = inside(head);
    for (const id of out) social[id].homeBuildingId = 0;
    t.residents = t.residents.filter((id) => !out.includes(id));
    delete t.arrears[head];
    HABITATION.evictions++;
    HABITATION.evicted += out.length;
    HABITATION.hopeless = (HABITATION.hopeless || 0) + 1;
    evictions++;
  }
  if (evictions && town.habitation)
    town.habitation.housed = residents.filter((id) => social[id].homeBuildingId).length;
  return evictions;
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
      tenancy.rents = {};
      for (const id of heads) {
        if (tenancy.residents.some((x) => x === tenancy.ownerId && W.components.social[x].householdId === id)) continue;
        if (!W.components.identity[id]) continue;
        // The household's purse, head first: a household of grown children
        // whose father has stopped working pays from the children's wages.
        const members = tenancy.residents.filter((x) => W.components.social[x]?.householdId === id),
          rent = Math.max(1, habitationRent(b, town, members.length)),
          due = rent + (tenancy.arrears[id] || 0);
        tenancy.rents[id] = rent;
        let paid = 0;
        for (const m of habitationPurse(id, members)) {
          const ident = W.components.identity[m], take = Math.min(due - paid, Math.max(0, ident.civicCoins || 0));
          ident.civicCoins = (ident.civicCoins || 0) - take;
          paid += take;
          if (paid >= due) break;
        }
        if (owner) owner.civicCoins = (owner.civicCoins || 0) + paid;
        else faction.treasury += paid;
        tenancy.arrears[id] = Math.min(12 * rent, due - paid);
      }
    }
    habitationEvict(town, homes);
    for (const b of homes) {
      const tenancy = b.tenancy;
      if (!tenancy.ownerId) {
        const asking = habitationPrice(b, town),
          buyer = tenancy.residents.find((id) => (W.components.identity[id]?.civicCoins || 0) >= asking);
        if (buyer) {
          const price = asking;
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
tickSystem("habitation", function () {
  if (W.tick % 256 !== 96) return;
  for (const town of W.settlements) if (!town.ruined) habitationAccounts(town, updateHabitationTown(town));
});
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
  evict: (placeId) => { const s = W.settlements.find((x) => x.id === placeId); return s ? habitationEvict(s, W.buildings.filter((b) => b.placeKind === "settlement" && b.placeId === s.id && habitationBeds(b) > 0 && b.tenancy)) : 0; },
  spare: (placeId) => habitationSpareBeds(W.settlements.find((s) => s.id === placeId)),
});
