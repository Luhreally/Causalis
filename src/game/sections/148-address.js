// ═══════════════════════════════════════════════════════════════════════════
// 148. AN ADDRESS — where a person lives, on the page that says who they are
// ═══════════════════════════════════════════════════════════════════════════
// Asked for: to see where a townsperson lives when they are inspected. The
// address was kept all along (121 deals every household a home once a year
// and keeps it on the social component as homeBuildingId) and the homes lens
// reads its tenure (144), but the inspector said nothing of it. Now the
// inspector opens a Home block after the life rows: the home and its number
// in the block, the town, who owns it or whom the rent goes to, the rent and
// what is owed, the household under the same roof and the beds it shares,
// with the home a click away on the map; and a person with no bed says so,
// sleeping rough in a town or wandering with none. The selection summary
// carries the same in a line. Nothing here writes the world.
const ADDRESS_HOME_NAMES = Object.freeze({
  shelter: "Cottage",
  tenement: "Tenement",
  tower: "Tower block",
});
function addressTown(id) {
  const soc = W.components.social[id];
  return soc?.homePlaceKind === "settlement"
    ? W.settlements.find((s) => s.id === soc.homePlaceId && !s.ruined) || null
    : null;
}
// The home, or for a child born since the year's dealing the roof of the
// household or a parent it sleeps under (144 counts it sheltered the same way).
function addressHome(id) {
  const home = habitationHome(id);
  if (home || isAdultPerson(id)) return { home, via: 0 };
  const soc = W.components.social[id];
  for (const p of [soc?.householdId, ...(W.components.identity[id]?.parents || [])]) {
    if (!p || p === id || !classifyAlive(p)) continue;
    const roof = habitationHome(p);
    if (roof) return { home: roof, via: p };
  }
  return { home: null, via: 0 };
}
function addressOf(id) {
  if (!W || W.kind[id] !== KINDS.PERSON || !W.components.life[id]) return null;
  const soc = W.components.social[id],
    town = addressTown(id),
    { home, via } = addressHome(id);
  if (!home)
    return {
      state: town ? "rough" : soc?.homePlaceKind === "camp" ? "camp" : "wanderer",
      townId: town?.id || 0,
      town: town?.name || "",
    };
  const t = home.tenancy || {},
    who = via || id,
    head = W.components.social[who]?.householdId || who,
    residents = (t.residents || []).filter(
      (r) => classifyAlive(r) && W.components.social[r]?.homeBuildingId === home.id,
    ),
    households = [...new Set(residents.map((r) => W.components.social[r]?.householdId || r))].sort(
      (a, b) => a - b,
    ),
    flat = home.type === "shelter" ? 0 : Math.max(1, households.indexOf(head) + 1),
    household = residents.filter(
      (r) => r !== id && (W.components.social[r]?.householdId || r) === head,
    ),
    homeTown = W.settlements.find((s) => s.id === home.placeId) || town,
    faction = W.factions.find((f) => f.id === homeTown?.factionId),
    coin = !!faction && polityCoins(faction),
    rent = habitationRentOf(t, head),
    owedCoin = Math.max(0, t.arrears?.[head] || 0),
    ownerHere =
      !!t.ownerId && (t.ownerId === head || household.includes(t.ownerId) || t.ownerId === id),
    tenure = ownerHere ? "owned" : t.ownerId ? "let" : "municipal";
  return {
    state: "home",
    via,
    buildingId: home.id,
    type: home.type,
    name: ADDRESS_HOME_NAMES[home.type] || BUILDING_DEFS[home.type]?.name || titleCase(home.type),
    number: home.id,
    flat,
    tile: idx(home.x, home.y),
    townId: homeTown?.id || 0,
    town: homeTown?.name || "",
    tenure,
    ownerId: t.ownerId || 0,
    coin,
    rent: coin && tenure !== "owned" ? rent : 0,
    owedCoin,
    owedYears: coin && owedCoin >= rent ? Math.floor(owedCoin / rent) : 0,
    household,
    residents: residents.length,
    beds: habitationBeds(home),
  };
}
function addressLine(a) {
  if (!a) return "";
  if (a.state === "rough") return `Sleeping rough in ${a.town}`;
  if (a.state === "camp") return "Sleeps at the camp";
  if (a.state === "wanderer") return "No home; wandering";
  return `${a.flat ? `Flat ${a.flat}, ` : ""}${a.name} ${a.number}, ${a.town}`;
}
function addressTenureText(a) {
  if (a.tenure === "owned") return "owned by the household";
  if (a.tenure === "let")
    return `rented from ${entityLink(a.ownerId) || esc(entityName(a.ownerId) || "a landlord")}`;
  return "let by the town";
}
function addressBlockHTML(id) {
  const a = addressOf(id);
  if (!a) return "";
  if (a.state !== "home") {
    const why =
      a.state === "rough"
        ? `No bed of their own in ${esc(a.town)}; they sleep at the hall or the hearth.`
        : a.state === "camp"
          ? "The camp's fires are home until a town is founded."
          : "Belongs to no town, and sleeps where night finds them.";
    return `<div class="subhead">Home</div><div class="kv" data-address="${a.state}"><span>Address</span><b>${esc(addressLine(a))}</b><span>Beds</span><b class="muted">${why}</b></div>`;
  }
  const rows = [
    `<span>Address</span><b><span class="gold" data-world-goto="${a.tile}" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px" title="Go to this home">⌂ ${esc(addressLine(a))}</span></b>`,
    `<span>Tenure</span><b>${addressTenureText(a)}${a.via ? ` · under ${entityLink(a.via) || "a parent"}'s roof` : ""}</b>`,
  ];
  if (a.rent)
    rows.push(
      `<span>Rent</span><b>${a.rent} coin a year${a.owedYears ? ` · <span style="color:var(--red)">${a.owedYears} year${a.owedYears === 1 ? "" : "s"} behind (${a.owedCoin} owed)</span>` : a.owedCoin ? ` · ${a.owedCoin} owed` : " · paid up"}</b>`,
    );
  rows.push(
    `<span>Household</span><b>${a.household.length ? a.household.slice(0, 6).map(entityLink).filter(Boolean).join(", ") + (a.household.length > 6 ? ` and ${a.household.length - 6} more` : "") : "lives alone"}</b>`,
    `<span>Under this roof</span><b>${a.residents} of ${a.beds} beds slept in</b>`,
  );
  return `<div class="subhead">Home</div><div class="kv" data-address="home">${rows.join("")}</div>`;
}
const organismInspectorAddressBase = organismInspector;
organismInspector = function (id) {
  const html = organismInspectorAddressBase(id);
  if (!W?.components?.life?.[id] || W.kind[id] !== KINDS.PERSON) return html;
  const block = addressBlockHTML(id),
    at = html.indexOf("<details");
  return !block ? html : at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
const selectionSummaryAddressBase = selectionSummaryMarkup;
selectionSummaryMarkup = function () {
  const html = selectionSummaryAddressBase(),
    id = UI.selectedEntity;
  if (!html || !id || W.kind[id] !== KINDS.PERSON || !W.components.life[id]) return html;
  const a = addressOf(id),
    at = html.indexOf('<div class="experience-actions">');
  if (!a || at < 0) return html;
  const line = `<p class="muted" data-address-line="${a.state}">${a.state === "home" ? "⌂" : "☾"} ${esc(addressLine(a))}</p>`;
  return html.slice(0, at) + line + html.slice(at);
};
window.ALIFE_ADDRESS_DEBUG = Object.freeze({
  of: (id) => addressOf(id),
  line: (id) => addressLine(addressOf(id)),
  block: (id) => addressBlockHTML(id),
});
