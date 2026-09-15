// ═══════════════════════════════════════════════════════════════════════════
// 132. CRADLE — the widowed love again; and, behind the ship, the town bears
// its own children
// ═══════════════════════════════════════════════════════════════════════════
// Measured on battery causal-origin, a world of sixty to eighty people bore
// nought to three children a year, before its ship and after. What read as
// growth was section 40 kindling a new people of eight in the wilds every
// dozen years or so, adopted by the nearest town; two births a year is
// replacement for sixty people who live seventy-five years, so the world held
// — until, behind the ship, the founders aged out together and nothing
// replaced them. Of the handful of adults who passed every clause of
// canReproduce in a year, most stood with nobody to lie with: a partner beyond
// the coupling loop's four tiles, a partner long dead and never mourned, or,
// being single, nobody they were drawn to within two tiles.
//
// Always: a partner who is dead or gone is mourned — the bond is released and
// the survivor may love again — in the coupling loop when the survivor is
// ready and every sixty-four ticks for everyone. Section 42b releases it at
// the graveside, but some deaths and every disappearance passed it by.
//
// Only once a ship has left (shipHasLeft, read by 133 and 134 too):
//   - Partners who share a home lie together at night within eight tiles, not
//     only within four: the town's work scatters a couple across its fields
//     and blocks, and the coupling loop met them only by chance.
//   - The single adults of a town in their fertile years court: every sixteen
//     ticks each spends time with the one single of another house they are
//     most drawn to, and the ordinary rules of the social pass (42b, 75)
//     decide, over years, whether it comes to anything.
//   - A town with room bears children past the tile-count sexual capacity of
//     section 23: room is a larder that is not lean, no more than a quarter of
//     the people who call it home hungry, wherever they stand, and fewer
//     people than its fields feed, four to a finished farm over six.
// Each of the three was measured on the launch road of three battery seeds
// with the change switched off on the same code (HANDOFF §11) and each cost
// the ship — later launches on two or three seeds of three, and the room gate
// boomed the world to a hundred and thirty-nine and it halved twice. More
// children before the ship cost the ship. Behind it, the founders are dying
// together and the world needs every child it can bear.
function shipHasLeft() {
  return (W?.ascensions || []).length > 0;
}
const CRADLE_HOME_RADIUS = 8,
  CRADLE_COURT_CADENCE = 16,
  CRADLE_COURT_UPDATES = 3,
  CRADLE_PEOPLE_PER_FARM = 4,
  CRADLE_TOWN_BASE = 6,
  CRADLE_HUNGRY_SHARE = 0.25,
  CRADLE_HUNGRY = typeof GRANARY_HUNGRY === "number" ? GRANARY_HUNGRY : 70;
