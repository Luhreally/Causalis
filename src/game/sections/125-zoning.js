// ═══════════════════════════════════════════════════════════════════════════
// 125. ZONING — a town decides what a quarter is for, and builds accordingly
// ═══════════════════════════════════════════════════════════════════════════
// Until now a town put its next building on the next free slot of the next
// ring out: a forge beside a nursery, a farm between two cottages, a market
// wherever the ordinal happened to land. Towns read as a heap of buildings
// rather than as places, and nothing ever changed its mind about a plot once
// something stood on it.
//
// A town now holds a plan. The ground around it is divided into quarters — a
// civic heart, a commercial core, the residential ring, one quarter given over
// to works, and the fields beyond — and where the line falls is the town's own,
// taken from its architecture and its seed, so two towns on one world do not
// put their industry in the same corner. What gets built comes from what the
// town is short of: beds, trade, or work. That is the whole management system,
// and nobody runs it — the people do, by being crowded, or idle, or hungry for
// somewhere to sell.
//
// And a plan can change its mind. A cottage standing where the city has since
// grown dense is bought out and replaced by a block, its matter left as rubble
// for the salvagers and its household rehoused. That is how a town of houses
// becomes a city of flats: not by decree, but one plot at a time, as the core
// tightens around them. Owning where you live stops being ordinary and starts
// being a thing you buy — and the price follows the demand, so in a crowded
// modern city it is a luxury, and most people rent from the polity.
//
// Everything here is derived from the world and written back through the
// existing planning and collapse paths, so matter is conserved and rendering
// only reads.
const ZONING_SECTORS = 8,
  ZONING_ACTIVE_CAP = 6,
  ZONING_REACH = 14,
  ZONING_DEMAND_FLOOR = 0.22,
  ZONING_REDEVELOP_YEARS = 4,
  ZONING = { planned: 0, redeveloped: 0, inQuarter: 0, nearQuarter: 0, outOfQuarter: 0 };
