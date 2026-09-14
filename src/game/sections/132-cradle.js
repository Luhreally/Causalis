// ═══════════════════════════════════════════════════════════════════════════
// 132. CRADLE — the widowed love again
// ═══════════════════════════════════════════════════════════════════════════
// Measured on battery causal-origin, a world of sixty to eighty people bore
// nought to three children a year, before its ship and after. What read as
// growth was section 40 kindling a new people of eight in the wilds every
// dozen years or so, adopted by the nearest town; two births a year is
// replacement for sixty people who live seventy-five years, so the world held
// — until, behind the ship, the founders aged out together and nothing
// replaced them. Of the handful of adults who passed every clause of
// canReproduce in a year, most stood with nobody to lie with, and one or two
// every year were faithful to a partner long dead: section 42b releases the
// bond at the graveside, but some deaths and every disappearance passed it by,
// and the widowed kept faith with nobody for life. A partner who is dead or
// gone is mourned now — the bond is released and the survivor may love again —
// in the coupling loop when the survivor is ready, and every sixty-four ticks
// for everyone.
//
// Tried and withdrawn (HANDOFF §11), each measured on the launch road of
// three battery seeds against the same code with the change turned off: a
// fed town with fewer people than its fields feed bypassing the tile-count
// sexual capacity (boomed the world to a hundred and thirty-nine and it halved
// twice, no ship); partners who share a home lying together at night within
// eight tiles (later launches on two seeds of three); and the single adults
// of a town courting every sixteen ticks (later launches on all three). More
// children before the ship cost the ship; the capacity stays as 127 left it
// and the coupling loop as 76 wrote it.
const CRADLE = { widowed: 0 };
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
const updateCouplingsCradleBase = updateCouplings;
updateCouplings = function () {
  if (W.tick % 64 === 0) cradleMournTheDead();
  updateCouplingsCradleBase();
};
const matingPartnerNearCradleBase = matingPartnerNear;
matingPartnerNear = function (id, soc, p, used) {
  const partner = soc?.partnerId;
  if (partner && !classifyAlive(partner)) {
    cradleMourn(id, soc, partner);
    return false;
  }
  return matingPartnerNearCradleBase(id, soc, p, used);
};
window.ALIFE_CRADLE_DEBUG = Object.freeze({
  counts: () => ({ ...CRADLE }),
  mourn: () => cradleMournTheDead(),
  partnerNear: (id) => {
    const soc = W.components.social[id],
      p = W.components.position[id];
    return !!(soc && p && matingPartnerNear(id, soc, p, new Set()));
  },
});