const CRADLE = { widowed: 0, courted: 0, roomPasses: 0 };
function cradleMourn(id, soc, partner) {
  soc.partnerId = 0;
  const other = W.components.social[partner];
  if (other && other.partnerId === id) other.partnerId = 0;
  for (const [a, b] of [
    [soc, partner],
    [other, id],
  ]) {
    const r = a?.relationships?.[b];
    if (r) {
      r.bonded = false;
      r.commitment = 0;
    }
  }
  if (typeof removeRelation === "function" && W.relations) {
    removeRelation(id, partner, "partner_of");
    removeRelation(partner, id, "partner_of");
  }
  CRADLE.widowed++;
}
function cradleMournTheDead() {
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON) continue;
    const soc = W.components.social[id];
    if (soc?.partnerId && !classifyAlive(soc.partnerId)) cradleMourn(id, soc, soc.partnerId);
  }
}
// ── Courtship (behind the ship) ─────────────────────────────────────────────
function cradleCourtship() {
  if (typeof updateRelationshipPair !== "function" || typeof socialChemistry !== "function") return 0;
  const byTown = new Map();
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const soc = W.components.social[id];
    if (!soc || soc.partnerId || soc.homePlaceKind !== "settlement" || !soc.homePlaceId) continue;
    if (!isAdultPerson(id)) continue;
    const l = W.components.life[id],
      body = W.components.body[id];
    if (!l || !body || l.age >= body.maxAge * PERSON_FERTILE_SHARE) continue;
    (byTown.get(soc.homePlaceId) || byTown.set(soc.homePlaceId, []).get(soc.homePlaceId)).push(id);
  }
  let courted = 0;
  for (const singles of byTown.values()) {
    if (singles.length < 2) continue;
    singles.sort((a, b) => a - b);
    const used = new Set();
    for (const a of singles) {
      if (used.has(a)) continue;
      const sa = W.components.social[a];
      let best = 0,
        score = -1;
      for (const b of singles) {
        if (b === a || used.has(b) || sameKin(sa, W.components.social[b])) continue;
        const s = socialChemistry(a, b) + (sa.relationships?.[b]?.attraction || 0);
        if (s > score) {
          score = s;
          best = b;
        }
      }
      if (!best) continue;
      for (let n = 0; n < CRADLE_COURT_UPDATES; n++) updateRelationshipPair(a, best);
      used.add(a);
      used.add(best);
      courted++;
    }
  }
  CRADLE.courted += courted;
  return courted;
}
const updateCouplingsCradleBase = updateCouplings;
updateCouplings = function () {
  if (W.tick % 64 === 0) cradleMournTheDead();
  if (W.tick % CRADLE_COURT_CADENCE === 8 && shipHasLeft()) cradleCourtship();
  updateCouplingsCradleBase();
};
// ── At home, at night (behind the ship) ─────────────────────────────────────
function cradleSameHome(a, b) {
  return !!(
    a?.homePlaceKind === "settlement" &&
    b?.homePlaceKind === "settlement" &&
    a.homePlaceId === b.homePlaceId
  );
}
const matingPartnerNearCradleBase = matingPartnerNear;
matingPartnerNear = function (id, soc, p, used) {
  const partner = soc?.partnerId;
  if (!partner) return false;
  if (!classifyAlive(partner)) {
    cradleMourn(id, soc, partner);
    return false;
  }
  if (matingPartnerNearCradleBase(id, soc, p, used)) return true;
  if (!shipHasLeft()) return false;
  if (used.has(partner) || !W.components.genome[partner] || !canReproduce(partner)) return false;
  const pp = W.components.position[partner];
  if (!pp || dist2(p.x, p.y, pp.x, pp.y) > CRADLE_HOME_RADIUS * CRADLE_HOME_RADIUS) return false;
  if (typeof nightAt !== "function" || !nightAt(p.x, p.y)) return false;
  return cradleSameHome(soc, W.components.social[partner]);
};
// ── Room (behind the ship) ──────────────────────────────────────────────────
let cradleRoomCache = { world: null, tick: -1, members: null, values: new Map() };
function cradleTownOf(id) {
  const soc = W.components.social[id];
  if (soc?.homePlaceKind === "settlement") {
    const home = W.settlements.find((s) => s.id === soc.homePlaceId && !s.ruined);
    if (home) return home;
  }
  const p = W.components.position[id];
  return p ? nearestSettlement(idx(p.x, p.y), 8) : null;
}
function cradleMembers() {
  if (cradleRoomCache.world !== W || cradleRoomCache.tick !== W.tick)
    cradleRoomCache = { world: W, tick: W.tick, members: null, values: new Map() };
  if (cradleRoomCache.members) return cradleRoomCache.members;
  const members = new Map();
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const soc = W.components.social[id];
    if (soc?.homePlaceKind !== "settlement" || !soc.homePlaceId) continue;
    const m = members.get(soc.homePlaceId) || { people: 0, hungry: 0 };
    m.people++;
    if ((W.components.life[id]?.hunger || 0) > CRADLE_HUNGRY) m.hungry++;
    members.set(soc.homePlaceId, m);
  }
  cradleRoomCache.members = members;
  return members;
}
function cradleRoom(town) {
  if (!town || town.ruined || !town.knownProcesses || typeof foodOutlook !== "function") return null;
  const members = cradleMembers();
  if (cradleRoomCache.values.has(town.id)) return cradleRoomCache.values.get(town.id);
  const m = members.get(town.id) || { people: 0, hungry: 0 },
    farms = completedBuildings(town, "farm").length,
    cap = CRADLE_TOWN_BASE + CRADLE_PEOPLE_PER_FARM * farms,
    outlook = foodOutlook(town),
    lean = typeof LEAN_FOOD === "number" ? LEAN_FOOD : 10,
    hungry = m.people ? m.hungry / m.people : 0,
    fed = !!outlook && outlook.larder >= lean && hungry <= CRADLE_HUNGRY_SHARE,
    room = {
      people: m.people,
      hungry: +hungry.toFixed(3),
      farms,
      cap,
      larder: outlook ? Math.round(outlook.larder) : 0,
      fed,
      room: fed && m.people < cap,
    };
  cradleRoomCache.values.set(town.id, room);
  return room;
}
const reproductionDensityAllowsCradleBase = reproductionDensityAllows;
reproductionDensityAllows = function (id, kind) {
  if (kind === KINDS.PERSON && W?.settlements && shipHasLeft() && cradleRoom(cradleTownOf(id))?.room) {
    CRADLE.roomPasses++;
    return true;
  }
  return reproductionDensityAllowsCradleBase(id, kind);
};
window.ALIFE_CRADLE_DEBUG = Object.freeze({
  counts: () => ({ ...CRADLE }),
  shipHasLeft: () => shipHasLeft(),
  mourn: () => cradleMournTheDead(),
  court: () => cradleCourtship(),
  room: (townId) => cradleRoom(W.settlements.find((s) => s.id === townId)),
  townOf: (id) => cradleTownOf(id)?.id || 0,
  partnerNear: (id) => {
    const soc = W.components.social[id],
      p = W.components.position[id];
    return !!(soc && p && matingPartnerNear(id, soc, p, new Set()));
  },
});