// Which quarter a use belongs to. These have to agree with the rings the
// townscape planner already keeps (92's `zoneOf`), or the two pull the same
// building in different directions: a hearth called civic here but industrial
// there was drawn onto the square by this section and pushed the hall five
// tiles out of its own town. Where 92 sites a type specially — the dock on its
// water, the observatory and the launch tower out at the edge — it is left out
// of this table entirely and falls through untouched.
const ZONE_OF_TYPE = Object.freeze({
  hall: "civic",
  market: "civic",
  archive: "civic",
  shrine: "civic",
  clinic: "civic",
  monument: "civic",
  office: "commercial",
  shelter: "residential",
  tenement: "residential",
  tower: "residential",
  workshop: "industry",
  forge: "industry",
  kiln: "industry",
  hearth: "industry",
  stockpile: "industry",
  factory: "industry",
  corral: "farmland",
  farm: "farmland",
});
let zoningWorld = null;
const ZONING_GENOMES = new Map();
// Where a town's quarters fall. Taken from the architecture it already has and
// from its own place in the seed, so the plan is the town's rather than the
// world's: one puts its works to the north-east and its shops on the south
// road, its neighbour the other way about.
function zoningGenome(place) {
  if (zoningWorld !== W) {
    ZONING_GENOMES.clear();
    zoningWorld = W;
  }
  const held = ZONING_GENOMES.get(place.id);
  if (held) return held;
  const a = typeof makeArchitectureGenome === "function" ? makeArchitectureGenome(place) : null,
    r = makeRng(hashParts(W.seedHash, "zoning-plan-v1", place.id), "zoning"),
    industry = r.int(ZONING_SECTORS),
    genome = Object.freeze({
      industry,
      // The shops face away from the works, which is what anyone would do.
      commerce: (industry + 3 + r.int(3)) % ZONING_SECTORS,
      commerceSpread: 1 + r.int(2),
      turn: (a?.orientation || 0) * (Math.PI / 2) + r.range(-0.4, 0.4),
      // How tightly the core is drawn: a close-packed town and a loose one.
      grain: r.range(0.78, 1.34),
    });
  ZONING_GENOMES.set(place.id, genome);
  return genome;
}
// The built-up radius, taken from the townscape planner rather than invented
// here. That is the whole trick: 92 already decides how far out each kind of
// building stands, so the quarters must not argue about distance. They decide
// direction — which way the works face, which street the shops are on — and
// leave the rings alone. Drawn with their own radii, the two disagreed and only
// a quarter of the town's buildings ended up in the quarter meant for them.
function zoningOuter(place) {
  return typeof townOuterRing === "function" ? townOuterRing(place) : 4;
}
function zoningFieldCap() {
  return typeof FIELD_RING_CAP === "number" ? FIELD_RING_CAP : 7;
}
// The dense middle: what a city stops keeping cottages in.
function zoningCore(place) {
  return Math.max(2, Math.round(zoningOuter(place) * 0.6));
}
function zoningSector(place, dx, dy) {
  const g = zoningGenome(place),
    angle = Math.atan2(dy, dx) - g.turn,
    turns = angle / (Math.PI * 2);
  return ((Math.floor(turns * ZONING_SECTORS) % ZONING_SECTORS) + ZONING_SECTORS) % ZONING_SECTORS;
}
// What a plot is for. A pure reading of the ground: nothing is stored per tile,
// so the plan cannot drift from the town that holds it. Distances are measured
// the way the townscape planner measures them — the longer of the two axes —
// so a ring means the same thing to both.
function zoneAt(place, x, y) {
  if (!place?.knownProcesses) return "open";
  const dx = x - place.x,
    dy = y - place.y,
    d = Math.max(Math.abs(dx), Math.abs(dy)),
    outer = zoningOuter(place),
    fields = Math.min(outer + 1, zoningFieldCap() - 1);
  if (d > zoningFieldCap() + 3) return "open";
  // The square at the middle, where the hall and the clinic stand.
  if (d <= 2) return "civic";
  if (d > fields) return "farmland";
  const g = zoningGenome(place),
    sector = zoningSector(place, dx, dy);
  if (sector === g.industry) return "industry";
  for (let n = 0; n < g.commerceSpread; n++)
    if (sector === (g.commerce + n) % ZONING_SECTORS) return "commercial";
  return "residential";
}
// Where a use will settle for, when its own quarter is full. A shop would
// rather be on the civic square than out among the fields; a works would rather
// be at the edge of the farmland than in the middle of the houses. Without
// this the plan gave up at the first full quarter and the ordinal ring placed
// eight buildings in ten, which is the old behaviour wearing a plan's clothes.
const ZONE_NEIGHBOURS = Object.freeze({
  civic: ["civic", "commercial", "residential"],
  // A farm is content anywhere out of the built-up middle.
  commercial: ["commercial", "civic", "residential"],
  residential: ["residential", "commercial", "civic", "farmland"],
  industry: ["industry", "farmland", "commercial", "civic"],
  farmland: ["farmland", "residential", "open"],
  open: ["open", "farmland", "residential"],
});
function zoningZoneOf(b) {
  return ZONE_OF_TYPE[b?.type] || "open";
}
// Is this plot somewhere the use would accept, and how gladly?
function zoningPreference(want, zone) {
  const accept = ZONE_NEIGHBOURS[want] || [want];
  return accept.indexOf(zone);
}
// ── What the town is short of ────────────────────────────────────────────────
// Three readings, and the largest is what gets built next. Beds first, because
// a town that cannot house its people loses them; then work, because a town
// with nothing to make cannot pay for anything; then trade.
function zoningDemand(place) {
  if (!place?.knownProcesses || place.ruined) return null;
  const pop = settlementPopulation(place),
    count = (type) => completedBuildings(place, type).length,
    housing = place.habitation,
    beds = housing
      ? housing.beds
      : W.buildings.reduce(
          (n, b) =>
            b.placeKind === "settlement" && b.placeId === place.id && typeof habitationBeds === "function"
              ? n + habitationBeds(b)
              : n,
          0,
        ),
    residents = housing ? housing.residents : pop,
    unhoused = housing ? Math.max(0, housing.residents - housing.housed) : 0,
    works = count("workshop") + count("forge") + count("kiln") + count("factory"),
    trade = count("market") + count("office") + count("stockpile"),
    // A site waiting on material is a town that cannot make what it needs.
    waiting = W.buildings.filter(
      (b) =>
        !b.complete &&
        !b.ruined &&
        b.placeKind === "settlement" &&
        b.placeId === place.id &&
        typeof missingBuildingMaterial === "function" &&
        missingBuildingMaterial(b),
    ).length;
  return {
    pop,
    beds,
    residents,
    residential: clamp(
      (residents - beds) / Math.max(6, residents) + unhoused / Math.max(4, residents),
      0,
      1,
    ),
    industry: clamp(pop / (16 * (works + 1)) - 0.35 + waiting * 0.12, 0, 1),
    commercial: clamp(pop / (13 * (trade + 1)) - 0.4, 0, 1),
    works,
    trade,
    waiting,
  };
}
// The building a demand asks for, given what the town actually knows how to
// raise. A crowded town that knows masonry answers a bed shortage with a block,
// not with a fifteenth cottage.
function zoningWantedType(place, demand) {
  if (!demand) return null;
  const strongest = ["residential", "industry", "commercial"].sort(
    (a, b) => demand[b] - demand[a] || a.localeCompare(b),
  )[0];
  if (demand[strongest] < ZONING_DEMAND_FLOOR) return null;
  const knows = (...t) => (typeof cityKnows === "function" ? cityKnows(place, ...t) : false),
    has = (type) => completedBuildings(place, type).length;
  if (strongest === "residential") {
    if (knows("electricity") && has("tenement") >= 2) return "tower";
    if (knows("masonry") && demand.pop >= 18) return "tenement";
    return "shelter";
  }
  if (strongest === "industry") {
    if (knows("electricity") && has("workshop")) return "factory";
    if (knows("metallurgy") && !has("forge")) return "forge";
    if (knows("ceramics") && !has("kiln")) return "kiln";
    return "workshop";
  }
  if (knows("currency") || knows("governance")) return has("market") ? "office" : "market";
  return "stockpile";
}
// The town builds what it is short of, once it has hands free for it.
const ensurePlacePlansZoningBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansZoningBase(place);
  if (!place?.knownProcesses || place.ruined || place.active === false) return;
  // Plans refresh once a tick (70). The base keeps that rule with its own
  // stamp; asking a second time in the same tick must plan nothing, so this
  // keeps a stamp of its own rather than building behind the guard.
  if (place.zoningPlansTick === W.tick) return;
  place.zoningPlansTick = W.tick;
  if (activeBuildings(place).length >= ZONING_ACTIVE_CAP) return;
  // The square comes first, and a hamlet has no plan to speak of. Planning to
  // demand before the hall was built filled the ring around the centre and left
  // the hall seven tiles out, where it is the middle of nothing. A town directs
  // its own growth once it is a town — once its hall stands — and until then it
  // grows the way it always did.
  if (!completedBuildings(place, "hall").length) return;
  if (activeBuildings(place).some((b) => ZONE_OF_TYPE[b.type] === "civic")) return;
  const demand = zoningDemand(place),
    type = zoningWantedType(place, demand);
  if (!type || !BUILDING_DEFS[type]) return;
  // A market belongs on the square, so it waits for the square to have a hall.
  if (
    (type === "market" || type === "office") &&
    !completedBuildings(place, "hall").length
  )
    return;
  if (planBuilding(place, type, 4)) ZONING.planned++;
};
// ── Where it goes ────────────────────────────────────────────────────────────
// Nothing here places a building. `92-townscape` already lays a town out — a
// plaza it keeps clear, lanes it keeps clear, a ring for each kind of use, the
// works to leeward — and an override that sited buildings by quarter alone
// bypassed all of it and put them on the streets the town had just paved. The
// quarter is offered to that planner as a preference instead (see the call to
// `zoningPreference` in 92), so the plan bends the layout without replacing it.
function zoningRoadFrontage(x, y) {
  let n = 0;
  for (const [dx, dy] of DIRS.slice(0, 8)) {
    const nx = x + dx,
      ny = y + dy;
    if (inside(nx, ny) && roadLevel(idx(nx, ny)) > 0) n++;
  }
  return n;
}
// How gladly a use would stand on this plot, as a bias for the town planner:
// negative is better, and a quarter that will not have it at all is left alone
// rather than forbidden, because a town must always find somewhere to build.
function zoningSiteBias(place, type, x, y) {
  const want = ZONE_OF_TYPE[type];
  if (!place?.knownProcesses || !want) return 0;
  // The square is a ring, not a direction. 92 puts the hall and the market at
  // the centre because that is where they belong, and a sector preference on
  // top of that is meaningless — it only ever fought the ring. A civic building
  // is left to the planner entirely.
  if (want === "civic") return 0;
  const pref = zoningPreference(want, zoneAt(place, x, y));
  // Kept deliberately smaller than one ring step of the planner's own scoring
  // (three a ring). The quarter is a preference between plots the planner
  // already likes, never a reason to move a building a ring out: set as high as
  // the ring weight it dragged the hall from four tiles to five.
  if (pref < 0) return -0.8;
  const frontage = zoningRoadFrontage(x, y),
    wantsStreet = want === "commercial" || want === "industry";
  return (2 - pref) * 0.8 + (wantsStreet ? Math.min(frontage, 3) * 0.25 : 0);
}
// Where the buildings actually ended up, counted once each when they are sited
// rather than once per plot considered — the ratio is what says whether the
// plan is steering anything.
const plannedBuildingTileZoningBase = plannedBuildingTile;
plannedBuildingTile = function (place, type, ordinal) {
  const tile = plannedBuildingTileZoningBase(place, type, ordinal),
    want = ZONE_OF_TYPE[type];
  if (tile && want && place?.knownProcesses) {
    const pref = zoningPreference(want, zoneAt(place, tile[0], tile[1]));
    if (pref === 0) ZONING.inQuarter++;
    else if (pref > 0) ZONING.nearQuarter++;
    else ZONING.outOfQuarter++;
  }
  return tile;
};
// ── Redevelopment ────────────────────────────────────────────────────────────
// A cottage standing where the city has grown dense is bought out. It goes down
// the ordinary way — as a collapse, so its matter stays in the world as rubble
// for the salvagers — and a block is planned in its place. Nobody is put on the
// street to do it: the town must already have beds enough for the household.
function zoningRedevelopable(town) {
  const core = zoningCore(town);
  return W.buildings.filter(
    (b) =>
      b.complete &&
      !b.ruined &&
      b.type === "shelter" &&
      b.placeKind === "settlement" &&
      b.placeId === town.id &&
      Math.max(Math.abs(b.x - town.x), Math.abs(b.y - town.y)) <= core &&
      // Never the square itself. A block raised on the civic ring takes the plot
      // the hall wants and pushes the middle of the town out to its edge; the
      // centre is for the hall and the market, and a cottage that happens to
      // stand there is left where it is.
      ["residential", "commercial"].includes(zoneAt(town, b.x, b.y)),
  );
}
function zoningRedevelop(town) {
  if (!town?.knownProcesses || town.ruined) return null;
  if (typeof cityKnows === "function" && !cityKnows(town, "masonry")) return null;
  const year = Math.floor(W.tick / TICKS_PER_YEAR);
  if (town.zoningRedevelopedYear != null && year - town.zoningRedevelopedYear < ZONING_REDEVELOP_YEARS)
    return null;
  const demand = zoningDemand(town);
  if (!demand) return null;
  // Density, not a bed shortage, is what buys a cottage out. A town with beds
  // to spare still replaces the houses in its core once it is a town of that
  // size — which is the whole point: the core stops being somewhere you can own
  // a house and becomes somewhere you rent a flat. Waiting on a bed shortage
  // meant it never happened at all, because a town with cottages has beds.
  const gate = typeof urbanGate === "function" ? urbanGate().local : 18;
  if (demand.pop < Math.max(12, Math.round(gate * 0.75))) return null;
  const dense = cityKnows(town, "electricity") ? "tower" : "tenement";
  // One plot at a time. A town that knocks down a second cottage while the block
  // replacing the first is still a hole in the ground loses beds faster than it
  // builds them, and the people go with them.
  if (
    W.buildings.some(
      (b) =>
        !b.complete &&
        !b.ruined &&
        b.placeKind === "settlement" &&
        b.placeId === town.id &&
        (b.type === "tenement" || b.type === "tower"),
    )
  )
    return null;
  // Nor while the last plot is still rubble. A town that knocks a second cottage
  // down before the first is cleared has two ruins and one pair of hands, and
  // its salvagers walk to the nearer of them instead of the one that mattered.
  if (
    W.workOrders.some(
      (o) => o.status === "open" && o.type === "salvage" && o.placeId === town.id,
    )
  )
    return null;
  const spare = typeof habitationSpareBeds === "function" ? habitationSpareBeds(town) : 0;
  for (const b of zoningRedevelopable(town)) {
    const household = b.tenancy?.residents?.length || 0;
    // Never evict into nothing: somewhere else in town must be able to take them.
    if (spare < household) continue;
    town.zoningRedevelopedYear = year;
    ZONING.redeveloped++;
    collapseBuilding(
      b,
      `bought out for redevelopment: the ${dense === "tower" ? "tower" : "block"} the city wants stands where this cottage stood`,
      town.importantEvents?.at(-1) || 0,
    );
    planBuilding(town, dense, 6);
    return b.id;
  }
  return null;
}
const updateHabitationTownZoningBase = updateHabitationTown;
updateHabitationTown = function (town) {
  const homes = updateHabitationTownZoningBase(town);
  zoningRedevelop(town);
  if (town.habitation) {
    const owned = homes.filter((b) => b.tenancy?.ownerId).length;
    town.habitation.homes = homes.length;
    town.habitation.owned = owned;
    town.habitation.ownedShare = homes.length ? +(owned / homes.length).toFixed(2) : 0;
  }
  return homes;
};
// ── Owning where you live ────────────────────────────────────────────────────
// A flat used to cost four coin a bed whatever the city was like. The price now
// follows the demand for it and the density of what is being sold, so a cottage
// in a quiet town stays within reach of the household in it and a flat in a
// crowded modern city does not. Nothing forbids ownership; it simply becomes a
// thing most people cannot afford, which is what was wanted.
const habitationPriceZoningBase = habitationPrice;
habitationPrice = function (b, town) {
  const base = habitationPriceZoningBase(b, town),
    place = town || (b ? W.settlements.find((s) => s.id === b.placeId) : null);
  if (!place?.knownProcesses) return base;
  const demand = zoningDemand(place);
  if (!demand) return base;
  const dense = b.type === "tower" ? 2.2 : b.type === "tenement" ? 1.6 : 1,
    pressure = 1 + demand.residential * 2.4,
    modern = typeof cityKnows === "function" && cityKnows(place, "electricity") ? 1.5 : 1;
  return Math.max(base, Math.round(base * dense * pressure * modern));
};
// ── What the town says about itself ──────────────────────────────────────────
const renderPlacePageZoningBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageZoningBase(id),
    town = W.settlements.find((s) => s.id === id);
  if (!town?.knownProcesses || town.ruined) return html;
  const demand = zoningDemand(town);
  if (!demand) return html;
  const g = zoningGenome(town),
    core = zoningCore(town),
    bar = (v) => `${"█".repeat(Math.round(v * 10))}${"·".repeat(10 - Math.round(v * 10))}`,
    counts = {},
    quarter = ["civic", "commercial", "residential", "industry", "farmland"];
  for (const b of W.buildings)
    if (!b.ruined && b.placeKind === "settlement" && b.placeId === town.id) {
      const z = zoningZoneOf(b);
      counts[z] = (counts[z] || 0) + 1;
    }
  const owned = town.habitation?.owned ?? 0,
    homesN = town.habitation?.homes ?? 0,
    share = town.habitation?.ownedShare;
  return (
    html +
    `<div class="subhead">Zoning and demand</div>` +
    `<p>A core ${core} tiles across, works to the ${["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][g.industry]}, shops to the ${["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"][g.commerce]}.</p>` +
    `<div class="kv"><span>Homes wanted</span><b>${bar(demand.residential)} ${Math.round(demand.residential * 100)}%</b>` +
    `<span>Work wanted</span><b>${bar(demand.industry)} ${Math.round(demand.industry * 100)}%</b>` +
    `<span>Trade wanted</span><b>${bar(demand.commercial)} ${Math.round(demand.commercial * 100)}%</b></div>` +
    `<div class="kv">${quarter.map((z) => `<span>${titleCase(z)}</span><b>${counts[z] || 0} standing</b>`).join("")}</div>` +
    (share == null || !homesN
      ? ""
      : `<p>${owned} of ${homesN} homes are owned by the household in them — ${Math.round(share * 100)}% owner-occupied; the rest rent from the polity.</p>`)
  );
};
window.ALIFE_ZONING_DEBUG = Object.freeze({
  counts: () => ({ ...ZONING }),
  reset: () => {
    for (const k of Object.keys(ZONING)) ZONING[k] = 0;
  },
  genome: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? { ...zoningGenome(s), core: zoningCore(s) } : null;
  },
  // How gladly a use would take this plot: 0 its own quarter, higher a quarter
  // it will settle for, -1 one that will not have it.
  prefers: (placeId, type, x, y) => {
    const s = W.settlements.find((p) => p.id === placeId);
    if (!s) return null;
    const want = ZONE_OF_TYPE[type];
    return want ? zoningPreference(want, zoneAt(s, x, y)) : null;
  },
  bias: (placeId, type, x, y) => {
    const s = W.settlements.find((p) => p.id === placeId);
    return s ? zoningSiteBias(s, type, x, y) : null;
  },
  zone: (placeId, x, y) => {
    const s = W.settlements.find((p) => p.id === placeId);
    return s ? zoneAt(s, x, y) : null;
  },
  demand: (placeId) => {
    const s = W.settlements.find((p) => p.id === placeId);
    return s ? zoningDemand(s) : null;
  },
  wanted: (placeId) => {
    const s = W.settlements.find((p) => p.id === placeId);
    return s ? zoningWantedType(s, zoningDemand(s)) : null;
  },
  price: (buildingId) => {
    const b = W.buildings.find((x) => x.id === buildingId);
    return b ? habitationPrice(b) : null;
  },
  // The cottages standing where the city has grown dense: what redevelopment
  // is looking at, before the crowd and the spare beds decide whether it acts.
  redevelopable: (placeId) => {
    const s = W.settlements.find((p) => p.id === placeId);
    return s ? zoningRedevelopable(s).map((b) => b.id) : null;
  },
  gate: (placeId) => {
    const s = W.settlements.find((p) => p.id === placeId);
    if (!s) return null;
    const local = typeof urbanGate === "function" ? urbanGate().local : 18;
    return { pop: settlementPopulation(s), needs: Math.max(12, Math.round(local * 0.75)),
      spare: typeof habitationSpareBeds === "function" ? habitationSpareBeds(s) : 0 };
  },
  redevelop: (placeId) => {
    const s = W.settlements.find((p) => p.id === placeId);
    return s ? zoningRedevelop(s) : null;
  },
  // Which zone every standing building of a town sits in: the plan, checked
  // against what was actually built.
  audit: (placeId) => {
    const s = W.settlements.find((p) => p.id === placeId);
    if (!s) return null;
    const rows = W.buildings
      .filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id)
      .map((b) => ({ type: b.type, want: zoningZoneOf(b), on: zoneAt(s, b.x, b.y) }));
    return {
      total: rows.length,
      matched: rows.filter((r) => r.want === r.on).length,
      accepted: rows.filter((r) => zoningPreference(r.want, r.on) >= 0).length,
      rows: rows.slice(0, 24),
    };
  },
});
